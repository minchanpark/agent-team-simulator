import {
  SpecialistAgentType,
  TEAM_ROOM_DEFAULT_AGENTS,
  TeamPolicy,
  TeamSpec,
} from "@/lib/types";

export const DEFAULT_MODEL_CANDIDATES = [
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-latest",
  "claude-3-5-haiku-latest",
];

const DEFAULT_POLICY: TeamPolicy = {
  modelCandidates: DEFAULT_MODEL_CANDIDATES,
  specialistRetryLimit: 2,
  pmRetryLimit: 2,
  maxTasks: 10,
};

function getModelCandidates(): string[] {
  const configuredModel = process.env.ANTHROPIC_MODEL?.trim();
  const models = [configuredModel, ...DEFAULT_MODEL_CANDIDATES].filter(
    (model): model is string => Boolean(model),
  );

  return Array.from(new Set(models));
}

function normalizeAgents(activeAgents?: SpecialistAgentType[]): SpecialistAgentType[] {
  if (!activeAgents || activeAgents.length === 0) {
    return TEAM_ROOM_DEFAULT_AGENTS;
  }

  return Array.from(new Set(activeAgents));
}

export function resolveTeamSpec(
  teamSpecId: string | undefined,
  activeAgents?: SpecialistAgentType[],
): TeamSpec {
  const id = teamSpecId?.trim() || "default-v1";

  return {
    id,
    name: "Default Team Spec",
    activeAgents: normalizeAgents(activeAgents),
    policy: {
      ...DEFAULT_POLICY,
      modelCandidates: getModelCandidates(),
    },
  };
}
