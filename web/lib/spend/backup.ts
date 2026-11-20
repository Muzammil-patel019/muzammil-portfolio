import { spendDocumentSchema, type SpendDocument } from "./analyzer";
const encode = (bytes: Uint8Array) => {
  let str = "";
  for (let i = 0; i < bytes.length; i += 32768)
    str += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(str);
};
const decode = (str: string) =>
  Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
async function keyFor(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 250000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptSpend(document: SpendDocument, password: string) {
  if (password.length < 10)
    throw Error("Use a backup passphrase of at least 10 characters.");
  const data = spendDocumentSchema.parse(document),
    salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await keyFor(password, salt),
    cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(data)),
    );
  return JSON.stringify({
    format: "private-spend",
    version: 1,
    iterations: 250000,
    salt: encode(salt),
    iv: encode(iv),
    data: encode(new Uint8Array(cipher)),
  });
}
export async function decryptSpend(text: string, password: string) {
  if (text.length > 20000000) throw Error("Backup exceeds the 20 MB limit.");
  const b = JSON.parse(text);
  if (
    b.format !== "private-spend" ||
    b.version !== 1 ||
    b.iterations !== 250000 ||
    typeof b.data !== "string" ||
    typeof b.salt !== "string" ||
    typeof b.iv !== "string"
  )
    throw Error("Not a supported encrypted spend backup.");
  try {
    const salt = decode(b.salt),
      iv = decode(b.iv);
    if (salt.length !== 16 || iv.length !== 12) throw Error();
    const key = await keyFor(password, salt),
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        decode(b.data) as BufferSource,
      );
    return spendDocumentSchema.parse(
      JSON.parse(new TextDecoder().decode(plain)),
    );
  } catch {
    throw Error(
      "Could not unlock this backup. Check its passphrase and that the file has not changed.",
    );
  }
}
