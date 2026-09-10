# Add IBM Plex Mono and Commit Mono

## Goal

Add IBM Plex Mono and Commit Mono as locally bundled font options in the editor's appearance settings while preserving offline support and the existing user preferences flow.

## Assumptions

- Both fonts will be added to the existing **Typography → Font** selector.
- Font files will be bundled locally in WOFF2 format; the application must not depend on external font providers.
- `Courier New` will remain the default font.
- Regular (`400`) and bold (`700`) weights will be included because both are used by the editor UI.
- Existing values stored under `local-notes:preferences:v1` must remain valid and require no storage migration.

## Implementation plan

### 1. Add the font assets

- Create `src/assets/fonts/`.
- Add local WOFF2 files for:
  - IBM Plex Mono Regular (`400`),
  - IBM Plex Mono Bold (`700`),
  - Commit Mono Regular (`400`),
  - Commit Mono Bold (`700`).
- Include the license files distributed with both fonts.
- Verify that the selected files contain Polish characters.

### 2. Register the fonts in CSS

- Add `@font-face` declarations to `src/styles.css` for IBM Plex Mono and Commit Mono.
- Define separate declarations for the `400` and `700` weights.
- Use `font-style: normal` and `font-display: swap`.
- Reference the local WOFF2 assets so Vite can fingerprint and bundle them.

### 3. Extend the supported font model

- Update `EditorFontFamily` in `src/types.ts` with:
  - `"IBM Plex Mono"`,
  - `"Commit Mono"`.
- Add both values to `EDITOR_FONT_FAMILIES` in `src/preferences.ts`.
- Keep `DEFAULT_PREFERENCES.fontFamily` unchanged.

The existing mapping in `AppearanceSettings.tsx` will then expose both fonts in the selector without introducing additional component state.

### 4. Define reliable fallback stacks

- Refactor `applyPreferences()` in `src/preferences.ts` so it maps each supported font to an explicit CSS font stack.
- Use the following fallback order for the new monospace fonts:

  ```css
  "IBM Plex Mono", SFMono-Regular, Consolas, "Liberation Mono", monospace
  ```

  ```css
  "Commit Mono", SFMono-Regular, Consolas, "Liberation Mono", monospace
  ```

- Preserve suitable monospace, serif, and sans-serif fallbacks for the existing choices.

### 5. Preserve offline support

- Extend `workbox.globPatterns` in `vite.config.ts` to include WOFF2 files.
- Build the application and verify that the generated font assets are included in the Workbox precache manifest.

### 6. Extend automated tests

Update `src/preferences.test.ts` to verify that:

- `isEditorFontFamily()` accepts IBM Plex Mono and Commit Mono,
- stored preferences containing either new font are parsed without correction,
- either font can be saved and restored through the existing preferences flow,
- `applyPreferences()` sets the expected CSS variable and fallback stack,
- unsupported font names are still rejected and replaced with the default value.

### 7. Verify the implementation

Run:

```bash
npm test
npm run build
```

Perform a manual check confirming that:

- both fonts appear in **Typography → Font**,
- changing the selection immediately updates the editor,
- the selected font remains active after a page reload,
- Polish characters render correctly,
- regular and bold text use the correct bundled font files,
- both fonts remain available when the installed PWA is opened offline.

## Acceptance criteria

- IBM Plex Mono and Commit Mono are available in the font selector.
- Selecting either font updates the editor without reloading the page.
- The selected value is persisted in `localStorage`.
- Existing saved font preferences continue to work.
- Both fonts support Polish characters and the required `400` and `700` weights.
- No external network request is required to load the fonts.
- Font assets are available offline through the PWA cache.
- All tests, type checks, and the production build pass.
