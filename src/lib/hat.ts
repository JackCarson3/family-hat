import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  assignmentContext,
  checkCode,
  decrypt,
  encrypt,
  hashCode,
  hashToken,
  inviteContext,
  isValidCode,
  newToken,
} from "./secrets";
import { sealHat, verifyStored } from "./seal";
import { CLUE_LABELS } from "@/components/clueLabels";

/**
 * All hat logic. Functions take the raw link token and device secret and
 * re-check access every time. Anything that returns data for a public or
 * admin screen is built from an explicit list of fields and never reads
 * the assignments table.
 */

const { exchanges, participants, devices, assignments, clues, notices } = schema;

type Exchange = typeof exchanges.$inferSelect;
type Participant = typeof participants.$inferSelect;

export const MAX_CODE_TRIES = 5;
export const LOCK_MINUTES = 15;
export const EMPTY_SECONDS = 120;

// ---------------------------------------------------------------- access

export type AccessState = "claim" | "code" | "locked" | "in";

export type Access =
  | { ok: false }
  | { ok: true; state: AccessState; participant: Participant; exchange: Exchange; lockedUntil?: Date };

export function deviceHash(secret: string | undefined): string | null {
  return secret ? hashToken(`device:${secret}`) : null;
}

export async function lookup(token: string, deviceSecret: string | undefined): Promise<Access> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return { ok: false };
  const d = await getDb();
  const [p] = await d.select().from(participants).where(eq(participants.inviteTokenHash, hashToken(token)));
  if (!p) return { ok: false };
  const [exchange] = await d.select().from(exchanges).where(eq(exchanges.id, p.exchangeId));

  if (!p.claimedAt || !p.codeHash) return { ok: true, state: "claim", participant: p, exchange };
  const dh = deviceHash(deviceSecret);
  if (dh) {
    const [known] = await d
      .select()
      .from(devices)
      .where(and(eq(devices.participantId, p.id), eq(devices.deviceHash, dh)));
    if (known) return { ok: true, state: "in", participant: p, exchange };
  }
  if (p.lockedUntil && p.lockedUntil > new Date()) {
    return { ok: true, state: "locked", participant: p, exchange, lockedUntil: p.lockedUntil };
  }
  return { ok: true, state: "code", participant: p, exchange };
}

async function requireIn(token: string, deviceSecret: string | undefined) {
  const a = await lookup(token, deviceSecret);
  if (!a.ok || a.state !== "in") throw new AccessError();
  return a;
}

export class AccessError extends Error {
  constructor() {
    super("This page isn't unlocked on this device.");
  }
}

async function rememberDevice(participantId: string, deviceSecret: string) {
  const d = await getDb();
  await d
    .insert(devices)
    .values({ participantId, deviceHash: deviceHash(deviceSecret)! })
    .onConflictDoNothing();
}

/** First open: "Yes, that's me" + choose a code. */
export async function claim(token: string, deviceSecret: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!isValidCode(code)) return { ok: false, error: "Please choose exactly 4 numbers." };
  const a = await lookup(token, deviceSecret);
  if (!a.ok) return { ok: false, error: "This link isn't recognized." };
  if (a.state !== "claim") return { ok: false, error: "This spot is already claimed. Enter its code instead." };
  const d = await getDb();
  const updated = await d
    .update(participants)
    .set({ codeHash: hashCode(code), claimedAt: new Date(), failedCodeAttempts: 0, lockedUntil: null })
    .where(and(eq(participants.id, a.participant.id), sql`${participants.claimedAt} is null`))
    .returning({ id: participants.id });
  if (!updated.length) return { ok: false, error: "This spot was just claimed. Enter its code instead." };
  await rememberDevice(a.participant.id, deviceSecret);
  return { ok: true };
}

/** A new phone or computer: enter the code chosen at claim. */
export async function unlock(token: string, deviceSecret: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const a = await lookup(token, deviceSecret);
  if (!a.ok) return { ok: false, error: "This link isn't recognized." };
  if (a.state === "in") return { ok: true };
  if (a.state === "locked") return { ok: false, error: `Too many tries. Please wait ${LOCK_MINUTES} minutes.` };
  if (a.state !== "code") return { ok: false, error: "Please claim this spot first." };
  const d = await getDb();
  if (isValidCode(code) && checkCode(code, a.participant.codeHash!)) {
    await d.update(participants).set({ failedCodeAttempts: 0, lockedUntil: null }).where(eq(participants.id, a.participant.id));
    await rememberDevice(a.participant.id, deviceSecret);
    return { ok: true };
  }
  const tries = a.participant.failedCodeAttempts + 1;
  const lock = tries >= MAX_CODE_TRIES;
  await d
    .update(participants)
    .set({
      failedCodeAttempts: lock ? 0 : tries,
      lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
    })
    .where(eq(participants.id, a.participant.id));
  return {
    ok: false,
    error: lock
      ? `Too many tries. Please wait ${LOCK_MINUTES} minutes, or ask the organizer.`
      : `That code didn't match. ${MAX_CODE_TRIES - tries} ${MAX_CODE_TRIES - tries === 1 ? "try" : "tries"} left.`,
  };
}

// ---------------------------------------------------------------- public status

export type PublicPerson = { name: string; household: string; claimed: boolean; drawn: boolean; slipIn: boolean };
export type PublicStatus = {
  publicId: string;
  name: string;
  familyName: string;
  stage: Exchange["stage"];
  hatCode: string | null;
  message: string;
  budget: string | null;
  giftDate: string | null;
  total: number;
  drawnCount: number;
  slipsIn: number;
  emptyDeadline: string | null;
  people: PublicPerson[];
  notices: { text: string; at: string }[];
};

/** Everything the shared hat shows. Never touches assignments. */
export async function publicStatus(exchangeId: string): Promise<PublicStatus | null> {
  const d = await getDb();
  const [ex] = await d.select().from(exchanges).where(eq(exchanges.id, exchangeId));
  if (!ex) return null;
  await settleStage(ex);
  const [fresh] = await d.select().from(exchanges).where(eq(exchanges.id, exchangeId));
  const people = await d
    .select({
      name: participants.name,
      household: participants.household,
      claimedAt: participants.claimedAt,
      confirmedAt: participants.confirmedAt,
      slipMatchedAt: participants.slipMatchedAt,
    })
    .from(participants)
    .where(eq(participants.exchangeId, exchangeId))
    .orderBy(asc(participants.sortOrder));
  const recent = await d
    .select({ text: notices.text, createdAt: notices.createdAt })
    .from(notices)
    .where(and(eq(notices.exchangeId, exchangeId), eq(notices.public, true)))
    .orderBy(sql`${notices.createdAt} desc`)
    .limit(5);

  return {
    publicId: fresh.publicId,
    name: fresh.name,
    familyName: fresh.familyName,
    stage: fresh.stage,
    hatCode: fresh.hatCode,
    message: fresh.message,
    budget: fresh.budget,
    giftDate: fresh.giftDate,
    total: people.length,
    drawnCount: people.filter((p) => p.confirmedAt).length,
    slipsIn: people.filter((p) => p.slipMatchedAt).length,
    emptyDeadline: fresh.emptyDeadline ? fresh.emptyDeadline.toISOString() : null,
    people: people.map((p) => ({
      name: p.name,
      household: p.household,
      claimed: !!p.claimedAt,
      drawn: !!p.confirmedAt,
      slipIn: !!p.slipMatchedAt,
    })),
    notices: recent.map((n) => ({ text: n.text, at: n.createdAt.toISOString() })),
  };
}

export async function exchangeByPublicId(publicId: string) {
  const d = await getDb();
  const [ex] = await d.select().from(exchanges).where(eq(exchanges.publicId, publicId));
  return ex ?? null;
}

/** Move stages forward when their condition is met. */
async function settleStage(ex: Exchange) {
  const d = await getDb();
  const people = await d
    .select({ confirmedAt: participants.confirmedAt, slipMatchedAt: participants.slipMatchedAt })
    .from(participants)
    .where(eq(participants.exchangeId, ex.id));
  if (ex.stage === "open" && people.length && people.every((p) => p.confirmedAt)) {
    await d.update(exchanges).set({ stage: "drawn" }).where(and(eq(exchanges.id, ex.id), eq(exchanges.stage, "open")));
  }
  if (ex.stage === "emptying" && people.length && people.every((p) => p.slipMatchedAt)) {
    await d
      .update(exchanges)
      .set({ stage: "emptied" })
      .where(and(eq(exchanges.id, ex.id), eq(exchanges.stage, "emptying")));
  }
}

// ---------------------------------------------------------------- giver

async function myRecipientId(ex: Exchange, giverId: string): Promise<string | null> {
  const d = await getDb();
  const [row] = await d
    .select()
    .from(assignments)
    .where(
      and(eq(assignments.exchangeId, ex.id), eq(assignments.generation, ex.generation), eq(assignments.giverId, giverId)),
    );
  if (!row) return null;
  return decrypt(row.sealedRecipient, assignmentContext(ex.id, ex.generation, giverId));
}

export type MyPerson = { name: string; clues: Record<string, string>; cluesUpdatedAt: string | null };

async function personView(recipientId: string): Promise<MyPerson> {
  const d = await getDb();
  const [r] = await d.select({ name: participants.name }).from(participants).where(eq(participants.id, recipientId));
  const [c] = await d.select().from(clues).where(eq(clues.participantId, recipientId));
  return { name: r.name, clues: c?.answers ?? {}, cluesUpdatedAt: c ? c.updatedAt.toISOString() : null };
}

/** The deliberate reveal. Only during or after drawing night. */
export async function draw(token: string, deviceSecret: string): Promise<{ ok: true; person: MyPerson; hatCode: string | null } | { ok: false; error: string }> {
  const a = await requireIn(token, deviceSecret);
  const ex = a.exchange;
  if (!["open", "drawn", "emptying", "emptied"].includes(ex.stage)) {
    return { ok: false, error: "The hat isn't open yet." };
  }
  const recipientId = await myRecipientId(ex, a.participant.id);
  if (!recipientId) return { ok: false, error: "Your slip couldn't be found. Please tell the organizer." };
  if (!a.participant.revealedAt) {
    const d = await getDb();
    await d.update(participants).set({ revealedAt: new Date() }).where(eq(participants.id, a.participant.id));
  }
  return { ok: true, person: await personView(recipientId), hatCode: ex.hatCode };
}

/** "Got it": the draw counts. */
export async function confirmDraw(token: string, deviceSecret: string): Promise<{ ok: boolean }> {
  const a = await requireIn(token, deviceSecret);
  if (!a.participant.revealedAt) return { ok: false };
  const d = await getDb();
  if (!a.participant.confirmedAt) {
    await d.update(participants).set({ confirmedAt: new Date() }).where(eq(participants.id, a.participant.id));
  }
  await settleStage(a.exchange);
  return { ok: true };
}

/** Private page data for an unlocked participant. */
export async function myPage(token: string, deviceSecret: string) {
  const a = await requireIn(token, deviceSecret);
  const d = await getDb();
  const [mine] = await d.select().from(clues).where(eq(clues.participantId, a.participant.id));
  let person: MyPerson | null = null;
  if (a.participant.revealedAt) {
    const rid = await myRecipientId(a.exchange, a.participant.id);
    if (rid) person = await personView(rid);
  }
  // Everyone in this hat except me, for the Empty the hat picker.
  const others = await d
    .select({ id: participants.id, name: participants.name })
    .from(participants)
    .where(and(eq(participants.exchangeId, a.exchange.id), ne(participants.id, a.participant.id)))
    .orderBy(asc(participants.sortOrder));

  return {
    me: {
      name: a.participant.name,
      revealed: !!a.participant.revealedAt,
      confirmed: !!a.participant.confirmedAt,
      slipIn: !!a.participant.slipMatchedAt,
    },
    exchangeId: a.exchange.id,
    publicId: a.exchange.publicId,
    myClues: mine?.answers ?? {},
    person,
    others,
    alsoOnThisPhone: await othersOnDevice(deviceSecret, a.participant.id),
  };
}

/** Other people this phone has unlocked (a parent holding their kids' links). */
async function othersOnDevice(deviceSecret: string, exceptId: string) {
  const d = await getDb();
  const dh = deviceHash(deviceSecret);
  if (!dh) return [];
  const rows = await d
    .select({ id: participants.id, name: participants.name, sealed: participants.inviteTokenSealed, hat: exchanges.name })
    .from(devices)
    .innerJoin(participants, eq(devices.participantId, participants.id))
    .innerJoin(exchanges, eq(participants.exchangeId, exchanges.id))
    .where(and(eq(devices.deviceHash, dh), ne(participants.id, exceptId)));
  return rows.map((r) => ({ name: r.name, hat: r.hat, path: `/p/${decrypt(r.sealed, inviteContext(r.id))}` }));
}

export const CLUE_PROMPTS = CLUE_LABELS;

export async function saveClues(token: string, deviceSecret: string, answers: Record<string, string>) {
  const a = await requireIn(token, deviceSecret);
  const clean: Record<string, string> = {};
  for (const { key } of CLUE_PROMPTS) {
    const v = (answers[key] ?? "").toString().trim().slice(0, 500);
    if (v) clean[key] = v;
  }
  const d = await getDb();
  await d
    .insert(clues)
    .values({ participantId: a.participant.id, answers: clean, updatedAt: new Date() })
    .onConflictDoUpdate({ target: clues.participantId, set: { answers: clean, updatedAt: new Date() } });
  return { ok: true };
}

/** Empty the hat: check my pick against my sealed slip. Stores only "matched". */
export async function submitSlip(token: string, deviceSecret: string, pickedId: string): Promise<{ ok: boolean; error?: string }> {
  const a = await requireIn(token, deviceSecret);
  const ex = a.exchange;
  if (ex.stage !== "emptying") return { ok: false, error: "The hat isn't being emptied right now." };
  if (ex.emptyDeadline && ex.emptyDeadline < new Date()) return { ok: false, error: "Time's up! Ask the organizer for another minute." };
  const rid = await myRecipientId(ex, a.participant.id);
  if (!rid || rid !== pickedId) return { ok: false, error: "That's not the name on your slip. Tap to peek again." };
  const d = await getDb();
  await d.update(participants).set({ slipMatchedAt: new Date() }).where(eq(participants.id, a.participant.id));
  await settleStage(ex);
  return { ok: true };
}

// ---------------------------------------------------------------- organizer

export async function adminLookup(token: string): Promise<Exchange | null> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return null;
  const d = await getDb();
  const [ex] = await d.select().from(exchanges).where(eq(exchanges.adminTokenHash, hashToken(token)));
  return ex ?? null;
}

/** Organizer dashboard data: status and links, never pairings. */
export async function adminView(token: string) {
  const ex = await adminLookup(token);
  if (!ex) return null;
  const status = (await publicStatus(ex.id))!;
  const d = await getDb();
  const people = await d
    .select({
      id: participants.id,
      name: participants.name,
      household: participants.household,
      sealed: participants.inviteTokenSealed,
      claimedAt: participants.claimedAt,
      revealedAt: participants.revealedAt,
      confirmedAt: participants.confirmedAt,
      slipMatchedAt: participants.slipMatchedAt,
    })
    .from(participants)
    .where(eq(participants.exchangeId, ex.id))
    .orderBy(asc(participants.sortOrder));
  const cluesRows = people.length
    ? await d.select({ id: clues.participantId }).from(clues).where(inArray(clues.participantId, people.map((p) => p.id)))
    : [];
  const withClues = new Set(cluesRows.map((r) => r.id));
  return {
    status,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      household: p.household,
      path: `/p/${decrypt(p.sealed, inviteContext(p.id))}`,
      claimed: !!p.claimedAt,
      clues: withClues.has(p.id),
      state: p.confirmedAt ? "Confirmed" : p.revealedAt ? "Revealed" : "Waiting",
      slipIn: !!p.slipMatchedAt,
    })),
  };
}

async function notice(exchangeId: string, text: string) {
  const d = await getDb();
  await d.insert(notices).values({ exchangeId, text });
}

export async function openHat(token: string): Promise<{ ok: boolean; error?: string }> {
  const ex = await adminLookup(token);
  if (!ex) return { ok: false, error: "Not allowed." };
  if (ex.stage !== "sealed") return { ok: false, error: "The hat is already open." };
  const check = await verifyStored(ex.id, ex.generation, ex.hatCode);
  if (!check.ok) return { ok: false, error: `The hat failed its safety check (${check.reason}). Reset it before opening.` };
  const d = await getDb();
  await d.update(exchanges).set({ stage: "open", openedAt: new Date() }).where(eq(exchanges.id, ex.id));
  return { ok: true };
}

export async function resetHat(token: string, typed: string): Promise<{ ok: boolean; error?: string }> {
  const ex = await adminLookup(token);
  if (!ex) return { ok: false, error: "Not allowed." };
  const d = await getDb();
  const revealed = await d
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.exchangeId, ex.id), sql`${participants.revealedAt} is not null`));
  if (revealed.length && typed.trim().toUpperCase() !== "RESET") {
    return { ok: false, error: "Type RESET to confirm. Everyone who has drawn will draw again." };
  }
  const result = await sealHat(ex.id);
  if (!result.ok) return { ok: false, error: result.reason };
  if (revealed.length) await notice(ex.id, "The hat was refilled. Everyone will draw again.");
  return { ok: true };
}

export async function startEmptying(token: string): Promise<{ ok: boolean; error?: string }> {
  const ex = await adminLookup(token);
  if (!ex) return { ok: false, error: "Not allowed." };
  if (!["drawn", "emptying", "open"].includes(ex.stage)) return { ok: false, error: "Everyone needs to draw first." };
  const d = await getDb();
  await d
    .update(participants)
    .set({ slipMatchedAt: null })
    .where(eq(participants.exchangeId, ex.id));
  await d
    .update(exchanges)
    .set({ stage: "emptying", emptyDeadline: new Date(Date.now() + EMPTY_SECONDS * 1000) })
    .where(eq(exchanges.id, ex.id));
  return { ok: true };
}

export async function addMinute(token: string) {
  const ex = await adminLookup(token);
  if (!ex || ex.stage !== "emptying") return { ok: false };
  const base = ex.emptyDeadline && ex.emptyDeadline > new Date() ? ex.emptyDeadline : new Date();
  const d = await getDb();
  await d.update(exchanges).set({ emptyDeadline: new Date(base.getTime() + 60_000) }).where(eq(exchanges.id, ex.id));
  return { ok: true };
}

export async function stopEmptying(token: string) {
  const ex = await adminLookup(token);
  if (!ex || ex.stage !== "emptying") return { ok: false };
  const d = await getDb();
  await d.update(exchanges).set({ stage: "drawn", emptyDeadline: null }).where(eq(exchanges.id, ex.id));
  return { ok: true };
}

/** Lost link: issue a new one. The old one stops working. Announced on the hat. */
export async function renewLink(token: string, participantId: string): Promise<{ ok: boolean; path?: string }> {
  const ex = await adminLookup(token);
  if (!ex) return { ok: false };
  const d = await getDb();
  const [p] = await d
    .select()
    .from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.exchangeId, ex.id)));
  if (!p) return { ok: false };
  const fresh = newToken();
  await d
    .update(participants)
    .set({ inviteTokenHash: hashToken(fresh), inviteTokenSealed: encrypt(fresh, inviteContext(p.id)) })
    .where(eq(participants.id, p.id));
  await notice(ex.id, `${p.name}'s link was renewed.`);
  return { ok: true, path: `/p/${fresh}` };
}

/** Forgot code: clear it so the link can be claimed again. Announced on the hat. */
export async function resetCode(token: string, participantId: string): Promise<{ ok: boolean }> {
  const ex = await adminLookup(token);
  if (!ex) return { ok: false };
  const d = await getDb();
  const [p] = await d
    .select()
    .from(participants)
    .where(and(eq(participants.id, participantId), eq(participants.exchangeId, ex.id)));
  if (!p) return { ok: false };
  await d
    .update(participants)
    .set({ codeHash: null, claimedAt: null, failedCodeAttempts: 0, lockedUntil: null })
    .where(eq(participants.id, p.id));
  await d.delete(devices).where(eq(devices.participantId, p.id));
  await notice(ex.id, `${p.name}'s code was reset.`);
  return { ok: true };
}
