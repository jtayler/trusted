# Building Trust Into Your Platform

This is a working reference implementation of TruAnon's identity API. It shows how any platform can weave a **trust layer** into its fabric — giving members a ranked, scored, privacy-controlled identity that makes trust visible, portable, and automatic.

TruAnon is not a verification gate and not KYC. Think of it like Google Maps for trust: anyone can host it, members power it, and the data flows automatically once integrated.

[Visit Demo Site](https://devhauz.truanon.com) · [Watch Demo Video](https://vimeo.com/1049232204) · [View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

---

## Anchor, Grant, Revoke

These three words are the mental model.

**Anchor** — A member connects their TruAnon identity to their account on your platform. This happens once, in a modal or native sheet, and cannot be undone. Their rank, score, and verified properties follow them automatically from that point forward. If a member is banned, they cannot return under a new account — a new account anchored to the same TruAnon identity would be recognized. This is structural fraud prevention, not a policy rule.

**Grant** — The member turns on visibility of specific data categories to your platform. Your platform decides which categories to surface. The member gets the corresponding right to say yes or no to each one.

**Revoke** — The member turns off visibility. Their status returns to `Unknown` from any viewer's perspective. The anchor still exists — but nothing is visible. A member who wants to step back, hide a difficult period, or simply choose privacy can go dark at any time. You cannot erase an anchor, only go dark.

This is a digital rights model: you grant access to data, and you pass that right to revoke back to the member. Whatever categories of data your platform surfaces, the member gets the right to turn them off.

---

## What You Display Is Up To You

This is not a badge system with a prescribed UI. It is an API that returns structured identity data. What you render — if anything — is entirely your design decision.

**You might show nothing.** A healthcare portal, a legal tool, or any system where a visible badge is inappropriate can use TruAnon purely server-side: check rank before granting access, gate features by score, log anchor status — and render nothing to the user.

**You might show a rank pill.** A bordered pill reading `Reliable · 4.0 of 5`, rank-colored. This is the minimum meaningful display. It links to the member's public TruAnon profile unless Private Profile is on.

**You might show an inline icon.** A small rank-colored checkmark next to a username — the pattern Bluesky uses. A simple emoji or SVG works as a non-interactive indicator; make it tappable to reveal a detail sheet.

**You might show a detail sheet.** A popup that explains the rank and surfaces platform-specific anchors — "GitHub Anchored", "TikTok Verified". Built from the `dataConfigurations` array. Your platform chooses which anchors to highlight.

**You might show a verified details row.** Icon + label items for location, age, gender, bio, social links — each rendered from a `dataConfiguration` entry. Your platform filters which `dataPointKind` values to surface.

**You might show rank on anonymous content.** A comment or post can display a rank badge next to a pseudonym with no identity visible. The member is anonymous but their trust standing travels with the post. A Genuine-ranked comment carries weight without revealing the person.

How a platform uses TruAnon varies widely:

| Platform | What to surface | Privacy default |
|----------|----------------|-----------------|
| Dating | Age, location, rank — no social links | Private Profile on by default |
| Marketplace / Care.com | Rank, age, contact (if granted) — gate by rank | Identity required to transact |
| Developer community | GitHub / Bitbucket anchor, rank, score | Open by default |
| Public social | Full badge + all social anchors | Open, member's choice |
| Pseudonymous / Reddit-like | Rank + score only — never links | Strip links server-side always |
| Anonymous posts | Rank badge next to pseudonym | No identity visible |
| Healthcare / legal | Server-side rank check, no visible badge | N/A |

---

## Rank Travels With Content, Not Just Profiles

A member doesn't need a profile page for their rank to be useful. Rank can attach to any piece of content: a listing, a post, a comment, a review.

A classifieds platform is the clearest example. Most users have no profile. But a seller who has anchored carries their rank on every listing they post:

> Jesse — Manhattan · Leo · **Genuine 4.5 of 5**

The buyer sees meaningful trust signals without the seller exposing a LinkedIn URL, a phone number, or a real name. The seller chose to share their first name, neighborhood, and zodiac sign — all `personal` kind entries from their granted `dataConfigurations`. The rank and score come from `authorRank` and `authorRankScore`. The platform stores only those derived values.

No profile page required. No persistent visible identity. The rank is real regardless.

**The structural security property worth naming explicitly:** If someone steals your database, they find `authorRank: "Genuine"` and `authorRankScore: "4.5"`. That is derived trust data — not a name, not an email, not a social link, not anything that traces back to a real person. The anchor lives on TruAnon's servers, not yours. You cannot be compelled to give up what you do not have. This is risk freedom for the platform operator, not just the member.

---

## Caching Rank for List Performance

Profile pages are the right place for live `get_profile` calls. List pages — search results, browse grids, feeds, comment threads — are not. Calling `get_profile` per row on a 50-result page is impractical and unnecessary.

Cache `authorRank` and `authorRankScore` in your DB row. List views render rank and color entirely from your DB with zero API calls. The live fetch happens on the actual profile view, where it updates the cache.

```javascript
// On profile view — fetch live, update cache
const data = await fetchTruAnon(username);
db.run(
    'UPDATE users SET authorRank = ?, authorRankScore = ? WHERE username = ?',
    [data.authorRank, data.authorRankScore, username]
);

// On list/search render — read from cache, no API call
db.all('SELECT username, authorRank, authorRankScore FROM users WHERE ...', (err, rows) => {
    rows.forEach(row => { row.rankColor = rankToColor(row.authorRank); });
    res.render('search', { results: rows });
});

function rankToColor(rank) {
    return { Genuine: 'gold', Reliable: 'green', Credible: 'blue',
             Cautioned: 'orange', Dangerous: 'red' }[rank] || 'gray';
}
```

What you cache is derived trust data — not PII. A database breach exposes rank and score. Nothing that identifies, locates, or contacts anyone.

---

## Rank as an Access Gate

Rank is a predicate you can check before allowing any action: posting a listing, sending a message, joining a community, booking a service. The rank comes from your cached DB value — this gate adds zero latency.

```javascript
const RANK_ORDER = ['Unknown', 'Cautioned', 'Dangerous', 'Credible', 'Reliable', 'Genuine'];

function meetsMinimumRank(userRank, minimumRank) {
    return RANK_ORDER.indexOf(userRank) >= RANK_ORDER.indexOf(minimumRank);
}

// Gate posting a listing
if (!meetsMinimumRank(user.authorRank, 'Credible')) {
    return res.status(403).json({ error: 'Credible rank required to post.' });
}

// Gate sending a first message
if (!meetsMinimumRank(user.authorRank, 'Reliable')) {
    return res.status(403).json({ error: 'Reliable rank required to contact sellers.' });
}
```

The gate is structural, not a policy rule. A bad actor cannot route around it by creating a new account — because the anchor persists. They would need to build a new Genuine rank from scratch across multiple independent platforms. That is not a fast or cheap operation.

---

## Platform Badges Built on Top of Rank

Your platform can issue its own trust label computed from TruAnon rank. TruAnon is the infrastructure; your badge is the brand.

```javascript
// Care / childcare marketplace — "Screened" requires Credible or above
function getPlatformBadge(authorRank) {
    return ['Credible', 'Reliable', 'Genuine'].includes(authorRank)
        ? { label: 'Screened', icon: 'shield-check' }
        : null;
}

// Developer community — highlight specific platform anchors
function getDevBadge(dataConfigurations) {
    const hasGitHub = dataConfigurations.some(d => d.dataPointType === 'github');
    return hasGitHub ? { label: 'GitHub Anchored' } : null;
}
```

Members see your label. You know what it means. The trust infrastructure is shared; the brand is yours.

---

## The API Response

One GET request returns everything:

```
GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

**Top-level fields:**

```json
{
  "authorRank": "Genuine",
  "authorRankScore": "5.0",
  "authorFullName": "Jesse Tayler",
  "authorTitle": "Fisherman, Scholar, Huntsman",
  "authorPhoto": "https://s3.amazonaws.com/truanon/39-400.png",
  "dataConfigurations": [...]
}
```

`authorRank` is one of: `Genuine`, `Reliable`, `Credible`, `Cautioned`, `Dangerous` — or absent/error if unanchored. `authorRankScore` is a string out of `5.0`. Map rank to a display color however fits your design — gold for Genuine, green for Reliable, blue for Credible are natural choices.

**`dataConfigurations` — the granted data**

Each entry represents one data point the member has granted visibility to:

```json
{
  "dataPointName": "GitHub",
  "displayValue": "github.com/jtayler",
  "dataPointIconClass": "fab fa-github",
  "dataPointType": "github",
  "dataPointKind": "social"
}
```

`dataPointIconClass` is a Font Awesome class string — useful if your UI already uses Font Awesome, otherwise use it to infer the platform and render your own icon.

**`dataPointKind` — filtering by category**

| `dataPointKind` | What it contains |
|----------------|-----------------|
| `personal` | Location, age, gender, bio, zodiac |
| `social` | Platform profile links — GitHub, LinkedIn, Vimeo, TikTok, etc. |
| `contact` | Full name, preferred contact info |
| `primary` | Confirmed phone, confirmed email — description only, not raw value |
| `truanon` | The TruAnon profile link itself (`dataPointType: "truanon"`) |

**Filtering examples:**

```javascript
const configs = data.dataConfigurations || [];

// Dating site — personal info only, no social links
const personal = configs.filter(d => d.dataPointKind === 'personal');

// Developer community — check which platforms are anchored
const hasGitHub   = configs.some(d => d.dataPointType === 'github');
const hasTikTok   = configs.some(d => d.dataPointType === 'tiktok');

// Age — displayValue is "Age 55" or a range like "16-17"
const ageLine = configs.find(d => d.dataPointType === 'birthday'
    && d.displayValue.match(/^Age|\d+[-–]\d+/));

// Social links to render as icons (exclude the TruAnon entry itself)
const socialLinks = configs.filter(d =>
    d.dataPointKind === 'social' && d.dataPointType !== 'truanon');

// Contact / primary — only surface if your platform uses it
const contactInfo = configs.filter(d =>
    ['contact', 'primary'].includes(d.dataPointKind));

// TruAnon profile URL
const truanonEntry = configs.find(d => d.dataPointType === 'truanon');
const profileURL = truanonEntry
    ? `https://truanon.com/p/${truanonEntry.displayValue}`
    : null;
```

**Note on `primary` kind:** `displayValue` for confirmed phone or email is a description, not the raw value. `"Privately Confirmed Phone"` means the number exists and is verified — but is never exposed. Your platform can display "Phone verified ✓" without ever seeing the number. This is intentional — the member confirmed it to TruAnon, not to you.

---

## The Two API Calls

**`get_profile` — called on every profile view**

```
GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

Call this every time a profile loads. It's a fast GET. Treat it like fetching an avatar URL. Render immediately from your DB cache; fetch live TruAnon data in a separate async call after the page loads — never block the page on TruAnon.

**`get_token` — called once, when anchoring**

```
GET https://truanon.com/api/get_token?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

Only call this when `get_profile` returns an unanchored user AND they are on their edit/profile page and you want to prompt them to anchor. After they anchor once, you never call this again for that member. `get_profile` is the only call for the rest of their time on your platform.

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
        └── Unknown ───► Show anchor / verify button
                              │
                              ▼
                    Call get_token → build verify URL
                              │
                              ▼
                    Open in modal (iframe) or SFSafariViewController
                              │
                              ▼
                    Member confirms on TruAnon's UI
                              │
                              ▼
                    TruAnon redirects to your callback
                              │
                              ▼
                    Call get_profile → Anchored, rank live
```

**Building the verify URL:**

```
https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]&callback=[ENCODED_CALLBACK_URL]
```

Open this in a **Bootstrap modal with an iframe** — not `window.open()`, which browsers block. TruAnon posts a `closeVerificationModal` message when done; your listener closes the modal and reloads. Point `callback` at a route on your own server that `postMessage`s back to the parent.

```javascript
// Server: callback route — TruAnon redirects here after anchoring
app.get('/verify-complete', (req, res) => {
    res.send(`<!DOCTYPE html><html><body><script>
        window.parent.postMessage({ action: 'verificationComplete' }, '*');
    </script></body></html>`);
});
```

```javascript
// Client: listen for completion
window.addEventListener('message', (event) => {
    if (event.data?.action === 'verificationComplete') {
        bootstrap.Modal.getInstance(
            document.getElementById('verificationModal')
        ).hide();
        window.location.reload();
    }
});
```

Build the verify URL with `&callback=https://yourhost/verify-complete`.

On mobile: `SFSafariViewController` (iOS) or Chrome Custom Tabs (Android) with a custom URL scheme callback (e.g. `yourapp://verified`). Register the scheme and handle it in your app delegate to dismiss the sheet and refresh.

---

## Non-Blocking Profile Render

Never block a profile page waiting for TruAnon. Render immediately from your DB cache. Fetch live TruAnon data in a separate client-side request after the page loads. If TruAnon is slow or unavailable, your page is already rendered.

```javascript
const apiBase   = 'https://truanon.com/api/';
const privateKey  = process.env.TRUANON_PRIVATE_KEY;
const serviceName = process.env.TRUANON_SERVICE_NAME;

function fetchWithTimeout(url, options, ms = 30000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
}

// Server: render immediately from DB cache
app.get('/users/:username', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.params.username], (err, user) => {
        if (err || !user) return res.status(404).send('Not found');
        res.render('profile', { user }); // badge loads async
    });
});

// Server: TruAnon proxy — called by client JS after page loads
app.get('/users/:username/truanon', async (req, res) => {
    const url = `${apiBase}get_profile?id=${req.params.username}&service=${serviceName}`;
    try {
        const response = await fetchWithTimeout(url, { headers: { Authorization: privateKey } });
        const data = await response.json();
        db.run(
            'UPDATE users SET authorRank = ?, authorRankScore = ?, authorPhoto = ? WHERE username = ?',
            [data.authorRank, data.authorRankScore, data.authorPhoto, req.params.username]
        );
        res.json(data);
    } catch {
        res.status(503).json({ error: 'TruAnon unavailable' }); // client shows cached state
    }
});
```

```javascript
// Client: fetch and render badge after page loads
fetch(`/users/${username}/truanon`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => renderTruAnonBadge(data))
    .catch(() => { /* badge stays in Unknown state — page already rendered */ });
```

---

## Privacy Switches — Mirroring Member Rights

Your platform decides which data categories to surface. For each category you surface, give the member a corresponding toggle in your edit UI. This is the contract: you grant access to data, you pass the right to revoke it back to the member.

**The four standard switches:**

| Switch | Effect | When master is off |
|--------|--------|-------------------|
| **Use Verified Identity** | Master toggle — off means member shows as "Unknown" everywhere | All other switches are irrelevant |
| **Display Personal Info** | Show / hide `dataPointKind: "personal"` items | — |
| **Display Social Profiles** | Show / hide `dataPointKind: "social"` links | — |
| **Private Profile** | Data shows but all URLs are removed — nothing is clickable or stalkable | — |

A sales or care platform might add:

| Switch | Effect |
|--------|--------|
| **Display Contact Info** | Show / hide `dataPointKind: "contact"` and `"primary"` items |

**Platform-specific defaults:**

- **Dating:** Private Profile ON by default. Personal info OFF by default. Never auto-display social links.
- **Marketplace:** Identity required to transact — gate the transaction flow by minimum rank.
- **Pseudonymous:** Do not expose a links toggle at all — strip `social` links server-side, regardless of member settings.

**Server-side stripping for pseudonymous platforms:**

```javascript
// Strip before sending to browser — never rely on client-side for this
function filterForPseudonymous(data) {
    return {
        ...data,
        dataConfigurations: (data.dataConfigurations || []).filter(
            d => !['social', 'contact', 'primary'].includes(d.dataPointKind)
        )
    };
}
```

---

## What You Get Once a Member Anchors

- **Rank + Score** — always current, updated on every `get_profile` call
- **Verified properties** — only what the member has granted visibility to; changes take effect in real time
- **`authorPhoto`** — their TruAnon profile photo, if granted
- **Structural continuity** — rank, anchor, and score persist across sessions, devices, and platforms automatically; a banned member cannot re-anchor under a new account

Use these to:
- Render rank + score in profiles, feeds, and comment threads
- Gate features, communities, or transactions by minimum rank
- Sort or filter members by trust level in search
- Surface which anchors exist (GitHub, TikTok, domain) without exposing the backing URL
- Show age (`"Age 55"` or a range) or location without knowing the raw values
- Show `"Phone verified ✓"` or `"Email confirmed ✓"` from `primary` entries without receiving the data

---

## The Badge Is Not a Checkmark

The rank and score together are the value — not a binary verified/unverified state. A score of 4.0 from a Reliable member says something a checkmark cannot. Show rank and score together, or show neither.

When a member has not anchored, the recommended UI is not silence. It is a prompt:

> *"Ask me why I haven't anchored."*

On a platform where trusted members display rank, opting out is conspicuous. People prefer members who have anchored. This is social gravity, not coercion — and it makes the system self-reinforcing. Fraudsters face a structural problem: they cannot fake a 5.0 score anchored across a dozen real platforms. They move to less trusted platforms. Your platform's quality improves passively.

---

## Economics

- **First 1,000 verifications are free**
- After that: approximately **$0.04 per verification**

If you get a bill for a few dollars, it means it's working. Your platform is growing and trust is doing its job.

---

## Quick Integration Checklist

- [ ] Register your service at truanon.com — get `PRIVATE_KEY` and `SERVICE_NAME`
- [ ] Proxy all TruAnon API calls through your server — never expose `PRIVATE_KEY` client-side
- [ ] Call `get_profile` on every profile view; render from DB cache, fetch async
- [ ] Display rank + score — never reduce it to a checkmark alone
- [ ] Show *"Ask me why I haven't anchored"* for members without a badge
- [ ] On edit page: if unknown, call `get_token` and show the anchor button
- [ ] Implement privacy switches appropriate to your platform type
- [ ] Cache `authorRank`, `authorRankScore`, `authorPhoto` in your DB for display continuity
- [ ] For pseudonymous platforms: strip social links server-side, never rely on client-side

---

## About TruAnon

TruAnon makes verified identity available to everyone — not just platforms big enough to build it themselves. Credibility is available to anyone willing to show up as themselves. Members anchor using accounts the world already knows them by — GitHub, LinkedIn, their own domain — and that history aggregates into a rank that travels everywhere TruAnon is adopted.

[truanon.com](https://truanon.com) · [Example Public Profile](https://truanon.com/p/jtayler)
