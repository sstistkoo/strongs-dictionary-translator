/**
 * Modální okna — custom modal, výběr rozsahu.
 * Deps: state, t, getStrongKeyNumber, renderList, showToast
 */
export function createModalsApi({ state, t, getStrongKeyNumber, renderList, showToast }) {
  function selectRange() {
    document.getElementById('modalTitle').textContent = t('modal.selectRange.title');
    document.getElementById('modalFrom').value = '1';
    document.getElementById('modalTo').value = '100';
    state.modalCallback = function () {
      const from = parseInt(document.getElementById('modalFrom').value) || 1;
      const to   = parseInt(document.getElementById('modalTo').value) || 100;
      if (from > to) return;
      state.listRangeFilter = { from, to };
      state.selectedKeys.clear();
      state.entries.forEach(e => {
        const n = getStrongKeyNumber(e.key);
        if (n >= from && n <= to) state.selectedKeys.add(e.key);
      });
      const filterStatusEl = document.getElementById('filterStatus');
      const filterSortEl   = document.getElementById('filterSort');
      if (filterStatusEl) filterStatusEl.value = 'all';
      if (filterSortEl)   filterSortEl.value   = 'num';
      renderList();
      showToast(t('toast.selected.range', { count: state.selectedKeys.size, from, to }));
    };
    document.getElementById('customModal').classList.add('show');
  }

  function closeModal() {
    document.getElementById('customModal').classList.remove('show');
  }

  function confirmModal() {
    if (state.modalCallback) {
      state.modalCallback();
      state.modalCallback = null;
    }
    closeModal();
  }

  function showMobileActions() {
    document.getElementById('mobileActionsModal').classList.add('show');
  }

  function closeMobileModal() {
    document.getElementById('mobileActionsModal').classList.remove('show');
  }

  return { selectRange, closeModal, confirmModal, showMobileActions, closeMobileModal };
}
