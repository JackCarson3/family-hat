"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import * as hat from "@/lib/hat";
import { newToken } from "@/lib/secrets";

const DEVICE_COOKIE = "fh_device";

async function deviceSecret(create: boolean): Promise<string | undefined> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  if (existing || !create) return existing;
  const secret = newToken();
  jar.set(DEVICE_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return secret;
}

// ---------- participant ----------

export async function claimAction(token: string, code: string) {
  const r = await hat.claim(token, (await deviceSecret(true))!, code);
  if (r.ok) revalidatePath(`/p/${token}`);
  return r;
}

export async function unlockAction(token: string, code: string) {
  const r = await hat.unlock(token, (await deviceSecret(true))!, code);
  if (r.ok) revalidatePath(`/p/${token}`);
  return r;
}

export async function drawAction(token: string) {
  try {
    return await hat.draw(token, (await deviceSecret(false)) ?? "");
  } catch {
    return { ok: false as const, error: "This page isn't unlocked on this device." };
  }
}

export async function confirmAction(token: string) {
  try {
    const r = await hat.confirmDraw(token, (await deviceSecret(false)) ?? "");
    revalidatePath(`/p/${token}`);
    return r;
  } catch {
    return { ok: false };
  }
}

export async function saveCluesAction(token: string, answers: Record<string, string>) {
  try {
    return await hat.saveClues(token, (await deviceSecret(false)) ?? "", answers);
  } catch {
    return { ok: false };
  }
}

export async function submitSlipAction(token: string, pickedId: string) {
  try {
    const r = await hat.submitSlip(token, (await deviceSecret(false)) ?? "", pickedId);
    revalidatePath(`/p/${token}`);
    return r;
  } catch {
    return { ok: false, error: "This page isn't unlocked on this device." };
  }
}

// ---------- organizer ----------

export async function openHatAction(adminToken: string) {
  return hat.openHat(adminToken);
}
export async function resetHatAction(adminToken: string, typed: string) {
  return hat.resetHat(adminToken, typed);
}
export async function startEmptyingAction(adminToken: string) {
  return hat.startEmptying(adminToken);
}
export async function addMinuteAction(adminToken: string) {
  return hat.addMinute(adminToken);
}
export async function stopEmptyingAction(adminToken: string) {
  return hat.stopEmptying(adminToken);
}
export async function renewLinkAction(adminToken: string, participantId: string) {
  return hat.renewLink(adminToken, participantId);
}
export async function resetCodeAction(adminToken: string, participantId: string) {
  return hat.resetCode(adminToken, participantId);
}
export async function adminViewAction(adminToken: string) {
  return hat.adminView(adminToken);
}
