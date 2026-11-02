/** A paper name slip with a handwritten name. */
export function Slip({ name, hatCode, className = "", style }: { name: string; hatCode?: string | null; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-xs rounded-md border border-[#e8dcc2] bg-slip px-6 pb-4 pt-7 text-center shadow-[0_10px_30px_-12px_rgba(43,36,32,0.45)] ${className}`}
      style={{
        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, rgba(201,180,138,0.35) 31px 32px)",
        ...style,
      }}
    >
      <span className="absolute left-1/2 top-0 h-3 w-16 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] rounded-sm bg-gold/60" aria-hidden="true" />
      <p className="font-[family-name:var(--font-hand)] text-6xl leading-tight text-berry">{name}</p>
      {hatCode && <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Hat code · {hatCode}</p>}
    </div>
  );
}
