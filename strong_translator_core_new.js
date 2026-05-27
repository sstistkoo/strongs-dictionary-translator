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

const _LABEL_NORMALIZE = {
  'V': 'VYZNAM', 'D': 'DEFINICE', 'P': 'PUVOD', 'K': 'KJV', 'S': 'SPECIALISTA',
  'DEF': 'DEFINICE', 'CZ': 'VYZNAM',
  'VÝZNAM': 'VYZNAM', 'DEFINICE': 'DEFINICE',
  'PUVOD': 'PUVOD', 'POUVOD': 'PUVOD', 'POVOD': 'PUVOD',
  'KJV': 'KJV', 'SPECIALISTA': 'SPECIALISTA',
  'VYKLAD': 'SPECIALISTA', 'VÝKLAD': 'SPECIALISTA',
  'KOMENTAR': 'SPECIALISTA', 'KOMENTÁŘ': 'SPECIALISTA', 'EXEGEZE': 'SPECIALISTA',
  'DEFINITION': 'DEFINICE', 'MEANING': 'VYZNAM',
  'ORIGIN': 'PUVOD', 'ETYMOLOGY': 'PUVOD', 'ETYMOLOGIES': 'PUVOD',
  'COMMENTARY': 'SPECIALISTA', 'EXEGESIS': 'SPECIALISTA'
};
const _LABEL_RE = /^\s*\*{0,2}(VYZNAM|DEFINICE|PUVOD|POUVOD|POVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|DEFINITION|MEANING|ORIGIN|ETYMOLOGY|ETYMOLOGIES|COMMENTARY|EXEGESIS|USAGE|DEF|V|D|P|K|S)\*{0,2}(?:\*{0,2}[:–—=.]+\*{0,2}\s*|\s+)/i;
const _INNER_LABEL_RE = /^\*{0,2}(?:VYZNAM|DEFINICE|PUVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|DEF|DEFINITION|MEANING|ORIGIN|COMMENTARY|EXEGESIS|USAGE|V|D|P|K|S)\*{0,2}(?:[:：–—=])\*{0,2}\s*/u;

function _parseBlockFields(content) {
  const lines = content.split('\n');
  const fieldPositions = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(_LABEL_RE);
    if (!m) continue;
    let label = m[1].toUpperCase();
    label = _LABEL_NORMALIZE[label] || label;
    if (label === 'USAGE') label = '__DELIMITER__';
    if (['VYZNAM', 'DEFINICE', 'PUVOD', 'KJV', 'SPECIALISTA', '__DELIMITER__'].includes(label)) {
      fieldPositions.push({ label, startLine: i, labelLen: m[0].length });
    }
  }
  const fields = {};
  for (let i = 0; i < fieldPositions.length; i++) {
    const { label, startLine, labelLen } = fieldPositions[i];
    const endLine = i < fieldPositions.length - 1 ? fieldPositions[i + 1].startLine : lines.length;
    let value = '';
    for (let j = startLine; j < endLine; j++) {
      let ln = lines[j];
      if (j === startLine) ln = ln.slice(labelLen);
      ln = ln.trim();
      if (ln) value += (value ? ' ' : '') + ln;
    }
    fields[label] = value.trim();
  }
  for (const k of Object.keys(fields)) {
    if (k !== '__DELIMITER__') fields[k] = fields[k].replace(_INNER_LABEL_RE, '').trim();
  }
  return {
    vyznam: fields['VYZNAM'] || '',
    definice: fields['DEFINICE'] || '',
    puvod: fields['PUVOD'] || '',
    specialista: fields['SPECIALISTA'] || '',
    kjv: fields['KJV'] || ''
  };
}

// Rozpoznání hlavičkového řádku — akceptuje:
//  - řádek je jen číslo + dekorace (#, *, `, [], (), mezery, G/H prefix)
//  - hlavička + obsah na stejném řádku — vyžaduje marker (#, *, [, (, G/H prefix),
//    aby holé "1234 jednotek zboží" nebylo false positive
function _detectHeaderLine(line, numToKey) {
  const nums = line.match(/\d+/g);
  if (nums) {
    for (const n of nums) {
      if (numToKey[n]) {
        const stripped = line
          .replace(n, '')
          .replace(/[GgHh]/g, '')
          .replace(/[#*`\[\]\(\)\-=:.,\s]/g, '');
        if (stripped.length === 0) return { key: numToKey[n], trailing: '' };
      }
    }
  }
  const m = line.match(/^([\s#*`\[\(]*)([GgHh]?)(\d+)([#*`\]\)\s]*)\s+(\S.*)$/);
  if (m) {
    const openDeco = m[1], ghPrefix = m[2], num = m[3], closeDeco = m[4], trailing = m[5];
    if (numToKey[num]) {
      const hasMarker = /[#*`\[\(]/.test(openDeco) || /[#*`\]\)]/.test(closeDeco) || ghPrefix !== '';
      if (hasMarker) return { key: numToKey[num], trailing: trailing.trim() };
    }
  }
  return null;
}

export function parseTranslations(raw, keys, translated = {}) {
  const normalized = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // G4594 → "4594", H123 → "123"
  const numToKey = {};
  for (const k of keys) numToKey[k.slice(1)] = k;

  // 1. Rozdělit odpověď na bloky podle hlavičkových řádků.
  const rawLines = normalized.split('\n');
  const blocks = [];
  {
    let currentKey = null;
    let currentLines = [];
    for (const line of rawLines) {
      const header = _detectHeaderLine(line, numToKey);
      if (header) {
        if (currentKey) blocks.push({ key: currentKey, content: currentLines.join('\n').trim() });
        currentKey = header.key;
        currentLines = header.trailing ? [header.trailing] : [];
      } else if (currentKey) {
        currentLines.push(line);
      }
    }
    if (currentKey) blocks.push({ key: currentKey, content: currentLines.join('\n').trim() });
  }

  // 2. Parsovat fields z každého bloku.
  for (const block of blocks) {
    translated[block.key] = { ..._parseBlockFields(block.content), _rawDefinition: block.content };
  }

  const TOPICS = ['vyznam', 'definice', 'puvod', 'kjv', 'specialista'];
  const MIN_FILLED = 2;
  const isAccepted = (entry) => {
    if (!entry) return false;
    let filled = 0;
    for (const t of TOPICS) if (entry[t] && String(entry[t]).trim()) filled++;
    return filled >= MIN_FILLED;
  };

  // 3. Count fallback — pro chybějící klíče: pokud se číslo v odpovědi vyskytuje
  //    právě jednou, najdi blok kolem výskytu a zkus z něj parsovat fields.
  const stillMissing = keys.filter(k => !isAccepted(translated[k]));
  for (const k of stillMissing) {
    const num = k.slice(1);
    const occRe = new RegExp('(?<!\\d)' + num + '(?!\\d)', 'g');
    const occurrences = normalized.match(occRe);
    if (!occurrences || occurrences.length !== 1) continue;

    const idx = normalized.search(occRe);
    if (idx < 0) continue;
    let lineStart = normalized.lastIndexOf('\n', idx - 1);
    lineStart = lineStart < 0 ? 0 : lineStart + 1;

    const tailLines = normalized.slice(lineStart).split('\n');
    let blockEnd = normalized.length;
    let runningPos = lineStart;
    for (let li = 0; li < tailLines.length; li++) {
      if (li > 0) {
        const h = _detectHeaderLine(tailLines[li], numToKey);
        if (h && h.key !== k) { blockEnd = runningPos - 1; break; }
      }
      runningPos += tailLines[li].length + 1;
    }

    let blockText = normalized.slice(lineStart, blockEnd).trim();
    const firstNl = blockText.indexOf('\n');
    const firstLine = firstNl < 0 ? blockText : blockText.slice(0, firstNl);
    const rest = firstNl < 0 ? '' : blockText.slice(firstNl);
    const firstLineStripped = firstLine.replace(/^[\s#*`\[\(]*[GgHh]?\d+[#*`\]\)\s]*/, '').trim();
    blockText = (firstLineStripped + rest).trim();

    const candidate = { ..._parseBlockFields(blockText), _rawDefinition: blockText };
    if (isAccepted(candidate)) translated[k] = candidate;
  }

  return keys.filter(k => !isAccepted(translated[k]));
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