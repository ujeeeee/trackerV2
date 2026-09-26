// ==========================================
// ===== SUPABASE CLIENT + SHARED UTILS =====
// ==========================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// --- Утилиты, общие для роутеров ---
function localDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function isHabitScheduled(h, dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (h.frequency === 'daily') return true;
    if (h.frequency === 'days') return (h.days_of_week || []).includes(dow);
    if (h.frequency === 'interval') {
        const c = new Date(h.created_at); c.setHours(0, 0, 0, 0);
        const t = new Date(dateStr + 'T12:00:00'); t.setHours(0, 0, 0, 0);
        const diff = Math.round((t - c) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff % (h.interval_days || 2) === 0;
    }
    return true;
}

module.exports = { supabase, localDate, isHabitScheduled };