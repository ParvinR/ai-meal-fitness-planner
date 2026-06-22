var express = require('express');
var router = express.Router();

// GET / → redirect to signin
router.get('/', function (req, res) {
  res.redirect('/signin');
});

// GET /signin → render signin page
router.get('/signin', function (req, res) {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('signin', { title: 'Sign In', error: null });
});

// GET /signup → render signup page
router.get('/signup', function (req, res) {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('signup', { title: 'Sign Up', error: null });
});

// GET /dashboard → render dashboard (protected)
router.get('/dashboard', function (req, res) {
  if (!req.session.user) {
    return res.redirect('/signin');
  }
  res.render('dashboard', { title: 'Dashboard', user: req.session.user });
});

// GET /profile → render profile page (protected)
router.get('/profile', function (req, res) {
  if (!req.session.user) return res.redirect('/signin');
  res.render('profile', { title: 'My Profile', user: req.session.user });
});

module.exports = router;
