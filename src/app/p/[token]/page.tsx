import { cookies } from "next/headers";
import { lookup, myPage, publicStatus } from "@/lib/hat";
import { Claim, CodeEntry } from "@/components/Claim";
import { ParticipantHome } from "@/components/ParticipantHome";
import { Snow } from "@/components/Snow";
import { Hat } from "@/components/Hat";

export const dynamic = "force-dynamic";

export default async function ParticipantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = (await cookies()).get("fh_device")?.value;
  const access = await lookup(token, secret);

  let body: React.ReactNode;
  if (!access.ok) {
    body = (
      <div className="flex flex-col items-center text-center">
        <Hat slips={0} />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-pine">This link isn&apos;t recognized</h1>
        <p className="mt-2 text-ink-soft">It may have been replaced with a new one. Please ask the organizer for your link.</p>
      </div>
    );
  } else if (access.state === "claim") {
    body = <Claim token={token} name={access.participant.name} hatName={access.exchange.name} />;
  } else if (access.state === "code" || access.state === "locked") {
    body = <CodeEntry token={token} name={access.participant.name} locked={access.state === "locked"} />;
  } else {
    const page = await myPage(token, secret!);
    const status = (await publicStatus(page.exchangeId))!;
    body = (
      <ParticipantHome
        initialStatus={status}
        data={{
          token,
          me: page.me,
          person: page.person,
          hasClues: Object.keys(page.myClues).length > 0,
          others: page.others,
          alsoOnThisPhone: page.alsoOnThisPhone,
        }}
      />
    );
  }

  return (
    <main className="relative mx-auto max-w-md px-4 pb-16 pt-6">
      <Snow />
      <div className="relative z-10">{body}</div>
    </main>
  );
}
