import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import {
  VOL2_BACKTEST_ID,
  VOL2_BACKTEST_NAME,
  VOL2_NY_BACKTEST_ID,
  VOL2_NY_BACKTEST_NAME,
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

test('TradeStore lists default backtests Vol 2 (Asian), Vol 2 (NY), and Vol 1 (Asian)', async () => {
  const flatData = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }
  ];
  const storage = memoryStorage(flatData);
  const store = new TradeStore({ storage, idFactory: () => 'id-1' });

  const listResult = await store.list();
  assert.equal(listResult.activeId, VOL2_BACKTEST_ID);
  assert.equal(listResult.backtests.length, 3);
  assert.equal(listResult.backtests[0].name, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(listResult.backtests[1].name, 'Gold Backtest Vol. 2 (New York Time)');
  assert.equal(listResult.backtests[2].name, 'Gold Backtest Vol. 1 (Asian)');
  assert.deepEqual(listResult.trades, []);

  await store.selectBacktest(VOL1_BACKTEST_ID);
  const vol1List = await store.list();
  assert.deepEqual(vol1List.trades.map(t => t.id), ['t1']);

  const backtests = store.listBacktests();
  assert.equal(backtests.length, 3);
  assert.equal(backtests[0].name, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(backtests[1].name, 'Gold Backtest Vol. 2 (New York Time)');
  assert.equal(backtests[2].name, 'Gold Backtest Vol. 1 (Asian)');
});

test('TradeStore supports Vol 2 (New York Time) selection, sub-tab switching, and paired trade entry', async () => {
  let idCounter = 100;
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.list();
  assert.equal(store.listBacktests().length, 3);

  // Switch to Vol 2 (New York Time)
  await store.selectBacktest(VOL2_NY_BACKTEST_ID);
  assert.equal(store.getActiveBacktestId(), VOL2_NY_BACKTEST_ID);

  const initialNyList = await store.list();
  assert.equal(initialNyList.activeId, VOL2_NY_BACKTEST_ID);
  assert.equal(initialNyList.activeTabId, MOVED_TP_BACKTEST_ID);
  assert.equal(initialNyList.trades.length, 0);

  // Create paired trade in Vol 2 (New York Time)
  await store.create({
    date: '2026-09-14',
    entryTime: '14:30',
    exitTime: '15:30',
    direction: 'short',
    outcome: 'win',
    stopLossPoints: 12,
    riskReward: 3,
    movedTakeProfit: 'yes',
    initialExitDate: '2026-09-14',
    initialExitTime: '15:00',
    initialOutcome: 'win',
    initialRiskReward: 1.5
  });

  const nyMovedTrades = (await store.list()).trades;
  assert.equal(nyMovedTrades.length, 1);
  assert.equal(nyMovedTrades[0].riskReward, 3);

  // Switch sub-tab inside Vol 2 (NY) to Not Moved TP
  await store.selectBacktest(NOT_MOVED_TP_BACKTEST_ID);
  const nyNotMovedList = await store.list();
  assert.equal(nyNotMovedList.activeId, VOL2_NY_BACKTEST_ID);
  assert.equal(nyNotMovedList.activeTabId, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(nyNotMovedList.trades.length, 1);
  assert.equal(nyNotMovedList.trades[0].riskReward, 1.5);

  // Asian Vol 2 should remain unaffected (empty)
  await store.selectBacktest(VOL2_BACKTEST_ID);
  const asianList = await store.list();
  assert.equal(asianList.trades.length, 0);
});

test('TradeStore supports top-level backtest selection across all 3 suites and trade operations', async () => {
  let idCounter = 100;
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.list();
  assert.equal(store.listBacktests().length, 3);

  // Add trade pair to Vol 2 Asian
  await store.create({ date: '2026-09-14', entryTime: '09:30', exitTime: '10:00', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const vol2Trades = (await store.list()).trades;
  assert.equal(vol2Trades.length, 1);

  // Switch to Vol 1 Asian backtest
  await store.selectBacktest(VOL1_BACKTEST_ID);
  assert.equal(store.getActiveBacktestId(), VOL1_BACKTEST_ID);
  const vol1Trades = (await store.list()).trades;
  assert.equal(vol1Trades.length, 0);

  // Add trade directly to Vol 1 Asian
  await store.create({ date: '2026-09-15', entryTime: '08:00', exitTime: '09:00', direction: 'short', outcome: 'win', stopLossPoints: 5, riskReward: 1 });
  const updatedVol1Trades = (await store.list()).trades;
  assert.equal(updatedVol1Trades.length, 1);
  assert.equal(updatedVol1Trades[0].direction, 'short');
});

test('TradeStore persists multi-backtest structure with NY suite in storage on trade mutations', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 't-100' });

  await store.list();
  await store.create({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 });
  const rawSaved = JSON.parse(storage.getItem('gleb-gold-backtest.local-trades.v1'));
  assert.equal(typeof rawSaved, 'object');
  assert.equal(rawSaved.activeId, VOL2_BACKTEST_ID);
  assert.equal(Array.isArray(rawSaved.backtests), true);
  assert.equal(rawSaved.backtests.length, 3);
  assert.equal(rawSaved.backtests[1].id, VOL2_NY_BACKTEST_ID);
  assert.equal(rawSaved.backtests[0].subBacktests[0].trades[0].id, 't-100');
});
