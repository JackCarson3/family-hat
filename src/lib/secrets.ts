import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Every secret-handling primitive lives here.
 *
 * Environment:
 *   ENCRYPTION_KEY  32 random bytes, base64. Encrypts pairings and re-shareable links.
 *   HASH_SECRET     32 random bytes, base64. Keys token hashes and the hat code.
 */

function key(name: "ENCRYPTION_KEY" | "HASH_SECRET"): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return buf;
}

// ---------- tokens ----------

/** 128-bit random token for a link or a device, URL-safe (22 characters). */
export function newToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Keyed hash of a token. The database stores only this. */
export function hashToken(token: string): string {
  return createHmac("sha256", key("HASH_SECRET")).update(`token:${token}`).digest("base64url");
}

/** Constant-time comparison of two hashes. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- 4-digit codes ----------

export function isValidCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

/** Salted scrypt hash, stored as "salt:hash". */
export function hashCode(code: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 32);
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

export function checkCode(code: string, stored: string): boolean {
  const [saltText, hashText] = stored.split(":");
  if (!saltText || !hashText) return false;
  const hash = scryptSync(code, Buffer.from(saltText, "base64url"), 32);
  const expected = Buffer.from(hashText, "base64url");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

// ---------- encryption ----------

/**
 * AES-256-GCM. `context` is bound as associated data, so a ciphertext copied
 * into another row (another giver, another generation) fails to decrypt.
 */
export function encrypt(plain: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("ENCRYPTION_KEY"), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(sealed: string, context: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key("ENCRYPTION_KEY"), iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

export function assignmentContext(exchangeId: string, generation: number, giverId: string): string {
  return `assignment:${exchangeId}:${generation}:${giverId}`;
}

export function inviteContext(participantId: string): string {
  return `invite:${participantId}`;
}

// ---------- hat code ----------

const WORDS_A = [
  "Holly", "Ivy", "Tinsel", "Velvet", "Frosty", "Cocoa", "Pine", "Cedar",
  "Ginger", "Candle", "Starry", "Snowy", "Merry", "Jolly", "Cozy", "Golden",
  "Silver", "Sugar", "Plum", "Ribbon", "Mitten", "Crimson", "Maple", "Twinkle",
  "Berry", "Nutmeg", "Clove", "Peppermint", "Spruce", "Winter", "Bright", "Sparkle",
];
const WORDS_B = [
  "Ember", "Bell", "Sleigh", "Star", "Wreath", "Lantern", "Carol", "Angel",
  "Garland", "Snowflake", "Reindeer", "Stocking", "Chimney", "Cookie", "Candy", "Hearth",
  "Mistletoe", "Ornament", "Present", "Icicle", "Sled", "Robin", "Fir", "Nativity",
  "Shepherd", "Manger", "Pudding", "Sparrow", "Cabin", "Fireside", "Gloria", "Noel",
];

/**
 * A short festive fingerprint of the sealed assignment, e.g. "Holly-Ember-42".
 * Keyed with HASH_SECRET, so it reveals nothing about the pairings. Any change
 * to the assignment (a reset, a new generation) changes it.
 */
export function hatCode(exchangeId: string, generation: number, assignment: Map<string, string>): string {
  const canonical = [...assignment.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([g, r]) => `${g}>${r}`)
    .join("|");
  const digest = createHmac("sha256", key("HASH_SECRET"))
    .update(`hat:${exchangeId}:${generation}:${canonical}`)
    .digest();
  const a = WORDS_A[digest[0] % WORDS_A.length];
  const b = WORDS_B[digest[1] % WORDS_B.length];
  const n = 10 + (digest.readUInt16BE(2) % 90);
  return `${a}-${b}-${n}`;
}

/** Random shuffle helper for the tumble-out order. */
export function shuffled<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
