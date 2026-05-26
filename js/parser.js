// js/parser.js — parsování importovaných souborů (TXT, JSON)
import { parseTXT as parseTXTCore } from '../strong_translator_core_new.js';

const IMPORT_FIELDS = ['vyznam', 'definice', 'puvod', 'specialista', 'kjv'];

/**
 * Centralizované aliasy pro import TXT.
 * Zahrnuje legacy CZ labely i obecné varianty bez jazykové koncovky.
 */
const TXT_LABEL_ALIASES = {
  vyznam: ['Český význam', 'Vyznam', 'VÝZNAM', 'VYZNAM', 'Význam', 'Cz', 'CZ', 'Meaning'],
  definice: ['Definice (CZ)', 'Česká definice', 'Definice', 'DEFINICE', 'CZ definice', 'Definition'],
  puvod: ['Původ', 'Puvod', 'PUVOD', 'Origin'],
  specialista: ['Specialista', 'VÝKLAD', 'VYKLAD', 'Komentář', 'KOMENTAR', 'Exegeze', 'EXEGEZE', 'Specialist'],
  kjv: ['KJV překlady (CZ)', 'KJV překlady', 'KJV', 'KJV_PREKLADY', 'KJV Významy', 'KJV translations']
};

/**
 * Vrátí hodnotu z řádků "Label: text" podle zadaných aliasů.
 * Podporuje víceřádkové hodnoty (pokud následují pod labelem bez přerušení novým labelem).
 * Odstraňuje bílé znaky na začátku/konci.
 */
function getValueByLabels(lines, labels) {
   const ALL_LABELS = Object.values(TXT_LABEL_ALIASES).flat();
   for (const label of labels) {
     let started = false;
     let collected = [];
     for (const line of lines) {
       if (!started) {
         if (line.includes(`${label}:`)) {
           started = true;
           let idx = line.indexOf(`${label}:`);
           let after = line.slice(idx + `${label}:`.length);
           // Zkontroluj, jestli za labelem následuje další label
           for (const otherLabel of ALL_LABELS) {
             const otherIdx = after.indexOf(`${otherLabel}:`);
             if (otherIdx > 0) {
               after = after.slice(0, otherIdx);
               break;
             }
           }
           after = after.trim();
           if (after) collected.push(after);
         }
       } else {
         const foundLabel = ALL_LABELS.find(l => line.includes(`${l}:`));
         if (foundLabel) break;
         const trimmed = line.trim();
         if (/^\w+:\s*$/.test(trimmed)) break;
         if (trimmed) collected.push(trimmed);
       }
     }
     if (collected.length) return collected.join(' ').trim();
   }
   return '';
 }

/**
 * Parser pro import p\u0159elo\u017Een\u00FDch TXT soubor\u016F.
 *
 * Deleguje na `parseTXT` z core modulu \u2014 sd\u00EDl\u00EDme jednu robustn\u00ED implementaci,
 * kter\u00E1 zvl\u00E1d\u00E1:
 *   - libovoln\u00FD jazykov\u00FD suffix labelu `V\u00FDznam (SK):`, `Definicja (PL):`,
 *     `Bedeutung (DE):`, `KJV p\u0159eklady (XX):`, atd.
 *   - bezsuffixov\u00E9 labely (`V\u00FDznam:`, `Definice:`) \u2014 pokud parser jednou
 *     v souboru detekuje target-lang suffix, zbyl\u00E9 bezsufixov\u00E9 p\u0159ekladov\u00E9
 *     labely interpretuje jako p\u0159eklad (sticky lang detection).
 *
 * Vrac\u00ED: `{ [strongKey]: { vyznam, definice, puvod, specialista, kjv } }`
 * Metadata o detekovan\u00E9m c\u00EDlov\u00E9m jazyku jsou p\u0159ipojena jako non-enumerable
 * `result._meta = { detectedTargetLang }`, tak\u017Ee UI m\u016F\u017Ee auto-p\u0159epnout
 * `strong_target_lang` po importu.
 */
export function parseCzTXT(text) {
  const entries = parseTXTCore(text);
  const meta = (entries && entries.meta) || {};
  const translated = meta.translated || {};
  const result = {};
  for (const [key, payload] of Object.entries(translated)) {
    if (!payload) continue;
    const vyznam = payload.vyznam || '';
    const definice = payload.definice || '';
    const puvod = payload.puvod || '';
    const specialista = payload.specialista || '';
    const kjv = payload.kjv || '';
    // P\u0159ijmi heslo, pokud m\u00E1 aspo\u0148 jedno smyslupln\u00E9 pole (ne jen poml\u010Dku "\u2014")
    const hasAny = [vyznam, definice, puvod, specialista, kjv]
      .some(v => v && v.trim() && v.trim() !== '\u2014');
    if (hasAny) {
      result[key] = { vyznam, definice, puvod, specialista, kjv };
    }
  }
  // P\u0159ipoj meta pro callery (auto-switch target lang)
  try {
    Object.defineProperty(result, '_meta', {
      value: { detectedTargetLang: meta.detectedTargetLang || null },
      enumerable: false,
      writable: false,
      configurable: false
    });
  } catch { /* result je prost\u00FD objekt, defineProperty by nem\u011Bl selhat */ }
  return result;
}

export function parseImportJSON(text) {
  const parsed = JSON.parse(text);
  const result = {};

  const normalizeRecord = (record) => {
    if (!record || typeof record !== 'object') return null;
    const out = {};
    for (const field of IMPORT_FIELDS) {
      const val = record[field];
      out[field] = typeof val === 'string' ? val.trim() : '';
    }
    return out;
  };

  const addRecord = (key, value) => {
    if (!/^G\d+$/.test(key) && !/^H\d+$/.test(key)) return;
    const normalized = normalizeRecord(value);
    if (!normalized) return;
    if (!IMPORT_FIELDS.some(f => normalized[f])) return;
    result[key] = normalized;
  };

  if (Array.isArray(parsed)) {
    for (const row of parsed) {
      const key = row?.key || row?.strong || row?.id;
      if (typeof key !== 'string') continue;
      addRecord(key.trim(), row);
    }
    return result;
  }

  if (parsed && typeof parsed === 'object') {
    // Variant A: přímý map exportu { "G1": {...}, "G2": {...} }
    for (const [key, value] of Object.entries(parsed)) {
      addRecord(String(key).trim(), value);
    }

    // Variant B: obálka s polem state.entries/translations
    const wrapped = parsed.entries || parsed.translations || parsed.data;
    if (Array.isArray(wrapped)) {
      for (const row of wrapped) {
        const key = row?.key || row?.strong || row?.id;
        if (typeof key !== 'string') continue;
        addRecord(key.trim(), row);
      }
    }
  }

  return result;
}
