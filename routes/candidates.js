const express = require('express');
const pool = require('../config/db');
const requireAdmin = require('../config/requireAdmin');

const router = express.Router();

// POST /add-candidate
router.post('/add-candidate', requireAdmin, async (req, res) => {
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
router.get('/get-candidates', async (req, res) => {
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
router.delete('/remove-candidate/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send('Database error.');
  }
});

module.exports = router;
