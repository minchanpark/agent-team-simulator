#!/usr/bin/env bash
# format_code.sh — Codex notify 기반 Prettier 포맷팅

set -euo pipefail

if [ $# -lt 2 ]; then
  exit 0
fi

CWD="$1"
shift

if [ ! -d "$CWD" ]; then
  exit 0
fi

export PATH="$CWD/node_modules/.bin:$PATH"

if ! command -v prettier >/dev/null 2>&1; then
  exit 0
fi

TARGETS=()
for FILE in "$@"; do
  [ -f "$CWD/$FILE" ] || continue
  case "$FILE" in
    *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.md|*.json)
      TARGETS+=("$FILE")
      ;;
    *)
      ;;
  esac
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  exit 0
fi

if npx prettier --write "${TARGETS[@]}" >/dev/null 2>&1; then
  echo "✅ Prettier 포맷팅 완료 (${#TARGETS[@]} files)"
else
  echo "⚠️ Prettier 포맷팅 실패" >&2
fi
