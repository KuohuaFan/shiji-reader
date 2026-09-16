#!/usr/bin/env python3
"""Convert the Wikisource Shiji EPUB into editable, chapter-split JSON.

Input:  source/shiji-wikisource.epub
Output: client/src/content/manifest.json
        client/src/content/chapters/001.json ... 130.json

The script deliberately removes Wikisource navigation, sister-project boxes,
reference markers, and the later-added 校勘記 sections. Editorial section
headings are retained as reading aids and identified in the source note.
"""

from __future__ import annotations

import json
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

from lxml import etree

ROOT = Path(__file__).resolve().parents[1]
EPUB = ROOT / "source" / "shiji-wikisource.epub"
CONTENT_DIR = ROOT / "client" / "src" / "content"
CHAPTER_DIR = CONTENT_DIR / "chapters"
NS = {"x": "http://www.w3.org/1999/xhtml"}

CATEGORY_RANGES = [
    (1, 12, "本紀", "帝王興替與天下秩序"),
    (13, 22, "表", "以年代與世系並觀天下大勢"),
    (23, 30, "書", "制度、禮樂、曆法與經濟"),
    (31, 60, "世家", "諸侯封國與世族興亡"),
    (61, 130, "列傳", "人物群像與歷史抉擇"),
]

# EPUB volume headers contain a handful of aliases, omitted headings and mixed
# simplified glyphs. This canonical list follows the Wikisource work index.
CANONICAL_TITLES = [
    "五帝本紀第一", "夏本紀第二", "殷本紀第三", "周本紀第四", "秦本紀第五", "秦始皇本紀第六",
    "項羽本紀第七", "高祖本紀第八", "呂后本紀第九", "孝文本紀第十", "孝景本紀第十一", "孝武本紀第十二",
    "三代世表第一", "十二諸侯年表第二", "六國年表第三", "秦楚之際月表第四", "漢興以來諸侯王年表第五",
    "高祖功臣侯者年表第六", "惠景閒侯者年表第七", "建元以來侯者年表第八", "建元以來王子侯者年表第九",
    "漢興以來將相名臣年表第十", "禮書第一", "樂書第二", "律書第三", "曆書第四", "天官書第五", "封禪書第六",
    "河渠書第七", "平準書第八", "吳太伯世家第一", "齊太公世家第二", "魯周公世家第三", "燕召公世家第四",
    "管蔡世家第五", "陳杞世家第六", "衛康叔世家第七", "宋微子世家第八", "晉世家第九", "楚世家第十",
    "越王勾踐世家第十一", "鄭世家第十二", "趙世家第十三", "魏世家第十四", "韓世家第十五", "田敬仲完世家第十六",
    "孔子世家第十七", "陳涉世家第十八", "外戚世家第十九", "楚元王世家第二十", "荊燕世家第二十一",
    "齊悼惠王世家第二十二", "蕭相國世家第二十三", "曹相國世家第二十四", "留侯世家第二十五",
    "陳丞相世家第二十六", "絳侯周勃世家第二十七", "梁孝王世家第二十八", "五宗世家第二十九", "三王世家第三十",
    "伯夷列傳第一", "管晏列傳第二", "老子韓非列傳第三", "司馬穰苴列傳第四", "孫子吳起列傳第五",
    "伍子胥列傳第六", "仲尼弟子列傳第七", "商君列傳第八", "蘇秦列傳第九", "張儀列傳第十",
    "樗里子甘茂列傳第十一", "穰侯列傳第十二", "白起王翦列傳第十三", "孟子荀卿列傳第十四", "孟嘗君列傳第十五",
    "平原君虞卿列傳第十六", "魏公子列傳第十七", "春申君列傳第十八", "范睢蔡澤列傳第十九", "樂毅列傳第二十",
    "廉頗藺相如列傳第二十一", "田單列傳第二十二", "魯仲連鄒陽列傳第二十三", "屈原賈生列傳第二十四",
    "呂不韋列傳第二十五", "刺客列傳第二十六", "李斯列傳第二十七", "蒙恬列傳第二十八", "張耳陳餘列傳第二十九",
    "魏豹彭越列傳第三十", "黥布列傳第三十一", "淮陰侯列傳第三十二", "韓信盧綰列傳第三十三", "田儋列傳第三十四",
    "樊酈滕灌列傳第三十五", "張丞相列傳第三十六", "酈生陸賈列傳第三十七", "傅靳蒯成列傳第三十八",
    "劉敬叔孫通列傳第三十九", "季布欒布列傳第四十", "袁盎鼂錯列傳第四十一", "張釋之馮唐列傳第四十二",
    "萬石張叔列傳第四十三", "田叔列傳第四十四", "扁鵲倉公列傳第四十五", "吳王濞列傳第四十六",
    "魏其武安列傳第四十七", "韓長孺列傳第四十八", "李將軍列傳第四十九", "匈奴列傳第五十",
    "衛將軍驃騎列傳第五十一", "平津侯主父列傳第五十二", "南越列傳第五十三", "東越列傳第五十四",
    "朝鮮列傳第五十五", "西南夷列傳第五十六", "司馬相如列傳第五十七", "淮南衡山列傳第五十八",
    "循吏列傳第五十九", "汲鄭列傳第六十", "儒林列傳第六十一", "酷吏列傳第六十二", "大宛列傳第六十三",
    "游俠列傳第六十四", "佞幸列傳第六十五", "滑稽列傳第六十六", "日者列傳第六十七", "龜策列傳第六十八",
    "貨殖列傳第六十九", "太史公自序第七十",
]

IGNORE_CLASSES = {
    "ws-header",
    "sistersitebox",
    "ombox",
    "noprint",
    "ws-noexport",
    "reflist",
    "references",
    "mw-references-wrap",
    "navbox",
    "noviewer",
}


def class_tokens(node: etree._Element) -> set[str]:
    return set((node.get("class") or "").split())


def drop_tree(node: etree._Element) -> None:
    """Remove a node while preserving its tail text."""
    parent = node.getparent()
    if parent is None:
        return
    tail = node.tail
    previous = node.getprevious()
    parent.remove(node)
    if tail:
        if previous is not None:
            previous.tail = (previous.tail or "") + tail
        else:
            parent.text = (parent.text or "") + tail


def normalize_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u3000", "　")
    value = re.sub(r"[ \t\r\f\v]+", "", value)
    value = re.sub(r"\n+", "", value)
    return value.strip()


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
        replacement = None
        for item in data.get("twoway", []):
            if item.get("l") == "zh-hant":
                replacement = item.get("t")
                break
        if replacement is None:
            replacement = data.get("disabled", {}).get("t")
        if replacement:
            node.text = replacement


def clean_document(root: etree._Element) -> None:
    restore_language_variants(root)
    nodes = list(root.xpath("//x:sup | //x:img", namespaces=NS))
    nodes.extend(
        root.xpath(
            "//*[contains(concat(' ', normalize-space(@class), ' '), ' %s ')]"
            % " ') or contains(concat(' ', normalize-space(@class), ' '), ' ".join(
                sorted(IGNORE_CLASSES)
            )
        )
    )
    seen: set[int] = set()
    for node in nodes:
        marker = id(node)
        if marker in seen or node.getparent() is None:
            continue
        seen.add(marker)
        drop_tree(node)


def category_for(volume: int) -> tuple[str, str, int]:
    for start, end, name, description in CATEGORY_RANGES:
        if start <= volume <= end:
            return name, description, volume - start + 1
    raise ValueError(volume)


def chinese_number(value: int) -> str:
    digits = "零一二三四五六七八九"
    if value < 10:
        return digits[value]
    if value < 20:
        return "十" + (digits[value % 10] if value % 10 else "")
    if value < 100:
        tens, ones = divmod(value, 10)
        return digits[tens] + "十" + (digits[ones] if ones else "")
    hundreds, rest = divmod(value, 100)
    result = digits[hundreds] + "百"
    if rest == 0:
        return result
    if rest < 10:
        return result + "零" + digits[rest]
    tens, ones = divmod(rest, 10)
    return result + digits[tens] + "十" + (digits[ones] if ones else "")


def is_inside_table(node: etree._Element) -> bool:
    return any(parent.tag.endswith("table") for parent in node.iterancestors())


def is_nested_text_block(node: etree._Element) -> bool:
    block_tags = {"p", "dd", "li", "blockquote"}
    return any(parent.tag.split("}")[-1] in block_tags for parent in node.iterancestors())


def table_block(table: etree._Element) -> dict | None:
    rows: list[list[str]] = []
    for row in table.xpath(".//x:tr", namespaces=NS):
        cells = [element_text(cell) for cell in row.xpath("./x:th|./x:td", namespaces=NS)]
        if any(cells):
            rows.append(cells)
    if not rows:
        return None
    return {"type": "table", "rows": rows}


def section_blocks(section: etree._Element) -> list[dict]:
    blocks: list[dict] = []
    for node in section.iter():
        tag = node.tag.split("}")[-1] if isinstance(node.tag, str) else ""
        if tag == "table" and "wikitable" in class_tokens(node):
            block = table_block(node)
            if block:
                blocks.append(block)
            continue
        if tag not in {"p", "dd", "li", "blockquote"}:
            continue
        if is_inside_table(node) or is_nested_text_block(node):
            continue
        text = element_text(node)
        if not text or text in {"三家註版", "註釋版"}:
            continue
        blocks.append({"type": "text", "text": text})
    return blocks


def parse_chapter(path: Path, volume: int) -> dict:
    parser = etree.XMLParser(recover=True, huge_tree=True)
    root = etree.parse(str(path), parser).getroot()

    header_cells = root.xpath(
        "(//x:table[contains(concat(' ', normalize-space(@class), ' '), ' ws-header ')])[1]//x:tr[1]/x:td",
        namespaces=NS,
    )
    header = element_text(header_cells[1]) if len(header_cells) >= 2 else f"卷{volume}"
    header = re.sub(r"^史記", "", header)
    volume_label = f"卷{chinese_number(volume)}"
    title = header
    for prefix in (volume_label, f"巻{chinese_number(volume)}"):
        if title.startswith(prefix):
            title = title[len(prefix) :]
            break
    if not title:
        title = header
    title = re.sub(r"\s+", "", title)
    title = CANONICAL_TITLES[volume - 1]

    clean_document(root)
    sections: list[dict] = []
    for section in root.xpath("//x:body/x:section", namespaces=NS):
        heading_nodes = section.xpath("./x:h2|./x:h3", namespaces=NS)
        heading = element_text(heading_nodes[0]) if heading_nodes else ""
        if "校勘記" in heading or heading in {"註釋", "參考文獻"}:
            continue
        blocks = section_blocks(section)
        if blocks:
            sections.append({"heading": heading, "blocks": blocks})

    category, category_description, category_index = category_for(volume)
    char_count = sum(
        len(block.get("text", ""))
        + sum(len(cell) for row in block.get("rows", []) for cell in row)
        for section in sections
        for block in section["blocks"]
    )

    return {
        "id": f"{volume:03d}",
        "volume": volume,
        "volumeLabel": volume_label,
        "title": title,
        "category": category,
        "categoryIndex": category_index,
        "categoryDescription": category_description,
        "charCount": char_count,
        "sourceUrl": f"https://zh.wikisource.org/zh-hant/史記/卷{volume:03d}",
        "sections": sections,
    }


def main() -> None:
    if not EPUB.exists():
        raise SystemExit(f"Missing source EPUB: {EPUB}")
    CHAPTER_DIR.mkdir(parents=True, exist_ok=True)
    for stale in CHAPTER_DIR.glob("*.json"):
        stale.unlink()

    with tempfile.TemporaryDirectory(prefix="shiji-epub-") as temp_dir:
        temp = Path(temp_dir)
        with zipfile.ZipFile(EPUB) as archive:
            archive.extractall(temp)

        chapters: list[dict] = []
        for volume in range(1, 131):
            path = temp / "OPS" / f"c{volume}_shi_ji_juan{volume:03d}.xhtml"
            if not path.exists():
                raise SystemExit(f"Missing chapter file: {path.name}")
            chapter = parse_chapter(path, volume)
            target = CHAPTER_DIR / f"{volume:03d}.json"
            target.write_text(
                json.dumps(chapter, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
            chapters.append({key: value for key, value in chapter.items() if key != "sections"})

    total_chars = sum(chapter["charCount"] for chapter in chapters)
    manifest = {
        "title": "史記",
        "author": "〔西漢〕司馬遷撰；褚少孫補",
        "version": "1.0.0",
        "source": "維基文庫《史記》繁體頁面之 EPUB 匯出",
        "sourceUrl": "https://zh.wikisource.org/zh-hant/史記",
        "sourceLicense": "古籍原文為公有領域；維基文庫編排與標點依 CC BY-SA 4.0／GFDL 條款",
        "importedAt": "2026-09-08",
        "chapterCount": len(chapters),
        "totalChars": total_chars,
        "categories": [
            {
                "name": name,
                "start": start,
                "end": end,
                "count": end - start + 1,
                "description": description,
            }
            for start, end, name, description in CATEGORY_RANGES
        ],
        "chapters": chapters,
    }
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    (CONTENT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Generated {len(chapters)} chapters with {total_chars:,} characters")
    print(f"Manifest: {CONTENT_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
