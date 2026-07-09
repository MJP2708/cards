"use client";

import { useTranslations } from "next-intl";
import type { CardDTO } from "@/lib/data/types";

export const STATUS_VALUES: CardDTO["status"][] = ["In Stock", "Reserved", "On Hold", "Sold"];

// Card.status is stored/queried in English (matches the DB and API filters) —
// only the label shown to the user should follow the active locale.
export function useStatusLabel() {
  const t = useTranslations("common");
  const map: Record<string, string> = {
    "In Stock": t("inStock"),
    Reserved: t("reserved"),
    "On Hold": t("onHold"),
    Sold: t("sold"),
  };
  return (status: string) => map[status] ?? status;
}
