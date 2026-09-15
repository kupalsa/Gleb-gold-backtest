import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('index.html renders backtest switcher dropdown and controls', () => {
  assert.match(html, /id="backtest-select"/);
  assert.match(html, /id="create-backtest"/);
  assert.match(html, /id="rename-backtest"/);
  assert.match(html, /id="delete-backtest"/);
  assert.match(html, /\+ New/);
  assert.match(html, /Rename/);
  assert.match(html, /Delete/);
});

test('app.js imports and wires backtest switcher UI', () => {
  assert.match(appSource, /renderBacktestSelect/);
  assert.match(appSource, /wireBacktestControls/);
  assert.match(appSource, /#backtest-select/);
  assert.match(appSource, /#create-backtest/);
  assert.match(appSource, /#rename-backtest/);
  assert.match(appSource, /#delete-backtest/);
});
