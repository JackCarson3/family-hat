"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimAction, unlockAction } from "@/app/actions";
import { Hat } from "./Hat";

function CodeInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={4}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      aria-label="4-digit code"
      className="field mx-auto block w-48 text-center font-[family-name:var(--font-display)] text-4xl tracking-[0.5em]"
      placeholder="••••"
    />
  );
}

/** First visit: "Is this you?" then choose a code. */
export function Claim({ token, name, hatName }: { token: string; name: string; hatName: string }) {
  const [step, setStep] = useState<"ask" | "code" | "notme">("ask");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (step === "notme") {
    return (
      <div className="card p-6 text-center">
        <p className="text-xl font-extrabold">Oops! Wrong spot.</p>
        <p className="mt-2 text-ink-soft">Please close this page and let the organizer know. Nothing has been changed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <Hat slips={5} />
      <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.18em] text-berry">{hatName}</p>
      {step === "ask" ? (
        <>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-pine">Hi, {name}!</h1>
          <p className="mt-2 text-xl">Is this you?</p>
          <div className="mt-6 flex w-full flex-col gap-3">
            <button className="btn btn-berry w-full" onClick={() => setStep("code")}>
              Yes, that&apos;s me
            </button>
            <button className="btn btn-ghost w-full" onClick={() => setStep("notme")}>
              No, this isn&apos;t me
            </button>
          </div>
        </>
      ) : (
        <form
          className="mt-4 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await claimAction(token, code);
              if (r.ok) router.refresh();
              else setError(r.error ?? "Something went wrong.");
            });
          }}
        >
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-pine">Pick a secret code</h1>
          <p className="mx-auto mt-2 max-w-xs text-ink-soft">
            Choose 4 numbers you&apos;ll remember. You&apos;ll only need it if you open this on another phone or computer.
          </p>
          <div className="mt-5">
            <CodeInput value={code} onChange={setCode} autoFocus />
          </div>
          {error && <p className="mt-3 font-bold text-berry">{error}</p>}
          <button className="btn btn-berry mt-6 w-full" disabled={code.length !== 4 || pending}>
            {pending ? "Saving…" : "Save my spot"}
          </button>
        </form>
      )}
    </div>
  );
}

/** Claimed already, but this device is new: enter the code. */
export function CodeEntry({ token, name, locked }: { token: string; name: string; locked?: boolean }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(locked ? "Too many tries. Please wait 15 minutes, or ask the organizer." : null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex flex-col items-center text-center"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await unlockAction(token, code);
          if (r.ok) router.refresh();
          else {
            setError(r.error ?? "That didn't work.");
            setCode("");
          }
        });
      }}
    >
      <Hat slips={4} />
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-pine">Welcome back, {name}</h1>
      <p className="mt-2 max-w-xs text-ink-soft">This looks like a new phone or computer. Enter the 4-digit code you picked.</p>
      <div className="mt-5">
        <CodeInput value={code} onChange={setCode} autoFocus />
      </div>
      {error && <p className="mt-3 font-bold text-berry">{error}</p>}
      <button className="btn btn-berry mt-6 w-full" disabled={code.length !== 4 || pending}>
        {pending ? "Checking…" : "Open my page"}
      </button>
      <p className="mt-4 text-sm text-ink-soft">Forgot it? The organizer can reset it for you.</p>
      <p className="mt-1 text-sm text-ink-soft">Not {name}? Please close this page.</p>
    </form>
  );
}
