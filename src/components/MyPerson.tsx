"use client";

import { useEffect, useState } from "react";
import { CLUE_LABELS } from "./clueLabels";

/** "My person": blurred until tapped, then re-blurs. Shows their Gift Clues. */
export function MyPerson({ name, clues }: { name: string; clues: Record<string, string> }) {
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(false), 10_000);
    return () => clearTimeout(t);
  }, [peek]);

  const entries = CLUE_LABELS.filter((c) => clues[c.key]);
  return (
    <section className="card p-5">
      <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-berry">My person</h2>
      <button
        type="button"
        onClick={() => setPeek((p) => !p)}
        className="mt-2 block w-full rounded-2xl bg-paper-2 py-4 text-center"
        aria-label={peek ? `Your person is ${name}. Tap to hide.` : "Tap to peek at your person"}
      >
        <span className={`block font-[family-name:var(--font-hand)] text-5xl text-berry transition ${peek ? "" : "peek-blur"}`}>
          {name}
        </span>
        <span className="mt-1 block text-sm font-bold text-ink-soft">{peek ? "Tap to hide" : "Tap to peek"}</span>
      </button>

      <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-pine">Their gift clues</h3>
      {entries.length === 0 ? (
        <p className="mt-1 text-ink-soft">No clues yet. Check back later. Sometimes the best gifts come without hints!</p>
      ) : (
        <dl className="mt-2 space-y-3">
          {entries.map((c) => (
            <div key={c.key}>
              <dt className="text-sm font-bold text-ink-soft">{c.label}</dt>
              <dd className="whitespace-pre-wrap text-lg">{clues[c.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
