import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Run Dashboard",
  description: "View all prospect research runs, batch results, and performance metrics.",
  openGraph: {
    title: "Run Dashboard | Omen",
    description: "View all prospect research runs, batch results, and performance metrics.",
  },
  twitter: {
    title: "Run Dashboard | Omen",
    description: "View all prospect research runs, batch results, and performance metrics.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
