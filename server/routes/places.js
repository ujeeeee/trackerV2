// ==========================================
// ===== ROUTES: PLACES =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate } = require('../db');
const { authMiddleware } = require('../auth');

router.get('/', authMiddleware, async (req, res) => {
    const { data: types } = await supabase.from('places_types').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const { data: items } = await supabase.from('places_items').select('*')
        .eq('tg_id', req.tg_id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

    const result = (types || []).map(t => ({
        ...t,
        items: (items || []).filter(i => i.type_id === t.id),
    }));
    const orphans = (items || []).filter(i => !i.type_id);
    res.json({ types: result, orphans });
});

router.post('/types', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('places_types').insert({
        tg_id: req.tg_id, name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ type: { ...data, items: [] } });
});

router.patch('/types/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('places_types').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ type: data });
});

router.delete('/types/:id', authMiddleware, async (req, res) => {
    await supabase.from('places_items').update({ type_id: null })
        .eq('type_id', req.params.id).eq('tg_id', req.tg_id);
    await supabase.from('places_types').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.delete('/orphans', authMiddleware, async (req, res) => {
    await supabase.from('places_items').delete().eq('tg_id', req.tg_id).is('type_id', null);
    res.json({ ok: true });
});

router.post('/items', authMiddleware, async (req, res) => {
    const { name, type_id, city, country, map_url, status, priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('places_items').insert({
        tg_id: req.tg_id, name: name.trim(),
        type_id: type_id || null,
        city: city?.trim() || null,
        country: country?.trim() || null,
        map_url: map_url?.trim() || null,
        status: status || 'want',
        priority: priority ? parseInt(priority) : null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.patch('/items/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','city','country','map_url','status','review'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k] || null;
    });
    if (req.body.type_id !== undefined) updates.type_id = req.body.type_id ? parseInt(req.body.type_id) : null;
    ['priority','rating'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k] ? parseInt(req.body[k]) : null;
    });
    if (req.body.status === 'visited') updates.visited_at = localDate(new Date());
    const { data, error } = await supabase.from('places_items').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/items/:id', authMiddleware, async (req, res) => {
    await supabase.from('places_items').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

module.exports = router;