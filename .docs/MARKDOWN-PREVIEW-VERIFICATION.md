# Weryfikacja podglądu Markdown

Data: 2026-10-30. Implementacja zgodna z [planem](MARKDOWN-PREVIEW-PLAN.md). Nie zmieniono proponowanych limitów: 250 000 jednostek `content.length`, 10 000 tokenów, głębokość 32, 1000 ms na odpowiedź Workera wraz ze startem.

## Środowisko i kontrole

Windows, Intel Core i7-10875H @ 2.30 GHz, Node 22.14.0, Edge 156.0.4314.50 w trybie headless, Marked 18.1.2. Przeglądarka korzystała z osobnego, tymczasowego profilu. Testowano lokalny build produkcyjny, bez publikacji.

| Kontrola | Wynik |
| --- | --- |
| `npm test` | 175/175 testów w 11 plikach. |
| `npm run typecheck` | Bez błędów; wykonywane także przez oba buildy. |
| `npm run build` | Sukces dla `/` i `VITE_BASE_PATH=/local-notes-editor/`. |
| Rzeczywisty Worker modułowy | Tokeny przechodzą przez `postMessage` i renderują podgląd produkcyjny. |
| Offline | Dla obu base path: precache, przejęcie strony przez service worker, odcięcie sieci, odświeżenie, otwarcie podglądu zapisanej notatki. |
| Precache | 14 zasobów, w tym lokalny `assets/markdown.worker-*.js`; poprawny prefiks dla obu ścieżek. |
| Markdown i bezpieczeństwo | Zakres v1, zagnieżdżone listy, literalne HTML/SVG i obrazy, brak aktywnego HTML i niedozwolonych adresów. W scenariuszu przeglądarkowym zero żądań do zewnętrznych originów i zero błędów strony. |
| Dane | Zgodność całego źródła z IndexedDB i pobranym TXT, również po przełączeniu trybów. Testy aplikacji sprawdzają brak zapisu po samym przełączeniu. |
| Edytor | `Ctrl+Enter`, Escape, fokus, zaznaczenie, natywne undo/redo po powrocie z podglądu, zmiana fontu przy otwartym podglądzie. |
| Asynchroniczność | Deterministyczne testy opóźnionych odpowiedzi, zmiany treści i notatki, niepoprawnego ID, błędów, braku Workera, timeoutu, odmontowania i ponownego otwarcia. Brak pracy w ukrytym podglądzie i po samym otwarciu panelu. |
| Układ | Oględziny zrzutów 1440×900 i 1024×768. Szerokość strony odpowiednio 1440/1024 px, podglądu 920/896 px. Długi kod przewija się lokalnie; adresy się łamią. |

Status jest osobnym, krótkim regionem `role="status"`. Treść notatki nie jest regionem live. Fokus pozostaje w regionie podglądu również podczas przygotowywania i zwykłego podglądu. Nie wykonywano odsłuchu w rzeczywistym czytniku ekranu.

## Metoda pomiaru

Oddzielny lokalny harness uruchamiał ten sam `parseMarkdown` w rozgrzanym Workerze i ten sam renderer Preact. Każdą próbkę powtórzono trzykrotnie; tabela podaje mediany w ms. Tokenizacja obejmuje lexer i iteracyjną kontrolę budżetu. Transport to czas żądanie–odpowiedź pomniejszony o tokenizację: obejmuje kopiowanie oraz kolejki zadań, nie jest pomiarem samej serializacji. Renderowanie obejmuje walidację otrzymanego drzewa, utworzenie VNode, aktualizację DOM i wymuszenie layoutu w kolumnie 920 px z CSS aplikacji; nie obejmuje osobnego pomiaru paint.

Próbki powstawały przez powtarzanie poniższych fragmentów i przycięcie do dokładnie 10 000, 50 000 lub 100 000 jednostek `content.length`:

- tekst: `Zwykła notatka z polskimi literami, spacjami i nową linią.` z końcowym Enterem;
- Markdown: nagłówek, osiem powtórzeń zdania „Treść akapitu bez formatowania.”, pogrubienie, kursywa, link HTTP/HTTPS i lista dwóch punktów, oddzielone akapitami;
- nawiasy: ciąg `[`;
- niedomknięte linki: ciąg `[x](https://example.com(`;
- zagnieżdżenia: 40 prefiksów `> `, tekst i pusta linia; oczekiwany wynik to odrzucenie głębokości przed renderowaniem.

| Próbka | Długość | Tokenizacja | Transport | Renderowanie | Wynik |
| --- | ---: | ---: | ---: | ---: | --- |
| Tekst | 10 000 | 0,3 | 0,3 | 1,6 | Podgląd |
| Tekst | 50 000 | 1,3 | 0,6 | 6,4 | Podgląd |
| Tekst | 100 000 | 2,2 | 1,1 | 13,3 | Podgląd |
| Markdown | 10 000 | 3,8 | 1,3 | 8,6 | Podgląd |
| Markdown | 50 000 | 7,0 | 4,0 | 28,5 | Podgląd |
| Markdown | 100 000 | 9,4 | 7,3 | 58,8 | Podgląd |
| Nawiasy | 10 000 | 5,4 | 0,7 | 1,7 | Podgląd |
| Nawiasy | 50 000 | 25,1 | 2,9 | 7,2 | Podgląd |
| Nawiasy | 100 000 | 56,8 | 2,8 | 16,0 | Podgląd |
| Niedomknięte linki | 10 000 | 1,1 | 0,5 | 1,7 | Podgląd |
| Niedomknięte linki | 50 000 | 3,3 | 0,7 | 6,1 | Podgląd |
| Niedomknięte linki | 100 000 | 7,1 | 0,9 | 11,5 | Podgląd |
| Zagnieżdżenia | 10 000 | 8,2 | 0,2 | — | `depth-limit` |
| Zagnieżdżenia | 50 000 | 47,4 | 0,5 | — | `depth-limit` |
| Zagnieżdżenia | 100 000 | 89,1 | 0,4 | — | `depth-limit` |

## Pełny podgląd i przerwanie pracy

Osobno zmierzono rzeczywistą aplikację produkcyjną: od zdarzenia `Ctrl+Enter` do zaktualizowanego DOM i layoutu gotowego podglądu. Każde otwarcie uruchamia nowego Workera, zatem wynik obejmuje jego start; zasoby aplikacji były już załadowane. Trzy próby po 50 000 znaków:

| Próbka | Czasy w ms | Mediana |
| --- | --- | ---: |
| Tekst | 96,0; 87,5; 77,5 | 87,5 |
| Markdown | 134,5; 157,8; 131,9 | 134,5 |

Cel 200 ms dla typowej próbki 50k jest spełniony na tym sprzęcie i tych danych. Wynik nie gwarantuje identycznego czasu dla dowolnego dokumentu ani urządzenia. Budżety liczby i głębokości tokenów nadal obowiązują niezależnie od długości.

W prawdziwej przeglądarce podstawiono także rzeczywistego Workera z nieskończoną pętlą zamiast parsera. Kod produkcyjny przerwał go po 1007 ms dla `/` i 1009,5 ms dla `/local-notes-editor/`, zachowując całe źródło ze statusem zwykłego podglądu. Różnica względem 1000 ms wynika z kolejki zdarzeń przeglądarki; limit pozostaje ustawiony na 1000 ms. Odpowiedź odebrana po terminie jest odrzucana także przed wykonaniem callbacka timera. W osobnej próbie Escape podczas pracy nad 100k nawiasów przywracał edycję w 45 ms dla obu ścieżek. Testy jednostkowe timeoutu i anulowania korzystają ze sterowanego zegara, bez progów czasu CPU.

Nie znaleziono potrzeby zmiany limitów. Marked pozostaje jedynym parserem składni; stare `renderLinks.tsx` i jego testy zostały zastąpione testami tokenizacji, renderera i cyklu życia Workera. Istniejąca ikona oka została zachowana; pliki instalacji Impeccable i jej raporty nie były zmieniane.

## Poprawka po przeglądzie

Przegląd wykazał, że literalne wyświetlanie obrazu nie usuwa `image.tokens` z wiadomości Workera. Walidator uwzględnia teraz te poddrzewa w limitach liczby i głębokości, również dla pomocniczych `tokens` na przyszłych tokenach literalnych. Dodano trzy testy regresji: etykietę obrazu z 15 005 tokenami, zagnieżdżone formatowanie etykiety o głębokości 43 oraz pomocnicze dzieci nieznanego tokenu. Przekroczenie limitu powoduje zwykły podgląd całego źródła przed przesłaniem wyniku. Powyższe pomiary wydajności dotyczą wcześniejszego przebiegu na próbkach bez obrazów; nie były ponawiane po tej poprawce.
