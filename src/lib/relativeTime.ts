"use client";

import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale/th";
import { useLocale } from "next-intl";

// formatDistanceToNow defaults to English regardless of app locale unless a
// date-fns locale object is passed explicitly — this wires it to next-intl's
// active locale so "3 hours ago" renders as "3 ชั่วโมงที่แล้ว" in Thai.
export function useRelativeTime() {
  const locale = useLocale();
  return (date: Date) => formatDistanceToNow(date, { addSuffix: true, locale: locale === "th" ? th : undefined });
}
