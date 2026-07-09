"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import { LayoutDashboard, FileBarChart, ClipboardList, ScanLine, Settings, Search } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { CategoryIcon } from "@/components/icons/CategoryIcon";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";
import type { CardDTO } from "@/lib/data/types";

export function CommandPalette() {
  const router = useRouter();
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const { data: categories } = useCategories();
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardDTO[]>([]);

  const staticPages = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/reports", label: t("salesReports"), icon: FileBarChart },
    { href: "/checklist", label: t("preEventChecklist"), icon: ClipboardList },
    { href: "/scan", label: t("scanQr"), icon: ScanLine },
    { href: "/settings/categories", label: t("settings"), icon: Settings },
  ];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useCommandPaletteStore.setState((s) => ({ open: !s.open }));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/cards?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults((await res.json()).slice(0, 8));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("commandPaletteLabel")}
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border-1 bg-background shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-border-1 px-3">
        <Search className="h-4 w-4 text-foreground/40" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t("searchPlaceholder")}
          className="w-full bg-transparent py-3 text-sm outline-none"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-foreground/50">{t("noMatches")}</Command.Empty>

        {results.length > 0 && (
          <Command.Group heading={t("groupCards")} className="mb-1 px-2 text-xs font-medium uppercase text-foreground/40">
            {results.map((card) => (
              <Command.Item
                key={card.id}
                onSelect={() => go(`/${card.category.toLowerCase()}/card/${card.id}`)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-1"
              >
                <span>{card.name}</span>
                <span className="text-xs text-foreground/50">{card.series}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading={t("groupCategories")} className="mb-1 px-2 text-xs font-medium uppercase text-foreground/40">
          <Command.Item
            onSelect={() => go("/all")}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-1"
          >
            {common("allCategories")}
          </Command.Item>
          {categories?.map((c) => (
            <Command.Item
              key={c.key}
              onSelect={() => go(`/${c.key.toLowerCase()}`)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-1"
            >
              <CategoryIcon iconSet={c.themeTokens.iconSet} className="h-3.5 w-3.5" />
              {c.displayName}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading={t("groupGoTo")} className="px-2 text-xs font-medium uppercase text-foreground/40">
          {staticPages.map((page) => (
            <Command.Item
              key={page.href}
              onSelect={() => go(page.href)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-surface-1"
            >
              <page.icon className="h-3.5 w-3.5" />
              {page.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
