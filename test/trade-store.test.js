import test from 'node:test';
import assert from 'node:assert/strict';
import { TradeStore } from '../src/trade-store.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('uses local-only storage without contacting a backend when no private connection is configured', async () => {
  let calls = 0;
  const store = new TradeStore({ fetcher: async () => { calls += 1; throw new Error('backend must not be used'); }, storage: memoryStorage() });
  const result = await store.list();
  assert.equal(result.source, 'local');
  assert.deepEqual(result.trades, []);
  assert.equal(calls, 0);
});

test('creates local-only trades when no private connection is configured', async () => {
  const storage = memoryStorage();
  const store = new TradeStore({ fetcher: async () => { throw new Error('offline'); }, storage, idFactory: () => 'local-1' });
  const created = await store.create({ date: '2026-09-13', entryTime: '09:30', stopLossPoints: 10, riskReward: 2, direction: 'long', notes: '' });
  assert.equal(created.source, 'local');
  const listed = await store.list();
  assert.equal(listed.source, 'local');
  assert.equal(listed.trades[0].id, 'local-1');
});

test('updates and deletes a local-only fallback trade', async () => {
  const store = new TradeStore({ fetcher: async () => { throw new Error('offline'); }, storage: memoryStorage(), idFactory: () => 'local-1' });
  await store.create({ date: '2026-09-13', entryTime: '09:30', stopLossPoints: 10, riskReward: 2, direction: 'long', notes: '' });
  const updated = await store.update('local-1', { date: '2026-09-13', entryTime: '10:00', stopLossPoints: 8, riskReward: 3, direction: 'short', notes: 'revised' });
  assert.equal(updated.trade.riskReward, 3);
  await store.remove('local-1');
  assert.deepEqual((await store.list()).trades, []);
});
