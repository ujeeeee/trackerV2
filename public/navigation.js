// ==========================================
// ===== SCREENS =====
// ==========================================
function goToScreen(index) {
    if (index < 0 || index >= TOTAL_MAIN_SCREENS) return;
    currentScreenIndex = index;

    const screens = document.querySelectorAll('.screen');
    screens.forEach((s, i) => s.classList.toggle('active', i === index));

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
    if (index === 1) { loadAreas(); loadHabits(); loadWeek(); loadTodos(); }
    if (index === 2) { loadPrograms(); loadMetrics(); }
    if (index === 3) { loadBudget(); loadWishlist(); loadPiggy(); }
    if (index === 4) loadPlaces();
    if (index === 5) loadFilm();
    if (index === 6) loadTea();
}

function switchSubTab(parent, tab, btn) {
    btn.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const ps = btn.closest('.screen');
    ps.querySelectorAll('.subtab').forEach(st => st.classList.remove('active'));
    const target = document.getElementById(`${parent}-${tab}`);
    if (target) target.classList.add('active');

    if (parent === 'cash' && tab === 'shopping') { loadDishes(); loadShopping(); loadCashProducts(); }
}

// ==========================================
// ===== SETTINGS =====
// ==========================================
function openSettings() {
    updateSettingsUI();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelector('[data-screen-name="Settings"]').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    window.scrollTo(0, 0);
}
function closeSettings() { goToScreen(currentScreenIndex); }

function updateSettingsUI() {
    const name = currentUser?.name || tgUser.name || 'Друг';
    document.getElementById('settingsUserName').textContent = name;
    document.getElementById('settingsUserId').textContent = 'ID: ' + (currentUser?.id || tgUser.id || '—');
    document.getElementById('settingsAvatar').textContent = (name[0] || '?').toUpperCase();
    updateThemeButtons(getThemeMode());
}