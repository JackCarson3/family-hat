"use client";

import useSWR from "swr";
import type { PublicStatus } from "@/lib/hat";
import { HatBoard } from "./HatBoard";
import { Tumble } from "./EmptyTheHat";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function FamilyView({ initial }: { initial: PublicStatus }) {
  const { data } = useSWR<PublicStatus>(`/api/hat/${initial.publicId}`, fetcher, { fallbackData: initial, refreshInterval: 3000 });
  const s = data ?? initial;
  return (
    <div className="space-y-8">
      <HatBoard status={s} />
      {s.stage === "emptied" && <Tumble names={s.people.map((p) => p.name)} />}
    </div>
  );
}
