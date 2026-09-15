import { TradeStore } from './trade-store.js';
import { GitHubTradeSync } from './github-sync.js';
import { wireDataConnection } from './data-connection.js';
import { validateTrade, groupTradesByDate, tradesForDate, durationInMinutes, riskRewardTotal, tradeStats, getLatestTradeMonth } from './trades.js';
import { calendarCells, shiftMonth } from './calendar.js';
import { dataStatus, showTradeFailure, showTradeSuccess } from './feedback.js';
import { syncTakeProfitMoveFields } from './take-profit-move.js';
import { renderBacktestSelect, renderBacktestTabs, wireBacktestControls } from './backtest-ui.js';
import { isVol2Suite } from './backtests.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#trade-form');
const store = new TradeStore({ githubSync: new GitHubTradeSync() });
const state = { trades: [], month: new Date().toISOString().slice(0, 7), selectedDate: null, source: null };
const labels = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const readableDate = (date) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
const formatDuration = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const formatAverageDuration = (minutes) => formatDuration(Math.round(minutes));
const formatPoints = (value) => Number.isInteger(value) ? String(value) : value.toFixed(2);
const formatTimeOfDay = (minutes) => {
  const rounded = Math.round(minutes) % (24 * 60);
  return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
};
const formatRiskReward = (value) => `${value > 0 ? '+' : ''}${formatPoints(value)} R`;

const syncTakeProfitMoveForm = () => syncTakeProfitMoveFields({
  moved: $('#movedTakeProfit'),
  container: $('#initial-scenario-fieldset'),
  initialExitTime: $('#initialExitTime'),
  initialOutcome: $('#initialOutcome'),
  initialRiskReward: $('#initialRiskReward')
});

function setStatus(source, detail = '') {
  state.source = source;
  $('#data-status').textContent = dataStatus(source, detail);
  $('#data-status').classList.toggle('local', source === 'local');
}

function renderCalendar() {
  $('#calendar-heading').textContent = labels.format(new Date(`${state.month}-01T12:00:00`));
  const grouped = groupTradesByDate(state.trades);
  const calendar = $('#calendar');
  calendar.replaceChildren();
  calendarCells(state.month).forEach((cell) => {
    const trades = grouped[cell.date] || [];
    const count = trades.length;
    const riskReward = riskRewardTotal(trades);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day ${cell.inMonth ? '' : 'outside'} ${state.selectedDate === cell.date ? 'selected' : ''}`;
    button.dataset.date = cell.date;
    button.setAttribute('aria-label', `${readableDate(cell.date)}${count ? `, ${count} trade${count === 1 ? '' : 's'}, R total ${formatRiskReward(riskReward)}` : ', no trades'}`);
    button.innerHTML = `<span>${cell.day}</span>${count ? `<b>${count} trade${count === 1 ? '' : 's'}</b><i>R total ${formatRiskReward(riskReward)}</i>` : ''}`;
    button.addEventListener('click', () => { state.selectedDate = cell.date; renderCalendar(); renderDay(); });
    calendar.append(button);
  });
}

function renderDay() {
  const list = $('#trade-list');
  list.replaceChildren();
  if (!state.selectedDate) {
    $('#day-heading').textContent = 'Choose a date';
    $('#day-count').textContent = '';
    list.innerHTML = '<p class="muted">Select a calendar day to inspect recorded trades.</p>';
    return;
  }
  const trades = tradesForDate(state.trades, state.selectedDate);
  $('#day-heading').textContent = readableDate(state.selectedDate);
  $('#day-count').textContent = `${trades.length} trade${trades.length === 1 ? '' : 's'}`;
  if (!trades.length) {
    list.innerHTML = '<p class="muted">No trades recorded for this date.</p>';
    return;
  }
  const template = $('#trade-row');
  trades.forEach((trade) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const duration = durationInMinutes(trade.entryTime, trade.exitTime, trade.date, trade.exitDate);
    row.querySelector('.trade-meta').innerHTML = `<strong>${trade.entryTime}–${trade.exitTime}</strong>${trade.exitDate ? `<span>Exit date: ${escapeText(trade.exitDate)}</span>` : ''}<span class="pill ${trade.direction}">${trade.direction}</span><span class="pill ${trade.outcome}">${trade.outcome}</span>${trade.notes ? `<p>${escapeText(trade.notes)}</p>` : ''}`;
    row.querySelector('.trade-values').textContent = `${formatDuration(duration)} · SL ${trade.stopLossPoints} gold points/pips · R:R ${trade.riskReward}`;
    row.querySelector('.edit').addEventListener('click', () => startEdit(trade));
    row.querySelector('.delete').addEventListener('click', async () => {
      if (confirm(`Delete the ${trade.entryTime} ${trade.direction} trade?`)) {
        try {
          await store.remove(trade.id);
          await refresh();
        } catch (error) {
          setStatus('error', error.message);
        }
      }
    });
    list.append(row);
  });
}

function renderStats() {
  const stats = tradeStats(state.trades);
  const values = [
    ['Total winning trades', stats.totalWins], ['Total losses', stats.totalLosses], ['Total R', formatRiskReward(riskRewardTotal(state.trades))],
    ['Total long trades', stats.totalLong], ['Total short trades', stats.totalShort],
    ['Long wins', stats.longWins], ['Long losses', stats.longLosses],
    ['Short wins', stats.shortWins], ['Short losses', stats.shortLosses],
    ['Moved take profits', stats.movedTakeProfits], ['Good take-profit moves', stats.goodTakeProfitMoves], ['Wasted take-profit moves', stats.wastedTakeProfitMoves],
    ['Average entry time of day', formatTimeOfDay(stats.averageEntryTimeMinutes)],
    ['Average exit time of day', formatTimeOfDay(stats.averageExitTimeMinutes)],
    ['Average duration in trade', formatAverageDuration(stats.averageDurationMinutes)],
    ['Average stop loss (gold points/pips)', formatPoints(stats.averageStopLossPoints)]
  ];
  const statsList = $('#trade-stats');
  statsList.replaceChildren();
  values.forEach(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.textContent = value;
    item.append(term, definition);
    statsList.append(item);
  });

  const body = $('#all-trades');
  body.replaceChildren();
  if (!state.trades.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 9;
    cell.className = 'muted';
    cell.textContent = 'No trades recorded.';
    row.append(cell);
    body.append(row);
    return;
  }

  [...state.trades].sort((a, b) => `${a.date} ${a.entryTime}`.localeCompare(`${b.date} ${b.entryTime}`)).forEach((trade) => {
    const row = document.createElement('tr');
    const duration = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(trade.exitTime || '')) ? formatDuration(durationInMinutes(trade.entryTime, trade.exitTime, trade.date, trade.exitDate)) : '—';
    [trade.date, trade.entryTime, trade.exitDate ? trade.exitDate : '', trade.exitTime || '—', duration, trade.direction, trade.outcome || '—', trade.stopLossPoints, trade.riskReward].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
}

function escapeText(value) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function values() {
  return Object.fromEntries(new FormData(form));
}

function clearForm() {
  form.reset();
  syncTakeProfitMoveForm();
  $('#trade-id').value = '';
  $('#cancel-edit').hidden = true;
  form.querySelector('.primary').textContent = 'Save trade';
  $('#form-error').textContent = '';
  $('#form-success').textContent = '';
}

function startEdit(trade) {
  Object.entries(trade).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) field.value = value;
  });
  syncTakeProfitMoveForm();
  $('#trade-id').value = trade.id || trade.pairId;
  $('#cancel-edit').hidden = false;
  form.querySelector('.primary').textContent = 'Update trade';
  $('#trade-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let isInitialRefresh = true;

async function refresh(options = {}) {
  const isInitial = options.isInitial ?? isInitialRefresh;
  const result = await store.list();
  state.trades = result.trades;
  setStatus(result.source);

  if (isInitial) {
    isInitialRefresh = false;
    state.month = getLatestTradeMonth(state.trades);
  }

  const activeId = store.getActiveBacktestId();
  const activeTabId = result.activeTabId;

  renderBacktestTabs({
    activeId,
    activeTabId,
    containerEl: $('.backtest-tabs')
  });

  renderBacktestSelect({
    backtests: store.listBacktests(),
    activeId,
    selectEl: $('#backtest-select'),
    deleteBtn: $('#delete-backtest')
  });

  const isVol2 = isVol2Suite(activeId);
  const movedContainer = $('#movedTakeProfit')?.parentElement;
  if (movedContainer) {
    movedContainer.hidden = !isVol2;
  }

  if (isVol2) {
    syncTakeProfitMoveForm();
  } else {
    if ($('#movedTakeProfit')) $('#movedTakeProfit').value = '';
    const initialFieldset = $('#initial-scenario-fieldset');
    if (initialFieldset) initialFieldset.hidden = true;
  }

  renderCalendar();
  renderDay();
  renderStats();
}

let isSubmitting = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting) return;

  isSubmitting = true;
  const submitBtn = form.querySelector('button.primary') || form.querySelector('.primary');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    const input = values();
    const errors = validateTrade(input);
    if (Object.keys(errors).length) {
      $('#form-success').textContent = '';
      $('#form-error').textContent = Object.values(errors).join(' ');
      return;
    }

    const id = $('#trade-id').value;
    const saved = id ? await store.update(id, input) : await store.create(input);
    state.selectedDate = input.date;
    state.month = input.date.slice(0, 7);
    clearForm();
    await refresh();
    showTradeSuccess({ formError: $('#form-error'), formSuccess: $('#form-success'), trade: saved.trade, source: saved.source });
  } catch (error) {
    showTradeFailure({ formError: $('#form-error'), formSuccess: $('#form-success'), setStatus, error });
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = $('#trade-id').value ? 'Update trade' : 'Save trade';
    }
  }
});

$('#movedTakeProfit').addEventListener('change', syncTakeProfitMoveForm);
syncTakeProfitMoveForm();
$('#cancel-edit').addEventListener('click', clearForm);
$('#previous-month').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); renderCalendar(); });
$('#next-month').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); renderCalendar(); });
$('#today-month').addEventListener('click', () => { state.month = new Date().toISOString().slice(0, 7); renderCalendar(); });

wireDataConnection({
  connectionButton: $('#data-connection'),
  syncButton: $('#sync-trades'),
  dialog: $('#connection-dialog'),
  form: $('#connection-form'),
  closeButton: $('#close-connection'),
  store,
  refresh,
  setStatus,
  setDialogStatus: (kind, message) => {
    const status = $('#connection-status');
    status.textContent = message;
    status.classList.toggle('error', kind === 'error');
    status.classList.toggle('success', kind === 'success');
  }
});

wireBacktestControls({
  store,
  containerEl: $('.backtest-tabs'),
  selectEl: $('#backtest-select'),
  createBtn: $('#create-backtest'),
  renameBtn: $('#rename-backtest'),
  deleteBtn: $('#delete-backtest'),
  refresh
});

refresh().catch((error) => setStatus('error', error.message));
