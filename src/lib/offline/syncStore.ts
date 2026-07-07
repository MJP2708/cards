import { create } from "zustand";

interface SyncState {
  isOnline: boolean;
  setOnline: (value: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: true,
  setOnline: (value) => set({ isOnline: value }),
}));

// Wire up browser connectivity events once, on the client, outside React so the
// store stays accurate even if no component using it is currently mounted.
if (typeof window !== "undefined") {
  useSyncStore.getState().setOnline(navigator.onLine);
  window.addEventListener("online", () => useSyncStore.getState().setOnline(true));
  window.addEventListener("offline", () => useSyncStore.getState().setOnline(false));
}
