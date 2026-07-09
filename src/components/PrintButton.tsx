"use client";

import { useTranslations } from "next-intl";

export function PrintButton() {
  const t = useTranslations("common");
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark print:hidden"
    >
      {t("printLabel")}
    </button>
  );
}
