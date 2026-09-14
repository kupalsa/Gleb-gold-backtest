import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionInput, wireDataConnection } from '../src/data-connection.js';

const button = () => ({ addEventListener(type, listener) { this[type] = listener; } });
const field = (value = '') => ({ value, checked: false });
const connectionForm = () => ({
  elements: { owner: field(), repo: field(), token: field(), remember: field() },
  addEventListener(type, listener) { this[type] = listener; },
  reset() { this.elements.owner.value = ''; this.elements.repo.value = ''; this.elements.token.value = ''; this.elements.remember.checked = false; }
});

test('connection input treats a checked checkbox as true and an absent checkbox as false', () => {
  assert.deepEqual(connectionInput([['owner', ' kupalsa '], ['repo', ' data '], ['token', 'pat']], true), { owner: 'kupalsa', repo: 'data', token: 'pat', remember: true });
  assert.deepEqual(connectionInput([['owner', 'kupalsa'], ['repo', 'data'], ['token', 'pat']], false), { owner: 'kupalsa', repo: 'data', token: 'pat', remember: false });
});

test('reopening data connection pre-fills active owner and repo, reports connected state, and never renders token', () => {
  const open = button(); const form = connectionForm(); const messages = [];
  const dialog = { showModal() { this.open = true; }, close() {} };
  wireDataConnection({
    connectionButton: open, dialog, form,
    store: { connectionDetails: () => ({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data' }) },
    refresh: async () => {}, setStatus: () => {}, setDialogStatus: (kind, message) => messages.push({ kind, message })
  });
  open.click();
  assert.equal(form.elements.owner.value, 'kupalsa');
  assert.equal(form.elements.repo.value, 'Gleb-gold-backtest-data');
  assert.equal(form.elements.token.value, '');
  assert.deepEqual(messages, [{ kind: 'success', message: 'Connected to kupalsa/Gleb-gold-backtest-data. Enter a token only to replace this connection.' }]);
});

test('a successful connection visibly confirms in dialog and sets connected header status', async () => {
  const form = connectionForm(); form.elements.owner.value = 'kupalsa'; form.elements.repo.value = 'data'; form.elements.token.value = 'new-pat'; form.elements.remember.checked = true;
  const messages = []; const statuses = []; const dialog = { showModal() {}, close() {} };
  wireDataConnection({
    dialog, form, store: { connectGitHub: (input) => { assert.deepEqual(input, { owner: 'kupalsa', repo: 'data', token: 'new-pat', remember: true }); }, connectionDetails: () => ({ owner: 'kupalsa', repo: 'data' }) },
    formData: () => [['owner', 'kupalsa'], ['repo', 'data'], ['token', 'new-pat']],
    refresh: async () => {}, setStatus: (source, detail) => statuses.push({ source, detail }), setDialogStatus: (kind, message) => messages.push({ kind, message })
  });
  await form.submit({ preventDefault() {} });
  assert.deepEqual(statuses, [{ source: 'github', detail: 'Connected to kupalsa/data.' }]);
  assert.deepEqual(messages, [{ kind: 'success', message: 'Connected to kupalsa/data. Your private trades are ready to sync.' }]);
  assert.equal(form.elements.token.value, '');
});
