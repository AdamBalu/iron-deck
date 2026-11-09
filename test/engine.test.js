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

test('the twelfth hand opens season two with a new style and a new look', () => {
  const s = setup();
  const rng = mulberry32(8);
  let last;
  assert.equal(seasonInfo(s).n, 1);
  for (let i = 0; i < 12; i++) last = fullRound(s, rng, T0 + i * 2 * DAY).summary;
  assert.equal(seasonInfo(s).n, 2);
  assert.equal(last.newSeason.name, 'Heavy metal');
  assert.ok(s.unlocked.styles.includes('heavy'));
  assert.ok(s.unlocked.themes.includes('forge'));
  assert.equal(s.settings.theme, 'forge');
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
