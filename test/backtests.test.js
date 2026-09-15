import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBacktestsData,
  MOVED_TP_BACKTEST_ID,
  MOVED_TP_BACKTEST_NAME,
  NOT_MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_NAME
} from '../src/backtests.js';

test('normalizeBacktestsData produces fixed parallel backtests for null, undefined, or empty object', () => {
  for (const raw of [null, undefined, {}, { backtests: [] }]) {
    const result = normalizeBacktestsData(raw);
    assert.equal(result.activeId, MOVED_TP_BACKTEST_ID);
    assert.equal(result.backtests.length, 2);
    assert.equal(result.backtests[0].id, MOVED_TP_BACKTEST_ID);
    assert.equal(result.backtests[0].name, MOVED_TP_BACKTEST_NAME);
    assert.equal(result.backtests[1].id, NOT_MOVED_TP_BACKTEST_ID);
    assert.equal(result.backtests[1].name, NOT_MOVED_TP_BACKTEST_NAME);
    assert.deepEqual(result.backtests[0].trades, []);
    assert.deepEqual(result.backtests[1].trades, []);
  }
});

test('migrates flat trade array into both Moved TP and Not Moved TP backtests with pairId', () => {
  const flatTrades = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 },
    { id: 't2', date: '2026-09-13', entryTime: '11:00', exitTime: '12:00', direction: 'short', outcome: 'loss', stopLossPoints: 5, riskReward: -1 }
  ];
  const result = normalizeBacktestsData(flatTrades);
  assert.equal(result.activeId, MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests.length, 2);
  assert.equal(result.backtests[0].id, MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests[1].id, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests[0].trades.length, 2);
  assert.equal(result.backtests[1].trades.length, 2);
  assert.equal(result.backtests[0].trades[0].pairId, 't1');
  assert.equal(result.backtests[1].trades[0].pairId, 't1');
  assert.equal(result.backtests[0].trades[1].pairId, 't2');
  assert.equal(result.backtests[1].trades[1].pairId, 't2');
});

test('migrates legacy multi-backtest object into fixed parallel backtests', () => {
  const multiObject = {
    activeId: 'bt-2',
    backtests: [
      { id: 'bt-1', name: 'Strategy A', trades: [{ id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] },
      { id: 'bt-2', name: 'Strategy B', trades: [{ id: 't2', date: '2026-09-14', entryTime: '10:00', exitTime: '11:00', direction: 'short', outcome: 'win', stopLossPoints: 15, riskReward: 3 }] }
    ]
  };
  const result = normalizeBacktestsData(multiObject);
  assert.equal(result.activeId, MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests.length, 2);
  assert.equal(result.backtests[0].id, MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests[1].id, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(result.backtests[0].trades.length, 2);
  assert.equal(result.backtests[1].trades.length, 2);
});

test('preserves valid activeId when set to moved-tp or not-moved-tp', () => {
  const raw = {
    activeId: NOT_MOVED_TP_BACKTEST_ID,
    backtests: [
      { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: [] },
      { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: [] }
    ]
  };
  const result = normalizeBacktestsData(raw);
  assert.equal(result.activeId, NOT_MOVED_TP_BACKTEST_ID);
});
