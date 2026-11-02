"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import type { PublicStatus } from "@/lib/hat";
import { HatBoard } from "./HatBoard";
import { DrawFlow } from "./DrawFlow";
import { MyPerson } from "./MyPerson";
import { SlipEntry, Tumble } from "./EmptyTheHat";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export type HomeData = {
  token: string;
  me: { name: string; revealed: boolean; confirmed: boolean; slipIn: boolean };
  person: { name: string; clues: Record<string, string> } | null;
  hasClues: boolean;
  others: { id: string; name: string }[];
  alsoOnThisPhone: { name: string; hat: string; path: string }[];
};

export function ParticipantHome({ data, initialStatus }: { data: HomeData; initialStatus: PublicStatus }) {
  const { data: status } = useSWR<PublicStatus>(`/api/hat/${initialStatus.publicId}`, fetcher, {
    fallbackData: initialStatus,
    refreshInterval: 3000,
  });
  const s = status ?? initialStatus;
  const router = useRouter();

  // Shake every hat the moment the organizer opens it.
  const lastStage = useRef(s.stage);
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (lastStage.current === "sealed" && s.stage === "open") {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 1900);
      return () => clearTimeout(t);
    }
    // A reset elsewhere: reload my private state.
    if (lastStage.current !== s.stage && s.stage === "sealed") router.refresh();
    lastStage.current = s.stage;
  }, [s.stage, router]);

  const canDraw = s.stage === "open" || s.stage === "drawn";
  const slipsLeft = s.total - s.drawnCount;

  let action: React.ReactNode = null;
  if (s.stage === "emptying") {
    action = (
      <SlipEntry
        token={data.token}
        others={data.others}
        deadline={s.emptyDeadline}
        slipIn={data.me.slipIn}
        waitingOn={s.people.filter((p) => !p.slipIn).map((p) => p.name)}
      />
    );
  } else if (s.stage === "emptied") {
    action = <Tumble names={s.people.map((p) => p.name)} />;
  } else if (canDraw && !data.me.confirmed) {
    action = (
      <DrawFlow
        token={data.token}
        slipsLeft={slipsLeft}
        initial={data.me.revealed && data.person ? { name: data.person.name, hatCode: s.hatCode } : undefined}
        board={<HatBoard status={s} shaking={shaking} me={data.me.name} />}
      />
    );
  }

  const showBoard = !(canDraw && !data.me.confirmed);

  return (
    <div className="space-y-6">
      {/* While emptying the hat, the timer and buttons come first so they're on screen. */}
      {(s.stage === "emptying" || s.stage === "emptied") && action}
      {s.stage === "emptying" && !data.me.slipIn && data.person && (
        <MyPerson name={data.person.name} clues={{}} />
      )}
      {showBoard && <HatBoard status={s} shaking={shaking} me={data.me.name} />}
      {s.stage !== "emptying" && s.stage !== "emptied" && action}
      {s.stage === "sealed" && (
        <div className="card p-5 text-center">
          <p className="text-lg font-extrabold">Hi, {data.me.name}! You&apos;re all set.</p>
          <p className="mt-1 text-ink-soft">On drawing night, keep this page open. When the hat opens, you&apos;ll get a big red button.</p>
        </div>
      )}

      {data.me.confirmed && data.person && s.stage !== "emptying" && <MyPerson name={data.person.name} clues={data.person.clues} />}

      {showBoard && (
      <section className="card p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-pine">My gift clues</h2>
        <p className="mt-1 text-ink-soft">
          {data.hasClues
            ? "Thanks! Your Santa can see your clues. Change them anytime."
            : "Leave a few hints for whoever draws you. Clues, not a shopping list. Leave room to be surprised!"}
        </p>
        <Link href={`/p/${data.token}/clues`} className="btn btn-pine mt-4 w-full">
          {data.hasClues ? "Edit my clues" : "Write my clues"}
        </Link>
      </section>
      )}

      {data.alsoOnThisPhone.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-berry">Also on this phone</h2>
          <ul className="mt-3 space-y-2">
            {data.alsoOnThisPhone.map((o) => (
              <li key={o.path}>
                <Link href={o.path} className="btn btn-ghost w-full justify-between">
                  <span>{o.name}</span>
                  <span className="text-sm font-semibold">{o.hat} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
