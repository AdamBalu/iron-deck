import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, logSet, undoSet, nextHit, foeInfo, grant, equip, guard, furyGain, ARENA,
} from '../js/engine.js';

const T0 = Date.UTC(2026, 10, 9, 18);
const setup = () => newState({ bench: 20, curl: 12.5, step: 2.5, incline: true, quickChange: false }, T0);
// A tiny hand with exactly the given cards, one set each, for checking single hits.
function tinyHand(cards) {
  return {
    mode: 'full', style: 'pairs', blocks: [{ cards: cards.map(c => ({ key: c.ex, w: 0, reps: 10, lo: 8, hi: 12, mod: null, boss: false, sets: [], ...c })), rounds: 1, rest: 0 }],
    steps: cards.map((_, i) => ({ b: 0, c: i, round: 0 })), i: 0, done: false, mult: 1,
  };
}
// A boss with plenty of health that is not weak to chest sets, so one fly is a plain hit.
const plainBoss = (s) => { while (foeInfo(s.foe.k).weak === 'chest') s.foe = { k: s.foe.k + 1, hp: 5000, max: 5000 }; s.foe.hp = s.foe.max = 5000; };
const arena = (over = {}) => { const s = setup(); s.settings.arena = true; plainBoss(s); Object.assign(s, over); return s; };
const fly = () => tinyHand([{ ex: 'fly', w: 10 }]);
const twoFlies = () => tinyHand([{ ex: 'fly', w: 10 }, { ex: 'fly', w: 10 }]);
// The boss's counterattack is one roll: always() blocks it, never() does not.
const always = () => 0, never = () => 0.999;

test('with the arena off a set is exactly what it was: no fury, no counterattack', () => {
  const s = setup();
  plainBoss(s);
  const hit = logSet(s, fly(), 10, T0, always);
  assert.equal(hit.fight, null);
  assert.equal(s.battle, undefined);
});

test('fury builds with every set, faster for hitting the target, records and better weapons', () => {
  const s = arena();
  const plain = furyGain(s, { crit: false, combos: 0, onTarget: false });
  assert.ok(furyGain(s, { crit: false, combos: 0, onTarget: true }) > plain);
  assert.ok(furyGain(s, { crit: true, combos: 0, onTarget: true }) > furyGain(s, { crit: false, combos: 0, onTarget: true }));
  grant(s, 'sword-3');
  assert.ok(furyGain(s, { crit: false, combos: 0, onTarget: false }) > plain, 'a better weapon stokes it faster');
  const hit = logSet(s, twoFlies(), 10, T0, always);
  assert.equal(hit.fight.furyWas, 0);
  assert.ok(hit.fight.fury > 0);
  assert.equal(hit.fight.fury, s.battle.fury);
});

test('full fury turns the next set into an ultimate: far more damage, fury spent, and no counterattack', () => {
  const normal = logSet(arena(), fly(), 10, T0, never).dmg;
  const s = arena({ battle: { fury: 100, edge: 0 } });
  const ult = logSet(s, twoFlies(), 10, T0, never);
  assert.equal(ult.fight.ult, true);
  assert.equal(ult.dmg, Math.round(normal * ARENA.ult));
  assert.equal(s.battle.fury, 0);
  assert.equal(ult.fight.blocked, null, 'the boss is too stunned to answer');
  assert.equal(s.battle.edge, 0);
});

test('the boss strikes back after a set: a block makes the next hit a riposte, a hit taken staggers you', () => {
  const normal = logSet(arena(), fly(), 10, T0, never).dmg;
  const blocked = arena();
  assert.equal(logSet(blocked, twoFlies(), 10, T0, always).fight.blocked, true);
  assert.equal(blocked.battle.edge, 1);
  assert.equal(logSet(arena({ battle: { fury: 0, edge: 1 } }), fly(), 10, T0, never).dmg, Math.round(normal * ARENA.riposte));

  const hurt = arena({ battle: { fury: 50, edge: 0 } });
  const taken = logSet(hurt, twoFlies(), 10, T0, never);
  assert.equal(taken.fight.blocked, false);
  assert.equal(hurt.battle.edge, -1);
  assert.equal(hurt.battle.fury, 50 + furyGain(hurt, { crit: false, combos: 0, onTarget: true }) - ARENA.furyLoss);
  assert.equal(logSet(arena({ battle: { fury: 0, edge: -1 } }), fly(), 10, T0, never).dmg, Math.round(normal * ARENA.stagger));
});

test('full fury is never knocked out of your hands', () => {
  const s = arena({ battle: { fury: 95, edge: 0 } });
  logSet(s, twoFlies(), 10, T0, never);
  assert.equal(s.battle.fury, 100);
});

test('armour is what blocks: more and better pieces raise the chance, later bosses lower it', () => {
  const s = arena();
  const bare = guard(s);
  grant(s, 'chest-0');
  const some = guard(s);
  for (const slot of ['helm', 'arms', 'cloak', 'hands', 'belt', 'boots']) { grant(s, `${slot}-4`); equip(s, `${slot}-4`); }
  const full = guard(s);
  assert.ok(bare < some && some < full, `${bare} ${some} ${full}`);
  assert.ok(full <= 0.85 && bare >= 0.08);
  const late = structuredClone(s);
  late.foe = { k: 20, hp: 5000, max: 5000 };
  assert.ok(guard(late) < full);
});

test('below half health a boss is enraged: harder to block, but every blow lands harder', () => {
  const calm = arena();
  const normal = logSet(structuredClone(calm), fly(), 10, T0, never).dmg;
  const angry = arena();
  angry.foe.hp = angry.foe.max / 2;
  assert.ok(guard(angry) < guard(calm));
  assert.equal(logSet(structuredClone(angry), fly(), 10, T0, never).dmg, Math.round(normal * ARENA.open));
  const tipping = arena();
  tipping.foe.hp = tipping.foe.max / 2 + 1;
  const first = logSet(tipping, twoFlies(), 10, T0, never);
  assert.equal(first.fight.enragedNow, true, 'the blow that takes it past half is the one that enrages it');
  assert.equal(logSet(tipping, tinyHand([{ ex: 'fly', w: 10 }]), 10, T0, never).fight.enragedNow, false, 'only once');
});

test('undo takes the fight back too, and the preview knows about fury and riposte', () => {
  const s = arena({ battle: { fury: 100, edge: 1 } });
  const hand = twoFlies();
  const peek = nextHit(s, hand).plain;
  const hit = logSet(s, hand, 10, T0, never);
  assert.equal(hit.dmg, peek);
  assert.deepEqual(s.battle, { fury: 0, edge: 0 });
  undoSet(s, hand);
  assert.deepEqual(s.battle, { fury: 100, edge: 1 });
});
