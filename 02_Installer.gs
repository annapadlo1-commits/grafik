function onOpen() {
  SpreadsheetApp.getUi().createMenu('GRAFIK PRO')
    .addItem('Otwórz aplikację NA PEŁNYM EKRANIE', 'gpOpenFullApp')
    .addItem('Panel szybkich działań', 'gpOpenQuickPanel')
    .addItem('Ustaw adres aplikacji pełnoekranowej', 'gpConfigureWebAppUrl')
    .addSeparator()
    .addItem('Napraw panel i połączenie', 'gpRepairPanelAndConnection')
    .addItem('Instaluj / napraw strukturę', 'gpInstall')
    .addItem('Załaduj pełne dane DEMO', 'gpLoadDemo')
    .addItem('Synchronizuj trzy centrale', 'gpSyncCentrals')
    .addItem('Uruchom testy', 'gpRunAllTests')
    .addItem('Utwórz kopię bezpieczeństwa', 'gpCreateBackup')
    .addToUi();
}

function gpInstall() {
  return gpLock_(() => {
    const ss = gpSs_();
    Object.keys(GP_HEADERS).forEach((name, index) => {
      let sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      const headers = GP_HEADERS[name];
      if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setBackground('#172554').setFontColor('#ffffff').setFontWeight('bold')
        .setHorizontalAlignment('center');
      sh.setFrozenRows(1);
      sh.setTabColor(index < 7 ? '#2563eb' : index < 16 ? '#7c3aed' : '#64748b');
      sh.autoResizeColumns(1, headers.length);
      if ([GP.SHEETS.COSTS, GP.SHEETS.USERS, GP.SHEETS.CONFIG].includes(name)) sh.hideSheet();
    });
    gpSeedConfig_();
    gpSeedCentralConfig_();
    gpSeedPlanningProfiles_();
    gpInstallRealWorldModel_();
    gpApplyValidations_();
    gpCreateDashboard_();
    PropertiesService.getDocumentProperties().setProperty('GP_VERSION', GP.VERSION);
    gpAudit_('INSTALL', 'SYSTEM', GP.VERSION, null, {sheets: Object.keys(GP_HEADERS).length});
    SpreadsheetApp.getActive().toast('Struktura GRAFIK PRO jest gotowa.', GP.NAME, 6);
    return {ok: true, version: GP.VERSION, sheets: Object.keys(GP_HEADERS).length};
  });
}

function gpSeedPlanningProfiles_(){
  if(!gpRows_(GP.SHEETS.SCENARIOS).length)gpReplaceRows_(GP.SHEETS.SCENARIOS,[
    {SCENARIUSZ_ID:'BAZOWY',NAZWA:'Bazowy',MNOŻNIK_ZAPOTRZEBOWANIA:1,MNOŻNIK_BUDŻETU:1,DOMYŚLNY_POZIOM_OBSADY:'OPTIMAL',NADGODZINY:'OGRANICZONE',MAX_NADGODZIN_H:0,REDUKCJA_DOSTĘPNOŚCI_PROC:0,ZATRUDNIENIE_CZASOWE:'NIE',AKTYWNY:'TAK',OPIS:'Standardowe warunki operacyjne'},
    {SCENARIUSZ_ID:'WYSOKI_RUCH',NAZWA:'Wysoki ruch',MNOŻNIK_ZAPOTRZEBOWANIA:1.25,MNOŻNIK_BUDŻETU:1.15,DOMYŚLNY_POZIOM_OBSADY:'OPTIMAL',NADGODZINY:'DOZWOLONE',MAX_NADGODZIN_H:8,REDUKCJA_DOSTĘPNOŚCI_PROC:0,ZATRUDNIENIE_CZASOWE:'OPCJONALNIE',AKTYWNY:'TAK',OPIS:'Zwiększone zapotrzebowanie i budżet'},
    {SCENARIUSZ_ID:'REDUKCJA_KOSZTÓW',NAZWA:'Redukcja kosztów',MNOŻNIK_ZAPOTRZEBOWANIA:1,MNOŻNIK_BUDŻETU:.85,DOMYŚLNY_POZIOM_OBSADY:'MINIMUM',NADGODZINY:'BLOKOWANE',MAX_NADGODZIN_H:0,REDUKCJA_DOSTĘPNOŚCI_PROC:0,ZATRUDNIENIE_CZASOWE:'NIE',AKTYWNY:'TAK',OPIS:'Minimalna bezpieczna obsada'},
    {SCENARIUSZ_ID:'BRAKI_KADROWE',NAZWA:'Braki kadrowe',MNOŻNIK_ZAPOTRZEBOWANIA:1,MNOŻNIK_BUDŻETU:1,DOMYŚLNY_POZIOM_OBSADY:'MINIMUM',NADGODZINY:'DOZWOLONE',MAX_NADGODZIN_H:8,REDUKCJA_DOSTĘPNOŚCI_PROC:15,ZATRUDNIENIE_CZASOWE:'SUGEROWANE',AKTYWNY:'TAK',OPIS:'Symulacja ograniczonej dostępności'},
    {SCENARIUSZ_ID:'SEZONOWY',NAZWA:'Sezonowy',MNOŻNIK_ZAPOTRZEBOWANIA:1.4,MNOŻNIK_BUDŻETU:1.25,DOMYŚLNY_POZIOM_OBSADY:'OPTIMAL',NADGODZINY:'DOZWOLONE',MAX_NADGODZIN_H:12,REDUKCJA_DOSTĘPNOŚCI_PROC:0,ZATRUDNIENIE_CZASOWE:'TAK',AKTYWNY:'TAK',OPIS:'Sezonowy wzrost ruchu'}
  ]);
  if(!gpRows_(GP.SHEETS.MODES).length)gpReplaceRows_(GP.SHEETS.MODES,[
    {TRYB_ID:'ZRÓWNOWAŻONY',NAZWA:'Zrównoważony',WAGA_KOSZT_PROC:20,WAGA_PREFERENCJE_PROC:20,WAGA_SPRAWIEDLIWOŚĆ_PROC:25,WAGA_POKRYCIE_PROC:30,WAGA_CIĄGŁOŚĆ_PROC:5,AKTYWNY:'TAK',OPIS:'Równowaga wszystkich kryteriów'},
    {TRYB_ID:'MINIMALNY_KOSZT',NAZWA:'Minimalny koszt',WAGA_KOSZT_PROC:50,WAGA_PREFERENCJE_PROC:5,WAGA_SPRAWIEDLIWOŚĆ_PROC:10,WAGA_POKRYCIE_PROC:30,WAGA_CIĄGŁOŚĆ_PROC:5,AKTYWNY:'TAK',OPIS:'Najwyższy priorytet kosztowy'},
    {TRYB_ID:'PREFERENCJE',NAZWA:'Preferencje pracowników',WAGA_KOSZT_PROC:10,WAGA_PREFERENCJE_PROC:45,WAGA_SPRAWIEDLIWOŚĆ_PROC:15,WAGA_POKRYCIE_PROC:25,WAGA_CIĄGŁOŚĆ_PROC:5,AKTYWNY:'TAK',OPIS:'Maksymalizacja preferencji'},
    {TRYB_ID:'RÓWNY_PODZIAŁ',NAZWA:'Równy podział',WAGA_KOSZT_PROC:10,WAGA_PREFERENCJE_PROC:10,WAGA_SPRAWIEDLIWOŚĆ_PROC:45,WAGA_POKRYCIE_PROC:30,WAGA_CIĄGŁOŚĆ_PROC:5,AKTYWNY:'TAK',OPIS:'Wyrównanie wykorzystania etatów'},
    {TRYB_ID:'MAKSYMALNE_POKRYCIE',NAZWA:'Maksymalne pokrycie',WAGA_KOSZT_PROC:5,WAGA_PREFERENCJE_PROC:5,WAGA_SPRAWIEDLIWOŚĆ_PROC:10,WAGA_POKRYCIE_PROC:75,WAGA_CIĄGŁOŚĆ_PROC:5,AKTYWNY:'TAK',OPIS:'Najwyższy priorytet obsady'}
  ]);
  if(!gpRows_(GP.SHEETS.LEVELS).length)gpReplaceRows_(GP.SHEETS.LEVELS,[
    {POZIOM_ID:'MINIMUM',NAZWA:'Minimalny',ŹRÓDŁO_CELU:'MIN',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:100,AKTYWNY:'TAK',OPIS:'Wymagane minimum'},
    {POZIOM_ID:'OPTIMAL',NAZWA:'Optymalny',ŹRÓDŁO_CELU:'OPT',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:100,AKTYWNY:'TAK',OPIS:'Docelowa obsada'},
    {POZIOM_ID:'MAXIMUM',NAZWA:'Maksymalny',ŹRÓDŁO_CELU:'MAX',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:120,AKTYWNY:'TAK',OPIS:'Górna dozwolona obsada'},
    {POZIOM_ID:'PLUS_10',NAZWA:'110% optymalnego',ŹRÓDŁO_CELU:'OPT',MNOŻNIK:1.1,LIMIT_BUDŻETU_PROC:115,AKTYWNY:'TAK',OPIS:'Bufor 10%'},
    {POZIOM_ID:'BUDGET',NAZWA:'Budżetowy',ŹRÓDŁO_CELU:'OPT',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:100,AKTYWNY:'TAK',OPIS:'Najlepsza obsada w budżecie'},
    {POZIOM_ID:'DYNAMIC',NAZWA:'Dynamiczny',ŹRÓDŁO_CELU:'OPT',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:110,AKTYWNY:'TAK',OPIS:'Wydarzenia i scenariusz'}
  ]);
}

function gpSeedCentralConfig_() {
  const sh=gpSheet_(GP.SHEETS.CENTRALS);
  if(sh.getLastRow()>1)return;
  const rows=[
    ['USTAWIENIA_FILE_ID','','ID pliku GRAFIK PRO — USTAWIENIA I BAZA','NIEPOŁĄCZONO'],
    ['HR_FINANSE_FILE_ID','','ID pliku GRAFIK PRO — HR I FINANSE','NIEPOŁĄCZONO'],
    ['WEB_APP_URL','','Aktualny adres wdrożonej aplikacji zakończony /exec','NIEUSTAWIONY'],
    ['OSTATNIA_SYNCHRONIZACJA','','Data ostatniego poprawnego odświeżenia','OCZEKUJE'],
    ['WERSJA_SNAPSHOTU','','Wersja lokalnej kopii danych','OCZEKUJE']
  ];
  sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
  sh.setColumnWidth(1,230);sh.setColumnWidth(2,360);sh.setColumnWidth(3,420);sh.setColumnWidth(4,150);
  sh.showSheet();
}

function gpSeedConfig_() {
  if (gpRows_(GP.SHEETS.CONFIG).length) return;
  const config = [
    ['APP_VERSION', GP.VERSION, 'Wersja aplikacji', 'NIE'],
    ['MIN_ODPOCZYNEK_H', 11, 'Minimalny odpoczynek dobowy', 'TAK'],
    ['MAX_DNI_Z_RZĘDU', 6, 'Domyślny limit dni z rzędu', 'TAK'],
    ['MAX_H_TYDZIEŃ', 48, 'Domyślny limit godzin tygodniowo', 'TAK'],
    ['TRYB_DOMYŚLNY', 'ZRÓWNOWAŻONY', 'KOSZT / preferencje / sprawiedliwość', 'TAK'],
    ['EMAIL_POWIADOMIENIA', 'NIE', 'Wysyłka e-mail w demo', 'TAK'],
    ['AUTO_BACKUP', 'TAK', 'Kopia przed publikacją', 'TAK'],
    ['KADROMIERZ_FORMAT', 'CSV_PL', 'Format eksportu', 'TAK']
  ];
  config.forEach(r => gpAppend_(GP.SHEETS.CONFIG, {KLUCZ:r[0], WARTOŚĆ:r[1], OPIS:r[2], EDYTOWALNE:r[3]}));
}

function gpApplyValidations_() {
  const boolRule = SpreadsheetApp.newDataValidation().requireValueInList(['TAK', 'NIE'], true).build();
  [GP.SHEETS.USERS, GP.SHEETS.EMPLOYEES, GP.SHEETS.LOCATIONS].forEach(name => {
    const sh = gpSheet_(name);
    const col = GP_HEADERS[name].indexOf(name === GP.SHEETS.LOCATIONS ? 'AKTYWNA' : 'AKTYWNY') + 1;
    sh.getRange(2, col, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(boolRule);
  });
}

function gpCreateDashboard_() {
  const ss = gpSs_();
  let sh = ss.getSheetByName('PANEL');
  if (!sh) sh = ss.insertSheet('PANEL', 0);
  sh.clear();
  sh.getRange('A1:H2').merge().setValue(GP.NAME)
    .setBackground('#0f172a').setFontColor('#fff').setFontSize(24).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('A4:H4').merge().setValue('CENTRUM PLANOWANIA • BUDŻET • ZASTĘPSTWA • ANALITYKA')
    .setBackground('#dbeafe').setFontColor('#1e3a8a').setFontWeight('bold').setHorizontalAlignment('center');
  const cards = [
    ['A6:B8', 'PRACOWNICY'],
    ['C6:D8', 'AKTYWNY PLAN'],
    ['E6:F8', 'PRZYDZIAŁY'],
    ['G6:H8', 'ALERTY']
  ];
  cards.forEach(c => {
    sh.getRange(c[0]).merge().setValue(`${c[1]}: 0`)
      .setBackground('#ffffff').setFontColor('#0f172a').setFontSize(15).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.getRange('A10:H15').merge().setValue('Otwórz menu „GRAFIK PRO” → „Otwórz aplikację”.\nPanel webowy działa również na telefonie po wdrożeniu jako aplikacja internetowa.')
    .setBackground('#f8fafc').setFontColor('#475569').setFontSize(13).setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setColumnWidths(1, 8, 130);
  sh.setRowHeights(1, 15, 32);
  sh.setHiddenGridlines(true);
  gpRefreshDashboard_();
}

function gpRepairPanelAndConnection(){
  gpCreateDashboard_();
  PropertiesService.getDocumentProperties().setProperty('GP_VERSION',GP.VERSION);
  SpreadsheetApp.flush();
  const url=gpGetConfiguredWebAppUrl_();
  SpreadsheetApp.getActive().toast(
    url?'Panel naprawiony. Adres aplikacji jest ustawiony.':'Panel naprawiony. Teraz ustaw aktualny adres aplikacji.',
    'GRAFIK PRO 2.1.2',8
  );
  if(!url)gpConfigureWebAppUrl();
  return {ok:true,version:GP.VERSION,urlConfigured:!!url};
}
