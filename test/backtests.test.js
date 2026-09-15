import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBacktestsData,
  VOL2_BACKTEST_ID,
  VOL2_BACKTEST_NAME,
  VOL1_BACKTEST_ID,
  VOL1_BACKTEST_NAME,
  MOVED_TP_BACKTEST_ID,
  MOVED_TP_BACKTEST_NAME,
  NOT_MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_NAME
} from '../src/backtests.js';

test('normalizeBacktestsData produces Gold Backtest Vol. 2 and Gold Backtest Vol. 1 for null, undefined, or empty object', () => {
  for (const raw of [null, undefined, {}, { backtests: [] }]) {
    const result = normalizeBacktestsData(raw);
    assert.equal(result.activeId, VOL2_BACKTEST_ID);
    assert.equal(result.backtests.length, 2);
    const vol2 = result.backtests[0];
    assert.equal(vol2.id, VOL2_BACKTEST_ID);
    assert.equal(vol2.name, VOL2_BACKTEST_NAME);
    assert.equal(vol2.activeTabId, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2.subBacktests.length, 2);
    assert.equal(vol2.subBacktests[0].id, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2.subBacktests[0].name, MOVED_TP_BACKTEST_NAME);
    assert.equal(vol2.subBacktests[1].id, NOT_MOVED_TP_BACKTEST_ID);
    assert.equal(vol2.subBacktests[1].name, NOT_MOVED_TP_BACKTEST_NAME);
    assert.deepEqual(vol2.subBacktests[0].trades, []);
    assert.deepEqual(vol2.subBacktests[1].trades, []);

    const vol1 = result.backtests[1];
    assert.equal(vol1.id, VOL1_BACKTEST_ID);
    assert.equal(vol1.name, VOL1_BACKTEST_NAME);
    assert.deepEqual(vol1.trades, []);
  }
});

test('normalizeBacktestsData migrates flat trade array into both Vol 1 (50 original trades) and Vol 2 (paired trades)', () => {
  const flatTrades = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 },
    { id: 't2', date: '2026-09-13', entryTime: '11:00', exitTime: '12:00', direction: 'short', outcome: 'loss', stopLossPoints: 5, riskReward: -1 }
  ];
  const result = normalizeBacktestsData(flatTrades);
  assert.equal(result.activeId, VOL2_BACKTEST_ID);
  assert.equal(result.backtests.length, 2);

  const vol2 = result.backtests.find(b => b.id === VOL2_BACKTEST_ID);
  assert.ok(vol2);
  assert.equal(vol2.subBacktests[0].trades.length, 2);
  assert.equal(vol2.subBacktests[1].trades.length, 2);

  const vol1 = result.backtests.find(b => b.id === VOL1_BACKTEST_ID);
  assert.ok(vol1);
  assert.equal(vol1.trades.length, 2);
  assert.equal(vol1.trades[0].id, 't1');
  assert.equal(vol1.trades[1].id, 't2');
});

test('normalizeBacktestsData preserves custom backtests alongside Vol 2 and Vol 1', () => {
  const raw = {
    activeId: 'custom-1',
    backtests: [
      { id: VOL2_BACKTEST_ID, name: VOL2_BACKTEST_NAME, subBacktests: [
        { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: [] },
        { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: [] }
      ]},
      { id: VOL1_BACKTEST_ID, name: VOL1_BACKTEST_NAME, trades: [{ id: 'v1-t1', date: '2026-01-01', entryTime: '08:00', exitTime: '09:00', direction: 'long', outcome: 'win', stopLossPoints: 5, riskReward: 1 }] },
      { id: 'custom-1', name: 'My Strategy', trades: [{ id: 'c1-t1', date: '2026-09-13', entryTime: '10:00', exitTime: '11:00', direction: 'long', outcome: 'win', stopLossPoints: 8, riskReward: 2 }] }
    ]
  };
  const result = normalizeBacktestsData(raw);
  assert.equal(result.activeId, 'custom-1');
  assert.equal(result.backtests.length, 3);
  assert.equal(result.backtests[0].id, VOL2_BACKTEST_ID);
  assert.equal(result.backtests[1].id, VOL1_BACKTEST_ID);
  assert.equal(result.backtests[2].id, 'custom-1');
  assert.equal(result.backtests[1].trades.length, 1);
  assert.equal(result.backtests[2].trades.length, 1);
});

test('normalizeBacktestsData converts legacy top-level moved-tp and not-moved-tp backtests into Vol 2 subBacktests', () => {
  const legacyObj = {
    activeId: NOT_MOVED_TP_BACKTEST_ID,
    backtests: [
      { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: [{ id: 't1', pairId: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] },
      { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: [{ id: 't1', pairId: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] }
    ]
  };
  const result = normalizeBacktestsData(legacyObj);
  assert.equal(result.activeId, VOL2_BACKTEST_ID);

  const vol2 = result.backtests.find(b => b.id === VOL2_BACKTEST_ID);
  assert.ok(vol2);
  assert.equal(vol2.activeTabId, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(vol2.subBacktests[0].trades.length, 1);

  const vol1 = result.backtests.find(b => b.id === VOL1_BACKTEST_ID);
  assert.ok(vol1);
  // Preserves trades in Vol 1 when migrated from legacy
  assert.equal(vol1.trades.length, 1);
});
