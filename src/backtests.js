import { normalizeTrade } from './trades.js';

export const DEFAULT_BACKTEST_ID = 'default';
export const DEFAULT_BACKTEST_NAME = 'Main Backtest';

export function normalizeBacktestsData(raw, idFactory = () => crypto.randomUUID()) {
  if (!raw) {
    return {
      activeId: DEFAULT_BACKTEST_ID,
      backtests: [{ id: DEFAULT_BACKTEST_ID, name: DEFAULT_BACKTEST_NAME, trades: [] }]
    };
  }

  // If raw is a flat array of trades
  if (Array.isArray(raw)) {
    return {
      activeId: DEFAULT_BACKTEST_ID,
      backtests: [{
        id: DEFAULT_BACKTEST_ID,
        name: DEFAULT_BACKTEST_NAME,
        trades: raw.map((t) => normalizeTrade(t))
      }]
    };
  }

  // If raw is an object
  if (typeof raw === 'object' && raw !== null) {
    let backtests = Array.isArray(raw.backtests) ? raw.backtests : [];
    if (backtests.length === 0) {
      backtests = [{ id: DEFAULT_BACKTEST_ID, name: DEFAULT_BACKTEST_NAME, trades: [] }];
    } else {
      backtests = backtests.map((b, idx) => ({
        id: String(b.id || idFactory()),
        name: String(b.name || `Backtest ${idx + 1}`),
        trades: Array.isArray(b.trades) ? b.trades.map((t) => normalizeTrade(t)) : []
      }));
    }

    let activeId = raw.activeId;
    if (!activeId || !backtests.some((b) => b.id === activeId)) {
      activeId = backtests[0].id;
    }

    return { activeId, backtests };
  }

  return {
    activeId: DEFAULT_BACKTEST_ID,
    backtests: [{ id: DEFAULT_BACKTEST_ID, name: DEFAULT_BACKTEST_NAME, trades: [] }]
  };
}
