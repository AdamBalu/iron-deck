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
export const POSES = {
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

// How the dumbbell sits in the hand, seen from the side.
// end: pointing at you (palms forward or back), so you see its round end. level: lying flat, front to back.
// upright: standing on end. cross: square to the forearm and turning with it (hammer grip).
const GRIP_BY_POSE = {
  curl: 'end', scurl: 'end', icurl: 'end', conc: 'end', press: 'end', ipress: 'end', fpress: 'end', ohp: 'end', raise: 'end',
  thrust: 'end', crunch: 'end', twist: 'end',
  fly: 'level', pushup: 'level', row: 'level', shrug: 'level', calf: 'level', lunge: 'level', rdl: 'level',
  ohext: 'upright', pullover: 'upright', squat: 'upright',
  skull: 'cross', kick: 'cross',
};
// Counted as bodyweight, but done with the hands on dumbbells.
const PROPS = ['deep-push-up'];
const GRIP = {
  hammer: 'cross', 'cross-body': 'cross', waiter: 'upright',
  'neutral-press': 'level', 'squeeze-press': 'level', 'close-press': 'level', 'incline-fly': 'level', tate: 'upright',
  'bent-row': 'end', 'wide-row': 'end', 'lateral-raise': 'level',
};

// The middle joint of a two-bone limb reaching from `from` to `to`. There are always two places it could be,
// one on each side of the straight line: side (+1 or -1) says which. bend is how far it sits off that line.
function hinge(from, to, l1, l2, side) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const reach = Math.hypot(dx, dy) || 0.01, d = Math.min(reach, l1 + l2 - 0.3), ux = dx / reach, uy = dy / reach;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), bend = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const mx = from[0] + ux * along, my = from[1] + uy * along;
  const end = [from[0] + ux * d, from[1] + uy * d]; // where the limb actually ends if the target is out of reach
  return { mid: [mx - uy * bend * side, my + ux * bend * side], end, bend };
}
// Which side puts the joint toward `way` (L, R, U or D) for this reach.
function sideFor(from, to, l1, l2, way) {
  const p = hinge(from, to, l1, l2, 1).mid, q = hinge(from, to, l1, l2, -1).mid;
  return (way === 'L' ? p[0] < q[0] : way === 'R' ? p[0] > q[0] : way === 'U' ? p[1] < q[1] : p[1] > q[1]) ? 1 : -1;
}

const STEPS = [0, 0.2, 0.4, 0.6, 0.8, 1];

// Where the hips, shoulders, head and limb targets are at one moment. k: 0 = start, 1 = end.
function frame(pose, k) {
  const a = pose.a, b = { ...pose.a, ...pose.b };
  const mix = (key) => [a[key][0] + (b[key][0] - a[key][0]) * k, a[key][1] + (b[key][1] - a[key][1]) * k];
  let turn = b.t - a.t;
  if (turn > 180) turn -= 360; else if (turn < -180) turn += 360;
  const t = rad(a.t + turn * k), dir = [Math.sin(t), -Math.cos(t)];
  const hip = mix('h'), sh = [hip[0] + dir[0] * TORSO, hip[1] + dir[1] * TORSO], head = [sh[0] + dir[0] * NECK, sh[1] + dir[1] * NECK];
  return { hip, sh, head, w: mix('w'), f: mix('f'), f2: a.f2 ? mix('f2') : null };
}

// An elbow or knee only folds one way. A pose names the direction (eb, kb) as it looks when the limb is
// most bent; that side is then kept for the whole movement, so a joint can never flip inside out mid-rep.
function sides(pose) {
  if (pose.sides) return pose.sides;
  const frames = STEPS.map(k => frame(pose, k));
  const most = (reach) => frames.reduce((best, fr) => {
    const [from, to, l1, l2, way] = reach(fr), bend = hinge(from, to, l1, l2, 1).bend;
    return bend > best.bend ? { bend, side: sideFor(from, to, l1, l2, way) } : best;
  }, { bend: -1, side: 1 }).side;
  pose.sides = {
    arm: most(fr => [fr.sh, fr.w, UPPER, FORE, pose.eb]),
    leg: most(fr => [fr.hip, fr.f, THIGH, SHIN, pose.kb]),
    leg2: pose.a.f2 ? most(fr => [fr.hip, fr.f2, THIGH, SHIN, pose.kb2 ?? pose.kb]) : 1,
  };
  return pose.sides;
}

// Every joint for one moment of the movement.
export function joints(pose, k) {
  const fr = frame(pose, k), s = sides(pose);
  const arm = hinge(fr.sh, fr.w, UPPER, FORE, s.arm), leg = hinge(fr.hip, fr.f, THIGH, SHIN, s.leg);
  const leg2 = fr.f2 ? hinge(fr.hip, fr.f2, THIGH, SHIN, s.leg2) : null;
  return { hip: fr.hip, sh: fr.sh, head: fr.head, el: arm.mid, hand: arm.end, kn: leg.mid, foot: leg.end, kn2: leg2?.mid, foot2: leg2?.end };
}

const gripOf = (exId) => GRIP[exId] ?? GRIP_BY_POSE[SHOWS[exId]] ?? 'level';
const isHeld = (ex) => ex.kind === 'db1' || ex.kind === 'db2' || PROPS.includes(ex.id);
// Dumbbells that stand on the floor under the hands are lifted to sit on it rather than in it.
const liftOf = (exId) => (SHOWS[exId] === 'pushup' ? -2.2 : 0);

// How far a drawing reaches over its whole movement: [left, top, right, bottom].
export function reach(exId) {
  const ex = EX[exId], pose = POSES[SHOWS[exId]] ?? POSES.curl, grip = gripOf(exId);
  const [bx, by] = !isHeld(ex) ? [0, 0] : grip === 'end' ? [6.2, 6.2] : grip === 'level' ? [10.5, 5.9] : grip === 'upright' ? [5.9, 10.5] : [11.6, 11.6];
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (p, rx, ry = rx) => { box[0] = Math.min(box[0], p[0] - rx); box[1] = Math.min(box[1], p[1] - ry); box[2] = Math.max(box[2], p[0] + rx); box[3] = Math.max(box[3], p[1] + ry); };
  for (const k of STEPS) {
    const j = joints(pose, k);
    for (const p of [j.hip, j.sh, j.el, j.hand, j.kn, j.foot, j.kn2, j.foot2]) if (p) add(p, 4.2);
    add(j.head, HEAD);
    if (bx) add([j.hand[0], j.hand[1] + liftOf(exId)], bx, by);
  }
  return box;
}
// The picture frame as [x, y, width, height]: the usual 120 by 90, grown (keeping its shape) for a
// movement that reaches past it, so nothing is ever cut off at the edge.
export function frameFor(exId) {
  const [l, t, r, b] = reach(exId), pad = 2;
  let x0 = Math.min(0, l - pad), y0 = Math.min(0, t - pad), x1 = Math.max(120, r + pad);
  const y1 = Math.max(90, b + pad);
  const w = x1 - x0, h = y1 - y0;
  if (w / h < 4 / 3) { const grow = h * 4 / 3 - w; x0 -= grow / 2; x1 += grow / 2; } else y0 -= w * 3 / 4 - h;
  return [x0, y0, x1 - x0, y1 - y0].map(r1);
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
  const steps = still ? [1] : STEPS;
  const frames = steps.map(k => joints(pose, k));
  // out and back, with a short hold at the end of the movement
  const loop = (get) => (still ? null : [...frames.map(get), get(frames[frames.length - 1]), ...[...frames].reverse().slice(1).map(get)]);
  const times = '0;0.09;0.18;0.27;0.36;0.45;0.55;0.64;0.73;0.82;0.91;1';
  const anim = (attr, get) => (still ? '' : `<animate attributeName="${attr}" dur="2.8s" repeatCount="indefinite" keyTimes="${times}" values="${loop(get).join(';')}"/>`);
  const last = frames[frames.length - 1], first = still ? last : frames[0];
  const hot = SUITS[ex.suit].color, w = 6.4;
  const line = (cls, get, colour) => `<polyline class="${cls}" points="${get(first)}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${anim('points', get)}</polyline>`;
  const held = isHeld(ex), lift = liftOf(exId);
  const tween = (type, get) => (still ? '' : `<animateTransform attributeName="transform" type="${type}" dur="2.8s" repeatCount="indefinite" keyTimes="${times}" values="${loop(get).join(';')}"/>`);
  let bell = '';
  if (held) {
    // Steel, outlined in the figure's colour: it stands apart from the body and from every suit colour.
    const grip = gripOf(exId);
    const steel = 'fill="#7A8296" stroke="currentColor" stroke-width="1"';
    const art = grip === 'end'
      ? `<circle r="5.7" ${steel}/><circle r="2.1" fill="#C3C8D6"/>`
      : `<rect x="-7.5" y="-1.6" width="15" height="3.2" rx="1.6" fill="#C3C8D6" stroke="currentColor" stroke-width=".8"/><rect x="-10" y="-5.4" width="5" height="10.8" rx="1.9" ${steel}/><rect x="5" y="-5.4" width="5" height="10.8" rx="1.9" ${steel}/>`;
    // A hammer grip keeps the bar square to the forearm, so it turns as the arm does.
    const square = (j) => r1(Math.atan2(j.hand[1] - j.el[1], j.hand[0] - j.el[0]) * 180 / Math.PI + 90);
    const turn = grip === 'cross' ? `<g transform="rotate(${square(first)})">${tween('rotate', square)}${art}</g>`
      : grip === 'upright' ? `<g transform="rotate(90)">${art}</g>` : art;
    const at = (j) => `${r1(j.hand[0])} ${r1(j.hand[1] + lift)}`;
    bell = `<g transform="translate(${at(first)})">${tween('translate', at)}${turn}</g>`;
  }
  return `<svg class="picto" viewBox="${frameFor(exId).join(' ')}" width="${size}" height="${Math.round(size * 0.75)}" role="img" aria-label="${ex.name}">
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
