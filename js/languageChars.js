// Centrální mapa specifických znaků cílových jazyků
// Používá se pro detekci, zda text obsahuje znaky cílového jazyka
// (zjištění "nediakritického" / nepřeloženého textu)

const LANG_CHAR_SETS = {
  // Latinské skripty s diakritikou
  cs: /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,
  sk: /[áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/,
  pl: /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,
  de: /[äöüßÄÖÜ]/,
  fr: /[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/,
  es: /[áéíóúüñÁÉÍÓÚÜÑ]/,
  it: /[àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]/,
  pt: /[áâãàçéêíóôõúüÁÂÃÀÇÉÊÍÓÔÕÚÜ]/,
  ro: /[ăâîșțĂÂÎȘȚşţŞŢ]/,
  da: /[æøåÆØÅ]/,
  fi: /[äöåÄÖÅ]/,
  hu: /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/,
  nl: /[áéíóúýëÁÉÍÓÚÝË]/,
  no: /[æøåÆØÅ]/,
  sv: /[äöåÄÖÅ]/,
  tr: /[çğıöşüİÇĞÖŞÜ]/,
  // Cyrilice
  ru: /[Ѐ-ӿԀ-ԯ]/,
  uk: /[Ѐ-ӿԀ-ԯ]/,
  bg: /[Ѐ-ӿԀ-ԯ]/,
  // Jiné skripty
  el: /[Ͱ-Ͽἀ-῿]/,            // řečtina
  he: /[֐-׿]/,                          // hebrejština
  ar: /[؀-ۿ]/,                          // arabština
  'zh-cn': /[一-鿿]/,                     // čínské znaky (CJK Unified)
  ja: /[぀-ゟ゠-ヿ一-鿿]/, // hiragana + katakana + kanji
  ko: /[가-힯]/,                          // hangul
};

// Aliasy pro neoficiální / historické kódy
const LANG_ALIASES = {
  cz: 'cs',
  cz_cz: 'cs',
  sp: 'es',
  ch: 'zh-cn',
  zh: 'zh-cn',
};

function normalizeLangKey(lang) {
  const raw = String(lang || 'cs').toLowerCase().replace('_', '-');
  if (LANG_ALIASES[raw]) return LANG_ALIASES[raw];
  if (raw in LANG_CHAR_SETS) return raw;
  // Zkus základní část (např. 'pt-br' → 'pt')
  const base = raw.split('-')[0];
  if (LANG_ALIASES[base]) return LANG_ALIASES[base];
  if (base in LANG_CHAR_SETS) return base;
  return raw;
}

// Jazyky, pro které nemá test "obsahuje diakritiku" smysl:
// - en: žádná diakritika
// - zh-cn, ja, ko: logogramy/slabiky, ne diakritika
// - ar, he: diakritika (harakat/niqqud) je opcionální a v moderním textu obvykle chybí
const NO_DIACRITIC_LANGS = new Set(['en', 'zh-cn', 'ja', 'ko', 'ar', 'he']);

/**
 * Regex pro detekci znaků cílového jazyka. Vrací smysluplnou regex
 * i pro jazyky bez diakritiky (pro `en` latinská písmena `/[a-zA-Z]/`).
 * Pro úplně neznámý jazyk vrací null.
 */
export function getLangCharSet(lang) {
  const key = normalizeLangKey(lang);
  if (LANG_CHAR_SETS[key]) return LANG_CHAR_SETS[key];
  if (key === 'en') return /[a-zA-Z]/;
  return null;
}

/**
 * Pro místa, která potřebují vždy nějakou regex (volající nezná null):
 * vrátí `/[a-zA-Z]/` jako rozumný fallback pro neznámé latinské skripty.
 * Pozor: `langChars.test(s)` pak vrátí true pro libovolný latinský text,
 * což je správně pro `en`, ale neumí rozlišit „cílový jazyk vs jiný latinský“.
 */
export function getLangCharSetOrAny(lang) {
  return getLangCharSet(lang) || /[a-zA-Z]/;
}

/**
 * Regex pro detekci DIAKRITIKY cílového jazyka. Vrací null pro jazyky,
 * kde koncept diakritiky nedává smysl (en, CJK, ar, he). Volající musí
 * null případ ošetřit (typicky: kontrolu „nediakritický text" přeskočit).
 */
export function getLangDiacriticRe(lang) {
  const key = normalizeLangKey(lang);
  if (NO_DIACRITIC_LANGS.has(key)) return null;
  return LANG_CHAR_SETS[key] || null;
}
