function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(GP.NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1');
}

function gpInclude(filename){return HtmlService.createHtmlOutputFromFile(filename).getContent();}

function gpOpenFullApp(){
  const url=gpGetConfiguredWebAppUrl_();
  const body=url
    ? `<div style="font:14px Arial;padding:24px;text-align:center"><h2 style="margin-top:0">GRAFIK PRO</h2><p>Aplikacja otworzy się w nowej karcie na pełnym ekranie.</p><a href="${gpEscapeHtml_(url)}" target="_blank" rel="noopener" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:bold">OTWÓRZ APLIKACJĘ</a><p style="font-size:11px;color:#64748b;margin-top:18px;word-break:break-all">${gpEscapeHtml_(url)}</p><button onclick="google.script.host.close()" style="padding:8px 14px">Zamknij</button></div>`
    : `<div style="font:14px Arial;padding:24px"><h2 style="margin-top:0">Brak aktywnego adresu aplikacji</h2><ol><li>W Apps Script wybierz <b>Wdróż → Nowe wdrożenie</b>.</li><li>Typ: <b>Aplikacja internetowa</b>.</li><li>Wykonuj jako: <b>Ja</b>.</li><li>Skopiuj adres zakończony <b>/exec</b>.</li><li>W arkuszu wybierz <b>GRAFIK PRO → Ustaw adres aplikacji pełnoekranowej</b>.</li></ol></div>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(body).setWidth(600).setHeight(url?330:390),'GRAFIK PRO — pełny ekran');
}

function gpOpenQuickPanel(){
  const url=gpGetConfiguredWebAppUrl_();
  const link=url?`<a href="${gpEscapeHtml_(url)}" target="_blank" style="display:block;text-align:center;background:#2563eb;color:#fff;text-decoration:none;padding:11px;border-radius:8px;font-weight:bold">Pełna aplikacja</a>`:'<p style="color:#b91c1c"><b>Brak aktywnego adresu aplikacji.</b></p>';
  const html=`<div style="font:13px Arial;padding:14px"><h3>GRAFIK PRO</h3>${link}<hr><p>Ostatnia synchronizacja:</p><b>${gpCentralStatus_().lastSync||'jeszcze nie wykonano'}</b><p>Pełny dashboard nie jest wyświetlany w panelu bocznym.</p></div>`;
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutput(html).setTitle('GRAFIK PRO — szybkie działania'));
}

function gpConfigureWebAppUrl(){
  const ui=SpreadsheetApp.getUi();
  const response=ui.prompt(
    'Adres aplikacji GRAFIK PRO',
    'Wklej pełny adres nowego wdrożenia aplikacji internetowej. Musi zaczynać się od https://script.google.com/ i kończyć /exec.',
    ui.ButtonSet.OK_CANCEL
  );
  if(response.getSelectedButton()!==ui.Button.OK)return {ok:false,cancelled:true};
  const url=String(response.getResponseText()||'').trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(url)){
    ui.alert('Nieprawidłowy adres','Wklej adres wdrożenia zaczynający się od https://script.google.com/macros/s/ i zakończony /exec.',ui.ButtonSet.OK);
    return {ok:false,error:'INVALID_URL'};
  }
  const rows=gpRows_(GP.SHEETS.CENTRALS),row=rows.find(r=>r.KLUCZ==='WEB_APP_URL');
  if(row){
    gpSheet_(GP.SHEETS.CENTRALS).getRange(row._row,2).setValue(url);
    gpSheet_(GP.SHEETS.CENTRALS).getRange(row._row,4).setValue('GOTOWY');
  }else{
    gpAppend_(GP.SHEETS.CENTRALS,{KLUCZ:'WEB_APP_URL',WARTOŚĆ:url,OPIS:'Aktualny adres wdrożonej aplikacji zakończony /exec',STATUS:'GOTOWY'});
  }
  PropertiesService.getDocumentProperties().setProperty('GP_WEB_APP_URL',url);
  ui.alert('Adres zapisany','Teraz wybierz GRAFIK PRO → Otwórz aplikację NA PEŁNYM EKRANIE.',ui.ButtonSet.OK);
  return {ok:true,url};
}

function gpGetConfiguredWebAppUrl_(){
  const property=PropertiesService.getDocumentProperties().getProperty('GP_WEB_APP_URL');
  if(property)return property;
  try{
    const row=gpRows_(GP.SHEETS.CENTRALS).find(r=>r.KLUCZ==='WEB_APP_URL');
    return row&&String(row.WARTOŚĆ).trim()?String(row.WARTOŚĆ).trim():'';
  }catch(e){return '';}
}

function gpEscapeHtml_(value){
  return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function gpBootstrap(){
  const user=gpCurrentUser_(),month=gpMonth_(new Date());
  return {app:{name:GP.NAME,version:GP.VERSION},user,month,
    locations:gpRows_(GP.SHEETS.LOCATIONS),employees:gpRows_(GP.SHEETS.EMPLOYEES).map(e=>({ID:e.ID,name:e.IMIĘ_I_NAZWISKO})),
    scenarios:gpRows_(GP.SHEETS.SCENARIOS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    modes:gpRows_(GP.SHEETS.MODES).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    levels:gpRows_(GP.SHEETS.LEVELS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    plans:gpListPlans(month),health:gpHealthCheck()};
}
