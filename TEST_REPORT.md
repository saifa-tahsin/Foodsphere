# Test report

All results below were produced by actually running the tests in this environment
(Linux, Node.js v22, headless **Chromium** via Playwright 1.56). Nothing here is assumed.

## 1. Baseline: the project as uploaded
| Suite | Result |
|---|---|
| `test_runner.html` (6 engine checks) | 6 / 6 passed |
| `e2e_runner.html` (12 checks) | **10 passed, 2 failed** (#3 invalid/empty input messages, #12 button functionality) |

**Root causes, confirmed by experiment:**
* The old end-to-end page ran its checks while the page was still loading, **before** `app.js` had attached any button handlers
  (`app.js` waits for `DOMContentLoaded`). So the Weekly toggle, ingredient chips and Reset appeared "broken" (#12) and the
  negative/oversized-budget checks (#3) failed. When I re-ran the *original* test file against the *original* app with
  only that timing changed, it went from 10/12 to **11/12**.
* The one remaining failure was a **real defect**: the empty-budget message did not say "valid budget"
  (the test expected friendly wording). The rewritten validation fixes this.
* Other real problems found while inspecting: substring pantry matching (`"eggplant"` counted as `egg`), weekly
  budgets produced only a one-day plan, meal costs/savings text was hard-coded rather than calculated, no support for the
  daily/weekly totals, the "diabetic-friendly" tag was on a potato-and-banana breakfast, and the test page used a copy of the
  markup that could drift from the real page.

## 2. Final results (after all changes)
| Suite | How to run | Result |
|---|---|---|
| Engine tests (Node) | `node tests/run-node.js` | **42 / 42 passed** |
| Engine tests (browser) | open `tests/unit.html` | **42 / 42 passed** |
| Screen tests (in-page) | `start.bat`, then `/tests/e2e.html` | **18 / 18 passed** |
| Full UI tests (Playwright) on `file://` | `node tests/e2e-playwright.js` | **30 / 30 passed** |
| Full UI tests (Playwright) over `http://` | `BASE_URL=http://localhost:8000 node ...` | **30 / 30 passed**, 0 HTTP 404s |

Browser-console errors: **0** (the only network failure in this sandbox was the optional Google Font, because the sandbox is offline; the app falls back to system fonts).

### What the tests cover
* **Budget:** empty, whitespace, negative, zero, text (`abc`, `12abc`, `1e3`, `0x10`), `NaN`, `Infinity`, Bengali digits, huge values (daily > ৳5,000, weekly > ৳35,000), valid formats (`1,800`, `৳250`, `250 BDT`), recovery after errors.
* **Daily/weekly:** toggle, presets, per-day conversion (1,400/week → ৳200/day), 7-day plans, day tabs with keyboard arrows, week chart.
* **Pantry:** add by button/Enter/commas/Bengali, duplicate detection (case, spaces, synonyms such as `chal`/`ভাত`), unknown items flagged, whole-word matching, removal, quick buttons toggling, live re-planning.
* **Calculations:** every recipe's cost and nutrition recomputed independently from the food table; meal totals = displayed meals (read back from the page); cost + remaining = budget; weekly totals = sum of all 21 displayed meals; 400 randomised scenarios (daily and weekly, random pantry/preference/budget) keep cost, nutrition, remaining budget, fits-flag, shopping total and pantry exclusion consistent.
* **Preferences:** vegetarian contains no meat/fish/eggs; diabetic-friendly shows the not-medical-advice text and no health-claim wording; high-protein ≥ standard protein; each preference changes the plan; every preference has ≥ 2 recipes per meal (no silent fallback).
* **Low budgets:** brute-force check that the fallback plan is the true minimum; shortfall, minimum budget, "what you can cover", and pantry what-if tips are computed (not hard-coded).
* **Shopping list:** duplicates combined, pantry excluded, + / − / typing / negative input clamped, purchased ticks, mark-all, reset quantities, focus stays in the field while typing, header totals follow the list, copy-to-clipboard.
* **Reset:** after a complicated session every field, tag, toggle, preference, result, tab, list and number returns to the initial state, and a fresh plan afterwards shows no stale data.
* **Every button:** accessible-name audit plus clicking all visible buttons in a weekly plan with no errors.
* **Responsive:** no horizontal scrolling at 1366, 1024, 820, 390 and 320 px; two columns on desktop, one on tablet/mobile.
* **Accessibility:** all inputs labelled, live regions, visible keyboard focus ring, and **text contrast ≥ 4.5:1** on 21 sampled text styles (computed from real colours).
* **Safety/honesty:** page states prices aren't live, nutrition isn't lab-verified, no AI is connected, not medical advice; no forbidden claim words; no API keys in source; HTML typed into the ingredient box is not executed.

### Do the tests really detect bugs?
Yes. I deliberately broke the engine three ways and each was caught: pantry items charged anyway (6 or more tests failed), substring matching restored (1 failed), weekly budget not divided across days (1 failed). Engine restored afterwards; all pass again.

## 3. Bugs found and fixed *during* testing
1. Mobile: the page could scroll sideways by 9 px (grid column stretched by the day tabs). Fixed with `minmax(0, 1fr)`.
2. Status banner icon was invisible (same colour as its background). Fixed.
3. Mobile button order put "Reset all" above the main "Generate" button. Fixed.
4. Plans were too cheap/monotonous at generous budgets: added a food-group variety score.
5. Diabetic-friendly weekly plans were ~1,100 kcal/day: enlarged roti portions and added a visible low-calorie notice.
6. Number formatting inconsistency (`৳5.6` vs `৳5.60`). Fixed.
7. My own new `e2e.html` had three test-sequencing mistakes (not app bugs); corrected without changing any assertion.
8. In `e2e-playwright.js` the keyboard-focus test used a programmatic `focus()` (no focus ring by design); changed to reach the button with the Tab key.

## 4. NOT tested (be honest with the judges)
* **Real Windows machine, real Chrome/Edge**, and `start.bat` (written carefully but **never executed on Windows**).
* **Firefox and Safari** (only Chromium was available).
* **Real phones/tablets** (only emulated viewport sizes) and touch gestures.
* **Screen readers** (NVDA/JAWS/VoiceOver). Only automated checks of labels, roles and contrast.
* **Print preview** appearance (a print stylesheet exists but I did not inspect printed output).
* **Google Fonts** rendering (sandbox was offline).
* **Nutrition and price accuracy** against official sources: values are approximate and were not independently verified.
* Performance on very old devices; the planner evaluates a few hundred combinations per day, which is instant here.

## 5. Remaining known limitations
See README section 7. The most important: only 10 foods / 23 recipes, estimated prices, unverified nutrition values, no oil/spice costs, and no personalised calorie targets.
