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

## 🛠 기술 스택

- Next.js 14 (App Router)
- Tailwind CSS
- Claude API (Anthropic)
- Vercel (배포)
- Supabase (선택)
