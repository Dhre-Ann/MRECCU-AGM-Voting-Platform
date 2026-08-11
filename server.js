require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const votersRouter = require('./routes/voters');
const candidatesRouter = require('./routes/candidates');
const positionsRouter = require('./routes/positions');
const votingRouter = require('./routes/voting');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());  // Middleware to parse JSON
app.use(cors());          // Enable CORS for all origins

// Simple test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use(votersRouter);
app.use(candidatesRouter);
app.use(positionsRouter);
app.use('/voting', votingRouter);

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
