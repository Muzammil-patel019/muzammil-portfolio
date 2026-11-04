import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  buildCycle,
  type SubscriptionDocument,
  type SharedSubscription,
} from "../lib/subscriptions";

test("subscription SQL isolates owners and exposes only the linked member, with rotation, revocation and CAS", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  const otherOwner = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  const alice = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const bob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const tokenHash = hash("unguessable-test-token");
  const rotatedHash = hash("unguessable-rotated-token");
  const document: SubscriptionDocument = {
    version: 1,
    plan: {
      name: "Premium group",
      amountMinor: 29900,
      currency: "INR",
      interval: "monthly",
      anchorDate: "2026-11-01",
      paymentNote: "Pay the manager directly.",
    },
    members: [
      { id: alice, name: "Alice", active: true, joinedDate: "2026-10-05" },
      { id: bob, name: "Bob private name", active: true },
    ],
    cycles: [],
  };
  const cycle = buildCycle(document);
  cycle.allocations[0].payments = [
    {
      id: crypto.randomUUID(),
      amountMinor: 5000,
      date: "2026-11-02",
      note: "Private receipt note",
    },
  ];
  cycle.allocations[1].payments = [
    {
      id: crypto.randomUUID(),
      amountMinor: 14950,
      date: "2026-11-03",
      note: "Bob private payment",
    },
  ];
  document.cycles.push(cycle);
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
    const sql = await readFile(
      new URL("../supabase/subscriptions.sql", import.meta.url),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql); // Re-running the migration is safe.
    await db.query("insert into auth.users(id) values ($1),($2),($3)", [
      owner,
      otherOwner,
      stranger,
    ]);
    await db.query(
      "insert into public.resume_admins(user_id) values ($1),($2)",
      [owner, otherOwner],
    );
    async function asUser(
      role: "anon" | "authenticated",
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
    async function view(
      token: string,
      role: "anon" | "authenticated" = "anon",
      id = "",
    ) {
      const result = await asUser(
        role,
        id,
        "select public.get_subscription_share($1) as document",
        [token],
      );
      return (result.rows[0] as { document: SharedSubscription | null })
        .document;
    }
    await asUser(
      "authenticated",
      owner,
      "insert into public.subscription_plans(owner_id,document) values ($1,$2)",
      [owner, JSON.stringify(document)],
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "select * from public.subscription_plans",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "select * from public.subscription_plans",
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          stranger,
          "select * from public.subscription_plans",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser("anon", "", "select * from public.subscription_plans"),
    );
    await assert.rejects(
      asUser("anon", "", "select * from public.subscription_shares"),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        stranger,
        "insert into public.subscription_plans(owner_id,document) values ($1,$2)",
        [stranger, JSON.stringify(document)],
      ),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        otherOwner,
        "insert into public.subscription_plans(owner_id,document) values ($1,$2)",
        [owner, JSON.stringify(document)],
      ),
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "update public.subscription_plans set revision=10 where owner_id=$1 returning revision",
          [owner],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "update public.subscription_plans set revision=2 where owner_id=$1 and revision=1 returning revision",
          [owner],
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "update public.subscription_plans set revision=3 where owner_id=$1 and revision=1 returning revision",
          [owner],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser(
        "authenticated",
        owner,
        "update public.subscription_plans set owner_id=$1 where owner_id=$2",
        [otherOwner, owner],
      ),
    );
    await assert.rejects(
      asUser(
        "anon",
        "",
        "delete from public.subscription_plans where owner_id=$1",
        [owner],
      ),
    );

    await asUser(
      "authenticated",
      owner,
      "insert into public.subscription_shares(owner_id,member_id,token_hash) values ($1,$2,$3)",
      [owner, alice, tokenHash],
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "select * from public.subscription_shares",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      asUser(
        "authenticated",
        otherOwner,
        "insert into public.subscription_shares(owner_id,member_id,token_hash) values ($1,$2,$3)",
        [owner, bob, hash("wrong-owner-token")],
      ),
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "delete from public.subscription_shares returning member_id",
        )
      ).rows.length,
      0,
    );
    const expected: SharedSubscription = {
      groupMembers: [{ firstName: "Alice" }, { firstName: "Bob" }],
      credits: [],
      plan: {
        name: "Premium group",
        paymentNote: "Pay the manager directly.",
        interval: "monthly",
      },
      member: { id: alice, name: "Alice", joinedDate: "2026-10-05" },
      cycles: [
        {
          id: cycle.id,
          startDate: "2026-11-01",
          dueDate: "2026-11-01",
          renewalDate: "2026-12-01",
          currency: "INR",
          amountMinor: 14950,
          payments: [{ amountMinor: 5000, date: "2026-11-02" }],
        },
      ],
    };
    await asUser(
      "authenticated",
      owner,
      "update public.subscription_shares set owner_token=$1 where member_id=$2",
      ["a".repeat(43), alice],
    );
    assert.equal(
      (
        (
          await asUser(
            "authenticated",
            owner,
            "select owner_token from public.subscription_shares where member_id=$1",
            [alice],
          )
        ).rows[0] as { owner_token: string }
      ).owner_token,
      "a".repeat(43),
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "select owner_token from public.subscription_shares where member_id=$1",
          [alice],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      JSON.stringify(await view(tokenHash)).includes("owner_token"),
      false,
    );
    await asUser(
      "authenticated",
      owner,
      "update public.subscription_shares set owner_code=$1,code_hash=$2 where member_id=$3",
      ["c".repeat(22), hash("c".repeat(22)), alice],
    );
    assert.deepEqual(await view(hash("c".repeat(22))), expected);
    assert.deepEqual(await view(tokenHash), expected);
    assert.deepEqual(
      await view(tokenHash, "authenticated", stranger),
      expected,
    );
    assert.equal(await view(hash("unknown-token")), null);
    assert.equal(await view("bad hash"), null);
    assert.equal(
      JSON.stringify(await view(tokenHash)).includes("private"),
      false,
    );
    assert.equal(JSON.stringify(await view(tokenHash)).includes(owner), false);

    await asUser(
      "authenticated",
      owner,
      "update public.subscription_shares set token_hash=$1 where member_id=$2",
      [rotatedHash, alice],
    );
    assert.equal(await view(tokenHash), null);
    assert.deepEqual(await view(rotatedHash), expected);
    await db.query("delete from public.resume_admins where user_id=$1", [
      owner,
    ]);
    assert.equal(await view(rotatedHash), null);
    await db.query("insert into public.resume_admins(user_id) values ($1)", [
      owner,
    ]);
    await asUser(
      "authenticated",
      owner,
      "delete from public.subscription_shares where member_id=$1",
      [alice],
    );
    assert.equal(await view(rotatedHash), null);
    await assert.rejects(
      asUser("authenticated", owner, "truncate public.subscription_plans"),
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "delete from public.subscription_plans where owner_id=$1 returning owner_id",
          [owner],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "delete from public.subscription_plans where owner_id=$1 and revision=1 returning owner_id",
          [owner],
        )
      ).rows.length,
      0,
    );
    await asUser(
      "authenticated",
      owner,
      "insert into public.subscription_shares(owner_id,member_id,token_hash) values ($1,$2,$3)",
      [owner, alice, rotatedHash],
    );
    assert.notEqual(await view(rotatedHash), null);
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "delete from public.subscription_plans where owner_id=$1 and revision=2 returning owner_id",
          [owner],
        )
      ).rows.length,
      1,
    );
    assert.equal(await view(rotatedHash), null);
    assert.equal(
      (
        await db.query(
          "select * from public.subscription_shares where owner_id=$1",
          [owner],
        )
      ).rows.length,
      0,
    );
    const firstPlan = "44444444-4444-4444-8444-444444444444",
      secondPlan = "55555555-5555-4555-8555-555555555555";
    const docA = structuredClone(document),
      docB = structuredClone(document);
    docA.plan.name = "Service A";
    docB.plan.name = "Service B";
    await asUser(
      "authenticated",
      owner,
      "insert into public.subscription_plans(id,owner_id,document) values($1,$2,$3),($4,$2,$5)",
      [
        firstPlan,
        owner,
        JSON.stringify(docA),
        secondPlan,
        JSON.stringify(docB),
      ],
    );
    await asUser(
      "authenticated",
      owner,
      "insert into public.subscription_shares(plan_id,owner_id,member_id,token_hash) values($1,$2,$3,$4),($5,$2,$6,$7)",
      [
        firstPlan,
        owner,
        alice,
        hash("plan-a"),
        secondPlan,
        bob,
        hash("plan-b"),
      ],
    );
    assert.equal((await view(hash("plan-a")))?.plan.name, "Service A");
    assert.equal((await view(hash("plan-b")))?.plan.name, "Service B");
    await assert.rejects(
      asUser("anon", "", "select * from public.subscription_payment_reports"),
    );
    await asUser(
      "anon",
      "",
      "select public.report_subscription_payment($1,$2,'opened')",
      [hash("plan-a"), cycle.id],
    );
    await assert.rejects(
      asUser(
        "anon",
        "",
        "select public.report_subscription_payment($1,$2,'paid')",
        [hash("plan-a"), cycle.id],
      ),
    );
    await db.query(
      "update public.subscription_payment_reports set opened_at=now()-interval '11 seconds' where plan_id=$1",
      [firstPlan],
    );
    await asUser(
      "anon",
      "",
      "select public.report_subscription_payment($1,$2,'paid')",
      [hash("plan-a"), cycle.id],
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "select * from public.subscription_payment_reports where reported_at is not null",
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await asUser(
          "authenticated",
          otherOwner,
          "select * from public.subscription_payment_reports",
        )
      ).rows.length,
      0,
    );
    assert.deepEqual((await view(hash("plan-a")))?.cycles[0].payments, [
      { amountMinor: 5000, date: "2026-11-02" },
    ]);
    await assert.rejects(
      asUser(
        "anon",
        "",
        "select public.report_subscription_payment($1,$2,'paid')",
        [hash("unknown-token"), cycle.id],
      ),
    );

    await db.query(
      "update public.subscription_payment_reports set confirmed_at=now() where plan_id=$1",
      [firstPlan],
    );
    const preference = await asUser(
      "anon",
      "",
      "select public.report_subscription_coverage($1,$2,'preference',3) as quote",
      [hash("plan-a"), cycle.id],
    );
    assert.equal(
      (preference.rows[0] as { quote: { amountMinor: number } }).quote
        .amountMinor,
      39850,
    );
    assert.equal((await view(hash("plan-a")))?.member.requestedMonths, 3);
    // Opening a different payment term must not replace a pending preference.
    await asUser(
      "anon",
      "",
      "select public.report_subscription_coverage($1,$2,'opened',6)",
      [hash("plan-a"), cycle.id],
    );
    assert.equal((await view(hash("plan-a")))?.member.requestedMonths, 3);
    await assert.rejects(
      asUser(
        "anon",
        "",
        "select public.report_subscription_coverage($1,$2,'paid',3)",
        [hash("plan-a"), cycle.id],
      ),
    );
    await asUser(
      "authenticated",
      owner,
      "select public.approve_subscription_coverage($1,$2,$3,3)",
      [firstPlan, alice, cycle.id],
    );
    assert.equal((await view(hash("plan-a")))?.member.preferredMonths, 3);
    assert.equal(
      (await view(hash("plan-a")))?.member.requestedMonths,
      undefined,
    );
    await asUser(
      "anon",
      "",
      "select public.report_subscription_coverage($1,$2,'preference',6)",
      [hash("plan-a"), cycle.id],
    );

    await asUser(
      "anon",
      "",
      "select public.report_subscription_coverage($1,$2,'opened',3)",
      [hash("plan-a"), cycle.id],
    );
    await db.query(
      "update public.subscription_payment_reports set payment_opened_at=now()-interval '11 seconds' where plan_id=$1",
      [firstPlan],
    );
    await asUser(
      "anon",
      "",
      "select public.report_subscription_coverage($1,$2,'paid',3)",
      [hash("plan-a"), cycle.id],
    );
    await assert.rejects(
      asUser("anon", "", "select public.save_subscription_plan($1,1,$2)", [
        firstPlan,
        JSON.stringify(docA),
      ]),
    );
    const saved = await asUser(
      "authenticated",
      owner,
      "select public.save_subscription_plan($1,1,$2,$3,$4,(select reported_at from public.subscription_payment_reports where plan_id=$1)) as result",
      [firstPlan, JSON.stringify(docA), alice, cycle.id],
    );
    assert.equal(
      (saved.rows[0] as { result: { revision: number } }).result.revision,
      2,
    );
    assert.equal((await view(hash("plan-a")))?.member.requestedMonths, 6);
    assert.equal((await view(hash("plan-a")))?.member.preferredMonths, 3);
    const stale = await asUser(
      "authenticated",
      owner,
      "select public.save_subscription_plan($1,1,$2) as result",
      [firstPlan, JSON.stringify(docA)],
    );
    assert.equal((stale.rows[0] as { result: unknown }).result, null);
    assert.equal(
      (
        await asUser(
          "authenticated",
          owner,
          "select confirmed_at from public.subscription_payment_reports where plan_id=$1",
          [firstPlan],
        )
      ).rows.length,
      1,
    );
    const inviteHash = hash("group-invitation");
    await asUser(
      "authenticated",
      owner,
      "update public.subscription_plans set group_hash=$2 where id=$1",
      [firstPlan, inviteHash],
    );
    const group = await asUser(
      "anon",
      "",
      "select public.get_subscription_group($1) as result",
      [inviteHash],
    );
    assert.deepEqual((group.rows[0] as { result: unknown }).result, {
      name: "Service A",
      members: [{ firstName: "Alice" }, { firstName: "Bob" }],
    });
    await assert.rejects(
      asUser("anon", "", "select * from public.subscription_join_requests"),
    );
    await assert.rejects(
      asUser(
        "anon",
        "",
        "select public.request_subscription_join($1,'New Friend','friend@example.com')",
        [hash("invalid")],
      ),
    );
    const before = await asUser(
      "authenticated",
      owner,
      "select document,revision from public.subscription_plans where id=$1",
      [firstPlan],
    );
    await asUser(
      "anon",
      "",
      "select public.request_subscription_join($1,'New Friend','friend@example.com')",
      [inviteHash],
    );
    await asUser(
      "anon",
      "",
      "select public.request_subscription_join($1,'New Friend','friend@example.com')",
      [inviteHash],
    );
    const requests = await asUser(
      "authenticated",
      owner,
      "select id from public.subscription_join_requests where plan_id=$1",
      [firstPlan],
    );
    assert.equal(requests.rows.length, 1);
    const requestId = (requests.rows[0] as { id: string }).id;
    const pending = await asUser(
      "authenticated",
      owner,
      "select document,revision from public.subscription_plans where id=$1",
      [firstPlan],
    );
    assert.deepEqual(pending.rows, before.rows);
    await assert.rejects(
      asUser("anon", "", "select public.review_subscription_join($1,true)", [
        requestId,
      ]),
    );
    await assert.rejects(
      asUser(
        "authenticated",
        otherOwner,
        "select public.review_subscription_join($1,true)",
        [requestId],
      ),
    );
    await asUser(
      "authenticated",
      owner,
      "select public.review_subscription_join($1,true)",
      [requestId],
    );
    const after = await asUser(
      "authenticated",
      owner,
      "select document,revision from public.subscription_plans where id=$1",
      [firstPlan],
    );
    const old = before.rows[0] as {
      document: SubscriptionDocument;
      revision: number;
    };
    const approved = after.rows[0] as {
      document: SubscriptionDocument;
      revision: number;
    };
    assert.equal(approved.revision, old.revision + 1);
    assert.equal(approved.document.members.at(-1)?.name, "New Friend");
    assert.deepEqual(approved.document.cycles, old.document.cycles);
    const publicGroup = await asUser(
      "anon",
      "",
      "select public.get_subscription_group($1) as result",
      [inviteHash],
    );
    assert.ok(!JSON.stringify(publicGroup.rows).includes("friend@example.com"));
    await assert.rejects(
      asUser(
        "authenticated",
        owner,
        "select public.review_subscription_join($1,true)",
        [requestId],
      ),
    );
    await asUser(
      "authenticated",
      owner,
      "delete from public.subscription_plans where id=$1",
      [firstPlan],
    );
    assert.equal(await view(hash("plan-a")), null);
    assert.equal((await view(hash("plan-b")))?.plan.name, "Service B");
  } finally {
    await db.close();
  }
});
