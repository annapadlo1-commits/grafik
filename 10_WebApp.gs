function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(GP.NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1');
}

function gpInclude(filename){return HtmlService.createHtmlOutputFromFile(filename).getContent();}

function gpOpenFullApp(){
  const url=ScriptApp.getService().getUrl();
  const body=url
    ? `<div style="font:14px Arial;padding:24px;text-align:center"><h2>GRAFIK PRO</h2><p>Aplikacja otworzy się w pełnym oknie przeglądarki.</p><a href="${url}" target="_blank" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:bold">OTWÓRZ NA PEŁNYM EKRANIE</a></div>`
    : `<div style="font:14px Arial;padding:24px"><h2>Najpierw wykonaj wdrożenie</h2><p>W edytorze Apps Script wybierz <b>Wdróż → Nowe wdrożenie → Aplikacja internetowa</b>. Następnie ponownie użyj tego przycisku.</p></div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(body).setWidth(520).setHeight(260),'GRAFIK PRO — pełny ekran');
}

function gpOpenQuickPanel(){
  const html=`<div style="font:13px Arial;padding:14px"><h3>GRAFIK PRO</h3><button onclick="google.script.run.gpOpenFullApp()" style="width:100%;padding:10px">Pełna aplikacja</button><hr><p>Ostatnia synchronizacja:</p><b>${gpCentralStatus_().lastSync||'jeszcze nie wykonano'}</b><p>Pełny dashboard nie jest wyświetlany w panelu bocznym.</p></div>`;
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(html).setTitle('GRAFIK PRO — szybkie działania'));
}

function gpBootstrap(){
  const user=gpCurrentUser_(),month=gpMonth_(new Date());
  return {app:{name:GP.NAME,version:GP.VERSION},user,month,
    locations:gpRows_(GP.SHEETS.LOCATIONS),employees:gpRows_(GP.SHEETS.EMPLOYEES).map(e=>({ID:e.ID,name:e.IMIĘ_I_NAZWISKO})),
    plans:gpListPlans(month),health:gpHealthCheck()};
}
