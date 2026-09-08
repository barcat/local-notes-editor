# Lokalne notatki

Mały edytor zwykłego tekstu z lokalnym zapisem notatek w IndexedDB. Aplikacja nie wysyła treści notatek do sieci i nie interpretuje HTML ani Markdown.

## Uruchomienie

```bash
npm install
npm run dev
```

Następnie otwórz adres pokazany przez Vite. Dane są przechowywane osobno dla tej przeglądarki i originu.

## Testy i build

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

Build tworzy statyczny katalog `dist/` z aplikacją, `404.html`, manifestem i service workerem. Service worker precachuje wyłącznie skompilowane zasoby aplikacji; notatki pozostają w IndexedDB, a preferencje w localStorage.

## GitHub Pages i base path

Domyślny base to `/`. Dla repozytorium publikowanego pod ścieżką ustaw `VITE_BASE_PATH` przed buildem:

```bash
VITE_BASE_PATH=/local-notes-editor/ npm run build
```

W PowerShell:

```powershell
$env:VITE_BASE_PATH = "/local-notes-editor/"
npm run build
```

Build zawiera base-aware `404.html`, który przekazuje do aplikacji wyłącznie ścieżkę URL. Dzięki temu bezpośrednie wejście na `/local-notes-editor/notatki/moj-pomysl` może odtworzyć trasę po stronie klienta. Rzeczywiste wdrożenie na GitHub Pages nie jest częścią tego repozytorium.

## Lokalna trwałość danych

- notatki: IndexedDB (`local-notes`),
- ustawienia wyglądu: `local-notes:preferences:v1` w localStorage,
- potwierdzenie informacji o lokalnych danych: `local-notes:data-notice-dismissed:v1`.

Usunięcie danych witryny lub profilu przeglądarki usuwa lokalne notatki. Eksport pojedynczej notatki jest dostępny jako UTF-8 `.txt`.

## Kontrola MVP

Zweryfikowany lokalnie scenariusz obejmuje: pusty start, autosave, utworzenie kolejnej notatki, szybkie przełączanie, konflikt slugów, odświeżenie, eksport i usuwanie. Kontrole builda obejmują wariant root oraz `VITE_BASE_PATH=/local-notes-editor/`. Szczegółowe założenia i kryteria pozostają w [.docs/IMPLEMENTATION-PLAN.md](.docs/IMPLEMENTATION-PLAN.md).
