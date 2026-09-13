import { normalizeTrade } from './trades.js';

const LOCAL_KEY = 'gleb-gold-backtest.local-trades.v1';
export class TradeStore {
  constructor({ storage = localStorage, idFactory = () => crypto.randomUUID(), githubSync = null } = {}) {
    this.storage = storage; this.idFactory = idFactory; this.githubSync = githubSync; this.mode = null; this.githubTrades = []; this.githubSha = null;
  }
  localTrades() { try { return JSON.parse(this.storage.getItem(LOCAL_KEY) || '[]'); } catch { return []; } }
  saveLocal(trades) { this.storage.setItem(LOCAL_KEY, JSON.stringify(trades)); }
  hasGitHubConnection() { return Boolean(this.githubSync?.connection); }
  connectGitHub(connection) { if (!this.githubSync) throw new Error('GitHub sync is unavailable.'); this.githubSync.connect(connection); this.githubTrades = []; this.githubSha = null; }
  async list() {
    if (this.hasGitHubConnection()) {
      const { trades, sha } = await this.githubSync.load();
      this.githubTrades = trades; this.githubSha = sha; this.mode = 'github';
      return { source: 'github', trades };
    }
    this.mode = 'local'; return { source: 'local', trades: this.localTrades() };
  }
  async saveGitHub(trades) {
    if (!this.githubSha) await this.list();
    const saved = await this.githubSync.save(trades, this.githubSha);
    this.githubTrades = trades; this.githubSha = saved.sha; this.mode = 'github';
  }
  async create(input) {
    const trade = normalizeTrade({ ...input, id: this.idFactory() });
    if (this.hasGitHubConnection()) { await this.saveGitHub([...this.githubTrades, trade]); return { source: 'github', trade }; }
    const trades = [...this.localTrades(), trade]; this.saveLocal(trades); this.mode = 'local'; return { source: 'local', trade };
  }
  async update(id, input) {
    const trade = normalizeTrade({ ...input, id });
    if (this.hasGitHubConnection()) { await this.saveGitHub(this.githubTrades.map((item) => item.id === id ? trade : item)); return { source: 'github', trade }; }
    const trades = this.localTrades().map((item) => item.id === id ? trade : item); this.saveLocal(trades); this.mode = 'local'; return { source: 'local', trade };
  }
  async remove(id) {
    if (this.hasGitHubConnection()) { await this.saveGitHub(this.githubTrades.filter((item) => item.id !== id)); return { source: 'github' }; }
    this.saveLocal(this.localTrades().filter((item) => item.id !== id)); this.mode = 'local'; return { source: 'local' };
  }
}
