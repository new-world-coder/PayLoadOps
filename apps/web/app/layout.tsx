import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <header className="mb-5 flex items-center gap-4 border-b border-zinc-800 pb-3 text-sm">
            <Link href="/" className="font-semibold text-zinc-200">
              PayloadOps
            </Link>
            <Link href="/" className="text-zinc-400 hover:text-zinc-200">
              Dashboard
            </Link>
            <Link href="/replay" className="text-zinc-400 hover:text-zinc-200">
              Replay
            </Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
