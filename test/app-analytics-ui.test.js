import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('analytics UI renders circular time, direction splits, and daily aggregate R labels', () => {
  for (const label of [
    'Average entry time of day', 'Average exit time of day', 'Total long trades', 'Total short trades',
    'Long wins', 'Long losses', 'Short wins', 'Short losses', 'Total winning trades', 'R total', 'Total R'
  ]) assert.match(appSource, new RegExp(label));
});

test('risk-to-reward field exposes the -1 minimum and a keyboard that can enter a minus sign', () => {
  assert.match(html, /name="riskReward"[^>]*min="-1"/);
  assert.match(html, /name="riskReward"[^>]*inputmode="text"/);
});

test('take-profit move controls have clear choices and the initial scenario fieldset starts hidden', () => {
  assert.match(html, /Did I move the take profit\?/);
  assert.match(html, /Initial Scenario \(Without TP Move\)/);
  assert.match(html, /id="initial-scenario-fieldset"[^>]*hidden/);
  assert.match(appSource, /syncTakeProfitMoveFields/);
});

test('analytics UI renders take-profit movement statistics', () => {
  for (const label of ['Moved take profits', 'Good take-profit moves', 'Wasted take-profit moves']) assert.match(appSource, new RegExp(label));
});

test('trade UI offers an optional exit date and displays it conditionally without changing entry-date grouping', () => {
  assert.match(html, /name="exitDate"[^>]*type="date"(?![^>]*required)/);
  assert.match(html, /<th scope="col">Exit date<\/th>/);
  assert.match(appSource, /escapeText\(trade\.exitDate\)/);
  assert.match(appSource, /durationInMinutes\(trade\.entryTime, trade\.exitTime, trade\.date, trade\.exitDate\)/);
  assert.match(appSource, /tradesForDate\(state\.trades, state\.selectedDate\)/);
});
