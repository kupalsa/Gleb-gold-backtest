import { TradeStore } from './trade-store.js';
import { GitHubTradeSync } from './github-sync.js';
import { wireDataConnection } from './data-connection.js';
import { validateTrade, groupTradesByDate, tradesForDate, durationInMinutes, tradeStats } from './trades.js';
import { calendarCells, shiftMonth } from './calendar.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#trade-form'); const store = new TradeStore({ githubSync: new GitHubTradeSync() });
const state = { trades: [], month: new Date().toISOString().slice(0, 7), selectedDate: null, source: null };
const labels = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const readableDate = (date) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const formatDuration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const formatAverageDuration = (minutes) => formatDuration(Math.round(minutes));
const formatPoints = (value) => Number.isInteger(value) ? String(value) : value.toFixed(2);

function setStatus(source, detail = '') {
  state.source = source;
  $('#data-status').textContent = source === 'github' ? 'GitHub private data connected.' : source === 'error' ? detail : 'LOCAL-ONLY FALLBACK — no private connection is configured. Trades are saved only in this browser.';
  $('#data-status').classList.toggle('local', source === 'local');
}
function renderCalendar() {
  $('#calendar-heading').textContent = labels.format(new Date(`${state.month}-01T12:00:00`));
  const grouped = groupTradesByDate(state.trades); const calendar = $('#calendar'); calendar.replaceChildren();
  calendarCells(state.month).forEach((cell) => {
    const count = grouped[cell.date]?.length || 0; const button = document.createElement('button');
    button.type = 'button'; button.className = `day ${cell.inMonth ? '' : 'outside'} ${state.selectedDate === cell.date ? 'selected' : ''}`;
    button.dataset.date = cell.date; button.setAttribute('aria-label', `${readableDate(cell.date)}${count ? `, ${count} trade${count === 1 ? '' : 's'}` : ', no trades'}`);
    button.innerHTML = `<span>${cell.day}</span>${count ? `<b>${count}</b>` : ''}`; button.addEventListener('click', () => { state.selectedDate = cell.date; renderCalendar(); renderDay(); }); calendar.append(button);
  });
}
function renderDay() {
  const list = $('#trade-list'); list.replaceChildren();
  if (!state.selectedDate) { $('#day-heading').textContent = 'Choose a date'; $('#day-count').textContent = ''; list.innerHTML = '<p class="muted">Select a calendar day to inspect recorded trades.</p>'; return; }
  const trades = tradesForDate(state.trades, state.selectedDate); $('#day-heading').textContent = readableDate(state.selectedDate); $('#day-count').textContent = `${trades.length} trade${trades.length === 1 ? '' : 's'}`;
  if (!trades.length) { list.innerHTML = '<p class="muted">No trades recorded for this date.</p>'; return; }
  const template = $('#trade-row'); trades.forEach((trade) => { const row = template.content.firstElementChild.cloneNode(true); const duration = durationInMinutes(trade.entryTime, trade.exitTime); row.querySelector('.trade-meta').innerHTML = `<strong>${trade.entryTime}–${trade.exitTime}</strong><span class="pill ${trade.direction}">${trade.direction}</span><span class="pill ${trade.outcome}">${trade.outcome}</span>${trade.notes ? `<p>${escapeText(trade.notes)}</p>` : ''}`; row.querySelector('.trade-values').textContent = `${formatDuration(duration)} · SL ${trade.stopLossPoints} gold points/pips · R:R ${trade.riskReward}`; row.querySelector('.edit').addEventListener('click', () => startEdit(trade)); row.querySelector('.delete').addEventListener('click', async () => { if (confirm(`Delete the ${trade.entryTime} ${trade.direction} trade?`)) try { await store.remove(trade.id); await refresh(); } catch (error) { setStatus('error', error.message); } }); list.append(row); });
}
function renderStats() {
  const stats = tradeStats(state.trades);
  const values = [
    ['Total wins', stats.totalWins], ['Total losses', stats.totalLosses],
    ['Average duration in trade', formatAverageDuration(stats.averageDurationMinutes)],
    ['Average stop loss (gold points/pips)', formatPoints(stats.averageStopLossPoints)]
  ];
  const statsList = $('#trade-stats'); statsList.replaceChildren();
  values.forEach(([label, value]) => { const item = document.createElement('div'); const term = document.createElement('dt'); const definition = document.createElement('dd'); term.textContent = label; definition.textContent = value; item.append(term, definition); statsList.append(item); });
  const body = $('#all-trades'); body.replaceChildren();
  if (!state.trades.length) { const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 8; cell.className = 'muted'; cell.textContent = 'No trades recorded.'; row.append(cell); body.append(row); return; }
  [...state.trades].sort((a, b) => `${a.date} ${a.entryTime}`.localeCompare(`${b.date} ${b.entryTime}`)).forEach((trade) => {
    const row = document.createElement('tr'); const duration = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(trade.exitTime || '')) ? formatDuration(durationInMinutes(trade.entryTime, trade.exitTime)) : '—';
    [trade.date, trade.entryTime, trade.exitTime || '—', duration, trade.direction, trade.outcome || '—', trade.stopLossPoints, trade.riskReward].forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }); body.append(row);
  });
}
function escapeText(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function values() { return Object.fromEntries(new FormData(form)); }
function clearForm() { form.reset(); $('#trade-id').value = ''; $('#cancel-edit').hidden = true; form.querySelector('.primary').textContent = 'Save trade'; $('#form-error').textContent = ''; }
function startEdit(trade) { Object.entries(trade).forEach(([key, value]) => { const field = form.elements[key]; if (field) field.value = value; }); $('#trade-id').value = trade.id; $('#cancel-edit').hidden = false; form.querySelector('.primary').textContent = 'Update trade'; $('#trade-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function refresh() { const result = await store.list(); state.trades = result.trades; setStatus(result.source); renderCalendar(); renderDay(); renderStats(); }
form.addEventListener('submit', async (event) => { event.preventDefault(); const input = values(); const errors = validateTrade(input); if (Object.keys(errors).length) { $('#form-error').textContent = Object.values(errors).join(' '); return; } try { const id = $('#trade-id').value; if (id) await store.update(id, input); else await store.create(input); state.selectedDate = input.date; state.month = input.date.slice(0, 7); clearForm(); await refresh(); } catch (error) { setStatus('error', error.message); } });
$('#cancel-edit').addEventListener('click', clearForm); $('#previous-month').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); renderCalendar(); }); $('#next-month').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); renderCalendar(); }); $('#today-month').addEventListener('click', () => { state.month = new Date().toISOString().slice(0, 7); renderCalendar(); });
wireDataConnection({ connectionButton: $('#data-connection'), syncButton: $('#sync-trades'), dialog: $('#connection-dialog'), form: $('#connection-form'), closeButton: $('#close-connection'), store, refresh, setStatus });
refresh().catch((error) => setStatus('error', error.message));
