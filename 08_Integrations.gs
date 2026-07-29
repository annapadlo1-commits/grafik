function gpImportKadromierz(rows) {
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);
  const employees=gpRows_(GP.SHEETS.EMPLOYEES), normalized=[];
  (rows||[]).forEach((r,i)=>{
    const employee=employees.find(e=>String(e.EMAIL).toLowerCase()===String(r.email||r.EMAIL||'').toLowerCase()||String(e.IMIĘ_I_NAZWISKO).toLowerCase()===String(r.employee||r.PRACOWNIK||'').toLowerCase());
    const item={STATUS:employee?'GOTOWY':'BŁĄD',TYP:r.type||r.TYP||'URLOP',WIERSZ_ŹRÓDŁOWY:i+2,PRACOWNIK:r.employee||r.PRACOWNIK||r.email||'',OD:r.from||r.OD||'',DO:r.to||r.DO||'',UWAGI:employee?'Dopasowano':'Nie znaleziono pracownika'};
    normalized.push(item);
    if(employee)gpAppend_(GP.SHEETS.ABSENCES,{ID:gpId_('ABS'),PRACOWNIK_ID:employee.ID,OD:gpDate_(item.OD),DO:gpDate_(item.DO),TYP:item.TYP,STATUS:'ZATWIERDZONA',ŹRÓDŁO:'KADROMIERZ',UWAGI:''});
  });
  gpReplaceRows_(GP.SHEETS.IMPORT,normalized);gpAudit_('IMPORT','KADROMIERZ','',null,{rows:normalized.length,errors:normalized.filter(x=>x.STATUS==='BŁĄD').length});
  return {ok:true,rows:normalized,errors:normalized.filter(x=>x.STATUS==='BŁĄD')};
}

function gpExportKadromierz(planId) {
  const detail=gpGetPlan(planId),employees=Object.fromEntries(gpRows_(GP.SHEETS.EMPLOYEES).map(e=>[e.ID,e])),locations=Object.fromEntries(gpRows_(GP.SHEETS.LOCATIONS).map(l=>[l.ID,l])),shifts=Object.fromEntries(gpRows_(GP.SHEETS.SHIFT_TYPES).map(s=>[s.ID,s]));
  const rows=detail.assignments.filter(a=>a.STATUS!==GP.ASSIGNMENT_STATUS.CANCELLED).map(a=>({PRACOWNIK:(employees[a.PRACOWNIK_ID]||{}).EMAIL||a.PRACOWNIK_ID,DATA:gpDate_(a.DATA),OD:(shifts[a.ZMIANA_ID]||{}).START||'',DO:(shifts[a.ZMIANA_ID]||{}).KONIEC||'',LOKALIZACJA:(locations[a.LOKALIZACJA_ID]||{}).NAZWA||a.LOKALIZACJA_ID,TYP_ZMIANY:a.ZMIANA_ID,UWAGI:a.STANDBY==='TAK'?'STANDBY':''}));
  gpReplaceRows_(GP.SHEETS.EXPORT,rows);
  const csv=[GP_HEADERS[GP.SHEETS.EXPORT].join(';')].concat(rows.map(r=>GP_HEADERS[GP.SHEETS.EXPORT].map(h=>`"${String(r[h]||'').replace(/"/g,'""')}"`).join(';'))).join('\r\n');
  const blob=Utilities.newBlob('\uFEFF'+csv,'text/csv',`GRAFIK_PRO_${detail.plan.MIESIĄC}_${planId}.csv`);
  const file=DriveApp.createFile(blob);gpAudit_('EXPORT','KADROMIERZ',planId,null,{rows:rows.length,fileId:file.getId()});
  return {ok:true,fileId:file.getId(),url:file.getUrl(),rows:rows.length};
}

function gpQueuePlanNotifications_(planId,status) {
  const plan=gpGetPlan(planId),employees=Object.fromEntries(gpRows_(GP.SHEETS.EMPLOYEES).map(e=>[e.ID,e]));
  const ids=[...new Set(plan.assignments.map(a=>a.PRACOWNIK_ID))];
  ids.forEach(id=>gpAppend_(GP.SHEETS.NOTIFICATIONS,{ID:gpId_('NOT'),ODBIORCA:(employees[id]||{}).EMAIL||id,TYP:'PLAN',TYTUŁ:`Grafik ${plan.plan.MIESIĄC}: ${status}`,TREŚĆ:`Plan „${plan.plan.NAZWA}” ma status ${status}.`,STATUS:'OCZEKUJE',UTWORZONO:gpNow_(),WYSŁANO:''}));
}

function gpSendQueuedNotifications() {
  if(String(gpConfig_().EMAIL_POWIADOMIENIA).toUpperCase()!=='TAK')return {ok:true,skipped:true,message:'Wysyłka e-mail jest wyłączona w DEMO.'};
  const rows=gpRows_(GP.SHEETS.NOTIFICATIONS);let sent=0;
  rows.filter(n=>n.STATUS==='OCZEKUJE').slice(0,50).forEach(n=>{MailApp.sendEmail(n.ODBIORCA,n.TYTUŁ,n.TREŚĆ);n.STATUS='WYSŁANO';n.WYSŁANO=gpNow_();sent++;});
  gpReplaceRows_(GP.SHEETS.NOTIFICATIONS,rows);return {ok:true,sent};
}
