#!/usr/bin/env python3
"""
create_storybook.py — React 컴포넌트 생성 시 .stories.tsx 자동 생성
PostToolUse (Write) 훅
"""

import json
import sys
import os
import re

STORY_TEMPLATE = '''import type {{ Meta, StoryObj }} from "@storybook/react";
import {{ {component_name} }} from "./{file_stem}";

const meta: Meta<typeof {component_name}> = {{
  title: "Components/{component_name}",
  component: {component_name},
  tags: ["autodocs"],
}};

export default meta;
type Story = StoryObj<typeof {component_name}>;

export const Default: Story = {{
  args: {{}},
}};
'''

def extract_component_name(file_path: str) -> str | None:
    """파일에서 export된 React 컴포넌트 이름 추출"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (FileNotFoundError, PermissionError):
        return None

    # export default function ComponentName
    match = re.search(r"export\s+default\s+function\s+(\w+)", content)
    if match:
        return match.group(1)

    # export function ComponentName / export const ComponentName
    match = re.search(r"export\s+(?:function|const)\s+(\w+)", content)
    if match:
        return match.group(1)

    # 파일명 기반 fallback (PascalCase)
    stem = os.path.splitext(os.path.basename(file_path))[0]
    if stem[0].isupper():
        return stem

    return None

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

    # .tsx React 컴포넌트만 대상 (stories/test 파일 제외)
    if not file_path.endswith(".tsx"):
        sys.exit(0)

    basename = os.path.basename(file_path)
    if any(
        keyword in basename.lower()
        for keyword in ["stories", "test", "spec", ".d.", "layout", "page"]
    ):
        sys.exit(0)

    # stories 파일 경로 생성
    dir_name = os.path.dirname(file_path)
    file_stem = os.path.splitext(basename)[0]
    story_path = os.path.join(dir_name, f"{file_stem}.stories.tsx")

    # 이미 존재하면 스킵
    if os.path.exists(story_path):
        sys.exit(0)

    component_name = extract_component_name(file_path)
    if not component_name:
        sys.exit(0)

    # stories 파일 생성
    story_content = STORY_TEMPLATE.format(
        component_name=component_name,
        file_stem=file_stem,
    )

    try:
        with open(story_path, "w", encoding="utf-8") as f:
            f.write(story_content)
        print(f"✅ Storybook 파일 자동 생성: {story_path}")
    except OSError as e:
        print(f"⚠️ Storybook 파일 생성 실패: {e}", file=sys.stderr)

    sys.exit(0)

if __name__ == "__main__":
    main()
