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
    var result = await usersCol.insertOne({
      name: name,
      email: email,
      password: hashedPassword,
      createdAt: new Date()
    });

    // auto-login after signup and redirect to profile
    req.session.user = {
      id: result.insertedId,
      name: name
    };

    res.redirect('/profile');
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

    var profilesCol = getCollection('profiles');
    var profile = await profilesCol.findOne({ userId: req.session.user.id });
    var profileText = '';
    if (profile) {
      profileText = ' Personalize for: age ' + (profile.age || 'N/A') + ', weight ' + (profile.weight || 'N/A') + 'kg, height ' + (profile.height || 'N/A') + 'cm, sex ' + (profile.sex || 'N/A') + ', experience ' + (profile.experience || 'N/A') + ', activity level ' + (profile.activityLevel || 'N/A') + ', dietary type ' + (profile.dietaryType || 'none') + ', restrictions/injuries: ' + (profile.restrictions || 'none') + '.';
    }

    var prompt = '';
    if (type === 'meal') {
      prompt = 'You are a professional nutritionist. Create a detailed daily meal plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '.' + profileText + ' Include breakfast, lunch, dinner, and 2 snacks. For each meal provide the name, ingredients, brief instructions, and estimated calories. Format your response in clean readable text with clear sections.';
    } else {
      prompt = 'You are a professional fitness trainer. Create a detailed daily workout plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '.' + profileText + ' Include warm-up, main exercises (with sets, reps, and rest time), and cool-down. Format your response in clean readable text with clear sections.';
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
    if (!response.ok) {
      var errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service error. Please try again in a moment.' });
    }
    var data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected Groq response:', JSON.stringify(data));
      return res.status(502).json({ error: 'AI returned an unexpected response. Please try again.' });
    }
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

// PUT /users/plan/:id — update a saved plan
router.put('/plan/:id', async function (req, res) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    var { goal, preferences } = req.body;
    var plansCol = getCollection('plans');
    var existing = await plansCol.findOne({ _id: new ObjectId(req.params.id), userId: req.session.user.id });
    if (!existing) return res.status(404).json({ error: 'Plan not found' });

    var prompt = '';
    if (existing.type === 'meal') {
      prompt = 'You are a professional nutritionist. Create a detailed daily meal plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '. Include breakfast, lunch, dinner, and 2 snacks with ingredients, instructions, and estimated calories. Format in clean readable text with clear sections.';
    } else {
      prompt = 'You are a professional fitness trainer. Create a detailed daily workout plan for someone with the following goal: ' + goal + '. Preferences: ' + (preferences || 'none') + '. Include warm-up, main exercises with sets/reps/rest, and cool-down. Format in clean readable text with clear sections.';
    }

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }] })
    });
    if (!response.ok) {
      var errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return res.status(502).json({ error: 'AI service error. Please try again in a moment.' });
    }
    var data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected Groq response:', JSON.stringify(data));
      return res.status(502).json({ error: 'AI returned an unexpected response. Please try again.' });
    }
    var generatedPlan = data.choices[0].message.content;

    await plansCol.updateOne(
      { _id: new ObjectId(req.params.id), userId: req.session.user.id },
      { $set: { goal: goal, preferences: preferences || '', generatedPlan: generatedPlan, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// GET /users/profile
router.get('/profile', async function (req, res) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    var profilesCol = getCollection('profiles');
    var profile = await profilesCol.findOne({ userId: req.session.user.id });
    res.json({ success: true, profile: profile || null });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// POST /users/profile
router.post('/profile', async function (req, res) {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
    var { age, weight, height, sex, experience, activityLevel, dietaryType, restrictions } = req.body;
    var profilesCol = getCollection('profiles');
    await profilesCol.updateOne(
      { userId: req.session.user.id },
      { $set: { userId: req.session.user.id, age, weight, height, sex, experience, activityLevel, dietaryType, restrictions: restrictions || '', updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

module.exports = router;
