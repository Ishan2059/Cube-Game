import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRUSH — Roll. Smash. Rampage.",
  description: "Parasites climb. You are heavy. Do the math.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
