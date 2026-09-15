export function validateTrade(input) {
  const errors = {};
  const entryDate = String(input.date || '');
  const exitDate = String(input.exitDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) errors.date = 'Choose a trade date.';
  if (exitDate && !/^\d{4}-\d{2}-\d{2}$/.test(exitDate)) errors.exitDate = 'Use a valid exit date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.entryTime || ''))) errors.entryTime = 'Use a valid entry time.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.exitTime || ''))) errors.exitTime = 'Use a valid exit time.';
  if (exitDate && !errors.date && !errors.exitDate && !errors.entryTime && !errors.exitTime && durationInMinutes(input.entryTime, input.exitTime, entryDate, exitDate) < 0) errors.exitDate = 'Exit date and time cannot be before entry date and time.';
  if (!(Number(input.stopLossPoints) > 0)) errors.stopLossPoints = 'Stop loss must be greater than 0 points.';
  if (String(input.riskReward ?? '').trim() === '' || !Number.isFinite(Number(input.riskReward)) || Number(input.riskReward) < -1) errors.riskReward = 'Risk-to-reward must be at least -1.';
  if (!['win', 'loss'].includes(input.outcome)) errors.outcome = 'Choose win or loss.';

  if (input.movedTakeProfit === 'yes') {
    const initialExitDate = String(input.initialExitDate || '').trim();
    if (initialExitDate && !/^\d{4}-\d{2}-\d{2}$/.test(initialExitDate)) errors.initialExitDate = 'Use a valid initial exit date.';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.initialExitTime || ''))) errors.initialExitTime = 'Use a valid initial exit time.';
    if (!['win', 'loss'].includes(input.initialOutcome)) errors.initialOutcome = 'Choose initial win or loss.';
    if (String(input.initialRiskReward ?? '').trim() === '' || !Number.isFinite(Number(input.initialRiskReward)) || Number(input.initialRiskReward) < -1) errors.initialRiskReward = 'Initial risk-to-reward must be at least -1.';
    if (initialExitDate && !errors.date && !errors.initialExitDate && !errors.entryTime && !errors.initialExitTime && durationInMinutes(input.entryTime, input.initialExitTime, entryDate, initialExitDate) < 0) errors.initialExitDate = 'Initial exit date and time cannot be before entry date and time.';
  }

  return errors;
}

export function durationInMinutes(entryTime, exitTime, entryDate, exitDate) {
  if (exitDate) return (Date.parse(`${exitDate}T${exitTime}:00Z`) - Date.parse(`${entryDate}T${entryTime}:00Z`)) / 60000;
  const toMinutes = (time) => {
    const [hours, minutes] = String(time).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const duration = toMinutes(exitTime) - toMinutes(entryTime);
  return duration < 0 ? duration + 24 * 60 : duration;
}

const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''));
const timeToMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};
const circularTimeAverage = (times) => {
  if (!times.length) return 0;
  const radians = times.map((time) => timeToMinutes(time) * (2 * Math.PI / (24 * 60)));
  const angle = Math.atan2(radians.reduce((sum, value) => sum + Math.sin(value), 0), radians.reduce((sum, value) => sum + Math.cos(value), 0));
  const minutes = ((angle < 0 ? angle + 2 * Math.PI : angle) * 24 * 60 / (2 * Math.PI)) % (24 * 60);
  return Math.round(minutes * 100) / 100;
};

export const riskRewardTotal = (trades) => trades.reduce((sum, trade) => Number.isFinite(Number(trade.riskReward)) ? sum + Number(trade.riskReward) : sum, 0);

export function tradeStats(trades) {
  const durations = trades.filter((trade) => validTime(trade.entryTime) && validTime(trade.exitTime)).map((trade) => durationInMinutes(trade.entryTime, trade.exitTime, trade.date, trade.exitDate));
  const stopLosses = trades.map((trade) => Number(trade.stopLossPoints)).filter((value) => value > 0);
  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const longTrades = trades.filter((trade) => trade.direction === 'long');
  const shortTrades = trades.filter((trade) => trade.direction === 'short');
  return {
    totalWins: trades.filter((trade) => trade.outcome === 'win').length,
    totalLosses: trades.filter((trade) => trade.outcome === 'loss').length,
    totalLong: longTrades.length,
    totalShort: shortTrades.length,
    longWins: longTrades.filter((trade) => trade.outcome === 'win').length,
    longLosses: longTrades.filter((trade) => trade.outcome === 'loss').length,
    shortWins: shortTrades.filter((trade) => trade.outcome === 'win').length,
    shortLosses: shortTrades.filter((trade) => trade.outcome === 'loss').length,
    movedTakeProfits: trades.filter((trade) => trade.movedTakeProfit === 'yes').length,
    goodTakeProfitMoves: trades.filter((trade) => trade.movedTakeProfit === 'yes' && trade.takeProfitMoveResult === 'good').length,
    wastedTakeProfitMoves: trades.filter((trade) => trade.movedTakeProfit === 'yes' && trade.takeProfitMoveResult === 'wasted').length,
    averageDurationMinutes: average(durations),
    averageStopLossPoints: average(stopLosses),
    averageEntryTimeMinutes: circularTimeAverage(trades.filter((trade) => validTime(trade.entryTime)).map((trade) => trade.entryTime)),
    averageExitTimeMinutes: circularTimeAverage(trades.filter((trade) => validTime(trade.exitTime)).map((trade) => trade.exitTime))
  };
}

export function normalizeTrade(input) {
  const trade = {
    id: input.id,
    pairId: input.pairId || input.id,
    date: String(input.date),
    entryTime: String(input.entryTime),
    exitTime: String(input.exitTime),
    stopLossPoints: Number(input.stopLossPoints),
    riskReward: Number(input.riskReward),
    direction: input.direction === 'short' ? 'short' : 'long',
    outcome: input.outcome === 'loss' ? 'loss' : 'win',
    notes: String(input.notes || '').trim()
  };
  if (String(input.exitDate || '').trim()) trade.exitDate = String(input.exitDate);
  if ('movedTakeProfit' in input) {
    trade.movedTakeProfit = input.movedTakeProfit === 'yes' ? 'yes' : (input.movedTakeProfit === 'no' ? 'no' : '');
    trade.takeProfitMoveResult = trade.movedTakeProfit === 'yes' && ['good', 'wasted'].includes(input.takeProfitMoveResult) ? input.takeProfitMoveResult : '';
  }
  if (String(input.initialExitDate || '').trim()) trade.initialExitDate = String(input.initialExitDate);
  if (input.initialExitTime) trade.initialExitTime = String(input.initialExitTime);
  if (input.initialOutcome) trade.initialOutcome = input.initialOutcome === 'loss' ? 'loss' : 'win';
  if (input.initialRiskReward !== undefined && input.initialRiskReward !== '' && !Number.isNaN(Number(input.initialRiskReward))) {
    trade.initialRiskReward = Number(input.initialRiskReward);
  }
  return trade;
}

export const monthKey = (date) => String(date).slice(0, 7);
export const tradesForDate = (trades, date) => trades.filter((trade) => trade.date === date).sort((a, b) => String(a.entryTime || '').localeCompare(String(b.entryTime || '')));
export function groupTradesByDate(trades) {
  return trades.reduce((groups, trade) => {
    (groups[trade.date] ||= []).push(trade);
    return groups;
  }, {});
}
