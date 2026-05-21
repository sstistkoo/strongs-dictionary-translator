import { state } from './state.js';
import { storeKey, backupKey, undoKey, safeSetLocalStorage, safeRemoveLocalStorage, checkQuotaAndMaybeAutoBackup } from './storage.js';
import { debounce } from './utils.js';
import { setItem as idbSetItem, getItem as idbGetItem, removeItem as idbRemoveItem } from './idbStorage.js';

export function createBackupApi({ renderList, updateStats, showToast, showToastWithAction, t, logError, logWarn, logInfo, isTranslationComplete, updateBackupButtonVisibility, getUiLang, updateFailedCount, clearLog }) {

    async function saveProgressImmediate() {
        try {
            const translatedStripped = {};
            for (const [k, v] of Object.entries(state.translated)) {
                if (!v || typeof v !== 'object') { translatedStripped[k] = v; continue; }
                const { raw: _raw, ...rest } = v;
                translatedStripped[k] = rest;
            }
            // Uložit hlavní stav do IndexedDB
            await idbSetItem(storeKey(), {
                translated: translatedStripped,
                sourceEntryEdits: state.sourceEntryEdits,
                ts: Date.now(),
                fileId: state.currentFileId
            });
            maybeAutoBackup();
            checkQuotaAndMaybeAutoBackup();
        } catch (e) {
            logError('saveProgress', e, {
                translatedCount: Object.keys(state.translated).length,
                approxSizeKB: JSON.stringify(state.translated).length / 1024
            });
            showToast(t('toast.storage.full'));
        }
    }

    // Debounced save – shlukne rychlé za sebou jdoucí úpravy (editace, import, atd.)
    const saveProgress = debounce(saveProgressImmediate, 500);

    // ── Undo + auto-backup infrastruktura ─────────────────────────────
    const AUTO_BACKUP_EVERY_N_BATCHES = 10;
    function writeBackup(key, payload) {
        try {
            // Uložit do IndexedDB místo localStorage
            idbSetItem(key, JSON.stringify(payload));
            return true;
        } catch (e) {
            logWarn('writeBackup', `Nelze uložit backup (${key})`, { error: e.message });
            return false;
        }
    }

    function maybeAutoBackup() {
        state.batchesSinceBackup++;
        if (state.batchesSinceBackup < AUTO_BACKUP_EVERY_N_BATCHES) return;
        state.batchesSinceBackup = 0;
        const doneCount = Object.values(state.translated)
            .filter(t => isTranslationComplete(t)).length;
        if (doneCount === 0) return;
        const translatedStripped = {};
        for (const [k, v] of Object.entries(state.translated)) {
            if (!v || typeof v !== 'object') { translatedStripped[k] = v; continue; }
            const { raw: _raw, ...rest } = v;
            translatedStripped[k] = rest;
        }
        writeBackup(backupKey(), { translated: translatedStripped, ts: Date.now(), count: doneCount, fileId: state.currentFileId });
        logInfo('autoBackup', `Automatická záloha: ${doneCount} hesel`);
        updateBackupButtonVisibility();
    }

    function hasUndo() {
        // Číst z IndexedDB
        const raw = idbGetItem(undoKey());
        if (!raw) return null;
        try {
            const d = JSON.parse(raw);
            if (!d || !d.translated) return null;
            // Undo je platné jen pár minut
            if (Date.now() - (d.ts || 0) > 10 * 60 * 1000) {
                idbRemoveItem(undoKey());
                return null;
            }
            return d;
        } catch (e) { return null; }
    }

    function restoreFromBackup(source) {
        const d = source === 'undo' ? hasUndo() : hasBackup();
        if (!d) { showToast(t('toast.backup.none')); return; }
        const count = Object.keys(d.translated).length;
        if (!confirm(t('confirm.restoreBackup', { count, ts: new Date(d.ts).toLocaleString(getUiLang() === 'en' ? 'en' : 'cs') }))) return;
        // Ulož aktuální stav jako undo před přepsáním
        writeBackup(undoKey(), { translated: state.translated, ts: Date.now(), fileId: state.currentFileId });
        state.translated = d.translated;
        saveProgressImmediate();
        updateStats();
        renderList();
        updateFailedCount();
        if (source === 'undo') idbRemoveItem(undoKey());
        showToast(t('toast.restored.count', { count }));
    }

    function clearProgress() {
        if (!confirm(t('confirm.clearProgress'))) return;
        // Ulož snapshot jako undo
        writeBackup(undoKey(), { translated: state.translated, ts: Date.now(), fileId: state.currentFileId });
        // Odstranit hlavní stav z IndexedDB (nikoliv z localStorage)
        idbRemoveItem(storeKey());
        state.translated = {};
        updateStats();
        renderList();
        clearLog();
        const pane = document.getElementById('detailPane');
        if (pane) pane.innerHTML = `<div class="detail-empty">${t('detail.empty')}</div>`;
        showToastWithAction(t('toast.progressClearedRestore.message'), t('toast.progressClearedRestore.action'), () => restoreFromBackup('undo'));
    }

    // Funkce pro čtení zálohy (stejná jako hasUndo ale bez kontroly času)
    function hasBackup() {
        const raw = idbGetItem(backupKey());
        if (!raw) return null;
        try {
            const d = JSON.parse(raw);
            if (!d || !d.translated) return null;
            return d;
        } catch (e) { return null; }
    }

    return { saveProgress, saveProgressImmediate, writeBackup, maybeAutoBackup, hasUndo, restoreFromBackup, clearProgress };
}