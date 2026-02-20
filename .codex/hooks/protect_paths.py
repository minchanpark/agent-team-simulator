#!/usr/bin/env python3
"""
protect_paths.py — Codex notify 기반 보호 경로 점검

Codex notify 훅은 turn 완료 후 실행되므로 편집을 사전에 차단할 수 없습니다.
대신, 변경 목록에 보호 경로가 포함되어 있으면 경고를 출력합니다.
"""

import argparse
import sys
from pathlib import Path

PROTECTED_PATTERNS = [
    ".env",
    ".env.local",
    ".env.production",
    ".git/",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
]

def is_protected(rel_path: str) -> bool:
    for pattern in PROTECTED_PATTERNS:
        if rel_path == pattern or rel_path.startswith(pattern):
            return True
    return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cwd", default=".")
    parser.add_argument("--files", nargs="*", default=[])
    args = parser.parse_args()

    cwd = Path(args.cwd).resolve()
    hits: list[str] = []

    for raw in args.files:
        rel_path = raw
        abs_path = Path(raw)
        if abs_path.is_absolute():
            try:
                rel_path = str(abs_path.resolve().relative_to(cwd))
            except ValueError:
                rel_path = raw
        if is_protected(rel_path):
            hits.append(rel_path)

    if hits:
        unique_hits = list(dict.fromkeys(hits))
        print("🚫 보호 경로 변경 감지:", file=sys.stderr)
        for item in unique_hits:
            print(f"- {item}", file=sys.stderr)
        print("수동 검토 후 커밋하세요.", file=sys.stderr)

    sys.exit(0)

if __name__ == "__main__":
    main()
