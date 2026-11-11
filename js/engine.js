// Workout logic. No DOM, no storage: everything here takes the state and returns or mutates plain data.
import {
  SUITS, SUIT_ORDER, EXERCISES, EX, MODS, STYLES, LOOT_THEMES,
  SEASONS, WILD_RANGES, HEAVY_THINGS,
  FOES_SMALL, FOES_BIG, BANE_BONUS, COMBOS, ITEMS, FORGE_COST,
} from './data.js';

const DAY = 86400000;
const HOUR = 3600000;
const TOTAL_WEIGHT = SUIT_ORDER.reduce((n, s) => n + SUITS[s].weight, 0);
const isDb = (ex) => ex.kind === 'db1' || ex.kind === 'db2';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function pickWeighted(rng, items, weightOf) {
  const total = items.reduce((n, it) => n + weightOf(it), 0);
  let roll = rng() * total;
  for (const it of items) { roll -= weightOf(it); if (roll <= 0) return it; }
  return items[items.length - 1];
}

// ---------- state ----------

export function newState(setup, now) {
  const settings = {
    bench: setup.bench, curl: setup.curl, step: setup.step, min: setup.step, max: setup.max ?? 40,
    incline: !!setup.incline, quickChange: !!setup.quickChange,
    sound: true, buzz: true, theme: 'indigo', arena: !!setup.arena,
  };
  const exercises = EXERCISES.filter(e => e.base && (settings.incline || !e.incline)).map(e => e.id);
  if (!settings.incline) exercises.push('seated-curl', 'squeeze-press');
  const zero = () => Object.fromEntries(SUIT_ORDER.map(s => [s, 0]));
  return {
    v: 1, createdAt: now, settings,
    xp: 0, suitXp: zero(), tonnage: 0, hands: 0, loots: 0, records: 0,
    debt: zero(), lifts: {},
    unlocked: { exercises, mods: [], styles: ['pairs'], themes: ['indigo'], combos: [] },
    foe: spawnFoe(0), foesDown: 0, items: {}, equip: {}, iron: 0,
    fresh: [], lastTrained: {}, lastExercises: [], lastStyle: null, lastBoss: null, lastHandAt: null,
    history: [], current: null, pending: null,
  };
}

// Brings a save from an earlier version up to date. Safe to run on every load.
export function migrate(state) {
  state.items ??= {};
  state.equip ??= {};
  state.iron ??= 0;
  // The first version of gear was three tiers per suit plus perk-style legendaries: turn those into items.
  if (state.gear) {
    for (const [suit, tier] of Object.entries(state.gear)) {
      for (let r = 0; r < tier; r++) grant(state, `${SUIT_SLOT[suit]}-${r}`);
      if (tier > 0) equip(state, `${SUIT_SLOT[suit]}-${tier - 1}`);
    }
    delete state.gear;
  }
  if (state.legends) {
    if (state.legends.length) grant(state, 'sword-2');
    delete state.legends;
  }
  state.unlocked.combos ??= [];
  state.foesDown ??= Math.floor((state.hands ?? 0) / 4);
  state.foe ??= spawnFoe(state.foesDown, state);
  return state;
}

const ownedExercises = (state) =>
  state.unlocked.exercises.map(id => EX[id]).filter(e => e && (state.settings.incline || !e.incline));

// ---------- weights, ranges, targets ----------

function roundDown(state, w) {
  const { step, min } = state.settings;
  return Math.max(min, Math.ceil(w / step - 0.5 - 1e-9) * step); // nearest step, ties go down
}

export function startWeight(state, ex) {
  if (!isDb(ex)) return 0;
  const anchor = state.settings[ex.anchor];
  return ex.ratio === 1 ? anchor : roundDown(state, anchor * ex.ratio);
}

const currentWeight = (state, ex) => state.lifts[ex.id]?.w ?? startWeight(state, ex);

function rangeFor(ex, mod, base, w) {
  let [lo, hi] = base;
  if (!ex.compound) { lo += 2; hi += 2; }
  if (w > 0 && w <= 7.5) hi += 3; // light dumbbells jump a long way per step, so allow more reps first
  const shift = mod && MODS[mod] ? MODS[mod].repShift : 0;
  lo = Math.max(4, lo + shift);
  hi = Math.max(lo + 2, hi + shift);
  return [lo, hi];
}

export function targetFor(state, ex, mod, base, forceW) {
  const key = mod ? `${ex.id}:${mod}` : ex.id;
  const lift = state.lifts[key];
  const first = !lift || lift.sessions === 0;
  const top = lift?.top ?? null;

  if (mod === 'allout') {
    const w = isDb(ex) ? forceW : 0;
    const best = (lift?.bests ?? []).filter(b => b.w >= w).reduce((m, b) => Math.max(m, b.r), 0) || null;
    return { key, w, reps: null, lo: 1, hi: 999, first, bumpedFrom: null, lastTop: best, best };
  }
  if (ex.kind === 'time') {
    return { key, w: 0, reps: top ? Math.min(180, top + 5) : 30, lo: 15, hi: 180, first, bumpedFrom: null, lastTop: top };
  }
  if (ex.kind === 'bw') {
    return { key, w: 0, reps: top ? top + 1 : 10, lo: 1, hi: 999, first, bumpedFrom: null, lastTop: top };
  }

  const { step, max } = state.settings;
  let w, bumpedFrom = null, lastTop = top;
  if (!lift) {
    const baseW = currentWeight(state, ex);
    w = mod ? roundDown(state, baseW * MODS[mod].factor) : baseW;
  } else {
    w = lift.w;
    if (lift.prevW != null && lift.prevW < w && top == null) bumpedFrom = lift.prevW;
  }
  let [lo, hi] = mod === 'twentyone' ? [21, 21] : rangeFor(ex, mod, base, w);
  if (mod !== 'twentyone' && lastTop != null && lastTop >= hi + 2 && w + step <= max) {
    bumpedFrom = w; w += step; lastTop = null;
    [lo, hi] = rangeFor(ex, mod, base, w);
  }
  const capped = w + step > max; // nowhere heavier to go, so reps keep climbing
  const reps = !lift ? Math.min(hi, lo + 2) : lastTop == null ? lo : clamp(lastTop + 1, lo, capped ? 99 : hi);
  return { key, w, reps, lo, hi, first, bumpedFrom, lastTop };
}

export function isRecord(lift, w, r) {
  return !!lift && lift.sessions > 0 && r > 0 && !lift.bests.some(b => b.w >= w && b.r >= r);
}
function addBest(lift, w, r) {
  if (lift.bests.some(b => b.w >= w && b.r >= r)) return;
  lift.bests = lift.bests.filter(b => !(b.w <= w && b.r <= r));
  lift.bests.push({ w, r });
}

// ---------- seasons, levels ----------

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII'];
// A season is three bosses: two smaller ones, then the season boss.
export function seasonInfo(state, down = state.foesDown ?? 0) {
  const n = Math.floor(down / 3) + 1;
  const def = SEASONS[(n - 1) % SEASONS.length];
  const lap = Math.floor((n - 1) / SEASONS.length);
  const beaten = down % 3;
  return {
    n, def, name: def.name + (ROMAN[lap] ?? ` ${lap + 1}`),
    beaten, left: 3 - beaten, next: SEASONS[n % SEASONS.length],
  };
}

// ---------- the fight ----------

export function foeInfo(k) {
  const big = k % 3 === 2;
  const list = big ? FOES_BIG : FOES_SMALL;
  const idx = big ? Math.floor(k / 3) : k - Math.floor((k + 1) / 3);
  const def = list[idx % list.length];
  const lap = Math.floor(idx / list.length);
  // Health grows slowly with each boss so a levelled-up hero still needs a few hands.
  const max = Math.round((900 + 40 * k) * (big ? 1.4 : 0.8) / 10) * 10;
  return { k, big, name: def.name + (ROMAN[lap] ?? ` ${lap + 1}`), taunt: def.taunt, weak: def.weak, bane: def.bane, max, reward: big ? 400 : 150 };
}
// A new boss is sized to the hero: about three hands for a smaller one, five for a season boss,
// judged by how hard recent sets have been hitting. Never below its listed health.
const HANDS_TO_BEAT = { small: 3, big: 5 };
const SETS_PER_HAND = 17;
function spawnFoe(k, state) {
  const info = foeInfo(k);
  const paced = (state?.hitAvg ?? 0) * SETS_PER_HAND * (info.big ? HANDS_TO_BEAT.big : HANDS_TO_BEAT.small);
  const max = Math.max(info.max, Math.round(paced / 10) * 10);
  return { k, hp: max, max };
}

// ---------- items ----------

// Which armour slot strengthens which suit.
const SUIT_SLOT = { chest: 'chest', biceps: 'arms', back: 'cloak', triceps: 'hands', abs: 'belt', rest: 'boots' };

export function equipped(state, slot) {
  const id = state.equip?.[slot];
  return id ? ITEMS[id] ?? null : null;
}

// Adds an item to the collection. The first piece found for an empty slot goes straight on.
export function grant(state, id) {
  const item = ITEMS[id];
  if (!item) return null;
  const isNew = !state.items[id];
  state.items[id] = 1;
  const worn = !state.equip[item.slot];
  if (worn) state.equip[item.slot] = id;
  return { id, isNew, equipped: worn };
}

export function equip(state, id) {
  const item = ITEMS[id];
  if (!item || !state.items[id]) return false;
  state.equip[item.slot] = id;
  return true;
}

// Spends iron to make the next rung of a line, given the rung below it.
export function forge(state, id) {
  const item = ITEMS[id];
  if (!item || item.rarity === 0 || state.items[id]) return false;
  const below = `${item.line}-${item.rarity - 1}`;
  const cost = FORGE_COST[item.rarity];
  if (!state.items[below] || state.iron < cost) return false;
  state.iron -= cost;
  state.items[id] = 1;
  if (state.equip[item.slot] === below) state.equip[item.slot] = id;
  return true;
}

// Rarity odds improve with every boss beaten. min: lowest rarity allowed.
function rollRarity(state, rng, min = 0) {
  const beaten = state.foesDown ?? 0;
  const odds = [
    Math.max(5, 60 - 6 * beaten), 30, Math.min(30, 8 + 2 * beaten),
    Math.min(20, 1.5 + beaten), Math.min(4, 0.3 + 0.2 * beaten),
  ].map((w, r) => (r < min ? 0 : w));
  let roll = rng() * odds.reduce((a, b) => a + b, 0);
  for (let r = 0; r < odds.length; r++) {
    if (!odds[r]) continue;
    roll -= odds[r];
    if (roll <= 0) return r;
  }
  return odds.length - 1;
}

// Picks an item you do not own yet (without granting it). A rarity you have completed falls to the
// one below, never to a better one, so the top tiers stay earned. Null when nothing is left to give.
export function rollItem(state, rng, { min = 0, force = null } = {}) {
  const want = force ?? rollRarity(state, rng, min);
  const lacking = (r) => Object.values(ITEMS).filter(it => it.rarity === r && !state.items[it.id]);
  for (let r = want; r >= 0; r--) {
    const pool = lacking(r);
    if (pool.length) return pick(rng, pool).id;
  }
  return null;
}

// What one set of this suit hits for before any multipliers.
export function power(state, suit) {
  return 10 + (suitLevelFor(state.suitXp[suit]).level - 1) + (equipped(state, SUIT_SLOT[suit])?.value ?? 0);
}

// One set against the current boss. trail is what has been played so far this hand.
// Pure: returns the hit and the entry to append to the trail, changes nothing.
function strike(state, trail, card, reps, record, skip = []) {
  if (!(reps > 0)) return { dmg: 0, crit: false, weak: false, bane: false, combos: [], iron: 0, entry: null };
  const suit = EX[card.ex].suit;
  const weapon = equipped(state, 'weapon');
  const perk = (kind) => (weapon?.perk === kind ? weapon.value : 0);
  const owned = (state.unlocked.combos ?? []).filter(c => !skip.includes(c));
  const foe = foeInfo(state.foe.k);
  const weak = foe.weak === suit;
  const bane = !!weapon && weapon.line === foe.bane;
  const prev = trail[trail.length - 1];
  const met = card.reps == null || reps >= card.reps;
  const crit = record;

  let dmg = power(state, suit);
  if (weak) dmg *= 1.5;
  if (card.boss) dmg *= 2;
  if (crit) dmg *= 2;
  // The weapon's bonus goes on top, after the multipliers.
  dmg += perk('flat');
  if (crit) dmg += perk('crit');
  if (card.boss) dmg += perk('finisher');
  if (weak) dmg += perk('weak');
  if (trail.length < 3) dmg += perk('opener');

  const combos = [];
  const beside = (a, b) => !!prev && ((prev.suit === a && suit === b) || (prev.suit === b && suit === a));
  if (owned.includes('pushpull') && beside('chest', 'back')) combos.push('pushpull');
  if (owned.includes('armlock') && beside('biceps', 'triceps')) combos.push('armlock');
  const run = met ? (prev?.run ?? 0) + 1 : 0;
  if (owned.includes('roll') && run >= 3) combos.push('roll');
  if (owned.includes('exploit') && weak && prev?.weak) combos.push('exploit');
  if (owned.includes('secondwind') && record && trail.some(t => t.rec)) combos.push('secondwind');
  const suits = new Set(trail.map(t => t.suit));
  if (owned.includes('fullhouse') && !suits.has(suit) && suits.size === 4) combos.push('fullhouse');
  for (const id of combos) dmg += COMBOS[id].bonus + perk('combo');
  // The right kind of weapon for this boss lifts the whole blow.
  if (bane) dmg *= 1 + BANE_BONUS;

  // In the arena the blow is also shaped by the fight so far. A forecast of a whole hand leaves that out.
  const arena = skip.includes('roll') ? null : arenaBlow(state);
  if (arena) dmg *= arena.mult;

  // Each set also knocks out one of the boss's gremlins, which drops iron for the forge.
  const iron = 1 + (crit ? 2 : 0) + (card.boss ? 2 : 0);
  return { dmg: Math.round(dmg), crit, weak, bane, combos, iron, arena, entry: { suit, run, rec: record, weak } };
}

// ---------- the arena ----------
// A fight with its own rules, in play only while the arena is switched on (settings.arena).
//   Fury builds with every set. When it is full, the next set is your weapon's ultimate.
//   After each blow the boss strikes back. Block it and your next hit is a riposte; take it and you are staggered.
//   Below half health a boss is enraged: harder to block, but it leaves itself open.
// There is no way to lose: a fight only ends sooner or later.
export const ARENA = { ult: 2.5, riposte: 1.15, stagger: 0.85, open: 1.1, furyLoss: 15 };
const ARMOUR_SLOTS = ['helm', 'chest', 'arms', 'cloak', 'hands', 'belt', 'boots'];
export const arenaOn = (state) => !!state.settings?.arena;
export const enraged = (foe) => foe.hp <= foe.max / 2;

// The chance to block the boss's counterattack. More and better armour blocks more;
// later bosses and enraged ones are harder to stop.
export function guard(state) {
  const armour = ARMOUR_SLOTS.reduce((n, slot) => n + (equipped(state, slot) ? equipped(state, slot).rarity + 1 : 0), 0);
  const chance = 0.2 + 0.015 * armour - 0.006 * Math.min(25, state.foe.k) - (enraged(state.foe) ? 0.12 : 0);
  return Math.max(0.08, Math.min(0.85, chance));
}

// How much fury one set earns.
export function furyGain(state, { crit, combos, onTarget }) {
  const weapon = equipped(state, 'weapon');
  return 18 + (onTarget ? 12 : 0) + (crit ? 25 : 0) + 8 * combos + 2 * (weapon ? weapon.rarity + 1 : 0);
}

// The feed for the big-screen game: where the fight stands, and the blow that was just struck.
// last: { res, was } from the set just logged (res from logSet, was the boss as it stood before), or null
// to say only where things stand. Each blow gets the next number, so a reader can tell new from seen.
export function fightFeed(state, last = null, now = 0) {
  if (last) state.feedSeq = (state.feedSeq ?? 0) + 1;
  const seq = state.feedSeq ?? 0, info = foeInfo(state.foe.k), weapon = equipped(state, 'weapon');
  const b = state.battle ?? { fury: 0, edge: 0 };
  const blow = last && {
    seq, dmg: last.res.dmg, crit: !!last.res.record, weak: !!last.res.weak, bane: !!last.res.bane,
    ult: !!last.res.fight?.ult, edge: last.res.fight?.edge ?? 0, blocked: last.res.fight?.blocked ?? null,
    enragedNow: !!last.res.fight?.enragedNow, down: !!last.res.foeDown,
    legend: !!last.res.foeDown?.legend, mythic: !!last.res.foeDown?.mythic,
    boss: { k: last.was.k, name: foeInfo(last.was.k).name, big: foeInfo(last.was.k).big, hpFrom: last.was.hp, hpTo: Math.max(0, last.was.hp - last.res.dmg), max: last.was.max },
  };
  return {
    v: 1, seq, at: now,
    boss: { k: state.foe.k, name: info.name, big: info.big, hp: Math.max(0, state.foe.hp), max: state.foe.max, enraged: enraged(state.foe) },
    hero: {
      weapon: weapon ? { id: weapon.id, line: weapon.line, rarity: weapon.rarity, name: weapon.name } : null,
      armour: Object.fromEntries(ARMOUR_SLOTS.map(slot => [slot, equipped(state, slot)?.rarity ?? -1])),
    },
    fight: { fury: b.fury, edge: b.edge, guard: Math.round(guard(state) * 100) },
    last: blow || null,
  };
}

// What the fight so far does to the blow about to land.
function arenaBlow(state) {
  if (!arenaOn(state)) return null;
  const b = state.battle ?? { fury: 0, edge: 0 };
  const ult = b.fury >= 100, open = enraged(state.foe);
  const mult = (ult ? ARENA.ult : 1) * (b.edge > 0 ? ARENA.riposte : b.edge < 0 ? ARENA.stagger : 1) * (open ? ARENA.open : 1);
  return { ult, edge: b.edge, open, mult };
}

// What the set about to be played would hit for, plain and as a record.
export function nextHit(state, hand) {
  const s = hand.steps[hand.i];
  if (!s) return null;
  const card = hand.blocks[s.b].cards[s.c];
  const trail = hand.trail ?? [];
  const reps = card.reps ?? 1;
  return {
    plain: strike(state, trail, card, reps, false).dmg,
    crit: strike(state, trail, card, reps, true).dmg,
    weak: EX[card.ex].suit === foeInfo(state.foe.k).weak,
  };
}

// What the rest of a hand should do to the boss if every target is met and nothing is a record.
export function forecast(state, hand) {
  const trail = [...(hand.trail ?? [])];
  const combos = new Set();
  let dmg = 0;
  for (const s of hand.steps.slice(hand.i)) {
    const card = hand.blocks[s.b].cards[s.c];
    const hit = strike(state, trail, card, card.reps ?? 1, false, ['roll']);
    if (hit.entry) trail.push(hit.entry);
    dmg += hit.dmg;
    hit.combos.forEach(c => combos.add(c));
  }
  const weakSuit = foeInfo(state.foe.k).weak;
  return { dmg, weak: handCards(hand).filter(c => EX[c.ex].suit === weakSuit).length, combos: [...combos] };
}

export function levelFor(xp, k = 120, p = 1.6) {
  const T = (n) => Math.round(k * Math.pow(n, p));
  let level = 1;
  while (xp >= T(level)) level++;
  return { level, into: xp - T(level - 1), span: T(level) - T(level - 1) };
}
export const suitLevelFor = (xp) => levelFor(xp, 60, 1.5);

export function heavyThing(kg) {
  if (!(kg >= HEAVY_THINGS[0][0])) return null;
  const fits = HEAVY_THINGS.filter(([w]) => kg >= w);
  const [w, one, many] = [...fits].reverse().find(([tw]) => kg >= tw * 2) ?? fits[fits.length - 1];
  const n = Math.floor(kg / w);
  return `${n} ${n === 1 ? one : many}`;
}

// How much stronger than the first session, on dumbbell lifts played at least twice.
// Uses estimated one-rep strength so heavier-for-fewer and lighter-for-more compare fairly.
export function strengthGain(state) {
  const oneRep = (w, r) => w * (1 + r / 30);
  const bySuit = {};
  for (const [key, lift] of Object.entries(state.lifts)) {
    const ex = EX[key];
    if (!ex || !isDb(ex) || !lift.first || lift.sessions < 2 || !lift.bests?.length) continue;
    const first = oneRep(lift.first.w, lift.first.r);
    const best = Math.max(...lift.bests.map(b => oneRep(b.w, b.r)));
    if (first > 0) (bySuit[ex.suit] ??= []).push(Math.max(0, best / first - 1));
  }
  const mean = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100);
  const suits = Object.fromEntries(Object.entries(bySuit).map(([s, xs]) => [s, mean(xs)]));
  const all = Object.values(bySuit).flat();
  return { overall: all.length ? mean(all) : null, suits };
}

export function multiplier(state, now) {
  if (!state.lastHandAt) return 1;
  const days = (now - state.lastHandAt) / DAY;
  if (days >= 5) return 2;
  if (days < 3) return 1.25;
  return 1;
}

// ---------- dealing ----------

export const handCards = (hand) => hand.blocks.flatMap(b => b.cards);

function makeCard(state, ex, mod, base, forceW) {
  const t = targetFor(state, ex, mod, base, forceW);
  return {
    ex: ex.id, key: t.key, mod: mod ?? null, w: t.w, reps: t.reps, lo: t.lo, hi: t.hi,
    first: t.first, bumpedFrom: t.bumpedFrom, lastTop: t.lastTop, boss: false, sets: [],
  };
}

function pickStyle(state, mode, season, rng) {
  if (mode === 'quick') return 'pairs';
  const wild = !season.def.range;
  return pickWeighted(rng, state.unlocked.styles, (s) => {
    let w = wild ? 1 : s === 'pairs' ? 3 : s === season.def.style ? 2.5 : 1.2;
    if (s !== 'pairs' && s === state.lastStyle) w *= 0.3;
    return w;
  });
}

function pickSuits(state, n, rng, now, must = [], avoid = []) {
  const owned = ownedExercises(state);
  const prev = new Set([...state.lastExercises, ...avoid]);
  const debt = { ...state.debt };
  const cap = {}, count = {};
  for (const s of SUIT_ORDER) {
    debt[s] += SUITS[s].weight / TOTAL_WEIGHT * n;
    const unseen = owned.filter(e => e.suit === s && !prev.has(e.id)).length;
    cap[s] = Math.min(s === 'abs' || s === 'rest' ? 1 : 2, Math.max(1, unseen));
    count[s] = 0;
  }
  const order = [];
  const recentlyTrained = (s) => state.lastTrained[s] && now - state.lastTrained[s] < 18 * HOUR;
  // The top-priority suits are in every hand unless they were trained in the last few hours.
  for (const s of must) {
    if (order.length < n && !recentlyTrained(s)) { debt[s] -= 1; count[s]++; order.push(s); }
  }
  while (order.length < n) {
    let best = null, bestScore = -Infinity;
    for (const s of SUIT_ORDER) {
      if (count[s] >= cap[s]) continue;
      const recent = recentlyTrained(s);
      const score = debt[s] + rng() * 0.2 - (recent ? 0.6 : 0);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    if (!best) break;
    debt[best] -= 1; count[best]++; order.push(best);
  }
  return order;
}

function pickExercises(state, suits, rng, avoid = []) {
  const owned = ownedExercises(state);
  const prev = new Set([...state.lastExercises, ...avoid]);
  const used = new Set();
  const seen = {};
  const out = [];
  for (const s of suits) {
    let cands = owned.filter(e => e.suit === s && !used.has(e.id));
    const unseen = cands.filter(e => !prev.has(e.id));
    if (unseen.length) cands = unseen;
    if (!cands.length) continue;
    const fresh = cands.filter(e => state.fresh.includes(e.id));
    let choice;
    if (fresh.length) {
      choice = pick(rng, fresh);
    } else {
      // Lead each big suit with a compound lift, then anything goes.
      if (!seen[s] && ['chest', 'back', 'rest'].includes(s)) {
        const compound = cands.filter(e => e.compound && isDb(e));
        if (compound.length) cands = compound;
      }
      const stale = cands
        .map(e => ({ e, at: (state.lifts[e.id]?.lastAt ?? 0) + rng() * HOUR }))
        .sort((a, b) => a.at - b.at)
        .slice(0, 3);
      choice = pick(rng, stale).e;
    }
    used.add(choice.id); seen[s] = true; out.push(choice);
  }
  return out;
}

function assignMods(state, exercises, wild, rng) {
  const owned = state.unlocked.mods;
  const mods = exercises.map(() => null);
  if (!owned.length) return mods;
  let left = wild ? 2 : 1;
  let fresh = owned.find(m => state.fresh.includes(`mod:${m}`));
  exercises.forEach((e, i) => {
    if (!left || !isDb(e)) return;
    const ok = owned.filter(m => m !== 'twentyone' || e.curl);
    if (!ok.length) return;
    if (fresh && ok.includes(fresh)) { mods[i] = fresh; fresh = null; left--; }
    else if (!fresh && rng() < 0.22) { mods[i] = pick(rng, ok); left--; }
  });
  return mods;
}

function groupCards(cards, styleId, quickChange) {
  const st = STYLES[styleId];
  const dbw = (c) => (isDb(EX[c.ex]) ? c.w : -1);
  const pool = [...cards].sort((a, b) => dbw(b) - dbw(a));
  const blocks = [];
  const take = (c) => pool.splice(pool.indexOf(c), 1)[0];

  // Cards with a twist are played alone: their rules need full attention.
  for (const c of pool.filter(c => c.mod)) {
    take(c);
    const rules = c.mod === 'restpause' ? { rounds: 3, rest: 15 } : c.mod === 'twentyone' ? { rounds: 2, rest: 60 } : { rounds: 3, rest: 60 };
    blocks.push({ cards: [c], ...rules });
  }
  if (st.leadSets) {
    for (const c of pool.filter(c => EX[c.ex].compound && isDb(EX[c.ex])).slice(0, 2)) {
      take(c);
      blocks.push({ cards: [c], rounds: st.leadSets, rest: 90, lead: true });
    }
  }
  while (pool.length) {
    const group = [pool.shift()];
    while (group.length < st.group) {
      const loaded = group.filter(c => isDb(EX[c.ex])).map(c => c.w);
      const fits = pool.filter(c => quickChange || !isDb(EX[c.ex]) || loaded.every(w => w === c.w));
      if (!fits.length) break;
      const suits = group.map(c => EX[c.ex].suit);
      const other = fits.filter(c => !suits.includes(EX[c.ex].suit));
      if (!other.length && group.length >= 2) break;
      const best = (other.length ? other : fits).sort((a, b) => dbw(b) - dbw(a))[0];
      group.push(take(best));
    }
    blocks.push({ cards: group, rounds: st.rounds, rest: group.length > 1 ? st.rest : Math.max(st.rest, 60) });
  }
  const bw = (b) => Math.max(...b.cards.map(dbw));
  return blocks.sort((a, b) => (b.lead ? 1 : 0) - (a.lead ? 1 : 0) || bw(b) - bw(a));
}

function pickBoss(state, blocks, rng) {
  const inHand = new Set(blocks.flatMap(b => b.cards).map(c => c.ex));
  const dbCards = blocks.flatMap(b => b.cards).filter(c => isDb(EX[c.ex]));
  const lastW = dbCards.length ? dbCards[dbCards.length - 1].w : null;
  let cands = ownedExercises(state).filter(e => !inHand.has(e.id) && (
    e.boss ||
    (lastW != null && isDb(e) && e.suit !== 'abs' && e.suit !== 'rest' &&
      currentWeight(state, e) >= lastW && currentWeight(state, e) <= lastW * 1.6)
  ));
  if (cands.length > 1) cands = cands.filter(e => e.id !== state.lastBoss);
  if (!cands.length) return null;
  const ex = pickWeighted(rng, cands, e => SUITS[e.suit].weight);
  const card = makeCard(state, ex, 'allout', null, lastW);
  card.boss = true;
  return { cards: [card], rounds: 1, rest: 0, boss: true };
}

function buildSteps(hand) {
  hand.steps = [];
  hand.blocks.forEach((b, bi) => {
    for (let r = 0; r < b.rounds; r++) b.cards.forEach((_, ci) => hand.steps.push({ b: bi, c: ci, round: r }));
  });
}

function restAfter(hand, i, quickChange) {
  const s = hand.steps[i], n = hand.steps[i + 1];
  if (!n) return { rest: 0, change: null };
  const block = hand.blocks[s.b];
  let rest = n.b !== s.b ? 60 : n.round !== s.round ? block.rest : 0;
  let loaded = null;
  for (let k = i; k >= 0 && loaded == null; k--) {
    const c = hand.blocks[hand.steps[k].b].cards[hand.steps[k].c];
    if (isDb(EX[c.ex])) loaded = c.w;
  }
  const next = hand.blocks[n.b].cards[n.c];
  const change = isDb(EX[next.ex]) && loaded != null && next.w !== loaded ? next.w : null;
  if (change != null && !quickChange) rest = Math.max(rest, 60);
  return { rest, change };
}

function estimate(hand, quickChange) {
  let sec = 0, changes = 0;
  hand.steps.forEach((s, i) => {
    const c = hand.blocks[s.b].cards[s.c];
    sec += EX[c.ex].kind === 'time' ? (c.reps ?? 45) : c.mod === 'twentyone' ? 60 : c.boss ? 50 : 40;
    const { rest, change } = restAfter(hand, i, quickChange);
    sec += rest || 12;
    if (change != null) { changes++; if (quickChange) sec += 10; }
  });
  hand.changes = changes;
  hand.estMin = Math.round(sec / 60);
  return hand.estMin;
}

function buildHand(state, opts, rng, now) {
  const { mode, style, base, n, wild, avoid } = opts;
  const quick = state.settings.quickChange;
  const suits = pickSuits(state, n, rng, now, mode === 'full' ? ['chest', 'biceps'] : ['chest'], avoid);
  const exercises = pickExercises(state, suits, rng, avoid);
  const mods = assignMods(state, exercises, wild, rng);
  const cards = exercises.map((e, i) => makeCard(state, e, mods[i], base));
  const blocks = groupCards(cards, style, quick);
  const boss = pickBoss(state, blocks, rng);
  if (boss) blocks.push(boss);
  const hand = { mode, style, base, blocks, i: 0, done: false, startedAt: null };
  buildSteps(hand);
  estimate(hand, quick);
  return hand;
}

// One optional side goal per hand. Winning pays extra; missing it costs nothing.
function pickBounty(state, hand, rng) {
  const cards = handCards(hand);
  const options = [{ type: 'clear', reward: 80 }];
  if (state.hands > 0) {
    const repeats = cards.filter(c => !c.boss && !c.first).length;
    if (repeats >= 1) {
      const n = 1 + Math.floor(rng() * Math.min(3, repeats));
      options.push({ type: 'records', n, reward: 50 + 30 * n });
    }
    const boss = cards.find(c => c.boss);
    if (boss && boss.lastTop != null) options.push({ type: 'boss', n: boss.lastTop, reward: 100 });
  }
  const bounty = pick(rng, options);
  if (state.hands > 0 && rng() < 0.15) { bounty.gold = true; bounty.reward *= 3; }
  return bounty;
}

// avoid: exercise ids to steer clear of, used when reshuffling so the new hand is actually new.
export function dealHand(state, mode, rng, now, avoid = []) {
  const season = seasonInfo(state);
  const style = pickStyle(state, mode, season, rng);
  const st = STYLES[style];
  const wild = !season.def.range;
  const raw = season.def.range ?? pick(rng, WILD_RANGES);
  const base = [Math.max(5, raw[0] + st.shift), Math.max(8, raw[1] + st.shift)];
  const sizes = mode === 'quick' ? [2] : style === 'heavy' ? [4] : style === 'circuit' ? [6, 5] : style === 'pump' ? [6, 5] : [5, 6, 4];
  const [lo, hi] = mode === 'quick' ? [6, 12] : [19, 28];
  const quick = state.settings.quickChange;

  let best = null, bestScore = -Infinity;
  for (let k = 0; k < 30; k++) {
    const h = buildHand(state, { mode, style, base, n: sizes[k % sizes.length], wild, avoid }, rng, now);
    const cards = handCards(h);
    const paired = h.blocks.filter(b => b.cards.length > 1).reduce((n, b) => n + b.cards.length, 0);
    const novel = cards.filter(c => !state.lifts[c.key]).length;
    const off = h.estMin < lo ? lo - h.estMin : h.estMin > hi ? h.estMin - hi : 0;
    const score = paired * 3 - h.changes * 2 + novel * 0.5 + rng() - off * 20;
    if (score > bestScore) { bestScore = score; best = h; }
  }
  // Still too long: shave a round off the last regular block, then drop it.
  let guard = 0;
  while (best.estMin > hi && guard++ < 12) {
    const regular = best.blocks.filter(b => !b.boss);
    const long = [...regular].reverse().find(b => b.rounds > 2);
    if (long) long.rounds--;
    else {
      if (regular.length < 2) break;
      const key = (b) => b.cards.some(c => ['chest', 'biceps'].includes(EX[c.ex].suit));
      const drop = [...regular].reverse().find(b => !key(b)) ?? regular[regular.length - 1];
      best.blocks.splice(best.blocks.indexOf(drop), 1);
    }
    buildSteps(best);
    estimate(best, quick);
  }
  const tally = {};
  for (const c of handCards(best)) tally[EX[c.ex].suit] = (tally[EX[c.ex].suit] ?? 0) + 1;
  best.suits = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || SUIT_ORDER.indexOf(a) - SUIT_ORDER.indexOf(b));
  best.mult = multiplier(state, now);
  best.bounty = pickBounty(state, best, rng);
  best.season = season.n;
  best.createdAt = now;
  best.id = `${now}-${Math.floor(rng() * 1e6)}`;
  return best;
}

// ---------- playing ----------

export function currentStep(hand, quickChange = false) {
  const s = hand.steps[hand.i];
  if (!s) return null;
  const block = hand.blocks[s.b];
  const card = block.cards[s.c];
  const n = hand.steps[hand.i + 1];
  const { rest, change } = restAfter(hand, hand.i, quickChange);
  return {
    ...s, block, card, rest, change,
    setNo: card.sets.length + 1,
    setsTotal: card.sets.length + hand.steps.slice(hand.i).filter(x => x.b === s.b && x.c === s.c).length,
    next: n ? hand.blocks[n.b].cards[n.c] : null,
    partners: block.cards.filter(c => c !== card),
    index: hand.i, total: hand.steps.length,
  };
}

// rng is optional: pass one to let a gremlin occasionally drop an item.
export function logSet(state, hand, reps, now, rng = null) {
  const s = hand.steps[hand.i];
  if (!s) return null;
  const card = hand.blocks[s.b].cards[s.c];
  if (!hand.startedAt) hand.startedAt = now;
  const known = state.lifts[card.key];
  hand.undo = {
    key: card.key, existed: !!known, bests: known ? known.bests.map(b => ({ ...b })) : null,
    foe: { ...state.foe }, foesDown: state.foesDown,
    items: { ...state.items }, equip: { ...state.equip }, iron: state.iron,
    dmg: hand.dmg ?? 0, handIron: hand.iron ?? 0, downs: hand.downs?.length ?? 0,
    drops: hand.drops?.length ?? 0, trail: hand.trail?.length ?? 0,
    battle: state.battle ? { ...state.battle } : null,
  };
  const lift = state.lifts[card.key] ??= { w: card.w, top: null, sessions: 0, bests: [], first: null, lastAt: 0 };
  const record = isRecord(lift, card.w, reps);
  if (reps > 0) addBest(lift, card.w, reps);
  const trail = hand.trail ??= [];
  const hit = strike(state, trail, card, reps, record);
  if (hit.entry) trail.push(hit.entry);
  state.foe.hp -= hit.dmg;
  hand.dmg = (hand.dmg ?? 0) + hit.dmg;
  state.iron += hit.iron;
  hand.iron = (hand.iron ?? 0) + hit.iron;
  // The arena: spend or build fury now. The boss's answer comes below, if it is still standing.
  let fight = null;
  if (hit.arena) {
    const b = state.battle ??= { fury: 0, edge: 0 };
    fight = { ult: hit.arena.ult, edge: b.edge, open: hit.arena.open, furyWas: b.fury, blocked: null, guard: null, enragedNow: false };
    b.fury = hit.arena.ult ? 0 : Math.min(100, b.fury + furyGain(state, { crit: hit.crit, combos: hit.combos.length, onTarget: reps >= (card.reps ?? 1) }));
    b.edge = 0;
  }
  let foeDown = null;
  if (state.foe.hp <= 0) {
    const info = foeInfo(state.foe.k);
    // The final blow on a season boss, landed as a record, makes its drop a legendary.
    // Land it with the weapon the boss fears and the drop is a mythic: the only way one ever drops.
    foeDown = { ...info, legend: info.big && hit.crit, mythic: info.big && hit.crit && hit.bane };
    state.foesDown++;
    (hand.downs ??= []).push({ k: state.foe.k, legend: foeDown.legend, mythic: foeDown.mythic });
    state.foe = spawnFoe(state.foe.k + 1, state);
  }
  if (fight && !foeDown) {
    const b = state.battle;
    fight.enragedNow = !fight.open && enraged(state.foe);
    // An ultimate leaves the boss too stunned to answer. Full fury is never knocked out of your hands.
    if (!fight.ult) {
      fight.guard = guard(state);
      fight.blocked = (rng ?? Math.random)() < fight.guard;
      b.edge = fight.blocked ? 1 : -1;
      if (!fight.blocked && b.fury < 100) b.fury = Math.max(0, b.fury - ARENA.furyLoss);
    }
  }
  if (fight) fight.fury = state.battle.fury;
  let drop = null;
  if (rng && hit.dmg > 0 && rng() < (hit.crit ? 0.035 : 0.012)) {
    const id = rollItem(state, rng);
    if (id) { drop = grant(state, id); (hand.drops ??= []).push(id); }
  }
  card.sets.push({ w: card.w, r: reps, rec: record, d: hit.dmg });
  hand.i++;
  if (hand.i >= hand.steps.length) hand.done = true;
  return {
    record, first: lift.sessions === 0, done: hand.done,
    dmg: hit.dmg, crit: hit.crit, weak: hit.weak, bane: hit.bane, combos: hit.combos, iron: hit.iron, foeDown, drop, fight,
  };
}

// Takes back the most recent set (one step only), for when a thumb slips.
export function undoSet(state, hand) {
  const u = hand.undo;
  if (!u || hand.i === 0) return false;
  const s = hand.steps[hand.i - 1];
  hand.blocks[s.b].cards[s.c].sets.pop();
  if (!u.existed) delete state.lifts[u.key];
  else state.lifts[u.key].bests = u.bests;
  if (u.foe) {
    state.foe = u.foe; state.foesDown = u.foesDown;
    if (u.items) { state.items = u.items; state.equip = u.equip; state.iron = u.iron; hand.iron = u.handIron; }
    hand.dmg = u.dmg;
    if (hand.downs) hand.downs.length = u.downs;
    if (hand.drops) hand.drops.length = u.drops ?? 0;
    if (hand.trail) hand.trail.length = u.trail;
    if (u.battle) state.battle = u.battle; else if ('battle' in u) delete state.battle;
  }
  hand.i--;
  hand.done = false;
  hand.undo = null;
  return true;
}

export function setCardWeight(state, hand, w) {
  const s = hand.steps[hand.i];
  if (!s) return;
  const card = hand.blocks[s.b].cards[s.c];
  if (!isDb(EX[card.ex])) return;
  card.w = clamp(w, state.settings.min, state.settings.max);
}

export function skipCard(hand) {
  const s = hand.steps[hand.i];
  if (!s) return;
  hand.steps = hand.steps.filter((x, k) => k < hand.i || !(x.b === s.b && x.c === s.c));
  hand.skipped = true;
  if (hand.i >= hand.steps.length) hand.done = true;
}

export function swapCard(state, hand, rng) {
  const s = hand.steps[hand.i];
  if (!s) return false;
  const card = hand.blocks[s.b].cards[s.c];
  if (card.sets.length) return false;
  const inHand = new Set(handCards(hand).map(c => c.ex));
  const suit = EX[card.ex].suit;
  // What is on the dumbbells when the boss comes up: the last weighted card before it.
  const loaded = handCards(hand).filter(c => !c.boss && isDb(EX[c.ex])).map(c => c.w).pop() ?? null;
  const cands = ownedExercises(state).filter(e => !inHand.has(e.id) && (card.boss
    // A boss can come from any suit: a bodyweight finisher, or a lift rated a bit above what is loaded.
    ? e.boss || (loaded != null && isDb(e) && e.suit !== 'abs' && e.suit !== 'rest' &&
        currentWeight(state, e) >= loaded && currentWeight(state, e) <= loaded * 1.6)
    : e.suit === suit));
  if (!cands.length) return false;
  let fresh;
  if (card.boss) {
    fresh = makeCard(state, pick(rng, cands), 'allout', null, loaded);
    fresh.boss = true;
  } else {
    // Prefer a card that fits what is already on the dumbbells.
    const sameLoad = cands.filter(e => !isDb(e) || currentWeight(state, e) === card.w);
    fresh = makeCard(state, pick(rng, sameLoad.length ? sameLoad : cands), null, hand.base);
  }
  Object.assign(card, fresh);
  return true;
}

// ---------- finishing ----------

function progress(lift, card, settings) {
  const ex = EX[card.ex];
  const reps = card.sets.map(s => s.r);
  const top = Math.max(...reps);
  if (card.boss || !isDb(ex)) {
    lift.w = card.w;
    lift.top = Math.max(top, 1);
    return;
  }
  const { step, min, max } = settings;
  lift.w = card.w;
  lift.prevW = null;
  if (reps.length >= 2 && reps.every(r => r >= card.hi) && card.w + step <= max) {
    lift.prevW = card.w; lift.w = card.w + step; lift.top = null;
  } else if (top < card.lo - 1 && card.w - step >= min) {
    lift.prevW = card.w; lift.w = card.w - step; lift.top = null;
  } else {
    lift.top = top;
  }
}

// bossDrop: false for an ordinary reward card, or { min, force } for what a beaten boss leaves behind.
function drawLoot(state, rng, bossDrop = false) {
  const s = state.settings;
  const locked = {
    exercise: EXERCISES.filter(e => !state.unlocked.exercises.includes(e.id) && (s.incline || !e.incline)),
    mod: Object.keys(MODS).filter(m => !state.unlocked.mods.includes(m)),
    theme: LOOT_THEMES.filter(t => !state.unlocked.themes.includes(t)),
    item: Object.values(ITEMS).filter(it => !state.items[it.id]),
    combo: Object.keys(COMBOS).filter(c => !state.unlocked.combos.includes(c)),
  };
  const drawOne = (n) => {
    let type;
    if (bossDrop) type = 'item';
    else if (n === 0 || n === 2) type = 'exercise';
    else if (n === 1) type = 'mod';
    else {
      const r = rng();
      type = r < 0.4 ? 'exercise' : r < 0.7 ? 'item' : r < 0.78 ? 'combo' : r < 0.86 ? 'mod' : r < 0.92 ? 'theme' : 'points';
    }
    // An item card is always possible: with nothing new to give it pays iron.
    if (type !== 'points' && type !== 'item' && !locked[type].length) type = ['exercise', 'item', 'combo', 'mod', 'theme'].find(t => locked[t].length) ?? 'points';
    if (type === 'item') {
      const id = rollItem(state, rng, bossDrop || {});
      // Nothing new at that rarity: the find is melted down for the forge instead.
      if (!id) {
        const amount = bossDrop ? 60 : 25;
        state.iron += amount;
        return { type: 'iron', amount };
      }
      locked.item = locked.item.filter(it => it.id !== id);
      return { type, id, equipped: grant(state, id).equipped };
    }
    if (type === 'combo') {
      const id = pick(rng, locked.combo);
      locked.combo.splice(locked.combo.indexOf(id), 1);
      state.unlocked.combos.push(id);
      return { type, id };
    }
    if (type === 'exercise') {
      const early = n < 3 ? locked.exercise.filter(e => e.suit === 'chest' || e.suit === 'biceps') : [];
      const ex = pickWeighted(rng, early.length ? early : locked.exercise, e => SUITS[e.suit].weight);
      locked.exercise.splice(locked.exercise.indexOf(ex), 1);
      state.unlocked.exercises.push(ex.id); state.fresh.push(ex.id);
      return { type, id: ex.id };
    }
    if (type === 'mod') {
      const id = n === 1 && locked.mod.includes('slow') ? 'slow' : pick(rng, locked.mod);
      locked.mod.splice(locked.mod.indexOf(id), 1);
      state.unlocked.mods.push(id); state.fresh.push(`mod:${id}`);
      return { type, id };
    }
    if (type === 'theme') {
      const id = pick(rng, locked.theme);
      locked.theme.splice(locked.theme.indexOf(id), 1);
      state.unlocked.themes.push(id);
      return { type, id };
    }
    const amount = pick(rng, [150, 200, 250, 400]);
    state.xp += amount;
    return { type: 'points', amount };
  };
  if (bossDrop) return [drawOne(99)];
  const items = [drawOne(state.loots)];
  if (state.loots >= 3 && rng() < 0.12) items.push(drawOne(state.loots));
  state.loots++;
  return items;
}

export function finishHand(state, hand, rng, now) {
  const played = handCards(hand).filter(c => c.sets.length);
  const before = { level: levelFor(state.xp).level, suits: {}, season: seasonInfo(state).n };
  for (const s of SUIT_ORDER) before.suits[s] = suitLevelFor(state.suitXp[s]).level;

  let sets = 0, kg = 0, base = 0;
  const records = [], suitGain = {}, suitSets = {};
  for (const c of played) {
    const ex = EX[c.ex];
    for (const set of c.sets) {
      sets++;
      let pts = c.boss ? 30 : 10;
      if (set.rec) { pts += 25; records.push({ ex: c.ex, mod: c.mod, w: set.w, r: set.r }); }
      base += pts;
      suitGain[ex.suit] = (suitGain[ex.suit] ?? 0) + pts;
      suitSets[ex.suit] = (suitSets[ex.suit] ?? 0) + 1;
      kg += set.w * set.r * (ex.kind === 'db2' ? 2 : 1);
    }
    const lift = state.lifts[c.key];
    if (lift.sessions === 0) {
      base += 15;
      lift.first = { w: c.w, r: Math.max(...c.sets.map(s => s.r)), at: now };
    }
    lift.sessions++;
    lift.lastAt = now;
    lift.log = [...(lift.log ?? []), { at: now, w: c.w, r: Math.max(...c.sets.map(s => s.r)) }].slice(-40);
    progress(lift, c, state.settings);
  }
  if (hand.done && sets > 0) base += 50;
  let bounty = null;
  if (hand.bounty) {
    const b = hand.bounty;
    const won = b.type === 'clear' ? !!hand.done && !hand.skipped
      : b.type === 'records' ? records.length >= b.n
      : played.some(c => c.boss && c.sets.some(s => s.rec));
    bounty = { ...b, won };
  }
  const pointsBonus = equipped(state, 'helm')?.value ?? 0; // percent
  const xp = Math.round(base * (hand.mult ?? 1) * (1 + pointsBonus / 100)) + (bounty?.won ? bounty.reward : 0);
  state.xp += xp;
  state.tonnage += kg;
  state.records += records.length;
  for (const s in suitGain) state.suitXp[s] += suitGain[s];

  // Pay down what each suit was owed, by the cards actually played.
  const regular = played.filter(c => !c.boss);
  for (const s of SUIT_ORDER) state.debt[s] += SUITS[s].weight / TOTAL_WEIGHT * regular.length;
  for (const c of regular) state.debt[EX[c.ex].suit] -= 1;
  for (const s in suitSets) if (suitSets[s] >= 2) state.lastTrained[s] = now;

  const counted = sets >= 3;
  let loot = [], newSeason = null;
  if (counted) {
    state.hands++;
    state.lastExercises = regular.map(c => c.ex);
    state.lastStyle = hand.style;
    state.lastBoss = played.find(c => c.boss)?.ex ?? null;
    state.lastHandAt = now;
    const usedMods = played.filter(c => c.mod).map(c => `mod:${c.mod}`);
    const usedEx = played.map(c => c.ex);
    state.fresh = state.fresh.filter(f => !usedEx.includes(f) && !usedMods.includes(f));
    loot = drawLoot(state, rng);
    // Nobody fights bare-handed for long: the first finished hand comes with a starter sword.
    if (!Object.values(ITEMS).some(it => it.slot === 'weapon' && state.items[it.id])) {
      loot.push({ type: 'item', id: 'sword-0', equipped: grant(state, 'sword-0').equipped });
    }
  }

  // Bosses beaten during this hand: bonus points and a guaranteed drop each.
  const downs = (hand.downs ?? []).map(d => ({ ...foeInfo(d.k), legend: d.legend, mythic: !!d.mythic }));
  let foePoints = 0;
  for (const d of downs) {
    foePoints += d.reward;
    loot.push(...drawLoot(state, rng, { min: d.big ? 3 : 1, force: d.mythic ? 5 : d.legend ? 4 : null }));
  }
  state.xp += foePoints;
  // Running average of what one set hits for, used to size the next boss.
  if (sets >= 3) {
    const perSet = (hand.dmg ?? 0) / sets;
    state.hitAvg = state.hitAvg ? state.hitAvg * 0.6 + perSet * 0.4 : perSet;
  }
  const foe = { dmg: hand.dmg ?? 0, downs, points: foePoints, now: { ...foeInfo(state.foe.k), hp: state.foe.hp, max: state.foe.max } };

  const season = seasonInfo(state);
  if (season.n > (hand.season ?? season.n)) {
    const d = season.def;
    if (d.style && !state.unlocked.styles.includes(d.style)) state.unlocked.styles.push(d.style);
    if (!state.unlocked.themes.includes(d.theme)) state.unlocked.themes.push(d.theme);
    state.settings.theme = d.theme;
    newSeason = { n: season.n, name: season.name, blurb: d.blurb, style: d.style, theme: d.theme };
  }

  const levelUps = [];
  for (const s of SUIT_ORDER) {
    const to = suitLevelFor(state.suitXp[s]).level;
    if (suitGain[s]) levelUps.push({ suit: s, from: before.suits[s], to, gained: suitGain[s] });
  }
  const minutes = hand.startedAt ? Math.max(1, Math.round((now - hand.startedAt) / 60000)) : 0;
  const summary = {
    xp, base, mult: hand.mult ?? 1, pointsBonus, iron: hand.iron ?? 0, drops: hand.drops ?? [], sets, kg, minutes, records, levelUps, loot, newSeason, counted, bounty, foe,
    complete: !!hand.done, level: { from: before.level, to: levelFor(state.xp).level },
  };
  if (sets > 0) {
    state.history.unshift({
      at: now, minutes, mode: hand.mode, style: hand.style, xp, sets, kg, records: records.length,
      cards: played.map(c => ({ ex: c.ex, mod: c.mod, boss: c.boss, sets: c.sets.map(s => [s.w, s.r]) })),
    });
    state.history.length = Math.min(state.history.length, 200);
  }
  state.current = null;
  state.pending = null;
  return summary;
}
