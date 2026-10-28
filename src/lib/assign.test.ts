import { describe, expect, it } from "vitest";
import {
  generateAssignment,
  householdExclusions,
  isSingleLoop,
  verifyAssignment,
  type Person,
} from "./assign";
import { hats } from "../config/family";

function hatInput(slug: string) {
  const hat = hats.find((h) => h.slug === slug)!;
  const people: Person[] = hat.households.flatMap((h) => h.members);
  const exclusions = householdExclusions(hat.households.map((h) => h.members.map((m) => m.id)));
  return { people, exclusions, ids: people.map((p) => p.id) };
}

describe("family hats", () => {
  for (const slug of ["grown-ups", "kids"]) {
    it(`${slug}: 10,000 draws are all valid single loops`, () => {
      const { people, exclusions, ids } = hatInput(slug);
      const recipientsSeen = new Map<string, Set<string>>();
      for (let i = 0; i < 10_000; i++) {
        const result = generateAssignment(people, exclusions);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(verifyAssignment(ids, exclusions, result.assignment)).toBeNull();
        expect(result.singleLoop).toBe(true);
        for (const [g, r] of result.assignment) {
          if (!recipientsSeen.has(g)) recipientsSeen.set(g, new Set());
          recipientsSeen.get(g)!.add(r);
        }
      }
      // Randomness sanity: everyone ends up drawing every allowed person at some point.
      for (const id of ids) {
        const household = exclusions.filter((e) => e.from === id).length;
        expect(recipientsSeen.get(id)!.size).toBe(ids.length - 1 - household);
      }
    });
  }

  it("grown-ups: the draw is close to evenly spread", () => {
    const { people, exclusions } = hatInput("grown-ups");
    const counts = new Map<string, number>();
    const runs = 12_000;
    for (let i = 0; i < runs; i++) {
      const r = generateAssignment(people, exclusions);
      if (!r.ok) throw new Error(r.reason);
      const who = r.assignment.get("jack")!;
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
    // Jack can draw 6 people; each should get roughly 1/6 of the draws.
    expect(counts.size).toBe(6);
    for (const n of counts.values()) {
      expect(n / runs).toBeGreaterThan(0.13);
      expect(n / runs).toBeLessThan(0.2);
    }
  });
});

describe("rules", () => {
  const p = (...names: string[]): Person[] => names.map((n) => ({ id: n.toLowerCase(), name: n }));

  it("never lets anyone draw themselves", () => {
    for (let i = 0; i < 1000; i++) {
      const r = generateAssignment(p("A", "B", "C"), []);
      if (!r.ok) throw new Error(r.reason);
      for (const [g, rec] of r.assignment) expect(g).not.toBe(rec);
    }
  });

  it("works with two people", () => {
    const r = generateAssignment(p("A", "B"), []);
    expect(r.ok && r.assignment.get("a")).toBe("b");
  });

  it("explains when one person has no one left", () => {
    const r = generateAssignment(p("Ann", "Bob", "Cy"), [
      { from: "ann", to: "bob" },
      { from: "ann", to: "cy" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Ann has no one left to draw");
  });

  it("explains a boxed-in group", () => {
    // Ann and Bob may each only draw Cy.
    const r = generateAssignment(p("Ann", "Bob", "Cy", "Dee"), [
      { from: "ann", to: "bob" },
      { from: "ann", to: "dee" },
      { from: "bob", to: "ann" },
      { from: "bob", to: "dee" },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Ann and Bob can only draw from 1 person/);
  });

  it("rejects one couple alone", () => {
    const people = p("A", "B");
    const r = generateAssignment(people, householdExclusions([["a", "b"]]));
    expect(r.ok).toBe(false);
  });

  it("falls back to smaller loops when one loop is impossible", () => {
    // A<->B forced and C<->D forced: no single loop exists.
    const ids = ["a", "b", "c", "d"];
    const exclusions = [];
    const allowedPairs = new Set(["a>b", "b>a", "c>d", "d>c"]);
    for (const g of ids) for (const r of ids) if (g !== r && !allowedPairs.has(`${g}>${r}`)) exclusions.push({ from: g, to: r });
    const res = generateAssignment(p("A", "B", "C", "D"), exclusions, { loopTries: 50 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.singleLoop).toBe(false);
      expect(verifyAssignment(ids, exclusions, res.assignment)).toBeNull();
    }
  });

  it("matching fallback still produces a valid result", () => {
    const res = generateAssignment(p("A", "B", "C", "D", "E"), [{ from: "a", to: "b" }], {
      loopTries: 0,
      permutationTries: 0,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.method).toBe("matching");
  });

  it("verify catches broken assignments", () => {
    const ids = ["a", "b", "c"];
    expect(verifyAssignment(ids, [], new Map([["a", "b"], ["b", "b"], ["c", "a"]]))).toBe("someone drew themselves");
    expect(verifyAssignment(ids, [], new Map([["a", "b"], ["b", "a"], ["c", "a"]]))).toBe("someone was drawn twice");
    expect(verifyAssignment(ids, [{ from: "a", to: "b" }], new Map([["a", "b"], ["b", "c"], ["c", "a"]]))).toBe(
      "an excluded pair was drawn",
    );
    expect(isSingleLoop(new Map([["a", "b"], ["b", "c"], ["c", "a"]]))).toBe(true);
  });
});
