"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function UserMenu({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 text-xs">
      <span className="hidden text-foreground/60 sm:inline">
        {name}
        <span className="ml-1 rounded bg-surface-1 px-1.5 py-0.5 font-medium uppercase tracking-wide">{role}</span>
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="tap-compact inline-flex items-center gap-1 rounded-md border border-border-1 px-2 py-1 hover:bg-surface-1"
      >
        <LogOut className="h-3 w-3" />
        Sign out
      </button>
    </div>
  );
}
