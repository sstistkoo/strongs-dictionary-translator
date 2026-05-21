import { PROVIDERS } from '../config.js';
import { isSideFallbackAborted, sleepMsWithAbort } from '../ai/fallback.js';
import { hasMeaningfulValue, isDefinitionLowQuality, isDefinitionLikelyEnglish, fillMissingVyznamFromSource, fillMissingKjvFromSource, annotateEnglishDefinitionsInTranslated } from './utils.js';
import { sleepMs } from '../utils.js';
import { getResolvedSystemMessage, getResolvedDefaultPrompt } from '../aiPromptsResolve.js';
import { t, getPromptPack } from '../i18n.js';

function getDefaultBatchTopicSystemPrompt(topicId) {
    // Vždy použijeme univerzální core system prompt pro všechny scénáře
    const targetLang = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    
    const targetPromptPack = getPromptPack(targetLang);
    if (targetPromptPack) {
        const coreSystemPrompt = targetPromptPack['aiPrompts.core.system'];
        if (coreSystemPrompt && typeof coreSystemPrompt === 'string') {
            return String(coreSystemPrompt).trim();
        }
    }
    
    // Fall back to English core system prompt
    const enPromptPack = getPromptPack('en');
    if (enPromptPack) {
        const enSystemPrompt = enPromptPack['aiPrompts.core.system'];
        if (enSystemPrompt && typeof enSystemPrompt === 'string') {
            return String(enSystemPrompt).trim();
        }
    }
    
    // Final fallback
return `Jsi expert na biblistiku, koine řečtinu, hebrejštinu, aramejštinu a angličtinu. Tvým úkolem je vědecký překlad Strongova slovníku do češtiny.`;
}

function getDefaultBatchTopicUserPrompt(topicId) {
   const targetLang = localStorage.getItem('strong_target_lang') || 'cz';
   const promptPack = getPromptPack(targetLang);
   const i18nKey = `aiPrompts.core.topicRepair.${topicId}.template`;
   const fromPack = promptPack[i18nKey];
   if (fromPack && typeof fromPack === 'string') {
     return String(fromPack).trim();
   }
   // Fallback na výchozí prompt
   return String(getResolvedDefaultPrompt() || '').trim();
}

export { getDefaultBatchTopicSystemPrompt, getDefaultBatchTopicUserPrompt };

export function createTopicRepairApi(deps) {
  const {
    state, t, escHtml,
    log, logError,
    showToast,
    saveProgress,
    renderList, renderDetail, updateStats, updateFailedCount,
    TOPIC_LABELS, TOPIC_PROMPT_PRESET_MAP,
    callAIWithRetry,
    getPipelineModelForProvider, getCurrentApiKey,
    enforceSpecialistaFormat,
    parseWithOpenRouterNormalization, applyFallbacksToParsedMap,
    isAutoProviderEnabled,
    resolveProviderForInteractiveAction,
    resolveMainBatchProvider,
    getFailedTopicsForFallback, getMissingTopicsForRepair,
    cloneTranslationTopicFields, shouldReplaceTopicValue,
    getProviderCooldownLeftSec,
    appendModelTestUsage,
    buildModelTestMessages,
    getModelTestPromptCatalog,
    buildPromptMessages,
  } = deps;
function getTopicSourceTextForPreview(key, topicId) {
  const e = state.entryMap.get(key) || {};
  const t = state.translated[key] || {};
  const current = String(t[topicId] || '').trim();
  if (hasMeaningfulValue(current)) return current;
  // fallback na původní text z entryMap (pokud překlad chybí)
  if (topicId === 'definice') return String(e.definice || e.def || '').trim();
  if (topicId === 'kjv') return String(e.kjv || '').trim();
  if (topicId === 'vyznam') return String(e.vyznamCz || e.cz || '').trim();
  return String(e.orig || e.definice || e.def || '').trim();
}

function getTopicOriginText(key, topicId) {
  const e = state.entryMap.get(key) || {};
  if (topicId === 'definice') return String(e.definice || e.def || '').trim();
  if (topicId === 'kjv') return String(e.kjv || '').trim();
  if (topicId === 'vyznam') return String(e.vyznamCz || e.cz || '').trim();
  return String(e.orig || e.definice || e.def || '').trim();
}

function closeTopicRepairModalSafe() {
  const modal = document.getElementById('topicRepairModal');
  if (modal) modal.remove();
}

function stopTopicRepairTicker() {
  if (state.topicRepairTicker) {
    clearInterval(state.topicRepairTicker);
    state.topicRepairTicker = null;
  }
}

function updateTopicRepairProviderStatus() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const providers = ['groq', 'gemini', 'openrouter'];
  for (const prov of providers) {
    const line = document.getElementById(`topicRepairProvider_${prov}`);
    if (!line) continue;
    const enabled = !!topicRepairState.providerEnabled[prov];
    if (!enabled) {
      const label = prov === 'groq' ? 'Groq' : (prov === 'gemini' ? 'Google' : 'OpenRouter');
      line.textContent = t('provider.status.disabled', { label });
      continue;
    }
    if (topicRepairState.currentTask && topicRepairState.currentTask.provider === prov) {
      const label = prov === 'groq' ? 'Groq' : (prov === 'gemini' ? 'Google' : 'OpenRouter');
      line.textContent = t('provider.status.running', { label });
      continue;
    }
    const left = getProviderCooldownLeftSec(prov);
    const label = prov === 'groq' ? 'Groq' : (prov === 'gemini' ? 'Google' : 'OpenRouter');
    line.textContent = left > 0
      ? t('provider.status.nextIn', { label, seconds: left })
      : t('provider.status.ready', { label });
  }
}

function updateTopicRepairModalUI() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const vis = getTopicRepairModalVisibleTasks(state);
  const done = vis.filter(t => t.status === 'done').length;
  const running = vis.filter(t => t.status === 'running').length;
  const waiting = vis.filter(t => t.status === 'waiting').length;
  const failed = vis.filter(t => t.status === 'failed').length;
  const statusEl = document.getElementById('topicRepairStatus');
  const idleHint = (state.repairStrategy === 'sequential' && !state.sequentialEverStarted && waiting > 0)
    ? t('topicRepair.status.waitingToStart')
    : '';
  if (statusEl) statusEl.textContent = `${idleHint}${t('topicRepair.status.summary', { done, running, waiting, failed })}`;
  const applyCount = vis.filter(t => t.checked && hasMeaningfulValue(t.candidateValue)).length;
  const applyBtn = document.getElementById('topicRepairApplyBtn');
  if (applyBtn) applyBtn.textContent = t('topicRepair.applyOverwrite', { count: applyCount });
  const toggleBtn = document.getElementById('topicRepairToggleBtn');
  if (toggleBtn) {
    toggleBtn.textContent = state.paused ? t('topicRepair.resume') : t('topicRepair.pause');
    const showPause = state.repairStrategy === 'sequential' && state.sequentialEverStarted;
    toggleBtn.style.display = showPause ? '' : 'none';
  }
  const startSeqBtn = document.getElementById('topicRepairStartSequentialBtn');
  if (startSeqBtn) {
    const enabledProvCount = ['groq', 'gemini', 'openrouter'].filter(p => topicRepairState.providerEnabled[p]).length;
    const wantStart = state.repairStrategy === 'sequential' && !state.sequentialEverStarted
      && getTopicRepairModalVisibleTasks(state).some(t => t.status === 'waiting');
    const canSeqStart = wantStart && enabledProvCount > 0;
    startSeqBtn.style.display = wantStart ? '' : 'none';
    startSeqBtn.disabled = !canSeqStart;
  }
  const rSeq = document.getElementById('topicRepairStrategySeq');
  const rBulk = document.getElementById('topicRepairStrategyBulk');
  if (rSeq) rSeq.checked = state.repairStrategy === 'sequential';
  if (rBulk) rBulk.checked = state.repairStrategy === 'bulk';
  const bulkHint = document.getElementById('topicRepairBulkStrategyHint');
  if (bulkHint) bulkHint.style.display = state.repairStrategy === 'bulk' ? 'block' : 'none';
   const bulkRunBtn = document.getElementById('topicRepairBulkRunBtn');
   if (bulkRunBtn) {
     bulkRunBtn.disabled = false;
     bulkRunBtn.textContent = state.topicRepairBulkRunning ? t('topicRepair.bulk.stop') : t('topicRepair.bulk.button');
   }
   const toggleShowBtn = document.getElementById('btnToggleShowApproved');
   if (toggleShowBtn) {
     const approvedCount = state.topicRepairState.tasks.filter(t => t.hidden).length;
     toggleShowBtn.textContent = state.showApproved
       ? t('topicRepair.hideApproved')
       : t('topicRepair.showApproved', { count: approvedCount });
   }
  const rows = vis.map(task => {
    const idx = topicRepairState.tasks.indexOf(task);
    const extraTopicsForUi = (Array.isArray(task.detectedTopics) ? task.detectedTopics : [])
      .filter(row => row && row.topicId && row.topicId !== 'specialista' && row.topicId !== task.topicId);
    const rhOther = (Array.isArray(task.rawHeaderTopics) ? task.rawHeaderTopics : []).filter(id => id && id !== task.topicId);
    const rawHeadersHint = (task.status === 'done' || task.status === 'failed') && rhOther.length > 0
      ? `<div style="font-size:10px;color:var(--acc2);margin-top:6px">📎 ${t('topicRepair.rawHeaders.found', { headers: rhOther.map(id => escHtml(TOPIC_LABELS[id] || id)).join(', ') })}${extraTopicsForUi.length ? '' : ` — ${t('topicRepair.rawHeaders.checkLogHint')}`}</div>`
      : '';
    const statusColor = task.status === 'done' ? 'var(--acc3)' : (task.status === 'failed' ? 'var(--red)' : (task.status === 'running' ? 'var(--ylw)' : 'var(--txt3)'));
    const statusText = task.status === 'done' ? t('topicRepair.taskStatus.done') : (task.status === 'failed' ? t('topicRepair.taskStatus.failed') : (task.status === 'running' ? t('topicRepair.taskStatus.running') : t('topicRepair.taskStatus.waiting')));
      return `
        <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;padding:10px;margin:0 0 10px 0${task.hidden && !state.showApproved ? ';display:none' : ''}">
         <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
           <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
             <input type="checkbox" ${task.checked ? 'checked' : ''} ${!hasMeaningfulValue(task.candidateValue) ? 'disabled' : ''} onchange="toggleTopicRepairTask(${idx}, this.checked)" style="accent-color:var(--acc)">
             <span style="font-family:'JetBrains Mono',monospace;color:var(--acc)">${task.key}</span>
             <span>${escHtml(TOPIC_LABELS[task.topicId] || task.topicId)}</span>
           </label>
           <div style="display:flex;align-items:center;gap:6px">
             <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--txt3);font-size:11px">
               <input type="checkbox" ${task.includeBulk !== false ? 'checked' : ''} onchange="toggleTopicRepairBulkInclude(${idx}, this.checked)" style="accent-color:var(--acc)">
               ${t('topicRepair.batchLabel')}
             </label>
              <span style="font-size:11px;color:${statusColor}">${statusText}${task.provider ? ` · ${task.provider}` : ''}</span>
               ${(!task.hidden || state.showApproved) ? `
                 <button class="hbtn ${task.manuallyApproved ? 'red' : ''}" style="font-size:10px;padding:4px 8px" onclick="toggleTopicRepairManualApproval(${idx})" title="${escHtml(task.manuallyApproved ? (t('topicRepair.unapprove.title') || 'Zrušit označení v pořádku') : (t('topicRepair.manualApproval.title') || 'Označit jako v pořádku'))}">
                   ${task.manuallyApproved ? (t('topicRepair.unapprove') || 'Zrušit') : (t('topicRepair.manualApproval.label') || 'V pořádku')}
                 </button>
               ` : ''}
           </div>
         </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="font-size:11px;color:var(--txt2)">
            <div><b>${t('topicRepair.originalTopic')}</b> ${escHtml(task.currentValue || '—')}</div>
            <div style="margin-top:4px"><b>${t('topicRepair.original')}</b> ${escHtml(task.sourceValue || '—')}</div>
          </div>
          <div style="font-size:11px;color:var(--txt)">
            <div><b>${t('topicRepair.newProposal')}</b> ${escHtml(task.candidateValue || '—')}</div>
            ${formatTopicRepairQuickCompare(task.topicId, task.currentValue, task.candidateValue)}
            ${rawHeadersHint}
            <div style="margin-top:4px;color:var(--txt2)">
              <b>${t('topicRepair.specialistInResponse')}</b> ${task.specialistaInRaw ? t('topicRepair.yes') : t('topicRepair.no')}
              ${task.specialistaInRaw ? ` · <b>${t('topicRepair.status')}</b> ${escHtml(task.specialistaDecision || t('topicRepair.unchanged'))}` : ''}
            </div>
            ${task.specialistaInRaw ? `
              <details style="margin-top:6px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;padding:6px">
                <summary style="cursor:pointer;color:var(--acc)">${t('topicRepair.specialistDetail')}</summary>
                <div style="margin-top:6px;color:var(--txt2)"><b>${t('topicRepair.originalSpecialist')}</b> ${escHtml(task.specialistaPreviousValue || '—')}</div>
                <div style="margin-top:6px;color:var(--txt)"><b>${t('topicRepair.aiSpecialist')}</b> ${escHtml(task.specialistaCandidateValue || '—')}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                  <button class="hbtn grn" onclick="setTopicRepairSpecialistaDecision(${idx}, 'accept')">${t('topicRepair.confirmSpecialist')}</button>
                  <button class="hbtn red" onclick="setTopicRepairSpecialistaDecision(${idx}, 'reject')">${t('topicRepair.rejectSpecialist')}</button>
                </div>
              </details>
            ` : ''}
            ${extraTopicsForUi.length > 0 ? `
              <details style="margin-top:6px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;padding:6px">
                <summary style="cursor:pointer;color:var(--acc2)">${t('topicRepair.extraTopics', { count: extraTopicsForUi.length })}</summary>
                ${extraTopicsForUi.map(row => `
                  <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--brd)">
                    <div style="font-size:11px;color:var(--txt2)"><b>${escHtml(TOPIC_LABELS[row.topicId] || row.topicId)}</b> · ${t('topicRepair.status')} ${escHtml(row.decision || t('topicRepair.unchanged'))}</div>
                    <div style="margin-top:4px;color:var(--txt2)"><b>${t('topicRepair.original')}</b> ${escHtml(row.previousValue || '—')}</div>
                    <div style="margin-top:4px;color:var(--txt)"><b>${t('topicRepair.aiShort')}</b> ${escHtml(row.candidateValue || '—')}</div>
                    ${formatTopicRepairQuickCompare(row.topicId, row.previousValue, row.candidateValue)}
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                      <button class="hbtn grn" onclick="setTopicRepairDetectedTopicDecision(${idx}, '${row.topicId}', 'accept')">${t('topicRepair.confirm')}</button>
                      <button class="hbtn red" onclick="setTopicRepairDetectedTopicDecision(${idx}, '${row.topicId}', 'reject')">${t('topicRepair.reject')}</button>
                    </div>
                  </div>
                `).join('')}
              </details>
            ` : ''}
            ${task.error ? `<div style="margin-top:4px;color:var(--red)">✗ ${escHtml(task.error)}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
  const listEl = document.getElementById('topicRepairList');
  if (listEl) listEl.innerHTML = rows || `<div style="font-size:12px;color:var(--txt3)">${t('topicRepair.none')}</div>`;
  updateTopicRepairProviderStatus();
  updateTopicRepairSelectCounts();
  syncTopicRepairMinimizeBusyIndicator();
}

function updateTopicRepairSelectCounts() {
  const trs = state.topicRepairState;
  if (!trs) return;
  const all = trs.tasks.filter(t => !t.hidden);
  const cnt = (id) => all.filter(t => t.topicId === id && t.status === 'waiting').length;
  const allWaiting = all.filter(t => t.status === 'waiting').length;
  const counts = { all: allWaiting, definice: cnt('definice'), vyznam: cnt('vyznam'), kjv: cnt('kjv'), puvod: cnt('puvod'), specialista: cnt('specialista') };
  const shortLabels = { all: 'Vše', definice: 'D', vyznam: 'V', kjv: 'K', puvod: 'P', specialista: 'S' };

  for (const prov of ['groq', 'gemini', 'openrouter']) {
    const sel = document.getElementById(`topicRepairProviderTopic_${prov}`);
    if (!sel) continue;
    for (const opt of sel.options) {
      const c = counts[opt.value];
      if (c !== undefined) opt.textContent = `${shortLabels[opt.value]} (${c})`;
    }
  }

  const bulkSel = document.getElementById('topicRepairBulkTopicSelect');
  if (!bulkSel) return;
  for (const opt of bulkSel.options) {
    const c = counts[opt.value];
    if (c === undefined) continue;
    if (opt.value === 'all') opt.textContent = `${t('topicRepair.modal.all')} (${c})`;
    else opt.textContent = `${TOPIC_LABELS[opt.value] || opt.value} (${c})`;
  }
}

function buildTopicRepairTasks(keys) {
  const tasks = [];
  for (const key of keys) {
    const t = state.translated[key] || {};
    const missing = getMissingTopicsForRepair(t);
    // Debug log
    if (window.DEBUG_TOPIC_REPAIR) {
      console.log('TopicRepair build:', key, 'translated:', t, 'missing:', missing);
    }
    for (const topicId of missing) {
      const ignoreKey = `${key}:${topicId}`;
      const manuallyApproved = state.topicRepairManuallyApproved?.has(ignoreKey) || false;
      const hidden = manuallyApproved;
      if (manuallyApproved) {
        // Still push task but hidden; it won't show in UI
      }
      tasks.push({
        key,
        topicId,
        status: 'waiting',
        checked: true,
        includeBulk: true,
        currentValue: String(t[topicId] || getTopicSourceTextForPreview(key, topicId) || '').trim(),
        sourceValue: getTopicOriginText(key, topicId),
        candidateValue: '',
        provider: '',
        error: '',
        specialistaInRaw: false,
        specialistaDecision: '',
        specialistaPreviousValue: String(t.specialista || '').trim(),
        specialistaCandidateValue: '',
        detectedTopics: [],
        rawHeaderTopics: [],
        manuallyApproved,
        hidden
      });
    }
  }
  return tasks;
}

function applyTopicRepairProviderCheckboxes() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  for (const prov of ['groq', 'gemini', 'openrouter']) {
    const el = document.getElementById(`topicRepairEnable_${prov}`);
    if (!el) continue;
    topicRepairState.providerEnabled[prov] = !!el.checked;
  }
  updateTopicRepairProviderStatus();
}

function setTopicRepairProviderTopic(prov, topicId) {
  if (!state.topicRepairState) return;
  if (!state.topicRepairState.providerTopic) state.topicRepairState.providerTopic = {};
  state.topicRepairState.providerTopic[prov] = topicId;
  localStorage.setItem('tr_providerTopic_' + prov, topicId);
}

function renderTopicRepairModal() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  if (!state.bulkListTopicFilter) state.bulkListTopicFilter = defaultBulkListTopicFilter();
  if (!state.bulkTopicId) state.bulkTopicId = 'all';
  if (state.showApproved === undefined) state.showApproved = false;
  closeTopicRepairModalSafe();
   const modal = document.createElement('div');
   modal.id = 'topicRepairModal';
   modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10025;overflow-y:auto;padding:16px';

   const _trLimits = (typeof window !== 'undefined' && window.getProviderLimits) ? window.getProviderLimits() : {};

   // Vypočítání počtů pro zobrazení
   const allTasks = topicRepairState.tasks.filter(t => !t.hidden);
   const waitingCount = allTasks.filter(t => t.status === 'waiting').length;
   const topicCounts = {
     definice: allTasks.filter(t => t.topicId === 'definice').length,
     vyznam: allTasks.filter(t => t.topicId === 'vyznam').length,
     kjv: allTasks.filter(t => t.topicId === 'kjv').length,
     puvod: allTasks.filter(t => t.topicId === 'puvod').length,
     specialista: allTasks.filter(t => t.topicId === 'specialista').length
   };
   const _provTopic = topicRepairState.providerTopic || {};
   const _ptOpts = (prov) => [
     `<option value="all" ${(_provTopic[prov]||'all')==='all'?'selected':''}>Vše (${allTasks.length})</option>`,
     `<option value="definice" ${_provTopic[prov]==='definice'?'selected':''}>D (${topicCounts.definice})</option>`,
     `<option value="vyznam" ${_provTopic[prov]==='vyznam'?'selected':''}>V (${topicCounts.vyznam})</option>`,
     `<option value="kjv" ${_provTopic[prov]==='kjv'?'selected':''}>K (${topicCounts.kjv})</option>`,
     `<option value="puvod" ${_provTopic[prov]==='puvod'?'selected':''}>P (${topicCounts.puvod})</option>`,
     `<option value="specialista" ${_provTopic[prov]==='specialista'?'selected':''}>S (${topicCounts.specialista})</option>`
   ].join('');
   
   modal.innerHTML = `
    <div style="max-width:980px;margin:0 auto;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
         <h2 style="color:var(--acc);margin:0">🗔 ${t('topicRepair.modal.title', { count: topicRepairState.tasks.length })}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="hbtn" id="topicRepairMinimizeBtn" onclick="minimizeTopicRepairModal()">${t('topicRepair.modal.minimize')}</button>
          <button class="hbtn" onclick="closeTopicRepairModalOnly()">${t('topicRepair.modal.closeWindow')}</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--txt2);margin:8px 0 10px 0">${t('topicRepair.modal.missingHint')}</div>
      <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;padding:10px;margin-bottom:10px">
        <div id="topicRepairStatus" style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--txt3)">—</div>
        <div style="display:grid;gap:5px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--txt2);margin-top:6px">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <select id="topicRepairProviderTopic_groq" onchange="setTopicRepairProviderTopic('groq',this.value)" title="Téma pro Groq" style="background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:1px 3px;font-family:'JetBrains Mono',monospace;font-size:10px;max-width:120px">${_ptOpts('groq')}</select>
            <input type="number" id="tr_batchSize_groq" class="auto-small-input" min="1" max="200" step="1" value="${_trLimits.groq?.batchSize ?? 5}" style="width:40px" title="Počet hesel na dávku — Groq" onchange="window.saveProviderLimit&&saveProviderLimit('groq','batchSize',this.value)">
            <input type="number" id="tr_interval_groq" class="auto-small-input" min="0" step="1" value="${_trLimits.groq?.interval ?? 20}" style="width:46px" title="Interval Groq (s)" onchange="window.saveProviderLimit&&saveProviderLimit('groq','interval',this.value)">
            <input type="number" id="tr_limitReqs_groq" class="auto-small-input" min="0" step="10" value="${_trLimits.groq?.reqs ?? ''}" placeholder="req" style="width:46px" title="Limit požadavků Groq za session (0=vypnuto)" onchange="window.saveProviderLimit&&saveProviderLimit('groq','reqs',this.value)">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="topicRepairEnable_groq" ${topicRepairState.providerEnabled.groq ? 'checked' : ''} onchange="applyTopicRepairProviderCheckboxes()" style="accent-color:var(--acc)">
              G
            </label>
            <span id="topicRepairProvider_groq">Groq: —</span>
            <span id="trGroqTokens" style="color:var(--txt3);margin-left:4px"></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <select id="topicRepairProviderTopic_gemini" onchange="setTopicRepairProviderTopic('gemini',this.value)" title="Téma pro Gemini" style="background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:1px 3px;font-family:'JetBrains Mono',monospace;font-size:10px;max-width:120px">${_ptOpts('gemini')}</select>
            <input type="number" id="tr_batchSize_gemini" class="auto-small-input" min="1" max="200" step="1" value="${_trLimits.gemini?.batchSize ?? 5}" style="width:40px" title="Počet hesel na dávku — Gemini" onchange="window.saveProviderLimit&&saveProviderLimit('gemini','batchSize',this.value)">
            <input type="number" id="tr_interval_gemini" class="auto-small-input" min="0" step="1" value="${_trLimits.gemini?.interval ?? 20}" style="width:46px" title="Interval Gemini (s)" onchange="window.saveProviderLimit&&saveProviderLimit('gemini','interval',this.value)">
            <input type="number" id="tr_limitReqs_gemini" class="auto-small-input" min="0" step="10" value="${_trLimits.gemini?.reqs ?? 400}" placeholder="req" style="width:46px" title="Limit požadavků Gemini za session (0=vypnuto)" onchange="window.saveProviderLimit&&saveProviderLimit('gemini','reqs',this.value)">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="topicRepairEnable_gemini" ${topicRepairState.providerEnabled.gemini ? 'checked' : ''} onchange="applyTopicRepairProviderCheckboxes()" style="accent-color:var(--acc)">
              Gm
            </label>
            <span id="topicRepairProvider_gemini">Google: —</span>
            <span id="trGeminiStats" style="color:var(--txt3);margin-left:4px"></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <select id="topicRepairProviderTopic_openrouter" onchange="setTopicRepairProviderTopic('openrouter',this.value)" title="Téma pro OpenRouter" style="background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:1px 3px;font-family:'JetBrains Mono',monospace;font-size:10px;max-width:120px">${_ptOpts('openrouter')}</select>
            <input type="number" id="tr_batchSize_openrouter" class="auto-small-input" min="1" max="200" step="1" value="${_trLimits.openrouter?.batchSize ?? 5}" style="width:40px" title="Počet hesel na dávku — OpenRouter" onchange="window.saveProviderLimit&&saveProviderLimit('openrouter','batchSize',this.value)">
            <input type="number" id="tr_interval_openrouter" class="auto-small-input" min="0" step="1" value="${_trLimits.openrouter?.interval ?? 20}" style="width:46px" title="Interval OpenRouter (s)" onchange="window.saveProviderLimit&&saveProviderLimit('openrouter','interval',this.value)">
            <input type="number" id="tr_limitReqs_openrouter" class="auto-small-input" min="0" step="10" value="${_trLimits.openrouter?.reqs ?? 400}" placeholder="req" style="width:46px" title="Limit požadavků OpenRouter za session (0=vypnuto)" onchange="window.saveProviderLimit&&saveProviderLimit('openrouter','reqs',this.value)">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="topicRepairEnable_openrouter" ${topicRepairState.providerEnabled.openrouter ? 'checked' : ''} onchange="applyTopicRepairProviderCheckboxes()" style="accent-color:var(--acc)">
              OR
            </label>
            <span id="topicRepairProvider_openrouter">OpenRouter: —</span>
            <span id="trOrStats" style="color:var(--txt3);margin-left:4px"></span>
          </div>
        </div>
      </div>
      <details id="topicRepairBulkDetails" style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;padding:10px;margin-bottom:10px" ${state.repairStrategy === 'bulk' ? 'open' : ''}>
        <summary style="cursor:pointer;color:var(--acc)">${t('topicRepair.modal.bulkSectionTitle')}</summary>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--txt3);cursor:pointer">
            <input type="checkbox" id="topicRepairBulkOnlyFailed" checked style="accent-color:var(--acc)">
            ${t('topicRepair.modal.onlyFailed')}
          </label>
          <button class="hbtn" type="button" onclick="setTopicRepairBulkIncludeAll(true)">${t('topicRepair.modal.batchAll')}</button>
          <button class="hbtn" type="button" onclick="setTopicRepairBulkIncludeAll(false)">${t('topicRepair.modal.batchNone')}</button>
        </div>
<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--brd)">
          <label style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--txt2);flex-wrap:wrap">
            <span style="white-space:nowrap"><b>${t('topicRepair.modal.select')}</b></span>
            <select id="topicRepairBulkTopicSelect" onchange="refreshTopicRepairBatchPromptEditor()" style="min-width:200px;flex:1;max-width:100%;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:4px 6px;font-size:12px">
              <option value="all" ${state.bulkTopicId === 'all' ? 'selected' : ''}>${t('topicRepair.modal.all')} (${allTasks.length})</option>
              <option value="definice" ${state.bulkTopicId === 'definice' ? 'selected' : ''}>${escHtml(TOPIC_LABELS.definice)} (${topicCounts.definice})</option>
              <option value="vyznam" ${state.bulkTopicId === 'vyznam' ? 'selected' : ''}>${escHtml(TOPIC_LABELS.vyznam)} (${topicCounts.vyznam})</option>
              <option value="kjv" ${state.bulkTopicId === 'kjv' ? 'selected' : ''}>${escHtml(TOPIC_LABELS.kjv)} (${topicCounts.kjv})</option>
              <option value="puvod" ${state.bulkTopicId === 'puvod' ? 'selected' : ''}>${escHtml(TOPIC_LABELS.puvod)} (${topicCounts.puvod})</option>
              <option value="specialista" ${state.bulkTopicId === 'specialista' ? 'selected' : ''}>${escHtml(TOPIC_LABELS.specialista)} (${topicCounts.specialista})</option>
            </select>
          </label>
          <div id="topicRepairBulkListFilterRow" style="display:${state.bulkTopicId === 'all' ? 'flex' : 'none'};flex-wrap:wrap;gap:10px 14px;align-items:center;width:100%;margin-top:10px;padding-top:10px;border-top:1px solid var(--brd);font-size:11px;color:var(--txt2)">
            <span style="width:100%;margin-bottom:2px">${t('topicRepair.modal.allLimitTypes')}</span>
            ${TOPIC_REPAIR_BULK_TOPIC_ORDER.map(tid => {
              const on = (state.bulkListTopicFilter || defaultBulkListTopicFilter())[tid] !== false;
              return `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap"><input type="checkbox" ${on ? 'checked' : ''} onchange="toggleTopicRepairBulkListFilter('${tid}', this.checked)" style="accent-color:var(--acc)">${escHtml(TOPIC_LABELS[tid] || tid)}</label>`;
            }).join('')}
          </div>
        </div>
<div style="margin-top:8px">
           <div style="font-size:11px;color:var(--txt2);margin-bottom:6px">${t('topicRepair.modal.batchPromptHelp')}</div>
           <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
             <div style="display:flex;flex-direction:column;min-height:0">
               <label for="topicRepairSystemPrompt" style="font-size:0.79rem;color:var(--txt2);display:block;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t('topicRepair.modal.systemPromptLabel')}</label>
               <textarea id="topicRepairSystemPrompt" class="topic-repair-system-prompt" style="width:100%;min-height:140px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:8px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.45;box-sizing:border-box"></textarea>
             </div>
             <div style="display:flex;flex-direction:column;min-height:0">
               <label for="topicRepairUserPrompt" style="font-size:0.79rem;color:var(--txt2);display:block;margin-bottom:4px">${t('topicRepair.modal.userPromptLabel')}</label>
               <textarea id="topicRepairUserPrompt" class="topic-repair-user-prompt" style="width:100%;min-height:140px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:8px;font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.45;box-sizing:border-box"></textarea>
             </div>
           </div>
           <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
             <button class="hbtn" type="button" onclick="saveTopicRepairBatchPromptDraft()">${t('topicRepair.modal.savePrompt')}</button>
             <button class="hbtn" type="button" onclick="resetTopicRepairBatchPromptToDefault()">${t('topicRepair.modal.defaultFromCatalog')}</button>
           </div>
           <div style="font-size:11px;color:var(--txt3);margin-top:8px">
             ${t('topicRepair.modal.tipPauseFirst')}
           </div>
         </div>
      </details>
<div style="margin:10px 0;display:flex;align-items:center;gap:8px">
        <button class="hbtn" id="btnToggleShowApproved" onclick="toggleShowApproved()">
          ${state.showApproved ? t('topicRepair.hideApproved') : t('topicRepair.showApproved', { count: state.topicRepairState.tasks.filter(t=>t.hidden).length })}
        </button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center">
        <button class="hbtn grn" id="topicRepairStartSequentialBtn" type="button" onclick="startTopicRepairSequentialWorker()">${t('topicRepair.modal.startSequential')}</button>
         <button class="hbtn grn" id="topicRepairBulkRunBtn" type="button" onclick="runTopicRepairBulkTranslation()">${t('topicRepair.modal.bulkRunSelected')}</button>
         <span style="font-size:11px;color:var(--txt3);margin-left:4px">(${waitingCount} ${t('topicRepair.modal.waiting')})</span>
         <button class="hbtn grn" id="topicRepairToggleBtn" onclick="toggleTopicRepairRun()">${t('topicRepair.pause')}</button>
         <button class="hbtn grn" id="topicRepairApplyBtn" onclick="applyTopicRepairSelected()">${t('topicRepair.applyOverwrite', { count: 0 })}</button>
       </div>
      <div id="topicRepairList"></div>
    </div>
  `;
  document.body.appendChild(modal);
  refreshTopicRepairBatchPromptEditor();
  initTopicRepairBulkRunInputs();
  updateTopicRepairModalUI();
}

function startTopicRepairFlow(keys) {
  loadTopicRepairManualApprovals(); // načtení persisted schválení
  const tasks = buildTopicRepairTasks(keys);
  if (!tasks.length) {
    showToast(t('toast.topicRepair.noEligible'));
    return;
  }
  // Reset bulk filters to show all topics for new flow
  state.bulkTopicId = 'all';
  state.bulkListTopicFilter = defaultBulkListTopicFilter();
  // Reset strategy and paused state (top-level)
  state.repairStrategy = 'sequential';
  state.paused = true;
  state.topicRepairState = {
    tasks,
    paused: true,
    repairStrategy: 'sequential',
    sequentialEverStarted: false,
    closed: false,
    minimized: false,
    bulkTopicId: 'all',
    bulkListTopicFilter: defaultBulkListTopicFilter(),
    currentTask: null,
    providerEnabled: {
      groq: isAutoProviderEnabled('groq'),
      gemini: isAutoProviderEnabled('gemini'),
      openrouter: isAutoProviderEnabled('openrouter')
    },
    providerTopic: {
      groq: localStorage.getItem('tr_providerTopic_groq') || 'definice',
      gemini: localStorage.getItem('tr_providerTopic_gemini') || 'specialista',
      openrouter: localStorage.getItem('tr_providerTopic_openrouter') || 'vyznam'
    }
  };
  state.showApproved = false;
  renderTopicRepairModal();
  const miniBtn = document.getElementById('btnTopicRepairMini');
  if (miniBtn) miniBtn.style.display = 'none';
  stopTopicRepairTicker();
  state.topicRepairTicker = setInterval(updateTopicRepairProviderStatus, 1000);
}

function setTopicRepairStrategy(strategy) {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const busy = topicRepairState.tasks.some(t => t.status === 'running') || !!topicRepairState.currentTask || state.topicRepairBulkRunning;
  if (busy) {
    showToast(t('toast.topicRepair.modeLocked'));
    updateTopicRepairModalUI();
    return;
  }
  state.repairStrategy = strategy === 'bulk' ? 'bulk' : 'sequential';
  if (state.repairStrategy === 'bulk') state.paused = true;
  const det = document.getElementById('topicRepairBulkDetails');
  if (det) det.open = state.repairStrategy === 'bulk';
  const bulkHint = document.getElementById('topicRepairBulkStrategyHint');
  if (bulkHint) bulkHint.style.display = state.repairStrategy === 'bulk' ? 'block' : 'none';
  updateTopicRepairModalUI();
}

function startTopicRepairSequentialWorker() {
  const topicRepairState = state.topicRepairState;
  if (!state || state.repairStrategy !== 'sequential') return;
  if (!findNextTopicRepairWaitingTask(state)) {
    showToast(t('toast.topicRepair.queueEmpty'));
    return;
  }
  const enabledProviders = ['groq', 'gemini', 'openrouter'].filter(p => topicRepairState.providerEnabled[p]);
  if (!enabledProviders.length) {
    showToast(t('toast.topicRepair.enableProvider'));
    return;
  }
  state.sequentialEverStarted = true;
  state.paused = false;
  updateTopicRepairModalUI();
  if (!state.topicRepairWorkerRunning) processTopicRepairQueue();
}

async function processTopicRepairQueue() {
  if (!state.topicRepairState || state.topicRepairWorkerRunning) return;
  state.topicRepairWorkerRunning = true;
  try {
    while (state.topicRepairState && !state.topicRepairState.closed) {
      if (state.topicRepairState.repairStrategy !== 'sequential') break;
      if (state.topicRepairState.paused) {
        await sleepMs(350);
        continue;
      }
      const nextTask = findNextTopicRepairWaitingTask(state);
      if (!nextTask) break;
      const enabledProviders = ['groq', 'gemini', 'openrouter'].filter(p => state.topicRepairState?.providerEnabled?.[p]);
      if (!enabledProviders.length) {
        showToast(t('toast.topicRepair.enableProvider'));
        state.topicRepairState.paused = true;
        updateTopicRepairModalUI();
        await sleepMs(500);
        continue;
      }
       nextTask.status = 'running';
       nextTask.error = '';
       updateTopicRepairModalUI();
       let success = false;
       for (const prov of enabledProviders) {
         if (!state.topicRepairState || state.topicRepairState.closed || state.topicRepairState.paused) break;
         const model = getPipelineModelForProvider(prov) || document.getElementById('model')?.value || '';
         const apiKey = getCurrentApiKey(prov);
         if (!apiKey) continue;
         state.topicRepairState.currentTask = { provider: prov };
         updateTopicRepairProviderStatus();
         try {
nextTask.detectedTopics = [];
            // Get system prompt - vždy použijeme core system prompt
            const targetLang = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
            const targetPromptPack = getPromptPack(targetLang);
            let systemContent;
            if (targetPromptPack) {
                systemContent = targetPromptPack['aiPrompts.core.system'];
            }
            if (!systemContent || typeof systemContent !== 'string') {
                const enPromptPack = getPromptPack('en');
                systemContent = enPromptPack?.['aiPrompts.core.system'];
            }
            systemContent = String(systemContent || 'Jsi expert na biblistiku, koine řečtinu, hebrejštinu, aramejštinu a angličtinu. Tvým úkolem je vědecký překlad Strongova slovníku do češtiny.').trim();
            
            const messages = [
              { role: 'system', content: systemContent },
              { role: 'user', content: buildTopicPrompt(nextTask.key, nextTask.topicId) }
            ];
          const raw = await callAIWithRetry(prov, apiKey, model, messages);
          const rawText = String(raw?.content || '').trim();
          log(t('topicRepair.log.rawRepairPrinted', { key: nextTask.key, topic: nextTask.topicId }));

          // Kontrola dalších témat: zobraz jen skutečně označená pole v RAW odpovědi (striktní parser).
          state.translated[nextTask.key] = state.translated[nextTask.key] || {};
          const baselineTopicValues = cloneTranslationTopicFields(state.translated[nextTask.key]);

          const primaryCandidate = String(extractTopicValueFromAI(rawText, nextTask.topicId, 'strict') || '').trim();
          nextTask.rawHeaderTopics = scanRawForTopicHeaderTopicIds(rawText);

          const pushDetectedExtraTopic = (topicId, candidateTopicVal) => {
            if (!hasMeaningfulValue(candidateTopicVal)) return;
            if (primaryCandidate && candidateTopicVal === primaryCandidate) return;
            if (nextTask.detectedTopics.some(d => d.topicId === topicId)) return;
            const previousTopicVal = String(baselineTopicValues?.[topicId] || '').trim();
            const acceptAuto = shouldAutoAcceptDetectedTopic(topicId, previousTopicVal, candidateTopicVal);
            if (acceptAuto) {
              state.translated[nextTask.key][topicId] = candidateTopicVal;
            }
            nextTask.detectedTopics.push({
              topicId,
              previousValue: previousTopicVal,
              candidateValue: candidateTopicVal,
              decision: acceptAuto ? t('topicRepair.decision.acceptAuto') : t('topicRepair.decision.rejectAuto')
            });
          };

          for (const topicId of FALLBACK_TOPIC_ORDER) {
            if (topicId === 'specialista') continue;
            if (topicId === nextTask.topicId) continue;
            const candidateTopicVal = String(extractTopicValueFromAI(rawText, topicId, 'strict') || '').trim();
            pushDetectedExtraTopic(topicId, candidateTopicVal);
          }

          const headerExtras = (nextTask.rawHeaderTopics || []).filter(
            tid => tid !== nextTask.topicId && tid !== 'specialista'
          );
          for (const topicId of headerExtras) {
            let v = String(extractTopicValueFromAI(rawText, topicId, 'strict') || '').trim();
            if (!hasMeaningfulValue(v)) {
              v = String(extractTopicValueFromAI(rawText, topicId, 'loose') || '').trim();
            }
            pushDetectedExtraTopic(topicId, v);
          }

          const prevSpecialista = String(baselineTopicValues?.specialista || '').trim();
          let candidateSpecialista = String(extractTopicValueFromAI(rawText, 'specialista', 'strict') || '').trim();
          if (!hasMeaningfulValue(candidateSpecialista)) {
            candidateSpecialista = String(extractSpecialistaLooseFallback(rawText) || '').trim();
          }
          if (!hasMeaningfulValue(candidateSpecialista)) {
            candidateSpecialista = String(extractTopicValueFromAI(rawText, 'specialista', 'loose') || '').trim();
          }
          const normStrip = stripLeadingGHeaders(normalizeAiTopicRawText(rawText)).trim();
          const specHeader =
            (nextTask.rawHeaderTopics || []).includes('specialista') ||
            !!matchSpecialistaHeaderBlockStart(normStrip);
          nextTask.specialistaInRaw = hasMeaningfulValue(candidateSpecialista) || specHeader;
          nextTask.specialistaPreviousValue = prevSpecialista;
          nextTask.specialistaCandidateValue = candidateSpecialista;
          if (specHeader && !hasMeaningfulValue(candidateSpecialista)) {
            log(`⚠ ${nextTask.key}: v RAW je nadpis SPECIALISTA, ale tělo se nepodařilo strojově vyčíst — viz konzole RAW.`);
          }
          if (shouldReplaceSpecialista(prevSpecialista, candidateSpecialista)) {
            state.translated[nextTask.key].specialista = String(candidateSpecialista || '').trim();
            nextTask.specialistaDecision = t('topicRepair.decision.acceptAuto');
            log(t('topicRepair.log.specialistAutoUpgradeRepair', { key: nextTask.key }));
          } else if (nextTask.specialistaInRaw) {
            nextTask.specialistaDecision = t('topicRepair.decision.rejectAuto');
          } else {
            nextTask.specialistaDecision = '';
          }

          const hdrOther = (nextTask.rawHeaderTopics || []).filter(id => id !== nextTask.topicId);
          const hdrLabels = hdrOther.map(id => TOPIC_LABELS[id] || id).join(', ') || '—';
          const dtIds = (nextTask.detectedTopics || []).map(d => TOPIC_LABELS[d.topicId] || d.topicId).join(', ') || '—';
          log(`📎 ${nextTask.key} · „${TOPIC_LABELS[nextTask.topicId] || nextTask.topicId}“: v RAW bloky [${hdrLabels}] → další témata (UI): [${dtIds}] · SPECIALISTA: ${nextTask.specialistaInRaw ? 'ano' : 'ne'}`);

          const candidate = extractTopicValueFromAI(raw?.content || '', nextTask.topicId, 'strict');
          if (!hasMeaningfulValue(candidate)) {
            throw new Error(t('topicRepair.error.emptyAiResult'));
          }
          nextTask.provider = prov;
          nextTask.candidateValue = String(candidate || '').trim();
          nextTask.checked = shouldAutoCheckTopicRepairTask(nextTask.topicId, nextTask.currentValue, nextTask.candidateValue);
          nextTask.status = 'done';
          success = true;
          log(t('topicRepair.log.topicRepairedVia', { key: nextTask.key, topic: nextTask.topicId, provider: prov }));
          break;
        } catch (e) {
          nextTask.error = e.message || t('topicRepair.error.unknown');
        } finally {
          state.topicRepairState.currentTask = null;
          updateTopicRepairProviderStatus();
        }
      }
       if (!success) {
         nextTask.status = 'failed';
       }
       updateTopicRepairModalUI();
       await saveProgress();
       // Interval mezi úkoly — fallback na DOM nebo 20s pokud state.currentInterval není nastaven
       const seqInterval = Math.max(5, Number(state.currentInterval) || parseInt(document.getElementById('intervalRun')?.value, 10) || parseInt(document.getElementById('interval')?.value, 10) || 20);
       await sleepMs(seqInterval * 1000);
    }
    updateTopicRepairModalUI();
    if (state.topicRepairState && !state.topicRepairState.closed) {
      const waitingVis = getTopicRepairModalVisibleTasks(state).filter(t => t.status === 'waiting').length;
      if (waitingVis === 0) showToast(t('toast.topicRepair.visibleDone'));
    }
  } finally {
    state.topicRepairWorkerRunning = false;
  }
}

function toggleTopicRepairTask(index, checked) {
  const topicRepairState = state.topicRepairState;
  if (!state || !topicRepairState.tasks[index]) return;
  topicRepairState.tasks[index].checked = !!checked;
  updateTopicRepairModalUI();
}

function toggleTopicRepairRun() {
  if (!state.topicRepairState) return;
  const topicRepairState = state.topicRepairState;
  if (state.repairStrategy !== 'sequential' || !state.sequentialEverStarted) {
    showToast(state.repairStrategy === 'bulk' ? t('topicRepair.hint.bulkMode') : t('topicRepair.hint.startSequential'));
    return;
  }
  state.paused = !state.paused;
  updateTopicRepairModalUI();
  if (!state.paused && !state.topicRepairWorkerRunning) processTopicRepairQueue();
}

function shouldAutoAcceptDetectedTopic(topicId, previousValue, candidateValue) {
  if (!hasMeaningfulValue(candidateValue)) return false;
  if (topicId === 'definice' && isDefinitionLowQuality(candidateValue)) {
    // Povolit krátké, jednoslovné definice s českou diakritikou (např. "dávka")
    const words = String(candidateValue).trim().split(/\s+/).filter(Boolean);
    const hasCzechDiacritics = /[áčďéěíňóřšťúůýž]/i.test(candidateValue);
    if (words.length <= 2 && hasCzechDiacritics) return true;
    return false;
  }
  if (topicId === 'specialista') return shouldReplaceSpecialista(previousValue, candidateValue);
  return !hasMeaningfulValue(previousValue);
}

function setTopicRepairSpecialistaDecision(index, decision) {
  const topicRepairState = state.topicRepairState;
  if (!state || !topicRepairState.tasks[index]) return;
  const task = topicRepairState.tasks[index];
  if (!task.specialistaInRaw || !hasMeaningfulValue(task.specialistaCandidateValue)) return;
  state.translated[task.key] = state.translated[task.key] || {};
  if (decision === 'accept') {
    state.translated[task.key].specialista = String(task.specialistaCandidateValue || '').trim();
    task.specialistaDecision = t('topicRepair.decision.acceptManual');
    showToast(t('toast.specialista.approved', { key: task.key }));
  } else {
    state.translated[task.key].specialista = String(task.specialistaPreviousValue || '').trim();
    task.specialistaDecision = t('topicRepair.decision.rejectManual');
    showToast(t('toast.specialista.rejected', { key: task.key }));
  }
  saveProgress();
  if (state.activeKey === task.key) renderDetail();
  updateTopicRepairModalUI();
}

function setTopicRepairDetectedTopicDecision(taskIndex, topicId, decision) {
  const topicRepairState = state.topicRepairState;
  if (!state || !topicRepairState.tasks[taskIndex]) return;
  const task = topicRepairState.tasks[taskIndex];
  const row = (task.detectedTopics || []).find(x => x.topicId === topicId);
  if (!row || !hasMeaningfulValue(row.candidateValue)) return;
  state.translated[task.key] = state.translated[task.key] || {};
  if (decision === 'accept') {
    state.translated[task.key][topicId] = String(row.candidateValue || '').trim();
    row.decision = t('topicRepair.decision.acceptManual');
    showToast(t('toast.topic.approved', { topic: TOPIC_LABELS[topicId] || topicId, key: task.key }));
  } else {
    state.translated[task.key][topicId] = String(row.previousValue || '').trim();
    row.decision = t('topicRepair.decision.rejectManual');
    showToast(t('toast.topic.rejected', { topic: TOPIC_LABELS[topicId] || topicId, key: task.key }));
  }
  if (topicId === 'specialista') {
    task.specialistaDecision = row.decision;
  }
  saveProgress();
  if (state.activeKey === task.key) renderDetail();
  updateTopicRepairModalUI();
}

function toggleTopicRepairManualApproval(index) {
  const topicRepairState = state.topicRepairState;
  if (!state || !topicRepairState || !topicRepairState.tasks[index]) return;
  const task = topicRepairState.tasks[index];
  const ignoreKey = `${task.key}:${task.topicId}`;
  if (!state.topicRepairManuallyApproved) state.topicRepairManuallyApproved = new Set();
  if (state.topicRepairManuallyApproved.has(ignoreKey)) {
    state.topicRepairManuallyApproved.delete(ignoreKey);
    task.manuallyApproved = false;
    task.hidden = false;
    showToast(t('toast.topicRepair.unmarkOk'));
  } else {
    state.topicRepairManuallyApproved.add(ignoreKey);
    task.manuallyApproved = true;
    task.hidden = true;
    showToast(t('toast.topicRepair.markOk'));
  }
  saveTopicRepairManualApprovals();
  saveProgress();
  updateTopicRepairModalUI();
}

function saveTopicRepairManualApprovals() {
  if (!state.topicRepairManuallyApproved) return;
  try {
    const arr = Array.from(state.topicRepairManuallyApproved);
    localStorage.setItem('strong_topic_repair_approved', JSON.stringify(arr));
  } catch (e) {
    console.warn('[TopicRepair] Chyba pri ukladani manual approvals:', e);
  }
}

function loadTopicRepairManualApprovals() {
  try {
    const raw = localStorage.getItem('strong_topic_repair_approved');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        state.topicRepairManuallyApproved = new Set(arr);
      }
    }
  } catch (e) {
    console.warn('[TopicRepair] Chyba pri nacitani manual approvals:', e);
  }
}

function applyTopicRepairSelected() {
   const topicRepairState = state.topicRepairState;
   if (!topicRepairState) return;
   let applied = 0;
   for (const task of topicRepairState.tasks) {
     if (!task.checked || !hasMeaningfulValue(task.candidateValue)) continue;
     if (task.hidden) continue; // skip manually approved (hidden) tasks
     state.translated[task.key] = state.translated[task.key] || {};
     state.translated[task.key][task.topicId] = task.candidateValue;
     applied++;
     // Clear the task after applying to update UI correctly
     task.candidateValue = '';
     task.checked = false;
   }
  if (applied > 0) {
    saveProgress();
    renderList();
    if (state.activeKey) renderDetail();
    updateStats();
    updateFailedCount();
    log(`✓ Potvrzeno přepsání témat v opravě: ${applied} řádků`);
  }
  state.selectedKeys.clear();
  renderList();
  const eligible = topicRepairState.tasks.filter(t => hasMeaningfulValue(t.candidateValue));
  const checkedOk = topicRepairState.tasks.filter(t => t.checked && hasMeaningfulValue(t.candidateValue));
  if (applied === 0) {
    if (eligible.length && !checkedOk.length) {
      showToast(t('toast.topicRepair.checkValidRows'));
    } else if (!eligible.length) {
      showToast(t('toast.topicRepair.noValidProposal'));
    } else {
      showToast(t('toast.topicRepair.nothingMarked'));
    }
  } else {
    const keysInModal = [...new Set(topicRepairState.tasks.map(t => t.key))];
    const allTopicsOk = keysInModal.every(k => getFailedTopicsForFallback(state.translated[k] || {}).length === 0);
    if (allTopicsOk) {
      showToast(t('toast.topic.overwrittenAndClosing', { count: applied }));
      stopTopicRepairTicker();
      state.topicRepairState.closed = true;
      closeTopicRepairModalSafe();
      state.topicRepairState = null;
      const miniBtn = document.getElementById('btnTopicRepairMini');
      if (miniBtn) {
        miniBtn.style.display = 'none';
        miniBtn.classList.remove('topicRepairMiniBusy');
      }
    } else {
      showToast(t('toast.topic.overwritten.count', { count: applied }));
    }
   }
   // Update UI if modal is still open (not closed)
   if (state.topicRepairState) {
     renderTopicRepairModal();
   }
   syncTopicRepairMinimizeBusyIndicator();
 }

function closeTopicRepairModalOnly() {
  closeTopicRepairModalSafe();
}

function minimizeTopicRepairModal() {
  if (!state.topicRepairState) return;
  state.topicRepairState.minimized = true;
  closeTopicRepairModalSafe();
  const miniBtn = document.getElementById('btnTopicRepairMini');
  if (miniBtn) miniBtn.style.display = 'inline-block';
  syncTopicRepairMinimizeBusyIndicator();
}

function restoreTopicRepairModal() {
  if (!state.topicRepairState) return;
  state.topicRepairState.minimized = false;
  renderTopicRepairModal();
  const miniBtn = document.getElementById('btnTopicRepairMini');
  if (miniBtn) miniBtn.style.display = 'none';
  syncTopicRepairMinimizeBusyIndicator();
}

function toggleShowApproved() {
  if (!state.topicRepairState) return;
  state.showApproved = !state.showApproved;
  updateTopicRepairModalUI();
}


const TOPIC_BATCH_PROMPT_PRESET_MAP = {
  vyznam: 'preset_topic_vyznam_batch',
  definice: 'preset_topic_definice_batch',
  kjv: 'preset_topic_kjv_batch',
  puvod: 'preset_topic_puvod_batch',
  specialista: 'preset_topic_specialista_batch',
  all: 'preset_topic_all_batch'
};

/** Pořadí témat při hromadné opravě „Vše“. */
const TOPIC_REPAIR_BULK_TOPIC_ORDER = ['definice', 'vyznam', 'kjv', 'puvod', 'specialista'];

function defaultBulkListTopicFilter() {
  return { definice: true, vyznam: true, kjv: true, puvod: true, specialista: true };
}

function getTopicRepairModalVisibleTasks(state) {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState || !Array.isArray(topicRepairState.tasks)) return [];
  
  // Režim "zobrazit schválené" – ignoruj všechny filtry
  if (state.showApproved) {
    return topicRepairState.tasks.filter(t => t.hidden);
  }
  
  // Běžné filtrování (dropdown téma + filtry)
  const bid = state.bulkTopicId || 'all';
  let tasks = topicRepairState.tasks;
  if (bid === 'all') {
    const m = state.bulkListTopicFilter || defaultBulkListTopicFilter();
    tasks = tasks.filter(t => m[t.topicId] !== false && !t.hidden);
  } else {
    tasks = tasks.filter(t => t.topicId === bid && !t.hidden);
  }
  return tasks;
}

/** Další čekající úloha v pořadí `topicRepairState.tasks`, ale jen pokud spadá do aktuálního filtru tématu. */
function findNextTopicRepairWaitingTask(state) {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState || !Array.isArray(topicRepairState.tasks)) return null;
  const vset = new Set(getTopicRepairModalVisibleTasks(state));
  return topicRepairState.tasks.find(t => t.status === 'waiting' && vset.has(t)) || null;
}

const TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX = 'strong_topic_repair_batch_prompt_v1_';
const TOPIC_REPAIR_BATCH_SYSTEM_PROMPT_SUFFIX = '_sys';
const TOPIC_REPAIR_BATCH_USER_PROMPT_SUFFIX = '_usr';

function getTopicRepairBatchPromptStorageKey(topicId) {
  return `${TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX}${topicId}`;
}

function getTopicRepairSystemPromptStorageKey(topicId) {
  return `${TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX}${topicId}${TOPIC_REPAIR_BATCH_SYSTEM_PROMPT_SUFFIX}`;
}

function getTopicRepairUserPromptStorageKey(topicId) {
  return `${TOPIC_REPAIR_BATCH_PROMPT_STORAGE_PREFIX}${topicId}${TOPIC_REPAIR_BATCH_USER_PROMPT_SUFFIX}`;
}

function applyPromptLanguageTokens(promptText) {
  const targetLang = localStorage.getItem('strong_target_lang') || 'cz';
  const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
  const keyMap = {
    cz: 'lang.name.genitive.cz',
    cs: 'lang.name.genitive.cz',
    en: 'lang.name.genitive.en',
    bg: 'lang.name.genitive.bg',
    ch: 'lang.name.genitive.ch',
    sp: 'lang.name.genitive.sp',
    sk: 'lang.name.genitive.sk',
    pl: 'lang.name.genitive.pl',
    gr: 'lang.name.genitive.gr',
    he: 'lang.name.genitive.he',
    both: 'lang.name.genitive.both'
  };
  const targetName = t(keyMap[String(targetLang || '').toLowerCase()] || 'lang.name.genitive.cz');
  const sourceName = t(keyMap[String(sourceLang || '').toLowerCase()] || 'lang.name.genitive.gr');
  return String(promptText || '')
    .replace(/{TARGET_LANG}/g, targetName)
    .replace(/{SOURCE_LANG}/g, sourceName);
}

function getTopicRepairSystemPrompt(topicId) {
  const key = getTopicRepairSystemPromptStorageKey(topicId);
  const saved = String(localStorage.getItem(key) || '').trim();
  if (saved) return saved;
  return getDefaultBatchTopicSystemPrompt(topicId);
}

function getTopicRepairUserPrompt(topicId) {
  const key = getTopicRepairUserPromptStorageKey(topicId);
  const saved = String(localStorage.getItem(key) || '').trim();
  if (saved) return saved;
  return applyPromptLanguageTokens(getDefaultBatchTopicUserPrompt(topicId));
}

function saveTopicRepairBatchPromptDraft() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const topicId = document.getElementById('topicRepairBulkTopicSelect')?.value || state.bulkTopicId || 'all';
  if (topicId === 'all') {
    showToast(t('toast.prompt.pickSpecificTopicSave'));
    return;
  }
  const sysTa = document.getElementById('topicRepairSystemPrompt');
  const usrTa = document.getElementById('topicRepairUserPrompt');
  if (!sysTa || !usrTa) return;
  localStorage.setItem(getTopicRepairSystemPromptStorageKey(topicId), String(sysTa.value || ''));
  localStorage.setItem(getTopicRepairUserPromptStorageKey(topicId), String(usrTa.value || ''));
  showToast(t('toast.batchPrompt.saved', { topic: TOPIC_LABELS[topicId] || topicId }));
}

function resetTopicRepairBatchPromptToDefault() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const topicId = document.getElementById('topicRepairBulkTopicSelect')?.value || state.bulkTopicId || 'all';
  if (topicId === 'all') {
    showToast(t('toast.prompt.pickSpecificTopicReset'));
    return;
  }
  localStorage.removeItem(getTopicRepairSystemPromptStorageKey(topicId));
  localStorage.removeItem(getTopicRepairUserPromptStorageKey(topicId));
  const sysTa = document.getElementById('topicRepairSystemPrompt');
  const usrTa = document.getElementById('topicRepairUserPrompt');
  if (sysTa) sysTa.value = getDefaultBatchTopicSystemPrompt(topicId);
  if (usrTa) usrTa.value = applyPromptLanguageTokens(getDefaultBatchTopicUserPrompt(topicId));
  showToast(t('toast.batchPrompt.reset', { topic: TOPIC_LABELS[topicId] || topicId }));
}

function refreshTopicRepairBatchPromptEditor() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  const topicId = document.getElementById('topicRepairBulkTopicSelect')?.value || state.bulkTopicId || 'all';
  state.bulkTopicId = topicId;
  const row = document.getElementById('topicRepairBulkListFilterRow');
  if (row) row.style.display = topicId === 'all' ? 'flex' : 'none';
  const sysTa = document.getElementById('topicRepairSystemPrompt');
  const usrTa = document.getElementById('topicRepairUserPrompt');
  if (!sysTa || !usrTa) return;
  if (topicId === 'all') {
    sysTa.readOnly = true;
    usrTa.readOnly = true;
    sysTa.value = t('topicRepair.bulk.allModeHelp');
    usrTa.value = t('topicRepair.bulk.allModeHelp');
  } else {
    sysTa.readOnly = false;
    usrTa.readOnly = false;
    sysTa.value = getTopicRepairSystemPrompt(topicId);
    usrTa.value = getTopicRepairUserPrompt(topicId);
  }
  updateTopicRepairModalUI();
}

function toggleTopicRepairBulkListFilter(topicId, checked) {
  const topicRepairState = state.topicRepairState;
  if (!state || state.bulkTopicId !== 'all') return;
  state.bulkListTopicFilter = state.bulkListTopicFilter || defaultBulkListTopicFilter();
  state.bulkListTopicFilter[topicId] = !!checked;
  updateTopicRepairModalUI();
}

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

function getTopicBatchAiLabel(topicId) {
  return ({
    vyznam: 'VYZNAM',
    definice: 'DEFINICE',
    kjv: 'KJV',
    puvod: 'PUVOD',
    specialista: 'SPECIALISTA'
  })[topicId] || 'VYZNAM';
}

function parseTopicRepairBatchResponse(rawText, topicId) {
  const text = normalizeAiTopicRawText(rawText).trim();
  if (!text) return {};
  // Akceptuj ###G66### i ###66### (písmeno volitelné)
  const blocks = text.split(/\n(?=#{1,6}\s*[gGhH]?\d+)/i);
  const out = {};
  const headerRe = /^#{2,6}\s*([gGhH]?)(\d+)\s*(?:#+\s*)?(?=\n|$|\r)/im;
  for (const block of blocks) {
    const b = String(block || '').trim();
    if (!b) continue;
    const header = b.match(headerRe);
    if (!header) continue;
    // Pokud písmeno chybí, předpokládáme 'G' (default)
    const letter = (header[1] || 'G').toUpperCase();
    const num = header[2];
    const key = letter + num;
    const rest = b.slice(header.index + header[0].length).trim();
    let val = String(extractTopicValueFromAI(rest, topicId, 'strict') || '').trim();
    if (!hasMeaningfulValue(val)) {
      val = String(extractTopicValueFromAI(rest, topicId, 'loose') || '').trim();
    }
    if (hasMeaningfulValue(val)) out[key] = val;
  }
  return out;
}

/** Výřez bloku jednoho hesla z hromadné RAW odpovědi (pro parsování SPECIALISTA apod.). */
function extractTopicRepairBatchBlockForKey(rawText, key) {
  const text = String(normalizeAiTopicRawText(rawText) || '').trim();
  const upperKey = String(key || '').trim().toUpperCase();
  if (!text || !upperKey) return '';
  // Akceptuj ###G66### i ###66###
  const blocks = text.split(/\n(?=#{1,6}\s*[gGhH]?\d+)/i);
  const headerRe = /^#{2,6}\s*([gGhH]?)(\d+)\s*(?:#+\s*)?(?=\n|$|\r)/im;
  for (const block of blocks) {
    const b = String(block || '').trim();
    if (!b) continue;
    const header = b.match(headerRe);
    if (!header) continue;
    const letter = (header[1] || '').toUpperCase();
    const num = header[2];
    const numOnly = num;
    const k = ((letter || 'G') + num).toUpperCase();
    // Hledání s i bez písmene – pokud AI vynechala písmeno, zkusíme obě varianty
    if (k === upperKey || numOnly === upperKey.replace(/^[GH]/, '') ||
        'G' + numOnly === upperKey || 'H' + numOnly === upperKey) return b;
  }
  return '';
}

/** Naplní specialista* u tasku z libovolného RAW (dávka = jen blok ###G12###…). */
function syncTopicRepairTaskSpecialistaFromRaw(task, rawText) {
  if (!task) return;
  const baseline = state.translated[task.key] || {};
  const prevSpecialista = String(baseline.specialista || '').trim();
  let candidateSpecialista = String(extractTopicValueFromAI(rawText, 'specialista', 'strict') || '').trim();
  if (!hasMeaningfulValue(candidateSpecialista)) {
    candidateSpecialista = String(extractSpecialistaLooseFallback(rawText) || '').trim();
  }
  if (!hasMeaningfulValue(candidateSpecialista)) {
    candidateSpecialista = String(extractTopicValueFromAI(rawText, 'specialista', 'loose') || '').trim();
  }
  const normStrip = stripLeadingGHeaders(normalizeAiTopicRawText(rawText)).trim();
  const hdrTopics = scanRawForTopicHeaderTopicIds(rawText);
  const specHeader = hdrTopics.includes('specialista') || !!matchSpecialistaHeaderBlockStart(normStrip);
  task.specialistaInRaw = hasMeaningfulValue(candidateSpecialista) || specHeader;
  task.specialistaPreviousValue = prevSpecialista;
  task.specialistaCandidateValue = candidateSpecialista;
  if (specHeader && !hasMeaningfulValue(candidateSpecialista)) {
    log(`⚠ ${task.key} (dávka): v bloku je nadpis SPECIALISTA/alias, ale tělo se nepodařilo strojově vyčíst — viz konzole RAW.`);
  }
  state.translated[task.key] = state.translated[task.key] || {};
  if (shouldReplaceSpecialista(prevSpecialista, candidateSpecialista)) {
    state.translated[task.key].specialista = String(candidateSpecialista || '').trim();
    task.specialistaDecision = t('topicRepair.decision.acceptAuto');
  } else if (task.specialistaInRaw) {
    task.specialistaDecision = t('topicRepair.decision.rejectAuto');
  } else {
    task.specialistaDecision = '';
  }
}

async function waitTopicRepairSequentialIdle(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const running = !!state.topicRepairState?.tasks?.some(t => t.status === 'running');
    const current = !!state.topicRepairState?.currentTask;
    if (!running && !current) return true;
    await sleepMs(120);
  }
  return false;
}

function syncTopicRepairBulkRunInputsToHidden() {
  const bIn = document.getElementById('topicRepairBulkBatchInput');
  const iIn = document.getElementById('topicRepairBulkIntervalInput');
  const hB = document.getElementById('batchSizeRun');
  const hI = document.getElementById('intervalRun');
  if (bIn && hB) {
    const n = Math.min(100, Math.max(1, parseInt(bIn.value, 10) || 10));
    bIn.value = String(n);
    hB.value = String(n);
  }
  if (iIn && hI) {
    const n = Math.min(600, Math.max(0, parseInt(iIn.value, 10) || 20));
    iIn.value = String(n);
    hI.value = String(n);
  }
  updateTopicRepairBulkRunSummarySpan();
}

function updateTopicRepairBulkRunSummarySpan() {
  const el = document.getElementById('topicRepairBulkRunSummary');
  if (!el) return;
  const bs = parseInt(document.getElementById('batchSizeRun')?.value, 10) || 10;
  const iv = parseInt(document.getElementById('intervalRun')?.value, 10) || 20;
  el.textContent = t('topicRepair.bulk.summaryLikeAuto', { batch: bs, seconds: iv });
}

function initTopicRepairBulkRunInputs() {
  const bIn = document.getElementById('topicRepairBulkBatchInput');
  const iIn = document.getElementById('topicRepairBulkIntervalInput');
  const hB = document.getElementById('batchSizeRun');
  const hI = document.getElementById('intervalRun');
  if (bIn && hB) bIn.value = String(Math.min(100, Math.max(1, parseInt(hB.value, 10) || 10)));
  if (iIn && hI) iIn.value = String(Math.min(600, Math.max(0, parseInt(hI.value, 10) || 20)));
  updateTopicRepairBulkRunSummarySpan();
}

/** Jedno téma — vnitřní smyčka dávek (režim „Vše“ i jedno téma z editoru). */
// Aktualizuje stat spany u providerů v topicRepair modalu
function updateTopicRepairProviderStats() {
  try {
    const limits = (typeof window !== 'undefined' && window.getProviderLimits) ? window.getProviderLimits() : {};
    const getReqCount = (prov) => parseInt(sessionStorage.getItem('provider_req_count_' + prov) || '0', 10);

    // OR: počet requestů / limit
    const orEl = document.getElementById('trOrStats');
    if (orEl) {
      const orCount = getReqCount('openrouter');
      const orLimit = limits.openrouter?.reqs;
      orEl.textContent = orCount + (orLimit ? '/' + orLimit : '') + ' req';
      orEl.style.color = (orLimit && orCount >= orLimit) ? 'var(--err)' : 'var(--txt3)';
    }

    // Gemini: počet requestů + tokeny
    const gmEl = document.getElementById('trGeminiStats');
    if (gmEl) {
      const gmCount = getReqCount('gemini');
      const gmLimit = limits.gemini?.reqs;
      const gmTok = state.totalTokens?.in ? Math.round((state.totalTokens.in - (state.groqTokens?.in || 0)) / 1000) : 0;
      const reqStr = gmCount + (gmLimit ? '/' + gmLimit : '') + ' req';
      gmEl.textContent = reqStr;
      gmEl.style.color = (gmLimit && gmCount >= gmLimit) ? 'var(--err)' : 'var(--txt3)';
    }

    // Groq: tokeny
    const groqEl = document.getElementById('trGroqTokens');
    if (groqEl && state.groqTokens?.total) {
      const limits2 = limits;
      const groqLimit = limits2.groq?.tokens;
      const groqTok = state.groqTokens.total;
      groqEl.textContent = Math.round(groqTok / 1000) + 'K' + (groqLimit ? '/' + Math.round(groqLimit / 1000) + 'K' : '') + ' tok';
      groqEl.style.color = (groqLimit && groqTok >= groqLimit) ? 'var(--err)' : 'var(--txt3)';
    }
  } catch(e) {}
}

async function runTopicRepairBulkTranslationCore(state, topicId, systemPrompt, userPromptTemplate, onlyFailed, bs, providerFilter = null) {
  let tasks = state.topicRepairState.tasks.filter(t => t && t.topicId === topicId && t.includeBulk !== false);
  let picked;
  if (onlyFailed) {
    picked = tasks.filter(t => t.status === 'failed' || !hasMeaningfulValue(t.candidateValue));
  } else {
    picked = tasks;
  }
  let keys = [...new Set(picked.map(t => t.key))]; // deduplikace
  if (!keys.length) {
    const fallback = state.topicRepairState.tasks.filter(t => t && !t.hidden).map(t => t.key);
    keys = [...new Set(fallback)];
    if (keys.length) {
      log('Relaxed filter: using all ' + keys.length + ' keys for ' + topicId);
    }
  }
  if (!keys.length) return { count: 0 };

  const enabledProviders = ['groq', 'gemini', 'openrouter'].filter(p => {
    if (providerFilter && !providerFilter.includes(p)) return false;
    if (!state.topicRepairState?.providerEnabled?.[p]) return false;
    const k = getCurrentApiKey(p);
    return k && k.trim().length > 0;
  });
  if (!enabledProviders.length) {
    throw new Error(t('toast.topicRepair.enableProvider') || 'No provider enabled for topic repair');
  }

  const iv0 = parseInt(document.getElementById('intervalRun')?.value, 10) || parseInt(document.getElementById('interval')?.value, 10) || 20;
  const sysContent = String(systemPrompt || getResolvedSystemMessage() || '').trim();
  const abortVersion = Number(state.topicRepairBulkAbortVersion || 0);

  log(t('topicRepair.log.bulkRepairStart', { topic: TOPIC_LABELS[topicId] || topicId, count: keys.length, batch: bs, seconds: iv0 }));
  log('Paraleln\u00ed bulk oprava [' + topicId + ']: ' + enabledProviders.join(', ') + ' | d\u00e1vka ' + bs + ' | interval ' + iv0 + 's');

  // Atomický index — každý worker si bere svou část bez race condition
  // (JS single-thread: slice+increment proběhne bez přerušení, žádný await uvnitř)
  let queueIndex = 0;
  let totalProcessed = 0;

  function takeNextBulkBatch(batchSize) {
    if (queueIndex >= keys.length) return null;
    const batch = keys.slice(queueIndex, queueIndex + batchSize);
    queueIndex += batchSize;
    // Označit hned jako running — bez await, takže atomicky
    for (const key of batch) {
      const task = state.topicRepairState.tasks.find(t => t.key === key && t.topicId === topicId);
      if (task) task.status = 'running';
    }
    return batch;
  }

  // Aplikuje výsledky jedné dávky do tasků
  function applyBulkBatchResult(prov, batchKeys, parsedMap, rawText, error) {
    for (const key of batchKeys) {
      const task = state.topicRepairState.tasks.find(t => t.key === key && t.topicId === topicId);
      if (!task) continue;
      if (error) {
        task.status = 'failed';
        task.error = error;
        continue;
      }
      const numericKey = key.replace(/^[GH]/, '');
      const val = String(parsedMap[key] || parsedMap[numericKey] || parsedMap['G' + numericKey] || parsedMap['H' + numericKey] || '').trim();
      if (hasMeaningfulValue(val)) {
        task.candidateValue = val;
        task.provider = prov;
        task.status = 'done';
        task.error = '';
        task.checked = shouldAutoCheckTopicRepairTask(topicId, task.currentValue, val);
        const blockRaw = extractTopicRepairBatchBlockForKey(rawText, key) || rawText;
        if (task.topicId === 'specialista') {
          syncTopicRepairTaskSpecialistaFromRaw(task, blockRaw);
        }
      } else {
        task.status = 'failed';
        task.error = t('topicRepair.error.noValueForEntry');
      }
    }
    totalProcessed += batchKeys.length;
    saveProgress();
    updateTopicRepairModalUI();
  }

  // Worker pro jeden provider — bere dávky ze sdílené fronty, každý čeká svůj interval
  async function bulkProviderWorker(prov) {
    const apiKey = getCurrentApiKey(prov);
    const TR_FALLBACK_MODELS = { groq: 'meta-llama/llama-4-scout-17b-16e-instruct', gemini: 'gemini-2.0-flash-lite', openrouter: 'openrouter/rotate' };
    const model = getPipelineModelForProvider(prov) || document.getElementById('model')?.value || TR_FALLBACK_MODELS[prov];
    if (!apiKey) {
      log('[' + prov + '] chybí API klíč, worker se nespustí');
      return;
    }
    if (!model) {
      log('[' + prov + '] chybí model, worker se nespustí');
      return;
    }
    // Per-provider nastavení — fallback na globální hodnoty
    const _provLimits = (typeof window !== 'undefined' && window.getProviderLimits) ? window.getProviderLimits() : {};
    const _provBatchRaw = _provLimits[prov]?.batchSize;
    const effectiveBs = (_provBatchRaw && Number(_provBatchRaw) > 0) ? Math.max(1, Number(_provBatchRaw)) : bs;
    const _provIntervalRaw = _provLimits[prov]?.interval;
    const effectiveIv = (_provIntervalRaw != null && _provIntervalRaw !== '' && Number(_provIntervalRaw) >= 0)
      ? Number(_provIntervalRaw)
      : iv0;

    log('[' + prov + '] bulk worker startuje: ' + model + ' | dávka ' + effectiveBs + ' | interval ' + effectiveIv + 's');

    while (true) {
      if (abortVersion !== Number(state.topicRepairBulkAbortVersion || 0)) break;

      // Zkontrolovat request limit pro všechny providery
      if (typeof window !== 'undefined' && window.checkProviderRequestLimit) {
        if (window.checkProviderRequestLimit(prov)) {
          log('[' + prov + '] dosažen limit požadavků — zastavuji bulk worker');
          break;
        }
        window.incrementProviderReqCount && window.incrementProviderReqCount(prov);
      }

      // Atomicky vzít dávku (bez await uvnitř = bezpečné)
      const batchKeys = takeNextBulkBatch(effectiveBs);
      if (!batchKeys) break;

      updateTopicRepairModalUI();
      log('[' + prov + '] bulk ' + topicId + ': ' + batchKeys[0] + '-' + batchKeys[batchKeys.length - 1]);

      try {
        const hesla = buildTopicRepairBatchHeslaText(batchKeys, topicId);
        const userContent = userPromptTemplate.includes('{HESLA}')
          ? userPromptTemplate.replace(/{HESLA}/g, hesla)
          : (userPromptTemplate + '\n\n' + hesla);

        const raw = await callAIWithRetry(prov, apiKey, model, [
          { role: 'system', content: sysContent },
          { role: 'user', content: enforceSpecialistaFormat(userContent) }
        ]);

        if (abortVersion !== Number(state.topicRepairBulkAbortVersion || 0)) break;

        const rawText = String(raw?.content || '').trim();
        const parsedMap = parseTopicRepairBatchResponse(rawText, topicId);
        applyBulkBatchResult(prov, batchKeys, parsedMap, rawText, null);
        updateTopicRepairProviderStats();

        // Vlastní interval — každý provider čeká nezávisle
        const waitUntil = Date.now() + effectiveIv * 1000;
        while (Date.now() < waitUntil) {
          if (abortVersion !== Number(state.topicRepairBulkAbortVersion || 0)) break;
          await sleepMs(Math.min(500, waitUntil - Date.now()));
        }

      } catch (e) {
        logError('bulkProviderWorker', e, { prov, batchKeys, topicId });
        applyBulkBatchResult(prov, batchKeys, {}, '', e.message);
        updateTopicRepairProviderStats();

        // Rate limit — delší cooldown jen pro tohoto providera
        const msgL = (e.message || '').toLowerCase();
        const isRate = msgL.includes('429') || msgL.includes('rate limit') || msgL.includes('quota') || msgL.includes('too many') || msgL.includes('resource_exhausted');
        const cooldown = isRate
          ? (() => {
              let c = 60;
              const m = (e.message || '').match(/retry.after[:\s]*(\d+)/i);
              if (m) c = Math.max(c, parseInt(m[1], 10) || 0);
              if (msgL.includes('resource_exhausted')) c = Math.max(c, 20 * 60);
              return c;
            })()
          : effectiveIv;

        if (isRate) log('[' + prov + '] rate limit, cekam ' + cooldown + 's');
        const waitUntil = Date.now() + cooldown * 1000;
        while (Date.now() < waitUntil) {
          if (abortVersion !== Number(state.topicRepairBulkAbortVersion || 0)) break;
          await sleepMs(Math.min(500, waitUntil - Date.now()));
        }
      }
    }
  }

  // Spustit všechny workery paralelně
  await Promise.all(enabledProviders.map(prov => bulkProviderWorker(prov)));
  return { count: totalProcessed };
}

async function runTopicRepairBulkTranslation() {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  if (state.topicRepairBulkRunning) {
    state.topicRepairBulkAbortVersion++;
    showToast(t('toast.topicRepair.bulkStopping'));
    const bulkBtn = document.getElementById('topicRepairBulkRunBtn');
    if (bulkBtn) {
      bulkBtn.disabled = true;
      bulkBtn.textContent = t('topicRepair.bulk.button');
    }
    return;
  }
  syncTopicRepairBulkRunInputsToHidden();
  const selTopic = document.getElementById('topicRepairBulkTopicSelect')?.value || state.bulkTopicId || 'all';
  state.bulkTopicId = selTopic;
  const onlyFailed = !!document.getElementById('topicRepairBulkOnlyFailed')?.checked;
  const bs = parseInt(document.getElementById('batchSizeRun')?.value, 10) || 10;

  const enabledProviders = ['groq', 'gemini', 'openrouter'].filter(p => topicRepairState.providerEnabled[p]);
  if (!enabledProviders.length) {
    showToast(t('toast.topicRepair.enableProvider'));
    return;
  }

  state.topicRepairBulkRunning = true;
  state.topicRepairBulkAbortVersion++;
  const bulkBtn = document.getElementById('topicRepairBulkRunBtn');
  if (bulkBtn) {
    bulkBtn.disabled = false;
    bulkBtn.textContent = t('topicRepair.bulk.stop');
  }

  const wasPaused = !!state.paused;
  state.paused = true;
  const idleOk = await waitTopicRepairSequentialIdle();
  if (!idleOk) {
    showToast(t('toast.topicRepair.sequentialRunning'));
    state.paused = wasPaused;
    state.topicRepairBulkRunning = false;
    if (bulkBtn) {
      bulkBtn.disabled = false;
      bulkBtn.textContent = t('topicRepair.bulk.button');
    }
    return;
  }

  try {
    const iv0 = parseInt(document.getElementById('intervalRun')?.value, 10) || 20;
    const provTopics = state.topicRepairState?.providerTopic || {};

    // Rozdělit providery: ti s konkrétním tématem vs ti s "Vše" (globální výběr)
    const globalProviders = enabledProviders.filter(p => (provTopics[p] || 'all') === 'all');
    const specificGroups = {};
    for (const prov of enabledProviders) {
      const pt = provTopics[prov] || 'all';
      if (pt !== 'all') {
        if (!specificGroups[pt]) specificGroups[pt] = [];
        specificGroups[pt].push(prov);
      }
    }

    const parallelTasks = [];

    // Každý provider s konkrétním tématem běží paralelně samostatně
    for (const [topicId, provs] of Object.entries(specificGroups)) {
      const sysPrompt = getTopicRepairSystemPrompt(topicId);
      const usrPrompt = applyPromptLanguageTokens(String(getTopicRepairUserPrompt(topicId) || '').trim());
      if (!usrPrompt) { log(`⚠ Přeskočeno téma ${topicId} — prázdný batch prompt.`); continue; }
      parallelTasks.push(runTopicRepairBulkTranslationCore(state, topicId, sysPrompt, usrPrompt, onlyFailed, bs, provs));
    }

    // Provideři s "Vše" používají globální výběr tématu
    if (globalProviders.length) {
      if (selTopic === 'all') {
        const mask = state.bulkListTopicFilter || defaultBulkListTopicFilter();
        const topicsToRun = TOPIC_REPAIR_BULK_TOPIC_ORDER.filter(id => mask[id] !== false);
        if (!topicsToRun.length && !parallelTasks.length) {
          showToast(t('toast.topicRepair.pickTopicInAllMode'));
          return;
        }
        if (topicsToRun.length) {
          parallelTasks.push((async () => {
            let ranAny = false;
            for (let ti = 0; ti < topicsToRun.length; ti++) {
              const topicId = topicsToRun[ti];
              const sysPrompt = getTopicRepairSystemPrompt(topicId);
              const usrPrompt = applyPromptLanguageTokens(String(getTopicRepairUserPrompt(topicId) || '').trim());
              if (!usrPrompt) { log(`⚠ Přeskočeno téma ${topicId} — prázdný uložený batch prompt.`); continue; }
              const res = await runTopicRepairBulkTranslationCore(state, topicId, sysPrompt, usrPrompt, onlyFailed, bs, globalProviders);
              if (res.count > 0) ranAny = true;
              if (ti < topicsToRun.length - 1 && iv0 > 0) await sleepMs(iv0 * 1000);
            }
            showToast(ranAny ? t('topicRepair.bulkAllDone', { count: topicsToRun.length }) : t('topicRepair.bulkAllNone'));
          })());
        }
      } else {
        const sysTa = document.getElementById('topicRepairSystemPrompt');
        const usrTa = document.getElementById('topicRepairUserPrompt');
        const sysPrompt = sysTa ? sysTa.value.trim() : '';
        const usrPrompt = applyPromptLanguageTokens(String(usrTa?.value || '').trim());
        if (!usrPrompt && !parallelTasks.length) {
          showToast(t('toast.batchPrompt.empty'));
          return;
        }
        if (usrPrompt) {
          parallelTasks.push((async () => {
            const res = await runTopicRepairBulkTranslationCore(state, selTopic, sysPrompt, usrPrompt, onlyFailed, bs, globalProviders);
            if (res.count === 0) showToast(t('toast.batchRun.nothingSelected'));
            else showToast(t('toast.topic.bulkDone', { topic: TOPIC_LABELS[selTopic] || selTopic, count: res.count }));
          })());
        }
      }
    }

    if (!parallelTasks.length) {
      showToast(t('toast.batchPrompt.empty'));
      return;
    }

    await Promise.all(parallelTasks);
  } catch (e) {
    if (e && e.message !== 'missing_api_key' && e.message !== 'topic_repair_bulk_aborted') {
      showToast(t('toast.error.withMessage', { message: (e.message || e) }));
    }
  } finally {
    state.paused = wasPaused;
    state.topicRepairBulkRunning = false;
    if (bulkBtn) {
      bulkBtn.disabled = false;
      bulkBtn.textContent = t('topicRepair.bulk.button');
    }
    updateTopicRepairModalUI();
    if (state.sequentialEverStarted && state.repairStrategy === 'sequential' && !state.paused && !state.topicRepairWorkerRunning) {
      processTopicRepairQueue();
    }
  }
}

function toggleTopicRepairBulkInclude(index, checked) {
  const topicRepairState = state.topicRepairState;
  if (!state || !topicRepairState.tasks[index]) return;
  topicRepairState.tasks[index].includeBulk = !!checked;
}

function setTopicRepairBulkIncludeAll(checked) {
  const topicRepairState = state.topicRepairState;
  if (!topicRepairState) return;
  for (const task of topicRepairState.tasks) task.includeBulk = !!checked;
  updateTopicRepairModalUI();
}

function getTopicPromptTemplateByPromptType(promptType) {
  const topicType = String(promptType || '').trim();
  if (!topicType || !topicType.startsWith('preset_topic_')) return '';
  return String(getModelTestPromptCatalog()?.[topicType]?.template || '').trim();
}

function getTopicPromptTemplate(topicId) {
  // Nejdřív zkusíme i18n klíč (aiPrompts.core.topicRepair.{topicId}.template)
  const i18nKey = `aiPrompts.core.topicRepair.${topicId}.template`;
  const fromI18n = t(i18nKey);
  if (fromI18n && fromI18n !== i18nKey) {
    return String(fromI18n).trim();
  }
  // Pak fallback na TOPIC_PROMPT_PRESET_MAP
  const promptType = TOPIC_PROMPT_PRESET_MAP[topicId] || '';
  const fromTopicPreset = getTopicPromptTemplateByPromptType(promptType);
  if (fromTopicPreset) return fromTopicPreset;
  const mode = String(localStorage.getItem('strong_prompt_mode') || 'system').toLowerCase();
  if (mode === 'custom') {
    return String(localStorage.getItem('strong_prompt') || getResolvedDefaultPrompt() || '').trim();
  }
  return String(getResolvedDefaultPrompt() || '').trim();
}

function syncTopicPromptTemplatesReport() {
  const mismatched = Object.entries(TOPIC_PROMPT_PRESET_MAP).filter(([topicId, promptType]) => {
    const fromCatalog = String(getModelTestPromptCatalog()?.[promptType]?.template || '').trim();
    const fromDetailBase = String(getTopicPromptTemplate(topicId) || '').trim();
    return !fromCatalog || fromCatalog !== fromDetailBase;
  });
  if (mismatched.length > 0) {
    log(`⚠ Topic prompt sync: ${mismatched.map(([topicId]) => topicId).join(', ')}`);
  } else {
    log('✓ Topic prompt sync: testy/detail jsou 1:1');
  }
}

function getTopicRepairPromptFromStorage(topicId) {
  const sysKey = getTopicRepairSystemPromptStorageKey(topicId);
  const usrKey = getTopicRepairUserPromptStorageKey(topicId);
  return {
    system: String(localStorage.getItem(sysKey) || '').trim() || null,
    user: String(localStorage.getItem(usrKey) || '').trim() || null
  };
}

function buildTopicPrompt(key, topicId) {
  const e = state.entryMap.get(key) || {};
  const topicLabel = TOPIC_LABELS[topicId] || topicId;
  const promptTemplate = getTopicPromptTemplate(topicId);

  const firstLine = `${e.key || key} | ${e.greek || ''}${e.tvaroslovi ? ` (${e.tvaroslovi})` : ''}`;

  let extraLines = [];
  if (topicId === 'definice') {
    if (e.definice || e.def) extraLines.push(`DEF: ${e.definice || e.def}`);
  }

  const sourceText = [firstLine, ...extraLines].join('\n');

  const specialistaDetailRule = topicId === 'specialista'
    ? `\n\n${t('aiPrompts.topic.specialistaStyleRule')}`
    : '';

  return `${enforceSpecialistaFormat(promptTemplate)}

---
${t('aiPrompts.topic.singleTopicTranslateNow')}
- ${t('aiPrompts.topic.entryLabel')}: ${key}
- ${t('aiPrompts.topic.fieldLabel')}: ${topicLabel} (${topicId})
- ${t('aiPrompts.topic.returnOnlyFieldRule')}

${t('aiPrompts.topic.sourceDataLabel')}:
${sourceText}
${specialistaDetailRule}`;
}

function openTopicPromptModal(key, topicId) {
  const topicLabel = TOPIC_LABELS[topicId] || topicId;
  const currentValue = String(state.translated?.[key]?.[topicId] || '').trim();

  // Načtení topic-specific promptů z úložiště (Oprava témat)
  const storedPrompts = getTopicRepairPromptFromStorage(topicId);

  let prompt, systemPrompt;
  if (storedPrompts.user) {
    // Použijeme uložený user prompt s vložením dat hesla
    const hesloText = buildTopicRepairBatchHeslaText([key], topicId);
    prompt = storedPrompts.user.includes('{HESLA}')
      ? storedPrompts.user.replace(/{HESLA}/g, hesloText)
      : `${storedPrompts.user}\n\n${hesloText}`;
    systemPrompt = storedPrompts.system;
  } else {
    // Použijeme výchozí batch šablonu pro dané téma
    const hesloText = buildTopicRepairBatchHeslaText([key], topicId);
    prompt = getDefaultBatchTopicUserPrompt(topicId) || '';
    prompt = prompt.includes('{HESLA}')
      ? prompt.replace(/{HESLA}/g, hesloText)
      : `${prompt}\n\n${hesloText}`;
    systemPrompt = getDefaultBatchTopicSystemPrompt(topicId);
  }

  state.topicPromptState = {
    key,
    topicId,
    prompt,
    currentValue,
    systemPrompt
  };

  closeTopicPromptModal();
  const modal = document.createElement('div');
  modal.id = 'topicPromptModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10020;padding:16px';
  modal.innerHTML = `
    <div style="width:min(980px,95vw);max-height:92vh;overflow:auto;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:16px">
      <h3 style="margin:0 0 10px 0;color:var(--acc)">${escHtml(t('topicPrompt.title', { topic: topicLabel, key }))}</h3>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:8px">${t('topicPrompt.editBeforeSend')}</div>
      <textarea id="topicPromptInput" style="width:100%;min-height:220px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:10px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="hbtn grn" id="topicPromptRunBtn" onclick="runTopicPromptAI()">${t('topicPrompt.send')}</button>
        <button class="hbtn" onclick="closeTopicPromptModal()">${t('topicPrompt.close')}</button>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:11px;color:var(--txt2);margin-bottom:6px">${t('topicPrompt.currentFilled')}</div>
        <textarea id="topicPromptCurrentValue" readonly style="width:100%;min-height:120px;background:var(--bg);border:1px solid var(--brd);border-radius:4px;color:var(--txt2);padding:10px;font-family:inherit;font-size:13px;line-height:1.5"></textarea>
      </div>
      <div style="margin-top:14px">
        <div style="font-size:11px;color:var(--txt2);margin-bottom:6px">${t('topicPrompt.resultEditable')}</div>
        <textarea id="topicPromptResult" style="width:100%;min-height:180px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:10px;font-family:inherit;font-size:13px;line-height:1.5" placeholder="${escHtml(t('topicPrompt.resultPlaceholder'))}"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="hbtn grn" onclick="applyTopicPromptResult()">${t('topicPrompt.applyToField')}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  const promptInput = document.getElementById('topicPromptInput');
  if (promptInput) promptInput.value = state.topicPromptState.prompt;
  const currentInput = document.getElementById('topicPromptCurrentValue');
  if (currentInput) currentInput.value = state.topicPromptState.currentValue || '—';
}

async function runTopicPromptAI() {
  if (!state.topicPromptState) return;
  const prov = resolveProviderForInteractiveAction(document.getElementById('provider').value);
  const model = prov === (document.getElementById('provider').value || '') ? document.getElementById('model').value : getPipelineModelForProvider(prov);
  const apiKey = getCurrentApiKey(prov);
  if (!apiKey) {
    showToast(t('toast.apiKey.enter'));
    return;
  }

  const promptInput = document.getElementById('topicPromptInput');
  const resultInput = document.getElementById('topicPromptResult');
  const runBtn = document.getElementById('topicPromptRunBtn');
  if (!promptInput || !resultInput || !runBtn) return;

  const customPrompt = promptInput.value.trim();
  if (!customPrompt) {
    showToast(t('toast.prompt.empty'));
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = t('topicPrompt.sending');
  try {
    // Použití topic-specific systémového promptu pokud existuje
    const systemPrompt = state.topicPromptState.systemPrompt || getResolvedSystemMessage();
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: customPrompt }
    ];
    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    const rawText = String(raw?.content || '').trim();
    resultInput.value = rawText;
    log(t('topicRepair.log.topicTranslationEngine', { engine: getTranslationEngineLabel(raw, prov, model) }));
    log(t('topicRepair.log.rawTopicPrinted', { key: state.topicPromptState.key, topic: state.topicPromptState.topicId }));
  } catch (e) {
    logError('runTopicPromptAI', e, { key: state.topicPromptState.key, topic: state.topicPromptState.topicId });
    showToast(t('toast.error.withMessage', { message: e.message }));
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = t('topicPrompt.send');
  }
}

function applyTopicPromptResult() {
  if (!state.topicPromptState) return;
  const { key, topicId } = state.topicPromptState;
  const resultInput = document.getElementById('topicPromptResult');
  if (!resultInput) return;
  const rawAiText = String(resultInput.value || '');
  let val = extractTopicValueFromAI(rawAiText, topicId, 'strict');
  if (!hasMeaningfulValue(val)) {
    val = extractTopicValueFromAI(rawAiText, topicId, 'loose');
  }
  if (!hasMeaningfulValue(val)) {
    // Topic prompt muze vratit jen cisty text bez parser-safe hlavicky.
    val = normalizeAiTopicRawText(rawAiText);
  }
  val = String(val || '').trim();
  if (!hasMeaningfulValue(val)) {
    showToast(t('toast.prompt.empty'));
    return;
  }
  if (!state.translated[key]) state.translated[key] = {};
  const prevValue = String(state.translated[key]?.[topicId] || '').trim();
  if (topicId === 'definice' && isDefinitionLowQuality(val)) {
    showToast(t('toast.topicPrompt.definitionLowQuality'));
    return;
  }
  if (hasMeaningfulValue(prevValue) && !shouldReplaceTopicValue(topicId, prevValue, val)) {
    if (topicId === 'specialista') {
      showToast(t('toast.topicPrompt.specialistNotBetter'));
    } else {
      showToast(t('toast.topicPrompt.fieldNotBetter', { topic: TOPIC_LABELS[topicId] || topicId }));
    }
    return;
  }
  const prevSpecialista = String(state.translated[key]?.specialista || '').trim();
  state.translated[key][topicId] = val;
  const candidateSpecialistaStrict = extractTopicValueFromAI(rawAiText, 'specialista', 'strict');
  const candidateSpecialistaLoose = extractTopicValueFromAI(rawAiText, 'specialista', 'loose');
  const candidateSpecialista = hasMeaningfulValue(candidateSpecialistaStrict) ? candidateSpecialistaStrict : candidateSpecialistaLoose;
  if (shouldReplaceSpecialista(prevSpecialista, candidateSpecialista)) {
    state.translated[key].specialista = String(candidateSpecialista || '').trim();
    log(`🧠 SPECIALISTA auto-upgrade ${key}: použit kvalitnější text z AI odpovědi`);
  }

   // Pokud AI vrátí i další témata, zkus je bezpečně sloučit (jen když jsou kvalitnější).
   const topicIds = ['vyznam', 'definice', 'puvod', 'kjv', 'specialista'];
   for (const extraTopicId of topicIds) {
    if (extraTopicId === topicId) continue;
    const strictVal = extractTopicValueFromAI(rawAiText, extraTopicId, 'strict');
    const looseVal = extractTopicValueFromAI(rawAiText, extraTopicId, 'loose');
    const extraVal = String(hasMeaningfulValue(strictVal) ? strictVal : looseVal).trim();
    if (!hasMeaningfulValue(extraVal)) continue;
    if (extraTopicId === 'definice' && isDefinitionLowQuality(extraVal)) continue;
    const prevExtra = String(state.translated[key]?.[extraTopicId] || '').trim();
    if (hasMeaningfulValue(prevExtra) && !shouldReplaceTopicValue(extraTopicId, prevExtra, extraVal)) continue;
    state.translated[key][extraTopicId] = extraVal;
    log(`✨ DETAIL auto-merge ${key}.${extraTopicId}: aplikováno z jedné AI odpovědi`);
  }
  saveProgress();
  renderDetail();
  renderList();
  updateStats();
  closeTopicPromptModal();
  showToast(t('toast.topic.savedToField', { topic: TOPIC_LABELS[topicId] || topicId }));
}

function getSpecialistaQualityScore(text) {
  const t = String(text || '').trim();
  if (!hasMeaningfulValue(t)) return 0;
  let score = 0;
  const len = t.length;
  if (len >= 180) score += 2;
  if (len >= 300) score += 2;
  if (len >= 500) score += 1;
  const sentenceCount = t.split(/[.!?]+/).map(x => x.trim()).filter(Boolean).length;
  if (sentenceCount >= 2) score += 1;
  if (sentenceCount >= 3) score += 2;
  if (sentenceCount >= 5) score += 1;
  const biblicalHints = (t.match(/\b(Bůh|Kristus|Ježíš|evangelium|hřích|spása|soud|milost|víra|teolog|teologie|biblick|zjevení|žalm|job|přísloví|nový zákon|starý zákon)\b/gi) || []).length;
  score += Math.min(4, biblicalHints);
  const englishNoise = (t.match(/\b(the|and|which|used|only|without|see|word|in|of|to)\b/gi) || []).length;
  score -= Math.min(4, englishNoise);
  return score;
}

function shouldReplaceSpecialista(currentText, candidateText) {
  const next = String(candidateText || '').trim();
  if (!hasMeaningfulValue(next)) return false;
  const current = String(currentText || '').trim();
  if (!hasMeaningfulValue(current)) return true;
  const currentScore = getSpecialistaQualityScore(current);
  const nextScore = getSpecialistaQualityScore(next);
  if (nextScore > currentScore + 1) return true;
  if (nextScore === currentScore && next.length > current.length + 80) return true;
  return false;
}

function countCzDiacritics(text) {
  return (String(text || '').match(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮݎ]/g) || []).length;
}

function countEnglishNoiseWords(text) {
  return (String(text || '').match(/\b(the|and|which|used|only|without|see|word|in|of|to)\b/gi) || []).length;
}

function countBracketRefs(text) {
  return (String(text || '').match(/\[[^\]]{2,}\]/g) || []).length;
}

function scoreTopicRepairText(topicId, text) {
 const textStr = String(text || '').trim();
  if (!hasMeaningfulValue(textStr)) return { score: 0, notes: [t('topicRepair.analysis.note.empty')] };
  const notes = [];
  let score = 0;

  if (topicId === 'definice') {
    const len = textStr.length;
    score += Math.min(6, Math.floor(len / 120));
    score += Math.min(3, countBracketRefs(textStr));
    score += Math.min(3, Math.floor(countCzDiacritics(textStr) / 6));
    if (isDefinitionLowQuality(textStr)) {
      score -= 8;
      notes.push(t('topicRepair.analysis.note.definitionLowQuality'));
    }
    if (isDefinitionLikelyEnglish(textStr)) {
      score -= 6;
      notes.push(t('topicRepair.analysis.note.definitionEnglishTone'));
    }
    score -= Math.min(4, countEnglishNoiseWords(textStr));
    return { score, notes };
  }

  if (topicId === 'vyznam') {
    const words = textStr.split(/\s+/).filter(Boolean).length;
    score += Math.min(4, words);
    score += Math.min(3, Math.floor(countCzDiacritics(textStr) / 2));
    score -= Math.min(4, countEnglishNoiseWords(textStr));
    if (words > 14) {
      score -= 2;
      notes.push(t('topicRepair.analysis.note.meaningTooLong'));
    }
    return { score, notes };
  }

  if (topicId === 'kjv') {
    score += Math.min(5, Math.floor(textStr.length / 40));
    score += Math.min(3, countBracketRefs(textStr));
    score += Math.min(3, Math.floor(countCzDiacritics(textStr) / 4));
    score -= Math.min(5, countEnglishNoiseWords(textStr));
    return { score, notes };
  }

  if (topicId === 'puvod') {
    score += Math.min(5, Math.floor(textStr.length / 60));
    score += Math.min(3, Math.floor(countCzDiacritics(textStr) / 5));
    score -= Math.min(4, countEnglishNoiseWords(textStr));
    if (!/(řec|hebr|lat|sém|indoev|kořen|odvoz)/i.test(textStr)) notes.push(t('topicRepair.analysis.note.originMissingContext'));
    return { score, notes };
  }

  if (topicId === 'specialista') {
    const s = getSpecialistaQualityScore(textStr);
    score += s;
    notes.push(t('topicRepair.analysis.note.specialistScore', { score: s }));
    return { score, notes };
  }

  score += Math.min(6, Math.floor(textStr.length / 80));
  score -= Math.min(4, countEnglishNoiseWords(textStr));
  return { score, notes };
}

function verdictTopicRepairCompare(prevScore, nextScore) {
  if (!Number.isFinite(prevScore) || !Number.isFinite(nextScore)) return { kind: 'unclear', label: t('topicRepair.analysis.verdict.unclear'), tone: 'var(--txt3)' };
  const d = nextScore - prevScore;
  if (nextScore <= 0 && prevScore > 0) return { kind: 'worse', label: t('topicRepair.analysis.verdict.worse'), tone: 'var(--red)' };
  if (d >= 2) return { kind: 'better', label: t('topicRepair.analysis.verdict.better'), tone: 'var(--acc3)' };
  if (d <= -2) return { kind: 'worse', label: t('topicRepair.analysis.verdict.worse'), tone: 'var(--red)' };
  return { kind: 'similar', label: t('topicRepair.analysis.verdict.similar'), tone: 'var(--txt3)' };
}

function formatTopicRepairQuickCompare(topicId, previousValue, candidateValue) {
  const prev = String(previousValue || '').trim();
  const next = String(candidateValue || '').trim();
  if (!hasMeaningfulValue(next)) {
    return `<div style="margin-top:6px;padding:8px;border:1px dashed var(--brd);border-radius:6px;background:var(--bg2);font-size:11px;color:var(--txt3)"><b>${t('topicRepair.analysis.title')}</b> ${t('topicRepair.analysis.cannotCompare')}</div>`;
  }
  const p = scoreTopicRepairText(topicId, prev);
  const n = scoreTopicRepairText(topicId, next);
  const v = verdictTopicRepairCompare(p.score, n.score);
  const notes = [...new Set([...(p.notes || []), ...(n.notes || [])])].slice(0, 3);
  const notesHtml = notes.length ? ` · ${notes.map(x => escHtml(x)).join(' · ')}` : '';
  return `<div style="margin-top:6px;padding:8px;border:1px solid var(--brd);border-radius:6px;background:var(--bg2);font-size:11px;color:var(--txt2)">
    <b>${t('topicRepair.analysis.title')}</b> <span style="color:${v.tone};font-weight:bold">${escHtml(v.label)}</span>
    <span style="color:var(--txt3)">(${t('topicRepair.analysis.score', { from: p.score, to: n.score })})</span>${notesHtml}
  </div>`;
}

function closeTopicPromptModal() {
  const modal = document.getElementById('topicPromptModal');
  if (modal) modal.remove();
}

function openSystemPromptModal(key) {
  const entry = state.entryMap.get(key);
  if (!entry) {
    showToast(t('toast.entry.notFound'));
    return;
  }
  const messages = buildPromptMessages([entry]);
  const systemText = String(messages.find(m => m.role === 'system')?.content || getResolvedSystemMessage() || '').trim();
  const userText = String(messages.find(m => m.role === 'user')?.content || '').trim();
  state.systemPromptState = { key, systemText, userText };
  closeSystemPromptModal();
  const modal = document.createElement('div');
  modal.id = 'systemPromptModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:10020;padding:16px';
  modal.innerHTML = `
    <div style="width:min(980px,95vw);max-height:92vh;display:flex;flex-direction:column;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:16px;overflow:hidden">
      <h3 style="margin:0 0 10px 0;color:var(--acc)">${escHtml(t('systemPrompt.title', { key }))}</h3>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:8px">${t('systemPrompt.editBeforeSend')}</div>
      <textarea id="systemPromptInput" style="width:100%;min-height:240px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:10px;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5;resize:vertical"></textarea>
      <details style="margin-top:10px;border:1px solid var(--brd);border-radius:6px;padding:8px;background:var(--bg3)">
        <summary style="cursor:pointer;color:var(--txt2);font-size:12px">${t('systemPrompt.translator.summary')}</summary>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
          <label for="systemPromptTranslateLang" style="font-size:12px;color:var(--txt2)">${t('systemPrompt.translator.language')}</label>
          <select id="systemPromptTranslateLang" style="background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);padding:6px">
            <option value="cs">Čeština</option>
            <option value="en">English</option>
            <option value="sk">Slovenština</option>
            <option value="pl">Polski</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="bg">Български</option>
            <option value="el">Ελληνικά</option>
            <option value="he">עברית</option>
            <option value="zh-CN">中文</option>
          </select>
          <button class="hbtn" type="button" id="systemPromptTranslateBtn" onclick="translateSystemPromptText()">${t('systemPrompt.translator.toResult')}</button>
          <button class="hbtn" type="button" id="systemPromptTranslateBackBtn" onclick="translateSystemPromptBackToEnglish()">${t('systemPrompt.translator.toEnglish')}</button>
          <button class="hbtn grn" type="button" id="systemPromptAiReviewBtn" onclick="reviewSystemPromptWithAI()">${t('systemPrompt.translator.aiReview')}</button>
          <button class="hbtn grn" type="button" id="systemPromptAiBuildBtn" onclick="buildSystemPromptFromRequirement()">${t('systemPrompt.translator.aiBuild')}</button>
        </div>
        <div id="systemPromptTranslateStatus" style="margin-top:6px;font-size:11px;color:var(--txt3)"></div>
      </details>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;flex-shrink:0">
        <button class="hbtn grn" id="systemPromptRunBtn" onclick="runSystemPromptAI()">${t('systemPrompt.send')}</button>
        <button class="hbtn" id="systemPromptConfirmBtn" onclick="runSystemPromptConfirm()" style="display:none">✅ ${t('systemPrompt.confirmAndSave')}</button>
        <button class="hbtn" onclick="closeSystemPromptModal()">${t('systemPrompt.close')}</button>
      </div>
      <div style="margin-top:10px;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden">
        <div style="font-size:11px;color:var(--txt2);margin-bottom:4px;flex-shrink:0">${t('systemPrompt.result')}</div>
        <div style="flex:1;min-height:0;overflow:auto;border:1px solid var(--brd);border-radius:4px;background:var(--bg3)">
        <textarea id="systemPromptResult" style="width:100%;min-height:180px;background:transparent;border:none;border-radius:4px;color:var(--txt);padding:10px;font-family:inherit;font-size:13px;line-height:1.5;resize:none" placeholder="${escHtml(t('systemPrompt.resultPlaceholder'))}"></textarea>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const inp = document.getElementById('systemPromptInput');
  if (inp) inp.value = userText || '';
  const uiLang = String(localStorage.getItem('strong_ui_lang') || 'cs').toLowerCase();
  const langEl = document.getElementById('systemPromptTranslateLang');
  if (langEl && Array.from(langEl.options).some(o => o.value === uiLang)) {
    langEl.value = uiLang;
  }
}

function mapPromptTranslatorTargetLang(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'cz') return 'cs';
  if (c === 'ch') return 'zh-CN';
  if (c === 'sp') return 'es';
  if (c === 'gr') return 'el';
  return code;
}

async function translateSystemPromptText() {
  const srcEl = document.getElementById('systemPromptInput');
  const outEl = document.getElementById('systemPromptResult');
  const langEl = document.getElementById('systemPromptTranslateLang');
  const statusEl = document.getElementById('systemPromptTranslateStatus');
  const btn = document.getElementById('systemPromptTranslateBtn');
  if (!srcEl || !outEl || !langEl || !btn) return;
  const text = String(srcEl.value || '').trim();
  if (!text) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.promptEmpty');
    return;
  }
  const targetRaw = String(langEl.value || 'cs');
  const target = mapPromptTranslatorTargetLang(targetRaw);
  btn.disabled = true;
  if (statusEl) statusEl.textContent = `Překládám do ${target}...`;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    const d = await r.json();
    const translated = Array.isArray(d?.[0]) ? d[0].map(x => x?.[0] || '').join('') : '';
    if (!translated.trim()) throw new Error('Prázdný výstup překladače');
    outEl.value = translated;
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.translated', { target });
  } catch (e) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.translateError', { message: e.message || e });
  } finally {
    btn.disabled = false;
  }
}

async function translateSystemPromptBackToEnglish() {
  const srcEl = document.getElementById('systemPromptResult');
  const outEl = document.getElementById('systemPromptInput');
  const statusEl = document.getElementById('systemPromptTranslateStatus');
  const btn = document.getElementById('systemPromptTranslateBackBtn');
  if (!srcEl || !outEl || !btn) return;
  const text = String(srcEl.value || '').trim();
  if (!text) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.resultEmpty');
    return;
  }
  btn.disabled = true;
  if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.translatingBack');
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url);
    const d = await r.json();
    const translated = Array.isArray(d?.[0]) ? d[0].map(x => x?.[0] || '').join('') : '';
    if (!translated.trim()) throw new Error('Prázdný výstup překladače');
    outEl.value = translated;
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.translatedBack');
  } catch (e) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.translateError', { message: e.message || e });
  } finally {
    btn.disabled = false;
  }
}

async function reviewSystemPromptWithAI() {
  if (!state.systemPromptState) return;
  const srcEl = document.getElementById('systemPromptResult');
  const outEl = document.getElementById('systemPromptInput');
  const statusEl = document.getElementById('systemPromptTranslateStatus');
  const btn = document.getElementById('systemPromptAiReviewBtn');
  if (!srcEl || !outEl || !btn) return;
  const fromResult = String(srcEl.value || '').trim();
  const fromPrompt = String(outEl.value || '').trim();
  const candidate = fromResult || fromPrompt;
  if (!candidate) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.nothingToReview');
    return;
  }

  const prov = resolveProviderForInteractiveAction(document.getElementById('provider').value);
  const model = prov === (document.getElementById('provider').value || '')
    ? document.getElementById('model').value
    : getPipelineModelForProvider(prov);
  const apiKey = getCurrentApiKey(prov);
  if (!apiKey) {
    showToast(t('toast.apiKey.enter'));
    return;
  }

  const reviewInstruction = [
    'You are a prompt editor. Improve the English prompt below for clarity and consistency.',
    'Keep placeholders and parser field labels unchanged when present:',
    '- {TARGET_LANG}, {SOURCE_LANG}, {HESLA}',
    '- MEANING, DEFINITION, USAGE, ORIGIN, KJV, COMMENTARY',
    'Do not add any markdown fences. Return only the revised prompt text.'
  ].join('\n');

  btn.disabled = true;
  if (statusEl) {
    statusEl.textContent = fromResult
      ? t('systemPrompt.translator.status.aiReviewRunning', { provider: prov, model })
      : t('systemPrompt.translator.status.aiReviewFallbackToTop', { provider: prov, model });
  }
  try {
    const raw = await callAIWithRetry(prov, apiKey, model, [
      { role: 'system', content: reviewInstruction },
      { role: 'user', content: candidate }
    ]);
    const revised = String(raw?.content || '').trim();
    if (!revised) throw new Error('AI vrátila prázdný výstup');
    outEl.value = revised;
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.aiReviewDone', { provider: prov, model: raw?.resolvedModel || model });
  } catch (e) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.aiReviewError', { message: e.message || e });
  } finally {
    btn.disabled = false;
  }
}

async function buildSystemPromptFromRequirement() {
  if (!state.systemPromptState) return;
  const reqEl = document.getElementById('systemPromptResult');
  const outEl = document.getElementById('systemPromptInput');
  const statusEl = document.getElementById('systemPromptTranslateStatus');
  const btn = document.getElementById('systemPromptAiBuildBtn');
  if (!reqEl || !outEl || !btn) return;
  const requirement = String(reqEl.value || '').trim();
  if (!requirement) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.requirementEmpty');
    return;
  }

  const prov = resolveProviderForInteractiveAction(document.getElementById('provider').value);
  const model = prov === (document.getElementById('provider').value || '')
    ? document.getElementById('model').value
    : getPipelineModelForProvider(prov);
  const apiKey = getCurrentApiKey(prov);
  if (!apiKey) {
    showToast(t('toast.apiKey.enter'));
    return;
  }

  const buildInstruction = [
    'You are a prompt engineer.',
    'Create a clean English prompt from the user requirement.',
    'Return only the final prompt text, no commentary, no markdown fences.',
    'When relevant, preserve parser-safe field labels and placeholders:',
    '- MEANING, DEFINITION, USAGE, ORIGIN, KJV, COMMENTARY',
    '- {TARGET_LANG}, {SOURCE_LANG}, {HESLA}',
    'Keep the prompt explicit and production-ready.'
  ].join('\n');

  btn.disabled = true;
  if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.aiBuildRunning', { provider: prov, model });
  try {
    const raw = await callAIWithRetry(prov, apiKey, model, [
      { role: 'system', content: buildInstruction },
      { role: 'user', content: requirement }
    ]);
    const builtPrompt = String(raw?.content || '').trim();
    if (!builtPrompt) throw new Error('AI vrátila prázdný prompt');
    outEl.value = builtPrompt;
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.aiBuildDone', { provider: prov, model: raw?.resolvedModel || model });
  } catch (e) {
    if (statusEl) statusEl.textContent = t('systemPrompt.translator.status.aiBuildError', { message: e.message || e });
  } finally {
    btn.disabled = false;
  }
}

async function runSystemPromptAI() {
  if (!state.systemPromptState) return;
  const { key, systemText } = state.systemPromptState;
  const prov = resolveProviderForInteractiveAction(document.getElementById('provider').value);
  const model = prov === (document.getElementById('provider').value || '') ? document.getElementById('model').value : getPipelineModelForProvider(prov);
  const apiKey = getCurrentApiKey(prov);
  if (!apiKey) {
    showToast(t('toast.apiKey.enter'));
    return;
  }
  const promptInput = document.getElementById('systemPromptInput');
  const resultInput = document.getElementById('systemPromptResult');
  const runBtn = document.getElementById('systemPromptRunBtn');
  if (!promptInput || !resultInput || !runBtn) return;
  const userPrompt = String(promptInput.value || '').trim();
  if (!userPrompt) {
    showToast(t('toast.prompt.empty'));
    return;
  }
  runBtn.disabled = true;
  runBtn.textContent = t('systemPrompt.sending');
  try {
    const raw = await callAIWithRetry(prov, apiKey, model, [
      { role: 'system', content: systemText || getResolvedSystemMessage() },
      { role: 'user', content: userPrompt }
    ]);
    const rawText = String(raw?.content || '');
    resultInput.value = rawText.trim();
    const parsed = {};
    parseWithOpenRouterNormalization(rawText, [key], parsed);
    applyFallbacksToParsedMap([key], parsed);
    if (parsed[key]) {
      state.translated[key] = { ...(state.translated[key] || {}), ...parsed[key], raw: rawText };
      fillMissingVyznamFromSource([key]);
      fillMissingKjvFromSource([key]);
      annotateEnglishDefinitionsInTranslated([key]);
      saveProgress();
      renderDetail();
      renderList();
      updateStats();
      showToast(t('toast.translatedSystem.key', { key }));
    } else {
      showToast(t('toast.aiResponse.unmatched'));
    }
  } catch (e) {
    showToast(t('toast.error.withMessage', { message: e.message }));
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = t('systemPrompt.send');
    // Show confirm button after successful result so user can review before saving
    const confirmBtn = document.getElementById('systemPromptConfirmBtn');
    if (confirmBtn) {
      confirmBtn.style.display = '';
    }
  }
}

function runSystemPromptConfirm() {
  if (!state.systemPromptState) return;
  const { key } = state.systemPromptState;
  const resultInput = document.getElementById('systemPromptResult');
  if (!resultInput) return;
  const rawText = String(resultInput.value || '').trim();
  if (!rawText) {
    showToast(t('toast.prompt.empty'));
    return;
  }
  const parsed = {};
  parseWithOpenRouterNormalization(rawText, [key], parsed);
  applyFallbacksToParsedMap([key], parsed);
  if (parsed[key]) {
    state.translated[key] = { ...(state.translated[key] || {}), ...parsed[key], raw: rawText };
    fillMissingVyznamFromSource([key]);
    fillMissingKjvFromSource([key]);
    annotateEnglishDefinitionsInTranslated([key]);
    saveProgress();
    renderDetail();
    renderList();
    updateStats();
    showToast(t('toast.translatedSystem.key', { key }));
    // Hide confirm button after saving
    const confirmBtn = document.getElementById('systemPromptConfirmBtn');
    if (confirmBtn) confirmBtn.style.display = 'none';
  } else {
    showToast(t('toast.aiResponse.unmatched'));
  }
}

function closeSystemPromptModal() {
  const modal = document.getElementById('systemPromptModal');
  if (modal) modal.remove();
}

/** Sjednocení znaků z AI odpovědi (NFKC, ZWSP, plnocelá dvojtečka) kvůli parsování labelů. */
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

/** Odstraní opakované hlavičky ###G12### / ### G132 / ##H4 včetně mezer (i bez uzavíracích #). */
function stripLeadingGHeaders(text) {
  let t = String(text || '');
  for (let i = 0; i < 8; i++) {
    const next = t.replace(/^\s*#{2,6}\s*[gGhH]?\d+\s*(?:#+\s*)?/i, '').trimStart();
    if (next === t) break;
    t = next;
  }
  return t;
}

function isTopicRepairPipelineBusy() {
  const st = state.topicRepairState;
  if (!st || st.closed) return false;
  if (state.topicRepairWorkerRunning || state.topicRepairBulkRunning) return true;
  if (st.tasks?.some(t => t.status === 'running')) return true;
  if (st.currentTask) return true;
  return false;
}

function syncTopicRepairMinimizeBusyIndicator() {
  const btn = document.getElementById('btnTopicRepairMini');
  if (!btn) return;
  if (!state.topicRepairState) {
    btn.classList.remove('topicRepairMiniBusy');
    return;
  }
  const busy = !!state.topicRepairState.minimized && isTopicRepairPipelineBusy();
  btn.classList.toggle('topicRepairMiniBusy', busy);
}

/** Když strict parser SPECIALISTU nechytí (jiné mezery/znaky), vezmi text od nadpisu do dalšího pole. */
function extractSpecialistaLooseFallback(rawText) {
  let t = stripLeadingGHeaders(normalizeAiTopicRawText(rawText).trim()).trim();
  if (!t) return '';
  const byAnchors = extractTopicSegmentByAnchors(t, 'SPECIALISTA');
  if (hasMeaningfulValue(byAnchors)) return byAnchors.trim();

  const m = matchSpecialistaHeaderBlockStart(t);
  if (!m || m.index === undefined) return '';
  const start = m.index + m[0].length;
  const rest = t.slice(start);
    const nextHdr =
      /(?:^|[\n\u0085\u2028\u2029])[\s\u00A0]*(?:VYZNAM|DEFINICE|PUVOD|POUVOD|POVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|COMMENTARY|EXEGESIS|DEFINITION|MEANING|ORIGIN|DEF)\s*(?:\([^)\n]{0,240}\))?\s*(?:[:\uFF1A\u2013\u2014=\.\-|]|\n{1,4}\s*)/iu;
  const m2 = rest.search(nextHdr);
  const body = m2 >= 0 ? rest.slice(0, m2) : rest;
  return body.trim();
}

/** Po opravě tématu: nezaškrtávat hromadné přepsání jen při verdiktu „horší“ (jinak šlo omylem odškrtnout definici). */
function shouldAutoCheckTopicRepairTask(topicId, currentValue, candidateValue) {
  const prev = String(currentValue || '').trim();
  const next = String(candidateValue || '').trim();
  if (!hasMeaningfulValue(next)) return false;
  const p = scoreTopicRepairText(topicId, prev);
  const n = scoreTopicRepairText(topicId, next);
  const v = verdictTopicRepairCompare(p.score, n.score);
  return v.kind !== 'worse';
}

/** Jednotná normalizace názvů polí z AI (vč. VÝKLAD → SPECIALISTA). */
function normalizeTopicFieldLabel(raw) {
  const u = String(raw || '').trim().toUpperCase();
  if (u === 'DEF' || u === 'DEFINITION') return 'DEFINICE';
  if (u === 'V') return 'VYZNAM';
  if (u === 'D') return 'DEFINICE';
  if (u === 'P') return 'PUVOD';
  if (u === 'K') return 'KJV';
  if (u === 'S') return 'SPECIALISTA';
  if (u === 'MEANING') return 'VYZNAM';
  if (u === 'ORIGIN') return 'PUVOD';
  if (u === 'POVOD' || u === 'POUVOD') return 'PUVOD';
  if (u === 'VYKLAD' || u === 'VÝKLAD' || u === 'KOMENTAR' || u === 'KOMENTÁŘ' || u === 'EXEGEZE' || u === 'COMMENTARY' || u === 'EXEGESIS') return 'SPECIALISTA';
  return u;
}

/** Alternace názvů polí v AI odpovědi (jednotný zdroj pro anchor / řádkové parsování). */
const TOPIC_FIELD_LABEL_ALTS_FOR_RE = 'VYZNAM|DEFINICE|PUVOD|POUVOD|POVOD|KJV|SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|DEFINITION|MEANING|ORIGIN|COMMENTARY|EXEGESIS|DEF|V|D|P|K|S';

/** Po klíčovém slově často následuje „(specialista)“ / poznámka v závorce — bez toho selhával \s*[-:]. */
function makeTopicFieldHeaderScanRegex() {
  // Match label followed by colon, space, dash, or end
  return new RegExp(`(${TOPIC_FIELD_LABEL_ALTS_FOR_RE})(?:\\*\\*|__)?\\s*[:–—=.]`, 'giu');
}

/** Stejná pravidla jako u anchor regexu, navíc prefix markdownu / číslování na začátku řádku. */
function makeTopicFieldLineStartRegex() {
  return new RegExp(
    `^(?:\\s*)(?:(?:\\d+)[.)]\\s+)?(?:(?:[-*+>]|#{1,6})\\s+)?(?:(?:\\*\\*|__)\\s*)?(${TOPIC_FIELD_LABEL_ALTS_FOR_RE})(?:\\*\\*|__)?\\s*(?:\\([^)\\n]{0,240}\\))?\\s*[:–—=.|]+`,
    'iu'
  );
}

/** Hlavička sekce specialisty (aliasy + závorka + dvojtečka nebo nový řádek těla). */
function matchSpecialistaHeaderBlockStart(t) {
  const s = String(t || '');
  if (!s) return null;
  const LINE_START = '(?:^|[\n\u0085\u2028\u2029])[\\s\u00A0]*';
  const ALIAS = '(?:SPECIALISTA|VYKLAD|VÝKLAD|KOMENTAR|KOMENTÁŘ|EXEGEZE|COMMENTARY|EXEGESIS)';
  const PAREN_OPT = '(?:\\([^)\\n]{0,240}\\))?';
  const SEP = '(?:[:\\uFF1A\\u2013\\u2014=\\.\\-|]|\\n{1,4}\\s*)';
  const prefix = '(?:(?:\\d+)[.)]\\s+)?(?:(?:[-*+>]|#{1,6})\\s+)?(?:(?:\\*\\*|__)\\s*)?';
  const re = new RegExp(LINE_START + prefix + ALIAS + '(?:\\*\\*|__)?\\s*' + PAREN_OPT + '\\s*' + SEP + '\\s*', 'iu');
  return s.match(re);
}

/** Výřez bloku podle libovolného výskytu labelu v textu (i více polí na jednom řádku). */
function extractTopicSegmentByAnchors(cleaned, wantLabel) {
  const c = String(cleaned || '');
  if (!c || !wantLabel) return '';
  const re = makeTopicFieldHeaderScanRegex();
  const spans = [];
  let m;
  while ((m = re.exec(c)) !== null) {
    const lab = normalizeTopicFieldLabel(m[1]);
    if (!lab) continue;
    spans.push({ lab, endHeader: m.index + m[0].length, blockStart: m.index });
  }
  if (!spans.length) return '';
  const idx = spans.findIndex(s => s.lab === wantLabel);
  if (idx < 0) return '';
  const endPos = idx + 1 < spans.length ? spans[idx + 1].blockStart : c.length;
  return c.slice(spans[idx].endHeader, endPos).trim();
}

function mapNormalizedLabelToTopicId(norm) {
  const n = String(norm || '').toUpperCase();
  if (n === 'VYZNAM') return 'vyznam';
  if (n === 'DEFINICE') return 'definice';
  if (n === 'PUVOD') return 'puvod';
  if (n === 'KJV') return 'kjv';
  if (n === 'SPECIALISTA') return 'specialista';
  return null;
}

/** Pořadí témat podle prvního výskytu nadpisu v RAW (pro log a doplnění „dalších“). */
function scanRawForTopicHeaderTopicIds(rawText) {
  const text = normalizeAiTopicRawText(rawText).trim();
  if (!text) return [];
  let cleaned = stripLeadingGHeaders(text).trim();
  const re = makeTopicFieldHeaderScanRegex();
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const norm = normalizeTopicFieldLabel(m[1]);
    const tid = mapNormalizedLabelToTopicId(norm);
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    out.push(tid);
  }
  return out;
}

function extractTopicValueFromAI(rawText, topicId, mode = 'loose') {
  const text = normalizeAiTopicRawText(rawText).trim();
  if (!text) return '';

  const keyForTopic = {
    vyznam: 'VYZNAM',
    definice: 'DEFINICE',
    puvod: 'PUVOD',
    kjv: 'KJV',
    specialista: 'SPECIALISTA'
  }[topicId] || '';

  let cleaned = stripLeadingGHeaders(text).trim();

  const lines = cleaned.split('\n');
  const fieldPositions = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimL = rawLine.replace(/^\uFEFF/, '').replace(/^\s*\u200B+/, '').trimStart();
    const lead = rawLine.length - trimL.length;
    const m = trimL.match(makeTopicFieldLineStartRegex());
    if (!m) continue;
    const label = normalizeTopicFieldLabel(m[1]);
    fieldPositions.push({ label, line: i, len: lead + m[0].length });
  }

  if (mode === 'strict' && fieldPositions.length === 0 && keyForTopic) {
    const anchor = extractTopicSegmentByAnchors(cleaned, keyForTopic);
    if (hasMeaningfulValue(anchor)) return anchor.trim();
    return '';
  }

  if (keyForTopic && fieldPositions.some(f => f.label === keyForTopic)) {
    const idx = fieldPositions.findIndex(f => f.label === keyForTopic);
    const cur = fieldPositions[idx];
    const endLine = idx < fieldPositions.length - 1 ? fieldPositions[idx + 1].line : lines.length;
    let out = '';
    for (let i = cur.line; i < endLine; i++) {
      let part = lines[i];
      if (i === cur.line) part = part.slice(cur.len);
      part = part.trim();
      if (part) out += (out ? ' ' : '') + part;
    }
    out = out.trim();
    return out;
  }

   // Když chybí explicitní label cílového tématu, ale AI vrátí další labely,
   // fallback na plain text před prvním jiným labelem (pokud existuje).
   if (mode === 'strict' && fieldPositions.length > 0 && keyForTopic && !fieldPositions.some(f => f.label === keyForTopic)) {
     const anchor = extractTopicSegmentByAnchors(cleaned, keyForTopic);
     if (hasMeaningfulValue(anchor)) return anchor.trim();
     // Fallback: nothing
   }
   if (fieldPositions.length > 0 && keyForTopic && !fieldPositions.some(f => f.label === keyForTopic)) {
     // Bez explicitního labelu nevíme, kde začíná - vrátíme celý očištěný text
     return cleaned.trim();
   }
   if (keyForTopic) {
     cleaned = cleaned.replace(new RegExp(`^${keyForTopic}\\s*[-:–—=.]?\\s*`, 'i'), '').trim();
}
    return cleaned;
}

function buildTopicDataBlockForDetail(key, topicId) {
  const e = state.entryMap.get(key) || {};
  const lines = [];

  const idPart = e.key || key;
  const wordPart = e.greek || '';
  const tvarPart = e.tvaroslovi ? ` (${e.tvaroslovi})` : '';
  lines.push(`${idPart} | ${wordPart}${tvarPart}`);

  const translated = state.translated[key] || {};
  const currentVal = String(translated[topicId] || '').trim();
  const origVal = String(e[topicId === 'definice' ? 'definice' : topicId] || e.definice || e.def || '').trim();

  switch (topicId) {
    case 'definice':
      if (origVal) lines.push(`DEF: ${origVal}`);
      break;
    case 'vyznam':
      if (currentVal) lines.push(`V: ${currentVal}`);
      break;
    case 'kjv':
      if (e.kjv) lines.push(`K: ${e.kjv}`);
      break;
    case 'puvod':
      break;
    case 'specialista':
      if (currentVal) lines.push(`S: ${currentVal}`);
      break;
  }

  return lines.join('\n');
}

return {
     closeTopicRepairModalSafe,
     stopTopicRepairTicker,
     applyTopicRepairProviderCheckboxes,
     setTopicRepairProviderTopic,
     startTopicRepairFlow,
     setTopicRepairStrategy,
     startTopicRepairSequentialWorker,
     toggleTopicRepairTask,
     toggleTopicRepairRun,
     setTopicRepairSpecialistaDecision,
     setTopicRepairDetectedTopicDecision,
     toggleTopicRepairManualApproval,
     applyTopicRepairSelected,
     closeTopicRepairModalOnly,
     minimizeTopicRepairModal,
      restoreTopicRepairModal,
      toggleShowApproved,
      saveTopicRepairBatchPromptDraft,
     resetTopicRepairBatchPromptToDefault,
     refreshTopicRepairBatchPromptEditor,
     toggleTopicRepairBulkListFilter,
     syncTopicRepairBulkRunInputsToHidden,
     runTopicRepairBulkTranslation,
     toggleTopicRepairBulkInclude,
     setTopicRepairBulkIncludeAll,
     getTopicPromptTemplateByPromptType,
syncTopicPromptTemplatesReport,
      buildTopicPrompt,
      openTopicPromptModal,
      runTopicPromptAI,
      applyTopicPromptResult,
      shouldReplaceSpecialista,
      closeTopicPromptModal,
      openSystemPromptModal,
      runSystemPromptAI,
      runSystemPromptConfirm,
      closeSystemPromptModal,
      translateSystemPromptText,
      translateSystemPromptBackToEnglish,
      reviewSystemPromptWithAI,
     buildSystemPromptFromRequirement,
     getTopicRepairSystemPrompt,
     getTopicRepairUserPrompt,
     buildTopicRepairBatchHeslaText,
     buildTopicDataBlockForDetail,
     getDefaultBatchTopicSystemPrompt,
     getDefaultBatchTopicUserPrompt,
     extractTopicValueFromAI,
   };
}