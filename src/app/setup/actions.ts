"use server";

import { runSetup } from "./run";

export async function setupAction(key: string, which: "family" | "practice") {
  const expected = process.env.SETUP_KEY;
  if (!expected || key !== expected) return { ok: false as const, error: "Setup is locked." };
  return runSetup(which);
}
