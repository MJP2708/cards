"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BarChart3, ScanLine, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { MoreSheet } from "@/components/nav/MoreSheet";

// All primary navigation used to live in a two-row top header — the hardest
// reach zone for a thumb on a phone held one-handed, which is the primary
// grip this product is built for. These four destinations now sit in the
// thumb zone instead; the top header only needs to carry search and status.
export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);

  const isInventory = !["/dashboard", "/scan", "/reports", "/checklist"].some((p) => pathname.startsWith(p)) && !pathname.startsWith("/settings");
  const isMoreSection = ["/reports", "/checklist", "/settings"].some((p) => pathname.startsWith(p));

  const tabs = [
    { key: "inventory", href: "/all", label: t("inventory"), icon: LayoutGrid, active: isInventory },
    { key: "dashboard", href: "/dashboard", label: t("dashboard"), icon: BarChart3, active: pathname.startsWith("/dashboard") },
    { key: "scan", href: "/scan", label: t("scan"), icon: ScanLine, active: pathname.startsWith("/scan") },
  ];

  return (
    <>
      <nav
        aria-label={t("mobileNavLabel")}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-border-1 bg-background/95 backdrop-blur md:hidden"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium"
            >
              <Icon className="h-5 w-5" style={{ color: tab.active ? "var(--accent)" : "var(--foreground)", opacity: tab.active ? 1 : 0.5 }} />
              <span style={{ color: tab.active ? "var(--accent)" : undefined, opacity: tab.active ? 1 : 0.6 }}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium"
        >
          <MoreHorizontal className="h-5 w-5" style={{ color: isMoreSection ? "var(--accent)" : "var(--foreground)", opacity: isMoreSection ? 1 : 0.5 }} />
          <span style={{ color: isMoreSection ? "var(--accent)" : undefined, opacity: isMoreSection ? 1 : 0.6 }}>{t("more")}</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
