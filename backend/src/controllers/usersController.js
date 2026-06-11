/* ──────────────────────────────────────────────────────────
 *  Users Controller — CRUD + borrow session queries
 * ────────────────────────────────────────────────────────── */

const pool = require('../db/index.js');

/**
 * GET /api/users
 * List users with optional search (name/nrp) and pagination.
 */
async function listUsers(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || null;

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR u.nrp ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM users u ${where}`;
  const dataQuery = `
    SELECT u.id, u.nrp, u.name, u.rfid_uid, u.created_at, u.updated_at
    FROM   users u
    ${where}
    ORDER BY u.id DESC
    LIMIT  $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

  res.json({ data: dataResult.rows, total, page, limit });
}

/**
 * POST /api/users
 * Create a new user. Handles unique constraint violations (nrp/rfid_uid).
 */
async function createUser(req, res) {
  const { nrp, name, rfid_uid } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO users (nrp, name, rfid_uid) VALUES ($1, $2, $3) RETURNING *',
      [nrp, name, rfid_uid],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation
      const detail = err.detail || '';
      let field = 'nrp or rfid_uid';
      if (detail.includes('nrp')) field = 'nrp';
      else if (detail.includes('rfid_uid')) field = 'rfid_uid';
      return res.status(409).json({ error: `Duplicate value for ${field}` });
    }
    throw err;
  }
}

/**
 * GET /api/users/:id
 * Get single user with optional active borrow session info.
 */
async function getUser(req, res) {
  const { id } = req.params;

  const userResult = await pool.query(
    'SELECT id, nrp, name, rfid_uid, created_at, updated_at FROM users WHERE id = $1',
    [id],
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userResult.rows[0];

  // Check for active borrow session
  const sessionResult = await pool.query(
    `SELECT bs.id, bs.status, bs.photo_path, bs.borrowed_at, bs.last_updated
     FROM   borrow_sessions bs
     WHERE  bs.user_id = $1 AND bs.status = 'active'
     LIMIT  1`,
    [id],
  );

  const activeSession = sessionResult.rows.length > 0 ? sessionResult.rows[0] : null;

  res.json({ data: { ...user, active_session: activeSession } });
}

/**
 * PUT /api/users/:id
 * Update user name and/or rfid_uid (nrp is immutable).
 */
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, rfid_uid } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET    name = COALESCE($1, name),
              rfid_uid = COALESCE($2, rfid_uid),
              updated_at = NOW()
       WHERE  id = $3
       RETURNING *`,
      [name || null, rfid_uid || null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate value for rfid_uid' });
    }
    throw err;
  }
}

/**
 * DELETE /api/users/:id
 * Delete user only if no active borrow session exists.
 */
async function deleteUser(req, res) {
  const { id } = req.params;

  // Check for active loans
  const activeCheck = await pool.query(
    "SELECT 1 FROM borrow_sessions WHERE user_id = $1 AND status = 'active' LIMIT 1",
    [id],
  );

  if (activeCheck.rows.length > 0) {
    return res.status(409).json({ error: 'User has active loan' });
  }

  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ data: { id: result.rows[0].id } });
}

/**
 * GET /api/users/:id/sessions
 * List borrow sessions for a user with items detail (paginated).
 */
async function getUserSessions(req, res) {
  const { id } = req.params;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const offset = (page - 1) * limit;

  // Verify user exists
  const userCheck = await pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Count total sessions
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM borrow_sessions WHERE user_id = $1',
    [id],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch sessions
  const sessionsResult = await pool.query(
    `SELECT id, status, photo_path, borrowed_at, last_updated
     FROM   borrow_sessions
     WHERE  user_id = $1
     ORDER  BY borrowed_at DESC
     LIMIT  $2 OFFSET $3`,
    [id, limit, offset],
  );

  // Fetch items for each session
  const sessions = [];
  for (const session of sessionsResult.rows) {
    const itemsResult = await pool.query(
      `SELECT bi.id, bi.asset_id, a.label, at.name AS type_name,
              bi.borrowed_at, bi.returned_at
       FROM   borrow_items bi
       JOIN   assets a       ON a.id = bi.asset_id
       JOIN   asset_types at ON at.id = a.asset_type_id
       WHERE  bi.session_id = $1
       ORDER  BY bi.id`,
      [session.id],
    );
    sessions.push({ ...session, items: itemsResult.rows });
  }

  res.json({ data: sessions, total, page, limit });
}

module.exports = { listUsers, createUser, getUser, updateUser, deleteUser, getUserSessions };
