const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const ejs = require('ejs');
const bcrypt = require('bcrypt');
const session = require('express-session');
// Create an Express app
const app = express();
const port = 3000;

const privateKey = process.env.PRIVATE_KEY;
const serviceName = process.env.SERVICE_NAME;
const apiRoute = process.env.API_ROUTE;

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
// Connect to the database
    console.log(process.env.SERVICE_NAME);
    console.log(process.env.PRIVATE_KEY);

const db = new sqlite3.Database('./users.db', sqlite3.OPEN_READWRITE, (err) => {
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
app.get('/', (req, res) => {
    res.redirect('/login');
});
module.exports = app;
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
    const {
        username
    } = req.params;
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
            const profileUrl = `https://truanon.com/api/get_profile?id=${username}&service=cryptoniteventures`;
            const tokenOptions = {
              headers: {
                Authorization: privateKey,
              },
            };

            fetch(profileUrl, tokenOptions)
                .then(response => response.json())
                .then(profileData => {
                    res.render('profile', {
                        user,
                        isCurrentUser,
                        verifiedDetails: JSON.stringify(profileData),
                        lastFiveUsers: req.app.locals.lastFiveUsers
                    });
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).send('Failed to fetch user profile');
                });
        } else {
            // User's switch_state is not ON, return the page with an empty verifiedDetails array
            res.render('profile', {
                user,
                isCurrentUser,
                verifiedDetails: '[]',
                lastFiveUsers: req.app.locals.lastFiveUsers
            });
        }
    });
});
// Define endpoint to get token
app.get('/users/:username/token', (req, res) => {
    const {
        username
    } = req.params;
    const url = `https://truanon.com/api/get_token?id=${username}&service=cryptoniteventures`;
    const options = {
        headers: {
            Authorization: privateKey,
        },
    };
    fetch(url, options)
        .then(response => response.json())
        .then(data => {
            const {
                id: token
            } = data;
            res.json({
                token
            });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Failed to generate token');
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
    db.run(
        'UPDATE users SET full_name = ?, location = ?, photo = ?, switch_state = ? WHERE username = ?',
        [full_name, location, photo, switch_state, username],
        (err) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            res.redirect(`/users/${username}`);
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
