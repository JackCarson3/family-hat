// Prints the two secret values to paste into Vercel's environment settings.
//   node scripts/make-secrets.mjs
import { randomBytes } from "node:crypto";

console.log(`ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`);
console.log(`HASH_SECRET=${randomBytes(32).toString("base64")}`);
console.log("\nPaste both into Vercel > Project > Settings > Environment Variables.");
console.log("Keep them somewhere safe: without ENCRYPTION_KEY the sealed hats can't be opened.");
