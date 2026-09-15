import { normalizeTrade } from './trades.js';
import {
  normalizeBacktestsData,
  isVol2Suite,
  getVol2TargetSuiteId,
  VOL2_BACKTEST_ID,
  VOL2_NY_BACKTEST_ID,
  VOL1_BACKTEST_ID,
  MOVED_TP_BACKTEST_ID,
  NOT_MOVED_TP_BACKTEST_ID
} from './backtests.js';

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

  async list({ forceFetch = false } = {}) {
    let data;
    if (this.hasGitHubConnection()) {
      if (forceFetch || !this.githubData) {
        const { trades: raw, sha } = await this.githubSync.load();
        data = normalizeBacktestsData(raw, this.idFactory);
        this.githubData = data;
        this.githubSha = sha;
      } else {
        data = this.githubData;
      }
      this.mode = 'github';
    } else {
      data = this.localData();
      this.mode = 'local';
    }

    const activeBacktest = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];
    let activeTrades = [];
    let activeTabId = MOVED_TP_BACKTEST_ID;

    if (activeBacktest) {
      if (isVol2Suite(activeBacktest.id)) {
        activeTabId = activeBacktest.activeTabId || MOVED_TP_BACKTEST_ID;
        const subBt = (activeBacktest.subBacktests || []).find((s) => s.id === activeTabId) || activeBacktest.subBacktests?.[0];
        activeTrades = subBt ? subBt.trades : [];
      } else {
        activeTrades = activeBacktest.trades || [];
      }
    }

    return {
      source: this.mode,
      trades: activeTrades,
      backtests: data.backtests,
      activeId: data.activeId,
      activeTabId
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
      if (!this.githubSha) await this.list({ forceFetch: true });
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
    if (id === MOVED_TP_BACKTEST_ID || id === NOT_MOVED_TP_BACKTEST_ID) {
      let activeBt = data.backtests.find((b) => b.id === data.activeId);
      if (!activeBt || !isVol2Suite(activeBt.id)) {
        data.activeId = VOL2_BACKTEST_ID;
        activeBt = data.backtests.find((b) => b.id === VOL2_BACKTEST_ID);
      }
      if (activeBt) activeBt.activeTabId = id;
      this.saveLocal(data);
      if (this.githubData) this.githubData = data;
      return data;
    }

    const exists = data.backtests.some((b) => b.id === id);
    if (!exists) throw new Error(`Backtest with id "${id}" does not exist.`);
    data.activeId = id;
    this.saveLocal(data);
    if (this.githubData) this.githubData = data;
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
    const activeBt = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];

    if (isVol2Suite(activeBt.id)) {
      const targetSuiteId = getVol2TargetSuiteId(input.entryTime);
      const targetBt = data.backtests.find((b) => b.id === targetSuiteId) || activeBt;

      const existingTrades = (targetBt.subBacktests || []).flatMap((s) => s.trades || []);

      const candidate = normalizeTrade(input);

      const isDuplicate = existingTrades.some((t) => {
        const norm = normalizeTrade(t);
        return (
          norm.date === candidate.date &&
          norm.entryTime === candidate.entryTime &&
          norm.direction === candidate.direction &&
          norm.stopLossPoints === candidate.stopLossPoints &&
          norm.notes === candidate.notes &&
          norm.exitTime === candidate.exitTime &&
          norm.outcome === candidate.outcome &&
          norm.riskReward === candidate.riskReward
        );
      });

      if (isDuplicate) {
        throw new Error('Duplicate trade detected. This trade has already been saved.');
      }

      const pairId = input.pairId || input.id || this.idFactory();
      const movedBt = targetBt.subBacktests.find((b) => b.id === MOVED_TP_BACKTEST_ID) || targetBt.subBacktests[0];
      const notMovedBt = targetBt.subBacktests.find((b) => b.id === NOT_MOVED_TP_BACKTEST_ID) || targetBt.subBacktests[1];

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

      data.activeId = targetSuiteId;

      await this.saveData(data);
      const activeSubTabId = targetBt.activeTabId || MOVED_TP_BACKTEST_ID;
      const activeTrade = activeSubTabId === NOT_MOVED_TP_BACKTEST_ID ? notMovedTrade : movedTrade;
      return { source: this.mode, trade: activeTrade };
    } else {
      const existingTrades = activeBt.trades || [];
      const candidate = normalizeTrade(input);

      const isDuplicate = existingTrades.some((t) => {
        const norm = normalizeTrade(t);
        return (
          norm.date === candidate.date &&
          norm.entryTime === candidate.entryTime &&
          norm.direction === candidate.direction &&
          norm.stopLossPoints === candidate.stopLossPoints &&
          norm.notes === candidate.notes &&
          norm.exitTime === candidate.exitTime &&
          norm.outcome === candidate.outcome &&
          norm.riskReward === candidate.riskReward
        );
      });

      if (isDuplicate) {
        throw new Error('Duplicate trade detected. This trade has already been saved.');
      }

      const id = input.id || this.idFactory();
      const trade = normalizeTrade({ ...input, id });
      if (!Array.isArray(activeBt.trades)) activeBt.trades = [];
      activeBt.trades.push(trade);

      await this.saveData(data);
      return { source: this.mode, trade };
    }
  }

  async update(id, input) {
    const data = this.getData();
    const activeBt = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];

    if (isVol2Suite(activeBt.id)) {
      const pairId = id;
      const isMovedYes = input.movedTakeProfit === 'yes';

      activeBt.subBacktests.forEach((b) => {
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
      const activeSubTabId = activeBt.activeTabId || MOVED_TP_BACKTEST_ID;
      const activeSubBt = activeBt.subBacktests.find((s) => s.id === activeSubTabId) || activeBt.subBacktests[0];
      const activeTrade = activeSubBt.trades.find((t) => t.pairId === pairId || t.id === pairId);
      return { source: this.mode, trade: activeTrade };
    } else {
      const idx = activeBt.trades.findIndex((t) => t.id === id);
      if (idx !== -1) {
        activeBt.trades[idx] = normalizeTrade({ ...input, id });
      }
      await this.saveData(data);
      return { source: this.mode, trade: activeBt.trades[idx] };
    }
  }

  async remove(id) {
    const data = this.getData();
    const activeBt = data.backtests.find((b) => b.id === data.activeId) || data.backtests[0];

    if (isVol2Suite(activeBt.id)) {
      activeBt.subBacktests.forEach((b) => {
        b.trades = b.trades.filter((item) => item.pairId !== id && item.id !== id);
      });
    } else {
      activeBt.trades = activeBt.trades.filter((item) => item.id !== id);
    }

    await this.saveData(data);
    return { source: this.mode };
  }
}
