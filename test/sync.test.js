import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../js/sync.js';

// A save is known by when it last changed (stamp) and how far it has got (xp).
const save = (stamp, xp) => ({ stamp, xp });

test('nothing online yet: this device uploads what it has', () => {
  assert.equal(decide({ local: save(10, 300), cloud: null, base: null, linked: false, busy: false }), 'push');
  assert.equal(decide({ local: null, cloud: null, base: null, linked: false, busy: false }), 'none');
});

test('a new device with no progress quietly takes the account save', () => {
  assert.equal(decide({ local: null, cloud: save(50, 900), base: null, linked: false, busy: false }), 'pull');
  assert.equal(decide({ local: save(60, 0), cloud: save(50, 900), base: null, linked: false, busy: false }), 'pull');
});

test('a device with progress meeting an account with other progress asks which to keep', () => {
  assert.equal(decide({ local: save(60, 200), cloud: save(50, 900), base: null, linked: false, busy: false }), 'ask');
});

test('a device with progress fills an account that holds none', () => {
  assert.equal(decide({ local: save(60, 200), cloud: { stamp: 50, xp: 0, empty: true }, base: null, linked: false, busy: false }), 'push');
});

test('once linked, a change here goes up and a change there comes down', () => {
  assert.equal(decide({ local: save(70, 950), cloud: save(50, 900), base: 50, linked: true, busy: false }), 'push');
  assert.equal(decide({ local: save(50, 900), cloud: save(80, 990), base: 50, linked: true, busy: false }), 'pull');
  assert.equal(decide({ local: save(50, 900), cloud: save(50, 900), base: 50, linked: true, busy: false }), 'none');
});

test('a workout in progress is never replaced: the newer save waits until it is done', () => {
  assert.equal(decide({ local: save(50, 900), cloud: save(80, 990), base: 50, linked: true, busy: true }), 'wait');
  assert.equal(decide({ local: null, cloud: save(80, 990), base: null, linked: false, busy: true }), 'wait');
  // sets logged here still go up while busy
  assert.equal(decide({ local: save(70, 900), cloud: save(50, 900), base: 50, linked: true, busy: true }), 'push');
});

test('when both changed, the save that has got further wins, and a tie goes to the newer one', () => {
  // opening the other device and tapping around must not wipe a workout done elsewhere
  assert.equal(decide({ local: save(99, 900), cloud: save(80, 990), base: 50, linked: true, busy: false }), 'pull');
  assert.equal(decide({ local: save(70, 1200), cloud: save(80, 990), base: 50, linked: true, busy: false }), 'push');
  assert.equal(decide({ local: save(90, 990), cloud: save(80, 990), base: 50, linked: true, busy: false }), 'push');
  assert.equal(decide({ local: save(70, 990), cloud: save(80, 990), base: 50, linked: true, busy: false }), 'pull');
});

test('starting over on one device starts every device over', () => {
  // the account was wiped elsewhere: a device with nothing new of its own follows
  assert.equal(decide({ local: save(50, 900), cloud: { stamp: 80, xp: 0, empty: true }, base: 50, linked: true, busy: false }), 'pull');
  // a device that has played since keeps its progress and puts it back
  assert.equal(decide({ local: save(90, 950), cloud: { stamp: 80, xp: 0, empty: true }, base: 50, linked: true, busy: false }), 'push');
});
