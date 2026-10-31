import { test } from "node:test";
import assert from "node:assert/strict";
import { initialVersion } from "../lib/versions";
test("opens latest master ahead of newer tailored versions", () => {
  const versions = [
    { id: "tailored-new", kind: "tailored" as const },
    { id: "master-new", kind: "master" as const },
    { id: "master-old", kind: "master" as const },
  ];
  assert.equal(initialVersion(versions)?.id, "master-new");
});
test("falls back to latest tailored version or an empty editor", () => {
  assert.equal(
    initialVersion([{ id: "latest", kind: "tailored" as const }])?.id,
    "latest",
  );
  assert.equal(initialVersion([]), undefined);
});
