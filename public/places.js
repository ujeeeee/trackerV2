// ==========================================
// ===== PLACES =====
// ==========================================
let placesTypes = [];
let placesOrphans = [];
let placeTypeCtx = { id: null };
let placeCtx = { id: null, typeId: null, priority: null, rating: null, status: 'want' };
let placesFilter = { type: '', city: '', rating: '' };

async function loadPlaces() {
    try {
        const { types, orphans } = await api('/api/places');
        placesTypes = types;
        placesOrphans = orphans;
        updatePlacesFilters();
        renderPlacesWant();
        renderPlacesVisited();
    } catch (e) { console.error(e); }
}

function updatePlacesFilters() {
    const typeSel = document.getElementById('placesFilterType');
    const curType = typeSel.value;
    typeSel.innerHTML = `<option value="">Все типы</option>` +
        placesTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    typeSel.value = curType;

    const allItems = [];
    placesTypes.forEach(t => (t.items || []).forEach(i => allItems.push(i)));
    placesOrphans.forEach(i => allItems.push(i));
    const cities = [...new Set(allItems.map(i => i.city).filter(Boolean))].sort();

    const citySel = document.getElementById('placesFilterCity');
    const curCity = citySel.value;
    citySel.innerHTML = `<option value="">Все города</option>` +
        cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    citySel.value = curCity;
}

function onPlacesFilterChange() {
    placesFilter.type = document.getElementById('placesFilterType').value;
    placesFilter.city = document.getElementById('placesFilterCity').value;
    placesFilter.rating = document.getElementById('placesFilterRating').value;
    renderPlacesWant();
    renderPlacesVisited();
}

function placeMatchesFilter(p) {
    if (placesFilter.type && String(p.type_id) !== placesFilter.type) return false;
    if (placesFilter.city && (p.city || '') !== placesFilter.city) return false;
    if (placesFilter.rating && (!p.rating || p.rating < parseInt(placesFilter.rating))) return false;
    return true;
}

async function clearPlaceOrphans() {
    const count = placesOrphans.filter(p => p.status !== 'visited').length;
    if (count === 0) return;
    if (!confirm(`Очистить все места из «Без типа» (${count})?`)) return;
    await api('/api/places/orphans', 'DELETE');
    await loadPlaces();
}

function renderPlacesWant() {
    const c = document.getElementById('placesWantList');
    const all = [...placesTypes, { id: null, name: 'Без типа', items: placesOrphans }];

    c.innerHTML = all.map(t => {
        const isOrphan = !t.id;
        const isOpen = !isCollapsed('placesWant', isOrphan ? 0 : t.id);
        const items = (t.items || []).filter(i => i.status !== 'visited' && placeMatchesFilter(i));
        const nameClick = isOrphan ? '' : `onclick="openPlaceTypeModal(${t.id})"`;
        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('placesWant', 0); renderPlacesWant();">▶</span>
                <div class="group-name clickable" onclick="clearPlaceOrphans()">Без типа</div>
                <div class="group-count">${items.length}</div>
                <button class="btn-icon-add" onclick="openPlaceModal(null, null)">+</button>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('placesWant', ${t.id}); renderPlacesWant();">▶</span>
                <div class="group-name clickable" ${nameClick}>${escapeHtml(t.name)}</div>
                <div class="group-count">${items.length}</div>
                <button class="btn-icon-add" onclick="openPlaceModal(null, ${t.id})">+</button>
            </div>`;

        const bodyHtml = isOpen
            ? (items.length === 0 ? `<div class="widget-empty">Пусто</div>` : items.map(p => placeItemHTML(p)).join(''))
            : '';

        return `<div class="place-card ${isOpen ? 'open' : ''}" ${t.id ? `data-id="${t.id}"` : ''}>
            ${header}
            <div class="group-body">${bodyHtml}</div>
        </div>`;
    }).join('');

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '.place-card[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('.place-card[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'places_types', ids });
            }
        });
    }

    c.querySelectorAll('.group-body').forEach(body => {
        if (!body.children.length) return;
        makeSortable(body, 'places_items', { draggable: '[data-id]' });
    });
}

function renderPlacesVisited() {
    const c = document.getElementById('placesVisitedList');
    const byType = [];
    placesTypes.forEach(t => {
        const visited = (t.items || []).filter(i => i.status === 'visited' && placeMatchesFilter(i));
        if (visited.length) byType.push({ id: t.id, name: t.name, items: visited });
    });
    const orphans = placesOrphans.filter(i => i.status === 'visited' && placeMatchesFilter(i));
    if (orphans.length) byType.push({ id: null, name: 'Без типа', items: orphans });

    if (!byType.length) {
        c.innerHTML = `<div class="empty-state">Пока ничего не посетил</div>`;
        return;
    }

    c.innerHTML = byType.map(t => {
        const isOrphan = !t.id;
        const isOpen = !isCollapsed('placesVisited', isOrphan ? 0 : t.id);
        const sorted = [...t.items].sort((a, b) => (b.rating || 0) - (a.rating || 0));

        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('placesVisited', 0); renderPlacesVisited();">▶</span>
                <div class="group-name">Без типа</div>
                <div class="group-count">${sorted.length}</div>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('placesVisited', ${t.id}); renderPlacesVisited();">▶</span>
                <div class="group-name">${escapeHtml(t.name)}</div>
                <div class="group-count">${sorted.length}</div>
            </div>`;

        return `<div class="place-card ${isOpen ? 'open' : ''}">
            ${header}
            <div class="group-body">${isOpen ? sorted.map(p => placeItemHTML(p)).join('') : ''}</div>
        </div>`;
    }).join('');
}

function placeItemHTML(p) {
    const pr = p.priority || 0;
    const pClass = pr >= 5 ? 'p5' : pr >= 4 ? 'p4' : pr >= 3 ? 'p3' : '';
    const parts = [];
    if (p.city) parts.push(p.city);
    if (p.country) parts.push(p.country);
    return `<div class="list-item" data-id="${p.id}" onclick="openPlaceModal(${p.id})">
        ${pr ? `<div class="item-priority ${pClass}">${pr}</div>` : ''}
        <div class="item-info">
            <div class="item-title">${escapeHtml(p.name)}</div>
            <div class="item-sub">${parts.join(', ') || '—'}</div>
        </div>
        ${p.rating ? `<div class="item-rating">★ ${p.rating}</div>` : ''}
        ${p.map_url ? `<button class="place-go" onclick="event.stopPropagation(); window.open('${escapeHtml(p.map_url)}', '_blank')">↗</button>` : ''}
    </div>`;
}

function openPlaceTypeModal(id = null) {
    placeTypeCtx = { id };
    const titleEl = document.getElementById('placeTypeTitle');
    const nameEl = document.getElementById('placeTypeName');
    const delBtn = document.getElementById('placeTypeDeleteBtn');

    if (id) {
        const t = placesTypes.find(x => x.id === id);
        if (t) { titleEl.textContent = 'Редактировать тип'; nameEl.value = t.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новый тип';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('placeTypeModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closePlaceTypeModal() { closeModal('placeTypeModal'); }

async function savePlaceType() {
    const name = document.getElementById('placeTypeName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (placeTypeCtx.id) await api(`/api/places/types/${placeTypeCtx.id}`, 'PATCH', { name });
        else await api('/api/places/types', 'POST', { name });
        closePlaceTypeModal();
        await loadPlaces();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deletePlaceTypeFromModal() {
    if (!placeTypeCtx.id) return;
    if (!confirm('Удалить тип? Места останутся без типа.')) return;
    await api(`/api/places/types/${placeTypeCtx.id}`, 'DELETE');
    closePlaceTypeModal();
    await loadPlaces();
}

function openPlaceModal(id = null, typeId = null) {
    placeCtx = { id, typeId, priority: null, rating: null, status: 'want' };
    const titleEl = document.getElementById('placeTitle');
    const nameEl = document.getElementById('placeName');
    const cityEl = document.getElementById('placeCity');
    const countryEl = document.getElementById('placeCountry');
    const mapEl = document.getElementById('placeMapUrl');
    const reviewEl = document.getElementById('placeReview');
    const delBtn = document.getElementById('placeDeleteBtn');
    const mapBtn = document.getElementById('placeOpenMapBtn');
    const sel = document.getElementById('placeTypeSelect');

    sel.innerHTML = `<option value="">Без типа</option>` +
        placesTypes.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

    if (id) {
        let item = null;
        for (const t of placesTypes) { const x = t.items.find(y => y.id === id); if (x) { item = x; break; } }
        if (!item) item = placesOrphans.find(x => x.id === id);

        if (item) {
            titleEl.textContent = 'Редактировать место';
            nameEl.value = item.name;
            cityEl.value = item.city || '';
            countryEl.value = item.country || '';
            mapEl.value = item.map_url || '';
            reviewEl.value = item.review || '';
            placeCtx.rating = item.rating || null;
            sel.value = item.type_id || '';
            placeCtx.priority = item.priority || null;
            placeCtx.status = item.status || 'want';
            mapBtn.style.display = item.map_url ? 'block' : 'none';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новое место';
        nameEl.value = '';
        cityEl.value = '';
        countryEl.value = '';
        mapEl.value = '';
        reviewEl.value = '';
        if (typeId) sel.value = typeId;
        delBtn.style.display = 'none';
        mapBtn.style.display = 'none';
    }

    document.querySelectorAll('#placePriority button').forEach(b =>
        b.classList.toggle('active', placeCtx.priority === parseInt(b.dataset.p)));
    document.querySelectorAll('#placeRatingPicker button').forEach(b =>
        b.classList.toggle('active', placeCtx.rating === parseInt(b.dataset.r)));
    document.querySelectorAll('#placeStatusTabs [data-st]').forEach(b =>
        b.classList.toggle('active', b.dataset.st === placeCtx.status));

    openModal('placeModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closePlaceModal() { closeModal('placeModal'); }

function pickPlacePriority(p, btn) {
    if (placeCtx.priority === p) {
        placeCtx.priority = null;
        btn.classList.remove('active');
    } else {
        placeCtx.priority = p;
        document.querySelectorAll('#placePriority button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function pickPlaceRating(r, btn) {
    if (placeCtx.rating === r) {
        placeCtx.rating = null;
        btn.classList.remove('active');
    } else {
        placeCtx.rating = r;
        document.querySelectorAll('#placeRatingPicker button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function pickPlaceStatus(st, btn) {
    placeCtx.status = st;
    document.querySelectorAll('#placeStatusTabs [data-st]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function savePlace() {
    const name = document.getElementById('placeName').value.trim();
    if (!name) return alert('Введи название');

    if (!placeCtx.id) {
        const low = name.toLowerCase();
        const inTypes = placesTypes.some(t => (t.items || []).some(i => (i.name || '').toLowerCase() === low));
        const inOrphans = placesOrphans.some(i => (i.name || '').toLowerCase() === low);
        if ((inTypes || inOrphans) && !confirm(`Место «${name}» уже есть.\nДобавить дубликат?`)) return;
    }

    const typeVal = document.getElementById('placeTypeSelect').value;
    const payload = {
        name,
        type_id: typeVal ? parseInt(typeVal) : null,
        city: document.getElementById('placeCity').value,
        country: document.getElementById('placeCountry').value,
        map_url: document.getElementById('placeMapUrl').value,
        status: placeCtx.status,
        priority: placeCtx.priority,
        rating: placeCtx.rating,
        review: document.getElementById('placeReview').value || null,
    };
    try {
        if (placeCtx.id) await api(`/api/places/items/${placeCtx.id}`, 'PATCH', payload);
        else await api('/api/places/items', 'POST', payload);
        closePlaceModal();
        await loadPlaces();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deletePlaceFromModal() {
    if (!placeCtx.id) return;
    if (!confirm('Удалить место?')) return;
    await api(`/api/places/items/${placeCtx.id}`, 'DELETE');
    closePlaceModal();
    await loadPlaces();
}

function openPlaceMap() {
    const url = document.getElementById('placeMapUrl').value.trim();
    if (url) window.open(url, '_blank');
}