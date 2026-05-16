# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A reference implementation demonstrating how to integrate the TruAnon trust layer API into a Node.js web application. It shows how any platform can weave portable, privacy-controlled identity trust into profiles, listings, posts, or any piece of content.

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

Key user columns: `switch_state` (TruAnon linked on/off), `is_anchored` (DB fact — gates all TruAnon API calls; set once when `get_profile` first returns a real rank), `authorRank` (cached rank string), `authorRankScore` (cached score), `authorPhoto` (cached avatar URL), `show_personal`, `show_contact`, `show_social`, `make_private` (privacy tier switches).

### TruAnon API Integration

Two API endpoints (base URL in `API_ROUTE` env var):
- `GET /api/get_profile?id=[username]&service=[service]` — Called on every profile view; returns rank, score, and all granted dataConfigurations
- `GET /api/get_token?id=[username]&service=[service]` — One-time anchor flow only; returns a short-lived token for the verification iframe

Key implementation details:
- Profile pages render **immediately** from cached DB data; TruAnon data fetches async client-side via `GET /users/:username/truanon`
- `fetchWithTimeout()` wraps all TruAnon calls to prevent hangs (5–30s timeouts)
- Rank values: `Genuine`, `Reliable`, `Credible`, `Cautioned`, `Dangerous` — mapped to colors via `getPhotoBorderColor(rank)`
- `authorRank` and `authorRankScore` are cached back to SQLite after each successful fetch
- List/search views render rank from the DB cache — no per-row API calls

### Privacy Model

1. **`switch_state`** — Master toggle: off = member shows as `Unknown` everywhere
2. **`show_personal`** — Show/hide `dataPointKind: "personal"` items (location, age, gender, bio)
3. **`show_contact`** — Show/hide `dataPointKind: "contact"` and `"primary"` items (name, confirmed phone/email)
4. **`show_social`** — Show/hide `dataPointKind: "social"` links (GitHub, LinkedIn, etc.)
5. **`make_private`** — Hide URLs but still surface data labels (e.g., show "has GitHub" without the link)

`getUserDisplayData(user)` centralizes display logic based on these flags.

### Third-Party Integrations

GitHub and Bitbucket APIs are called from profile routes to display verified accounts, repo counts, languages, and account age. Tokens come from `GITHUB_TOKEN` and `BITBUCKET_TOKEN` env vars. **These are demo noise — not part of TruAnon. Do not replicate this pattern when helping developers integrate TruAnon into their own platforms.**

## Environment Variables

```
TRUANON_API_KEY    # API key for TruAnon requests
SERVICE_NAME       # Your service identifier (e.g. "trusted")
API_ROUTE          # TruAnon API base URL
GITHUB_TOKEN       # GitHub personal access token (demo only)
BITBUCKET_TOKEN    # Bitbucket token (demo only)
```

## AI Context

**Read `AI_CONTEXT.md` before touching any TruAnon-related code.** It covers:
- The Anchor / Grant / Revoke mental model (use this language)
- What to ignore in this demo app (GitHub/Bitbucket integrations are demo noise, not TruAnon)
- The real `dataConfigurations` JSON shape with `dataPointType` and `dataPointKind` fields
- Filtering `dataConfigurations` by `dataPointKind` (`personal`, `social`, `contact`, `primary`)
- Platform archetypes and privacy switch defaults per platform type
- Native mobile patterns (iOS/Swift — anchor flow uses `SFSafariViewController`, not a popup)
- Common implementation mistakes

**Key mental models for AI assistants working in this repo:**

- This is not a one-time verification gate. `get_profile` runs on every profile view.
- Rank travels with *content*, not just profiles. A listing, post, or comment can carry rank with no profile page.
- Rank is a **reflection**, not a calculation. It mirrors the depth, consistency, and transparency of a member's existing public presence. Do not describe rank as something members earn, achieve, or are assigned. The member didn't gain anything they didn't already have — the rank made it visible.
- Unknown is the **baseline**, not a rank. It covers two indistinguishable states: never anchored, and anchored-but-revoked. Both look identical from outside — by design. Avoiding is as clear as having it.
- `is_anchored` is stored on the user record. Gate **all** TruAnon API calls on it — if false, skip the call entirely. You already know the answer.
- Cache `authorRank`, `authorRankScore`, and `authorPhoto` in the DB. List views render from cache — no API calls per row.
- What you cache is derived trust data, not PII. A DB breach exposes rank/score — nothing that identifies or contacts anyone. A subpoena cannot reach what was never stored.
- The anchor is permanent and asymmetric. A banned member cannot re-anchor under a new account. For honest members it is a gesture of good faith; for fraudsters it is a binding liability — they self-select out.
- Rank is a gate predicate, not just a display value. Check it before allowing posts, messages, bookings. Credible is statistically equivalent to ID verification.
- For pseudonymous platforms: strip `social` and `contact` kind entries server-side before the response leaves your server. Never rely on client-side.
- `primary` kind entries (`phone`, `email`) have descriptions as `displayValue`, not raw values. "Privately Confirmed Phone" means confirmed — not exposed.
