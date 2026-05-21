import { CONFIG, PROVIDERS } from '../config.js';
import { sleep } from '../utils.js';
import { extractOpenRouterText } from './client.js';
import { getProviderConfiguredModelsForAI, getStaticFallbackModels } from '../../strong_translator_ai.js';
import core from '../../strong_translator_core_new.js';
import { state } from '../state.js';

const { validateAPIResponse } = core;

export function createCallApi({ log, logError, logWarn, showToast, t, rateInfoFromErrorMessage, parseWithOpenRouterNormalization }) {
 const blockedModelsByProvider = new Map();

// Store recent AI calls for debugging/inspection
const MAX_RECENT_CALLS = 3;
const recentAICalls = [];

function addRecentCall({ type, provider, model, messages, response, usage, error, durationMs }) {
  const entry = {
    type,
    provider,
    model,
    timestamp: new Date().toISOString(),
    durationMs: Math.round(durationMs),
    messages: Array.isArray(messages) ? messages.map(m => ({ role: m.role, content: m.content })) : [],
    response: response,
    usage: usage,
    error: error ? String(error) : null
  };
  recentAICalls.unshift(entry);
  if (recentAICalls.length > MAX_RECENT_CALLS) {
    recentAICalls.pop();
  }
  return entry;
}

function getRecentAICalls() {
  return recentAICalls.slice();
}

function logAICallToConsole(callEntry) {
  const { type, provider, model, timestamp, durationMs, messages, response, usage, error } = callEntry;
  // Vytáhnout rozsah hesel z user promptu (např. G1–G5)
  let rangeLabel = '';
  try {
    const userMsg = (messages || []).find(m => m.role === 'user');
    const text = String(userMsg?.content || '');
    const keys = [...text.matchAll(/([GH]\d+)\s*\|/g)].map(m => m[1]);
    if (keys.length >= 2) rangeLabel = ' [' + keys[0] + '–' + keys[keys.length - 1] + ']';
    else if (keys.length === 1) rangeLabel = ' [' + keys[0] + ']';
  } catch(e) {}
  console.groupCollapsed('🤖 AI ' + type + ' — ' + provider + ' | ' + model + rangeLabel + ' — ' + durationMs + 'ms — ' + timestamp);
  if (error) {
    console.log('%c❌ Error:', 'color: #ff0000; font-weight: bold;', error);
  }
   if (messages && messages.length) {
     console.log('%c📨 Prompt(s):', 'color: #0066cc; font-weight: bold;');
     messages.forEach((msg) => {
       const preview = String(msg.content || '').replace(/\n/g, '\n    ');
       console.log(`  ${msg.role.toUpperCase()}:\n    ${preview}`);
     });
   }
   if (response) {
     const preview = String(response).replace(/\n/g, '\n    ');
     console.log('%c📤 AI Response:', 'color: #cc6600; font-weight: bold;',
       `\n    ${preview}`);
   }
  if (usage) {
    const inT = usage.prompt_tokens || usage.promptTokenCount || usage.input_tokens || 0;
    const outT = usage.completion_tokens || usage.candidatesTokenCount || usage.output_tokens || 0;
    const total = usage.total_tokens || (inT + outT) || 0;
    console.log('%c📊 Token Usage:', 'color: #aa00aa; font-weight: bold;',
      ` Input: ${inT} | Output: ${outT} | Total: ${total}`);
  }
  console.groupEnd();
}

function isModelBlocked(provider, model) {
  const blocked = blockedModelsByProvider.get(provider);
  return !!(blocked && blocked.has(model));
}

function markModelBlocked(provider, model) {
  if (!provider || !model) return;
  if (!blockedModelsByProvider.has(provider)) blockedModelsByProvider.set(provider, new Set());
  blockedModelsByProvider.get(provider).add(model);
}

// ══ AI VOLÁNÍ S RETRY A FALLBACK ════════════════════════════════
function getProviderConfiguredModels(provider) {
  return getProviderConfiguredModelsForAI(provider, PROVIDERS);
}

// Round-robin index pro střídání modelů
let _orRoundRobinIndex = 0;

function getOrRotationList() {
  try {
    const rotationRaw = localStorage.getItem('or_rotation_models');
    if (rotationRaw) {
      const models = JSON.parse(rotationRaw);
      if (Array.isArray(models) && models.length > 0) return models;
    }
  } catch(e) {}
  return [];
}

function getFallbackModels(provider) {
  if (provider !== 'openrouter') return getStaticFallbackModels(provider, PROVIDERS);

  // Nejdřív zkusit ručně vybrané modely pro rotaci
  try {
    const rotationModels = getOrRotationList();
    if (rotationModels.length > 0) {
      // Round-robin: posunout index a sestavit seznam začínající od aktuálního modelu
      _orRoundRobinIndex = _orRoundRobinIndex % rotationModels.length;
      const rotated = [
        ...rotationModels.slice(_orRoundRobinIndex),
        ...rotationModels.slice(0, _orRoundRobinIndex)
      ];
      _orRoundRobinIndex = (_orRoundRobinIndex + 1) % rotationModels.length;
      return rotated;
    }
  } catch(e) { /* ignore */ }

  // Fallback na cache všech modelů
  try {
    const raw = localStorage.getItem('openrouter_free_models_cache');
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && Array.isArray(cached.models) && cached.models.length) {
        const ids = cached.models.map(m => {
          if (Array.isArray(m)) return m[0];
          if (m && typeof m === 'object') return m.id || m.value;
          return null;
        }).filter(Boolean);
        return [...new Set(ids)].slice(0, 5);
      }
    }
  } catch(e) { /* ignore */ }

  return ['meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free'];
}

async function callAIWithRetry(provider, apiKey, model, messages) {
  // Rotační mód — jeden model, jeden pokus, statistika, vrátit výsledek/chybu
  if (provider === 'openrouter' && model === 'openrouter/rotate') {
    const rotated = getFallbackModels(provider);
    const m = rotated.find(x => !isModelBlocked(provider, x)) || rotated[0];
    if (!m) throw new Error(t('ai.error.noModelAvailable'));
    try {
      const res = await callOnce(provider, apiKey, m, messages);
      if (typeof window !== 'undefined' && window.recordOrModelStat) {
        window.recordOrModelStat(res.resolvedModel || m, true);
      }
      return { ...res, providerUsed: provider, requestedModel: model, attemptedModel: m, resolvedModel: res.resolvedModel || m };
    } catch(e) {
      if (typeof window !== 'undefined' && window.recordOrModelStat) {
        window.recordOrModelStat(m, false);
      }
      const msg = (e.message || '').toLowerCase();
      const isRate = msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('too many');
      logWarn('callAIWithRetry', 'OpenRouter rotate: ' + m + ' selhal (' + (e.message||'') + ')', { provider, model: m });
      throw Object.assign(e, { rateLimited: isRate, cooldownSeconds: isRate ? 60 : 0 });
    }
  }

  let candidateModels;
  if (provider === 'gemini' || (provider === 'openrouter' && model === 'openrouter/free')) {
    candidateModels = [model];
  } else {
    candidateModels = [...new Set([model, ...getFallbackModels(provider).filter(m => m !== model)])];
  }
  const tryModels = candidateModels.filter((m) => !isModelBlocked(provider, m));
  let lastErr = null;

  if (!tryModels.length) {
    throw new Error(t('ai.error.noModelAvailable'));
  }

  for (const m of tryModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await callOnce(provider, apiKey, m, messages);
        if (provider === 'openrouter' && typeof window !== 'undefined' && window.recordOrModelStat) {
          window.recordOrModelStat(res.resolvedModel || m, true);
        }
        return {
          ...res,
          providerUsed: provider,
          requestedModel: model,
          attemptedModel: m,
          resolvedModel: res.resolvedModel || m
        };
       } catch(e) {
         lastErr = e;
         const msg = (e.message || '').toLowerCase();
         const isRate = msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('too many');
         const isBadRequest = msg.includes('400') || msg.includes('bad request');
         if (provider === 'openrouter' && typeof window !== 'undefined' && window.recordOrModelStat) {
           window.recordOrModelStat(m, false);
         }
         if (isBadRequest && provider === 'openrouter') {
           log('Model ' + m + ' vrátil 400, přeskakuji');
           break; // přeskočit na další model
         }
         const isBanned = msg.includes('restricted') || msg.includes('organization');
         const is404 = msg.includes('404') || msg.includes('not found');
         const is503 = msg.includes('503') || msg.includes('service unavailable');
         const isTimeout = e?.name === 'AbortError' || msg.includes('signal is aborted') || msg.includes('timeout');

         if (is404) {
           const errMsg = t('ai.error.modelNotFound');
           logError('callAIWithRetry', new Error(errMsg), {
             provider, model: m, attempt: attempt + 1,
             statusCode: 404
           });
           throw new Error(errMsg);
         }
         if (isRate) {
           const parsedRetry = rateInfoFromErrorMessage(e?.message || '')?.retryAfterSec || 0;
           const wait = Math.max(2, Math.min(20, parsedRetry || ((attempt + 1) * 10)));
           const shouldSwitchModelImmediately = provider === 'groq';
           logWarn('callAIWithRetry', t('ai.log.rateLimitWait', { model: m, seconds: wait }), {
             provider, model: m, attempt: attempt + 1, waitSeconds: wait
           });
           showToast(t('toast.rateLimit.waiting', {
             seconds: wait,
             suffix: shouldSwitchModelImmediately ? t('toast.rateLimit.waiting.switchModelSuffix') : ''
           }));
           await sleep(wait * 1000);
           if (shouldSwitchModelImmediately) {
             // U Groq je praktičtější při rate limitu rychle přeskočit na další model.
             break;
           }
           continue;
         }
         if (isTimeout) {
           const wait = Math.min(8, (attempt + 1) * 2);
           logWarn('callAIWithRetry', t('ai.log.timeoutRetry', { model: m, attempt: attempt + 1, seconds: wait }), {
             provider, model: m, attempt: attempt + 1, waitSeconds: wait, error: e.message
           });
           showToast(t('toast.timeout.retryIn', { seconds: wait }));
           await sleep(wait * 1000);
           continue;
         }
         if (is503) {
           const wait = Math.min(20, Math.max(3, (attempt + 1) * 5));
           logWarn('callAIWithRetry', t('ai.log.serviceUnavailableRetry', { model: m, attempt: attempt + 1, seconds: wait }), {
             provider, model: m, attempt: attempt + 1, waitSeconds: wait, error: e.message
           });
           showToast(t('toast.serviceUnavailable.retryIn', { seconds: wait }));
           await sleep(wait * 1000);
           continue;
         }
         if (isBanned) {
          markModelBlocked(provider, m);
           logError('callAIWithRetry', new Error(t('ai.error.blockedAccountModel', { model: m })), {
             provider, model: m, attempt: attempt + 1
           });
           break;
         }
          // Other errors - log and try next model/attempt
          logWarn('callAIWithRetry', t('ai.log.callError', { model: m, attempt: attempt + 1, message: e.message }), {
            provider, model: m, attempt: attempt + 1, error: e.message
          });
          // Log to console for debugging
          console.groupCollapsed(`%c⚠️ AI Error — ${provider} | ${m} — attempt ${attempt + 1}`, 'color: #ff4444; font-weight: bold;');
          console.log('Error:', e.message);
          console.log('Messages:', messages);
          console.groupEnd();
          break;
       }
    }
  }
  throw lastErr || new Error(t('ai.error.allModelsFailed'));
}

function getTranslationEngineLabel(raw, fallbackProvider, fallbackModel) {
  const provider = raw?.providerUsed || fallbackProvider || '?';
  const resolved = raw?.resolvedModel || raw?.attemptedModel || fallbackModel || '?';
  const requested = raw?.requestedModel || fallbackModel || resolved;
  if (provider === 'openrouter' && requested === 'openrouter/free' && resolved !== requested) {
    return `${provider} | auto-router -> ${resolved}`;
  }
  if (resolved !== requested) {
    return `${provider} | ${resolved} (fallback from ${requested})`;
  }
  return `${provider} | ${resolved}`;
}

 async function callOnce(provider, apiKey, model, messages, externalSignal = null) {
  const startTime = performance.now();
  apiKey = apiKey.trim();
  const controller = new AbortController();
  let externalAbortHandler = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalAbortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
    }
  }
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CONFIG.API_TIMEOUT);
  
  // Load AI settings from localStorage (per provider with legacy fallback)
  const temperature = parseFloat(localStorage.getItem('strong_ai_temperature_' + provider) || localStorage.getItem('strong_ai_temperature') || '0.3') || 0.3;

  // Per-provider max_tokens — OpenRouter a Gemini zvládnou více, Groq je rychlejší s méně
  const PROVIDER_MAX_TOKENS = { groq: 2500, gemini: 8192, openrouter: 8192 };
  const maxTokensDefault = PROVIDER_MAX_TOKENS[provider] || 4096;
  const maxTokens = parseInt(localStorage.getItem('strong_ai_max_tokens_' + provider) || localStorage.getItem('strong_ai_max_tokens') || String(maxTokensDefault), 10) || maxTokensDefault;
  
  try {
    const shouldLogFullResponse = Array.isArray(messages) && messages.some((m) => {
      if (!m || m.role !== 'user') return false;
      const text = String(m.content || '');
      return text.includes('G11 |');
    });
    if (provider === 'groq') {
    const r = await fetch('https://corsproxy.io/?https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages,
        temperature: temperature, max_tokens: maxTokens }),
      signal: controller.signal
    });
    const d = await r.json();
    const rateInfo = {
      provider: 'groq',
      requestId: r.headers.get('x-request-id') || r.headers.get('request-id') || '',
      retryAfterSec: Number(r.headers.get('retry-after') || 0) || 0,
      remaining: r.headers.get('x-ratelimit-remaining-requests') || r.headers.get('x-ratelimit-remaining-tokens') || '',
      reset: r.headers.get('x-ratelimit-reset-requests') || r.headers.get('x-ratelimit-reset-tokens') || ''
    };
     if (!r.ok) {
       if (r.status === 429) {
         throw new Error(t('ai.error.rateLimitGroq', {
           seconds: rateInfo.retryAfterSec || t('ai.common.few'),
           requestId: rateInfo.requestId ? ` [req:${rateInfo.requestId}]` : ''
         }));
       }
       throw new Error(d.error?.message || String(r.status));
     }
     // Validate response structure
     validateAPIResponse(d, 'groq');
     if (d.usage) {
       log(`📊 Groq: ${d.usage.prompt_tokens} in / ${d.usage.completion_tokens} out / ${d.usage.total_tokens} total`);
     }
     const content = d.choices[0].message.content;
// Kontrola na nesmyslnou odpověď
     // Povolíme: ASCII, české znaky, ruční cyrilici (ruština), a běžné interpunkce
     const weirdChars = (content.match(/[^\x20-\x7E\n\r\těščřžýáíéúůťďňĚŠČŘŽÝÁÍÉÚŮŤĎŇЀЁЂЃЄЅІЇЈЉЊЋЌЍЎЏЂЂ‡§¶·\u0400-\u04FF\u0500-\u052F]/g) || []).length;
    if (content.length > 0 && weirdChars > content.length * 0.5) {
      throw new Error(t('ai.error.gibberishResponse'));
    }
      if (shouldLogFullResponse) {
      }
      const durationMs = performance.now() - startTime;
      const callEntry = addRecentCall({
        type: 'call',
        provider,
        model,
        messages,
        response: content,
        usage: d.usage,
        durationMs
      });
      logAICallToConsole(callEntry);
      return { content, usage: d.usage, resolvedModel: d.model || model, rateInfo };

   } else if (provider === 'gemini') {
     const userContent = messages.find(m => m.role === 'user')?.content || '';
     const url = `https://corsproxy.io/?https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
     const r = await fetch(url, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ contents: [{ parts: [{ text: userContent }] }],
         systemInstruction: { parts: [{ text: messages.find(m => m.role === 'system')?.content || '' }] },
         generationConfig: { temperature: temperature, maxOutputTokens: maxTokens } }),
       signal: controller.signal
     });
    const d = await r.json();
     if (!r.ok) {
       if (r.status === 503 || d.error?.status === 'UNAVAILABLE') {
         throw new Error(t('ai.error.geminiUnavailable'));
       }
       if (d.error?.status === 'RESOURCE_EXHAUSTED') {
         const details = String(d.error?.message || '').trim();
         throw new Error(t('ai.error.geminiQuotaExhausted', { detail: details ? ` ${t('ai.error.detailPrefix')}: ${details}` : '' }));
       }
       throw new Error(d.error?.message || String(r.status));
     }
     // Validate response structure
     validateAPIResponse(d, 'gemini');
     if (d.usageMetadata) {
       log(`📊 Gemini: ${d.usageMetadata.promptTokenCount} in / ${d.usageMetadata.candidatesTokenCount} out`);
     }
       const content = d.candidates[0].content.parts[0].text;
       if (shouldLogFullResponse) {
       }
       const durationMs = performance.now() - startTime;
       const callEntry = addRecentCall({
        type: 'call',
        provider,
        model,
        messages,
        response: content,
        usage: d.usageMetadata,
        durationMs
      });
      logAICallToConsole(callEntry);
       return { content, usage: d.usageMetadata, resolvedModel: d.modelVersion || d.model || model, rateInfo: { provider: 'gemini' } };

     } else if (provider === 'openrouter') {
      // Helper: sloučit system prompt do prvního user message (pro modely bez support system role)
      function mergeSystemIntoUser(msgs) {
        const sys = msgs.find(m => m.role === 'system');
        if (!sys) return msgs;
        return msgs
          .filter(m => m.role !== 'system')
          .map(m => {
            if (m.role === 'user' && !mergeSystemIntoUser._done) {
              mergeSystemIntoUser._done = true;
              return { ...m, content: sys.content + '\n\n' + m.content };
            }
            return m;
          });
      }
      mergeSystemIntoUser._done = false;

      const orHeaders = {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://strong-bible-gr-cz.local',
        'X-Title': (() => {
          const src = String(localStorage.getItem('strong_source_lang') || 'gr').toUpperCase();
          const tgt = String(localStorage.getItem('strong_target_lang') || 'cz').toUpperCase().replace('CS','CZ');
          return 'Strong ' + src + '-' + tgt + ' Translator';
        })()
      };

      // Zjistit jestli model je označen jako no-system (uloženo po prvním 400)
      const noSystemKey = 'or_no_system_' + model.replace(/[^a-z0-9]/gi, '_');
      const useNoSystem = !!localStorage.getItem(noSystemKey);
      const orMessages = useNoSystem ? mergeSystemIntoUser([...messages]) : messages;

      const r = await fetch('https://corsproxy.io/?https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: orHeaders,
        body: JSON.stringify({ model, messages: orMessages, temperature, max_tokens: maxTokens }),
        signal: controller.signal
      });
     const d = await r.json();
     if (!r.ok) {
       const errMsg = d?.error?.message || d?.message || String(r.status);
       const errCode = String(d?.error?.code || '');
       if (r.status === 429 || errCode === '429') {
         throw new Error('429 Rate limit: ' + errMsg);
       }
       // 400 - zkusit bez system role pokud jsme ho ještě nezkusili
       if (r.status === 400 && !useNoSystem) {
         log('Model ' + model + ' vrátil 400, zkouším bez system role...');
         const r2 = await fetch('https://corsproxy.io/?https://openrouter.ai/api/v1/chat/completions', {
           method: 'POST',
           headers: orHeaders,
           body: JSON.stringify({ model, messages: mergeSystemIntoUser([...messages]), temperature, max_tokens: maxTokens }),
           signal: controller.signal
         });
         const d2 = await r2.json();
         if (r2.ok) {
           // Uložit že tento model nepodporuje system role
           localStorage.setItem(noSystemKey, '1');
           log('Model ' + model + ' funguje bez system role - uloženo');
           validateAPIResponse(d2, 'openrouter');
           const content2 = extractOpenRouterText(d2);
           if (!content2) throw new Error('OpenRouter: prázdná odpověď');
           return { content: content2, usage: d2.usage, resolvedModel: d2.model || model, rateInfo: { provider: 'openrouter' } };
         }
         const errMsg2 = d2?.error?.message || String(r2.status);
         throw new Error('OpenRouter ' + r2.status + ': ' + errMsg2);
       }
       throw new Error('OpenRouter ' + r.status + ': ' + errMsg);
     }
     validateAPIResponse(d, 'openrouter');
      const content = extractOpenRouterText(d);
      if (!content) throw new Error(t('ai.error.openrouterNoText'));
     if (shouldLogFullResponse) {
     }
     const durationMs = performance.now() - startTime;
     const callEntry = addRecentCall({
        type: 'call',
        provider,
        model,
        messages,
        response: content,
        usage: d.usage,
        durationMs
      });
      logAICallToConsole(callEntry);
     return { content, usage: d.usage, resolvedModel: d.model || model, rateInfo: { provider: 'openrouter' } };
  }
  throw new Error(t('ai.error.unknownProvider'));
  } catch (e) {
    const durationMs = performance.now() - startTime;
    addRecentCall({
      type: 'call',
      provider,
      model,
      messages,
      response: null,
      usage: null,
      error: e,
      durationMs
    });
    if (timedOut && e?.name === 'AbortError') {
      throw new Error(t('ai.error.apiTimeout', { seconds: Math.round(CONFIG.API_TIMEOUT / 1000) }));
    }
    if (externalSignal?.aborted && e?.name === 'AbortError') {
      throw new Error(t('ai.error.requestCanceled'));
    }
    throw e;
  } finally {
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler);
    }
    clearTimeout(timeout);
  }
}

   // Use core module with error handling
   function parseTranslations(raw, keys) {
     try {
       const parseTarget = {}; // lokální objekt
       const parsed = parseWithOpenRouterNormalization(raw, keys, parseTarget);
       if (parsed.normalizedUsed) {
         log('ℹ AUTO_NORMALIZOVANO_Z_OPENROUTER_FORMATU');
       }
       // Úspěšný parsing - merge výsledků do stavu
       Object.assign(state.translated, parseTarget);
       return parsed.missing;
     } catch(e) {
       logError('parseTranslations', e, {
         rawLength: raw?.length,
         keysCount: keys?.length,
         keysSample: keys?.slice(0, 5)
       });
       // Return all keys as missing to trigger retry
       return keys;
     }
   }

   return { callAIWithRetry, callOnce, getTranslationEngineLabel, getProviderConfiguredModels, getFallbackModels, parseTranslations, getRecentAICalls };
}
