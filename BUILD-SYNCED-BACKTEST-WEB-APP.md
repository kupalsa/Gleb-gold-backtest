# Technical Blueprint: Synced Trading Backtest Web App

> **Purpose:** Give this file to ChatGPT/Codex when starting a new web app with the same working model: a public static frontend, private cross-device JSON data, direct GitHub Contents API sync, local fallback, mobile-friendly form, calendar, analytics, and multiple backtests.
>
> **Do not copy real credentials, PATs, user records, or private repository data into a new project.** Replace every `OWNER`, `FRONTEND_REPO`, and `PRIVATE_DATA_REPO` placeholder.

---

## 1. Product and architecture decisions

Build this as a **static, browser-first app**:

- **Public frontend repository:** HTML, CSS, JavaScript, tests, GitHub Pages deployment.
- **Private data repository:** JSON records only.
- **No server, Cloudflare Worker, database, or secret in frontend code.**
- User enters a **fine-grained GitHub PAT** in the Data Connection form. The browser calls GitHub's Contents API directly.
- Store the PAT in `sessionStorage` by default. Offer an explicit `Remember on this device` option to use `localStorage`.
- If the user has not connected GitHub, app still works as a **local-only fallback** in `localStorage`.

### Security trade-off

Direct GitHub sync is simple and inexpensive, but a browser-held PAT is not as strong as a server-side OAuth/API boundary. Use this model only when the user explicitly accepts it and the token is:

- fine-grained;
- restricted to **one private data repository**;
- granted only **Contents: Read and write**;
- never written into source code, test fixtures, commits, screenshots, terminal output, or chat messages.

The public frontend repository must never contain data exports, a PAT, `.env`, or the private data file.

---

## 2. GitHub setup

Create two repositories.

| Repository | Visibility | Contains |
|---|---:|---|
| `OWNER/FRONTEND_REPO` | Public | frontend code only; GitHub Pages |
| `OWNER/PRIVATE_DATA_REPO` | Private | `data/trades.json` or equivalent user data |

### Fine-grained PAT requirements

Create a fine-grained personal access token:

- Resource owner: the GitHub account/org that owns the private data repo.
- Repository access: **Only select repositories** → `PRIVATE_DATA_REPO`.
- Permissions: **Contents: Read and write**.
- Set an expiration period appropriate for the user.

Never ask the user to send the token in chat. They enter it only in the app's password field.

### Private data file

Start with a JSON file in the private repo:

```text
PRIVATE_DATA_REPO/
└── data/
    └── trades.json
```

The app should be able to migrate older structures safely, but new applications should start with a versioned object rather than a bare array:

```json
{
  "schemaVersion": 1,
  "activeId": "main",
  "backtests": [
    {
      "id": "main",
      "name": "Main Backtest",
      "trades": []
    }
  ]
}
```

For a paired Take Profit comparison suite, use nested sub-backtests:

```json
{
  "schemaVersion": 1,
  "activeId": "asian-vol2",
  "backtests": [
    {
      "id": "asian-vol2",
      "name": "Gold Backtest Vol. 2 (Asian)",
      "activeTabId": "moved-tp",
      "subBacktests": [
        { "id": "moved-tp", "name": "Moved TP", "trades": [] },
        { "id": "not-moved-tp", "name": "Not Moved TP", "trades": [] }
      ]
    },
    {
      "id": "asian-vol1",
      "name": "Gold Backtest Vol. 1 (Asian)",
      "trades": []
    }
  ]
}
```

---

## 3. Local project structure

Use plain ES modules and browser APIs first. Do not add React/Vite/a backend unless the user specifically needs them.

```text
FRONTEND_REPO/
├── index.html                     # semantic shell and form controls
├── styles.css                     # complete visual system and responsive rules
├── package.json                   # `type: module`, Node test command
├── .gitignore
├── README.md
├── BUILD-SYNCED-BACKTEST-WEB-APP.md
├── src/
│   ├── app.js                     # DOM bootstrap, state, rendering, events
│   ├── trades.js                  # validation, normalization, duration, statistics
│   ├── calendar.js                # month grid and month navigation helpers
│   ├── trade-store.js             # local/GitHub persistence, mutations, routing
│   ├── github-sync.js             # GitHub Contents API GET/PUT + retry behavior
│   ├── data-connection.js         # Data Connection modal, PAT storage behavior
│   ├── backtests.js               # suite schema, migration, IDs, routing rules
│   ├── backtest-ui.js             # backtest selector/tabs and control wiring
│   ├── take-profit-move.js        # conditional TP scenario form behavior
│   ├── trade-form-date-prefill.js # safe native date-picker prefill logic
│   └── feedback.js                # visible success/error/status messages
├── test/
│   ├── trades.test.js
│   ├── trade-store.test.js
│   ├── github-sync.test.js
│   ├── github-store-integration.test.js
│   ├── calendar.test.js
│   ├── backtests.test.js
│   ├── backtest-ui.test.js
│   └── feature-specific.test.js
└── worker/                         # OPTIONAL: only if user explicitly approves backend
```

### Minimal `package.json`

```json
{
  "name": "FRONTEND_REPO",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

This keeps the app dependency-light. Node's built-in test runner is enough for deterministic data and integration tests.

---

## 4. `.gitignore` requirements

At minimum:

```gitignore
.env
.env.*
node_modules/
coverage/
dist/
*.log
.DS_Store
Thumbs.db
private-data/
exports/
```

Do not put `data/trades.json` in the public frontend repository.

---

## 5. Core data model

Use ISO values because they sort reliably:

- Date: `YYYY-MM-DD`
- Time: `HH:MM` in 24-hour time
- IDs: `crypto.randomUUID()`

Example trade:

```json
{
  "id": "uuid",
  "pairId": "uuid-shared-across-parallel-scenarios",
  "date": "2025-02-11",
  "entryTime": "09:30",
  "exitDate": "2025-02-11",
  "exitTime": "10:45",
  "direction": "long",
  "outcome": "win",
  "stopLossPoints": 12.5,
  "riskReward": 2.1,
  "movedTakeProfit": "yes",
  "initialExitDate": "2025-02-11",
  "initialExitTime": "11:20",
  "initialOutcome": "win",
  "initialRiskReward": 3,
  "notes": "Optional note"
}
```

### Normalization rules

Centralize normalization in `normalizeTrade(input)`.

- Convert numeric fields to `Number`.
- Normalize direction to `long` or `short`.
- Normalize outcome to `win` or `loss`.
- Preserve optional fields only if supplied.
- Never invent dates, notes, outcomes, or results while migrating old records.
- Preserve unknown future fields only if your schema policy requires it; otherwise version data explicitly and migrate carefully.

### Validation rules

Validate before persistence:

- Entry date required and valid ISO date.
- Entry and exit time required and valid `HH:MM`.
- Exit date optional.
- Stop loss must be greater than zero.
- Risk/reward must meet product rule (in this app: `>= -1`, including `-1`, `-0.5`, and `0`).
- Outcome is `win` or `loss`.
- If `movedTakeProfit === 'yes'`, require initial-scenario exit time/outcome/R:R too.
- If an explicit exit date/time is before entry date/time, reject it.

---

## 6. GitHub Contents API sync

### API endpoint

```text
GET/PUT https://api.github.com/repos/OWNER/PRIVATE_DATA_REPO/contents/data/trades.json
```

### Load flow

1. `GET` the file with:
   - `Accept: application/vnd.github+json`
   - `Authorization: Bearer <PAT>`
2. GitHub returns base64 file content and a file `sha`.
3. Decode base64, parse JSON, normalize/migrate data.
4. Retain the returned SHA in memory for the next save.

### Save flow

1. Serialize the entire current data object.
2. Base64-encode it.
3. `PUT` the same path with:

```json
{
  "message": "Update trades",
  "content": "BASE64_JSON",
  "sha": "SHA_FROM_LATEST_GET_OR_SAVE"
}
```

4. On success, retain the new returned SHA.

### Mandatory conflict behavior

If GitHub returns `409` or `422`, do **not** overwrite. Show a clear message:

> GitHub data changed on GitHub. Click Sync trades to load the latest data before retrying; your change was not saved.

This prevents silent loss when another device has saved data.

### Temporary failure behavior

Retry only transient errors:

- network exception;
- HTTP `500`, `502`, `503`, `504`.

Use exactly three total attempts with small bounded delays such as 300 ms and 700 ms. Do **not** retry authentication, permission, not-found, validation, or conflict responses (`401`, `403`, `404`, `409`, `422`).

After all transient retries fail, show:

> GitHub save could not complete because of a temporary GitHub service or network failure. Please try saving again.

### Browser-safe fetch detail

Safari may reject an unbound `window.fetch`. Use a fetcher that retains its receiver:

```js
const fetcher = (...args) => (globalThis.window || globalThis).fetch(...args);
```

---

## 7. Local fallback and connection settings

Use distinct namespaced keys:

```js
const CONNECTION_KEY = 'app.github-connection.v1';
const LOCAL_DATA_KEY = 'app.local-data.v1';
```

### Connection settings object

```js
{ "owner": "OWNER", "repo": "PRIVATE_DATA_REPO", "token": "PAT" }
```

Rules:

- Default: store connection in `sessionStorage`.
- When the user checks **Remember on this device**, store it in `localStorage`.
- Never render a stored token back into the Data Connection modal.
- Data Connection modal may prefill owner/repository, but the token input must remain blank.
- Show visible connection status in the modal and in the app header.

### Local fallback

When no connection is configured:

- Read/write to `localStorage`.
- Clearly show `LOCAL-ONLY FALLBACK` in the UI.
- Do not claim the data syncs between devices.

---

## 8. Backtest-suite model

Do not flatten independent systems into one ambiguous array.

### Single backtest

A normal suite has:

```js
{ id, name, trades: [] }
```

### Parallel TP-move suite

A Vol. 2-like suite has:

```js
{
  id,
  name,
  activeTabId: 'moved-tp',
  subBacktests: [
    { id: 'moved-tp', name: 'Moved TP', trades: [] },
    { id: 'not-moved-tp', name: 'Not Moved TP', trades: [] }
  ]
}
```

### Paired creation behavior

For a TP-move suite:

- Shared form fields: entry date/time, direction, stop loss, notes.
- If TP was **not** moved, save identical trade records into both sub-backtests.
- If TP **was** moved:
  - `Moved TP` receives actual exit/outcome/R:R.
  - `Not Moved TP` receives initial-scenario exit/outcome/R:R.
- Both records share `pairId`.
- Edit/delete in either sub-backtest must update/delete the pair inside that same parent suite.

### Time routing example

If product rules require automatic session routing:

```text
00:00–11:59 → Asian Vol. 2 suite
12:00–23:59 → New York Vol. 2 suite
```

Perform this in the store/data layer, not merely in the UI. After saving, switch the active suite to the routed target so the user sees the saved record.

---

## 9. UI requirements

Keep the app operational rather than decorative.

### Core screens/components

1. Header
   - app name;
   - Data Connection;
   - Sync button;
   - visible connection state;
   - top-level backtest selector and controls.

2. Trade form
   - semantic `<form>`;
   - required fields clearly marked;
   - conditional form fields hidden until relevant;
   - inline success/error message near Save;
   - `Save trade` / `Update trade` state.

3. Calendar
   - month heading and Previous/Today/Next controls;
   - calendar cells show count and daily total R;
   - selecting a day shows its trades.

4. Statistics
   - total wins/losses;
   - total R;
   - long/short and win/loss splits;
   - average entry/exit time of day using circular average;
   - average duration;
   - average stop loss;
   - TP-move statistics when applicable.

5. All-trades table
   - date, entry, exit date, exit, duration, direction, outcome, stop loss, R:R.

### Mobile details

- Use `input type="date"` and `input type="time"` for native mobile controls.
- Use a normal/text-oriented numeric keyboard where the user must enter a minus sign on iOS; Safari's `inputmode="decimal"` can omit a minus key.
- Use at least 44px touch targets.
- Make table horizontally scrollable rather than destroying columns.
- Use `prefers-reduced-motion`.

### Date picker prefill behavior

Native browser date pickers open at an input's current value. For the blank/new trade form:

- Find the latest date in the **currently active backtest only**.
- Prefill Entry date and optional Exit date only when the field is blank.
- Never overwrite dates during edit mode.
- Never overwrite a date manually chosen by the user.
- If active backtest has no trades, keep date fields blank.

Do not use another backtest's latest date for this behavior unless product requirements explicitly say so.

---

## 10. Prevent duplicate saves

Use two layers of protection.

### UI layer

On submit:

1. Set `isSubmitting = true`.
2. Disable the primary button immediately.
3. Change text to `Saving...`.
4. Ignore every concurrent submit.
5. In `finally`, re-enable it and restore `Save trade` or `Update trade`.

### Store layer

Before creating, compare candidate against records in the target backtest/suite using core fields:

```text
entry date, entry time, direction, stop loss, notes,
exit time, outcome, risk/reward
```

If all match, reject it with:

> Duplicate trade detected. This trade has already been saved.

This protects against double-clicks, delayed networks, and repeated requests.

---

## 11. Analytics implementation details

### Duration

- If Exit date is present, calculate elapsed time from entry datetime to exit datetime.
- If Exit date is blank and exit time is earlier than entry time, treat it as an overnight trade (+24h).

### Circular average time

Do not average clock times with normal arithmetic. `23:55` and `00:05` should average to midnight, not noon.

Convert minutes to angles and use vector average:

```js
const angle = minutes * (2 * Math.PI / 1440);
const averageAngle = Math.atan2(sumSin, sumCos);
```

Then convert angle back to 0–1439 minutes.

### R total

```js
const totalR = trades.reduce(
  (sum, trade) => Number.isFinite(Number(trade.riskReward))
    ? sum + Number(trade.riskReward)
    : sum,
  0
);
```

Display `+2.5 R`, `0 R`, or `-1 R` consistently.

---

## 12. Testing process: mandatory strict TDD

For each feature or bug fix:

1. Write one small test showing desired behavior.
2. Run it and confirm it fails for the missing behavior (**RED**).
3. Write the minimum production code to pass (**GREEN**).
4. Run the focused test again.
5. Run the complete suite.
6. Refactor only with green tests.

Never write production code first and add tests afterward.

### Minimum test coverage

Test:

- trade validation boundaries;
- duration across midnight and explicit exit dates;
- circular time averages;
- migration from old JSON shapes;
- local storage mutations;
- GitHub load/save with SHA;
- conflict handling;
- 5xx/network retries;
- PAT session vs remember-device behavior;
- paired TP trade creation/edit/delete;
- auto-routing by entry time;
- duplicate prevention;
- date picker prefill behavior;
- controls/tabs visibility and switching.

### Commands

```bash
npm test
for f in src/*.js test/*.test.js; do node --check "$f" || exit 1; done
git diff --check
git status --short --branch
```

For a static app, also serve locally and inspect an HTTP response:

```bash
python3 -m http.server 4173
```

Use browser automation to exercise core interactions where available.

---

## 13. Development sequence for Codex/ChatGPT

Paste this task template to an agent:

```text
Build a static, mobile-first trading backtest ledger.

Architecture:
- Public GitHub Pages frontend repo: OWNER/FRONTEND_REPO.
- Separate private GitHub data repo: OWNER/PRIVATE_DATA_REPO.
- Direct browser GitHub Contents API sync using a user-entered fine-grained PAT.
- PAT never appears in source or chat. Default sessionStorage; optional localStorage remember-device checkbox.
- localStorage fallback if disconnected.

Use vanilla HTML/CSS/ES modules and Node built-in tests. No backend unless explicitly approved.

Implement strict TDD: write a failing test, run it, implement minimally, rerun it, then run all tests. Do not commit/push until tests, syntax checks, and git diff --check pass.

Required modules:
- src/app.js
- src/trades.js
- src/calendar.js
- src/trade-store.js
- src/github-sync.js
- src/data-connection.js
- src/backtests.js
- src/backtest-ui.js
- src/feedback.js

Required behavior:
- semantic mobile form;
- calendar with daily trade count and total R;
- analytics including circular mean entry/exit time;
- optional exit date with overnight fallback;
- duplicate submission protection;
- GitHub SHA conflict protection;
- transient 5xx/network save retries;
- clear visible success/error states;
- no secrets in public files.

Before modifying production code, inspect existing files. After implementation run:
  npm test
  node --check for every source/test JS file
  git diff --check
```

---

## 14. Deployment checklist

Before reporting a deployment complete:

- [ ] No secret/token/data file exists in public repo history or working tree.
- [ ] `.gitignore` includes `.env`, private exports, and local data folder.
- [ ] Full tests pass.
- [ ] Syntax checks pass.
- [ ] `git diff --check` is clean.
- [ ] Git working tree is clean after commit/push.
- [ ] GitHub Pages has built the expected commit.
- [ ] Live URL serves the current source, verified with a cache-busting query parameter:

```text
https://OWNER.github.io/FRONTEND_REPO/?v=COMMIT_SHA
```

- [ ] Private data repository was not accidentally made public.
- [ ] App can load data, save one record, and read it back using the private-data connection.

---

## 15. Common failures and correct responses

| Symptom | Likely cause | Correct response |
|---|---|---|
| Save gives 409/422 | Another device changed data; SHA stale | Tell user to Sync trades. Never overwrite blindly. |
| Save gives 500 | Temporary GitHub service error | Retry automatically 3 times; show retry message if exhausted. |
| iPhone cannot enter negative R | Decimal keyboard has no minus key | Use a keyboard/input configuration that exposes `-`; validate in JS. |
| Form appears not to save then duplicates | Slow request + repeat click | Disable button while saving + store-level duplicate detection. |
| Safari fetch receiver error | `window.fetch` lost its context | Bind/call fetch through `window`. |
| New JSON schema hides old data | Migration discards/rewrites legacy shape | Implement test-first migration; preserve legacy trades in intended suite only. |
| Empty backtest opens date picker at current month | No input value | Keep blank by policy, or prefill latest record in the active backtest only. |
| User says data vanished | Active suite/tab differs from expected, stale local cache, or failed sync | Inspect private source first, then compare suite IDs/counts before modifying any data. |

---

## 16. Non-negotiable safety rules

- Never expose a PAT.
- Never copy user trade data into the public frontend repo.
- Never silently overwrite GitHub data after a SHA conflict.
- Never delete a backtest or trade without explicit user request and a confirmation UI.
- Never report a feature as deployed until tests pass and GitHub Pages build/live URL has been checked.
- Never invent dates, records, backtest results, or successful API outputs.

This blueprint is intentionally specific enough to start a new project from zero while preserving the architecture, quality controls, mobile behavior, and data safety practices of this backtest app.
