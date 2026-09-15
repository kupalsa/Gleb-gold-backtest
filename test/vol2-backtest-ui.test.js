import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBacktestTabs, wireBacktestControls } from '../src/backtest-ui.js';
import { MOVED_TP_BACKTEST_ID, NOT_MOVED_TP_BACKTEST_ID } from '../src/backtests.js';

const element = () => {
  const children = [];
  const listeners = {};
  const attributes = {};
  return {
    value: '',
    disabled: false,
    className: '',
    dataset: {},
    getAttribute(k) { return attributes[k] ?? this.dataset[k.replace(/^data-/, '')]; },
    setAttribute(k, v) { attributes[k] = String(v); },
    replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
    append(node) { children.push(...node.map ? node : [node]); },
    get children() { return children; },
    addEventListener(event, fn) { listeners[event] = fn; },
    async dispatchEvent(event) { if (listeners[event]) await listeners[event](event); },
    querySelectorAll(selector) {
      if (selector === '[data-backtest]') return children;
      return [];
    }
  };
};

test('renderBacktestTabs sets active class and aria-selected on tab buttons', () => {
  const tab1 = element();
  tab1.dataset.backtest = MOVED_TP_BACKTEST_ID;
  const tab2 = element();
  tab2.dataset.backtest = NOT_MOVED_TP_BACKTEST_ID;

  const containerEl = element();
  containerEl.append(tab1);
  containerEl.append(tab2);

  renderBacktestTabs({
    activeId: MOVED_TP_BACKTEST_ID,
    containerEl
  });

  assert.equal(tab1.className.includes('active'), true);
  assert.equal(tab1.getAttribute('aria-selected'), 'true');
  assert.equal(tab2.className.includes('active'), false);
  assert.equal(tab2.getAttribute('aria-selected'), 'false');

  renderBacktestTabs({
    activeId: NOT_MOVED_TP_BACKTEST_ID,
    containerEl
  });

  assert.equal(tab1.className.includes('active'), false);
  assert.equal(tab1.getAttribute('aria-selected'), 'false');
  assert.equal(tab2.className.includes('active'), true);
  assert.equal(tab2.getAttribute('aria-selected'), 'true');
});

test('wireBacktestControls handles clicking tab buttons to switch active backtest', async () => {
  const tab1 = element();
  tab1.dataset.backtest = MOVED_TP_BACKTEST_ID;
  const tab2 = element();
  tab2.dataset.backtest = NOT_MOVED_TP_BACKTEST_ID;

  const containerEl = element();
  containerEl.append(tab1);
  containerEl.append(tab2);

  let activeId = MOVED_TP_BACKTEST_ID;
  let refreshCalled = 0;

  const store = {
    getActiveBacktestId: () => activeId,
    selectBacktest: async (id) => { activeId = id; }
  };

  wireBacktestControls({
    store,
    containerEl,
    refresh: async () => { refreshCalled++; }
  });

  await tab2.dispatchEvent('click');
  assert.equal(activeId, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(refreshCalled, 1);
});
