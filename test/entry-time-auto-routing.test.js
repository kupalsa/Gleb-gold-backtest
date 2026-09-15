import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import { getVol2TargetSuiteId, VOL2_BACKTEST_ID, VOL2_NY_BACKTEST_ID, VOL1_BACKTEST_ID } from '../src/backtests.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('getVol2TargetSuiteId routes 00:00-11:59 to vol-2 and 12:00-23:59 to vol-2-ny', () => {
  assert.equal(getVol2TargetSuiteId('00:00'), VOL2_BACKTEST_ID);
  assert.equal(getVol2TargetSuiteId('08:30'), VOL2_BACKTEST_ID);
  assert.equal(getVol2TargetSuiteId('11:59'), VOL2_BACKTEST_ID);

  assert.equal(getVol2TargetSuiteId('12:00'), VOL2_NY_BACKTEST_ID);
  assert.equal(getVol2TargetSuiteId('15:45'), VOL2_NY_BACKTEST_ID);
  assert.equal(getVol2TargetSuiteId('23:59'), VOL2_NY_BACKTEST_ID);
});

test('TradeStore.create auto-routes trades in Vol 2 suites based on entry time and updates activeId', async () => {
  const storage = memoryStorage();
  let idCounter = 1;
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  // 1. Initial state: activeId is vol-2
  const initial = await store.list();
  assert.equal(initial.activeId, VOL2_BACKTEST_ID);

  // 2. Create trade in vol-2 with entryTime 14:30 (12:00-23:59) -> auto-routes to vol-2-ny
  const tradeNY = await store.create({
    date: '2026-09-15',
    entryTime: '14:30',
    exitTime: '15:30',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 2
  });

  assert.ok(tradeNY.trade);
  // activeId should now be vol-2-ny
  const afterNY = await store.list();
  assert.equal(afterNY.activeId, VOL2_NY_BACKTEST_ID);
  assert.equal(afterNY.trades.length, 1);
  assert.equal(afterNY.trades[0].entryTime, '14:30');

  // 3. From vol-2-ny active, create trade with entryTime 09:15 (00:00-11:59) -> auto-routes back to vol-2
  const tradeAsian = await store.create({
    date: '2026-09-15',
    entryTime: '09:15',
    exitTime: '10:00',
    direction: 'short',
    outcome: 'win',
    stopLossPoints: 12,
    riskReward: 1.5
  });

  assert.ok(tradeAsian.trade);
  // activeId should now be vol-2
  const afterAsian = await store.list();
  assert.equal(afterAsian.activeId, VOL2_BACKTEST_ID);
  assert.equal(afterAsian.trades.length, 1);
  assert.equal(afterAsian.trades[0].entryTime, '09:15');
});

test('TradeStore.create does not auto-route when active suite is not a Vol 2 suite (e.g. Vol 1)', async () => {
  const storage = memoryStorage();
  let idCounter = 100;
  const store = new TradeStore({ storage, idFactory: () => `id-${idCounter++}` });

  await store.selectBacktest(VOL1_BACKTEST_ID);
  const initial = await store.list();
  assert.equal(initial.activeId, VOL1_BACKTEST_ID);

  // Create trade in vol-1 with NY time entryTime 15:00
  await store.create({
    date: '2026-09-15',
    entryTime: '15:00',
    exitTime: '16:00',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 8,
    riskReward: 2
  });

  // Active suite remains vol-1
  const after = await store.list();
  assert.equal(after.activeId, VOL1_BACKTEST_ID);
  assert.equal(after.trades.length, 1);
  assert.equal(after.trades[0].entryTime, '15:00');
});
