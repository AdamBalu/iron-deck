// Drawn-in-code art: weapons, armour, the hero wearing them, and the gremlin.
// One style throughout: flat shapes, each with a lighter facet, no outlines.
import { ITEMS } from './data.js';
import { BOSS_SMALL, BOSS_BIG } from './art-bosses.js';

// Metal, highlight, shadow, trim and gem per rarity: iron, steel, blued steel, void purple, gold.
const PAL = [
  { metal: '#8A8DA0', hi: '#BDC0CF', lo: '#5C5F73', trim: '#8B6B4A', gem: '#B5B8C8' },
  { metal: '#A9B4BE', hi: '#E0E7ED', lo: '#6F7C88', trim: '#3FAE6A', gem: '#58E0A0' },
  { metal: '#7F9BD1', hi: '#C2D5F7', lo: '#4A63A0', trim: '#2F6FED', gem: '#4CC9F0' },
  { metal: '#7A5CC4', hi: '#B09CEE', lo: '#44307F', trim: '#C77DFF', gem: '#E7B8FF' },
  { metal: '#F2B632', hi: '#FFE99A', lo: '#B67A0E', trim: '#FFF6D6', gem: '#FF5A4E' },
];
// Common armour is cloth and leather, not metal.
const SOFT = { metal: '#8B6B4A', hi: '#B08B66', lo: '#5E4630', trim: '#C9B089', gem: '#C9B089' };
const WOOD = '#6B4A32', WOOD_HI = '#8D6646', LEATHER = '#4A3526', BONE = '#F3EBD8', INK = '#15123A';

const f = (n) => Math.round(n * 10) / 10;
const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const R = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${extra}/>`;
const shaft = (top, bottom, wood = true) =>
  R(-3.5, top, 7, bottom - top, wood ? WOOD : '#3A3D52', 2) + R(-3.5, top, 3, bottom - top, wood ? WOOD_HI : '#5C5F73', 2) + R(-5, bottom - 5, 10, 6, '#3A3D52', 2);

// ---------- weapons ----------
// Drawn upright with the grip at the origin, so the same art hangs in the hero's hand and on a card.
// top/bot are the extents, used to frame the icon.
const WEAPON = {
  // wooden practice blade, plain steel, longer with a fuller, broad with runes, leaf-bladed with wings
  sword: {
    top: -148, bot: 26,
    draw(r, p) {
      const len = [94, 102, 114, 116, 126][r], bw = [6, 6.5, 7, 9.5, 8][r], gw = [13, 17, 21, 24, 27][r], tip = -20 - len;
      let out;
      if (r === 0) out = P(`M${-bw} -20V${tip + 8}Q${-bw} ${tip} 0 ${tip}Q${bw} ${tip} ${bw} ${tip + 8}V-20Z`, WOOD_HI) + P(`M${-bw} -20V${tip + 8}Q${-bw} ${tip} 0 ${tip}V-20Z`, '#B48A5E');
      else if (r === 4) out = P(`M-6 -20L-9 ${tip + 46}L-12 ${tip + 26}L0 ${tip}L12 ${tip + 26}L9 ${tip + 46}L6 -20Z`, p.metal) + P(`M-6 -20L-9 ${tip + 46}L-12 ${tip + 26}L0 ${tip}V-20Z`, p.hi);
      else out = P(`M${-bw} -20V${tip + 18}L0 ${tip}L${bw} ${tip + 18}V-20Z`, p.metal) + P(`M${-bw} -20V${tip + 18}L0 ${tip}V-20Z`, p.hi);
      if (r >= 2) out += R(-1.1, tip + 24, 2.2, len - 36, p.lo, 1, ' opacity=".55"');
      if (r === 3) out += [0.3, 0.52, 0.74].map(t => { const y = f(-20 - len * t); return P(`M0 ${y - 5}L3.4 ${y}L0 ${y + 5}L-3.4 ${y}Z`, p.gem, ' class="glint"'); }).join('');
      if (r === 4) out += C(0, tip + 30, 3.4, p.gem, ' class="glint"') + P(`M0 ${tip + 44}L2.6 ${tip + 52}L0 ${tip + 60}L-2.6 ${tip + 52}Z`, '#fff', ' opacity=".9"');
      if (r === 0) out += R(-gw, -24, gw * 2, 6, WOOD, 2);
      else if (r === 3) out += P(`M${-gw} -34Q0 -8 ${gw} -34L${gw - 2} -24Q0 -6 ${-gw + 2} -24Z`, p.trim);
      else out += P(`M${-gw} -25H${gw}L${gw - 4} -17H${-gw + 4}Z`, p.trim);
      if (r === 2) out += C(-gw, -21, 4.2, p.trim) + C(gw, -21, 4.2, p.trim);
      if (r === 4) out += P(`M${-gw} -25C${-gw - 13} -34 ${-gw - 11} -46 ${-gw - 2} -48C${-gw - 4} -39 ${-gw + 2} -31 ${-gw + 9} -25Z`, p.hi) + P(`M${gw} -25C${gw + 13} -34 ${gw + 11} -46 ${gw + 2} -48C${gw + 4} -39 ${gw - 2} -31 ${gw - 9} -25Z`, p.hi);
      out += r === 0 ? R(-3.6, -18, 7.2, 32, WOOD, 2) + C(0, 17, 5, WOOD) : R(-4, -17, 8, 31, LEATHER, 2) + [-9, -1, 7].map(y => R(-4, y, 8, 2, WOOD_HI)).join('') + C(0, 18, 6.5, p.trim);
      if (r >= 2) out += C(0, 18, 3, p.gem);
      return out;
    },
  },
  // chipped and rusty, clean with parrying hooks, broad with ring guards, wave-edged, vast with a crowned guard
  zweihander: {
    top: -186, bot: 40,
    draw(r, p) {
      const bw = [8, 8.5, 10.5, 9.5, 11.5][r], len = [116, 122, 128, 130, 136][r], gw = [21, 27, 30, 29, 34][r], base = -46, tip = base - len;
      let left = `M0 ${base}H${-bw}`, right = '';
      if (r === 3) { // flamberge: both edges ripple
        const n = 6, step = (len - 20) / n;
        for (let i = 1; i <= n; i++) { const y = f(base - step * i), y0 = f(base - step * (i - 0.5)); left += `Q${-bw - 4.5} ${y0} ${-bw} ${y}`; }
        for (let i = n; i >= 1; i--) { const y = f(base - step * (i - 1)), y0 = f(base - step * (i - 0.5)); right += `Q${bw + 4.5} ${y0} ${bw} ${y}`; }
        left += `L0 ${tip}`; right = `L${bw} ${f(base - step * n)}` + right;
      } else if (r === 0) { // two bites out of the edge
        left += `V${tip + 20}L0 ${tip}`;
        right = `L${bw} ${tip + 20}V${base - 78}L${bw - 5} ${base - 72}L${bw} ${base - 64}V${base - 36}L${bw - 4} ${base - 31}L${bw} ${base - 25}V${base}`;
      } else { left += `V${tip + 20}L0 ${tip}`; right = `L${bw} ${tip + 20}V${base}`; }
      let out = P(`${left}${right}Z`, p.metal) + P(`${left}V${base}Z`, p.hi);
      if (r === 0) out += C(-3, base - 50, 2.6, '#9A5B3A', ' opacity=".8"') + C(3, base - 92, 3, '#9A5B3A', ' opacity=".7"') + C(-2, base - 18, 2, '#9A5B3A', ' opacity=".7"');
      if (r >= 2) out += R(-1.3, tip + 26, 2.6, len - 34, p.lo, 1, ' opacity=".5"');
      if (r >= 3) out += [0.3, 0.48, 0.66, 0.84].slice(0, r === 4 ? 4 : 3).map(t => { const y = f(base - len * t); return P(`M0 ${y - 6}L3.6 ${y}L0 ${y + 6}L-3.6 ${y}Z`, r === 4 ? '#fff' : p.gem, ' class="glint"'); }).join('');
      out += R(-5.5, base, 11, 20, p.lo);
      const hooks = (y) => P(`M${-bw} ${y - 6}L${-bw - 13} ${y + 2}L${-bw} ${y + 8}Z`, p.metal) + P(`M${bw} ${y - 6}L${bw + 13} ${y + 2}L${bw} ${y + 8}Z`, p.metal);
      if (r >= 1) out += hooks(base - 6);
      if (r === 4) out += hooks(base - 26);
      if (r === 0) out += R(-gw, -27, gw * 2, 7, p.lo, 2);
      else out += P(`M${-gw} -27H${gw}L${gw - 5} -19H${-gw + 5}Z`, p.trim) + C(-gw, -23, 4.5, p.trim) + C(gw, -23, 4.5, p.trim);
      if (r === 2) out += C(-gw + 11, -31, 6, p.trim) + C(-gw + 11, -31, 3, p.lo) + C(gw - 11, -31, 6, p.trim) + C(gw - 11, -31, 3, p.lo);
      if (r === 3) out += P(`M${-gw} -27L${-gw - 6} -12L${-gw + 8} -19Z`, p.trim) + P(`M${gw} -27L${gw + 6} -12L${gw - 8} -19Z`, p.trim);
      if (r === 4) out += P(`M${-gw} -27L${-gw - 4} -44L${-gw + 10} -27ZM${gw} -27L${gw + 4} -44L${gw - 10} -27ZM-7 -27L0 -40L7 -27Z`, p.hi);
      out += R(-4, -19, 8, 46, LEATHER, 2) + R(-5, 0, 10, 3.5, r === 0 ? p.lo : p.trim, 1) + [-12, -6, 10, 16].map(y => R(-4, y, 8, 2, WOOD_HI)).join('') +
        P('M0 24L8 32L0 40L-8 32Z', r === 0 ? p.lo : p.trim);
      if (r >= 2) out += P('M0 28L4 32L0 36L-4 32Z', p.gem);
      return out;
    },
  },
  // wooden mallet, smith's hammer with a peen, banded warhammer, spiked maul with a bolt, crowned wall-breaker
  hammer: {
    top: -170, bot: 42, ibot: -34,
    draw(r, p) {
      let out = shaft(-112, 40) + R(-4, 6, 8, 26, LEATHER, 2);
      if (r === 0) {
        out += R(-21, -134, 42, 27, WOOD, 6) + R(-21, -134, 42, 11, WOOD_HI, 6) + R(-21, -134, 6, 27, LEATHER, 3) + R(15, -134, 6, 27, LEATHER, 3);
      } else if (r === 1) {
        out += R(-24, -133, 27, 24, p.metal, 3) + R(-24, -133, 27, 10, p.hi, 3) + P('M3 -133L25 -125V-117L3 -109Z', p.metal) + P('M3 -133L25 -125V-121L3 -121Z', p.hi) + R(-5, -110, 10, 6, p.trim, 2);
      } else {
        const hw = [0, 0, 26, 30, 34][r], hh = [0, 0, 32, 38, 44][r], y = -106 - hh;
        if (r === 4) out += P(`M${-hw + 7} ${y}H${hw - 7}L${hw} ${y + 7}V${y + hh - 7}L${hw - 7} ${y + hh}H${-hw + 7}L${-hw} ${y + hh - 7}V${y + 7}Z`, p.metal) + P(`M${-hw + 7} ${y}H${hw - 7}L${hw} ${y + 7}V${y + hh * 0.42}H${-hw}V${y + 7}Z`, p.hi);
        else out += R(-hw, y, hw * 2, hh, p.metal, 4) + R(-hw, y, hw * 2, hh * 0.42, p.hi, 4);
        out += R(-hw + 5, y, 4.5, hh, p.lo) + R(hw - 9.5, y, 4.5, hh, p.lo) + C(0, y + hh / 2, 6, p.trim) + C(0, y + hh / 2, 3, p.gem);
        if (r === 2) out += P(`M-5 ${y}L0 ${y - 9}L5 ${y}Z`, p.lo);
        if (r >= 3) out += P(`M${-hw} ${y + 5}L${-hw - 12} ${y + hh / 2}L${-hw} ${y + hh - 5}Z`, p.metal) + P(`M${hw} ${y + 5}L${hw + 12} ${y + hh / 2}L${hw} ${y + hh - 5}Z`, p.metal);
        if (r === 3) out += P(`M${-hw + 14} ${y + 6}L${-hw + 20} ${y + 6}L${-hw + 16} ${y + 16}L${-hw + 21} ${y + 16}L${-hw + 12} ${y + hh - 6}L${-hw + 15} ${y + 20}L${-hw + 11} ${y + 20}Z`, p.gem, ' class="glint"') +
          P(`M${hw - 14} ${y + 6}L${hw - 20} ${y + 6}L${hw - 16} ${y + 16}L${hw - 21} ${y + 16}L${hw - 12} ${y + hh - 6}L${hw - 15} ${y + 20}L${hw - 11} ${y + 20}Z`, p.gem, ' class="glint"');
        if (r === 4) out += P(`M-13 ${y}L-9 ${y - 12}L-4 ${y - 3}L0 ${y - 16}L4 ${y - 3}L9 ${y - 12}L13 ${y}Z`, p.hi) +
          R(-hw + 13, y + 6, 2, hh - 12, p.lo, 1, ' opacity=".6"') + R(hw - 15, y + 6, 2, hh - 12, p.lo, 1, ' opacity=".6"');
        out += R(-5.5, y + hh - 1, 11, 6, p.trim, 2);
      }
      return out;
    },
  },
  // small hatchet, bearded battle axe, double-bit, frost-toothed with a spike, huge crescent cleaver
  axe: {
    top: -170, bot: 42, ibot: -34,
    draw(r, p) {
      const s = [0.72, 1, 1, 1.08, 1.22][r];
      const blade = (side) => `<g transform="translate(0 -100) scale(${side * s} ${s}) translate(0 100)">` +
        P('M-3 -124C-24 -130 -42 -117 -47 -99C-42 -82 -24 -70 -3 -77Z', p.metal) + P('M-3 -124C-24 -130 -42 -117 -47 -99L-3 -101Z', p.hi) +
        P('M-41 -117C-50 -105 -50 -93 -41 -81C-45 -93 -45 -105 -41 -117Z', '#fff', ' opacity=".7"') +
        (r === 1 ? P('M-3 -78C-16 -72 -24 -62 -24 -52C-18 -60 -10 -64 -3 -66Z', p.metal) : '') +
        (r === 3 ? P('M-30 -124L-27 -134L-22 -126ZM-40 -112L-49 -116L-44 -106ZM-40 -86L-49 -82L-43 -92ZM-30 -74L-27 -64L-22 -72Z', '#E8F6FF') : '') +
        (r === 4 ? P('M-3 -77C-22 -70 -34 -58 -36 -46C-26 -56 -14 -62 -3 -64Z', p.metal) + P('M-3 -124C-22 -131 -34 -143 -36 -155C-26 -145 -14 -139 -3 -137Z', p.metal) : '') + '</g>';
      let out = shaft(r === 0 ? -112 : -118, 40) + R(-4, 6, 8, 26, LEATHER, 2) + blade(1);
      if (r >= 2) out += blade(-1);
      if (r === 1) out += P('M3 -110L21 -101L3 -92Z', p.lo);
      if (r >= 3) out += P('M-4.5 -122L0 -146L4.5 -122Z', p.metal) + P('M-4.5 -122L0 -146V-122Z', p.hi);
      out += R(-5.5, r === 0 ? -116 : -126, 11, 6, r === 0 ? p.lo : p.trim, 2) + R(-5.5, r === 0 ? -90 : -80, 11, 6, r === 0 ? p.lo : p.trim, 2);
      if (r >= 2) out += C(0, -101, r === 4 ? 4.4 : 3.2, p.gem, r === 4 ? ' class="glint"' : '');
      return out;
    },
  },
  // studded club, flanged mace, spiked morning star, heavy long-spiked head, haloed star
  mace: {
    top: -158, bot: 42, ibot: -44,
    draw(r, p) {
      if (r === 0) {
        return P('M-4 36L-10 -108Q-11 -134 0 -134Q11 -134 10 -108L4 36Z', WOOD) + P('M-4 36L-10 -108Q-11 -134 0 -134V36Z', WOOD_HI) +
          R(-4.5, 6, 9, 26, LEATHER, 2) + [[-4, -118], [4, -104], [-3, -90], [5, -124]].map(([x, y]) => C(x, y, 2.6, '#9A9DB0')).join('');
      }
      const cy = -120;
      let out = shaft(-106, 40, false) + R(-4, 6, 8, 26, LEATHER, 2);
      if (r === 1) {
        out += P('M-7 -138L-20 -128V-112L-7 -102Z', p.metal) + P('M7 -138L20 -128V-112L7 -102Z', p.lo) + R(-7, -140, 14, 40, p.metal, 3) + R(-7, -140, 6, 40, p.hi, 3) + R(-1.5, -144, 3, 8, p.lo, 1) + R(-5.5, -104, 11, 6, p.trim, 2);
        return out;
      }
      const rad = [0, 0, 15, 18, 19][r], n = [0, 0, 8, 10, 12][r], reach = rad + [0, 0, 9, 15, 13][r];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2, w = 0.2;
        const pt = (ang, d) => `${f(Math.cos(ang) * d)} ${f(cy + Math.sin(ang) * d)}`;
        out += P(`M${pt(a - w, rad - 2)}L${pt(a, reach)}L${pt(a + w, rad - 2)}Z`, i % 2 ? p.lo : p.metal);
      }
      out += C(0, cy, rad, p.metal) + C(-rad * 0.28, cy - rad * 0.3, rad * 0.58, p.hi, ' opacity=".75"') + C(0, cy, 4.2, p.gem, r >= 3 ? ' class="glint"' : '');
      if (r === 3) out += [0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2; return C(Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5, 2, p.lo); }).join('');
      if (r === 4) out += P(`M-34 ${cy}a34 10 0 1 0 68 0a34 10 0 1 0 -68 0ZM-28 ${cy}a28 6.5 0 1 1 56 0a28 6.5 0 1 1 -56 0Z`, p.hi, ' fill-rule="evenodd" opacity=".9"');
      out += R(-5.5, cy + rad - 2, 11, 6, p.trim, 2);
      return out;
    },
  },
  // bare pike, halberd, long-bladed glaive, winged lance with a hook, twin-crescent with a pennant
  halberd: {
    top: -212, bot: 46, ibot: -76,
    draw(r, p) {
      let out = shaft(-162, 44) + R(-4, 4, 8, 22, LEATHER, 2);
      const axe = (side, k = 1) => `<g transform="translate(0 -138) scale(${side * k} ${k}) translate(0 138)">` +
        P('M-3 -156C-20 -161 -35 -150 -39 -136C-35 -123 -20 -114 -3 -121Z', p.metal) + P('M-3 -156C-20 -161 -35 -150 -39 -136L-3 -138Z', p.hi) +
        P('M-34 -151C-42 -141 -42 -131 -34 -121C-37 -131 -37 -141 -34 -151Z', '#fff', ' opacity=".7"') + '</g>';
      if (r === 2) { // a glaive: one long single-edged blade
        out += P('M-5 -160C-20 -178 -16 -204 4 -212C0 -192 9 -176 6 -160Z', p.metal) + P('M-5 -160C-20 -178 -16 -204 4 -212C-4 -194 -2 -176 0 -160Z', p.hi) + P('M5 -166L22 -160L15 -150L5 -152Z', p.lo);
      } else {
        const tall = r >= 3 ? 46 : 36;
        out += P(`M-6.5 -160L0 ${-160 - tall}L6.5 -160Z`, p.metal) + P(`M-6.5 -160L0 ${-160 - tall}V-160Z`, p.hi);
      }
      if (r === 0) out += P('M-14 -160H14L10 -154H-10Z', p.lo);
      if (r === 1) out += axe(1) + P('M3 -148L18 -142L3 -136Z', p.lo);
      if (r === 3) out += axe(1) + P('M3 -152L24 -148L16 -134L3 -136Z', p.lo) + P('M16 -134L27 -122L10 -130Z', p.lo) + P('M-7 -164L-22 -178L-9 -158ZM7 -164L22 -178L9 -158Z', p.metal);
      if (r === 4) out += axe(1, 1.1) + axe(-1, 1.1) + P('M4 -116C20 -112 20 -96 30 -92C22 -88 12 -92 8 -100C8 -106 6 -110 4 -112Z', p.gem, ' class="glint"');
      out += R(-5.5, -164, 11, 5, r === 0 ? p.lo : p.trim, 2) + R(-5.5, -122, 11, 5, r === 0 ? p.lo : p.trim, 2);
      if (r >= 3) out += C(0, -142, 3.4, p.gem, ' class="glint"');
      return out;
    },
  },
};

function weaponArt(type, r) {
  return WEAPON[type].draw(r, PAL[r]);
}

// ---------- armour, drawn where it sits on the hero (viewBox 0 -56 200 330) ----------
const ARMOR = {
  helm(r, p) {
    if (r === 0) return P('M84 50C84 26 116 26 116 50V54H84Z', SOFT.metal) + P('M84 50C84 30 100 26 100 26V54H84Z', SOFT.hi, ' opacity=".5"') + R(84, 50, 32, 4, SOFT.lo);
    if (r === 1) {
      return P('M83 52C83 24 117 24 117 52V62H111V52H89V62H83Z', p.metal) + P('M83 52C83 30 100 24 100 24V52H89V62H83Z', p.hi, ' opacity=".6"') +
        R(98, 46, 4, 16, p.lo, 1) + R(83, 48, 34, 4, p.lo);
    }
    const closed = P('M82 46C82 22 118 22 118 46V66L100 73L82 66Z', p.metal) + P('M82 46C82 28 100 22 100 22V73L82 66Z', p.hi, ' opacity=".55"') +
      R(87, 47, 26, 5, INK, 1) + R(98, 22, 4, 26, p.lo, 1) + R(94, 58, 2, 6, p.lo) + R(104, 58, 2, 6, p.lo);
    if (r === 2) return P('M100 23C104 6 122 8 124 22C114 16 106 20 100 23Z', p.trim) + closed;
    const eyes = R(90, 48, 6, 3, p.gem, 1, ' class="glint"') + R(104, 48, 6, 3, p.gem, 1, ' class="glint"');
    if (r === 3) {
      return P('M86 38C70 34 64 18 71 8C73 22 80 30 90 32Z', BONE) + P('M114 38C130 34 136 18 129 8C127 22 120 30 110 32Z', BONE) +
        P('M86 38C74 32 70 20 71 8C75 22 82 28 90 32Z', '#000', ' opacity=".14"') + closed + eyes;
    }
    return closed + eyes + P('M83 32L87 10L94 26L100 4L106 26L113 10L117 32Z', p.hi) + P('M83 32L87 10L94 26L100 4V32Z', '#fff', ' opacity=".4"') +
      R(83, 30, 34, 5, p.lo, 2) + C(100, 33, 3.6, p.gem, ' class="glint"');
  },
  chest(r, p) {
    const q = r === 0 ? SOFT : p;
    let out = P('M71 81H129L123 147H77Z', q.metal) + P('M71 81H100V147H77Z', q.hi, ' opacity=".4"');
    if (r === 0) out += [86, 100, 114].map(x => R(x - 0.8, 84, 1.6, 60, q.lo, 0, ' opacity=".6"')).join('') + R(71, 81, 58, 5, q.lo);
    if (r === 1) out += [92, 102, 112, 122, 132].map(y => R(74, y, 52, 2.2, q.lo, 0, ' opacity=".45"')).join('') + P('M88 81H112L100 96Z', q.lo);
    if (r >= 2) {
      const spike = r >= 3 ? P('M60 80L56 62L70 76Z', q.metal) + P('M140 80L144 62L130 76Z', q.metal) : '';
      out += P('M100 81V147', 'none') + R(99, 84, 2, 60, q.lo, 1, ' opacity=".5"') + P('M77 128H123L123 147H77Z', q.lo, ' opacity=".35"') +
        spike + `<ellipse cx="67" cy="86" rx="14" ry="10" fill="${q.metal}"/><ellipse cx="64" cy="83" rx="9" ry="5" fill="${q.hi}" opacity=".7"/>` +
        `<ellipse cx="133" cy="86" rx="14" ry="10" fill="${q.metal}"/><ellipse cx="130" cy="83" rx="9" ry="5" fill="${q.hi}" opacity=".7"/>` +
        R(71, 79, 58, 4, q.trim, 2);
    }
    if (r === 3) out += [96, 110, 124].map((y, i) => [82, 94, 106, 118].map(x => P(`M${x + (i % 2) * 6 - 6} ${y}a6 6 0 0 0 12 0Z`, q.lo, ' opacity=".55"')).join('')).join('');
    if (r === 4) out += P('M100 98L110 109L100 124L90 109Z', q.gem, ' class="glint"') + P('M100 98L90 109H100Z', '#fff', ' opacity=".45"') + P('M84 92L94 104L84 100Z', q.hi) + P('M116 92L106 104L116 100Z', q.hi);
    return out;
  },
  // Bracers and gauntlets are drawn once, in their own frame, and placed on each arm by the hero's pose.
  // One bracer: elbow at the origin, wrist at (0, 28), the outer side of the arm toward -x.
  arms(r, p) {
    const q = r === 0 ? SOFT : p;
    let out = P('M-6.8 2H6.8L6 26H-6Z', q.metal) + P('M-6.8 2H0V26H-6Z', q.hi, ' opacity=".6"');
    if (r === 0) out += [9, 15, 21].map(y => R(-6.6, y, 13.2, 1.6, q.lo, 0, ' opacity=".6"')).join('');
    if (r >= 1) out += R(-7.8, 1, 15.6, 4.2, q.trim, 1.5);
    if (r >= 2) out += R(-6.6, 22, 13.2, 3.4, q.trim, 1.5) + R(-1, 6, 2, 15, q.lo, 1, ' opacity=".6"');
    if (r >= 3) out += P('M-6 9L-16 6L-6 18Z', q.metal);
    if (r === 4) out += P('M-6 17L-14 22L-6 24Z', q.metal) + P('M-7.8 1L-12 -6L-2 1Z', q.hi);
    if (r === 4) out += C(0, 15, 2.6, q.gem, ' class="glint"');
    return out;
  },
  // One gauntlet: the fist at the origin, the wrist toward -y, the outer side toward -x.
  hands(r, p) {
    const q = r === 0 ? SOFT : p;
    let out = C(0, 0, r === 0 ? 7.6 : 8.5, q.metal) + C(-2, -2, 4.5, q.hi, ' opacity=".65"');
    if (r === 0) out += R(-5, -9.5, 10, 3, q.lo, 1.5);
    if (r >= 1) out += R(-6.5, -12, 13, 6, q.lo, 2) + R(-6.5, -10, 13, 2, q.trim, 1);
    if (r >= 2) out += [-4.6, -1.2, 2.2].map(x => R(x, 2.4, 2.6, 4.4, q.lo, 1, ' opacity=".7"')).join('');
    if (r >= 3) out += P('M-7 -3L-17 -1L-7 4Z', q.metal) + P('M-4 6L-6 15L2 8Z', q.metal);
    if (r === 4) out += P('M-6 -11C-18 -14 -22 -24 -18 -30C-15 -22 -10 -18 -3 -16Z', '#FFF6D6');
    if (r === 4) out += C(0, 0, 2.8, q.gem, ' class="glint"');
    return out;
  },
  belt(r, p) {
    const q = r <= 1 ? SOFT : p;
    let out = R(75, 143, 50, 10, r === 0 ? '#9C8A6A' : q.lo, 2) + R(75, 143, 25, 4, '#fff', 2, ' opacity=".18"');
    if (r === 0) out += C(100, 148, 4, '#7A6A4E') + P('M100 152L96 166L101 164L104 168Z', '#9C8A6A');
    if (r === 1) out += R(94, 141.5, 12, 13, PAL[1].metal, 2) + R(97, 144.5, 6, 7, SOFT.lo, 1);
    if (r >= 2) out += `<ellipse cx="100" cy="148" rx="${r >= 4 ? 16 : 13}" ry="${r >= 4 ? 10 : 8}" fill="${q.hi}"/><ellipse cx="100" cy="148" rx="${r >= 4 ? 12 : 9}" ry="${r >= 4 ? 6.5 : 5}" fill="${q.metal}"/>` + C(100, 148, r >= 3 ? 3.6 : 2.6, q.gem, r >= 3 ? ' class="glint"' : '') +
      (r === 3 ? [79, 85, 115, 121].map(x => C(x, 148, 2.2, q.hi)).join('') + P('M100 156L94 168L100 164L106 168Z', q.metal) : '') +
      (r === 4 ? P('M84 148L78 142L78 154ZM116 148L122 142L122 154Z', q.hi) : '');
    return out;
  },
  boots(r, p) {
    const q = r <= 1 ? SOFT : p;
    const tone = r === 0 ? { ...SOFT, metal: '#6E5943', hi: '#8E765A' } : q;
    let out = P('M78 208H98V250H68L71 240L79 234Z', tone.metal) + P('M78 208H88V250H68L71 240L79 234Z', tone.hi, ' opacity=".5"') +
      P('M102 208H122L121 234L129 240L132 250H102Z', tone.metal) + P('M102 208H112V250H102Z', tone.hi, ' opacity=".5"') +
      R(76, 205, 24, 6, tone.lo, 2) + R(100, 205, 24, 6, tone.lo, 2) + R(66, 247, 33, 4, INK, 2) + R(101, 247, 33, 4, INK, 2);
    if (r === 0) out += R(82, 222, 9, 9, '#000', 2, ' opacity=".2"') + R(110, 236, 8, 7, '#fff', 2, ' opacity=".16"');
    if (r === 1) out += R(75, 203, 26, 9, tone.hi, 3) + R(99, 203, 26, 9, tone.hi, 3) + R(77, 226, 22, 3.4, tone.lo, 1.5) + R(101, 226, 22, 3.4, tone.lo, 1.5) + R(86, 224.5, 5, 6.4, PAL[1].metal, 1) + R(109, 224.5, 5, 6.4, PAL[1].metal, 1);
    if (r >= 2) out += R(80, 216, 16, 3, q.trim, 1) + R(104, 216, 16, 3, q.trim, 1) + C(88, 228, 2.4, q.gem) + C(112, 228, 2.4, q.gem) + P('M78 208L88 200L98 208Z', q.metal) + P('M102 208L112 200L122 208Z', q.metal);
    if (r === 3) out += P('M78 214L68 208L78 224Z', q.metal) + P('M122 214L132 208L122 224Z', q.metal);
    if (r === 4) out += P('M77 212C62 208 56 196 60 188C64 198 70 202 78 204Z', '#FFF6D6') + P('M123 212C138 208 144 196 140 188C136 198 130 202 122 204Z', '#FFF6D6') + P('M77 218C66 216 60 208 62 202C66 210 72 212 78 212Z', '#FFE99A') + P('M123 218C134 216 140 208 138 202C134 210 128 212 122 212Z', '#FFE99A');
    return out;
  },
};
// The cloak hangs behind everything else.
ARMOR.cloak = (r) => {
  const col = ['#7C6F64', '#2F8F57', '#2F5FD0', '#4A2A8A', '#F2D27A'][r];
  const hem = r === 3 ? 'L138 236L128 248L116 236L104 248L92 236L80 248L68 236L54 246' : 'H54';
  return '<g class="cloak">' +
    P(`M66 82H134C148 130 154 200 146 246${hem}C46 200 52 130 66 82Z`, col) +
    P('M66 82H88C78 130 74 190 80 246H54C46 200 52 130 66 82Z', '#fff', ' opacity=".16"') +
    (r === 0 ? R(120, 180, 16, 16, '#000', 2, ' opacity=".18"') + R(60, 150, 12, 12, '#fff', 2, ' opacity=".14"') : '') +
    (r === 1 ? P('M51 232C52 238 53 242 54 246H146C147 242 148 238 149 232Z', '#fff', ' opacity=".28"') + C(100, 82, 4.5, PAL[1].metal) : '') +
    (r === 2 ? P('M56 200C54 190 54 180 54 172L146 172C146 180 146 190 144 200Z', '#fff', ' opacity=".16"') : '') +
    (r === 4 ? P('M100 120L112 150L100 196L88 150Z', '#fff', ' opacity=".35"') : '') +
    (r >= 2 ? R(60, 78, 80, 6, PAL[r].trim, 3) : '') +
    (r === 4 ? P('M62 82L52 64L76 78Z', '#FFF6D6') + P('M138 82L148 64L124 78Z', '#FFF6D6') : '') + '</g>';
};

// Where each armour slot sits on the hero, for framing its icon.
const FRAME = {
  helm: '64 0 72 78', chest: '48 56 104 96', arms: '-20 -5 38 38', hands: '-20 -17 36 36',
  cloak: '20 60 160 192', belt: '68 124 64 48', boots: '52 184 96 70',
};

// ---------- the hero ----------
const SKIN = '#E3B98F', SKIN_LO = '#C99A70', TUNIC = '#4B4699', TUNIC_HI = '#6D63D9', TROUSERS = '#2F2B66', HAIR = '#231F47';

// Arms are two bones each, placed by where the hand needs to be, so the hero can take a stance.
const UPPER = 38, FORE = 31, SHOULDER = { l: [65, 86], r: [135, 86] };
const STANCE = {
  // weapon upright in the hero's right hand (on our left), other arm at rest
  one: { l: [48, 152], r: [152, 153], grip: [46, 150], tilt: 0 },
  // both hands on a long grip, blade angled up past the shoulder
  two: { l: [78, 148.4], r: [88.5, 130.2], grip: [84, 138], tilt: 30 },
};
// Where the elbow sits for a hand at `hand`. side: -1 bends toward our left, +1 toward our right.
function elbow(shoulder, hand, side) {
  const dx = hand[0] - shoulder[0], dy = hand[1] - shoulder[1], reach = Math.hypot(dx, dy);
  const d = Math.min(reach, UPPER + FORE - 0.5), ux = dx / reach, uy = dy / reach;
  const along = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d), off = Math.sqrt(Math.max(0, UPPER * UPPER - along * along));
  const mx = shoulder[0] + ux * along, my = shoulder[1] + uy * along;
  const a = [mx - uy * off, my + ux * off], b = [mx + uy * off, my - ux * off];
  return (a[0] - b[0]) * side > 0 ? a : b;
}
const quad = (a, b, wa, wb, fill) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  return P(`M${f(a[0] + nx * wa)} ${f(a[1] + ny * wa)}L${f(a[0] - nx * wa)} ${f(a[1] - ny * wa)}L${f(b[0] - nx * wb)} ${f(b[1] - ny * wb)}L${f(b[0] + nx * wb)} ${f(b[1] + ny * wb)}Z`, fill);
};

// equip: { slot: itemId }. Layers run back to front: cloak, legs, body, armour, weapon, arms, hands.
export function heroSvg(equip = {}, { size = 260 } = {}) {
  const it = (slot) => (equip[slot] ? ITEMS[equip[slot]] : null);
  const gear = (item, art) => `<g class="gear r${item.rarity}">${art}</g>`;
  const piece = (slot) => { const item = it(slot); return item ? gear(item, ARMOR[slot](item.rarity, PAL[item.rarity])) : ''; };
  const weapon = it('weapon');
  const stance = STANCE[weapon?.line === 'zweihander' ? 'two' : 'one'];
  const bracer = it('arms'), glove = it('hands');
  // One whole arm: sleeve, forearm, bracer, then the hand and gauntlet in a separate layer on top.
  const arm = (side) => {
    const s = SHOULDER[side], h = stance[side], dir = side === 'l' ? -1 : 1, e = elbow(s, h, dir);
    const len = Math.hypot(h[0] - e[0], h[1] - e[1]), turn = f(Math.atan2(h[1] - e[1], h[0] - e[0]) * 180 / Math.PI - 90);
    const flip = side === 'l' ? 1 : -1, skin = side === 'l' ? SKIN : SKIN_LO;
    return {
      limb: quad(s, e, 7, 6.6, TUNIC) + C(e[0], e[1], 6.6, TUNIC) +
        `<g transform="translate(${f(e[0])} ${f(e[1])}) rotate(${turn}) scale(${flip} ${f(len / 28)})">${P('M-6.2 0H6.2L5.4 28H-5.4Z', skin)}${bracer ? gear(bracer, ARMOR.arms(bracer.rarity, PAL[bracer.rarity])) : ''}</g>`,
      hand: `<g transform="translate(${f(h[0])} ${f(h[1])}) rotate(${turn}) scale(${flip} 1)">${C(0, 0, 7, skin)}${glove ? gear(glove, ARMOR.hands(glove.rarity, PAL[glove.rarity])) : ''}</g>`,
    };
  };
  const left = arm('l'), right = arm('r');
  const held = weapon ? `<g class="gear weapon r${weapon.rarity}" transform="translate(${stance.grip[0]} ${stance.grip[1]}) rotate(${stance.tilt})">${weaponArt(weapon.line, weapon.rarity)}</g>` : '';
  const body =
    P('M77 152H99L97 234H80Z', TROUSERS) + P('M101 152H123L120 234H103Z', TROUSERS) + P('M77 152H88L88 234H80Z', '#fff', ' opacity=".1"') +
    P('M78 230H98V250H70L72 242Z', HAIR) + P('M102 230H122L128 242L130 250H102Z', HAIR);
  const torso =
    C(68, 87, 10, TUNIC) + C(132, 87, 10, TUNIC) + P('M70 80H130L124 150H76Z', TUNIC) + P('M70 80H100V150H76Z', TUNIC_HI, ' opacity=".35"') +
    R(76, 144, 48, 9, '#2A2550', 2);
  const head =
    R(94, 62, 12, 12, SKIN_LO, 2) + `<ellipse cx="100" cy="50" rx="15" ry="17" fill="${SKIN}"/>` + P('M100 33a15 17 0 0 1 0 34Z', SKIN_LO, ' opacity=".5"') +
    P('M84 50C82 26 118 26 116 50C112 38 88 38 84 50Z', HAIR) + R(93, 50, 3.4, 4.4, INK, 1) + R(103.6, 50, 3.4, 4.4, INK, 1);
  return `<svg class="hero" viewBox="0 -56 200 330" width="${size}" height="${Math.round(size * 1.65)}" role="img" aria-label="Your hero">
    <ellipse cx="100" cy="258" rx="62" ry="9" fill="#000" opacity=".28"/>
    ${piece('cloak')}
    <g class="bob">
      ${body}${piece('boots')}${torso}${piece('belt')}${piece('chest')}
      ${stance.tilt ? held + head + piece('helm') + left.limb + right.limb : left.limb + right.limb + head + piece('helm') + held}
      ${left.hand}${right.hand}
    </g>
  </svg>`;
}

// ---------- icons ----------
// One item on its own: weapons tilted like a drawn blade, armour framed where it sits on the body.
export function itemIcon(id, size = 64) {
  const item = ITEMS[id];
  if (!item) return '';
  let box, art;
  if (item.slot === 'weapon') {
    const w = WEAPON[item.line], bot = w.ibot ?? w.bot, len = bot - w.top, mid = (w.top + bot) / 2, side = len * 0.82;
    box = `${f(-side / 2)} ${f(mid - side / 2)} ${f(side)} ${f(side)}`;
    art = `<g transform="rotate(38 0 ${f(mid)})">${weaponArt(item.line, item.rarity)}</g>`;
  } else {
    box = FRAME[item.slot];
    art = ARMOR[item.slot](item.rarity, PAL[item.rarity]);
  }
  return `<svg class="icon-art r${item.rarity}" viewBox="${box}" width="${size}" height="${size}" aria-hidden="true">${art}</svg>`;
}

// ---------- the gremlin: one falls with every set ----------
export function gremlinSvg(size = 44) {
  return `<svg class="gremlin" viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true">
    <path d="M14 24L1 12L10 34Z" fill="#3FAE6A"/><path d="M46 24L59 12L50 34Z" fill="#2F8F57"/>
    <ellipse cx="30" cy="33" rx="20" ry="19" fill="#3FAE6A"/><path d="M30 14a20 19 0 0 0 0 38Z" fill="#fff" opacity=".16"/>
    <path d="M17 27L27 31L17 34Z" fill="#FF5A4E" class="eye"/><path d="M43 27L33 31L43 34Z" fill="#FF5A4E" class="eye"/>
    <path d="M20 41H40L37 48H23Z" fill="#15123A"/><path d="M23 41L25.5 45L28 41ZM32 41L34.5 45L37 41Z" fill="#FBFAF5"/>
  </svg>`;
}

// ---------- bosses ----------
// k is the boss's place in the run: every third one is a season boss. Mirrors foeInfo in the engine.
export function bossSvg(k, size = 40) {
  const big = k % 3 === 2;
  const list = big ? BOSS_BIG : BOSS_SMALL;
  const idx = big ? Math.floor(k / 3) : k - Math.floor((k + 1) / 3);
  return `<svg class="boss-art" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">${list[idx % list.length]}</svg>`;
}
