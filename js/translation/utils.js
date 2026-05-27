// js/translation/utils.js — pomocné funkce pro překlad
// Importováno přímo v batch.js, detail.js, list.js, header.js
import { state } from '../state.js';
import { getLangCharSetOrAny, getLangDiacriticRe } from '../languageChars.js';
import core from '../../strong_translator_core_new.js';

const { parseTranslations: parseTranslationsCore } = core;

// Lokální kopie pro getTranslationStateForKey (vyhýbá se circular dep s batch.js)
const _FALLBACK_TOPIC_ORDER = ['definice', 'vyznam', 'kjv', 'puvod', 'specialista'];

// Cache pro targetLang a langChars — localStorage.getItem je drahé při 19k+ iteracích
let _cachedTargetLang = null;
let _cachedLangChars = null;

function _getCachedTargetLang() {
  if (!_cachedTargetLang) {
    _cachedTargetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    _cachedLangChars = getLangCharSetOrAny(_cachedTargetLang);
  }
  return _cachedTargetLang;
}

function _getCachedLangChars() {
  _getCachedTargetLang();
  return _cachedLangChars;
}

export function invalidateTargetLangCache() {
  _cachedTargetLang = null;
  _cachedLangChars = null;
  invalidateTranslationStateCache();
}

// --- Podmínky kvality definice ---
const DEF_QUALITY_CONDITIONS_KEY = 'strong_def_quality_cond_v1';
export const DEF_QUALITY_CONDITION_DEFAULTS = {
  empty: true,
  english: true,
  diacritics: true,
  short_no_structure: true,
  length_vs_source: true,
  refs: true,
};

let _defQualityCond = null;

export function getDefQualityConditions() {
  if (!_defQualityCond) {
    try {
      const s = localStorage.getItem(DEF_QUALITY_CONDITIONS_KEY);
      _defQualityCond = s
        ? { ...DEF_QUALITY_CONDITION_DEFAULTS, ...JSON.parse(s) }
        : { ...DEF_QUALITY_CONDITION_DEFAULTS };
    } catch {
      _defQualityCond = { ...DEF_QUALITY_CONDITION_DEFAULTS };
    }
  }
  return _defQualityCond;
}

export function setDefQualityCondition(condKey, value) {
  const c = getDefQualityConditions();
  c[condKey] = !!value;
  _defQualityCond = { ...c };
  try { localStorage.setItem(DEF_QUALITY_CONDITIONS_KEY, JSON.stringify(c)); } catch {}
  invalidateTranslationStateCache();
}

// Cache stavů překladu — přepočítává se jen při změně state.translated
let _stateCache = null;

export function invalidateTranslationStateCache() {
  _stateCache = null;
}

export function precomputeTranslationStates() {
  _stateCache = new Map();
  for (const key of Object.keys(state.translated)) {
    _stateCache.set(key, _computeTranslationState(key));
  }
}

function isTopicManuallyApproved(key, topicId) {
  return state.topicRepairManuallyApproved?.has(`${key}:${topicId}`) || false;
}

function _countFailedTopics(translationEntry, key) {
  const e = translationEntry || {};
  const srcEntry = key ? (state.entryMap?.get(key) || {}) : {};
  const srcDefRaw = String(srcEntry.definice || srcEntry.def || '');
  let count = 0;
  for (const topicId of _FALLBACK_TOPIC_ORDER) {
    if (isTopicManuallyApproved(key, topicId)) continue;
    const val = String(e[topicId] || '').trim();
    if (!hasMeaningfulValue(val)) { count++; continue; }
    if (topicId === 'definice' && isDefinitionLowQuality(val, srcDefRaw)) count++;
  }
  return count;
}

export function hasMeaningfulValue(v) {
  const s = String(v || '').trim();
  return !!s && s !== '—' && s !== '(přeskočeno)';
}

/** Anglická část za „Originál:“ nesmí označit celou definici jako EN (běžné u CZ+AS dvojice). */
export function stripDefinitionOriginReferenceTail(text) {
  const s = String(text || '');
  const m = s.match(/\bOriginál\s*:/iu);
  if (!m || m.index === undefined || m.index <= 0) return s.trim();
  return s.slice(0, m.index).trim();
}

// Anglická slova a jejich české ekvivalenty pro automatickou korekci
const EN_CZ_REPLACEMENTS = [
  // Dlouhé fráze nejdříve
  ['to do', 'činit'],
  ['goodness', 'dobrotu'],
  ['metaphorically', 'metaforicky'],
  ['see word', 'viz slovo'],
  //Jednotlivá slova
  ['without', 'bez'],
  ['with', 's'],
  ['not', 'ne'],
  ['good', 'dobrý'],
  ['joy', 'radost'],
  ['from', 'z'],
  ['metaphor', 'metafora'],
  ['weight', 'váha'],
  ['which', 'který'],
  ['see', 'viz'],
  ['the', ''],
  ['a', ''],
  ['an', ''],
  ['and', 'a'],
  ['or', 'nebo'],
  ['that', 'že'],
  ['those', 'ti'],
  ['these', 'tyto'],
  ['also', 'také'],
  ['figuratively', 'obrazně'],
  ['especially', 'zejména'],
  ['is', 'je'],
  ['are', 'jsou'],
  ['was', 'byl'],
  ['were', 'byli'],
  ['be', 'být'],
  ['been', 'byl'],
  ['being', 'být'],
  ['have', 'mít'],
  ['has', 'má'],
  ['had', 'měl'],
  ['do', 'dělat'],
  ['does', 'dělá'],
  ['did', 'činil'],
  ['will', 'bude'],
  ['would', 'by'],
  ['shall', 'bude'],
  ['should', 'měl by'],
  ['may', 'může'],
  ['might', 'mohl'],
  ['must', 'musí'],
  ['can', 'může'],
  ['could', 'mohl'],
  ['it', 'to'],
  ['its', 'jeho'],
  ['he', 'on'],
  ['him', 'jeho'],
  ['his', 'jeho'],
  ['she', 'ona'],
  ['her', 'její'],
  ['they', 'oni'],
  ['them', 'je'],
  ['their', 'jejich'],
  ['so', 'tak'],
  ['but', 'ale'],
  ['if', 'pokud'],
  ['then', 'pak'],
  ['because', 'protože'],
  ['therefore', 'proto'],
  ['thus', 'tudíž'],
  ['hence', 'odtud'],
  ['indeed', 'skutečně'],
  ['as', 'jako'],
  ['of', 'z'],
  ['in', 'v'],
  ['on', 'na'],
  ['at', 'u'],
  ['by', 'podle']
];

/**
 * Automaticky opraví častá anglická slova v češtině
 * Používá se při otevření editoru pro úpravu definice
 */
export function autoCorrectEnglishWords(text) {
  if (!text) return text;
  let result = String(text);
  
  // Aplikujeme nahrazení – delší fráze mají přednost (jsou seřazeny)
  for (const [en, cz] of EN_CZ_REPLACEMENTS) {
    if (!cz) continue; // prázdná nahrada = odstranění
    const pattern = new RegExp(`\\b${escapeRegExp(en)}\\b`, 'gi');
    result = result.replace(pattern, cz);
  }
  
  // Odstranění zůstatku více mezer a prázdných míst
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasTargetLangWord(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return _getCachedLangChars().test(s);
}

export function hasCzechWord(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return _getCachedLangChars().test(s);
 }


// Heuristiky pro detekci anglického textu (Strong's slovník typicky).
// Práh je vysoký, aby se minimalizovaly false-positivy: stačí jeden match.
const EN_TEXT_MARKERS = [
  // Dvě běžná EN funkční slova blízko sebe (silný indikátor anglické věty)
  /\b(?:the|and|of|to|in|on|at|by|with|for|from)\b[^,;.]{1,40}\b(?:the|and|of|to|in|on|at|by|with|for|from)\b/i,
  // Strong's typická anglická adverbia/přídavky
  /\b(?:primarily|figuratively|metaphorically|literally|properly|specifically|generally)\b/i,
  // Strong's typické konstrukce odkazu
  /\b(?:see\s+(?:word|also|compare|under)|akin\s+to|derived\s+from|compare\s+(?:with|to))\b/i,
  // Strong's "from a primitive root" pattern
  /\bfrom\s+(?:a\s+(?:primary|primitive|prolonged|prim)|an?\s+\w+\s+(?:word|form))\b/i,
];

export function isDefinitionLikelyEnglish(text) {
  const s = stripDefinitionOriginReferenceTail(String(text || '').trim());
  if (!s) return false;

  if (hasCzechWord(s)) return false;

  return EN_TEXT_MARKERS.some(re => re.test(s));
}

function _stripKjvFromSource(text) {
  return String(text || '').replace(/\s*\|\s*KJV:[^|]*/gi, '').trim();
}

export function getDefinitionQualityIssues(czText, srcTextRaw) {
  const cond = getDefQualityConditions();
  const s = String(czText || '').trim();
  const src = _stripKjvFromSource(srcTextRaw);

  // Vždy: prázdná hodnota
  if (!hasMeaningfulValue(s)) return ['empty'];
  // Vždy: UI artefakty
  if (/(🤖|✎|prompt|upravit|edit|button|klik)/i.test(s)) return ['artifact'];

  const issues = [];

  // Toggleable: vypadá jako anglický text
  if (cond.english && isDefinitionLikelyEnglish(s)) issues.push('english');

  // Toggleable: diakritika (jazykově-aware)
  if (cond.diacritics) {
    const diacriticRe = getLangDiacriticRe(_getCachedTargetLang());
    if (diacriticRe) {
      const words = s.split(/\s+/).filter(Boolean);
      if (words.length >= 8) {
        const withDiacr = words.filter(w => diacriticRe.test(w)).length;
        if (withDiacr / words.length < 0.05) issues.push('diacritics');
      }
    }
  }

  // Toggleable: krátká bez struktury
  if (cond.short_no_structure) {
    const words = s.split(/\s+/).filter(Boolean);
    const hasStructure = /[,:;()]/.test(s);
    const hasTargetLangChars = _getCachedLangChars().test(s);
    if (!(words.length <= 2 && hasTargetLangChars)) {
      if (words.length < 4) issues.push('short');
      else if (s.length < 30 && !hasStructure) issues.push('short');
      else if (words.length < 6 && s.length < 45 && !hasStructure && !hasTargetLangChars) issues.push('short');
    }
  }

  // Toggleable: příliš krátká oproti zdroji
  if (cond.length_vs_source && src.length > 200 && s.length < src.length * 0.35) {
    issues.push('length');
  }

  // Toggleable: chybí biblické reference
  if (cond.refs) {
    const srcRefs = (src.match(/\d+[,:]\d+/g) || []).length;
    const czRefs  = (s.match(/\d+[,:]\d+/g) || []).length;
    if (srcRefs > 0 && czRefs < srcRefs) issues.push('refs');
  }

  return issues;
}

export function isDefinitionLowQuality(czText, srcTextRaw) {
  return getDefinitionQualityIssues(czText, srcTextRaw).length > 0;
}

export function isTranslationComplete(t, key) {
  if (!t || t.skipped) return false;
  const required = ['definice', 'vyznam', 'puvod', 'kjv', 'specialista'];
  const e = key ? (state.entryMap?.get(key) || {}) : {};
  for (const field of required) {
    if (isTopicManuallyApproved(key, field)) continue;
    if (field === 'vyznam' && !hasMeaningfulValue(String(e.vyznamCz || e.cz || ''))) continue;
    const val = String(t[field] || '').trim();
    if (!hasMeaningfulValue(val)) return false;
    if (field === 'definice') {
      const srcDefRaw = String(e.definice || e.def || '');
      if (isDefinitionLowQuality(val, srcDefRaw)) return false;
    }
  }
  return true;
}

export function hasAnyTranslationContent(t) {
  if (!t || t.skipped) return false;
  const fields = ['vyznam', 'definice', 'puvod', 'kjv', 'specialista'];
  return fields.some(field => hasMeaningfulValue(t[field]));
}

function _computeTranslationState(key) {
  const t = state.translated[key];
  if (!t || t.skipped) return 'pending';
  if (isTranslationComplete(t, key)) return 'done';
  if (!hasAnyTranslationContent(t)) return 'failed';
  const failedCount = _countFailedTopics(t, key);
  if (failedCount > 0 && failedCount <= 2) return 'missing_topic';
  return 'failed_partial';
}

export function getTranslationStateForKey(key) {
  if (_stateCache) {
    const cached = _stateCache.get(key);
    if (cached !== undefined) return cached;
  }
  return _computeTranslationState(key);
}

export function fillMissingVyznamFromSource(keys) {
  if (!Array.isArray(keys)) return;
  for (const key of keys) {
    const t = state.translated[key];
    if (!t || hasMeaningfulValue(t.vyznam)) continue;
    const e = state.entryMap.get(key);
    const fallback = String(e?.vyznamCz || e?.cz || '').trim();
    if (fallback) {
      t.vyznam = fallback;
    }
  }
}

export function fillMissingKjvFromSource(keys) {
  if (!Array.isArray(keys)) return;
  for (const key of keys) {
    const t = state.translated[key];
    if (!t || hasMeaningfulValue(t.kjv)) continue;
    const e = state.entryMap.get(key);
    const fallback = String(e?.kjv || '').trim();
    if (fallback) {
      t.kjv = `${fallback} [POZN.: v angličtině ze vstupu]`;
    }
  }
}

export function annotateEnglishDefinitionsInTranslated(keys) {
  if (!Array.isArray(keys)) return;
  for (const key of keys) {
    const t = state.translated[key];
    if (!t) continue;
    if (!isDefinitionLikelyEnglish(t.definice)) continue;
    const original = String(t.definice || '').trim();
    if (!original) continue;
    if (/\[POZN\.: text je v angličtině - špatný překlad\]/.test(original)) continue;
    t.definice = `${original} [POZN.: text je v angličtině - špatný překlad]`;
  }
}

export function applyFallbacksToParsedMap(keys, parsedMap) {
  if (!Array.isArray(keys) || !parsedMap || typeof parsedMap !== 'object') return;
  for (const key of keys) {
    const t = parsedMap[key];
    if (!t) continue;
    const e = state.entryMap.get(key);
    if (!hasMeaningfulValue(t.vyznam)) {
      const vyznamFallback = String(e?.vyznamCz || e?.cz || '').trim();
      if (vyznamFallback) t.vyznam = vyznamFallback;
    }
    if (!hasMeaningfulValue(t.kjv)) {
      const kjvFallback = String(e?.kjv || '').trim();
      if (kjvFallback) t.kjv = `${kjvFallback} [POZN.: v angličtině ze vstupu]`;
    }
    if (isDefinitionLikelyEnglish(t.definice)) {
      t.definice = `${String(t.definice || '').trim()} [POZN.: text je v angličtině - špatný překlad]`.trim();
    }
  }
}

export function tryNormalizeNumberedOpenRouterResponse(raw, keys) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (/###\s*[GH]?\d+\s*###/i.test(text)) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const headerLine = lines.find(l => /^(?:\d+\.)?\s*(?:[GH]?\d+)\b/i.test(l));
  if (!headerLine) return null;
  const keyMatch = headerLine.match(/([GH]?\d+)/);
  if (!keyMatch) return null;
  const foundKey = keyMatch[1].toUpperCase();
  if (Array.isArray(keys) && keys.length && !keys.includes(foundKey)) return null;

  const defLine = lines.find(l => /^DEF\s*:/i.test(l) || /^\d+\.\s*.*\|.*$/i.test(l) || /^\d+\.\s*[^\n]+$/i.test(l));
  const specialistaTail = lines.slice(Math.max(0, lines.length - 6)).join(' ');
  const normalized = [
    `###${foundKey}###`,
    `VYZNAM:`,
    `DEFINICE: ${defLine ? defLine.replace(/^\d+\.\s*/, '').replace(/^DEF\s*:/i, '').trim() : text.slice(0, 600)}`,
    `PUVOD:`,
    `KJV:`,
    `SPECIALISTA: ${specialistaTail || ''}`
  ].join('\n');
  return normalized;
}

export function parseWithOpenRouterNormalization(raw, keys, targetObj) {
  const missingOriginal = parseTranslationsCore(raw, keys, targetObj);
  if (!Array.isArray(missingOriginal) || missingOriginal.length === 0) {
    return { missing: missingOriginal || [], normalizedUsed: false, normalizedText: '' };
  }
  const normalized = tryNormalizeNumberedOpenRouterResponse(raw, keys);
  if (!normalized) {
    return { missing: missingOriginal, normalizedUsed: false, normalizedText: '' };
  }
  const missingAfterNorm = parseTranslationsCore(normalized, keys, targetObj);
  return {
    missing: Array.isArray(missingAfterNorm) ? missingAfterNorm : missingOriginal,
    normalizedUsed: (missingAfterNorm || []).length < missingOriginal.length,
    normalizedText: normalized
  };
}

export function getStrongKeyNumber(key) {
  const normalized = String(key || '').trim();
  const match = normalized.match(/^(?:[GH])?(\d+)$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function isTopicValueProblematic(key, topicId, value, translatedEntry) {
  // Ignoruj, pokud bylo téma manuálně schváleno (uživatel označil jako v pořádku)
  if (state.topicRepairManuallyApproved?.has(`${key}:${topicId}`)) return null;

  // 1. Chybí hodnotu úplně
  if (!hasMeaningfulValue(value)) return 'missing';

  // 2. Pro definici - kontrola kvality/přímého angličtiny
  if (topicId === 'definice') {
    if (isDefinitionLowQuality(value)) return 'quality';
    if (isDefinitionLikelyEnglish(value)) return 'quality';
  }

  // 3. Pro KJV - pokud je velmi krátké (1-2 slova) a neobsahuje znaky cílového jazyka → pravděpodobně chybí/špatný
  if (topicId === 'kjv') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const langChars = _getCachedLangChars();
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 4. Pro původ - pokud je příliš krátký (bez diakritiky/slov) → podezřelé
  if (topicId === 'puvod') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const langChars = _getCachedLangChars();
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 5. Pro význam - pokud je 1-2 slova bez diakritiky
  if (topicId === 'vyznam') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const langChars = _getCachedLangChars();
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 6. Specialista - pokud je velmi krátký (< 20 znaků) → neodborný
  if (topicId === 'specialista') {
    const s = String(value).trim();
    if (s.length < 20) return 'quality';
  }

  return null;
}

export function getFailedTopicsForFallback(translationEntry, key) {
  const t = translationEntry || {};
  const srcEntry = key ? (state.entryMap?.get(key) || {}) : {};
  const srcDefRaw = String(srcEntry.definice || srcEntry.def || '');
  const failed = [];
  for (const topicId of _FALLBACK_TOPIC_ORDER) {
    if (key && isTopicManuallyApproved(key, topicId)) continue;
    const val = String(t[topicId] || '').trim();
    if (!hasMeaningfulValue(val)) {
      failed.push(topicId);
      continue;
    }
    if (topicId === 'definice' && isDefinitionLowQuality(val, srcDefRaw)) {
      failed.push(topicId);
    }
  }
  return failed;
}

export function getMissingTopicsForRepair(translationEntry) {
   const allMissing = getFailedTopicsForFallback(translationEntry);
   return allMissing.slice(0, 2);
}

// Funkce přesunuté z batch.js pro deduplikaci
export const FALLBACK_TOPIC_ORDER = ['definice', 'vyznam', 'kjv', 'puvod', 'specialista'];

export function cloneTranslationTopicFields(entry) {
   const src = entry || {};
   return {
     vyznam: String(src.vyznam || ''),
     definice: String(src.definice || ''),
     kjv: String(src.kjv || ''),
     puvod: String(src.puvod || ''),
     specialista: String(src.specialista || '')
   };
}

export function isBetterGenericTopicValue(prev, next) {
   const prevText = String(prev || '').trim();
   const nextText = String(next || '').trim();
   if (!hasMeaningfulValue(nextText)) return false;
   if (!hasMeaningfulValue(prevText)) return true;
   if (nextText.length >= prevText.length + 40) return true;
   return false;
}

export function shouldReplaceTopicValue(topicId, previousValue, candidateValue) {
   const prev = String(previousValue || '').trim();
   const next = String(candidateValue || '').trim();
   if (!hasMeaningfulValue(next)) return false;
   if (!hasMeaningfulValue(prev)) return true;
   if (topicId === 'specialista') return shouldReplaceSpecialista(prev, next);
   if (topicId === 'definice') {
     if (isDefinitionLowQuality(next)) return false;
     if (isDefinitionLowQuality(prev) && !isDefinitionLowQuality(next)) return true;
     return isBetterGenericTopicValue(prev, next);
   }
   return isBetterGenericTopicValue(prev, next);
}

export function preserveBetterTopicsAfterBatch(keys, previousMap) {
   const topics = ['vyznam', 'definice', 'kjv', 'puvod', 'specialista'];
   for (const key of (Array.isArray(keys) ? keys : [])) {
     const current = state.translated[key];
     if (!current) continue;
     const previous = previousMap?.[key] || {};
     for (const topicId of topics) {
       const prevVal = String(previous[topicId] || '').trim();
       const curVal = String(current[topicId] || '').trim();
       const acceptCurrent = shouldReplaceTopicValue(topicId, prevVal, curVal);
       if (!acceptCurrent && hasMeaningfulValue(prevVal)) {
         current[topicId] = prevVal;
       }
     }
   }
}
