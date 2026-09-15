import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import { VOL2_BACKTEST_ID, MOVED_TP_BACKTEST_ID, NOT_MOVED_TP_BACKTEST_ID } from '../src/backtests.js';

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

test('TradeStore creates single trade duplicated across both backtests when movedTakeProfit is no', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 'pair-123' });

  await store.list();
  const result = await store.create({
    date: '2026-09-15',
    entryTime: '09:00',
    exitDate: '2026-09-15',
    exitTime: '10:00',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 2,
    movedTakeProfit: 'no',
    notes: 'Test trade'
  });

  assert.equal(result.trade.pairId, 'pair-123');
  const data = store.getData();
  const vol2 = data.backtests.find((b) => b.id === VOL2_BACKTEST_ID);
  const movedBt = vol2.subBacktests.find((b) => b.id === MOVED_TP_BACKTEST_ID);
  const notMovedBt = vol2.subBacktests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID);

  assert.equal(movedBt.trades.length, 1);
  assert.equal(notMovedBt.trades.length, 1);
  assert.equal(movedBt.trades[0].pairId, 'pair-123');
  assert.equal(notMovedBt.trades[0].pairId, 'pair-123');
  assert.equal(movedBt.trades[0].riskReward, 2);
  assert.equal(notMovedBt.trades[0].riskReward, 2);
});

test('TradeStore creates paired trade with initial scenario when movedTakeProfit is yes', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 'pair-456' });

  await store.list();
  const result = await store.create({
    date: '2026-09-15',
    entryTime: '09:00',
    exitDate: '2026-09-15',
    exitTime: '11:00',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 4,
    movedTakeProfit: 'yes',
    initialExitDate: '2026-09-15',
    initialExitTime: '10:00',
    initialOutcome: 'win',
    initialRiskReward: 2,
    notes: 'TP moved extended win'
  });

  const data = store.getData();
  const vol2 = data.backtests.find((b) => b.id === VOL2_BACKTEST_ID);
  const movedTrade = vol2.subBacktests.find((b) => b.id === MOVED_TP_BACKTEST_ID).trades[0];
  const notMovedTrade = vol2.subBacktests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID).trades[0];

  assert.equal(movedTrade.pairId, 'pair-456');
  assert.equal(notMovedTrade.pairId, 'pair-456');

  // Moved TP trade uses moved exit values
  assert.equal(movedTrade.exitTime, '11:00');
  assert.equal(movedTrade.riskReward, 4);

  // Not Moved TP trade uses initial scenario values
  assert.equal(notMovedTrade.exitTime, '10:00');
  assert.equal(notMovedTrade.riskReward, 2);
});

test('TradeStore update updates paired trade across both backtests by pairId', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 'pair-789' });

  await store.list();
  await store.create({
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:00',
    direction: 'short',
    outcome: 'loss',
    stopLossPoints: 15,
    riskReward: -1,
    movedTakeProfit: 'no'
  });

  // Update trade pair
  await store.update('pair-789', {
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:30',
    direction: 'short',
    outcome: 'win',
    stopLossPoints: 15,
    riskReward: 1.5,
    movedTakeProfit: 'no'
  });

  const data = store.getData();
  const vol2 = data.backtests.find((b) => b.id === VOL2_BACKTEST_ID);
  const movedTrade = vol2.subBacktests.find((b) => b.id === MOVED_TP_BACKTEST_ID).trades[0];
  const notMovedTrade = vol2.subBacktests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID).trades[0];

  assert.equal(movedTrade.outcome, 'win');
  assert.equal(movedTrade.riskReward, 1.5);
  assert.equal(notMovedTrade.outcome, 'win');
  assert.equal(notMovedTrade.riskReward, 1.5);
});

test('TradeStore remove deletes paired trade across both backtests by pairId', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 'pair-999' });

  await store.list();
  await store.create({
    date: '2026-09-15',
    entryTime: '09:00',
    exitTime: '10:00',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 2,
    movedTakeProfit: 'no'
  });

  const vol2Before = store.getData().backtests.find((b) => b.id === VOL2_BACKTEST_ID);
  assert.equal(vol2Before.subBacktests[0].trades.length, 1);
  assert.equal(vol2Before.subBacktests[1].trades.length, 1);

  await store.remove('pair-999');

  const vol2After = store.getData().backtests.find((b) => b.id === VOL2_BACKTEST_ID);
  assert.equal(vol2After.subBacktests[0].trades.length, 0);
  assert.equal(vol2After.subBacktests[1].trades.length, 0);
});

test('TradeStore selectBacktest switches active backtest sub-tab view between moved-tp and not-moved-tp', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ storage, idFactory: () => 'pair-1' });

  await store.list();
  assert.equal(store.getActiveBacktestId(), VOL2_BACKTEST_ID);

  await store.selectBacktest(NOT_MOVED_TP_BACKTEST_ID);
  const listRes = await store.list();
  assert.equal(listRes.activeId, VOL2_BACKTEST_ID);
  assert.equal(listRes.activeTabId, NOT_MOVED_TP_BACKTEST_ID);
});
