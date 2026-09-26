// ==========================================
// ===== ROUTES: FOOD (заглушка) =====
// ==========================================
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../auth');

router.get('/', authMiddleware, async (req, res) => {
    res.json({ ok: true, message: 'Food: coming soon' });
});

module.exports = router;