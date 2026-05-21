/**
 * Seznam hesel — virtuální scrolling, filtrování, výběr, překlad vybraných.
 * Deps: state, t, escHtml, ITEM_HEIGHT, BUFFER_ITEMS,
 *       getTranslationStateForKey,
 *       isAutoProviderEnabled, resolveMainBatchProvider, getPipelineModelForProvider,
 *       translateBatch, startTopicRepairFlow, showPreviewModal,
 *       showToast, logError, updateFailedCount, saveProgress,
 *       updateStats, renderDetail (late-bound)
 */
import { getStrongKeyNumber, hasMeaningfulValue, isDefinitionLowQuality } from '../translation/utils.js';
export function createListApi({
  state, t, escHtml, ITEM_HEIGHT, BUFFER_ITEMS,
  getTranslationStateForKey,
  isAutoProviderEnabled, resolveMainBatchProvider, getPipelineModelForProvider,
  translateBatch, startTopicRepairFlow, showPreviewModal,
  showToast, logError, updateFailedCount, saveProgress,
  updateStats, renderDetail
}) {
   function getFilteredEntries() {
     const q = document.getElementById('searchInput').value.toLowerCase();
     const statusFilter = document.getElementById('filterStatus')?.value || 'all';
     const sortBy = document.getElementById('filterSort')?.value || 'original';

     let lang = 'all';
      let status = 'all';
      let missingTopicFilter = null; // 'all', 'definice', 'vyznam', 'kjv', 'puvod', 'specialista'

      if (statusFilter.startsWith('g_')) {
        lang = 'G';
        status = statusFilter.slice(2);
      } else if (statusFilter.startsWith('h_')) {
        lang = 'H';
        status = statusFilter.slice(2);
      } else {
        status = statusFilter;
        if (status.startsWith('missing_topic_')) {
          missingTopicFilter = status.slice(14); // 'all', 'definice', 'vyznam', 'kjv', 'puvod', 'specialista'
          status = 'missing_topic';
        }
      }

     // Get source language setting for filtering entries
     const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
     const includeG = sourceLang === 'gr' || sourceLang === 'both';
     const includeH = sourceLang === 'he' || sourceLang === 'both';

     let filtered = state.entries.filter(e => {
       if (state.listRangeFilter) {
         const n = getStrongKeyNumber(e.key);
         if (!Number.isFinite(n) || n < state.listRangeFilter.from || n > state.listRangeFilter.to) return false;
       }
       const matchesSearch = !q || e.key.toLowerCase().includes(q) ||
         e.greek.toLowerCase().includes(q) || (e.definice || e.def || '').toLowerCase().includes(q);
       if (!matchesSearch) return false;

       const translationState = getTranslationStateForKey(e.key);

       // Apply language filter based on statusFilter (g_ or h_)
       if (lang === 'G' && !e.key.startsWith('G')) return false;
       if (lang === 'H' && !e.key.startsWith('H')) return false;

       // Apply source language filter (G/H/both)
       const startsWithG = e.key.startsWith('G');
       const startsWithH = e.key.startsWith('H');
       if (!((includeG && startsWithG) || (includeH && startsWithH))) {
         return false;
       }

        if (status === 'pending')       return translationState === 'pending';
        if (status === 'done')          return translationState === 'done';
        if (status === 'failed')        return translationState === 'failed' || translationState === 'failed_partial';
        if (status === 'missing_topic') {
          if (translationState !== 'missing_topic') return false;
          // Konkrétní téma chybí?
          if (missingTopicFilter && missingTopicFilter !== 'all') {
            const t = state.translated[e.key];
            if (!t) return false;
            // Kontrola, zda konkrétní téma chybí/pokreslitěné
            const val = String(t[missingTopicFilter] || '').trim();
            if (hasMeaningfulValue(val)) return false;
            // Pro definici zkontroluj kvalitu
            if (missingTopicFilter === 'definice' && !isDefinitionLowQuality(val)) return false;
            return true;
          }
          return true;
        }

       return true;
     });

     if (sortBy === 'greek') {
       filtered.sort((a, b) => a.greek.localeCompare(b.greek));
     } else if (sortBy === 'original') {
       filtered.sort((a, b) => {
         let idxA, idxB;
         if (window._entryIndexMap?.has(a.key)) {
           idxA = window._entryIndexMap.get(a.key);
           idxB = window._entryIndexMap.get(b.key);
         } else {
           idxA = window._entryIndexMap ? state.entries.findIndex(x => x.key === a.key) : state.entries.indexOf(a);
           idxB = window._entryIndexMap ? state.entries.findIndex(x => x.key === b.key) : state.entries.indexOf(b);
         }
         return idxA - idxB;
       });
     } else {
       filtered.sort((a, b) => {
         const numA = getStrongKeyNumber(a.key);
         const numB = getStrongKeyNumber(b.key);
         if (numA !== numB) return numA - numB;
         return a.key.localeCompare(b.key);
       });
     }

     return filtered;
   }

   function filterMissingTopicsList() {
     const filterEl = document.getElementById('filterStatus');
     if (filterEl) filterEl.value = 'missing_topic_all';
     renderList();
     showToast(t('toast.filter.missingTopic'));
   }

  function scrollToActive() {
    const el = document.querySelector(`.list-item[data-key="${state.activeKey}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function updatePhantomHeight() {
    if (!state.phantomSpacer) return;
    state.phantomSpacer.style.height = `${state.filteredKeys.length * ITEM_HEIGHT}px`;
  }

  function renderVisible() {
    if (!state.visibleContainer || !state.virtualInitialized) return;

    const scroll = document.getElementById('listScroll');
    const scrollTop = scroll.scrollTop;
    let viewportHeight = scroll.clientHeight;
    const total = state.filteredKeys.length;

    if (total === 0) {
      state.visibleContainer.innerHTML = '';
      state.lastRenderRange = { start: -1, end: -1 };
      return;
    }

    if (viewportHeight < 100) viewportHeight = 300;

    let startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_ITEMS);
    let endIndex   = Math.min(total - 1, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_ITEMS);

    if (state.lastRenderRange.start === -1 || endIndex - startIndex < 5) {
      startIndex = 0;
      endIndex   = Math.min(total - 1, Math.ceil(viewportHeight / ITEM_HEIGHT) + BUFFER_ITEMS);
    }

    if (startIndex === state.lastRenderRange.start && endIndex === state.lastRenderRange.end) {
      const needsUpdate = Array.from({ length: endIndex - startIndex + 1 }, (_, idx) => {
        const key = state.filteredKeys[startIndex + idx];
        if (!key) return false;
        const ts = getTranslationStateForKey(key);
        return state.lastRenderRange.doneStates?.[key] !== ts;
      }).some(Boolean);
      if (!needsUpdate) return;
    }

    const doneStates = {};
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i <= endIndex; i++) {
      const key = state.filteredKeys[i];
      if (!key) continue;
      const e = state.entryMap.get(key);
      if (!e) continue;
      const translationState = getTranslationStateForKey(key);
      doneStates[key] = translationState;

      const isSelected = state.selectedKeys.has(key);
      const isDone     = translationState === 'done';

      const div = document.createElement('div');
      div.className = 'list-item' +
        (isDone ? ' done' : '') +
        (key === state.activeKey ? ' active' : '') +
        (isSelected ? ' selected' : '');
      div.dataset.key = key;
      div.setAttribute('tabindex', '0');
      div.style.cssText = `position:absolute;left:0;right:0;top:${i * ITEM_HEIGHT}px;height:${ITEM_HEIGHT}px`;
      div.onclick = ev => {
        if (ev.target.classList.contains('li-check')) return;
        showDetail(key);
      };
      div.onkeydown = ev => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggleSelect(key, ev);
        }
      };
      const dotClass = isDone ? 'done' : (translationState === 'pending' ? 'pending' : (translationState === 'missing_topic' ? 'missing-topic' : 'failed'));
      div.innerHTML = `
        <input type="checkbox" class="li-check" ${isSelected ? 'checked' : ''} onclick="toggleSelect('${key}', event)" aria-label="${escHtml(t('list.entry.checkbox', { key }))}">
        <div class="li-key">${key}</div>
        <div class="li-greek">${escHtml(e.greek)}</div>
        <div class="li-dot ${dotClass}" aria-hidden="true">${isDone ? '✓' : '•'}</div>
      `;
      fragment.appendChild(div);
    }

    state.lastRenderRange = { start: startIndex, end: endIndex, doneStates };
    state.visibleContainer.innerHTML = '';
    state.visibleContainer.appendChild(fragment);
  }

  function onVirtualScroll() {
    if (!state.scrollTicking) {
      requestAnimationFrame(() => {
        renderVisible();
        state.scrollTicking = false;
      });
      state.scrollTicking = true;
    }
  }

  function initVirtualScroll() {
    const scroll = document.getElementById('listScroll');
    state.phantomSpacer = document.createElement('div');
    state.phantomSpacer.className = 'phantom-spacer';
    state.visibleContainer = document.createElement('div');
    state.visibleContainer.className = 'visible-items';

    scroll.innerHTML = '';
    scroll.appendChild(state.phantomSpacer);
    scroll.appendChild(state.visibleContainer);
    scroll.style.position = 'relative';

    scroll.removeEventListener('scroll', onVirtualScroll);
    scroll.addEventListener('scroll', onVirtualScroll, { passive: true });

    state.virtualInitialized = true;
    updatePhantomHeight();

    if (!window._virtualScrollResizeAdded) {
      window.addEventListener('resize', () => {
        if (!state.resizeTicking) {
          requestAnimationFrame(() => {
            renderVisible();
            state.resizeTicking = false;
          });
          state.resizeTicking = true;
        }
      });
      window._virtualScrollResizeAdded = true;
    }
  }

  function renderList() {
    state.filteredKeys = getFilteredEntries().map(e => e.key);
    if (state.virtualInitialized) {
      state.lastRenderRange = { start: -1, end: -1 };
      updatePhantomHeight();
      renderVisible();
    }
    updateSelectedBtn();
  }

  function showDetail(key) {
    state.activeKey = key;
    if (state.virtualInitialized) {
      requestAnimationFrame(() => {
        if (state.virtualInitialized) renderVisible();
      });
    } else {
      document.querySelectorAll('.list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.key === key);
      });
    }
    renderDetail(key);
  }

  function toggleSelect(key, event) {
    event.stopPropagation();
    if (state.selectedKeys.has(key)) {
      state.selectedKeys.delete(key);
    } else {
      state.selectedKeys.add(key);
    }
    renderList();
  }

  function selectAll() {
    for (const key of state.filteredKeys) state.selectedKeys.add(key);
    renderList();
  }

  function selectNone() {
    state.selectedKeys.clear();
    renderList();
  }

  function updateSelectedBtn() {
    const btn = document.getElementById('btnTranslateSelected');
    const btnSelectAllVisible = document.getElementById('btnSelectAllVisible');
    if (state.selectedKeys.size > 0) {
      if (btnSelectAllVisible) {
        btnSelectAllVisible.style.display = 'inline-block';
        btnSelectAllVisible.textContent = t('list.selectAllVisibleWithCount', { count: state.filteredKeys.length });
      }
      btn.style.display = 'inline-block';
      btn.textContent = t('list.translateSelectedCount', { count: state.selectedKeys.size });
    } else {
      if (btnSelectAllVisible) btnSelectAllVisible.style.display = 'none';
      btn.style.display = 'none';
    }
  }

    async function translateSelected() {
      // Zastavit pokud už běží
      if (state.selectedTranslationRunning) {
        state.selectedTranslationRunning = false;
        document.getElementById('btnTranslateSelected').textContent = t('list.translateSelected');
        return;
      }
      
      state.selectedTranslationRunning = true;
      
      try {
        const activeProvider = resolveMainBatchProvider(document.getElementById('provider')?.value || '');
        if (!isAutoProviderEnabled(activeProvider)) {
          showToast(t('toast.provider.enableOne'));
          return;
        }
        const sourceLang = localStorage.getItem('strong_source_lang') || 'gr';
        const includeG = sourceLang === 'gr' || sourceLang === 'both';
        const includeH = sourceLang === 'he' || sourceLang === 'both';
        let keys = Array.from(state.selectedKeys);
        
        // Filter keys based on source language setting
        keys = keys.filter(key => {
          const startsWithG = key.startsWith('G');
          const startsWithH = key.startsWith('H');
          return (includeG && startsWithG) || (includeH && startsWithH);
        });
        
        if (!keys.length) return;
        const filterStatus = document.getElementById('filterStatus')?.value || '';
        if (filterStatus === 'missing_topic') {
          startTopicRepairFlow(keys);
          return;
        }

       const bs = parseInt(document.getElementById('batchSizeRun')?.value) || 10;
       let processed = 0;
       let allNewTranslations = {};

       while (processed < keys.length && state.selectedTranslationRunning) {
         const batchKeys = keys.slice(processed, processed + bs);
         document.getElementById('btnTranslateSelected').textContent = `⏳ ${processed + batchKeys.length}/${keys.length}...`;

         try {
           const beforeMap = {};
           for (const key of batchKeys) {
             beforeMap[key] = state.translated[key] ? JSON.stringify(state.translated[key]) : '';
           }
           await translateBatch(batchKeys);
           const newTranslations = {};
           for (const key of batchKeys) {
             const after = state.translated[key] ? JSON.stringify(state.translated[key]) : '';
             if (after && after !== beforeMap[key]) {
               newTranslations[key] = { ...state.translated[key] };
             }
           }
           allNewTranslations = { ...allNewTranslations, ...newTranslations };
           saveProgress();
           updateFailedCount();
           renderList();
         } catch (e) {
           logError('translateSelected', e, {
             batchKeys,
             batchSize: batchKeys.length,
             provider: activeProvider,
             model: getPipelineModelForProvider(activeProvider)
           });
           showToast(t('toast.error.withMessage', { message: e.message }));
         }

         processed += batchKeys.length;

         if (processed < keys.length && state.selectedTranslationRunning) {
           const interval = parseInt(document.getElementById('intervalRun')?.value) ||
                            parseInt(document.getElementById('interval')?.value) || 20;
           document.getElementById('btnTranslateSelected').textContent = t('list.translateWaiting', { seconds: interval });
           await new Promise(r => setTimeout(r, interval * 1000));
         }
       }

        if (!state.selectedTranslationRunning) {
          // Přerušeno uživatelem
          document.getElementById('btnTranslateSelected').textContent = t('list.translateSelected');
          return;
        }

        state.selectedKeys.clear();
        renderList();

        // Počkej na dokončení všech sekundárních fallbacks (Gemini/OpenRouter)
        if (state.sideFallbackBackgroundQueue) {
          try {
            await state.sideFallbackBackgroundQueue;
          } catch (e) {}
        }

        // Auto-open Topic Repair modal if any translated entries still have missing topics
        startTopicRepairFlow(keys);

        updateFailedCount();
        document.getElementById('btnTranslateSelected').textContent = t('list.translateSelected');

       if (Object.keys(allNewTranslations).length > 0) {
         showPreviewModal(allNewTranslations);
         showToast(t('toast.translated.count', { count: Object.keys(allNewTranslations).length }));
       } else {
         showToast(t('toast.translation.none'));
       }
      } finally {
        state.selectedTranslationRunning = false;
      }
   }

  return {
    getFilteredEntries,
    filterMissingTopicsList,
    scrollToActive,
    initVirtualScroll,
    updatePhantomHeight,
    renderVisible,
    onVirtualScroll,
    renderList,
    showDetail,
    toggleSelect,
    selectAll,
    selectNone,
    updateSelectedBtn,
    translateSelected
  };
}
