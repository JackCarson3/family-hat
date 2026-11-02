/** The family hat: an upturned green top hat with paper slips peeking out. */

const SLIPS = [
  { x: 96, r: -14, h: 44 },
  { x: 132, r: 10, h: 50 },
  { x: 112, r: -3, h: 56 },
  { x: 78, r: -24, h: 36 },
  { x: 150, r: 22, h: 38 },
  { x: 122, r: 16, h: 42 },
  { x: 104, r: -9, h: 48 },
  { x: 140, r: -6, h: 34 },
];

export function Hat({ slips, shaking = false, className = "" }: { slips: number; shaking?: boolean; className?: string }) {
  const shown = SLIPS.slice(0, Math.max(0, Math.min(slips, SLIPS.length)));
  return (
    <svg
      viewBox="0 0 240 220"
      className={`w-56 max-w-full drop-shadow-[0_14px_14px_rgba(43,36,32,0.22)] ${shaking ? "shake" : ""} ${className}`}
      role="img"
      aria-label={slips === 1 ? "The hat, with one slip left" : `The hat, with ${slips} slips left`}
    >
      {/* crown */}
      <path d="M60 70 L70 194 Q120 212 170 194 L180 70 Z" fill="#1f4a38" />
      <path d="M60 70 L70 194 Q82 199 96 202 L90 70 Z" fill="#2a5e48" opacity="0.7" />
      {/* band */}
      <path d="M62 88 L178 88 L176 114 L64 114 Z" fill="#a8262f" />
      <path d="M62 88 L178 88 L178 93 L62 93 Z" fill="#c63a43" />
      {/* holly */}
      <g transform="translate(78 101)">
        <path d="M0 0 C-6 -10 -18 -10 -24 -4 C-18 -2 -16 4 -20 8 C-10 10 -4 6 0 0Z" fill="#2f7a4f" />
        <path d="M0 0 C6 -10 18 -12 24 -6 C18 -3 18 3 22 7 C12 10 4 6 0 0Z" fill="#3a8c5c" />
        <circle cx="-3" cy="-3" r="5" fill="#d8323c" />
        <circle cx="5" cy="-1" r="5" fill="#c02a33" />
        <circle cx="1" cy="5" r="5" fill="#e0484f" />
      </g>
      {/* brim and opening */}
      <ellipse cx="120" cy="68" rx="100" ry="22" fill="#163628" />
      <ellipse cx="120" cy="66" rx="62" ry="13" fill="#0c1f17" />
      {/* slips */}
      {shown.map((s, i) => (
        <g key={i} transform={`rotate(${s.r} ${s.x} 70)`}>
          <rect x={s.x - 11} y={70 - s.h} width="22" height={s.h + 6} rx="2" fill="#fffdf6" stroke="#e8dcc2" />
          <path d={`M${s.x - 6} ${78 - s.h} h12 M${s.x - 6} ${84 - s.h} h9`} stroke="#c9b48a" strokeWidth="1.5" />
        </g>
      ))}
      {/* front lip of the brim, over the slips */}
      <path d="M20 68 A100 22 0 0 0 220 68 L182 67 A62 13 0 0 1 58 67 Z" fill="#163628" />
      <path d="M30 74 A100 22 0 0 0 210 74" stroke="#2a5e48" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}
