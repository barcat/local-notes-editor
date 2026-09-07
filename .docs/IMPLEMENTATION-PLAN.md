# Implementation Plan — lokalny edytor notatek

Status: gotowy do realizacji etapami. Data: 2026-09-07.

## Assumptions

### Podstawa i zakres

Plan opiera się na stanie repozytorium `barcat/local-notes-editor` z commita `7c470b1df8f619dbada1d047a56afbaac051494e`:

- [PRD 1.1](https://github.com/barcat/local-notes-editor/blob/7c470b1df8f619dbada1d047a56afbaac051494e/.docs/PRD-lokalny-edytor-notatek.md).
- [Technical Design](https://github.com/barcat/local-notes-editor/blob/7c470b1df8f619dbada1d047a56afbaac051494e/.docs/TECHNICAL-DESIGN.md).
- [Makieta HTML](https://github.com/barcat/local-notes-editor/blob/7c470b1df8f619dbada1d047a56afbaac051494e/mockup.html), przeanalizowana na podstawie HTML, CSS i JavaScript.

Repozytorium zawiera dokumentację i makietę, bez właściwej aplikacji. Plan obejmuje implementację oraz lokalną weryfikację produkcyjnego buildu. Nie obejmuje publikacji ani konfiguracji wdrożenia. Docelowe miejsce tego dokumentu w repozytorium: `.docs/IMPLEMENTATION-PLAN.md`.

Obowiązuje aktualny projekt: Preact 10, TypeScript, Vite, `idb`/IndexedDB, History API, lokalny CSS oraz `vite-plugin-pwa`/Workbox. Notatki nie trafiają do localStorage; ten magazyn służy preferencjom i fladze zaakceptowania informacji o danych. Brak importu i eksportu JSON nie wyklucza wewnętrznej serializacji preferencji.

Uwzględniamy eksport pojedynczej notatki do TXT: jest opcjonalny w PRD, ale występuje w makiecie i projekcie technicznym. Nie dodajemy Markdown, synchronizacji, statystyk, osobnych ekranów listy lub ustawień ani interfejsu mobilnego.

### Rozstrzygnięcia potrzebne przed implementacją

| Obszar | Przyjęta reguła |
| --- | --- |
| Pierwszy znak a debounce | Pierwsza zmiana rozpoczyna roboczą notatkę; trwały rekord powstaje po 400 ms bezczynności lub wymuszonym dokończeniu zapisu przed nawigacją. Samo otwarcie pustego edytora nie zapisuje rekordu. |
| Hierarchia źródeł | Wymagania funkcjonalne PRD i kontrakty Technical Design mają pierwszeństwo przed uproszczeniami demonstracyjnego JavaScriptu makiety. |
| Wygląd | Zachowujemy układ i detale makiety: granat `#233d4d`, pomarańcz `#fe7f2d`, Courier New 13pt, interlinia 1.8, kolumna 920px, panel 400px. Drobne różnice tokenów i marginesów względem Technical Design rozstrzygamy na rzecz makiety, zapewniając brak poziomego przewijania przy 1024px. |
| Rozmiar pisma | Obsługujemy pełny zakres 10–24pt z Technical Design; lista kilku rozmiarów w makiecie jest uproszczeniem. |
| Nieistniejący slug | Pusty edytor z tytułem wyprowadzonym ze sluga. Bez zapisu do pierwszej zmiany; poprawny slug z adresu jest zachowany do zmiany tytułu. |
| Niepoprawny adres | Komunikat i działanie „Otwórz edytor”; bez automatycznego zakładania notatki. Zarezerwowane wartości sluga: `notatki`, `index`, `404`. |
| Puste tytuły | Pusty lub biały tytuł podczas zapisu daje „Bez tytułu”. Normalizacja sluga nie zmienia treści notatki ani nie usuwa jej odstępów. |
| Konflikt sluga | Pierwszy wolny sufiks od `-2`; łączna długość do 80 znaków, również z sufiksem. Zmiana nazwy wyklucza własny UUID z kontroli konfliktu. |
| Panel i fokus | Panel jest nakładką z blokadą interakcji z tłem i fokusem pozostającym wewnątrz. Zamknięty panel nie jest osiągalny Tabem. Otwieranie/zamykanie ma spójną semantykę dostępności; nie kopiujemy samego `aria-hidden` z makiety. |
| Błąd zapisu | Zachowujemy roboczą treść, pokazujemy błąd do rozwiązania problemu i nie przełączamy notatki po nieudanym zapisie. Ostrzegamy przed opuszczeniem strony również podczas transakcji lub po błędzie, jeśli pozostały niezapisane zmiany. |
| Offline | Wymagamy ponownego otwarcia aplikacji bez sieci po zakończonym precache i przejęciu strony przez service worker. Nie zakładamy gwarantowanego zapisu przy nagłym zamknięciu procesu przeglądarki. |

Makieta nie jest gotowym modułem aplikacji: zawiera przykładowe dane, pozorne usuwanie, brak persystencji i routingu. Nie przenosimy tych ograniczeń do implementacji. Uzupełniamy brakujący przycisk przywracania domyślnych kolorów, zamykanie informacji o lokalnych danych oraz automatyczne zwiększanie wysokości textarea. Jasne etykiety panelu i wskaźniki fokusu wymagają sprawdzenia kontrastu; zgodność wizualna nie uzasadnia nieczytelnych kontrolek.

## Implementation Plan

Każdy etap stanowi osobną, możliwą do oceny zmianę. Po każdym etapie uruchomić kontrolę typów i build; od etapu 2 także testy dotyczące istniejącej funkcjonalności. Nie rozpoczynać kolejnego etapu przy niespełnionych kryteriach odbioru poprzedniego.

### 1. Szkielet aplikacji i przeniesienie wyglądu

**Cel:** uruchamialny edytor odpowiadający makiecie.

**Prace:**

- Utworzyć projekt Preact/TypeScript/Vite, konfigurację TypeScript oraz skrypty `dev`, `typecheck`, `build`, `preview` i `test`.
- Dodać Vitest, Testing Library i środowisko DOM do późniejszych testów; zapisać lockfile. Dobrać zgodne wersje zależności bez zmiany uzgodnionego stosu.
- Przenieść CSS i strukturę makiety do `Editor.tsx`, `LeftDrawer.tsx`, `app.tsx`, `main.tsx` oraz `styles.css`.
- Zbudować pola tytułu i treści oraz panel z nakładką, obsługą Escape, fokusu, zamykania i reduced motion.
- Dopasować wysokość textarea do tekstu, również po zmianie szerokości i typografii; pozostawić natywne undo/redo. Nie odtwarzać pola przy każdym znaku.
- Usunąć przykładowe notatki z uruchamianej aplikacji. Zachować `mockup.html` jako referencję.

**Odbiór:**

- [ ] Aplikacja startuje z pustym edytorem i zamkniętym panelem.
- [ ] Wygląd odpowiada makiecie przy 1024×768 i 1440×900; długi tekst pozostaje dostępny.
- [ ] Panel daje się obsługiwać klawiaturą; ukryte kontrolki nie przechwytują fokusu.
- [ ] Typecheck i produkcyjny build przechodzą.

### 2. Model danych, IndexedDB i slugi

**Cel:** sprawdzony magazyn notatek niezależny od interfejsu.

**Prace:**

- Dodać `types.ts`, `noteRepository.ts`, `slug.ts` i `noteOperations.ts` zgodnie ze strukturą Technical Design.
- Utworzyć bazę `local-notes`, wersję 1, magazyn `notes` z kluczem `id`, unikalnym indeksem `slug` i indeksem `updatedAt`.
- Zaimplementować minimalny kontrakt repozytorium: odczyt po slugu, najnowsza notatka, lista malejąca, zapis, usunięcie i kontrola dostępności sluga.
- Normalizować polskie litery, separatory, długość i puste wyniki; rozwiązywać konflikty z uwzględnieniem sufiksu i własnego UUID.
- Zachować unikalność także przy odrzuceniu transakcji przez indeks: ponowić wybór wolnego sluga w ograniczony sposób albo zwrócić błąd bez utraty szkicu.
- Dodać `fake-indexeddb` do testów magazynu.

**Odbiór i testy:**

- [ ] Zapis, ponowny odczyt, aktualizacja i usuwanie działają; UUID nie zmienia się podczas zmiany nazwy.
- [ ] Lista i wybór najnowszej notatki używają malejącego `updatedAt`.
- [ ] Testy obejmują polskie litery (w tym ł), symbole, pusty wynik, kolizje, zarezerwowane wartości i limit 80 znaków z sufiksem.
- [ ] Unikalny indeks uniemożliwia zapis dwóch rekordów z tym samym slugiem.

### 3. Edycja z bezpiecznym automatycznym zapisem

**Cel:** pierwszy użyteczny fragment produktu — pisanie i powrót do zapisanej notatki.

**Prace:**

- Na starcie załadować najnowszą notatkę lub pusty szkic. Błąd odczytu odróżnić od pustej bazy; nie nadpisywać danych po błędzie inicjalizacji.
- Po zmianie tytułu lub treści ustawiać stan niezapisanych zmian i debounce 400 ms.
- Tworzyć UUID raz dla nowej notatki, utrzymywać roboczą wersję i sekwencyjnie wykonywać zapisy. Sukces starszej transakcji nie może oznaczać zapisania nowszych zmian.
- Aktualizować `updatedAt` tylko przy rzeczywistym zapisie edycji, nie przy otwarciu notatki.
- Dodać operację dokończenia oczekującego zapisu do użycia przez nawigację. Nie opierać zabezpieczenia danych na asynchronicznym zapisie w `beforeunload`.
- Dodać `ErrorToast.tsx`; sukces pozostaje niewidoczny, błąd zachowuje treść i umożliwia ponowną próbę po kolejnej zmianie.
- Rejestrować ostrzeżenie opuszczenia strony tylko przy niezapisanych danych; usunąć je po utrwaleniu najnowszej wersji.

**Odbiór i testy:**

- [ ] Wpisanie tekstu i odświeżenie po zakończonym zapisie odtwarza dokładną treść.
- [ ] Samo otwarcie pustego edytora nie zakłada notatki.
- [ ] Test z kontrolowanym czasem sprawdza debounce, a opóźniona transakcja — zachowanie zmian dopisanych podczas zapisu.
- [ ] Błąd zapisu zachowuje tekst, ujawnia problem i nie ustawia fałszywego stanu „zapisane”.
- [ ] Spacje, nowe linie, HTML i Markdown pozostają zwykłym tekstem; undo/redo działa podczas pisania.

### 4. Routing i przełączanie notatek

**Zależność:** etap 3, zwłaszcza koordynacja zapisu.

**Prace:**

- Dodać `routing.ts`: rozdzielić bazę aplikacji od `/` i `/notatki/:slug`, obsłużyć nieznane trasy i `popstate`.
- Otwierać notatkę po slugu; przy braku rekordu tworzyć wyłącznie roboczy szkic.
- Po pierwszym udanym zapisie i zmianie nazwy aktualizować adres przez `replaceState`; przejście do innej notatki zapisywać przez `pushState`.
- Dodać `NotesList.tsx`: lista wyłącznie tytułów, kolejność ostatniej edycji, wyszukiwanie bez uwzględniania wielkości liter i zaznaczenie aktywnej pozycji.
- Przed „Nowa notatka”, wyborem innej notatki i Wstecz/Dalej dokończyć zapis. Po błędzie zachować bieżący widok; przy `popstate` przywrócić zgodność URL i aktywnej notatki.
- Po otwarciu notatki zamykać panel i ustawiać fokus w treści; dla nowego szkicu — w tytule. Odrzucać nieaktualne wyniki asynchronicznych odczytów po szybkiej nawigacji.

**Odbiór i testy:**

- [ ] Dwie notatki można tworzyć, przełączać i odnajdywać po tytule.
- [ ] Przełączenie przed upływem 400 ms nie gubi ostatnich znaków.
- [ ] Zmiana tytułu aktualizuje slug dopiero po udanym zapisie, bez dodatkowego wpisu historii.
- [ ] Wstecz/Dalej, `/`, istniejący slug, nowy slug i nieznana trasa działają z bazą `/` i `/local-notes-editor/`.
- [ ] Test błędu zapisu oraz szybkiego przełączania potwierdza zgodność treści, aktywnej pozycji i URL.

### 5. Ustawienia wyglądu i informacja o lokalnych danych

**Prace:**

- Dodać `preferences.ts` oraz `AppearanceSettings.tsx`; stosować preferencje przed pierwszym renderem edytora.
- Zaimplementować wszystkie sześć ustawień, kontrolę hex oraz zakresów z Technical Design; błędne wartości zapisane wcześniej zastępować domyślnymi pole po polu.
- Aktualizować CSS natychmiast, następnie localStorage pod kluczem `local-notes:preferences:v1`. Błąd dostępu do magazynu nie może blokować edytora; poinformować o braku trwałości ustawień.
- Obliczać kontrast i przy wyniku poniżej 4.5:1 pokazywać ostrzeżenie wraz z przyciskiem przywrócenia domyślnych kolorów.
- Dodać zamykaną informację o lokalnym charakterze danych z flagą `local-notes:data-notice-dismissed:v1`. Pozostawić panel zamknięty na starcie; informacja czeka w nim na pierwsze otwarcie.

**Odbiór i testy:**

- [ ] Każda zmiana działa od razu dla wszystkich notatek i pozostaje po odświeżeniu.
- [ ] Testy obejmują poprawne wartości, uszkodzone dane, granice zakresów i błąd localStorage.
- [ ] Ostrzeżenie o kontraście i przywrócenie kolorów działają; fonty nie wymagają sieci.
- [ ] Zaakceptowana informacja o danych nie wraca po ponownym uruchomieniu.

### 6. Usuwanie oraz eksport TXT

**Prace:**

- Dodać `DeleteNoteDialog.tsx` z aktualnym tytułem, anulowaniem i jednoznacznym potwierdzeniem.
- Skoordynować usuwanie z zapisem: zatrzymać timer, zaczekać na trwającą transakcję, następnie usunąć rekord; spóźniony zapis nie może odtworzyć usuniętej notatki.
- Po sukcesie otworzyć następną najnowszą notatkę lub pusty edytor i zastąpić bieżący adres. Po błędzie zachować widok i pokazać komunikat.
- Wyłączyć usuwanie dla niezapisanego, pustego szkicu.
- Eksportować aktualną roboczą treść jako UTF-8 `text/plain`, bez tytułu dodawanego do zawartości. Użyć bezpiecznej nazwy sluga i zwolnić object URL po uruchomieniu pobrania.

**Odbiór i testy:**

- [ ] Anulowanie nie zmienia danych; potwierdzenie usuwa właściwy UUID.
- [ ] Usunięcie ostatniej notatki prowadzi do pustego edytora.
- [ ] Test usuwania podczas zapisu potwierdza, że rekord nie powraca.
- [ ] Pobrany TXT zachowuje polskie litery, spacje, nowe linie oraz najnowsze, jeszcze niezapisane zmiany.

### 7. Build zgodny z GitHub Pages i uruchomienie offline

**Prace:**

- Dodać konfigurowalny `base` Vite i generowanie zgodnego z nim `public/404.html` lub równoważnego pliku wynikowego.
- Przekazywać i odtwarzać wyłącznie ścieżkę aplikacji; nie przekazywać osobno treści ani tytułu. Odtworzyć trasę przed inicjalizacją widoku, unikając pętli przekierowań.
- Skonfigurować precache skompilowanych zasobów i obsługę nawigacji offline wewnątrz bazy aplikacji przez `vite-plugin-pwa`/Workbox.
- Nie przechowywać notatek w Cache Storage; nie dodawać API, zewnętrznych fontów ani analityki.
- Sprawdzić `dist/` na lokalnym serwerze odwzorowującym odpowiedź `404.html` dla nieznanych ścieżek. Sam fallback serwera deweloperskiego Vite nie potwierdza poprawności GitHub Pages.

**Odbiór:**

- [ ] Build zawiera index, zasoby, service worker i 404; działa dla obu wariantów base.
- [ ] Bezpośrednie wejście i odświeżenie `/local-notes-editor/notatki/moj-pomysl` odtwarza trasę i lokalną notatkę.
- [ ] Po przygotowaniu cache ponowne otwarcie strony i adresu notatki bez sieci działa.
- [ ] Aktualizacja zasobów aplikacji nie czyści IndexedDB ani preferencji.
- [ ] Brak wdrożenia w ramach tego etapu; rzeczywisty test na GitHub Pages pozostaje kontrolą środowiskową po przyszłej publikacji.

### 8. Odbiór całego MVP

**Prace:**

- Uruchomić pełny zestaw testów, typecheck i build produkcyjny.
- Przejść scenariusz: pusty start → wpis → zapis → nowa notatka → szybkie przełączenie → zmiana nazwy z konfliktem → odświeżenie → eksport → usunięcie.
- Sprawdzić Chrome, Edge i Firefox: klawiaturę, undo/redo, fokus dialogu nad panelem (Escape najpierw zamyka dialog), długi tekst, ustawienia i błędy zapisu.
- Porównać z makietą otwarty i zamknięty panel przy 1024×768 i na szerokim ekranie. Skontrolować czytelność etykiet, placeholderów i fokusu.
- Zmierzyć czas gotowości edytora po załadowaniu aplikacji; cel poniżej 1 s. Zapisać środowisko pomiaru, zamiast deklarować wynik dla każdego komputera.
- Uzupełnić krótki README o uruchomienie, testy, build, konfigurację base i lokalną trwałość danych; dokumentację szczegółową pozostawić w `.docs`.

**Końcowe kryterium:** wszystkie poniższe wymagania mają potwierdzony wynik, bez krytycznych błędów zapisu lub nawigacji.

| Kryteria PRD §12 | Etapy realizujące | Weryfikacja |
| --- | --- | --- |
| 1–2: start z ostatnią notatką lub pustym edytorem | 3–4 | Integracja i ponowne uruchomienie |
| 3–5: panel, kolejność, otwieranie | 1, 4 | Test komponentów i klawiatura |
| 6, 9–10: slug, zmiana nazwy, unikalność | 2, 4 | Testy slugów, bazy i routingu |
| 7: trwały zapis | 2–3 | Integracja, odświeżenie, błąd transakcji |
| 8: bezpośredni adres | 4, 7 | Lokalny serwer z 404; po publikacji kontrola na Pages |
| 11: zwykły tekst | 3 | HTML/Markdown jako treść, spacje i nowe linie |
| 12–13: preferencje i domyślny wygląd | 1, 5 | Testy preferencji i porównanie makiety |
| 14–15: czysty UI, brak funkcji JSON | 1, 4–6, 8 | Przegląd interfejsu i dostępnych akcji |
| 16: widoczny błąd, brak stałego statusu sukcesu | 3 | Wymuszony błąd IndexedDB |
| 17: statyczny build dla Pages | 7 | Kontrola dist i działania pod prefiksem |

**Sposób realizacji:** zacząć od etapu 1. Etap 3 daje pierwszą wersję przydatną do własnego pisania; etap 4 dodaje wygodną pracę z wieloma notatkami. Pełny zakres MVP jest zakończony po etapie 8. Testy opisane w tym dokumencie są planem weryfikacji, nie wynikami wykonanych testów aplikacji.
