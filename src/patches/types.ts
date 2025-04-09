import type { JSONPatchOp } from '../types';

export interface Change {
  /** Unique identifier for the change, generated client-side. */
  id: string;
  /** The patch operations. */
  ops: JSONPatchOp[];
  /** The revision number assigned on the client to the optimistic revision and updated by the server after commit. */
  rev: number;
  /** The server revision this change was based on. Required for client->server changes. */
  baseRev?: number;
  /** Client-side timestamp when the change was created. */
  created: number;
  /** Optional arbitrary metadata associated with the change. */
  metadata?: Record<string, any>;
}

/**
 * Represents a change that has been deleted on the server due to being a no-op.
 */
export type DeletedChange = { id: string };

/**
 * Represents the state of a document in the OT protocol.
 */
export interface PatchSnapshot<T = any> {
  state: T;
  rev: number;
  changes?: Change[]; // Kept for potential PatchDoc export/import compatibility
}

/** Status options for a branch */
export type BranchStatus = 'open' | 'closed' | 'merged' | 'archived' | 'abandoned';

export interface Branch {
  /** The ID of the branch document. */
  id: string;
  /** The ID of the document this document was branched from. */
  branchedFromId: string;
  /** The revision number on the source document where the branch occurred. */
  branchedRev: number;
  /** Server-side timestamp when the branch record was created. */
  created: number;
  /** Optional user-friendly name for the branch. */
  name?: string;
  /** Current status of the branch. */
  status: BranchStatus;
  /** Optional arbitrary metadata associated with the branch record. */
  metadata?: Record<string, any>;
}

/**
 * Metadata, state snapshot, and included changes for a specific version.
 */
export interface VersionMetadata {
  /** Unique identifier (UUID) for this version record. */
  id: string;
  /** ID of the parent version in the history DAG. Null for root versions. */
  parentId: string | null;
  /** Identifier linking versions from the same offline batch or branch. Null for regular online versions. */
  groupId?: string | null;
  /** Indicates how the version was created ('online', 'offline', 'branch'). */
  origin: 'online' | 'offline' | 'branch';
  /** User-defined name if origin is 'branch'. */
  branchName?: string | null;
  /** Timestamp marking the beginning of the changes included in this version (e.g., first change in session). */
  startDate: number;
  /** Timestamp marking the end of the changes included in this version (e.g., last change in session). */
  endDate: number;
  /** The main timeline server revision number from which this version (or group) diverged. */
  baseRev: number;
  /** Complete snapshot of the document state at the end of this version (`endDate`). */
  state: any; // Consider making this generic <T> if possible
  /** Array of the *original* Change objects included in this version. */
  changes: Change[];
}

/**
 * Options for listing committed server changes.
 */
export interface PatchStoreBackendListChangesOptions {
  /** List changes committed strictly *after* this revision number. */
  startAfterRev?: number;
  /** List changes committed strictly *before* this revision number. */
  endBeforeRev?: number;
  /** Maximum number of changes to return. */
  limit?: number;
  /** Return changes in descending revision order (latest first). Defaults to false (ascending). */
  reverse?: boolean;
}

/**
 * Options for listing version metadata.
 */
export interface PatchStoreBackendListVersionsOptions {
  /** Maximum number of versions to return. */
  limit?: number;
  /** Return versions in descending start date order (latest first). Defaults to false (ascending). */
  reverse?: boolean;
  /** Filter by the origin type. */
  origin?: 'online' | 'offline' | 'branch';
  /** Filter by the group ID (branch ID or offline batch ID). */
  groupId?: string;
  /** List versions whose start date is strictly *after* this timestamp. */
  startDateAfter?: number;
  /** List versions whose end date is strictly *before* this timestamp. */
  endDateBefore?: number;
  // Consider adding pagination support, e.g., startAfterVersionId?: string
}

/**
 * Interface for a backend storage system for patch synchronization.
 * Defines methods needed by PatchServer, HistoryManager, etc.
 */
export interface PatchStoreBackend {
  /** Gets the latest committed revision number for a document. Returns 0 if the document doesn't exist. */
  getLatestRevision(docId: string): Promise<number>;

  /** Gets the latest committed state for a document. Returns undefined if the document doesn't exist. */
  getLatestState(docId: string): Promise<any | undefined>;

  /** Reconstructs or retrieves the document state at a specific historical revision number. */
  getStateAtRevision(docId: string, rev: number): Promise<any | undefined>;

  /** Saves a committed server change record. */
  saveChange(docId: string, change: Change): Promise<void>;

  /** Lists committed server changes based on revision numbers. */
  listChanges(docId: string, options: PatchStoreBackendListChangesOptions): Promise<Change[]>;

  /**
   * Saves a version (metadata, state snapshot, and included changes).
   */
  saveVersion(docId: string, version: VersionMetadata): Promise<void>;

  /** Lists version metadata based on filtering/sorting options. */
  listVersions(docId: string, options: PatchStoreBackendListVersionsOptions): Promise<VersionMetadata[]>;

  /** Loads only the metadata for a specific version ID. */
  loadVersionMetadata(docId: string, versionId: string): Promise<VersionMetadata | null>;

  /** Loads the state snapshot for a specific version ID. */
  loadVersionState(docId: string, versionId: string): Promise<any | undefined>;

  /** Loads the original Change objects associated with a specific version ID. */
  loadVersionChanges(docId: string, versionId: string): Promise<Change[]>;

  /** Gets the metadata of the most recent version saved for a document, regardless of origin. */
  getLatestVersionMetadata(docId: string): Promise<VersionMetadata | null>;
}

/**
 * Extends PatchStoreBackend with methods specifically for managing branches.
 */
export interface BranchingStoreBackend extends PatchStoreBackend {
  /** Lists metadata records for branches originating from a document. */
  listBranches(docId: string): Promise<Branch[]>;

  /** Loads the metadata record for a specific branch ID. */
  loadBranch(branchId: string): Promise<Branch | null>;

  /** Creates or updates the metadata record for a branch. */
  createBranch(branch: Branch): Promise<void>; // Changed return type

  /** Updates specific fields (status, name, metadata) of an existing branch record. */
  updateBranch(branchId: string, updates: Partial<Pick<Branch, 'status' | 'name' | 'metadata'>>): Promise<void>;

  /**
   * @deprecated Use updateBranch with status instead.
   * Marks a branch as closed. Implementations might handle this via updateBranch.
   */
  closeBranch(branchId: string): Promise<void>;
}
