import { PROVIDERS } from './config.js';
import { state } from './state.js';
import { uiLabel } from './i18n.js';
import { safeSetLocalStorage, safeRemoveLocalStorage } from './storage.js';

export function createSettingsApi({ MODEL_TEST_PINNED_MODELS, MODEL_TEST_MODEL_STORAGE_KEY, PIPELINE_SECONDARY_ENABLED_KEY, setAutoProviderEnabled, updateAutoProviderCountdowns }) {
function getApiKeyForModelTest(prov) {
  const activeProvider = document.getElementById('provider')?.value || '';
  if (activeProvider === prov) {
    const fromInput = (document.getElementById('apiKey')?.value || '').trim();
    if (fromInput) return fromInput;
  }
  return (localStorage.getItem('strong_apikey_' + prov) || '').trim();
}

function getPinnedModelOptionsForProvider(prov) {
  return MODEL_TEST_PINNED_MODELS
    .filter(item => item.prov === prov)
    .map(item => ({ value: item.value, label: item.label }));
}

function getPinnedModelQueue() {
  return MODEL_TEST_PINNED_MODELS
    .filter(item => !!getApiKeyForModelTest(item.prov))
    .map(item => ({ prov: item.prov, model: item.value, label: item.label }));
}

function getDefaultPinnedModelByProvider(prov) {
  const found = MODEL_TEST_PINNED_MODELS.find(item => item.prov === prov);
  return found ? found.value : '';
}

function getModelTestSelectedModelForProvider(prov) {
  const select = document.getElementById(`modelTestModel_${prov}`);
  const selected = String(select?.value || '').trim();
  if (selected) return selected;
  const saved = String(localStorage.getItem(MODEL_TEST_MODEL_STORAGE_KEY + prov) || '').trim();
  if (saved) return saved;
  return getDefaultPinnedModelByProvider(prov);
}

const PIPELINE_MODEL_STORAGE_KEY = 'strong_pipeline_model_';

function getPipelineModelForProvider(prov) {
  const hasStaticModel = (provider, model) => {
    if (!model) return false;
    if (provider === 'openrouter') return true;
    const providerModels = Array.isArray(PROVIDERS?.[provider]?.models) ? PROVIDERS[provider].models : [];
    return providerModels.some(item => Array.isArray(item) && String(item[0] || '').trim() === model);
  };
  const saved = String(localStorage.getItem(PIPELINE_MODEL_STORAGE_KEY + prov) || '').trim();
  if (saved && hasStaticModel(prov, saved)) return saved;
  if (saved && !hasStaticModel(prov, saved)) {
    safeRemoveLocalStorage(PIPELINE_MODEL_STORAGE_KEY + prov, 'settings');
  }
  const testSelected = String(getModelTestSelectedModelForProvider(prov) || '').trim();
  if (testSelected && hasStaticModel(prov, testSelected)) return testSelected;
  const fallback = String(getDefaultPinnedModelByProvider(prov) || '').trim();
  if (fallback && hasStaticModel(prov, fallback)) return fallback;
  return '';
}

function setPipelineModelForProvider(prov, model) {
  const val = String(model || '').trim();
  if (!val) return;
  safeSetLocalStorage(PIPELINE_MODEL_STORAGE_KEY + prov, val, 'settings');
}

function isPipelineSecondaryEnabled(prov) {
  return localStorage.getItem(PIPELINE_SECONDARY_ENABLED_KEY + prov) === '1';
}

function setPipelineSecondaryEnabled(prov, enabled) {
  safeSetLocalStorage(PIPELINE_SECONDARY_ENABLED_KEY + prov, enabled ? '1' : '0', 'settings');
}

function syncSecondaryProviderToggles(prov, enabled) {
  if (prov !== 'gemini' && prov !== 'openrouter') return;
  const on = !!enabled;
  const map = {
    gemini: {
      autoCb: 'autoEnable_gemini',
      setupCb: 'pipelineEnableSecondaryGemini',
      modalCb: 'providerRunEnableSecondaryGemini',
      setupModel: 'pipelineModelSecondaryGemini',
      modalModel: 'providerRunSecondaryGeminiModel'
    },
    openrouter: {
      autoCb: 'autoEnable_openrouter',
      setupCb: 'pipelineEnableSecondaryOpenrouter',
      modalCb: 'providerRunEnableSecondaryOpenrouter',
      setupModel: 'pipelineModelSecondaryOpenrouter',
      modalModel: 'providerRunSecondaryOpenrouterModel'
    }
  };
  const cfg = map[prov];
  if (!cfg) return;
  const autoCb = document.getElementById(cfg.autoCb);
  const setupCb = document.getElementById(cfg.setupCb);
  const modalCb = document.getElementById(cfg.modalCb);
  if (autoCb) autoCb.checked = on;
  if (setupCb) setupCb.checked = on;
  if (modalCb) modalCb.checked = on;
  applyPipelineSecondaryToggleUi(prov, on, cfg.setupModel);
  applyPipelineSecondaryToggleUi(prov, on, cfg.modalModel);
}

function applyPipelineSecondaryToggleUi(prov, checked, selectId) {
  const select = document.getElementById(selectId);
  if (select) select.disabled = !checked;
}

function bindPipelineSecondaryToggle(checkboxId, prov, selectId) {
  const cb = document.getElementById(checkboxId);
  if (!cb) return;
  cb.checked = isPipelineSecondaryEnabled(prov);
  syncSecondaryProviderToggles(prov, cb.checked);
  applyPipelineSecondaryToggleUi(prov, cb.checked, selectId);
  cb.onchange = () => {
    setAutoProviderEnabled(prov, cb.checked);
    updateAutoProviderCountdowns();
    updateSetupCompactSummary();
  };
}

function fillPipelineSelectOptions(prov, selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  if (prov === 'openrouter') {
    const wanted = getPipelineModelForProvider('openrouter');
    populateOpenRouterModels(select, wanted, () => {
      const modelWanted = getPipelineModelForProvider('openrouter');
      if (modelWanted && Array.from(select.options).some(o => o.value === modelWanted)) {
        select.value = modelWanted;
      }
      updateSetupCompactSummary();
    });
    select.onchange = () => {
      setPipelineModelForProvider('openrouter', select.value);
      updateSetupCompactSummary();
    };
    return;
  }
  const options = (PROVIDERS[prov]?.models || []).map(([value, label]) => ({ value, label: uiLabel(label) || value }));
  select.innerHTML = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  const wanted = getPipelineModelForProvider(prov);
  if (wanted && Array.from(select.options).some(o => o.value === wanted)) {
    select.value = wanted;
  } else if (select.options.length) {
    select.selectedIndex = 0;
  }
  setPipelineModelForProvider(prov, select.value);
  select.onchange = () => {
    setPipelineModelForProvider(prov, select.value);
    updateSetupCompactSummary();
  };
}

function initPipelineModelSelectors() {
  fillPipelineSelectOptions('groq', 'pipelineModelMainGroq');
  fillPipelineSelectOptions('gemini', 'pipelineModelSecondaryGemini');
  fillPipelineSelectOptions('openrouter', 'pipelineModelSecondaryOpenrouter');
  bindPipelineSecondaryToggle('pipelineEnableSecondaryGemini', 'gemini', 'pipelineModelSecondaryGemini');
  bindPipelineSecondaryToggle('pipelineEnableSecondaryOpenrouter', 'openrouter', 'pipelineModelSecondaryOpenrouter');
}

function initPipelineModelSelectorsInSettingsModal() {
  fillPipelineSelectOptions('groq', 'providerRunMainGroqModel');
  fillPipelineSelectOptions('gemini', 'providerRunSecondaryGeminiModel');
  fillPipelineSelectOptions('openrouter', 'providerRunSecondaryOpenrouterModel');
  bindPipelineSecondaryToggle('providerRunEnableSecondaryGemini', 'gemini', 'providerRunSecondaryGeminiModel');
  bindPipelineSecondaryToggle('providerRunEnableSecondaryOpenrouter', 'openrouter', 'providerRunSecondaryOpenrouterModel');
}

function saveModelTestModelSelections() {
  ['groq', 'gemini', 'openrouter'].forEach(prov => {
    const val = String(document.getElementById(`modelTestModel_${prov}`)?.value || '').trim();
    if (val) safeSetLocalStorage(MODEL_TEST_MODEL_STORAGE_KEY + prov, val, 'settings');
  });
}

function populateModelTestModelSelect(prov) {
  const select = document.getElementById(`modelTestModel_${prov}`);
  if (!select) return;
  if (prov === 'openrouter') {
    const wanted = String(localStorage.getItem(MODEL_TEST_MODEL_STORAGE_KEY + prov) || getDefaultPinnedModelByProvider(prov) || '').trim();
    populateOpenRouterModels(select, wanted, () => {
      const saved = String(localStorage.getItem(MODEL_TEST_MODEL_STORAGE_KEY + prov) || '').trim();
      const preferred = saved || wanted;
      if (preferred && Array.from(select.options).some(o => o.value === preferred)) {
        select.value = preferred;
      } else if (select.options.length) {
        select.selectedIndex = 0;
      }
    });
    return;
  }
  const providerOptions = (PROVIDERS[prov]?.models || []).map(([value, label]) => ({ value, label: uiLabel(label) || value }));
  const pinned = MODEL_TEST_PINNED_MODELS
    .filter(item => item.prov === prov)
    .map(item => ({ value: item.value, label: item.label || item.value }));
  const merged = [...pinned];
  for (const opt of providerOptions) {
    if (!merged.find(x => x.value === opt.value)) merged.push(opt);
  }
  if (!merged.length) merged.push({ value: getDefaultPinnedModelByProvider(prov), label: getDefaultPinnedModelByProvider(prov) || 'â€”' });
  select.innerHTML = merged
    .filter(opt => opt.value)
    .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
    .join('');
  const saved = String(localStorage.getItem(MODEL_TEST_MODEL_STORAGE_KEY + prov) || '').trim();
  const wanted = saved || getDefaultPinnedModelByProvider(prov);
  if (wanted && Array.from(select.options).some(o => o.value === wanted)) {
    select.value = wanted;
  } else if (select.options.length) {
    select.selectedIndex = 0;
  }
}

function updateModelTestProviderUi() {
  const providerMode = document.getElementById('modelTestProvider')?.value || 'parallel-3';
  const isParallel = providerMode === 'parallel-3';
  if (!isParallel && ['groq', 'gemini', 'openrouter'].includes(providerMode)) {
    populateModelTestModelSelect(providerMode);
  }
  ['groq', 'gemini', 'openrouter'].forEach(prov => {
    const row = document.getElementById(`modelRow_${prov}`);
    const select = document.getElementById(`modelTestModel_${prov}`);
    if (!row) return;
    const visible = isParallel || providerMode === prov;
    row.style.display = visible ? 'grid' : 'none';
    row.hidden = !visible;
    if (select) select.disabled = !visible;
  });
  const wrap = document.getElementById('modelTestProviderModels');
  if (wrap) {
    wrap.style.display = isParallel || ['groq', 'gemini', 'openrouter'].includes(providerMode) ? 'block' : 'none';
  }
}

function getProviderModelOptions(prov) {
  if (prov !== 'openrouter') {
    return Promise.resolve((PROVIDERS[prov]?.models || []).map(([value, label]) => ({ value, label: uiLabel(label) })));
  }
  return new Promise(resolve => {
    const tempSelect = document.createElement('select');
    const savedModel = localStorage.getItem('strong_model');
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      const options = Array.from(tempSelect.options)
        .filter(opt => opt.value)
        .map(opt => ({ value: opt.value, label: opt.text }));
      resolve(options);
    };
    populateOpenRouterModels(tempSelect, savedModel, finish);
    setTimeout(finish, 8000);
  });
}

  return {
    getApiKeyForModelTest,
    getPinnedModelOptionsForProvider,
    getPinnedModelQueue,
    getDefaultPinnedModelByProvider,
    getModelTestSelectedModelForProvider,
    getPipelineModelForProvider,
    setPipelineModelForProvider,
    isPipelineSecondaryEnabled,
    setPipelineSecondaryEnabled,
    syncSecondaryProviderToggles,
    applyPipelineSecondaryToggleUi,
    bindPipelineSecondaryToggle,
    fillPipelineSelectOptions,
    initPipelineModelSelectors,
    initPipelineModelSelectorsInSettingsModal,
    saveModelTestModelSelections,
    populateModelTestModelSelect,
    updateModelTestProviderUi,
    getProviderModelOptions,
  };
}