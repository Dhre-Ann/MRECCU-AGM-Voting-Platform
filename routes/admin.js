const express = require('express');
const pool = require('../config/db');
const requireAdmin = require('../config/requireAdmin');

const router = express.Router();

router.use(requireAdmin);

function normalizeCredential(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeIlike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// GET /admin/voters/search?query=
router.get('/voters/search', async (req, res) => {
  const query = normalizeCredential(req.query.query);

  if (!query) {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }

  try {
    const pattern = `%${escapeIlike(query)}%`;
    const result = await pool.query(
      `SELECT id, phone_number, account_number, has_voted
       FROM voters
       WHERE phone_number ILIKE $1 OR account_number ILIKE $1
       ORDER BY id ASC
       LIMIT 50`,
      [pattern]
    );

    return res.json({ success: true, voters: result.rows });
  } catch (err) {
    console.error('Error searching voters:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST /admin/voters — register one voter (same fields as a CSV row)
router.post('/voters', async (req, res) => {
  const phone_number = normalizeCredential(req.body.phone_number);
  const account_number = normalizeCredential(req.body.account_number);

  if (!phone_number || !account_number) {
    return res.status(400).json({ success: false, message: 'Phone number and account number are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM voters WHERE phone_number = $1 AND account_number = $2',
      [phone_number, account_number]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A voter with that phone number and account number already exists',
      });
    }

    const inserted = await pool.query(
      `INSERT INTO voters (phone_number, account_number)
       VALUES ($1, $2)
       RETURNING id, phone_number, account_number, has_voted`,
      [phone_number, account_number]
    );

    return res.status(201).json({ success: true, voter: inserted.rows[0] });
  } catch (err) {
    console.error('Error adding voter:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// PATCH /admin/voters/:id — correct phone_number and/or account_number
router.patch('/voters/:id', async (req, res) => {
  const voterId = parseInt(req.params.id, 10);
  if (Number.isNaN(voterId)) {
    return res.status(400).json({ success: false, message: 'Invalid voter id' });
  }

  const hasPhone = Object.prototype.hasOwnProperty.call(req.body, 'phone_number');
  const hasAccount = Object.prototype.hasOwnProperty.call(req.body, 'account_number');

  if (!hasPhone && !hasAccount) {
    return res.status(400).json({ success: false, message: 'Provide phone_number and/or account_number' });
  }

  const phone_number = hasPhone ? normalizeCredential(req.body.phone_number) : null;
  const account_number = hasAccount ? normalizeCredential(req.body.account_number) : null;

  if (hasPhone && !phone_number) {
    return res.status(400).json({ success: false, message: 'Phone number cannot be empty' });
  }
  if (hasAccount && !account_number) {
    return res.status(400).json({ success: false, message: 'Account number cannot be empty' });
  }

  try {
    const current = await pool.query(
      'SELECT id, phone_number, account_number, has_voted FROM voters WHERE id = $1',
      [voterId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Voter not found' });
    }

    const nextPhone = hasPhone ? phone_number : current.rows[0].phone_number;
    const nextAccount = hasAccount ? account_number : current.rows[0].account_number;

    const duplicate = await pool.query(
      'SELECT id FROM voters WHERE phone_number = $1 AND account_number = $2 AND id <> $3',
      [nextPhone, nextAccount, voterId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Another voter already has that phone number and account number',
      });
    }

    const updated = await pool.query(
      `UPDATE voters
       SET phone_number = $1, account_number = $2
       WHERE id = $3
       RETURNING id, phone_number, account_number, has_voted`,
      [nextPhone, nextAccount, voterId]
    );

    return res.json({ success: true, voter: updated.rows[0] });
  } catch (err) {
    console.error('Error updating voter:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST /admin/election/full-reset
// One transaction: all position flags, all candidate tallies, every voter's has_voted.
router.post('/election/full-reset', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const positions = await client.query(`
      UPDATE positions
      SET voting_active = FALSE,
          voting_complete = FALSE,
          paper_results_added = FALSE
      RETURNING id
    `);

    const candidates = await client.query(`
      UPDATE candidates
      SET vote_count = 0
      RETURNING id
    `);

    const voters = await client.query(`
      UPDATE voters
      SET has_voted = FALSE
      RETURNING id
    `);

    await client.query('COMMIT');

    const summary = {
      positionsReset: positions.rowCount,
      candidatesZeroed: candidates.rowCount,
      votersReset: voters.rowCount,
    };

    console.log(
      `[${new Date().toISOString()}] Full election reset: ` +
      `${summary.positionsReset} position(s) (voting_active, voting_complete, paper_results_added cleared), ` +
      `${summary.candidatesZeroed} candidate(s) (vote_count = 0), ` +
      `${summary.votersReset} voter(s) (has_voted = false)`
    );

    return res.json({
      success: true,
      message: 'Entire election has been reset.',
      ...summary,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back full election reset:', rollbackErr);
    }
    console.error('Error during full election reset:', err);
    return res.status(500).json({
      success: false,
      message: 'Reset failed. No changes were applied.',
    });
  } finally {
    client.release();
  }
});

const ACTIVE_ONLY_RESET_MESSAGE =
  'Only the currently active race can be reset. has_voted is global, so a completed or idle race cannot be reset without letting voters re-vote in another race.';

// POST /admin/election/reset-position/:id
// Active race only. One transaction. Other positions untouched.
router.post('/election/reset-position/:id', async (req, res) => {
  const positionId = parseInt(req.params.id, 10);
  if (Number.isNaN(positionId)) {
    return res.status(400).json({ success: false, message: 'Invalid position id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, name, voting_active FROM positions WHERE id = $1',
      [positionId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Position not found' });
    }

    if (!existing.rows[0].voting_active) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: ACTIVE_ONLY_RESET_MESSAGE });
    }

    const locked = await client.query(
      `UPDATE positions
       SET voting_active = FALSE,
           voting_complete = FALSE,
           paper_results_added = FALSE
       WHERE id = $1 AND voting_active = TRUE
       RETURNING id, name`,
      [positionId]
    );

    if (locked.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: ACTIVE_ONLY_RESET_MESSAGE });
    }

    const candidates = await client.query(
      'UPDATE candidates SET vote_count = 0 WHERE position_id = $1 RETURNING id',
      [positionId]
    );

    const voters = await client.query(
      'UPDATE voters SET has_voted = FALSE RETURNING id'
    );

    await client.query('COMMIT');

    const positionName = locked.rows[0].name;
    const summary = {
      positionId,
      positionName,
      candidatesZeroed: candidates.rowCount,
      votersReset: voters.rowCount,
    };

    console.log(
      `[${new Date().toISOString()}] Single-position reset: "${positionName}" (id=${positionId}): ` +
      `${summary.candidatesZeroed} candidate(s) (vote_count = 0), ` +
      `${summary.votersReset} voter(s) (has_voted = false). Other positions untouched.`
    );

    return res.json({
      success: true,
      message: `Race "${positionName}" has been reset.`,
      ...summary,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back single-position reset:', rollbackErr);
    }
    console.error('Error during single-position reset:', err);
    return res.status(500).json({
      success: false,
      message: 'Reset failed. No changes were applied.',
    });
  } finally {
    client.release();
  }
});

module.exports = router;
