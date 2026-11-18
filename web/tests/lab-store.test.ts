import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("private workspace gateway isolates capabilities, enforces CAS and denies direct table reads", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon;create role authenticated;");
    const sql = await readFile(
      new URL("../supabase/automation-lab.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    async function call(
      op: string,
      hash: string,
      doc: unknown = null,
      rev: number | null = null,
    ) {
      return db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        return tx.query(
          "select public.lab_workspace_gateway($1,$2,$3::jsonb,$4) as result",
          [op, hash, doc ? JSON.stringify(doc) : null, rev],
        );
      });
    }
    const a = "a".repeat(64),
      b = "b".repeat(64);
    await call("create", a, { version: 1 });
    await call("create", b, { version: 1 });
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        return tx.query("select * from automation_lab.workspaces");
      }),
    );
    await assert.rejects(call("read", "c".repeat(64)));
    assert.equal((await call("read", a)).rows.length, 1);
    await call("save", a, { version: 1, updated: true }, 1);
    await assert.rejects(call("save", a, { version: 1 }, 1));
    await call("delete", b);
    await assert.rejects(call("read", b));
    assert.equal((await call("read", a)).rows.length, 1);
    await assert.rejects(call("create", "bad", { version: 1 }));
    await assert.rejects(call("create", "d".repeat(64), { version: 2 }));
  } finally {
    await db.close();
  }
});
