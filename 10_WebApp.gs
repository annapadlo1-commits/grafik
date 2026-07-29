function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(GP.NAME).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width, initial-scale=1, maximum-scale=1');
}

function gpInclude(filename){return HtmlService.createHtmlOutputFromFile(filename).getContent();}

function gpOpenSidebar(){
  SpreadsheetApp.getUi().showSidebar(HtmlService.createTemplateFromFile('Index').evaluate().setTitle(GP.NAME));
}

function gpBootstrap(){
  const user=gpCurrentUser_(),month=gpMonth_(new Date());
  return {app:{name:GP.NAME,version:GP.VERSION},user,month,
    locations:gpRows_(GP.SHEETS.LOCATIONS),employees:gpRows_(GP.SHEETS.EMPLOYEES).map(e=>({ID:e.ID,name:e.IMIĘ_I_NAZWISKO})),
    plans:gpListPlans(month),health:gpHealthCheck()};
}
