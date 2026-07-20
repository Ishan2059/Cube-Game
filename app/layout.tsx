import type { Metadata, Viewport } from "next";
import { Anton, Space_Grotesk, Space_Mono, Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
const syne = Syne({
  weight: ["400", "700", "800"],
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${anton.variable} ${grotesk.variable} ${mono.variable} ${syne.variable}`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
