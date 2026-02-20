"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { AgentMapDocument, AgentMeta } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const React = require("react") as typeof import("react");

interface AgentMapViewProps {
  agent: AgentMeta;
  mapDocument: AgentMapDocument;
}

export function AgentMapView({ agent, mapDocument }: AgentMapViewProps) {
  const markdownDataUrl = React.useMemo(
    () => `data:text/markdown;charset=utf-8,${encodeURIComponent(mapDocument.content)}`,
    [mapDocument.content],
  );

  const handleDownloadMarkdown = React.useCallback(() => {
    const blob = new Blob([mapDocument.content], {
      type: "text/markdown;charset=utf-8",
    });
    const fileUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = fileUrl;
    anchor.download = mapDocument.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(fileUrl);
  }, [mapDocument.content, mapDocument.fileName]);

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-teal-700">에이전트 맵 문서</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">
              {agent.emoji} {agent.name} 실행 문서
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              생성 시각: {new Date(mapDocument.createdAt).toLocaleString("ko-KR")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleDownloadMarkdown}>
              MD 다운로드
            </Button>
            <a
              href={markdownDataUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            >
              새 탭에서 열기
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900">문서 임베드 미리보기</h3>
        <iframe
          title={`${agent.name} 에이전트 맵 문서`}
          src={markdownDataUrl}
          className="mt-3 h-[420px] w-full rounded-xl border border-slate-200 bg-white"
        />
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {mapDocument.content}
        </pre>
      </Card>
    </section>
  );
}

export default AgentMapView;
