import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';

const env = {
  FRONTEND_ORIGIN: 'https://journal.example',
  GITHUB_TOKEN: 'test-token',
};

function githubFetchWith(trades) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    sha: 'existing-sha',
    content: btoa(JSON.stringify(trades)),
    encoding: 'base64',
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('GET /api/trades', () => {
  it('returns trades from the private GitHub data file to an allowed origin', async () => {
    const fetchMock = githubFetchWith([]);
    const response = await worker.fetch(
      new Request('https://api.example/api/trades', {
        headers: { Origin: env.FRONTEND_ORIGIN },
      }),
      env,
      { waitUntil() {}, passThroughOnException() {} },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.FRONTEND_ORIGIN);
  });

  it('rejects a browser request from an origin other than FRONTEND_ORIGIN', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(new Request('https://api.example/api/trades', {
      headers: { Origin: 'https://untrusted.example' },
    }), env, {});

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Origin not allowed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/trades', () => {
  it('adds a record with all required fields and persists the complete journal', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sha: 'current-sha', content: btoa('[]'), encoding: 'base64',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const trade = {
      id: 'trade-1', dateTime: '2026-09-13T10:00:00Z', entryTime: '10:00',
      stopLossPoints: 15, riskReward: 2,
    };

    const response = await worker.fetch(new Request('https://api.example/api/trades', {
      method: 'POST', headers: { Origin: env.FRONTEND_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    }), env, {});

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(trade);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.github.com/repos/kupalsa/Gleb-gold-backtest-data/contents/data/trades.json',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      sha: 'current-sha', message: 'Add trade trade-1',
      content: btoa(JSON.stringify([trade], null, 2)),
    });
  });

  it('rejects a write missing any required trade field without contacting GitHub', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(new Request('https://api.example/api/trades', {
      method: 'POST', headers: { Origin: env.FRONTEND_ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'trade-1', dateTime: '2026-09-13', entryTime: '10:00', stopLossPoints: 15 }),
    }), env, {});

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PUT /api/trades', () => {
  it('replaces the matching record by id', async () => {
    const original = { id: 'trade-1', dateTime: 'old', entryTime: 'old', stopLossPoints: 1, riskReward: 1 };
    const replacement = { ...original, riskReward: 3 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'current-sha', content: btoa(JSON.stringify([original])) }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://api.example/api/trades', {
      method: 'PUT', headers: { Origin: env.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(replacement),
    }), env, {});

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(replacement);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toBe(btoa(JSON.stringify([replacement], null, 2)));
  });
});

describe('DELETE /api/trades', () => {
  it('removes the record identified by an id from the request body', async () => {
    const trade = { id: 'trade-1', dateTime: 'old', entryTime: 'old', stopLossPoints: 1, riskReward: 1 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: 'current-sha', content: btoa(JSON.stringify([trade])) }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://api.example/api/trades', {
      method: 'DELETE', headers: { Origin: env.FRONTEND_ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: trade.id }),
    }), env, {});

    expect(response.status).toBe(204);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toBe(btoa(JSON.stringify([], null, 2)));
  });
});
