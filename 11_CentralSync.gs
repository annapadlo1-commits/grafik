function gpSyncCentrals(){
  gpRequireRole_([GP.ROLES.ADMIN,GP.ROLES.MANAGER,GP.ROLES.ACCOUNTING]);
  return gpLock_(()=>{
    const cfg=gpCentralConfig_();
    if(!cfg.USTAWIENIA_FILE_ID||!cfg.HR_FINANSE_FILE_ID)throw new Error('Uzupełnij identyfikatory dwóch plików w arkuszu CENTRALE.');
    const before=gpCreateLocalSnapshot_();
    try{
      const settings=SpreadsheetApp.openById(String(cfg.USTAWIENIA_FILE_ID).trim());
      const finance=SpreadsheetApp.openById(String(cfg.HR_FINANSE_FILE_ID).trim());
      const db=gpReadExternal_(settings,'BAZA_PRACOWNIKÓW');
      const locations=gpReadExternal_(settings,'LOKALIZACJE');
      const shifts=gpReadExternal_(settings,'TYPY_ZMIAN');
      const rules=gpReadExternal_(settings,'REGUŁY_PLANOWANIA');
      const scenarios=gpReadExternal_(settings,'SCENARIUSZE');
      const modes=gpReadExternal_(settings,'TRYBY_OPTYMALIZACJI');
      const levels=gpReadExternal_(settings,'POZIOMY_OBSADY');
      const shiftDefinitions=gpReadExternal_(settings,'DEFINICJE_ZMIAN');
      const staffingMatrix=gpReadExternal_(settings,'MACIERZ_OBSADY');
      const extraFunctions=gpReadExternal_(settings,'FUNKCJE_DODATKOWE');
      const calendar=gpReadExternal_(settings,'KALENDARZ_MODYFIKACJI');
      const costs=gpReadExternal_(finance,'KOSZTY_PRACOWNIKÓW');
      const budgets=gpReadExternal_(finance,'BUDŻETY_LOKALIZACJI');
      const validation=gpValidateCentralPayload_(db,locations,costs,budgets);
      if(!validation.ok)throw new Error(`Synchronizacja zablokowana: ${validation.errors.slice(0,8).join('; ')}`);
      gpApplySettingsSnapshot_(db,locations,shifts,rules,scenarios,modes,levels,shiftDefinitions,staffingMatrix,extraFunctions,calendar);
      gpApplyFinanceSnapshot_(costs,budgets);
      const stamp=gpNow_(),version=Utilities.getUuid().slice(0,8).toUpperCase();
      gpSetCentralStatus_('OSTATNIA_SYNCHRONIZACJA',stamp,'POŁĄCZONO');
      gpSetCentralStatus_('WERSJA_SNAPSHOTU',version,'GOTOWY');
      PropertiesService.getDocumentProperties().setProperty('GP_LAST_GOOD_CENTRAL_SYNC',JSON.stringify({version,stamp,employees:db.length}));
      gpAudit_('SYNC','CENTRALE',version,null,{employees:db.length,locations:locations.length,costs:costs.length,budgets:budgets.length});
      SpreadsheetApp.getActive().toast(`Synchronizacja zakończona: ${db.length} pracowników.`,'GRAFIK PRO',7);
      return {ok:true,version,stamp,employees:db.length,scenarios:scenarios.length,modes:modes.length,levels:levels.length,validation};
    }catch(e){
      gpRestoreLocalSnapshot_(before);
      gpSetCentralStatus_('OSTATNIA_SYNCHRONIZACJA',gpNow_(),'BŁĄD');
      gpAudit_('SYNC_FAIL','CENTRALE','',null,{error:e.message});
      throw e;
    }
  });
}

function gpCentralConfig_(){
  const out={};gpRows_(GP.SHEETS.CENTRALS).forEach(r=>out[String(r.KLUCZ)]=r.WARTOŚĆ);return out;
}

function gpCentralStatus_(){
  const c=gpCentralConfig_();return {lastSync:c.OSTATNIA_SYNCHRONIZACJA,version:c.WERSJA_SNAPSHOTU,connected:!!(c.USTAWIENIA_FILE_ID&&c.HR_FINANSE_FILE_ID)};
}

function gpSetCentralStatus_(key,value,status){
  const sh=gpSheet_(GP.SHEETS.CENTRALS),data=sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++)if(data[i][0]===key){sh.getRange(i+1,2).setValue(value);sh.getRange(i+1,4).setValue(status);return;}
}

function gpReadExternal_(ss,name){
  const sh=ss.getSheetByName(name);if(!sh)throw new Error(`W pliku „${ss.getName()}” brakuje arkusza ${name}.`);
  const values=sh.getDataRange().getValues();if(values.length<2)return[];
  const h=values.shift().map(String);return values.filter(r=>r.some(v=>v!=='')).map(r=>Object.fromEntries(h.map((x,i)=>[x,r[i]])));
}

function gpValidateCentralPayload_(db,locations,costs,budgets){
  const errors=[],warnings=[],ids=new Set(),locIds=new Set(locations.map(l=>l['LOKALIZACJA_ID*']));
  const legacyLocations=['LOC-CENTRUM','LOC-OGRODY'].some(id=>locIds.has(id));
  const realWorldLocations=['KRUCZA','PAWILONY'].every(id=>locIds.has(id));
  if(legacyLocations&&!realWorldLocations){
    return {
      ok:false,
      errors:['Plik USTAWIENIA korzysta jeszcze ze starego słownika lokalizacji LOC-CENTRUM / LOC-OGRODY. Zainstaluj poprawkę USTAWIENIA 2.3.1, uruchom naprawę struktury i ponownie załaduj dane DEMO przed synchronizacją.'],
      warnings:[]
    };
  }
  db.forEach((r,i)=>{
    const id=r['PRACOWNIK_ID*'];if(!id)errors.push(`Baza wiersz ${i+2}: brak ID`);
    if(ids.has(id))errors.push(`Duplikat pracownika ${id}`);ids.add(id);
    if(String(r.STATUS_REKORDU)==='BŁĄD'||String(r.STATUS_REKORDU)==='NIEKOMPLETNY')errors.push(`${id}: status ${r.STATUS_REKORDU}`);
    const base=r['LOKALIZACJA_BAZOWA*'];if(base&&!locIds.has(base))errors.push(`${id}: nieznana lokalizacja bazowa ${base}`);
  });
  costs.forEach(r=>{if(!ids.has(r['PRACOWNIK_ID*']))warnings.push(`Koszt bez aktywnego pracownika: ${r['PRACOWNIK_ID*']}`);});
  budgets.forEach(r=>{if(!locIds.has(r['LOKALIZACJA_ID*']))errors.push(`Budżet nieznanej lokalizacji ${r['LOKALIZACJA_ID*']}`);});
  return {ok:errors.length===0,errors,warnings};
}

function gpApplySettingsSnapshot_(db,locations,shifts,rules,scenarios,modes,levels,shiftDefinitions,staffingMatrix,extraFunctions,calendar){
  const employees=[],contracts=[],users=[];
  db.forEach(r=>{
    const id=r['PRACOWNIK_ID*'],active=String(r['AKTYWNY*']).toUpperCase()==='TAK'?'TAK':'NIE';
    employees.push({ID:id,IMIĘ_I_NAZWISKO:r['IMIĘ_I_NAZWISKO*'],EMAIL:r['EMAIL*'],TELEFON:r.TELEFON,AKTYWNY:active,ROLA_GŁÓWNA:r['ROLA_GŁÓWNA*'],LOKALIZACJA_BAZOWA:r['LOKALIZACJA_BAZOWA*'],KRUCZA_STANDARD:r.KRUCZA_STANDARD,PAWILONY_STANDARD:r.PAWILONY_STANDARD,KRUCZA_NADGODZINY:r.KRUCZA_NADGODZINY,PAWILONY_NADGODZINY:r.PAWILONY_NADGODZINY,HOST:r.HOST,ZAMKNIĘCIE_BARU:r.ZAMKNIĘCIE_BARU,ZAMKNIĘCIE_SALI:r.ZAMKNIĘCIE_SALI,MENADŻER_ZESPOŁU:r.MENADŻER_ZESPOŁU,ZARZĄDZA_ROLĄ:r.ZARZĄDZA_ROLĄ,ZARZĄDZA_LOKALIZACJĄ:r.ZARZĄDZA_LOKALIZACJĄ,ROTACYJNY:r.ROTACYJNY,SPLIT_SHIFT:r.SPLIT_SHIFT,EVENT:r.EVENT,STANDBY:r.STANDBY,PRIORYTET:r.PRIORYTET_PLANOWANIA});
    const allowed=[r.KRUCZA_STANDARD==='TAK'?'KRUCZA':'',r.PAWILONY_STANDARD==='TAK'?'PAWILONY':''].filter(Boolean).join(',');
    contracts.push({PRACOWNIK_ID:id,TYP_UMOWY:r['TYP_UMOWY*'],ETAT:r['ETAT*'],GODZINY_MIESIĘCZNE:r['GODZINY_MIESIĘCZNE*'],STAWKA_GODZINOWA:'',KOSZT_PRACODAWCY_H:'',OD:r['DATA_ZATRUDNIENIA_OD*'],DO:r.DATA_ZATRUDNIENIA_DO,TYLKO_RANO:r.TYLKO_RANO,DOZWOLONE_LOKALIZACJE:allowed,MAX_DNI_Z_RZĘDU:r.MAX_DNI_Z_RZĘDU,MAX_H_TYDZIEŃ:r.MAX_GODZIN_TYGODNIOWO,TYLKO_POPOŁUDNIE:r.TYLKO_POPOŁUDNIE,BEZ_WEEKENDÓW:r.BEZ_WEEKENDÓW,DOSTĘPNY_STANDBY:r.STANDBY,MIN_ODPOCZYNEK_H:r.MIN_ODPOCZYNEK_H});
    users.push({EMAIL:r['EMAIL*'],ROLA:r['ROLA_APLIKACJI*']||GP.ROLES.EMPLOYEE,PRACOWNIK_ID:id,LOKALIZACJE:allowed,AKTYWNY:active});
  });
  locations.forEach(r=>{}); // walidacja odbywa się przed zapisem
  gpReplaceRows_(GP.SHEETS.EMPLOYEES,employees);gpReplaceRows_(GP.SHEETS.CONTRACTS,contracts);gpReplaceRows_(GP.SHEETS.USERS,users);
  gpReplaceRows_(GP.SHEETS.LOCATIONS,locations.map(r=>({ID:r['LOKALIZACJA_ID*'],NAZWA:r['NAZWA*'],ADRES:r.ADRES,AKTYWNA:r['AKTYWNA*'],KIEROWNIK_EMAIL:r.KIEROWNIK_EMAIL,KOLOR:r.KOLOR})));
  gpReplaceRows_(GP.SHEETS.SHIFT_TYPES,shifts.map(r=>({ID:r['ZMIANA_ID*'],NAZWA:r['NAZWA*'],START:r['START*'],KONIEC:r['KONIEC*'],PŁATNE_H:r['PŁATNE_GODZINY*'],TYP:r['TYP*'],KOLOR:r.KOLOR,WYMAGANE_UMIEJĘTNOŚCI:r.WYMAGANE_KOMPETENCJE})));
  const cfg=gpRows_(GP.SHEETS.CONFIG),map=Object.fromEntries(cfg.map((x,i)=>[x.KLUCZ,i]));
  rules.forEach(r=>{const key=r.KLUCZ;if(map[key]!==undefined)cfg[map[key]].WARTOŚĆ=r.WARTOŚĆ;else cfg.push({KLUCZ:key,WARTOŚĆ:r.WARTOŚĆ,OPIS:r.OPIS,EDYTOWALNE:r.EDYTOWALNE});});
  gpReplaceRows_(GP.SHEETS.CONFIG,cfg);
  gpReplaceRows_(GP.SHEETS.SCENARIOS,scenarios.map(r=>({SCENARIUSZ_ID:r['SCENARIUSZ_ID*'],NAZWA:r['NAZWA*'],MNOŻNIK_ZAPOTRZEBOWANIA:r['MNOŻNIK_ZAPOTRZEBOWANIA*'],MNOŻNIK_BUDŻETU:r['MNOŻNIK_BUDŻETU*'],DOMYŚLNY_POZIOM_OBSADY:r.DOMYŚLNY_POZIOM_OBSADY,NADGODZINY:r.NADGODZINY,MAX_NADGODZIN_H:r.MAX_NADGODZIN_H,REDUKCJA_DOSTĘPNOŚCI_PROC:r.REDUKCJA_DOSTĘPNOŚCI_PROC,ZATRUDNIENIE_CZASOWE:r.ZATRUDNIENIE_CZASOWE,AKTYWNY:r.AKTYWNY,OPIS:r.OPIS})));
  gpReplaceRows_(GP.SHEETS.MODES,modes.map(r=>({TRYB_ID:r['TRYB_ID*'],NAZWA:r['NAZWA*'],WAGA_KOSZT_PROC:r['WAGA_KOSZT_PROC*'],WAGA_PREFERENCJE_PROC:r['WAGA_PREFERENCJE_PROC*'],WAGA_SPRAWIEDLIWOŚĆ_PROC:r['WAGA_SPRAWIEDLIWOŚĆ_PROC*'],WAGA_POKRYCIE_PROC:r['WAGA_POKRYCIE_PROC*'],WAGA_CIĄGŁOŚĆ_PROC:r['WAGA_CIĄGŁOŚĆ_PROC*'],AKTYWNY:r.AKTYWNY,OPIS:r.OPIS})));
  gpReplaceRows_(GP.SHEETS.LEVELS,levels.map(r=>({POZIOM_ID:r['POZIOM_ID*'],NAZWA:r['NAZWA*'],ŹRÓDŁO_CELU:r['ŹRÓDŁO_CELU*'],MNOŻNIK:r['MNOŻNIK*'],LIMIT_BUDŻETU_PROC:r.LIMIT_BUDŻETU_PROC,AKTYWNY:r.AKTYWNY,OPIS:r.OPIS})));
  gpReplaceRows_(GP.SHEETS.SHIFT_DEFINITIONS,shiftDefinitions||[]);
  gpReplaceRows_(GP.SHEETS.STAFFING_MATRIX,staffingMatrix||[]);
  gpReplaceRows_(GP.SHEETS.EXTRA_FUNCTIONS,extraFunctions||[]);
  gpReplaceRows_(GP.SHEETS.DAY_EXCEPTIONS,(calendar||[]).map(r=>({ID:r.ID,DATA:r.DATA,LOKALIZACJA_ID:r.LOKALIZACJA_ID,TYP:r.TYP,ZMIANA_ID:r.ZMIANA_ID,ROLA:r.ROLA,WARTOŚĆ:r.WARTOŚĆ,START:r.START,KONIEC:r.KONIEC,DZIEŃ_PLUS:r.DZIEŃ_PLUS,NAZWA:r.NAZWA,UWAGI:r.UWAGI,AKTYWNY:r.AKTYWNY})));
  gpGenerateRealDemand_(gpMonth_(new Date()));
  gpRefreshDashboard_();
}

function gpApplyFinanceSnapshot_(costs,budgets){
  const contractRows=gpRows_(GP.SHEETS.CONTRACTS),byId=Object.fromEntries(costs.map(r=>[r['PRACOWNIK_ID*'],r]));
  contractRows.forEach(c=>{const f=byId[c.PRACOWNIK_ID];if(f){c.STAWKA_GODZINOWA=f.STAWKA_BRUTTO_H;c.KOSZT_PRACODAWCY_H=f['KOSZT_PRACODAWCY_H*'];}});
  gpReplaceRows_(GP.SHEETS.CONTRACTS,contractRows);
  gpReplaceRows_(GP.SHEETS.COSTS,costs.map(r=>({PRACOWNIK_ID:r['PRACOWNIK_ID*'],MIESIĄC:r['MIESIĄC*'],STAWKA_H:r.STAWKA_BRUTTO_H,DODATEK_NOCNY:'',DODATEK_WEEKEND:'',KOSZT_STAŁY:r.KOSZT_STAŁY_MIESIĘCZNY,UWAGI:r.UWAGI})));
  gpReplaceRows_(GP.SHEETS.BUDGETS,budgets.map(r=>({MIESIĄC:r['MIESIĄC*'],LOKALIZACJA_ID:r['LOKALIZACJA_ID*'],BUDŻET:r['BUDŻET_PŁACOWY*'],LIMIT_H:r.LIMIT_GODZIN,OSTRZEŻENIE_PROC:r.PRÓG_OSTRZEŻENIA_PROC,AKTYWNY:r.AKTYWNY})));
}

function gpCreateLocalSnapshot_(){
  const clean=name=>gpRows_(name).map(r=>{const x=Object.assign({},r);delete x._row;return x;});
  return {employees:clean(GP.SHEETS.EMPLOYEES),contracts:clean(GP.SHEETS.CONTRACTS),users:clean(GP.SHEETS.USERS),locations:clean(GP.SHEETS.LOCATIONS),shifts:clean(GP.SHEETS.SHIFT_TYPES),config:clean(GP.SHEETS.CONFIG),scenarios:clean(GP.SHEETS.SCENARIOS),modes:clean(GP.SHEETS.MODES),levels:clean(GP.SHEETS.LEVELS),shiftDefinitions:clean(GP.SHEETS.SHIFT_DEFINITIONS),staffingMatrix:clean(GP.SHEETS.STAFFING_MATRIX),extraFunctions:clean(GP.SHEETS.EXTRA_FUNCTIONS),dayExceptions:clean(GP.SHEETS.DAY_EXCEPTIONS),costs:clean(GP.SHEETS.COSTS),budgets:clean(GP.SHEETS.BUDGETS),created:gpNow_()};
}

function gpRestoreLocalSnapshot_(s){
  if(!s)return;
  gpReplaceRows_(GP.SHEETS.EMPLOYEES,s.employees||[]);
  gpReplaceRows_(GP.SHEETS.CONTRACTS,s.contracts||[]);
  gpReplaceRows_(GP.SHEETS.USERS,s.users||[]);
  gpReplaceRows_(GP.SHEETS.LOCATIONS,s.locations||[]);
  gpReplaceRows_(GP.SHEETS.SHIFT_TYPES,s.shifts||[]);
  gpReplaceRows_(GP.SHEETS.CONFIG,s.config||[]);
  gpReplaceRows_(GP.SHEETS.SCENARIOS,s.scenarios||[]);
  gpReplaceRows_(GP.SHEETS.MODES,s.modes||[]);
  gpReplaceRows_(GP.SHEETS.LEVELS,s.levels||[]);
  gpReplaceRows_(GP.SHEETS.SHIFT_DEFINITIONS,s.shiftDefinitions||[]);
  gpReplaceRows_(GP.SHEETS.STAFFING_MATRIX,s.staffingMatrix||[]);
  gpReplaceRows_(GP.SHEETS.EXTRA_FUNCTIONS,s.extraFunctions||[]);
  gpReplaceRows_(GP.SHEETS.DAY_EXCEPTIONS,s.dayExceptions||[]);
  gpReplaceRows_(GP.SHEETS.COSTS,s.costs||[]);
  gpReplaceRows_(GP.SHEETS.BUDGETS,s.budgets||[]);
}
