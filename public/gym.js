// ==========================================
// ===== GYM: ПРОГРАММЫ =====
// ==========================================
let programs = [];
let openProgramIds = loadSet('openPrograms');
let openDayIds = loadSet('openDays');
let openExerciseIds = loadSet('openExercises');
let programCtx = { id: null };
let dayCtx = { id: null, programId: null };
let exerciseCtx = { id: null, dayId: null };
let setCtx = { id: null, exerciseId: null };

async function loadPrograms() {
    try {
        const { programs: data } = await api('/api/gym/programs');
        programs = data;
        renderPrograms();
    } catch (e) { console.error(e); }
}

function renderPrograms() {
    const c = document.getElementById('programsList');
    if (!programs.length) {
        c.innerHTML = `<div class="empty-state">Нет программ. Нажми +</div>`;
        return;
    }

    c.innerHTML = programs.map(p => {
        const isOpen = openProgramIds.has(p.id);
        return `<div class="program-card ${isOpen ? 'open' : ''}" data-id="${p.id}">
            <div class="program-header">
                <span class="program-arrow" onclick="event.stopPropagation(); toggleProgram(${p.id})">▶</span>
                <div class="program-name" onclick="openProgramModal(${p.id})">${escapeHtml(p.name)}</div>
            </div>
            <div class="program-body">
                ${p.days.map((d, di) => renderDay(d, di)).join('')}
                <button class="program-add-day" onclick="openDayModal(null, ${p.id})">+ Добавить тренировку</button>
            </div>
        </div>`;
    }).join('');

    if (!c._sortable && window.Sortable) {
        c._sortable = new Sortable(c, {
            animation: 150, delay: 250, delayOnTouchOnly: true,
            draggable: '.program-card[data-id]',
            onEnd: async () => {
                const ids = [...c.querySelectorAll('.program-card[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'gym_programs', ids });
            }
        });
    }

    c.querySelectorAll('.program-body').forEach(body => {
        const days = [...body.querySelectorAll('.day-block[data-id]')];
        if (!days.length) return;
        makeSortable(body, 'gym_program_days', { draggable: '.day-block[data-id]', handle: '.day-header' });
    });

    c.querySelectorAll('.day-body').forEach(body => {
        const ex = [...body.querySelectorAll('.exercise-block[data-id]')];
        if (!ex.length) return;
        makeSortable(body, 'gym_exercises', { draggable: '.exercise-block[data-id]', handle: '.exercise-header' });
    });
}

function renderDay(d, di) {
    const isOpen = openDayIds.has(d.id);
    return `<div class="day-block ${isOpen ? 'open' : ''}" data-id="${d.id}">
        <div class="day-header">
            <span class="day-arrow" onclick="event.stopPropagation(); toggleDay(${d.id})">▶</span>
            <span class="day-num">${di + 1}.</span>
            <span class="day-name" onclick="openDayModal(${d.id}, ${d.program_id})">${escapeHtml(d.name)}</span>
        </div>
        <div class="day-body">
            ${d.exercises.map((e, ei) => renderExercise(e, ei)).join('')}
            <button class="day-add-exercise" onclick="openExerciseModal(null, ${d.id})">+ Упражнение</button>
        </div>
    </div>`;
}

function renderExercise(e, ei) {
    const isOpen = openExerciseIds.has(e.id);
    const summary = e.sets.length ? `${e.sets.length} подх.` : 'нет подходов';

    const setsHtml = e.sets.map((s, si) => `
        <div class="set-row">
            <span class="set-num">${si + 1})</span>
            <span class="set-value">${s.reps || '?'} × ${s.weight || '?'}</span>
            <button class="set-del" onclick="openSetModal(${s.id}, ${e.id}, ${s.reps || 'null'}, ${s.weight || 'null'})">✎</button>
        </div>
    `).join('');

    return `<div class="exercise-block ${isOpen ? 'open' : ''}" data-id="${e.id}">
        <div class="exercise-header">
            <span class="ex-arrow" onclick="event.stopPropagation(); toggleExercise(${e.id})">▶</span>
            <span class="set-num">${ei + 1}.</span>
            <span class="exercise-name" onclick="openExerciseModal(${e.id}, ${e.day_id})">${escapeHtml(e.name)}</span>
            <span class="exercise-summary">${summary}</span>
        </div>
        <div class="exercise-body">
            ${setsHtml}
            <button class="exercise-add-set" onclick="openSetModal(null, ${e.id})">+ подход</button>
        </div>
    </div>`;
}

function toggleProgram(id) {
    if (openProgramIds.has(id)) openProgramIds.delete(id); else openProgramIds.add(id);
    saveSet('openPrograms', openProgramIds);
    renderPrograms();
}
function toggleDay(id) {
    if (openDayIds.has(id)) openDayIds.delete(id); else openDayIds.add(id);
    saveSet('openDays', openDayIds);
    renderPrograms();
}
function toggleExercise(id) {
    if (openExerciseIds.has(id)) openExerciseIds.delete(id); else openExerciseIds.add(id);
    saveSet('openExercises', openExerciseIds);
    renderPrograms();
}

function openProgramModal(id = null) {
    programCtx = { id };
    const titleEl = document.getElementById('programTitle');
    const nameEl = document.getElementById('programName');
    const delBtn = document.getElementById('programDeleteBtn');

    if (id) {
        const p = programs.find(x => x.id === id);
        if (p) { titleEl.textContent = 'Редактировать программу'; nameEl.value = p.name; }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая программа';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('programModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeProgramModal() { closeModal('programModal'); }

async function saveProgram() {
    const name = document.getElementById('programName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (programCtx.id) await api(`/api/gym/programs/${programCtx.id}`, 'PATCH', { name });
        else await api('/api/gym/programs', 'POST', { name });
        closeProgramModal();
        await loadPrograms();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteProgramFromModal() {
    if (!programCtx.id) return;
    if (!confirm('Удалить программу со всеми тренировками?')) return;
    await api(`/api/gym/programs/${programCtx.id}`, 'DELETE');
    closeProgramModal();
    openProgramIds.delete(programCtx.id);
    saveSet('openPrograms', openProgramIds);
    await loadPrograms();
}

function openDayModal(id = null, programId = null) {
    dayCtx = { id, programId };
    const titleEl = document.getElementById('dayTitle');
    const nameEl = document.getElementById('dayName');
    const delBtn = document.getElementById('dayDeleteBtn');

    if (id) {
        for (const p of programs) {
            const d = p.days.find(x => x.id === id);
            if (d) { titleEl.textContent = 'Редактировать тренировку'; nameEl.value = d.name; break; }
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новая тренировка';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('dayModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeDayModal() { closeModal('dayModal'); }

async function saveDay() {
    const name = document.getElementById('dayName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (dayCtx.id) {
            await api(`/api/gym/days/${dayCtx.id}`, 'PATCH', { name });
        } else {
            await api(`/api/gym/programs/${dayCtx.programId}/days`, 'POST', { name });
            openProgramIds.add(dayCtx.programId);
            saveSet('openPrograms', openProgramIds);
        }
        closeDayModal();
        await loadPrograms();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteDayFromModal() {
    if (!dayCtx.id) return;
    if (!confirm('Удалить тренировку?')) return;
    await api(`/api/gym/days/${dayCtx.id}`, 'DELETE');
    closeDayModal();
    openDayIds.delete(dayCtx.id);
    saveSet('openDays', openDayIds);
    await loadPrograms();
}

function openExerciseModal(id = null, dayId = null) {
    exerciseCtx = { id, dayId };
    const titleEl = document.getElementById('exerciseTitle');
    const nameEl = document.getElementById('exerciseName');
    const delBtn = document.getElementById('exerciseDeleteBtn');

    if (id) {
        for (const p of programs) {
            for (const d of p.days) {
                const e = d.exercises.find(x => x.id === id);
                if (e) { titleEl.textContent = 'Редактировать упражнение'; nameEl.value = e.name; break; }
            }
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = 'Новое упражнение';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('exerciseModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeExerciseModal() { closeModal('exerciseModal'); }

async function saveExercise() {
    const name = document.getElementById('exerciseName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (exerciseCtx.id) {
            await api(`/api/gym/exercises/${exerciseCtx.id}`, 'PATCH', { name });
        } else {
            await api(`/api/gym/days/${exerciseCtx.dayId}/exercises`, 'POST', { name });
            openDayIds.add(exerciseCtx.dayId);
            saveSet('openDays', openDayIds);
        }
        closeExerciseModal();
        await loadPrograms();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteExerciseFromModal() {
    if (!exerciseCtx.id) return;
    if (!confirm('Удалить упражнение?')) return;
    await api(`/api/gym/exercises/${exerciseCtx.id}`, 'DELETE');
    closeExerciseModal();
    openExerciseIds.delete(exerciseCtx.id);
    saveSet('openExercises', openExerciseIds);
    await loadPrograms();
}

function openSetModal(id = null, exerciseId = null, reps = null, weight = null) {
    setCtx = { id, exerciseId };
    const titleEl = document.getElementById('setTitle');
    const repsEl = document.getElementById('setReps');
    const weightEl = document.getElementById('setWeight');
    const delBtn = document.getElementById('setDeleteBtn');

    titleEl.textContent = id ? 'Редактировать подход' : 'Новый подход';
    repsEl.value = reps !== null ? reps : '';
    weightEl.value = weight !== null ? weight : '';
    delBtn.style.display = id ? 'block' : 'none';

    openModal('setModal');
    setTimeout(() => repsEl.focus(), 200);
}
function closeSetModal() { closeModal('setModal'); }

async function saveExerciseSet() {
    const reps = document.getElementById('setReps').value;
    const weight = document.getElementById('setWeight').value;
    if (reps === '' && weight === '') return alert('Заполни повторения или вес');
    try {
        if (setCtx.id) {
            await api(`/api/gym/sets/${setCtx.id}`, 'DELETE');
        }
        await api(`/api/gym/exercises/${setCtx.exerciseId}/sets`, 'POST', { reps, weight });
        openExerciseIds.add(setCtx.exerciseId);
        saveSet('openExercises', openExerciseIds);
        closeSetModal();
        await loadPrograms();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteSetFromModal() {
    if (!setCtx.id) return;
    if (!confirm('Удалить подход?')) return;
    await api(`/api/gym/sets/${setCtx.id}`, 'DELETE');
    closeSetModal();
    await loadPrograms();
}

// ==========================================
// ===== GYM: МЕТРИКИ =====
// ==========================================
let metrics = [];
let metricCtx = { id: null, category: 'bio' };
let metricLogCtx = { metricId: null, date: null, logId: null };

async function loadMetrics() {
    try {
        const { metrics: data } = await api('/api/gym/metrics');
        metrics = data;
        renderMetricsTable();
    } catch (e) { console.error(e); }
}

function renderMetricsTable() {
    renderTable('bioTable', metrics.filter(m => m.category === 'bio'));
    renderTable('strengthTable', metrics.filter(m => m.category === 'strength'));
}

function renderTable(containerId, list) {
    const c = document.getElementById(containerId);
    if (!list.length) {
        c.innerHTML = `<div class="widget-empty">Нет метрик. Нажми +</div>`;
        return;
    }

    const datesSet = new Set();
    list.forEach(m => m.logs.forEach(l => datesSet.add(l.date)));
    const dates = [...datesSet].sort();

    let html = `<div class="metrics-table-wrap"><table class="metrics-table"><thead><tr>`;
    html += `<th class="col-name">Метрика</th><th class="col-target">Цель</th>`;
    dates.forEach(d => { html += `<th>${formatDate(d)}</th>`; });
    html += `<th>+</th></tr></thead><tbody>`;

    list.forEach(m => {
        const map = {};
        m.logs.forEach(l => { map[l.date] = l; });
        const unit = m.unit || '';
        const target = m.target ? `${m.target}${unit}` : '—';

        html += `<tr data-id="${m.id}">`;
        html += `<td class="col-name" onclick="openMetricModal('${m.category}', ${m.id})">${escapeHtml(m.name)}</td>`;
        html += `<td class="col-target">${target}</td>`;
        dates.forEach(d => {
            const log = map[d];
            if (log) {
                html += `<td class="cell" onclick="openMetricLogModal(${m.id}, '${d}', ${log.id}, ${log.value})">${log.value}</td>`;
            } else {
                html += `<td class="cell empty" onclick="openMetricLogModal(${m.id}, '${d}', null, null)">—</td>`;
            }
        });
        html += `<td class="cell add-cell" onclick="openMetricLogModal(${m.id}, null, null, null)">+</td>`;
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    c.innerHTML = html;

    const tbody = c.querySelector('tbody');
    if (tbody && tbody.children.length && window.Sortable && !tbody._sortable) {
        tbody._sortable = new Sortable(tbody, {
            animation: 150, delay: 300, delayOnTouchOnly: true,
            draggable: 'tr[data-id]',
            onEnd: async () => {
                const ids = [...tbody.querySelectorAll('tr[data-id]')]
                    .map(el => parseInt(el.dataset.id)).filter(Boolean);
                if (ids.length) await api('/api/reorder', 'POST', { table: 'gym_metrics', ids });
            }
        });
    }

    requestAnimationFrame(() => {
        c.querySelectorAll('.metrics-table-wrap').forEach(wrap => {
            wrap.scrollLeft = wrap.scrollWidth;
        });
    });
}

function openMetricModal(category, id = null) {
    metricCtx = { id, category };
    const titleEl = document.getElementById('metricTitle');
    const nameEl = document.getElementById('metricName');
    const unitEl = document.getElementById('metricUnit');
    const targetEl = document.getElementById('metricTarget');
    const delBtn = document.getElementById('metricDeleteBtn');

    if (id) {
        const m = metrics.find(x => x.id === id);
        if (m) {
            titleEl.textContent = 'Редактировать метрику';
            nameEl.value = m.name;
            unitEl.value = m.unit || 'кг';
            targetEl.value = m.target || '';
        }
        delBtn.style.display = 'block';
    } else {
        titleEl.textContent = category === 'bio' ? 'Новая метрика биометрии' : 'Новая метрика силы';
        nameEl.value = '';
        unitEl.value = 'кг';
        targetEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('metricModal');
    setTimeout(() => nameEl.focus(), 200);
}
function closeMetricModal() { closeModal('metricModal'); }

async function saveMetric() {
    const name = document.getElementById('metricName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        name,
        category: metricCtx.category,
        unit: document.getElementById('metricUnit').value,
        target: document.getElementById('metricTarget').value || null,
    };
    try {
        if (metricCtx.id) await api(`/api/gym/metrics/${metricCtx.id}`, 'PATCH', payload);
        else await api('/api/gym/metrics', 'POST', payload);
        closeMetricModal();
        await loadMetrics();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteMetricFromModal() {
    if (!metricCtx.id) return;
    if (!confirm('Удалить метрику и все её замеры?')) return;
    await api(`/api/gym/metrics/${metricCtx.id}`, 'DELETE');
    closeMetricModal();
    await loadMetrics();
}

function openMetricLogModal(metricId, date, logId, value) {
    metricLogCtx = { metricId, date, logId };
    const m = metrics.find(x => x.id === metricId);
    document.getElementById('metricLogTitle').textContent =
        m ? m.name + (m.unit ? ` (${m.unit})` : '') : 'Замер';
    document.getElementById('logValue').value = (value !== null && value !== undefined) ? value : '';
    document.getElementById('logDate').value = date || localDate(new Date());
    document.getElementById('logDeleteBtn').style.display = logId ? 'block' : 'none';
    openModal('metricLogModal');
    setTimeout(() => document.getElementById('logValue').focus(), 200);
}
function closeMetricLogModal() { closeModal('metricLogModal'); }

async function saveMetricLog() {
    const value = document.getElementById('logValue').value;
    if (value === '') return alert('Введи значение');
    try {
        await api(`/api/gym/metrics/${metricLogCtx.metricId}/logs`, 'POST', {
            value, date: document.getElementById('logDate').value,
        });
        closeMetricLogModal();
        await loadMetrics();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteLogFromModal() {
    if (!metricLogCtx.logId) return;
    if (!confirm('Удалить замер?')) return;
    await api(`/api/gym/metrics/logs/${metricLogCtx.logId}`, 'DELETE');
    closeMetricLogModal();
    await loadMetrics();
}