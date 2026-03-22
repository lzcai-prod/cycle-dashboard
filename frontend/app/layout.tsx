import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cycle Dashboard — Pring's Business Cycle Model",
  description:
    "Live business cycle stage tracking using Martin Pring's 6-stage model. Transparent signals from FRED + Yahoo Finance data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
