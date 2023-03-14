const express = require('express');
const router = express.Router();
const usersRouter = require('./users');
const passport = require('passport');

router.get('/', (req, res) => {
  res.render('home');
});

router.get('/signup', (req, res) => {
  res.render('signup');
});

router.post('/signup', (req, res) => {
  // Logic to handle signup
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.get('/profile', (req, res) => {
  res.render('profile', { user: req.user });
});

router.post('/login', passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res) {
  // If authentication succeeds, Passport will add the authenticated user to `req.user`.
  // You can use this information to redirect the user to their profile page.
  res.redirect('/users/' + req.user.username);
});

router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

router.use('/users', usersRouter);

module.exports = router;

