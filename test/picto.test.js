import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSES, joints, reach, frameFor } from '../js/picto.js';
import { EXERCISES } from '../js/data.js';

// Which side of the straight shoulder-to-hand line the middle joint sits on.
const side = (from, mid, to) => Math.sign((to[0] - from[0]) * (mid[1] - from[1]) - (to[1] - from[1]) * (mid[0] - from[0]));

test('no elbow or knee flips to the other side during a movement', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    const seen = { arm: new Set(), leg: new Set(), leg2: new Set() };
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const j = joints(pose, k);
      // A limb that is all but straight has no side worth the name.
      const note = (key, from, mid, to) => {
        const off = Math.abs((to[0] - from[0]) * (mid[1] - from[1]) - (to[1] - from[1]) * (mid[0] - from[0])) / Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (off > 0.5) seen[key].add(side(from, mid, to));
      };
      note('arm', j.sh, j.el, j.hand);
      note('leg', j.hip, j.kn, j.foot);
      if (j.kn2) note('leg2', j.hip, j.kn2, j.foot2);
    }
    for (const [limb, sides] of Object.entries(seen)) assert.ok(sides.size <= 1, `${name}: the ${limb} bends both ways`);
  }
});

test('limbs keep their length through every movement', () => {
  for (const [name, pose] of Object.entries(POSES)) {
    for (let k = 0; k <= 1.0001; k += 0.1) {
      const j = joints(pose, k);
      const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      assert.ok(Math.abs(len(j.sh, j.el) - 14) < 0.01, `${name}: upper arm stretches`);
      assert.ok(Math.abs(len(j.el, j.hand) - 13) < 0.4, `${name}: forearm stretches`);
      assert.ok(Math.abs(len(j.hip, j.kn) - 17) < 0.01, `${name}: thigh stretches`);
    }
  }
});

test('every exercise drawing stays inside its picture frame for the whole movement', () => {
  for (const ex of EXERCISES) {
    const [l, t, r, b] = reach(ex.id), [x, y, w, h] = frameFor(ex.id);
    assert.ok(l >= x && t >= y && r <= x + w && b <= y + h, `${ex.id} is cut off: reaches ${[l, t, r, b].map(n => n.toFixed(1))} in a frame of ${[x, y, w, h]}`);
    assert.ok(Math.abs(w / h - 4 / 3) < 0.02, `${ex.id}: the frame lost its shape`);
  }
});
