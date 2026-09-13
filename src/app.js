import { TradeStore } from './trade-store.js';
import { validateTrade, groupTradesByDate, tradesForDate } from './trades.js';
import { calendarCells, shiftMonth } from './calendar.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#trade-form'); const store = new TradeStore();
const state = { trades: [], month: new Date().toISOString().slice(0, 7), selectedDate: null, source: null };
const labels = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const readableDate = (date) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));

function setStatus(source) {
  state.source = source;
  $('#data-status').textContent = source === 'api' ? 'Shared API connected.' : 'LOCAL-ONLY FALLBACK — API unavailable. Trades are saved only in this browser.';
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
  const template = $('#trade-row'); trades.forEach((trade) => { const row = template.content.firstElementChild.cloneNode(true); row.querySelector('.trade-meta').innerHTML = `<strong>${trade.entryTime}</strong><span class="pill ${trade.direction}">${trade.direction}</span>${trade.notes ? `<p>${escapeText(trade.notes)}</p>` : ''}`; row.querySelector('.trade-values').textContent = `SL ${trade.stopLossPoints} pts · R:R ${trade.riskReward}`; row.querySelector('.edit').addEventListener('click', () => startEdit(trade)); row.querySelector('.delete').addEventListener('click', async () => { if (confirm(`Delete the ${trade.entryTime} ${trade.direction} trade?`)) { await store.remove(trade.id); await refresh(); } }); list.append(row); });
}
function escapeText(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function values() { return Object.fromEntries(new FormData(form)); }
function clearForm() { form.reset(); $('#trade-id').value = ''; $('#cancel-edit').hidden = true; form.querySelector('.primary').textContent = 'Save trade'; $('#form-error').textContent = ''; }
function startEdit(trade) { Object.entries(trade).forEach(([key, value]) => { const field = form.elements[key]; if (field) field.value = value; }); $('#trade-id').value = trade.id; $('#cancel-edit').hidden = false; form.querySelector('.primary').textContent = 'Update trade'; $('#trade-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function refresh() { const result = await store.list(); state.trades = result.trades; setStatus(result.source); renderCalendar(); renderDay(); }
form.addEventListener('submit', async (event) => { event.preventDefault(); const input = values(); const errors = validateTrade(input); if (Object.keys(errors).length) { $('#form-error').textContent = Object.values(errors).join(' '); return; } const id = $('#trade-id').value; if (id) await store.update(id, input); else await store.create(input); state.selectedDate = input.date; state.month = input.date.slice(0, 7); clearForm(); await refresh(); });
$('#cancel-edit').addEventListener('click', clearForm); $('#previous-month').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); renderCalendar(); }); $('#next-month').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); renderCalendar(); }); $('#today-month').addEventListener('click', () => { state.month = new Date().toISOString().slice(0, 7); renderCalendar(); });
refresh();
