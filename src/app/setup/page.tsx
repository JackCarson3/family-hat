import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

/**
 * One-time setup from the browser: creates the tables and the hats, then shows
 * the organizer links once. Protected by SETUP_KEY (set in Vercel). Creating a
 * hat that already exists is refused, so pressing a button twice changes nothing.
 */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const expected = process.env.SETUP_KEY;
  const ok = !!expected && !!key && key === expected;
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-pine">{ok ? "Set up the hats" : "Setup is locked"}</h1>
      {ok ? <SetupForm setupKey={key!} /> : <p className="mt-2 text-ink-soft">Open the setup link from the instructions.</p>}
    </main>
  );
}
