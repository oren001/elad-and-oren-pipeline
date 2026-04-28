import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elad & Oren — Vibe Coding",
  description: "Boutique vibe coding for small businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
