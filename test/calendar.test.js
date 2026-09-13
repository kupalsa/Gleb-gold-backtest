import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarCells, shiftMonth } from '../src/calendar.js';

test('builds a Sunday-first 42-cell month grid with ISO dates', () => {
  const cells = calendarCells('2026-09');
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, '2026-08-30');
  assert.equal(cells[2].date, '2026-09-01');
  assert.equal(cells[2].inMonth, true);
  assert.equal(cells[1].inMonth, false);
});

test('shifts a YYYY-MM month across year boundaries', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
