# Local version history

Checkpoints save the supplied project and workspace files in IndexedDB before attempting optional cloud synchronization. The content-addressed blob store shares unchanged files and artwork across checkpoints. A checkpoint can be compared, restored, and exported while its cloud copy is unavailable.

Authenticated saves give remote synchronization one five-second deadline, shared across session lookup, remote project initialization, and the `git-proxy` request. Network requests receive an abort signal. A timeout returns the completed local checkpoint with an explicit remote-sync error; it does not report cloud success. A late remote response cannot replace the working draft, move the local history head, or mark that timed-out checkpoint as synced.

Remote project linkage is checkpoint sync metadata (`ProjectGitCommitRecord.remoteProjectId` in `../git.ts`). Subsequent saves read the persisted link; older projects with `manifest.remoteProjectId` remain supported. Linking a cloud project does not change the saved game design or create a new dirty draft.

## Portable backups

`archive.ts` exports the working draft, checkpoint graph, active checkpoint, and deduplicated artwork. Import validates the archive before making a new game visible and preserves checkpoint relationships and dates.

An imported backup is a separate game. Both legacy manifest cloud links and checkpoint sync links are deliberately omitted from the imported copy, so its future checkpoints cannot write into the original game's cloud history. Its first successful authenticated synchronization can create a separate remote project.

## Regression coverage

Run `npm run test:versions` from the repository root. The suite includes checkpoint/restore integrity, artwork and component-template round trips, invalid archive rejection, and `tests/workshop/checkpointSync.test.ts` coverage for stalled authentication, slow uploads, offline saves, late replies, cloud-link reuse, and detached archive copies.
