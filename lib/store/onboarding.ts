"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AgentMapDocument,
  AgentSession,
  AgentType,
  ChatMessage,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticProgress,
  PainPoint,
  TeamSize,
  UserContext,
} from "@/lib/types";

const DEFAULT_CONTEXT: UserContext = {
  idea: "",
  painPoints: [],
  teamSize: "solo",
};

function createDefaultProgress(): DiagnosticProgress {
  return {
    completed: [],
    missing: [...DIAGNOSTIC_DIMENSIONS],
    readyForMap: false,
  };
}

function createDefaultSession(): AgentSession {
  return {
    messages: [],
    progress: createDefaultProgress(),
    mapDocument: null,
    status: "idle",
  };
}

function createDefaultAgentSessions(): Record<AgentType, AgentSession> {
  return {
    marketing: createDefaultSession(),
    cs: createDefaultSession(),
    data: createDefaultSession(),
    dev: createDefaultSession(),
  };
}

interface OnboardingState {
  context: UserContext;
  agentSessions: Record<AgentType, AgentSession>;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setIdea: (idea: string) => void;
  togglePainPoint: (painPoint: PainPoint) => void;
  setTeamSize: (teamSize: TeamSize) => void;
  replaceContext: (context: UserContext) => void;
  appendAgentMessage: (agentType: AgentType, message: ChatMessage) => void;
  setAgentProgress: (agentType: AgentType, progress: DiagnosticProgress) => void;
  setAgentMapDocument: (agentType: AgentType, document: AgentMapDocument) => void;
  resetAgentSession: (agentType: AgentType) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      context: DEFAULT_CONTEXT,
      agentSessions: createDefaultAgentSessions(),
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
      appendAgentMessage: (agentType, message) =>
        set((state) => {
          const currentSession = state.agentSessions[agentType];
          const nextStatus = currentSession.status === "idle" ? "diagnosing" : currentSession.status;

          return {
            agentSessions: {
              ...state.agentSessions,
              [agentType]: {
                ...currentSession,
                messages: [...currentSession.messages, message],
                status: nextStatus,
              },
            },
          };
        }),
      setAgentProgress: (agentType, progress) =>
        set((state) => {
          const currentSession = state.agentSessions[agentType];
          const hasMapDocument = Boolean(currentSession.mapDocument);
          const nextStatus =
            hasMapDocument ? "mapped" : progress.readyForMap ? "ready" : "diagnosing";

          return {
            agentSessions: {
              ...state.agentSessions,
              [agentType]: {
                ...currentSession,
                progress,
                status: nextStatus,
              },
            },
          };
        }),
      setAgentMapDocument: (agentType, document) =>
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentType]: {
              ...state.agentSessions[agentType],
              mapDocument: document,
              status: "mapped",
            },
          },
        })),
      resetAgentSession: (agentType) =>
        set((state) => ({
          agentSessions: {
            ...state.agentSessions,
            [agentType]: createDefaultSession(),
          },
        })),
      reset: () =>
        set({
          context: DEFAULT_CONTEXT,
          agentSessions: createDefaultAgentSessions(),
        }),
    }),
    {
      name: "onboarding-context",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ context: state.context, agentSessions: state.agentSessions }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHasHydrated(true);
        }
      },
    },
  ),
);
