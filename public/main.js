// ==========================================
// ===== MAIN (дашборд) =====
// ==========================================
let mainView = 'list'; 
let mainSelectedDate = localDate(new Date());
let allMainTodos = [];
let allMainReminders = [];

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

async function loadMain() {
    try {
        const data = await api(`/api/main?date=${mainSelectedDate}`);
        allMainTodos = data.todos || [];
        allMainReminders = data.reminders || [];
        
        renderMainGreeting();
        
        if (mainView === 'list') {
            renderMainReminders(data.reminders || []);
            renderMainTodos(data.todos || []);
            renderMainHabits(data.habits || []);
            renderMainMoney(data.money);
            renderNYWidget();
        } else {
            renderCalendarView(data);
        }
    } catch (e) { console.error(e); }
}

function switchMainView(view) {
    mainView = view;
    document.getElementById('btnViewList').classList.toggle('active', view === 'list');
    document.getElementById('btnViewCal').classList.toggle('active', view === 'calendar');
    document.getElementById('main-list-view').style.display = view === 'list' ? 'block' : 'none';
    document.getElementById('main-calendar-view').style.display = view === 'calendar' ? 'block' : 'none';
    loadMain();
}

function renderMainGreeting() {
    const h = new Date().getHours();
    const g = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    document.getElementById('mainGreeting').textContent = `${g}, ${tgUser.name}`;
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
    const d = new Date(mainSelectedDate + 'T12:00:00');
    document.getElementById('mainDate').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// ==========================================
// ==== ВИД 1: СПИСОК (С УДЕРЖАНИЕМ) ====
// ==========================================

function bindItemLongPress(el, onTap, onLongPress) {
    let timer;
    let isLong = false;
    
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        isLong = false;
        timer = setTimeout(() => {
            isLong = true;
            if (navigator.vibrate) navigator.vibrate(50);
            onLongPress();
        }, 500);
    });

    el.addEventListener('pointerup', () => {
        clearTimeout(timer);
    });

    el.addEventListener('pointercancel', () => {
        clearTimeout(timer);
    });

    el.addEventListener('pointermove', () => {
        clearTimeout(timer);
    });

    el.addEventListener('click', (e) => {
        if (!isLong) {
            e.preventDefault();
            onTap();
        }
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
}

function renderMainReminders(reminders) {
    const c = document.getElementById('mainRemindersWidget');
    let html = `<div class="widget"><div class="widget-title"><span>Напоминания</span></div>`;
    if (!reminders.length) {
        html += `<div class="widget-empty">Нет напоминаний</div>`;
    } else {
        reminders.forEach(t => {
            const dateStr = t.date ? formatDate(t.date) : '';
            html += `<div class="main-todo-item" data-id="${t.id}">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
                ${dateStr ? `<span class="main-todo-date" style="color: var(--accent); font-weight: 700;">${dateStr}</span>` : ''}
            </div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
    
    c.querySelectorAll('.main-todo-item').forEach((el, i) => {
        const t = reminders[i];
        bindItemLongPress(el, 
            () => openAddItemModal(t.id, 'reminder'), // Тап = редактирование
            () => { // Зажатие = алерт
                if (confirm(`Выполнить напоминание «${t.name}»?`)) {
                    completeFromMain(t.id);
                }
            }
        );
    });
}

function renderMainTodos(todos) {
    const c = document.getElementById('mainTodosWidget');
    let html = `<div class="widget"><div class="widget-title"><span>Дела</span></div>`;
    if (!todos.length) {
        html += `<div class="widget-empty">Пусто</div>`;
    } else {
        todos.forEach(t => {
            const time = t.time_start ? `${t.time_start}${t.time_end ? '—' + t.time_end : ''}` : '';
            html += `<div class="main-todo-item" data-id="${t.id}">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
                ${time ? `<span class="main-todo-time">${time}</span>` : ''}
            </div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
    
    c.querySelectorAll('.main-todo-item').forEach((el, i) => {
        const t = todos[i];
        bindItemLongPress(el, 
            () => openAddItemModal(t.id, 'todo'), // Тап = редактирование
            () => { // Зажатие = алерт
                if (confirm(`Выполнить дело «${t.name}»?`)) {
                    completeFromMain(t.id);
                }
            }
        );
    });
}

function renderMainHabits(habits) {
    const c = document.getElementById('mainHabitsWidget');
    let html = `<div class="widget">
        <div class="widget-title" onclick="openHabitDashboard()" style="cursor:pointer;">
            <span>Привычки сегодня</span>
            ${habits.length > 0 ? `<span class="widget-title-count">${habits.length}</span>` : ''}
        </div>`;
    if (!habits.length) {
        html += `<div class="widget-empty">Все привычки выполнены ✓</div>`;
    } else {
        habits.forEach(h => {
            html += `<div class="main-habit-item" data-id="${h.id}">${escapeHtml(h.name)}</div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
    
    c.querySelectorAll('.main-habit-item').forEach((el, i) => {
        const h = habits[i];
        bindItemLongPress(el, 
            () => openHabitDashboard(), // Тап = открываем дашборд привычек
            () => { // Зажатие = алерт на выполнение
                if (confirm(`Отметить привычку «${h.name}» выполненной?`)) {
                    completeHabitFromMain(h.id);
                }
            }
        );
    });
}

async function completeFromMain(id) {
    try {
        await api(`/api/disc/todos/${id}`, 'PATCH', { done: true });
        await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function completeHabitFromMain(id) {
    try {
        await api(`/api/disc/habits/${id}/toggle`, 'POST', { date: mainSelectedDate });
        await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function renderMainMoney(money) {
    const c = document.getElementById('mainMoneyWidget');
    c.innerHTML = `<div class="main-widget-row">
        <div class="main-widget-square money-blur" id="mainMoneyBox" onclick="toggleMoneyBlur(this)">
            <div class="main-widget-label">Копилка</div>
            <div class="main-widget-value">${fmt(money.balance)}</div>
            <div class="main-widget-label" style="margin-top:14px;">Долг</div>
            <div class="main-widget-value ${money.debt > 0 ? 'debt' : ''}">${fmt(money.debt)}</div>
        </div>
    </div>`;
}
function toggleMoneyBlur(el) { el.classList.toggle('money-blur'); }

// ==========================================
// ==== ВИД 2: КАЛЕНДАРЬ / ТАЙМЛАЙН ====
// ==========================================

function renderCalendarView(data) {
    renderCalendarStrip();
    const cont = document.getElementById('timelineContainer');
    
    const todos = (data.todos || []).filter(t => t.date === mainSelectedDate);
    const habits = data.habits || [];
    const reminders = data.reminders || [];
    
    const timedItems = [];
    todos.forEach(t => { if(t.time_start) timedItems.push({...t, _type:'todo'}); });
    reminders.forEach(t => { if(t.time_start) timedItems.push({...t, _type:'reminder'}); });
    
    let html = '';
    
    const allDayTodos = todos.filter(t => !t.time_start);
    if (allDayTodos.length > 0 || habits.length > 0) {
        let allDayHtml = `<div class="widget" style="margin-bottom:20px;">
            <div class="widget-title"><span>На весь день</span></div>`;
        
        allDayTodos.forEach(t => {
            allDayHtml += `<div class="main-todo-item" style="padding:4px 0;" onclick="openAddItemModal(${t.id}, 'todo')">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
            </div>`;
        });
        
        if (habits.length) {
            allDayHtml += `<div class="main-todo-item" style="padding:4px 0; color:var(--success);" onclick="openHabitDashboard()">
                <span class="main-todo-name">${habits.length} привычек на сегодня</span>
            </div>`;
        }
        allDayHtml += `</div>`;
        html = allDayHtml;
    }

    for (let hour = 0; hour < 24; hour++) {
        const timeStr = `${String(hour).padStart(2,'0')}:00`;
        html += `<div class="timeline-hour" data-hour="${hour}">
            <div class="timeline-hour-label">${timeStr}</div>
        `;
        
        const tasksThisHour = timedItems.filter(t => t.time_start.startsWith(String(hour).padStart(2,'0')));
        tasksThisHour.forEach(t => {
            const mins = parseInt(t.time_start.split(':')[1]) || 0;
            const topOffset = (mins / 60) * 60;
            const typeClass = t._type === 'reminder' ? 'reminder' : '';
            html += `<div class="timeline-task ${typeClass}" style="top: ${topOffset}px;" onclick="openAddItemModal(${t.id}, '${t._type}')">
                <div class="timeline-task-time">${t.time_start}</div>
                <div>${escapeHtml(t.name)}</div>
            </div>`;
        });
        html += `</div>`;
    }

    cont.innerHTML = html;
    scrollToTimelineCurrentTime();
}

function renderCalendarStrip() {
    const strip = document.getElementById('calendarWeekStrip');
    const today = new Date();
    const startOfWeek = getMonday(today);
    let html = '';
    const daysNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const ds = localDate(d);
        const isActive = ds === mainSelectedDate;
        html += `<div class="cal-day ${isActive ? 'active' : ''}" onclick="selectCalendarDate('${ds}')">
            <span class="cal-day-name">${daysNames[d.getDay()]}</span>
            <span class="cal-day-num">${d.getDate()}</span>
            <div class="cal-day-dot" style="opacity:0;"></div>
        </div>`;
    }
    strip.innerHTML = html;
}

function selectCalendarDate(ds) { mainSelectedDate = ds; loadMain(); }

function scrollToTimelineCurrentTime() {
    setTimeout(() => {
        const wrap = document.getElementById('timelineWrapper'); if (!wrap) return;
        const now = new Date();
        if (mainSelectedDate === localDate(now)) {
            const h = now.getHours();
            const hourEl = wrap.querySelector(`.timeline-hour[data-hour="${h}"]`);
            if (hourEl) wrap.scrollTop = hourEl.offsetTop - 100;
        } else { wrap.scrollTop = 8 * 60; }
    }, 100);
}

// ==========================================
// ==== HABIT DASHBOARD (МОДАЛКА) ====
// ==========================================
let hdWeekStart = getMonday(new Date());

function openHabitDashboard() {
    openModal('habitDashboardModal');
    renderHabitDashboard();
}

async function renderHabitDashboard() {
    const startStr = localDate(hdWeekStart);
    const { habits: weekData } = await api(`/api/disc/habits/week?start=${startStr}`);
    
    const end = new Date(hdWeekStart); end.setDate(end.getDate() + 6);
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    document.getElementById('hdWeekRange').textContent = `${hdWeekStart.getDate()} ${months[hdWeekStart.getMonth()]} — ${end.getDate()} ${months[end.getMonth()]}`;
    
    const today = localDate(new Date());
    const dn = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    let weekHtml = `<div class="week-grid-table"><div class="week-header"><div class="week-header-cell">Привычка</div>`;
    for (let i = 0; i < 7; i++) {
        const d = new Date(hdWeekStart); d.setDate(d.getDate() + i);
        weekHtml += `<div class="week-header-cell ${localDate(d) === today ? 'today' : ''}">${dn[i]}<span class="week-header-date">${d.getDate()}</span></div>`;
    }
    weekHtml += `</div>`;
    weekData.forEach(h => {
        weekHtml += `<div class="week-row"><div class="week-habit-name">${escapeHtml(h.name)}</div>`;
        h.week.forEach(day => {
            if (!day.scheduled) { weekHtml += `<div class="week-cell not-scheduled"></div>`; return; }
            const isFuture = day.date > today;
            const cls = ['week-cell', 'scheduled', day.done ? 'done' : '', day.date === today ? 'today' : ''].filter(Boolean).join(' ');
            const handler = !isFuture ? `onclick="toggleWeekCell(${h.id}, '${day.date}'); setTimeout(renderHabitDashboard, 300);"` : '';
            weekHtml += `<div class="${cls}" ${handler}>${day.done ? '✓' : ''}</div>`;
        });
        weekHtml += `</div>`;
    });
    weekHtml += `</div>`;
    document.getElementById('hdWeekGrid').innerHTML = weekHtml;
    
    const { habits: allHabits } = await api('/api/disc/habits?days=365');
    let ghHtml = '';
    const todayDate = new Date(); todayDate.setHours(12,0,0,0);
    const startGh = new Date(todayDate); startGh.setMonth(startGh.getMonth() - 6);
    const ghMonday = getMonday(startGh);
    const daysArr = []; const cursor = new Date(ghMonday);
    while (cursor <= todayDate) { daysArr.push(localDate(cursor)); cursor.setDate(cursor.getDate()+1); }
    const weeksArr = []; for (let i = 0; i < daysArr.length; i += 7) weeksArr.push(daysArr.slice(i, i + 7));
    
    allHabits.forEach(h => {
        const done = new Set((h.logs || []).filter(l => l.done).map(l => l.date));
        let grid = '';
        weeksArr.forEach(week => {
            week.forEach(day => {
                const isFuture = day > today, isDone = done.has(day);
                let cls = 'habit-rep-cell';
                if (isFuture) cls += ' future'; else if (isDone) cls += ' done'; else cls += ' empty';
                grid += `<div class="${cls}"></div>`;
            });
        });
        ghHtml += `<div class="habit-rep-block">
            <div class="habit-rep-header"><div class="habit-rep-name">${escapeHtml(h.name)}</div><div class="habit-rep-count">${done.size}</div></div>
            <div class="habit-rep-scroll"><div class="habit-rep-grid">${grid}</div></div>
        </div>`;
    });
    document.getElementById('hdGithubGrid').innerHTML = ghHtml;
    setTimeout(() => { document.querySelectorAll('#hdGithubGrid .habit-rep-scroll').forEach(el => el.scrollLeft = el.scrollWidth); }, 50);
}

function hdWeekPrev() { hdWeekStart.setDate(hdWeekStart.getDate() - 7); renderHabitDashboard(); }
function hdWeekNext() { hdWeekStart.setDate(hdWeekStart.getDate() + 7); renderHabitDashboard(); }

// ==========================================
// ===== УНИВЕРСАЛЬНАЯ МОДАЛКА ДОБАВЛЕНИЯ =====
// ==========================================
let addItemCtx = { id: null, type: 'todo', freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };

function openAddMenu() { 
    // Всегда открываем модалку добавления, id = null
    openAddItemModal(null, 'todo'); 
}

function switchAddType(type, btn) {
    addItemCtx.type = type;
    
    // Переключаем активный класс у кнопок
    document.querySelectorAll('#addTypeTabs [data-type]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Показываем нужные поля
    document.getElementById('fields-todo').style.display = type === 'habit' ? 'none' : 'block';
    document.getElementById('fields-habit').style.display = type === 'habit' ? 'block' : 'none';
    
    // Меняем заголовок
    const titleEl = document.getElementById('addItemTitle');
    if (!addItemCtx.id) {
        titleEl.textContent = type === 'todo' ? 'Новое дело' : type === 'reminder' ? 'Новое напоминание' : 'Новая привычка';
    }
}

function openAddItemModal(id = null, type = 'todo') {
    addItemCtx = { id, type, freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };
    const titleEl = document.getElementById('addItemTitle');
    const delBtn = document.getElementById('addItemDeleteBtn');
    
    document.querySelectorAll('#addTypeTabs [data-type]').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
        b.disabled = (id !== null);
    });

    document.getElementById('fields-todo').style.display = type === 'habit' ? 'none' : 'block';
    document.getElementById('fields-habit').style.display = type === 'habit' ? 'block' : 'none';

    if (id) {
        titleEl.textContent = 'Редактировать';
        delBtn.style.display = 'block';
        if (type === 'habit') {
            titleEl.textContent = 'Редактировать привычку';
            document.getElementById('addHabitName').value = '';
        } else {
            const t = [...allMainTodos, ...allMainReminders].find(x => x.id === id);
            if (t) {
                document.getElementById('todoName').value = t.name || '';
                document.getElementById('todoDate').value = t.date || '';
                document.getElementById('todoTimeStart').value = t.time_start || '';
                document.getElementById('todoTimeEnd').value = t.time_end || '';
            }
        }
    } else {
        titleEl.textContent = type === 'todo' ? 'Новое дело' : type === 'reminder' ? 'Новое напоминание' : 'Новая привычка';
        delBtn.style.display = 'none';
        
        document.getElementById('todoName').value = '';
        document.getElementById('todoDate').value = '';
        document.getElementById('todoTimeStart').value = '';
        document.getElementById('todoTimeEnd').value = '';
        document.getElementById('addHabitName').value = '';
        document.getElementById('intervalInput').value = '2';
        
        addItemCtx.freq = 'daily';
        addItemCtx.days = [1,2,3,4,5,6,7];
        document.querySelectorAll('#fields-habit [data-freq]').forEach(b => b.classList.toggle('active', b.dataset.freq === 'daily'));
        document.getElementById('freqDays').style.display = 'none';
        document.getElementById('freqInterval').style.display = 'none';
        document.querySelectorAll('#fields-habit .day-opt').forEach(b => b.classList.add('active'));
    }
    openModal('addItemModal');
}

function closeAddItemModal() { closeModal('addItemModal'); }

async function saveAddItem() {
    if (addItemCtx.type === 'habit') {
        const name = document.getElementById('habitName').value.trim(); if (!name) return alert('Введи название');
        if (addItemCtx.freq === 'days' && addItemCtx.days.length === 0) return alert('Выбери дни');
        const intervalVal = parseInt(document.getElementById('intervalInput').value);
        const payload = { name, frequency: addItemCtx.freq, days_of_week: addItemCtx.days, interval_days: intervalVal || 2 };
        try {
            if (addItemCtx.id) await api(`/api/disc/habits/${addItemCtx.id}`, 'PATCH', payload);
            else await api('/api/disc/habits', 'POST', payload);
            closeAddItemModal(); await loadMain();
        } catch (e) { alert('Ошибка: ' + e.message); }
    } else {
        const name = document.getElementById('todoName').value.trim(); if (!name) return alert('Введи название');
        const payload = { 
            name, 
            date: document.getElementById('todoDate').value || null, 
            time_start: document.getElementById('todoTimeStart').value || null, 
            time_end: document.getElementById('todoTimeEnd').value || null, 
            is_reminder: addItemCtx.type === 'reminder' 
        };
        try {
            if (addItemCtx.id) await api(`/api/disc/todos/${addItemCtx.id}`, 'PATCH', payload);
            else await api('/api/disc/todos', 'POST', payload);
            closeAddItemModal(); await loadMain();
        } catch (e) { alert('Ошибка: ' + e.message); }
    }
}

async function deleteAddItem() {
    if (!addItemCtx.id || !confirm('Удалить?')) return;
    if (addItemCtx.type === 'habit') await api(`/api/disc/habits/${addItemCtx.id}`, 'DELETE');
    else await api(`/api/disc/todos/${addItemCtx.id}`, 'DELETE');
    closeAddItemModal(); await loadMain();
}

function pickFreq(freq, btn) {
    addItemCtx.freq = freq;
    document.querySelectorAll('#fields-habit [data-freq]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('freqDays').style.display = freq === 'days' ? 'block' : 'none';
    document.getElementById('freqInterval').style.display = freq === 'interval' ? 'block' : 'none';
}
function toggleDow(dow) {
    const i = addItemCtx.days.indexOf(dow);
    if (i >= 0) addItemCtx.days.splice(i, 1); else addItemCtx.days.push(dow);
    document.querySelectorAll('#fields-habit .day-opt').forEach(b => b.classList.toggle('active', addItemCtx.days.includes(parseInt(b.dataset.dow))));
}

async function openArchive() {
    openModal('archiveModal');
    const list = document.getElementById('archiveList');
    list.innerHTML = '<div class="widget-empty">Загрузка...</div>';
    try {
        const { items } = await api('/api/disc/archive');
        if (!items.length) {
            list.innerHTML = '<div class="widget-empty">Архив пуст</div>';
            return;
        }
        list.innerHTML = items.map(t => `
            <div class="cash-item" style="margin-bottom: 6px; cursor: default;">
                <div style="flex:1;">
                    <div class="cash-item-name" style="text-decoration: line-through; color: var(--text-tertiary);">${escapeHtml(t.name)}</div>
                    <div class="cash-item-date">Дата: ${t.date ? formatDate(t.date) : 'Без даты'}</div>
                </div>
                <button class="modal-btn danger" style="flex: 0 0 auto; padding: 6px 12px; font-size: 12px;" onclick="deleteArchiveItem(${t.id})">Удалить</button>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="widget-empty">Ошибка: ${e.message}</div>`;
    }
}

async function deleteArchiveItem(id) {
    if (!confirm('Удалить задачу из архива навсегда?')) return;
    try {
        await api(`/api/disc/todos/${id}`, 'DELETE');
        openArchive(); // Перезагружаем список
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}