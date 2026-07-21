import type { Metadata, Viewport } from "next";
import { Syne, Press_Start_2P } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Press Start 2P is the primary font — headings/display text (--font-d in
// globals.css) read var(--font-primary). It only ships one weight (400).
const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-primary",
  display: "swap",
});

// Syne is the secondary font — body copy, descriptions, HUD/mono text
// (--font-b/--font-m in globals.css) read var(--font-secondary).
const syne = Syne({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-secondary",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${pressStart2P.variable} ${syne.variable}`}
    >
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
