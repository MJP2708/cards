"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { X, FileBarChart, ListChecks, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BoothModeToggle } from "@/components/BoothModeToggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";

// The bottom tab bar only has room for four destinations in the thumb zone —
// everything lower-frequency (reports, checklist, settings, and the session
// toggles that used to live only in the header's More menu) collapses into
// this one sheet instead of competing for a permanent tab slot.
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const pathname = usePathname();

  const links = [
    { href: "/reports", label: t("reports"), icon: FileBarChart },
    { href: "/checklist", label: t("checklist"), icon: ListChecks },
    { href: "/settings/categories", label: t("settings"), icon: Settings },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="pb-safe fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-border-1 bg-background p-4 shadow-[var(--shadow-md)] md:hidden"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground/60">{common("moreOptions")}</span>
              <button onClick={onClose} aria-label={common("close")} className="tap-compact rounded-md p-1.5 hover:bg-surface-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex flex-col gap-1">
              {links.map((link) => {
                const active = pathname?.startsWith(link.href);
                const Icon = link.icon;
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
              <BoothModeToggle />
              <DarkModeToggle />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
