const REPOSITORY = 'kupalsa/Gleb-gold-backtest-data';
const FILE_PATH = 'data/trades.json';
const CONTENTS_URL = `https://api.github.com/repos/${REPOSITORY}/contents/${FILE_PATH}`;
const REQUIRED_FIELDS = ['id', 'dateTime', 'entryTime', 'stopLossPoints', 'riskReward'];

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== env.FRONTEND_ORIGIN) return null;
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': env.FRONTEND_ORIGIN, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function response(body, status, headers) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function isValidTrade(trade) {
  return trade && typeof trade === 'object' && REQUIRED_FIELDS.every((field) => trade[field] !== undefined && trade[field] !== null);
}

async function readTrades(env) {
  const githubResponse = await fetch(CONTENTS_URL, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!githubResponse.ok) throw new Error('GitHub read failed');
  const file = await githubResponse.json();
  return { trades: JSON.parse(atob(file.content.replace(/\n/g, ''))), sha: file.sha };
}

async function writeTrades(trades, sha, message, env) {
  const githubResponse = await fetch(CONTENTS_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: btoa(JSON.stringify(trades, null, 2)), sha }),
  });
  if (!githubResponse.ok) throw new Error('GitHub write failed');
}

async function jsonBody(request) {
  try { return await request.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);
    if (!headers) return response({ error: 'Origin not allowed' }, 403, {});
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (new URL(request.url).pathname !== '/api/trades') return response({ error: 'Not found' }, 404, headers);

    try {
      if (request.method === 'GET') return response((await readTrades(env)).trades, 200, headers);
      const trade = await jsonBody(request);
      if (request.method === 'DELETE') {
        if (!trade || trade.id === undefined || trade.id === null) return response({ error: 'Required field: id' }, 400, headers);
        const { trades, sha } = await readTrades(env);
        if (!trades.some((existing) => existing.id === trade.id)) return response({ error: 'Trade not found' }, 404, headers);
        await writeTrades(trades.filter((existing) => existing.id !== trade.id), sha, `Delete trade ${trade.id}`, env);
        return response(null, 204, headers);
      }
      if (!isValidTrade(trade)) return response({ error: `Required fields: ${REQUIRED_FIELDS.join(', ')}` }, 400, headers);
      const { trades, sha } = await readTrades(env);
      if (request.method === 'POST') {
        await writeTrades([...trades, trade], sha, `Add trade ${trade.id}`, env);
        return response(trade, 201, headers);
      }
      if (request.method === 'PUT') {
        const index = trades.findIndex((existing) => existing.id === trade.id);
        if (index === -1) return response({ error: 'Trade not found' }, 404, headers);
        const updated = [...trades];
        updated[index] = trade;
        await writeTrades(updated, sha, `Update trade ${trade.id}`, env);
        return response(trade, 200, headers);
      }
      return response({ error: 'Not found' }, 404, headers);
    } catch {
      return response({ error: 'Unable to access trades' }, 502, headers);
    }
  },
};
