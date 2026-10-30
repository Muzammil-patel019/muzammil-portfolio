import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import seed from "../lib/seed.json";

test("PostgreSQL RLS isolates private versions and permits only owner publishing", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
   grant usage on schema auth to anon, authenticated;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;`);
    await db.exec(
      await readFile(
        new URL("../supabase/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.query("insert into auth.users(id) values ($1),($2)", [
      owner,
      other,
    ]);
    await db.query("insert into public.resume_admins(user_id) values ($1)", [
      owner,
    ]);
    async function asUser(
      role: "anon" | "authenticated",
      id: string,
      sql: string,
      params: unknown[] = [],
    ) {
      return db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          id,
        ]);
        return tx.query(sql, params);
      });
    }
    const inserted = await asUser(
      "authenticated",
      owner,
      "insert into public.resume_versions(owner_id,name,kind,document) values ($1,'Master','master',$2) returning id",
      [owner, JSON.stringify(seed)],
    );
    const version = (inserted.rows[0] as { id: string }).id;
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "select * from public.resume_versions",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          other,
          "select * from public.resume_versions",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser("anon", "", "select * from public.resume_versions"),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        other,
        "insert into public.resume_versions(owner_id,name,kind,document) values ($1,'Intruder','tailored',$2)",
        [other, JSON.stringify(seed)],
      ),
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          other,
          "update public.resume_versions set name='Hijacked' where id=$1 returning id",
          [version],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser(
        "authenticated",
        owner,
        "update public.resume_versions set owner_id=$1 where id=$2",
        [other, version],
      ),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        other,
        "insert into public.published_resume(id,document,published_by) values (1,$1,$2)",
        [JSON.stringify(seed), other],
      ),
    );
    await asUser(
      "authenticated",
      owner,
      "insert into public.published_resume(id,document,published_by) values (1,$1,$2)",
      [JSON.stringify(seed), owner],
    );
    assert.equal(
      (await asUser("anon", "", "select document from public.published_resume"))
        .rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          other,
          "update public.published_resume set document=$1 where id=1 returning id",
          [JSON.stringify({ ...seed, name: "Intruder" })],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser(
        "anon",
        "",
        "insert into public.published_resume(id,document) values (1,$1)",
        [JSON.stringify(seed)],
      ),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        other,
        "insert into public.resume_admins(user_id) values ($1)",
        [other],
      ),
    );
    await assert.rejects(
      asUser("authenticated", owner, "truncate public.resume_versions"),
    );
  } finally {
    await db.close();
  }
});
