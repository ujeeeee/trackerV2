// ==========================================
// ===== TEA =====
// ==========================================
let teaGroups = [];
let teaOrphans = [];
let teaShops = [];
let teaGroupCtx = { id: null };
let teaCtx = { id: null, rating: null };
let teaShopCtx = { id: null };

async function loadTea() {
    try {
        const { groups, orphans, shops } = await api('/api/tea');
        teaGroups = groups;
        teaOrphans = orphans;
        teaShops = shops;
        renderTea();
        renderTeaShops();
    } catch (e) { console.error(e); }
}

function renderTea() {
    const c = document.getElementById('teaGroups');
    const all = [...teaGroups];
    if (teaOrphans.length) all.push({ id: null, name: 'Без группы', items: teaOrphans });

    if (!all.length) {
        c.innerHTML = `<div class="empty-state">Нет чая. Нажми +</div>`;
        return;
    }

    c.innerHTML = all.map(g => {
        const isOrphan = !g.id;
        const isOpen = !isCollapsed('teaGroups', isOrphan ? 0 : g.id);
        const nameClick = isOrphan ? '' : `onclick="openTeaGroupModal(${g.id})"`;
        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('teaGroups', 0); renderTea();">▶</span>
                <div class="group-name clickable" onclick="clearTeaOrphans()">Без группы</div>
                <div class="group-count">${g.items.length}</div>
                <button class="btn-icon-add" onclick="openTeaModal(null, null)">+</button>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('teaGroups', ${g.id}); renderTea();">▶</span>
                <div class="group-name clickable" ${nameClick}>${escapeHtml(g.name)}</div>
                <div class="group-count">${g.items.length}</div>
                <button class="btn-icon-add" onclick="openTeaModal(null, ${g.id})">+</button>
            </div>`;

        const bodyHtml = isOpen
            ? (g.items.length === 0 ? `<div class="widget-empty">Пусто</div>` : g.items.map(i => teaItemHTML(i)).join(''))
            : '';

        return `<div class="tea-group-card ${isOpen ? 'open' : ''}" ${g.id ? `data-id="${g.id}"` : ''}>
            ${header}
            <div class="group-body">${bodyHtml}</div>
        </div>`;
    }).join('');

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '.tea-group-card[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('.tea-group-card[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'tea_groups', ids });
            }
        });
    }

    c.querySelectorAll('.group-body').forEach(body => {
        if (!body.children.length) return;
        makeSortable(body, 'tea_items', { draggable: '[data-id]' });
    });
}

async function clearTeaOrphans() {
    if (teaOrphans.length === 0) return;
    if (!confirm(`Очистить весь чай из «Без группы» (${teaOrphans.length})?`)) return;
    await api('/api/tea/orphans', 'DELETE');
    await loadTea();
}

function teaItemHTML(i) {
    const parts = [];
    if (i.temp_c) parts.push(`${i.temp_c}°C`);
    if (i.review) parts.push(escapeHtml(i.review.slice(0, 40)));
    return `<div class="list-item" data-id="${i.id}" onclick="openTeaModal(${i.id})">
        <div class="item-info">
            <div class="item-title">${escapeHtml(i.name)}</div>
            <div class="item-sub">${parts.join(' · ') || '—'}</div>
        </div>
        ${i.rating ? `<div class="item-rating">★ ${i.rating}</div>` : ''}
    </div>`;
}

function renderTeaShops() {
    const c = document.getElementById('teaShops');
    if (!teaShops.length) {
        c.innerHTML = `<div class="widget-empty">Нет магазинов</div>`;
        return;
    }
    c.innerHTML = teaShops.map(s => `
        <div class="tea-shop-item">
            <div class="tea-shop-info" onclick="openTeaShopModal(${s.id})">
                ${s.name ? `<div class="tea-shop-name">${escapeHtml(s.name)}</div>` : ''}
                <div class="tea-shop-url">${escapeHtml(s.url)}</div>
            </div>
            <button class="tea-shop-go" onclick="window.open('${escapeHtml(s.url)}', '_blank')">↗</button>
        </div>
    `).join('');
}

function openTeaGroupModal(id = null) {
    teaGroupCtx = { id };
    const titleEl = document.getElementById('teaGroupTitle');
    const nameEl = document.getElementById('teaGroupName');
    const delBtn = document.getElementById('teaGroupDeleteBtn');

    if (id) {
        const g = teaGroups.find(x => x.id === id);
        if (g) { titleEl.textContent = 'Редактировать группу'; nameEl.value = g.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая группа';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('teaGroupModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeTeaGroupModal() { closeModal('teaGroupModal'); }

async function saveTeaGroup() {
    const name = document.getElementById('teaGroupName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (teaGroupCtx.id) await api(`/api/tea/groups/${teaGroupCtx.id}`, 'PATCH', { name });
        else await api('/api/tea/groups', 'POST', { name });
        closeTeaGroupModal();
        await loadTea();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteTeaGroupFromModal() {
    if (!teaGroupCtx.id) return;
    if (!confirm('Удалить группу? Чай останется без группы.')) return;
    await api(`/api/tea/groups/${teaGroupCtx.id}`, 'DELETE');
    closeTeaGroupModal();
    await loadTea();
}

function openTeaModal(id = null, groupId = null) {
    teaCtx = { id, rating: null };
    const titleEl = document.getElementById('teaTitle');
    const nameEl = document.getElementById('teaName');
    const tempEl = document.getElementById('teaTemp');
    const reviewEl = document.getElementById('teaReview');
    const delBtn = document.getElementById('teaDeleteBtn');
    const sel = document.getElementById('teaGroupSelect');

    sel.innerHTML = `<option value="">Без группы</option>` +
        teaGroups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    if (id) {
        let item = null;
        for (const g of teaGroups) { const x = g.items.find(y => y.id === id); if (x) { item = x; break; } }
        if (!item) item = teaOrphans.find(x => x.id === id);

        if (item) {
            titleEl.textContent = 'Редактировать чай';
            nameEl.value = item.name;
            tempEl.value = item.temp_c || '';
            reviewEl.value = item.review || '';
            sel.value = item.group_id || '';
            teaCtx.rating = item.rating || null;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новый чай';
        nameEl.value = '';
        tempEl.value = '';
        reviewEl.value = '';
        if (groupId) sel.value = groupId;
        delBtn.style.display = 'none';
    }

    document.querySelectorAll('#teaRatingPicker button').forEach(b =>
        b.classList.toggle('active', teaCtx.rating === parseInt(b.dataset.r)));
    openModal('teaModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeTeaModal() { closeModal('teaModal'); }

function pickTeaRating(r, btn) {
    if (teaCtx.rating === r) {
        teaCtx.rating = null;
        btn.classList.remove('active');
    } else {
        teaCtx.rating = r;
        document.querySelectorAll('#teaRatingPicker button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

async function saveTea() {
    const name = document.getElementById('teaName').value.trim();
    if (!name) return alert('Введи название');

    if (!teaCtx.id) {
        const low = name.toLowerCase();
        const inGroups = teaGroups.some(g => (g.items || []).some(i => (i.name || '').toLowerCase() === low));
        const inOrphans = teaOrphans.some(i => (i.name || '').toLowerCase() === low);
        if ((inGroups || inOrphans) && !confirm(`Чай «${name}» уже есть.\nДобавить дубликат?`)) return;
    }

    const gVal = document.getElementById('teaGroupSelect').value;
    const payload = {
        name,
        group_id: gVal ? parseInt(gVal) : null,
        temp_c: document.getElementById('teaTemp').value || null,
        review: document.getElementById('teaReview').value || null,
        rating: teaCtx.rating,
    };
    try {
        if (teaCtx.id) await api(`/api/tea/items/${teaCtx.id}`, 'PATCH', payload);
        else await api('/api/tea/items', 'POST', payload);
        closeTeaModal();
        await loadTea();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteTeaFromModal() {
    if (!teaCtx.id) return;
    if (!confirm('Удалить чай?')) return;
    await api(`/api/tea/items/${teaCtx.id}`, 'DELETE');
    closeTeaModal();
    await loadTea();
}

function openTeaShopModal(id = null) {
    teaShopCtx = { id };
    const titleEl = document.getElementById('teaShopTitle');
    const nameEl = document.getElementById('teaShopName');
    const urlEl = document.getElementById('teaShopUrl');
    const delBtn = document.getElementById('teaShopDeleteBtn');

    if (id) {
        const s = teaShops.find(x => x.id === id);
        if (s) { titleEl.textContent = 'Редактировать магазин'; nameEl.value = s.name || ''; urlEl.value = s.url; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новый магазин';
        nameEl.value = '';
        urlEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('teaShopModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeTeaShopModal() { closeModal('teaShopModal'); }

async function saveTeaShop() {
    const url = document.getElementById('teaShopUrl').value.trim();
    if (!url) return alert('Введи ссылку');
    const payload = { name: document.getElementById('teaShopName').value, url };
    try {
        if (teaShopCtx.id) await api(`/api/tea/shops/${teaShopCtx.id}`, 'PATCH', payload);
        else await api('/api/tea/shops', 'POST', payload);
        closeTeaShopModal();
        await loadTea();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteTeaShopFromModal() {
    if (!teaShopCtx.id) return;
    if (!confirm('Удалить магазин?')) return;
    await api(`/api/tea/shops/${teaShopCtx.id}`, 'DELETE');
    closeTeaShopModal();
    await loadTea();
}