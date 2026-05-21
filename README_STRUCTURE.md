# Strong Translator — Strong G/H slovník → čeština

## Aktuální struktura (2026-05-12)

```
strong_translate/
│
├── index.html                      ← Hlavní webová aplikace
├── strong_prompts.js               ← AI prompty pro překlad
├── strong_translator_core_new.js   ← Hlavní logika aplikace
│
├── js/                             ← JavaScript moduly
│   ├── i18n.js                     ← Mezinárodní rozhraní (i18n)
│   ├── ai/
│   │   ├── client.js               ← AI klient (Groq, Gemini, OpenRouter)
│   │   └── fallback.js             ← Fallback logika
│   ├── translation/
│   │   ├── batch.js                ← Dávkový překlad
│   │   ├── single.js               ← Jednotlivý překlad
│   │   ├── utils.js                ← Pomocné funkce
│   │   └── topicRepair.js          ← Oprava témat
│   ├── ui/
│   │   ├── header.js               ← Hlavička UI
│   │   ├── list.js                 ← Seznam hesel
│   │   ├── detail.js               ← Detail hesla
│   │   ├── settingsModals.js       ← Modální nastavení
│   │   ├── preview.js              ← Náhled
│   │   ├── toast.js                ← Notifikace
│   │   └── modals.js               ← Společné modály
│   ├── parser.js                   ← Parser TXT souborů
│   ├── storage.js                  ← Uložení do localStorage/IndexedDB
│   ├── idbStorage.js               ← IndexedDB operace
│   ├── state.js                    ← Správa stavu aplikace
│   ├── config.js                   ← Konfigurace
│   ├── badTranslations.js          ← Seznam špatných překladů
│   ├── promptLibrary.js            ← Knihovna promptů
│   ├── auto.js                     ← Auto překlad
│   ├── settings.js                 ← Nastavení
│   ├── utils.js                    ← Obecné utility
│   ├── modelTest.js                ← Testování modelů
│   └── storageStats.js             ← Statistiky úložiště
│
├── styles/
│   └── strong_translator.css       ← Styly
│
├── i18n/                           ← Mezinárodní překlady
│   ├── en.json                     ← Základní anglické texty
│   ├── cs.json                     ← České překlady
│   ├── ru.json, uk.json, bg.json   ← Další jazyky
│   └── prompts.*.json              ← Prompty pro různé jazyky
│
├── scripts/                        ← Údržbní skripty
│   ├── fix-i18n.js                 ← Doplnění chybějících i18n klíčů
│   ├── fix-i18n-all.js             ← Reset i18n souborů kromě cs/en
│   ├── build-prompts-i18n.mjs      ← Build promptů pro i18n
│   └── sync_i18n_keys.cjs          ← Synchronizace i18n klíčů
│
├── tools/                          ← Vývojářské nástroje
│   ├── translate_i18n.py           ← Překlad i18n přes Google Translate
│   └── validate_i18n_ru.py         ← Validace i18n souborů
│
├── backup/                         ← Zálohy (necháváme bez změn)
│   ├── strongs-prekladac.html
│   ├── strongs_manager.html
│   ├── strongs-manager-plugin.js
│   └── test (13).txt
│
├── strong_greek_detailed.txt       ← Data: řecký detail
├── strong_finalni_verze.txt        ← Hlavní výstup
├── BAD_TRANSLATIONS.txt            ← Seznam špatných překladů
│
├── package.json                    ← NPM konfigurace
└── README_STRUCTURE.md             ← Tento soubor
```

## Klíčové soubory

- **index.html** — Spustí aplikaci v prohlížeči
- **js/i18n.js** — Načte překlady podle jazyka
- **i18n/cs.json, i18n/en.json** — Aktivní jazykové soubory
- **scripts/fix-i18n.js** — Doplní chybějící klíče do i18n souborů

## Použití

```bash
# Spustit lokální server
npx serve .
# nebo
python -m http.server 8000
```

Otevřít `http://localhost:8000` v prohlížeči.