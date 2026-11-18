import { z } from "zod";
import { LabError, fail } from "./commerce";
export const practiceHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Lab-Environment": "practice",
};
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: practiceHeaders });
export function errorResponse(error: unknown) {
  return error instanceof LabError
    ? json(
        { error: { code: error.code, message: error.message } },
        error.status,
      )
    : error instanceof z.ZodError
      ? json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: error.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; "),
            },
          },
          422,
        )
      : json(
          {
            error: {
              code: "INTERNAL_ERROR",
              message: "Practice operation failed.",
            },
          },
          500,
        );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 65000)
    fail("BODY_TOO_LARGE", 413, "Request body exceeds 65 KB.");
  try {
    return JSON.parse(raw);
  } catch {
    return fail("INVALID_JSON", 400, "Send a valid JSON body.");
  }
}
export async function scenario(request: Request) {
  const mode = request.headers.get("X-Lab-Scenario") || "normal";
  if (!["normal", "slow", "unavailable", "expired", "declined"].includes(mode))
    fail("INVALID_SCENARIO", 400, "Unknown practice scenario.");
  if (mode === "slow") await new Promise((r) => setTimeout(r, 750));
  if (mode === "unavailable")
    fail(
      "SIMULATED_UNAVAILABLE",
      503,
      "Simulated service failure; this request made no changes.",
    );
  if (mode === "expired")
    fail("SESSION_EXPIRED", 401, "Simulated expired demo session.");
  return mode;
}
