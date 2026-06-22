var express = require('express');
var path = require('path');
var session = require('express-session');
var MongoStore = require('connect-mongo').MongoStore;

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.ATLAS_URI,
    dbName: 'fitplanner'
  })
}));

// make session user available in all EJS templates
app.use(function (req, res, next) {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

// 404 handler
app.use(function (req, res) {
  res.status(404).render('signin', { title: 'Page Not Found', error: 'Page not found' });
});

// error handler
app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).render('signin', { title: 'Error', error: 'Something went wrong' });
});

module.exports = app;
