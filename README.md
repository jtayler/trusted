# Building Trust Into Your Platform

TruAnon is a trust layer — not a verification gate, not KYC. Members anchor their identity once using accounts the world already knows them by: GitHub, LinkedIn, Bluesky, their own domain. That history reflects back as a rank, score, and color that travels with them everywhere TruAnon is adopted. Platforms weave it in. Members control it. It runs itself.

[Visit Demo Site](https://devhauz.truanon.com) · [Watch Demo Video](https://vimeo.com/1049232204) · [View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

---

## Anchor, Grant, Revoke

**Anchor** — A member connects their TruAnon identity to your platform. Once. Cannot be undone. Rank and verified properties follow automatically. A banned member cannot return under a new account — the anchor persists. This is structural, not a policy.

For honest members, anchoring is a gesture of good faith — accountability they offer freely because they have nothing to hide. For fraudsters, the same anchor is a binding liability. Every benefit flips to risk: accountability is exposure, permanence is a trap. They walk away to platforms where the calculus works in their favor. They self-select out.

**Grant** — The member turns on visibility of specific data categories. The platform decides which to surface; the member decides whether to share each one.

**Revoke** — The member turns off visibility. Status returns to `Unknown`. The anchor remains. Going dark is always an option. Erasing an anchor is not.

Unknown covers both states — never anchored and anchored-but-revoked look identical to any viewer. Avoiding is as clear as having it. On a platform where most members anchor, that choice is conspicuous — in a way that belongs entirely to them. Unknown is a social prompt: interaction reveals intention.

---

## Rank

Rank is a mirror, not a meter. It reflects depth of history, and transparency of a member's existing public presence — not something they earned. Continuous, visible, active presence is the meaningful signal. The rank is live: remove your name from a public profile and it drops; establish a long-active presence and it rises. The member didn't gain anything they didn't already have — the rank made it's confidence of oversight and audience, visible.

| Rank | What it reflects |
|------|-----------------|
| **Genuine** | Deepest, most consistent, most transparent public presence |
| **Reliable** | Strong public history with real visibility |
| **Credible** | Meaningful public presence — statistically equivalent to ID verification |
| **Cautioned** | Confused signals — some visible, some hidden. Not permanent; the member can improve. |
| **Dangerous** | Abandonment or active concealment. Cautioned → Dangerous within days is the threat actor pattern. |

Unknown is the baseline. Regular folks naturally move up over time. Credible is all most platforms need as a gate. If being Credible is valuable, then being Reliable or even Genuine must be more so, and people boost this score because they want to.

---

## The Badge

Show rank, score, and color together — always. Don't reduce to just a checkmark; that discards most of the value. The score is a universal confidence reading: a 4.2 means the same level of trust and transparency for any member, regardless of which properties back it. People natureally trust it because they naturally understand it.

The badge is a design canvas: a small pill inline with a username, a card on a profile, or a full achievement. The design is yours.

**Achievements:** When a member grants visibility to GitHub, LinkedIn, TikTok, or any type of property, your server can query that platform's API with the verified account. The link may never be shown to viewers — the derived badge is yours to create. "Verified Developer," "Active Creator" — whatever fits your platform. Verified properties are both a display signal and a data source your platform can act on independently.

---

## What You Display

This is an API that returns structured identity data. You decide what to render — if anything.

A healthcare portal uses rank as a server-side gate and shows nothing. A classifieds platform shows Genuine 4.5 on every listing — no profile page required. A pseudonymous community shows rank next to a username with no identity visible. A dating app shows age range and location, private by default, social links never surfaced to strangers.

`anchors` contains only what the member has granted. Filter by `kind`:

| `kind` | What it contains |
|--------|-----------------|
| `personal` | Location, age, gender, bio |
| `social` | Platform links — GitHub, LinkedIn, TikTok, etc. |
| `contact` | Full name, preferred contact |
| `primary` | Confirmed phone/email — description only, never the raw value |

`"Privately Confirmed Phone"` means TruAnon confirmed the number. Your platform never receives it.

**You cannot be compelled to reveal what you do not have.** The platform stores rank, score, and a photo — derived trust data, not PII. A database breach exposes nothing that identifies or contacts anyone. A subpoena cannot reach what was never stored.

---

## The API

```
GET https://truanon.com/api/v2/get_profile?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

```json
{
  "rank": "Genuine",
  "score": "5.0",
  "name": "Jesse Tayler",
  "title": "Fisherman, Scholar, Huntsman",
  "photo": "https://img.truanon.com/231-400.png",
  "ageBadge": "Over 21",
  "anchors": [
    { "name": "GitHub", "display": "github.com/jtayler",
      "icon": "fab fa-github", "type": "github", "kind": "social" },
    { "name": "Location", "display": "Manhattan",
      "icon": "fa fa-map-marked", "type": "location", "kind": "personal" },
    { "name": "Primary Phone", "display": "Privately Confirmed Phone",
      "icon": "fas fa-mobile-alt", "type": "phone", "kind": "primary" }
  ]
}
```

**`get_profile`** — on every profile where the databse shows they want identity. Fast GET. Never block the page on TruAnon — render from cache, fetch async.

**`get_token`** — once, when anchoring. Call only when `get_profile` returns an unanchored user on their edit page. After anchoring, never call again.

---

## The Anchor Flow

```
Member opens edit page
        │
        ▼
   Call get_profile
        │
        ├── Anchored ──► Show rank + score + privacy switches
        │
        └── Unknown ───► Call get_token → build verify URL
                              │
                              ▼
                    Open in modal (iframe) or SFSafariViewController
                              │
                              ▼
                    Member confirms on TruAnon's UI
                              │
                              ▼
                    TruAnon redirects to your callback → reload
```

```
https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]&callback=[ENCODED_CALLBACK_URL]
```

Open however you want, in a **modal with an iframe** — not `window.open()`, which browsers block. On mobile: `SFSafariViewController` (iOS) or Chrome Custom Tabs (Android).

---

## Fetching

Store `is_anchored` on the user record. Set it the first time `get_profile` returns a real rank. Gate all TruAnon calls on it — if false, skip. You already know the answer.

Live TruAnon fetches belong in two places only: the profile view (async, after load) and the edit page (verify token, unanchored users only). Everything else — lists, feeds, search, comments — renders from your DB cache with zero API calls.

```javascript
function fetchWithTimeout(url, options, ms = 30000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}

// Render immediately from cache — badge loads async
app.get('/users/:username', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.params.username], (err, user) => {
        if (err || !user) return res.status(404).send('Not found');
        res.render('profile', { user });
    });
});

// TruAnon proxy — called by client JS after page loads
app.get('/users/:username/truanon', async (req, res) => {
    const url = `${apiBase}get_profile?id=${req.params.username}&service=${serviceName}`;
    try {
        const response = await fetchWithTimeout(url, { headers: { Authorization: privateKey } });
        const data = await response.json();
        db.run('UPDATE users SET rank = ?, score = ?, photo = ? WHERE username = ?',
            [data.rank, data.score, data.photo, req.params.username]);
        res.json(data);
    } catch {
        res.status(503).json({ error: 'TruAnon unavailable' });
    }
});
```

```javascript
// Client
fetch(`/users/${username}/truanon`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => renderTruAnonBadge(data))
    .catch(() => {});
```

Cache `rank`, `score`, and `photo`. Map rank to color:

```javascript
function rankToColor(rank) {
    return { Genuine: 'primary', Reliable: 'success', Credible: 'secondary',
             Cautioned: 'warning', Dangerous: 'danger' }[rank] || 'light';
}
```

---

## Rank as a Gate

Rank is a predicate. Check it before allowing any action — posting, messaging, booking — using your cached value. Zero added latency. The gate is structural: the anchor persists; a new account doesn't escape it.

Credible is statistically equivalent to ID verification — for most platforms, it is all you need. Once members see Credible is valued, they naturally push toward Reliable and Genuine on their own.

```javascript
const RANK_ORDER = ['Unknown', 'Cautioned', 'Dangerous', 'Credible', 'Reliable', 'Genuine'];

function meetsMinimumRank(userRank, minimumRank) {
    return RANK_ORDER.indexOf(userRank) >= RANK_ORDER.indexOf(minimumRank);
}

if (!meetsMinimumRank(user.rank, 'Credible')) {
    return res.status(403).json({ error: 'Credible rank required to post.' });
}
```

---

## Privacy Switches

Give the member a toggle for each category your platform surfaces.

| Switch | Effect |
|--------|--------|
| **Use Verified Identity** | Master toggle — off means `Unknown` everywhere |
| **Display Personal Info** | Show / hide `kind: "personal"` items |
| **Display Social Profiles** | Show / hide `kind: "social"` links |
| **Private Profile** | Data shows, all URLs removed — nothing clickable |
| **Display Contact Info** | Show / hide `kind: "contact"` and `"primary"` items |

For pseudonymous platforms, strip `social` and `contact` entries server-side unconditionally.

---

## Quick Integration Checklist

- [ ] Register at developer.truanon.com — get `PRIVATE_KEY` and `SERVICE_NAME`
- [ ] Proxy all TruAnon calls through your server — never expose `PRIVATE_KEY` client-side
- [ ] Store `is_anchored` on the user record — gate all TruAnon calls on it
- [ ] Cache `rank`, `score`, `photo` — list views never need an API call
- [ ] Render profile pages immediately from DB cache — fetch TruAnon async from the client after load
- [ ] Display rank + score + color — never reduce to a checkmark alone
- [ ] Show *"Ask me why I haven't anchored"* for Unknown members — this is optional but highly valuable and conspicuous to avoid
- [ ] On edit page: read `is_anchored` from DB to know which state to render before any fetch
- [ ] Fetch verify token only when the member clicks Verify — not on page load
- [ ] Implement privacy switches for Personal, Contact, and Social — only show after anchoring
- [ ] For pseudonymous platforms: strip social/contact links server-side unconditionally

---

[Example Public Profile — Hanna](https://truanon.com/p/hanna)
