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
  console.groupCollapsed(`🤖 AI ${type} — ${provider} | ${model} — ${durationMs}ms — ${timestamp}`);
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

function getFallbackModels(provider) {
  if (provider !== 'openrouter') return getStaticFallbackModels(provider, PROVIDERS);
  if (provider === 'openrouter') {
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
    // Minimální fallback, kdyby cache ještě neexistovala
    return ['meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free'];
  }
  return [];
}

async function callAIWithRetry(provider, apiKey, model, messages) {
  const candidateModels = (provider === 'gemini' || (provider === 'openrouter' && model === 'openrouter/free'))
    ? [model]
    : [...new Set([model, ...getFallbackModels(provider).filter(m => m !== model)])];
  const tryModels = candidateModels.filter((m) => !isModelBlocked(provider, m));
  let lastErr = null;

  if (!tryModels.length) {
    throw new Error(t('ai.error.noModelAvailable'));
  }

  for (const m of tryModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await callOnce(provider, apiKey, m, messages);
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
  const temperature = parseFloat(localStorage.getItem(`strong_ai_temperature_${provider}`) || localStorage.getItem('strong_ai_temperature') || '0.3') || 0.3;
  const maxTokens = parseInt(localStorage.getItem(`strong_ai_max_tokens_${provider}`) || localStorage.getItem('strong_ai_max_tokens') || '2500', 10) || 2500;
  
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
     const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
      const r = await fetch('https://corsproxy.io/?https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': 'Bearer ' + apiKey, 
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://strong-bible-gr-cz.local',
          'X-Title': 'Strong GR-CZ Translator'
        },
        body: JSON.stringify({ model, messages,
          temperature: temperature, max_tokens: maxTokens }),
        signal: controller.signal
      });
     const d = await r.json();
     if (!r.ok) {
       const errMsg = d?.error?.message || d?.message || String(r.status);
       const errCode = String(d?.error?.code || '');
       if (r.status === 429 || errCode === '429') {
         throw new Error(`429 Rate limit: ${errMsg}`);
       }
       throw new Error(`OpenRouter ${r.status}: ${errMsg}`);
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