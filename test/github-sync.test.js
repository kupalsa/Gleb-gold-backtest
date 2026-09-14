import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubTradeSync } from '../src/github-sync.js';

const memoryStorage = () => { const values = new Map(); return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; };

test('loads private trades through the GitHub Contents API', async () => {
  const calls = []; const fetcher = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ sha: 'sha-1', content: btoa(JSON.stringify([{ id: 'a' }])) }) }; };
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() }); sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });
  assert.deepEqual((await sync.load()).trades, [{ id: 'a' }]); assert.match(calls[0].url, /repos\/kupalsa\/Gleb-gold-backtest-data\/contents\/data\/trades.json$/); assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
});

test('saves trades with the loaded SHA, returns GitHub content SHA, and persists token only when opted in', async () => {
  const session = memoryStorage(); const local = memoryStorage(); const calls = []; const fetcher = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ content: { sha: 'sha-2' } }) }; };
  const sync = new GitHubTradeSync({ fetcher, session, local }); sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false }); const saved = await sync.save([{ id: 'a' }], 'sha-1');
  assert.equal(JSON.parse(calls[0].options.body).sha, 'sha-1'); assert.equal(saved.sha, 'sha-2'); assert.equal(local.getItem('gleb-gold-backtest.github-connection.v1'), null);
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: true }); assert.match(local.getItem('gleb-gold-backtest.github-connection.v1'), /test-token/);
});

test('uses a window-bound default fetch safely in Safari-style environments', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = function (url) {
    if (this !== globalThis) throw new TypeError('Can only call Window.fetch on instances of Window');
    calls.push(url);
    return Promise.resolve({ ok: true, json: async () => ({ sha: 'sha-1', content: btoa('[]') }) });
  };
  try {
    const sync = new GitHubTradeSync({ session: memoryStorage(), local: memoryStorage() });
    sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });
    await sync.load();
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
