import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('analytics UI renders circular time, direction splits, and daily aggregate R labels', () => {
  for (const label of [
    'Average entry time of day', 'Average exit time of day', 'Total long trades', 'Total short trades',
    'Long wins', 'Long losses', 'Short wins', 'Short losses', 'Total winning trades', 'R total'
  ]) assert.match(appSource, new RegExp(label));
});

test('risk-to-reward field exposes the -1 minimum and a keyboard that can enter a minus sign', () => {
  assert.match(html, /name="riskReward"[^>]*min="-1"/);
  assert.match(html, /name="riskReward"[^>]*inputmode="text"/);
});
