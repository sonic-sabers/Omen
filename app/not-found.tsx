import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404: Page Not Found",
  description: "This page does not exist.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[480px] w-[480px] animate-[pulse_6s_ease-in-out_infinite] rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Floating dots */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          "top-[18%] left-[12%] h-1 w-1 delay-0",
          "top-[32%] left-[80%] h-1.5 w-1.5 delay-[400ms]",
          "top-[60%] left-[7%] h-1 w-1 delay-[800ms]",
          "top-[72%] left-[88%] h-1 w-1 delay-[200ms]",
          "top-[14%] left-[55%] h-1 w-1 delay-[600ms]",
          "top-[85%] left-[42%] h-1.5 w-1.5 delay-[1000ms]",
        ].map((cls, i) => (
          <span
            key={i}
            className={`absolute rounded-full bg-primary/20 animate-[ping_4s_ease-in-out_infinite] ${cls}`}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative flex flex-col items-center text-center animate-[fadeInUp_0.6s_ease-out_both]">

        {/* Logo mark */}
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 animate-[fadeIn_0.4s_ease-out_both]">
          <span className="text-lg font-black tracking-tighter text-primary-foreground">O</span>
        </div>

        {/* 404 number */}
        <p className="mb-2 select-none text-[96px] font-black leading-none tracking-tighter text-foreground/[0.07] sm:text-[128px] animate-[fadeInUp_0.5s_ease-out_0.05s_both]">
          404
        </p>

        {/* Message */}
        <h1 className="mb-2 text-xl font-bold tracking-tight text-foreground animate-[fadeInUp_0.5s_ease-out_0.15s_both]">
          Page not found
        </h1>
        <p className="mb-8 max-w-xs text-sm text-muted-foreground animate-[fadeInUp_0.5s_ease-out_0.25s_both]">
          This page doesn&apos;t exist or was moved. Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row animate-[fadeInUp_0.5s_ease-out_0.35s_both]">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary active:scale-95"
          >
            View Dashboard
          </Link>
        </div>

      </div>

      {/* Bottom wordmark */}
      <p className="absolute bottom-8 text-[11px] font-medium text-muted-foreground/40 animate-[fadeIn_1s_ease-out_0.6s_both]">
        Omen · Sales Intelligence
      </p>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
