// Workout logic. No DOM, no storage: everything here takes the state and returns or mutates plain data.
import {
  SUITS, SUIT_ORDER, EXERCISES, EX, MODS, STYLES, LOOT_THEMES,
  SEASONS, SEASON_LENGTH, WILD_RANGES, HEAVY_THINGS,
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
    sound: true, buzz: true, theme: 'indigo',
  };
  const exercises = EXERCISES.filter(e => e.base && (settings.incline || !e.incline)).map(e => e.id);
  if (!settings.incline) exercises.push('seated-curl', 'squeeze-press');
  const zero = () => Object.fromEntries(SUIT_ORDER.map(s => [s, 0]));
  return {
    v: 1, createdAt: now, settings,
    xp: 0, suitXp: zero(), tonnage: 0, hands: 0, loots: 0, records: 0,
    debt: zero(), lifts: {},
    unlocked: { exercises, mods: [], styles: ['pairs'], themes: ['indigo'] },
    fresh: [], lastTrained: {}, lastExercises: [], lastStyle: null, lastBoss: null, lastHandAt: null,
    history: [], current: null, pending: null,
  };
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
export function seasonInfo(state, hands = state.hands) {
  const n = Math.floor(hands / SEASON_LENGTH) + 1;
  const def = SEASONS[(n - 1) % SEASONS.length];
  const lap = Math.floor((n - 1) / SEASONS.length);
  const handsIn = hands % SEASON_LENGTH;
  return {
    n, def, name: def.name + (ROMAN[lap] ?? ` ${lap + 1}`),
    handsIn, handsLeft: SEASON_LENGTH - handsIn, next: SEASONS[n % SEASONS.length],
  };
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

export function logSet(state, hand, reps, now) {
  const s = hand.steps[hand.i];
  if (!s) return null;
  const card = hand.blocks[s.b].cards[s.c];
  if (!hand.startedAt) hand.startedAt = now;
  const lift = state.lifts[card.key] ??= { w: card.w, top: null, sessions: 0, bests: [], first: null, lastAt: 0 };
  const record = isRecord(lift, card.w, reps);
  if (reps > 0) addBest(lift, card.w, reps);
  card.sets.push({ w: card.w, r: reps, rec: record });
  hand.i++;
  if (hand.i >= hand.steps.length) hand.done = true;
  return { record, first: lift.sessions === 0, done: hand.done };
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

function drawLoot(state, rng) {
  const s = state.settings;
  const locked = {
    exercise: EXERCISES.filter(e => !state.unlocked.exercises.includes(e.id) && (s.incline || !e.incline)),
    mod: Object.keys(MODS).filter(m => !state.unlocked.mods.includes(m)),
    theme: LOOT_THEMES.filter(t => !state.unlocked.themes.includes(t)),
  };
  const drawOne = (n) => {
    let type;
    if (n === 0 || n === 2) type = 'exercise';
    else if (n === 1) type = 'mod';
    else { const r = rng(); type = r < 0.62 ? 'exercise' : r < 0.77 ? 'mod' : r < 0.87 ? 'theme' : 'points'; }
    if (type !== 'points' && !locked[type].length) type = ['exercise', 'mod', 'theme'].find(t => locked[t].length) ?? 'points';
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
    progress(lift, c, state.settings);
  }
  if (hand.done && sets > 0) base += 50;
  const xp = Math.round(base * (hand.mult ?? 1));
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
    const season = seasonInfo(state);
    if (season.n > before.season) {
      const d = season.def;
      if (d.style && !state.unlocked.styles.includes(d.style)) state.unlocked.styles.push(d.style);
      if (!state.unlocked.themes.includes(d.theme)) state.unlocked.themes.push(d.theme);
      state.settings.theme = d.theme;
      newSeason = { n: season.n, name: season.name, blurb: d.blurb, style: d.style, theme: d.theme };
    }
  }

  const levelUps = [];
  for (const s of SUIT_ORDER) {
    const to = suitLevelFor(state.suitXp[s]).level;
    if (suitGain[s]) levelUps.push({ suit: s, from: before.suits[s], to, gained: suitGain[s] });
  }
  const minutes = hand.startedAt ? Math.max(1, Math.round((now - hand.startedAt) / 60000)) : 0;
  const summary = {
    xp, base, mult: hand.mult ?? 1, sets, kg, minutes, records, levelUps, loot, newSeason, counted,
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
