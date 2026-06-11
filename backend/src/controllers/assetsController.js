/* ──────────────────────────────────────────────────────────
 *  Assets Controller — CRUD for asset_types & assets
 * ────────────────────────────────────────────────────────── */

const pool = require('../db/index.js');

/* ════════════════════════════════════════════════════════════
 *  Asset Types
 * ════════════════════════════════════════════════════════════ */

/**
 * GET /api/assets/types
 */
async function listTypes(_req, res) {
  const result = await pool.query(
    'SELECT id, name, description, created_at FROM asset_types ORDER BY id',
  );
  res.json({ data: result.rows });
}

/**
 * POST /api/assets/types
 */
async function createType(req, res) {
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO asset_types (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset type name already exists' });
    }
    throw err;
  }
}

/**
 * PUT /api/assets/types/:id
 */
async function updateType(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE asset_types
       SET    name = COALESCE($1, name),
              description = COALESCE($2, description)
       WHERE  id = $3
       RETURNING *`,
      [name || null, description !== undefined ? description : null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset type not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset type name already exists' });
    }
    throw err;
  }
}

/**
 * DELETE /api/assets/types/:id
 */
async function deleteType(req, res) {
  const { id } = req.params;

  // Check if any assets reference this type
  const assetCheck = await pool.query(
    'SELECT 1 FROM assets WHERE asset_type_id = $1 LIMIT 1',
    [id],
  );

  if (assetCheck.rows.length > 0) {
    return res.status(409).json({ error: 'Asset type has assets' });
  }

  const result = await pool.query(
    'DELETE FROM asset_types WHERE id = $1 RETURNING id',
    [id],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Asset type not found' });
  }

  res.json({ data: { id: result.rows[0].id } });
}

/* ════════════════════════════════════════════════════════════
 *  Assets
 * ════════════════════════════════════════════════════════════ */

/**
 * GET /api/assets
 * Supports filters: type_id, available ('true'/'false'), pagination.
 */
async function listAssets(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (req.query.type_id) {
    params.push(req.query.type_id);
    conditions.push(`a.asset_type_id = $${params.length}`);
  }

  if (req.query.available === 'true') {
    conditions.push('a.is_available = true');
  } else if (req.query.available === 'false') {
    conditions.push('a.is_available = false');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM assets a ${where}`;
  const dataQuery = `
    SELECT a.id, a.asset_type_id, at.name AS type_name,
           a.rfid_uid, a.label, a.is_available, a.created_at
    FROM   assets a
    JOIN   asset_types at ON at.id = a.asset_type_id
    ${where}
    ORDER  BY a.id DESC
    LIMIT  $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(dataQuery, [...params, limit, offset]);

  res.json({ data: dataResult.rows, total, page, limit });
}

/**
 * POST /api/assets
 */
async function createAsset(req, res) {
  const { asset_type_id, rfid_uid, label } = req.body;

  // Verify that asset_type exists
  const typeCheck = await pool.query('SELECT 1 FROM asset_types WHERE id = $1', [asset_type_id]);
  if (typeCheck.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid asset_type_id' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO assets (asset_type_id, rfid_uid, label) VALUES ($1, $2, $3) RETURNING *',
      [asset_type_id, rfid_uid, label],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate value for rfid_uid' });
    }
    throw err;
  }
}

/**
 * GET /api/assets/:id
 * Returns asset with type_name and currently_borrowed_by if unavailable.
 */
async function getAsset(req, res) {
  const { id } = req.params;

  const assetResult = await pool.query(
    `SELECT a.id, a.asset_type_id, at.name AS type_name,
            a.rfid_uid, a.label, a.is_available, a.created_at
     FROM   assets a
     JOIN   asset_types at ON at.id = a.asset_type_id
     WHERE  a.id = $1`,
    [id],
  );

  if (assetResult.rows.length === 0) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  const asset = assetResult.rows[0];
  let currently_borrowed_by = null;

  if (!asset.is_available) {
    const borrowerResult = await pool.query(
      `SELECT u.id, u.nrp, u.name
       FROM   borrow_items bi
       JOIN   borrow_sessions bs ON bs.id = bi.session_id
       JOIN   users u            ON u.id = bs.user_id
       WHERE  bi.asset_id = $1 AND bi.returned_at IS NULL
       LIMIT  1`,
      [id],
    );
    if (borrowerResult.rows.length > 0) {
      currently_borrowed_by = borrowerResult.rows[0];
    }
  }

  res.json({ data: { ...asset, currently_borrowed_by } });
}

/**
 * PUT /api/assets/:id
 * Update rfid_uid and/or label (asset_type_id is immutable).
 */
async function updateAsset(req, res) {
  const { id } = req.params;
  const { rfid_uid, label } = req.body;

  try {
    const result = await pool.query(
      `UPDATE assets
       SET    rfid_uid = COALESCE($1, rfid_uid),
              label    = COALESCE($2, label)
       WHERE  id = $3
       RETURNING *`,
      [rfid_uid || null, label || null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
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
 * DELETE /api/assets/:id
 * Cannot delete if asset is currently borrowed.
 */
async function deleteAsset(req, res) {
  const { id } = req.params;

  const assetCheck = await pool.query(
    'SELECT is_available FROM assets WHERE id = $1',
    [id],
  );

  if (assetCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  if (!assetCheck.rows[0].is_available) {
    return res.status(409).json({ error: 'Asset is currently borrowed' });
  }

  await pool.query('DELETE FROM assets WHERE id = $1', [id]);

  res.json({ data: { id: parseInt(id, 10) } });
}

module.exports = {
  listTypes,
  createType,
  updateType,
  deleteType,
  listAssets,
  createAsset,
  getAsset,
  updateAsset,
  deleteAsset,
};
