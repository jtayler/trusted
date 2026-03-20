# Building a Trusted Internet — One Platform at a Time

This is a working demonstration of TruAnon's identity APIs integrated into a Node.js platform. It shows how any service can weave a **trust layer** into its fabric — giving members a ranked, scored, privacy-controlled identity badge that makes trust visible, portable, and automatic.

[Visit Demo Site](https://devhauz.truanon.com) · [Watch Demo Video](https://vimeo.com/1049232204) · [View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

---

## What This Is (And What It Isn't)

This is **not** an age gate, a KYC flow, or a one-time identity check.

TruAnon is a **trust layer** — a living, user-controlled identity signal that your platform displays, filters by, and builds community around. Members anchor their identity to the accounts and profiles the world already knows them by: GitHub, LinkedIn, Bluesky, their own domain. That proof aggregates into a **rank, score, and color badge** that travels with them everywhere TruAnon is adopted.

Think of it like Google Maps for trust. Anyone can host it. Members make it work. Once integrated, it runs itself.

---

## Three Things This Demo Proves

1. **A Service is private** when the Owner decides it should not be displayed.
2. **Data is private** when a Publishing Service decides it shall be governed as such.
3. **Consuming Services** (like this demo) onboard immediately, and access responds to identity changes in real time.

When a member updates their privacy settings, it takes effect everywhere — instantly. No re-verification. No developer action required.

---

## The Badge Is More Than a Checkmark

Most "verified" systems show a checkmark. TruAnon shows three signals together:

| Signal | What it means |
|--------|--------------|
| **Score** (e.g. 5.0) | Depth and quality of verified identity |
| **Rank** (numeric) | Standing relative to others on the platform |
| **Color** | Visual trust tier at a glance |

When a member hasn't verified, the recommended UI isn't silence — it's a prompt:

> *"Ask me why I haven't verified."*

On a platform where trusted members wear badges, opting out becomes visible. People prefer trusted members. This is social gravity, not coercion — and it's what makes the system self-reinforcing.

---

## Privacy Is a First-Class Feature

Members control three layers from their own dashboard:

| Switch | Effect |
|--------|--------|
| **Identity on/off** | Whether their TruAnon profile is linked at all |
| **Persona / contact / social links** | Which linked profiles are visible (GitHub, LinkedIn, etc.) |
| **Private mode** | Removes URL links entirely — data shows, but nothing is clickable or stalkable |

**Example:** A dating platform can display a member's verified age range, location area, and trust score — without exposing their LinkedIn or GitHub URL. The member is meaningfully known without being findable. This is a meaningful improvement over what most platforms can offer today.

---

## The Economics Make Fraud Structurally Expensive

- **First 1,000 verifications are free**
- After that: approximately **$0.04 per verification**

If you get a bill for a few dollars, it means your platform is growing and trust is working. More importantly: fraudsters can't fake a high rank anchored across a dozen real platforms. They move to less trusted places. Your platform's quality improves passively, as a side effect of your members' integrity.

---

## The API Is Simpler Than You Think

Nearly all of the time, integration is a single GET request:

```
GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
Authorization: [YOUR_PRIVATE_KEY]
```

That's it. Fetch, display. The badge renders. The trust layer is live.

The second endpoint — generating a token for first-time verification — is called **once per user, ever**. After that, it's always `get_profile`.

---

## Route 1: Get User Profile

Call this on every profile page render. It's a fast GET — treat it like fetching an avatar URL.

```javascript
app.get('/users/:username', async (req, res) => {
    const { username } = req.params;
    const profileUrl = `${apiRoute}get_profile?id=${username}&service=${serviceName}`;

    fetch(profileUrl, { headers: { Authorization: privateKey } })
        .then(response => response.json())
        .then(profileData => {
            res.render('profile', { user, verifiedDetails: profileData });
        })
        .catch(error => res.status(500).send('Failed to fetch user profile'));
});
```

**Returns:** Author Rank, Verification Status, Profile & Badge Data, and Verified Properties (social links, affiliations — only what the member has made visible).

The Author Rank can optionally be cached to retain the last known verified state between fetches.

---

## Route 2: Get User Token (First-Time Onboarding Only)

If `get_profile` returns an unknown user **and** they're on their edit page, generate a one-time token and show them a verification prompt. This is the onboarding moment. After they complete it once, you never call this again.

```javascript
app.get('/users/:username/token', async (req, res) => {
    const { username } = req.params;
    const tokenURL = `${apiRoute}get_token?id=${username}&service=${serviceName}`;

    fetch(tokenURL, { headers: { Authorization: privateKey } })
        .then(response => response.json())
        .then(data => res.json({ token: data.id }))
        .catch(error => res.status(500).json({ error: "Failed to fetch token" }));
});
```

---

## Opening the Verification UI

Once you have a token, build a verification URL:

```
https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]
```

Open it in a **popup** or **Bootstrap modal iframe**. The member completes verification inside TruAnon's UI. An optional `callback` URL lets your page refresh automatically when they're done.

### Simple Popup Button
```html
<a href="https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]"
   target="ta-popup"
   onclick="openVerificationPopup(this.href)"
   class="btn btn-primary">
   Confirm Ownership
</a>
```

### Bootstrap Modal (Recommended)
```html
<div class="modal fade" id="verificationModal" tabindex="-1" aria-hidden="true">
   <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
      <div class="modal-content">
         <div class="modal-header">
            <h5 class="modal-title">Verify Profile</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
         </div>
         <div class="modal-body" style="height: 840px; padding: 0;">
            <iframe id="verificationIframe" src="" frameborder="0"
                    style="width: 100%; height: 100%;"></iframe>
         </div>
      </div>
   </div>
</div>

<script>
function openVerificationPopup(url) {
    document.getElementById('verificationIframe').src = url;
    new bootstrap.Modal(document.getElementById('verificationModal')).show();
}
</script>
```

---

## The Edit Page: Putting It Together

The edit page is where identity lives in your UI. Check status, show the badge if verified, show the verify button if not.

```javascript
app.get('/users/:username/edit', async (req, res) => {
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) return res.status(500).send(err.message);
        if (!user) return res.status(404).send('User not found');

        const { truanonProfileLink, verifyLink } = await fetchTruAnonData(user.username);
        const displayData = app.locals.getUserDisplayData(user);

        res.render('edit', {
            user: { ...user, truanon_profile_link: truanonProfileLink, verify_link: verifyLink },
            rank: displayData.authoRank
        });
    });
});
```

### UI Pattern (EJS)
```ejs
<label class="form-label">Ownership:</label>
<div class="input-group">
   <% if (user.truanon_profile_link) { %>
      <input type="text" class="form-control text-muted" value="Securely Assigned" readonly />
      <a class="btn btn-primary rounded-end" href="https://<%= user.truanon_profile_link %>" target="_blank">
         View Profile
      </a>
   <% } else { %>
      <input type="text" class="form-control text-muted" value="Securely Assign Ownership" readonly />
      <a id="verify-link" href="#" class="btn btn-primary"
         onClick="openVerificationPopup('<%= user.verify_link %>')">Verify</a>
   <% } %>
</div>
```

---

## Recommended Edit Page Switches

Give members control with three clear settings:

```
[ ] Link my TruAnon identity to this profile       ← master switch
    [ ] Show my persona, contact & social links    ← visibility switch  
    [ ] Private mode (hide URLs, show data only)   ← stalking protection
```

---

## What You Get Once a Member Verifies

TruAnon grants your service access to:

- **Identity Link** — their canonical TruAnon profile
- **Trust Rank & Score** — always current, always real-time
- **Verified Properties** — social links, affiliations, and more (governed by member privacy settings)

Use these to:
- Display badges and trust scores on profiles and in feeds
- Gate features or communities by rank
- Filter or sort members by trust level
- Cache the last known rank for display continuity between fetches

---

## Quick Integration Checklist

- [ ] Register your service at truanon.com — get your `PRIVATE_KEY` and `SERVICE_NAME`
- [ ] Call `get_profile` on every profile page render
- [ ] Display rank + score + color (not just a checkmark)
- [ ] Show *"Ask me why I haven't verified"* for members without a badge
- [ ] On the edit page: if unknown, call `get_token` and show the verify button or modal
- [ ] Add three privacy switches to the edit UI
- [ ] Never expose your private key client-side
- [ ] Optionally cache the last known rank for display continuity

---

## About TruAnon

TruAnon makes verified identity available to everyone — not just those who can afford institutional verification, and not just the platforms big enough to build it themselves. Credibility is equally available to anyone willing to show up as themselves.

Anchoring to the links and profiles others already know you by is a benefit that makes avoiding it conspicuous. You don't avoid a safety rope on a journey where trust matters.

[truanon.com](https://truanon.com) · [Example Public Profile](https://truanon.com/p/jtayler)
