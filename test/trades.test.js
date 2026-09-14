import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade, normalizeTrade, monthKey, tradesForDate, groupTradesByDate, durationInMinutes, riskRewardTotal, tradeStats } from '../src/trades.js';

test('requires an exit time for a complete XAU trade', () => {
  const result = validateTrade({
    date: '2026-09-13', entryTime: '09:30', stopLossPoints: '12.5', riskReward: '2.0', direction: 'long', outcome: 'win'
  });
  assert.equal(result.exitTime, 'Use a valid exit time.');
});

test('requires a win or loss outcome', () => {
  const result = validateTrade({
    date: '2026-09-13', entryTime: '09:30', exitTime: '10:00', stopLossPoints: '12.5', riskReward: '2.0'
  });
  assert.equal(result.outcome, 'Choose win or loss.');
});

test('accepts risk-to-reward values from -1 upward, including zero and fractional losses', () => {
  for (const riskReward of ['-1', '-0.5', '0', '2.5']) {
    assert.equal(validateTrade({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:00', stopLossPoints: '10', riskReward, outcome: 'win' }).riskReward, undefined);
  }
});

test('rejects missing date, invalid time, invalid stop loss, missing risk-to-reward, and risk-to-reward below -1', () => {
  const result = validateTrade({ date: '', entryTime: '25:99', stopLossPoints: '0', riskReward: '' });
  assert.equal(result.date, 'Choose a trade date.');
  assert.equal(result.entryTime, 'Use a valid entry time.');
  assert.equal(result.stopLossPoints, 'Stop loss must be greater than 0 points.');
  assert.equal(result.riskReward, 'Risk-to-reward must be at least -1.');
  assert.equal(validateTrade({ date: '2026-09-13', entryTime: '09:30', exitTime: '10:00', stopLossPoints: '10', riskReward: '-1.01', outcome: 'win' }).riskReward, 'Risk-to-reward must be at least -1.');
});

test('calculates duration across midnight', () => {
  assert.equal(durationInMinutes('23:45', '00:15'), 30);
});

test('summarizes existing totals plus direction and outcome splits from entered trades', () => {
  const summary = tradeStats([
    { entryTime: '09:30', exitTime: '10:00', direction: 'long', outcome: 'win', stopLossPoints: 10 },
    { entryTime: '23:45', exitTime: '00:15', direction: 'short', outcome: 'loss', stopLossPoints: 20 },
    { entryTime: '08:00', exitTime: '09:30', direction: 'long', outcome: 'win', stopLossPoints: 30 }
  ]);
  assert.deepEqual(summary, {
    totalWins: 2, totalLosses: 1, totalLong: 2, totalShort: 1,
    longWins: 2, longLosses: 0, shortWins: 0, shortLosses: 1,
    averageDurationMinutes: 50, averageStopLossPoints: 20,
    averageEntryTimeMinutes: 407.36, averageExitTimeMinutes: 477.59
  });
});

test('calculates circular entry and exit time averages across midnight', () => {
  const summary = tradeStats([
    { entryTime: '23:50', exitTime: '23:55', direction: 'long', outcome: 'win', stopLossPoints: 10 },
    { entryTime: '00:10', exitTime: '00:15', direction: 'short', outcome: 'loss', stopLossPoints: 10 }
  ]);
  assert.equal(summary.averageEntryTimeMinutes, 0);
  assert.equal(summary.averageExitTimeMinutes, 5);
});

test('sums valid risk-to-reward values for a calendar day', () => {
  assert.equal(riskRewardTotal([
    { riskReward: 1.5 }, { riskReward: -0.5 }, { riskReward: 'invalid' }
  ]), 1);
});

test('normalizes a trade without inventing trading data', () => {
  const trade = normalizeTrade({
    id: 'trade-1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:45', stopLossPoints: '12.50', riskReward: '2.0', direction: 'short', outcome: 'loss', notes: 'London setup'
  });
  assert.deepEqual(trade, {
    id: 'trade-1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:45', stopLossPoints: 12.5, riskReward: 2, direction: 'short', outcome: 'loss', notes: 'London setup'
  });
});

test('filters and groups trades by their ISO trade date', () => {
  const trades = [
    { id: 'a', date: '2026-09-13' }, { id: 'b', date: '2026-09-13' }, { id: 'c', date: '2026-10-01' }
  ];
  assert.equal(monthKey('2026-09-13'), '2026-09');
  assert.deepEqual(tradesForDate(trades, '2026-09-13').map((trade) => trade.id), ['a', 'b']);
  assert.deepEqual(Object.keys(groupTradesByDate(trades)), ['2026-09-13', '2026-10-01']);
});
