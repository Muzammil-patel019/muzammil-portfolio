import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("card storage rejects anonymous and non-owner access and stale updates", async () => {
  const db = new PGlite(),
    owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    doc = { version: 1, cards: [], statements: [] };
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;grant usage on schema auth to anon,authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const sql = await readFile(
      new URL("../supabase/cards.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.query("insert into auth.users(id) values($1),($2)", [
      owner,
      other,
    ]);
    await db.query("insert into public.resume_admins(user_id) values($1)", [
      owner,
    ]);
    async function as(
      role: string,
      id: string,
      query: string,
      params: unknown[] = [],
    ) {
      return db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          id,
        ]);
        return tx.query(query, params);
      });
    }
    await assert.rejects(as("anon", "", "select * from public.card_trackers"));
    await assert.rejects(
      as(
        "authenticated",
        other,
        "insert into public.card_trackers(owner_id,document) values($1,$2)",
        [other, JSON.stringify(doc)],
      ),
    );
    await as(
      "authenticated",
      owner,
      "insert into public.card_trackers(owner_id,document) values($1,$2)",
      [owner, JSON.stringify(doc)],
    );
    assert.equal(
      (await as("authenticated", other, "select * from public.card_trackers"))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await as(
          "authenticated",
          other,
          "update public.card_trackers set revision=2 returning owner_id",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      as(
        "authenticated",
        owner,
        "update public.card_trackers set owner_id=$1",
        [other],
      ),
    );
    assert.equal(
      (
        await as(
          "authenticated",
          owner,
          "update public.card_trackers set revision=2 where owner_id=$1 and revision=1 returning revision",
          [owner],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await as(
          "authenticated",
          owner,
          "update public.card_trackers set revision=3 where owner_id=$1 and revision=1 returning revision",
          [owner],
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
