# Display the saved note title in the browser tab

## Goal

Show the title of the saved note in the browser tab, while preserving the generic application title when no valid note title is available.

## Requirements

- Derive `document.title` from `draft.title`, not from the editable `titleInput` state.
- Editing the title field must not change the browser tab title before the change is confirmed and saved.
- Update the browser tab title only after a new title has been successfully confirmed and persisted.
- When a note is opened or switched, update the title after the note has been hydrated.
- When a new note is created, immediately use its generated default title.
- Use `Lokalne notatki` as the fallback whenever hydration is incomplete or a valid note title is unavailable.

## Suggested implementation

Add an effect that observes the hydrated, saved draft:

```tsx
useEffect(() => {
  document.title = isHydrated && draft.title
    ? draft.title
    : "Lokalne notatki";
}, [draft.title, isHydrated]);
```

Keep the effect close to the state that owns `draft` and `isHydrated`, so the tab cannot temporarily keep the title of the previously opened note while another note is loading.

## Tests

Add tests that verify:

1. Opening an existing note sets `document.title` to that note's saved title after hydration.
2. Editing the title input without saving leaves `document.title` unchanged.
3. Confirming and saving a changed title updates `document.title`.
4. Switching or loading notes never leaves the previous note's title visible; the fallback is used until the next note has hydrated.
5. Creating a new note uses its generated default title immediately.
6. Missing or invalid titles fall back to `Lokalne notatki`.
