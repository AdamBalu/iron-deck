// Boss portraits, drawn in code. Each entry is the inner markup for a 120x120 viewBox.
// Same style as art.js: flat shapes, a lighter facet upper-left, a darker one lower-right, no outlines.
// No ids anywhere, so several portraits can share a page. Every eye glow carries class="eye".
// Small bosses have coral eyes and one accent colour each; season bosses have gold eyes and a crown.

const INK = '#15123A', DEEP = '#3B3590', MID = '#5148B8', BODY = '#6D63D9', PALE = '#8F86EA', BONE = '#FBFAF5';
const CORAL = '#FF5A4E', GOLD = '#FFD23F', SKY = '#4CC9F0', MINT = '#58E0A0', ORANGE = '#FF9F1C', LILAC = '#B79CFF';

const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const C = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`;
const R = (x, y, w, h, fill, rx = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${extra}/>`;
const op = (o) => ` opacity="${o}"`;
const hi = (d, o = 0.18) => P(d, '#fff', op(o));   // lighter facet
const lo = (d, o = 0.18) => P(d, '#000', op(o));   // darker facet
const EYE = ' class="eye"';
const CROWN_SHADE = op(0.6);

// ---------- small bosses ----------

// 0. Couch Gravity (coral): the gap between the seat cushions is its mouth.
const couch = [
  E(60, 106, 44, 5, INK, op(0.7)),
  P('M14 98h11l-2 9h-7zM95 98h11l-2 9h-7z', DEEP),
  P('M20 34Q20 14 40 14H80Q100 14 100 34V78H20Z', MID),
  hi('M20 34Q20 14 40 14H74L20 62Z', 0.16),
  lo('M100 36V78H60Z'),
  P('M26 26L56 38V52H28Z', INK),
  P('M94 26L64 38V52H92Z', INK),
  P('M31 34L52 42.5V48H32Z', CORAL, EYE),
  P('M89 34L68 42.5V48H88Z', CORAL, EYE),
  C(46, 44.5, 2.5, BONE),
  C(74, 44.5, 2.5, BONE),
  P('M28 68H92V92H28Z', INK),
  P('M26 63Q26 56 34 56H86Q94 56 94 63V71H26Z', CORAL),
  hi('M26 63Q26 56 34 56H66L58 71H26Z', 0.25),
  P('M26 89H94V96Q94 101 88 101H32Q26 101 26 96Z', CORAL),
  lo('M64 89H94V96Q94 101 88 101H56Z', 0.2),
  P('M32 71h12l-6 9zM46 71h12l-6 9zM62 71h12l-6 9zM76 71h12l-6 9z', BONE),
  P('M39 89l6-8 6 8zM54 89l6-8 6 8zM69 89l6-8 6 8z', BONE),
  R(7, 46, 23, 56, BODY, 11),
  hi('M7 57Q7 46 18 46Q24 46 27 50L7 82Z', 0.22),
  R(90, 46, 23, 56, BODY, 11),
  hi('M90 57Q90 46 101 46Q105 46 108 48L90 72Z', 0.14),
  lo('M113 60V91Q113 102 102 102Q96 102 93 98Z', 0.22),
].join('');

// 1. The Snooze Button (gold bells): the clock hands are its scowl.
const snooze = [
  P('M32 92l11 6-7 11H26zM88 92l-11 6 7 11h10z', DEEP),
  R(55, 20, 10, 10, DEEP),
  R(47, 10, 26, 12, ORANGE, 4),
  R(50, 12, 11, 4, '#fff', 2, op(0.35)),
  P('M18.6 38.8A18 18 0 0 1 47.4 17.2Z', GOLD),
  hi('M33 28L18.6 38.8A18 18 0 0 1 33 10Z', 0.35),
  P('M101.4 38.8A18 18 0 0 0 72.6 17.2Z', GOLD),
  P('M87 28L101.4 38.8A18 18 0 0 0 97.8 13.6Z', ORANGE, op(0.7)),
  C(60, 66, 38, BODY),
  hi('M22 66A38 38 0 0 1 60 28V66Z', 0.2),
  lo('M98 66A38 38 0 0 1 60 104V66Z', 0.22),
  C(60, 66, 29, BONE),
  P('M89 66A29 29 0 0 1 60 95V66Z', DEEP, op(0.14)),
  P('M58 39h4v7h-4zM33 64h5v4h-5zM82 64h5v4h-5z', DEEP),
  C(48, 69, 8.5, INK),
  C(72, 69, 8.5, INK),
  C(48, 69, 5.5, CORAL, EYE),
  C(72, 69, 5.5, CORAL, EYE),
  C(50, 67, 2, BONE),
  C(74, 67, 2, BONE),
  P('M61.5 62L58.5 66L39.5 52L42.5 48Z', INK),
  P('M61.5 66L58.5 62L78.5 47L81.5 51Z', INK),
  C(60, 64, 4, GOLD),
  P('M48 88Q60 77 72 88L69 91Q60 83 51 91Z', INK),
].join('');

// 2. Later Gator (mint): side view, one heavy-lidded eye, a smile that says "in a bit".
const GATOR_JAW = 'M12 60H104Q104 72 95 75L56 85Q50 100 32 104Q14 98 10 78Q9 68 12 60Z';
const GATOR_LID = 'M26.6 37.5A11.5 11.5 0 0 1 49.4 34.5Z';
const gator = [
  '<g transform="rotate(-8 60 60)">',
  P('M12 53L7 43L16 44ZM16 42L13 31L22 34Z', MINT),
  lo('M12 53L7 43L16 44ZM16 42L13 31L22 34Z', 0.28),
  P(GATOR_JAW, MINT),
  lo(GATOR_JAW, 0.24),
  P('M13 82Q30 93 56 85Q50 100 32 104Q17 99 13 82Z', BONE, op(0.4)),
  P('M12 62Q8 46 18 36L26 26Q38 14 50 25L58 41L90 39Q96 31 104 35Q110 39 112 49Q114 59 106 61Z', MINT),
  hi('M58 41L90 39Q96 31 104 35L108 43L60 49Z', 0.3),
  hi('M18 36L26 26Q38 14 50 25L54 33L14 50Z', 0.16),
  P('M26 50Q24 62 34 59H107L104 67H34Q20 68 21 50Z', INK),
  P('M40 59h9l-4.5 8zM54 59h9l-4.5 8zM68 59h9l-4.5 8zM82 59h9l-4.5 8zM95 59h8l-4 7z', BONE),
  P('M47 67l4.5-6 4.5 6zM75 67l4.5-6 4.5 6z', BONE),
  E(101, 42, 3, 2, INK),
  C(38, 36, 10, BONE),
  C(40, 38, 6, CORAL, EYE),
  E(40, 38, 2, 5, INK),
  P(GATOR_LID, MINT),
  lo(GATOR_LID, 0.2),
  '</g>',
].join('');

// 3. The Scroll Hole (sky): a phone whose screen is a whirlpool with an eye in it.
const SWIRL = 'M60 60Q56 40 72 38A24 24 0 0 1 80.8 72A20 20 0 0 0 68 44Q60 46 60 60Z';
const scroll = [
  '<g transform="rotate(-8 60 60)">',
  R(30, 6, 60, 108, MID, 11),
  hi('M30 17Q30 6 41 6H76L30 70Z', 0.2),
  lo('M90 50V103Q90 114 79 114H52Z', 0.22),
  R(35, 13, 50, 94, INK, 6),
  R(40, 18, 24, 5, DEEP, 2.5),
  R(56, 96, 24, 5, DEEP, 2.5),
  P(SWIRL, BODY, ' transform="rotate(60 60 60)"'),
  P(SWIRL, BODY, ' transform="rotate(180 60 60)"'),
  P(SWIRL, BODY, ' transform="rotate(300 60 60)"'),
  P(SWIRL, SKY),
  P(SWIRL, SKY, ' transform="rotate(120 60 60)"'),
  P(SWIRL, SKY, ' transform="rotate(240 60 60)"'),
  C(60, 60, 10, BONE),
  C(60, 60, 6, CORAL, EYE),
  E(60, 60, 2, 4.5, INK),
  '</g>',
].join('');

// 4. Doctor Too-Tired (lilac): nightcap, head mirror, eyelids at half mast.
const doctor = [
  P('M10 24h11v3l-6.5 5H21v3H10v-3l6.5-5H10z', BONE, op(0.9)),
  P('M22 11h8v2.5l-4.5 3H30V19h-8v-2.5l4.5-3H22z', BONE, op(0.7)),
  P('M24 46Q24 28 60 28Q96 28 96 46L100 84Q100 108 60 110Q20 108 20 84Z', PALE),
  hi('M24 46Q24 28 60 28L48 60L21 78Z'),
  lo('M100 84Q100 108 60 110L78 78Z'),
  P('M22 44Q24 14 60 10Q96 6 106 46L108 64H98Q98 46 86 37L98 44Z', LILAC),
  hi('M22 44Q24 14 60 10L46 44Z', 0.3),
  lo('M79.3 11.6Q99 18 106 46L108 64H98Q98 46 86 37Z', 0.16),
  C(104, 71, 8, BONE),
  R(18, 38, 84, 11, DEEP, 5.5),
  C(40, 37, 10, BONE),
  P('M30 37A10 10 0 0 0 50 37Z', SKY, op(0.5)),
  C(40, 37, 4, DEEP),
  C(43, 66, 11, BONE),
  C(77, 66, 11, BONE),
  C(43, 69, 6, CORAL, EYE),
  C(77, 69, 6, CORAL, EYE),
  C(43, 70, 2.5, INK),
  C(77, 70, 2.5, INK),
  P('M31.8 70.5A12 12 0 1 1 54.9 64.6Z', BODY),
  P('M88.2 70.5A12 12 0 1 0 65.1 64.6Z', BODY),
  P('M32 78Q43 91 54 78Q43 83 32 78Z', DEEP, op(0.55)),
  P('M66 78Q77 91 88 78Q77 83 66 78Z', DEEP, op(0.55)),
  P('M56 72Q60 70 64 72L66 87Q60 91 54 87Z', BODY),
  P('M46 100Q60 89 74 100Q60 95 46 100Z', INK),
].join('');

// 5. Captain Comfort (orange): a pillow in a peaked cap and a blanket cape.
const captain = [
  P('M18 50Q10 80 16 106L30 101L45 108L60 102L75 108L90 101L104 106Q110 80 102 50Z', ORANGE),
  lo('M60 50H102Q110 80 104 106L90 101L75 108L60 102Z', 0.16),
  P('M24 46L34 50Q60 44 86 50L96 46L94 58Q100 76 94 90L97 101L86 98Q60 104 34 98L23 101L26 90Q20 76 26 58Z', PALE),
  hi('M24 46L34 50Q60 44 78 48L26 90Q20 76 26 58Z', 0.22),
  lo('M94 58Q100 76 94 90L97 101L86 98Q70 102 56 100Z'),
  P('M28 30Q28 12 60 12Q92 12 92 30L86 38H34Z', BONE),
  P('M60 12Q92 12 92 30L86 38H60Z', DEEP, op(0.16)),
  R(34, 36, 52, 10, DEEP),
  P('M30 45Q60 36 90 45Q76 54 60 54Q44 54 30 45Z', INK),
  C(60, 29, 7, GOLD),
  P('M60 24l4 5-4 5-4-5z', ORANGE),
  P('M36 60Q46 54 56 59V62.5Q46 58 36 63.5Z', DEEP),
  P('M64 59Q74 54 84 60V63.5Q74 58 64 62.5Z', DEEP),
  P('M36 66H56Q56 77 46 77Q36 77 36 66Z', INK),
  P('M64 66H84Q84 77 74 77Q64 77 64 66Z', INK),
  P('M38.5 68H53.5Q53.5 75 46 75Q38.5 75 38.5 68Z', CORAL, EYE),
  P('M66.5 68H81.5Q81.5 75 74 75Q66.5 75 66.5 68Z', CORAL, EYE),
  C(50, 70.5, 2.5, INK),
  C(78, 70.5, 2.5, INK),
  C(33, 83, 5, CORAL, op(0.4)),
  C(88, 83, 5, CORAL, op(0.4)),
  P('M48 85Q64 93 78 79L80 83Q64 100 48 85Z', INK),
].join('');

// 6. The Cold Floor (sky and white): ice shards breaking up through the tiles.
const cold = [
  P('M10 91H110L95 109H25Z', DEEP),
  P('M10 91H35L39 100H17.5ZM60 91H85L81 100H60ZM39 100H60V109H42.5ZM81 100H102.5L95 109H77.5Z', MID),
  P('M26 34L40 60L42 98H14L16 64Z', BODY),
  hi('M26 34L28 98H14L16 64Z', 0.28),
  P('M94 26L106 60L104 98H76L80 56Z', BODY),
  hi('M94 26L92 98H76L80 56Z', 0.14),
  lo('M94 26L106 60L104 98H92Z', 0.2),
  P('M60 6L80 44L86 98H34L40 44Z', SKY),
  hi('M60 6L58 98H34L40 44Z', 0.32),
  lo('M60 6L80 44L86 98H74L70 46Z', 0.16),
  P('M60 6L68 21L60 27L52 21Z', BONE),
  P('M40 44L57 52V62H42Z', INK),
  P('M80 44L63 52V62H78Z', INK),
  P('M44 50.5L55 55.5V59.5H45Z', CORAL, EYE),
  P('M76 50.5L65 55.5V59.5H75Z', CORAL, EYE),
  P('M44 73L50 69L55 74L60 69L65 74L70 69L76 73L72 86L66 81L60 87L54 81L48 86Z', INK),
  P('M70 79Q80 67 92 71Q98 61 106 67Q112 75 102 79Q98 87 88 83Q78 89 70 79Z', BONE, op(0.88)),
  P('M28 98L37 76L46 98Z', BONE),
  P('M76 98L85 82L92 98Z', BONE),
  P('M20 14l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z', BONE),
].join('');

// 7. The Mirror Doubt (gold frame): a cracked mirror that sneers back.
const mirror = [
  C(46, 21, 6.5, GOLD),
  C(74, 21, 6.5, GOLD),
  C(60, 14, 8, GOLD),
  C(21, 60, 6, GOLD),
  C(99, 60, 6, GOLD),
  P('M49 98L60 113L71 98Z', GOLD),
  E(60, 60, 36, 42, GOLD),
  hi('M24 60A36 42 0 0 1 60 18V60Z', 0.35),
  P('M96 60A36 42 0 0 1 60 102V60Z', ORANGE, op(0.65)),
  C(60, 14, 3.5, CORAL),
  E(60, 60, 28, 34, DEEP),
  hi('M36 44L62 27L70 29L34 54Z', 0.14),
  lo('M88 60A28 34 0 0 1 60 94L72 60Z', 0.2),
  P('M36 46L56 52V56.5L36 50.5Z', PALE),
  P('M65 45Q74 38 84 44L84.5 48Q74 43 65 49Z', PALE),
  P('M38 55L55 58V63H40Z', CORAL, EYE),
  P('M64 54H83Q83 64 73.5 64Q64 64 64 54Z', CORAL, EYE),
  C(50, 60, 2.5, INK),
  C(72, 58, 3, INK),
  P('M44 80Q56 74 75 70L77 77Q62 79 48 87Z', INK),
  P('M59 75.5L73 72L74.5 76L61 79Z', BONE),
  P('M57 26L61 26L58 38L65 46L60 58L62 68L56 59L61 47L53 39Z', BONE),
].join('');

// ---------- season bosses ----------

// Mortar for the wall: a course every 12 units, upright joints staggered row by row.
const mortar = (() => {
  let d = '';
  for (let k = 0; k < 6; k++) d += `M22 ${39 + 12 * k}h76v2.5H22z`;
  for (let k = 0; k < 7; k++) {
    const top = k ? 29.5 + 12 * k : 30, bottom = k < 6 ? 39 + 12 * k : 110;
    for (const x of k % 2 ? [31, 50, 69, 88] : [40, 59, 78]) d += `M${x} ${top}h2.5v${bottom - top}h-2.5z`;
  }
  return d;
})();

// 0. The One-Month Wall (orange brick): battlements, a crown, and a crack down the forehead.
const wall = [
  P('M22 16h18v14H22zM51 16h18v14H51zM80 16h18v14H80zM22 28H98V110H22Z', ORANGE),
  P('M22 53.5h9v9.5h-9zM71.5 29.5h16.5v9.5H71.5zM42.5 41.5h16.5v9.5H42.5zM80.5 101.5H98v8.5H80.5z', CORAL, op(0.5)),
  P('M61.5 29.5h7.5v9.5h-7.5zM22 101.5h9v8.5h-9zM90.5 65.5H98v9.5h-7.5z', GOLD, op(0.45)),
  P(mortar, INK, op(0.3)),
  hi('M22 16H40V28H72L22 86Z', 0.16),
  lo('M98 54V110H46Z', 0.16),
  P('M49 16L46 4L54 9L60 2L66 9L74 4L71 16Z', GOLD),
  P('M60 2L66 9L74 4L71 16H60Z', ORANGE, CROWN_SHADE),
  P('M30 46L54 55V70H30Z', INK),
  P('M90 46L66 55V70H90Z', INK),
  P('M34 54.5L51 61V67H34Z', GOLD, EYE),
  P('M86 54.5L69 61V67H86Z', GOLD, EYE),
  P('M36 89L44 79H76L84 89V100H36Z', INK),
  P('M46 79h8v6h-8zM56 79h8v6h-8zM66 79h8v6h-8z', BONE),
  P('M40 94h8v6h-8zM51 94h8v6h-8zM62 94h8v6h-8zM73 94h8v6h-8z', BONE),
  P('M57.5 16H63L60 28L67 38L60 50L63 74L55 50L62 39L55 29Z', INK),
].join('');

// 1. The Plateau (sky cap): a mesa with a stone face and clouds at its shoulders.
const plateau = [
  P('M32 26H88L94 58L103 106H17L26 58Z', BODY),
  hi('M32 26H56L43 106H17L26 58Z'),
  lo('M76 26H88L94 58L103 106H81Z', 0.22),
  lo('M20 90H100L101.5 98H18.5Z', 0.14),
  P('M32 26H88L90 36L80 41L70 35L60 42L50 35L40 41L30 36Z', SKY),
  hi('M32 26H58L50 35L40 41L30 36Z', 0.3),
  P('M46 26L43 12L52 18L60 8L68 18L77 12L74 26Z', GOLD),
  P('M60 8L68 18L77 12L74 26H60Z', ORANGE, CROWN_SHADE),
  C(60, 20.5, 2.8, CORAL),
  P('M37 57L57 62V72H38Z', INK),
  P('M83 57L63 62V72H82Z', INK),
  P('M41 61.5L55 65V69.5H41.5Z', GOLD, EYE),
  P('M79 61.5L65 65V69.5H78.5Z', GOLD, EYE),
  P('M32 47L60 55L88 47L85 57L60 64L35 57Z', DEEP),
  P('M55 63H65L68 81H52Z', PALE),
  lo('M60 63H65L68 81H60Z', 0.22),
  P('M42 87H78L83 96H75L73 92H47L45 96H37Z', INK),
  P('M4 82a8 8 0 0 1 8-11a11 11 0 0 1 20-3a8 8 0 0 1 8 14z', BONE),
  P('M116 88a8 8 0 0 0-8-11a11 11 0 0 0-20-3a8 8 0 0 0-8 14z', BONE),
  P('M8 82h31a8 8 0 0 0 1-5q-14 6-31 2z', SKY, op(0.35)),
  P('M112 88H81a8 8 0 0 1-1-5q14 6 31 2z', SKY, op(0.35)),
].join('');

// 2. Madame Meh (lilac mask, mint feather): tiara, half-mask, zero enthusiasm.
const madame = [
  E(60, 44, 40, 34, DEEP),
  hi('M20 44A40 34 0 0 1 60 10V44Z', 0.16),
  P('M86 47Q108 40 97 11Q79 18 79 42Z', MINT),
  lo('M86 47Q108 40 97 11Q96 30 83 45Z', 0.2),
  P('M80.5 44L83.5 45.5Q93 30 97 11Q89 28 80.5 44Z', BONE, op(0.85)),
  P('M46 23L43 8L52 14L60 5L68 14L77 8L74 23Z', GOLD),
  P('M60 5L68 14L77 8L74 23H60Z', ORANGE, CROWN_SHADE),
  P('M38 114Q40 101 54 100H66Q80 101 82 114Z', MID),
  P('M52 92H68V102L60 108L52 102Z', PALE),
  lo('M52 92H68V102L60 108L52 102Z', 0.22),
  P('M28 68l4.5 9a5 5 0 1 1-9 0zM92 68l4.5 9a5 5 0 1 1-9 0z', GOLD),
  P('M34 50Q34 26 60 26Q86 26 86 50Q86 78 72 93Q60 105 48 93Q34 78 34 50Z', PALE),
  lo('M86 50Q86 78 72 93Q66 99 60 99L68 58Z', 0.16),
  P('M26 39Q44 45 60 49Q76 45 94 39L92 53Q90 69 76 69Q66 69 60 59Q54 69 44 69Q30 69 28 53Z', LILAC),
  hi('M26 39Q44 45 60 49V59Q54 69 44 69Q30 69 28 53Z', 0.25),
  P('M26 39Q44 45 60 49Q76 45 94 39L93.4 43.5Q76 49.5 60 53.5Q44 49.5 26.6 43.5Z', GOLD),
  P('M34 57Q45 46 56 57Q45 68 34 57Z', INK),
  P('M86 57Q75 46 64 57Q75 68 86 57Z', INK),
  P('M37.5 57H52.5Q51 63.5 45 63.5Q39 63.5 37.5 57Z', GOLD, EYE),
  P('M82.5 57H67.5Q69 63.5 75 63.5Q81 63.5 82.5 57Z', GOLD, EYE),
  C(45, 59.5, 2.5, INK),
  C(75, 59.5, 2.5, INK),
  hi('M58 67H62L64 77H56Z', 0.22),
  R(48, 82, 24, 7.5, CORAL, 3.7),
  R(48, 84.6, 24, 2.3, INK),
  C(73, 76, 2.5, INK),
].join('');

// 3. Baron von Tomorrow (coral band): top hat, monocle, moustache, and a calendar page he will get to later.
const TASH = 'M60 80Q70 72 82 80Q92 88 104 75Q105 95 86 95Q70 95 60 87Z';
const baron = [
  '<g transform="rotate(14 84 28)">',
  R(74, 12, 19, 24, BONE),
  R(74, 12, 19, 7, CORAL),
  P('M78 23h4.5v4.5H78zM84.5 23H89v4.5h-4.5z', DEEP),
  '</g>',
  P('M34 6H86L83 42H37Z', DEEP),
  hi('M34 6H62L46 42H37Z'),
  lo('M76 6H86L83 42H72Z', 0.22),
  P('M36.2 32H83.8L83 42H37Z', CORAL),
  P('M50 30L48 15L55 20.5L60 12L65 20.5L72 15L70 30Z', GOLD),
  R(16, 40, 88, 10, MID, 5),
  R(21, 41.5, 40, 3, '#fff', 1.5, op(0.22)),
  P('M60 104L43 95V113ZM60 104L77 95V113Z', CORAL),
  P('M36 48H84V74Q84 97 60 97Q36 97 36 74Z', PALE),
  hi('M36 50H60L40 90Q36 84 36 74Z'),
  lo('M84 60V74Q84 97 60 97Z', 0.16),
  C(60, 104, 4.5, GOLD),
  P('M38 55.5L57 58.5V62.5L38 59.5Z', DEEP),
  P('M39.5 63H56.5Q56.5 72.5 48 72.5Q39.5 72.5 39.5 63Z', INK),
  P('M42 65H54Q54 70.5 48 70.5Q42 70.5 42 65Z', GOLD, EYE),
  P('M62 50.5Q73 44.5 85 50.5V54Q73 48.5 62 54Z', DEEP),
  C(73, 66, 11.5, GOLD),
  C(73, 66, 8.5, INK),
  C(73, 66, 5, GOLD, EYE),
  C(73, 66, 2, INK),
  P('M55 68H61L63 79H53Z', BODY),
  P('M60 80Q50 72 38 80Q28 88 16 75Q15 95 34 95Q50 95 60 87Z', BONE),
  P(TASH, BONE),
  P(TASH, DEEP, op(0.14)),
].join('');

// Inner SVG markup (no outer <svg> tag) for a 120x120 viewBox, one string per boss, in this order.
export const BOSS_SMALL = [couch, snooze, gator, scroll, doctor, captain, cold, mirror];
export const BOSS_BIG = [wall, plateau, madame, baron];
