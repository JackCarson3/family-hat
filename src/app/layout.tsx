import type { Metadata, Viewport } from "next";
// Fonts are bundled with the app (no download from Google at build time).
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/800.css";
import "@fontsource/caveat/600.css";
import "@fontsource/caveat/700.css";
import "./globals.css";

// Deliberately generic: link previews in Messages show only this.
export const metadata: Metadata = {
  title: "The Family Hat",
  description: "You're invited to the family name drawing.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { title: "The Family Hat", description: "You're invited to the family name drawing." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a8262f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="lights" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        {children}
      </body>
    </html>
  );
}
