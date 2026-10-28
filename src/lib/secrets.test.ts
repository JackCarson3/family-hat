import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  assignmentContext,
  checkCode,
  decrypt,
  encrypt,
  hashCode,
  hashToken,
  hatCode,
  newToken,
} from "./secrets";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.HASH_SECRET = randomBytes(32).toString("base64");
});

describe("secrets", () => {
  it("makes long, unique, URL-safe tokens", () => {
    const tokens = new Set(Array.from({ length: 1000 }, newToken));
    expect(tokens.size).toBe(1000);
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("hashes tokens consistently without revealing them", () => {
    const t = newToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
  });

  it("checks 4-digit codes", () => {
    const stored = hashCode("2512");
    expect(checkCode("2512", stored)).toBe(true);
    expect(checkCode("2513", stored)).toBe(false);
  });

  it("encrypts pairings and refuses a moved ciphertext", () => {
    const ctx = assignmentContext("ex", 1, "giver-a");
    const sealed = encrypt("recipient-b", ctx);
    expect(sealed).not.toContain("recipient-b");
    expect(decrypt(sealed, ctx)).toBe("recipient-b");
    expect(() => decrypt(sealed, assignmentContext("ex", 1, "giver-c"))).toThrow();
    expect(() => decrypt(sealed, assignmentContext("ex", 2, "giver-a"))).toThrow();
  });

  it("gives a festive hat code that changes with the assignment", () => {
    const a = new Map([["x", "y"], ["y", "z"], ["z", "x"]]);
    const b = new Map([["x", "z"], ["z", "y"], ["y", "x"]]);
    const code = hatCode("ex", 1, a);
    expect(code).toMatch(/^[A-Za-z]+-[A-Za-z]+-\d{2}$/);
    expect(hatCode("ex", 1, a)).toBe(code);
    expect(hatCode("ex", 1, b)).not.toBe(code);
    expect(hatCode("ex", 2, a)).not.toBe(code);
  });
});
