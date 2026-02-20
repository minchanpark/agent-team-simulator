#!/usr/bin/env bash
# session_start.sh — Codex 호환 안내 스크립트
#
# Codex는 Claude의 SessionStart 훅을 지원하지 않습니다.
# 이 파일은 호환성/기록 목적으로만 유지됩니다.

set -euo pipefail

echo "ℹ️ Codex에서는 SessionStart 훅이 없어 session_start.sh는 자동 실행되지 않습니다."
