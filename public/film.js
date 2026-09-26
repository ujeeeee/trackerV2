// ==========================================
// ===== FILM =====
// ==========================================
let filmGenres = [];
let filmOrphans = [];
let filmGenreCtx = { id: null };
let filmCtx = { id: null, genreId: null, priority: null, rating: null, status: 'want' };
let filmRandomType = 'want';

async function loadFilm() {
    try {
        const { genres, orphans } = await api('/api/film');
        filmGenres = genres;
        filmOrphans = orphans;
        renderFilmGenres();
        renderFilmWatched();
    } catch (e) { console.error(e); }
}

function renderFilmGenres() {
    const c = document.getElementById('filmGenres');
    const all = [...filmGenres, { id: null, name: 'Без жанра', movies: filmOrphans }];

    c.innerHTML = all.map(g => {
        const isOrphan = !g.id;
        const movies = (g.movies || []).filter(m => m.status !== 'watched');
        const isOpen = !isCollapsed('filmGenres', isOrphan ? 0 : g.id);
        const nameClick = isOrphan ? '' : `onclick="openFilmGenreModal(${g.id})"`;

        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('filmGenres', 0); renderFilmGenres();">▶</span>
                <div class="group-name clickable" onclick="clearFilmOrphans()">Без жанра</div>
                <div class="group-count">${movies.length}</div>
                <button class="btn-icon-add" onclick="openFilmModal(null, null)">+</button>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('filmGenres', ${g.id}); renderFilmGenres();">▶</span>
                <div class="group-name clickable" ${nameClick}>${escapeHtml(g.name)}</div>
                <div class="group-count">${movies.length}</div>
                <button class="btn-icon-add" onclick="openFilmModal(null, ${g.id})">+</button>
            </div>`;

        const itemsHtml = isOpen
            ? (movies.length === 0 ? `<div class="widget-empty">Пусто</div>` : movies.map(m => filmItemHTML(m)).join(''))
            : '';

        return `<div class="film-genre-card ${isOpen ? 'open' : ''}" ${g.id ? `data-id="${g.id}"` : ''}>
            ${header}
            <div class="group-body">${itemsHtml}</div>
        </div>`;
    }).join('');

    const genresOnly = c.querySelectorAll('.film-genre-card[data-id]');
    if (genresOnly.length && window.Sortable) {
        if (!c._sortableGenres) {
            c._sortableGenres = new Sortable(c, {
                animation: 150,
                delay: 250,
                delayOnTouchOnly: true,
                draggable: '.film-genre-card[data-id]',
                onEnd: async () => {
                    const ids = [...c.querySelectorAll('.film-genre-card[data-id]')]
                        .map(el => parseInt(el.dataset.id)).filter(Boolean);
                    if (ids.length) await api('/api/reorder', 'POST', { table: 'film_genres', ids });
                }
            });
        }
    }

    c.querySelectorAll('.group-body').forEach(body => {
        if (!body.children.length) return;
        makeSortable(body, 'film_movies', { draggable: '[data-id]' });
    });
}

async function clearFilmOrphans() {
    const count = filmOrphans.filter(m => m.status !== 'watched').length;
    if (count === 0) return;
    if (!confirm(`Очистить все фильмы из «Без жанра» (${count})?`)) return;
    await api('/api/film/orphans', 'DELETE');
    await loadFilm();
}

function filmItemHTML(m) {
    const p = m.priority || 0;
    const pClass = p >= 5 ? 'p5' : p >= 4 ? 'p4' : p >= 3 ? 'p3' : '';
    const statusLabels = { want: 'Хочу', watching: 'Смотрю', watched: 'Видел' };
    return `<div class="list-item" data-id="${m.id}" onclick="openFilmModal(${m.id})">
        ${p ? `<div class="item-priority ${pClass}">${p}</div>` : ''}
        <div class="item-info">
            <div class="item-title">${escapeHtml(m.title)}</div>
            <div class="item-sub">${m.year || ''}${m.review ? ' · ' + escapeHtml(m.review.slice(0, 40)) : ''}</div>
        </div>
        ${m.rating ? `<div class="item-rating">★ ${m.rating}</div>` : ''}
        <div class="item-badge ${m.status}">${statusLabels[m.status] || ''}</div>
    </div>`;
}

function renderFilmWatched() {
    const c = document.getElementById('filmWatched');
    const byGenre = [];
    filmGenres.forEach(g => {
        const watched = (g.movies || []).filter(m => m.status === 'watched');
        if (watched.length) byGenre.push({ id: g.id, name: g.name, movies: watched });
    });
    const orphans = filmOrphans.filter(m => m.status === 'watched');
    if (orphans.length) byGenre.push({ id: null, name: 'Без жанра', movies: orphans });

    if (!byGenre.length) {
        c.innerHTML = `<div class="empty-state">Пока ничего не посмотрел</div>`;
        return;
    }

    c.innerHTML = byGenre.map(g => {
        const isOrphan = !g.id;
        const isOpen = !isCollapsed('filmWatched', isOrphan ? 0 : g.id);
        const sorted = [...g.movies].sort((a, b) => (b.rating || 0) - (a.rating || 0));

        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('filmWatched', 0); renderFilmWatched();">▶</span>
                <div class="group-name">Без жанраопа</div>
                <div class="group-count">${sorted.length}</div>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('filmWatched', ${g.id}); renderFilmWatched();">▶</span>
                <div class="group-name">${escapeHtml(g.name)}</div>
                <div class="group-count">${sorted.length}</div>
            </div>`;

        return `<div class="film-genre-card ${isOpen ? 'open' : ''}">
            ${header}
            <div class="group-body">${isOpen ? sorted.map(m => filmItemHTML(m)).join('') : ''}</div>
        </div>`;
    }).join('');
}

function openFilmGenreModal(id = null) {
    filmGenreCtx = { id };
    const titleEl = document.getElementById('filmGenreTitle');
    const nameEl = document.getElementById('filmGenreName');
    const delBtn = document.getElementById('filmGenreDeleteBtn');

    if (id) {
        const g = filmGenres.find(x => x.id === id);
        if (g) { titleEl.textContent = 'Редактировать жанр'; nameEl.value = g.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новый жанр';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('filmGenreModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeFilmGenreModal() { closeModal('filmGenreModal'); }

async function saveFilmGenre() {
    const name = document.getElementById('filmGenreName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (filmGenreCtx.id) await api(`/api/film/genres/${filmGenreCtx.id}`, 'PATCH', { name });
        else await api('/api/film/genres', 'POST', { name });
        closeFilmGenreModal();
        await loadFilm();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteFilmGenreFromModal() {
    if (!filmGenreCtx.id) return;
    if (!confirm('Удалить жанр? Фильмы останутся без жанра.')) return;
    await api(`/api/film/genres/${filmGenreCtx.id}`, 'DELETE');
    closeFilmGenreModal();
    await loadFilm();
}

function openFilmModal(id = null, genreId = null) {
    filmCtx = { id, genreId, priority: null, rating: null, status: 'want' };
    const titleEl = document.getElementById('filmTitle');
    const nameEl = document.getElementById('filmName');
    const yearEl = document.getElementById('filmYear');
    const reviewEl = document.getElementById('filmReview');
    const delBtn = document.getElementById('filmDeleteBtn');
    const sel = document.getElementById('filmGenreSelect');

    sel.innerHTML = `<option value="">Без жанра</option>` +
        filmGenres.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    if (id) {
        let movie = null;
        for (const g of filmGenres) { const m = g.movies.find(x => x.id === id); if (m) { movie = m; break; } }
        if (!movie) movie = filmOrphans.find(x => x.id === id);

        if (movie) {
            titleEl.textContent = 'Редактировать фильм';
            nameEl.value = movie.title;
            yearEl.value = movie.year || '';
            sel.value = movie.genre_id || '';
            reviewEl.value = movie.review || '';
            filmCtx.priority = movie.priority || null;
            filmCtx.rating = movie.rating || null;
            filmCtx.status = movie.status || 'want';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новый фильм';
        nameEl.value = '';
        yearEl.value = '';
        reviewEl.value = '';
        if (genreId) sel.value = genreId;
        delBtn.style.display = 'none';
    }

    document.querySelectorAll('#filmPriority button').forEach(b =>
        b.classList.toggle('active', filmCtx.priority === parseInt(b.dataset.p)));
    document.querySelectorAll('#filmRatingPicker button').forEach(b =>
        b.classList.toggle('active', filmCtx.rating === parseInt(b.dataset.r)));
    document.querySelectorAll('#filmStatusTabs [data-st]').forEach(b =>
        b.classList.toggle('active', b.dataset.st === filmCtx.status));

    openModal('filmModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeFilmModal() { closeModal('filmModal'); }

function pickFilmPriority(p, btn) {
    if (filmCtx.priority === p) {
        filmCtx.priority = null;
        btn.classList.remove('active');
    } else {
        filmCtx.priority = p;
        document.querySelectorAll('#filmPriority button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function pickFilmRating(r, btn) {
    if (filmCtx.rating === r) {
        filmCtx.rating = null;
        btn.classList.remove('active');
    } else {
        filmCtx.rating = r;
        document.querySelectorAll('#filmRatingPicker button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function pickFilmStatus(st, btn) {
    filmCtx.status = st;
    document.querySelectorAll('#filmStatusTabs [data-st]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function saveFilm() {
    const title = document.getElementById('filmName').value.trim();
    if (!title) return alert('Введи название');

    if (!filmCtx.id) {
        const low = title.toLowerCase();
        const inGenres = filmGenres.some(g => (g.movies || []).some(m => (m.title || '').toLowerCase() === low));
        const inOrphans = filmOrphans.some(m => (m.title || '').toLowerCase() === low);
        if ((inGenres || inOrphans) && !confirm(`Фильм «${title}» уже есть в списке.\nДобавить дубликат?`)) return;
    }

    const genreVal = document.getElementById('filmGenreSelect').value;
    const payload = {
        title,
        year: document.getElementById('filmYear').value || null,
        genre_id: genreVal ? parseInt(genreVal) : null,
        priority: filmCtx.priority,
        status: filmCtx.status,
        rating: filmCtx.rating,
        review: document.getElementById('filmReview').value || null,
    };
    try {
        if (filmCtx.id) await api(`/api/film/movies/${filmCtx.id}`, 'PATCH', payload);
        else await api('/api/film/movies', 'POST', payload);
        closeFilmModal();
        await loadFilm();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteFilmFromModal() {
    if (!filmCtx.id) return;
    if (!confirm('Удалить фильм?')) return;
    await api(`/api/film/movies/${filmCtx.id}`, 'DELETE');
    closeFilmModal();
    await loadFilm();
}

async function randomMovie(type) {
    filmRandomType = type;
    try {
        const { movie } = await api(`/api/film/random?type=${type}`);
        const box = document.getElementById('randomFilmBox');
        const titleEl = document.getElementById('randomFilmTitle');
        titleEl.textContent = type === 'rewatch' ? '🔁 Что пересмотреть?' : '🎬 Что посмотреть?';
        if (!movie) {
            box.innerHTML = `<div class="film-meta-random">${
                type === 'rewatch' ? 'Нет просмотренных фильмов' : 'Пусто — добавь фильмы со статусом «Хочу»'
            }</div>`;
        } else {
            box.innerHTML = `
                <div class="film-title-random">${escapeHtml(movie.title)}</div>
                <div class="film-meta-random">${[
                    movie.year, movie.rating ? `★ ${movie.rating}` : null,
                    movie.priority ? `Приоритет ${movie.priority}` : null,
                ].filter(Boolean).join(' · ')}</div>`;
        }
        openModal('randomFilmModal');
    } catch (e) { alert('Ошибка: ' + e.message); }
}
function randomAgain() { randomMovie(filmRandomType); }
function closeRandomFilm() { closeModal('randomFilmModal'); }