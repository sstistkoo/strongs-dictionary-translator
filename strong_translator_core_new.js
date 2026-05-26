/**
 * Strong Greek to Czech Translator - Core Module
 */
import { getResolvedSystemMessage, getResolvedDefaultPrompt } from './js/aiPromptsResolve.js';

/**
 * Normalizes a field-name label for cross-language matching.
 * Strips diacritics, lowercases, collapses whitespace.
 */
function normalizeLabel(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps normalized field-name labels (in many languages) to internal field keys.
 * Mirror of i18n/{lang}.json `export.field.*` plus legacy input-dictionary fields.
 * - "translated:*" = goes into the translated[key] map (post-translation slot)
 * - any other string = goes onto the current entry (input-dictionary slot)
 */
const LABEL_TO_FIELD = {
  // === Translated output labels (per-language) ===
  // Význam / Meaning / Bedeutung / Znaczenie ...
  'vyznam':        'translated:vyznam',
  'meaning':       'translated:vyznam',
  'znaczenie':     'translated:vyznam',
  'bedeutung':     'translated:vyznam',
  'signification': 'translated:vyznam',
  'significato':   'translated:vyznam',
  'significado':   'translated:vyznam',
  'znachenie':     'translated:vyznam',
  // Definice / Definition / Definicja ...
  'definice':      'translated:definice',
  'definicia':     'translated:definice',
  'definition':    'translated:definice',
  'definicja':     'translated:definice',
  'definizione':   'translated:definice',
  'definicion':    'translated:definice',
  'opredelenie':   'translated:definice',
  // KJV překlady / KJV preklady / KJV translations / Tłumaczenia KJV ...
  'kjv':                   'translated:kjv',
  'kjv preklady':          'translated:kjv',
  'kjv prekladi':          'translated:kjv',
  'kjv translations':      'translated:kjv',
  'kjv ubersetzungen':     'translated:kjv',
  'tlumaczenia kjv':       'translated:kjv',
  'traductions kjv':       'translated:kjv',
  'traduzioni kjv':        'translated:kjv',
  'kjv perevody':          'translated:kjv',
  // Původ / Pôvod / Origin / Pochodzenie / Herkunft ...
  'puvod':         'translated:puvod',
  'povod':         'translated:puvod',
  'origin':        'translated:puvod',
  'origine':       'translated:puvod',
  'origen':        'translated:puvod',
  'pochodzenie':   'translated:puvod',
  'herkunft':      'translated:puvod',
  'proishozhdenie':'translated:puvod',
  // Specialista / Specialist / Specjalista / Spezialist ...
  'specialista':   'translated:specialista',
  'specialist':    'translated:specialista',
  'spezialist':    'translated:specialista',
  'specjalista':   'translated:specialista',
  'specialiste':   'translated:specialista',
  'specialiste':   'translated:specialista', // fr (with accent stripped)
  'speczialista':  'translated:specialista',
  'specialista bibliyskiy': 'translated:specialista',
  // Gramatika / Grammar / Gramatyka / Grammatik ...
  'gramatika':     'tvaroslovi',
  'grammar':       'tvaroslovi',
  'gramatyka':     'tvaroslovi',
  'grammatik':     'tvaroslovi',
  'grammatica':    'tvaroslovi',
  'grammaire':     'tvaroslovi',
  'tvaroslovi':    'tvaroslovi',

  // === Legacy input-dictionary fields (unchanged from original parser) ===
  'beta': 'beta',
  'prepis': 'prepis',
  'en': 'en',
  'en definition': 'enDef',
  'cz': 'cz',
  'vyz': 'vyznam',           // hebrew shorthand → goes to current.vyznam (input)
  'vokalizace': 'vokalizace',
  'vyslovnost': 'vyslovnost',
  'etymol': 'etymol',
  'twot': 'twot',
  'poznamky': 'poznamky',
  'preklad': 'preklad',
  'vysvetleni': 'vysvetleni',
  'recke refs': 'greekRefs',
  'kategorie': 'kategorie',
  'vyznam cz': 'vyznamCz',
  'kjv vyznamy': 'kjv',
  'kjv vyz': 'kjv'
};

const VALID_LANG_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$/;

/**
 * Splits "Label (XX)" → { base: "label", lang: "xx" } or just { base } if no tag.
 */
function splitLabelLangTag(fieldNameRaw) {
  const m = fieldNameRaw.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (m && VALID_LANG_TAG.test(m[2].trim())) {
    return { base: m[1].trim(), lang: m[2].trim().toLowerCase().replace(/^cs$/, 'cz') };
  }
  return { base: fieldNameRaw.trim(), lang: null };
}

export function parseTXT(text) {
  const lines = text.split('\n');
  const entries = [];
  const translated = {};
  let current = null;
  let pendingField = null;
  let detectedTargetLang = null;

  // Helper to record translated-slot value and possibly detect target lang
  const setTranslated = (key, slot, value, langTag) => {
    if (!key || !slot) return;
    if (!translated[key]) translated[key] = {};
    translated[key][slot] = value;
    if (langTag && langTag !== 'en' && !detectedTargetLang) {
      detectedTargetLang = langTag;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const lineTrim = lines[i].trim();

    if (!lineTrim) {
      pendingField = null;
      if (current && current.key) {
        entries.push(finishEntry(current));
        current = null;
      }
      continue;
    }

    const newMatch = lineTrim.match(/^([GH]\d+)\s*\|\s*(.+)$/);
    if (newMatch) {
      pendingField = null;
      if (current && current.key) {
        entries.push(finishEntry(current));
      }
      const type = newMatch[1].startsWith('H') && parseInt(newMatch[1].slice(1)) >= 9000 ? 'grammar'
                 : newMatch[1].startsWith('H') ? 'hebrew' : 'greek';
      current = { key: newMatch[1], greek: newMatch[2].trim(), type };
      continue;
    }

    if (!current) continue;

    // Handle pending multiline field value (e.g. Výz: value může být víceřádkový)
    if (pendingField) {
      const ci2 = lineTrim.indexOf(':');
      const fn2raw = ci2 > 0 ? lineTrim.slice(0, ci2).trim() : '';
      const fn2Norm = ci2 > 0 ? normalizeLabel(splitLabelLangTag(fn2raw).base) : '';
      const isNewKnownField = !!LABEL_TO_FIELD[fn2Norm];
      if (!isNewKnownField) {
        // Pokračování hodnoty — akumuluj (na entry nebo translated dle slotu)
        if (pendingField.startsWith('translated:')) {
          const slot = pendingField.slice(11);
          if (!translated[current.key]) translated[current.key] = {};
          translated[current.key][slot] = (translated[current.key][slot] ? translated[current.key][slot] + ' ' : '') + lineTrim;
        } else {
          current[pendingField] = (current[pendingField] ? current[pendingField] + ' ' : '') + lineTrim;
        }
        continue;
      }
      // Nové pole — zahoď pendingField a fall-through k normálnímu zpracování
      pendingField = null;
    }

    const colonIdx = lineTrim.indexOf(':');
    if (colonIdx === -1) continue;

    const fieldNameRaw = lineTrim.slice(0, colonIdx).trim();
    const fieldValue = lineTrim.slice(colonIdx + 1).trim();

    const { base, lang } = splitLabelLangTag(fieldNameRaw);
    const normName = normalizeLabel(base);
    let target = LABEL_TO_FIELD[normName];
    if (!target) continue;

    // === Disambiguation by suffix ===
    // For labels that exist in both input dictionaries and translated outputs
    // (vyznam, definice, kjv): the language suffix decides which slot they fill.
    //   • no suffix              → legacy input-dictionary slot on `current`
    //   • suffix == 'en'         → source enDef slot on `current`
    //   • suffix != 'en'         → translated[key].*  (and triggers lang detection)
    // For labels that only ever come from translated output (puvod, specialista),
    // we always route to translated[].
    if (target === 'translated:definice') {
      if (!lang && !detectedTargetLang) {
        // Legacy input slot — original dictionaries (e.g. strong_finalni_verze.txt)
        current.definice = fieldValue;
        continue;
      }
      if (lang === 'en') {
        if (fieldValue) {
          current.enDef = fieldValue;
          if (!current.definice) current.definice = fieldValue;
        } else {
          pendingField = 'enDef';
        }
        continue;
      }
      // lang ≠ 'en' OR (lang null + sticky detectedTargetLang) → translated slot, fall through
    } else if (target === 'translated:vyznam') {
      if (!lang && !detectedTargetLang) {
        // Legacy hebrew input slot (current.vyznam, may be multiline)
        if (fieldValue) current.vyznam = fieldValue;
        else pendingField = 'vyznam';
        continue;
      }
      // lang present OR sticky detectedTargetLang → translated slot, fall through
    } else if (target === 'translated:kjv') {
      if (!lang && !detectedTargetLang) {
        // Legacy "KJV Významy:" → current.kjv
        current.kjv = fieldValue;
        continue;
      }
      // lang present OR sticky detectedTargetLang → translated slot, fall through
    }

    if (target.startsWith('translated:')) {
      const slot = target.slice(11);
      if (fieldValue) {
        setTranslated(current.key, slot, fieldValue, lang);
      } else {
        pendingField = target; // multiline accumulator
        // still detect lang from empty-valued header
        if (lang && lang !== 'en' && !detectedTargetLang) detectedTargetLang = lang;
      }
      continue;
    }

    // === Legacy input-dictionary slot on current entry ===
    if (target === 'cz') {
      current.cz = fieldValue;
      current.czDef = fieldValue;
    } else if (target === 'vyznam') {
      // Hebrew "Výz:" shorthand — empty value triggers multiline accumulation
      if (fieldValue) current.vyznam = fieldValue;
      else pendingField = 'vyznam';
    } else {
      current[target] = fieldValue;
    }
  }

  if (current && current.key) {
    entries.push(finishEntry(current));
  }

  // Attach meta for callers that want it (legacy callers ignore .meta)
  entries.meta = { detectedTargetLang, translated };

  const translatedCount = Object.keys(translated).length;
  console.log(`PARSE: ${entries.length} entries${translatedCount ? `, ${translatedCount} with translations` : ''}${detectedTargetLang ? `, target=${detectedTargetLang}` : ''}`);
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
    return { ...base, orig: tvaroslovi, en: e.en || '', enDef: e.enDef || '', kjv: e.kjv || '', czDef: e.czDef || '', beta: e.beta || '', prepis: e.prepis || '', tvaroslovi: tvaroslovi, vyskyt: vyskyt, vokalizace: e.vokalizace || '', vyslovnost: e.vyslovnost || '', etymol: e.etymol || '', twot: e.twot || '', poznamky: e.poznamky || '', preklad: e.preklad || '', vysvetleni: e.vysvetleni || '', greekRefs: e.greekRefs || '', vyznam: e.vyznam || '' };
  } else if (e.type === 'hebrew') {
    // Sestavíme plnou definici: vše od Definice: po KJV Výz: (exkluzivně)
    const defParts = [];
    if (e.definice) defParts.push(e.definice);
    if (e.vyznam) defParts.push('Výz: ' + e.vyznam);
    if (e.twot) defParts.push('TWOT: ' + e.twot);
    if (e.poznamky) defParts.push('Pozn: ' + e.poznamky);
    if (e.preklad) defParts.push('Překlad: ' + e.preklad);
    if (e.etymol) defParts.push('Etymol: ' + e.etymol);
    if (e.vysvetleni) defParts.push('Vysvětlení: ' + e.vysvetleni);
    if (e.greekRefs) defParts.push('Řecké refs: ' + e.greekRefs);
    const fullDefinice = defParts.join(' | ');
    const hebrewVyskyt = extractVyskyt(fullDefinice);
    return { ...base, definice: fullDefinice, orig: tvaroslovi, en: e.en || '', enDef: e.enDef || '', kjv: e.kjv || '', beta: '', prepis: e.prepis || '', tvaroslovi: tvaroslovi, vokalizace: e.vokalizace || '', vyslovnost: e.vyslovnost || '', etymol: e.etymol || '', twot: e.twot || '', poznamky: e.poznamky || '', preklad: e.preklad || '', vysvetleni: e.vysvetleni || '', greekRefs: e.greekRefs || '', vyznam: e.vyznam || '', vyskyt: hebrewVyskyt };
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