function onOpen() {
  SpreadsheetApp.getUi().createMenu('GRAFIK PRO')
    .addItem('Otwórz aplikację', 'gpOpenSidebar')
    .addSeparator()
    .addItem('Instaluj / napraw strukturę', 'gpInstall')
    .addItem('Załaduj pełne dane DEMO', 'gpLoadDemo')
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
    gpApplyValidations_();
    gpCreateDashboard_();
    PropertiesService.getDocumentProperties().setProperty('GP_VERSION', GP.VERSION);
    gpAudit_('INSTALL', 'SYSTEM', GP.VERSION, null, {sheets: Object.keys(GP_HEADERS).length});
    SpreadsheetApp.getActive().toast('Struktura GRAFIK PRO jest gotowa.', GP.NAME, 6);
    return {ok: true, version: GP.VERSION, sheets: Object.keys(GP_HEADERS).length};
  });
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
    ['A6:B8', 'PRACOWNICY', `=COUNTA('${GP.SHEETS.EMPLOYEES}'!A2:A)`],
    ['C6:D8', 'AKTYWNY PLAN', `=COUNTIF('${GP.SHEETS.PLANS}'!F2:F;"${GP.PLAN_STATUS.PUBLISHED}")`],
    ['E6:F8', 'ZMIANY', `=COUNTA('${GP.SHEETS.ASSIGNMENTS}'!A2:A)`],
    ['G6:H8', 'ALERTY', `=COUNTIF('${GP.SHEETS.KPI}'!E2:E;"ALERT")`]
  ];
  cards.forEach(c => {
    sh.getRange(c[0]).merge().setFormula(`="${c[1]}: "&${c[2]}`)
      .setBackground('#ffffff').setFontColor('#0f172a').setFontSize(15).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.getRange('A10:H15').merge().setValue('Otwórz menu „GRAFIK PRO” → „Otwórz aplikację”.\nPanel webowy działa również na telefonie po wdrożeniu jako aplikacja internetowa.')
    .setBackground('#f8fafc').setFontColor('#475569').setFontSize(13).setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setColumnWidths(1, 8, 130);
  sh.setRowHeights(1, 15, 32);
  sh.setHiddenGridlines(true);
}
