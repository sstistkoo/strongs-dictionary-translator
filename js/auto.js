import { state } from './state.js';
import { t } from './i18n.js';
import { PROVIDERS, AUTO_PROVIDER_ENABLED_KEY, PIPELINE_SECONDARY_ENABLED_KEY } from './config.js';
import { safeSetLocalStorage, safeRemoveLocalStorage } from './storage.js';

export function createAutoApi(deps) {

  const {
    state,
    t,
    getUiLang,
    PROVIDERS,
    AUTO_PROVIDER_ENABLED_KEY,
    AUTO_TOKEN_LIMIT_KEY,
    PIPELINE_SECONDARY_ENABLED_KEY,
    setPipelineSecondaryEnabled,
    syncSecondaryProviderToggles,
    getSecondaryNextOperationState,
    stopElapsedTimer,
    showToast,
    log,
    getNextBatch,
    updateETA,
    translateBatch,
    translateBatchForProvider,
    getCurrentApiKey,
    getPipelineModelForProvider,
    startElapsedTimer,
    updateStats,
    renderList,
    renderDetail
  } = deps;

  function toggleAuto() {
    if (state.autoRunning) {
      stopAuto();
      return;
    }
    startAuto();
  }

  function startAuto() {
    if (state.autoSeqRunning) {
      showToast('Nejdřív zastav postupný překlad (↻ Postupně)');
      return;
    }
    state.autoRunning = true;
    document.getElementById('btnAuto')?.classList.add('active');
    const btnAuto = document.getElementById('btnAuto');
    if (btnAuto) btnAuto.textContent = t('auto.button.stop');
    document.getElementById('autoPanel')?.classList.add('show');
    const autoInterval = document.getElementById('autoInterval');
    if (autoInterval) autoInterval.textContent = String(state.currentInterval);
    startAutoProviderCountdownTicker();
    if (isAutoTokenLimitReached()) {
      stopAuto();
      showToast(t('toast.auto.notStartedTokenLimit'));
      return;
    }
    // Spustit až po malém zpoždění, aby UI mohlo aktualizovat
    setTimeout(() => {
      if (state.autoRunning && !state.autoStepRunning) {
        runAutoStep();
      }
    }, 50);
  }

   function stopAuto() {
     state.autoRunning = false;
     state.autoSeqRunning = false; // zastavit i sequential mód
     state.autoStepRunning = false; // ← přidáno
     state.sideFallbackAbortVersion++;
     clearTimeout(state.autoTimer);
     clearInterval(state.autoCountTimer);
     document.getElementById('btnAuto')?.classList.remove('active');
     const btnAuto = document.getElementById('btnAuto');
     if (btnAuto) btnAuto.textContent = t('auto.button.start');
     if (window.innerWidth <= 600) {
       document.getElementById('autoPanel')?.classList.remove('show');
     }
     const countdown = document.getElementById('countdown');
     if (countdown) countdown.textContent = '—';
     // Resetovat i sequential tlačítko pokud bylo aktivní
     const btnAutoSeq = document.getElementById('btnAutoSeq');
     if (btnAutoSeq) btnAutoSeq.textContent = '↻ Postupně';
     updateAutoProviderCountdowns();
     stopElapsedTimer();
   }

  const PROVIDER_LABELS = { groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter' };

  function setAutoProviderCountdownLabel(prov, text) {
    const el = document.getElementById('autoCountdown_' + prov);
    if (el) el.textContent = text;
  }

  function setProviderStatus(prov, suffix) {
    const label = PROVIDER_LABELS[prov] || prov;
    setAutoProviderCountdownLabel(prov, label + ': ' + suffix);
  }

  function isAutoProviderEnabled(prov) {
    if (prov === 'gemini' || prov === 'openrouter') {
      const raw = localStorage.getItem(PIPELINE_SECONDARY_ENABLED_KEY + prov);
      if (raw === null) return true;
      return raw === '1';
    }
    const raw = localStorage.getItem(AUTO_PROVIDER_ENABLED_KEY + prov);
    if (raw === null) return true;
    return raw === '1';
  }

  function setAutoProviderEnabled(prov, enabled) {
    const on = !!enabled;
    if (prov === 'gemini' || prov === 'openrouter') {
      // Pro secondary providera použijeme pipeline funkci, která je async?
      // Ale tady potřebujeme sync. Zkompilujeme to špatně.
      // Musíme použít stejný mechanismus jako pro primary (localStorage).
      // Projedeme se: secondary toggle je malá hodnota, můžeme použít localStorage přímo.
      localStorage.setItem(PIPELINE_SECONDARY_ENABLED_KEY + prov, on ? '1' : '0');
      // Nebo volání setPipelineSecondaryEnabled? To je async a jsme v sync kontextu.
      // Zvolíme: použijeme localStorage přímo prosecondary, konzistence s primary.
      return;
    }
    localStorage.setItem(AUTO_PROVIDER_ENABLED_KEY + prov, on ? '1' : '0');
  }

  function initAutoProviderToggles() {
    ['groq', 'gemini', 'openrouter'].forEach((prov) => {
      const cb = document.getElementById(`autoEnable_${prov}`);
      if (!cb) return;
      cb.checked = isAutoProviderEnabled(prov);
      cb.onchange = () => {
        setAutoProviderEnabled(prov, cb.checked);
        updateAutoProviderCountdowns();
      };
    });
  }

  function updateAutoProviderCountdowns() {
    // Když běží AUTO nebo sequential, workeři si spravují labely sami —
    // ticker přepisuje jen zakázané nebo failed providery, ostatní nechá být.
    const isRunning = state.autoRunning || state.autoSeqRunning;

    ['groq', 'gemini', 'openrouter'].forEach((prov) => {
      const label = PROVIDER_LABELS[prov] || prov;

      // Failed badge — vždy přepsat
      if (Date.now() < Number(state.providerFailBadgeUntil?.[prov] || 0)) {
        setAutoProviderCountdownLabel(prov, t('provider.status.failed', { label }));
        return;
      }
      // Zakázaný — vždy přepsat
      if (!isAutoProviderEnabled(prov)) {
        setAutoProviderCountdownLabel(prov, t('provider.status.disabled', { label }));
        return;
      }
      // Běží — workeři si píšou sami, ticker nepřepisuje
      if (isRunning) return;

      // Klidový stav — zobraz připraven
      setAutoProviderCountdownLabel(prov, t('provider.status.ready', { label }));
    });
  }

  function startAutoProviderCountdownTicker() {
    stopAutoProviderCountdownTicker();
    updateAutoProviderCountdowns();
    state.autoProviderCountdownTimer = setInterval(updateAutoProviderCountdowns, 500);
  }

  function stopAutoProviderCountdownTicker() {
    clearInterval(state.autoProviderCountdownTimer);
    state.autoProviderCountdownTimer = null;
  }

  // ── POMOCNÉ: Zjistí aktivní providery s klíčem ──────────────────────────────
  function getActiveParallelProviders() {
    const all = ['groq', 'gemini', 'openrouter'];
    return all.filter(prov => {
      if (!isAutoProviderEnabled(prov)) return false;
      const key = getCurrentApiKey(prov);
      return key && key.trim().length > 0;
    });
  }

  async function runAutoStep() {
    if (!state.autoRunning || state.autoStepRunning) return;
    state.autoStepRunning = true;

    try {
      if (isAutoTokenLimitReached()) {
        stopAuto();
        log(t('auto.log.stoppedTokenLimit'));
        showToast(t('toast.auto.stoppedTokenLimit'));
        return;
      }

      const activeProviders = getActiveParallelProviders();
      if (!activeProviders.length) {
        stopAuto();
        log(t('auto.log.stoppedGroqDisabled'));
        const groqHint = t('auto.groqEnableHint');
        const autoLogEl = document.getElementById('autoLog');
        if (autoLogEl) autoLogEl.textContent = groqHint;
        showToast(t('toast.auto.enableGroq'));
        return;
      }

      const check = getNextBatch(1);
      if (!check.length) {
        stopAuto();
        showToast(t('toast.translation.done'));
        return;
      }

      const batchSize = Math.max(1, Number(state.currentBatchSize) || 5);
      const intervalMs = Math.max(1000, (Number(state.currentInterval) || 20) * 1000);

      // Elapsed timer
      if (!state.startTime) {
        state.startTime = Date.now();
        startElapsedTimer();
      }

      // Reset počítadel requestů při novém kole překladu
      if (typeof window !== 'undefined' && window.resetProviderReqCounts) {
        window.resetProviderReqCounts();
      }

      log('Paralelní překlad: ' + activeProviders.join(', ') + ' (dávka ' + batchSize + ')');
      updateETA();

      // Každý provider je samostatný worker — bere dávky nezávisle dokud jsou hesla.
      // Sdílená atomická zámka: JS single-thread zaručuje že getNextBatch+_processing
      // proběhne celé bez přerušení (žádný await uvnitř).
      const FALLBACK_MODELS = {
        groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
        gemini: 'gemini-2.0-flash-lite',
        openrouter: 'openrouter/rotate'  // použít rotaci zaškrtnutých modelů
      };

      async function runProviderWorkerAtomic(prov) {
        const apiKey = getCurrentApiKey(prov);
        const model = getPipelineModelForProvider(prov) || FALLBACK_MODELS[prov];
        if (!apiKey) {
          log('[' + (PROVIDER_LABELS[prov]||prov) + '] chybí API klíč, worker se nespustí');
          return;
        }
        if (!model) {
          log('[' + (PROVIDER_LABELS[prov]||prov) + '] chybí model, worker se nespustí');
          return;
        }

        // Per-provider nastavení — fallback na globální hodnoty
        const provLimits = (typeof window !== 'undefined' && window.getProviderLimits) ? window.getProviderLimits() : {};
        const provBatchRaw = provLimits[prov]?.batchSize;
        const effectiveBatchSize = (provBatchRaw && Number(provBatchRaw) > 0) ? Math.max(1, Number(provBatchRaw)) : batchSize;
        const provIntervalRaw = provLimits[prov]?.interval;
        const effectiveIntervalMs = (provIntervalRaw != null && provIntervalRaw !== '' && Number(provIntervalRaw) >= 0)
          ? Number(provIntervalRaw) * 1000
          : intervalMs;

        log('[' + (PROVIDER_LABELS[prov]||prov) + '] worker startuje s modelem: ' + model);

        while (state.autoRunning) {
          if (isAutoTokenLimitReached()) break;

          // Zkontrolovat request limit pro všechny providery
          if (typeof window !== 'undefined' && window.checkProviderRequestLimit) {
            if (window.checkProviderRequestLimit(prov)) {
              log('[' + (PROVIDER_LABELS[prov]||prov) + '] dosažen limit požadavků — zastavuji worker');
              setProviderStatus(prov, 'limit req');
              break;
            }
          }

          // Atomicky vzít dávku a okamžitě označit _processing
          // (žádný await mezi getNextBatch a nastavením _processing = bezpečné)
          const batch = getNextBatch(effectiveBatchSize);
          if (!batch.length) break;
          for (const key of batch) {
            if (!state.translated[key]) {
              state.translated[key] = { vyznam: null, _processing: true };
            }
          }

          log('[' + prov + '] prekladam: ' + batch[0] + '–' + batch[batch.length - 1]);
          // autoBatch label aktualizuje jen Groq — ostatní by způsobovali poskakování
          if (prov === 'groq') {
            const autoBatch = document.getElementById('autoBatch');
            if (autoBatch) autoBatch.textContent = batch[0] + '–' + batch[batch.length - 1];
          }

          const result = await translateBatchForProvider(batch, prov, apiKey, model);

          updateStats();
          renderList();
          if (state.activeKey && state.translated[state.activeKey]) renderDetail();
          if (!state.autoRunning) break;

          // Vlastní interval — každý provider čeká svůj čas nezávisle
          let delay = effectiveIntervalMs;
          if (result && result.rateLimited) {
            delay = Math.max(delay, result.cooldownSeconds ? result.cooldownSeconds * 1000 : 60000);
            log('[' + (PROVIDER_LABELS[prov]||prov) + '] rate limit, cekam ' + Math.round(delay / 1000) + 's');
          }
          // Čekat interval s živým odpočítáváním
          const waitUntil = Date.now() + delay;
          while (state.autoRunning && Date.now() < waitUntil) {
            const remSec = Math.ceil((waitUntil - Date.now()) / 1000);
            setProviderStatus(prov, remSec + 's');
            // Groq dostane i hlavní countdown element
            if (prov === 'groq') {
              const countdown = document.getElementById('countdown');
              if (countdown) countdown.textContent = String(remSec);
            }
            const left = Math.min(500, waitUntil - Date.now());
            await new Promise(resolve => setTimeout(resolve, left));
          }
          setProviderStatus(prov, 'překládám...');
        }
        setProviderStatus(prov, 'hotovo');
      }

      await Promise.all(activeProviders.map(prov => runProviderWorkerAtomic(prov)));

      updateStats();
      renderList();
      if (state.activeKey && state.translated[state.activeKey]) renderDetail();
      if (!state.autoRunning) return;

      if (isAutoTokenLimitReached()) {
        stopAuto();
        showToast(t('toast.auto.stoppedTokenLimit'));
        return;
      }

      // Jsou ještě nepřeložená hesla? Spustit další kolo.
      const remaining2 = getNextBatch(1);
      if (!remaining2.length) {
        stopAuto();
        showToast(t('toast.translation.done'));
      } else {
        // Pokračovat dalším kolem — finally nastaví autoStepRunning=false, pak setTimeout spustí nové kolo
        state.autoTimer = setTimeout(runAutoStep, 50);
      }

    } finally {
      state.autoStepRunning = false;
    }
  }

  // ── POSTUPNÝ MÓD ─────────────────────────────────────────────────────────────
  // Provider za providerem, každý čeká svůj interval než dostane další dávku
  async function runSequentialStep() {
    if (!state.autoSeqRunning || state.autoStepRunning) return;
    state.autoStepRunning = true;

    try {
      if (isAutoTokenLimitReached()) {
        stopAutoSequential();
        showToast(t('toast.auto.stoppedTokenLimit'));
        return;
      }

      const activeProviders = getActiveParallelProviders();
      if (!activeProviders.length) {
        stopAutoSequential();
        showToast(t('toast.auto.enableGroq'));
        return;
      }

      const batchSize = Math.max(1, Number(state.currentBatchSize) || 5);
      const intervalMs = Math.max(1000, (Number(state.currentInterval) || 20) * 1000);

      if (!state.startTime) {
        state.startTime = Date.now();
        startElapsedTimer();
      }

      // Reset počítadel requestů při novém startu sequential
      if (typeof window !== 'undefined' && window.resetProviderReqCounts) {
        window.resetProviderReqCounts();
      }

      // Inicializace per-provider cooldown timestamps
      if (!state.seqProviderNextAllowed) {
        state.seqProviderNextAllowed = {};
      }
      for (const prov of activeProviders) {
        if (!state.seqProviderNextAllowed[prov]) state.seqProviderNextAllowed[prov] = 0;
      }

      // Rotace — index v poli aktivních providerů
      if (state.seqProviderIndex === undefined || state.seqProviderIndex >= activeProviders.length) {
        state.seqProviderIndex = 0;
      }

      let checked = 0;

      while (state.autoSeqRunning && checked < activeProviders.length) {
        if (isAutoTokenLimitReached()) { stopAutoSequential(); return; }

        const prov = activeProviders[state.seqProviderIndex];
        state.seqProviderIndex = (state.seqProviderIndex + 1) % activeProviders.length;
        checked++;

        // Zkontrolovat jestli provider čeká (interval od posledního volání)
        const now = Date.now();
        const nextAllowed = state.seqProviderNextAllowed[prov] || 0;
        if (now < nextAllowed) {
          const waitSec = Math.ceil((nextAllowed - now) / 1000);
          setProviderStatus(prov, 'čeká ' + waitSec + 's');
          continue; // tento provider ještě nesmí, zkusíme další
        }

        // Zkontrolovat request limit pro všechny providery
        if (typeof window !== 'undefined' && window.checkProviderRequestLimit) {
          if (window.checkProviderRequestLimit(prov)) {
            log('[' + (PROVIDER_LABELS[prov]||prov) + '] dosažen limit požadavků');
            setProviderStatus(prov, 'limit req');
            state.seqProviderNextAllowed[prov] = Date.now() + 24 * 60 * 60 * 1000; // blokovat na zbytek session
            continue;
          }
        }

        // Nejdřív ověřit klíč a model PŘED getNextBatch — jinak by se klíče ztratily
        const apiKey = getCurrentApiKey(prov);
        const SEQ_FALLBACK_MODELS = { groq: 'meta-llama/llama-4-scout-17b-16e-instruct', gemini: 'gemini-2.0-flash-lite', openrouter: 'openrouter/rotate' };
        const model = getPipelineModelForProvider(prov) || SEQ_FALLBACK_MODELS[prov];
        if (!apiKey) {
          log('[' + (PROVIDER_LABELS[prov]||prov) + '] chybí API klíč, přeskakuji');
          continue;
        }
        if (!model) {
          log('[' + (PROVIDER_LABELS[prov]||prov) + '] chybí model, přeskakuji');
          continue;
        }

        // Per-provider nastavení — fallback na globální hodnoty
        const seqProvLimits = (typeof window !== 'undefined' && window.getProviderLimits) ? window.getProviderLimits() : {};
        const seqBatchRaw = seqProvLimits[prov]?.batchSize;
        const seqBatchSize = (seqBatchRaw && Number(seqBatchRaw) > 0) ? Math.max(1, Number(seqBatchRaw)) : batchSize;
        const seqIntervalRaw = seqProvLimits[prov]?.interval;
        const seqIntervalMs = (seqIntervalRaw != null && seqIntervalRaw !== '' && Number(seqIntervalRaw) >= 0)
          ? Number(seqIntervalRaw) * 1000
          : intervalMs;

        // Vzít dávku
        const batch = getNextBatch(seqBatchSize);
        if (!batch.length) {
          stopAutoSequential();
          showToast(t('toast.translation.done'));
          return;
        }

        // Označit _processing
        for (const key of batch) {
          if (!state.translated[key]) {
            state.translated[key] = { vyznam: null, _processing: true };
          }
        }

        const autoBatch = document.getElementById('autoBatch');
        if (autoBatch) autoBatch.textContent = batch[0] + '–' + batch[batch.length - 1];
        log('[' + prov + '] postupně: ' + batch[0] + '–' + batch[batch.length - 1]);
        setProviderStatus(prov, 'překládám...');

        const result = await translateBatchForProvider(batch, prov, apiKey, model);

        // Při selhání vrátit _processing zpět aby getNextBatch klíče znovu viděl
        if (!result || !result.ok) {
          for (const key of batch) {
            if (state.translated[key] && state.translated[key]._processing) {
              delete state.translated[key]._processing;
              if (!state.translated[key].vyznam) delete state.translated[key];
            }
          }
        }

        updateStats();
        renderList();
        if (state.activeKey && state.translated[state.activeKey]) renderDetail();

        // Nastavit cooldown pro tohoto providera
        let cooldown = seqIntervalMs;
        if (result && result.rateLimited) {
          cooldown = Math.max(seqIntervalMs, result.cooldownSeconds ? result.cooldownSeconds * 1000 : 60000);
          log('[' + (PROVIDER_LABELS[prov]||prov) + '] rate limit, cooldown ' + Math.round(cooldown / 1000) + 's');
        }
        state.seqProviderNextAllowed[prov] = Date.now() + cooldown;

        // Ukázat countdown pro tohoto providera
        let remSec = Math.round(cooldown / 1000);
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.textContent = String(remSec);
        clearInterval(state.autoCountTimer);
        state.autoCountTimer = setInterval(() => {
          remSec--;
          if (countdownEl) countdownEl.textContent = String(Math.max(0, remSec));
          if (remSec <= 0) clearInterval(state.autoCountTimer);
        }, 1000);

        break; // Jeden provider za kolo, pak plánujeme další kolo
      }

      if (!state.autoSeqRunning) return;

      // Naplánovat další kolo — hned nebo až nejdřívější provider bude ready
      if (!state.autoSeqRunning) return;
      const now = Date.now();
      const waits = activeProviders.map(p => Math.max(0, (state.seqProviderNextAllowed[p] || 0) - now));
      const minWait = waits.length ? Math.min(...waits) : 0;
      // Čekat alespoň 1s ale max do nejbližšího dostupného providera (max 30s kroky)
      const nextIn = minWait > 0 ? Math.min(minWait, 30000) : 1000;
      updateAutoProviderCountdowns();
      state.autoTimer = setTimeout(runSequentialStep, nextIn);

    } finally {
      state.autoStepRunning = false;
    }
  }

  // ── TOGGLE / START / STOP SEQUENTIAL ────────────────────────────────────────
  function toggleAutoSequential() {
    if (state.autoSeqRunning) {
      stopAutoSequential();
    } else {
      startAutoSequential();
    }
  }

  function startAutoSequential() {
    if (state.autoSeqRunning) return; // guard proti double-start
    if (state.autoRunning) {
      showToast('Nejdřív zastav paralelní AUTO');
      return;
    }
    state.autoSeqRunning = true;
    state.seqProviderIndex = 0;
    state.seqProviderNextAllowed = {};
    const btn = document.getElementById('btnAutoSeq');
    if (btn) btn.textContent = '■ Stop';
    document.getElementById('autoPanel')?.classList.add('show');
    if (!state.startTime) {
      state.startTime = Date.now();
      startElapsedTimer();
    }
    startAutoProviderCountdownTicker();
    setTimeout(() => {
      if (state.autoSeqRunning && !state.autoStepRunning) runSequentialStep();
    }, 50);
  }

  function stopAutoSequential() {
    state.autoSeqRunning = false;
    state.autoStepRunning = false;
    clearTimeout(state.autoTimer);
    clearInterval(state.autoCountTimer);
    const btn = document.getElementById('btnAutoSeq');
    if (btn) btn.textContent = '↻ Postupně';
    if (window.innerWidth <= 600) {
      document.getElementById('autoPanel')?.classList.remove('show');
    }
    const countdown = document.getElementById('countdown');
    if (countdown) countdown.textContent = '—';
    stopElapsedTimer();
    updateAutoProviderCountdowns();
  }

  function saveAutoTokenLimit() {
    const input = document.getElementById('autoTokenLimit');
    if (!input) return;
    const raw = String(input.value || '').trim();
    const value = parseInt(raw, 10);
    if (!raw || Number.isNaN(value) || value <= 0) {
      safeRemoveLocalStorage(AUTO_TOKEN_LIMIT_KEY, 'AUTO');
      input.value = '';
    } else {
      input.value = String(value);
      safeSetLocalStorage(AUTO_TOKEN_LIMIT_KEY, String(value), 'AUTO');
    }
    refreshTokenStatsDisplay();
  }

  function getAutoTokenLimit() {
    const input = document.getElementById('autoTokenLimit');
    const fromInput = parseInt(String(input?.value || '').trim(), 10);
    if (!Number.isNaN(fromInput) && fromInput > 0) return fromInput;
    const fromStorage = parseInt(localStorage.getItem(AUTO_TOKEN_LIMIT_KEY) || '0', 10);
    return Number.isNaN(fromStorage) ? 0 : Math.max(0, fromStorage);
  }

   function isAutoTokenLimitReached() {
     const limit = getAutoTokenLimit();
     if (limit <= 0) return false;
     // Porovnáváme jen Groq tokeny — limit 350000 je Groq denní kvóta
     const total = state.groqTokens.total;
     return total >= limit;
   }

  function refreshTokenStatsDisplay() {
    const el = document.getElementById('tokenStats');
    if (!el) return;
    const limit = getAutoTokenLimit();
    const suffix = limit > 0 ? ' / limit ' + limit : '';
    el.textContent = t('stats.tokens', {
      input: state.groqTokens.in,
      output: state.groqTokens.out,
      total: state.groqTokens.total,
      suffix
    });
    // Zobrazit celkové tokeny všech providerů pokud jsou jiné než Groq
    const totalEl = document.getElementById('totalTokenStats');
    if (totalEl && state.totalTokens.total !== state.groqTokens.total) {
      totalEl.textContent = ' (vše: ' + state.totalTokens.total + ')';
    }
  }

  return {
    toggleAuto,
    startAuto,
    stopAuto,
    setAutoProviderCountdownLabel,
    isAutoProviderEnabled,
    setAutoProviderEnabled,
    initAutoProviderToggles,
    updateAutoProviderCountdowns,
    startAutoProviderCountdownTicker,
    stopAutoProviderCountdownTicker,
    runAutoStep,
    runSequentialStep,
    toggleAutoSequential,
    startAutoSequential,
    stopAutoSequential,
    saveAutoTokenLimit,
    getAutoTokenLimit,
    isAutoTokenLimitReached,
    refreshTokenStatsDisplay
  };
}
