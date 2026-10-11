/* ======================================================================= */
/* Family Chase review — action=ccrev / ccrevset (API v57)                 */
/* ======================================================================= */
/*
 * The sheet: "Family Chase 1982 — 2026 Review" (Lisa's Chase Southwest card ending 1982), in
 * Drive > Financial > Bank Accounts > Chase-Personal. Tab "Review", row 1 = headers:
 *   id | date | merchant | amount | type | category | account | status | match note |
 *   review status | reviewed category | reviewed account | review note | reviewed at | auto note | suggested category | account sure | foreign | statement
 * Tab "Card payments": id | date | amount | description | statement.
 *
 * ccrev (read-only): { exists, sheetUrl, cols:[...], rows:[[...]], payCols, pays:[[...]], counts, version:57 }
 * ccrevset (admin): sets the five review columns (review status, reviewed category, reviewed account, review note,
 *   reviewed at) of rows found by id. NOTHING else in the sheet is written: no other column, no other tab, no Vault tab,
 *   no CC write log. GET: id, review, category, account, note, cid [, dry=1]. POST JSON body:
 *   { pc, action:'ccrevset', cid, items:[{ id, review:'Unreviewed'|'Confirmed'|'Changed', category, account, note }] } (max 500).
 *   review = 'Unreviewed' clears the other four fields (Undo). The same cid within 6 h returns the first answer
 *   (CacheService), and every write is idempotent anyway (it sets values, it never appends).
 */
var API_FC = {
  sheetId: '1CQLMaheQMkUf2-emOaF_6UEjemsbcNzvCXiK7gNS33c',
  folderId: '1Qr-LloEiCbuI7vvgSEteCB11hfPDVHk9',          // fallback: find the sheet by name in this folder
  name: 'Family Chase 1982 \u2014 2026 Review',
  tab: 'Review', payTab: 'Card payments',
  review: ['review status', 'reviewed category', 'reviewed account', 'review note', 'reviewed at'],
  statuses: ['Unreviewed', 'Confirmed', 'Changed'],
  accounts: ['Household', 'TiwiK', 'KiwiT'],
  maxBatch: 500, version: 57
};

function apiFcOpen_() {
  var ss = null;
  try { ss = SpreadsheetApp.openById(API_FC.sheetId); } catch (e) { ss = null; }
  if (!ss) {
    try {
      var it = DriveApp.getFolderById(API_FC.folderId).getFilesByName(API_FC.name);
      while (it.hasNext()) { var f = it.next(); if (f.getMimeType() === MimeType.GOOGLE_SHEETS) { ss = SpreadsheetApp.openById(f.getId()); break; } }
    } catch (e2) { ss = null; }
  }
  if (!ss) return null;
  var sh = ss.getSheetByName(API_FC.tab) || ss.getSheets()[0];
  return { ss: ss, sh: sh };
}
function apiFcCell_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, CONFIG.TIME_ZONE, 'yyyy-MM-dd');
  if (typeof v === 'number') return v;
  return String(v == null ? '' : v);
}
function apiFcHead_(row) { return row.map(function (h) { return String(h || '').trim().toLowerCase(); }); }

/** action=ccrev (read-only) */
function apiCcRev_(p) {
  var w = apiFcOpen_();
  if (!w) return { ok: true, data: { exists: false, version: API_FC.version } };
  var vals = w.sh.getDataRange().getValues();
  if (!vals.length) return { ok: true, data: { exists: true, sheetUrl: w.ss.getUrl(), cols: [], rows: [], version: API_FC.version } };
  var cols = apiFcHead_(vals[0]), rows = [], counts = {};
  for (var i = 1; i < vals.length; i++) {
    if (!String(vals[i][0] || '').trim()) continue;
    var r = vals[i].map(apiFcCell_);
    rows.push(r);
    var st = String(r[cols.indexOf('review status')] || 'Unreviewed') || 'Unreviewed';
    counts[st] = (counts[st] || 0) + 1;
  }
  var pcols = [], pays = [], ps = w.ss.getSheetByName(API_FC.payTab);
  if (ps) {
    var pv = ps.getDataRange().getValues();
    if (pv.length) { pcols = apiFcHead_(pv[0]); for (var j = 1; j < pv.length; j++) if (String(pv[j][0] || '').trim()) pays.push(pv[j].map(apiFcCell_)); }
  }
  return { ok: true, data: { exists: true, sheetUrl: w.ss.getUrl(), cols: cols, rows: rows, payCols: pcols, pays: pays, counts: counts, total: rows.length, version: API_FC.version } };
}

function apiFcText_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;            // never a formula
}

/** action=ccrevset (admin; writes ONLY the review columns of the Review tab) */
function apiCcRevSet_(p) {
  p = p || {};
  var cid = String(p.cid || '').slice(0, 80), dry = String(p.dry || '') === '1' || p.dry === true;
  if (!cid) return { error: 'bad_value', message: 'cid is required' };
  var items = Array.isArray(p.items) ? p.items : (p.id ? [{ id: p.id, review: p.review, category: p.category, account: p.account, note: p.note }] : []);
  if (!items.length) return { error: 'bad_value', message: 'no items' };
  if (items.length > API_FC.maxBatch) return { error: 'bad_value', message: 'at most ' + API_FC.maxBatch + ' items per call' };
  var clean = [];
  for (var k = 0; k < items.length; k++) {
    var it = items[k] || {}, id = String(it.id || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return { error: 'bad_value', message: 'bad id: ' + id };
    var rv = String(it.review || '').trim();
    if (API_FC.statuses.indexOf(rv) < 0) return { error: 'bad_value', message: 'review must be ' + API_FC.statuses.join(' | ') };
    var acct = String(it.account || '').trim();
    if (acct && API_FC.accounts.indexOf(acct) < 0) return { error: 'bad_value', message: 'account must be ' + API_FC.accounts.join(' | ') };
    clean.push({ id: id, review: rv, category: apiFcText_(it.category, 60), account: acct, note: apiFcText_(it.note, 500) });
  }
  var cache = CacheService.getScriptCache(), ck = 'cc_fc_cid_' + cid;
  if (!dry) { var prev = cache.get(ck); if (prev) { try { var o = JSON.parse(prev); o.duplicate = 'cid'; return { ok: true, data: o }; } catch (e) {} } }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { error: 'busy', message: 'Another save is running; try again.' };
  try {
    var w = apiFcOpen_();
    if (!w) return { error: 'not_found', message: 'Review sheet not found' };
    var sh = w.sh, last = sh.getLastRow(), lastCol = sh.getLastColumn();
    var head = apiFcHead_(sh.getRange(1, 1, 1, lastCol).getValues()[0]);
    var ci = API_FC.review.map(function (h) { return head.indexOf(h); });
    if (ci.some(function (c) { return c < 0; })) return { error: 'no_columns', message: 'Missing column(s): ' + API_FC.review.filter(function (h, i) { return ci[i] < 0; }).join(', ') };
    var c0 = Math.min.apply(null, ci), c1 = Math.max.apply(null, ci);
    if (c1 - c0 !== 4) return { error: 'no_columns', message: 'The five review columns must be side by side' };
    var ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
    var at = {}; ids.forEach(function (id, i) { if (id && at[id] == null) at[id] = i; });
    var missing = clean.filter(function (x) { return at[x.id] == null; }).map(function (x) { return x.id; });
    if (missing.length) return { error: 'not_found', message: 'Unknown id(s): ' + missing.slice(0, 10).join(', ') };
    var stamp = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm');
    var out = { dry: dry, cid: cid, updated: clean.length, at: stamp, items: [], version: API_FC.version };
    var rIdx = clean.map(function (x) { return at[x.id]; }), lo = Math.min.apply(null, rIdx), hi = Math.max.apply(null, rIdx);
    var rng = sh.getRange(2 + lo, c0 + 1, hi - lo + 1, 5), block = rng.getValues();
    clean.forEach(function (x) {
      var vals = x.review === 'Unreviewed' ? ['Unreviewed', '', '', '', ''] : [x.review, x.category, x.account, x.note, stamp];
      var order = API_FC.review.map(function (h, i) { return { c: ci[i] - c0, v: vals[i] }; });
      order.forEach(function (o) { block[at[x.id] - lo][o.c] = o.v; });
      out.items.push({ id: x.id, review: vals[0], category: vals[1], account: vals[2], note: vals[3], at: vals[4] });
    });
    if (!dry) {
      rng.setNumberFormat('@').setValues(block);
      SpreadsheetApp.flush();
      try { cache.put(ck, JSON.stringify(out), 21600); } catch (e) {}
    }
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}
