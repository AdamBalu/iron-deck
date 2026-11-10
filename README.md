# Iron Deck

Dumbbell workouts dealt as a hand of cards, fresh every time. Built for a bench and a pair of adjustable dumbbells.

- Each muscle group is a suit. Chest and biceps are dealt most, then back, triceps, abs, and the rest.
- A full hand takes 20 to 30 minutes. A quick hand takes about 10.
- The app picks weights and reps so every card asks for a little more than last time.
- Nothing can be lost: no streaks, only points, levels and records that go up.
- Every hand ends with a reward card: a new exercise, a new twist, or a new look.
- Each new season changes the rep ranges, the hand styles and the colours.
- Every set you log is a hit on the current boss. Records are critical hits, and a boss never heals.
- Three bosses make a season. Beating one drops gear; finishing a season boss with a record drops a legendary.
- Gear comes in five rarities across six weapon types and seven armour slots, and shows on your hero.
- Every set also earns iron, which forges the next rarity up of anything you own.
- Each boss fears one kind of weapon. Fight it with that kind in hand and every hit lands a quarter harder.
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
- `js/art.js`, `js/art-bosses.js`: weapons, armour, the hero and the bosses, drawn in SVG.
- `js/app.js`: the screens.
- `sw.js`: offline support.
- `js/picto.js`: the exercise drawings.
- `js/arena.js`: arena fights, the full-screen exchange staged after a set. The rules it shows live in the engine.
- `js/sound.js`, `sounds/`: recorded card and combat sounds.
- `js/sync.js`, `js/cloud.js`, `js/config.js`: one save across devices (rules, network, project settings).

## Sign-in (optional)

Without a Firebase project in `js/config.js` the app has no sign-in and keeps everything on the device.
To turn it on:

1. Create a project at console.firebase.google.com.
2. Authentication: enable the Google sign-in method, and add the site's domain under Settings, Authorized domains.
3. Firestore Database: create it in production mode and publish these rules:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /saves/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
         match /data/{part} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
         }
       }
     }
   }
   ```

4. Project settings: add a web app and paste its config into `js/config.js`.

To try the sign-in screens without a project, run the app locally and open it with `?fakecloud` in the address.

## Credits

Sounds: Casino Audio, RPG Audio and Impact Sounds by Kenney (kenney.nl), public domain (CC0).
