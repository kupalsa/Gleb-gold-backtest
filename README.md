# Gold Backtest Ledger

A local-first, static operating tool for recording XAU/gold backtest trades. It is intentionally an app surface (trade form, calendar, and day ledger), not a marketing site. No sample or personal trade records are included.

## Run locally

Requirements: Node.js 22+ (used only for tests) and any static HTTP server.

```bash
cd C:/Users/nikek/Documents/Gleb-gold-backtest
npm test
npx serve .
```

Open the local URL emitted by `serve`. A server is needed because browser ES modules cannot be reliably loaded from `file://` URLs.

## Data behavior

The frontend attempts `GET /api/trades` on startup. When a compatible API is available it sends:

- `GET /api/trades` — list trades
- `POST /api/trades` — create
- `PUT /api/trades/:id` — update
- `DELETE /api/trades/:id` — delete

If that API cannot be reached or returns a non-2xx response, the interface visibly changes to **LOCAL-ONLY FALLBACK** and persists only in that browser's `localStorage`. This fallback is not shared or synced. It has no preloaded trades.

## Future shared deployment architecture

Deploy the static files to a public static host. Put a Worker/server API at `/api/trades` (via a reverse proxy, route, or same-origin worker). The Worker holds server-side credentials and reads/writes a separate **private** trade-data repository or database. Do not place GitHub tokens, repository credentials, or user records in this frontend, static host configuration, or browser code. An anonymous public frontend means API protection and rate limits must be designed deliberately before sharing it.

Expected JSON trade fields: `id`, `date` (`YYYY-MM-DD`), `entryTime` (`HH:MM`), `direction` (`long`/`short`), `stopLossPoints` (number), `riskReward` (number), and optional `notes`.

## Tests

`npm test` runs Node's built-in test runner. The suite verifies validation/normalization, date grouping, calendar construction/month shifts, API preference, local-only fallback, and fallback update/delete behavior.
