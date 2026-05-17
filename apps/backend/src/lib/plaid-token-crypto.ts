import crypto from "node:crypto";

const TOKEN_PREFIX = "enc:v1:";

function deriveEncryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptPlaidAccessToken(token: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = deriveEncryptionKey(secret);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPlaidAccessToken(storedValue: string, secret: string): string {
  if (!storedValue.startsWith(TOKEN_PREFIX)) {
    return storedValue;
  }

  const serialized = storedValue.slice(TOKEN_PREFIX.length);
  const [ivEncoded, tagEncoded, payloadEncoded] = serialized.split(".");

  if (!ivEncoded || !tagEncoded || !payloadEncoded) {
    throw new Error("Invalid encrypted Plaid token format");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const payload = Buffer.from(payloadEncoded, "base64url");
  const key = deriveEncryptionKey(secret);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}
