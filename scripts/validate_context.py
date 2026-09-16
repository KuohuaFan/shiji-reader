#!/usr/bin/env python3
"""Validate all generated relationship and timeline files against chapter text."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHAPTERS = ROOT / "client" / "src" / "content" / "chapters"
CONTEXT = ROOT / "client" / "src" / "content" / "context"


def clean(text: str) -> str:
    text = re.sub(r"【[^】]+】", "", text)
    return re.sub(r"[\s｜]+", "", text).strip()


def corpus(chapter: dict) -> str:
    parts: list[str] = []
    for section in chapter["sections"]:
        for block in section["blocks"]:
            if block["type"] == "text":
                parts.append(block["text"])
            else:
                parts.extend(cell for row in block["rows"] for cell in row)
    return clean("".join(parts))


def main() -> None:
    errors: list[str] = []
    totals = {"chapters": 0, "people": 0, "relationships": 0, "events": 0, "datedEvents": 0}
    for volume in range(1, 131):
        chapter_path = CHAPTERS / f"{volume:03d}.json"
        context_path = CONTEXT / f"{volume:03d}.json"
        if not context_path.exists():
            errors.append(f"{volume:03d}: missing context")
            continue
        chapter = json.loads(chapter_path.read_text(encoding="utf-8"))
        context = json.loads(context_path.read_text(encoding="utf-8"))
        text = corpus(chapter)
        if context.get("volume") != volume or context.get("title") != chapter.get("title"):
            errors.append(f"{volume:03d}: chapter identity mismatch")
        names = [person.get("name", "") for person in context.get("people", [])]
        if len(names) != len(set(names)):
            errors.append(f"{volume:03d}: duplicate people")
        for relation in context.get("relationships", []):
            if relation.get("source") not in names or relation.get("target") not in names:
                errors.append(f"{volume:03d}: relation has missing person {relation.get('id')}")
            if clean(relation.get("evidence", "")) not in text:
                errors.append(f"{volume:03d}: relation evidence not found {relation.get('id')}")
        for event in context.get("events", []):
            year = event.get("year")
            if not isinstance(year, int) or year < -5000 or year > 2100:
                errors.append(f"{volume:03d}: invalid event year {event.get('id')}")
            if clean(event.get("evidence", "")) not in text:
                errors.append(f"{volume:03d}: event evidence not found {event.get('id')}")
            if any(person not in names for person in event.get("people", [])):
                errors.append(f"{volume:03d}: event has missing person {event.get('id')}")
        totals["chapters"] += 1
        totals["people"] += len(names)
        totals["relationships"] += len(context.get("relationships", []))
        totals["events"] += len(context.get("events", []))
        totals["datedEvents"] += sum(1 for event in context.get("events", []) if event.get("year") != 0)
    print(json.dumps({"totals": totals, "errors": errors}, ensure_ascii=False, indent=2))
    if errors or totals["chapters"] != 130:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
