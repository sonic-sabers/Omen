import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Omen: Sales Intelligence",
    template: "%s | Omen",
  },
  description: "Evidence-first B2B outreach research. Research any prospect and get a personalised, grounded message in seconds.",
  keywords: ["sales intelligence", "B2B outreach", "prospect research", "AI sales", "dossier"],
  authors: [{ name: "Omen" }],
  creator: "Omen",
  metadataBase: new URL("https://omen.app"),
  openGraph: {
    type: "website",
    siteName: "Omen",
    title: "Omen: Sales Intelligence",
    description: "Evidence-first B2B outreach research. Research any prospect and get a personalised, grounded message in seconds.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Omen: Sales Intelligence",
    description: "Evidence-first B2B outreach research. Research any prospect and get a personalised, grounded message in seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
