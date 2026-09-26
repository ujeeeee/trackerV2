// ==========================================
// ===== ENTRY POINT =====
// ==========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { supabase } = require('./db');
const { authMiddleware } = require('./auth');
const { localDate } = require('./db'); // экспортируем из db для краткости

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- HEALTH ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- AUTH ----------
app.post('/api/auth', authMiddleware, async (req, res) => {
    const u = req.user;
    const { data: existing } = await supabase.from('users').select('id').eq('id', u.id).maybeSingle();
    const payload = {
        username: u.username || null,
        first_name: u.first_name || null,
        last_name: u.last_name || null,
        photo_url: u.photo_url || null,
        language_code: u.language_code || null,
    };
    if (existing) {
        await supabase.from('users').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', u.id);
    } else {
        await supabase.from('users').insert({ id: u.id, ...payload });
    }
    res.json({
        ok: true,
        user: { id: u.id, name: u.first_name || u.username || 'Друг', username: u.username || null },
    });
});

// ---------- ROUTERS ----------
app.use('/api', require('./routes/main'));
app.use('/api/disc', require('./routes/discipline'));
app.use('/api/cash', require('./routes/cash'));
app.use('/api/gym', require('./routes/gym'));
app.use('/api/film', require('./routes/film'));
app.use('/api/tea', require('./routes/tea'));
app.use('/api/places', require('./routes/places'));
app.use('/api/food', require('./routes/food'));

// ---------- REORDER ----------
const REORDER_WHITELIST = [
    'disc_areas','disc_goals','disc_habits','disc_todos',
    'cash_custom_stats','cash_subs','cash_weekly','cash_wishlist','cash_wishlist_areas','cash_piggy',
    'gym_programs','gym_program_days','gym_exercises','gym_metrics',
    'film_genres','film_movies',
    'tea_groups','tea_items','tea_shops',
    'places_types','places_items',
];

app.post('/api/reorder', authMiddleware, async (req, res) => {
    const { table, ids } = req.body;
    if (!REORDER_WHITELIST.includes(table)) return res.status(400).json({ error: 'Table not allowed' });
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    try {
        for (let i = 0; i < ids.length; i++) {
            await supabase.from(table).update({ sort_order: i + 1 }).eq('id', ids[i]);
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- BACKUP ----------
const BACKUP_SECTIONS = {
    discipline: ['disc_areas','disc_goals','disc_habits','disc_habit_logs','disc_todos'],
    cash: ['cash_budget','cash_custom_stats','cash_subs','cash_weekly','cash_expenses',
           'cash_wishlist_areas','cash_wishlist','cash_piggy','cash_piggy_settings'],
    gym: ['gym_metrics','gym_metric_logs','gym_programs','gym_program_days','gym_exercises','gym_exercise_sets'],
    film: ['film_genres','film_movies'],
    tea: ['tea_groups','tea_items','tea_shops'],
    places: ['places_types','places_items'],
food: ['food_recipe_categories','food_products','food_recipes','food_recipe_ingredients',
       'food_plan','food_diary','food_goals'],
};

async function collectBackup(tgId, sections) {
    const data = {};
    for (const section of sections) {
        const tables = BACKUP_SECTIONS[section];
        if (!tables) continue;
        data[section] = {};
        for (const table of tables) {
            const { data: rows } = await supabase.from(table).select('*').eq('tg_id', tgId);
            data[section][table] = rows || [];
        }
    }
    return {
        exported_at: new Date().toISOString(),
        tg_id: tgId,
        sections,
        data,
    };
}

app.get('/api/backup/section/:section', authMiddleware, async (req, res) => {
    const section = req.params.section;
    if (!BACKUP_SECTIONS[section]) return res.status(400).json({ error: 'Unknown section' });
    const backup = await collectBackup(req.tg_id, [section]);
    res.json(backup);
});

app.get('/api/backup/all', authMiddleware, async (req, res) => {
    const sections = Object.keys(BACKUP_SECTIONS);
    const backup = await collectBackup(req.tg_id, sections);
    res.json(backup);
});

app.post('/api/backup/save-github', authMiddleware, async (req, res) => {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        return res.status(400).json({ error: 'GitHub не настроен. Добавь GITHUB_TOKEN и GITHUB_REPO на сервере.' });
    }
    try {
        const section = req.body.section || 'all';
        const sections = section === 'all' ? Object.keys(BACKUP_SECTIONS) : [section];
        const backup = await collectBackup(req.tg_id, sections);

        const [owner, repo] = GITHUB_REPO.split('/');
        const octokit = new Octokit({ auth: GITHUB_TOKEN });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backups/${req.tg_id}/${section}-${timestamp}.json`;
        const content = Buffer.from(JSON.stringify(backup, null, 2)).toString('base64');

        await octokit.repos.createOrUpdateFileContents({
            owner, repo,
            path: filename,
            message: `backup ${section} ${new Date().toISOString()}`,
            content,
        });

        res.json({ ok: true, file: filename });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/backup/send-tg', authMiddleware, async (req, res) => {
    try {
        const section = req.body.section || 'all';
        const sections = section === 'all' ? Object.keys(BACKUP_SECTIONS) : [section];
        const backup = await collectBackup(req.tg_id, sections);

        const json = JSON.stringify(backup, null, 2);
        const filename = `tracker-${section}-${localDate(new Date())}.json`;

        const form = new FormData();
        form.append('chat_id', String(req.tg_id));
        form.append('document', new Blob([json], { type: 'application/json' }), filename);
        form.append('caption', `Бекап: ${section}`);

        const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            body: form,
        });
        const result = await r.json();
        if (!result.ok) throw new Error(result.description || 'Telegram API error');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- IMPORT ----------
app.post('/api/import/film', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentGenreId = null, added = 0, genresAdded = 0;

    const { data: existingGenres } = await supabase.from('film_genres').select('id, name').eq('tg_id', req.tg_id);
    const genreMap = {};
    (existingGenres || []).forEach(g => { genreMap[g.name.toLowerCase()] = g.id; });

    const { data: maxG } = await supabase.from('film_genres').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let genreOrder = (maxG?.sort_order || 0) + 1;

    const { data: maxM } = await supabase.from('film_movies').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let movieOrder = (maxM?.sort_order || 0) + 1;

    for (const line of lines) {
        if (line.startsWith('#')) {
            const name = line.replace(/^#\s*/, '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (genreMap[key]) currentGenreId = genreMap[key];
            else {
                const { data: g } = await supabase.from('film_genres').insert({
                    tg_id: req.tg_id, name, sort_order: genreOrder++,
                }).select().single();
                if (g) { currentGenreId = g.id; genreMap[key] = g.id; genresAdded++; }
            }
            continue;
        }
        const parts = line.split('|').map(p => p.trim());
        const title = parts[0];
        if (!title) continue;
        const year = parts[1] ? parseInt(parts[1]) : null;
        const prio = parts[2] ? parseInt(parts[2]) : null;
        const { error } = await supabase.from('film_movies').insert({
            tg_id: req.tg_id, genre_id: currentGenreId, title,
            year: isNaN(year) ? null : year,
            priority: (prio >= 1 && prio <= 5) ? prio : null,
            status: 'want', sort_order: movieOrder++,
        });
        if (!error) added++;
    }
    res.json({ added, groupsAdded: genresAdded });
});

app.post('/api/import/tea', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentGroupId = null, added = 0, groupsAdded = 0;

    const { data: existing } = await supabase.from('tea_groups').select('id, name').eq('tg_id', req.tg_id);
    const groupMap = {};
    (existing || []).forEach(g => { groupMap[g.name.toLowerCase()] = g.id; });

    const { data: maxG } = await supabase.from('tea_groups').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let groupOrder = (maxG?.sort_order || 0) + 1;

    const { data: maxI } = await supabase.from('tea_items').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let itemOrder = (maxI?.sort_order || 0) + 1;

    for (const line of lines) {
        if (line.startsWith('#')) {
            const name = line.replace(/^#\s*/, '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (groupMap[key]) currentGroupId = groupMap[key];
            else {
                const { data: g } = await supabase.from('tea_groups').insert({
                    tg_id: req.tg_id, name, sort_order: groupOrder++,
                }).select().single();
                if (g) { currentGroupId = g.id; groupMap[key] = g.id; groupsAdded++; }
            }
            continue;
        }
        const parts = line.split('|').map(p => p.trim());
        const name = parts[0];
        if (!name) continue;
        const temp_c = parts[1] || null;
        const review = parts[2] || null;
        const { error } = await supabase.from('tea_items').insert({
            tg_id: req.tg_id, group_id: currentGroupId, name,
            temp_c: temp_c,
            review: review,
            sort_order: itemOrder++,
        });
        if (!error) added++;
    }
    res.json({ added, groupsAdded });
});

app.post('/api/import/places', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentTypeId = null, added = 0, typesAdded = 0;

    const { data: existing } = await supabase.from('places_types').select('id, name').eq('tg_id', req.tg_id);
    const typeMap = {};
    (existing || []).forEach(t => { typeMap[t.name.toLowerCase()] = t.id; });

    const { data: maxT } = await supabase.from('places_types').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let typeOrder = (maxT?.sort_order || 0) + 1;

    const { data: maxI } = await supabase.from('places_items').select('sort_order').eq('tg_id', req.tg_id)
        .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    let itemOrder = (maxI?.sort_order || 0) + 1;

    for (const line of lines) {
        if (line.startsWith('#')) {
            const name = line.replace(/^#\s*/, '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (typeMap[key]) currentTypeId = typeMap[key];
            else {
                const { data: t } = await supabase.from('places_types').insert({
                    tg_id: req.tg_id, name, sort_order: typeOrder++,
                }).select().single();
                if (t) { currentTypeId = t.id; typeMap[key] = t.id; typesAdded++; }
            }
            continue;
        }
        const parts = line.split('|').map(p => p.trim());
        const name = parts[0];
        if (!name) continue;
        const country = parts[1] || null;
        const city = parts[2] || null;
        const map_url = parts[3] || null;
        const review = parts[4] || null;
        const { error } = await supabase.from('places_items').insert({
            tg_id: req.tg_id, type_id: currentTypeId, name,
            country: country,
            city: city,
            map_url: map_url,
            review: review,
            status: 'want', sort_order: itemOrder++,
        });
        if (!error) added++;
    }
    res.json({ added, groupsAdded: typesAdded });
});

app.post('/api/import/wishlist', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentArea = null, added = 0, areasAdded = 0;

    const { data: existing } = await supabase.from('cash_wishlist_areas').select('id, name').eq('tg_id', req.tg_id);
    const areaMap = {};
    (existing || []).forEach(a => { areaMap[a.name.toLowerCase()] = a.name; });

    for (const line of lines) {
        if (line.startsWith('#')) {
            const name = line.replace(/^#\s*/, '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (areaMap[key]) currentArea = areaMap[key];
            else {
                await supabase.from('cash_wishlist_areas').insert({ tg_id: req.tg_id, name });
                areaMap[key] = name;
                currentArea = name;
                areasAdded++;
            }
            continue;
        }
        const parts = line.split('|').map(p => p.trim());
        const title = parts[0];
        if (!title) continue;
        const year = parts[1] ? parseInt(parts[1]) : null;
        const { error } = await supabase.from('film_movies').insert({
            tg_id: req.tg_id, genre_id: currentGenreId, title,
            year: isNaN(year) ? null : year,
            status: 'want', sort_order: movieOrder++,
        });
        if (!error) added++;
    }
    res.json({ added, groupsAdded: areasAdded });
});

app.post('/api/import/todos', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0;

    for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        const name = parts[0];
        if (!name) continue;
        const dateStr = parts[1] || null;
        let dateVal = null;
        if (dateStr) {
            const m1 = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
            const m2 = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (m1) dateVal = `20${m1[3]}-${m1[2]}-${m1[1]}`;
            else if (m2) dateVal = dateStr;
        }
        const { error } = await supabase.from('disc_todos').insert({
            tg_id: req.tg_id, name, date: dateVal,
            time_start: parts[2] || null,
            time_end: parts[3] || null,
        });
        if (!error) added++;
    }
    res.json({ added });
});

app.post('/api/import/discipline', authMiddleware, async (req, res) => {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentAreaId = null, added = 0, areasAdded = 0;

    const { data: existing } = await supabase.from('disc_areas').select('id, name').eq('tg_id', req.tg_id);
    const areaMap = {};
    (existing || []).forEach(a => { areaMap[a.name.toLowerCase()] = a.id; });

    for (const line of lines) {
        if (line.startsWith('#')) {
            const name = line.replace(/^#\s*/, '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (areaMap[key]) currentAreaId = areaMap[key];
            else {
                const { data: a } = await supabase.from('disc_areas').insert({
                    tg_id: req.tg_id, name,
                }).select().single();
                if (a) { currentAreaId = a.id; areaMap[key] = a.id; areasAdded++; }
            }
            continue;
        }
        const name = line.split('|')[0].trim();
        if (!name) continue;
        const { error } = await supabase.from('disc_goals').insert({
            tg_id: req.tg_id, name, area_id: currentAreaId, status: 'plan',
        });
        if (!error) added++;
    }
    res.json({ added, groupsAdded: areasAdded });
});

// ---------- START ----------
app.listen(PORT, () => {
    console.log(`🚀 Tracker: http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
});