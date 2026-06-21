var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var { getCollection, isConnected } = require('../model/db');
var { ObjectId } = require('mongodb');

// POST /users/signup/submit
router.post('/signup/submit', async function (req, res) {
  try {
    if (!isConnected()) {
      return res.render('signup', { title: 'Sign Up', error: 'Database not available. Please try again later.' });
    }

    var { name, email, password } = req.body;
    var usersCol = getCollection('users');

    // check for duplicate email
    var existing = await usersCol.findOne({ email: email });
    if (existing) {
      return res.render('signup', { title: 'Sign Up', error: 'Email already registered' });
    }

    // hash password
    var hashedPassword = await bcrypt.hash(password, 10);

    // save user
    await usersCol.insertOne({
      name: name,
      email: email,
      password: hashedPassword,
      createdAt: new Date()
    });

    res.redirect('/signin');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', { title: 'Sign Up', error: 'Signup failed. Please try again.' });
  }
});

// POST /users/signin/submit
router.post('/signin/submit', async function (req, res) {
  try {
    if (!isConnected()) {
      return res.render('signin', { title: 'Sign In', error: 'Database not available. Please try again later.' });
    }

    var { email, password } = req.body;
    var usersCol = getCollection('users');

    // find user by email
    var user = await usersCol.findOne({ email: email });
    if (!user) {
      return res.render('signin', { title: 'Sign In', error: 'Invalid email or password' });
    }

    // compare password
    var match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('signin', { title: 'Sign In', error: 'Invalid email or password' });
    }

    // set session
    req.session.user = {
      id: user._id,
      name: user.name
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Signin error:', err);
    res.render('signin', { title: 'Sign In', error: 'Signin failed. Please try again.' });
  }
});

// GET /users/signout
router.get('/signout', function (req, res) {
  req.session.destroy();
  res.redirect('/signin');
});

// POST /users/plan/generate
router.post('/plan/generate', async function (req, res) {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    var { type, goal, preferences } = req.body;

    var prompt = '';
    if (type === 'meal') {
      prompt = 'You are a professional nutritionist. Create a detailed daily meal plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '. Include breakfast, lunch, dinner, and 2 snacks. For each meal provide the name, ingredients, brief instructions, and estimated calories. Format your response in clean readable text with clear sections.';
    } else {
      prompt = 'You are a professional fitness trainer. Create a detailed daily workout plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '. Include warm-up, main exercises (with sets, reps, and rest time), and cool-down. Format your response in clean readable text with clear sections.';
    }

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    var data = await response.json();
    var generatedPlan = data.choices[0].message.content;

    // save plan to MongoDB (skip if DB not available)
    if (!isConnected()) {
      return res.json({
        success: true,
        plan: {
          _id: null,
          type: type,
          goal: goal,
          preferences: preferences || '',
          generatedPlan: generatedPlan,
          createdAt: new Date()
        }
      });
    }

    var plansCol = getCollection('plans');
    var insertResult = await plansCol.insertOne({
      userId: req.session.user.id,
      type: type,
      goal: goal,
      preferences: preferences || '',
      generatedPlan: generatedPlan,
      createdAt: new Date()
    });

    res.json({
      success: true,
      plan: {
        _id: insertResult.insertedId,
        type: type,
        goal: goal,
        preferences: preferences || '',
        generatedPlan: generatedPlan,
        createdAt: new Date()
      }
    });
  } catch (err) {
    console.error('=== PLAN GENERATION ERROR ===');
    console.error('Error message:', err.message);
    console.error('Error name:', err.name);
    if (err.status) console.error('HTTP status:', err.status);
    if (err.statusText) console.error('Status text:', err.statusText);
    if (err.errorDetails) console.error('Error details:', JSON.stringify(err.errorDetails, null, 2));
    console.error('Full error:', err);
    console.error('=== END ERROR ===');
    res.status(500).json({ error: 'Failed to generate plan: ' + err.message });
  }
});

// GET /users/plan/history
router.get('/plan/history', async function (req, res) {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    if (!isConnected()) {
      return res.json({ success: true, plans: [] });
    }

    var plansCol = getCollection('plans');
    var plans = await plansCol
      .find({ userId: req.session.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, plans: plans });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// DELETE /users/plan/:id
router.delete('/plan/:id', async function (req, res) {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    if (!isConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    var plansCol = getCollection('plans');
    await plansCol.deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.session.user.id
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

module.exports = router;
