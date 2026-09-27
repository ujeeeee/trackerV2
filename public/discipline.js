// ==========================================
// ===== DISCIPLINE: ПРИВЫЧКИ =====
// ==========================================
let habits = [];
let habitCtx = { id: null, freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };
let weekStart = getMonday(new Date());

function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    date.setHours(12, 0, 0, 0);
    return date;
}

async function loadHabits() {
    try {
        const { habits: d } = await api('/api/disc/habits');
        habits = d;
    } catch (e) { console.error(e); }
}

async function loadWeek() {
    const start = localDate(weekStart);
    try {
        const { habits: d } = await api(`/api/disc/habits/week?start=${start}`);
        renderWeek(d);
    } catch (e) { console.error(e); }
}

function renderWeek(data) {
    const rangeEl = document.getElementById('weekRange');
    const grid = document.getElementById('weekGrid');
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    rangeEl.textContent = `${weekStart.getDate()} ${months[weekStart.getMonth()]} — ${end.getDate()} ${months[end.getMonth()]}`;

    if (!data?.length) {
        grid.innerHTML = `<div class="empty-state">Нет привычек. Нажми +</div>`;
        return;
    }
    const today = localDate(new Date());
    const dn = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    let html = `<div class="week-grid-table"><div class="week-header"><div class="week-header-cell">Привычка</div>`;
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const ds = localDate(d);
        html += `<div class="week-header-cell ${ds === today ? 'today' : ''}">${dn[i]}<span class="week-header-date">${d.getDate()}</span></div>`;
    }
    html += `</div>`;

    data.forEach(h => {
        html += `<div class="week-row" data-id="${h.id}"><div class="week-habit-name" onclick="openHabitModal(${h.id})">${escapeHtml(h.name)}</div>`;
        h.week.forEach(day => {
            if (!day.scheduled) { html += `<div class="week-cell not-scheduled"></div>`; return; }
            const isFuture = day.date > today;
            const cls = ['week-cell', 'scheduled', day.done ? 'done' : '', day.date === today ? 'today' : ''].filter(Boolean).join(' ');
            const handler = !isFuture ? `onclick="toggleWeekCell(${h.id}, '${day.date}')"` : '';
            html += `<div class="${cls}" ${handler}>${day.done ? '✓' : ''}</div>`;
        });
        html += `</div>`;
    });
    html += `</div>`;
    grid.innerHTML = html;
    if (!grid._sortable && window.Sortable) {
        grid._sortable = new Sortable(grid, {
            animation: 150, delay: 300, delayOnTouchOnly: true,
            draggable: '.week-row[data-id]',
            filter: '.week-cell',
            onEnd: async () => {
                const ids = [...grid.querySelectorAll('.week-row[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'disc_habits', ids });
            }
        });
    }
}

async function toggleWeekCell(habitId, date) {
    try {
        await api(`/api/disc/habits/${habitId}/toggle`, 'POST', { date });
        await loadWeek();
        await loadHabits();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function weekPrev() { weekStart.setDate(weekStart.getDate() - 7); loadWeek(); }
function weekNext() { weekStart.setDate(weekStart.getDate() + 7); loadWeek(); }

function openHabitModal(id = null) {
    habitCtx = { id, freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };
    const titleEl = document.getElementById('habitModalTitle');
    const nameEl = document.getElementById('habitName');
    const delBtn = document.getElementById('habitDeleteBtn');

    if (id) {
        const h = habits.find(x => x.id === id);
        if (h) {
            titleEl.textContent = 'Редактировать привычку';
            nameEl.value = h.name;
            habitCtx.freq = h.frequency || 'daily';
            habitCtx.days = h.days_of_week?.length ? h.days_of_week : [1,2,3,4,5,6,7];
            habitCtx.interval = h.interval_days || 2;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая привычка';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }

    document.getElementById('intervalInput').value = habitCtx.interval;
    document.querySelectorAll('#habitModal [data-freq]').forEach(b => b.classList.toggle('active', b.dataset.freq === habitCtx.freq));
    document.querySelectorAll('#habitModal .day-opt').forEach(b => b.classList.toggle('active', habitCtx.days.includes(parseInt(b.dataset.dow))));
    document.getElementById('freqDays').style.display = habitCtx.freq === 'days' ? 'block' : 'none';
    document.getElementById('freqInterval').style.display = habitCtx.freq === 'interval' ? 'block' : 'none';

    openModal('habitModal');
    setTimeout(() => nameEl.focus(), 200);
}

function closeHabitModal() { closeModal('habitModal'); }

function pickFreq(freq, btn) {
    habitCtx.freq = freq;
    document.querySelectorAll('#habitModal [data-freq]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('freqDays').style.display = freq === 'days' ? 'block' : 'none';
    document.getElementById('freqInterval').style.display = freq === 'interval' ? 'block' : 'none';
}

function toggleDow(dow) {
    const i = habitCtx.days.indexOf(dow);
    if (i >= 0) habitCtx.days.splice(i, 1); else habitCtx.days.push(dow);
    document.querySelectorAll('#habitModal .day-opt').forEach(b =>
        b.classList.toggle('active', habitCtx.days.includes(parseInt(b.dataset.dow))));
}

async function saveHabit() {
    const name = document.getElementById('habitName').value.trim();
    if (!name) return alert('Введи название');
    if (habitCtx.freq === 'days' && habitCtx.days.length === 0) return alert('Выбери дни');
    const intervalVal = parseInt(document.getElementById('intervalInput').value);
    if (habitCtx.freq === 'interval' && (!intervalVal || intervalVal < 2)) return alert('Минимум 2 дня');
    const payload = { name, frequency: habitCtx.freq, days_of_week: habitCtx.days, interval_days: intervalVal || 2 };
    try {
        if (habitCtx.id) await api(`/api/disc/habits/${habitCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/habits', 'POST', payload);
        closeHabitModal();
        await loadHabits();
        await loadWeek();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteHabit() {
    if (!habitCtx.id) return;
    if (!confirm('Удалить привычку и все отметки?')) return;
    try {
        await api(`/api/disc/habits/${habitCtx.id}`, 'DELETE');
        closeHabitModal();
        await loadHabits();
        await loadWeek();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// ===== DISCIPLINE: ДЕЛА =====
// ==========================================
let todos = [];
let todoCtx = { id: null };

async function loadTodos() {
    try {
        const { todos: data } = await api('/api/disc/todos');
        todos = data;
        renderTodos();
    } catch (e) { console.error(e); }
}

function renderTodos() {
    const c = document.getElementById('todosList');
    if (!todos.length) {
        c.innerHTML = `<div class="widget-empty">Пусто. Нажми + чтобы добавить</div>`;
        return;
    }

    const sorted = [...todos].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const aHas = !!a.date;
        const bHas = !!b.date;
        if (aHas && bHas) return a.date.localeCompare(b.date);
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
    });

    c.innerHTML = sorted.map(t => {
        let metaHtml = '';
        if (t.date) {
            const label = getDayLabel(t.date);
            const dateStr = formatDate(t.date);
            let cls = '';
            if (label === 'вчера') cls = 'overdue';
            else if (label === 'сегодня') cls = 'today';
            else if (label === 'завтра') cls = 'tomorrow';
            const display = label ? `${dateStr} (${label})` : dateStr;
            metaHtml = `<div class="todo-meta"><span class="${cls}">${display}</span>`;
            if (t.time_start || t.time_end) {
                metaHtml += ` · ${t.time_start || '?'}—${t.time_end || '?'}`;
            }
            metaHtml += `</div>`;
        } else if (t.time_start || t.time_end) {
            metaHtml = `<div class="todo-meta">${t.time_start || '?'}—${t.time_end || '?'}</div>`;
        }

        return `<div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}" onclick="openTodoModal(${t.id})">
            <div class="item-check ${t.done ? 'done' : ''}" onclick="event.stopPropagation(); toggleTodo(${t.id}, ${t.done})">✓</div>
            <div class="todo-body">
                <div class="todo-name">${escapeHtml(t.name)}</div>
                ${metaHtml}
            </div>
        </div>`;
    }).join('');

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'disc_todos', ids });
            }
        });
    }
}

function openTodoModal(id = null) {
    todoCtx = { id };
    const titleEl = document.getElementById('todoModalTitle');
    const nameEl = document.getElementById('todoName');
    const dateEl = document.getElementById('todoDate');
    const timeStartEl = document.getElementById('todoTimeStart');
    const timeEndEl = document.getElementById('todoTimeEnd');
    const delBtn = document.getElementById('todoDeleteBtn');

    if (id) {
        const t = todos.find(x => x.id === id);
        if (t) {
            titleEl.textContent = 'Редактировать дело';
            nameEl.value = t.name;
            dateEl.value = t.date || '';
            timeStartEl.value = t.time_start || '';
            timeEndEl.value = t.time_end || '';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новое дело';
        nameEl.value = '';
        dateEl.value = '';
        timeStartEl.value = '';
        timeEndEl.value = '';
        delBtn.style.display = 'none';
    }

    openModal('todoModal');
    setTimeout(() => nameEl.focus(), 200);
}

function closeTodoModal() { closeModal('todoModal'); }

async function saveTodo() {
    const name = document.getElementById('todoName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        name,
        date: document.getElementById('todoDate').value || null,
        time_start: document.getElementById('todoTimeStart').value || null,
        time_end: document.getElementById('todoTimeEnd').value || null,
    };
    try {
        if (todoCtx.id) await api(`/api/disc/todos/${todoCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/todos', 'POST', payload);
        closeTodoModal();
        await loadTodos();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function toggleTodo(id, done) {
    try {
        await api(`/api/disc/todos/${id}`, 'PATCH', { done: !done });
        await loadTodos();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteTodo() {
    if (!todoCtx.id) return;
    if (!confirm('Удалить дело?')) return;
    try {
        await api(`/api/disc/todos/${todoCtx.id}`, 'DELETE');
        closeTodoModal();
        await loadTodos();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// ===== DISCIPLINE: ЦЕЛИ (дерево областей) =====
// ==========================================
let areasFlat = [];       // [{id, name, parent_id, ...}]
let goalsFlat = [];       // [{id, name, area_id, status}]
let areaCtx = { id: null, parentId: null };
let goalCtx = { id: null, areaId: null };

async function loadAreas() {
    try {
        const { areas, goals } = await api('/api/disc/areas');
        areasFlat = areas;
        goalsFlat = goals;
        renderAreas();
    } catch (e) { console.error(e); }
}

function renderAreas() {
    const c = document.getElementById('areasList');
    if (!areasFlat.length && !goalsFlat.length) {
        c.innerHTML = `<div class="empty-state">Нет областей. Нажми +</div>`;
        return;
    }
    c.innerHTML = renderAreaChildren(null, 0) + renderOrphanGoals();
    bindAreaSortable();
}

function renderAreaChildren(parentId, depth) {
    const kids = areasFlat.filter(a => (a.parent_id || null) === parentId);
    return kids.map(a => renderAreaNode(a, depth)).join('');
}

function renderAreaNode(area, depth) {
    const kids = areasFlat.filter(x => x.parent_id === area.id);
    const goals = goalsFlat.filter(g => g.area_id === area.id);
    const done = goals.filter(g => g.status === 'done').length;
    const prog = goals.length ? `${done}/${goals.length}` : '';
    const isOpen = !isCollapsed('discAreas', area.id);
    const indent = 0;

    return `<div class="area-card area-depth-${depth} ${isOpen ? 'open' : ''}"
                data-id="${area.id}"
                style="margin-left:${indent}px;">
        <div class="group-header">
            <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('discAreas', ${area.id}); renderAreas();">▶</span>
            <div class="group-name clickable" onclick="openAreaModal(${area.id})">${escapeHtml(area.name)}</div>
            ${prog ? `<div class="group-progress">${prog}</div>` : ''}
            <button class="btn-icon-add" title="Добавить подобласть" onclick="openAreaModal(null, ${area.id})">+</button>
            <button class="btn-icon-add" title="Добавить цель" onclick="openGoalModal(null, ${area.id})">✓</button>
        </div>
        <div class="group-body">
            ${goals.map(g => goalHTML(g)).join('')}
            ${renderAreaChildren(area.id, depth + 1)}
        </div>
    </div>`;
}

function renderOrphanGoals() {
    const orphans = goalsFlat.filter(g => !g.area_id);
    if (!orphans.length) return '';
    return `<div class="area-card">
        <div class="group-header"><div class="group-name">Без области</div>
            <button class="btn-icon-add" onclick="openGoalModal(null, null)">+</button>
        </div>
        <div class="group-body">${orphans.map(g => goalHTML(g)).join('')}</div>
    </div>`;
}

function goalHTML(g) {
    return `<div class="list-item" data-goal-id="${g.id}" onclick="openGoalModal(${g.id}, ${g.area_id || 'null'})">
        <div class="item-check ${g.status === 'done' ? 'done' : ''}" onclick="event.stopPropagation(); toggleGoal(${g.id}, '${g.status}')">✓</div>
        <div class="item-info"><div class="item-title ${g.status === 'done' ? 'done' : ''}">${escapeHtml(g.name)}</div></div>
        <button class="area-delete" onclick="event.stopPropagation(); deleteGoal(${g.id})">✕</button>
    </div>`;
}

function bindAreaSortable() {
    const c = document.getElementById('areasList');
    if (!c || !window.Sortable) return;

    // Пересоздаём sortable для каждого group-body (цели внутри)
    c.querySelectorAll('.group-body').forEach(body => {
        if (body._sortable) body._sortable.destroy();
        body._sortable = null;
    });

    // Sortable для корневых областей
    if (c._sortable) c._sortable.destroy();
    c._sortable = new Sortable(c, {
        animation: 150, delay: 250, delayOnTouchOnly: true,
        draggable: ':scope > .area-card[data-id]',
        onEnd: async () => {
            const ids = [...c.querySelectorAll(':scope > .area-card[data-id]')]
                .map(el => parseInt(el.dataset.id)).filter(Boolean);
            if (ids.length) await api('/api/reorder', 'POST', { table: 'disc_areas', ids });
        }
    });

    // Sortable для вложенных областей (внутри .group-body)
    c.querySelectorAll('.group-body').forEach(body => {
        const directAreas = [...body.querySelectorAll(':scope > .area-card[data-id]')];
        const directGoals = [...body.querySelectorAll(':scope > .list-item[data-goal-id]')];

        if (directAreas.length) {
            body._sortableAreas = new Sortable(body, {
                animation: 150, delay: 250, delayOnTouchOnly: true,
                draggable: ':scope > .area-card[data-id]',
                onEnd: async () => {
                    const ids = [...body.querySelectorAll(':scope > .area-card[data-id]')]
                        .map(el => parseInt(el.dataset.id)).filter(Boolean);
                    if (ids.length) await api('/api/reorder', 'POST', { table: 'disc_areas', ids });
                }
            });
        }
    });
}

async function toggleGoal(id, s) {
    await api(`/api/disc/goals/${id}`, 'PATCH', { status: s === 'done' ? 'plan' : 'done' });
    await loadAreas();
}

async function deleteGoal(id) {
    if (!confirm('Удалить цель?')) return;
    await api(`/api/disc/goals/${id}`, 'DELETE');
    await loadAreas();
}

// --- Область ---
function openAreaModal(id = null, parentId = null) {
    areaCtx = { id, parentId };
    const titleEl = document.getElementById('areaModalTitle');
    const nameEl = document.getElementById('areaName');
    const delBtn = document.getElementById('areaDeleteBtn');
    const parentSel = document.getElementById('areaParentSelect');

    // Собираем опции родителей (исключая себя и своих детей)
    const excludeIds = new Set();
    if (id) {
        excludeIds.add(id);
        let added = true;
        while (added) {
            added = false;
            areasFlat.forEach(a => {
                if (a.parent_id && excludeIds.has(a.parent_id) && !excludeIds.has(a.id)) {
                    excludeIds.add(a.id);
                    added = true;
                }
            });
        }
    }
    const available = areasFlat.filter(a => !excludeIds.has(a.id));
    parentSel.innerHTML = `<option value="">— Верхний уровень —</option>` +
        available.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

    if (id) {
        const a = areasFlat.find(x => x.id === id);
        if (a) {
            titleEl.textContent = 'Редактировать область';
            nameEl.value = a.name;
            parentSel.value = a.parent_id || '';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = parentId ? 'Новая подобласть' : 'Новая область';
        nameEl.value = '';
        parentSel.value = parentId || '';
        delBtn.style.display = 'none';
    }
    openModal('areaModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeAreaModal() { closeModal('areaModal'); }

async function saveArea() {
    const name = document.getElementById('areaName').value.trim();
    if (!name) return alert('Введи название');
    const parentVal = document.getElementById('areaParentSelect').value;
    const payload = { name, parent_id: parentVal ? parseInt(parentVal) : null };
    try {
        if (areaCtx.id) await api(`/api/disc/areas/${areaCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/areas', 'POST', payload);
        closeAreaModal();
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteAreaFromModal() {
    if (!areaCtx.id) return;
    if (!confirm('Удалить область со всеми подобластями и целями?')) return;
    await api(`/api/disc/areas/${areaCtx.id}`, 'DELETE');
    closeAreaModal();
    await loadAreas();
}

// --- Цель ---
function openGoalModal(id = null, areaId = null) {
    goalCtx = { id, areaId };
    const titleEl = document.getElementById('goalModalTitle');
    const nameEl = document.getElementById('goalName');
    const delBtn = document.getElementById('goalDeleteBtn');
    const areaSel = document.getElementById('goalAreaSelect');

    areaSel.innerHTML = `<option value="">— Без области —</option>` +
        areasFlat.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

    if (id) {
        const g = goalsFlat.find(x => x.id === id);
        if (g) {
            titleEl.textContent = 'Редактировать цель';
            nameEl.value = g.name;
            areaSel.value = g.area_id || '';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая цель';
        nameEl.value = '';
        areaSel.value = areaId || '';
        delBtn.style.display = 'none';
    }
    openModal('goalModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeGoalModal() { closeModal('goalModal'); }

async function saveGoal() {
    const name = document.getElementById('goalName').value.trim();
    if (!name) return alert('Введи название');
    const areaVal = document.getElementById('goalAreaSelect').value;
    const payload = { name, area_id: areaVal ? parseInt(areaVal) : null };
    try {
        if (goalCtx.id) await api(`/api/disc/goals/${goalCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/goals', 'POST', payload);
        closeGoalModal();
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteGoalFromModal() {
    if (!goalCtx.id) return;
    if (!confirm('Удалить цель?')) return;
    await api(`/api/disc/goals/${goalCtx.id}`, 'DELETE');
    closeGoalModal();
    await loadAreas();
}

// ==========================================
// ===== HABIT REPORT (все привычки) =====
// ==========================================
async function openHabitReport() {
    document.getElementById('habitReportBody').innerHTML = '<div class="widget-empty">Загрузка...</div>';
    openModal('habitReportModal');
    try {
        const { habits: data } = await api('/api/disc/habits?days=365');
        renderHabitReport(data);
    } catch (e) {
        document.getElementById('habitReportBody').innerHTML = `<div class="widget-empty">Ошибка: ${e.message}</div>`;
    }
}

function closeHabitReport() { closeModal('habitReportModal'); }

function renderHabitReport(list) {
    const body = document.getElementById('habitReportBody');
    if (!list.length) {
        body.innerHTML = '<div class="widget-empty">Нет привычек</div>';
        return;
    }

    const today = new Date(); today.setHours(12, 0, 0, 0);
    const todayStr = localDate(today);

    // Начало: 12 месяцев назад, округлённое до понедельника
    const start = new Date(today);
    start.setMonth(start.getMonth() - 12);
    const startMonday = getMonday(start);

    // Список дней от старта до сегодня
    const days = [];
    const cursor = new Date(startMonday);
    while (cursor <= today) {
        days.push(localDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    // Разбиваем на недели (по 7 дней)
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }

    const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

    body.innerHTML = list.map(h => {
        const done = new Set((h.logs || []).filter(l => l.done).map(l => l.date));

        // Сетка: 7 строк (Пн-Вс), колонки — недели
        let grid = '';
        weeks.forEach(week => {
            week.forEach(day => {
                const isFuture = day > todayStr;
                const isDone = done.has(day);
                let cls = 'habit-rep-cell';
                if (isFuture) cls += ' future';
                else if (isDone) cls += ' done';
                else cls += ' empty';
                grid += `<div class="${cls}"></div>`;
            });
        });

        // Метки месяцев над сеткой
        let months = '';
        let lastMonth = -1;
        weeks.forEach((week, i) => {
            const firstDay = new Date(week[0] + 'T12:00:00');
            const m = firstDay.getMonth();
            if (m !== lastMonth) {
                months += `<span style="left:${i * 19}px;">${MONTHS[m]}</span>`;
                lastMonth = m;
            }
        });

        return `<div class="habit-rep-block">
            <div class="habit-rep-header">
                <div class="habit-rep-name" onclick="closeHabitReport(); openHabitDashboard(${h.id})">${escapeHtml(h.name)}</div>
                <div class="habit-rep-count">${done.size}</div>
            </div>
            <div class="habit-rep-scroll">
                <div class="habit-rep-months">${months}</div>
                <div class="habit-rep-grid">${grid}</div>
            </div>
        </div>`;
    }).join('');

    // Скроллим к сегодняшнему дню
    setTimeout(() => {
        document.querySelectorAll('.habit-rep-scroll').forEach(el => {
            el.scrollLeft = el.scrollWidth;
        });
    }, 50);
}