import { state } from './state.js';
import { LEGACY_STORE_KEY, STORE_KEY_PREFIX } from './config.js';

const QUOTA_WARNING_THRESHOLD = 80;   // % - varování uživatele
const QUOTA_AUTO_BACKUP_THRESHOLD = 85; // % - automatický export
const QUOTA_CRITICAL_THRESHOLD = 90;  // % - vyčistění starých záloh

export function safeSetLocalStorage(key, value, scope = 'storage') {
  try {
    localStorage.setItem(key, value);
    checkQuotaAndMaybeAutoBackup();
    return true;
   } catch (err) {
     console.warn(`[${scope}] localStorage setItem failed:`, key, err);
     if (err.name === 'QuotaExceededError') {
       handleQuotaExceeded();
     }
     return false;
   }
}

export function safeRemoveLocalStorage(key, scope = 'storage') {
  try {
    localStorage.removeItem(key);
  } catch (err) {
  }
}

export function computeFileId(parsedEntries) {
  if (!parsedEntries || !parsedEntries.length) return null;
  const first = parsedEntries[0].key;
  const last = parsedEntries[parsedEntries.length - 1].key;
  const n = parsedEntries.length;
  const types = new Set(parsedEntries.slice(0, 50).map(e => e.key[0]));
  const typeTag = types.size === 1 ? [...types][0] : 'X';
  return `${typeTag}_${n}_${first}_${last}`;
}

export function storeKey() {
  return state.currentFileId ? STORE_KEY_PREFIX + state.currentFileId : LEGACY_STORE_KEY;
}

export function backupKey() {
  return storeKey() + '_backup';
}

export function undoKey() {
  return storeKey() + '_undo';
}

// ─── Storage Quota Monitoring ───────────────────────────────────
let lastQuotaCheck = 0;
let lastQuotaWarning = 0;
let lastBackupAttempt = 0;

async function getStorageUsage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: estimate.quota ? (estimate.usage / estimate.quota) * 100 : 0
      };
    }
    // Fallback: ruční odhad
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      total += new Blob([value]).size;
    }
    const defaultQuota = 5 * 1024 * 1024; // 5 MB
    return { usage: total, quota: defaultQuota, percentUsed: (total / defaultQuota) * 100 };
  } catch (e) {
    return { usage: 0, quota: 0, percentUsed: 0, error: e };
  }
}

function showQuotaWarningIfNeeded(percentUsed) {
  if (typeof window === 'undefined' || !window.app?.toast) return;
  const now = Date.now();
  if (now - lastQuotaWarning < 60000) return; // max 1x za minutu
  if (percentUsed >= QUOTA_WARNING_THRESHOLD) {
    lastQuotaWarning = now;
    window.app.toast.show('⚠️ localStorage plný – exportujte zálohu!');
  }
}

export async function checkQuotaAndMaybeAutoBackup() {
  const now = Date.now();
  if (now - lastQuotaCheck < 30000) return; // max 1x za 30s
  lastQuotaCheck = now;
  
  try {
    const { usage, quota, percentUsed } = await getStorageUsage();
    
    if (percentUsed >= QUOTA_WARNING_THRESHOLD) {
      console.warn(`[Storage] Využití ${percentUsed.toFixed(1)}% (${(usage/1024/1024).toFixed(2)} MB)`);
      showQuotaWarningIfNeeded(percentUsed);
      
      if (percentUsed >= QUOTA_AUTO_BACKUP_THRESHOLD && (now - lastBackupAttempt > 60000)) {
        lastBackupAttempt = now;
        console.warn(`[Storage] Kritické ${percentUsed.toFixed(1)}% → vynucení exportu zálohy`);
        await forceAutoBackup();
        if (percentUsed >= QUOTA_CRITICAL_THRESHOLD) {
          console.error(`[Storage] KRITICKÉ ${percentUsed.toFixed(1)}% → mazání starých záloh`);
          cleanupOldBackups();
        }
      }
    }
  } catch (e) {
    console.error('[Storage] Kontrola selhala:', e);
  }
}

async function forceAutoBackup() {
  try {
    const payload = {
      translated: state.translated,
      sourceEntryEdits: state.sourceEntryEdits,
      ts: Date.now(),
      fileId: state.currentFileId,
      forced: true
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strong_translator_zaloha_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.app?.toast) {
      window.app.toast.show('✅ Záloha exportována (kvóta localStorage)');
    }
  } catch (e) {
    console.error('[Storage] Vynucená záloha selhala:', e);
  }
}

export function cleanupOldBackups() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('_backup') || key.includes('_undo'))) {
        localStorage.removeItem(key);
      }
    }
    console.log('[Storage] Staré zálohy smazány');
    if (window.app?.toast) {
      window.app.toast.show('🧹 Staré zálohy smazány (uvolnění místa)');
    }
  } catch (e) {
    console.error('[Storage] Cleanup selhal:', e);
  }
}

export function handleQuotaExceeded() {
  console.error('[Storage] QUOTA EXCEEDED — spouštím recovery');
  cleanupOldBackups();
  console.log('[Storage] Staré zálohy smazány (pokus o uvolnění místa)');
  if (window.app?.toast) {
    window.app.toast.show('⚠️ Storage téměř plný — vymažte nepotřebná data nebo exportujte nastavení');
  }
}

// ─── Manual diagnostics (console) ────────────────────────────────────
export function dumpStorageKeys() {
  console.log('=== localStorage keys ===');
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k);
    const size = new Blob([v]).size;
    total += size;
    console.log(`${k}: ${(size/1024).toFixed(2)} KB`);
  }
  console.log(`TOTAL: ${(total/1024).toFixed(2)} KB`);
}

export function dumpStrongKeys() {
  console.log('=== Strong Translator keys ===');
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('strong_')) {
      const v = localStorage.getItem(k);
      const size = new Blob([v]).size;
      total += size;
      console.log(`${k}: ${(size/1024).toFixed(2)} KB`);
    }
  }
  console.log(`TOTAL: ${(total/1024).toFixed(2)} KB`);
}

export async function manualQuotaCheck() {
  const { usage, quota, percentUsed } = await getStorageUsage();
  console.log(`Storage: ${(usage/1024/1024).toFixed(2)} MB / ${(quota/1024/1024).toFixed(2)} MB (${percentUsed.toFixed(1)}%)`);
  return { usage, quota, percentUsed };
}
