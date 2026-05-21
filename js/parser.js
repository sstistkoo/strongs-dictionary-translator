// js/parser.js — parsování importovaných souborů (TXT, JSON)

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

export function parseCzTXT(text) {
  const result = {};
  const normalizedText = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const blocks = normalizedText.split(/\n(?=[GH]\d+\s*\|)/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const header = lines[0];
    const m = header.match(/^([GH]\d+)\s*\|/);
    if (!m) continue;
    const key = m[1];
    const vyznam = getValueByLabels(lines, TXT_LABEL_ALIASES.vyznam);
    const definice = getValueByLabels(lines, TXT_LABEL_ALIASES.definice);
    const puvod = getValueByLabels(lines, TXT_LABEL_ALIASES.puvod);
    const specialista = getValueByLabels(lines, TXT_LABEL_ALIASES.specialista);
    const kjv = getValueByLabels(lines, TXT_LABEL_ALIASES.kjv);
    if (vyznam || definice) {
      result[key] = { vyznam, definice, puvod, specialista, kjv };
    }
  }
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
