// The online save: sign-in with Google and one document per player, kept in Firebase.
// Loaded only when js/config.js holds a project, so the app runs the same without it.
//
// A save is two documents under the player's own id, readable and writable by nobody else:
//   saves/{uid}              the facts needed to decide what to do: { stamp, xp, empty, level, hands, at }
//   saves/{uid}/data/state   the whole save as text: { json }
// Firestore rules for the project:
//   match /saves/{uid} {
//     allow read, write: if request.auth != null && request.auth.uid == uid;
//     match /data/{part} { allow read, write: if request.auth != null && request.auth.uid == uid; }
//   }
// The big-screen game follows a fight through one more document, feeds/{code}. The code is long and random
// and is the only key: whoever has it can read that feed, nobody can list feeds, and only signed-in players write.
//   match /feeds/{code} { allow get: if true; allow write: if request.auth != null; }

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

export async function connect(config) {
  if (LOCAL && new URLSearchParams(location.search).has('fakecloud')) return pretend();
  if (!config) return null;
  const [{ initializeApp }, auth, store] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore-lite.js`),
  ]);
  const app = initializeApp(config), a = auth.getAuth(app), db = store.getFirestore(app);
  const meta = (uid) => store.doc(db, 'saves', uid), state = (uid) => store.doc(db, 'saves', uid, 'data', 'state');
  return {
    onUser(cb) { auth.onAuthStateChanged(a, u => cb(u ? { uid: u.uid, name: u.displayName || u.email || 'your account' } : null)); },
    async signIn() {
      const google = new auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(a, google); } catch (e) {
        // Some browsers and installed apps refuse pop-ups: go through a full-page sign-in instead.
        if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') await auth.signInWithRedirect(a, google);
        else throw e;
      }
    },
    signOut: () => auth.signOut(a),
    async readMeta(uid) { const snap = await store.getDoc(meta(uid)); return snap.exists() ? snap.data() : null; },
    async readSave(uid) { const snap = await store.getDoc(state(uid)); return snap.exists() ? snap.data().json : null; },
    // The save goes first and its facts second, so the facts never describe a save that is not there yet.
    async write(uid, facts, json) { await store.setDoc(state(uid), { json }); await store.setDoc(meta(uid), facts); },
    writeFeed: (code, feed) => store.setDoc(store.doc(db, 'feeds', code), { seq: feed.seq, json: JSON.stringify(feed) }),
  };
}

// A stand-in that keeps the "online" save in this browser. Only for trying the sign-in screens on a
// development machine: open the app with ?fakecloud in the address.
function pretend() {
  const get = (k) => JSON.parse(localStorage.getItem(`irondeck.fake.${k}`) ?? 'null');
  const set = (k, v) => localStorage.setItem(`irondeck.fake.${k}`, JSON.stringify(v));
  let listener = () => {};
  return {
    onUser(cb) { listener = cb; cb(get('user')); },
    async signIn() { set('user', { uid: 'fake', name: 'Test Player' }); listener(get('user')); },
    async signOut() { set('user', null); listener(null); },
    async readMeta() { return get('meta'); },
    async readSave() { return get('json'); },
    async write(uid, facts, json) { set('json', json); set('meta', facts); },
    async writeFeed(code, feed) { set('feed', { code, seq: feed.seq, json: JSON.stringify(feed) }); },
  };
}
