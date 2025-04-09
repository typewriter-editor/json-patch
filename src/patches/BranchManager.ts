import { createId } from 'crypto-id';
import type { PatchServer } from './PatchServer';
import type { Branch, BranchingStoreBackend, Change, VersionMetadata } from './types';

/**
 * Helps manage branches for a document. A branch is a document that is branched from another document. Its first
 * version will be the point-in-time of the original document at the time of the branch. Branches allow for parallel
 * development of a document with the ability to merge changes back into the original document later.
 */
export class BranchManager {
  constructor(
    private readonly store: BranchingStoreBackend,
    private readonly patchServer: PatchServer
  ) {}

  /**
   * Lists all open branches for a document.
   * @param docId - The ID of the document.
   * @returns The branches.
   */
  async listBranches(docId: string): Promise<Branch[]> {
    return await this.store.listBranches(docId);
  }

  /**
   * Creates a new branch for a document.
   * @param docId - The ID of the document to branch from.
   * @param rev - The revision of the document to branch from.
   * @param branchName - Optional name for the branch.
   * @param metadata - Additional optional metadata to store with the branch.
   * @returns The ID of the new branch document.
   */
  async createBranch(docId: string, rev: number, branchName?: string, metadata?: Record<string, any>): Promise<string> {
    // 1. Get the state of the source document at the specified revision
    const stateAtRev = await this.store.getStateAtRevision(docId, rev);

    // 2. Create the new branch document ID
    const branchDocId = createId();

    // 3. Create and save the initial version for the branch document
    const now = Date.now();
    const initialVersionId = createId();
    const initialVersionMetadata: VersionMetadata = {
      id: initialVersionId,
      parentId: null,
      groupId: branchDocId,
      origin: 'branch',
      branchName: branchName,
      startDate: now,
      endDate: now,
      baseRev: rev,
      state: stateAtRev,
      changes: [],
    };
    await this.store.saveVersion(branchDocId, initialVersionMetadata);

    // 4. Create the branch metadata record
    const branch: Branch = {
      id: branchDocId,
      branchedFromId: docId,
      branchedRev: rev,
      created: now,
      name: branchName,
      status: 'open',
      ...(metadata && { metadata }),
    };
    await this.store.createBranch(branch);

    return branchDocId;
  }

  /**
   * Closes a branch, marking it as merged or deleted.
   * @param branchId - The ID of the branch to close.
   * @param status - The status to set for the branch.
   */
  async closeBranch(branchId: string, status: Branch['status'] = 'closed'): Promise<void> {
    await this.store.updateBranch(branchId, { status });
  }

  /**
   * Merges changes from a branch back into its source document.
   * @param branchId - The ID of the branch document to merge.
   * @returns The server commit change(s) applied to the source document.
   * @throws Error if branch not found, already closed/merged, or merge fails.
   */
  async mergeBranch(branchId: string): Promise<Change[]> {
    // 1. Load branch metadata
    const branch = await this.store.loadBranch(branchId);
    if (!branch) {
      throw new Error(`Branch with ID ${branchId} not found.`);
    }
    if (branch.status !== 'open') {
      throw new Error(`Branch ${branchId} is not open (status: ${branch.status}). Cannot merge.`);
    }

    const sourceDocId = branch.branchedFromId;
    const branchStartRevOnSource = branch.branchedRev;

    // 2. Get all committed server changes made on the branch document since it was created.
    const branchChanges = await this.store.listChanges(branchId, {
      /* No startAfterRev needed? */
    });

    if (branchChanges.length === 0) {
      console.log(`Branch ${branchId} has no changes to merge.`);
      await this.closeBranch(branchId, 'merged');
      return [];
    }

    // 3. Prepare the changes for submission to the source document.
    const changesToSubmit: Change[] = branchChanges.map(change => ({
      ...change,
      baseRev: branchStartRevOnSource,
    }));

    // 4. Submit the batch of changes to the source document via PatchServer.
    let committedMergeChanges: Change[] = [];
    try {
      committedMergeChanges = await this.patchServer.receiveChanges(sourceDocId, changesToSubmit);
    } catch (error) {
      console.error(`Failed to merge branch ${branchId} into ${sourceDocId}:`, error);
      throw new Error(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 5. Merge succeeded. Update the branch status.
    await this.closeBranch(branchId, 'merged');

    return committedMergeChanges;
  }
}
