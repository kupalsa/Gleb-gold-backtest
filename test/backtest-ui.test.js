import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBacktestSelect, wireBacktestControls } from '../src/backtest-ui.js';

const element = () => {
  const children = [];
  const listeners = {};
  return {
    value: '',
    disabled: false,
    replaceChildren(...nodes) { children.length = 0; children.push(...nodes); },
    append(node) { children.push(node); },
    get children() { return children; },
    addEventListener(event, fn) { listeners[event] = fn; },
    async dispatchEvent(event) { if (listeners[event]) await listeners[event](event); }
  };
};

const optionNode = (value, text) => ({ value, textContent: text, nodeName: 'OPTION' });

test('renderBacktestSelect populates options and sets active selection', () => {
  const selectEl = element();
  const deleteBtn = element();
  const backtests = [
    { id: 'b1', name: 'Backtest 1' },
    { id: 'b2', name: 'Backtest 2' }
  ];
  const optionFactory = (val, txt) => optionNode(val, txt);

  renderBacktestSelect({
    backtests,
    activeId: 'b2',
    selectEl,
    deleteBtn,
    optionFactory
  });

  assert.equal(selectEl.children.length, 2);
  assert.equal(selectEl.children[0].value, 'b1');
  assert.equal(selectEl.children[0].textContent, 'Backtest 1');
  assert.equal(selectEl.children[1].value, 'b2');
  assert.equal(selectEl.children[1].textContent, 'Backtest 2');
  assert.equal(selectEl.value, 'b2');
  assert.equal(deleteBtn.disabled, false);
});

test('renderBacktestSelect disables delete button when only 1 backtest remains', () => {
  const selectEl = element();
  const deleteBtn = element();
  const backtests = [{ id: 'b1', name: 'Backtest 1' }];

  renderBacktestSelect({
    backtests,
    activeId: 'b1',
    selectEl,
    deleteBtn,
    optionFactory: (val, txt) => optionNode(val, txt)
  });

  assert.equal(deleteBtn.disabled, true);
});

test('wireBacktestControls handles switching, creation, renaming, and deletion', async () => {
  const selectEl = element();
  const createBtn = element();
  const renameBtn = element();
  const deleteBtn = element();

  let activeId = 'b1';
  let backtests = [
    { id: 'b1', name: 'Default' },
    { id: 'b2', name: 'Strategy 2' }
  ];
  let refreshCalled = 0;

  const store = {
    listBacktests: () => backtests,
    getActiveBacktestId: () => activeId,
    selectBacktest: async (id) => { activeId = id; },
    createBacktest: async (name) => {
      const newBt = { id: 'b3', name };
      backtests.push(newBt);
      activeId = 'b3';
      return newBt;
    },
    renameBacktest: async (id, name) => {
      const bt = backtests.find(b => b.id === id);
      if (bt) bt.name = name;
    },
    deleteBacktest: async (id) => {
      backtests = backtests.filter(b => b.id !== id);
      activeId = backtests[0].id;
    }
  };

  const prompts = [];
  const confirms = [];
  const alerts = [];

  wireBacktestControls({
    store,
    selectEl,
    createBtn,
    renameBtn,
    deleteBtn,
    refresh: async () => { refreshCalled++; },
    promptFn: (msg, def) => { prompts.push({ msg, def }); return 'New Strategy'; },
    confirmFn: (msg) => { confirms.push(msg); return true; },
    alertFn: (msg) => { alerts.push(msg); }
  });

  // 1. Switch backtest
  selectEl.value = 'b2';
  await selectEl.dispatchEvent('change');
  assert.equal(activeId, 'b2');
  assert.equal(refreshCalled, 1);

  // 2. Create backtest
  await createBtn.dispatchEvent('click');
  assert.equal(activeId, 'b3');
  assert.equal(backtests.length, 3);
  assert.equal(refreshCalled, 2);

  // 3. Rename backtest
  await renameBtn.dispatchEvent('click');
  assert.equal(backtests.find(b => b.id === 'b3').name, 'New Strategy');
  assert.equal(refreshCalled, 3);

  // 4. Delete backtest
  await deleteBtn.dispatchEvent('click');
  assert.equal(confirms.length, 1);
  assert.equal(backtests.length, 2);
  assert.equal(refreshCalled, 4);

  // 5. Delete when only 1 backtest remains
  backtests = [{ id: 'b1', name: 'Default' }];
  activeId = 'b1';
  await deleteBtn.dispatchEvent('click');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /Cannot delete/i);
});
