# Panel Fix 2.1.2

## Naprawione

- usunięto dodatkowy znak `=` z czterech formuł panelu;
- formuły przekazywane przez Apps Script używają poprawnej składni `setFormula`;
- dodano funkcję `gpRepairPanelAndConnection`, która naprawia dashboard bez usuwania danych;
- adres aplikacji internetowej jest zapisywany w `CENTRALE` oraz właściwościach projektu;
- stare lub usunięte wdrożenie nie jest już pobierane automatycznie;
- menu pokazuje instrukcję, gdy adres nie został skonfigurowany;
- pełny adres jest widoczny w oknie otwierania, więc można sprawdzić, dokąd prowadzi przycisk.

## Aktualizacja istniejącego Plannera

1. Podmień wszystkie pliki Plannera.
2. Zapisz projekt.
3. Uruchom `gpRepairPanelAndConnection`.
4. W Apps Script wybierz `Wdróż → Zarządzaj wdrożeniami`.
5. Jeśli stare wdrożenie nie działa, utwórz nowe wdrożenie typu `Aplikacja internetowa`.
6. Ustaw `Wykonuj jako: Ja`.
7. Ustaw dostęp odpowiednio do testu lub organizacji.
8. Skopiuj adres `/exec`.
9. W Arkuszu wybierz `GRAFIK PRO → Ustaw adres aplikacji pełnoekranowej`.
10. Wklej adres.
11. Wybierz `Otwórz aplikację NA PEŁNYM EKRANIE`.
