# CLAUDE.md — AI 에이전트 팀 시뮬레이터

이 파일은 Claude Code가 이 프로젝트를 작업할 때 가장 먼저 읽어야 하는 파일입니다.

---

## 🚀 프로젝트 개요

**서비스:** AI 에이전트 팀 시뮬레이터
**설명:** 예비창업자가 자신의 스타트업에 맞는 AI 에이전트 팀을 구성하고, 직접 대화해보고, 구현 청사진까지 받아가는 웹 서비스
**스택:** Next.js 14 (App Router) + Tailwind CSS + Claude API
**배포:** Vercel

---

## 📚 문서 읽기 순서

작업 시작 전 반드시 아래 순서로 문서를 읽을 것:

1. `docs/PRD.md` — 제품 요구사항 전체 (기능, 페이지, API 명세)
2. `docs/AGENT_GUIDELINES.md` — 코딩 원칙, 폴더 구조, 개발 순서
3. `docs/AGENT_PROMPTS.md` — 에이전트 페르소나 프롬프트 (구현 코드 포함)

---

## 🛠 사용 가능한 Skills

작업 유형에 따라 아래 스킬을 참고할 것:

| 작업 | 스킬 파일 |
|------|-----------|
| 프론트엔드 UI/UX 설계 및 구현 산출물 작성 | `.claude/skills/frontend-design/SKILL.md` |

---

## 🪝 활성 Hooks

아래 훅은 항상 활성화 상태. 해당 조건 발생 시 자동으로 실행:

| 훅 | 트리거 | 파일 |
|----|--------|------|
| 세션 환경 설정 | `SessionStart` + `startup\|resume\|clear\|compact` | `.claude/hooks/session_start.sh` |
| 보호 파일 편집 차단 | `PreToolUse` + `Edit\|Write` | `.claude/hooks/protect_paths.py` |
| 자동 포맷팅 | `PostToolUse` + `Edit\|Write` | `.claude/hooks/format_code.sh` |
| 자동 린트 수정 | `PostToolUse` + `Edit\|Write` | `.claude/hooks/lint_code.sh` |
| Storybook 스토리 자동 생성 | `PostToolUse` + `Write` | `.claude/hooks/create_storybook.py` |

---

## 🤖 SubAgents 호출 기준

특정 작업은 전담 서브에이전트를 호출:

| 작업 | 서브에이전트 |
|------|-------------|
| UI 구조/토큰/컴포넌트 스펙 설계 | `.claude/agents/ui-designer.md` |
| UI 스펙 기반 React 구현 | `.claude/agents/frontend-implementer.md` |
| 출시 품질 기준 UI 리뷰 | `.claude/agents/ui-reviewer.md` |
| WCAG 2.1 AA 접근성 점검 | `.claude/agents/a11y-auditor.md` |
| 디자인 시스템 일관성 유지 | `.claude/agents/design-system-keeper.md` |

---

## ⚡ 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env.local
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

```
/lib/types/index.ts          → 모든 타입 정의
/lib/agents/prompts.ts       → 에이전트 시스템 프롬프트
/lib/agents/recommend.ts     → 에이전트 추천 로직 + 메타 정보
/lib/agents/blueprints.ts    → 청사진 정적 데이터
/app/api/chat/route.ts       → Claude API 연동 엔드포인트
```
