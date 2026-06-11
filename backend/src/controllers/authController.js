/* ──────────────────────────────────────────────────────────
 *  Auth Controller — Single-admin JWT authentication
 * ────────────────────────────────────────────────────────── */

const jwt = require('jsonwebtoken');

/**
 * POST /api/auth/login
 * Validates admin credentials against env vars and returns a signed JWT.
 */
async function login(req, res) {
  const { username, password } = req.body;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_INITIAL_PASSWORD;

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: 'admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );

  res.json({ data: { token, expires_in: process.env.JWT_EXPIRES_IN || '24h' } });
}

/**
 * POST /api/auth/logout
 * Stateless JWT — simply acknowledge the logout request.
 */
async function logout(_req, res) {
  res.json({ data: { success: true } });
}

module.exports = { login, logout };
