export function dataStatus(source, detail = '') {
  if (source === 'github') return 'GitHub private data connected.';
  if (source === 'error') return detail;
  return 'LOCAL-ONLY FALLBACK — no private connection is configured. Trades are saved only in this browser.';
}

export function tradeSaveMessage(trade, source) {
  if (source === 'github') return `Trade saved to GitHub private data for ${trade.date}. It is now visible in the calendar and statistics.`;
  return `Trade saved in this browser for ${trade.date}. It is now visible in the calendar and statistics.`;
}

export function showTradeFailure({ formError, formSuccess, setStatus, error }) {
  formSuccess.textContent = '';
  formError.textContent = error.message;
  setStatus('error', error.message);
}

export function showTradeSuccess({ formError, formSuccess, trade, source }) {
  formError.textContent = '';
  formSuccess.textContent = tradeSaveMessage(trade, source);
}
