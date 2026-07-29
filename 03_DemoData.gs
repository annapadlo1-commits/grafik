function gpLoadDemoLegacy_() {
  gpInstall();
  return gpLock_(() => {
    const useCentrals=gpCentralStatus_().connected;
    const today = new Date();
    const month = gpMonth_(today);
    const locations = [
      {ID:'LOC-CENTRUM', NAZWA:'Centrum', ADRES:'Warszawa – Centrum', AKTYWNA:'TAK', KIEROWNIK_EMAIL:'kierownik.centrum@demo.pl', KOLOR:'#2563eb'},
      {ID:'LOC-OGRODY', NAZWA:'Ogrody', ADRES:'Warszawa – Ogrody', AKTYWNA:'TAK', KIEROWNIK_EMAIL:'kierownik.ogrody@demo.pl', KOLOR:'#7c3aed'}
    ];
    const shifts = [
      {ID:'RANO', NAZWA:'Zmiana poranna', START:'06:00', KONIEC:'14:00', PŁATNE_H:8, TYP:'PODSTAWOWA', KOLOR:'#fde68a', WYMAGANE_UMIEJĘTNOŚCI:'OBSŁUGA'},
      {ID:'POPOŁUDNIE', NAZWA:'Zmiana popołudniowa', START:'14:00', KONIEC:'22:00', PŁATNE_H:8, TYP:'PODSTAWOWA', KOLOR:'#c4b5fd', WYMAGANE_UMIEJĘTNOŚCI:'OBSŁUGA'},
      {ID:'EXTRA', NAZWA:'Zmiana dodatkowa', START:'10:00', KONIEC:'18:00', PŁATNE_H:8, TYP:'DODATKOWA', KOLOR:'#86efac', WYMAGANE_UMIEJĘTNOŚCI:'OBSŁUGA'},
      {ID:'STANDBY', NAZWA:'Dyżur stand-by', START:'06:00', KONIEC:'22:00', PŁATNE_H:2, TYP:'STANDBY', KOLOR:'#fca5a5', WYMAGANE_UMIEJĘTNOŚCI:''}
    ];
    const firstNames = ['Anna','Marta','Julia','Zofia','Ola','Natalia','Kasia','Iga','Lena','Maja','Monika','Karolina','Ewa','Alicja','Weronika'];
    const lastNames = ['Nowak','Kowalska','Wiśniewska','Wójcik','Kamińska','Lewandowska','Zielińska','Szymańska','Woźniak','Dąbrowska','Kozłowska','Jankowska','Mazur','Krawczyk','Piotrowska'];
    const employees = [], contracts = [], users = [];
    for (let i = 0; i < 60; i++) {
      const id = `P${String(i + 1).padStart(3, '0')}`;
      const email = `pracownik${i + 1}@demo.pl`;
      const loc = i % 5 === 0 ? 'LOC-CENTRUM' : i % 5 === 1 ? 'LOC-OGRODY' : 'LOC-CENTRUM,LOC-OGRODY';
      employees.push({ID:id, IMIĘ_I_NAZWISKO:`${firstNames[i%15]} ${lastNames[(i*7)%15]}`, EMAIL:email, TELEFON:`500${String(100000+i).slice(-6)}`, AKTYWNY:'TAK', DOMYŚLNA_LOKALIZACJA:i%2?'LOC-OGRODY':'LOC-CENTRUM', UMIEJĘTNOŚCI:i%8===0?'OBSŁUGA,LIDER':'OBSŁUGA', PRIORYTET:i%10===0?2:1});
      const full = i < 40;
      contracts.push({PRACOWNIK_ID:id, TYP_UMOWY:full?'UMOWA O PRACĘ':'CZĘŚĆ ETATU', ETAT:full?1:0.5, GODZINY_MIESIĘCZNE:full?168:84, STAWKA_GODZINOWA:28+(i%8), KOSZT_PRACODAWCY_H:38+(i%9), OD:`${month}-01`, DO:'', TYLKO_RANO:i%11===0?'TAK':'NIE', DOZWOLONE_LOKALIZACJE:loc, MAX_DNI_Z_RZĘDU:i%13===0?4:6, MAX_H_TYDZIEŃ:full?48:32,TYLKO_POPOŁUDNIE:'NIE',BEZ_WEEKENDÓW:i%17===0?'TAK':'NIE',DOSTĘPNY_STANDBY:i%7===0?'NIE':'TAK',MIN_ODPOCZYNEK_H:11});
      users.push({EMAIL:email, ROLA:GP.ROLES.EMPLOYEE, PRACOWNIK_ID:id, LOKALIZACJE:loc, AKTYWNY:'TAK'});
    }
    users.push({EMAIL:'admin@demo.pl', ROLA:GP.ROLES.ADMIN, PRACOWNIK_ID:'', LOKALIZACJE:'LOC-CENTRUM,LOC-OGRODY', AKTYWNY:'TAK'});
    users.push({EMAIL:'ksiegowosc@demo.pl', ROLA:GP.ROLES.ACCOUNTING, PRACOWNIK_ID:'', LOKALIZACJE:'LOC-CENTRUM,LOC-OGRODY', AKTYWNY:'TAK'});
    users.push({EMAIL:'kierownik.centrum@demo.pl', ROLA:GP.ROLES.MANAGER, PRACOWNIK_ID:'P001', LOKALIZACJE:'LOC-CENTRUM', AKTYWNY:'TAK'});
    users.push({EMAIL:'kierownik.ogrody@demo.pl', ROLA:GP.ROLES.MANAGER, PRACOWNIK_ID:'P002', LOKALIZACJE:'LOC-OGRODY', AKTYWNY:'TAK'});
    if(!useCentrals){
      gpReplaceRows_(GP.SHEETS.LOCATIONS, locations);
      gpReplaceRows_(GP.SHEETS.SHIFT_TYPES, shifts);
      gpReplaceRows_(GP.SHEETS.EMPLOYEES, employees);
      gpReplaceRows_(GP.SHEETS.CONTRACTS, contracts);
      gpReplaceRows_(GP.SHEETS.USERS, users);
    }
    gpGenerateDemoDemand_(month);
    gpGenerateDemoAvailability_(month,useCentrals?gpRows_(GP.SHEETS.EMPLOYEES):employees);
    if(!useCentrals)gpReplaceRows_(GP.SHEETS.BUDGETS, [
        {MIESIĄC:month, LOKALIZACJA_ID:'LOC-CENTRUM', BUDŻET:85000, LIMIT_H:2200, OSTRZEŻENIE_PROC:90, AKTYWNY:'TAK'},
        {MIESIĄC:month, LOKALIZACJA_ID:'LOC-OGRODY', BUDŻET:79000, LIMIT_H:2050, OSTRZEŻENIE_PROC:90, AKTYWNY:'TAK'}
      ]);
    gpReplaceRows_(GP.SHEETS.EVENTS, [
      {ID:'EV-WEEKEND', NAZWA:'Weekend promocyjny', OD:`${month}-10`, DO:`${month}-12`, LOKALIZACJA_ID:'LOC-CENTRUM', MNOŻNIK_ZAPOTRZEBOWANIA:1.3, DODATKOWE_OSOBY:1, UWAGI:'Większy ruch'},
      {ID:'EV-TARGI', NAZWA:'Targi miejskie', OD:`${month}-20`, DO:`${month}-21`, LOKALIZACJA_ID:'LOC-OGRODY', MNOŻNIK_ZAPOTRZEBOWANIA:1.5, DODATKOWE_OSOBY:2, UWAGI:'Dodatkowa zmiana'}
    ]);
    gpAudit_('LOAD_DEMO', 'SYSTEM', month, null, {employees:60, locations:2});
    return {ok:true, month, employees:(useCentrals?gpRows_(GP.SHEETS.EMPLOYEES):employees).length, centralMode:useCentrals, message:'Dane demonstracyjne zostały załadowane.'};
  });
}

function gpGenerateDemoDemand_(month) {
  const start = new Date(`${month}-01T12:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 12);
  const rows = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const date = gpDate_(d), weekend = [0,6].includes(d.getDay());
    ['LOC-CENTRUM','LOC-OGRODY'].forEach(loc => {
      ['RANO','POPOŁUDNIE'].forEach(shift => rows.push({DATA:date, LOKALIZACJA_ID:loc, ZMIANA_ID:shift, MIN_OSÓB:weekend?4:3, OPTYMALNIE_OSÓB:weekend?5:4, MAX_OSÓB:weekend?6:5, STANDBY:1, PRIORYTET:weekend?2:1, ŹRÓDŁO:'DEMO'}));
      if (weekend) rows.push({DATA:date, LOKALIZACJA_ID:loc, ZMIANA_ID:'EXTRA', MIN_OSÓB:1, OPTYMALNIE_OSÓB:2, MAX_OSÓB:3, STANDBY:0, PRIORYTET:2, ŹRÓDŁO:'DEMO'});
    });
  }
  gpReplaceRows_(GP.SHEETS.DEMAND, rows);
}

function gpGenerateDemoAvailability_(month, employees) {
  const rows = [];
  employees.forEach((e, i) => {
    [5+(i%20), 14+(i%10)].forEach(day => rows.push({PRACOWNIK_ID:e.ID, DATA:`${month}-${String(day).padStart(2,'0')}`, OD:'00:00', DO:'23:59', STATUS:'NIEDOSTĘPNY', PREFERENCJA:'', LOKALIZACJA_ID:'', UWAGI:'Przykładowa niedostępność'}));
    rows.push({PRACOWNIK_ID:e.ID, DATA:`${month}-${String(2+(i%25)).padStart(2,'0')}`, OD:i%3===0?'10:00':'17:00', DO:i%3===0?'17:00':'23:59', STATUS:'DOSTĘPNY', PREFERENCJA:'WYSOKA', LOKALIZACJA_ID:e.LOKALIZACJA_BAZOWA||e.DOMYŚLNA_LOKALIZACJA, UWAGI:'Preferowana zmiana'});
  });
  gpReplaceRows_(GP.SHEETS.AVAILABILITY, rows);
}
