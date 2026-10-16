/**
 * Foodsphere Nutritio Intelligence - Budget-Aware Meal Planner
 * UI controller: connects the page to MealPlannerEngine.
 *
 * Plain JavaScript, no frameworks. All numbers shown on screen come from the engine
 * (js/plannerEngine.js) which uses data/foods.js and data/recipes.js.
 */

function initApp() {
  'use strict';

  const E = MealPlannerEngine;
  const SLOTS = E.SLOTS;

  // ------------------------------------------------------------------ state
  const state = {
    timeframe: 'daily',
    pantry: [],            // [{ label, foodId|null }]
    plan: null,            // last engine result (shoppingList is edited in place)
    activeDay: 0,
    loading: false
  };

  const PRESETS = {
    daily: [150, 250, 400, 600],
    weekly: [1000, 1800, 2800, 4500]
  };
  const REF = { calories: 2000, protein: 60, carbs: 280, fat: 60 };   // generic reference day (illustration only)

  // ------------------------------------------------------------------ DOM
  const $ = id => document.getElementById(id);
  const form = $('mealPlannerForm');
  const toggleDaily = $('toggleDaily'), toggleWeekly = $('toggleWeekly');
  const budgetInput = $('budgetInput'), budgetWrapper = $('budgetWrapper');
  const budgetLabelText = $('budgetLabelText'), budgetHint = $('budgetHint'), budgetError = $('budgetError');
  const budgetPresets = $('budgetPresets');
  const ingredientInput = $('ingredientInput'), btnAddIngredient = $('btnAddIngredient');
  const pantryTagsList = $('pantryTagsList'), pantryMessage = $('pantryMessage'), pantryNote = $('pantryNote');
  const quickStaples = $('quickStaples');
  const prefGroup = $('dietPreference'), medicalNote = $('medicalNote');
  const btnGenerate = $('btnGenerate'), btnGenerateLabel = $('btnGenerateLabel'), btnReset = $('btnReset');
  const resultsPanel = $('resultsPanel'), emptyHero = $('emptyHero'), resultsContent = $('resultsContent');
  const statusBox = $('formStatusBox'), statusText = $('formStatusText'), statusIcon = $('formStatusIcon');
  const dayTabs = $('dayTabs'), weekCard = $('weekCard'), weekChart = $('weekChart');
  const mealCards = { breakfast: $('breakfastCard'), lunch: $('lunchCard'), dinner: $('dinnerCard') };
  const shoppingListContainer = $('shoppingListContainer'), shoppingCountBadge = $('shoppingCountBadge'), shoppingSubtitle = $('shoppingSubtitle');
  const alternativesListContainer = $('alternativesListContainer');
  const toastRegion = $('toastRegion');

  let debounceTimer = null;

  // ------------------------------------------------------------------ helpers
  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  const money = n => '৳' + (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = n => '৳' + (Math.round((Number(n) + Number.EPSILON) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const round2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const slotLabel = s => E.SLOT_LABELS[s];
  const qtyText = (q, unit) => unit === 'piece' ? `${q} ${q === 1 ? 'pc' : 'pcs'}` : `${q} ${unit}`;
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const currentPreference = () => (form.querySelector('input[name="preference"]:checked') || { value: 'standard' }).value;

  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'warn' ? ' warn' : '');
    el.textContent = message;
    toastRegion.appendChild(el);
    while (toastRegion.children.length > 3) toastRegion.removeChild(toastRegion.firstChild);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
  }

  // ------------------------------------------------------------------ budget
  function showBudgetError(msg) {
    budgetError.textContent = msg;
    budgetError.hidden = false;
    budgetWrapper.classList.add('invalid');
    budgetInput.setAttribute('aria-invalid', 'true');
  }
  function clearBudgetError() {
    budgetError.textContent = '';
    budgetError.hidden = true;
    budgetWrapper.classList.remove('invalid');
    budgetInput.removeAttribute('aria-invalid');
  }

  function updateBudgetHint() {
    const weekly = state.timeframe === 'weekly';
    let text = weekly
      ? 'Your spending target for 7 days of breakfast, lunch and dinner.'
      : 'Your spending target for breakfast, lunch and dinner today.';
    const v = E.validateBudget(budgetInput.value, state.timeframe);
    if (weekly && v.valid) text = `${money0(v.value)} per week is about ${money(v.value / 7)} per day for all 3 meals.`;
    budgetHint.textContent = text;
  }

  function renderBudgetPresets() {
    budgetPresets.innerHTML = '';
    PRESETS[state.timeframe].forEach(value => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.value = String(value);
      btn.textContent = money0(value);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        budgetInput.value = String(value);
        clearBudgetError();
        syncPresetPressed();
        updateBudgetHint();
        if (state.plan) runPlan({ quiet: true });
      });
      budgetPresets.appendChild(btn);
    });
    syncPresetPressed();
  }
  function syncPresetPressed() {
    const current = budgetInput.value.trim();
    budgetPresets.querySelectorAll('.chip-btn').forEach(btn =>
      btn.setAttribute('aria-pressed', String(current !== '' && Number(current) === Number(btn.dataset.value))));
  }

  function setTimeframe(mode) {
    state.timeframe = mode;
    const weekly = mode === 'weekly';
    toggleDaily.classList.toggle('active', !weekly);
    toggleWeekly.classList.toggle('active', weekly);
    toggleDaily.setAttribute('aria-pressed', String(!weekly));
    toggleWeekly.setAttribute('aria-pressed', String(weekly));
    budgetLabelText.textContent = weekly ? 'Weekly Budget' : 'Daily Budget';
    budgetInput.placeholder = weekly ? 'e.g. 1800' : 'e.g. 250';
    clearBudgetError();
    renderBudgetPresets();
    updateBudgetHint();
    if (state.plan) runPlan({ quiet: true });
  }

  // ------------------------------------------------------------------ pantry
  function setPantryMessage(text, kind) {
    pantryMessage.textContent = text;
    pantryMessage.style.color = kind === 'warn' ? '#8a5a00' : '';
    pantryMessage.style.fontWeight = kind === 'warn' ? '700' : '';
  }

  /** Adds one pantry entry. Returns 'added' | 'duplicate' | 'empty'. */
  function addPantryEntry(rawLabel) {
    const label = rawLabel.trim().replace(/\s+/g, ' ');
    if (!label) return 'empty';
    const foodId = E.matchPantryItem(label);
    const duplicate = state.pantry.some(p =>
      foodId ? p.foodId === foodId : (!p.foodId && p.label.toLowerCase() === label.toLowerCase()));
    if (duplicate) return 'duplicate';
    state.pantry.push({ label, foodId });
    return 'added';
  }

  function addIngredientsFromInput() {
    const parts = ingredientInput.value.split(/[,\n;]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      setPantryMessage('Please type an ingredient name first, for example "rice".', 'warn');
      ingredientInput.focus();
      return;
    }
    const added = [], dupes = [];
    parts.forEach(p => { const r = addPantryEntry(p); if (r === 'added') added.push(p); else if (r === 'duplicate') dupes.push(p); });
    ingredientInput.value = '';
    renderPantry();
    if (added.length && dupes.length) setPantryMessage(`Added ${added.join(', ')}. Already in your list: ${dupes.join(', ')}.`, 'warn');
    else if (added.length) setPantryMessage(`Added ${added.join(', ')}.`);
    else setPantryMessage(`${dupes.join(', ')} ${dupes.length > 1 ? 'are' : 'is'} already in your list. No duplicate was added.`, 'warn');
    if (dupes.length && !added.length) toast('Already in your list', 'warn');
    if (added.length) { toast(added.length === 1 ? `Added ${added[0]}` : `Added ${added.length} items`); onInputsChanged(); }
    ingredientInput.focus();
  }

  function removePantryAt(index) {
    const [removed] = state.pantry.splice(index, 1);
    renderPantry();
    if (removed) { setPantryMessage(`Removed ${removed.label}.`); toast(`Removed ${removed.label}`); }
    onInputsChanged();
  }

  function toggleStaple(label) {
    const foodId = E.matchPantryItem(label);
    const idx = state.pantry.findIndex(p => p.foodId === foodId);
    if (idx >= 0) { removePantryAt(idx); return; }
    addPantryEntry(label);
    renderPantry();
    setPantryMessage(`Added ${label}.`);
    toast(`Added ${label}`);
    onInputsChanged();
  }

  function renderStaples() {
    quickStaples.innerHTML = BANGLADESHI_FOOD_DATABASE.map(f => {
      const label = `${f.shortName} (${f.bengaliName})`;
      return `<button type="button" class="staple-chip" data-item="${escapeHtml(label)}" data-food="${escapeHtml(f.id)}" aria-pressed="false">+ ${escapeHtml(f.shortName)}</button>`;
    }).join('');
  }

  function renderPantry() {
    pantryTagsList.innerHTML = '';
    state.pantry.forEach((item, index) => {
      const tag = document.createElement('span');
      tag.className = 'tag-item' + (item.foodId ? '' : ' unrecognized');
      if (!item.foodId) tag.title = 'Not in our recipe database, so it will not change the plan.';
      tag.innerHTML = `${escapeHtml(item.label)}<button type="button" class="tag-remove" aria-label="Remove ${escapeHtml(item.label)}">&times;</button>`;
      tag.querySelector('.tag-remove').addEventListener('click', () => removePantryAt(index));
      pantryTagsList.appendChild(tag);
    });
    const have = new Set(state.pantry.map(p => p.foodId).filter(Boolean));
    quickStaples.querySelectorAll('.staple-chip').forEach(chip => {
      const on = have.has(chip.dataset.food);
      chip.setAttribute('aria-pressed', String(on));
      chip.textContent = (on ? '✓ ' : '+ ') + chip.textContent.replace(/^[+✓]\s*/, '');
    });
    const unknown = state.pantry.filter(p => !p.foodId).map(p => p.label);
    pantryNote.hidden = unknown.length === 0;
    pantryNote.textContent = unknown.length
      ? `Not used by the planner (not in our recipes): ${unknown.join(', ')}. Cooking oil, onion, salt and spices are not counted in costs.`
      : '';
  }

  // ------------------------------------------------------------------ plan generation
  function pantryLabels() { return state.pantry.map(p => p.label); }

  function onInputsChanged() { if (state.plan) runPlan({ quiet: true }); }

  /** Validates inputs, builds the plan and renders it. */
  function runPlan(opts) {
    const quiet = Boolean(opts && opts.quiet);
    const v = E.validateBudget(budgetInput.value, state.timeframe);
    if (!v.valid) {
      showBudgetError(v.message);
      showEmpty();
      if (!quiet) budgetInput.focus();
      return false;
    }
    clearBudgetError();

    const plan = E.generateMealPlan({
      budget: budgetInput.value,
      timeframe: state.timeframe,
      pantry: pantryLabels(),
      preference: currentPreference()
    });
    if (!plan.success) { showBudgetError(plan.message); showEmpty(); return false; }

    // Keep "purchased" ticks for items that are still on the new list
    const previous = new Map((state.plan ? state.plan.shoppingList : []).map(i => [i.foodId, i.purchased]));
    plan.shoppingList.forEach(i => { if (previous.get(i.foodId)) i.purchased = true; });

    state.plan = plan;
    if (state.activeDay >= plan.days.length) state.activeDay = 0;
    renderAll(plan, quiet);
    return true;
  }

  function onGenerate() {
    if (state.loading) return;
    const v = E.validateBudget(budgetInput.value, state.timeframe);
    if (!v.valid) { showBudgetError(v.message); showEmpty(); budgetInput.focus(); return; }
    clearBudgetError();
    state.loading = true;
    btnGenerate.disabled = true;
    btnGenerate.classList.add('loading');
    btnGenerateLabel.textContent = 'Planning your meals…';
    resultsPanel.setAttribute('aria-busy', 'true');
    const finish = () => {
      state.activeDay = 0;
      runPlan({ quiet: false });
      state.loading = false;
      btnGenerate.disabled = false;
      btnGenerate.classList.remove('loading');
      btnGenerateLabel.textContent = 'Generate meal plan';
      resultsPanel.setAttribute('aria-busy', 'false');
      if (window.innerWidth <= 1080 && state.plan) resultsPanel.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    };
    if (reducedMotion()) finish(); else setTimeout(finish, 350);
  }

  // ------------------------------------------------------------------ rendering
  function showEmpty() {
    state.plan = null;
    emptyHero.hidden = false;
    resultsContent.hidden = true;
    statusBox.classList.add('hidden');
  }

  function renderAll(plan, quiet) {
    emptyHero.hidden = true;
    resultsContent.hidden = false;
    renderBanner(plan);
    renderDayTabs(plan);
    renderWeekChart(plan);
    renderMeals(plan);
    renderNutrition(plan);
    renderShoppingList();
    renderAlternatives(plan.alternatives);
    refreshSpend();
    if (!quiet) toast(plan.fitsBudget ? 'Meal plan ready' : 'Plan ready: budget is too low', plan.fitsBudget ? undefined : 'warn');
  }

  function renderBanner(plan) {
    const weekly = plan.periodDays > 1;
    const span = weekly ? 'week' : 'day';
    let html;
    if (plan.fitsBudget) {
      html = `<strong>Your ${weekly ? '7-day' : 'daily'} plan is ready.</strong> Estimated cost ${money(plan.totalCost)} of your ${money0(plan.periodBudget)} ${span} budget, leaving ${money(plan.remainingBudget)}.`;
      statusBox.className = 'status-box';
      statusIcon.textContent = '✓';
    } else {
      html = `<strong>Your budget is too low for a full ${span}.</strong> The lowest-cost plan we can build costs ${money(plan.minimumPeriodCost)}, which is ${money(plan.totalCost - plan.periodBudget)} more than your ${money0(plan.periodBudget)} budget. See “Smart alternatives” for realistic options.`;
      statusBox.className = 'status-box warning';
      statusIcon.textContent = '!';
    }
    if (plan.notices.length) html += '<ul>' + plan.notices.map(n => `<li>${escapeHtml(n.text)}</li>`).join('') + '</ul>';
    statusText.innerHTML = html;
    statusBox.classList.remove('hidden');
  }

  function renderDayTabs(plan) {
    const weekly = plan.periodDays > 1;
    dayTabs.hidden = !weekly;
    if (!weekly) { dayTabs.innerHTML = ''; return; }
    dayTabs.innerHTML = plan.days.map((d, i) =>
      `<button type="button" role="tab" class="day-tab" id="tab-day-${i}" data-day="${i}" aria-selected="${i === state.activeDay}" tabindex="${i === state.activeDay ? 0 : -1}">Day ${d.dayNumber}</button>`).join('');
  }

  function selectDay(i, focusTab) {
    if (!state.plan || i < 0 || i >= state.plan.days.length) return;
    state.activeDay = i;
    renderDayTabs(state.plan);
    renderWeekChart(state.plan);
    renderMeals(state.plan);
    renderNutrition(state.plan);
    if (focusTab) { const t = $('tab-day-' + i); if (t) t.focus(); }
  }

  function renderWeekChart(plan) {
    const weekly = plan.periodDays > 1;
    weekCard.hidden = !weekly;
    if (!weekly) return;
    const allowance = plan.dailyTargetBudget;
    const max = Math.max(allowance, ...plan.days.map(d => d.totalOutOfPocket), 1) * 1.12;
    const cols = plan.days.map((d, i) => {
      const h = Math.max(3, (d.totalOutOfPocket / max) * 100);
      const cls = (d.fitsBudget ? '' : ' over') + (i === state.activeDay ? ' active' : '');
      return `<button type="button" class="week-col${cls}" data-day="${i}" aria-label="Day ${d.dayNumber}: ${money(d.totalOutOfPocket)}. Show this day"><span class="bar" style="height:${h}%"></span></button>`;
    }).join('');
    const labels = plan.days.map(d => `<span><b>Day ${d.dayNumber}</b><em>${money0(d.totalOutOfPocket)}</em></span>`).join('');
    weekChart.innerHTML = `<div class="week-plot">${cols}<span class="week-line" style="bottom:${(allowance / max) * 100}%" title="Average daily allowance ${money(allowance)}"></span></div><div class="week-labels">${labels}</div>`;
  }

  function renderMeals(plan) {
    const day = plan.days[state.activeDay] || plan.days[0];
    SLOTS.forEach(slot => renderMealCard(mealCards[slot], day.meals[slot], slot));
  }

  function renderMealCard(card, meal, slot) {
    const free = meal.outOfPocketCost === 0;
    card.className = `card meal-card ${slot}`;
    card.setAttribute('aria-label', `${slotLabel(slot)}: ${meal.name}`);
    card.innerHTML = `
      <div class="meal-banner">
        <span class="meal-type-tag">${slotLabel(slot)}</span>
        <span class="meal-cost-badge${free ? ' free' : ''}">${free ? 'Nothing to buy' : 'Est. ' + money(meal.outOfPocketCost)}</span>
        ${FoodIcons.mealArt(meal)}
      </div>
      <div class="meal-body">
        <h3 class="meal-title">${escapeHtml(meal.name)}</h3>
        <div class="meal-bengali-title">${escapeHtml(meal.bengaliName || '')}</div>
        <p class="meal-desc">${escapeHtml(meal.description)}</p>
        <div class="meal-detail">
          <div>
            <div class="meal-ing-title">Ingredients &amp; quantities</div>
            <ul class="meal-ing-list">
              ${meal.ingredientBreakdown.map(ing => `
                <li>
                  <span class="ing-icon">${FoodIcons.icon(ing.foodId)}</span>
                  <span class="ing-name">${escapeHtml(ing.shortName)}</span>
                  <span class="ing-qty">${escapeHtml(qtyText(ing.quantity, ing.unit))}</span>
                  <span class="ing-status ${ing.isInPantry ? 'home' : 'buy'}">${ing.isInPantry ? 'At home' : money(ing.cost)}</span>
                </li>`).join('')}
            </ul>
          </div>
          <div class="meal-explain">
            <div class="meal-reasons-title">Why this meal?</div>
            ${escapeHtml(meal.explanation)}
            <div class="reason-pills">
              ${meal.recommendationReasons.map(r => `<span class="reason-badge-tag ${escapeHtml(r.type)}" title="${escapeHtml(r.text)}">${escapeHtml(r.badge)}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="meal-footer">
        <div class="macro-tiles" aria-label="Estimated nutrition for this meal">
          <div class="macro-tile"><strong>${meal.nutrition.calories}</strong><span>kcal</span></div>
          <div class="macro-tile"><strong>${meal.nutrition.protein}g</strong><span>Protein</span></div>
          <div class="macro-tile"><strong>${meal.nutrition.carbs}g</strong><span>Carbs</span></div>
          <div class="macro-tile"><strong>${meal.nutrition.fat}g</strong><span>Fat</span></div>
        </div>
        <div class="meal-value">Full recipe value ${money(meal.grossCost)}${free ? '' : ` · you buy ${money(meal.outOfPocketCost)}`}</div>
      </div>`;
  }

  function setBar(id, pct) { $(id).style.width = Math.min(100, Math.max(pct > 0 ? 3 : 0, pct)) + '%'; }

  function renderNutrition(plan) {
    const weekly = plan.periodDays > 1;
    const day = plan.days[state.activeDay] || plan.days[0];
    // Weekly: show the whole-week totals (the summary the user asked for) and note the daily average.
    const nut = plan.totals;
    const days = plan.periodDays;
    $('nutritionTitle').textContent = weekly ? 'Estimated nutrition for the week' : 'Estimated daily nutrition';
    $('nutritionSubtitle').textContent = weekly
      ? `7-day totals of all meals. Average per day: ${Math.round(nut.calories / days)} kcal, ${(nut.protein / days).toFixed(1)} g protein. Selected day (Day ${day.dayNumber}): ${day.nutrition.calories} kcal.`
      : 'Totals of the 3 meals shown above';
    $('valCalories').innerHTML = `${nut.calories.toLocaleString('en-US')} <small>kcal</small>`;
    $('valProtein').innerHTML = `${nut.protein} <small>g</small>`;
    $('valCarbs').innerHTML = `${nut.carbs} <small>g</small>`;
    $('valFat').innerHTML = `${nut.fat} <small>g</small>`;
    const pct = (v, ref) => Math.round((v / (ref * days)) * 100);
    const refText = (v, ref, unit) => `${pct(v, ref)}% of a ${(ref * days).toLocaleString('en-US')} ${unit} reference`;
    setBar('barCalories', (nut.calories / (REF.calories * days)) * 100);
    setBar('barProtein', (nut.protein / (REF.protein * days)) * 100);
    setBar('barCarbs', (nut.carbs / (REF.carbs * days)) * 100);
    setBar('barFat', (nut.fat / (REF.fat * days)) * 100);
    $('refCalories').textContent = refText(nut.calories, REF.calories, 'kcal');
    $('refProtein').textContent = refText(nut.protein, REF.protein, 'g');
    $('refCarbs').textContent = refText(nut.carbs, REF.carbs, 'g');
    $('refFat').textContent = refText(nut.fat, REF.fat, 'g');

    const e = { p: nut.protein * 4, c: nut.carbs * 4, f: nut.fat * 9 };
    const total = e.p + e.c + e.f || 1;
    const share = { p: Math.round((e.p / total) * 100), c: Math.round((e.c / total) * 100) };
    share.f = Math.max(0, 100 - share.p - share.c);
    $('macroBar').innerHTML =
      `<span style="width:${share.p}%;background:#0f766e" title="Protein"></span><span style="width:${share.c}%;background:#d97706" title="Carbohydrates"></span><span style="width:${share.f}%;background:#ea580c" title="Fat"></span>`;
    $('macroLegend').innerHTML =
      `<span><i style="background:#0f766e"></i>Protein ${share.p}%</span><span><i style="background:#d97706"></i>Carbs ${share.c}%</span><span><i style="background:#ea580c"></i>Fat ${share.f}%</span><span style="font-weight:600;color:var(--text-light)">(share of macro energy)</span>`;
  }

  // ------------------------------------------------------------------ shopping list
  function usedForText(item, plan) {
    if (plan.periodDays > 1) return `Used in ${item.usedIn.length} meal${item.usedIn.length > 1 ? 's' : ''} this week`;
    const slots = item.usedIn.map(u => slotLabel(u.slot)).filter((v, i, a) => a.indexOf(v) === i);
    return 'For: ' + slots.join(', ');
  }

  function renderShoppingList() {
    const plan = state.plan;
    if (!plan) return;
    const items = plan.shoppingList;
    shoppingSubtitle.textContent = plan.periodDays > 1 ? 'Everything to buy for the week, combined' : 'Only what is missing from your pantry';

    if (items.length === 0) {
      shoppingCountBadge.textContent = '0 items';
      shoppingListContainer.innerHTML = `
        <div class="empty-list-state">
          <div class="empty-icon">🎉</div>
          <p class="empty-text">Nothing to buy!</p>
          <small class="empty-subtext">Everything for this plan is already at home, so your estimated shopping cost is ৳0.00.</small>
        </div>`;
      return;
    }

    shoppingListContainer.innerHTML = `
      <div class="shopping-toolbar">
        <span class="shopping-progress-pill" id="shopProgressPill"></span>
        <div class="shopping-toolbar-actions">
          <button type="button" class="btn-shop-action" data-action="toggle-all" id="btnToggleAllPurchased"></button>
          <button type="button" class="btn-shop-action" data-action="reset-qty" id="btnResetQuantities">Reset quantities</button>
          <button type="button" class="btn-shop-action" data-action="copy" id="btnCopyList">Copy list</button>
        </div>
      </div>
      <ul class="shop-list" id="shoppingInteractiveTable">
        ${items.map(item => `
          <li class="shop-row" data-food-id="${escapeHtml(item.foodId)}">
            <input type="checkbox" class="shop-check" id="chk-${escapeHtml(item.foodId)}" data-id="${escapeHtml(item.foodId)}" aria-label="Mark ${escapeHtml(item.shortName)} as purchased">
            <span class="shop-icon">${FoodIcons.icon(item.foodId)}</span>
            <label class="shop-info" for="chk-${escapeHtml(item.foodId)}">
              <span class="shop-item-name">${escapeHtml(item.shortName)}</span><br>
              <span class="shop-item-for">${escapeHtml(usedForText(item, plan))}</span>
            </label>
            <span class="shop-cost" id="cost-${escapeHtml(item.foodId)}"></span>
            <div class="qty-control">
              <button type="button" class="btn-qty-step" data-action="dec" data-id="${escapeHtml(item.foodId)}" aria-label="Decrease ${escapeHtml(item.shortName)} quantity">−</button>
              <input type="number" class="qty-input-field" data-id="${escapeHtml(item.foodId)}" min="0" max="100000" step="${item.unitStep}" value="${item.quantity}" aria-label="${escapeHtml(item.shortName)} quantity in ${escapeHtml(item.unit)}">
              <button type="button" class="btn-qty-step" data-action="inc" data-id="${escapeHtml(item.foodId)}" aria-label="Increase ${escapeHtml(item.shortName)} quantity">+</button>
              <span class="qty-unit-label">${escapeHtml(item.unit)}</span>
            </div>
          </li>`).join('')}
      </ul>
      <div class="shop-totals" aria-label="Shopping totals">
        <div class="shop-totals-row"><span>Already bought</span><span id="shopTotalBought">৳0.00</span></div>
        <div class="shop-totals-row"><span>Still to buy</span><span id="shopTotalPending">৳0.00</span></div>
        <div class="shop-totals-row grand"><span>Total estimated shopping cost</span><span id="shoppingGrandTotal">৳0.00 BDT</span></div>
      </div>
      <small class="shopping-hint-note">Tick items as you buy them. Change a quantity with + / − or type a number. Prices are estimates, not live market prices.</small>`;
    updateShoppingUI();
  }

  /** Updates costs, ticks and totals without re-creating the rows (keeps keyboard focus). */
  function updateShoppingUI() {
    const plan = state.plan;
    if (!plan || plan.shoppingList.length === 0) { refreshSpend(); return; }
    const items = plan.shoppingList;
    const totals = E.calculateShoppingListTotals(items);
    items.forEach(item => {
      const row = shoppingListContainer.querySelector(`.shop-row[data-food-id="${item.foodId}"]`);
      if (!row) return;
      row.classList.toggle('is-purchased', Boolean(item.purchased));
      row.querySelector('.shop-check').checked = Boolean(item.purchased);
      row.querySelector('.shop-cost').textContent = money(item.cost);
    });
    const allBought = totals.purchasedCount === totals.totalCount;
    const modified = items.some(i => i.quantity !== i.originalQuantity);
    $('shopProgressPill').textContent = `🛒 ${totals.purchasedCount} of ${totals.totalCount} bought`;
    $('btnToggleAllPurchased').textContent = allBought ? 'Unmark all' : 'Mark all bought';
    $('btnResetQuantities').hidden = !modified;
    $('shopTotalBought').textContent = money(totals.purchasedTotal);
    $('shopTotalPending').textContent = money(totals.pendingTotal);
    $('shoppingGrandTotal').textContent = money(totals.grandTotal) + ' BDT';
    shoppingCountBadge.textContent = `${totals.totalCount} item${totals.totalCount > 1 ? 's' : ''} · ${totals.purchasedCount} bought`;
    refreshSpend();
  }

  function findItem(foodId) { return state.plan && state.plan.shoppingList.find(i => i.foodId === foodId); }

  function setQuantity(item, value) {
    let q = Number(value);
    if (!Number.isFinite(q) || q < 0) q = 0;
    q = Math.min(100000, Math.round((q + Number.EPSILON) * 10) / 10);
    item.quantity = q;
  }

  function onShoppingClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || !state.plan) return;
    const action = btn.dataset.action;
    if (action === 'inc' || action === 'dec') {
      const item = findItem(btn.dataset.id);
      if (!item) return;
      setQuantity(item, item.quantity + (action === 'inc' ? item.unitStep : -item.unitStep));
      const input = shoppingListContainer.querySelector(`.qty-input-field[data-id="${item.foodId}"]`);
      if (input) input.value = item.quantity;
      updateShoppingUI();
    } else if (action === 'toggle-all') {
      const all = state.plan.shoppingList.every(i => i.purchased);
      state.plan.shoppingList.forEach(i => { i.purchased = !all; });
      updateShoppingUI();
    } else if (action === 'reset-qty') {
      state.plan.shoppingList.forEach(i => { i.quantity = i.originalQuantity; });
      shoppingListContainer.querySelectorAll('.qty-input-field').forEach(inp => { const it = findItem(inp.dataset.id); if (it) inp.value = it.quantity; });
      updateShoppingUI();
      toast('Quantities reset');
    } else if (action === 'copy') {
      copyShoppingList();
    }
  }

  function onShoppingChange(e) {
    const t = e.target;
    if (t.classList.contains('shop-check')) {
      const item = findItem(t.dataset.id);
      if (item) { item.purchased = t.checked; updateShoppingUI(); }
    } else if (t.classList.contains('qty-input-field')) {
      const item = findItem(t.dataset.id);
      if (item) { setQuantity(item, t.value); t.value = item.quantity; updateShoppingUI(); }
    }
  }

  function onShoppingInput(e) {
    const t = e.target;
    if (t.classList.contains('qty-input-field')) {
      const item = findItem(t.dataset.id);
      if (item && t.value !== '') { setQuantity(item, t.value); updateShoppingUI(); }
    }
  }

  function copyShoppingList() {
    const plan = state.plan;
    const totals = E.calculateShoppingListTotals(plan.shoppingList);
    const lines = ['Foodsphere shopping list (estimated prices in BDT)'];
    plan.shoppingList.forEach(i => lines.push(`${i.purchased ? '[x]' : '[ ]'} ${i.shortName}: ${qtyText(i.quantity, i.unit)} - ${money(i.cost)}`));
    lines.push(`Total: ${money(totals.grandTotal)}`);
    const text = lines.join('\n');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let okCopy = false;
      try { okCopy = document.execCommand('copy'); } catch (err) { okCopy = false; }
      document.body.removeChild(ta);
      toast(okCopy ? 'Shopping list copied' : 'Could not copy. Try Print instead.', okCopy ? undefined : 'warn');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Shopping list copied'), fallback);
    } else fallback();
  }

  // ------------------------------------------------------------------ spend / remaining
  /** Header numbers follow the shopping list, so edited quantities are reflected in the budget. */
  function refreshSpend() {
    const plan = state.plan;
    if (!plan) return;
    const weekly = plan.periodDays > 1;
    const spend = E.calculateShoppingListTotals(plan.shoppingList).grandTotal;
    const remaining = round2(plan.periodBudget - spend);
    const fits = remaining >= 0;

    $('summaryTitle').textContent = weekly ? 'Your 7-day plan' : 'Your daily plan';
    $('kpiBudgetLabel').textContent = weekly ? 'Weekly budget' : 'Daily budget';
    $('kpiCostLabel').textContent = weekly ? 'Estimated cost (7 days)' : 'Estimated cost';
    $('kpiRemainLabel').textContent = fits ? 'Remaining' : 'Over budget by';
    $('summaryBudgetAmount').textContent = money0(plan.periodBudget) + ' BDT';
    $('summaryCostAmount').textContent = money(spend) + ' BDT';
    const rem = $('summaryRemainingAmount');
    rem.textContent = fits ? money(remaining) + ' BDT' : '−' + money(Math.abs(remaining)) + ' BDT';
    rem.classList.toggle('negative', !fits);

    const badge = $('resultsBadge');
    badge.className = fits ? 'badge-success' : 'badge-warning';
    badge.textContent = fits ? 'Within budget' : 'Over budget';

    const pct = plan.periodBudget > 0 ? (spend / plan.periodBudget) * 100 : 0;
    const bar = $('budgetProgressBar');
    bar.style.width = Math.min(100, pct) + '%';
    bar.className = 'progress-bar' + (pct > 100 ? ' over' : pct >= 85 ? ' warn' : '');
    $('budgetProgressText').textContent = `${Math.round(pct)}% of budget used`;
    $('budgetProgressNote').textContent = fits ? `${money(remaining)} left` : `${money(Math.abs(remaining))} short`;

    const diff = round2(spend - plan.totalCost);
    const note = $('adjustNote');
    note.hidden = Math.abs(diff) < 0.005;
    note.textContent = Math.abs(diff) < 0.005 ? '' :
      `Includes your shopping-list changes (${diff > 0 ? '+' : '−'}${money(Math.abs(diff))} compared with the meals as planned).`;
  }

  // ------------------------------------------------------------------ alternatives
  function renderAlternatives(alts) {
    if (!alts || alts.length === 0) {
      alternativesListContainer.innerHTML = `
        <div class="empty-list-state"><div class="empty-icon">✨</div><p class="empty-text">Well optimised</p>
        <small class="empty-subtext">No extra swaps are needed for this plan.</small></div>`;
      return;
    }
    alternativesListContainer.innerHTML = alts.map(alt => `
      <div class="alt-card-item ${escapeHtml(alt.type)}">
        <h3 class="alt-title">${escapeHtml(alt.title)}</h3>
        <p class="alt-desc">${escapeHtml(alt.description)}</p>
        ${alt.actionTip ? `<span class="alt-action-tip">💡 ${escapeHtml(alt.actionTip)}</span>` : ''}
      </div>`).join('');
  }

  // ------------------------------------------------------------------ reset
  function resetAll() {
    clearTimeout(debounceTimer);
    form.reset();                       // clears budget, ingredient text box and preference radios
    state.pantry = [];
    state.plan = null;
    state.activeDay = 0;
    state.timeframe = 'daily';
    budgetInput.value = '';
    ingredientInput.value = '';
    toggleDaily.classList.add('active'); toggleWeekly.classList.remove('active');
    toggleDaily.setAttribute('aria-pressed', 'true'); toggleWeekly.setAttribute('aria-pressed', 'false');
    budgetLabelText.textContent = 'Daily Budget';
    budgetInput.placeholder = 'e.g. 250';
    clearBudgetError();
    renderBudgetPresets();
    updateBudgetHint();
    renderPantry();
    setPantryMessage('Press Enter or Add. Separate several items with commas.');
    medicalNote.hidden = true;
    // Clear every result element so no stale numbers remain anywhere
    shoppingListContainer.innerHTML = '';
    alternativesListContainer.innerHTML = '';
    shoppingCountBadge.textContent = '0 items';
    dayTabs.innerHTML = ''; weekChart.innerHTML = '';
    SLOTS.forEach(s => { mealCards[s].innerHTML = ''; });
    ['summaryBudgetAmount', 'summaryCostAmount', 'summaryRemainingAmount'].forEach(id => { $(id).textContent = '৳0.00 BDT'; });
    $('summaryRemainingAmount').classList.remove('negative');
    $('resultsBadge').className = 'badge-neutral'; $('resultsBadge').textContent = 'Waiting for input';
    $('budgetProgressBar').style.width = '0%'; $('budgetProgressText').textContent = '0% of budget used'; $('budgetProgressNote').textContent = '';
    $('adjustNote').hidden = true;
    $('valCalories').innerHTML = '0 <small>kcal</small>'; $('valProtein').innerHTML = '0 <small>g</small>';
    $('valCarbs').innerHTML = '0 <small>g</small>'; $('valFat').innerHTML = '0 <small>g</small>';
    ['barCalories', 'barProtein', 'barCarbs', 'barFat'].forEach(id => { $(id).style.width = '0%'; });
    ['refCalories', 'refProtein', 'refCarbs', 'refFat'].forEach(id => { $(id).textContent = ''; });
    $('macroBar').innerHTML = ''; $('macroLegend').innerHTML = '';
    showEmpty();
    toast('Everything was reset');
    budgetInput.focus();
  }

  // ------------------------------------------------------------------ events
  toggleDaily.addEventListener('click', () => { if (state.timeframe !== 'daily') setTimeframe('daily'); });
  toggleWeekly.addEventListener('click', () => { if (state.timeframe !== 'weekly') setTimeframe('weekly'); });

  budgetInput.addEventListener('input', () => {
    clearBudgetError();
    syncPresetPressed();
    updateBudgetHint();
    if (state.plan) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runPlan({ quiet: true }), 350);
    }
  });
  budgetInput.addEventListener('blur', () => {
    if (budgetInput.value.trim() !== '') {
      const v = E.validateBudget(budgetInput.value, state.timeframe);
      if (!v.valid) showBudgetError(v.message);
    }
  });

  btnAddIngredient.addEventListener('click', addIngredientsFromInput);
  ingredientInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addIngredientsFromInput(); } });
  quickStaples.addEventListener('click', e => {
    const chip = e.target.closest('.staple-chip');
    if (chip && chip.dataset.item) toggleStaple(chip.dataset.item);
  });

  prefGroup.addEventListener('change', () => {
    medicalNote.hidden = currentPreference() !== 'diabetic-friendly';
    onInputsChanged();
  });

  form.addEventListener('submit', e => { e.preventDefault(); onGenerate(); });
  btnReset.addEventListener('click', resetAll);
  $('btnPrint').addEventListener('click', () => window.print());

  shoppingListContainer.addEventListener('click', onShoppingClick);
  shoppingListContainer.addEventListener('change', onShoppingChange);
  shoppingListContainer.addEventListener('input', onShoppingInput);

  dayTabs.addEventListener('click', e => { const b = e.target.closest('.day-tab'); if (b) selectDay(Number(b.dataset.day), false); });
  dayTabs.addEventListener('keydown', e => {
    if (!state.plan) return;
    const n = state.plan.days.length;
    if (e.key === 'ArrowRight') { e.preventDefault(); selectDay((state.activeDay + 1) % n, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); selectDay((state.activeDay + n - 1) % n, true); }
    else if (e.key === 'Home') { e.preventDefault(); selectDay(0, true); }
    else if (e.key === 'End') { e.preventDefault(); selectDay(n - 1, true); }
  });
  weekChart.addEventListener('click', e => { const b = e.target.closest('.week-col'); if (b) selectDay(Number(b.dataset.day), false); });

  // ------------------------------------------------------------------ start
  const art = emptyHero.querySelectorAll('.art-chip');
  ['rice', 'egg', 'seasonal_vegetables'].forEach((id, i) => { if (art[i]) art[i].innerHTML = FoodIcons.icon(id); });
  renderStaples();
  renderBudgetPresets();
  renderPantry();
  updateBudgetHint();
}

// Start as soon as the page structure exists (works whether the script runs before or after DOMContentLoaded).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
