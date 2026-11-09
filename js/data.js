// The deck: suits, cards, seasons, themes. Pure data, no logic.

export const SUITS = {
  chest:   { name: 'Chest',   weight: 5,   color: '#FF5A4E' },
  biceps:  { name: 'Biceps',  weight: 4,   color: '#FFD23F' },
  back:    { name: 'Back',    weight: 3.5, color: '#4CC9F0' },
  triceps: { name: 'Triceps', weight: 3,   color: '#58E0A0' },
  abs:     { name: 'Abs',     weight: 2,   color: '#FF9F1C' },
  rest:    { name: 'Legs and shoulders', short: 'The rest', weight: 1.5, color: '#B79CFF' },
};
export const SUIT_ORDER = ['chest', 'biceps', 'back', 'triceps', 'abs', 'rest'];

// kind: db2 = a dumbbell in each hand, db1 = one dumbbell, bw = bodyweight reps, time = hold for seconds
// anchor + ratio: starting weight as a share of the bench press or curl weight given at setup
// base: in the deck from day one. incline: needs a bench with an adjustable back.
// boss: can be dealt as an all-out finisher. curl: can be played as 21s.
// side: reps are counted per arm or leg. q: search words for the how-to video link.
const E = (id, name, suit, kind, o = {}) => ({ id, name, suit, kind, anchor: 'bench', ratio: 0, ...o });

export const EXERCISES = [
  // Chest
  E('bench-press', 'Flat dumbbell press', 'chest', 'db2', { q: 'dumbbell bench press form', ratio: 1, compound: true, base: true,
    cue: 'Lie flat, dumbbells over your chest. Lower until your elbows dip just below the bench, press back up.' }),
  E('incline-press', 'Incline dumbbell press', 'chest', 'db2', { ratio: 0.85, compound: true, base: true, incline: true,
    cue: 'Bench back at about 30 degrees. Lower to the top of your chest, press up and slightly together.' }),
  E('fly', 'Dumbbell fly', 'chest', 'db2', { q: 'dumbbell chest fly form', ratio: 0.5, base: true,
    cue: 'Arms wide with a soft bend in the elbows. Lower in a big arc until your chest stretches, hug back up.' }),
  E('push-up', 'Push-up', 'chest', 'bw', { base: true, boss: true, compound: true,
    cue: 'Hands a bit wider than shoulders, body straight as a plank. Chest to the floor, push away.' }),
  E('floor-press', 'Floor press', 'chest', 'db2', { ratio: 1, compound: true,
    cue: 'Lie on the floor, press from where your upper arms touch down. Pause on the floor each rep.' }),
  E('squeeze-press', 'Squeeze press', 'chest', 'db2', { ratio: 0.75, compound: true,
    cue: 'Press the dumbbells hard against each other the whole time while you press up and down.' }),
  E('neutral-press', 'Palms-in press', 'chest', 'db2', { q: 'neutral grip dumbbell bench press', ratio: 0.95, compound: true,
    cue: 'Like a flat press, but palms face each other and elbows stay closer to your ribs.' }),
  E('incline-fly', 'Incline fly', 'chest', 'db2', { ratio: 0.45, incline: true,
    cue: 'Bench at 30 degrees. Open wide until the upper chest stretches, bring the dumbbells together above your chin.' }),
  E('one-arm-press', 'One-arm press', 'chest', 'db2', { q: 'single arm dumbbell bench press', side: true, ratio: 0.8, compound: true,
    cue: 'Press one side at a time while the other arm waits at the top. Keep your hips flat on the bench.' }),
  E('feet-up-push-up', 'Feet-on-bench push-up', 'chest', 'bw', { q: 'decline push up feet on bench', boss: true, compound: true,
    cue: 'Toes on the bench, hands on the floor. Hits the upper chest. Keep your hips from sagging.' }),
  E('deep-push-up', 'Deep push-up', 'chest', 'bw', { q: 'deficit push up on dumbbells', boss: true, compound: true,
    cue: 'Hands on the dumbbell handles so your chest can sink lower than your hands.' }),

  // Biceps
  E('curl', 'Standing curl', 'biceps', 'db2', { q: 'dumbbell biceps curl form', anchor: 'curl', ratio: 1, base: true, curl: true,
    cue: 'Elbows pinned to your sides, palms up. Curl without swinging, lower slowly.' }),
  E('hammer', 'Hammer curl', 'biceps', 'db2', { anchor: 'curl', ratio: 1, base: true, curl: true,
    cue: 'Palms face each other like you are holding hammers. Same strict curl.' }),
  E('incline-curl', 'Incline curl', 'biceps', 'db2', { anchor: 'curl', ratio: 0.75, base: true, incline: true, curl: true,
    cue: 'Lean back on the incline, arms hanging straight down behind you. Curl from that deep stretch.' }),
  E('concentration', 'Concentration curl', 'biceps', 'db2', { side: true, anchor: 'curl', ratio: 0.8, base: true,
    cue: 'Sit, elbow braced inside your thigh. Curl one arm and squeeze hard at the top. Reps are per arm.' }),
  E('seated-curl', 'Seated curl', 'biceps', 'db2', { anchor: 'curl', ratio: 1, curl: true,
    cue: 'Sit upright on the bench so you cannot cheat with your legs. Curl both together.' }),
  E('spider', 'Spider curl', 'biceps', 'db2', { anchor: 'curl', ratio: 0.7, incline: true, curl: true,
    cue: 'Chest against the incline, arms hanging straight down in front. Curl up and squeeze.' }),
  E('zottman', 'Zottman curl', 'biceps', 'db2', { anchor: 'curl', ratio: 0.7,
    cue: 'Curl up palms-up, turn your palms down at the top, lower slowly palms-down.' }),
  E('cross-body', 'Cross-body curl', 'biceps', 'db2', { q: 'cross body hammer curl', anchor: 'curl', ratio: 1,
    cue: 'Hammer grip, curl one dumbbell across your body toward the opposite shoulder. Alternate.' }),
  E('drag', 'Drag curl', 'biceps', 'db2', { q: 'dumbbell drag curl', anchor: 'curl', ratio: 0.85,
    cue: 'Drag the dumbbells up along your body, elbows travelling back behind you.' }),
  E('wide-curl', 'Wide curl', 'biceps', 'db2', { q: 'wide grip dumbbell curl', anchor: 'curl', ratio: 0.85, curl: true,
    cue: 'Elbows at your sides, forearms angled out wide. Curl out and up.' }),
  E('waiter', 'Waiter curl', 'biceps', 'db1', { anchor: 'curl', ratio: 1.2,
    cue: 'Hold one dumbbell by its top end with both palms flat underneath, like a tray. Curl it to your chin.' }),
  E('preacher', 'Bench preacher curl', 'biceps', 'db2', { q: 'dumbbell preacher curl on incline bench', side: true, anchor: 'curl', ratio: 0.7, incline: true,
    cue: 'Stand behind the incline, upper arm flat on the pad. Curl one arm at a time. Reps are per arm.' }),

  // Back
  E('one-arm-row', 'One-arm row', 'back', 'db2', { side: true, ratio: 1, compound: true, base: true,
    cue: 'One knee and hand on the bench, back flat. Pull the dumbbell to your hip. Reps are per arm.' }),
  E('bent-row', 'Bent-over row', 'back', 'db2', { ratio: 0.8, compound: true, base: true,
    cue: 'Hinge forward until your chest is nearly level, back flat. Row both dumbbells to your waist.' }),
  E('reverse-fly', 'Reverse fly', 'back', 'db2', { ratio: 0.3, base: true,
    cue: 'Hinge forward, arms hanging. Lift out to the sides, leading with your elbows.' }),
  E('chest-row', 'Chest-supported row', 'back', 'db2', { q: 'chest supported dumbbell row incline bench', ratio: 0.8, compound: true, incline: true,
    cue: 'Lie chest-down on the incline. Row both dumbbells up and squeeze your shoulder blades.' }),
  E('pullover', 'Pullover', 'back', 'db1', { q: 'dumbbell pullover form', ratio: 0.85,
    cue: 'Lie on the bench holding one dumbbell over your chest. Lower it back behind your head, pull it over again.' }),
  E('shrug', 'Shrug', 'back', 'db2', { q: 'dumbbell shrug form', ratio: 1,
    cue: 'Stand tall, arms straight. Lift your shoulders straight up to your ears and hold a second.' }),
  E('renegade-row', 'Renegade row', 'back', 'db2', { ratio: 0.6, compound: true,
    cue: 'Push-up position holding the dumbbells. Row one up, set it down, row the other. Hips stay still.' }),
  E('wide-row', 'Elbows-out row', 'back', 'db2', { q: 'dumbbell rear delt row', ratio: 0.7, compound: true,
    cue: 'Bent over, row with elbows flared out to the sides, toward your chest. Hits the upper back.' }),
  E('superman', 'Superman hold', 'back', 'time', { boss: true,
    cue: 'Lie face down. Lift arms, chest and legs off the floor and hold.' }),

  // Triceps
  E('overhead-ext', 'Overhead extension', 'triceps', 'db1', { q: 'two hand dumbbell overhead triceps extension', ratio: 0.8, base: true,
    cue: 'One dumbbell held in both hands behind your head. Elbows point up, straighten your arms.' }),
  E('skull', 'Lying triceps extension', 'triceps', 'db2', { q: 'dumbbell skull crusher', ratio: 0.4, base: true,
    cue: 'Lie flat, arms straight up. Bend only at the elbows to lower the dumbbells beside your head.' }),
  E('bench-dip', 'Bench dip', 'triceps', 'bw', { q: 'bench dips form', base: true, boss: true,
    cue: 'Hands on the bench edge behind you, legs out. Lower until your elbows hit 90 degrees, press up.' }),
  E('kickback', 'Kickback', 'triceps', 'db2', { q: 'dumbbell triceps kickback', ratio: 0.3,
    cue: 'Hinge forward, upper arms along your ribs. Straighten your arms back and squeeze.' }),
  E('close-press', 'Close-grip press', 'triceps', 'db2', { ratio: 0.8, compound: true,
    cue: 'Flat on the bench, dumbbells touching, elbows tucked tight to your sides as you press.' }),
  E('tate', 'Tate press', 'triceps', 'db2', { q: 'tate press dumbbell', ratio: 0.4,
    cue: 'Lie flat, elbows flared out. Lower the dumbbells toward your chest by bending the elbows, then straighten.' }),
  E('one-arm-overhead', 'One-arm overhead extension', 'triceps', 'db2', { side: true, ratio: 0.35,
    cue: 'One dumbbell overhead in one hand. Lower it behind your head, straighten. Reps are per arm.' }),
  E('diamond-push-up', 'Diamond push-up', 'triceps', 'bw', { boss: true,
    cue: 'Hands together under your chest, thumbs and index fingers touching. Elbows brush your ribs.' }),

  // Abs
  E('crunch', 'Crunch', 'abs', 'bw', { base: true,
    cue: 'Knees bent, curl your ribs toward your hips. Lower back stays on the floor.' }),
  E('leg-raise', 'Bench leg raise', 'abs', 'bw', { q: 'lying leg raise on bench', base: true,
    cue: 'Lie on the bench gripping it behind your head. Raise straight legs to vertical, lower slowly.' }),
  E('plank', 'Plank', 'abs', 'time', { base: true, boss: true,
    cue: 'Forearms down, body in one straight line. Squeeze your glutes and brace like expecting a punch.' }),
  E('russian-twist', 'Russian twist', 'abs', 'db1', { ratio: 0.4, base: true,
    cue: 'Sit leaning back, feet up if you can. Rotate the dumbbell side to side. Count each side.' }),
  E('bicycle', 'Bicycle crunch', 'abs', 'bw', {
    cue: 'Elbow to opposite knee while the other leg extends. Slow and controlled. Count each side.' }),
  E('reverse-crunch', 'Reverse crunch', 'abs', 'bw', {
    cue: 'On your back, knees bent. Roll your hips off the floor toward your chest.' }),
  E('v-up', 'V-up', 'abs', 'bw', {
    cue: 'Lie flat, then fold in half: hands and feet meet above you.' }),
  E('dead-bug', 'Dead bug', 'abs', 'bw', {
    cue: 'On your back, arms and knees up. Lower opposite arm and leg, keeping your lower back glued down.' }),
  E('mountain-climber', 'Mountain climber', 'abs', 'bw', {
    cue: 'Push-up position, drive knees to chest one at a time, fast. Count each knee.' }),
  E('weighted-crunch', 'Weighted crunch', 'abs', 'db1', { ratio: 0.5,
    cue: 'Hold one dumbbell on your chest and crunch.' }),
  E('hollow-hold', 'Hollow hold', 'abs', 'time', { boss: true,
    cue: 'On your back, arms overhead, legs straight. Lift shoulders and feet a little off the floor and hold.' }),
  E('side-plank', 'Side plank', 'abs', 'time', { side: true,
    cue: 'On one forearm, body straight, hips high. Do the full time on each side.' }),

  // The rest: legs and shoulders
  E('goblet-squat', 'Goblet squat', 'rest', 'db1', { ratio: 1, compound: true, base: true,
    cue: 'Hold one dumbbell against your chest. Sit down between your heels, chest tall, stand up.' }),
  E('shoulder-press', 'Shoulder press', 'rest', 'db2', { ratio: 0.65, compound: true, base: true,
    cue: 'Seated, dumbbells at ear height. Press straight up until your arms are locked.' }),
  E('rdl', 'Romanian deadlift', 'rest', 'db2', { ratio: 1, compound: true, base: true,
    cue: 'Soft knees, push your hips back and slide the dumbbells down your legs. Back flat. Stand by squeezing your glutes.' }),
  E('lateral-raise', 'Lateral raise', 'rest', 'db2', { ratio: 0.3, base: true,
    cue: 'Lift your arms out to the sides to shoulder height, like pouring two jugs.' }),
  E('split-squat', 'Bulgarian split squat', 'rest', 'db2', { side: true, ratio: 0.6, compound: true,
    cue: 'Back foot on the bench, drop straight down on the front leg. Reps are per leg.' }),
  E('hip-thrust', 'Hip thrust', 'rest', 'db1', { ratio: 1, compound: true,
    cue: 'Upper back on the bench, dumbbell on your hips. Drive your hips up and squeeze at the top.' }),
  E('reverse-lunge', 'Reverse lunge', 'rest', 'db2', { side: true, ratio: 0.6, compound: true,
    cue: 'Step back into a lunge, both knees at 90 degrees, push back up. Reps are per leg.' }),
  E('calf-raise', 'Calf raise', 'rest', 'db2', { q: 'dumbbell calf raise', ratio: 1,
    cue: 'Rise onto your toes as high as you can, pause, lower slowly.' }),
  E('arnold', 'Arnold press', 'rest', 'db2', { ratio: 0.55, compound: true,
    cue: 'Start palms facing you at chin height. Rotate your palms forward as you press up.' }),
  E('step-up', 'Bench step-up', 'rest', 'db2', { q: 'dumbbell step up on bench', side: true, ratio: 0.5, compound: true,
    cue: 'Step onto the bench with one foot and stand tall. Lower under control. Reps are per leg.' }),
  E('front-raise', 'Front raise', 'rest', 'db2', { ratio: 0.3,
    cue: 'Lift the dumbbells straight in front of you to eye level. No swinging.' }),
];

export const EX = Object.fromEntries(EXERCISES.map(e => [e.id, e]));

// Twists that change how one card is played. Each keeps its own records.
export const MODS = {
  slow:      { name: 'Slow motion', factor: 0.9, repShift: -2,
               how: 'Take three full seconds to lower every rep.' },
  half:      { name: 'One and a half', factor: 0.85, repShift: -3,
               how: 'Each rep is: all the way down, halfway up, back down, all the way up.' },
  restpause: { name: 'Rest-pause', factor: 1, repShift: 0,
               how: 'After each set breathe for only 15 seconds, then go again. Reps will drop. That is the point.' },
  twentyone: { name: '21s', factor: 0.7, repShift: 0,
               how: 'Seven reps bottom half only, seven top half only, seven full reps. One set is 21.' },
};

// Ways a whole hand is played.
export const STYLES = {
  pairs:   { name: 'Pairs',       group: 2, rounds: 3, rest: 45, shift: 0,
             how: 'Two cards back to back, then rest.' },
  heavy:   { name: 'Heavy hand',  group: 2, rounds: 3, rest: 75, shift: -2, leadSets: 4,
             how: 'Fewer reps, longer rests. The first cards are played alone for four sets.' },
  pump:    { name: 'Pump hand',   group: 2, rounds: 3, rest: 30, shift: 3,
             how: 'More reps, short rests, a lot of burn.' },
  circuit: { name: 'Circuit',     group: 3, rounds: 3, rest: 60, shift: 0,
             how: 'Three cards in a row before you rest.' },
};

export const THEMES = {
  indigo:   { name: 'Indigo',   table: '#2A2370', deep: '#1F1958', pit: '#120E3F', gold: '#FFD23F', goldDark: '#C79A00', muted: '#A9A4DC' },
  forge:    { name: 'Forge',    table: '#5A1626', deep: '#451020', pit: '#2C0914', gold: '#FFB23F', goldDark: '#C47A0C', muted: '#DDA6B0' },
  lagoon:   { name: 'Lagoon',   table: '#0C4A54', deep: '#083A43', pit: '#04262D', gold: '#FFE066', goldDark: '#C4A728', muted: '#9CC9CF' },
  candy:    { name: 'Candy',    table: '#8A1F6B', deep: '#6E1655', pit: '#480C37', gold: '#FFE14D', goldDark: '#C4A51C', muted: '#E3AED3' },
  moss:     { name: 'Moss',     table: '#27482B', deep: '#1D3921', pit: '#112514', gold: '#FFD166', goldDark: '#C49A2E', muted: '#A9CBAC' },
  midnight: { name: 'Midnight', table: '#101B3D', deep: '#0B1430', pit: '#060C20', gold: '#7CF5D0', goldDark: '#3FB592', muted: '#93A2CF' },
  ember:    { name: 'Ember',    table: '#6B2A0E', deep: '#55200A', pit: '#371405', gold: '#FFE08A', goldDark: '#C9A64B', muted: '#E0B8A2' },
};
export const LOOT_THEMES = ['moss', 'midnight', 'ember'];

// A season lasts SEASON_LENGTH hands, then the next one opens. After the fourth they cycle.
export const SEASON_LENGTH = 12;
export const SEASONS = [
  { name: 'Foundation',  range: [8, 12],  theme: 'indigo', style: null,
    blurb: 'Classic muscle-building sets of 8 to 12.' },
  { name: 'Heavy metal', range: [6, 10],  theme: 'forge',  style: 'heavy',
    blurb: 'Heavier dumbbells, fewer reps, and the Heavy hand joins the deal.' },
  { name: 'Pump',        range: [10, 15], theme: 'lagoon', style: 'pump',
    blurb: 'Lighter and faster. The Pump hand joins the deal.' },
  { name: 'Wild cards',  range: null,     theme: 'candy',  style: 'circuit',
    blurb: 'Every hand plays by different rules, and Circuits join the deal.' },
];
export const WILD_RANGES = [[6, 10], [8, 12], [10, 15]];

// Things your lifetime total weighs as much as.
export const HEAVY_THINGS = [
  [4, 'house cat', 'house cats'], [30, 'golden retriever', 'golden retrievers'],
  [90, 'fridge', 'fridges'], [200, 'motorbike', 'motorbikes'], [450, 'grand piano', 'grand pianos'],
  [700, 'cow', 'cows'], [1300, 'small car', 'small cars'], [2500, 'rhino', 'rhinos'],
  [6000, 'elephant', 'elephants'], [12000, 'city bus', 'city buses'],
  [40000, 'loaded truck', 'loaded trucks'], [140000, 'blue whale', 'blue whales'],
];

// ---------- the fight ----------
// Bosses are the excuses. Every set you log is a hit on the current one; it never heals.
// Two smaller bosses, then a season boss. weak: sets of that suit hit half again as hard.
export const FOES_SMALL = [
  { name: 'Couch Gravity', taunt: 'Sit down. Just for a minute.', weak: 'chest' },
  { name: 'The Snooze Button', taunt: 'Nine more minutes will not hurt.', weak: 'biceps' },
  { name: 'Later Gator', taunt: 'Tomorrow is a great day to start.', weak: 'back' },
  { name: 'The Scroll Hole', taunt: 'One more video first.', weak: 'triceps' },
  { name: 'Doctor Too-Tired', taunt: 'You have had such a long day.', weak: 'chest' },
  { name: 'Captain Comfort', taunt: 'Why would anyone leave this blanket?', weak: 'biceps' },
  { name: 'The Cold Floor', taunt: 'It is freezing out here. Stay in bed.', weak: 'abs' },
  { name: 'The Mirror Doubt', taunt: 'Nothing is changing anyway.', weak: 'back' },
];
export const FOES_BIG = [
  { name: 'The One-Month Wall', taunt: 'This is where you usually stop.', weak: 'chest' },
  { name: 'The Plateau', taunt: 'This is as strong as you get.', weak: 'biceps' },
  { name: 'Madame Meh', taunt: 'Is any of this even worth it?', weak: 'back' },
  { name: 'Baron von Tomorrow', taunt: 'See you next week. Or the week after.', weak: 'triceps' },
];

// Combos land by themselves when the sets you play fit the pattern. They drop as reward cards.
export const COMBOS = {
  pushpull:   { name: 'Push-pull', bonus: 8,  how: 'A chest set and a back set, one straight after the other.' },
  armlock:    { name: 'Arm lock', bonus: 8,   how: 'A biceps set and a triceps set, one straight after the other.' },
  roll:       { name: 'On a roll', bonus: 6,  how: 'Hit your target three sets running. Every set hits harder until you miss one.' },
  exploit:    { name: 'Sore spot', bonus: 10, how: 'Two sets in a row on the suit the boss is weak to.' },
  secondwind: { name: 'Second wind', bonus: 15, how: 'After your first record in a hand, every later record hits harder still.' },
  fullhouse:  { name: 'Full house', bonus: 60, how: 'Play five different suits in one hand.' },
};

// ---------- loot ----------
// Thirteen lines of equipment (six weapons, seven pieces of armour), each a ladder of five rarities.
// Items drop from reward cards, bosses and, now and then, a gremlin. Iron earned from every set
// forges the next rung of a line you already own.
export const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
export const RARITY_COLOR = ['#B5B8C8', '#58E0A0', '#4CC9F0', '#C77DFF', '#FFD23F'];
// Iron needed to forge an item of each rarity from the one below it.
export const FORGE_COST = [0, 40, 110, 280, 700];

// Each weapon type does one thing. values: how much, by rarity.
export const WEAPONS = {
  sword:      { name: 'Sword',      perk: 'crit',     values: [4, 8, 13, 19, 28],
    names: ['Training Sword', "Soldier's Blade", "Knight's Longsword", 'Runeblade', 'Dawnbreaker'] },
  zweihander: { name: 'Zweihander', perk: 'finisher', values: [14, 26, 40, 58, 80],
    names: ['Rusty Zweihander', "Mercenary's Zweihander", "Giant's Zweihander", 'Stormcleaver', 'Zweihander of the Iron Lord'] },
  hammer:     { name: 'Hammer',     perk: 'opener',   values: [5, 9, 14, 20, 28],
    names: ['Wooden Mallet', "Smith's Hammer", 'Warhammer', 'Thunder Maul', 'Wallbreaker'] },
  axe:        { name: 'Axe',        perk: 'weak',     values: [4, 7, 11, 16, 22],
    names: ['Hatchet', 'Battle Axe', 'Double-Bit Axe', 'Frost Reaver', 'The Excuse Cleaver'] },
  mace:       { name: 'Mace',       perk: 'flat',     values: [1, 2, 3, 4, 6],
    names: ['Club', 'Flanged Mace', 'Morning Star', 'Skullshaker', 'The Snooze Smasher'] },
  halberd:    { name: 'Polearm',    perk: 'combo',    values: [3, 6, 9, 13, 18],
    names: ['Pike', 'Halberd', 'Royal Glaive', 'Dragon Lance', "Tomorrow's End"] },
};

// Armour: each piece strengthens one suit. The helm pays points instead.
export const ARMOR = {
  helm:  { name: 'Helm',        suit: null,      values: [4, 8, 12, 18, 25],
    names: ['Leather Cap', 'Iron Helm', "Knight's Helm", 'Horned Warhelm', 'Crown of Reps'] },
  chest: { name: 'Breastplate', suit: 'chest',   values: [1, 2, 3, 5, 7],
    names: ['Padded Vest', 'Chainmail', 'Steel Breastplate', 'Dragonscale Plate', 'Ironheart'] },
  arms:  { name: 'Bracers',     suit: 'biceps',  values: [1, 2, 3, 5, 7],
    names: ['Cloth Wraps', 'Leather Bracers', 'Steel Bracers', 'Runed Armguards', "Titan's Bracers"] },
  cloak: { name: 'Cloak',       suit: 'back',    values: [1, 2, 3, 5, 7],
    names: ['Old Blanket', "Traveller's Cloak", "Knight's Cape", 'Shadow Mantle', 'Mantle of the Unbroken'] },
  hands: { name: 'Gauntlets',   suit: 'triceps', values: [1, 2, 3, 5, 7],
    names: ['Work Gloves', 'Leather Gloves', 'Steel Gauntlets', 'Spiked Gauntlets', 'Grip of Legends'] },
  belt:  { name: 'Belt',        suit: 'abs',     values: [1, 2, 3, 5, 7],
    names: ['Rope Belt', 'Leather Belt', "Champion's Belt", 'Girdle of Might', 'The Golden Plate'] },
  boots: { name: 'Boots',       suit: 'rest',    values: [1, 2, 3, 5, 7],
    names: ['Worn Boots', 'Leather Boots', 'Steel Greaves', 'Stormstriders', 'Gravity Boots'] },
};
export const SLOT_ORDER = ['weapon', 'helm', 'chest', 'arms', 'hands', 'cloak', 'belt', 'boots'];
export const SLOT_NAME = { weapon: 'Weapon', ...Object.fromEntries(Object.entries(ARMOR).map(([k, a]) => [k, a.name])) };
// A line is one ladder of five: a weapon type or an armour slot.
export const LINES = [...Object.keys(WEAPONS), ...Object.keys(ARMOR)];

// id is "<line>-<rarity>", e.g. "zweihander-4".
export const ITEMS = {};
for (const [type, w] of Object.entries(WEAPONS)) {
  w.names.forEach((name, rarity) => {
    ITEMS[`${type}-${rarity}`] = { id: `${type}-${rarity}`, line: type, slot: 'weapon', rarity, name, perk: w.perk, value: w.values[rarity] };
  });
}
for (const [slot, a] of Object.entries(ARMOR)) {
  a.names.forEach((name, rarity) => {
    ITEMS[`${slot}-${rarity}`] = { id: `${slot}-${rarity}`, line: slot, slot, rarity, name, perk: a.suit ? 'suit' : 'points', suit: a.suit, value: a.values[rarity] };
  });
}

export function perkText(item) {
  const v = item.value;
  switch (item.perk) {
    case 'crit': return `Records hit ${v} harder.`;
    case 'finisher': return `The finisher hits ${v} harder.`;
    case 'opener': return `The first three sets of every hand hit ${v} harder.`;
    case 'weak': return `Sets on the boss's weak spot hit ${v} harder.`;
    case 'flat': return `Every set hits ${v} harder.`;
    case 'combo': return `Every combo you land pays ${v} more.`;
    case 'suit': return `${SUITS[item.suit].short ?? SUITS[item.suit].name} sets hit ${v} harder.`;
    default: return `Every hand pays ${v}% more points.`;
  }
}
