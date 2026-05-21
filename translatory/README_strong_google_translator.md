# Strong's Concordance Google Translator

> `strong_google_translator.html` — standalone single-file web app for machine translation of Strong's Concordance into any language via Google Translate. No server, no API key, no installation required.

---

## Overview

This tool translates the **Strong's Concordance** lexicon entries (Greek NT, Extended Greek, Hebrew) into any of 60+ languages supported by Google Translate. It is designed for biblical scholars, translators, and researchers who need a fully localized Strong's lexicon.

The app runs entirely in your browser as a single HTML file. All data stays local — nothing is sent to any server except the translation requests to Google Translate's free public endpoint.

**Supported sections:**

| Section | Range | Description |
|---|---|---|
| Greek NT | G1 – G5624 | New Testament Greek lexicon |
| Greek Extended | G6000 – G21502 | Extended Greek vocabulary |
| Hebrew | H1 – H9049 | Old Testament Hebrew lexicon |

**Translated fields per entry:**

| Field | Source | Description |
|---|---|---|
| Význam / Meaning | Transliteration + grammar tag + KJV hint | Primary word meaning with grammatical context |
| Definice / Definition | Original English definition | Full lexical definition including biblical references |
| Původ / Origin | Etymology + explanation notes | Word origin, root language, semantic development |
| Poznámky / Notes | Translation key from notes section | KJV translation key words |
| KJV | KJV field | King James Version designation |

---

## Quick Start

### GitHub Pages (recommended)

1. Place `strong_google_translator.html` and `strong_finalni_verze.txt` in the same folder of your repository.
2. Enable GitHub Pages on the repository.
3. Open the page — the dictionary file loads automatically.

### Local (full functionality)

```bash
# Run a local server in the folder containing the HTML and TXT files
python -m http.server 8080
# Then open: http://localhost:8080/strong_google_translator.html
```

> **Note:** Opening the HTML file directly via `file://` protocol blocks the automatic dictionary load due to browser security restrictions. Use a local server or GitHub Pages for full functionality.

### Local (manual load)

Open `strong_google_translator.html` in any browser and use the **📂 Load .txt** button to manually select `strong_finalni_verze.txt`.

---

## File Structure

```
your-repo/
├── strong_google_translator.html   ← main application (this tool)
├── strong_finalni_verze.txt        ← Strong's dictionary source file
├── README_strong_google_translator.md  ← this file
└── ... (other HTML tools and their READMEs)
```

The app auto-detects `strong_finalni_verze.txt` in the same directory on startup.

---

## Features

### 🔤 Translator Tab
- **Auto translate** — translates all entries in the selected section sequentially
- **Single entry translation** — translate and manually edit individual entries
- **Per-field GT button** — retranslate a single field (Meaning, Definition, etc.) independently
- **Section + range filter** — translate G1–G100 only, or just Hebrew, etc.
- **Status tracking** — each entry shows: todo / pending / done / error
- **60+ target languages** — all Google Translate languages including Czech, Slovak, Polish, German, Latin, and more
- **Configurable delay** — adjustable pause between requests to avoid rate limiting
- **429 retry logic** — automatic retry with backoff on rate limit errors

### 📋 Viewer Tab
- Browse loaded entries in card format
- Shows all original fields + translations if available
- **Entry-by-entry navigation** — Previous / Next buttons
- **Jump to number** — go directly to G26 or H430 etc.
- Range display — show G1–G50 at once (max 200)

### ⚡ Batch Field Tab
- Translate **one selected field** (e.g. only "Meaning") for the entire section at once
- Useful for iterative translation — fill Meaning first, then Definition, etc.
- Skip already translated entries checkbox
- Live progress log with per-entry results
- Download JSON / TXT at any point during or after batch

### 🔧 Corrections Tab — AI-assisted bulk corrections
The machine translation inevitably contains systematic errors. This tab provides a workflow to find and fix them in bulk using AI analysis:

1. **Generate prompt** — creates a structured prompt including translation statistics and a description of the TXT file format for the AI
2. **Attach TXT to AI chat** — send the exported TXT file along with the prompt to any AI (Claude, Gemini, GPT, etc.)
3. **Paste AI response** — the AI returns JSON correction rules + quality assessment
4. **Parse rules** — automatically extracts rules into an editable table
5. **Preview changes** — see all affected entries before applying
6. **Apply** — bulk replace across all entries in memory

**Rule format** (JSON):
```json
[
  {
    "akce": "pridat",
    "pole": "vyznam",
    "hledat": "(sloveno)",
    "nahradit": "(sloveso)",
    "regex": false,
    "popis": "GT mistranslated 'verb' tag as 'sloveno' — ~200 occurrences"
  }
]
```

Existing rules can be updated by the AI using `"akce": "upravit"` with the rule's `id`. The AI response can also include a **quality assessment** in free text (Block 3), which is displayed in the translation log.

**Known systematic GT errors** this workflow catches:
- Grammar tags translated as language names: `(sloveno)`, `(slovensky)`, `(slovinsky)` → `(sloveso)`
- Untranslated codes: `(G:ADV)` → `(příslovce)`
- Tautology in Meaning field: `— což znamená: X` → `—`
- English technical terms left untranslated: `indecl.`, `cf.`, `metaph.`, `sc.`
- Biblical book abbreviations mistranslated

### 💿 LocalStorage Sessions
- Translations are **auto-saved every 20 entries** and on completion
- **Session key = filename** — each dictionary file has its own session
- On reload, the app detects an existing session and prompts to restore
- **📂 LS Sessions** modal shows all saved sessions with date, entry count, and language
- Sessions survive browser close; manual delete available per session or all at once
- Storage limit ~5 MB — export to JSON periodically for large sections

### 📥 Import / Export

| Format | Direction | Description |
|---|---|---|
| TXT | Input | Original Strong's source file |
| TXT | Output | Translated entries only, with `--- Translator Google (cs) ---` section |
| JSON | Output | Dictionary `{ID: {word, trans: {...}}}` for further processing |
| TXT | Re-import | Exported TXT can be reloaded — translations are restored automatically |
| JSON | Re-import | Merge saved translations back into a freshly loaded TXT |

**TXT export format** (per entry):
```
G26 | ἀγάπη
BETA: A)GA/PH
Prepis: agapē
Tvaroslovi: G:N-F
Definice: love, goodwill; esp. of God and Christ...
KJV Významy: love, charity
--- Translator Google (cs) ---
GT_Vyznam: agapē (podst.jm., ž.r.) — láska
GT_Definice: láska, dobrá vůle; zejm. Boží a Kristova láska...
GT_Puvod: Origin: from ἀγαπάω (to love)
GT_KJV: láska, milosrdenství
```

---

## Translation Quality Notes

Google Translate handles this type of content with **mixed quality**:

- ✅ **Works well:** biblical reference abbreviations (Act→Sk, Heb→Žd, Rom→Řím), proper names left intact, grammar categories decoded correctly from tvaroslovi codes
- ✅ **Works well:** definition sentences with clear English structure
- ⚠ **Systematic issues:** grammar tag codes sometimes translated as language names (verb→sloveno/slovensky/slovinsky), tautology in Meaning field, some technical terms left in English
- ⚠ **Use the Corrections tab** to systematically fix these after each batch

Source language hints sent to GT:
- Greek entries: `sl=el` (modern Greek) — prevents transliterated Greek words from being treated as English
- Hebrew entries: `sl=iw` (Hebrew) — prevents Hebrew transliterations from being treated as English words  
- Definitions: `sl=auto` — handles mixed-language content
- Etymology/Notes/KJV: `sl=en`

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate entry list (when not focused on a field) |
| `Ctrl+S` | Save current entry |

---

## Language Support

The UI is available in **Czech** (default) and **English**. Switch using the 🌐 button in the tab bar. The preference is saved to localStorage.

Translation target language can be set to any of 60+ languages including: Czech, Slovak, Polish, German, English, French, Spanish, Italian, Russian, Ukrainian, Arabic, Hebrew (modern), Latin, Esperanto, and many more.

---

## Technical Details

- **Single HTML file** — no build step, no dependencies, no CDN (except Google Fonts for typography)
- **Zero backend** — all logic runs client-side in vanilla JavaScript
- **Google Translate free endpoint** — `translate.googleapis.com/translate_a/single?client=gtx` — no API key required; subject to rate limiting
- **LocalStorage** for session persistence (key prefix: `strongs_session_`)
- **Auto-load** — fetches `strong_finalni_verze.txt` from the same directory on startup (requires HTTP server or GitHub Pages; silent fail on `file://`)

---

## License

```
The Unlicense

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute
this software, for any purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors dedicate
any and all copyright interest in the software to the public domain.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

For more information, please refer to <https://unlicense.org>
```

---

## Related Tools

This tool is part of a larger project for building a fully localized Czech Strong's Concordance. Other tools in this repository handle different aspects of the workflow — see their individual README files for details.

---

*Built with vanilla JS, no frameworks. Designed for biblical scholarship.*
