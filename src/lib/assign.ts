import { randomInt as cryptoRandomInt } from "node:crypto";

/**
 * Assignment generator for the family hat.
 *
 * Builds a complete giver -> recipient assignment before anyone draws, so the
 * order of draws never matters and the last draw can never be stuck.
 *
 * Strategy (all random choices use a cryptographic source):
 *   1. Feasibility: a perfect-matching check. If none exists, explain why in
 *      plain words, naming the group of people who are boxed in.
 *   2. Prefer one big loop: random single cycles (Sattolo), rejected until valid.
 *   3. Fall back to any valid permutation (rejection sampling).
 *   4. Last resort: a randomized matching, always valid when feasible.
 * Every result is verified before it is returned.
 */

export type Person = { id: string; name: string };
/** Directional rule: `from` may not draw `to`. */
export type Exclusion = { from: string; to: string };
export type Assignment = Map<string, string>; // giver id -> recipient id

export type RandomInt = (maxExclusive: number) => number;

export type GenerateResult =
  | { ok: true; assignment: Assignment; singleLoop: boolean; method: Method }
  | { ok: false; reason: string };

type Method = "single-loop" | "permutation" | "matching";

export type GenerateOptions = {
  random?: RandomInt;
  loopTries?: number;
  permutationTries?: number;
};

const defaultRandom: RandomInt = (max) => cryptoRandomInt(max);

export function generateAssignment(
  people: Person[],
  exclusions: Exclusion[],
  options: GenerateOptions = {},
): GenerateResult {
  const random = options.random ?? defaultRandom;
  const loopTries = options.loopTries ?? 5000;
  const permutationTries = options.permutationTries ?? 5000;

  const basic = checkInput(people, exclusions);
  if (basic) return { ok: false, reason: basic };

  const ids = people.map((p) => p.id);
  const allowed = buildAllowed(ids, exclusions);

  const feasibility = checkFeasible(people, allowed);
  if (!feasibility.ok) return feasibility;

  // 2. Prefer one big loop.
  for (let i = 0; i < loopTries; i++) {
    const order = sattoloCycle(ids, random);
    const a = cycleToAssignment(order);
    if (isAllowed(a, allowed)) {
      return finish(a, ids, exclusions, "single-loop");
    }
  }

  // 3. Any valid permutation.
  for (let i = 0; i < permutationTries; i++) {
    const shuffled = shuffle(ids, random);
    const a: Assignment = new Map(ids.map((g, k) => [g, shuffled[k]]));
    if (isAllowed(a, allowed)) {
      return finish(a, ids, exclusions, "permutation");
    }
  }

  // 4. Randomized matching. Feasibility already passed, so this succeeds.
  const matching = maximumMatching(shuffle(ids, random), allowed, random);
  return finish(matching, ids, exclusions, "matching");
}

function finish(
  a: Assignment,
  ids: string[],
  exclusions: Exclusion[],
  method: Method,
): GenerateResult {
  const problem = verifyAssignment(ids, exclusions, a);
  if (problem) {
    // Should be unreachable; refuse rather than seal a broken hat.
    return { ok: false, reason: `Internal check failed: ${problem}` };
  }
  return { ok: true, assignment: a, singleLoop: isSingleLoop(a), method };
}

/**
 * Independent check of a finished assignment. Returns null when valid, or a
 * description of the first problem found. Used before sealing and again
 * before the hat opens.
 */
export function verifyAssignment(
  ids: string[],
  exclusions: Exclusion[],
  a: Assignment,
): string | null {
  const idSet = new Set(ids);
  if (a.size !== ids.length) return "not everyone has a person";
  const received = new Set<string>();
  for (const [giver, recipient] of a) {
    if (!idSet.has(giver)) return "an unknown giver is in the hat";
    if (!idSet.has(recipient)) return "an unknown name is in the hat";
    if (giver === recipient) return "someone drew themselves";
    if (received.has(recipient)) return "someone was drawn twice";
    received.add(recipient);
  }
  if (received.size !== ids.length) return "someone was never drawn";
  for (const ex of exclusions) {
    if (a.get(ex.from) === ex.to) return "an excluded pair was drawn";
  }
  return null;
}

export function isSingleLoop(a: Assignment): boolean {
  if (a.size === 0) return false;
  const start = a.keys().next().value as string;
  let current = start;
  let steps = 0;
  do {
    current = a.get(current)!;
    steps++;
  } while (current !== start && steps <= a.size);
  return steps === a.size && current === start;
}

// ---------- internals ----------

function checkInput(people: Person[], exclusions: Exclusion[]): string | null {
  if (people.length < 2) return "The hat needs at least two people.";
  const ids = new Set<string>();
  for (const p of people) {
    if (ids.has(p.id)) return `${p.name} is in the hat twice.`;
    ids.add(p.id);
  }
  for (const ex of exclusions) {
    if (!ids.has(ex.from) || !ids.has(ex.to)) {
      return "A rule mentions someone who isn't in the hat.";
    }
  }
  return null;
}

type Allowed = Map<string, Set<string>>;

function buildAllowed(ids: string[], exclusions: Exclusion[]): Allowed {
  const blocked = new Set(exclusions.map((e) => `${e.from}\u0000${e.to}`));
  const allowed: Allowed = new Map();
  for (const g of ids) {
    const set = new Set<string>();
    for (const r of ids) {
      if (g !== r && !blocked.has(`${g}\u0000${r}`)) set.add(r);
    }
    allowed.set(g, set);
  }
  return allowed;
}

function isAllowed(a: Assignment, allowed: Allowed): boolean {
  for (const [g, r] of a) if (!allowed.get(g)!.has(r)) return false;
  return true;
}

function checkFeasible(
  people: Person[],
  allowed: Allowed,
): { ok: true } | { ok: false; reason: string } {

  // Someone with nobody left to draw is the clearest message.
  for (const p of people) {
    if (allowed.get(p.id)!.size === 0) {
      return {
        ok: false,
        reason: `${p.name} has no one left to draw. Remove one of ${p.name}'s rules or add someone.`,
      };
    }
  }
  // Someone nobody may draw.
  for (const p of people) {
    const anyone = people.some((g) => allowed.get(g.id)!.has(p.id));
    if (!anyone) {
      return {
        ok: false,
        reason: `Nobody is allowed to draw ${p.name}. Remove a rule so someone can.`,
      };
    }
  }

  const ids = people.map((p) => p.id);
  const match = maximumMatching(ids, allowed);
  if (match.size === ids.length) return { ok: true };

  // Hall's theorem: find a group of givers whose combined choices are too few.
  const recipientOf = new Map<string, string>(match);
  const giverOf = new Map<string, string>();
  for (const [g, r] of match) giverOf.set(r, g);
  const unmatched = ids.find((g) => !recipientOf.has(g))!;
  const group = new Set<string>([unmatched]);
  const reachable = new Set<string>();
  const queue = [unmatched];
  while (queue.length) {
    const g = queue.shift()!;
    for (const r of allowed.get(g)!) {
      if (reachable.has(r)) continue;
      reachable.add(r);
      const next = giverOf.get(r);
      if (next && !group.has(next)) {
        group.add(next);
        queue.push(next);
      }
    }
  }
  const who = joinNames(people.filter((p) => group.has(p.id)).map((p) => p.name));
  return {
    ok: false,
    reason: `${who} can only draw from ${reachable.size} ${
      reachable.size === 1 ? "person" : "people"
    } between them, which isn't enough. Remove one of their rules or add someone.`,
  };
}

/** Kuhn's augmenting-path matching. Small families, so O(n^3) is instant. */
function maximumMatching(
  giverOrder: string[],
  allowed: Allowed,
  random?: RandomInt,
): Assignment {
  const giverOf = new Map<string, string>();
  const options = new Map<string, string[]>();
  for (const g of giverOrder) {
    const list = [...allowed.get(g)!];
    options.set(g, random ? shuffle(list, random) : list);
  }
  const tryGiver = (g: string, seen: Set<string>): boolean => {
    for (const r of options.get(g)!) {
      if (seen.has(r)) continue;
      seen.add(r);
      const holder = giverOf.get(r);
      if (holder === undefined || tryGiver(holder, seen)) {
        giverOf.set(r, g);
        return true;
      }
    }
    return false;
  };
  for (const g of giverOrder) tryGiver(g, new Set());
  const result: Assignment = new Map();
  for (const [r, g] of giverOf) result.set(g, r);
  return result;
}

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(items: T[], random: RandomInt): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sattolo's algorithm: a uniformly random single cycle, as an ordering. */
function sattoloCycle(ids: string[], random: RandomInt): string[] {
  // Build a cyclic permutation p, then walk it to get the loop order.
  const n = ids.length;
  const p = ids.map((_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = random(i); // j < i: guarantees a single cycle
    [p[i], p[j]] = [p[j], p[i]];
  }
  const order: string[] = [];
  let k = 0;
  for (let step = 0; step < n; step++) {
    order.push(ids[k]);
    k = p[k];
  }
  return order;
}

function cycleToAssignment(order: string[]): Assignment {
  const a: Assignment = new Map();
  for (let i = 0; i < order.length; i++) {
    a.set(order[i], order[(i + 1) % order.length]);
  }
  return a;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Turn household groups into two-way "can't draw each other" rules. */
export function householdExclusions(households: string[][]): Exclusion[] {
  const out: Exclusion[] = [];
  for (const house of households) {
    for (const a of house) {
      for (const b of house) {
        if (a !== b) out.push({ from: a, to: b });
      }
    }
  }
  return out;
}
