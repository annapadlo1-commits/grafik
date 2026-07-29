function gpMySchedule(month) {
  const user=gpCurrentUser_(), employeeId=user.employeeId;
  if(!employeeId&&user.role!==GP.ROLES.DEMO) throw new Error('Konto nie jest powiązane z pracownikiem.');
  const plans=gpListPlans(month).filter(p=>p.STATUS===GP.PLAN_STATUS.PUBLISHED);
  if(!plans.length) return [];
  const id=employeeId||'P001';
  return gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===plans[0].ID&&a.PRACOWNIK_ID===id).sort((a,b)=>gpDate_(a.DATA).localeCompare(gpDate_(b.DATA)));
}

function gpSubmitAvailability(payload) {
  const user=gpCurrentUser_(), employeeId=payload.employeeId||user.employeeId;
  if(!employeeId) throw new Error('Wybierz pracownika.');
  const row={PRACOWNIK_ID:employeeId,DATA:gpDate_(payload.date),OD:payload.from||'00:00',DO:payload.to||'23:59',STATUS:payload.status||'NIEDOSTĘPNY',PREFERENCJA:payload.preference||'',LOKALIZACJA_ID:payload.location||'',UWAGI:payload.note||''};
  gpAppend_(GP.SHEETS.AVAILABILITY,row);gpAudit_('CREATE','AVAILABILITY',employeeId,null,row);
  return {ok:true,row};
}

function gpRequestAbsence(payload) {
  const user=gpCurrentUser_(), employeeId=payload.employeeId||user.employeeId;
  const row={ID:gpId_('ABS'),PRACOWNIK_ID:employeeId,OD:gpDate_(payload.from),DO:gpDate_(payload.to),TYP:payload.type||'URLOP',STATUS:'OCZEKUJE',ŹRÓDŁO:'APLIKACJA',UWAGI:payload.note||''};
  gpAppend_(GP.SHEETS.ABSENCES,row);gpAudit_('CREATE','ABSENCE',row.ID,null,row);
  return {ok:true,row};
}

function gpRequestSwap(payload) {
  const assignment=gpRows_(GP.SHEETS.ASSIGNMENTS).find(a=>a.ID===payload.assignmentId);
  if(!assignment)throw new Error('Nie znaleziono zmiany.');
  const user=gpCurrentUser_();
  if(user.role===GP.ROLES.EMPLOYEE&&assignment.PRACOWNIK_ID!==user.employeeId)throw new Error('To nie jest Twoja zmiana.');
  const row={ID:gpId_('SWAP'),PRZYDZIAŁ_ID:assignment.ID,OD_PRACOWNIKA_ID:assignment.PRACOWNIK_ID,DO_PRACOWNIKA_ID:payload.toEmployeeId||'',STATUS:'OCZEKUJE',UTWORZONO:gpNow_(),ZATWIERDZIŁ:'',UWAGI:payload.note||''};
  gpAppend_(GP.SHEETS.SWAPS,row);gpAudit_('CREATE','SWAP',row.ID,null,row);
  return {ok:true,row};
}

function gpApproveSwap(swapId,approved) {
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);
  const swaps=gpRows_(GP.SHEETS.SWAPS),swap=swaps.find(s=>s.ID===swapId);
  if(!swap)throw new Error('Nie znaleziono zamiany.');
  swap.STATUS=approved?'ZATWIERDZONA':'ODRZUCONA';swap.ZATWIERDZIŁ=gpCurrentUser_().email;
  if(approved&&swap.DO_PRACOWNIKA_ID){
    const asg=gpRows_(GP.SHEETS.ASSIGNMENTS),a=asg.find(x=>x.ID===swap.PRZYDZIAŁ_ID);
    if(a)a.PRACOWNIK_ID=swap.DO_PRACOWNIKA_ID;
    gpReplaceRows_(GP.SHEETS.ASSIGNMENTS,asg);
  }
  gpReplaceRows_(GP.SHEETS.SWAPS,swaps);gpAudit_('APPROVE','SWAP',swapId,null,swap);
  return {ok:true,swap};
}
