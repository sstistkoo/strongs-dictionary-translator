import { ITEM_HEIGHT, PROVIDERS } from '../config.js';
import { isSideFallbackAborted, sleepMsWithAbort, runProviderFallbackTaskSequential } from '../ai/fallback.js';
import {
  buildSecondaryProviderModelCandidates,
  getRankedModelsForSecondary,
  getProviderConfiguredModelsForAI,
  getStaticFallbackModels
} from '../../strong_translator_ai.js';
import {
  hasMeaningfulValue, isDefinitionLowQuality, isTranslationComplete,
  getFailedTopicsForFallback,
  getMissingTopicsForRepair,
  cloneTranslationTopicFields,
  shouldReplaceTopicValue,
  isBetterGenericTopicValue,
  preserveBetterTopicsAfterBatch,
  FALLBACK_TOPIC_ORDER
} from './utils.js';
import { sleepMs } from '../utils.js';
import {
  getDefaultBatchTopicSystemPrompt,
  getDefaultBatchTopicUserPrompt
} from './topicRepair.js';
import core from '../../strong_translator_core_new.js';

const { buildRetryMessages } = core;

export function createBatchApi(deps) {
  const {
    state, t, escHtml,
    log, logError, logWarn,
    showToast,
    TOPIC_PROMPT_PRESET_MAP,
    parseTranslations,
    parseWithOpenRouterNormalization, applyFallbacksToParsedMap,
    extractTopicValueFromAI,
    shouldReplaceSpecialista,
    fillMissingVyznamFromSource, fillMissingKjvFromSource, annotateEnglishDefinitionsInTranslated,
    buildPromptMessages,
    callOnce, callAIWithRetry,
    getApiKeyForModelTest, getPipelineModelForProvider, getCurrentApiKey,
    getModelTestSelectedModelForProvider,
    resolveMainBatchProvider,
    appendModelTestUsage, buildModelTestMessages,
    isPipelineSecondaryEnabled,
    upsertModelTestStats, pushTestHistory,
    renderList, updateStats, renderDetail,
    startElapsedTimer, stopElapsedTimer, updateFailedCount,
    saveProgress,
    logTokenEntry, logEntry,
    getTranslationEngineLabel,
    isAutoProviderEnabled,
    translateSelected,
  } = deps;
function formatPreviewRawTranslation(rawDef) {
  const text = String(rawDef || '').trim();
  if (!text) return '�';
  const esc = escHtml(text);
  const formatted = esc
    .replace(/(V�ZNAM:|V�znam:)/g, '<br><b>$1</b>')
    .replace(/(DEFINICE:|Definice:)/g, '<br><b>$1</b>')
    .replace(/(POU�IT[�I]:|Pou�it[�i]:)/g, '<br><b>$1</b>')
    .replace(/(SPECIALISTA:|Specialista:|V�KLAD:|V�klad:)/g, '<br><b>$1</b>');
  return formatted.replace(/^<br>/, '');
}

// ----- Utilities for Gemini topic rotation fallback -----
function buildTopicRepairBatchHeslaText(keys, topicId) {
  const list = Array.isArray(keys) ? keys : [];
  return list.map(key => {
    const e = state.entryMap.get(key) || {};
    const lines = [];
    const idPart = e.key || key;
    const wordPart = e.greek || '';
    const tvarPart = e.tvaroslovi ? ` (${e.tvaroslovi})` : '';
    lines.push(`${idPart} | ${wordPart}${tvarPart}`);
    switch (topicId) {
      case 'definice':
        if (e.definice || e.def) lines.push(`DEF: ${e.definice || e.def || ''}`);
        break;
      case 'vyznam':
        const curMean = String(e.vyznamCz || e.cz || '').trim();
        if (curMean) lines.push(`V: ${curMean}`);
        break;
      case 'kjv':
        if (e.kjv) lines.push(`K: ${e.kjv}`);
        break;
      case 'puvod':
        break;
      case 'specialista':
        break;
    }
    return lines.join('\n');
  }).join('\n\n---\n\n');
}
function normalizeAiTopicRawText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0085/g, '\n')
    .replace(/\u2028/g, '\n')
    .replace(/\u2029/g, '\n')
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\uFF1A/g, ':')
    .replace(/\uFF1F/g, '?')
    .normalize('NFKC');
}
function parseTopicRepairBatchResponse(rawText, topicId) {
  const text = normalizeAiTopicRawText(rawText).trim();
  if (!text) return {};
  const blocks = text.split(/\n(?=#{1,6}\s*[gGhH]?\d+)/i);
  const out = {};
  const headerRe = /^#{2,6}\s*([gGhH]?)(\d+)\s*(?:#+\s*)?(?=\n|$|\r)/im;
  for (const block of blocks) {
    const b = String(block || '').trim();
    if (!b) continue;
    const header = b.match(headerRe);
    if (!header) continue;
    const letter = (header[1] || '').toUpperCase();
    const num = header[2];
    // Ukládáme pod oběma variantami aby lookup vždy trefil správný klíč
    const key = (letter || 'G') + num;
    const rest = b.slice(header.index + header[0].length).trim();
    let val = String(extractTopicValueFromAI(rest, topicId, 'strict') || '').trim();
    if (!hasMeaningfulValue(val)) {
      val = String(extractTopicValueFromAI(rest, topicId, 'loose') || '').trim();
    }
    if (hasMeaningfulValue(val)) {
      out[key] = val;
      // Pokud AI vynechala písmeno, uložíme pod oběma variantami aby lookup vždy uspěl
      if (!letter) { out['G' + num] = val; out['H' + num] = val; }
    }
  }
  return out;
}
function applyPromptLanguageTokens(promptText) {
  const targetLang = localStorage.getItem('strong_target_lang') || 'cz';
  const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
  const keyMap = {
    cz: 'lang.name.genitive.cz', cs: 'lang.name.genitive.cz',
    en: 'lang.name.genitive.en', bg: 'lang.name.genitive.bg',
    ch: 'lang.name.genitive.ch', sp: 'lang.name.genitive.sp',
    sk: 'lang.name.genitive.sk', pl: 'lang.name.genitive.pl',
    gr: 'lang.name.genitive.gr', he: 'lang.name.genitive.he',
    both: 'lang.name.genitive.both'
  };
  const targetName = t(keyMap[String(targetLang || '').toLowerCase()] || 'lang.name.genitive.cz');
  const sourceName = t(keyMap[String(sourceLang || '').toLowerCase()] || 'lang.name.genitive.gr');
  return String(promptText || '')
    .replace(/{TARGET_LANG}/g, targetName)
    .replace(/{SOURCE_LANG}/g, sourceName);
}
const TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX = 'strong_topic_repair_batch_prompt_v1_';
const TOPIC_REPAIR_BATCH_SYSTEM_PROMPT_SUFFIX = '_sys';
const TOPIC_REPAIR_BATCH_USER_PROMPT_SUFFIX = '_usr';
function getTopicRepairSystemPromptStorageKey(topicId) {
  return `${TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX}${topicId}${TOPIC_REPAIR_BATCH_SYSTEM_PROMPT_SUFFIX}`;
}
function getTopicRepairUserPromptStorageKey(topicId) {
  return `${TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX}${topicId}${TOPIC_REPAIR_BATCH_USER_PROMPT_SUFFIX}`;
}
function enforceSpecialistaFormat(promptText) {
  return String(promptText || '');
}
function syncTopicRepairTaskSpecialistaFromRaw(task, rawText) {
  if (!task || !task.key) return;
  const key = task.key;
  const baseline = state.translated[key] || {};
  const prevSpecialista = String(baseline.specialista || '').trim();
  let candidate = String(extractTopicValueFromAI(rawText, 'specialista', 'strict') || '').trim();
  if (!hasMeaningfulValue(candidate)) {
    candidate = String(extractTopicValueFromAI(rawText, 'specialista', 'loose') || '').trim();
  }
  if (hasMeaningfulValue(candidate) && shouldReplaceSpecialista(prevSpecialista, candidate)) {
    state.translated[key] = state.translated[key] || {};
    state.translated[key].specialista = candidate;
  }
}

// -- PREKLAD � SINGLE --------------------------------------------
async function translateSingle(key) {
  const btn = document.querySelector('.translate-btn');
  if (btn) { btn.disabled = true; btn.textContent = t('translate.single.translating'); }
  
  const prov = resolveMainBatchProvider(document.getElementById('provider')?.value || '');
  const apiKey = getCurrentApiKey(prov);
  const model = getPipelineModelForProvider(prov) || document.getElementById('model').value;

   if (!apiKey) {
     showToast(t('toast.apiKey.enterForProvider', { provider: prov }));
     if (btn) { btn.disabled = false; btn.textContent = t('translate.single.button'); }
     return;
   }

   const e = state.entryMap.get(key);
  if (!e) {
    if (btn) { btn.disabled = false; btn.textContent = t('translate.single.button'); }
    return;
  }
  
  const messages = buildPromptMessages([e]);
  
  try {
    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    log(`?? Preklad: ${getTranslationEngineLabel(raw, prov, model)}`);
    if (window.DEBUG_AI) {
    }
    let missingKeys = parseTranslations(raw.content, [key]);
    
    if (missingKeys.length > 0) {
      const entries = `${key}
D: ${e.definice || e.def || ''}
KJV: ${e.kjv || ''}
ORIG: ${e.orig || ''}`;
      const retryContent = t('batch.retry.missingG', { entries });
      
       const raw2 = await callOnce(prov, apiKey, model, buildRetryMessages(retryContent));
       missingKeys = parseTranslations(raw2.content, [key]);
     }

   } catch(e) {
     logError('translateSingle', e, {
       key,
       provider: prov,
       model
     });
     showToast(t('toast.error.withMessage', { message: e.message }));
   }
  
  if (btn) { btn.disabled = false; btn.textContent = t('translate.single.button'); }
  renderDetail();
  updateStats();
  renderList();
}

// -- PREKLAD � ZNOVU --------------------------------------------
async function retranslateSingle(key) {
  if (!confirm(t('confirm.retranslate', { key }))) return;
  
  // Oznac jako neprelo�en� pro dal�� zpracov�n�
  delete state.translated[key];
  saveProgress();
  
  // Vyber jen tento kl�c
  state.selectedKeys.clear();
  state.selectedKeys.add(key);
  renderList();
  
  // Zavolej preklad
  await translateSelected();
}

// -- PREKLAD � D�VKA ----------------------------------------------
async function translateNext() {
  if (state.autoRunning) return;
  const activeProvider = resolveMainBatchProvider(document.getElementById('provider')?.value || '');
  if (!isAutoProviderEnabled(activeProvider)) {
    showToast(t('toast.provider.enableOne'));
    return;
  }
  
  // Retry mode - pou�ij state.retryKeysList m�sto getNextBatch
  let batch;
  if (state.retryMode && state.retryKeysList.length > 0) {
    batch = state.retryKeysList.slice(0, state.currentBatchSize);
    state.retryKeysList = state.retryKeysList.slice(state.currentBatchSize);
    if (state.retryKeysList.length === 0) {
      state.retryMode = false;
    }
  } else {
    batch = getNextBatch(state.currentBatchSize);
  }
  
  if (!batch.length) { 
    if (state.retryMode) {
      showToast(t('toast.retry.done'));
      state.retryMode = false;
    } else {
      showToast(t('toast.allTranslated')); 
    }
    stopElapsedTimer();
    return; 
  }
  
  // Info o retry m�du
  if (state.retryMode) {
    document.getElementById('btnStep').title = t('batch.retry.remaining', { count: state.retryKeysList.length + batch.length });
  }
  
  document.getElementById('btnStep').disabled = true;
  document.getElementById('btnStep').textContent = t('btn.step.loading');
  await translateBatch(batch);
  document.getElementById('btnStep').disabled = false;
  document.getElementById('btnStep').textContent = t('btn.step.default');
  updateStats();
  renderList();
  if (state.activeKey && state.translated[state.activeKey]) renderDetail();
}

function jumpToStart() {
  const num = parseInt(document.getElementById('startFrom').value);
  if (!num || num < 1) { showToast(t('toast.jump.enterGNumber')); return; }
  const key = state.entryMap.has('G' + num) ? 'G' + num : ('H' + num);
  const found = state.entryMap.get(key);
  if (!found) { showToast(t('toast.entry.notFoundInFile', { key })); return; }

   // Oznac v�echna hesla PRED t�mto c�slem jako preskocen� (zachov�me existuj�c� preklady)
   for (const e of state.entries) {
     const n = parseInt(e.key.slice(1));
     if (n < num && !state.translated[e.key]) {
       state.translated[e.key] = { vyznam: '�', definice: '(preskoceno)', puvod: '�', skipped: true };
     }
   }
   saveProgress();
   updateStats();
   renderList();
   showToast(t('toast.translation.resumeFrom', { key }));
   // Scroll na heslo v listu (virtu�ln�)
   setTimeout(() => {
     const scroll = document.getElementById('listScroll');
     const idx = state.filteredKeys.indexOf(key);
     if (idx !== -1) {
       scroll.scrollTop = idx * ITEM_HEIGHT - (scroll.clientHeight / 2) + (ITEM_HEIGHT / 2);
     }
   }, 0);
 }


function getNextBatch(size) {
  const result = [];
  const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
  const includeG = sourceLang === 'gr' || sourceLang === 'both';
  const includeH = sourceLang === 'he' || sourceLang === 'both';
  
  for (const e of state.entries) {
    if (result.length >= size) break;
    const existing = state.translated[e.key];
    // P?esko?it pokud existuje a nen� skipped, nebo pokud je ozna?eno jako _processing
    if (existing && !existing.skipped) {
      // Ve AUTO re�imu respektovat i _processing flag (p?edchoz� p?eklad je�t? nebyl dokon?en)
      if (state.autoRunning && existing._processing) {
        continue;
      }
      continue;
    }
    const startsWithG = e.key.startsWith('G');
    const startsWithH = e.key.startsWith('H');
    
    if ((includeG && startsWithG) || (includeH && startsWithH)) {
      result.push(e.key);
    }
  }
  return result;
}



function getProviderCooldownLeftSec(prov) {
  const until = Number(state.providerCooldownUntil?.[prov] || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function setProviderCooldown(prov, seconds, reason = '') {
  const sec = Math.max(0, Number(seconds) || 0);
  if (!Object.prototype.hasOwnProperty.call(state.providerCooldownUntil, prov)) return;
  state.providerCooldownUntil[prov] = sec > 0 ? (Date.now() + sec * 1000) : 0;
}

function getModelCooldownLeftSec(prov, model) {
  const map = state.providerModelCooldownUntil?.[prov];
  if (!map || !model) return 0;
  const until = Number(map[model] || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function setModelCooldown(prov, model, seconds) {
  if (!model) return;
  if (!Object.prototype.hasOwnProperty.call(state.providerModelCooldownUntil, prov)) {
    state.providerModelCooldownUntil[prov] = {};
  }
  const sec = Math.max(0, Number(seconds) || 0);
  state.providerModelCooldownUntil[prov][model] = sec > 0 ? (Date.now() + sec * 1000) : 0;
}


function shouldAcceptTopicFallback(topicId, candidate) {
  if (!hasMeaningfulValue(candidate)) return false;
  if (topicId === 'definice' && isDefinitionLowQuality(candidate)) return false;
  return true;
}

function getSecondaryProviderModelCandidates(prov) {
  const uniqueQueue = buildSecondaryProviderModelCandidates(prov);
  if (!uniqueQueue.length) return [];
  const idx = Math.max(0, Number(state.providerModelRotationIndex?.[prov] || 0));
  const shift = idx % uniqueQueue.length;
  state.providerModelRotationIndex[prov] = idx + 1;
  return [...uniqueQueue.slice(shift), ...uniqueQueue.slice(0, shift)];
}

function getSecondaryProviderModelQueue(prov) {
  const uniqueQueue = getSecondaryProviderModelCandidates(prov);
  if (!uniqueQueue.length) return [];
  const idx = Math.max(0, Number(state.providerModelRotationIndex?.[prov] || 0));
  const shift = idx % uniqueQueue.length;
  state.providerModelRotationIndex[prov] = idx + 1;
  return [...uniqueQueue.slice(shift), ...uniqueQueue.slice(0, shift)];
}

function getSecondaryNextOperationState(prov) {
  const queue = getSecondaryProviderModelCandidates(prov);
  if (!queue.length) return { exhausted: false, nextSec: 0 };
  const providerLeft = getProviderCooldownLeftSec(prov);
  let nextSec = Number.POSITIVE_INFINITY;
  let hasReadyNow = false;
  for (const model of queue) {
    const modelLeft = getModelCooldownLeftSec(prov, model);
    const opLeft = Math.max(providerLeft, modelLeft);
    if (opLeft <= 0) {
      hasReadyNow = true;
      break;
    }
    nextSec = Math.min(nextSec, opLeft);
  }
  if (hasReadyNow) return { exhausted: false, nextSec: 0 };
  if (!Number.isFinite(nextSec)) return { exhausted: false, nextSec: 0 };
  return { exhausted: true, nextSec: Math.max(1, Math.ceil(nextSec)) };
}

function getSecondaryRetryDelayMsByError(msgLower) {
  if (/resource_exhausted|too many|rate limit|429|high demand/.test(msgLower)) return 3000;
  if (/503|service unavailable|timeout|api timeout/.test(msgLower)) return 3000;
  if (/400|invalid/.test(msgLower)) return 1500;
  return 2500;
}

function getSecondaryCooldownSecByError(prov, rawMsg) {
  const msg = String(rawMsg || '');
  const low = msg.toLowerCase();
  if (prov === 'gemini' && (/resource_exhausted|429|high demand|limit vycerp�n/.test(low))) {
    // U Gemini dr��me cooldown hlavne per-model, ne per-provider.
    return 0;
  }
  if (/503|service unavailable|api timeout/.test(low)) return 5;
  if (/429|rate limit|too many|quota/.test(low)) {
    const parsed = rateInfoFromErrorMessage(msg)?.retryAfterSec || 0;
    return Math.max(3, Math.min(20, parsed || 6));
  }
  return 0;
}

function getSecondaryModelCooldownSecByError(prov, rawMsg) {
  const msg = String(rawMsg || '');
  const low = msg.toLowerCase();
  const retryAfter = rateInfoFromErrorMessage(msg)?.retryAfterSec || 0;
  const minMatch = low.match(/(\d+)\s*min/);
  const fromMinutes = minMatch ? (Number(minMatch[1]) || 0) * 60 : 0;
  if (prov === 'gemini' && (/limit vycerp�n|resource_exhausted/.test(low))) {
    // Prefer explicit Retry-After from API over textual "~20min" hint.
    const preferred = retryAfter || fromMinutes || (20 * 60);
    return Math.max(20, Math.min(25 * 60, preferred));
  }
  if (/high demand|503|service unavailable/.test(low)) {
    return Math.max(20, Math.min(180, retryAfter || 45));
  }
  if (/429|rate limit|too many|quota/.test(low)) {
    return Math.max(20, Math.min(180, retryAfter || 30));
  }
  return 0;
}

 async function requestTopicFallbackForProvider(prov, key, topicId, abortVersion) {
   if (isSideFallbackAborted(abortVersion)) return null;
   const apiKey = getApiKeyForModelTest(prov);
   const modelQueue = getSecondaryProviderModelQueue(prov);
   if (!apiKey || !modelQueue.length) return null;
   if (getProviderCooldownLeftSec(prov) > 0) return null;
   const entry = state.entryMap.get(key);
   if (!entry) return null;

   // ?? VYTVO?EN� MESSAGES ????????????????????????????????????????????????????
   const secondarySys = localStorage.getItem('strong_secondary_system_prompt');
   const secondaryUser = localStorage.getItem('strong_secondary_user_prompt');

   let messages;
   if (secondarySys && secondaryUser) {
     // Pou�ij secondary prompty
     log(`? Secondary prompts apply: ${prov} for ${key}.${topicId}`);
     const currentTopic = (state.translated[key] || {})[topicId] || '';
     const targetLang = (localStorage.getItem('strong_target_lang') || 'cz').toUpperCase();
     const sourceLang = (localStorage.getItem('strong_source_lang') || 'gr').toUpperCase();

     let userContent = secondaryUser
       .replace(/{GREEK}/g, entry.greek || '')
       .replace(/{DEFINITION}/g, entry.definice || entry.def || '')
       .replace(/{KJV}/g, entry.kjv || '')
       .replace(/{ORIG}/g, entry.orig || '')
       .replace(/{TOPIC_ID}/g, topicId)
       .replace(/{CURRENT_TOPIC}/g, currentTopic)
       .replace(/{TARGET_LANG}/g, targetLang)
       .replace(/{SOURCE_LANG}/g, sourceLang);

     messages = [
       { role: 'system', content: secondarySys },
       { role: 'user', content: userContent }
     ];
} else {
      // pou�ij stejn� prompt jako Groq (z prompts.cs.json)
      messages = buildPromptMessages([entry]);
    }

  for (let i = 0; i < modelQueue.length; i++) {
    if (isSideFallbackAborted(abortVersion)) return null;
    const model = modelQueue[i];
    // Pokud je provider nebo model v cooldownu, neblokujeme frontu cek�n�m �
    // vr�t�me null okam�ite a t�mata pokracuj� pres druh� provider nebo pr�te.
    if (getProviderCooldownLeftSec(prov) > 0) return null;
    const modelCooldownLeft = getModelCooldownLeftSec(prov, model);
    if (modelCooldownLeft > 0) {
      continue;
    }
    const reqStart = performance.now();
    try {
      const raw = await callOnce(prov, apiKey, model, messages);
      const reqMs = Math.round(performance.now() - reqStart);
      const parsed = {};
      const rawText = String(raw?.content || '');
      parseWithOpenRouterNormalization(rawText, [key], parsed);
      applyFallbacksToParsedMap([key], parsed);
      let candidate = String(parsed?.[key]?.[topicId] || '').trim();
      if (!candidate) {
        // Topic prompty mohou vracet cistou hodnotu pole bez parser-safe bloku.
        candidate = extractTopicValueFromAI(rawText, topicId, 'strict');
      }
      appendModelTestUsage(() => {}, prov, model, raw);
      if (shouldAcceptTopicFallback(topicId, candidate)) {
        log(`? Fallback ${prov}/${model} ${key}.${topicId} OK (${reqMs}ms)`);
        return { prov, model, value: candidate, reqMs };
      }
      log(`? Fallback ${prov}/${model} ${key}.${topicId}: odpoved nepro�la kvalitou, zkou��m dal�� model.`);
    } catch (e) {
      const msg = String(e?.message || '');
      const msgLower = msg.toLowerCase();
      const isRate = /429|rate limit|too many|quota|resource_exhausted|high demand/.test(msgLower);
      const cooldownSec = getSecondaryCooldownSecByError(prov, msg);
      const modelCooldownSec = getSecondaryModelCooldownSecByError(prov, msg);
      if (modelCooldownSec > 0) setModelCooldown(prov, model, modelCooldownSec);
      if (cooldownSec > 0) setProviderCooldown(prov, cooldownSec, isRate ? 'rate limit' : 'provider error');
      state.providerFailBadgeUntil[prov] = Date.now() + 10000;
        // Pokud provider spadl do del��ho cooldownu, fallback hned ukonc�me,
        // aby neblokoval dal�� Groq d�vky.
      // aby neblokoval dal�� Groq d�vky.
      if (cooldownSec >= 45) {
        return null;
      }
      const canTryNext = i < modelQueue.length - 1;
      if (canTryNext) {
        const waitMs = getSecondaryRetryDelayMsByError(msgLower);
        const cooldownMs = getProviderCooldownLeftSec(prov) * 1000;
        const effectiveWaitMs = Math.max(waitMs, cooldownMs);
        // Retry detail nech�v�me pouze v konzoli, AUTO r�dek zust�v� strucn�.
        const keptRunning = await sleepMsWithAbort(effectiveWaitMs, abortVersion);
        if (!keptRunning) return null;
      }
    }
  }
  return null;
}

async function runParallelTopicFallback(keys, abortVersion) {
  if (isSideFallbackAborted(abortVersion)) return;
  const keyList = Array.isArray(keys) ? keys : [];
  if (!keyList.length) return;
  const sideProviders = ['gemini', 'openrouter'].filter(prov => isPipelineSecondaryEnabled(prov));
  if (!sideProviders.length) {
    log('? Sekund�rn� fallback vypnut� (��dn� provider nen� za�krtnut).');
    return;
  }
  // Ka�d� kl�c zpracuj paralelne, uvnitr kl�ce t�mata tak� paralelne.
  // Ka�d� provider m� vlastn� sekvencn� frontu (runProviderFallbackTaskSequential),
  // tak�e rate limit je chr�nen � soube�n� t�mata se jen serad� do fronty providera.
  // Dr�ve: t�mata sekvencn� ? pomal� OpenRouter blokoval Gemini pro dal�� t�mata.
  await Promise.all(keyList.map(async (key) => {
    if (isSideFallbackAborted(abortVersion)) return;
    const t = state.translated[key] || {};
    const failedTopics = getFailedTopicsForFallback(t);
    if (!failedTopics.length) return;
     await Promise.all(failedTopics.map(async (topicId) => {
       if (isSideFallbackAborted(abortVersion)) return;
       // Spustit v�echny enabled secondary providery paraleln?, vybrat prvn�ho �sp?�n�ho
       const results = await Promise.all(
         sideProviders.map(async (prov) => {
           return await runProviderFallbackTaskSequential(
             prov,
             () => requestTopicFallbackForProvider(prov, key, topicId, abortVersion)
           ).catch(() => null);
         })
       );
       const chosen = results.find(r => r != null) || null;
       if (!chosen) return;
       if (isSideFallbackAborted(abortVersion)) return;
       state.translated[key] = state.translated[key] || {};
       state.translated[key][topicId] = chosen.value;
       log(`? Fallback prevzat ${key}.${topicId} <= ${chosen.prov}/${chosen.model}`);
     }));
  }));
}

function enqueueSideFallbackBackground(keys) {
  const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!keyList.length) return Promise.resolve();
  const abortVersion = state.sideFallbackAbortVersion;
  // Inicializace queue pokud neexistuje
  if (!state.sideFallbackBackgroundQueue) {
    state.sideFallbackBackgroundQueue = Promise.resolve();
  }
  state.sideFallbackBackgroundQueue = state.sideFallbackBackgroundQueue
    .catch(() => undefined)
    .then(async () => {
      if (isSideFallbackAborted(abortVersion)) return;
      try {
        await runParallelTopicFallback(keyList, abortVersion);
      } catch (e) {}
    });
  return state.sideFallbackBackgroundQueue;
}

async function runOpenRouterBatchFallbackTranslation(keys) {
  const prov = 'openrouter';
  const apiKey = getApiKeyForModelTest(prov);
  const modelQueue = getSecondaryProviderModelQueue(prov);
  
  if (!apiKey || !modelQueue.length) {
    log('? OpenRouter fallback: chyb� API kl�? nebo modely');
    return;
  }
  
  const batch = keys.map(k => state.entryMap.get(k)).filter(Boolean);
  if (!batch.length) return;
  
  const messages = buildPromptMessages(batch);
  
  for (let i = 0; i < modelQueue.length; i++) {
    const model = modelQueue[i];
    if (getModelCooldownLeftSec(prov, model) > 0) continue;
    
try {
      log(`? OpenRouter fallback: ${keys.length} hesel p?es ${model}`);
      const raw = await callOnce(prov, apiKey, model, messages);
      
      // Nejd?�v parsovat odpov?? do state.translated
      parseTranslations(raw.content, keys);
      fillMissingVyznamFromSource(keys);
      fillMissingKjvFromSource(keys);
      annotateEnglishDefinitionsInTranslated(keys);
      
      const translatedCount = keys.filter(k => isTranslationComplete(state.translated[k])).length;
      if (translatedCount > 0) {
        log(`? OpenRouter fallback: �sp?�n? p?elo�eno ${translatedCount}/${keys.length} hesel`);
        break;
      }
    } catch (e) {
      const msg = String(e?.message || '');
      const modelCooldownSec = getSecondaryModelCooldownSecByError(prov, msg);
      if (modelCooldownSec > 0) setModelCooldown(prov, model, modelCooldownSec);
      log(`? OpenRouter fallback chyba (${model}): ${e.message}`);
    }
  }
  
  saveProgress();
  updateFailedCount();
}

async function translateBatch(keys, depth = 0) {
  const preferredProvider = document.getElementById('provider')?.value || '';
  const prov   = resolveMainBatchProvider(preferredProvider);
  const model  = getPipelineModelForProvider(prov) || document.getElementById('model').value;
  // Kl�c v�dy dle aktu�ln�ho run providera
  const apiKey = getCurrentApiKey(prov);
  state.currentInterval = parseInt(document.getElementById('intervalRun').value);
  state.currentBatchSize = parseInt(document.getElementById('batchSizeRun').value);

  if (!apiKey) { showToast(t('toast.apiKey.enterForProvider', { provider: prov })); return { ok: false }; }

  // Start timer pri prvn�m prekladu
  if (!state.startTime) {
    state.startTime = Date.now();
    startElapsedTimer();
  }

  const batch = keys.map(k => state.entryMap.get(k)).filter(Boolean);
  const messages = buildPromptMessages(batch);

   // Ozna?it kl�?e jako "p?ekl�dan�" hned na za?�tku, aby se nepou�ily znovu
   const processingKeys = [...keys];
   for (const key of keys) {
     if (!state.translated[key]) {
       state.translated[key] = { vyznam: null, _processing: true };
     }
   }

  const reqStart = performance.now();
  try {
    const previousMap = {};
    for (const key of keys) {
      previousMap[key] = cloneTranslationTopicFields(state.translated[key]);
    }
    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    const reqMs = performance.now() - reqStart;
    const content = raw.content;
    log(`?? Preklad: ${getTranslationEngineLabel(raw, prov, model)}`);
    // Verbose logy pouze kdy� je aktivn� re�im pro debug (window.DEBUG_AI = true v konzoli)
    if (window.DEBUG_AI) {
    }
    let missingKeys = parseTranslations(content, keys);
    preserveBetterTopicsAfterBatch(keys, previousMap);
    fillMissingVyznamFromSource(keys);
    fillMissingKjvFromSource(keys);
    annotateEnglishDefinitionsInTranslated(keys);
    
    // Log tokenu
    const usage = raw.usage || raw.usageMetadata;
    if (usage) {
      const inT = usage.prompt_tokens || usage.promptTokenCount || 0;
      const outT = usage.completion_tokens || usage.candidatesTokenCount || 0;
      const total = inT + outT;
      log(`?? ${prov}: ${inT} in / ${outT} out = ${total} celkem`);
      logTokenEntry(prov, inT, outT, total);
    }
    
    // Log do konzoly pro �spe�n�
    for (const key of keys) {
      const t = state.translated[key];
      if (t?.vyznam && t.vyznam !== '�') {
      }
    }
    logEntry(keys, content);
    
    // Ulo� raw odpoved pro ka�d� kl�c (pro pozdej�� zobrazen� chyb)
    for (const key of keys) {
      if (state.translated[key]) {
        state.translated[key].raw = content;
      }
    }
    
     // Pokud neco chyb�, zkus opravn� retry
if (missingKeys.length > 0) {
        log(`? Pokus o opravu form�tu pro ${missingKeys.join(', ')}...`);
       const entries = keys.map((k) => {
         const e = state.entryMap.get(k);
         return e ? `${e.key} | ${e.greek}\nD: ${e.definice || e.def || ''}\nKJV: ${e.kjv || ''}` : '';
       }).join('\n\n');
       const retryContent = t('batch.retry.missingG', { entries });
      
      try {
        const raw2 = await callOnce(prov, apiKey, model, buildRetryMessages(retryContent));
        missingKeys = parseTranslations(raw2.content, keys);
        preserveBetterTopicsAfterBatch(keys, previousMap);
        fillMissingVyznamFromSource(keys);
        fillMissingKjvFromSource(keys);
        annotateEnglishDefinitionsInTranslated(keys);
        const retryCount = keys.length - missingKeys.length;
        if (retryCount > 0) {
          log(`? Opravn� preklad: ${retryCount} hesel, chyb�: ${missingKeys.length > 0 ? missingKeys.join(', ') : 'nic'}`);
        } else {
          log(`? Opravn� preklad nepomohl, chyb�: ${missingKeys.join(', ')}`);
        }
      } catch(e2) {
        log(`? Opravn� pokus selhal: ${e2.message}`);
      }
    }
    
    // Fallback strategie: pokud po retry chyb� c�st d�vky, zkus men�� d�vku.
    // V AUTO re�imu vypnuto - mohlo by zp?sobit p?ehnan� po?et API vol�n�.
    if (missingKeys.length > 0 && keys.length > 1 && depth < 4 && !state.autoRunning) {
      log(`? Fallback d�vky: del�m ${missingKeys.length} kl�cu na men�� bloky (�roven ${depth + 1})`);
      const pivot = Math.ceil(missingKeys.length / 2);
      const chunks = [missingKeys.slice(0, pivot), missingKeys.slice(pivot)].filter(ch => ch.length > 0);
      for (const chunk of chunks) {
        await translateBatch(chunk, depth + 1);
      }
    }

      // Sekund�rn� fallback spou�tej a� po dokoncen� v�ech pokusu hlavn�ho providera pro danou d�vku
      // V AUTO re�imu zapnut podle po�adavku - OpenRouter jede paraleln? i v AUTO
      if (depth === 0) {
        const keysBeforeSideFallback = keys.filter(k => !isTranslationComplete(state.translated[k]));
        if (keysBeforeSideFallback.length > 0) {
           // Spustit Gemini paraleln? (background, ne?ekat)
          if (isPipelineSecondaryEnabled('gemini')) {
            runGeminiTopicRotationFallback(keysBeforeSideFallback).catch(err => {
              logError('GeminiRotation', err, { keys: keysBeforeSideFallback });
            });
          }
           // OpenRouter m?�e z?stat batch (seri�ln?) nebo taky paraleln?
           // ZP?TNA KOMPATIBILITA: pokud chce� i OpenRouter paraleln?, zm?? na
           // runOpenRouterTopicRotationFallback(keysBeforeSideFallback)
           if (isPipelineSecondaryEnabled('openrouter')) {
            const filteredKeys = keysBeforeSideFallback.filter(k => {
              const entry = state.translated[k];
              if (!entry) return false;
              const failed = getFailedTopicsForFallback(entry);
              if (failed.length < 3) return false;
              const repairCount = entry.openrouterRepairCount || 0;
              if (repairCount >= 2) return false;
              return true;
            });
            if (filteredKeys.length > 0) {
              const now = Date.now();
              const lastRun = state.lastOpenRouterBatchFallbackTime || 0;
              const minIntervalMs = state.currentInterval * 1000;
              
              if (now - lastRun >= minIntervalMs) {
                for (const key of filteredKeys) {
                  if (!state.translated[key]) state.translated[key] = {};
                  state.translated[key].openrouterRepairCount = (state.translated[key].openrouterRepairCount || 0) + 1;
                }
                state.lastOpenRouterBatchFallbackTime = now;
                await runOpenRouterBatchFallbackTranslation(filteredKeys);
              }
            }
          }
        }
      }

    const translatedCount = keys.filter(k => isTranslationComplete(state.translated[k])).length;
    upsertModelTestStats(prov, model, {
      status: translatedCount === keys.length ? 'OK' : 'PARTIAL',
      okKeys: translatedCount,
      failedKeys: keys.length - translatedCount,
      totalKeys: keys.length,
      latencyMs: reqMs
    });
    pushTestHistory({
      type: 'translate-batch',
      provider: prov,
      model,
      total: keys.length,
      ok: translatedCount,
      missing: keys.length - translatedCount,
      avgLatencyMs: reqMs
    });
    if (translatedCount < keys.length) {
      // Oznac chybej�c� hesla jako ne�spe�n�
      for (const key of keys) {
        if (!isTranslationComplete(state.translated[key])) {
          state.translated[key] = state.translated[key] || {};
          if (!state.translated[key].vyznam || state.translated[key].vyznam === '�') {
            state.translated[key].vyznam = '�';
          }
        }
      }
      log(`? Pozor: Prelo�eno ${translatedCount}/${keys.length} hesel. Zkuste men�� d�vku.`);
      showToast(t('toast.translated.partial', { translated: translatedCount, total: keys.length }));
    }
    
saveProgress();
      updateFailedCount();
      // logEntry already called above after initial parse
 log(`? Prelo�eno ${keys.length} hesel (${keys[0]}�${keys[keys.length-1]})`);
      // Vy?istit _processing flagy po dokon?en�
      for (const key of keys) {
        if (state.translated[key] && state.translated[key]._processing) {
          delete state.translated[key]._processing;
        }
      }
      return { ok: true };
} catch(e) {
      const reqMs = performance.now() - reqStart;
      const msg = (e?.message || '').toLowerCase();
      const isRate = msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many');
      upsertModelTestStats(prov, model, {
        status: isRate ? 'RATE_LIMITED' : 'ERROR',
        okKeys: 0,
        failedKeys: keys.length,
        totalKeys: keys.length,
        latencyMs: reqMs
      });
      if (isRate) {
        pushTestHistory({
          type: 'translate-batch',
          provider: prov,
          model,
          total: keys.length,
          ok: 0,
          missing: keys.length,
          avgLatencyMs: reqMs
        });
        const cooldownSeconds = Math.max(state.currentInterval, 60);
        logWarn('translateBatch', `Rate limit d�vky ${keys[0]}-${keys[keys.length-1]}, odklad ${cooldownSeconds}s`, {
          provider: prov,
          keyRange: `${keys[0]}-${keys[keys.length-1]}`,
          cooldownSeconds,
          error: e.message
        });
        showToast(t('toast.rateLimit.retryIn', { seconds: cooldownSeconds }));
        return { ok: false, rateLimited: true, cooldownSeconds };
      }
      logError('translateBatch', e, {
        keys: keys.slice(0, 5), // first 5 keys only
        keyRange: `${keys[0]}-${keys[keys.length-1]}`,
        provider: prov,
        batchSize: keys.length
      });
      // Oznac chybn� hesla jako ne�spe�n�, aby �la zobrazit v "Ne�spe�n� preklady"
      for (const key of keys) {
        if (!state.translated[key]) {
          state.translated[key] = { vyznam: '�', definice: '', puvod: '', specialista: '', raw: `CHYBA: ${e.message}` };
        }
      }
      saveProgress();
      pushTestHistory({
        type: 'translate-batch',
        provider: prov,
        model,
        total: keys.length,
        ok: 0,
        missing: keys.length,
        avgLatencyMs: reqMs
      });
      updateFailedCount();
      showToast(t('toast.error.withMessage', { message: e.message }));
      return { ok: false };
   }
}

async function runGeminiTopicRotationFallback(keys, abortVersion) {
  const prov = 'gemini';
  const apiKey = getApiKeyForModelTest(prov);
  const model = getPipelineModelForProvider(prov) || 'gemini-3.1-flash-lite-preview';
  if (!apiKey) return;

  // Seskupit keys podle chyb?j�c�ch t�mat
  const topicMap = new Map();
  for (const key of keys) {
    const t = state.translated[key] || {};
    const failed = getFailedTopicsForFallback(t);
    for (const topicId of failed) {
      if (!topicMap.has(topicId)) topicMap.set(topicId, []);
      topicMap.get(topicId).push(key);
    }
  }
  if (!topicMap.size) return;

  // Po?ad� t�mat
  const topicOrder = ['definice', 'vyznam', 'kjv', 'puvod', 'specialista'];
  let topicIdx = 0;
  while (topicIdx < topicOrder.length) {
    if (isSideFallbackAborted(abortVersion)) return;
    const topicId = topicOrder[topicIdx];
    const keysForTopic = topicMap.get(topicId) || [];
    if (keysForTopic.length === 0) {
      topicIdx++;
      continue;
    }

    // Kontrola cooldownu
    if (getProviderCooldownLeftSec(prov) > 0) {
      await sleepMs(5000);
      continue;
    }

    // Vezmi d�vku
    const batchKeys = keysForTopic.slice(0, state.currentBatchSize);
    const remaining = keysForTopic.slice(state.currentBatchSize);
    if (remaining.length > 0) {
      topicMap.set(topicId, remaining);
    } else {
      topicMap.delete(topicId);
      topicIdx++;
    }

    // P?eklad d�vky
    await translateTopicBatchWithGemini(batchKeys, topicId);

    // Interval mezi d�vkami
    const intervalSec = state.currentInterval || 20;
    if (intervalSec > 0) {
      await sleepMs(intervalSec * 1000);
    }
  }
}

async function addTopicBatchResult(key, topicId, value, provider, model) {
  if (hasMeaningfulValue(value)) {
    state.translated[key] = state.translated[key] || {};
    state.translated[key][topicId] = value;
    log(`? Gemini rotation: ${key}.${topicId} ? ${provider}/${model}`);
  }
}

async function translateTopicBatchWithGemini(keys, topicId) {
  const prov = 'gemini';
  const apiKey = getApiKeyForModelTest(prov);
  const model = getPipelineModelForProvider(prov) || 'gemini-3.1-flash-lite-preview';
  if (!apiKey) return;

  // Na?�st batch prompty z localStorage
  const sysPrompt = localStorage.getItem(getTopicRepairSystemPromptStorageKey(topicId)) ||
                    getDefaultBatchTopicSystemPrompt(topicId);
  const usrPromptTemplate = localStorage.getItem(getTopicRepairUserPromptStorageKey(topicId)) ||
                            applyPromptLanguageTokens(getDefaultBatchTopicUserPrompt(topicId));

  // Sestavit batch hesla
  const heslaText = buildTopicRepairBatchHeslaText(keys, topicId);
  const userContent = usrPromptTemplate.includes('{HESLA}')
    ? usrPromptTemplate.replace(/{HESLA}/g, heslaText)
    : `${usrPromptTemplate}\n\n${heslaText}`;

  const messages = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: enforceSpecialistaFormat(userContent) }
  ];

  try {
    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    const rawText = raw.content;

    // Parse odpov?di
    const parsedMap = parseTopicRepairBatchResponse(rawText, topicId);

    for (const key of keys) {
      const _num = key.replace(/^[GH]/, '');
      const val = String(parsedMap[key] || parsedMap[_num] || parsedMap['G' + _num] || parsedMap['H' + _num] || '').trim();
      await addTopicBatchResult(key, topicId, val, prov, model);

      // Specialista nav�c
      if (topicId === 'specialista') {
        syncTopicRepairTaskSpecialistaFromRaw({ key }, rawText);
      }
    }

    saveProgress();
    updateStats();
    renderList();
  } catch (e) {
    logError('translateTopicBatchWithGemini', e, { keys, topicId });
    for (const key of keys) {
      state.translated[key] = state.translated[key] || {};
      state.translated[key][topicId] = '�';
    }
  }
}

// ── PARALELNÍ PŘEKLAD — provider jako parametr ─────────────────────────────
// Volá se z auto.js pro paralelní překlad více providery najednou.
async function translateBatchForProvider(allKeys, prov, apiKey, model) {
  if (!allKeys.length || !apiKey) return { ok: false };

  // Přeskočit klíče co jsou již přeloženy nebo zpracovávány
  const keys = allKeys.filter(k => {
    const tr = state.translated[k];
    if (!tr) return true;
    if (tr.skipped) return false;
    if (tr._processing) return true; // naše vlastní _processing
    if (tr.vyznam && tr.vyznam !== null) return false;
    return true;
  });
  if (!keys.length) return { ok: true, translatedCount: 0, total: 0 };

  const batch = keys.map(k => state.entryMap.get(k)).filter(Boolean);
  if (!batch.length) return { ok: false };

  const messages = buildPromptMessages(batch);

  // Elapsed timer
  if (!state.startTime) {
    state.startTime = Date.now();
    startElapsedTimer();
  }

  // Zkontrolovat request limit pro všechny providery
  if (typeof window !== 'undefined' && window.checkProviderRequestLimit) {
    if (window.checkProviderRequestLimit(prov)) {
      log('[' + prov + '] dosažen limit požadavků — přeskakuji');
      return { ok: false, rateLimited: false, limitReached: true };
    }
    window.incrementProviderReqCount && window.incrementProviderReqCount(prov);
  }

  const reqStart = performance.now();
  try {
    const previousMap = {};
    for (const key of keys) {
      previousMap[key] = cloneTranslationTopicFields(state.translated[key]);
    }

    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    const reqMs = performance.now() - reqStart;
    log('Paralelní překlad [' + prov + ']: ' + getTranslationEngineLabel(raw, prov, model));

    let missingKeys = parseTranslations(raw.content, keys);
    preserveBetterTopicsAfterBatch(keys, previousMap);
    fillMissingVyznamFromSource(keys);
    fillMissingKjvFromSource(keys);
    annotateEnglishDefinitionsInTranslated(keys);

    // Token log
    const usage = raw.usage || raw.usageMetadata;
    if (usage) {
      const inT = usage.prompt_tokens || usage.promptTokenCount || 0;
      const outT = usage.completion_tokens || usage.candidatesTokenCount || 0;
      logTokenEntry(prov, inT, outT, inT + outT);
    }

    // Retry pro chybějící — přeskočit pokud je model rotační (nemá konkrétní ID)
    if (missingKeys.length > 0 && model !== 'openrouter/rotate') {
      try {
        const entries = keys.map(k => {
          const e = state.entryMap.get(k);
          return e ? (e.key + ' | ' + e.greek + '\nD: ' + (e.definice || e.def || '') + '\nKJV: ' + (e.kjv || '')) : '';
        }).join('\n\n');
        const retryContent = t('batch.retry.missingG', { entries });
        const effectiveModel = raw.resolvedModel || model;
        const raw2 = await callOnce(prov, apiKey, effectiveModel, buildRetryMessages(retryContent));
        missingKeys = parseTranslations(raw2.content, keys);
        preserveBetterTopicsAfterBatch(keys, previousMap);
        fillMissingVyznamFromSource(keys);
        fillMissingKjvFromSource(keys);
        annotateEnglishDefinitionsInTranslated(keys);
      } catch (e2) {
        log('Opravný pokus [' + prov + '] selhal: ' + e2.message);
      }
    }

    // Vyčistit _processing flagy
    for (const key of keys) {
      if (state.translated[key] && state.translated[key]._processing) {
        delete state.translated[key]._processing;
      }
    }

    saveProgress();
    updateFailedCount();
    logEntry(keys, raw.content);

    const translatedCount = keys.filter(k => isTranslationComplete(state.translated[k])).length;
    return { ok: true, translatedCount, total: keys.length, reqMs };

  } catch (e) {
    const msg = (e && e.message ? e.message : '');
    const msgLow = msg.toLowerCase();
    const isRate = msgLow.includes('429') || msgLow.includes('rate limit') || msgLow.includes('quota') || msgLow.includes('too many');
    let cooldownSeconds = isRate ? 60 : 0;
    const retryMatch = msg.match(/retry.after[:\s]*(\d+)/i);
    if (retryMatch) cooldownSeconds = Math.max(cooldownSeconds, parseInt(retryMatch[1], 10) || 0);
    if (msgLow.includes('resource_exhausted')) cooldownSeconds = Math.max(cooldownSeconds, 20 * 60);

    for (const key of keys) {
      if (state.translated[key] && state.translated[key]._processing) {
        delete state.translated[key]._processing;
      }
      if (!state.translated[key]) {
        state.translated[key] = { vyznam: '—', definice: '', puvod: '', specialista: '', raw: 'CHYBA: ' + e.message };
      }
    }
    saveProgress();
    logError('translateBatchForProvider', e, { prov, keys: keys.slice(0, 5) });
    if (!isRate) showToast(t('toast.error.withMessage', { message: e.message }));
    return { ok: false, rateLimited: isRate, cooldownSeconds };
  }
}

  return {
    translateSingle,
    translateBatchForProvider,
    retranslateSingle,
    translateNext,
    jumpToStart,
    translateBatch,
    getNextBatch,
    getSecondaryNextOperationState,
    getFailedTopicsForFallback,
    getMissingTopicsForRepair,
    cloneTranslationTopicFields,
    shouldReplaceTopicValue,
    getProviderCooldownLeftSec,
    formatPreviewRawTranslation,
    runOpenRouterBatchFallbackTranslation,
  };
}
