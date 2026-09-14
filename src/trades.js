export function validateTrade(input) {
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) errors.date = 'Choose a trade date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.entryTime || ''))) errors.entryTime = 'Use a valid entry time.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.exitTime || ''))) errors.exitTime = 'Use a valid exit time.';
  if (!(Number(input.stopLossPoints) > 0)) errors.stopLossPoints = 'Stop loss must be greater than 0 points.';
  if (String(input.riskReward ?? '').trim() === '' || !Number.isFinite(Number(input.riskReward)) || Number(input.riskReward) < -1) errors.riskReward = 'Risk-to-reward must be at least -1.';
  if (!['win', 'loss'].includes(input.outcome)) errors.outcome = 'Choose win or loss.';
  return errors;
}

export function durationInMinutes(entryTime, exitTime) {
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
  const durations = trades.filter((trade) => validTime(trade.entryTime) && validTime(trade.exitTime)).map((trade) => durationInMinutes(trade.entryTime, trade.exitTime));
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
    averageDurationMinutes: average(durations),
    averageStopLossPoints: average(stopLosses),
    averageEntryTimeMinutes: circularTimeAverage(trades.filter((trade) => validTime(trade.entryTime)).map((trade) => trade.entryTime)),
    averageExitTimeMinutes: circularTimeAverage(trades.filter((trade) => validTime(trade.exitTime)).map((trade) => trade.exitTime))
  };
}

export function normalizeTrade(input) {
  return {
    id: input.id,
    date: String(input.date),
    entryTime: String(input.entryTime),
    exitTime: String(input.exitTime),
    stopLossPoints: Number(input.stopLossPoints),
    riskReward: Number(input.riskReward),
    direction: input.direction === 'short' ? 'short' : 'long',
    outcome: input.outcome === 'loss' ? 'loss' : 'win',
    notes: String(input.notes || '').trim()
  };
}

export const monthKey = (date) => String(date).slice(0, 7);
export const tradesForDate = (trades, date) => trades.filter((trade) => trade.date === date).sort((a, b) => String(a.entryTime || '').localeCompare(String(b.entryTime || '')));
export function groupTradesByDate(trades) {
  return trades.reduce((groups, trade) => {
    (groups[trade.date] ||= []).push(trade);
    return groups;
  }, {});
}
