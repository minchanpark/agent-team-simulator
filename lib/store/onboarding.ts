"use client";

import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
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

const CURRENT_SCHEMA_VERSION = 3;
const PERSIST_KEY = "onboarding-context-v3";
const STORAGE_MODE_KEY = "onboarding-storage-mode";

type StorageMode = "session" | "local";

interface SnapshotPayload {
  schemaVersion: number;
  exportedAt: string;
  storageMode: StorageMode;
  context: UserContext;
  agentSessions: Record<SpecialistAgentType, AgentSession>;
  teamSession: TeamSession;
}

interface SnapshotImportResult {
  ok: boolean;
  error?: string;
}

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

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getStorageByMode(mode: StorageMode): Storage | null {
  if (!isBrowser()) {
    return null;
  }

  return mode === "local" ? window.localStorage : window.sessionStorage;
}

function readStorageMode(): StorageMode {
  if (!isBrowser()) {
    return "session";
  }

  const raw = window.localStorage.getItem(STORAGE_MODE_KEY);
  return raw === "local" ? "local" : "session";
}

function persistStorageMode(mode: StorageMode): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_MODE_KEY, mode);
}

const dynamicStorage: StateStorage = {
  getItem(name) {
    const preferredMode = readStorageMode();
    const preferredStorage = getStorageByMode(preferredMode);
    const fallbackStorage = getStorageByMode(preferredMode === "local" ? "session" : "local");

    const preferredValue = preferredStorage?.getItem(name);
    if (preferredValue !== null && preferredValue !== undefined) {
      return preferredValue;
    }

    const fallbackValue = fallbackStorage?.getItem(name);
    return fallbackValue ?? null;
  },
  setItem(name, value) {
    const preferredMode = readStorageMode();
    const preferredStorage = getStorageByMode(preferredMode);
    const fallbackStorage = getStorageByMode(preferredMode === "local" ? "session" : "local");

    preferredStorage?.setItem(name, value);
    fallbackStorage?.removeItem(name);
  },
  removeItem(name) {
    window.localStorage.removeItem(name);
    window.sessionStorage.removeItem(name);
  },
};

function isSnapshotPayload(value: unknown): value is SnapshotPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SnapshotPayload>;
  if (!candidate.context || typeof candidate.context !== "object") {
    return false;
  }

  if (!candidate.agentSessions || typeof candidate.agentSessions !== "object") {
    return false;
  }

  if (!candidate.teamSession || typeof candidate.teamSession !== "object") {
    return false;
  }

  return true;
}

function normalizeStorageMode(mode: unknown): StorageMode {
  return mode === "local" ? "local" : "session";
}

function movePersistedValue(targetMode: StorageMode): void {
  const sourceMode: StorageMode = targetMode === "local" ? "session" : "local";
  const source = getStorageByMode(sourceMode);
  const target = getStorageByMode(targetMode);

  if (!source || !target) {
    return;
  }

  const value = source.getItem(PERSIST_KEY);
  if (!value) {
    return;
  }

  target.setItem(PERSIST_KEY, value);
  source.removeItem(PERSIST_KEY);
}

interface OnboardingState {
  schemaVersion: number;
  storageMode: StorageMode;
  context: UserContext;
  agentSessions: Record<SpecialistAgentType, AgentSession>;
  teamSession: TeamSession;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setStorageMode: (mode: StorageMode) => void;
  exportSnapshot: () => string;
  importSnapshot: (raw: string) => SnapshotImportResult;
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
    (set, get) => ({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      storageMode: readStorageMode(),
      context: DEFAULT_CONTEXT,
      agentSessions: createDefaultAgentSessions(),
      teamSession: createDefaultTeamSession(),
      hasHydrated: false,
      setHasHydrated: (hydrated) =>
        set((state) => (state.hasHydrated === hydrated ? state : { hasHydrated: hydrated })),
      setStorageMode: (mode) => {
        const normalizedMode = normalizeStorageMode(mode);
        persistStorageMode(normalizedMode);
        movePersistedValue(normalizedMode);

        set((state) =>
          state.storageMode === normalizedMode
            ? state
            : {
                storageMode: normalizedMode,
              },
        );
      },
      exportSnapshot: () => {
        const state = get();
        const snapshot: SnapshotPayload = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          exportedAt: new Date().toISOString(),
          storageMode: state.storageMode,
          context: state.context,
          agentSessions: state.agentSessions,
          teamSession: state.teamSession,
        };

        return JSON.stringify(snapshot, null, 2);
      },
      importSnapshot: (raw) => {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!isSnapshotPayload(parsed)) {
            return {
              ok: false,
              error: "스냅샷 형식이 올바르지 않습니다.",
            };
          }

          const targetMode = normalizeStorageMode(parsed.storageMode);
          persistStorageMode(targetMode);

          set(() => ({
            schemaVersion: CURRENT_SCHEMA_VERSION,
            storageMode: targetMode,
            context: parsed.context,
            agentSessions: {
              ...createDefaultAgentSessions(),
              ...parsed.agentSessions,
            },
            teamSession: {
              ...createDefaultTeamSession(),
              ...parsed.teamSession,
            },
          }));

          return {
            ok: true,
          };
        } catch {
          return {
            ok: false,
            error: "JSON 파싱에 실패했습니다.",
          };
        }
      },
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
          const nextStatus = hasMapDocument ? "mapped" : progress.readyForMap ? "ready" : "diagnosing";

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
        set((state) => ({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          storageMode: state.storageMode,
          context: DEFAULT_CONTEXT,
          agentSessions: createDefaultAgentSessions(),
          teamSession: createDefaultTeamSession(),
        })),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => dynamicStorage),
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        storageMode: state.storageMode,
        context: state.context,
        agentSessions: state.agentSessions,
        teamSession: state.teamSession,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<OnboardingState>;
        const normalizedMode = normalizeStorageMode(persisted.storageMode);
        persistStorageMode(normalizedMode);

        return {
          ...currentState,
          ...persisted,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          storageMode: normalizedMode,
          context: persisted.context ?? currentState.context,
          agentSessions: persisted.agentSessions ?? currentState.agentSessions,
          teamSession: {
            ...createDefaultTeamSession(),
            ...(persisted.teamSession ?? currentState.teamSession),
          },
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHasHydrated(true);
        }
      },
    },
  ),
);
