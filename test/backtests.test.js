import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBacktestsData, DEFAULT_BACKTEST_ID, DEFAULT_BACKTEST_NAME } from '../src/backtests.js';

test('migrates flat trade array into default backtest', () => {
  const flatTrades = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 },
    { id: 't2', date: '2026-09-13', entryTime: '11:00', exitTime: '12:00', direction: 'short', outcome: 'loss', stopLossPoints: 5, riskReward: -1 }
  ];
  const result = normalizeBacktestsData(flatTrades);
  assert.equal(result.activeId, DEFAULT_BACKTEST_ID);
  assert.equal(result.backtests.length, 1);
  assert.equal(result.backtests[0].id, DEFAULT_BACKTEST_ID);
  assert.equal(result.backtests[0].name, DEFAULT_BACKTEST_NAME);
  assert.deepEqual(result.backtests[0].trades.map(t => t.id), ['t1', 't2']);
});

test('loads multi-backtest object and preserves active backtest selection', () => {
  const multiObject = {
    activeId: 'bt-2',
    backtests: [
      { id: 'bt-1', name: 'Strategy A', trades: [{ id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] },
      { id: 'bt-2', name: 'Strategy B', trades: [{ id: 't2', date: '2026-09-14', entryTime: '10:00', exitTime: '11:00', direction: 'short', outcome: 'win', stopLossPoints: 15, riskReward: 3 }] }
    ]
  };
  const result = normalizeBacktestsData(multiObject);
  assert.equal(result.activeId, 'bt-2');
  assert.equal(result.backtests.length, 2);
  assert.equal(result.backtests[0].name, 'Strategy A');
  assert.equal(result.backtests[1].name, 'Strategy B');
});

test('falls back to first backtest ID if activeId is invalid or missing', () => {
  const multiObject = {
    activeId: 'non-existent-id',
    backtests: [
      { id: 'bt-1', name: 'Strategy A', trades: [] },
      { id: 'bt-2', name: 'Strategy B', trades: [] }
    ]
  };
  const result = normalizeBacktestsData(multiObject);
  assert.equal(result.activeId, 'bt-1');
});

test('handles null, undefined, or empty object gracefully by returning default backtest', () => {
  for (const raw of [null, undefined, {}, { backtests: [] }]) {
    const result = normalizeBacktestsData(raw);
    assert.equal(result.activeId, DEFAULT_BACKTEST_ID);
    assert.equal(result.backtests.length, 1);
    assert.equal(result.backtests[0].id, DEFAULT_BACKTEST_ID);
    assert.equal(result.backtests[0].name, DEFAULT_BACKTEST_NAME);
    assert.deepEqual(result.backtests[0].trades, []);
  }
});
