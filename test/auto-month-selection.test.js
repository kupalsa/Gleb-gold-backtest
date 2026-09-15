import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestTradeMonth } from '../src/trades.js';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('getLatestTradeMonth returns YYYY-MM of the latest trade by date in trades list', () => {
  const trades = [
    { date: '2024-03-15', entryTime: '09:00' },
    { date: '2025-11-20', entryTime: '14:00' },
    { date: '2025-01-10', entryTime: '10:00' }
  ];
  assert.equal(getLatestTradeMonth(trades), '2025-11');
});

test('getLatestTradeMonth falls back to current month when trades list is empty', () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  assert.equal(getLatestTradeMonth([]), currentMonth);
  assert.equal(getLatestTradeMonth(null), currentMonth);
});

test('app.js integrates getLatestTradeMonth for initial refresh auto-month selection', () => {
  assert.match(appSource, /getLatestTradeMonth/);
});
