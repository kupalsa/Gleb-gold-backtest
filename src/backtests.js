import { normalizeTrade } from './trades.js';

export const VOL2_BACKTEST_ID = 'vol-2';
export const VOL2_BACKTEST_NAME = 'Gold Backtest Vol. 2 (Asian)';
export const VOL2_NY_BACKTEST_ID = 'vol-2-ny';
export const VOL2_NY_BACKTEST_NAME = 'Gold Backtest Vol. 2 (New York Time)';
export const VOL1_BACKTEST_ID = 'vol-1';
export const VOL1_BACKTEST_NAME = 'Gold Backtest Vol. 1 (Asian)';

export const MOVED_TP_BACKTEST_ID = 'moved-tp';
export const MOVED_TP_BACKTEST_NAME = 'Moved TP';
export const NOT_MOVED_TP_BACKTEST_ID = 'not-moved-tp';
export const NOT_MOVED_TP_BACKTEST_NAME = 'Not Moved TP';

export const DEFAULT_BACKTEST_ID = VOL2_BACKTEST_ID;
export const DEFAULT_BACKTEST_NAME = VOL2_BACKTEST_NAME;

export function isVol2Suite(id) {
  return id === VOL2_BACKTEST_ID || id === VOL2_NY_BACKTEST_ID;
}

export function getVol2TargetSuiteId(entryTime) {
  const hour = parseInt(String(entryTime || '').split(':')[0], 10);
  if (isNaN(hour) || hour < 0 || hour > 23) {
    return VOL2_BACKTEST_ID;
  }
  return hour < 12 ? VOL2_BACKTEST_ID : VOL2_NY_BACKTEST_ID;
}

function createVol2SubBacktests(movedTrades = [], notMovedTrades = []) {
  return [
    { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: movedTrades },
    { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: notMovedTrades }
  ];
}

export function normalizeBacktestsData(raw, idFactory = () => crypto.randomUUID()) {
  let activeId = VOL2_BACKTEST_ID;
  let activeTabId = MOVED_TP_BACKTEST_ID;

  if (!raw) {
    return {
      activeId: VOL2_BACKTEST_ID,
      backtests: [
        {
          id: VOL2_BACKTEST_ID,
          name: VOL2_BACKTEST_NAME,
          activeTabId: MOVED_TP_BACKTEST_ID,
          subBacktests: createVol2SubBacktests()
        },
        {
          id: VOL2_NY_BACKTEST_ID,
          name: VOL2_NY_BACKTEST_NAME,
          activeTabId: MOVED_TP_BACKTEST_ID,
          subBacktests: createVol2SubBacktests()
        },
        {
          id: VOL1_BACKTEST_ID,
          name: VOL1_BACKTEST_NAME,
          trades: []
        }
      ]
    };
  }

  // If raw is a flat array of trades
  if (Array.isArray(raw)) {
    const vol1Trades = raw.map((t) => normalizeTrade(t));

    return {
      activeId: VOL2_BACKTEST_ID,
      backtests: [
        {
          id: VOL2_BACKTEST_ID,
          name: VOL2_BACKTEST_NAME,
          activeTabId: MOVED_TP_BACKTEST_ID,
          subBacktests: createVol2SubBacktests()
        },
        {
          id: VOL2_NY_BACKTEST_ID,
          name: VOL2_NY_BACKTEST_NAME,
          activeTabId: MOVED_TP_BACKTEST_ID,
          subBacktests: createVol2SubBacktests()
        },
        {
          id: VOL1_BACKTEST_ID,
          name: VOL1_BACKTEST_NAME,
          trades: vol1Trades
        }
      ]
    };
  }

  if (typeof raw === 'object' && raw !== null) {
    if (raw.activeId) {
      if (raw.activeId === MOVED_TP_BACKTEST_ID || raw.activeId === NOT_MOVED_TP_BACKTEST_ID) {
        activeId = VOL2_BACKTEST_ID;
        activeTabId = raw.activeId;
      } else {
        activeId = raw.activeId;
      }
    }

    const rawBacktests = Array.isArray(raw.backtests) ? raw.backtests : [];

    let vol2Raw = rawBacktests.find((b) => b.id === VOL2_BACKTEST_ID);
    let movedBtRaw = rawBacktests.find((b) => b.id === MOVED_TP_BACKTEST_ID);
    let notMovedBtRaw = rawBacktests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID);

    let movedTrades = [];
    let notMovedTrades = [];

    if (vol2Raw && Array.isArray(vol2Raw.subBacktests)) {
      activeTabId = vol2Raw.activeTabId || activeTabId;
      const mBt = vol2Raw.subBacktests.find((s) => s.id === MOVED_TP_BACKTEST_ID);
      const nmBt = vol2Raw.subBacktests.find((s) => s.id === NOT_MOVED_TP_BACKTEST_ID);
      if (mBt) movedTrades = (mBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
      if (nmBt) notMovedTrades = (nmBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
    } else if (movedBtRaw && notMovedBtRaw) {
      movedTrades = (movedBtRaw.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
      notMovedTrades = (notMovedBtRaw.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
    }

    const vol2 = {
      id: VOL2_BACKTEST_ID,
      name: VOL2_BACKTEST_NAME,
      activeTabId,
      subBacktests: createVol2SubBacktests(movedTrades, notMovedTrades)
    };

    let vol2NyRaw = rawBacktests.find((b) => b.id === VOL2_NY_BACKTEST_ID);
    let nyMovedTrades = [];
    let nyNotMovedTrades = [];
    let nyActiveTabId = MOVED_TP_BACKTEST_ID;

    if (vol2NyRaw && Array.isArray(vol2NyRaw.subBacktests)) {
      nyActiveTabId = vol2NyRaw.activeTabId || MOVED_TP_BACKTEST_ID;
      const mBt = vol2NyRaw.subBacktests.find((s) => s.id === MOVED_TP_BACKTEST_ID);
      const nmBt = vol2NyRaw.subBacktests.find((s) => s.id === NOT_MOVED_TP_BACKTEST_ID);
      if (mBt) nyMovedTrades = (mBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
      if (nmBt) nyNotMovedTrades = (nmBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
    }

    const vol2Ny = {
      id: VOL2_NY_BACKTEST_ID,
      name: VOL2_NY_BACKTEST_NAME,
      activeTabId: nyActiveTabId,
      subBacktests: createVol2SubBacktests(nyMovedTrades, nyNotMovedTrades)
    };

    let vol1Raw = rawBacktests.find((b) => b.id === VOL1_BACKTEST_ID);
    let vol1Trades = [];
    if (vol1Raw && Array.isArray(vol1Raw.trades)) {
      vol1Trades = vol1Raw.trades.map((t) => normalizeTrade(t));
    } else if (movedTrades.length > 0) {
      vol1Trades = movedTrades.map((t) => normalizeTrade(t));
    }

    const vol1 = {
      id: VOL1_BACKTEST_ID,
      name: VOL1_BACKTEST_NAME,
      trades: vol1Trades
    };

    const customBacktests = rawBacktests
      .filter((b) => b.id !== VOL2_BACKTEST_ID && b.id !== VOL2_NY_BACKTEST_ID && b.id !== VOL1_BACKTEST_ID && b.id !== MOVED_TP_BACKTEST_ID && b.id !== NOT_MOVED_TP_BACKTEST_ID)
      .map((b) => ({
        id: b.id,
        name: b.name || 'Custom Backtest',
        trades: (b.trades || []).map((t) => normalizeTrade(t))
      }));

    return {
      activeId,
      backtests: [vol2, vol2Ny, vol1, ...customBacktests]
    };
  }

  return {
    activeId: VOL2_BACKTEST_ID,
    backtests: [
      {
        id: VOL2_BACKTEST_ID,
        name: VOL2_BACKTEST_NAME,
        activeTabId: MOVED_TP_BACKTEST_ID,
        subBacktests: createVol2SubBacktests()
      },
      {
        id: VOL2_NY_BACKTEST_ID,
        name: VOL2_NY_BACKTEST_NAME,
        activeTabId: MOVED_TP_BACKTEST_ID,
        subBacktests: createVol2SubBacktests()
      },
      {
        id: VOL1_BACKTEST_ID,
        name: VOL1_BACKTEST_NAME,
        trades: []
      }
    ]
  };
}
