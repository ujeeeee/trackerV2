// ==========================================
// ===== ROUTES: FILM =====
// ==========================================
const express = require('express');
const router = express.Router();
const { supabase, localDate } = require('../db');
const { authMiddleware } = require('../auth');

router.get('/', authMiddleware, async (req, res) => {
    const { data: genres } = await supabase.from('film_genres').select('*').eq('tg_id', req.tg_id).order('sort_order').order('created_at');
    const { data: movies } = await supabase.from('film_movies').select('*')
        .eq('tg_id', req.tg_id).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

    const result = (genres || []).map(g => ({
        ...g,
        movies: (movies || []).filter(m => m.genre_id === g.id),
    }));
    const orphans = (movies || []).filter(m => !m.genre_id);
    res.json({ genres: result, orphans });
});

router.post('/genres', authMiddleware, async (req, res) => {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('film_genres').insert({
        tg_id: req.tg_id, name,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ genre: { ...data, movies: [] } });
});

router.patch('/genres/:id', authMiddleware, async (req, res) => {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name.trim();
    const { data, error } = await supabase.from('film_genres').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ genre: data });
});

router.delete('/genres/:id', authMiddleware, async (req, res) => {
    await supabase.from('film_movies').update({ genre_id: null })
        .eq('genre_id', req.params.id).eq('tg_id', req.tg_id);
    await supabase.from('film_genres').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.delete('/orphans', authMiddleware, async (req, res) => {
    await supabase.from('film_movies').delete().eq('tg_id', req.tg_id).is('genre_id', null);
    res.json({ ok: true });
});

router.post('/movies', authMiddleware, async (req, res) => {
    const { title, year, genre_id, status, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const { data, error } = await supabase.from('film_movies').insert({
        tg_id: req.tg_id, title: title.trim(),
        year: year ? parseInt(year) : null,
        genre_id: genre_id || null,
        status: status || 'want',
        priority: priority ? parseInt(priority) : null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ movie: data });
});

router.patch('/movies/:id', authMiddleware, async (req, res) => {
    const updates = {};
    ['title','status','review','genre_id'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (updates.title) updates.title = updates.title.trim();
    ['year','priority','rating'].forEach(k => {
        if (req.body[k] !== undefined) updates[k] = req.body[k] ? parseInt(req.body[k]) : null;
    });
    if (req.body.status === 'watched') updates.watched_at = localDate(new Date());

    const { data, error } = await supabase.from('film_movies').update(updates)
        .eq('id', req.params.id).eq('tg_id', req.tg_id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ movie: data });
});

router.delete('/movies/:id', authMiddleware, async (req, res) => {
    await supabase.from('film_movies').delete().eq('id', req.params.id).eq('tg_id', req.tg_id);
    res.json({ ok: true });
});

router.get('/random', authMiddleware, async (req, res) => {
    const type = req.query.type === 'rewatch' ? 'watched' : 'want';
    const { data } = await supabase.from('film_movies').select('*')
        .eq('tg_id', req.tg_id).eq('status', type);
    if (!data?.length) return res.json({ movie: null, type });

    let sorted;
    if (type === 'want') {
        sorted = data.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        const top = sorted[0].priority || 0;
        const pool = sorted.filter(m => (m.priority || 0) === top);
        return res.json({ movie: pool[Math.floor(Math.random() * pool.length)], type });
    } else {
        sorted = data.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const top = sorted[0].rating || 0;
        const pool = sorted.filter(m => (m.rating || 0) === top);
        return res.json({ movie: pool[Math.floor(Math.random() * pool.length)], type });
    }
});

module.exports = router;