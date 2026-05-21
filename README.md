# Strong Translator

Překladač Strong slovníku (řečtina/hebrejština) do češtiny s AI pipeline, dávkovým překladem a exportem.

## Co to je

Strong Translator je webová aplikace pro interaktivní překlad hesel Strong slovníku (řečtina G a hebrejština H) do češtiny pomocí AI modelů. Podporuje:

- **Dávkový překlad** — několik hesel najednou
- **AUTO mód** — automatický překlad s nastavitelným interval
- **Více AI providerů** — Groq, Google Gemini, OpenRouter
- **Export výsledků** — TXT i JSON formáty
- **Mezinárodní rozhraní** — UI v češtině a angličtině

## Struktura projektu

```
strong_translate/
├── index.html              ← Hlavní webová aplikace
├── js/                     ← JavaScript moduly
│   ├── i18n.js            ← Mezinárodní rozhraní
│   ├── ai/                ← AI klient a fallback logika
│   ├── translation/       ← Překladací moduly
│   └── ui/                ← UI komponenty
├── styles/
│   └── strong_translator.css
├── i18n/                   ← Jazykové soubory
│   ├── en.json, cs.json   ← Aktivní jazyky
│   └── prompts.*.json     ← AI prompty
└── scripts/                ← Údržbní skripty
```

## Spuštění

```bash
# Lokální server (vyžadováno pro fetch API)
npx serve .
# nebo
python -m http.server 8000
```

Otevřít `http://localhost:8000` v prohlížeči.

## Požadavky

- Moderní prohlížeč (Chrome, Firefox, Edge)
- API klíč od jednoho z providerů:
  - [Groq](https://console.groq.com/keys) (zdarma)
  - [Google Gemini](https://aistudio.google.com/app/apikey) (zdarma)
  - [OpenRouter](https://openrouter.ai/keys) (zdarma i placené modely)

## Použití

1. Vložte API klíč do pole "API Klíč"
2. Vyberte TXT soubor se Strong slovníkem nebo použijte výchozí
3. Nastavte velikost dávky a interval
4. Klikněte na **Editor** pro načtení
5. Použijte **AUTO** pro automatický překlad nebo **Dávka** pro ruční kontrolu

## Licence

Tento projekt je uvolněn pod licencí [Unlicense](https://unlicense.org/). To znamená, že kód je ve veřejné doméně a můžete ho libovolně upravovat, kopírovat i prodávat bez jakýchkoliv omezení.