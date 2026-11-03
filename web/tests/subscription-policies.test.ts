import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildCycle, type SubscriptionDocument, type SharedSubscription } from "../lib/subscriptions";

test("subscription SQL isolates owners and exposes only the linked member, with rotation, revocation and CAS", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const otherOwner = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  const alice = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const bob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const tokenHash = hash("unguessable-test-token");
  const rotatedHash = hash("unguessable-rotated-token");
  const document: SubscriptionDocument = {
    version: 1,
    plan: { name: "Premium group", amountMinor: 29900, currency: "INR", interval: "monthly", anchorDate: "2026-11-01", paymentNote: "Pay the manager directly." },
    members: [{ id: alice, name: "Alice", active: true }, { id: bob, name: "Bob private name", active: true }],
    cycles: [],
  };
  const cycle = buildCycle(document);
  cycle.allocations[0].payments = [{ id: crypto.randomUUID(), amountMinor: 5000, date: "2026-11-02", note: "Private receipt note" }];
  cycle.allocations[1].payments = [{ id: crypto.randomUUID(), amountMinor: 14950, date: "2026-11-03", note: "Bob private payment" }];
  document.cycles.push(cycle);
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      grant usage on schema auth to anon, authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;`);
    await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const sql = await readFile(new URL("../supabase/subscriptions.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql); // Re-running the migration is safe.
    await db.query("insert into auth.users(id) values ($1),($2),($3)", [owner, otherOwner, stranger]);
    await db.query("insert into public.resume_admins(user_id) values ($1),($2)", [owner, otherOwner]);
    async function asUser(role: "anon" | "authenticated", id: string, query: string, params: unknown[] = []) {
      return db.transaction(async (tx) => {
        await tx.exec(`set local role ${role}`);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
        return tx.query(query, params);
      });
    }
    async function view(token: string, role: "anon" | "authenticated" = "anon", id = "") {
      const result = await asUser(role, id, "select public.get_subscription_share($1) as document", [token]);
      return (result.rows[0] as { document: SharedSubscription | null }).document;
    }
    await asUser("authenticated", owner, "insert into public.subscription_plans(owner_id,document) values ($1,$2)", [owner, JSON.stringify(document)]);
    assert.equal((await asUser("authenticated", owner, "select * from public.subscription_plans")).rows.length, 1);
    assert.equal((await asUser("authenticated", otherOwner, "select * from public.subscription_plans")).rows.length, 0);
    assert.equal((await asUser("authenticated", stranger, "select * from public.subscription_plans")).rows.length, 0);
    await assert.rejects(asUser("anon", "", "select * from public.subscription_plans"));
    await assert.rejects(asUser("anon", "", "select * from public.subscription_shares"));
    await assert.rejects(asUser("authenticated", stranger, "insert into public.subscription_plans(owner_id,document) values ($1,$2)", [stranger, JSON.stringify(document)]));
    await assert.rejects(asUser("authenticated", otherOwner, "insert into public.subscription_plans(owner_id,document) values ($1,$2)", [owner, JSON.stringify(document)]));
    assert.equal((await asUser("authenticated", otherOwner, "update public.subscription_plans set revision=10 where owner_id=$1 returning revision", [owner])).rows.length, 0);
    assert.equal((await asUser("authenticated", owner, "update public.subscription_plans set revision=2 where owner_id=$1 and revision=1 returning revision", [owner])).rows.length, 1);
    assert.equal((await asUser("authenticated", owner, "update public.subscription_plans set revision=3 where owner_id=$1 and revision=1 returning revision", [owner])).rows.length, 0);
    await assert.rejects(asUser("authenticated", owner, "update public.subscription_plans set owner_id=$1 where owner_id=$2", [otherOwner, owner]));
    await assert.rejects(asUser("authenticated", owner, "delete from public.subscription_plans where owner_id=$1", [owner]));

    await asUser("authenticated", owner, "insert into public.subscription_shares(owner_id,member_id,token_hash) values ($1,$2,$3)", [owner, alice, tokenHash]);
    assert.equal((await asUser("authenticated", otherOwner, "select * from public.subscription_shares")).rows.length, 0);
    await assert.rejects(asUser("authenticated", otherOwner, "insert into public.subscription_shares(owner_id,member_id,token_hash) values ($1,$2,$3)", [owner, bob, hash("wrong-owner-token")]));
    assert.equal((await asUser("authenticated", otherOwner, "delete from public.subscription_shares returning member_id")).rows.length, 0);
    const expected: SharedSubscription = {
      plan: { name: "Premium group", paymentNote: "Pay the manager directly.", interval: "monthly" },
      member: { id: alice, name: "Alice" },
      cycles: [{ id: cycle.id, startDate: "2026-11-01", dueDate: "2026-11-01", renewalDate: "2026-12-01", currency: "INR", amountMinor: 14950, payments: [{ amountMinor: 5000, date: "2026-11-02" }] }],
    };
    assert.deepEqual(await view(tokenHash), expected);
    assert.deepEqual(await view(tokenHash, "authenticated", stranger), expected);
    assert.equal(await view(hash("unknown-token")), null);
    assert.equal(await view("bad hash"), null);
    assert.equal(JSON.stringify(await view(tokenHash)).includes("private"), false);
    assert.equal(JSON.stringify(await view(tokenHash)).includes(owner), false);

    await asUser("authenticated", owner, "update public.subscription_shares set token_hash=$1 where member_id=$2", [rotatedHash, alice]);
    assert.equal(await view(tokenHash), null);
    assert.deepEqual(await view(rotatedHash), expected);
    await db.query("delete from public.resume_admins where user_id=$1", [owner]);
    assert.equal(await view(rotatedHash), null);
    await db.query("insert into public.resume_admins(user_id) values ($1)", [owner]);
    await asUser("authenticated", owner, "delete from public.subscription_shares where member_id=$1", [alice]);
    assert.equal(await view(rotatedHash), null);
    await assert.rejects(asUser("authenticated", owner, "truncate public.subscription_plans"));
  } finally { await db.close(); }
});
