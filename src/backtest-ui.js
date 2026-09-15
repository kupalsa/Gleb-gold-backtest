import { VOL2_BACKTEST_ID, MOVED_TP_BACKTEST_ID } from './backtests.js';

export function renderBacktestTabs({
  activeId = VOL2_BACKTEST_ID,
  activeTabId = MOVED_TP_BACKTEST_ID,
  containerEl = null
} = {}) {
  if (!containerEl) return;

  const isVol2 = activeId === VOL2_BACKTEST_ID;
  containerEl.hidden = !isVol2;

  const currentTabId = isVol2 ? (activeTabId || MOVED_TP_BACKTEST_ID) : activeId;
  const tabs = containerEl.querySelectorAll('[data-backtest]');
  tabs.forEach((tab) => {
    const id = tab.dataset?.backtest || tab.getAttribute('data-backtest');
    const isActive = id === currentTabId;
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    const baseClass = (tab.className || '').replace(/\bactive\b/g, '').trim();
    tab.className = `${baseClass} ${isActive ? 'active' : ''}`.trim();
  });
}

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
  containerEl,
  selectEl,
  createBtn,
  renameBtn,
  deleteBtn,
  refresh,
  promptFn = (...args) => (globalThis.window || globalThis).prompt(...args),
  confirmFn = (...args) => (globalThis.window || globalThis).confirm(...args),
  alertFn = (...args) => (globalThis.window || globalThis).alert(...args)
} = {}) {
  if (containerEl) {
    const tabs = containerEl.querySelectorAll('[data-backtest]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', async () => {
        const id = tab.dataset?.backtest || tab.getAttribute('data-backtest');
        if (id) {
          await store.selectBacktest(id);
          await refresh();
        }
      });
    });
  }

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
