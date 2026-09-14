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

test('requires a take-profit move result only when take profit was moved', () => {
  const base = { date: '2026-09-13', entryTime: '09:30', exitTime: '10:00', stopLossPoints: '12.5', riskReward: '2.0', outcome: 'win' };
  assert.equal(validateTrade({ ...base }).takeProfitMoveResult, undefined);
  assert.equal(validateTrade({ ...base, movedTakeProfit: 'no' }).takeProfitMoveResult, undefined);
  assert.equal(validateTrade({ ...base, movedTakeProfit: 'yes' }).takeProfitMoveResult, 'Choose what happened after moving the take profit.');
  assert.equal(validateTrade({ ...base, movedTakeProfit: 'yes', takeProfitMoveResult: 'good' }).takeProfitMoveResult, undefined);
  assert.equal(validateTrade({ ...base, movedTakeProfit: 'yes', takeProfitMoveResult: 'wasted' }).takeProfitMoveResult, undefined);
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

test('calculates duration across midnight when exit date is blank', () => {
  assert.equal(durationInMinutes('23:45', '00:15'), 30);
});

test('calculates elapsed duration across supplied entry and exit dates', () => {
  assert.equal(durationInMinutes('23:45', '00:15', '2026-09-13', '2026-09-15'), 1470);
});

test('rejects an exit date and time before the entry date and time', () => {
  const errors = validateTrade({ date: '2026-09-13', entryTime: '09:30', exitDate: '2026-09-13', exitTime: '09:29', stopLossPoints: '10', riskReward: '2', outcome: 'win' });
  assert.equal(errors.exitDate, 'Exit date and time cannot be before entry date and time.');
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
    movedTakeProfits: 0, goodTakeProfitMoves: 0, wastedTakeProfitMoves: 0,
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

test('includes supplied exit dates in average duration calculations', () => {
  const summary = tradeStats([{ date: '2026-09-13', entryTime: '23:45', exitDate: '2026-09-15', exitTime: '00:15', direction: 'long', outcome: 'win', stopLossPoints: 10 }]);
  assert.equal(summary.averageDurationMinutes, 1470);
});

test('reports zero-safe take-profit movement statistics', () => {
  const noMoves = tradeStats([]);
  assert.deepEqual({ movedTakeProfits: noMoves.movedTakeProfits, goodTakeProfitMoves: noMoves.goodTakeProfitMoves, wastedTakeProfitMoves: noMoves.wastedTakeProfitMoves }, {
    movedTakeProfits: 0, goodTakeProfitMoves: 0, wastedTakeProfitMoves: 0
  });
  const summary = tradeStats([
    { movedTakeProfit: 'yes', takeProfitMoveResult: 'good' },
    { movedTakeProfit: 'yes', takeProfitMoveResult: 'wasted' },
    { movedTakeProfit: 'no', takeProfitMoveResult: '' },
    {}
  ]);
  assert.deepEqual({ movedTakeProfits: summary.movedTakeProfits, goodTakeProfitMoves: summary.goodTakeProfitMoves, wastedTakeProfitMoves: summary.wastedTakeProfitMoves }, {
    movedTakeProfits: 2, goodTakeProfitMoves: 1, wastedTakeProfitMoves: 1
  });
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

test('normalizes optional take-profit movement values without changing prior records', () => {
  const base = { id: 'trade-1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:45', stopLossPoints: '12.50', riskReward: '2.0', direction: 'short', outcome: 'loss', notes: 'London setup' };
  assert.deepEqual(normalizeTrade(base), { ...base, stopLossPoints: 12.5, riskReward: 2 });
  assert.deepEqual(normalizeTrade({ ...base, movedTakeProfit: 'yes', takeProfitMoveResult: 'good' }), {
    ...base, stopLossPoints: 12.5, riskReward: 2, movedTakeProfit: 'yes', takeProfitMoveResult: 'good'
  });
});

test('normalizes a supplied exit date while leaving legacy records without one unchanged', () => {
  const base = { id: 'trade-1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:45', stopLossPoints: '12.50', riskReward: '2.0', direction: 'short', outcome: 'loss', notes: 'London setup' };
  assert.deepEqual(normalizeTrade(base), { ...base, stopLossPoints: 12.5, riskReward: 2 });
  assert.deepEqual(normalizeTrade({ ...base, exitDate: '2026-09-15' }), { ...base, exitDate: '2026-09-15', stopLossPoints: 12.5, riskReward: 2 });
});

test('filters and groups trades by their ISO trade date', () => {
  const trades = [
    { id: 'a', date: '2026-09-13' }, { id: 'b', date: '2026-09-13' }, { id: 'c', date: '2026-10-01' }
  ];
  assert.equal(monthKey('2026-09-13'), '2026-09');
  assert.deepEqual(tradesForDate(trades, '2026-09-13').map((trade) => trade.id), ['a', 'b']);
  assert.deepEqual(Object.keys(groupTradesByDate(trades)), ['2026-09-13', '2026-10-01']);
});
