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

test('retries a transient GitHub 500 save failure and returns the later successful save', async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    if (attempts === 1) return { ok: false, status: 500, json: async () => ({ message: 'Internal Server Error' }) };
    return { ok: true, json: async () => ({ content: { sha: 'sha-retried' } }) };
  };
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });

  const saved = await sync.save([{ id: 'a' }], 'sha-1');

  assert.equal(attempts, 2);
  assert.equal(saved.sha, 'sha-retried');
});

test('retries a network exception during GitHub save and returns the later successful save', async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    if (attempts === 1) throw new TypeError('Failed to fetch');
    return { ok: true, json: async () => ({ content: { sha: 'sha-network-retried' } }) };
  };
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });

  const saved = await sync.save([{ id: 'a' }], 'sha-1');

  assert.equal(attempts, 2);
  assert.equal(saved.sha, 'sha-network-retried');
});

test('does not retry a forbidden GitHub save response', async () => {
  let attempts = 0;
  const fetcher = async () => { attempts += 1; return { ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) }; };
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });

  await assert.rejects(sync.save([{ id: 'a' }], 'sha-1'), /GitHub save failed \(403\): Forbidden/);
  assert.equal(attempts, 1);
});

test('does not retry GitHub SHA conflicts and preserves the conflict guidance', async () => {
  for (const status of [409, 422]) {
    let attempts = 0;
    const fetcher = async () => { attempts += 1; return { ok: false, status, json: async () => ({ message: 'sha does not match' }) }; };
    const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
    sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });

    await assert.rejects(sync.save([{ id: 'a' }], 'sha-1'), /GitHub data changed on GitHub\. Click Sync trades to load the latest data before retrying; your change was not saved\./);
    assert.equal(attempts, 1);
  }
});

test('reports a temporary GitHub service failure after exhausting save retries', async () => {
  let attempts = 0;
  const fetcher = async () => { attempts += 1; return { ok: false, status: 500, json: async () => ({ message: 'Internal Server Error' }) }; };
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });

  await assert.rejects(sync.save([{ id: 'a' }], 'sha-1'), /temporary GitHub service or network failure.*Please retry your save/i);
  assert.equal(attempts, 3);
});

test('uses the actual window as fetch receiver in Safari-style environments', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const calls = [];
  const safariWindow = {
    fetch(url) {
      if (this !== safariWindow) throw new TypeError('Can only call Window.fetch on instances of Window');
      calls.push(url);
      return Promise.resolve({ ok: true, json: async () => ({ sha: 'sha-1', content: btoa('[]') }) });
    }
  };
  globalThis.window = safariWindow;
  globalThis.fetch = function () { throw new TypeError('Can only call Window.fetch on instances of Window'); };
  try {
    const sync = new GitHubTradeSync({ session: memoryStorage(), local: memoryStorage() });
    sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });
    await sync.load();
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('shows GitHub HTTP status and API message when a mobile connection is rejected', async () => {
  const fetcher = async () => ({ ok: false, status: 403, json: async () => ({ message: 'Resource not accessible by personal access token' }) });
  const sync = new GitHubTradeSync({ fetcher, session: memoryStorage(), local: memoryStorage() });
  sync.connect({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'test-token', remember: false });
  await assert.rejects(sync.load(), /GitHub load failed \(403\): Resource not accessible by personal access token/);
});
