// The rules for keeping one save across devices. Pure: no network and no storage, so they can be tested.
//
// A save is known by two numbers: stamp (when it last changed) and xp (how far it has got).
//   local   the save on this device, or null if there is none
//   cloud   the save in the account, or null if nothing was ever saved there. empty: the account was wiped.
//   base    the stamp of the account save this device last matched
//   linked  this device has synced with this account before
//   busy    a workout is on screen
// Answers: 'push' (upload this device), 'pull' (take the account save), 'ask' (the player chooses),
// 'wait' (take the account save once the workout is over) or 'none'.
export function decide({ local, cloud, base, linked, busy }) {
  if (!cloud) return local ? 'push' : 'none';
  const pull = busy ? 'wait' : 'pull';
  const nothingThere = !!cloud.empty;

  if (!linked) {
    // First meeting of this device and this account.
    if (!local || local.xp === 0) return nothingThere ? (local ? 'push' : 'none') : pull;
    if (nothingThere) return 'push';
    return local.stamp === cloud.stamp ? 'none' : 'ask';
  }

  const changedHere = !!local && local.stamp !== base;
  const changedThere = cloud.stamp !== base;
  if (!changedThere) return changedHere ? 'push' : 'none';
  if (!changedHere) return pull;
  // Both changed since they last matched. They cannot be merged, so the one that has got further wins.
  // Going by progress rather than by the clock means a few taps on one device never wipe a workout done on the other.
  if (local.xp !== cloud.xp) return local.xp > cloud.xp ? 'push' : pull;
  return local.stamp >= cloud.stamp ? 'push' : pull;
}

// The few facts shown when the player has to choose between two saves.
export function describe(state, levelFor) {
  return { level: levelFor(state.xp).level, hands: state.hands ?? 0, at: state.lastHandAt ?? null };
}
