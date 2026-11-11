import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, logSet, grant, foeInfo, fightFeed } from '../js/engine.js';

const T0 = Date.UTC(2026, 10, 9, 18);
const setup = () => { const s = newState({ bench: 20, curl: 12.5, step: 2.5, incline: true, quickChange: false, arena: true }, T0); s.foe.hp = s.foe.max = 5000; return s; };
const hand = () => ({
  mode: 'full', style: 'pairs', blocks: [{ cards: [{ key: 'fly', ex: 'fly', w: 10, reps: 10, lo: 8, hi: 12, mod: null, boss: false, sets: [] }, { key: 'fly', ex: 'fly', w: 10, reps: 10, lo: 8, hi: 12, mod: null, boss: false, sets: [] }], rounds: 1, rest: 0 }],
  steps: [{ b: 0, c: 0, round: 0 }, { b: 0, c: 1, round: 0 }], i: 0, done: false, mult: 1,
});

test('the big-screen feed says where the fight stands: the boss, the hero and the fury', () => {
  const s = setup();
  grant(s, 'hammer-2');
  grant(s, 'chest-1');
  s.battle = { fury: 60, edge: 1 };
  const feed = fightFeed(s, null, T0);
  assert.equal(feed.v, 1);
  assert.equal(feed.seq, 0);
  assert.deepEqual(feed.boss, { k: s.foe.k, name: foeInfo(s.foe.k).name, big: false, hp: 5000, max: 5000, enraged: false });
  assert.equal(feed.hero.weapon.line, 'hammer');
  assert.equal(feed.hero.weapon.rarity, 2);
  assert.equal(feed.hero.armour.chest, 1);
  assert.equal(feed.hero.armour.helm, -1, 'an empty slot is marked, not left out');
  assert.equal(feed.fight.fury, 60);
  assert.equal(feed.fight.edge, 1);
  assert.equal(feed.last, null);
});

test('every set becomes one numbered blow in the feed, carrying what the arena decided', () => {
  const s = setup();
  const h = hand();
  const was = { ...s.foe };
  const res = logSet(s, h, 10, T0, () => 0);
  const feed = fightFeed(s, { res, was }, T0 + 1000);
  assert.equal(feed.seq, 1);
  assert.equal(s.feedSeq, 1, 'the count is kept in the save');
  assert.equal(feed.last.seq, 1);
  assert.equal(feed.last.dmg, res.dmg);
  assert.equal(feed.last.blocked, true);
  assert.equal(feed.last.ult, false);
  assert.equal(feed.last.down, false);
  assert.deepEqual(feed.last.boss, { k: was.k, name: foeInfo(was.k).name, big: false, hpFrom: 5000, hpTo: 5000 - res.dmg, max: 5000 });
  const again = fightFeed(s, { res: logSet(s, h, 10, T0, () => 0.999), was: { ...s.foe } }, T0 + 2000);
  assert.equal(again.seq, 2);
  assert.equal(again.last.edge, 1, 'this blow was the riposte earned by the block before it');
  assert.equal(again.last.blocked, false);
});

test('the feed is small enough to send after every set', () => {
  const s = setup();
  const res = logSet(s, hand(), 10, T0, () => 0);
  assert.ok(JSON.stringify(fightFeed(s, { res, was: { ...s.foe } }, T0)).length < 1500);
});
