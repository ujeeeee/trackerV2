// ==========================================
// ===== TELEGRAM INIT =====
// ==========================================
try {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe?.user) {
        tgUser.id = tg.initDataUnsafe.user.id;
        tgUser.name = tg.initDataUnsafe.user.first_name || tg.initDataUnsafe.user.username || 'Друг';
    }
    initData = tg.initData || '';
    if (tg.onEvent) tg.onEvent('themeChanged', () => { if (getThemeMode() === 'auto') applyTheme(tg.colorScheme); });
    if (tg.BackButton) tg.BackButton.onClick(() => closeSettings());
} catch (e) { console.log('Not in Telegram'); }

initTheme();

// ==========================================
// ===== BACKUP =====
// ==========================================
async function backupAll(section) {
    try {
        const { file } = await api('/api/backup/save-github', 'POST', { section });

        if (confirm(`✅ Сохранено в GitHub:\n${file}\n\nОтправить также в чат с ботом?`)) {
            await api('/api/backup/send-tg', 'POST', { section });
            alert('✅ Отправлено в чат');
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

// ==========================================
// ===== IMPORT =====
// ==========================================
const IMPORT_CONFIG = {
    film: {
        title: 'Импорт фильмов',
        hint: 'Жанры — строки с <b>#</b>.<br>Формат: <code>Название | год</code>',
        placeholder: '# Комедии\nМальчишник в Вегасе | 2009\nДжентльмены | 2019\nПолтора шпиона\n\n# Триллеры\nДжокер | 2019\nКингсман',
    },
    tea: {
        title: 'Импорт чая',
        hint: 'Типы — строки с <b>#</b>.<br>Формат: <code>Название | температура | отзыв</code>',
        placeholder: '# Бодрящий\nДа Хун Пао | 95 | Насыщенный, земляной\nТе Гуань Инь | 90-95 | Цветочный\n\n# Расслабляющий\nРомашка | 80-85 | Мягкий',
    },
    places: {
        title: 'Импорт мест',
        hint: 'Типы — строки с <b>#</b>.<br>Формат: <code>Название | страна | город | ссылка | отзыв</code>',
        placeholder: '# Кафе\nBenedict | Россия | Красноярск | https://2gis.ru/... | вкусный лимонад\nКультура | Россия | Красноярск | | крутой омлет',
    },
    wishlist: {
        title: 'Импорт вишлиста',
        hint: 'Области — строки с <b>#</b>.<br>Формат: <code>Название | цена | ссылка</code>',
        placeholder: '# Техника\nКроссовки Nike | 12000\n\n# Одежда\nКуртка | 15000',
    },
    todos: {
        title: 'Импорт дел',
        hint: 'Без групп. Формат: <code>Название | дата | время_с | время_до</code><br>Дата: 19.09.26 или 2026-09-19',
        placeholder: 'Позвонить маме | 19.09.26\nКупить хлеб\nЗал | 20.09.26 | 10:00 | 12:00',
    },
    discipline: {
        title: 'Импорт целей',
        hint: '<b># Область</b> — верхний уровень.<br><b>## Подобласть</b> — вложенная.<br><b>### Ещё глубже</b> — сколько угодно.<br>Обычная строка — цель в текущей области.',
        placeholder: '# ТЕЛО\n## Гигиена\n- волосы\n- кожа\n- запах\n## Речь\n- коммуникация\n- словарный запас\n## Форма\n- МС\n- спортзал\n- футбол\n\n# ГОЛОВА\n## Знания\n### IT\n- программирование\n- ИИ\n### Саморазвитие\n- английский\n- чтение\n## Финансы\n- работа\n- трейдинг',
    },
};

let importSection = null;

function openImport(section) {
    const cfg = IMPORT_CONFIG[section];
    if (!cfg) return;
    importSection = section;
    document.getElementById('importTitle').textContent = cfg.title;
    document.getElementById('importHint').innerHTML = cfg.hint;
    const ta = document.getElementById('importText');
    ta.value = '';
    ta.placeholder = cfg.placeholder || '';
    openModal('importModal');
    setTimeout(() => ta.focus(), 200);
}

function closeImportModal() { closeModal('importModal'); }

async function saveImport() {
    const text = document.getElementById('importText').value;
    if (!text.trim()) return alert('Вставь список');
    try {
        let endpoint = importSection;
        const res = await api(`/api/import/${importSection}`, 'POST', { text });
        closeImportModal();
        let msg = `✅ Добавлено: ${res.added}`;
        if (res.groupsAdded) msg += `, новых групп: ${res.groupsAdded}`;
        alert(msg);

        if (importSection === 'film') await loadFilm();
        else if (importSection === 'tea') await loadTea();
        else if (importSection === 'places') await loadPlaces();
        else if (importSection === 'wishlist') await loadWishlist();
        else if (importSection === 'todos') await loadTodos();
        else if (importSection === 'discipline') await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// ===== ПОИСК =====
// ==========================================
function openSearch() {
    const i = currentScreenIndex;
    const titles = { 5: 'Поиск мест', 6: 'Поиск фильмов', 7: 'Поиск чая' };
    const placeholders = {
        5: 'Название, город, страна, отзыв...',
        6: 'Название, год, отзыв...',
        7: 'Название или отзыв...',
    };
    document.getElementById('searchTitle').textContent = titles[i] || 'Поиск';
    const input = document.getElementById('searchInput');
    input.value = '';
    input.placeholder = placeholders[i] || 'Введите запрос...';
    document.getElementById('searchResults').innerHTML = '';
    openModal('searchModal');
    setTimeout(() => input.focus(), 200);
}

function closeSearch() { closeModal('searchModal'); }

let searchTimeout = null;
function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(runSearch, 180);
}

function runSearch() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const c = document.getElementById('searchResults');
    if (!q) { c.innerHTML = ''; return; }

    let results = [];

    if (currentScreenIndex === 5) {
        const all = [];
        placesTypes.forEach(t => (t.items || []).forEach(i => all.push({ ...i, _type: t.name })));
        placesOrphans.forEach(i => all.push({ ...i, _type: 'Без типа' }));
        results = all.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.city || '').toLowerCase().includes(q) ||
            (p.country || '').toLowerCase().includes(q) ||
            (p.review || '').toLowerCase().includes(q) ||
            (p._type || '').toLowerCase().includes(q)
        ).map(p => ({
            title: p.name,
            sub: [p.country, p.city, p._type].filter(Boolean).join(' · '),
            onclick: `closeSearch(); openPlaceModal(${p.id})`
        }));
    } else if (currentScreenIndex === 6) {
        const all = [];
        filmGenres.forEach(g => (g.movies || []).forEach(m => all.push({ ...m, _genre: g.name })));
        filmOrphans.forEach(m => all.push({ ...m, _genre: 'Без жанра' }));
        results = all.filter(m =>
            (m.title || '').toLowerCase().includes(q) ||
            (m.year && String(m.year).includes(q)) ||
            (m.review || '').toLowerCase().includes(q)
        ).map(m => ({
            title: m.title,
            sub: [m.year, m._genre].filter(Boolean).join(' · '),
            onclick: `closeSearch(); openFilmModal(${m.id})`
        }));
    } else if (currentScreenIndex === 7) {
        const all = [];
        teaGroups.forEach(g => (g.items || []).forEach(i => all.push({ ...i, _group: g.name })));
        teaOrphans.forEach(i => all.push({ ...i, _group: 'Без группы' }));
        results = all.filter(i =>
            (i.name || '').toLowerCase().includes(q) ||
            (i.review || '').toLowerCase().includes(q) ||
            (i.temp_c && String(i.temp_c).toLowerCase().includes(q))
        ).map(i => ({
            title: i.name,
            sub: [i._group, i.temp_c].filter(Boolean).join(' · '),
            onclick: `closeSearch(); openTeaModal(${i.id})`
        }));
    }

    if (!results.length) {
        c.innerHTML = `<div class="search-empty">Ничего не найдено</div>`;
        return;
    }

    c.innerHTML = results.map(r => `
        <div class="search-result-item" onclick="${r.onclick}">
            <div>${escapeHtml(r.title)}</div>
            ${r.sub ? `<div class="search-result-sub">${escapeHtml(r.sub)}</div>` : ''}
        </div>
    `).join('');
}

// ==========================================
// ===== МОДАЛКИ: крестик сверху =====
// ==========================================
function beautifyModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        const sheet = modal.querySelector('.modal-sheet');
        if (!sheet) return;

        if (!sheet.querySelector('.modal-close')) {
            const x = document.createElement('button');
            x.className = 'modal-close';
            x.innerHTML = '✕';
            x.onclick = () => modal.classList.remove('open');
            sheet.prepend(x);
        }

        const actions = modal.querySelector('.modal-actions');
        if (!actions) return;

        actions.querySelectorAll('.modal-btn').forEach(btn => {
            const t = (btn.textContent || '').trim().toLowerCase();
            if (t === 'отмена') btn.remove();
        });
    });
}

document.addEventListener('DOMContentLoaded', beautifyModals);

// ==========================================
// ===== СТАРТ =====
// ==========================================
(async function start() {
    goToScreen(0);
    const ok = await auth();
    if (ok) {
        await loadMain();
    }
})();