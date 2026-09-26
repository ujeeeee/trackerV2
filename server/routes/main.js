// ==========================================
// ===== ROUTES: MAIN (дашборд) =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate } = require('../db');
const { authMiddleware } = require('../auth');

router.get('/main', authMiddleware, async (req, res) => {
    const todayStr = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : localDate(new Date());

    const [ty, tm, td] = todayStr.split('-').map(Number);
    const today = new Date(ty, tm - 1, td, 12, 0, 0);

    const tomorrowDate = new Date(today);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = localDate(tomorrowDate);

    // --- Дела ---
    const { data: todos } = await supabase.from('disc_todos').select('*')
        .eq('tg_id', req.tg_id).eq('done', false)
        .or(`date.is.null,date.eq.${todayStr},date.eq.${tomorrowStr}`);

    const todosList = (todos || []).map(t => ({
        name: t.name,
        date: t.date,
        isToday: t.date === todayStr,
        isTomorrow: t.date === tomorrowStr,
        time_start: t.time_start,
        time_end: t.time_end,
    }));

    // --- Привычки ---
    const { data: habits } = await supabase.from('disc_habits').select('*')
        .eq('tg_id', req.tg_id).eq('archived', false);

    const { data: logs } = await supabase.from('disc_habit_logs').select('habit_id, date, done')
        .eq('tg_id', req.tg_id).eq('date', todayStr);

    const doneToday = new Set((logs || []).filter(l => l.done).map(l => l.habit_id));

    const dow = today.getDay() === 0 ? 7 : today.getDay();

    function parseDow(raw) {
        if (Array.isArray(raw)) return raw.map(Number);
        if (typeof raw === 'string') {
            return raw.replace(/[{}]/g, '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        }
        return [];
    }

    const habitsToday = (habits || []).filter(h => {
        const freq = (h.frequency || 'daily').toLowerCase();
        const dowArr = parseDow(h.days_of_week);

        if (!h.frequency || (freq !== 'daily' && freq !== 'days' && freq !== 'interval')) {
            if (dowArr.length > 0 && dowArr.length < 7) return dowArr.includes(dow);
            return true;
        }
        if (freq === 'days') return dowArr.length > 0 && dowArr.includes(dow);
        if (freq === 'interval') {
            const c = new Date(h.created_at);
            c.setHours(0, 0, 0, 0);
            const t = new Date(today);
            t.setHours(0, 0, 0, 0);
            const diff = Math.round((t - c) / (1000 * 60 * 60 * 24));
            const n = h.interval_days || 2;
            return diff >= 0 && diff % n === 0;
        }
        return true;
    });

    const habitsList = habitsToday
        .filter(h => !doneToday.has(h.id))
        .map(h => ({ id: h.id, name: h.name }));

    // --- Деньги ---
    const { data: piggyItems } = await supabase.from('cash_piggy').select('*').eq('tg_id', req.tg_id);
    const { data: piggySettings } = await supabase.from('cash_piggy_settings').select('*').eq('tg_id', req.tg_id).maybeSingle();

    let deposited = 0, withdrew = 0;
    (piggyItems || []).forEach(x => {
        if (x.type === 'deposit') deposited += Number(x.amount);
        else withdrew += Number(x.amount);
    });
    const piggyBalance = deposited - withdrew;
    const fact = Number(piggySettings?.fact_amount || 0);
    const debt = piggyBalance - fact;

    res.json({
        todos: todosList,
        habits: habitsList,
        money: { balance: piggyBalance, debt },
    });
});

module.exports = router;