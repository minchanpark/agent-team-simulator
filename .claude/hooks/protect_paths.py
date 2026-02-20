#!/usr/bin/env python3
"""
protect_paths.py — 민감한 파일 편집 차단
PreToolUse (Edit|Write) 훅
exit 2 → 도구 실행 차단 + stderr 메시지를 Claude에게 전달
"""

import json
import sys
import os

PROTECTED_PATTERNS = [
    ".env",
    ".env.local",
    ".env.production",
    ".git/",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
]

def main():
    try:
        hook_input = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    file_path = (
        hook_input.get("tool_input", {}).get("file_path")
        or hook_input.get("tool_input", {}).get("path")
        or ""
    )

    if not file_path:
        sys.exit(0)

    # 절대경로를 상대경로로 변환
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    if project_dir and file_path.startswith(project_dir):
        rel_path = file_path[len(project_dir):].lstrip("/")
    else:
        rel_path = file_path

    for pattern in PROTECTED_PATTERNS:
        if rel_path == pattern or rel_path.startswith(pattern):
            print(
                f"🚫 보호된 파일입니다: {rel_path}\n"
                f"이 파일은 직접 편집할 수 없습니다. "
                f"수동으로 수정하세요.",
                file=sys.stderr,
            )
            sys.exit(2)  # exit 2 = 차단

    sys.exit(0)

if __name__ == "__main__":
    main()
