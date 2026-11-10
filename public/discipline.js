// ==========================================
// ===== DISCIPLINE: ТОЛЬКО ЦЕЛИ (ДЕРЕВО) =====
// ==========================================
let areasFlat = [];
let goalsFlat = [];
let treeRoot = null;
let treeNodesById = {};
let selectedNodeId = null;
let lastFocusedNodeId = null;
let cameraStack = [];

const camera = { x: 0, y: 0, scale: 1 };
const MAX_SCALE = 3;
let minAllowedScale = 0.3;

const NODE_W = 180;
const NODE_H = 52;
const H_GAP = 22;
const V_GAP = 60;
const ROOT_GAP = 60;
const PAD_GOALS = 6;
const GOAL_ROW_H = 20;

const NAME_TOP = 12;
const NAME_LINE_H = 16;
const NAME_MAX_LINES = 3;
const NAME_CHARS_PER_LINE = 17;
const SUB_GAP = 2;
const SUB_H = 14;
const BOTTOM_PAD = 8;

let _collapsedAreas = new Set();
let _collapsedGoals = new Set(JSON.parse(localStorage.getItem('collapse_goalLists') || '[]'));

function saveCollapsedGoals() { localStorage.setItem('collapse_goalLists', JSON.stringify([..._collapsedGoals])); }
function isGoalsCollapsed(areaId) { return _collapsedGoals.has(areaId); }
function toggleGoalsCollapsed(areaId) { if (_collapsedGoals.has(areaId)) _collapsedGoals.delete(areaId); else _collapsedGoals.add(areaId); saveCollapsedGoals(); renderTree(); }

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
    const root = { id: 'root', type: 'root', name: 'МОИ ЦЕЛИ', children: [] };
    treeNodesById['root'] = root;

    areasFlat.forEach(a => { treeNodesById['a:' + a.id] = { id: 'a:' + a.id, rawId: a.id, type: 'area', name: a.name, parentAreaId: a.parent_id, children: [] }; });
    goalsFlat.forEach(g => { treeNodesById['g:' + g.id] = { id: 'g:' + g.id, rawId: g.id, type: 'goal', name: g.name, done: g.status === 'done', areaId: g.area_id, children: [] }; });

    areasFlat.forEach(a => { treeNodesById['a:' + a.id].goals = []; });
    areasFlat.forEach(a => {
        const node = treeNodesById['a:' + a.id];
        if (a.parent_id && treeNodesById['a:' + a.parent_id]) treeNodesById['a:' + a.parent_id].children.push(node);
        else root.children.push(node);
    });
    goalsFlat.forEach(g => {
        const areaNode = g.area_id ? treeNodesById['a:' + g.area_id] : null;
        if (areaNode) areaNode.goals.push({ id: 'g:' + g.id, rawId: g.id, name: g.name, done: g.status === 'done' });
    });
    treeRoot = root;
}

function computeSubtreeWidth(node) {
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (node.children.length === 0 || isCollapsed) { node.subtreeWidth = NODE_W; return; }
    const gap = (node.type === 'root') ? ROOT_GAP : H_GAP;
    let total = 0;
    node.children.forEach((c, i) => { computeSubtreeWidth(c); total += c.subtreeWidth; if (i < node.children.length - 1) total += gap; });
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
    node.children.forEach(c => { assignPositions(c, cursor, topY + node.h + V_GAP); cursor += c.subtreeWidth + gap; });
}

function layoutTree() {
    computeSubtreeWidth(treeRoot); assignPositions(treeRoot, 0, 0);
    const dx = treeRoot.x; const dy = treeRoot.y;
    Object.values(treeNodesById).forEach(n => { if (n.x !== undefined) { n.x -= dx; n.y -= dy; } });
}

function renderTree() {
    if (!treeRoot) return; layoutTree(); updateMinScale();
    const svg = document.getElementById('treeSvg'); if (!svg) return;
    let html = '<g id="treeCamera">' + renderEdges(treeRoot) + renderNodes(treeRoot) + '</g>';
    svg.innerHTML = html; applyCamera(); updateBreadcrumb(); updateActionsBar();
    if (!camera._init) { camera._init = true; selectedNodeId = null; setTimeout(() => fitTree(), 80); }
}

function renderEdges(node) {
    if (node.type === 'root') { let h = ''; node.children.forEach(c => { h += renderEdges(c); }); return h; }
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (isCollapsed || !node.children.length) return '';
    let html = '';
    node.children.forEach(c => {
        const y1 = node.y + (node.h || NODE_H) / 2; const y2 = c.y - (c.h || NODE_H) / 2; const midY = (y1 + y2) / 2;
        html += `<path class="tree-edge" d="M ${node.x} ${y1} C ${node.x} ${midY}, ${c.x} ${midY}, ${c.x} ${y2}" />` + renderEdges(c);
    });
    return html;
}

function renderNodes(node) {
    let html = node.type !== 'root' ? renderSingleNode(node) : '';
    const isCollapsed = _collapsedAreas.has(node.rawId) && node.type === 'area';
    if (!isCollapsed) node.children.forEach(c => { html += renderNodes(c); });
    return html;
}

function renderSingleNode(n) {
    const x = n.x - NODE_W / 2; const y = n.y - n.h / 2;
    const isCollapsed = n.type === 'area' && _collapsedAreas.has(n.rawId);
    const isGoalsCollapsedFlag = n.type === 'area' && isGoalsCollapsed(n.rawId);
    const hasGoals = n.type === 'area' && n.goals && n.goals.length > 0;
    const showGoals = hasGoals && !isGoalsCollapsedFlag && !isCollapsed;
    const cls = ['tree-node'];
    if (isCollapsed) cls.push('collapsed'); if (selectedNodeId === n.id) cls.push('active');

    const sub = getNodeSubtitle(n);
    const subText = sub ? `${sub}${hasGoals ? (isGoalsCollapsedFlag ? ' ▸' : ' ▾') : ''}` : '';
    const nameLines = wrapText(n.name, NAME_CHARS_PER_LINE, NAME_MAX_LINES);
    let nameTspans = '';
    nameLines.forEach((line, i) => { nameTspans += `<tspan x="${NODE_W / 2}" y="${NAME_TOP + i * NAME_LINE_H + 12}">${escapeSvg(line)}</tspan>`; });

    let inner = `<text class="tn-name" text-anchor="middle" pointer-events="none">${nameTspans}</text>`;
    if (subText) inner += `<text class="tn-sub" x="${NODE_W / 2}" y="${NAME_TOP + nameLines.length * NAME_LINE_H + SUB_GAP + 11}" text-anchor="middle" pointer-events="none">${escapeSvg(subText)}</text>`;
    if (hasGoals) inner += `<rect class="tn-sub-clickable-rect" x="0" y="${NAME_TOP + nameLines.length * NAME_LINE_H + SUB_GAP - 2}" width="${NODE_W}" height="${SUB_H + 4}" fill="transparent" pointer-events="all" data-toggle-goals="${n.rawId}" />`;

    let goalsHtml = '';
    if (showGoals) {
        n.goals.forEach((g, i) => {
            const gy = (n.goalsTop || (n.headH + PAD_GOALS)) + i * GOAL_ROW_H;
            goalsHtml += `<g class="tn-goal-row ${g.done ? 'done' : ''}">
                <rect x="0" y="${gy}" width="${NODE_W}" height="${GOAL_ROW_H}" fill="transparent" pointer-events="all" />
                <g data-toggle-goal="${g.rawId}"><circle class="tn-goal-check ${g.done ? 'done' : ''}" cx="16" cy="${gy + GOAL_ROW_H / 2}" r="6" /><path class="tn-goal-check-mark" d="M 13 ${gy + GOAL_ROW_H / 2} L 15 ${gy + GOAL_ROW_H / 2 + 2} L 19 ${gy + GOAL_ROW_H / 2 - 2}" /></g>
                <text class="tn-goal-name" data-edit-goal="${g.rawId}" data-goal-area="${n.rawId}" x="28" y="${gy + GOAL_ROW_H / 2 + 4}" pointer-events="all">${escapeSvg(truncateName(g.name, 22))}</text>
            </g>`;
        });
    }
    return `<g class="${cls.join(' ')}" data-node-id="${n.id}" transform="translate(${x} ${y})"><rect class="tn-rect" width="${NODE_W}" height="${n.h}" rx="12" />${inner}${goalsHtml}</g>`;
}

function getNodeSubtitle(n) {
    if (n.type !== 'area') return '';
    const parts = [];
    if (n.goals && n.goals.length) parts.push(`${n.goals.length} целей`);
    if (n.children && n.children.length) parts.push(`${n.children.length} веток`);
    return parts.join(' · ') || 'пусто';
}

function applyCamera() { const g = document.getElementById('treeCamera'); if (g) g.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.scale})`); }
function animateCameraTo(target, duration = 400) {
    const start = { x: camera.x, y: camera.y, scale: camera.scale }; const t0 = performance.now();
    function step(t) { const p = Math.min(1, (t - t0) / duration); const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; camera.x = start.x + (target.x - start.x) * e; camera.y = start.y + (target.y - start.y) * e; camera.scale = start.scale + (target.scale - start.scale) * e; applyCamera(); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
}
function fitTree() {
    const svg = document.getElementById('treeSvg'); if (!svg) return;
    const bbox = computeTreeBBox(); const PAD = 5; const s = Math.min(MAX_SCALE, (svg.clientWidth - PAD * 2) / bbox.w, (svg.clientHeight - PAD * 2) / bbox.h);
    animateCameraTo({ x: svg.clientWidth / 2 - (bbox.x + bbox.w / 2) * s, y: svg.clientHeight / 2 - (bbox.y + bbox.h / 2) * s, scale: s }, 500);
}
function computeTreeBBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (function visit(n) { minX = Math.min(minX, n.x - NODE_W / 2); minY = Math.min(minY, n.y - (n.h || NODE_H) / 2); maxX = Math.max(maxX, n.x + NODE_W / 2); maxY = Math.max(maxY, n.y + (n.h || NODE_H) / 2); if (!(_collapsedAreas.has(n.rawId) && n.type === 'area')) n.children.forEach(visit); })(treeRoot);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function updateMinScale() {
    const svg = document.getElementById('treeSvg'); if (!svg || !treeRoot) return;
    const bbox = computeTreeBBox(); const PAD = 5; minAllowedScale = Math.min(MAX_SCALE, (svg.clientWidth - PAD * 2) / Math.max(1, bbox.w), (svg.clientHeight - PAD * 2) / Math.max(1, bbox.h));
}
function treeZoomIn() { zoomCenter(1.3); } function treeZoomOut() { zoomCenter(0.77); }
function zoomCenter(f) { const svg = document.getElementById('treeSvg'); zoomAt(svg.clientWidth / 2, svg.clientHeight / 2, f); }
function zoomAt(px, py, factor) {
    const newScale = Math.max(minAllowedScale, Math.min(MAX_SCALE, camera.scale * factor)); const realFactor = newScale / camera.scale;
    camera.x = px - (px - camera.x) * realFactor; camera.y = py - (py - camera.y) * realFactor; camera.scale = newScale; applyCamera();
}
function treeBack() { if (cameraStack.length > 1) { cameraStack.pop(); const prev = cameraStack[cameraStack.length - 1]; selectedNodeId = prev.nodeId; renderTree(); focusNode(prev.nodeId); } else fitTree(); }
function focusNode(nodeId, animate = true) {
    const n = treeNodesById[nodeId]; if (!n) return; const targetScale = Math.max(camera.scale, 1.1);
    const target = { x: document.getElementById('treeSvg').clientWidth / 2 - n.x * targetScale, y: document.getElementById('treeSvg').clientHeight / 2 - n.y * targetScale, scale: targetScale };
    if (animate) animateCameraTo(target, 400); else { camera.x = target.x; camera.y = target.y; camera.scale = target.scale; applyCamera(); }
}

const _pointers = new Map(); let _panStart = null, _pinchStart = null;
function initTreePointer() {
    const svg = document.getElementById('treeSvg'); if (!svg || svg._inited) return; svg._inited = true;
    svg.addEventListener('pointerdown', e => {
        svg.setPointerCapture(e.pointerId); _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startTime: Date.now() });
        if (_pointers.size === 1) { _panStart = { x: e.clientX, y: e.clientY, camX: camera.x, camY: camera.y }; _pinchStart = null; }
        else if (_pointers.size === 2) { const pts = [..._pointers.values()]; _pinchStart = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), camScale: camera.scale, camX: camera.x, camY: camera.y }; _panStart = null; }
    }, { passive: false });
    svg.addEventListener('pointermove', e => {
        const p = _pointers.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
        if (_pointers.size === 1 && _panStart) { camera.x = _panStart.camX + (e.clientX - _panStart.x); camera.y = _panStart.camY + (e.clientY - _panStart.y); applyCamera(); }
        else if (_pointers.size === 2 && _pinchStart) {
            const pts = [..._pointers.values()]; const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const newScale = Math.max(minAllowedScale, Math.min(MAX_SCALE, _pinchStart.camScale * (dist / _pinchStart.dist)));
            const realFactor = newScale / _pinchStart.camScale; const midX = (pts[0].x + pts[1].x) / 2 - svg.getBoundingClientRect().left; const midY = (pts[0].y + pts[1].y) / 2 - svg.getBoundingClientRect().top;
            camera.scale = newScale; camera.x = midX - (midX - _pinchStart.camX) * realFactor; camera.y = midY - (midY - _pinchStart.camY) * realFactor; applyCamera();
        }
    }, { passive: false });
    svg.addEventListener('pointerup', e => {
        const p = _pointers.get(e.pointerId); _pointers.delete(e.pointerId);
        if (_pointers.size === 0) { if (p && Date.now() - p.startTime < 350 && Math.abs(p.x - p.startX) < 8 && Math.abs(p.y - p.startY) < 8) handleTap(e.clientX, e.clientY); _panStart = null; _pinchStart = null; }
        else if (_pointers.size === 1) { const only = [..._pointers.values()][0]; _panStart = { x: only.x, y: only.y, camX: camera.x, camY: camera.y }; _pinchStart = null; }
    });
    svg.addEventListener('pointercancel', e => { _pointers.delete(e.pointerId); if (_pointers.size === 0) { _panStart = null; _pinchStart = null; } });
}

function handleTap(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const toggleEl = findElWithDataset(el, 'toggleGoals');
    if (toggleEl) { toggleGoalsCollapsed(parseInt(toggleEl.dataset.toggleGoals)); return; }
    const checkEl = findElWithDataset(el, 'toggleGoal');
    if (checkEl) { const goalId = parseInt(checkEl.dataset.toggleGoal); const g = goalsFlat.find(x => x.id === goalId); if (g) toggleGoalDone(goalId, g.status === 'done'); return; }
    const goalEl = findElWithDataset(el, 'editGoal') || findElWithDataset(el, 'dragGoal');
    if (goalEl) { openGoalModal(parseInt(goalEl.dataset.editGoal || goalEl.dataset.dragGoal), parseInt(goalEl.dataset.goalArea || goalEl.dataset.dragArea)); return; }

    const nodeEl = findNodeEl(el);
    if (nodeEl) {
        const id = nodeEl.dataset.nodeId; const n = treeNodesById[id]; if (!n) return;
        selectedNodeId = id; lastFocusedNodeId = id; cameraStack.push({ nodeId: id, x: camera.x, y: camera.y, scale: camera.scale }); if (cameraStack.length > 20) cameraStack.shift();
        renderTree(); focusNode(id);
    } else { selectedNodeId = null; updateActionsBar(); renderTree(); }
}
function findElWithDataset(el, key) { const svg = document.getElementById('treeSvg'); while (el && el !== svg) { if (el.dataset && el.dataset[key] !== undefined) return el; el = el.parentNode; } return null; }
function findNodeEl(el) { const svg = document.getElementById('treeSvg'); while (el && el !== svg) { if (el.dataset && el.dataset.nodeId) return el; el = el.parentNode; } return null; }

function updateActionsBar() {
    const bar = document.getElementById('treeActions'); if (!bar) return;
    const btnBranch = document.getElementById('treeActionAddBranch'), 
          btnGoal = document.getElementById('treeActionAddGoal'), 
          btnEdit = document.getElementById('treeActionEdit'), 
          btnDel = document.getElementById('treeActionDelete');
    
    if (!selectedNodeId) { 
        bar.classList.remove('visible');
        btnBranch.textContent = '+ Дерево'; 
        btnBranch.style.display = 'flex'; 
        return; 
    }
    const n = treeNodesById[selectedNodeId]; 
    if (!n) { bar.classList.remove('visible'); return; }
    
    bar.classList.add('visible'); 
    btnBranch.textContent = '+ Ветка';
    btnBranch.style.display = (n.type === 'root' || n.type === 'area') ? 'flex' : 'none'; 
    btnGoal.style.display = (n.type === 'area') ? 'flex' : 'none';
    btnEdit.style.display = (n.type !== 'root') ? 'flex' : 'none'; 
    btnDel.style.display = (n.type !== 'root') ? 'flex' : 'none';
}
function updateBreadcrumb() {
    const el = document.getElementById('treeBreadcrumb'); 
    if (!el || !treeRoot) return;
    
    let path = [];
    if (!selectedNodeId || !treeNodesById[selectedNodeId]) {
        path = [treeRoot]; // Всегда показываем "МОИ ЦЕЛИ"
    } else {
        let n = treeNodesById[selectedNodeId];
        while (n) { 
            path.unshift(n); 
            if (n.type === 'root') break; 
            if (n.type === 'area' && n.parentAreaId) n = treeNodesById['a:' + n.parentAreaId]; 
            else if (n.type === 'goal' && n.areaId) n = treeNodesById['a:' + n.areaId]; 
            else n = treeRoot; 
        }
    }
    
    const crumbsHtml = path.map((n, i) => {
        const isLast = i === path.length - 1;
        return `<button class="tree-crumb ${isLast ? 'last' : ''}" onclick="selectCrumb('${n.id}')">${escapeSvg(n.name)}</button>` + 
               (isLast ? '' : `<span class="tree-crumb-sep">›</span>`);
    }).join('');
    
    el.innerHTML = `
        <div class="tree-breadcrumb-path">${crumbsHtml}</div>
        <button class="tree-breadcrumb-export" onclick="exportTreeImage()" title="Экспорт PNG">⬇</button>
    `;
}

// Вспомогательная функция для клика по крошке
function selectCrumb(nodeId) {
    selectedNodeId = nodeId;
    renderTree();
    focusNode(nodeId, true);
}

async function toggleGoalDone(goalId, isDone) { try { await api(`/api/disc/goals/${goalId}`, 'PATCH', { status: isDone ? 'plan' : 'done' }); await loadAreas(); } catch (e) { alert('Ошибка: ' + e.message); } }
function treeAddBranch() { const n = selectedNodeId ? treeNodesById[selectedNodeId] : null; openAreaModal(null, (n && n.type === 'area') ? n.rawId : null); }
function treeAddGoal() { if (!selectedNodeId) return; const n = treeNodesById[selectedNodeId]; if (n && n.type === 'area') openGoalModal(null, n.rawId); }
function treeEdit() { if (!selectedNodeId) return; const n = treeNodesById[selectedNodeId]; if (n && n.type === 'area') openAreaModal(n.rawId); else if (n && n.type === 'goal') openGoalModal(n.rawId, n.areaId); }
function treeDelete() {
    if (!selectedNodeId) return; const n = treeNodesById[selectedNodeId];
    if (n.type === 'area') { if (!confirm(`Удалить ветку «${n.name}»?`)) return; api(`/api/disc/areas/${n.rawId}`, 'DELETE').then(() => { selectedNodeId = null; loadAreas(); }); }
    else if (n.type === 'goal') { if (!confirm(`Удалить цель «${n.name}»?`)) return; api(`/api/disc/goals/${n.rawId}`, 'DELETE').then(() => { selectedNodeId = null; loadAreas(); }); }
}

let areaCtx = { id: null, parentId: null };
function openAreaModal(id = null, parentId = null) {
    areaCtx = { id, parentId }; const titleEl = document.getElementById('areaModalTitle'), nameEl = document.getElementById('areaName'), delBtn = document.getElementById('areaDeleteBtn'), parentSel = document.getElementById('areaParentSelect');
    const excludeIds = new Set(); if (id) { excludeIds.add(id); let added = true; while (added) { added = false; areasFlat.forEach(a => { if (a.parent_id && excludeIds.has(a.parent_id) && !excludeIds.has(a.id)) { excludeIds.add(a.id); added = true; } }); } }
    parentSel.innerHTML = `<option value="">— Верхний уровень —</option>` + areasFlat.filter(a => !excludeIds.has(a.id)).map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    if (id) { const a = areasFlat.find(x => x.id === id); if (a) { titleEl.textContent = 'Редактировать ветку'; nameEl.value = a.name; parentSel.value = a.parent_id || ''; } delBtn.style.display = 'block'; }
    else { titleEl.textContent = parentId ? 'Новая подветка' : 'Новая ветка'; nameEl.value = ''; parentSel.value = parentId || ''; delBtn.style.display = 'none'; }
    openModal('areaModal'); setTimeout(() => nameEl.focus(), 200);
}
function closeAreaModal() { closeModal('areaModal'); }
async function saveArea() {
    const name = document.getElementById('areaName').value.trim(); if (!name) return alert('Введи название');
    const parentVal = document.getElementById('areaParentSelect').value; const payload = { name, parent_id: parentVal ? parseInt(parentVal) : null };
    try { if (areaCtx.id) await api(`/api/disc/areas/${areaCtx.id}`, 'PATCH', payload); else await api('/api/disc/areas', 'POST', payload); closeAreaModal(); await loadAreas(); } catch (e) { alert('Ошибка: ' + e.message); }
}
async function deleteAreaFromModal() { if (!areaCtx.id || !confirm('Удалить ветку?')) return; await api(`/api/disc/areas/${areaCtx.id}`, 'DELETE'); closeAreaModal(); selectedNodeId = null; await loadAreas(); }

let goalCtx = { id: null, areaId: null };
function openGoalModal(id = null, areaId = null) {
    goalCtx = { id, areaId }; const titleEl = document.getElementById('goalModalTitle'), nameEl = document.getElementById('goalName'), delBtn = document.getElementById('goalDeleteBtn'), areaSel = document.getElementById('goalAreaSelect');
    areaSel.innerHTML = `<option value="">— Без ветки —</option>` + areasFlat.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    if (id) { const g = goalsFlat.find(x => x.id === id); if (g) { titleEl.textContent = 'Редактировать цель'; nameEl.value = g.name; areaSel.value = g.area_id || ''; } delBtn.style.display = 'block'; }
    else { titleEl.textContent = 'Новая цель'; nameEl.value = ''; areaSel.value = areaId || ''; delBtn.style.display = 'none'; }
    openModal('goalModal'); setTimeout(() => nameEl.focus(), 200);
}
function closeGoalModal() { closeModal('goalModal'); }
async function saveGoal() {
    const name = document.getElementById('goalName').value.trim(); if (!name) return alert('Введи название');
    const areaVal = document.getElementById('goalAreaSelect').value; const payload = { name, area_id: areaVal ? parseInt(areaVal) : null };
    try { if (goalCtx.id) await api(`/api/disc/goals/${goalCtx.id}`, 'PATCH', payload); else await api('/api/disc/goals', 'POST', payload); closeGoalModal(); await loadAreas(); } catch (e) { alert('Ошибка: ' + e.message); }
}
async function deleteGoalFromModal() { if (!goalCtx.id || !confirm('Удалить цель?')) return; await api(`/api/disc/goals/${goalCtx.id}`, 'DELETE'); closeGoalModal(); selectedNodeId = null; await loadAreas(); }

function wrapText(text, maxChars, maxLines = 3) {
    const words = String(text || '').split(/\s+/).filter(Boolean); if (!words.length) return [''];
    const lines = []; let cur = '';
    for (const w of words) { const cand = cur ? cur + ' ' + w : w; if (cand.length <= maxChars) { cur = cand; continue; } if (cur) lines.push(cur); cur = w; while (cur.length > maxChars) { lines.push(cur.slice(0, maxChars)); cur = cur.slice(maxChars); } }
    if (cur) lines.push(cur); if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxChars - 1) + '…'; } return lines;
}
function escapeSvg(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function truncateName(s, maxChars) { s = String(s || ''); return s.length <= maxChars ? s : s.slice(0, maxChars - 1) + '…'; }

document.addEventListener('DOMContentLoaded', () => { setTimeout(initTreePointer, 100); });

const _origSwitchSubTab = window.switchSubTab;
window.switchSubTab = function(parent, tab, btn) {
    if (typeof _origSwitchSubTab === 'function') _origSwitchSubTab(parent, tab, btn);
    if (parent === 'discipline' && tab === 'goals') {
        setTimeout(() => {
            initTreePointer(); renderTree();
            if (!selectedNodeId) { selectedNodeId = 'root'; updateBreadcrumb(); updateActionsBar(); }
            fitTree();
        }, 80);
    }
};

function exportTreeImage() {
    const svg = document.getElementById('treeSvg');
    if (!svg) return;
    
    // Клонируем дерево
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Считаем размеры
    const bbox = computeTreeBBox();
    const padding = 20;
    const width = bbox.w + padding * 2;
    const height = bbox.h + padding * 2;
    
    clone.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
    clone.setAttribute('width', width);
    clone.setAttribute('height', height);
    
    // Вшиваем стили, чтобы картинка не была черной/пустой
    const style = document.createElement('style');
    style.textContent = `
        .tn-rect { fill: #232321; stroke: #444; }
        .tn-name { fill: #F3F0ED; font-family: sans-serif; font-size: 13px; font-weight: 600; }
        .tn-sub { fill: #98989f; font-family: sans-serif; font-size: 10px; }
        .tree-edge { stroke: #444; stroke-width: 1.5; fill: none; }
        .tn-goal-name { fill: #F3F0ED; font-family: sans-serif; font-size: 11px; }
        .tn-goal-row.done .tn-goal-name { fill: #98989f; text-decoration: line-through; }
        .tn-goal-check { fill: transparent; stroke: #98989f; stroke-width: 1.4; }
        .tn-goal-check.done { fill: #32d74b; stroke: #32d74b; }
        .tn-goal-check-mark { fill: none; stroke: white; stroke-width: 1.8; display: none; }
        .tn-goal-row.done .tn-goal-check-mark { display: block; }
    `;
    clone.prepend(style);

    // Конвертируем SVG в картинку и скачиваем
    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        
        // Темный фон
        context.fillStyle = '#141413';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.drawImage(image, 0, 0);
        URL.revokeObjectURL(blobURL);
        
        const png = canvas.toDataURL('image/png');
        
        // Скачивание файла
        const a = document.createElement('a');
        a.href = png;
        a.download = 'goals-tree.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    image.src = blobURL;
}