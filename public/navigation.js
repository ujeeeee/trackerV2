// ==========================================
// ===== SCREENS =====
// ==========================================
function goToScreen(index) {
    if (index < 0 || index >= TOTAL_MAIN_SCREENS) return;
    currentScreenIndex = index;

    const screens = document.querySelectorAll('.screen');
    screens.forEach((s, i) => s.classList.toggle('active', i === index));

    document.querySelectorAll('.side-nav-btn').forEach(b => {
        const idx = b.dataset.index;
        b.classList.toggle('active', idx !== undefined && parseInt(idx) === index);
    });

    // Центрируем активную кнопку в боковой навигации
    const nav = document.getElementById('sideNav');
    const btn = nav.querySelector(`.side-nav-btn[data-index="${index}"]`);
    if (nav && btn) {
        const target = btn.offsetTop - nav.clientHeight / 2 + btn.clientHeight / 2;
        nav.scrollTo({ top: target, behavior: 'smooth' });
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

// ==========================================
// ===== SIDE NAV: бесконечная кольцевая прокрутка =====
// ==========================================
(function initSideNavInfinite() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;

    // Дублируем содержимое 3 раза, чтобы можно было крутить бесконечно
    const original = [...nav.children];
    nav.innerHTML = '';
    for (let copy = 0; copy < 3; copy++) {
        original.forEach(btn => nav.appendChild(btn.cloneNode(true)));
    }

    // Стартуем в середине (реальная группа)
    const total = original.length;
    const setCenter = () => {
        const first = nav.children[total];
        if (first) nav.scrollTop = first.offsetTop - 20;
    };
    requestAnimationFrame(setCenter);

    // При скролле — если уехали в первую или последнюю копию, тихо прыгаем в середину
    let ticking = false;
    nav.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const firstThirdEnd = nav.children[total * 2 - 1];
            const secondStart = nav.children[total];
            const secondEnd = nav.children[total * 2 - 1];

            if (nav.scrollTop < secondStart.offsetTop - nav.clientHeight) {
                nav.scrollTop += nav.children[total].offsetTop - nav.children[0].offsetTop;
            } else if (nav.scrollTop > nav.children[total * 2].offsetTop - 20) {
                nav.scrollTop -= nav.children[total].offsetTop - nav.children[0].offsetTop;
            }
            ticking = false;
        });
    }, { passive: true });
})();