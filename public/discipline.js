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
// ===== DISCIPLINE: ЦЕЛИ — ИНТЕРАКТИВНОЕ ДЕРЕВО =====
// ==========================================
let areasFlat = [];
let goalsFlat = [];
let treeRoot = null;
let treeNodesById = {};
let selectedNodeId = null;
let lastFocusedNodeId = null;
let cameraStack = [];  // история навигации

const camera = { x: 0, y: 0, scale: 1 };
const MAX_SCALE = 3;
let minAllowedScale = 0.3;   // динамический минимум

const NODE_W = 180;
const NODE_H = 52;
const H_GAP = 22;
const V_GAP = 60;
const ROOT_GAP = 60;
const PAD_GOALS = 6;
const GOAL_ROW_H = 20;

// Text layout
const NAME_TOP = 12;             // верхний отступ до первой строки имени
const NAME_LINE_H = 16;          // высота одной строки
const NAME_MAX_LINES = 3;        // макс. строк
const NAME_CHARS_PER_LINE = 17;  // символов в строке
const SUB_GAP = 2;               // отступ между именем и subtitle
const SUB_H = 14;                // высота subtitle
const BOTTOM_PAD = 8;            // нижний отступ карточки

let _collapsedAreas = new Set();

let _collapsedGoals = new Set(
    JSON.parse(localStorage.getItem('collapse_goalLists') || '[]')
);
function saveCollapsedGoals() {
    localStorage.setItem('collapse_goalLists', JSON.stringify([..._collapsedGoals]));
}
function isGoalsCollapsed(areaId) {
    return _collapsedGoals.has(areaId);
}
function toggleGoalsCollapsed(areaId) {
    if (_collapsedGoals.has(areaId)) _collapsedGoals.delete(areaId);
    else _collapsedGoals.add(areaId);
    saveCollapsedGoals();
    renderTree();
}

// ==========================================
// ЗАГРУЗКА
// ==========================================
async function loadAreas() {
    try {
        const { areas, goals } = await api('/api/disc/areas');
        areasFlat = areas;
        goalsFlat = goals;
        _collapsedAreas = collapsed['discAreas'] || new Set();
        buildTreeData();
        renderTree();
    } catch (e) { console.error(e); }
}

function buildTreeData() {
    treeNodesById = {};

    // Виртуальный корень
    const root = {
        id: 'root',
        type: 'root',
        name: 'МОИ ЦЕЛИ',
        children: [],
    };
    treeNodesById['root'] = root;

    // Области
    areasFlat.forEach(a => {
        const id = 'a:' + a.id;
        treeNodesById[id] = {
            id,
            rawId: a.id,
            type: 'area',
            name: a.name,
            parentAreaId: a.parent_id,
            children: [],
        };
    });

    // Цели
    // Цели — это листья, они не рисуются как отдельные ноды
    // Их держим в отдельном объекте goalsByArea
    // (в treeNodesById тоже добавим для совместимости)
    goalsFlat.forEach(g => {
        const id = 'g:' + g.id;
        treeNodesById[id] = {
            id,
            rawId: g.id,
            type: 'goal',
            name: g.name,
            done: g.status === 'done',
            areaId: g.area_id,
            children: [],
        };
    });

    // Связываем области
    // Связываем области — инициализируем goals массивом
    areasFlat.forEach(a => {
        treeNodesById['a:' + a.id].goals = [];
    });

    areasFlat.forEach(a => {
        const node = treeNodesById['a:' + a.id];
        if (a.parent_id && treeNodesById['a:' + a.parent_id]) {
            treeNodesById['a:' + a.parent_id].children.push(node);
        } else {
            root.children.push(node);
        }
    });

    // Цели — в goals к области
    goalsFlat.forEach(g => {
        const areaNode = g.area_id ? treeNodesById['a:' + g.area_id] : null;
        if (areaNode) {
            areaNode.goals.push({
                id: 'g:' + g.id,
                rawId: g.id,
                name: g.name,
                done: g.status === 'done',
            });
        }
    });

    treeRoot = root;
}

// ==========================================
// LAYOUT
// ==========================================
function computeSubtreeWidth(node) {
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    const hasVisibleChildren = node.children.length > 0 && !isCollapsed;

    if (!hasVisibleChildren) {
        node.subtreeWidth = NODE_W;
        return;
    }
    const gap = (node.type === 'root') ? ROOT_GAP : H_GAP;
    let total = 0;
    node.children.forEach((c, i) => {
        computeSubtreeWidth(c);
        total += c.subtreeWidth;
        if (i < node.children.length - 1) total += gap;
    });
    node.subtreeWidth = Math.max(NODE_W, total);
}

function computeNodeHeight(node) {
    const nameLines = wrapText(node.name, NAME_CHARS_PER_LINE, NAME_MAX_LINES).length;
    const sub = getNodeSubtitle(node);
    const subSpace = sub ? SUB_GAP + SUB_H : 0;
    node.headH = Math.max(NODE_H, NAME_TOP + nameLines * NAME_LINE_H + subSpace + BOTTOM_PAD);

    const showGoals = node.type === 'area' && node.goals && node.goals.length && !isGoalsCollapsed(node.rawId);
    const goalsH = showGoals ? PAD_GOALS + node.goals.length * GOAL_ROW_H + 6 : 0;
    node.goalsTop = showGoals ? node.headH + PAD_GOALS : 0;
    return node.headH + goalsH;
}

function assignPositions(node, leftX, topY) {
    node.h = computeNodeHeight(node);
    node.x = leftX + node.subtreeWidth / 2;
    node.y = topY + node.h / 2;

    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (!node.children.length || isCollapsed) return;

    const gap = (node.type === 'root') ? ROOT_GAP : H_GAP;
    const totalChildrenW = node.children.reduce((s, c, i) => s + c.subtreeWidth + (i ? gap : 0), 0);
    let cursor = leftX + (node.subtreeWidth - totalChildrenW) / 2;
    node.children.forEach(c => {
        assignPositions(c, cursor, topY + node.h + V_GAP);
        cursor += c.subtreeWidth + gap;
    });
}

function layoutTree() {
    computeSubtreeWidth(treeRoot);
    assignPositions(treeRoot, 0, 0);

    // Нормализуем: корень в (0, 0)
    const dx = treeRoot.x;
    const dy = treeRoot.y;
    Object.values(treeNodesById).forEach(n => {
        if (n.x !== undefined) { n.x -= dx; n.y -= dy; }
    });
}

// ==========================================
// РЕНДЕР
// ==========================================
function renderTree() {
    if (!treeRoot) return;
    layoutTree();
    updateMinScale();

    const svg = document.getElementById('treeSvg');
    if (!svg) return;

    let html = '<g id="treeCamera">';

    // Рёбра
    html += renderEdges(treeRoot);
    // Узлы
    html += renderNodes(treeRoot);

    html += '</g>';
    svg.innerHTML = html;

    applyCamera();
    updateBreadcrumb();
    updateActionsBar();

    // Первый рендер — центрируем
    // Первый рендер — подгоняем
    if (!camera._init) {
        camera._init = true;
        selectedNodeId = null;
        updateBreadcrumb();
        updateActionsBar();
        setTimeout(() => fitTree(), 80);
    }
}

function renderEdges(node) {
    if (node.type === 'root') {
        let html = '';
        node.children.forEach(c => { html += renderEdges(c); });
        return html;
    }
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (isCollapsed || !node.children.length) return '';
    let html = '';
    node.children.forEach(c => {
        const x1 = node.x;
        const y1 = node.y + (node.h || NODE_H) / 2;
        const x2 = c.x;
        const y2 = c.y - (c.h || NODE_H) / 2;
        const midY = (y1 + y2) / 2;
        html += `<path class="tree-edge" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" />`;
        html += renderEdges(c);
    });
    return html;
}

function renderNodes(node) {
    let html = '';
    if (node.type !== 'root') {
        html = renderSingleNode(node);
    }
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (!isCollapsed) {
        node.children.forEach(c => { html += renderNodes(c); });
    }
    return html;
}

function renderSingleNode(n) {
    const x = n.x - NODE_W / 2;
    const y = n.y - n.h / 2;
    const totalH = n.h;
    const isCollapsed = n.type === 'area' && _collapsedAreas.has(n.rawId);
    const isGoalsCollapsedFlag = n.type === 'area' && isGoalsCollapsed(n.rawId);
    const hasGoals = n.type === 'area' && n.goals && n.goals.length > 0;
    const showGoals = hasGoals && !isGoalsCollapsedFlag && !isCollapsed;
    const cls = ['tree-node'];
    if (isCollapsed) cls.push('collapsed');
    if (selectedNodeId === n.id) cls.push('active');

    const sub = getNodeSubtitle(n);
    const arrow = hasGoals ? (isGoalsCollapsedFlag ? ' ▸' : ' ▾') : '';
    const subText = sub ? `${sub}${arrow}` : '';

    const nameLines = wrapText(n.name, NAME_CHARS_PER_LINE, NAME_MAX_LINES);
    const nameBlockH = nameLines.length * NAME_LINE_H;

    let nameTspans = '';
    nameLines.forEach((line, i) => {
        const lineY = NAME_TOP + i * NAME_LINE_H + 12;
        nameTspans += `<tspan x="${NODE_W / 2}" y="${lineY}">${escapeSvg(line)}</tspan>`;
    });

    const subBaselineY = NAME_TOP + nameBlockH + SUB_GAP + 11;

    let inner = '';
    inner += `<text class="tn-name" text-anchor="middle" pointer-events="none">${nameTspans}</text>`;
    if (subText) {
        inner += `<text class="tn-sub" x="${NODE_W / 2}" y="${subBaselineY}" text-anchor="middle" pointer-events="none">${escapeSvg(subText)}</text>`;
    }

    if (hasGoals) {
        const subRectY = NAME_TOP + nameBlockH + SUB_GAP - 2;
        const subRectH = SUB_H + 4;
        inner += `<rect class="tn-sub-clickable-rect" x="0" y="${subRectY}" width="${NODE_W}" height="${subRectH}" fill="transparent" pointer-events="all" data-toggle-goals="${n.rawId}" />`;
    }

    let goalsHtml = '';
    if (showGoals) {
        const goalsTop = n.goalsTop || (n.headH + PAD_GOALS);
        n.goals.forEach((g, i) => {
            const gy = goalsTop + i * GOAL_ROW_H;
            const checkCls = g.done ? 'done' : '';
            goalsHtml += `
                <g class="tn-goal-row ${checkCls}" data-drag-goal="${g.rawId}" data-drag-area="${n.rawId}">
                    <rect x="0" y="${gy}" width="${NODE_W}" height="${GOAL_ROW_H}" fill="transparent" pointer-events="all" />
                    <g data-toggle-goal="${g.rawId}">
                        <circle class="tn-goal-check ${checkCls}" cx="16" cy="${gy + GOAL_ROW_H / 2}" r="6" />
                        <path class="tn-goal-check-mark" d="M 13 ${gy + GOAL_ROW_H / 2} L 15 ${gy + GOAL_ROW_H / 2 + 2} L 19 ${gy + GOAL_ROW_H / 2 - 2}" />
                    </g>
                    <text class="tn-goal-name" data-edit-goal="${g.rawId}" data-goal-area="${n.rawId}" x="28" y="${gy + GOAL_ROW_H / 2 + 4}" pointer-events="all">${escapeSvg(truncateName(g.name, 22))}</text>
                </g>
            `;
        });
    }

    return `<g class="${cls.join(' ')}" data-node-id="${n.id}" transform="translate(${x} ${y})">
        <rect class="tn-rect" width="${NODE_W}" height="${totalH}" rx="12" />
        ${inner}
        ${goalsHtml}
    </g>`;
}

function getNodeSubtitle(n) {
    if (n.type === 'root') return '';
    if (n.type === 'area') {
        const subAreas = (n.children || []).length;
        const ownGoals = (n.goals || []).length;
        const parts = [];
        if (ownGoals) parts.push(`${ownGoals} ${plural(ownGoals, 'цель', 'цели', 'целей')}`);
        if (subAreas) parts.push(`${subAreas} ${plural(subAreas, 'ветка', 'ветки', 'веток')}`);
        if (!parts.length) return 'пусто';
        return parts.join(' · ');
    }
    return '';
}

function countGoals(node) {
    let c = 0;
    if (node.goals) c += node.goals.length;
    (node.children || []).forEach(ch => { c += countGoals(ch); });
    return c;
}

function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

function escapeSvg(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateName(s, maxChars) {
    s = String(s || '');
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars - 1) + '…';
}

// ==========================================
// CAMERA
// ==========================================
function applyCamera() {
    const g = document.getElementById('treeCamera');
    if (!g) return;
    g.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`);
}

function animateCameraTo(target, duration = 400) {
    const start = { x: camera.x, y: camera.y, scale: camera.scale };
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
        camera.x = target.x; camera.y = target.y; camera.scale = target.scale;
        applyCamera();
        return;
    }
    const t0 = performance.now();
    function step(t) {
        const p = Math.min(1, (t - t0) / duration);
        const e = easeInOutCubic(p);
        camera.x = start.x + (target.x - start.x) * e;
        camera.y = start.y + (target.y - start.y) * e;
        camera.scale = start.scale + (target.scale - start.scale) * e;
        applyCamera();
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cameraTargetForNode(node, targetScale = 1.2) {
    const svg = document.getElementById('treeSvg');
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    return {
        x: w / 2 - node.x * targetScale,
        y: h / 2 - node.y * targetScale,
        scale: targetScale,
    };
}

function focusNode(nodeId, animate = true) {
    const n = treeNodesById[nodeId];
    if (!n) return;
    const targetScale = Math.max(camera.scale, 1.1);
    const target = cameraTargetForNode(n, targetScale);
    if (animate) animateCameraTo(target, 400);
    else { camera.x = target.x; camera.y = target.y; camera.scale = target.scale; applyCamera(); }
}

function fitTree() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    const w = svg.clientWidth;
    const h = svg.clientHeight;

    const bbox = computeTreeBBox();
    const PAD = 5;
    const sx = (w - PAD * 2) / Math.max(1, bbox.w);
    const sy = (h - PAD * 2) / Math.max(1, bbox.h);
    const s = Math.min(MAX_SCALE, Math.min(sx, sy));
    const target = {
        x: w / 2 - (bbox.x + bbox.w / 2) * s,
        y: h / 2 - (bbox.y + bbox.h / 2) * s,
        scale: s,
    };
    animateCameraTo(target, 500);
}

function computeTreeBBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function visit(n) {
        const h = n.h || NODE_H;
        const x1 = n.x - NODE_W / 2, y1 = n.y - h / 2;
        const x2 = n.x + NODE_W / 2, y2 = n.y + h / 2;
        minX = Math.min(minX, x1); minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2); maxY = Math.max(maxY, y2);
        const collapsed = n.type === 'area' && _collapsedAreas.has(n.rawId);
        if (!collapsed) n.children.forEach(visit);
    }
    visit(treeRoot);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function updateMinScale() {
    const svg = document.getElementById('treeSvg');
    if (!svg || !treeRoot) return;
    const bbox = computeTreeBBox();
    const PAD = 5;
    const sx = (svg.clientWidth - PAD * 2) / Math.max(1, bbox.w);
    const sy = (svg.clientHeight - PAD * 2) / Math.max(1, bbox.h);
    minAllowedScale = Math.min(MAX_SCALE, sx, sy);
}

function zoomAt(px, py, factor) {
    const newScale = Math.max(minAllowedScale, Math.min(MAX_SCALE, camera.scale * factor));
    const realFactor = newScale / camera.scale;
    camera.x = px - (px - camera.x) * realFactor;
    camera.y = py - (py - camera.y) * realFactor;
    camera.scale = newScale;
    applyCamera();
}

function treeZoomIn() { zoomCenter(1.3); }
function treeZoomOut() { zoomCenter(0.77); }
function zoomCenter(f) {
    const svg = document.getElementById('treeSvg');
    zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, f);
}

function treeFit() { fitTree(); }

function treeBack() {
    if (cameraStack.length > 1) {
        cameraStack.pop();
        const prev = cameraStack[cameraStack.length - 1];
        selectedNodeId = prev.nodeId;
        renderTree();
        focusNode(prev.nodeId);
    } else {
        fitTree();
    }
}

// ==========================================
// POINTER EVENTS
// ==========================================
const _pointers = new Map();
let _panStart = null;
let _pinchStart = null;

function initTreePointer() {
    const svg = document.getElementById('treeSvg');
    if (!svg || svg._inited) return;
    svg._inited = true;

    svg.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        svg.setPointerCapture(e.pointerId);
        _pointers.set(e.pointerId, {
            x: e.clientX, y: e.clientY,
            startX: e.clientX, startY: e.clientY,
            startTime: Date.now(),
        });

        if (_pointers.size === 1) {
            _panStart = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y };
            _pinchStart = null;
        } else if (_pointers.size === 2) {
            const pts = [..._pointers.values()];
            _pinchStart = {
                dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
                camScale: camera.scale,
                camX: camera.x, camY: camera.y,
            };
            _panStart = null;
        }
    }, { passive: false });

    svg.addEventListener('pointermove', e => {
        const p = _pointers.get(e.pointerId);
        if (!p) return;
        p.x = e.clientX;
        p.y = e.clientY;
        const rect = svg.getBoundingClientRect();

        if (_pointers.size === 1 && _panStart) {
            camera.x = _panStart.camX + (e.clientX - _panStart.x);
            camera.y = _panStart.camY + (e.clientY - _panStart.y);
            applyCamera();
        } else if (_pointers.size === 2 && _pinchStart) {
            const pts = [..._pointers.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const factor = dist / _pinchStart.dist;
            const newScale = Math.max(minAllowedScale, Math.min(MAX_SCALE, _pinchStart.camScale * factor));
            const realFactor = newScale / _pinchStart.camScale;
            const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
            const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
            camera.scale = newScale;
            camera.x = midX - (midX - _pinchStart.camX) * realFactor;
            camera.y = midY - (midY - _pinchStart.camY) * realFactor;
            applyCamera();
        }
    }, { passive: false });

    svg.addEventListener('pointerup', e => {
        const p = _pointers.get(e.pointerId);
        _pointers.delete(e.pointerId);

        if (_pointers.size === 0) {
            if (p) {
                const dt = Date.now() - p.startTime;
                const dx = Math.abs(p.x - p.startX);
                const dy = Math.abs(p.y - p.startY);
                if (dt < 350 && dx < 8 && dy < 8) handleTap(e.clientX, e.clientY);
            }
            _panStart = null;
            _pinchStart = null;
        } else if (_pointers.size === 1) {
            const only = [..._pointers.values()][0];
            _panStart = { x: only.x, y: only.y, camX: camera.x, camY: camera.y };
            _pinchStart = null;
        }
    });

    svg.addEventListener('pointercancel', e => {
        _pointers.delete(e.pointerId);
        if (_pointers.size === 0) { _panStart = null; _pinchStart = null; }
    });
}

function handleTap(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);

    // 1. Сворачивание списка целей
    const toggleEl = findElWithDataset(el, 'toggleGoals');
    if (toggleEl) {
        toggleGoalsCollapsed(parseInt(toggleEl.dataset.toggleGoals));
        return;
    }

    // 2. Чекбокс цели
    const checkEl = findElWithDataset(el, 'toggleGoal');
    if (checkEl) {
        const goalId = parseInt(checkEl.dataset.toggleGoal);
        const g = goalsFlat.find(x => x.id === goalId);
        if (g) toggleGoalDone(goalId, g.status === 'done');
        return;
    }

    // 3. Название или строка цели → редактирование
    const goalEl = findElWithDataset(el, 'editGoal') || findElWithDataset(el, 'dragGoal');
    if (goalEl) {
        const goalId = parseInt(goalEl.dataset.editGoal || goalEl.dataset.dragGoal);
        const areaId = parseInt(goalEl.dataset.goalArea || goalEl.dataset.dragArea);
        openGoalModal(goalId, areaId);
        return;
    }

    // 4. Нода области
    const nodeEl = findNodeEl(el);
    if (nodeEl) {
        const id = nodeEl.dataset.nodeId;
        const n = treeNodesById[id];
        if (!n) return;
        selectedNodeId = id;
        lastFocusedNodeId = id;
        cameraStack.push({ nodeId: id, x: camera.x, y: camera.y, scale: camera.scale });
        if (cameraStack.length > 20) cameraStack.shift();
        renderTree();
        focusNode(id);
    } else {
        selectedNodeId = null;
        updateActionsBar();
        renderTree();
    }
}

function findElWithDataset(el, key) {
    const svg = document.getElementById('treeSvg');
    while (el && el !== svg) {
        if (el.dataset && el.dataset[key] !== undefined) return el;
        el = el.parentNode;
    }
    return null;
}

function findElWithDataset(el, key) {
    const svg = document.getElementById('treeSvg');
    while (el && el !== svg) {
        if (el.dataset && el.dataset[key] !== undefined) return el;
        el = el.parentNode;
    }
    return null;
}

function findGoalEl(el) {
    const svg = document.getElementById('treeSvg');
    while (el && el !== svg) {
        if (el.dataset && el.dataset.goalId) return el;
        el = el.parentNode;
    }
    return null;
}

function findNodeEl(el) {
    const svg = document.getElementById('treeSvg');
    while (el && el !== svg) {
        if (el.dataset && el.dataset.nodeId) return el;
        el = el.parentNode;
    }
    return null;
}

// ==========================================
// ACTION BAR / BREADCRUMB
// ==========================================
function updateActionsBar() {
    const bar = document.getElementById('treeActions');
    if (!bar) return;

    const btnBranch = document.getElementById('treeActionAddBranch');
    const btnGoal = document.getElementById('treeActionAddGoal');
    const btnEdit = document.getElementById('treeActionEdit');
    const btnDel = document.getElementById('treeActionDelete');

    if (!selectedNodeId) {
        bar.classList.add('visible');
        btnBranch.textContent = '+ Дерево';
        btnBranch.style.display = 'block';
        btnGoal.style.display = 'none';
        btnEdit.style.display = 'none';
        btnDel.style.display = 'none';
        return;
    }
    const n = treeNodesById[selectedNodeId];
    if (!n) { bar.classList.remove('visible'); return; }

    bar.classList.add('visible');
    btnBranch.textContent = '+ Ветка';
    btnBranch.style.display = (n.type === 'root' || n.type === 'area') ? 'block' : 'none';
    btnGoal.style.display = (n.type === 'area') ? 'block' : 'none';
    btnEdit.style.display = (n.type !== 'root') ? 'block' : 'none';
    btnDel.style.display = (n.type !== 'root') ? 'block' : 'none';
}

function updateBreadcrumb() {
    const el = document.getElementById('treeBreadcrumb');
    if (!el) return;
    if (!selectedNodeId) {
        el.innerHTML = '';
        return;
    }
    const path = getPath(selectedNodeId);
    el.innerHTML = path.map((n, i) => {
        const isLast = i === path.length - 1;
        return `<button class="tree-crumb ${isLast ? 'last' : ''}" onclick="focusNode('${n.id}', true); selectedNodeId = '${n.id}'; renderTree();">${escapeSvg(n.name)}</button>` +
            (isLast ? '' : `<span class="tree-crumb-sep">›</span>`);
    }).join('');
}

function getPath(nodeId) {
    const path = [];
    let n = treeNodesById[nodeId];
    while (n) {
        path.unshift(n);
        if (n.type === 'root') break;
        if (n.type === 'area' && n.parentAreaId) n = treeNodesById['a:' + n.parentAreaId];
        else if (n.type === 'goal' && n.areaId) n = treeNodesById['a:' + n.areaId];
        else n = treeNodesById['root'];
    }
    return path;
}

// ==========================================
// ДЕЙСТВИЯ
// ==========================================
async function toggleGoalDone(goalId, isDone) {
    try {
        await api(`/api/disc/goals/${goalId}`, 'PATCH', { status: isDone ? 'plan' : 'done' });
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function treeAddBranch() {
    const n = selectedNodeId ? treeNodesById[selectedNodeId] : null;
    const parentId = (n && n.type === 'area') ? n.rawId : null;
    openAreaModal(null, parentId);
}

function treeAddGoal() {
    if (!selectedNodeId) return;
    const n = treeNodesById[selectedNodeId];
    if (!n || n.type !== 'area') return;
    openGoalModal(null, n.rawId);
}

function treeEdit() {
    if (!selectedNodeId) return;
    const n = treeNodesById[selectedNodeId];
    if (!n) return;
    if (n.type === 'area') openAreaModal(n.rawId);
    if (n.type === 'goal') openGoalModal(n.rawId, n.areaId);
}

function treeDelete() {
    if (!selectedNodeId) return;
    const n = treeNodesById[selectedNodeId];
    if (!n) return;
    if (n.type === 'area') {
        const childrenCount = countGoals(n);
        if (childrenCount > 0 && !confirm(`Удалить «${n.name}»? Внутри ${childrenCount} ${plural(childrenCount, 'элемент', 'элемента', 'элементов')}.`)) return;
        if (childrenCount === 0 && !confirm(`Удалить «${n.name}»?`)) return;
        deleteArea(n.rawId);
    } else if (n.type === 'goal') {
        if (!confirm(`Удалить цель «${n.name}»?`)) return;
        deleteGoal(n.rawId);
    }
}

async function deleteArea(id) {
    try {
        await api(`/api/disc/areas/${id}`, 'DELETE');
        selectedNodeId = null;
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteGoal(id) {
    try {
        await api(`/api/disc/goals/${id}`, 'DELETE');
        selectedNodeId = null;
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// МОДАЛКИ: ОБЛАСТЬ (ветка)
// ==========================================
let areaCtx = { id: null, parentId: null };

function openAreaModal(id = null, parentId = null) {
    areaCtx = { id, parentId };
    const titleEl = document.getElementById('areaModalTitle');
    const nameEl = document.getElementById('areaName');
    const delBtn = document.getElementById('areaDeleteBtn');
    const parentSel = document.getElementById('areaParentSelect');

    const excludeIds = new Set();
    if (id) {
        excludeIds.add(id);
        let added = true;
        while (added) {
            added = false;
            areasFlat.forEach(a => {
                if (a.parent_id && excludeIds.has(a.parent_id) && !excludeIds.has(a.id)) {
                    excludeIds.add(a.id); added = true;
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
            titleEl.textContent = 'Редактировать ветку';
            nameEl.value = a.name;
            parentSel.value = a.parent_id || '';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = parentId ? 'Новая подветка' : 'Новая ветка';
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
    if (!confirm('Удалить ветку со всеми подобластями и целями?')) return;
    await api(`/api/disc/areas/${areaCtx.id}`, 'DELETE');
    closeAreaModal();
    selectedNodeId = null;
    await loadAreas();
}

// ==========================================
// МОДАЛКИ: ЦЕЛЬ (лист)
// ==========================================
let goalCtx = { id: null, areaId: null };

function openGoalModal(id = null, areaId = null) {
    goalCtx = { id, areaId };
    const titleEl = document.getElementById('goalModalTitle');
    const nameEl = document.getElementById('goalName');
    const delBtn = document.getElementById('goalDeleteBtn');
    const areaSel = document.getElementById('goalAreaSelect');

    areaSel.innerHTML = `<option value="">— Без ветки —</option>` +
        areasFlat.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');

    // Кнопки ↑↓ — только при редактировании
    const moveUpBtn = document.getElementById('goalMoveUpBtn');
    const moveDownBtn = document.getElementById('goalMoveDownBtn');

    if (id) {
        const g = goalsFlat.find(x => x.id === id);
        if (g) {
            titleEl.textContent = 'Редактировать цель';
            nameEl.value = g.name;
            areaSel.value = g.area_id || '';
        }
        delBtn.style.display = 'block';
        if (moveUpBtn) moveUpBtn.style.display = 'block';
        if (moveDownBtn) moveDownBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая цель';
        nameEl.value = '';
        areaSel.value = areaId || '';
        delBtn.style.display = 'none';
        if (moveUpBtn) moveUpBtn.style.display = 'none';
        if (moveDownBtn) moveDownBtn.style.display = 'none';
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
    selectedNodeId = null;
    await loadAreas();
}

// ==========================================
// INIT (вызывается после загрузки DOM)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initTreePointer, 100);
});

// Переинициализация при переключении на вкладку Goals
const _origSwitchSubTab = window.switchSubTab;
window.switchSubTab = function(parent, tab, btn) {
    if (typeof _origSwitchSubTab === 'function') _origSwitchSubTab(parent, tab, btn);
    if (parent === 'discipline' && tab === 'goals') {
        setTimeout(() => {
            initTreePointer();
            renderTree();
            // Автовыбор корня + автоподгонка
            if (!selectedNodeId) {
                selectedNodeId = 'root';
                updateBreadcrumb();
                updateActionsBar();
            }
            fitTree();
        }, 80);
    }
};

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
                <div class="habit-rep-name" onclick="closeHabitReport(); openHabitModal(${h.id})">${escapeHtml(h.name)}</div>
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

// ==========================================
// ПЕРЕМЕЩЕНИЕ ЦЕЛИ ВНУТРИ ОБЛАСТИ
// ==========================================
async function moveGoal(direction) {
    if (!goalCtx.id) return;
    const g = goalsFlat.find(x => x.id === goalCtx.id);
    if (!g) return;
    const areaId = g.area_id;
    if (!areaId) return alert('Цель без ветки — сортировка недоступна');

    // Цели в этой области по порядку
    const siblings = goalsFlat
        .filter(x => x.area_id === areaId)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const idx = siblings.findIndex(x => x.id === goalCtx.id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= siblings.length) return;

    // Меняем местами
    [siblings[idx], siblings[newIdx]] = [siblings[newIdx], siblings[idx]];

    try {
        await api('/api/reorder', 'POST', {
            table: 'disc_goals',
            ids: siblings.map(s => s.id),
        });
        await loadAreas();
    } catch (e) { alert('Ошибка: ' + e.message); }

    
}

function wrapText(text, maxChars, maxLines = 3) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let cur = '';
    for (const w of words) {
        const cand = cur ? cur + ' ' + w : w;
        if (cand.length <= maxChars) { cur = cand; continue; }
        if (cur) lines.push(cur);
        cur = w;
        while (cur.length > maxChars) {
            lines.push(cur.slice(0, maxChars));
            cur = cur.slice(maxChars);
        }
    }
    if (cur) lines.push(cur);

    if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…';
    }
    return lines;
}

// ==========================================
// ЭКСПОРТ ДЕРЕВА / ВЕТКИ В PNG
// ==========================================
function collectSubtreeIds(root) {
    const ids = new Set();
    (function walk(node) {
        ids.add(node.id);
        const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
        if (!isCollapsed) node.children.forEach(walk);
    })(root);
    return ids;
}

function renderSubtreeEdges(node, idSet) {
    if (node.type === 'root') {
        let html = '';
        node.children.forEach(c => { if (idSet.has(c.id)) html += renderSubtreeEdges(c, idSet); });
        return html;
    }
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (isCollapsed || !node.children.length) return '';
    let html = '';
    node.children.forEach(c => {
        if (!idSet.has(c.id)) return;
        const x1 = node.x;
        const y1 = node.y + (node.h || NODE_H) / 2;
        const x2 = c.x;
        const y2 = c.y - (c.h || NODE_H) / 2;
        const midY = (y1 + y2) / 2;
        html += `<path class="tree-edge" d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" />`;
        html += renderSubtreeEdges(c, idSet);
    });
    return html;
}

function renderSubtreeNodes(node, idSet) {
    let html = '';
    if (node.type !== 'root' && idSet.has(node.id)) {
        html += renderSingleNode(node);
    }
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (!isCollapsed) {
        node.children.forEach(c => { if (idSet.has(c.id)) html += renderSubtreeNodes(c, idSet); });
    }
    return html;
}

async function exportTreeImage() {
    if (!treeRoot) return;

    layoutTree();
    updateMinScale();

    let exportRoot = treeRoot;
    let exportLabel = 'all';
    if (selectedNodeId && treeNodesById[selectedNodeId]) {
        exportRoot = treeNodesById[selectedNodeId];
        exportLabel = exportRoot.name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').slice(0, 30) || 'branch';
    }

    const subtreeIds = collectSubtreeIds(exportRoot);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    Object.values(treeNodesById).forEach(n => {
        if (!subtreeIds.has(n.id)) return;
        const h = n.h || NODE_H;
        minX = Math.min(minX, n.x - NODE_W / 2);
        minY = Math.min(minY, n.y - h / 2);
        maxX = Math.max(maxX, n.x + NODE_W / 2);
        maxY = Math.max(maxY, n.y + h / 2);
    });
    if (!isFinite(minX)) return alert('Нечего экспортировать');

    const PAD = 40;
    const W = Math.ceil(maxX - minX + PAD * 2);
    const H = Math.ceil(maxY - minY + PAD * 2);
    const vbX = minX - PAD;
    const vbY = minY - PAD;

    const svgNS = 'http://www.w3.org/2000/svg';
    const outSvg = document.createElementNS(svgNS, 'svg');
    outSvg.setAttribute('xmlns', svgNS);
    outSvg.setAttribute('width', W);
    outSvg.setAttribute('height', H);
    outSvg.setAttribute('viewBox', `${vbX} ${vbY} ${W} ${H}`);

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const cs = getComputedStyle(document.documentElement);
    const bg = theme === 'light' ? '#ebebef' : '#0a0809';
    const success = cs.getPropertyValue('--success').trim() || '#32d74b';
    const textColor = theme === 'light' ? '#1c1c1e' : '#f5f5f7';
    const textTertiary = theme === 'light' ? '#8e8e93' : '#5a5a5f';
    const cardBg = theme === 'light' ? 'rgba(245,245,248,0.95)' : 'rgba(38,38,44,0.95)';
    const cardBorder = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const edgeColor = theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';

    const bgRect = document.createElementNS(svgNS, 'rect');
    bgRect.setAttribute('x', vbX);
    bgRect.setAttribute('y', vbY);
    bgRect.setAttribute('width', W);
    bgRect.setAttribute('height', H);
    bgRect.setAttribute('fill', bg);
    outSvg.appendChild(bgRect);

    const style = document.createElementNS(svgNS, 'style');
    style.textContent = `
        .tree-edge { stroke: ${edgeColor}; stroke-width: 1.5; fill: none; }
        .tn-rect { fill: ${cardBg}; stroke: ${cardBorder}; stroke-width: 1; }
        .tn-name { fill: ${textColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; }
        .tn-sub { fill: ${textTertiary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 500; }
        .tn-goal-name { fill: ${textColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; }
        .tn-goal-check { fill: transparent; stroke: ${textTertiary}; stroke-width: 1.4; }
        .tn-goal-row.done .tn-goal-check { fill: ${success}; stroke: ${success}; }
        .tn-goal-check-mark { fill: none; stroke: white; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; display: none; }
        .tn-goal-row.done .tn-goal-check-mark { display: block; }
        .tn-goal-row.done .tn-goal-name { fill: ${textTertiary}; text-decoration: line-through; }
        .tn-sub-clickable-rect { display: none; }
    `;
    outSvg.appendChild(style);

    const savedSelected = selectedNodeId;
    selectedNodeId = null;

    let content = renderSubtreeEdges(exportRoot, subtreeIds) + renderSubtreeNodes(exportRoot, subtreeIds);
    // Убираем прозрачные rect для кликов
    content = content.replace(/<rect[^>]*pointer-events="all"[^>]*\/>/g, '');

    selectedNodeId = savedSelected;

    const g = document.createElementNS(svgNS, 'g');
    g.innerHTML = content;
    outSvg.appendChild(g);

    const svgString = new XMLSerializer().serializeToString(outSvg);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
            resolve();
        };
        img.onerror = reject;
        img.src = url;
    });

    canvas.toBlob(async blob => {
        const fileName = `tree-${exportLabel}-${localDate(new Date())}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Дерево целей' });
                return;
            } catch (e) {}
        }

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
}