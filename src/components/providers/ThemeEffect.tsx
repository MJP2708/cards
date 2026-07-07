"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";
import { useUiStore } from "@/store/uiStore";
import type { ThemeTokens } from "@/lib/fieldSchema";

const NEUTRAL_THEME: ThemeTokens = {
  accent: "#64748B",
  accentDark: "#475569",
  secondary: "#94A3B8",
  surface: "transparent",
  motif: "none",
  headerFont: "geist",
  iconSet: "neutral",
};

const HEADER_FONT_VARS: Record<ThemeTokens["headerFont"], string> = {
  oswald: "var(--font-oswald)",
  barlowCondensed: "var(--font-barlow-condensed)",
  baloo2: "var(--font-baloo2)",
  cinzel: "var(--font-cinzel)",
  geist: "var(--font-geist-sans)",
};

export function ThemeEffect() {
  const params = useParams<{ category?: string }>();
  const { data: categories } = useCategories();
  const isDark = useUiStore((s) => s.isDark);
  const boothMode = useUiStore((s) => s.boothMode);
  const reducedMotion = useUiStore((s) => s.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    const categoryKey = params?.category;
    const match =
      categoryKey && categoryKey !== "all"
        ? categories?.find((c) => c.key.toLowerCase() === categoryKey.toLowerCase())
        : undefined;
    const tokens = match?.themeTokens ?? NEUTRAL_THEME;

    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-dark", tokens.accentDark ?? tokens.accent);
    root.style.setProperty("--secondary", tokens.secondary);
    root.style.setProperty("--category-surface", tokens.surface ?? "transparent");
    root.style.setProperty("--font-display", HEADER_FONT_VARS[tokens.headerFont ?? "geist"]);
    root.setAttribute("data-motif", tokens.motif ?? "none");
    root.setAttribute("data-category", match?.key ?? "all");
  }, [params?.category, categories]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    document.documentElement.classList.toggle("booth-mode", boothMode);
  }, [boothMode]);

  useEffect(() => {
    document.documentElement.classList.toggle("force-reduced-motion", reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const stored = localStorage.getItem("cards-ui-store");
    if (!stored) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) useUiStore.getState().setIsDark(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
