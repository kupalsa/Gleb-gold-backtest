import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBacktestsData,
  isVol2Suite,
  VOL2_BACKTEST_ID,
  VOL2_BACKTEST_NAME,
  VOL2_NY_BACKTEST_ID,
  VOL2_NY_BACKTEST_NAME,
  VOL1_BACKTEST_ID,
  VOL1_BACKTEST_NAME,
  MOVED_TP_BACKTEST_ID,
  MOVED_TP_BACKTEST_NAME,
  NOT_MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_NAME
} from '../src/backtests.js';

test('backtest constants have correct renamed Asian and new NY suite values', () => {
  assert.equal(VOL2_BACKTEST_ID, 'vol-2');
  assert.equal(VOL2_BACKTEST_NAME, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(VOL2_NY_BACKTEST_ID, 'vol-2-ny');
  assert.equal(VOL2_NY_BACKTEST_NAME, 'Gold Backtest Vol. 2 (New York Time)');
  assert.equal(VOL1_BACKTEST_ID, 'vol-1');
  assert.equal(VOL1_BACKTEST_NAME, 'Gold Backtest Vol. 1 (Asian)');
});

test('isVol2Suite identifies both Asian and New York Vol 2 suites', () => {
  assert.equal(isVol2Suite(VOL2_BACKTEST_ID), true);
  assert.equal(isVol2Suite(VOL2_NY_BACKTEST_ID), true);
  assert.equal(isVol2Suite(VOL1_BACKTEST_ID), false);
  assert.equal(isVol2Suite('custom-id'), false);
});

test('normalizeBacktestsData produces Vol 2 (Asian), Vol 2 (New York Time), and Vol 1 (Asian) for null, undefined, or empty object', () => {
  for (const raw of [null, undefined, {}, { backtests: [] }]) {
    const result = normalizeBacktestsData(raw);
    assert.equal(result.activeId, VOL2_BACKTEST_ID);
    assert.equal(result.backtests.length, 3);

    const vol2Asian = result.backtests[0];
    assert.equal(vol2Asian.id, VOL2_BACKTEST_ID);
    assert.equal(vol2Asian.name, 'Gold Backtest Vol. 2 (Asian)');
    assert.equal(vol2Asian.activeTabId, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Asian.subBacktests.length, 2);
    assert.equal(vol2Asian.subBacktests[0].id, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Asian.subBacktests[0].name, MOVED_TP_BACKTEST_NAME);
    assert.equal(vol2Asian.subBacktests[1].id, NOT_MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Asian.subBacktests[1].name, NOT_MOVED_TP_BACKTEST_NAME);
    assert.deepEqual(vol2Asian.subBacktests[0].trades, []);
    assert.deepEqual(vol2Asian.subBacktests[1].trades, []);

    const vol2Ny = result.backtests[1];
    assert.equal(vol2Ny.id, VOL2_NY_BACKTEST_ID);
    assert.equal(vol2Ny.name, 'Gold Backtest Vol. 2 (New York Time)');
    assert.equal(vol2Ny.activeTabId, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Ny.subBacktests.length, 2);
    assert.equal(vol2Ny.subBacktests[0].id, MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Ny.subBacktests[0].name, MOVED_TP_BACKTEST_NAME);
    assert.equal(vol2Ny.subBacktests[1].id, NOT_MOVED_TP_BACKTEST_ID);
    assert.equal(vol2Ny.subBacktests[1].name, NOT_MOVED_TP_BACKTEST_NAME);
    assert.deepEqual(vol2Ny.subBacktests[0].trades, []);
    assert.deepEqual(vol2Ny.subBacktests[1].trades, []);

    const vol1Asian = result.backtests[2];
    assert.equal(vol1Asian.id, VOL1_BACKTEST_ID);
    assert.equal(vol1Asian.name, 'Gold Backtest Vol. 1 (Asian)');
    assert.deepEqual(vol1Asian.trades, []);
  }
});

test('normalizeBacktestsData migrates flat trade array into Vol 2 (Asian) paired trades, empty Vol 2 (NY), and Vol 1 (Asian)', () => {
  const flatTrades = [
    { id: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 },
    { id: 't2', date: '2026-09-13', entryTime: '11:00', exitTime: '12:00', direction: 'short', outcome: 'loss', stopLossPoints: 5, riskReward: -1 }
  ];
  const result = normalizeBacktestsData(flatTrades);
  assert.equal(result.activeId, VOL2_BACKTEST_ID);
  assert.equal(result.backtests.length, 3);

  const vol2Asian = result.backtests.find(b => b.id === VOL2_BACKTEST_ID);
  assert.ok(vol2Asian);
  assert.equal(vol2Asian.name, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(vol2Asian.subBacktests[0].trades.length, 2);
  assert.equal(vol2Asian.subBacktests[1].trades.length, 2);

  const vol2Ny = result.backtests.find(b => b.id === VOL2_NY_BACKTEST_ID);
  assert.ok(vol2Ny);
  assert.equal(vol2Ny.name, 'Gold Backtest Vol. 2 (New York Time)');
  assert.equal(vol2Ny.subBacktests[0].trades.length, 0);
  assert.equal(vol2Ny.subBacktests[1].trades.length, 0);

  const vol1Asian = result.backtests.find(b => b.id === VOL1_BACKTEST_ID);
  assert.ok(vol1Asian);
  assert.equal(vol1Asian.name, 'Gold Backtest Vol. 1 (Asian)');
  assert.equal(vol1Asian.trades.length, 2);
  assert.equal(vol1Asian.trades[0].id, 't1');
  assert.equal(vol1Asian.trades[1].id, 't2');
});

test('normalizeBacktestsData renames legacy backtests and adds missing Vol 2 NY default suite while preserving 50 trades and custom backtests', () => {
  const legacyTrades = Array.from({ length: 50 }, (_, i) => ({
    id: `trade-${i + 1}`,
    pairId: `trade-${i + 1}`,
    date: '2026-09-13',
    entryTime: '09:30',
    exitTime: '10:30',
    direction: 'long',
    outcome: 'win',
    stopLossPoints: 10,
    riskReward: 2
  }));

  const raw = {
    activeId: 'custom-1',
    backtests: [
      {
        id: VOL2_BACKTEST_ID,
        name: 'Gold Backtest Vol. 2',
        subBacktests: [
          { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: legacyTrades },
          { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: legacyTrades }
        ]
      },
      { id: VOL1_BACKTEST_ID, name: 'Gold Backtest Vol. 1', trades: legacyTrades },
      { id: 'custom-1', name: 'My Strategy', trades: [{ id: 'c1-t1', date: '2026-09-13', entryTime: '10:00', exitTime: '11:00', direction: 'long', outcome: 'win', stopLossPoints: 8, riskReward: 2 }] }
    ]
  };

  const result = normalizeBacktestsData(raw);
  assert.equal(result.activeId, 'custom-1');
  assert.equal(result.backtests.length, 4);

  const vol2Asian = result.backtests.find(b => b.id === VOL2_BACKTEST_ID);
  assert.equal(vol2Asian.name, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(vol2Asian.subBacktests[0].trades.length, 50);

  const vol2Ny = result.backtests.find(b => b.id === VOL2_NY_BACKTEST_ID);
  assert.equal(vol2Ny.name, 'Gold Backtest Vol. 2 (New York Time)');
  assert.equal(vol2Ny.subBacktests[0].trades.length, 0);

  const vol1Asian = result.backtests.find(b => b.id === VOL1_BACKTEST_ID);
  assert.equal(vol1Asian.name, 'Gold Backtest Vol. 1 (Asian)');
  assert.equal(vol1Asian.trades.length, 50);

  const custom = result.backtests.find(b => b.id === 'custom-1');
  assert.equal(custom.name, 'My Strategy');
  assert.equal(custom.trades.length, 1);
});

test('normalizeBacktestsData converts legacy top-level moved-tp and not-moved-tp backtests into Vol 2 (Asian) subBacktests and adds Vol 2 NY', () => {
  const legacyObj = {
    activeId: NOT_MOVED_TP_BACKTEST_ID,
    backtests: [
      { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: [{ id: 't1', pairId: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] },
      { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: [{ id: 't1', pairId: 't1', date: '2026-09-13', entryTime: '09:30', exitTime: '10:30', direction: 'long', outcome: 'win', stopLossPoints: 10, riskReward: 2 }] }
    ]
  };
  const result = normalizeBacktestsData(legacyObj);
  assert.equal(result.activeId, VOL2_BACKTEST_ID);

  const vol2Asian = result.backtests.find(b => b.id === VOL2_BACKTEST_ID);
  assert.ok(vol2Asian);
  assert.equal(vol2Asian.name, 'Gold Backtest Vol. 2 (Asian)');
  assert.equal(vol2Asian.activeTabId, NOT_MOVED_TP_BACKTEST_ID);
  assert.equal(vol2Asian.subBacktests[0].trades.length, 1);

  const vol2Ny = result.backtests.find(b => b.id === VOL2_NY_BACKTEST_ID);
  assert.ok(vol2Ny);
  assert.equal(vol2Ny.name, 'Gold Backtest Vol. 2 (New York Time)');

  const vol1Asian = result.backtests.find(b => b.id === VOL1_BACKTEST_ID);
  assert.ok(vol1Asian);
  assert.equal(vol1Asian.name, 'Gold Backtest Vol. 1 (Asian)');
  assert.equal(vol1Asian.trades.length, 1);
});
