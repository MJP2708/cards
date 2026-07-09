"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { BoothModeToggle } from "@/components/BoothModeToggle";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { useClickOutside } from "@/hooks/useClickOutside";

// Consolidates the lower-frequency toggles (language, booth mode, dark mode)
// behind one control so the header's primary row (search, offline status,
// command palette) doesn't compete for attention with settings a seller
// touches once a session, not once a sale.
export function MoreMenu() {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("moreOptions")}
        aria-expanded={open}
        className="booth-target flex items-center justify-center rounded-md border border-border-1 px-2.5 py-1.5 hover:bg-surface-1"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 flex w-56 flex-col gap-2 rounded-md border border-border-1 bg-background p-3 shadow-lg">
          <LanguageSwitcher />
          <BoothModeToggle />
          <DarkModeToggle />
        </div>
      )}
    </div>
  );
}
