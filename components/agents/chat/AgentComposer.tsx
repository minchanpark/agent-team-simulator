"use client";

import type { FormEvent } from "react";
import Button from "@/components/ui/Button";

interface AgentComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmitText: (value: string) => void | Promise<void>;
  disabled: boolean;
  retryAfterSec: number;
}

export function AgentComposer({
  input,
  onInputChange,
  onSubmitText,
  disabled,
  retryAfterSec,
}: AgentComposerProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmitText(input);
  };

  const blocked = retryAfterSec > 0;

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="답변을 입력해 주세요"
          className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled || input.trim().length === 0}>
          전송
        </Button>
      </form>

      {blocked && (
        <p aria-live="polite" className="text-xs font-medium text-amber-700">
          요청 제한이 적용되었습니다. {retryAfterSec}초 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}

export default AgentComposer;
