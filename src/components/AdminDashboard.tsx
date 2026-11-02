"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import {
  addMinuteAction,
  adminViewAction,
  openHatAction,
  renewLinkAction,
  resetCodeAction,
  resetHatAction,
  startEmptyingAction,
  stopEmptyingAction,
} from "@/app/actions";
import { HatBoard } from "./HatBoard";

type View = NonNullable<Awaited<ReturnType<typeof adminViewAction>>>;

const STAGE_HELP: Record<string, string> = {
  sealed: "Sealed and ready. Tap Open the hat when everyone is on the call.",
  open: "The hat is open. Call names one at a time.",
  drawn: "Everyone has drawn. Empty the hat to double-check.",
  emptying: "Everyone is entering the name on their slip.",
  emptied: "All done! Every name was drawn exactly once.",
};

export function AdminDashboard({ token, initial }: { token: string; initial: View }) {
  const { data, mutate } = useSWR(["admin", token], () => adminViewAction(token), {
    fallbackData: initial,
    refreshInterval: 3000,
  });
  const view = (data ?? initial) as View;
  const s = view.status;
  const [msg, setMsg] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [pending, start] = useTransition();
  const anyRevealed = view.people.some((p) => p.state !== "Waiting");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (ok ?? null) : (r.error ?? "That didn't work."));
      await mutate();
    });

  const share = async (name: string, path: string) => {
    const url = `${window.location.origin}${path}`;
    const text = `${name}, here's your private link for the family name drawing. Please don't share it: ${url}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(url);
        setMsg(`Copied ${name}'s link.`);
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-berry/10 px-4 py-2 text-center text-sm font-bold text-berry">
        Organizer page. Keep this link to yourself.
      </p>
      <HatBoard status={s} />

      <section className="card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-pine">Run the drawing</h2>
        <p className="mt-1 text-ink-soft">{STAGE_HELP[s.stage]}</p>
        <div className="mt-4 flex flex-col gap-3">
          {s.stage === "sealed" && (
            <button className="btn btn-berry" disabled={pending} onClick={() => run(() => openHatAction(token), "The hat is open!")}>
              🎩 Open the hat
            </button>
          )}
          {(s.stage === "drawn" || (s.stage === "open" && s.drawnCount === s.total)) && (
            <button className="btn btn-pine" disabled={pending} onClick={() => run(() => startEmptyingAction(token))}>
              📮 Empty the hat (2 minutes)
            </button>
          )}
          {s.stage === "emptying" && (
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-pine" disabled={pending} onClick={() => run(() => addMinuteAction(token))}>
                +1 minute
              </button>
              <button className="btn btn-ghost" disabled={pending} onClick={() => run(() => stopEmptyingAction(token))}>
                Stop
              </button>
            </div>
          )}
        </div>
        {msg && <p className="mt-3 font-bold text-pine">{msg}</p>}
      </section>

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 font-[family-name:var(--font-display)] text-2xl text-pine">Everyone</h2>
        <p className="px-5 text-sm text-ink-soft">You see progress only. Nobody&apos;s person is ever shown here.</p>
        <ul className="mt-3 divide-y divide-ink/10">
          {view.people.map((p) => (
            <li key={p.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold">{p.name}</p>
                  <p className="text-sm text-ink-soft">
                    {p.claimed ? "Opened" : "Not opened yet"} · {p.clues ? "Clues ✓" : "No clues"} ·{" "}
                    <span className={p.state === "Confirmed" ? "font-bold text-pine" : ""}>{p.state}</span>
                    {s.stage === "emptying" || s.stage === "emptied" ? ` · ${p.slipIn ? "Slip in ✓" : "Slip pending"}` : ""}
                  </p>
                </div>
                <button className="btn btn-pine min-h-[44px] px-4 text-base" onClick={() => share(p.name, p.path)}>
                  Send link
                </button>
              </div>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-bold text-ink-soft">Fix a problem</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="btn btn-ghost min-h-[40px] px-3 text-sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Make a new link for ${p.name}? Their old link stops working, and the family sees a note.`))
                        run(() => renewLinkAction(token, p.id), `${p.name} has a new link. Tap Send link.`);
                    }}
                  >
                    Lost link: make a new one
                  </button>
                  <button
                    className="btn btn-ghost min-h-[40px] px-3 text-sm"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Reset ${p.name}'s code? They'll pick a new one, and the family sees a note.`))
                        run(() => resetCodeAction(token, p.id), `${p.name}'s code was reset.`);
                    }}
                  >
                    Forgot code: reset it
                  </button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-berry">Refill the hat</h2>
        <p className="mt-1 text-ink-soft">
          {anyRevealed
            ? "Someone has already seen their name. Refilling means everyone draws again."
            : "Nobody has peeked yet, so this is safe."}
        </p>
        {!showReset ? (
          <button className="btn btn-ghost mt-3 w-full" onClick={() => setShowReset(true)}>
            Refill the hat…
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            {anyRevealed && (
              <input className="field" placeholder="Type RESET to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} />
            )}
            <button
              className="btn btn-berry w-full"
              disabled={pending || (anyRevealed && typed.trim().toUpperCase() !== "RESET")}
              onClick={() => {
                run(() => resetHatAction(token, typed), "The hat was refilled with a new hat code.");
                setShowReset(false);
                setTyped("");
              }}
            >
              Refill now
            </button>
          </div>
        )}
      </section>

      <p className="text-center text-sm text-ink-soft">
        Family view to screen-share:{" "}
        <a className="font-bold underline" href={`/h/${s.publicId}`} target="_blank">
          open
        </a>
      </p>
    </div>
  );
}
