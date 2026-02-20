# AI 에이전트 코딩 지침 (AGENT_GUIDELINES.md)

이 문서는 Claude Code 또는 다른 AI 코딩 에이전트가 이 프로젝트를 개발할 때 따라야 할 규칙과 원칙입니다.

---

## 🧭 프로젝트 컨텍스트

이 프로젝트는 **AI 에이전트 팀 시뮬레이터** 웹 서비스입니다.
예비창업자가 자신의 스타트업 아이디어를 입력하면, AI 에이전트 팀 구성을 추천받고 직접 대화할 수 있습니다.

**기술 스택:** Next.js 14 (App Router) + Tailwind CSS + Claude API
**배포:** Vercel
**문서 참조:** `/docs/PRD.md` (항상 먼저 읽을 것)

---

## 📁 폴더 구조 원칙

```
/app
  /api
    /chat          → Claude API 라우트 핸들러
  /onboarding      → 진단 폼 페이지
  /result          → 에이전트 팀 결과 페이지
  layout.tsx
  page.tsx         → 랜딩 페이지

/components
  /ui              → 재사용 가능한 기본 컴포넌트 (Button, Card, Input 등)
  /agents          → 에이전트 관련 컴포넌트 (AgentCard, ChatPanel 등)
  /onboarding      → 온보딩 폼 컴포넌트

/lib
  /agents          → 에이전트 페르소나 프롬프트 (agents/prompts.ts)
  /types           → TypeScript 타입 정의
  /utils           → 유틸리티 함수

/public
  /images

.env.local         → ANTHROPIC_API_KEY (절대 커밋 금지)
```

---

## ✅ 코딩 원칙

### 1. 컴포넌트 분리
- 하나의 컴포넌트는 하나의 역할만
- 200줄 이상이면 분리 고려
- `'use client'` 는 필요한 컴포넌트에만 최소한으로 사용

### 2. TypeScript
- 모든 파일은 TypeScript (.tsx / .ts)
- `any` 타입 사용 금지
- 에이전트 타입, 컨텍스트 타입은 `/lib/types/index.ts`에 중앙 관리

### 3. 환경변수
- API 키는 반드시 `.env.local` 사용
- 클라이언트에 노출되는 변수만 `NEXT_PUBLIC_` 접두사 사용
- Claude API 키는 서버사이드 (API Route) 에서만 사용

### 4. Claude API 호출
- 모든 Claude API 호출은 `/app/api/chat/route.ts` 에서만 처리
- 클라이언트에서 직접 Anthropic SDK 호출 금지
- 스트리밍 응답 사용 권장 (`stream: true`)

### 5. 에이전트 프롬프트
- 프롬프트는 `/lib/agents/prompts.ts` 에 중앙 관리
- 하드코딩 금지 — 반드시 `agentType`으로 동적 주입
- 사용자 컨텍스트 (idea, painPoints, teamSize) 는 항상 시스템 프롬프트에 포함

### 6. 상태 관리
- 온보딩 입력값은 React Context or Zustand로 전역 관리
- 채팅 히스토리는 컴포넌트 로컬 상태로 관리 (세션 내)
- URL 파라미터로 에이전트 타입 전달

### 7. 스타일링
- Tailwind 유틸리티 클래스만 사용
- 인라인 style 속성 사용 금지
- 공통 스타일은 `className` 변수로 추출

### 8. `.claude` 런타임 규칙
- 세션 시작(`startup|resume|clear|compact`) 시 `.claude/hooks/session_start.sh`가 실행되어 `NODE_ENV=development`와 `node_modules/.bin` PATH가 설정됨
- 파일 편집 전(`Edit|Write`)에 `.claude/hooks/protect_paths.py`가 실행되어 아래 경로는 편집 차단됨:
  - `.env`, `.env.local`, `.env.production`, `.git/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- 파일 편집 후(`Edit|Write`)에 아래 훅이 순서대로 실행됨:
  - `.claude/hooks/format_code.sh` → Prettier 자동 포맷
  - `.claude/hooks/lint_code.sh` → ESLint/Stylelint 자동 수정
- 파일 쓰기 후(`Write`)에 `.claude/hooks/create_storybook.py`가 실행되어, React 컴포넌트(`.tsx`) 생성 시 `.stories.tsx`를 자동 생성함
- Storybook 자동 생성 제외 대상: `stories`, `test`, `spec`, `.d.`, `layout`, `page`가 파일명에 포함된 경우

---

## 🤝 에이전트 협업 흐름

UI 관련 작업은 아래 순서를 기본으로 사용:

1. `ui-designer` — 구현 가능한 UI 스펙(레이아웃/토큰/상태) 설계
2. `frontend-implementer` — 스펙 기반 컴포넌트 구현
3. `ui-reviewer` — 출시 품질 기준 UI 리뷰
4. `a11y-auditor` — WCAG 2.1 AA 접근성 점검
5. `design-system-keeper` — 기존 토큰/컴포넌트 규칙 정합성 검증 및 메모리 갱신

- `ui-designer`, `ui-reviewer`, `a11y-auditor`는 읽기 중심(Plan) 역할
- `frontend-implementer`는 실제 코드 수정(acceptEdits) 역할
- `design-system-keeper`는 프로젝트 메모리(`memory: project`)를 활용해 규칙 재사용을 우선함

---

## 🚫 하지 말아야 할 것

- `console.log` 를 프로덕션 코드에 남기지 말 것
- API Route 없이 클라이언트에서 직접 외부 API 호출 금지
- `.env.local` 파일 커밋 금지 (`.gitignore` 확인)
- 보호 경로(`.env*`, lockfile, `.git/`)를 자동 편집으로 변경하려고 시도하지 말 것
- `any` 타입 사용 금지
- 하나의 파일에 모든 로직 몰아넣기 금지
- 주석 없는 복잡한 로직 작성 금지

---

## 🔧 개발 순서 가이드

AI 에이전트는 아래 순서로 개발을 진행할 것:

1. **프로젝트 초기화**
   - `npx create-next-app@latest` 실행
   - Tailwind 설정 확인
   - `.env.local` 생성 및 `.gitignore` 설정
   - 폴더 구조 생성

2. **타입 정의** (`/lib/types/index.ts`)
   - `AgentType`, `UserContext`, `Message` 타입 먼저 정의

3. **에이전트 프롬프트** (`/lib/agents/prompts.ts`)
   - 4개 에이전트 시스템 프롬프트 함수 작성

4. **API Route** (`/app/api/chat/route.ts`)
   - Claude API 연동 및 스트리밍 처리

5. **온보딩 페이지** (`/app/onboarding/page.tsx`)
   - 3스텝 폼 구현

6. **결과 페이지** (`/app/result/page.tsx`)
   - 에이전트 카드 렌더링

7. **채팅 인터페이스** (`/components/agents/ChatPanel.tsx`)
   - 에이전트 대화 UI 구현

8. **랜딩 페이지** (`/app/page.tsx`)
   - 히어로 섹션 + CTA

9. **청사진 페이지**
   - 정적 데이터 기반 카드 렌더링

10. **Vercel 배포**
    - 환경변수 설정 후 배포

---

## 📋 커밋 메시지 규칙

```
feat: 새로운 기능 추가
fix: 버그 수정
style: 스타일 변경 (기능 변화 없음)
refactor: 코드 리팩토링
docs: 문서 수정
chore: 설정 파일 수정
```

예시: `feat: 마케팅 에이전트 채팅 UI 구현`
