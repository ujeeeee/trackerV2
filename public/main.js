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
    renderMainTodos(data.todos);
    renderMainHabits(data.habits);
    renderMainMoney(data.money);
    renderNYWidget();
}

function renderMainGreeting() {
    const h = new Date().getHours();
    const g = h < 6 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день ааа' : 'Добрый вечер';
    document.getElementById('mainGreeting').textContent = `${g}, ${tgUser.name}`;
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
    const d = new Date();
    document.getElementById('mainDate').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function renderMainTodos(todos) {
    const c = document.getElementById('mainTodosWidget');

    const sorted = [...todos].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const aHas = !!a.date;
        const bHas = !!b.date;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) return a.date.localeCompare(b.date);
        return 0;
    });

    let html = `<div class="widget"><div class="widget-title"><span>Дела</span>${sorted.length > 0 ? `<span class="widget-title-count">${sorted.length}</span>` : ''}</div>`;
    if (!sorted.length) {
        html += `<div class="widget-empty">Пусто</div>`;
    } else {
        sorted.forEach(t => {
            const time = t.time_start ? `${t.time_start}${t.time_end ? '—' + t.time_end : ''}` : '';
            let label = '';
            let cls = '';
            if (t.isToday) { label = 'Сегодня'; cls = ''; }
            else if (t.isTomorrow) { label = 'Завтра'; cls = 'tomorrow'; }

            html += `<div class="main-todo-item">
                <span class="main-todo-name">${escapeHtml(t.name)}</span>
                ${time ? `<span class="main-todo-time">${time}</span>` : ''}
                ${label ? `<span class="main-todo-date ${cls}">${label}</span>` : ''}
            </div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
}

function renderMainHabits(habits) {
    const c = document.getElementById('mainHabitsWidget');
    let html = `<div class="widget"><div class="widget-title"><span>Привычки сегодня</span>${habits.length > 0 ? `<span class="widget-title-count">${habits.length}</span>` : ''}</div>`;
    if (!habits.length) {
        html += `<div class="widget-empty">Все привычки выполнены ✓</div>`;
    } else {
        habits.forEach(h => {
            html += `<div class="main-habit-item">${escapeHtml(h.name)}</div>`;
        });
    }
    html += `</div>`;
    c.innerHTML = html;
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