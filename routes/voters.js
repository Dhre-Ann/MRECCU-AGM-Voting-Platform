const express = require('express');
const multer = require('multer');
const csv = require('csv-parse');
const fs = require('fs');
const pool = require('../config/db');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/verify-voter', async (req, res) => {
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

      // ✅ Detect admin credentials
      const isAdmin = phone_number === '222-1111' && account_number === '22221';

      return res.status(200).json({ success: true, voterId, isAdmin });
    } else {
      return res.status(401).json({ success: false, message: 'No matching voter found' });
    }
  } catch (error) {
    console.error('Error verifying voter:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
});

// Endpoint to upload CSV file with voters
// router.post('/upload-csv', upload.single('csv'), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
//   }

//   const results = [];

//   fs.createReadStream(req.file.path)
//     .pipe(csv.parse({ columns: true, trim: true }))
//     .on('data', (row) => {
//       if (row.phone_number && row.account_number) {
//         console.log('phone: ', row.phone_number);
//         console.log('acc: ', row.account_number);
//         results.push([row.phone_number, row.account_number]);
//       }
//     })
//     .on('end', async () => {
//       try {
//         for (const [phone, account] of results) {
//           await pool.query(
//             'INSERT INTO voters (phone_number, account_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
//             [phone, account]
//           );
//         }

//         fs.unlinkSync(req.file.path); // delete file after processing

//         res.json({ success: true, inserted: results.length });
//       } catch (err) {
//         console.error('Error inserting CSV data:', err);
//         res.status(500).json({ success: false, message: 'Error inserting data into database.' });
//       }
//     })
//     .on('error', (err) => {
//       console.error('CSV parsing error:', err);
//       res.status(500).json({ success: false, message: 'Error parsing CSV file.' });
//     });
// });
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv.parse({ columns: true, trim: true }))
      .on('data', (row) => {
        if (row.phone_number && row.account_number) {
          results.push([row.phone_number, row.account_number]);
        }
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

router.post('/upload-csv', upload.single('csv'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No CSV file uploaded.' });
  }

  try {
    const results = await parseCSV(req.file.path);

    for (const [phone, account] of results) {
      await pool.query(
        'INSERT INTO voters (phone_number, account_number) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [phone, account]
      );
    }

    fs.unlinkSync(req.file.path); // clean up

    res.json({ success: true, inserted: results.length });
  } catch (err) {
    console.error('Error processing CSV:', err);
    res.status(500).json({ success: false, message: 'Error processing CSV.' });
  }
});

module.exports = router;
