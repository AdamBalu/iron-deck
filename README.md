# Iron Deck

Dumbbell workouts dealt as a hand of cards, fresh every time. Built for a bench and a pair of adjustable dumbbells.

- Each muscle group is a suit. Chest and biceps are dealt most, then back, triceps, abs, and the rest.
- A full hand takes 20 to 30 minutes. A quick hand takes about 10.
- The app picks weights and reps so every card asks for a little more than last time.
- Nothing can be lost: no streaks, only points, levels and records that go up.
- Every hand ends with a reward card: a new exercise, a new twist, or a new look.
- Every 12 hands a new season changes the rep ranges, the hand styles and the colours.
- Each hand has an optional bounty for extra points. Missing it costs nothing.
- The progress screen shows how much stronger you are than in your first sessions.

Your history is stored only in the browser on your phone. Use Settings to save a backup file.

## Install on a phone

Open the site in Chrome on Android, then choose "Add to home screen" from the menu. It works offline after the first visit.

## Run on a computer

```bash
npm start
```

Then open http://localhost:4173.

## Tests

```bash
npm test
```

## Layout

- `js/data.js`: the cards, twists, hand styles, seasons and looks.
- `js/engine.js`: dealing, targets, records, points and rewards. No DOM.
- `js/app.js`: the screens.
- `sw.js`: offline support.
