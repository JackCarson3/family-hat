import { adminView } from "@/lib/hat";
import { AdminDashboard } from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await adminView(token);
  if (!view) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-pine">Organizer link not recognized</h1>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <AdminDashboard token={token} initial={view} />
    </main>
  );
}
