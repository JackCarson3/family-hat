"use client";

import { useState, useTransition } from "react";
import { setupAction } from "./actions";

type Result = Awaited<ReturnType<typeof setupAction>>;

export function SetupForm({ setupKey }: { setupKey: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const go = (which: "family" | "practice") =>
    start(async () => {
      setResult(await setupAction(setupKey, which));
    });

  return (
    <div className="mt-6 space-y-6">
      <p className="text-ink-soft">Start with the practice hat. Make the real family hats when you&apos;re happy with it.</p>
      <div className="space-y-3">
        <button className="btn btn-pine w-full" disabled={pending} onClick={() => go("practice")}>
          {pending ? "Working…" : "Make the practice hat"}
        </button>
        <button className="btn btn-berry w-full" disabled={pending} onClick={() => go("family")}>
          {pending ? "Working…" : "Make the real family hats"}
        </button>
      </div>
      {result && !result.ok && <p className="card p-5 font-bold text-berry">{result.error}</p>}
      {result?.ok && (
        <>
          <p className="rounded-xl bg-berry/10 px-4 py-3 font-bold text-berry">
            Bookmark your organizer links now. This page shows them only once. Everyone&apos;s private link is on the organizer page.
          </p>
          {result.hats.map((h) => (
            <section key={h.name} className="card p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl text-pine">{h.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">Hat code {h.hatCode}</p>
              <p className="mt-3 font-bold">Your organizer link (keep private):</p>
              <a className="break-all text-pine underline" href={h.adminLink} target="_blank">
                {h.adminLink}
              </a>
              <p className="mt-3 font-bold">Family view (safe to share):</p>
              <a className="break-all text-pine underline" href={h.familyLink} target="_blank">
                {h.familyLink}
              </a>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
