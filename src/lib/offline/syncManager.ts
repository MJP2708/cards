import { offlineDb } from "@/lib/offline/db";
import type { CardInput } from "@/lib/validation/card";
import type { QueryClient } from "@tanstack/react-query";

let started = false;
let flushing = false;

async function replay(mutation: { kind: "createCard" | "markSold"; payload: unknown }) {
  if (mutation.kind === "createCard") {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutation.payload as CardInput),
    });
    if (!res.ok) throw new Error(`Replay failed (${res.status})`);
    return;
  }
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mutation.payload),
  });
  if (!res.ok) throw new Error(`Replay failed (${res.status})`);
}

export async function flushQueue(queryClient?: QueryClient) {
  if (!offlineDb || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const pending = await offlineDb.pendingMutations.orderBy("createdAt").toArray();
    for (const mutation of pending) {
      try {
        await replay(mutation);
        await offlineDb.pendingMutations.delete(mutation.id!);
      } catch {
        // Stop at the first failure so mutations stay in order and we don't
        // hammer the network while still offline/flaky.
        break;
      }
    }
    queryClient?.invalidateQueries({ queryKey: ["cards"] });
    queryClient?.invalidateQueries({ queryKey: ["sales"] });
    queryClient?.invalidateQueries({ queryKey: ["dashboard"] });
  } finally {
    flushing = false;
  }
}

export function startSyncManager(queryClient: QueryClient) {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("online", () => flushQueue(queryClient));

  const interval = setInterval(() => flushQueue(queryClient), 30_000);
  flushQueue(queryClient);

  return () => clearInterval(interval);
}
