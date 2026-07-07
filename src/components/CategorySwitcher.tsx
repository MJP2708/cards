"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";

function tabHref(key: string) {
  return key === "all" ? "/all" : `/${key.toLowerCase()}`;
}

export function CategorySwitcher() {
  const { data: categories, isLoading } = useCategories();
  const pathname = usePathname();
  const activeSegment = pathname?.split("/")[1] ?? "all";

  const tabs = [
    { key: "all", displayName: "All Categories", themeTokens: { accent: "#64748B" } },
    ...(categories ?? []),
  ];

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
            className={`booth-target flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "text-foreground/70 hover:bg-surface-1 hover:text-foreground"
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: isActive ? "white" : tab.themeTokens.accent }}
              aria-hidden
            />
            {tab.displayName}
          </Link>
        );
      })}
    </nav>
  );
}
