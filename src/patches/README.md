# Patch Synchronization System (`src/patches/`)

This directory contains the core logic for a real-time document synchronization system based on JSON Patches and Operational Transformation (OT). It supports collaborative editing, offline changes, branching, and version history.

## Core Concepts

1.  **JSON Patch (RFC 6902):** Changes to documents are represented as a sequence of operations (`ops`) like `add`, `remove`, `replace`, etc., targeting specific paths within a JSON document.
2.  **Change Object (`Change`):** A wrapper around JSON Patch operations (`ops`) that includes crucial metadata:
    - `id`: Unique identifier for the change (client-generated).
    - `ops`: The array of JSON Patch operations.
    - `created`: Client timestamp when the change was made.
    - `baseRev`: The server revision number the change was based on (required when sending to server).
    - `rev`: The server revision number assigned _after_ the change is committed (server-assigned).
    - Other custom metadata can be included.
3.  **Operational Transformation (OT):** The algorithm used server-side (`PatchServer`) to reconcile concurrent changes. When a client sends changes based on an older revision (`baseRev`), the server transforms these changes against any changes that occurred in the meantime, ensuring eventual consistency.
4.  **Revisions (`rev`):** A monotonically increasing integer maintained by the server for each document, representing a specific point in the committed history. Each committed change increments the revision number.
5.  **Versions (`VersionMetadata`, State, Changes):** Represents a significant point-in-time snapshot of the document, along with metadata about how it was created. Unlike simple revisions, versions capture meaningful editing sessions or specific events like branching or offline synchronization. Each version has:
    - `id`: A unique identifier (UUID) for this specific version record.
    - `parentId`: The `id` of the version this one follows sequentially. `null` for the very first version or the first version in a new branch. Defines the historical lineage (DAG).
    - `groupId`: An identifier linking versions belonging to the same offline batch or the same branch. For branches, this is the `branch.id` (which is the `docId` of the branch document). For offline batches, a unique ID is generated per batch.
    - `origin`: Indicates how the version was created ('online', 'offline', 'branch').
    - `branchName`: User-defined name if `origin` is 'branch'.
    - `startDate`, `endDate`: Timestamps marking the beginning and end of the changes captured in this version. For single server commits, they might be the same. For offline sessions, they span the session duration. Used for chronological sorting.
    - `baseRev`: The main timeline server revision number from which this version (or group) diverged.
    - `state`: A complete snapshot of the document JSON _at the end_ of this version (`endDate`).
    - `changes`: An array containing the _original_ `Change` objects (with their client ops) that constitute this version. Essential for scrubbing/replaying history within a version.
6.  **Offline Handling:** When a client submits a batch of changes made offline:
    - The `PatchServer` detects session breaks based on timestamps (`sessionTimeoutMinutes`).
    - For each detected session, it saves a distinct `VersionMetadata` record with `origin: 'offline'`, preserving the _original_ client changes and the resulting state for that session _before_ transformation. This allows viewing history exactly as the user experienced it offline.
    - The entire batch is then transformed against server history and committed as a single new server revision (potentially creating an `origin: 'online'` version).
7.  **Branching:** Allows creating a separate document (`branch`) that starts from a specific revision of a source document. Changes can be made independently on the branch. Versions created on the branch have `origin: 'branch'` and `groupId` set to the branch document's ID. Merging involves transforming branch changes back onto the source document.

## Client-Side Usage (`PatchDoc`)

The `PatchDoc<T>` class manages the state of a document on the client.

- **Initialization:** `new PatchDoc(initialState, initialMetadata)`
- **State Access:**
  - `doc.state`: Returns the current local state (including pending changes).
  - `doc.committedRev`: Returns the revision number of the last confirmed server state. Use this as `baseRev` for new changes.
- **Making Changes:**
  - `doc.setChangeMetadata(metadata)`: Set custom data to include in subsequent changes.
  - `doc.update(draft => { draft.some.property = 'new value'; })`: Modifies the local state using an Immer-like draft function. It generates a `Change` object containing the JSON Patch diff.
  - Returns the `Change` object (or `null` if no changes were made).
- **Sending Changes:**
  - `const changesToSend = doc.getUpdatesForServer();`: Gets an array of pending `Change` objects.
  - Send these changes (as a batch) to your server endpoint (which uses `PatchServer.receiveChanges`). Remember to include the correct `baseRev` (which is `doc.committedRev`) on the _first_ change or ensure all changes in the batch share the same `baseRev`.
- **Receiving Updates:**
  - `doc.applyServerUpdate(serverChanges)`: Applies committed changes received from the server. This typically involves receiving the _single_ server change that represents a batch commit. The client updates its `committedState`, `committedRev`, rebases any remaining `pendingChanges` against the _server_ change, and updates the local `state`. If `applyServerUpdate` receives an empty array, it signifies the client's batch resulted in no effective change on the server (transformed away), and the client should clear those pending changes.
- **Events:**
  - `doc.onBeforeChange(listener)`: Fires before a local `update` is applied.
  - `doc.onChange(listener)`: Fires after a local `update` is applied with the generated `Change`.
  - `doc.onUpdate(listener)`: Fires whenever the local `state` is updated (either by local `update` or `applyServerUpdate`).
- **Serialization:**
  - `doc.export()`: Exports the committed state, committed revision, and pending changes.
  - `doc.import(versionData)`: Imports a previously exported version.

## Server-Side Usage

### `PatchServer`

Handles the core OT logic and versioning.

- **Initialization:** `new PatchServer(patchStoreBackend, { sessionTimeoutMinutes: 30 })`
- **Receiving Changes:**
  - `server.receiveChanges(docId, clientChanges)`: The main entry point. Processes a batch of changes:
    1.  Validates `baseRev`.
    2.  Detects offline sessions, saves pre-transform `origin: 'offline'` versions.
    3.  Transforms the entire batch against server history since `baseRev`.
    4.  Applies the final transformed ops.
    5.  Saves one committed server `Change` record (if ops remain).
    6.  Optionally creates an `origin: 'online'` version based on time elapsed.
    7.  Returns an array containing the single committed server change, or an empty array if the batch transformed to no-op.
- **Getting Latest State:**
  - `server.getLatestDocumentStateAndRev(docId)`: Gets the most up-to-date state and revision number.
- **Accessing History:**
  - `server.listVersions(docId, options)`: Lists version metadata based on filters (origin, group, date, etc.).
  - `server.getVersionMetadata(docId, versionId)`: Gets metadata for a single version.

### `BranchManager`

Manages the creation and lifecycle of branches.

- **Initialization:** `new BranchManager(branchingStoreBackend)`
- **Creating Branches:**
  - `manager.createBranch(sourceDocId, sourceRev, branchName?, metadata?)`: Creates a new document (`branchDocId`) initialized with the state of `sourceDocId` at `sourceRev`. Creates an initial `origin: 'branch'` version for the new document and a `Branch` metadata record. Returns the `branchDocId`.
- **Listing Branches:**
  - `manager.listBranches(sourceDocId)`: Lists `Branch` records associated with a source document.
- **Managing Branches:**
  - `manager.updateBranch(branchId, updates)`: Updates branch metadata (name, status).
  - `manager.closeBranch(branchId, status?)`: Marks a branch as closed (e.g., 'merged', 'abandoned').

### `HistoryManager`

Provides convenient methods primarily for clients or history viewers to access version data.

- **Initialization:** `new HistoryManager(docId, patchStoreBackend)`
- **Listing Versions:**
  - `manager.listVersions(options)`: Lists `VersionMetadata` based on filters.
- **Accessing Version Data:**
  - `manager.getVersionMetadata(versionId)`: Get metadata for one version.
  - `manager.getStateAtVersion(versionId)`: Get the complete document state snapshot for a version.
  - `manager.getChangesForVersion(versionId)`: Get the array of original `Change` objects associated with a version.
  - `manager.getParentState(versionId)`: Get the state snapshot of the parent version (useful for scrubbing).
- **Accessing Raw Commits:**
  - `manager.listServerChanges(options)`: List raw server `Change` objects based on revision numbers.

## Storage Backend (`PatchStoreBackend`, `BranchingStoreBackend`)

These are interfaces (defined in `types.ts`) that the server classes rely on for persistence. You need to provide concrete implementations (e.g., using a database like PostgreSQL, MongoDB, or even in-memory stores for testing).

Key methods expected (based on the refactored code):

- `getLatestRevision(docId): Promise<number>`
- `getLatestState(docId): Promise<any>`
- `getStateAtRevision(docId, rev): Promise<any>`
- `saveChange(docId, change): Promise<void>`
- `listChanges(docId, options): Promise<Change[]>`
- `saveVersion(docId, id, parentId, groupId, origin, branchName, startDate, endDate, baseRev, state, changes): Promise<void>` // Example signature, adjust as needed
- `loadVersionMetadata(docId, versionId): Promise<VersionMetadata | null>`
- `loadVersionState(docId, versionId): Promise<any>`
- `loadVersionChanges(docId, versionId): Promise<Change[]>`
- `listVersions(docId, options): Promise<VersionMetadata[]>`
- `getLatestVersionMetadata(docId): Promise<VersionMetadata | null>`
- (For BranchingStoreBackend) `createBranch(branch): Promise<void>`
- (For BranchingStoreBackend) `listBranches(docId): Promise<Branch[]>`
- (For BranchingStoreBackend) `updateBranch(branchId, updates): Promise<void>`
