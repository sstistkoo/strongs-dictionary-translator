# Strong Translator

Webová aplikace pro překlad hesel Strongova slovníku (řečtina G / hebrejština H) do češtiny a dalších jazyků pomocí AI.

## Co to dělá

Strong Translator načte TXT soubor se Strongovým slovníkem, rozdělí ho na hesla a odešle je v dávkách na AI API. Každé heslo se přeloží do strukturovaných sekcí (Definice, Význam, Původ, KJV, Specialista). Průběh překladu se ukládá do localStorage/IndexedDB — překlad lze kdykoli přerušit a pokračovat.

## Hlavní funkce

- **Dávkový překlad** — konfigurovatelná velikost dávky a interval
- **AUTO mód** — plně automatický překlad s nastavitelným intervalem
- **Víceúrovňový pipeline** — primární + sekundární AI průchod s topic-specific prompty pro každou sekci
- **Fallback logika** — při selhání providera nebo překročení limitu automaticky přepne
- **Více AI providerů** — Groq, Google Gemini, OpenRouter (bez SDK, přes REST)
- **Správa API klíčů** — profily klíčů per provider, uloženo v localStorage
- **Model testing** — porovnání výstupů různých modelů/promptů
- **Prompt knihovna** — ukládání, editace a správa vlastních promptů
- **Export** — TXT i JSON formáty
- **Záloha/obnova** — export a import celého stavu překladu
- **Statistiky úložiště** — přehled využití localStorage/IndexedDB
- **Internacionalizace** — přes 20 jazyků UI a překladových promptů

## Podporované AI modely

| Provider | Modely |
|----------|--------|
| **Groq** | Llama 4 Scout 17B, Llama 3.3 70B, Llama 3.1 8B |
| **Google Gemini** | Gemini 3.1 Flash-Lite, 2.5 Flash-Lite, 2.5 Flash, 3.1 Pro |
| **OpenRouter** | libovolný model dle nastavení |

## Podporované jazyky překladu

`cs` `en` `de` `fr` `es` `it` `nl` `pl` `pt` `ru` `uk` `bg` `sk` `hu` `ro` `ar` `he` `el` `tr` `zh-CN` `ko` `ja` `da` `sv` `no` `fi`

## Struktura projektu

```
strong_translate/
├── index.html                      ← Celé UI aplikace
├── strong_prompts.js               ← AI prompty (legacy)
├── strong_translator_core_new.js   ← Core parser + hlavní pipeline
│
├── js/
│   ├── main.js                     ← Vstupní bod, inicializace
│   ├── config.js                   ← Konstanty, seznam providerů a modelů
│   ├── state.js                    ← Centrální stav aplikace
│   ├── i18n.js                     ← Systém internacionalizace
│   ├── settings.js                 ← Uživatelská nastavení
│   ├── parser.js                   ← Parser TXT souborů Strong slovníku
│   ├── storage.js                  ← localStorage operace
│   ├── idbStorage.js               ← IndexedDB operace
│   ├── auto.js                     ← AUTO mód logika
│   ├── backup.js                   ← Export/import zálohy
│   ├── exportData.js               ← TXT/JSON export
│   ├── apiKeys.js                  ← Správa API klíčů a profilů
│   ├── promptLibrary.js            ← Knihovna a správa promptů
│   ├── modelTest.js                ← Testování modelů
│   ├── modelTestOutput.js          ← Zobrazení výsledků testů
│   ├── badTranslations.js          ← Seznam špatných překladů
│   ├── storageStats.js             ← Statistiky úložiště
│   ├── aiPromptsResolve.js         ← Výběr aktivního promptu
│   ├── utils.js                    ← Utility (debounce, sleep, escHtml, …)
│   ├── ai/
│   │   ├── call.js                 ← Odeslání AI requestu
│   │   ├── client.js               ← Parser odpovědí (Groq, Gemini, OpenRouter)
│   │   └── fallback.js             ← Fallback a abort logika
│   ├── translation/
│   │   ├── batch.js                ← Dávkový překlad
│   │   ├── single.js               ← Překlad jednotlivého hesla
│   │   ├── topicRepair.js          ← Oprava topic sekcí
│   │   └── utils.js                ← Překladové utility
│   └── ui/
│       ├── header.js               ← Hlavička, ovládání
│       ├── list.js                 ← Seznam hesel (virtuální scroll)
│       ├── detail.js               ← Detail hesla
│       ├── modals.js               ← Sdílené modály (výběr rozsahu)
│       ├── settingsModals.js       ← Modální nastavení
│       ├── preview.js              ← Náhled překladu
│       ├── limits.js               ← Správa limitů providerů
│       ├── resize.js               ← Mobilní resize split pane
│       └── toast.js                ← Toast notifikace
│
├── styles/
│   └── strong_translator.css       ← Veškeré CSS včetně responsivity
│
├── i18n/
│   ├── cs.json, en.json, de.json … ← Překlady UI (26 jazyků)
│   └── prompts.cs.json, prompts.en.json … ← AI prompt balíčky (26 jazyků)
│
├── scripts/                        ← Údržbní skripty (Node.js)
│   ├── fix-i18n.js                 ← Doplnění chybějících i18n klíčů
│   ├── fix-i18n-all.js             ← Reset i18n souborů kromě cs/en
│   ├── build-prompts-i18n.mjs      ← Build promptů pro i18n
│   └── sync_i18n_keys.cjs          ← Synchronizace i18n klíčů
│
├── tools/                          ← Python nástroje
│   ├── translate_i18n.py           ← Strojový překlad i18n přes Google/DeepL
│   └── validate_i18n_ru.py         ← Validace i18n souborů
│
├── backup/                         ← Zálohy původních verzí
└── translatory/                    ← Starší experimenty
```

## Spuštění

Aplikace nevyžaduje build ani instalaci závislostí. Stačí lokální HTTP server (kvůli ES modulům a fetch API):

```bash
# Node.js
npx serve .

# nebo Python
python -m http.server 8000
```

Otevřít `http://localhost:8000` v prohlížeči.

> VS Code: funguje i přes Live Server (port 5500).

## Požadavky

- Moderní prohlížeč (Chrome, Firefox, Edge)
- API klíč od alespoň jednoho poskytovatele:
  - [Groq](https://console.groq.com/keys) — zdarma
  - [Google AI Studio](https://aistudio.google.com/app/apikey) — zdarma
  - [OpenRouter](https://openrouter.ai/keys) — zdarma i placené modely

## Základní použití

1. Otevřete aplikaci v prohlížeči
2. Vložte API klíč v nastavení (ikona klíče)
3. Nahrajte TXT soubor se Strongovým slovníkem nebo použijte výchozí
4. Vyberte cílový jazyk překladu
5. Klikněte **Editor** pro načtení hesel
6. Spusťte **AUTO** (plně automatický) nebo **Dávka** (ruční kontrola)

## Architektura

- **Žádné frameworky** — vanilla JS (ES6+ moduly), žádný build step
- **Žádný backend** — veškerá data v localStorage/IndexedDB
- **AI přes REST** — přímé HTTP volání na API, žádná SDK závislost
- **i18n** — vlastní systém, JSON soubory, překlady UI i AI promptů odděleny

## Licence

[Unlicense](https://unlicense.org/) — veřejná doména, bez omezení.
