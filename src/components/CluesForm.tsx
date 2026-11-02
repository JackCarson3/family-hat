"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCluesAction } from "@/app/actions";
import { CLUE_LABELS } from "./clueLabels";

export function CluesForm({ token, name, initial }: { token: string; name: string; initial: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveCluesAction(token, values);
          setSaved(true);
          router.push(`/p/${token}`);
          router.refresh();
        });
      }}
    >
      <Link href={`/p/${token}`} className="text-base font-bold text-ink-soft">
        ← Back to the hat
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-pine">{name}&apos;s gift clues</h1>
      <p className="mt-2 text-ink-soft">
        Only the person who draws you will see these. Fill in as many or as few as you like. Clues, not a shopping list.
      </p>
      <div className="mt-6 space-y-5">
        {CLUE_LABELS.map((c) => (
          <label key={c.key} className="block">
            <span className="text-lg font-bold">{c.label}</span>
            <textarea
              className="field mt-1.5 min-h-[76px] resize-y"
              placeholder={c.hint}
              maxLength={500}
              value={values[c.key] ?? ""}
              onChange={(e) => {
                setSaved(false);
                setValues({ ...values, [c.key]: e.target.value });
              }}
            />
          </label>
        ))}
      </div>
      <button className="btn btn-berry sticky bottom-4 mt-8 w-full" disabled={pending}>
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save my clues"}
      </button>
    </form>
  );
}
