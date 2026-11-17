import { test } from "node:test";
import assert from "node:assert/strict";
import { listProducts, products } from "../lib/lab/catalogue";
import { labOpenAPI } from "../lib/lab/openapi";
import { starterZip } from "../lib/lab/starter";
test("catalogue pagination, filters and sorts use a stable immutable seed", () => {
  const before = JSON.stringify(products),
    first = listProducts(new URLSearchParams());
  assert.equal(first.data.length, 6);
  assert.equal(first.pagination.total, 12);
  assert.equal(first.pagination.totalPages, 2);
  const second = listProducts(new URLSearchParams("page=2"));
  assert.equal(
    new Set([...first.data, ...second.data].map((p) => p.id)).size,
    12,
  );
  const desk = listProducts(new URLSearchParams("category=desk"));
  assert.equal(desk.pagination.total, 4);
  assert.ok(desk.data.every((p) => p.category === "desk"));
  const out = listProducts(new URLSearchParams("stock=out"));
  assert.equal(out.pagination.total, 2);
  assert.ok(out.data.every((p) => p.stock === 0));
  assert.equal(
    listProducts(new URLSearchParams("q=ORBIT")).data[0].id,
    "p-001",
  );
  assert.equal(
    listProducts(new URLSearchParams("q=not-a-match")).pagination.totalPages,
    0,
  );
  const sorted = listProducts(
    new URLSearchParams("sort=price-asc&pageSize=24"),
  ).data;
  assert.ok(
    sorted.every((p, i) => i === 0 || p.priceMinor >= sorted[i - 1].priceMinor),
  );
  assert.equal(sorted[0].priceMinor, 39900);
  assert.equal(JSON.stringify(products), before);
});
test("strict query contract rejects invalid, duplicate and unknown inputs", () => {
  for (const query of [
    "page=0",
    "page=-1",
    "page=1.5",
    "pageSize=25",
    "category=unknown",
    "q=" + "a".repeat(81),
    "page=1&page=2",
    "unknown=1",
  ])
    assert.throws(() => listProducts(new URLSearchParams(query)), query);
  assert.equal(listProducts(new URLSearchParams("page=1000")).data.length, 0);
  assert.equal(labOpenAPI.openapi, "3.0.3");
  assert.ok(labOpenAPI.paths["/products/{id}"].get.responses["404"]);
  assert.equal(
    Buffer.from(starterZip, "base64").subarray(0, 2).toString(),
    "PK",
  );
});
