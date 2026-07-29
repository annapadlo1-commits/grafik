function gpGeneratePlan(request) {
  gpRequireRole_([GP.ROLES.ADMIN, GP.ROLES.MANAGER]);
  request = request || {};
  const month = gpMonth_(request.month || new Date());
  const mode = request.mode || 'ZRÓWNOWAŻONY';
  const scenario = request.scenario || 'BAZOWY';
  const planId = gpId_('PLAN');
  const data = gpBuildPlanningContext_(month, mode, request);
  const result = gpOptimize_(data);
  const plan = {
    ID:planId, NAZWA:request.name || `Plan ${month} • ${scenario}`, MIESIĄC:month,
    SCENARIUSZ:scenario, TRYB:mode, STATUS:GP.PLAN_STATUS.DRAFT,
    UTWORZYŁ:gpCurrentUser_().email, UTWORZONO:gpNow_(),
    WYNIK:result.score, KOSZT:result.cost, UWAGI:result.summary
  };
  gpAppend_(GP.SHEETS.PLANS, plan);
  result.assignments.forEach(a => gpAppend_(GP.SHEETS.ASSIGNMENTS, Object.assign({
    ID:gpId_('ASG'), PLAN_ID:planId, STATUS:GP.ASSIGNMENT_STATUS.PLANNED, ŹRÓDŁO:'SILNIK'
  }, a)));
  gpSaveVersion_(planId, 'Plan wygenerowany automatycznie');
  gpWriteKpis_(planId, result.kpis);
  gpAudit_('GENERATE', 'PLAN', planId, null, {plan, kpis:result.kpis});
  return {ok:true, plan, result};
}

function gpBuildPlanningContext_(month, mode, request) {
  const employees = gpRows_(GP.SHEETS.EMPLOYEES).filter(r => String(r.AKTYWNY).toUpperCase() !== 'NIE');
  const contracts = gpRows_(GP.SHEETS.CONTRACTS);
  const shifts = gpRows_(GP.SHEETS.SHIFT_TYPES);
  const demand = gpRows_(GP.SHEETS.DEMAND).filter(r => gpMonth_(r.DATA) === month);
  const availability = gpRows_(GP.SHEETS.AVAILABILITY).filter(r => gpMonth_(r.DATA) === month);
  const absences = gpRows_(GP.SHEETS.ABSENCES);
  const events = gpRows_(GP.SHEETS.EVENTS);
  const budgets = gpRows_(GP.SHEETS.BUDGETS).filter(r => String(r.MIESIĄC).slice(0,7) === month);
  const maps = {
    contract:Object.fromEntries(contracts.map(r => [r.PRACOWNIK_ID,r])),
    shift:Object.fromEntries(shifts.map(r => [r.ID,r])),
    emp:Object.fromEntries(employees.map(r => [r.ID,r]))
  };
  return {month, mode, request, employees, demand, availability, absences, events, budgets, maps};
}

function gpOptimize_(ctx) {
  const assignments = [], state = {};
  ctx.employees.forEach(e => state[e.ID] = {hours:0, days:{}, weekly:{}, locations:{}, last:null, cost:0});
  const demand = ctx.demand.slice().sort((a,b) => Number(b.PRIORYTET||1)-Number(a.PRIORYTET||1) || String(a.DATA).localeCompare(String(b.DATA)));
  let uncovered = 0, hardViolations = 0, preferencePoints = 0;
  demand.forEach(slot => {
    const adjusted = gpAdjustedDemand_(slot, ctx.events);
    const target = ctx.request.coverage === 'MINIMUM' ? adjusted.min : adjusted.optimal;
    const candidates = ctx.employees.map(emp => gpCandidate_(emp, slot, ctx, state))
      .filter(c => c.eligible).sort((a,b) => b.score-a.score);
    const chosen = candidates.slice(0, target);
    chosen.forEach(c => {
      const shift = ctx.maps.shift[slot.ZMIANA_ID], hours = Number(shift.PŁATNE_H || 8);
      const cost = gpShiftCost_(c.emp.ID, slot, hours, ctx);
      assignments.push({DATA:gpDate_(slot.DATA), LOKALIZACJA_ID:slot.LOKALIZACJA_ID, ZMIANA_ID:slot.ZMIANA_ID, PRACOWNIK_ID:c.emp.ID, ROLA:String(c.emp.UMIEJĘTNOŚCI).includes('LIDER')?'LIDER':'PRACOWNIK', STANDBY:'NIE', KOSZT:cost, UWAGI:c.reason});
      gpUpdateState_(state[c.emp.ID], slot, shift, cost);
      preferencePoints += c.preference;
    });
    if (chosen.length < adjusted.min) uncovered += adjusted.min - chosen.length;
    const standbyCount = Number(slot.STANDBY || 0);
    const standbyCandidates = candidates.slice(target).filter(c => !state[c.emp.ID].days[gpDate_(slot.DATA)]).slice(0, standbyCount);
    standbyCandidates.forEach(c => {
      const shift = ctx.maps.shift.STANDBY || {PŁATNE_H:2, START:'06:00', KONIEC:'22:00'};
      const cost = gpShiftCost_(c.emp.ID, slot, Number(shift.PŁATNE_H), ctx);
      assignments.push({DATA:gpDate_(slot.DATA), LOKALIZACJA_ID:slot.LOKALIZACJA_ID, ZMIANA_ID:'STANDBY', PRACOWNIK_ID:c.emp.ID, ROLA:'STANDBY', STANDBY:'TAK', KOSZT:cost, UWAGI:'Rezerwa automatyczna'});
      gpUpdateState_(state[c.emp.ID], slot, shift, cost);
    });
  });
  const cost = assignments.reduce((s,a)=>s+Number(a.KOSZT||0),0);
  const fairness = gpFairness_(state, ctx.maps.contract);
  const budget = ctx.budgets.reduce((s,b)=>s+Number(b.BUDŻET||0),0);
  const score = Math.max(0, Math.round(1000 - uncovered*100 - hardViolations*500 - fairness*8 - Math.max(0,cost-budget)/100 + preferencePoints/10));
  const kpis = {
    coverage: gpRound_(100 * (1 - uncovered / Math.max(1, demand.reduce((s,d)=>s+Number(d.MIN_OSÓB||0),0)))),
    uncovered, hardViolations, cost:gpRound_(cost), budget, budgetUse:budget?gpRound_(cost/budget*100):0,
    fairness:gpRound_(fairness), preferencePoints, assignments:assignments.length
  };
  return {assignments, cost:gpRound_(cost), score, kpis, summary:`Pokrycie ${kpis.coverage}%, koszt ${kpis.cost} zł, nieobsadzone miejsca: ${uncovered}.`};
}

function gpCandidate_(emp, slot, ctx, state) {
  const contract = ctx.maps.contract[emp.ID];
  const shift = ctx.maps.shift[slot.ZMIANA_ID];
  if (!contract || !shift) return {emp, eligible:false, score:-Infinity, preference:0, reason:'Brak umowy lub zmiany'};
  const date = gpDate_(slot.DATA), st = state[emp.ID];
  const allowed = String(contract.DOZWOLONE_LOKALIZACJE||'').split(',').map(s=>s.trim());
  if (allowed.length && !allowed.includes(slot.LOKALIZACJA_ID)) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Lokalizacja niedozwolona'};
  if (String(contract.TYLKO_RANO).toUpperCase()==='TAK' && slot.ZMIANA_ID!=='RANO') return {emp,eligible:false,score:-Infinity,preference:0,reason:'Tylko rano'};
  if (st.days[date]) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Inna zmiana tego dnia'};
  if (gpIsAbsent_(emp.ID,date,ctx.absences)) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Nieobecność'};
  const av = ctx.availability.filter(a=>a.PRACOWNIK_ID===emp.ID && gpDate_(a.DATA)===date);
  if (av.some(a=>String(a.STATUS).toUpperCase()==='NIEDOSTĘPNY')) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Niedostępny'};
  if (!gpHasRest_(st.last, date, shift, Number(gpConfig_().MIN_ODPOCZYNEK_H||11))) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Brak odpoczynku'};
  const week = gpWeekKey_(date), maxWeek = Number(contract.MAX_H_TYDZIEŃ||48);
  if (Number(st.weekly[week]||0)+Number(shift.PŁATNE_H||8)>maxWeek) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Limit tygodniowy'};
  if (gpConsecutive_(st.days,date)>=Number(contract.MAX_DNI_Z_RZĘDU||6)) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Limit dni z rzędu'};
  const target = Number(contract.GODZINY_MIESIĘCZNE||168);
  const preference = av.some(a=>String(a.PREFERENCJA).toUpperCase()==='WYSOKA' && (!a.LOKALIZACJA_ID || a.LOKALIZACJA_ID===slot.LOKALIZACJA_ID)) ? 20 : 0;
  const homeBonus = emp.DOMYŚLNA_LOKALIZACJA===slot.LOKALIZACJA_ID ? 5 : 0;
  const ratio = st.hours/Math.max(1,target);
  const cost = Number(contract.KOSZT_PRACODAWCY_H||contract.STAWKA_GODZINOWA||0);
  const weights = gpModeWeights_(ctx.mode);
  const score = (1-ratio)*100*weights.fairness + preference*weights.preference + homeBonus - cost*weights.cost + Math.random()/100;
  return {emp,eligible:true,score,preference,reason:preference?'Preferencja uwzględniona':'Optymalny przydział'};
}

function gpModeWeights_(mode) {
  const modes = {
    MINIMALNY_KOSZT:{cost:2.2,fairness:0.7,preference:0.5},
    PREFERENCJE:{cost:0.5,fairness:0.9,preference:2.2},
    RÓWNY_PODZIAŁ:{cost:0.4,fairness:2.3,preference:0.8},
    MAKSYMALNE_POKRYCIE:{cost:0.1,fairness:1.0,preference:1.0},
    ZRÓWNOWAŻONY:{cost:1.0,fairness:1.3,preference:1.2}
  };
  return modes[mode] || modes.ZRÓWNOWAŻONY;
}

function gpAdjustedDemand_(slot, events) {
  let min=Number(slot.MIN_OSÓB||0), optimal=Number(slot.OPTYMALNIE_OSÓB||min);
  events.forEach(e=>{
    const date=gpDate_(slot.DATA);
    if ((!e.LOKALIZACJA_ID||e.LOKALIZACJA_ID===slot.LOKALIZACJA_ID) && date>=gpDate_(e.OD) && date<=gpDate_(e.DO)) {
      const multiplier=Number(e.MNOŻNIK_ZAPOTRZEBOWANIA||1), extra=Number(e.DODATKOWE_OSOBY||0);
      min=Math.ceil(min*multiplier)+extra; optimal=Math.ceil(optimal*multiplier)+extra;
    }
  });
  return {min,optimal};
}

function gpShiftCost_(employeeId, slot, hours, ctx) {
  const c=ctx.maps.contract[employeeId], date=new Date(`${gpDate_(slot.DATA)}T12:00:00`);
  let rate=Number(c.KOSZT_PRACODAWCY_H||c.STAWKA_GODZINOWA||0);
  if ([0,6].includes(date.getDay())) rate*=1.25;
  if (slot.ZMIANA_ID==='POPOŁUDNIE') rate*=1.08;
  return gpRound_(rate*hours);
}

function gpUpdateState_(st, slot, shift, cost) {
  const date=gpDate_(slot.DATA), week=gpWeekKey_(date), hours=Number(shift.PŁATNE_H||0);
  st.hours+=hours; st.days[date]=true; st.weekly[week]=(st.weekly[week]||0)+hours;
  st.locations[slot.LOKALIZACJA_ID]=(st.locations[slot.LOKALIZACJA_ID]||0)+1;
  st.last={date,end:shift.KONIEC}; st.cost+=cost;
}

function gpIsAbsent_(employeeId,date,absences) {
  return absences.some(a=>a.PRACOWNIK_ID===employeeId && String(a.STATUS).toUpperCase()!=='ODRZUCONA' && date>=gpDate_(a.OD) && date<=gpDate_(a.DO));
}

function gpHasRest_(last,date,shift,minHours) {
  if (!last) return true;
  const prev=new Date(`${last.date}T${last.end||'22:00'}:00`), next=new Date(`${date}T${shift.START||'06:00'}:00`);
  return (next-prev)/3600000>=minHours;
}

function gpConsecutive_(days,date) {
  let n=0,d=new Date(`${date}T12:00:00`);
  for(let i=1;i<=14;i++){d.setDate(d.getDate()-1);if(days[gpDate_(d)])n++;else break;}
  return n;
}

function gpWeekKey_(date) {
  const d=new Date(`${date}T12:00:00`), onejan=new Date(d.getFullYear(),0,1);
  return `${d.getFullYear()}-${Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7)}`;
}

function gpFairness_(state,contracts) {
  const ratios=Object.keys(state).map(id=>state[id].hours/Math.max(1,Number((contracts[id]||{}).GODZINY_MIESIĘCZNE||168)));
  const avg=ratios.reduce((a,b)=>a+b,0)/Math.max(1,ratios.length);
  return Math.sqrt(ratios.reduce((s,x)=>s+(x-avg)*(x-avg),0)/Math.max(1,ratios.length))*100;
}

function gpRound_(n){return Math.round(Number(n||0)*100)/100;}
