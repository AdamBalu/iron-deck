// Screens and interaction. All workout rules live in engine.js.
import { SUITS, SUIT_ORDER, EX, EXERCISES, MODS, STYLES, THEMES } from './data.js';
import * as E from './engine.js';

const KEY = 'irondeck.v1';
const $app = document.getElementById('app');
const $fx = document.getElementById('fx');
const rng = Math.random;
const now = () => Date.now();
const HOUR = 3600000, DAY = 86400000;

function load() {
  try { const raw = localStorage.getItem(KEY); const s = raw ? JSON.parse(raw) : null; return s && s.v === 1 ? s : null; }
  catch { return null; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked: keep playing */ } }

let S = load();
const ui = {
  screen: S ? 'home' : 'setup', enter: true, sheet: null,
  setup: { bench: 20, curl: 12.5, step: 2.5, max: 30, incline: true, quickChange: false },
  hand: null, reps: 0, adjust: false, cue: false, hold: null,
  restEnd: 0, restTotal: 0, restChange: null, summary: null, confirmReset: false, install: null, notice: null,
};
let ticker = null;

// ---------- small helpers ----------

const kg = (w) => String(Math.round(w * 100) / 100);
const num = (n) => Math.round(n).toLocaleString('en-US');
const isDb = (ex) => ex.kind === 'db1' || ex.kind === 'db2';
const hand = () => S.current;
const stepNow = () => E.currentStep(S.current, S.settings.quickChange);

const SHAPES = {
  chest: '<path d="M12 1.5 22.5 12 12 22.5 1.5 12Z"/>',
  biceps: '<circle cx="12" cy="12" r="10"/>',
  back: '<path d="M12 2.5 22.5 21h-21Z"/>',
  triceps: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  abs: '<path d="M12 1.5 21 6.8v10.4l-9 5.3-9-5.3V6.8Z"/>',
  rest: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7Z"/>',
};
const suitIcon = (s, size = 16) =>
  `<svg class="suit" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${SUITS[s].color}" aria-hidden="true">${SHAPES[s]}</svg>`;
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

function bountyText(b) {
  if (b.type === 'records') return b.n === 1 ? 'set a new record' : `set ${b.n} new records`;
  if (b.type === 'boss') return `beat ${b.n} on the boss card`;
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

let actx = null;
function sfx(name) {
  if (!S?.settings.sound) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime;
    const notes = {
      tick: [[620, 0, 0.07]],
      rest: [[880, 0, 0.14], [880, 0.2, 0.14], [1175, 0.4, 0.26]],
      record: [[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.3]],
      flip: [[392, 0, 0.08], [587, 0.08, 0.08], [784, 0.16, 0.22]],
      win: [[392, 0, 0.12], [523, 0.12, 0.12], [659, 0.24, 0.12], [784, 0.36, 0.34]],
    }[name] ?? [];
    for (const [f, at, dur] of notes) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(0.16, t + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(actx.destination);
      o.start(t + at); o.stop(t + at + dur + 0.02);
    }
  } catch { /* no audio available */ }
}
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

function celebrate(text) {
  const colors = SUIT_ORDER.map(s => SUITS[s].color);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let html = `<div class="shout">${text}</div>`;
  if (!calm) {
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      html += `<i class="bit" style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--rot:${Math.random() * 720 - 360}deg;background:${colors[i % colors.length]};animation-delay:${Math.random() * 90}ms"></i>`;
    }
  }
  $fx.innerHTML = html;
  setTimeout(() => { $fx.innerHTML = ''; }, 1300);
}

function toast(text) {
  $fx.innerHTML = `<div class="toast">${text}</div>`;
  setTimeout(() => { $fx.innerHTML = ''; }, 1800);
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
    <button class="btn" data-act="setup-go">Deal my first hand</button>`;
}

function ensurePending() {
  const p = S.pending;
  if (!p || now() - p.createdAt > 3 * HOUR || p.mult !== E.multiplier(S, now())) {
    S.pending = E.dealHand(S, 'full', rng, now());
    save();
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
    else banner = `Season ${season.n}, ${season.name}. ${season.handsLeft} ${season.handsLeft === 1 ? 'hand' : 'hands'} until the next season opens.`;
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

function blockLabel(b) {
  if (b.boss) return 'Boss card, one all-out set';
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
    const rows = b.cards.map((c) => {
      const ex = EX[c.ex];
      let load = '';
      if (isDb(ex) && c.w !== loaded) { load = `<span class="load">${loaded == null ? 'Load' : 'Change to'} ${kg(c.w)} kg</span>`; loaded = c.w; }
      return `${load}<li class="mini" style="--i:${i++}">
        ${suitIcon(ex.suit, 18)}
        <div><b>${ex.name}</b>${c.mod && MODS[c.mod] ? `<em>${MODS[c.mod].name}</em>` : ''}${state(c)}</div>
        <span class="tgt">${targetText(c)}</span>
      </li>`;
    }).join('');
    return `<section class="block ${b.boss ? 'boss' : ''} ${b.cards.length > 1 ? 'joined' : ''}">
      <h3>${blockLabel(b)}</h3><ul>${rows}</ul></section>`;
  }).join('');
  function state(c) { return c.first && S.hands ? '<em class="new">New to you</em>' : c.bumpedFrom != null ? '<em class="new">Heavier than last time</em>' : ''; }
  return `
    <header class="top">
      <button class="icon" data-act="go-home" aria-label="Back">←</button>
      <span class="chip plain">${E.handCards(h).length} cards, about ${h.estMin} min</span>
    </header>
    <h1 class="title">${h.mode === 'quick' ? 'Quick hand' : style.name}</h1>
    <p class="sub">${h.mode === 'quick' ? 'Two cards and a boss. In and out.' : style.how}${h.mult > 1 ? ` Points on this hand are ${h.mult === 2 ? 'doubled' : 'up 25%'}.` : ''}</p>
    ${h.bounty ? `<p class="bounty ${h.bounty.gold ? 'gold' : ''}"><b>${h.bounty.gold ? 'Golden bounty' : 'Bounty'}</b> ${bountyText(h.bounty)} for ${h.bounty.reward} extra points</p>` : ''}
    <div class="blocks">${blocks}</div>
    <p class="warm">Warm up first: ten easy push-ups and some arm circles.</p>
    <div class="dock">
      <button class="btn" data-act="start">Start</button>
      <button class="ghost" data-act="reshuffle">Reshuffle</button>
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
  ui.cue = !S.lifts[c.key] || S.lifts[c.key].sessions === 0 ? c.sets.length === 0 : false;
}

function playScreen() {
  const st = stepNow();
  if (!st) return '';
  const c = st.card, ex = EX[c.ex];
  const dots = hand().steps.map((_, i) => `<span class="${i < st.index ? 'done' : i === st.index ? 'now' : ''}"></span>`).join('');
  const timed = ex.kind === 'time';
  const withWho = st.partners.length ? `, back to back with ${listWords(st.partners.map(p => EX[p.ex].name.toLowerCase()))}` : '';
  const setLine = (c.boss ? 'Boss card. One set, everything you have.' : `Set ${st.setNo} of ${st.setsTotal}${withWho}`) +
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
  const mod = c.mod && MODS[c.mod] ? `<p class="twist"><b>${MODS[c.mod].name}.</b> ${MODS[c.mod].how}</p>` : '';

  let entry;
  if (timed && ui.hold) {
    entry = `<div class="holding"><span class="num" id="hold-num">0</span><small>seconds</small></div>
      <button class="btn dark" data-act="hold-stop">Stop</button>`;
  } else {
    entry = `<div class="reps">
        <button data-act="reps" data-d="-1" aria-label="Fewer">−</button>
        <output>${ui.reps} ${timed ? 'sec' : ui.reps === 1 ? 'rep' : 'reps'}</output>
        <button data-act="reps" data-d="1" aria-label="More">+</button>
      </div>
      ${timed ? '<button class="btn line" data-act="hold-start">Start the clock</button>' : ''}
      <button class="btn dark" data-act="done">Done</button>`;
  }
  return `
    <header class="playbar">
      <div class="dots">${dots}</div>
      <button class="icon" data-act="menu" aria-label="More options">⋯</button>
    </header>
    <article class="face ${c.boss ? 'bossface' : ''}">
      <div class="corner">${suitIcon(ex.suit, 18)}<span>${c.boss ? 'Boss card' : `${suitName(ex.suit)} card`}</span>
        <button class="how" data-act="toggle-cue">${ui.cue ? 'Hide tips' : 'How to do it'}</button></div>
      <h2>${ex.name}</h2>
      <p class="setno">${setLine}</p>
      ${ui.cue ? `<p class="cue">${ex.cue} ${videoLink(ex)}</p>` : ''}
      ${mod}
      ${target}
      ${adjust}
      <p class="beat">${beatLine(c)}</p>
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
      <button class="icon" data-act="menu" aria-label="More options">⋯</button>
    </header>
    <div class="resting">
      <p class="lead">Rest</p>
      <div class="num" id="rest-num">${Math.max(0, Math.ceil((ui.restEnd - now()) / 1000))}</div>
      <div class="bar big"><i id="rest-bar"></i></div>
      ${change}
      <div class="nextup">
        <small>Next up</small>
        <div class="mini">${suitIcon(ex.suit, 18)}<div><b>${ex.name}</b></div><span class="tgt">${targetText(c)}</span></div>
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
    tag = 'New card'; big = ex.name; sub = `${suitIcon(ex.suit, 14)} joins your ${suitName(ex.suit).toLowerCase()} suit and shows up next hand`;
  } else if (item.type === 'mod') {
    tag = 'New twist'; big = MODS[item.id].name; sub = MODS[item.id].how;
  } else if (item.type === 'theme') {
    tag = 'New look'; big = THEMES[item.id].name;
    sub = S.settings.theme === item.id ? 'You are wearing it now.' : `<button class="wear" data-act="wear" data-theme="${item.id}">Wear it now</button>`;
  } else {
    tag = 'Jackpot'; big = `+${item.amount}`; sub = 'bonus points, just because';
  }
  return `<button class="loot" data-act="flip" data-i="${i}" aria-label="Flip your reward card">
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
      <h3>${m.loot.length > 1 ? 'Double drop. Two cards for you.' : 'A card for you.'}</h3>
      <div class="lootrow">${m.loot.map(lootCard).join('')}</div></section>`
    : '<p class="sub center">Play three sets or more and every hand ends with a reward card.</p>';
  return `
    <h1 class="cleared">${m.complete ? 'Hand<br>cleared' : 'Folded<br>early'}</h1>
    ${m.complete ? '' : '<p class="sub">Every set you did still counts.</p>'}
    <div class="earn">
      <div><span class="num" id="xp-num" data-to="${m.xp}">+${ui.enter ? 0 : num(m.xp)}</span><small>${multNote}</small></div>
      <div><span class="num">${m.records.length}</span><small>${m.records.length === 1 ? 'new record' : 'new records'}</small></div>
    </div>
    <p class="facts">${m.sets} ${m.sets === 1 ? 'set' : 'sets'}, ${num(m.kg)} kg lifted${m.minutes ? `, ${m.minutes} min` : ''}${m.level.to > m.level.from ? `. You are now <b>level ${m.level.to}</b>` : ''}</p>
    ${m.bounty?.won ? `<p class="bounty won ${m.bounty.gold ? 'gold' : ''}"><b>${m.bounty.gold ? 'Golden bounty won' : 'Bounty won'}</b> ${m.bounty.reward} extra points: you managed to ${bountyText(m.bounty)}</p>` : ''}
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
      <p class="trio"><span><b>${S.hands}</b> hands played</span><span><b>${S.records}</b> records</span><span><b>${S.unlocked.exercises.length}</b> cards</span></p>
    </section>
    <section class="suits">${suits}</section>
    <section class="panel dark">
      <h3>Getting stronger</h3>
      ${gains.length ? `<ul class="gains">${gains.map(g => g.text).join('')}</ul>` : '<p class="empty">Play a card twice and your gains show up here, first number to best number.</p>'}
    </section>
    <section class="panel dark">
      <h3>Season ${season.n}, ${season.name}</h3>
      <div class="pips">${Array.from({ length: 12 }, (_, i) => `<span class="${i < season.handsIn ? 'on' : ''}"></span>`).join('')}</div>
      <p class="empty">${season.handsLeft} ${season.handsLeft === 1 ? 'hand' : 'hands'} until ${season.next.name} opens. ${season.next.blurb}</p>
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
        ? `<button class="dcard ${S.fresh.includes(e.id) ? 'fresh' : ''}" data-act="card-info" data-id="${e.id}" style="--c:${SUITS[s].color}"><b>${e.name}</b>${S.fresh.includes(e.id) ? '<em>New</em>' : ''}</button>`
        : `<div class="dcard locked" style="--c:${SUITS[s].color}"><i></i></div>`).join('')}</div>
    </section>`;
  }).join('');
  const twist = Object.entries(MODS).map(([id, m]) => S.unlocked.mods.includes(id)
    ? `<li><b>${m.name}</b><span>${m.how}</span></li>` : '<li class="locked"><b>Locked twist</b><span>Drops from a reward card.</span></li>').join('');
  const styles = Object.entries(STYLES).map(([id, st]) => S.unlocked.styles.includes(id)
    ? `<li><b>${st.name}</b><span>${st.how}</span></li>` : '<li class="locked"><b>Locked hand style</b><span>Opens with a new season.</span></li>').join('');
  return `
    <header class="top">
      <span class="brand">Your deck</span>
      <span class="chip plain">${S.unlocked.exercises.filter(id => possible.some(e => e.id === id)).length} of ${possible.length} cards</span>
    </header>
    ${suits}
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
      <button class="icon" data-act="tab" data-to="progress" aria-label="Back">←</button>
      <span class="brand">Settings</span><span></span>
    </header>
    ${ui.notice ? `<p class="banner">${ui.notice}</p>` : ''}
    <section class="panel">
      <div class="field col"><div><b>Look</b><small>New looks arrive with seasons and reward cards</small></div><div class="swatches">${looks}</div></div>
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
      <div class="field col"><div><b>Backup</b><small>Your history lives only on this phone. Save a file now and then.</small></div>
        <div class="seg"><button data-act="export">Save a backup file</button><label class="filebtn">Restore from a file<input type="file" accept="application/json,.json" id="import"></label></div>
      </div>
      <div class="field col"><div><b>Start over</b><small>Erases every hand, record and card on this phone.</small></div>
        <div class="seg"><button class="danger" data-act="reset">${ui.confirmReset ? 'Tap again to erase everything' : 'Erase everything'}</button></div>
      </div>
    </section>`;
}

function navBar() {
  const tab = (to, label, glyph) => `<button data-act="tab" data-to="${to}" class="${ui.screen === to ? 'on' : ''}">${glyph}<span>${label}</span></button>`;
  return `<nav class="tabs">
    ${tab('home', 'Table', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="5" y="3" width="11" height="15" rx="2" transform="rotate(-10 10 10)" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9" y="6" width="11" height="15" rx="2" fill="currentColor"/></svg>')}
    ${tab('progress', 'Progress', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20V11h4v9Zm6 0V4h4v16Zm6 0v-6h4v6Z" fill="currentColor"/></svg>')}
    ${tab('deck', 'Deck', '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 4h7v7H3Zm11 0h7v7h-7ZM3 13h7v7H3Zm11 0h7v7h-7Z" fill="currentColor"/></svg>')}
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
  if (ui.sheet?.card) {
    const ex = EX[ui.sheet.card];
    const l = S.lifts[ex.id];
    const best = l?.bests?.length
      ? (isDb(ex) ? l.bests.map(b => `${kg(b.w)} kg × ${b.r}`).join(', ') : `${Math.max(...l.bests.map(b => b.r))} ${ex.kind === 'time' ? 'sec' : 'reps'}`)
      : null;
    return `<div class="scrim" data-act="close-sheet"></div><div class="sheet info" role="dialog" aria-label="${ex.name}">
      <p class="corner">${suitIcon(ex.suit, 18)}<span>${suitName(ex.suit)} card</span></p>
      <h2>${ex.name}</h2>
      <p>${ex.cue} ${videoLink(ex)}</p>
      ${spark(l)}
      <p class="muted">${l?.sessions ? `Played ${l.sessions} ${l.sessions === 1 ? 'time' : 'times'}. Best: ${best}.` : 'Not played yet. It is first in line for the next hand of this suit.'}</p>
      <button class="quiet" data-act="close-sheet">Close</button>
    </div>`;
  }
  return '';
}

// ---------- render loop ----------

const SCREENS = {
  setup: setupScreen, home: homeScreen, deal: dealScreen, play: playScreen, rest: restScreen,
  finish: finishScreen, progress: progressScreen, deck: deckScreen, settings: settingsScreen,
};
const WITH_TABS = ['home', 'progress', 'deck'];

function render() {
  applyTheme();
  $app.className = `s-${ui.screen}${ui.enter ? ' enter' : ''}`;
  $app.innerHTML = SCREENS[ui.screen]() + (WITH_TABS.includes(ui.screen) ? navBar() : '') + sheetView();
  if (ui.screen === 'finish') {
    requestAnimationFrame(() => $app.querySelectorAll('.bar i[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; }));
    if (ui.enter) countUp();
  }
  ui.enter = false;
}
function go(screen) {
  clearInterval(ticker); ticker = null;
  ui.screen = screen; ui.enter = true; ui.sheet = null; ui.confirmReset = false; ui.notice = null;
  render();
  window.scrollTo(0, 0);
  if (screen === 'rest') startRestTicker();
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
    const n = document.getElementById('rest-num'), bar = document.getElementById('rest-bar');
    if (n) n.textContent = Math.max(0, Math.ceil(left));
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, left / ui.restTotal * 100))}%`;
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
}
function endRest(chime) {
  if (ui.screen !== 'rest') return;
  if (chime) { sfx('rest'); buzz([120, 80, 120]); }
  go('play');
}

function finishNow() {
  const h = S.current ?? ui.hand;
  const summary = E.finishHand(S, h, rng, now());
  save();
  keepAwake(false);
  if (!summary.sets) return go('home');
  ui.summary = summary;
  sfx('win'); buzz([60, 40, 60, 40, 160]);
  go('finish');
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
    S = E.newState({ ...s, max: Math.max(s.max, s.bench, s.curl) }, now());
    save();
    navigator.storage?.persist?.().catch(() => {});
    go('home');
  },
  tab({ to }) { go(to); },
  'go-home'() { go('home'); },
  deal({ mode }) {
    ui.hand = mode === 'quick' ? E.dealHand(S, 'quick', rng, now()) : ensurePending();
    sfx('flip');
    go('deal');
  },
  reshuffle() {
    const seen = E.handCards(ui.hand).map(c => c.ex);
    ui.hand = E.dealHand(S, ui.hand.mode, rng, now(), seen);
    if (ui.hand.mode === 'full') { S.pending = ui.hand; save(); }
    sfx('flip'); ui.enter = true; render();
  },
  start() {
    S.current = ui.hand; S.pending = null; save();
    keepAwake(true); initStepUi(); sfx('tick');
    go('play');
  },
  continue() { keepAwake(true); initStepUi(); go('play'); },
  pause() { keepAwake(false); go('home'); },
  reps({ d }) {
    const timed = EX[stepNow().card.ex].kind === 'time';
    ui.reps = Math.max(0, ui.reps + +d * (timed ? 5 : 1));
    render();
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
    const res = E.logSet(S, hand(), ui.reps, now());
    save();
    const next = () => {
      if (hand()?.done) return finishNow();
      if (st.rest > 0) return startRest(st);
      initStepUi(); go('play');
    };
    if (res.record) {
      sfx('record'); buzz([40, 30, 40, 30, 120]);
      celebrate('New record');
      $app.classList.add('locked');
      setTimeout(next, 950);
    } else {
      sfx('tick'); buzz(30);
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
  flip(_, el) {
    if (el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    sfx('flip'); buzz(40);
  },
  wear({ theme }) { S.settings.theme = theme; save(); applyTheme(); render(); document.querySelectorAll('.loot').forEach(l => l.classList.add('flipped', 'still')); },
  'card-info'({ id }) { ui.sheet = { card: id }; render(); },
  set({ key, val }) {
    S.settings[key] = key === 'theme' ? val : key === 'step' ? +val : val === 'true';
    if (key === 'step') S.settings.min = Math.min(S.settings.min, +val);
    S.pending = null;
    save(); render();
    if (key === 'sound' && val === 'true') sfx('tick');
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
    go('setup');
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
    S = data; save();
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
