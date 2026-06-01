import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omen",
  description: "Evidence-first B2B outreach research dossier",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
