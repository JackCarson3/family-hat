import { headers } from "next/headers";
import { demoHats, FAMILY_NAME, hats } from "@/config/family";
import { getDb } from "@/db";
import { createHat, type CreatedHat } from "@/lib/setup";

async function migrateDb() {
  const url = process.env.DATABASE_URL ?? "";
  const db = await getDb();
  if (/neon\.tech/.test(url)) {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as never, { migrationsFolder: "./drizzle" });
  }
}

export async function runSetup(which: "family" | "practice"): Promise<{ ok: true; hats: CreatedHat[] } | { ok: false; error: string }> {
  try {
    await migrateDb();
    const h = await headers();
    const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const made: CreatedHat[] = [];
    for (const hat of which === "family" ? hats : demoHats) made.push(await createHat(hat, FAMILY_NAME, base));
    return { ok: true, hats: made };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Setup failed." };
  }
}
