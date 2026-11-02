import { Hat } from "@/components/Hat";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center">
      <Hat slips={6} />
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl text-pine">The Family Hat</h1>
      <p className="mt-3 text-ink-soft">
        This drawing is by invitation. Open the private link you were sent to find your spot.
      </p>
    </main>
  );
}
