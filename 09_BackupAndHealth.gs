function gpCreateBackup(description) {
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.ACCOUNTING,GP.ROLES.MANAGER]);
  const ss=gpSs_(),file=DriveApp.getFileById(ss.getId()),copy=file.makeCopy(`${ss.getName()} BACKUP ${gpNow_().replace(/:/g,'-')}`);
  const row={ID:gpId_('BKP'),UTWORZONO:gpNow_(),UTWORZYŁ:gpCurrentUser_().email,TYP:'PEŁNA_KOPIA',OPIS:description||'Kopia ręczna',PLIK_ID:copy.getId()};
  gpAppend_(GP.SHEETS.BACKUPS,row);gpAudit_('BACKUP','SYSTEM',row.ID,null,row);return {ok:true,backup:row,url:copy.getUrl()};
}

function gpHealthCheck() {
  const checks=[];
  Object.keys(GP_HEADERS).forEach(name=>{
    const sh=gpSs_().getSheetByName(name);
    checks.push({name:`Arkusz ${name}`,ok:!!sh,detail:sh?'OK':'BRAK'});
    if(sh){const headers=sh.getRange(1,1,1,GP_HEADERS[name].length).getValues()[0];checks.push({name:`Nagłówki ${name}`,ok:JSON.stringify(headers)===JSON.stringify(GP_HEADERS[name]),detail:'Kontrakt kolumn'});}
  });
  const version=PropertiesService.getDocumentProperties().getProperty('GP_VERSION');
  checks.push({name:'Wersja instalacji',ok:version===GP.VERSION,detail:version||'brak'});
  const employees=gpRows_(GP.SHEETS.EMPLOYEES),ids=employees.map(e=>e.ID);
  checks.push({name:'Unikalne ID pracowników',ok:new Set(ids).size===ids.length,detail:`${ids.length} rekordów`});
  const orphanContracts=gpRows_(GP.SHEETS.CONTRACTS).filter(c=>!ids.includes(c.PRACOWNIK_ID));
  checks.push({name:'Spójność zatrudnienia',ok:orphanContracts.length===0,detail:`Sieroty: ${orphanContracts.length}`});
  return {ok:checks.every(c=>c.ok),score:gpRound_(checks.filter(c=>c.ok).length/checks.length*100),checks};
}

function gpRunAllTests() {
  const results=[],run=(name,fn)=>{try{fn();results.push({CZAS:gpNow_(),TEST:name,STATUS:'PASS',SZCZEGÓŁY:'OK'});}catch(e){results.push({CZAS:gpNow_(),TEST:name,STATUS:'FAIL',SZCZEGÓŁY:e.message});}};
  run('Konfiguracja',()=>{if(!gpConfig_().APP_VERSION)throw new Error('Brak APP_VERSION');});
  run('Struktura',()=>{const h=gpHealthCheck();if(!h.ok)throw new Error(`Health ${h.score}%`);});
  run('Dane pracowników',()=>{if(gpRows_(GP.SHEETS.EMPLOYEES).length<1)throw new Error('Brak danych demo');});
  run('Typy zmian',()=>{['RANO','POPOŁUDNIE','STANDBY'].forEach(id=>{if(!gpRows_(GP.SHEETS.SHIFT_TYPES).some(s=>s.ID===id))throw new Error(`Brak ${id}`);});});
  run('Zapotrzebowanie',()=>{if(gpRows_(GP.SHEETS.DEMAND).length<100)throw new Error('Za mało rekordów');});
  run('Reguła lokalizacji',()=>{const ctx=gpBuildPlanningContext_(gpMonth_(new Date()),'ZRÓWNOWAŻONY',{}),emp=ctx.employees.find(e=>String(ctx.maps.contract[e.ID].DOZWOLONE_LOKALIZACJE).split(',').length===1);if(emp){const forbidden=ctx.maps.contract[emp.ID].DOZWOLONE_LOKALIZACJE==='LOC-CENTRUM'?'LOC-OGRODY':'LOC-CENTRUM';const slot=Object.assign({},ctx.demand[0],{LOKALIZACJA_ID:forbidden});if(gpCandidate_(emp,slot,ctx,Object.fromEntries(ctx.employees.map(e=>[e.ID,{hours:0,days:{},weekly:{},locations:{},last:null,cost:0}]))).eligible)throw new Error('Reguła nie działa');}});
  run('Ochrona kosztów',()=>{if(!gpSs_().getSheetByName(GP.SHEETS.COSTS).isSheetHidden())throw new Error('Arkusz kosztów widoczny');});
  run('Indeksy silnika',()=>{const ctx=gpBuildPlanningContext_(gpMonth_(new Date()),'ZRÓWNOWAŻONY',{});if(!ctx.availabilityIndex||!ctx.absenceIndex||!ctx.rules)throw new Error('Brak indeksów wydajności');});
  run('Test wydajności optymalizatora',()=>{const ctx=gpBuildPlanningContext_(gpMonth_(new Date()),'ZRÓWNOWAŻONY',{}),start=Date.now();gpOptimize_(ctx);const ms=Date.now()-start;if(ms>45000)throw new Error(`Optymalizacja trwała ${ms} ms`);});
  gpReplaceRows_(GP.SHEETS.TESTS,results);
  const passed=results.filter(r=>r.STATUS==='PASS').length;
  return {ok:passed===results.length,passed,total:results.length,results};
}
