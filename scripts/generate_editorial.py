#!/usr/bin/env python3
"""Generate complete per-paragraph vernacular translations and chapter guides.

Uses the Manus built-in OpenAI-compatible proxy. Existing valid chapter files are
skipped, so the job is safely resumable. Outputs remain separate from source text.
"""

from __future__ import annotations

import concurrent.futures as futures
import http.client
import json
import os
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CHAPTER_DIR = ROOT / "client" / "src" / "content" / "chapters"
OUTPUT_DIR = ROOT / "client" / "src" / "content" / "editorial"
MODEL = "gpt-5-mini"
MAX_CHARS = 5200
MAX_WORKERS = 5
PRINT_LOCK = threading.Lock()


def endpoint() -> str:
    base = os.environ.get("OPENAI_API_BASE", "").rstrip("/")
    if not base:
        raise RuntimeError("OPENAI_API_BASE is not configured")
    return f"{base}/chat/completions"


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return key


def chat(messages: list[dict[str, str]], schema_name: str, schema: dict[str, Any], max_tokens: int) -> Any:
    body = {
        "model": MODEL,
        "messages": messages,
        "max_completion_tokens": max_tokens,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        },
    }
    request = urllib.request.Request(
        endpoint(),
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key()}", "Content-Type": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                payload = json.load(response)
            content = payload["choices"][0]["message"]["content"]
            return json.loads(content)
        except (urllib.error.URLError, urllib.error.HTTPError, http.client.HTTPException, ConnectionError, TimeoutError, KeyError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == 5:
                break
            time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f"LLM request failed: {last_error}")


def text_items(chapter: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for section_index, section in enumerate(chapter["sections"]):
        for block_index, block in enumerate(section["blocks"]):
            if block["type"] == "text":
                items.append(
                    {
                        "id": f"s{section_index}b{block_index}",
                        "sectionIndex": section_index,
                        "blockIndex": block_index,
                        "section": section["heading"],
                        "original": block["text"],
                    }
                )
    return items


def batches(items: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    result: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    size = 0
    for item in items:
        item_size = len(item["original"])
        if current and size + item_size > MAX_CHARS:
            result.append(current)
            current = []
            size = 0
        current.append(item)
        size += item_size
    if current:
        result.append(current)
    return result


def generate_translations(chapter: dict[str, Any], items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    schema = {
        "type": "object",
        "properties": {
            "translations": {
                "type": "array",
                "items": {"type": "string"},
            }
        },
        "required": ["translations"],
        "additionalProperties": False,
    }
    def translate_group(group: list[dict[str, Any]], label: str, depth: int = 0) -> list[str]:
        source = [{"position": index + 1, "section": item["section"], "text": item["original"]} for index, item in enumerate(group)]
        prompt = (
            f"篇名：{chapter['title']}（{chapter['category']}，{chapter['volumeLabel']}）\n"
            "請把下列《史記》文言原文逐段翻譯為準確、通順的繁體中文白話文。"
            "不得刪節，不得合併段落，不得加入原文沒有的史實；人名、地名、官名要保留。"
            f"translations 必須恰好含 {len(group)} 個字串，按 position 順序一一對應，不得輸出 position 或其他欄位。只輸出指定 JSON。\n"
            + json.dumps(source, ensure_ascii=False)
        )
        for attempt in range(3):
            data = chat(
                [
                    {"role": "system", "content": "你是嚴謹的中國古典文獻翻譯者，專精《史記》。"},
                    {"role": "user", "content": prompt},
                ],
                f"shiji_translation_{chapter['volume']}_{label}_{depth}_{attempt}",
                schema,
                18000,
            )
            received = data["translations"]
            if len(received) == len(group) and all(text.strip() for text in received):
                return received
        if len(group) == 1:
            raise RuntimeError(f"persistent translation mismatch in volume {chapter['volume']} at {group[0]['id']}")
        midpoint = len(group) // 2
        return translate_group(group[:midpoint], f"{label}a", depth + 1) + translate_group(group[midpoint:], f"{label}b", depth + 1)

    for group_index, group in enumerate(batches(items), start=1):
        received = translate_group(group, str(group_index))
        output.extend(
            {
                "sectionIndex": source_item["sectionIndex"],
                "blockIndex": source_item["blockIndex"],
                "text": translation.strip(),
            }
            for source_item, translation in zip(group, received)
        )
    return output


def generate_guide(chapter: dict[str, Any]) -> dict[str, Any]:
    original = "\n".join(
        f"【{section['heading'] or '正文'}】\n" + "\n".join(
            block["text"] if block["type"] == "text" else "（年表資料）"
            for block in section["blocks"]
        )
        for section in chapter["sections"]
    )
    schema = {
        "type": "object",
        "properties": {
            "purpose": {"type": "string"},
            "overview": {"type": "string"},
            "historicalContext": {"type": "string"},
            "themes": {"type": "array", "items": {"type": "string"}},
            "people": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "role": {"type": "string"},
                        "significance": {"type": "string"},
                    },
                    "required": ["name", "role", "significance"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["purpose", "overview", "historicalContext", "themes", "people"],
        "additionalProperties": False,
    }
    prompt = (
        f"請依據下列《史記》〈{chapter['title']}〉原文，撰寫繁體中文閱讀導引。"
        "purpose 為 80–160 字篇旨；overview 為 180–350 字內容概述；historicalContext 為 100–220 字時代與寫作脈絡；"
        "themes 列 3–6 個主題；people 選 3–12 位本篇關鍵人物，說明身分與本篇意義。"
        "只依據原文與可靠的《史記》常識，不虛構年代、引文或評價；若本篇是表，著重表的編纂功能。\n\n"
        + original
    )
    return chat(
        [
            {"role": "system", "content": "你是嚴謹的《史記》導讀編輯，清楚區分原文、解釋與評述。"},
            {"role": "user", "content": prompt},
        ],
        f"shiji_guide_{chapter['volume']}",
        schema,
        5000,
    )


def valid_existing(path: Path, items: list[dict[str, Any]]) -> bool:
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return False
    translations = data.get("translations", [])
    keys = [(item.get("sectionIndex"), item.get("blockIndex")) for item in translations]
    expected_keys = [(item["sectionIndex"], item["blockIndex"]) for item in items]
    return (
        data.get("model") == MODEL
        and keys == expected_keys
        and len(set(keys)) == len(items)
        and bool(data.get("purpose"))
        and bool(data.get("overview"))
        and bool(data.get("historicalContext"))
        and len(data.get("themes", [])) >= 3
        and bool(data.get("people"))
    )


def generate_one(volume: int) -> str:
    chapter = json.loads((CHAPTER_DIR / f"{volume:03d}.json").read_text(encoding="utf-8"))
    items = text_items(chapter)
    target = OUTPUT_DIR / f"{volume:03d}.json"
    if valid_existing(target, items):
        return f"{volume:03d} skip"
    translations = generate_translations(chapter, items)
    guide = generate_guide(chapter)
    payload = {
        "id": f"{volume:03d}",
        "volume": volume,
        "title": chapter["title"],
        "model": MODEL,
        "generatedAt": "2026-09-08",
        "editorialNotice": "白話翻譯、篇旨與人物解說由 AI 依原文生成，屬輔助閱讀內容，非史記原文或三家註。",
        **guide,
        "translations": translations,
    }
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(target)
    return f"{volume:03d} ok ({len(items)} 段)"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    failures: list[tuple[int, str]] = []
    with futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        pending = {executor.submit(generate_one, volume): volume for volume in range(1, 131)}
        completed = 0
        for future in futures.as_completed(pending):
            volume = pending[future]
            completed += 1
            try:
                message = future.result()
            except Exception as error:
                failures.append((volume, str(error)))
                message = f"{volume:03d} FAILED: {error}"
            with PRINT_LOCK:
                print(f"[{completed:03d}/130] {message}", flush=True)
    if failures:
        print(json.dumps({"failures": failures}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
    print("EDITORIAL_GENERATION_OK", flush=True)


if __name__ == "__main__":
    main()
