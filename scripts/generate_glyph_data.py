#!/usr/bin/env python3
"""Generate `_data/glyphs.yaml` from the bundled Ubuntu web fonts.

The glyph specimen page renders the real character coverage, vertical metrics
and OpenType feature support of the fonts we ship in `static/fonts`, so the
data has to be derived from those files rather than hand-maintained.

To update the fonts: drop the new `.woff2` files into `static/fonts`, delete
the old ones, then run

    pip install fonttools brotli
    python scripts/generate_glyph_data.py

Font files are discovered by face prefix, so their version suffix can change
freely without touching this script. Remember to update the `@font-face` rules
in `static/sass/_fonts.scss` and the preloads in `templates/base.html` to
match; those reference the same files but are not read from here.

The output is committed to the repository so that neither the build nor the
running app needs fontTools as a dependency.
"""

import unicodedata
from pathlib import Path

import yaml
from fontTools.ttLib import TTFont

REPO_ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = REPO_ROOT / "static" / "fonts"
OUTPUT = REPO_ROOT / "_data" / "glyphs.yaml"

# The faces bundled in `static/fonts`, matched longest prefix first so that
# `Ubuntu-Italic-*` is not swallowed by the `Ubuntu-*` prefix.
FACE_PREFIXES = [
    ("italic", "Ubuntu-Italic"),
    ("mono", "UbuntuMono"),
    ("roman", "Ubuntu"),
]

# Displayed in this order. Everything else falls through to "Symbols".
SCRIPT_ORDER = [
    ("latin", "Latin"),
    ("greek", "Greek"),
    ("cyrillic", "Cyrillic"),
    ("numerals", "Numerals"),
    ("punctuation", "Punctuation"),
    ("symbols", "Symbols"),
]


def discover_subsets():
    """Group the bundled font files by face.

    Font filenames carry their version (`Ubuntu-latin-v0.896a.woff2`), so
    listing them here would mean hand-editing a constant per subset on every
    font update -- the chore this script exists to remove. Read the directory
    instead, and let a dropped-in file of any version be picked up as-is.
    """
    found = {key: [] for key, _ in FACE_PREFIXES}
    unmatched = []

    for path in sorted(FONT_DIR.glob("*.woff2")):
        for key, prefix in FACE_PREFIXES:
            if path.stem.startswith(f"{prefix}-"):
                found[key].append(path.stem)
                break
        else:
            unmatched.append(path.name)

    if unmatched:
        raise SystemExit(
            "Unrecognised font files in\n"
            f"  {FONT_DIR}:\n    "
            + "\n    ".join(unmatched)
            + "\nAdd a prefix to FACE_PREFIXES, or rename to match an "
            "existing face."
        )

    missing = [key for key, names in found.items() if not names]
    if missing:
        raise SystemExit(
            f"No font files found in {FONT_DIR} for: "
            f"{', '.join(sorted(missing))}.\n"
            "Expected names like 'Ubuntu-latin-v0.896a.woff2'."
        )

    return found


def primary(subsets):
    """The subset to read vertical metrics from.

    Metrics are identical across a face's subsets, so prefer the plain Latin
    file; it is the one a reader would check by hand.
    """
    for name in subsets:
        if "-latin-v" in name:
            return name
    return subsets[0]


def load(subset):
    return TTFont(FONT_DIR / f"{subset}.woff2")


def codepoints(subsets):
    covered = set()
    for subset in subsets:
        covered |= set(load(subset).getBestCmap())
    return covered


def feature_tags(subsets):
    """Union of GSUB/GPOS feature tags across a family's subsets."""
    tags = set()
    for subset in subsets:
        font = load(subset)
        for table in ("GSUB", "GPOS"):
            if table in font:
                tags |= {
                    record.FeatureTag
                    for record in font[table].table.FeatureList.FeatureRecord
                }
    return tags


def _substitution_sources(subtable):
    """Glyph names a GSUB subtable substitutes away, unwrapping extensions."""
    subtable = getattr(subtable, "ExtSubTable", None) or subtable
    sources = set()

    mapping = getattr(subtable, "mapping", None)
    if mapping:
        sources |= set(mapping)

    alternates = getattr(subtable, "alternates", None)
    if alternates:
        sources |= set(alternates)

    return sources


def feature_codepoints(subsets, tags):
    """Codepoints a set of OpenType features actually substitutes.

    A feature being listed in GSUB says nothing about how much of the
    character set it reaches. `onum` only touches digits and a handful of
    currency symbols, so the specimen needs to know precisely which glyphs a
    toggle changes in order to show only those.
    """
    affected = set()

    for subset in subsets:
        font = load(subset)
        if "GSUB" not in font:
            continue

        table = font["GSUB"].table
        by_name = {}
        for codepoint, name in font.getBestCmap().items():
            by_name.setdefault(name, codepoint)

        for record in table.FeatureList.FeatureRecord:
            if record.FeatureTag not in tags:
                continue
            for index in record.Feature.LookupListIndex:
                for subtable in table.LookupList.Lookup[index].SubTable:
                    for name in _substitution_sources(subtable):
                        if name in by_name:
                            affected.add(by_name[name])

    return affected


def metrics(subset):
    """Vertical metrics normalised to a 1000-unit em so the front end can
    scale them to any rendered font size."""
    font = load(subset)
    upm = font["head"].unitsPerEm
    os2 = font["OS/2"]
    hhea = font["hhea"]

    cap_height = getattr(os2, "sCapHeight", None) or 0
    x_height = getattr(os2, "sxHeight", None) or 0

    def scale(value):
        return round(value * 1000 / upm)

    return {
        "ascender": scale(hhea.ascender),
        "capHeight": scale(cap_height),
        "xHeight": scale(x_height),
        "descender": scale(hhea.descender),
    }


def classify(char):
    """Bucket a character into one of the display groups."""
    category = unicodedata.category(char)

    if category.startswith("L"):
        try:
            name = unicodedata.name(char)
        except ValueError:
            return "symbols"
        for script in ("LATIN", "GREEK", "CYRILLIC"):
            if name.startswith(script):
                return script.lower()
        return "symbols"
    if category.startswith("N"):
        return "numerals"
    if category.startswith("P"):
        return "punctuation"
    return "symbols"


def describe(char):
    try:
        return unicodedata.name(char).title()
    except ValueError:
        return "Unnamed character"


def main():
    fonts = discover_subsets()
    roman_subsets = fonts["roman"]
    italic_subsets = fonts["italic"]
    mono_subsets = fonts["mono"]

    roman = codepoints(roman_subsets)
    italic = codepoints(italic_subsets)
    mono = codepoints(mono_subsets)

    roman_features = feature_tags(roman_subsets)
    italic_features = feature_tags(italic_subsets)
    mono_features = feature_tags(mono_subsets)

    # Which characters each toggle actually rewrites. Unioned across families:
    # every codepoint one family substitutes but another does not is absent
    # from the latter's cmap anyway, so the coverage flags already hide it.
    all_subsets = roman_subsets + italic_subsets + mono_subsets
    small_caps_glyphs = feature_codepoints(all_subsets, {"smcp", "c2sc"})
    text_figure_glyphs = feature_codepoints(all_subsets, {"onum"})

    buckets = {script_id: [] for script_id, _ in SCRIPT_ORDER}

    for codepoint in sorted(roman | mono):
        char = chr(codepoint)
        # Whitespace and control characters have no visible outline.
        if unicodedata.category(char) in ("Cc", "Cf", "Cn", "Zs", "Zl", "Zp"):
            continue

        buckets[classify(char)].append(
            {
                "char": char,
                "code": f"U+{codepoint:04X}",
                "name": describe(char),
                # Which faces can actually render this character.
                "roman": codepoint in roman,
                "italic": codepoint in italic,
                "mono": codepoint in mono,
                # Which toggles rewrite it.
                "smallCaps": codepoint in small_caps_glyphs,
                "textFigures": codepoint in text_figure_glyphs,
            }
        )

    data = {
        "families": [
            {
                "id": "ubuntu",
                "name": "Ubuntu",
                "stack": '"Ubuntu variable", sans-serif',
                "features": {
                    "smallCaps": "smcp" in roman_features,
                    "textFigures": "onum" in roman_features,
                    "italic": True,
                },
                "metrics": metrics(primary(roman_subsets)),
            },
            {
                "id": "ubuntu-mono",
                "name": "Ubuntu Mono",
                "stack": '"Ubuntu Mono variable", monospace',
                "features": {
                    "smallCaps": "smcp" in mono_features,
                    "textFigures": "onum" in mono_features,
                    # No italic Ubuntu Mono file is bundled.
                    "italic": False,
                },
                "metrics": metrics(primary(mono_subsets)),
            },
        ],
        "italicFeatures": {
            "smallCaps": "smcp" in italic_features,
            "textFigures": "onum" in italic_features,
        },
        "scripts": [
            {
                "id": script_id,
                "name": name,
                "glyphs": buckets[script_id],
            }
            for script_id, name in SCRIPT_ORDER
            if buckets[script_id]
        ],
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as stream:
        stream.write("# Generated by scripts/generate_glyph_data.py - do not edit.\n")
        yaml.safe_dump(data, stream, allow_unicode=True, sort_keys=False, width=100)

    total = sum(len(group["glyphs"]) for group in data["scripts"])
    print(f"Read {sum(len(v) for v in fonts.values())} font files:")
    for key, _ in FACE_PREFIXES:
        for name in fonts[key]:
            print(f"  {key:<7} {name}")
    print(f"\nWrote {total} glyphs to {OUTPUT.relative_to(REPO_ROOT)}")
    for group in data["scripts"]:
        print(f"  {group['name']:<12} {len(group['glyphs']):>5}")


if __name__ == "__main__":
    main()
