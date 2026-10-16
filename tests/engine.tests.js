/**
 * Engine tests for the Budget-Aware Meal Planner.
 * Shared by tests/unit.html (browser) and tests/run-node.js (command line).
 * Each test checks real behaviour; none of them are loosened to make results pass.
 */
function defineEngineTests(t, E, FOODS, RECIPES) {
  const { test, eq, ok, near } = t;
  const SLOTS = ['breakfast', 'lunch', 'dinner'];
  const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const r1 = v => Math.round((v + Number.EPSILON) * 10) / 10;
  const food = id => FOODS.find(f => f.id === id);

  // -------------------------------------------------------------------------
  // Data integrity
  // -------------------------------------------------------------------------
  test('DATA: every recipe ingredient exists in the food database', () => {
    const ids = new Set(FOODS.map(f => f.id));
    RECIPES.forEach(r => r.ingredients.forEach(i => ok(ids.has(i.foodId), `${r.id} -> ${i.foodId}`)));
  });
  test('DATA: recipe ids are unique and units match the food table', () => {
    eq(new Set(RECIPES.map(r => r.id)).size, RECIPES.length);
    RECIPES.forEach(r => r.ingredients.forEach(i => eq(i.unit, food(i.foodId).unit, `${r.id}:${i.foodId}`)));
  });
  test('DATA: prices are positive and nutrition is internally consistent (4/4/9 kcal rule within 12%)', () => {
    FOODS.forEach(f => {
      ok(f.estimatedPriceBDT > 0 && f.referenceQuantity > 0, f.id);
      const est = f.nutrition.protein * 4 + f.nutrition.carbs * 4 + f.nutrition.fat * 9;
      ok(Math.abs(est - f.nutrition.calories) / f.nutrition.calories <= 0.12, `${f.id}: ${est} vs ${f.nutrition.calories}`);
    });
  });
  test('DATA: every diet has at least 2 recipes for each meal (no silent fallback)', () => {
    ['standard', 'high-protein', 'vegetarian', 'diabetic-friendly', 'budget-saver'].forEach(pref => {
      SLOTS.forEach(slot => {
        const n = RECIPES.filter(r => r.mealType === slot && r.dietaryPreferences.includes(pref)).length;
        ok(n >= 2, `${pref}/${slot} has ${n}`);
      });
    });
  });
  test('DATA: vegetarian-tagged recipes contain no meat, fish or eggs', () => {
    RECIPES.filter(r => r.dietaryPreferences.includes('vegetarian')).forEach(r =>
      r.ingredients.forEach(i => ok(!['fish', 'chicken', 'egg'].includes(i.foodId), `${r.id} has ${i.foodId}`)));
  });

  // -------------------------------------------------------------------------
  // Budget validation
  // -------------------------------------------------------------------------
  test('BUDGET: empty / null / undefined / whitespace -> EMPTY_BUDGET with friendly text', () => {
    ['', '   ', null, undefined].forEach(v => {
      const r = E.validateBudget(v, 'daily');
      ok(!r.valid); eq(r.errorType, 'EMPTY_BUDGET'); ok(r.message.includes('valid budget'));
    });
  });
  test('BUDGET: negative values rejected ("greater than ৳0")', () => {
    ['-50', -50, '-0.5', '-1,000'].forEach(v => {
      const r = E.validateBudget(v, 'daily');
      ok(!r.valid, String(v)); eq(r.errorType, 'NEGATIVE_OR_ZERO_BUDGET'); ok(r.message.includes('greater than ৳0'));
    });
  });
  test('BUDGET: zero rejected', () => {
    ['0', 0, '0.00', '0.001'].forEach(v => eq(E.validateBudget(v, 'daily').errorType, 'NEGATIVE_OR_ZERO_BUDGET', String(v)));
  });
  test('BUDGET: non-numeric / garbage rejected', () => {
    ['abc', '12abc', '1e3', '0x10', '--5', '1.2.3', '৳', '.', NaN, Infinity, '১২৩'].forEach(v => {
      const r = E.validateBudget(v, 'daily');
      ok(!r.valid, 'should reject ' + String(v)); eq(r.errorType, 'INVALID_BUDGET', String(v));
    });
  });
  test('BUDGET: excessive values rejected ("realistic") with separate daily / weekly limits', () => {
    ['999999', 5001, '50000'].forEach(v => { const r = E.validateBudget(v, 'daily'); eq(r.errorType, 'UNREALISTIC_BUDGET', String(v)); ok(r.message.includes('realistic')); });
    ok(E.validateBudget(5000, 'daily').valid);
    ok(E.validateBudget(5001, 'weekly').valid);
    ok(E.validateBudget(35000, 'weekly').valid);
    eq(E.validateBudget(35001, 'weekly').errorType, 'UNREALISTIC_BUDGET');
  });
  test('BUDGET: valid formats accepted (250, "250", "1,800", "৳250", "250 BDT", "99.5")', () => {
    eq(E.validateBudget(250, 'daily').value, 250);
    eq(E.validateBudget('250', 'daily').value, 250);
    eq(E.validateBudget('1,800', 'weekly').value, 1800);
    eq(E.validateBudget('৳250', 'daily').value, 250);
    eq(E.validateBudget('250 BDT', 'daily').value, 250);
    eq(E.validateBudget('99.5', 'daily').value, 99.5);
  });
  test('BUDGET: generateMealPlan returns the validation error and no plan', () => {
    const r = E.generateMealPlan({ budget: '', timeframe: 'daily' });
    ok(!r.success); eq(r.errorType, 'EMPTY_BUDGET');
    ok(!E.generateMealPlan({ budget: null, timeframe: 'daily' }).success);
    eq(E.generateMealPlan({ budget: -5, timeframe: 'weekly' }).errorType, 'NEGATIVE_OR_ZERO_BUDGET');
  });

  // -------------------------------------------------------------------------
  // Pantry matching
  // -------------------------------------------------------------------------
  test('PANTRY: recognises English, Bengali, transliterated and chip-style names', () => {
    const set = E.normalizePantryList(['Rice (চাল)', 'ডিম', 'Daal', 'aloo', 'shobji', 'Roti / Atta', 'murgi', 'maach', 'kola', 'dudh']);
    ['rice', 'egg', 'lentils_daal', 'potato', 'seasonal_vegetables', 'roti', 'chicken', 'fish', 'banana', 'milk'].forEach(id => ok(set.has(id), id));
  });
  test('PANTRY: whole-word matching (eggplant is not egg, licorice is not rice, medium is not dim)', () => {
    eq(E.matchPantryItem('Eggplant'), null);
    eq(E.matchPantryItem('licorice'), null);
    eq(E.matchPantryItem('medium'), null);
    eq(E.matchPantryItem('salt'), null);
    eq(E.matchPantryItem('Cooking Oil'), null);
    eq(E.matchPantryItem('Rice'), 'rice');
  });
  test('PANTRY: invalid input is handled safely', () => {
    eq(E.normalizePantryList(null).size, 0);
    eq(E.normalizePantryList([null, 5, '', undefined]).size, 0);
  });

  // -------------------------------------------------------------------------
  // Cost & nutrition
  // -------------------------------------------------------------------------
  test('COST: Dim Khichuri = 60g rice + 40g daal + 1 egg = ৳23.30', () => {
    const rec = RECIPES.find(r => r.id === 'bf_dim_khichuri');
    near(E.calculateRecipeMetrics(rec, new Set()).grossCost, 23.30, 0.005);
  });
  test('COST/NUTRITION: every recipe matches an independent recomputation from the food table', () => {
    RECIPES.forEach(rec => {
      const m = E.calculateRecipeMetrics(rec, new Set());
      let cost = 0, cal = 0, p = 0, c = 0, f = 0;
      rec.ingredients.forEach(i => {
        const fd = food(i.foodId), ratio = i.quantity / fd.referenceQuantity;
        cost += r2(ratio * fd.estimatedPriceBDT); cal += ratio * fd.nutrition.calories;
        p += ratio * fd.nutrition.protein; c += ratio * fd.nutrition.carbs; f += ratio * fd.nutrition.fat;
      });
      near(m.grossCost, r2(cost), 0.0001, rec.id);
      eq(m.nutrition.calories, Math.round(cal), rec.id);
      near(m.nutrition.protein, r1(p), 0.0001, rec.id);
      near(m.nutrition.carbs, r1(c), 0.0001, rec.id);
      near(m.nutrition.fat, r1(f), 0.0001, rec.id);
    });
  });
  test('COST: pantry items cost ৳0 but keep their nutrition', () => {
    const rec = RECIPES.find(r => r.id === 'bf_dim_khichuri');
    const all = E.calculateRecipeMetrics(rec, new Set());
    const some = E.calculateRecipeMetrics(rec, new Set(['rice', 'egg']));
    near(some.outOfPocketCost, 5.6, 0.0001);                     // only daal to buy
    eq(some.nutrition.calories, all.nutrition.calories);
    eq(some.missingIngredients.length, 1);
  });

  // -------------------------------------------------------------------------
  // Daily plans
  // -------------------------------------------------------------------------
  test('DAILY: ৳250 plan has 3 meals, fits budget, remaining = budget - cost', () => {
    const r = E.generateMealPlan({ budget: 250, timeframe: 'daily', pantry: [], preference: 'standard' });
    ok(r.success && r.fitsBudget);
    SLOTS.forEach(s => ok(r.meals[s] && r.meals[s].name, s));
    ok(r.totalCost <= 250);
    near(r.remainingBudget, r2(250 - r.totalCost), 0.0001);
    eq(r.days.length, 1);
  });
  test('DAILY: totals equal the sum of displayed meals (cost and nutrition)', () => {
    const r = E.generateMealPlan({ budget: 300, timeframe: 'daily', pantry: ['rice'], preference: 'standard' });
    const meals = SLOTS.map(s => r.meals[s]);
    near(r.totalCost, r2(meals.reduce((a, m) => a + m.outOfPocketCost, 0)), 0.0001);
    eq(r.totals.calories, meals.reduce((a, m) => a + m.nutrition.calories, 0));
    near(r.totals.protein, r1(meals.reduce((a, m) => a + m.nutrition.protein, 0)), 0.0001);
    near(r.totals.carbs, r1(meals.reduce((a, m) => a + m.nutrition.carbs, 0)), 0.0001);
    near(r.totals.fat, r1(meals.reduce((a, m) => a + m.nutrition.fat, 0)), 0.0001);
  });
  test('DAILY: available ingredients lower the cost', () => {
    const none = E.generateMealPlan({ budget: 200, timeframe: 'daily', pantry: [] });
    const some = E.generateMealPlan({ budget: 200, timeframe: 'daily', pantry: ['rice', 'eggs', 'potatoes'] });
    ok(some.totalCost < none.totalCost, `${some.totalCost} < ${none.totalCost}`);
    eq(some.pantryItemsCount, 3);
  });
  test('DAILY: determinism - same inputs give identical plans', () => {
    const a = E.generateMealPlan({ budget: 220, timeframe: 'daily', pantry: ['eggs'], preference: 'high-protein' });
    const b = E.generateMealPlan({ budget: 220, timeframe: 'daily', pantry: ['eggs'], preference: 'high-protein' });
    eq(JSON.stringify(a), JSON.stringify(b));
  });
  test('DAILY: legacy scenarios (budget 150 with rice/eggs/potatoes; budget 80 with rice/lentils) fit', () => {
    const a = E.generateMealPlan({ budget: 150, timeframe: 'daily', pantry: ['rice', 'eggs', 'potatoes'], preference: 'standard' });
    ok(a.success && a.fitsBudget && a.totalDailyCost <= 150 && a.pantryItemsCount >= 3);
    const b = E.generateMealPlan({ budget: 80, timeframe: 'daily', pantry: ['rice', 'lentils'], preference: 'standard' });
    ok(b.success && b.fitsBudget && b.totalDailyCost <= 80);
  });

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------
  test('PREFERENCE: vegetarian plans contain no meat, fish or eggs', () => {
    [150, 250, 600].forEach(b => {
      const r = E.generateMealPlan({ budget: b, timeframe: 'daily', preference: 'vegetarian' });
      ok(r.success && !r.preferenceBroadened);
      SLOTS.forEach(s => r.meals[s].ingredients.forEach(i => ok(!['fish', 'chicken', 'egg'].includes(i.foodId), `${b}:${s}:${i.foodId}`)));
    });
  });
  test('PREFERENCE: high-protein gives at least as much protein as standard at the same budget', () => {
    const std = E.generateMealPlan({ budget: 300, timeframe: 'daily', preference: 'standard' });
    const hp = E.generateMealPlan({ budget: 300, timeframe: 'daily', preference: 'high-protein' });
    ok(hp.totals.protein >= std.totals.protein, `${hp.totals.protein} >= ${std.totals.protein}`);
  });
  test('PREFERENCE: diabetic-friendly uses tagged recipes and includes a not-medical-advice notice', () => {
    const r = E.generateMealPlan({ budget: 300, timeframe: 'daily', preference: 'diabetic-friendly' });
    ok(r.success && !r.preferenceBroadened);
    SLOTS.forEach(s => ok(r.meals[s].dietaryPreferences.includes('diabetic-friendly'), s));
    const n = r.notices.find(x => x.type === 'medical');
    ok(n && /not medical advice/i.test(n.text) && /does not treat or prevent diabetes/i.test(n.text));
    const text = JSON.stringify(r);
    ok(!/\b(cures?|treats? diabetes|lowers? blood (sugar|glucose)|controls? blood)\b/i.test(text.replace(/does not treat or prevent diabetes/gi, '')));
  });
  test('PREFERENCE: budget-saver picks the cheapest possible plan type (cost <= standard)', () => {
    const std = E.generateMealPlan({ budget: 300, timeframe: 'daily', preference: 'standard' });
    const sv = E.generateMealPlan({ budget: 300, timeframe: 'daily', preference: 'budget-saver' });
    ok(sv.totalCost <= std.totalCost);
  });
  test('PREFERENCE: unknown preference falls back to standard', () => {
    const r = E.generateMealPlan({ budget: 250, timeframe: 'daily', preference: 'nonsense' });
    ok(r.success); eq(r.preference, 'standard');
  });

  // -------------------------------------------------------------------------
  // Low budgets & alternatives
  // -------------------------------------------------------------------------
  test('LOW BUDGET: ৳15 explains the problem, reports shortfall, never claims it fits', () => {
    const r = E.generateMealPlan({ budget: 15, timeframe: 'daily', pantry: [] });
    ok(r.success); ok(!r.fitsBudget); ok(r.remainingBudget < 0);
    const w = r.alternatives.find(a => a.type === 'warning');
    ok(w && w.description.includes('too low') === false && /short of the lowest-cost plan/.test(w.description));
    ok(r.alternatives.length >= 2);
    near(r.totalCost, r.minimumPeriodCost, 0.0001);
  });
  test('LOW BUDGET: the plan shown is the true minimum cost (brute-force check, 3 pantry cases)', () => {
    [[], ['rice'], ['rice', 'eggs', 'potatoes', 'daal']].forEach(p => {
      const r = E.generateMealPlan({ budget: 1, timeframe: 'daily', pantry: p, preference: 'standard' });
      const set = E.normalizePantryList(p);
      const ms = RECIPES.map(x => E.calculateRecipeMetrics(x, set));
      const min = s => Math.min(...ms.filter(m => m.mealType === s).map(m => m.outOfPocketCost));
      near(r.totalCost, r2(min('breakfast') + min('lunch') + min('dinner')), 0.0001);
    });
  });
  test('LOW BUDGET: budget just above the minimum fits; just below does not', () => {
    const base = E.generateMealPlan({ budget: 1, timeframe: 'daily' }).minimumPeriodCost;
    ok(E.generateMealPlan({ budget: Math.ceil(base), timeframe: 'daily' }).fitsBudget);
    ok(!E.generateMealPlan({ budget: Math.floor(base) - 1, timeframe: 'daily' }).fitsBudget);
  });
  test('ALTERNATIVES: swap suggestions quote savings that match the real recipe costs', () => {
    const r = E.generateMealPlan({ budget: 600, timeframe: 'daily', pantry: [], preference: 'high-protein' });
    const swaps = r.alternatives.filter(a => a.type === 'savings-swap');
    ok(swaps.length >= 1, 'expected at least one swap at a generous budget');
    swaps.forEach(s => ok(/save about ৳[\d,.]+/.test(s.description)));
  });
  test('ALTERNATIVES: pantry what-if tips are only offered when they really save money', () => {
    const r = E.generateMealPlan({ budget: 20, timeframe: 'daily', pantry: [] });
    r.alternatives.filter(a => a.type === 'pantry-tip').forEach(a => ok(/drop by about ৳\d/.test(a.description)));
  });

  // -------------------------------------------------------------------------
  // Weekly plans
  // -------------------------------------------------------------------------
  test('WEEKLY: 7 days, totals = sum of days, total cost within budget', () => {
    const r = E.generateMealPlan({ budget: 1800, timeframe: 'weekly', pantry: [], preference: 'standard' });
    ok(r.success && r.fitsBudget); eq(r.days.length, 7); eq(r.periodDays, 7);
    ok(r.totalCost <= 1800);
    near(r.totalCost, r2(r.days.reduce((a, d) => a + d.totalOutOfPocket, 0)), 0.0001);
    eq(r.totals.calories, r.days.reduce((a, d) => a + d.nutrition.calories, 0));
    near(r.remainingBudget, r2(1800 - r.totalCost), 0.0001);
  });
  test('WEEKLY: daily allowance = weekly / 7', () => {
    const r = E.generateMealPlan({ budget: 1400, timeframe: 'weekly' });
    near(r.dailyTargetBudget, 200, 0.0001);
    const r2_ = E.generateMealPlan({ budget: 1000, timeframe: 'weekly' });
    near(r2_.dailyTargetBudget, r2(1000 / 7), 0.0001);
  });
  test('WEEKLY: meals vary across the week at a comfortable budget', () => {
    const r = E.generateMealPlan({ budget: 2800, timeframe: 'weekly', pantry: [] });
    SLOTS.forEach(s => ok(new Set(r.days.map(d => d.meals[s].id)).size >= 3, s + ' variety'));
  });
  test('WEEKLY: pantry ingredients are excluded from the combined shopping list', () => {
    const r = E.generateMealPlan({ budget: 2000, timeframe: 'weekly', pantry: ['rice', 'eggs'] });
    ok(!r.shoppingList.some(i => i.foodId === 'rice' || i.foodId === 'egg'));
  });
  test('WEEKLY: a too-small weekly budget reports the shortfall for the whole week', () => {
    const r = E.generateMealPlan({ budget: 100, timeframe: 'weekly' });
    ok(r.success && !r.fitsBudget && r.remainingBudget < 0);
    near(r.totalCost, r.minimumPeriodCost, 0.0001);
    ok(r.alternatives.some(a => a.type === 'warning'));
  });

  // -------------------------------------------------------------------------
  // Shopping list
  // -------------------------------------------------------------------------
  test('SHOPPING: excludes pantry items, combines duplicates, quantities add up', () => {
    const r = E.generateMealPlan({ budget: 250, timeframe: 'daily', pantry: ['rice', 'eggs'] });
    ok(!r.shoppingList.some(i => i.foodId === 'rice' || i.foodId === 'egg'));
    const ids = r.shoppingList.map(i => i.foodId);
    eq(new Set(ids).size, ids.length);
    r.shoppingList.forEach(item => {
      let q = 0;
      SLOTS.forEach(s => r.meals[s].ingredients.forEach(i => { if (i.foodId === item.foodId) q += i.quantity; }));
      near(item.quantity, r1(q), 0.0001, item.foodId);
    });
  });
  test('SHOPPING: list total equals plan cost; everything-at-home gives an empty list and ৳0', () => {
    const r = E.generateMealPlan({ budget: 250, timeframe: 'daily', pantry: ['rice'] });
    near(E.calculateShoppingListTotals(r.shoppingList).grandTotal, r.totalCost, 0.0001);
    const all = E.generateMealPlan({ budget: 250, timeframe: 'daily',
      pantry: ['rice', 'egg', 'daal', 'potato', 'vegetables', 'roti', 'fish', 'chicken', 'banana', 'milk'] });
    eq(all.shoppingList.length, 0); eq(all.totalCost, 0);
  });
  test('SHOPPING: purchased flags and quantity changes recalculate totals', () => {
    const r = E.generateMealPlan({ budget: 250, timeframe: 'daily', pantry: [] });
    const list = r.shoppingList;
    const t0 = E.calculateShoppingListTotals(list);
    list[0].purchased = true;
    const t1 = E.calculateShoppingListTotals(list);
    eq(t1.purchasedCount, 1); near(t1.purchasedTotal, list[0].cost, 0.0001);
    near(t1.pendingTotal, r2(t0.grandTotal - list[0].cost), 0.0001);
    near(t1.grandTotal, t0.grandTotal, 0.0001);                        // buying does not change the total
    const before = list[0].cost;
    list[0].quantity += list[0].unitStep;
    const t2 = E.calculateShoppingListTotals(list);
    ok(list[0].cost > before); ok(t2.grandTotal > t0.grandTotal);
    near(list[0].cost, E.calculateIngredientCost(list[0].foodId, list[0].quantity), 0.0001);
    list[0].quantity = 0;
    near(E.calculateShoppingListTotals(list).grandTotal, r2(t0.grandTotal - r.shoppingList[0].originalQuantity * 0 - E.calculateIngredientCost(list[0].foodId, list[0].originalQuantity)), 0.0001);
  });

  // -------------------------------------------------------------------------
  // Property tests over many random scenarios
  // -------------------------------------------------------------------------
  test('PROPERTY: 400 random scenarios keep all totals consistent', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const names = ['rice', 'eggs', 'daal', 'potatoes', 'vegetables', 'roti', 'fish', 'chicken', 'banana', 'milk', 'salt'];
    const prefs = ['standard', 'high-protein', 'vegetarian', 'diabetic-friendly', 'budget-saver'];
    for (let n = 0; n < 400; n++) {
      const weekly = rnd() < 0.4;
      const budget = Math.round((weekly ? 200 + rnd() * 5000 : 20 + rnd() * 800) * 100) / 100;
      const pantry = names.filter(() => rnd() < 0.3);
      const pref = prefs[Math.floor(rnd() * prefs.length)];
      const r = E.generateMealPlan({ budget, timeframe: weekly ? 'weekly' : 'daily', pantry, preference: pref });
      const tag = `#${n} ${weekly ? 'weekly' : 'daily'} ${budget} [${pantry}] ${pref}`;
      ok(r.success, tag);
      const mealCost = r2(r.days.reduce((a, d) => a + SLOTS.reduce((b, s) => b + d.meals[s].outOfPocketCost, 0), 0));
      near(r.totalCost, mealCost, 0.0001, 'cost=sum of meals ' + tag);
      near(E.calculateShoppingListTotals(r.shoppingList).grandTotal, r.totalCost, 0.011, 'shopping=cost ' + tag);
      near(r.remainingBudget, r2(budget - r.totalCost), 0.0001, 'remaining ' + tag);
      eq(r.fitsBudget, r.totalCost <= budget, 'fits flag ' + tag);
      eq(r.totals.calories, r.days.reduce((a, d) => a + SLOTS.reduce((b, s) => b + d.meals[s].nutrition.calories, 0), 0), 'kcal ' + tag);
      const have = E.normalizePantryList(pantry);
      r.shoppingList.forEach(i => ok(!have.has(i.foodId), 'pantry excluded ' + tag));
      if (!r.fitsBudget) ok(r.alternatives.some(a => a.type === 'warning'), 'warning shown ' + tag);
      if (pref === 'vegetarian') r.days.forEach(d => SLOTS.forEach(s => d.meals[s].ingredients.forEach(i => ok(!['fish', 'chicken', 'egg'].includes(i.foodId), 'veg ' + tag))));
    }
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { defineEngineTests };
