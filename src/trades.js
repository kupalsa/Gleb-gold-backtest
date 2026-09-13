export function validateTrade(input) {
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) errors.date = 'Choose a trade date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.entryTime || ''))) errors.entryTime = 'Use a valid entry time.';
  if (!(Number(input.stopLossPoints) > 0)) errors.stopLossPoints = 'Stop loss must be greater than 0 points.';
  if (!(Number(input.riskReward) > 0)) errors.riskReward = 'Risk-to-reward must be greater than 0.';
  return errors;
}

export function normalizeTrade(input) {
  return {
    id: input.id,
    date: String(input.date),
    entryTime: String(input.entryTime),
    stopLossPoints: Number(input.stopLossPoints),
    riskReward: Number(input.riskReward),
    direction: input.direction === 'short' ? 'short' : 'long',
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
