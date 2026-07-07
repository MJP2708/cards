import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingState {
  hasSeenTour: boolean;
  tourOpen: boolean;
  markSeen: () => void;
  openTour: () => void;
  closeTour: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenTour: false,
      tourOpen: false,
      markSeen: () => set({ hasSeenTour: true, tourOpen: false }),
      openTour: () => set({ tourOpen: true }),
      closeTour: () => set({ tourOpen: false }),
    }),
    { name: "cards-onboarding-store" }
  )
);
