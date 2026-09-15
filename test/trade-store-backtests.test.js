import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import { MOVED_TP_BACKTEST_ID, MOVED_TP_BACKTEST_NAME, NOT_MOVED_TP_BACKTEST_ID, NOT_MOVED_TP_BACKTEST_NAME } from '../src/backtests.js';

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

test('TradeStore migrates flat array from storage and lists parallel backtests', async () => {
  const flatData = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }
  ];
  const storage = memoryStorage(flatData);
  const store = new TradeStore({ storage, idFactory: () => 'id-1' });

  const listResult = await store.list();
  assert.equal(listResult.activeId, MOVED_TP_BACKTEST_ID);
  assert.equal(listResult.backtests.length, 2);
  assert.equal(listResult.backtests[0].name, MOVED_TP_BACKTEST_NAME);
  assert.equal(listResult.backtests[1].name, NOT_MOVED_TP_BACKTEST_NAME);
  assert.deepEqual(listResult.trades.map(t => t.id), ['t1']);

  const backtests = store.listBacktests();
  assert.equal(backtests.length, 2);
  assert.equal(backtests[0].name, MOVED_TP_BACKTEST_NAME);
});

test('TradeStore supports parallel backtests selection and trade operations', async () => {
  let idCounter = 100;
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.list();
  assert.equal(store.listBacktests().length, 2);
  assert.equal(store.getActiveBacktestId(), MOVED_TP_BACKTEST_ID);

  // Add trade pair
  await store.create({ date: '2026-09-14', entryTime: '09:30', exitTime: '10:00', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const movedTrades = (await store.list()).trades;
  assert.equal(movedTrades.length, 1);

  // Switch to Not Moved TP backtest
  await store.selectBacktest(NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(store.getActiveBacktestId(), NOT_MOVED_TP_BACKTEST_ID);
  const notMovedTrades = (await store.list()).trades;
  assert.equal(notMovedTrades.length, 1);
});

test('TradeStore persists multi-backtest structure in storage on trade mutations', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 't-100' });

  await store.create({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const rawSaved = JSON.parse(storage.getItem('gleb-gold-backtest.local-trades.v1'));
  assert.equal(typeof rawSaved, 'object');
  assert.equal(rawSaved.activeId, MOVED_TP_BACKTEST_ID);
  assert.equal(Array.isArray(rawSaved.backtests), true);
  assert.equal(rawSaved.backtests[0].trades[0].id, 't-100');
});
