const express = require('express');
const router = express.Router();

// GET login page
router.get('/login', (req, res) => {
  res.render('login');
});

// POST login page
router.post('/login', (req, res) => {
  // TODO: implement login logic here
  res.redirect('/users/' + req.body.username);
});

module.exports = router;
