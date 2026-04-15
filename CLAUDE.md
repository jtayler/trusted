# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A reference implementation demonstrating how to integrate the TruAnon trust layer API into a Node.js web application. It shows how any platform can add portable, privacy-controlled identity trust badges to user profiles.

Live demo: https://devhauz.truanon.com

## Commands

```bash
npm start          # Start the Express server on port 3000 (runs app.js)

# Firebase (from functions/ directory)
npm run serve      # Start Firebase emulator locally
npm run deploy     # Deploy to Firebase hosting + functions
```

There are no tests configured (`npm test` returns an error).

## Architecture

### Entry Points

- **`app.js`** — The real application. All active routes, middleware, database logic, and TruAnon integration live here (~700 lines). This is the file to read first.
- `index.js` — Minimal stub, mostly unused.
- `functions/index.js` — Wraps `app.js` as a Firebase Cloud Function for serverless deployment.
- `routes/` and `models/` — Legacy stubs, not actively used.

### Data Layer

SQLite via `sqlite3` package, database file at `users.db`. No ORM — raw SQL queries in `app.js`. The `mongoose` dependency in `package.json` and `models/User.js` are unused.

Key user columns: `switch_state` (TruAnon linked on/off), `authorRank` (cached rank string), `authorPhoto` (cached avatar URL), `show_personal`, `show_social`, `make_private` (privacy tier switches).

### TruAnon API Integration

Two API endpoints (base URL in `API_ROUTE` env var):
- `GET /api/get_profile?id=[username]&service=[service]` — Used on every profile view; returns rank, score, verification status
- `GET /api/get_token?id=[username]&service=[service]` — One-time onboarding; returns a short-lived token for the verification iframe

Key implementation details:
- Profile pages render **immediately** from cached DB data; TruAnon data fetches async client-side via `GET /users/:username/truanon`
- `fetchWithTimeout()` wraps all TruAnon calls to prevent hangs (5–30s timeouts)
- Rank values: `Genuine`, `Reliable`, `Credible`, `Cautioned`, `Dangerous` — mapped to Bootstrap badge colors via `getPhotoBorderColor(rank)`
- Results are cached back to SQLite after each successful fetch

### Privacy Model (Three-Tier)

1. **`switch_state`** — Master toggle: link/unlink TruAnon identity entirely
2. **`show_social`** — Show/hide social platform links (GitHub, LinkedIn, etc.)
3. **`make_private`** — Hide URLs but still surface the data (e.g., show "has GitHub" without the link)

`getUserDisplayData(user)` centralizes display logic based on these flags.

### Third-Party Integrations

GitHub and Bitbucket APIs are called from profile routes to display verified accounts, repo counts, languages, and account age. Tokens come from `GITHUB_TOKEN` and `BITBUCKET_TOKEN` env vars.

## Environment Variables

```
TRUANON_API_KEY    # API key for TruAnon requests
SERVICE_NAME       # Your service identifier (e.g. "trusted")
API_ROUTE          # TruAnon API base URL
GITHUB_TOKEN       # GitHub personal access token
BITBUCKET_TOKEN    # Bitbucket token
```

## AI Context

**Read `AI_CONTEXT.md` before touching any TruAnon-related code.** It covers:
- What to ignore in this demo app (GitHub/Bitbucket integrations are demo noise, not TruAnon)
- Platform archetypes: dating (privacy-first defaults), public social, pseudonymous, marketplace
- Native mobile patterns (iOS/Swift, React Native — verification uses `SFSafariViewController`, not an iframe; all API calls are still server-side)
- Privacy switch defaults per platform type (e.g., Private Mode should default ON for dating)
- Common implementation mistakes (calling `get_token` on every load, showing only a checkmark, exposing private key client-side)

The key mental model: this is not a one-time verification gate — it's an always-on trust dimension. `get_profile` runs on every profile view. The badge shows rank + score + color together, never just a checkmark.
