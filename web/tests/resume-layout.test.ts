import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSkills } from "../lib/resume-layout";
test("groups known skills and retains custom skills without changing input", () => {
  const skills = [
    "Java",
    "Selenium",
    "Cucumber",
    "My custom tool",
    "Python",
    "Azure DevOps",
  ];
  const before = [...skills];
  const groups = groupSkills(skills);
  assert.deepEqual(groups.find((g) => g.label === "Languages")?.skills, [
    "Java",
    "Python",
  ]);
  assert.deepEqual(
    groups.find((g) => g.label === "Additional skills")?.skills,
    ["My custom tool"],
  );
  assert.deepEqual(groups.flatMap((g) => g.skills).sort(), [...skills].sort());
  assert.deepEqual(skills, before);
});
test("empty resume skills do not produce empty groups", () =>
  assert.deepEqual(groupSkills([]), []));
