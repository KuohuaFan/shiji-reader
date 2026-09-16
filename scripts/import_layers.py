#!/usr/bin/env python3
"""Import Sanjiazhu annotations and Wikisource critical notes into chapter-split JSON.

Inputs:
  source/shiji-sanjiazhu-wikisource.epub
  source/shiji-wikisource.epub
Output:
  client/src/content/scholia/001.json ... 130.json
"""

from __future__ import annotations

import json
import re
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_EPUB = ROOT / "source" / "shiji-wikisource.epub"
SANJIAZHU_EPUB = ROOT / "source" / "shiji-sanjiazhu-wikisource.epub"
OUTPUT_DIR = ROOT / "client" / "src" / "content" / "scholia"
NS = {"x": "http://www.w3.org/1999/xhtml", "epub": "http://www.idpf.org/2007/ops"}
LABELS = {"集解", "索隱", "正義"}


def normalize_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u3000", "　")
    value = re.sub(r"[ \t\r\f\v]+", "", value)
    value = re.sub(r"\n+", "", value)
    return value.strip("　 ")


def element_text(node: etree._Element) -> str:
    return normalize_text("".join(node.itertext()))


def restore_language_variants(root: etree._Element) -> None:
    for node in root.xpath('//*[@data-mw-variant]'):
        raw = node.get("data-mw-variant")
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        replacement = next(
            (item.get("t") for item in data.get("twoway", []) if item.get("l") == "zh-hant"),
            None,
        )
        if replacement is None:
            replacement = data.get("disabled", {}).get("t")
        if replacement:
            node.text = replacement


def nearest_heading(node: etree._Element) -> str:
    section = next(
        (ancestor for ancestor in node.iterancestors() if ancestor.tag.split("}")[-1] == "section"),
        None,
    )
    if section is None:
        return ""
    headings = section.xpath("./x:h2|./x:h3|./x:h4", namespaces=NS)
    return element_text(headings[0]) if headings else ""


def text_before(node: etree._Element, limit: int = 34) -> str:
    parent = node.getparent()
    if parent is None:
        return ""
    parts: list[str] = [parent.text or ""]
    for child in parent:
        if child is node:
            break
        if child.tag.split("}")[-1] != "small":
            parts.append("".join(child.itertext()))
        parts.append(child.tail or "")
    text = normalize_text("".join(parts))
    return text[-limit:]


def split_scholium(node: etree._Element) -> list[dict]:
    markers = [
        child
        for child in node
        if child.tag.split("}")[-1] == "span" and element_text(child) in LABELS
    ]
    notes: list[dict] = []
    if not markers:
        raw = element_text(node).strip("〈〉")
        pieces = re.split(r"(?:【|[○◇□]|（)(集解|索隱|正義)(?:】|：)?", raw)
        if len(pieces) > 1:
            for index in range(1, len(pieces), 2):
                source = pieces[index]
                text = pieces[index + 1].strip("〈〉") if index + 1 < len(pieces) else ""
                if text:
                    notes.append({"source": source, "text": text})
        return notes
    for index, marker in enumerate(markers):
        source = element_text(marker)
        parts: list[str] = [marker.tail or ""]
        sibling = marker.getnext()
        stop = markers[index + 1] if index + 1 < len(markers) else None
        while sibling is not None and sibling is not stop:
            style = sibling.get("style") or ""
            if "color:transparent" not in style:
                parts.append("".join(sibling.itertext()))
            parts.append(sibling.tail or "")
            sibling = sibling.getnext()
        text = normalize_text("".join(parts)).strip("〈〉")
        if text:
            notes.append({"source": source, "text": text})
    return notes


def parse_sanjiazhu(path: Path) -> list[dict]:
    parser = etree.XMLParser(recover=True, huge_tree=True)
    root = etree.parse(str(path), parser).getroot()
    restore_language_variants(root)
    entries: list[dict] = []
    for node in root.xpath("//x:small", namespaces=NS):
        notes = split_scholium(node)
        if not notes:
            continue
        entries.append(
            {
                "id": f"a{len(entries) + 1}",
                "section": nearest_heading(node),
                "anchor": text_before(node),
                "notes": notes,
            }
        )
    # Several chronological tables use plain-text glyphs (○索隱, ◇集解,
    # □正義) directly inside paragraphs/cells instead of <small> wrappers.
    for node in root.xpath("//x:p[not(.//x:small)]|//x:td[not(.//x:small)]", namespaces=NS):
        raw = element_text(node)
        matches = list(re.finditer(r"[○◇□](集解|索隱|正義)", raw))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(raw)
            text = raw[match.end():end].strip("　 〈〉")
            if not text:
                continue
            entries.append(
                {
                    "id": f"a{len(entries) + 1}",
                    "section": nearest_heading(node),
                    "anchor": raw[max(0, match.start() - 34):match.start()],
                    "notes": [{"source": match.group(1), "text": text}],
                }
            )
    return entries


def parse_critical_notes(path: Path) -> list[dict]:
    parser = etree.XMLParser(recover=True, huge_tree=True)
    root = etree.parse(str(path), parser).getroot()
    restore_language_variants(root)
    notes: list[dict] = []
    for item in root.xpath("//x:li[@epub:type='footnote']", namespaces=NS):
        number = item.get("data-mw-footnote-number") or str(len(notes) + 1)
        text_nodes = item.xpath(
            ".//*[contains(concat(' ', normalize-space(@class), ' '), ' reference-text ')]",
            namespaces=NS,
        )
        text = element_text(text_nodes[0] if text_nodes else item).lstrip("↑")
        refs = root.xpath(f"//x:sup[x:a[@href='#cite_note-{number}']]", namespaces=NS)
        anchor = text_before(refs[0]) if refs else ""
        notes.append({"id": f"n{number}", "number": int(number), "anchor": anchor, "text": text})
    return notes


def main() -> None:
    if not ORIGINAL_EPUB.exists() or not SANJIAZHU_EPUB.exists():
        raise SystemExit("Missing source EPUB")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total_entries = total_notes = 0
    source_counts = {label: 0 for label in sorted(LABELS)}

    with tempfile.TemporaryDirectory(prefix="shiji-layers-") as temp_dir:
        temp = Path(temp_dir)
        original_dir = temp / "original"
        sanjiazhu_dir = temp / "sanjiazhu"
        generated_dir = temp / "generated"
        generated_dir.mkdir()
        with zipfile.ZipFile(ORIGINAL_EPUB) as archive:
            archive.extractall(original_dir)
        with zipfile.ZipFile(SANJIAZHU_EPUB) as archive:
            archive.extractall(sanjiazhu_dir)

        for volume in range(1, 131):
            original = original_dir / "OPS" / f"c{volume}_shi_ji_juan{volume:03d}.xhtml"
            sanjiazhu = sanjiazhu_dir / "OPS" / f"c{volume}_shi_ji_san_jia_zhu_juan{volume:03d}.xhtml"
            if not original.exists() or not sanjiazhu.exists():
                raise SystemExit(f"Missing volume {volume:03d}")
            annotations = parse_sanjiazhu(sanjiazhu)
            critical_notes = parse_critical_notes(original)
            for entry in annotations:
                for note in entry["notes"]:
                    source_counts[note["source"]] += 1
            total_entries += len(annotations)
            total_notes += len(critical_notes)
            payload = {
                "id": f"{volume:03d}",
                "volume": volume,
                "sanjiazhuSourceUrl": f"https://zh.wikisource.org/zh-hant/史記三家註/卷{volume:03d}",
                "originalSourceUrl": f"https://zh.wikisource.org/zh-hant/史記/卷{volume:03d}",
                "annotations": annotations,
                "criticalNotes": critical_notes,
            }
            (generated_dir / f"{volume:03d}.json").write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
        expected_names = {f"{volume:03d}.json" for volume in range(1, 131)}
        for stale in OUTPUT_DIR.glob("*.json"):
            if stale.name not in expected_names:
                stale.unlink()
        for generated in generated_dir.glob("*.json"):
            generated.replace(OUTPUT_DIR / generated.name)

    print(
        json.dumps(
            {
                "chapters": 130,
                "annotationAnchors": total_entries,
                "criticalNotes": total_notes,
                "sourceNotes": source_counts,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
