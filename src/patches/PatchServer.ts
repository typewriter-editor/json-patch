import { createId } from 'crypto-id';
import { applyPatch } from '../applyPatch';
import { transformPatch } from '../transformPatch';
import type { Change, PatchStoreBackend, VersionMetadata } from './types';
import { applyChanges } from './utils';

/**
 * Configuration options for the PatchServer.
 */
export interface PatchServerOptions {
  /**
   * The maximum time difference in minutes between consecutive changes
   * to be considered part of the same editing session for versioning.
   * Defaults to 30 minutes.
   */
  sessionTimeoutMinutes?: number;
}

/**
 * Handles the server-side Operational Transformation (OT) logic,
 * coordinating batches of changes, managing versioning based on sessions (including offline),
 * and persisting data using a backend store.
 */
export class PatchServer {
  private readonly sessionTimeoutMillis: number;

  constructor(
    private readonly store: PatchStoreBackend,
    options: PatchServerOptions = {}
  ) {
    this.sessionTimeoutMillis = (options.sessionTimeoutMinutes ?? 30) * 60 * 1000;
  }

  /**
   * Receives a batch of changes from a client, handles offline session versioning,
   * transforms changes against concurrent server history, applies them,
   * and persists the results.
   *
   * @param docId - The ID of the document to apply the changes to.
   * @param changes - An array of change objects received from the client. Should be sorted by client timestamp/sequence.
   * @returns An array containing the single committed server change representing the batch outcome.
   * @throws Error if the batch's baseRev is inconsistent or transformation fails.
   */
  async receiveChanges(docId: string, changes: Change[]): Promise<Change[]> {
    if (changes.length === 0) {
      return [];
    }

    // Assume all changes share the same baseRev. Client ensures this.
    const baseRev = changes[0].baseRev;
    if (baseRev === undefined) {
      throw new Error(`Client changes must include baseRev for doc ${docId}.`);
    }
    // Optional: Add check for inconsistent baseRev within the batch if needed
    // if (changes.some(c => c.baseRev !== baseRev)) { ... }

    // 1. Load server state details (assuming store methods exist)
    const currentRev = await this.store.getLatestRevision(docId);
    let currentState = await this.store.getLatestState(docId);

    // Basic validation
    if (baseRev > currentRev) {
      throw new Error(
        `Client baseRev (${baseRev}) is ahead of server revision (${currentRev}) for doc ${docId}. Client needs to rebase.`
      );
    }

    const offlineGroupIds: string[] = []; // Track group IDs created in this batch
    let currentSessionState = await this.store.getStateAtRevision(docId, baseRev); // State to apply original ops onto
    let lastVersionId: string | null = null; // Track parent for linking offline versions

    let sessionStartIndex = 0;
    const batchGroupId = createId(); // Single groupId for all offline versions from this batch

    for (let i = 1; i <= changes.length; i++) {
      const isLastChange = i === changes.length;
      const timeDiff = isLastChange ? Infinity : changes[i].created - changes[i - 1].created;

      // Session ends if timeout exceeded OR it's the last change in the batch
      if (timeDiff > this.sessionTimeoutMillis || isLastChange) {
        const sessionChanges = changes.slice(sessionStartIndex, i);
        if (sessionChanges.length > 0) {
          const sessionEndState = applyChanges(currentSessionState, sessionChanges); // Apply *original* ops
          const versionId = createId();
          const sessionMetadata: VersionMetadata = {
            id: versionId,
            parentId: lastVersionId, // Link to previous offline version in this batch
            groupId: batchGroupId,
            origin: 'offline',
            startDate: sessionChanges[0].created,
            endDate: sessionChanges[sessionChanges.length - 1].created,
            baseRev: baseRev, // Server rev the *batch* was based on
            state: sessionEndState, // State *after* this session's original ops
            changes: sessionChanges, // Original changes for this session
          };
          await this.store.saveVersion(docId, sessionMetadata); // Pass object directly

          lastVersionId = versionId; // Update parent for the next potential session
          currentSessionState = sessionEndState; // State for the start of the next session
          sessionStartIndex = i; // Move index for next slice
        }
      }
    }

    // 3. Load historical server changes for transformation
    const historicalChanges = await this.store.listChanges(docId, {
      startAfterRev: baseRev,
    });
    // Ensure order and assume listed changes always have a revision
    historicalChanges.sort((a, b) => a.rev! - b.rev!);

    // 4. Transform the *entire batch* of incoming changes against historical changes
    const allOriginalOps = changes.flatMap(c => c.ops);
    let transformedOps = [...allOriginalOps];
    let transformStateContext = await this.store.getStateAtRevision(docId, baseRev); // State at baseRev

    for (const historicalChange of historicalChanges) {
      // Assert non-null as these are committed changes from the store
      if (historicalChange.rev! <= baseRev) continue;
      transformedOps = transformPatch(transformStateContext, transformedOps, historicalChange.ops);
      transformStateContext = applyPatch(transformStateContext, historicalChange.ops).doc; // Update context state
    }

    // 5. Apply the final transformed ops to the current server state
    if (transformedOps.length === 0) {
      // Entire batch transformed away. No server change needed.
      // Client needs to know these changes were effectively deleted/ignored.
      // How to signal this? Returning empty array implies success but no *new* state change.
      // Client might infer deletion if its pending changes aren't reflected in subsequent updates.
      // Let's return empty array. Client clears pending based on this empty response for the batch.
      return [];
    }

    const { doc: finalState, errors: applyErrors } = applyPatch(currentState, transformedOps);
    if (applyErrors.length > 0) {
      console.error(`Error applying final transformed batch for doc ${docId}:`, applyErrors);
      throw new Error(`Failed to apply final transformed batch for doc ${docId}.`);
    }

    // 6. Create and Save ONE Committed Change on the server timeline
    const newRev = currentRev + 1;
    const committedServerChange: Change = {
      id: createId(), // Server generates its own ID for the commit
      ops: transformedOps,
      rev: newRev,
      created: Date.now(), // Server timestamp
      // Link back to the client batch changes it incorporates for traceability
      metadata: { incorporatedClientChangeIds: changes.map(c => c.id) },
    };
    await this.store.saveChange(docId, committedServerChange);

    // 7. Optionally save a regular 'online' version
    const lastVersionMeta = await this.store.getLatestVersionMetadata(docId); // Needs implementation
    const timeSinceLastVersion = lastVersionMeta ? committedServerChange.created - lastVersionMeta.endDate : Infinity;

    if (timeSinceLastVersion > this.sessionTimeoutMillis) {
      const versionId = createId();
      const onlineVersionMetadata: VersionMetadata = {
        id: versionId,
        parentId: lastVersionMeta?.id ?? null,
        // groupId: null, // Online versions might not belong to a batch/branch group
        origin: 'online',
        startDate: committedServerChange.created, // Point-in-time version
        endDate: committedServerChange.created,
        baseRev: currentRev, // Based on the previous server revision
        state: finalState,
        changes: [committedServerChange], // The change constituting this version
      };
      await this.store.saveVersion(docId, onlineVersionMetadata); // Pass object directly
    }

    // 8. Return the single committed server change
    // The client receives this, updates its committedRev to newRev, and clears the sent batch from pending.
    return [committedServerChange];
  }

  /**
   * Retrieves the latest state and revision of a document.
   * @param docId - The ID of the document.
   * @returns The latest state and revision.
   */
  async getLatestDocumentStateAndRev(docId: string): Promise<{ state: any; rev: number }> {
    // Assumes store methods exist
    const state = await this.store.getLatestState(docId);
    const rev = await this.store.getLatestRevision(docId);
    return { state, rev };
  }

  /**
   * Gets the metadata for a specific version.
   * @param docId The document ID (may be needed by store).
   * @param versionId The ID of the version.
   * @returns The version metadata or null if not found.
   */
  async getVersionMetadata(docId: string, versionId: string): Promise<VersionMetadata | null> {
    try {
      // Assumes store has loadVersionMetadata or similar
      return await this.store.loadVersionMetadata(docId, versionId);
    } catch (error) {
      console.error(`Failed to load metadata for version ${versionId} in doc ${docId}:`, error);
      return null;
    }
  }

  /**
   * Lists version metadata for a document, supporting various filters.
   * @param docId The document ID.
   * @param options Filtering and sorting options.
   * @returns A list of version metadata objects.
   */
  async listVersions(
    docId: string,
    options: {
      limit?: number;
      reverse?: boolean; // Sort by startDate descending
      origin?: 'online' | 'offline' | 'branch';
      groupId?: string;
      startDateAfter?: number;
      endDateBefore?: number;
      // Add pagination support if needed (e.g., startAfterVersionId)
    } = {}
  ): Promise<VersionMetadata[]> {
    // Assumes store.listVersions is updated
    return await this.store.listVersions(docId, options);
  }
}
