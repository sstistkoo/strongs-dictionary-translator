import { state } from '../state.js';
import { t } from '../i18n.js';
import { escHtml } from '../utils.js';
import { parseCzTXT, parseImportJSON } from '../parser.js';
import { getTranslationStateForKey } from '../translation/utils.js';

export function createPreviewApi({ showToast, renderList, renderDetail, saveProgress, updateStats, translateSingle, retranslateSingle, getStrongKeyNumber, updateFailedCount }) {
function showPreviewModal(previewData) {
  state.pendingTranslations = previewData;
  
  const modal = document.createElement('div');
  modal.id = 'previewModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;overflow-y:auto;padding:20px';
  
  // Spočítej kolik klíčů v importu už máme přeložené (kolize)
  let conflicts = 0, newOnes = 0;
  for (const k of Object.keys(previewData)) {
    const cur = state.translated[k];
    if (cur && cur.vyznam && cur.vyznam !== '—' && !cur.skipped) conflicts++; else newOnes++;
  }

  let html = `<div style="max-width:900px;margin:0 auto;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:20px">
    <h2 style="color:var(--acc);margin:0 0 10px 0">${t('import.preview.title', { count: Object.keys(previewData).length })}</h2>
    <div style="font-size:11px;color:var(--txt2);margin-bottom:15px">
      ${t('import.preview.summary', { newOnes, conflicts })}
    </div>
    <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;padding:10px 12px;margin-bottom:15px">
      <div style="font-size:11px;color:var(--txt2);margin-bottom:8px"><b>${t('import.mode.title')}</b></div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-bottom:4px">
        <input type="radio" name="importMode" value="missing" checked style="accent-color:var(--acc)">
        <span>${t('import.mode.missing', { count: newOnes })}</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;margin-bottom:4px">
        <input type="radio" name="importMode" value="all" style="accent-color:var(--acc)">
        <span>${t('import.mode.all', { count: Object.keys(previewData).length })}</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px">
        <input type="radio" name="importMode" value="fillgaps" style="accent-color:var(--acc)">
        <span>${t('import.mode.fillgaps')}</span>
      </label>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px">
        <input type="checkbox" id="checkAllPreview" checked onchange="toggleAllPreview(this.checked)" style="width:16px;height:16px;accent-color:var(--acc)">
        <span style="font-size:12px">${t('import.selectAll')}</span>
      </label>
      <button class="hbtn grn" onclick="acceptPreview()">${t('import.saveSelected')}</button>
      <button class="hbtn red" onclick="discardPreview()">${t('import.cancel')}</button>
    </div>`;
  
  for (const [key, data] of Object.entries(previewData)) {
    const e = state.entryMap.get(key);
    const old = state.translated[key];
    const isConflict = old && old.vyznam && old.vyznam !== '—' && !old.skipped;
    const rawDef = data._rawDefinition || data.definice || '';
    const hasRaw = rawDef && rawDef.length > 10;
    html += `
    <div style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;margin:0 0 15px 0;padding:15px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" class="preview-check" data-key="${key}" data-conflict="${isConflict ? '1' : '0'}" checked style="width:18px;height:18px;accent-color:var(--acc)">
          <span style="font-family:'JetBrains Mono';color:var(--acc);font-weight:bold">${key}</span>
          ${isConflict ? `<span style="font-size:9px;padding:1px 6px;background:var(--acc2);color:#000;border-radius:3px">${t('import.badge.conflict')}</span>` : `<span style="font-size:9px;padding:1px 6px;background:var(--acc3);color:#000;border-radius:3px">${t('import.badge.new')}</span>`}
        </label>
        <span style="color:var(--txt2)">${escHtml(e?.greek || '')}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
        <div>
          <div style="color:var(--acc);font-size:10px;margin-bottom:5px">${t('import.czTranslationAi')}</div>
          <div style="font-size:12px">
            <div><b>${t('field.meaning')}</b> ${escHtml(data.vyznam || '—')}</div>
            <div style="margin-top:5px"><b>${t('field.definition')}</b> ${escHtml(data.definice || '—')}</div>
             ${hasRaw && rawDef !== data.definice ? `<div style="margin-top:8px;padding:8px;background:var(--bg2);border-radius:4px;border-left:2px solid var(--acc);font-size:11px;color:var(--txt2)"><b>${t('import.fullTranslation')}</b><div style="margin-top:5px;line-height:1.5">${formatPreviewRawTranslation(rawDef)}</div></div>` : ''}
             <div style="margin-top:5px"><b>${t('field.origin')}</b> ${escHtml(data.puvod || '—')}</div>
             <div style="margin-top:5px"><b>${t('field.specialist')}</b> ${escHtml(data.specialista || '—')}</div>
          </div>
        </div>
        <div>
          <div style="color:var(--txt3);font-size:10px;margin-bottom:5px">${t('import.enOriginal')}</div>
          <div style="font-size:12px;color:var(--txt2)">
            <div><b>${t('field.definition')}</b> ${escHtml(e?.definice || e?.def || '—')}</div>
          </div>
        </div>
      </div>
    </div>`;
  }
  
  html += `</div>`;
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

function toggleAllPreview(checked) {
  document.querySelectorAll('.preview-check').forEach(cb => cb.checked = checked);
}

function acceptPreview() {
  const mode = (document.querySelector('input[name="importMode"]:checked') || {}).value || 'missing';

  const FIELDS = ['vyznam', 'definice', 'puvod', 'specialista', 'kjv'];
  const isEmpty = v => !v || v === '—';

  let applied = 0, skippedConflicts = 0, mergedFields = 0;

  document.querySelectorAll('.preview-check:checked').forEach(cb => {
    const key = cb.dataset.key;
    const incoming = state.pendingTranslations[key];
    if (!incoming) return;
    const existing = state.translated[key];
    const hasExisting = existing && existing.vyznam && existing.vyznam !== '—' && !existing.skipped;

    if (mode === 'all') {
      state.translated[key] = incoming;
      applied++;
    } else if (mode === 'missing') {
      if (hasExisting) { skippedConflicts++; return; }
      state.translated[key] = incoming;
      applied++;
    } else if (mode === 'fillgaps') {
      if (!hasExisting) {
        state.translated[key] = incoming;
        applied++;
        return;
      }
      // Doplň jen prázdná pole v existujícím překladu
      let changed = false;
      const merged = { ...existing };
      for (const f of FIELDS) {
        if (isEmpty(merged[f]) && !isEmpty(incoming[f])) {
          merged[f] = incoming[f];
          changed = true;
          mergedFields++;
        }
      }
      if (changed) { state.translated[key] = merged; applied++; }
      else skippedConflicts++;
    }
});

  const savedKeysCount = Object.keys(state.translated).length;
  console.group('acceptPreview DEBUG');
  console.log(`Uloženo ${applied} klíčů (applied)`);
  console.log(`Celkem v state.translated: ${savedKeysCount} klíčů`);
  if (skippedConflicts > 0) console.log(`Přeskočeno kvůli kolizi: ${skippedConflicts}`);
  if (mode === 'fillgaps' && mergedFields > 0) console.log(`Doplněno polí: ${mergedFields}`);
  console.groupEnd();
  
  saveProgress();
  renderList();
  updateStats();
  updateFailedCount();
  closePreviewModal();
  const extra = mode === 'fillgaps' && mergedFields
    ? ` (${mergedFields} polí doplněno)`
    : skippedConflicts ? ` · ${skippedConflicts} přeskočeno (kolize)` : '';
  showToast(t('toast.saved.entriesWithExtra', { count: applied, extra }));
}

function discardPreview() {
  closePreviewModal();
  showToast(t('toast.translation.canceled'));
}

// ══ IMPORT TXT/JSON ═══════════════════════════════════════════════════
function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const text = ev.target.result;
      const lowerName = (file.name || '').toLowerCase();
      let imported = {};
      if (lowerName.endsWith('.json')) {
        imported = parseImportJSON(text);
      } else if (lowerName.endsWith('.txt')) {
        imported = parseCzTXT(text);
      } else {
        // Fallback: zkus JSON, pak TXT
        try {
          imported = parseImportJSON(text);
        } catch (_) {
          imported = parseCzTXT(text);
        }
      }
      const count = Object.keys(imported).length;
      if (!count) { showToast(t('toast.import.noEntries')); return; }
      const previewData = {};
      for (const [key, data] of Object.entries(imported)) {
        previewData[key] = data;
      }
       showPreviewModal(previewData);
       showToast(t('toast.import.found', { count, format: lowerName.endsWith('.json') ? 'JSON' : lowerName.endsWith('.txt') ? 'TXT' : 'auto' }));
     } catch(e) {
       logError('importFile', e, { fileName: file?.name });
       showToast(t('toast.error.withMessage', { message: e.message }));
     }
    input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function importTXT(input) {
  // Zachováno kvůli zpětné kompatibilitě (historické volání z UI/externích skriptů)
  return importFile(input);
}


// ══ NEÚSPĚŠNÉ PŘEKLADY ════════════════════════════════════════════════


function showFailedEntries() {
  const failed = [];
  for (const key of Object.keys(state.translated)) {
    const translationState = getTranslationStateForKey(key);
    if (translationState === 'failed' || translationState === 'failed_partial') {
      const tr = state.translated[key];
      failed.push({ key, raw: tr.raw, greek: state.entryMap.get(key)?.greek });
    }
  }
  
  if (!failed.length) {
    showToast(t('toast.failed.none'));
    return;
  }
  
  const failedKeys = failed.map(f => f.key);
  
  const modal = document.createElement('div');
  modal.id = 'failedModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.88);z-index:9999;overflow-y:auto;padding:20px';
  
  let cards = '';
  for (const f of failed) {
    const info = state.entryMap.get(f.key);
    const rawText = f.raw || (info ? `${info.greek}\n\nDEF: ${info.definice || info.def || ''}\nKJV: ${info.kjv || ''}` : '(prázdné)');
    cards += `<div style="background:var(--bg3);border:1px solid var(--brd);border-radius:6px;margin:0 0 10px 0;padding:12px">
      <div style="font-family:'JetBrains Mono';color:var(--acc);font-weight:bold;margin-bottom:6px">${f.key} | ${escHtml(f.greek || '')}</div>
      <div style="font-size:11px;color:var(--txt2);white-space:pre-wrap;max-height:120px;overflow-y:auto;background:var(--bg1);padding:8px;border-radius:4px">${escHtml(rawText)}</div>
    </div>`;
  }
  
  modal.innerHTML = `
  <div style="max-width:800px;margin:0 auto;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:22px">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;flex-wrap:wrap">
      <h2 style="color:var(--acc);font-family:'JetBrains Mono',monospace;font-size:14px;margin:0">
        ${t('failed.modal.title', { count: failed.length })}
      </h2>
      <button class="hbtn grn" onclick="retryFailed('${failedKeys.join(',')}')">${t('failed.modal.retry')}</button>
      <button class="hbtn red" onclick="closeFailedModalSafe()">${t('failed.modal.close')}</button>
    </div>
    <div style="font-size:12px;color:var(--txt3);margin-bottom:14px">
      ${t('failed.modal.note')}
    </div>
    <div id="failedCards">${cards}</div>
  </div>`;
  
  document.body.appendChild(modal);
  showToast(t('toast.failed.found', { count: failed.length }));
}

function retryFailed(failedKeysStr) {
  const keys = failedKeysStr.split(',');
  state.selectedKeys = new Set(keys);
  renderList();
  closeFailedModalSafe();
  
  // Nastav retry režim - příští translateNext/AUTO vezme tyto klíče
  state.retryMode = true;
  state.retryKeysList = keys;
  
  showToast(t('toast.selectedForBatch', { count: keys.length }));
}

function closePreviewModal() {
  closePreviewModalSafe();
}

// Escape zavře modal
document.addEventListener('keydown', e => {
  // Ctrl+S = uložit progress (Ctrl is either)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProgress();
  showToast(t('toast.progress.saved'));
    return;
  }
  // Ctrl+E = export do TXT
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    exportTXT();
    return;
  }
    if (e.key === 'Escape') {
      closePreviewModalSafe();
      closeLimitsModal();
      closePromptLibraryModal();
      closePromptAIModal();
      closePromptLangModal();
      closeTopicPromptModal();
      closeTopicRepairModalSafe();
      closeHelpModal();
    }
  if (document.getElementById('app').style.display === 'none') return;
  // Klávesové zkratky v app
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === ' ') { e.preventDefault(); translateNext(); }
  if (e.key === 'a' || e.key === 'A') toggleAuto();
  if (e.key === 'ArrowDown') {
    const idx = state.filteredKeys.indexOf(state.activeKey);
    if (idx < state.filteredKeys.length - 1) showDetail(state.filteredKeys[idx + 1]);
  }
  if (e.key === 'ArrowUp') {
    const idx = state.filteredKeys.indexOf(state.activeKey);
    if (idx > 0) showDetail(state.filteredKeys[idx - 1]);
  }
});
// Null-safe modal close helpers
function closePreviewModalSafe() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.remove();
  state.pendingTranslations = {};
}

function closeFailedModalSafe() {
  const modal = document.getElementById('failedModal');
  if (modal) modal.remove();
}
  return {
    showPreviewModal,
    toggleAllPreview,
    acceptPreview,
    discardPreview,
    importFile,
    importTXT,
    showFailedEntries,
    retryFailed,
    closePreviewModal,
    closePreviewModalSafe,
    closeFailedModalSafe,
  };
}