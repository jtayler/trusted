const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const ejs = require('ejs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const fs = require('fs');
const fetch = require('node-fetch');

// Create an Express app
const app = express();
const port = 3000;

require('dotenv').config();

const BITBUCKET_BASE_URL = "https://api.bitbucket.org/2.0";

const privateKey = process.env.TRUANON_API_KEY || "default-private-key";
const serviceName = process.env.SERVICE_NAME || "default-app"; // Default fallback
const apiRoute = process.env.API_ROUTE || "https://truanon.com/api/";

console.log(`TRUANON_API_KEY: ${process.env.TRUANON_API_KEY}`);
console.log(`SERVICE_NAME: ${process.env.SERVICE_NAME}`);
console.log(`API_ROUTE: ${process.env.API_ROUTE}`);


app.use(express.static('public'));

app.use(bodyParser.urlencoded({
    extended: false
}));
app.set('view engine', 'ejs');
app.use(
    session({
        secret: 'mysecretkey',
        resave: false,
        saveUninitialized: false,
    })
);
app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

const dbFilePath = './users.db';

if (!fs.existsSync(dbFilePath)) {
    console.log("Database does not exist. Creating a backup from users.db.bak...");
    
    // Copy the backup file to users.db
    fs.copyFile(dbFilePath + ".bak", dbFilePath, (err) => {
        if (err) {
            console.error("Error copying database file: " + err.message);
        } else {
            console.log("Database file copied successfully.");
        }
    });
}

app.locals.getPhotoBorderColor = function(rank) {
    switch (rank) {
        case 'Dangerous': return 'danger';
        case 'Cautioned': return 'warning';
        case 'Credible': return 'secondary';
        case 'Reliable': return 'success';
        case 'Genuine': return 'primary';
        default: return 'light'; // Default color for unknown/unverified users
    }
};

app.locals.getUserDisplayData = (user) => {
    const isSwitchOn = user.switch_state === "on";
    const validAuthorPhoto = user.authorPhoto && user.authorPhoto !== "https://s3.amazonaws.com/truanon/nophoto.png";

    const displayPhoto = (isSwitchOn && validAuthorPhoto) 
        ? user.authorPhoto 
        : user.photo || 'https://truanon.s3.amazonaws.com/img/1597072428129.jpeg'; // Fallback

    const displayRank = isSwitchOn ? user.authorRank : "Unverified";

    return {
        photo: displayPhoto,
        authoRank: displayRank,
        borderColor: app.locals.getPhotoBorderColor(displayRank),
    };
};

const bitbucketUsername = 'jtayler1'; // Replace with your Bitbucket username

// Endpoint to fetch Bitbucket data
app.get('/users/:username/bitbucket', async (req, res) => {
    const { username } = req.params;
    const bitbucketToken = process.env.BITBUCKET_TOKEN;
    const truAnonApiKey = process.env.TRUANON_API_KEY;
    const serviceName = process.env.SERVICE_NAME;
    const profileApiUrl = `${process.env.API_ROUTE}get_profile?id=${username}&service=${serviceName}`;
    const BITBUCKET_BASE_URL = process.env.BITBUCKET_BASE_URL || 'https://api.bitbucket.org/2.0';

    try {
        // Fetch TruAnon profile
        const profileResponse = await fetch(profileApiUrl, {
            headers: {
                Authorization: truAnonApiKey,
                Accept: 'application/json',
            },
        });

        if (!profileResponse.ok) {
            console.error(`Error fetching TruAnon profile: ${profileResponse.statusText}`);
            return res.status(profileResponse.status).send(`Error: ${profileResponse.statusText}`);
        }

        const profileData = await profileResponse.json();
        const bitbucketConfig = profileData.dataConfigurations.find(config => config.dataPointType === 'bitbucket');
        //const bitbucketUsername = bitbucketConfig?.displayValue.split('/').pop();


console.log('Fetching profile from TruAnon...');
console.log('Profile data:', profileData);
console.log('Bitbucket username:', bitbucketUsername);

        if (!bitbucketUsername) {
            console.warn('Bitbucket username not found in profile data');
            return res.status(404).send('Bitbucket username not found in profile data');
        }

        // Bitbucket API URLs
        const BITBUCKET_USER_API_URL = `${BITBUCKET_BASE_URL}/users/${bitbucketUsername}`;
        const BITBUCKET_REPOS_API_URL = `${BITBUCKET_BASE_URL}/repositories/${bitbucketUsername}`;

        // Fetch Bitbucket profile information
        const [bitbucketProfileResponse, reposResponse] = await Promise.all([
            fetch(BITBUCKET_USER_API_URL, {
                headers: {
                    Authorization: `Bearer ${bitbucketToken}`,
                    Accept: 'application/json',
                },
            }),
            fetch(BITBUCKET_REPOS_API_URL, {
                headers: {
                    Authorization: `Bearer ${bitbucketToken}`,
                    Accept: 'application/json',
                },
            }),
        ]);

        if (!bitbucketProfileResponse.ok) {
            console.error(`Error fetching Bitbucket profile: ${bitbucketProfileResponse.statusText}`);
            return res.status(bitbucketProfileResponse.status).send(`Error: ${bitbucketProfileResponse.statusText}`);
        }

        if (!reposResponse.ok) {
            console.error(`Error fetching Bitbucket repositories: ${reposResponse.statusText}`);
            return res.status(reposResponse.status).send(`Error: ${reposResponse.statusText}`);
        }

        const bitbucketProfile = await bitbucketProfileResponse.json();
        const repos = await reposResponse.json();

        // Format data
        const repoData = repos.values.map(repo => ({
            name: repo.name,
            description: repo.description || 'No description available',
            isPrivate: repo.is_private,
        }));

        const formattedData = {
            displayName: bitbucketProfile.display_name || 'No name available',
            totalRepos: repoData.length,
            repos: repoData,
        };

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching Bitbucket data:', error);
        res.status(500).send('Error fetching Bitbucket data');
    }
});

// Fetch GitHub info based on validated username
app.get('/users/:username/github', async (req, res) => {
    const { username } = req.params;
    const token = process.env.GITHUB_TOKEN;
    const truAnonApiKey = process.env.TRUANON_API_KEY;
    const serviceName = process.env.SERVICE_NAME;
    const profileApiUrl = `${process.env.API_ROUTE}get_profile?id=${username}&service=${serviceName}`;

    try {
        // Fetch TruAnon profile
        const profileResponse = await fetch(profileApiUrl, {
            headers: {
                Authorization: truAnonApiKey,
                Accept: 'application/json',
            },
        });

        if (!profileResponse.ok) {
            return res.status(profileResponse.status).send(`Error: ${profileResponse.statusText}`);
        }

        const profileData = await profileResponse.json();

        // Extract GitHub username from profileData
        const githubConfig = profileData.dataConfigurations.find(config => config.dataPointType === 'github');
        const githubUsername = githubConfig ? githubConfig.displayValue.split('/').pop() : null;

        if (!githubUsername) {
            return res.status(404).send('GitHub username not found in profile data');
        }

        if (githubConfig.displayValue.startsWith('Privately Verified')) {
            console.log('Skipping GitHub fetch for privately verified username:', githubConfig.displayValue);

            // Send a custom response to indicate "Privately Verified"
            return res.json({
                status: 'private',
                message: 'GitHub fetching is not allowed for privately verified accounts',
            });
        }
        // GitHub API URLs
        const REPOS_API_URL = `https://api.github.com/users/${githubUsername}/repos`;
        const GITHUB_PROFILE_API_URL = `https://api.github.com/users/${githubUsername}`;

        // Fetch GitHub profile information
        const githubProfileResponse = await fetch(GITHUB_PROFILE_API_URL, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!githubProfileResponse.ok) {
            return res.status(githubProfileResponse.status).send(`Error: ${githubProfileResponse.statusText}`);
        }

        const githubProfile = await githubProfileResponse.json();

        // Fetch repositories
        const reposResponse = await fetch(REPOS_API_URL, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        });

        if (!reposResponse.ok) {
            return res.status(reposResponse.status).send(`Error: ${reposResponse.statusText}`);
        }

        const repos = await reposResponse.json();

        // Fetch languages for each repository
        const repoData = await Promise.all(
            repos.map(async repo => {
                const languagesResponse = await fetch(repo.languages_url, {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                });

                const languages = await languagesResponse.json();
                return {
                    name: repo.name,
                    description: repo.description || 'No description available',
                    languages: Object.keys(languages).join(', '),
                };
            })
        );

        // Format data
        const formattedData = {
            fullName: githubProfile.name || 'No name available',
            totalRepos: repoData.length,
            repos: repoData,
        };

        console.log("Fetched GitHub data:", formattedData);

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching GitHub data:', error);
        res.status(500).send('Error fetching GitHub data');
    }
});



// Connect to the database
const db = new sqlite3.Database(dbFilePath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});
// Fetch the last five users and set the session variable on app startup
db.all('SELECT username FROM users ORDER BY id DESC LIMIT 5', [], (err, rows) => {
  if (err) {
    console.error(err.message);
  }
  const lastFiveUsers = rows.map(row => row.username);
  app.locals.lastFiveUsers = lastFiveUsers;
});

// Handle HTTP requests
// Handle logout request
app.get('/logout', (req, res) => {
  // Clear the session user
  req.session.user = null;

  // Redirect to the login page
  res.redirect('/login');
});

app.get('/', (req, res) => {
    res.redirect('/home');
});
module.exports = app;
app.get('/home', (req, res) => {
    res.render('home');
    //res.render('login');
});
app.get('/login', (req, res) => {
    res.render('login', { lastFiveUsers: req.app.locals.lastFiveUsers });
    //res.render('login');
});
app.get('/signup', (req, res) => {
    //res.render('signup');
    res.render('signup', { lastFiveUsers: req.app.locals.lastFiveUsers });

});
app.post('/signup', (req, res) => {
  const {
    username,
    full_name,
    location,
    password
  } = req.body;
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).send(err.message);
    }

    // Generate a random integer between 1 and 8 (inclusive)
    const randomAvatarNumber = Math.floor(Math.random() * 8) + 1;

    // Construct the URL with the random number
    const photo = `https://bootdey.com/img/Content/avatar/avatar${randomAvatarNumber}.png`;

    db.run(
      'INSERT INTO users (username, full_name, location, photo, password) VALUES (?, ?, ?, ?, ?)',
      [username, full_name, location, photo, hash],
      (err) => {
        if (err) {
          return res.status(500).send(err.message);
        }
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
          if (err) {
            return res.status(500).send(err.message);
          }
          if (!user) {
            return res.status(400).send('Invalid username or password');
          }
          bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
              return res.status(500).send(err.message);
            }
            if (!result) {
              return res.status(400).send('Invalid username or password');
            }
            req.session.userId = user.id;
            req.session.user = user;
            res.redirect(`/users/${username}`);
          });
        });
      }
    );
  });
});
app.post('/login', (req, res) => {
    const {
        username,
        password
    } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!user) {
            return res.status(400).send('Invalid username or password');
        }
        console.log('user is');
        console.log(user);

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            if (!result) {
                return res.status(400).send('Invalid username or password');
            }
            req.session.userId = user.id;
            req.session.user = user;
            res.redirect(`/users/${username}`);
        });
    });
});


app.get('/users/:username', (req, res) => {
    const { username } = req.params;
    const userId = req.session.userId;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!user) {
            return res.status(404).send('User not found');
        }

        const isCurrentUser = userId === user.id;

        // Check if user's switch_state is ON
        if (user.switch_state) {
            const profileUrl = `${apiRoute}get_profile?id=${username}&service=${serviceName}`;
            console.log(`Fetch Profile URL: ${profileUrl}`);
            const tokenOptions = {
                headers: {
                    Authorization: privateKey,
                },
            };

        fetch(profileUrl, tokenOptions)
            .then(response => response.json())
            .then(profileData => {
                const authorPhoto = profileData.authorPhoto;
                const validPhoto = authorPhoto && authorPhoto !== "https://s3.amazonaws.com/truanon/nophoto.png" && authorPhoto.trim() !== "";
                const authorRank = profileData.authorRank || "Unverified";

                // If the photo is valid, update it. Otherwise, keep the existing authorPhoto in the database.
                const updatedPhoto = validPhoto ? authorPhoto : user.authorPhoto;

                db.run(
                    'UPDATE users SET authorPhoto = ?, authorRank = ? WHERE username = ?',
                    [updatedPhoto, authorRank, username],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating user:', updateErr);
                        } else {
                            console.log(`Updated ${username} with authorPhoto: ${validPhoto ? authorPhoto : "Unchanged"}, authorRank: ${authorRank}`);
                        }
                    }
                );

                res.render('profile', {
                    user: { 
                        ...user, 
                        authorPhoto: updatedPhoto, 
                        authorRank 
                    }, // Pass updated data to the view
                    isCurrentUser,
                    verifiedDetails: JSON.stringify(profileData),
                    lastFiveUsers: req.app.locals.lastFiveUsers,
                });
            })
            .catch(error => {
                console.error("Error fetching verified profile:", error);
                res.status(500).send('Failed to fetch user profile');
            });
                } else {
                    // User's switch_state is not ON, render with default data
                    res.render('profile', {
                        user,
                        isCurrentUser,
                        verifiedDetails: '[]',
                        lastFiveUsers: req.app.locals.lastFiveUsers,
                    });
                }
            });
        });

// Define endpoint to handle the edit page and return appropriate UI elements
app.get('/users/:username/verify_status', async (req, res) => {
    const { username } = req.params;
    const profileURL = `${apiRoute}get_profile?id=${username}&service=${serviceName}`;
    const tokenURL = `${apiRoute}get_token?id=${username}&service=${serviceName}`;

    const options = {
        headers: {
            Authorization: privateKey,
        },
    };

    try {
        // Fetch profile data to check if user is verified
        const profileResponse = await fetch(profileURL, options);
        const profileData = await profileResponse.json();

        if (!profileData || profileData.type === "error" || profileData.status === "Unknown") {
            // If profile is unknown, fetch a new token and return for verification UI
            const tokenResponse = await fetch(tokenURL, options);
            const tokenData = await tokenResponse.json();

            // Return UI elements for unverified users
            return res.json({
                status: "Unknown",
                ui: `
                <input type="text" class="form-control text-muted" value="Assign Ownership" readonly />
                <a class="btn btn-primary rounded-end" href="#" 
                onClick="openVerificationPopup('${apiRoute}verifyProfile?id=${username}&service=${serviceName}&token=${tokenData.id}')" 
                id="verify-link">Verify</a>
                `
            });
        }

        // Extract the TruAnon profile link from dataConfigurations
        const profileLink = profileData.dataConfigurations.find(config => config.dataPointType === 'truanon')?.displayValue || '#';

        // Return UI elements for verified users
        return res.json({
            status: profileData.authorRank,
            ui: `
                <input type="text" class="form-control text-muted" value="Securely Assigned" readonly />
                <a class="btn btn-primary rounded-end" href="${profileLink}" target="_blank">View Profile</a>
            `
        });

    } catch (error) {
        console.error("Error fetching verification status:", error);
        res.status(500).json({ error: "Failed to fetch verification status" });
    }
});

// Define endpoint to get token
app.get('/users/:username/token', (req, res) => {
    const { username } = req.params;
    const tokenURL = `${apiRoute}get_token?id=${username}&service=${serviceName}`;
    console.log(`Token URL: ${tokenURL}`);

    const options = {
        headers: {
            Authorization: privateKey,
        },
    };

    fetch(tokenURL, options)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched data:", data);  // Log entire data object

            // Correctly get the token from `data.id`
            const { id } = data;
            console.log("use token:", id);

            // Send JSON response with the token
            res.json({ id });
        })
        .catch(error => {
            console.error("Error fetching token:", error);
            res.status(500).json({ error: "Failed to fetch token" });
        });
});

// Handle edit user form submission
async function fetchTruAnonData(username) {
    const profileURL = `${apiRoute}get_profile?id=${username}&service=${serviceName}`;
    const options = { headers: { Authorization: privateKey } };

    console.log("Calling profile API:", profileURL);

    // Fetch profile data from TruAnon
    const profileResponse = await fetch(profileURL, options);
    const profileData = await profileResponse.json();

    console.log("Profile API Response:", profileData);

    if (profileData && profileData.type !== 'error') {
        console.log("User is verified, fetching profile link...");
        const profileLink = profileData.dataConfigurations.find(config => config.dataPointType === 'truanon')?.displayValue || null;
        return { truanonProfileLink: profileLink, verifyLink: null };
    } else {
        console.log("User is not verified, fetching verification token...");
        const tokenResponse = await fetch(`${apiRoute}get_token?id=${username}&service=${serviceName}`, options);
        const tokenData = await tokenResponse.json();

        console.log("Token API Response:", tokenData);

        const verifyLink = `${apiRoute}verifyProfile?id=${username}&service=${serviceName}&token=${tokenData.id}`;
        return { truanonProfileLink: null, verifyLink: verifyLink };
    }
}

// GET route to render the profile edit page
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

app.post('/users/:username/edit', async (req, res) => {
    const { full_name, location, photo, switch_state } = req.body;
    const { username } = req.params;

    try {
        console.log("Received request to edit profile for:", username);
        console.log("Form Data:", { full_name, location, photo, switch_state });

        // Update user data in the database
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET full_name = ?, location = ?, photo = ?, switch_state = ? WHERE username = ?',
                [full_name, location, photo, switch_state, username],
                (err) => (err ? reject(err) : resolve())
            );
        });

        // Fetch updated user data
        const updatedUser = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
                if (err) return reject(err);
                resolve(user);
            });
        });

        // Update session user if editing their own profile
        if (req.session.user.username === username) {
            req.session.user = updatedUser;
        }

        console.log("User profile updated successfully for:", username);

        // Redirect back to the user's profile page
        res.redirect(`/users/${username}`);

    } catch (error) {
        console.error("Error updating profile or fetching verification data:", error);
        res.status(500).send("An error occurred while updating the profile.");
    }
});


app.get('/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      return res.status(500).send(err.message);
    }
    res.render('userList', { users: rows });
  });
});

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});
