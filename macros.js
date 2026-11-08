'use strict';
/* Macro/calorie consistency for foods (values per 100 g). Calories ARE the macros at 4/4/9 kcal per gram of protein/carbs/fat.
   check() is what the custom food form enforces on Save (strictly):
     - protein + carbs + fat can never exceed 100 g in 100 g of food;
     - the calories must equal what the macros give (only the 1 kcal of rounding is allowed).
   Plain script: globalThis.Macros (works in the browser and in jsc for tests). */
(function (root) {
  const TOL = 1;   // kcal: rounding only
  const kcal = (p, c, f) => Math.round(p * 4 + c * 4 + f * 9);
  /** n: { kcal, p, c, f } per 100 g. Returns null when fine, or { kind: 'sum', total } / { kind: 'kcal', calc }. */
  function check(n) {
    const p = +n.p || 0, c = +n.c || 0, f = +n.f || 0, k = +n.kcal || 0, total = p + c + f;
    if (total > 100.0001) return { kind: 'sum', total: Math.round(total * 10) / 10 };
    const calc = kcal(p, c, f);
    if (Math.abs(k - calc) > TOL) return { kind: 'kcal', calc };
    return null;
  }
  root.Macros = { kcal, check, TOL };
})(typeof globalThis !== 'undefined' ? globalThis : this);
