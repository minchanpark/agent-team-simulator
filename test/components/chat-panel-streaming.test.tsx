import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "@/components/agents/ChatPanel";
import { AGENT_META } from "@/lib/agents/recommend";
import { useOnboardingStore } from "@/lib/store/onboarding";

interface StreamEventInput {
  event: string;
  data: unknown;
}

function createSseResponse(events: StreamEventInput[], delayMs = 0): Response {
  const encoder = new TextEncoder();
  const payload = events.map((event) => `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (payload.length === 0) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(payload[0]));

      if (payload.length === 1) {
        controller.close();
        return;
      }

      window.setTimeout(() => {
        for (let index = 1; index < payload.length; index += 1) {
          controller.enqueue(encoder.encode(payload[index]));
        }
        controller.close();
      }, delayMs);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}

describe("ChatPanel diagnosis streaming", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
    useOnboardingStore.getState().setHasHydrated(true);
    useOnboardingStore.getState().replaceContext({
      idea: "테스트 아이디어",
      painPoints: ["content_marketing"],
      teamSize: "solo",
      budgetMonthly: 30,
      runwayMonths: 6,
      teamRoles: ["기획"],
      currentStage: "idea",
      constraints: ["외주 불가"],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders streamed diagnosis text before final done payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (!url.includes("/api/chat")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const payload = JSON.parse(String(init?.body ?? "{}")) as { mode?: string };
        if (payload.mode === "diagnosis") {
          return createSseResponse(
            [
              {
                event: "token",
                data: {
                  text: "질문: 이번 주에 반드시 달성해야 할 목표를 숫자로 알려주세요.",
                },
              },
              {
                event: "done",
                data: {
                  message:
                    "질문: 이번 주에 반드시 달성해야 할 목표를 숫자로 알려주세요.\n이유: 목표 기준을 알아야 우선순위를 설계할 수 있습니다.\n예시 답변: 베타 30명 확보 / 데모 20건 / 유료 전환 3건",
                  progress: {
                    completed: ["goal"],
                    missing: ["bottleneck", "target", "resource", "metric"],
                    readyForMap: false,
                  },
                },
              },
            ],
            120,
          );
        }

        return new Response(JSON.stringify({ mode: "generate_map", document: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    render(<ChatPanel agent={AGENT_META.marketing} context={useOnboardingStore.getState().context} />);

    await waitFor(() => {
      expect(screen.getByText("질문: 이번 주에 반드시 달성해야 할 목표를 숫자로 알려주세요.")).toBeInTheDocument();
    });

    expect(screen.getByText(/진단 진행도: 0\/5/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/진단 진행도: 1\/5/)).toBeInTheDocument();
    });
  });

  it("shows diagnosis error UI when SSE error event is received", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        createSseResponse([
          {
            event: "error",
            data: {
              errorCode: "UPSTREAM_UNAVAILABLE",
              message: "외부 AI 서비스 응답이 불안정합니다. 잠시 후 다시 시도해 주세요.",
              recoverable: true,
              requestId: "req_stream_error",
            },
          },
        ]),
      ),
    );

    render(<ChatPanel agent={AGENT_META.marketing} context={useOnboardingStore.getState().context} />);

    await waitFor(() => {
      expect(
        screen.getByText("외부 AI 서비스 응답이 불안정합니다. 잠시 후 다시 시도해 주세요."),
      ).toBeInTheDocument();
    });
  });
});
