# Foodsphere Nutritio Intelligence: Budget-Aware Meal Planner

A university project that plans **breakfast, lunch and dinner** from **Bangladeshi foods** inside a
**daily or weekly budget in Taka (৳ BDT)**. It shows estimated cost, calories, protein, carbohydrates
and fat for every meal, subtracts the ingredients you already have at home, and builds a shopping list
you can tick off.

It is plain **HTML + CSS + JavaScript**. There is nothing to install and no API key is needed.

> **Honest labels used in the app:** prices are *illustrative estimates* (not live market prices),
> nutrition values are *approximate and not laboratory-verified*, and the recommendations come from
> **transparent rules, not an AI model**. "Diabetic-friendly" is general food information only and
> **not medical advice**.

---

## 1. How to run it on Windows (pick ONE option)

### Option A: easiest (double-click)
1. Unzip the project folder.
2. Open the folder and **double-click `index.html`**. It opens in Chrome or Edge. Done.

### Option B: local server with `start.bat`
Needed only if you want to open the optional screen-test page (`tests/e2e.html`).
1. Double-click **`start.bat`**. A black window opens and your browser goes to `http://localhost:8000/index.html`.
2. Close the black window to stop it.
3. If Windows shows a Microsoft Store window instead, Python is not really installed. Close it and use Option A.

### Option C: VS Code "Live Server"
1. Install VS Code, then the extension **Live Server** (Ritwick Dey).
2. Open the folder in VS Code, right-click `index.html`, choose **Open with Live Server**.

### Option D: Command line (if you have Python or Node)
```
python -m http.server 8000      (then visit http://localhost:8000)
npm start                       (needs Node.js; opens http://localhost:8000)
```

An internet connection is **optional**: it only loads a nicer font. Everything else works offline.

---

## 2. How to use the app
1. **Budget:** choose *Daily* or *Weekly (7 days)*, then type an amount or tap a quick-pick (৳150, ৳250 ...).
   For weekly budgets the app shows the per-day amount (for example ৳1,800/week ≈ ৳257.14/day).
2. **Ingredients at home:** type items (Enter or **Add**; commas work: `rice, eggs, আলু`) or tap the quick buttons.
   Tags can be removed with the **×**. Items you have are **not charged** and are left off the shopping list.
3. **Preference:** Balanced, High-protein, Vegetarian, Diabetic-friendly or Max savings.
4. Press **Generate meal plan**. Everything updates live afterwards when you change any input.
5. In **Shopping list**: tick items as bought, change quantities with **+ / −** or by typing,
   use **Mark all bought**, **Copy list**, **Print**.
6. **Reset all** returns everything to a clean start.

If your budget is too low, the app **does not hide it**. It shows the cheapest possible plan, the
shortfall, the minimum budget needed, what your budget *can* cover, and money-saving tips
(for example, "if you already had rice at home the cheapest day would cost ৳X less").

---

## 3. Project structure
```
Foodsphere-Meal-Planner/
├── index.html              The page (layout and text)
├── css/style.css           All styling (green / cream / white theme, responsive)
├── js/
│   ├── app.js              Screen logic: buttons, forms, drawing the results
│   ├── plannerEngine.js    The "brain": validation, planning, costs, nutrition, shopping list
│   └── icons.js            Hand-drawn SVG food pictures (work offline)
├── data/
│   ├── foods.js            10 foods: price in ৳, nutrition per quantity, aliases (chal, ডিম ...)
│   └── recipes.js          23 Bangladeshi recipes built ONLY from foods.js ingredients
├── tests/
│   ├── unit.html           Double-click: 42 engine tests
│   ├── e2e.html            Needs start.bat: 18 automatic click-through tests
│   ├── engine.tests.js     The engine test definitions (shared)
│   ├── run-node.js         Same engine tests in the terminal: node tests/run-node.js
│   └── e2e-playwright.js   Optional advanced: 30 browser tests (needs Playwright)
├── docs/screenshots/       Pictures for your report
├── start.bat  package.json
├── README.md  DEMO_GUIDE.md  TEST_REPORT.md
```

## 4. How the calculations work (good to explain to judges)
* **Recipe cost** = Σ (ingredient quantity ÷ reference quantity × price). Example: *Dim Khichuri* =
  60 g rice + 40 g daal + 1 egg = ৳4.20 + ৳5.60 + ৳13.50 = **৳23.30**.
* **Recipe nutrition** is computed the same way from the per-ingredient nutrition table.
* **Pantry:** ingredients you own still count for nutrition but cost **৳0** and are excluded from shopping.
* **Plan choice (rule-based):** try every breakfast + lunch + dinner combination that matches your
  preference, keep those within the day's budget, then pick the best score: uses pantry items,
  covers more food groups, reasonable calories, protein, variety across days, plus preference bonuses.
  If nothing fits, the **cheapest** plan is shown and the shortfall is reported.
* **Weekly:** 7 days are planned one after another; whatever is left of the weekly budget is spread
  over the remaining days; meals are penalised for repeating. Totals are sums of the 21 displayed meals.
* **Shopping list:** missing ingredients from all meals are **combined** (e.g. daal for 3 meals = one line).
  The cost and *Remaining* figures at the top follow the shopping list, so if you change a quantity the budget updates.
* Budget limits: ৳5,000 per day / ৳35,000 per week (anything larger is rejected as unrealistic).

## 5. Changing prices or adding foods
Open `data/foods.js`: edit `estimatedPriceBDT` or add a new food. Open `data/recipes.js` to add a
recipe (it just lists `foodId`, `quantity`, `unit`). Run `tests/unit.html`: it checks that every
ingredient exists and the nutrition adds up.

## 6. Adding a real AI model later (design notes)
The planner is deliberately separate from the screen. To add AI safely:
1. Create a small **backend** (Node/Python) that holds the API key in an environment variable. **Never** put a key in `app.js`.
2. Send the backend the budget, pantry and preference; ask the model to choose from the **recipe IDs
   in `data/recipes.js`** (so costs and nutrition still come from the real data).
3. Replace the call to `MealPlannerEngine.generateMealPlan(...)` in `js/app.js` (function `runPlan`)
   with a `fetch` to your backend, and keep the rule-based planner as the offline fallback.
4. Keep the on-screen label honest ("AI-assisted" only when it really is).

## 7. Known limitations
* Only **10 foods and 23 recipes** (no beef, mutton, hilsa, rice varieties, snacks, fruit other than banana).
  Larger budgets cannot buy much more variety.
* Prices and nutrition values are approximate reference numbers, **not live prices** and **not
  independently verified**; the data files say they follow FCTB/USDA-style tables but the individual
  numbers were not re-checked against those sources. Verify them before publishing results.
* Oil, onion, salt and spices are **not** priced or counted.
* Portions are fixed by the recipe (no per-person scaling or calorie targets by age/sex).
* "Diabetic-friendly" is a simple tag (vegetable / lentil / whole-wheat emphasis), not a clinical meal plan.
* Weekly plans assume pantry items last the whole week.
* Settings are not saved between page reloads.
* Tested in headless Chromium on Linux. **Not yet run on a real Windows machine, Safari or Firefox** (see TEST_REPORT.md).

## 8. Troubleshooting
| Problem | Fix |
|---|---|
| Page looks unstyled | Keep the folder structure intact (css/, js/, data/ next to index.html). |
| `start.bat` opens Microsoft Store | Python is not installed. Use Option A (double-click `index.html`). |
| `tests/e2e.html` says "Cannot open the app frame" | Open it via `http://localhost:8000/tests/e2e.html` after running `start.bat`. |
| Bengali text shows boxes | Use an up-to-date Chrome/Edge (Windows 10/11 include Bengali fonts). |
