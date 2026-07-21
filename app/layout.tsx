import type { Metadata, Viewport } from "next";
import { Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Site-wide primary font — headings, body, buttons, HUD/score numbers all
// read var(--font-primary) via the --font-d/--font-b/--font-m role
// variables in globals.css, so this one family covers every text role.
// Variable weight (400-800) matches the full range the design calls for,
// from Space Mono-replacement HUD digits (400/700) up to the heaviest
// display headings (800), without shipping a separate static file per
// weight.
const syne = Syne({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-primary",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CRUSH — Roll. Smash. Rampage.",
  description: "Parasites climb. You are heavy. Do the math.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The font-variable class goes on <html>, not <body>: globals.css reads
  // --font-primary inside a `:root { --font-d: var(--font-primary)... }`
  // block, and :root *is* <html>. Custom properties only flow to
  // descendants of wherever they're declared — putting the class on <body>
  // instead left --font-primary invisible at :root, which made
  // --font-d/--font-b/--font-m compute as invalid everywhere and silently
  // fall back to the browser's default serif despite Syne loading fine.
  return (
    <html lang="en" suppressHydrationWarning className={syne.variable}>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
