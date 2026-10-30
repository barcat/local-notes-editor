# Lokalne notatki

Mały edytor zwykłego tekstu z lokalnym zapisem notatek w IndexedDB i opcjonalnym podglądem Markdown. Aplikacja nie wysyła treści notatek do sieci.

## Podgląd notatki

Włącz podgląd ikoną oka w panelu lub skrótem `Ctrl+Enter`. Ten sam skrót albo `Escape` przywraca edycję. Podgląd obsługuje akapity, nagłówki 1–6, pogrubienie, kursywę, kod w linii i blokach, listy (również zagnieżdżone), cytaty, separatory i twarde przejścia linii. Pojedynczy Enter w zwykłym tekście pozostaje widoczną nową linią.

Linki z poprawnym bezwzględnym adresem HTTP/HTTPS otwierają się w nowej karcie. HTML, obrazy i niedozwolone linki są wyświetlane dosłownie; obrazy nie są pobierane. Tabele, przekreślenia i checkboxy GFM nie są interpretowane. Kod nie ma kolorowania składni.

Edycja, autosave, IndexedDB i eksport `.txt` zawsze zachowują oryginalny tekst Markdown. Samo przełączenie trybu nie zapisuje notatki i zachowuje zaznaczenie oraz historię undo/redo. Tokenizacja działa lokalnie w Workerze. Podczas przygotowywania podglądu oraz po przekroczeniu limitów lub błędzie widoczny jest cały tekst źródłowy. Limity to 250 000 jednostek długości tekstu, 10 000 tokenów, głębokość 32 i 1000 ms na odpowiedź Workera. Ponowna próba następuje po zmianie treści lub ponownym otwarciu podglądu.

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

Build tworzy statyczny katalog `dist/` z aplikacją, `404.html`, manifestem i service workerem. Service worker precachuje skompilowane zasoby aplikacji, w tym Worker Markdown; podgląd działa offline po pierwszym precache, także po odświeżeniu. Notatki pozostają w IndexedDB, a preferencje w localStorage.

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

Rozszerzenie podglądu opisują [plan Markdown](.docs/MARKDOWN-PREVIEW-PLAN.md), [projekt techniczny](.docs/TECHNICAL-DESIGN.md#podgląd-markdown) i [raport weryfikacji](.docs/MARKDOWN-PREVIEW-VERIFICATION.md).
