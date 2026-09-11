# Implementation Plan: Fix Note Creation and Title Editing

## Goal

Fix the bug where creating a new note can overwrite an existing one. Give new notes timestamp titles and require explicit confirmation of title changes while preserving content autosave.

## Problem

In `src/app.tsx`, `startNewNote()` clears the draft and navigates to the editor without a slug. Hydration then calls `getMostRecent()` and restores an existing note together with its ID. Subsequent autosave updates that existing note instead of creating a new one.

Additionally, `saveNote()` currently recalculates the slug on every save, including content autosaves.

## Assumptions

- Default titles use the browser's local time, with zero-padded components: `YYYY-MM-DD HH:mm`.
- Explicitly creating a note also persists its initial empty record. This reserves its unique slug and makes its URL reloadable immediately.
- Unconfirmed title edits are discarded when switching notes. Navigation still flushes content changes.
- Keep existing title normalization: trim whitespace and use `Bez tytułu` for an empty confirmed title.
- Existing notes require no data migration.

## Implementation Plan

### 1. Create complete notes with timestamp titles

Files: `src/noteOperations.ts`, `src/noteOperations.test.ts`.

- Add a testable date-formatting helper accepting a timestamp.
- Add a new-note factory that creates a fresh UUID, timestamp title, initial slug, empty content, and `updatedAt`.
- Reuse the existing unique-slug checks and collision retries when persisting the initial record.
- Preserve explicitly supplied titles in existing `createNote()` usages.

**Verify:** exact date format, distinct IDs, and unique slugs for two notes created within the same minute. Run `npm run typecheck`.

### 2. Fix the new-note navigation and hydration flow

File: `src/app.tsx`.

- Retain the existing flush of pending content before leaving the current note.
- Generate and persist the new note before navigating to its slug.
- Replace the slugless navigation in `startNewNote()` with navigation to the saved note's slug.
- Initialize the editor from that complete note, including its ID.
- Invalidate stale hydration results when creation starts; use the existing navigation sequencing mechanism to prevent older asynchronous work from replacing the new note.
- If saving fails, retain the current note and show the existing error UI.
- Prevent overlapping creation actions while one is pending.

**Verify:** create a second note, edit it, and confirm the first note remains unchanged. Run the regression test and `npm run build`.

### 3. Separate title input from autosaved note data

File: `src/app.tsx`.

- Keep the committed title in the note draft.
- Introduce separate state for the title field's unconfirmed text.
- Make title input update only that separate state.
- Content autosave must always use the committed title and slug.
- Ensure autosave callbacks do not reset unconfirmed title text.
- Reset title input when a different note is loaded.
- Derive button visibility from whether the input differs from the committed title.

**Verify:** edit the title, then edit content and wait for autosave. Content must persist while the stored title, slug, and URL remain unchanged.

### 4. Add explicit title confirmation

Files: `src/components/Editor.tsx`, `src/styles.css`, `src/app.tsx`, `src/noteOperations.ts`.

- Add a floppy-disk button beside the title field with accessible label `Zapisz tytuł`.
- Show it only when the title has changed; disable repeated submission while saving.
- On click, normalize the title and generate a unique slug, excluding the current note's ID from collision checks.
- Serialize confirmation with content writes through the existing save coordinator. Prevent an older autosave from restoring the previous title or slug.
- Preserve content entered while confirmation is in progress.
- After successful persistence, update the committed title, slug, URL, and sidebar.
- Hide the button when the displayed title matches the saved title. If the user has typed another change meanwhile, keep it visible.
- On failure, retain the pending title, previous URL, and retry button.
- Change content saves to preserve the committed slug; regenerate slugs only during creation or confirmed renaming.

**Verify:** successful confirmation, slug collision, failed confirmation, and content autosave overlapping a rename. Run `npm run build`.

### 5. Complete regression coverage and update existing expectations

Files: `src/app.test.tsx`, `src/noteOperations.test.ts`.

| Test | Expected result |
| --- | --- |
| Create and edit a second note | Two distinct IDs; first record unchanged |
| Create two notes within one minute | Same timestamp title allowed; unique slugs |
| Edit title without confirmation | No persisted title, slug, or URL change |
| Autosave content with a pending title edit | Content saved with committed title and slug |
| Confirm title | Same ID; updated title, unique slug, URL, and sidebar |
| Restore the original title before confirming | Confirmation button disappears |
| Delayed hydration during creation | Newly created note remains active |
| Delayed content save during confirmation | Latest content and confirmed title both survive |
| Confirmation fails | Previous URL retained; pending title remains retryable |

Update existing tests that expect an empty title after `+ New note` or automatic renaming while typing.

**Final gate:** run `npm test` and `npm run build`; manually check creation, title confirmation, switching notes, and reloading the updated URL.
