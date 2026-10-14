/* ======================================================================== */
/* workoutset (API v58) — OVERWRITE one day's workout on the Phone Log row.  */
/*   action=workoutset&date=YYYY-MM-DD&workout=<text or blank>               */
/*     &workout_min=<N or blank>&hike_miles=<N or blank>                     */
/*     &details=<'; '-joined workout details or blank>&cid=<id>[&dry=1]      */
/*   Unlike logday, a param that is SENT but blank CLEARS the cell, and the  */
/*   day's Notes are rewritten: every " | "-separated "Workout: ..." /        */
/*   "Workout details: ..." segment is removed and (if details is non-blank) */
/*   one "Workout: <details>" segment is added; all other notes stay as-is.   */
/*   Params that are NOT sent are left alone. "Workout today?" follows the    */
/*   workout text (Y, N for rest/none, blank when cleared). Same passcode,    */
/*   LockService, cid cache (6 h), daily backup and CC write log as logday.   */
/*   Needs the existing Api.gs helpers: CONFIG.FITNESS, apiLogRead_,          */
/*   apiLogBackup_, apiLogJournal_, todayKey_, toKey_, keyToDate_,            */
/*   dateToKey_, toNum_, apiLogDaysBetween_, API_LOGDAY_CFG.                  */
/* ======================================================================== */
function apiWorkoutSet_(p) {
  var C = API_LOGDAY_CFG;
  function sent(k) { return p[k] !== undefined && p[k] !== null; }
  function blank(k) { return String(p[k]).trim() === ''; }
  var key = sent('date') && !blank('date') ? String(p.date).trim() : todayKey_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || toKey_(key) !== key || dateToKey_(keyToDate_(key)) !== key) return { error: 'bad_value', message: 'date must be YYYY-MM-DD.' };
  var today = todayKey_();
  if (key > today && apiLogDaysBetween_(today, key) > 1) return { error: 'bad_value', message: 'date is in the future.' };
  if (apiLogDaysBetween_(key, today) > C.maxDaysBack) return { error: 'bad_value', message: 'date is too far in the past.' };

  var writes = [], bad = null;
  if (sent('workout')) writes.push({ field: 'workoutType', kind: 'text', value: String(p.workout).trim().slice(0, 200) });
  [['workout_min', 'workoutMinutes', 1000], ['hike_miles', 'hike', 100]].forEach(function (s) {
    if (!sent(s[0])) return;
    if (blank(s[0])) { writes.push({ field: s[1], kind: 'num', value: '' }); return; }
    var n = Number(String(p[s[0]]).replace(/,/g, ''));
    if (!isFinite(n) || n < 0 || n > s[2]) { bad = s[0] + ' must be a number 0-' + s[2] + ' or blank.'; return; }
    writes.push({ field: s[1], kind: 'num', value: Math.round(n * 10) / 10 });
  });
  var setNotes = sent('details');
  if (bad) return { error: 'bad_value', message: bad };
  if (!writes.length && !setNotes) return { error: 'bad_value', message: 'Nothing to write. Send workout, workout_min, hike_miles and/or details (blank clears).' };
  var dry = String(p.dry || '') === '1';

  var cid = String(p.cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var cache = CacheService.getScriptCache(), ck = cid ? 'cc_woset_' + cid : '';
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    if (ck && !dry) { var seen = cache.get(ck); if (seen) { var pj = JSON.parse(seen); pj.duplicate = true; return { ok: true, data: pj }; } }
    var cfg = CONFIG.FITNESS, ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) throw new Error('Phone Log tab not found.');
    var rd = apiLogRead_();
    for (var i = 0; i < writes.length; i++) {
      if (rd.col[writes[i].field] < 0 && !(writes[i].value === '' )) return { error: 'no_column', message: 'The Phone Log has no column for "' + writes[i].field + '".' };
    }
    writes = writes.filter(function (w) { return rd.col[w.field] >= 0; });   // clearing a column that does not exist = nothing to do
    if (setNotes && rd.col.notes < 0) return { error: 'no_column', message: 'The Phone Log has no Notes column.' };
    var rec = rd.byDay[key];
    var result = { date: key, written: {}, version: 58, dry: dry };
    if (!rec) {   // no row for that day: only a non-blank write needs one; otherwise nothing to clear
      var any = writes.some(function (w) { return w.value !== ''; }) || (setNotes && !blank('details'));
      if (!any) { result.noRow = true; return { ok: true, data: result }; }
      if (dry) { result.wouldCreate = true; return { ok: true, data: result }; }
      // reuse logday to create the row with the non-blank values (it writes date / timestamp / formats the same way)
      var lp = { date: key, cid: cid ? cid + 'c' : '' };
      writes.forEach(function (w) { if (w.value === '') return; if (w.field === 'workoutType') lp.workout = w.value; else if (w.field === 'workoutMinutes') lp.workout_min = w.value; else lp.hike_miles = w.value; });
      if (setNotes && !blank('details')) lp.notes = 'Workout: ' + String(p.details).replace(/[|]/g, '/').trim().slice(0, 1000);
      lock.releaseLock(); lock = null;
      var lr = apiLogDay_(lp);
      if (lr.ok) { lr.data.version = 58; lr.data.via = 'logday'; if (ck) cache.put(ck, JSON.stringify(lr.data), 21600); }
      return lr;
    }
    // The Phone Log can hold several rows for one date (apiLogRead_ merges them, newest non-blank wins), so the value goes into the
    // newest row and the same cells of every OLDER row of that date are blanked; otherwise an old value would show through.
    var rowNum = rec.row, journal = [], dayRows = [];
    for (var r = 1; r < rd.values.length; r++) {
      var k2 = rd.col.date >= 0 ? toKey_(rd.values[r][rd.col.date]) : '';
      if (!k2 && rd.col.timestamp >= 0) k2 = toKey_(rd.values[r][rd.col.timestamp]);
      if (k2 === key) dayRows.push(r + 1);
    }
    if (dayRows.indexOf(rowNum) < 0) dayRows.push(rowNum);
    function cellAt(row, c) { var v = rd.values[row - 1]; return c >= 0 && v && v.length > c ? v[c] : ''; }
    function clip(v) { v = String(v == null ? '' : v); return v.length > 200 ? v.slice(0, 200) + '…' : v; }
    function cellOf(field) { return cellAt(rowNum, rd.col[field]); }
    var plan = [];
    writes.forEach(function (w) {
      dayRows.forEach(function (row) {
        var raw = cellAt(row, rd.col[w.field]), before = String(raw == null ? '' : raw).trim();
        plan.push({ row: row, col: rd.col[w.field], field: w.field, before: before, after: row === rowNum ? w.value : '' });
      });
    });
    if (setNotes) {
      var det = String(p.details).replace(/[|]/g, '/').trim().slice(0, 1000);
      dayRows.forEach(function (row) {
        var oldN = String(cellAt(row, rd.col.notes) == null ? '' : cellAt(row, rd.col.notes)).trim();
        var keep = oldN ? oldN.split(/\s*\|\s*/).filter(function (s) { return s && !/^Workout(?: details)?\s*:/i.test(s.trim()); }) : [];
        if (det && row === rowNum) keep.push('Workout: ' + det);
        plan.push({ row: row, col: rd.col.notes, field: 'notes', before: oldN, after: keep.join(' | ').slice(0, C.maxNotesLen) });
      });
    }
    var wtCol = rd.col.workoutToday, wtW = writes.filter(function (w) { return w.field === 'workoutType'; })[0];
    if (wtW && wtCol >= 0) {
      var wt = wtW.value === '' ? '' : (/^\s*(rest|none|off)\b/i.test(wtW.value) ? 'N' : 'Y'), oldWt = String(cellOf('workoutToday') || '').trim();
      dayRows.forEach(function (row) { plan.push({ row: row, col: wtCol, field: 'workoutToday', before: String(cellAt(row, wtCol) || '').trim(), after: row === rowNum ? wt : '' }); });
    }
    plan = plan.filter(function (x) { return String(x.before) !== String(x.after); });
    result.row = rowNum;
    result.rows = dayRows;
    plan.forEach(function (x) { result.written[x.field + (x.row === rowNum ? '' : '@' + x.row)] = { before: clip(x.before), after: clip(x.after) }; });
    if (dry || !plan.length) return { ok: true, data: result };
    apiLogBackup_(ss, sh);           // throws on failure -> nothing is written
    plan.forEach(function (x) {
      sh.getRange(x.row, x.col + 1).setValue(x.after);
      journal.push([new Date(), 'workoutset', x.row, x.field, clip(x.before), clip(x.after), cid]);
    });
    SpreadsheetApp.flush();
    journal.forEach(function (j) { apiLogJournal_(ss, j); });
    if (ck) cache.put(ck, JSON.stringify(result), 21600);
    return { ok: true, data: result };
  } finally {
    if (lock) lock.releaseLock();
  }
}
