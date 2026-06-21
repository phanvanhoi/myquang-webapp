const express = require('express');
const router = express.Router();
const intro = require('../lib/intro-page');

router.get('/', (req, res) => {
  res.render('public/intro.html', { intro });
});

module.exports = router;
