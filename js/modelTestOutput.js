import { state } from './state.js';
import { escHtml } from './utils.js';
import { t, getContentLangTag } from './i18n.js';
import { CONFIG, PROVIDERS } from './config.js';

export function createModelTestOutputApi({ MODEL_TEST_RAW_OUTPUT_KEY, showToast, log, modelTestStopProviderCountdownTicker, showModelTestModal, showDetail }) {
function logEntry(keys, rawResponse) {
  const scroll = document.getElementById('logScroll');
  if (!scroll) return;

  const placeholder = scroll.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  for (const key of keys) {
    const e = state.entryMap.get(key);
    const tr = state.translated[key];
    if (!e) continue;

    const div = document.createElement('div');
    div.className = 'log-entry';
    div.style.cursor = 'pointer';
    div.title = t('log.entry.title');
    div.onclick = () => showDetail(key);
    div.innerHTML = `
      <div class="log-key-line">
        <span class="log-key">${key}</span>
        <span class="log-greek">${escHtml(e.greek)}</span>
      </div>
       ${tr && !tr.skipped
         ? `<div class="log-vyznam"><b>${t('log.meaning')}</b> ${escHtml(tr.vyznam || '—')}</div>
            <div class="log-definice">${escHtml((tr.definice || '').slice(0, 120))}${(tr.definice || '').length > 120 ? '…' : ''}</div>
            ${tr.kjv ? `<div class="log-orig"><b>KJV:</b> ${escHtml(tr.kjv.slice(0, 80))}${(tr.kjv || '').length > 80 ? '…' : ''}</div>` : ''}
            ${tr.puvod ? `<div class="log-orig"><b>${t('log.origin')}</b> ${escHtml(tr.puvod.slice(0, 80))}${tr.puvod.length > 80 ? '…' : ''}</div>` : ''}
            ${tr.specialista ? `<div class="log-specialista"><b>${t('log.specialist')}</b> ${escHtml(tr.specialista.slice(0, 120))}${tr.specialista.length > 120 ? '…' : ''}</div>` : ''}`
         : `<div class="log-err">${t('log.unparsed')}</div>`
       }
    `;
    scroll.appendChild(div);
  }

  scroll.scrollTop = scroll.scrollHeight;

  // Počítadlo
  const cnt = scroll.children.length;
  const countEl = document.getElementById('logCount');
  if (countEl) countEl.textContent = t('log.records', { count: cnt });

  // Limit state.entries in log
  while (scroll.children.length > CONFIG.LOG_MAX_ENTRIES) scroll.removeChild(scroll.firstChild);
}

function clearLog() {
  const s = document.getElementById('logScroll');
  if (s) s.innerHTML = `<div class="log-placeholder" style="padding:20px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--txt3)">${t('log.placeholder')}</div>`;
  const c = document.getElementById('logCount');
  if (c) c.textContent = '';
}

async function saveModelTestOutputTxt() {
  const text = document.getElementById('modelTestOutput')?.value || '';
  if (!text.trim()) {
    showToast(t('toast.test.nothingToSave'));
    return;
  }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: DEFAULT_MODEL_TEST_LOG_FILENAME,
        types: [
          {
            description: 'Text files',
            accept: { 'text/plain': ['.txt'] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      modelTestSetLastStatus(t('modelTest.status.saved', { name: handle.name || DEFAULT_MODEL_TEST_LOG_FILENAME }), 'ok');
      showToast(t('toast.saved.filename', { name: handle.name || DEFAULT_MODEL_TEST_LOG_FILENAME }));
      return;
    } catch (e) {
      const msg = String(e?.message || '');
      if (/AbortError/i.test(msg)) {
        showToast(t('toast.save.canceled'));
        return;
      }
      showToast(t('toast.saveDialogFailedFallback', { message: msg || t('error.unknown') }));
    }
  }
  download(DEFAULT_MODEL_TEST_LOG_FILENAME, text, 'text/plain');
  modelTestSetLastStatus(t('modelTest.status.downloaded', { name: DEFAULT_MODEL_TEST_LOG_FILENAME }), 'ok');
  showToast(t('toast.downloaded.filename', { name: DEFAULT_MODEL_TEST_LOG_FILENAME }));
}

function saveModelTestRawOutputToStorage() {
  try { localStorage.setItem(MODEL_TEST_RAW_OUTPUT_KEY, JSON.stringify(state.modelTestRawResponses || [])); } catch (e) {}
}

function clearModelTestRawOutputFromStorage() {
  try { localStorage.removeItem(MODEL_TEST_RAW_OUTPUT_KEY); } catch (e) {}
}

async function saveModelTestRawOutputTxt() {
  const rows = Array.isArray(state.modelTestRawResponses) ? modelTestRawResponses : [];
  if (!rows.length) {
    showToast(t('toast.test.noRawYet'));
    return;
  }
  const body = rows.map((row, idx) => {
    const header = `### ${idx + 1} | provider=${row.prov} | model=${row.model} | ${t('modelTest.raw.mode')}=${row.mode} | promptTest=${row.promptEnabled ? 'on' : 'off'} | prompt=${row.promptType} | ${new Date(row.ts).toLocaleString('cs-CZ')}`;
    const promptBlock = `--- ${t('modelTest.raw.sentPrompt')} ---\n${row.promptSent || t('modelTest.raw.notAvailable')}\n--- /${t('modelTest.raw.sentPrompt')} ---`;
    const rawBlock = `--- ${t('modelTest.raw.aiResponse')} ---\n${row.raw || ''}\n--- /${t('modelTest.raw.aiResponse')} ---`;
    return `${header}\n${promptBlock}\n${rawBlock}`;
  }).join('\n\n');
  download(`strong_model_test_raw_${Date.now()}.txt`, body, 'text/plain');
  showToast(t('toast.test.rawDownloaded'));
}

function loadModelTestOutputFromFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const text = String(ev?.target?.result || '');
    const out = document.getElementById('modelTestOutput');
    if (out) {
      out.value = text;
      out.scrollTop = out.scrollHeight;
    }
    saveModelTestOutputToStorage(text);
    modelTestSetLastStatus(t('modelTest.status.loaded', { name: file.name }), 'ok');
    showToast(t('toast.loaded.filename', { name: file.name }));
    if (input) input.value = '';
  };
  reader.onerror = () => {
    showToast(t('toast.file.loadFailed'));
    if (input) input.value = '';
  };
  reader.readAsText(file, 'utf-8');
}

function modelTestWaitWithCountdown(ms, signal) {
  return new Promise(resolve => {
    modelTestClearCountdownInterval();
    if (ms <= 0 || state.modelTestCancelRequested) {
      state.modelTestNextRequestEtaSec = 0;
      modelTestSetCountdownLabel('');
      updateModelTestRunButton();
      resolve();
      return;
    }
    const t0 = Date.now();
    const tick = () => {
      if (state.modelTestCancelRequested || signal?.aborted) {
        modelTestClearCountdownInterval();
        state.modelTestNextRequestEtaSec = 0;
        modelTestSetCountdownLabel('');
        updateModelTestRunButton();
        resolve();
        return;
      }
      const left = ms - (Date.now() - t0);
      if (left <= 0) {
        modelTestClearCountdownInterval();
        state.modelTestNextRequestEtaSec = 0;
        modelTestSetCountdownLabel('');
        updateModelTestRunButton();
        resolve();
        return;
      }
      state.modelTestNextRequestEtaSec = Math.ceil(left / 1000);
      const leftTestSec = state.modelTestRunEndTs > Date.now()
        ? Math.ceil((state.modelTestRunEndTs - Date.now()) / 1000)
        : 0;
      if (leftTestSec > 0) {
        const mm = Math.floor(leftTestSec / 60);
        const ss = leftTestSec % 60;
        modelTestSetCountdownLabel(t('modelTest.countdown.withRemain', { seconds: state.modelTestNextRequestEtaSec, remain: `${mm}:${String(ss).padStart(2, '0')}` }));
      } else {
        modelTestSetCountdownLabel(t('modelTest.countdown.nextOnly', { seconds: state.modelTestNextRequestEtaSec }));
      }
      updateModelTestRunButton();
    };
    tick();
    state.modelTestCountdownInterval = setInterval(tick, 400);
  });
}

function scrollModelTestOutputIntoView() {
  const ta = document.getElementById('modelTestOutput');
  if (ta) {
    ta.focus({ preventScroll: true });
    ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function openModelTestModal() {
  if (state.autoRunning || state.autoStepRunning) {
    showToast(t('toast.auto.stopFirst'));
    return;
  }
  const prov = document.getElementById('provider')?.value || 'groq';
  const providerLabel = PROVIDERS[prov]?.label || prov;
  showModelTestModal(providerLabel, false);
  const modalProviderSelect = document.getElementById('modelTestProvider');
  if (modalProviderSelect) modalProviderSelect.value = prov;
  scrollModelTestOutputIntoView();
}

function resetModelTestModal() {
  if (state.modelTestRunning) {
    showToast(t('toast.test.cancelFirst'));
    return;
  }
  const output = document.getElementById('modelTestOutput');
  if (output) output.value = '';
  state.modelTestLibraryActive = false;
  state.modelTestOutputBackupBeforeLibrary = '';
  state.modelTestParsedExportChunks = [];
  state.modelTestLastKeyAuditExportChunks = [];
  state.modelTestRawResponses = [];
  state.modelTestNextRequestEtaSec = 0;
  modelTestResetProviderEta();
  modelTestStopProviderCountdownTicker();
  modelTestSetCountdownLabel('');
  modelTestSetLastStatus('');
  clearModelTestOutputFromStorage();
  clearModelTestRawOutputFromStorage();
  updateModelTestRunButton();
}

function restoreModelTestReportFromBackup() {
  const output = document.getElementById('modelTestOutput');
  if (!output) return;
  if (state.modelTestLibraryActive) {
    output.value = state.modelTestOutputBackupBeforeLibrary;
    state.modelTestLibraryActive = false;
    saveModelTestOutputToStorage(output.value);
  }
  scrollModelTestOutputIntoView();
}

function formatModelTestParsedBlock(key, t, e) {
  if (!e || !t) return '';
  const langTag = getContentLangTag();
  const defEnglish = isDefinitionLikelyEnglish(t.definice);
  const defValue = t.definice || '—';
  const defDisplay = defEnglish && !new RegExp(`\\[${t('modelTest.note.definitionEnglish')}\\]`).test(defValue)
    ? `${defValue} [${t('modelTest.note.definitionEnglish')}]`
    : defValue;
   const parts = [
     `${key} | ${e.greek}`,
     `${t('export.field.grammar')}: ${e.tvaroslovi || '—'}`,
     `${t('export.field.meaning', { lang: langTag })}: ${t.vyznam || '—'}`,
     `${t('export.field.definitionEn')}: ${e.definice || e.def || '—'}`,
     `${t('export.field.definition', { lang: langTag })}: ${defDisplay}`,
     `${t('export.field.kjv', { lang: langTag })}: ${t.kjv || e.kjv || '—'}`,
     `${t('export.field.origin')}: ${t.puvod || '—'}`,
     `${t('export.field.specialist')}: ${t.specialista || '—'}`,
     ''
   ];
  return parts.join('\n');
}

function appendModelTestExportParsed(keys, parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  for (const key of keys) {
    const t = parsed[key];
    if (!t) continue;
    const e = state.entryMap.get(key);
    if (!e) continue;
    state.modelTestParsedExportChunks.push(formatModelTestParsedBlock(key, t, e));
  }
}

function excerptRawForLastKey(rawContent, lastKey, maxLen = 2200) {
  const raw = String(rawContent || '').trim();
  if (!raw) return t('modelTest.raw.empty');
  const escapedKey = String(lastKey || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedKey) {
    const markerRe = new RegExp(`###\\s*${escapedKey}\\s*###([\\s\\S]*?)(?=\\n###\\s*G\\d+\\s*###|$)`, 'i');
    const m1 = raw.match(markerRe);
    if (m1) {
      const chunk = `###${lastKey}###${m1[1]}`.trim();
      return chunk.length <= maxLen ? chunk : `${chunk.slice(0, maxLen)}\n… ${t('modelTest.audit.shortened')}`;
    }
    const lineRe = new RegExp(`(^|\\n)\\s*${escapedKey}\\s*\\|[^\\n]*([\\s\\S]*?)(?=\\n\\s*G\\d+\\s*\\||$)`, 'i');
    const m2 = raw.match(lineRe);
    if (m2) {
      const chunk = m2[0].trim();
      return chunk.length <= maxLen ? chunk : `${chunk.slice(0, maxLen)}\n… ${t('modelTest.audit.shortened')}`;
    }
  }
  if (raw.length <= maxLen) return raw;
  const head = Math.min(1200, Math.floor(maxLen * 0.65));
  const tail = Math.max(500, maxLen - head - 40);
  return `${raw.slice(0, head)}\n… ${t('modelTest.audit.shortened')} …\n${raw.slice(-tail)}`;
}

/**
 * Průběžná audit kontrola: všechna hesla v dávce + stav formátu.
 */
function appendModelTestLastBatchKeyAudit(appendReport, batchKeys, parsed, missing, rawContent = '', totals = null) {
  const lastKey = Array.isArray(batchKeys) && batchKeys.length ? batchKeys[batchKeys.length - 1] : '';
  if (!lastKey || typeof appendReport !== 'function') return;
  const missingSet = new Set(Array.isArray(missing) ? missing : []);
  const failedKeys = (Array.isArray(batchKeys) ? batchKeys : []).filter(k => {
    const tk = parsed && parsed[k];
    return missingSet.has(k) || !tk || !isTranslationComplete(tk);
  });
  const firstFailed = failedKeys.length ? failedKeys[0] : '';
  const lastFailed = failedKeys.length ? failedKeys[failedKeys.length - 1] : '';
  const t = parsed && parsed[lastKey];
  const inMissing = missingSet.has(lastKey);
  const complete = !!t && isTranslationComplete(t);
  const englishDefinitionFlag = !!(t && isDefinitionLikelyEnglish(t.definice));
  const badFields = t && !complete
    ? [
        ...['definice', 'puvod', 'kjv', 'specialista'].filter(f => !hasMeaningfulValue(t[f])),
        ...(englishDefinitionFlag ? ['definice(EN)'] : [])
      ]
    : [];
  const rangeLabel = Array.isArray(batchKeys) && batchKeys.length
    ? t('modelTest.audit.range', { from: batchKeys[0], to: batchKeys[batchKeys.length - 1], count: batchKeys.length })
    : t('modelTest.audit.rangeSingle', { key: lastKey });
  const totalsSuffix = totals ? t('modelTest.audit.status.totalsSuffix', { ok: totals.okKeys || 0, fail: totals.failedKeys || 0 }) : '';

  appendReport(`  ${t('modelTest.audit.rangeLine', { range: rangeLabel })}`);
  appendReport('');
  appendReport(`  ${t('modelTest.audit.header')}`);
  appendReport(`  ${t('modelTest.audit.lastKeyLine', { key: lastKey })}`);
  appendReport(`  ${t('modelTest.audit.auditedCountLine', { count: batchKeys.length })}`);
  appendReport(`  ${t('modelTest.audit.failedCountLine', { count: failedKeys.length })}`);
  appendReport('');
  if (complete) {
    modelTestSetLastStatus(t('modelTest.audit.statusLine.ok', { range: rangeLabel, key: lastKey, suffix: totalsSuffix }), 'ok');
    appendReport(`  ${t('modelTest.audit.lastStatus.ok')}`);
    appendReport(t('modelTest.audit.dataAll'));
    for (const key of batchKeys) {
      const tk = parsed && parsed[key];
      if (!tk) continue;
      appendReport(`    --- ${key} ---`);
      for (const ln of formatModelTestParsedBlock(key, tk, state.entryMap.get(key)).split('\n')) {
        appendReport(`    ${ln}`);
      }
    }
  } else if (inMissing || !t) {
    modelTestSetLastStatus(t('modelTest.audit.statusLine.fail', { range: rangeLabel, key: lastKey, suffix: totalsSuffix }), 'error');
    appendReport(`  ${t('modelTest.audit.errorPairing')}`);
    appendReport(`  ${t('modelTest.audit.lastStatus.fail')}`);
    if (failedKeys.length) {
      appendReport(`  ${t('modelTest.audit.failedDetailLine', { failed: failedKeys.length, total: batchKeys.length, first: firstFailed, last: lastFailed })}`);
    }
    if (firstFailed && firstFailed !== lastFailed) {
      appendReport(t('modelTest.audit.rawFirstFailed', { key: firstFailed }));
      appendReport(excerptRawForLastKey(rawContent, firstFailed, 1200));
      appendReport('  ---');
    }
    appendReport(t('modelTest.audit.rawBatch'));
    appendReport(rawContent || t('modelTest.audit.rawEmptyResponse'));
    appendReport('  --- /RAW ---');
  } else {
    modelTestSetLastStatus(t('modelTest.audit.statusLine.incomplete', { range: rangeLabel, key: lastKey, suffix: totalsSuffix }), 'warn');
    appendReport(`  ${t('modelTest.audit.lastStatus.incomplete', { fields: badFields.join(', ') || '?' })}`);
    if (englishDefinitionFlag) {
      appendReport(`  ${t('modelTest.audit.noteDefinitionEnglish')}`);
    }
    appendReport(t('modelTest.audit.dataParsedOnly'));
    for (const key of batchKeys) {
      const tk = parsed && parsed[key];
      if (!tk) continue;
      appendReport(`    --- ${key} ---`);
      for (const ln of formatModelTestParsedBlock(key, tk, state.entryMap.get(key)).split('\n')) {
        appendReport(`    ${ln}`);
      }
    }
  }
  appendReport('');

  const exportLines = [
    t('modelTest.audit.rangeLine', { range: rangeLabel }),
    t('modelTest.audit.exportHeader', { count: batchKeys.length }),
    t('modelTest.audit.exportLastKey', { key: lastKey }),
    totals ? t('modelTest.audit.exportTotals', { ok: totals.okKeys || 0, fail: totals.failedKeys || 0 }) : '',
    complete
      ? t('modelTest.audit.status.ok')
      : (inMissing || !t)
        ? t('modelTest.audit.status.fail')
        : t('modelTest.audit.status.incomplete', { fields: badFields.join(', ') || '?' })
  ].filter(Boolean);
  const parsedKeys = batchKeys.filter(k => parsed && parsed[k]);
  if (parsedKeys.length) {
    exportLines.push('');
    exportLines.push(t('modelTest.audit.dataAll'));
    for (const key of parsedKeys) {
      exportLines.push(`--- ${key} ---`);
      exportLines.push(formatModelTestParsedBlock(key, parsed[key], state.entryMap.get(key)));
    }
  } else if (inMissing || !t) {
    if (firstFailed && firstFailed !== lastFailed) {
      exportLines.push('', t('modelTest.audit.rawFirstFailed', { key: firstFailed }), excerptRawForLastKey(rawContent, firstFailed, 1200));
    }
    exportLines.push('', t('modelTest.audit.rawBatch'), rawContent || t('modelTest.audit.rawEmptyResponse'));
  }
  exportLines.push('----------------------------------------', '');
  state.modelTestLastKeyAuditExportChunks.push(exportLines.join('\n'));
}

function exportModelTestTranslationsTxt() {
  const out = document.getElementById('modelTestOutput');
  const reportFallback = (out?.value || '').trim();
  let body = '';
  if (state.modelTestLastKeyAuditExportChunks.length) {
    body = `# ${t('modelTest.export.auditHeader')}\n# ${new Date().toLocaleString('cs-CZ')}\n\n${state.modelTestLastKeyAuditExportChunks.join('\n')}`;
  } else if (state.modelTestParsedExportChunks.length) {
    body = `# ${t('modelTest.export.parsedHeader')}\n# ${new Date().toLocaleString('cs-CZ')}\n\n${state.modelTestParsedExportChunks.join('\n')}`;
  } else if (reportFallback) {
    body = `# ${t('modelTest.export.noParsedFallback')}\n# ${new Date().toLocaleString('cs-CZ')}\n\n${reportFallback}`;
  } else {
    showToast(t('toast.export.nothing'));
    return;
  }
  download(`strong_model_test_export_${Date.now()}.txt`, body, 'text/plain');
  showToast(t('toast.export.txtDownloaded'));
}

  return {
    logEntry,
    clearLog,
    saveModelTestOutputTxt,
    saveModelTestRawOutputToStorage,
    clearModelTestRawOutputFromStorage,
    saveModelTestRawOutputTxt,
    loadModelTestOutputFromFile,
    modelTestWaitWithCountdown,
    scrollModelTestOutputIntoView,
    openModelTestModal,
    resetModelTestModal,
    restoreModelTestReportFromBackup,
    formatModelTestParsedBlock,
    appendModelTestExportParsed,
    excerptRawForLastKey,
    appendModelTestLastBatchKeyAudit,
    exportModelTestTranslationsTxt,
  };
}