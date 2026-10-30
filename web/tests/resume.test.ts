import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeSchema, analyzeJD, saveSchema } from "../lib/resume";
import seed from "../lib/seed.json";
test("default profile retains approved project timelines", () => {
  const r = resumeSchema.parse(seed);
  assert.deepEqual(
    r.projects.map((p) => p.dates),
    [
      "September 2025 – Present",
      "April 2025 – September 2025",
      "April 2024 – March 2025",
    ],
  );
});
test("JD matching distinguishes Java from JavaScript and C# from other languages", () => {
  const r = resumeSchema.parse({
    ...seed,
    skills: ["JavaScript"],
    summary: "Web testing",
    projects: [
      { ...seed.projects[0], tools: ["JavaScript"], bullets: ["Web testing."] },
    ],
  });
  const a = analyzeJD("Java, JavaScript, C#, and Selenium required.", r);
  assert.deepEqual(a.matched, ["JavaScript"]);
  assert.deepEqual(a.missing, ["Java", "C#", "Selenium"]);
});
test("matching reports gaps without modifying experience", () => {
  const r = resumeSchema.parse(seed),
    before = JSON.stringify(r);
  const a = analyzeJD("Java Selenium Playwright Docker SQL", r);
  assert(a.matched.includes("Java"));
  assert(a.missing.includes("Playwright"));
  assert(a.missing.includes("Docker"));
  assert.equal(JSON.stringify(r), before);
});
test("schema rejects blank skills, malformed email, and oversized content", () => {
  assert(!resumeSchema.safeParse({ ...seed, skills: [""] }).success);
  assert(!resumeSchema.safeParse({ ...seed, email: "not-an-email" }).success);
  assert(
    !resumeSchema.safeParse({ ...seed, summary: "x".repeat(3001) }).success,
  );
  assert(
    !saveSchema.safeParse({ name: "", kind: "master", document: seed }).success,
  );
});
test("tailored project tools do not mutate the master", () => {
  const master = resumeSchema.parse(seed);
  const tailored = structuredClone(master);
  tailored.projects[2].tools = ["Java", "Selenium"];
  assert.deepEqual(master.projects[2].tools, [
    "Python",
    "TestComplete",
    "Cucumber",
    "Gherkin",
  ]);
  assert.deepEqual(resumeSchema.parse(tailored).projects[2].tools, [
    "Java",
    "Selenium",
  ]);
});
