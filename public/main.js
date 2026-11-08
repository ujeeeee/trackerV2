// ==========================================
// ===== MAIN (дашборд) =====
// ==========================================
let mainView = 'list'; // 'list' или 'calendar'
let mainSelectedDate = localDate(new Date());
let allMainTodos = [];

async function loadMain() {
    try {
        const data = await api(`/api/main?date=${mainSelectedDate}`);
        allMainTodos = data.todos || []; // Сохраняем для редактирования
        
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

function bindItemLongPress(el, onClick, onLongPress) {
    let timer;
    let isLongPress = false;
    
    el.addEventListener('touchstart', (e) => {
        isLongPress = false;
        timer = setTimeout(() => {
            isLongPress = true;
            if (navigator.vibrate) navigator.vibrate(50);
            if (onLongPress) onLongPress();
        }, 500);
    }, {passive: true});
    
    el.addEventListener('touchend', (e) => {
        clearTimeout(timer);
        if (!isLongPress) onClick();
    });
    
    el.addEventListener('touchmove', () => { clearTimeout(timer); }, {passive: true});
    
    el.addEventListener('click', (e) => {
        if (e.pointerType === 'mouse') onClick();
    });
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
            () => completeFromMain(t.id), // Тап
            () => openTodoModal(t.id, true) // Удержание
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
            () => completeFromMain(t.id), 
            () => openTodoModal(t.id, false) 
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
            () => completeHabitFromMain(h.id), 
            () => openHabitDashboard() 
        );
    });
}

async function completeFromMain(id) {
    if (!confirm('Выполнено?')) return;
    try {
        await api(`/api/disc/todos/${id}`, 'PATCH', { done: true });
        await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function completeHabitFromMain(id) {
    if (!confirm('Привычка выполнена?')) return;
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
    const todos = data.todos || [];
    const habits = data.habits || [];
    const reminders = data.reminders || [];
    
    const timedItems = [];
    todos.forEach(t => { if(t.time_start) timedItems.push({...t, _type:'todo'}); });
    reminders.forEach(t => { if(t.time_start) timedItems.push({...t, _type:'reminder'}); });
    
    let html = '';
    
    // Блок "На весь день" (дела без времени + привычки)
    const allDayTodos = todos.filter(t => !t.time_start);
    if (allDayTodos.length > 0 || habits.length > 0) {
        let allDayHtml = `<div class="widget" style="margin-bottom:20px;">
            <div class="widget-title"><span>На весь день</span></div>`;
        
        allDayTodos.forEach(t => {
            allDayHtml += `<div class="main-todo-item" style="padding:4px 0;" onclick="openTodoModal(${t.id})">
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

    // Сетка часов 00:00 - 23:00
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
            html += `<div class="timeline-task ${typeClass}" style="top: ${topOffset}px;" onclick="openTodoModal(${t.id})">
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

function selectCalendarDate(ds) {
    mainSelectedDate = ds;
    loadMain();
}

function scrollToTimelineCurrentTime() {
    setTimeout(() => {
        const wrap = document.getElementById('timelineWrapper');
        if (!wrap) return;
        const now = new Date();
        if (mainSelectedDate === localDate(now)) {
            const h = now.getHours();
            const hourEl = wrap.querySelector(`.timeline-hour[data-hour="${h}"]`);
            if (hourEl) wrap.scrollTop = hourEl.offsetTop - 100;
        } else {
            wrap.scrollTop = 8 * 60;
        }
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
    // 1. Рисуем неделю
    const startStr = localDate(hdWeekStart);
    const { habits: weekData } = await api(`/api/disc/habits/week?start=${startStr}`);
    
    const end = new Date(hdWeekStart);
    end.setDate(end.getDate() + 6);
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    document.getElementById('hdWeekRange').textContent = `${hdWeekStart.getDate()} ${months[hdWeekStart.getMonth()]} — ${end.getDate()} ${months[end.getMonth()]}`;
    
    const today = localDate(new Date());
    const dn = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    let weekHtml = `<div class="week-grid-table"><div class="week-header"><div class="week-header-cell">Привычка</div>`;
    for (let i = 0; i < 7; i++) {
        const d = new Date(hdWeekStart);
        d.setDate(d.getDate() + i);
        weekHtml += `<div class="week-header-cell ${localDate(d) === today ? 'today' : ''}">${dn[i]}<span class="week-header-date">${d.getDate()}</span></div>`;
    }
    weekHtml += `</div>`;
    weekData.forEach(h => {
        weekHtml += `<div class="week-row"><div class="week-habit-name">${escapeHtml(h.name)}</div>`;
        h.week.forEach(day => {
            if (!day.scheduled) { weekHtml += `<div class="week-cell not-scheduled"></div>`; return; }
            const isFuture = day.date > today;
            const cls = ['week-cell', 'scheduled', day.done ? 'done' : '', day.date === today ? 'today' : ''].filter(Boolean).join(' ');
            const handler = !isFuture ? `onclick="toggleWeekCell(${h.id}, '${day.date}'); setTimeout(renderHabitDashboard, 500);"` : '';
            weekHtml += `<div class="${cls}" ${handler}>${day.done ? '✓' : ''}</div>`;
        });
        weekHtml += `</div>`;
    });
    weekHtml += `</div>`;
    document.getElementById('hdWeekGrid').innerHTML = weekHtml;
    
    // 2. Рисуем GitHub график
    const { habits: allHabits } = await api('/api/disc/habits?days=365');
    let ghHtml = '';
    const todayDate = new Date(); todayDate.setHours(12,0,0,0);
    const startGh = new Date(todayDate); startGh.setMonth(startGh.getMonth() - 6);
    const ghMonday = getMonday(startGh);
    const daysArr = [];
    const cursor = new Date(ghMonday);
    while (cursor <= todayDate) { daysArr.push(localDate(cursor)); cursor.setDate(cursor.getDate()+1); }
    const weeksArr = [];
    for (let i = 0; i < daysArr.length; i += 7) { weeksArr.push(daysArr.slice(i, i + 7)); }
    
    allHabits.forEach(h => {
        const done = new Set((h.logs || []).filter(l => l.done).map(l => l.date));
        let grid = '';
        weeksArr.forEach(week => {
            week.forEach(day => {
                const isFuture = day > today;
                const isDone = done.has(day);
                let cls = 'habit-rep-cell';
                if (isFuture) cls += ' future';
                else if (isDone) cls += ' done';
                else cls += ' empty';
                grid += `<div class="${cls}"></div>`;
            });
        });
        
        ghHtml += `<div class="habit-rep-block">
            <div class="habit-rep-header">
                <div class="habit-rep-name">${escapeHtml(h.name)}</div>
                <div class="habit-rep-count">${done.size}</div>
            </div>
            <div class="habit-rep-scroll">
                <div class="habit-rep-grid">${grid}</div>
            </div>
        </div>`;
    });
    document.getElementById('hdGithubGrid').innerHTML = ghHtml;
    
    setTimeout(() => {
        document.querySelectorAll('#hdGithubGrid .habit-rep-scroll').forEach(el => el.scrollLeft = el.scrollWidth);
    }, 50);
}

function hdWeekPrev() { hdWeekStart.setDate(hdWeekStart.getDate() - 7); renderHabitDashboard(); }
function hdWeekNext() { hdWeekStart.setDate(hdWeekStart.getDate() + 7); renderHabitDashboard(); }

// ==========================================
// ===== УМНОЕ ДОБАВЛЕНИЕ (Меню выбора) =====
// ==========================================
function openAddMenu() { openModal('addMenuModal'); }

function chooseAddType(type) {
    closeModal('addMenuModal');
    setTimeout(() => {
        if (type === 'todo') openTodoModal(null, false);
        else if (type === 'reminder') openTodoModal(null, true);
        else if (type === 'habit') openHabitModal();
    }, 200);
}

// ==========================================
// ===== МОДАЛКИ ДЕЛ И ПРИВЫЧЕК =====
// ==========================================
let todoCtx = { id: null, isReminder: false };
function pickTodoType(isRem, btn) { todoCtx.isReminder = isRem; document.querySelectorAll('#todoTypeTabs [data-rem]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }

function openTodoModal(id = null, defaultIsReminder = false) {
    todoCtx = { id, isReminder: defaultIsReminder };
    const titleEl = document.getElementById('todoModalTitle'), nameEl = document.getElementById('todoName'), dateEl = document.getElementById('todoDate'), timeStartEl = document.getElementById('todoTimeStart'), timeEndEl = document.getElementById('todoTimeEnd'), delBtn = document.getElementById('todoDeleteBtn');

    if (id) {
        const t = allMainTodos.find(x => x.id === id);
        if (t) {
            titleEl.textContent = 'Редактировать';
            nameEl.value = t.name;
            dateEl.value = t.date || '';
            timeStartEl.value = t.time_start || '';
            timeEndEl.value = t.time_end || '';
            todoCtx.isReminder = t.is_reminder || false;
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = defaultIsReminder ? 'Новое напоминание' : 'Новое дело';
        nameEl.value = '';
        dateEl.value = mainView === 'calendar' ? mainSelectedDate : '';
        timeStartEl.value = '';
        timeEndEl.value = '';
        delBtn.style.display = 'none';
    }

    document.querySelectorAll('#todoTypeTabs [data-rem]').forEach(b => b.classList.toggle('active', b.dataset.rem === String(todoCtx.isReminder)));
    openModal('todoModal');
    setTimeout(() => nameEl.focus(), 200);
}

function closeTodoModal() { closeModal('todoModal'); }
async function saveTodo() {
    const name = document.getElementById('todoName').value.trim(); if (!name) return alert('Введи название');
    const payload = { name, date: document.getElementById('todoDate').value || null, time_start: document.getElementById('todoTimeStart').value || null, time_end: document.getElementById('todoTimeEnd').value || null, is_reminder: todoCtx.isReminder };
    try {
        if (todoCtx.id) await api(`/api/disc/todos/${todoCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/todos', 'POST', payload);
        closeTodoModal(); await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}
async function deleteTodo() {
    if (!todoCtx.id || !confirm('Удалить?')) return;
    await api(`/api/disc/todos/${todoCtx.id}`, 'DELETE'); closeTodoModal(); await loadMain();
}

let habitCtx = { id: null, freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };
function openHabitModal(id = null) {
    habitCtx = { id, freq: 'daily', days: [1,2,3,4,5,6,7], interval: 2 };
    const titleEl = document.getElementById('habitModalTitle'), nameEl = document.getElementById('habitName'), delBtn = document.getElementById('habitDeleteBtn');
    if (id) {
        // Привычки мы не грузим на главный, так что если надо редактировать, придется брать из глобальной области
        // Для простоты пока оставим только создание
        titleEl.textContent = 'Редактировать'; delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая привычка'; nameEl.value = ''; delBtn.style.display = 'none';
    }
    document.getElementById('intervalInput').value = habitCtx.interval;
    document.querySelectorAll('#habitModal [data-freq]').forEach(b => b.classList.toggle('active', b.dataset.freq === habitCtx.freq));
    document.querySelectorAll('#habitModal .day-opt').forEach(b => b.classList.toggle('active', habitCtx.days.includes(parseInt(b.dataset.dow))));
    document.getElementById('freqDays').style.display = 'none'; document.getElementById('freqInterval').style.display = 'none';
    openModal('habitModal'); setTimeout(() => nameEl.focus(), 200);
}
function closeHabitModal() { closeModal('habitModal'); }
function pickFreq(freq, btn) {
    habitCtx.freq = freq; document.querySelectorAll('#habitModal [data-freq]').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    document.getElementById('freqDays').style.display = freq === 'days' ? 'block' : 'none';
    document.getElementById('freqInterval').style.display = freq === 'interval' ? 'block' : 'none';
}
function toggleDow(dow) {
    const i = habitCtx.days.indexOf(dow); if (i >= 0) habitCtx.days.splice(i, 1); else habitCtx.days.push(dow);
    document.querySelectorAll('#habitModal .day-opt').forEach(b => b.classList.toggle('active', habitCtx.days.includes(parseInt(b.dataset.dow))));
}
async function saveHabit() {
    const name = document.getElementById('habitName').value.trim(); if (!name) return alert('Введи название');
    if (habitCtx.freq === 'days' && habitCtx.days.length === 0) return alert('Выбери дни');
    const intervalVal = parseInt(document.getElementById('intervalInput').value);
    const payload = { name, frequency: habitCtx.freq, days_of_week: habitCtx.days, interval_days: intervalVal || 2 };
    try {
        if (habitCtx.id) await api(`/api/disc/habits/${habitCtx.id}`, 'PATCH', payload);
        else await api('/api/disc/habits', 'POST', payload);
        closeHabitModal(); await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}
async function deleteHabit() {
    if (!habitCtx.id || !confirm('Удалить привычку?')) return;
    await api(`/api/disc/habits/${habitCtx.id}`, 'DELETE'); closeHabitModal(); await loadMain();
}