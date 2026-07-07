"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startSyncManager } from "@/lib/offline/syncManager";

export function SyncManagerMount() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const stop = startSyncManager(queryClient);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
