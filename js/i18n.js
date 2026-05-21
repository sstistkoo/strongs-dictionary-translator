import { PROVIDERS } from './config.js';

export const UI_LANG_KEY = 'strong_ui_lang';
export const DEFAULT_UI_LANG = 'cs';
export const UI_LANGS = new Set(['cs', 'en', 'de', 'sk', 'pl', 'fr', 'es', 'it', 'uk', 'ru', 'ro', 'pt', 'bg', 'da', 'fi', 'hu', 'nl', 'no', 'sv', 'ar', 'el', 'tr', 'zh-CN', 'ja', 'ko', 'he']);
const FIXED_EN_KEYS = new Set([
  'detail.label.definitionEn',
  'export.field.definitionEn'
]);

// Map target language → prompt file code
const TARGET_TO_PROMPT_CODE = {
  cz: 'cs', cs: 'cs',
  sk: 'sk',
  pl: 'pl',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  pt: 'pt',
  ru: 'ru',
  uk: 'uk',
  bg: 'bg',
  ro: 'ro',
  da: 'da',
  fi: 'fi',
  hu: 'hu',
  nl: 'nl',
  no: 'no',
  sv: 'sv',
  ar: 'ar',
  el: 'el',
  tr: 'tr',
   'zh-CN': 'zh-cn',
  'zh_cn': 'zh-cn',
  ja: 'ja',
  ko: 'ko',
  he: 'he',
  en: 'en'
};

// Cache for prompt packs
const PROMPT_PACK_CACHE = {};

/**
 * Preloads all prompt packs needed for UI and target languages.
 */
export async function preloadPromptPacks() {
  const codes = new Set(Object.values(TARGET_TO_PROMPT_CODE));
  codes.add('cs');
  codes.add('en');
  const fetchPromises = Array.from(codes).map(async (code) => {
    try {
      const resp = await fetch(`./i18n/prompts.${code}.json`, { cache: 'no-store' });
      if (resp.ok) {
        PROMPT_PACK_CACHE[code] = await resp.json();
      } else {
        console.warn('[i18n] Prompt pack not found for code:', code, resp.status);
      }
    } catch (e) {
      console.warn('[i18n] Error loading prompt pack', code, e.message);
    }
  });
  await Promise.all(fetchPromises);
}

/** Cílový jazyk slovníku (strong_target_lang) → kód v závorkách v UI, pokud není zvolen ručně. */
const TARGET_TO_CONTENT_TAG = {
  cz: 'CZ',
  cs: 'CZ',
  en: 'EN',
  sk: 'SK',
  pl: 'PL',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  it: 'IT',
  pt: 'PT',
  ru: 'RU',
  da: 'DA',
  fi: 'FI',
  hu: 'HU',
  nl: 'NL',
  no: 'NO',
  ro: 'RO',
  sv: 'SV',
  bg: 'BG',
  ch: 'zh-CN',
  'zh-CN': 'ZH_CN',
  sp: 'ES',
  gr: 'EL',
  he: 'HE',
  ar: 'AR',
  el: 'EL',
  tr: 'TR',
  ja: 'JA',
  ko: 'KO',
  uk: 'UK'
};

export const CONTENT_TAG_LANG_KEY = 'strong_content_tag_lang';
export const CONTENT_TAG_LANG_MANUAL_KEY = 'strong_content_tag_lang_manual';

export function getDefaultContentTag() {
  let target = 'cz';
  if (typeof localStorage !== 'undefined') {
    target = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  }
  if (target === 'cs') return 'CZ';
  return TARGET_TO_CONTENT_TAG[target] || 'EN';
}

/**
 * Kód v závorkách u témat, např. (CZ) / (DE) — dle volby v nastavení jazyků nebo cíle překladu.
 */
export function getContentLangTag() {
  if (typeof localStorage === 'undefined') return 'EN';
  // Tag v závorkách řídíme jazykem UI, aby nebyl mix (např. Definition (EN) v češtině).
  const ui = getUiLang();
  
   // Map UI language to content tag (brackets language)
   const UI_TO_CONTENT_TAG = {
     cs: 'CZ',
     en: 'EN',
     sk: 'SK',
     pl: 'PL',
     de: 'DE',
     fr: 'FR',
     es: 'ES',
     it: 'IT',
     pt: 'PT',
     ru: 'RU',
     da: 'DA',
     fi: 'FI',
     hu: 'HU',
     nl: 'NL',
     no: 'NO',
     ro: 'RO',
     sv: 'SV',
   bg: 'BG',
   el: 'EL',
   ar: 'AR',
   tr: 'TR',
   'zh-CN': 'ZH_CN',
   ja: 'JA',
   ko: 'KO',
   he: 'HE',
   uk: 'UK'
};
  
  const uiTag = UI_TO_CONTENT_TAG[ui];
  // Pro základní UI jazyky (CS/EN/SK/PL/DE/FR/ES/IT/PT) mapujeme na odpovídající tag,
  // pro ostatní používáme manuální nastavení, pokud existuje, jinak mapování nebo default.
  const BASIC_UI = new Set(['cs', 'en', 'sk', 'pl', 'de', 'fr', 'es', 'it', 'pt']);
  if (BASIC_UI.has(ui)) return uiTag || 'CZ';

  // Fallback to stored manual tag or default based on target language
  const stored = String(localStorage.getItem(CONTENT_TAG_LANG_KEY) || '').trim();
  const manual = localStorage.getItem(CONTENT_TAG_LANG_MANUAL_KEY) === '1';
  // Legacy migration: old stored tags without "manual" flag are ignored and we use dynamic default.
  if (stored && manual) return stored;
  return getDefaultContentTag();
}
export const INLINE_UI_MESSAGES = {
  cs: {
    'toast.error.withMessage': '✗ Chyba: {message}'
  },
  en: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  sk: {
    'toast.error.withMessage': '✗ Chyba: {message}'
  },
  pl: {
    'toast.error.withMessage': '✗ Błąd: {message}'
  },
  de: {
    'toast.error.withMessage': '✗ Fehler: {message}'
  },
  fr: {
    'toast.error.withMessage': '✗ Erreur: {message}'
  },
  es: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  it: {
    'toast.error.withMessage': '✗ Errore: {message}'
  },
  pt: {
    'toast.error.withMessage': '✗ Erro: {message}'
  },
  ru: {
    'toast.error.withMessage': '✗ Ошибка: {message}'
  },
  uk: {
    'toast.error.withMessage': '✗ Помилка: {message}'
  },
  bg: {
    'toast.error.withMessage': '✗ Грешка: {message}'
  },
  da: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  fi: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  hu: {
    'toast.error.withMessage': '✗ Hiba: {message}'
  },
  nl: {
    'toast.error.withMessage': '✗ Fout: {message}'
  },
  no: {
    'toast.error.withMessage': '✗ Feil: {message}'
  },
  ro: {
    'toast.error.withMessage': '✗ Eroare: {message}'
  },
  sv: {
    'toast.error.withMessage': '✗ Fel: {message}'
  },
  ar: {
    'toast.error.withMessage': '✗ خطأ: {message}'
  },
  el: {
    'toast.error.withMessage': '✗ Σφάλμα: {message}'
  },
  tr: {
    'toast.error.withMessage': '✗ Hata: {message}'
  },
   'zh-CN': {
     'toast.error.withMessage': '✗ 错误: {message}'
   },
  he: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  ja: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  ko: {
    'toast.error.withMessage': '✗ Error: {message}'
  },
  uk: {
    'toast.error.withMessage': '✗ Помилка: {message}'
  },
  bg: {
    'toast.error.withMessage': '✗ Грешка: {message}'
  }
};

let lastUiLangFallback = null;

let UI_MESSAGES = INLINE_UI_MESSAGES;
let uiMessagesLoadPromise = null;

export async function fetchUiDictionary(lang) {
  const url = `./i18n/${lang}.json`;
  const response = await fetch(url, { cache: 'no-store' });
  if (response.ok) return response.json();
  throw new Error(`HTTP ${response.status} for ${url}`);
}

/**
 * Načte AI prompt balíček pro daný cílový jazyk (synchronně z cache).
 * Pokud je v cache, vrátí ho. Jinak vrátí fallback (cs nebo en).
 */
export function getPromptPack(targetLang) {
  const langCode = String(targetLang || 'cz').toLowerCase();
  if (langCode === 'personal') {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('strong_personal_prompt_json') : null;
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch { /* fallback below */ }
    }
    return PROMPT_PACK_CACHE['cs'] || PROMPT_PACK_CACHE['en'] || {};
  }
  const promptCode = TARGET_TO_PROMPT_CODE[langCode] || 'cs';
  return PROMPT_PACK_CACHE[promptCode] || PROMPT_PACK_CACHE['cs'] || PROMPT_PACK_CACHE['en'] || {};
}


/**
 * Načte AI prompt balíčky bez 404 pro každý jazyk zvlášť.
 * Používá jen i18n/prompts.{DEFAULT_UI_LANG}.json a volitelně prompts.en.json (2 requesty).
 * Jazyk cs: balíček prompts.cs.json. Vše ostatní: prompts.en.json (anglické instrukce pro AI, i když UI není en).
 * Pokud prompts.en.json chybí, použije se cs balíček.
 */
/**
 * Načte AI prompt balíčky a přidá je do načtených UI zpráv.
 * Používá cache PROMPT_PACK_CACHE, které by mělo být předem načteno.
 */


export function validateUiMessages(messages) {
  const base = messages[DEFAULT_UI_LANG] || {};
  const baseKeys = Object.keys(base);
  for (const lang of UI_LANGS) {
    if (lang === DEFAULT_UI_LANG) continue;
    const dict = messages[lang] || {};
    const missing = baseKeys.filter(key => !(key in dict));
    if (missing.length) {
      console.warn(`[i18n] Missing keys in "${lang}":`, missing)
    }
  }
}

export function loadUiMessages(force = false) {
  if (uiMessagesLoadPromise && !force) return uiMessagesLoadPromise;
  uiMessagesLoadPromise = (async () => {
    const fallback = INLINE_UI_MESSAGES;
    const loaded = { ...fallback };
     try {
       loaded[DEFAULT_UI_LANG] = await fetchUiDictionary(DEFAULT_UI_LANG);
     } catch (err) {
       loaded[DEFAULT_UI_LANG] = fallback[DEFAULT_UI_LANG] || {};
     }
     await Promise.all(Array.from(UI_LANGS).filter(lang => lang !== DEFAULT_UI_LANG).map(async lang => {
       try {
         loaded[lang] = await fetchUiDictionary(lang);
       } catch (err) {
         loaded[lang] = fallback[lang] || {};
       }
     }));
     // Preload all prompt packs into cache (do not merge into UI messages)
     try {
       await preloadPromptPacks();
     } catch (err) {
       console.warn('[i18n] Failed to preload prompt packs:', err);
     }
     UI_MESSAGES = loaded;
    validateUiMessages(UI_MESSAGES);
    return UI_MESSAGES;
  })();
  return uiMessagesLoadPromise;
}

export function getUiLang() {
   const raw = String(localStorage.getItem(UI_LANG_KEY) || DEFAULT_UI_LANG).toLowerCase();
   if (UI_LANGS.has(raw)) return raw;
   // Allow custom languages (stored in localStorage with prefix)
   if (raw && raw !== DEFAULT_UI_LANG && typeof window !== 'undefined' && window.__CUSTOM_UI_MESSAGES__?.[raw]) {
     return raw;
   }
   if (raw && raw !== DEFAULT_UI_LANG) {
     lastUiLangFallback = { requested: raw, fallback: DEFAULT_UI_LANG };
   }
   return DEFAULT_UI_LANG;
 }

export function consumeUiLangFallback() {
  const info = lastUiLangFallback;
  lastUiLangFallback = null;
  return info;
}

export function t(key, params = {}) {
   const lang = getUiLang();
   const customMessages = typeof window !== 'undefined' ? window.__CUSTOM_UI_MESSAGES__ : null;
   const source = customMessages?.[lang] || UI_MESSAGES[lang] || UI_MESSAGES[DEFAULT_UI_LANG];
   const fallback = UI_MESSAGES[DEFAULT_UI_LANG];
   // For custom languages, fallback should also check custom first, then default
   let text = source?.[key] ?? fallback?.[key] ?? key;
   for (const [name, value] of Object.entries(params || {})) {
     text = text.replaceAll(`{${name}}`, String(value));
   }
   if (!FIXED_EN_KEYS.has(key)) return text;
   if (/\(EN\)/.test(text)) return text;
   if (/\([A-Za-z-]+\)/.test(text)) return text.replace(/\([A-Za-z-]+\)/, '(EN)');
   return `${text} (EN)`;
 }

export function uiLabel(labelOrKey) {
  const raw = String(labelOrKey || '').trim();
  if (!raw) return '';
  return raw.startsWith('model.') ? t(raw) : raw;
}

export function refreshStaticProviderSelectLabel(selectId, prov) {
  const select = document.getElementById(selectId);
  if (!select || prov === 'openrouter') return;
  const selected = String(select.value || '').trim();
  const options = (PROVIDERS[prov]?.models || []).map(([value, label]) => ({ value, label: uiLabel(label) || value }));
  select.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  if (selected && Array.from(select.options).some(o => o.value === selected)) {
    select.value = selected;
  }
}
