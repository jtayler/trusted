# The Age-Restricted Internet

This is a demonstration of inherently safe identity APIs from TruAnon.

[Visit Demo Site](https://devhauz.truanon.com)  
[Watch Demo Video](https://vimeo.com/1049232204)  
[View Presentation](https://docs.google.com/presentation/d/1MBaGqDw_L_bgJ3y3c-qqSjzDbDutanBYfkpb75pr2pI/present)

This demonstration highlights three key value propositions:

1. A **Service** is private when the **Owner** decides it should not be displayed.  
2. **Data** is private when a **Publishing Service** decides it shall be governed as such.  
3. **Consuming Services** (like this demo) onboard immediately, granting privileged access in response to changes in real-time.  

**Owner** updates to privacy and **Service** updates to access take effect immediately.

---

## API Usage

TruAnon APIs use **GET requests** to interact with verified identity data.  
The main **get_profile** endpoint retrieves a user’s verified details:

```
GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
```

The response contains:
- **Author Rank** (trust level)
- **Verification Status**
- **Profile & Badge Data**

This information can be used for **displaying badges, unlocking features, or access control**.  
It is **granted by the user** when the account owner enables verification.

---

## Route 1: Get User Profile

This route fetches a user’s profile if their **verified identity switch is ON**.

### How it works:
1. The route extracts `username` from the request.
2. If `switch_state = true`, it makes a request to:
   ```
   GET https://truanon.com/api/get_profile?id=[USERNAME]&service=[SERVICENAME]
   ```
3. The **Author Rank** can be stored to retain the last known verified state.

Example usage in `app.js`:
```javascript
app.get('/users/:username', async (req, res) => {
    const { username } = req.params;
    const profileUrl = `${apiRoute}get_profile?id=${username}&service=${serviceName}`;

    const tokenOptions = { headers: { Authorization: privateKey } };
    
    fetch(profileUrl, tokenOptions)
        .then(response => response.json())
        .then(profileData => {
            res.render('profile', { user, verifiedDetails: profileData });
        })
        .catch(error => res.status(500).send('Failed to fetch user profile'));
});
```
---

## Route 2: Get User Token

If a user is **Unknown**, an expiring **one-time-use token** must be generated to verify them.

### How it works:
1. Extract `username` from the request.
2. Call the **get_token** endpoint:
   ```
   GET https://truanon.com/api/get_token?id=[USERNAME]&service=[SERVICENAME]
   ```
3. Use the ID token to create a **secure verification link**.

Example usage in `app.js`:
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

## Using the Token for Verification

Once a token is generated, a public **verification link** can be created:

```
https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]
```

This link supports an optional **callback URL**, allowing the page to refresh or redirect once verification is complete.

### Example **Simple Popup Verification** Button:
```html
<a href="https://truanon.com/api/verifyProfile?id=[USERNAME]&service=[SERVICENAME]&token=[TOKEN]" 
   target="ta-popup" 
   onclick="openVerificationPopup(this.href)"
   class="btn btn-primary">
   Confirm Ownership
</a>
```
This opens a public **popup window** where the user can confirm ownership. This link automatically handles authentication on public computers or whatever situation.

### Bootstrap **Modal Panel** Integration:
Instead of a popup, a far more controlled Bootstrap modal can be used:
```html
<!-- Verification Modal -->
<div class="modal fade" id="verificationModal" tabindex="-1" aria-labelledby="verificationModalLabel" aria-hidden="true">
   <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
      <div class="modal-content">
         <div class="modal-header">
            <h5 class="modal-title" id="verificationModalLabel">Verify Profile</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
         </div>
         <div class="modal-body" style="height: 840px; padding: 0;">
            <iframe id="verificationIframe" src="" frameborder="0" style="width: 100%; height: 100%;"></iframe>
         </div>
      </div>
   </div>
</div>

<script>
function openVerificationPopup(url) {
    document.getElementById('verificationIframe').src = url;
    var verificationModal = new bootstrap.Modal(document.getElementById('verificationModal'));
    verificationModal.show();
}
</script>
```

---

## Handling Verification in the Edit Page

### **Fetching Data in Edit Mode**
1. **Always check** the user’s verification status when editing.
2. If **Unknown**, fetch a **new token** and return the verification UI.
3. **If verified**, send down the profile link instead.

Example:
```javascript
app.get('/users/:username/edit', async (req, res) => {
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) return res.status(500).send(err.message);
        if (!user) return res.status(404).send('User not found');

        console.log("Rendering edit page for:", user.username);
        const { truanonProfileLink, verifyLink } = await fetchTruAnonData(user.username);
        const displayData = app.locals.getUserDisplayData(user);

        res.render('edit', {
            user: {
                ...user,
                truanon_profile_link: truanonProfileLink,
                verify_link: verifyLink
            },
            rank: displayData.authoRank
        });
    });
});
```

---

## Verified Properties & Stored Data

Once a user is verified, **TruAnon grants the service**:
- **Identity Link**
- **Trust Rank**
- **Profile Details**
- **Verified Properties (social links, affiliations, etc.)**

These values can be:
- **Displayed as achievements** (trust badges, profile cards)
- **Used for gated content** (realtime feature access, community roles)
- **Cached confidence rank** *(optional: store last rank to cache colors or badges)*

Example UI Implementation in `edit.ejs`:
```ejs
<label class="form-label"> Ownership:</label>
<div class="input-group">
   <% if (user.truanon_profile_link) { %>
      <input type="text" class="form-control text-muted" value="Securely Assigned" readonly />
      <a class="btn btn-primary rounded-end" href="https://<%= user.truanon_profile_link %>" target="_blank">
         <%= user.truanon_profile_link %>
      </a>
   <% } else { %>
      <input type="text" class="form-control text-muted" value="Securely Assign Ownership" readonly />
      <a id="verify-link" href="#" class="btn btn-primary"
         onClick="openVerificationPopup('<%= user.verify_link %>')">Verify</a>
   <% } %>
</div>
```

---

## Conclusion

This system ensures:
- **Real-time identity verification**
- **Secure ownership assignment**
- **Minimal friction for onboarding**

For further customization, the verification system can integrate into **feature unlocks, community access, and reputation tracking**.
