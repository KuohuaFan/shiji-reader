#!/usr/bin/env python3
"""Generate per-chapter relationship graphs and timelines with quote verification."""

from __future__ import annotations

import concurrent.futures as futures
import http.client
import json
import os
import re
import tempfile
import time
import urllib.error
import urllib.request
import traceback
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = ROOT / "client" / "src" / "content" / "chapters"
EDITORIAL = ROOT / "client" / "src" / "content" / "editorial"
OUTPUT = ROOT / "client" / "src" / "content" / "context"
MODEL = "gpt-5-mini"
MAX_WORKERS = 4

SCHEMA = {
    "type": "object",
    "properties": {
        "period": {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "startYear": {"type": "integer"},
                "endYear": {"type": "integer"},
            },
            "required": ["label", "startYear", "endYear"],
            "additionalProperties": False,
        },
        "people": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "group": {"type": "string"},
                    "summary": {"type": "string"},
                },
                "required": ["name", "role", "group", "summary"],
                "additionalProperties": False,
            },
        },
        "relationships": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "target": {"type": "string"},
                    "type": {"type": "string", "enum": ["親屬", "君臣", "盟友", "對立", "師友", "繼承", "其他"]},
                    "label": {"type": "string"},
                    "evidence": {"type": "string"},
                },
                "required": ["source", "target", "type", "label", "evidence"],
                "additionalProperties": False,
            },
        },
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer"},
                    "yearLabel": {"type": "string"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "people": {"type": "array", "items": {"type": "string"}},
                    "type": {"type": "string", "enum": ["即位", "戰爭", "封建", "政治", "制度", "遷徙", "出生", "逝世", "其他"]},
                    "evidence": {"type": "string"},
                },
                "required": ["year", "yearLabel", "title", "description", "people", "type", "evidence"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["period", "people", "relationships", "events"],
    "additionalProperties": False,
}

CUES = re.compile(r"年|元年|歲|月|日|立|王|帝|崩|薨|卒|殺|誅|伐|攻|戰|反|封|徙|子|父|母|兄|弟|妻|婚|臣|將|相|侯")


def clean(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def text_blocks(chapter: dict[str, Any]) -> list[str]:
    blocks: list[str] = []
    for section in chapter["sections"]:
        heading = section.get("heading", "")
        for block in section["blocks"]:
            if block["type"] == "text":
                blocks.append(f"【{heading or '正文'}】{block['text']}")
            else:
                for row in block["rows"]:
                    row_text = "｜".join(row)
                    if row_text.strip("｜"):
                        blocks.append(f"【{heading or '年表'}】{row_text}")
    return blocks


def source_excerpt(chapter: dict[str, Any], editorial: dict[str, Any]) -> str:
    people = [person["name"] for person in editorial.get("people", [])]
    candidates = text_blocks(chapter)
    scored = []
    for index, item in enumerate(candidates):
        score = (4 if CUES.search(item) else 0) + sum(3 for name in people if name and name in item)
        scored.append((score, index, item))
    selected: list[str] = []
    size = 0
    for _, _, item in sorted(scored, key=lambda value: (-value[0], value[1])):
        if size + len(item) > 34_000:
            continue
        selected.append(item)
        size += len(item)
        if size >= 30_000:
            break
    return "\n".join(selected)


def valid_existing(path: Path, volume: int) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("volume") == volume and isinstance(data.get("people"), list) and isinstance(data.get("events"), list)
    except (OSError, json.JSONDecodeError):
        return False


def generate(volume: int) -> str:
    target = OUTPUT / f"{volume:03d}.json"
    if valid_existing(target, volume):
        return f"{volume:03d} skip"
    chapter = json.loads((CHAPTERS / f"{volume:03d}.json").read_text(encoding="utf-8"))
    editorial = json.loads((EDITORIAL / f"{volume:03d}.json").read_text(encoding="utf-8"))
    source = source_excerpt(chapter, editorial)
    people_seed = editorial.get("people", [])[:16]
    prompt = (
        f"請為《史記》{chapter['volumeLabel']}〈{chapter['title']}〉建立人物關係圖與互動年代軸資料。\n"
        "規則：只使用下方本站篇章資料；人物以本篇最重要者為主，最多 16 人。"
        "關係最多 24 條；source/target 必須完全等於 people.name；evidence 必須是下方原文中的連續原句，最多 120 字。"
        "事件最多 18 條；依敘事順序，evidence 必須是原文連續原句。"
        "公元前年份用負整數，例如前206年為 -206；資料只載紀年而不能可靠換算時，year=0 並把原紀年寫入 yearLabel。"
        "不可為了湊數而推測；沒有可靠年份就留 null。輸出繁體中文。\n\n"
        f"既有導讀人物：{json.dumps(people_seed, ensure_ascii=False)}\n"
        f"歷史脈絡：{editorial.get('historicalContext', '')}\n"
        f"原文節錄：\n{source}"
    )
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            body = {
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": "你是謹慎的《史記》數位人文資料編輯。只抽取可由給定文本支持的關係與事件。"},
                    {"role": "user", "content": prompt},
                ],
                "max_completion_tokens": 9000,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {"name": f"shiji_context_{volume}", "strict": True, "schema": SCHEMA},
                },
            }
            base = os.environ["OPENAI_API_BASE"].rstrip("/")
            request = urllib.request.Request(
                f"{base}/chat/completions",
                data=json.dumps(body, ensure_ascii=False).encode(),
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=240) as response:
                response_data = json.load(response)
            if not response_data.get("choices"):
                raise RuntimeError(json.dumps(response_data, ensure_ascii=False)[:1600])
            content = response_data["choices"][0]["message"]["content"]
            if not content:
                raise RuntimeError("empty model response")
            result = json.loads(content)
            break
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            http.client.HTTPException,
            ConnectionError,
            TimeoutError,
            KeyError,
            TypeError,
            json.JSONDecodeError,
        ) as error:
            last_error = error
            if attempt == 3:
                raise RuntimeError(str(last_error))
            time.sleep(2 ** attempt)
    else:
        raise RuntimeError(str(last_error))

    source_compact = clean(source)
    people: list[dict[str, str]] = []
    seen_people: set[str] = set()
    for person in result["people"]:
        name = clean(person["name"])
        if not name or name in seen_people:
            continue
        seen_people.add(name)
        people.append({**person, "id": f"p{len(people) + 1}", "name": name})
    names = {person["name"] for person in people}
    relationships = []
    for relation in result["relationships"]:
        evidence = clean(relation["evidence"])
        if relation["source"] not in names or relation["target"] not in names or not evidence or evidence not in source_compact:
            continue
        relationships.append({**relation, "id": f"r{len(relationships) + 1}", "evidence": evidence[:120]})
    events = []
    for event in result["events"]:
        evidence = clean(event["evidence"])
        if not evidence or evidence not in source_compact:
            continue
        year = event["year"]
        events.append({
            **event,
            "id": f"e{len(events) + 1}",
            "year": year,
            "people": [name for name in event["people"] if name in names],
            "evidence": evidence[:120],
        })
    events.sort(key=lambda event: (event["year"] == 0, event["year"] if event["year"] != 0 else 10**9))
    payload = {
        "id": f"{volume:03d}",
        "volume": volume,
        "title": chapter["title"],
        "model": MODEL,
        "reviewStatus": "AI結構化初稿，待人工校訂",
        "period": result["period"],
        "people": people,
        "relationships": relationships,
        "events": events,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=OUTPUT, delete=False, suffix=".tmp") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        temp_name = handle.name
    Path(temp_name).replace(target)
    return f"{volume:03d} ok p={len(people)} r={len(relationships)} e={len(events)}"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    failures: list[tuple[int, str]] = []
    requested = os.environ.get("SHIJI_VOLUMES", "").strip()
    volumes = [int(item) for item in requested.split(",") if item.strip()] if requested else list(range(1, 131))
    with futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        jobs = {executor.submit(generate, volume): volume for volume in volumes}
        for job in futures.as_completed(jobs):
            volume = jobs[job]
            try:
                print(job.result(), flush=True)
            except Exception as error:  # noqa: BLE001
                failures.append((volume, str(error)))
                print(f"{volume:03d} FAILED {error}", flush=True)
                if len(volumes) == 1:
                    traceback.print_exc()
    if failures:
        print(json.dumps({"failures": failures}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
    print("CONTEXT_GENERATION_OK", flush=True)


if __name__ == "__main__":
    main()
