import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestTradeMonth, getLatestTradeDate } from '../src/trades.js';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('getLatestTradeDate returns the latest full date across all backtests and Vol 2 subBacktests', () => {
  const backtests = [
    { id: 'vol-1', trades: [{ date: '2025-01-20' }] },
    { id: 'vol-2', subBacktests: [{ trades: [{ date: '2025-01-21' }] }] },
    { id: 'vol-2-ny', subBacktests: [{ trades: [{ date: '2025-01-22' }] }] }
  ];

  assert.equal(getLatestTradeDate([], backtests), '2025-01-22');
});

test('getLatestTradeMonth returns YYYY-MM of the latest trade by date in trades list', () => {
  const trades = [
    { date: '2024-03-15', entryTime: '09:00' },
    { date: '2025-11-20', entryTime: '14:00' },
    { date: '2025-01-10', entryTime: '10:00' }
  ];
  assert.equal(getLatestTradeMonth(trades), '2025-11');
});

test('getLatestTradeMonth falls back to current month when trades list and backtests are empty', () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  assert.equal(getLatestTradeMonth([]), currentMonth);
  assert.equal(getLatestTradeMonth(null), currentMonth);
});

test('getLatestTradeMonth falls back to latest trade month across all backtests when active trades is empty', () => {
  const backtests = [
    {
      id: 'vol-2',
      name: 'Vol 2 Asian',
      subBacktests: [
        { id: 'moved-tp', trades: [] },
        { id: 'not-moved-tp', trades: [] }
      ]
    },
    {
      id: 'vol-1',
      name: 'Vol 1 Asian',
      trades: [
        { date: '2024-12-10' },
        { date: '2025-01-20' }
      ]
    }
  ];

  assert.equal(getLatestTradeMonth([], backtests), '2025-01');
});

test('getLatestTradeMonth returns max trade month across subBacktests when top-level trades are empty', () => {
  const backtests = [
    {
      id: 'vol-2',
      name: 'Vol 2 Asian',
      subBacktests: [
        { id: 'moved-tp', trades: [{ date: '2025-03-10' }] },
        { id: 'not-moved-tp', trades: [{ date: '2025-02-15' }] }
      ]
    },
    {
      id: 'vol-1',
      name: 'Vol 1 Asian',
      trades: []
    }
  ];

  assert.equal(getLatestTradeMonth([], backtests), '2025-03');
});

test('getLatestTradeMonth returns fallbackMonth when active trades and all backtests are empty', () => {
  const backtests = [
    { id: 'vol-2', subBacktests: [{ trades: [] }] },
    { id: 'vol-1', trades: [] }
  ];
  assert.equal(getLatestTradeMonth([], backtests, '2026-01'), '2026-01');
});

test('getLatestTradeMonth prefers active trades over other backtests when active trades are present', () => {
  const activeTrades = [{ date: '2025-08-15' }];
  const backtests = [
    { id: 'vol-1', trades: [{ date: '2025-12-01' }] }
  ];
  assert.equal(getLatestTradeMonth(activeTrades, backtests), '2025-08');
});

test('app.js integrates getLatestTradeMonth with store.listBacktests() on every refresh', () => {
  assert.match(appSource, /state\.month\s*=\s*getLatestTradeMonth\(\s*state\.trades\s*,\s*store\.listBacktests\(\)\s*\)/);
});

test('app.js prefills blank new forms on initial refresh, after save, and after canceling an edit without changing edit form values', () => {
  assert.match(appSource, /import\s*\{\s*prefillTradeFormDates\s*\}\s*from\s*'\.\/trade-form-date-prefill\.js'/);
  assert.match(appSource, /prefillTradeFormDates\(\s*form\s*,\s*getLatestTradeDate\(\s*state\.trades\s*,\s*store\.listBacktests\(\)\s*\)\s*\)/);
  assert.match(appSource, /function clearForm\(\)\s*\{[\s\S]*?form\.reset\(\);[\s\S]*?prefillTradeFormDates\(/);
  assert.match(appSource, /clearForm\(\);\s*await refresh\(\);/);
  assert.match(appSource, /#cancel-edit'\)\.addEventListener\('click', clearForm\)/);
});
