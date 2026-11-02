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

/** Vercel's Neon integration may use a prefix or the POSTGRES_URL name; accept any of them. */
export function databaseUrl(): string | undefined {
  const env = process.env;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const key = Object.keys(env).find((k) => /_(DATABASE|POSTGRES)_URL$/.test(k) && env[k]);
  return key ? env[key] : undefined;
}

async function connect(): Promise<DB> {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      "The database isn't connected yet. In Vercel, connect the Neon database to this project, then redeploy.",
    );
  }
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
