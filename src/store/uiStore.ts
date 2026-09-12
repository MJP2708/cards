import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  isDark: boolean;
  reducedMotion: boolean;
  currency: "THB" | "USD";
  listViewMode: "table" | "grid";
  setIsDark: (value: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  setCurrency: (value: "THB" | "USD") => void;
  setListViewMode: (value: "table" | "grid") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isDark: false,
      reducedMotion: false,
      currency: "THB",
      listViewMode: "table",
      setIsDark: (value) => set({ isDark: value }),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setCurrency: (value) => set({ currency: value }),
      setListViewMode: (value) => set({ listViewMode: value }),
    }),
    { name: "cards-ui-store" }
  )
);
