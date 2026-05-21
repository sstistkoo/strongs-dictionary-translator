/**
 * Hlavička / statistiky / timer / log panel.
 * Deps: state, t, getTranslationStateForKey, storeKey, backupKey
 */
import { isTranslationComplete, hasMeaningfulValue, isDefinitionLowQuality } from '../translation/utils.js';
export function createHeaderApi({ state, t, getTranslationStateForKey, storeKey, backupKey }) {
  function logMsg(msg, type) {
    const scroll = document.getElementById('logScroll');
    if (!scroll) return;
    const placeholder = scroll.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.color = type === 'err' ? '#c05050' : 'var(--txt3)';
    div.style.fontFamily = "'JetBrains Mono', monospace";
    div.style.fontSize = '11px';
    div.style.padding = '8px 14px';
    div.textContent = msg;
    scroll.insertBefore(div, scroll.firstChild);
  }

  function updateETA() {
    const el = document.getElementById('etaLabel');
    if (!el) return;
    const remain = state.entries.filter(e => !state.translated[e.key] || state.translated[e.key].skipped).length;
    if (!remain) { el.textContent = t('header.eta.done'); return; }
    const bs = parseInt(document.getElementById('batchSizeRun').value) || state.currentBatchSize;
    const iv = parseInt(document.getElementById('intervalRun').value) || state.currentInterval;
    const batches = Math.ceil(remain / bs);
    const secs = batches * iv;
    if (secs < 60) el.textContent = `~${secs}s`;
    else if (secs < 3600) el.textContent = t('header.eta.minutes', { value: Math.ceil(secs / 60) });
    else el.textContent = t('header.eta.hours', { value: (secs / 3600).toFixed(1) });
  }

  function updateStats() {
    const doneAll = Object.values(state.translated).filter(tr => isTranslationComplete(tr)).length;
    // Filtrovat entries dle zdrojového jazyka
    const sourceLang = (localStorage.getItem('strong_source_lang') || 'gr').toLowerCase();
    const includeG = sourceLang === 'gr' || sourceLang === 'both';
    const includeH = sourceLang === 'he' || sourceLang === 'both';
    let relevantEntries = state.entries;
    if (!includeG || !includeH) {
      relevantEntries = state.entries.filter(e => (includeG && e.key.startsWith('G')) || (includeH && e.key.startsWith('H')));
    }
    const total = relevantEntries.length;
    // Přepočítat done jen pro relevantní klíče
    let done = doneAll;
    if (!includeG || !includeH) {
      const relevantKeys = new Set(relevantEntries.map(e => e.key));
      done = 0;
      for (const key of Object.keys(state.translated)) {
        if (relevantKeys.has(key) && isTranslationComplete(state.translated[key])) done++;
      }
    }
    const remain = total - done;
    const pct = total ? (done / total * 100).toFixed(1) : 0;
    document.getElementById('sDone').textContent = done;
    document.getElementById('sRemain').textContent = remain;
    document.getElementById('sTotal').textContent = total;
    document.getElementById('pbar').style.width = pct + '%';
    const pbarContainer = document.getElementById('pbarContainer');
    if (pbarContainer) {
      pbarContainer.setAttribute('aria-valuenow', pct);
      pbarContainer.setAttribute('aria-valuetext', `${done} z ${total} hesel přeloženo (${pct}%)`);
    }
    if (state.autoRunning) updateETA();
  }

  function startElapsedTimer() {
    if (state.elapsedTimer) clearInterval(state.elapsedTimer);
    state.elapsedTimer = setInterval(updateElapsedTime, 1000);
  }

  function stopElapsedTimer() {
    if (state.elapsedTimer) {
      clearInterval(state.elapsedTimer);
      state.elapsedTimer = null;
    }
  }

  function updateElapsedTime() {
    if (!state.startTime) return;
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const el = document.getElementById('elapsedTime');
    if (el) el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

   function updateFailedCount() {
     let failedCount = 0;
     for (const key of Object.keys(state.translated)) {
       const translationState = getTranslationStateForKey(key);
       if (translationState === 'failed' || translationState === 'failed_partial') failedCount++;
     }
     const elFailed = document.getElementById('failedCount');
     if (elFailed) elFailed.textContent = failedCount > 0 ? `(${failedCount})` : '';

     // Počet úkolů opravy témat (definice, význam, kjv, původ, specialist)
     let topicRepairTaskCount = 0;
     const topics = ['definice','vyznam','kjv','puvod','specialista'];
     for (const key of Object.keys(state.translated)) {
       const t = state.translated[key];
       if (!t || t.skipped) continue;
       for (const topicId of topics) {
         const val = String(t[topicId] || '').trim();
         if (!hasMeaningfulValue(val)) {
           topicRepairTaskCount++;
           continue;
         }
         if (topicId === 'definice' && isDefinitionLowQuality(val)) {
           topicRepairTaskCount++;
         }
       }
     }
     const elTopic = document.getElementById('topicRepairCount');
     if (elTopic) elTopic.textContent = topicRepairTaskCount > 0 ? `(${topicRepairTaskCount})` : '';
   }

  function updateFileIdBadge() {
    const badge = document.getElementById('fileIdBadge');
    if (!badge) return;
    if (!state.currentFileId) { badge.style.display = 'none'; return; }
    const parts = state.currentFileId.split('_');
    const typeTag = parts[0] || '?';
    const count = parts[1] || '?';
    const typeName = typeTag === 'G' ? 'GR' : typeTag === 'H' ? 'HE' : typeTag;
    badge.textContent = `${typeName}·${count}`;
    badge.style.display = 'inline-block';
    badge.title = t('header.fileBadge.title', { fileId: state.currentFileId, slot: storeKey() });
  }

  function hasBackup() {
    const raw = localStorage.getItem(backupKey());
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      if (!d || !d.translated) return null;
      return d;
    } catch (e) { return null; }
  }

  function updateBackupButtonVisibility() {
    const btn = document.getElementById('btnRestoreBackup');
    if (!btn) return;
    const b = hasBackup();
    if (b && b.count > 0) {
      btn.style.display = 'inline-block';
      btn.title = t('header.restoreBackup.fromSlot', {
        count: b.count,
        ts: new Date(b.ts).toLocaleString('cs')
      });
    } else {
      btn.style.display = 'none';
    }
  }

  return {
    logMsg,
    updateStats,
    updateETA,
    startElapsedTimer,
    stopElapsedTimer,
    updateElapsedTime,
    updateFailedCount,
    updateFileIdBadge,
    updateBackupButtonVisibility,
    hasBackup
  };
}
