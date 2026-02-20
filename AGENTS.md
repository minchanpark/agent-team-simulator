# AGENTS.md — AI 에이전트 팀 시뮬레이터

이 파일은 Codex가 이 프로젝트를 작업할 때 가장 먼저 읽어야 하는 파일입니다.

---

## 🚀 프로젝트 개요

**서비스:** AI 에이전트 팀 시뮬레이터  
**설명:** 예비창업자가 자신의 스타트업에 맞는 AI 에이전트 팀을 구성하고, 직접 대화해보고, 구현 청사진까지 받아가는 웹 서비스  
**스택:** Next.js 14 (App Router) + Tailwind CSS + Claude API  
**배포:** Vercel

---

## 📚 문서 읽기 순서

작업 시작 전 반드시 아래 순서로 문서를 읽을 것:

1. `AGENTS.md` — Codex 프로젝트 운영 기준(이 문서)
2. `docs/PRD.md` — 제품 요구사항 전체 (기능, 페이지, API 명세)
3. `docs/AGENT_GUIDELINES.md` — 코딩 원칙, 폴더 구조, 개발 순서
4. `docs/AGENT_PROMPTS.md` — 에이전트 페르소나 프롬프트 (구현 코드 포함)
5. `README.md` — 프로젝트 개요 및 문서 인덱스

---

## 🛠 사용 가능한 Codex Skills

작업 유형에 따라 아래 스킬을 참고할 것:

| 작업 | 스킬 파일 |
|------|-----------|
| 프론트엔드 UI/UX 설계 및 구현 산출물 작성 | `.codex/skills/frontend-design/SKILL.md` |
| UI 구조/토큰/컴포넌트 스펙 설계 | `.codex/skills/ui-designer/SKILL.md` |
| UI 스펙 기반 React 구현 | `.codex/skills/frontend-implementer/SKILL.md` |
| 출시 품질 기준 UI 리뷰 | `.codex/skills/ui-reviewer/SKILL.md` |
| WCAG 2.1 AA 접근성 점검 | `.codex/skills/a11y-auditor/SKILL.md` |
| 디자인 시스템 일관성 유지 | `.codex/skills/design-system-keeper/SKILL.md` |

---

## 🪝 Codex Hooks (Notify 기반)

Codex에서는 Claude의 `SessionStart`/`PreToolUse`/`PostToolUse` 훅 대신, 턴 완료 후 `notify` 훅을 사용합니다.

| 훅 | 트리거 | 파일 |
|----|--------|------|
| Notify 디스패처 | 에이전트 턴 완료 시 | `.codex/hooks/notify_dispatch.py` |
| 보호 경로 점검 | 디스패처 내부 호출 | `.codex/hooks/protect_paths.py` |
| 자동 포맷팅 | 디스패처 내부 호출 | `.codex/hooks/format_code.sh` |
| 자동 린트 수정 | 디스패처 내부 호출 | `.codex/hooks/lint_code.sh` |
| Storybook 스토리 자동 생성 | 디스패처 내부 호출 | `.codex/hooks/create_storybook.py` |

설정 파일:
- `.codex/config.toml` (`notify = ["python3", ".codex/hooks/notify_dispatch.py"]`)

주의:
- `.codex/hooks/session_start.sh`는 Codex 호환 안내용 파일이며 자동 실행되지 않음
- `protect_paths.py`는 사전 차단이 아닌 사후 점검(경고) 방식으로 동작

---

## 🤖 에이전트 역할 매핑

Codex에서는 `.claude/agents/*.md` 원문을 `.codex/skills/*/SKILL.md`로 이식해 사용:

| 역할 | 원본 에이전트 | Codex 스킬 |
|------|---------------|------------|
| UI 설계 | `.claude/agents/ui-designer.md` | `.codex/skills/ui-designer/SKILL.md` |
| UI 구현 | `.claude/agents/frontend-implementer.md` | `.codex/skills/frontend-implementer/SKILL.md` |
| UI 리뷰 | `.claude/agents/ui-reviewer.md` | `.codex/skills/ui-reviewer/SKILL.md` |
| 접근성 감사 | `.claude/agents/a11y-auditor.md` | `.codex/skills/a11y-auditor/SKILL.md` |
| 디자인 시스템 정합 | `.claude/agents/design-system-keeper.md` | `.codex/skills/design-system-keeper/SKILL.md` |

---

## ⚡ 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
touch .env.local
# .env.local에 ANTHROPIC_API_KEY 입력

# 3. 개발 서버 실행
npm run dev
```

---

## 🔑 핵심 원칙 요약

- TypeScript 엄격 모드 — `any` 절대 금지
- API 키는 서버사이드 전용 (`/app/api/` 에서만)
- 컴포넌트 200줄 초과 시 분리
- `'use client'` 최소화
- 모바일 퍼스트 반응형 필수

---

## 📁 주요 파일 위치

```text
/lib/types/index.ts          → 모든 타입 정의
/lib/agents/prompts.ts       → 에이전트 시스템 프롬프트
/lib/agents/recommend.ts     → 에이전트 추천 로직 + 메타 정보
/lib/agents/blueprints.ts    → 청사진 정적 데이터
/app/api/chat/route.ts       → Claude API 연동 엔드포인트

/.codex/config.toml          → Codex 로컬 설정 (notify hook)
/.codex/hooks/*              → Codex notify 기반 자동화 스크립트
/.codex/skills/*/SKILL.md    → Codex 스킬 정의
```
