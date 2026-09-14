import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTakeProfitMoveFields } from '../src/take-profit-move.js';

const fields = (movedTakeProfit = '', takeProfitMoveResult = '') => ({
  moved: { value: movedTakeProfit },
  result: { value: takeProfitMoveResult, required: false },
  container: { hidden: true }
});

test('reveals and requires the take-profit result only after yes is selected', () => {
  const ui = fields('yes');
  syncTakeProfitMoveFields(ui);
  assert.equal(ui.container.hidden, false);
  assert.equal(ui.result.required, true);
});

test('hides and clears the take-profit result for no or unanswered selections', () => {
  for (const movedTakeProfit of ['', 'no']) {
    const ui = fields(movedTakeProfit, 'good');
    syncTakeProfitMoveFields(ui);
    assert.equal(ui.container.hidden, true);
    assert.equal(ui.result.required, false);
    assert.equal(ui.result.value, '');
  }
});
