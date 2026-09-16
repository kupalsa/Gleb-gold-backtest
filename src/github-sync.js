const KEY = 'gleb-gold-backtest.github-connection.v1';
const PATH = 'data/trades.json';
const RETRY_DELAYS_MS = [300, 700];
const TRANSIENT_SAVE_STATUSES = new Set([500, 502, 503, 504]);
const retryDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function githubFailure(response, action) {
  let detail = '';
  try { detail = (await response.json()).message || ''; } catch { /* GitHub may return an empty/non-JSON failure body. */ }
  return new Error(`GitHub ${action} failed (${response.status || 'network'}): ${detail || 'Check the repository, PAT permissions, and connection.'}`);
}

export class GitHubTradeSync {
  constructor({ fetcher = (...args) => (globalThis.window || globalThis).fetch(...args), session = sessionStorage, local = localStorage } = {}) {
    this.fetcher = fetcher;
    this.session = session;
    this.local = local;
    this.connection = null;
    this.restore();
  }

  restore() {
    try {
      const saved = this.local.getItem(KEY) || this.session.getItem(KEY);
      if (saved) this.connection = JSON.parse(saved);
    } catch {
      this.connection = null;
    }
  }

  connect({ owner, repo, token, remember }) {
    if (!owner || !repo || !token) throw new Error('GitHub user, private repository, and PAT are required.');
    this.connection = { owner, repo, token };
    (remember ? this.local : this.session).setItem(KEY, JSON.stringify(this.connection));
    if (!remember) this.local.removeItem(KEY);
  }

  url() {
    const { owner, repo } = this.connection;
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${PATH}`;
  }

  async load() {
    const response = await this.fetcher(this.url(), {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.connection.token}` }
    });
    if (!response.ok) throw await githubFailure(response, 'load');
    const file = await response.json();
    return { trades: JSON.parse(atob(file.content.replace(/\n/g, ''))), sha: file.sha };
  }

  async save(trades, sha) {
    const options = {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.connection.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Update trades', content: btoa(JSON.stringify(trades, null, 2)), sha })
    };

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      let response;
      try {
        response = await this.fetcher(this.url(), options);
      } catch {
        if (attempt < RETRY_DELAYS_MS.length) {
          await retryDelay(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }

      if (response.ok) {
        const result = await response.json();
        return { ...result, sha: result.content?.sha ?? result.sha };
      }
      if (response.status === 409 || response.status === 422) {
        throw new Error('GitHub data changed on GitHub. Click Sync trades to load the latest data before retrying; your change was not saved.');
      }
      if (!TRANSIENT_SAVE_STATUSES.has(response.status)) throw await githubFailure(response, 'save');
      if (attempt < RETRY_DELAYS_MS.length) await retryDelay(RETRY_DELAYS_MS[attempt]);
    }

    throw new Error('GitHub save could not be completed because of a temporary GitHub service or network failure. Please retry your save.');
  }
}
