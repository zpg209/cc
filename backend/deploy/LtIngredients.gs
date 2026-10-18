/* ===== v59: Lisa's Table > Ingredients (ingredient records, meal/recipe builder, product + label photos) =====
 * NEW FILE for the Apps Script project (add it next to Api.gs), plus 4 lines in Api.gs's action switch (see README "v59").
 * Uses the same Drive + Sheets access the script already has (ltmenusave / bizreceiptsave / ptphotos), so no new authorization.
 *
 * Storage (all created by the first real write, never by a read or a dry run):
 *   Sheet  "Lisa's Table - Ingredients" in the Lisa's Table folder (API_PT.folderId), id kept in script property CC_LTING_SHEET_ID
 *     tab "Ingredients": id | name | brand | serving | calories | protein | carbs | fat | fiber | package size | package price | cost per serving | notes | product photo | label photo | updated | json
 *     tab "Meals":       id | name | servings | components | calories/serving | protein/serving | carbs/serving | fat/serving | fiber/serving | total cost | cost/serving | menu item | updated | json
 *     The json column is what the app reads back; the other columns are for people.
 *   Photos: Lisa's Table > "Ingredient Photos" > "<ingredient name> (<id>)" > "<date> Product.jpg" / "<date> Label.jpg"
 *
 * Actions:
 *   lting                       -> { ingredients:[rec], meals:[rec], sheetUrl, folderUrl, canUpload:true, version:59 }
 *   ltingset  (POST) kind=ingredient|meal, rec=<json string>, cid, dry   upsert by rec.id; an older rec.upd than the stored one is ignored (stale)
 *   ltingdel  (POST) kind, id, name (must match), cid, dry               removes the row (photos stay in Drive)
 *   ltingphoto (POST) ingId, name, slot=product|label, mime=image/jpeg|image/png, data=<base64>, cid, dry
 * Every write needs a cid (idempotency key, journaled like the other actions) and is logged to the Spend sheet journal.
 */
var API_LTING = {
  prop: 'CC_LTING_SHEET_ID', title: "Lisa's Table - Ingredients", photoRoot: 'Ingredient Photos', DESC_TAG: 'CC ltingphoto ',
  MIME: { 'image/jpeg': 'jpg', 'image/png': 'png' }, MAX_BYTES: 8 * 1024 * 1024, MAX_JSON: 20000, MAX_ROWS: 2000,
  tabs: {
    ingredient: { name: 'Ingredients', head: ['id', 'name', 'brand', 'serving', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'package size', 'package price', 'cost per serving', 'notes', 'product photo', 'label photo', 'updated', 'json'] },
    meal: { name: 'Meals', head: ['id', 'name', 'servings', 'components', 'calories/serving', 'protein/serving', 'carbs/serving', 'fat/serving', 'fiber/serving', 'total cost', 'cost/serving', 'menu item', 'updated', 'json'] }
  }
};
function apiLtIngSheet_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(API_LTING.prop), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss && !create) return null;
  if (!ss) {
    ss = SpreadsheetApp.create(API_LTING.title);
    try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(API_PT.folderId)); } catch (e2) {}
    props.setProperty(API_LTING.prop, ss.getId());
  }
  return ss;
}
function apiLtIngTab_(ss, kind, create) {
  var t = API_LTING.tabs[kind], sh = ss.getSheetByName(t.name);
  if (!sh && !create) return null;
  if (!sh) {
    var first = ss.getSheets()[0];
    if (first && first.getName() === 'Sheet1' && first.getLastRow() === 0) { sh = first; sh.setName(t.name); } else sh = ss.insertSheet(t.name);
    sh.getRange(1, 1, 1, t.head.length).setValues([t.head]).setFontWeight('bold'); sh.setFrozenRows(1);
  }
  return sh;
}
function apiLtIngRows_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var w = API_LTING.tabs.ingredient.head.length, v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < v.length; i++) {
    var js = String(v[i][v[i].length - 1] || ''), rec = null;
    try { rec = JSON.parse(js); } catch (e) { rec = null; }
    if (rec && rec.id) { rec._row = i + 2; out.push(rec); }
  }
  return out;
}
function apiLtIngNum_(n) { n = Number(n); return isFinite(n) ? Math.round(n * 100) / 100 : ''; }
function apiLtIngRow_(kind, r) {
  var s = function (v, m) { return String(v == null ? '' : v).substring(0, m || 200); };
  if (kind === 'ingredient') {
    return [s(r.id, 40), s(r.name), s(r.brand), s(r.servingSize, 60), apiLtIngNum_(r.calories), apiLtIngNum_(r.protein), apiLtIngNum_(r.carbs), apiLtIngNum_(r.fat), apiLtIngNum_(r.fiber),
      s(r.packageSize, 60), apiLtIngNum_(r.packagePrice), apiLtIngNum_(r.costPerServing), s(r.notes, 500), s(r.productPhotoUrl, 300), s(r.labelPhotoUrl, 300), s(r.upd ? new Date(Number(r.upd)).toISOString() : '', 40)];
  }
  var t = r.totals || {}, comp = (r.lines || []).map(function (l) { return (l.qty || '') + ' ' + (l.unit || '') + ' ' + (l.name || ''); }).join('; ');
  return [s(r.id, 40), s(r.name), apiLtIngNum_(r.servings), s(comp, 2000), apiLtIngNum_(t.calories), apiLtIngNum_(t.protein), apiLtIngNum_(t.carbs), apiLtIngNum_(t.fat), apiLtIngNum_(t.fiber),
    apiLtIngNum_(t.cost), apiLtIngNum_(t.costPerServing), s(r.menuItem, 200), s(r.upd ? new Date(Number(r.upd)).toISOString() : '', 40)];
}
function apiLtIng_() {
  var ss = apiLtIngSheet_(false), ing = [], meals = [], folderUrl = '';
  if (ss) {
    ing = apiLtIngRows_(apiLtIngTab_(ss, 'ingredient', false));
    meals = apiLtIngRows_(apiLtIngTab_(ss, 'meal', false));
  }
  try { var it = DriveApp.getFolderById(API_PT.folderId).getFoldersByName(API_LTING.photoRoot); if (it.hasNext()) folderUrl = it.next().getUrl(); } catch (e) {}
  ing.forEach(function (r) { delete r._row; }); meals.forEach(function (r) { delete r._row; });
  return { ok: true, data: { canUpload: true, ingredients: ing, meals: meals, sheetUrl: ss ? ss.getUrl() : '', folderUrl: folderUrl, version: 59 } };
}
function apiLtIngKind_(k) { k = String(k || '').toLowerCase(); return k === 'ingredient' || k === 'meal' ? k : null; }
function apiLtIngSet_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80), kind = apiLtIngKind_(p.kind), rec = null;
  if (!kind) return { error: 'bad_value', message: 'kind must be ingredient or meal.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var raw = String(p.rec == null ? '' : p.rec);
  if (raw.length > API_LTING.MAX_JSON) return { error: 'too_big', message: 'The record is too large.' };
  try { rec = JSON.parse(raw); } catch (e) { return { error: 'bad_value', message: 'rec must be JSON.' }; }
  if (!rec || typeof rec !== 'object' || !/^[a-z0-9_-]{3,40}$/i.test(String(rec.id || ''))) return { error: 'bad_value', message: 'rec.id is required.' };
  if (!String(rec.name || '').trim()) return { error: 'bad_value', message: 'rec.name is required.' };
  if (apiAdminHasAcctNo_([rec.name, rec.brand, rec.notes].join(' '))) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  delete rec.photoData; delete rec.photo;                         // photos go through ltingphoto, never into the sheet
  var out = { dry: dry, cid: cid, kind: kind, id: rec.id, version: 59 };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    if (!dry && apiAdminSeenCid_(jss, 'ltingset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var ss = apiLtIngSheet_(!dry), sh = ss ? apiLtIngTab_(ss, kind, !dry) : null, rows = apiLtIngRows_(sh), hit = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === rec.id) { hit = rows[i]; break; }
    if (hit && Number(hit.upd || 0) > Number(rec.upd || 0)) { out.stale = true; out.current = hit; delete hit._row; return { ok: true, data: out }; }
    if (!hit && rows.length >= API_LTING.MAX_ROWS) return { error: 'too_many', message: 'The sheet is full.' };
    out.action = hit ? 'updated' : 'added';
    if (dry) return { ok: true, data: out };
    var json = JSON.stringify(rec), row = apiLtIngRow_(kind, rec).concat([json]);
    if (hit) sh.getRange(hit._row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    out.sheetUrl = ss.getUrl();
    try { apiSpendJournal_(jss, [new Date(), 'ltingset', '', "Lisa's Table " + kind + ': ' + String(rec.name).substring(0, 80), rec.id, out.action, cid]); } catch (e7) { out.journal = 'skipped'; }
    return { ok: true, data: out };
  } catch (werr) {
    return { error: 'write_failed', message: String(werr && werr.message || werr).substring(0, 200) };
  } finally { lock.releaseLock(); }
}
function apiLtIngDel_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80), kind = apiLtIngKind_(p.kind), id = apiAdminClean_(p.id, 40), name = apiAdminClean_(p.name, 200);
  if (!kind) return { error: 'bad_value', message: 'kind must be ingredient or meal.' };
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid, kind: kind, id: id, version: 59 };
    if (!dry && apiAdminSeenCid_(jss, 'ltingdel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var ss = apiLtIngSheet_(false), sh = ss ? apiLtIngTab_(ss, kind, false) : null, rows = apiLtIngRows_(sh), hit = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) { hit = rows[i]; break; }
    if (!hit) { out.action = 'not_found'; return { ok: true, data: out }; }
    if (name && String(hit.name || '').trim().toLowerCase() !== name.toLowerCase()) return { error: 'name_mismatch', message: 'That row has a different name now. Nothing changed.' };
    out.action = 'deleted';
    if (dry) return { ok: true, data: out };
    sh.deleteRow(hit._row);
    try { apiSpendJournal_(jss, [new Date(), 'ltingdel', '', "Lisa's Table " + kind + ' removed: ' + String(hit.name).substring(0, 80), id, '', cid]); } catch (e7) { out.journal = 'skipped'; }
    return { ok: true, data: out };
  } catch (werr) {
    return { error: 'write_failed', message: String(werr && werr.message || werr).substring(0, 200) };
  } finally { lock.releaseLock(); }
}
function apiLtIngPhotoFolder_(ingId, name, create) {
  var root = null, lt = DriveApp.getFolderById(API_PT.folderId), it = lt.getFoldersByName(API_LTING.photoRoot);
  if (it.hasNext()) root = it.next(); else if (create) root = lt.createFolder(API_LTING.photoRoot); else return null;
  var key = '(' + ingId + ')', f = root.getFolders();
  while (f.hasNext()) { var g = f.next(); if (g.getName().indexOf(key) >= 0) return g; }
  if (!create) return null;
  var nm = String(name || 'Ingredient').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60) || 'Ingredient';
  return root.createFolder(nm + ' ' + key);
}
function apiLtIngPhoto_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80), ingId = apiAdminClean_(p.ingId, 40), slot = String(p.slot || '').toLowerCase();
  if (!/^[a-z0-9_-]{3,40}$/i.test(ingId)) return { error: 'bad_value', message: 'ingId is required.' };
  if (slot !== 'product' && slot !== 'label') return { error: 'bad_value', message: 'slot must be product or label.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var mime = String(p.mime || 'image/jpeg').toLowerCase(), ext = API_LTING.MIME[mime];
  if (!ext) return { error: 'bad_value', message: 'mime must be image/jpeg or image/png.' };
  var bytes = null;
  if (p.data != null && String(p.data) !== '') {
    var b64 = String(p.data).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'bad_value', message: 'data must be base64.' };
    try { bytes = Utilities.base64Decode(b64); } catch (e1) { return { error: 'bad_value', message: 'data is not valid base64.' }; }
    if (bytes.length > API_LTING.MAX_BYTES) return { error: 'too_big', message: 'The photo is larger than 8 MB.' };
    var b0 = bytes[0] & 255, b1 = bytes[1] & 255;
    if (bytes.length < 100 || !(ext === 'jpg' ? (b0 === 0xFF && b1 === 0xD8) : (b0 === 0x89 && b1 === 0x50))) return { error: 'bad_value', message: 'data does not match ' + mime + '.' };
  } else if (!dry) return { error: 'bad_value', message: 'data (base64 photo) is required when writing.' };
  var name = apiAdminClean_(p.name, 80), out = { dry: dry, cid: cid, ingId: ingId, slot: slot, version: 59 };
  if (dry) { out.folder = apiLtIngPhotoFolder_(ingId, name, false) ? 'exists' : 'would create'; return { ok: true, data: out }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var fo = apiLtIngPhotoFolder_(ingId, name, true), it = fo.getFiles();
    while (it.hasNext()) { var g = it.next(), d = String(g.getDescription() || '');
      if (d.indexOf(API_LTING.DESC_TAG) === 0 && !g.isTrashed()) { try { if (JSON.parse(d.slice(API_LTING.DESC_TAG.length)).cid === cid) { out.duplicate = 'cid'; out.id = g.getId(); out.url = g.getUrl(); out.name = g.getName(); return { ok: true, data: out }; } } catch (e5) {} } }
    var base = todayKey_() + (slot === 'label' ? ' Label' : ' Product'), nm = base + '.' + ext, k = 2;
    while (fo.getFilesByName(nm).hasNext() && k < 100) { nm = base + ' (' + k + ').' + ext; k++; }
    var file = fo.createFile(Utilities.newBlob(bytes, mime, nm));
    file.setDescription(API_LTING.DESC_TAG + JSON.stringify({ cid: cid, ingId: ingId, slot: slot }));
    out.id = file.getId(); out.url = file.getUrl(); out.name = nm; out.folderUrl = fo.getUrl();
    try { apiSpendJournal_(SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), [new Date(), 'ltingphoto', '', "Lisa's Table ingredient photo: " + nm, ingId, out.id + ' | ' + bytes.length + ' bytes', cid]); } catch (e7) { out.journal = 'skipped'; }
    return { ok: true, data: out };
  } catch (werr) {
    return { error: 'write_failed', message: String(werr && werr.message || werr).substring(0, 200) };
  } finally { lock.releaseLock(); }
}
