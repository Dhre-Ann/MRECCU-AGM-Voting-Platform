
require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Needed for some hosted DBs like Render, Heroku
});

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());  // Middleware to parse JSON
app.use(cors());          // Enable CORS for all origins

// Simple test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// POST endpoint to add voter
app.post('/add-voter', async (req, res) => {
  const { phone_number, account_number } = req.body;

  if (!phone_number || !account_number) {
    return res.status(400).json({ success: false, error: 'Missing phone_number or account_number' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO voters (phone_number, account_number) VALUES ($1, $2) RETURNING *',
      [phone_number, account_number]
    );

    res.json({ success: true, voter: result.rows[0] });
  } catch (error) {
    console.error('Error inserting voter:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
