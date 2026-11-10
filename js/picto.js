// Exercise pictograms: a side-view figure that performs the movement.
// A pose says where the hips, hand and foot are; elbows and knees are worked out from bone lengths,
// so the figure keeps its proportions through the whole movement.
import { EX, SUITS } from './data.js';

const TORSO = 26, UPPER = 14, FORE = 13, THIGH = 17, SHIN = 17, HEAD = 6.3, NECK = 9.6, FLOOR = 78;
const r1 = (n) => Math.round(n * 10) / 10;
const rad = (deg) => deg * Math.PI / 180;

// h: hip, t: torso angle (0 = upright, 90 = leaning toward +x), w: hand, f: foot, f2: back foot.
// eb / kb: which way the elbow / knee points: L, R, U or D. hot: what the exercise works (drawn in the suit colour).
// b lists only what differs from a.
const POSES = {
  curl:     { hot: 'arm', eb: 'L', kb: 'R', a: { h: [56, 44], t: 0, w: [59, 45], f: [57, 78] }, b: { w: [64, 22] } },
  scurl:    { bench: 'seat', hot: 'arm', eb: 'L', kb: 'U', a: { h: [52, 56], t: 0, w: [55, 57], f: [72, 78] }, b: { w: [60, 34] } },
  icurl:    { bench: 'incline', hot: 'arm', eb: 'D', kb: 'U', a: { h: [60, 58], t: 325, w: [44, 63], f: [82, 78] }, b: { w: [54, 40] } },
  conc:     { bench: 'seat', hot: 'arm', eb: 'D', kb: 'U', a: { h: [50, 56], t: 35, w: [66, 60], f: [72, 78] }, b: { w: [70, 40] } },
  press:    { bench: 'flat', hot: 'arm', eb: 'D', kb: 'U', a: { h: [74, 56], t: 270, w: [52, 43], f: [92, 78] }, b: { w: [48, 29.5] } },
  ipress:   { bench: 'incline', hot: 'arm', eb: 'D', kb: 'U', a: { h: [66, 58], t: 320, w: [57, 29], f: [86, 78] }, b: { w: [52, 11.5] } },
  fly:      { bench: 'flat', hot: 'arm', eb: 'D', kb: 'U', a: { h: [74, 56], t: 270, w: [63, 53], f: [92, 78] }, b: { w: [48, 29.5] } },
  fpress:   { hot: 'arm', eb: 'R', kb: 'U', a: { h: [72, 74], t: 270, w: [50, 61], f: [94, 78] }, b: { w: [46, 47.5] } },
  pushup:   { hot: 'arm', eb: 'R', kb: 'U', a: { h: [74, 60], t: 290, w: [50, 78], f: [103, 78] }, b: { h: [70.5, 68], t: 281 } },
  dpushup:  { bench: 'right', hot: 'arm', eb: 'R', kb: 'U', a: { h: [76, 56], t: 283, w: [51, 78], f: [108, 58] }, b: { h: [74, 64], t: 270 } },
  dip:      { bench: 'left', hot: 'arm', eb: 'L', kb: 'U', a: { h: [54, 60], t: 4, w: [44, 60], f: [86, 76] }, b: { h: [54, 71] } },
  ohext:    { bench: 'seat', hot: 'arm', eb: 'U', kb: 'U', a: { h: [52, 56], t: 0, w: [45, 25], f: [72, 78] }, b: { w: [52, 3.2] } },
  ohp:      { bench: 'seat', hot: 'arm', eb: 'D', kb: 'U', a: { h: [52, 56], t: 0, w: [60, 27], f: [72, 78] }, b: { w: [52, 3.2] } },
  skull:    { bench: 'flat', hot: 'arm', eb: 'U', kb: 'U', a: { h: [74, 56], t: 270, w: [37, 49], f: [92, 78] }, b: { w: [48, 29.5] } },
  pullover: { bench: 'flat', hot: 'arm', eb: 'U', kb: 'U', a: { h: [74, 56], t: 270, w: [23, 57], f: [92, 78] }, b: { w: [48, 29.5] } },
  kick:     { hot: 'arm', eb: 'L', kb: 'R', a: { h: [54, 46], t: 68, w: [72, 52], f: [54, 78] }, b: { w: [55, 37] } },
  row:      { hot: 'arm', eb: 'U', kb: 'R', a: { h: [54, 46], t: 68, w: [79, 62.5], f: [54, 78] }, b: { w: [70, 45] } },
  raise:    { hot: 'arm', eb: 'D', kb: 'R', a: { h: [56, 44], t: 0, w: [59, 45], f: [57, 78] }, b: { w: [83, 19] } },
  shrug:    { hot: 'arm', eb: 'L', kb: 'R', a: { h: [56, 44], t: 0, w: [58, 45.5], f: [57, 78] }, b: { h: [56, 42], w: [58, 42] } },
  calf:     { hot: 'leg', eb: 'L', kb: 'R', a: { h: [56, 45], t: 0, w: [58, 46.5], f: [57, 78] }, b: { h: [56, 41], w: [58, 42.5], f: [57, 75] } },
  squat:    { hot: 'leg', eb: 'D', kb: 'R', a: { h: [56, 44], t: 4, w: [64, 26], f: [60, 78] }, b: { h: [46, 60], t: 28, w: [65, 45] } },
  lunge:    { hot: 'leg', eb: 'L', kb: 'R', kb2: 'D', a: { h: [58, 45], t: 0, w: [59, 46], f: [74, 78], f2: [40, 78] }, b: { h: [58, 57], w: [59, 58], f2: [38, 78] } },
  rdl:      { hot: 'leg', eb: 'D', kb: 'R', a: { h: [56, 44], t: 0, w: [58, 45.5], f: [57, 78] }, b: { h: [50, 45], t: 78, w: [76, 65] } },
  thrust:   { bench: 'left', hot: 'leg', eb: 'U', kb: 'U', a: { h: [62, 70], t: 298, w: [62, 66], f: [84, 78] }, b: { h: [64, 58], t: 270, w: [64, 54] } },
  crunch:   { hot: 'core', eb: 'U', kb: 'U', a: { h: [66, 74], t: 270, w: [34, 70], f: [92, 78] }, b: { t: 300, w: [40, 55] } },
  legraise: { bench: 'flat', hot: 'leg', eb: 'U', kb: 'U', a: { h: [62, 56], t: 270, w: [28, 60], f: [96, 56] }, b: { f: [64, 22] } },
  plank:    { hot: 'core', eb: 'D', kb: 'U', a: { h: [76, 66], t: 275, w: [38, 77], f: [110, 78] }, b: { h: [76, 64.5] } },
  twist:    { hot: 'core', eb: 'D', kb: 'U', a: { h: [58, 74], t: 332, w: [66, 57], f: [86, 70] }, b: { w: [52, 63] } },
  vup:      { hot: 'core', eb: 'U', kb: 'U', a: { h: [62, 74], t: 270, w: [10, 73], f: [96, 73] }, b: { t: 318, w: [68, 50], f: [82, 46] } },
};

// Which movement each card shows.
const SHOWS = {
  'bench-press': 'press', 'incline-press': 'ipress', fly: 'fly', 'push-up': 'pushup', 'floor-press': 'fpress', 'squeeze-press': 'press',
  'neutral-press': 'press', 'incline-fly': 'ipress', 'one-arm-press': 'press', 'feet-up-push-up': 'dpushup', 'deep-push-up': 'pushup',
  curl: 'curl', hammer: 'curl', 'incline-curl': 'icurl', concentration: 'conc', 'seated-curl': 'scurl', spider: 'conc', zottman: 'curl',
  'cross-body': 'curl', drag: 'curl', 'wide-curl': 'curl', waiter: 'curl', preacher: 'conc',
  'one-arm-row': 'row', 'bent-row': 'row', 'reverse-fly': 'row', 'chest-row': 'row', pullover: 'pullover', shrug: 'shrug',
  'renegade-row': 'pushup', 'wide-row': 'row', superman: 'plank',
  'overhead-ext': 'ohext', skull: 'skull', 'bench-dip': 'dip', kickback: 'kick', 'close-press': 'press', tate: 'skull',
  'one-arm-overhead': 'ohext', 'diamond-push-up': 'pushup',
  crunch: 'crunch', 'leg-raise': 'legraise', plank: 'plank', 'russian-twist': 'twist', bicycle: 'crunch', 'reverse-crunch': 'crunch',
  'v-up': 'vup', 'dead-bug': 'crunch', 'mountain-climber': 'plank', 'weighted-crunch': 'crunch', 'hollow-hold': 'plank', 'side-plank': 'plank',
  'goblet-squat': 'squat', 'shoulder-press': 'ohp', rdl: 'rdl', 'lateral-raise': 'raise', 'split-squat': 'lunge', 'hip-thrust': 'thrust',
  'reverse-lunge': 'lunge', 'calf-raise': 'calf', arnold: 'ohp', 'step-up': 'lunge', 'front-raise': 'raise',
};

// The middle joint of a two-bone limb reaching from `from` to `to`, bending toward `way`.
function hinge(from, to, l1, l2, way) {
  let dx = to[0] - from[0], dy = to[1] - from[1];
  const reach = Math.hypot(dx, dy) || 0.01, d = Math.min(reach, l1 + l2 - 0.3), ux = dx / reach, uy = dy / reach;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const mx = from[0] + ux * along, my = from[1] + uy * along;
  const p = [mx - uy * off, my + ux * off], q = [mx + uy * off, my - ux * off];
  const end = [from[0] + ux * d, from[1] + uy * d]; // where the limb actually ends if the target is out of reach
  const pick = way === 'L' ? p[0] < q[0] : way === 'R' ? p[0] > q[0] : way === 'U' ? p[1] < q[1] : p[1] > q[1];
  return { mid: pick ? p : q, end };
}

// Every joint for one moment of the movement. k: 0 = start, 1 = end.
function joints(pose, k) {
  const a = pose.a, b = { ...pose.a, ...pose.b };
  const mix = (key) => [a[key][0] + (b[key][0] - a[key][0]) * k, a[key][1] + (b[key][1] - a[key][1]) * k];
  let turn = b.t - a.t;
  if (turn > 180) turn -= 360; else if (turn < -180) turn += 360;
  const t = rad(a.t + turn * k), dir = [Math.sin(t), -Math.cos(t)];
  const hip = mix('h'), sh = [hip[0] + dir[0] * TORSO, hip[1] + dir[1] * TORSO], head = [sh[0] + dir[0] * NECK, sh[1] + dir[1] * NECK];
  const arm = hinge(sh, mix('w'), UPPER, FORE, pose.eb), leg = hinge(hip, mix('f'), THIGH, SHIN, pose.kb);
  const leg2 = a.f2 ? hinge(hip, mix('f2'), THIGH, SHIN, pose.kb2 ?? pose.kb) : null;
  return { hip, sh, head, el: arm.mid, hand: arm.end, kn: leg.mid, foot: leg.end, kn2: leg2?.mid, foot2: leg2?.end };
}

const pts = (...list) => list.map(p => `${r1(p[0])},${r1(p[1])}`).join(' ');

function benchArt(kind) {
  const pad = (x, w) => `<rect x="${x}" y="60" width="${w}" height="5" rx="2.5"/><rect x="${x + 5}" y="65" width="3" height="13"/><rect x="${x + w - 8}" y="65" width="3" height="13"/>`;
  if (kind === 'flat') return pad(26, 72);
  if (kind === 'seat') return pad(38, 30);
  if (kind === 'left') return pad(14, 34);
  if (kind === 'right') return pad(88, 28);
  if (kind === 'incline') return pad(54, 30) + '<path d="M60.5 62.5 37 30" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="40" y="46" width="3" height="32" transform="rotate(14 41 46)"/>';
  return '';
}

// One exercise, drawn. animate: loop the movement (otherwise the end position is shown).
// The figure is drawn in the current text colour, the working part in the suit's colour.
export function picto(exId, { size = 120, animate = false } = {}) {
  const ex = EX[exId], pose = POSES[SHOWS[exId]] ?? POSES.curl;
  const still = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = still ? [1] : [0, 0.2, 0.4, 0.6, 0.8, 1];
  const frames = steps.map(k => joints(pose, k));
  // out and back, with a short hold at the end of the movement
  const loop = (get) => (still ? null : [...frames.map(get), get(frames[frames.length - 1]), ...[...frames].reverse().slice(1).map(get)]);
  const times = '0;0.09;0.18;0.27;0.36;0.45;0.55;0.64;0.73;0.82;0.91;1';
  const anim = (attr, get) => (still ? '' : `<animate attributeName="${attr}" dur="2.8s" repeatCount="indefinite" keyTimes="${times}" values="${loop(get).join(';')}"/>`);
  const last = frames[frames.length - 1], first = still ? last : frames[0];
  const hot = SUITS[ex.suit].color, w = 6.4;
  const line = (cls, get, colour) => `<polyline class="${cls}" points="${get(first)}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${anim('points', get)}</polyline>`;
  const held = ex.kind === 'db1' || ex.kind === 'db2';
  const move = still ? '' : `<animateTransform attributeName="transform" type="translate" dur="2.8s" repeatCount="indefinite" keyTimes="${times}" values="${loop(j => `${r1(j.hand[0])} ${r1(j.hand[1])}`).join(';')}"/>`;
  const upright = ['ohext', 'squat', 'twist', 'thrust'].includes(SHOWS[exId]); // held on end rather than level
  const bell = held ? `<g transform="translate(${r1(first.hand[0])} ${r1(first.hand[1])})">${move}<g${upright ? ' transform="rotate(90)"' : ''} fill="${hot}">
      <rect x="-7.5" y="-1.6" width="15" height="3.2" rx="1.6"/><rect x="-9.5" y="-5" width="4.6" height="10" rx="1.8"/><rect x="4.9" y="-5" width="4.6" height="10" rx="1.8"/></g></g>` : '';
  return `<svg class="picto" viewBox="0 0 120 90" width="${size}" height="${Math.round(size * 0.75)}" role="img" aria-label="${ex.name}">
    <rect x="6" y="${FLOOR + 3.4}" width="108" height="1.6" rx=".8" fill="currentColor" opacity=".16"/>
    <g fill="currentColor" opacity=".3">${benchArt(pose.bench)}</g>
    ${frames[0].foot2 ? line('far', j => pts(j.hip, j.kn2, j.foot2), 'currentColor').replace('<polyline', '<polyline opacity=".45"') : ''}
    ${line('leg', j => pts(j.hip, j.kn, j.foot), pose.hot === 'leg' ? hot : 'currentColor')}
    ${line('body', j => pts(j.hip, j.sh), pose.hot === 'core' ? hot : 'currentColor').replace(`stroke-width="${w}"`, 'stroke-width="8.4"')}
    <circle cx="${r1(first.head[0])}" cy="${r1(first.head[1])}" r="${HEAD}" fill="currentColor">${anim('cx', j => r1(j.head[0]))}${anim('cy', j => r1(j.head[1]))}</circle>
    ${line('arm', j => pts(j.sh, j.el, j.hand), pose.hot === 'arm' ? hot : 'currentColor')}
    ${bell}
  </svg>`;
}
