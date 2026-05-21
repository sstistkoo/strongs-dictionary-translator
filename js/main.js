  // -- CORE MODULE IMPORT -------------------------------------------
  import core from '../strong_translator_core_new.js';
  import prompts from '../strong_prompts.js';
  import {
    getProviderConfiguredModelsForAI,
    buildSecondaryProviderModelCandidates,
    getRankedModelsForSecondary,
    getStaticFallbackModels
  } from '../strong_translator_ai.js';
  import { state } from './state.js';
   import {
     CONFIG,
     ITEM_HEIGHT,
     BUFFER_ITEMS,
     PROVIDERS,
     GEMINI_SYSTEM_MODEL,
     LEGACY_STORE_KEY,
     AUTO_PROVIDER_ENABLED_KEY,
     AUTO_TOKEN_LIMIT_KEY,
     PIPELINE_SECONDARY_ENABLED_KEY,
     TEST_HISTORY_KEY,
     MODEL_TEST_OUTPUT_KEY,
     MODEL_TEST_STATS_KEY,
     MODEL_TEST_PROMPT_TYPE_KEY,
     MODEL_TEST_PROMPT_COMPARE_TYPE_KEY,
     MODEL_TEST_PROMPT_COMPARE_ENABLE_KEY,
     MODEL_TEST_CUSTOM_PROMPT_KEY,
     MODEL_TEST_ENABLE_PROMPT_KEY,
     MODEL_TEST_RAW_OUTPUT_KEY,
     MODEL_TEST_MODEL_STORAGE_KEY,
     MODEL_TEST_PINNED_MODELS,
API_KEY_PROFILES_PREFIX,
      API_KEY_ACTIVE_PROFILE_PREFIX,
      BATCH_SIZE_KEY,
      INTERVAL_KEY
    } from './config.js';
import {
  UI_LANG_KEY,
  DEFAULT_UI_LANG,
  UI_LANGS,
  loadUiMessages,
  getUiLang,
  consumeUiLangFallback,
  t,
  uiLabel,
  refreshStaticProviderSelectLabel,
  getContentLangTag,
  getDefaultContentTag,
  preloadPromptPacks
} from './i18n.js';
   import { sleepMs, sleep, debounce, formatAiResponseTime, escHtml } from './utils.js';
import { getTranslationStateForKey } from './translation/utils.js';
   import { createCallApi } from './ai/call.js';
   import { StorageStats } from './storageStats.js';
import {
  computeFileId,
  storeKey,
  backupKey,
  undoKey,
  checkQuotaAndMaybeAutoBackup
} from './storage.js';
import { setItem as idbSetItem, getItem as idbGetItem, removeItem as idbRemoveItem } from './idbStorage.js';
    import { cleanupOldBackups } from './storage.js';
   
   // UI a translation API moduly
   import { createExportApi } from './exportData.js';
   import { createToastApi } from './ui/toast.js';
   import { createHeaderApi } from './ui/header.js';
   import { createModalsApi } from './ui/modals.js';
   import { startResize as uiStartResize, doResize as uiDoResize, stopResize as uiStopResize } from './ui/resize.js';
import { createListApi } from './ui/list.js';
    import { createDetailApi } from './ui/detail.js';
    import { createBatchApi } from './translation/batch.js';
    import { getDefaultBatchTopicSystemPrompt, getDefaultBatchTopicUserPrompt } from './translation/topicRepair.js';
    import { createTopicRepairApi } from './translation/topicRepair.js';
    import { createLimitsApi } from './ui/limits.js';
    import { BAD_TRANSLATIONS, exportBadTranslationsJSON } from './badTranslations.js';
   import { createPreviewApi } from './ui/preview.js';
   import { createSettingsApi } from './settings.js';
   import { createModelTestOutputApi } from './modelTestOutput.js';
   import { createBackupApi } from './backup.js';
   import { createApiKeysApi } from './apiKeys.js';
   import { createSettingsModalsApi } from './ui/settingsModals.js';
   import { createAutoApi } from './auto.js';
   import { createModelTestUiApi, createModelTestRunnerApi } from './modelTest.js';
   import { createPromptLibraryApi } from './promptLibrary.js';
  import {
    getResolvedSystemMessage,
    getResolvedDefaultPrompt,
    getResolvedModelTestCatalog,
    getResolvedFinalPrompt,
    getResolvedPromptLibraryBase
  } from './aiPromptsResolve.js';
  import { getPromptPack } from './i18n.js';
   import {
     hasMeaningfulValue, isDefinitionLowQuality, isTranslationComplete,
     hasAnyTranslationContent, getStrongKeyNumber,
     stripDefinitionOriginReferenceTail, isDefinitionLikelyEnglish,
     tryNormalizeNumberedOpenRouterResponse,
     getTranslationStateForKey as getState,
     fillMissingVyznamFromSource, fillMissingKjvFromSource, annotateEnglishDefinitionsInTranslated,
     applyFallbacksToParsedMap, parseWithOpenRouterNormalization
   } from './translation/utils.js';
  // Re-export for use in this module
const {
      parseTXT: parseTXTCore,
      buildRetryMessages: buildRetryMessagesCore,
    } = core;
const { MODEL_TEST_PROMPT_CATALOG: modelTestPromptCatalogFallback } = prompts;

function getModelTestPromptCatalog() {
  return getResolvedModelTestCatalog(modelTestPromptCatalogFallback);
}


  function formatAppTitleWithTargetLang(rawText, targetLang) {
    const text = String(rawText || '');
    const lang = String(targetLang || 'CZ');
    if (!text) return text;
    if (text.includes('{lang}')) return text.replaceAll('{lang}', lang);
    return text.replace(/(Strong\s*GR\s*?\s*)([A-Za-z-]+)/i, `$1${lang}`);
  }

  function getUiLangTag() {
    const ui = String(getUiLang() || 'cs').toLowerCase();
    const map = { cs: 'CZ', en: 'EN', sk: 'SK', pl: 'PL' };
    return map[ui] || 'CZ';
  }

function applyUiLanguage() {
    // Load custom language from localStorage if active
    try {
      const customLangCode = localStorage.getItem('strong_ui_lang_custom_active');
      if (customLangCode && (!window.__CUSTOM_UI_MESSAGES__ || !window.__CUSTOM_UI_MESSAGES__[customLangCode])) {
        const customLangData = localStorage.getItem(`strong_ui_lang_custom_${customLangCode}`);
        if (customLangData) {
          window.__CUSTOM_UI_MESSAGES__ = window.__CUSTOM_UI_MESSAGES__ || {};
          window.__CUSTOM_UI_MESSAGES__[customLangCode] = JSON.parse(customLangData);
        }
      }
    } catch (e) { /* ignore */ }
     refreshTopicLabels();
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const setAttr = (id, attr, value) => {
      const el = document.getElementById(id);
      if (el) el.setAttribute(attr, value);
    };
    const uiTitleLang = getUiLangTag();
    document.title = formatAppTitleWithTargetLang(t('app.title', { lang: uiTitleLang }), uiTitleLang);
    setText('setupTitle', formatAppTitleWithTargetLang(t('setup.title', { lang: uiTitleLang }), uiTitleLang));
    setText('setupAdvancedSummary', t('setup.advanced'));
    const providerForLabel = String(document.getElementById('provider')?.value || 'groq');
    setText('keyLabel', t('api.key.label', { provider: PROVIDERS[providerForLabel]?.label || 'Groq' }));
    setText('startBtn', t('setup.start'));
    setText('btnHelp', t('setup.help'));
    setText('btnLimits', t('setup.limits'));
    setAttr('btnHelp', 'title', t('setup.help'));
    setAttr('btnHelp', 'aria-label', t('setup.help'));
    setAttr('btnLimits', 'title', t('setup.limits'));
    setAttr('btnLimits', 'aria-label', t('setup.limits'));
    setText('pipelineGroupLabel', t('pipeline.group'));
    setText('pipelineMainLabel', t('pipeline.main'));
    setText('pipelineSecondaryGeminiLabel', t('pipeline.secondaryGemini'));
    setText('pipelineSecondaryOpenrouterLabel', t('pipeline.secondaryOpenrouter'));
    setText('pipelineEnableSecondaryGeminiText', t('pipeline.enableFixes'));
    setText('pipelineEnableSecondaryOpenrouterText', t('pipeline.enableFixes'));
    setText('fileLabel', t('setup.file'));
    setText('btnChooseFile', t('setup.chooseFile'));
    setText('btnLoadDefault', t('setup.loadAuto'));
    setAttr('btnChooseFile', 'aria-label', t('setup.chooseFile'));
    setAttr('btnLoadDefault', 'aria-label', t('setup.loadAuto'));
    setAttr('startBtn', 'aria-label', t('setup.start'));
    setAttr('provider', 'aria-label', t('setup.provider.aria'));
    setAttr('apiKey', 'aria-label', t('setup.apiKey.input.aria'));
    setAttr('apiKeyProfile', 'aria-label', t('setup.apiKey.profile.aria'));
    setAttr('model', 'aria-label', t('setup.model.aria'));
    setAttr('fileTXT', 'aria-label', t('setup.file.input.aria'));
    setAttr('pipelineModelMainGroq', 'aria-label', t('pipeline.mainGroq.aria'));
    setAttr('pipelineModelMainGroq', 'title', t('pipeline.mainGroq.aria'));
    setAttr('pipelineModelSecondaryGemini', 'aria-label', t('pipeline.secondaryGemini.aria'));
    setAttr('pipelineModelSecondaryGemini', 'title', t('pipeline.secondaryGemini.aria'));
    setAttr('pipelineModelSecondaryOpenrouter', 'aria-label', t('pipeline.secondaryOpenrouter.aria'));
    setAttr('pipelineModelSecondaryOpenrouter', 'title', t('pipeline.secondaryOpenrouter.aria'));
    setAttr('pipelineEnableSecondaryGemini', 'aria-label', t('pipeline.enableGemini.aria'));
    setAttr('pipelineEnableSecondaryOpenrouter', 'aria-label', t('pipeline.enableOpenrouter.aria'));
    setAttr('providerRunMainGroqModel', 'aria-label', t('pipeline.mainGroq.aria'));
    setAttr('providerRunMainGroqModel', 'title', t('pipeline.mainGroq.aria'));
    setAttr('providerRunSecondaryGeminiModel', 'aria-label', t('pipeline.secondaryGemini.aria'));
    setAttr('providerRunSecondaryGeminiModel', 'title', t('pipeline.secondaryGemini.aria'));
    setAttr('providerRunSecondaryOpenrouterModel', 'aria-label', t('pipeline.secondaryOpenrouter.aria'));
    setAttr('providerRunSecondaryOpenrouterModel', 'title', t('pipeline.secondaryOpenrouter.aria'));
    setAttr('providerRunEnableSecondaryGemini', 'aria-label', t('pipeline.enableGemini.aria'));
    setAttr('providerRunEnableSecondaryOpenrouter', 'aria-label', t('pipeline.enableOpenrouter.aria'));
    setAttr('autoEnable_groq', 'aria-label', t('auto.enableGroq.aria'));
    setAttr('autoEnable_gemini', 'aria-label', t('auto.enableGemini.aria'));
    setAttr('autoEnable_openrouter', 'aria-label', t('auto.enableOpenrouter.aria'));
    setAttr('autoEnableLabelGroq', 'title', t('auto.enableGroq.title'));
    setAttr('autoEnableLabelGemini', 'title', t('auto.enableGemini.title'));
    setAttr('autoEnableLabelOpenrouter', 'title', t('auto.enableOpenrouter.title'));
    setAttr('logScroll', 'aria-label', t('log.scroll.aria'));
    setText('lblDone', t('stats.done'));
    setText('lblRemain', t('stats.remain'));
    setText('lblTotal', t('stats.total'));
    setAttr('pbarContainer', 'title', t('progress.main.title'));
    setAttr('pbarContainer', 'aria-label', t('progress.main.title'));
    setText('autoTokenLimitLabel', t('stats.tokenLimit'));
    setText('btnImport', t('hdr.import'));
    setText('btnAuto', t('hdr.auto'));
    setText('btnToggleList', t('hdr.list'));
    setText('btnStep', t('hdr.batch'));
    setText('startFromLabel', t('hdr.fromG'));
    setAttr('startFrom', 'title', t('hdr.startFrom.title'));
    setAttr('startFrom', 'aria-label', t('hdr.startFrom.aria'));
    setAttr('btnJumpToStart', 'title', t('hdr.jumpToStart.title'));
    setAttr('btnJumpToStart', 'aria-label', t('hdr.jumpToStart.aria'));
    setText('btnTestModels', t('hdr.testModels'));
    setText('btnExportRange', t('hdr.exportRange'));
    setText('btnAISettingsDesktop', t('hdr.aiSettings'));
    const failedBtn = document.getElementById('btnFailedEntries');
    if (failedBtn) {
      const failedCountEl = document.getElementById('failedCount');
      failedBtn.textContent = `${t('hdr.failed')} `;
      if (failedCountEl) failedBtn.appendChild(failedCountEl);
    }
    const btnRestoreBackup = document.getElementById('btnRestoreBackup');
    if (btnRestoreBackup) btnRestoreBackup.textContent = t('hdr.restoreBackup');
    setAttr('btnImport', 'aria-label', t('hdr.import.aria'));
    setAttr('importFileInput', 'aria-label', t('hdr.import.aria'));
    setAttr('btnAuto', 'aria-label', t('hdr.auto.aria'));
    setAttr('btnToggleList', 'title', t('hdr.list.title'));
    setAttr('btnToggleList', 'aria-label', t('hdr.list.aria'));
    setAttr('btnStep', 'aria-label', t('hdr.batch.aria'));
    setAttr('btnTestModels', 'title', t('hdr.testModels.title'));
    setAttr('btnTestModels', 'aria-label', t('hdr.testModels.aria'));
    setAttr('btnI18nHelpTop', 'title', t('setup.help'));
    setAttr('btnExportRange', 'title', t('hdr.exportRange.title'));
    setAttr('btnExportRange', 'aria-label', t('hdr.exportRange.aria'));
    setAttr('btnFailedEntries', 'title', t('hdr.failed.title'));
    setAttr('btnFailedEntries', 'aria-label', t('hdr.failed.aria'));
    setAttr('btnAISettingsDesktop', 'title', t('hdr.aiSettings.title'));
    setAttr('btnAISettingsDesktop', 'aria-label', t('hdr.aiSettings.aria'));
    setAttr('mobileMenuBtn', 'aria-label', t('hdr.mobileActions.aria'));
    const resetBtn = document.querySelector('.hbtn.red.hdr-close');
    if (resetBtn) {
      resetBtn.setAttribute('title', t('hdr.reset.title'));
      resetBtn.setAttribute('aria-label', t('hdr.reset.aria'));
    }
    setAttr('btnRestoreBackup', 'title', t('hdr.restoreBackup.title'));
    setAttr('btnRestoreBackup', 'aria-label', t('hdr.restoreBackup.aria'));
    setText('autoInfoPrefix', t('auto.info.prefix'));
    setText('autoInfoSettings', t('auto.info.settings'));
    setText('autoInfoSeconds', t('auto.info.seconds'));
    setText('autoInfoInterval', t('auto.info.interval'));
    setAttr('autoBatchSizeInput', 'aria-label', t('setup.batchSize'));
    setAttr('autoBatchSizeInput', 'title', t('setup.batchSize'));
    setAttr('autoIntervalInput', 'aria-label', t('setup.interval'));
    setAttr('autoIntervalInput', 'title', t('setup.interval'));
    setText('btnAutoStop', t('auto.stop'));
    setAttr('btnAutoStop', 'aria-label', t('auto.stop.aria'));
    const autoLog = document.getElementById('autoLog');
    const autoLogText = (autoLog?.textContent || '').trim();
    if (autoLog && (autoLogText === 'Cek� na start...' || autoLogText === 'Waiting to start...')) {
      autoLog.textContent = t('auto.log.waiting');
    }
    refreshLanguageAwarePromptOptionLabels();
    setText('modelTestTitle', t('modelTest.title'));
    setText('modelTestProviderLabel', t('modelTest.providerLabel'));
    setAttr('modelTestProvider', 'aria-label', t('modelTest.providerLabel'));
    setAttr('modelTestProvider', 'title', t('modelTest.providerLabel'));
    setText('modelTestModelGroqLabel', t('modelTest.model.groq'));
    setAttr('modelTestModel_groq', 'aria-label', t('modelTest.model.groq'));
    setAttr('modelTestModel_groq', 'title', t('modelTest.model.groq'));
    setText('modelTestModelGeminiLabel', t('modelTest.model.gemini'));
    setAttr('modelTestModel_gemini', 'aria-label', t('modelTest.model.gemini'));
    setAttr('modelTestModel_gemini', 'title', t('modelTest.model.gemini'));
    setText('modelTestModelOpenrouterLabel', t('modelTest.model.openrouter'));
    setAttr('modelTestModel_openrouter', 'aria-label', t('modelTest.model.openrouter'));
    setAttr('modelTestModel_openrouter', 'title', t('modelTest.model.openrouter'));
    setText('modelTestModeLabel', t('modelTest.modeLabel'));
    setAttr('modelTestMode', 'aria-label', t('modelTest.modeLabel'));
    setAttr('modelTestMode', 'title', t('modelTest.modeLabel'));
    setText('modelTestPromptsLabel', t('modelTest.promptsLabel'));
    setAttr('modelTestPromptType', 'aria-label', t('modelTest.promptsLabel'));
    setAttr('modelTestPromptType', 'title', t('modelTest.promptsLabel'));
    setText('modelTestEnablePromptCompareText', t('modelTest.comparePrompts'));
    setText('modelTestPromptCompareLabel', t('modelTest.promptB'));
    setText('modelTestEnablePromptText', t('modelTest.enablePrompt'));
    setText('modelTestCustomPromptLabel', t('modelTest.customPromptLabel'));
    setAttr('modelTestCustomPromptInput', 'placeholder', t('modelTest.customPromptPlaceholder'));
    setText('modelTestDurationLabel', t('modelTest.duration'));
    setAttr('modelTestDurationMin', 'aria-label', t('modelTest.duration'));
    setAttr('modelTestDurationMin', 'title', t('modelTest.duration'));
    setText('modelTestAppendText', t('modelTest.appendResult'));
    setText('modelStatsThProviderModel', t('modelTest.table.providerModel'));
    setText('modelStatsThSuccess', t('modelTest.table.success'));
    setText('modelStatsThOkFail', t('modelTest.table.okFail'));
    setText('modelStatsThEntries', t('modelTest.table.entries'));
    setText('modelStatsThAvgAi', t('modelTest.table.avgAi'));
    setText('modelStatsThCalls', t('modelTest.table.calls'));
    setText('modelStatsThActions', t('modelTest.table.actions'));
    setText('btnModelTestClearOutput', t('modelTest.clearOutput'));
    setAttr('modelTestOutput', 'placeholder', t('modelTest.outputPlaceholder'));
    setText('btnRunModelTestTop', t('modelTest.runProvider'));
    setText('btnRunModelTest', t('modelTest.runProvider'));
    setText('btnModelTestLibrary', t('modelTest.library'));
    setText('btnModelTestSaveRaw', t('modelTest.saveRaw'));
    setText('btnModelTestLoadTxt', t('modelTest.loadTxt'));
    setText('btnCopyModelTestOutput', t('modelTest.copy'));
    setText('btnModelTestSaveTxt', t('modelTest.saveTxt'));
    setText('btnModelTestReset', t('modelTest.reset'));
    setText('btnCancelModelTest', t('modelTest.cancel'));
    setText('btnCloseModelTestModal', t('modelTest.close'));
    setText('promptAiModalTitle', t('promptAi.title'));
    setText('promptAiGroqTempLabel', t('promptAi.groq.temp'));
    setText('promptAiGroqMaxLabel', t('promptAi.groq.max'));
    setText('promptAiGeminiTempLabel', t('promptAi.gemini.temp'));
    setText('promptAiGeminiMaxLabel', t('promptAi.gemini.max'));
    setText('promptAiOpenrouterTempLabel', t('promptAi.openrouter.temp'));
    setText('promptAiOpenrouterMaxLabel', t('promptAi.openrouter.max'));
    setText('btnPromptAiClose', t('promptAi.close'));
    setText('btnPromptAiSave', t('promptAi.save'));
    const promptAiTempMap = {
      '0.1': t('promptAi.temp.0.1'),
      '0.3': t('promptAi.temp.0.3'),
      '0.5': t('promptAi.temp.0.5'),
      '0.7': t('promptAi.temp.0.7'),
      '1.0': t('promptAi.temp.1.0')
    };
    ['aiTemperature_groq', 'aiTemperature_gemini', 'aiTemperature_openrouter'].forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      select.querySelectorAll('option').forEach(opt => {
        const txt = promptAiTempMap[String(opt.value || '')];
        if (txt) opt.textContent = txt;
      });
    });
    const modelTestModeEl = document.getElementById('modelTestMode');
    if (modelTestModeEl) {
      const modeTextByValue = {
        smoke: t('modelTest.mode.smoke'),
        translate1: t('modelTest.mode.translate1'),
        translate3: t('modelTest.mode.translate3'),
        'auto-live': t('modelTest.mode.autoLive')
      };
      modelTestModeEl.querySelectorAll('option').forEach(opt => {
        const txt = modeTextByValue[String(opt.value || '')];
        if (txt) opt.textContent = txt;
      });
    }
    setText('modelTestPromptPreviewTitle', t('prompt.preview.title'));
    setText('modelTestPromptPreviewLabel', t('prompt.preview.label', { label: '-' }));
    setText('btnResetPromptPreview', t('modelTest.reset'));
    setText('btnCopyPromptPreview', t('prompt.preview.copy'));
    setText('btnClosePromptPreview', t('prompt.preview.close'));
    setAttr('btnOpenPromptPreview', 'title', t('prompt.preview.open.title'));
    setAttr('btnResetPromptPreview', 'title', t('prompt.preview.reset.title'));
    setText('promptLibraryTitle', t('prompt.library.title'));
    setText('btnPromptSystem', t('prompt.library.system.button'));
    setText('btnPromptExportTxt', t('prompt.library.export.button'));
    setAttr('btnPromptSystem', 'title', t('prompt.library.system.title'));
    setAttr('btnPromptExportTxt', 'title', t('prompt.library.export.title'));
    setAttr('btnPromptLoadTxt', 'title', t('prompt.library.load.title'));
    setText('btnPromptLoadTxt', t('prompt.library.load'));
    setText('btnPromptLibraryClose', t('prompt.library.close'));
    setText('btnPromptLibrarySaveApply', t('prompt.library.saveApply'));
    setText('btnSaveApiKeyProfile', t('apiKey.saveButton'));
    setAttr('btnSaveApiKeyProfile', 'title', t('apiKey.saveButton.title'));
    setText('btnDeleteApiKeyProfile', t('apiKey.deleteButton'));
    setAttr('btnDeleteApiKeyProfile', 'title', t('apiKey.deleteButton.title'));
    setText('btnPromptLibraryOpen', t('prompt.library.openButton'));
    setAttr('btnPromptLibraryOpen', 'title', t('prompt.library.openButton.title'));
    setAttr('promptStatus', 'title', t('prompt.status.title'));
    setAttr('btnPromptAuto', 'title', t('prompt.auto.title'));
    setAttr('fileIdBadge', 'title', t('file.active.title'));
    const hdrLangPair = document.getElementById('hdrLangPair');
    if (hdrLangPair) hdrLangPair.textContent = `GR-${getCurrentTargetLangCode()}`;
    const currentLegacyProv = String(document.getElementById('provider')?.value || '').trim();
    if (currentLegacyProv === 'groq' || currentLegacyProv === 'gemini') {
      refreshStaticProviderSelectLabel('model', currentLegacyProv);
    }
    refreshStaticProviderSelectLabel('pipelineModelMainGroq', 'groq');
    refreshStaticProviderSelectLabel('pipelineModelSecondaryGemini', 'gemini');
    refreshStaticProviderSelectLabel('providerRunMainGroqModel', 'groq');
    refreshStaticProviderSelectLabel('providerRunSecondaryGeminiModel', 'gemini');
    refreshStaticProviderSelectLabel('modelTestModel_groq', 'groq');
    refreshStaticProviderSelectLabel('modelTestModel_gemini', 'gemini');
    // Naplnit OR selects z API
    const orSelects = ['pipelineModelSecondaryOpenrouter', 'providerRunSecondaryOpenrouterModel', 'modelTestModel_openrouter'];
    orSelects.forEach(id => {
      const el = document.getElementById(id);
      if (el) populateOpenRouterModels(el, localStorage.getItem('strong_or_model_' + id) || localStorage.getItem('strong_model'), null);
    });
    const promptTabsEl = document.getElementById('promptTabs');
     if (promptTabsEl) {
       const tabKeyMap = {
         default: 'prompt.tab.default',
         test: 'prompt.tab.test'
       };
       promptTabsEl.querySelectorAll('.prompt-tab').forEach(tab => {
         const cat = String(tab.dataset.category || '');
         const key = tabKeyMap[cat];
         if (key) tab.textContent = t(key);
       });
     }
    setAttr('searchInput', 'placeholder', t('list.search.placeholder'));
    setAttr('searchInput', 'aria-label', t('list.search.aria'));
    setText('btnSelectRange', t('list.selectRange'));
    setAttr('btnSelectRange', 'title', t('list.selectRange.title'));
    setAttr('btnSelectRange', 'aria-label', t('list.selectRange.aria'));
    setAttr('filterStatus', 'aria-label', t('list.filterStatus.aria'));
    setAttr('filterSort', 'aria-label', t('list.filterSort.aria'));
    const batchSizeLabels = {
      '1': t('setup.batch.option.1'),
      '5': t('setup.batch.option.5'),
      '10': t('setup.batch.option.10'),
      '15': t('setup.batch.option.15'),
      '20': t('setup.batch.option.20')
    };
    const batchSizeRunMobileEl = document.getElementById('batchSizeRunMobile');
    if (batchSizeRunMobileEl) {
      batchSizeRunMobileEl.querySelectorAll('option').forEach(opt => {
        const txt = batchSizeLabels[String(opt.value || '')];
        if (txt) opt.textContent = txt;
      });
    }
     const filterStatusLabels = {
       all: t('list.filterStatus.all'),
       pending: t('list.filterStatus.pending'),
       missing_topic: t('list.filterStatus.missing_topic'),
       missing_topic_all: t('list.filterStatus.missing_topic_all'),
       missing_topic_definice: t('list.filterStatus.missing_topic_definice'),
       missing_topic_vyznam: t('list.filterStatus.missing_topic_vyznam'),
       missing_topic_kjv: t('list.filterStatus.missing_topic_kjv'),
       missing_topic_puvod: t('list.filterStatus.missing_topic_puvod'),
       missing_topic_specialista: t('list.filterStatus.missing_topic_specialista'),
       failed: t('list.filterStatus.failed'),
       done: t('list.filterStatus.done'),
       g_all: t('list.filterStatus.g_all'),
       h_all: t('list.filterStatus.h_all'),
       g_pending: t('list.filterStatus.g_pending'),
       h_pending: t('list.filterStatus.h_pending'),
       g_done: t('list.filterStatus.g_done'),
       h_done: t('list.filterStatus.h_done')
     };
    const filterStatusEl = document.getElementById('filterStatus');
    if (filterStatusEl) {
      for (const option of filterStatusEl.options) {
        if (Object.prototype.hasOwnProperty.call(filterStatusLabels, option.value)) {
          option.textContent = filterStatusLabels[option.value];
        }
      }
    }
    const filterSortLabels = {
      original: t('list.filterSort.original'),
      num: t('list.filterSort.num'),
      greek: t('list.filterSort.greek')
    };
    const filterSortEl = document.getElementById('filterSort');
    if (filterSortEl) {
      for (const option of filterSortEl.options) {
        if (Object.prototype.hasOwnProperty.call(filterSortLabels, option.value)) {
          option.textContent = filterSortLabels[option.value];
        }
      }
    }
    setText('btnMissingTopicFilter', t('list.topicFilter'));
    setAttr('btnMissingTopicFilter', 'title', t('list.topicFilter.title'));
    setAttr('btnMissingTopicFilter', 'aria-label', t('list.topicFilter.aria'));
    setAttr('btnSelectAllSmall', 'title', t('list.selectAll.title'));
    setAttr('btnSelectAllSmall', 'aria-label', t('list.selectAll.aria'));
    setAttr('btnSelectNoneSmall', 'title', t('list.selectNone.title'));
    setAttr('btnSelectNoneSmall', 'aria-label', t('list.selectNone.aria'));
     setText('btnTopicRepairMini', t('list.topicRepair.restore'));
     setAttr('btnTopicRepairMini', 'title', t('list.topicRepair.restore.title'));
     setAttr('btnTopicRepairMini', 'aria-label', t('list.topicRepair.restore.aria'));
     setText('topicRepairLabel', t('header.topicRepair'));
     setAttr('btnTopicRepair', 'title', t('header.topicRepair.title'));
     setAttr('btnTopicRepair', 'aria-label', t('header.topicRepair.aria'));
     setText('btnSelectAllVisible', t('list.selectAllVisible'));
    setAttr('btnSelectAllVisible', 'aria-label', t('list.selectAllVisible.aria'));
    setText('btnTranslateSelected', t('list.translateSelected'));
    setAttr('btnTranslateSelected', 'aria-label', t('list.translateSelected.aria'));
    setText('btnBackToSetup', t('log.back'));
    setAttr('btnBackToSetup', 'aria-label', t('log.back.aria'));
    setText('btnClearLog', t('log.clear'));
    setAttr('btnClearLog', 'aria-label', t('log.clear.aria'));
    setAttr('logHotkeysHint', 'title', t('log.hotkeys.title'));
    const logPlaceholder = document.getElementById('logPlaceholder');
    if (logPlaceholder) logPlaceholder.textContent = t('log.placeholder');
    setText('detailEmptyText', t('detail.empty'));
    setText('modalTitle', t('customModal.title'));
    setAttr('modalFrom', 'placeholder', t('customModal.from'));
    setAttr('modalTo', 'placeholder', t('customModal.to'));
    setText('btnCustomModalCancel', t('customModal.cancel'));
    setText('btnCustomModalOk', t('customModal.ok'));
    setText('mobileActionsTitle', t('mobile.actions.title'));
    setText('btnMobileImport', t('mobile.import'));
    setAttr('btnMobileImport', 'aria-label', t('mobile.import.aria'));
    setText('btnMobileBatch', t('mobile.batch'));
    setAttr('btnMobileBatch', 'aria-label', t('mobile.batch.aria'));
    setText('btnMobileSelectRange', t('mobile.selectRange'));
    setAttr('btnMobileSelectRange', 'aria-label', t('mobile.selectRange.aria'));
    setText('btnMobileMissingTopic', t('mobile.missingTopic'));
    setAttr('btnMobileMissingTopic', 'aria-label', t('mobile.missingTopic.aria'));
    setText('btnMobileExportTxt', t('mobile.exportTxt'));
    setAttr('btnMobileExportTxt', 'aria-label', t('mobile.exportTxt.aria'));
    setText('btnMobileExportJson', t('mobile.exportJson'));
    setAttr('btnMobileExportJson', 'aria-label', t('mobile.exportJson.aria'));
    setText('btnMobileExportRange', t('mobile.exportRange'));
    setAttr('btnMobileExportRange', 'aria-label', t('mobile.exportRange.aria'));
    setText('btnMobileAutoSeq', t('mobile.autoSeq'));
    setAttr('btnMobileAutoSeq', 'aria-label', t('mobile.autoSeq.aria'));
    setText('btnMobileTopicRepair', t('mobile.topicRepair'));
    setAttr('btnMobileTopicRepair', 'aria-label', t('mobile.topicRepair.aria'));
    setText('btnMobileTools', t('mobile.tools'));
    setAttr('btnMobileTools', 'aria-label', t('mobile.tools.aria'));
    setText('btnMobileAiSettings', t('mobile.aiSettings'));
    setAttr('btnMobileAiSettings', 'aria-label', t('mobile.aiSettings.aria'));
    setText('btnMobileClose', t('mobile.close'));
    setAttr('btnMobileClose', 'aria-label', t('mobile.close.aria'));
    setText('settingsModalTitle', t('settings.title'));
    setText('settingsMainModelLabel', t('settings.mainModel'));
    setText('settingsSecondaryGeminiLabel', t('settings.secondaryGemini'));
    setText('settingsSecondaryGeminiToggleText', t('settings.enableFixes'));
    setText('settingsSecondaryOpenrouterLabel', t('settings.secondaryOpenrouter'));
    setText('settingsSecondaryOpenrouterToggleText', t('settings.enableFixes'));
    setText('settingsBatchLabel', t('settings.batch'));
    setAttr('batchSizeRunMobile', 'aria-label', t('settings.batch'));
    setAttr('batchSizeRunMobile', 'title', t('settings.batch'));
    setText('settingsSpeedLabel', t('settings.speed'));
    setAttr('intervalRunMobile', 'aria-label', t('settings.speed'));
    setAttr('intervalRunMobile', 'title', t('settings.speed'));
    setText('btnSettingsSave', t('settings.save'));
    setAttr('btnSettingsSave', 'aria-label', t('settings.save.aria'));
    setText('btnSettingsClose', t('settings.close'));
    setAttr('btnSettingsClose', 'aria-label', t('settings.close.aria'));
    setText('limitsTitle', t('limits.title'));
    setText('limitsLoadingText', t('limits.loading'));
    setText('btnLimitsClose', t('limits.close'));
    setText('helpTitle', t('help.title', { lang: uiTitleLang }));
    setText('helpSectionAboutTitle', t('help.about'));
    setText('helpSectionKeysTitle', t('help.keys'));
    setText('helpSectionLibraryTitle', t('help.library'));
    setText('helpSectionLimitsTitle', t('help.limits'));
    setText('btnHelpClose', t('help.close'));
    setAttr('autoTokenLimit', 'placeholder', t('stats.tokenLimit.placeholder'));
    setAttr('autoTokenLimit', 'title', t('stats.tokenLimit.title'));
    setText('promptLangModalTitle', t('lang.modal.title'));
    setText('uiLanguageLabel', t('lang.modal.ui'));
    setText('targetLanguageLabel', t('lang.modal.target'));
     setText('sourceLanguageLabel', t('lang.modal.source'));
     const uiLanguageEl = document.getElementById('uiLanguage');
     if (uiLanguageEl) {
       const uiLangByValue = {
         cs: t('lang.option.cs'),
         en: t('lang.option.en'),
         sk: t('lang.option.sk'),
         pl: t('lang.option.pl'),
         es: t('lang.option.sp'),
         it: 'Italiano',
         pt: 'Portugu�s'
       };
       uiLanguageEl.querySelectorAll('option').forEach(opt => {
         if (opt.dataset.dynamicUiLang === '1') return;
         const text = uiLangByValue[String(opt.value || '')];
         if (text) opt.textContent = text;
       });
     }
     setText('btnI18nTranslateTool', t('lang.i18nTool.button'));
    setText('btnI18nToolOpenLangModal', t('i18nTool.buttons.selectLanguages'));
    setText('btnI18nToolCopyCmd', t('i18nTool.buttons.copyCommand'));
    setText('btnI18nToolRunBrowser', t('i18nTool.buttons.translate'));
    setText('btnI18nToolCancelBrowser', t('i18nTool.buttons.cancelTranslation'));
    setText('btnI18nToolEditOutput', t('i18nTool.buttons.editOutputJson'));
    setText('btnI18nToolLoadOutput', t('i18nTool.buttons.loadJsonForEdit'));
    setText('btnI18nToolMinimize', t('i18nTool.buttons.minimize'));
    setText('i18nToolEngineLabel', t('i18nTool.engine.label'));
    setText('i18nToolEngineOptionGoogle', t('i18nTool.engine.google'));
    setText('i18nToolEngineOptionDeepl', t('i18nTool.engine.deepl'));
    setText('i18nToolDeeplKeyLabel', t('i18nTool.deeplKey.label'));
    setText('i18nToolKeepPromptsEnText', t('i18nTool.keepPromptsEn.label'));
    setAttr('i18nToolDeeplKey', 'placeholder', t('i18nTool.deeplKey.placeholder'));
    setText('i18nToolLangModalTitle', t('i18nTool.langModal.title'));
    setText('btnI18nToolLangCloseTop', t('lang.modal.close'));
    setText('btnI18nToolLangSelectAll', t('i18nTool.langModal.selectAll'));
    setText('btnI18nToolLangDeselectAll', t('i18nTool.langModal.deselectAll'));
    setText('btnI18nToolLangDone', t('i18nTool.langModal.done'));
    setAttr('i18nToolLangSearch', 'placeholder', t('i18nTool.langModal.search'));
    setAttr('i18nToolLangSearch', 'aria-label', t('i18nTool.langModal.search'));
    setText('i18nToolDoneModalTitle', t('i18nTool.done.title'));
    setText('i18nToolDoneText', t('i18nTool.done.text'));
    setText('btnI18nToolDoneReopen', t('i18nTool.done.reopen'));
    setText('btnI18nToolDoneClose', t('i18nTool.done.close'));
    setText('i18nToolEditorTitle', t('i18nTool.editor.title'));
    setText('i18nToolHelpModalTitle', t('i18nTool.help.title'));
    setText('i18nToolHelpBody', buildI18nToolHelpText());
    setText('btnI18nToolHelpClose', t('lang.modal.close'));
    setAttr('i18nToolEditorText', 'aria-label', t('i18nTool.editor.title'));
    setAttr('i18nToolEditorText', 'title', t('i18nTool.editor.title'));
    setText('i18nToolEditorLangLabel', t('i18nTool.editor.outputLanguage'));
    setText('i18nToolEditorFormatNote', t('i18nTool.editor.formatNote'));
    setText('btnI18nToolEditorSave', t('i18nTool.editor.saveJson'));
    setText('btnI18nToolEditorClose', t('i18nTool.editor.closeEditor'));
    setText('i18nToolAiModalTitle', t('i18nTool.ai.modal.title'));
    setText('i18nToolAiModalHint', t('i18nTool.ai.modal.hint'));
    setText('btnI18nToolAiAttachJson', t('i18nTool.ai.buttons.attachJson'));
    setText('btnI18nToolAiBuildPrompt', t('i18nTool.ai.buttons.buildPrompt'));
    setText('btnI18nToolAiApplyResponse', t('i18nTool.ai.buttons.applyResponse'));
    setText('btnI18nToolDownloadAiResult', `${t('i18nTool.ai.buttons.downloadOutput')} (-ai-audit.json)`);
    setText('i18nToolAiBatchSizeLabel', t('i18nTool.ai.batchSize'));
    setText('i18nToolAiIntervalLabel', t('i18nTool.ai.interval'));
    setText('i18nToolAiPromptLabel', t('i18nTool.ai.promptLabel'));
    setText('i18nToolAiResponseLabel', t('i18nTool.ai.responseLabel'));
    setText('i18nToolAiPreviewLabel', t('i18nTool.ai.previewLabel'));
    setText('btnI18nToolAiClose', t('i18nTool.ai.closeModal'));
    setText('i18nToolCmdLabel', t('i18nTool.cmd.label'));
    setAttr('i18nToolAiResponse', 'placeholder', t('i18nTool.ai.responsePlaceholder'));
    setAttr('i18nToolAiPreview', 'placeholder', t('i18nTool.ai.previewPlaceholder'));
    const targetLanguageEl = document.getElementById('targetLanguage');
    if (targetLanguageEl) {
      const targetLangByValue = {
        cz: t('lang.option.cs'),
        en: t('lang.option.en'),
        bg: t('lang.option.bg'),
        ch: t('lang.option.ch'),
        sp: t('lang.option.sp'),
        sk: t('lang.option.sk'),
        pl: t('lang.option.pl'),
        gr: t('lang.option.gr'),
        he: t('lang.option.he')
      };
      targetLanguageEl.querySelectorAll('option').forEach(opt => {
        const text = targetLangByValue[String(opt.value || '')];
        if (text) opt.textContent = text;
      });
    }
    const sourceLanguageEl = document.getElementById('sourceLanguage');
    if (sourceLanguageEl) {
      const sourceLangByValue = {
        gr: t('lang.source.gr'),
        he: t('lang.source.he'),
        both: t('lang.source.both')
      };
      sourceLanguageEl.querySelectorAll('option').forEach(opt => {
        const text = sourceLangByValue[String(opt.value || '')];
        if (text) opt.textContent = text;
      });
    }
    setText('btnPromptLangClose', t('lang.modal.close'));
    setText('btnPromptLangSave', t('lang.modal.save'));
    const status = document.getElementById('statusTXT');
    const rawStatus = String(status?.textContent || '').trim();
    if (status && !status.classList.contains('ok') && (rawStatus === '� nevybr�no' || rawStatus === '� none selected' || rawStatus === '�')) {
      status.textContent = t('setup.file.none');
    }
    refreshTokenStatsDisplay();
    updatePromptLangButtonLabel();
    try {
      rebuildPromptLibrary(getActiveMainPromptTemplate('batch'));
    } catch (_) {}
  }
    
  // Use core functions, but override prompt handling for custom prompt modes
   const buildRetryMessages = buildRetryMessagesCore;
   
function enforceSpecialistaFormat(promptText) {
    return String(promptText || '');
}

  function getActiveMainPromptTemplate(context = 'batch') {
  const mode = String(localStorage.getItem('strong_prompt_mode') || 'system').toLowerCase();
  const saved = String(localStorage.getItem('strong_prompt') || '').trim();
  if (mode === 'custom' && saved) return saved;
  // Check if there's a prompt pack for target language
  const targetLang = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
  const targetPromptPack = getPromptPack(targetLang);
  if (targetPromptPack && targetPromptPack['aiPrompts.core.userDefault']) {
    return targetPromptPack['aiPrompts.core.userDefault'];
  }
  return context === 'topic' ? getSystemPromptForCurrentTask('topic') : getResolvedDefaultPrompt();
}

  // Custom buildPromptMessages that reads from localStorage
    function buildPromptMessages(batch) {
      const items = batch.map(e => {
        const def = e.definice || e.def || '';
        const tvar = e.orig || e.tvaroslovi || '';
        const tvarPart = tvar ? ` (${tvar})` : '';
        return `${e.key} | ${e.greek}${tvarPart}\nD: ${def}`;
      }).join('\n\n');
      
      const userPromptTemplate = getActiveMainPromptTemplate('batch');
      
      // Language substitution
      const targetLang = localStorage.getItem('strong_target_lang') || 'cz';
      const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
      const useEnglishNames = shouldUseEnglishLanguageNames(userPromptTemplate);
      const targetName = useEnglishNames ? getPromptLanguageNameEnglish(targetLang, 'target') : getPromptLanguageName(targetLang, 'target');
      const sourceName = useEnglishNames ? getPromptLanguageNameEnglish(sourceLang, 'source') : getPromptLanguageName(sourceLang, 'source');
      
      let processedPrompt = userPromptTemplate
        .replace(/{TARGET_LANG}/g, targetName)
        .replace(/{SOURCE_LANG}/g, sourceName);
       processedPrompt = enforceSpecialistaFormat(processedPrompt);
       
        const userContent = processedPrompt.includes('{HESLA}')
          ? processedPrompt.replace(/{HESLA}/g, items)
          : processedPrompt + '\n\n' + items;

        // ��������������������������������������������������������������������������
        // �-? DEBUG LOG: Kompletn� prompt odeslan� AI (kontrola form�tu, tokeny)
        // ��������������������������������������������������������������������������
        batch.forEach(e => {
           const def = (e.definice || e.def || '');
        });
        // ��������������������������������������������������������������������������

        return [
          { role: 'system', content: getActiveSystemMessage() },
          { role: 'user', content: userContent }
        ];
    }

    function getModelTestPromptType() {
      return localStorage.getItem(MODEL_TEST_PROMPT_TYPE_KEY) || 'preset_v12';
    }
    function getModelTestPromptCompareType() {
      return localStorage.getItem(MODEL_TEST_PROMPT_COMPARE_TYPE_KEY) || 'preset_v12';
    }
    function isModelTestPromptCompareEnabled() {
      return localStorage.getItem(MODEL_TEST_PROMPT_COMPARE_ENABLE_KEY) === '1';
    }

    function isModelTestPromptEnabled() {
      const v = localStorage.getItem(MODEL_TEST_ENABLE_PROMPT_KEY);
      return v === null ? true : v === '1';
    }

    function getModelTestCustomPromptText() {
      return localStorage.getItem(MODEL_TEST_CUSTOM_PROMPT_KEY) || '';
    }

     function getModelTestPromptTemplate(promptType) {
       const topicTemplate = getTopicPromptTemplateByPromptType(promptType);
       if (topicTemplate) return topicTemplate;
       const fromCatalog = getModelTestPromptCatalog()?.[promptType]?.template;
       if (fromCatalog) return fromCatalog;
       const custom = getModelTestCustomPromptText().trim();
       if (custom) return custom;
       return getActiveMainPromptTemplate('batch');
     }

function getActiveSystemMessage() {
          // Check for custom system prompt first
          const custom = localStorage.getItem('strong_custom_system_prompt');
          if (custom && custom.trim()) return custom.trim();
          
          // Vždy použijeme univerzální core system prompt
          const targetLang = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
          const targetPromptPack = getPromptPack(targetLang);
          if (targetPromptPack && targetPromptPack['aiPrompts.core.system']) {
            return targetPromptPack['aiPrompts.core.system'];
          }
          
          // Fall back to English core system prompt
          const enPromptPack = getPromptPack('en');
          if (enPromptPack && enPromptPack['aiPrompts.core.system']) {
            return enPromptPack['aiPrompts.core.system'];
          }
          
          // Final fallback
          return getResolvedSystemMessage();
        }

      function getActiveSecondarySystemMessage() {
        const secondary = localStorage.getItem('strong_secondary_system_prompt');
        if (secondary && secondary.trim()) return secondary.trim();
        // Fallback k hlavnímu systémovému promptu
        return getActiveSystemMessage();
      }

      function getActiveSecondaryUserPrompt(context = 'batch') {
        const secondaryUser = localStorage.getItem('strong_secondary_user_prompt');
        if (secondaryUser && secondaryUser.trim()) return secondaryUser.trim();
        // Fallback k hlavnímu uživatelskému promptu
        return getActiveMainPromptTemplate(context);
      }

      const EN_TOPIC_PROMPT_MAP = {
        preset_topic_vyznam_en: 'vyznam',
        preset_topic_definice_en: 'definice',
        preset_topic_kjv_en: 'kjv',
        preset_topic_puvod_en: 'puvod',
        preset_topic_specialista_en: 'specialista'
      };

    function getCurrentTargetLangCode() {
      let target = String(localStorage.getItem('strong_target_lang') || 'cz').toLowerCase();
      if (target === 'cs') target = 'cz';
      return target.toUpperCase();
    }

    function getPromptLanguageName(code, kind = 'target') {
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
      const fallbackKey = kind === 'source' ? 'lang.name.genitive.gr' : 'lang.name.genitive.cz';
      return t(keyMap[String(code || '').toLowerCase()] || fallbackKey);
    }

    function getPromptLanguageNameEnglish(code, kind = 'target') {
      const map = {
        cz: 'Czech',
        cs: 'Czech',
        en: 'English',
        bg: 'Bulgarian',
        ch: 'Chinese',
        sp: 'Spanish',
        sk: 'Slovak',
        pl: 'Polish',
        gr: 'Greek',
        he: 'Hebrew',
        both: 'Greek and Hebrew'
      };
      const fallback = kind === 'source' ? 'Greek' : 'Czech';
      return map[String(code || '').toLowerCase()] || fallback;
    }

    function shouldUseEnglishLanguageNames(promptTemplate) {
      const text = String(promptTemplate || '').trim();
      return /(^|\n)\s*You are\b/i.test(text) || /\bTranslate entries from\b/i.test(text);
    }

    function getTopicLabelNoTag(topicId) {
      const keyMap = {
        vyznam: 'topic.label.vyznam',
        definice: 'topic.label.definice',
        kjv: 'topic.label.kjv',
        puvod: 'topic.label.puvod',
        specialista: 'topic.label.specialista'
      };
      return t(keyMap[topicId] || topicId);
    }

    function formatEnTopicPromptLabel(topicId) {
      return `${t('prompt.topic.prefix')} ${getTopicLabelNoTag(topicId)} (EN -> ${getCurrentTargetLangCode()})`;
    }

    function isEnTopicPromptType(promptType) {
      return Object.prototype.hasOwnProperty.call(EN_TOPIC_PROMPT_MAP, String(promptType || ''));
    }

    function refreshLanguageAwarePromptOptionLabels() {
      const promptTypeSelect = document.getElementById('modelTestPromptType');
      if (!promptTypeSelect) return;
      const selected = promptTypeSelect.value;
      const topicByPromptType = {
        preset_topic_vyznam: 'vyznam',
        preset_topic_definice: 'definice',
        preset_topic_kjv: 'kjv',
        preset_topic_puvod: 'puvod',
        preset_topic_specialista: 'specialista',
        preset_topic_vyznam_batch: 'vyznam',
        preset_topic_definice_batch: 'definice',
        preset_topic_kjv_batch: 'kjv',
        preset_topic_puvod_batch: 'puvod',
        preset_topic_specialista_batch: 'specialista'
      };
      Object.entries(topicByPromptType).forEach(([promptType, topicId]) => {
        const option = promptTypeSelect.querySelector(`option[value="${promptType}"]`);
        if (!option) return;
        option.textContent = `${t('prompt.topic.prefix')} ${getTopicLabelNoTag(topicId)} (${getContentLangTag()})${promptType.endsWith('_batch') ? ` ${t('prompt.topic.batchSuffix')}` : ''}`;
      });
      Object.entries(EN_TOPIC_PROMPT_MAP).forEach(([promptType, topicId]) => {
        const option = promptTypeSelect.querySelector(`option[value="${promptType}"]`);
        if (option) option.textContent = formatEnTopicPromptLabel(topicId);
      });
      const customOption = promptTypeSelect.querySelector('option[value="custom"]');
      if (customOption) customOption.textContent = t('prompt.custom');
      const detailGroup = document.getElementById('promptGroupTopicDetail');
      if (detailGroup) detailGroup.label = t('prompt.topic.group.detail');
      const batchGroup = document.getElementById('promptGroupTopicBatch');
      if (batchGroup) batchGroup.label = t('prompt.topic.group.batch', { lang: getContentLangTag() });
      const enGroup = document.getElementById('promptGroupTopicEn');
      if (enGroup) enGroup.label = t('prompt.topic.group.en', { lang: getCurrentTargetLangCode() });
      if (selected) promptTypeSelect.value = selected;

      const promptTypeCompareSelect = document.getElementById('modelTestPromptTypeCompare');
      if (promptTypeCompareSelect) {
        const selectedCompare = promptTypeCompareSelect.value;
        promptTypeCompareSelect.innerHTML = promptTypeSelect.innerHTML;
        if (selectedCompare) promptTypeCompareSelect.value = selectedCompare;
      }
    }

    function getModelTestPromptTypeLabel(promptType) {
      if (promptType === 'custom') return t('prompt.custom');
      if (isEnTopicPromptType(promptType)) {
        return formatEnTopicPromptLabel(EN_TOPIC_PROMPT_MAP[promptType]);
      }
      const fromCatalog = getModelTestPromptCatalog()?.[promptType]?.label;
      return fromCatalog || t('prompt.custom');
    }

let _modelTestPromptPreviewOriginal = '';

function openModelTestPromptPreviewModal() {
  const modal = document.getElementById('modelTestPromptPreviewModal');
  const textEl = document.getElementById('modelTestPromptPreviewText');
  const labelEl = document.getElementById('modelTestPromptPreviewLabel');
  if (!modal || !textEl || !labelEl) return;
  const promptTypeSelect = document.getElementById('modelTestPromptType');
  const promptType = promptTypeSelect?.value || getModelTestPromptType();
  const isCustom = promptType === 'custom';
  const customPrompt = String(document.getElementById('modelTestCustomPromptInput')?.value || '').trim();
  const promptText = isCustom
    ? (customPrompt || getActiveMainPromptTemplate('batch'))
    : getModelTestPromptTemplate(promptType);
  labelEl.textContent = t('prompt.preview.label', { label: getModelTestPromptTypeLabel(promptType) });
  textEl.value = String(promptText || '').trim();
  _modelTestPromptPreviewOriginal = textEl.value;
  modal.style.display = 'flex';
}

function closeModelTestPromptPreviewModal() {
  const modal = document.getElementById('modelTestPromptPreviewModal');
  if (modal) modal.style.display = 'none';
}

function resetModelTestPromptPreview() {
  const textEl = document.getElementById('modelTestPromptPreviewText');
  if (textEl) textEl.value = _modelTestPromptPreviewOriginal;
}

async function copyModelTestPromptPreview() {
  const text = String(document.getElementById('modelTestPromptPreviewText')?.value || '');
  if (!text.trim()) {
    showToast(t('toast.prompt.preview.empty'));
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('toast.prompt.copied'));
  } catch (_) {
    showToast(t('toast.copy.failed'));
  }
}
    function getModelTestPromptTopicLabel(promptType) {
      if (isEnTopicPromptType(promptType)) {
        const base = String(EN_TOPIC_PROMPT_LABEL_BASE[promptType] || '').replace(/^T�ma:\s*/i, '');
        return `${base} (EN -> ${getCurrentTargetLangCode()})`;
      }
      return getModelTestPromptCatalog()?.[promptType]?.topicLabel || '';
    }

function buildPromptMessagesForModelTest(batch, promptType) {
      const items = batch.map(e => {
        const def = e.definice || e.def || '';
        const tvar = e.orig || e.tvaroslovi || '';
        const tvarPart = tvar ? ` (${tvar})` : '';
        return `${e.key} | ${e.greek}${tvarPart}\nD: ${def}`;
      }).join('\n\n');

      const targetLang = localStorage.getItem('strong_target_lang') || 'cz';
      const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
      const userPromptTemplate = getModelTestPromptTemplate(promptType);
      const useEnglishNames = shouldUseEnglishLanguageNames(userPromptTemplate);
      const targetName = useEnglishNames ? getPromptLanguageNameEnglish(targetLang, 'target') : getPromptLanguageName(targetLang, 'target');
      const sourceName = useEnglishNames ? getPromptLanguageNameEnglish(sourceLang, 'source') : getPromptLanguageName(sourceLang, 'source');
      let processedPrompt = String(userPromptTemplate || '')
        .replace(/{TARGET_LANG}/g, targetName)
        .replace(/{SOURCE_LANG}/g, sourceName);
       processedPrompt = enforceSpecialistaFormat(processedPrompt);
       const userContent = processedPrompt.includes('{HESLA}')
         ? processedPrompt.replace(/{HESLA}/g, items)
         : `${processedPrompt}\n\n${items}`;

       return [
         { role: 'system', content: getActiveSystemMessage() },
         { role: 'user', content: userContent }
       ];
    }

    function buildModelTestMessages(batch, testMode, promptType, promptEnabled) {
      if (testMode === 'smoke') {
        return [
          { role: 'system', content: t('modelTest.smoke.system') },
          { role: 'user', content: t('modelTest.smoke.user') }
        ];
      }
      if (promptEnabled) {
        return buildPromptMessagesForModelTest(batch, promptType);
      }
      return buildPromptMessages(batch);
    }

  // -- ERROR LOGGER -------------------------------------------------
  /**
   * Structured error logger with context and stack traces.
   * Logs to both console and UI log panel.
   */
  function logError(context, error, extra = {}) {
    const timestamp = new Date().toISOString();
    const stack = error.stack ? `\nStack: ${error.stack}` : '';
    const contextStr = `[${timestamp}] [${context}]`;


    // UI log
    logMsg(`? ${context}: ${error.message}`, 'err');
  }

  function logWarn(context, message, extra = {}) {
    log(`? ${context}: ${message}`);
  }

  function logInfo(context, message) {
    log(`? ${context}: ${message}`);
  }
  function getTestHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TEST_HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function pushTestHistory(entry) {
    const history = getTestHistory();
    history.unshift({ ts: Date.now(), ...entry });
    const persist = (limit) => localStorage.setItem(TEST_HISTORY_KEY, JSON.stringify(history.slice(0, limit)));
    try {
      persist(300);
    } catch (err) {
      // Fallback for small storage budgets: keep shorter history instead of crashing app flow.
      try {
        persist(80);
      } catch (err2) {
      }
    }
  }

function populateOpenRouterModels(selectElement, savedModel, callback) {
  const CACHE_KEY = 'openrouter_free_models_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minut — vždy fetchujeme na pozadí

  function restoreModel() {
    // Restore saved model or use first available
    if (savedModel && selectElement.querySelector(`option[value="${savedModel}"]`)) {
      selectElement.value = savedModel;
    } else if (selectElement.options.length > 0 && selectElement.options[0].value) {
      selectElement.value = selectElement.options[0].value;
    }
    // Save the selected model to localStorage
    if (selectElement.value) {
      localStorage.setItem('strong_model', selectElement.value);
    }
    if (callback) callback();
  }

  function normalizeCachedModels(models) {
    if (!Array.isArray(models)) return [];
    return models.map(m => {
      if (Array.isArray(m) && m.length >= 2) {
        return { value: String(m[0] || ''), label: String(m[1] || m[0] || '') };
      }
      if (m && typeof m === 'object') {
        const value = String(m.value || m.id || '');
        const label = String(m.label || m.name || value);
        return { value, label };
      }
      return null;
    }).filter(Boolean).filter(o => o.value);
  }

  // Try cache first (rychl� start), ale v�dy n�sledne zkus aktualizaci z API
  let hadFreshCache = false;
  const preferredModel = selectElement.value || savedModel || '';
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { timestamp, models } = JSON.parse(cached);
      const normalized = normalizeCachedModels(models);
      if (Date.now() - timestamp < CACHE_TTL && normalized.length >= 2) {
        // Use cached models
        selectElement.innerHTML = normalized.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        selectElement.disabled = false;
        restoreModel();
        hadFreshCache = true;
      }
    } catch (e) {
      // Invalid cache, fall through to fetch
    }
  }

  // Loading state only when no cache available
  if (!hadFreshCache) {
    selectElement.disabled = true;
    selectElement.innerHTML = `<option value="">${t('openrouter.loading')}</option>`;
  }

  fetch('https://openrouter.ai/api/v1/models')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      const modelsRaw = (data.data || []).filter(m => m.id && m.id.endsWith(':free'));
      // Nekter� polo�ky API mohou b�t metadata bez re�lne routovateln�ho endpointu
      // (pak pri testu vrac� 404 "No endpoints found"). Zkus�me je vyradit.
      const models = modelsRaw.filter(m => {
        if (Array.isArray(m.endpoints) && m.endpoints.length === 0) return false;
        if (m?.top_provider && m.top_provider.is_disabled === true) return false;
        return true;
      });
      const modelMap = new Map(models.map(m => [m.id, m]));

      const topCandidates = [
        { id: 'openrouter/rotate', fixedLabel: '↻ Rotovat označené modely', alwaysInclude: true },
        { id: 'openrouter/free', fixedLabel: t('provider.top.autoRouter') },
        { id: 'openai/gpt-oss-20b:free', fixedLabel: '? OpenAI GPT-OSS 20B (free)' },
        { id: 'nvidia/nemotron-nano-9b-v2:free', fixedLabel: '? NVIDIA Nemotron Nano 9B v2 (free)' }
      ];
      const topOptions = topCandidates
        .filter(c => c.alwaysInclude || c.id === 'openrouter/free' || modelMap.has(c.id))
        .map(c => ({ value: c.id, label: c.fixedLabel }));

      const topIds = new Set(topOptions.map(o => o.value));
      const otherOptions = models
        .filter(m => !topIds.has(m.id))
        .map(m => ({
          value: m.id,
          label: (m.name || m.id.replace(/:free$/, ''))
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const options = [...topOptions, ...otherOptions];

      if (options.length === 0) {
        selectElement.innerHTML = `<option value="">${t('openrouter.none')}</option>`;
        selectElement.disabled = true;
        restoreModel();
        return;
      }

      const optionHtml = options.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      selectElement.innerHTML = optionHtml;
      selectElement.disabled = false;
      if (preferredModel && selectElement.querySelector(`option[value="${preferredModel}"]`)) {
        selectElement.value = preferredModel;
      }

      // Cache the results
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          models: options.map(o => ({ value: o.value, label: o.label }))
        }));
      } catch (e) {
        // Storage full, ignore
      }

      if (!hadFreshCache) restoreModel();

      // Naplnit rotation panel checkboxy
      if (typeof window.refreshOrModelRotationPanel === 'function') {
        window.refreshOrModelRotationPanel(options);
      }
    })
    .catch(err => {
      if (hadFreshCache) return;

      // Fallback na jakoukoli dostupnou cache (i starou), aby app zustala provozn�
      try {
        const fallbackRaw = localStorage.getItem(CACHE_KEY);
        if (fallbackRaw) {
          const fallbackParsed = JSON.parse(fallbackRaw);
          const fallbackModels = normalizeCachedModels(fallbackParsed.models);
          if (fallbackModels.length > 0) {
            selectElement.innerHTML = fallbackModels.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
            selectElement.disabled = false;
            restoreModel();
            showToast(t('toast.openrouter.cache'));
            return;
          }
        }
      } catch (e) {
        // Ignore parse errors and show final error state
      }

      selectElement.innerHTML = `<option value="">${t('openrouter.error')}</option>`;
      selectElement.disabled = true;
      restoreModel();
    });
}

function onProviderChange() {
  const newProv = document.getElementById('provider').value;
  const currentProv = document.getElementById('provider')._lastProvider || newProv;

  // Save current key before switching
  const currentKey = document.getElementById('apiKey').value.trim();
  if (currentKey && currentProv !== newProv) {
    localStorage.setItem('strong_apikey_' + currentProv, currentKey);
  }

  // Load key for new provider
  const newKey = localStorage.getItem('strong_apikey_' + newProv);

  document.getElementById('keyLabel').textContent = t('api.key.label', { provider: PROVIDERS[newProv].label });
  document.getElementById('apiKey').placeholder = PROVIDERS[newProv].ph;
  document.getElementById('apiKey').value = newKey || '';
  setupApiKeySwitcher(newProv);

  const modelSelect = document.getElementById('model');

  if (newProv === 'openrouter') {
    const savedModel = localStorage.getItem('strong_model');
    populateOpenRouterModels(modelSelect, savedModel, () => {
      // Guard: if provider changed while loading, abort
      if (document.getElementById('provider').value !== 'openrouter') return;
    });
    // Refresh rotation panel hned - z cache
    try {
      const orCache = JSON.parse(localStorage.getItem('openrouter_free_models_cache') || '{}');
      const orOpts = (orCache.models || []).map(function(m) {
        return typeof m === 'object' && !Array.isArray(m) ? m : { value: String((m||[])[0]||''), label: String((m||[])[1]||(m||[])[0]||'') };
      }).filter(function(o) { return o.value; });
      if (orOpts.length && window.refreshOrModelRotationPanel) window.refreshOrModelRotationPanel(orOpts);
    } catch(e) {}
  } else {
    modelSelect.innerHTML = PROVIDERS[newProv].models.map(([v,l]) => `<option value="${v}">${uiLabel(l)}</option>`).join('');
    modelSelect.disabled = false;
    if (newProv === 'gemini' && modelSelect.querySelector(`option[value="${GEMINI_SYSTEM_MODEL}"]`)) {
      modelSelect.value = GEMINI_SYSTEM_MODEL;
      localStorage.setItem('strong_model', GEMINI_SYSTEM_MODEL);
    } else {
      // Restore saved model if still available
      const savedModel = localStorage.getItem('strong_model');
      if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
        modelSelect.value = savedModel;
      }
    }
  }

  localStorage.setItem('strong_provider', newProv);
  document.getElementById('provider')._lastProvider = newProv;
}

function initRunSelects() {
  const savedBatchSize = localStorage.getItem(BATCH_SIZE_KEY) || '5';
  const savedInterval = localStorage.getItem(INTERVAL_KEY) || '20';
  const bs = document.getElementById('batchSize');
  if (bs) bs.value = savedBatchSize;
  const iv = document.getElementById('interval');
  if (iv) iv.value = savedInterval;
  const bsRun = document.getElementById('batchSizeRun');
  if (bsRun && bs) bsRun.value = bs.value;
  const ivRun = document.getElementById('intervalRun');
  if (ivRun && iv) ivRun.value = iv.value;
  syncAutoPanelSettingsInputs();
}

function syncAutoPanelSettingsInputs() {
  const bs = parseInt(document.getElementById('batchSizeRun')?.value || document.getElementById('batchSize')?.value || '10', 10) || 10;
  const iv = parseInt(document.getElementById('intervalRun')?.value || document.getElementById('interval')?.value || '20', 10) || 20;
  const batchInput = document.getElementById('autoBatchSizeInput');
  const intervalInput = document.getElementById('autoIntervalInput');
  if (batchInput) batchInput.value = String(bs);
  if (intervalInput) intervalInput.value = String(iv);
  const autoIntervalEl = document.getElementById('autoInterval');
  if (autoIntervalEl) autoIntervalEl.textContent = String(iv);
  const autoBatchEl = document.getElementById('autoBatch');
  if (autoBatchEl && !state.autoRunning) autoBatchEl.textContent = t('list.batchCount', { count: bs });
}

function applyAutoPanelSettings() {
  const batchInput = document.getElementById('autoBatchSizeInput');
  const intervalInput = document.getElementById('autoIntervalInput');
  const bs = Math.max(1, Math.min(200, parseInt(String(batchInput?.value || '10'), 10) || 10));
  const iv = Math.max(1, Math.min(600, parseInt(String(intervalInput?.value || '20'), 10) || 20));
  if (batchInput) batchInput.value = String(bs);
  if (intervalInput) intervalInput.value = String(iv);
  const bsRun = document.getElementById('batchSizeRun');
  const ivRun = document.getElementById('intervalRun');
  const bsSetup = document.getElementById('batchSize');
  const ivSetup = document.getElementById('interval');
  if (bsRun) bsRun.value = String(bs);
  if (ivRun) ivRun.value = String(iv);
  if (bsSetup) bsSetup.value = String(bs);
  if (ivSetup) ivSetup.value = String(iv);
  state.currentBatchSize = bs;
  state.currentInterval = iv;
  const autoIntervalEl = document.getElementById('autoInterval');
  if (autoIntervalEl) autoIntervalEl.textContent = String(iv);
  const autoBatchEl = document.getElementById('autoBatch');
  if (autoBatchEl && !state.autoRunning) autoBatchEl.textContent = t('list.batchCount', { count: bs });
  updateETA();
}

// -- LOAD TXT -----------------------------------------------------
const LAST_FILE_KEY = 'strong_last_file';
const DEFAULT_TXT_FILE = 'strong_finalni_verze.txt';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sstistkoo/strong_translate/main/';

function loadTXT(input) {
  const file = input.files[0];
  if (!file) return;
  localStorage.setItem(LAST_FILE_KEY, file.name);
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      state.entries = parseTXT(ev.target.result);
      state.currentFileId = computeFileId(state.entries);
      const el = document.getElementById('statusTXT');
      el.textContent = `? ${file.name} � ${t('entries.count', { count: state.entries.length })}`;
      el.className = 'file-status ok';
      document.getElementById('fileReady').style.display = 'block';
      document.getElementById('startBtn').disabled = false;
      updateAutoBtn();
      checkResume();
     } catch(e) {
       logError('loadTXT', e, { fileName: file?.name });
       const el = document.getElementById('statusTXT');
       el.textContent = t('toast.parseError', { message: e.message });
     }
  };
  reader.readAsText(file, 'utf-8');
}

function loadDefaultFile() {
   // Try local files first, then GitHub as fallback
   const githubUrl = `${GITHUB_RAW_BASE}${encodeURIComponent(DEFAULT_TXT_FILE)}`;
   const fallbacks = [DEFAULT_TXT_FILE, 'strong_greek_detailed.txt', githubUrl];

   const tryFetch = (idx) => {
      if (idx >= fallbacks.length) {
        throw new Error(t('error.fileNotFoundFallback'));
      }
      const target = fallbacks[idx];
      return fetch(target)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => ({ text, source: target }))
        .catch(() => tryFetch(idx + 1));
    };

    tryFetch(0)
      .then(({ text, source }) => {
        state.entries = parseTXT(text);
        state.currentFileId = computeFileId(state.entries);
        localStorage.setItem(LAST_FILE_KEY, DEFAULT_TXT_FILE); // Update cache to what we actually loaded
        document.getElementById('statusTXT').textContent = `? ${DEFAULT_TXT_FILE} � ${t('entries.count', { count: state.entries.length })}`;
        document.getElementById('statusTXT').className = 'file-status ok';
        document.getElementById('fileReady').style.display = 'block';
        document.getElementById('startBtn').disabled = false;
        checkResume();
        if (source === githubUrl) {
          showToast(t('toast.loaded.github'));
        } else {
          showToast(t('toast.loaded.fallback'));
        }
       })
      .catch(e => {
        logError('loadDefaultFile', e, { file: DEFAULT_TXT_FILE, githubUrl });
        document.getElementById('statusTXT').textContent = '? ' + e.message;
     });
 }



function checkDefaultFile() {
  const lastFile = localStorage.getItem(LAST_FILE_KEY);
  if (lastFile) {
    document.getElementById('btnLoadDefault').style.display = 'inline-block';
    return;
  }
  // Neprov�d�me testovac� fetch, aby se v konzoli neobjevoval zbytecn� 404.
  document.getElementById('btnLoadDefault').style.display = 'inline-block';
}

function updateAutoBtn() {
  const lastFile = localStorage.getItem(LAST_FILE_KEY);
  if (lastFile) {
    document.getElementById('btnLoadDefault').style.display = 'inline-block';
  }
}

  // Use core module for parsing
  function parseTXT(text) {
    try {
      return parseTXTCore(text);
    } catch(e) {
      logError('parseTXT', e, { textLength: text?.length });
      throw e;
    }
  }

// -- RESUME -------------------------------------------------------
async function checkResume() {
  try {
    const ind = document.getElementById('resumeIndicator');
    if (ind) ind.style.display = 'none';
    let data = null;
    let source = t('resume.source.indexedDB');
    const idbSaved = await idbGetItem(storeKey());
    if (idbSaved) {
      data = idbSaved;
    } else if (state.currentFileId) {
      const legacy = localStorage.getItem(LEGACY_STORE_KEY);
      if (legacy) {
        data = JSON.parse(legacy);
        source = t('resume.source.legacySlot');
      }
    }
    if (!data) return;
    const count = Object.keys(data.translated || {}).filter(k => {
      const t = data.translated[k];
      return t && t.vyznam && t.vyznam !== '�' && !t.skipped;
    }).length;
    if (count > 0 && ind) {
      ind.style.display = 'inline-block';
      const ts = data.ts ? new Date(data.ts).toLocaleString('cs') : '?';
      ind.title = `${source}: ${count} hesel — ${ts}`;
    }
  } catch(e) {
    logWarn('checkResume', 'Failed to parse saved progress', { error: e.message });
  }
}

function showSetup() {
  document.getElementById('setup').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}

function toggleListPane() {
  const pane = document.querySelector('.list-pane');
  const btn = document.getElementById('btnToggleList');
  const resizeHandle = document.getElementById('resizeHandle');
  const logPanel = document.querySelector('.log-panel');
  const detailPane = document.querySelector('.detail-pane');
  const isMobile = window.innerWidth <= 600;
  const isHidden = pane.classList.contains('hidden');
  
  if (isHidden) {
    pane.classList.remove('hidden');
    btn.textContent = '= Seznam';
    if (isMobile) {
      pane.style.height = '45%';
      logPanel.style.height = '50%';
      logPanel.style.flex = 'none';
      detailPane.style.height = 'auto';
      detailPane.style.flex = '1';
    }
  } else {
    pane.classList.add('hidden');
    btn.textContent = '= Seznam';
    if (isMobile) {
      pane.style.height = '0';
      logPanel.style.height = '100%';
      logPanel.style.flex = '1';
      detailPane.style.height = 'auto';
      detailPane.style.flex = '1';
    }
  }
}

function toggleMenu() {
  const menuPanel = document.getElementById('menuPanel');
  menuPanel.classList.toggle('is-hidden');
}

// -- START --------------------------------------------------------
function startApp() {
  // Uka� loading hned
  document.getElementById('setup').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  const loadingEl = document.createElement('div');
  loadingEl.id = 'appLoading';
  loadingEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--txt3);font-family:JetBrains Mono,monospace;font-size:14px';
  loadingEl.textContent = t('app.loading');
  app.appendChild(loadingEl);
  
  // Deffered init
  requestAnimationFrame(() => {
    setTimeout(async () => {
      await checkResume();
      initApp(loadingEl);
    }, 10);
  });
}

async function initApp(loadingEl) {
   state.currentBatchSize = 5;
   state.currentInterval  = 20;

   // Obnov ulo�en� preklad � pro aktu�lne nacten� soubor
   try {
     let data = null;
     // 1. Try IndexedDB
     const idbSaved = await idbGetItem(storeKey());
     if (idbSaved) {
       data = idbSaved;
     } else if (state.currentFileId) {
       // 2. Try localStorage (current key)
       const lsSaved = localStorage.getItem(storeKey());
       if (lsSaved) {
         data = JSON.parse(lsSaved);
       } else {
         // 3. Try legacy localStorage
          const legacy = localStorage.getItem(LEGACY_STORE_KEY);
          if (legacy) {
            const legacyData = JSON.parse(legacy);
            if (legacyData && legacyData.translated && Object.keys(legacyData.translated).length > 0) {
              data = legacyData;
              // Save to IndexedDB as migrated
              await idbSetItem(storeKey(), { ...legacyData, migrated: true });
              logInfo('migrate', `Migrováno ${Object.keys(legacyData.translated).length} hesel z legacy slotu do IndexedDB`);
              // Remove legacy localStorage to free space
              localStorage.removeItem(LEGACY_STORE_KEY);
            }
          }
       }
     }
      if (data) {
        state.translated = data.translated || {};
        state.sourceEntryEdits = data.sourceEntryEdits || {};
        // If we loaded from localStorage (not IndexedDB) and not already migrated, save to IndexedDB
        if (!idbSaved && lsSaved) {
          await idbSetItem(storeKey(), { ...data, migrated: true });
          // Remove from localStorage to free space
          localStorage.removeItem(storeKey());
        }
      }
   } catch(e) {
       logWarn('startApp', 'Failed to load saved progress, starting fresh', { error: e.message });
       state.translated = {};
       state.sourceEntryEdits = {};
     }
    
    // Kontrola kvóty localStorage hned po startu
    checkQuotaAndMaybeAutoBackup();

  document.getElementById('app').style.display = 'flex';
  
  // Dedup state.entries - pokud jsou duplicitn� kl�ce, bereme jen prvn� v�skyt
  const uniqueEntries = [];
  const seenKeys = new Set();
  for (const e of state.entries) {
    if (!seenKeys.has(e.key)) {
      seenKeys.add(e.key);
      uniqueEntries.push(e);
    }
  }
  if (uniqueEntries.length < state.entries.length) {
  }
  state.entries = uniqueEntries;
  
  state.entryMap = new Map(state.entries.map(e => [e.key, e]));
  applySourceEntryEditsToEntries();
  
  // Vytvor index pro rychl� razen� podle puvodn�ho porad�
  window._entryIndexMap = new Map(state.entries.map((e, i) => [e.key, i]));

  state.filteredKeys = state.entries.map(e => e.key);
  initVirtualScroll();
  renderList();
  
  // Scroll na zac�tek po nacten� a znovu vykresli
  const listScroll = document.getElementById('listScroll');
  if (listScroll) listScroll.scrollTop = 0;
  state.lastRenderRange = { start: -1, end: -1, doneStates: {} };
  renderVisible();
  
  updateStats();
  initRunSelects();
  updateFailedCount();
  updateBackupButtonVisibility();
  updateFileIdBadge();
  
  // Odstran loading element
  if (loadingEl && loadingEl.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }
  
   document.getElementById('resizeHandle').addEventListener('mousedown', uiStartResize);
   document.getElementById('resizeHandle').addEventListener('touchstart', uiStartResize, {passive: false});
   
  if (window.innerWidth <= 600) {
    toggleListPane();
  }
}

// -- LIST � presunuto do js/ui/list.js (viz wiring n�e) ----------


function resolveProviderForInteractiveAction(preferredProv = '') {
  const normalizedPreferred = String(preferredProv || '').trim();
  const order = ['groq', 'gemini', 'openrouter'];
  if (normalizedPreferred && isAutoProviderEnabled(normalizedPreferred)) return normalizedPreferred;
  const firstEnabled = order.find(p => isAutoProviderEnabled(p));
  return firstEnabled || normalizedPreferred || 'groq';
}

function resolveMainBatchProvider(preferredProv = '') {
  const preferred = resolveProviderForInteractiveAction(preferredProv);
  const order = ['groq', 'gemini', 'openrouter'];
  if (isAutoProviderEnabled('groq') && getApiKeyForModelTest('groq')) return 'groq';
  const firstReady = order.find(p => isAutoProviderEnabled(p) && !!getApiKeyForModelTest(p));
  return firstReady || preferred;
}

function filterList() {
  renderList();
  if (state.virtualInitialized) {
    const scroll = document.getElementById('listScroll');
    scroll.scrollTop = 0;
  }
}

// Debounced varianta pro oninput (zabr�ni prekreslen� cel�ho listu na ka�d� znak)
const filterListDebounced = debounce(filterList, 180);

// -- getFilteredEntries, virtual scroll, showDetail, renderDetail ? js/ui/list.js + js/ui/detail.js

// renderDetail, renderTranslation, editace pol� ? js/ui/detail.js

function applySourceEntryEditsToEntries() {
  if (!state.sourceEntryEdits || typeof state.sourceEntryEdits !== 'object') return;
  for (const [key, patch] of Object.entries(state.sourceEntryEdits)) {
    if (!patch || typeof patch !== 'object') continue;
    const entry = state.entryMap.get(key);
    if (!entry) continue;
    for (const [field, value] of Object.entries(patch)) {
      entry[field] = String(value || '');
      if (field === 'definice') entry.def = entry[field];
    }
  }
}

const TOPIC_LABELS = {
  vyznam: '',
  definice: '',
  puvod: '',
  kjv: '',
  specialista: ''
};

function refreshTopicLabels() {
  const langTag = getContentLangTag();
  TOPIC_LABELS.vyznam = `${t('topic.label.vyznam')} (${langTag})`;
  TOPIC_LABELS.definice = `${t('topic.label.definice')} (${langTag})`;
  TOPIC_LABELS.puvod = `${t('topic.label.puvod')} (${langTag})`;
  TOPIC_LABELS.kjv = `${t('topic.label.kjv')} (${langTag})`;
  TOPIC_LABELS.specialista = `${t('topic.label.specialista')} (${langTag})`;
}
refreshTopicLabels();

const TOPIC_PROMPT_PRESET_MAP = {
  vyznam: 'preset_topic_vyznam',
  definice: 'preset_topic_definice',
  kjv: 'preset_topic_kjv',
  puvod: 'preset_topic_puvod',
  specialista: 'preset_topic_specialista'
};




// -- AI CALL API -------------------------------------------------
const callApi = createCallApi({
  log, logError, logWarn, showToast: (...a) => showToast(...a), t,
  rateInfoFromErrorMessage: (...a) => rateInfoFromErrorMessage(...a),
  parseWithOpenRouterNormalization,
});
const { callAIWithRetry, callOnce, getTranslationEngineLabel, parseTranslations, getRecentAICalls } = callApi;

// -- UI MODULY ---------------------------------------------------
const toastApi = createToastApi({ CONFIG, logError });
const { showToast, showToastWithAction } = toastApi;

const headerApi = createHeaderApi({
  state, t, getTranslationStateForKey, storeKey, backupKey
});
const {
  logMsg, updateStats, updateETA, startElapsedTimer, stopElapsedTimer,
  updateElapsedTime, updateFailedCount, updateFileIdBadge,
  updateBackupButtonVisibility, hasBackup
} = headerApi;

// -- TRANSLATION BATCH API --------------------------------------
// Late-binding pro isAutoProviderEnabled (autoApi prijde a� po listApi) a translateSelected (listApi prijde za batchApi)
const batchApi = createBatchApi({
  state, t, escHtml,
  log, logError, logWarn,
  showToast,
  TOPIC_PROMPT_PRESET_MAP,
  parseTranslations,
  parseWithOpenRouterNormalization, applyFallbacksToParsedMap,
  extractTopicValueFromAI: (...a) => extractTopicValueFromAI(...a),
  shouldReplaceSpecialista: (...a) => shouldReplaceSpecialista(...a),
  fillMissingVyznamFromSource, fillMissingKjvFromSource, annotateEnglishDefinitionsInTranslated,
  buildPromptMessages: (...a) => buildPromptMessages(...a),
  callOnce, callAIWithRetry,
  getApiKeyForModelTest: (...a) => getApiKeyForModelTest(...a),
  getPipelineModelForProvider: (...a) => getPipelineModelForProvider(...a),
  getCurrentApiKey: (...a) => getCurrentApiKey(...a),
  getModelTestSelectedModelForProvider: (...a) => getModelTestSelectedModelForProvider(...a),
  resolveMainBatchProvider: (...a) => resolveMainBatchProvider(...a),
  appendModelTestUsage: (...a) => appendModelTestUsage(...a),
  buildModelTestMessages: (...a) => buildModelTestMessages(...a),
  isPipelineSecondaryEnabled: (...a) => isPipelineSecondaryEnabled(...a),
  upsertModelTestStats: (...a) => upsertModelTestStats(...a),
  pushTestHistory: (...a) => pushTestHistory(...a),
  renderList: (...a) => renderList(...a),
  updateStats: (...a) => updateStats(...a),
  renderDetail: (...a) => renderDetail(...a),
  startElapsedTimer, stopElapsedTimer, updateFailedCount,
  saveProgress: (...a) => saveProgress(...a),
  logTokenEntry: (...a) => logTokenEntry(...a),
  logEntry: (...a) => logEntry(...a),
  getTranslationEngineLabel: (...a) => getTranslationEngineLabel(...a),
  isAutoProviderEnabled: (...a) => isAutoProviderEnabled(...a),
  translateSelected: (...a) => translateSelected(...a),
  getFailedTopicsForFallback: (...a) => getFailedTopicsForFallback(...a),
  getMissingTopicsForRepair: (...a) => getMissingTopicsForRepair(...a),
  cloneTranslationTopicFields: (...a) => cloneTranslationTopicFields(...a),
  shouldReplaceTopicValue: (...a) => shouldReplaceTopicValue(...a),
  getProviderCooldownLeftSec: (...a) => getProviderCooldownLeftSec(...a),
});
const {
  translateBatch, translateNext, translateSingle, retranslateSingle, jumpToStart,
  getNextBatch, getSecondaryNextOperationState,
  getFailedTopicsForFallback, getMissingTopicsForRepair,
  cloneTranslationTopicFields, shouldReplaceTopicValue,
  getProviderCooldownLeftSec, formatPreviewRawTranslation,
  translateBatchForProvider,
} = batchApi;

// Cirkularita list ? detail: late-binding pres closure
let _detailApi;
const listApi = createListApi({
  state, t, escHtml, ITEM_HEIGHT, BUFFER_ITEMS,
  getTranslationStateForKey,
  isAutoProviderEnabled: (...a) => isAutoProviderEnabled(...a),
  resolveMainBatchProvider,
  getPipelineModelForProvider: (...a) => getPipelineModelForProvider(...a),
  translateBatch,
  startTopicRepairFlow: (...a) => startTopicRepairFlow(...a),
  showPreviewModal: (...a) => showPreviewModal(...a),
  showToast,
  logError,
  updateFailedCount,
  saveProgress: (...a) => saveProgress(...a),
  updateStats,
  renderDetail: (...a) => _detailApi.renderDetail(...a)
});
const {
  getFilteredEntries, filterMissingTopicsList, scrollToActive,
  initVirtualScroll, updatePhantomHeight, renderVisible, onVirtualScroll,
  renderList, showDetail, toggleSelect, selectAll, selectNone,
  updateSelectedBtn, translateSelected
} = listApi;

_detailApi = createDetailApi({
   state, t, escHtml,
   TOPIC_LABELS, refreshTopicLabels,
   saveProgress: (...a) => saveProgress(...a),
   renderList, updateStats, showToast,
   log,
   buildTopicPrompt: (...a) => buildTopicPrompt(...a),
   openTopicPromptModal: (...a) => openTopicPromptModal(...a),
   callAIWithRetry, extractTopicValueFromAI: (...a) => extractTopicValueFromAI(...a),
   resolveProviderForInteractiveAction, getPipelineModelForProvider: (...a) => getPipelineModelForProvider(...a),
   getCurrentApiKey: (...a) => getCurrentApiKey(...a),
   getSystemMessage: getResolvedSystemMessage,
   getResolvedSystemMessage,
   getDefaultBatchTopicUserPrompt: (...a) => getDefaultBatchTopicUserPrompt(...a),
   getDefaultBatchTopicSystemPrompt: (...a) => getDefaultBatchTopicSystemPrompt(...a)
  });
const {
  renderDetail, renderTranslation, toggleEditSection, saveSection,
  toggleSourceEntryEdit, saveSourceEntryField, refillSingleField
} = _detailApi;

const modalsApi = createModalsApi({
  state, t, getStrongKeyNumber, renderList, showToast
});
const { selectRange, closeModal, confirmModal, showMobileActions, closeMobileModal } = modalsApi;

const autoApi = createAutoApi({
  state,
  t,
  getUiLang,
  PROVIDERS,
  AUTO_PROVIDER_ENABLED_KEY,
  AUTO_TOKEN_LIMIT_KEY,
  PIPELINE_SECONDARY_ENABLED_KEY,
  setPipelineSecondaryEnabled: (...a) => setPipelineSecondaryEnabled(...a),
  syncSecondaryProviderToggles: (...a) => syncSecondaryProviderToggles(...a),
  getSecondaryNextOperationState: batchApi.getSecondaryNextOperationState,
  stopElapsedTimer,
  startElapsedTimer,
  showToast,
  log,
  getNextBatch,
  updateETA,
  translateBatch,
  translateBatchForProvider: batchApi.translateBatchForProvider,
  getCurrentApiKey: (...a) => getCurrentApiKey(...a),
  getPipelineModelForProvider: (...a) => getPipelineModelForProvider(...a),
  updateStats,
  renderList,
  renderDetail
});

const {
  toggleAuto,
  stopAuto,
  toggleAutoSequential,
  stopAutoSequential,
  isAutoProviderEnabled,
  setAutoProviderEnabled,
  initAutoProviderToggles,
  updateAutoProviderCountdowns,
  startAutoProviderCountdownTicker,
  saveAutoTokenLimit,
  isAutoTokenLimitReached,
  refreshTokenStatsDisplay
} = autoApi;

// -- TOPIC REPAIR API --------------------------------------------
const topicRepairApi = createTopicRepairApi({
  state, t, escHtml,
  log, logError,
  showToast,
  saveProgress: (...a) => saveProgress(...a),
  renderList, renderDetail, updateStats, updateFailedCount,
  TOPIC_LABELS, TOPIC_PROMPT_PRESET_MAP,
  callAIWithRetry,
  getPipelineModelForProvider: (...a) => getPipelineModelForProvider(...a),
  getCurrentApiKey: (...a) => getCurrentApiKey(...a),
  enforceSpecialistaFormat,
  parseWithOpenRouterNormalization, applyFallbacksToParsedMap,
  isAutoProviderEnabled,
  resolveMainBatchProvider: (...a) => resolveMainBatchProvider(...a),
  resolveProviderForInteractiveAction,
  getFailedTopicsForFallback, getMissingTopicsForRepair,
  cloneTranslationTopicFields, shouldReplaceTopicValue,
  getProviderCooldownLeftSec,
  appendModelTestUsage: (...a) => appendModelTestUsage(...a),
  buildModelTestMessages: (...a) => buildModelTestMessages(...a),
  getModelTestPromptCatalog,
  buildPromptMessages: (...a) => buildPromptMessages(...a),
});
const {
  startTopicRepairFlow, closeTopicRepairModalSafe, stopTopicRepairTicker,
  applyTopicRepairProviderCheckboxes, setTopicRepairStrategy,
  startTopicRepairSequentialWorker, toggleTopicRepairTask, toggleTopicRepairRun,
  setTopicRepairSpecialistaDecision, setTopicRepairDetectedTopicDecision,
  applyTopicRepairSelected, closeTopicRepairModalOnly,
   minimizeTopicRepairModal, restoreTopicRepairModal, toggleShowApproved,
   saveTopicRepairBatchPromptDraft, resetTopicRepairBatchPromptToDefault,
  refreshTopicRepairBatchPromptEditor, toggleTopicRepairBulkListFilter,
  syncTopicRepairBulkRunInputsToHidden, runTopicRepairBulkTranslation,
  toggleTopicRepairBulkInclude, setTopicRepairBulkIncludeAll, setTopicRepairProviderTopic,
  getTopicPromptTemplateByPromptType, syncTopicPromptTemplatesReport,
  buildTopicPrompt, openTopicPromptModal, runTopicPromptAI,
  applyTopicPromptResult, shouldReplaceSpecialista, closeTopicPromptModal,
  openSystemPromptModal, runSystemPromptAI, runSystemPromptConfirm, closeSystemPromptModal,
  translateSystemPromptText, translateSystemPromptBackToEnglish, reviewSystemPromptWithAI, buildSystemPromptFromRequirement,
  getTopicRepairSystemPrompt, getTopicRepairUserPrompt, buildTopicRepairBatchHeslaText,
  extractTopicValueFromAI,
  toggleTopicRepairManualApproval,
} = topicRepairApi;

// -- LIMITS + PREVIEW API ----------------------------------------
const limitsApi = createLimitsApi({
  getCurrentApiKey: (...a) => getCurrentApiKey(...a),
  getModelTestSelectedModelForProvider: (...a) => getModelTestSelectedModelForProvider(...a),
  showToast,
});

const showLimitsModal = limitsApi.showLimitsModal;
const closeLimitsModal = limitsApi.closeLimitsModal;
const showHelpModal = limitsApi.showHelpModal;
const closeHelpModal = limitsApi.closeHelpModal;
const showBadTranslationsModal = limitsApi.showBadTranslationsModal;
const closeBadTranslationsModal = limitsApi.closeBadTranslationsModal;
const filterBadTranslations = limitsApi.filterBadTranslations;
const fetchLimits = limitsApi.fetchLimits;

const previewApi = createPreviewApi({
  showToast,
  renderList,
  renderDetail: (...a) => renderDetail(...a),
  saveProgress: (...a) => saveProgress(...a),
  updateStats,
  translateSingle: (...a) => translateSingle(...a),
  retranslateSingle: (...a) => retranslateSingle(...a),
  getStrongKeyNumber,
  updateFailedCount,
});
const {
  showPreviewModal, toggleAllPreview, acceptPreview, discardPreview,
  importFile, importTXT, showFailedEntries, retryFailed,
  closePreviewModal, closePreviewModalSafe, closeFailedModalSafe,
} = previewApi;

// -- SETTINGS + MODEL TEST OUTPUT API ----------------------------
const settingsApi = createSettingsApi({
  MODEL_TEST_PINNED_MODELS, MODEL_TEST_MODEL_STORAGE_KEY, PIPELINE_SECONDARY_ENABLED_KEY,
  setAutoProviderEnabled: (...a) => setAutoProviderEnabled(...a),
  updateAutoProviderCountdowns: (...a) => updateAutoProviderCountdowns(...a),
});
const {
  getApiKeyForModelTest, getPinnedModelOptionsForProvider, getPinnedModelQueue,
  getDefaultPinnedModelByProvider, getModelTestSelectedModelForProvider,
  getPipelineModelForProvider, setPipelineModelForProvider,
  isPipelineSecondaryEnabled, setPipelineSecondaryEnabled,
  syncSecondaryProviderToggles, applyPipelineSecondaryToggleUi, bindPipelineSecondaryToggle,
  fillPipelineSelectOptions, initPipelineModelSelectors, initPipelineModelSelectorsInSettingsModal,
  saveModelTestModelSelections, populateModelTestModelSelect,
  updateModelTestProviderUi, getProviderModelOptions,
} = settingsApi;

const modelTestUiApi = createModelTestUiApi({
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
});

const {
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
} = modelTestUiApi;

const modelTestRunnerApi = createModelTestRunnerApi({
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
  modelTestWaitWithCountdown: (...a) => modelTestWaitWithCountdown(...a),
  modelTestSetProviderEta,
  modelTestStartProviderCountdownTicker,
  modelTestStopProviderCountdownTicker,
  modelTestResetProviderEta,
  modelTestSetLastStatus,
  updateModelTestRunButton,
  modelTestSetCountdownLabel,
  modelTestClearCountdownInterval,
  saveModelTestOutputToStorage,
  saveModelTestRawOutputToStorage: (...a) => saveModelTestRawOutputToStorage(...a),
  clearModelTestRawOutputFromStorage: (...a) => clearModelTestRawOutputFromStorage(...a),
  upsertModelTestStats,
  showModelTestModal,
  updateModelTestProviderUi,
  pushTestHistory,
  appendModelTestLastBatchKeyAudit: (...a) => appendModelTestLastBatchKeyAudit(...a),
  buildModelTestMessages,
  parseWithOpenRouterNormalization,
  applyFallbacksToParsedMap,
  isTranslationComplete,
  isDefinitionLikelyEnglish,
  callOnce
});

const {
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
} = modelTestRunnerApi;

const modelTestOutputApi = createModelTestOutputApi({
  MODEL_TEST_RAW_OUTPUT_KEY,
  showToast,
  log,
  modelTestStopProviderCountdownTicker,
  showModelTestModal: (...a) => showModelTestModal(...a),
  showDetail: (...a) => showDetail(...a),
});
const {
  logEntry, clearLog,
  saveModelTestOutputTxt, saveModelTestRawOutputToStorage, clearModelTestRawOutputFromStorage,
  saveModelTestRawOutputTxt, loadModelTestOutputFromFile,
  modelTestWaitWithCountdown,
  scrollModelTestOutputIntoView, openModelTestModal, resetModelTestModal,
  restoreModelTestReportFromBackup,
  formatModelTestParsedBlock, appendModelTestExportParsed,
  excerptRawForLastKey, appendModelTestLastBatchKeyAudit,
  exportModelTestTranslationsTxt,
} = modelTestOutputApi;

// -- BACKUP + API KEYS + SETTINGS MODALS ------------------------
const backupApi = createBackupApi({
  renderList: (...a) => renderList(...a),
  updateStats: (...a) => updateStats(...a),
  showToast, showToastWithAction, t, logError, logWarn, logInfo,
  isTranslationComplete,
  updateBackupButtonVisibility: (...a) => updateBackupButtonVisibility(...a),
  getUiLang,
  updateFailedCount: (...a) => updateFailedCount(...a),
  clearLog: (...a) => clearLog(...a),
});
const { saveProgress, saveProgressImmediate, writeBackup, maybeAutoBackup, hasUndo, restoreFromBackup, clearProgress } = backupApi;

const apiKeysApi = createApiKeysApi({ t, showToast });
const { saveApiKey, getApiKeyProfiles, setApiKeyProfiles, maskApiKey, setupApiKeySwitcher, onApiKeyProfileChange, saveCurrentApiKeyAsProfile, deleteApiKeyProfile, getCurrentApiKey } = apiKeysApi;

const settingsModalsApi = createSettingsModalsApi({
  initRunSelects,
  updateSetupCompactSummary: (...a) => updateSetupCompactSummary(...a),
  initPipelineModelSelectors,
  initPipelineModelSelectorsInSettingsModal,
  showToast,
  refreshTopicLabels,
  renderList: (...a) => renderList(...a),
  saveProgress: (...a) => saveProgress(...a),
  refreshLanguageAwarePromptOptionLabels,
  applySystemPromptForCurrentTask: (...a) => applySystemPromptForCurrentTask(...a),
  applyUiLanguage,
  DEFAULT_UI_LANG,
  UI_LANGS,
  UI_LANG_KEY,
  setPipelineModelForProvider: (...a) => setPipelineModelForProvider(...a),
  setPipelineSecondaryEnabled: (...a) => setPipelineSecondaryEnabled(...a),
  syncSecondaryProviderToggles: (...a) => syncSecondaryProviderToggles(...a),
  updateAutoProviderCountdowns: (...a) => updateAutoProviderCountdowns(...a),
  updateStats: headerApi.updateStats,
});
const { showSettingsModal, closeSettingsModal, showPromptAIModal, closePromptAIModal, saveAISettings, showPromptLangModal, closePromptLangModal, updatePromptLangButtonLabel, saveLangSettings, loadCustomLangFile, loadPersonalPromptFile } = settingsModalsApi;

const promptLibraryApi = createPromptLibraryApi({
    state,
    t,
    getUiLang,
    getDefaultPrompt: getResolvedDefaultPrompt,
    getFinalPrompt: getResolvedFinalPrompt,
    getPromptLibraryBase: getResolvedPromptLibraryBase,
    enforceSpecialistaFormat,
    showToast,
    getActiveSystemMessage,
    getActiveMainPromptTemplate,
    getActiveSecondarySystemMessage,
    getActiveSecondaryUserPrompt,
    getModelTestPromptCatalog
  });

const {
  initializePromptLibrary,
  getStoredCustomPromptLibrary,
  saveStoredCustomPromptLibrary,
  getStoredImportedPromptLibrary,
  saveStoredImportedPromptLibrary,
  getStoredUserAddedPrompts,
  saveStoredUserAddedPrompts,
  rebuildPromptLibrary,
  getSystemPromptForCurrentTask,
  isPromptAutoModeEnabled,
  setMainPrompt,
  applySystemPromptForCurrentTask,
  togglePromptModeQuick,
  updatePromptAutoButton,
  togglePromptAutoMode,
   showPromptLibraryModal,
   closePromptLibraryModal,
   renderPromptList,
   selectPrompt,
   applySelectedPrompt,
   exportPromptLibraryToTxt,
   importPromptLibraryFromFile,
   updatePromptStatusIndicator,
  handleDeleteUserPrompt,
   isUserAddedPrompt,
  updatePromptActions,
} = promptLibraryApi;

// Secondary prompts
const {
  getStoredSecondaryPrompts,
  saveStoredSecondaryPrompts,
  showSecondaryPromptsModal,
  closeSecondaryPromptsModal,
renderSecondaryPromptList,
   selectSecondaryPrompt,
   addSecondaryPrompt,
   saveSecondaryPrompt,
   updateSecondaryPrompt,
   deleteSecondaryPrompt,
   deleteTopicSecondaryPrompt,
   loadSecondaryEditorForCurrentSelection,
   applySecondaryPrompt,
 } = promptLibraryApi;

initializePromptLibrary();

function getCompactSelectedOptionLabel(selectId, fallback = '???') {
  const el = document.getElementById(selectId);
  if (!el) return fallback;
  const txt = String(el.selectedOptions?.[0]?.text || el.value || '').trim();
  return txt || fallback;
}

function getCompactPipelineSecondaryLabel() {
  const geminiEnabled = !!document.getElementById('pipelineEnableSecondaryGemini')?.checked;
  const openrouterEnabled = !!document.getElementById('pipelineEnableSecondaryOpenrouter')?.checked;
  const parts = [];
  if (geminiEnabled) parts.push(getCompactSelectedOptionLabel('pipelineModelSecondaryGemini', 'Gemini'));
  if (openrouterEnabled) parts.push(getCompactSelectedOptionLabel('pipelineModelSecondaryOpenrouter', 'OpenRouter'));
  if (parts.length) return parts.join(' | ');
  return 'auto router off';
}

function updateSetupCompactSummary() {}

function bindSetupCompactSummaryEvents() {}
// -- STATS & SAVE ------------------------------------------------




async function loadSavedSettings() {
  await loadUiMessages();
  const prov = localStorage.getItem('strong_provider') || 'groq';
  const providerEl = document.getElementById('provider');
  if (providerEl) {
    providerEl.value = prov;
    providerEl._lastProvider = prov;
  }
  
  const k = localStorage.getItem('strong_apikey_' + prov);
  const apiKeyEl = document.getElementById('apiKey');
  if (apiKeyEl) apiKeyEl.value = k || '';
  setupApiKeySwitcher(prov);
  
  let p = localStorage.getItem('strong_prompt') || '';
  const promptMode = String(localStorage.getItem('strong_prompt_mode') || 'system').toLowerCase();
  if (promptMode !== 'custom') {
    p = getSystemPromptForCurrentTask('batch');
    localStorage.setItem('strong_prompt', p);
    localStorage.setItem('strong_prompt_mode', 'system');
  } else if (!p.trim()) {
    p = getSystemPromptForCurrentTask('batch');
    localStorage.setItem('strong_prompt', p);
    localStorage.setItem('strong_prompt_mode', 'system');
  }
  const promptEditor = document.getElementById('promptEditor');
  if (promptEditor) {
    promptEditor.value = p;
    promptEditor.addEventListener('input', () => {
      localStorage.setItem('strong_prompt', promptEditor.value);
      if (!state.isProgrammaticPromptSet) {
        localStorage.setItem('strong_prompt_mode', 'custom');
      }
    });
  }
  
  const modelSelect = document.getElementById('model');
  if (modelSelect) {
    onProviderChange();
    modelSelect.addEventListener('change', () => {
      localStorage.setItem('strong_model', modelSelect.value);
    });
  }
  initPipelineModelSelectors();
  const mainPipelineModel = getPipelineModelForProvider('groq');
  if (providerEl) providerEl.value = 'groq';
  if (modelSelect && mainPipelineModel) {
    modelSelect.value = mainPipelineModel;
    localStorage.setItem('strong_model', mainPipelineModel);
  }

  // Načti uloženou velikost dávky a interval
  const savedBatchSize = localStorage.getItem(BATCH_SIZE_KEY);
  const savedInterval = localStorage.getItem(INTERVAL_KEY);
  const batchSizeEl = document.getElementById('batchSize');
  const intervalEl = document.getElementById('interval');
  if (savedBatchSize && batchSizeEl) batchSizeEl.value = savedBatchSize;
  if (savedInterval && intervalEl) intervalEl.value = savedInterval;

  // Ukládání změn do localStorage
  if (batchSizeEl) {
    batchSizeEl.addEventListener('change', () => {
      localStorage.setItem(BATCH_SIZE_KEY, batchSizeEl.value);
    });
  }
  if (intervalEl) {
    intervalEl.addEventListener('change', () => {
      localStorage.setItem(INTERVAL_KEY, intervalEl.value);
    });
  }

  checkDefaultFile();
  loadDefaultFile();
  updateFailedCount();
  updatePromptStatusIndicator();
  updatePromptAutoButton();
  updatePromptLangButtonLabel();

  // Load language settings
  let targetLang = localStorage.getItem('strong_target_lang') || 'cz';
  if (targetLang === 'cs') targetLang = 'cz'; // Migration from old code
  let sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
  
  const targetEl = document.getElementById('targetLanguage');
  const sourceEl = document.getElementById('sourceLanguage');
  const uiEl = document.getElementById('uiLanguage');
  if (targetEl) targetEl.value = targetLang;
  if (sourceEl) sourceEl.value = sourceLang;
  if (uiEl) uiEl.value = getUiLang();
  const uiFallback = consumeUiLangFallback();
  if (uiFallback) {
    showToast(t('toast.uiLanguage.unsupportedFallback', { requested: uiFallback.requested, fallback: uiFallback.fallback }));
  }
  applyUiLanguage();

  const tokenLimitEl = document.getElementById('autoTokenLimit');
  if (tokenLimitEl) {
    tokenLimitEl.value = localStorage.getItem(AUTO_TOKEN_LIMIT_KEY) || '';
    tokenLimitEl.oninput = saveAutoTokenLimit;
  }
  const modelTestPromptTypeEl = document.getElementById('modelTestPromptType');
  const modelTestPromptEnableEl = document.getElementById('modelTestEnablePrompt');
  const modelTestPromptCompareEnableEl = document.getElementById('modelTestEnablePromptCompare');
  const modelTestPromptTypeCompareEl = document.getElementById('modelTestPromptTypeCompare');
  const modelTestCustomPromptEl = document.getElementById('modelTestCustomPromptInput');
  if (modelTestPromptEnableEl) {
    modelTestPromptEnableEl.checked = isModelTestPromptEnabled();
    modelTestPromptEnableEl.onchange = () => {
      saveModelTestPromptSettings();
      updateModelTestPromptUi();
    };
  }
  if (modelTestPromptTypeEl) {
    refreshLanguageAwarePromptOptionLabels();
    modelTestPromptTypeEl.value = getModelTestPromptType();
    modelTestPromptTypeEl.onchange = () => {
      saveModelTestPromptSettings();
      updateModelTestPromptUi();
    };
  }
  if (modelTestPromptTypeCompareEl && modelTestPromptTypeEl) {
    modelTestPromptTypeCompareEl.innerHTML = modelTestPromptTypeEl.innerHTML;
    modelTestPromptTypeCompareEl.value = getModelTestPromptCompareType();
    modelTestPromptTypeCompareEl.onchange = () => {
      saveModelTestPromptSettings();
      updateModelTestPromptUi();
    };
  }
  if (modelTestPromptCompareEnableEl) {
    modelTestPromptCompareEnableEl.checked = isModelTestPromptCompareEnabled();
    modelTestPromptCompareEnableEl.onchange = () => {
      saveModelTestPromptSettings();
      updateModelTestPromptUi();
    };
  }
  if (modelTestCustomPromptEl) {
    modelTestCustomPromptEl.value = getModelTestCustomPromptText();
    modelTestCustomPromptEl.oninput = saveModelTestPromptSettings;
  }
  updateModelTestPromptUi();
  syncTopicPromptTemplatesReport();
  refreshTokenStatsDisplay();
  initAutoProviderToggles();
  startAutoProviderCountdownTicker();
  bindSetupCompactSummaryEvents();
  updateSetupCompactSummary();
}

// Expose functions to window
window.showPromptLibraryModal = promptLibraryApi.showPromptLibraryModal;
window.closePromptLibraryModal = promptLibraryApi.closePromptLibraryModal;
 window.selectPrompt = promptLibraryApi.selectPrompt;
window.applySelectedPrompt = promptLibraryApi.applySelectedPrompt;
window.handleDeleteUserPrompt = promptLibraryApi.handleDeleteUserPrompt;
window.isUserAddedPrompt = promptLibraryApi.isUserAddedPrompt;
window.addUserPromptToCategory = promptLibraryApi.addUserPromptToCategory;
window.saveLibraryPrompts = promptLibraryApi.saveLibraryPrompts;
window.exportPromptLibraryToTxt = promptLibraryApi.exportPromptLibraryToTxt;
window.importPromptLibraryFromFile = promptLibraryApi.importPromptLibraryFromFile;
 window.showPromptAIModal = showPromptAIModal;
 window.closePromptAIModal = closePromptAIModal;
 window.saveAISettings = saveAISettings;
window.showPromptLangModal = showPromptLangModal;
  window.closePromptLangModal = closePromptLangModal;
  window.saveLangSettings = saveLangSettings;
  window.loadCustomLangFile = loadCustomLangFile;
  window.loadPersonalPromptFile = loadPersonalPromptFile;
// Secondary prompts
 window.showSecondaryPromptsModal = promptLibraryApi.showSecondaryPromptsModal;
  window.closeSecondaryPromptsModal = promptLibraryApi.closeSecondaryPromptsModal;
  window.renderSecondaryPromptList = promptLibraryApi.renderSecondaryPromptList;
  window.selectSecondaryPrompt = promptLibraryApi.selectSecondaryPrompt;
  window.addSecondaryPrompt = promptLibraryApi.addSecondaryPrompt;
  window.saveSecondaryPrompt = promptLibraryApi.saveSecondaryPrompt;
  window.updateSecondaryPrompt = promptLibraryApi.updateSecondaryPrompt;
  window.deleteSecondaryPrompt = promptLibraryApi.deleteSecondaryPrompt;
  window.deleteTopicSecondaryPrompt = promptLibraryApi.deleteTopicSecondaryPrompt;
  window.loadSecondaryEditorForCurrentSelection = promptLibraryApi.loadSecondaryEditorForCurrentSelection;
  window.applySecondaryPrompt = promptLibraryApi.applySecondaryPrompt;
  window.getActiveSecondarySystemMessage = getActiveSecondarySystemMessage;
  window.getActiveSecondaryUserPrompt = getActiveSecondaryUserPrompt;
  window.showAddCustomPromptModal = promptLibraryApi.showAddCustomPromptModal;

// Secondary prompts
window.showSecondaryPromptsModal = promptLibraryApi.showSecondaryPromptsModal;
window.closeSecondaryPromptsModal = promptLibraryApi.closeSecondaryPromptsModal;
window.renderSecondaryPromptList = promptLibraryApi.renderSecondaryPromptList;
window.selectSecondaryPrompt = promptLibraryApi.selectSecondaryPrompt;
window.addSecondaryPrompt = promptLibraryApi.addSecondaryPrompt;
window.saveSecondaryPrompt = promptLibraryApi.saveSecondaryPrompt;
window.updateSecondaryPrompt = promptLibraryApi.updateSecondaryPrompt;
window.deleteSecondaryPrompt = promptLibraryApi.deleteSecondaryPrompt;
window.deleteTopicSecondaryPrompt = promptLibraryApi.deleteTopicSecondaryPrompt;
window.loadSecondaryEditorForCurrentSelection = promptLibraryApi.loadSecondaryEditorForCurrentSelection;
window.applySecondaryPrompt = promptLibraryApi.applySecondaryPrompt;

function showI18nToolModal() {
  const m = document.getElementById('i18nToolModal');
  const body = document.getElementById('i18nToolBody');
  if (body) body.textContent = t('lang.i18nTool.body');
  const helpBody = document.getElementById('i18nToolHelpBody');
  if (helpBody) helpBody.textContent = buildI18nToolHelpText();
  const title = document.getElementById('i18nToolModalTitle');
  if (title) title.textContent = t('lang.i18nTool.title');
  const closeBtn = document.getElementById('btnI18nToolClose');
  if (closeBtn) closeBtn.textContent = t('lang.i18nTool.close');
  initI18nToolUi();
  const prefillLangRaw = String(localStorage.getItem('strong_i18n_tool_prefill_lang') || '').trim();
  if (prefillLangRaw) {
    const prefillLang = I18N_TOOL_LANGUAGES.find((lang) => String(lang.code || '').toLowerCase() === prefillLangRaw.toLowerCase());
    if (prefillLang) {
      i18nToolSelectedLanguages.clear();
      i18nToolSelectedLanguages.add(prefillLang.code);
      renderI18nToolLanguageGrid();
    }
    localStorage.removeItem('strong_i18n_tool_prefill_lang');
  }
  const isRestoreOpen = i18nToolRunning || i18nToolMinimizedDuringRun;
  if (!isRestoreOpen) resetI18nToolRuntimeUi();
  closeI18nToolDoneModal();
  updateI18nToolCommandPreview();
  if (m) m.style.display = 'flex';
}

function buildI18nToolHelpText() {
  return t('i18nTool.help.body');
}
function closeI18nToolModal() {
  const m = document.getElementById('i18nToolModal');
  if (m) m.style.display = 'none';
}

function openI18nToolHelpModal() {
  const editorModal = document.getElementById('i18nToolEditorModal');
  if (editorModal && editorModal.classList.contains('show')) {
    openI18nToolEditorHelpModal();
    return;
  }
  const m = document.getElementById('i18nToolHelpModal');
  const helpBody = document.getElementById('i18nToolHelpBody');
  if (helpBody) helpBody.textContent = buildI18nToolHelpText();
  if (m) m.classList.add('show');
}

function closeI18nToolHelpModal() {
  const m = document.getElementById('i18nToolHelpModal');
  if (m) m.classList.remove('show');
}
// --- Raw data: Google Translate supported languages (code, name) ---
const RAW_GOOGLE_TRANSLATE_LANGS = [
  {"code":"af","name":"Afrikaans"},{"code":"sq","name":"Albanian"},{"code":"am","name":"Amharic"},{"code":"ar-SA","name":"Arabic (Saudi Arabia)"},{"code":"ar","name":"Arabic"},{"code":"hy","name":"Armenian"},{"code":"az","name":"Azerbaijani"},{"code":"eu","name":"Basque"},{"code":"be","name":"Belarusian"},{"code":"bn-IN","name":"Bengali (India)"},{"code":"bn","name":"Bengali"},{"code":"bs-Cyrl","name":"Bosnian (Cyrillic)"},{"code":"bs","name":"Bosnian"},{"code":"bg","name":"Bulgarian"},{"code":"my","name":"Burmese"},{"code":"ca","name":"Catalan"},{"code":"zh-CN","name":"Chinese (China)"},{"code":"zh-HK","name":"Chinese (Hong Kong)"},{"code":"zh-Hans","name":"Chinese (Simplified)"},{"code":"zh-TW","name":"Chinese (Taiwan)"},{"code":"zh-Hant","name":"Chinese (Traditional)"},{"code":"zh","name":"Chinese"},{"code":"hr","name":"Croatian"},{"code":"cs","name":"Czech"},{"code":"da","name":"Danish"},{"code":"nl-BE","name":"Dutch (Belgium)"},{"code":"nl","name":"Dutch"},{"code":"en-AU","name":"English (Australia)"},{"code":"en-CA","name":"English (Canada)"},{"code":"en-NZ","name":"English (New Zealand)"},{"code":"en-PH","name":"English (Philippines)"},{"code":"en-ZA","name":"English (South Africa)"},{"code":"en-GB","name":"English (United Kingdom)"},{"code":"en-US","name":"English (United States)"},{"code":"en","name":"English"},{"code":"et","name":"Estonian"},{"code":"fil","name":"Filipino"},{"code":"fi","name":"Finnish"},{"code":"fr-CA","name":"French (Canada)"},{"code":"fr-CH","name":"French (Switzerland)"},{"code":"fr","name":"French"},{"code":"fy","name":"Frisian"},{"code":"gl","name":"Galician"},{"code":"ka","name":"Georgian"},{"code":"de","name":"German"},{"code":"el","name":"Greek"},{"code":"gn","name":"Guarani"},{"code":"gu","name":"Gujarati"},{"code":"ha","name":"Hausa"},{"code":"he","name":"Hebrew"},{"code":"iw","name":"Hebrew"},{"code":"hi","name":"Hindi"},{"code":"hu","name":"Hungarian"},{"code":"is","name":"Icelandic"},{"code":"ig","name":"Igbo"},{"code":"id","name":"Indonesian"},{"code":"ga","name":"Irish"},{"code":"it","name":"Italian"},{"code":"ja","name":"Japanese"},{"code":"kn","name":"Kannada"},{"code":"km","name":"Khmer"},{"code":"ko","name":"Korean"},{"code":"ky","name":"Kyrgyz"},{"code":"lo","name":"Lao"},{"code":"lv","name":"Latvian"},{"code":"ln","name":"Lingala"},{"code":"lt","name":"Lithuanian"},{"code":"lb","name":"Luxembourgish"},{"code":"mk","name":"Macedonian"},{"code":"ms","name":"Malay"},{"code":"ml","name":"Malayalam"},{"code":"mt","name":"Maltese"},{"code":"mr","name":"Marathi"},{"code":"mn","name":"Mongolian"},{"code":"ne","name":"Nepali"},{"code":"nb","name":"Norwegian Bokmal"},{"code":"no","name":"Norwegian"},{"code":"or","name":"Odia"},{"code":"fa","name":"Persian"},{"code":"pl","name":"Polish"},{"code":"pt-BR","name":"Portuguese (Brazil)"},{"code":"pt-PT","name":"Portuguese (Portugal)"},{"code":"pt","name":"Portuguese"},{"code":"pa-PK","name":"Punjabi (Pakistan)"},{"code":"pa","name":"Punjabi"},{"code":"ro","name":"Romanian"},{"code":"ru","name":"Russian"},{"code":"gd","name":"Scots Gaelic"},{"code":"sr","name":"Serbian"},{"code":"sk","name":"Slovak"},{"code":"sl","name":"Slovenian"},{"code":"so","name":"Somali"},{"code":"es-AR","name":"Spanish (Argentina)"},{"code":"es-CL","name":"Spanish (Chile)"},{"code":"es-CO","name":"Spanish (Colombia)"},{"code":"es-CR","name":"Spanish (Costa Rica)"},{"code":"es-EC","name":"Spanish (Ecuador)"},{"code":"es-SV","name":"Spanish (El Salvador)"},{"code":"es-GT","name":"Spanish (Guatemala)"},{"code":"es-HT","name":"Spanish (Haiti)"},{"code":"es-HN","name":"Spanish (Honduras)"},{"code":"es-419","name":"Spanish (Latin America)"},{"code":"es-MX","name":"Spanish (Mexico)"},{"code":"es-NI","name":"Spanish (Nicaragua)"},{"code":"es-PA","name":"Spanish (Panama)"},{"code":"es-PY","name":"Spanish (Paraguay)"},{"code":"es-PE","name":"Spanish (Peru)"},{"code":"es-PR","name":"Spanish (Puerto Rico)"},{"code":"es-ES","name":"Spanish (Spain)"},{"code":"es-US","name":"Spanish (United States)"},{"code":"es-UY","name":"Spanish (Uruguay)"},{"code":"es-VE","name":"Spanish (Venezuela)"},{"code":"es","name":"Spanish"},{"code":"sw","name":"Swahili"},{"code":"sv","name":"Swedish"},{"code":"tl","name":"Tagalog"},{"code":"tg","name":"Tajik"},{"code":"ta","name":"Tamil"},{"code":"te","name":"Telugu"},{"code":"th","name":"Thai"},{"code":"tr","name":"Turkish"},{"code":"uk","name":"Ukrainian"},{"code":"ur","name":"Urdu"},{"code":"uz","name":"Uzbek"},{"code":"vi","name":"Vietnamese"},{"code":"cy","name":"Welsh"},{"code":"zu","name":"Zulu"}
];

// Build I18N_TOOL_LANGUAGES with additional properties 'tag' and 'flag'
const I18N_TOOL_LANGUAGES = RAW_GOOGLE_TRANSLATE_LANGS.map(l => ({
  code: l.code,
  name: l.name,
  tag: l.code.toUpperCase(),   // used for --tag argument
  flag: l.code.split('-')[0].toUpperCase()  // display code (e.g., FR, DE, ZH)
}));

const I18N_TOOL_TRANSLATOR_TARGET_CODES = new Set(RAW_GOOGLE_TRANSLATE_LANGS.map(l => l.code));

// Keep display codes for special overrides (e.g., cs->CZ, en->GB)
const I18N_TOOL_LANG_DISPLAY_CODE = {
  cs: 'CZ',
  en: 'GB'
};

function sanitizeI18nToolLanguages() {
  // Remove source languages (cs, cz) and English (en) from target selection
  for (let i = I18N_TOOL_LANGUAGES.length - 1; i >= 0; i--) {
    const code = String(I18N_TOOL_LANGUAGES[i]?.code || '').toLowerCase();
    if (code === 'cz' || code === 'cs' || code === 'en') {
      I18N_TOOL_LANGUAGES.splice(i, 1);
    }
  }
}
sanitizeI18nToolLanguages();

// Funkce pro získání zobrazovaného názvu jazyka v češtině (fallback na název z dat)
function getI18nToolLanguageDisplayName(code) {
  try {
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      const dn = new Intl.DisplayNames(['cs'], { type: 'language' });
      const result = dn.of(code);
      if (result && result !== code) return result;
    }
  } catch (e) {
    // ignore
  }
  const lang = I18N_TOOL_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code;
}

const i18nToolSelectedLanguages = new Set();
// Použijeme Private Use Area znaky (U+E000) – Google Translate je nechá nedotčené
const I18N_TOOL_PLACEHOLDER = '\uE000';
const I18N_TOOL_IMMUTABLE_TOKEN_PREFIX = 'PHX';
const I18N_TOOL_IMMUTABLE_TOKEN_SUFFIX = 'XHP';
// Regex pro jazykové tagy – chráníme pouze závorkové značky (CZ), (EN), …
const I18N_TOOL_TAG_REGEX = /\((CZ|EN|SK|PL|DE|FR|ES|IT|PT|RU|UK|BG|RO|HU|NL|SV|DA|NO|FI|EL|TR|AR|JA|KO|HE|zh-CN|ZH-CN)\)/gi;
const I18N_TOOL_JSON_PLACEHOLDER_REGEX = /\{[A-Za-z0-9_]+\}/g;
const I18N_TOOL_HTML_TAG_REGEX = /<[^>]+>/g;
const I18N_TOOL_DEEPL_LANG_MAP = {
  cs: 'CS', sk: 'SK', pl: 'PL', de: 'DE', fr: 'FR', es: 'ES',
  it: 'IT', pt: 'PT-PT', ru: 'RU', uk: 'UK', bg: 'BG', ro: 'RO',
  hu: 'HU', nl: 'NL', sv: 'SV', da: 'DA', no: 'NB', fi: 'FI',
  el: 'EL', tr: 'TR', ja: 'JA', ko: 'KO', 'zh-CN': 'ZH', he: 'HE', en: 'EN-US'
};
let i18nToolSourceCsData = null;
let i18nToolRunning = false;
let i18nToolMinimizedDuringRun = false;
let i18nToolCancelRequested = false;
let i18nToolGoogleFailureCount = 0;
let i18nToolStrictFallbackCount = 0;
let i18nToolRunAnimTimer = null;
const I18N_TOOL_CANCELLED_ERROR = 'I18N_TOOL_TRANSLATION_CANCELLED';
const I18N_TOOL_KEEP_PROMPTS_EN_KEY = 'strong_i18n_tool_keep_prompts_en';
const i18nToolTranslatedJsonByLang = {};
const i18nToolTranslatedTextByLang = {};
let i18nToolAiSourceJson = null;
let i18nToolAiWorkingJson = null;
let i18nToolAiSourceFileName = '';
let i18nToolAiEnFlatCache = null;
const i18nToolAiUiFlatCacheByLang = {};
let i18nToolAiSending = false;
let i18nToolAiStopRequested = false;
let i18nToolAiBusyTimer = null;
let i18nToolAiResumeState = null;
let i18nToolAiTokenStats = { in: 0, out: 0, total: 0 };
const I18N_TOOL_AI_SEND_CANCELLED = 'I18N_TOOL_AI_SEND_CANCELLED';

function i18nToolSetAiStatus(message, isError = false) {
  const el = document.getElementById('i18nToolAiStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = message;
  el.style.color = isError ? 'var(--red)' : 'var(--txt2)';
}

function i18nToolSetAiLoadedFileLabel(text) {
  const el = document.getElementById('i18nToolAiLoadedFile');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = t('i18nTool.ai.loadedFile', { file: text || t('common.none') });
}

function i18nToolExtractUsageTotals(usage) {
  if (!usage || typeof usage !== 'object') return { in: 0, out: 0, total: 0 };
  const inTokens = Number(
    usage.prompt_tokens
    ?? usage.promptTokenCount
    ?? usage.input_tokens
    ?? usage.inputTokenCount
    ?? 0
  ) || 0;
  const outTokens = Number(
    usage.completion_tokens
    ?? usage.candidatesTokenCount
    ?? usage.output_tokens
    ?? usage.outputTokenCount
    ?? 0
  ) || 0;
  const totalTokens = Number(
    usage.total_tokens
    ?? usage.totalTokenCount
    ?? (inTokens + outTokens)
  ) || (inTokens + outTokens);
  return { in: inTokens, out: outTokens, total: totalTokens };
}

function i18nToolRenderAiTokenStats() {
  const el = document.getElementById('i18nToolAiTokens');
  if (!el) return;
  const stats = i18nToolAiTokenStats || { in: 0, out: 0, total: 0 };
  el.textContent = `?? Tokeny AI: ${stats.in} in / ${stats.out} out / ${stats.total} total`;
}

function i18nToolResetAiTokenStats() {
  i18nToolAiTokenStats = { in: 0, out: 0, total: 0 };
  i18nToolRenderAiTokenStats();
}

function i18nToolAccumulateAiTokenStats(usage) {
  const u = i18nToolExtractUsageTotals(usage);
  i18nToolAiTokenStats.in += u.in;
  i18nToolAiTokenStats.out += u.out;
  i18nToolAiTokenStats.total += u.total;
  i18nToolRenderAiTokenStats();
}

function i18nToolSetAiSendButtonState() {
  const btn = document.getElementById('btnI18nToolAiSend');
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = i18nToolAiSending ? t('i18nTool.ai.send.stop') : t('i18nTool.ai.send.start');
  if (i18nToolAiResumeState) i18nToolSetAiResumeButtonState(true, '? Pokracovat od posledn� d�vky');
}

function i18nToolSetAiResumeButtonState(enabled, label = '? Pokracovat') {
  const btn = document.getElementById('btnI18nToolAiResume');
  if (!btn) return;
  btn.style.display = enabled ? 'inline-block' : 'none';
  btn.disabled = !enabled || i18nToolAiSending;
  btn.textContent = label;
}

function i18nToolClearAiResumeState() {
  i18nToolAiResumeState = null;
  i18nToolSetAiResumeButtonState(false);
}

function startI18nToolAiBusyAnimation() {
  const el = document.getElementById('i18nToolAiBusy');
  if (!el) return;
  const frames = [
    t('i18nTool.ai.busy.0'),
    t('i18nTool.ai.busy.1'),
    t('i18nTool.ai.busy.2'),
    t('i18nTool.ai.busy.3')
  ];
  let idx = 0;
  el.style.display = 'block';
  el.textContent = frames[0];
  if (i18nToolAiBusyTimer) clearInterval(i18nToolAiBusyTimer);
  i18nToolAiBusyTimer = setInterval(() => {
    idx = (idx + 1) % frames.length;
    el.textContent = frames[idx];
  }, 350);
}

function stopI18nToolAiBusyAnimation(finalText = '') {
  const el = document.getElementById('i18nToolAiBusy');
  if (i18nToolAiBusyTimer) {
    clearInterval(i18nToolAiBusyTimer);
    i18nToolAiBusyTimer = null;
  }
  if (!el) return;
  if (finalText) {
    el.style.display = 'block';
    el.textContent = finalText;
    return;
  }
  el.style.display = 'none';
}

function i18nToolExtractJsonFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error(t('i18nTool.ai.error.emptyResponse'));
  try {
    return JSON.parse(text);
  } catch {}
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFence?.[1]) {
    try { return JSON.parse(codeFence[1].trim()); } catch {}
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd + 1));
    } catch {}
  }
  const repairedRows = i18nToolExtractRepairableRows(text);
  if (repairedRows.length) {
    return repairedRows;
  }
  throw new Error(t('i18nTool.ai.error.cannotFindChanges'));
}

function i18nToolExtractRepairableRows(rawText) {
  const text = String(rawText || '');
  const rows = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, i + 1).trim();
        start = -1;
        if (!candidate) continue;
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) rows.push(parsed);
        } catch {}
      }
    }
  }
  return rows;
}

function normalizeI18nToolAiRows(parsed) {
  if (typeof parsed === 'string') {
    const s = parsed.trim().toLowerCase();
    if (s === 'ok') return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const candidates = ['changes', 'results', 'items', 'data', 'output'];
    for (const key of candidates) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // Fallback: { "some.key": "corrected text", ... }
    const entries = Object.entries(parsed);
    if (entries.length && entries.every(([k, v]) => typeof k === 'string' && typeof v === 'string')) {
      return entries.map(([key, corrected]) => ({ key, status: 'fix', corrected, reason: 'mapped-object' }));
    }
  }
  return [];
}

function renderI18nToolAiPreview(rows) {
  const previewEl = document.getElementById('i18nToolAiPreview');
  if (!previewEl) return;
  if (!Array.isArray(rows) || !rows.length) {
    previewEl.value = t('i18nTool.ai.preview.noChanges');
    return;
  }
  const flatCurrent = i18nToolFlattenStringLeaves(i18nToolAiWorkingJson || i18nToolAiSourceJson || {});
  const uiLang = String(getUiLang() || 'cs').toLowerCase();
  const flatUi = i18nToolAiUiFlatCacheByLang[uiLang] || {};
  const lines = [];
  rows.forEach((row, idx) => {
    const key = String(row?.key || '').trim();
    const corrected = String(row?.corrected ?? '').trim();
    if (!key || !corrected) return;
    const current = String(flatCurrent[key] ?? '');
    const uiText = String(flatUi[key] ?? '');
    lines.push(
      `${idx + 1}) ${t('i18nTool.ai.preview.key')}: ${key}`,
      uiText ? `   UI (${uiLang}): ${uiText}` : `   UI (${uiLang}): ${t('common.none')}`,
      `   ${t('i18nTool.ai.preview.current')}: ${current}`,
      `   ${t('i18nTool.ai.preview.corrected')}: ${corrected}`,
      ''
    );
  });
  previewEl.value = lines.join('\n').trim() || t('i18nTool.ai.preview.noUsableChanges');
}

function openI18nToolAiJsonPicker() {
  const input = document.getElementById('i18nToolAiJsonInput');
  if (!input) return;
  input.value = '';
  input.click();
}

function loadI18nToolAiJsonFromFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      i18nToolAiSourceJson = parsed;
      i18nToolAiWorkingJson = typeof structuredClone === 'function'
        ? structuredClone(parsed)
        : JSON.parse(JSON.stringify(parsed));
      i18nToolAiSourceFileName = String(file.name || '').trim() || 'output.json';
      i18nToolClearAiResumeState();
      i18nToolResetAiTokenStats();
      i18nToolSetAiLoadedFileLabel(i18nToolAiSourceFileName);
      const dlBtn = document.getElementById('btnI18nToolDownloadAiResult');
      if (dlBtn) dlBtn.disabled = true;
      i18nToolSetAiStatus(t('i18nTool.ai.status.loadedForAudit', { file: i18nToolAiSourceFileName }));
      showToast(t('i18nTool.ai.toast.loadedForAudit', { file: i18nToolAiSourceFileName }));
    } catch (e) {
      i18nToolSetAiStatus(t('i18nTool.ai.status.invalidJson', { message: e?.message || String(e) }), true);
      showToast(t('i18nTool.ai.toast.invalidJson', { message: e?.message || String(e) }));
    }
  };
  reader.readAsText(file);
}

async function buildI18nToolAiPrompt() {
  if (!i18nToolAiSourceJson) {
    showToast(t('i18nTool.ai.toast.attachJsonFirst'));
    return;
  }
  try {
    const enFlat = await getI18nToolEnFlat();
    const targetFlat = i18nToolFlattenStringLeaves(i18nToolAiWorkingJson || i18nToolAiSourceJson);
    const keys = Object.keys(enFlat).sort((a, b) => a.localeCompare(b, 'cs'));
    const items = keys.map((key) => ({
      key,
      source: String(enFlat[key] ?? ''),
      target: String(targetFlat[key] ?? '')
    }));
    const payload = {
      source_lang: 'en',
      target_lang: i18nToolAiSourceFileName.replace(/\.json$/i, ''),
      filename: i18nToolAiSourceFileName,
      total_keys: keys.length,
      items
    };
    const prompt = buildI18nToolAiPromptText(payload);
    const promptEl = document.getElementById('i18nToolAiPrompt');
    if (promptEl) promptEl.value = prompt;
    i18nToolSetAiStatus(t('i18nTool.ai.status.promptReady', { count: keys.length }));
    showToast(t('i18nTool.ai.toast.promptReady', { count: keys.length }));
  } catch (e) {
    i18nToolSetAiStatus(t('i18nTool.ai.status.promptBuildFailed', { message: e?.message || String(e) }), true);
    showToast(t('i18nTool.ai.toast.promptBuildFailed', { message: e?.message || String(e) }));
  }
}

function buildI18nToolAiPromptText(payload = null) {
  const rules = t('i18nTool.ai.auditPrompt.rules');
  if (!payload) return `${rules}\n\n${t('i18nTool.ai.auditPrompt.emptyHint')}`;
  return `${rules}\n\n${t('i18nTool.ai.auditPrompt.dataLabel')}\n${JSON.stringify(payload, null, 2)}`;
}

function buildI18nToolAiItems(enFlat) {
  if (!i18nToolAiSourceJson || !enFlat) return [];
  const targetFlat = i18nToolFlattenStringLeaves(i18nToolAiWorkingJson || i18nToolAiSourceJson);
  const keys = Object.keys(enFlat).sort((a, b) => a.localeCompare(b, 'cs'));
  const targetCode = String(i18nToolAiSourceFileName || '').replace(/\.json$/i, '').toLowerCase();
  const keepPromptsEnglish = i18nToolKeepPromptsInEnglish() && !!targetCode && targetCode !== 'en';
  return keys
    .filter((key) => !(keepPromptsEnglish && key.startsWith('aiPrompts.')))
    .map((key) => ({
      key,
      source: String(enFlat[key] ?? ''),
      target: String(targetFlat[key] ?? '')
    }));
}

async function getI18nToolEnFlat() {
  if (i18nToolAiEnFlatCache) return i18nToolAiEnFlatCache;
  const res = await fetch('./i18n/en.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(t('i18nTool.ai.error.loadEnFailed', { status: res.status }));
  const enJson = await res.json();
  i18nToolAiEnFlatCache = i18nToolFlattenStringLeaves(enJson);
  return i18nToolAiEnFlatCache;
}

async function getI18nToolUiFlat() {
  const uiLang = String(getUiLang() || 'cs').toLowerCase();
  if (i18nToolAiUiFlatCacheByLang[uiLang]) return i18nToolAiUiFlatCacheByLang[uiLang];
  const res = await fetch(`./i18n/${uiLang}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(t('i18nTool.ai.error.loadUiFailed', { lang: uiLang, status: res.status }));
  const uiJson = await res.json();
  i18nToolAiUiFlatCacheByLang[uiLang] = i18nToolFlattenStringLeaves(uiJson);
  return i18nToolAiUiFlatCacheByLang[uiLang];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function applyI18nToolAiResponse() {
  if (!i18nToolAiSourceJson) {
    showToast(t('i18nTool.ai.toast.attachJsonFirst'));
    return;
  }
  const raw = String(document.getElementById('i18nToolAiResponse')?.value || '').trim();
  if (!raw) {
    showToast(t('i18nTool.ai.toast.pasteResponse'));
    return;
  }
  if (raw.toLowerCase() === 'ok') {
    renderI18nToolAiPreview([]);
    i18nToolSetAiStatus(t('i18nTool.ai.status.okNoChanges'));
    showToast(t('i18nTool.ai.toast.noChanges'));
    return;
  }
  try {
    await getI18nToolUiFlat();
    const parsed = i18nToolExtractJsonFromText(raw);
    const rows = normalizeI18nToolAiRows(parsed);
    renderI18nToolAiPreview(rows);
    if (!Array.isArray(rows)) throw new Error(t('i18nTool.ai.error.responseMustBeArray'));
    const updated = typeof structuredClone === 'function'
      ? structuredClone(i18nToolAiSourceJson)
      : JSON.parse(JSON.stringify(i18nToolAiSourceJson));
    const validKeys = new Set(Object.keys(i18nToolFlattenStringLeaves(updated)));
    const sourceEnFlat = i18nToolAiEnFlatCache || {};
    const targetCode = String(i18nToolAiSourceFileName.replace(/\.json$/i, '') || '').toLowerCase();
    const targetTagMap = {
      cs: 'CZ', en: 'EN', sk: 'SK', pl: 'PL', bg: 'BG', de: 'DE', fr: 'FR', es: 'ES', it: 'IT',
      pt: 'PT', ru: 'RU', uk: 'UK', ro: 'RO', hu: 'HU', nl: 'NL', sv: 'SV', da: 'DA', no: 'NO',
      fi: 'FI', el: 'EL', tr: 'TR', ar: 'AR', ja: 'JA', ko: 'KO', he: 'HE', 'zh-cn': 'zh-CN', zh: 'zh-CN'
    };
    const targetTag = targetTagMap[targetCode] || '';
    let applied = 0;
    let warned = 0;
    let skipped = 0;
    for (const row of rows) {
      const key = String(row?.key || '').trim();
      const corrected = row?.corrected;
      if (!key || !validKeys.has(key)) { skipped++; continue; }
      if (i18nToolKeepPromptsInEnglish() && targetCode !== 'en' && key.startsWith('aiPrompts.')) { skipped++; continue; }
      if (typeof corrected !== 'string') { skipped++; continue; }
      const sourceText = String(sourceEnFlat[key] ?? '');
      const sourceHasCzTag = /\(CZ\)/.test(sourceText);
      const correctedHasCzTag = /\(CZ\)/.test(corrected);
      if (targetTag && sourceHasCzTag && correctedHasCzTag && targetTag !== 'CZ') {
        warned++;
        continue;
      }
      i18nToolSetByPath(updated, key, corrected);
      applied++;
    }
    i18nToolAiWorkingJson = updated;
    const normalizedFileCode = i18nToolAiSourceFileName.replace(/\.json$/i, '').toLowerCase();
    const langCode = normalizedFileCode === 'zh' ? 'zh-CN' : normalizedFileCode;
    i18nToolTranslatedJsonByLang[langCode] = updated;
    i18nToolTranslatedTextByLang[langCode] = JSON.stringify(updated, null, 2);
    const editBtn = document.getElementById('btnI18nToolEditOutput');
    if (editBtn) editBtn.disabled = false;
    const dlBtn = document.getElementById('btnI18nToolDownloadAiResult');
    if (dlBtn) dlBtn.disabled = false;
    i18nToolSetAiStatus(t('i18nTool.ai.status.auditApplied', { applied, warned, skipped }));
    showToast(t('i18nTool.ai.toast.applied', { applied }));
  } catch (e) {
    i18nToolSetAiStatus(t('i18nTool.ai.status.responseProcessFailed', { message: e?.message || String(e) }), true);
    showToast(t('i18nTool.ai.toast.responseProcessFailed', { message: e?.message || String(e) }));
  }
}

async function sendI18nToolAiPrompt(options = {}) {
  const resume = !!options?.resume;
  const promptEl = document.getElementById('i18nToolAiPrompt');
  const responseEl = document.getElementById('i18nToolAiResponse');
  if (!promptEl || !responseEl) return;
  if (i18nToolAiSending) {
    i18nToolAiStopRequested = true;
    i18nToolSetAiStatus(t('i18nTool.ai.status.stopRequested'));
    return;
  }

  let provider = 'groq';
  let model = String(getPipelineModelForProvider('groq') || 'meta-llama/llama-4-scout-17b-16e-instruct').trim();
  let apiKey = '';
  let allItems = [];
  let batchSize = 120;
  let chunks = [];
  let targetLang = i18nToolAiSourceFileName.replace(/\.json$/i, '');
  let sendIntervalSec = 20;
  let merged = [];
  let totalFix = 0;
  let totalWarn = 0;
  let totalOther = 0;
  let startIdx = 0;
  let currentIdx = 0;

  try {
    if (resume && !i18nToolAiResumeState) {
      showToast(t('i18nTool.ai.toast.nothingToResume'));
      return;
    }

    let promptText = String(promptEl.value || '').trim();
    if (!promptText) {
      await buildI18nToolAiPrompt();
      promptText = String(promptEl.value || '').trim();
    }
    if (!promptText) {
      showToast(t('i18nTool.ai.toast.createPromptFirst'));
      return;
    }

    if (resume) {
      ({
        provider,
        model,
        apiKey,
        allItems,
        batchSize,
        chunks,
        targetLang,
        sendIntervalSec,
        merged,
        totalFix,
        totalWarn,
        totalOther,
        nextChunkIndex: startIdx
      } = i18nToolAiResumeState);
      showToast(t('i18nTool.ai.toast.resumingFromBatch', { current: startIdx + 1, total: chunks.length }));
    } else {
      i18nToolClearAiResumeState();
      i18nToolResetAiTokenStats();
      apiKey = String(getCurrentApiKey(provider) || '').trim();
      if (!apiKey) {
        i18nToolSetAiStatus(t('i18nTool.ai.status.missingApiKey'), true);
        showToast(t('i18nTool.ai.toast.missingApiKey'));
        return;
      }
      const enFlat = await getI18nToolEnFlat();
      await getI18nToolUiFlat();
      allItems = buildI18nToolAiItems(enFlat);
      if (!allItems.length) throw new Error(t('i18nTool.ai.error.missingAuditData'));

      const batchInputValue = parseInt(String(document.getElementById('i18nToolAiBatchSize')?.value || '120'), 10);
      batchSize = Math.max(20, Math.min(300, Number.isFinite(batchInputValue) ? batchInputValue : 120));
      chunks = chunkArray(allItems, batchSize);
      targetLang = i18nToolAiSourceFileName.replace(/\.json$/i, '');
      const intervalInputValue = parseInt(
        String(
          document.getElementById('i18nToolAiInterval')?.value
          || document.getElementById('intervalRun')?.value
          || document.getElementById('interval')?.value
          || '20'
        ),
        10
      );
      sendIntervalSec = Math.max(1, Math.min(300, Number.isFinite(intervalInputValue) ? intervalInputValue : 20));
    }

    i18nToolAiSending = true;
    i18nToolAiStopRequested = false;
    i18nToolSetAiSendButtonState();
    i18nToolSetAiResumeButtonState(false);
    startI18nToolAiBusyAnimation();
    i18nToolSetAiLoadedFileLabel(i18nToolAiSourceFileName || '�');

    for (let idx = startIdx; idx < chunks.length; idx++) {
      currentIdx = idx;
      if (i18nToolAiStopRequested) throw new Error(I18N_TOOL_AI_SEND_CANCELLED);
      let done = false;
      let localBatchSize = batchSize;
      let attemptGuard = 0;
      while (!done) {
        if (i18nToolAiStopRequested) throw new Error(I18N_TOOL_AI_SEND_CANCELLED);
        attemptGuard++;
        if (attemptGuard > 5) throw new Error(t('i18nTool.ai.error.batchRepeatedFailure', { index: idx + 1 }));
        const chunk = chunks[idx];
        const payload = {
          source_lang: 'en',
          target_lang: targetLang,
          filename: i18nToolAiSourceFileName,
          batch: { index: idx + 1, total: chunks.length, size: chunk.length },
          items: chunk
        };
        const chunkPrompt = buildI18nToolAiPromptText(payload);
        i18nToolSetAiStatus(t('i18nTool.ai.status.sendingBatch', { index: idx + 1, total: chunks.length, size: chunk.length, provider, model }));
        try {
          const raw = await callAIWithRetry(provider, apiKey, model, [
            { role: 'system', content: getActiveSystemMessage() },
            { role: 'user', content: chunkPrompt }
          ]);
          i18nToolAccumulateAiTokenStats(raw?.usage || null);
          const content = String(raw?.content || '').trim();
          if (!content) throw new Error(t('i18nTool.ai.error.noResponseText'));
          const parsed = i18nToolExtractJsonFromText(content);
          const rows = normalizeI18nToolAiRows(parsed);
          if (!Array.isArray(rows)) throw new Error(t('i18nTool.ai.error.batchResponseNotArray'));
          merged.push(...rows);
          const batchFix = rows.filter(r => String(r?.status || '').toLowerCase() === 'fix').length;
          const batchWarn = rows.filter(r => String(r?.status || '').toLowerCase() === 'warn').length;
          const batchOther = Math.max(0, rows.length - batchFix - batchWarn);
          totalFix += batchFix;
          totalWarn += batchWarn;
          totalOther += batchOther;
          responseEl.value = JSON.stringify(merged, null, 2);
          i18nToolSetAiStatus(t('i18nTool.ai.status.batchDoneStats', {
            index: idx + 1,
            total: chunks.length,
            batchFix,
            batchWarn,
            batchOther,
            totalFix,
            totalWarn,
            totalOther
          }));
          done = true;
        } catch (e) {
          const msg = String(e?.message || '').toLowerCase();
          const isJsonParseIssue =
            e instanceof SyntaxError
            || msg.includes('unterminated string')
            || msg.includes('unexpected end of json')
            || msg.includes('unexpected token')
            || msg.includes('json at position');
          const isTransientAiCallIssue =
            msg.includes('429')
            || msg.includes('rate limit')
            || msg.includes('too many')
            || msg.includes('quota')
            || msg.includes('service unavailable')
            || msg.includes('timeout')
            || msg.includes('request canceled')
            || msg.includes('blokovan� �cet')
            || msg.includes('restricted')
            || msg.includes('organization');
          if ((msg.includes('413') || msg.includes('too large') || msg.includes('content too large')) && localBatchSize > 20) {
            localBatchSize = Math.max(20, Math.floor(localBatchSize / 2));
            const rest = allItems.slice(idx * batchSize);
            chunks = [...chunks.slice(0, idx), ...chunkArray(rest, localBatchSize)];
            batchSize = localBatchSize;
            continue;
          }
          if (isJsonParseIssue) {
            if (localBatchSize > 20) {
              localBatchSize = Math.max(20, Math.floor(localBatchSize / 2));
              const rest = allItems.slice(idx * batchSize);
              chunks = [...chunks.slice(0, idx), ...chunkArray(rest, localBatchSize)];
              batchSize = localBatchSize;
              i18nToolSetAiStatus(t('i18nTool.ai.status.batchJsonInvalidShrink', {
                index: idx + 1,
                total: chunks.length,
                batch: localBatchSize
              }));
              await sleepMs(1500);
              continue;
            }
            i18nToolSetAiStatus(t('i18nTool.ai.status.batchJsonInvalidRetry', {
              index: idx + 1,
              total: chunks.length,
              attempt: attemptGuard
            }));
            await sleepMs(1500);
            continue;
          }
          if (isTransientAiCallIssue && attemptGuard < 5) {
            const waitMs = Math.min(12000, 2000 * attemptGuard);
            i18nToolSetAiStatus(t('i18nTool.ai.status.batchTransientRetry', {
              index: idx + 1,
              total: chunks.length,
              message: e?.message || t('error.unknown'),
              seconds: Math.round(waitMs / 1000)
            }));
            await sleepMs(waitMs);
            continue;
          }
          throw e;
        }
      }
      if (idx < chunks.length - 1) {
        if (i18nToolAiStopRequested) throw new Error(I18N_TOOL_AI_SEND_CANCELLED);
        i18nToolSetAiStatus(t('i18nTool.ai.status.batchWaitNext', {
          index: idx + 1,
          total: chunks.length,
          seconds: sendIntervalSec
        }));
        await sleepMs(sendIntervalSec * 1000);
      }
    }

    responseEl.value = JSON.stringify(merged, null, 2);
    renderI18nToolAiPreview(merged);
    stopI18nToolAiBusyAnimation('? AI audit dokoncen.');
    i18nToolSetAiStatus(t('i18nTool.ai.status.loadedInBatches', {
      batches: chunks.length,
      total: merged.length,
      fix: totalFix,
      warn: totalWarn,
      other: totalOther
    }));
    showToast(t('i18nTool.ai.toast.loadedInBatches', { batches: chunks.length }));
    i18nToolClearAiResumeState();
  } catch (e) {
    if (String(e?.message || '') === I18N_TOOL_AI_SEND_CANCELLED) {
      stopI18nToolAiBusyAnimation(t('i18nTool.ai.status.stoppedByUser'));
      i18nToolSetAiStatus(t('i18nTool.ai.status.sendStoppedByUser'));
      showToast(t('i18nTool.ai.toast.sendStoppedByUser'));
      return;
    }

    i18nToolAiResumeState = {
      provider,
      model,
      apiKey,
      allItems,
      batchSize,
      chunks,
      targetLang,
      sendIntervalSec,
      merged,
      totalFix,
      totalWarn,
      totalOther,
      nextChunkIndex: currentIdx
    };

    stopI18nToolAiBusyAnimation(t('i18nTool.ai.status.failed'));
    i18nToolSetAiStatus(
      t('i18nTool.ai.status.resumeReady', {
        message: e?.message || String(e)
      }),
      true
    );
    i18nToolSetAiResumeButtonState(true, t('i18nTool.ai.resume.button'));
    showToast(t('i18nTool.ai.toast.callFailed', { message: e?.message || String(e) }));
  } finally {
    i18nToolAiSending = false;
    i18nToolAiStopRequested = false;
    i18nToolSetAiSendButtonState();
  }
}

function resumeI18nToolAiPrompt() {
  return sendI18nToolAiPrompt({ resume: true });
}

function downloadI18nToolAiResult() {
  if (!i18nToolAiWorkingJson) {
    showToast(t('i18nTool.ai.toast.applyResponseFirst'));
    return;
  }
  const sourceName = i18nToolAiSourceFileName || 'ai-audit-output.json';
  let name;
  if (/-ai-audit\.json$/i.test(sourceName)) {
    name = sourceName;
  } else if (/\.json$/i.test(sourceName)) {
    name = sourceName.replace(/\.json$/i, '-ai-audit.json');
  } else {
    name = `${sourceName}-ai-audit.json`;
  }
  i18nToolDownloadFile(JSON.stringify(i18nToolAiWorkingJson, null, 2), name);
}

function minimizeI18nToolModal() {
  if (i18nToolRunning) i18nToolMinimizedDuringRun = true;
  closeI18nToolModal();
}

function cancelI18nToolBrowserTranslate() {
  if (!i18nToolRunning) return;
  i18nToolCancelRequested = true;
  const status = document.getElementById('i18nToolStatus');
  if (status) {
    status.style.display = 'block';
    status.textContent = t('i18nTool.status.stopping');
  }
}

function closeI18nToolDoneModal() {
  const doneModal = document.getElementById('i18nToolDoneModal');
  if (doneModal) doneModal.classList.remove('show');
}

function reopenI18nToolModalAfterDone() {
  closeI18nToolDoneModal();
  const m = document.getElementById('i18nToolModal');
  if (m) m.style.display = 'flex';
}

function initI18nToolUi() {
  const engineEl = document.getElementById('i18nToolEngine');
  const deeplKeyEl = document.getElementById('i18nToolDeeplKey');
  const keepPromptsEnEl = document.getElementById('i18nToolKeepPromptsEn');
  if (engineEl && !engineEl.dataset.bound) {
    engineEl.dataset.bound = '1';
    engineEl.addEventListener('change', updateI18nToolCommandPreview);
  }
  if (deeplKeyEl && !deeplKeyEl.dataset.bound) {
    deeplKeyEl.dataset.bound = '1';
    deeplKeyEl.addEventListener('input', updateI18nToolCommandPreview);
  }
  if (keepPromptsEnEl) {
    const saved = localStorage.getItem(I18N_TOOL_KEEP_PROMPTS_EN_KEY);
    keepPromptsEnEl.checked = saved == null ? true : saved === '1';
    if (!keepPromptsEnEl.dataset.bound) {
      keepPromptsEnEl.dataset.bound = '1';
      keepPromptsEnEl.addEventListener('change', () => {
        localStorage.setItem(I18N_TOOL_KEEP_PROMPTS_EN_KEY, keepPromptsEnEl.checked ? '1' : '0');
        updateI18nToolCommandPreview();
      });
    }
  }
  renderI18nToolLanguageGrid();
}

function i18nToolKeepPromptsInEnglish() {
  const el = document.getElementById('i18nToolKeepPromptsEn');
  if (el) return !!el.checked;
  const saved = localStorage.getItem(I18N_TOOL_KEEP_PROMPTS_EN_KEY);
  return saved == null ? true : saved === '1';
}

function renderI18nToolLanguageGrid() {
  const grid = document.getElementById('i18nToolLanguageGrid');
  if (!grid) return;
  const filter = (document.getElementById('i18nToolLangSearch')?.value || '').trim().toLowerCase();
  const filtered = filter
    ? I18N_TOOL_LANGUAGES.filter((lang) => {
        const name = getI18nToolLanguageDisplayName(lang.code).toLowerCase();
        const code = (lang.code || '').toLowerCase();
        const flag = (lang.flag || '').toLowerCase();
        return name.includes(filter) || code.includes(filter) || flag.includes(filter);
      })
    : I18N_TOOL_LANGUAGES;
  grid.innerHTML = filtered.map((lang) => `
    <button type="button" class="i18n-tool-lang-card ${i18nToolSelectedLanguages.has(lang.code) ? 'selected' : ''}" onclick="toggleI18nToolLanguage('${lang.code}')">
      <div class="i18n-tool-lang-flag">${String(lang.flag || '').toUpperCase()}</div>
      <div class="i18n-tool-lang-name">${getI18nToolLanguageDisplayName(lang.code)}</div>
      <div class="i18n-tool-lang-code">${I18N_TOOL_LANG_DISPLAY_CODE[lang.code] || String(lang.code || '').toUpperCase()}</div>
    </button>
  `).join('');
  updateI18nToolSummary();
}

function filterI18nToolLanguages() {
  renderI18nToolLanguageGrid();
}

function updateI18nToolSummary() {
  const summary = document.getElementById('i18nToolSelectedSummary');
  if (!summary) return;
  const selectedList = I18N_TOOL_LANGUAGES
    .filter((lang) => i18nToolSelectedLanguages.has(lang.code))
    .map((lang) => `${getI18nToolLanguageDisplayName(lang.code)} (${lang.code})`);
  if (!selectedList.length) {
    summary.textContent = t('i18nTool.summary.selected', { count: 0, list: t('common.none') });
    return;
  }
  summary.textContent = t('i18nTool.summary.selected', { count: i18nToolSelectedLanguages.size, list: selectedList.join(', ') });
}

function i18nToolFormatEta(seconds) {
  const sec = Math.max(0, Math.round(Number(seconds) || 0));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

function i18nToolStartRunAnimation() {
  const animEl = document.getElementById('i18nToolRunAnim');
  if (!animEl) return;
  const frames = [
    t('i18nTool.runAnim.0'),
    t('i18nTool.runAnim.1'),
    t('i18nTool.runAnim.2'),
    t('i18nTool.runAnim.3')
  ];
  let idx = 0;
  animEl.style.display = 'block';
  animEl.textContent = frames[0];
  if (i18nToolRunAnimTimer) clearInterval(i18nToolRunAnimTimer);
  i18nToolRunAnimTimer = setInterval(() => {
    idx = (idx + 1) % frames.length;
    animEl.textContent = frames[idx];
  }, 350);
}

function i18nToolStopRunAnimation(finalText = '') {
  const animEl = document.getElementById('i18nToolRunAnim');
  if (i18nToolRunAnimTimer) {
    clearInterval(i18nToolRunAnimTimer);
    i18nToolRunAnimTimer = null;
  }
  if (!animEl) return;
  if (finalText) {
    animEl.style.display = 'block';
    animEl.textContent = finalText;
  } else {
    animEl.style.display = 'none';
  }
}

function resetI18nToolRuntimeUi() {
  const progressWrap = document.getElementById('i18nToolProgressWrap');
  const progressFill = document.getElementById('i18nToolProgressFill');
  const status = document.getElementById('i18nToolStatus');
  const downloads = document.getElementById('i18nToolDownloads');
  const etaEl = document.getElementById('i18nToolEta');
  if (progressWrap) progressWrap.style.display = 'none';
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
  }
  if (status) {
    status.style.display = 'none';
    status.textContent = '';
  }
  if (downloads) {
    downloads.style.display = 'none';
    downloads.innerHTML = '';
  }
  if (etaEl) {
    etaEl.style.display = 'none';
    etaEl.textContent = t('i18nTool.eta.idle');
  }
  i18nToolStopRunAnimation();
  const editBtn = document.getElementById('btnI18nToolEditOutput');
  if (editBtn) editBtn.disabled = true;
}

function toggleI18nToolLanguage(code) {
  if (i18nToolSelectedLanguages.has(code)) i18nToolSelectedLanguages.delete(code);
  else i18nToolSelectedLanguages.add(code);
  renderI18nToolLanguageGrid();
  updateI18nToolCommandPreview();
}

function openI18nToolLangModal() {
  renderI18nToolLanguageGrid();
  const m = document.getElementById('i18nToolLangModal');
  if (m) m.classList.add('show');
}

function closeI18nToolLangModal() {
  const m = document.getElementById('i18nToolLangModal');
  if (m) m.classList.remove('show');
}

function i18nToolSelectAllLangs() {
  I18N_TOOL_LANGUAGES.forEach((lang) => i18nToolSelectedLanguages.add(lang.code));
  renderI18nToolLanguageGrid();
  updateI18nToolCommandPreview();
}

function i18nToolDeselectAllLangs() {
  i18nToolSelectedLanguages.clear();
  renderI18nToolLanguageGrid();
  updateI18nToolCommandPreview();
}

function updateI18nToolCommandPreview() {
  const cmdEl = document.getElementById('i18nToolCmd');
  if (!cmdEl) return;
  const engine = String(document.getElementById('i18nToolEngine')?.value || 'google');
  const deeplKey = String(document.getElementById('i18nToolDeeplKey')?.value || '').trim();
  const keepPromptsEn = i18nToolKeepPromptsInEnglish();

  const selected = I18N_TOOL_LANGUAGES.filter((lang) => i18nToolSelectedLanguages.has(lang.code));
  if (!selected.length) {
    cmdEl.value = `# ${t('i18nTool.cmd.selectAtLeastOne')}`;
    updateI18nToolSummary();
    return;
  }

  const lines = selected.map((lang) => {
    const keyArg = engine === 'deepl' ? ` --deepl-key ${deeplKey || 'YOUR_DEEPL_KEY'}` : '';
    const keepPromptsArg = keepPromptsEn ? ' --keep-prompts-en' : '';
    return `python tools/translate_i18n.py -s cs -t ${lang.code} -i i18n/cs.json -o i18n/${lang.code}.json --tag ${lang.tag} --engine ${engine}${keyArg}${keepPromptsArg}`;
  });
  cmdEl.value = `${lines.join('\n')}\n\n# aiPrompts.* always EN: ${keepPromptsEn ? 'ON' : 'OFF'}`;
  updateI18nToolSummary();
}

async function copyI18nToolCmd() {
  const cmd = String(document.getElementById('i18nToolCmd')?.value || '').trim();
  if (!cmd) {
    showToast(t('i18nTool.toast.selectTargetFirst'));
    return;
  }
  try {
    await navigator.clipboard.writeText(cmd);
    showToast(t('i18nTool.toast.commandCopied'));
  } catch {
    showToast(t('i18nTool.toast.copyFailed'));
  }
}

async function loadI18nToolSourceCsData() {
  if (i18nToolSourceCsData) return i18nToolSourceCsData;
  const res = await fetch('./i18n/cs.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Nepodarilo se nac�st i18n/cs.json (HTTP ${res.status})`);
  i18nToolSourceCsData = await res.json();
  return i18nToolSourceCsData;
}

function i18nToolProtectTagsAndWords(str) {
  // Chráníme pouze závorkové tagy – nahradí (CZ), (EN), … za I18N_TOOL_PLACEHOLDER
  return str.replace(I18N_TOOL_TAG_REGEX, I18N_TOOL_PLACEHOLDER);
}

function i18nToolRestoreTagsAndWords(str, targetTag) {
  // Nahrazení I18N_TOOL_PLACEHOLDER za (targetTag)
  return str.split(I18N_TOOL_PLACEHOLDER).join(`(${targetTag})`);
}

function i18nToolProtectImmutableSegments(str) {
  if (typeof str !== 'string' || !str) return { text: str, immutableSegments: [] };
  const immutableSegments = [];
  const markSegment = (segment) => {
    const idx = immutableSegments.push(segment) - 1;
    return `${I18N_TOOL_IMMUTABLE_TOKEN_PREFIX}${idx}${I18N_TOOL_IMMUTABLE_TOKEN_SUFFIX}`;
  };
  const withProtectedHtml = str.replace(I18N_TOOL_HTML_TAG_REGEX, markSegment);
  const withAllProtected = withProtectedHtml.replace(I18N_TOOL_JSON_PLACEHOLDER_REGEX, markSegment);
  return { text: withAllProtected, immutableSegments };
}

function i18nToolRestoreImmutableSegments(str, immutableSegments) {
  if (typeof str !== 'string' || !str || !Array.isArray(immutableSegments) || immutableSegments.length === 0) {
    return str;
  }
  return str.replace(new RegExp(`${I18N_TOOL_IMMUTABLE_TOKEN_PREFIX}(\\d+)${I18N_TOOL_IMMUTABLE_TOKEN_SUFFIX}`, 'g'), (match, idxRaw) => {
    const idx = Number(idxRaw);
    return Number.isInteger(idx) && immutableSegments[idx] !== undefined
      ? immutableSegments[idx]
      : match;
  });
}

async function i18nToolTranslateText(text, targetLang) {
  const engine = String(document.getElementById('i18nToolEngine')?.value || 'google').toLowerCase();
  const deeplKey = String(document.getElementById('i18nToolDeeplKey')?.value || '').trim();
  if (engine === 'deepl' && deeplKey) {
    const deeplTarget = I18N_TOOL_DEEPL_LANG_MAP[targetLang] || '';
    if (deeplTarget) {
      try {
        const res = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            auth_key: deeplKey,
            text,
            target_lang: deeplTarget
          })
        });
        if (res.ok) {
          const data = await res.json();
          const out = data?.translations?.[0]?.text;
          if (out) return out;
        }
      } catch (error) {
      }
    }
  }
  const attempts = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=cs&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`,
    `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
  ];
  let lastError = null;
  for (const url of attempts) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const raw = await response.text();
      const data = JSON.parse(raw);
      const translated = data?.[0]?.[0]?.[0];
      if (typeof translated === 'string' && translated.trim()) return translated;
      lastError = new Error('Missing translation payload');
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  i18nToolGoogleFailureCount++;
  if (i18nToolGoogleFailureCount <= 5 || i18nToolGoogleFailureCount % 100 === 0) {
  }
  return text;
}

function i18nToolCountTranslatableStrings(value) {
  if (typeof value === 'string') return value.trim() ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + i18nToolCountTranslatableStrings(item), 0);
  if (typeof value === 'object' && value !== null) {
    let sum = 0;
    for (const key of Object.keys(value)) sum += i18nToolCountTranslatableStrings(value[key]);
    return sum;
  }
  return 0;
}

function i18nToolExtractPlaceholderList(text) {
  if (typeof text !== 'string' || !text) return [];
  const matches = text.match(I18N_TOOL_JSON_PLACEHOLDER_REGEX) || [];
  return Array.from(new Set(matches)).sort();
}

function i18nToolHasSamePlaceholderSet(source, translated) {
  const sourcePlaceholders = i18nToolExtractPlaceholderList(source);
  const translatedPlaceholders = i18nToolExtractPlaceholderList(translated);
  return sourcePlaceholders.join('|') === translatedPlaceholders.join('|');
}

function i18nToolCollectPlaceholderMismatches(source, translated, path = '', out = []) {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return out;
    const sourcePlaceholders = i18nToolExtractPlaceholderList(source);
    const translatedPlaceholders = i18nToolExtractPlaceholderList(translated);
    if (sourcePlaceholders.join('|') !== translatedPlaceholders.join('|')) {
      out.push({
        path,
        sourcePlaceholders,
        translatedPlaceholders,
        sourceText: source,
        translatedText: translated
      });
    }
    return out;
  }
  if (Array.isArray(source)) {
    source.forEach((item, idx) => {
      const nextPath = `${path}[${idx}]`;
      i18nToolCollectPlaceholderMismatches(item, translated?.[idx], nextPath, out);
    });
    return out;
  }
  if (source && typeof source === 'object') {
    Object.keys(source).forEach((key) => {
      const nextPath = path ? `${path}.${key}` : key;
      i18nToolCollectPlaceholderMismatches(source[key], translated?.[key], nextPath, out);
    });
  }
  return out;
}

function i18nToolShouldKeepPromptEnglish(path = '', targetLang = '') {
  const keyPath = String(path || '');
  const lang = String(targetLang || '').toLowerCase();
  return i18nToolKeepPromptsInEnglish() && lang !== 'en' && keyPath.startsWith('aiPrompts.');
}

async function i18nToolTranslateValue(value, targetLang, targetTag, targetLanguageName, onProgress, path = '') {
  if (i18nToolCancelRequested) throw new Error(I18N_TOOL_CANCELLED_ERROR);
  if (typeof value === 'string') {
    if (!value.trim()) return value;
    if (i18nToolShouldKeepPromptEnglish(path, targetLang)) {
      if (typeof onProgress === 'function') onProgress(path);
      return value;
    }
    const protectedValue = i18nToolProtectImmutableSegments(value);
    const textToTranslate = i18nToolProtectTagsAndWords(protectedValue.text);
    let translated = await i18nToolTranslateText(textToTranslate, targetLang);
    await new Promise((resolve) => setTimeout(resolve, 25));
    if (typeof onProgress === 'function') onProgress(path);
     let withRestoredTags = i18nToolRestoreTagsAndWords(translated, targetTag);
     let restored = i18nToolRestoreImmutableSegments(withRestoredTags, protectedValue.immutableSegments);
     // Kdy� engine vr�t� useknut� text a ztrat� placeholdery, zkus�me preklad je�te 2x.
     for (let retry = 0; retry < 2 && !i18nToolHasSamePlaceholderSet(value, restored); retry++) {
       translated = await i18nToolTranslateText(textToTranslate, targetLang);
       await new Promise((resolve) => setTimeout(resolve, 25));
       withRestoredTags = i18nToolRestoreTagsAndWords(translated, targetTag);
       restored = i18nToolRestoreImmutableSegments(withRestoredTags, protectedValue.immutableSegments);
     }
    if (!i18nToolHasSamePlaceholderSet(value, restored)) {
      i18nToolStrictFallbackCount++;
      return value;
    }
    return restored;
  }
  if (Array.isArray(value)) {
    const result = [];
    for (let i = 0; i < value.length; i++) {
      result.push(await i18nToolTranslateValue(value[i], targetLang, targetTag, targetLanguageName, onProgress, `${path}[${i}]`));
    }
    return result;
  }
  if (typeof value === 'object' && value !== null) {
    const result = {};
    for (const key of Object.keys(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      result[key] = await i18nToolTranslateValue(value[key], targetLang, targetTag, targetLanguageName, onProgress, nextPath);
    }
    return result;
  }
  return value;
}

function i18nToolDownloadFile(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function i18nToolParsePath(path) {
  const parts = [];
  const re = /([^[.\]]+)|\[(\d+)\]/g;
  let m;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== undefined) parts.push(m[1]);
    else parts.push(Number(m[2]));
  }
  return parts;
}

function i18nToolSetByPath(obj, path, value) {
  const parts = i18nToolParsePath(path);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur?.[p] === undefined || cur?.[p] === null) return;
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function i18nToolFlattenStringLeaves(value, path = '', out = {}) {
  if (typeof value === 'string') {
    out[path] = value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => i18nToolFlattenStringLeaves(item, `${path}[${idx}]`, out));
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    Object.keys(value).forEach((key) => {
      const next = path ? `${path}.${key}` : key;
      i18nToolFlattenStringLeaves(value[key], next, out);
    });
  }
  return out;
}

function openI18nToolOutputEditor() {
  const langs = Object.keys(i18nToolTranslatedJsonByLang).sort();
  if (!langs.length) {
    showToast(t('i18nTool.editor.completeTranslationFirst'));
    return;
  }
  const select = document.getElementById('i18nToolEditorLang');
  if (!select) return;
  select.innerHTML = langs.map((code) => `<option value="${code}">${code}.json</option>`).join('');
  onI18nToolEditorLangChange();
  const m = document.getElementById('i18nToolEditorModal');
  if (m) m.classList.add('show');
}

function buildI18nToolEditorHelpText() {
  return [
    'N�poveda: Editor v�stupn�ho JSON',
    '',
    'K cemu slou��:',
    '- Upravuje u� prelo�en� soubor po jednotliv�ch kl�c�ch.',
    '- Prehled je ve form�tu: key.path<TAB>"hodnota".',
    '- Ukl�d� zmeny jen do aktu�lne vybran�ho jazyka.',
    '',
    'Postup:',
    '1) Vyber jazyk v poli �Jazyk v�stupu�.',
    '2) Najdi r�dek, kter� chce� opravit.',
    '3) Uprav jen text vpravo za tabul�torem.',
    '4) Klikni na �?? Ulo�it JSON�.',
    '5) St�hne se nov� soubor <lang>.json s �pravami.',
    '',
    'Dule�it� pravidla:',
    '- Levou c�st (key.path) nemen.',
    '- Ka�d� r�dek mus� obsahovat tabul�tor mezi kl�cem a hodnotou.',
    '- Hodnota m� b�t JSON string, typicky v uvozovk�ch.',
    '- Neplatn�/rozbit� r�dky se ignoruj�.',
    '',
    'Na co si d�t pozor:',
    '- Placeholdery jako {name}, {count}, {lang} mus� zustat presne stejn�.',
    '- Nema� technick� znacky a promenn�.',
    '- Po ulo�en� doporucuji rychlou kontrolu ve UI.'
  ].join('\n');
}

function openI18nToolEditorHelpModal() {
  const m = document.getElementById('i18nToolEditorHelpModal');
  const body = document.getElementById('i18nToolEditorHelpBody');
  if (body) body.textContent = buildI18nToolEditorHelpText();
  if (m) m.classList.add('show');
}

function closeI18nToolEditorHelpModal() {
  const m = document.getElementById('i18nToolEditorHelpModal');
  if (m) m.classList.remove('show');
}

function openI18nToolLoadJsonPicker() {
  const input = document.getElementById('i18nToolLoadJsonInput');
  if (!input) return;
  input.value = '';
  input.click();
}

function loadI18nToolJsonForEditFromFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'));
      const rawName = String(file.name || '').trim();
      const fileCode = rawName.replace(/\.json$/i, '').toLowerCase();
      const normalizedCode = fileCode === 'zh' ? 'zh-CN' : fileCode;
      const langCode = normalizedCode || 'loaded';
      i18nToolTranslatedJsonByLang[langCode] = parsed;
      i18nToolTranslatedTextByLang[langCode] = JSON.stringify(parsed, null, 2);
      const editBtn = document.getElementById('btnI18nToolEditOutput');
      if (editBtn) editBtn.disabled = false;
      showToast(t('i18nTool.editor.loadedForEdit', { file: rawName }));
      openI18nToolOutputEditor();
      const select = document.getElementById('i18nToolEditorLang');
      if (select) {
        const target = Array.from(select.options).find((opt) => opt.value === langCode);
        if (target) {
          select.value = langCode;
          onI18nToolEditorLangChange();
        }
      }
    } catch (e) {
      showToast(t('i18nTool.ai.toast.invalidJson', { message: e?.message || String(e) }));
    }
  };
  reader.readAsText(file);
}

function closeI18nToolOutputEditor() {
  const m = document.getElementById('i18nToolEditorModal');
  if (m) m.classList.remove('show');
}

function syncI18nToolAiModalDefaults() {
  const batchEl = document.getElementById('i18nToolAiBatchSize');
  const intervalEl = document.getElementById('i18nToolAiInterval');
  const promptEl = document.getElementById('i18nToolAiPrompt');
  if (batchEl) {
    const current = parseInt(String(batchEl.value || '').trim(), 10);
    batchEl.value = String(Math.max(20, Math.min(300, Number.isFinite(current) ? current : 120)));
  }
  if (intervalEl) {
    const fromProject = parseInt(
      document.getElementById('intervalRun')?.value
      || document.getElementById('interval')?.value
      || '20',
      10
    ) || 20;
    const current = parseInt(String(intervalEl.value || '').trim(), 10);
    const normalized = Number.isFinite(current) ? current : fromProject;
    intervalEl.value = String(Math.max(1, Math.min(300, normalized)));
  }
  if (promptEl && !String(promptEl.value || '').trim()) {
    promptEl.value = buildI18nToolAiPromptText();
  }
  i18nToolSetAiSendButtonState();
}

function openI18nToolAiModal() {
  const m = document.getElementById('i18nToolAiModal');
  syncI18nToolAiModalDefaults();
  i18nToolRenderAiTokenStats();
  i18nToolSetAiLoadedFileLabel(i18nToolAiSourceFileName || '�');
  const previewEl = document.getElementById('i18nToolAiPreview');
  if (previewEl && !String(previewEl.value || '').trim()) {
    previewEl.value = t('i18nTool.ai.preview.waitingForResponse');
  }
  if (m) m.classList.add('show');
}

function closeI18nToolAiModal() {
  const m = document.getElementById('i18nToolAiModal');
  if (m) m.classList.remove('show');
}

function showPromptEditModal() {
  const modal = document.getElementById('editPromptModal');
  const sysTextarea = document.getElementById('editSystemPrompt');
  const userTextarea = document.getElementById('editUserPrompt');
  const status = document.getElementById('editPromptStatus');
  if (!modal || !sysTextarea || !userTextarea) return;
  sysTextarea.value = getActiveSystemMessage();
  userTextarea.value = enforceSpecialistaFormat(getActiveMainPromptTemplate('batch'));
  if (status) status.textContent = '';
  modal.classList.add('show');
}

function closeEditPromptModal() {
  const modal = document.getElementById('editPromptModal');
  if (modal) modal.classList.remove('show');
}

function restoreDefaultPrompt() {
  localStorage.removeItem('strong_custom_system_prompt');
  setMainPrompt(enforceSpecialistaFormat(getResolvedDefaultPrompt()), 'system');
  updatePromptStatusIndicator();
  const sysTextarea = document.getElementById('editSystemPrompt');
  const userTextarea = document.getElementById('editUserPrompt');
  const status = document.getElementById('editPromptStatus');
  if (sysTextarea) sysTextarea.value = getActiveSystemMessage();
  if (userTextarea) userTextarea.value = enforceSpecialistaFormat(getActiveMainPromptTemplate('batch'));
  if (status) {
    status.textContent = '? Obnoveno výchozí';
    setTimeout(() => { if (status) status.textContent = ''; }, 2000);
  }
}

function saveEditedPrompt() {
  const sysTextarea = document.getElementById('editSystemPrompt');
  const userTextarea = document.getElementById('editUserPrompt');
  const status = document.getElementById('editPromptStatus');
  if (!sysTextarea || !userTextarea) return;
  const sysVal = (sysTextarea.value || '').trim();
  // Strip enforced specialista extra before saving if present
  const extraMatch = userTextarea.value.match(/\n\nPOVINNÝ VÝSTUP NAVÍC[\s\S]*$/i);
  const userVal = extraMatch ? (userTextarea.value.substring(0, extraMatch.index) || '').trim() : (userTextarea.value || '').trim();
  if (!sysVal) {
    if (status) status.textContent = '? Systémový prompt nesmí být prázdný';
    return;
  }
  if (!userVal) {
    if (status) status.textContent = '? Uživatelský prompt nesmí být prázdný';
    return;
  }
  localStorage.setItem('strong_custom_system_prompt', sysVal);
  setMainPrompt(userVal, 'custom');
  updatePromptStatusIndicator();
  closeEditPromptModal();
   showToast('✓ AI prompt uložen');
  }

// Library prompt editor functions
function restoreLibraryPrompts() {
   const sysEl = document.getElementById('librarySystemPrompt');
   const userEl = document.getElementById('libraryUserPrompt');
   const status = document.getElementById('libraryPromptStatus');

    if (!sysEl || !userEl) return;

    // Get current category and index from state
    const category = state.selectedPromptCategory;
    const index = state.selectedPromptIndex;
    
    // Restore based on category
    if (category === 'custom') {
      // For custom category, restore global values (current behavior)
      sysEl.value = getActiveSystemMessage();
      userEl.value = getActiveMainPromptTemplate('batch');
    } else if (category === 'default') {
      // For default category, restore the true original defaults (not from modified library)
      const baseEntry = promptLibraryApi.getPromptLibraryBase()['default']?.[0];
      sysEl.value = baseEntry?.system || getResolvedSystemMessage();
      userEl.value = enforceSpecialistaFormat(baseEntry?.text || getResolvedDefaultPrompt());
    } else {
      // For built-in categories, restore entry from PROMPT_LIBRARY_BASE
      const baseEntry = promptLibraryApi.getPromptLibraryBase()[category]?.[index];
      if (baseEntry) {
        sysEl.value = baseEntry.system || getResolvedSystemMessage();
        userEl.value = baseEntry.text || '';
      } else {
        // Fallback to active values
        sysEl.value = getActiveSystemMessage();
        userEl.value = getActiveMainPromptTemplate('batch');
      }
    }

   if (status) {
     status.textContent = '? Obnoveno výchozí';
     status.style.color = 'var(--grn)';
   }
   setTimeout(() => { if (status) status.textContent = ''; }, 2200);
  }

 function saveLibraryPrompts() {
    const sysEl = document.getElementById('librarySystemPrompt');
    const userEl = document.getElementById('libraryUserPrompt');
    const status = document.getElementById('libraryPromptStatus');

    if (!sysEl || !userEl) return;

    const sysVal = (sysEl.value || '').trim();
    // Strip enforced specialista extra before saving if present (for default category)
    const extraMatch = userEl.value.match(/\n\nPOVINNÝ VÝSTUP NAVÍC[\s\S]*$/i);
    const userVal = extraMatch ? (userEl.value.substring(0, extraMatch.index) || '').trim() : (userEl.value || '').trim();

    if (!sysVal) {
      if (status) { status.textContent = '? Systémový prompt nesmí být prázdný'; status.style.color = 'var(--red)'; }
      return;
    }
    if (!userVal) {
      if (status) { status.textContent = '? Uživatelský prompt nesmí být prázdný'; status.style.color = 'var(--red)'; }
      return;
    }

    // Get current category and index from state
    const category = state.selectedPromptCategory;
    const index = state.selectedPromptIndex;

    // Save based on category
    if (category === 'custom' || category === 'default') {
      // Save to main prompt storage (this is the main translation prompt)
      localStorage.setItem('strong_custom_system_prompt', sysVal);
      setMainPrompt(userVal, 'custom');
      
      // Update the entry in state
      if (state.PROMPT_LIBRARY[category] && state.PROMPT_LIBRARY[category][index]) {
        state.PROMPT_LIBRARY[category][index] = {
          ...state.PROMPT_LIBRARY[category][index],
          system: sysVal,
          text: userVal
        };
      }
    } else {
      // For built-in categories, check if this is a user-added prompt or a built-in one being modified
      const entry = state.PROMPT_LIBRARY[category]?.[index];
      const isUserAdded = entry && window.isUserAddedPrompt && window.isUserAddedPrompt(category, entry.name, entry.text);

      // Update in state
      if (state.PROMPT_LIBRARY[category] && state.PROMPT_LIBRARY[category][index]) {
        state.PROMPT_LIBRARY[category][index] = {
          ...state.PROMPT_LIBRARY[category][index],
          system: sysVal,
          text: userVal
        };
      }

      // Persist to user-added storage
      if (isUserAdded) {
        // If it's an existing user-added prompt, update it
        const userAdded = getStoredUserAddedPrompts();
        if (userAdded[category] && Array.isArray(userAdded[category])) {
          const userIdx = userAdded[category].findIndex(p => p.text === entry.text && p.name === entry.name);
          if (userIdx >= 0) {
            userAdded[category][userIdx] = {
              ...userAdded[category][userIdx],
              system: sysVal,
              text: userVal
            };
            saveStoredUserAddedPrompts(userAdded);
          }
        }
      } else {
        // For built-in prompts, save as a new user-added prompt
        const userAdded = getStoredUserAddedPrompts();
        if (!userAdded[category]) userAdded[category] = [];
        
        // Check for duplicate by text
        const exists = userAdded[category].some(p => p.text === userVal);
        if (!exists) {
          userAdded[category].push({
            name: entry?.name || 'Uživatelský prompt',
            desc: entry?.desc || '',
            text: userVal,
            system: sysVal
          });
          saveStoredUserAddedPrompts(userAdded);
        } else {
          // Update existing
          const existingIdx = userAdded[category].findIndex(p => p.text === userVal);
          if (existingIdx >= 0) {
            userAdded[category][existingIdx] = {
              ...userAdded[category][existingIdx],
              system: sysVal,
              text: userVal
            };
            saveStoredUserAddedPrompts(userAdded);
          }
        }
      }
    }

    // Update UI
    updatePromptStatusIndicator();
    renderPromptList();

    if (status) {
      status.textContent = 'Uloženo';
      status.style.color = 'var(--grn)';
    }
    showToast('✓ Prompt uložen');

    setTimeout(() => { if (status) status.textContent = ''; }, 2000);
  }

// Delete custom prompts with confirmation
function confirmClearLibraryPrompts() {
  if (!confirm('Opravdu chcete vymazat uložené uživatelské prompty? Tato akce je nevratná.')) return;
  clearLibraryPrompts();
}

function clearLibraryPrompts() {
   // Reset to defaults � clears custom system prompt, restores main prompt to system default
   restoreDefaultPrompt();
   
   // Clear storage keys as per plan
   localStorage.removeItem('strong_custom_system_prompt');
   localStorage.removeItem('strong_prompt');
   localStorage.removeItem('strong_prompt_mode'); // optional, reset to 'system'
   localStorage.removeItem('strong_prompt_library_custom'); // clear custom entries
   
   // Refresh library editors
   const sysEl = document.getElementById('librarySystemPrompt');
   const userEl = document.getElementById('libraryUserPrompt');
   if (sysEl) sysEl.value = getActiveSystemMessage();
   if (userEl) userEl.value = getActiveMainPromptTemplate('batch');
   
   // Reset custom library state
   if (state.PROMPT_LIBRARY) {
     state.PROMPT_LIBRARY.custom = [];
   }
   
   showToast('✓ Uživatelské prompty byly vymazány');
 }

function onI18nToolEditorLangChange() {
  const select = document.getElementById('i18nToolEditorLang');
  const text = document.getElementById('i18nToolEditorText');
  if (!select || !text) return;
  const lang = String(select.value || '');
  const json = i18nToolTranslatedJsonByLang[lang];
  if (!json) {
    text.value = '';
    return;
  }
  const flat = i18nToolFlattenStringLeaves(json);
  const keys = Object.keys(flat).sort((a, b) => a.localeCompare(b, 'cs'));
  text.value = keys.map((k) => `${k}\t${JSON.stringify(flat[k])}`).join('\n');
}

function saveI18nToolOutputEditor() {
  const select = document.getElementById('i18nToolEditorLang');
  const text = document.getElementById('i18nToolEditorText');
  if (!select || !text) return;
  const lang = String(select.value || '');
  const base = i18nToolTranslatedJsonByLang[lang];
  if (!base) {
    showToast(t('i18nTool.editor.outputMissing'));
    return;
  }
  const updated = typeof structuredClone === 'function'
    ? structuredClone(base)
    : JSON.parse(JSON.stringify(base));
  const originalFlat = i18nToolFlattenStringLeaves(base);
  const validKeys = new Set(Object.keys(originalFlat));

  const lines = String(text.value || '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const tabIdx = line.indexOf('\t');
    if (tabIdx <= 0) continue;
    const key = line.slice(0, tabIdx).trim();
    if (!validKeys.has(key)) continue;
    const rawVal = line.slice(tabIdx + 1).trim();
    let parsedVal = rawVal;
    try { parsedVal = JSON.parse(rawVal); } catch {}
    i18nToolSetByPath(updated, key, String(parsedVal));
  }

  i18nToolTranslatedJsonByLang[lang] = updated;
  i18nToolTranslatedTextByLang[lang] = JSON.stringify(updated, null, 2);
  i18nToolDownloadFile(i18nToolTranslatedTextByLang[lang], `${lang}.json`);
  showToast(t('i18nTool.editor.saved', { file: `${lang}.json` }));
}

async function runI18nToolBrowserTranslate() {
  try {
    i18nToolRunning = true;
    i18nToolMinimizedDuringRun = false;
    i18nToolCancelRequested = false;
    i18nToolStrictFallbackCount = 0;
    if (!i18nToolSelectedLanguages.size) {
      showToast(t('i18nTool.toast.selectTargetFirst'));
      i18nToolRunning = false;
      return;
    }
    const sourceData = await loadI18nToolSourceCsData();
    const selected = I18N_TOOL_LANGUAGES.filter((lang) => i18nToolSelectedLanguages.has(lang.code));
    const progressWrap = document.getElementById('i18nToolProgressWrap');
    const progressFill = document.getElementById('i18nToolProgressFill');
    const status = document.getElementById('i18nToolStatus');
    const downloads = document.getElementById('i18nToolDownloads');
    const etaEl = document.getElementById('i18nToolEta');
    const runBtn = document.getElementById('btnI18nToolRunBrowser');
    const cancelBtn = document.getElementById('btnI18nToolCancelBrowser');
    if (runBtn) runBtn.disabled = true;
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-block';
      cancelBtn.disabled = false;
    }
    if (progressWrap) progressWrap.style.display = 'block';
    if (status) {
      status.style.display = 'block';
      status.textContent = t('i18nTool.status.starting');
    }
    if (etaEl) {
      etaEl.style.display = 'block';
      etaEl.textContent = t('i18nTool.eta.calculating');
    }
    i18nToolStartRunAnimation();
    if (downloads) {
      downloads.style.display = 'none';
      downloads.innerHTML = '';
    }
    const perLangUnits = i18nToolCountTranslatableStrings(sourceData);
    const totalUnits = Math.max(1, perLangUnits * selected.length);
    let doneUnits = 0;
    const startedAtMs = Date.now();
    const translatedFiles = {};
    const placeholderAuditByLang = {};
    for (const lang of selected) {
      if (i18nToolCancelRequested) throw new Error(I18N_TOOL_CANCELLED_ERROR);
      if (status) status.textContent = t('i18nTool.status.translatingTo', { name: lang.name, code: lang.code });
      const translated = await i18nToolTranslateValue(
        sourceData,
        lang.code,
        lang.tag,
        lang.name,
        (path) => {
          doneUnits++;
          const percent = Math.round((doneUnits / totalUnits) * 100);
          const elapsedSec = Math.max(1, (Date.now() - startedAtMs) / 1000);
          const rate = doneUnits / elapsedSec;
          const remain = Math.max(0, totalUnits - doneUnits);
          const etaSec = rate > 0 ? (remain / rate) : 0;
          if (progressFill) {
            progressFill.style.width = `${percent}%`;
            progressFill.textContent = `${percent}%`;
          }
          if (etaEl) {
            etaEl.style.display = 'block';
            etaEl.textContent = t('i18nTool.eta.progress', {
              eta: i18nToolFormatEta(etaSec),
              done: doneUnits,
              total: totalUnits
            });
          }
          if (status && (doneUnits % 25 === 0 || doneUnits === totalUnits)) {
            status.textContent = t('i18nTool.status.translatingProgress', {
              name: lang.name,
              code: lang.code,
              done: doneUnits,
              total: totalUnits,
              path: path ? ` | ${path}` : ''
            });
          }
        }
      );
      if (translated && typeof translated === 'object' && 'topic.langTag' in translated) {
        translated['topic.langTag'] = lang.tag;
      }
      placeholderAuditByLang[lang.code] = i18nToolCollectPlaceholderMismatches(sourceData, translated);
      translatedFiles[lang.code] = JSON.stringify(translated, null, 2);
      i18nToolTranslatedJsonByLang[lang.code] = translated;
      i18nToolTranslatedTextByLang[lang.code] = translatedFiles[lang.code];
      // Download each language immediately after it is finished.
      i18nToolDownloadFile(translatedFiles[lang.code], `${lang.code}.json`);
    }
    const placeholderIssues = Object.entries(placeholderAuditByLang)
      .filter(([, issues]) => issues.length > 0);
    const placeholderIssueCount = placeholderIssues.reduce((sum, [, issues]) => sum + issues.length, 0);
    if (status) {
      if (placeholderIssues.length) {
        const byLangText = placeholderIssues
          .map(([code, issues]) => `${code}: ${issues.length}`)
          .join(', ');
        status.textContent = t('i18nTool.status.doneWithPlaceholderIssues', {
          count: placeholderIssueCount,
          byLang: byLangText,
          fallback: i18nToolStrictFallbackCount
        });
      } else {
        status.textContent = t('i18nTool.status.doneSuccess', {
          count: selected.length,
          fallback: i18nToolStrictFallbackCount
        });
      }
    }
    if (etaEl) etaEl.textContent = t('i18nTool.eta.done');
    i18nToolStopRunAnimation(t('i18nTool.animation.done'));
    if (placeholderIssues.length) {
    }
    if (downloads) {
      downloads.style.display = 'grid';
      selected.forEach((lang) => {
        const btn = document.createElement('button');
        btn.className = 'prompt-btn ok';
        btn.type = 'button';
        btn.textContent = `${lang.flag} ${lang.code}.json`;
        btn.onclick = () => i18nToolDownloadFile(translatedFiles[lang.code], `${lang.code}.json`);
        downloads.appendChild(btn);
      });
    }
    const editBtn = document.getElementById('btnI18nToolEditOutput');
    if (editBtn) editBtn.disabled = false;
    showToast(t('i18nTool.toast.doneWithFallback', {
      count: selected.length,
      fallback: i18nToolStrictFallbackCount
    }));
    if (i18nToolMinimizedDuringRun) {
      const doneText = document.getElementById('i18nToolDoneText');
      if (doneText) {
        doneText.textContent = t('i18nTool.done.text.withStats', {
          count: selected.length,
          fallback: i18nToolStrictFallbackCount
        });
      }
      const doneModal = document.getElementById('i18nToolDoneModal');
      if (doneModal) doneModal.classList.add('show');
    }
  } catch (e) {
    const status = document.getElementById('i18nToolStatus');
    const etaEl = document.getElementById('i18nToolEta');
    if (String(e?.message || '') === I18N_TOOL_CANCELLED_ERROR) {
      if (status) {
        status.style.display = 'block';
        status.textContent = t('i18nTool.status.cancelledByUser');
      }
      if (etaEl) etaEl.textContent = t('i18nTool.eta.stopped');
      i18nToolStopRunAnimation(t('i18nTool.animation.stopped'));
      showToast(t('i18nTool.toast.cancelled'));
    } else {
      if (status) {
        status.style.display = 'block';
        status.textContent = t('i18nTool.status.error', { message: e?.message || String(e) });
      }
      if (etaEl) etaEl.textContent = t('i18nTool.eta.error');
      i18nToolStopRunAnimation(t('i18nTool.animation.failed'));
      showToast(t('i18nTool.toast.error', { message: e?.message || String(e) }));
    }
  } finally {
    i18nToolRunning = false;
    i18nToolCancelRequested = false;
    const runBtn = document.getElementById('btnI18nToolRunBrowser');
    const cancelBtn = document.getElementById('btnI18nToolCancelBrowser');
    if (runBtn) runBtn.disabled = false;
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.style.display = 'none';
    }
  }
}
window.showI18nToolModal = showI18nToolModal;
window.closeI18nToolModal = closeI18nToolModal;
window.openI18nToolLangModal = openI18nToolLangModal;
window.closeI18nToolLangModal = closeI18nToolLangModal;
window.toggleI18nToolLanguage = toggleI18nToolLanguage;
window.i18nToolSelectAllLangs = i18nToolSelectAllLangs;
window.i18nToolDeselectAllLangs = i18nToolDeselectAllLangs;
window.filterI18nToolLanguages = filterI18nToolLanguages;
window.copyI18nToolCmd = copyI18nToolCmd;
window.openI18nToolHelpModal = openI18nToolHelpModal;
window.closeI18nToolHelpModal = closeI18nToolHelpModal;
window.runI18nToolBrowserTranslate = runI18nToolBrowserTranslate;
window.cancelI18nToolBrowserTranslate = cancelI18nToolBrowserTranslate;
window.minimizeI18nToolModal = minimizeI18nToolModal;
window.closeI18nToolDoneModal = closeI18nToolDoneModal;
window.reopenI18nToolModalAfterDone = reopenI18nToolModalAfterDone;
window.openI18nToolOutputEditor = openI18nToolOutputEditor;
window.closeI18nToolOutputEditor = closeI18nToolOutputEditor;
window.openI18nToolEditorHelpModal = openI18nToolEditorHelpModal;
window.closeI18nToolEditorHelpModal = closeI18nToolEditorHelpModal;
window.onI18nToolEditorLangChange = onI18nToolEditorLangChange;
window.saveI18nToolOutputEditor = saveI18nToolOutputEditor;
window.openI18nToolLoadJsonPicker = openI18nToolLoadJsonPicker;
window.loadI18nToolJsonForEditFromFile = loadI18nToolJsonForEditFromFile;
window.openI18nToolAiModal = openI18nToolAiModal;
window.closeI18nToolAiModal = closeI18nToolAiModal;
window.openI18nToolAiJsonPicker = openI18nToolAiJsonPicker;
window.loadI18nToolAiJsonFromFile = loadI18nToolAiJsonFromFile;
window.buildI18nToolAiPrompt = buildI18nToolAiPrompt;
window.sendI18nToolAiPrompt = sendI18nToolAiPrompt;
window.resumeI18nToolAiPrompt = resumeI18nToolAiPrompt;
window.applyI18nToolAiResponse = applyI18nToolAiResponse;
window.downloadI18nToolAiResult = downloadI18nToolAiResult;

// -- RESIZE PANELS (logika v ./ui/resize.js) ---------------------


// Toast s akcn�m tlac�tkem (napr. Undo). Vydr�� 2� d�le.


const { download, exportTXT, exportJSON, exportRange, exportAllLocalStorage } = createExportApi({
   state,
   t,
   showToast
 });

 function log(msg) {
   const el = document.getElementById('autoLog');
   if (el) el.textContent = msg;
   
   // Also log to console
 }

function logTokenEntry(provider, inT, outT, total) {
   if (provider === 'groq') {
     state.groqTokens.in += inT;
     state.groqTokens.out += outT;
     state.groqTokens.total += total;
   }
   // Update total tokens for all providers (used elsewhere)
   state.totalTokens.in += inT;
   state.totalTokens.out += outT;
   state.totalTokens.total += total;
   refreshTokenStatsDisplay();

   if (state.autoRunning && isAutoTokenLimitReached()) {
     stopAuto();
     log(t('auto.log.stoppedTokenLimit'));
     showToast(t('toast.auto.stoppedTokenLimit'));
   }
 }

// Preview modal pro hromadny preklad

window.closePreviewModalSafe = closePreviewModalSafe;
window.closeFailedModalSafe = closeFailedModalSafe;
window.showLimitsModal = showLimitsModal;
window.closeLimitsModal = closeLimitsModal;
window.showHelpModal = showHelpModal;
window.closeHelpModal = closeHelpModal;
window.showBadTranslationsModal = showBadTranslationsModal;
window.closeBadTranslationsModal = closeBadTranslationsModal;
window.filterBadTranslations = filterBadTranslations;
window.toggleAllPreview = toggleAllPreview;
window.acceptPreview = acceptPreview;
window.discardPreview = discardPreview;
window.importFile = importFile;
window.importTXT = importTXT;
window.showFailedEntries = showFailedEntries;
window.retryFailed = retryFailed;
window.closeTopicRepairModalSafe = closeTopicRepairModalSafe;
window.toggleEditSection = toggleEditSection;
window.saveSection = saveSection;
window.toggleSourceEntryEdit = toggleSourceEntryEdit;
window.saveSourceEntryField = saveSourceEntryField;
window.refillSingleField = refillSingleField;
window.openTopicPromptModal = openTopicPromptModal;
window.runTopicPromptAI = runTopicPromptAI;
window.applyTopicPromptResult = applyTopicPromptResult;
window.closeTopicPromptModal = closeTopicPromptModal;

// Settings modals + API keys + backup exposures
window.showSettingsModal = showSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.updatePromptLangButtonLabel = updatePromptLangButtonLabel;
window.saveApiKey = saveApiKey;
window.setupApiKeySwitcher = setupApiKeySwitcher;
window.onApiKeyProfileChange = onApiKeyProfileChange;
window.saveCurrentApiKeyAsProfile = saveCurrentApiKeyAsProfile;
window.deleteApiKeyProfile = deleteApiKeyProfile;
window.clearProgress = clearProgress;
window.restoreFromBackup = restoreFromBackup;
window.updateSetupCompactSummary = updateSetupCompactSummary;

function clearModelTestOutput() {
  const output = document.getElementById('modelTestOutput');
  if (!output) return;
  output.value = '';
  state.modelTestOutputBackupBeforeLibrary = '';
  state.modelTestLibraryActive = false;
  clearModelTestOutputFromStorage();
  showToast(t('toast.output.cleared'));
}

async function copyModelTestOutput() {
  const output = document.getElementById('modelTestOutput');
  const btn = document.getElementById('btnCopyModelTestOutput');
  const originalBtnText = btn?.textContent || '';
  if (!output) return;
  const text = output.value || '';
  if (!text.trim()) { showToast(t('toast.copy.nothing')); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('toast.output.copied'));
    if (btn) { btn.textContent = t('toast.output.copiedShort'); setTimeout(() => { btn.textContent = originalBtnText; }, 1200); }
  } catch (e) {
    output.focus(); output.select(); document.execCommand('copy');
    showToast(t('toast.output.copied'));
    if (btn) { btn.textContent = t('toast.output.copiedShort'); setTimeout(() => { btn.textContent = originalBtnText; }, 1200); }
  }
}

function showModelTestLibrary() {
  const output = document.getElementById('modelTestOutput');
  if (!output) return;
  if (state.modelTestRunning) { showToast(t('toast.test.libraryAfterStop')); return; }
  if (!state.modelTestLibraryActive) state.modelTestOutputBackupBeforeLibrary = output.value;
  state.modelTestLibraryActive = true;
  const history = getTestHistory();
  if (!history.length) { output.value = t('modelTest.library.empty'); return; }
  const lines = [t('modelTest.library.title'), `${t('modelTest.library.count')}: ${history.length}`, ''];
  const statsRows = Object.values(getModelTestStatsMap());
  if (statsRows.length) {
    lines.push(t('modelTest.library.statsHeader'));
    const providers = {};
    for (const r of statsRows) { if (!providers[r.provider]) providers[r.provider] = []; providers[r.provider].push(r); }
    for (const providerName of Object.keys(providers).sort((a, b) => a.localeCompare(b, 'cs'))) {
      lines.push(`### ${providerName}`);
      for (const r of providers[providerName].sort((a, b) => (b.calls||0)-(a.calls||0))) {
        const total = Math.max(1, (r.okKeys||0)+(r.failedKeys||0));
        const rate = (((r.okKeys||0)/total)*100).toFixed(1);
        const avgMs = r.latencySamples ? (r.latencyMsTotal/r.latencySamples) : 0;
        lines.push(`- ${r.model} | ${r.calls||0} vol�n� | ${r.totalKeys||0} hesel | OK ${r.okKeys||0} | ERR ${r.failedKeys||0} | ${rate}% | ${formatAiResponseTime(avgMs)}`);
      }
      lines.push('');
    }
  }
  lines.push(t('modelTest.library.runsHeader'));
  for (const item of history.slice(0, 80)) {
    const when = new Date(item.ts).toLocaleString('cs-CZ');
    if (item.type === 'model-test') {
      lines.push(`[${when}] TEST | ${item.provider} | ${item.mode||'smoke'} | OK ${item.ok}/${item.total} | PART ${item.partial||0} | RL ${item.rateLimited} | ERR ${item.error} | HESLA ${item.keysOk||0}/${item.keysFailed||0} | AI ${formatAiResponseTime(item.avgLatencyMs||0)}`);
      if (Array.isArray(item.topModels)&&item.topModels.length) lines.push(`TOP: ${item.topModels.join(', ')}`);
    } else if (item.type === 'translate-batch') {
      lines.push(`[${when}] BATCH | ${item.provider}/${item.model} | ${item.ok}/${item.total} | missing ${item.missing} | AI ${formatAiResponseTime(item.avgLatencyMs||0)}`);
    }
  }
  output.value = lines.join('\n');
  saveModelTestOutputToStorage(output.value);
}

async function runModelTestFromModal() {
  if (state.modelTestRunning) { cancelModelTest(); showToast(t('toast.test.pausing')); return; }
  restoreModelTestReportFromBackup();
  scrollModelTestOutputIntoView();
  const providerSelect = document.getElementById('modelTestProvider');
  const modeSelect = document.getElementById('modelTestMode');
  const promptEnableEl = document.getElementById('modelTestEnablePrompt');
  const promptTypeSelect = document.getElementById('modelTestPromptType');
  if (!providerSelect) return;
  saveModelTestPromptSettings();
  saveModelTestModelSelections();
  const mode = modeSelect?.value || 'smoke';
  const promptEnabled = !!promptEnableEl?.checked;
  const promptType = promptTypeSelect?.value || getModelTestPromptType();
  const providerMode = providerSelect.value || 'parallel-3';
  const forcedProvider = providerMode === 'parallel-3' ? null : providerMode;
  updateModelTestRunButton();
  await testCurrentProviderModels(forcedProvider, false, mode, promptType, promptEnabled);
}


window.openModelTestModal = openModelTestModal;
window.runModelTestFromModal = runModelTestFromModal;
window.showModelTestLibrary = showModelTestLibrary;
window.clearModelTestOutput = clearModelTestOutput;
window.copyModelTestOutput = copyModelTestOutput;
window.saveModelTestOutputTxt = saveModelTestOutputTxt;
window.saveModelTestRawOutputTxt = saveModelTestRawOutputTxt;
window.loadModelTestOutputFromFile = loadModelTestOutputFromFile;
window.exportModelTestTranslationsTxt = exportModelTestTranslationsTxt;
window.clearLog = clearLog;
window.logEntry = logEntry;

// Funkce pro vymaz�n� v�ech p?eklad? z localStorage (v�echny sloty)
function clearTranslations() {
  if (!confirm(t('confirm.clearTranslations'))) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith('strong_gr_cz_v3_'))
    .forEach(k => localStorage.removeItem(k));
  state.translated = {};
  state.sourceEntryEdits = {};
  updateStats();
  renderList();
  clearLog();
  const pane = document.getElementById('detailPane');
  if (pane) pane.innerHTML = `<div class="detail-empty">${t('detail.empty')}</div>`;
  showToast(t('toast.translationsCleared'));
}

window.clearTranslations = clearTranslations;

/**
 * Automaticky doplní všechny chybějící témata pro jedno heslo.
 * Odešle AI batch prompt, zpracuje odpověď a uloží výsledek.
 */
async function fillAllTopics(key) {
  const entry = state.entryMap.get(key);
  if (!entry) {
    showToast(t('toast.entry.notFound'));
    return;
  }

  // Kontrola, zda jsou všechna témata již přeložena
  const tr = state.translated[key];
  if (isTranslationComplete(tr || {})) {
    showToast(t('toast.allTranslated'));
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

  try {
    const messages = buildPromptMessages([entry]);
    const raw = await callAIWithRetry(prov, apiKey, model, messages);
    const content = raw?.content || '';

    // Najdi blok pro current key: ###G1234### ... ###G...### nebo konec
    const keyRegex = new RegExp(`###\\s*${key}\\s*###`);
    const match = content.match(keyRegex);
    if (!match) {
      showToast(t('toast.aiResponse.unmatched'));
      return;
    }

    const start = match.index + match[0].length;
    // Najdi začátek dalšího bloku ###...### (jiného klíče), pokud existuje
    const rest = content.slice(start);
    const nextBlockMatch = rest.match(/###\s*[GH]\d+\s*###/);
    const end = nextBlockMatch ? start + nextBlockMatch.index : content.length;
    const blockText = content.slice(start, end).trim();

    // Parsování řádků V:, D:, P:, K:, S:
    const entryData = {};
    const lines = blockText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('V:')) entryData.vyznam = trimmed.slice(2).trim();
      else if (trimmed.startsWith('D:')) entryData.definice = trimmed.slice(2).trim();
      else if (trimmed.startsWith('P:')) entryData.puvod = trimmed.slice(2).trim();
      else if (trimmed.startsWith('K:')) entryData.kjv = trimmed.slice(2).trim();
      else if (trimmed.startsWith('S:')) entryData.specialista = trimmed.slice(2).trim();
    }

    if (Object.keys(entryData).length === 0) {
      showToast(t('toast.aiResponse.unmatched'));
      return;
    }

    state.translated[key] = { ...(state.translated[key] || {}), ...entryData, raw: content };
    fillMissingVyznamFromSource([key]);
    fillMissingKjvFromSource([key]);
    annotateEnglishDefinitionsInTranslated([key]);
    saveProgress();
    renderList();
    updateStats();
    if (state.activeKey === key) {
      renderDetail();
    }
    showToast(t('toast.translatedSystem.key', { key }));
  } catch (e) {
    console.error('fillAllTopics error:', e);
    showToast(t('toast.error.withMessage', { message: e.message }));
  }
}

// Expose for debugging
window.PROVIDERS = PROVIDERS;
window.populateOpenRouterModels = populateOpenRouterModels;

// Funkce definovane primo v main.js (ES module - musi byt na window)
window.startApp = startApp;
window.loadTXT = loadTXT;
window.loadDefaultFile = loadDefaultFile;
window.filterList = filterList;
window.filterListDebounced = filterListDebounced;
window.applyAutoPanelSettings = applyAutoPanelSettings;
window.onProviderChange = onProviderChange;
window.showSetup = showSetup;
window.toggleListPane = toggleListPane;
window.toggleAutoPanel = function() {
  document.getElementById('autoPanel')?.classList.toggle('show');
};
window.copyModelTestPromptPreview = copyModelTestPromptPreview;
window.resetModelTestPromptPreview = resetModelTestPromptPreview;

// Z batchApi
window.translateNext = translateNext;
window.translateSingle = translateSingle;
window.retranslateSingle = retranslateSingle;
window.jumpToStart = jumpToStart;

// Z listApi
window.translateSelected = translateSelected;
window.toggleSelect = toggleSelect;
window.selectAll = selectAll;
window.selectNone = selectNone;
window.filterMissingTopicsList = filterMissingTopicsList;

// Z modalsApi
window.selectRange = selectRange;
window.showMobileActions = showMobileActions;
window.closeMobileModal = closeMobileModal;

// Z autoApi
window.toggleAuto = toggleAuto;
window.stopAuto = stopAuto;

// Z topicRepairApi
window.startTopicRepairFlow = startTopicRepairFlow;
window.closeTopicRepairModalSafe = closeTopicRepairModalSafe;
window.stopTopicRepairTicker = stopTopicRepairTicker;
window.applyTopicRepairProviderCheckboxes = applyTopicRepairProviderCheckboxes;
window.setTopicRepairStrategy = setTopicRepairStrategy;
window.startTopicRepairSequentialWorker = startTopicRepairSequentialWorker;
window.toggleTopicRepairTask = toggleTopicRepairTask;
window.toggleTopicRepairRun = toggleTopicRepairRun;
window.setTopicRepairSpecialistaDecision = setTopicRepairSpecialistaDecision;
window.setTopicRepairDetectedTopicDecision = setTopicRepairDetectedTopicDecision;
window.applyTopicRepairSelected = applyTopicRepairSelected;
window.closeTopicRepairModalOnly = closeTopicRepairModalOnly;
window.minimizeTopicRepairModal = minimizeTopicRepairModal;
window.restoreTopicRepairModal = restoreTopicRepairModal;
window.toggleShowApproved = toggleShowApproved;
window.saveTopicRepairBatchPromptDraft = saveTopicRepairBatchPromptDraft;
window.resetTopicRepairBatchPromptToDefault = resetTopicRepairBatchPromptToDefault;
window.refreshTopicRepairBatchPromptEditor = refreshTopicRepairBatchPromptEditor;
window.toggleTopicRepairBulkListFilter = toggleTopicRepairBulkListFilter;
window.syncTopicRepairBulkRunInputsToHidden = syncTopicRepairBulkRunInputsToHidden;
window.runTopicRepairBulkTranslation = runTopicRepairBulkTranslation;
window.toggleTopicRepairBulkInclude = toggleTopicRepairBulkInclude;
window.setTopicRepairBulkIncludeAll = setTopicRepairBulkIncludeAll;
window.setTopicRepairProviderTopic = setTopicRepairProviderTopic;
window.getTopicPromptTemplateByPromptType = getTopicPromptTemplateByPromptType;
window.syncTopicPromptTemplatesReport = syncTopicPromptTemplatesReport;
window.buildTopicPrompt = buildTopicPrompt;
window.openTopicPromptModal = openTopicPromptModal;
window.runTopicPromptAI = runTopicPromptAI;
window.applyTopicPromptResult = applyTopicPromptResult;
window.shouldReplaceSpecialista = shouldReplaceSpecialista;
window.closeTopicPromptModal = closeTopicPromptModal;
window.openSystemPromptModal = openSystemPromptModal;
window.runSystemPromptAI = runSystemPromptAI;
window.runSystemPromptConfirm = runSystemPromptConfirm;
window.closeSystemPromptModal = closeSystemPromptModal;
window.translateSystemPromptText = translateSystemPromptText;
window.toggleTopicRepairManualApproval = toggleTopicRepairManualApproval;
window.translateSystemPromptBackToEnglish = translateSystemPromptBackToEnglish;
window.reviewSystemPromptWithAI = reviewSystemPromptWithAI;
window.buildSystemPromptFromRequirement = buildSystemPromptFromRequirement;
window.extractTopicValueFromAI = extractTopicValueFromAI;
window.applySystemPromptForCurrentTask = applySystemPromptForCurrentTask;
window.syncTopicPromptTemplatesReport = syncTopicPromptTemplatesReport;
window.buildTopicPrompt = buildTopicPrompt;
window.openTopicPromptModal = openTopicPromptModal;
window.runTopicPromptAI = runTopicPromptAI;
window.applyTopicPromptResult = applyTopicPromptResult;
window.shouldReplaceSpecialista = shouldReplaceSpecialista;
window.closeTopicPromptModal = closeTopicPromptModal;
window.openSystemPromptModal = openSystemPromptModal;
window.runSystemPromptAI = runSystemPromptAI;
window.runSystemPromptConfirm = runSystemPromptConfirm;
window.closeSystemPromptModal = closeSystemPromptModal;
window.translateSystemPromptText = translateSystemPromptText;
window.translateSystemPromptBackToEnglish = translateSystemPromptBackToEnglish;
window.reviewSystemPromptWithAI = reviewSystemPromptWithAI;
window.buildSystemPromptFromRequirement = buildSystemPromptFromRequirement;
window.extractTopicValueFromAI = extractTopicValueFromAI;
window.applySystemPromptForCurrentTask = applySystemPromptForCurrentTask;
window.setTopicRepairStrategy = setTopicRepairStrategy;
window.refreshTopicRepairBatchPromptEditor = refreshTopicRepairBatchPromptEditor;
window.startTopicRepairSequentialWorker = startTopicRepairSequentialWorker;
window.toggleTopicRepairTask = toggleTopicRepairTask;
window.toggleTopicRepairRun = toggleTopicRepairRun;
window.setTopicRepairSpecialistaDecision = setTopicRepairSpecialistaDecision;
window.setTopicRepairDetectedTopicDecision = setTopicRepairDetectedTopicDecision;
window.applyTopicRepairSelected = applyTopicRepairSelected;
window.closeTopicRepairModalOnly = closeTopicRepairModalOnly;
window.minimizeTopicRepairModal = minimizeTopicRepairModal;
window.saveTopicRepairBatchPromptDraft = saveTopicRepairBatchPromptDraft;
window.resetTopicRepairBatchPromptToDefault = resetTopicRepairBatchPromptToDefault;
window.toggleTopicRepairBulkListFilter = toggleTopicRepairBulkListFilter;
window.syncTopicRepairBulkRunInputsToHidden = syncTopicRepairBulkRunInputsToHidden;
window.runTopicRepairBulkTranslation = runTopicRepairBulkTranslation;
window.toggleTopicRepairBulkInclude = toggleTopicRepairBulkInclude;
window.setTopicRepairBulkIncludeAll = setTopicRepairBulkIncludeAll;
window.setTopicRepairProviderTopic = setTopicRepairProviderTopic;
window.fillAllTopics = fillAllTopics;
window.getActiveKey = () => state.activeKey;

// Z modelTestUiApi
window.cancelModelTest = cancelModelTest;

// Z modelTestOutputApi
window.resetModelTestModal = resetModelTestModal;

// Z settingsApi
window.saveModelTestModelSelections = saveModelTestModelSelections;
window.updateModelTestProviderUi = updateModelTestProviderUi;

// Z promptLibraryApi
window.togglePromptAutoMode = togglePromptAutoMode;
window.togglePromptModeQuick = togglePromptModeQuick;

// DevTools console panel
(function initDevTools() {
  const COLORS = { log: '#ccc', warn: '#f0c040', error: '#ff6060', info: '#6ab0f5' };
  const _orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };

  function appendEntry(level, args) {
    const panel = document.getElementById('devToolsLog');
    if (!panel) return;
    const line = document.createElement('div');
    line.style.cssText = `color:${COLORS[level]};border-bottom:1px solid #1e1e1e;padding:2px 0;word-break:break-all`;
    const time = new Date().toLocaleTimeString('cs-CZ', { hour12: false });
    const prefix = level === 'log' ? '' : `[${level.toUpperCase()}] `;
    line.textContent = `${time} ${prefix}${args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
    }).join(' ')}`;
    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;
  }

  ['log', 'warn', 'error', 'info'].forEach(lvl => {
    console[lvl] = (...args) => { _orig[lvl](...args); appendEntry(lvl, args); };
  });

  window.addEventListener('error', e => appendEntry('error', [e.message, e.filename + ':' + e.lineno]));
  window.addEventListener('unhandledrejection', e => appendEntry('error', ['Unhandled:', String(e.reason)]));
})();

window.toggleDevTools = function() {
  const panel = document.getElementById('devToolsPanel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'flex';
};

window.clearDevTools = function() {
  const log = document.getElementById('devToolsLog');
  if (log) log.innerHTML = '';
};

// Prompt edit modal
window.showPromptEditModal = showPromptEditModal;
window.closeEditPromptModal = closeEditPromptModal;
window.restoreDefaultPrompt = restoreDefaultPrompt;
window.saveEditedPrompt = saveEditedPrompt;

// Prompt library dual editor
window.restoreLibraryPrompts = restoreLibraryPrompts;
window.saveLibraryPrompts = saveLibraryPrompts;
window.confirmClearLibraryPrompts = confirmClearLibraryPrompts;

// Z exportDataApi
window.exportTXT = exportTXT;
window.exportJSON = exportJSON;
window.exportRange = exportRange;
window.exportAllLocalStorage = exportAllLocalStorage;
window.cleanupOldBackups = cleanupOldBackups;

// Bad translations
window.exportBadTranslationsJSON = exportBadTranslationsJSON;

// Z modalsApi + modelTestUiApi + main.js funkce
window.closeModal = closeModal;
window.confirmModal = confirmModal;
window.closeModelTestModal = closeModelTestModal;
window.openModelTestPromptPreviewModal = openModelTestPromptPreviewModal;
window.closeModelTestPromptPreviewModal = closeModelTestPromptPreviewModal;
window.printRecentAICalls = printRecentAICalls;

// Recent AI calls debugging utility
function printRecentAICalls() {
  const calls = getRecentAICalls();
  if (!calls.length) {
    console.log('No recent AI calls recorded yet.');
    return;
  }
  console.groupCollapsed(`?? Recent AI Calls: ${calls.length}`);
  calls.forEach((call, i) => {
    console.groupCollapsed(`#${calls.length - i}: ${call.type} � ${call.provider} | ${call.model} � ${call.durationMs}ms`);
    if (call.error) {
      console.log('%c? Error:', 'color: #ff0000; font-weight: bold;', call.error);
    } else {
      if (call.messages && call.messages.length) {
        console.log('%c?? Prompt(s):', 'color: #0066cc; font-weight: bold;');
        call.messages.forEach((msg) => {
         const preview = String(msg.content || '').replace(/\n/g, '\n    ');
         console.log(
           `  ${msg.role.toUpperCase()}:`,
           `\n    ${preview}`
         );
       });
     }
     if (call.response) {
       const preview = String(call.response).replace(/\n/g, '\n    ');
       console.log('%c?? AI Response:', 'color: #cc6600; font-weight: bold;',
         `\n    ${preview}`);
     }
      if (call.usage) {
        const inT = call.usage.prompt_tokens || call.usage.promptTokenCount || call.usage.input_tokens || 0;
        const outT = call.usage.completion_tokens || call.usage.candidatesTokenCount || call.usage.output_tokens || 0;
        const total = call.usage.total_tokens || (inT + outT) || 0;
        console.log('%c?? Token Usage:', 'color: #aa00aa; font-weight: bold;',
          ` Input: ${inT} | Output: ${outT} | Total: ${total}`);
      }
    }
    console.groupEnd();
  });
  console.groupEnd();
}

 // Print recent AI calls to console for debugging
 window.printRecentAICalls = printRecentAICalls;

 // Open topic repair modal for all missing topics
 function startTopicRepairFlowForMissing() {
   const keys = Object.keys(state.translated).filter(key => getState(key) === 'missing_topic');
   if (!keys.length) {
     showToast(t('toast.topicRepair.noEligible'));
     return;
   }
   startTopicRepairFlow(keys);
 }
 window.startTopicRepairFlowForMissing = startTopicRepairFlowForMissing;

  // Cleanup on page unload - auto-save progress
  window.addEventListener('beforeunload', () => {
    if (state.autoTimer) clearTimeout(state.autoTimer);
    if (state.autoCountTimer) clearInterval(state.autoCountTimer);
    if (state.autoProviderCountdownTimer) clearInterval(state.autoProviderCountdownTimer);
    stopTopicRepairTicker();
    if (state.elapsedTimer) clearInterval(state.elapsedTimer);
    stopResize();
    // Debounced save mus� b�t proveden synchronne pred zavren�m
    saveProgress.flush();
  });
  
  // Expose toggleMenu to global scope
  window.toggleAutoSequential = toggleAutoSequential;
window.saveAutoTokenLimit = saveAutoTokenLimit;
window.toggleMenu = function() {
    const menuPanel = document.getElementById('menuPanel');
    menuPanel.classList.toggle('is-hidden');
  };
// Pri skryt� tabu tak� flushni, aby se nic neztratilo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveProgress.flush();
});

window.addEventListener('DOMContentLoaded', () => {
   // Init OR rotation panel z cache hned při startu
   setTimeout(function() {
     try {
       const orCache = JSON.parse(localStorage.getItem('openrouter_free_models_cache') || '{}');
       const orOpts = (orCache.models || []).map(function(m) {
         return typeof m === 'object' && !Array.isArray(m) ? m : { value: String((m||[])[0]||''), label: String((m||[])[1]||(m||[])[0]||'') };
       }).filter(function(o) { return o.value; });
       if (orOpts.length && window.refreshOrModelRotationPanel) window.refreshOrModelRotationPanel(orOpts);
     } catch(e) {}
   }, 500);
   // Load custom UI language if exists
   try {
     const customLangCode = localStorage.getItem('strong_ui_lang_custom_active');
     if (customLangCode) {
       const customLangData = localStorage.getItem(`strong_ui_lang_custom_${customLangCode}`);
       if (customLangData) {
         window.__CUSTOM_UI_MESSAGES__ = window.__CUSTOM_UI_MESSAGES__ || {};
         window.__CUSTOM_UI_MESSAGES__[customLangCode] = JSON.parse(customLangData);
       }
     }
   } catch (e) {
     console.warn('Failed to load custom UI language:', e);
   }
   document.getElementById('provider')?.addEventListener('change', onProviderChange);
  document.getElementById('apiKey')?.addEventListener('change', saveApiKey);
  document.getElementById('apiKeyProfile')?.addEventListener('change', onApiKeyProfileChange);
  document.getElementById('btnSaveApiKeyProfile')?.addEventListener('click', saveCurrentApiKeyAsProfile);
  document.getElementById('btnDeleteApiKeyProfile')?.addEventListener('click', deleteApiKeyProfile);
  document.getElementById('btnLoadDefault')?.addEventListener('click', loadDefaultFile);
  document.getElementById('fileTXT')?.addEventListener('change', (event) => {
    loadTXT(event.currentTarget);
  });

  loadSavedSettings().catch(err => {
    showToast(t('toast.error.withMessage', { message: err?.message || String(err) }));
  });
});

// ── OPENROUTER MODEL ROTATION PANEL ─────────────────────────────────────────
const OR_ROTATION_KEY = 'or_rotation_models';
const OR_STATS_KEY = 'or_model_stats';

function getOrStats() {
  try { return JSON.parse(localStorage.getItem(OR_STATS_KEY) || '{}'); } catch(e) { return {}; }
}
function saveOrStats(stats) {
  try { localStorage.setItem(OR_STATS_KEY, JSON.stringify(stats)); } catch(e) {}
}
function getOrRotationModels() {
  try { const r = localStorage.getItem(OR_ROTATION_KEY); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}
function saveOrRotationModels(models) {
  try { localStorage.setItem(OR_ROTATION_KEY, JSON.stringify(models)); } catch(e) {}
}

window.refreshOrModelRotationPanel = function(options) {
  const list = document.getElementById('orModelCheckboxList');
  if (!list) return;
  const saved = new Set(getOrRotationModels());
  const stats = getOrStats();

  // Detekce speciálních modelů podle klíčových slov v ID
  function getModelWarning(id) {
    const v = id.toLowerCase();
    if (v.includes('-vl') || v.includes('vision') || v.includes('multimodal') || v.includes('-vl:') || v.endsWith('vl:free')) {
      return { icon: '🖼', title: 'Vision model — primárně pro obrázky, text nemusí fungovat' };
    }
    if (v.includes('coder') || v.includes('code') || v.includes('starcoder') || v.includes('deepcoder')) {
      return { icon: '💻', title: 'Kódovací model — překlad textu nemusí být kvalitní' };
    }
    if (v.includes('embed') || v.includes('embedding')) {
      return { icon: '⛔', title: 'Embedding model — nelze použít pro překlad' };
    }
    // Modely bez system role (uloženo po prvním 400)
    const noSysKey = 'or_no_system_' + id.replace(/[^a-z0-9]/gi, '_');
    if (localStorage.getItem(noSysKey)) {
      return { icon: '⚠', title: 'Funguje jen bez system role — automaticky přizpůsobeno' };
    }
    return null;
  }

  // Seřadit podle úspěšnosti: nejvíce úspěchů nahoře, bez historie dole
  const sortedOptions = options.filter(function(o) {
    return o.value !== 'openrouter/rotate' && o.value !== 'openrouter/free';
  }).slice().sort(function(a, b) {
    const sa = stats[a.value] || { ok: 0, rl: 0 };
    const sb = stats[b.value] || { ok: 0, rl: 0 };
    const totalA = sa.ok + sa.rl;
    const totalB = sb.ok + sb.rl;
    // Bez historie → na konec
    if (totalA === 0 && totalB === 0) return 0;
    if (totalA === 0) return 1;
    if (totalB === 0) return -1;
    // Seřadit podle počtu úspěchů (více = výše), pak poměru
    const scoreA = sa.ok / totalA;
    const scoreB = sb.ok / totalB;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return sb.ok - sa.ok; // při stejném poměru více úspěchů = výše
  });

  list.innerHTML = sortedOptions.map(function(o) {
    const s = stats[o.value] || { ok: 0, rl: 0 };
    const total = s.ok + s.rl;
    const statStr = total > 0
      ? ' <span style="color:var(--txt3);font-size:10px">(✓' + s.ok + ' ✗' + s.rl + ')</span>'
      : '';
    const warn = getModelWarning(o.value);
    const warnStr = warn ? ' <span title="' + warn.title + '" style="cursor:help">' + warn.icon + '</span>' : '';
    const checked = saved.has(o.value) ? 'checked' : '';
    const safeId = 'orck_' + o.value.replace(/[^a-zA-Z0-9]/g, '_');
    return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;font-family:JetBrains Mono,monospace;color:var(--txt1);padding:2px 4px;border-radius:3px;" title="' + o.value + '">'
      + '<input type="checkbox" id="' + safeId + '" value="' + o.value + '" ' + checked + ' onchange="window.onOrRotationChange()" style="cursor:pointer">'
      + '<span>' + o.label + warnStr + statStr + '</span>'
      + '</label>';
  }).join('');
};

window.onOrRotationChange = function() {
  const list = document.getElementById('orModelCheckboxList');
  if (!list) return;
  const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(function(cb) { return cb.value; });
  saveOrRotationModels(checked);
};

window.recordOrModelStat = function(model, success) {
  if (!model || model === 'openrouter/free' || model === 'openrouter/rotate') return;
  // Normalizovat — přidat :free pokud chybí
  const normModel = model.endsWith(':free') ? model : model + ':free';
  const stats = getOrStats();
  // Zapsat pod oběma variantami (s :free i bez) pro jistotu
  [model, normModel].forEach(function(key) {
    if (!stats[key]) stats[key] = { ok: 0, rl: 0 };
    if (success) stats[key].ok++; else stats[key].rl++;
  });
  saveOrStats(stats);
  // Refresh panel
  try {
    const cached = JSON.parse(localStorage.getItem('openrouter_free_models_cache') || '{}');
    const opts = (cached.models || []).map(function(m) {
      return typeof m === 'object' && !Array.isArray(m) ? m : { value: String(m[0]||''), label: String(m[1]||m[0]||'') };
    }).filter(function(m) { return m.value; });
    if (opts.length && window.refreshOrModelRotationPanel) window.refreshOrModelRotationPanel(opts);
  } catch(e) {}
};

// ── OPENROUTER ROTATION — výběrová tlačítka ─────────────────────────────────
// Modely které zvládají odborný překlad do češtiny na free tieru
const OR_RECOMMENDED_MODELS = new Set([
  // Meta Llama — nejlepší pro češtinu
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-4-scout:free',
  'meta-llama/llama-4-maverick:free',
  // Google Gemma 4
  'google/gemma-4-31b-it:free',
  'google/gemma-3-27b-it:free',
  'google/gemma-3-12b-it:free',
  // Qwen — silný na překlad
  'qwen/qwen3-235b-a22b:free',
  'qwen/qwen3-30b-a3b:free',
  'qwen/qwen2.5-72b-instruct:free',
  // DeepSeek
  'deepseek/deepseek-r1:free',
  'deepseek/deepseek-r1-0528:free',
  // Mistral
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  // Nous Hermes
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'nous/hermes-3-405b-instruct:free',
  // Microsoft Phi
  'microsoft/phi-4-reasoning-plus:free',
  // Arcee AI
  'arcee-ai/trinity-large-thinking:free',
  // OpenAI (free tier)
  'openai/gpt-oss-120b:free',
]);

window.orSelectRecommended = function() {
  const list = document.getElementById('orModelCheckboxList');
  if (!list) return;
  // Kombinace přesných ID + klíčová slova pro případ jiných ID na API
  const RECOMMENDED_KEYWORDS = [
    'llama-3.3-70b', 'llama-4-scout', 'llama-4-maverick', 'llama-3.1-70b',
    'gemma-4-31b', 'gemma-3-27b', 'gemma-3-12b', 'gemma-4-9b',
    'qwen3-235b', 'qwen3-30b', 'qwen2.5-72b', 'qwen-3-235b', 'qwen-3-30b',
    'deepseek-r1', 'deepseek-v3',
    'mistral-small-3', 'mistral-small-24b',
    'hermes-3-405b', 'hermes-3-llama',
    'phi-4-reasoning', 'phi-4-mini',
  ];
  // Modely které překlad do češtiny nezvládají dobře — vyloučit
  const EXCLUDE_KEYWORDS = [
    'vision', 'vl', 'coder', 'code', 'embed', '1b', '3b', '7b', '8b',
    'nano', 'mini', 'xs', 'tiny', 'small-1', 'small-2',
  ];
  const boxes = list.querySelectorAll('input[type=checkbox]');
  boxes.forEach(cb => {
    const val = cb.value.toLowerCase();
    // Přesná shoda s ID seznamem
    const exactMatch = OR_RECOMMENDED_MODELS.has(cb.value);
    // Shoda klíčových slov
    const keywordMatch = RECOMMENDED_KEYWORDS.some(kw => val.includes(kw));
    // Výjimky — malé nebo specializované modely
    const excluded = EXCLUDE_KEYWORDS.some(kw => val.includes(kw));
    cb.checked = (exactMatch || keywordMatch) && !excluded;
  });
  window.onOrRotationChange();
};

window.orSelectAll = function() {
  const list = document.getElementById('orModelCheckboxList');
  if (!list) return;
  list.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = true; });
  window.onOrRotationChange();
};

window.orSelectNone = function() {
  const list = document.getElementById('orModelCheckboxList');
  if (!list) return;
  list.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
  window.onOrRotationChange();
};

// ── PROVIDER LIMITY ─────────────────────────────────────────────────────────
const PROVIDER_LIMIT_KEY = 'provider_limits';

function getProviderLimits() {
  try { return JSON.parse(localStorage.getItem(PROVIDER_LIMIT_KEY) || '{}'); } catch(e) { return {}; }
}

window.saveProviderLimit = function(prov, type, val) {
  const limits = getProviderLimits();
  if (!limits[prov]) limits[prov] = {};
  const num = parseInt(val, 10);
  limits[prov][type] = Number.isNaN(num) ? null : num;
  localStorage.setItem(PROVIDER_LIMIT_KEY, JSON.stringify(limits));
};

function loadProviderLimitInputs() {
  const DEFAULTS = {
    groq:       { batchSize: 5, interval: 20 },
    gemini:     { batchSize: 5, interval: 20, reqs: 400 },
    openrouter: { batchSize: 5, interval: 20, reqs: 400 },
  };

  const limits = getProviderLimits();
  let changed = false;
  for (const [prov, defs] of Object.entries(DEFAULTS)) {
    if (!limits[prov]) { limits[prov] = {}; changed = true; }
    for (const [type, defVal] of Object.entries(defs)) {
      if (limits[prov][type] == null) { limits[prov][type] = defVal; changed = true; }
    }
  }
  if (changed) localStorage.setItem(PROVIDER_LIMIT_KEY, JSON.stringify(limits));

  for (const prov of ['groq', 'gemini', 'openrouter']) {
    const bsEl = document.getElementById('batchSize_' + prov);
    const ivEl = document.getElementById('interval_' + prov);
    const rqEl = document.getElementById('limitReqs_' + prov);
    if (bsEl && limits[prov]?.batchSize != null) bsEl.value = limits[prov].batchSize;
    if (ivEl && limits[prov]?.interval != null) ivEl.value = limits[prov].interval;
    if (rqEl && limits[prov]?.reqs != null) rqEl.value = limits[prov].reqs;
  }
}

// Zrcadlit autoLog do log-head
function mirrorAutoLog() {
  const src = document.getElementById('autoLog');
  const dst = document.getElementById('autoLogMirror');
  if (!src || !dst) return;
  const observer = new MutationObserver(() => { dst.textContent = src.textContent; });
  observer.observe(src, { childList: true, subtree: true, characterData: true });
  dst.textContent = src.textContent;
}

// Zkontrolovat provider limity při každém překladu
window.checkProviderRequestLimit = function(prov) {
  const limits = getProviderLimits();
  const reqLimit = limits[prov]?.reqs;
  if (!reqLimit || reqLimit <= 0) return false;
  const key = 'provider_req_count_' + prov;
  const count = parseInt(sessionStorage.getItem(key) || '0', 10);
  return count >= reqLimit;
};

window.incrementProviderReqCount = function(prov) {
  const key = 'provider_req_count_' + prov;
  const count = parseInt(sessionStorage.getItem(key) || '0', 10) + 1;
  sessionStorage.setItem(key, String(count));
  const limits = getProviderLimits();
  const limit = limits[prov]?.reqs;
  const limitReached = limit && count >= limit;

  // Zobrazit počítadlo pro každý provider
  const reqCountElId = { groq: 'groqReqCount', gemini: 'geminiReqCount', openrouter: 'orReqCount' }[prov];
  if (reqCountElId) {
    const el = document.getElementById(reqCountElId);
    if (el) {
      el.textContent = count + (limit ? '/' + limit : '') + ' req';
      el.style.color = limitReached ? 'var(--err, #ff4444)' : '';
    }
  }

  // Při dosažení limitu - zastavit countdown a zobrazit stav
  if (limitReached) {
    const label = { groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter' }[prov] || prov;
    const countdownEl = document.getElementById('autoCountdown_' + prov);
    if (countdownEl) {
      countdownEl.textContent = label + ': limit ' + count + '/' + limit + ' req ✓';
      countdownEl.style.color = 'var(--acc3, orange)';
    }
  }
};

window.getProviderLimits = getProviderLimits;
window.resetProviderReqCounts = function() {
  ['groq', 'gemini', 'openrouter'].forEach(p => sessionStorage.removeItem('provider_req_count_' + p));
  const reqCountElIds = { groq: 'groqReqCount', gemini: 'geminiReqCount', openrouter: 'orReqCount' };
  for (const id of Object.values(reqCountElIds)) {
    const el = document.getElementById(id);
    if (el) { el.textContent = '0 req'; el.style.color = ''; }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadProviderLimitInputs, 600);
  setTimeout(mirrorAutoLog, 1000);
});
