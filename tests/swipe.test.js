'use strict';
/* Run with tests/run.sh (swipe.js first). The touch wiring needs a browser; these check the decisions it makes. */
let passed = 0, failed = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) passed++; else { failed++; print('FAIL: ' + msg + '\n   got:      ' + A + '\n   expected: ' + B); } };

// intent: only a mostly-horizontal drag to the left is ours
eq(Swipe.intent(-3, 2), 'wait', 'tiny movement: wait');
eq(Swipe.intent(-30, 4), 'swipe', 'clear left swipe');
eq(Swipe.intent(-30, 18), 'swipe', 'slightly diagonal left (30 vs 18 is 1.67x) still a swipe');
eq(Swipe.intent(-30, 25), 'scroll', 'too diagonal: leave it to scrolling');
eq(Swipe.intent(2, 40), 'scroll', 'vertical: scroll');
eq(Swipe.intent(-2, -40), 'scroll', 'vertical up: scroll');
eq(Swipe.intent(40, 3), 'scroll', 'to the right (iOS back-swipe direction): not ours');

// threshold: 35% of the row, between 70 and 120 px
eq([Swipe.threshold(100), Swipe.threshold(300), Swipe.threshold(600), Swipe.threshold(1000)], [70, 105, 120, 120], 'threshold clamps to 70..120');
eq([Swipe.commits(-60, 300), Swipe.commits(-104, 300), Swipe.commits(-105, 300), Swipe.commits(-200, 300)], [false, false, true, true], 'commits at the threshold');
eq([Swipe.commits(0, 300), Swipe.commits(30, 300)], [false, false], 'no commit without a left drag');

// clamp: the row never moves right of its place nor further than its own width
eq([Swipe.clamp(25, 300), Swipe.clamp(-120, 300), Swipe.clamp(-500, 300)], [0, -120, -300], 'row follows the finger within its bounds');

print(`\n${passed} passed, ${failed} failed`);
if (failed) throw new Error(failed + ' check(s) failed');
