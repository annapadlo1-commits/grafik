# GRAFIK PRO DEMO 2.0

Zaawansowana aplikacja demonstracyjna do planowania pracy dla dwóch lokalizacji i około 60 osób. Działa w Google Sheets oraz jako responsywna aplikacja internetowa Apps Script.

## Co zawiera

- wielokryterialny generator miesięcznego grafiku;
- twarde ograniczenia: dostępność, urlopy, lokalizacje, tylko poranki, odpoczynek dobowy, limity tygodniowe, dni z rzędu i jedna zmiana dziennie;
- miękkie kryteria: preferencje, sprawiedliwy podział, lokalizacja domyślna, koszty i pokrycie;
- pięć trybów optymalizacji;
- zmiany podstawowe, weekendowe, dodatkowe i stand-by;
- wydarzenia zwiększające zapotrzebowanie;
- scenariusze WHAT-IF, klonowanie i wersjonowanie planów;
- walidacja przed publikacją, automatyczne archiwizowanie poprzedniego planu;
- budżety per lokalizacja, koszty weekendowe i wieczorne;
- dashboard KPI, wykorzystanie etatów, alerty, prognoza sezonowa i rekomendowane FTE;
- panel pracownika: grafik, urlopy, preferencje i zamiany;
- role: administrator, księgowość, kierownik i pracownik;
- chronione arkusze kosztowe i administracyjne;
- import urlopów oraz eksport grafiku do CSV zgodnego z typowym formatem Kadromierza;
- powiadomienia kolejkowane, pełny audyt, kopie zapasowe i testy zdrowia aplikacji;
- dane DEMO: 60 pracowników, 2 lokalizacje, różne umowy i ograniczenia.

## Instalacja

1. Utwórz pusty Arkusz Google.
2. Otwórz **Rozszerzenia → Apps Script**.
3. Utwórz pliki o nazwach identycznych z plikami w paczce i wklej ich treść.
4. Pliki `Index.html`, `Styles.html` oraz `Scripts.html` utwórz jako HTML. Pozostałe pliki z rozszerzeniem `.gs` jako skrypty.
5. Zastąp manifest treścią `appsscript.json` (w ustawieniach edytora włącz wyświetlanie manifestu).
6. Zapisz projekt i uruchom funkcję `gpInstall`. Zaakceptuj wymagane uprawnienia.
7. Uruchom `gpLoadDemo`.
8. Odśwież arkusz i wybierz **GRAFIK PRO → Otwórz aplikację**.
9. Opcjonalnie: **Wdróż → Nowe wdrożenie → Aplikacja internetowa**. Uruchamianie: użytkownik uzyskujący dostęp. Dostęp ustaw zgodnie z zasadami organizacji.

## Pierwszy test

1. Otwórz Generator grafiku.
2. Wybierz miesiąc, scenariusz i tryb `ZRÓWNOWAŻONY`.
3. Kliknij **Generuj pełny grafik**.
4. Sprawdź dashboard, alerty, wykorzystanie etatów i koszty.
5. Otwórz Grafik miesięczny i opublikuj plan.
6. Porównaj sklonowany wariant w sekcji Scenariusze.
7. Uruchom testy w Administracji. Oczekiwany wynik: wszystkie testy `PASS`.

## Ważne w wersji DEMO

- konta `@demo.pl` są przykładowe i nie wysyłają wiadomości;
- przed wdrożeniem produkcyjnym należy zastąpić dane DEMO rzeczywistymi, ustalić dokładny format Kadromierza i skonfigurować konta organizacji;
- silnik jest deterministycznym heurystycznym optymalizatorem zgodnym z limitami Apps Script. Dla produkcji można rozszerzyć go o dokładny solver zewnętrzny, ale aplikacja DEMO działa bez płatnych usług;
- szczegółowa zgodność z prawem pracy musi zostać potwierdzona dla regulaminu i systemu czasu pracy konkretnego pracodawcy.
