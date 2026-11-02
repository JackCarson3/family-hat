/**
 * Creates hats from src/config/family.ts, seals them, and writes every private
 * link to a git-ignored file for Jack to share.
 *
 *   npm run seed -- --base https://your-app.vercel.app            (real family)
 *   npm run seed -- --base https://your-app.vercel.app --demo     (practice hat)
 *
 * Refuses to touch a hat that already exists.
 */
import { writeFileSync } from "node:fs";
import { hats, demoHats, FAMILY_NAME } from "../src/config/family";
import { createHat } from "../src/lib/setup";

async function main() {
  const baseArg = process.argv.indexOf("--base");
  const base = (baseArg > 0 ? process.argv[baseArg + 1] : "http://localhost:3000").replace(/\/$/, "");
  const demo = process.argv.includes("--demo");
  const which = demo ? demoHats : hats;
  const out = demo ? "links.demo.local.txt" : "links.local.txt";

  const lines: string[] = [`${FAMILY_NAME} drawing links${demo ? " (PRACTICE)" : ""}`, `Generated ${new Date().toISOString()}`, ""];
  for (const hat of which) {
    const made = await createHat(hat, FAMILY_NAME, base);
    lines.push(
      `== ${made.name} ==`,
      `Hat code: ${made.hatCode}`,
      `ADMIN (Jack only): ${made.adminLink}`,
      `Family view (safe to share): ${made.familyLink}`,
      "",
      ...made.links.map((l) => `${l.name.padEnd(10)} ${l.link}`),
      "",
    );
    console.log(`${made.name}: sealed, hat code ${made.hatCode}`);
  }
  writeFileSync(out, lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`Links written to ${out} (keep this file private).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
