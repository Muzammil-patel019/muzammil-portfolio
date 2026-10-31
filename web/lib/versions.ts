/** The API returns newest first; prefer the latest master over a tailored copy. */
export function initialVersion<T extends { kind: "master" | "tailored" }>(
  versions: readonly T[],
): T | undefined {
  return versions.find((version) => version.kind === "master") || versions[0];
}
