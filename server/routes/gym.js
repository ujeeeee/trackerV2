// ==========================================
// ===== ROUTES: GYM =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate } = require('../db');
const { authMiddleware } = require('../auth');

// ---------- МЕТРИКИ ----------
router.get('/metrics', authMiddleware, async (req, res) => {
    const { data: metrics } = await supabase.from('gym_metrics').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    if (!metrics) return res.json({ metrics: [] });

    const { data: logs } = await supabase.from('gym_metric_logs')
        .select('id, metric_id, value, date').eq('tg_id', req.tg_id).order('date', { ascending: true });

    const map = {};
    (logs || []).forEach(l => { (map[l.metric_id] ||= []).push({ id: l.id, value: Number(l.value), date: l.date }); });

    res.json({ metrics: metrics.map(m => ({ ...m, logs: map[m.id] || [] })) });
});

router.post('/metrics', authMiddleware, async (req, res) => {
    const { name, category, unit, target } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!['bio','strength'].includes(category)) return res.status(400).json({ error: 'category required' });
    const { data, error } = await supabase.from('gym_metrics').insert({
        tg_id: req.tg_id, name: name.trim(), category,
        unit: unit || 'кг', target: target ? Number(target) : null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ metric: { ...data, logs: [] } });
});

router.patch('/metrics/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.unit !== undefined) updates.unit = req.body.unit;
    if (req.body.target !== undefined) updates.target = req.body.target ? Number(req.body.target) : null;
    const { data, error } = await supabase.from('gym_metrics').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ metric: data });
});

router.delete('/metrics/:id', authMiddleware, async (req, res) => {
    await supabase.from('gym_metrics').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/metrics/:id/logs', authMiddleware, async (req, res) => {
    const { value, date } = req.body;
    if (value === '' || value === null || value === undefined) return res.status(400).json({ error: 'value required' });
    const d = date || localDate(new Date());

    const { data: existing } = await supabase.from('gym_metric_logs').select('id')
        .eq('metric_id', req.params.id).eq('tg_id', req.tg_id).eq('date', d).maybeSingle();

    let r;
    if (existing) {
        r = await supabase.from('gym_metric_logs').update({ value: Number(value) }).eq('id', existing.id).select().single();
    } else {
        r = await supabase.from('gym_metric_logs').insert({
            tg_id: req.tg_id, metric_id: req.params.id, value: Number(value), date: d,
        }).select().single();
    }
    if (r.error) return res.status(500).json({ error: r.error.message });
    res.json({ log: r.data });
});

router.delete('/metrics/logs/:logId', authMiddleware, async (req, res) => {
    await supabase.from('gym_metric_logs').delete().eq('id', req.params.logId).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- ПРОГРАММЫ ----------
router.get('/programs', authMiddleware, async (req, res) => {
    const { data: programs } = await supabase.from('gym_programs').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    if (!programs) return res.json({ programs: [] });

    const programIds = programs.map(p => p.id);
    const { data: days } = await supabase.from('gym_program_days').select('*')
        .in('program_id', programIds).order('sort_order').order('day_number');
    const dayIds = (days || []).map(d => d.id);

    const { data: exercises } = dayIds.length ? await supabase.from('gym_exercises').select('*')
        .in('day_id', dayIds).order('sort_order') : { data: [] };
    const exerciseIds = (exercises || []).map(e => e.id);

    const { data: sets } = exerciseIds.length ? await supabase.from('gym_exercise_sets').select('*')
        .in('exercise_id', exerciseIds).order('set_number') : { data: [] };

    const setsMap = {};
    (sets || []).forEach(s => { (setsMap[s.exercise_id] ||= []).push(s); });

    const exMap = {};
    (exercises || []).forEach(e => { (exMap[e.day_id] ||= []).push({ ...e, sets: setsMap[e.id] || [] }); });

    const daysMap = {};
    (days || []).forEach(d => { (daysMap[d.program_id] ||= []).push({ ...d, exercises: exMap[d.id] || [] }); });

    res.json({ programs: programs.map(p => ({ ...p, days: daysMap[p.id] || [] })) });
});

router.post('/programs', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('gym_programs').insert({
        tg_id: req.tg_id, name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ program: { ...data, days: [] } });
});

router.patch('/programs/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('gym_programs').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ program: data });
});

router.delete('/programs/:id', authMiddleware, async (req, res) => {
    const pid = req.params.id;
    const { data: days } = await supabase.from('gym_program_days').select('id').eq('program_id', pid);
    const dayIds = (days || []).map(d => d.id);
    if (dayIds.length) {
        const { data: exercises } = await supabase.from('gym_exercises').select('id').in('day_id', dayIds);
        const exIds = (exercises || []).map(e => e.id);
        if (exIds.length) await supabase.from('gym_exercise_sets').delete().in('exercise_id', exIds);
        await supabase.from('gym_exercises').delete().in('day_id', dayIds);
        await supabase.from('gym_program_days').delete().in('id', dayIds);
    }
    await supabase.from('gym_programs').delete().eq('id', pid).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/programs/:id/days', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data: existing } = await supabase.from('gym_program_days').select('id').eq('program_id', req.params.id);
    const dayNumber = (existing?.length || 0) + 1;
    const { data, error } = await supabase.from('gym_program_days').insert({
        program_id: req.params.id, name, day_number: dayNumber,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ day: { ...data, exercises: [] } });
});

router.patch('/days/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('gym_program_days').update(updates)
        .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ day: data });
});

router.delete('/days/:id', authMiddleware, async (req, res) => {
    const did = req.params.id;
    const { data: exercises } = await supabase.from('gym_exercises').select('id').eq('day_id', did);
    const exIds = (exercises || []).map(e => e.id);
    if (exIds.length) await supabase.from('gym_exercise_sets').delete().in('exercise_id', exIds);
    await supabase.from('gym_exercises').delete().eq('day_id', did);
    await supabase.from('gym_program_days').delete().eq('id', did);
    res.json({ ok: true });
});

router.post('/days/:id/exercises', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data: existing } = await supabase.from('gym_exercises').select('id').eq('day_id', req.params.id);
    const { data, error } = await supabase.from('gym_exercises').insert({
        day_id: req.params.id, name, sort_order: (existing?.length || 0) + 1,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ exercise: { ...data, sets: [] } });
});

router.patch('/exercises/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('gym_exercises').update(updates)
        .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ exercise: data });
});

router.delete('/exercises/:id', authMiddleware, async (req, res) => {
    await supabase.from('gym_exercise_sets').delete().eq('exercise_id', req.params.id);
    await supabase.from('gym_exercises').delete().eq('id', req.params.id);
    res.json({ ok: true });
});

router.post('/exercises/:id/sets', authMiddleware, async (req, res) => {
    const { reps, weight } = req.body;
    const { data: existing } = await supabase.from('gym_exercise_sets').select('id').eq('exercise_id', req.params.id);
    const setNumber = (existing?.length || 0) + 1;
    const { data, error } = await supabase.from('gym_exercise_sets').insert({
        exercise_id: req.params.id,
        set_number: setNumber,
        reps: reps ? parseInt(reps) : null,
        weight: weight ? Number(weight) : null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ set: data });
});

router.delete('/sets/:id', authMiddleware, async (req, res) => {
    await supabase.from('gym_exercise_sets').delete().eq('id', req.params.id);
    res.json({ ok: true });
});

module.exports = router;