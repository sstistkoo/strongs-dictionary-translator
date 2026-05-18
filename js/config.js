/** Konstanty UI a AI providerů */
export const CONFIG = {
  ITEM_HEIGHT: 32,
  BUFFER_ITEMS: 5,
  LOG_MAX_ENTRIES: 300,
  TOAST_DURATION: 3500,
  API_TIMEOUT: 120000
};

export const ITEM_HEIGHT = CONFIG.ITEM_HEIGHT;
export const BUFFER_ITEMS = CONFIG.BUFFER_ITEMS;

export const PROVIDERS = {
  groq: {
    label: 'Groq (console.groq.com)',
    ph: 'gsk_...',
    models: [
      ['meta-llama/llama-4-scout-17b-16e-instruct', 'model.groq.llama4scout'],
      ['llama-3.3-70b-versatile', 'model.groq.llama33'],
      ['llama-3.1-8b-instant', 'model.groq.llama31']
    ]
  },
  gemini: {
    label: 'Google AI Studio (aistudio.google.com)',
    ph: 'AIza...',
    models: [
      ['gemini-3.1-flash-lite-preview', 'model.gemini.flashLite31'],
      ['gemini-2.5-flash-lite', 'model.gemini.flashLite25'],
      ['gemini-2.5-flash', 'model.gemini.flash25'],
      ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview']
    ]
  },
  openrouter: {
    label: 'OpenRouter - zdarma',
    ph: 'sk-or-...',
    models: []
  }
};

export const GEMINI_SYSTEM_MODEL = 'gemini-3.1-flash-lite-preview';

export const LEGACY_STORE_KEY = 'strong_gr_cz_v2';
export const STORE_KEY_PREFIX = 'strong_gr_cz_v3__';

export const AUTO_PROVIDER_ENABLED_KEY = 'strong_auto_provider_enabled_';
export const PIPELINE_SECONDARY_ENABLED_KEY = 'strong_pipeline_secondary_enabled_';
export const AUTO_TOKEN_LIMIT_KEY = 'strong_auto_token_limit';
export const TEST_HISTORY_KEY = 'strong_test_history_v1';
export const MODEL_TEST_OUTPUT_KEY = 'strong_model_test_output_v1';
export const MODEL_TEST_STATS_KEY = 'strong_model_test_stats_v1';
export const MODEL_TEST_PROMPT_TYPE_KEY = 'strong_model_test_prompt_type_v1';
export const MODEL_TEST_PROMPT_COMPARE_TYPE_KEY = 'strong_model_test_prompt_compare_type_v1';
export const MODEL_TEST_PROMPT_COMPARE_ENABLE_KEY = 'strong_model_test_prompt_compare_enable_v1';
export const MODEL_TEST_CUSTOM_PROMPT_KEY = 'strong_model_test_custom_prompt_v1';
export const MODEL_TEST_ENABLE_PROMPT_KEY = 'strong_model_test_enable_prompt_v1';
export const MODEL_TEST_RAW_OUTPUT_KEY = 'strong_model_test_raw_output_v1';
export const MODEL_TEST_MODEL_STORAGE_KEY = 'strong_model_test_model_';
export const MODEL_TEST_PINNED_MODELS = [
  { prov: 'groq', value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (Systémový výchozí)' },
  { prov: 'gemini', value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite' },
  { prov: 'openrouter', value: 'openrouter/free', label: 'OpenRouter Auto Router' }
];
export const API_KEY_PROFILES_PREFIX = 'strong_apikey_profiles_';
export const API_KEY_ACTIVE_PROFILE_PREFIX = 'strong_apikey_active_';
export const BATCH_SIZE_KEY = 'strong_batch_size';
export const INTERVAL_KEY = 'strong_interval';
export const PERSONAL_PROMPT_KEY = 'strong_personal_prompt_json';
