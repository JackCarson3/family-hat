import { and, eq, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { generateAssignment, verifyAssignment, type Exclusion } from "./assign";
import { assignmentContext, decrypt, encrypt, hatCode } from "./secrets";

const { exchanges, participants, exclusions, assignments } = schema;

/**
 * Generate, verify, encrypt and store a fresh assignment for one exchange.
 * Bumps the generation, so every earlier slip and hat code becomes invalid.
 * Nothing about the pairings is returned to the caller.
 */
export async function sealHat(exchangeId: string): Promise<{ ok: true; hatCode: string } | { ok: false; reason: string }> {
  const d = await getDb();
  const [exchange] = await d.select().from(exchanges).where(eq(exchanges.id, exchangeId));
  if (!exchange) return { ok: false, reason: "That hat doesn't exist." };

  const people = await d.select().from(participants).where(eq(participants.exchangeId, exchangeId));
  const rules = await d.select().from(exclusions).where(eq(exclusions.exchangeId, exchangeId));
  const ex: Exclusion[] = rules.map((r) => ({ from: r.fromId, to: r.toId }));

  const result = generateAssignment(
    people.map((p) => ({ id: p.id, name: p.name })),
    ex,
  );
  if (!result.ok) return result;

  const generation = exchange.generation + 1;
  const code = hatCode(exchangeId, generation, result.assignment);

  await d.insert(assignments).values(
    [...result.assignment].map(([giver, recipient]) => ({
      exchangeId,
      generation,
      giverId: giver,
      sealedRecipient: encrypt(recipient, assignmentContext(exchangeId, generation, giver)),
    })),
  );

  // Read back what was stored and verify it decrypts to a valid hat before switching over.
  const check = await verifyStored(exchangeId, generation);
  if (!check.ok) {
    await d.delete(assignments).where(and(eq(assignments.exchangeId, exchangeId), eq(assignments.generation, generation)));
    return { ok: false, reason: `The new hat failed its check (${check.reason}). Nothing changed.` };
  }

  await d
    .update(exchanges)
    .set({ generation, hatCode: code, stage: "sealed", emptyDeadline: null, openedAt: null })
    .where(eq(exchanges.id, exchangeId));
  await d
    .update(participants)
    .set({ revealedAt: null, confirmedAt: null, slipMatchedAt: null })
    .where(eq(participants.exchangeId, exchangeId));
  // Old generations are no longer needed.
  await d.delete(assignments).where(and(eq(assignments.exchangeId, exchangeId), ne(assignments.generation, generation)));
  return { ok: true, hatCode: code };
}

/**
 * Integrity check of the stored assignment: decrypts every row, confirms the
 * whole hat is valid and that its fingerprint matches the published hat code.
 * Returns only pass/fail, never pairings.
 */
export async function verifyStored(
  exchangeId: string,
  generation: number,
  expectedHatCode?: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const d = await getDb();
  const people = await d.select({ id: participants.id }).from(participants).where(eq(participants.exchangeId, exchangeId));
  const rules = await d.select().from(exclusions).where(eq(exclusions.exchangeId, exchangeId));
  const rows = await d
    .select()
    .from(assignments)
    .where(and(eq(assignments.exchangeId, exchangeId), eq(assignments.generation, generation)));

  const map = new Map<string, string>();
  try {
    for (const row of rows) {
      map.set(row.giverId, decrypt(row.sealedRecipient, assignmentContext(exchangeId, generation, row.giverId)));
    }
  } catch {
    return { ok: false, reason: "a slip could not be read" };
  }
  const problem = verifyAssignment(
    people.map((p) => p.id),
    rules.map((r) => ({ from: r.fromId, to: r.toId })),
    map,
  );
  if (problem) return { ok: false, reason: problem };
  if (expectedHatCode && hatCode(exchangeId, generation, map) !== expectedHatCode) {
    return { ok: false, reason: "the hat code doesn't match" };
  }
  return { ok: true };
}
