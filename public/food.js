// ==========================================
// ===== FOOD =====
// ==========================================
let foodGoals = null;
let foodProducts = [];
let foodCategories = [];
let foodRecipes = [];
let foodDiaryDate = localDate(new Date());
let foodDiaryEntries = [];
let foodShoppingItems = [];

let foodGoalCtx = { gender: 'male', goal: 'maintain' };
let foodCategoryCtx = { id: null };
let foodProductCtx = { id: null, unit: 'г' };
let foodRecipeCtx = { id: null, categoryId: null };
let foodIngredientProductId = null;
let foodPickerTarget = null; // { mealName } — в какой приём добавляем
let foodRecipePickerCtx = { id: null };

// ==========================================
// ЗАГРУЗКА ДАННЫХ
// ==========================================
async function loadFood() {
    try {
        const [g, p, c, r] = await Promise.all([
            api('/api/food/goals'),
            api('/api/food/products'),
            api('/api/food/categories'),
            api('/api/food/recipes'),
        ]);
        foodGoals = g.goals;
        foodProducts = p.products;
        foodCategories = c.categories;
        foodRecipes = r.recipes;

        // Инициализация дат для шоппинга
        const shopFrom = document.getElementById('shopFrom');
        const shopTo = document.getElementById('shopTo');
        if (!shopFrom.value) {
            shopFrom.value = localDate(new Date());
            const t = new Date(); t.setDate(t.getDate() + 6);
            shopTo.value = localDate(t);
        }

        renderFoodGoalCard();
        renderFoodRecipes();
        loadFoodDiary();
    } catch (e) { console.error(e); }
}

// ==========================================
// ДНЕВНИК
// ==========================================
async function loadFoodDiary() {
    try {
        const { entries } = await api(`/api/food/diary?day=${foodDiaryDate}`);
        foodDiaryEntries = entries;
        renderFoodDiary();
    } catch (e) { console.error(e); }
}

function foodDayPrev() {
    const d = new Date(foodDiaryDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    foodDiaryDate = localDate(d);
    loadFoodDiary();
}
function foodDayNext() {
    const d = new Date(foodDiaryDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    foodDiaryDate = localDate(d);
    loadFoodDiary();
}

function calcFoodNorm() {
    if (!foodGoals || !foodGoals.weight || !foodGoals.height || !foodGoals.age) return null;
    const { gender, weight, height, age, activity, goal, deficit_percent } = foodGoals;
    let bmr = 10 * weight + 6.25 * height - 5 * age;
    bmr += gender === 'female' ? -161 : 5;
    const mult = { sedentary: 1.2, light: 1.375, medium: 1.55, high: 1.725 }[activity] || 1.375;
    let tdee = bmr * mult;
    const d = Number(deficit_percent) || 0;
    if (goal === 'lose') tdee = tdee * (1 - d / 100);
    else if (goal === 'gain') tdee = tdee * (1 + d / 100);
    const kcal = Math.round(tdee);
    let p, f, c;
    if (goal === 'lose') { p = 0.30; f = 0.30; c = 0.40; }
    else if (goal === 'gain') { p = 0.25; f = 0.25; c = 0.50; }
    else { p = 0.25; f = 0.30; c = 0.45; }
    return {
        kcal,
        protein: Math.round(kcal * p / 4),
        fat: Math.round(kcal * f / 9),
        carbs: Math.round(kcal * c / 4),
    };
}

function renderFoodGoalCard() {
    const c = document.getElementById('foodGoalCard');
    const norm = calcFoodNorm();
    if (!norm) {
        c.innerHTML = `<div class="widget" onclick="openFoodGoalModal()" style="cursor:pointer;">
            <div class="widget-title"><span>Профиль</span><span class="widget-title-count">→</span></div>
            <div class="widget-empty">Нажми, чтобы заполнить параметры и получить норму КБЖУ</div>
        </div>`;
        return;
    }

    const kcal = foodDiaryEntries.reduce((s, e) => s + Number(e.kcal || 0), 0);
    const p = foodDiaryEntries.reduce((s, e) => s + Number(e.protein || 0), 0);
    const f = foodDiaryEntries.reduce((s, e) => s + Number(e.fat || 0), 0);
    const cc = foodDiaryEntries.reduce((s, e) => s + Number(e.carbs || 0), 0);
    const pct = norm.kcal ? Math.min(100, Math.round(kcal / norm.kcal * 100)) : 0;

    c.innerHTML = `<div class="widget food-goal-card" onclick="openFoodGoalModal()">
        <div class="widget-title"><span>Профиль</span><span class="widget-title-count">норма ${norm.kcal} ккал</span></div>
        <div class="food-progress-bar"><div class="food-progress-fill" style="width:${pct}%"></div></div>
        <div class="food-goal-body">
            <div class="food-macros-row">
                <div class="food-macro"><div class="food-macro-val">${Math.round(kcal)}</div><div class="food-macro-lbl">Ккал / ${norm.kcal}</div></div>
                <div class="food-macro"><div class="food-macro-val">${Math.round(p)}</div><div class="food-macro-lbl">Б / ${norm.protein}</div></div>
                <div class="food-macro"><div class="food-macro-val">${Math.round(f)}</div><div class="food-macro-lbl">Ж / ${norm.fat}</div></div>
                <div class="food-macro"><div class="food-macro-val">${Math.round(cc)}</div><div class="food-macro-lbl">У / ${norm.carbs}</div></div>
            </div>
            <button class="food-report-fab" onclick="event.stopPropagation(); openFoodReport()">📊 Отчёт</button>
        </div>
    </div>`;
}

function renderFoodDiary() {
    const d = new Date(foodDiaryDate + 'T12:00:00');
    const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    const todayStr = localDate(new Date());
    const label = foodDiaryDate === todayStr ? 'Сегодня' : `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
    document.getElementById('foodDayLabel').textContent = label;
    document.getElementById('foodDayPicker').value = foodDiaryDate;

    // Группируем по приёмам
    const meals = {};
    foodDiaryEntries.forEach(e => { (meals[e.meal_name] ||= []).push(e); });

    const list = document.getElementById('foodMealsList');
    const mealNames = Object.keys(meals);

    if (!mealNames.length) {
        list.innerHTML = `<div class="widget-empty" style="margin:8px 4px;">Нет приёмов. Нажми «+ Добавить приём»</div>`;
    } else {
        list.innerHTML = mealNames.map(name => {
            const items = meals[name];
            const kcal = items.reduce((s, e) => s + Number(e.kcal || 0), 0);
            return `<div class="food-meal-card">
                <div class="food-meal-header">
                    <div class="food-meal-name">${escapeHtml(name)}</div>
                    <div class="food-meal-kcal">${Math.round(kcal)} ккал</div>
                </div>
                <div class="food-meal-items">
                    ${items.map(e => `<div class="food-meal-item">
                        <div class="food-meal-item-info">
                            <div class="food-meal-item-name">${escapeHtml(e.displayName || '—')}</div>
                            ${e.displayUnit ? `<div class="food-meal-item-unit">${escapeHtml(e.displayUnit)}</div>` : ''}
                        </div>
                        <div class="food-meal-item-kcal">${Math.round(e.kcal)}</div>
                        <button class="food-meal-item-del" onclick="deleteFoodDiaryEntry(${e.id})">✕</button>
                    </div>`).join('')}
                </div>
                <button class="food-meal-add" onclick="openAddItemModal('${escapeHtml(name).replace(/'/g, "\\'")}')">+ Блюдо</button>
            </div>`;
        }).join('');
    }

    // Итог дня
    const kcal = foodDiaryEntries.reduce((s, e) => s + Number(e.kcal || 0), 0);
    const p = foodDiaryEntries.reduce((s, e) => s + Number(e.protein || 0), 0);
    const f = foodDiaryEntries.reduce((s, e) => s + Number(e.fat || 0), 0);
    const cc = foodDiaryEntries.reduce((s, e) => s + Number(e.carbs || 0), 0);
    document.getElementById('foodDayTotals').innerHTML = `
        <div class="food-day-totals">
            <div class="cash-total">Итого: <b>${Math.round(kcal)} ккал</b> · Б ${Math.round(p)} / Ж ${Math.round(f)} / У ${Math.round(cc)}</div>
        </div>`;

    renderFoodGoalCard();
}

async function deleteFoodDiaryEntry(id) {
    if (!confirm('Удалить?')) return;
    await api(`/api/food/diary/${id}`, 'DELETE');
    loadFoodDiary();
}

// ==========================================
// ПРИЁМЫ ПИЩИ
// ==========================================
function openMealNameModal() {
    document.getElementById('foodMealName').value = '';
    openModal('foodMealNameModal');
    setTimeout(() => document.getElementById('foodMealName').focus(), 200);
}

async function saveMealName() {
    const name = document.getElementById('foodMealName').value.trim();
    if (!name) return alert('Введи название');
    // Пустой приём не создаём в базе — просто запомним и откроем выбор блюда
    closeModal('foodMealNameModal');
    openAddItemModal(name);
}

function openAddItemModal(mealName) {
    foodPickerTarget = { mealName };
    openModal('foodAddItemModal');
}

// ==========================================
// РЕЦЕПТЫ
// ==========================================
function renderFoodRecipes() {
    const c = document.getElementById('foodRecipesList');
    const all = [...foodCategories, { id: null, name: 'Без категории' }];

    c.innerHTML = all.map(cat => {
        const isOrphan = !cat.id;
        const list = foodRecipes.filter(r => (cat.id ? r.category_id === cat.id : !r.category_id));
        const key = isOrphan ? 0 : cat.id;
        const isOpen = !isCollapsed('foodCategories', key);

        const header = isOrphan
            ? `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('foodCategories', 0); renderFoodRecipes();">▶</span>
                <div class="group-name">Без категории</div>
                <div class="group-count">${list.length}</div>
                <button class="btn-icon-add" onclick="openFoodRecipeModal(null, null)">+</button>
            </div>`
            : `<div class="group-header">
                <span class="group-arrow" onclick="event.stopPropagation(); toggleCollapse('foodCategories', ${cat.id}); renderFoodRecipes();">▶</span>
                <div class="group-name clickable" onclick="openFoodCategoryModal(${cat.id})">${escapeHtml(cat.name)}</div>
                <div class="group-count">${list.length}</div>
                <button class="btn-icon-add" onclick="openFoodRecipeModal(null, ${cat.id})">+</button>
            </div>`;

        const body = isOpen
            ? (list.length === 0
                ? `<div class="widget-empty">Пусто</div>`
                : list.map(r => `<div class="list-item" onclick="openFoodRecipeModal(${r.id})">
                    <div class="item-info">
                        <div class="item-title">${escapeHtml(r.name)}</div>
                        <div class="item-sub">${r.perPortion.kcal} ккал/порц · Б ${r.perPortion.protein} / Ж ${r.perPortion.fat} / У ${r.perPortion.carbs}</div>
                    </div>
                </div>`).join(''))
            : '';

        return `<div class="group-card ${isOpen ? 'open' : ''}" ${cat.id ? `data-id="${cat.id}"` : ''}>
            ${header}
            <div class="group-body">${body}</div>
        </div>`;
    }).join('');
}

// ---------- Категории ----------
function openFoodCategoryModal(id = null) {
    foodCategoryCtx = { id };
    const title = document.getElementById('foodCategoryTitle');
    const nameEl = document.getElementById('foodCategoryName');
    const delBtn = document.getElementById('foodCategoryDeleteBtn');
    if (id) {
        const cat = foodCategories.find(c => c.id === id);
        if (cat) { title.textContent = 'Категория'; nameEl.value = cat.name; }
        delBtn.style.display = 'block';
    } else {
        title.textContent = 'Новая категория';
        nameEl.value = '';
        delBtn.style.display = 'none';
    }
    openModal('foodCategoryModal');
    setTimeout(() => nameEl.focus(), 200);
}

async function saveFoodCategory() {
    const name = document.getElementById('foodCategoryName').value.trim();
    if (!name) return alert('Введи название');
    try {
        if (foodCategoryCtx.id) await api(`/api/food/categories/${foodCategoryCtx.id}`, 'PATCH', { name });
        else await api('/api/food/categories', 'POST', { name });
        closeModal('foodCategoryModal');
        await loadFood();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteFoodCategoryFromModal() {
    if (!foodCategoryCtx.id) return;
    if (!confirm('Удалить категорию? Рецепты останутся без категории.')) return;
    await api(`/api/food/categories/${foodCategoryCtx.id}`, 'DELETE');
    closeModal('foodCategoryModal');
    await loadFood();
}

// ---------- Продукты ----------
function openProductsListModal() {
    renderProductsList();
    openModal('foodProductsListModal');
}

function renderProductsList() {
    const c = document.getElementById('foodProductsList');
    if (!foodProducts.length) {
        c.innerHTML = `<div class="widget-empty">Нет продуктов. Нажми «+ Новый продукт»</div>`;
        return;
    }
    c.innerHTML = foodProducts.map(p => `<div class="list-item" onclick="closeModal('foodProductsListModal'); openFoodProductModal(${p.id})">
        <div class="item-info">
            <div class="item-title">${escapeHtml(p.name)}</div>
            <div class="item-sub">${p.kcal} ккал / 100 ${p.unit}${p.price ? ' · ' + p.price + ' ₽ за ' + (p.price_amount || 100) + ' ' + p.unit : ''}</div>
        </div>
    </div>`).join('');
}

function openFoodProductModal(id = null) {
    foodProductCtx = { id, unit: 'г' };
    const title = document.getElementById('foodProductTitle');
    const nameEl = document.getElementById('foodProductName');
    const delBtn = document.getElementById('foodProductDeleteBtn');
    const fields = ['foodProductKcal','foodProductProtein','foodProductFat','foodProductCarbs','foodProductPrice','foodProductPriceAmount'];

    if (id) {
        const p = foodProducts.find(x => x.id === id);
        if (p) {
            title.textContent = 'Продукт';
            nameEl.value = p.name;
            foodProductCtx.unit = p.unit || 'г';
            document.getElementById('foodProductKcal').value = p.kcal;
            document.getElementById('foodProductProtein').value = p.protein;
            document.getElementById('foodProductFat').value = p.fat;
            document.getElementById('foodProductCarbs').value = p.carbs;
            document.getElementById('foodProductPrice').value = p.price;
            document.getElementById('foodProductPriceAmount').value = p.price_amount || 100;
        }
        delBtn.style.display = 'block';
    } else {
        title.textContent = 'Новый продукт';
        nameEl.value = '';
        fields.forEach(f => document.getElementById(f).value = '');
        document.getElementById('foodProductPriceAmount').value = 100;
        delBtn.style.display = 'none';
    }
    document.querySelectorAll('#foodProductUnit [data-v]').forEach(b =>
        b.classList.toggle('active', b.dataset.v === foodProductCtx.unit));
    updateFoodPriceUnitLabel();
    openModal('foodProductModal');
    setTimeout(() => nameEl.focus(), 200);
}

function updateFoodPriceUnitLabel() {
    const lbl = document.getElementById('foodPriceUnitLabel');
    if (lbl) lbl.textContent = foodProductCtx.unit;
}

function pickFoodUnit(v, btn) {
    foodProductCtx.unit = v;
    document.querySelectorAll('#foodProductUnit [data-v]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateFoodPriceUnitLabel();
}

async function saveFoodProduct() {
    const name = document.getElementById('foodProductName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        name,
        unit: foodProductCtx.unit,
        kcal: document.getElementById('foodProductKcal').value,
        protein: document.getElementById('foodProductProtein').value,
        fat: document.getElementById('foodProductFat').value,
        carbs: document.getElementById('foodProductCarbs').value,
        price: document.getElementById('foodProductPrice').value,
        price_amount: document.getElementById('foodProductPriceAmount').value,
    };
    try {
        let created = null;
        if (foodProductCtx.id) {
            await api(`/api/food/products/${foodProductCtx.id}`, 'PATCH', payload);
        } else {
            const r = await api('/api/food/products', 'POST', payload);
            created = r.product;
        }
        closeModal('foodProductModal');
        const { products } = await api('/api/food/products');
        foodProducts = products;
        if (document.getElementById('foodProductsListModal').classList.contains('open')) renderProductsList();
        if (document.getElementById('foodIngredientModal').classList.contains('open')) {
            renderIngredientProducts();
            if (created) foodIngredientProductId = created.id;
        }
        if (foodRecipeCtx.id) await reloadRecipeIngredients();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteFoodProductFromModal() {
    if (!foodProductCtx.id) return;
    if (!confirm('Удалить продукт? Он исчезнет из всех рецептов.')) return;
    await api(`/api/food/products/${foodProductCtx.id}`, 'DELETE');
    closeModal('foodProductModal');
    const { products } = await api('/api/food/products');
    foodProducts = products;
    renderProductsList();
    if (foodRecipeCtx.id) await reloadRecipeIngredients();
}

// ---------- Рецепты ----------
function openFoodRecipeModal(id = null, categoryId = null) {
    foodRecipeCtx = { id, categoryId };
    const title = document.getElementById('foodRecipeTitle');
    const nameEl = document.getElementById('foodRecipeName');
    const delBtn = document.getElementById('foodRecipeDeleteBtn');
    const catSel = document.getElementById('foodRecipeCategory');
    catSel.innerHTML = `<option value="">Без категории</option>` +
        foodCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    if (id) {
        const r = foodRecipes.find(x => x.id === id);
        if (r) {
            title.textContent = 'Рецепт';
            nameEl.value = r.name;
            catSel.value = r.category_id || '';
            document.getElementById('foodRecipePortions').value = r.portions || 1;
            document.getElementById('foodRecipeInstructions').value = r.instructions || '';
            document.getElementById('foodRecipeNotes').value = r.notes || '';
        }
        delBtn.style.display = 'block';
    } else {
        title.textContent = 'Новый рецепт';
        nameEl.value = '';
        catSel.value = categoryId || '';
        document.getElementById('foodRecipePortions').value = 1;
        document.getElementById('foodRecipeInstructions').value = '';
        document.getElementById('foodRecipeNotes').value = '';
        delBtn.style.display = 'none';
    }
    renderRecipeIngredients();
    openModal('foodRecipeModal');
    setTimeout(() => nameEl.focus(), 200);
}

function renderRecipeIngredients() {
    const c = document.getElementById('foodRecipeIngredients');
    if (!foodRecipeCtx.id) {
        c.innerHTML = `<div class="widget-empty" style="padding:4px 0;">Сохрани рецепт, чтобы добавить ингредиенты</div>`;
        return;
    }
    const r = foodRecipes.find(x => x.id === foodRecipeCtx.id);
    if (!r || !r.ingredients?.length) {
        c.innerHTML = `<div class="widget-empty" style="padding:4px 0;">Нет ингредиентов</div>`;
        return;
    }
    c.innerHTML = r.ingredients.map(ing => `<div class="list-item" style="padding:6px 4px;">
        <div class="item-info">
            <div class="item-title">${escapeHtml(ing.product?.name || '—')}</div>
            <div class="item-sub">${ing.amount} ${ing.product?.unit || ''}</div>
        </div>
        <button class="area-delete" onclick="deleteIngredient(${ing.id})">✕</button>
    </div>`).join('');
}

async function reloadRecipeIngredients() {
    const { recipes } = await api('/api/food/recipes');
    foodRecipes = recipes;
    renderRecipeIngredients();
    renderFoodRecipes();
}

async function saveFoodRecipe() {
    const name = document.getElementById('foodRecipeName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        name,
        category_id: document.getElementById('foodRecipeCategory').value || null,
        portions: document.getElementById('foodRecipePortions').value || 1,
        instructions: document.getElementById('foodRecipeInstructions').value || null,
        notes: document.getElementById('foodRecipeNotes').value || null,
    };
    try {
        if (foodRecipeCtx.id) {
            await api(`/api/food/recipes/${foodRecipeCtx.id}`, 'PATCH', payload);
        } else {
            const r = await api('/api/food/recipes', 'POST', payload);
            foodRecipeCtx.id = r.recipe.id;
        }
        closeModal('foodRecipeModal');
        await loadFood();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteFoodRecipeFromModal() {
    if (!foodRecipeCtx.id) return;
    if (!confirm('Удалить рецепт?')) return;
    await api(`/api/food/recipes/${foodRecipeCtx.id}`, 'DELETE');
    closeModal('foodRecipeModal');
    await loadFood();
}

// ---------- Ингредиенты рецепта ----------
function openIngredientModal() {
    if (!foodRecipeCtx.id) return alert('Сначала сохрани рецепт');
    foodIngredientProductId = null;
    document.getElementById('foodIngredientSearch').value = '';
    document.getElementById('foodIngredientAmount').value = '';
    renderIngredientProducts();
    openModal('foodIngredientModal');
}

function renderIngredientProducts() {
    const c = document.getElementById('foodIngredientProducts');
    const q = document.getElementById('foodIngredientSearch').value.trim().toLowerCase();
    const list = foodProducts.filter(p => !q || p.name.toLowerCase().includes(q));
    if (!list.length) {
        c.innerHTML = `<div class="widget-empty">Нет продуктов</div>`;
        return;
    }
    c.innerHTML = list.map(p => `<div class="food-picker-item ${foodIngredientProductId === p.id ? 'active' : ''}" onclick="pickIngredientProduct(${p.id})">
        <div class="food-picker-name">${escapeHtml(p.name)}</div>
        <div class="food-picker-meta">${p.kcal} ккал / 100 ${p.unit}</div>
    </div>`).join('');
}

function filterIngredientProducts() { renderIngredientProducts(); }

function pickIngredientProduct(id) {
    foodIngredientProductId = id;
    renderIngredientProducts();
}

async function saveIngredient() {
    if (!foodIngredientProductId) return alert('Выбери продукт');
    const amount = document.getElementById('foodIngredientAmount').value;
    if (!amount) return alert('Введи количество');
    try {
        await api(`/api/food/recipes/${foodRecipeCtx.id}/ingredients`, 'POST', {
            product_id: foodIngredientProductId,
            amount,
        });
        closeModal('foodIngredientModal');
        await reloadRecipeIngredients();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

async function deleteIngredient(id) {
    if (!confirm('Удалить ингредиент?')) return;
    await api(`/api/food/ingredients/${id}`, 'DELETE');
    await reloadRecipeIngredients();
}

// ==========================================
// ДОБАВЛЕНИЕ В ДНЕВНИК
// ==========================================
function pickRecipeForDiary() {
    closeModal('foodAddItemModal');
    document.getElementById('foodRecipePickerSearch').value = '';
    document.getElementById('foodRecipePickerPortions').value = 1;
    foodRecipePickerCtx = { id: null };
    renderRecipePicker();
    openModal('foodRecipePickerModal');
}

function renderRecipePicker() {
    const c = document.getElementById('foodRecipePickerList');
    const q = document.getElementById('foodRecipePickerSearch').value.trim().toLowerCase();
    const list = foodRecipes.filter(r => !q || r.name.toLowerCase().includes(q));
    if (!list.length) {
        c.innerHTML = `<div class="widget-empty">Нет рецептов</div>`;
        return;
    }
    c.innerHTML = list.map(r => `<div class="food-picker-item ${foodRecipePickerCtx.id === r.id ? 'active' : ''}" onclick="pickRecipeForDiaryConfirm(${r.id})">
        <div class="food-picker-name">${escapeHtml(r.name)}</div>
        <div class="food-picker-meta">${r.perPortion.kcal} ккал/порц</div>
    </div>`).join('');
}

function filterRecipePicker() { renderRecipePicker(); }

function pickRecipeForDiaryConfirm(id) {
    foodRecipePickerCtx.id = id;
    renderRecipePicker();
}

async function confirmRecipePicker() {
    if (!foodRecipePickerCtx.id) return alert('Выбери рецепт');
    const recipe = foodRecipes.find(r => r.id === foodRecipePickerCtx.id);
    if (!recipe) return;
    const portions = Number(document.getElementById('foodRecipePickerPortions').value) || 1;
    const payload = {
        day: foodDiaryDate,
        meal_name: foodPickerTarget.mealName,
        source: 'recipe',
        recipe_id: recipe.id,
        amount: portions,
        kcal: recipe.perPortion.kcal * portions,
        protein: recipe.perPortion.protein * portions,
        fat: recipe.perPortion.fat * portions,
        carbs: recipe.perPortion.carbs * portions,
    };
    try {
        await api('/api/food/diary', 'POST', payload);
        closeModal('foodRecipePickerModal');
        loadFoodDiary();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ---------- Продукт для дневника ----------
function pickProductForDiary() {
    closeModal('foodAddItemModal');
    document.getElementById('foodProductPickerSearch').value = '';
    document.getElementById('foodProductPickerAmount').value = '';
    foodPickerTarget.productId = null;
    renderProductPicker();
    openModal('foodProductPickerModal');
}

let foodProductPickerSelected = null;

function renderProductPicker() {
    const c = document.getElementById('foodProductPickerList');
    const q = document.getElementById('foodProductPickerSearch').value.trim().toLowerCase();
    const list = foodProducts.filter(p => !q || p.name.toLowerCase().includes(q));
    if (!list.length) {
        c.innerHTML = `<div class="widget-empty">Нет продуктов</div>`;
        return;
    }
    c.innerHTML = list.map(p => `<div class="food-picker-item ${foodProductPickerSelected === p.id ? 'active' : ''}" onclick="pickProductPicker(${p.id})">
        <div class="food-picker-name">${escapeHtml(p.name)}</div>
        <div class="food-picker-meta">${p.kcal} ккал / 100 ${p.unit}</div>
    </div>`).join('');
}

function filterProductPicker() { renderProductPicker(); }

function pickProductPicker(id) {
    foodProductPickerSelected = id;
    renderProductPicker();
}

async function confirmProductPicker() {
    if (!foodProductPickerSelected) return alert('Выбери продукт');
    const amount = Number(document.getElementById('foodProductPickerAmount').value) || 0;
    if (!amount) return alert('Введи количество');
    const p = foodProducts.find(x => x.id === foodProductPickerSelected);
    if (!p) return;
    const k = p.unit === 'шт' ? amount : amount / 100;
    const payload = {
        day: foodDiaryDate,
        meal_name: foodPickerTarget.mealName,
        source: 'product',
        product_id: p.id,
        amount,
        kcal: Math.round(Number(p.kcal) * k),
        protein: Math.round(Number(p.protein) * k * 10) / 10,
        fat: Math.round(Number(p.fat) * k * 10) / 10,
        carbs: Math.round(Number(p.carbs) * k * 10) / 10,
    };
    try {
        await api('/api/food/diary', 'POST', payload);
        closeModal('foodProductPickerModal');
        loadFoodDiary();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ---------- Разовое ----------
function addOneoffToDiary() {
    closeModal('foodAddItemModal');
    ['foodOneoffName','foodOneoffKcal','foodOneoffProtein','foodOneoffFat','foodOneoffCarbs'].forEach(id => document.getElementById(id).value = '');
    openModal('foodOneoffModal');
    setTimeout(() => document.getElementById('foodOneoffName').focus(), 200);
}

async function saveOneoffToDiary() {
    const name = document.getElementById('foodOneoffName').value.trim();
    if (!name) return alert('Введи название');
    const payload = {
        day: foodDiaryDate,
        meal_name: foodPickerTarget.mealName,
        source: 'oneoff',
        oneoff_name: name,
        kcal: document.getElementById('foodOneoffKcal').value || 0,
        protein: document.getElementById('foodOneoffProtein').value || 0,
        fat: document.getElementById('foodOneoffFat').value || 0,
        carbs: document.getElementById('foodOneoffCarbs').value || 0,
    };
    try {
        await api('/api/food/diary', 'POST', payload);
        closeModal('foodOneoffModal');
        loadFoodDiary();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// ПРОФИЛЬ / ЦЕЛЬ
// ==========================================
function openFoodGoalModal() {
    foodGoalCtx = { gender: 'male', goal: 'maintain' };
    if (foodGoals) {
        foodGoalCtx.gender = foodGoals.gender || 'male';
        foodGoalCtx.goal = foodGoals.goal || 'maintain';
        document.getElementById('foodAge').value = foodGoals.age || '';
        document.getElementById('foodWeight').value = foodGoals.weight || '';
        document.getElementById('foodHeight').value = foodGoals.height || '';
        document.getElementById('foodActivity').value = foodGoals.activity || 'light';
        document.getElementById('foodDeficit').value = foodGoals.deficit_percent || '';
    } else {
        ['foodAge','foodWeight','foodHeight','foodDeficit'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('foodActivity').value = 'light';
    }
    document.querySelectorAll('#foodGender [data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === foodGoalCtx.gender));
    document.querySelectorAll('#foodGoalTabs [data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === foodGoalCtx.goal));
    openModal('foodGoalModal');
}

function pickFoodGender(v, btn) {
    foodGoalCtx.gender = v;
    document.querySelectorAll('#foodGender [data-v]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function pickFoodGoal(v, btn) {
    foodGoalCtx.goal = v;
    document.querySelectorAll('#foodGoalTabs [data-v]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

async function saveFoodGoal() {
    const payload = {
        gender: foodGoalCtx.gender,
        age: document.getElementById('foodAge').value,
        weight: document.getElementById('foodWeight').value,
        height: document.getElementById('foodHeight').value,
        activity: document.getElementById('foodActivity').value,
        goal: foodGoalCtx.goal,
        deficit_percent: document.getElementById('foodDeficit').value,
    };
    try {
        const r = await api('/api/food/goals', 'POST', payload);
        foodGoals = r.goals;
        closeModal('foodGoalModal');
        renderFoodGoalCard();
        loadFoodDiary();
    } catch (e) { alert('Ошибка: ' + e.message); }
}

// ==========================================
// ШОППИНГ
// ==========================================
async function loadShopping() {
    const from = document.getElementById('shopFrom').value;
    const to = document.getElementById('shopTo').value;
    if (!from || !to) return;
    try {
        const { items, total } = await api(`/api/food/shopping?from=${from}&to=${to}`);
        foodShoppingItems = items;
        renderShopping(total);
    } catch (e) { console.error(e); }
}

function renderShopping(total = 0) {
    const c = document.getElementById('foodShoppingList');
    if (!foodShoppingItems.length) {
        c.innerHTML = `<div class="empty-state">Нет данных. Заполни план в дневнике на этот период.</div>`;
        return;
    }
    const checked = JSON.parse(localStorage.getItem('food_shopping_checked') || '{}');
    c.innerHTML = `<div class="widget">
        <div class="widget-title"><span>Список покупок</span></div>
        ${foodShoppingItems.map(it => {
            const key = it.product.id;
            const isChecked = checked[key];
            return `<div class="food-shop-item ${isChecked ? 'checked' : ''}">
                <div class="food-shop-check ${isChecked ? 'done' : ''}" onclick="toggleShopCheck(${key})">✓</div>
                <div class="food-shop-name">${escapeHtml(it.product.name)}</div>
                <div class="food-shop-amount">${it.amount} ${it.product.unit}</div>
                ${it.cost ? `<div class="food-shop-cost">${it.cost.toFixed(0)} ₽</div>` : ''}
            </div>`;
        }).join('')}
        ${total ? `<div class="cash-total" style="margin-top:12px;">Итого: <b>${total.toFixed(0)} ₽</b></div>` : ''}
    </div>
    <button class="budget-row-add" onclick="resetShopChecks()">Сбросить галочки</button>`;
}

function toggleShopCheck(id) {
    const checked = JSON.parse(localStorage.getItem('food_shopping_checked') || '{}');
    checked[id] = !checked[id];
    localStorage.setItem('food_shopping_checked', JSON.stringify(checked));
    renderShopping(foodShoppingItems.reduce((s, x) => s + (x.cost || 0), 0));
}

function resetShopChecks() {
    localStorage.removeItem('food_shopping_checked');
    renderShopping(foodShoppingItems.reduce((s, x) => s + (x.cost || 0), 0));
}

function onFoodDayPicked() {
    const val = document.getElementById('foodDayPicker').value;
    if (val) {
        foodDiaryDate = val;
        loadFoodDiary();
    }
}

// ==========================================
// ОТЧЁТ
// ==========================================
function openFoodReport() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('reportFrom').value = localDate(firstDay);
    document.getElementById('reportTo').value = localDate(now);
    document.getElementById('foodReportBody').innerHTML = '<div class="widget-empty">Загрузка...</div>';
    openModal('foodReportModal');
    loadFoodReport();
}

async function loadFoodReport() {
    const body = document.getElementById('foodReportBody');
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    if (!from || !to) return;

    // Собираем все дни от from до to
    const days = [];
    const d = new Date(from + 'T12:00:00');
    const end = new Date(to + 'T12:00:00');
    while (d <= end) {
        days.push(localDate(d));
        d.setDate(d.getDate() + 1);
    }
    if (days.length > 180) return body.innerHTML = '<div class="widget-empty">Слишком большой период</div>';

    const allEntries = await Promise.all(days.map(day =>
        api(`/api/food/diary?day=${day}`).then(r => ({ day, entries: r.entries })).catch(() => ({ day, entries: [] }))
    ));

    const norm = calcFoodNorm();
    const rows = allEntries.map(({ day, entries }) => {
        const kcal = entries.reduce((s, e) => s + Number(e.kcal || 0), 0);
        const p = entries.reduce((s, e) => s + Number(e.protein || 0), 0);
        const f = entries.reduce((s, e) => s + Number(e.fat || 0), 0);
        const c = entries.reduce((s, e) => s + Number(e.carbs || 0), 0);
        return { day, kcal: Math.round(kcal), p: Math.round(p), f: Math.round(f), c: Math.round(c) };
    });

    const filled = rows.filter(r => r.kcal > 0);
    const avg = filled.length ? {
        kcal: Math.round(filled.reduce((s, r) => s + r.kcal, 0) / filled.length),
        p: Math.round(filled.reduce((s, r) => s + r.p, 0) / filled.length),
        f: Math.round(filled.reduce((s, r) => s + r.f, 0) / filled.length),
        c: Math.round(filled.reduce((s, r) => s + r.c, 0) / filled.length),
    } : { kcal: 0, p: 0, f: 0, c: 0 };

    const todayStr = localDate(new Date());
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

    let html = `<div class="food-report-table-wrap"><table class="food-report-table">
        <thead><tr>
            <th>Дата</th><th>Ккал</th><th>Б</th><th>Ж</th><th>У</th>
        </tr></thead><tbody>`;

    rows.forEach(r => {
        const d = new Date(r.day + 'T12:00:00');
        const lbl = `${d.getDate()} ${months[d.getMonth()]}`;
        const isToday = r.day === todayStr;
        let cls = '';
        if (norm && r.kcal > 0) {
            const diff = r.kcal - norm.kcal;
            if (Math.abs(diff) > norm.kcal * 0.2) cls = 'off';
        }
        html += `<tr class="${isToday ? 'today' : ''} ${cls}">
            <td>${lbl}${isToday ? ' •' : ''}</td>
            <td>${r.kcal || '—'}</td>
            <td>${r.p || '—'}</td>
            <td>${r.f || '—'}</td>
            <td>${r.c || '—'}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;

    if (filled.length) {
        html += `<div class="food-report-avg">
            <div class="food-report-avg-title">Среднее за ${filled.length} из ${rows.length} дней</div>
            <div class="food-report-avg-grid">
                <div><b>${avg.kcal}</b><span>ккал</span></div>
                <div><b>${avg.p}</b><span>Б</span></div>
                <div><b>${avg.f}</b><span>Ж</span></div>
                <div><b>${avg.c}</b><span>У</span></div>
            </div>
        </div>`;
        if (norm) {
            const diff = avg.kcal - norm.kcal;
            const sign = diff > 0 ? '+' : '';
            const pct = Math.round(diff / norm.kcal * 100);
            html += `<div class="food-report-diff">Отклонение от нормы: <b>${sign}${diff} ккал (${sign}${pct}%)</b></div>`;
        }
    } else {
        html += `<div class="widget-empty">Нет данных за период</div>`;
    }

    body.innerHTML = html;
}