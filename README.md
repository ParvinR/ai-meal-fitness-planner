# AI Meal & Fitness Planner

A full-stack GenAI web app where users sign up, log in, and generate personalized AI meal and fitness plans. Plans are saved to a database and can be viewed or deleted.

## Features

- User registration with hashed passwords (bcryptjs)
- User login/logout with session-based authentication (express-session)
- Protected dashboard accessible only after login
- AI-generated meal and fitness plans based on user goals and preferences
- Full CRUD: create plans, read saved history, update plans, delete plans
- User profiles: on signup, users are prompted to enter biometric and training details (age, weight, height, sex, training experience, activity level, dietary type, and any restrictions/injuries). This is optional and can be filled in later or edited anytime from the My Profile page. These details are injected into the AI prompt so generated plans are personalized to the individual rather than generic.
- MongoDB-backed session store (connect-mongo)
- Responsive dark-purple themed UI

## How It Works

1. A user signs up and is automatically logged in, then prompted to fill out their profile (biometrics and training background). They can skip this and do it later.
2. The profile is saved to a separate `profiles` collection in MongoDB, linked to the user by `userId`.
3. When the user generates a meal or fitness plan, the app pulls their profile and injects it into the prompt sent to the Groq AI model. For example, instead of asking for a generic "build muscle" plan, the request includes the user's age, weight, height, experience level, and dietary needs.
4. The result is a plan tailored to that specific user. Plans are saved to the `plans` collection and can be viewed, edited (regenerated with new goals), or deleted.
5. Users can update their profile at any time, and future plans will reflect the new information.

## Tech Stack

- **Frontend:** HTML, CSS, EJS templates
- **Backend:** Node.js, Express
- **Database:** MongoDB Atlas (native `mongodb` driver)
- **AI API:** Groq API (`llama-3.3-70b-versatile` model, OpenAI-compatible endpoint)
- **Hosting:** Render

## AI API

This project uses the **Groq API** to generate meal and fitness plans. Gemini was the original choice, but the free tier was blocked by the AQ-key restriction, so Groq was used as the rubric permits alternative APIs.

## Database Schema

### `users` collection

```json
{
  "name": "string",
  "email": "string",
  "password": "string (hashed)",
  "createdAt": "Date"
}
```

### `plans` collection

```json
{
  "userId": "ObjectId",
  "type": "string (meal | fitness)",
  "goal": "string",
  "preferences": "string",
  "generatedPlan": "string",
  "createdAt": "Date",
  "updatedAt": "Date (set on update)"
}
```

### `profiles` collection

```json
{
  "userId": "ObjectId",
  "age": "number",
  "weight": "number (kg)",
  "height": "number (cm)",
  "sex": "string (male | female | other)",
  "experience": "string (beginner | intermediate | advanced)",
  "activityLevel": "string (sedentary | light | moderate | active | very active)",
  "dietaryType": "string (none | vegetarian | vegan | keto | halal | other)",
  "restrictions": "string",
  "updatedAt": "Date"
}
```

## How to Run Locally

1. Clone the repo
2. Run `npm install`
3. Create a `.env` file with the following variables:
   ```
   ATLAS_URI=your_mongodb_atlas_connection_string
   GROQ_API_KEY=your_groq_api_key
   SESSION_SECRET=your_session_secret
   PORT=3000
   ```
4. Run `npm start`
5. Open [http://localhost:3000](http://localhost:3000)

## Live Demo

[https://ai-meal-fitness-planner.onrender.com](https://ai-meal-fitness-planner.onrender.com)
