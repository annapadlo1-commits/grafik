function gpGeneratePlanLegacy_(request) {
  gpRequireRole_([GP.ROLES.ADMIN, GP.ROLES.MANAGER]);
  const started=Date.now(),timings={};
  request = request || {};
  const month = gpMonth_(request.month || new Date());
  const mode = request.mode || 'ZRÓWNOWAŻONY';
  const scenario = request.scenario || 'BAZOWY';
  const planId = gpId_('PLAN');
  const data = gpBuildPlanningContext_(month, mode, request);
  timings.loadMs=Date.now()-started;
  gpPreflight_(data);
  const result = gpOptimize_(data);
  timings.optimizeMs=Date.now()-started-timings.loadMs;
  if(!result.assignments.length){
    const top=Object.entries(result.diagnostics.rejections).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>`${x[0]}: ${x[1]}`).join(', ');
    throw new Error(`Silnik nie utworzył żadnego przydziału. Najczęstsze blokady: ${top||'brak kandydatów'}. Sprawdź synchronizację, umowy, lokalizacje i zapotrzebowanie.`);
  }
  const plan = {
    ID:planId, NAZWA:request.name || `Plan ${month} • ${scenario}`, MIESIĄC:month,
    SCENARIUSZ:scenario, TRYB:mode, STATUS:GP.PLAN_STATUS.DRAFT,
    UTWORZYŁ:gpCurrentUser_().email, UTWORZONO:gpNow_(),
    WYNIK:result.score, KOSZT:result.cost, UWAGI:result.summary
  };
  gpAppend_(GP.SHEETS.PLANS, plan);
  const existingAssignments=gpRows_(GP.SHEETS.ASSIGNMENTS).map(a=>{const x=Object.assign({},a);delete x._row;return x;});
  const generated=result.assignments.map(a=>Object.assign({
    ID:gpId_('ASG'),PLAN_ID:planId,STATUS:GP.ASSIGNMENT_STATUS.PLANNED,ŹRÓDŁO:'SILNIK'
  },a));
  gpReplaceRows_(GP.SHEETS.ASSIGNMENTS,existingAssignments.concat(generated));
  timings.writeMs=Date.now()-started-timings.loadMs-timings.optimizeMs;
  gpSaveVersion_(planId, 'Plan wygenerowany automatycznie');
  gpWriteKpis_(planId, result.kpis);
  timings.finalizeMs=Date.now()-started-timings.loadMs-timings.optimizeMs-timings.writeMs;
  timings.totalMs=Date.now()-started;
  gpAudit_('GENERATE', 'PLAN', planId, null, {plan,kpis:result.kpis,timings});
  return {ok:true,plan,result,timings};
}

function gpBuildPlanningContext_(month, mode, request) {
  const employees = gpRows_(GP.SHEETS.EMPLOYEES).filter(r => String(r.AKTYWNY).toUpperCase() !== 'NIE');
  const contracts = gpRows_(GP.SHEETS.CONTRACTS);
  const shifts = gpRows_(GP.SHEETS.SHIFT_TYPES);
  const demand = gpRows_(GP.SHEETS.DEMAND).filter(r => gpMonth_(r.DATA) === month);
  const availability = gpRows_(GP.SHEETS.AVAILABILITY).filter(r => gpMonth_(r.DATA) === month);
  const absences = gpRows_(GP.SHEETS.ABSENCES);
  const events = gpRows_(GP.SHEETS.EVENTS);
  const budgets = gpRows_(GP.SHEETS.BUDGETS).filter(r => gpMonth_(r.MIESIĄC) === month);
  const scenarios=gpRows_(GP.SHEETS.SCENARIOS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE');
  const modes=gpRows_(GP.SHEETS.MODES).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE');
  const levels=gpRows_(GP.SHEETS.LEVELS).filter(r=>String(r.AKTYWNY).toUpperCase()!=='NIE');
  const rules=gpConfig_();
  const maps = {
    contract:Object.fromEntries(contracts.map(r => [r.PRACOWNIK_ID,r])),
    shift:Object.fromEntries(shifts.map(r => [r.ID,r])),
    emp:Object.fromEntries(employees.map(r => [r.ID,r]))
  };
  const availabilityIndex={};
  availability.forEach(a=>{
    const key=`${a.PRACOWNIK_ID}|${gpDate_(a.DATA)}`;
    (availabilityIndex[key]||(availabilityIndex[key]=[])).push(a);
  });
  const absenceIndex={};
  absences.forEach(a=>{
    if(String(a.STATUS).toUpperCase()==='ODRZUCONA')return;
    const from=new Date(`${gpDate_(a.OD)}T12:00:00`),to=new Date(`${gpDate_(a.DO)}T12:00:00`);
    for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1))absenceIndex[`${a.PRACOWNIK_ID}|${gpDate_(d)}`]=true;
  });
  const scenario=scenarios.find(r=>r.SCENARIUSZ_ID===(request.scenario||'BAZOWY'))||scenarios[0]||{SCENARIUSZ_ID:'BAZOWY',MNOŻNIK_ZAPOTRZEBOWANIA:1,MNOŻNIK_BUDŻETU:1};
  const level=levels.find(r=>r.POZIOM_ID===(request.coverage||scenario.DOMYŚLNY_POZIOM_OBSADY||'OPTIMAL'))||levels[0]||{POZIOM_ID:'OPTIMAL',ŹRÓDŁO_CELU:'OPT',MNOŻNIK:1,LIMIT_BUDŻETU_PROC:100};
  const modeProfile=modes.find(r=>r.TRYB_ID===mode)||modes[0]||null;
  return {month,mode,request,employees,demand,availability,absences,events,budgets,scenarios,modes,levels,scenario,level,modeProfile,maps,rules,availabilityIndex,absenceIndex};
}

function gpOptimize_(ctx) {
  const assignments = [], state = {},rejections={};
  ctx.employees.forEach(e => state[e.ID] = {hours:0, days:{}, weekly:{}, locations:{}, last:null, cost:0});
  const demand = ctx.demand.slice().sort((a,b) => {
    const date=gpDate_(a.DATA).localeCompare(gpDate_(b.DATA));
    if(date)return date;
    const startA=String((ctx.maps.shift[a.ZMIANA_ID]||{}).START||'00:00');
    const startB=String((ctx.maps.shift[b.ZMIANA_ID]||{}).START||'00:00');
    return startA.localeCompare(startB)||Number(b.PRIORYTET||1)-Number(a.PRIORYTET||1)||String(a.LOKALIZACJA_ID).localeCompare(String(b.LOKALIZACJA_ID));
  });
  let uncovered = 0,hardViolations = 0,preferencePoints = 0,costSoFar=0,totalMinimum=0,totalTarget=0;
  const baseBudget=ctx.budgets.reduce((s,b)=>s+Number(b.BUDŻET||0),0);
  const effectiveBudget=baseBudget*Number(ctx.scenario.MNOŻNIK_BUDŻETU||1)*Number(ctx.level.LIMIT_BUDŻETU_PROC||100)/100;
  demand.forEach(slot => {
    const adjusted = gpAdjustedDemand_(slot,ctx);
    const target = gpCoverageTarget_(adjusted,ctx.level);
    totalMinimum+=adjusted.min;totalTarget+=target;
    const evaluated=ctx.employees.map(emp=>gpCandidate_(emp,slot,ctx,state));
    evaluated.filter(c=>!c.eligible).forEach(c=>rejections[c.reason]=(rejections[c.reason]||0)+1);
    const candidates=evaluated.filter(c=>c.eligible).sort((a,b)=>b.score-a.score);
    const chosen=[];
    for(const c of candidates){
      if(chosen.length>=target)break;
      const shift=ctx.maps.shift[slot.ZMIANA_ID],candidateCost=gpShiftCost_(c.emp.ID,slot,Number(shift.PŁATNE_H||8),ctx);
      if(ctx.level.POZIOM_ID==='BUDGET'&&effectiveBudget>0&&costSoFar+candidateCost>effectiveBudget)continue;
      c.calculatedCost=candidateCost;chosen.push(c);costSoFar+=candidateCost;
    }
    chosen.forEach(c => {
      const shift = ctx.maps.shift[slot.ZMIANA_ID], hours = Number(shift.PŁATNE_H || 8);
      const cost = c.calculatedCost===undefined?gpShiftCost_(c.emp.ID,slot,hours,ctx):c.calculatedCost;
      assignments.push({DATA:gpDate_(slot.DATA), LOKALIZACJA_ID:slot.LOKALIZACJA_ID, ZMIANA_ID:slot.ZMIANA_ID, PRACOWNIK_ID:c.emp.ID, ROLA:String(c.emp.UMIEJĘTNOŚCI).includes('LIDER')?'LIDER':'PRACOWNIK', STANDBY:'NIE', KOSZT:cost, UWAGI:c.reason});
      gpUpdateState_(state[c.emp.ID], slot, shift, cost);
      preferencePoints += c.preference;
    });
    if (chosen.length < adjusted.min) uncovered += adjusted.min - chosen.length;
  });
  const standbySlots={};
  demand.forEach(slot=>{
    const key=`${gpDate_(slot.DATA)}|${slot.LOKALIZACJA_ID}`;
    standbySlots[key]=standbySlots[key]||{DATA:slot.DATA,LOKALIZACJA_ID:slot.LOKALIZACJA_ID,count:0};
    standbySlots[key].count=Math.max(standbySlots[key].count,Number(slot.STANDBY||0));
  });
  Object.values(standbySlots).forEach(slot=>{
    if(!slot.count)return;
    const standbySlot={DATA:slot.DATA,LOKALIZACJA_ID:slot.LOKALIZACJA_ID,ZMIANA_ID:'STANDBY'};
    const standbyCandidates=ctx.employees.map(emp=>gpStandbyCandidate_(emp,standbySlot,ctx,state)).filter(c=>c.eligible).sort((a,b)=>b.score-a.score).slice(0,slot.count);
    standbyCandidates.forEach(c => {
      const shift = ctx.maps.shift.STANDBY || {PŁATNE_H:2, START:'06:00', KONIEC:'22:00'};
      const cost = gpShiftCost_(c.emp.ID,standbySlot,Number(shift.PŁATNE_H),ctx);
      assignments.push({DATA:gpDate_(slot.DATA),LOKALIZACJA_ID:slot.LOKALIZACJA_ID,ZMIANA_ID:'STANDBY',PRACOWNIK_ID:c.emp.ID,ROLA:'STANDBY',STANDBY:'TAK',KOSZT:cost,UWAGI:'Rezerwa dzienna automatyczna'});
      gpUpdateState_(state[c.emp.ID],standbySlot,shift,cost);costSoFar+=cost;
    });
  });
  const cost = assignments.reduce((s,a)=>s+Number(a.KOSZT||0),0);
  const fairness = gpFairness_(state, ctx.maps.contract);
  const budget=effectiveBudget||baseBudget;
  const coverage=gpRound_(100*(1-uncovered/Math.max(1,totalMinimum)));
  const budgetScore=!budget?100:Math.max(0,Math.min(100,100-(Math.max(0,cost-budget)/budget*100)));
  const fairnessScore=Math.max(0,100-Math.min(100,fairness));
  const preferenceScore=Math.min(100,preferencePoints/Math.max(1,assignments.length)*5);
  const score=Math.round(Math.max(0,Math.min(100,coverage*.65+budgetScore*.15+fairnessScore*.15+preferenceScore*.05-hardViolations*20)));
  const kpis = {
    coverage,
    uncovered, hardViolations, cost:gpRound_(cost), budget, budgetUse:budget?gpRound_(cost/budget*100):0,
    fairness:gpRound_(fairness),preferencePoints,assignments:assignments.length,targetAssignments:totalTarget
  };
  return {assignments,cost:gpRound_(cost),score,kpis,diagnostics:{rejections,scenario:ctx.scenario.SCENARIUSZ_ID,mode:ctx.mode,level:ctx.level.POZIOM_ID},summary:`Pokrycie ${kpis.coverage}%, koszt ${kpis.cost} zł, nieobsadzone miejsca: ${uncovered}. Scenariusz ${ctx.scenario.SCENARIUSZ_ID}, tryb ${ctx.mode}, obsada ${ctx.level.POZIOM_ID}.`};
}

function gpStandbyCandidate_(emp,slot,ctx,state){
  const contract=ctx.maps.contract[emp.ID],shift=ctx.maps.shift.STANDBY||{PŁATNE_H:2};
  if(!contract)return {emp,eligible:false,score:-Infinity,preference:0,reason:'Brak umowy'};
  const date=gpDate_(slot.DATA),st=state[emp.ID],allowed=String(contract.DOZWOLONE_LOKALIZACJE||'').split(',').map(s=>s.trim());
  if(allowed.length&&!allowed.includes(slot.LOKALIZACJA_ID))return {emp,eligible:false,score:-Infinity,preference:0,reason:'Lokalizacja niedozwolona'};
  if(st.days[date])return {emp,eligible:false,score:-Infinity,preference:0,reason:'Inna zmiana tego dnia'};
  if(String(contract.DOSTĘPNY_STANDBY).toUpperCase()==='NIE')return {emp,eligible:false,score:-Infinity,preference:0,reason:'Brak zgody na stand-by'};
  if(ctx.absenceIndex[`${emp.ID}|${date}`])return {emp,eligible:false,score:-Infinity,preference:0,reason:'Nieobecność'};
  const av=ctx.availabilityIndex[`${emp.ID}|${date}`]||[];
  if(av.some(a=>String(a.STATUS).toUpperCase()==='NIEDOSTĘPNY'))return {emp,eligible:false,score:-Infinity,preference:0,reason:'Niedostępny'};
  const week=gpWeekKey_(date),maxWeek=Number(contract.MAX_H_TYDZIEŃ||48);
  if(Number(st.weekly[week]||0)+Number(shift.PŁATNE_H||2)>maxWeek)return {emp,eligible:false,score:-Infinity,preference:0,reason:'Limit tygodniowy'};
  const target=Number(contract.GODZINY_MIESIĘCZNE||168),ratio=st.hours/Math.max(1,target),homeBonus=emp.DOMYŚLNA_LOKALIZACJA===slot.LOKALIZACJA_ID?5:0;
  return {emp,eligible:true,score:(1-ratio)*100+homeBonus,preference:0,reason:'Rezerwa dzienna'};
}

function gpCandidate_(emp, slot, ctx, state) {
  const contract = ctx.maps.contract[emp.ID];
  const shift = ctx.maps.shift[slot.ZMIANA_ID];
  if (!contract || !shift) return {emp, eligible:false, score:-Infinity, preference:0, reason:'Brak umowy lub zmiany'};
  const date = gpDate_(slot.DATA), st = state[emp.ID];
  const allowed = String(contract.DOZWOLONE_LOKALIZACJE||'').split(',').map(s=>s.trim());
  if (allowed.length && !allowed.includes(slot.LOKALIZACJA_ID)) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Lokalizacja niedozwolona'};
  if (String(contract.TYLKO_RANO).toUpperCase()==='TAK' && slot.ZMIANA_ID!=='RANO') return {emp,eligible:false,score:-Infinity,preference:0,reason:'Tylko rano'};
  if (String(contract.TYLKO_POPOŁUDNIE).toUpperCase()==='TAK' && slot.ZMIANA_ID!=='POPOŁUDNIE') return {emp,eligible:false,score:-Infinity,preference:0,reason:'Tylko popołudnie'};
  const dateObj=new Date(`${date}T12:00:00`);
  if(String(contract.BEZ_WEEKENDÓW).toUpperCase()==='TAK'&&[0,6].includes(dateObj.getDay()))return {emp,eligible:false,score:-Infinity,preference:0,reason:'Bez weekendów'};
  if(slot.ZMIANA_ID==='STANDBY'&&String(contract.DOSTĘPNY_STANDBY).toUpperCase()==='NIE')return {emp,eligible:false,score:-Infinity,preference:0,reason:'Brak zgody na stand-by'};
  if(gpScenarioUnavailable_(emp.ID,ctx.scenario))return {emp,eligible:false,score:-Infinity,preference:0,reason:'Redukcja dostępności scenariusza'};
  if (st.days[date]) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Inna zmiana tego dnia'};
  if (ctx.absenceIndex[`${emp.ID}|${date}`]) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Nieobecność'};
  const av = ctx.availabilityIndex[`${emp.ID}|${date}`] || [];
  if (av.some(a=>String(a.STATUS).toUpperCase()==='NIEDOSTĘPNY')) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Niedostępny'};
  if (!gpHasRest_(st.last,date,shift,Number(contract.MIN_ODPOCZYNEK_H||ctx.rules.MIN_ODPOCZYNEK_H||11))) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Brak odpoczynku'};
  const overtime=String(ctx.scenario.NADGODZINY).toUpperCase()==='DOZWOLONE'?Number(ctx.scenario.MAX_NADGODZIN_H||0):0;
  const week = gpWeekKey_(date), maxWeek = Number(contract.MAX_H_TYDZIEŃ||48)+overtime;
  if (Number(st.weekly[week]||0)+Number(shift.PŁATNE_H||8)>maxWeek) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Limit tygodniowy'};
  if (gpConsecutive_(st.days,date)>=Number(contract.MAX_DNI_Z_RZĘDU||6)) return {emp,eligible:false,score:-Infinity,preference:0,reason:'Limit dni z rzędu'};
  const target = Number(contract.GODZINY_MIESIĘCZNE||168);
  const preference = av.some(a=>String(a.PREFERENCJA).toUpperCase()==='WYSOKA' && (!a.LOKALIZACJA_ID || a.LOKALIZACJA_ID===slot.LOKALIZACJA_ID)) ? 20 : 0;
  const homeBonus = emp.DOMYŚLNA_LOKALIZACJA===slot.LOKALIZACJA_ID ? 5 : 0;
  const ratio = st.hours/Math.max(1,target);
  const cost = Number(contract.KOSZT_PRACODAWCY_H||contract.STAWKA_GODZINOWA||0);
  const weights = gpModeWeights_(ctx.mode,ctx.modeProfile);
  const score=(1-ratio)*100*(weights.fairness+weights.coverage*.25)+preference*weights.preference+homeBonus*weights.continuity-cost*weights.cost*.08;
  return {emp,eligible:true,score,preference,reason:preference?'Preferencja uwzględniona':'Optymalny przydział'};
}

function gpModeWeights_(mode,profile) {
  if(profile){
    return {cost:Number(profile.WAGA_KOSZT_PROC||0)/100,preference:Number(profile.WAGA_PREFERENCJE_PROC||0)/100,fairness:Number(profile.WAGA_SPRAWIEDLIWOŚĆ_PROC||0)/100,coverage:Number(profile.WAGA_POKRYCIE_PROC||0)/100,continuity:Number(profile.WAGA_CIĄGŁOŚĆ_PROC||0)/100};
  }
  const modes = {
    MINIMALNY_KOSZT:{cost:.5,fairness:.1,preference:.05,coverage:.3,continuity:.05},
    PREFERENCJE:{cost:.1,fairness:.15,preference:.45,coverage:.25,continuity:.05},
    RÓWNY_PODZIAŁ:{cost:.1,fairness:.45,preference:.1,coverage:.3,continuity:.05},
    MAKSYMALNE_POKRYCIE:{cost:.05,fairness:.1,preference:.05,coverage:.75,continuity:.05},
    ZRÓWNOWAŻONY:{cost:.2,fairness:.25,preference:.2,coverage:.3,continuity:.05}
  };
  return modes[mode] || modes.ZRÓWNOWAŻONY;
}

function gpAdjustedDemand_(slot,ctx) {
  let min=Number(slot.MIN_OSÓB||0),optimal=Number(slot.OPTYMALNIE_OSÓB||min),max=Number(slot.MAX_OSÓB||optimal);
  ctx.events.forEach(e=>{
    const date=gpDate_(slot.DATA);
    if ((!e.LOKALIZACJA_ID||e.LOKALIZACJA_ID===slot.LOKALIZACJA_ID) && date>=gpDate_(e.OD) && date<=gpDate_(e.DO)) {
      const multiplier=Number(e.MNOŻNIK_ZAPOTRZEBOWANIA||1), extra=Number(e.DODATKOWE_OSOBY||0);
      min=Math.ceil(min*multiplier)+extra;optimal=Math.ceil(optimal*multiplier)+extra;max=Math.ceil(max*multiplier)+extra;
    }
  });
  const scenarioMultiplier=Number(ctx.scenario.MNOŻNIK_ZAPOTRZEBOWANIA||1);
  return {min:Math.ceil(min*scenarioMultiplier),optimal:Math.ceil(optimal*scenarioMultiplier),max:Math.ceil(max*scenarioMultiplier)};
}

function gpCoverageTarget_(adjusted,level){
  const source=String(level.ŹRÓDŁO_CELU||'OPT').toUpperCase();
  const base=source==='MIN'?adjusted.min:source==='MAX'?adjusted.max:adjusted.optimal;
  return Math.max(adjusted.min,Math.ceil(base*Number(level.MNOŻNIK||1)));
}

function gpScenarioUnavailable_(employeeId,scenario){
  const reduction=Number(scenario.REDUKCJA_DOSTĘPNOŚCI_PROC||0);
  if(reduction<=0)return false;
  const hash=String(employeeId).split('').reduce((s,c)=>s+c.charCodeAt(0),0)%100;
  return hash<reduction;
}

function gpPreflight_(ctx){
  const errors=[];
  if(!ctx.employees.length)errors.push('brak aktywnych pracowników');
  if(!ctx.demand.length)errors.push(`brak zapotrzebowania dla ${ctx.month}`);
  if(!Object.keys(ctx.maps.contract).length)errors.push('brak umów');
  if(!Object.keys(ctx.maps.shift).length)errors.push('brak typów zmian');
  const withoutContracts=ctx.employees.filter(e=>!ctx.maps.contract[e.ID]).length;
  if(withoutContracts===ctx.employees.length&&ctx.employees.length)errors.push('żaden pracownik nie ma umowy');
  if(!ctx.scenario)errors.push('brak profilu scenariusza');
  if(!ctx.level)errors.push('brak poziomu obsady');
  if(errors.length)throw new Error(`Nie można wygenerować grafiku: ${errors.join(', ')}. Uruchom instalator danych DEMO lub synchronizację central.`);
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
