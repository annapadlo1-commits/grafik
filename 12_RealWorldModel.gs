/**
 * GRAFIK PRO 2.3 — rzeczywisty model dwóch lokali.
 * Ten moduł jest źródłem prawdy dla danych DEMO, popytu rolowego,
 * wymaganych funkcji, wyjątków kalendarza i grafików rolowych.
 */

function gpInstallRealWorldModel_(){
  gpReplaceRows_(GP.SHEETS.EXTRA_FUNCTIONS,[
    {KOD:'HOST',NAZWA:'Host',ROLA_WYMAGANA:'KELNER',LOKALIZACJA:'KRUCZA',TYP_PRZYDZIAŁU:'ZMIANA',AKTYWNA:'TAK',OPIS:'Rola krążąca; osoba nie jest równocześnie liczona jako kelner'},
    {KOD:'ZAMKNIĘCIE_BARU',NAZWA:'Zamyka bar',ROLA_WYMAGANA:'BARMAN',LOKALIZACJA:'WSZYSTKIE',TYP_PRZYDZIAŁU:'WYMÓG_ZMIANY',AKTYWNA:'TAK',OPIS:'Co najmniej jedna przeszkolona osoba na każdej zmianie wieczornej'},
    {KOD:'ZAMKNIĘCIE_SALI',NAZWA:'Zamyka salę',ROLA_WYMAGANA:'KELNER',LOKALIZACJA:'KRUCZA',TYP_PRZYDZIAŁU:'WYMÓG_ZMIANY',AKTYWNA:'TAK',OPIS:'Konfigurowalny wymóg dla wieczornej zmiany kelnerów'},
    {KOD:'MENADŻER_ZESPOŁU',NAZWA:'Menadżer zespołu',ROLA_WYMAGANA:'DOWOLNA',LOKALIZACJA:'WG_MATRYCY',TYP_PRZYDZIAŁU:'UPRAWNIENIE',AKTYWNA:'TAK',OPIS:'Nadzór i zatwierdzanie grafiku roli'},
    {KOD:'EVENT_ROTACYJNY',NAZWA:'Pracownik rotacyjny eventu',ROLA_WYMAGANA:'BARMAN',LOKALIZACJA:'KRUCZA,PAWILONY',TYP_PRZYDZIAŁU:'SEGMENT',AKTYWNA:'TAK',OPIS:'Może pracować w segmentach w obu lokalach z buforem przejazdu'}
  ]);
  gpReplaceRows_(GP.SHEETS.SHIFT_DEFINITIONS,gpRealShiftDefinitions_());
  gpReplaceRows_(GP.SHEETS.STAFFING_MATRIX,gpRealStaffingMatrix_());
  gpSeedRealRules_();
  gpApplyRealValidations_();
}

function gpSeedRealRules_(){
  const current=gpRows_(GP.SHEETS.CONFIG).map(gpCleanRow_);
  const values={
    APP_VERSION:GP.VERSION,
    BUFOR_PRZEJAZDU_MIN:30,
    BLOKUJ_BRAK_ZAMYKAJĄCEGO:'TAK',
    EMAIL_POWIADOMIENIA:'NIE',
    GENERUJ_GRAFIKI_ROLOWE:'TAK',
    HOST_ODDZIELNY_OD_KELNERA:'TAK'
  };
  const byKey=Object.fromEntries(current.map((r,i)=>[r.KLUCZ,i]));
  Object.keys(values).forEach(key=>{
    const row={KLUCZ:key,WARTOŚĆ:values[key],OPIS:gpRuleDescription_(key),EDYTOWALNE:key==='APP_VERSION'?'NIE':'TAK'};
    if(byKey[key]===undefined)current.push(row);else current[byKey[key]]=Object.assign(current[byKey[key]],row);
  });
  gpReplaceRows_(GP.SHEETS.CONFIG,current);
}

function gpRuleDescription_(key){
  return {
    APP_VERSION:'Wersja aplikacji',
    BUFOR_PRZEJAZDU_MIN:'Minimalny bufor między lokalizacjami',
    BLOKUJ_BRAK_ZAMYKAJĄCEGO:'Blokuje publikację bez wymaganej funkcji',
    EMAIL_POWIADOMIENIA:'Wysyłka e-mail po potwierdzeniu',
    GENERUJ_GRAFIKI_ROLOWE:'Tworzy podplany rolowe',
    HOST_ODDZIELNY_OD_KELNERA:'HOST nie jest równocześnie liczony jako kelner'
  }[key]||key;
}

function gpRealShiftDefinitions_(){
  const rows=[];
  const add=(loc,group,days,id,name,start,end,plus)=>days.forEach(day=>rows.push({
    LOKALIZACJA_ID:loc,GRUPA_DNI:group,DZIEŃ_TYGODNIA:day,ZMIANA_ID:id,
    NAZWA:name,START:start,KONIEC:end,KONIEC_DZIEŃ_PLUS:plus,AKTYWNA:'TAK'
  }));
  add('KRUCZA','PON-CZW',['PON','WT','ŚR','CZW'],'RANO','Poranna','10:00','17:00',0);
  add('KRUCZA','PON-CZW',['PON','WT','ŚR','CZW'],'WIECZÓR','Wieczorna','17:00','01:00',1);
  add('KRUCZA','PT-ND',['PT','SOB','ND'],'RANO','Poranna','10:00','17:00',0);
  add('KRUCZA','PT-ND',['PT','SOB','ND'],'ŚRODEK','Środkowa','15:00','23:00',0);
  add('KRUCZA','PT-ND',['PT','SOB','ND'],'WIECZÓR','Wieczorna','17:00','03:00',1);
  add('PAWILONY','ND-CZW',['ND','PON','WT','ŚR','CZW'],'RANO','Poranna','10:00','17:00',0);
  add('PAWILONY','ND-CZW',['ND','PON','WT','ŚR','CZW'],'WIECZÓR','Wieczorna','17:00','01:00',1);
  add('PAWILONY','PT-SOB',['PT','SOB'],'RANO','Poranna','12:00','19:00',0);
  add('PAWILONY','PT-SOB',['PT','SOB'],'WIECZÓR','Wieczorna','19:00','05:00',1);
  return rows;
}

function gpRealStaffingMatrix_(){
  const rows=[];
  const add=(loc,group,shift,role,count,fn)=>rows.push({
    LOKALIZACJA_ID:loc,GRUPA_DNI:group,ZMIANA_ID:shift,ROLA:role,
    FUNKCJA_WYMAGANA:fn||'',MIN_OSÓB:count,OPTYMALNIE_OSÓB:count,MAX_OSÓB:count,AKTYWNA:'TAK'
  });
  [['PON-CZW','RANO',{KELNER:4,BARMAN:2,PIZZABAR:2,PREP:5,POMOC:1}],
   ['PON-CZW','WIECZÓR',{KELNER:8,BARMAN:3,PIZZABAR:4,POMOC:1}],
   ['PT-ND','RANO',{KELNER:6,BARMAN:3,PIZZABAR:3,PREP:5,POMOC:1}],
   ['PT-ND','ŚRODEK',{KELNER:2,BARMAN:1}],
   ['PT-ND','WIECZÓR',{KELNER:8,BARMAN:5,PIZZABAR:5,POMOC:2}]
  ].forEach(x=>Object.keys(x[2]).forEach(role=>add('KRUCZA',x[0],x[1],role,x[2][role],
    x[1]==='WIECZÓR'&&role==='BARMAN'?'ZAMKNIĘCIE_BARU':
    x[1]==='WIECZÓR'&&role==='KELNER'?'ZAMKNIĘCIE_SALI':'')));
  ['PON-CZW','PT-ND'].forEach(group=>{
    add('KRUCZA',group,'RANO','KELNER',1,'HOST');
    add('KRUCZA',group,'WIECZÓR','KELNER',1,'HOST');
  });
  ['ND-CZW','PT-SOB'].forEach(group=>{
    add('PAWILONY',group,'RANO','BARMAN',1,'');
    add('PAWILONY',group,'RANO','PIZZABAR',1,'');
    add('PAWILONY',group,'WIECZÓR','BARMAN',2,'ZAMKNIĘCIE_BARU');
    add('PAWILONY',group,'WIECZÓR','PIZZABAR',2,'');
  });
  return rows;
}

function gpApplyRealValidations_(){
  const yn=SpreadsheetApp.newDataValidation().requireValueInList(['TAK','NIE'],true).setAllowInvalid(false).build();
  const sh=gpSheet_(GP.SHEETS.EMPLOYEES);
  ['AKTYWNY','KRUCZA_STANDARD','PAWILONY_STANDARD','KRUCZA_NADGODZINY','PAWILONY_NADGODZINY','HOST','ZAMKNIĘCIE_BARU','ZAMKNIĘCIE_SALI','MENADŻER_ZESPOŁU','ROTACYJNY','SPLIT_SHIFT','EVENT','STANDBY']
    .forEach(h=>sh.getRange(2,GP_HEADERS[GP.SHEETS.EMPLOYEES].indexOf(h)+1,Math.max(1,sh.getMaxRows()-1),1).setDataValidation(yn));
  sh.getRange(2,6,Math.max(1,sh.getMaxRows()-1),1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['KELNER','BARMAN','PIZZABAR','PREP','POMOC'],true).setAllowInvalid(false).build());
}

function gpLoadDemo(){
  gpInstall();
  return gpLock_(()=>{
    const month=gpMonth_(new Date());
    const demo=gpBuildRealEmployees_(month);
    gpResetDemoTransactions_();
    gpReplaceRows_(GP.SHEETS.LOCATIONS,[
      {ID:'KRUCZA',NAZWA:'KRUCZA',ADRES:'Warszawa — Krucza',AKTYWNA:'TAK',KIEROWNIK_EMAIL:'',KOLOR:'#2563eb'},
      {ID:'PAWILONY',NAZWA:'PAWILONY',ADRES:'Warszawa — Pawilony',AKTYWNA:'TAK',KIEROWNIK_EMAIL:'',KOLOR:'#7c3aed'}
    ]);
    gpReplaceRows_(GP.SHEETS.SHIFT_TYPES,[
      {ID:'RANO',NAZWA:'Poranna',START:'10:00',KONIEC:'17:00',KONIEC_DZIEŃ_PLUS:0,PŁATNE_H:7,TYP:'PODSTAWOWA',KOLOR:'#fde68a'},
      {ID:'ŚRODEK',NAZWA:'Środkowa',START:'15:00',KONIEC:'23:00',KONIEC_DZIEŃ_PLUS:0,PŁATNE_H:8,TYP:'PODSTAWOWA',KOLOR:'#86efac'},
      {ID:'WIECZÓR',NAZWA:'Wieczorna',START:'17:00',KONIEC:'03:00',KONIEC_DZIEŃ_PLUS:1,PŁATNE_H:10,TYP:'PODSTAWOWA',KOLOR:'#c4b5fd'},
      {ID:'STANDBY',NAZWA:'Stand-by',START:'10:00',KONIEC:'22:00',KONIEC_DZIEŃ_PLUS:0,PŁATNE_H:2,TYP:'STANDBY',KOLOR:'#fca5a5'}
    ]);
    gpReplaceRows_(GP.SHEETS.EMPLOYEES,demo.employees);
    gpReplaceRows_(GP.SHEETS.CONTRACTS,demo.contracts);
    gpReplaceRows_(GP.SHEETS.USERS,demo.users);
    gpGenerateRealDemand_(month);
    gpGenerateDemoAvailability_(month,demo.employees);
    gpReplaceRows_(GP.SHEETS.BUDGETS,[
      {MIESIĄC:month,LOKALIZACJA_ID:'KRUCZA',BUDŻET:190000,LIMIT_H:5200,OSTRZEŻENIE_PROC:90,AKTYWNY:'TAK'},
      {MIESIĄC:month,LOKALIZACJA_ID:'PAWILONY',BUDŻET:45000,LIMIT_H:1200,OSTRZEŻENIE_PROC:90,AKTYWNY:'TAK'}
    ]);
    gpReplaceRows_(GP.SHEETS.EVENTS,[
      {ID:'EV-DEMO-1',NAZWA:'Event firmowy',OD:`${month}-10`,DO:`${month}-10`,LOKALIZACJA_ID:'KRUCZA',ZMIANA_ID:'WIECZÓR',ROLA:'KELNER',DODATKOWE_OSOBY:2,START_OVERRIDE:'',KONIEC_OVERRIDE:'',DODATKOWA_ZMIANA:'NIE',UWAGI:'Dodatkowa obsada'},
      {ID:'EV-DEMO-2',NAZWA:'Weekend specjalny',OD:`${month}-18`,DO:`${month}-18`,LOKALIZACJA_ID:'PAWILONY',ZMIANA_ID:'WIECZÓR',ROLA:'BARMAN',DODATKOWE_OSOBY:1,START_OVERRIDE:'',KONIEC_OVERRIDE:'',DODATKOWA_ZMIANA:'NIE',UWAGI:'Szczyt eventowy'}
    ]);
    gpReplaceRows_(GP.SHEETS.DAY_EXCEPTIONS,[]);
    gpRefreshDashboard_();
    gpAudit_('LOAD_DEMO','SYSTEM',month,null,{employees:demo.employees.length,model:'REAL_WORLD'});
    return {ok:true,month,employees:demo.employees.length,message:'Pełne dane demonstracyjne KRUCZA + PAWILONY zostały załadowane.'};
  });
}

function gpResetDemoTransactions_(){
  [
    GP.SHEETS.PLANS,
    GP.SHEETS.ASSIGNMENTS,
    GP.SHEETS.VERSIONS,
    GP.SHEETS.KPI,
    GP.SHEETS.ROLE_PLANS,
    GP.SHEETS.EMERGENCY,
    GP.SHEETS.SWAPS,
    GP.SHEETS.NOTIFICATIONS,
    GP.SHEETS.TESTS
  ].forEach(name=>gpReplaceRows_(name,[]));
}

function gpBuildRealEmployees_(month){
  const first=['Anna','Marta','Julia','Zofia','Aleksandra','Natalia','Katarzyna','Iga','Lena','Maja','Monika','Karolina','Ewa','Alicja','Weronika','Joanna','Paulina','Magdalena','Dominika','Agata'];
  const last=['Nowak','Kowalska','Wiśniewska','Wójcik','Kamińska','Lewandowska','Zielińska','Szymańska','Woźniak','Dąbrowska','Kozłowska','Jankowska','Mazur','Krawczyk','Piotrowska','Grabowska','Pawłowska','Michalska','Król','Wieczorek'];
  const roles=[['KELNER',28],['BARMAN',19],['PIZZABAR',18],['PREP',7],['POMOC',4]];
  const employees=[],contracts=[],users=[];let i=0,roleIndex={};
  roles.forEach(([role,count])=>{roleIndex[role]=[];for(let n=0;n<count;n++,i++){
    const id=`P${String(i+1).padStart(3,'0')}`;
    const name=`${first[i%first.length]} ${last[(Math.floor(i/first.length)*5+i%5)%last.length]}`;
    const email=`${role.toLowerCase()}.${String(n+1).padStart(2,'0')}@demo.pl`;
    const isManager=n===0||(role==='BARMAN'&&n===1);
    const managerLocation=role==='BARMAN'?(n===0?'KRUCZA':n===1?'PAWILONY':''):'WSZYSTKIE';
    const base=role==='BARMAN'?(n===1||n%5===0?'PAWILONY':'KRUCZA'):(role==='PIZZABAR'&&n%4===0?'PAWILONY':'KRUCZA');
    const rotating=(role==='BARMAN'||role==='PIZZABAR')&&n>=Math.max(2,count-5);
    const krStandard=base==='KRUCZA'||rotating;
    const pawStandard=(base==='PAWILONY'||rotating)&&(role==='BARMAN'||role==='PIZZABAR');
    const closeBar=role==='BARMAN'&&(isManager||n%3===0);
    const closeFloor=role==='KELNER'&&(isManager||n%6===0);
    const host=role==='KELNER'&&n%4===0;
    const emp={ID:id,IMIĘ_I_NAZWISKO:name,EMAIL:email,TELEFON:`500${String(100000+i).slice(-6)}`,AKTYWNY:'TAK',
      ROLA_GŁÓWNA:role,LOKALIZACJA_BAZOWA:base,KRUCZA_STANDARD:krStandard?'TAK':'NIE',PAWILONY_STANDARD:pawStandard?'TAK':'NIE',
      KRUCZA_NADGODZINY:'TAK',PAWILONY_NADGODZINY:(role==='BARMAN'||role==='PIZZABAR')?'TAK':'NIE',
      HOST:host?'TAK':'NIE',ZAMKNIĘCIE_BARU:closeBar?'TAK':'NIE',ZAMKNIĘCIE_SALI:closeFloor?'TAK':'NIE',
      MENADŻER_ZESPOŁU:isManager?'TAK':'NIE',ZARZĄDZA_ROLĄ:isManager?role:'',ZARZĄDZA_LOKALIZACJĄ:isManager?managerLocation:'',
      ROTACYJNY:rotating?'TAK':'NIE',SPLIT_SHIFT:rotating?'TAK':'NIE',EVENT:(rotating||n%4===0)?'TAK':'NIE',STANDBY:n%5===0?'TAK':'NIE',PRIORYTET:isManager?3:1};
    employees.push(emp);roleIndex[role].push(id);
    const full=n<count-3;
    contracts.push({PRACOWNIK_ID:id,TYP_UMOWY:full?'UMOWA O PRACĘ':'CZĘŚĆ ETATU',ETAT:full?1:.5,GODZINY_MIESIĘCZNE:full?168:84,
      STAWKA_GODZINOWA:30+(i%8),KOSZT_PRACODAWCY_H:42+(i%9),OD:`${month}-01`,DO:'',TYLKO_RANO:role==='PREP'?'TAK':'NIE',
      DOZWOLONE_LOKALIZACJE:[krStandard?'KRUCZA':'',pawStandard?'PAWILONY':''].filter(Boolean).join(','),
      MAX_DNI_Z_RZĘDU:6,MAX_H_TYDZIEŃ:48,TYLKO_POPOŁUDNIE:'NIE',BEZ_WEEKENDÓW:'NIE',DOSTĘPNY_STANDBY:emp.STANDBY,MIN_ODPOCZYNEK_H:11});
    users.push({EMAIL:email,ROLA:isManager?GP.ROLES.MANAGER:GP.ROLES.EMPLOYEE,PRACOWNIK_ID:id,
      LOKALIZACJE:role==='BARMAN'?'KRUCZA,PAWILONY':emp.KRUCZA_STANDARD==='TAK'?'KRUCZA':'PAWILONY',AKTYWNY:'TAK'});
  }});
  users.push({EMAIL:'właściciel@demo.pl',ROLA:GP.ROLES.ADMIN,PRACOWNIK_ID:'',LOKALIZACJE:'KRUCZA,PAWILONY',AKTYWNY:'TAK'});
  users.push({EMAIL:'ksiegowość@demo.pl',ROLA:GP.ROLES.ACCOUNTING,PRACOWNIK_ID:'',LOKALIZACJE:'KRUCZA,PAWILONY',AKTYWNY:'TAK'});
  return {employees,contracts,users};
}

function gpGenerateRealDemand_(month){
  const definitions=gpRows_(GP.SHEETS.SHIFT_DEFINITIONS),matrix=gpRows_(GP.SHEETS.STAFFING_MATRIX);
  const start=new Date(`${month}-01T12:00:00`),end=new Date(start.getFullYear(),start.getMonth()+1,0,12),rows=[];
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const date=gpDate_(d),day=gpDayCode_(d);
    definitions.filter(x=>x.DZIEŃ_TYGODNIA===day&&gpYes_(x.AKTYWNA)).forEach(def=>{
      matrix.filter(m=>m.LOKALIZACJA_ID===def.LOKALIZACJA_ID&&m.GRUPA_DNI===def.GRUPA_DNI&&m.ZMIANA_ID===def.ZMIANA_ID&&gpYes_(m.AKTYWNA)).forEach(m=>{
        rows.push({DATA:date,LOKALIZACJA_ID:def.LOKALIZACJA_ID,ZMIANA_ID:def.ZMIANA_ID,ROLA:m.ROLA,FUNKCJA_WYMAGANA:m.FUNKCJA_WYMAGANA,
          MIN_OSÓB:m.MIN_OSÓB,OPTYMALNIE_OSÓB:m.OPTYMALNIE_OSÓB,MAX_OSÓB:m.MAX_OSÓB,STANDBY:0,PRIORYTET:m.FUNKCJA_WYMAGANA?3:1,ŹRÓDŁO:'STANDARD'});
      });
    });
  }
  gpReplaceRows_(GP.SHEETS.DEMAND,rows);
  return rows.length;
}

function gpGeneratePlan(request){
  return gpLock_(()=>gpGeneratePlanCore_(request));
}

function gpGeneratePlanCore_(request){
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);
  request=request||{};
  const started=Date.now(),month=gpMonth_(request.month||new Date()),planId=gpId_('PLAN');
  if(!gpRows_(GP.SHEETS.DEMAND).some(r=>gpMonth_(r.DATA)===month))gpGenerateRealDemand_(month);
  const ctx=gpBuildRealContext_(month,request),result=gpOptimizeReal_(ctx);
  if(!result.assignments.length)throw new Error(`Nie utworzono przydziałów. ${result.summary}`);
  const plan={ID:planId,NAZWA:request.name||`Plan operacyjny ${month}`,MIESIĄC:month,SCENARIUSZ:ctx.scenario.SCENARIUSZ_ID,
    TRYB:ctx.mode.TRYB_ID,STATUS:GP.PLAN_STATUS.DRAFT,UTWORZYŁ:gpCurrentUser_().email,UTWORZONO:gpNow_(),WYNIK:result.score,KOSZT:result.cost,UWAGI:result.summary};
  gpAppend_(GP.SHEETS.PLANS,plan);
  const old=gpRows_(GP.SHEETS.ASSIGNMENTS).map(gpCleanRow_);
  const assignmentBatch=Utilities.getUuid().slice(0,8).toUpperCase();
  const created=result.assignments.map((a,index)=>Object.assign({
    ID:`ASG-${assignmentBatch}-${String(index+1).padStart(4,'0')}`,
    PLAN_ID:planId,
    STATUS:GP.ASSIGNMENT_STATUS.PLANNED
  },a));
  gpReplaceRows_(GP.SHEETS.ASSIGNMENTS,old.concat(created));
  gpWriteKpis_(planId,result.kpis);gpSaveVersion_(planId,'Plan wygenerowany automatycznie');
  gpWriteRolePlans_(planId,created,result.gaps);
  gpRefreshDashboard_();
  SpreadsheetApp.flush();
  const savedPlan=gpRows_(GP.SHEETS.PLANS).find(p=>p.ID===planId);
  const savedAssignments=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId);
  if(!savedPlan||savedAssignments.length!==created.length){
    throw new Error(`Plan nie został zapisany w całości (${savedAssignments.length}/${created.length} przydziałów). Nie pokazuję fałszywego komunikatu sukcesu.`);
  }
  gpAudit_('GENERATE','PLAN',planId,null,{assignments:created.length,gaps:result.gaps.length});
  return {ok:true,plan:savedPlan,result:{assignments:savedAssignments,gaps:result.gaps,kpis:result.kpis,summary:result.summary},persisted:true,timings:{totalMs:Date.now()-started}};
}

function gpGetCalendarPlan(month,planId){
  month=gpMonth_(month||new Date());
  const plans=gpListPlans(month);
  const selected=planId?plans.find(p=>p.ID===planId):(plans.find(p=>p.STATUS===GP.PLAN_STATUS.PUBLISHED)||plans[0]);
  if(!selected)return {month,empty:true,plans:[]};
  const assignments=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===selected.ID&&a.STATUS!==GP.ASSIGNMENT_STATUS.CANCELLED);
  if(!assignments.length)return {month,empty:true,plans,reason:'Plan istnieje, ale nie zawiera zapisanych przydziałów.',plan:selected};
  return {month,empty:false,plans,plan:selected,assignments,
    rolePlans:gpRows_(GP.SHEETS.ROLE_PLANS).filter(r=>r.PLAN_ID===selected.ID)};
}

function gpBuildRealContext_(month,request){
  const employees=gpRows_(GP.SHEETS.EMPLOYEES).filter(e=>gpYes_(e.AKTYWNY));
  const contracts=gpRows_(GP.SHEETS.CONTRACTS),shifts=gpRows_(GP.SHEETS.SHIFT_TYPES),defs=gpRows_(GP.SHEETS.SHIFT_DEFINITIONS);
  const demand=gpApplyCalendarChanges_(gpRows_(GP.SHEETS.DEMAND).filter(r=>gpMonth_(r.DATA)===month),month);
  const scenarios=gpRows_(GP.SHEETS.SCENARIOS).filter(r=>gpYes_(r.AKTYWNY)),modes=gpRows_(GP.SHEETS.MODES).filter(r=>gpYes_(r.AKTYWNY)),levels=gpRows_(GP.SHEETS.LEVELS).filter(r=>gpYes_(r.AKTYWNY));
  const scenario=scenarios.find(x=>x.SCENARIUSZ_ID===(request.scenario||'BAZOWY'))||scenarios[0];
  const mode=modes.find(x=>x.TRYB_ID===(request.mode||'ZRÓWNOWAŻONY'))||modes[0];
  const level=levels.find(x=>x.POZIOM_ID===(request.coverage||scenario.DOMYŚLNY_POZIOM_OBSADY||'OPTIMAL'))||levels[0];
  return {month,request,employees,demand,scenario,mode,level,events:gpRows_(GP.SHEETS.EVENTS),exceptions:gpRows_(GP.SHEETS.DAY_EXCEPTIONS),
    absences:gpRows_(GP.SHEETS.ABSENCES),availability:gpRows_(GP.SHEETS.AVAILABILITY),budgets:gpRows_(GP.SHEETS.BUDGETS).filter(b=>String(b.MIESIĄC).slice(0,7)===month),
    maps:{contract:Object.fromEntries(contracts.map(x=>[x.PRACOWNIK_ID,x])),shift:Object.fromEntries(shifts.map(x=>[x.ID,x]))},definitions:defs,rules:gpConfig_()};
}

function gpApplyCalendarChanges_(demand,month){
  let rows=demand.map(gpCleanRow_);
  const exceptions=gpRows_(GP.SHEETS.DAY_EXCEPTIONS).filter(e=>gpYes_(e.AKTYWNY)&&gpMonth_(e.DATA)===month);
  exceptions.forEach(e=>{
    if(e.TYP==='ZAMKNIJ_DZIEŃ')rows=rows.filter(r=>!(gpDate_(r.DATA)===gpDate_(e.DATA)&&r.LOKALIZACJA_ID===e.LOKALIZACJA_ID));
    if(e.TYP==='ANULUJ_ZMIANĘ')rows=rows.filter(r=>!(gpDate_(r.DATA)===gpDate_(e.DATA)&&r.LOKALIZACJA_ID===e.LOKALIZACJA_ID&&r.ZMIANA_ID===e.ZMIANA_ID));
    if(e.TYP==='DODAJ_OSOBY')rows.forEach(r=>{if(gpExceptionMatches_(r,e)){r.MIN_OSÓB=Number(r.MIN_OSÓB||0)+Number(e.WARTOŚĆ||0);r.OPTYMALNIE_OSÓB=Number(r.OPTYMALNIE_OSÓB||0)+Number(e.WARTOŚĆ||0);r.MAX_OSÓB=Number(r.MAX_OSÓB||0)+Number(e.WARTOŚĆ||0);r.ŹRÓDŁO='WYJĄTEK';}});
    if(e.TYP==='ZMIEŃ_GODZINY')rows.forEach(r=>{if(gpExceptionMatches_(r,e)){r.START_OVERRIDE=e.START;r.KONIEC_OVERRIDE=e.KONIEC;r.DZIEŃ_PLUS_OVERRIDE=Number(e.DZIEŃ_PLUS||0);r.ŹRÓDŁO='WYJĄTEK_GODZIN';}});
    if(e.TYP==='DODATKOWA_ZMIANA'&&e.ROLA)rows.push({DATA:gpDate_(e.DATA),LOKALIZACJA_ID:e.LOKALIZACJA_ID,ZMIANA_ID:e.ZMIANA_ID||`EXTRA-${e.ID}`,ROLA:e.ROLA,FUNKCJA_WYMAGANA:'',MIN_OSÓB:Number(e.WARTOŚĆ||1),OPTYMALNIE_OSÓB:Number(e.WARTOŚĆ||1),MAX_OSÓB:Number(e.WARTOŚĆ||1),STANDBY:0,PRIORYTET:3,ŹRÓDŁO:'DODATKOWA_ZMIANA',START_OVERRIDE:e.START||'10:00',KONIEC_OVERRIDE:e.KONIEC||'18:00',DZIEŃ_PLUS_OVERRIDE:Number(e.DZIEŃ_PLUS||0)});
  });
  gpRows_(GP.SHEETS.EVENTS).filter(e=>gpMonth_(e.OD)===month).forEach(e=>rows.forEach(r=>{
    const date=gpDate_(r.DATA);
    if(date>=gpDate_(e.OD)&&date<=gpDate_(e.DO)&&(!e.LOKALIZACJA_ID||r.LOKALIZACJA_ID===e.LOKALIZACJA_ID)&&(!e.ZMIANA_ID||r.ZMIANA_ID===e.ZMIANA_ID)&&(!e.ROLA||r.ROLA===e.ROLA)){
      const extra=Number(e.DODATKOWE_OSOBY||0);r.MIN_OSÓB=Number(r.MIN_OSÓB||0)+extra;r.OPTYMALNIE_OSÓB=Number(r.OPTYMALNIE_OSÓB||0)+extra;r.MAX_OSÓB=Number(r.MAX_OSÓB||0)+extra;r.ŹRÓDŁO='EVENT';
    }
  }));
  return rows;
}

function gpOptimizeReal_(ctx){
  const assignments=[],gaps=[],state={};ctx.employees.forEach(e=>state[e.ID]={hours:0,weekly:{},intervals:[],days:{},closings:0});
  const sorted=ctx.demand.slice().sort((a,b)=>gpDate_(a.DATA).localeCompare(gpDate_(b.DATA))||Number(!!b.FUNKCJA_WYMAGANA)-Number(!!a.FUNKCJA_WYMAGANA)||String(a.ROLA).localeCompare(String(b.ROLA)));
  let required=0;
  sorted.forEach(slot=>{
    const target=Math.max(Number(slot.MIN_OSÓB||0),Math.ceil(gpDemandBase_(slot,ctx.level)*Number(ctx.scenario.MNOŻNIK_ZAPOTRZEBOWANIA||1)));
    required+=target;
    const chosen=[];
    for(let n=0;n<target;n++){
      const needFunction=n===0?String(slot.FUNKCJA_WYMAGANA||''):'';
      const candidates=ctx.employees.map(e=>gpRealCandidate_(e,slot,needFunction,ctx,state)).filter(x=>x.ok&&!chosen.some(c=>c.emp.ID===x.emp.ID)).sort((a,b)=>b.score-a.score);
      if(!candidates.length){gaps.push({DATA:gpDate_(slot.DATA),LOKALIZACJA_ID:slot.LOKALIZACJA_ID,ZMIANA_ID:slot.ZMIANA_ID,ROLA:slot.ROLA,FUNKCJA:needFunction||'',BRAK:1});continue;}
      const c=candidates[0],times=gpSlotTimes_(slot,ctx),hours=(times.end-times.start)/3600000,cost=gpShiftCostReal_(c.emp.ID,hours,slot,ctx);
      const fn=needFunction||'';
      assignments.push({DATA:gpDate_(slot.DATA),LOKALIZACJA_ID:slot.LOKALIZACJA_ID,ZMIANA_ID:slot.ZMIANA_ID,OD:times.startText,DO:times.endText,DZIEŃ_PLUS:times.plus,
        PRACOWNIK_ID:c.emp.ID,ROLA:slot.ROLA,FUNKCJA:fn,KLASYFIKACJA:c.classification,STANDBY:'NIE',KOSZT:cost,ŹRÓDŁO:slot.ŹRÓDŁO||'SILNIK',UWAGI:c.note});
      chosen.push(c);gpUpdateRealState_(state[c.emp.ID],slot,times,hours,fn);
    }
  });
  const cost=assignments.reduce((s,a)=>s+Number(a.KOSZT||0),0),coverage=Math.round(100*assignments.length/Math.max(1,required));
  const hard=gaps.filter(g=>g.FUNKCJA).length,score=Math.max(0,Math.round(coverage-hard*10));
  return {assignments,gaps,cost:gpRound_(cost),score,kpis:{coverage,uncovered:gaps.length,hardViolations:hard,cost:gpRound_(cost),assignments:assignments.length},
    summary:`Pokrycie ${coverage}%, ${assignments.length} przydziałów, ${gaps.length} braków, w tym ${hard} braków wymaganych funkcji.`};
}

function gpRealCandidate_(emp,slot,needFunction,ctx,state){
  if(emp.ROLA_GŁÓWNA!==slot.ROLA)return {emp,ok:false};
  if(needFunction&&!gpHasFunction_(emp,needFunction))return {emp,ok:false};
  if(!gpCanWorkLocation_(emp,slot.LOKALIZACJA_ID))return {emp,ok:false};
  if(emp.ROLA_GŁÓWNA==='PREP'&&(slot.LOKALIZACJA_ID!=='KRUCZA'||slot.ZMIANA_ID!=='RANO'))return {emp,ok:false};
  const date=gpDate_(slot.DATA),contract=ctx.maps.contract[emp.ID];if(!contract)return {emp,ok:false};
  if(ctx.absences.some(a=>a.PRACOWNIK_ID===emp.ID&&String(a.STATUS).toUpperCase()!=='ODRZUCONA'&&date>=gpDate_(a.OD)&&date<=gpDate_(a.DO)))return {emp,ok:false};
  if(ctx.availability.some(a=>a.PRACOWNIK_ID===emp.ID&&gpDate_(a.DATA)===date&&String(a.STATUS).toUpperCase()==='NIEDOSTĘPNY'))return {emp,ok:false};
  if(gpYes_(contract.TYLKO_RANO)&&slot.ZMIANA_ID!=='RANO')return {emp,ok:false};
  const times=gpSlotTimes_(slot,ctx),st=state[emp.ID],overlap=st.intervals.some(x=>times.start<x.end&&times.end>x.start);if(overlap)return {emp,ok:false};
  if(st.intervals.length){const last=st.intervals[st.intervals.length-1],rest=(times.start-last.end)/3600000;if(rest>=0&&rest<Number(contract.MIN_ODPOCZYNEK_H||11))return {emp,ok:false};}
  const week=gpWeekKey_(date),hours=(times.end-times.start)/3600000,max=Number(contract.MAX_H_TYDZIEŃ||48)+Number(ctx.scenario.MAX_NADGODZIN_H||0);
  if(Number(st.weekly[week]||0)+hours>max)return {emp,ok:false};
  const target=Number(contract.GODZINY_MIESIĘCZNE||168),ratio=st.hours/Math.max(1,target);
  const home=emp.LOKALIZACJA_BAZOWA===slot.LOKALIZACJA_ID,classification=home?'ETAT_STANDARDOWY':gpYes_(emp[`${slot.LOKALIZACJA_ID}_STANDARD`])?'ETAT_STANDARDOWY':'NADGODZINY_INNY_LOKAL';
  const managerPenalty=gpYes_(emp.MENADŻER_ZESPOŁU)&&!home?15:0,closingFairness=needFunction?st.closings*8:0;
  return {emp,ok:true,score:(1-ratio)*100+(home?8:0)+Number(emp.PRIORYTET||1)-managerPenalty-closingFairness,classification,note:needFunction?`Wymagana funkcja: ${needFunction}`:'Przydział rolowy'};
}

function gpSlotTimes_(slot,ctx){
  const date=gpDate_(slot.DATA),day=gpDayCode_(new Date(`${date}T12:00:00`));
  const def=ctx.definitions.find(d=>d.LOKALIZACJA_ID===slot.LOKALIZACJA_ID&&d.DZIEŃ_TYGODNIA===day&&d.ZMIANA_ID===slot.ZMIANA_ID);
  const shift=def||ctx.maps.shift[slot.ZMIANA_ID]||{START:'10:00',KONIEC:'18:00',KONIEC_DZIEŃ_PLUS:0};
  const startText=String(slot.START_OVERRIDE||shift.START),endText=String(slot.KONIEC_OVERRIDE||shift.KONIEC),plus=slot.DZIEŃ_PLUS_OVERRIDE!==undefined&&slot.DZIEŃ_PLUS_OVERRIDE!==''?Number(slot.DZIEŃ_PLUS_OVERRIDE):Number(shift.KONIEC_DZIEŃ_PLUS||0);
  const start=new Date(`${date}T${startText}:00`),end=new Date(`${date}T${endText}:00`);end.setDate(end.getDate()+plus);
  return {start,end,startText,endText,plus};
}

function gpHasFunction_(emp,fn){
  if(fn==='HOST')return gpYes_(emp.HOST);
  if(fn==='ZAMKNIĘCIE_BARU')return gpYes_(emp.ZAMKNIĘCIE_BARU);
  if(fn==='ZAMKNIĘCIE_SALI')return gpYes_(emp.ZAMKNIĘCIE_SALI);
  return true;
}
function gpCanWorkLocation_(emp,loc){return gpYes_(emp[`${loc}_STANDARD`])||gpYes_(emp[`${loc}_NADGODZINY`]);}
function gpDemandBase_(slot,level){const src=String(level.ŹRÓDŁO_CELU||'OPT');return Number(src==='MIN'?slot.MIN_OSÓB:src==='MAX'?slot.MAX_OSÓB:slot.OPTYMALNIE_OSÓB||slot.MIN_OSÓB||0)*Number(level.MNOŻNIK||1);}
function gpShiftCostReal_(id,hours,slot,ctx){const c=ctx.maps.contract[id]||{},rate=Number(c.KOSZT_PRACODAWCY_H||c.STAWKA_GODZINOWA||0);return gpRound_(rate*hours*(slot.ZMIANA_ID==='WIECZÓR'?1.08:1));}
function gpUpdateRealState_(st,slot,times,hours,fn){const date=gpDate_(slot.DATA),week=gpWeekKey_(date);st.hours+=hours;st.weekly[week]=(st.weekly[week]||0)+hours;st.days[date]=true;st.intervals.push({start:times.start,end:times.end,location:slot.LOKALIZACJA_ID});st.intervals.sort((a,b)=>a.start-b.start);if(String(fn).indexOf('ZAMKNIĘCIE')===0)st.closings++;}

function gpWriteRolePlans_(planId,assignments,gaps){
  const managers=gpRows_(GP.SHEETS.EMPLOYEES).filter(e=>gpYes_(e.MENADŻER_ZESPOŁU));
  const old=gpRows_(GP.SHEETS.ROLE_PLANS).filter(r=>r.PLAN_ID!==planId).map(gpCleanRow_);
  const rows=['KELNER','BARMAN','PIZZABAR','PREP','POMOC'].map(role=>{
    const own=assignments.filter(a=>a.ROLA===role),ownGaps=gaps.filter(g=>g.ROLA===role);
    return {PLAN_ID:planId,ROLA:role,STATUS:ownGaps.length?'BRAKI':'GOTOWY',
      MENADŻEROWIE:managers.filter(m=>m.ZARZĄDZA_ROLĄ===role).map(m=>m.IMIĘ_I_NAZWISKO).join(', '),
      LICZBA_PRZYDZIAŁÓW:own.length,BRAKI:ownGaps.length,KOSZT:gpRound_(own.reduce((s,a)=>s+Number(a.KOSZT||0),0)),OSTATNIA_AKTUALIZACJA:gpNow_()};
  });
  gpReplaceRows_(GP.SHEETS.ROLE_PLANS,old.concat(rows));
}

function gpGetRoleSchedule(planId,role,location){
  const current=gpCurrentUser_(),employees=gpRows_(GP.SHEETS.EMPLOYEES),self=employees.find(e=>e.ID===current.employeeId);
  if(current.role===GP.ROLES.MANAGER&&self&&self.ZARZĄDZA_ROLĄ!==role)throw new Error('Brak dostępu do grafiku tej roli.');
  return gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId&&a.ROLA===role&&(!location||a.LOKALIZACJA_ID===location));
}

function gpValidatePlan_(planId){
  const plan=gpRows_(GP.SHEETS.PLANS).find(p=>p.ID===planId);if(!plan)return {ok:false,errors:[{type:'BRAK_PLANU'}],warnings:[]};
  const asg=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===planId&&a.STATUS!==GP.ASSIGNMENT_STATUS.CANCELLED);
  const ctx=gpBuildRealContext_(gpMonth_(plan.MIESIĄC),{}),errors=[],warnings=[],employees=Object.fromEntries(ctx.employees.map(e=>[e.ID,e]));
  asg.forEach(a=>{
    const emp=employees[a.PRACOWNIK_ID];
    if(!emp)errors.push({type:'BRAK_PRACOWNIKA',assignment:a.ID});
    else if(emp.ROLA_GŁÓWNA!==a.ROLA)errors.push({type:'NIEZGODNA_ROLA',assignment:a.ID,expected:a.ROLA,actual:emp.ROLA_GŁÓWNA});
    if(emp&&!gpCanWorkLocation_(emp,a.LOKALIZACJA_ID))errors.push({type:'NIEDOZWOLONA_LOKALIZACJA',assignment:a.ID});
  });
  const coverage={};asg.forEach(a=>{const key=[gpDate_(a.DATA),a.LOKALIZACJA_ID,a.ZMIANA_ID,a.ROLA,a.FUNKCJA||''].join('|');coverage[key]=(coverage[key]||0)+1;});
  ctx.demand.forEach(d=>{
    const fn=String(d.FUNKCJA_WYMAGANA||''),base=[gpDate_(d.DATA),d.LOKALIZACJA_ID,d.ZMIANA_ID,d.ROLA].join('|');
    const total=asg.filter(a=>[gpDate_(a.DATA),a.LOKALIZACJA_ID,a.ZMIANA_ID,a.ROLA].join('|')===base).length;
    if(total<Number(d.MIN_OSÓB||0))warnings.push({type:'NIEDOBÓR',date:gpDate_(d.DATA),location:d.LOKALIZACJA_ID,shift:d.ZMIANA_ID,role:d.ROLA,missing:Number(d.MIN_OSÓB)-total});
    if(fn){const qualified=asg.filter(a=>[gpDate_(a.DATA),a.LOKALIZACJA_ID,a.ZMIANA_ID,a.ROLA].join('|')===base&&gpHasFunction_(employees[a.PRACOWNIK_ID]||{},fn)).length;if(qualified<1)errors.push({type:'BRAK_WYMAGANEJ_FUNKCJI',date:gpDate_(d.DATA),location:d.LOKALIZACJA_ID,shift:d.ZMIANA_ID,role:d.ROLA,function:fn});}
  });
  return {ok:errors.length===0,errors,warnings};
}

function gpAddDayException(payload){
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);payload=payload||{};
  const row={ID:gpId_('EXC'),DATA:gpDate_(payload.date),LOKALIZACJA_ID:payload.location,TYP:payload.type,ZMIANA_ID:payload.shift||'',ROLA:payload.role||'',
    WARTOŚĆ:Number(payload.value||0),START:payload.start||'',KONIEC:payload.end||'',DZIEŃ_PLUS:Number(payload.dayPlus||0),NAZWA:payload.name||'',UWAGI:payload.notes||'',AKTYWNY:'TAK'};
  gpAppend_(GP.SHEETS.DAY_EXCEPTIONS,row);gpAudit_('CREATE','DAY_EXCEPTION',row.ID,null,row);return {ok:true,row};
}

function gpAddEmergencyAssignment(payload){
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);payload=payload||{};
  const plan=gpRows_(GP.SHEETS.PLANS).find(p=>p.ID===payload.planId);if(!plan)throw new Error('Nie znaleziono planu.');
  const emp=gpRows_(GP.SHEETS.EMPLOYEES).find(e=>e.ID===payload.employeeId);if(!emp||emp.ROLA_GŁÓWNA!==payload.role)throw new Error('Zastępca musi mieć właściwą rolę główną.');
  if(!gpCanWorkLocation_(emp,payload.location))throw new Error('Pracownik nie ma uprawnienia do tej lokalizacji.');
  const ctx=gpBuildRealContext_(gpMonth_(plan.MIESIĄC),{}),times=gpSlotTimes_({DATA:payload.date,LOKALIZACJA_ID:payload.location,ZMIANA_ID:payload.shift},ctx);
  const asg={ID:gpId_('ASG'),PLAN_ID:plan.ID,DATA:gpDate_(payload.date),LOKALIZACJA_ID:payload.location,ZMIANA_ID:payload.shift,OD:times.startText,DO:times.endText,DZIEŃ_PLUS:times.plus,
    PRACOWNIK_ID:emp.ID,ROLA:payload.role,FUNKCJA:payload.function||'',KLASYFIKACJA:'AWARYJNY',STANDBY:'NIE',STATUS:GP.ASSIGNMENT_STATUS.PLANNED,KOSZT:0,ŹRÓDŁO:'AWARYJNY',UWAGI:payload.notes||'Ręczne zastępstwo awaryjne'};
  gpAppend_(GP.SHEETS.ASSIGNMENTS,asg);
  const emergency={ID:gpId_('EMG'),PLAN_ID:plan.ID,DATA:asg.DATA,LOKALIZACJA_ID:asg.LOKALIZACJA_ID,ZMIANA_ID:asg.ZMIANA_ID,ROLA:asg.ROLA,NIEOBECNY_ID:payload.absentId||'',ZASTĘPCA_ID:emp.ID,
    STATUS:'DODANO',POWIADOMIĆ:payload.notify?'TAK':'NIE',KANAŁ:payload.channel||'EMAIL',UTWORZYŁ:gpCurrentUser_().email,UTWORZONO:gpNow_(),UWAGI:asg.UWAGI};
  gpAppend_(GP.SHEETS.EMERGENCY,emergency);
  if(payload.notify)gpQueueEmergencyNotification_(emp,asg,emergency);
  gpRefreshDashboard_();gpAudit_('CREATE','EMERGENCY',emergency.ID,null,emergency);return {ok:true,assignment:asg,emergency};
}

function gpAddRotationalSegment(payload){
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER]);payload=payload||{};
  const emp=gpRows_(GP.SHEETS.EMPLOYEES).find(e=>e.ID===payload.employeeId);
  if(!emp||emp.ROLA_GŁÓWNA!=='BARMAN'||!gpYes_(emp.ROTACYJNY)||!gpYes_(emp.SPLIT_SHIFT))throw new Error('Segment między lokalami może otrzymać wyłącznie rotacyjny barman z funkcją split shift.');
  const plus=Number(payload.dayPlus||0),start=new Date(`${gpDate_(payload.date)}T${payload.start}:00`),end=new Date(`${gpDate_(payload.date)}T${payload.end}:00`);end.setDate(end.getDate()+plus);
  if(end<=start)throw new Error('Koniec segmentu musi być później niż początek.');
  const all=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>a.PLAN_ID===payload.planId&&a.PRACOWNIK_ID===emp.ID&&gpDate_(a.DATA)===gpDate_(payload.date));
  const buffer=Number(gpConfig_().BUFOR_PRZEJAZDU_MIN||30)*60000;
  all.forEach(a=>{const s=new Date(`${gpDate_(a.DATA)}T${a.OD}:00`),e=new Date(`${gpDate_(a.DATA)}T${a.DO}:00`);e.setDate(e.getDate()+Number(a.DZIEŃ_PLUS||0));if(start<new Date(e.getTime()+buffer)&&end>new Date(s.getTime()-buffer))throw new Error('Segment koliduje z pracą lub nie zachowuje buforu przejazdu.');});
  const row={ID:gpId_('ASG'),PLAN_ID:payload.planId,DATA:gpDate_(payload.date),LOKALIZACJA_ID:payload.location,ZMIANA_ID:'SEGMENT_EVENT',OD:payload.start,DO:payload.end,DZIEŃ_PLUS:plus,PRACOWNIK_ID:emp.ID,ROLA:'BARMAN',FUNKCJA:'EVENT_ROTACYJNY',KLASYFIKACJA:'EVENT_ROTACYJNY',STANDBY:'NIE',STATUS:GP.ASSIGNMENT_STATUS.PLANNED,KOSZT:0,ŹRÓDŁO:'EVENT_ROTACYJNY',UWAGI:payload.notes||'Segment szczytowy'};
  gpAppend_(GP.SHEETS.ASSIGNMENTS,row);gpAudit_('CREATE','ROTATIONAL_SEGMENT',row.ID,null,row);return {ok:true,row};
}

function gpQueueEmergencyNotification_(emp,asg,emergency){
  gpAppend_(GP.SHEETS.NOTIFICATIONS,{ID:gpId_('NOT'),ODBIORCA:emp.EMAIL,TYP:'AWARYJNA_ZMIANA',TYTUŁ:'Pilna zmiana w grafiku',
    TREŚĆ:`${asg.DATA}, ${asg.LOKALIZACJA_ID}, ${asg.ZMIANA_ID} (${asg.OD}–${asg.DO}). Prosimy o potwierdzenie.`,
    STATUS:'OCZEKUJE',UTWORZONO:gpNow_(),WYSŁANO:''});
}

function gpRefreshDashboard_(){
  const sh=gpSs_().getSheetByName('PANEL');if(!sh)return {ok:false};
  const employees=gpRows_(GP.SHEETS.EMPLOYEES).filter(e=>gpYes_(e.AKTYWNY)).length;
  const plans=gpRows_(GP.SHEETS.PLANS),planIds=new Set(plans.map(p=>p.ID)),published=plans.filter(p=>p.STATUS===GP.PLAN_STATUS.PUBLISHED).length;
  const assignments=gpRows_(GP.SHEETS.ASSIGNMENTS).filter(a=>planIds.has(a.PLAN_ID)&&a.STATUS!==GP.ASSIGNMENT_STATUS.CANCELLED).length;
  const alerts=gpRows_(GP.SHEETS.KPI).filter(k=>planIds.has(k.PLAN_ID)&&String(k.STATUS).toUpperCase()==='ALERT').length+
    gpRows_(GP.SHEETS.ROLE_PLANS).filter(r=>planIds.has(r.PLAN_ID)).reduce((s,r)=>s+Number(r.BRAKI||0),0);
  [['A6:B8',`PRACOWNICY: ${employees}`],['C6:D8',`AKTYWNY PLAN: ${published}`],['E6:F8',`PRZYDZIAŁY: ${assignments}`],['G6:H8',`ALERTY: ${alerts}`]].forEach(x=>sh.getRange(x[0]).setValue(x[1]));
  return {ok:true,employees,published,assignments,alerts};
}

function gpQuickStatus(){
  const d=gpRefreshDashboard_(),central=gpCentralStatus_();
  return {dashboard:d,lastSync:central.lastSync||'',pendingNotifications:gpRows_(GP.SHEETS.NOTIFICATIONS).filter(n=>n.STATUS==='OCZEKUJE').length,
    pendingAbsences:gpRows_(GP.SHEETS.ABSENCES).filter(a=>a.STATUS==='OCZEKUJE').length,pendingSwaps:gpRows_(GP.SHEETS.SWAPS).filter(s=>s.STATUS==='OCZEKUJE').length,
    roleGaps:gpRows_(GP.SHEETS.ROLE_PLANS).reduce((s,r)=>s+Number(r.BRAKI||0),0),
    health:{score:Number(PropertiesService.getDocumentProperties().getProperty('GP_LAST_HEALTH_SCORE')||0)}};
}

function gpRunQuickHealth(){
  const tests=[],run=(name,fn)=>{try{fn();tests.push({name,status:'PASS'});}catch(e){tests.push({name,status:'FAIL',detail:e.message});}};
  run('Wymagane arkusze',()=>{
    [GP.SHEETS.EMPLOYEES,GP.SHEETS.LOCATIONS,GP.SHEETS.SHIFT_DEFINITIONS,GP.SHEETS.STAFFING_MATRIX,GP.SHEETS.DEMAND]
      .forEach(name=>{if(!gpSs_().getSheetByName(name))throw new Error(`Brak ${name}`);});
  });
  run('Pracownicy',()=>{const rows=gpRows_(GP.SHEETS.EMPLOYEES);if(rows.length!==76)throw new Error(`Oczekiwano 76, jest ${rows.length}`);});
  run('Lokalizacje',()=>{const ids=gpRows_(GP.SHEETS.LOCATIONS).map(x=>x.ID);['KRUCZA','PAWILONY'].forEach(id=>{if(!ids.includes(id))throw new Error(`Brak ${id}`);});});
  run('Definicje zmian',()=>{if(gpRows_(GP.SHEETS.SHIFT_DEFINITIONS).length!==31)throw new Error('Niepełne definicje zmian');});
  run('Macierz obsady',()=>{if(gpRows_(GP.SHEETS.STAFFING_MATRIX).length!==32)throw new Error('Niepełna macierz obsady');});
  run('Panel bez formuł',()=>{const sh=gpSs_().getSheetByName('PANEL');if(!sh)throw new Error('Brak PANEL');if(['A6','C6','E6','G6'].some(a=>!!sh.getRange(a).getFormula()))throw new Error('Panel nadal zawiera formuły');});
  const passed=tests.filter(x=>x.status==='PASS').length,score=Math.round(passed/Math.max(1,tests.length)*100);
  PropertiesService.getDocumentProperties().setProperty('GP_LAST_HEALTH_SCORE',String(score));
  return {ok:passed===tests.length,passed,total:tests.length,score,tests};
}

function gpRunAllTests(){
  const results=[],run=(name,fn)=>{try{fn();results.push({CZAS:gpNow_(),TEST:name,STATUS:'PASS',SZCZEGÓŁY:'OK'});}catch(e){results.push({CZAS:gpNow_(),TEST:name,STATUS:'FAIL',SZCZEGÓŁY:e.message});}};
  run('Struktura 2.3',()=>{const h=gpHealthCheck();if(!h.ok)throw new Error(`Health ${h.score}%`);});
  run('Panel bez formuł',()=>{const sh=gpSheet_('PANEL');['A6','C6','E6','G6'].forEach(a=>{if(sh.getRange(a).getFormula())throw new Error(`${a} nadal zawiera formułę`);});});
  run('Unikatowi pracownicy',()=>{const e=gpRows_(GP.SHEETS.EMPLOYEES),names=e.map(x=>x.IMIĘ_I_NAZWISKO);if(new Set(names).size!==names.length)throw new Error('Powtórzone imię i nazwisko');});
  run('Role główne',()=>{gpRows_(GP.SHEETS.EMPLOYEES).forEach(e=>{if(!['KELNER','BARMAN','PIZZABAR','PREP','POMOC'].includes(e.ROLA_GŁÓWNA))throw new Error(`${e.ID}: zła rola`);});});
  run('Funkcje zgodne z rolą',()=>{gpRows_(GP.SHEETS.EMPLOYEES).forEach(e=>{if(gpYes_(e.HOST)&&e.ROLA_GŁÓWNA!=='KELNER')throw new Error(`${e.ID}: HOST`);if(gpYes_(e.ZAMKNIĘCIE_BARU)&&e.ROLA_GŁÓWNA!=='BARMAN')throw new Error(`${e.ID}: BAR`);if(gpYes_(e.ZAMKNIĘCIE_SALI)&&e.ROLA_GŁÓWNA!=='KELNER')throw new Error(`${e.ID}: SALA`);});});
  run('Menadżerowie',()=>{const m=gpRows_(GP.SHEETS.EMPLOYEES).filter(e=>gpYes_(e.MENADŻER_ZESPOŁU));if(m.length!==6)throw new Error(`Oczekiwano 6, jest ${m.length}`);if(m.filter(x=>x.ROLA_GŁÓWNA==='BARMAN').length!==2)throw new Error('Barman musi mieć 2 menadżerów');});
  run('Zmiany Krucza',()=>{const d=gpRows_(GP.SHEETS.SHIFT_DEFINITIONS);if(!d.some(x=>x.LOKALIZACJA_ID==='KRUCZA'&&x.ZMIANA_ID==='WIECZÓR'&&x.KONIEC==='03:00'&&Number(x.KONIEC_DZIEŃ_PLUS)===1))throw new Error('Brak nocnej zmiany Krucza');});
  run('Zmiany Pawilony',()=>{const d=gpRows_(GP.SHEETS.SHIFT_DEFINITIONS);if(!d.some(x=>x.LOKALIZACJA_ID==='PAWILONY'&&x.GRUPA_DNI==='PT-SOB'&&x.START==='19:00'&&x.KONIEC==='05:00'))throw new Error('Brak 19–05');});
  run('Macierz obsady',()=>{if(gpRows_(GP.SHEETS.STAFFING_MATRIX).length<25)throw new Error('Niepełna macierz');});
  run('Zapotrzebowanie rolowe',()=>{const d=gpRows_(GP.SHEETS.DEMAND);if(!d.length||d.some(x=>!x.ROLA))throw new Error('Brak popytu rolowego');});
  run('Próba optymalizacji',()=>{const ctx=gpBuildRealContext_(gpMonth_(new Date()),{scenario:'BAZOWY',coverage:'OPTIMAL'}),r=gpOptimizeReal_(ctx);if(!r.assignments.length||r.score<=0)throw new Error(`Wynik ${r.score}, przydziały ${r.assignments.length}`);});
  gpReplaceRows_(GP.SHEETS.TESTS,results);const passed=results.filter(x=>x.STATUS==='PASS').length,score=Math.round(passed/Math.max(1,results.length)*100);
  PropertiesService.getDocumentProperties().setProperty('GP_LAST_HEALTH_SCORE',String(score));
  return {ok:passed===results.length,passed,total:results.length,score,results};
}

function gpDayCode_(d){return ['ND','PON','WT','ŚR','CZW','PT','SOB'][d.getDay()];}
function gpYes_(v){return ['TAK','TRUE','1'].includes(String(v).toUpperCase());}
function gpCleanRow_(r){const x=Object.assign({},r);delete x._row;return x;}
function gpExceptionMatches_(r,e){return gpDate_(r.DATA)===gpDate_(e.DATA)&&r.LOKALIZACJA_ID===e.LOKALIZACJA_ID&&(!e.ZMIANA_ID||r.ZMIANA_ID===e.ZMIANA_ID)&&(!e.ROLA||r.ROLA===e.ROLA);}
