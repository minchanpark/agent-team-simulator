"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PainPoint, TeamSize, UserContext } from "@/lib/types";

const DEFAULT_CONTEXT: UserContext = {
  idea: "",
  painPoints: [],
  teamSize: "solo",
};

interface OnboardingState {
  context: UserContext;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setIdea: (idea: string) => void;
  togglePainPoint: (painPoint: PainPoint) => void;
  setTeamSize: (teamSize: TeamSize) => void;
  replaceContext: (context: UserContext) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      context: DEFAULT_CONTEXT,
      hasHydrated: false,
      setHasHydrated: (hydrated) =>
        set((state) => (state.hasHydrated === hydrated ? state : { hasHydrated: hydrated })),
      setIdea: (idea) =>
        set((state) => ({
          context: { ...state.context, idea },
        })),
      togglePainPoint: (painPoint) =>
        set((state) => {
          const exists = state.context.painPoints.includes(painPoint);
          const nextPainPoints = exists
            ? state.context.painPoints.filter((item) => item !== painPoint)
            : [...state.context.painPoints, painPoint];

          return {
            context: {
              ...state.context,
              painPoints: nextPainPoints,
            },
          };
        }),
      setTeamSize: (teamSize) =>
        set((state) => ({
          context: { ...state.context, teamSize },
        })),
      replaceContext: (context) => set({ context }),
      reset: () => set({ context: DEFAULT_CONTEXT }),
    }),
    {
      name: "onboarding-context",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ context: state.context }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHasHydrated(true);
        }
      },
    },
  ),
);
