# Technical Design

## 1. Goals

Projekt techniczny opisuje statyczną, desktopową aplikację typu SPA do tworzenia, edytowania, wyszukiwania, zmiany nazwy, usuwania oraz ręcznego eksportowania i importowania zwykłych notatek tekstowych.

Aplikacja musi:

- działać bez backendu, kont użytkowników i synchronizacji;
- przechowywać notatki wyłącznie lokalnie w IndexedDB bieżącego profilu przeglądarki;
- identyfikować notatkę wewnętrznie przez UUID, a w adresie przez unikalny slug;
- obsługiwać trasy `/`, `/notatki/:slug` i `/ustawienia`, również po bezpośrednim wejściu na adres hostowany przez GitHub Pages;
- automatycznie zapisywać treść po krótkiej bezczynności i jednoznacznie pokazywać stan zapisu;
- działać po utracie połączenia z internetem, jeżeli zasoby aplikacji zostały wcześniej załadowane;
- nie interpretować ani nie wysyłać treści, tytułów i slugów notatek;
- umożliwiać odtworzenie danych z ręcznie wyeksportowanej kopii JSON;
- zapewniać główne przepływy dostępne z klawiatury i zgodne co najmniej z WCAG 2.1 AA.

## 2. Assumptions

- Repozytorium będzie zawierało jedną aplikację frontendową, a wynik kompilacji będzie publikowany jako statyczny katalog.
- Docelowy prefiks GitHub Pages, np. `/nazwa-repo/`, będzie podawany podczas budowania przez konfigurację Vite. Logiczne trasy opisane w PRD nie zawierają tego prefiksu.
- Slug powstaje z pełnego tytułu przed ograniczeniem długości; po normalizacji zostaje skrócony do maksymalnie 80 znaków, a końcowy myślnik po skróceniu jest usuwany.
- Zarezerwowane slugi na pierwszym segmencie to `notatki` i `ustawienia`. Walidacja listy jest scentralizowana, aby można ją było rozszerzyć tylko w razie dodania nowych tras.
- Dla konfliktu przy tworzeniu aplikacja proponuje pierwszy wolny wariant liczbowy (`slug-2`, `slug-3`, ...), ale użytkownik zatwierdza utworzenie. Przy zmianie nazwy konflikt blokuje zapis, zgodnie z PRD.
- Wejście na nieistniejący `/notatki/:slug` nie tworzy rekordu. Rekord powstaje przy pierwszej zmianie treści; tytuł początkowy jest czytelną wersją sluga, którą użytkownik może zmienić.
- Bezpośrednia edycja tytułu jest traktowana jako operacja zmiany nazwy i podlega walidacji sluga przed utrwaleniem.
- Automatyczny zapis jest uruchamiany 400 ms po ostatniej zmianie, czyli wewnątrz zakresu 300–500 ms z PRD.
- Daty są przechowywane w UTC jako ISO 8601, a wyświetlane w lokalnej strefie i formacie przeglądarki.
- Lista notatek jest sortowana malejąco według `updatedAt`; wyszukiwanie nazwy nie uwzględnia wielkości liter.
- Import działa jako poprzedzony podsumowaniem konfliktów proces dla całego pliku. Użytkownik wybiera sposób rozwiązania każdego konfliktu albo jedną regułę dla wszystkich konfliktów.
- Konflikt importu oznacza zajęty `slug`. Przy zastąpieniu istniejący rekord zachowuje własne `id`, a pozostałe pola przyjmuje z importu. Pozwala to zachować lokalną tożsamość rekordu.
- Import nie usuwa lokalnych notatek nieobecnych w kopii zapasowej.
- Potwierdzenie usunięcia zawiera nazwę notatki, ale nie wymaga jej ręcznego przepisywania.
- Opcjonalny licznik słów nie należy do MVP i nie jest częścią tego projektu.
- CSS z sekcji 11.1 PRD jest normatywną bazą wizualną MVP. Techniczne uzupełnienia są dozwolone tylko dla dostępności, pozostałych widoków i lokalnego osadzenia fontu.
- Klasy `.focus-muted` i `.focus-active` nie oznaczają implementacji Focus Mode; ta funkcja pozostaje poza MVP.
- Ustawienia interfejsu obejmują na tym etapie wyłącznie zaakceptowanie komunikatu o lokalnym charakterze danych; stan ten może być zapisany w `localStorage`.
- Nie jest wymagane odzyskiwanie notatek po wyczyszczeniu danych strony ani po odrzuceniu przez przeglądarkę operacji zapisu.

## 3. Technology Stack

| Obszar | Wybór | Uzasadnienie |
| --- | --- | --- |
| Framework / runtime | Preact 10, TypeScript, współczesna przeglądarka | Mały rozmiar aplikacji, prosty model komponentów i zgodność z rekomendacją PRD. Aplikacja nie wymaga runtime'u serwerowego. |
| Narzędzie budowania | Vite | Zapewnia prosty build statyczny, konfigurowalny `base`, obsługę TypeScript i integrację z Preact. |
| Dostęp do danych | Biblioteka `idb` nad natywnym IndexedDB | Zachowuje model i transakcje IndexedDB, ograniczając ilość technicznego kodu opartego na zdarzeniach. Nie wprowadza warstwy ORM. |
| Routing | Własny mały moduł nad History API | MVP ma tylko trzy wzorce tras. Osobna biblioteka routingu nie daje istotnej korzyści, a moduł może jawnie obsłużyć `base` GitHub Pages. |
| Offline cache | Service worker generowany podczas builda przez `vite-plugin-pwa`/Workbox w trybie precache | Gwarantuje ponowne uruchomienie aplikacji bez sieci po wcześniejszym załadowaniu zasobów. Cache obejmuje wyłącznie pliki aplikacji. |
| UI | Semantyczny HTML, lokalny CSS i lokalnie dostarczany IBM Plex Mono z fallbackami systemowymi | Zachowuje minimalistyczny, skupiony na tekście styl z PRD bez frameworka UI ani zależności od zewnętrznego CDN. |
| Testy | Vitest, Testing Library dla Preact, `fake-indexeddb` | Narzędzia współpracują z Vite i pozwalają testować komponenty oraz kontrakt magazynu bez prawdziwej przeglądarki. |
| Hosting | GitHub Pages | Spełnia wymaganie statycznego hostingu; wynik nie wymaga funkcji serwerowych. |
| Storage | IndexedDB dla notatek; `localStorage` wyłącznie dla niewrażliwego potwierdzenia komunikatu | Rozdzielenie jest zgodne z PRD i nie umieszcza treści notatek w synchronicznym magazynie ustawień. |

Build produkcyjny tworzy katalog `dist/` zawierający `index.html`, zasoby z fingerprintami, service worker i `404.html`. Wartość `base` jest parametrem konfiguracji, dzięki czemu ten sam kod może być zbudowany dla domeny głównej albo ścieżki repozytorium.

Wszystkie biblioteki są dołączane do lokalnego bundla. Aplikacja nie korzysta w czasie działania z CDN ani innych zewnętrznych skryptów.

### Visual design and typography

Plik `src/styles.css` implementuje referencyjny CSS z sekcji 11.1 PRD. Główne tokeny pozostają zdefiniowane jako custom properties:

- kolory jasnego motywu: `#ffffff`, `#1a1a1a`, `#8f8f8f`, `#b5b5b5`, `#e8e8e8`, `#d9ecff`;
- kolory ciemnego motywu: `#1c1c1e`, `#f2f2f2`, `#9a9a9a`, `#666666`, `#343434`, `#31445c`;
- szerokość edytora: `68ch`;
- bazowy rozmiar pisma: `18px`;
- interlinia: `1.6`;
- odstęp między literami: `-0.01em`.

IBM Plex Mono jest przechowywany jako lokalny plik WOFF2 i deklarowany przez `@font-face`; aplikacja nie pobiera fontu z Google Fonts ani innego CDN. Stos awaryjny to `"SFMono-Regular", Consolas, "Liberation Mono", monospace`.

Widok edytora używa wyśrodkowanej kolumny `min(68ch, calc(100vw - 96px))`, pionowych odstępów `80px 0 160px` oraz pola edycji bez obramowania, tła i możliwości zmiany rozmiaru. Pozostałe widoki używają tej samej palety i typografii, ale mogą stosować węższe, semantyczne kontrolki formularzy.

Ciemny motyw jest wybierany automatycznie przez `prefers-color-scheme: dark`; MVP nie wymaga ręcznego przełącznika. Reguła `outline: 0` dla pola tekstowego nie może usuwać informacji o fokusie dla użytkownika klawiatury: fokus musi być widoczny przez kursor tekstowy lub dyskretny styl kontenera spełniający WCAG 2.1 AA. Przy `prefers-reduced-motion` aplikacja nie dodaje ruchu; dekoracyjne animacje pozostają zabronione.

## 4. Architecture

Architektura pozostaje jednowarstwową aplikacją frontendową z wyraźnym oddzieleniem UI, logiki domenowej i dostępu do przeglądarkowych API.

```text
Widoki i komponenty Preact
            ↓
Stan aplikacji i operacje na notatkach
       ↙           ↘
Routing/History API  Repozytorium notatek
                           ↓
                       IndexedDB

Eksport/import plików ↔ Operacje na notatkach
Service worker        → Cache zasobów aplikacji
```

Główne elementy:

- **App shell** — rozpoznaje bieżącą trasę, pokazuje właściwy widok i komunikat o lokalnym charakterze danych.
- **Widok listy** — tworzenie notatki, filtrowanie po tytule, lista posortowana według ostatniej modyfikacji oraz przejście do ustawień.
- **Widok edytora** — ładowanie notatki po slugu, lokalny stan tytułu i treści, automatyczny zapis, zmiana nazwy, eksport `.txt` oraz usuwanie.
- **Widok ustawień** — eksport kompletnej kopii JSON, wybór pliku do importu, walidacja i rozwiązywanie konfliktów.
- **Operacje na notatkach** — generowanie i walidacja slugów, tworzenie UUID, reguły zmiany nazwy i przygotowanie importu. Nie przechowują własnej kopii danych.
- **Repozytorium notatek** — jedyne miejsce wykonujące odczyty, zapisy, usunięcia oraz transakcje IndexedDB.
- **Moduł routingu** — usuwa bazowy prefiks z adresu, rozpoznaje trasę, wykonuje nawigację i reaguje na `popstate`.
- **Moduł kopii zapasowych** — serializuje dane do wersjonowanego JSON, waliduje import i przygotowuje wynik konfliktów przed zapisem.
- **Service worker** — przechowuje wyłącznie skompilowane zasoby aplikacji. Nie odczytuje ani nie przechwytuje danych notatek.

Nie jest potrzebny globalny framework zarządzania stanem. Stan listy i edytora pozostaje w odpowiednich widokach; po trwałej operacji źródłem prawdy jest repozytorium IndexedDB.

## 5. Project Structure

```text
/
├── public/
│   ├── fonts/
│   │   └── ibm-plex-mono-regular.woff2
│   └── 404.html
├── src/
│   ├── components/
│   │   ├── LocalDataNotice.tsx
│   │   └── SaveStatus.tsx
│   ├── views/
│   │   ├── NotesListView.tsx
│   │   ├── NoteEditorView.tsx
│   │   ├── SettingsView.tsx
│   │   └── NotFoundView.tsx
│   ├── notes.ts
│   ├── noteRepository.ts
│   ├── backup.ts
│   ├── routing.ts
│   ├── types.ts
│   ├── app.tsx
│   ├── main.tsx
│   └── styles.css
├── tests/
│   ├── unit/
│   └── integration/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

Podział grupuje jedynie elementy, które mają odrębne odpowiedzialności. Moduły nie są dzielone na dodatkowe warstwy domenowe, serwisy i adaptery, dopóki nie wynika to z rzeczywistej złożoności.

`404.html` jest samodzielnym statycznym dokumentem, ponieważ GitHub Pages musi go zwrócić przed uruchomieniem aplikacji. Jego odpowiedzialność ogranicza się do przekazania żądanej ścieżki do `index.html`.

## 6. Data Model

### Note

```ts
interface Note {
  id: string;        // UUID, primary key
  title: string;
  slug: string;      // unique index, max 80 characters
  content: string;   // plain text
  createdAt: string; // UTC, ISO 8601
  updatedAt: string; // UTC, ISO 8601
}
```

### Backup file

```ts
interface NotesBackupV1 {
  format: "local-notes-backup";
  version: 1;
  exportedAt: string; // UTC, ISO 8601
  notes: Note[];
}
```

Stałe pole `format` zapobiega potraktowaniu dowolnego JSON jako kopii aplikacji. `version` umożliwia jednoznaczne odrzucenie nieobsługiwanego formatu albo jego migrację w przyszłości bez zgadywania struktury.

### Import preview

```ts
type ImportConflictResolution = "skip" | "replace" | "new-slug";

interface ImportConflict {
  importedNote: Note;
  existingNote: Note;
  resolution?: ImportConflictResolution;
  proposedSlug?: string; // used for "new-slug"
}

interface ImportPreview {
  notesWithoutConflicts: Note[];
  conflicts: ImportConflict[];
}
```

Model podglądu jest krótkotrwałym stanem UI. Nie jest zapisywany w IndexedDB.

### Save state

```ts
type SaveState = "unchanged" | "dirty" | "saving" | "saved" | "error";
```

Stan służy wyłącznie do sterowania komunikatem i ostrzeżeniem przed opuszczeniem strony; nie jest częścią modelu notatki.

## 7. Storage

### Lokalizacja i schemat

- Baza IndexedDB: `local-notes`.
- Początkowa wersja schematu: `1`.
- Object store: `notes`.
- Klucz główny: `id`.
- Unikalny indeks: `slug`.
- Indeks do listowania: `updatedAt`.
- Klucz `localStorage`: `local-notes:data-notice-dismissed:v1`, zawierający wyłącznie wartość logiczną potwierdzenia komunikatu.

Unikalny indeks `slug` egzekwuje najważniejszy warunek także na poziomie magazynu, a nie tylko UI. UUID pozwala zmienić slug bez zmiany wewnętrznej tożsamości notatki.

### Odczyt

- Widok edytora wyszukuje rekord przez unikalny indeks `slug`.
- Widok listy pobiera wszystkie rekordy i prezentuje je malejąco według `updatedAt`.
- Brak rekordu dla poprawnego sluga jest prawidłowym pustym stanem, a nie błędem magazynu.

### Zapis

- Zapis pojedynczej notatki odbywa się w jednej transakcji `readwrite`.
- Nowa notatka otrzymuje UUID oraz jednakowe `createdAt` i `updatedAt` w momencie pierwszego zapisu.
- Kolejne zapisy zachowują `id` i `createdAt`, a aktualizują `content` oraz `updatedAt`.
- Zmiana nazwy aktualizuje `title`, `slug` i `updatedAt` w jednej transakcji. Adres zmienia się dopiero po powodzeniu transakcji.
- Import zapisuje wybrane rekordy w jednej transakcji, aby nie pozostawić częściowo zaimportowanego zestawu w razie błędu.

### Brakujące i uszkodzone dane

- Brak bazy lub store przy pierwszym uruchomieniu powoduje utworzenie schematu wersji 1.
- Brak notatki pod slugiem pokazuje pusty edytor i komunikat z PRD.
- Rekord niespełniający modelu `Note` nie jest prezentowany ani nadpisywany automatycznie. UI pokazuje błąd odczytu i sugeruje eksport pozostałych danych, jeżeli eksport jest możliwy.
- Błąd otwarcia IndexedDB, transakcji, limitu pojemności lub odmowa dostępu pozostawiają edytowane dane w stanie `error`; aplikacja nie pokazuje statusu „Zapisano lokalnie”.
- Uszkodzony lub nieobsługiwany plik importu jest odrzucany przed rozpoczęciem transakcji.
- Aplikacja nie próbuje odbudowywać ani pobierać danych z sieci.

## 8. Routing

### Trasy logiczne

| Trasa | Widok |
| --- | --- |
| `/` | Lista notatek |
| `/notatki/:slug` | Edytor istniejącej albo jeszcze nieutworzonej notatki |
| `/ustawienia` | Kopia zapasowa i ustawienia |
| Inna trasa | Lokalny widok „Nie znaleziono strony” z powrotem do listy |

Moduł routingu rozdziela:

- `base path`, np. `/nazwa-repo/`, wynikający z konfiguracji Vite;
- logiczną ścieżkę aplikacji, np. `/notatki/moj-pomysl`.

Nawigacja wewnątrz aplikacji korzysta z `history.pushState`. Zmiana sluga bieżącej notatki korzysta z `history.replaceState`. Zdarzenie `popstate` powoduje ponowne rozpoznanie trasy i bezpieczne zakończenie lub zachowanie bieżącej edycji zależnie od stanu zapisu.

Slug pobrany z URL jest dekodowany i walidowany według tych samych reguł co slug generowany z tytułu. Niepoprawny slug prowadzi do widoku nieznalezionej strony, a nie do utworzenia rekordu.

### Bezpośrednie wejście na GitHub Pages

GitHub Pages zwraca `404.html` dla nieistniejącego fizycznie pliku. Dokument `404.html` zachowuje logiczną ścieżkę wraz z query stringiem w krótkotrwałym parametrze przekierowania i przechodzi do bazowego `index.html`. Kod startowy odczytuje parametr, natychmiast usuwa go przez `history.replaceState` i odtwarza właściwą trasę przed renderowaniem widoku.

Parametr przekierowania zawiera wyłącznie ścieżkę i techniczne parametry wejściowe. Treść, tytuł i dane notatki nigdy nie trafiają do URL. Ponieważ slug już jest częścią docelowego adresu, jego obecność w przekazanej ścieżce jest nieunikniona i zgodna z modelem routingu PRD.

Ograniczenia:

- mechanizm wymaga poprawnej wartości `base` dla konkretnego sposobu publikacji;
- bezpośrednie wejście wykonuje jedno dodatkowe przekierowanie po stronie klienta;
- JavaScript musi być włączony;
- adres pod ścieżką repozytorium zawsze zawiera jej prefiks; usunięcie prefiksu wymaga własnej domeny lub repozytorium użytkownika.

## 9. Main Application Flows

### Create note from the start page

1. Użytkownik podaje tytuł.
2. Aplikacja normalizuje tytuł do sluga i sprawdza jego poprawność.
3. Repozytorium sprawdza, czy slug jest wolny.
4. Przy konflikcie aplikacja pokazuje proponowany pierwszy wolny wariant i oczekuje decyzji użytkownika.
5. Po zatwierdzeniu aplikacja tworzy pusty rekord notatki i przechodzi do `/notatki/{slug}`.

### Open note

1. Router usuwa bazowy prefiks i odczytuje slug z URL.
2. Aplikacja waliduje slug.
3. Repozytorium wyszukuje notatkę po indeksie `slug`.
4. Istniejąca notatka jest wyświetlana jako zwykły tekst.
5. Dla braku notatki aplikacja pokazuje pusty edytor oraz informację, że notatka nie istnieje jeszcze w tej przeglądarce.

### Auto-save note

1. Użytkownik zmienia treść.
2. Lokalny stan przyjmuje wartość `dirty`, a poprzedni licznik opóźnienia zostaje zastąpiony nowym.
3. Po 400 ms bezczynności stan zmienia się na `saving`.
4. Repozytorium tworzy nowy rekord albo aktualizuje istniejący.
5. Po zatwierdzeniu transakcji UI pokazuje „Zapisano lokalnie”; po błędzie zachowuje zmiany w pamięci widoku i pokazuje błąd.
6. Jeżeli podczas zapisu pojawiły się kolejne znaki, po zakończeniu bieżącej transakcji wykonywany jest następny zapis najnowszej wersji.

### Rename note

1. Użytkownik zmienia tytuł i zatwierdza zmianę.
2. Aplikacja generuje i waliduje nowy slug.
3. Repozytorium sprawdza konflikt z inną notatką.
4. Przy konflikcie dane i adres pozostają bez zmian, a UI pokazuje komunikat.
5. Przy powodzeniu tytuł i slug są zapisywane w jednej transakcji.
6. Aplikacja aktualizuje bieżący adres przez `history.replaceState`.

### Delete note

1. Użytkownik wybiera usunięcie.
2. Aplikacja pokazuje potwierdzenie zawierające nazwę notatki i informację o trwałości operacji.
3. Po zatwierdzeniu repozytorium usuwa rekord według UUID.
4. Po powodzeniu aplikacja przechodzi na stronę startową.
5. Po błędzie pozostaje w edytorze i pokazuje komunikat.

### List and search notes

1. Widok pobiera lokalne notatki.
2. Sortuje je malejąco według daty ostatniej modyfikacji.
3. Wpisanie zapytania filtruje już pobraną listę po tytule bez uwzględniania wielkości liter.
4. Wybranie wyniku przechodzi do jego trasy.

### Export all notes

1. Aplikacja pobiera wszystkie prawidłowe rekordy.
2. Tworzy strukturę `NotesBackupV1` z datą eksportu.
3. Serializuje ją do UTF-8 JSON.
4. Przeglądarka zapisuje plik lokalnie po działaniu użytkownika.

### Export current note as text

1. Aplikacja pobiera aktualną, zapisaną wersję notatki albo najnowszy stan edytora.
2. Tworzy plik UTF-8 `.txt` zawierający wyłącznie treść.
3. Przeglądarka zapisuje plik lokalnie po działaniu użytkownika.

### Import backup

1. Użytkownik wybiera lokalny plik JSON.
2. Aplikacja parsuje plik i waliduje format, wersję, kompletność pól, daty, UUID, slugi oraz unikalność slugów w samym pliku.
3. Aplikacja porównuje importowane slugi z lokalnym magazynem.
4. Pokazuje podsumowanie nowych notatek i wszystkich konfliktów bez zapisywania danych.
5. Użytkownik wybiera dla konfliktów: pominięcie, zastąpienie albo nowy slug.
6. Aplikacja ponownie waliduje wynikowy zestaw i zapisuje go w jednej transakcji.
7. Po zatwierdzeniu transakcji pokazuje liczbę dodanych, zastąpionych i pominiętych notatek.

### Leave editor with pending changes

1. Nawigacja wewnętrzna lub zdarzenie zamknięcia strony sprawdza stan zapisu.
2. Jeśli stan nie wskazuje niezapisanych zmian, aplikacja nie ostrzega.
3. Jeśli istnieją niezapisane zmiany, aplikacja podejmuje natychmiastową próbę zapisu.
4. Gdy zapis nie zakończy się przed opuszczeniem albo wcześniej wystąpił błąd, aplikacja używa standardowego ostrzeżenia przeglądarki.

## 10. Error Handling

| Sytuacja | Zachowanie |
| --- | --- |
| Pusty lub niepoprawny tytuł/slug | Operacja jest blokowana; UI wskazuje wymagany poprawny tytuł. Rekord nie powstaje. |
| Zarezerwowany slug | Operacja jest blokowana z informacją o niedozwolonym adresie. |
| Konflikt sluga | Tworzenie proponuje wolny wariant; zmiana nazwy pozostawia poprzednie dane i adres. |
| Brak notatki pod poprawnym adresem | Pusty edytor i komunikat „Ta notatka nie istnieje jeszcze w tej przeglądarce”. |
| Niepoprawna trasa lub slug w URL | Widok „Nie znaleziono strony”; bez automatycznego zapisu. |
| IndexedDB niedostępne | Aplikacja pokazuje trwały komunikat, że zapis lokalny nie działa; nie deklaruje zapisania danych. |
| Nieudany automatyczny zapis | Stan `error`, zachowanie bieżącej treści w pamięci widoku i możliwość ponowienia przez kolejną edycję; ostrzeżenie przy opuszczeniu. |
| Brak miejsca | Tak jak błąd zapisu, z komunikatem sugerującym wykonanie eksportu `.txt` bieżącej treści. |
| Błąd odczytu pojedynczego rekordu | Rekord nie jest renderowany jako częściowo poprawna notatka; UI zgłasza problem z lokalnymi danymi. |
| Niepoprawny JSON lub niezgodna wersja kopii | Import zostaje zatrzymany przed zmianą danych i pokazuje przyczynę. |
| Konflikty w imporcie bez decyzji | Przycisk zatwierdzający import pozostaje niedostępny. |
| Błąd transakcji importu | Cały import jest wycofywany; lokalny stan sprzed importu pozostaje bez zmian. |
| Nieudane usunięcie | Użytkownik pozostaje w edytorze, a notatka nie jest uznawana za usuniętą. |
| Nieudane załadowanie aplikacji offline | Przeglądarka pokazuje własny błąd; aplikacja nie obiecuje pierwszego uruchomienia bez wcześniejszego cache. |

Komunikaty błędów nie zawierają treści notatek. Aplikacja nie wysyła telemetrii błędów ani danych diagnostycznych do zewnętrznych usług.

## 11. Testing Strategy

### Unit tests

Testów jednostkowych wymagają elementy zawierające deterministyczne reguły:

- generowanie, skracanie i walidacja sluga;
- rozpoznawanie tras z bazowym prefiksem;
- walidacja modelu notatki i pliku kopii zapasowej;
- przygotowanie podglądu konfliktów i wynikowych rekordów importu;
- przejścia stanu automatycznego zapisu, w tym zmiana podczas trwającego zapisu;
- formatowanie i sortowanie danych listy bez zależności od UI.

### Integration tests

Testy integracyjne w środowisku DOM z emulowanym IndexedDB powinny obejmować granice pomiędzy modułami:

- operacje repozytorium, unikalność sluga i transakcyjność importu;
- otwarcie istniejącej i brakującej notatki na podstawie trasy;
- automatyczny zapis między edytorem a repozytorium;
- zmianę nazwy wraz z aktualizacją URL dopiero po udanym zapisie;
- tworzenie, usuwanie, eksport i import przez główne widoki;
- zachowanie UI po błędzie magazynu.

### Manual verification

Manualnej weryfikacji w produkcyjnym buildzie wymagają zachowania zależne od prawdziwej przeglądarki i hostingu:

- bezpośrednie wejście oraz odświeżenie każdej trasy na GitHub Pages dla domeny głównej i ścieżki repozytorium;
- ponowne uruchomienie wcześniej załadowanej aplikacji w trybie offline;
- brak żądań zawierających treść, tytuł, slug lub pełny URL notatki;
- lokalne załadowanie IBM Plex Mono bez żądania do zewnętrznego CDN;
- zgodność typografii, szerokości kolumny, odstępów, kolorów zaznaczenia oraz jasnego i ciemnego motywu z sekcją 11.1 PRD;
- natywne cofanie/ponawianie w polu edycji oraz ostrzeżenie przy niezapisanych zmianach;
- pobieranie plików JSON i `.txt` oraz wybór pliku importu;
- nawigację samą klawiaturą, widoczny fokus, etykiety i kontrast głównych przepływów;
- układ w Chrome, Edge i Firefox od rozdzielczości 1024 × 768 px;
- zachowanie po wyczyszczeniu danych strony i w prywatnym profilu.

## 12. Non-Functional Considerations

### Performance and reliability

- Aplikacja ma mały bundle: Preact, `idb`, kod aplikacji i kod offline bez frameworka UI ani globalnego store.
- Editor renderuje zwykłe pole tekstowe i nie przetwarza treści podczas wpisywania poza aktualizacją stanu i opóźnionym zapisem.
- Operacje IndexedDB są asynchroniczne. Żadna treść notatki nie jest zapisywana do `localStorage`.
- Mechanizm auto-save rozróżnia zapis trwający od nowszych zmian, aby zakończenie starszej operacji nie oznaczyło nowszej treści jako zapisanej.
- Service worker przechowuje statyczne zasoby z buildu, co pozwala uruchomić wcześniej załadowaną aplikację bez sieci.

### Simplicity

- Brak backendu, API, kont, synchronizacji, globalnego zarządzania stanem i dodatkowych warstw domenowych.
- Jedno repozytorium obejmuje wszystkie operacje na jedynym trwałym modelu domenowym.
- Trzy wzorce tras obsługuje mały moduł zamiast pełnej biblioteki routingu.

### Security and privacy

- Dane notatek pozostają w origin-specific IndexedDB przeglądarki i opuszczają je tylko w wyniku jawnego eksportu użytkownika.
- Treść jest przypisywana do wartości pola tekstowego lub renderowana jako węzeł tekstowy; nie trafia do API interpretującego HTML.
- Brak analityki, zewnętrznych skryptów, zdalnie pobieranych fontów, ikon i wywołań API wymaganych do działania. IBM Plex Mono jest częścią statycznego artefaktu aplikacji.
- Tytuł i treść nie są umieszczane w tytule dokumentu, URL, logach ani cache service workera. Slug występuje wyłącznie w ścieżce zgodnie z PRD.
- Produkcyjny build nie wymaga kodu inline, dzięki czemu hosting może zastosować CSP bez `unsafe-inline` dla skryptów.
- Pliki importu są traktowane jako niezaufane dane i podlegają pełnej walidacji przed zapisem.

### Browser and accessibility compatibility

- Zakres wsparcia obejmuje aktualne desktopowe Chrome, Edge i Firefox.
- UI jest projektowane dla szerokości od 1024 px, Windows 11, myszy i klawiatury; interfejs mobilny nie jest objęty zakresem.
- Używane są semantyczne elementy formularzy, poprawne etykiety, logiczna kolejność fokusu, widoczny fokus, komunikaty statusu dostępne dla technologii asystujących oraz kontrast zgodny z WCAG 2.1 AA.
- Aplikacja nie używa animacji dekoracyjnych ani istotnych działań dostępnych tylko po najechaniu.

### Static hosting

- Artefakt `dist/` składa się wyłącznie z plików statycznych.
- Wszystkie odwołania do zasobów i tras uwzględniają konfigurowalny `base`.
- `404.html` zapewnia wejście do SPA dla bezpośrednich adresów na GitHub Pages.
- Aplikacja nie zakłada obecności rewrite rules, funkcji serwerowych ani nagłówków ustawianych dynamicznie.

## 13. Technical Decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Model aplikacji | Statyczne SPA w Preact | Spełnia routing bez przeładowań, GitHub Pages i brak backendu przy małym narzucie. |
| Trwały magazyn | IndexedDB przez `idb` | Asynchroniczne API, transakcje i indeksy przy minimalnym kodzie infrastrukturalnym. |
| Tożsamość notatki | UUID jako klucz główny, unikalny slug jako indeks | Zmiana adresu nie zmienia tożsamości rekordu, a magazyn wymusza unikalność sluga. |
| Routing | Własny moduł History API świadomy `base` | Trzy trasy nie uzasadniają zależności od routera; jawna obsługa prefiksu jest kluczowa dla GitHub Pages. |
| Direct-link fallback | Statyczny `404.html` przekierowujący do `index.html` i odtworzenie trasy | GitHub Pages nie zapewnia natywnego fallbacku SPA. |
| Strategia auto-save | Debounce 400 ms plus kolejny zapis dla zmian powstałych podczas transakcji | Spełnia docelowe opóźnienie i zapobiega utracie szybkich zmian. |
| Działanie offline | Precache zasobów aplikacji przez wygenerowany service worker | Spełnia wymaganie działania bez sieci po wcześniejszym załadowaniu, bez cache'owania notatek. |
| Format kopii | Wersjonowany pojedynczy plik JSON | Umożliwia walidację i pełne odtworzenie pól wymaganych przez PRD. |
| Atomowość importu | Jedna transakcja IndexedDB po zatwierdzeniu konfliktów | Zapobiega częściowemu importowi. |
| Interpretacja treści | Wyłącznie wartość pola tekstowego / węzeł tekstowy | Zachowuje format zwykłego tekstu oraz eliminuje wykonywanie Markdown i HTML. |
| Biblioteki UI i stanu | Brak | Zakres nie uzasadnia dodatkowych abstrakcji ani zależności. |
| Kierunek wizualny | Referencyjny CSS z PRD, lokalny IBM Plex Mono, automatyczny jasny/ciemny motyw | Zapewnia spójny, minimalistyczny interfejs skupiony na tekście bez zewnętrznych zależności runtime. |

## 14. Open Questions

None.

## Consistency Check

- Wszystkie cele MVP, wymagania funkcjonalne, zasady przechowywania, routing GitHub Pages, prywatność, bezpieczeństwo, offline, dostępność i kompatybilność z PRD mają odpowiadające im decyzje lub przepływy techniczne.
- Projekt nie obejmuje kont, backendu, synchronizacji, udostępniania, współdzielenia, historii wersji, załączników, Markdown, szyfrowania, aplikacji natywnej ani interfejsu mobilnego.
- Opcjonalny licznik słów został jawnie pozostawiony poza MVP.
- Dokument określa granice modułów, kontrakty danych, zachowanie magazynu, routing i decyzje architektoniczne, ale nie zawiera kolejności implementacji, listy tasków ani kodu aplikacji.
- Kierunek wizualny z PRD ma odpowiadające decyzje dotyczące lokalnego fontu, tokenów CSS, geometrii edytora, jasnego i ciemnego motywu oraz dostępnego fokusu.
