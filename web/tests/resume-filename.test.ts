import { test } from "node:test";
import assert from "node:assert/strict";
import { resumeFilename } from "../lib/resume-filename";
test("uses generation month and year in the requested filename", () => {
  assert.equal(
    resumeFilename(new Date("2026-10-31T08:00:00Z")),
    "Muzammil_Patel_Resume_10_2026.pdf",
  );
  assert.equal(
    resumeFilename(new Date("2027-02-10T08:00:00Z")),
    "Muzammil_Patel_Resume_02_2027.pdf",
  );
});
test("server and browser use India month and year at UTC boundaries", () => {
  assert.equal(
    resumeFilename(new Date("2026-10-31T20:00:00Z")),
    "Muzammil_Patel_Resume_11_2026.pdf",
  );
  assert.equal(
    resumeFilename(new Date("2026-12-31T20:00:00Z")),
    "Muzammil_Patel_Resume_01_2027.pdf",
  );
});
