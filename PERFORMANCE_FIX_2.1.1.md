# Performance Fix 2.1.1

Naprawiono przekroczenie maksymalnego czasu podczas generowania pełnego miesiąca.

## Przyczyny

- konfiguracja była odczytywana z Arkusza dla każdego ocenianego kandydata;
- dostępność była filtrowana liniowo dla każdego pracownika i każdej zmiany;
- nieobecności były wielokrotnie przeszukiwane;
- każdy przydział był zapisywany osobnym `appendRow`;
- duży snapshot wersji był zapisywany jako nieskompresowany JSON w jednej komórce;
- walidacja pokrycia wielokrotnie skanowała wszystkie przydziały.

## Zmiany

- konfiguracja jest pobierana raz na generowanie;
- dostępności i nieobecności mają indeksy `pracownik + data`;
- wszystkie przydziały są zapisywane jednym `setValues`;
- snapshot wersji jest kompresowany GZIP + Base64;
- walidacja pokrycia korzysta z indeksu `data + lokalizacja + zmiana`;
- odpowiedź generatora zawiera czasy etapów: odczyt, optymalizacja, zapis i finalizacja;
- test regresyjny blokuje wydanie, jeśli sama optymalizacja przekracza 45 sekund.
