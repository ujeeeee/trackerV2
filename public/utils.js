// ==========================================
// ===== СОСТОЯНИЕ =====
// ==========================================
let tgUser = { id: 0, name: 'Друг' };
let initData = '';
let currentUser = null;
let tg = null;
const TOTAL_MAIN_SCREENS = 8;
let currentScreenIndex = 0;

// ===== Collapse state =====
const COLLAPSE_KEYS = [
    'filmGenres', 'filmWatched', 'teaGroups',
    'placesWant', 'placesVisited', 'discAreas', 'wishlistAreas',
    'foodCategories',
];

const collapsed = {};
COLLAPSE_KEYS.forEach(k => {
    try {
        const saved = JSON.parse(localStorage.getItem('collapse_' + k) || '[]');
        collapsed[k] = new Set(saved);
    } catch (e) {
        collapsed[k] = new Set();
    }
});

function saveCollapsed(key) {
    try {
        localStorage.setItem('collapse_' + key, JSON.stringify([...collapsed[key]]));
    } catch (e) {}
}

function isCollapsed(key, id) {
    return collapsed[key].has(id);
}
function toggleCollapse(key, id) {
    if (collapsed[key].has(id)) collapsed[key].delete(id);
    else collapsed[key].add(id);
    saveCollapsed(key);
}

// ===== Set helpers (Gym open state) =====
function loadSet(key) {
    try {
        return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
    } catch (e) {
        return new Set();
    }
}
function saveSet(key, set) {
    try {
        localStorage.setItem(key, JSON.stringify([...set]));
    } catch (e) {}
}

// ===== Sortable helper =====
function makeSortable(containerEl, tableName, opts = {}) {
    if (!containerEl || !window.Sortable) return;
    if (containerEl._sortable) containerEl._sortable.destroy();
    containerEl._sortable = new Sortable(containerEl, {
        animation: 150,
        delay: 250,
        delayOnTouchOnly: true,
        handle: opts.handle || null,
        draggable: opts.draggable || '> *[data-id]',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: async () => {
            const ids = [...containerEl.children]
                .filter(c => c.dataset.id)
                .map(c => parseInt(c.dataset.id))
                .filter(Boolean);
            if (!ids.length) return;
            try {
                await api('/api/reorder', 'POST', { table: tableName, ids });
            } catch (e) { console.error('Reorder error:', e); }
        }
    });
}

function getCollapsedHeaderHTML(key, id, name, count, extra = '') {
    const isOpen = !isCollapsed(key, id);
    return `<div class="group-header">
        <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('${key}', ${id}); rerenderCurrent();">▶</span>
        <div class="group-name clickable" onclick="event.stopPropagation(); toggleCollapse('${key}', ${id}); rerenderCurrent();">${escapeHtml(name)}</div>
        ${count !== null ? `<div class="group-count">${count}</div>` : ''}
        ${extra}
    </div>`;
}

function rerenderCurrent() {
    const i = currentScreenIndex;
    if (i === 0) return;
    if (i === 1) { renderAreas(); renderTodos(); renderWeek(habits); }
    if (i === 2) renderPrograms();
    if (i === 3) renderFoodRecipes();
    if (i === 4) { renderBudget(cashBudget); renderWishlist(); renderPiggy(); }
    if (i === 5) { renderPlacesWant(); renderPlacesVisited(); }
    if (i === 6) { renderFilmGenres(); renderFilmWatched(); }
    if (i === 7) { renderTea(); renderTeaShops(); }
}

// ==========================================
// ===== ТЕМА =====
// ==========================================
function getThemeMode() { return localStorage.getItem('theme_mode') || 'auto'; }

function initTheme() {
    const mode = getThemeMode();
    const scheme = mode === 'auto' ? ((tg && tg.colorScheme) || 'dark') : mode;
    applyTheme(scheme);
    updateThemeButtons(mode);
}

function applyTheme(scheme) {
    const theme = scheme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
        if (tg?.setHeaderColor) tg.setHeaderColor(theme === 'light' ? '#f2f2f7' : '#0a0a0c');
        if (tg?.setBackgroundColor) tg.setBackgroundColor(theme === 'light' ? '#f2f2f7' : '#0a0a0c');
    } catch (e) {}
}

function setThemeMode(mode, btn) {
    localStorage.setItem('theme_mode', mode);
    initTheme();
    if (btn) {
        document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function updateThemeButtons(mode) {
    document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.themeValue === mode));
}

// ==========================================
// ===== УТИЛИТЫ =====
// ==========================================
function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmt(n) { return Number(n || 0).toLocaleString('ru-RU') + ' ₽'; }

function localDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function formatDate(s) {
    if (!s) return '';
    const d = new Date(s + 'T12:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
}

function getDayLabel(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const today = localDate(now);
    const tomorrow = localDate(new Date(now.getTime() + 86400000));
    const dayAfter = localDate(new Date(now.getTime() + 172800000));
    const yesterday = localDate(new Date(now.getTime() - 86400000));
    if (dateStr === today) return 'сегодня';
    if (dateStr === tomorrow) return 'завтра';
    if (dateStr === dayAfter) return 'послезавтра';
    if (dateStr === yesterday) return 'вчера';
    return null;
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function haptic(type = 'light') {
    try { if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred(type); } catch (e) {}
}
document.addEventListener('click', e => { if (e.target.closest('button')) haptic('light'); });