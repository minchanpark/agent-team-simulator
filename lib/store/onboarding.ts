"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  AgentMapDocument,
  AgentSession,
  ChatMessage,
  DIAGNOSTIC_DIMENSIONS,
  DiagnosticProgress,
  ExecutionBoard,
  RecoveryLevel,
  SpecialistAgentType,
  TaskStatus,
  TeamRoomMessage,
  TeamSession,
  TeamTurnTrace,
  TeamTurnResult,
  UserContext,
} from "@/lib/types";

const DEFAULT_CONTEXT: UserContext = {
  idea: "",
  painPoints: [],
  teamSize: "solo",
  budgetMonthly: null,
  runwayMonths: null,
  teamRoles: [],
  currentStage: "idea",
  constraints: [],
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

function createDefaultAgentSessions(): Record<SpecialistAgentType, AgentSession> {
  return {
    marketing: createDefaultSession(),
    cs: createDefaultSession(),
    data: createDefaultSession(),
    dev: createDefaultSession(),
  };
}

function createDefaultTeamSession(): TeamSession {
  return {
    messages: [],
    board: null,
    status: "idle",
    lastResult: null,
    trace: null,
    recoveryLevel: "none",
    consensusNotes: [],
    error: null,
  };
}

interface OnboardingState {
  context: UserContext;
  agentSessions: Record<SpecialistAgentType, AgentSession>;
  teamSession: TeamSession;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setIdea: (idea: string) => void;
  togglePainPoint: (painPoint: UserContext["painPoints"][number]) => void;
  setTeamSize: (teamSize: UserContext["teamSize"]) => void;
  setBudgetMonthly: (budgetMonthly: number | null) => void;
  setRunwayMonths: (runwayMonths: number | null) => void;
  setTeamRoles: (teamRoles: string[]) => void;
  setCurrentStage: (currentStage: UserContext["currentStage"]) => void;
  setConstraints: (constraints: string[]) => void;
  replaceContext: (context: UserContext) => void;
  appendAgentMessage: (agentType: SpecialistAgentType, message: ChatMessage) => void;
  setAgentProgress: (agentType: SpecialistAgentType, progress: DiagnosticProgress) => void;
  setAgentMapDocument: (agentType: SpecialistAgentType, document: AgentMapDocument) => void;
  resetAgentSession: (agentType: SpecialistAgentType) => void;
  appendTeamMessage: (message: TeamRoomMessage) => void;
  setTeamRunning: () => void;
  setTeamResult: (payload: {
    result: TeamTurnResult;
    trace?: TeamTurnTrace;
    recoveryLevel?: RecoveryLevel;
  }) => void;
  setTeamError: (error: string) => void;
  setTeamBoard: (board: ExecutionBoard) => void;
  updateTeamTaskStatus: (taskId: string, status: TaskStatus) => void;
  clearTeamError: () => void;
  resetTeamSession: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      context: DEFAULT_CONTEXT,
      agentSessions: createDefaultAgentSessions(),
      teamSession: createDefaultTeamSession(),
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
      setBudgetMonthly: (budgetMonthly) =>
        set((state) => ({
          context: {
            ...state.context,
            budgetMonthly,
          },
        })),
      setRunwayMonths: (runwayMonths) =>
        set((state) => ({
          context: {
            ...state.context,
            runwayMonths,
          },
        })),
      setTeamRoles: (teamRoles) =>
        set((state) => ({
          context: {
            ...state.context,
            teamRoles,
          },
        })),
      setCurrentStage: (currentStage) =>
        set((state) => ({
          context: {
            ...state.context,
            currentStage,
          },
        })),
      setConstraints: (constraints) =>
        set((state) => ({
          context: {
            ...state.context,
            constraints,
          },
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
      appendTeamMessage: (message) =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            messages: [...state.teamSession.messages, message],
          },
        })),
      setTeamRunning: () =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            status: "running",
            recoveryLevel: "none",
            error: null,
          },
        })),
      setTeamResult: (payload) =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            board: payload.result.board,
            lastResult: payload.result,
            trace: payload.trace ?? null,
            recoveryLevel: payload.recoveryLevel ?? "none",
            consensusNotes: payload.result.consensusNotes,
            status: "idle",
            error: null,
          },
        })),
      setTeamError: (error) =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            status: "error",
            error,
          },
        })),
      setTeamBoard: (board) =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            board,
          },
        })),
      updateTeamTaskStatus: (taskId, status) =>
        set((state) => {
          if (!state.teamSession.board) {
            return state;
          }

          const nextTasks = state.teamSession.board.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                }
              : task,
          );

          return {
            teamSession: {
              ...state.teamSession,
              board: {
                ...state.teamSession.board,
                tasks: nextTasks,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      clearTeamError: () =>
        set((state) => ({
          teamSession: {
            ...state.teamSession,
            status: "idle",
            error: null,
          },
        })),
      resetTeamSession: () =>
        set(() => ({
          teamSession: createDefaultTeamSession(),
        })),
      reset: () =>
        set({
          context: DEFAULT_CONTEXT,
          agentSessions: createDefaultAgentSessions(),
          teamSession: createDefaultTeamSession(),
        }),
    }),
    {
      name: "onboarding-context-v2",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        context: state.context,
        agentSessions: state.agentSessions,
        teamSession: state.teamSession,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHasHydrated(true);
        }
      },
    },
  ),
);
