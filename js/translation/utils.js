// js/translation/utils.js — pomocné funkce pro překlad
// Importováno přímo v batch.js, detail.js, list.js, header.js
import { state } from '../state.js';
import core from '../../strong_translator_core_new.js';

const { parseTranslations: parseTranslationsCore } = core;

// Lokální kopie pro getTranslationStateForKey (vyhýbá se circular dep s batch.js)
const _FALLBACK_TOPIC_ORDER = ['definice', 'vyznam', 'kjv', 'puvod', 'specialista'];

function isTopicManuallyApproved(key, topicId) {
  return state.topicRepairManuallyApproved?.has(`${key}:${topicId}`) || false;
}

function _countFailedTopics(translationEntry, key) {
  const e = translationEntry || {};
  let count = 0;
  for (const topicId of _FALLBACK_TOPIC_ORDER) {
    if (isTopicManuallyApproved(key, topicId)) continue;
    const val = String(e[topicId] || '').trim();
    if (!hasMeaningfulValue(val)) { count++; continue; }
    if (topicId === 'definice' && isDefinitionLowQuality(val)) count++;
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

const TARGET_LANG_CHAR_SETS = {
  cz: /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,
  cs: /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,
  sk: /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/,
  ru: /[\u0400-\u04FF\u0500-\u052F]/,
  bg: /[\u0400-\u04FF\u0500-\u052F]/,
  ch: /[äöüàéèìùáéíóúý]/,
  sp: /[áéíóúüñ¿¡]/,
  pl: /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/
};

export function hasTargetLangWord(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  const charSet = TARGET_LANG_CHAR_SETS[targetLang] || TARGET_LANG_CHAR_SETS.cz;
  return charSet.test(s);
}

export function hasCzechWord(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  if (targetLang === 'ru' || targetLang === 'bg') {
    const cyrillic = /[\u0400-\u04FF\u0500-\u052F]/;
    if (cyrillic.test(s)) return true;
    return false;
  }
  const czechDiacritics = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;
  const words = s.split(/\s+/);
  return words.some(word => czechDiacritics.test(word));
 }

export function isDefinitionLikelyEnglish(text) {
  const s = stripDefinitionOriginReferenceTail(String(text || '').trim());
  if (!s) return false;

  if (hasCzechWord(s)) return false;

  const markers = [
    // ... původní a rozšířené
  ];
  return markers.some(re => re.test(s));
}

export function isDefinitionLowQuality(text) {
  const s = String(text || '').trim();
  if (!s) return true;
  if (isDefinitionLikelyEnglish(s)) return true;
  // UI artefakty nebo technický šum místo definice.
  if (/(🤖|✎|prompt|upravit|edit|button|klik)/i.test(s)) return true;
  // Definice má být věcná; krátké, ale smysluplné formulace nechceme trestat.
  const words = s.split(/\s+/).filter(Boolean);
  const hasStructure = /[,:;()]/.test(s);
  const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  const langChars = TARGET_LANG_CHAR_SETS[targetLang] || TARGET_LANG_CHAR_SETS.cz;
  const hasTargetLangChars = langChars.test(s);
  // Povolit 1–2 slova, pokud obsahují znaky cílového jazyka
  if (words.length <= 2 && hasTargetLangChars) return false;
  if (words.length < 4) return true;
  if (s.length < 30 && !hasStructure) return true;
  if (words.length < 6 && s.length < 45 && !hasStructure && !hasTargetLangChars) return true;
  return false;
}

export function isTranslationComplete(t, key) {
  if (!t || t.skipped) return false;
  const required = ['definice', 'puvod', 'kjv', 'specialista'];
  for (const field of required) {
    if (isTopicManuallyApproved(key, field)) continue;
    const val = String(t[field] || '').trim();
    if (!hasMeaningfulValue(val)) return false;
    if (field === 'definice' && isDefinitionLowQuality(val)) return false;
  }
  return true;
}

export function hasAnyTranslationContent(t) {
  if (!t || t.skipped) return false;
  const fields = ['vyznam', 'definice', 'puvod', 'kjv', 'specialista'];
  return fields.some(field => hasMeaningfulValue(t[field]));
}

export function getTranslationStateForKey(key) {
  const t = state.translated[key];
  if (!t || t.skipped) return 'pending';
  if (isTranslationComplete(t, key)) return 'done';
  if (!hasAnyTranslationContent(t)) return 'failed';
  const failedCount = _countFailedTopics(t, key);
  if (failedCount > 0 && failedCount <= 2) return 'missing_topic';
  return 'failed_partial';
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
    const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    const langChars = TARGET_LANG_CHAR_SETS[targetLang] || TARGET_LANG_CHAR_SETS.cz;
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 4. Pro původ - pokud je příliš krátký (bez diakritiky/slov) → podezřelé
  if (topicId === 'puvod') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    const langChars = TARGET_LANG_CHAR_SETS[targetLang] || TARGET_LANG_CHAR_SETS.cz;
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 5. Pro význam - pokud je 1-2 slova bez diakritiky
  if (topicId === 'vyznam') {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    const langChars = TARGET_LANG_CHAR_SETS[targetLang] || TARGET_LANG_CHAR_SETS.cz;
    if (words.length <= 2 && !langChars.test(value)) return 'quality';
  }

  // 6. Specialista - pokud je velmi krátký (< 20 znaků) → neodborný
  if (topicId === 'specialista') {
    const s = String(value).trim();
    if (s.length < 20) return 'quality';
  }

  return null;
}

export function getFailedTopicsForFallback(translationEntry) {
  const t = translationEntry || {};
  const failed = [];
  for (const topicId of _FALLBACK_TOPIC_ORDER) {
    const val = String(t[topicId] || '').trim();
    if (!hasMeaningfulValue(val)) {
      failed.push(topicId);
      continue;
    }
    if (topicId === 'definice' && isDefinitionLowQuality(val)) {
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
