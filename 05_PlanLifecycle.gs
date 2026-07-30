function gpListPlans(month) {
  const expectedMonth=month?gpMonth_(month):'';
  const plans=gpRows_(GP.SHEETS.PLANS).filter(p=>!expectedMonth||gpMonth_(p.MIESIĄC)===expectedMonth);
  return plans.sort((a,b)=>String(b.UTWORZONO).localeCompare(String(a.UTWORZONO)));
}

function gpListPlansClient(month) {
  return JSON.stringify(gpListPlans(month));
}

function gpGetPlan(planId) {
  const plan=gpRows_(GP.SHEETS.PLANS).find(p=>p.ID===planId);
  if(!plan) throw new Error('Nie znaleziono planu.');
  const assignments=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId);
  return {plan,assignments,validation:gpValidatePlan_(planId),kpis:gpRows_(GP.SHEETS.KPI).filter(k=>k.PLAN_ID===planId)};
}

function gpChangePlanStatus(planId,status,note) {
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);
  return gpLock_(()=>{
    const plans=gpRows_(GP.SHEETS.PLANS), plan=plans.find(p=>p.ID===planId);
    if(!plan) throw new Error('Plan nie istnieje.');
    const before=Object.assign({},plan);
    if(status===GP.PLAN_STATUS.PUBLISHED){
      const validation=gpValidatePlan_(planId);
      if(validation.errors.length) throw new Error(`Nie można opublikować: ${validation.errors.length} błędów blokujących.`);
      if(String(gpConfig_().AUTO_BACKUP).toUpperCase()==='TAK') gpCreateBackup(`Przed publikacją ${planId}`);
      const planMonth=gpMonth_(plan.MIESIĄC);
      plans.filter(p=>gpMonth_(p.MIESIĄC)===planMonth&&p.ID!==planId&&p.STATUS===GP.PLAN_STATUS.PUBLISHED).forEach(p=>p.STATUS=GP.PLAN_STATUS.ARCHIVED);
    }
    plan.STATUS=status; plan.UWAGI=note||plan.UWAGI;
    gpReplaceRows_(GP.SHEETS.PLANS,plans);
    gpSaveVersion_(planId,`Zmiana statusu na ${status}`);
    gpAudit_('STATUS','PLAN',planId,before,plan);
    gpQueuePlanNotifications_(planId,status);
    return {ok:true,plan,validation:gpValidatePlan_(planId)};
  });
}

function gpClonePlan(planId,name,scenario) {
  const src=gpGetPlan(planId), newId=gpId_('PLAN');
  const copy=Object.assign({},src.plan,{ID:newId,NAZWA:name||`${src.plan.NAZWA} – kopia`,SCENARIUSZ:scenario||'WHAT-IF',STATUS:GP.PLAN_STATUS.DRAFT,UTWORZYŁ:gpCurrentUser_().email,UTWORZONO:gpNow_()});
  delete copy._row; gpAppend_(GP.SHEETS.PLANS,copy);
  const existing=gpRows_(GP.SHEETS.ASSIGNMENTS).map(a=>{const x=Object.assign({},a);delete x._row;return x;});
  const cloned=src.assignments.map(a=>{const x=Object.assign({},a,{ID:gpId_('ASG'),PLAN_ID:newId,ŹRÓDŁO:'KOPIA'});delete x._row;return x;});
  gpReplaceRows_(GP.SHEETS.ASSIGNMENTS,existing.concat(cloned));
  gpSaveVersion_(newId,`Kopia planu ${planId}`); gpAudit_('CLONE','PLAN',newId,null,{source:planId});
  return gpGetPlan(newId);
}

function gpSaveVersion_(planId,reason) {
  const assignments=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId).map(a=>{const x=Object.assign({},a);delete x._row;return x;});
  const existing=gpRows_(GP.SHEETS.VERSIONS).filter(v=>v.PLAN_ID===planId);
  const json=JSON.stringify(assignments);
  const compressed=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(json,'application/json')).getBytes());
  gpAppend_(GP.SHEETS.VERSIONS,{ID:gpId_('VER'),PLAN_ID:planId,WERSJA:existing.length+1,UTWORZYŁ:gpCurrentUser_().email,UTWORZONO:gpNow_(),POWÓD:reason,SNAPSHOT_JSON:`GZ:${compressed}`});
}

function gpRestoreVersion(versionId) {
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);
  const version=gpRows_(GP.SHEETS.VERSIONS).find(v=>v.ID===versionId);
  if(!version) throw new Error('Nie znaleziono wersji.');
  const all=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID!==version.PLAN_ID);
  const raw=String(version.SNAPSHOT_JSON||'');
  const json=raw.startsWith('GZ:')?Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(raw.slice(3)))).getDataAsString():raw;
  const restored=JSON.parse(json);
  gpReplaceRows_(GP.SHEETS.ASSIGNMENTS,all.concat(restored));
  gpSaveVersion_(version.PLAN_ID,`Przywrócono wersję ${version.WERSJA}`);
  gpAudit_('RESTORE','PLAN',version.PLAN_ID,null,{version:version.WERSJA});
  return gpGetPlan(version.PLAN_ID);
}

function gpValidatePlanLegacy_(planId) {
  const asg=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId&&a.STATUS!==GP.ASSIGNMENT_STATUS.CANCELLED);
  const ctx=gpBuildPlanningContext_(gpRows_(GP.SHEETS.PLANS).find(p=>p.ID===planId).MIESIĄC,'ZRÓWNOWAŻONY',{});
  const errors=[],warnings=[];
  const byEmployeeDate={};
  asg.forEach(a=>{
    const key=`${a.PRACOWNIK_ID}|${gpDate_(a.DATA)}`;
    byEmployeeDate[key]=(byEmployeeDate[key]||[]).concat(a);
    if(!ctx.maps.emp[a.PRACOWNIK_ID]) errors.push({type:'BRAK_PRACOWNIKA',assignment:a.ID});
    if(!ctx.maps.shift[a.ZMIANA_ID]) errors.push({type:'BRAK_TYPU_ZMIANY',assignment:a.ID});
    if(gpIsAbsent_(a.PRACOWNIK_ID,gpDate_(a.DATA),ctx.absences)) errors.push({type:'PRACA_W_NIEOBECNOŚĆ',assignment:a.ID});
  });
  Object.keys(byEmployeeDate).forEach(k=>{if(byEmployeeDate[k].filter(a=>a.STANDBY!=='TAK').length>1)errors.push({type:'DWIE_ZMIANY_JEDNEGO_DNIA',key:k});});
  const demand=ctx.demand,coverageIndex={};
  asg.forEach(a=>{
    const key=`${gpDate_(a.DATA)}|${a.LOKALIZACJA_ID}|${a.ZMIANA_ID}`;
    coverageIndex[key]=(coverageIndex[key]||0)+1;
  });
  demand.forEach(d=>{
    const count=coverageIndex[`${gpDate_(d.DATA)}|${d.LOKALIZACJA_ID}|${d.ZMIANA_ID}`]||0;
    if(count<Number(d.MIN_OSÓB||0)) warnings.push({type:'NIEDOBÓR',date:gpDate_(d.DATA),location:d.LOKALIZACJA_ID,shift:d.ZMIANA_ID,missing:Number(d.MIN_OSÓB)-count});
  });
  return {ok:errors.length===0,errors,warnings};
}

function gpWriteKpis_(planId,kpis) {
  const old=gpRows_(GP.SHEETS.KPI).filter(k=>k.PLAN_ID!==planId);
  const labels={coverage:'Pokrycie minimalnego zapotrzebowania',uncovered:'Nieobsadzone stanowiska',hardViolations:'Naruszenia twarde',cost:'Koszt planu',budget:'Budżet',budgetUse:'Wykorzystanie budżetu %',fairness:'Odchylenie sprawiedliwości',preferencePoints:'Punkty preferencji',assignments:'Liczba przydziałów'};
  const rows=Object.keys(kpis).map(key=>({PLAN_ID:planId,METRYKA:key,WARTOŚĆ:kpis[key],CEL:key==='coverage'?100:key==='hardViolations'?0:'',STATUS:(key==='hardViolations'&&kpis[key]>0)||(key==='coverage'&&kpis[key]<95)?'ALERT':'OK',OPIS:labels[key]||key}));
  gpReplaceRows_(GP.SHEETS.KPI,old.concat(rows));
}
