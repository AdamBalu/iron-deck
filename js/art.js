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
  sword: {
    top: -130, bot: 26,
    draw(r, p) {
      const bw = 6.5 + r * 0.7, gw = 17 + r * 2.5;
      return P(`M${-bw} -20V-110L0 -128L${bw} -110V-20Z`, p.metal) + P(`M${-bw} -20V-110L0 -128V-20Z`, p.hi) +
        (r >= 2 ? R(-1, -104, 2, 78, p.lo, 1, ' opacity=".55"') : '') +
        (r >= 3 ? [-92, -74, -56].map(y => P(`M0 ${y - 5}L3 ${y}L0 ${y + 5}L-3 ${y}Z`, '#fff', ' opacity=".85"')).join('') : '') +
        P(`M${-gw} -25H${gw}L${gw - 4} -16H${-gw + 4}Z`, p.trim) + (r >= 2 ? C(-gw, -21, 4, p.trim) + C(gw, -21, 4, p.trim) : '') +
        (r === 4 ? P(`M${-gw} -25C${-gw - 12} -34 ${-gw - 10} -44 ${-gw - 2} -46C${-gw - 4} -38 ${-gw + 2} -30 ${-gw + 8} -25Z`, p.hi) + P(`M${gw} -25C${gw + 12} -34 ${gw + 10} -44 ${gw + 2} -46C${gw + 4} -38 ${gw - 2} -30 ${gw - 8} -25Z`, p.hi) : '') +
        R(-4, -16, 8, 30, LEATHER, 2) + R(-4, -8, 8, 2, WOOD_HI) + R(-4, 0, 8, 2, WOOD_HI) + R(-4, 8, 8, 2, WOOD_HI) +
        C(0, 18, 6.5, p.trim) + (r >= 1 ? C(0, 18, 3, p.gem) : '');
    },
  },
  zweihander: {
    top: -174, bot: 40,
    draw(r, p) {
      const bw = 8.5 + r * 0.7, gw = 27 + r * 2;
      return P(`M${-bw} -46V-152L0 -172L${bw} -152V-46Z`, p.metal) + P(`M${-bw} -46V-152L0 -172V-46Z`, p.hi) +
        R(-1.2, -146, 2.4, 98, p.lo, 1, ' opacity=".5"') +
        (r >= 3 ? [-132, -112, -92, -72].map(y => P(`M0 ${y - 6}L3.5 ${y}L0 ${y + 6}L-3.5 ${y}Z`, '#fff', ' opacity=".85"')).join('') : '') +
        // the ricasso and its parrying hooks: what makes a zweihander a zweihander
        R(-5.5, -46, 11, 20, p.lo) + P(`M${-bw} -50L${-bw - 12} -42L${-bw} -36Z`, p.metal) + P(`M${bw} -50L${bw + 12} -42L${bw} -36Z`, p.metal) +
        P(`M${-gw} -27H${gw}L${gw - 5} -19H${-gw + 5}Z`, p.trim) + C(-gw, -23, 4.5, p.trim) + C(gw, -23, 4.5, p.trim) +
        (r === 4 ? P(`M${-gw} -27L${-gw - 9} -40L${-gw + 7} -27Z`, p.hi) + P(`M${gw} -27L${gw + 9} -40L${gw - 7} -27Z`, p.hi) : '') +
        R(-4, -19, 8, 46, LEATHER, 2) + R(-5, 0, 10, 3.5, p.trim, 1) + [-12, -6, 10, 16].map(y => R(-4, y, 8, 2, WOOD_HI)).join('') +
        P('M0 24L8 32L0 40L-8 32Z', p.trim) + (r >= 1 ? P('M0 28L4 32L0 36L-4 32Z', p.gem) : '');
    },
  },
  hammer: {
    top: -152, bot: 42, ibot: -36,
    draw(r, p) {
      const hw = 22 + r * 2.2, hh = 30 + r * 2, y = -138;
      const wooden = r === 0;
      const head = wooden ? { metal: WOOD, hi: WOOD_HI, lo: LEATHER } : p;
      return shaft(-112, 40) + R(-4, 6, 8, 26, LEATHER, 2) +
        R(-hw, y, hw * 2, hh, head.metal, 4) + R(-hw, y, hw * 2, hh * 0.42, head.hi, 4) +
        R(-hw + 5, y, 4.5, hh, head.lo) + R(hw - 9.5, y, 4.5, hh, head.lo) +
        (r >= 3 ? P(`M${-hw} ${y + 5}L${-hw - 11} ${y + hh / 2}L${-hw} ${y + hh - 5}Z`, p.metal) + P(`M${hw} ${y + 5}L${hw + 11} ${y + hh / 2}L${hw} ${y + hh - 5}Z`, p.metal) : '') +
        (r >= 1 ? C(0, y + hh / 2, 5.5, p.trim) : '') + (r >= 2 ? C(0, y + hh / 2, 2.8, p.gem) : '') +
        (r === 4 ? P(`M-6 ${y}L0 ${y - 12}L6 ${y}Z`, p.hi) : '') +
        R(-5, y + hh - 1, 10, 6, wooden ? LEATHER : p.trim, 2);
    },
  },
  axe: {
    top: -146, bot: 42, ibot: -34,
    draw(r, p) {
      const blade = (s) => `<g${s < 0 ? ' transform="scale(-1 1)"' : ''}>` +
        P('M-3 -124C-24 -130 -42 -117 -47 -99C-42 -82 -24 -70 -3 -77Z', p.metal) +
        P('M-3 -124C-24 -130 -42 -117 -47 -99L-3 -101Z', p.hi) +
        P('M-41 -117C-50 -105 -50 -93 -41 -81C-45 -93 -45 -105 -41 -117Z', '#fff', ' opacity=".7"') + '</g>';
      return shaft(-118, 40) + R(-4, 6, 8, 26, LEATHER, 2) + blade(1) +
        (r >= 2 ? blade(-1) : P('M3 -110L20 -101L3 -92Z', p.lo)) +
        (r >= 3 ? P('M-4.5 -120L0 -139L4.5 -120Z', p.metal) + P('M-4.5 -120L0 -139V-120Z', p.hi) : '') +
        R(-5.5, -126, 11, 6, p.trim, 2) + R(-5.5, -80, 11, 6, p.trim, 2) + (r >= 1 ? C(0, -101, 3.2, p.gem) : '');
    },
  },
  mace: {
    top: -152, bot: 42, ibot: -44,
    draw(r, p) {
      const wooden = r === 0, rad = 15 + r * 1.2, cy = -120;
      const head = wooden ? { metal: WOOD, hi: WOOD_HI, lo: LEATHER } : p;
      const n = r >= 2 ? 8 : 6;
      let spikes = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2, len = rad + (r >= 3 ? 13 : 9), w = 0.2;
        const pt = (ang, d) => `${f(Math.cos(ang) * d)} ${f(cy + Math.sin(ang) * d)}`;
        spikes += P(`M${pt(a - w, rad - 2)}L${pt(a, len)}L${pt(a + w, rad - 2)}Z`, wooden ? '#8A8DA0' : p.lo);
      }
      return shaft(-106, 40, wooden) + R(-4, 6, 8, 26, LEATHER, 2) + spikes +
        C(0, cy, rad, head.metal) + C(-rad * 0.28, cy - rad * 0.3, rad * 0.58, head.hi, ' opacity=".75"') +
        (r >= 2 ? C(0, cy, 4, p.gem) : '') + R(-5.5, cy + rad - 2, 11, 6, wooden ? LEATHER : p.trim, 2);
    },
  },
  halberd: {
    top: -200, bot: 46, ibot: -72,
    draw(r, p) {
      return shaft(-162, 44) + R(-4, 4, 8, 22, LEATHER, 2) +
        P('M-6.5 -160L0 -196L6.5 -160Z', p.metal) + P('M-6.5 -160L0 -196V-160Z', p.hi) +
        (r >= 1 ? P('M-3 -156C-20 -161 -35 -150 -39 -136C-35 -123 -20 -114 -3 -121Z', p.metal) + P('M-3 -156C-20 -161 -35 -150 -39 -136L-3 -138Z', p.hi) : '') +
        (r >= 2 ? P('M3 -152L22 -147L15 -135L3 -136Z', p.lo) + P('M15 -135L24 -124L10 -130Z', p.lo) : '') +
        (r >= 3 ? P('M-34 -151C-42 -141 -42 -131 -34 -121C-37 -131 -37 -141 -34 -151Z', '#fff', ' opacity=".7"') : '') +
        R(-5.5, -164, 11, 5, p.trim, 2) + R(-5.5, -122, 11, 5, p.trim, 2) +
        (r >= 3 ? C(0, -142, 3.2, p.gem) : '') +
        (r === 4 ? P('M4 -118C14 -112 12 -98 6 -92C8 -100 6 -108 2 -112Z', p.gem) : '');
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
  arms(r, p) {
    const q = r === 0 ? SOFT : p;
    let out = P('M49 124L62 127L57 149L45 147Z', q.metal) + P('M49 124L55 125.5L51 148L45 147Z', q.hi, ' opacity=".6"') +
      P('M138 127L151 124L155 147L143 149Z', q.metal) + P('M138 127L144 125.5L149 148L143 149Z', q.hi, ' opacity=".6"');
    if (r === 0) out += [130, 136, 142].map(y => R(46, y, 14, 1.6, q.lo, 0, ' opacity=".6" transform="rotate(8 53 ' + y + ')"') + R(140, y, 14, 1.6, q.lo, 0, ' opacity=".6" transform="rotate(-8 147 ' + y + ')"')).join('');
    if (r >= 1) out += P('M48 124L63 127.5L62 131L47 127.5Z', q.trim) + P('M137 127.5L152 124L153 127.5L138 131Z', q.trim);
    if (r >= 3) out += P('M46 134L37 130L46 141Z', q.metal) + P('M154 134L163 130L154 141Z', q.metal);
    if (r === 4) out += C(52, 137, 2.6, q.gem, ' class="glint"') + C(148, 137, 2.6, q.gem, ' class="glint"');
    return out;
  },
  hands(r, p) {
    const q = r === 0 ? SOFT : p;
    let out = C(48, 153, 8.5, q.metal) + C(46, 151, 4.5, q.hi, ' opacity=".65"') + C(150, 154, 8.5, q.metal) + C(148, 152, 4.5, q.hi, ' opacity=".65"') +
      R(43, 143, 12, 5, q.lo, 2, ' transform="rotate(8 49 145)"') + R(145, 144, 12, 5, q.lo, 2, ' transform="rotate(-8 151 146)"');
    if (r >= 3) out += P('M41 151L32 153L41 157Z', q.metal) + P('M157 152L166 154L157 158Z', q.metal) + P('M44 159L42 167L49 161Z', q.metal) + P('M154 160L156 168L149 162Z', q.metal);
    if (r === 4) out += C(48, 153, 2.8, q.gem, ' class="glint"') + C(150, 154, 2.8, q.gem, ' class="glint"');
    return out;
  },
  belt(r, p) {
    const q = r <= 1 ? SOFT : p;
    let out = R(75, 143, 50, 10, r === 0 ? '#9C8A6A' : q.lo, 2) + R(75, 143, 25, 4, '#fff', 2, ' opacity=".18"');
    if (r === 0) out += C(100, 148, 4, '#7A6A4E') + P('M100 152L96 166L101 164L104 168Z', '#9C8A6A');
    if (r === 1) out += R(94, 141.5, 12, 13, PAL[1].metal, 2) + R(97, 144.5, 6, 7, SOFT.lo, 1);
    if (r >= 2) out += `<ellipse cx="100" cy="148" rx="${r >= 4 ? 16 : 13}" ry="${r >= 4 ? 10 : 8}" fill="${q.hi}"/><ellipse cx="100" cy="148" rx="${r >= 4 ? 12 : 9}" ry="${r >= 4 ? 6.5 : 5}" fill="${q.metal}"/>` + C(100, 148, r >= 3 ? 3.6 : 2.6, q.gem, r >= 3 ? ' class="glint"' : '');
    return out;
  },
  boots(r, p) {
    const q = r <= 1 ? SOFT : p;
    const tone = r === 0 ? { ...SOFT, metal: '#6E5943', hi: '#8E765A' } : q;
    let out = P('M78 208H98V250H68L71 240L79 234Z', tone.metal) + P('M78 208H88V250H68L71 240L79 234Z', tone.hi, ' opacity=".5"') +
      P('M102 208H122L121 234L129 240L132 250H102Z', tone.metal) + P('M102 208H112V250H102Z', tone.hi, ' opacity=".5"') +
      R(76, 205, 24, 6, tone.lo, 2) + R(100, 205, 24, 6, tone.lo, 2) + R(66, 247, 33, 4, INK, 2) + R(101, 247, 33, 4, INK, 2);
    if (r >= 2) out += R(80, 216, 16, 3, q.trim, 1) + R(104, 216, 16, 3, q.trim, 1) + C(88, 228, 2.4, q.gem) + C(112, 228, 2.4, q.gem);
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
    (r >= 2 ? R(60, 78, 80, 6, PAL[r].trim, 3) : '') +
    (r === 4 ? P('M62 82L52 64L76 78Z', '#FFF6D6') + P('M138 82L148 64L124 78Z', '#FFF6D6') : '') + '</g>';
};

// Where each armour slot sits on the hero, for framing its icon.
const FRAME = {
  helm: '64 0 72 78', chest: '48 56 104 96', arms: '30 118 40 36', hands: '28 138 40 34',
  cloak: '20 60 160 192', belt: '68 124 64 48', boots: '52 184 96 70',
};

// ---------- the hero ----------
const SKIN = '#E3B98F', SKIN_LO = '#C99A70', TUNIC = '#4B4699', TUNIC_HI = '#6D63D9', TROUSERS = '#2F2B66', HAIR = '#231F47';

// equip: { slot: itemId }. Layers run back to front: cloak, legs, body, armour, weapon, hand.
export function heroSvg(equip = {}, { size = 260 } = {}) {
  const it = (slot) => (equip[slot] ? ITEMS[equip[slot]] : null);
  const piece = (slot) => { const item = it(slot); return item ? `<g class="gear r${item.rarity}">${ARMOR[slot](item.rarity, PAL[item.rarity])}</g>` : ''; };
  const weapon = it('weapon');
  const body =
    P('M77 152H99L97 234H80Z', TROUSERS) + P('M101 152H123L120 234H103Z', TROUSERS) + P('M77 152H88L88 234H80Z', '#fff', ' opacity=".1"') +
    P('M78 230H98V250H70L72 242Z', HAIR) + P('M102 230H122L128 242L130 250H102Z', HAIR);
  const torso =
    C(68, 87, 10, TUNIC) + C(132, 87, 10, TUNIC) + P('M70 80H130L124 150H76Z', TUNIC) + P('M70 80H100V150H76Z', TUNIC_HI, ' opacity=".35"') +
    R(76, 144, 48, 9, '#2A2550', 2);
  const arms =
    P('M59 84L72 88L62 124L49 120Z', TUNIC) + P('M128 88L141 84L151 120L138 124Z', TUNIC) +
    P('M49 122L62 125L56 150L44 148Z', SKIN) + P('M138 125L151 122L156 148L144 150Z', SKIN_LO);
  const head =
    R(94, 62, 12, 12, SKIN_LO, 2) + `<ellipse cx="100" cy="50" rx="15" ry="17" fill="${SKIN}"/>` + P('M100 33a15 17 0 0 1 0 34Z', SKIN_LO, ' opacity=".5"') +
    P('M84 50C82 26 118 26 116 50C112 38 88 38 84 50Z', HAIR) + R(93, 50, 3.4, 4.4, INK, 1) + R(103.6, 50, 3.4, 4.4, INK, 1);
  return `<svg class="hero" viewBox="0 -56 200 330" width="${size}" height="${Math.round(size * 1.65)}" role="img" aria-label="Your hero">
    <ellipse cx="100" cy="258" rx="62" ry="9" fill="#000" opacity=".28"/>
    ${piece('cloak')}
    <g class="bob">
      ${body}${piece('boots')}${torso}${piece('belt')}${piece('chest')}${arms}${piece('arms')}
      ${head}${piece('helm')}
      ${weapon ? `<g class="gear weapon r${weapon.rarity}" transform="translate(46 150)">${weaponArt(weapon.line, weapon.rarity)}</g>` : ''}
      ${C(48, 153, 7, SKIN)}${C(150, 154, 7, SKIN_LO)}${piece('hands')}
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
