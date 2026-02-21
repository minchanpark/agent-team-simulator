export const TEAM_EVENT_NAMES = [
  "team_room_opened",
  "team_turn_submitted",
  "team_turn_succeeded",
  "team_turn_failed",
  "execution_board_generated",
  "team_consensus_completed",
  "team_recovery_applied",
  "team_trace_captured",
] as const;

export type TeamEventName = (typeof TEAM_EVENT_NAMES)[number];

interface TeamMetricsState {
  total: number;
  counts: Record<TeamEventName, number>;
  lastEventAt: string | null;
  latencyTotalMs: number;
  latencyCount: number;
}

function createInitialState(): TeamMetricsState {
  return {
    total: 0,
    counts: {
      team_room_opened: 0,
      team_turn_submitted: 0,
      team_turn_succeeded: 0,
      team_turn_failed: 0,
      execution_board_generated: 0,
      team_consensus_completed: 0,
      team_recovery_applied: 0,
      team_trace_captured: 0,
    },
    lastEventAt: null,
    latencyTotalMs: 0,
    latencyCount: 0,
  };
}

function getState(): TeamMetricsState {
  const globalState = globalThis as typeof globalThis & {
    __TEAM_METRICS__?: TeamMetricsState;
  };

  if (!globalState.__TEAM_METRICS__) {
    globalState.__TEAM_METRICS__ = createInitialState();
  }

  return globalState.__TEAM_METRICS__;
}

export function isTeamEventName(value: unknown): value is TeamEventName {
  return typeof value === "string" && TEAM_EVENT_NAMES.includes(value as TeamEventName);
}

export function trackTeamEvent(event: TeamEventName, metadata?: Record<string, unknown>): void {
  const state = getState();
  state.total += 1;
  state.counts[event] += 1;
  state.lastEventAt = new Date().toISOString();

  const latency = metadata?.latencyMs;
  if (typeof latency === "number" && Number.isFinite(latency) && latency >= 0) {
    state.latencyTotalMs += latency;
    state.latencyCount += 1;
  }
}

export function getTeamMetricsSnapshot(): {
  total: number;
  counts: Record<TeamEventName, number>;
  lastEventAt: string | null;
  averageLatencyMs: number | null;
} {
  const state = getState();

  return {
    total: state.total,
    counts: state.counts,
    lastEventAt: state.lastEventAt,
    averageLatencyMs:
      state.latencyCount > 0 ? Math.round((state.latencyTotalMs / state.latencyCount) * 100) / 100 : null,
  };
}
