import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeSchema, resumeSections } from "../lib/resume";
import {
  moveSection,
  normalizeResume,
  orderedSections,
  profileLinks,
  resumeChecks,
  textLines,
} from "../lib/resume-builder";
import seed from "../lib/seed.json";
test("older resume versions retain their existing layout and section order", () => {
  const old = resumeSchema.parse(seed);
  assert.equal(old.template, undefined);
  assert.deepEqual(orderedSections(old), resumeSections);
  const reordered = moveSection(old, "education", -1);
  assert.equal(orderedSections(reordered)[2], "education");
  assert.deepEqual(orderedSections(old), resumeSections);
  assert.equal(moveSection(old, "summary", -1), old);
  assert.equal(
    resumeSchema.safeParse({
      ...old,
      sectionOrder: [
        "summary",
        "skills",
        "projects",
        "education",
        "education",
        "achievements",
      ],
    }).success,
    false,
  );
});
test("extended versions round-trip safely and reject executable profile links", () => {
  const resume = resumeSchema.parse({
    ...seed,
    template: "classic",
    linkedin: "https://www.linkedin.com/in/example",
    website: "https://example.com",
    certifications: "A certificate\n\nAnother certificate",
    achievements: "A real achievement",
  });
  assert.deepEqual(
    resumeSchema.parse(JSON.parse(JSON.stringify(resume))),
    resume,
  );
  assert.equal(profileLinks(resume).length, 2);
  assert.deepEqual(textLines(resume.certifications), [
    "A certificate",
    "Another certificate",
  ]);
  assert.equal(
    resumeSchema.safeParse({ ...resume, website: "javascript:alert(1)" })
      .success,
    false,
  );
  assert.equal(
    profileLinks({ ...resume, website: "javascript:alert(1)" }).length,
    1,
  );
});
test("export normalization removes blank separators without mutating edits or inventing skills", () => {
  const raw = resumeSchema.parse(seed);
  raw.skills = [" Java ", ""];
  raw.projects[0].tools = ["Python", ""];
  raw.projects[0].bullets.push("");
  const clean = normalizeResume(raw);
  assert.deepEqual(clean.skills, ["Java"]);
  assert.equal(raw.skills.length, 2);
  assert.equal(raw.projects[0].bullets.at(-1), "");
  assert.equal(resumeSchema.safeParse(clean).success, true);
  const before = JSON.stringify(raw);
  resumeChecks(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(
    resumeChecks({ ...raw, email: "invalid" }).find((c) => c.id === "valid")
      ?.ok,
    false,
  );
});
