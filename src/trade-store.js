import { normalizeTrade } from './trades.js';

const LOCAL_KEY = 'gleb-gold-backtest.local-trades.v1';
export class TradeStore {
  constructor({ fetcher = fetch, storage = localStorage, idFactory = () => crypto.randomUUID() } = {}) {
    this.fetcher = fetcher; this.storage = storage; this.idFactory = idFactory; this.mode = null;
  }
  localTrades() { try { return JSON.parse(this.storage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
  saveLocal(trades) { this.storage.setItem(LOCAL_KEY, JSON.stringify(trades)); }
  async request(path = '', options) {
    const response = await this.fetcher(`/api/trades${path}`, options);
    if (!response.ok) throw new Error(`API unavailable (${response.status || 'request failed'})`);
    return response.json();
  }
  async list() {
    try { const trades = await this.request(); this.mode = 'api'; return { source: 'api', trades }; }
    catch { this.mode = 'local'; return { source: 'local', trades: this.localTrades() }; }
  }
  async create(input) {
    const trade = normalizeTrade({ ...input, id: this.idFactory() });
    if (this.mode !== 'local') try { const saved = await this.request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); this.mode = 'api'; return { source: 'api', trade: saved }; } catch { this.mode = 'local'; }
    const trades = [...this.localTrades(), trade]; this.saveLocal(trades); return { source: 'local', trade };
  }
  async update(id, input) {
    const trade = normalizeTrade({ ...input, id });
    if (this.mode !== 'local') try { const saved = await this.request(`/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); this.mode = 'api'; return { source: 'api', trade: saved }; } catch { this.mode = 'local'; }
    const trades = this.localTrades().map((item) => item.id === id ? trade : item); this.saveLocal(trades); return { source: 'local', trade };
  }
  async remove(id) {
    if (this.mode !== 'local') try { await this.request(`/${encodeURIComponent(id)}`, { method: 'DELETE' }); this.mode = 'api'; return { source: 'api' }; } catch { this.mode = 'local'; }
    this.saveLocal(this.localTrades().filter((item) => item.id !== id)); return { source: 'local' };
  }
}
