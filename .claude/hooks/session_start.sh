#!/usr/bin/env bash
# session_start.sh — 세션 시작 시 환경 설정
# SessionStart 훅에서만 $CLAUDE_ENV_FILE 사용 가능

set -euo pipefail

# node_modules/.bin을 PATH에 추가
if [ -f "$CLAUDE_ENV_FILE" ]; then
  echo "PATH=$CLAUDE_PROJECT_DIR/node_modules/.bin:\$PATH" >> "$CLAUDE_ENV_FILE"
  echo "NODE_ENV=development" >> "$CLAUDE_ENV_FILE"
fi

echo "✅ 세션 환경 설정 완료: NODE_ENV=development, node_modules/.bin PATH 추가"
