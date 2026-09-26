// ==========================================
// ===== ROUTES: CASH =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate } = require('../db');
const { authMiddleware } = require('../auth');

// ---------- БЮДЖЕТ ----------
router.get('/budget', authMiddleware, async (req, res) => {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const lastDay = new Date(year, month, 0).getDate();
    const weeksInMonth = Math.ceil(lastDay / 7);

    const [budgetR, subsR, weeklyR, customR] = await Promise.all([
        supabase.from('cash_budget').select('*').eq('tg_id', req.tg_id).eq('year', year).eq('month', month).maybeSingle(),
        supabase.from('cash_subs').select('*').eq('tg_id', req.tg_id).eq('active', true).order('sort_order'),
        supabase.from('cash_weekly').select('*').eq('tg_id', req.tg_id).order('sort_order'),
        supabase.from('cash_custom_stats').select('*').eq('tg_id', req.tg_id).order('sort_order').order('created_at'),
    ]);

    const subsTotal = (subsR.data || []).filter(s => !s.paid).reduce((s, x) => s + Number(x.amount || 0), 0);
    const weeklyTotal = (weeklyR.data || []).reduce((s, x) => s + Number(x.amount || 0), 0) * weeksInMonth;
    const budget = budgetR.data || { year, month, budget_amount: 0 };
    const budgetAmount = Number(budget.budget_amount || 0);
    const planned = subsTotal + weeklyTotal;

    const customTotal = (customR.data || []).reduce((s, x) => {
        return s + (x.type === 'percent' ? budgetAmount * Number(x.value || 0) / 100 : Number(x.value || 0));
    }, 0);

    const remaining = budgetAmount - planned - customTotal;

    res.json({
        year, month, weeksInMonth, budget,
        subs: subsR.data || [],
        weekly: weeklyR.data || [],
        customStats: customR.data || [],
        totals: { budget: budgetAmount, subs: subsTotal, weekly: weeklyTotal, planned, customTotal, remaining },
    });
});

router.post('/budget', authMiddleware, async (req, res) => {
    const { year, month, budget_amount } = req.body;
    const { data: existing } = await supabase.from('cash_budget').select('id')
        .eq('tg_id', req.tg_id).eq('year', year).eq('month', month).maybeSingle();

    const payload = {
        tg_id: req.tg_id, year, month,
        budget_amount: Number(budget_amount) || 0,
        updated_at: new Date().toISOString(),
    };
    let r;
    if (existing) r = await supabase.from('cash_budget').update(payload).eq('id', existing.id).select().single();
    else r = await supabase.from('cash_budget').insert(payload).select().single();
    if (r.error) return res.status(500).json({ error: r.error.message });
    res.json({ budget: r.data });
});

// ---------- CUSTOM STATS ----------
router.post('/custom-stats', authMiddleware, async (req, res) => {
    const { name, type, value } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_custom_stats').insert({
        tg_id: req.tg_id, name: name.trim(), type: type || 'rub', value: Number(value) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ stat: data });
});

router.patch('/custom-stats/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.value !== undefined) updates.value = Number(req.body.value) || 0;
    const { data, error } = await supabase.from('cash_custom_stats').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ stat: data });
});

router.delete('/custom-stats/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_custom_stats').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- SUBS ----------
router.post('/subs', authMiddleware, async (req, res) => {
    const { name, amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_subs').insert({
        tg_id: req.tg_id, name: name.trim(), amount: Number(amount) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sub: data });
});

router.patch('/subs/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','amount','paid','active'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (updates.name) updates.name = updates.name.trim();
    if (updates.amount !== undefined) updates.amount = Number(updates.amount) || 0;
    const { data, error } = await supabase.from('cash_subs').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sub: data });
});

router.delete('/subs/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_subs').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- WEEKLY ----------
router.post('/weekly', authMiddleware, async (req, res) => {
    const { name, amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_weekly').insert({
        tg_id: req.tg_id, name: name.trim(), amount: Number(amount) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ weekly: data });
});

router.patch('/weekly/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.amount !== undefined) updates.amount = Number(req.body.amount) || 0;
    const { data, error } = await supabase.from('cash_weekly').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ weekly: data });
});

router.delete('/weekly/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_weekly').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- WISHLIST ----------
router.get('/wishlist', authMiddleware, async (req, res) => {
    const { data: items } = await supabase.from('cash_wishlist').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const { data: areas } = await supabase.from('cash_wishlist_areas').select('*')
        .eq('tg_id', req.tg_id).order('created_at');
    res.json({ items: items || [], areas: areas || [] });
});

router.post('/wishlist', authMiddleware, async (req, res) => {
    const { name, price, area, url } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_wishlist').insert({
        tg_id: req.tg_id, name: name.trim(), price: Number(price) || 0,
        area: area || 'Общее', url: url || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.patch('/wishlist/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['name','area','url','done'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (updates.name) updates.name = updates.name.trim();
    if (req.body.price !== undefined) updates.price = Number(req.body.price) || 0;
    const { data, error } = await supabase.from('cash_wishlist').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/wishlist/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_wishlist').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/wishlist/areas', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_wishlist_areas').insert({
        tg_id: req.tg_id, name: name.trim(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ area: data });
});

router.patch('/wishlist/areas/:id', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_wishlist_areas').update({ name: name.trim() })
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ area: data });
});

router.delete('/wishlist/areas/:id', authMiddleware, async (req, res) => {
    const { data: area } = await supabase.from('cash_wishlist_areas').select('name')
        .eq('id', req.params.id).eq('tg_id', req.tg_id).maybeSingle();
    if (area) {
        await supabase.from('cash_wishlist').delete().eq('tg_id', req.tg_id).eq('area', area.name);
    }
    await supabase.from('cash_wishlist_areas').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- КОПИЛКА ----------
router.get('/piggy', authMiddleware, async (req, res) => {
    const { data: items } = await supabase.from('cash_piggy').select('*')
        .eq('tg_id', req.tg_id).order('date', { ascending: false }).order('created_at', { ascending: false });
    const { data: settings } = await supabase.from('cash_piggy_settings').select('*')
        .eq('tg_id', req.tg_id).maybeSingle();

    let deposited = 0, withdrew = 0;
    (items || []).forEach(x => {
        if (x.type === 'deposit') deposited += Number(x.amount);
        else withdrew += Number(x.amount);
    });
    const balance = deposited - withdrew;
    const fact = Number(settings?.fact_amount || 0);
    const debt = balance - fact;

    res.json({
        items: items || [],
        factAmount: fact,
        totals: { deposited, withdrew, balance, fact, debt },
    });
});

router.post('/piggy', authMiddleware, async (req, res) => {
    const { type, amount, description, date } = req.body;
    if (!['deposit','withdraw'].includes(type)) return res.status(400).json({ error: 'invalid type' });
    const { data, error } = await supabase.from('cash_piggy').insert({
        tg_id: req.tg_id, type, amount: Number(amount) || 0,
        description: description || null, date: date || localDate(new Date()),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.patch('/piggy/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.amount !== undefined) updates.amount = Number(req.body.amount) || 0;
    if (req.body.description !== undefined) updates.description = req.body.description || null;
    if (req.body.date !== undefined) updates.date = req.body.date || null;
    const { data, error } = await supabase.from('cash_piggy').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/piggy/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_piggy').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/piggy/fact', authMiddleware, async (req, res) => {
    const fact = Number(req.body.fact_amount) || 0;
    const { data: existing } = await supabase.from('cash_piggy_settings').select('tg_id')
        .eq('tg_id', req.tg_id).maybeSingle();
    let r;
    if (existing) {
        r = await supabase.from('cash_piggy_settings').update({ fact_amount: fact, updated_at: new Date().toISOString() })
            .eq('tg_id', req.tg_id).select().single();
    } else {
        r = await supabase.from('cash_piggy_settings').insert({ tg_id: req.tg_id, fact_amount: fact }).select().single();
    }
    if (r.error) return res.status(500).json({ error: r.error.message });
    res.json({ settings: r.data });
});

module.exports = router;