/**
 * Nástroje pro monitorování localStorage využití
 * Spusťte v konzoli: StorageStats.logAll()
 */

export function getLocalStorageStats() {
  const stats = [];
  let totalBytes = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    const size = new Blob([value]).size; // Přesná velikost v bytech
    totalBytes += size;
    stats.push({ key, sizeBytes: size, sizeKB: (size / 1024).toFixed(2) });
  }
  
  return {
    entries: stats.sort((a, b) => b.sizeBytes - a.sizeBytes),
    totalBytes,
    totalKB: (totalBytes / 1024).toFixed(2),
    totalMB: (totalBytes / (1024 * 1024)).toFixed(3),
    count: stats.length
  };
}

export function getStorageQuotaInfo() {
  return new Promise((resolve) => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        resolve({
          usage: estimate.usage,
          quota: estimate.quota,
          usageMB: (estimate.usage / (1024 * 1024)).toFixed(3),
          quotaMB: (estimate.quota / (1024 * 1024)).toFixed(3),
          percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1),
          // Persisted storage (if granted)
          ...(estimate.persistence !== undefined && {
            isPersisted: estimate.persistence,
            persistent: 'persistence' in estimate
          })
        });
      });
    } else {
      resolve({
        error: 'navigator.storage.estimate not supported',
        fallback: {
          //胆小 estimate: localStorage.length * 1024 * 5, // odhad
          usageMB: 'unknown',
          quotaMB: 'unknown'
        }
      });
    }
  });
}

export function logStorageHealth() {
  console.group('📊 localStorage Health Check');
  
  // 1. Basic stats
  const stats = getLocalStorageStats();
  console.log(`📦 Total entries: ${stats.count}`);
  console.log(`💾 Total size: ${stats.totalKB} KB (${stats.totalMB} MB)`);
  
  // 2. Top consumers
  console.log('\n🔝 Top 10 largest entries:');
  stats.entries.slice(0, 10).forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.key}: ${e.sizeKB} KB`);
  });
  
  // 3. Strong Translator keys with size info
  const strongKeys = stats.entries.filter(e => e.key.startsWith('strong_'));
  const strongTotal = strongKeys.reduce((sum, e) => sum + e.sizeBytes, 0);
  console.log(`\n🔑 Strong app keys: ${strongKeys.length} entries, ${(strongTotal / 1024).toFixed(2)} KB`);
  
  // 4. Storage estimate (if available)
  getStorageQuotaInfo().then(quota => {
    if (quota.error) {
      console.log(`\n⚠️ Storage API not available: ${quota.error}`);
    } else {
      console.log(`\n💽 Browser storage quota:`);
      console.log(`   Usage: ${quota.usageMB} MB / ${quota.quotaMB} MB (${quota.percentUsed}%)`);
      if (quota.persistent) {
        console.log(`   Persisted storage: ${quota.isPersisted ? '✅ Yes' : '❌ No'}`);
      }
    }
    console.groupEnd();
  });
  
  return stats;
}

export function logStorageDiff(before, after) {
  console.group('🔄 Storage Changes');
  if (!before || !after) {
    console.log('Provide before/after snapshots from getLocalStorageStats()');
    return;
  }
  
  const beforeMap = new Map(before.entries.map(e => [e.key, e.sizeBytes]));
  const afterMap = new Map(after.entries.map(e => [e.key, e.sizeBytes]));
  
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  let totalAdded = 0, totalRemoved = 0, totalChanged = 0;
  
  console.log('Key changes:');
  for (const key of allKeys) {
    const beforeSize = beforeMap.get(key) || 0;
    const afterSize = afterMap.get(key) || 0;
    const diff = afterSize - beforeSize;
    
    if (beforeSize === 0 && afterSize > 0) {
      console.log(`  + ${key}: +${(diff/1024).toFixed(2)} KB`);
      totalAdded += diff;
    } else if (afterSize === 0 && beforeSize > 0) {
      console.log(`  - ${key}: -${(beforeSize/1024).toFixed(2)} KB`);
      totalRemoved += beforeSize;
    } else if (diff !== 0) {
      console.log(`  ~ ${key}: ${(beforeSize/1024).toFixed(2)} → ${(afterSize/1024).toFixed(2)} KB (${(diff/1024).toFixed(2)} KB)`);
      totalChanged += Math.abs(diff);
    }
  }
  
  console.log(`\nSummary: +${(totalAdded/1024).toFixed(2)} KB added, -${(totalRemoved/1024).toFixed(2)} KB removed, Δ${(totalChanged/1024).toFixed(2)} KB modified`);
  console.groupEnd();
}

// One-liners for console
export const StorageStats = {
  logAll: () => logStorageHealth(),
  snapshot: () => getLocalStorageStats(),
  estimate: () => getStorageQuotaInfo(),
  diff: (before, after) => logStorageDiff(before, after),
  
  // Quick check for Strong Translator
  checkStrongApp: () => {
    const stats = getLocalStorageStats();
    const strongEntries = stats.entries.filter(e => e.key.startsWith('strong_'));
    console.group('🔍 Strong Translator Storage');
    console.log(`Entries: ${strongEntries.length}`);
    console.table(strongEntries.sort((a,b) => b.sizeBytes - a.sizeBytes));
    console.log(`Total: ${(strongEntries.reduce((s,e) => s + e.sizeBytes, 0) / 1024).toFixed(2)} KB`);
    console.groupEnd();
    return strongEntries;
  },
  
  // Warn if nearing quota
  warnIfNearQuota: async () => {
    const quota = await getStorageQuotaInfo();
    if (quota.usageMB && quota.quotaMB && parseFloat(quota.percentUsed) > 80) {
      console.warn(`⚠️ Storage nearly full: ${quota.usageMB} MB / ${quota.quotaMB} MB (${quota.percentUsed}%)`);
      return true;
    }
    return false;
  }
};

// Auto-inject to window for console access
if (typeof window !== 'undefined') {
  window.StorageStats = StorageStats;
  console.log('💡 StorageStats loaded. Commands:');
  console.log('   StorageStats.logAll()        - show full report');
  console.log('   StorageStats.snapshot()      - get current snapshot');
  console.log('   StorageStats.checkStrongApp()- inspect Strong Translator keys');
  console.log('   StorageStats.warnIfNearQuota()- check quota warning');
}

export default StorageStats;
