// Screens and interaction. All workout rules live in engine.js.
import {
  SUITS, SUIT_ORDER, EX, EXERCISES, MODS, STYLES, THEMES, COMBOS,
  ITEMS, RARITY, RARITY_COLOR, FORGE_COST, WEAPONS, ARMOR, SLOT_NAME, ULTIMATES, perkText,
} from './data.js';
import { playArena, closeArena } from './arena.js';
import { itemIcon, heroSvg, gremlinSvg, bossSvg } from './art.js';
import { picto } from './picto.js';
import { play, prime } from './sound.js';
import { decide, describe } from './sync.js';
import { connect } from './cloud.js';
import { FIREBASE } from './config.js';
import * as E from './engine.js';

const KEY = 'irondeck.v1';
const $app = document.getElementById('app');
const $fx = document.getElementById('fx');
const rng = Math.random;
const now = () => Date.now();
const HOUR = 3600000, DAY = 86400000;

function load() {
  try { const raw = localStorage.getItem(KEY); const s = raw ? JSON.parse(raw) : null; return s && s.v === 1 ? E.migrate(s) : null; }
  catch { return null; }
}
// Every real change is stamped with the time, which is how two devices tell whose save is newer.
// quiet: housekeeping the player did not do (a hand dealt ahead of time), which must not count as a change.
function save(quiet = false) {
  if (!quiet) S.stamp = now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked: keep playing */ }
  if (!quiet) queueSync();
}

let S = load();
// The arena is on unless it was switched off: saves from before it existed get it too.
if (S) S.settings.arena ??= true;

// ---------- one save across devices ----------
// The rules are in sync.js and the network in cloud.js. This part runs them and puts the result on screen.

const SYNC_KEY = 'irondeck.sync';
const sync = {
  cloud: null, user: null, status: 'off', problem: '', timer: null, running: false, again: false, waiting: false, ask: null,
  // which account this device last matched, and the stamp of the save they agreed on
  link: (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) ?? {}; } catch { return {}; } })(),
};
function setLink(uid, base) {
  sync.link = { uid, base };
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync.link)); } catch { /* ignore */ }
}
// A save from elsewhere never lands in the middle of a hand, its rewards or an opening item.
const syncBusy = () => ['deal', 'play', 'rest', 'finish'].includes(ui.screen) || !!rv.phase;
function queueSync(ms = 2500) {
  if (!sync.user) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(runSync, ms);
}
async function pushSave(uid) {
  // A save from before sign-in existed has no stamp yet: give it one and keep it.
  if (S && !S.stamp) { S.stamp = now(); save(true); }
  const stamp = S ? S.stamp : now();
  const facts = S ? { stamp, xp: S.xp, empty: false, ...describe(S, E.levelFor) } : { stamp, xp: 0, empty: true };
  await sync.cloud.write(uid, facts, S ? JSON.stringify(S) : null);
  setLink(uid, stamp);
}
async function pullSave(uid, cloud) {
  let next = null;
  if (!cloud.empty) {
    const data = JSON.parse(await sync.cloud.readSave(uid));
    if (data?.v !== 1 || !data.settings || !data.lifts) throw new Error('bad-save');
    next = E.migrate(data);
    next.settings.arena ??= true;
    next.stamp = cloud.stamp;
  }
  try {
    // The save being replaced is kept once, in case the wrong one was chosen.
    if (S) localStorage.setItem(`${KEY}.replaced`, JSON.stringify(S));
    if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY);
  } catch { /* storage full or blocked */ }
  S = next;
  setLink(uid, cloud.stamp);
  ui.hand = null; ui.summary = null; ui.dropQueue = [];
  go(S ? 'home' : 'setup');
  if (S) toast('Progress loaded from your account.');
}
async function runSync() {
  if (!sync.cloud || !sync.user) return;
  if (sync.running) { sync.again = true; return; }
  sync.running = true;
  clearTimeout(sync.timer);
  const uid = sync.user.uid, linked = sync.link.uid === uid;
  try {
    const cloud = await sync.cloud.readMeta(uid);
    const what = decide({
      local: S ? { stamp: S.stamp ?? 0, xp: S.xp } : null,
      cloud: cloud ? { stamp: cloud.stamp, xp: cloud.xp ?? 0, empty: !!cloud.empty } : null,
      base: linked ? sync.link.base : null, linked, busy: syncBusy(),
    });
    if (what === 'push') await pushSave(uid);
    else if (what === 'pull') await pullSave(uid, cloud);
    else if (what === 'ask') { sync.ask = cloud; ui.sheet = 'sync'; render(); }
    else if (what === 'none' && cloud && !linked) setLink(uid, cloud.stamp);
    sync.waiting = what === 'wait';
    sync.status = what === 'ask' || what === 'wait' ? what : 'ok';
  } catch (e) {
    sync.status = navigator.onLine === false ? 'offline' : 'error';
    sync.problem = e?.code ?? e?.message ?? '';
  }
  sync.running = false;
  if (ui.screen === 'settings' || ui.screen === 'setup') render();
  if (sync.again) { sync.again = false; queueSync(); }
}
// The big-screen game: after every set, and whenever asked, say where the fight stands.
// It only runs for a signed-in player who switched it on, and a failure never interrupts the workout.
function sendFeed(last = null) {
  if (!S?.settings.bigScreen || !S.feedCode || !sync.user || !sync.cloud?.writeFeed) return;
  const feed = E.fightFeed(S, last, now());
  if (last) save(true);
  sync.cloud.writeFeed(S.feedCode, feed).catch(() => { /* the next set sends it again */ });
}
const syncText = () => ({
  off: '', busy: 'Checking your online save.',
  ok: 'Your progress is saved online.',
  wait: 'A newer save is waiting. It loads as soon as this hand is done.',
  ask: 'This device and your account hold different progress. Choose one to carry on.',
  offline: 'You are offline. Your progress is safe on this device and goes online when you are back.',
  error: `Your online save could not be reached${sync.problem ? ` (${sync.problem})` : ''}. It will try again.`,
}[sync.status]);
const ui = {
  screen: S ? 'home' : 'setup', enter: true, sheet: null,
  setup: { bench: 20, curl: 12.5, step: 2.5, max: 30, incline: true, quickChange: false },
  hand: null, reps: 0, adjust: false, cue: false, hold: null, dropQueue: [], opened: new Set(),
  restEnd: 0, restTotal: 0, restChange: null, summary: null, confirmReset: false, install: null, notice: null,
};
let ticker = null;

// ---------- small helpers ----------

const kg = (w) => String(Math.round(w * 100) / 100);
const num = (n) => Math.round(n).toLocaleString('en-US');
const isDb = (ex) => ex.kind === 'db1' || ex.kind === 'db2';
const hand = () => S.current;
const stepNow = () => E.currentStep(S.current, S.settings.quickChange);

// Each suit mark is a flat shape plus one lighter facet, so it reads as a cut gem rather than a sticker.
const SHAPES = {
  chest: ['M12 1.5 22.5 12 12 22.5 1.5 12Z', 'M12 1.5 1.5 12H12Z'],
  biceps: ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20Z', 'M12 2A10 10 0 0 0 2 12h10Z'],
  back: ['M12 2.5 22.5 21h-21Z', 'M12 2.5 1.5 21H12Z'],
  triceps: ['M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z', 'M6 3h12.8L3 18.8V6a3 3 0 0 1 3-3Z'],
  abs: ['M12 1.5 21 6.8v10.4l-9 5.3-9-5.3V6.8Z', 'M12 1.5 3 6.8v10.4l9-5.2Z'],
  rest: ['M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z', 'M9 2h6v7H9Zm-7 7h7v6H2Z'],
};
const suitIcon = (s, size = 16) =>
  `<svg class="suit" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SHAPES[s][0]}" fill="${SUITS[s].color}"/><path d="${SHAPES[s][1]}" fill="#fff" opacity=".32"/></svg>`;
const ICON = {
  back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M14.5 5 8 12l6.5 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
};
const suitName = (s) => SUITS[s].short ?? SUITS[s].name;

function listWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function targetText(card) {
  const ex = EX[card.ex];
  if (ex.kind === 'time') return card.boss ? 'longest hold' : `${card.reps} sec`;
  if (ex.kind === 'bw') return card.boss ? 'all out' : `${card.reps} reps`;
  return `${kg(card.w)} kg${card.boss ? ', all out' : ` × ${card.reps}`}`;
}

const videoUrl = (ex) => 'https://www.youtube.com/results?search_query=' +
  encodeURIComponent(ex.q ?? `how to ${ex.name}${isDb(ex) && !/dumbbell/i.test(ex.name) ? ' dumbbell' : ''}`);
const videoLink = (ex) => `<a class="video" href="${videoUrl(ex)}" target="_blank" rel="noopener">Watch a video</a>`;

// The picture window of an exercise card: the movement, on a wash of the suit's colour.
const art = (id, size, animate = false) => `<span class="art" style="--c:${SUITS[EX[id].suit].color}">${picto(id, { size, animate })}</span>`;
// Shrinks a card title just enough that its longest word fits on one line instead of breaking.
const fit = (name, room) => Math.min(1, room / Math.max(...name.split(/[\s-]+/).map(w => w.length))).toFixed(2);
// A card title on at most two lines: broken where the two lines come out most even, and shrunk only
// as far as the longer line needs. room: how many characters fit across the card at full size.
function cardTitle(name, room) {
  const words = name.split(' ');
  let lines = [name], longest = name.length;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' '), second = words.slice(i).join(' ');
    const width = Math.max(first.length, second.length);
    if (width < longest) { longest = width; lines = [first, second]; }
  }
  return `<b style="--fit:${Math.max(0.66, Math.min(1, room / longest)).toFixed(2)}">${lines.join('<br>')}</b>`;
}

function bountyText(b) {
  if (b.type === 'records') return b.n === 1 ? 'set a new record' : `set ${b.n} new records`;
  if (b.type === 'boss') return `beat ${b.n} on the finisher`;
  return 'play every card to the end';
}

function applyTheme() {
  const t = THEMES[S?.settings.theme] ?? THEMES.indigo;
  const r = document.documentElement.style;
  r.setProperty('--table', t.table); r.setProperty('--deep', t.deep); r.setProperty('--pit', t.pit);
  r.setProperty('--gold', t.gold); r.setProperty('--gold-dark', t.goldDark); r.setProperty('--muted', t.muted);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', t.table);
}

// ---------- sound, vibration, screen lock ----------

function sfx(name, opts) { if (S?.settings.sound) play(name, opts); }
// Clips load on the first tap, so the first sound that matters is ready when it is needed.
document.addEventListener('pointerdown', () => { if (S?.settings.sound) prime(); }, { once: true, capture: true });
// Hammers, maces and bare fists land with a thud; anything with an edge cuts.
const blow = () => (['sword', 'zweihander', 'axe', 'halberd'].includes(E.equipped(S, 'weapon')?.line) ? 'blade' : 'blunt');
function buzz(pattern) { if (S?.settings.buzz && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } } }

let lock = null;
async function keepAwake(on) {
  try {
    if (on) lock = await navigator.wakeLock?.request('screen');
    else { await lock?.release(); lock = null; }
  } catch { /* not supported or denied */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S?.current && (ui.screen === 'play' || ui.screen === 'rest')) keepAwake(true);
});

let fxToken = 0;
function showFx(html, ms) {
  const mine = ++fxToken;
  $fx.innerHTML = html;
  setTimeout(() => { if (mine === fxToken) $fx.innerHTML = ''; }, ms);
}

// The fight, played for a moment after every set: your hero lunges and the boss takes the hit.
// was: the boss as it stood before the set. mode: 'hit', 'crit' for a record, 'down' for the final blow.
const STRIKE_AT = 0.36; // seconds into the scene at which the blow lands
function strike(res, was, mode, prize = '') {
  if (!res.dmg) return;
  const info = E.foeInfo(was.k), kind = blow();
  const pct = (hp) => Math.max(0, Math.round(hp / was.max * 100));
  const notes = [...res.combos.map(id => COMBOS[id].name), ...(res.weak ? ['Weak spot'] : []), ...(res.bane ? [`Fears ${WEAPONS[info.bane].many}`] : [])];
  const title = mode === 'down' ? `<p class="clash-title"><b>${info.name} is down</b><small>${prize}</small></p>`
    : mode === 'crit' ? '<p class="clash-title"><b>New record</b><small>Critical hit</small></p>' : '';
  const cut = kind === 'blade' ? 'M4 90Q60 64 96 6Q72 72 4 90Z' : 'M50 2 60 36 96 30 68 54 88 90 52 68 22 94 32 58 4 40 40 38Z';
  let html = `<div class="clash ${mode} ${kind}">
      <div class="clash-stage">
        <span class="clash-hero">${heroSvg(S.equip, { size: 132 })}</span>
        <span class="clash-foe ${info.big ? 'big' : ''}">
          <span class="clash-face">${bossSvg(was.k, 124)}</span>
          <svg class="clash-cut" viewBox="0 0 100 100" aria-hidden="true"><path d="${cut}"/></svg>
          <b class="clash-dmg">${num(res.dmg)}</b>
        </span>
      </div>
      <div class="clash-bar"><b>${info.name}</b><span class="hp"><i style="--from:${pct(was.hp)}%;--to:${pct(was.hp - res.dmg)}%"></i></span></div>
      <p class="clash-notes">${notes.length ? `<span>${notes.join(' + ')}</span>` : ''}<span>${gremlinSvg(20)}+${res.iron} iron</span></p>
      ${title}
    </div>`;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (mode !== 'hit' && !calm) {
    const colors = SUIT_ORDER.map(s => SUITS[s].color);
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      html += `<i class="bit" style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--rot:${Math.random() * 720 - 360}deg;background:${colors[i % colors.length]};animation-delay:${STRIKE_AT * 1000 + Math.random() * 90}ms"></i>`;
    }
  }
  const hold = { hit: 1350, crit: 1750, down: 2300 }[mode];
  showFx(html, hold);
  ui.fxUntil = now() + hold;
  sfx(`${mode}-${kind}`, { delay: calm ? 0 : STRIKE_AT });
  setTimeout(() => {
    buzz({ hit: 30, crit: [40, 30, 40, 30, 120], down: [60, 40, 60, 40, 60, 40, 220] }[mode]);
    if (mode !== 'hit' && !calm) { document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 650); }
  }, calm ? 0 : STRIKE_AT * 1000);
}
// Arena mode: the same blow, staged as a full exchange. Returns false when the arena is off or motion is reduced.
function duel(res, was, mode, prize = '') {
  if (!res.fight || !res.dmg || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const info = E.foeInfo(was.k), weapon = E.equipped(S, 'weapon');
  const pct = (hp) => Math.max(0, Math.round(hp / was.max * 100));
  const hold = playArena({
    equip: S.equip, weapon, kind: blow(), color: weapon ? RARITY_COLOR[weapon.rarity] : '#FFD23F',
    boss: { k: was.k, name: info.name, big: info.big }, hp: { from: pct(was.hp), to: pct(was.hp - res.dmg) },
    dmg: res.dmg, crit: !!res.record, down: mode === 'down', prize, fight: res.fight,
    notes: [...res.combos.map(id => COMBOS[id].name), ...(res.weak ? ['Weak spot'] : []), ...(res.bane ? ['Feared weapon'] : [])],
    ultName: ULTIMATES[weapon?.line ?? 'none'], sfx, buzz,
    // closing early (a tap) lets waiting loot open at once
    onClose: () => { ui.fxUntil = now(); },
  });
  ui.fxUntil = now() + hold;
  return hold;
}
// Loot waits for the fight to finish before it opens.
function revealDrops() {
  if (!ui.dropQueue.length) return;
  const open = () => (now() < (ui.fxUntil ?? 0) ? setTimeout(open, 120) : reveal(ui.dropQueue.splice(0), render));
  open();
}

function toast(text) {
  showFx(`<div class="toast">${text}</div>`, 1800);
}

// ---------- screens ----------

function setupScreen() {
  const s = ui.setup;
  const stepper = (field, label, hint) => `
    <div class="field">
      <div><b>${label}</b><small>${hint}</small></div>
      <div class="stepper">
        <button data-act="setup-step" data-field="${field}" data-d="-1" aria-label="Less">−</button>
        <output>${kg(s[field])} kg</output>
        <button data-act="setup-step" data-field="${field}" data-d="1" aria-label="More">+</button>
      </div>
    </div>`;
  const choice = (field, label, hint, options) => `
    <div class="field col">
      <div><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>
      <div class="seg">${options.map(([v, text]) =>
        `<button data-act="setup-set" data-field="${field}" data-val="${v}" class="${String(s[field]) === String(v) ? 'on' : ''}">${text}</button>`).join('')}</div>
    </div>`;
  return `
    <header class="hello">
      <h1>Iron Deck</h1>
      <p>Every workout is a hand of cards dealt fresh. Check your setup below and you are in.</p>
    </header>
    <section class="panel">
      ${stepper('bench', 'Bench press', 'Weight of each dumbbell')}
      ${stepper('curl', 'Biceps curl', 'Weight of each dumbbell')}
      ${stepper('max', 'Heaviest dumbbell', 'The most you can load on one')}
      ${choice('step', 'Smallest weight jump', 'Per dumbbell', [[1, '1 kg'], [2, '2 kg'], [2.5, '2.5 kg'], [5, '5 kg']])}
      ${choice('incline', 'Bench back tilts up', '', [[true, 'Yes'], [false, 'No, flat only']])}
      ${choice('quickChange', 'Changing the weight is', '', [[false, 'Slow, screw collars'], [true, 'Quick, dial or pin']])}
    </section>
    <button class="btn" data-act="setup-go">Deal my first hand</button>
    ${!sync.cloud ? '' : sync.user
      ? `<p class="signed">Signed in as ${sync.user.name}. ${sync.status === 'ok' ? 'No saved progress there yet: set up above and it will be kept.' : syncText()}</p>`
      : '<button class="ghost" data-act="sign-in">Played on another device? Sign in to load your progress</button>'}`;
}

function foeStrip({ compact = false, exposed = false } = {}) {
  const info = E.foeInfo(S.foe.k);
  const keen = E.equipped(S, 'weapon')?.line === info.bane;
  const pct = Math.max(0, Math.round(S.foe.hp / S.foe.max * 100));
  const from = ui.foeShown?.k === S.foe.k ? ui.foeShown.pct : 100;
  ui.foeShown = { k: S.foe.k, pct };
  return `<button class="foe ${info.big ? 'big' : ''} ${compact ? 'compact' : ''}" data-act="foe-info" aria-label="About this boss">
    <span class="crest">${bossSvg(S.foe.k, compact ? 34 : 56)}<i>${suitIcon(info.weak, compact ? 11 : 14)}</i></span>
    <span class="foe-main"><b>${info.name}${exposed ? '<em>Weak spot</em>' : ''}${compact && keen ? '<em class="keen">+25%</em>' : ''}</b><span class="hp"><i style="width:${from}%" data-w="${pct}"></i></span>${
      compact ? '' : `<small class="fear ${keen ? 'on' : ''}">Fears ${WEAPONS[info.bane].many}${keen ? '. Yours hits a quarter harder' : ''}</small>`}</span>
    <span class="foe-hp num">${num(Math.max(0, S.foe.hp))}</span>
  </button>`;
}

// Arena mode: where the fight stands, in one line under the boss.
function fightBar() {
  if (!E.arenaOn(S)) return '';
  const b = S.battle ?? { fury: 0, edge: 0 }, full = b.fury >= 100;
  const ult = ULTIMATES[E.equipped(S, 'weapon')?.line ?? 'none'];
  const edge = full ? `<em class="ready">${ult} ready</em>` : b.edge > 0 ? '<em class="good">Riposte +15%</em>' : b.edge < 0 ? '<em class="bad">Staggered −15%</em>' : '';
  return `<button class="fightbar ${full ? 'full' : ''}" data-act="fight-info" aria-label="How the fight works">
    <b>Fury</b><span class="hp"><i style="width:${b.fury}%"></i></span>
    <small>Block ${Math.round(E.guard(S) * 100)}%</small>${edge}</button>`;
}

function ensurePending() {
  const p = S.pending;
  if (!p || now() - p.createdAt > 3 * HOUR || p.mult !== E.multiplier(S, now())) {
    S.pending = E.dealHand(S, 'full', rng, now());
    save(true);
  }
  return S.pending;
}

function homeScreen() {
  const level = E.levelFor(S.xp).level;
  const season = E.seasonInfo(S);
  let banner, main, ghost, teaser, colors = ['chest', 'back'];
  if (S.current) {
    const st = stepNow();
    banner = `You have a hand in play, ${st ? `${st.index} of ${st.total} sets done` : 'almost finished'}.`;
    teaser = 'Pick up where you left off.';
    main = `<button class="btn" data-act="continue">Continue the hand</button>`;
    ghost = `<button class="ghost" data-act="finish-early">Finish it here and collect</button>`;
    colors = S.current.suits;
  } else {
    const p = ensurePending();
    const away = S.lastHandAt ? Math.floor((now() - S.lastHandAt) / DAY) : 0;
    if (!S.hands) banner = 'Your first hand sets your starting numbers. If a weight feels wrong, tap it and change it.';
    else if (p.mult === 2) banner = `Welcome back. ${away} days away earns you <strong>double points</strong> on this hand.`;
    else if (p.mult > 1) banner = 'The deck is still warm. Playing again this soon earns <strong>25% more points</strong>.';
    else banner = `Season ${season.n}, ${season.name}. ${season.left === 1 ? 'One boss' : `${season.left} bosses`} to beat before ${season.next.name} opens.`;
    const names = p.suits.slice(0, 2).map(s => suitName(s).toLowerCase());
    teaser = `Up next: <b>${listWords(names)}</b>, ${E.handCards(p).length} cards, about ${p.estMin} min`;
    main = `<button class="btn" data-act="deal" data-mode="full">Deal me in</button>`;
    ghost = `<button class="ghost" data-act="deal" data-mode="quick">No energy? Play a 10-minute hand</button>`;
    colors = p.suits;
  }
  const c1 = SUITS[colors[0] ?? 'chest'].color, c2 = SUITS[colors[1] ?? colors[0] ?? 'back'].color;
  return `
    <header class="top">
      <span class="brand">Iron Deck</span>
      <button class="chip" data-act="tab" data-to="progress">Level ${level}</button>
    </header>
    <p class="banner">${banner}</p>
    ${foeStrip()}
    <div class="stack-wrap"><div class="stack">
      <div class="back" style="--c:${c2}"><i></i></div>
      <div class="back" style="--c:${c1}"><i></i></div>
      <div class="back front"><i><span>?</span></i></div>
    </div></div>
    <p class="teaser">${teaser}</p>
    ${main}
    ${ghost}
    ${ui.install ? '<button class="ghost small" data-act="install">Add Iron Deck to your home screen</button>' : ''}`;
}

const RESHUFFLES = 3; // enough to dodge a hand you dislike, not enough to stall on

function blockLabel(b) {
  if (b.boss) return 'Finisher, one all-out set';
  const mod = b.cards[0].mod;
  if (mod === 'restpause') return 'Three sets, 15-second breathers';
  if (b.cards.length === 1) return `${b.rounds} sets${b.lead ? ', long rests' : ''}`;
  return `${b.cards.length === 2 ? 'Back to back' : 'Three in a row'}, ${b.rounds} rounds`;
}

function dealScreen() {
  const h = ui.hand;
  const style = STYLES[h.style];
  let loaded = null, i = 0;
  const blocks = h.blocks.map((b) => {
    // What to put on the dumbbells for this block, shown once in its heading.
    const weights = [...new Set(b.cards.filter(c => isDb(EX[c.ex])).map(c => c.w))];
    let load = '';
    if (weights.length > 1) load = `<span class="load">${weights.map(kg).join(' and ')} kg</span>`;
    else if (weights.length && weights[0] !== loaded) load = `<span class="load">${loaded == null ? 'Load' : 'Change to'} ${kg(weights[0])} kg</span>`;
    if (weights.length) loaded = weights[weights.length - 1];
    const rows = b.cards.map((c) => {
      const ex = EX[c.ex];
      return `<li class="mini" style="--i:${i++}">
        ${art(c.ex, 48)}
        <div><b>${ex.name}</b>${c.mod && MODS[c.mod] ? `<em>${MODS[c.mod].name}</em>` : ''}${state(c)}</div>
        <span class="tgt">${targetText(c)}</span>
      </li>`;
    }).join('');
    return `<section class="block ${b.boss ? 'boss' : ''} ${b.cards.length > 1 ? 'joined' : ''}">
      <h3><span>${blockLabel(b)}</span>${load}</h3><ul>${rows}</ul></section>`;
  }).join('');
  const f = E.forecast(S, h);
  const foe = E.foeInfo(S.foe.k);
  const fight = `<p class="fight">${suitIcon(foe.weak, 14)} Against <b>${foe.name}</b> this hand hits for about <b>${num(f.dmg)}</b>${
    f.weak ? `, with ${f.weak === 1 ? 'one card' : `${f.weak} cards`} on its weak spot` : ''}${
    f.combos.length ? `. Sets up ${listWords(f.combos.map(id => COMBOS[id].name))}` : ''}.</p>`;
  const left = Math.max(0, RESHUFFLES - (S.reshuffles ?? 0));
  function state(c) { return c.first && S.hands ? '<em class="new">New to you</em>' : c.bumpedFrom != null ? '<em class="new">Heavier than last time</em>' : ''; }
  return `
    <header class="top">
      <button class="icon" data-act="go-home" aria-label="Back">${ICON.back}</button>
      <span class="chip plain">${E.handCards(h).length} cards, about ${h.estMin} min</span>
    </header>
    <h1 class="title">${h.mode === 'quick' ? 'Quick hand' : style.name}</h1>
    <p class="sub">${h.mode === 'quick' ? 'Two cards and a finisher. In and out.' : style.how}${h.mult > 1 ? ` Points on this hand are ${h.mult === 2 ? 'doubled' : 'up 25%'}.` : ''}</p>
    ${h.bounty ? `<p class="bounty ${h.bounty.gold ? 'gold' : ''}"><b>${h.bounty.gold ? 'Golden bounty' : 'Bounty'}</b> ${bountyText(h.bounty)} for ${h.bounty.reward} extra points</p>` : ''}
    ${fight}
    <div class="blocks">${blocks}</div>
    <p class="warm">Warm up first: ten easy push-ups and some arm circles.</p>
    <div class="dock">
      <button class="btn" data-act="start">Start</button>
      ${left ? `<button class="ghost" data-act="reshuffle">Reshuffle, ${left} left</button>` : '<p class="ghost off">No reshuffles left for this hand</p>'}
    </div>`;
}

function beatLine(card) {
  const ex = EX[card.ex];
  const lift = S.lifts[card.key];
  const unit = ex.kind === 'time' ? ' seconds' : '';
  const at = isDb(ex) ? ` at ${kg(card.w)} kg` : '';
  if (!lift || lift.sessions === 0) {
    if (card.sets.length) return `Set 1 was ${card.sets[0].r}${unit}. Stay as close to it as you can.`;
    if (card.boss) return 'No number to beat yet. Whatever you get becomes your record.';
    return isDb(ex)
      ? `First time with this card, so the weight is a guess. Tap it to change. You want a weight you could lift about ${card.hi} times.`
      : 'First time with this card. Whatever you get is your starting number.';
  }
  const best = lift.bests.filter(b => b.w >= card.w).reduce((m, b) => Math.max(m, b.r), 0);
  if (!best) {
    return card.bumpedFrom != null
      ? `You outgrew ${kg(card.bumpedFrom)} kg. Every rep at this weight is a record.`
      : 'You have never gone this heavy. Every rep is a record.';
  }
  return `Your best${at} is <b>${best}</b>${unit}. ${ex.kind === 'time' ? `Hold ${best + 1}` : best + 1} for a new record.`;
}

function initStepUi() {
  const st = stepNow();
  if (!st) return;
  const c = st.card, ex = EX[c.ex];
  ui.reps = c.boss ? (c.lastTop ? c.lastTop + 1 : ex.kind === 'time' ? 30 : isDb(ex) ? 15 : 12) : c.reps;
  ui.adjust = false; ui.hold = null;
  ui.cue = false;
}

function playScreen() {
  const st = stepNow();
  if (!st) return '';
  const c = st.card, ex = EX[c.ex];
  const dots = hand().steps.map((_, i) => `<span class="${i < st.index ? 'done' : i === st.index ? 'now' : ''}"></span>`).join('');
  const timed = ex.kind === 'time';
  const withWho = st.partners.length ? `, back to back with ${listWords(st.partners.map(p => EX[p.ex].name.toLowerCase()))}` : '';
  const setLine = (c.boss ? 'The finisher. One set, everything you have.' : `Set ${st.setNo} of ${st.setsTotal}${withWho}`) +
    (ex.side ? (c.boss ? ' Count each side.' : '. Reps are for each side') : '');

  let target;
  if (isDb(ex)) {
    target = `<button class="target" data-act="toggle-adjust" aria-label="Change weight">
        <span class="num">${kg(c.w)}</span><small>kg${ex.kind === 'db2' ? ' each' : ''}</small>
        ${c.boss ? '' : `<span class="num x">×${c.reps}</span>`}
      </button>`;
  } else {
    target = `<div class="target"><span class="num">${c.boss ? 'Max' : c.reps}</span><small>${timed ? 'seconds' : 'reps'}</small></div>`;
  }
  const adjust = ui.adjust && isDb(ex) ? `<div class="adjust">
      <button data-act="w" data-d="-1">− ${kg(S.settings.step)} kg</button>
      <button data-act="w" data-d="1">+ ${kg(S.settings.step)} kg</button>
    </div>` : '';
  const nh = E.nextHit(S, hand());
  const foe = E.foeInfo(S.foe.k);
  let kill = '';
  // A record is only possible on a card you have played before.
  const canRecord = (S.lifts[c.key]?.sessions ?? 0) > 0;
  if (nh && (S.foe.hp <= nh.plain || (canRecord && S.foe.hp <= nh.crit))) {
    const lacking = (r) => Object.values(ITEMS).some(it => it.rarity === r && !S.items[it.id]);
    const legendLeft = foe.big && lacking(4);
    // The perfect kill: a record, on a season boss, with the weapon it fears.
    const mythicLeft = foe.big && lacking(5) && E.equipped(S, 'weapon')?.line === foe.bane;
    kill = `<p class="kill"><b>${foe.name}</b> has ${num(S.foe.hp)} health left. ${S.foe.hp <= nh.plain ? 'This set finishes it.' : 'A record on this set finishes it.'}${
      mythicLeft && canRecord ? ' Land the final blow as a record, with the weapon it fears in your hand, and it drops a <b>mythic</b>.'
        : legendLeft && canRecord ? ' Land the final blow as a record and it drops a legendary.' : ''}</p>`;
  }
  const mod = c.mod && MODS[c.mod] ? `<p class="twist"><b>${MODS[c.mod].name}.</b> ${MODS[c.mod].how}</p>` : '';

  let entry;
  if (timed && ui.hold) {
    entry = `<div class="holding"><span class="num" id="hold-num">0</span><small>seconds</small></div>
      <button class="btn dark" data-act="hold-stop">Stop</button>`;
  } else {
    entry = `<div class="reps">
        <button data-act="reps" data-d="-1" aria-label="Fewer">−</button>
        <output class="${ui.bump ? 'bump' : ''}"><b>${ui.reps}</b> ${timed ? 'sec' : ui.reps === 1 ? 'rep' : 'reps'}</output>
        <button data-act="reps" data-d="1" aria-label="More">+</button>
      </div>
      ${timed ? '<button class="btn line" data-act="hold-start">Start the clock</button>' : ''}
      <button class="btn dark" data-act="done">Done</button>`;
  }
  return `
    <header class="playbar">
      <div class="dots">${dots}</div>
      <button class="icon" data-act="menu" aria-label="More options">${ICON.more}</button>
    </header>
    ${foeStrip({ compact: true, exposed: !!nh?.weak })}${fightBar()}
    <article class="face ${c.boss ? 'bossface' : ''}">
      <div class="corner">${suitIcon(ex.suit, 18)}<span>${c.boss ? 'Finisher' : ex.suit === 'rest' ? 'Legs and shoulders' : `${suitName(ex.suit)} card`}</span>
        <button class="how" data-act="toggle-cue">${ui.cue ? 'Hide tips' : 'How to do it'}</button></div>
      ${art(c.ex, 160, true)}
      <h2>${ex.name}</h2>
      <p class="setno">${setLine}</p>
      ${ui.cue ? `<p class="cue">${ex.cue} ${videoLink(ex)}</p>` : ''}
      ${mod}
      ${target}
      ${adjust}
      <p class="beat">${beatLine(c)}</p>
      ${kill}
      <div class="entry">${entry}</div>
    </article>`;
}

function restScreen() {
  const st = stepNow();
  const c = st.card, ex = EX[c.ex];
  const change = ui.restChange != null
    ? `<p class="change">Change your dumbbells to <b>${kg(ui.restChange)} kg</b></p>` : '';
  return `
    <header class="playbar">
      <div class="dots">${hand().steps.map((_, i) => `<span class="${i < st.index ? 'done' : i === st.index ? 'now' : ''}"></span>`).join('')}</div>
      <button class="icon" data-act="menu" aria-label="More options">${ICON.more}</button>
    </header>
    ${foeStrip({ compact: true })}${fightBar()}
    <div class="resting">
      <div class="ring">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle class="track" cx="100" cy="100" r="90"/>
          <circle class="prog" id="rest-ring" cx="100" cy="100" r="90" pathLength="100"/>
        </svg>
        <p class="lead">Rest</p>
        <div class="num" id="rest-num">${Math.max(0, Math.ceil((ui.restEnd - now()) / 1000))}</div>
      </div>
      ${change}
      <div class="nextup">
        <small>Next up${c.boss ? ', the finisher' : `, set ${st.setNo} of ${st.setsTotal}`}</small>
        <div class="nextcard">
          <div class="mini plain">${suitIcon(ex.suit, 18)}<div><b>${ex.name}</b></div><span class="tgt">${targetText(c)}</span></div>
          <div class="nextbody">${art(c.ex, 112, true)}<p class="nexttip">${c.mod && MODS[c.mod] ? `<b>${MODS[c.mod].name}.</b> ${MODS[c.mod].how} ` : ''}${ex.cue} ${videoLink(ex)}</p></div>
        </div>
      </div>
    </div>
    <div class="dock">
      <button class="btn" data-act="rest-skip">I am ready</button>
      <button class="ghost" data-act="rest-add">15 more seconds</button>
    </div>`;
}

function lootCard(item, i) {
  let tag, big, sub;
  if (item.type === 'exercise') {
    const ex = EX[item.id];
    return `<button class="loot cardloot ${ui.opened.has(i) ? 'flipped still' : ''}" data-act="flip" data-i="${i}" aria-label="Flip your reward card">
      <span class="lootback"><i><span>?</span></i><em>Tap to flip</em></span>
      <span class="lootface"><small>${suitIcon(ex.suit, 12)} New ${suitName(ex.suit).toLowerCase()} card</small>${art(ex.id, 120)}${cardTitle(ex.name, 11)}<span>In your next hand</span></span>
    </button>`;
  } else if (item.type === 'mod') {
    tag = 'New twist'; big = MODS[item.id].name; sub = MODS[item.id].how;
  } else if (item.type === 'theme') {
    tag = 'New look'; big = THEMES[item.id].name;
    sub = S.settings.theme === item.id ? 'You are wearing it now.' : `<button class="wear" data-act="wear" data-theme="${item.id}">Wear it now</button>`;
  } else if (item.type === 'item') {
    const it = ITEMS[item.id];
    return `<button class="loot gearloot r${it.rarity} ${ui.opened.has(i) ? 'flipped still' : ''}" data-act="flip" data-item="${it.id}" data-i="${i}" aria-label="Open your reward" style="--rc:${RARITY_COLOR[it.rarity]}">
      <span class="lootback"><i><span>?</span></i><em>Tap to open</em></span>
      <span class="lootface">${itemIcon(it.id, 78)}<small>${RARITY[it.rarity]} ${SLOT_NAME[it.slot].toLowerCase()}</small><b>${it.name}</b></span>
    </button>`;
  } else if (item.type === 'combo') {
    tag = 'New combo'; big = COMBOS[item.id].name; sub = `${COMBOS[item.id].how} Worth ${COMBOS[item.id].bonus} extra damage.`;
  } else if (item.type === 'iron') {
    tag = 'Melted down'; big = `+${item.amount} iron`; sub = 'Nothing new at that rarity, so the find goes to the forge.';
  } else {
    tag = 'Jackpot'; big = `+${item.amount}`; sub = 'bonus points, just because';
  }
  return `<button class="loot ${ui.opened.has(i) ? 'flipped still' : ''}" data-act="flip" data-i="${i}" aria-label="Flip your reward card">
    <span class="lootback"><i><span>?</span></i><em>Tap to flip</em></span>
    <span class="lootface"><small>${tag}</small><b>${big}</b><span>${sub}</span></span>
  </button>`;
}

function finishScreen() {
  const m = ui.summary;
  const multNote = m.mult === 2 ? 'points, doubled' : m.mult > 1 ? 'points, warm deck bonus' : 'points';
  const ups = m.levelUps.map((u) => {
    const l = E.suitLevelFor(S.suitXp[u.suit]);
    return `<div class="lvl ${u.to > u.from ? 'up' : ''}">
      <p><span>${suitIcon(u.suit)} ${suitName(u.suit)}</span><span>${u.to > u.from ? `Level ${u.from} to ${u.to}` : `Level ${u.to}`}</span></p>
      <div class="bar"><i data-w="${Math.round(l.into / l.span * 100)}" style="background:${SUITS[u.suit].color}"></i></div>
    </div>`;
  }).join('');
  const season = m.newSeason ? `<section class="seasoncard">
      <small>Season ${m.newSeason.n} is open</small><b>${m.newSeason.name}</b>
      <p>${m.newSeason.blurb} The table has a new look to match.</p></section>` : '';
  const loot = m.loot.length ? `<section class="loots">
      <h3>${m.loot.length === 1 ? 'A card for you.' : m.foe.downs.length ? 'Your card, and what the boss dropped.' : m.loot.some(l => l.id === 'sword-0') ? 'A card for you, and something to fight with.' : 'Double drop. Two cards for you.'}</h3>
      <div class="lootrow">${m.loot.map(lootCard).join('')}</div></section>`
    : '<p class="sub center">Play three sets or more and every hand ends with a reward card.</p>';
  return `
    <h1 class="cleared">${m.complete ? 'Hand<br>cleared' : 'Folded<br>early'}</h1>
    ${m.complete ? '' : '<p class="sub">Every set you did still counts.</p>'}
    <div class="earn">
      <div><span class="num" id="xp-num" data-to="${m.xp}">+${ui.enter ? 0 : num(m.xp)}</span><small>${multNote}</small></div>
      <div><span class="num">${m.records.length}</span><small>${m.records.length === 1 ? 'new record' : 'new records'}</small></div>
    </div>
    <p class="facts">${m.sets} ${m.sets === 1 ? 'set' : 'sets'}, ${num(m.kg)} kg lifted, ${m.iron} iron${m.minutes ? `, ${m.minutes} min` : ''}${m.level.to > m.level.from ? `. You are now <b>level ${m.level.to}</b>` : ''}</p>
    ${m.bounty?.won ? `<p class="bounty won ${m.bounty.gold ? 'gold' : ''}"><b>${m.bounty.gold ? 'Golden bounty won' : 'Bounty won'}</b> ${m.bounty.reward} extra points: you managed to ${bountyText(m.bounty)}</p>` : ''}
    ${m.foe.downs.map(d => `<section class="seasoncard down">
      <span class="beaten">${bossSvg(d.k, 76)}</span>
      <small>${d.big ? 'Season boss beaten' : 'Boss beaten'}</small><b>${d.name}</b>
      <p>${d.reward} bonus points and a drop from its pockets.${d.mythic ? ' A record, landed with the weapon it feared: that drop is a <strong>mythic</strong>.' : d.legend ? ' You finished it with a record, so that drop is a <strong>legendary</strong>.' : ''}</p></section>`).join('')}
    <div class="foe-report"><small>${m.foe.downs.length ? 'Next in line' : `This hand hit for ${num(m.foe.dmg)}`}</small>${foeStrip()}</div>
    ${season}
    <section class="lvls">${ups}</section>
    ${loot}
    <button class="btn" data-act="go-home">Back to the table</button>`;
}

function progressScreen() {
  const lv = E.levelFor(S.xp);
  const season = E.seasonInfo(S);
  const thing = E.heavyThing(S.tonnage);
  const gain = E.strengthGain(S);
  const suits = SUIT_ORDER.map((s) => {
    const l = E.suitLevelFor(S.suitXp[s]);
    return `<div>${suitIcon(s)}<span>${suitName(s)}</span><span class="bar"><i style="width:${Math.round(l.into / l.span * 100)}%;background:${SUITS[s].color}"></i></span><span class="pct">${gain.suits[s] ? `+${gain.suits[s]}%` : ''}</span><span class="num">${l.level}</span></div>`;
  }).join('');
  const gains = Object.entries(S.lifts)
    .filter(([k, l]) => !k.includes(':') && l.first && l.sessions >= 2 && EX[k])
    .map(([k, l]) => {
      const ex = EX[k];
      const best = isDb(ex)
        ? l.bests.reduce((m, b) => (b.w > m.w || (b.w === m.w && b.r > m.r) ? b : m), { w: 0, r: 0 })
        : l.bests.reduce((m, b) => (b.r > m.r ? b : m), { w: 0, r: 0 });
      const fmt = (w, r) => (isDb(ex) ? `${kg(w)} kg × ${r}` : ex.kind === 'time' ? `${r} sec` : `${r} reps`);
      const grew = isDb(ex) ? best.w > l.first.w || best.r > l.first.r : best.r > l.first.r;
      return { ex, sessions: l.sessions, grew, text: `<li>${suitIcon(ex.suit, 14)}<span>${ex.name}</span><span>${fmt(l.first.w, l.first.r)} to <b>${fmt(best.w, best.r)}</b></span></li>` };
    })
    .filter(g => g.grew)
    .sort((a, b) => SUIT_ORDER.indexOf(a.ex.suit) - SUIT_ORDER.indexOf(b.ex.suit) || b.sessions - a.sessions)
    .slice(0, 8);
  const recent = S.history.slice(0, 5).map((h) => {
    const d = new Date(h.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `<li><span>${d}</span><span>${h.sets} sets, ${h.minutes} min</span><b>+${num(h.xp)}</b></li>`;
  }).join('');
  return `
    <header class="top">
      <span class="brand">Your progress</span>
      <button class="chip" data-act="tab" data-to="settings">Settings</button>
    </header>
    <section class="tonnage">
      <span class="num">${num(S.tonnage)} kg</span>
      <p>${thing ? `lifted so far. That is ${thing}.` : 'lifted so far. Play a hand and this starts climbing.'}</p>
    </section>
    ${gain.overall ? `<section class="stronger"><span class="num">+${gain.overall}%</span><p>stronger than your first sessions, on the lifts you have played more than once</p></section>` : ''}
    <section class="overall">
      <p><span>Level ${lv.level}</span><span>${num(lv.span - lv.into)} points to level ${lv.level + 1}</span></p>
      <div class="bar"><i style="width:${Math.round(lv.into / lv.span * 100)}%"></i></div>
      <p class="trio"><span><b>${S.hands}</b> hands played</span><span><b>${S.records}</b> records</span><span><b>${S.foesDown}</b> bosses beaten</span></p>
    </section>
    <section class="suits">${suits}</section>
    <section class="panel dark">
      <h3>Getting stronger</h3>
      ${gains.length ? `<ul class="gains">${gains.map(g => g.text).join('')}</ul>` : '<p class="empty">Play a card twice and your gains show up here, first number to best number.</p>'}
    </section>
    <section class="panel dark">
      <h3>Season ${season.n}, ${season.name}</h3>
      <div class="pips">${Array.from({ length: 3 }, (_, i) => `<span class="${i < season.beaten ? 'on' : ''}"></span>`).join('')}</div>
      <p class="empty">${season.left === 1 ? 'One boss' : `${season.left} bosses`} to beat before ${season.next.name} opens. ${season.next.blurb}</p>
    </section>
    ${recent ? `<section class="panel dark"><h3>Recent hands</h3><ul class="recent">${recent}</ul></section>` : ''}`;
}

function deckScreen() {
  const owned = new Set(S.unlocked.exercises);
  const possible = EXERCISES.filter(e => S.settings.incline || !e.incline);
  const suits = SUIT_ORDER.map((s) => {
    const cards = possible.filter(e => e.suit === s).sort((a, b) => owned.has(b.id) - owned.has(a.id));
    const have = cards.filter(e => owned.has(e.id)).length;
    return `<section class="decksuit">
      <h3>${suitIcon(s)} ${suitName(s)} <small>${have} of ${cards.length}</small></h3>
      <div class="grid">${cards.map(e => owned.has(e.id)
        ? `<button class="dcard ${S.fresh.includes(e.id) ? 'fresh' : ''}" data-act="card-info" data-id="${e.id}" style="--c:${SUITS[s].color}"><span class="dc-top">${suitIcon(s, 13)}${S.fresh.includes(e.id) ? '<em>New</em>' : ''}</span>${art(e.id, 96)}${cardTitle(e.name, 10)}</button>`
        : `<div class="dcard locked" style="--c:${SUITS[s].color}"><i></i></div>`).join('')}</div>
    </section>`;
  }).join('');
  const twist = Object.entries(MODS).map(([id, m]) => S.unlocked.mods.includes(id)
    ? `<li><b>${m.name}</b><span>${m.how}</span></li>` : '<li class="locked"><b>Locked twist</b><span>Drops from a reward card.</span></li>').join('');
  const styles = Object.entries(STYLES).map(([id, st]) => S.unlocked.styles.includes(id)
    ? `<li><b>${st.name}</b><span>${st.how}</span></li>` : '<li class="locked"><b>Locked hand style</b><span>Opens with a new season.</span></li>').join('');
  const combos = Object.entries(COMBOS).filter(([id]) => S.unlocked.combos.includes(id))
    .map(([, c]) => `<li><b>${c.name}</b><span>${c.how} Worth ${c.bonus} extra damage.</span></li>`).join('') +
    (Object.keys(COMBOS).length > S.unlocked.combos.length
      ? `<li class="locked"><b>${Object.keys(COMBOS).length - S.unlocked.combos.length} still to find</b><span>They drop from reward cards, and land by themselves once you own them.</span></li>` : '');
  return `
    <header class="top">
      <span class="brand">Your deck</span>
      <span class="chip plain">${S.unlocked.exercises.filter(id => possible.some(e => e.id === id)).length} of ${possible.length} cards</span>
    </header>
    ${suits}
    <section class="panel dark"><h3>Combos</h3><ul class="rules">${combos}</ul></section>
    <section class="panel dark"><h3>Twists</h3><ul class="rules">${twist}</ul></section>
    <section class="panel dark"><h3>Hand styles</h3><ul class="rules">${styles}</ul></section>`;
}

function settingsScreen() {
  const s = S.settings;
  const stepper = (key, label, hint, inc) => `
    <div class="field">
      <div><b>${label}</b><small>${hint}</small></div>
      <div class="stepper">
        <button data-act="set-step" data-key="${key}" data-d="${-inc}" aria-label="Less">−</button>
        <output>${kg(s[key])} kg</output>
        <button data-act="set-step" data-key="${key}" data-d="${inc}" aria-label="More">+</button>
      </div>
    </div>`;
  const choice = (key, label, options) => `
    <div class="field col">
      <div><b>${label}</b></div>
      <div class="seg">${options.map(([v, text]) =>
        `<button data-act="set" data-key="${key}" data-val="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${text}</button>`).join('')}</div>
    </div>`;
  const looks = S.unlocked.themes.map(id =>
    `<button data-act="set" data-key="theme" data-val="${id}" class="swatch ${s.theme === id ? 'on' : ''}" style="--c:${THEMES[id].table};--g:${THEMES[id].gold}">${THEMES[id].name}</button>`).join('');
  return `
    <header class="top">
      <button class="icon" data-act="tab" data-to="progress" aria-label="Back">${ICON.back}</button>
      <span class="brand">Settings</span><span></span>
    </header>
    ${ui.notice ? `<p class="banner">${ui.notice}</p>` : ''}
    ${!sync.cloud ? '' : `<section class="panel">
      <div class="field col"><div><b>Account</b><small>${sync.user
        ? `Signed in as ${sync.user.name}. ${syncText()}`
        : 'Sign in to keep one save across your phone and your computer.'}</small></div>
        <div class="seg">${sync.user
          ? '<button data-act="sync-now">Sync now</button><button data-act="sign-out">Sign out</button>'
          : '<button data-act="sign-in">Sign in with Google</button>'}</div>
      </div>
      ${sync.user ? `<div class="field col"><div><b>Big screen</b><small>${s.bigScreen
        ? `The PC game follows your fight with this code: <code class="code">${S.feedCode}</code>`
        : 'Lets the Iron Deck Arena game on your PC play each blow as you log it.'}</small></div>
        <div class="seg">${[[true, 'On'], [false, 'Off']].map(([v, text]) => `<button data-act="set" data-key="bigScreen" data-val="${v}" class="${!!s.bigScreen === v ? 'on' : ''}">${text}</button>`).join('')}</div>
      </div>` : ''}
    </section>`}
    <section class="panel">
      <div class="field col"><div><b>Look</b><small>New looks arrive with seasons and reward cards</small></div><div class="swatches">${looks}</div></div>
      ${choice('arena', 'Arena fights', [[true, 'On'], [false, 'Off']])}
      ${choice('sound', 'Sounds', [[true, 'On'], [false, 'Off']])}
      ${choice('buzz', 'Vibration', [[true, 'On'], [false, 'Off']])}
    </section>
    <section class="panel">
      ${stepper('max', 'Heaviest dumbbell', 'The most you can load on one', 2.5)}
      ${choice('step', 'Smallest weight jump', [[1, '1 kg'], [2, '2 kg'], [2.5, '2.5 kg'], [5, '5 kg']])}
      ${choice('incline', 'Bench back tilts up', [[true, 'Yes'], [false, 'No, flat only']])}
      ${choice('quickChange', 'Changing the weight is', [[false, 'Slow, screw collars'], [true, 'Quick, dial or pin']])}
    </section>
    <section class="panel">
      <div class="field col"><div><b>Backup</b><small>${sync.user ? 'Your progress is kept in your account. A file is a second copy you hold yourself.' : 'Your history lives only on this device. Save a file now and then.'}</small></div>
        <div class="seg"><button data-act="export">Save a backup file</button><label class="filebtn">Restore from a file<input type="file" accept="application/json,.json" id="import"></label></div>
      </div>
      <div class="field col"><div><b>Start over</b><small>${sync.user ? 'Erases every hand, record and card, here and on every device signed in to your account.' : 'Erases every hand, record and card on this device.'}</small></div>
        <div class="seg"><button class="danger" data-act="reset">${ui.confirmReset ? 'Tap again to erase everything' : 'Erase everything'}</button></div>
      </div>
    </section>`;
}

function navBar() {
  const tab = (to, label, glyph) => `<button data-act="tab" data-to="${to}" class="${ui.screen === to ? 'on' : ''}">${glyph}<span>${label}</span></button>`;
  return `<nav class="tabs">
    ${tab('home', 'Table', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="3" width="11" height="15" rx="2" transform="rotate(-10 10 10)" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="6" width="11" height="15" rx="2" fill="currentColor"/></svg>')}
    ${tab('hero', 'Hero', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 11C5 5 19 5 19 11v8l-7 3-7-3Z" fill="currentColor"/><rect x="7.5" y="11" width="9" height="2.6" rx="1" fill="var(--deep)"/></svg>')}
    ${tab('deck', 'Deck', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 4h7v7H3Zm11 0h7v7h-7ZM3 13h7v7H3Zm11 0h7v7h-7Z" fill="currentColor"/></svg>')}
    ${tab('progress', 'Progress', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20V11h4v9Zm6 0V4h4v16Zm6 0v-6h4v6Z" fill="currentColor"/></svg>')}
  </nav>`;
}

// A small line chart of estimated strength per session.
function spark(lift) {
  const pts = (lift?.log ?? []).map(p => (p.w > 0 ? p.w * (1 + p.r / 30) : p.r));
  if (pts.length < 2) return '';
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = pts.map((v, i) => [6 + i * (288 / (pts.length - 1)), 46 - (v - lo) / span * 38]);
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="spark" viewBox="0 0 300 54" role="img" aria-label="Your strength on this card, session by session">
    <polyline points="${xy.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5" fill="currentColor"/></svg>`;
}

function sheetView() {
  if (ui.sheet === 'menu') {
    const st = stepNow();
    const can = st && st.card.sets.length === 0;
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-label="Options">
      ${hand().undo && hand().i > 0 ? '<button data-act="undo">Undo the last set</button>' : ''}
      ${can ? '<button data-act="swap">Swap this card for another</button>' : ''}
      <button data-act="skip">Skip this card</button>
      <button data-act="finish-early">Finish the hand here and collect</button>
      <button data-act="pause">Pause and go back to the table</button>
      <button class="quiet" data-act="close-sheet">Keep going</button>
    </div>`;
  }
  if (ui.sheet === 'sync' && sync.ask && S) {
    const day = (at) => (at ? `last played ${new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : 'no hand finished yet');
    const facts = (f) => `Level ${f.level}, ${f.hands} ${f.hands === 1 ? 'hand' : 'hands'} played, ${day(f.at)}`;
    return `<div class="scrim"></div><div class="sheet info" role="dialog" aria-label="Choose which progress to keep">
      <h2>Which progress do you keep?</h2>
      <p>This device and your account hold different progress, and they cannot be combined. The one you do not pick is replaced.</p>
      <button class="pick" data-act="sync-keep" data-which="cloud"><b>The one in your account</b><span>${facts(sync.ask)}</span></button>
      <button class="pick" data-act="sync-keep" data-which="local"><b>The one on this device</b><span>${facts(describe(S, E.levelFor))}</span></button>
      <button class="quiet" data-act="sign-out">Decide later and sign out</button>
    </div>`;
  }
  if (ui.sheet === 'fight') {
    const b = S.battle ?? { fury: 0, edge: 0 }, weapon = E.equipped(S, 'weapon');
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet info" role="dialog" aria-label="How the fight works">
      <p class="corner"><span>Arena fights</span></p>
      <h2>How the fight works</h2>
      <ul class="rules ink">
        <li><b>Fury: ${b.fury} of 100</b><span>Every set builds it. Hitting your target reps, records, combos and a rarer weapon build it faster. When it is full, your next set is <b>${ULTIMATES[weapon?.line ?? 'none']}</b>, which hits two and a half times as hard.</span></li>
        <li><b>The boss strikes back</b><span>After each set it swings at you. Your chance to block is <b>${Math.round(E.guard(S) * 100)}%</b> right now, and it comes from your armour: more pieces and rarer ones block more. Later bosses are harder to stop.</span></li>
        <li><b>Block and you riposte</b><span>Your next hit lands 15% harder. Take the hit and you are staggered: the next one lands 15% softer and you lose a little fury.</span></li>
        <li><b>Below half health it is enraged</b><span>It gets harder to block, but leaves itself open: every blow lands 10% harder.</span></li>
        <li><b>You cannot lose</b><span>A fight only ends sooner or later. Skip any scene with a tap, or switch arena fights off in Settings.</span></li>
      </ul>
      <button class="quiet" data-act="close-sheet">Close</button>
    </div>`;
  }
  if (ui.sheet?.item) return itemSheet(ui.sheet.item);
  if (ui.sheet === 'foe') {
    const info = E.foeInfo(S.foe.k);
    const pct = Math.max(0, Math.round(S.foe.hp / S.foe.max * 100));
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet info" role="dialog" aria-label="${info.name}">
      <div class="foe-art ${info.big ? 'big' : ''}">${bossSvg(S.foe.k, 150)}</div>
      <p class="corner">${suitIcon(info.weak, 18)}<span>${info.big ? 'Season boss' : 'Boss'}, weak to ${suitName(info.weak).toLowerCase()} sets and to ${WEAPONS[info.bane].many}</span></p>
      <h2>${info.name}</h2>
      <p class="taunt">“${info.taunt}”</p>
      <div class="hp tall"><i style="width:${pct}%"></i></div>
      <p class="muted"><b>${num(Math.max(0, S.foe.hp))}</b> of ${num(S.foe.max)} health left. It never heals, however long you are away.</p>
      <ul class="rules ink">
        <li><b>It fears ${WEAPONS[info.bane].many}</b><span>Fight it with one in hand and every hit lands a quarter harder. ${(() => {
          if (E.equipped(S, 'weapon')?.line === info.bane) return 'You are holding one.';
          const best = [5, 4, 3, 2, 1, 0].map(r => ITEMS[`${info.bane}-${r}`]).find(it => S.items[it.id]);
          return best ? `</span><button class="swap" data-act="equip" data-id="${best.id}">Equip your ${best.name}</button><span>` : 'You do not own one yet.';
        })()}</span></li>
        <li><b>Every set you log is a hit</b><span>Higher suit levels and gear hit harder. ${suitName(info.weak)} sets hit this one half again as hard.</span></li>
        <li><b>A record is a critical hit</b><span>Double damage. The finisher at the end of a hand hits double too.</span></li>
        <li><b>Every set fells a gremlin</b><span>They drop iron for the forge, and now and then an item.</span></li>
        <li><b>Combos land by themselves</b><span>Play the pattern and the bonus is added. Your combos are listed in your deck.</span></li>
        ${info.big ? '<li><b>Legendary at stake, and more</b><span>Land the final blow on a season boss as a record and it drops a legendary. Do it holding the weapon it fears and the drop is a mythic, which never comes any other way.</span></li>' : ''}
      </ul>
      <button class="quiet" data-act="close-sheet">Close</button>
    </div>`;
  }
  if (ui.sheet?.card) {
    const ex = EX[ui.sheet.card];
    const l = S.lifts[ex.id];
    // every form the card has been played in: plain, and with each twist
    const plays = Object.entries(S.lifts).reduce((n, [key, lift]) => n + (key === ex.id || key.startsWith(`${ex.id}:`) ? lift.sessions ?? 0 : 0), 0);
    const best = l?.bests?.length
      ? (isDb(ex) ? l.bests.map(b => `${kg(b.w)} kg × ${b.r}`).join(', ') : `${Math.max(...l.bests.map(b => b.r))} ${ex.kind === 'time' ? 'sec' : 'reps'}`)
      : null;
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet info cardsheet" role="dialog" aria-label="${ex.name}">
      <p class="corner">${suitIcon(ex.suit, 18)}<span>${suitName(ex.suit)} card</span></p>
      ${art(ex.id, 260, true)}
      <h2>${ex.name}</h2>
      <p>${ex.cue} ${videoLink(ex)}</p>
      ${spark(l)}
      <p class="muted">${plays ? `Played ${plays} ${plays === 1 ? 'time' : 'times'}${best ? `. Best: ${best}` : ''}.` : 'Not played yet. It is first in line for the next hand of this suit.'}</p>
      <button class="quiet" data-act="close-sheet">Close</button>
    </div>`;
  }
  return '';
}

const IRON = '<svg class="ingot" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 8h12l4 10H2Z" fill="#B5B8C8"/><path d="M6 8h6v10H2Z" fill="#fff" opacity=".35"/></svg>';
const SLOTS_LEFT = ['weapon', 'hands', 'arms', 'belt'], SLOTS_RIGHT = ['helm', 'chest', 'cloak', 'boots'];

function heroScreen() {
  const total = Object.keys(ITEMS).length, owned = Object.keys(S.items).filter(id => ITEMS[id]).length;
  const slot = (key) => {
    const it = E.equipped(S, key);
    return `<button class="slot ${it ? `r${it.rarity}` : 'empty'}" data-act="${it ? 'item-info' : 'slot-empty'}" data-id="${it?.id ?? ''}" data-slot="${key}"${it ? ` style="--rc:${RARITY_COLOR[it.rarity]}"` : ''}>
      ${it ? itemIcon(it.id, 46) : ''}<small>${SLOT_NAME[key]}</small></button>`;
  };
  const rung = (id) => {
    const it = ITEMS[id], have = !!S.items[id];
    const forgeable = !have && it.rarity > 0 && S.items[`${it.line}-${it.rarity - 1}`] && S.iron >= FORGE_COST[it.rarity];
    return `<button class="rung r${it.rarity} ${have ? 'have' : 'lack'} ${S.equip[it.slot] === id ? 'worn' : ''} ${forgeable ? 'forgeable' : ''}" data-act="item-info" data-id="${id}"
      style="--rc:${RARITY_COLOR[it.rarity]}" aria-label="${it.name}${have ? '' : ', not found yet'}">${itemIcon(id, 44)}</button>`;
  };
  const line = (key, label) => `<div class="line"><span>${label}</span><div class="rungs">${RARITY.map((_, r) => rung(`${key}-${r}`)).join('')}</div></div>`;
  // What iron can make next: the step above the best item you own in each line, cheapest first.
  const forgeNext = [...Object.keys(WEAPONS), ...Object.keys(ARMOR)].map((k) => {
    const top = [5, 4, 3, 2, 1, 0].find(r => S.items[`${k}-${r}`]);
    return top == null || top === 5 ? null : ITEMS[`${k}-${top + 1}`];
  }).filter(Boolean).sort((a, b) => FORGE_COST[a.rarity] - FORGE_COST[b.rarity]);
  const forgeRow = (it) => {
    const cost = FORGE_COST[it.rarity], ready = S.iron >= cost;
    return `<div class="forgerow" style="--rc:${RARITY_COLOR[it.rarity]}">
      <button class="rung r${it.rarity}" data-act="item-info" data-id="${it.id}" aria-label="${it.name}">${itemIcon(it.id, 44)}</button>
      <div class="forge-main"><b>${it.name}</b><small>${RARITY[it.rarity]}, made from your ${ITEMS[`${it.line}-${it.rarity - 1}`].name}</small>
        ${ready ? '' : `<span class="hp"><i style="width:${Math.round(S.iron / cost * 100)}%"></i></span>`}</div>
      ${ready ? `<button class="forge-go" data-act="forge" data-id="${it.id}">Forge<small>${IRON}${cost}</small></button>` : `<span class="forge-need">${num(cost - S.iron)} iron<br>to go</span>`}
    </div>`;
  };
  const forge = `<section class="panel dark forge">
      <h3>Forge <small>${IRON} ${num(S.iron)} iron</small></h3>
      <p class="empty">Every set you log earns iron. Iron turns an item you own into the next rarity of the same item, and you keep the old one.</p>
      ${forgeNext.length ? forgeNext.slice(0, 3).map(forgeRow).join('') : '<p class="empty">Nothing to forge yet. Your first item comes with your first finished hand.</p>'}
      ${forgeNext.length > 3 ? `<p class="empty">${forgeNext.length - 3} more can be forged later. Tap any greyed-out item below to see its price.</p>` : ''}
    </section>`;
  return `
    <header class="top">
      <span class="brand">Your hero</span>
      <span class="chip">${IRON} ${num(S.iron)} iron</span>
    </header>
    <section class="stage">
      <div class="slotcol">${SLOTS_LEFT.map(slot).join('')}</div>
      <div class="pedestal">${heroSvg(S.equip, { size: 168 })}</div>
      <div class="slotcol">${SLOTS_RIGHT.map(slot).join('')}</div>
    </section>
    <div class="gearcol">
    ${forge}
    <section class="panel dark armory">
      <h3>Armoury <small>${owned} of ${total}</small></h3>
      <p class="empty">Tap any item to see it. Gear drops from reward cards, bosses and gremlins, and the forge above makes the next step up of anything you own. The last column, mythic, never drops by luck.</p>
      <div class="rarities">${RARITY.map((n, i) => `<span style="--rc:${RARITY_COLOR[i]}">${n}</span>`).join('')}</div>
      ${Object.entries(WEAPONS).map(([k, w]) => line(k, w.name)).join('')}
      <hr>
      ${Object.entries(ARMOR).map(([k, ar]) => line(k, ar.name)).join('')}
    </section>
    </div>`;
}

function itemSheet(id) {
  const it = ITEMS[id], have = !!S.items[id], worn = S.equip[it.slot] === id;
  const below = it.rarity > 0 ? ITEMS[`${it.line}-${it.rarity - 1}`] : null;
  const cost = FORGE_COST[it.rarity];
  let action;
  if (have) action = worn ? '<p class="muted">You have this equipped.</p>' : `<button class="btn dark" data-act="equip" data-id="${id}">Equip</button>`;
  else if (below && S.items[below.id]) {
    action = S.iron >= cost
      ? `<button class="btn dark" data-act="forge" data-id="${id}">Forge for ${cost} iron</button><p class="muted">Made from your ${below.name}, which you keep. You have ${num(S.iron)} iron.</p>`
      : `<p class="muted">Forge it from your ${below.name} for ${cost} iron. You have ${num(S.iron)}: ${num(cost - S.iron)} to go, at a few iron per set.</p>`;
  } else {
    action = `<p class="muted">${it.rarity === 5
      ? 'Not found yet. A mythic never drops by luck. Finish a season boss with a record while holding the weapon it fears, or forge it once you own the legendary.'
      : it.rarity === 4
      ? 'Not found yet. Finish a season boss with a record and its drop is a legendary. Or work up to it at the forge.'
      : `Not found yet. It drops from reward cards, bosses and gremlins${below ? `, or forge it once you own the ${below.name}` : ''}.`}</p>`;
  }
  return `<div class="scrim" data-act="close-sheet"></div><div class="sheet info itemsheet" role="dialog" aria-label="${it.name}" style="--rc:${RARITY_COLOR[it.rarity]}">
    <div class="item-art ${have ? `r${it.rarity}` : 'lack'}">${itemIcon(id, 132)}</div>
    <p class="rar">${RARITY[it.rarity]} ${SLOT_NAME[it.slot].toLowerCase()}</p>
    <h2>${it.name}</h2>
    <p>${perkText(it)}</p>
    ${action}
    <button class="quiet" data-act="close-sheet">Close</button>
  </div>`;
}

// The moment an item is yours. ids are opened one after another; done runs when the last is dismissed.
const $rv = document.createElement('div');
$rv.id = 'reveal';
document.body.append($rv);
const rv = { queue: [], id: null, phase: null, timer: null, shownAt: 0, done: null };

function reveal(ids, done) {
  rv.queue.push(...ids);
  if (done) rv.done = done;
  if (!rv.phase) nextReveal();
}
function nextReveal() {
  clearTimeout(rv.timer);
  const id = rv.queue.shift();
  if (!id) {
    rv.phase = null; $rv.className = ''; $rv.innerHTML = '';
    const done = rv.done; rv.done = null; done?.();
    return;
  }
  const it = ITEMS[id], worn = S.equip[it.slot] === id;
  rv.id = id; rv.phase = 'charge';
  $rv.className = `on r${it.rarity} charge`;
  $rv.style.setProperty('--rc', RARITY_COLOR[it.rarity]);
  $rv.dataset.act = 'reveal-tap';
  $rv.innerHTML = `<div class="rv-rays"></div><div class="rv-glow"></div><div class="rv-flash"></div>
    <div class="rv-card"><span class="lootback"><i><span>?</span></i></span></div>
    <div class="rv-prize">${itemIcon(id, 210)}</div>
    <div class="rv-sparks"></div>
    <div class="rv-text">
      <span class="rar">${RARITY[it.rarity]} ${SLOT_NAME[it.slot].toLowerCase()}</span>
      <h2>${it.name}</h2>
      <p>${perkText(it)}</p>
      ${E.foeInfo(S.foe.k).bane === it.line ? `<p class="rv-note">${E.foeInfo(S.foe.k).name} fears ${WEAPONS[it.line].many}.</p>` : ''}
      ${worn ? '<p class="rv-note">Equipped</p>' : '<button class="btn" data-act="reveal-equip">Equip it</button>'}
      <small>Tap to continue</small>
    </div>`;
  sfx('charge'); buzz(it.rarity >= 3 ? [30, 60, 30, 60, 30, 60, 30, 60, 30] : [30, 80, 30]);
  rv.timer = setTimeout(burstReveal, [750, 850, 1000, 1350, 1900, 2600][it.rarity]);
}
function burstReveal() {
  if (rv.phase !== 'charge') return;
  clearTimeout(rv.timer);
  rv.phase = 'shown'; rv.shownAt = now();
  const r = ITEMS[rv.id].rarity;
  $rv.classList.remove('charge'); $rv.classList.add('burst');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const sparks = $rv.querySelector('.rv-sparks');
    let html = '';
    for (let i = 0; i < 16 + r * 12; i++) {
      const ang = Math.random() * Math.PI * 2, d = 110 + Math.random() * (150 + r * 40), s = 4 + Math.random() * (4 + r);
      html += `<i style="--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d}px;--rot:${Math.random() * 720 - 360}deg;width:${s}px;height:${s}px;animation-delay:${Math.random() * 120}ms;${i % 3 === 0 ? 'background:#fff' : ''}"></i>`;
    }
    sparks.innerHTML = html;
    if (r >= 3) { document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 650); }
  }
  sfx(`loot${r}`); buzz([[40], [40, 40, 60], [40, 40, 40, 40, 100], [60, 40, 60, 40, 60, 40, 200], [100, 50, 100, 50, 100, 50, 100, 50, 400], [120, 40, 120, 40, 120, 40, 120, 40, 120, 40, 600]][r]);
}

// ---------- render loop ----------

const SCREENS = {
  setup: setupScreen, home: homeScreen, deal: dealScreen, play: playScreen, rest: restScreen,
  finish: finishScreen, progress: progressScreen, deck: deckScreen, settings: settingsScreen, hero: heroScreen,
};
const WITH_TABS = ['home', 'hero', 'deck', 'progress'];

function render() {
  applyTheme();
  $app.className = `s-${ui.screen}${ui.enter ? ' enter' : ''}`;
  $app.innerHTML = SCREENS[ui.screen]() + (WITH_TABS.includes(ui.screen) ? navBar() : '') + sheetView();
  requestAnimationFrame(() => $app.querySelectorAll('i[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; }));
  if (ui.screen === 'finish' && ui.enter) countUp();
  ui.enter = false;
}
function go(screen) {
  clearInterval(ticker); ticker = null;
  ui.screen = screen; ui.enter = true; ui.sheet = null; ui.confirmReset = false; ui.notice = null;
  render();
  window.scrollTo(0, 0);
  if (screen === 'rest') startRestTicker();
  if (sync.waiting && !syncBusy()) queueSync(0);
  // Keep one history entry while away from the table, so the phone's back button has somewhere to go.
  const deep = screen !== 'home' && screen !== 'setup';
  try {
    if (deep && !history.state?.deep) history.pushState({ deep: true }, '');
    else if (!deep && history.state?.deep) { skipPop = true; history.back(); }
  } catch { /* history unavailable */ }
}

let skipPop = false;
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  const stay = () => { try { history.pushState({ deep: true }, ''); } catch { /* ignore */ } };
  if (ui.sheet) { ui.sheet = null; render(); stay(); return; }
  if (ui.screen === 'play' || ui.screen === 'rest') { ui.sheet = 'menu'; render(); stay(); return; }
  if (ui.screen === 'settings') { stay(); go('progress'); return; }
  if (ui.screen !== 'home' && ui.screen !== 'setup') go('home');
});

function countUp() {
  const el = document.getElementById('xp-num');
  if (!el) return;
  const to = +el.dataset.to, t0 = performance.now(), dur = 900;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = `+${num(to)}`; return; }
  const frame = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = `+${num(to * (1 - Math.pow(1 - p, 3)))}`;
    if (p < 1 && el.isConnected) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function startRestTicker() {
  let lastWhole = null;
  const tick = () => {
    const left = (ui.restEnd - now()) / 1000;
    const whole = Math.ceil(left);
    if (lastWhole != null && whole !== lastWhole && whole >= 1 && whole <= 3) sfx('tick');
    lastWhole = whole;
    const n = document.getElementById('rest-num'), ring = document.getElementById('rest-ring');
    if (n) n.textContent = Math.max(0, Math.ceil(left));
    if (ring) ring.style.strokeDashoffset = 100 - Math.max(0, Math.min(100, left / ui.restTotal * 100));
    if (left <= 0) endRest(true);
  };
  tick();
  ticker = setInterval(tick, 200);
}
function startRest(step) {
  ui.restEnd = now() + step.rest * 1000;
  ui.restTotal = step.rest;
  ui.restChange = step.change;
  initStepUi();
  go('rest');
  // A gremlin dropped something during the last sets: open it now, while there is nothing else to do.
  revealDrops();
}
function endRest(chime) {
  if (ui.screen !== 'rest') return;
  if (chime) { sfx('rest'); buzz([120, 80, 120]); }
  go('play');
}

function finishNow() {
  const h = S.current ?? ui.hand;
  const summary = E.finishHand(S, h, rng, now());
  S.reshuffles = 0;
  save();
  keepAwake(false);
  if (!summary.sets) return go('home');
  ui.summary = summary;
  ui.opened = new Set();
  // The hand's fanfare waits for the last blow to land.
  const wait = Math.max(0, (ui.fxUntil ?? 0) - now());
  sfx('win', { delay: wait / 1000 });
  setTimeout(() => buzz([60, 40, 60, 40, 160]), wait);
  go('finish');
  revealDrops();
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- actions ----------

const actions = {
  'setup-step'({ field, d }) {
    const s = ui.setup, inc = field === 'max' ? 2.5 : s.step;
    s[field] = Math.max(inc, Math.min(80, s[field] + inc * +d));
    render();
  },
  'setup-set'({ field, val }) {
    ui.setup[field] = field === 'step' ? +val : val === 'true';
    render();
  },
  'setup-go'() {
    const s = ui.setup;
    S = E.newState({ ...s, max: Math.max(s.max, s.bench, s.curl), arena: true }, now());
    save();
    navigator.storage?.persist?.().catch(() => {});
    go('home');
  },
  tab({ to }) { go(to); },
  'go-home'() { go('home'); },
  deal({ mode }) {
    ui.hand = mode === 'quick' ? E.dealHand(S, 'quick', rng, now()) : ensurePending();
    sfx('deal');
    go('deal');
  },
  reshuffle() {
    if ((S.reshuffles ?? 0) >= RESHUFFLES) return;
    S.reshuffles = (S.reshuffles ?? 0) + 1;
    const seen = E.handCards(ui.hand).map(c => c.ex);
    ui.hand = E.dealHand(S, ui.hand.mode, rng, now(), seen);
    if (ui.hand.mode === 'full') S.pending = ui.hand;
    save();
    sfx('deal'); ui.enter = true; render();
  },
  start() {
    S.current = ui.hand; S.pending = null; save();
    keepAwake(true); initStepUi(); sfx('start');
    go('play');
  },
  continue() { keepAwake(true); initStepUi(); go('play'); },
  pause() { keepAwake(false); go('home'); },
  reps({ d }) {
    const timed = EX[stepNow().card.ex].kind === 'time';
    ui.reps = Math.max(0, ui.reps + +d * (timed ? 5 : 1));
    ui.bump = true;
    render();
    ui.bump = false;
  },
  'toggle-adjust'() { ui.adjust = !ui.adjust; render(); },
  'toggle-cue'() { ui.cue = !ui.cue; render(); },
  w({ d }) {
    const st = stepNow();
    E.setCardWeight(S, hand(), st.card.w + S.settings.step * +d);
    save(); render();
  },
  'hold-start'() {
    ui.hold = { t0: now() };
    render();
    clearInterval(ticker);
    ticker = setInterval(() => {
      const el = document.getElementById('hold-num');
      if (el && ui.hold) el.textContent = Math.floor((now() - ui.hold.t0) / 1000);
    }, 200);
  },
  'hold-stop'() {
    clearInterval(ticker); ticker = null;
    ui.reps = Math.max(1, Math.round((now() - ui.hold.t0) / 1000));
    ui.hold = null;
    render();
  },
  done() {
    const st = stepNow();
    if (!st) return;
    const was = { k: S.foe.k, hp: S.foe.hp, max: S.foe.max };
    const res = E.logSet(S, hand(), ui.reps, now(), rng);
    if (res.drop) ui.dropQueue.push(res.drop.id);
    save();
    sendFeed({ res, was });
    const next = () => {
      if (hand()?.done) return finishNow();
      if (st.rest > 0) return startRest(st);
      initStepUi(); go('play');
    };
    if (res.foeDown) {
      // The one moment worth stopping for: the table waits while the boss falls.
      const prize = res.foeDown.mythic ? 'The perfect kill: mythic drop' : res.foeDown.legend ? 'Finished with a record: legendary drop' : res.record ? 'Finished with a record' : 'Boss beaten';
      const hold = duel(res, was, 'down', prize);
      if (!hold) strike(res, was, 'down', prize);
      $app.classList.add('locked');
      setTimeout(next, hold ? hold - 200 : 2000);
    } else {
      // Every other blow plays over the rest that follows, so the fight never costs you time.
      if (!res.dmg) { sfx('tick'); buzz(30); }
      if (!duel(res, was, res.record ? 'crit' : 'hit')) strike(res, was, res.record ? 'crit' : 'hit');
      next();
    }
  },
  menu() { ui.sheet = 'menu'; render(); },
  'close-sheet'() { ui.sheet = null; render(); },
  swap() {
    const swapped = E.swapCard(S, hand(), rng);
    save(); ui.sheet = null; initStepUi();
    if (swapped) sfx('flip'); else toast('No other card fits here right now.');
    if (ui.screen === 'rest') render(); else go('play');
  },
  undo() {
    E.undoSet(S, hand());
    save(); initStepUi();
    go('play');
  },
  skip() {
    E.skipCard(hand());
    save(); ui.sheet = null;
    if (hand().done) return finishNow();
    initStepUi();
    if (ui.screen === 'rest') render(); else go('play');
  },
  'finish-early'() { finishNow(); },
  'rest-add'() { ui.restEnd += 15000; ui.restTotal += 15; },
  'rest-skip'() { endRest(false); },
  flip({ item, i }, el) {
    if (el.classList.contains('flipped')) return item ? actions['item-info']({ id: item }) : undefined;
    el.classList.add('flipped');
    ui.opened.add(+i);
    if (item) return reveal([item], render);
    sfx('flip'); buzz(40);
  },
  wear({ theme }) { S.settings.theme = theme; save(); applyTheme(); render(); },
  'card-info'({ id }) { ui.sheet = { card: id }; render(); },
  'foe-info'() { ui.sheet = 'foe'; render(); },
  'fight-info'() { ui.sheet = 'fight'; render(); },
  'item-info'({ id }) { ui.sheet = { item: id }; render(); },
  'slot-empty'({ slot }) { toast(`No ${SLOT_NAME[slot].toLowerCase()} yet. Play a hand: bosses and reward cards drop gear.`); },
  equip({ id }) { E.equip(S, id); save(); sfx(ITEMS[id].slot === 'weapon' ? 'equip-weapon' : 'equip-armor'); buzz(30); ui.sheet = null; render(); },
  forge({ id }) {
    if (!E.forge(S, id)) return;
    save(); ui.sheet = null; render();
    sfx('forge'); buzz([40, 120, 40]);
    reveal([id], render);
  },
  'reveal-tap'() {
    if (rv.phase === 'charge') burstReveal();
    else if (now() - rv.shownAt > 450) nextReveal();
  },
  'reveal-equip'() { E.equip(S, rv.id); save(); sfx(ITEMS[rv.id].slot === 'weapon' ? 'equip-weapon' : 'equip-armor'); nextReveal(); },
  set({ key, val }) {
    S.settings[key] = key === 'theme' ? val : key === 'step' ? +val : val === 'true';
    if (key === 'step') S.settings.min = Math.min(S.settings.min, +val);
    S.pending = null;
    save(); render();
    if (key === 'sound' && val === 'true') sfx('place');
    if (key === 'bigScreen' && val === 'true') {
      // The code is made once and travels with the save, so every device feeds the same screen.
      S.feedCode ??= [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
      save(); render(); sendFeed();
    }
    // Fury and stagger belong to the arena: leaving it clears them, so nothing lingers unseen.
    if (key === 'arena' && val !== 'true') delete S.battle, save();
  },
  'set-step'({ key, d }) {
    S.settings[key] = Math.max(S.settings.step, Math.min(80, S.settings[key] + +d));
    S.pending = null;
    save(); render();
  },
  export() {
    download(`iron-deck-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S));
  },
  reset() {
    if (!ui.confirmReset) { ui.confirmReset = true; return render(); }
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    S = null;
    // Signed in, starting over means everywhere: the account is emptied too, and other devices follow.
    if (sync.user) pushSave(sync.user.uid).catch(() => { sync.status = 'error'; });
    go('setup');
  },
  async 'sign-in'() {
    sync.status = 'busy';
    try { await sync.cloud.signIn(); } catch { sync.status = 'off'; toast('Sign-in did not finish. Nothing was changed.'); }
  },
  async 'sign-out'() {
    clearTimeout(sync.timer);
    sync.ask = null; ui.sheet = null;
    try { await sync.cloud.signOut(); } catch { /* already signed out */ }
    render();
  },
  'sync-now'() { sync.status = 'busy'; render(); runSync(); },
  async 'sync-keep'({ which }) {
    const cloud = sync.ask, uid = sync.user?.uid;
    sync.ask = null; ui.sheet = null;
    if (!cloud || !uid) return render();
    try {
      if (which === 'cloud') await pullSave(uid, cloud); else { await pushSave(uid); render(); toast('This device is now your account save.'); }
      sync.status = 'ok';
    } catch (e) {
      sync.status = 'error'; sync.problem = e?.code ?? e?.message ?? '';
      render(); toast('That did not go through. Nothing was replaced.');
    }
  },
  async install() {
    const evt = ui.install;
    ui.install = null;
    await evt?.prompt();
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || $app.classList.contains('locked')) return;
  actions[el.dataset.act]?.(el.dataset, el);
});

document.addEventListener('change', async (e) => {
  if (e.target.id !== 'import') return;
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.v !== 1 || !data.settings || !data.lifts) throw new Error('not a backup');
    S = E.migrate(data); S.settings.arena ??= true; save();
    ui.notice = 'Backup restored.';
  } catch {
    ui.notice = 'That file is not an Iron Deck backup. Nothing was changed.';
  }
  render();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.install = e;
  if (ui.screen === 'home') render();
});
window.addEventListener('appinstalled', () => { ui.install = null; if (ui.screen === 'home') render(); });

if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
  navigator.serviceWorker?.register('sw.js').catch(() => { /* offline support is optional */ });
}

if (S) navigator.storage?.persist?.().catch(() => {});
render();

// The online save connects after the table is up, so a slow or missing network never delays a hand.
connect(FIREBASE).then((cloud) => {
  if (!cloud) return;
  sync.cloud = cloud;
  cloud.onUser((user) => {
    sync.user = user;
    sync.status = user ? 'busy' : 'off';
    if (ui.screen === 'settings' || ui.screen === 'setup') render();
    if (user) runSync();
  });
  if (ui.screen === 'settings' || ui.screen === 'setup') render();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') queueSync(0); });
  window.addEventListener('online', () => queueSync(0));
}).catch(() => { /* no online save this time: the device copy carries on */ });
