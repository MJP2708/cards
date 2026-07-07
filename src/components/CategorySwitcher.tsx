"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCategories } from "@/hooks/useCategories";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import type { ThemeTokens } from "@/lib/fieldSchema";

function tabHref(key: string) {
  return key === "all" ? "/all" : `/${key.toLowerCase()}`;
}

const ALL_TAB_THEME: Pick<ThemeTokens, "accent" | "iconSet"> = { accent: "#64748B", iconSet: "neutral" };

export function CategorySwitcher() {
  const t = useTranslations("common");
  const { data: categories, isLoading } = useCategories();
  const pathname = usePathname();
  const activeSegment = pathname?.split("/")[1] ?? "all";

  const tabs = [{ key: "all", displayName: t("allCategories"), themeTokens: ALL_TAB_THEME }, ...(categories ?? [])];

  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Category switcher">
      {isLoading && <span className="text-sm text-foreground/50 px-2 py-1.5">Loading categories…</span>}
      {tabs.map((tab) => {
        const href = tabHref(tab.key);
        const isActive = activeSegment.toLowerCase() === tab.key.toLowerCase();
        return (
          <Link
            key={tab.key}
            href={href}
            className={`booth-target relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
              !isActive ? "hover:bg-surface-1" : ""
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="active-category-pill"
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={`relative z-10 flex items-center gap-1.5 transition-colors ${
                isActive ? "text-white" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <CategoryIcon iconSet={tab.themeTokens.iconSet} className="h-3.5 w-3.5" />
              {tab.displayName}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
