import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';
import { GitHubTradeSync } from '../src/github-sync.js';
import { VOL2_BACKTEST_ID, MOVED_TP_BACKTEST_ID, NOT_MOVED_TP_BACKTEST_ID } from '../src/backtests.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('Instant smooth tab switching inside Vol 2 updates local state without remote GitHub API network calls', async () => {
  let networkCalls = 0;
  const initialData = {
    activeId: VOL2_BACKTEST_ID,
    backtests: [
      {
        id: VOL2_BACKTEST_ID,
        name: 'Gold Backtest Vol. 2',
        activeTabId: MOVED_TP_BACKTEST_ID,
        subBacktests: [
          { id: MOVED_TP_BACKTEST_ID, name: 'Moved TP', trades: [{ id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] },
          { id: NOT_MOVED_TP_BACKTEST_ID, name: 'Not Moved TP', trades: [{ id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] }
        ]
      }
    ]
  };

  const fetcher = async (_url, options = {}) => {
    networkCalls++;
    if (!options.method) {
      return { ok: true, json: async () => ({ sha: 'sha-1', content: btoa(JSON.stringify(initialData)) }) };
    }
    return { ok: true, json: async () => ({ content: '', sha: 'sha-2' }) };
  };

  const session = memoryStorage();
  const local = memoryStorage();
  const sync = new GitHubTradeSync({ fetcher, session, local });
  const store = new TradeStore({ githubSync: sync, storage: local, idFactory: () => 'id-1' });
  store.connectGitHub({ owner: 'kupalsa', repo: 'Gleb-gold-backtest-data', token: 'secret-pat' });

  // Initial load fetches from GitHub once
  const initialList = await store.list();
  assert.equal(networkCalls, 1, 'Initial load should make 1 network request');
  assert.equal(initialList.trades.length, 1);

  // Switch sub-tab to Not Moved TP
  networkCalls = 0;
  await store.selectBacktest(NOT_MOVED_TP_BACKTEST_ID);

  // Re-list without forcing fetch
  const updatedList = await store.list();

  // MUST NOT initiate any network requests on tab click
  assert.equal(networkCalls, 0, 'Tab switching must NOT initiate network requests');
  assert.equal(updatedList.activeTabId, NOT_MOVED_TP_BACKTEST_ID);

  // Switch back to Moved TP
  await store.selectBacktest(MOVED_TP_BACKTEST_ID);
  const movedList = await store.list();
  assert.equal(networkCalls, 0, 'Switching back to Moved TP must NOT initiate network requests');
  assert.equal(movedList.activeTabId, MOVED_TP_BACKTEST_ID);
});
