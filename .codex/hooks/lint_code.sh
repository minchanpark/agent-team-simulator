#!/usr/bin/env bash
# lint_code.sh — Codex notify 기반 ESLint/Stylelint 자동 수정

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

JS_TARGETS=()
CSS_TARGETS=()

for FILE in "$@"; do
  [ -f "$CWD/$FILE" ] || continue
  case "$FILE" in
    *.ts|*.tsx|*.js|*.jsx) JS_TARGETS+=("$FILE") ;;
    *.css|*.scss) CSS_TARGETS+=("$FILE") ;;
    *) ;;
  esac
done

if [ ${#JS_TARGETS[@]} -gt 0 ] && command -v eslint >/dev/null 2>&1; then
  if npx eslint --fix "${JS_TARGETS[@]}" >/dev/null 2>&1; then
    echo "✅ ESLint 수정 완료 (${#JS_TARGETS[@]} files)"
  else
    echo "⚠️ ESLint 실행 실패" >&2
  fi
fi

if [ ${#CSS_TARGETS[@]} -gt 0 ] && command -v stylelint >/dev/null 2>&1; then
  if npx stylelint --fix "${CSS_TARGETS[@]}" >/dev/null 2>&1; then
    echo "✅ Stylelint 수정 완료 (${#CSS_TARGETS[@]} files)"
  else
    echo "⚠️ Stylelint 실행 실패" >&2
  fi
fi
