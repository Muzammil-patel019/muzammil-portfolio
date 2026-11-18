import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { z } from "zod";
import { roles, fail, type Role } from "./commerce";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const claims = z
  .object({
    workspace: z.string(),
    role: z.enum(roles),
    epoch: z.uuid(),
    id: z.uuid(),
    exp: z.number().int(),
  })
  .strict();
export function signSession(
  workspace: string,
  role: Role,
  epoch: string,
  secret: string,
  ttl = 3600,
) {
  if (secret.length < 32)
    fail("CONFIG", 503, "Practice sessions are not configured.");
  const payload = Buffer.from(
    JSON.stringify({
      workspace,
      role,
      epoch,
      id: randomUUID(),
      exp: Math.floor(Date.now() / 1000) + ttl,
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret).update(payload).digest("base64url")
  );
}
export function readSession(
  token: string,
  workspace: string,
  epoch: string,
  revoked: string[],
  secret: string,
) {
  try {
    if (secret.length < 32) throw Error();
    const [payload, signature, ...extra] = token.split(".");
    if (extra.length || !payload || !signature) throw Error();
    const expected = createHmac("sha256", secret).update(payload).digest(),
      actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw Error();
    const c = claims.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (
      c.workspace !== workspace ||
      c.epoch !== epoch ||
      c.exp <= Math.floor(Date.now() / 1000) ||
      revoked.includes(c.id)
    )
      throw Error();
    return c;
  } catch {
    return fail(
      "SESSION_EXPIRED",
      401,
      "Demo session is invalid or expired. Sign in again.",
    );
  }
}
