import { normalizeTrade } from './trades.js';
import { normalizeBacktestsData, MOVED_TP_BACKTEST_ID, NOT_MOVED_TP_BACKTEST_ID } from './backtests.js';

const LOCAL_KEY = 'gleb-gold-backtest.local-trades.v1';

export class TradeStore {
  constructor({ storage = localStorage, idFactory = () => crypto.randomUUID(), githubSync = null } = {}) {
    this.storage = storage;
    this.idFactory = idFactory;
    this.githubSync = githubSync;
    this.mode = null;
    this.githubData = null;
    this.githubSha = null;
  }

  localData() {
    try {
      const raw = JSON.parse(this.storage.getItem(LOCAL_KEY));
      return normalizeBacktestsData(raw, this.idFactory);
    } catch {
      return normalizeBacktestsData(null, this.idFactory);
    }
  }

  saveLocal(data) {
    this.storage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  hasGitHubConnection() {
    return Boolean(this.githubSync?.connection);
  }

  connectionDetails() {
    const connection = this.githubSync?.connection;
    return connection ? { owner: connection.owner, repo: connection.repo } : null;
  }

  connectGitHub(connection) {
    if (!this.githubSync) throw new Error('GitHub sync is unavailable.');
    this.githubSync.connect(connection);
    this.githubData = null;
    this.githubSha = null;
  }

  async list() {
    let data;
    if (this.hasGitHubConnection()) {
      const { trades: raw, sha } = await this.githubSync.load();
      data = normalizeBacktestsData(raw, this.idFactory);
      this.githubData = data;
      this.githubSha = sha;
      this.mode = 'github';
    } else {
      data = this.localData();
      this.mode = 'local';
    }

    const activeBacktest = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];
    return {
      source: this.mode,
      trades: activeBacktest ? activeBacktest.trades : [],
      backtests: data.backtests,
      activeId: data.activeId
    };
  }

  getData() {
    if (this.hasGitHubConnection() && this.githubData) {
      return this.githubData;
    }
    return this.localData();
  }

  async saveData(data) {
    if (this.hasGitHubConnection()) {
      if (!this.githubSha) await this.list();
      const saved = await this.githubSync.save(data, this.githubSha);
      this.githubData = data;
      this.githubSha = saved.sha;
      this.mode = 'github';
    } else {
      this.saveLocal(data);
      this.mode = 'local';
    }
  }

  listBacktests() {
    const data = this.getData();
    return data.backtests;
  }

  getActiveBacktestId() {
    const data = this.getData();
    return data.activeId;
  }

  async selectBacktest(id) {
    const data = this.getData();
    const exists = data.backtests.some((b) => b.id === id);
    if (!exists) throw new Error(`Backtest with id "${id}" does not exist.`);
    data.activeId = id;
    await this.saveData(data);
    return data;
  }

  async createBacktest(name) {
    const data = this.getData();
    const newId = this.idFactory();
    const newBacktest = {
      id: newId,
      name: name || 'New Backtest',
      trades: []
    };
    data.backtests.push(newBacktest);
    data.activeId = newId;
    await this.saveData(data);
    return newBacktest;
  }

  async renameBacktest(id, name) {
    const data = this.getData();
    const target = data.backtests.find((b) => b.id === id);
    if (!target) throw new Error(`Backtest with id "${id}" does not exist.`);
    target.name = name;
    await this.saveData(data);
    return target;
  }

  async deleteBacktest(id) {
    const data = this.getData();
    if (data.backtests.length <= 1) {
      throw new Error('Cannot delete the only remaining backtest.');
    }
    const index = data.backtests.findIndex((b) => b.id === id);
    if (index === -1) throw new Error(`Backtest with id "${id}" does not exist.`);
    data.backtests.splice(index, 1);
    if (data.activeId === id) {
      data.activeId = data.backtests[0].id;
    }
    await this.saveData(data);
    return data;
  }

  async create(input) {
    const data = this.getData();
    const pairId = input.pairId || input.id || this.idFactory();

    const movedBt = data.backtests.find((b) => b.id === MOVED_TP_BACKTEST_ID) || data.backtests[0];
    const notMovedBt = data.backtests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID) || data.backtests[1] || data.backtests[0];

    const movedTrade = normalizeTrade({
      ...input,
      pairId,
      id: pairId,
      exitDate: input.exitDate,
      exitTime: input.exitTime,
      outcome: input.outcome,
      riskReward: input.riskReward
    });

    const isMovedYes = input.movedTakeProfit === 'yes';
    const notMovedTrade = normalizeTrade({
      ...input,
      pairId,
      id: pairId,
      exitDate: (isMovedYes && input.initialExitTime) ? (input.initialExitDate || input.exitDate) : input.exitDate,
      exitTime: (isMovedYes && input.initialExitTime) ? input.initialExitTime : input.exitTime,
      outcome: (isMovedYes && input.initialExitTime) ? input.initialOutcome : input.outcome,
      riskReward: (isMovedYes && input.initialExitTime) ? input.initialRiskReward : input.riskReward
    });

    movedBt.trades.push(movedTrade);
    if (notMovedBt && notMovedBt !== movedBt) {
      notMovedBt.trades.push(notMovedTrade);
    }

    await this.saveData(data);
    const activeBt = data.backtests.find((b) => b.id === data.activeId) || movedBt;
    const activeTrade = activeBt.trades.find((t) => t.pairId === pairId || t.id === pairId) || movedTrade;
    return { source: this.mode, trade: activeTrade };
  }

  async update(id, input) {
    const data = this.getData();
    const pairId = id;

    const isMovedYes = input.movedTakeProfit === 'yes';

    data.backtests.forEach((b) => {
      const idx = b.trades.findIndex((item) => item.pairId === pairId || item.id === pairId);
      if (idx !== -1) {
        if (b.id === NOT_MOVED_TP_BACKTEST_ID) {
          b.trades[idx] = normalizeTrade({
            ...input,
            pairId,
            id: pairId,
            exitDate: (isMovedYes && input.initialExitTime) ? (input.initialExitDate || input.exitDate) : input.exitDate,
            exitTime: (isMovedYes && input.initialExitTime) ? input.initialExitTime : input.exitTime,
            outcome: (isMovedYes && input.initialExitTime) ? input.initialOutcome : input.outcome,
            riskReward: (isMovedYes && input.initialExitTime) ? input.initialRiskReward : input.riskReward
          });
        } else {
          b.trades[idx] = normalizeTrade({
            ...input,
            pairId,
            id: pairId,
            exitDate: input.exitDate,
            exitTime: input.exitTime,
            outcome: input.outcome,
            riskReward: input.riskReward
          });
        }
      }
    });

    await this.saveData(data);
    const activeBt = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];
    const activeTrade = activeBt.trades.find((t) => t.pairId === pairId || t.id === pairId);
    return { source: this.mode, trade: activeTrade };
  }

  async remove(id) {
    const data = this.getData();
    const pairId = id;

    data.backtests.forEach((b) => {
      b.trades = b.trades.filter((item) => item.pairId !== pairId && item.id !== pairId);
    });

    await this.saveData(data);
    return { source: this.mode };
  }
}
