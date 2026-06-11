/* ──────────────────────────────────────────────────────────
 *  Stats Controller — dashboard overview, activity & top-assets
 * ────────────────────────────────────────────────────────── */

const pool = require('../db/index.js');
const mqttClient = require('../mqtt/client.js');

/* ════════════════════════════════════════════════════════════
 *  GET /api/stats/overview — aggregate counters
 * ════════════════════════════════════════════════════════════ */
async function getOverview(_req, res) {
  const [totalAssets, availableAssets, activeSessions, borrowsToday, borrowsWeek] =
    await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM assets'),
      pool.query('SELECT COUNT(*)::int AS count FROM assets WHERE is_available = true'),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM borrow_sessions WHERE status IN ('active', 'partially_returned')",
      ),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM borrow_sessions WHERE DATE(borrowed_at) = CURRENT_DATE',
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM borrow_sessions WHERE borrowed_at >= NOW() - INTERVAL '7 days'",
      ),
    ]);

  res.json({
    data: {
      total_assets: totalAssets.rows[0].count,
      available_assets: availableAssets.rows[0].count,
      active_sessions: activeSessions.rows[0].count,
      borrows_today: borrowsToday.rows[0].count,
      borrows_this_week: borrowsWeek.rows[0].count,
    },
    mqtt_status: mqttClient.connected ? 'online' : 'offline',
  });
}

/* ════════════════════════════════════════════════════════════
 *  GET /api/stats/activity — recent borrow/return events
 * ════════════════════════════════════════════════════════════ */
async function getActivity(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  // Union of BORROW and RETURN events, each counted by items per session
  const result = await pool.query(
    `
    (
      SELECT 'BORROW'       AS type,
             u.name          AS user_name,
             u.nrp           AS user_nrp,
             bs.borrowed_at  AS timestamp,
             COUNT(bi.id)::int AS item_count
      FROM   borrow_sessions bs
      JOIN   users u           ON u.id = bs.user_id
      JOIN   borrow_items bi   ON bi.session_id = bs.id
      GROUP  BY bs.id, u.name, u.nrp, bs.borrowed_at
    )
    UNION ALL
    (
      SELECT 'RETURN'        AS type,
             u.name          AS user_name,
             u.nrp           AS user_nrp,
             bi.returned_at  AS timestamp,
             COUNT(bi.id)::int AS item_count
      FROM   borrow_items bi
      JOIN   borrow_sessions bs ON bs.id = bi.session_id
      JOIN   users u            ON u.id = bs.user_id
      WHERE  bi.returned_at IS NOT NULL
      GROUP  BY bs.id, u.name, u.nrp, bi.returned_at
    )
    ORDER  BY timestamp DESC
    LIMIT  $1
    `,
    [limit],
  );

  res.json({ data: result.rows });
}

/* ════════════════════════════════════════════════════════════
 *  GET /api/stats/top-assets — most-borrowed asset types
 * ════════════════════════════════════════════════════════════ */
async function getTopAssets(req, res) {
  const days = Math.max(parseInt(req.query.days, 10) || 30, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  const result = await pool.query(
    `
    SELECT at.name          AS type_name,
           COUNT(bi.id)::int AS borrow_count
    FROM   borrow_items bi
    JOIN   assets a        ON a.id  = bi.asset_id
    JOIN   asset_types at  ON at.id = a.asset_type_id
    WHERE  bi.borrowed_at >= NOW() - ($1 || ' days')::INTERVAL
    GROUP  BY at.id, at.name
    ORDER  BY borrow_count DESC
    LIMIT  $2
    `,
    [days, limit],
  );

  res.json({ data: result.rows });
}

module.exports = {
  getOverview,
  getActivity,
  getTopAssets,
};
