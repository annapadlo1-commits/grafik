# Centrala 1 — GRAFIK PRO Planner

## Instalacja

1. Utwórz trzeci Arkusz Google: `GRAFIK PRO — PLANNER`.
2. Wklej wszystkie pliki tego katalogu do projektu Apps Script.
3. Uruchom `gpInstall`.
4. Otwórz arkusz `CENTRALE`.
5. Wklej ID pliku Ustawienia przy `USTAWIENIA_FILE_ID`.
6. Wklej ID pliku HR i Finanse przy `HR_FINANSE_FILE_ID`.
7. Uruchom `gpSyncCentrals`.
8. Uruchom `gpLoadDemo`, aby utworzyć demonstracyjne zapotrzebowanie, wydarzenia i dostępności. Przy połączonych centralach ta funkcja nie nadpisuje pracowników, umów ani budżetów.
9. Wdróż projekt jako aplikację internetową:
   - wykonuj jako: właściciel wdrożenia,
   - dostęp: zgodnie z regułami organizacji.
10. W Arkuszu wybierz `GRAFIK PRO → Otwórz aplikację NA PEŁNYM EKRANIE`.

Pełnego dashboardu nie należy używać jako panelu bocznego. Panel boczny zawiera wyłącznie skróty i status synchronizacji.

## Synchronizacja

Planner pobiera dane z dwóch chronionych central do lokalnego snapshotu. Synchronizacja:

- waliduje identyfikatory i relacje;
- nie zapisuje częściowych danych po błędzie;
- aktualizuje pracowników bez zmiany kontraktu silnika;
- zapisuje czas i wersję synchronizacji;
- chroni indywidualne dane finansowe przed wyświetleniem w interfejsie kierownika.
