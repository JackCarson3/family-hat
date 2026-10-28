/**
 * Creates both hats from src/config/family.ts, seals them, and writes every
 * private link to links.local.txt (git-ignored) for Jack to share.
 *
 *   npm run seed -- --base https://your-app.vercel.app
 *
 * Refuses to run if a hat with the same slug already exists.
 */
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hats, FAMILY_NAME } from "../src/config/family";
import { encrypt, hashToken, inviteContext, newToken } from "../src/lib/secrets";
import { sealHat } from "../src/lib/seal";

const { exchanges, participants, exclusions } = schema;

async function main() {
  const baseArg = process.argv.indexOf("--base");
  const base = (baseArg > 0 ? process.argv[baseArg + 1] : "http://localhost:3000").replace(/\/$/, "");
  const d = db();
  const lines: string[] = [`${FAMILY_NAME} drawing links`, `Generated ${new Date().toISOString()}`, ""];

  for (const hat of hats) {
    const existing = await d.select().from(exchanges).where(eq(exchanges.slug, hat.slug));
    if (existing.length) throw new Error(`Hat "${hat.slug}" already exists. Nothing was changed.`);

    const adminToken = newToken();
    const [exchange] = await d
      .insert(exchanges)
      .values({
        slug: hat.slug,
        name: hat.name,
        familyName: FAMILY_NAME,
        budget: hat.budget,
        giftDate: hat.giftDate,
        message: hat.message,
        adminTokenHash: hashToken(adminToken),
      })
      .returning();

    lines.push(`== ${hat.name} ==`, `ADMIN (Jack only): ${base}/admin/${adminToken}`, "");

    const idByKey = new Map<string, string>();
    let order = 0;
    for (const house of hat.households) {
      for (const m of house.members) {
        const token = newToken();
        const [p] = await d
          .insert(participants)
          .values({
            exchangeId: exchange.id,
            key: m.id,
            name: m.name,
            household: house.name,
            sortOrder: order++,
            inviteTokenHash: hashToken(token),
            inviteTokenSealed: "pending",
          })
          .returning();
        await d
          .update(participants)
          .set({ inviteTokenSealed: encrypt(token, inviteContext(p.id)) })
          .where(eq(participants.id, p.id));
        idByKey.set(m.id, p.id);
        lines.push(`${m.name.padEnd(10)} ${base}/p/${token}`);
      }
    }

    const rules = hat.households.flatMap((h) =>
      h.members.flatMap((a) =>
        h.members.filter((b) => b.id !== a.id).map((b) => ({
          exchangeId: exchange.id,
          fromId: idByKey.get(a.id)!,
          toId: idByKey.get(b.id)!,
          source: "household",
        })),
      ),
    );
    if (rules.length) await d.insert(exclusions).values(rules);

    const sealed = await sealHat(exchange.id);
    if (!sealed.ok) throw new Error(`${hat.name}: ${sealed.reason}`);
    lines.push("", `Hat code: ${sealed.hatCode}`, "");
    console.log(`${hat.name}: sealed, hat code ${sealed.hatCode}`);
  }

  writeFileSync("links.local.txt", lines.join("\n") + "\n", { mode: 0o600 });
  console.log("Links written to links.local.txt (keep this file private).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
