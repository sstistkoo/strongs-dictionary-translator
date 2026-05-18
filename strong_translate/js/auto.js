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
     updateAutoProviderCountdowns();
     stopElapsedTimer();
   }

  function setAutoProviderCountdownLabel(prov, text) {
    const el = document.getElementById(`autoCountdown_${prov}`);
    if (el) el.textContent = text;
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
    const mainLeft = Math.max(0, parseInt(document.getElementById('countdown')?.textContent || '0', 10) || 0);
    const providerLabel = (prov) => String(PROVIDERS[prov]?.label || prov).split(' ')[0];
    const groqLabel = 'Groq';

    if (!isAutoProviderEnabled('groq')) {
      setAutoProviderCountdownLabel('groq', t('provider.status.disabled', { label: groqLabel }));
    } else if (state.autoRunning) {
      setAutoProviderCountdownLabel(
        'groq',
        mainLeft > 0
          ? t('provider.status.nextIn', { label: groqLabel, seconds: mainLeft })
          : t('provider.status.running', { label: groqLabel })
      );
    } else {
      setAutoProviderCountdownLabel('groq', t('provider.status.ready', { label: groqLabel }));
    }

    ['gemini', 'openrouter'].forEach((prov) => {
      if (Date.now() < Number(state.providerFailBadgeUntil[prov] || 0)) {
        setAutoProviderCountdownLabel(prov, t('provider.status.failed', { label: providerLabel(prov) }));
        return;
      }
      if (!isAutoProviderEnabled(prov)) {
        setAutoProviderCountdownLabel(prov, t('provider.status.disabled', { label: providerLabel(prov) }));
        return;
      }
      const pending = Math.max(0, Number(state.providerFallbackPendingCount?.[prov] || 0));
      if (pending > 0) {
        setAutoProviderCountdownLabel(
          prov,
          t('auto.provider.processingPartial', { label: providerLabel(prov), pending })
        );
        return;
      }
      const nextState = getSecondaryNextOperationState(prov);
      if (nextState.exhausted && nextState.nextSec > 0) {
        setAutoProviderCountdownLabel(
          prov,
          t('auto.provider.waitingNextAttempt', { label: providerLabel(prov), seconds: nextState.nextSec })
        );
        return;
      }
      setAutoProviderCountdownLabel(prov, t('provider.status.ready', { label: providerLabel(prov) }));
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

   async function runAutoStep() {
     if (!state.autoRunning || state.autoStepRunning) return;
     if (!state.autoRunning) return;
     state.autoStepRunning = true;

    try {
      if (!isAutoProviderEnabled('groq')) {
        stopAuto();
        log(t('auto.log.stoppedGroqDisabled'));
        const groqHint = t('auto.groqEnableHint');
        const autoLogEl = document.getElementById('autoLog');
        if (autoLogEl) autoLogEl.textContent = groqHint;
        setAutoProviderCountdownLabel('groq', groqHint);
        if (window.innerWidth <= 600) {
          document.getElementById('autoPanel')?.classList.add('show');
        }
        showToast(t('toast.auto.enableGroq'));
        return;
      }
      if (isAutoTokenLimitReached()) {
        stopAuto();
        log(t('auto.log.stoppedTokenLimit'));
        showToast(t('toast.auto.stoppedTokenLimit'));
        return;
      }

      const batch = getNextBatch(state.currentBatchSize);
      if (!batch.length) {
        stopAuto();
        showToast(t('toast.translation.done'));
        return;
      }

      const autoBatch = document.getElementById('autoBatch');
      if (autoBatch) autoBatch.textContent = `${batch[0]}–${batch[batch.length - 1]}`;
      log(t('auto.log.translatingRange', { from: batch[0], to: batch[batch.length - 1] }));
      updateETA();

      const result = await translateBatch(batch);
      updateStats();
      renderList();
      if (state.activeKey && state.translated[state.activeKey]) renderDetail();
      if (!state.autoRunning) return;

      const done = Object.values(state.translated).filter(tr => tr && tr.vyznam && tr.vyznam !== '—').length;
      const total = state.entries.length;
      log(`${done}/${total}`);

      const delaySeconds = result?.rateLimited ? (result.cooldownSeconds || 60) : state.currentInterval;
      let remaining = delaySeconds;
      const countdown = document.getElementById('countdown');
      if (countdown) countdown.textContent = String(remaining);
      clearInterval(state.autoCountTimer);
      state.autoCountTimer = setInterval(() => {
        remaining--;
        if (countdown) countdown.textContent = String(remaining);
        if (remaining <= 0) clearInterval(state.autoCountTimer);
      }, 1000);
      updateAutoProviderCountdowns();

      state.autoTimer = setTimeout(runAutoStep, delaySeconds * 1000);
    } finally {
      state.autoStepRunning = false;
    }
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
     const total = state.totalTokens.total;
     return total >= limit;
   }

  function refreshTokenStatsDisplay() {
    const el = document.getElementById('tokenStats');
    if (!el) return;
    const limit = getAutoTokenLimit();
    const suffix = limit > 0 ? ` / limit ${limit}` : '';
    el.textContent = t('stats.tokens', {
      input: state.groqTokens.in,
      output: state.groqTokens.out,
      total: state.groqTokens.total,
      suffix
    });
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
    saveAutoTokenLimit,
    getAutoTokenLimit,
    isAutoTokenLimitReached,
    refreshTokenStatsDisplay
  };
}
