#!/usr/bin/env bash
# lint_code.sh — 파일 저장 후 eslint/stylelint 자동 실행
# PostToolUse (Edit|Write) 훅

set -euo pipefail

INPUT=$(cat /dev/stdin 2>/dev/null || echo "{}")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    if command -v eslint &>/dev/null || [ -f "$CLAUDE_PROJECT_DIR/node_modules/.bin/eslint" ]; then
      npx eslint --fix "$FILE_PATH" 2>/dev/null && \
        echo "✅ ESLint 수정 완료: $FILE_PATH" || \
        echo "⚠️ ESLint 실행 실패: $FILE_PATH" >&2
    fi
    ;;
  *.css|*.scss)
    if command -v stylelint &>/dev/null || [ -f "$CLAUDE_PROJECT_DIR/node_modules/.bin/stylelint" ]; then
      npx stylelint --fix "$FILE_PATH" 2>/dev/null && \
        echo "✅ Stylelint 수정 완료: $FILE_PATH" || \
        echo "⚠️ Stylelint 실행 실패: $FILE_PATH" >&2
    fi
    ;;
  *)
    ;;
esac
