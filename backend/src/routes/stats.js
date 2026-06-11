/* ──────────────────────────────────────────────────────────
 *  Stats Routes — /api/stats
 * ────────────────────────────────────────────────────────── */

const { Router } = require('express');
const { authenticateToken } = require('../middleware/auth');
const statsController = require('../controllers/statsController');

const router = Router();

// ── All routes require authentication ──────────────────────
router.use(authenticateToken);

// ── GET /api/stats/overview ───────────────────────────────
router.get('/overview', statsController.getOverview);

// ── GET /api/stats/activity ───────────────────────────────
router.get('/activity', statsController.getActivity);

// ── GET /api/stats/top-assets ─────────────────────────────
router.get('/top-assets', statsController.getTopAssets);

module.exports = router;
