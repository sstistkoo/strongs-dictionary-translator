export function createModelTestUiApi(deps) {
  const {
    state,
    t,
    PROVIDERS,
    MODEL_TEST_OUTPUT_KEY,
    MODEL_TEST_STATS_KEY,
    MODEL_TEST_PROMPT_TYPE_KEY,
    MODEL_TEST_PROMPT_COMPARE_TYPE_KEY,
    MODEL_TEST_PROMPT_COMPARE_ENABLE_KEY,
    MODEL_TEST_CUSTOM_PROMPT_KEY,
    MODEL_TEST_ENABLE_PROMPT_KEY,
    showToast,
    escHtml,
    formatAiResponseTime,
    populateModelTestModelSelect,
    saveModelTestModelSelections,
    updateModelTestProviderUi,
    isModelTestPromptEnabled,
    isModelTestPromptCompareEnabled,
    getModelTestPromptType,
    getModelTestPromptCompareType,
    getModelTestCustomPromptText,
    getModelTestPromptTemplate
  } = deps;

  function showModelTestModal(providerLabel, clearOutput = false) {
    const modal = document.getElementById('modelTestModal');
    const info = document.getElementById('modelTestInfo');
    const output = document.getElementById('modelTestOutput');
    const providerSelect = document.getElementById('modelTestProvider');
    const promptEnable = document.getElementById('modelTestEnablePrompt');
    const promptTypeSelect = document.getElementById('modelTestPromptType');
    const promptCompareEnable = document.getElementById('modelTestEnablePromptCompare');
    const promptCompareTypeSelect = document.getElementById('modelTestPromptTypeCompare');
    const customPromptInput = document.getElementById('modelTestCustomPromptInput');
    if (!modal || !info || !output || !providerSelect) return;
    providerSelect.innerHTML = [
      `<option value="parallel-3">${t('modelTest.provider.parallel3')}</option>`,
      ...Object.keys(PROVIDERS).map((k) => `<option value="${k}">${PROVIDERS[k].label}</option>`)
    ].join('');
    const currentProvider = document.getElementById('provider')?.value || 'groq';
    providerSelect.value = currentProvider;
    populateModelTestModelSelect('groq');
    populateModelTestModelSelect('gemini');
    populateModelTestModelSelect('openrouter');
    saveModelTestModelSelections();
    updateModelTestProviderUi();
    info.textContent = t('modelTest.providerInfo', { provider: providerLabel || '—' });
    if (clearOutput) {
      output.value = '';
      clearModelTestOutputFromStorage();
    } else if (!output.value.trim()) {
      const saved = loadModelTestOutputFromStorage();
      if (saved) output.value = saved;
    }
    if (promptEnable) promptEnable.checked = isModelTestPromptEnabled();
    if (promptTypeSelect) promptTypeSelect.value = getModelTestPromptType();
    if (promptCompareTypeSelect && promptTypeSelect) {
      promptCompareTypeSelect.innerHTML = promptTypeSelect.innerHTML;
      promptCompareTypeSelect.value = getModelTestPromptCompareType();
    }
    if (promptCompareEnable) promptCompareEnable.checked = isModelTestPromptCompareEnabled();
    if (customPromptInput) customPromptInput.value = getModelTestCustomPromptText();
    updateModelTestPromptUi();
    modal.classList.add('show');
    updateModelTestRunButton();
    renderModelStatsTable();
  }

  function updateModelTestPromptUi() {
    const promptEnable = document.getElementById('modelTestEnablePrompt');
    const promptTypeSelect = document.getElementById('modelTestPromptType');
    const promptCompareEnable = document.getElementById('modelTestEnablePromptCompare');
    const promptCompareTypeSelect = document.getElementById('modelTestPromptTypeCompare');
    const promptCompareRow = document.getElementById('modelTestPromptCompareRow');
    const customPromptRow = document.getElementById('modelTestCustomPromptRow');
    const enabled = !!promptEnable?.checked;
    if (promptTypeSelect) promptTypeSelect.disabled = !enabled;
    if (promptCompareEnable) promptCompareEnable.disabled = !enabled;
    const compareEnabled = enabled && !!promptCompareEnable?.checked;
    if (promptCompareTypeSelect) promptCompareTypeSelect.disabled = !compareEnabled;
    if (promptCompareRow) promptCompareRow.style.display = compareEnabled ? 'block' : 'none';
    const isCustom = enabled && (promptTypeSelect?.value || 'custom') === 'custom';
    if (customPromptRow) customPromptRow.style.display = isCustom ? 'block' : 'none';
  }

function saveModelTestPromptSettings() {
    const promptEnable = document.getElementById('modelTestEnablePrompt');
    const promptTypeSelect = document.getElementById('modelTestPromptType');
    const promptCompareEnable = document.getElementById('modelTestEnablePromptCompare');
    const promptCompareTypeSelect = document.getElementById('modelTestPromptTypeCompare');
    const customPromptInput = document.getElementById('modelTestCustomPromptInput');
    if (promptEnable) localStorage.setItem(MODEL_TEST_ENABLE_PROMPT_KEY, promptEnable.checked ? '1' : '0');
    if (promptTypeSelect) {
        const promptType = promptTypeSelect.value || 'preset_v12';
        localStorage.setItem(MODEL_TEST_PROMPT_TYPE_KEY, promptType);
        
        // Also update the main prompt used for translation
        const promptTemplate = getModelTestPromptTemplate(promptType);
        if (promptTemplate) {
            localStorage.setItem('strong_prompt', promptTemplate);
        }
    }
    if (promptCompareEnable) localStorage.setItem(MODEL_TEST_PROMPT_COMPARE_ENABLE_KEY, promptCompareEnable.checked ? '1' : '0');
    if (promptCompareTypeSelect) localStorage.setItem(MODEL_TEST_PROMPT_COMPARE_TYPE_KEY, promptCompareTypeSelect.value || 'preset_v12');
    if (customPromptInput) localStorage.setItem(MODEL_TEST_CUSTOM_PROMPT_KEY, customPromptInput.value || '');
}

  function closeModelTestModal() {
    if (state.modelTestRunning) {
      showToast(t('toast.test.cancelFirst'));
      return;
    }
    const modal = document.getElementById('modelTestModal');
    if (modal) modal.classList.remove('show');
  }

  function cancelModelTest() {
    if (!state.modelTestRunning) return;
    state.modelTestCancelRequested = true;
    if (state.modelTestAbortController) state.modelTestAbortController.abort();
    updateModelTestRunButton();
    showToast(t('toast.test.canceling'));
  }

  function modelTestClearCountdownInterval() {
    if (state.modelTestCountdownInterval) {
      clearInterval(state.modelTestCountdownInterval);
      state.modelTestCountdownInterval = null;
    }
  }

  function modelTestSetCountdownLabel(text) {
    const el = document.getElementById('modelTestCountdown');
    if (el) el.textContent = text || '';
  }

  function renderModelTestProviderCountdowns() {
    const labels = { groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter' };
    Object.keys(labels).forEach((prov) => {
      const el = document.getElementById(`modelTestCountdown_${prov}`);
      if (!el) return;
      const sec = Math.max(0, Math.ceil(Number(state.modelTestProviderEta[prov] || 0)));
      el.textContent = `${labels[prov]}: ${sec > 0 ? t('modelTest.countdown.nextIn', { seconds: sec }) : t('modelTest.countdown.ready')}`;
    });
  }

  function modelTestSetProviderEta(prov, sec) {
    if (!Object.prototype.hasOwnProperty.call(state.modelTestProviderEta, prov)) return;
    state.modelTestProviderEta[prov] = Math.max(0, Number(sec) || 0);
    renderModelTestProviderCountdowns();
  }

  function modelTestResetProviderEta() {
    state.modelTestProviderEta = { groq: 0, gemini: 0, openrouter: 0 };
    renderModelTestProviderCountdowns();
  }

  function modelTestStartProviderCountdownTicker() {
    if (state.modelTestProviderCountdownInterval) clearInterval(state.modelTestProviderCountdownInterval);
    state.modelTestProviderCountdownInterval = setInterval(renderModelTestProviderCountdowns, 500);
  }

  function modelTestStopProviderCountdownTicker() {
    if (state.modelTestProviderCountdownInterval) {
      clearInterval(state.modelTestProviderCountdownInterval);
      state.modelTestProviderCountdownInterval = null;
    }
  }

  function updateModelTestRunButton() {
    const buttons = ['btnRunModelTest', 'btnRunModelTestTop']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!buttons.length) return;
    const apply = (text, className) => {
      buttons.forEach((btn) => {
        btn.textContent = text;
        btn.className = className;
      });
    };
    if (state.modelTestRunning) {
      if (state.modelTestCancelRequested) {
        apply(t('modelTest.button.stopping'), 'modal-btn cancel');
        return;
      }
      const sec = Math.max(0, Math.ceil(Number(state.modelTestNextRequestEtaSec || 0)));
      apply(sec > 0 ? t('modelTest.button.runningWithSeconds', { seconds: sec }) : t('modelTest.button.running'), 'modal-btn cancel');
      return;
    }
    apply('▶ Test provideru', 'modal-btn ok');
  }

  function modelTestSetLastStatus(text, kind = 'idle') {
    const el = document.getElementById('modelTestLastStatus');
    if (!el) return;
    el.textContent = text || '';
    if (kind === 'error') el.style.color = '#d25f5f';
    else if (kind === 'ok') el.style.color = '#5a9a6c';
    else if (kind === 'warn') el.style.color = '#d8a85f';
    else el.style.color = 'var(--txt2)';
  }

  function saveModelTestOutputToStorage(text) {
    try { localStorage.setItem(MODEL_TEST_OUTPUT_KEY, String(text || '')); } catch {}
  }

  function loadModelTestOutputFromStorage() {
    try { return localStorage.getItem(MODEL_TEST_OUTPUT_KEY) || ''; } catch { return ''; }
  }

  function clearModelTestOutputFromStorage() {
    try { localStorage.removeItem(MODEL_TEST_OUTPUT_KEY); } catch {}
  }

  function getModelTestStatsMap() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MODEL_TEST_STATS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveModelTestStatsMap(map) {
    try { localStorage.setItem(MODEL_TEST_STATS_KEY, JSON.stringify(map || {})); } catch {}
  }

  function upsertModelTestStats(prov, model, payload) {
    const key = `${prov}::${model}`;
    const map = getModelTestStatsMap();
    const row = map[key] || {
      provider: prov, model, calls: 0, okBatches: 0, partialBatches: 0, errorBatches: 0, rateLimited: 0,
      okKeys: 0, failedKeys: 0, totalKeys: 0, latencyMsTotal: 0, latencySamples: 0, lastTs: 0
    };
    row.calls += 1;
    if (payload.status === 'OK') row.okBatches += 1;
    else if (payload.status === 'PARTIAL') row.partialBatches += 1;
    else if (payload.status === 'RATE_LIMITED') row.rateLimited += 1;
    else row.errorBatches += 1;
    row.okKeys += Math.max(0, payload.okKeys || 0);
    row.failedKeys += Math.max(0, payload.failedKeys || 0);
    row.totalKeys += Math.max(0, payload.totalKeys || (payload.okKeys || 0) + (payload.failedKeys || 0));
    if (Number.isFinite(payload.latencyMs) && payload.latencyMs > 0) {
      row.latencyMsTotal += payload.latencyMs;
      row.latencySamples += 1;
    }
    row.lastTs = Date.now();
    map[key] = row;
    saveModelTestStatsMap(map);
    renderModelStatsTable();
  }

  function deleteModelTestStatsRow(keyEncoded) {
    const key = decodeURIComponent(String(keyEncoded || ''));
    const map = getModelTestStatsMap();
    if (!map[key]) return;
    delete map[key];
    saveModelTestStatsMap(map);
    renderModelStatsTable();
  }

  function renderModelStatsTable() {
    const body = document.getElementById('modelStatsBody');
    if (!body) return;
    const rows = Object.entries(getModelTestStatsMap()).map(([key, row]) => ({ key, ...row }));
    rows.sort((a, b) => {
      const aTotal = Math.max(1, a.okKeys + a.failedKeys);
      const bTotal = Math.max(1, b.okKeys + b.failedKeys);
      const aRate = a.okKeys / aTotal;
      const bRate = b.okKeys / bTotal;
      if (bRate !== aRate) return bRate - aRate;
      const aLat = a.latencySamples ? a.latencyMsTotal / a.latencySamples : Number.POSITIVE_INFINITY;
      const bLat = b.latencySamples ? b.latencyMsTotal / b.latencySamples : Number.POSITIVE_INFINITY;
      if (aLat !== bLat) return aLat - bLat;
      return (b.calls || 0) - (a.calls || 0);
    });
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="7" style="padding:8px;color:var(--txt3)">${t('modelTest.table.noData')}</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((r) => {
      const total = Math.max(1, (r.okKeys || 0) + (r.failedKeys || 0));
      const rate = ((r.okKeys || 0) / total) * 100;
      const avgMs = r.latencySamples ? (r.latencyMsTotal / r.latencySamples) : 0;
      return `<tr>
      <td style="padding:6px;border-top:1px solid var(--brd)">${escHtml(r.provider)}<br><span style="color:var(--txt3)">${escHtml(r.model)}</span></td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right">${rate.toFixed(1)}%</td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right">${r.okKeys || 0}/${r.failedKeys || 0}</td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right">${r.totalKeys || 0}</td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right">${formatAiResponseTime(avgMs)}</td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right">${r.calls || 0}</td>
      <td style="padding:6px;border-top:1px solid var(--brd);text-align:right"><button class="modal-btn cancel" style="padding:4px 8px;font-size:10px" onclick="deleteModelTestStatsRow('${encodeURIComponent(r.key)}')">${t('common.delete')}</button></td>
    </tr>`;
    }).join('');
  }

  return {
    showModelTestModal,
    updateModelTestPromptUi,
    saveModelTestPromptSettings,
    closeModelTestModal,
    cancelModelTest,
    modelTestClearCountdownInterval,
    modelTestSetCountdownLabel,
    modelTestSetProviderEta,
    modelTestResetProviderEta,
    modelTestStartProviderCountdownTicker,
    modelTestStopProviderCountdownTicker,
    updateModelTestRunButton,
    modelTestSetLastStatus,
    saveModelTestOutputToStorage,
    loadModelTestOutputFromStorage,
    clearModelTestOutputFromStorage,
    getModelTestStatsMap,
    saveModelTestStatsMap,
    upsertModelTestStats,
    deleteModelTestStatsRow,
    renderModelStatsTable
  };
}

export function createModelTestRunnerApi(deps) {
  const {
    state,
    t,
    getUiLang,
    PROVIDERS,
    showToast,
    log,
    logTokenEntry,
    formatAiResponseTime,
    getModelTestPromptType,
    getModelTestPromptCompareType,
    getModelTestPromptTypeLabel,
    getModelTestPromptTopicLabel,
    getApiKeyForModelTest,
    getModelTestSelectedModelForProvider,
    modelTestWaitWithCountdown,
    modelTestSetProviderEta,
    modelTestStartProviderCountdownTicker,
    modelTestStopProviderCountdownTicker,
    modelTestResetProviderEta,
    modelTestSetLastStatus,
    updateModelTestRunButton,
    modelTestSetCountdownLabel,
    modelTestClearCountdownInterval,
    saveModelTestOutputToStorage,
    saveModelTestRawOutputToStorage,
    clearModelTestRawOutputFromStorage,
    upsertModelTestStats,
    showModelTestModal,
    updateModelTestProviderUi,
    pushTestHistory,
    appendModelTestLastBatchKeyAudit,
    buildModelTestMessages,
    parseWithOpenRouterNormalization,
    applyFallbacksToParsedMap,
    isTranslationComplete,
    isDefinitionLikelyEnglish,
    callOnce
  } = deps;

  function getSampleEntriesForModelTest(count = 3) {
    if (!Array.isArray(state.entries) || state.entries.length === 0) return [];
    const preferred = state.entries.filter((e) => e?.key && /^[GH]\d+$/.test(e.key)).slice(0, count);
    if (preferred.length >= count) return preferred;
    return state.entries.slice(0, count).filter(Boolean);
  }

  function resetModelTestRateLimitHealth() {
    state.modelTestRateLimitHealth = { hits429: 0, lastRetryAfterSec: 0, lastRequestId: '', lastRemaining: '', lastReset: '' };
  }

  function updateModelTestRateLimitHealth(rate) {
    if (!rate || typeof rate !== 'object') return;
    if (rate.requestId) state.modelTestRateLimitHealth.lastRequestId = String(rate.requestId);
    if (rate.remaining !== undefined && rate.remaining !== null && rate.remaining !== '') state.modelTestRateLimitHealth.lastRemaining = String(rate.remaining);
    if (rate.reset !== undefined && rate.reset !== null && rate.reset !== '') state.modelTestRateLimitHealth.lastReset = String(rate.reset);
    if (rate.retryAfterSec !== undefined && rate.retryAfterSec !== null && rate.retryAfterSec !== '') state.modelTestRateLimitHealth.lastRetryAfterSec = Number(rate.retryAfterSec) || 0;
    if (rate.is429) state.modelTestRateLimitHealth.hits429 += 1;
  }

  function appendModelTestRateLimitStatus(appendReport) {
    if (typeof appendReport !== 'function') return;
    const h = state.modelTestRateLimitHealth || {};
    appendReport(`Rate limit stav: 429=${h.hits429 || 0} | retry-after=${h.lastRetryAfterSec || 0}s | remaining=${h.lastRemaining || 'n/a'} | reset=${h.lastReset || 'n/a'}${h.lastRequestId ? ` | req=${h.lastRequestId}` : ''}`);
  }

  function getUsageTotals(raw) {
    const usage = raw?.usage || raw?.usageMetadata;
    if (!usage || typeof usage !== 'object') return null;
    const inT = Number(usage.prompt_tokens || usage.promptTokenCount || usage.input_tokens || 0) || 0;
    const outT = Number(usage.completion_tokens || usage.candidatesTokenCount || usage.output_tokens || 0) || 0;
    const total = Number(usage.total_tokens || usage.totalTokenCount || usage.total || (inT + outT)) || (inT + outT);
    return { inT, outT, total };
  }

  function appendModelTestUsage(appendReport, provider, model, raw) {
    if (typeof appendReport !== 'function') return;
    const totals = getUsageTotals(raw);
    if (!totals) {
      appendReport(`Tokeny: ${provider} | ${model} | n/a`);
      return;
    }
    appendReport(`Tokeny: ${provider} | ${model} | ${totals.inT} in / ${totals.outT} out = ${totals.total}`);
    logTokenEntry(provider, totals.inT, totals.outT, totals.total);
  }

  function rateInfoFromErrorMessage(msg) {
    const text = String(msg || '');
    const retry = text.match(/za\s+(\d+)s/i);
    const req = text.match(/\[req:([^\]]+)\]/i);
    return { is429: /rate limit|429|too many/i.test(text), retryAfterSec: retry ? Number(retry[1]) : 0, requestId: req ? req[1] : '' };
  }

  function appendModelTestFinalOverview(appendReport, testResults, testMode, extra = {}) {
    if (typeof appendReport !== 'function') return;
    const rows = Array.isArray(testResults) ? testResults : [];
    const countBy = (status) => rows.filter((r) => r.status === status).length;
    const ok = countBy('OK');
    const okRetry = countBy('OK_RETRY');
    const partial = countBy('PARTIAL');
    const rateLimited = countBy('RATE_LIMITED');
    const error = countBy('ERROR');
    const total = rows.length;
    const done = ok + okRetry + partial;
    const successPct = total > 0 ? Math.round((done / total) * 100) : 0;
    appendReport('');
    appendReport(t('modelTest.final.header'));
    appendReport(t('modelTest.final.resultsLine', { ok, okRetry, partial, rateLimited, error, total }));
    appendReport(t('modelTest.final.successRateLine', { successPct }));
    if (testMode === 'auto-live') {
      appendReport(t('modelTest.final.entriesLine', {
        ok: extra.okKeys || 0,
        fail: extra.failedKeys || 0,
        cycles: extra.cycles || 0,
        avgAi: extra.avgLatencyMs ? ` | ${t('modelTest.final.avgAi')}: ${formatAiResponseTime(extra.avgLatencyMs)}` : ''
      }));
    }
  }

  function getModelTestSuccessRatePercent(results) {
    const rows = Array.isArray(results) ? results : [];
    if (!rows.length) return 0;
    const success = rows.filter((r) => r.status === 'OK' || r.status === 'OK_RETRY' || r.status === 'PARTIAL').length;
    return Math.round((success / rows.length) * 100);
  }

  function appendPromptCompareSummary(appendReport, promptA, promptB, statsA, statsB, resultsA, resultsB) {
    const failA = Number(statsA?.failedKeys || 0);
    const failB = Number(statsB?.failedKeys || 0);
    const succA = getModelTestSuccessRatePercent(resultsA);
    const succB = getModelTestSuccessRatePercent(resultsB);
    const latA = Number(statsA?.avgLatencyMs || 0);
    const latB = Number(statsB?.avgLatencyMs || 0);
    let winner = t('modelTest.compare.tie');
    if (failA < failB) winner = `A (${getModelTestPromptTypeLabel(promptA)})`;
    else if (failB < failA) winner = `B (${getModelTestPromptTypeLabel(promptB)})`;
    else if (succA > succB) winner = `A (${getModelTestPromptTypeLabel(promptA)})`;
    else if (succB > succA) winner = `B (${getModelTestPromptTypeLabel(promptB)})`;
    else if (latA > 0 && latB > 0 && latA < latB) winner = `A (${getModelTestPromptTypeLabel(promptA)})`;
    else if (latA > 0 && latB > 0 && latB < latA) winner = `B (${getModelTestPromptTypeLabel(promptB)})`;

    appendReport('');
    appendReport(t('modelTest.compare.header'));
    appendReport(`A: ${getModelTestPromptTypeLabel(promptA)} | hesla OK ${statsA?.okKeys || 0} / NEÚSP ${failA} | model úspěšnost ${succA}% | prům. AI ${formatAiResponseTime(latA)}`);
    appendReport(`B: ${getModelTestPromptTypeLabel(promptB)} | hesla OK ${statsB?.okKeys || 0} / NEÚSP ${failB} | model úspěšnost ${succB}% | prům. AI ${formatAiResponseTime(latB)}`);
    appendReport(t('modelTest.compare.winner', { winner }));
  }

  async function runAutoLiveModelTest(appendReport, waitMs, testResults, abortSignal, fixedProvider = null, promptType = 'custom', promptEnabled = true, fixedCyclesPerWorker = null) {
    const durationInput = document.getElementById('modelTestDurationMin');
    const durationMin = Math.max(1, parseInt(durationInput?.value || '10', 10) || 10);
    const durationMs = durationMin * 60 * 1000;
    const batchSize = parseInt(document.getElementById('batchSizeRun')?.value || '10', 10) || 10;
    const intervalSec = parseInt(document.getElementById('intervalRun')?.value || '20', 10) || 20;
    const startTs = Date.now();
    state.modelTestRunEndTs = startTs + durationMs;
    let cycle = 0;
    let totalOkKeys = 0;
    let totalFailedKeys = 0;
    let latencyMsTotal = 0;
    let latencySamples = 0;
    const sourceEntries = state.entries.filter((e) => e && e.key);
    if (sourceEntries.length < batchSize) return { cycles: 0, okKeys: 0, failedKeys: 0 };

    const providerKeys = fixedProvider ? [fixedProvider] : ['groq', 'gemini', 'openrouter'];
    const modelQueue = providerKeys.map((prov) => {
      const model = getModelTestSelectedModelForProvider(prov);
      return model ? { prov, model, label: model } : null;
    }).filter(Boolean).filter((item) => !!getApiKeyForModelTest(item.prov));
    if (!modelQueue.length) return { cycles: 0, okKeys: 0, failedKeys: 0 };

    modelTestStartProviderCountdownTicker();
    const waitProviderMs = (prov, ms) => new Promise((resolve) => {
      if (ms <= 0 || state.modelTestCancelRequested || abortSignal?.aborted) { modelTestSetProviderEta(prov, 0); resolve(); return; }
      const t0 = Date.now();
      const tick = () => {
        if (state.modelTestCancelRequested || abortSignal?.aborted) { modelTestSetProviderEta(prov, 0); resolve(); return; }
        const left = ms - (Date.now() - t0);
        if (left <= 0) { modelTestSetProviderEta(prov, 0); resolve(); return; }
        modelTestSetProviderEta(prov, Math.ceil(left / 1000));
        setTimeout(tick, 300);
      };
      tick();
    });

    const workers = modelQueue.map((current, workerIdx) => (async () => {
      let localCursor = (workerIdx * 17) % sourceEntries.length;
      let localCycle = 0;
      const apiKey = getApiKeyForModelTest(current.prov);
      if (!apiKey) return;
      while (!state.modelTestCancelRequested
        && (Date.now() - startTs) < durationMs
        && (!Number.isFinite(fixedCyclesPerWorker) || fixedCyclesPerWorker <= 0 || localCycle < fixedCyclesPerWorker)) {
        localCycle++;
        cycle++;
        const takeSize = Math.max(1, Math.min(batchSize, sourceEntries.length));
        const batch = [];
        for (let i = 0; i < takeSize; i++) batch.push(sourceEntries[(localCursor + i) % sourceEntries.length]);
        localCursor = (localCursor + (takeSize * 2)) % sourceEntries.length;
        const batchKeys = batch.map((b) => b.key);
        const messages = buildModelTestMessages(batch, 'auto-live', promptType, promptEnabled);
        const reqStart = performance.now();
        try {
          const raw = await callOnce(current.prov, apiKey, current.model, messages, abortSignal);
          const reqMs = performance.now() - reqStart;
          latencyMsTotal += reqMs;
          latencySamples += 1;
          updateModelTestRateLimitHealth(raw?.rateInfo);
          appendModelTestUsage(appendReport, current.prov, current.model, raw);
          let content = String(raw?.content || '');
          state.modelTestRawResponses.push({ ts: Date.now(), prov: current.prov, model: current.model, mode: 'auto-live', promptType, promptEnabled, promptSent: String(messages?.[1]?.content || ''), raw: content });
          saveModelTestRawOutputToStorage();
          let parsed = {};
          parseWithOpenRouterNormalization(content, batchKeys, parsed);
          applyFallbacksToParsedMap(batchKeys, parsed);
          let failedInBatch = batchKeys.filter((k) => !parsed[k] || !isTranslationComplete(parsed[k]));
          const ok = batchKeys.length - failedInBatch.length;
          const status = ok === batchKeys.length ? 'OK' : 'PARTIAL';
          totalOkKeys += ok;
          totalFailedKeys += failedInBatch.length;
          testResults.push({ model: `${current.prov}:${current.model}`, status });
          upsertModelTestStats(current.prov, current.model, { status, okKeys: ok, failedKeys: failedInBatch.length, totalKeys: batchKeys.length, latencyMs: reqMs });
          appendModelTestLastBatchKeyAudit(appendReport, batchKeys, parsed, failedInBatch, content, { okKeys: totalOkKeys, failedKeys: totalFailedKeys });
        } catch (e) {
          const reqMs = performance.now() - reqStart;
          latencyMsTotal += reqMs;
          latencySamples += 1;
          const msg = String(e?.message || '');
          const isRate = /429|rate limit|too many/i.test(msg);
          updateModelTestRateLimitHealth(rateInfoFromErrorMessage(msg));
          totalFailedKeys += batchKeys.length;
          testResults.push({ model: `${current.prov}:${current.model}`, status: isRate ? 'RATE_LIMITED' : 'ERROR' });
          upsertModelTestStats(current.prov, current.model, { status: isRate ? 'RATE_LIMITED' : 'ERROR', okKeys: 0, failedKeys: batchKeys.length, totalKeys: batchKeys.length, latencyMs: reqMs });
        }
        if (state.modelTestCancelRequested) break;
        await waitProviderMs(current.prov, intervalSec * 1000);
      }
    })());
    await Promise.all(workers);
    modelTestStopProviderCountdownTicker();
    modelTestResetProviderEta();
    return { cycles: cycle, okKeys: totalOkKeys, failedKeys: totalFailedKeys, avgLatencyMs: latencySamples ? (latencyMsTotal / latencySamples) : 0 };
  }

  async function testCurrentProviderModels(forcedProvider = null, resetReport = true, forcedMode = null, forcedPromptType = null, forcedPromptEnabled = null) {
    if (state.autoRunning || state.autoStepRunning) { showToast(t('toast.auto.stopFirst')); return; }
    const providerSelect = document.getElementById('provider');
    const btn = document.getElementById('btnTestModels');
    if (!providerSelect || !btn) return;
    const modalProviderSelect = document.getElementById('modelTestProvider');
    const appendCheckbox = document.getElementById('modelTestAppend');
    const modeSelect = document.getElementById('modelTestMode');
    const promptEnableEl = document.getElementById('modelTestEnablePrompt');
    const promptTypeSelect = document.getElementById('modelTestPromptType');
    const promptCompareEnableEl = document.getElementById('modelTestEnablePromptCompare');
    const promptTypeCompareSelect = document.getElementById('modelTestPromptTypeCompare');
    const providerMode = forcedProvider || modalProviderSelect?.value || providerSelect.value;
    const fallbackProvider = providerSelect.value || 'groq';
    const prov = providerMode === 'parallel-3' ? fallbackProvider : providerMode;
    const testMode = forcedMode || modeSelect?.value || 'smoke';
    const promptEnabled = typeof forcedPromptEnabled === 'boolean' ? forcedPromptEnabled : !!promptEnableEl?.checked;
    const promptType = forcedPromptType || promptTypeSelect?.value || getModelTestPromptType();
    const compareEnabled = !!promptEnabled && testMode === 'auto-live' && !!promptCompareEnableEl?.checked;
    const comparePromptType = promptTypeCompareSelect?.value || getModelTestPromptCompareType();
    const providerTargets = providerMode === 'parallel-3' ? ['groq', 'gemini', 'openrouter'] : [prov];
    const executionQueue = [];
    if (testMode !== 'auto-live') {
      for (const currentProv of providerTargets) {
        const apiKey = getApiKeyForModelTest(currentProv);
        if (!apiKey) continue;
        const selectedModel = getModelTestSelectedModelForProvider(currentProv);
        if (!selectedModel) continue;
        executionQueue.push({ prov: currentProv, apiKey, opt: { value: selectedModel, label: selectedModel } });
      }
      if (!executionQueue.length) return;
    }
    const providerLabel = forcedProvider
      ? (PROVIDERS[prov]?.label || prov)
      : ((modalProviderSelect?.value === 'parallel-3') ? t('modelTest.provider.parallel3') : (PROVIDERS[prov]?.label || prov));
    const outputEl = document.getElementById('modelTestOutput');
    const shouldAppend = appendCheckbox?.checked && !resetReport;
    const snapshotBefore = outputEl ? outputEl.value : '';
    const report = shouldAppend && snapshotBefore ? snapshotBefore.split('\n') : [];
    showModelTestModal(providerLabel, false);
    if (modalProviderSelect) { modalProviderSelect.value = providerMode === 'parallel-3' ? 'parallel-3' : prov; updateModelTestProviderUi(); }
    if (!outputEl) return;
    outputEl.value = shouldAppend ? snapshotBefore : '';
    const MODEL_TEST_DELAY_MS = 3500;
    const MAX_CONSECUTIVE_RATE_LIMITS = 4;
    let consecutiveRateLimited = 0;
    const testResults = [];
    const appendReport = (line = '') => {
      report.push(line);
      const nextText = report.join('\n');
      outputEl.value = nextText;
      outputEl.scrollTop = outputEl.scrollHeight;
      saveModelTestOutputToStorage(nextText);
    };
    const originalText = btn.textContent;
    const cancelBtn = document.getElementById('btnCancelModelTest');
    state.modelTestRunning = true;
    state.modelTestCancelRequested = false;
    state.modelTestRunEndTs = 0;
    state.modelTestParsedExportChunks = [];
    state.modelTestLastKeyAuditExportChunks = [];
    state.modelTestRawResponses = [];
    resetModelTestRateLimitHealth();
    clearModelTestRawOutputFromStorage();
    modelTestSetLastStatus(t('modelTest.status.running'), 'idle');
    state.modelTestAbortController = new AbortController();
    const signal = state.modelTestAbortController.signal;
    const waitMs = (ms) => modelTestWaitWithCountdown(ms, signal);
    state.modelTestNextRequestEtaSec = 0;
    updateModelTestRunButton();
    btn.disabled = true;
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    try {
      const sampleCount = testMode === 'translate1' ? 1 : testMode === 'translate3' ? 3 : 0;
      const sampleEntries = sampleCount ? getSampleEntriesForModelTest(sampleCount) : [];
      const sampleKeys = sampleEntries.map((e) => e.key);

      if (testMode === 'auto-live') {
        if (compareEnabled && comparePromptType && comparePromptType !== promptType) {
          const testResultsA = [];
          const testResultsB = [];
          const autoStatsA = await runAutoLiveModelTest(appendReport, waitMs, testResultsA, state.modelTestAbortController.signal, forcedProvider ? prov : null, promptType, true, 3);
          const autoStatsB = await runAutoLiveModelTest(appendReport, waitMs, testResultsB, state.modelTestAbortController.signal, forcedProvider ? prov : null, comparePromptType, true, 3);
          appendModelTestFinalOverview(appendReport, testResultsA, testMode, autoStatsA);
          appendModelTestFinalOverview(appendReport, testResultsB, testMode, autoStatsB);
          appendPromptCompareSummary(appendReport, promptType, comparePromptType, autoStatsA, autoStatsB, testResultsA, testResultsB);
        } else {
          const autoStats = await runAutoLiveModelTest(appendReport, waitMs, testResults, state.modelTestAbortController.signal, forcedProvider ? prov : null, promptType, promptEnabled);
          appendModelTestFinalOverview(appendReport, testResults, testMode, autoStats);
        }
      } else {
        if ((testMode === 'translate3' || testMode === 'translate1') && sampleEntries.length < sampleCount) return;
        for (let i = 0; i < executionQueue.length; i++) {
          if (state.modelTestCancelRequested) break;
          const current = executionQueue[i];
          const messages = buildModelTestMessages(sampleEntries, testMode, promptType, promptEnabled);
          try {
            const first = await callOnce(current.prov, current.apiKey, current.opt.value, messages, state.modelTestAbortController.signal);
            updateModelTestRateLimitHealth(first?.rateInfo);
            appendModelTestUsage(appendReport, current.prov, current.opt.value, first);
            const firstContent = String(first?.content || '').trim();
            if (testMode === 'translate3' || testMode === 'translate1') {
              const parsed = {};
              parseWithOpenRouterNormalization(firstContent || '', sampleKeys, parsed);
              applyFallbacksToParsedMap(sampleKeys, parsed);
              const missingAfterFirst = sampleKeys.filter((k) => !parsed[k] || !isTranslationComplete(parsed[k]));
              const okCount = sampleKeys.length - missingAfterFirst.length;
              appendModelTestLastBatchKeyAudit(appendReport, sampleKeys, parsed, missingAfterFirst, firstContent || '');
              testResults.push({ model: `${current.prov}:${current.opt.value}`, status: okCount === sampleKeys.length ? 'OK' : 'PARTIAL' });
              consecutiveRateLimited = 0;
              if (!state.modelTestCancelRequested) await waitMs(MODEL_TEST_DELAY_MS);
              continue;
            }
            if (state.modelTestCancelRequested) break;
            await waitMs(MODEL_TEST_DELAY_MS);
            const second = await callOnce(current.prov, current.apiKey, current.opt.value, messages, state.modelTestAbortController.signal);
            updateModelTestRateLimitHealth(second?.rateInfo);
            appendModelTestUsage(appendReport, current.prov, current.opt.value, second);
            testResults.push({ model: `${current.prov}:${current.opt.value}`, status: 'OK' });
            consecutiveRateLimited = 0;
          } catch (e) {
            const msg = String(e?.message || '');
            const isRateLimit = /429|rate limit|too many/i.test(msg);
            updateModelTestRateLimitHealth(rateInfoFromErrorMessage(msg));
            if (isRateLimit) {
              await waitMs(MODEL_TEST_DELAY_MS);
              try {
                const retry = await callOnce(current.prov, current.apiKey, current.opt.value, messages, state.modelTestAbortController.signal);
                updateModelTestRateLimitHealth(retry?.rateInfo);
                appendModelTestUsage(appendReport, current.prov, current.opt.value, retry);
                testResults.push({ model: `${current.prov}:${current.opt.value}`, status: 'OK_RETRY' });
                consecutiveRateLimited = 0;
              } catch {
                consecutiveRateLimited++;
                testResults.push({ model: `${current.prov}:${current.opt.value}`, status: 'RATE_LIMITED' });
              }
            } else {
              consecutiveRateLimited = 0;
              testResults.push({ model: `${current.prov}:${current.opt.value}`, status: 'ERROR' });
            }
          }
          if (consecutiveRateLimited >= MAX_CONSECUTIVE_RATE_LIMITS) break;
          if (!state.modelTestCancelRequested) await waitMs(MODEL_TEST_DELAY_MS);
        }
        appendModelTestFinalOverview(appendReport, testResults, testMode);
      }
    } finally {
      modelTestClearCountdownInterval();
      modelTestStopProviderCountdownTicker();
      modelTestResetProviderEta();
      state.modelTestNextRequestEtaSec = 0;
      state.modelTestRunEndTs = 0;
      modelTestSetCountdownLabel('');
      if (state.modelTestCancelRequested) modelTestSetLastStatus(t('modelTest.status.stoppedByUser'), 'warn');
      state.modelTestRunning = false;
      state.modelTestCancelRequested = false;
      state.modelTestAbortController = null;
      updateModelTestRunButton();
      btn.disabled = false;
      btn.textContent = originalText;
      if (cancelBtn) cancelBtn.style.display = 'none';
      pushTestHistory({
        type: 'model-test',
        provider: providerLabel,
        mode: testMode,
        total: testResults.length,
        ok: testResults.filter((r) => r.status === 'OK' || r.status === 'OK_RETRY').length,
        rateLimited: testResults.filter((r) => r.status === 'RATE_LIMITED').length,
        error: testResults.filter((r) => r.status === 'ERROR').length,
        partial: testResults.filter((r) => r.status === 'PARTIAL').length
      });
      showToast(state.modelTestCancelRequested ? t('toast.modelTest.canceled') : t('toast.modelTest.doneWithCount', { count: Math.max(1, testResults.length) }));
    }
  }

  return {
    getSampleEntriesForModelTest,
    resetModelTestRateLimitHealth,
    updateModelTestRateLimitHealth,
    appendModelTestRateLimitStatus,
    getUsageTotals,
    appendModelTestUsage,
    rateInfoFromErrorMessage,
    appendModelTestFinalOverview,
    getModelTestSuccessRatePercent,
    appendPromptCompareSummary,
    runAutoLiveModelTest,
    testCurrentProviderModels
  };
}
