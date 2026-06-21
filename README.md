# AI Meal & Fitness Planner

A web application that uses Google Gemini AI to generate personalized meal and fitness plans.

## Tech Stack

- **Backend:** Node.js, Express
- **View Engine:** EJS
- **Database:** MongoDB (native driver)
- **AI:** Google Gemini API (gemini-1.5-flash)
- **Auth:** bcryptjs for password hashing, express-session for sessions

## Setup

1. Clone the repository
2. Run `npm install`
3. Create a `.env` file with the following variables:
   ```
   ATLAS_URI=your_mongodb_atlas_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   SESSION_SECRET=anysecretstring123
   PORT=3000
   ```
4. Run `npm start`
5. Open `http://localhost:3000` in your browser

## Features

- User signup and signin with hashed passwords
- Session-based authentication
- AI-generated meal and fitness plans via Gemini
- Save, view, and delete plan history
