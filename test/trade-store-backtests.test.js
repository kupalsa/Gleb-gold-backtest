import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';

const memoryStorage = (initialData = null) => {
  const values = new Map();
  if (initialData !== null) {
    values.set('gleb-gold-backtest.local-trades.v1', typeof initialData === 'string' ? initialData : JSON.stringify(initialData));
  }
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('TradeStore migrates flat array from storage and lists backtests', async () => {
  const flatData = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }
  ];
  const storage = memoryStorage(flatData);
  const store = new TradeStore({ storage, idFactory: () => 'id-1' });

  const listResult = await store.list();
  assert.equal(listResult.activeId, 'default');
  assert.equal(listResult.backtests.length, 1);
  assert.equal(listResult.backtests[0].name, 'Main Backtest');
  assert.deepEqual(listResult.trades.map(t => t.id), ['t1']);

  const backtests = store.listBacktests();
  assert.equal(backtests.length, 1);
  assert.equal(backtests[0].name, 'Main Backtest');
});

test('TradeStore supports createBacktest, selectBacktest, renameBacktest, and deleteBacktest', async () => {
  let idCounter = 100;
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.list(); // initialize
  assert.equal(store.listBacktests().length, 1);

  // 1. Create backtest
  const created = await store.createBacktest('Breakout Strategy');
  assert.equal(created.name, 'Breakout Strategy');
  assert.equal(store.listBacktests().length, 2);
  assert.equal(store.getActiveBacktestId(), created.id);

  // 2. Add trade to new backtest
  await store.create({ date: '2026-09-14', entryTime: '09:30', exitTime: '10:00', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const newBtTrades = (await store.list()).trades;
  assert.equal(newBtTrades.length, 1);

  // 3. Switch back to default backtest
  await store.selectBacktest('default');
  assert.equal(store.getActiveBacktestId(), 'default');
  const defaultTrades = (await store.list()).trades;
  assert.equal(defaultTrades.length, 0);

  // 4. Rename backtest
  await store.renameBacktest('default', 'Primary Gold Strategy');
  assert.equal(store.listBacktests().find(b => b.id === 'default').name, 'Primary Gold Strategy');

  // 5. Delete backtest
  await store.selectBacktest(created.id);
  assert.equal(store.getActiveBacktestId(), created.id);
  await store.deleteBacktest(created.id);
  assert.equal(store.listBacktests().length, 1);
  assert.equal(store.getActiveBacktestId(), 'default'); // switched back automatically

  // 6. Delete last remaining backtest throws error
  await assert.rejects(() => store.deleteBacktest('default'), /Cannot delete the only remaining backtest/);
});

test('TradeStore persists multi-backtest structure in storage on trade mutations', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 't-100' });

  await store.create({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const rawSaved = JSON.parse(storage.getItem('gleb-gold-backtest.local-trades.v1'));
  assert.equal(typeof rawSaved, 'object');
  assert.equal(rawSaved.activeId, 'default');
  assert.equal(Array.isArray(rawSaved.backtests), true);
  assert.equal(rawSaved.backtests[0].trades[0].id, 't-100');
});
