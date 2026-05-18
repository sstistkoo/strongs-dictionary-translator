#!/usr/bin/env python3
"""
Překlad i18n JSON (např. en.json) do cílového jazyka přes Google Translate.
Zachuje jazykové značky v závorkách: (CZ), (EN), (DE), (zh-CN) …
Po překladu se nahradí cílovým kódem dle --tag; nastaví se klíč topic.langTag.

Závislost: pip install deep-translator

Příklady:
  python tools/translate_i18n.py -s en -t de -i i18n/en.json -o i18n/de.json --tag DE
  python tools/translate_i18n.py -s en -t zh-CN -i i18n/en.json -o i18n/zh-CN.json --tag zh-CN
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from typing import Any

try:
    from deep_translator import GoogleTranslator, DeeplTranslator
except ImportError as e:
    print("Chybí balíček: pip install deep-translator", file=sys.stderr)
    raise SystemExit(1) from e

# Jeden neviditelný placeholder (nepřekládá se spolehlivěji než běžné znaky)
_PH = "\uE000"
_PH_WORD = "\uE001"

# Typické značky v i18n (zdroj en/cs); po překladu se vše sjednotí na --tag
_TAG_IN_PARENS = re.compile(
    r"\((?:CZ|EN|SK|PL|DE|FR|ES|IT|PT|RU|UK|BG|RO|HU|NL|SV|DA|NO|FI|EL|TR|"
    r"AR|JA|KO|HE|"
    r"zh-CN|zh-TW|ZH-CN)\)",
    re.IGNORECASE,
)

# Typická slova jazyků, která se mohou v klíčích/texteh vyskytovat (např. "Czech meaning")
_LANG_WORDS_RE = re.compile(r"\b(Czech|English|Slovak|Polish)\b", re.IGNORECASE)

_TARGET_LANG_NAME_EN = {
    "cs": "Czech",
    "cz": "Czech",
    "en": "English",
    "sk": "Slovak",
    "pl": "Polish",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "uk": "Ukrainian",
    "bg": "Bulgarian",
    "ro": "Romanian",
    "hu": "Hungarian",
    "nl": "Dutch",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
    "el": "Greek",
    "tr": "Turkish",
    "ar": "Arabic",
    "ja": "Japanese",
    "ko": "Korean",
    "he": "Hebrew",
    "zh-cn": "Chinese",
}


def protect_tag_brackets(s: str) -> str:
    return _TAG_IN_PARENS.sub(_PH, s)


def protect_language_words(s: str) -> str:
    return _LANG_WORDS_RE.sub(_PH_WORD, s)


def restore_tag_brackets(s: str, target_tag: str) -> str:
    t = f"({target_tag})"
    return s.replace(_PH, t)


def restore_language_words(s: str, target_language_name_en: str) -> str:
    return s.replace(_PH_WORD, target_language_name_en)


def translate_value(
    value: Any,
    translator: GoogleTranslator,
    target_tag: str,
    target_language_name_en: str,
    path: str = "",
    *,
    keep_prompts_en: bool = False,
    target_lang: str = "",
) -> Any:
    norm_path = path.lstrip(".")
    if keep_prompts_en and str(target_lang).strip().lower() != "en" and norm_path.startswith("aiPrompts."):
        return value
    if isinstance(value, str):
        if not str(value).strip():
            return value
        try:
            protected = protect_tag_brackets(value)
            protected = protect_language_words(protected)
            out = translator.translate(protected)
            out = restore_tag_brackets(out, target_tag)
            out = restore_language_words(out, target_language_name_en)
            time.sleep(0.1)
            return out
        except Exception as e:
            print(f"✗ {path or '?'}: {e}", file=sys.stderr)
            return value
    if isinstance(value, dict):
        return {
            k: translate_value(
                v,
                translator,
                target_tag,
                target_language_name_en,
                f"{path}.{k}",
                keep_prompts_en=keep_prompts_en,
                target_lang=target_lang,
            )
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [
            translate_value(
                item,
                translator,
                target_tag,
                target_language_name_en,
                f"{path}[{i}]",
                keep_prompts_en=keep_prompts_en,
                target_lang=target_lang,
            )
            for i, item in enumerate(value)
        ]
    return value


def set_topic_lang_tag(data: dict, tag: str) -> None:
    if isinstance(data, dict) and "topic.langTag" in data:
        data["topic.langTag"] = tag


def main() -> None:
    ap = argparse.ArgumentParser(description="Překlad i18n JSON s ochranou jazykových značek v závorkách.")
    ap.add_argument("-s", "--source", default="en", help="Kód zdrojového jazyka (Google), výchozí: en")
    ap.add_argument("-t", "--target", required=True, help="Cílový jazyk, např. de, pl, sk, zh-CN")
    ap.add_argument("-i", "--input", required=True, help="Vstupní JSON")
    ap.add_argument("-o", "--output", required=True, help="Výstupní JSON")
    ap.add_argument("--engine", choices=["google", "deepl"], default="google", help="Překladový engine (google|deepl), výchozí: google")
    ap.add_argument("--deepl-key", default=None, help="DeepL API key (alternativně env DEEPL_API_KEY)")
    ap.add_argument(
        "--tag",
        default=None,
        help="Značka v UI závorkách, např. DE nebo zh-CN. Výchozí: z --target (z velkými písmeny, zh-CN beze změny)",
    )
    ap.add_argument(
        "--keep-prompts-en",
        action="store_true",
        help="Nechá klíče aiPrompts.* v angličtině (mimo cíl en).",
    )
    args = ap.parse_args()

    raw_tag = args.tag
    if not raw_tag:
        t = str(args.target).strip()
        low = t.lower()
        if low in ("zh-cn", "zhcn", "zh_cn"):
            raw_tag = "zh-CN"
        else:
            raw_tag = t.upper() if len(t) <= 5 and "-" not in t else t

    with open(args.input, "r", encoding="utf-8") as f:
        data: dict = json.load(f)

    print(f"→ Překlad: {args.source} → {args.target}, značka v textech: ({raw_tag}), engine: {args.engine}")
    if args.engine == "deepl":
        key = (args.deepl_key or os.getenv("DEEPL_API_KEY") or "").strip()
        if not key:
            print("Chybí DeepL API key: použij --deepl-key nebo env DEEPL_API_KEY", file=sys.stderr)
            raise SystemExit(2)
        translator = DeeplTranslator(api_key=key, source=args.source, target=args.target)
    else:
        translator = GoogleTranslator(source=args.source, target=args.target)
    target_language_name_en = _TARGET_LANG_NAME_EN.get(str(args.target).strip().lower(), str(args.target).strip())
    out = translate_value(
        data,
        translator,
        str(raw_tag),
        target_language_name_en,
        "",
        keep_prompts_en=bool(args.keep_prompts_en),
        target_lang=str(args.target),
    )
    set_topic_lang_tag(out, str(raw_tag))

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"✓ Uloženo: {args.output}")


if __name__ == "__main__":
    main()
