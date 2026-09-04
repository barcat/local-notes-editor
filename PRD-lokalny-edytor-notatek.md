# PRD: lokalny edytor notatek

**Status:** wersja 1.0  
**Typ produktu:** statyczna aplikacja webowa na komputery  
**Docelowy hosting:** GitHub Pages  
**Rekomendowany stos:** Preact, TypeScript, Vite, IndexedDB

## 1. Streszczenie

Produkt jest minimalistycznym edytorem zwykłych notatek tekstowych działającym całkowicie w przeglądarce. Notatki nie są wysyłane na serwer i nie wymagają konta. Każda notatka ma czytelny adres oparty na jej nazwie, np. `/notatki/moj-pomysl`.

Adres służy do odnalezienia notatki zapisanej lokalnie w danym profilu przeglądarki. Nie jest linkiem publicznym: otwarcie go na innym urządzeniu lub w innej przeglądarce nie udostępnia treści.

## 2. Problem użytkownika

Typowe aplikacje do notatek są rozbudowane, wymagają konta albo zapisują dane w chmurze. Użytkownik potrzebuje bardzo szybkiego miejsca do pisania, które:

- uruchamia się bez logowania;
- nie wysyła treści poza urządzenie;
- pozwala wrócić do notatki przez łatwy do zapamiętania adres;
- umożliwia wygodną edycję zwykłego tekstu;
- może być utrzymywane jako prosta aplikacja statyczna.

## 3. Cel produktu

Umożliwić utworzenie lub otwarcie lokalnej notatki w maksymalnie jednym kroku i bez kontaktu z backendem.

Przykładowy scenariusz:

1. Użytkownik otwiera `/notatki/moj-pomysl`.
2. Jeśli notatka istnieje lokalnie, aplikacja pokazuje jej treść.
3. Jeśli nie istnieje, aplikacja otwiera pusty edytor i tworzy ją po rozpoczęciu pisania.
4. Zmiany zapisują się automatycznie w przeglądarce.

## 4. Cele MVP

- Tworzenie, edytowanie i usuwanie lokalnych notatek.
- Automatyczny zapis bez przycisku „Zapisz”.
- Czytelny adres zawierający slug notatki.
- Lista lokalnych notatek.
- Edycja zwykłego tekstu bez formatowania.
- Eksport i import kopii zapasowej.
- Poprawne działanie po odświeżeniu i bezpośrednim otwarciu adresu na GitHub Pages.
- Czytelny interfejs przeznaczony do pracy na komputerze stacjonarnym lub laptopie.

## 5. Poza zakresem MVP

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

### 6.1. Strona startowa

Pod adresem `/` aplikacja wyświetla:

- pole nazwy nowej notatki;
- przycisk „Utwórz notatkę”;
- listę istniejących lokalnych notatek;
- wyszukiwanie po nazwie;
- datę ostatniej modyfikacji każdej notatki.

Zatwierdzenie nazwy generuje slug i przenosi użytkownika do `/notatki/{slug}`.

### 6.2. Adres i slug

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

Slugi muszą być unikalne. Przy konflikcie aplikacja prosi o inną nazwę lub proponuje kolejny wariant, np. `moj-pomysl-2`.

### 6.3. Bezpośrednie otwarcie adresu

Otwarcie `/notatki/{slug}`:

- wyświetla istniejącą lokalną notatkę o tym slugu;
- jeśli notatka nie istnieje, pokazuje pusty edytor i komunikat „Ta notatka nie istnieje jeszcze w tej przeglądarce”;
- nie pobiera treści z sieci;
- nie sugeruje, że link udostępnia notatkę innym osobom.

### 6.4. Edytor

Edytor powinien:

- zajmować większość dostępnego ekranu;
- umożliwiać pisanie zwykłego tekstu w wielowierszowym polu edycji;
- zapisywać zmiany automatycznie po krótkiej bezczynności, docelowo 300–500 ms;
- pokazywać stan zapisu: „Zapisywanie…” i „Zapisano lokalnie”;
- obsługiwać cofanie i ponawianie przez mechanizmy przeglądarki;
- ostrzegać przed opuszczeniem strony tylko wtedy, gdy istnieją niezapisane zmiany;
- zachowywać znaki nowej linii i odstępy dokładnie tak, jak wprowadził je użytkownik.

Treść jest wyświetlana wyłącznie jako zwykły tekst. Aplikacja nie interpretuje składni Markdown ani HTML.

### 6.5. Zmiana nazwy

Użytkownik może zmienić nazwę notatki. Domyślnie powoduje to również zmianę sluga i adresu. Po zmianie aplikacja używa `history.replaceState`, aby nie pozostawiać nieaktualnego wpisu w historii bieżącej edycji.

Jeśli nowy slug jest już zajęty, zmiana nie zostaje zapisana, a użytkownik otrzymuje jasny komunikat.

### 6.6. Usuwanie

Usunięcie notatki wymaga potwierdzenia zawierającego jej nazwę. Po usunięciu aplikacja wraca do strony startowej.

Usunięcie jest trwałe, chyba że notatka znajduje się w wcześniej wyeksportowanej kopii zapasowej.

### 6.7. Eksport i import

Ponieważ dane istnieją wyłącznie lokalnie, MVP musi zapewniać ręczną kopię zapasową:

- eksport wszystkich notatek do jednego pliku JSON;
- opcjonalny eksport bieżącej notatki do pliku `.txt`;
- import pliku JSON wygenerowanego przez aplikację;
- walidacja wersji formatu i struktury pliku;
- podsumowanie konfliktów przed importem;
- możliwość pominięcia, zastąpienia lub zapisania konfliktującej notatki pod nowym slugiem.

Eksport jest działaniem użytkownika i nie oznacza wysyłania danych do serwera.

## 7. Przechowywanie danych

### 7.1. Magazyn

Notatki powinny być przechowywane w IndexedDB. `localStorage` może przechowywać wyłącznie niewrażliwe ustawienia interfejsu, np. wybrany motyw.

IndexedDB jest preferowane, ponieważ:

- nie blokuje głównego wątku przy większej liczbie danych;
- ma większy praktyczny limit niż `localStorage`;
- pozwala na wersjonowanie schematu i transakcje;
- lepiej nadaje się do kolekcji notatek.

### 7.2. Model notatki

```ts
interface Note {
  id: string;          // UUID, stały identyfikator wewnętrzny
  title: string;
  slug: string;        // unikalny indeks
  content: string;     // zwykły tekst
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}
```

Slug służy do wyszukania notatki z adresu, ale wewnętrzna tożsamość notatki opiera się na UUID.

### 7.3. Informacja o trwałości

Przy pierwszym uruchomieniu aplikacja jasno informuje:

> Notatki są zapisane wyłącznie w tej przeglądarce. Wyczyszczenie danych strony, użycie trybu prywatnego albo zmiana urządzenia może spowodować ich utratę. Wykonuj okresowy eksport kopii zapasowej.

Komunikat można zamknąć i nie powinien wracać po zaakceptowaniu.

## 8. Routing i GitHub Pages

Aplikacja korzysta z History API i tras:

- `/` — lista notatek;
- `/notatki/:slug` — edycja notatki;
- `/ustawienia` — ustawienia i kopia zapasowa.

GitHub Pages nie obsługuje natywnie fallbacku SPA. Build musi zatem zawierać `404.html`, który:

1. zapamiętuje żądaną ścieżkę;
2. przekierowuje do dokumentu startowego;
3. przywraca pierwotną trasę przez History API;
4. nie umieszcza treści notatki ani innych danych w adresie.

Dla GitHub Pages projektu pełny adres będzie miał postać:

```text
https://uzytkownik.github.io/nazwa-repo/notatki/moj-pomysl
```

Adres bez prefiksu repozytorium, np. `https://notatki.example.com/notatki/moj-pomysl`, wymaga własnej domeny albo publikacji z repozytorium użytkownika `uzytkownik.github.io`.

Vite musi otrzymywać konfigurowalny `base`, aby aplikacja działała zarówno pod domeną główną, jak i pod ścieżką repozytorium.

## 9. Wymagania prywatności i bezpieczeństwa

- Brak backendu i wywołań API związanych z treścią notatek.
- Brak analityki zbierającej zawartość, slug, tytuł lub pełny URL notatki.
- Brak zewnętrznych skryptów wymaganych do działania aplikacji.
- Czcionki i ikony dostarczane razem z aplikacją albo oparte na systemie użytkownika.
- Content Security Policy możliwa do zastosowania bez wyjątków dla kodu inline.
- Treść notatki musi być traktowana jako zwykły tekst i nigdy wykonywana jako HTML.
- Service worker, jeśli zostanie użyty, przechowuje wyłącznie zasoby aplikacji, nigdy treści notatek.
- Aplikacja nie zapisuje treści notatki w query stringu, hash fragmentach, logach ani tytule dokumentu przeglądarki.

## 10. Wymagania niefunkcjonalne

- Pierwsze użycie aplikacji po załadowaniu zasobów powinno działać offline.
- Czas gotowości edytora na typowym komputerze: poniżej 1 sekundy po załadowaniu aplikacji.
- Brak utraty znaków przy szybkim pisaniu i przełączaniu tras.
- Obsługa aktualnych desktopowych wersji Chrome, Edge i Firefox.
- Dostępność klawiaturowa zgodna co najmniej z WCAG 2.1 AA dla głównych przepływów.
- Poprawne działanie przy rozdzielczości od 1024 × 768 px.
- Interfejs zoptymalizowany przede wszystkim dla Windows 11 i obsługi myszą oraz klawiaturą.
- Wszystkie operacje na notatkach muszą działać bez połączenia z internetem po uruchomieniu aplikacji.

## 11. Proponowany interfejs

### Widok listy

- nagłówek z nazwą aplikacji;
- pole „Nazwa nowej notatki”;
- lista notatek posortowana według ostatniej modyfikacji;
- wyszukiwarka;
- menu kopii zapasowej i ustawień.

### Widok edytora

- edytowalny tytuł;
- dyskretny adres/slug;
- status lokalnego zapisu;
- menu: zmień nazwę, eksportuj `.txt`, usuń;
- licznik słów jako opcjonalna funkcja drugiego priorytetu.

Interfejs powinien unikać animacji dekoracyjnych oraz zbędnych efektów po najechaniu myszą. Wszystkie istotne działania muszą być dostępne myszą i klawiaturą.

## 12. Kryteria akceptacji MVP

1. Utworzenie notatki „Mój pomysł” otwiera trasę kończącą się `/notatki/moj-pomysl`.
2. Wpisana treść pozostaje dostępna po odświeżeniu strony.
3. Bezpośrednie ponowne otwarcie tej trasy w tej samej przeglądarce pokazuje właściwą notatkę.
4. Otwarcie trasy w czystym profilu pokazuje pusty stan i informację, że notatki nie ma w tej przeglądarce.
5. Żądanie bezpośredniej trasy na GitHub Pages uruchamia aplikację zamiast pozostawiać użytkownika na stronie błędu 404.
6. Zmiana tytułu i sluga aktualizuje adres bez przeładowania aplikacji.
7. Dwie notatki nie mogą mieć tego samego sluga.
8. Wpisany tekst jest wyświetlany bez interpretowania Markdown lub HTML.
9. Aplikacja nie wysyła treści notatek w żadnym żądaniu sieciowym.
10. Eksport JSON i ponowny import odtwarzają wszystkie notatki wraz z tytułami, slugami i datami.
11. Po wyczyszczeniu danych strony aplikacja nie udaje, że może odzyskać utracone notatki.
12. Build produkcyjny może zostać opublikowany jako statyczny katalog na GitHub Pages.

