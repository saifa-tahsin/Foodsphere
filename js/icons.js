/**
 * Foodsphere - small hand-made SVG food illustrations.
 * Drawn in code so the app works fully offline (no image downloads, no licensing issues).
 * Each icon is a 64x64 SVG keyed by the foodId used in data/foods.js.
 */
const FoodIcons = (() => {
  const wrap = body => `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">${body}</svg>`;

  const icons = {
    rice: wrap(`
      <path d="M10 36h44a22 22 0 0 1-44 0z" fill="#2f855a"/>
      <path d="M13 36c0-11 8-19 19-19s19 8 19 19z" fill="#fffaf0" stroke="#e6dcc3" stroke-width="1.5"/>
      <g fill="#e6dcc3"><ellipse cx="25" cy="29" rx="2.4" ry="1.1" transform="rotate(-25 25 29)"/><ellipse cx="34" cy="25" rx="2.4" ry="1.1" transform="rotate(15 34 25)"/><ellipse cx="40" cy="31" rx="2.4" ry="1.1" transform="rotate(-10 40 31)"/><ellipse cx="30" cy="32" rx="2.4" ry="1.1"/></g>`),
    egg: wrap(`
      <path d="M12 34c-2-10 6-18 17-18 7 0 10 4 16 4 7 0 10 7 8 14-2 9-9 15-21 14-10-1-18-6-20-14z" fill="#fffdf7" stroke="#eadfbf" stroke-width="1.5"/>
      <circle cx="31" cy="34" r="9" fill="#f6b300"/><circle cx="28" cy="31" r="2.6" fill="#ffd95e"/>`),
    lentils_daal: wrap(`
      <path d="M8 30h48a24 24 0 0 1-48 0z" fill="#b7791f"/>
      <ellipse cx="32" cy="30" rx="24" ry="6" fill="#f2b230"/>
      <g fill="#d98e0a"><circle cx="22" cy="30" r="1.6"/><circle cx="30" cy="32" r="1.6"/><circle cx="39" cy="29" r="1.6"/><circle cx="45" cy="31" r="1.4"/></g>
      <path d="M28 22c2-5 6-6 9-9" stroke="#cbd5e0" stroke-width="2" fill="none" stroke-linecap="round"/>`),
    potato: wrap(`
      <path d="M10 34c0-12 10-20 24-20 12 0 20 8 20 18 0 12-10 20-24 20-12 0-20-6-20-18z" fill="#c8964f"/>
      <path d="M14 30c3-8 11-13 20-13" stroke="#dcb06a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g fill="#8a5f27"><circle cx="24" cy="38" r="1.6"/><circle cx="36" cy="42" r="1.6"/><circle cx="43" cy="31" r="1.6"/><circle cx="30" cy="28" r="1.3"/></g>`),
    seasonal_vegetables: wrap(`
      <path d="M12 52c-6-18 4-34 22-38-2 20-8 32-22 38z" fill="#38a169"/>
      <path d="M14 50c6-12 12-22 20-34" stroke="#276749" stroke-width="1.6" fill="none"/>
      <path d="M40 54l10-24a4 4 0 0 1 7 3L46 56z" fill="#ed8936"/>
      <path d="M49 28c-1-6 1-9 4-11M53 31c3-4 6-5 9-4" stroke="#48bb78" stroke-width="3" stroke-linecap="round" fill="none"/>`),
    roti: wrap(`
      <circle cx="32" cy="34" r="22" fill="#e9bf7e"/>
      <circle cx="32" cy="34" r="22" fill="none" stroke="#c99650" stroke-width="2"/>
      <g fill="#b47a32"><circle cx="22" cy="28" r="3"/><circle cx="38" cy="24" r="2.4"/><circle cx="43" cy="39" r="3.2"/><circle cx="28" cy="44" r="2.6"/><circle cx="32" cy="34" r="2"/></g>`),
    fish: wrap(`
      <path d="M6 32c8-12 24-16 36-8l12-8v32l-12-8C30 48 14 44 6 32z" fill="#4a90a4"/>
      <path d="M12 32c8-8 20-10 28-5" stroke="#8cc3d1" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="19" cy="29" r="2.6" fill="#fff"/><circle cx="19.6" cy="29" r="1.2" fill="#1a202c"/>`),
    chicken: wrap(`
      <path d="M22 12c10-6 26 2 24 16-1 8-8 12-14 12L20 52" fill="none"/>
      <path d="M16 46l14-14" stroke="#f1e7d0" stroke-width="7" stroke-linecap="round"/>
      <circle cx="12" cy="50" r="4.5" fill="#f1e7d0"/><circle cx="18" cy="54" r="4.5" fill="#f1e7d0"/>
      <path d="M26 36c-8-10-4-22 8-24 12-2 20 8 16 18-3 8-14 12-24 6z" fill="#c9742b"/>
      <path d="M32 20c4-2 9 0 11 4" stroke="#e29a52" stroke-width="3" fill="none" stroke-linecap="round"/>`),
    banana: wrap(`
      <path d="M10 22c4 22 22 34 42 28-2 4-8 8-16 8C18 58 6 42 10 22z" fill="#f6c915"/>
      <path d="M10 22c2-4 6-6 9-6 0 14 10 26 30 30-2 3-3 3-5 4C20 46 8 36 10 22z" fill="#ffe066"/>
      <rect x="9" y="12" width="6" height="9" rx="2" fill="#6b5b2a" transform="rotate(-10 12 16)"/>`),
    milk: wrap(`
      <path d="M20 22l4-10h16l4 10v32a3 3 0 0 1-3 3H23a3 3 0 0 1-3-3z" fill="#ffffff" stroke="#9db4c8" stroke-width="2"/>
      <path d="M20 22h24" stroke="#9db4c8" stroke-width="2"/>
      <rect x="24" y="30" width="16" height="14" rx="3" fill="#63b3ed"/>
      <path d="M28 37c2-3 6-3 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`)
  };

  /** SVG for a food id (falls back to a plate). */
  function icon(foodId) {
    return icons[foodId] || wrap('<circle cx="32" cy="32" r="22" fill="#e2e8f0"/><circle cx="32" cy="32" r="14" fill="#fff"/>');
  }

  /** A row of round ingredient icons for a meal card banner (max 4, most important first). */
  function mealArt(meal) {
    const order = ['fish', 'chicken', 'egg', 'rice', 'roti', 'lentils_daal', 'milk', 'banana', 'potato', 'seasonal_vegetables'];
    const ids = meal.ingredients.map(i => i.foodId)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .slice(0, 4);
    return ids.map((id, i) => `<span class="art-chip" style="--i:${i}">${icon(id)}</span>`).join('');
  }

  return { icon, mealArt };
})();
