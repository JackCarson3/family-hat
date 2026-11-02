import type { Metadata, Viewport } from "next";
import { Caveat, Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "800"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600", "700"] });

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
      <body className={`${fraunces.variable} ${nunito.variable} ${caveat.variable} antialiased`}>
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
