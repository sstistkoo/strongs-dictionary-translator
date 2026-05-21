#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
EN_PATH = BASE_DIR / "i18n" / "en.json"
I18N_DIR = BASE_DIR / "i18n"
BAD_TOKEN_RE = re.compile(
    r"(?:"
    r"__ST_TAG_|"
    r"saveRU|slotRU|prRU|AttachRU|openRU|preRU|TagRU|UlozRU|"
    r"ПеревестиRU|СохранитьRU|ОтменаRU|"
    r"RUé|RUá|RUí|RUy|RUó|"
    r"давайтеRUштина|норштина|туречна|румунштина"
    r")"
)
PLACEHOLDER_RE = re.compile(r"\{[a-zA-Z0-9_]+\}")


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def extract_placeholders(text: str) -> set[str]:
    return set(PLACEHOLDER_RE.findall(str(text)))


def get_target_languages() -> list[str]:
    if len(sys.argv) > 1:
        return [arg.strip().lower() for arg in sys.argv[1:] if arg.strip()]
    return ["ru", "bg", "uk"]


def validate_language(lang: str, en: dict) -> list[str]:
    lang_path = I18N_DIR / f"{lang}.json"
    if not lang_path.exists():
        return [f"[MISSING_FILE] {lang_path}"]

    data = load_json(lang_path)
    errors: list[str] = []

    for key, value in data.items():
        text = str(value)
        if BAD_TOKEN_RE.search(text):
            errors.append(f"[BAD_TOKEN] {lang}.{key}: {text}")

        if key in en:
            lang_ph = extract_placeholders(text)
            en_ph = extract_placeholders(en[key])
            if lang_ph != en_ph:
                errors.append(
                    f"[PLACEHOLDER_MISMATCH] {lang}.{key}: "
                    f"lang={sorted(lang_ph)} en={sorted(en_ph)}"
                )

    return errors


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    en = load_json(EN_PATH)
    langs = get_target_languages()
    errors: list[str] = []
    for lang in langs:
        errors.extend(validate_language(lang, en))

    if errors:
        print(f"i18n validace selhala pro jazyky: {', '.join(langs)}")
        for err in errors:
            print(f"- {err}")
        return 1

    print(f"i18n validace OK pro jazyky: {', '.join(langs)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
