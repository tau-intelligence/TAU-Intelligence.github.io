#!/usr/bin/env python3
"""
Tau Intelligence — manifest generator.

Scans the /blogs directory and rewrites /content/blogs.json so the website
picks up new posts automatically.

Supported inputs (in /blogs):
    *.md   — Markdown post with optional YAML frontmatter
    *.pdf  — PDF file. Optional sidecar  <basename>.json  for metadata.

The script is intentionally dependency-free (standard library only) so it
runs on a vanilla GitHub Actions runner with no setup.

Usage:
    python3 scripts/generate_manifest.py
    python3 scripts/generate_manifest.py --check   # exit 1 if regen needed
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT       = Path(__file__).resolve().parent.parent
BLOG_DIR   = ROOT / "blogs"
OUT_FILE   = ROOT / "content" / "blogs.json"

SKIP_NAMES = {"README.md", "readme.md"}


# --------------------------------------------------------------------------- #
# YAML frontmatter parsing — tiny, just enough for our schema.                #
# --------------------------------------------------------------------------- #

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_frontmatter(text: str) -> dict:
    """Parse a leading YAML-ish frontmatter block.

    Supports: scalars, quoted strings, ints, ISO dates, and inline lists
    `[a, b, c]`. No nested mappings — keep the schema flat.
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    block = m.group(1)
    out: dict = {}
    for line in block.splitlines():
        line = line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, raw = line.partition(":")
        out[key.strip()] = _coerce(raw.strip())
    return out


def _coerce(value: str):
    if not value:
        return ""
    # Inline list  [a, b, c]
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [_strip_quotes(p.strip()) for p in inner.split(",")]
    return _strip_quotes(value)


def _strip_quotes(s: str) -> str:
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    return s


# --------------------------------------------------------------------------- #
# Slug + date helpers                                                         #
# --------------------------------------------------------------------------- #

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "post"


def to_iso_date(value) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat() if isinstance(value, date) and not isinstance(value, datetime) else value.date().isoformat()
    if isinstance(value, str) and value:
        return value
    return date.today().isoformat()


# --------------------------------------------------------------------------- #
# Builders                                                                    #
# --------------------------------------------------------------------------- #

def build_md_entry(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    meta = parse_frontmatter(text)
    slug = meta.get("slug") or slugify(path.stem)
    return {
        "slug":    slug,
        "title":   meta.get("title") or path.stem.replace("-", " ").title(),
        "author":  meta.get("author") or "Tau Intelligence",
        "date":    to_iso_date(meta.get("date")),
        "tags":    meta.get("tags") or [],
        "summary": meta.get("summary") or "",
        "type":    "markdown",
        "url":     f"blogs/{path.name}",
    }


def build_pdf_entry(path: Path) -> dict:
    sidecar = path.with_suffix(".json")
    meta: dict = {}
    if sidecar.exists():
        try:
            meta = json.loads(sidecar.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"warning: invalid sidecar JSON {sidecar}: {e}", file=sys.stderr)
    slug = meta.get("slug") or slugify(path.stem)
    return {
        "slug":    slug,
        "title":   meta.get("title") or path.stem.replace("_", " ").replace("-", " ").title(),
        "author":  meta.get("author") or "Tau Intelligence",
        "date":    to_iso_date(meta.get("date")),
        "tags":    meta.get("tags") or [],
        "summary": meta.get("summary") or "",
        "type":    "pdf",
        "url":     f"blogs/{path.name}",
    }


def collect() -> list[dict]:
    posts: list[dict] = []
    if not BLOG_DIR.exists():
        return posts
    for path in sorted(BLOG_DIR.iterdir()):
        if path.name in SKIP_NAMES or path.name.startswith("."):
            continue
        if path.suffix.lower() == ".md":
            posts.append(build_md_entry(path))
        elif path.suffix.lower() == ".pdf":
            posts.append(build_pdf_entry(path))
        # .json sidecars are silently consumed by the .pdf branch
    posts.sort(key=lambda p: p.get("date", ""), reverse=True)
    return posts


# --------------------------------------------------------------------------- #
# Main                                                                        #
# --------------------------------------------------------------------------- #

def main() -> int:
    parser = argparse.ArgumentParser(description="Regenerate content/blogs.json from /blogs.")
    parser.add_argument("--check", action="store_true",
                        help="Exit 1 if the on-disk manifest is stale.")
    args = parser.parse_args()

    payload = {
        "_comment": (
            "Auto-generated by scripts/generate_manifest.py. To add a post, "
            "drop a .md or .pdf in /blogs and re-run the script (the GitHub "
            "Action does this on every push)."
        ),
        "posts": collect(),
    }
    new_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"

    if args.check:
        current = OUT_FILE.read_text(encoding="utf-8") if OUT_FILE.exists() else ""
        if current.strip() != new_text.strip():
            print("blogs.json is out of date. Run scripts/generate_manifest.py.", file=sys.stderr)
            return 1
        print("blogs.json is up to date.")
        return 0

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(new_text, encoding="utf-8")
    print(f"wrote {OUT_FILE.relative_to(ROOT)} ({len(payload['posts'])} posts)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
