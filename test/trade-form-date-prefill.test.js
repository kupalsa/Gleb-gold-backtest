import test from 'node:test';
import assert from 'node:assert/strict';
import { prefillTradeFormDates } from '../src/trade-form-date-prefill.js';

function formWith({ date = '', exitDate = '', tradeId = '' } = {}) {
  const fields = {
    '#date': { value: date },
    '#exitDate': { value: exitDate },
    '#trade-id': { value: tradeId }
  };
  return {
    fields,
    querySelector(selector) {
      return fields[selector] || null;
    }
  };
}

test('prefills blank entry and exit dates with the latest saved trade from the active backtest', () => {
  const form = formWith();

  prefillTradeFormDates(form, '2025-01-22');

  assert.equal(form.fields['#date'].value, '2025-01-22');
  assert.equal(form.fields['#exitDate'].value, '2025-01-22');
});

test('leaves both native date fields blank when no saved trade exists', () => {
  const form = formWith();

  prefillTradeFormDates(form, null);

  assert.equal(form.fields['#date'].value, '');
  assert.equal(form.fields['#exitDate'].value, '');
});

test('does not overwrite manual dates or an edited trade saved dates', () => {
  const manuallyFilled = formWith({ date: '2025-01-15', exitDate: '2025-01-16' });
  const editing = formWith({ date: '2025-01-20', exitDate: '2025-01-21', tradeId: 'trade-1' });

  prefillTradeFormDates(manuallyFilled, '2025-01-22');
  prefillTradeFormDates(editing, '2025-01-22');

  assert.deepEqual(manuallyFilled.fields['#date'].value, '2025-01-15');
  assert.deepEqual(manuallyFilled.fields['#exitDate'].value, '2025-01-16');
  assert.deepEqual(editing.fields['#date'].value, '2025-01-20');
  assert.deepEqual(editing.fields['#exitDate'].value, '2025-01-21');
});
