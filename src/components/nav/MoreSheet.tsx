"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  X,
  FileBarChart,
  ListChecks,
  Settings,
  Upload,
  Users,
  Stethoscope,
  LogOut,
  CircleDot,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { Modal } from "@/components/ui/Modal";

/**
 * The bottom tab bar only has room for three destinations in the thumb zone, so
 * everything else lives here.
 *
 * The link list is passed in from the layout rather than hardcoded: it used to
 * name three routes literally, which meant Import, Users and Diagnostics existed
 * but were unreachable on a phone — and this product is used one-handed at a
 * counter. Sharing the layout's role-aware list means a destination can never be
 * desktop-only again by omission.
 */
const ICONS: Record<string, typeof FileBarChart> = {
  "/reports": FileBarChart,
  "/checklist": ListChecks,
  "/import": Upload,
  "/settings/categories": Settings,
  "/settings/users": Users,
  "/settings/diagnostics": Stethoscope,
};

/** Already in the thumb-zone tab bar, so they would only be duplicates here. */
const IN_TAB_BAR = ["/dashboard", "/scan"];

export function MoreSheet({
  open,
  onClose,
  links,
  user,
}: {
  open: boolean;
  onClose: () => void;
  links: { href: string; label: string }[];
  user: { name: string; role: string };
}) {
  const common = useTranslations("common");
  const nav = useTranslations("nav");
  const pathname = usePathname();

  const sheetLinks = links.filter((link) => !IN_TAB_BAR.includes(link.href));

  return (
    <Modal open={open} onClose={onClose} variant="sheet" labelledBy="more-sheet-title" panelClassName="w-full p-4 md:hidden">
      <div className="mb-3 flex items-center justify-between">
        <span id="more-sheet-title" className="text-sm font-semibold text-foreground/60">
          {common("moreOptions")}
        </span>
        <button onClick={onClose} aria-label={common("close")} className="tap-compact rounded-md p-1.5 hover:bg-surface-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex flex-col gap-1">
        {sheetLinks.map((link) => {
          const active = pathname?.startsWith(link.href);
          const Icon = ICONS[link.href] ?? CircleDot;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium ${
                active ? "bg-[var(--accent-tint-strong)] text-accent-dark" : "hover:bg-surface-1"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-1 pt-3">
        <LanguageSwitcher />
        <DarkModeToggle />
      </div>

      {/* Sign out was previously inside a `hidden md:contents` wrapper in the
          header, so there was no way to sign out at all on a phone. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-1 pt-3">
        <span className="min-w-0 truncate text-xs text-foreground/60">
          {user.name}
          <span className="ml-1 rounded bg-surface-1 px-1.5 py-0.5 font-medium uppercase tracking-wide">
            {user.role}
          </span>
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="tap-compact inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-1 px-3 py-2 text-sm hover:bg-surface-1"
        >
          <LogOut className="h-4 w-4" />
          {nav("signOut")}
        </button>
      </div>
    </Modal>
  );
}
