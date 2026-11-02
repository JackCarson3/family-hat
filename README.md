# Family Hat

A private Christmas name drawing for the Carson family, drawn together over FaceTime.

## Setup (once)

1. `node scripts/make-secrets.mjs` and paste `ENCRYPTION_KEY` and `HASH_SECRET` into Vercel's environment settings. Keep a private copy.
2. Add the Neon Postgres integration in Vercel; it sets `DATABASE_URL`.
3. `npm run db:migrate` to create the tables.
4. `npm run seed -- --base https://<your-app>.vercel.app` creates and seals both hats and writes every private link to `links.local.txt`.

## Development

- `npm run db:local` starts a local Postgres (PGlite) on port 5433. Put
  `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` in `.env.local`,
  then `npm run db:migrate` and `npm run seed -- --demo`.
- `npm run dev` runs the app locally.
- `npm test` runs the generator, secrecy and full-flow tests (no database needed).

## Practice hat

`npm run seed -- --base <url> --demo` makes a six-person practice hat with its own
admin link, written to `links.demo.local.txt`.

## How secrecy works

Links carry 128-bit random tokens; only keyed hashes are stored. Each pairing is
AES-256-GCM encrypted and bound to its giver and generation. Public and admin
pages never read the assignments table. See `src/lib/secrets.ts` and `src/lib/seal.ts`.
