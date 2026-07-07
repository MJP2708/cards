"use client";

import { useTranslations } from "next-intl";
import { useUiStore } from "@/store/uiStore";

export function DarkModeToggle() {
  const t = useTranslations("common");
  const isDark = useUiStore((s) => s.isDark);
  const setIsDark = useUiStore((s) => s.setIsDark);

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      aria-label="Toggle dark mode"
      className="booth-target rounded-md border border-border-1 px-2.5 py-1.5 text-sm hover:bg-surface-1"
    >
      {isDark ? t("lightMode") : t("darkMode")}
    </button>
  );
}
