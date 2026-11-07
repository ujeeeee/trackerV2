// ==========================================
// ===== MAIN (дашборд) =====
// ==========================================
async function loadMain() {
    try {
        const today = localDate(new Date());
        const data = await api(`/api/main?date=${today}`);
        renderMain(data);
    } catch (e) { console.error(e); }
}

function renderMain(data) {
    renderMainGreeting();
    renderMainReminders(data.reminders || []);
    renderMainTodos(data.todos || []);
    renderMainHabits(data.habits || []);
    renderMainMoney(data.money);
    renderNYWidget();
}

function renderMainGreeting() {
    const h = new Date().getHours();
    const g = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    document.getElementById('mainGreeting').textContent = `${g}, ${tgUser.name}`;
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
    const d = new Date();
    document.getElementById('mainDate').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function renderMainReminders(reminders) {
    const c = document.getElementById('mainRemindersWidget');
    
    let html = `<div class="widget">
        <div class="widget-title">
            <span>🔔 Напоминания</span>
            <div style="display:flex; align-items:center; gap:12px;">
                ${reminders.length > 0 ? `<span class="widget-title-count">${reminders.length}</span>` : ''}
                <button class="btn-icon-add" onclick="openTodoModal(null, true)">+</button>
            </div>
        </div>`;
        
    if (!reminders.length) {
        html += `<div class="widget-empty">Нет напоминаний</div>`;
    } else {
        reminders.forEach(t => {
            const dateStr = t.date ? formatDate(t.date) : '';
            html += `<div class="main-todo-item" onclick="completeFromMain(${t.id})">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
                ${dateStr ? `<span class="main-todo-date" style="color: var(--accent); font-weight: 700;">${dateStr}</span>` : ''}
            </div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
}

function renderMainTodos(todos) {
    const c = document.getElementById('mainTodosWidget');
    
    let html = `<div class="widget">
        <div class="widget-title">
            <span>Дела</span>
            <div style="display:flex; align-items:center; gap:12px;">
                ${todos.length > 0 ? `<span class="widget-title-count">${todos.length}</span>` : ''}
                <button class="btn-icon-add" onclick="openTodoModal(null, false)">+</button>
            </div>
        </div>`;
        
    if (!todos.length) {
        html += `<div class="widget-empty">Пусто</div>`;
    } else {
        todos.forEach(t => {
            const time = t.time_start ? `${t.time_start}${t.time_end ? '—' + t.time_end : ''}` : '';
            let label = t.isToday ? 'Сегодня' : (t.isTomorrow ? 'Завтра' : '');
            if (!t.date) label = '';

            html += `<div class="main-todo-item" onclick="completeFromMain(${t.id})">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
                ${time ? `<span class="main-todo-time">${time}</span>` : ''}
                ${label ? `<span class="main-todo-date ${t.isTomorrow ? 'tomorrow' : ''}">${label}</span>` : ''}
            </div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
}

async function completeFromMain(id) {
    if (!confirm('Выполнено?')) return;
    try {
        await api(`/api/disc/todos/${id}`, 'PATCH', { done: true });
        await loadMain();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

function renderMainHabits(habits) {
    const c = document.getElementById('mainHabitsWidget');
    let html = `<div class="widget"><div class="widget-title"><span>Привычки сегодня</span>${habits.length > 0 ? `<span class="widget-title-count">${habits.length}</span>` : ''}</div>`;
    if (!habits.length) {
        html += `<div class="widget-empty">Все привычки выполнены ✓</div>`;
    } else {
        habits.forEach(h => {
            html += `<div class="main-habit-item" onclick="completeHabitFromMain(${h.id})">${escapeHtml(h.name)}</div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
}

async function completeHabitFromMain(id) {
    if (!confirm('Привычка выполнена?')) return;
    try {
        await api(`/api/disc/habits/${id}/toggle`, 'POST', { date: localDate(new Date()) });
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
        <div style="flex:1;"></div>
    </div>`;
}

function renderNYWidget() {
    const c = document.getElementById('mainNYWidget');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const ny = new Date(now.getFullYear() + 1, 0, 1);

    const start = new Date(ny);
    start.setDate(start.getDate() - 99);

    const todayStr = localDate(now);
    const daysLeft = Math.round((ny - now) / 86400000);

    let cells = '';
    for (let i = 0; i < 100; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const ds = localDate(d);

        let cls = 'ny-cell';
        if (ds < todayStr) cls += ' passed';
        else if (ds === todayStr) cls += ' today';
        else cls += ' future';

        cells += `<div class="${cls}">${d.getDate()}</div>`;
    }

    c.innerHTML = `
        <div class="widget">
            <div class="widget-title">
                <span>До Нового года</span>
                <span class="widget-title-count">${daysLeft} дн.</span>
            </div>
            <div class="ny-grid">${cells}</div>
        </div>
    `;
}

function toggleMoneyBlur(el) {
    el.classList.toggle('money-blur');
}