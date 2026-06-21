const { MongoClient } = require('mongodb');
const dbURL = process.env.ATLAS_URI;
let db;

async function connectToDB() {
  try {
    const client = new MongoClient(dbURL);
    await client.connect();
    db = client.db("fitplanner");
    console.log('Connected to MongoDB');
  } catch (err) {
    console.warn('WARNING: MongoDB connection failed -', err.message);
    console.warn('Server will start without database. Auth routes will be unavailable.');
  }
}

function isConnected() {
  return db !== undefined;
}

function getCollection(collectionName) {
  return db.collection(collectionName);
}

module.exports = { connectToDB, isConnected, getCollection };
