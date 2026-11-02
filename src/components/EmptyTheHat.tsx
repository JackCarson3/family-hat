"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitSlipAction } from "@/app/actions";
import { celebrate } from "./DrawFlow";

function useSecondsLeft(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
}

/** Step 1 of Empty the hat: pick the name on your slip, privately checked. */
export function SlipEntry({
  token,
  others,
  deadline,
  slipIn,
  waitingOn,
}: {
  token: string;
  others: { id: string; name: string }[];
  deadline: string | null;
  slipIn: boolean;
  waitingOn: string[];
}) {
  const left = useSecondsLeft(deadline);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  if (slipIn) {
    return (
      <div className="card p-6 text-center">
        <p className="text-4xl" aria-hidden="true">📮</p>
        <p className="mt-2 text-xl font-extrabold">Your slip is in!</p>
        <p className="mt-1 text-ink-soft">
          {waitingOn.length ? `Waiting for ${waitingOn.join(", ")}…` : "Tipping the hat over…"}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-berry">Empty the hat</p>
      <p className={`mt-1 font-[family-name:var(--font-display)] text-5xl ${left <= 15 ? "text-berry" : "text-pine"}`} aria-live="off">
        {clock}
      </p>
      <h2 className="mt-2 text-xl font-extrabold">Who&apos;s on your slip?</h2>
      <p className="text-ink-soft">Tap the name. Don&apos;t say it out loud!</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {others.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setPicked(o.id);
              setError(null);
            }}
            className={`min-h-[52px] rounded-2xl border-2 px-3 text-lg font-bold transition ${
              picked === o.id ? "border-pine bg-pine text-white" : "border-transparent bg-paper-2"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 font-bold text-berry">{error}</p>}
      <button
        className="btn btn-berry mt-5 w-full"
        disabled={!picked || pending || left === 0}
        onClick={() =>
          start(async () => {
            const r = await submitSlipAction(token, picked!);
            if (r.ok) router.refresh();
            else setError(r.error ?? "That didn't work.");
          })
        }
      >
        {left === 0 ? "Time's up" : pending ? "Checking…" : "Drop my slip in"}
      </button>
    </div>
  );
}

/** Step 2: the hat tips over and every name tumbles out, shuffled. */
export function Tumble({ names }: { names: string[] }) {
  const order = useMemo(() => {
    const a = names.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [names]);
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const t = setTimeout(celebrate, 350 * order.length + 400);
    return () => clearTimeout(t);
  }, [order.length]);

  return (
    <section className="text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-berry">The hat is empty</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-3">
        {order.map((n, i) => (
          <li
            key={n}
            className="tumble rounded-md border border-[#e8dcc2] bg-slip px-4 py-2 shadow-md"
            style={{ animationDelay: `${i * 0.35}s`, ["--rot" as string]: `${((i * 37) % 30) - 15}deg` }}
          >
            <span className="font-[family-name:var(--font-hand)] text-3xl text-berry">{n}</span>
            <span className="ml-2 text-pine">✓</span>
          </li>
        ))}
      </ul>
      <p
        className="tumble mt-6 font-[family-name:var(--font-display)] text-2xl text-pine"
        style={{ animationDelay: `${order.length * 0.35 + 0.2}s`, ["--rot" as string]: "0deg" }}
      >
        Every name was drawn exactly once.
      </p>
    </section>
  );
}
