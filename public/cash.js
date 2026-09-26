// ==========================================
// ===== CASH: БЮДЖЕТ =====
// ==========================================
let cashBudget = null;
let statCtx = { id: null, type: 'rub' };
let cashAddCtx = { id: null, type: null };

async function loadBudget() {
    try {
        const data = await api('/api/cash/budget');
        cashBudget = data;
        renderBudget(data);
    } catch (e) { console.error(e); }
}

function renderBudget(d) {
    const t = d.totals;
    document.getElementById('budgetValue').textContent = fmt(t.budget);

    const list = document.getElementById('budgetList');
    let html = '';

    html += `<div class="budget-row" onclick="openBudgetModal()">
        <div class="budget-row-label">Запланировано</div>
        <div class="budget-row-value">${fmt(t.planned)}</div>
    </div>`;

    html += `<div id="customStatsList">`;
    d.customStats.forEach(s => {
        const val = s.type === 'percent' ? (t.budget * Number(s.value) / 100) : Number(s.value);
        const label = s.type === 'percent' ? `${s.name} (${s.value}%)` : s.name;
        html += `<div class="budget-row" data-id="${s.id}" onclick="openCustomStatModal(${s.id})">
            <div class="budget-row-label">${escapeHtml(label)}</div>
            <div class="budget-row-value">${fmt(val)}</div>
        </div>`;
    });
    html += `</div>`;

    html += `<div class="budget-row">
        <div class="budget-row-label">Остаток</div>
        <div class="budget-row-value ${t.remaining >= 0 ? 'plus' : 'minus'}">${fmt(t.remaining)}</div>
    </div>`;

    html += `<button class="budget-row-add" onclick="openCustomStatModal()">+ Добавить панель</button>`;
    list.innerHTML = html;

    const cs = document.getElementById('customStatsList');
    if (cs && cs.children.length && window.Sortable && !cs._sortable) {
        cs._sortable = new Sortable(cs, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '[data-id]',
            onEnd: async () => {
                const ids = [...cs.querySelectorAll('[data-id]')].map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'cash_custom_stats', ids });
            }
        });
    }

    const subsEl = document.getElementById('subsList');
    subsEl.innerHTML = d.subs.length === 0
        ? `<div class="widget-empty">Нет трат</div>`
        : d.subs.map(s => `<div class="cash-item ${s.paid ? 'paid' : ''}" data-id="${s.id}" onclick="openCashAddModal('sub', ${s.id})">
            <div class="cash-item-check ${s.paid ? 'done' : ''}" onclick="event.stopPropagation(); toggleSubPaid(${s.id}, ${s.paid})">✓</div>
            <div class="cash-item-name">${escapeHtml(s.name)}</div>
            <div class="cash-item-amount">${fmt(s.amount)}</div>
        </div>`).join('');
    if (subsEl.children.length && window.Sortable && !subsEl._sortable) {
        subsEl._sortable = new Sortable(subsEl, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '[data-id]',
            onEnd: async () => {
                const ids = [...subsEl.querySelectorAll('[data-id]')].map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'cash_subs', ids });
            }
        });
    }
    document.getElementById('subsTotal').innerHTML = `Итого: <b>${fmt(t.subs)}</b>`;

    const weekEl = document.getElementById('weeklyList');
    weekEl.innerHTML = d.weekly.length === 0
        ? `<div class="widget-empty">Нет позиций</div>`
        : d.weekly.map(w => `<div class="cash-item" data-id="${w.id}" onclick="openCashAddModal('weekly', ${w.id})">
            <div class="cash-item-name">${escapeHtml(w.name)}</div>
            <div class="cash-item-amount">${fmt(w.amount)}</div>
        </div>`).join('');
    if (weekEl.children.length && window.Sortable && !weekEl._sortable) {
        weekEl._sortable = new Sortable(weekEl, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '[data-id]',
            onEnd: async () => {
                const ids = [...weekEl.querySelectorAll('[data-id]')].map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'cash_weekly', ids });
            }
        });
    }
    document.getElementById('weeklyTotal').innerHTML = `× ${d.weeksInMonth} нед. = <b>${fmt(t.weekly)}</b>`;
}

async function toggleSubPaid(id, paid) {
    try {
        await api(`/api/cash/subs/${id}`, 'PATCH', { paid: !paid });
        await loadBudget();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function openBudgetModal() {
    document.getElementById('budgetAmount').value = cashBudget?.budget?.budget_amount || '';
    openModal('budgetModal');
}
function closeBudgetModal() { closeModal('budgetModal'); }
async function saveBudget() {
    try {
        await api('/api/cash/budget', 'POST', {
            year: cashBudget?.year, month: cashBudget?.month,
            budget_amount: document.getElementById('budgetAmount').value,
        });
        closeBudgetModal();
        await loadBudget();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function openCustomStatModal(id = null) {
    statCtx = { id, type: 'rub' };
    const titleEl = document.getElementById('customStatTitle');
    const nameEl = document.getElementById('customStatName');
    const valueEl = document.getElementById('customStatValue');
    const delBtn = document.getElementById('customStatDeleteBtn');

    if (id) {
        const s = cashBudget.customStats.find(x => x.id === id);
        if (s) {
            titleEl.textContent = 'Редактировать панель';
            nameEl.value = s.name;
            valueEl.value = s.value;
            statCtx.type = s.type;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая панель';
        nameEl.value = '';
        valueEl.value = '';
        delBtn.style.display = 'none';
    }

    document.querySelectorAll('#customStatModal [data-type]').forEach(b =>
        b.classList.toggle('active', b.dataset.type === statCtx.type));
    openModal('customStatModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeCustomStatModal() { closeModal('customStatModal'); }

function pickStatType(t, btn) {
    statCtx.type = t;
    document.querySelectorAll('#customStatModal [data-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function saveCustomStat() {
    const name = document.getElementById('customStatName').value.trim();
    if (!name) return alert('Введи название');
    const payload = { name, type: statCtx.type, value: document.getElementById('customStatValue').value };
    try {
        if (statCtx.id) await api(`/api/cash/custom-stats/${statCtx.id}`, 'PATCH', payload);
        else await api('/api/cash/custom-stats', 'POST', payload);
        closeCustomStatModal();
        await loadBudget();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteCustomStatFromModal() {
    if (!statCtx.id) return;
    if (!confirm('Удалить панель?')) return;
    await api(`/api/cash/custom-stats/${statCtx.id}`, 'DELETE');
    closeCustomStatModal();
    await loadBudget();
}

function openCashAddModal(type, id = null) {
    cashAddCtx = { id, type };
    const titleEl = document.getElementById('cashAddTitle');
    const nameEl = document.getElementById('cashAddName');
    const amountEl = document.getElementById('cashAddAmount');
    const delBtn = document.getElementById('cashAddDeleteBtn');

    if (id) {
        const item = type === 'sub'
            ? cashBudget.subs.find(x => x.id === id)
            : cashBudget.weekly.find(x => x.id === id);
        if (item) {
            titleEl.textContent = type === 'sub' ? 'Редактировать трату' : 'Редактировать покупку';
            nameEl.value = item.name;
            amountEl.value = item.amount;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = type === 'sub' ? 'Трата месяца' : 'Недельная покупка';
        nameEl.value = '';
        amountEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('cashAddModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeCashAddModal() { closeModal('cashAddModal'); }

async function saveCashAdd() {
    const name = document.getElementById('cashAddName').value.trim();
    if (!name) return alert('Введи название');
    const payload = { name, amount: document.getElementById('cashAddAmount').value };
    try {
        if (cashAddCtx.id) {
            const ep = cashAddCtx.type === 'sub' ? 'subs' : 'weekly';
            await api(`/api/cash/${ep}/${cashAddCtx.id}`, 'PATCH', payload);
        } else {
            const ep = cashAddCtx.type === 'sub' ? 'subs' : 'weekly';
            await api(`/api/cash/${ep}`, 'POST', payload);
        }
        closeCashAddModal();
        await loadBudget();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteCashAddFromModal() {
    if (!cashAddCtx.id) return;
    if (!confirm('Удалить?')) return;
    const ep = cashAddCtx.type === 'sub' ? 'subs' : 'weekly';
    await api(`/api/cash/${ep}/${cashAddCtx.id}`, 'DELETE');
    closeCashAddModal();
    await loadBudget();
}

// ==========================================
// ===== CASH: WISHLIST =====
// ==========================================
let wishlistItems = [];
let wishlistAreas = [];
let wishAreaCtx = { id: null, name: null };
let wishCtx = { id: null, url: null };

async function loadWishlist() {
    try {
        const { items, areas } = await api('/api/cash/wishlist');
        wishlistItems = items;
        wishlistAreas = areas;
        renderWishlist();
    } catch (e) { console.error(e); }
}

function renderWishlist() {
    const c = document.getElementById('wishlistGrid');
    if (!wishlistAreas.length && !wishlistItems.length) {
        c.innerHTML = `<div class="empty-state">Нет областей. Нажми +</div>`;
        return;
    }

    let html = '';
    wishlistAreas.forEach(area => {
        const items = wishlistItems.filter(i => (i.area || '') === area.name);
        const isOpen = !isCollapsed('wishlistAreas', area.id);
        const safeName = escapeHtml(area.name).replace(/'/g, "\\'");

        html += `<div class="wishlist-area-card ${isOpen ? 'open' : ''}" data-id="${area.id}">
            <div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('wishlistAreas', ${area.id}); renderWishlist();">▶</span>
                <div class="group-name clickable" onclick="openWishlistAreaModal(${area.id})">${escapeHtml(area.name)}</div>
                <div class="group-count">${items.length}</div>
                <button class="btn-icon-add" onclick="openWishlistModal(null, '${safeName}')">+</button>
            </div>
            <div class="group-body">`;

        if (!items.length) {
            html += `<div class="widget-empty" style="padding:8px 4px;">Пусто</div>`;
        } else {
            items.forEach(it => {
                html += `<div class="list-item" data-id="${it.id}" onclick="openWishlistModal(${it.id})">
                    <div class="item-check ${it.done ? 'done' : ''}" onclick="event.stopPropagation(); toggleWish(${it.id}, ${it.done})">✓</div>
                    <div class="item-info"><div class="item-title ${it.done ? 'done' : ''}">${escapeHtml(it.name)}</div></div>
                    ${it.price ? `<div class="item-rating" style="color:var(--text-secondary);">${fmt(it.price)}</div>` : ''}
                </div>`;
            });
        }
        html += `</div></div>`;
    });
    c.innerHTML = html;

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '.wishlist-area-card[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('.wishlist-area-card[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'cash_wishlist_areas', ids });
            }
        });
    }

    c.querySelectorAll('.group-body').forEach(body => {
        if (!body.children.length) return;
        makeSortable(body, 'cash_wishlist', { draggable: '[data-id]' });
    });
}

async function toggleWish(id, done) {
    try {
        await api(`/api/cash/wishlist/${id}`, 'PATCH', { done: !done });
        await loadWishlist();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function openWishlistAreaModal(id = null) {
    wishAreaCtx = { id };
    const titleEl = document.getElementById('wishlistAreaTitle');
    const nameEl = document.getElementById('wishlistAreaName');
    const delBtn = document.getElementById('wishlistAreaDeleteBtn');

    if (id) {
        const a = wishlistAreas.find(x => x.id === id);
        if (a) { titleEl.textContent = 'Редактировать область'; nameEl.value = a.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая область';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('wishlistAreaModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeWishlistAreaModal() { closeModal('wishlistAreaModal'); }

async function saveWishlistArea() {
    const name = document.getElementById('wishlistAreaName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (wishAreaCtx.id) await api(`/api/cash/wishlist/areas/${wishAreaCtx.id}`, 'PATCH', { name });
        else await api('/api/cash/wishlist/areas', 'POST', { name });
        closeWishlistAreaModal();
        await loadWishlist();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteWishlistAreaFromModal() {
    if (!wishAreaCtx.id) return;
    if (!confirm('Удалить область и все товары в ней?')) return;
    await api(`/api/cash/wishlist/areas/${wishAreaCtx.id}`, 'DELETE');
    closeWishlistAreaModal();
    await loadWishlist();
}

function openWishlistModal(id = null, defaultArea = null) {
    wishCtx = { id, url: null };
    const titleEl = document.getElementById('wishlistTitle');
    const nameEl = document.getElementById('wishlistName');
    const priceEl = document.getElementById('wishlistPrice');
    const urlEl = document.getElementById('wishlistUrl');
    const delBtn = document.getElementById('wishlistDeleteBtn');
    const linkBtn = document.getElementById('wishlistOpenLinkBtn');

    const sel = document.getElementById('wishlistAreaSelect');
    sel.innerHTML = wishlistAreas.map(a =>
        `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('');

    if (id) {
        const it = wishlistItems.find(x => x.id === id);
        if (it) {
            titleEl.textContent = 'Редактировать товар';
            nameEl.value = it.name;
            priceEl.value = it.price || '';
            urlEl.value = it.url || '';
            sel.value = it.area || '';
            wishCtx.url = it.url || null;
        }
        delBtn.style.display = 'block';
        linkBtn.style.display = wishCtx.url ? 'block' : 'none';
    } else {
        titleEl.textContent = 'Новый товар';
        nameEl.value = '';
        priceEl.value = '';
        urlEl.value = '';
        if (defaultArea) sel.value = defaultArea;
        delBtn.style.display = 'none';
        linkBtn.style.display = 'none';
    }
    openModal('wishlistModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeWishlistModal() { closeModal('wishlistModal'); }

function openWishlistLink() {
    if (wishCtx.url) window.open(wishCtx.url, '_blank');
}

async function saveWishlist() {
    const name = document.getElementById('wishlistName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        name,
        price: document.getElementById('wishlistPrice').value,
        area: document.getElementById('wishlistAreaSelect').value,
        url: document.getElementById('wishlistUrl').value,
    };
    try {
        if (wishCtx.id) await api(`/api/cash/wishlist/${wishCtx.id}`, 'PATCH', payload);
        else await api('/api/cash/wishlist', 'POST', payload);
        closeWishlistModal();
        await loadWishlist();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteWishlistFromModal() {
    if (!wishCtx.id) return;
    if (!confirm('Удалить товар?')) return;
    await api(`/api/cash/wishlist/${wishCtx.id}`, 'DELETE');
    closeWishlistModal();
    await loadWishlist();
}

// ==========================================
// ===== CASH: КОПИЛКА =====
// ==========================================
let piggyData = null;
let piggyFilter = 'all';
let piggyCtx = { id: null, type: 'withdraw' };

async function loadPiggy() {
    try {
        piggyData = await api('/api/cash/piggy');
        renderPiggy();
    } catch (e) { console.error(e); }
}

function renderPiggy() {
    const d = piggyData;
    if (!d) return;
    const t = d.totals;

    document.getElementById('piggyGrid').innerHTML = `
        <div class="piggy-hero">
            <div class="piggy-row">
                <div class="piggy-cell">
                    <div class="piggy-cell-value">${fmt(t.balance)}</div>
                    <div class="piggy-cell-label">Копилка</div>
                </div>
                <div class="piggy-cell editable" onclick="openFactModal()">
                    <div class="piggy-cell-value">${fmt(t.fact)}</div>
                    <div class="piggy-cell-label">Есть по факту</div>
                </div>
            </div>
            <div class="piggy-row">
                <div class="piggy-cell">
                    <div class="piggy-cell-value small">${fmt(t.deposited)}</div>
                    <div class="piggy-cell-label">Всего пополнений</div>
                </div>
                <div class="piggy-cell">
                    <div class="piggy-cell-value small debt">${fmt(t.debt)}</div>
                    <div class="piggy-cell-label">Долг</div>
                </div>
            </div>
        </div>
    `;

    const filtered = d.items.filter(x => {
        if (piggyFilter === 'deposit') return x.type === 'deposit';
        if (piggyFilter === 'withdraw') return x.type === 'withdraw';
        return true;
    });

    const list = document.getElementById('piggyList');
    const filterHtml = `<div class="piggy-filter">
        <button class="piggy-filter-btn ${piggyFilter === 'all' ? 'active' : ''}" onclick="setPiggyFilter('all')">Все</button>
        <button class="piggy-filter-btn ${piggyFilter === 'deposit' ? 'active' : ''}" onclick="setPiggyFilter('deposit')">↓ Пополнения</button>
        <button class="piggy-filter-btn ${piggyFilter === 'withdraw' ? 'active' : ''}" onclick="setPiggyFilter('withdraw')">↑ Списания</button>
    </div>
    <div id="piggyItemsBox">`;

    if (!filtered.length) {
        list.innerHTML = filterHtml + `<div class="widget-empty">Пусто</div></div>`;
        return;
    }
    list.innerHTML = filterHtml + filtered.map(x => `
        <div class="cash-item" data-id="${x.id}" onclick="openPiggyModal(${x.id})">
            <div style="flex:1;min-width:0;">
                <div class="cash-item-name">${escapeHtml(x.description || (x.type === 'deposit' ? 'Пополнение' : 'Трата'))}</div>
                <div class="cash-item-date">${formatDate(x.date)}</div>
            </div>
            <div class="cash-item-amount ${x.type === 'withdraw' ? 'minus' : 'plus-green'}">
                ${x.type === 'withdraw' ? '−' : '+'}${fmt(x.amount)}
            </div>
        </div>
    `).join('') + `</div>`;

    const box = document.getElementById('piggyItemsBox');
    if (box && box.children.length && window.Sortable && !box._sortable) {
        box._sortable = new Sortable(box, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '[data-id]',
            onEnd: async () => {
                const ids = [...box.querySelectorAll('[data-id]')].map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'cash_piggy', ids });
            }
        });
    }
}

function setPiggyFilter(f) { piggyFilter = f; renderPiggy(); }

function openPiggyModal(id = null) {
    piggyCtx = { id, type: 'withdraw' };
    const titleEl = document.getElementById('piggyTitle');
    const descEl = document.getElementById('piggyDesc');
    const amountEl = document.getElementById('piggyAmount');
    const dateEl = document.getElementById('piggyDate');
    const delBtn = document.getElementById('piggyDeleteBtn');

    if (id) {
        const x = piggyData.items.find(i => i.id === id);
        if (x) {
            titleEl.textContent = 'Редактировать запись';
            descEl.value = x.description || '';
            amountEl.value = x.amount;
            dateEl.value = x.date || '';
            piggyCtx.type = x.type;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая запись';
        descEl.value = '';
        amountEl.value = '';
        dateEl.value = localDate(new Date());
        delBtn.style.display = 'none';
    }

    document.querySelectorAll('#piggyModal [data-ptype]').forEach(b =>
        b.classList.toggle('active', b.dataset.ptype === piggyCtx.type));
    openModal('piggyModal');
}
function closePiggyModal() { closeModal('piggyModal'); }

function pickPiggyType(t, btn) {
    piggyCtx.type = t;
    document.querySelectorAll('#piggyModal [data-ptype]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function savePiggy() {
    const amount = document.getElementById('piggyAmount').value;
    if (!amount) return alert('Введи сумму');
    const payload = {
        type: piggyCtx.type,
        amount,
        description: document.getElementById('piggyDesc').value,
        date: document.getElementById('piggyDate').value || null,
    };
    try {
        if (piggyCtx.id) await api(`/api/cash/piggy/${piggyCtx.id}`, 'PATCH', payload);
        else await api('/api/cash/piggy', 'POST', payload);
        closePiggyModal();
        await loadPiggy();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deletePiggyFromModal() {
    if (!piggyCtx.id) return;
    if (!confirm('Удалить запись?')) return;
    await api(`/api/cash/piggy/${piggyCtx.id}`, 'DELETE');
    closePiggyModal();
    await loadPiggy();
}

function openFactModal() {
    document.getElementById('factAmount').value = piggyData?.totals?.fact || '';
    openModal('factModal');
}
function closeFactModal() { closeModal('factModal'); }
async function saveFact() {
    try {
        await api('/api/cash/piggy/fact', 'POST', { fact_amount: document.getElementById('factAmount').value });
        closeFactModal();
        await loadPiggy();
    } catch (e) { alert('Ошибка: ' + e.message); }
}