# Matryca odbioru GRAFIK PRO DEMO 2.0

## Instalacja i dane

- `gpInstall` tworzy komplet arkuszy, nagłówków, formatów i panel startowy.
- `gpLoadDemo` ładuje 60 pracowników, dwa lokale, umowy, budżety, zmiany, wydarzenia, dostępności i zapotrzebowanie na cały miesiąc.
- ponowne uruchomienie instalatora nie usuwa danych operacyjnych.

## Planowanie

- plan podstawowy pokrywa zmiany poranne i popołudniowe obu lokali;
- weekendy uwzględniają wyższą obsadę i zmianę dodatkową;
- wydarzenia zwiększają wymagane zapotrzebowanie;
- osoba przypisana wyłącznie do jednej lokalizacji nie trafia do drugiej;
- osoba `TYLKO_RANO` nie trafia na popołudnie;
- nieobecność i niedostępność blokują przydział;
- jedna osoba nie otrzymuje dwóch zwykłych zmian tego samego dnia;
- limity tygodniowe, odpoczynek dobowy i dni z rzędu są respektowane;
- stand-by powstaje niezależnie od obsady podstawowej;
- koszt uwzględnia weekend i zmianę popołudniową.

## Scenariusze

- każdy tryb optymalizacji generuje osobny wariant;
- klonowanie nie zmienia planu źródłowego;
- snapshot wersji zawiera wszystkie przydziały;
- przywrócenie wersji zachowuje historię;
- publikacja jest blokowana przez błąd twardy;
- publikacja archiwizuje wcześniejszy opublikowany plan tego miesiąca.

## Analityka

- KPI pokrycia, kosztu, budżetu, sprawiedliwości i preferencji są zapisane;
- dashboard pokazuje wykorzystanie nominałów i alerty;
- porównanie planów prezentuje identyczny zestaw miar;
- prognoza roczna zawiera 12 miesięcy, indeks sezonowy i rekomendowane FTE.

## Samoobsługa i integracje

- pracownik widzi tylko przydziały opublikowanego planu;
- wniosek urlopowy trafia do kolejki;
- preferencja trafia do silnika następnej generacji;
- zamiana wymaga zatwierdzenia kierownika;
- import Kadromierza raportuje nierozpoznane osoby;
- eksport zawiera pracownika, datę, godziny, lokalizację i typ zmiany.

## Bezpieczeństwo i ciągłość

- koszty, konfiguracja i role są ukryte w arkuszu;
- operacje zapisują ślad w audycie;
- publikacja może automatycznie wykonać pełną kopię;
- powiadomienia pozostają w kolejce, gdy wysyłka e-mail DEMO jest wyłączona;
- `gpHealthCheck` kontroluje strukturę, wersję i spójność relacji;
- `gpRunAllTests` zapisuje wynik każdej próby w arkuszu `TESTY`.
