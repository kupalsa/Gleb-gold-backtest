import { normalizeTrade } from './trades.js';

export const MOVED_TP_BACKTEST_ID = 'moved-tp';
export const MOVED_TP_BACKTEST_NAME = 'Moved TP';
export const NOT_MOVED_TP_BACKTEST_ID = 'not-moved-tp';
export const NOT_MOVED_TP_BACKTEST_NAME = 'Not Moved TP';

export const DEFAULT_BACKTEST_ID = MOVED_TP_BACKTEST_ID;
export const DEFAULT_BACKTEST_NAME = MOVED_TP_BACKTEST_NAME;

export function normalizeBacktestsData(raw, idFactory = () => crypto.randomUUID()) {
  let activeId = MOVED_TP_BACKTEST_ID;
  let movedTrades = [];
  let notMovedTrades = [];

  if (!raw) {
    return {
      activeId: MOVED_TP_BACKTEST_ID,
      backtests: [
        { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: [] },
        { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: [] }
      ]
    };
  }

  // If raw is a flat array of trades
  if (Array.isArray(raw)) {
    raw.forEach((t) => {
      const pairId = t.pairId || t.id || idFactory();
      const normMoved = normalizeTrade({ ...t, pairId, id: t.id || pairId });
      const normNotMoved = normalizeTrade({
        ...t,
        pairId,
        id: t.id || pairId,
        exitDate: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? (t.initialExitDate || t.exitDate) : t.exitDate,
        exitTime: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialExitTime : t.exitTime,
        outcome: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialOutcome : t.outcome,
        riskReward: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialRiskReward : t.riskReward
      });
      movedTrades.push(normMoved);
      notMovedTrades.push(normNotMoved);
    });
  } else if (typeof raw === 'object' && raw !== null) {
    if (raw.activeId === NOT_MOVED_TP_BACKTEST_ID) {
      activeId = NOT_MOVED_TP_BACKTEST_ID;
    }

    const backtests = Array.isArray(raw.backtests) ? raw.backtests : [];
    const movedBt = backtests.find((b) => b.id === MOVED_TP_BACKTEST_ID);
    const notMovedBt = backtests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID);

    if (movedBt && notMovedBt) {
      movedTrades = (movedBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
      notMovedTrades = (notMovedBt.trades || []).map((t) => normalizeTrade({ ...t, pairId: t.pairId || t.id || idFactory() }));
    } else {
      // Migrate trades from legacy backtest array (e.g. 'default' or custom)
      const allTradesMap = new Map();
      backtests.forEach((b) => {
        if (Array.isArray(b.trades)) {
          b.trades.forEach((t) => {
            const key = t.pairId || t.id || `${t.date}-${t.entryTime}-${t.notes}`;
            if (!allTradesMap.has(key)) {
              allTradesMap.set(key, t);
            }
          });
        }
      });

      allTradesMap.forEach((t) => {
        const pairId = t.pairId || t.id || idFactory();
        const normMoved = normalizeTrade({ ...t, pairId, id: t.id || pairId });
        const normNotMoved = normalizeTrade({
          ...t,
          pairId,
          id: t.id || pairId,
          exitDate: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? (t.initialExitDate || t.exitDate) : t.exitDate,
          exitTime: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialExitTime : t.exitTime,
          outcome: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialOutcome : t.outcome,
          riskReward: (t.movedTakeProfit === 'yes' && t.initialExitTime) ? t.initialRiskReward : t.riskReward
        });
        movedTrades.push(normMoved);
        notMovedTrades.push(normNotMoved);
      });
    }
  }

  return {
    activeId,
    backtests: [
      { id: MOVED_TP_BACKTEST_ID, name: MOVED_TP_BACKTEST_NAME, trades: movedTrades },
      { id: NOT_MOVED_TP_BACKTEST_ID, name: NOT_MOVED_TP_BACKTEST_NAME, trades: notMovedTrades }
    ]
  };
}
