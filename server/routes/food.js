// ==========================================
// ===== ROUTES: FOOD =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { authMiddleware } = require('../auth');

// ==========================================
// КАТЕГОРИИ РЕЦЕПТОВ
// ==========================================
router.get('/categories', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('food_recipe_categories').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    res.json({ categories: data || [] });
});

router.post('/categories', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('food_recipe_categories').insert({
        tg_id: req.tg_id, name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ category: data });
});

router.patch('/categories/:id', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('food_recipe_categories').update({ name })
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ category: data });
});

router.delete('/categories/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_recipes').update({ category_id: null })
        .eq('category_id', req.params.id).eq('tg_id', req.tg_id);
    await supabase.from('food_recipe_categories').delete()
        .eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ==========================================
// ПРОДУКТЫ
// ==========================================
router.get('/products', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('food_products').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('name');
    res.json({ products: data || [] });
});

router.post('/products', authMiddleware, async (req, res) => {
    const { name, unit, kcal, protein, fat, carbs, price, price_amount } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('food_products').insert({
        tg_id: req.tg_id, name: name.trim(),
        unit: unit || 'г',
        kcal: Number(kcal) || 0,
        protein: Number(protein) || 0,
        fat: Number(fat) || 0,
        carbs: Number(carbs) || 0,
        price: Number(price) || 0,
        price_amount: Number(price_amount) || 100,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: data });
});

router.patch('/products/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.unit !== undefined) updates.unit = req.body.unit;
    ['kcal','protein','fat','carbs','price','price_amount'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = Number(req.body[k]) || 0;
    });
    const { data, error } = await supabase.from('food_products').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ product: data });
});

router.delete('/products/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_products').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ==========================================
// РЕЦЕПТЫ
// ==========================================
router.get('/recipes', authMiddleware, async (req, res) => {
    const { data: recipes } = await supabase.from('food_recipes').select('*')
        .eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    if (!recipes?.length) return res.json({ recipes: [] });

    const ids = recipes.map(r => r.id);
    const { data: ings } = await supabase.from('food_recipe_ingredients').select('*').in('recipe_id', ids);

    const productIds = [...new Set((ings || []).map(i => i.product_id))];
    const { data: products } = productIds.length
        ? await supabase.from('food_products').select('*').in('id', productIds)
        : { data: [] };

    const pMap = {};
    (products || []).forEach(p => { pMap[p.id] = p; });

    const byRecipe = {};
    (ings || []).forEach(i => {
        (byRecipe[i.recipe_id] ||= []).push({ ...i, product: pMap[i.product_id] || null });
    });

    // Считаем КБЖУ на порцию
    const result = recipes.map(r => {
        const list = byRecipe[r.id] || [];
        let kcal = 0, protein = 0, fat = 0, carbs = 0;
        list.forEach(ing => {
            if (!ing.product) return;
            const k = ing.product.unit === 'шт' ? ing.amount : ing.amount / 100;
            kcal += Number(ing.product.kcal) * k;
            protein += Number(ing.product.protein) * k;
            fat += Number(ing.product.fat) * k;
            carbs += Number(ing.product.carbs) * k;
        });
        const portions = r.portions || 1;
        return {
            ...r,
            ingredients: list,
            perPortion: {
                kcal: Math.round(kcal / portions),
                protein: Math.round(protein / portions * 10) / 10,
                fat: Math.round(fat / portions * 10) / 10,
                carbs: Math.round(carbs / portions * 10) / 10,
            },
        };
    });

    res.json({ recipes: result });
});

router.post('/recipes', authMiddleware, async (req, res) => {
    const { name, category_id, portions, instructions, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('food_recipes').insert({
        tg_id: req.tg_id, name: name.trim(),
        category_id: category_id || null,
        portions: Number(portions) || 1,
        instructions: instructions || null,
        notes: notes || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ recipe: { ...data, ingredients: [], perPortion: { kcal: 0, protein: 0, fat: 0, carbs: 0 } } });
});

router.patch('/recipes/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    if (req.body.category_id !== undefined) updates.category_id = req.body.category_id || null;
    if (req.body.portions !== undefined) updates.portions = Number(req.body.portions) || 1;
    if (req.body.instructions !== undefined) updates.instructions = req.body.instructions || null;
    if (req.body.notes !== undefined) updates.notes = req.body.notes || null;
    const { data, error } = await supabase.from('food_recipes').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ recipe: data });
});

router.delete('/recipes/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_recipes').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ---------- Ингредиенты рецепта ----------
router.post('/recipes/:id/ingredients', authMiddleware, async (req, res) => {
    const { product_id, amount } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id required' });
    const { data, error } = await supabase.from('food_recipe_ingredients').insert({
        recipe_id: req.params.id,
        product_id,
        amount: Number(amount) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ingredient: data });
});

router.patch('/ingredients/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.amount !== undefined) updates.amount = Number(req.body.amount) || 0;
    if (req.body.product_id !== undefined) updates.product_id = req.body.product_id;
    const { data, error } = await supabase.from('food_recipe_ingredients').update(updates)
        .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ingredient: data });
});

router.delete('/ingredients/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_recipe_ingredients').delete().eq('id', req.params.id);
    res.json({ ok: true });
});

// ==========================================
// ПЛАН ПИТАНИЯ
// ==========================================
router.get('/plan', authMiddleware, async (req, res) => {
    const { from, to } = req.query;
    let q = supabase.from('food_plan').select('*').eq('tg_id', req.tg_id);
    if (from) q = q.gte('day', from);
    if (to) q = q.lte('day', to);
    const { data } = await q.order('day').order('sort_order');
    res.json({ plan: data || [] });
});

router.post('/plan', authMiddleware, async (req, res) => {
    const { day, meal_name, recipe_id, portions } = req.body;
    if (!day || !meal_name || !recipe_id) return res.status(400).json({ error: 'day, meal_name, recipe_id required' });
    const { data, error } = await supabase.from('food_plan').insert({
        tg_id: req.tg_id, day, meal_name, recipe_id,
        portions: Number(portions) || 1,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/plan/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_plan').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ==========================================
// ДНЕВНИК
// ==========================================
router.get('/diary', authMiddleware, async (req, res) => {
    const day = req.query.day;
    if (!day) return res.status(400).json({ error: 'day required' });
    const { data: entries } = await supabase.from('food_diary').select('*')
        .eq('tg_id', req.tg_id).eq('day', day).order('sort_order').order('created_at');
    if (!entries?.length) return res.json({ entries: [] });

    // Подтягиваем названия рецептов и продуктов
    const recipeIds = [...new Set(entries.filter(e => e.recipe_id).map(e => e.recipe_id))];
    const productIds = [...new Set(entries.filter(e => e.product_id).map(e => e.product_id))];

    const [{ data: recipes }, { data: products }] = await Promise.all([
        recipeIds.length ? supabase.from('food_recipes').select('id, name').in('id', recipeIds) : Promise.resolve({ data: [] }),
        productIds.length ? supabase.from('food_products').select('id, name, unit').in('id', productIds) : Promise.resolve({ data: [] }),
    ]);

    const rMap = {};
    (recipes || []).forEach(r => { rMap[r.id] = r; });
    const pMap = {};
    (products || []).forEach(p => { pMap[p.id] = p; });

    const result = entries.map(e => {
        let displayName = '';
        let displayUnit = '';
        if (e.source === 'recipe' && e.recipe_id) {
            displayName = rMap[e.recipe_id]?.name || 'Рецепт';
            displayUnit = e.amount ? `× ${e.amount} порц.` : '';
        } else if (e.source === 'product' && e.product_id) {
            displayName = pMap[e.product_id]?.name || 'Продукт';
            displayUnit = e.amount ? `${e.amount} ${pMap[e.product_id]?.unit || 'г'}` : '';
        } else {
            displayName = e.oneoff_name || 'Разовое';
        }
        return { ...e, displayName, displayUnit };
    });

    res.json({ entries: result });
});

router.post('/diary', authMiddleware, async (req, res) => {
    const { day, meal_name, source, recipe_id, product_id, oneoff_name, amount, kcal, protein, fat, carbs } = req.body;
    if (!day || !meal_name || !source) return res.status(400).json({ error: 'day, meal_name, source required' });
    const { data, error } = await supabase.from('food_diary').insert({
        tg_id: req.tg_id, day, meal_name, source,
        recipe_id: recipe_id || null,
        product_id: product_id || null,
        oneoff_name: oneoff_name || null,
        amount: Number(amount) || 0,
        kcal: Number(kcal) || 0,
        protein: Number(protein) || 0,
        fat: Number(fat) || 0,
        carbs: Number(carbs) || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ entry: data });
});

router.patch('/diary/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['meal_name','oneoff_name'].forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    ['amount','kcal','protein','fat','carbs'].forEach(k => { if (req.body[k] !== undefined) updates[k] = Number(req.body[k]) || 0; });
    const { data, error } = await supabase.from('food_diary').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ entry: data });
});

router.delete('/diary/:id', authMiddleware, async (req, res) => {
    await supabase.from('food_diary').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

// ==========================================
// ПРОФИЛЬ + ЦЕЛЬ
// ==========================================
router.get('/goals', authMiddleware, async (req, res) => {
    const { data } = await supabase.from('food_goals').select('*').eq('tg_id', req.tg_id).maybeSingle();
    res.json({ goals: data || null });
});

router.post('/goals', authMiddleware, async (req, res) => {
    const { gender, age, weight, height, activity, goal, deficit_percent } = req.body;
    const payload = {
        tg_id: req.tg_id,
        gender: gender || null,
        age: age ? Number(age) : null,
        weight: weight ? Number(weight) : null,
        height: height ? Number(height) : null,
        activity: activity || null,
        goal: goal || 'maintain',
        deficit_percent: Number(deficit_percent) || 0,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('food_goals').upsert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ goals: data });
});

// ==========================================
// ШОППИНГ-ЛИСТ
// ==========================================
router.get('/shopping', authMiddleware, async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    // Берём записи из дневника за период
    const { data: entries } = await supabase.from('food_diary').select('*')
        .eq('tg_id', req.tg_id).gte('day', from).lte('day', to);
    if (!entries?.length) return res.json({ items: [], total: 0 });

    const recipeIds = [...new Set(entries.filter(e => e.recipe_id).map(e => e.recipe_id))];
    const productIdsDirect = [...new Set(entries.filter(e => e.product_id).map(e => e.product_id))];

    // Ингредиенты рецептов
    const { data: ings } = recipeIds.length
        ? await supabase.from('food_recipe_ingredients').select('*').in('recipe_id', recipeIds)
        : { data: [] };

    // Собираем все product_id
    const allProductIds = [...new Set([
        ...productIdsDirect,
        ...(ings || []).map(i => i.product_id),
    ])];

    const { data: products } = allProductIds.length
        ? await supabase.from('food_products').select('*').in('id', allProductIds)
        : { data: [] };

    const pMap = {};
    (products || []).forEach(p => { pMap[p.id] = p; });

    // Складываем
    const totals = {};

    // 1) Прямые продукты (source=product, oneoff не считаем — у него нет product_id)
    entries.forEach(e => {
        if (e.product_id && e.amount) {
            if (!totals[e.product_id]) totals[e.product_id] = 0;
            totals[e.product_id] += Number(e.amount);
        }
    });

    // 2) Ингредиенты рецептов (amount в diary = количество порций)
    // Ингредиенты рецепта — на N порций (recipe.portions). Чтобы получить на 1 порцию — делим.
    // Но у нас нет portions рецепта в этой выборке. Подтянем.
    if (recipeIds.length && ings?.length) {
        const { data: recipes } = await supabase.from('food_recipes').select('id, portions')
            .in('id', recipeIds);
        const rPortions = {};
        (recipes || []).forEach(r => { rPortions[r.id] = r.portions || 1; });

        const entryPortions = {}; // recipe_id -> сумма порций
        entries.forEach(e => {
            if (!e.recipe_id) return;
            entryPortions[e.recipe_id] = (entryPortions[e.recipe_id] || 0) + (Number(e.amount) || 1);
        });

        (ings || []).forEach(ing => {
            const totalPortions = entryPortions[ing.recipe_id];
            if (!totalPortions) return;
            const portionsInRecipe = rPortions[ing.recipe_id] || 1;
            const amount = Number(ing.amount) * (totalPortions / portionsInRecipe);
            if (!totals[ing.product_id]) totals[ing.product_id] = 0;
            totals[ing.product_id] += amount;
        });
    }

    const items = Object.entries(totals).map(([pid, amount]) => {
        const p = pMap[pid];
        if (!p) return null;
        const pa = Number(p.price_amount) || 100;
        const cost = pa > 0 ? (amount / pa) * Number(p.price || 0) : 0;
        return {
            product: p,
            amount: Math.round(amount * 100) / 100,
            cost: Math.round(cost * 100) / 100,
        };
    }).filter(Boolean);

    const total = items.reduce((s, x) => s + x.cost, 0);
    res.json({ items, total: Math.round(total * 100) / 100 });
});

module.exports = router;