# Gleb Gold Backtest API

A Cloudflare Worker API for a shared, anonymous trade journal. It stores the journal in the private GitHub repository [`kupalsa/Gleb-gold-backtest-data`](https://github.com/kupalsa/Gleb-gold-backtest-data), at `data/trades.json`.

## Security model — intentionally anonymous

**There is no login or user authorization by explicit product decision. Anyone who has access to the deployed API URL (or an allowed frontend that calls it) can read, add, replace, or delete trades.** Do not put confidential information in the journal. CORS limits browser origins only; it is not authentication.

The Worker reads/writes GitHub only server-side. It uses the `GITHUB_TOKEN` Worker secret and the token is never embedded in source, browser responses, or `wrangler.toml`.

## Required configuration

Create a GitHub fine-grained personal access token with **Contents: Read and write** permission scoped only to `kupalsa/Gleb-gold-backtest-data`.

Set both Worker secrets interactively (do not paste either into source control):

```bash
cd C:/Users/nikek/Documents/Gleb-gold-backtest-api
npm install
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put FRONTEND_ORIGIN
npx wrangler deploy
```

For `FRONTEND_ORIGIN`, enter one exact origin such as `https://journal.example` (no trailing slash). Browser requests with another `Origin` receive `403`; CORS preflight is supported. Requests without an `Origin` header are allowed for non-browser/server-to-server callers.

> Before deploying, create `data/trades.json` in the private data repository containing an empty JSON array: `[]`. This project deliberately contains no sample trades and does not create remote repositories.

## API

All routes are `/api/trades`. Write requests must use `Content-Type: application/json`.

| Method | Body | Result |
| --- | --- | --- |
| `GET` | none | `200` and the trades array |
| `POST` | complete trade object | `201` and the added object |
| `PUT` | complete trade object | `200` and the replacement object, matched by `id` |
| `DELETE` | `{ "id": "..." }` | `204`, removes the matching record |

For `POST` and `PUT`, only these fields are validated as required (present and non-null): `id`, `dateTime`, `entryTime`, `stopLossPoints`, and `riskReward`. No type, format, or optional-field validation is imposed. `DELETE` requires only `id`.

GitHub file updates use the current file SHA, so GitHub rejects a conflicting concurrent write rather than silently overwriting it; the API returns `502` for an upstream GitHub read/write failure.

## Development and tests

```bash
npm test
```

The Vitest suite stubs GitHub HTTP calls and covers GET, POST, PUT, and DELETE journal behavior. It never calls the live GitHub API and requires no token to test.
