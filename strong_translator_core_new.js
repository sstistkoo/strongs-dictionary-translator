/**
 * Strong Greek to Czech Translator - Core Module
 */
import { getResolvedSystemMessage, getResolvedDefaultPrompt } from './js/aiPromptsResolve.js';

export function parseTXT(text) {
  const lines = text.split('\n');
  const entries = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const lineTrim = lines[i].trim();
    
    if (!lineTrim) {
      if (current && current.key) {
        entries.push(finishEntry(current));
        current = null;
      }
      continue;
    }
    
    const newMatch = lineTrim.match(/^([GH]\d+)\s*\|\s*(.+)$/);
    if (newMatch) {
      if (current && current.key) {
        entries.push(finishEntry(current));
      }
      const type = newMatch[1].startsWith('H') && parseInt(newMatch[1].slice(1)) >= 9000 ? 'grammar' 
                 : newMatch[1].startsWith('H') ? 'hebrew' : 'greek';
      current = { key: newMatch[1], greek: newMatch[2].trim(), type };
      continue;
    }
    
    if (!current) continue;
    
    const colonIdx = lineTrim.indexOf(':');
    if (colonIdx === -1) continue;
    
    const fieldName = lineTrim.slice(0, colonIdx).trim();
    const fieldValue = lineTrim.slice(colonIdx + 1).trim();
    
    // Greek fields
    if (fieldName === 'BETA') current.beta = fieldValue;
    else if (fieldName === 'Prepis') current.prepis = fieldValue;
    else if (fieldName === 'Tvaroslovi') current.tvaroslovi = fieldValue;
    else if (fieldName === 'Definice') current.definice = fieldValue;
    else if (fieldName === 'En') current.en = fieldValue;
    else if (fieldName === 'En Definition') current.enDef = fieldValue;
    else if (fieldName === 'KJV Významy') current.kjv = fieldValue;
    else if (fieldName === 'Cz') { current.cz = fieldValue; current.czDef = fieldValue; }
    // Hebrew fields
    else if (fieldName === 'Vokalizace') current.vokalizace = fieldValue;
    else if (fieldName === 'Vyslovnost') current.vyslovnost = fieldValue;
    else if (fieldName === 'Etymol') current.etymol = fieldValue;
    else if (fieldName === 'TWOT') current.twot = fieldValue;
    else if (fieldName === 'Poznamky') current.poznamky = fieldValue;
    else if (fieldName === 'Překlad') current.preklad = fieldValue;
    else if (fieldName === 'Vysvětlení') current.vysvetleni = fieldValue;
    else if (fieldName === 'Řecké refs') current.greekRefs = fieldValue;
    // Grammar fields
    else if (fieldName === 'Kategorie') current.kategorie = fieldValue;
    else if (fieldName === 'Vyznam_Cz') current.vyznamCz = fieldValue;
  }
  
  if (current && current.key) {
    entries.push(finishEntry(current));
  }
  
  console.log('PARSE: ' + entries.length + ' entries');
  return entries;
}

function extractVyskyt(defText) {
  if (!defText) return '';
  const matches = defText.match(/\[[\w]+\.?\d*:\d+\]/g);
  if (!matches) return '';
  return matches.map(m => m.replace(/[\[\]]/g, '')).join(', ');
}

export function buildPromptMessages(batch) {
  const items = batch.map(e => {
    const def = e.definice || e.def || '';
    const tvar = e.orig || e.tvaroslovi || '';
    const tvarPart = tvar ? ` (${tvar})` : '';
    return `${e.key} | ${e.greek}${tvarPart}\nEN: ${def}`;
  }).join('\n\n');
  const sysMsg = getResolvedSystemMessage();
  const userPrompt = getResolvedDefaultPrompt();
  const userContent = String(userPrompt || '')
    .replace(/{TARGET_LANG}/g, 'češtiny')
    .replace(/{SOURCE_LANG}/g, 'řečtiny/hebrejštiny')
    .replace(/{HESLA}/g, items);

  return [
    { role: 'system', content: sysMsg },
    { role: 'user', content: userContent || items }
  ];
}

export function buildRetryMessages(userContent) {
  const sysMsg = getResolvedSystemMessage();
  return [
    { role: 'system', content: sysMsg },
    { role: 'user', content: userContent }
  ];
}

function finishEntry(e) {
  const base = { key: e.key, greek: e.greek, definice: e.definice || '' };
  const vyskyt = extractVyskyt(e.definice);
  const tvaroslovi = e.tvaroslovi || '';
  
  if (e.type === 'greek') {
    return { ...base, orig: tvaroslovi, en: e.en || '', enDef: e.enDef || '', kjv: e.kjv || '', czDef: e.czDef || '', beta: e.beta || '', prepis: e.prepis || '', tvaroslovi: tvaroslovi, vyskyt: vyskyt };
  } else if (e.type === 'hebrew') {
    return { ...base, orig: tvaroslovi, en: e.en || '', enDef: e.enDef || '', kjv: e.kjv || '', beta: '', prepis: e.prepis || '', tvaroslovi: tvaroslovi, vokalizace: e.vokalizace || '', vyslovnost: e.vyslovnost || '', etymol: e.etymol || '', twot: e.twot || '', poznamky: e.poznamky || '', preklad: e.preklad || '', vysvetleni: e.vysvetleni || '', greekRefs: e.greekRefs || '', vyskyt: vyskyt };
  } else {
    // Grammar
    return { ...base, orig: tvaroslovi, en: e.en || '', enDef: e.enDef || '', kjv: e.kjv || '', beta: '', prepis: e.prepis || '', tvaroslovi: tvaroslovi, vokalizace: e.vokalizace || '', kategorie: e.kategorie || '', vyznamCz: e.vyznamCz || '' };
  }
}

/**
 * Normalizuje a deduplikuje biblické reference.
 * Podporuje: [Job.26:6, 28:22], [Act.10:14; 1Co.7:14], "Gen 1:1", "1Co.7:14"
 * Odvozuje chybějící knihu z předchozí reference.
 * Výstup: čárkami oddělený, seřazený seznam.
 */
function normalizeReferences(input) {
  if (!input) return '';
  const text = String(input);
  const matches = [];

  // Hledá reference ve formátu book.chap:verse nebo book chap:verse
  // Příklad: "Gen.1:1", "Gen 1:1", "1Co.7:14", "28:22" (bez knihy)
  const re = /\b([A-Za-z0-9]+\.?\s*[0-9]+:[0-9]+)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1]);
  }

  if (!matches.length) return '';

  // Normalizace mezery (Gen 1:1 -> Gen.1:1) a odvození chybějící knihy
  const normalized = [];
  let lastBook = null;
  for (let ref of matches) {
    ref = ref.trim().replace(/^["']|["']$/g, '');
    if (!ref) continue;

    // "Gen 1:1" -> "Gen.1:1"
    const spaceMatch = ref.match(/^([A-Za-z0-9]+)\s+([0-9].*)$/);
    if (spaceMatch) {
      ref = spaceMatch[1] + '.' + spaceMatch[2];
    }

    if (ref.includes('.')) {
      lastBook = ref.split('.')[0];
      normalized.push(ref);
    } else if (lastBook) {
      normalized.push(lastBook + '.' + ref);
    } else {
      normalized.push(ref);
    }
  }

  // Deduplikace case-insensitive
  const seen = new Set();
  const unique = [];
  for (const r of normalized) {
    const key = r.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }

  // Seřadit abecedně
  unique.sort();

  return unique.join(', ');
}

export function parseTranslations(raw, keys, translated = {}) {
  const normalized = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Sestavíme sadu čísel která čekáme (G4594 → "4594", H123 → "123")
  const numToKey = {};
  for (const k of keys) {
    numToKey[k.slice(1)] = k;
  }

  // Rozdělíme na bloky — hledáme jakoukoliv sekvenci ### ... číslo ... ###
  // Tolerujeme mezery, závorky, prefix G/H, markdown bold/code okolo
  const blocks = normalized.split(/(?=(?:\*{0,2}`?)#{2,4}\s*[\[\(]?[GgHh]?\s*\d+\s*[\]\)]?\s*#{2,4})/);

  for (const block of blocks) {
    // Vytáhnout číslo z hlavičky — tolerujeme libovolný "obal"
    const km = block.match(/#{2,4}\s*[\[\(]?[GgHh]?\s*(\d+)\s*[\]\)]?\s*#{2,4}/);
    if (!km) continue;
    const num = km[1]; // jen číslo, bez prefixu

    // Porovnat s očekávanými klíči pouze podle čísla
    const targetKey = numToKey[num];
    if (!targetKey) continue; // číslo není v naší dávce — přeskočit
    
    const content = block.slice(km[0].length).trim();
    
    const normalizedLabels = {
      'V': 'VYZNAM',
      'D': 'DEFINICE',
      'P': 'PUVOD',
      'K': 'KJV',
      'S': 'SPECIALISTA',
      'DEF': 'DEFINICE',
      'CZ': 'VYZNAM',
      'VÝZNAM': 'VYZNAM',
      'DEFINICE': 'DEFINICE',
      'DEFINITION': 'DEFINICE',
      'MEANING': 'VYZNAM',
      'ORIGIN': 'PUVOD',
      'ETYMOLOGY': 'PUVOD',
      'ETYMOLOGIES': 'PUVOD',
      'COMMENTARY': 'SPECIALISTA',
      'EXEGESIS': 'SPECIALISTA',
      'KJV': 'KJV',
      'SPECIALISTA': 'SPECIALISTA'
    };
    
    const fieldPositions = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // label followed by colon/space/dash/emdash (single char labels need colon, not \b)
      // Note: allow optional leading whitespace
const labelMatch = line.match(/^\s*(VYZNAM|DEFINICE|PUVOD|POUVOD|POVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|DEFINITION|MEANING|ORIGIN|ETYMOLOGY|ETYMOLOGIES|COMMENTARY|EXEGESIS|USAGE|DEF|V|D|P|K|S)(?:[:–—=.\s]+)/i);
       if (labelMatch) {
         let label = labelMatch[1].toUpperCase();
         if (label === 'VYKLAD' || label === 'KOMENTAR' || label === 'EXEGEZE') label = 'SPECIALISTA';
         if (normalizedLabels[label]) {
           label = normalizedLabels[label];
         }
         // USAGE acts as delimiter marker (ends previous field, value not stored)
         if (label === 'USAGE') label = '__DELIMITER__';
         if (['VYZNAM', 'DEFINICE', 'PUVOD', 'KJV', 'SPECIALISTA', '__DELIMITER__'].includes(label)) {
           fieldPositions.push({ label, startLine: i, labelLen: labelMatch[0].length });
         }
       }
    }
    
    const fields = {};
    for (let i = 0; i < fieldPositions.length; i++) {
      const current = fieldPositions[i];
      const label = current.label;
      const startLine = current.startLine;
      const labelLen = current.labelLen;
      
      let endLine = lines.length;
      if (i < fieldPositions.length - 1) {
        endLine = fieldPositions[i + 1].startLine;
      }
      
      let value = '';
      for (let j = startLine; j < endLine; j++) {
        let lineContent = lines[j];
        if (j === startLine) {
          lineContent = lineContent.slice(labelLen).trim();
        }
        lineContent = lineContent.trim();
        if (lineContent) {
          value += (value ? ' ' : '') + lineContent;
        }
      }
fields[label] = value.trim();
      }
      
      // Úklid: odstranění vnořených labelů na začátku hodnot (např. "S: SPECIALISTA: text" → jen "text")
      // Match jen label následovaný : nebo -- (pro SPECIALISTA: nebo VYKLAD - text)
      const innerLabelRe = /^(?:VYZNAM|DEFINICE|PUVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|DEF|DEFINITION|MEANING|ORIGIN|COMMENTARY|EXEGESIS|USAGE|V|D|P|K|S)(?:[:：–—=])/u;
for (const key of Object.keys(fields)) {
         if (key !== '__DELIMITER__') fields[key] = fields[key].replace(innerLabelRe, '').trim();
       }
     
      translated[targetKey] = {
        vyznam: fields['VYZNAM'] || '',
        definice: fields['DEFINICE'] || '',
        puvod: fields['PUVOD'] || '',
        specialista: fields['SPECIALISTA'] || '',
        kjv: fields['KJV'] || '',
        _rawDefinition: content
      };
  } // end for blocks
  
  // Vrátí klíče, které mají prázdné vyznam nebo specialista
  const missingKeys = keys.filter(function(k) {
    const entry = translated[k];
    return !entry || !entry.vyznam || !entry.specialista;
  });
  return missingKeys;
}



export function validateAPIResponse(d, p) {
  if (!d) throw new Error('Empty');
  if (p === 'groq' && !d.choices?.[0]?.message?.content) throw new Error('Invalid Groq');
  if (p === 'gemini' && !d.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Invalid Gemini');
  if (p === 'openrouter') {
    const content = d.choices?.[0]?.message?.content;
    const hasString = typeof content === 'string' && content.trim().length > 0;
    const hasArrayText = Array.isArray(content) && content.some(part =>
      typeof part === 'string' ||
      (part && typeof part.text === 'string' && part.text.trim().length > 0)
    );
    if (!hasString && !hasArrayText) throw new Error('Invalid OpenRouter');
  }
  return true;
}

export default { parseTXT, parseTranslations, buildPromptMessages, buildRetryMessages, validateAPIResponse };