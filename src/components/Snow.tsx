/** A few gentle snowflakes. Fixed positions so server and client agree. */
const FLAKES = [
  { l: 6, d: 14, s: 12, delay: 0, drift: 20 },
  { l: 18, d: 19, s: 9, delay: 4, drift: -15 },
  { l: 31, d: 16, s: 14, delay: 8, drift: 25 },
  { l: 47, d: 22, s: 10, delay: 2, drift: -20 },
  { l: 59, d: 17, s: 12, delay: 11, drift: 15 },
  { l: 72, d: 20, s: 9, delay: 6, drift: -25 },
  { l: 84, d: 15, s: 13, delay: 9, drift: 18 },
  { l: 93, d: 21, s: 10, delay: 1, drift: -12 },
];

export function Snow() {
  return (
    <div aria-hidden="true">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="flake"
          style={{
            left: `${f.l}%`,
            fontSize: f.s,
            animationDuration: `${f.d}s`,
            animationDelay: `${f.delay}s`,
            ["--drift" as string]: `${f.drift}px`,
            opacity: 0.8,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
