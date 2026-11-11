import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EX, SUIT_ORDER } from '../js/data.js';
import {
  newState, startWeight, targetFor, isRecord, dealHand, currentStep, logSet, finishHand,
  seasonInfo, levelFor, heavyThing, mulberry32, setCardWeight, skipCard, swapCard, handCards,
} from '../js/engine.js';

const DAY = 86400000;
const T0 = Date.UTC(2026, 10, 9, 18);
const setup = (over = {}) => newState({ bench: 20, curl: 12.5, step: 2.5, incline: true, quickChange: false, ...over }, T0);

// Play every remaining set of a hand, logging whatever repsFn returns (default: the target).
function play(state, hand, now, repsFn = (s) => s.card.reps ?? 12) {
  let guard = 0;
  while (!hand.done && guard++ < 200) logSet(state, hand, repsFn(currentStep(hand)), now);
  assert.ok(hand.done, 'hand should finish');
}
function fullRound(state, rng, now, mode = 'full', repsFn) {
  const hand = dealHand(state, mode, rng, now);
  play(state, hand, now, repsFn);
  return { hand, summary: finishHand(state, hand, rng, now + 25 * 60000) };
}

test('a new deck holds only starter cards the bench can handle', () => {
  const s = setup({ incline: false });
  assert.ok(s.unlocked.exercises.includes('bench-press'));
  assert.ok(!s.unlocked.exercises.includes('incline-press'), 'incline card on a flat bench');
  assert.ok(!s.unlocked.exercises.includes('spider'), 'unlockable card in the starting deck');
  assert.ok(s.unlocked.exercises.includes('seated-curl'), 'flat-bench decks get the seated curl instead');
});

test('starting weights come from the bench and curl numbers, rounded to a loadable weight', () => {
  const s = setup();
  assert.equal(startWeight(s, EX['bench-press']), 20);
  assert.equal(startWeight(s, EX['incline-press']), 17.5); // 17 is not loadable
  assert.equal(startWeight(s, EX['skull']), 7.5); // 8 is not loadable
  assert.equal(startWeight(s, EX['curl']), 12.5);
  assert.equal(startWeight(s, EX['fly']), 10);
  assert.equal(startWeight(s, EX['push-up']), 0);
});

test('first time with a card: starting weight, flagged as first', () => {
  const s = setup();
  const t = targetFor(s, EX['bench-press'], null, [8, 12]);
  assert.equal(t.first, true);
  assert.equal(t.w, 20);
  assert.ok(t.reps >= 8 && t.reps <= 12);
});

test('next time asks for one more rep than your best last time', () => {
  const s = setup();
  s.lifts['bench-press'] = { w: 20, top: 8, sessions: 1, bests: [{ w: 20, r: 8 }] };
  const t = targetFor(s, EX['bench-press'], null, [8, 12]);
  assert.equal(t.w, 20);
  assert.equal(t.reps, 9);
  assert.equal(t.lastTop, 8);
});

test('reps far above the range move you up a weight step straight away', () => {
  const s = setup();
  s.lifts['bench-press'] = { w: 20, top: 12, sessions: 3, bests: [{ w: 20, r: 12 }] };
  const t = targetFor(s, EX['bench-press'], null, [6, 10]);
  assert.equal(t.w, 22.5);
  assert.equal(t.reps, 6);
  assert.equal(t.bumpedFrom, 20);
});

test('records: more reps at the same weight, or any heavier weight, but never in the first session', () => {
  assert.equal(isRecord({ sessions: 0, bests: [] }, 20, 10), false);
  const lift = { sessions: 1, bests: [{ w: 20, r: 8 }] };
  assert.equal(isRecord(lift, 20, 9), true);
  assert.equal(isRecord(lift, 22.5, 5), true);
  assert.equal(isRecord(lift, 20, 8), false);
  assert.equal(isRecord(lift, 17.5, 8), false);
});

test('a full hand fits 20 to 30 minutes, uses only owned cards once each, and ends on a boss card', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const s = setup();
    const hand = dealHand(s, 'full', mulberry32(seed), T0);
    const cards = handCards(hand);
    assert.ok(cards.length >= 4 && cards.length <= 7, `seed ${seed}: ${cards.length} cards`);
    assert.ok(hand.estMin >= 18 && hand.estMin <= 30, `seed ${seed}: ${hand.estMin} min`);
    assert.equal(new Set(cards.map(c => c.ex)).size, cards.length, `seed ${seed}: repeated card`);
    for (const c of cards) assert.ok(s.unlocked.exercises.includes(c.ex), `seed ${seed}: ${c.ex} not owned`);
    assert.equal(hand.blocks.at(-1).cards[0].boss, true, `seed ${seed}: no boss`);
    assert.ok(cards.some(c => EX[c.ex].suit === 'chest'), `seed ${seed}: first hand without chest`);
  }
});

test('with slow-to-change dumbbells, cards played back to back never need a weight change', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const hand = dealHand(setup(), 'full', mulberry32(seed), T0);
    for (const b of hand.blocks) {
      const weights = new Set(b.cards.filter(c => EX[c.ex].kind.startsWith('db')).map(c => c.w));
      assert.ok(weights.size <= 1, `seed ${seed}: block mixes ${[...weights]}`);
    }
  }
});

test('a quick hand is about ten minutes', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const hand = dealHand(setup(), 'quick', mulberry32(seed), T0);
    assert.ok(handCards(hand).length <= 4);
    assert.ok(hand.estMin >= 6 && hand.estMin <= 13, `seed ${seed}: ${hand.estMin} min`);
  }
});

test('a flat bench is never dealt an incline card, even after unlocking many', () => {
  const s = setup({ incline: false });
  const rng = mulberry32(7);
  for (let i = 0; i < 30; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2 * DAY);
    for (const c of handCards(hand)) assert.ok(!EX[c.ex].incline, `${c.ex} dealt on a flat bench`);
  }
});

test('over many hands the sets follow the priority order: chest and biceps most, nothing starved', () => {
  const s = setup();
  const rng = mulberry32(42);
  const sets = Object.fromEntries(SUIT_ORDER.map(k => [k, 0]));
  let total = 0;
  for (let i = 0; i < 60; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2 * DAY);
    for (const c of handCards(hand)) { sets[EX[c.ex].suit] += c.sets.length; total += c.sets.length; }
  }
  const share = k => sets[k] / total;
  assert.ok(share('chest') > share('biceps'), `chest ${share('chest')} vs biceps ${share('biceps')}`);
  assert.ok(share('biceps') > share('triceps'), 'biceps should beat triceps');
  assert.ok(share('back') > share('abs'), 'back should beat abs');
  assert.ok(share('triceps') > share('rest'), 'triceps should beat the rest');
  assert.ok(share('chest') + share('biceps') > 0.4, 'top two suits should be over 40% of sets');
  for (const k of SUIT_ORDER) assert.ok(share(k) > 0.04, `${k} starved at ${share(k)}`);
});

test('back-to-back hands are different workouts', () => {
  const s = setup();
  const rng = mulberry32(3);
  let prev = null;
  for (let i = 0; i < 12; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2 * DAY);
    const ids = handCards(hand).filter(c => !c.boss).map(c => c.ex);
    if (prev) assert.ok(ids.filter(id => prev.includes(id)).length <= 1, `hand ${i} repeats ${ids.filter(id => prev.includes(id))}`);
    prev = ids;
  }
});

test('logging every set walks through the hand and marks it done', () => {
  const s = setup();
  const hand = dealHand(s, 'full', mulberry32(1), T0);
  const first = currentStep(hand);
  assert.equal(first.setNo, 1);
  assert.ok(first.card.ex);
  play(s, hand, T0);
  assert.equal(currentStep(hand), null);
  for (const b of hand.blocks) for (const c of b.cards) assert.equal(c.sets.length, b.rounds);
});

test('beating last time is announced as a record the moment the set is logged', () => {
  const s = setup();
  s.lifts['bench-press'] = { w: 20, top: 8, sessions: 1, bests: [{ w: 20, r: 8 }] };
  const hand = dealHand(s, 'full', mulberry32(1), T0);
  // Force the current card to be the bench press at 20 kg so the outcome is known.
  const step = currentStep(hand);
  Object.assign(step.card, { ex: 'bench-press', key: 'bench-press', w: 20, reps: 9, mod: null, boss: false });
  assert.equal(logSet(s, hand, 9, T0).record, true);
});

test('finishing a hand pays points, counts the kilos, records history and drops a new card', () => {
  const s = setup();
  const owned = s.unlocked.exercises.length;
  const { hand, summary } = fullRound(s, mulberry32(5), T0);
  let kg = 0;
  for (const c of handCards(hand)) for (const set of c.sets) kg += set.w * set.r * (EX[c.ex].kind === 'db2' ? 2 : 1);
  assert.ok(summary.xp > 0);
  assert.equal(s.xp, summary.xp);
  assert.equal(s.tonnage, kg);
  assert.equal(s.hands, 1);
  assert.equal(s.history.length, 1);
  assert.equal(summary.loot.length >= 1, true);
  assert.equal(summary.loot[0].type, 'exercise');
  assert.equal(s.unlocked.exercises.length, owned + 1);
  assert.equal(s.current, null);
});

test('hitting the top of the range on every set raises the weight next time', () => {
  const s = setup();
  const rng = mulberry32(9);
  const hand = dealHand(s, 'full', rng, T0);
  const card = handCards(hand).find(c => EX[c.ex].kind === 'db2' && !c.boss && !c.mod);
  play(s, hand, T0, (st) => st.card.hi ?? 12);
  finishHand(s, hand, rng, T0);
  const t = targetFor(s, EX[card.ex], null, [card.lo, card.hi]);
  assert.equal(t.w, card.w + 2.5);
  assert.equal(t.bumpedFrom, card.w);
});

test('a newly unlocked card shows up in the very next hand that plays its suit', () => {
  const s = setup();
  s.unlocked.exercises.push('spider');
  s.fresh.push('spider');
  const hand = dealHand(s, 'full', mulberry32(11), T0);
  const biceps = handCards(hand).filter(c => EX[c.ex].suit === 'biceps' && !c.boss);
  assert.ok(biceps.length > 0, 'expected biceps in the first hand');
  assert.ok(biceps.some(c => c.ex === 'spider'));
});

test('time away is rewarded on return and never punished', () => {
  const s = setup();
  const rng = mulberry32(2);
  assert.equal(dealHand(s, 'full', rng, T0).mult, 1);
  fullRound(s, rng, T0);
  assert.equal(dealHand(s, 'full', rng, T0 + 2 * DAY).mult, 1.25);
  assert.equal(dealHand(s, 'full', rng, T0 + 4 * DAY).mult, 1);
  assert.equal(dealHand(s, 'full', rng, T0 + 6 * DAY).mult, 2);
  assert.equal(dealHand(s, 'full', rng, T0 + 90 * DAY).mult, 2);
  assert.equal('streak' in s, false);
});

test('stopping early still pays for the sets done; a hand needs three sets to count', () => {
  const s = setup();
  const rng = mulberry32(4);
  const a = dealHand(s, 'full', rng, T0);
  logSet(s, a, 10, T0); logSet(s, a, 10, T0);
  const sa = finishHand(s, a, rng, T0);
  assert.ok(sa.xp > 0);
  assert.equal(sa.loot.length, 0);
  assert.equal(s.hands, 0);
  const b = dealHand(s, 'full', rng, T0 + DAY);
  for (let i = 0; i < 4; i++) logSet(s, b, 10, T0 + DAY);
  const sb = finishHand(s, b, rng, T0 + DAY);
  assert.ok(sb.loot.length >= 1);
  assert.equal(s.hands, 1);
});


test('a year of hands never breaks: every hand stays legal as the deck and seasons grow', () => {
  const s = setup();
  const rng = mulberry32(99);
  for (let i = 0; i < 150; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2.3 * DAY, i % 5 === 4 ? 'quick' : 'full',
      (st) => Math.max(1, (st.card.reps ?? 12) - (i % 3)));
    assert.ok(hand.estMin <= 32, `hand ${i} (${hand.style}) runs ${hand.estMin} min`);
    for (const c of handCards(hand)) assert.ok(c.w >= 0 && c.w <= s.settings.max, `hand ${i}: ${c.ex} at ${c.w}`);
  }
  assert.ok(s.unlocked.exercises.length > 40, 'the deck should have grown a lot');
  assert.ok(s.unlocked.mods.length >= 3);
});

test('changing the weight on a card sticks for the rest of the hand and for next time', () => {
  const s = setup();
  const rng = mulberry32(6);
  const hand = dealHand(s, 'full', rng, T0);
  const card = currentStep(hand).card;
  const kind = EX[card.ex].kind;
  if (kind.startsWith('db')) {
    setCardWeight(s, hand, card.w - 2.5);
    assert.equal(currentStep(hand).card.w, card.w);
    const w = card.w;
    play(s, hand, T0, () => 9);
    finishHand(s, hand, rng, T0);
    assert.equal(s.lifts[card.key].w, w);
  }
});

test('skipping a card drops its remaining sets; swapping trades it for another card of the same suit', () => {
  const s = setup();
  const hand = dealHand(s, 'full', mulberry32(13), T0);
  const before = currentStep(hand).card.ex;
  const suit = EX[before].suit;
  swapCard(s, hand, mulberry32(1));
  const after = currentStep(hand).card;
  assert.notEqual(after.ex, before);
  assert.equal(EX[after.ex].suit, suit);
  const stepsBefore = hand.steps.length;
  skipCard(hand);
  assert.ok(hand.steps.length < stepsBefore);
  assert.notEqual(currentStep(hand).card, after);
});

test('levels only go up and the lifetime total gets a comparison', () => {
  let prev = 0;
  for (const xp of [0, 100, 500, 2000, 10000]) {
    const l = levelFor(xp).level;
    assert.ok(l >= prev);
    prev = l;
  }
  assert.equal(levelFor(0).level, 1);
  assert.equal(heavyThing(18460), '3 elephants');
  assert.equal(heavyThing(95), '3 golden retrievers'); // the biggest thing lifted at least twice over
  assert.equal(heavyThing(5), '1 house cat');
  assert.equal(heavyThing(0), null);
});

test('at the heaviest loadable weight the target keeps adding reps instead of stalling', () => {
  const s = setup({ max: 20 });
  s.lifts['bench-press'] = { w: 20, top: 12, sessions: 4, bests: [{ w: 20, r: 12 }] };
  const t = targetFor(s, EX['bench-press'], null, [8, 12]);
  assert.equal(t.w, 20);
  assert.equal(t.reps, 13);
});

test('every full hand has a chest card and a biceps card when those muscles are rested', () => {
  const s = setup();
  const rng = mulberry32(21);
  for (let i = 0; i < 40; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2 * DAY);
    const suits = handCards(hand).filter(c => !c.boss).map(c => EX[c.ex].suit);
    assert.ok(suits.includes('chest'), `hand ${i} (${hand.style}) has no chest: ${suits}`);
    assert.ok(suits.includes('biceps'), `hand ${i} (${hand.style}) has no biceps: ${suits}`);
  }
});

test('swapping the boss card deals a different boss, from any suit', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = setup();
    const hand = dealHand(s, 'full', mulberry32(seed), T0);
    hand.i = hand.steps.length - 1;
    const before = currentStep(hand).card.ex;
    assert.equal(swapCard(s, hand, mulberry32(seed)), true, `seed ${seed}: no swap for ${before}`);
    const after = currentStep(hand).card;
    assert.notEqual(after.ex, before);
    assert.equal(after.boss, true);
    assert.equal(handCards(hand).filter(c => c.ex === after.ex).length, 1);
  }
});

test('reshuffling replaces the cards instead of dealing the same hand again', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = setup();
    const rng = mulberry32(seed);
    const a = dealHand(s, 'full', rng, T0);
    const first = handCards(a).filter(c => !c.boss).map(c => c.ex);
    const b = dealHand(s, 'full', rng, T0, first);
    const again = handCards(b).filter(c => !c.boss).map(c => c.ex).filter(id => first.includes(id));
    assert.ok(again.length <= 1, `seed ${seed}: reshuffle kept ${again}`);
  }
});

test('a quick hand always leads with chest when chest is rested', () => {
  const s = setup();
  const rng = mulberry32(31);
  for (let i = 0; i < 20; i++) {
    const { hand } = fullRound(s, rng, T0 + i * 2 * DAY, 'quick');
    assert.ok(handCards(hand).some(c => !c.boss && EX[c.ex].suit === 'chest'), `quick hand ${i} has no chest`);
  }
});

// ----- second round: undo, bounties, strength -----
import { undoSet, strengthGain } from '../js/engine.js';

test('undoing the last set removes it, steps back, and forgets the record it set', () => {
  const s = setup();
  s.lifts['bench-press'] = { w: 20, top: 8, sessions: 1, bests: [{ w: 20, r: 8 }] };
  const hand = dealHand(s, 'full', mulberry32(1), T0);
  const card = currentStep(hand).card;
  Object.assign(card, { ex: 'bench-press', key: 'bench-press', w: 20, reps: 9, mod: null, boss: false });
  assert.equal(undoSet(s, hand), false, 'nothing to undo before the first set');
  logSet(s, hand, 19, T0); // a slip of the thumb
  assert.equal(undoSet(s, hand), true);
  assert.equal(hand.i, 0);
  assert.equal(card.sets.length, 0);
  assert.deepEqual(s.lifts['bench-press'].bests, [{ w: 20, r: 8 }]);
  assert.equal(logSet(s, hand, 9, T0).record, true, 'the real set still counts as a record');
  assert.equal(undoSet(s, hand), true);
  assert.equal(undoSet(s, hand), false, 'only one step back');
});

test('undoing the final set reopens the hand', () => {
  const s = setup();
  const hand = dealHand(s, 'quick', mulberry32(2), T0);
  play(s, hand, T0);
  assert.equal(undoSet(s, hand), true);
  assert.equal(hand.done, false);
  assert.ok(currentStep(hand));
});

test('every hand carries a bounty, and the first one is simply to clear the hand', () => {
  const s = setup();
  const rng = mulberry32(3);
  const first = dealHand(s, 'full', rng, T0);
  assert.equal(first.bounty.type, 'clear');
  assert.ok(first.bounty.reward > 0);
  play(s, first, T0);
  const sum = finishHand(s, first, rng, T0);
  assert.equal(sum.bounty.won, true);
  assert.equal(sum.xp, Math.round(sum.base * sum.mult) + sum.bounty.reward);
  for (let i = 1; i < 30; i++) {
    const h = dealHand(s, 'full', rng, T0 + i * 2 * DAY);
    assert.ok(['clear', 'records', 'boss'].includes(h.bounty.type), `hand ${i}: ${h.bounty.type}`);
    play(s, h, T0 + i * 2 * DAY);
    finishHand(s, h, rng, T0 + i * 2 * DAY);
  }
});

test('a clear-the-hand bounty is lost by skipping a card or stopping early, without any penalty', () => {
  const s = setup();
  const rng = mulberry32(3);
  const hand = dealHand(s, 'full', rng, T0);
  skipCard(hand);
  play(s, hand, T0);
  const sum = finishHand(s, hand, rng, T0);
  assert.equal(sum.bounty.won, false);
  assert.equal(sum.xp, Math.round(sum.base * sum.mult));
});

test('a records bounty pays out when the hand sets that many records', () => {
  const s = setup();
  const rng = mulberry32(12);
  let won = 0, lost = 0;
  for (let i = 0; i < 40; i++) {
    const now = T0 + i * 2 * DAY;
    const h = dealHand(s, 'full', rng, now);
    play(s, h, now, (st) => (st.card.reps ?? 12) + (i % 2)); // every other hand beats the targets
    const sum = finishHand(s, h, rng, now);
    if (h.bounty.type === 'records') {
      assert.equal(sum.bounty.won, sum.records.length >= h.bounty.n, `hand ${i}`);
      sum.bounty.won ? won++ : lost++;
    }
  }
  assert.ok(won > 0, 'expected at least one records bounty to be won');
});

test('strength gain compares your first session on each lift with your best since', () => {
  const s = setup();
  assert.equal(strengthGain(s).overall, null);
  s.lifts['bench-press'] = { w: 22.5, top: 8, sessions: 4, first: { w: 20, r: 10, at: T0 }, bests: [{ w: 20, r: 12 }, { w: 22.5, r: 11 }] };
  s.lifts['curl'] = { w: 12.5, top: 12, sessions: 1, first: { w: 12.5, r: 12, at: T0 }, bests: [{ w: 12.5, r: 12 }] };
  s.lifts['push-up'] = { w: 0, top: 20, sessions: 3, first: { w: 0, r: 10, at: T0 }, bests: [{ w: 0, r: 20 }] };
  const g = strengthGain(s);
  assert.equal(g.suits.chest, 15); // 20x10 is worth about 26.7 kg for one rep, 22.5x11 about 30.8
  assert.equal(g.suits.biceps, undefined, 'one session is not a trend');
  assert.equal(g.overall, 15);
});

test('each lift keeps a short log of its best set per session for charting', () => {
  const s = setup();
  const rng = mulberry32(14);
  for (let i = 0; i < 12; i++) fullRound(s, rng, T0 + i * 2 * DAY);
  const logged = Object.values(s.lifts).filter(l => l.log?.length >= 2);
  assert.ok(logged.length > 3, 'several lifts should have two or more sessions logged');
  for (const l of logged) for (const p of l.log) assert.ok(p.at && p.r > 0 && p.w >= 0);
});

// ----- third round: bosses, hero, gear, combos -----
import { migrate, foeInfo, power } from '../js/engine.js';

// A tiny hand with exactly the given cards, one set each, for checking single hits.
function tinyHand(cards) {
  return {
    mode: 'full', style: 'pairs', blocks: [{ cards: cards.map(c => ({ key: c.ex, w: 0, reps: 10, lo: 8, hi: 12, mod: null, boss: false, sets: [], ...c })), rounds: 1, rest: 0 }],
    steps: cards.map((_, i) => ({ b: 0, c: i, round: 0 })), i: 0, done: false, mult: 1,
  };
}
const notWeak = (s, ...suits) => { while (suits.includes(foeInfo(s.foe.k).weak)) s.foe = { k: s.foe.k + 1, hp: 5000, max: 5000 }; s.foe.hp = s.foe.max = 5000; };

test('every set is a hit: it takes health off the boss, and a set of zero reps does nothing', () => {
  const s = setup();
  notWeak(s, 'chest');
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }]);
  const a = logSet(s, hand, 10, T0);
  assert.equal(a.dmg, power(s, 'chest'));
  assert.equal(s.foe.hp, 5000 - a.dmg);
  const b = logSet(s, hand, 0, T0);
  assert.equal(b.dmg, 0);
  assert.equal(s.foe.hp, 5000 - a.dmg);
});

test('a combo only lands once you own it: push-pull pays when chest and back sets are back to back', () => {
  const s = setup();
  notWeak(s, 'chest', 'back');
  const cards = [{ ex: 'bench-press', w: 20 }, { ex: 'one-arm-row', w: 20 }];
  let hand = tinyHand(cards);
  logSet(s, hand, 10, T0);
  assert.deepEqual(logSet(s, hand, 10, T0).combos, []);
  s.unlocked.combos.push('pushpull');
  hand = tinyHand(cards);
  logSet(s, hand, 10, T0);
  const hit = logSet(s, hand, 10, T0);
  assert.deepEqual(hit.combos, ['pushpull']);
  assert.ok(hit.dmg > power(s, 'back'));
});

test('beating a boss brings the next one at full health, and undo takes the kill back', () => {
  const s = setup();
  s.foe.hp = 5;
  const first = foeInfo(s.foe.k).name;
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }]);
  const hit = logSet(s, hand, 10, T0);
  assert.equal(hit.foeDown.name, first);
  assert.equal(s.foesDown, 1);
  assert.equal(s.foe.k, 1);
  assert.equal(s.foe.hp, s.foe.max);
  assert.equal(undoSet(s, hand), true);
  assert.equal(s.foesDown, 0);
  assert.equal(s.foe.k, 0);
  assert.equal(s.foe.hp, 5);
});

test('a boss never heals: months away change nothing', () => {
  const s = setup();
  const rng = mulberry32(18);
  fullRound(s, rng, T0);
  const hp = s.foe.hp;
  assert.ok(hp < s.foe.max);
  dealHand(s, 'full', rng, T0 + 200 * DAY);
  assert.equal(s.foe.hp, hp);
});

test('three bosses make a season: the first falls in a few hands and season two opens around the twelfth', () => {
  const s = setup();
  const rng = mulberry32(8);
  let hands = 0, last, firstDown = null;
  while (seasonInfo(s).n === 1 && hands < 30) {
    last = fullRound(s, rng, T0 + hands * 2 * DAY).summary;
    hands++;
    if (firstDown == null && s.foesDown >= 1) firstDown = hands;
  }
  assert.ok(firstDown >= 3 && firstDown <= 5, `first boss fell on hand ${firstDown}`);
  assert.ok(hands >= 9 && hands <= 16, `season two opened after ${hands} hands`);
  assert.equal(s.foesDown, 3);
  assert.equal(foeInfo(2).big, true);
  assert.equal(last.newSeason.name, 'Heavy metal');
  assert.ok(s.unlocked.styles.includes('heavy'));
  assert.ok(s.unlocked.themes.includes('forge'));
  assert.equal(s.settings.theme, 'forge');
});

test('bosses keep pace with a growing hero: late bosses still take a few hands, not one and not ten', () => {
  const s = setup();
  const rng = mulberry32(77);
  const lifter = mulberry32(5);
  const perBoss = [];
  let since = 0;
  for (let i = 0; i < 120; i++) {
    const before = s.foesDown;
    // a realistic lifter: meets the target about two sets in three, so records and critical hits are common
    fullRound(s, rng, T0 + i * 2 * DAY, 'full', (st) => Math.max(1, (st.card.reps ?? 12) - (lifter() < 0.35 ? 1 : 0)));
    since++;
    if (s.foesDown > before) { perBoss.push(since); since = 0; }
  }
  const late = perBoss.slice(-8);
  for (const n of late) assert.ok(n >= 2 && n <= 8, `a late boss took ${n} hands: ${perBoss}`);
});

import { forecast } from '../js/engine.js';

test('the forecast adds up a hand before it is played: weak-spot cards and the combos it is sure to land', () => {
  const s = setup();
  let k = 0;
  while (foeInfo(k).weak !== 'chest') k++;
  s.foe = { k, hp: 5000, max: 5000 };
  s.unlocked.combos.push('pushpull');
  const f = forecast(s, tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'one-arm-row', w: 20 }, { ex: 'fly', w: 10 }]));
  assert.equal(f.weak, 2);
  assert.deepEqual(f.combos, ['pushpull']);
  assert.equal(f.dmg, 15 + (10 + 8) + (15 + 8));
  assert.equal(s.foe.hp, 5000, 'forecasting must not touch the boss');
});

import { nextHit } from '../js/engine.js';

test('the next-hit preview matches what the set then does, plain and as a record', () => {
  const s = setup();
  notWeak(s, 'chest');
  s.lifts['bench-press'] = { w: 20, top: 8, sessions: 1, bests: [{ w: 20, r: 8 }] };
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }]);
  const peek = nextHit(s, hand);
  assert.equal(peek.plain, power(s, 'chest'));
  assert.equal(peek.weak, false);
  assert.equal(logSet(s, hand, 9, T0).dmg, peek.crit);
  assert.equal(nextHit(s, hand).plain, logSet(s, hand, 10, T0).dmg);
  assert.equal(nextHit(s, hand), null);
});

// ----- fourth round: items, rarities, iron and the forge -----
import { grant, equip, forge, rollItem, equipped } from '../js/engine.js';
import { ITEMS, FORGE_COST } from '../js/data.js';

const benchRecord = (s) => { s.lifts['bench-press'] = { w: 20, top: 8, sessions: 1, bests: [{ w: 20, r: 8 }] }; };

test('a new game starts with a boss at full health and empty hands; an older save is brought up to date', () => {
  const s = setup();
  assert.equal(s.foe.hp, s.foe.max);
  assert.deepEqual(s.items, {});
  assert.equal(s.iron, 0);
  assert.equal(equipped(s, 'weapon'), null);
  const old = setup();
  delete old.foe; delete old.foesDown; delete old.items; delete old.equip; delete old.iron; delete old.unlocked.combos;
  old.hands = 9;
  old.gear = { chest: 2, biceps: 0, back: 0, triceps: 0, abs: 1, rest: 0 };
  old.legends = ['wallbreaker'];
  migrate(old);
  assert.equal(old.foe.hp, old.foe.max);
  assert.equal(old.foesDown, 2, 'nine hands already played is worth two bosses');
  assert.equal(seasonInfo(old).n, 1);
  assert.deepEqual(old.unlocked.combos, []);
  assert.equal(equipped(old, 'chest').rarity, 1, 'tier-two chest gear becomes an uncommon breastplate');
  assert.equal(equipped(old, 'belt').rarity, 0);
  assert.ok(equipped(old, 'weapon'), 'an old legendary perk becomes a weapon');
  assert.equal(old.gear, undefined);
  assert.equal(old.legends, undefined);
});

test('a record is a critical hit, the finisher hits double, and the weak suit takes half again', () => {
  const s = setup();
  notWeak(s, 'chest');
  const base = power(s, 'chest');
  benchRecord(s);
  const crit = logSet(s, tinyHand([{ ex: 'bench-press', w: 20 }]), 9, T0);
  assert.equal(crit.crit, true);
  assert.equal(crit.dmg, base * 2);
  const fin = logSet(s, tinyHand([{ ex: 'push-up', key: 'push-up:allout', boss: true, reps: null }]), 20, T0);
  assert.equal(fin.dmg, base * 2);
  const weak = foeInfo(s.foe.k).weak;
  const ex = Object.values(EX).find(e => e.suit === weak);
  const w = logSet(s, tinyHand([{ ex: ex.id }]), 10, T0);
  assert.equal(w.dmg, Math.round(power(s, weak) * 1.5));
});

test('armour strengthens its suit, and the first piece you find for a slot goes straight on', () => {
  const s = setup();
  assert.equal(power(s, 'back'), 10);
  const got = grant(s, 'cloak-2');
  assert.equal(got.equipped, true);
  assert.equal(equipped(s, 'cloak').id, 'cloak-2');
  assert.equal(power(s, 'back'), 13);
  s.suitXp.back = 400; // level 4
  assert.equal(power(s, 'back'), 16);
  assert.equal(grant(s, 'cloak-0').equipped, false, 'a second piece waits in the armoury');
  assert.equal(equip(s, 'cloak-0'), true);
  assert.equal(power(s, 'back'), 14);
  assert.equal(equip(s, 'cloak-4'), false, 'cannot wear what you do not own');
});

test('each weapon type does its one thing', () => {
  const blank = setup();
  notWeak(blank, 'chest', 'back');
  const base = power(blank, 'chest');
  // Each is tested against a boss with no fear of that weapon, so only the weapon's own perk shows.
  const armed = (weapon, prep) => {
    const s = structuredClone(blank);
    grant(s, weapon);
    const line = weapon.split('-')[0];
    while (foeInfo(s.foe.k).bane === line || ['chest', 'back'].includes(foeInfo(s.foe.k).weak)) s.foe = { k: s.foe.k + 1, hp: 5000, max: 5000 };
    prep?.(s);
    return s;
  };

  const sword = armed('sword-2', benchRecord);
  assert.equal(logSet(sword, tinyHand([{ ex: 'bench-press', w: 20 }]), 9, T0).dmg, base * 2 + 13, 'sword: records');

  const zwei = armed('zweihander-1');
  assert.equal(logSet(zwei, tinyHand([{ ex: 'push-up', key: 'push-up:allout', boss: true, reps: null }]), 20, T0).dmg, base * 2 + 26, 'zweihander: finisher');

  const hammer = armed('hammer-2');
  const four = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }, { ex: 'push-up' }, { ex: 'floor-press', w: 20 }]);
  assert.deepEqual([0, 1, 2, 3].map(() => logSet(hammer, four, 10, T0).dmg), [base + 14, base + 14, base + 14, base], 'hammer: first three sets');

  const axe = armed('axe-2', (s) => { let k = 0; while (foeInfo(k).weak !== 'chest') k++; s.foe = { k, hp: 5000, max: 5000 }; });
  assert.equal(logSet(axe, tinyHand([{ ex: 'bench-press', w: 20 }]), 10, T0).dmg, Math.round(base * 1.5) + 11, 'axe: weak spot');

  const mace = armed('mace-2');
  assert.equal(logSet(mace, tinyHand([{ ex: 'bench-press', w: 20 }]), 10, T0).dmg, base + 3, 'mace: every set');

  const halberd = armed('halberd-2', (s) => s.unlocked.combos.push('pushpull'));
  const pair = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'one-arm-row', w: 20 }]);
  logSet(halberd, pair, 10, T0);
  assert.equal(logSet(halberd, pair, 10, T0).dmg, power(halberd, 'back') + 8 + 9, 'polearm: combos');
});

test('iron comes from every set and forges the next rung of a line you own', () => {
  const s = setup();
  notWeak(s, 'chest');
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }]);
  assert.equal(logSet(s, hand, 10, T0).iron, 1);
  assert.equal(s.iron, 1);
  assert.equal(logSet(s, hand, 0, T0).iron, 0, 'no reps, no iron');
  benchRecord(s);
  assert.equal(logSet(s, tinyHand([{ ex: 'bench-press', w: 20 }]), 9, T0).iron, 3, 'a record pays triple');

  assert.equal(forge(s, 'sword-1'), false, 'cannot forge a line you do not own');
  grant(s, 'sword-0');
  s.iron = FORGE_COST[1] - 1;
  assert.equal(forge(s, 'sword-1'), false, 'not enough iron');
  s.iron = FORGE_COST[1] + 5;
  assert.equal(forge(s, 'sword-1'), true);
  assert.equal(s.iron, 5);
  assert.ok(s.items['sword-1'] && s.items['sword-0'], 'the old rung stays in the collection');
  assert.equal(equipped(s, 'weapon').id, 'sword-1', 'forging what you hold upgrades what you hold');
  s.iron = 9999;
  assert.equal(forge(s, 'sword-3'), false, 'no skipping rungs');
  assert.equal(forge(s, 'sword-1'), false, 'already owned');
});

test('early loot is mostly common and the odds improve as bosses fall', () => {
  const odds = (down) => {
    const s = setup();
    s.foesDown = down;
    const rng = mulberry32(down + 1);
    const n = [0, 0, 0, 0, 0];
    for (let i = 0; i < 3000; i++) n[ITEMS[rollItem(s, rng)].rarity]++;
    return n.map(x => x / 3000);
  };
  const early = odds(0), late = odds(20);
  assert.ok(early[0] > 0.5, `early commons ${early[0]}`);
  assert.ok(early[4] < 0.02, `early legendaries ${early[4]}`);
  assert.ok(late[3] + late[4] > 0.15, `late epics and legendaries ${late[3] + late[4]}`);
  assert.ok(late[0] < early[0]);
});

test('a rolled item is always one you lack, and a finished rarity never spills into a better one', () => {
  const s = setup();
  const rng = mulberry32(3);
  const seen = new Set();
  let empty = 0;
  for (let i = 0; i < 400; i++) {
    const id = rollItem(s, rng);
    if (!id) { empty++; continue; }
    assert.ok(!seen.has(id), `roll ${i} repeated ${id}`);
    seen.add(id);
    grant(s, id);
  }
  const owned = (r) => Object.values(ITEMS).filter(it => it.rarity === r && s.items[it.id]).length;
  assert.equal(owned(0), 13, 'every common turns up');
  assert.ok(owned(4) <= 3, `with no bosses beaten, legendaries stay rare: got ${owned(4)}`);
  assert.ok(empty > 100, 'most late rolls come up empty instead of handing out better gear');

  const full = setup();
  for (const it of Object.values(ITEMS)) if (it.rarity === 4) grant(full, it.id);
  assert.equal(ITEMS[rollItem(full, rng, { force: 4 })].rarity, 3, 'a forced rarity that is complete falls to the one below');
});

test('a reward card with nothing new to give melts down into iron for the forge', () => {
  const s = setup();
  for (const it of Object.values(ITEMS)) grant(s, it.id);
  s.foe.hp = 5;
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }]);
  logSet(s, hand, 10, T0);
  const ironBefore = s.iron;
  const sum = finishHand(s, hand, mulberry32(4), T0);
  const scrap = sum.loot.find(l => l.type === 'iron');
  assert.ok(scrap && scrap.amount > 0, JSON.stringify(sum.loot));
  assert.equal(s.iron, ironBefore + scrap.amount);
});
test('the first finished hand hands you a starter sword, already in your grip', () => {
  const s = setup();
  const { summary } = fullRound(s, mulberry32(5), T0);
  assert.ok(summary.loot.some(l => l.type === 'item' && l.id === 'sword-0'), JSON.stringify(summary.loot));
  assert.equal(equipped(s, 'weapon').id, 'sword-0');
  const again = fullRound(s, mulberry32(6), T0 + 2 * DAY).summary;
  assert.ok(!again.loot.some(l => l.id === 'sword-0'), 'only once');
});

test('the hand that beats a boss pays bonus points and drops an item of uncommon rarity or better', () => {
  const s = setup();
  const rng = mulberry32(17);
  s.foe.hp = 30;
  const hand = dealHand(s, 'full', rng, T0);
  play(s, hand, T0);
  const xpBefore = s.xp;
  const sum = finishHand(s, hand, rng, T0);
  assert.equal(sum.foe.downs.length, 1);
  assert.ok(sum.foe.downs[0].reward > 0);
  assert.equal(s.xp - xpBefore, sum.xp + sum.foe.downs[0].reward);
  const drops = sum.loot.filter(l => l.type === 'item' && l.id !== 'sword-0');
  assert.ok(drops.length >= 1 && ITEMS[drops[0].id].rarity >= 1, JSON.stringify(sum.loot));
  assert.ok(sum.foe.dmg > 0);
  assert.equal(sum.foe.now.hp, s.foe.hp);
  assert.ok(sum.iron > 0);
});

test('finishing a season boss with a record drops a legendary; any other final blow drops an epic or better', () => {
  const dropFrom = (prep, reps) => {
    const s = setup();
    prep(s);
    const hand = tinyHand([{ ex: 'bench-press', w: 20 }]);
    const hit = logSet(s, hand, reps, T0);
    const sum = finishHand(s, hand, mulberry32(9), T0);
    return { hit, rarity: Math.max(-1, ...sum.loot.filter(l => l.type === 'item').map(l => ITEMS[l.id].rarity)) };
  };
  const big = (s) => { s.foe = { k: 2, hp: 5, max: 1370 }; };
  const record = dropFrom((s) => { big(s); benchRecord(s); }, 9);
  assert.equal(record.hit.foeDown.legend, true);
  assert.equal(record.rarity, 4);
  const plain = dropFrom(big, 10);
  assert.equal(plain.hit.foeDown.legend, false);
  assert.ok(plain.rarity >= 3, `season boss dropped rarity ${plain.rarity}`);
  const small = dropFrom((s) => { s.foe.hp = 5; benchRecord(s); }, 9);
  assert.equal(small.hit.foeDown.legend, false, 'smaller bosses carry no legendary');
});

test('a gremlin sometimes drops an item mid-hand, and undo takes it back', () => {
  const s = setup();
  const hand = tinyHand([{ ex: 'bench-press', w: 20 }, { ex: 'fly', w: 10 }]);
  const lucky = () => 0;
  const hit = logSet(s, hand, 10, T0, lucky);
  assert.ok(hit.drop, 'expected a drop');
  assert.ok(s.items[hit.drop.id]);
  assert.equal(undoSet(s, hand), true);
  assert.deepEqual(s.items, {});
  assert.equal(equipped(s, ITEMS[hit.drop.id].slot), null);
  assert.equal(s.iron, 0);
  assert.equal(logSet(s, hand, 10, T0).drop, null, 'no dice, no drop');
});

test('a helm makes every hand pay more points', () => {
  const plain = setup(), helmed = setup();
  grant(helmed, 'helm-2');
  const a = fullRound(plain, mulberry32(5), T0).summary;
  const b = fullRound(helmed, mulberry32(5), T0).summary;
  assert.equal(a.base, b.base, 'same hand, same play');
  assert.equal(b.xp - (b.bounty?.won ? b.bounty.reward : 0), Math.round(b.base * b.mult * 1.12));
  assert.ok(b.xp > a.xp);
});

import { WEAPONS } from '../js/data.js';

test('every boss is weak to one kind of weapon, and wielding it makes each hit a quarter harder', () => {
  for (let k = 0; k < 24; k++) assert.ok(WEAPONS[foeInfo(k).bane], `boss ${k} has no weapon weakness`);
  const s = setup();
  notWeak(s, 'chest');
  const bane = foeInfo(s.foe.k).bane;
  grant(s, `${bane}-0`);
  // a second boss that is weak to something else, to compare the same blow against
  let other = s.foe.k + 1;
  while (foeInfo(other).bane === bane || foeInfo(other).weak === 'chest') other++;
  const blow = (k) => { const t = structuredClone(s); t.foe = { k, hp: 5000, max: 5000 }; return logSet(t, tinyHand([{ ex: 'fly', w: 10 }, { ex: 'fly', w: 10 }, { ex: 'fly', w: 10 }, { ex: 'bench-press', w: 20 }].slice(3)), 10, T0); };
  const plain = blow(other), keen = blow(s.foe.k);
  assert.equal(plain.bane, false);
  assert.equal(keen.bane, true);
  assert.equal(keen.dmg, Math.round(plain.dmg * 1.25));
  const peek = nextHit(s, tinyHand([{ ex: 'bench-press', w: 20 }]));
  assert.equal(peek.plain, keen.dmg, 'the preview knows about it too');
});

import { RARITY, LINES } from '../js/data.js';

test('mythic is a sixth rung on every line, stronger than the legendary and far dearer to forge', () => {
  assert.equal(RARITY.length, 6);
  assert.equal(RARITY[5], 'Mythic');
  for (const line of LINES) {
    const top = ITEMS[`${line}-5`], below = ITEMS[`${line}-4`];
    assert.ok(top, `${line} has no mythic`);
    assert.equal(top.rarity, 5);
    assert.ok(top.value > below.value, `${top.name} is no stronger than ${below.name}`);
  }
  assert.ok(FORGE_COST[5] >= 2 * FORGE_COST[4], 'a mythic costs at least twice a legendary');
  const s = setup();
  grant(s, 'hammer-4');
  s.iron = FORGE_COST[5] - 1;
  assert.equal(forge(s, 'hammer-5'), false, 'not enough iron');
  s.iron = FORGE_COST[5];
  assert.equal(forge(s, 'hammer-5'), true);
  assert.equal(s.iron, 0);
  assert.equal(equipped(s, 'weapon').id, 'hammer-5', 'the legendary in your hand is replaced by the mythic');
});

test('a mythic never turns up by luck, however many bosses have fallen', () => {
  const s = setup();
  s.foesDown = 200;
  const rng = mulberry32(31);
  for (let i = 0; i < 4000; i++) assert.ok(ITEMS[rollItem(s, rng)].rarity <= 4);
  for (let i = 0; i < 400; i++) assert.ok(ITEMS[rollItem(s, rng, { min: 3 })].rarity <= 4);
});

test('the perfect kill drops a mythic: a season boss, finished with a record, with the weapon it fears in hand', () => {
  const kill = (prep, reps) => {
    const s = setup();
    s.foe = { k: 2, hp: 5, max: 1370 };
    prep(s);
    const hand = tinyHand([{ ex: 'bench-press', w: 20 }]);
    const hit = logSet(s, hand, reps, T0);
    const sum = finishHand(s, hand, mulberry32(9), T0);
    return { hit, rarity: Math.max(-1, ...sum.loot.filter(l => l.type === 'item').map(l => ITEMS[l.id].rarity)) };
  };
  const feared = (s) => grant(s, `${foeInfo(2).bane}-0`);
  const other = (s) => grant(s, `${Object.keys(WEAPONS).find(w => w !== foeInfo(2).bane)}-0`);
  const perfect = kill((s) => { feared(s); benchRecord(s); }, 9);
  assert.equal(perfect.hit.foeDown.mythic, true);
  assert.equal(perfect.rarity, 5);
  const wrongWeapon = kill((s) => { other(s); benchRecord(s); }, 9);
  assert.equal(wrongWeapon.hit.foeDown.mythic, false);
  assert.equal(wrongWeapon.rarity, 4, 'a record with another weapon is still a legendary');
  const noRecord = kill(feared, 10);
  assert.equal(noRecord.hit.foeDown.mythic, false);
  assert.ok(noRecord.rarity <= 4);
});

// ----- the calendar on the progress screen -----
import { calendar } from '../js/engine.js';

test('the calendar lights the days a hand was played, Monday first, and never looks ahead', () => {
  const at = (y, m, d, h = 18) => new Date(y, m, d, h).getTime(); // local time, as the app sees it
  const now = at(2026, 10, 11); // a Wednesday
  const s = setup();
  s.history = [
    { at: at(2026, 10, 11, 7) },      // today
    { at: at(2026, 10, 10, 23) },     // late last night still counts for Tuesday
    { at: at(2026, 10, 10, 6) },      // and so does that morning
    { at: at(2026, 9, 21) },          // a Wednesday three weeks back
    { at: at(2026, 7, 1) },           // too long ago to show
  ];
  const c = calendar(s, now);
  assert.equal(c.grid.length, 12);
  assert.equal(c.today, 11 * 7 + 2);
  assert.equal(c.grid[11][2], 1);
  assert.equal(c.grid[11][1], 2);
  assert.equal(c.grid[8][2], 1);
  assert.equal(c.hands, 4);
  assert.equal(c.activeWeeks, 2);
  assert.deepEqual(c.grid[11].slice(3), [0, 0, 0, 0]);
  assert.equal(calendar(setup(), now).hands, 0);
});
