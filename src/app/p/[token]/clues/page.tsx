import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lookup, myPage } from "@/lib/hat";
import { CluesForm } from "@/components/CluesForm";

export const dynamic = "force-dynamic";

export default async function CluesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = (await cookies()).get("fh_device")?.value;
  const access = await lookup(token, secret);
  if (!access.ok || access.state !== "in") redirect(`/p/${token}`);
  const page = await myPage(token, secret!);
  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-6">
      <CluesForm token={token} name={page.me.name} initial={page.myClues} />
    </main>
  );
}
