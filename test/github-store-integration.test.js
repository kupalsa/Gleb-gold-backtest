import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubTradeSync } from '../src/github-sync.js';
import { TradeStore } from '../src/trade-store.js';
import { wireDataConnection } from '../src/data-connection.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};
const trade = (id, entryTime = '09:30') => ({ id, date: '2026-09-13', entryTime, exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2, notes: '' });
const button = () => ({ addEventListener(type, listener) { this[type] = listener; }, async click() { await this.click(); } });

test('connected GitHub store reads, writes full arrays with SHA, keeps token session-only, and sync control refreshes remote state', async () => {
  const session = memoryStorage(); const local = memoryStorage(); const writes = [];
  let remote = [trade('remote-1')]; let sha = 'sha-1'; let conflict = false;
  const fetcher = async (_url, options = {}) => {
    if (!options.method) return { ok: true, json: async () => ({ sha, content: btoa(JSON.stringify(remote)) }) };
    const payload = JSON.parse(options.body); writes.push(payload);
    if (conflict) return { ok: false, status: 409, json: async () => ({ message: 'sha does not match' }) };
    remote = JSON.parse(atob(payload.content)); sha = `sha-${writes.length + 1}`;
    return { ok: true, json: async () => ({ content: '', sha }) };
  };
  const sync = new GitHubTradeSync({ fetcher, session, local });
  const store = new TradeStore({ githubSync: sync, storage: local, idFactory: () => 'new-1' });
  store.connectGitHub({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'secret-pat', remember: false });

  assert.equal(local.getItem('gleb-gold-backtest.github-connection.v1'), null);
  assert.deepEqual(store.connectionDetails(), { owner: 'kupalsa', repo: 'Gleb-gold-backtest-data' });
  assert.deepEqual((await store.list()), { source: 'github', trades: [trade('remote-1')] });

  await store.create({ ...trade('ignored'), id: undefined, entryTime: '11:00' });
  assert.equal(writes[0].sha, 'sha-1'); assert.deepEqual(JSON.parse(atob(writes[0].content)).map(({ id }) => id), ['remote-1', 'new-1']);
  await store.update('new-1', { ...trade('ignored', '12:00'), id: undefined });
  assert.deepEqual(JSON.parse(atob(writes[1].content)).map(({ id, entryTime }) => [id, entryTime]), [['remote-1', '09:30'], ['new-1', '12:00']]);
  await store.remove('remote-1');
  assert.deepEqual(writes.map(({ sha: savedSha }) => savedSha), ['sha-1', 'sha-2', 'sha-3']);
  assert.deepEqual(JSON.parse(atob(writes[2].content)).map(({ id }) => id), ['new-1']);

  remote = [trade('refreshed')]; sha = 'sha-remote';
  const syncButton = button(); let refreshed;
  wireDataConnection({ syncButton, store, refresh: async () => { refreshed = await store.list(); }, setStatus: () => {} });
  await syncButton.click();
  assert.deepEqual(refreshed.trades, [trade('refreshed')]);

  conflict = true;
  await assert.rejects(() => store.create({ ...trade('ignored'), id: undefined, entryTime: '13:00' }), /changed on GitHub.*Sync trades/i);
  assert.deepEqual(remote, [trade('refreshed')]);
});

test('GitHub full-array sync loads and preserves negative risk-reward trade fields used by analytics', async () => {
  const session = memoryStorage(); const local = memoryStorage(); let savedPayload;
  const remote = [{ ...trade('overnight', '23:50'), exitTime: '00:10', direction: 'short', outcome: 'loss', riskReward: -0.5, movedTakeProfit: 'yes', takeProfitMoveResult: 'wasted' }];
  const fetcher = async (_url, options = {}) => {
    if (!options.method) return { ok: true, json: async () => ({ sha: 'analytics-sha', content: btoa(JSON.stringify(remote)) }) };
    savedPayload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: '', sha: 'saved-analytics-sha' }) };
  };
  const sync = new GitHubTradeSync({ fetcher, session, local });
  const store = new TradeStore({ githubSync: sync, storage: local, idFactory: () => 'new-analytics' });
  store.connectGitHub({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'secret-pat', remember: false });

  assert.deepEqual((await store.list()).trades, remote);
  await store.create({ ...trade('ignored', '00:20'), id: undefined, exitTime: '00:30', direction: 'long', outcome: 'win', riskReward: 0, movedTakeProfit: 'yes', takeProfitMoveResult: 'good' });
  assert.deepEqual(JSON.parse(atob(savedPayload.content)).map(({ id, entryTime, exitTime, direction, outcome, riskReward, movedTakeProfit, takeProfitMoveResult }) => ({ id, entryTime, exitTime, direction, outcome, riskReward, movedTakeProfit, takeProfitMoveResult })), [
    { id: 'overnight', entryTime: '23:50', exitTime: '00:10', direction: 'short', outcome: 'loss', riskReward: -0.5, movedTakeProfit: 'yes', takeProfitMoveResult: 'wasted' },
    { id: 'new-analytics', entryTime: '00:20', exitTime: '00:30', direction: 'long', outcome: 'win', riskReward: 0, movedTakeProfit: 'yes', takeProfitMoveResult: 'good' }
  ]);
});
