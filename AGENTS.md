# Pravidla spolupráce

## Role
Senioři full-stack programátor, důraz na čistý kód, bezpečnost a výkon.

## Jazyk
Výhradně čeština.

## Styl
Stručný, faktický, bez vysvětlování zřejmých věcí.

## Kvalita
Úsporný kód, DRY princip, logická řešení bez chyb.

---

# Technický rozcestník

## Co projekt dělá
Strong Translator je webová aplikace pro překlad Strongových hesel (řecké G a hebrejské H) do češtiny pomocí AI modelů. Podporuje dávkový překlad, AUTO mód s nastavitelným intervalem, výběr z více AI providerů (Groq, Google Gemini, OpenRouter), export výsledků do TXT a JSON, internacionalizaci UI (čeština/angličtina) a správu AI promptů.

## Hlavní technologie a jazyky
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Architektura:** Modulární vanilla JS (žádné frameworky)
- **AI integrace:** REST API klienti pro Groq, Google Gemini, OpenRouter
- **Ukládání:** localStorage (průběh, API klíče, nastavení)
- **Formáty:** TXT (Strong slovník), JSON (export, backup)
- **i18n:** Vlastní systém s JSON jazykovými soubory

## Mapa složek

```
strong_translate/
├── index.html                  # Hlavní HTML soubor – celé UI
├── js/                         # Zdrojový JavaScript kód
│   ├── i18n.js                 # Internacionalizace, lokalizace
│   ├── config.js               # Konfigurace providerů a modelů
│   ├── ai/                     # AI klienti, fallback logika, rate limiting
│   ├── translation/            # Překladací moduly, parsování
│   ├── ui/                     # UI komponenty, event handlery
│   └── utils/                  # Pomocné utility
├── styles/
│   └── strong_translator.css   # Celé stylování aplikace
├── i18n/                       # Jazykové soubory
│   ├── cs.json, en.json        # UI překlady
│   └── prompts.*.json          # AI prompt balíčky
└── scripts/                    # Údržbní a build skripty
```

## Klíčové soubory pro vývoj
- `index.html` – Struktura UI, všechny modály
- `js/i18n.js` – Systém překladů UI a promptů
- `js/config.js` – Seznam providerů, modelů, výchozí nastavení
- `js/ai/` – AI request logika, rate limit handling
- `js/translation/` – Core překladací pipeline
- `styles/strong_translator.css` – Veškeré CSS včetně responsivity

## Datové flow
1. **Nahrání souboru** → `js/translation/` parsuje TXT Strong slovníku
2. **UI stav** → `localStorage` ukládá průběh, API klíče, nastavení
3. **Překlad** → Dávkový pipeline mezi AI providery s fallback
4. **Export** → Generování TXT/JSON z local storage dat

## Důležité konvence
- Žádnéexterní závislosti, pouze vanilla JS
- Komunikace s AI pouze přes REST (žádné SDK)
- Všechna data persistována v `localStorage` (bez backendu)
- i18n klíče structured: `ui.Obecne`, `prompt.*`, `error.*`

## Údržba dokumentace
- Kdykoliv dojde k významné změně struktury souborů nebo logiky projektu, tvým prvním úkolem je aktualizovat tento soubor (`AGENTS.md`).
- Před každou větší změnou kódu ověř, zda mapa projektu stále odpovídá realitě.