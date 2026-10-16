/**
 * Foodsphere Nutritio Intelligence - Budget-Aware AI Meal Planner
 * Core rule-based recommendation & calculation engine.
 *
 * IMPORTANT (honesty note): this is a transparent, deterministic, RULE-BASED planner.
 * No AI model or external API is connected. See `README.md` ("Adding a real AI later")
 * for the single place where a real model could be plugged in.
 *
 * Provides:
 *  1. Budget validation (empty / invalid / negative / zero / excessive)
 *  2. Pantry matching (whole-word aliases, so "eggplant" is NOT "egg")
 *  3. Recipe cost & nutrition from ingredient quantities
 *  4. Daily AND 7-day weekly plan generation within a budget
 *  5. Shopping-list aggregation (excludes pantry items, combines duplicates)
 *  6. Computed (not hard-coded) cheaper alternatives and saving tips
 *
 * Requires the globals from data/foods.js and data/recipes.js.
 */

const MealPlannerEngine = (() => {

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const LIMITS = { dailyMax: 5000, weeklyMax: 35000 };   // BDT, "realistic personal food budget"
  const PERIOD_DAYS = { daily: 1, weekly: 7 };
  const SLOTS = ['breakfast', 'lunch', 'dinner'];
  const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  const PREFERENCES = ['standard', 'high-protein', 'vegetarian', 'diabetic-friendly', 'budget-saver'];

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function round2(val) { return Math.round((val + Number.EPSILON) * 100) / 100; }
  function round1(val) { return Math.round((val + Number.EPSILON) * 10) / 10; }
  function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
  function fmt(n) { const v = round2(n); return '৳' + v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); }

  // ---------------------------------------------------------------------------
  // 1. Budget validation
  // ---------------------------------------------------------------------------
  /**
   * Validates a raw budget value (string or number) for the chosen timeframe.
   * @returns {{valid:boolean, value?:number, errorType?:string, message?:string}}
   */
  function validateBudget(raw, timeframe) {
    const tf = timeframe === 'weekly' ? 'weekly' : 'daily';
    const fail = (errorType, message) => ({ valid: false, errorType, message });

    if (raw === undefined || raw === null) {
      return fail('EMPTY_BUDGET', 'Please enter a valid budget amount in Bangladeshi Taka (৳) to generate your meal plan.');
    }
    if (typeof raw === 'number' && !Number.isFinite(raw)) {
      return fail('INVALID_BUDGET', "That doesn't look like a valid amount. Please type a number such as 250 (digits only).");
    }

    let s = String(raw).trim();
    if (s === '') {
      return fail('EMPTY_BUDGET', 'Please enter a valid budget amount in Bangladeshi Taka (৳) to generate your meal plan.');
    }

    s = s.replace(/^৳\s*/, '').replace(/,/g, '').replace(/\s*(bdt|tk|taka)\s*$/i, '').trim();

    if (/^-\s*\d/.test(s)) {
      return fail('NEGATIVE_OR_ZERO_BUDGET', 'Your budget must be greater than ৳0. A negative amount cannot be used for meal planning.');
    }
    if (!/^\d+(\.\d+)?$/.test(s)) {
      return fail('INVALID_BUDGET', "That doesn't look like a valid amount. Please type a number such as 250 (digits only).");
    }

    const value = round2(Number(s));
    if (!(value > 0)) {
      return fail('NEGATIVE_OR_ZERO_BUDGET', 'Your budget must be greater than ৳0.');
    }

    const max = tf === 'weekly' ? LIMITS.weeklyMax : LIMITS.dailyMax;
    if (value > max) {
      return fail('UNREALISTIC_BUDGET',
        `That is more than a realistic personal food budget. Please enter a realistic amount (up to ৳${max.toLocaleString('en-US')} per ${tf === 'weekly' ? 'week' : 'day'}).`);
    }
    return { valid: true, value };
  }

  // ---------------------------------------------------------------------------
  // 2. Pantry matching (whole-word aliases)
  // ---------------------------------------------------------------------------
  let aliasIndex = null;

  function tokenize(str) {
    return String(str).toLowerCase().normalize('NFC')
      .split(/[^\p{L}\p{M}\p{N}]+/u)
      .filter(Boolean);
  }

  function getAliasIndex() {
    if (aliasIndex) return aliasIndex;
    aliasIndex = new Map();
    BANGLADESHI_FOOD_DATABASE.forEach(food => {
      (food.aliases || []).forEach(a => {
        tokenize(a).forEach(tok => { if (!aliasIndex.has(tok)) aliasIndex.set(tok, food.id); });
      });
    });
    return aliasIndex;
  }

  /** Returns every canonical foodId mentioned in a free-text pantry entry (whole words only). */
  function matchAllInText(raw) {
    const found = [];
    if (typeof raw !== 'string') return found;
    const idx = getAliasIndex();
    tokenize(raw).forEach(tok => {
      const id = idx.get(tok);
      if (id && !found.includes(id)) found.push(id);
    });
    return found;
  }

  /** First canonical food ID for a single pantry entry, or null if it is not in the database. */
  function matchPantryItem(raw) {
    const all = matchAllInText(raw);
    return all.length ? all[0] : null;
  }

  /** @returns {Set<string>} canonical food IDs found in the user's pantry entries */
  function normalizePantryList(rawPantryList) {
    const set = new Set();
    if (!Array.isArray(rawPantryList)) return set;
    rawPantryList.forEach(item => matchAllInText(item).forEach(id => set.add(id)));
    return set;
  }

  // ---------------------------------------------------------------------------
  // 3. Recipe cost & nutrition
  // ---------------------------------------------------------------------------
  /**
   * Cost and nutrition of a recipe, computed from ingredient quantities.
   * Costs are rounded to 2 decimals per ingredient line so that every total
   * (meal, day, week, shopping list) is a sum of the same rounded numbers.
   */
  function calculateRecipeMetrics(recipe, pantrySet) {
    const pantry = pantrySet || new Set();
    let grossCost = 0, outOfPocketCost = 0, calories = 0, protein = 0, carbs = 0, fat = 0;
    const ingredientBreakdown = [], missingIngredients = [], pantryIngredients = [];

    recipe.ingredients.forEach(ing => {
      const food = getFoodItemById(ing.foodId);
      if (!food) {
        console.warn(`Food ID "${ing.foodId}" not found in BANGLADESHI_FOOD_DATABASE`);
        return;
      }
      const ratio = ing.quantity / food.referenceQuantity;
      const lineCost = round2(ratio * food.estimatedPriceBDT);
      const ingCalories = ratio * food.nutrition.calories;
      const ingProtein = ratio * food.nutrition.protein;
      const ingCarbs = ratio * food.nutrition.carbs;
      const ingFat = ratio * food.nutrition.fat;

      grossCost += lineCost;
      calories += ingCalories; protein += ingProtein; carbs += ingCarbs; fat += ingFat;

      const isInPantry = pantry.has(food.id);
      const line = {
        foodId: food.id, name: food.name, shortName: food.shortName || food.name,
        quantity: ing.quantity, unit: ing.unit
      };
      if (isInPantry) {
        pantryIngredients.push({ ...line, cost: 0, grossCost: lineCost });
      } else {
        outOfPocketCost += lineCost;
        missingIngredients.push({ ...line, cost: lineCost });
      }
      ingredientBreakdown.push({
        ...line, isInPantry, cost: isInPantry ? 0 : lineCost, grossCost: lineCost,
        calories: ingCalories, protein: ingProtein
      });
    });

    return {
      ...recipe,
      grossCost: round2(grossCost),
      outOfPocketCost: round2(outOfPocketCost),
      nutrition: {
        calories: Math.round(calories),
        protein: round1(protein),
        carbs: round1(carbs),
        fat: round1(fat)
      },
      ingredientBreakdown, missingIngredients, pantryIngredients,
      pantryMatchCount: pantryIngredients.length,
      pantryCoverageRatio: recipe.ingredients.length ? pantryIngredients.length / recipe.ingredients.length : 0
    };
  }

  function calculateIngredientCost(foodId, quantity) {
    const food = getFoodItemById(foodId);
    if (!food || isNaN(quantity) || quantity <= 0) return 0;
    return round2((quantity / food.referenceQuantity) * food.estimatedPriceBDT);
  }

  // ---------------------------------------------------------------------------
  // 4. Plan generation
  // ---------------------------------------------------------------------------
  function matchesPreference(recipe, pref) {
    if (!pref || pref === 'standard') return true;
    return Array.isArray(recipe.dietaryPreferences) && recipe.dietaryPreferences.includes(pref);
  }

  /** Builds per-slot recipe pools (with pantry-aware metrics) for a preference. */
  function buildPools(preference, pantrySet) {
    const all = BANGLADESHI_RECIPE_DATABASE.map(r => calculateRecipeMetrics(r, pantrySet));
    const pools = {};
    let broadened = false;
    SLOTS.forEach(slot => {
      let pool = all.filter(r => r.mealType === slot && matchesPreference(r, preference));
      if (pool.length === 0) { broadened = true; pool = all.filter(r => r.mealType === slot); }
      pools[slot] = pool;
    });
    return { pools, broadened };
  }

  /** Lowest possible out-of-pocket cost of one day (costs are additive per slot). */
  function cheapestDay(pools) {
    const pick = {};
    let cost = 0;
    SLOTS.forEach(slot => {
      const best = [...pools[slot]].sort((a, b) =>
        a.outOfPocketCost - b.outOfPocketCost || b.nutrition.calories - a.nutrition.calories)[0];
      pick[slot] = best;
      cost += best.outOfPocketCost;
    });
    return { picks: pick, cost: round2(cost) };
  }

  function sumNutrition(meals) {
    const list = SLOTS.map(s => meals[s].nutrition);
    return {
      calories: list.reduce((a, n) => a + n.calories, 0),
      protein: round1(list.reduce((a, n) => a + n.protein, 0)),
      carbs: round1(list.reduce((a, n) => a + n.carbs, 0)),
      fat: round1(list.reduce((a, n) => a + n.fat, 0))
    };
  }

  /**
   * Chooses the best breakfast + lunch + dinner for one day.
   * 1) Any combination within the day's budget is preferred (scored by pantry use,
   *    nutrition, preference and variety). 2) If nothing fits, the cheapest plan is used
   *    and the shortfall is reported - the budget is never silently exceeded.
   */
  function planOneDay(pools, dayBudget, preference, pantrySet, usage, previousIds) {
    let best = null, cheapest = null;

    pools.breakfast.forEach(bf => pools.lunch.forEach(ln => pools.dinner.forEach(dn => {
      const out = round2(bf.outOfPocketCost + ln.outOfPocketCost + dn.outOfPocketCost);
      const gross = round2(bf.grossCost + ln.grossCost + dn.grossCost);
      const nut = sumNutrition({ breakfast: bf, lunch: ln, dinner: dn });
      const pantryMatches = bf.pantryMatchCount + ln.pantryMatchCount + dn.pantryMatchCount;
      const savings = round2(gross - out);
      const fits = out <= dayBudget + 1e-9;

      let score = 0;
      // Budget adherence (critical)
      if (fits) {
        score += 1000;
        if (dayBudget > 0 && out / dayBudget <= 0.85) score += 40;
      } else {
        score -= 1000 + (out - dayBudget) * 25;
      }
      // Pantry usage
      score += pantryMatches * 40 + savings * 1.5;
      [bf, ln, dn].forEach(m => { if (m.outOfPocketCost === 0) score += 45; });
      // Nutrition adequacy
      if (nut.calories >= 1600 && nut.calories <= 2450) score += 80;
      else if (nut.calories < 1400) score -= 60;
      if (nut.calories < 1600) score -= (1600 - nut.calories) * 0.15;      // gently prefer fuller days
      else if (nut.calories > 2700) score -= 40;
      score += nut.protein * (preference === 'high-protein' ? 3.5 : 1.2);
      // Preference
      if (preference === 'budget-saver') score += (dayBudget - out) * 2.5;
      // Dietary diversity: reward covering more food groups in a day (grain, protein, legume, vegetable, fruit, dairy)
      const groups = new Set();
      [bf, ln, dn].forEach(m => m.ingredients.forEach(i => {
        const f = getFoodItemById(i.foodId);
        if (f && f.category) groups.add(String(f.category).split(' ')[0]);
      }));
      score += groups.size * 30;
      // Variety (within the day and across the week)
      const has = (m, id) => m.ingredients.some(i => i.foodId === id);
      if (has(ln, 'fish') && has(dn, 'fish')) score -= 35;
      if (has(ln, 'chicken') && has(dn, 'chicken')) score -= 35;
      SLOTS.forEach(slot => {
        const m = { breakfast: bf, lunch: ln, dinner: dn }[slot];
        score -= 40 * (usage[slot][m.id] || 0);
        if (previousIds && previousIds[slot] === m.id) score -= 60;
      });

      const cand = { breakfast: bf, lunch: ln, dinner: dn, out, gross, nut, fits, score };
      if (!cheapest || out < cheapest.out || (out === cheapest.out && nut.calories > cheapest.nut.calories)) cheapest = cand;
      if (fits && (!best || score > best.score)) best = cand;
    })));

    return best || cheapest;
  }

  /**
   * Generates a daily or 7-day plan.
   * @param {Object} params { budget, timeframe:'daily'|'weekly', pantry:string[], preference }
   * @returns {Object} { success:false, errorType, message } or the full plan (see bottom).
   */
  function generateMealPlan(params) {
    const p = params || {};
    const timeframe = p.timeframe === 'weekly' ? 'weekly' : 'daily';
    const requestedPref = p.preference || 'standard';
    const preference = PREFERENCES.includes(requestedPref) ? requestedPref : 'standard';
    const pantry = Array.isArray(p.pantry) ? p.pantry : [];

    const v = validateBudget(p.budget, timeframe);
    if (!v.valid) return { success: false, errorType: v.errorType, message: v.message };

    const periodBudget = v.value;
    const periodDays = PERIOD_DAYS[timeframe];
    const dailyTargetBudget = periodBudget / periodDays;
    const pantrySet = normalizePantryList(pantry);
    const { pools, broadened } = buildPools(preference, pantrySet);

    if (SLOTS.some(s => pools[s].length === 0)) {
      return { success: false, errorType: 'NO_RECIPES', message: 'No recipes found for the selected configuration. Please try standard preferences.' };
    }

    // --- Build each day. Remaining budget is re-spread over the remaining days. ---
    const usage = { breakfast: {}, lunch: {}, dinner: {} };
    const days = [];
    let remaining = periodBudget;
    let previousIds = null;

    for (let d = 0; d < periodDays; d++) {
      const dayBudget = remaining / (periodDays - d);
      const chosen = planOneDay(pools, dayBudget, preference, pantrySet, usage, previousIds);
      const ctx = { dailyTargetBudget: dayBudget, preference, pantrySet, fitsBudget: chosen.fits };
      const meals = {};
      SLOTS.forEach(slot => {
        const base = chosen[slot];
        const reasons = generateMealRecommendationReasons(base, ctx);
        meals[slot] = { ...base, recommendationReasons: reasons, explanation: buildExplanation(base, ctx) };
        usage[slot][base.id] = (usage[slot][base.id] || 0) + 1;
      });
      previousIds = { breakfast: chosen.breakfast.id, lunch: chosen.lunch.id, dinner: chosen.dinner.id };
      remaining = round2(remaining - chosen.out);
      days.push({
        dayNumber: d + 1, meals,
        totalOutOfPocket: chosen.out, totalGrossCost: chosen.gross,
        nutrition: sumNutrition(meals), dayBudget: round2(dayBudget), fitsBudget: chosen.fits
      });
    }

    // --- Period totals (sums of the displayed meals) ---
    const totalCost = round2(days.reduce((a, d) => a + d.totalOutOfPocket, 0));
    const totalGrossCost = round2(days.reduce((a, d) => a + d.totalGrossCost, 0));
    const totals = {
      calories: days.reduce((a, d) => a + d.nutrition.calories, 0),
      protein: round1(days.reduce((a, d) => a + d.nutrition.protein, 0)),
      carbs: round1(days.reduce((a, d) => a + d.nutrition.carbs, 0)),
      fat: round1(days.reduce((a, d) => a + d.nutrition.fat, 0))
    };
    const remainingBudget = round2(periodBudget - totalCost);
    const fitsBudget = totalCost <= periodBudget + 1e-9;

    // --- Shopping list: missing ingredients only, duplicates combined ---
    const shoppingMap = new Map();
    days.forEach(day => SLOTS.forEach(slot => {
      day.meals[slot].missingIngredients.forEach(item => {
        if (!shoppingMap.has(item.foodId)) {
          shoppingMap.set(item.foodId, { foodId: item.foodId, name: item.name, shortName: item.shortName, unit: item.unit, quantity: 0, cost: 0, usedIn: [] });
        }
        const entry = shoppingMap.get(item.foodId);
        entry.quantity += item.quantity;
        entry.cost = round2(entry.cost + item.cost);
        entry.usedIn.push({ day: day.dayNumber, slot });
      });
    }));
    const shoppingList = Array.from(shoppingMap.values()).map(item => {
      const qty = round1(item.quantity);
      let step = periodDays > 1 ? 50 : 10;
      if (item.unit === 'piece') step = 1;
      else if (item.unit === 'ml') step = periodDays > 1 ? 250 : 50;
      return { ...item, quantity: qty, originalQuantity: qty, unitStep: step, purchased: false };
    });

    // --- Alternatives, tips, notices ---
    const cheapest = cheapestDay(pools);
    const minimumPeriodCost = round2(cheapest.cost * periodDays);
    const alternatives = buildAlternatives({
      pools, days, preference, pantrySet, timeframe, periodDays, periodBudget,
      dailyTargetBudget, totalCost, remainingBudget, fitsBudget, minimumPeriodCost, cheapest
    });

    const notices = [];
    if (broadened) notices.push({ type: 'info', text: 'Not enough recipes matched your preference for every meal, so some meals come from the standard list.' });
    if (preference === 'diabetic-friendly') {
      notices.push({ type: 'medical', text: 'Diabetic-friendly here means general food information only (more vegetables, lentils and whole-wheat roti). It is not medical advice and does not treat or prevent diabetes. Please ask your doctor or a dietitian about your own needs.' });
    }
    const avgKcal = totals.calories / periodDays;
    if (avgKcal < 1400) {
      notices.push({ type: 'info', text: `This plan provides about ${Math.round(avgKcal)} kcal per day, which may be low for many adults. Consider larger portions or extra food. These are rough estimates, not personal advice.` });
    }
    if (periodDays > 1 && pantrySet.size > 0) {
      notices.push({ type: 'info', text: 'Pantry items are assumed to be available in enough quantity for the whole week.' });
    }

    const average = {
      calories: Math.round(totals.calories / periodDays),
      protein: round1(totals.protein / periodDays),
      carbs: round1(totals.carbs / periodDays),
      fat: round1(totals.fat / periodDays)
    };

    return {
      success: true,
      timeframe, periodDays, preference,
      userBudget: periodBudget, periodBudget,
      dailyTargetBudget: round2(dailyTargetBudget),
      totalCost,                                  // whole period
      totalDailyCost: periodDays === 1 ? totalCost : round2(totalCost / periodDays),   // per-day figure
      totalGrossCost,
      remainingBudget,                            // whole period
      fitsBudget,
      minimumPeriodCost,
      pantryItemsCount: pantrySet.size,
      pantryIds: Array.from(pantrySet),
      preferenceBroadened: broadened,
      days,
      meals: days[0].meals,                       // first day (kept for backward compatibility)
      totals,                                     // whole period
      dailyNutrition: periodDays === 1 ? totals : average,
      shoppingList, alternatives, notices,
      reasoningSummary: {
        strategy: fitsBudget ? 'Budget-Satisfied & Pantry-Optimized' : 'Minimum-Cost Fallback Plan',
        logicDescription: 'Rule-based scoring: budget adherence first, then pantry use, nutrition adequacy, your preference and variety. No AI model is connected.',
        medicalDisclaimer: 'General food information based on approximate reference values. Not medical advice.'
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Explanations
  // ---------------------------------------------------------------------------
  function generateMealRecommendationReasons(meal, context) {
    const reasons = [];
    const { dailyTargetBudget, preference, fitsBudget } = context;

    if (meal.pantryIngredients && meal.pantryIngredients.length > 0) {
      const names = meal.pantryIngredients.map(i => i.shortName).join(', ');
      const savings = round2(meal.grossCost - meal.outOfPocketCost);
      if (meal.outOfPocketCost === 0) {
        reasons.push({ type: 'pantry', badge: '100% from home', text: `Made only from ingredients you already have (${names}), so ৳0 to buy.` });
      } else {
        reasons.push({ type: 'pantry', badge: 'Uses your pantry', text: `Uses ${names} from home, saving about ৳${savings.toFixed(2)}.` });
      }
    }

    if (fitsBudget) {
      const share = dailyTargetBudget > 0 ? meal.outOfPocketCost / dailyTargetBudget : 1;
      reasons.push(share <= 0.35
        ? { type: 'budget', badge: 'Budget friendly', text: `Costs about ৳${meal.outOfPocketCost.toFixed(2)}, a small part of your daily allowance.` }
        : { type: 'budget', badge: 'Within budget', text: `Costs about ৳${meal.outOfPocketCost.toFixed(2)} and still fits your daily allowance.` });
    } else {
      reasons.push({ type: 'budget', badge: 'Lowest cost option', text: `The most economical choice for this meal (about ৳${meal.outOfPocketCost.toFixed(2)}).` });
    }

    const has = id => meal.ingredients.some(i => i.foodId === id);
    const protein = meal.nutrition.protein;
    if (protein >= 15 || has('fish') || has('chicken') || (has('egg') && has('lentils_daal'))) {
      const source = has('fish') ? 'fish' : has('chicken') ? 'chicken' : has('egg') ? 'eggs' : 'lentils';
      reasons.push({ type: 'nutrition', badge: 'Protein source', text: `About ${protein} g of protein, mainly from ${source}.` });
    } else if (has('seasonal_vegetables')) {
      reasons.push({ type: 'nutrition', badge: 'Fibre & vitamins', text: `Includes seasonal vegetables for fibre and vitamins (${meal.nutrition.calories} kcal).` });
    } else if (has('roti')) {
      reasons.push({ type: 'nutrition', badge: 'Whole-wheat energy', text: 'Whole-wheat roti provides steady carbohydrate energy.' });
    }

    if (preference === 'vegetarian' && meal.dietaryPreferences.includes('vegetarian')) {
      reasons.push({ type: 'preference', badge: 'Vegetarian', text: 'Contains no meat, fish or eggs.' });
    } else if (preference === 'high-protein') {
      reasons.push({ type: 'preference', badge: 'High-protein choice', text: 'Chosen from higher-protein recipes to match your preference.' });
    } else if (preference === 'diabetic-friendly') {
      reasons.push({ type: 'preference', badge: 'Diabetic-friendly style', text: 'Emphasises vegetables, lentils or whole-wheat roti. General food information only, not medical advice.' });
    } else if (preference === 'budget-saver') {
      reasons.push({ type: 'preference', badge: 'Savings focus', text: 'Chosen to keep your spending as low as possible.' });
    }
    return reasons.slice(0, 3);
  }

  /** One readable sentence explaining the choice (all values come from the real calculation). */
  function buildExplanation(meal, ctx) {
    const parts = [];
    if (meal.pantryIngredients.length) parts.push(`uses ${meal.pantryIngredients.map(i => i.shortName.toLowerCase()).join(' and ')} you already have`);
    parts.push(ctx.fitsBudget
      ? `costs about ৳${meal.outOfPocketCost.toFixed(2)} within your ${fmt(ctx.dailyTargetBudget)} daily allowance`
      : `is the lowest-cost option for this meal (৳${meal.outOfPocketCost.toFixed(2)})`);
    parts.push(`gives ${meal.nutrition.calories} kcal and ${meal.nutrition.protein} g protein`);
    const last = parts.pop();
    return 'Suggested because it ' + (parts.length ? parts.join(', ') + ' and ' : '') + last + '.';
  }

  // ---------------------------------------------------------------------------
  // 6. Alternatives & saving tips (all numbers are computed from the data)
  // ---------------------------------------------------------------------------
  function buildAlternatives(c) {
    const out = [];
    const unit = c.timeframe === 'weekly' ? 'weekly' : 'daily';
    const perDay = c.periodDays > 1 ? ` (about ${fmt(c.minimumPeriodCost / c.periodDays)} per day)` : '';

    if (!c.fitsBudget) {
      const shortfall = round2(c.totalCost - c.periodBudget);
      out.push({
        title: 'Your budget is too low for a full plan',
        type: 'warning',
        description: `Your ${unit} budget of ${fmt(c.periodBudget)} is ${fmt(shortfall)} short of the lowest-cost plan we can build (${fmt(c.minimumPeriodCost)}). The cheapest plan is shown instead of hiding the gap.`,
        actionTip: `Minimum estimated ${unit} budget: ${fmt(c.minimumPeriodCost)}${perDay}.`
      });

      // What the budget can realistically cover, per day
      const allowance = c.periodBudget / c.periodDays;
      const singles = SLOTS.map(slot => {
        const best = [...c.pools[slot]].sort((a, b) => a.outOfPocketCost - b.outOfPocketCost)[0];
        return { slot, meal: best };
      }).sort((a, b) => a.meal.outOfPocketCost - b.meal.outOfPocketCost);
      let left = allowance;
      const affordable = [];
      singles.forEach(s => { if (s.meal.outOfPocketCost <= left + 1e-9) { affordable.push(s); left = round2(left - s.meal.outOfPocketCost); } });
      if (affordable.length === 0) {
        out.push({
          title: 'What your budget can cover',
          type: 'tip',
          description: `Even the cheapest single meal (${singles[0].meal.name}, about ${fmt(singles[0].meal.outOfPocketCost)}) costs more than your allowance of ${fmt(allowance)} per day.`,
          actionTip: 'Try a higher budget, or add ingredients you already have at home.'
        });
      } else {
        const need = round2(SLOTS.length - affordable.length);
        out.push({
          title: 'What your budget can cover',
          type: 'tip',
          description: `With about ${fmt(allowance)} per day you can afford ${affordable.length} of 3 meals: ${affordable.map(a => `${SLOT_LABELS[a.slot]} (${a.meal.name}, ${fmt(a.meal.outOfPocketCost)})`).join('; ')}.`,
          actionTip: need > 0 ? `The other ${need} meal${need > 1 ? 's' : ''} would need more budget or items from your pantry.` : ''
        });
      }
    }

    // Pantry what-ifs: how much would having one more staple at home reduce the minimum cost?
    if (!c.fitsBudget || c.pantryItemsCount === 0) {
      const base = c.cheapest.cost;
      const what = [];
      BANGLADESHI_FOOD_DATABASE.forEach(food => {
        if (c.pantrySet.has(food.id)) return;
        const trial = new Set(c.pantrySet); trial.add(food.id);
        const { pools } = buildPools(c.preference, trial);
        const saved = round2(base - cheapestDay(pools).cost);
        if (saved >= 3) what.push({ food, saved });
      });
      what.sort((a, b) => b.saved - a.saved);
      what.slice(0, 2).forEach(w => out.push({
        title: `If you already have ${w.food.shortName.toLowerCase()} at home`,
        type: 'pantry-tip',
        description: `The lowest-cost day would drop by about ${fmt(w.saved)} because you would not need to buy it.`,
        actionTip: 'Add it to "Ingredients at home" to see the plan update.'
      }));
    }

    // Cheaper swaps (computed from the pools; weekly savings count every appearance)
    const counts = new Map();
    c.days.forEach(day => SLOTS.forEach(slot => {
      const m = day.meals[slot];
      const k = slot + '|' + m.id;
      counts.set(k, { slot, meal: m, n: (counts.get(k) ? counts.get(k).n : 0) + 1 });
    }));
    const swaps = [];
    counts.forEach(({ slot, meal, n }) => {
      const alt = [...c.pools[slot]].filter(r => r.id !== meal.id).sort((a, b) => a.outOfPocketCost - b.outOfPocketCost)[0];
      if (!alt) return;
      const each = round2(meal.outOfPocketCost - alt.outOfPocketCost);
      if (each >= 3) swaps.push({ slot, meal, alt, each, total: round2(each * n), n });
    });
    swaps.sort((a, b) => b.total - a.total).slice(0, 2).forEach(s => {
      const dCal = s.alt.nutrition.calories - s.meal.nutrition.calories;
      const dPro = round1(s.alt.nutrition.protein - s.meal.nutrition.protein);
      const sign = n => (n > 0 ? '+' : '') + n;
      out.push({
        title: `Cheaper ${SLOT_LABELS[s.slot].toLowerCase()}: ${s.alt.name}`,
        type: 'savings-swap',
        description: `Swapping "${s.meal.name}" for "${s.alt.name}" would save about ${fmt(s.total)}${s.n > 1 ? ` over the week (${s.n} meals)` : ''}. Nutrition change: ${sign(dCal)} kcal, ${sign(dPro)} g protein.`,
        actionTip: 'Choose the "Maximum Savings" preference to get the lowest-cost plan automatically.'
      });
    });

    if (c.pantryItemsCount === 0 && c.fitsBudget) {
      out.push({
        title: 'Pantry savings tip',
        type: 'tip',
        description: 'No pantry items are marked yet. Ingredients you already have at home are not charged to your food budget.',
        actionTip: 'Check your kitchen and add them under "Ingredients at home".'
      });
    }

    if (c.fitsBudget && c.remainingBudget > c.periodBudget * 0.35) {
      out.push({
        title: 'Room left in your budget',
        type: 'tip',
        description: `This plan leaves ${fmt(c.remainingBudget)} unspent. You could save it, or try the "High-Protein" preference to use more of your budget on protein foods.`,
        actionTip: ''
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 7. Shopping list totals
  // ---------------------------------------------------------------------------
  /** Recalculates every item's cost from its quantity and returns list totals. */
  function calculateShoppingListTotals(items) {
    if (!Array.isArray(items)) return { grandTotal: 0, pendingTotal: 0, purchasedTotal: 0, purchasedCount: 0, totalCount: 0 };
    let grand = 0, pending = 0, bought = 0, boughtCount = 0;
    items.forEach(item => {
      const cost = calculateIngredientCost(item.foodId, item.quantity);
      item.cost = cost;
      grand += cost;
      if (item.purchased) { bought += cost; boughtCount++; } else { pending += cost; }
    });
    return {
      grandTotal: round2(grand), pendingTotal: round2(pending), purchasedTotal: round2(bought),
      purchasedCount: boughtCount, totalCount: items.length
    };
  }

  return {
    LIMITS, PERIOD_DAYS, SLOTS, SLOT_LABELS, PREFERENCES,
    validateBudget, normalizePantryList, matchPantryItem,
    calculateRecipeMetrics, calculateIngredientCost, calculateShoppingListTotals,
    generateMealPlan
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MealPlannerEngine };
}
