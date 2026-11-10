// ==========================================
// ===== SCREENS =====
// ==========================================
function goToScreen(index) {
    if (index < 0 || index >= TOTAL_MAIN_SCREENS) return;
    currentScreenIndex = index;

    const names = ['Main', 'Goals', 'Cash', 'Gym', 'Collections'];
    const screenName = names[index];

    document.querySelectorAll('.screen').forEach(s => {
        s.classList.toggle('active', s.dataset.screenName === screenName);
    });

    document.querySelectorAll('.nav-btn').forEach(b => {
        const idx = b.dataset.index;
        b.classList.toggle('active', idx !== undefined && parseInt(idx) === index);
    });

    const nav = document.getElementById('bottomNav');
    const btn = nav.querySelector(`.nav-btn[data-index="${index}"]`);
    if (nav && btn) {
        const t = btn.offsetLeft - nav.clientWidth / 2 + btn.clientWidth / 2;
        nav.scrollTo({ left: t, behavior: 'smooth' });
    }
    window.scrollTo(0, 0);

    if (index === 0) loadMain();
    if (index === 1) loadAreas();
    if (index === 2) { loadBudget(); loadWishlist(); loadPiggy(); }
    if (index === 3) { loadPrograms(); loadMetrics(); }
    if (index === 4) loadCollections();
}

// Открыть конкретную подборку (Places / Film / Tea)
function openCollection(name) {
    const map = { places: 'Places', film: 'Film', tea: 'Tea' };
    const screenName = map[name];
    if (!screenName) return;

    document.querySelectorAll('.screen').forEach(s => {
        s.classList.toggle('active', s.dataset.screenName === screenName);
    });
    // Подсвечиваем "Collections" в нижнем меню
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.index) === 4);
    });
    window.scrollTo(0, 0);

    if (name === 'places') loadPlaces();
    if (name === 'film') loadFilm();
    if (name === 'tea') loadTea();
}

function switchSubTab(parent, tab, btn) {
    btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const ps = btn.closest('.screen');
    ps.querySelectorAll('.subtab').forEach(st => st.classList.remove('active'));
    const target = document.getElementById(`${parent}-${tab}`);
    if (target) target.classList.add('active');
}

// ==========================================
// ===== SETTINGS =====
// ==========================================
let previousScreenName = 'Main';

function openSettings() {
    const active = document.querySelector('.screen.active');
    if (active && active.dataset.screenName !== 'Settings') {
        previousScreenName = active.dataset.screenName;
    }
    document.body.classList.add('settings-open');
    updateSettingsUI();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-screen-name="Settings"]').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    window.scrollTo(0, 0);
}

function closeSettings() {
    document.body.classList.remove('settings-open');
    if (['Places', 'Film', 'Tea'].includes(previousScreenName)) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.toggle('active', s.dataset.screenName === previousScreenName);
        });
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.index) === 4);
        });
        window.scrollTo(0, 0);
    } else {
        goToScreen(currentScreenIndex);
    }
}

function updateSettingsUI() {
    const name = currentUser?.name || tgUser.name || 'Друг';
    document.getElementById('settingsUserName').textContent = name;
    document.getElementById('settingsUserId').textContent = 'ID: ' + (currentUser?.id || tgUser.id || '—');
    document.getElementById('settingsAvatar').textContent = (name[0] || '?').toUpperCase();
    updateThemeButtons(getThemeMode());
}