import { applyPatch } from '../applyPatch';
import { JSONPatch } from '../jsonPatch';
import type { Change, DeletedChange } from './types';

/**
 * Splits an array of changes into two arrays based on the presence of a baseRev.
 * The first array contains changes before the first change with a baseRev,
 * and the second array contains the change with baseRev and all subsequent changes.
 *
 * @param changes - Array of changes to split
 * @returns A tuple containing [changes before baseRev, changes with and after baseRev]
 */
export function splitChanges<T>(changes: Change[]): [Change[], Change[]] {
  const index = changes.findIndex(c => c.baseRev);
  return [changes.slice(0, index), changes.slice(index)];
}

/**
 * Applies a sequence of changes to a state object.
 * Each change is applied in sequence using the applyPatch function.
 *
 * @param state - The initial state to apply changes to
 * @param changes - Array of changes to apply
 * @returns The state after all changes have been applied
 */
export function applyChanges<T>(state: T, changes: Change[]): T {
  if (!changes.length) return state;
  for (const change of changes) {
    state = applyPatch(state, change.ops, { createMissingObjects: true, strict: true });
  }
  return state;
}

/**
 * Rebases local changes against server changes using operational transformation.
 * This function handles the transformation of local changes to be compatible with server changes
 * that have been applied in the meantime.
 *
 * The process:
 * 1. Filters out local changes that are already in server changes
 * 2. Creates a patch from server changes that need to be transformed against
 * 3. Transforms each remaining local change against the server patch
 * 4. Updates revision numbers for the transformed changes
 *
 * @param serverChanges - Array of changes received from the server
 * @param localChanges - Array of local changes that need to be rebased
 * @returns Array of rebased local changes with updated revision numbers
 */
export function rebaseChanges(serverChanges: Change[], localChanges: Change[]): Change[] {
  if (!serverChanges.length || !localChanges.length) {
    return localChanges;
  }

  const lastChange = serverChanges[serverChanges.length - 1];
  const receivedIds = new Set(serverChanges.map(change => change.id));
  const transformAgainstIds = new Set(receivedIds);

  // Filter out local changes that are already in server changes
  const filteredLocalChanges: Change[] = [];
  for (const change of localChanges) {
    if (receivedIds.has(change.id)) {
      transformAgainstIds.delete(change.id);
    } else {
      filteredLocalChanges.push(change);
    }
  }

  // Create a patch from server changes that need to be transformed against
  const transformPatch = new JSONPatch(
    serverChanges
      .filter(change => transformAgainstIds.has(change.id))
      .map(change => change.ops)
      .flat()
  );

  // Rebase local changes against server changes
  const base = lastChange.rev;
  let rev = lastChange.rev;
  return filteredLocalChanges
    .map(change => {
      rev++;
      const ops = transformPatch.transform(change.ops).ops;
      if (!ops.length) return null;
      return { ...change, base, rev, ops };
    })
    .filter(Boolean) as Change[];
}

export function isChange(change: Change | DeletedChange): change is Change {
  return 'rev' in change;
}
