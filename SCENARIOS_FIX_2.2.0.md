# GRAFIK PRO 2.2.0 — Scenarios & Generation Fix

## Naprawa wyniku 0

- zapotrzebowanie jest przetwarzane chronologicznie;
- priorytet nie może przenieść późniejszych weekendów przed wcześniejsze dni;
- odpoczynek dobowy jest liczony względem rzeczywiście poprzedniej zmiany;
- stand-by jest przydzielany po obsadzeniu zwykłych zmian;
- powstaje maksymalnie jeden zestaw stand-by dziennie na lokalizację;
- pusty plan powoduje błąd diagnostyczny i nie jest zapisywany;
- punktacja ma zakres 0–100 i składa się z pokrycia, budżetu, sprawiedliwości oraz preferencji;
- komunikat po generowaniu pokazuje liczbę przydziałów.

## Konfigurowalne profile

W centrali Ustawienia dodano:

- `SCENARIUSZE`,
- `TRYBY_OPTYMALIZACJI`,
- `POZIOMY_OBSADY`.

Planner pobiera je podczas synchronizacji. Generator pokazuje profile dynamicznie i wyświetla podgląd założeń przed uruchomieniem.

## Aktualizacja istniejącego DEMO

1. Podmień projekt `USTAWIENIA_BAZA`.
2. Uruchom `dbInstall`, a następnie `dbValidate`.
3. Podmień projekt `PLANNER`.
4. Uruchom `gpInstall`.
5. Uruchom `gpSyncCentrals`.
6. Uruchom `gpRunAllTests`.
7. Utwórz nową wersję wdrożenia aplikacji webowej.
