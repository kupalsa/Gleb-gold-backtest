import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrade } from '../src/trades.js';
import { syncTakeProfitMoveFields } from '../src/take-profit-move.js';

test('validateTrade when movedTakeProfit is yes requires initial exit fields and validates initial exit date', () => {
  const baseTrade = {
    date: '2026-09-15',
    entryTime: '09:00',
    exitDate: '2026-09-15',
    exitTime: '11:00',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 3,
    movedTakeProfit: 'yes'
  };

  const missingInitial = validateTrade(baseTrade);
  assert.equal(missingInitial.initialExitTime, 'Use a valid initial exit time.');
  assert.equal(missingInitial.initialOutcome, 'Choose initial win or loss.');
  assert.equal(missingInitial.initialRiskReward, 'Initial risk-to-reward must be at least -1.');

  const validInitial = validateTrade({
    ...baseTrade,
    initialExitDate: '2026-09-15',
    initialExitTime: '10:00',
    initialOutcome: 'win',
    initialRiskReward: 2
  });
  assert.equal(Object.keys(validInitial).length, 0);

  const invalidInitialDate = validateTrade({
    ...baseTrade,
    initialExitDate: '2026-09-14',
    initialExitTime: '10:00',
    initialOutcome: 'win',
    initialRiskReward: 2
  });
  assert.equal(invalidInitialDate.initialExitDate, 'Initial exit date and time cannot be before entry date and time.');
});

test('syncTakeProfitMoveFields toggles initial scenario fieldset visibility and required inputs', () => {
  const movedSelect = { value: 'yes' };
  const container = { hidden: true, querySelector: () => ({ value: '2026-09-15' }) };
  const initialExitTime = { value: '', required: false };
  const initialOutcome = { value: '', required: false };
  const initialRiskReward = { value: '', required: false };

  syncTakeProfitMoveFields({
    moved: movedSelect,
    container,
    initialExitTime,
    initialOutcome,
    initialRiskReward
  });

  assert.equal(container.hidden, false);
  assert.equal(initialExitTime.required, true);
  assert.equal(initialOutcome.required, true);
  assert.equal(initialRiskReward.required, true);

  // Switch to 'no'
  movedSelect.value = 'no';
  initialExitTime.value = '10:00';
  initialOutcome.value = 'win';
  initialRiskReward.value = '2';

  syncTakeProfitMoveFields({
    moved: movedSelect,
    container,
    initialExitTime,
    initialOutcome,
    initialRiskReward
  });

  assert.equal(container.hidden, true);
  assert.equal(initialExitTime.required, false);
  assert.equal(initialOutcome.required, false);
  assert.equal(initialRiskReward.required, false);
  assert.equal(initialExitTime.value, '');
  assert.equal(initialOutcome.value, '');
  assert.equal(initialRiskReward.value, '');
});
