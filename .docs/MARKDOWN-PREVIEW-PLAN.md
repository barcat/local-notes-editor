# Plan implementacji podglądu Markdown z Marked

Data: 2026-10-30. Status: zrealizowano. Wyniki testów, kontroli przeglądarkowej i pomiarów opisuje [MARKDOWN-PREVIEW-VERIFICATION.md](MARKDOWN-PREVIEW-VERIFICATION.md). Poniżej zachowano założenia planu stanowiące podstawę implementacji.

Punkt wyjścia: gałąź `feature/link-preview`, HEAD `78d66fc`, wraz z roboczą zmianą ikony podglądu i poprawką własnego parsera linków. Dla tego kodu przeszło 131 testów i produkcyjny build. Marked nie jest jeszcze zależnością projektu.

## 1. Cel i proponowany zakres

Zastąpić własne rozpoznawanie linków biblioteką Marked i udostępnić podstawowy Markdown w istniejącym podglądzie notatki. Nie utrzymywać równolegle dwóch parserów.

Pierwsze wdrożenie obejmuje:

| Element | Zachowanie w podglądzie |
| --- | --- |
| Akapity i nowe linie | Pojedynczy Enter pozostaje widocznym przejściem do nowej linii; pusta linia oddziela akapity. |
| Nagłówki | Obsługa poziomów 1–6. |
| Pogrubienie i kursywa | Standardowe tokeny `strong` i `em`. |
| Kod | Kod w linii oraz bloki kodu, bez kolorowania składni. W kodzie linki i HTML pozostają tekstem. |
| Listy | Listy numerowane i punktowane, także zagnieżdżone; bez interaktywnych checkboxów. |
| Cytaty, separatory, twarde przejścia linii | Odpowiednie elementy semantyczne Preact. |
| Linki | Wyłącznie poprawne bezwzględne adresy HTTP/HTTPS; nowa karta, `rel="noopener noreferrer"`. |
| Surowy HTML i obrazy | Widoczna, dosłowna składnia; bez tworzenia elementów HTML i bez pobierania obrazów. |
| Nieobsługiwane tokeny | Bezpieczny tekst z `token.raw`; bez cichego usuwania treści i bez przepuszczania HTML. |

To proponowany zakres pierwszej wersji, szerszy od obecnego podglądu samych linków. Przyjmujemy `gfm: false` i `pedantic: false`; tabele, przekreślenia i listy zadań GFM mogą być osobnym rozszerzeniem. Nie polegamy na opcji `breaks`, która wymaga GFM; nowe linie zwykłego tekstu zachowuje warstwa renderowania i CSS.

Edycja i zapis nadal operują na oryginalnym tekście. Nie zmieniamy modelu notatki, IndexedDB, autosave, eksportu TXT ani routingu. Ikona, etykieta „Podgląd notatki”, `Ctrl+Enter`, Escape i zachowanie panelu pozostają punktami wejścia do tej samej funkcji.

## 2. Architektura

Przepływ: oryginalny tekst → Worker z Marked → tokeny → kontrolowany renderer Preact.

| Plik | Odpowiedzialność |
| --- | --- |
| `src/markdown/parseMarkdown.ts` | Konfiguracja Marked, tokenizacja, kontrola liczby i głębokości tokenów. Używany w Workerze i testach parsera. |
| `src/markdown/markdown.worker.ts` | Odbiór zadania i zwrot serializowalnych tokenów lub kontrolowanego błędu. |
| `src/markdown/protocol.ts` | Typy żądań i odpowiedzi: identyfikator zadania, wynik i przyczyna przejścia do zwykłego tekstu. |
| `src/markdown/safeLink.ts` | Walidacja adresów przed utworzeniem `<a>`. |
| `src/components/renderMarkdownTokens.tsx` | Jawna lista obsługiwanych tokenów i ich mapowanie na elementy Preact. |
| `src/components/MarkdownPreview.tsx` | Cykl życia Workera, limit czasu, stany podglądu i odrzucanie nieaktualnych odpowiedzi. |
| `src/components/Editor.tsx` | Podłączenie komponentu wewnątrz istniejącego regionu podglądu. |
| `src/styles.css` | Style ograniczone do podglądu, bez zmiany wyglądu edytora. |

Nie używać `marked.parse()` do wstawiania wynikowego HTML, `innerHTML` ani `dangerouslySetInnerHTML`. DOMPurify nie jest potrzebny w tym wariancie, ponieważ aplikacja tworzy wyłącznie jawnie dozwolone elementy Preact. Włączenie surowego HTML w przyszłości wymaga osobnej decyzji o bezpieczeństwie.

Nie przenosić własnej gramatyki linków do rozszerzeń Marked. Obsługę składni przejmuje biblioteka; lokalny kod odpowiada za prezentację, walidację adresów i ograniczenia pracy.

## 3. Etapy realizacji i odbiór

### Etap 1 — kontrakt zachowania i zależność

- Dodać `marked` jako zależność wykonawczą, dobierając stabilną wersję zgodną z lokalnym Node 22.14.0 i Node 22 w CI. Zapisać wersję w lockfile.
- Przygotować reprezentatywne przykłady: zwykła notatka, dokument Markdown, HTML, kod, niebezpieczne linki oraz długie niekompletne wejścia.
- W testach oddzielić wymagania trwałe od zachowania zmienianego celowo: zwykła treść i zapis pozostają bez zmian; składnia `**tekst**` w podglądzie zacznie oznaczać pogrubienie.
- Sprawdzić różnice tokenizacji na istniejących przypadkach linków: nawiasy, IPv6, błędne adresy, znaczniki HTML w etykietach i linki wewnątrz kodu. Nie wymagać zgodności z przypadkowymi zachowaniami starego regexu; każdą istotną różnicę opisać w testach.

Odbiór: uzgodniony przez plan zestaw wejść i oczekiwanych rezultatów, zależność zgodna z CI, bez zmian danych notatek.

### Etap 2 — tokenizacja i bezpieczne renderowanie

- Użyć API tokenizacji Marked oraz jawnych opcji; nie rejestrować rozszerzeń przy każdym renderowaniu komponentu.
- Renderować listę obsługiwanych tokenów rekurencyjnie jako elementy Preact. Obsłużyć także techniczne tokeny tekstu, odstępów i metadanych zgodnie ze składnią Markdown.
- Dla HTML, obrazów i nieznanych tokenów wyświetlić tekst źródłowy; brak `raw` lub niepoprawny kształt wyniku ma powodować przejście całej notatki do zwykłego tekstu, zamiast utraty fragmentu.
- Walidować adres tokenu przed stworzeniem linku: HTTP/HTTPS, poprawny `new URL`, brak znaków sterujących. Odrzucić m.in. `javascript:`, `data:`, `file:`, `mailto:`, adresy względne i zaczynające się od `//`. Odrzucony link pokazać jako dosłowną składnię.
- Zachować poprawne zagnieżdżanie list i bloków oraz tekst etykiet; nie generować kodu HTML z treści notatki.

Odbiór: przykłady zakresu v1 renderują się poprawnie; testy nie znajdują `img`, `iframe`, `script`, atrybutów zdarzeń ani aktywnych niedozwolonych adresów.

### Etap 3 — responsywny podgląd i ograniczenie kosztu pracy

- Uruchamiać tokenizację w module Web Worker tworzonym w sposób obsługiwany przez Vite: `new Worker(new URL(..., import.meta.url), { type: "module" })`.
- Tworzyć Workera dopiero dla otwartego podglądu. Nie parsować przy pisaniu w ukrytym podglądzie ani po samym otwarciu panelu ustawień.
- Wprowadzić identyfikatory zadań. Zmiana notatki, treści, wyjście z podglądu i odmontowanie komponentu anulują nieaktualną pracę oraz czyszczą timery. Wynik starszego zadania nie może zastąpić aktualnej notatki.
- Sprawdzić przesyłanie rzeczywistych tokenów przez `postMessage`; nie przesyłać instancji Marked ani elementów Preact.
- Zastosować proponowane początkowe limity: 250 000 jednostek `content.length`, 10 000 tokenów, głębokość zagnieżdżenia 32 i 1000 ms na odpowiedź Workera, łącznie z jego startem. Zweryfikować je pomiarami na sprzęcie deweloperskim przed odbiorem.
- Limit długości sprawdzać przed wysłaniem zadania; liczbę i głębokość tokenów kontrolować iteracyjnie przed rekursywnym renderowaniem. Sam Worker nie chroni przed kosztownym tworzeniem ogromnego drzewa DOM.
- W czasie pracy wyświetlać oryginalny tekst ze statusem „Przygotowuję podgląd…”. Po błędzie, przekroczeniu limitu lub braku wsparcia Workera zachować cały tekst i pokazać krótki komunikat o dostępności wyłącznie zwykłego podglądu. Nigdy nie parsować synchronicznie jako awaryjnego obejścia.
- Po przekroczeniu czasu zakończyć Workera. Nie ponawiać tego samego zadania automatycznie po dowolnym renderowaniu rodzica; kolejna próba następuje po zmianie treści lub ponownym otwarciu podglądu.

Odbiór: trudne wejście nie blokuje klawiatury i Escape; przekroczenie budżetu zachowuje treść; nieaktualne odpowiedzi są ignorowane.

### Etap 4 — integracja z edytorem i style

- Zastąpić wywołanie `renderLinks(content)` komponentem podglądu Markdown. Zachować istniejący fokusowalny region „Podgląd notatki” również podczas ładowania i wyświetlania zwykłego tekstu.
- Pozostawić textarea zamontowane. Przełączanie trybu nie zmienia wartości, zaznaczenia ani natywnej historii undo/redo i nie wywołuje zapisu.
- Dostosować style nagłówków, akapitów, list, cytatów i kodu do istniejących fontów, kolorów i szerokości notatki.
- Zastąpić globalne `white-space: pre-wrap` regułami dla odpowiednich elementów. Zachować pojedyncze nowe linie w zwykłym tekście akapitów; bloki kodu zachowują białe znaki i mają lokalne przewijanie długich linii. Zwykły podgląd awaryjny nadal używa `pre-wrap`.
- Sprawdzić zmianę preferencji wyglądu przy otwartym podglądzie, długie adresy i puste notatki. Nowy status nie może przejmować fokusu ani wielokrotnie odczytywać całej treści czytnikiem ekranu.

Odbiór: działają ikona, `Ctrl+Enter`, Escape, powrót fokusu, reset trybu przy zmianie notatki i pełna widoczność treści przy 1024×768 i 1440×900.

### Etap 5 — usunięcie starego parsera i dokumentacja

- Po podłączeniu oraz sprawdzeniu nowego podglądu usunąć `renderLinks.tsx`; nie pozostawiać go jako drugiego, awaryjnego parsera.
- Przenieść istotne przypadki z `renderLinks.test.tsx` do testów Marked i renderera, a następnie usunąć stary plik testów. Robocza poprawka własnego parsera zostaje w ten sposób zastąpiona, bez potrzeby osobnego utrwalania jej implementacji.
- Zaktualizować testy `Editor` i aplikacji. Zachować sprawdzenia bezpieczeństwa, trwałości źródła, fokusu i skrótów; zmienić wyłącznie oczekiwania wynikające z celowego uruchomienia Markdown.
- Uzupełnić README o obsługiwany zakres podglądu i regułę zapisu zwykłego tekstu. W dokumentacji technicznej opisać Worker, dozwolone elementy i stany awaryjne. Historyczny plan MVP pozostawić z odnośnikiem do tego rozszerzenia.
- Zachować zmianę uniwersalnej ikony. Pliki instalacji Impeccable i lokalne raporty nie należą do migracji Markdown.

Odbiór: aplikacja ma jeden parser, aktualną dokumentację i brak nieużywanych importów.

## 4. Weryfikacja końcowa

| Obszar | Wymagane sprawdzenie |
| --- | --- |
| Markdown | Każdy element zakresu v1, listy zagnieżdżone, HTML i obrazy jako tekst, linki w kodzie jako tekst, poprawne nowe linie. |
| Bezpieczeństwo | HTML/SVG z obsługą zdarzeń, niedozwolone schematy URL, adresy z encjami i znakami sterującymi, brak żądań do zewnętrznych adresów wywołanych samą treścią notatki. Ładowanie lokalnych zasobów aplikacji jest dozwolone. |
| Edytor i dane | Brak zapisu po samym przełączeniu trybu; niezmienione źródło w IndexedDB i eksporcie; zaznaczenie, undo/redo, skróty i zmiana notatki. |
| Zadania asynchroniczne | Opóźniona odpowiedź poprzedniej notatki, szybkie przełączanie trybów, przekroczenie czasu, błąd Workera i odmontowanie. |
| Wydajność | Próbki 10k/50k/100k znaków: zwykły tekst, poprawny Markdown, serie `[`, niedomknięte linki i głębokie zagnieżdżenia. Osobno mierzyć tokenizację, przekazanie wyniku i renderowanie. |
| Offline i build | Produkcyjny podgląd po pierwszym precache działa bez sieci, także po odświeżeniu. Worker jest zasobem lokalnym uwzględnionym w precache. Sprawdzić `/` i base path `/local-notes-editor/`. |
| Regresje | `npm test`, `npm run typecheck`, `npm run build` oraz wizualna kontrola podglądu w przeglądarce. |

Testy automatyczne mają sprawdzać deterministycznie timeout, anulowanie i zwykły podgląd. Nie opierać testów jednostkowych na ostrych progach czasu procesora; raport porównawczy wydajności wykonać osobno. Proponowany cel pomiarowy na tym samym sprzęcie: typowa notatka 50k znaków gotowa w 200 ms po rozgrzaniu, a zadanie przekraczające 1000 ms zawsze przerywane. Nie uznawać tych celów za osiągnięte przed pomiarami.

Jeżeli pomiary wymagają zmiany limitów, udokumentować wartości i uzasadnienie przed zakończeniem migracji. Zwiększenie limitu nie zastępuje kontroli złożoności tokenów i czasu pracy.

## 5. Podział pracy

Zalecana kolejność commitów: osobno istniejąca zmiana ikony; następnie zależność, parser i renderer z testami; Worker z testami cyklu życia; na końcu integracja, style, usunięcie starego parsera i dokumentacja. Migracja trafia do przeglądu jako spójna zmiana po zakończeniu wszystkich etapów. Żaden etap nie wymaga migracji danych użytkownika.

## 6. Źródła decyzji

- [Marked: tokeny i dostęp do lexera](https://marked.js.org/using_pro#access-to-lexer-and-parser) — podstawa adaptera Preact.
- [Marked: opcje i osobne instancje](https://marked.js.org/using_advanced#options) — jawna konfiguracja; `breaks` wymaga GFM.
- [Marked: bezpieczeństwo HTML](https://marked.js.org/#usage) — biblioteka nie oczyszcza wynikowego HTML; wybrany projekt nie wstawia takiego HTML do DOM.
- [Marked: Workers](https://marked.js.org/using_advanced#workers) — możliwość odizolowania i przerwania kosztownego parsowania. Limity, sposób renderowania i zakres v1 są decyzjami proponowanymi dla tej aplikacji, a nie gwarancjami biblioteki.
