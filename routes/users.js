const express = require('express');
const router = express.Router();

router.get('/:username', (req, res) => {
  const { username } = req.params;
  res.render('profile', { username });
});

router.get('/:username/edit', (req, res) => {
  const { username } = req.params;
  res.render('edit', { username });
});

router.post('/:username/edit', (req, res) => {
  // Logic to handle profile editing
  res.redirect(`/users/${req.params.username}`);
});

module.exports = router;

