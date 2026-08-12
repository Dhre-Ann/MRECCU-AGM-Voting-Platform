const express = require('express');
const pool = require('../config/db');
const requireAdmin = require('../config/requireAdmin');

const router = express.Router();

// Endpoint to start voting
router.post('/start', requireAdmin, async (req, res) => {
  const { position_name } = req.body;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required' });
  }

  try {
    // Check if any other voting is currently active
    const activeVotingResult = await pool.query(
      'SELECT name FROM positions WHERE voting_active = TRUE'
    );

    if (activeVotingResult.rows.length > 0) {
      const activePosition = activeVotingResult.rows[0].name;
      return res.status(400).json({
        success: false,
        message: `Voting is currently active for "${activePosition}". Please stop that voting before starting a new one.`,
      });
    }

    // Get the position details including voting_complete
    const positionResult = await pool.query(
      'SELECT id, voting_complete, num_votes_allowed FROM positions WHERE name = $1',
      [position_name]
    );

    if (positionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found - start voting' });
    }

    const position = positionResult.rows[0];

    // Prevent starting if voting has been completed already
    if (position.voting_complete) {
      return res.status(400).json({ success: false, message: 'Voting for this position has already been completed.' });
    }

    // Check candidate count
    const candidatesResult = await pool.query(
      'SELECT COUNT(*) FROM candidates WHERE position_id = $1',
      [position.id]
    );

    const candidateCount = parseInt(candidatesResult.rows[0].count, 10);

    if (candidateCount === 0) {
      return res.status(400).json({ success: false, message: 'No candidates found for this position.' });
    }

    // Check num_votes_allowed is appropriate
    if (!position.num_votes_allowed || position.num_votes_allowed <= 0 || position.num_votes_allowed >= candidateCount) {
      return res.status(400).json({ success: false, message: 'Number of votes allowed is not appropriate for this position.' });
    }

    // ✅ Start voting for this position
    await pool.query(
      'UPDATE positions SET voting_active = TRUE WHERE id = $1',
      [position.id]
    );

    res.json({ success: true, message: `Voting started successfully for ${position_name}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});




// Endpoint to stop voting
router.post('/stop', requireAdmin, async (req, res) => {
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
      return res.status(404).json({ success: false, message: 'Position not found - stop voting' });
    }

    const positionId = positionResult.rows[0].id;

    // ✅ Set voting_active = FALSE **and** voting_complete = TRUE
    await pool.query(
      'UPDATE positions SET voting_active = FALSE, voting_complete = TRUE WHERE id = $1',
      [positionId]
    );

    // Reset has_voted for all voters
    await pool.query('UPDATE voters SET has_voted = FALSE');

    res.json({ success: true, message: 'Voting stopped successfully. Position marked complete. All voters reset.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});



// Endpoint to get voting status
router.get('/status', async (req, res) => {
  const { position_name } = req.query;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required.' });
  }

  try {
    const result = await pool.query('SELECT voting_active FROM positions WHERE name = $1', [position_name]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found - voting status.' });
    }

    res.json({ success: true, voting_active: result.rows[0].voting_active });
  } catch (error) {
    console.error('Error fetching voting status:', error);
    res.status(500).json({ success: false, message: 'Database error.' });
  }
});


// Endpoint to get active voting to update user dashboard
router.post('/get-active', async (req, res) => {
  const { voterId } = req.body;

   if (!voterId) {
    return res.status(400).json({ success: false, message: 'Missing voter ID' });
  }

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
router.post('/vote', async (req, res) => {
  const { voterId, position, selectedCandidates } = req.body;

  if (!voterId || !position || !Array.isArray(selectedCandidates) || selectedCandidates.length === 0) {
    return res.status(400).json({ success: false, message: 'Voter ID, position, and selected candidates are required' });
  }

  try {
    // ✅ Check that voting is active for the position
    const posResult = await pool.query(
      'SELECT id, num_votes_allowed FROM positions WHERE name = $1 AND voting_active = true',
      [position]
    );

    if (posResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Voting is not active for this position' });
    }

    const positionData = posResult.rows[0];

    if (selectedCandidates.length !== positionData.num_votes_allowed) {
      return res.status(400).json({
        success: false,
        message: `You must vote for exactly ${positionData.num_votes_allowed} candidate(s).`,
      });
    }

    // Atomic claim of has_voted + vote_count increments in one transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const claim = await client.query(
        'UPDATE voters SET has_voted = TRUE WHERE id = $1 AND has_voted = FALSE RETURNING id',
        [voterId]
      );

      if (claim.rowCount === 0) {
        await client.query('ROLLBACK');
        const exists = await pool.query('SELECT id FROM voters WHERE id = $1', [voterId]);
        if (exists.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Voter not found' });
        }
        return res.status(403).json({ success: false, message: 'You have already voted for this position.' });
      }

      for (const candidateId of selectedCandidates) {
        await client.query(
          'UPDATE candidates SET vote_count = vote_count + 1 WHERE id = $1 AND position_id = $2',
          [candidateId, positionData.id]
        );
      }

      await client.query('COMMIT');
      return res.json({ success: true, message: 'Your vote has been recorded' });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error submitting vote:', err);
    return res.status(500).json({ success: false, message: 'Error submitting vote' });
  }
});

// Endpoint to get the voting history
router.get('/history', async (req, res) => {
  try {
    // Get all completed positions
    const completedResult = await pool.query(`
      SELECT id, name, voting_complete, paper_results_added
      FROM positions
      WHERE voting_complete = true
      ORDER BY id
    `);

    const completedPositions = completedResult.rows;

    // Get total number of positions
    const totalResult = await pool.query('SELECT COUNT(*) FROM positions');
    const totalPositionsCount = parseInt(totalResult.rows[0].count, 10);

    // For each completed position, get candidates
    const history = [];

    for (const pos of completedPositions) {
      const candidatesResult = await pool.query(
        'SELECT name, vote_count FROM candidates WHERE position_id = $1 ORDER BY vote_count DESC',
        [pos.id]
      );

      history.push({
        name: pos.name,
        voting_complete: pos.voting_complete,
        paper_results_added: pos.paper_results_added,
        candidates: candidatesResult.rows,
      });

    }

    res.json({ success: true, history, totalPositionsCount });

  } catch (err) {
    console.error('Error fetching voting history:', err);
    res.status(500).json({ success: false, message: 'Error fetching voting history.' });
  }
});



// Endpoint to get live updates during voting
router.get('/live-stats', async (req, res) => {
  const { position_name } = req.query;

  if (!position_name) {
    return res.status(400).json({ success: false, message: 'Position name is required' });
  }

  try {
    // Get position details
    const positionResult = await pool.query('SELECT id FROM positions WHERE name = $1', [position_name]);
    if (positionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Position not found - live stats' });
    }
    const positionId = positionResult.rows[0].id;

    // Total number of voters in the system
    const totalVotersResult = await pool.query('SELECT COUNT(*) FROM voters');
    const totalVoters = parseInt(totalVotersResult.rows[0].count, 10);

    // ✅ Count the number of *people* who have voted (NOT the number of votes cast)
    const votersWhoVotedResult = await pool.query('SELECT COUNT(*) FROM voters WHERE has_voted = TRUE');
    const votersWhoVoted = parseInt(votersWhoVotedResult.rows[0].count, 10);

    // Votes per candidate
    const candidateVotesResult = await pool.query(
      'SELECT name, vote_count FROM candidates WHERE position_id = $1 ORDER BY vote_count DESC',
      [positionId]
    );

    res.json({
      success: true,
      totalVoters,
      votersWhoVoted, // ✅ <-- renamed for clarity
      candidates: candidateVotesResult.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

router.post('/poll-results', requireAdmin, async (req, res) => {
  const { resultsByPosition } = req.body;

  if (!resultsByPosition || typeof resultsByPosition !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid results data.' });
  }

  try {
    for (const positionName in resultsByPosition) {
    const positionResult = await pool.query('SELECT id FROM positions WHERE name = $1', [positionName]);
    const positionId = positionResult.rows[0].id;

    for (const entry of resultsByPosition[positionName]) {
      await pool.query(
        'UPDATE candidates SET vote_count = vote_count + $1 WHERE name = $2 AND position_id = $3',
        [entry.count, entry.candidateName, positionId]
      );
    }

    // ✅ mark as paper results added
    await pool.query(
      'UPDATE positions SET paper_results_added = TRUE WHERE id = $1',
      [positionId]
    );
  }
    res.json({ success: true, message: 'Manual results added successfully.' });

  } catch (err) {
    console.error('Error pooling manual votes:', err);
    res.status(500).json({ success: false, message: 'Server error while pooling votes.' });
  }
});

module.exports = router;
