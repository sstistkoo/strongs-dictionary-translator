import { state } from './state.js';
import { PROVIDERS } from './config.js';
import { API_KEY_PROFILES_PREFIX, API_KEY_ACTIVE_PROFILE_PREFIX } from './config.js';
import { escHtml } from './utils.js';

export function createApiKeysApi({ t, showToast }) {

function saveApiKey() {
  const v = document.getElementById('apiKey').value.trim();
  const prov = document.getElementById('provider').value;
  if (v) {
    localStorage.setItem('strong_apikey_' + prov, v);
    localStorage.setItem('strong_apikey', v);
  } else {
    localStorage.removeItem('strong_apikey_' + prov);
  }
  const selected = document.getElementById('apiKeyProfile')?.value;
  if (selected && selected !== '__manual__') {
    const profiles = getApiKeyProfiles(prov);
    const idx = profiles.findIndex(p => p.id === selected);
    if (idx !== -1) {
      profiles[idx].key = v;
      localStorage.setItem(API_KEY_PROFILES_PREFIX + prov, JSON.stringify(profiles));
    }
  }
}

function getApiKeyProfiles(prov) {
  try {
    const parsed = JSON.parse(localStorage.getItem(API_KEY_PROFILES_PREFIX + prov) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(p => p && p.id && typeof p.key === 'string');
  } catch (e) {
    return [];
  }
}

function setApiKeyProfiles(prov, profiles) {
  localStorage.setItem(API_KEY_PROFILES_PREFIX + prov, JSON.stringify(profiles));
}

function maskApiKey(v) {
  const s = String(v || '').trim();
  if (!s) return t('apiKey.mask.empty');
  if (s.length < 10) return s;
  return `${s.slice(0, 5)}...${s.slice(-4)}`;
}

function setupApiKeySwitcher(prov) {
  const select = document.getElementById('apiKeyProfile');
  if (!select) return;
  const profiles = getApiKeyProfiles(prov);
  const activeId = localStorage.getItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov) || '__manual__';
  const options = [`<option value="__manual__">${t('apiKey.profile.manual')}</option>`];
  for (const p of profiles) {
    options.push(`<option value="${p.id}">${escHtml(p.name || t('apiKey.profile.defaultName'))} · ${maskApiKey(p.key)}</option>`);
  }
  select.innerHTML = options.join('');
  if (activeId !== '__manual__' && select.querySelector(`option[value="${activeId}"]`)) {
    select.value = activeId;
    const active = profiles.find(p => p.id === activeId);
    if (active) document.getElementById('apiKey').value = active.key || '';
  } else {
    select.value = '__manual__';
  }
}

function onApiKeyProfileChange() {
  const prov = document.getElementById('provider').value;
  const select = document.getElementById('apiKeyProfile');
  if (!select) return;
  const selected = select.value;
  if (selected === '__manual__') {
    localStorage.removeItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov);
    saveApiKey();
    return;
  }
  const profiles = getApiKeyProfiles(prov);
  const profile = profiles.find(p => p.id === selected);
  if (!profile) return;
  document.getElementById('apiKey').value = profile.key || '';
  localStorage.setItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov, profile.id);
  saveApiKey();
  showToast(t('toast.apiKey.activeProfile', { name: profile.name || t('apiKey.profile.unnamed') }));
}

function saveCurrentApiKeyAsProfile() {
  const prov = document.getElementById('provider').value;
  const key = document.getElementById('apiKey').value.trim();
  if (!key) {
    showToast(t('toast.apiKey.insertFirst'));
    return;
  }
  const defaultName = `${PROVIDERS[prov]?.label?.split(' ')[0] || prov} ${new Date().toLocaleDateString('cs-CZ')}`;
  const name = (prompt(t('prompt.apiKeyName'), defaultName) || '').trim();
  if (!name) return;
  const profiles = getApiKeyProfiles(prov);
  const existing = profiles.find(p => p.key === key);
  if (existing) {
    existing.name = name;
    setApiKeyProfiles(prov, profiles);
    localStorage.setItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov, existing.id);
  } else {
    const id = `k_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    profiles.push({ id, name, key });
    setApiKeyProfiles(prov, profiles);
    localStorage.setItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov, id);
  }
  setupApiKeySwitcher(prov);
  onApiKeyProfileChange();
}

function deleteApiKeyProfile() {
  const prov = document.getElementById('provider').value;
  const select = document.getElementById('apiKeyProfile');
  if (!select || select.value === '__manual__') {
    showToast(t('toast.apiKey.selectToDelete'));
    return;
  }
  const profiles = getApiKeyProfiles(prov);
  const profile = profiles.find(p => p.id === select.value);
  if (!profile) return;
  if (!confirm(t('confirm.apiKey.delete', { name: profile.name }))) return;
  const filtered = profiles.filter(p => p.id !== select.value);
  setApiKeyProfiles(prov, filtered);
  localStorage.removeItem(API_KEY_ACTIVE_PROFILE_PREFIX + prov);
  setupApiKeySwitcher(prov);
  showToast(t('toast.apiKey.deleted'));
}

function getCurrentApiKey(prov) {
  const requestedProvider = prov || document.getElementById('provider')?.value;
  const activeProvider = document.getElementById('provider')?.value || '';
  if (!prov || requestedProvider === activeProvider) {
    const fromInput = (document.getElementById('apiKey')?.value || '').trim();
    if (fromInput) return fromInput;
  }
  return (localStorage.getItem('strong_apikey_' + requestedProvider) || '').trim();
}

  return { saveApiKey, getApiKeyProfiles, setApiKeyProfiles, maskApiKey, setupApiKeySwitcher, onApiKeyProfileChange, saveCurrentApiKeyAsProfile, deleteApiKeyProfile, getCurrentApiKey };
}
