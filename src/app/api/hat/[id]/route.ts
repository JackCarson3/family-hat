import { NextResponse } from "next/server";
import { exchangeByPublicId, publicStatus } from "@/lib/hat";

export const dynamic = "force-dynamic";

/** Public hat status for polling. Names and progress only, never pairings. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ex = await exchangeByPublicId(id);
  if (!ex) return NextResponse.json({ error: "not found" }, { status: 404 });
  const status = await publicStatus(ex.id);
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
