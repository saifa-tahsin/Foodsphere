# Demonstration guide for the university judges (about 6 minutes)

The planner is **deterministic**: the same inputs always give the same result, so the numbers
below should appear on your screen exactly as written. Practise once before the demo.

**Before you start:** open `index.html` in Chrome/Edge, press **F11** for full screen, zoom 100%.
Have the project folder open in VS Code in case you are asked to show code.

---

## Part 1: The problem (30 seconds)
> "Many families in Bangladesh plan food by budget first. My feature, the **Budget-Aware Meal Planner**,
> turns a Taka budget into breakfast, lunch and dinner, with cost, nutrition and a shopping list,
> and it is honest about what it can and cannot do."

Point to the header badge: **"Rule-based planner · no AI API connected"**. Say it first. Judges respect honesty.

## Part 2: Daily plan with pantry (90 seconds)
1. Daily is selected. Tap the **৳250** quick pick.
2. Tap **+ Rice** and **+ Eggs** (they become green tags).
   *Show that typing "rice" in the box and pressing Enter is refused: "already in your list".*
3. Press **Generate meal plan**.
4. Expected with only Rice and Eggs at home: **estimated cost ৳24.05, remaining ৳225.95**
   (breakfast Quick Dim Khichuri ৳5.60, lunch Dim Bhuna & Ghono Daal ৳9.25, dinner Bhaat with Alu Bhorta ৳9.20).
5. Explain a meal card: ingredients with quantities, "At home" vs price, the **"Why this meal?"** sentence,
   calories and macros. *"Every number is calculated from the ingredient table, nothing is typed in by hand."*
6. Tap **Rice** tag's × to remove it: the plan **updates live** and the cost rises.

## Part 3: Compare with nothing at home (30 seconds)
Press **Reset all**, then tap ৳250 and Generate. Expected: **৳115.25 cost, ৳134.75 remaining**,
shopping list of 7 items. "Using what you already have saved ৳91."

## Part 4: Shopping list (60 seconds)
* Tick an item: **Bought / Still to buy** totals change, the grand total does not.
* Press **+** on Fish: its price and the **Estimated cost** at the top both rise,
  and a note says the plan includes your shopping-list changes. **Reset quantities** undoes it.
* Show **Copy list** (paste into Notepad) and **Print**.

## Part 5: Weekly plan (60 seconds)
1. Press **Reset all**, choose **Weekly**, tap **৳1,800**. Note the hint **≈ ৳257.14 per day**.
2. Add Rice and Daal, press Generate.
3. Expected: **7 day tabs, cost ৳455.15, remaining ৳1,344.85**, weekly nutrition **10,917 kcal**
   (average ≈ 1,560 kcal/day). Click different days and the bars in "Week at a glance".
4. "Meals are varied across the week; the shopping list combines all 21 meals into one list."

## Part 6: Honesty when the budget is too low (60 seconds)
1. **Reset all**, Daily, type **30**, Generate.
2. Expected: **orange warning**: the cheapest possible plan costs **৳54.50**, which is **৳24.50 over**.
   The app does not hide this. Show **Smart alternatives**: minimum budget, what ৳30 *can* cover,
   and "if you already had roti at home, the cheapest day would cost ৳22.25 less".
3. Type **-50**, **0**, **abc**, **999999** one at a time to show friendly validation messages.

## Part 7: Preferences and safety (45 seconds)
* **Vegetarian** (try ৳300): no fish, chicken or eggs (cost ৳73.20).
* **Diabetic-friendly**: a blue note appears: *"Not medical advice… does not treat or prevent diabetes."*
  The planner also warns when a plan is low in calories (about 1,355 kcal at ৳300).
  *"I did not want to claim any health benefit I cannot prove."*

## Part 8: Quality evidence (30 seconds)
Open `tests/unit.html` → **42 passed**. Mention: 400 randomised scenarios check that cost,
nutrition, remaining budget and shopping list always agree. Show `TEST_REPORT.md` for the full results.

---

## Questions judges may ask (and honest answers)

**Is this real AI?** No. It is a transparent rule-based recommender (scoring + constraints). This is a
design choice: costs and nutrition must be exact and explainable. The code is structured so an AI
model can be added later through a backend (README section 6).

**Where do prices come from?** They are illustrative estimates I stored in `data/foods.js`; they are
not live market prices. The app says so on screen. A future version could use a price API or
user-entered prices.

**Are the nutrition values accurate?** They are approximate reference values per quantity, not
laboratory-verified and not individually re-checked against FCTB/USDA yet. The app labels them as estimates.

**Why only 23 recipes?** To keep every recipe's data checkable. More recipes only require adding rows to `recipes.js`.

**How do you stop wrong totals?** The engine rounds each ingredient once and sums those numbers for
meals, days, the week and the shopping list. 400 random tests check they all agree.

**What happens with weird inputs?** Empty, negative, zero, text, scientific notation and very large budgets
are rejected with clear messages. HTML typed into the ingredient box is shown as plain text (no injection).

**What would you improve next?** More foods and recipes (beef, hilsa, seasonal vegetables), per-person
portions and calorie targets, user-editable prices, saving plans, Bangla language toggle,
oil/spice costs, and a backend AI assistant.

## If something goes wrong during the demo
* Page looks odd → press **Ctrl+F5**.
* Fonts missing (no internet) → harmless, the app falls back to Segoe UI.
* Want a clean slate quickly → **Reset all** button.
