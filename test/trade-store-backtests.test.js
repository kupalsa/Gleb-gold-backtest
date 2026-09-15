import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import {
  VOL2_BACKTEST_ID,
  VOL2_BACKTEST_NAME,
  VOL1_BACKTEST_ID,
  VOL1_BACKTEST_NAME,
  MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_ID
} from '../src/backtests.js';

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

test('TradeStore migrates flat array from storage and lists top-level backtests Vol 2 and Vol 1', async () => {
  const flatData = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }
  ];
  const storage = memoryStorage(flatData);
  const store = new TradeStore({ storage, idFactory: () => 'id-1' });

  const listResult = await store.list();
  assert.equal(listResult.activeId, VOL2_BACKTEST_ID);
  assert.equal(listResult.backtests.length, 2);
  assert.equal(listResult.backtests[0].name, VOL2_BACKTEST_NAME);
  assert.equal(listResult.backtests[1].name, VOL1_BACKTEST_NAME);
  assert.deepEqual(listResult.trades.map(t => t.id), ['t1']);

  const backtests = store.listBacktests();
  assert.equal(backtests.length, 2);
  assert.equal(backtests[0].name, VOL2_BACKTEST_NAME);
  assert.equal(backtests[1].name, VOL1_BACKTEST_NAME);
});

test('TradeStore supports top-level backtest selection and trade operations', async () => {
  let idCounter = 100;
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.list();
  assert.equal(store.listBacktests().length, 2);
  assert.equal(store.getActiveBacktestId(), VOL2_BACKTEST_ID);

  // Add trade pair to Vol 2
  await store.create({ date: '2026-09-14', entryTime: '09:30', exitTime: '10:00', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const vol2Trades = (await store.list()).trades;
  assert.equal(vol2Trades.length, 1);

  // Switch to Vol 1 backtest
  await store.selectBacktest(VOL1_BACKTEST_ID);
  assert.equal(store.getActiveBacktestId(), VOL1_BACKTEST_ID);
  const vol1Trades = (await store.list()).trades;
  assert.equal(vol1Trades.length, 0);

  // Add trade directly to Vol 1
  await store.create({ date: '2026-09-15', entryTime: '08:00', exitTime: '09:00', direction: 'short', outcome: 'win', stopLossPoints: 5, riskReward: 1 });
  const updatedVol1Trades = (await store.list()).trades;
  assert.equal(updatedVol1Trades.length, 1);
  assert.equal(updatedVol1Trades[0].direction, 'short');
});

test('TradeStore persists multi-backtest structure in storage on trade mutations', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 't-100' });

  await store.list();
  await store.create({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const rawSaved = JSON.parse(storage.getItem('gleb-gold-backtest.local-trades.v1'));
  assert.equal(typeof rawSaved, 'object');
  assert.equal(rawSaved.activeId, VOL2_BACKTEST_ID);
  assert.equal(Array.isArray(rawSaved.backtests), true);
  assert.equal(rawSaved.backtests[0].subBacktests[0].trades[0].id, 't-100');
});
