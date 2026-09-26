// ==========================================
// ===== TELEGRAM AUTH =====
// ==========================================
require('dotenv').config();
const crypto = require('crypto');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function verifyInitData(initData) {
    if (!initData || typeof initData !== 'string') return null;
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return null;
        params.delete('hash');
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
        const calc = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        if (calc !== hash) return null;
        const userRaw = params.get('user');
        return userRaw ? JSON.parse(userRaw) : null;
    } catch {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    const initData = req.headers['x-init-data'] || req.body?.initData;
    if (!initData && process.env.NODE_ENV !== 'production') {
        req.user = { id: 999999999, first_name: 'Dev', username: 'dev_user' };
        req.tg_id = 999999999;
        return next();
    }
    const user = verifyInitData(initData);
    if (!user) return res.status(401).json({ error: 'Invalid initData' });
    req.user = user;
    req.tg_id = user.id;
    next();
}

module.exports = { verifyInitData, authMiddleware };