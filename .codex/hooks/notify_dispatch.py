#!/usr/bin/env python3
"""
Codex notify hook dispatcher.

Codex `notify` hooks are invoked once per completed turn and receive a JSON
payload as the final argv argument. This dispatcher extracts the payload,
detects changed files from git status, then runs local hook scripts.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def parse_payload(argv: list[str]) -> dict | None:
    if not argv:
        return None
    raw = argv[-1]
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def changed_files(cwd: Path) -> list[str]:
    try:
        proc = subprocess.run(
            [
                "git",
                "-C",
                str(cwd),
                "status",
                "--porcelain",
                "--untracked-files=all",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return []

    if proc.returncode != 0:
        return []

    files: list[str] = []
    for line in proc.stdout.splitlines():
        if len(line) < 4:
            continue
        path = line[3:]
        # Rename format: "old/path -> new/path"
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        rel = path.strip()
        if not rel:
            continue
        if (cwd / rel).is_file():
            files.append(rel)
    # De-duplicate while preserving order.
    return list(dict.fromkeys(files))


def run_hook(command: list[str], cwd: Path) -> int:
    proc = subprocess.run(
        command,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.stdout:
        print(proc.stdout, end="")
    if proc.stderr:
        print(proc.stderr, end="", file=sys.stderr)
    return proc.returncode


def main() -> int:
    payload = parse_payload(sys.argv[1:])
    if not payload:
        return 0

    if payload.get("type") != "agent-turn-complete":
        return 0

    cwd_raw = payload.get("cwd") or "."
    cwd = Path(cwd_raw).resolve()
    if not cwd.exists():
        return 0

    files = changed_files(cwd)
    if not files:
        return 0

    hooks_dir = Path(__file__).resolve().parent
    base_args = ["--cwd", str(cwd), "--files", *files]

    run_hook(["python3", str(hooks_dir / "protect_paths.py"), *base_args], cwd)
    run_hook(["bash", str(hooks_dir / "format_code.sh"), str(cwd), *files], cwd)
    run_hook(["bash", str(hooks_dir / "lint_code.sh"), str(cwd), *files], cwd)
    run_hook(["python3", str(hooks_dir / "create_storybook.py"), *base_args], cwd)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
