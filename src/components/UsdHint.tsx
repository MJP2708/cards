"use client";

import { useSettings } from "@/lib/data/settings";
import { formatUsdHint } from "@/lib/currency";

export function UsdHint({ amountThb, className = "" }: { amountThb: number; className?: string }) {
  const { data: settings } = useSettings();
  const hint = settings ? formatUsdHint(amountThb, settings.usdExchangeRate) : null;
  if (!hint) return null;
  return <span className={`text-foreground/40 ${className}`}> ({hint})</span>;
}
