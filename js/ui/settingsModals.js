import { t, getUiLang, getDefaultContentTag, CONTENT_TAG_LANG_KEY, CONTENT_TAG_LANG_MANUAL_KEY } from '../i18n.js';
import { safeSetLocalStorage, safeRemoveLocalStorage } from '../storage.js';
import { BATCH_SIZE_KEY, INTERVAL_KEY, PERSONAL_PROMPT_KEY } from '../config.js';

export function createSettingsModalsApi({ initRunSelects, updateSetupCompactSummary, initPipelineModelSelectors, initPipelineModelSelectorsInSettingsModal, showToast, refreshTopicLabels, renderList, saveProgress, refreshLanguageAwarePromptOptionLabels, applySystemPromptForCurrentTask, applyUiLanguage, DEFAULT_UI_LANG, UI_LANGS, UI_LANG_KEY, setPipelineModelForProvider, setPipelineSecondaryEnabled, syncSecondaryProviderToggles, updateAutoProviderCountdowns, updateStats }) {

const UI_LANGUAGE_CATALOG = [
  { code: 'cs', fileCode: 'cs', labelCode: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'en', fileCode: 'en', labelCode: 'en', name: 'Angličtina', flag: '🇬🇧' },
  { code: 'sk', fileCode: 'sk', labelCode: 'sk', name: 'Slovenština', flag: '🇸🇰' },
  { code: 'pl', fileCode: 'pl', labelCode: 'pl', name: 'Polština', flag: '🇵🇱' },
  { code: 'de', fileCode: 'de', labelCode: 'de', name: 'Němčina', flag: '🇩🇪' },
  { code: 'fr', fileCode: 'fr', labelCode: 'fr', name: 'Francouzština', flag: '🇫🇷' },
  { code: 'es', fileCode: 'es', labelCode: 'es', name: 'Španělština', flag: '🇪🇸' },
  { code: 'it', fileCode: 'it', labelCode: 'it', name: 'Italština', flag: '🇮🇹' },
  { code: 'pt', fileCode: 'pt', labelCode: 'pt', name: 'Portugalština', flag: '🇵🇹' },
  { code: 'ru', fileCode: 'ru', labelCode: 'ru', name: 'Ruština', flag: '🇷🇺' },
  { code: 'uk', fileCode: 'uk', labelCode: 'uk', name: 'Ukrajinština', flag: '🇺🇦' },
  { code: 'bg', fileCode: 'bg', labelCode: 'bg', name: 'Bulharština', flag: '🇧🇬' },
  { code: 'ro', fileCode: 'ro', labelCode: 'ro', name: 'Rumunština', flag: '🇷🇴' },
  { code: 'hu', fileCode: 'hu', labelCode: 'hu', name: 'Maďarština', flag: '🇭🇺' },
  { code: 'nl', fileCode: 'nl', labelCode: 'nl', name: 'Holandština', flag: '🇳🇱' },
  { code: 'sv', fileCode: 'sv', labelCode: 'sv', name: 'Švédština', flag: '🇸🇪' },
  { code: 'da', fileCode: 'da', labelCode: 'da', name: 'Dánština', flag: '🇩🇰' },
  { code: 'no', fileCode: 'no', labelCode: 'no', name: 'Norština', flag: '🇳🇴' },
  { code: 'fi', fileCode: 'fi', labelCode: 'fi', name: 'Finština', flag: '🇫🇮' },
  { code: 'el', fileCode: 'el', labelCode: 'el', name: 'Řečtina', flag: '🇬🇷' },
  { code: 'tr', fileCode: 'tr', labelCode: 'tr', name: 'Turečtina', flag: '🇹🇷' },
  { code: 'ar', fileCode: 'ar', labelCode: 'ar', name: 'Arabština', flag: '🇸🇦' },
  { code: 'zh-cn', fileCode: 'zh-CN', labelCode: 'zh-CN', name: 'Čínština', flag: '🇨🇳' },
  { code: 'ja', fileCode: 'ja', labelCode: 'ja', name: 'Japonština', flag: '🇯🇵' },
  { code: 'ko', fileCode: 'ko', labelCode: 'ko', name: 'Korejština', flag: '🇰🇷' },
  { code: 'he', fileCode: 'he', labelCode: 'he', name: 'Hebrejština', flag: '🇮🇱' }
];

const TARGET_LANGUAGE_CATALOG = [
  { code: 'cz', name: 'Čeština', flag: '🇨🇿' },
  { code: 'en', name: 'Angličtina', flag: '🇬🇧' },
  { code: 'sk', name: 'Slovenština', flag: '🇸🇰' },
  { code: 'pl', name: 'Polština', flag: '🇵🇱' },
  { code: 'de', name: 'Němčina', flag: '🇩🇪' },
  { code: 'fr', name: 'Francouzština', flag: '🇫🇷' },
  { code: 'es', name: 'Španělština', flag: '🇪🇸' },
  { code: 'it', name: 'Italština', flag: '🇮🇹' },
  { code: 'pt', name: 'Portugalština', flag: '🇵🇹' },
  { code: 'ru', name: 'Ruština', flag: '🇷🇺' },
  { code: 'uk', name: 'Ukrajinština', flag: '🇺🇦' },
  { code: 'bg', name: 'Bulharština', flag: '🇧🇬' },
  { code: 'ro', name: 'Rumunština', flag: '🇷🇴' },
  { code: 'hu', name: 'Maďarština', flag: '🇭🇺' },
  { code: 'nl', name: 'Holandština', flag: '🇳🇱' },
  { code: 'sv', name: 'Švédština', flag: '🇸🇪' },
  { code: 'da', name: 'Dánština', flag: '🇩🇰' },
  { code: 'no', name: 'Norština', flag: '🇳🇴' },
  { code: 'fi', name: 'Finština', flag: '🇫🇮' },
  { code: 'el', name: 'Řečtina', flag: '🇬🇷' },
  { code: 'tr', name: 'Turečtina', flag: '🇹🇷' },
  { code: 'ar', name: 'Arabština', flag: '🇸🇦' },
  { code: 'zh-cn', name: 'Čínština', flag: '🇨🇳' },
  { code: 'ja', name: 'Japonština', flag: '🇯🇵' },
  { code: 'ko', name: 'Korejština', flag: '🇰🇷' },
  { code: 'he', name: 'Hebrejština', flag: '🇮🇱' },
  { code: 'personal', name: 'Vlastní (Personal)', flag: '👤' }
];

let uiLangAvailabilityCache = null;
const I18N_TOOL_PREFILL_LANG_KEY = 'strong_i18n_tool_prefill_lang';

async function listI18nJsonFilesFromDirectory() {
  // GitHub Pages (a další static hosts) neumožňují directory listing → přeskočit a použít fallback
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return null;
  }
  try {
    const res = await fetch('./i18n/', { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    const fileSet = new Set();
    const re = /href=["']([^"']+\.json)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const href = String(m[1] || '');
      const filename = href.split('/').pop();
      if (!filename) continue;
      fileSet.add(decodeURIComponent(filename).toLowerCase());
    }
    return fileSet;
  } catch {
    return null;
  }
}

async function detectUiLangAvailability() {
  if (uiLangAvailabilityCache) return uiLangAvailabilityCache;
  const directoryFiles = await listI18nJsonFilesFromDirectory();
  let checks = [];
  if (directoryFiles && directoryFiles.size) {
    checks = UI_LANGUAGE_CATALOG.map((lang) => ({
      ...lang,
      available: directoryFiles.has(`${String(lang.fileCode).toLowerCase()}.json`)
    }));
  } else {
    // On hosts without directory listing (e.g. GitHub Pages), verify file existence directly.
    checks = await Promise.all(UI_LANGUAGE_CATALOG.map(async (lang) => {
      const fileCode = String(lang.fileCode || '').trim();
      let available = false;
      if (fileCode) {
        try {
          const res = await fetch(`./i18n/${fileCode}.json`, { cache: 'no-store' });
          available = !!res.ok;
        } catch {
          available = false;
        }
      }
      // Keep whitelist protection as a hard gate.
      if (!UI_LANGS.has(String(lang.code || '').toLowerCase())) available = false;
      return { ...lang, available };
    }));
  }
  uiLangAvailabilityCache = checks;
  return checks;
}

function createUiLangOption(lang) {
  const option = document.createElement('option');
  option.value = lang.code;
  option.dataset.dynamicUiLang = '1';
  option.dataset.available = lang.available ? '1' : '0';
  option.dataset.fileCode = lang.fileCode;
  option.textContent = `${lang.flag} ${lang.name} (${lang.labelCode})`;
  return option;
}

function bindUiLanguageSelectBehavior() {
  const select = document.getElementById('uiLanguage');
  if (!select || select.dataset.i18nBind === '1') return;
  select.dataset.i18nBind = '1';
  select.addEventListener('change', () => {
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    if (String(opt.dataset.available || '') === '1') return;
    const fileCode = String(opt.dataset.fileCode || '').trim();
    if (!fileCode) return;
    safeSetLocalStorage(I18N_TOOL_PREFILL_LANG_KEY, fileCode, 'settingsModals');
    closePromptLangModal();
    if (typeof window.showI18nToolModal === 'function') {
      window.showI18nToolModal();
      showToast(t('toast.i18nTool.jsonMissingOpened', { file: `${fileCode}.json` }));
    }
  });
}

async function populateUiLanguageSelect() {
   const select = document.getElementById('uiLanguage');
    if (!select) return;
    const current = String(localStorage.getItem(UI_LANG_KEY) || DEFAULT_UI_LANG).toLowerCase();
    const checked = await detectUiLangAvailability();
    const available = checked.filter((x) => x.available);
    const missing = checked.filter((x) => !x.available);

    available.forEach((lang) => UI_LANGS.add(lang.code));

    // Load custom languages from localStorage
    const customLangs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('strong_ui_lang_custom_')) {
        const code = key.replace('strong_ui_lang_custom_', '');
        if (code !== 'active') {
          customLangs.push({ code, name: `Vlastní: ${code}` });
        }
      }
    }

    const fragment = document.createDocumentFragment();
    available.forEach((lang) => fragment.appendChild(createUiLangOption(lang)));
    if (available.length && missing.length) {
      const separator = document.createElement('option');
      separator.disabled = true;
      separator.textContent = t('uiLanguage.separator');
      fragment.appendChild(separator);
    }
    missing.forEach((lang) => fragment.appendChild(createUiLangOption(lang)));

    // Add custom languages section
    if (customLangs.length) {
      const customSeparator = document.createElement('option');
      customSeparator.disabled = true;
      customSeparator.textContent = '— Vlastní jazyky —';
      fragment.appendChild(customSeparator);
      customLangs.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang.code;
        option.dataset.customUiLang = '1';
        option.textContent = lang.name;
        fragment.appendChild(option);
      });
    }

    select.innerHTML = '';
    select.appendChild(fragment);
    bindUiLanguageSelectBehavior();
    const canKeepCurrent = Array.from(select.options).some((opt) => opt.value === current);
    if (canKeepCurrent) select.value = current;
    else if (available.length) select.value = available[0].code;
    else select.value = DEFAULT_UI_LANG;
  }

  function populateTargetLanguageSelect() {
    const select = document.getElementById('targetLanguage');
    if (!select) return;
    const current = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    const fragment = document.createDocumentFragment();
    TARGET_LANGUAGE_CATALOG.forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang.code;
      option.textContent = `${lang.flag} ${lang.name}`;
      fragment.appendChild(option);
    });
    select.innerHTML = '';
    select.appendChild(fragment);
    if (Array.from(select.options).some((opt) => opt.value === current)) {
      select.value = current;
    } else {
      select.value = 'cz';
    }
  }

function getDefaultContentTagForTarget(targetRaw) {
  let target = String(targetRaw || 'cz').toLowerCase();
  if (target === 'cs') target = 'cz';
  const map = {
    cz: 'CZ',
    en: 'EN',
    sk: 'SK',
    pl: 'PL',
    bg: 'BG',
    ch: 'zh-CN',
    sp: 'ES',
    gr: 'EL',
    he: 'HE'
  };
  return map[target] || 'EN';
}

 function showSettingsModal() {
   initPipelineModelSelectorsInSettingsModal();
    const autoTokenLimitEl = document.getElementById('autoTokenLimit');
    const tokenLimitRunMobileEl = document.getElementById('tokenLimitRunMobile');
    console.log('[showSettingsModal] autoTokenLimit:', autoTokenLimitEl, 'tokenLimitRunMobile:', tokenLimitRunMobileEl);
    if (autoTokenLimitEl && tokenLimitRunMobileEl) {
      tokenLimitRunMobileEl.value = autoTokenLimitEl.value;
    } else if (tokenLimitRunMobileEl) {
      const saved = localStorage.getItem('strong_auto_token_limit') || '0';
      tokenLimitRunMobileEl.value = saved;
      console.log('[showSettingsModal] fallback to localStorage:', saved);
    } else {
      console.warn('showSettingsModal: tokenLimitRunMobile missing', { autoTokenLimitEl, tokenLimitRunMobileEl });
    }
  document.getElementById('settingsModal').classList.add('show');
}

function closeSettingsModal() {
  const mainGroq = document.getElementById('providerRunMainGroqModel')?.value || '';
  const secGemini = document.getElementById('providerRunSecondaryGeminiModel')?.value || '';
  const secOpenRouter = document.getElementById('providerRunSecondaryOpenrouterModel')?.value || '';
  if (mainGroq) setPipelineModelForProvider('groq', mainGroq);
  if (secGemini) setPipelineModelForProvider('gemini', secGemini);
  if (secOpenRouter) setPipelineModelForProvider('openrouter', secOpenRouter);
   updateAutoProviderCountdowns();
   const providerEl = document.getElementById('provider');
   if (providerEl) providerEl.value = 'groq';
   const mainGroqEl = document.getElementById('model');
   if (mainGroq && mainGroqEl) mainGroqEl.value = mainGroq;
    // Set token limit BEFORE init calls – original order
    const tokenLimitRunMobile = document.getElementById('tokenLimitRunMobile');
    if (tokenLimitRunMobile) {
      const newVal = tokenLimitRunMobile.value || '0';
      localStorage.setItem('strong_auto_token_limit', newVal);
      const autoTokenLimit = document.getElementById('autoTokenLimit');
      if (autoTokenLimit) {
        autoTokenLimit.value = newVal;
      }
    } else {
      console.warn('closeSettingsModal: tokenLimitRunMobile not found', { tokenLimitRunMobile });
    }
   onProviderChange();
   initPipelineModelSelectors();
   initRunSelects();
   updateSetupCompactSummary();
   document.getElementById('settingsModal').classList.remove('show');
}

// â”€â”€ Limits Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function showPromptAIModal() {
  const modal = document.getElementById('promptAIModal');
  ['groq', 'gemini', 'openrouter'].forEach(prov => {
    const savedTemp = localStorage.getItem(`strong_ai_temperature_${prov}`) || localStorage.getItem('strong_ai_temperature') || '0.3';
    const savedMax = localStorage.getItem(`strong_ai_max_tokens_${prov}`) || localStorage.getItem('strong_ai_max_tokens') || '2500';
    const tempEl = document.getElementById(`aiTemperature_${prov}`);
    const maxEl = document.getElementById(`aiMaxTokens_${prov}`);
    if (tempEl) tempEl.value = savedTemp;
    if (maxEl) maxEl.value = savedMax;
  });
  // Load token limit for auto translate
  const savedTokenLimit = localStorage.getItem('strong_auto_token_limit') || '0';
  document.getElementById('tokenLimitRunMobile').value = savedTokenLimit;
  modal.style.display = 'flex';
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) closePromptAIModal();
  };
}

function closePromptAIModal() {
  document.getElementById('promptAIModal').style.display = 'none';
}

function saveAISettings() {
  ['groq', 'gemini', 'openrouter'].forEach(prov => {
    const temp = document.getElementById(`aiTemperature_${prov}`)?.value || '0.3';
    const max = document.getElementById(`aiMaxTokens_${prov}`)?.value || '2500';
    safeSetLocalStorage(`strong_ai_temperature_${prov}`, temp, 'settingsModals');
    safeSetLocalStorage(`strong_ai_max_tokens_${prov}`, max, 'settingsModals');
  });
  // Save token limit for auto translate
  const tokenLimit = document.getElementById('tokenLimitRunMobile')?.value || '0';
  safeSetLocalStorage('strong_auto_token_limit', tokenLimit, 'settingsModals');
  closePromptAIModal();
  showToast(t('toast.ai.settings.saved'));
}

   async function showPromptLangModal() {
    const modal = document.getElementById('promptLangModal');
    const savedLang = localStorage.getItem('strong_target_lang') || 'cz';
    const savedSource = localStorage.getItem('strong_source_lang') || 'gr';
    await populateUiLanguageSelect();
    populateTargetLanguageSelect();
    const savedUi = String(localStorage.getItem(UI_LANG_KEY) || getUiLang()).toLowerCase();
    document.getElementById('targetLanguage').value = savedLang;
    document.getElementById('sourceLanguage').value = savedSource;
    const uiLanguageEl = document.getElementById('uiLanguage');
    if (uiLanguageEl) uiLanguageEl.value = savedUi;
    syncPersonalPromptVisibility();
    // Zobraz/skryj personal textarea při změně jazyka
    const targetSelect = document.getElementById('targetLanguage');
    if (targetSelect && !targetSelect.dataset.personalBind) {
      targetSelect.dataset.personalBind = '1';
      targetSelect.addEventListener('change', syncPersonalPromptVisibility);
    }
    modal.style.display = 'flex';
    // Close on backdrop click
    modal.onclick = (e) => {
      if (e.target === modal) closePromptLangModal();
    };
  }

 function closePromptLangModal() {
    document.getElementById('promptLangModal').style.display = 'none';
  }

  function loadPersonalPromptIntoTextarea() {
    const stored = localStorage.getItem(PERSONAL_PROMPT_KEY);
    const textarea = document.getElementById('personalPromptTextarea');
    if (textarea) {
      textarea.value = stored || '';
    }
  }

  function syncPersonalPromptVisibility() {
    const targetSelect = document.getElementById('targetLanguage');
    const personalRow = document.getElementById('personalPromptRow');
    const textarea = document.getElementById('personalPromptTextarea');
    if (!targetSelect || !personalRow || !textarea) return;
    if (targetSelect.value === 'personal') {
      personalRow.style.display = '';
      loadPersonalPromptIntoTextarea();
    } else {
      personalRow.style.display = 'none';
    }
  }

  async function loadPersonalPromptFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const promptData = JSON.parse(text);
      const textarea = document.getElementById('personalPromptTextarea');
      if (textarea) {
        textarea.value = text;
        showToast(t('toast.lang.custom.loaded', { lang: file.name }));
      }
    } catch (err) {
      showToast(t('toast.lang.custom.error', { error: String(err.message || err) }));
    }
    event.target.value = '';
  }

 async function loadCustomLangFile(event) {
   const file = event.target.files[0];
   if (!file) return;
   try {
     const text = await file.text();
     const langData = JSON.parse(text);
     const langCode = file.name.replace('.json', '').toLowerCase();
     safeSetLocalStorage(`strong_ui_lang_custom_${langCode}`, JSON.stringify(langData), 'settingsModals');
     safeSetLocalStorage('strong_ui_lang_custom_active', langCode, 'settingsModals');
     safeSetLocalStorage(UI_LANG_KEY, langCode, 'settingsModals');
     if (!window.__CUSTOM_UI_MESSAGES__) window.__CUSTOM_UI_MESSAGES__ = {};
     window.__CUSTOM_UI_MESSAGES__[langCode] = langData;
     applyUiLanguage();
     updatePromptLangButtonLabel();
     showToast(t('toast.lang.custom.loaded', { lang: langCode }));
   } catch (err) {
     showToast(t('toast.lang.custom.error', { error: String(err.message || err) }));
   }
   event.target.value = '';
 }

function updatePromptLangButtonLabel() {
  const btn = document.getElementById('btnPromptLang');
  if (!btn) return;
  const ui = getUiLang();
  let target = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  if (target === 'cs') target = 'cz';
  btn.title = t('lang.btn.title');
  btn.textContent = t('lang.btn.label', { ui, ai: target });
}

function saveLangSettings() {
    const prevTarget = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
    const target = document.getElementById('targetLanguage').value;
    const source = document.getElementById('sourceLanguage').value;
    const uiRaw = String(document.getElementById('uiLanguage')?.value || DEFAULT_UI_LANG).toLowerCase();
    // Allow custom languages too (not just UI_LANGS whitelist)
    const customMessages = typeof window !== 'undefined' ? window.__CUSTOM_UI_MESSAGES__ : null;
    const ui = (UI_LANGS.has(uiRaw) || customMessages?.[uiRaw]) ? uiRaw : DEFAULT_UI_LANG;
    console.log('[saveLangSettings] uiRaw:', uiRaw, 'ui:', ui, 'isCustom:', !!customMessages?.[uiRaw]);
    safeSetLocalStorage('strong_target_lang', target, 'settingsModals');
    safeSetLocalStorage('strong_source_lang', source, 'settingsModals');
    safeSetLocalStorage(UI_LANG_KEY, ui, 'settingsModals');
    safeRemoveLocalStorage(CONTENT_TAG_LANG_KEY, 'settingsModals');
    safeRemoveLocalStorage(CONTENT_TAG_LANG_MANUAL_KEY, 'settingsModals');
    // Uložení personal promptu pokud je zvolen target 'personal'
    if (target === 'personal') {
      const textarea = document.getElementById('personalPromptTextarea');
      if (textarea) {
        safeSetLocalStorage(PERSONAL_PROMPT_KEY, textarea.value, 'settingsModals');
      }
    }
    refreshLanguageAwarePromptOptionLabels();
    applySystemPromptForCurrentTask();
    applyUiLanguage();
    updatePromptLangButtonLabel();
    // Aktualizace seznamu a statistik po změně zdrojového jazyka
    renderList();
    updateStats();
    closePromptLangModal();
    showToast(t('toast.lang.settings.saved'));
  }

  return { showSettingsModal, closeSettingsModal, showPromptAIModal, closePromptAIModal, saveAISettings, showPromptLangModal, closePromptLangModal, updatePromptLangButtonLabel, saveLangSettings, loadCustomLangFile, loadPersonalPromptFile };
}
