/* Runs the engine tests from the command line:  node tests/run-node.js  (needs Node.js) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console }; vm.createContext(ctx);
['data/foods.js', 'data/recipes.js', 'js/plannerEngine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
vm.runInContext('this.__E = MealPlannerEngine; this.__F = BANGLADESHI_FOOD_DATABASE; this.__R = BANGLADESHI_RECIPE_DATABASE;', ctx);
const { defineEngineTests } = require('./engine.tests.js');

const results = [];
const t = {
  test: (name, fn) => results.push({ name, fn }),
  eq: (a, b, m) => { if (a !== b) throw new Error(`${m || 'eq'}: expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`); },
  ok: (c, m) => { if (!c) throw new Error('assertion failed' + (m ? ': ' + m : '')); },
  near: (a, b, tol, m) => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${m || 'near'}: expected ~${b} but got ${a}`); }
};
defineEngineTests(t, ctx.__E, ctx.__F, ctx.__R);
let pass = 0, fail = 0;
results.forEach(r => {
  try { r.fn(); pass++; console.log('  PASS  ' + r.name); }
  catch (e) { fail++; console.log('  FAIL  ' + r.name + '\n        -> ' + e.message); }
});
console.log(`\n${pass} passed, ${fail} failed, ${results.length} total`);
process.exit(fail ? 1 : 0);
