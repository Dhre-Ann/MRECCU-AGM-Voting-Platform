const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Endpoint to start voting
router.post('/start', async (req, res) => {
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
router.post('/stop', async (req, res) => {
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
    // Eligibility for the next race is "no electronic ballot_casts row for that position",
    // not a global voters.has_voted reset.
    await pool.query(
      'UPDATE positions SET voting_active = FALSE, voting_complete = TRUE WHERE id = $1',
      [positionId]
    );

    res.json({ success: true, message: 'Voting stopped successfully. Position marked complete.' });

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

    // Whether this voter already cast an electronic ballot for THIS position
    const votedResult = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM ballot_casts
         WHERE voter_id = $1 AND position_id = $2 AND source = 'electronic'
       ) AS has_voted`,
      [voterId, position.id]
    );

    res.json({
      success: true,
      position: position.name,
      num_votes_allowed: position.num_votes_allowed,
      candidates: candidatesResult.rows,
      hasVoted: votedResult.rows[0]?.has_voted || false,
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

  const uniqueCandidateIds = [...new Set(selectedCandidates.map((id) => Number(id)))];
  if (uniqueCandidateIds.length !== selectedCandidates.length || uniqueCandidateIds.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ success: false, message: 'Selected candidates must be unique valid IDs' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Serialize concurrent casts from the same voter (unique index is the real race closer)
    const voterResult = await client.query(
      'SELECT id FROM voters WHERE id = $1 FOR UPDATE',
      [voterId]
    );

    if (voterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Voter not found' });
    }

    // ✅ Check that voting is active for the position
    const posResult = await client.query(
      'SELECT id, num_votes_allowed FROM positions WHERE name = $1 AND voting_active = true',
      [position]
    );

    if (posResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Voting is not active for this position' });
    }

    const positionData = posResult.rows[0];

    if (uniqueCandidateIds.length !== positionData.num_votes_allowed) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `You must vote for exactly ${positionData.num_votes_allowed} candidate(s).`,
      });
    }

    // Soft check before insert (unique index still closes the race)
    const alreadyCast = await client.query(
      `SELECT 1 FROM ballot_casts
       WHERE voter_id = $1 AND position_id = $2 AND source = 'electronic'`,
      [voterId, positionData.id]
    );

    if (alreadyCast.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'You have already voted for this position.' });
    }

    // Validate each candidate belongs to this position
    const candidatesCheck = await client.query(
      `SELECT id FROM candidates
       WHERE position_id = $1 AND id = ANY($2::int[])`,
      [positionData.id, uniqueCandidateIds]
    );

    if (candidatesCheck.rows.length !== uniqueCandidateIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'One or more selected candidates are invalid for this position' });
    }

    const castResult = await client.query(
      `INSERT INTO ballot_casts (voter_id, position_id, source)
       VALUES ($1, $2, 'electronic')
       RETURNING id`,
      [voterId, positionData.id]
    );
    const castId = castResult.rows[0].id;

    for (const candidateId of uniqueCandidateIds) {
      await client.query(
        `INSERT INTO ballot_lines (cast_id, candidate_id, quantity)
         VALUES ($1, $2, 1)`,
        [castId, candidateId]
      );

      const updateResult = await client.query(
        'UPDATE candidates SET vote_count = vote_count + 1 WHERE id = $1 AND position_id = $2',
        [candidateId, positionData.id]
      );

      if (updateResult.rowCount !== 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'One or more selected candidates are invalid for this position' });
      }
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Your vote has been recorded' });

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back vote transaction:', rollbackErr);
    }

    // Unique index: concurrent double-submit for same voter+position
    if (err.code === '23505') {
      return res.status(403).json({ success: false, message: 'You have already voted for this position.' });
    }

    console.error('Error submitting vote:', err);
    return res.status(500).json({ success: false, message: 'Error submitting vote' });
  } finally {
    client.release();
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

    // For each completed position, get candidates (+ optional audit breakdown)
    const history = [];

    for (const pos of completedPositions) {
      const candidatesResult = await pool.query(
        `SELECT c.name,
                c.vote_count,
                COALESCE(SUM(bl.quantity) FILTER (WHERE bc.source = 'electronic'), 0)::int AS electronic_votes,
                COALESCE(SUM(bl.quantity) FILTER (WHERE bc.source = 'paper'), 0)::int AS paper_votes
         FROM candidates c
         LEFT JOIN ballot_lines bl ON bl.candidate_id = c.id
         LEFT JOIN ballot_casts bc ON bc.id = bl.cast_id AND bc.position_id = c.position_id
         WHERE c.position_id = $1
         GROUP BY c.id, c.name, c.vote_count
         ORDER BY c.vote_count DESC`,
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

    // Turnout for THIS position only (electronic members)
    const votersWhoVotedResult = await pool.query(
      `SELECT COUNT(*) FROM ballot_casts
       WHERE position_id = $1 AND source = 'electronic'`,
      [positionId]
    );
    const votersWhoVoted = parseInt(votersWhoVotedResult.rows[0].count, 10);

    // Votes per candidate (maintained cache)
    const candidateVotesResult = await pool.query(
      'SELECT name, vote_count FROM candidates WHERE position_id = $1 ORDER BY vote_count DESC',
      [positionId]
    );

    res.json({
      success: true,
      totalVoters,
      votersWhoVoted,
      candidates: candidateVotesResult.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

router.post('/poll-results', async (req, res) => {
  const { resultsByPosition } = req.body;

  if (!resultsByPosition || typeof resultsByPosition !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid results data.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const positionName in resultsByPosition) {
      const positionResult = await client.query(
        'SELECT id FROM positions WHERE name = $1',
        [positionName]
      );

      if (positionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: `Position not found: ${positionName}` });
      }

      const positionId = positionResult.rows[0].id;

      const castResult = await client.query(
        `INSERT INTO ballot_casts (voter_id, position_id, source)
         VALUES (NULL, $1, 'paper')
         RETURNING id`,
        [positionId]
      );
      const castId = castResult.rows[0].id;

      for (const entry of resultsByPosition[positionName]) {
        const count = Number(entry.count);
        if (!Number.isInteger(count) || count <= 0) {
          continue;
        }

        const candidateResult = await client.query(
          'SELECT id FROM candidates WHERE name = $1 AND position_id = $2',
          [entry.candidateName, positionId]
        );

        if (candidateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Candidate not found: ${entry.candidateName} (${positionName})`,
          });
        }

        const candidateId = candidateResult.rows[0].id;

        await client.query(
          `INSERT INTO ballot_lines (cast_id, candidate_id, quantity)
           VALUES ($1, $2, $3)`,
          [castId, candidateId, count]
        );

        await client.query(
          'UPDATE candidates SET vote_count = vote_count + $1 WHERE id = $2 AND position_id = $3',
          [count, candidateId, positionId]
        );
      }

      await client.query(
        'UPDATE positions SET paper_results_added = TRUE WHERE id = $1',
        [positionId]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Manual results added successfully.' });

  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back poll-results transaction:', rollbackErr);
    }
    console.error('Error pooling manual votes:', err);
    res.status(500).json({ success: false, message: 'Server error while pooling votes.' });
  } finally {
    client.release();
  }
});

module.exports = router;
