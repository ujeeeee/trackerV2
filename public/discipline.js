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
// ===== DISCIPLINE: ЦЕЛИ =====
// ==========================================
let areas = [];
let areaCtx = { id: null };
let goalCtx = { id: null, areaId: null };

async function loadAreas() {
    try {
        const { areas: d, orphanGoals } = await api('/api/disc/areas');
        areas = d;
        renderAreas(orphanGoals);
    } catch (e) { console.error(e); }
}

function renderAreas(orphans = []) {
    const c = document.getElementById('areasList');
    if (!areas.length && !orphans.length) {
        c.innerHTML = `<div class="empty-state">Нет областей. Нажми +</div>`;
        return;
    }

    c.innerHTML = areas.map(a => {
        const isOpen = !isCollapsed('discAreas', a.id);
        const done = a.goals.filter(g => g.status === 'done').length;
        const prog = a.goals.length ? `${done}/${a.goals.length}` : '';
        return `<div class="area-card ${isOpen ? 'open' : ''}" data-id="${a.id}">
            <div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('discAreas', ${a.id}); renderAreas();">▶</span>
                <div class="group-name clickable" onclick="openAreaModal(${a.id})">${escapeHtml(a.name)}</div>
                ${prog ? `<div class="group-progress">${prog}</div>` : ''}
                <button class="btn-icon-add" onclick="openGoalModal(null, ${a.id})">+</button>
            </div>
            <div class="group-body">
                ${a.goals.map(g => goalHTML(g)).join('')}
            </div>
        </div>`;
    }).join('') + (orphans.length ? `<div class="area-card">
        <div class="group-header"><div class="group-name">Без области</div>
            <button class="btn-icon-add" onclick="openGoalModal(null, null)">+</button>
        </div>
        <div class="group-body">${orphans.map(g => goalHTML(g)).join('')}</div>
    </div>` : '');

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '.area-card[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('.area-card[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'disc_areas', ids });
            }
        });
    }

    c.querySelectorAll('.group-body').forEach(body => {
        if (!body.children.length) return;
        makeSortable(body, 'disc_goals', { draggable: '[data-id]' });
    });
}

function goalHTML(g) {
    return `<div class="list-item" data-id="${g.id}" onclick="openGoalModal(${g.id}, ${g.area_id || 'null'})">
        <div class="item-check ${g.status === 'done' ? 'done' : ''}" onclick="event.stopPropagation(); toggleGoal(${g.id}, '${g.status}')">✓</div>
        <div class="item-info"><div class="item-title ${g.status === 'done' ? 'done' : ''}">${escapeHtml(g.name)}</div></div>
        <button class="area-delete" onclick="event.stopPropagation(); deleteGoal(${g.id})">✕</button>
    </div>`;
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

function openAreaModal(id = null) {
    areaCtx = { id };
    const titleEl = document.getElementById('areaModalTitle');
    const nameEl = document.getElementById('areaName');
    const delBtn = document.getElementById('areaDeleteBtn');

    if (id) {
        const a = areas.find(x => x.id === id);
        if (a) { titleEl.textContent = 'Редактировать область'; nameEl.value = a.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая область';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('areaModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeAreaModal() { closeModal('areaModal'); }

async function saveArea() {
    const name = document.getElementById('areaName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (areaCtx.id) await api(`/api/disc/areas/${areaCtx.id}`, 'PATCH', { name });
        else await api('/api/disc/areas', 'POST', { name });
        closeAreaModal();
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteAreaFromModal() {
    if (!areaCtx.id) return;
    if (!confirm('Удалить область со всеми целями?')) return;
    await api(`/api/disc/areas/${areaCtx.id}`, 'DELETE');
    closeAreaModal();
    await loadAreas();
}

function openGoalModal(id = null, areaId = null) {
    goalCtx = { id, areaId };
    const titleEl = document.getElementById('goalModalTitle');
    const nameEl = document.getElementById('goalName');
    const delBtn = document.getElementById('goalDeleteBtn');

    if (id) {
        let found = null;
        for (const a of areas) { const g = a.goals.find(x => x.id === id); if (g) { found = g; break; } }
        if (found) { titleEl.textContent = 'Редактировать цель'; nameEl.value = found.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая цель';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('goalModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeGoalModal() { closeModal('goalModal'); }

async function saveGoal() {
    const name = document.getElementById('goalName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (goalCtx.id) await api(`/api/disc/goals/${goalCtx.id}`, 'PATCH', { name });
        else await api('/api/disc/goals', 'POST', { name, area_id: goalCtx.areaId });
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
                months += `<span style="left:${i * 15}px;">${MONTHS[m]}</span>`;
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