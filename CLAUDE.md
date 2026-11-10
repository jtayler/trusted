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

Key user columns: `switch_state` (TruAnon linked on/off), `is_anchored` (DB fact — gates all TruAnon API calls; set once when `get_profile` first returns a real rank), `authorRank`, `authorRankScore`, `authorPhoto`, `ageBadge` (cache: paint instantly, no fetch — `ageBadge` is a coarse bucketed value cached under the same discipline as rank/score, not raw PII; see `AI_CONTEXT.md`'s cache rules), `show_personal`, `show_contact`, `show_social`, `make_private` (privacy tier switches). Column names here are this app's actual SQLite names — README.md/AI_CONTEXT.md use generic `rank`/`score`/`photo` when describing the shape for any stack.

### TruAnon API Integration

Two API endpoints (base URL in `API_ROUTE` env var):
- `GET /api/v2/get_profile?id=[username]&service=[service]` — Called on every profile view; returns rank, score, and all granted anchors
- `GET /api/get_token?id=[username]&service=[service]` — One-time anchor flow only; returns a short-lived token for the verification iframe

Key implementation details:
- Profile pages render **immediately** from cached DB data; TruAnon data fetches async client-side via `GET /users/:username/truanon`
- `fetchWithTimeout()` wraps all TruAnon calls to prevent hangs (5–30s timeouts)
- Rank values: `Genuine`, `Reliable`, `Credible`, `Cautioned`, `Dangerous` — mapped to colors via `getPhotoBorderColor(rank)`
- `cacheAnchorState(username, profileData)` is the **single** write-path for caching a live `get_profile` response to SQLite (`authorRank`, `authorRankScore`, `authorPhoto`, `ageBadge`, `is_anchored`). Both `/users/:username/truanon` and `/users/:username/edit-status` call it — any new route that fetches a live profile should too, rather than hand-rolling another `UPDATE`.
- List/search views render rank (and now age) from the DB cache — no per-row API calls
- `GET_PROFILE` env var selects the endpoint path (`get_profile_v2` in `.env`) — if you curl TruAnon directly while debugging and forget to append it, you'll hit the legacy v1 shape (`authorRank`, `dataConfigurations`, `displayValue`...) instead of v2 (`rank`, `anchors`, `display`...) and misdiagnose what's wrong. See `project_v2_migration` context / `AI_CONTEXT.md` for the full field-rename table.

### Gotchas worth knowing before you touch this code again

- **The `is_anchored` bootstrap trap.** `profile.ejs`'s live TruAnon fetch only fires when `is_anchored` is *already* `1` — but `is_anchored` is only ever set by that same fetch (via `cacheAnchorState`). A DB row that somehow ends up `is_anchored = 0` while TruAnon's backend already has a real rank for that username (reseeded DB, manually inserted test row, etc.) is a dead end: the profile page can never ask again on its own. Fastest diagnostic/fix: `curl localhost:3000/users/<username>/truanon` directly — that route has no such gate and will self-heal the cache immediately.
- **Disabled checkboxes vanish from the POST body.** The edit page `disabled`s the dependent privacy switches whenever "Use Identity Presence" is off. Browsers drop disabled fields from form submission entirely — they don't come through as `false`, they don't come through at all. The `/users/:username/edit` handler must not treat "missing from `req.body`" as "set to 0"; it uses a `CASE WHEN switch_state = 'on' THEN ? ELSE <existing column> END` per dependent column so saving while identity is off preserves whatever was there, instead of silently zeroing `show_personal`/`show_contact`/`show_social`/`make_private` on every save.
- **GitHub token-or-anonymous, and the real rate-limit cost.** `/users/:username/github` falls back to anonymous GitHub API access when `GITHUB_TOKEN` is unset — sending a literal `Authorization: token undefined` header is worse than no header at all, GitHub 401s on it immediately. But anonymous access is 60 requests/hour **per IP**, shared with anything else on that machine hitting `api.github.com`, and one profile load costs `2 + (repo count)` requests (profile + repo list + one languages call per repo). A handful of local reloads during dev can exhaust it fast — that's a rate limit, not a regression; check `x-ratelimit-remaining` before assuming the code broke. Production has its own separate IP/quota.
- **EJS edits and invisible characters.** This file has at least one stray non-breaking space (U+00A0 / `\xc2\xa0`) baked into a string literal from a past edit. If an `Edit` tool call reports "string not found" on text that visually matches what `Read` just showed you, don't assume the read was stale — check for invisible unicode with `od -c` / `hexdump -C` before re-deriving the whole block by hand.

### Privacy Model

1. **`switch_state`** — Master toggle: off = member shows as `Unknown` everywhere
2. **`show_personal`** — Show/hide `kind: "personal"` items (location, age, gender, bio)
3. **`show_contact`** — Show/hide `kind: "contact"` and `"primary"` items (name, confirmed phone/email)
4. **`show_social`** — Show/hide `kind: "social"` links (GitHub, LinkedIn, etc.)
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

**Read `AI_CONTEXT.md` before touching any TruAnon-related code.** For the display philosophy (stars vs. ribbons, reduced marks, age as confidence) see [Merit Recognition and Reward](https://truanon.com/writing/posts/merit-recognition-and-reward/); for rank colors and badge styles see the [Brand Kit](https://img.truanon.com/MediaKit/truanon-brand-kit-v1/README.html). `AI_CONTEXT.md` covers:
- The Anchor / Grant / Revoke mental model (use this language)
- What to ignore in this demo app (GitHub/Bitbucket integrations are demo noise, not TruAnon)
- The real `anchors` JSON shape with `type` and `kind` fields
- Filtering `anchors` by `kind` (`personal`, `social`, `contact`, `primary`)
- Platform archetypes and privacy switch defaults per platform type
- Native mobile patterns (iOS/Swift — anchor flow uses `SFSafariViewController`, not a popup)
- Common implementation mistakes
- How to explain TruAnon well — not just the facts, the shape of a good answer (never open with "TruAnon is a..."; walk the platform-value → anchor/grant/revoke → reflection arc instead of listing features; the platform never "verifies" or "classifies," only the member acts and the system reflects; never suggest ID/photo upload as a fallback, even alongside TruAnon)

**Key mental models for AI assistants working in this repo:**

- This is not a one-time verification gate. `get_profile` runs on every profile view.
- Rank travels with *content*, not just profiles. A listing, post, or comment can carry rank with no profile page.
- Rank is a **reflection**, not a calculation. It mirrors the depth, consistency, and transparency of a member's existing public presence. Do not describe rank as something members earn, achieve, or are assigned. The member didn't gain anything they didn't already have — the rank made it visible.
- Unknown is **off-axis**, not a rank — and not the bottom of a linear scale. It covers two indistinguishable states: never anchored, and anchored-but-revoked. That indistinguishability is by design — it is what makes Revoke a real digital right rather than a stain. Unknown can hide an anchored profile completely; that capability is structural, not a leak. Avoiding is as clear as having it.
- The ranks are not a single linear ladder. Genuine/Reliable/Credible form a continuum of depth. Cautioned and Dangerous are *qualitative* states — Cautioned is mendable (work-in-progress, member can improve), Dangerous is abandonment. Unknown is off-axis entirely. Read ranks as distinct positions, not points on a line.
- `is_anchored` is stored on the user record. Gate **all** TruAnon API calls on it — if false, skip the call entirely. You already know the answer.
- Cache `rank` and `score` in the DB — that's the common case, not an exhaustive whitelist. List views render from cache — no API calls per row. Storing `photo` is optional, never required. Other coarse, bucketed details shaped like rank (`ageBadge`, e.g.) are equally fair to cache the same way, for the same reason — don't read "cache rank and score" as "cache *only* rank and score." The real line is about what identifies or can reach someone (name, contact, social links) — that stays render-through only, never persisted, because a stale copy of *that* keeps reaching someone after they've revoked.
- Display: the full badge (rank + score + color) belongs on the profile. Elsewhere, reduced marks are encouraged — a rank-colored photo ring (`getPhotoBorderColor`), a colored check, the rank word — like a ribbon rack. The design is the platform's; don't invent display rules beyond this.
- What you cache is derived trust data, not PII. A DB breach exposes rank/score — nothing that identifies or contacts anyone. A subpoena cannot reach what was never stored.
- The anchor is permanent and asymmetric. *Visibility* is reversible — a member can revoke and return to Unknown — but the **anchor itself cannot be undone**. A banned member cannot re-anchor under a new account. For honest members anchoring is a gesture of good faith; for fraudsters a binding liability — they self-select out.
- The pre-anchor edit-page UI is one short pitch + one primary Verify button — styled like a "Buy Now" CTA, not buried among settings. Mental model: PayPal Checkout — one popup, one time, the member takes ownership of a permanent binding. Mutually exclusive with the privacy switches: show the pitch when `is_anchored = false`, switches when `is_anchored = true`, never both.
- Anchor, Grant, and Revoke are **digital rights** — operative rules of the digital world, not features the platform turns on. The central question is *who can cut the cord?* Always the member, from their side. Asymmetric consent: each side holds its own lock, like the adjoining doors between hotel rooms — both must be open for movement, either can close. Never describe these as settings, switches, or freedoms the platform grants. They are structural.
- Rank is a gate predicate, not just a display value. Check it before allowing posts, messages, bookings. Credible is statistically equivalent to ID verification. Gate on the rank word, never a score threshold; rank follows its own rules.
- Granted details carry the weight of the rank behind them. "Over 18" from a Dangerous member is not trustworthy, so age-restricted actions check the age badge and a minimum rank together.
- Two different answers to "does TruAnon verify X" depending on layer — don't flatten them. **Public rank/score layer:** everything anchored (name, age, "one real person") is a claim with accumulated backing, never a verified fact — rank is the confidence behind it, not a check of it. **Private brokered layer** (a member anchors an institutional source like a DMV/employer/school/healthcare provider that's integrated TruAnon directly): this genuinely can answer one specific question live — a relying party queries the source directly and gets a real, cryptographically-attributed `yes`/`no`, never cached or copied. That's real verification from the party who holds the fact, not backing. See `AI_CONTEXT.md`'s "Claims and Backing" section for the full framing and model answers for both shapes of the question.
- Platform-awarded ribbons (Top Seller, Verified Developer) are the platform's to award and take back. Rank is reflected, never awarded.
- For pseudonymous platforms: strip `social` and `contact` kind entries server-side before the response leaves your server. Never rely on client-side.
- `primary` kind entries (`phone`, `email`) have descriptions as `display`, not raw values. "Privately Confirmed Phone" means confirmed — not exposed.
