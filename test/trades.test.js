import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade, normalizeTrade, monthKey, tradesForDate, groupTradesByDate } from '../src/trades.js';

test('validates a complete XAU trade with a positive stop and risk-to-reward', () => {
  const result = validateTrade({
    date: '2026-09-13', entryTime: '09:30', stopLossPoints: '12.5', riskReward: '2.0', direction: 'long'
  });
  assert.deepEqual(result, {});
});

test('rejects missing date, invalid time, and non-positive risk values', () => {
  const result = validateTrade({ date: '', entryTime: '25:99', stopLossPoints: '0', riskReward: '-1' });
  assert.equal(result.date, 'Choose a trade date.');
  assert.equal(result.entryTime, 'Use a valid entry time.');
  assert.equal(result.stopLossPoints, 'Stop loss must be greater than 0 points.');
  assert.equal(result.riskReward, 'Risk-to-reward must be greater than 0.');
});

test('normalizes a trade without inventing trading data', () => {
  const trade = normalizeTrade({
    id: 'trade-1', date: '2026-09-13', entryTime: '09:30', stopLossPoints: '12.50', riskReward: '2.0', direction: 'short', notes: 'London setup'
  });
  assert.deepEqual(trade, {
    id: 'trade-1', date: '2026-09-13', entryTime: '09:30', stopLossPoints: 12.5, riskReward: 2, direction: 'short', notes: 'London setup'
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
