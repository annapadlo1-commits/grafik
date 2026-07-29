function gpDashboardData(month, planId) {
  month=gpMonth_(month||new Date());
  const plans=gpListPlans(month);
  const selected=planId?plans.find(p=>p.ID===planId):(plans.find(p=>p.STATUS===GP.PLAN_STATUS.PUBLISHED)||plans[0]);
  if(!selected) return {month,plans:[],empty:true};
  const detail=gpGetPlan(selected.ID), employees=gpRows_(GP.SHEETS.EMPLOYEES), contracts=gpRows_(GP.SHEETS.CONTRACTS);
  const shiftMap=Object.fromEntries(gpRows_(GP.SHEETS.SHIFT_TYPES).map(s=>[s.ID,s]));
  const byEmployee={};
  detail.assignments.forEach(a=>{
    const start=a.OD?new Date(`2000-01-01T${a.OD}:00`):null,end=a.DO?new Date(`2000-01-${Number(a.DZIEŃ_PLUS||0)+1<10?'0':''}${Number(a.DZIEŃ_PLUS||0)+1}T${a.DO}:00`):null;
    const h=start&&end?(end-start)/3600000:Number((shiftMap[a.ZMIANA_ID]||{}).PŁATNE_H||0);
    byEmployee[a.PRACOWNIK_ID]=byEmployee[a.PRACOWNIK_ID]||{hours:0,shifts:0,cost:0,standby:0};
    byEmployee[a.PRACOWNIK_ID].hours+=h;byEmployee[a.PRACOWNIK_ID].shifts++;byEmployee[a.PRACOWNIK_ID].cost+=Number(a.KOSZT||0);
    if(a.STANDBY==='TAK')byEmployee[a.PRACOWNIK_ID].standby++;
  });
  const utilization=employees.map(e=>{
    const c=contracts.find(x=>x.PRACOWNIK_ID===e.ID)||{}, x=byEmployee[e.ID]||{hours:0,shifts:0,cost:0,standby:0}, target=Number(c.GODZINY_MIESIĘCZNE||0);
    return {id:e.ID,name:e.IMIĘ_I_NAZWISKO,hours:x.hours,target,utilization:target?gpRound_(x.hours/target*100):0,shifts:x.shifts,cost:gpRound_(x.cost),standby:x.standby};
  }).sort((a,b)=>b.utilization-a.utilization);
  const byDay={},byLocation={};
  detail.assignments.forEach(a=>{const d=gpDate_(a.DATA);byDay[d]=(byDay[d]||0)+1;byLocation[a.LOKALIZACJA_ID]=(byLocation[a.LOKALIZACJA_ID]||0)+Number(a.KOSZT||0);});
  return {month,plans,selected,validation:detail.validation,kpis:detail.kpis,utilization,
    daySeries:Object.keys(byDay).sort().map(date=>({date,value:byDay[date]})),
    locationCosts:Object.keys(byLocation).map(location=>({location,cost:gpRound_(byLocation[location])})),
    alerts:gpBuildAlerts_(detail,utilization)};
}

function gpBuildAlerts_(detail,utilization) {
  const alerts=[];
  detail.validation.errors.forEach(e=>alerts.push({level:'ERROR',title:'Błąd blokujący',text:e.type}));
  detail.validation.warnings.slice(0,20).forEach(w=>alerts.push({level:'WARNING',title:'Niedobór obsady',text:`${w.date} • ${w.location} • ${w.shift}: brakuje ${w.missing}`}));
  utilization.filter(x=>x.utilization>110).forEach(x=>alerts.push({level:'WARNING',title:'Przekroczenie nominału',text:`${x.name}: ${x.utilization}%`}));
  utilization.filter(x=>x.target&&x.utilization<70).forEach(x=>alerts.push({level:'INFO',title:'Niskie wykorzystanie',text:`${x.name}: ${x.utilization}%`}));
  return alerts;
}

function gpComparePlans(planIds) {
  return planIds.map(id=>{
    const p=gpGetPlan(id), k=Object.fromEntries(p.kpis.map(x=>[x.METRYKA,x.WARTOŚĆ]));
    return {id,name:p.plan.NAZWA,scenario:p.plan.SCENARIUSZ,mode:p.plan.TRYB,status:p.plan.STATUS,score:p.plan.WYNIK,cost:p.plan.KOSZT,coverage:k.coverage||0,fairness:k.fairness||0,violations:p.validation.errors.length,warnings:p.validation.warnings.length};
  });
}

function gpForecast(year) {
  year=Number(year||new Date().getFullYear());
  const rows=[],baseDemand=gpRows_(GP.SHEETS.DEMAND),events=gpRows_(GP.SHEETS.EVENTS);
  for(let m=1;m<=12;m++){
    const month=`${year}-${String(m).padStart(2,'0')}`,season=[6,7,8,12].includes(m)?1.18:[1,2].includes(m)?0.9:1;
    const historical=baseDemand.filter(d=>String(d.DATA).slice(5,7)===String(m).padStart(2,'0'));
    const base=historical.length?historical.reduce((s,d)=>s+Number(d.OPTYMALNIE_OSÓB||0),0):780;
    const eventBoost=events.filter(e=>String(e.OD).slice(5,7)===String(m).padStart(2,'0')).reduce((s,e)=>s+Number(e.DODATKOWE_OSOBY||0)*8,0);
    rows.push({month,demandHours:Math.round(base*8*season+eventBoost),seasonIndex:season,recommendedFte:gpRound_((base*8*season+eventBoost)/168)});
  }
  return rows;
}
