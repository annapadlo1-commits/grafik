function gpSheet_(name) {
  const sh = gpSs_().getSheetByName(name);
  if (!sh) throw new Error(`Brak arkusza ${name}. Uruchom instalator.`);
  return sh;
}

function gpRows_(name) {
  const sh = gpSheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(v => v !== '')).map((r, index) => {
    const out = {_row: index + 2};
    headers.forEach((h, i) => out[h] = r[i]);
    return out;
  });
}

function gpAppend_(name, object) {
  const sh = gpSheet_(name);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(headers.map(h => object[h] === undefined ? '' : object[h]));
  return object;
}

function gpReplaceRows_(name, objects) {
  const sh = gpSheet_(name);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (objects.length) {
    sh.getRange(2, 1, objects.length, headers.length)
      .setValues(objects.map(o => headers.map(h => o[h] === undefined ? '' : o[h])));
  }
}

function gpConfig_() {
  const out = {};
  gpRows_(GP.SHEETS.CONFIG).forEach(r => out[String(r.KLUCZ)] = r.WARTOŚĆ);
  return out;
}

function gpAudit_(action, entity, entityId, before, after) {
  gpAppend_(GP.SHEETS.AUDIT, {
    CZAS: gpNow_(),
    UŻYTKOWNIK: Session.getActiveUser().getEmail() || 'demo',
    AKCJA: action,
    ENCJA: entity,
    ENCJA_ID: entityId || '',
    PRZED: before ? JSON.stringify(before) : '',
    PO: after ? JSON.stringify(after) : '',
    KORELACJA_ID: gpId_('AUD')
  });
}

function gpCacheGet_(key) {
  const raw = CacheService.getScriptCache().get(key);
  return raw ? JSON.parse(raw) : null;
}

function gpCachePut_(key, value, seconds) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), seconds || 300);
}

function gpLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function gpCurrentUser_() {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const row = gpRows_(GP.SHEETS.USERS).find(r =>
    String(r.EMAIL).toLowerCase() === email && String(r.AKTYWNY).toUpperCase() !== 'NIE'
  );
  if (row) return {email, role: row.ROLA, employeeId: row.PRACOWNIK_ID, locations: String(row.LOKALIZACJE || '').split(',').filter(Boolean)};
  return {email: email || 'demo@grafikpro.local', role: GP.ROLES.DEMO, employeeId: '', locations: []};
}

function gpRequireRole_(allowed) {
  const user = gpCurrentUser_();
  if (user.role === GP.ROLES.DEMO) return user;
  if (!allowed.includes(user.role)) throw new Error('Brak uprawnień do tej operacji.');
  return user;
}
