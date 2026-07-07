import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  isDark: boolean;
  boothMode: boolean;
  reducedMotion: boolean;
  currency: "THB" | "USD";
  setIsDark: (value: boolean) => void;
  toggleBoothMode: () => void;
  setReducedMotion: (value: boolean) => void;
  setCurrency: (value: "THB" | "USD") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isDark: false,
      boothMode: false,
      reducedMotion: false,
      currency: "THB",
      setIsDark: (value) => set({ isDark: value }),
      toggleBoothMode: () => set((s) => ({ boothMode: !s.boothMode })),
      setReducedMotion: (value) => set({ reducedMotion: value }),
      setCurrency: (value) => set({ currency: value }),
    }),
    { name: "cards-ui-store" }
  )
);
