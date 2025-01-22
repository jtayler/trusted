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
        rank: displayRank,
        borderColor: app.locals.getPhotoBorderColor(displayRank),
    };
};

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

        // console.log("Fetched GitHub data:", formattedData);

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
            console.log("Fetched data:", data); // Log the entire returned data

            const { id: token } = data; // Destructure the token ID
            res.json({ token }); // Return the token as JSON
        })
        .catch(error => {
            console.error("Error fetching token:", error); // Log errors if any
            res.status(500).json({ error: "Failed to fetch token" });
        });
});

// Handle edit user form submission
app.post('/users/:username/edit', (req, res) => {
    const {
        full_name,
        location,
        photo,
        switch_state
    } = req.body;
    const {
        username
    } = req.params;

    // Update user in the database
    db.run(
        'UPDATE users SET full_name = ?, location = ?, photo = ?, switch_state = ? WHERE username = ?',
        [full_name, location, photo, switch_state, username],
        (err) => {
            if (err) {
                return res.status(500).send(err.message);
            }

            // Fetch updated user data
            db.get('SELECT * FROM users WHERE username = ?', [username], (err, updatedUser) => {
                if (err) {
                    return res.status(500).send(err.message);
                }

                // Update session user if the logged-in user is editing their own profile
                if (req.session.user.username === username) {
                    req.session.user = updatedUser;
                }

                // Redirect back to the user's profile
                res.redirect(`/users/${username}`);
            });
        }
    );
});
app.get('/users/:username/edit', (req, res) => {
    const userId = req.session.userId;
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).send(err.message);
        }
        if (!user) {
            return res.status(404).send('User not found');
        }
        var verified = true; // replace with your logic to determine if verified is true or false
        res.render('edit', {
            user: user,
            verified: verified
        });
    });
});
app.post('/users/:username/edit', (req, res) => {
    const {
        full_name,
        location,
        photo,
        switch_state
    } = req.body;
    const username = req.params.username;
    db.run(
        'UPDATE users SET full_name = ?, location = ?, switch_state = ?, photo = ? WHERE username = ?',
        [full_name, location, switch_state, photo, username],
        (err) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.redirect(`/users/${username}`);
        }
    );
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
