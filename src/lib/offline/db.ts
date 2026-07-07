import Dexie, { type EntityTable } from "dexie";
import type { CardDTO } from "@/lib/data/types";
import type { CardInput } from "@/lib/validation/card";

export type PendingMutation = {
  id?: number;
  kind: "createCard" | "markSold";
  cardId: string;
  payload: unknown;
  createdAt: number;
};

class OfflineDb extends Dexie {
  cards!: EntityTable<CardDTO, "id">;
  pendingMutations!: EntityTable<PendingMutation, "id">;

  constructor() {
    super("cards-booth-db");
    this.version(1).stores({
      cards: "id, category, status, name",
      pendingMutations: "++id, kind, cardId, createdAt",
    });
  }
}

// Dexie touches indexedDB at construction time, which doesn't exist during SSR/build.
export const offlineDb: OfflineDb | null = typeof window !== "undefined" ? new OfflineDb() : null;

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.message === "Failed to fetch");
}

export type { CardDTO, CardInput };
