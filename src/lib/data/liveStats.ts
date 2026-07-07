"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LiveStatsSnapshot } from "@/lib/liveStats";

export function useRefreshStats(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean = false) => {
      const res = await fetch(`/api/cards/${cardId}/refresh-stats?force=${force}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to refresh stats");
      return body as { stats: LiveStatsSnapshot; cached: boolean };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["card", cardId] }),
  });
}
