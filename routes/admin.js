const express = require('express');
const pool = require('../config/db');
const requireAdmin = require('../config/requireAdmin');

const router = express.Router();

router.use(requireAdmin);

function normalizeCredential(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePositionName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeIlike(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const VOTER_FIELDS = 'id, phone_number, account_number, has_voted, first_name, last_name';

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// GET /admin/voters — full register (paginated)
router.get('/voters', async (req, res) => {
  const page = Math.max(1, parsePositiveInt(req.query.page, 1));
  const limit = Math.min(200, Math.max(1, parsePositiveInt(req.query.limit, 100)));
  const offset = (page - 1) * limit;

  try {
    const [countResult, listResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE has_voted)::int AS voted
        FROM voters
      `),
      pool.query(
        `SELECT ${VOTER_FIELDS}
         FROM voters
         ORDER BY id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = countResult.rows[0].total;
    const votedCount = countResult.rows[0].voted;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

    return res.json({
      success: true,
      voters: listResult.rows,
      page,
      limit,
      total,
      votedCount,
      totalPages,
    });
  } catch (err) {
    console.error('Error listing voters:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// GET /admin/voters/search?query=
router.get('/voters/search', async (req, res) => {
  const query = normalizeCredential(req.query.query);

  if (!query) {
    return res.status(400).json({ success: false, message: 'Search query is required' });
  }

  try {
    const pattern = `%${escapeIlike(query)}%`;
    const result = await pool.query(
      `SELECT ${VOTER_FIELDS}
       FROM voters
       WHERE phone_number ILIKE $1
          OR account_number ILIKE $1
          OR first_name ILIKE $1
          OR last_name ILIKE $1
          OR TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) ILIKE $1
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

// GET /admin/voters/export — full register as CSV
router.get('/voters/export', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT phone_number, account_number, has_voted, first_name, last_name
       FROM voters
       ORDER BY id ASC`
    );

    const header = 'phone_number,account_number,has_voted,first_name,last_name';
    const lines = result.rows.map((row) =>
      [
        csvEscape(row.phone_number),
        csvEscape(row.account_number),
        row.has_voted ? 'true' : 'false',
        csvEscape(row.first_name),
        csvEscape(row.last_name),
      ].join(',')
    );
    const csvBody = `${header}\n${lines.join('\n')}${lines.length ? '\n' : ''}`;
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mreccu-voters-${date}.csv"`
    );
    return res.send(`\uFEFF${csvBody}`);
  } catch (err) {
    console.error('Error exporting voters:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST /admin/voters — register one voter (same fields as a CSV row)
router.post('/voters', async (req, res) => {
  const phone_number = normalizeCredential(req.body.phone_number);
  const account_number = normalizeCredential(req.body.account_number);
  const first_name = normalizeName(req.body.first_name);
  const last_name = normalizeName(req.body.last_name);

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
      `INSERT INTO voters (phone_number, account_number, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${VOTER_FIELDS}`,
      [phone_number, account_number, first_name || null, last_name || null]
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
  const hasFirst = Object.prototype.hasOwnProperty.call(req.body, 'first_name');
  const hasLast = Object.prototype.hasOwnProperty.call(req.body, 'last_name');

  if (!hasPhone && !hasAccount && !hasFirst && !hasLast) {
    return res.status(400).json({ success: false, message: 'Provide at least one voter field to update' });
  }

  const phone_number = hasPhone ? normalizeCredential(req.body.phone_number) : null;
  const account_number = hasAccount ? normalizeCredential(req.body.account_number) : null;
  const first_name = hasFirst ? normalizeName(req.body.first_name) : null;
  const last_name = hasLast ? normalizeName(req.body.last_name) : null;

  if (hasPhone && !phone_number) {
    return res.status(400).json({ success: false, message: 'Phone number cannot be empty' });
  }
  if (hasAccount && !account_number) {
    return res.status(400).json({ success: false, message: 'Account number cannot be empty' });
  }

  try {
    const current = await pool.query(
      `SELECT ${VOTER_FIELDS} FROM voters WHERE id = $1`,
      [voterId]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Voter not found' });
    }

    const nextPhone = hasPhone ? phone_number : current.rows[0].phone_number;
    const nextAccount = hasAccount ? account_number : current.rows[0].account_number;
    const nextFirst = hasFirst ? (first_name || null) : current.rows[0].first_name;
    const nextLast = hasLast ? (last_name || null) : current.rows[0].last_name;

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
       SET phone_number = $1, account_number = $2, first_name = $3, last_name = $4
       WHERE id = $5
       RETURNING ${VOTER_FIELDS}`,
      [nextPhone, nextAccount, nextFirst, nextLast, voterId]
    );

    return res.json({ success: true, voter: updated.rows[0] });
  } catch (err) {
    console.error('Error updating voter:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// POST /admin/positions — add a race (name only; num_votes_allowed uses the DB default of 1)
router.post('/positions', async (req, res) => {
  const name = normalizePositionName(req.body.name);

  if (!name) {
    return res.status(400).json({ success: false, message: 'Position name is required' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM positions WHERE name = $1',
      [name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A position with that name already exists',
      });
    }

    const inserted = await pool.query(
      `INSERT INTO positions (name, voting_active, voting_complete, paper_results_added)
       VALUES ($1, FALSE, FALSE, FALSE)
       RETURNING id, name, num_votes_allowed, voting_active, voting_complete, paper_results_added`,
      [name]
    );

    return res.status(201).json({ success: true, position: inserted.rows[0] });
  } catch (err) {
    console.error('Error adding position:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

const POSITION_HAS_CANDIDATES_MESSAGE = "Remove this position's candidates first";

// DELETE /admin/positions/:id — refused if any candidates are attached (FK is ON DELETE CASCADE)
router.delete('/positions/:id', async (req, res) => {
  const positionId = parseInt(req.params.id, 10);
  if (Number.isNaN(positionId)) {
    return res.status(400).json({ success: false, message: 'Invalid position id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE so a concurrent candidate INSERT (FK KEY SHARE on this row) waits
    const existing = await client.query(
      'SELECT id, name FROM positions WHERE id = $1 FOR UPDATE',
      [positionId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Position not found' });
    }

    const attached = await client.query(
      'SELECT COUNT(*)::int AS count FROM candidates WHERE position_id = $1',
      [positionId]
    );

    if (attached.rows[0].count > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: POSITION_HAS_CANDIDATES_MESSAGE,
      });
    }

    await client.query('DELETE FROM positions WHERE id = $1', [positionId]);
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Position "${existing.rows[0].name}" removed.`,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back position delete:', rollbackErr);
    }
    console.error('Error deleting position:', err);
    return res.status(500).json({ success: false, message: 'Database error' });
  } finally {
    client.release();
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
      SET vote_count = 0,
          paper_vote_count = 0
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
      'UPDATE candidates SET vote_count = 0, paper_vote_count = 0 WHERE position_id = $1 RETURNING id',
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
