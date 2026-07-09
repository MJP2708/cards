import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  isDark: boolean;
  boothMode: boolean;
  reducedMotion: boolean;
  currency: "THB" | "USD";
  listViewMode: "table" | "grid";
  setIsDark: (value: boolean) => void;
  toggleBoothMode: () => void;
  setReducedMotion: (value: boolean) => void;
  setCurrency: (value: "THB" | "USD") => void;
  setListViewMode: (value: "table" | "grid") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isDark: false,
      boothMode: false,
      reducedMotion: false,
      currency: "THB",
      listViewMode: "table",
      setIsDark: (value) => set({ isDark: value }),
      toggleBoothMode: () => set((s) => ({ boothMode: !s.boothMode })),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setCurrency: (value) => set({ currency: value }),
      setListViewMode: (value) => set({ listViewMode: value }),
    }),
    { name: "cards-ui-store" }
  )
);
