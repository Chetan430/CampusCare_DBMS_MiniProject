"use client";
import { signOut, useSession } from "next-auth/react";

export function DashboardHeader({ subtitle }: { subtitle: string }) {
  const { data: session } = useSession();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <div><strong className="text-xl text-[var(--brand)]">CampusCare</strong>
          <p className="text-xs text-slate-500">{subtitle}</p></div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-600 sm:inline">{session?.user?.name}</span>
          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Sign out</button>
        </div>
      </div>
    </header>
  );
}
