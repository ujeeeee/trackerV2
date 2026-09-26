// ==========================================
// ===== ROUTES: TEA =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { authMiddleware } = require('../auth');

router.get('/', authMiddleware, async (req, res) => {
    const { data: groups } = await supabase.from('tea_groups').select('*').eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const { data: items } = await supabase.from('tea_items').select('*')
        .eq('tg_id', req.tg_id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
    const { data: shops } = await supabase.from('tea_shops').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');

    const result = (groups || []).map(g => ({
        ...g,
        items: (items || []).filter(i => i.group_id === g.id),
    }));
    const orphans = (items || []).filter(i => !i.group_id);
    res.json({ groups: result, orphans, shops: shops || [] });
});

router.post('/groups', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('tea_groups').insert({
        tg_id: req.tg_id, name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ group: { ...data, items: [] } });
});

router.patch('/groups/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('tea_groups').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ group: data });
});

router.delete('/groups/:id', authMiddleware, async (req, res) => {
    await supabase.from('tea_items').update({ group_id: null })
        .eq('group_id', req.params.id).eq('tg_id', req.tg_id);
    await supabase.from('tea_groups').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/items', authMiddleware, async (req, res) => {
    const { name, group_id, temp_c, review, rating } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('tea_items').insert({
        tg_id: req.tg_id, name: name.trim(),
        group_id: group_id || null,
        temp_c: temp_c ? String(temp_c).trim() : null,
        review: review || null,
        rating: rating ? parseInt(rating) : null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.patch('/items/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','group_id','review'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (updates.name) updates.name = updates.name.trim();
    if (req.body.temp_c !== undefined) updates.temp_c = req.body.temp_c ? String(req.body.temp_c).trim() : null;
    if (req.body.rating !== undefined) updates.rating = req.body.rating ? parseInt(req.body.rating) : null;
    const { data, error } = await supabase.from('tea_items').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/items/:id', authMiddleware, async (req, res) => {
    await supabase.from('tea_items').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/shops', authMiddleware, async (req, res) => {
    const { name, url } = req.body;
    if (!url?.trim()) return res.status(400).json({ error: 'URL required' });
    const { data, error } = await supabase.from('tea_shops').insert({
        tg_id: req.tg_id, name: (name || '').trim() || null, url: url.trim(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ shop: data });
});

router.patch('/shops/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = (req.body.name || '').trim() || null;
    if (req.body.url !== undefined) updates.url = req.body.url.trim();
    const { data, error } = await supabase.from('tea_shops').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ shop: data });
});

router.delete('/shops/:id', authMiddleware, async (req, res) => {
    await supabase.from('tea_shops').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.delete('/orphans', authMiddleware, async (req, res) => {
    await supabase.from('tea_items').delete().eq('tg_id', req.tg_id).is('group_id', null);
    res.json({ ok: true });
});

module.exports = router;