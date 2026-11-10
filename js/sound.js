// Sound. Recorded clips from Kenney.nl (public domain, CC0) for cards and combat,
// plus a few quiet notes under the big moments. No DOM, no game state: app.js decides when to play.

export const FILES = [
  'slide1', 'slide2', 'slide3', 'slide4', 'place1', 'place2', 'fan', 'shuffle', 'pack', 'takeout',
  'slice1', 'slice2', 'chop', 'punch1', 'punch2', 'plate', 'clang1', 'clang2', 'body',
  'bell', 'bell2', 'ding', 'coins', 'coins2', 'draw', 'cloth', 'anvil1', 'anvil2', 'tick', 'tap',
];

// Several takes of the same sound: one is picked each time, never the same twice running.
const TAKES = {
  slide: ['slide1', 'slide2', 'slide3', 'slide4'],
  place: ['place1', 'place2'],
  slice: ['slice1', 'slice2', 'chop'],
  thud: ['punch1', 'punch2', 'plate'],
  clang: ['clang1', 'clang2'],
  anvil: ['anvil1', 'anvil2'],
};

// Each sound is a few clips layered: [clip or take, seconds after the start, volume, cut off after seconds].
const blade = [['slice', 0, 0.9], ['body', 0.06, 0.55]];
const blunt = [['thud', 0, 1], ['body', 0.03, 0.5]];
const crit = [['clang', 0.02, 0.8], ['ding', 0.1, 0.6]];
const down = [['clang', 0.02, 0.9], ['bell', 0.12, 0.8], ['coins', 0.55, 0.7]];
export const RECIPES = {
  tick: [['tick', 0, 0.9]],
  tap: [['tap', 0, 0.7]],
  flip: [['slide', 0, 0.9]],
  place: [['place', 0, 1]],
  deal: [['shuffle', 0, 0.75, 1.15], ['place', 1.05, 0.9]],
  start: [['slide', 0, 0.8], ['place', 0.16, 1]],
  'hit-blade': blade,
  'hit-blunt': blunt,
  'crit-blade': [...blade, ...crit],
  'crit-blunt': [...blunt, ...crit],
  'down-blade': [...blade, ...down],
  'down-blunt': [...blunt, ...down],
  win: [['coins', 0, 0.8], ['ding', 0.18, 0.55]],
  rest: [['bell2', 0, 1], ['bell2', 0.42, 0.8]],
  charge: [['pack', 0, 1]],
  loot0: [['takeout', 0, 0.9], ['place', 0.18, 0.8]],
  loot1: [['takeout', 0, 0.9], ['coins2', 0.16, 1.6]],
  loot2: [['takeout', 0, 0.9], ['ding', 0.1, 0.7]],
  loot3: [['takeout', 0, 0.9], ['clang', 0.06, 0.6], ['bell', 0.12, 0.8]],
  loot4: [['takeout', 0, 0.9], ['clang', 0.05, 0.8], ['bell', 0.1, 0.9], ['bell2', 0.5, 0.7]],
  loot5: [['takeout', 0, 0.9], ['clang', 0.04, 0.9], ['bell', 0.08, 1], ['bell2', 0.42, 0.9], ['clang', 0.5, 0.6], ['bell', 0.9, 0.7], ['coins', 1.1, 0.7]],
  'equip-weapon': [['draw', 0, 2.6]],
  'equip-armor': [['cloth', 0, 1.5]],
  forge: [['anvil', 0, 0.9], ['anvil', 0.22, 0.8]],
};

// Quiet notes under the moments worth a fanfare: [pitch in Hz, seconds after the start, length].
const NOTES = {
  win: [[392, 0.1, 0.14], [523, 0.22, 0.14], [659, 0.34, 0.14], [784, 0.46, 0.4]],
  'down-blade': [[392, 0.5, 0.14], [523, 0.62, 0.14], [659, 0.74, 0.14], [784, 0.86, 0.4]],
  'down-blunt': [[392, 0.5, 0.14], [523, 0.62, 0.14], [659, 0.74, 0.14], [784, 0.86, 0.4]],
  loot3: [[523, 0.1, 0.12], [659, 0.2, 0.12], [784, 0.3, 0.12], [1047, 0.4, 0.4]],
  loot4: [[262, 0.1, 0.6], [392, 0.1, 0.6], [523, 0.2, 0.12], [659, 0.3, 0.12], [784, 0.4, 0.12], [1047, 0.5, 0.14], [1319, 0.62, 0.14], [1568, 0.74, 0.6]],
};
NOTES.loot5 = [[196, 0.1, 0.9], [294, 0.1, 0.9], [392, 0.2, 0.14], [523, 0.32, 0.14], [659, 0.44, 0.14], [784, 0.56, 0.14], [1047, 0.68, 0.16], [1319, 0.82, 0.16], [1568, 0.96, 0.18], [2093, 1.12, 0.8]];
const NOTE_VOLUME = 0.05;

let ctx = null, loading = null;
const buffers = new Map();
const lastTake = {};

function context() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Fetches and decodes every clip once. Call from a tap so the browser lets audio start.
export function prime() {
  try { context(); } catch { return; }
  loading ??= Promise.all(FILES.map(async (name) => {
    try {
      const data = await (await fetch(`sounds/${name}.ogg`)).arrayBuffer();
      buffers.set(name, await ctx.decodeAudioData(data));
    } catch { /* that clip stays silent */ }
  }));
  return loading;
}

function pick(what) {
  const takes = TAKES[what];
  if (!takes) return what;
  let i = Math.floor(Math.random() * takes.length);
  if (i === lastTake[what]) i = (i + 1) % takes.length;
  lastTake[what] = i;
  return takes[i];
}

export function play(name, { delay = 0 } = {}) {
  try {
    const ac = context();
    prime();
    const t0 = ac.currentTime + delay;
    for (const [what, at, volume, cut] of RECIPES[name] ?? []) {
      const buffer = buffers.get(pick(what));
      if (!buffer) continue;
      const src = ac.createBufferSource(), gain = ac.createGain();
      src.buffer = buffer;
      // A slightly different pitch each time keeps a repeated sound from grating.
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      gain.gain.setValueAtTime(volume, t0 + at);
      src.connect(gain).connect(ac.destination);
      src.start(t0 + at);
      if (cut) {
        gain.gain.setValueAtTime(volume, t0 + at + cut - 0.15);
        gain.gain.linearRampToValueAtTime(0, t0 + at + cut);
        src.stop(t0 + at + cut + 0.02);
      }
    }
    for (const [pitch, at, length] of NOTES[name] ?? []) {
      const osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'triangle'; osc.frequency.value = pitch;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(NOTE_VOLUME, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + length);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0 + at); osc.stop(t0 + at + length + 0.03);
    }
  } catch { /* no audio available */ }
}
