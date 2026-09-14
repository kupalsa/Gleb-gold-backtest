import test from 'node:test';
import assert from 'node:assert/strict';
import { dataStatus, showTradeFailure, showTradeSuccess, tradeSaveMessage } from '../src/feedback.js';

test('local fallback status is visible only while disconnected', () => {
  assert.equal(dataStatus('local'), 'LOCAL-ONLY FALLBACK — no private connection is configured. Trades are saved only in this browser.');
  assert.equal(dataStatus('github'), 'GitHub private data connected.');
  assert.equal(dataStatus('error', 'GitHub save failed. Check the repository, PAT permissions, and connection.'), 'GitHub save failed. Check the repository, PAT permissions, and connection.');
  assert.doesNotMatch(dataStatus('error', 'GitHub save failed.'), /LOCAL-ONLY FALLBACK/);
});

test('successful save explicitly confirms the new trade is visible in calendar and statistics', () => {
  assert.equal(tradeSaveMessage({ date: '2026-09-13' }, 'github'), 'Trade saved to GitHub private data for 2026-09-13. It is now visible in the calendar and statistics.');
  assert.equal(tradeSaveMessage({ date: '2026-09-13' }, 'local'), 'Trade saved in this browser for 2026-09-13. It is now visible in the calendar and statistics.');
});

test('failed save renders the exact actionable error near the form and in data status', () => {
  const formError = { textContent: '' }; const formSuccess = { textContent: '' }; const statuses = [];
  const error = new Error('GitHub save failed. Check the repository, PAT permissions, and connection.');
  showTradeFailure({ formError, formSuccess, setStatus: (source, detail) => statuses.push({ source, detail }), error });
  assert.equal(formError.textContent, error.message);
  assert.equal(formSuccess.textContent, '');
  assert.deepEqual(statuses, [{ source: 'error', detail: error.message }]);
});

test('successful save clears an old error and visibly confirms the created record', () => {
  const formError = { textContent: 'old error' }; const formSuccess = { textContent: '' };
  showTradeSuccess({ formError, formSuccess, trade: { date: '2026-09-13' }, source: 'local' });
  assert.equal(formError.textContent, '');
  assert.equal(formSuccess.textContent, 'Trade saved in this browser for 2026-09-13. It is now visible in the calendar and statistics.');
});
