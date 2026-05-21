import { PROVIDERS } from '../config.js';
import { t } from '../i18n.js';
import { escHtml } from '../utils.js';
import { BAD_TRANSLATIONS } from '../badTranslations.js';

export function createLimitsApi({ getCurrentApiKey, getModelTestSelectedModelForProvider, showToast }) {
function showLimitsModal() {
  const prov = document.getElementById('provider').value;
  const model = document.getElementById('model').value;
  const modelLabel = document.getElementById('model')?.selectedOptions?.[0]?.text || model;
  
  document.getElementById('limitsProviderInfo').textContent = t('limits.providerInfo', {
    provider: PROVIDERS[prov]?.label || prov,
    model: modelLabel
  });
  document.getElementById('limitsContent').innerHTML = `<div class="limits-loading">${t('limits.loading')}</div>`;
  document.getElementById('limitsNote').style.display = 'none';
  document.getElementById('limitsModal').classList.add('show');
  
  fetchLimits(prov, model);
}

function showHelpModal() {
  document.getElementById('helpModal').classList.add('show');
}

  function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('show');
  }

  function closeLimitsModal() {
    document.getElementById('limitsModal').classList.remove('show');
  }

  // ─── Bad Translations Modal ──────────────────────────────────────────────
  function showBadTranslationsModal() {
    const listEl = document.getElementById('badTranslationsList');
    listEl.innerHTML = '';
    
    BAD_TRANSLATIONS.forEach(item => {
      const div = document.createElement('div');
      div.className = 'bad-translations-item';
      div.dataset.en = item.en.toLowerCase();
      div.innerHTML = `
        <div class="bad-translations-word-row">
          <span class="bad-translations-en">${escHtml(item.en)}</span>
          <span class="bad-translations-arrow">→</span>
          <span class="bad-translations-cs">${escHtml(item.cs)}</span>
        </div>
        ${item.note ? `<div class="bad-translations-note">${escHtml(item.note)}</div>` : ''}
      `;
      listEl.appendChild(div);
    });
    
    document.getElementById('badTranslationsCount').textContent = BAD_TRANSLATIONS.length;
    document.getElementById('badTranslationsModal').classList.add('show');

    // Escape key closes modal
    function onKey(e) {
      if (e.key === 'Escape') closeBadTranslationsModal();
    }
    document.addEventListener('keydown', onKey);
    // Store handler for removal
    document.getElementById('badTranslationsModal')._escHandler = onKey;
  }

  function closeBadTranslationsModal() {
    const modal = document.getElementById('badTranslationsModal');
    modal.classList.remove('show');
    const handler = modal._escHandler;
    if (handler) {
      document.removeEventListener('keydown', handler);
      delete modal._escHandler;
    }
  }

  function filterBadTranslations() {
    const query = document.getElementById('badTransSearchInput').value.toLowerCase().trim();
    const items = document.querySelectorAll('.bad-translations-item');
    let visibleCount = 0;
    
    items.forEach(item => {
      const en = item.dataset.en || '';
      const cs = item.textContent.toLowerCase();
      const matches = en.includes(query) || cs.includes(query);
      item.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });
    
    document.getElementById('badTranslationsCount').textContent = 
      `${visibleCount} / ${BAD_TRANSLATIONS.length}`;
  }


async function fetchLimits(prov, model) {
  const content = document.getElementById('limitsContent');
  const note = document.getElementById('limitsNote');
  const noteText = document.getElementById('limitsNoteText');
  
  try {
    if (prov === 'groq') {
      const apiKey = getCurrentApiKey(prov);
      if (!apiKey) {
        content.innerHTML = `<div style="color:var(--red);padding:10px">${t('limits.noApiKey')}</div>`;
        return;
      }
      const dynamicLimits = await fetchGroqLimits(apiKey, model);
      const staticLimits = getGroqLimits(model);
      content.innerHTML = renderGroqLimits(dynamicLimits) + '<div style="margin-top:10px;border-top:1px solid var(--brd);padding-top:8px">' + renderLimitsTable(staticLimits) + '</div>';
      note.style.display = 'block';
      noteText.innerHTML = t('limits.note.groq');
    } else if (prov === 'openrouter') {
      // OpenRouter - can fetch via API
      const apiKey = getCurrentApiKey(prov);
      if (!apiKey) {
        content.innerHTML = `<div style="color:var(--red);padding:10px">${t('limits.noApiKey')}</div>`;
        return;
      }
      const [keyData, creditsData] = await Promise.all([
        fetchOpenRouterLimits(apiKey),
        fetchOpenRouterCredits(apiKey).catch(() => null)
      ]);
      content.innerHTML = renderOpenRouterLimits(keyData, creditsData);
      // Add rate limit info for OpenRouter
      const rateLimitInfo = getOpenRouterRateLimits(keyData);
      content.innerHTML = renderOpenRouterLimits(keyData, creditsData) + rateLimitInfo;
      note.style.display = 'block';
      noteText.innerHTML = t('limits.note.openrouter');
    } else if (prov === 'gemini') {
      // Gemini - no API for limits, show static info
      const limits = getGeminiLimits(model);
      content.innerHTML = renderLimitsTable(limits);
      note.style.display = 'block';
      noteText.innerHTML = t('limits.note.gemini');
    }
  } catch (e) {
    content.innerHTML = `<div style="color:var(--red);padding:10px">${t('limits.error', { message: e.message })}</div>`;
  }
}

function getGroqLimits(model) {
  // Known limits for Groq free tier (April 2026)
  const limits = {
    'meta-llama/llama-4-scout-17b-16e-instruct': { rpm: 30, rpd: 1000, tpm: 30000, tpd: 500000 },
    'llama-3.3-70b-versatile': { rpm: 30, rpd: 1000, tpm: 12000, tpd: 100000 },
    'llama-3.1-8b-instant': { rpm: 30, rpd: 14400, tpm: 6000, tpd: 500000 },
  };
  return limits[model] || { rpm: 30, rpd: 1000, tpm: 6000, tpd: 500000 };
}

function getGeminiLimits(model) {
  // Known limits for Gemini free tier (April 2026)
  const limits = {
    'gemini-2.5-pro': { rpm: 5, rpd: 50, tpm: 1000000, tpd: 0 },
    'gemini-2.5-flash': { rpm: 15, rpd: 1500, tpm: 1000000, tpd: 0 },
    'gemini-2.5-flash-lite': { rpm: 30, rpd: 1500, tpm: 1000000, tpd: 0 },
    // Preview model limits may vary by account and region.
    'gemini-3.1-pro-preview': { rpm: 5, rpd: 100, tpm: 1000000, tpd: 0 },
    'gemini-3.1-flash-lite-preview': { rpm: 15, rpd: 1000, tpm: 1000000, tpd: 0 },
    'gemini-2.5-flash-lite-preview-09-2025': { rpm: 15, rpd: 1000, tpm: 1000000, tpd: 0 },
  };
  return limits[model] || { rpm: 15, rpd: 1500, tpm: 1000000, tpd: 0 };
}

function renderLimitsTable(limits) {
  const rows = [];
  if (limits.rpm) rows.push(`<div class="limits-row"><span class="limits-label">RPM (requests/min)</span><span class="limits-value">${limits.rpm}</span></div>`);
  if (limits.rpd) rows.push(`<div class="limits-row"><span class="limits-label">RPD (requests/day)</span><span class="limits-value">${limits.rpd.toLocaleString()}</span></div>`);
  if (limits.tpm) rows.push(`<div class="limits-row"><span class="limits-label">TPM (tokens/min)</span><span class="limits-value">${limits.tpm.toLocaleString()}</span></div>`);
  if (limits.tpd) rows.push(`<div class="limits-row"><span class="limits-label">TPD (tokens/day)</span><span class="limits-value">${limits.tpd.toLocaleString()}</span></div>`);
  return rows.join('');
}

async function fetchOpenRouterLimits(apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.data;
}

async function fetchOpenRouterCredits(apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/credits', {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

async function fetchGroqLimits(apiKey, model) {
  // Try models list endpoint first - it should have headers
  try {
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + apiKey }
    });
    
    let respHeaders = {};
      const allHeaders = [];
    modelsRes.headers.forEach((value, name) => {
      allHeaders.push([name, value]);
      if (name.startsWith('x-ratelimit-')) {
        headers[name] = value;
      }
    });
    
    if (Object.keys(headers).length > 0) {
      return { headers, errorMsg: '', status: modelsRes.status };
    }
  } catch (e) {  }
  
  // Fallback to chat request
  const defaultModel = model || 'llama-3.1-8b-instant';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: defaultModel,
      messages: [{ role: 'user', content: t('limits.pingMessage') }],
      max_tokens: 1
    })
  });
  
  // Even error responses contain rate limit headers
  let respHeaders = {};
      const allHeaders = [];
  res.headers.forEach((value, name) => {
    allHeaders.push([name, value]);
    if (name.startsWith('x-ratelimit-')) {
      headers[name] = value;
    }
  });
  respresprespHeaders._all = allHeaders;
  
  // Also get any error message
  let errorMsg = '';
  if (!res.ok) {
    try {
      const err = await res.json();
      errorMsg = err.error?.message || `HTTP ${res.status}`;
    } catch (e) {
      errorMsg = `HTTP ${res.status}`;
    }
  }
  
  return { headers, errorMsg, status: res.status };
}

function renderGroqLimits(result) {
  const { headers, errorMsg, status } = result;
  const rows = [];
  
  // Debug info
  if (errorMsg && Object.keys(headers).length === 0) {
    return `<div style="color:var(--red);padding:10px">${t('limits.error', { message: errorMsg })}</div>`;
  }
  
  // Show all rate limit headers for debugging
  const rateLimitHeaders = Object.entries(headers).filter(([k]) => k.startsWith('x-ratelimit-'));
  
  // Requests per minute
  if (headers['x-ratelimit-remaining-requests'] !== undefined) {
    const limit = parseInt(headers['x-ratelimit-limit-requests'] || '30');
    const remaining = parseInt(headers['x-ratelimit-remaining-requests'] || '0');
    const pct = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
    const cls = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'danger';
    rows.push(`<div class="limits-row"><span class="limits-label">RPM</span><span class="limits-value ${cls}">${remaining} / ${limit}</span></div>`);
  } else if (headers['x-ratelimit-limit-requests']) {
    rows.push(`<div class="limits-row"><span class="limits-label">RPM limit</span><span class="limits-value">${headers['x-ratelimit-limit-requests']}</span></div>`);
  }
  
  // Tokens per minute
  if (headers['x-ratelimit-remaining-tokens'] !== undefined) {
    const limit = parseInt(headers['x-ratelimit-limit-tokens'] || '6000');
    const remaining = parseInt(headers['x-ratelimit-remaining-tokens'] || '0');
    const pct = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
    const cls = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'danger';
    rows.push(`<div class="limits-row"><span class="limits-label">TPM</span><span class="limits-value ${cls}">${remaining.toLocaleString()} / ${limit.toLocaleString()}</span></div>`);
  } else if (headers['x-ratelimit-limit-tokens']) {
    rows.push(`<div class="limits-row"><span class="limits-label">TPM limit</span><span class="limits-value">${headers['x-ratelimit-limit-tokens']}</span></div>`);
  }
  
  // Reset times
  if (headers['x-ratelimit-reset-requests']) {
    rows.push(`<div class="limits-row"><span class="limits-label">Reset RPM</span><span class="limits-value">${headers['x-ratelimit-reset-requests']}</span></div>`);
  }
  if (headers['x-ratelimit-reset-tokens']) {
    rows.push(`<div class="limits-row"><span class="limits-label">Reset TPM</span><span class="limits-value">${headers['x-ratelimit-reset-tokens']}</span></div>`);
  }
  const knownHeaders = new Set([
    'x-ratelimit-remaining-requests',
    'x-ratelimit-limit-requests',
    'x-ratelimit-remaining-tokens',
    'x-ratelimit-limit-tokens',
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens'
  ]);
  for (const [k, v] of Object.entries(headers)) {
    if (!k.startsWith('x-ratelimit-') || knownHeaders.has(k)) continue;
    rows.push(`<div class="limits-row"><span class="limits-label">${k.replace('x-ratelimit-', '')}</span><span class="limits-value">${escHtml(String(v))}</span></div>`);
  }
  
  // Debug: show all headers if nothing parsed
  const debugHeaders = respresprespHeaders._all || rateLimitHeaders;
  if ( rows.length === 0 && debugHeaders.length > 0) {
    rows.push(`<div style="color:var(--ylw);font-size:10px;margin-bottom:8px">${t('limits.debug.headers')}</div>`);
    debugHeaders.slice(0, 20).forEach(([k, v]) => {
      rows.push(`<div class="limits-row"><span class="limits-label">${k}</span><span class="limits-value" style="font-size:9px">${String(v).slice(0, 50)}</span></div>`);
    });
    if (debugHeaders.length > 20) {
      rows.push(`<div style="font-size:9px;color:var(--txt3)">${t('limits.debug.more', { count: debugHeaders.length - 20 })}</div>`);
    }
  }
  
  if (rows.length === 0) {
    return `<div style="color:var(--txt3);padding:10px">${t('limits.noHeaders', { status, error: errorMsg || t('common.none') })}</div>`;
  }
  
  return rows.join('');
}

function renderOpenRouterLimits(keyData, creditsData) {
  if (!keyData) return `<div style="color:var(--red);padding:10px">${t('limits.unavailable')}</div>`;
  
  const rows = [];
  
  // Credit info from /credits endpoint (if available)
  if (creditsData) {
    if (creditsData.total_credits !== undefined) {
      rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.credits.total')}</span><span class="limits-value">$${creditsData.total_credits?.toFixed(2) || '0'}</span></div>`);
    }
    if (creditsData.total_usage !== undefined) {
      rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.credits.used')}</span><span class="limits-value">$${creditsData.total_usage?.toFixed(2) || '0'}</span></div>`);
    }
    if (creditsData.total_credits !== undefined && creditsData.total_usage !== undefined) {
      const remaining = creditsData.total_credits - creditsData.total_usage;
      const cls = remaining > 1 ? 'ok' : remaining > 0.1 ? 'warn' : 'danger';
      rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.credits.remaining')}</span><span class="limits-value ${cls}">$${remaining?.toFixed(2) || '0'}</span></div>`);
    }
  }
  
  // Key usage info from /key endpoint
  if (keyData.usage !== undefined) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.usage.totalUsd')}</span><span class="limits-value">$${keyData.usage?.toFixed(4) || '0'}</span></div>`);
  }
  if (keyData.usage_daily !== undefined) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.usage.todayUsd')}</span><span class="limits-value">$${keyData.usage_daily?.toFixed(4) || '0'}</span></div>`);
  }
  if (keyData.usage_weekly !== undefined) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.usage.weekUsd')}</span><span class="limits-value">$${keyData.usage_weekly?.toFixed(4) || '0'}</span></div>`);
  }
  if (keyData.usage_monthly !== undefined) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.usage.monthUsd')}</span><span class="limits-value">$${keyData.usage_monthly?.toFixed(4) || '0'}</span></div>`);
  }
  if (keyData.limit !== undefined && keyData.limit > 0) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.limit')}</span><span class="limits-value">$${keyData.limit?.toFixed(2) || '0'}</span></div>`);
  }
  if (keyData.limit_remaining !== null && keyData.limit_remaining !== undefined && keyData.limit > 0) {
    const pct = Math.round((keyData.limit_remaining / keyData.limit) * 100);
    const cls = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'danger';
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.limit.remaining')}</span><span class="limits-value ${cls}">$${keyData.limit_remaining?.toFixed(2) || '0'} (${pct}%)</span></div>`);
  }
  if (keyData.is_free_tier !== undefined) {
    rows.push(`<div class="limits-row"><span class="limits-label">Free tier</span><span class="limits-value ${keyData.is_free_tier ? 'ok' : ''}">${keyData.is_free_tier ? '?' : '?'}</span></div>`);
  }
  if (keyData.label) {
    rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.key')}</span><span class="limits-value" style="font-size:10px">${keyData.label || '?'}</span></div>`);
  }
  const known = new Set(['usage', 'usage_daily', 'usage_weekly', 'usage_monthly', 'limit', 'limit_remaining', 'is_free_tier', 'label']);
  for (const [k, v] of Object.entries(keyData || {})) {
    if (known.has(k) || v == null || typeof v === 'object') continue;
    rows.push(`<div class="limits-row"><span class="limits-label">${escHtml(k)}</span><span class="limits-value">${escHtml(String(v))}</span></div>`);
  }
  if (rows.length === 0) return `<div style="color:var(--txt3);padding:10px">${t('limits.noneToShow')}</div>`;
  return rows.join('');
}

function getOpenRouterRateLimits(keyData) {
  // OpenRouter rate limits depend on whether user has credits
  const hasCredits = keyData?.usage !== undefined || keyData?.limit_remaining > 0;
  const hasPurchasedCredits = keyData?.is_free_tier === false || keyData?.limit > 0;
  
  // Free model limits (models ending with :free)
  const freeRpm = 20;
  const freeRpd = hasPurchasedCredits ? 500 : 200;
  
  // Paid models - no strict limits, depends on credits
  const rows = [];
  rows.push(`<div class="limits-row" style="margin-top:10px;border-top:1px solid var(--brd);padding-top:8px"><span class="limits-label" style="color:var(--acc)">${t('limits.rateLimits')}</span><span class="limits-value"></span></div>`);
  rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.freeModels.rpm')}</span><span class="limits-value">${freeRpm}</span></div>`);
  rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.freeModels.rpd')}</span><span class="limits-value">${freeRpd}</span></div>`);
  rows.push(`<div class="limits-row"><span class="limits-label">${t('limits.paidModels')}</span><span class="limits-value ok">${t('limits.unlimited')}</span></div>`);
  
  return rows.join('');
  }

  console.log('createLimitsApi: filterBadTranslations type:', typeof filterBadTranslations);

  return {
    showLimitsModal, closeLimitsModal,
    showHelpModal, closeHelpModal,
    showBadTranslationsModal, closeBadTranslationsModal, filterBadTranslations,
    fetchLimits,
  };
}

