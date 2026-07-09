"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { useSyncStore } from "@/lib/offline/syncStore";
import { offlineDb } from "@/lib/offline/db";

export function OfflineBanner() {
  const t = useTranslations("common");
  const isOnline = useSyncStore((s) => s.isOnline);
  const pendingCount =
    useLiveQuery(() => (offlineDb ? offlineDb.pendingMutations.count() : Promise.resolve(0)), [], 0) ?? 0;

  if (isOnline && pendingCount === 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-foreground/60">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        {t("liveStatus")}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
      {!isOnline
        ? pendingCount > 0
          ? t("offlineStatusWithQueue", { count: pendingCount })
          : t("offlineStatus")
        : t("syncingStatus", { count: pendingCount })}
    </span>
  );
}
