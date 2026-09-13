import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade, normalizeTrade, monthKey, tradesForDate, groupTradesByDate, durationInMinutes, tradeStats } from '../src/trades.js';

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

test('rejects missing date, invalid time, and non-positive risk values', () => {
  const result = validateTrade({ date: '', entryTime: '25:99', stopLossPoints: '0', riskReward: '-1' });
  assert.equal(result.date, 'Choose a trade date.');
  assert.equal(result.entryTime, 'Use a valid entry time.');
  assert.equal(result.stopLossPoints, 'Stop loss must be greater than 0 points.');
  assert.equal(result.riskReward, 'Risk-to-reward must be greater than 0.');
});

test('calculates duration across midnight', () => {
  assert.equal(durationInMinutes('23:45', '00:15'), 30);
});

test('summarizes wins, losses, average duration, and gold-point stop loss from entered trades', () => {
  const summary = tradeStats([
    { entryTime: '09:30', exitTime: '10:00', outcome: 'win', stopLossPoints: 10 },
    { entryTime: '23:45', exitTime: '00:15', outcome: 'loss', stopLossPoints: 20 },
    { entryTime: '08:00', exitTime: '09:30', outcome: 'win', stopLossPoints: 30 }
  ]);
  assert.deepEqual(summary, { totalWins: 2, totalLosses: 1, averageDurationMinutes: 50, averageStopLossPoints: 20 });
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
