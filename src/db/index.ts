import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

/**
 * - Neon URL (production on Vercel): Neon's HTTP driver.
 * - Any other postgres:// URL (local server): node-postgres.
 * - pglite:memory (tests only): real Postgres in-process, migrated on start.
 */
const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url === "pglite:memory") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const d = drizzle(new PGlite(), { schema });
    await migrate(d, { migrationsFolder: "./drizzle" });
    return d as unknown as DB; // same query API for everything this app uses
  }
  if (/neon\.tech/.test(url)) return drizzleNeon(neon(url), { schema });
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return drizzle(new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 300 }), { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__db) globalForDb.__db = connect();
  return globalForDb.__db;
}

export { schema };
