"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

const LOCALE_LABELS: Record<Locale, string> = { en: "EN", th: "ไทย" };

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-border-1 px-1.5 py-1">
      <Globe className="h-3.5 w-3.5 text-foreground/50" aria-hidden />
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            locale === l ? "bg-accent text-white" : "text-foreground/60 hover:bg-surface-1"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
