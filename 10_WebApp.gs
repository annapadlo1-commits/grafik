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
  const link=url?`<a href="${gpEscapeHtml_(url)}" target="_blank" style="display:block;text-align:center;background:#2563eb;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:bold">OTWÓRZ PEŁNĄ APLIKACJĘ</a>`:'<p style="color:#b91c1c"><b>Brak aktywnego adresu aplikacji.</b></p>';
  const html=`<style>body{font:13px Arial;color:#0f172a}button{width:100%;padding:10px;margin:4px 0;border:0;border-radius:7px;background:#e2e8f0;cursor:pointer;text-align:left}.primary{background:#2563eb;color:#fff;font-weight:bold}.danger{background:#fee2e2;color:#991b1b}.box{background:#f8fafc;padding:10px;border-radius:8px;margin:10px 0}.muted{color:#64748b;font-size:11px}</style>
  <div style="padding:12px"><h3>GRAFIK PRO — szybkie działania</h3>${link}
  <div class="box" id="status">Ładowanie statusu…</div>
  <button onclick="run('gpSyncCentrals')">↻ Synchronizuj trzy centrale</button>
  <button onclick="run('gpRefreshDashboard_')">◫ Odśwież panel arkusza</button>
  <button onclick="openApp('calendar')">＋ Event / wyjątek dnia</button>
  <button class="danger" onclick="openApp('calendar')">⚠ Awaryjnie dopisz pracownika</button>
  <button onclick="openApp('calendar')">⌕ Znajdź zastępstwo i braki</button>
  <button onclick="openApp('mobile')">✉ Wnioski, zamiany i powiadomienia</button>
  <button onclick="run('gpRunAllTests')">✓ Application Health / testy</button>
  <p id="msg" class="muted"></p></div>
  <script>
  const appUrl=${JSON.stringify(url)};
  function openApp(view){if(!appUrl)return msg('Najpierw ustaw adres aplikacji.');window.open(appUrl+(appUrl.indexOf('?')>0?'&':'?')+'view='+view,'_blank')}
  function msg(x){document.getElementById('msg').textContent=x}
  function run(name){msg('Przetwarzanie…');google.script.run.withSuccessHandler(x=>{msg('Gotowe');load()}).withFailureHandler(e=>msg(e.message||e))[name]()}
  function load(){google.script.run.withSuccessHandler(s=>{document.getElementById('status').innerHTML='<b>Status operacyjny</b><br>Pracownicy: '+s.dashboard.employees+' • przydziały: '+s.dashboard.assignments+' • braki: '+s.roleGaps+'<br>Powiadomienia: '+s.pendingNotifications+' • urlopy: '+s.pendingAbsences+' • zamiany: '+s.pendingSwaps+'<br>Health: '+s.health.score+'%<br><span class="muted">Synchronizacja: '+(s.lastSync||'jeszcze nie wykonano')+'</span>'}).gpQuickStatus()}load();
  </script>`;
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
    locations:gpRows_(GP.SHEETS.LOCATIONS),employees:gpRows_(GP.SHEETS.EMPLOYEES).map(e=>({ID:e.ID,name:e.IMIĘ_I_NAZWISKO,role:e.ROLA_GŁÓWNA,location:e.LOKALIZACJA_BAZOWA})),
    scenarios:gpRows_(GP.SHEETS.SCENARIOS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    modes:gpRows_(GP.SHEETS.MODES).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    levels:gpRows_(GP.SHEETS.LEVELS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE'),
    plans:gpListPlans(month),health:gpHealthCheck()};
}
