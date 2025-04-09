import { createId } from 'crypto-id';
import { GetSubscribe, signal } from 'easy-signal';
import { createJSONPatch } from '../createJSONPatch';
import type { Change, PatchSnapshot } from './types';
import { applyChanges, rebaseChanges } from './utils';

/**
 * Represents a document synchronized using JSON patches.
 * Manages committed state, pending (local-only) changes, and
 * changes currently being sent to the server.
 */
export class PatchDoc<T extends object> {
  private _state: T;
  private _committedState: T;
  private _committedRev: number;
  private _pendingChanges: Change[] = []; // Changes made locally, not yet sent
  private _sendingChanges: Change[] = []; // Changes sent to server, awaiting confirmation
  private _onBeforeChange = signal<(change: Change, doc: PatchDoc<T>) => void>();
  private _onChange = signal<(change: Change, doc: PatchDoc<T>) => void>();
  private _onUpdate = signal<(newState: T, doc: PatchDoc<T>) => void>();
  private _changeMetadata: Record<string, any> = {};

  /** Subscribe to be notified before local state changes. */
  readonly onBeforeChange = this._onBeforeChange(GetSubscribe);
  /** Subscribe to be notified after local state changes are applied. */
  readonly onChange = this._onChange(GetSubscribe);
  /** Subscribe to be notified whenever state changes from any source. */
  readonly onUpdate = this._onUpdate(GetSubscribe);

  /**
   * Creates an instance of PatchDoc.
   * @param initialState Optional initial state.
   * @param initialMetadata Optional metadata to add to generated changes.
   */
  constructor(initialState: T = {} as T, initialMetadata: Record<string, any> = {}) {
    // Ensure initial state is properly cloned if it's an object/array
    this._committedState = JSON.parse(JSON.stringify(initialState));
    this._state = JSON.parse(JSON.stringify(initialState));
    this._committedRev = 0;
    this._changeMetadata = initialMetadata;
  }

  /** Current local state (committed + sending + pending). */
  get state(): T {
    return this._state;
  }

  /** Last committed revision number from the server. */
  get committedRev(): number {
    return this._committedRev;
  }

  /** Are there changes currently awaiting server confirmation? */
  get isSending(): boolean {
    return this._sendingChanges.length > 0;
  }

  /** Are there local changes that haven't been sent yet? */
  get hasPending(): boolean {
    return this._pendingChanges.length > 0;
  }

  /**
   * Basic export for potential persistence (may lose sending state).
   */
  export(): PatchSnapshot<T> {
    return {
      state: this._committedState,
      rev: this._committedRev,
      // Includes only pending, not sending changes. This is incomplete.
      changes: [...this._pendingChanges],
    };
  }

  /**
   * Basic import for potential persistence (may lose sending state).
   */
  import(snapshot: PatchSnapshot<T>) {
    this._committedState = JSON.parse(JSON.stringify(snapshot.state));
    this._committedRev = snapshot.rev;
    this._pendingChanges = snapshot.changes ? snapshot.changes : [];
    this._sendingChanges = []; // Assume import resets sending state
    this._recalculateLocalState();
    this._onUpdate(this._state, this);
  }

  /**
   * Sets metadata to be added to future changes.
   * @param metadata Metadata to be added to future changes.
   */
  setChangeMetadata(metadata: Record<string, any>) {
    this._changeMetadata = metadata;
  }

  /**
   * Applies an update to the local state, generating a patch and adding it to pending changes.
   * @param mutator Function modifying a draft state.
   * @returns The generated Change object or null if no changes occurred.
   */
  update(mutator: (draft: T) => void): Change | null {
    const patch = createJSONPatch(this._state, mutator);
    if (patch.ops.length === 0) {
      return null;
    }

    const rev =
      this._pendingChanges[this._pendingChanges.length - 1]?.rev ??
      this._sendingChanges[this._sendingChanges.length - 1]?.rev ??
      this._committedRev;

    // Note: Client-side 'rev' is just for local ordering and might be removed.
    // It's the baseRev that matters for sending.
    const change: Change = {
      id: createId(),
      ops: patch.ops,
      rev,
      baseRev: this._committedRev, // Based on the last known committed state
      created: Date.now(),
      ...(Object.keys(this._changeMetadata).length > 0 && { metadata: { ...this._changeMetadata } }),
    };

    this._onBeforeChange(change, this);

    // Apply to local state immediately
    this._state = patch.apply(this._state);
    this._pendingChanges.push(change);

    this._onChange(change, this);
    this._onUpdate(this._state, this);

    return change;
  }

  /**
   * Retrieves pending changes and marks them as sending.
   * @returns Array of changes ready to be sent to the server.
   * @throws Error if changes are already being sent.
   */
  getUpdatesForServer(): Change[] {
    if (this.isSending) {
      // It's generally simpler if the client waits for confirmation before sending more.
      // If overlapping requests are needed, state management becomes much more complex.
      throw new Error('Cannot get updates while previous batch is awaiting confirmation.');
    }
    if (!this.hasPending) {
      return [];
    }

    this._sendingChanges = this._pendingChanges;
    this._pendingChanges = [];

    // Ensure the baseRev is set correctly based on the committedRev *at the time of sending*
    // (The update method already does this, but double-check if logic changes)
    this._sendingChanges.forEach(change => {
      change.baseRev = this._committedRev;
    });

    return this._sendingChanges;
  }

  /**
   * Processes the server's response to a batch of changes sent via `getUpdatesForServer`.
   * @param serverCommit The array of committed changes from the server.
   *                     Expected to be empty (`[]`) if the sent batch was a no-op,
   *                     or contain a single `Change` object representing the batch commit.
   * @throws Error if the input format is unexpected or application fails.
   */
  applyServerConfirmation(serverCommit: Change[]): void {
    if (!Array.isArray(serverCommit)) {
      throw new Error('Invalid server confirmation format: Expected an array.');
    }

    if (!this.isSending) {
      console.warn('Received server confirmation but no changes were marked as sending.');
      // Decide how to handle this - ignore? Apply if possible?
      // For now, let's ignore if the server sent something unexpected.
      if (serverCommit.length === 0) return; // Ignore empty confirmations if not sending
      // If server sent a commit unexpectedly, it implies a state mismatch. Hard to recover.
      // Maybe apply cautiously if rev matches?
      const commit = serverCommit[0];
      if (commit && commit.rev === this._committedRev + 1) {
        console.warn('Applying unexpected server commit cautiously.');
        // Proceed as if confirmation was expected
      } else {
        throw new Error('Received unexpected server commit with mismatching revision.');
      }
    }

    if (serverCommit.length === 0) {
      // Server confirmed the batch was a no-op (transformed away).
      // The client's `_sendingChanges` are effectively discarded.
      console.log('Server confirmed batch as no-op.');
      this._sendingChanges = [];
      // No change to _committedState or _committedRev
      // Rebase any *new* pending changes against the *old* committed state (no server change occurred)
      // Since baseRev didn't change, no rebase needed. Just recalculate state.
    } else if (serverCommit.length === 1) {
      // Server confirmed the batch and returned the single resulting commit.
      const committedChange = serverCommit[0];

      if (!committedChange.rev || committedChange.rev <= this._committedRev) {
        throw new Error(`Server commit invalid revision: ${committedChange.rev}, expected > ${this._committedRev}`);
      }
      // if (committedChange.rev !== this._committedRev + 1) {
      //   // This indicates a potential issue, maybe missed updates?
      //   // Or server batches multiple client requests?
      //   // For now, strictly expect +1 unless server protocol changes.
      //   console.warn(`Server commit revision ${committedChange.rev} !== expected ${this._committedRev + 1}`);
      //   // Decide recovery strategy: request resync? Accept gap?
      // }

      // 1. Apply the server's committed change to our committed state
      try {
        this._committedState = applyChanges(this._committedState, [committedChange]);
      } catch (error) {
        console.error('Failed to apply server commit to committed state:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Critical sync error applying server commit: ${errorMessage}`);
      }

      // 2. Update committed revision
      this._committedRev = committedChange.rev;

      // 3. Discard the confirmed _sendingChanges
      const confirmedSentChanges = this._sendingChanges;
      this._sendingChanges = [];

      // 4. Rebase any *new* pending changes (added after getUpdatesForServer was called)
      //    against the change that the server *actually* applied.
      if (this.hasPending) {
        this._pendingChanges = rebaseChanges([committedChange], this._pendingChanges);
      }
    } else {
      throw new Error(`Unexpected server confirmation format: Expected 0 or 1 change, received ${serverCommit.length}`);
    }

    // 5. Recalculate the local state from the new committed state + rebased pending changes
    this._recalculateLocalState();

    // 6. Notify listeners
    this._onUpdate(this._state, this);
  }

  /**
   * Applies incoming changes from the server that were *not* initiated by this client.
   * @param externalServerChanges An array of sequential changes from the server.
   */
  applyExternalServerUpdate(externalServerChanges: Change[]): void {
    if (externalServerChanges.length === 0) {
      return;
    }

    const firstChange = externalServerChanges[0];
    // Allow for gaps if server sends updates out of order, but warn.
    if (firstChange.rev && firstChange.rev <= this._committedRev) {
      console.warn(
        `Ignoring external server update starting at revision ${firstChange.rev} which is <= current committed ${this._committedRev}`
      );
      return; // Ignore already processed or irrelevant changes
    }
    // if (firstChange.rev && firstChange.rev !== this._committedRev + 1) {
    //   console.warn(`External server update starting at ${firstChange.rev} does not directly follow committed ${this._committedRev}`);
    //   // Handle potential gaps - request resync? Apply cautiously?
    // }

    const lastChange = externalServerChanges[externalServerChanges.length - 1];

    // 1. Apply to committed state
    try {
      this._committedState = applyChanges(this._committedState, externalServerChanges);
    } catch (error) {
      console.error('Failed to apply external server update to committed state:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Critical sync error applying external server update: ${errorMessage}`);
    }

    // 2. Update committed revision
    if (lastChange.rev) {
      this._committedRev = lastChange.rev;
    } else {
      console.error('External server update missing revision on last change.');
      // Cannot reliably update revision - potential state divergence
    }

    // 3. Rebase *both* sending and pending changes against the external changes
    if (this.isSending) {
      this._sendingChanges = rebaseChanges(externalServerChanges, this._sendingChanges);
    }
    if (this.hasPending) {
      this._pendingChanges = rebaseChanges(externalServerChanges, this._pendingChanges);
    }

    // 4. Recalculate local state
    this._recalculateLocalState();

    // 5. Notify listeners
    this._onUpdate(this._state, this);
  }

  /** Recalculates _state from _committedState + _sendingChanges + _pendingChanges */
  private _recalculateLocalState(): void {
    try {
      let state = applyChanges(this._committedState, this._sendingChanges);
      this._state = applyChanges(state, this._pendingChanges);
    } catch (error) {
      console.error('Error recalculating local state after update:', error);
      // This indicates a potentially serious issue with patch application or rebasing logic.
      // Consider marking the document as desynchronized and requesting a full state refresh.
      // For now, log the error. State might be inconsistent.
    }
  }

  /**
   * @deprecated Use export() - kept for backward compatibility if needed.
   */
  toJSON(): PatchSnapshot<T> {
    return this.export();
  }
}
