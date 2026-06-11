/* ──────────────────────────────────────────────────────────
 *  SmartLab Backend — Entry Point (Express 5 / CommonJS)
 * ────────────────────────────────────────────────────────── */

const fs = require('node:fs');
const path = require('node:path');

// Load environment variables BEFORE anything else touches process.env
require('dotenv').config({ quiet: process.env.NODE_ENV === 'production' });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

// ── Ensure upload directories exist ────────────────────────
const uploadsDir = process.env.UPLOADS_DIR || './uploads';
fs.mkdirSync(path.join(uploadsDir, 'temp'), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'sessions'), { recursive: true });

// ── Express app ────────────────────────────────────────────
const app = express();

// ── Global middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API routes ─────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/assets',   require('./routes/assets'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/photo',    require('./routes/photo'));
app.use('/api/stats',    require('./routes/stats'));

// ── Health-check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Express 5 error handler (MUST have 4 parameters) ──────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message || err);

  // Multer-specific errors (file too large, wrong type, etc.)
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ── Start server ───────────────────────────────────────────
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`SmartLab Backend running on port ${PORT}`);
});

// ── Start MQTT handler (runs in background) ───────────────
require('./mqtt/client');

module.exports = app; // useful for testing
