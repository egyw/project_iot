/* ──────────────────────────────────────────────────────────
 *  Sessions Controller — borrow session queries & actions
 * ────────────────────────────────────────────────────────── */

const fs = require('node:fs');
const path = require('node:path');
const pool = require('../db/index.js');

const uploadsDir = process.env.UPLOADS_DIR || './uploads';

/* ════════════════════════════════════════════════════════════
 *  GET /api/sessions — paginated list with filters
 * ════════════════════════════════════════════════════════════ */
async function listSessions(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`bs.status = $${params.length}`);
  }

  if (req.query.user_id) {
    params.push(req.query.user_id);
    conditions.push(`bs.user_id = $${params.length}`);
  }

  if (req.query.date_from) {
    params.push(req.query.date_from);
    conditions.push(`bs.borrowed_at >= $${params.length}`);
  }

  if (req.query.date_to) {
    params.push(req.query.date_to);
    conditions.push(`bs.borrowed_at <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM borrow_sessions bs ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataQuery = `
    SELECT bs.id,
           u.nrp         AS user_nrp,
           u.name         AS user_name,
           bs.status,
           bs.borrowed_at,
           bs.last_updated,
           bs.photo_path,
           COUNT(bi.id)::int                                     AS item_count,
           COUNT(bi.id) FILTER (WHERE bi.returned_at IS NOT NULL)::int AS returned_count
    FROM   borrow_sessions bs
    JOIN   users u  ON u.id = bs.user_id
    LEFT JOIN borrow_items bi ON bi.session_id = bs.id
    ${where}
    GROUP  BY bs.id, u.nrp, u.name
    ORDER  BY bs.borrowed_at DESC
    LIMIT  $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

  const data = dataResult.rows.map((row) => ({
    id: row.id,
    user: { nrp: row.user_nrp, name: row.user_name },
    status: row.status,
    borrowed_at: row.borrowed_at,
    last_updated: row.last_updated,
    item_count: row.item_count,
    returned_count: row.returned_count,
    photo_url: row.photo_path ? `/api/sessions/${row.id}/photo` : null,
  }));

  res.json({ data, total, page, limit });
}

/* ════════════════════════════════════════════════════════════
 *  GET /api/sessions/:id — single session with items
 * ════════════════════════════════════════════════════════════ */
async function getSession(req, res) {
  const { id } = req.params;

  const sessionResult = await pool.query(
    `SELECT bs.id, bs.user_id, u.nrp, u.name,
            bs.status, bs.borrowed_at, bs.last_updated, bs.photo_path
     FROM   borrow_sessions bs
     JOIN   users u ON u.id = bs.user_id
     WHERE  bs.id = $1`,
    [id],
  );

  if (sessionResult.rows.length === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const s = sessionResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT bi.id AS borrow_item_id,
            bi.asset_id,
            at.name AS type_name,
            a.label,
            bi.borrowed_at,
            bi.returned_at
     FROM   borrow_items bi
     JOIN   assets a       ON a.id  = bi.asset_id
     JOIN   asset_types at ON at.id = a.asset_type_id
     WHERE  bi.session_id = $1
     ORDER  BY bi.id`,
    [id],
  );

  res.json({
    data: {
      id: s.id,
      user: { id: s.user_id, nrp: s.nrp, name: s.name },
      status: s.status,
      borrowed_at: s.borrowed_at,
      last_updated: s.last_updated,
      photo_url: s.photo_path ? `/api/sessions/${s.id}/photo` : null,
      items: itemsResult.rows,
    },
  });
}

/* ════════════════════════════════════════════════════════════
 *  GET /api/sessions/:id/photo — serve session photo
 * ════════════════════════════════════════════════════════════ */
async function getSessionPhoto(req, res) {
  const { id } = req.params;

  const result = await pool.query(
    'SELECT photo_path FROM borrow_sessions WHERE id = $1',
    [id],
  );

  if (result.rows.length === 0 || !result.rows[0].photo_path) {
    return res.status(404).json({ error: 'No photo for this session' });
  }

  const filePath = path.resolve(uploadsDir, 'sessions', `${id}.jpg`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Photo file not found' });
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(filePath);
}

/* ════════════════════════════════════════════════════════════
 *  PUT /api/sessions/:id/return — manual return override
 * ════════════════════════════════════════════════════════════ */
async function returnItems(req, res) {
  const { id } = req.params;
  const { asset_ids, force_all } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify session exists and is not fully returned
    const sessionResult = await client.query(
      'SELECT status FROM borrow_sessions WHERE id = $1',
      [id],
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found' });
    }

    if (sessionResult.rows[0].status === 'fully_returned') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'All items already returned' });
    }

    // Get unreturned items for this session
    let unreturnedQuery = `
      SELECT bi.id AS borrow_item_id, bi.asset_id
      FROM   borrow_items bi
      WHERE  bi.session_id = $1 AND bi.returned_at IS NULL
    `;
    const unreturnedParams = [id];

    if (!force_all && Array.isArray(asset_ids) && asset_ids.length > 0) {
      unreturnedQuery += ` AND bi.asset_id = ANY($2)`;
      unreturnedParams.push(asset_ids);
    }

    const unreturned = await client.query(unreturnedQuery, unreturnedParams);

    if (unreturned.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No matching unreturned items found' });
    }

    const returnedAssetIds = unreturned.rows.map((r) => r.asset_id);
    const returnedItemIds = unreturned.rows.map((r) => r.borrow_item_id);

    // Mark borrow_items as returned
    await client.query(
      `UPDATE borrow_items
       SET    returned_at = NOW()
       WHERE  id = ANY($1)`,
      [returnedItemIds],
    );

    // Mark assets as available again
    await client.query(
      `UPDATE assets
       SET    is_available = true
       WHERE  id = ANY($1)`,
      [returnedAssetIds],
    );

    // Determine new session status
    const remainingResult = await client.query(
      `SELECT COUNT(*) FROM borrow_items
       WHERE  session_id = $1 AND returned_at IS NULL`,
      [id],
    );
    const remaining = parseInt(remainingResult.rows[0].count, 10);
    const newStatus = remaining === 0 ? 'fully_returned' : 'partially_returned';

    await client.query(
      `UPDATE borrow_sessions
       SET    status = $1, last_updated = NOW()
       WHERE  id = $2`,
      [newStatus, id],
    );

    await client.query('COMMIT');

    res.json({ success: true, new_status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listSessions,
  getSession,
  getSessionPhoto,
  returnItems,
};
