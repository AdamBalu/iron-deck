// The arena: one exchange of blows, staged full screen after a set.
// It only shows what the engine already decided (damage, block, fury, enrage, the kill): nothing here changes the result.
// Layers, back to front: sky, far scenery, floor, the fighters, a canvas of sparks, then the bars, numbers and banners.
import { heroSvg, bossSvg, itemIcon, attackPoses } from './art.js';

let live = null; // the exchange on screen: { el, timers, raf }

export function closeArena() {
  if (!live) return;
  live.timers.forEach(clearTimeout);
  cancelAnimationFrame(live.raf);
  live.el.remove();
  live = null;
}

// ---------- sparks ----------
// A small particle system on one canvas: dots that fly and fade, rings that widen, and arcs that sweep.
function sparks(canvas) {
  const ctx = canvas.getContext('2d');
  const bits = [];
  const fit = () => {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, r.width * d); canvas.height = Math.max(1, r.height * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return r;
  };
  let box = fit(), last = performance.now();
  const api = {
    burst(x, y, { n = 24, colors = ['#fff'], speed = 420, life = 0.7, size = 5, grav = 700, spread = Math.PI * 2, aim = 0 } = {}) {
      for (let i = 0; i < n; i++) {
        const a = aim + (Math.random() - 0.5) * spread, v = speed * (0.35 + Math.random() * 0.85);
        bits.push({ kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav, life: life * (0.6 + Math.random() * 0.7), age: 0, size: size * (0.5 + Math.random()), color: colors[i % colors.length], spin: Math.random() * 6 });
      }
    },
    ring(x, y, color = '#fff', to = 190, life = 0.5, width = 7) { bits.push({ kind: 'ring', x, y, to, life, age: 0, color, width }); },
    arc(x, y, r, from, sweep, color = '#fff', life = 0.28, width = 16) { bits.push({ kind: 'arc', x, y, r, from, sweep, life, age: 0, color, width }); },
    embers(colors) {
      // slow motes drifting up for as long as the arena is open
      if (Math.random() < 0.35) bits.push({ kind: 'dot', x: Math.random() * box.width, y: box.height * (0.55 + Math.random() * 0.45), vx: (Math.random() - 0.5) * 20, vy: -18 - Math.random() * 40, grav: -6, life: 2.4 + Math.random() * 2, age: 0, size: 1.5 + Math.random() * 2.5, color: colors[Math.floor(Math.random() * colors.length)], spin: 0, soft: true });
    },
    frame(now, ambient) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (ambient) api.embers(ambient);
      ctx.clearRect(0, 0, box.width, box.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { bits.splice(i, 1); continue; }
        ctx.globalAlpha = p.soft ? Math.sin(k * Math.PI) * 0.7 : 1 - k * k;
        if (p.kind === 'dot') {
          p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.age * 6);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.soft ? 1 : 1.8));
          ctx.restore();
        } else if (p.kind === 'ring') {
          const ease = 1 - Math.pow(1 - k, 3);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k);
          ctx.beginPath(); ctx.arc(p.x, p.y, 12 + p.to * ease, 0, Math.PI * 2); ctx.stroke();
        } else {
          const ease = 1 - Math.pow(1 - Math.min(1, k * 2.2), 2);
          ctx.strokeStyle = p.color; ctx.lineWidth = p.width * (1 - k); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.from, p.from + p.sweep * ease, p.sweep < 0); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  };
  return api;
}

const backdrop = `<svg class="ar-far" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <circle cx="244" cy="46" r="26" fill="#fff" opacity=".1"/><circle cx="244" cy="46" r="15" fill="#fff" opacity=".12"/>
  <path d="M0 200V132L38 96L70 126L112 72L150 118L186 88L232 128L270 84L318 124L356 92L400 130V200Z" fill="#000" opacity=".22"/>
  <path d="M0 200V158L46 132L92 156L140 124L196 158L244 136L300 160L352 134L400 156V200Z" fill="#000" opacity=".3"/>
  <path d="M34 200V96H28V88H56V96H50V200ZM350 200V84H344V76H372V84H366V200Z" fill="#000" opacity=".34"/>
  <path d="M28 88L42 70L56 88ZM344 76L358 58L372 76Z" fill="#000" opacity=".34"/>
</svg>`;

// Plays one exchange and returns how long it runs, in milliseconds.
//   spec.equip, spec.weapon (item or null), spec.boss { k, name, big }, spec.hp { from, to } in percent
//   spec.dmg, spec.crit, spec.notes, spec.fight (from the engine), spec.down (the boss fell), spec.prize
//   spec.ultName, spec.color (the hero's accent), spec.kind ('blade' or 'blunt'), spec.sfx, spec.buzz, spec.onClose
export function playArena(spec) {
  closeArena();
  const { fight, boss, weapon } = spec;
  const el = document.createElement('div');
  el.id = 'arena';
  el.className = `${boss.big ? 'big' : ''} ${fight.open ? 'enraged' : ''}`;
  el.style.setProperty('--rc', spec.color);
  const poses = attackPoses(weapon?.line ?? 'none');
  const frames = [heroSvg(spec.equip, { size: 220 }), ...poses.map(pose => heroSvg(spec.equip, { size: 220, pose }))];
  el.innerHTML = `<div class="ar-sky"></div>${backdrop}<div class="ar-floor"></div>
    <div class="ar-stage">
      <div class="ar-hero"><div class="ar-flip">${frames.map((f, i) => `<div class="ar-frame ${i === 0 ? 'on' : ''}">${f}</div>`).join('')}</div><i class="ar-shield"></i></div>
      <div class="ar-boss"><i class="ar-aura"></i><div class="ar-bossart">${bossSvg(boss.k, 260)}</div><div class="ar-nums"></div></div>
    </div>
    ${fight.ult && weapon ? `<div class="ar-ult">${itemIcon(weapon.id, 320)}</div>` : ''}
    <canvas class="ar-fx"></canvas>
    <div class="ar-hud">
      <div class="ar-row"><b>${boss.name}</b><span class="ar-bar hp"><i style="width:${spec.hp.from}%"></i><em></em></span></div>
      <div class="ar-row fury"><b>Fury</b><span class="ar-bar"><i style="width:${fight.furyWas}%"></i></span><small></small></div>
    </div>
    <div class="ar-banner"></div><div class="ar-flash"></div>
    <small class="ar-skip">Tap to skip</small>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const hero = $('.ar-hero'), foe = $('.ar-boss'), art = $('.ar-bossart'), banner = $('.ar-banner'), nums = $('.ar-nums');
  const fx = sparks($('.ar-fx'));
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(() => { if (live?.el === el) fn(); }, ms));
  live = { el, timers, raf: 0 };
  const ambient = boss.big ? ['#FFD23F', '#FF9F1C', '#fff'] : ['#FF5A4E', '#FF9F1C', '#B79CFF'];
  const loop = (now) => { fx.frame(now, ambient); if (live?.el === el) live.raf = requestAnimationFrame(loop); };
  live.raf = requestAnimationFrame(loop);
  el.addEventListener('click', () => { closeArena(); spec.onClose?.(); });

  // where things are, measured once the scene has laid out
  const mid = (node, fy = 0.5) => { const a = el.getBoundingClientRect(), r = node.getBoundingClientRect(); return [r.left - a.left + r.width / 2, r.top - a.top + r.height * fy]; };
  const pose = (i) => el.querySelectorAll('.ar-frame').forEach((f, n) => f.classList.toggle('on', n === i));
  const say = (title, sub = '', cls = '', hold = 900) => {
    banner.className = `ar-banner show ${cls}`;
    banner.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
    at(hold, () => { if (banner.innerHTML.includes(title)) banner.className = 'ar-banner'; });
  };
  const number = (text, cls = '', tag = '') => {
    const n = document.createElement('b');
    n.className = `ar-num ${cls}`;
    n.innerHTML = `${text}${tag ? `<small>${tag}</small>` : ''}`;
    const pct = 40 + Math.random() * 20;
    n.style.left = `${pct}%`;
    nums.append(n);
    // a long number or a long line of tags must not run off either side of a narrow screen
    const centre = foe.offsetLeft + $('.ar-stage').offsetLeft + nums.offsetWidth * pct / 100, half = n.offsetWidth / 2, edge = 8;
    let shift = Math.min(0, el.clientWidth - edge - (centre + half));
    if (centre - half + shift < edge) shift = edge - (centre - half);
    if (shift) n.style.left = `calc(${pct}% + ${shift}px)`;
  };
  const shake = (px, ms = 380) => el.animate([{ transform: 'none' }, { transform: `translate(${-px}px, ${px * 0.6}px)` }, { transform: `translate(${px * 0.8}px, ${-px * 0.7}px)` }, { transform: `translate(${-px * 0.5}px, ${-px * 0.3}px)` }, { transform: 'none' }], { duration: ms });
  const flash = (color, ms = 260, peak = 0.55) => $('.ar-flash').animate([{ opacity: 0, background: color }, { opacity: peak, background: color, offset: 0.15 }, { opacity: 0, background: color }], { duration: ms });
  const warm = ['#fff', spec.color, '#FFD23F'];

  // ---------- your blow ----------
  let t = 320;
  if (fight.ult) {
    at(200, () => { el.classList.add('dim'); say(spec.ultName, 'Ultimate', 'ult', 1100); spec.sfx('ult'); hero.animate([{ filter: 'none' }, { filter: `drop-shadow(0 0 22px ${spec.color}) brightness(1.5)` }, { filter: `drop-shadow(0 0 10px ${spec.color})` }], { duration: 900, fill: 'forwards' }); const [x, y] = mid(hero, 0.6); fx.ring(x, y, spec.color, 240, 0.8, 9); fx.burst(x, y, { n: 40, colors: warm, speed: 300, life: 1, grav: -260 }); });
    t = 1250;
  }
  const impactAt = t + (fight.ult ? 300 : 190);
  at(t, () => {
    pose(1);
    spec.sfx('swing');
    hero.animate([{ transform: 'none' }, { transform: 'translateX(-7%) rotate(-5deg)', offset: 0.3 }, { transform: 'translateX(34%) rotate(6deg)', offset: 0.5 }, { transform: 'translateX(26%) rotate(3deg)', offset: 0.72 }, { transform: 'none' }], { duration: fight.ult ? 900 : 760, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (fight.ult && $('.ar-ult')) $('.ar-ult').animate([{ opacity: 0, transform: 'translate(-50%, -150%) rotate(-60deg) scale(.6)' }, { opacity: 1, transform: 'translate(-50%, -60%) rotate(-20deg) scale(1.1)', offset: 0.55 }, { opacity: 1, transform: 'translate(-50%, -8%) rotate(8deg) scale(1)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%, 0) rotate(8deg) scale(1.15)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.9,.4)' });
  });
  at(impactAt - 20, () => pose(Math.min(2, poses.length)));
  at(impactAt, () => {
    const [x, y] = mid(art), big = fight.ult || spec.crit || spec.down;
    if (spec.kind === 'blade') fx.arc(x - 10, y, art.offsetWidth * 0.55, -2.3, 3.2, '#fff', 0.3, big ? 26 : 16);
    else fx.ring(x, y, '#fff', art.offsetWidth * 0.6, 0.35, big ? 16 : 9);
    fx.burst(x, y, { n: fight.ult ? 90 : big ? 54 : 26, colors: warm, speed: big ? 640 : 420, size: big ? 7 : 5 });
    if (fight.ult) { fx.ring(x, y, spec.color, art.offsetWidth * 1.3, 0.7, 20); fx.ring(x, y, '#fff', art.offsetWidth * 0.9, 0.5, 10); }
    art.animate([{ transform: 'none', filter: 'none' }, { transform: 'translateX(9%) rotate(7deg) scale(.93)', filter: 'brightness(3.6) saturate(0)', offset: 0.12 }, { transform: 'translateX(-4%) rotate(-3deg)', filter: 'brightness(1.5)', offset: 0.4 }, { transform: 'none', filter: 'none' }], { duration: fight.ult ? 620 : 420 });
    const tags = [fight.ult ? 'Ultimate' : spec.crit ? 'Critical' : '', fight.edge > 0 ? 'Riposte' : fight.edge < 0 ? 'Staggered' : '', ...spec.notes].filter(Boolean);
    number(`−${spec.dmg.toLocaleString('en-US')}`, big ? 'big' : '', tags.join('&nbsp;· '));
    $('.ar-bar.hp i').style.width = `${spec.hp.to}%`;
    shake(fight.ult ? 16 : big ? 10 : 5, fight.ult ? 520 : 360);
    if (big) flash('#fff', fight.ult ? 420 : 260, fight.ult ? 0.8 : 0.5);
    spec.sfx(fight.ult ? 'ult-hit' : `${spec.down ? 'down' : spec.crit ? 'crit' : 'hit'}-${spec.kind}`);
    spec.buzz(fight.ult ? [60, 30, 60, 30, 160] : big ? [40, 30, 40, 30, 120] : 30);
    el.classList.remove('dim');
  });
  at(impactAt + 330, () => pose(0));
  let next = impactAt + 760;

  if (spec.down) {
    // ---------- the fall ----------
    at(impactAt + 260, () => {
      const [x, y] = mid(art);
      art.animate([{ filter: 'none', transform: 'none', opacity: 1 }, { filter: 'brightness(4) saturate(0)', transform: 'scale(1.06) rotate(-4deg)', offset: 0.12 }, { filter: 'brightness(1.2)', transform: 'rotate(6deg)', offset: 0.35 }, { filter: 'grayscale(.4)', transform: 'rotate(16deg) translateY(4%)', offset: 0.6 }, { filter: 'grayscale(1)', transform: 'rotate(64deg) translateY(60%) scale(.55)', opacity: 0 }], { duration: 1700, fill: 'forwards', easing: 'ease-in' });
      [0, 220, 480, 800].forEach((d, i) => at(d, () => { fx.burst(x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90, { n: 46, colors: ['#fff', '#FFD23F', '#FF5A4E', '#B79CFF'], speed: 560, life: 1.1, size: 8 }); fx.ring(x, y, i % 2 ? '#FFD23F' : '#fff', art.offsetWidth * (0.8 + i * 0.25), 0.6, 12); shake(8 - i, 300); }));
      flash('#fff', 520, 0.85);
      el.classList.add('won');
    });
    at(impactAt + 620, () => say(`${boss.name} falls`, spec.prize, 'win', 2200));
    next = impactAt + 2900;
  } else {
    if (fight.enragedNow) {
      at(next, () => { el.classList.add('enraged'); say('Enraged', 'Harder to block, but every blow lands harder', 'rage', 950); const [x, y] = mid(art); fx.ring(x, y, '#FF5A4E', art.offsetWidth, 0.7, 14); fx.burst(x, y, { n: 40, colors: ['#FF5A4E', '#FF9F1C'], speed: 380, grav: -200, life: 0.9 }); art.animate([{ transform: 'none' }, { transform: 'scale(1.18)' }, { transform: 'none' }], { duration: 600 }); shake(7, 420); spec.sfx('roar'); spec.buzz([80, 40, 140]); });
      next += 1050;
    }
    if (fight.blocked !== null) {
      // ---------- the boss answers ----------
      const strikeAt = next + 290;
      at(next, () => foe.animate([{ transform: 'none' }, { transform: 'translateX(6%) scale(.96)', offset: 0.22 }, { transform: 'translateX(-58%) scale(1.14)', offset: 0.5 }, { transform: 'translateX(-40%) scale(1.08)', offset: 0.66 }, { transform: 'none' }], { duration: 760, easing: 'cubic-bezier(.3,.7,.2,1)' }));
      at(strikeAt, () => {
        const [x, y] = mid(hero, 0.55);
        if (fight.blocked) {
          $('.ar-shield').animate([{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.2 }, { opacity: 0.9, transform: 'scale(1)', offset: 0.6 }, { opacity: 0, transform: 'scale(1.15)' }], { duration: 620 });
          fx.burst(x + 40, y, { n: 34, colors: ['#fff', '#5CF2FF', '#FFD23F'], speed: 520, spread: 2.2, aim: 0 });
          fx.ring(x + 30, y, '#5CF2FF', 110, 0.4, 8);
          hero.animate([{ transform: 'none' }, { transform: 'translateX(-5%)' }, { transform: 'none' }], { duration: 320 });
          say('Blocked', 'Riposte: your next hit lands 15% harder', 'good', 950);
          spec.sfx('block'); spec.buzz(40); shake(4, 240);
        } else {
          fx.burst(x, y, { n: 30, colors: ['#FF5A4E', '#fff'], speed: 460, spread: 2.4, aim: Math.PI });
          fx.arc(x, y, 70, 0.6, -3, '#FF5A4E', 0.3, 18);
          hero.animate([{ transform: 'none', filter: 'none' }, { transform: 'translateX(-14%) rotate(-9deg)', filter: 'brightness(2.4) sepia(1) hue-rotate(-40deg) saturate(4)', offset: 0.18 }, { transform: 'translateX(-8%) rotate(-4deg)', filter: 'none', offset: 0.55 }, { transform: 'none' }], { duration: 560 });
          flash('#FF2D2D', 300, 0.3);
          say('Staggered', 'Your next hit lands 15% softer', 'bad', 950);
          spec.sfx('hurt'); spec.buzz([70, 40, 70]); shake(9, 360);
        }
      });
      next += 1150;
    }
  }
  // ---------- fury ----------
  at(Math.max(impactAt + 300, next - 700), () => {
    $('.ar-row.fury i').style.width = `${fight.fury}%`;
    const full = fight.fury >= 100;
    $('.ar-row.fury').classList.toggle('full', full);
    $('.ar-row.fury small').textContent = full ? `${spec.ultName} is ready` : fight.ult ? 'Spent' : `${fight.fury} of 100`;
  });
  at(next, () => el.classList.add('out'));
  at(next + 240, () => { closeArena(); spec.onClose?.(); });
  return next + 240;
}
