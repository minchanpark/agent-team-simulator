# AI 에이전트 팀 시뮬레이터

예비창업자가 자신의 스타트업에 맞는 AI 에이전트 팀을 구성하고, 직접 대화해보고, 구현 청사진까지 받아가는 웹 서비스.

## 📁 문서

| 파일 | 설명 |
|------|------|
| `docs/PRD.md` | 제품 요구사항 정의서 — 기능, 페이지 구조, API 설계 |
| `docs/AGENT_GUIDELINES.md` | AI 코딩 에이전트를 위한 개발 지침 — 폴더 구조, 코딩 원칙, 개발 순서 |
| `docs/AGENT_PROMPTS.md` | 에이전트 페르소나 프롬프트 원본 + 코드 구현 예시 |
| `CLAUDE.md` | Claude 작업 운영 기준 — `.claude`의 Skill/Hook/Agent 매핑 진입점 |

## 🤖 Claude 운영 현황

- Skills: 1개 (`.claude/skills/frontend-design/SKILL.md`)
- Hooks: 5개 (`session_start`, `protect_paths`, `format_code`, `lint_code`, `create_storybook`)
- Agents: 5개 (`ui-designer`, `frontend-implementer`, `ui-reviewer`, `a11y-auditor`, `design-system-keeper`)
- 상세 운영 규칙: `CLAUDE.md`

## 🚀 시작하기

```bash
# Claude Code에게 첫 번째로 전달할 명령
"docs/PRD.md와 docs/AGENT_GUIDELINES.md를 읽고 Next.js 프로젝트를 초기화해줘"
```

## 🔐 API 보안 가드레일

- 공통 요청 가드 적용 경로:
  - `/api/chat`
  - `/api/team/turn`
  - `/api/team/export-md`
  - `/api/team/events`
- 기본 제한:
  - `/api/chat`: 분당 12회/IP, 일 120회/IP, 본문 64KB, `messages <= 30`, 메시지당 1200자, 총 18000자
  - `/api/team/turn`: 분당 6회/IP, 일 60회/IP, 본문 64KB, `messages <= 40`, 메시지당 1200자, 총 24000자
  - `/api/team/export-md`: 분당 10회/IP
  - `/api/team/events`: 분당 30회/IP
- 보안 환경변수:
  - `ALLOWED_ORIGINS`: 콤마 구분 Origin allowlist (미설정 시 same-origin만 허용)
  - `SECURITY_GUARDS_ENABLED`: `true/false` (미설정 시 production에서 기본 `true`)

### 운영 한계

- 현재 rate limit은 인메모리 방식이라 인스턴스 간 공유되지 않으며 프로세스 재시작 시 초기화됩니다.
- 분산 환경에서 강한 보장이 필요하면 추후 Redis/Upstash 등 외부 저장소 기반으로 교체해야 합니다.

## 🛠 기술 스택

- Next.js 14 (App Router)
- Tailwind CSS
- Claude API (Anthropic)
- Vercel (배포)
- Supabase (선택)
