# PRD: lokalny edytor notatek

**Status:** wersja 1.1

**Typ produktu:** statyczna aplikacja webowa na komputery

**Docelowy hosting:** GitHub Pages

**Rekomendowany stos:** Preact, TypeScript, Vite, IndexedDB

## 1. Streszczenie

Produkt jest minimalistycznym edytorem zwykłego tekstu działającym całkowicie w przeglądarce. Notatki nie są wysyłane na serwer i nie wymagają konta. Każda notatka ma czytelny adres oparty na nazwie, np. `/notatki/moj-pomysl`.

Aplikacja nie ma osobnej strony z listą notatek ani osobnego widoku ustawień. Głównym i domyślnym widokiem jest czysty edytor. Ostatnio edytowane notatki, tworzenie nowej notatki, ustawienia wyglądu i rzadziej używane działania są dostępne w wysuwanym panelu po lewej stronie.

## 2. Problem użytkownika

Typowe aplikacje do notatek są rozbudowane, wymagają konta albo zapisują dane w chmurze. Użytkownik potrzebuje szybkiego miejsca do pisania, które:

- uruchamia się bez logowania;
- nie wysyła treści poza urządzenie;
- pozwala wrócić do notatki przez łatwy do zapamiętania adres;
- nie rozprasza metadanymi, statystykami ani rozbudowaną nawigacją;
- pozwala dopasować podstawową typografię i kolory edytora;
- może być utrzymywane jako prosta aplikacja statyczna.

## 3. Cel produktu

Umożliwić rozpoczęcie lub wznowienie pisania bez przechodzenia przez ekran startowy. Po uruchomieniu aplikacja pokazuje ostatnio edytowaną lokalną notatkę albo pusty edytor, jeśli nie ma jeszcze żadnej notatki.

## 4. Cele MVP

- Tworzenie, otwieranie, edytowanie, zmiana nazwy i usuwanie lokalnych notatek.
- Automatyczny zapis bez przycisku „Zapisz”.
- Czytelny adres zawierający slug notatki.
- Czysty, pełnoekranowy widok edytora bez statystyk i dat.
- Wysuwany panel z listą notatek posortowaną według ostatniej edycji.
- Edycja zwykłego tekstu bez formatowania.
- Konfiguracja tła, koloru tekstu, fontu, rozmiaru pisma, interlinii i szerokości kolumny.
- Poprawne działanie po odświeżeniu i bezpośrednim otwarciu adresu na GitHub Pages.
- Obsługa komputera stacjonarnego lub laptopa.

## 5. Poza zakresem MVP

- osobna strona z listą notatek;
- osobna strona ustawień;
- eksport i import wszystkich notatek w JSON;
- kopie zapasowe oraz odtwarzanie danych;
- statystyki, daty utworzenia, daty ostatniej edycji i licznik słów w interfejsie;
- konta użytkowników i logowanie;
- backend, baza danych i API;
- synchronizacja pomiędzy urządzeniami;
- publiczne udostępnianie notatek;
- współdzielenie i jednoczesna edycja;
- historia wersji;
- załączniki oraz przechowywanie obrazów;
- formatowanie Markdown i podgląd sformatowanej treści;
- szyfrowanie notatek hasłem;
- aplikacje natywne;
- interfejs mobilny oraz obsługa telefonów i tabletów.

## 6. Wymagania funkcjonalne

### 6.1. Uruchomienie aplikacji

Pod adresem `/` aplikacja:

- otwiera ostatnio edytowaną lokalną notatkę;
- jeśli nie ma notatek, pokazuje pusty edytor gotowy do pisania;
- nie pokazuje strony powitalnej, dashboardu ani listy notatek;
- pozostawia panel boczny domyślnie zamknięty, aby treść była głównym elementem ekranu.

Pierwszy wpisany znak w pustym edytorze tworzy nową notatkę. Do czasu nadania nazwy może ona używać roboczego tytułu „Bez tytułu” oraz wolnego sluga `bez-tytulu`, `bez-tytulu-2` itd.

### 6.2. Wysuwany panel po lewej stronie

Panel jest otwierany dyskretnym przyciskiem w lewym górnym rogu i zamykany tym samym przyciskiem, klawiszem `Escape` albo kliknięciem poza panelem.

Panel zawiera:

- przycisk „Nowa notatka”;
- wyszukiwanie po nazwie;
- listę lokalnych notatek posortowaną malejąco według czasu ostatniego zapisu;
- ustawienia wyglądu edytora;
- działania dotyczące bieżącej notatki: opcjonalny eksport `.txt` i usunięcie.

Lista pokazuje wyłącznie tytuły. Nie pokazuje dat, fragmentów treści, liczby słów ani innych statystyk. Wybranie tytułu otwiera notatkę i zamyka panel.

### 6.3. Adres i slug

Przykład:

```text
Nazwa: Mój pomysł na projekt
Adres: /notatki/moj-pomysl-na-projekt
```

Reguły generowania sluga:

- małe litery;
- polskie znaki zamienione na odpowiedniki ASCII;
- spacje i ciągi znaków specjalnych zamienione na pojedynczy myślnik;
- usunięte myślniki z początku i końca;
- dozwolone znaki: `a-z`, `0-9`, `-`;
- maksymalnie 80 znaków;
- slug nie może być pusty ani należeć do listy zarezerwowanych tras.

Slugi muszą być unikalne. Przy konflikcie aplikacja proponuje pierwszy wolny wariant liczbowy, np. `moj-pomysl-2`.

### 6.4. Bezpośrednie otwarcie adresu

Otwarcie `/notatki/{slug}`:

- wyświetla istniejącą lokalną notatkę o tym slugu;
- jeśli notatka nie istnieje, pokazuje pusty edytor i tworzy ją dopiero po rozpoczęciu pisania;
- nie pobiera treści z sieci;
- nie sugeruje, że link udostępnia notatkę innym osobom.

### 6.5. Edytor

Edytor powinien:

- zajmować cały dostępny ekran;
- zawierać edytowalny tytuł i wielowierszowe pole zwykłego tekstu;
- nie wyświetlać stale nagłówka aplikacji, adresu, dat, statystyk ani stopki;
- zapisywać zmiany automatycznie po 400 ms bezczynności;
- obsługiwać cofanie i ponawianie przez mechanizmy przeglądarki;
- ostrzegać przed opuszczeniem strony tylko wtedy, gdy istnieją niezapisane zmiany;
- zachowywać znaki nowej linii i odstępy dokładnie tak, jak wprowadził je użytkownik.

Pomyślny zapis nie wymaga stałego komunikatu. Błąd zapisu musi być widoczny i nie może sugerować, że dane zostały utrwalone.

Treść jest wyświetlana wyłącznie jako zwykły tekst. Aplikacja nie interpretuje składni Markdown ani HTML.

### 6.6. Zmiana nazwy

Tytuł jest edytowany bezpośrednio nad treścią. Zmiana tytułu zmienia również slug i adres. Po udanym zapisie aplikacja używa `history.replaceState`, aby nie pozostawiać nieaktualnego wpisu w historii bieżącej edycji.

Jeśli docelowy slug jest zajęty, aplikacja proponuje pierwszy wolny wariant liczbowy. Treść pozostaje bezpieczna niezależnie od wyniku zmiany nazwy.

### 6.7. Tworzenie nowej notatki

Przycisk „Nowa notatka” otwiera pusty edytor. Rekord nie jest zapisywany, dopóki użytkownik nie wpisze tytułu lub treści. Zapobiega to tworzeniu pustych notatek po przypadkowym kliknięciu.

### 6.8. Usuwanie

Usunięcie notatki jest dostępne w panelu bocznym i wymaga potwierdzenia zawierającego jej nazwę. Po usunięciu aplikacja otwiera następną ostatnio edytowaną notatkę albo pusty edytor.

Usunięcie jest trwałe. Aplikacja nie obiecuje możliwości odzyskania danych.

### 6.9. Eksport bieżącej notatki

Opcjonalny eksport `.txt` zapisuje wyłącznie treść bieżącej notatki do lokalnego pliku tekstowego po świadomym działaniu użytkownika.

Aplikacja nie obsługuje eksportu zbiorczego, importu ani formatu JSON.

### 6.10. Ustawienia wyglądu

Ustawienia znajdują się w panelu bocznym i działają natychmiast, bez przycisku „Zapisz”. Obejmują:

- kolor tła edytora;
- kolor tekstu;
- krój pisma;
- rozmiar pisma;
- interlinię;
- maksymalną szerokość kolumny w pikselach.

Ustawienia są lokalne dla bieżącego profilu przeglądarki. Nie są częścią notatki i dotyczą wszystkich notatek.

## 7. Przechowywanie danych

### 7.1. Magazyn

- Notatki są przechowywane w IndexedDB.
- Ustawienia wyglądu i zaakceptowanie komunikatu o lokalnym charakterze danych mogą być zapisane w `localStorage`.
- Treść i tytuły notatek nie mogą trafić do `localStorage`, URL query string, hash fragmentu, logów ani zewnętrznych usług.

### 7.2. Model notatki

```ts
interface Note {
  id: string;        // UUID, stały identyfikator wewnętrzny
  title: string;
  slug: string;      // unikalny indeks
  content: string;   // zwykły tekst
  updatedAt: number; // wyłącznie do sortowania; niewidoczne w UI
}
```

`updatedAt` jest techniczną informacją potrzebną do ułożenia listy „ostatnio edytowane”. Nie jest prezentowane użytkownikowi ani używane do tworzenia statystyk.

### 7.3. Model ustawień

```ts
interface EditorPreferences {
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSizePt: number;
  lineHeight: number;
  editorWidthPx: number;
}
```

Nie są przechowywane statystyki użycia, liczba słów ani historia zmian.

### 7.4. Informacja o trwałości

Przy pierwszym uruchomieniu aplikacja wyświetla w panelu bocznym krótką informację:

> Notatki są zapisane wyłącznie w tej przeglądarce. Wyczyszczenie danych strony, użycie trybu prywatnego albo zmiana urządzenia może spowodować ich utratę.

Komunikat można zamknąć i nie powinien wracać po zaakceptowaniu.

## 8. Routing i GitHub Pages

Aplikacja korzysta z History API i dwóch tras logicznych:

| Trasa | Zachowanie |
| --- | --- |
| `/` | Ostatnio edytowana notatka albo pusty edytor |
| `/notatki/:slug` | Edycja wskazanej notatki albo pusty edytor dla nowego sluga |

Nie istnieją osobne trasy listy ani ustawień.

GitHub Pages nie obsługuje natywnie fallbacku SPA. Build zawiera `404.html`, który zachowuje żądaną ścieżkę, przekierowuje do dokumentu startowego i przywraca trasę przez History API. Treść ani tytuł notatki nie mogą być umieszczane w parametrach przekierowania.

Vite otrzymuje konfigurowalny `base`, aby aplikacja działała pod domeną główną i pod ścieżką repozytorium.

## 9. Kierunek wizualny

### 9.1. Edytor

Kierunek wizualny bazuje na załączonej referencji ustawień i wykorzystuje następujące wartości domyślne:

| Właściwość | Wartość domyślna |
| --- | --- |
| Tło | `#233d4d` |
| Kolor tekstu | `#fe7f2d` |
| Font | `Courier New` |
| Rozmiar fontu | `13pt` |
| Interlinia | `1.8` |
| Maksymalna szerokość | `920px` |

Treść jest wyśrodkowana w kolumnie o konfigurowalnej szerokości. Pole tytułu i pole treści nie mają ramek, cieni ani osobnego tła. Kursor, zaznaczenie i placeholder muszą być czytelne na wybranych kolorach.

### 9.2. Panel boczny

Panel boczny używa jasnego, neutralnego tła. Sekcje ustawień są pogrupowane w lekkie karty z subtelną ramką i zaokrąglonymi rogami, zgodnie z referencją:

- nagłówki sekcji są małe, wersalikowe i stonowane;
- etykiety są po lewej, a kontrolki po prawej;
- wiersze są rozdzielone delikatną linią;
- kontrolki mają jasne tło, cienką ramkę i niewielkie zaokrąglenie;
- panel nie używa dekoracyjnych animacji ani efektów dostępnych wyłącznie po najechaniu.

Animacja wsunięcia panelu może być krótka i musi być wyłączona przy `prefers-reduced-motion`.

### 9.3. Dostępność konfiguracji kolorów

Aplikacja ostrzega, gdy wybrana para kolorów nie osiąga kontrastu 4.5:1. Ostrzeżenie nie zmienia kolorów automatycznie, ale udostępnia przycisk przywrócenia wartości domyślnych.

## 10. Prywatność i bezpieczeństwo

- Brak backendu i wywołań API związanych z treścią notatek.
- Brak analityki zbierającej zawartość, slug, tytuł lub pełny URL notatki.
- Brak zewnętrznych skryptów wymaganych do działania aplikacji.
- Fonty są systemowe albo dostarczane razem z aplikacją.
- Treść notatki jest traktowana jako zwykły tekst i nigdy wykonywana jako HTML.
- Service worker, jeśli zostanie użyty, przechowuje wyłącznie zasoby aplikacji.

## 11. Wymagania niefunkcjonalne

- Edytor jest gotowy do pisania w czasie poniżej 1 sekundy po załadowaniu aplikacji na typowym komputerze.
- Brak utraty znaków przy szybkim pisaniu i przełączaniu notatek.
- Obsługa aktualnych desktopowych wersji Chrome, Edge i Firefox.
- Dostępność klawiaturowa zgodna co najmniej z WCAG 2.1 AA dla głównych przepływów.
- Poprawne działanie od rozdzielczości 1024 × 768 px.
- Wszystkie operacje na notatkach działają bez połączenia z internetem po wcześniejszym załadowaniu zasobów aplikacji.

## 12. Kryteria akceptacji MVP

1. Wejście na `/` otwiera ostatnio edytowaną notatkę bez pokazywania osobnej listy.
2. Gdy nie ma notatek, `/` pokazuje pusty edytor gotowy do pisania.
3. Przycisk w lewym górnym rogu otwiera i zamyka panel boczny.
4. Panel pokazuje tytuły notatek w kolejności ostatniej edycji bez dat i statystyk.
5. Wybranie tytułu otwiera notatkę i zamyka panel.
6. Utworzenie notatki „Mój pomysł” prowadzi do adresu kończącego się `/notatki/moj-pomysl`.
7. Wpisana treść pozostaje dostępna po odświeżeniu strony.
8. Bezpośrednie otwarcie trasy w tej samej przeglądarce pokazuje właściwą notatkę.
9. Zmiana tytułu aktualizuje slug i adres bez przeładowania aplikacji.
10. Dwie notatki nie mogą mieć tego samego sluga.
11. Wpisany tekst jest wyświetlany bez interpretowania Markdown lub HTML.
12. Ustawienia wyglądu działają natychmiast i pozostają po odświeżeniu.
13. Domyślny edytor używa tła `#233d4d`, tekstu `#fe7f2d`, fontu Courier New 13pt, interlinii 1.8 i szerokości 920 px.
14. W interfejsie nie ma dat edycji, licznika słów, statystyk, ekranu ustawień ani ekranu listy.
15. Aplikacja nie udostępnia importu ani eksportu JSON.
16. Błąd automatycznego zapisu jest widoczny; udany zapis nie zajmuje stałego miejsca w edytorze.
17. Build produkcyjny może zostać opublikowany jako statyczny katalog na GitHub Pages.
