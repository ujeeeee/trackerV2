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

// ==========================================
// CASH: ПРОДУКТЫ
// ==========================================
router.get('/products', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('cash_products').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    res.json({ products: data || [] });
});

router.post('/products', authMiddleware, async (req, res) => {
    const { name, pack_amount, pack_unit, pack_price } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_products').insert({
        tg_id: req.tg_id, name: name.trim(),
        pack_amount: Number(pack_amount) || 1,
        pack_unit: pack_unit || 'г',
        pack_price: Number(pack_price) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: data });
});

router.patch('/products/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.pack_amount !== undefined) updates.pack_amount = Number(req.body.pack_amount) || 1;
    if (req.body.pack_unit !== undefined) updates.pack_unit = req.body.pack_unit;
    if (req.body.pack_price !== undefined) updates.pack_price = Number(req.body.pack_price) || 0;
    const { data, error } = await supabase.from('cash_products').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: data });
});

router.delete('/products/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_products').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ==========================================
// CASH: БЛЮДА
// ==========================================
router.get('/dishes', authMiddleware, async (req, res) => {
    const { data: dishes } = await supabase.from('cash_dishes').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    if (!dishes?.length) return res.json({ dishes: [] });

    const ids = dishes.map(d => d.id);
    const { data: ings } = await supabase.from('cash_dish_ingredients').select('*').in('dish_id', ids);
    const productIds = [...new Set((ings || []).map(i => i.product_id))];
    const { data: products } = productIds.length
        ? await supabase.from('cash_products').select('*').in('id', productIds)
        : { data: [] };
    const pMap = {};
    (products || []).forEach(p => { pMap[p.id] = p; });

    const byDish = {};
    (ings || []).forEach(i => {
        (byDish[i.dish_id] ||= []).push({ ...i, product: pMap[i.product_id] || null });
    });

    res.json({ dishes: dishes.map(d => ({ ...d, ingredients: byDish[d.id] || [] })) });
});

router.post('/dishes', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('cash_dishes').insert({
        tg_id: req.tg_id, name, recipe: req.body.recipe || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ dish: { ...data, ingredients: [] } });
});

router.patch('/dishes/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.recipe !== undefined) updates.recipe = req.body.recipe || null;
    const { data, error } = await supabase.from('cash_dishes').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ dish: data });
});

router.delete('/dishes/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_dishes').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/dishes/:id/ingredients', authMiddleware, async (req, res) => {
    const { product_id, amount } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    const { data, error } = await supabase.from('cash_dish_ingredients').insert({
        dish_id: req.params.id, product_id, amount: Number(amount) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ingredient: data });
});

router.delete('/ingredients/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_dish_ingredients').delete().eq('id', req.params.id);
    res.json({ ok: true });
});

// ==========================================
// CASH: КОРЗИНА / СПИСОК ПОКУПОК
// ==========================================
router.get('/shopping', authMiddleware, async (req, res) => {
    const { data: basket } = await supabase.from('cash_shopping_basket').select('*')
        .eq('tg_id', req.tg_id).order('created_at');
    if (!basket?.length) return res.json({ basket: [], items: [], total: 0 });

    const dishIds = [...new Set(basket.map(b => b.dish_id))];
    const { data: dishes } = await supabase.from('cash_dishes').select('id, name').in('id', dishIds);
    const dMap = {};
    (dishes || []).forEach(d => { dMap[d.id] = d; });

    const { data: ings } = await supabase.from('cash_dish_ingredients').select('*').in('dish_id', dishIds);
    const productIds = [...new Set((ings || []).map(i => i.product_id))];
    const { data: products } = productIds.length
        ? await supabase.from('cash_products').select('*').in('id', productIds)
        : { data: [] };
    const pMap = {};
    (products || []).forEach(p => { pMap[p.id] = p; });

    const totals = {};
    basket.forEach(b => {
        (ings || []).filter(i => i.dish_id === b.dish_id).forEach(ing => {
            const add = Number(ing.amount) * Number(b.portions);
            if (!totals[ing.product_id]) totals[ing.product_id] = 0;
            totals[ing.product_id] += add;
        });
    });

    const { data: checked } = await supabase.from('cash_shopping_checked').select('product_id')
        .eq('tg_id', req.tg_id);
    const checkedSet = new Set((checked || []).map(c => c.product_id));

    let total = 0;
    const items = Object.entries(totals).map(([pid, amount]) => {
        const p = pMap[pid];
        if (!p) return null;
        const cost = p.pack_amount > 0 ? (amount / Number(p.pack_amount)) * Number(p.pack_price || 0) : 0;
        if (!checkedSet.has(Number(pid))) total += cost;
        return {
            product: p,
            amount: Math.round(amount * 100) / 100,
            cost: Math.round(cost * 100) / 100,
            checked: checkedSet.has(Number(pid)),
        };
    }).filter(Boolean);

    res.json({
        basket: basket.map(b => ({ ...b, dish_name: dMap[b.dish_id]?.name || '—' })),
        items,
        total: Math.round(total * 100) / 100,
    });
});

router.post('/shopping', authMiddleware, async (req, res) => {
    const { dish_id, portions } = req.body;
    if (!dish_id) return res.status(400).json({ error: 'dish_id required' });
    const { data: existing } = await supabase.from('cash_shopping_basket').select('id')
        .eq('tg_id', req.tg_id).eq('dish_id', dish_id).maybeSingle();
    let r;
    if (existing) {
        r = await supabase.from('cash_shopping_basket')
            .update({ portions: Number(portions) || 1 }).eq('id', existing.id).select().single();
    } else {
        r = await supabase.from('cash_shopping_basket')
            .insert({ tg_id: req.tg_id, dish_id, portions: Number(portions) || 1 }).select().single();
    }
    if (r.error) return res.status(500).json({ error: r.error.message });
    res.json({ item: r.data });
});

router.delete('/shopping/:id', authMiddleware, async (req, res) => {
    await supabase.from('cash_shopping_basket').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.delete('/shopping', authMiddleware, async (req, res) => {
    await supabase.from('cash_shopping_basket').delete().eq('tg_id', req.tg_id);
    await supabase.from('cash_shopping_checked').delete().eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.post('/shopping/check/:productId', authMiddleware, async (req, res) => {
    const pid = Number(req.params.productId);
    const { data: existing } = await supabase.from('cash_shopping_checked').select('*')
        .eq('tg_id', req.tg_id).eq('product_id', pid).maybeSingle();
    if (existing) {
        await supabase.from('cash_shopping_checked').delete()
            .eq('tg_id', req.tg_id).eq('product_id', pid);
    } else {
        await supabase.from('cash_shopping_checked').insert({ tg_id: req.tg_id, product_id: pid });
    }
    res.json({ ok: true });
});

module.exports = router;