/* ──────────────────────────────────────────────────────────
 *  Auth Routes — /api/auth
 * ────────────────────────────────────────────────────────── */

const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const router = Router();

// ── POST /api/auth/login ───────────────────────────────────
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('username is required'),
    body('password').notEmpty().withMessage('password is required'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  authController.login,
);

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', authController.logout);

module.exports = router;
