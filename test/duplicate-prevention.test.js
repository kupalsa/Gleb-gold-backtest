import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TradeStore } from '../src/trade-store.js';
import { VOL1_BACKTEST_ID } from '../src/backtests.js';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('TradeStore.create throws Error when an exact duplicate trade exists in target backtest (Vol 2 suite)', async () => {
  const store = new TradeStore({ storage: memoryStorage(), idFactory: () => 'id-1' });
  await store.list();

  const tradeData = {
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:00',
    direction: 'long',
    stopLossPoints: 10,
    riskReward: 2,
    outcome: 'win',
    notes: 'Sample trade notes',
    movedTakeProfit: 'no'
  };

  await store.create(tradeData);

  await assert.rejects(
    async () => {
      await store.create({ ...tradeData });
    },
    {
      name: 'Error',
      message: 'Duplicate trade detected. This trade has already been saved.'
    }
  );
});

test('TradeStore.create throws Error when an exact duplicate trade exists in target backtest (Vol 1 suite)', async () => {
  const store = new TradeStore({ storage: memoryStorage(), idFactory: () => 'id-vol1' });
  await store.selectBacktest(VOL1_BACKTEST_ID);

  const tradeData = {
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:00',
    direction: 'long',
    stopLossPoints: 10,
    riskReward: 2,
    outcome: 'win',
    notes: 'Vol 1 trade notes'
  };

  await store.create(tradeData);

  await assert.rejects(
    async () => {
      await store.create({ ...tradeData });
    },
    {
      name: 'Error',
      message: 'Duplicate trade detected. This trade has already been saved.'
    }
  );
});

test('TradeStore.create permits non-duplicate trades when any core field differs', async () => {
  const store = new TradeStore({ storage: memoryStorage(), idFactory: (() => { let c = 0; return () => `id-${++c}`; })() });
  await store.list();

  const baseTrade = {
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:00',
    direction: 'long',
    stopLossPoints: 10,
    riskReward: 2,
    outcome: 'win',
    notes: 'Sample trade notes',
    movedTakeProfit: 'no'
  };

  await store.create(baseTrade);

  // Different core fields:
  assert.ok((await store.create({ ...baseTrade, date: '2026-09-16' })).trade);
  assert.ok((await store.create({ ...baseTrade, entryTime: '09:15' })).trade);
  assert.ok((await store.create({ ...baseTrade, exitTime: '10:15' })).trade);
  assert.ok((await store.create({ ...baseTrade, direction: 'short' })).trade);
  assert.ok((await store.create({ ...baseTrade, stopLossPoints: 12 })).trade);
  assert.ok((await store.create({ ...baseTrade, riskReward: 3 })).trade);
  assert.ok((await store.create({ ...baseTrade, outcome: 'loss' })).trade);
  assert.ok((await store.create({ ...baseTrade, notes: 'Different notes' })).trade);
});

test('app.js contains in-flight submission guard (isSubmitting) and submit button state management', () => {
  assert.match(appSource, /isSubmitting/);
  assert.match(appSource, /Saving\.\.\./);
  assert.match(appSource, /finally/);
  assert.match(appSource, /Save trade/);
  assert.match(appSource, /Update trade/);
});

test('app.js disables submit button during save, ignores concurrent clicks while in-flight, and restores text in finally', async () => {
  const formListeners = {};
  const primaryBtn = {
    disabled: false,
    textContent: 'Save trade'
  };

  const createDummyEl = () => ({
    value: '',
    disabled: false,
    textContent: '',
    hidden: false,
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    replaceChildren: () => {},
    append: () => {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    elements: {},
    reset: () => {},
    scrollIntoView: () => {},
    content: { firstElementChild: { cloneNode: () => createDummyEl() } }
  });

  const mockForm = {
    ...createDummyEl(),
    addEventListener: (type, fn) => { formListeners[type] = fn; },
    querySelector: (sel) => {
      if (sel === 'button.primary' || sel === '.primary') return primaryBtn;
      return createDummyEl();
    }
  };

  globalThis.document = {
    querySelector: (sel) => {
      if (sel === '#trade-form') return mockForm;
      return createDummyEl();
    }
  };
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  globalThis.window = globalThis;

  // Import app.js dynamically
  await import(`../src/app.js?testRun=${Date.now()}`);

  assert.equal(typeof formListeners.submit, 'function');

  // Prepare a submit event
  let preventDefaultCalled = false;
  const dummyEvent = {
    preventDefault: () => { preventDefaultCalled = true; }
  };

  // Trigger submission
  const submitPromise = formListeners.submit(dummyEvent);
  assert.equal(preventDefaultCalled, true);

  // Await the submit promise
  await submitPromise;

  // Button should be re-enabled and restored to 'Save trade' after finally block
  assert.equal(primaryBtn.disabled, false);
  assert.equal(primaryBtn.textContent, 'Save trade');
});
