
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

app.post('/verify-voter', async (req, res) => {
  const { phone_number, account_number } = req.body;

  if (!phone_number || !account_number) {
    return res.status(400).json({ success: false, message: 'Missing phone number or account number' });
  }

  try {
    const result = await pool.query(
      'SELECT id FROM voters WHERE phone_number = $1 AND account_number = $2',
      [phone_number, account_number]
    );

    if (result.rows.length > 0) {
      const voterId = result.rows[0].id;
      return res.status(200).json({ success: true, voterId }); // ✅ Returning voterId here
    } else {
      return res.status(401).json({ success: false, message: 'No matching voter found' });
    }
  } catch (error) {
    console.error('Error verifying voter:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});


// =========================== ENDPOINTS FOR ACTIVE VOTING CONFIG ===========================
// POST /add-candidate
app.post('/add-candidate', async (req, res) => {
  const { positionName, candidateName, candidateOccupation } = req.body;

  try {
    const positionResult = await pool.query('SELECT id FROM positions WHERE name = $1', [positionName]);
    if (positionResult.rows.length === 0) return res.status(400).send('Invalid position.');

    const positionId = positionResult.rows[0].id;

    await pool.query(
      'INSERT INTO candidates (position_id, name, occupation) VALUES ($1, $2, $3)',
      [positionId, candidateName, candidateOccupation]
    );

    res.status(200).send('Candidate added.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error.');
  }
});

// GET /get-candidates
app.get('/get-candidates', async (req, res) => {
  const { position } = req.query;

  try {
    const result = await pool.query(
      `SELECT candidates.id, candidates.name, candidates.occupation
       FROM candidates
       JOIN positions ON candidates.position_id = positions.id
       WHERE positions.name = $1`,
      [position]
    );
    res.json({ candidates: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error.');
  }
});

// DELETE /remove-candidate/:id
app.delete('/remove-candidate/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error.');
  }
});


// ___________________________________________________________________________________________________

// GET position by name → used to populate num_votes_allowed
app.get('/get-position-name', async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Missing position name' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, num_votes_allowed FROM positions WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found' });
    }

    return res.json({ success: true, position: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// Endpoint to pdate num_votes_allowed for a position
app.post('/update-votes', async (req, res) => {
  const { id, num_votes_allowed } = req.body;

  if (!id || !num_votes_allowed) {
    return res.status(400).json({ success: false, message: 'Missing position_id or num_votes_allowed' });
  }

  try {
    await pool.query(
      'UPDATE positions SET num_votes_allowed = $1 WHERE id = $2',
      [num_votes_allowed, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// ------------------------------- TOGGLE VOTING -------------------------------

// Endpoint to start voting
app.post('/voting/start', async (req, res) => {
  const { position_name } = req.body;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required' });
  }

  try {
    // Get the position details
    const positionResult = await pool.query(
      'SELECT id, name, num_votes_allowed FROM positions WHERE name = $1',
      [position_name]
    );

    if (positionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found' });
    }

    const position = positionResult.rows[0];

    // Check if there are any candidates
    const candidatesResult = await pool.query(
      'SELECT COUNT(*) FROM candidates WHERE position_id = $1',
      [position.id]
    );

    const candidateCount = parseInt(candidatesResult.rows[0].count, 10);

    if (candidateCount === 0) {
      return res.status(400).json({ success: false, message: 'No candidates found for this position' });
    }

    // Check if number_of_votes is less than candidates set
    console.log("candidate count: ", candidateCount);
    if (!position.num_votes_allowed || position.num_votes_allowed <= 0 || position.num_votes_allowed >= candidateCount) {
      return res.status(400).json({ success: false, message: 'Number of votes allowed is not appropriate for this position.' });
    }

    // Set voting_active = true for this position
    await pool.query(
      'UPDATE positions SET voting_active = TRUE WHERE id = $1',
      [position.id]
    );

    res.json({ success: true, message: 'Voting started successfully for this position' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// Endpoint to stop voting
app.post('/voting/stop', async (req, res) => {
  const { position_name } = req.body;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required' });
  }

  try {
    // Find the position by name
    const positionResult = await pool.query(
      'SELECT id FROM positions WHERE name = $1',
      [position_name]
    );

    if (positionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found' });
    }

    const positionId = positionResult.rows[0].id;

    // Set voting_active = FALSE for the position
    await pool.query(
      'UPDATE positions SET voting_active = FALSE WHERE id = $1',
      [positionId]
    );

    // Reset has_voted for all voters
    await pool.query('UPDATE voters SET has_voted = FALSE');

    res.json({ success: true, message: 'Voting stopped successfully, all voters reset' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// Endpoint to get voting status
app.get('/voting/status', async (req, res) => { 
  const { position_name } = req.query;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required.' });
  }

  try {
    const result = await pool.query('SELECT voting_active FROM positions WHERE name = $1', [position_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found.' });
    }

    res.json({ success: true, voting_active: result.rows[0].voting_active });
  } catch (error) {
    console.error('Error fetching voting status:', error);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});


// Endpoint to get active voting to update user dashboard
app.post('/voting/get-active', async (req, res) => {
  const { voterId } = req.body;
  try {
    // Get the currently active position
    const positionResult = await pool.query(`
      SELECT id, name, num_votes_allowed 
      FROM positions 
      WHERE voting_active = true 
      LIMIT 1
    `);

    if (positionResult.rows.length === 0) {
      return res.json({ success: true, position: null }); // No active voting
    }

    const position = positionResult.rows[0];

    // Now get candidates for that position
    const candidatesResult = await pool.query(
      'SELECT id, name, occupation FROM candidates WHERE position_id = $1',
      [position.id]
    );

    // Now get whether user has voted
    const userResult = await pool.query(
      'SELECT has_voted FROM voters WHERE id = $1',
      [voterId]
    );

    res.json({
      success: true,
      position: position.name,
      num_votes_allowed: position.num_votes_allowed,
      candidates: candidatesResult.rows,
      hasVoted: userResult.rows[0]?.has_voted || false,  // 👈 extract BOOLEAN directly
    });


  } catch (err) {
    console.error('Error fetching active voting:', err);
    res.status(500).json({ success: false, message: 'Error fetching active voting' });
  }
});


// Endpoint to allow users to vote
app.post('/voting/vote', async (req, res) => {
  const { voterId, position, selectedCandidates } = req.body;

  if (!voterId || !position || !Array.isArray(selectedCandidates) || selectedCandidates.length === 0) {
    return res.status(400).json({ success: false, message: 'Voter ID, position, and selected candidates are required' });
  }

  try {
    // ✅ Check that user has not voted yet
    const voterResult = await pool.query('SELECT has_voted FROM voters WHERE id = $1', [voterId]);

    if (voterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Voter not found' });
    }

    if (voterResult.rows[0].has_voted) {
      return res.status(403).json({ success: false, message: 'You have already voted for this position.' });
    }

    // ✅ Check that voting is active for the position
    const posResult = await pool.query(
      'SELECT id, num_votes_allowed FROM positions WHERE name = $1 AND voting_active = true',
      [position]
    );

    if (posResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Voting is not active for this position' });
    }

    const positionData = posResult.rows[0];

    if (selectedCandidates.length > positionData.num_votes_allowed) {
      return res.status(400).json({ success: false, message: `You can only vote for up to ${positionData.num_votes_allowed} candidate(s)` });
    }

    // ✅ Increment vote_count for each selected candidate
    for (const candidateId of selectedCandidates) {
      await pool.query(
        'UPDATE candidates SET vote_count = vote_count + 1 WHERE id = $1 AND position_id = $2',
        [candidateId, positionData.id]
      );
    }

    // ✅ Set has_voted = true
    await pool.query('UPDATE voters SET has_voted = TRUE WHERE id = $1', [voterId]);

    return res.json({ success: true, message: 'Your vote has been recorded' });

  } catch (err) {
    console.error('Error submitting vote:', err);
    return res.status(500).json({ success: false, message: 'Error submitting vote' });
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
