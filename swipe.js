'use strict';
/* Swipe a list row to the left to delete it. The decision logic (intent, threshold) is plain functions so tests can run them;
   attach() wires the touch handling with addEventListener (the Content-Security-Policy forbids inline handlers).
   Only touch and pen drags count: with a mouse, the normal tap -> sheet -> Delete route is used. A drag that is mostly vertical,
   or to the right, is left to the browser, so scrolling and the iOS back-swipe keep working.
   Plain script: globalThis.Swipe (works in the browser and in jsc for tests). */
(function (root) {
  const LOCK = 10, RATIO = 1.5;
  /** Which gesture is this drag so far? 'wait' (too small to tell), 'swipe' (mostly horizontal, to the left) or 'scroll' (anything else: not ours). */
  function intent(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < LOCK && ay < LOCK) return 'wait';
    return dx < 0 && ax > ay * RATIO ? 'swipe' : 'scroll';
  }
  /** How far (px) the row must be dragged left to delete: 35% of its width, but between 70 and 120 px. */
  const threshold = width => Math.max(70, Math.min(120, width * 0.35));
  const commits = (dx, width) => -dx >= threshold(width);
  /** How far the row follows the finger: never right of its resting place, never further than its own width. */
  const clamp = (dx, width) => Math.max(-width, Math.min(0, dx));

  /** container: element holding the rows. rowSel: CSS selector of a swipeable row. onDelete(row): called after a committed swipe. */
  function attach(container, { rowSel, onDelete }) {
    let cur = null, swipedAt = 0;
    container.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || e.isPrimary === false) return;
      const row = e.target.closest && e.target.closest(rowSel);
      if (!row || e.target.closest('button, a, input, select, textarea')) return;
      cur = { row, id: e.pointerId, x: e.clientX, y: e.clientY, mode: 'wait', dx: 0, w: row.offsetWidth || 300 };
    });
    container.addEventListener('pointermove', e => {
      if (!cur || e.pointerId !== cur.id) return;
      const dx = e.clientX - cur.x, dy = e.clientY - cur.y;
      if (cur.mode === 'wait') {
        const m = intent(dx, dy); if (m === 'wait') return;
        cur.mode = m;
        if (m === 'swipe') { try { cur.row.setPointerCapture(e.pointerId); } catch {} cur.row.classList.add('swiping'); }
      }
      if (cur.mode !== 'swipe') return;
      cur.dx = clamp(dx, cur.w);
      cur.row.style.transform = `translateX(${cur.dx}px)`;
      cur.row.classList.toggle('will-delete', commits(cur.dx, cur.w));
    });
    const end = (e, cancelled) => {
      if (!cur || e.pointerId !== cur.id) return;
      const s = cur; cur = null;
      if (s.mode !== 'swipe') return;
      swipedAt = Date.now(); s.row.classList.remove('swiping');
      if (!cancelled && commits(s.dx, s.w)) {
        s.row.classList.add('leaving'); s.row.style.transform = `translateX(${-s.w}px)`;
        setTimeout(() => onDelete(s.row), 170);
      } else { s.row.classList.remove('will-delete'); s.row.style.transform = ''; }
    };
    container.addEventListener('pointerup', e => end(e, false));
    container.addEventListener('pointercancel', e => end(e, true));
    // the tap that browsers may fire right after a swipe must not open the row
    container.addEventListener('click', e => { if (Date.now() - swipedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  root.Swipe = { intent, threshold, commits, clamp, attach };
})(typeof globalThis !== 'undefined' ? globalThis : this);
