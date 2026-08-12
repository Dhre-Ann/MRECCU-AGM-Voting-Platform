require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const votersRouter = require('./routes/voters');
const candidatesRouter = require('./routes/candidates');
const positionsRouter = require('./routes/positions');
const votingRouter = require('./routes/voting');

const app = express();
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is required in production');
  process.exit(1);
}

// Render (and similar hosts) terminate TLS upstream — needed for secure cookies + correct client IPs
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.json());  // Middleware to parse JSON
// Reflect request origin + allow cookies (needed if page host ≠ API host, e.g. LAN testing)
app.use(cors({ origin: true, credentials: true }));

app.use(session({
  name: 'mreccu.sid',
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Simple test route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.use(votersRouter);
app.use(candidatesRouter);
app.use(positionsRouter);
app.use('/voting', votingRouter);

// Start the server
const server = app.listen(port, () => {
  // On Windows/Node, this callback can fire even when bind failed — verify for real.
  if (!server.listening) return;
  console.log(`Server listening on port ${port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Find it with: netstat -ano | findstr :${port}`);
    console.error('Then stop it with: taskkill /PID <pid> /F');
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
