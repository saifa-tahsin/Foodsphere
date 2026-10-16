/**
 * OPTIONAL advanced test: drives the real page in a headless browser with Playwright.
 *   npm install --no-save playwright && npx playwright install chromium
 *   node tests/e2e-playwright.js            (tests file:// directly)
 *   BASE_URL=http://localhost:8000 node tests/e2e-playwright.js
 * Beginners can ignore this file: use tests/unit.html and tests/e2e.html instead.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL
  ? process.env.BASE_URL.replace(/\/$/, '') + '/index.html'
  : 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOT_DIR = process.env.SHOT_DIR || null;

const results = [];
let browser;
const ignorable = t => /fonts\.g(oogleapis|static)|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION/.test(t);

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page._errors = []; page._failed = [];
  page.on('console', m => { if (m.type() === 'error' && !ignorable(m.text())) page._errors.push(m.text()); });
  page.on('pageerror', e => page._errors.push('PAGEERROR ' + e.message));
  page.on('requestfailed', r => { if (!ignorable(r.url() + r.failure().errorText)) page._failed.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) page._failed.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE);
  await page.waitForSelector('#budgetInput');
  return page;
}
const num = s => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const neg = s => /−|-/.test(String(s).split('৳')[0]);
async function generate(page) {
  await page.click('#btnGenerate');
  await page.waitForSelector('#resultsContent:not([hidden])');
  await page.waitForFunction(() => !document.getElementById('btnGenerate').disabled);
}
async function mealData(page) {
  return page.$$eval('.meal-card', cards => cards.map(c => ({
    title: c.querySelector('.meal-title').textContent.trim(),
    cost: c.querySelector('.meal-cost-badge').textContent.trim(),
    kcal: parseFloat(c.querySelectorAll('.macro-tile strong')[0].textContent),
    protein: parseFloat(c.querySelectorAll('.macro-tile strong')[1].textContent),
    carbs: parseFloat(c.querySelectorAll('.macro-tile strong')[2].textContent),
    fat: parseFloat(c.querySelectorAll('.macro-tile strong')[3].textContent),
    ingredients: [...c.querySelectorAll('.meal-ing-list li')].map(li => ({
      name: li.querySelector('.ing-name').textContent.trim(), status: li.querySelector('.ing-status').textContent.trim(), qty: li.querySelector('.ing-qty').textContent.trim()
    }))
  })));
}
function test(name, fn) { results.push({ name, fn }); }
const ok = (c, m) => { if (!c) throw new Error('assertion failed: ' + (m || '')); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'eq'}: expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const near = (a, b, tol, m) => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m || 'near'}: expected ~${b} got ${a}`); };
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim());
const visible = (page, sel) => page.isVisible(sel);

// ---------------------------------------------------------------------------
test('01 Initial load: no console errors, no failed requests, empty state shown', async () => {
  const p = await newPage();
  await p.waitForTimeout(400);
  ok(await visible(p, '#emptyHero'), 'empty hero visible');
  ok(!(await visible(p, '#resultsContent')), 'results hidden');
  eq(await p.$$eval('#budgetPresets .chip-btn', b => b.map(x => x.textContent)).then(a => a.join(',')), '৳150,৳250,৳400,৳600');
  eq(await p.$$eval('#quickStaples .staple-chip', b => b.length), 10, '10 quick-select buttons');
  eq(p._errors.length, 0, 'console errors: ' + p._errors.join(' | '));
  eq(p._failed.length, 0, 'failed requests: ' + p._failed.join(' | '));
  const loaded = await p.evaluate(() => [typeof MealPlannerEngine, typeof BANGLADESHI_FOOD_DATABASE, typeof BANGLADESHI_RECIPE_DATABASE, typeof FoodIcons].join());
  eq(loaded, 'object,object,object,object');
  await p.context().close();
});

test('02 Daily/Weekly toggle updates state, labels, presets and aria-pressed', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly');
  ok(await p.$eval('#toggleWeekly', e => e.classList.contains('active')));
  eq(await p.getAttribute('#toggleWeekly', 'aria-pressed'), 'true');
  eq(await p.getAttribute('#toggleDaily', 'aria-pressed'), 'false');
  eq(await text(p, '#budgetLabelText'), 'Weekly Budget');
  eq((await p.$$eval('#budgetPresets .chip-btn', b => b.map(x => x.textContent))).join(','), '৳1,000,৳1,800,৳2,800,৳4,500');
  await p.click('#toggleDaily');
  ok(await p.$eval('#toggleDaily', e => e.classList.contains('active')));
  eq(await text(p, '#budgetLabelText'), 'Daily Budget');
  eq((await p.$$eval('#budgetPresets .chip-btn', b => b.map(x => x.textContent))).join(','), '৳150,৳250,৳400,৳600');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('03 Every budget preset fills the field and highlights', async () => {
  const p = await newPage();
  for (const v of [150, 250, 400, 600]) {
    await p.click(`#budgetPresets .chip-btn[data-value="${v}"]`);
    eq(await p.inputValue('#budgetInput'), String(v));
    eq(await p.getAttribute(`#budgetPresets .chip-btn[data-value="${v}"]`, 'aria-pressed'), 'true');
  }
  await p.click('#toggleWeekly');
  for (const v of [1000, 1800, 2800, 4500]) {
    await p.click(`#budgetPresets .chip-btn[data-value="${v}"]`);
    eq(await p.inputValue('#budgetInput'), String(v));
  }
  await p.context().close();
});

test('04 Budget validation messages (empty, negative, zero, text, huge) and recovery', async () => {
  const p = await newPage();
  const cases = [
    ['', 'valid budget'], ['   ', 'valid budget'], ['-50', 'greater than ৳0'], ['0', 'greater than ৳0'],
    ['abc', 'valid amount'], ['12abc', 'valid amount'], ['1e3', 'valid amount'], ['999999', 'realistic']
  ];
  for (const [val, expect] of cases) {
    await p.fill('#budgetInput', val);
    await p.click('#btnGenerate');
    await p.waitForSelector('#budgetError:not([hidden])');
    const msg = await text(p, '#budgetError');
    ok(msg.includes(expect), `"${val}" -> "${msg}" should include "${expect}"`);
    ok(!(await visible(p, '#resultsContent')), 'no results for invalid budget: ' + val);
    eq(await p.getAttribute('#budgetInput', 'aria-invalid'), 'true');
  }
  await p.click('#toggleWeekly');
  await p.fill('#budgetInput', '35001'); await p.click('#btnGenerate');
  ok((await text(p, '#budgetError')).includes('realistic') && (await text(p, '#budgetError')).includes('week'));
  await p.fill('#budgetInput', '250');                      // typing clears the error
  ok(!(await visible(p, '#budgetError')), 'error clears on typing');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('05 Weekly budget shows per-day conversion (1400 -> ৳200.00/day)', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '1400');
  ok((await text(p, '#budgetHint')).includes('৳200.00 per day'), await text(p, '#budgetHint'));
  await p.context().close();
});

test('06 Pantry: add by Enter and button, Bengali input, comma lists, tags removable', async () => {
  const p = await newPage();
  await p.fill('#ingredientInput', 'Rice'); await p.press('#ingredientInput', 'Enter');
  await p.fill('#ingredientInput', 'ডিম'); await p.click('#btnAddIngredient');
  await p.fill('#ingredientInput', 'potato, daal ,  fish'); await p.click('#btnAddIngredient');
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 5);
  await p.click('#pantryTagsList .tag-item:first-child .tag-remove');
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 4);
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.map(x => x.textContent.replace('×', '').trim()).join(',')), 'ডিম,potato,daal,fish');
  await p.context().close();
});

test('07 Pantry: duplicates blocked (case, spacing, synonyms) with a clear message; empty add warns', async () => {
  const p = await newPage();
  await p.fill('#ingredientInput', 'Rice'); await p.click('#btnAddIngredient');
  for (const dup of ['rice', '  RICE ', 'chal', 'ভাত', 'Rice (চাল)']) {
    await p.fill('#ingredientInput', dup); await p.click('#btnAddIngredient');
    ok((await text(p, '#pantryMessage')).includes('already'), `"${dup}": ${await text(p, '#pantryMessage')}`);
  }
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 1, 'still one tag');
  await p.fill('#ingredientInput', '   '); await p.click('#btnAddIngredient');
  ok((await text(p, '#pantryMessage')).includes('type an ingredient'));
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 1);
  await p.context().close();
});

test('08 Pantry: unknown items (salt, eggplant) are flagged and do not affect the plan', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250');
  await generate(p);
  const base = num(await text(p, '#summaryCostAmount'));
  await p.fill('#ingredientInput', 'salt, eggplant'); await p.click('#btnAddIngredient');
  eq(await p.$$eval('#pantryTagsList .tag-item.unrecognized', t => t.length), 2);
  ok(await visible(p, '#pantryNote'));
  eq(num(await text(p, '#summaryCostAmount')), base, 'unknown items must not change cost (eggplant is not egg)');
  await p.context().close();
});

test('09 Quick-select buttons toggle add/remove and show pressed state', async () => {
  const p = await newPage();
  const chips = await p.$$eval('#quickStaples .staple-chip', c => c.map(x => x.dataset.food));
  for (const id of chips) await p.click(`.staple-chip[data-food="${id}"]`);
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 10);
  eq(await p.$$eval('.staple-chip[aria-pressed="true"]', t => t.length), 10);
  await p.click('.staple-chip[data-food="rice"]');
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 9);
  eq(await p.getAttribute('.staple-chip[data-food="rice"]', 'aria-pressed'), 'false');
  await p.context().close();
});

test('10 Daily plan: 3 meals with all required fields; totals = sum of displayed meals; budget math', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300');
  await generate(p);
  const meals = await mealData(p);
  eq(meals.length, 3);
  const types = await p.$$eval('.meal-type-tag', t => t.map(x => x.textContent));
  eq(types.join(','), 'Breakfast,Lunch,Dinner');
  meals.forEach(m => {
    ok(m.title.length > 3, 'title'); ok(m.ingredients.length >= 2, 'ingredients'); ok(m.ingredients.every(i => i.qty), 'quantities');
    ok(m.kcal > 0 && m.protein > 0 && m.carbs >= 0 && m.fat >= 0, 'nutrition');
  });
  const explain = await p.$$eval('.meal-explain', e => e.map(x => x.textContent));
  ok(explain.every(t => t.includes('Suggested because')), 'every meal explains why');
  const sum = k => Math.round(meals.reduce((a, m) => a + m[k], 0) * 10) / 10;
  eq(num(await text(p, '#valCalories')), sum('kcal'), 'calories total');
  near(num(await text(p, '#valProtein')), sum('protein'), 0.11, 'protein total');
  near(num(await text(p, '#valCarbs')), sum('carbs'), 0.11, 'carbs total');
  near(num(await text(p, '#valFat')), sum('fat'), 0.11, 'fat total');
  const cost = num(await text(p, '#summaryCostAmount')), rem = num(await text(p, '#summaryRemainingAmount'));
  near(cost + rem, 300, 0.005, 'cost + remaining = budget');
  near(cost, meals.reduce((a, m) => a + (num(m.cost) || 0), 0), 0.011, 'cost = sum of meal costs');
  near(cost, num(await text(p, '#shoppingGrandTotal')), 0.005, 'cost = shopping total');
  eq(await text(p, '#resultsBadge'), 'Within budget');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('11 Pantry ingredients: shown "At home", excluded from shopping list and cost', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250');
  await generate(p);
  const before = num(await text(p, '#summaryCostAmount'));
  await p.click('.staple-chip[data-food="rice"]'); await p.click('.staple-chip[data-food="egg"]');
  const after = num(await text(p, '#summaryCostAmount'));
  ok(after < before, `cost should fall (${before} -> ${after})`);
  const names = await p.$$eval('.shop-item-name', e => e.map(x => x.textContent.trim()));
  ok(!names.includes('Rice') && !names.includes('Eggs'), 'shopping list: ' + names);
  const meals = await mealData(p);
  const riceLines = meals.flatMap(m => m.ingredients).filter(i => i.name === 'Rice');
  ok(riceLines.length > 0 && riceLines.every(i => i.status === 'At home'), 'rice marked At home');
  await p.context().close();
});

test('12 Weekly plan: 7 day tabs, week chart, tab switching, arrow keys, weekly totals', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '2100'); await generate(p);
  eq(await p.$$eval('.day-tab', t => t.length), 7);
  eq(await p.$$eval('.week-col', t => t.length), 7);
  ok(await visible(p, '#weekCard'));
  const day1 = (await mealData(p)).map(m => m.title).join('|');
  await p.click('#tab-day-2');
  const day3 = (await mealData(p)).map(m => m.title).join('|');
  eq(await p.getAttribute('#tab-day-2', 'aria-selected'), 'true');
  eq(await p.getAttribute('#tab-day-0', 'aria-selected'), 'false');
  ok(day1 !== day3, 'different meals on different days');
  await p.focus('#tab-day-2'); await p.keyboard.press('ArrowRight');
  eq(await p.getAttribute('#tab-day-3', 'aria-selected'), 'true', 'ArrowRight');
  await p.keyboard.press('End'); eq(await p.getAttribute('#tab-day-6', 'aria-selected'), 'true', 'End');
  await p.click('.week-col[data-day="1"]'); eq(await p.getAttribute('#tab-day-1', 'aria-selected'), 'true', 'chart click selects day');
  const cost = num(await text(p, '#summaryCostAmount')), rem = num(await text(p, '#summaryRemainingAmount'));
  near(cost + rem, 2100, 0.005, 'weekly cost + remaining = budget');
  ok((await text(p, '#kpiCostLabel')).includes('7 days'));
  ok((await text(p, '#nutritionTitle')).includes('week'));
  ok(num(await text(p, '#valCalories')) > 7 * 1000, 'weekly calories are for 7 days');
  near(cost, num(await text(p, '#shoppingGrandTotal')), 0.005, 'weekly cost = shopping total');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('13 Weekly day totals add up to the weekly total (read from the UI day by day)', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '1800'); await generate(p);
  let kcal = 0, cost = 0;
  for (let d = 0; d < 7; d++) {
    await p.click(`#tab-day-${d}`);
    const meals = await mealData(p);
    kcal += meals.reduce((a, m) => a + m.kcal, 0);
    cost += meals.reduce((a, m) => a + (num(m.cost) || 0), 0);
  }
  eq(num(await text(p, '#valCalories')), kcal, 'weekly kcal equals sum of 21 displayed meals');
  near(num(await text(p, '#summaryCostAmount')), cost, 0.06, 'weekly cost equals sum of 21 displayed meals');
  await p.context().close();
});

test('14 Preferences: vegetarian has no meat/fish/egg; diabetic shows not-medical-advice; high-protein works', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300');
  await p.check('input[name="preference"][value="vegetarian"]'); await generate(p);
  for (let i = 0; i < 1; i++) {
    const names = (await mealData(p)).flatMap(m => m.ingredients.map(x => x.name));
    ok(!names.some(n => ['Fish', 'Chicken', 'Eggs'].includes(n)), 'veg ingredients: ' + names);
  }
  await p.check('input[name="preference"][value="diabetic-friendly"]');
  ok(await visible(p, '#medicalNote'), 'medical note under preferences');
  ok(/not medical advice/i.test(await text(p, '#medicalNote')));
  const banner = await text(p, '#formStatusText');
  ok(/not medical advice/i.test(banner) && /does not treat or prevent diabetes/i.test(banner), banner);
  await p.check('input[name="preference"][value="high-protein"]');
  ok(!(await visible(p, '#medicalNote')));
  ok(await visible(p, '.meal-card'));
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('15 Preference changes recompute the plan live and differ from each other', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '400'); await generate(p);
  const seen = new Set();
  for (const pref of ['standard', 'high-protein', 'vegetarian', 'diabetic-friendly', 'budget-saver']) {
    await p.check(`input[name="preference"][value="${pref}"]`);
    seen.add((await mealData(p)).map(m => m.title).join('|'));
  }
  ok(seen.size >= 4, 'distinct plans per preference: ' + seen.size);
  await p.context().close();
});

test('16 Too-low budget: honest warning, shortfall, minimum cost, alternatives (daily and weekly)', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '20'); await generate(p);
  ok((await text(p, '#formStatusText')).includes('too low'));
  eq(await text(p, '#resultsBadge'), 'Over budget');
  ok(neg(await text(p, '#summaryRemainingAmount')) || (await text(p, '#kpiRemainLabel')).includes('Over'), 'over-budget shown');
  ok(await p.$eval('#summaryRemainingAmount', e => e.classList.contains('negative')));
  ok((await text(p, '#alternativesListContainer')).includes('Minimum estimated daily budget'));
  ok((await text(p, '#alternativesListContainer')).includes('What your budget can cover'));
  ok((await mealData(p)).length === 3, 'still shows the cheapest real plan');
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '200');
  await p.waitForFunction(() => document.getElementById('resultsBadge').textContent === 'Over budget');
  ok((await text(p, '#alternativesListContainer')).includes('Minimum estimated weekly budget'));
  await p.fill('#budgetInput', '2000');
  await p.waitForFunction(() => document.getElementById('resultsBadge').textContent === 'Within budget');
  await p.context().close();
});

test('17 Shopping list: + / − / typing update cost and totals; summary follows; reset quantities', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300'); await generate(p);
  const rowSel = '.shop-row:first-child';
  const q0 = num(await p.inputValue(`${rowSel} .qty-input-field`));
  const c0 = num(await text(p, `${rowSel} .shop-cost`));
  const total0 = num(await text(p, '#shoppingGrandTotal'));
  await p.click(`${rowSel} [data-action="inc"]`);
  const q1 = num(await p.inputValue(`${rowSel} .qty-input-field`));
  ok(q1 > q0, 'increase'); ok(num(await text(p, `${rowSel} .shop-cost`)) > c0, 'cost up');
  ok(num(await text(p, '#shoppingGrandTotal')) > total0, 'grand total up');
  near(num(await text(p, '#summaryCostAmount')), num(await text(p, '#shoppingGrandTotal')), 0.005, 'summary follows list');
  ok(await visible(p, '#adjustNote'), 'adjust note shown');
  await p.click(`${rowSel} [data-action="dec"]`); await p.click(`${rowSel} [data-action="dec"]`);
  ok(num(await p.inputValue(`${rowSel} .qty-input-field`)) < q0, 'decrease below original');
  await p.fill(`${rowSel} .qty-input-field`, '-40');            // negative typed -> clamped
  await p.press(`${rowSel} .qty-input-field`, 'Tab');
  eq(num(await p.inputValue(`${rowSel} .qty-input-field`)), 0, 'clamped to 0');
  near(num(await text(p, `${rowSel} .shop-cost`)), 0, 0.001);
  await p.fill(`${rowSel} .qty-input-field`, '500'); await p.press(`${rowSel} .qty-input-field`, 'Tab');
  ok(num(await text(p, `${rowSel} .shop-cost`)) > c0, '500 costs more');
  await p.click('#btnResetQuantities');
  eq(num(await p.inputValue(`${rowSel} .qty-input-field`)), q0, 'qty restored');
  near(num(await text(p, '#shoppingGrandTotal')), total0, 0.005, 'total restored');
  ok(!(await visible(p, '#adjustNote')), 'note hidden again');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('18 Shopping list: typing keeps keyboard focus in the quantity field', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300'); await generate(p);
  const sel = '.shop-row:first-child .qty-input-field';
  await p.click(sel); await p.keyboard.press('Control+A'); await p.keyboard.type('250');
  const focused = await p.evaluate(() => document.activeElement && document.activeElement.className);
  ok(String(focused).includes('qty-input-field'), 'focus kept, active: ' + focused);
  eq(num(await p.inputValue(sel)), 250);
  await p.context().close();
});

test('19 Purchased checkboxes, Mark all / Unmark all, bought/pending totals', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300'); await generate(p);
  const n = await p.$$eval('.shop-row', r => r.length);
  ok(n >= 3);
  const total = num(await text(p, '#shoppingGrandTotal'));
  await p.check('.shop-row:first-child .shop-check');
  ok(await p.$eval('.shop-row:first-child', r => r.classList.contains('is-purchased')));
  const bought = num(await text(p, '#shopTotalBought')), pending = num(await text(p, '#shopTotalPending'));
  const firstCost = num(await text(p, '.shop-row:first-child .shop-cost'));
  near(bought, firstCost, 0.005); near(bought + pending, total, 0.011);
  near(num(await text(p, '#shoppingGrandTotal')), total, 0.005, 'buying does not change the total');
  ok((await text(p, '#shopProgressPill')).includes(`1 of ${n}`));
  await p.click('#btnToggleAllPurchased');
  eq(await p.$$eval('.shop-check:checked', c => c.length), n);
  eq(await text(p, '#btnToggleAllPurchased'), 'Unmark all');
  near(num(await text(p, '#shopTotalPending')), 0, 0.001);
  await p.click('#btnToggleAllPurchased');
  eq(await p.$$eval('.shop-check:checked', c => c.length), 0);
  await p.context().close();
});

test('20 Purchased ticks survive live plan updates for items that remain', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '300'); await generate(p);
  const firstName = await text(p, '.shop-row:first-child .shop-item-name');
  await p.check('.shop-row:first-child .shop-check');
  await p.click('#budgetPresets .chip-btn[data-value="400"]');
  const row = await p.$$eval('.shop-row', (rows, name) => rows.filter(r => r.querySelector('.shop-item-name').textContent.trim() === name).map(r => r.classList.contains('is-purchased')), firstName);
  if (row.length) ok(row[0] === true, 'tick kept for ' + firstName);
  await p.context().close();
});

test('21 Live updates: preset, pantry add/remove and typing a new budget recompute the plan', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250'); await generate(p);
  const c0 = num(await text(p, '#summaryCostAmount'));
  await p.click('.staple-chip[data-food="fish"]'); ok(num(await text(p, '#summaryCostAmount')) <= c0, 'adding fish does not raise cost');
  await p.click('#pantryTagsList .tag-remove');
  near(num(await text(p, '#summaryCostAmount')), c0, 0.005, 'removing tag restores cost');
  await p.fill('#budgetInput', '35');
  await p.waitForFunction(() => document.getElementById('resultsBadge').textContent === 'Over budget');
  await p.fill('#budgetInput', '');
  await p.waitForSelector('#budgetError:not([hidden])');
  ok(await visible(p, '#emptyHero'), 'emptying the budget clears the results');
  await p.context().close();
});

test('22 Reset all restores a clean state after a complex session (no stale values)', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '1800');
  await p.click('.staple-chip[data-food="rice"]'); await p.fill('#ingredientInput', 'salt'); await p.click('#btnAddIngredient');
  await p.check('input[name="preference"][value="diabetic-friendly"]');
  await generate(p);
  await p.click('#tab-day-3'); await p.check('.shop-row:first-child .shop-check'); await p.click('.shop-row:first-child [data-action="inc"]');
  await p.click('#btnReset');
  eq(await p.inputValue('#budgetInput'), '');
  eq(await p.inputValue('#ingredientInput'), '');
  eq(await p.$$eval('#pantryTagsList .tag-item', t => t.length), 0);
  eq(await p.$$eval('.staple-chip[aria-pressed="true"]', t => t.length), 0);
  ok(await p.$eval('#toggleDaily', e => e.classList.contains('active')), 'daily active');
  eq(await p.getAttribute('#toggleWeekly', 'aria-pressed'), 'false');
  eq(await text(p, '#budgetLabelText'), 'Daily Budget');
  eq(await p.$eval('input[name="preference"]:checked', e => e.value), 'standard');
  ok(!(await visible(p, '#medicalNote')) && !(await visible(p, '#pantryNote')) && !(await visible(p, '#budgetError')));
  ok(await visible(p, '#emptyHero')); ok(!(await visible(p, '#resultsContent')));
  ok(!(await visible(p, '#formStatusBox')));
  eq(await p.$$eval('.shop-row', r => r.length), 0); eq(await p.$$eval('.meal-card .meal-title', r => r.length), 0);
  eq(await p.$$eval('.day-tab', r => r.length), 0);
  eq(await text(p, '#summaryCostAmount'), '৳0.00 BDT'); eq(await text(p, '#summaryRemainingAmount'), '৳0.00 BDT');
  eq(num(await text(p, '#valCalories')), 0);
  eq((await p.$$eval('#budgetPresets .chip-btn', b => b.map(x => x.textContent))).join(','), '৳150,৳250,৳400,৳600');
  // A fresh run after reset must not reuse old state (no pantry, standard, daily)
  await p.fill('#budgetInput', '250'); await generate(p);
  eq(await p.$$eval('.day-tab', r => r.length), 0, 'daily after reset has no day tabs');
  ok(!(await visible(p, '#medicalNote')));
  const names = await p.$$eval('.shop-item-name', e => e.map(x => x.textContent.trim()));
  ok(names.includes('Rice') || (await mealData(p)).flatMap(m => m.ingredients).every(i => i.status !== 'At home'), 'no stale pantry after reset');
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('23 Enter key in the budget field generates a plan; keyboard reaches all controls', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250'); await p.press('#budgetInput', 'Enter');
  await p.waitForSelector('#resultsContent:not([hidden])');
  await p.focus('#toggleDaily');
  const seen = new Set();
  for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  ok(seen.has('btnGenerate') && seen.has('btnReset'), 'tab reaches Generate and Reset');
  await p.context().close();
});

test('24 Copy list puts the shopping list on the clipboard', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250'); await generate(p);
  await p.click('#btnCopyList');
  await p.waitForTimeout(300);
  let clip = '';
  try { clip = await p.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = 'ERR ' + e.message; }
  ok(clip.includes('Foodsphere shopping list') && clip.includes('Total: ৳'), 'clipboard: ' + clip.slice(0, 80));
  await p.context().close();
});

test('25 Button audit: every visible button has a name and clicking each throws no errors', async () => {
  const p = await newPage();
  await p.click('#toggleWeekly'); await p.fill('#budgetInput', '2000');
  await p.click('.staple-chip[data-food="rice"]'); await generate(p);
  const unnamed = await p.$$eval('button', bs => bs.filter(b => b.offsetParent !== null && !(b.textContent.trim() || b.getAttribute('aria-label'))).length);
  eq(unnamed, 0, 'buttons without accessible name');
  const skip = new Set(['btnReset', 'btnPrint', 'btnCopyList']);
  let clicked = 0;
  const n = await p.$$eval('button', bs => bs.length);
  for (let i = 0; i < n; i++) {
    const btns = await p.$$('button');
    if (i >= btns.length) break;
    const b = btns[i];
    const id = await b.getAttribute('id');
    if (skip.has(id) || id === 'btnGenerate' || !(await b.isVisible())) continue;
    try { await b.click({ timeout: 800 }); clicked++; } catch (e) { /* element replaced by a re-render */ }
  }
  ok(clicked > 20, 'clicked ' + clicked);
  await p.click('#btnGenerate'); await p.waitForFunction(() => !document.getElementById('btnGenerate').disabled);
  eq(p._errors.length, 0, p._errors.join('|'));
  await p.context().close();
});

test('26 Responsive: no horizontal scrolling at 1366 / 1024 / 820 / 390 / 320 wide', async () => {
  for (const w of [1366, 1024, 820, 390, 320]) {
    const p = await newPage({ viewport: { width: w, height: 900 } });
    await p.click('#toggleWeekly'); await p.fill('#budgetInput', '1800'); await p.click('.staple-chip[data-food="rice"]'); await generate(p);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    eq(over, 0, `${w}px overflow ${over}`);
    const wide = await p.evaluate(() => [...document.querySelectorAll('.card, .meal-card, .kpi, .shop-row')].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
    eq(wide, 0, `${w}px elements overflowing viewport`);
    if (SHOT_DIR) await p.screenshot({ path: `${SHOT_DIR}/weekly_${w}.png`, fullPage: true });
    await p.context().close();
  }
});

test('27 Responsive: single-column stacking on tablet/mobile, two-column on desktop', async () => {
  let p = await newPage({ viewport: { width: 1366, height: 900 } });
  let cols = await p.$eval('.dashboard-grid', e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  eq(cols, 2, 'desktop 2 columns'); await p.context().close();
  p = await newPage({ viewport: { width: 820, height: 900 } });
  cols = await p.$eval('.dashboard-grid', e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
  eq(cols, 1, 'tablet 1 column'); await p.context().close();
});

test('28 Accessibility: labelled controls, aria-live regions, focus outline, text contrast >= 4.5:1', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250'); await generate(p);
  const unlabeled = await p.$$eval('input, select, textarea', els => els.filter(e => {
    if (e.type === 'hidden') return false;
    return !(e.getAttribute('aria-label') || (e.labels && e.labels.length) || e.closest('label'));
  }).map(e => e.id || e.name));
  eq(unlabeled.length, 0, 'unlabelled: ' + unlabeled);
  ok(await p.$eval('#resultsPanel', e => e.getAttribute('aria-live') === 'polite'));
  eq(await p.getAttribute('#budgetError', 'role'), 'alert');
  eq(await p.$eval('html', e => e.lang), 'en');
  const low = await p.evaluate(() => {
    function lum(c) { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
    function parse(s) { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; }
    function bg(el) { while (el) { const b = parse(getComputedStyle(el).backgroundColor); if (b && b.a > 0.95) return b.c; el = el.parentElement; } return [255, 255, 255]; }
    const sels = ['.card-subtitle', '.form-hint', '.kpi-label', '.chips-label', '.nutri-ref', '.nutrition-note', '.ing-qty', '.meal-desc', '.shop-item-for', '.alt-desc', '.badge-subtle', '.progress-legend span', '.macro-tile span', '.meal-value', '.btn-primary', '.brand-badge', '.footer-subtext', '.pref-body small', '.step legend', '.currency-code', '.meal-bengali-title'];
    const out = [];
    sels.forEach(s => { const el = document.querySelector(s); if (!el) return; const fg = parse(getComputedStyle(el).color).c; const b = bg(el); const L1 = lum(fg), L2 = lum(b); const r = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); if (r < 4.5) out.push(s + ' ' + r.toFixed(2)); });
    return out;
  });
  eq(low.length, 0, 'low contrast: ' + low.join(', '));
  await p.focus('#budgetInput');
  for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => document.activeElement.id === 'btnGenerate')) break; }
  const outline = await p.$eval('#btnGenerate', e => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineWidth);
  ok(!/none/.test(outline), 'focus outline visible: ' + outline);
  await p.context().close();
});

test('29 Safety copy: estimates, no live-price/AI/medical claims, honest AI status', async () => {
  const p = await newPage();
  await p.fill('#budgetInput', '250'); await generate(p);
  const body = await p.evaluate(() => document.body.innerText);
  ok(/not live market prices/i.test(body), 'states prices are not live');
  ok(/not laboratory-verified/i.test(body), 'states nutrition is not lab verified');
  ok(/no AI API connected/i.test(body), 'states no AI connected');
  ok(/not medical advice/i.test(body), 'medical disclaimer present');
  ok(!/\b(cures?|prevents? diabetes|treats? diabetes|lowers? blood sugar|guarantee[ds]?|clinically proven|live prices?|powered by (gpt|openai|claude|ai))\b/i.test(body.replace(/does not treat or prevent diabetes/gi, '').replace(/not live market prices/gi, '')), 'no forbidden claims');
  await p.context().close();
});

test('30 Security basics: no API keys/secrets in source; user text is escaped (no HTML injection)', async () => {
  const p = await newPage();
  await p.fill('#ingredientInput', '<img src=x onerror=window.__pwned=1>'); await p.click('#btnAddIngredient');
  await p.fill('#budgetInput', '250'); await generate(p);
  eq(await p.evaluate(() => window.__pwned), undefined, 'injected HTML must not run');
  eq(await p.$$eval('#pantryTagsList img', i => i.length), 0);
  const src = await p.evaluate(async () => (await Promise.all(['js/app.js', 'js/plannerEngine.js', 'js/icons.js', 'data/foods.js', 'data/recipes.js'].map(f => fetch(f).then(r => r.text()).catch(() => '')))).join('\n'));
  if (src.length > 1000) ok(!/(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{8,})/i.test(src), 'no secrets in source');
  await p.context().close();
});

// ---------------------------------------------------------------------------
(async () => {
  browser = await chromium.launch();
  let pass = 0, fail = 0;
  for (const t of results) {
    try { await t.fn(); pass++; console.log('  PASS  ' + t.name); }
    catch (e) { fail++; console.log('  FAIL  ' + t.name + '\n        -> ' + String(e.message).split('\n')[0].slice(0, 400)); }
  }
  console.log(`\n${pass} passed, ${fail} failed, ${results.length} total  (${BASE})`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
