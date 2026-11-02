import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { HatConfig } from "@/config/family";
import { encrypt, hashToken, inviteContext, newToken } from "./secrets";
import { sealHat } from "./seal";

const { exchanges, participants, exclusions } = schema;

export type CreatedHat = {
  name: string;
  adminLink: string;
  familyLink: string;
  hatCode: string;
  links: { name: string; link: string }[];
};

/** Create one hat from config, add its household rules, and seal it. */
export async function createHat(hat: HatConfig, familyName: string, base: string): Promise<CreatedHat> {
  const d = await getDb();
  const existing = await d.select({ id: exchanges.id }).from(exchanges).where(eq(exchanges.slug, hat.slug));
  if (existing.length) throw new Error(`Hat "${hat.slug}" already exists. Nothing was changed.`);

  const adminToken = newToken();
  const [exchange] = await d
    .insert(exchanges)
    .values({
      slug: hat.slug,
      publicId: newToken().slice(0, 12),
      name: hat.name,
      familyName,
      budget: hat.budget,
      giftDate: hat.giftDate,
      message: hat.message,
      adminTokenHash: hashToken(adminToken),
    })
    .returning();

  const links: CreatedHat["links"] = [];
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
      links.push({ name: m.name, link: `${base}/p/${token}` });
    }
  }

  const rules = hat.households.flatMap((h) =>
    h.members.flatMap((a) =>
      h.members
        .filter((b) => b.id !== a.id)
        .map((b) => ({ exchangeId: exchange.id, fromId: idByKey.get(a.id)!, toId: idByKey.get(b.id)!, source: "household" })),
    ),
  );
  if (rules.length) await d.insert(exclusions).values(rules);

  const sealed = await sealHat(exchange.id);
  if (!sealed.ok) throw new Error(`${hat.name}: ${sealed.reason}`);

  return {
    name: hat.name,
    adminLink: `${base}/admin/${adminToken}`,
    familyLink: `${base}/h/${exchange.publicId}`,
    hatCode: sealed.hatCode,
    links,
  };
}
