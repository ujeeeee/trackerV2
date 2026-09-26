// ==========================================
// ===== ROUTES: DISCIPLINE =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate, isHabitScheduled } = require('../db');
const { authMiddleware } = require('../auth');

// ---------- ПРИВЫЧКИ ----------
router.get('/habits', authMiddleware, async (req, res) => {
    const { data: habits } = await supabase.from('disc_habits').select('*')
        .eq('tg_id', req.tg_id).eq('archived', false)
        .order('sort_order').order('created_at');
    if (!habits) return res.json({ habits: [] });

    const days = parseInt(req.query.days) || 60;
    const since = new Date(); since.setDate(since.getDate() - days);
    const { data: logs } = await supabase.from('disc_habit_logs').select('habit_id, date, done')
        .eq('tg_id', req.tg_id).gte('date', localDate(since));

    const map = {};
    (logs || []).forEach(l => { (map[l.habit_id] ||= []).push({ date: l.date, done: l.done }); });

    res.json({ habits: habits.map(h => ({ ...h, logs: map[h.id] || [] })) });
});

router.post('/habits', authMiddleware, async (req, res) => {
    const { name, frequency, days_of_week, interval_days } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('disc_habits').insert({
        tg_id: req.tg_id,
        name: name.trim(),
        frequency: frequency || 'daily',
        days_of_week: days_of_week || [1,2,3,4,5,6,7],
        interval_days: interval_days || 2,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ habit: { ...data, logs: [] } });
});

router.patch('/habits/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','frequency','days_of_week','interval_days'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    const { data, error } = await supabase.from('disc_habits').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ habit: data });
});

router.delete('/habits/:id', authMiddleware, async (req, res) => {
    await supabase.from('disc_habits').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/habits/:id/toggle', authMiddleware, async (req, res) => {
    const d = req.body.date || localDate(new Date());
    if (d > localDate(new Date())) return res.status(400).json({ error: 'Future not allowed' });

    const { data: existing } = await supabase.from('disc_habit_logs').select('id')
        .eq('habit_id', req.params.id).eq('tg_id', req.tg_id).eq('date', d).maybeSingle();

    if (existing) {
        await supabase.from('disc_habit_logs').delete().eq('id', existing.id);
        return res.json({ ok: true, done: false });
    }
    await supabase.from('disc_habit_logs').insert({
        habit_id: req.params.id, tg_id: req.tg_id, date: d, done: true,
    });
    res.json({ ok: true, done: true });
});

router.get('/habits/week', authMiddleware, async (req, res) => {
    const { start } = req.query;
    if (!start) return res.status(400).json({ error: 'start required' });

    const sd = new Date(start + 'T12:00:00');
    const ed = new Date(sd); ed.setDate(ed.getDate() + 6);
    const end = localDate(ed);

    const { data: habits } = await supabase.from('disc_habits').select('*')
        .eq('tg_id', req.tg_id).eq('archived', false).order('created_at');
    const { data: logs } = await supabase.from('disc_habit_logs').select('habit_id, date, done')
        .eq('tg_id', req.tg_id).gte('date', start).lte('date', end);

    const map = {};
    (logs || []).forEach(l => { if (l.done) (map[l.habit_id] ||= new Set()).add(l.date); });

    const result = (habits || []).map(h => {
        const done = map[h.id] || new Set();
        const week = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sd); d.setDate(d.getDate() + i);
            const ds = localDate(d);
            week.push({ date: ds, done: done.has(ds), scheduled: isHabitScheduled(h, ds) });
        }
        return { id: h.id, name: h.name, week };
    });
    res.json({ habits: result });
});

// ---------- ДЕЛА ----------
router.get('/todos', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('disc_todos').select('*')
        .eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('done')
        .order('date', { ascending: true, nullsFirst: true })
        .order('created_at');
    res.json({ todos: data || [] });
});

router.post('/todos', authMiddleware, async (req, res) => {
    const { name, date, time_start, time_end } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('disc_todos').insert({
        tg_id: req.tg_id,
        name: name.trim(),
        date: date || null,
        time_start: time_start || null,
        time_end: time_end || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ todo: data });
});

router.patch('/todos/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.done !== undefined) updates.done = !!req.body.done;
    if (req.body.date !== undefined) updates.date = req.body.date || null;
    if (req.body.time_start !== undefined) updates.time_start = req.body.time_start || null;
    if (req.body.time_end !== undefined) updates.time_end = req.body.time_end || null;
    const { data, error } = await supabase.from('disc_todos').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ todo: data });
});

router.delete('/todos/:id', authMiddleware, async (req, res) => {
    await supabase.from('disc_todos').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- ЦЕЛИ ----------
router.get('/areas', authMiddleware, async (req, res) => {
    const { data: areas } = await supabase.from('disc_areas').select('*').eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const { data: goals } = await supabase.from('disc_goals').select('*').eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const result = (areas || []).map(a => ({
        ...a,
        goals: (goals || []).filter(g => g.area_id === a.id),
    }));
    res.json({ areas: result, orphanGoals: (goals || []).filter(g => !g.area_id) });
});

router.post('/areas', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('disc_areas').insert({ tg_id: req.tg_id, name }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ area: { ...data, goals: [] } });
});

router.patch('/areas/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('disc_areas').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ area: data });
});

router.delete('/areas/:id', authMiddleware, async (req, res) => {
    await supabase.from('disc_areas').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/goals', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('disc_goals').insert({
        tg_id: req.tg_id, name, area_id: req.body.area_id || null, status: 'plan',
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ goal: data });
});

router.patch('/goals/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','status','deadline','note'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    const { data, error } = await supabase.from('disc_goals').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ goal: data });
});

router.delete('/goals/:id', authMiddleware, async (req, res) => {
    await supabase.from('disc_goals').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

module.exports = router;