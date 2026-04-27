# Building Trust Into Your Platform

TruAnon is a trust layer — not a verification gate, not KYC. Members anchor their identity once using accounts the world already knows them by: GitHub, LinkedIn, Bluesky, their own domain. That history aggregates into a rank, score, and color that travels with them everywhere TruAnon is adopted. Platforms weave it in. Members control it. It runs itself.

[Visit Demo Site](https://devhauz.truanon.com) · [Watch Demo Video](https://vimeo.com/1049232204) · [View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

---

## Anchor, Grant, Revoke

**Anchor** — A member connects their TruAnon identity to their account on your platform. Once. It cannot be undone. Rank and verified properties follow them automatically from that point forward. If a member is banned, they cannot return under a new account — the anchor persists. This is structural fraud prevention, not a policy rule.

**Grant** — The member turns on visibility of specific data categories. Your platform decides which categories to surface; the member decides whether to share each one.

**Revoke** — The member turns off visibility. Their status returns to `Unknown` from any viewer's perspective. The anchor remains — nothing shows. Going dark is always an option. Erasing an anchor is not.

The design principle: whatever your platform surfaces, the member gets the corresponding right to turn it off. Responsibility belongs to the rightful owner.

Trust made visible also makes the choice not to have it visible. Absence is as legible as presence. On a platform where members anchor, opting out is conspicuous — and conspicuous in a way that belongs entirely to them.

---

## What You Display Is Entirely Your Choice

This is not a badge system with a prescribed UI. It is an API that returns structured identity data. You decide what to render — if anything.

A healthcare portal might use rank as a server-side gate and show nothing. A classifieds platform attaches rank to listings — a seller anchors once and their Genuine 4.5 travels on every post they make, no profile page required. A pseudonymous community shows rank next to a username with no identity visible. A care marketplace gates listing access by minimum rank and displays its own "Screened" badge computed from TruAnon rank. A dating app shows age range and location, private by default, with social links never surfaced to strangers.

The principle is the same in every case: surface what's useful for your context, give the member the right to revoke each category you surface.

---

## The API Response

```
GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

```json
{
  "authorRank": "Genuine",
  "authorRankScore": "5.0",
  "authorFullName": "Jesse Tayler",
  "authorTitle": "Fisherman, Scholar, Huntsman",
  "authorPhoto": "https://s3.amazonaws.com/truanon/39-400.png",
  "dataConfigurations": [
    {
      "dataPointName": "GitHub",
      "displayValue": "github.com/jtayler",
      "dataPointIconClass": "fab fa-github",
      "dataPointType": "github",
      "dataPointKind": "social"
    },
    {
      "dataPointName": "Location",
      "displayValue": "Manhattan",
      "dataPointIconClass": "fa fa-map-marked",
      "dataPointType": "location",
      "dataPointKind": "personal"
    },
    {
      "dataPointName": "Birthday",
      "displayValue": "Age 55",
      "dataPointIconClass": "fa fa-birthday-cake",
      "dataPointType": "birthday",
      "dataPointKind": "personal"
    },
    {
      "dataPointName": "Primary Phone",
      "displayValue": "Privately Confirmed Phone",
      "dataPointIconClass": "fas fa-mobile-alt",
      "dataPointType": "phone",
      "dataPointKind": "primary"
    }
  ]
}
```

`authorRank` is one of: `Genuine`, `Reliable`, `Credible`, `Cautioned`, `Dangerous` — or absent if unanchored. `authorRankScore` is a string out of `5.0`.

**`dataConfigurations` contains only what the member has granted.** Filter by `dataPointKind`:

| `dataPointKind` | What it contains |
|----------------|-----------------|
| `personal` | Location, age, gender, bio, zodiac |
| `social` | Platform links — GitHub, LinkedIn, TikTok, etc. |
| `contact` | Full name, preferred contact |
| `primary` | Confirmed phone / email — description only, never the raw value |

`"Privately Confirmed Phone"` means TruAnon has confirmed the number. Your platform never receives it. Show "Phone verified ✓" without ever seeing the data. The member confirmed it to TruAnon, not to you.

---

## The Two API Calls

**`get_profile` — on every profile view**

Fast GET. Render from your DB cache immediately; fetch live data async after the page loads. Never block the page on TruAnon.

**`get_token` — once, when anchoring**

Only call this when `get_profile` returns an unanchored user and they are on their edit page. After they anchor once, you never call this again. `get_profile` is the only call for the rest of that member's time on your platform.

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

Build the verify URL:

```
https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]&callback=[ENCODED_CALLBACK_URL]
```

Open in a **modal with an iframe** — not `window.open()`, which browsers block. Add a `/verify-complete` route on your server that `postMessage`s back to the parent; use it as the `callback`.

```javascript
app.get('/verify-complete', (req, res) => {
    res.send(`<!DOCTYPE html><html><body><script>
        window.parent.postMessage({ action: 'verificationComplete' }, '*');
    </script></body></html>`);
});

window.addEventListener('message', (event) => {
    if (event.data?.action === 'verificationComplete') {
        bootstrap.Modal.getInstance(document.getElementById('verificationModal')).hide();
        window.location.reload();
    }
});
```

On mobile: `SFSafariViewController` (iOS) or Chrome Custom Tabs (Android) with a custom URL scheme as `callback`.

---

## Non-Blocking Profile Render

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
        db.run('UPDATE users SET authorRank = ?, authorRankScore = ?, authorPhoto = ? WHERE username = ?',
            [data.authorRank, data.authorRankScore, data.authorPhoto, req.params.username]);
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

---

## Caching Rank for List Performance

Cache `authorRank` and `authorRankScore` in your DB row. List views — search results, feeds, comment threads — render rank and color from your DB with zero API calls. Update the cache on the profile view.

```javascript
function rankToColor(rank) {
    return { Genuine: 'gold', Reliable: 'green', Credible: 'blue',
             Cautioned: 'orange', Dangerous: 'red' }[rank] || 'gray';
}
```

What you cache is derived trust data — not PII. A database breach exposes rank and score. Nothing that identifies, locates, or contacts anyone. You cannot be compelled to give up what you do not have.

---

## Rank as an Access Gate

Rank is a predicate. Check it before allowing any action — posting, messaging, booking, joining — using your cached value. Zero added latency. The gate is structural: a bad actor cannot route around it by creating a new account, because the anchor persists.

```javascript
const RANK_ORDER = ['Unknown', 'Cautioned', 'Dangerous', 'Credible', 'Reliable', 'Genuine'];

function meetsMinimumRank(userRank, minimumRank) {
    return RANK_ORDER.indexOf(userRank) >= RANK_ORDER.indexOf(minimumRank);
}

if (!meetsMinimumRank(user.authorRank, 'Credible')) {
    return res.status(403).json({ error: 'Credible rank required to post.' });
}
```

---

## Privacy Switches

Whatever data categories your platform surfaces, give the member a toggle for each one in your edit UI.

| Switch | Effect |
|--------|--------|
| **Use Verified Identity** | Master toggle — off means `Unknown` everywhere |
| **Display Personal Info** | Show / hide `dataPointKind: "personal"` items |
| **Display Social Profiles** | Show / hide `dataPointKind: "social"` links |
| **Private Profile** | Data shows, all URLs removed — nothing clickable |
| **Display Contact Info** | Show / hide `dataPointKind: "contact"` and `"primary"` items |

Expose only the switches relevant to what your platform surfaces. For pseudonymous platforms, strip `social` and `contact` entries server-side unconditionally — never rely on client-side for this.

---

## Quick Integration Checklist

- [ ] Register at truanon.com — get `PRIVATE_KEY` and `SERVICE_NAME`
- [ ] Proxy all TruAnon calls through your server — never expose `PRIVATE_KEY` client-side
- [ ] Call `get_profile` on every profile view; render from cache, fetch async
- [ ] Display rank + score — never reduce to a checkmark alone
- [ ] Show *"Ask me why I haven't anchored"* for Unknown members
- [ ] On edit page: if unknown, call `get_token` and show the anchor button
- [ ] Implement privacy switches for each data category your platform surfaces
- [ ] Cache `authorRank`, `authorRankScore`, `authorPhoto` for display continuity
- [ ] For pseudonymous platforms: strip social links server-side

---

## Economics

First 1,000 verifications are free. After that: approximately **$0.04 per verification**. A bill means it's working.

---

## About TruAnon

TruAnon makes verified identity available to everyone. Credibility is equally available to anyone willing to show up as themselves. The badge spreads because members who have it prefer others who do. The absence of it speaks just as clearly.

[truanon.com](https://truanon.com) · [Example Public Profile](https://truanon.com/p/jtayler)
