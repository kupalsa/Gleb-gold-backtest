export function renderBacktestSelect({
  backtests = [],
  activeId = '',
  selectEl = null,
  deleteBtn = null,
  optionFactory = (value, text) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }
} = {}) {
  if (!selectEl) return;
  selectEl.replaceChildren();
  backtests.forEach((b) => {
    const opt = optionFactory(b.id, b.name);
    selectEl.append(opt);
  });
  selectEl.value = activeId;
  if (deleteBtn) {
    deleteBtn.disabled = backtests.length <= 1;
  }
}

export function wireBacktestControls({
  store,
  selectEl,
  createBtn,
  renameBtn,
  deleteBtn,
  refresh,
  promptFn = (...args) => (globalThis.window || globalThis).prompt(...args),
  confirmFn = (...args) => (globalThis.window || globalThis).confirm(...args),
  alertFn = (...args) => (globalThis.window || globalThis).alert(...args)
} = {}) {
  if (selectEl) {
    selectEl.addEventListener('change', async (event) => {
      const selectedId = (event && event.target) ? event.target.value : selectEl.value;
      if (selectedId) {
        await store.selectBacktest(selectedId);
        await refresh();
      }
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = promptFn('Enter backtest name:');
      if (name && name.trim()) {
        await store.createBacktest(name.trim());
        await refresh();
      }
    });
  }

  if (renameBtn) {
    renameBtn.addEventListener('click', async () => {
      const activeId = store.getActiveBacktestId();
      const backtests = store.listBacktests();
      const current = backtests.find((b) => b.id === activeId);
      const name = promptFn('Enter new backtest name:', current ? current.name : '');
      if (name && name.trim()) {
        await store.renameBacktest(activeId, name.trim());
        await refresh();
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const activeId = store.getActiveBacktestId();
      const backtests = store.listBacktests();
      if (backtests.length <= 1) {
        alertFn('Cannot delete the only remaining backtest.');
        return;
      }
      const current = backtests.find((b) => b.id === activeId);
      const currentName = current ? current.name : '';
      if (confirmFn(`Delete backtest "${currentName}"?`)) {
        await store.deleteBacktest(activeId);
        await refresh();
      }
    });
  }
}
