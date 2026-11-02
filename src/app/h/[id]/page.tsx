import { notFound } from "next/navigation";
import { exchangeByPublicId, publicStatus } from "@/lib/hat";
import { FamilyView } from "@/components/FamilyView";
import { Snow } from "@/components/Snow";

export const dynamic = "force-dynamic";

/** Shared family view: the hat and progress, nothing private. */
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ex = await exchangeByPublicId(id);
  if (!ex) notFound();
  const status = (await publicStatus(ex.id))!;
  return (
    <main className="relative mx-auto max-w-md px-4 pb-16 pt-6">
      <Snow />
      <div className="relative z-10">
        <FamilyView initial={status} />
      </div>
    </main>
  );
}
