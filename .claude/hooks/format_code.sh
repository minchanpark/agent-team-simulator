#!/usr/bin/env bash
# format_code.sh — 파일 저장 후 prettier 자동 포맷팅
# PostToolUse (Edit|Write) 훅

set -euo pipefail

# 훅 입력(JSON)에서 파일 경로 추출
INPUT=$(cat /dev/stdin 2>/dev/null || echo "{}")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 지원 확장자 확인
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.md|*.json)
    if command -v prettier &>/dev/null || [ -f "$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier" ]; then
      npx prettier --write "$FILE_PATH" 2>/dev/null && \
        echo "✅ Prettier 포맷팅 완료: $FILE_PATH" || \
        echo "⚠️ Prettier 포맷팅 실패: $FILE_PATH" >&2
    fi
    ;;
  *)
    # 지원하지 않는 확장자는 무시
    ;;
esac
