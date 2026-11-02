"use client";

import type { PublicStatus } from "@/lib/hat";
import { Hat } from "./Hat";

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function stageLine(s: PublicStatus): string {
  switch (s.stage) {
    case "setup":
    case "sealed":
      return "The hat is sealed. It opens on drawing night.";
    case "open":
      return s.drawnCount === 0 ? "The hat is open! Who's first?" : `${s.drawnCount} of ${s.total} have drawn`;
    case "drawn":
      return `All ${s.total} names drawn!`;
    case "emptying":
      return `Emptying the hat: ${s.slipsIn} of ${s.total} slips are in`;
    case "emptied":
      return "The hat is empty!";
  }
}

/** The shared hat: the same on every phone. Names and progress only. */
export function HatBoard({ status, shaking, me }: { status: PublicStatus; shaking?: boolean; me?: string }) {
  const remaining = status.stage === "sealed" ? status.total : status.total - status.drawnCount;
  const days = daysUntil(status.giftDate);
  return (
    <section className="flex flex-col items-center text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-berry">{status.familyName}</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-pine">{status.name}</h1>
      <Hat slips={status.stage === "emptied" ? 0 : remaining} shaking={shaking} className="mt-4" />
      <p className="mt-3 text-lg font-extrabold text-ink" aria-live="polite">
        {stageLine(status)}
      </p>
      {status.stage !== "sealed" && status.stage !== "setup" && (
        <div
          className="mt-3 h-3 w-full max-w-xs overflow-hidden rounded-full bg-paper-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={status.total}
          aria-valuenow={status.stage === "emptying" || status.stage === "emptied" ? status.slipsIn : status.drawnCount}
        >
          <div
            className="h-full rounded-full bg-pine transition-all duration-700"
            style={{
              width: `${(100 * (status.stage === "emptying" || status.stage === "emptied" ? status.slipsIn : status.drawnCount)) / Math.max(1, status.total)}%`,
            }}
          />
        </div>
      )}

      <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Who has drawn">
        {status.people.map((p) => {
          const done = status.stage === "emptying" ? p.slipIn : p.drawn;
          return (
            <li
              key={p.name}
              className={`rounded-full px-3.5 py-1.5 text-base font-bold transition-colors ${
                done ? "bg-pine text-white" : "bg-paper-2 text-ink-soft"
              } ${p.name === me ? "ring-2 ring-gold ring-offset-2 ring-offset-paper" : ""}`}
            >
              {done ? "✓ " : ""}
              {p.name}
            </li>
          );
        })}
      </ul>

      {status.message && (
        <p className="mt-6 max-w-sm font-[family-name:var(--font-hand)] text-2xl leading-snug text-ink">“{status.message}”</p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-base text-ink-soft">
        {days !== null && days >= 0 && <span>🎄 {days === 0 ? "Christmas is today!" : `${days} days until Christmas`}</span>}
        {status.budget && <span>🎁 Spend about {status.budget}</span>}
      </div>
      {status.hatCode && (
        <p className="mt-3 text-sm text-ink-soft">
          Hat code <span className="font-extrabold tracking-wide text-ink">{status.hatCode}</span>
        </p>
      )}
      {status.notices.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-soft">
          {status.notices.slice(0, 3).map((n) => (
            <li key={n.at}>📣 {n.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
