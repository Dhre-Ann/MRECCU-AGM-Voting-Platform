
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

// endpoint to verify using identity (phone number and account number)
app.post('/verify-voter', async (req, res) => {
  const { phone_number, account_number } = req.body;

  if (!phone_number || !account_number) {
    return res.status(400).json({ success: false, message: 'Missing phone number or account number' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM voters WHERE phone_number = $1 AND account_number = $2',
      [phone_number, account_number]
    );

    if (result.rows.length > 0) {
      console.log(result.rows[0]);
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'No matching voter found' });
    }
  } catch (error) {
    console.error('Error verifying voter:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST endpoint to add voter - WILL BE NEEDED LATER FOR ADMIN
// app.post('/add-voter', async (req, res) => {
//   const { phone_number, account_number } = req.body;

//   if (!phone_number || !account_number) {
//     return res.status(400).json({ success: false, error: 'Missing phone number or account number' });
//   }

//   try {
//     const result = await pool.query(
//       'INSERT INTO voters (phone_number, account_number) VALUES ($1, $2) RETURNING *',
//       [phone_number, account_number]
//     );

//     res.json({ success: true, voter: result.rows[0] });
//   } catch (error) {
//     console.error('Error inserting voter:', error);
//     res.status(500).json({ success: false, error: 'Database error' });
//   }
// });

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
