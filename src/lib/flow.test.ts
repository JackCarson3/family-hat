import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { demoHats, FAMILY_NAME } from "@/config/family";

process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.HASH_SECRET = randomBytes(32).toString("base64");
process.env.DATABASE_URL = "pglite:memory";

const { createHat } = await import("./setup");
const hat = await import("./hat");
const { getDb, schema } = await import("@/db");

let made: Awaited<ReturnType<typeof createHat>>;
const tokenOf = (name: string) => made.links.find((l) => l.name === name)!.link.split("/p/")[1];
const adminToken = () => made.adminLink.split("/admin/")[1];
const phone = (name: string) => `phone-of-${name}-${"x".repeat(10)}`;

beforeAll(async () => {
  made = await createHat(demoHats[0], FAMILY_NAME, "https://hat.test");
}, 60_000);

describe("full drawing night", () => {
  it("rejects unknown and malformed links", async () => {
    expect((await hat.lookup("nope", undefined)).ok).toBe(false);
    expect((await hat.lookup("A".repeat(22), undefined)).ok).toBe(false);
  });

  it("claims, remembers the phone, and needs the code elsewhere", async () => {
    const t = tokenOf("Jingle");
    expect((await hat.lookup(t, undefined)).ok && (await hat.lookup(t, undefined) as { state: string }).state).toBe("claim");
    expect((await hat.claim(t, phone("Jingle"), "12a4")).ok).toBe(false);
    expect((await hat.claim(t, phone("Jingle"), "1234")).ok).toBe(true);
    expect(((await hat.lookup(t, phone("Jingle"))) as { state: string }).state).toBe("in");

    // Someone else opening the link (or a new laptop) needs the code.
    expect(((await hat.lookup(t, "laptop-secret")) as { state: string }).state).toBe("code");
    expect((await hat.claim(t, "laptop-secret", "9999")).ok).toBe(false);
    expect((await hat.unlock(t, "laptop-secret", "0000")).ok).toBe(false);
    expect((await hat.unlock(t, "laptop-secret", "1234")).ok).toBe(true);
    expect(((await hat.lookup(t, "laptop-secret")) as { state: string }).state).toBe("in");
  });

  it("locks after five wrong codes", async () => {
    const t = tokenOf("Tinsel");
    await hat.claim(t, phone("Tinsel"), "5555");
    for (let i = 0; i < hat.MAX_CODE_TRIES; i++) await hat.unlock(t, "stranger", "0000");
    expect(((await hat.lookup(t, "stranger")) as { state: string }).state).toBe("locked");
    expect((await hat.unlock(t, "stranger", "5555")).ok).toBe(false);
  });

  it("keeps the hat locked until the organizer opens it", async () => {
    for (const name of ["Dasher", "Comet", "Frosty", "Flurry"]) await hat.claim(tokenOf(name), phone(name), "1111");
    const r = await hat.draw(tokenOf("Dasher"), phone("Dasher"));
    expect(r.ok).toBe(false);
    await expect(hat.draw(tokenOf("Dasher"), "stranger")).rejects.toThrow();
  });

  it("everyone draws a valid name, and gift clues reach only the giver", async () => {
    expect((await hat.openHat(adminToken())).ok).toBe(true);
    await hat.saveClues(tokenOf("Comet"), phone("Comet"), { smile: "Hot cocoa", bogus: "ignored" });

    const names = ["Jingle", "Tinsel", "Dasher", "Comet", "Frosty", "Flurry"];
    const household: Record<string, string> = { Jingle: "Elves", Tinsel: "Elves", Dasher: "Reindeer", Comet: "Reindeer", Frosty: "Snowmen", Flurry: "Snowmen" };
    const drawn = new Map<string, string>();
    for (const name of names) {
      const r = await hat.draw(tokenOf(name), phone(name));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.hatCode).toBe(made.hatCode);
      drawn.set(name, r.person.name);
      if (r.person.name === "Comet") expect(r.person.clues).toEqual({ smile: "Hot cocoa" });
      else expect(r.person.clues).toEqual({});
      expect(await hat.confirmDraw(tokenOf(name), phone(name))).toEqual({ ok: true });
    }
    expect(new Set(drawn.values()).size).toBe(6);
    for (const [g, r] of drawn) {
      expect(g).not.toBe(r);
      expect(household[g]).not.toBe(household[r]);
    }
    const s = await hat.publicStatus((await hat.adminLookup(adminToken()))!.id);
    expect(s!.stage).toBe("drawn");
    expect(s!.drawnCount).toBe(6);

    // Empty the hat: wrong picks are refused privately; right picks tumble out.
    expect((await hat.startEmptying(adminToken())).ok).toBe(true);
    const page = await hat.myPage(tokenOf("Jingle"), phone("Jingle"));
    const wrong = page.others.find((o) => o.name !== drawn.get("Jingle"))!;
    expect((await hat.submitSlip(tokenOf("Jingle"), phone("Jingle"), wrong.id)).ok).toBe(false);
    for (const name of names) {
      const mine = await hat.myPage(tokenOf(name), phone(name));
      const pick = mine.others.find((o) => o.name === drawn.get(name))!;
      expect((await hat.submitSlip(tokenOf(name), phone(name), pick.id)).ok).toBe(true);
    }
    const after = await hat.publicStatus((await hat.adminLookup(adminToken()))!.id);
    expect(after!.stage).toBe("emptied");
    expect(after!.slipsIn).toBe(6);
  });

  it("public and organizer views never contain a pairing", async () => {
    const ex = (await hat.adminLookup(adminToken()))!;
    const pub = JSON.stringify(await hat.publicStatus(ex.id));
    const admin = JSON.stringify(await hat.adminView(adminToken()));
    const d = await getDb();
    const rows = await d.select().from(schema.assignments);
    for (const text of [pub, admin]) {
      expect(text).not.toMatch(/sealed|recipient|assignment/i);
      for (const r of rows) expect(text).not.toContain(r.sealedRecipient);
    }
    // Per-person entries expose only these fields.
    const view = await hat.adminView(adminToken());
    expect(Object.keys(view!.people[0]).sort()).toEqual(["claimed", "clues", "household", "id", "name", "path", "slipIn", "state"]);
    expect(Object.keys((await hat.publicStatus(ex.id))!.people[0]).sort()).toEqual(["claimed", "drawn", "household", "name", "slipIn"]);
  });

  it("reset after draws needs RESET, refills the hat and changes the hat code", async () => {
    expect((await hat.resetHat(adminToken(), "yes")).ok).toBe(false);
    expect((await hat.resetHat(adminToken(), "reset")).ok).toBe(true);
    const ex = (await hat.adminLookup(adminToken()))!;
    expect(ex.stage).toBe("sealed");
    expect(ex.hatCode).not.toBe(made.hatCode);
    const s = await hat.publicStatus(ex.id);
    expect(s!.drawnCount).toBe(0);
    expect(s!.notices[0].text).toMatch(/refilled/);
  });

  it("renewing a link kills the old one; resetting a code is announced", async () => {
    const view = await hat.adminView(adminToken());
    const flurry = view!.people.find((p) => p.name === "Flurry")!;
    const old = tokenOf("Flurry");
    const renewed = await hat.renewLink(adminToken(), flurry.id);
    expect(renewed.ok).toBe(true);
    expect((await hat.lookup(old, phone("Flurry"))).ok).toBe(false);
    const fresh = renewed.path!.split("/p/")[1];
    expect(((await hat.lookup(fresh, phone("Flurry"))) as { state: string }).state).toBe("in");

    await hat.resetCode(adminToken(), flurry.id);
    expect(((await hat.lookup(fresh, phone("Flurry"))) as { state: string }).state).toBe("claim");
    const s = await hat.publicStatus((await hat.adminLookup(adminToken()))!.id);
    expect(s!.notices.map((n) => n.text).join(" ")).toMatch(/Flurry's code was reset/);
  });

  it("a parent's phone remembers the kids too", async () => {
    const view = await hat.adminView(adminToken());
    const p = await hat.myPage(tokenOf("Jingle"), phone("Jingle"));
    expect(p.alsoOnThisPhone).toEqual([]);
    // Jingle's phone unlocks Dasher's link (as a parent would for a child).
    await hat.unlock(tokenOf("Dasher"), phone("Jingle"), "1111");
    const again = await hat.myPage(tokenOf("Jingle"), phone("Jingle"));
    expect(again.alsoOnThisPhone.map((x) => x.name)).toEqual(["Dasher"]);
    expect(view!.people.find((x) => x.name === "Dasher")!.path).toBe(again.alsoOnThisPhone[0].path);
  });
});
