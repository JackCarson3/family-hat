"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAction, drawAction } from "@/app/actions";
import { Hat } from "./Hat";
import { Slip } from "./Slip";

type Phase = "ready" | "shuffle" | "curtain" | "reveal";

export async function celebrate() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#a8262f", "#1f4a38", "#c9a24a", "#fffdf6"];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.45 }, colors, disableForReducedMotion: true });
    setTimeout(() => confetti({ particleCount: 50, spread: 110, origin: { y: 0.4 }, colors, disableForReducedMotion: true }), 250);
  } catch {
    /* confetti is a nicety */
  }
}

const FLYING = [
  { dx: "-120px", dy: "-140px", rot: "-260deg", delay: "0s" },
  { dx: "110px", dy: "-160px", rot: "300deg", delay: "0.15s" },
  { dx: "-60px", dy: "-190px", rot: "-180deg", delay: "0.3s" },
  { dx: "140px", dy: "-90px", rot: "220deg", delay: "0.45s" },
  { dx: "-150px", dy: "-70px", rot: "-320deg", delay: "0.6s" },
  { dx: "30px", dy: "-200px", rot: "160deg", delay: "0.75s" },
];

/**
 * The ceremony: Draw my name → shuffle → privacy curtain → reveal → Got it.
 * The name is fetched only at "Show my name", by a deliberate tap.
 */
export function DrawFlow({
  token,
  slipsLeft,
  initial,
  board,
}: {
  token: string;
  slipsLeft: number;
  initial?: { name: string; hatCode: string | null };
  board?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(initial ? "reveal" : "ready");
  const [drawn, setDrawn] = useState(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const go = () => {
    setPhase("shuffle");
    setTimeout(() => setPhase("curtain"), 2400);
  };

  if (phase === "ready" && board) {
    return (
      <div className="flex flex-col items-center">
        {board}
        <button className="btn btn-berry sticky bottom-4 z-20 mt-6 w-full text-xl" onClick={go}>
          🎩 Draw my name
        </button>
      </div>
    );
  }

  if (phase === "ready" || phase === "shuffle") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Hat slips={slipsLeft} shaking={phase === "shuffle"} />
          {phase === "shuffle" &&
            FLYING.map((f, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="swirl-slip absolute left-1/2 top-[22%] h-9 w-6 rounded-sm border border-[#e8dcc2] bg-slip"
                style={{ ["--dx" as string]: f.dx, ["--dy" as string]: f.dy, ["--rot" as string]: f.rot, animationDelay: f.delay }}
              />
            ))}
        </div>
        <p className="mt-5 text-xl font-extrabold" aria-live="polite">
          {phase === "shuffle" ? "Shuffling the slips…" : "It's your turn!"}
        </p>
        {phase === "ready" && (
          <button className="btn btn-berry mt-5 w-full text-xl" onClick={go}>
            🎩 Draw my name
          </button>
        )}
      </div>
    );
  }

  if (phase === "curtain") {
    return (
      <div className="flex flex-col items-center rounded-[20px] bg-pine p-7 text-center text-white shadow-[0_8px_24px_-12px_rgba(43,36,32,0.45)]">
        <p className="text-5xl" aria-hidden="true">🤫</p>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Got a slip!</h2>
        <p className="mt-3 text-lg text-white/90">Before you peek, make sure nobody can see your screen.</p>
        <p className="mt-1 text-base text-white/75">On FaceTime? Turn your screen away from anyone nearby.</p>
        {error && <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 font-bold">{error}</p>}
        <button
          className="btn mt-6 w-full bg-white text-pine shadow-[0_4px_0_rgba(0,0,0,0.25)]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await drawAction(token);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setDrawn({ name: r.person.name, hatCode: r.hatCode });
              setPhase("reveal");
              celebrate();
            })
          }
        >
          {pending ? "Unfolding…" : "I'm ready, show me"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-lg font-extrabold text-ink-soft">You drew…</p>
      <Slip name={drawn!.name} hatCode={drawn!.hatCode} className="unfold mt-3" />
      <p className="mt-6 font-[family-name:var(--font-hand)] text-3xl text-pine">Shh! Keep it secret.</p>
      <button
        className="btn btn-pine mt-5 w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await confirmAction(token);
            router.refresh();
          })
        }
      >
        {pending ? "Saving…" : "Got it! Fold it up"}
      </button>
      <p className="mt-3 text-sm text-ink-soft">You can always come back to this page to see your person again.</p>
    </div>
  );
}
