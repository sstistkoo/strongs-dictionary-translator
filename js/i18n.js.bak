import { PROVIDERS } from './config.js';

export const UI_LANG_KEY = 'strong_ui_lang';
export const DEFAULT_UI_LANG = 'cs';
export const UI_LANGS = new Set([
  'cs', 'en', 'sk', 'pl', 'de', 'fr', 'es', 'it', 'pt', 'ru',
  'da', 'fi', 'hu', 'nl', 'no', 'ro', 'sv', 'ar', 'el', 'tr', 'zh-cn'
]);
const FIXED_EN_KEYS = new Set([
  'detail.label.definitionEn',
  'export.field.definitionEn'
]);

/** Cílový jazyk slovníku (strong_target_lang) → kód v závorkách v UI, pokud není zvolen ručně. */
const TARGET_TO_CONTENT_TAG = {
  cz: 'CZ',
  cs: 'CZ',
  en: 'EN',
  sk: 'SK',
  pl: 'PL',
  bg: 'BG',
  ch: 'zh-CN',
  sp: 'ES',
  gr: 'EL',
  he: 'HE',
  ar: 'AR',
  el: 'EL',
  tr: 'TR',
  'zh-cn': 'ZH_CN'
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
  if (ui === 'cs') return 'CZ';
  if (ui === 'en') return 'EN';
  if (ui === 'sk') return 'SK';
  if (ui === 'pl') return 'PL';
  const stored = String(localStorage.getItem(CONTENT_TAG_LANG_KEY) || '').trim();
  const manual = localStorage.getItem(CONTENT_TAG_LANG_MANUAL_KEY) === '1';
  // Legacy migrace: staré uložené tagy bez "manual" příznaku ignorujeme a bereme dynamický default.
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
  'zh-cn': {
    'toast.error.withMessage': '✗ 错误: {message}'
  }
};

let lastUiLangFallback = null;

let UI_MESSAGES = INLINE_UI_MESSAGES;
let uiMessagesLoadPromise = null;

export async function fetchUiDictionary(lang) {
  const url = `./i18n/${lang}.json`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

/**
 * Načte AI prompt balíčky bez 404 pro každý jazyk zvlášť.
 * Používá jen i18n/prompts.{DEFAULT_UI_LANG}.json a volitelně prompts.en.json (2 requesty).
 * Jazyk cs: balíček prompts.cs.json. Vše ostatní: prompts.en.json (anglické instrukce pro AI, i když UI není en).
 * Pokud prompts.en.json chybí, použije se cs balíček.
 */
async function mergePromptPacksIntoLoaded(loaded) {
  const tryFile = async (filename) => {
    try {
      const response = await fetch(`./i18n/${filename}`, { cache: 'no-store' });
      if (response.ok) return await response.json();
    } catch (_) {}
    return null;
  };
  const packDefault = (await tryFile(`prompts.${DEFAULT_UI_LANG}.json`)) || {};
  const packEnRaw = await tryFile('prompts.en.json');
  const packEn =
    packEnRaw && typeof packEnRaw === 'object' && Object.keys(packEnRaw).length
      ? packEnRaw
      : packDefault;

  for (const lang of Array.from(UI_LANGS)) {
    const pack = lang === DEFAULT_UI_LANG ? packDefault : packEn;
    Object.assign(loaded[lang], pack);
  }
}

export function validateUiMessages(messages) {
  const base = messages[DEFAULT_UI_LANG] || {};
  const baseKeys = Object.keys(base);
  for (const lang of UI_LANGS) {
    if (lang === DEFAULT_UI_LANG) continue;
    const dict = messages[lang] || {};
    const missing = baseKeys.filter(key => !(key in dict));
    if (missing.length) {
      console.warn(`[i18n] Missing keys in "${lang}":`, missing);
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
      console.warn('[i18n] Failed loading default UI dictionary, using inline fallback:', err);
      loaded[DEFAULT_UI_LANG] = fallback[DEFAULT_UI_LANG] || {};
    }
    await Promise.all(Array.from(UI_LANGS).filter(lang => lang !== DEFAULT_UI_LANG).map(async lang => {
      try {
        loaded[lang] = await fetchUiDictionary(lang);
      } catch (err) {
        console.warn(`[i18n] Failed loading "${lang}" dictionary, using fallback:`, err);
        loaded[lang] = fallback[lang] || {};
      }
    }));
    try {
      await mergePromptPacksIntoLoaded(loaded);
    } catch (err) {
      console.warn('[i18n] Failed merging prompt packs:', err);
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
  const source = UI_MESSAGES[lang] || UI_MESSAGES[DEFAULT_UI_LANG];
  const fallback = UI_MESSAGES[DEFAULT_UI_LANG];
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
