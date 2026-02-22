"use client";

import Button from "@/components/ui/Button";

type QuickActionTemplate = "reprioritize" | "risk" | "weekly_plan";

interface QuickActionOption {
  id: QuickActionTemplate;
  label: string;
}

interface AgentMapActionsProps {
  hasMapDocument: boolean;
  messagesLength: number;
  readyForMap: boolean;
  isGeneratingMap: boolean;
  disabled: boolean;
  quickActions: QuickActionOption[];
  onGenerateMap: () => void | Promise<void>;
  onReset: () => void;
  onQuickAction: (template: QuickActionTemplate) => void | Promise<void>;
}

export function AgentMapActions({
  hasMapDocument,
  messagesLength,
  readyForMap,
  isGeneratingMap,
  disabled,
  quickActions,
  onGenerateMap,
  onReset,
  onQuickAction,
}: AgentMapActionsProps) {
  return (
    <div className="space-y-3">
      {!hasMapDocument && messagesLength > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="ghost"
              onClick={() => onQuickAction(action.id)}
              disabled={disabled}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {hasMapDocument ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={onGenerateMap} disabled={isGeneratingMap || disabled}>
            맵 다시 생성
          </Button>
          <Button type="button" variant="ghost" onClick={onReset}>
            진단 다시 시작
          </Button>
        </div>
      ) : (
        messagesLength > 0 && (
          <Button type="button" onClick={onGenerateMap} disabled={isGeneratingMap || disabled}>
            {readyForMap ? "에이전트 맵 생성" : "현재 정보로 맵 생성"}
          </Button>
        )
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="ghost" onClick={onReset}>
          진단 초기화
        </Button>
      </div>
    </div>
  );
}

export default AgentMapActions;
