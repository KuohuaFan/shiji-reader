#!/usr/bin/env python3
"""Add row-and-cell aligned vernacular translations for the ten Shiji tables.

The job is resumable: every validated batch is atomically merged into its chapter's
editorial JSON. Four volumes run concurrently, while malformed model output is
retried and then recursively split into smaller groups.
"""

from __future__ import annotations

import concurrent.futures as futures
import http.client
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = ROOT / "client" / "src" / "content" / "chapters"
EDITORIAL = ROOT / "client" / "src" / "content" / "editorial"
MODEL = "gpt-5-mini"
MAX_WORKERS = 4
MAX_BATCH_CHARS = 2_400
MAX_BATCH_ROWS = 90


def call_llm(items: list[dict[str, Any]], title: str, label: str) -> list[list[str]]:
    schema = {
        "type": "object",
        "properties": {
            "rows": {
                "type": "array",
                "items": {"type": "array", "items": {"type": "string"}},
            }
        },
        "required": ["rows"],
        "additionalProperties": False,
    }
    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "你是嚴謹的《史記》年表翻譯者。"},
            {
                "role": "user",
                "content": f"請把《史記》〈{title}〉下列年表逐格改寫為清楚的繁體中文白話。"
                f"rows 必須恰好包含 {len(items)} 個陣列，按 position 依序對應；每列欄數必須和輸入 cells 完全相同。"
                "人名、國名、爵位、年號及數字不得遺漏；不要輸出 position。只輸出指定 JSON。若文字已無須翻譯，原樣保留。\n"
                + json.dumps(items, ensure_ascii=False),
            },
        ],
        "max_completion_tokens": 9_000,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": f"shiji_table_{label}", "strict": True, "schema": schema},
        },
    }
    base = os.environ["OPENAI_API_BASE"].rstrip("/")
    request = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(1):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                result = json.load(response)
            return json.loads(result["choices"][0]["message"]["content"])["rows"]
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            http.client.HTTPException,
            ConnectionError,
            TimeoutError,
            KeyError,
            json.JSONDecodeError,
        ) as error:
            last_error = error
    raise RuntimeError(f"LLM request failed: {last_error}")


def valid_result(items: list[dict[str, Any]], rows: Any) -> bool:
    return (
        isinstance(rows, list)
        and len(rows) == len(items)
        and all(
            isinstance(result, list)
            and len(result) == len(source["cells"])
            and all(isinstance(cell, str) for cell in result)
            for source, result in zip(items, rows)
        )
    )


def translate_group(items: list[dict[str, Any]], title: str, label: str, depth: int = 0) -> list[list[str]]:
    def translate_single_cells(source: dict[str, Any]) -> list[list[str]]:
        translated_cells: list[str] = []
        for cell_index, cell in enumerate(source["cells"]):
            if not cell:
                translated_cells.append("")
                continue
            cell_item = [{"position": cell_index + 1, "cells": [cell]}]
            result: list[list[str]] = []
            for attempt in range(2):
                try:
                    candidate = call_llm(cell_item, title, f"{label}_cell_{cell_index}_{attempt}")
                    if valid_result(cell_item, candidate):
                        result = candidate
                        break
                except RuntimeError:
                    pass
            if not result:
                raise RuntimeError(f"persistent cell mismatch at {source['position']}:{cell_index}")
            translated_cells.append(result[0][0])
        return [translated_cells]

    if items and all(len(item["cells"]) >= 12 and sum(bool(cell) for cell in item["cells"]) <= 4 for item in items):
        flattened: list[dict[str, Any]] = []
        locations: list[tuple[int, int]] = []
        rebuilt = [["" for _ in item["cells"]] for item in items]
        for row_index, item in enumerate(items):
            for cell_index, cell in enumerate(item["cells"]):
                if cell:
                    flattened.append({"position": f"{item['position']}:{cell_index}", "cells": [cell]})
                    locations.append((row_index, cell_index))
        translated = translate_group(flattened, title, f"{label}_flat", depth + 1) if flattened else []
        for (row_index, cell_index), cell_result in zip(locations, translated):
            rebuilt[row_index][cell_index] = cell_result[0]
        return rebuilt
    for attempt in range(2):
        try:
            rows = call_llm(items, title, f"{label}_{depth}_{attempt}")
            if valid_result(items, rows):
                return rows
        except RuntimeError:
            pass
    if len(items) == 1:
        return translate_single_cells(items[0])
    midpoint = len(items) // 2
    return translate_group(items[:midpoint], title, f"{label}a", depth + 1) + translate_group(
        items[midpoint:], title, f"{label}b", depth + 1
    )


def make_batches(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    batches: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    size = 0
    current_sparse: bool | None = None
    for row in rows:
        row_size = sum(len(cell) for cell in row["cells"]) + len(row["cells"]) * 4
        sparse = len(row["cells"]) >= 12 and sum(bool(cell) for cell in row["cells"]) <= 4
        row_limit = 5 if sparse else MAX_BATCH_ROWS
        if current and (sparse != current_sparse or size + row_size > MAX_BATCH_CHARS or len(current) >= row_limit):
            batches.append(current)
            current, size = [], 0
            current_sparse = None
        if not current:
            current_sparse = sparse
        current.append(row)
        size += row_size
    if current:
        batches.append(current)
    return batches


def source_rows(chapter: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for section_index, section in enumerate(chapter["sections"]):
        for block_index, block in enumerate(section["blocks"]):
            if block["type"] != "table":
                continue
            for row_index, cells in enumerate(block["rows"]):
                rows.append({"position": f"{section_index}:{block_index}:{row_index}", "cells": cells})
    return rows


def item_key(item: dict[str, Any]) -> tuple[int, int, int]:
    return (int(item["sectionIndex"]), int(item["blockIndex"]), int(item["rowIndex"]))


def source_key(item: dict[str, Any]) -> tuple[int, int, int]:
    return tuple(map(int, item["position"].split(":")))  # type: ignore[return-value]


def write_editorial(target: Path, editorial: dict[str, Any], translated: dict[tuple[int, int, int], list[str]]) -> None:
    editorial["tableTranslations"] = [
        {"sectionIndex": key[0], "blockIndex": key[1], "rowIndex": key[2], "cells": cells}
        for key, cells in sorted(translated.items())
    ]
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(editorial, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(target)


def generate_volume(volume: int) -> str:
    chapter = json.loads((CHAPTERS / f"{volume:03d}.json").read_text(encoding="utf-8"))
    target = EDITORIAL / f"{volume:03d}.json"
    if not target.exists():
        raise RuntimeError(f"editorial volume {volume:03d} is missing")
    editorial = json.loads(target.read_text(encoding="utf-8"))
    source = source_rows(chapter)
    expected = {source_key(item): len(item["cells"]) for item in source}
    translated: dict[tuple[int, int, int], list[str]] = {}
    for item in editorial.get("tableTranslations", []):
        try:
            key = item_key(item)
            cells = item["cells"]
        except (KeyError, TypeError, ValueError):
            continue
        if key in expected and isinstance(cells, list) and len(cells) == expected[key] and all(isinstance(cell, str) for cell in cells):
            translated[key] = cells
    missing = [item for item in source if source_key(item) not in translated]
    if not missing:
        return f"{volume:03d} skip ({len(source)} rows)"
    groups = make_batches(missing)
    for batch_index, group in enumerate(groups, start=1):
        received = translate_group(group, chapter["title"], f"{volume}_{batch_index}")
        for source_item, cells in zip(group, received):
            translated[source_key(source_item)] = cells
        write_editorial(target, editorial, translated)
        print(f"{volume:03d} batch {batch_index}/{len(groups)} ({len(translated)}/{len(source)} rows)", flush=True)
    if set(translated) != set(expected):
        raise RuntimeError(f"volume {volume:03d} still incomplete")
    return f"{volume:03d} ok ({len(translated)} rows)"


def main() -> None:
    failures: list[tuple[int, str]] = []
    with futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {executor.submit(generate_volume, volume): volume for volume in range(13, 23)}
        for future in futures.as_completed(future_map):
            volume = future_map[future]
            try:
                print(future.result(), flush=True)
            except Exception as error:  # noqa: BLE001
                failures.append((volume, str(error)))
                print(f"{volume:03d} FAILED: {error}", flush=True)
    if failures:
        print(json.dumps({"failures": failures}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
    print("TABLE_TRANSLATIONS_OK", flush=True)


if __name__ == "__main__":
    main()
