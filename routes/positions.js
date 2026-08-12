const express = require('express');
const pool = require('../config/db');
const requireAdmin = require('../config/requireAdmin');

const router = express.Router();

// GET position by name → used to populate num_votes_allowed
router.get('/get-position-name', async (req, res) => {
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
      return res.status(404).json({ success: false, message: 'Position not found - get postion name' });
    }

    return res.json({ success: true, position: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});


// Endpoint to pdate num_votes_allowed for a position
router.post('/update-votes', requireAdmin, async (req, res) => {
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

module.exports = router;
