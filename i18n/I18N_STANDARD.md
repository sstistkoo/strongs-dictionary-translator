# i18n standard pro projekt

Tento dokument definuje jednotný formát a pravidla pro překlady UI.

## 1) Doporučený formát souborů

- Primární formát: `JSON`
- Zdrojový jazyk: `i18n/cs.json`
- Cílové jazyky: `i18n/en.json`, `i18n/de.json`, `i18n/sk.json`, ...
- Kód jazyka: používej ISO (`cs`, `en`, `de`, `sk`, `pl`, `fr`, `es`)

## 2) Struktura klíčů

Používej **flat klíče** (tečka jako namespace):

```json
{
  "app.title": "Strong překladač",
  "nav.settings": "Nastavení",
  "buttons.save": "Uložit"
}
```

Pravidla:

- klíče piš malými písmeny
- odděluj části tečkou (`section.subsection.item`)
- nepoužívej mezery v klíčích
- klíč je stabilní identifikátor, neměň ho kvůli změně textu

## 3) Placeholdery a technické tokeny

Povolené placeholdery:

- `{name}`, `{count}`, `{version}`, ...
- HTML tagy v textu (`<b>`, `<i>`, `<a>`) jen když jsou potřeba

Pravidla:

- placeholdery musí být ve všech jazycích identické
- překlad nesmí měnit názvy placeholderů
- překlad nesmí mazat HTML tagy, pokud byly ve zdroji

Příklad:

```json
{
  "welcome.user": "Vítej, {name}!",
  "items.count": "Počet: {count}"
}
```

## 4) Plurály (doporučení)

Pokud je potřeba pluralizace, používej ICU styl:

```json
{
  "cart.items": "{count, plural, one {# položka} few {# položky} other {# položek}}"
}
```

Pokud aplikace ICU nepodporuje, používej oddělené klíče:

```json
{
  "cart.items.one": "{count} položka",
  "cart.items.few": "{count} položky",
  "cart.items.other": "{count} položek"
}
```

## 5) Co patří / nepatří do i18n

Patří:

- UI texty
- tlačítka, popisky, hlášky, chyby
- validační zprávy

Nepatří:

- interní ID
- API hodnoty
- technické klíče konfigurace

## 6) Workflow překladu

1. Uprav `cs.json` (zdroj)
2. Přelož do cílových jazyků přes `i18n-translator.html`
3. Spusť kontrolu:
   - stejné klíče mezi jazyky
   - stejné placeholdery
   - validní JSON
4. Proveď rychlý UI smoke-test

## 7) Minimální validační pravidla

Každý jazykový soubor musí splnit:

- validní JSON
- 1:1 shoda klíčů se `cs.json`
- 1:1 shoda placeholderů proti `cs.json`
- žádné prázdné hodnoty u povinných klíčů

## 8) Naming konvence

- Prefixy:
  - `app.*` obecné
  - `nav.*` navigace
  - `buttons.*` tlačítka
  - `form.*` formuláře
  - `errors.*` chyby
  - `modal.*` modaly
  - `status.*` stavové texty
- Konzistence je důležitější než perfektní taxonomie.

## 9) Ukázka doporučeného základu `cs.json`

```json
{
  "app.title": "Strong překladač",
  "nav.settings": "Nastavení",
  "buttons.save": "Uložit",
  "buttons.cancel": "Zrušit",
  "status.loading": "Načítám...",
  "status.done": "Hotovo",
  "errors.network": "Chyba připojení",
  "modal.confirm.title": "Potvrzení",
  "modal.confirm.body": "Opravdu chcete pokračovat?"
}
```

## 10) Krátké rozhodnutí pro tento projekt

- Držíme se `JSON + flat keys + placeholder guard`.
- Zdroj je `cs.json`.
- Překlady se generují do `xx.json` a vždy se auditují na:
  - shodu klíčů
  - shodu placeholderů
  - validitu JSON
