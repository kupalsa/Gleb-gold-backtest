import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBacktestSelect, renderBacktestTabs, wireBacktestControls } from '../src/backtest-ui.js';
import {
  VOL2_BACKTEST_ID,
  VOL2_NY_BACKTEST_ID,
  VOL1_BACKTEST_ID,
  MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_ID
} from '../src/backtests.js';

const element = () => {
  const children = [];
  const listeners = {};
  const attributes = {};
  return {
    value: '',
    disabled: false,
    className: '',
    hidden: false,
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

test('renderBacktestTabs shows tabs when Vol 2 (Asian) or Vol 2 (NY) is active and hides tabs when Vol 1 or custom is active', () => {
  const tab1 = element();
  tab1.dataset.backtest = MOVED_TP_BACKTEST_ID;
  const tab2 = element();
  tab2.dataset.backtest = NOT_MOVED_TP_BACKTEST_ID;

  const containerEl = element();
  containerEl.append(tab1);
  containerEl.append(tab2);

  // When Vol 2 Asian is active
  renderBacktestTabs({
    activeId: VOL2_BACKTEST_ID,
    activeTabId: MOVED_TP_BACKTEST_ID,
    containerEl
  });

  assert.equal(containerEl.hidden, false);
  assert.equal(tab1.className.includes('active'), true);
  assert.equal(tab2.className.includes('active'), false);

  // When Vol 2 NY is active
  renderBacktestTabs({
    activeId: VOL2_NY_BACKTEST_ID,
    activeTabId: NOT_MOVED_TP_BACKTEST_ID,
    containerEl
  });

  assert.equal(containerEl.hidden, false);
  assert.equal(tab1.className.includes('active'), false);
  assert.equal(tab2.className.includes('active'), true);

  // When Vol 1 is active
  renderBacktestTabs({
    activeId: VOL1_BACKTEST_ID,
    containerEl
  });

  assert.equal(containerEl.hidden, true);
});

test('renderBacktestSelect populates top-level backtest options and disables delete when 1 backtest', () => {
  const selectEl = element();
  const deleteBtn = element();
  const backtests = [
    { id: VOL2_BACKTEST_ID, name: 'Gold Backtest Vol. 2 (Asian)' },
    { id: VOL2_NY_BACKTEST_ID, name: 'Gold Backtest Vol. 2 (New York Time)' },
    { id: VOL1_BACKTEST_ID, name: 'Gold Backtest Vol. 1 (Asian)' }
  ];

  renderBacktestSelect({
    backtests,
    activeId: VOL2_BACKTEST_ID,
    selectEl,
    deleteBtn,
    optionFactory: (val, text) => {
      const opt = element();
      opt.value = val;
      opt.textContent = text;
      return opt;
    }
  });

  assert.equal(selectEl.children.length, 3);
  assert.equal(selectEl.value, VOL2_BACKTEST_ID);
  assert.equal(deleteBtn.disabled, false);
});
