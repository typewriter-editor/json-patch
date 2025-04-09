import type { Change, PatchStoreBackend, VersionMetadata } from './types';

/**
 * Helps retrieve historical information (versions, changes) for a document
 * using the new versioning model based on IDs and metadata.
 */
export class HistoryManager {
  constructor(
    private readonly docId: string,
    private readonly store: PatchStoreBackend
  ) {}

  /**
   * Lists version metadata for the document, supporting various filters.
   * @param options Filtering and sorting options (e.g., limit, reverse, origin, groupId, date range).
   * @returns A list of version metadata objects.
   */
  async listVersions(
    options: {
      limit?: number;
      reverse?: boolean; // Sort by startDate descending
      origin?: 'online' | 'offline' | 'branch';
      groupId?: string;
      startDateAfter?: number;
      endDateBefore?: number;
      // Add pagination (e.g., startAfterVersionId) if needed
    } = {}
  ): Promise<VersionMetadata[]> {
    return await this.store.listVersions(this.docId, options);
  }

  /**
   * Loads the metadata for a specific version by its ID.
   * @param versionId The unique ID of the version.
   * @returns The VersionMetadata object or null if not found.
   */
  async getVersionMetadata(versionId: string): Promise<VersionMetadata | null> {
    try {
      return await this.store.loadVersionMetadata(this.docId, versionId);
    } catch (error) {
      console.warn(`Metadata for version ${versionId} not found for doc ${this.docId}.`, error);
      return null;
    }
  }

  /**
   * Loads the full document state snapshot for a specific version by its ID.
   * @param versionId - The unique ID of the version.
   * @returns The document state at that version.
   * @throws Error if the version ID is not found or state loading fails.
   */
  async getStateAtVersion(versionId: string): Promise<any> {
    try {
      return await this.store.loadVersionState(this.docId, versionId);
    } catch (error) {
      console.error(`Failed to load state for version ${versionId} of doc ${this.docId}.`, error);
      throw new Error(`Could not load state for version ${versionId}.`);
    }
  }

  /**
   * Loads the list of original client changes that were included in a specific version.
   * Useful for replaying/scrubbing through the operations within an offline or online session.
   * @param versionId - The unique ID of the version.
   * @returns An array of Change objects.
   * @throws Error if the version ID is not found or change loading fails.
   */
  async getChangesForVersion(versionId: string): Promise<Change[]> {
    try {
      return await this.store.loadVersionChanges(this.docId, versionId);
    } catch (error) {
      console.error(`Failed to load changes for version ${versionId} of doc ${this.docId}.`, error);
      throw new Error(`Could not load changes for version ${versionId}.`);
    }
  }

  /**
   * Convenience method to get the state of the parent version.
   * Useful for client-side scrubbing, providing the state *before* a version's changes were applied.
   * @param versionId - The ID of the version whose parent state is needed.
   * @returns The state of the parent version, or undefined if it's the root version or parent not found.
   */
  async getParentState(versionId: string): Promise<any | undefined> {
    const metadata = await this.getVersionMetadata(versionId);
    if (!metadata?.parentId) {
      return undefined; // Root version or metadata fetch failed
    }
    try {
      return await this.getStateAtVersion(metadata.parentId);
    } catch (error) {
      console.warn(`Could not load parent state for version ${versionId} (parent ID: ${metadata.parentId}).`, error);
      return undefined; // Parent exists but state load failed
    }
  }

  /**
   * Lists committed server changes for the document, typically used for server-side processing
   * or deep history analysis based on raw revisions.
   * @param options - Options like start/end revision, limit.
   * @returns The list of committed Change objects.
   */
  async listServerChanges(
    options: {
      limit?: number;
      startAfterRev?: number;
      endBeforeRev?: number;
      reverse?: boolean;
    } = {}
  ) {
    return await this.store.listChanges(this.docId, options);
  }
}
