// Command Center API v59 (2026-10-18): v55 + zac-lists (v56) + lisa-trade-ptphotos (v56) + family-chase (v57, FamilyChase.gs) + workout-set (v58, WorkoutSet.gs) + Lisa's Table Ingredients (v59, LtIngredients.gs).
var API_VERSION = 59;
/**
 * Command Center — JSON data API for the GitHub Pages front end (https://zpg209.github.io/cc/).
 *
 * Deployed as a SEPARATE web app deployment: Execute as Me, Who has access: Anyone.
 * Every request must carry the passcode stored in Script Properties (key CC_PASSCODE).
 * The passcode is never stored in source code.
 *
 *   GET  <exec>?api=1&pc=123456&action=links
 *   GET  <exec>?api=1&pc=123456&action=log&offset=-1
 *        (v26: ext.totals = month-to-date + all-time running totals over the whole Phone Log, ext.history items also carry `minutes`; see LOGSPLIT_CHANGE.md)
 *   GET  <exec>?api=1&pc=123456&action=spend&offset=0
 *   GET  <exec>?api=1&pc=123456&action=accounts          (Vault > Accounts: balances + reconciliation; v44: every account has kind 'bank'|'card'|'app' (Kind column of the Accounts tab, else inferred from Type / name, else bank).
 *        RAW per account: balance, prevBalance, change, entries[].balance (a card's balance is the amount OWED, positive). NET (cards subtracted, apps counted as cash): groups[].total/prevTotal/change, total/prevTotal/change,
 *        reconciliation[].balanceChange/expected/gap. New: groups[].cash/owed and cash/owed at the top level (cash = banks + apps, owed = sum of card balances, total = cash - owed))
 *   GET  <exec>?api=1&pc=123456&action=acctadd&name=Chase%20Visa&entity=Household|TiwiK|KiwiT&kind=bank|card|app&cid=abc[&balance=1200.50][&asof=2026-10-04][&note=..][&bank=..][&type=..][&purpose=..][&dry=1]   (admin v44+: append ONE account row to the Accounts tab (adds a "Kind" column at the end if missing); with balance also adds the first Balances row (asof defaults to today); card balance = amount owed (positive); Sierra is rejected; an existing account name is rejected (use balset))
 *   GET  <exec>?api=1&pc=123456&action=suggest[&n=12]   (v52 Home tasks: open items from the "Project Tasks — Master" Sheet for the Home Suggestions box {items:[{id,text,project,due,priority}]}, overdue/high first; read-only)
 *   GET  <exec>?api=1&pc=123456&action=filebytes&id=<driveFileId>   (v48 doc share: original bytes of one Second Brain file as base64 {name,mimeType,size,b64,url,converted}; Google Docs/Sheets/Slides/Drawings exported as PDF; 20 MB cap; read-only)
 *   GET  <exec>?api=1&pc=123456&action=invest   (v49 Investments: {accts:{etrade,af,crypto}} each {type,balance,asof,holdings[{ticker,name,shares,value}],notes,updated}; read-only)
 *   POST {pc, action:'investsave', acct:'etrade'|'af'|'crypto', json:'<account object>', updated:<ms>}   (v49: replace ONE account; newer `updated` wins; account numbers rejected)
 *   GET  <exec>?api=1&pc=123456&action=spendcol   (admin: create the Daily Spend "Paid from" column I + dropdown if missing; idempotent)
 *   GET  <exec>?api=1&pc=123456&action=lists   (v56 project lists: {lists:{<slug>:{slug,items[{id,text,note,done,doneAt,updated,del}],order[],orderAt,updated}}, version:56}; read-only)
 *   POST {pc, action:'listsave', slug:'garage', json:'<list object>'}   (v56: MERGE one list into the stored copy (per item newest `updated` wins, order from the newest reorder) and return the merged list)
 *   GET  <exec>?api=1&pc=123456&action=spendfix&date=2026-09-27&amount=400&merchant=Wagner&paid_from=Cash[&notes=..][&category=..][&account=..][&row=N][&dry=1]   (admin: set Paid from / notes / category on ONE matched Daily Spend row)
 *   GET  <exec>?api=1&pc=123456&action=spendadd&date=2026-10-02&amount=7.5&merchant=Bagel%20shop&category=Dining&account=Household&who=Zac&cid=abc[&paid_from=..][&method=Cash|Credit|Debit|Venmo|Zelle|Check|ACH/Transfer|Other][&notes=..][&dry=1]   (admin v31+: add ONE Daily Spend row; see SPENDADD_CHANGE.md; v42: method = the sheet's Method dropdown + Venmo/Zelle/Check, 'Credit card' = Credit; a value missing from the dropdown is added to it)
 *   GET  <exec>?api=1&pc=123456&action=spenddel&row=57&date=2026-10-02&amount=7.5&merchant=Bagel%20shop&cid=abc[&dry=1]   (admin v34+: delete ONE Daily Spend row; row is verified against date+amount+merchant, else row_mismatch; see SPENDDEL_CHANGE.md)
 *   GET  <exec>?api=1&pc=123456&action=incomedel&tab=income|ls|pt&row=9&date=2026-10-02&amount=3000&label=KiwiT%20rent&cid=abc[&dry=1][&prune_source=1]   (admin v34+: delete ONE row of the Income / Land & Structure Pay / Personal Training tab; same verification; prune_source=1 also drops an unused, unprotected Source from the Income Source dropdown)
 *   GET  <exec>?api=1&pc=123456&action=ltmacroset&item=Breakfast%20Burrito&cal=480&protein=24&carbs=30&fat=29[&serving=1%20burrito][&notes=..][&row=N]&cid=abc[&dry=1]   (admin: record MEASURED macros for ONE existing Menu Macros row; sets Basis to 'Measured YYYY-MM-DD'; never adds rows; ltmacros items now carry row + measured)
 *   GET  <exec>?api=1&pc=123456&action=menuitemadd&item=Lemon%20Bars&category=Snack&serving=1%20bar&ingredients=..[&cal=..&protein=..&carbs=..&fat=..]&cid=abc[&dry=1]   (admin: add ONE new row to the Menu Macros sheet as 'Estimate — to be measured'; rejects duplicate names)
 *   GET  <exec>?api=1&pc=123456&action=ltpriceset&item=Taco%20Salad&price=14&cid=abc[&dry=1]   (admin v40+: set the Price of ONE Menu Macros item; bulk: POST {"action":"ltpriceset","cid":..,"dry":1,"prices":[{"item":..,"price":..}]}; '' clears; 0-500; the 'Price' column is created as the new last column by the first real write; ltmacros items carry numeric `price` or null)
 *   GET  <exec>?api=1&pc=123456&action=orders[&week=2026-10-05]   (v40+: Lisa's Table orders, read-only, creates nothing; {exists,sheetUrl,weeks:[..],totals,clients:[{name,orders,last}],orders:[..],menu:[..]}; v41: every order/week carries deliveryFee, payStatus/payMethod and paid/unpaid/trade/byMethod/deliveryTotal aggregates)
 *   POST <exec>  body {"pc":..,"action":"orderset","cid":..,"week":"2026-10-05","client":"..","lines":[{"item":..,"qty":2,"price":14}][,"deliveryFee":0|3|5][,"payStatus":"paid|unpaid|trade"][,"payMethod":"cash|zelle|venmo"][,"paid":true][,"orderId":"o.."][,"dry":1]}   (admin v40+: create/replace ONE client's order; v41: delivery fee + payment status/method; sheet "Lisa's Table - Orders" is created in the Lisa's Table folder by the first write)
 *   GET  <exec>?api=1&pc=123456&action=orderpaid&orderId=o..&payStatus=paid|unpaid|trade[&payMethod=cash|zelle|venmo]&cid=abc[&dry=1] (or the old paid=true|false)   |   action=orderdel&orderId=o..&cid=abc[&dry=1]   (admin v40+: set an order's payment (v41: paid/unpaid/trade + cash/zelle/venmo); soft-delete an order)
 *   POST <exec>  body {"pc":..,"action":"weekmenuset","cid":..,"week":"2026-10-05","items":[{"item":..,"price":14}][,"dry":1]}   (admin v40+: save the menu chosen for a week (Week Menus tab); replaces that week's rows)
 *   GET  <exec>?api=1&pc=123456&action=menusave&week=2026-10-05&deliver=2026-10-06&items=%5B%7B%22name%22%3A%22Taco%20Salad%22%2C%22price%22%3A%2214%22%2C%22desc%22%3A%22romaine%2C%20beef%22%7D%5D&cid=abc[&dry=1]   (admin: create a Google Doc 'Menu - <week>' in Drive > Menu Designs; never overwrites, appends ' (2)')
 *   POST <exec>  body (text/plain JSON) {"pc":..,"action":"ltmenusave","cid":"abc","name":"Lisa's Table Menu 2026-10-12.pdf","week":"2026-10-12","data":"<base64 PDF>"[,"dry":1]}   (admin v53: file a menu PDF made on the phone in Drive > Lisa's Table > Past Menus; never overwrites, appends ' (2)'; the same cid never files twice)
 *   GET  <exec>?api=1&pc=123456&action=wishlist   (v36+: Lisa's Table Wish List, shared phone list; read-only, creates nothing; {items:[{id,row,added,item,notes,status:'open'|'done',by,doneOn}],open,done,sheetUrl}; open newest first, then done)
 *   GET  <exec>?api=1&pc=123456&action=wishadd&items=%5B%22milk%22%2C%22eggs%22%5D[&by=Lisa|Zac][&notes=..]&cid=abc[&dry=1]   (admin v36+: add up to 30 items (<=200 chars each; or item=<one>); skips loose duplicates of OPEN items; sheet "Wish List" is created in the Lisa's Table Drive folder on the first write)
 *   GET  <exec>?api=1&pc=123456&action=wishset&id=w123&status=done|open&cid=abc[&dry=1]   (admin v36+: mark a wish done (Done on = today) or open again; no status = toggle)
 *   GET  <exec>?api=1&pc=123456&action=wishdel&id=w123&item=milk&cid=abc[&dry=1]   (admin v36+: delete ONE wish row; row is verified against the id + item text, else row_mismatch)
 *   GET  <exec>?api=1&pc=123456&action=ptclients   (v45+: Lisa's Personal Training, read-only, creates nothing; {exists,sheetUrl,counts:{total,active,paused},orphans,clients:[{id,row,name,age,phone,email,condition,ailments,goals,experience,medications,schedule,status:'active'|'paused',startDate,notes,created,updated,workoutCount,doneCount,lastWorkout,workouts:[{id,row,clientId,date,title,exercises,notes,done,doneOn,created,updated}]}]}; active clients first, A-Z; workouts newest first)
 *   GET  <exec>?api=1&pc=123456&action=ptclientset[&id=pc..]&name=..[&age=..&phone=..&email=..&condition=..&ailments=..&goals=..&experience=..&medications=..&schedule=..&status=active|paused&startDate=yyyy-mm-dd&notes=..]&cid=abc[&dry=1]   (admin v45+: create a client (no id; name required) or update ONLY the sent fields of one (id); "" clears a field; sheet "Lisa's Personal Training" (tabs Clients + Workouts) is created in the Lisa's Table Drive folder on the first real write; caps: name 80, condition 300, long fields 1000-2000, 300 clients; duplicate names refused)
 *   GET  <exec>?api=1&pc=123456&action=ptclientdel&id=pc..&name=..&cid=abc[&dry=1]   (admin v45+: delete ONE client AND their workouts; id + name are verified (row_mismatch), backups of both tabs, rolled back on failure)
 *   POST <exec>  body {"pc":..,"action":"ptworkoutset","cid":..,["id":"pw..",]"clientId":"pc..","date":"2026-10-05","title":"..","exercises":"text" | ["line","line"] | [{..}],"notes":"..","done":0|1[,"dry":1]}   (admin v45+: create (clientId + title) or update ONLY the sent fields (id) of one workout; done:1 sets Done on = today; <=500 workouts per client; also works as GET params)
 *   GET  <exec>?api=1&pc=123456&action=ptworkoutdel&id=pw..&title=..&cid=abc[&dry=1]   (admin v45+: delete ONE workout; id + title verified)
 *   GET  <exec>?api=1&pc=123456&action=lisareqlist   (v54: Lisa's change requests, read-only; {items:[{id,row,submitted,section:'lt'|'pt'|'both',sectionLabel,request,status:'New'|'In progress'|'Needs your OK'|'Done',reply,updated}],counts,sheetUrl}, newest first; sheet 'Lisa Change Requests' in Lisa's Table)
 *   POST <exec>  body {"pc":..,"action":"lisareq","id":"lr..","text":"..","section":"lt|pt|both"[,"ts":<ms>][,"dry":1]}   (v54: append ONE change request (Status New); the id never adds twice)
 *   GET  <exec>?api=1&pc=123456&action=lisareqset&id=lr..[&status=New|In%20progress|Needs%20your%20OK|Done][&reply=..][&reply_mode=append][&dry=1]   (v54, for Lisa's Assistant: set Status / Reply (+ Updated) of ONE request; POST for long replies)  |  action=lisareqdel&id=lr..  (test cleanup: only rows whose Request starts with TEST)
 *   GET  <exec>?api=1&pc=123456&action=bizreceipts   (v55: read-only; {canUpload:true, ents:{kiwit|tiwik:{folderId,folderUrl,count}}, version:55}; the phone uses it to switch "Add receipt" from Drive to the camera)
 *   POST <exec>  body (text/plain JSON) {"pc":..,"action":"bizreceiptsave","cid":"abc","ent":"kiwit|tiwik","date":"2026-10-09","amount":"42.50","merchant":"..","mime":"image/jpeg|image/png|application/pdf","data":"<base64>"[,"dry":1]}   (admin v55: file ONE receipt in <entity> > Expenses > Receipts; never overwrites; the same cid never files twice)
 *   GET  <exec>?api=1&pc=123456&action=entity&entity=kiwit|tiwik&offset=0   (KiwiT LLC / TiwiK LLC separate books for one month; read-only)
 *   GET  <exec>?api=1&pc=123456&action=entitytax&entity=kiwit|tiwik&year=2026[&format=csv]   (year-to-date category summary for taxes; csv = {csv, filename})
 *   GET  <exec>?api=1&pc=123456&action=logadd&value=8&cid=abc   (Daily log: water +8 oz on today's row; also logset&field=weight|sleep|steps|hike&value=N; v43: optional &date=YYYY-MM-DD writes that past day's row instead of today's, same limits as logday: not > 1 day ahead, not > 400 days back)
 *   GET  <exec>?api=1&pc=123456&action=logday&date=2026-10-01&calories=2935&protein=217&carbs=115&fat=167&workout=Strength&workout_min=30&hike_miles=2&notes=...&cid=abc   (Daily log: upsert one day's Phone Log row; mode=add|set for macros)
 *   GET  <exec>?api=1&pc=123456&action=lognote&text=...&cid=abc   (Daily log > Dictate: appends a voice/typed note to the "Voice notes" tab of the fitness sheet)
 *   GET  <exec>?api=1&pc=123456&action=fiberbackfill&dry=1   (v50 fh-fiber-backfill: Phone Log "Fiber (g)" from the Notes "[Fiber: N g]" tags; dry=1 previews,
 *        without dry it adds the column if missing and fills EMPTY Fiber cells only (force=1 also replaces a different value). Notes / macros untouched.)
 *   GET  <exec>?api=1&pc=123456&action=lognotes          (recent voice notes, newest first; read-only)
 *        (v50 fh-fiber-notes: log ext.history[] items also carry fiber/sugar/sodium and notes; ext.notesInHistory, ext.write.fiber, ext.columns.fiber/sugar/sodium;
 *         logday also takes fiber= (g), sugar= (g), sodium= (mg) with mode=add|set; a missing "Fiber (g)" / "Sugar (g)" / "Sodium (mg)" column is added at the END on its first value)
 *   GET  <exec>?api=1&pc=123456&action=vaultdebt         (Vault > Debt + Upcoming bills (next 30 days); v30: from the "Debts" + "Bills" tabs of the Daily Spend sheet, falls back to the Overview Doc until the tabs are seeded)
 *   GET  <exec>?api=1&pc=123456&action=debttabs&dry=1    (admin v30: create + seed the Debts and Bills tabs from the current Overview Doc values; idempotent; also debtset, billadd, billpaid, billdel, debtdel, see DEBTTABS_CHANGE.md)
 *   POST <exec>  body (Content-Type text/plain): {"pc":"123456","action":"log","offset":0}
 *   POST <exec>  body (text/plain JSON) {"pc":..,"action":"receiptsave","cid":"abc","kind":"expense|income","account":"Household|TiwiK|KiwiT","date":"2026-10-03","amount":12.5,"merchant":"..","note":"..","mime":"image/jpeg","data":"<base64 JPEG>"[,"dry":1]}   (admin v33+: file a receipt photo in Drive under Financial/Expenses/<Account>/<YYYY>/<MM>; see RECEIPTS_CHANGE.md)
 *   GET  <exec>?api=1&pc=123456&action=healthmetrics     (v51 Fitness & Health > Medical: rows of the "Health Metrics" sheet {version,sheetId,url,tab,columns,metrics:[{row,metric,value,unit,range,date,source,levers,notes}]}; read-only, creates nothing)
 *   GET  <exec>?api=1&pc=123456&action=healthmetricset[&row=N&was=<metric now in row N>]&metric=..[&value=..&unit=..&range=..&date=..&source=..&levers=..&notes=..]&cid=abc[&dry=1]   (admin v51: append ONE metric (no row; metric required) or update ONLY the sent fields of row N; "" clears a field; plain-text cells; LockService + cid retry-safe; deletes nothing)
 *   GET  <exec>?api=1&pc=123456&action=receipts[&offset=0|&month=2026-10][&kind=expense|income][&account=..][&limit=50]   (v33+: receipt photos filed for a month; read-only, never creates folders)
 *
 * Responses are JSON. Bad/missing passcode -> {"error":"auth"} with no data.
 * Too many bad attempts in 10 minutes -> {"error":"locked"} (brute-force guard).
 */

var API_MAX_FAILS = 25;          // bad passcodes allowed per window (all callers combined)
var API_FAIL_WINDOW_SEC = 600;   // 10 minutes

/** Called from doGet in Code.gs when e.parameter.api is present. */
function handleApi_(e) {
  var p = (e && e.parameter) || {};
  return apiRespond_(apiDispatch_(p.pc, p.action, p.offset, p.id, { project: p.project, text: p.text, page: p.page, index: p.index, done: p.done, cid: p.cid, at: p.at, field: p.field, value: p.value, all: p }));
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}') || {}; } catch (err) { body = {}; }
  return apiRespond_(apiDispatch_(body.pc, body.action, body.offset, body.id, { project: body.project, text: body.text, page: body.page, index: body.index, done: body.done, cid: body.cid, at: body.at, field: body.field, value: body.value, all: body }));
}

function apiDispatch_(pc, action, offset, id, extra) {
  extra = extra || {};
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('cc_api_fails') || 0);
  if (fails >= API_MAX_FAILS) return { error: 'locked' };

  var expected = PropertiesService.getScriptProperties().getProperty('CC_PASSCODE');
  if (!expected || !safeEqual_(String(pc == null ? '' : pc), String(expected))) {
    cache.put('cc_api_fails', String(fails + 1), API_FAIL_WINDOW_SEC);
    return { error: 'auth' };
  }

  try {
    var off = Math.max(-520, Math.min(520, parseInt(offset, 10) || 0));
    switch (String(action || '')) {
      case 'ping':  return { ok: true };
      case 'links': return { ok: true, data: getLinks() };
      case 'log':   return { ok: true, data: apiLog_(off) };
      case 'spend': return { ok: true, data: apiSpend_(off) };
      case 'accounts': return { ok: true, data: apiAccounts_() };
      case 'spendcol': return apiSpendCol_();
      case 'spendfix': return apiSpendFix_(extra.all || {});
      case 'spendadd': return apiSpendAdd_(extra.all || {});
      case 'entity': { if (!apiEntCfg_(extra.all && extra.all.entity)) return { error: 'bad_entity' }; return { ok: true, data: apiEntity_(extra.all.entity, off) }; }
      case 'entitytax': { if (!apiEntCfg_(extra.all && extra.all.entity)) return { error: 'bad_entity' }; return { ok: true, data: apiEntityTax_(extra.all.entity, extra.all.year, extra.all.format) }; }
      case 'vaultdebt': return { ok: true, data: apiVaultDebt_() };
      case 'biz':   return { ok: true, data: apiBiz_() };
      case 'suggest': return { ok: true, data: apiSuggest_(extra && extra.all && extra.all.n) };   // v52 (Home tasks): Suggestions box on Home (read-only)
      case 'file':  return apiFile_(id);
      case 'filebytes': return apiFileBytes_(id);   // v48 (doc share): original bytes of one Drive file for the phone share sheet / Save
      case 'folder': return apiFolder_(id);
      case 're':    return { ok: true, data: apiRe_() };
      case 'ins':   return { ok: true, data: apiIns_() };
      case 'ltmacros': return { ok: true, data: apiLtMacros_() };
      case 'notes':    return apiNotes_(extra.project);
      case 'addnote':  return apiAddNote_(extra.project, extra.text);
      case 'delnote':  return apiDelTestNote_(extra.project);
      case 'punch':     return apiPunch_(extra.project);
      case 'logadd':    return apiLogWrite_('water', extra.value, extra.cid, extra.all && extra.all.date);    // v43: optional &date=YYYY-MM-DD
      case 'logset':    return apiLogWrite_(extra.field, extra.value, extra.cid, extra.all && extra.all.date);
      case 'logday':    return apiLogDay_(extra.all || {});
      case 'workoutset': return apiWorkoutSet_(extra.all || {});   // v58 (WorkoutSet.gs)
      case 'lognote':   return apiLogNote_(extra.text, extra.cid);
      case 'lognotes':  return apiLogNotes_();
      case 'punchset':  return apiPunchSet_(extra.project, extra.index, extra.done);
      case 'punchnote': return apiPunchNote_(extra.project, extra.index, extra.text, extra.cid, extra.at);
      case 'fin':      return apiFin_(extra.page);
      case 'insnotes': return apiFin_('insurance');
      case 'balset':    return apiBalSet_(extra.all || {});
      case 'acctadd':   return apiAcctAdd_(extra.all || {});   // v44: add an account (bank | card | app) to the Accounts tab
      case 'incomeadd': return apiIncomeAdd_(extra.all || {});
      case 'wishlist':  return apiWishList_();
      case 'ltmacroset': return apiLtMacroSet_(extra.all || {});
      case 'lting':      return apiLtIng_();                        // v59 (LtIngredients.gs): Lisa's Table Ingredients + Meals (read-only)
      case 'ltingset':   return apiLtIngSet_(extra.all || {});      // v59: upsert one ingredient / meal (cid, dry)
      case 'ltingdel':   return apiLtIngDel_(extra.all || {});      // v59: delete one ingredient / meal row (cid, dry)
      case 'ltingphoto': return apiLtIngPhoto_(extra.all || {});    // v59: product / label photo -> Lisa's Table > Ingredient Photos
      case 'ltpriceset': return apiLtPriceSet_(extra.all || {});
      case 'orders':    return apiOrders_(extra.all || {});
      case 'orderset':  return apiOrderSet_(extra.all || {});
      case 'orderpaid': return apiOrderPaid_(extra.all || {});
      case 'orderdel':  return apiOrderDel_(extra.all || {});
      case 'weekmenuset': return apiWeekMenuSet_(extra.all || {});
      case 'menuitemadd': return apiMenuItemAdd_(extra.all || {});
      case 'menusave':  return apiMenuSave_(extra.all || {});
      case 'ltmenusave': return apiLtMenuSave_(extra.all || {});     // v53: Lisa's Table menu PDF -> Drive > Past Menus
      case 'wishadd':   return apiWishAdd_(extra.all || {});
      case 'wishset':   return apiWishSet_(extra.all || {});
      case 'wishdel':   return apiWishDel_(extra.all || {});
      case 'ptclients':    return apiPtClientsList_();                 // v45: Lisa's Personal Training
      case 'ptclientset':  return apiPtClientSet_(extra.all || {});
      case 'ptclientdel':  return apiPtClientDel_(extra.all || {});
      case 'ptworkoutset': return apiPtWorkoutSet_(extra.all || {});
      case 'ptworkoutdel': return apiPtWorkoutDel_(extra.all || {});
      case 'ptphotos':     return apiPtPhotos_(extra.all || {});            // v56: PT client workout photos (read-only)
      case 'ptphotosave':  return apiPtPhotoSave_(extra.all || {});         // v56: photo -> Lisa's Table > PT Client Photos > <client>
      case 'lisareqlist':  return apiLrList_();                       // v54: Lisa's change requests (sheet 'Lisa Change Requests')
      case 'lisareq':      return apiLrAdd_(extra.all || {});
      case 'lisareqset':   return apiLrSet_(extra.all || {});
      case 'lisareqdel':   return apiLrDel_(extra.all || {});
      case 'incomedel': return apiIncomeDel_(extra.all || {});
      case 'fiberbackfill': return apiFiberBackfill_(extra.all || {});   // v50 fh-fiber-backfill
      case 'invest':     return apiInvest_();                          // v49 (Finances > Investments): read the three accounts
      case 'investsave': return apiInvestSave_(extra.all || {});       // v49: replace one account (GET params or POST body)
      case 'lists':      return apiLists_();                           // v56 (Zac > Wetumka lists): read every list
      case 'listsave':   return apiListSave_(extra.all || {});         // v56: merge one list (POST body or GET params)
      case 'incomefix': return apiIncomeFix_(extra.all || {});   // v46 (Vault category): change category / notes of one Income / Personal Training / Land & Structure Pay row
      case 'spenddel':  return apiSpendDel_(extra.all || {});
      case 'receiptsave': return apiReceiptSave_(extra.all || {});
      case 'bizreceipts':    return apiBizReceipts_();                        // v55: KiwiT / TiwiK Receipts folders (read-only)
      case 'bizreceiptsave': return apiBizReceiptSave_(extra.all || {});      // v55: receipt -> <entity> > Expenses > Receipts
      case 'receipts':  return apiReceipts_(extra.all || {});
      case 'debttabs':  return apiDebtTabs_(extra.all || {});
      case 'debtset':   return apiDebtSet_(extra.all || {});
      case 'billadd':   return apiBillAdd_(extra.all || {});
      case 'billpaid':  return apiBillPaid_(extra.all || {});
      case 'billdel':   return apiRowDel_('bills', extra.all || {});
      case 'debtdel':   return apiRowDel_('debts', extra.all || {});
      case 'healthmetrics':   return apiHealthMetrics_();                     // v51: Fitness & Health > Medical > Health Metrics
      case 'healthmetricset': return apiHealthMetricSet_(extra.all || {});
      case 'ccrev':    return apiCcRev_(extra.all || {});      // v57 (FamilyChase.gs): review sheets (Family Chase / Bank of Stockton), read-only
      case 'ccrevset': return apiCcRevSet_(extra.all || {});   // v57: review columns of those sheets only (by id, cid)
      case 'version':  return { ok: true, data: { version: API_VERSION, patches: ['v56 zac-lists', 'v56 lisa-trade-ptphotos', 'v57 family-chase', 'v58 workout-set', 'v59 lt-ingredients'] } };   // v59: read-only build check
      default:      return { error: 'bad_action' };
    }
  } catch (err) {
    console.error('CC API error: ' + (err && err.stack || err));
    return { error: 'server', message: String(err && err.message || err) };
  }
}

/**
 * Same data the Daily spend screen shows (v34: every entry also carries `row`, its 1-based sheet row; income entries also carry `tab` = income | ls | pt), plus:
 *   items[]  — EVERY entry in the month (not just the latest 20), each with
 *              date, label, who, amount, category, merchant, method, notes, account.
 *   account  — column H "Account" (Household / TiwiK / KiwiT); blank -> "Household".
 * Totals by account / category are computed client-side from items[].
 */
function apiSpend_(off) {
  var d = getDailySpend(off);
  d.recent = (d.recent || []).map(function (x) {
    return { date: x.date, label: x.label, who: x.who, amount: x.amount,
             category: x.category, merchant: x.merchant, method: x.method,
             row: x.row + 1 };   // v34: 1-based sheet row (getDailySpend's x.row is the 0-based index into the sheet values)
  });
  d.items = apiSpendItems_(off);
  d.paidFromColumn = !!d.items.hasPaidFrom;
  d.categoryApi = 1;   // v46: incomeadd/incomefix take category= (Category column, created on first use); spendadd takes allow_new_category=1
  d.paymentApi = 1;    // v47: incomeadd writes method= to a "Payment type" column (created on first use); spendfix / incomefix take method=
  try { d.income = apiIncome_(off); } catch (err) {
    console.error('CC API income error: ' + (err && err.stack || err));
    d.income = [];
  }
  // Lisa's personal training payments: own tab, own income source, same income[] list
  // (so total income / avg daily income include it). Failure here never affects the rest.
  try { d.income = d.income.concat(apiPersonalTraining_(off)); } catch (err2) {
    console.error('CC API personal training error: ' + (err2 && err2.stack || err2));
  }
  // Zac's Land & Structure pay: own tab, own income source, same income[] list. Failure never affects the rest.
  try { d.income = d.income.concat(apiLandStructurePay_(off)); } catch (err3) {
    console.error('CC API land & structure pay error: ' + (err3 && err3.stack || err3));
  }
  d.income.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return d;
}

/**
 * "Personal Training" tab of the Daily Spend sheet (Lisa's PT client payments).
 * Headers: Date | Client | Amount | Method | Notes. Rows in the requested month, newest first, as
 * income items: {date, label, source:"Lisa's Personal Training", client, amount, method, notes}.
 * method is Cash / Venmo / Zelle as typed. Missing tab / empty tab / missing columns -> [].
 */
var API_PT_TAB = 'Personal Training';
var API_PT_SOURCE = "Lisa's Personal Training";
function apiPersonalTraining_(monthOffset) {
  monthOffset = Number(monthOffset) || 0;
  var sh = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID).getSheetByName(API_PT_TAB);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], {
    date: ['date', 'week ending'],
    client: ['client', 'name'],
    amount: ['amount', '$'],
    method: ['method', 'payment', 'paid via'],
    notes: ['notes', 'note'],
    category: ['category']
  });
  if (col.date < 0 || col.amount < 0) return [];

  var today = keyToDate_(todayKey_());
  var mStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12);
  var ym = mStart.getFullYear() + '-' + pad_(mStart.getMonth() + 1);
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key || key.slice(0, 7) !== ym) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null) continue;
    out.push({
      date: key,
      label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'),
      source: API_PT_SOURCE,
      client: str(v, col.client),
      amount: round2_(amt),
      method: str(v, col.method),
      notes: str(v, col.notes),
      category: str(v, col.category),
      row: r + 1,
      tab: 'pt',
      _r: r
    });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b._r - a._r; });
  out.forEach(function (x) { delete x._r; });
  return out;
}

/**
 * "Land & Structure Pay" tab of the Daily Spend sheet (Zac's pay, twice a month). Modeled on apiPersonalTraining_.
 * Headers: Date | Description | Amount | Method | Notes. Rows in the requested month, newest first, as income
 * items: {date, label, source:"Land & Structure Pay", client (=Description), description, amount, method, notes, gid (tab id, for the 'Open in spend sheet' link)}.
 * Total row (no parseable date) is skipped. Missing tab / empty tab / missing columns -> [].
 */
var API_LSPAY_TAB = 'Land & Structure Pay';
var API_LSPAY_SOURCE = 'Land & Structure Pay';
function apiLandStructurePay_(monthOffset) {
  monthOffset = Number(monthOffset) || 0;
  var sh = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID).getSheetByName(API_LSPAY_TAB);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], {
    date: ['date', 'pay date', 'week ending'],
    desc: ['description', 'desc', 'client', 'name'],
    amount: ['amount', '$'],
    method: ['method', 'payment', 'paid via'],
    notes: ['notes', 'note'],
    category: ['category']
  });
  if (col.date < 0 || col.amount < 0) return [];

  var today = keyToDate_(todayKey_());
  var mStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12);
  var ym = mStart.getFullYear() + '-' + pad_(mStart.getMonth() + 1);
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key || key.slice(0, 7) !== ym) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null) continue;
    var desc = str(v, col.desc);
    out.push({
      date: key,
      label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'),
      source: API_LSPAY_SOURCE,
      gid: sh.getSheetId(),
      client: desc,
      description: desc,
      amount: round2_(amt),
      method: str(v, col.method),
      notes: str(v, col.notes),
      category: str(v, col.category),
      row: r + 1,
      tab: 'ls',
      _r: r
    });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b._r - a._r; });
  out.forEach(function (x) { delete x._r; });
  return out;
}

/**
 * Weekly lump-sum income from the "Income" tab of the Daily Spend sheet.
 * Headers: Week ending | Source | Amount | Notes. Rows whose Week ending falls in the
 * requested month are returned newest first: {date, label, source, amount, notes}.
 * Missing tab / empty tab -> [] (no error).
 */
var API_INCOME_TAB = 'Income';
function apiIncome_(monthOffset) {
  monthOffset = Number(monthOffset) || 0;
  var sh = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID).getSheetByName(API_INCOME_TAB);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], {
    date: ['week ending', 'week end', 'week', 'date'],
    source: ['source'],
    amount: ['amount', '$'],
    method: ['payment type', 'method', 'payment', 'paid via'],   // v47
    notes: ['notes', 'note'],
    category: ['category']
  });
  if (col.date < 0 || col.amount < 0) return [];

  var today = keyToDate_(todayKey_());
  var mStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12);
  var ym = mStart.getFullYear() + '-' + pad_(mStart.getMonth() + 1);
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key || key.slice(0, 7) !== ym) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null) continue;
    out.push({
      date: key,
      label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'),
      source: str(v, col.source) || 'Other',
      amount: round2_(amt),
      notes: str(v, col.notes),
      category: str(v, col.category),
      method: str(v, col.method),   // v47
      row: r + 1,
      tab: 'income',
      _r: r
    });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b._r - a._r; });
  out.forEach(function (x) { delete x._r; });
  return out;
}

var API_ACCOUNTS = ['Household', 'TiwiK', 'KiwiT'];

/* Paid from (v25): column I of the Daily Spend tab. Canonical values: */
var API_PAID_FROM = ['Cash', 'Household card/account', 'KiwiT account', 'TiwiK account', 'Other'];
var API_PAID_HEADS = ['paid from', 'paid_from', 'paidfrom', 'paid by'];
/** Raw cell text -> { value, known }. Blank -> ''. Typed variants are mapped ("kiwit", "TiwiK card", "joint debit", "cash"); unknown text is kept as typed with known:false. */
function apiPaidNorm_(raw) {
  var t = String(raw == null ? '' : raw).trim();
  if (!t) return { value: '', known: true };
  var l = loose_(t);
  if (l === 'cash') return { value: 'Cash', known: true };
  if (/kiwit/.test(l)) return { value: 'KiwiT account', known: true };
  if (/tiwik/.test(l)) return { value: 'TiwiK account', known: true };
  if (/household|joint|personal|card|credit|debit|visa|amex|lisa|zac/.test(l)) return { value: 'Household card/account', known: true };
  if (l === 'other') return { value: 'Other', known: true };
  return { value: t, known: false };
}

function apiSpendItems_(monthOffset) {
  monthOffset = Number(monthOffset) || 0;
  var cfg = CONFIG.SPEND;
  var values = readTab_(cfg.SHEET_ID, cfg.TAB).values;
  if (values.length < 1) return [];
  var spec = {};
  Object.keys(cfg.HEADERS).forEach(function (k) { spec[k] = cfg.HEADERS[k]; });
  spec.account = ['account'];
  spec.paid = API_PAID_HEADS;
  var col = mapHeaders_(values[0], spec);
  if (col.date < 0 || col.amount < 0) return [];

  var today = keyToDate_(todayKey_());
  var mStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12);
  var ym = mStart.getFullYear() + '-' + pad_(mStart.getMonth() + 1);
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };

  var items = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key || key.slice(0, 7) !== ym) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null || amt === 0) continue;
    items.push({
      date: key,
      label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'),
      who: matchPerson_(str(v, col.who), cfg.PEOPLE),
      amount: round2_(amt),
      category: str(v, col.category) || 'Other',
      merchant: str(v, col.merchant),
      method: str(v, col.method),
      notes: str(v, col.notes),
      account: apiNormAccount_(str(v, col.account)),
      paidFrom: apiPaidNorm_(str(v, col.paid)).value,
      row: r + 1,
      _r: r
    });
  }
  items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b._r - a._r; });
  items.forEach(function (x) { delete x._r; });
  items.hasPaidFrom = col.paid >= 0;
  return items;
}

function apiNormAccount_(s) {
  var n = loose_(s);
  if (!n) return 'Household';
  for (var i = 0; i < API_ACCOUNTS.length; i++) if (loose_(API_ACCOUNTS[i]) === n) return API_ACCOUNTS[i];
  return s;
}


/* ======================================================================= */
/* Accounts (v18) — action=accounts                                         */
/* Vault > Accounts: bank balances from the spend sheet's "Accounts" and    */
/* "Balances" tabs, totals by owner group, and a per-group reconciliation   */
/* of balance change vs (income - spend) from the Vault data.               */
/* ======================================================================= */
var API_ACCT_TAB = 'Accounts';          // Account | Bank | Type | Owner | Purpose | Active
var API_BAL_TAB = 'Balances';           // Month end | Account | Balance | Notes
// Names containing any of these (case-insensitive) are never returned (Sierra Consultants is deliberately NOT in the Vault).
var API_ACCT_EXCLUDE = ['sierra'];
var API_RECON_TOLERANCE = 50;           // |gap| above this (dollars) is flagged as unexplained
var API_ACCT_KINDS = { bank: 'Bank', card: 'Credit card', app: 'Payment app' };   // v44: Kind column values written by acctadd (read back case/punctuation-insensitively)
var API_RECON_MAX_MONTHS = 4;           // longest balance-to-balance window the reconciliation will read spend/income for

function apiAcctExcluded_(name) {
  var n = String(name || '').toLowerCase();
  for (var i = 0; i < API_ACCT_EXCLUDE.length; i++) if (n.indexOf(API_ACCT_EXCLUDE[i]) >= 0) return true;
  return false;
}
/**
 * v44: account kind. 'card' = credit card (balance = amount OWED, positive; subtracted from cash/net totals), 'app' = payment app (Zelle / Venmo; counts like cash), 'bank' = everything else.
 * A value in the Kind column wins; otherwise the Type text and the account name are searched; otherwise bank.
 */
function apiAcctKind_(kindCell, typeCell, name) {
  var k = loose_(kindCell);
  if (k) {
    if (/card|credit/.test(k)) return 'card';
    if (/app|zelle|venmo|paypal|wallet/.test(k)) return 'app';
    if (/bank|checking|savings|cash|deposit/.test(k)) return 'bank';
  }
  var t = String(typeCell == null ? '' : typeCell) + ' ' + String(name == null ? '' : name);
  if (!/debit/i.test(t) && /credit\s*card|\bcard\b|\bvisa\b|master\s*card|\bamex\b|american express|\bdiscover\b/i.test(t)) return 'card';
  if (/\bzelle\b|\bvenmo\b|paypal|cash\s*app|apple cash|payment app/i.test(t)) return 'app';
  return 'bank';
}
/** +1 for banks / apps, -1 for credit cards (owed): multiply a raw balance (or balance change) by this to get its effect on cash / net totals. */
function apiAcctSign_(kind) { return kind === 'card' ? -1 : 1; }
function apiIsMonthEnd_(key) {   // "2026-09-30" -> true; "2026-09-21" -> false
  var m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  return Number(m[3]) === last;
}
function apiAcctOwnerGroup_(owner) {
  var g = apiNormAccount_(owner);   // blank -> Household; Household / TiwiK / KiwiT case-insensitive
  return g;
}
/** Which Vault group an income source belongs to (Laundromat -> TiwiK; Mono Way / rent / KiwiT -> KiwiT; everything else -> Household). */
function apiIncomeGroup_(source) {
  var n = loose_(source);
  if (/monovillage|laundr|tiwik/.test(n)) return 'TiwiK';
  if (/monoway|kiwit|landlord|tenant/.test(n)) return 'KiwiT';
  return 'Household';
}

function apiAccounts_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
  var shA = ss.getSheetByName(API_ACCT_TAB), shB = ss.getSheetByName(API_BAL_TAB);
  if (!shA) throw new Error('Tab "' + API_ACCT_TAB + '" not found in ' + ss.getName());
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };

  // ---- Accounts tab ----
  var av = shA.getDataRange().getValues(), accts = [], byKey = {};
  if (av.length >= 2) {
    var ac = mapHeaders_(av[0], { name: ['account', 'account name', 'name'], bank: ['bank'], type: ['type'], owner: ['owner', 'group'], purpose: ['purpose'], active: ['active'], kind: ['kind', 'account kind'] });
    if (ac.name >= 0) {
      for (var r = 1; r < av.length; r++) {
        var nm = str(av[r], ac.name);
        if (!nm || apiAcctExcluded_(nm)) continue;
        var act = loose_(str(av[r], ac.active));
        if (act === 'no' || act === 'n' || act === 'false' || act === 'inactive' || act === '0') continue;
        var a = { name: nm, bank: str(av[r], ac.bank), type: str(av[r], ac.type), purpose: str(av[r], ac.purpose),
                  group: apiAcctOwnerGroup_(str(av[r], ac.owner)), kind: apiAcctKind_(str(av[r], ac.kind), str(av[r], ac.type), nm), entries: [] };
        if (byKey[loose_(nm)]) continue;
        byKey[loose_(nm)] = a; accts.push(a);
      }
    }
  }

  // ---- Balances tab ----
  var unmatched = [], gid = shB ? shB.getSheetId() : null;
  if (shB) {
    var bv = shB.getDataRange().getValues();
    if (bv.length >= 2) {
      var bc = mapHeaders_(bv[0], { date: ['month end', 'date', 'as of'], account: ['account'], balance: ['balance'], notes: ['notes', 'note'] });
      if (bc.date >= 0 && bc.account >= 0 && bc.balance >= 0) {
        for (var i = 1; i < bv.length; i++) {
          var key = toKey_(bv[i][bc.date]), an = str(bv[i], bc.account), bal = toNum_(bv[i][bc.balance]);
          if (!key || !an || bal === null || apiAcctExcluded_(an)) continue;
          var tgt = byKey[loose_(an)];
          if (!tgt) { if (unmatched.indexOf(an) < 0) unmatched.push(an); continue; }
          tgt.entries.push({ date: key, balance: round2_(bal), notes: str(bv[i], bc.notes), monthEnd: apiIsMonthEnd_(key), _r: i });
        }
      }
    }
  }

  // ---- per account: newest first, one entry per date (a later row for the same date wins), latest + previous + change ----
  accts.forEach(function (a) {
    var seen = {}, list = [];
    a.entries.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : y._r - x._r; });
    a.entries.forEach(function (e) { if (!seen[e.date]) { seen[e.date] = 1; list.push({ date: e.date, balance: e.balance, notes: e.notes, monthEnd: e.monthEnd }); } });
    a.entries = list;
    var cur = list[0] || null, prev = list[1] || null;
    a.balance = cur ? cur.balance : null;
    a.asOf = cur ? cur.date : null;
    a.monthEnd = cur ? cur.monthEnd : null;
    a.notes = cur ? cur.notes : '';
    a.prevBalance = prev ? prev.balance : null;
    a.prevAsOf = prev ? prev.date : null;
    a.change = (cur && prev) ? round2_(cur.balance - prev.balance) : null;
    a.reconcile = (cur && prev) ? 'ready' : 'need_next_statement';
  });

  // ---- v31: Investments-group accounts (E*TRADE) are not Vault bank accounts: returned separately as investments[] and kept out of accounts[], groups, totals and reconciliation ----
  var invs = accts.filter(function (a) { return loose_(a.group) === 'investments'; });
  accts = accts.filter(function (a) { return loose_(a.group) !== 'investments'; });

  // ---- totals by group and overall ----
  var groups = [], gmap = {};
  accts.forEach(function (a) {
    if (!gmap[a.group]) { gmap[a.group] = { group: a.group, total: 0, cash: 0, owed: 0, count: 0, withBalance: 0, accounts: [], prevTotal: 0, withPrev: 0 }; groups.push(gmap[a.group]); }
    var g = gmap[a.group], sg = apiAcctSign_(a.kind);   // v44: total = cash (banks + apps) minus card balances owed
    g.accounts.push(a.name); g.count++;
    if (a.balance !== null) { g.total += sg * a.balance; if (a.kind === 'card') g.owed += a.balance; else g.cash += a.balance; g.withBalance++; }
    if (a.prevBalance !== null) { g.prevTotal += sg * a.prevBalance; g.withPrev++; }
  });
  var order = API_ACCOUNTS.slice();
  groups.sort(function (x, y) { var i = order.indexOf(x.group), j = order.indexOf(y.group); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  var total = 0, cashAll = 0, owedAll = 0, withBal = 0, allPrev = accts.length > 0, prevTotal = 0;
  groups.forEach(function (g) {
    g.total = round2_(g.total); g.cash = round2_(g.cash); g.owed = round2_(g.owed);
    // change only when every account in the group has both balances (otherwise it would compare unlike sets)
    var complete = g.withPrev === g.count && g.withBalance === g.count && g.count > 0;
    g.change = complete ? round2_(g.total - g.prevTotal) : null;
    g.prevTotal = complete ? round2_(g.prevTotal) : null;
    delete g.withPrev; delete g.withBalance;
    total += g.total; cashAll += g.cash; owedAll += g.owed;
  });
  accts.forEach(function (a) { if (a.balance !== null) withBal++; if (a.prevBalance === null) allPrev = false; else prevTotal += apiAcctSign_(a.kind) * a.prevBalance; });
  total = round2_(total); cashAll = round2_(cashAll); owedAll = round2_(owedAll);

  return {
    today: todayKey_(),
    balancesGid: gid,
    accounts: accts.map(function (a) { return { name: a.name, bank: a.bank, type: a.type, kind: a.kind, purpose: a.purpose, group: a.group,
      balance: a.balance, asOf: a.asOf, monthEnd: a.monthEnd, notes: a.notes, prevBalance: a.prevBalance, prevAsOf: a.prevAsOf,
      change: a.change, reconcile: a.reconcile, entries: a.entries }; }),
    investments: invs.map(function (a) { return { name: a.name, bank: a.bank, type: a.type, purpose: a.purpose, balance: a.balance, asOf: a.asOf, monthEnd: a.monthEnd, notes: a.notes,
      prevBalance: a.prevBalance, prevAsOf: a.prevAsOf, entries: a.entries }; }),
    groups: groups,
    total: total,        // v44: NET = cash (banks + apps) - card balances owed
    cash: cashAll,       // v44: banks + apps
    owed: owedAll,       // v44: sum of card balances (amount owed, positive)
    count: accts.length,
    withBalance: withBal,
    prevTotal: allPrev ? round2_(prevTotal) : null,
    change: allPrev ? round2_(total - prevTotal) : null,
    unmatched: unmatched,
    reconciliation: apiReconcile_(accts, groups)
  };
}

/**
 * Per group: balance change between the group's two latest balance dates vs (income - spend) for the same window
 * (day after the earlier balance date through the later balance date), using the same Vault data as action=spend.
 * status: need_next_statement (an account has only one balance) | mixed_dates (accounts' statement dates differ)
 *         | ok (gap within tolerance) | gap (unexplained gap above tolerance).
 * Per-account lines carry the account's own change; the income/spend side only exists per group (the Vault tags spend by group).
 */
function apiReconcile_(accts, groups) {
  var out = [];
  groups.forEach(function (g) {
    var mine = accts.filter(function (a) { return a.group === g.group; });
    var rec = { group: g.group, status: '', message: '', periodStart: null, periodEnd: null, balanceChange: null,
                income: null, spend: null, expected: null, gap: null, flagged: false, tolerance: API_RECON_TOLERANCE,
                accounts: mine.map(function (a) { return { name: a.name, kind: a.kind, status: a.reconcile, change: a.change,
                  message: a.reconcile === 'ready' ? '' : 'need next statement' }; }),
                incomeItems: [], spendItems: [] };
    var missing = mine.filter(function (a) { return a.reconcile !== 'ready'; });
    if (!mine.length) { return; }
    if (loose_(g.group) === 'investments') { return; }   // market value moves are not explained by income/spend: no reconciliation for investments
    if (missing.length) {
      rec.status = 'need_next_statement';
      rec.message = 'need next statement: ' + missing.map(function (a) { return a.name; }).join(', ');
      out.push(rec); return;
    }
    var curDates = {}, prevDates = {};
    mine.forEach(function (a) { curDates[a.asOf] = 1; prevDates[a.prevAsOf] = 1; });
    if (Object.keys(curDates).length > 1 || Object.keys(prevDates).length > 1) {
      rec.status = 'mixed_dates';
      rec.message = 'statement dates differ between accounts in this group; enter balances for the same dates to reconcile';
      out.push(rec); return;
    }
    var start = mine[0].prevAsOf, end = mine[0].asOf;
    rec.periodStart = start; rec.periodEnd = end;
    var change = 0;
    mine.forEach(function (a) { change += apiAcctSign_(a.kind) * a.change; });   // v44: a card's owed-change counts negatively (net change)
    rec.balanceChange = round2_(change);

    // Vault data for (start, end]: month offsets relative to today's month
    var today = keyToDate_(todayKey_());
    var offOf = function (key) { var p = key.split('-'); return (Number(p[0]) - today.getFullYear()) * 12 + (Number(p[1]) - 1 - today.getMonth()); };
    var o1 = offOf(start), o2 = offOf(end);
    if (o2 - o1 + 1 > API_RECON_MAX_MONTHS || o2 > 0) { o1 = Math.max(o1, o2 - API_RECON_MAX_MONTHS + 1); }
    var inc = [], sp = [], off;
    for (off = o1; off <= Math.min(o2, 0); off++) {
      try { sp = sp.concat(apiSpendItems_(off)); } catch (e1) { console.error('CC API accounts spend: ' + (e1 && e1.stack || e1)); }
      var lists = [];
      try { lists.push(apiIncome_(off)); } catch (e2) { console.error('CC API accounts income: ' + e2); }
      try { lists.push(apiPersonalTraining_(off)); } catch (e3) { console.error('CC API accounts pt: ' + e3); }
      try { lists.push(apiLandStructurePay_(off)); } catch (e4) { console.error('CC API accounts ls: ' + e4); }
      lists.forEach(function (l) { inc = inc.concat(l); });
    }
    var inWin = function (d) { return d > start && d <= end; };
    var incSum = 0, spSum = 0;
    inc.forEach(function (x) {
      if (!inWin(x.date) || apiIncomeGroup_(x.source) !== g.group) return;
      incSum += x.amount;
      rec.incomeItems.push({ date: x.date, label: x.label, source: x.source, client: x.client || '', amount: x.amount });
    });
    sp.forEach(function (x) {
      if (!inWin(x.date) || x.account !== g.group) return;
      spSum += x.amount;
      rec.spendItems.push({ date: x.date, label: x.label, who: x.who, merchant: x.merchant, category: x.category, method: x.method, amount: x.amount });
    });
    rec.income = round2_(incSum); rec.spend = round2_(spSum);
    rec.expected = round2_(incSum - spSum);
    rec.gap = round2_(rec.balanceChange - rec.expected);
    rec.flagged = Math.abs(rec.gap) > API_RECON_TOLERANCE;
    rec.status = rec.flagged ? 'gap' : 'ok';
    rec.message = rec.flagged ? 'unexplained gap: transfers, cash, card payments or entries not yet logged' : 'balance change is explained by logged income and spend';
    out.push(rec);
  });
  return out;
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function apiRespond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/* ======================================================================= */
/* Document proxy — action=file&id=… / action=folder&id=…                   */
/* Lets the phone app show Drive files without a Google sign-in. Only files */
/* inside the Second Brain tree (or listed in the app's own links) are      */
/* served. Uses DriveApp read-only calls (covered by drive.readonly).       */
/* ======================================================================= */
var API_FILE_MAX_BYTES = 20 * 1024 * 1024;   // 20 MB raw (~27 MB base64)
var API_ANC_MAX_DEPTH = 15;

function apiCleanId_(id) {
  id = String(id || '').trim();
  return /^[\w-]{10,100}$/.test(id) ? id : '';
}

/** IDs the app links to directly (project docs, life-area folders, biz snapshot, root). */
function apiAllowList_() {
  var ids = {};
  ids[CONFIG.SECOND_BRAIN_ROOT_ID] = true;
  (CONFIG.LIFE_AREAS || []).forEach(function (a) { if (a.folderId) ids[a.folderId] = true; });
  (CONFIG.PROJECTS || []).forEach(function (p) {
    [p.url, p.folderUrl].forEach(function (u) {
      var m = String(u || '').match(/\/(?:d|folders)\/([\w-]+)/);
      if (m) ids[m[1]] = true;
    });
  });
  (API_BIZ.businesses || []).forEach(function (b) {
    [b.folderUrl].concat(b.groups.map(function (g) { return g.folderUrl; })).forEach(function (u) {
      var m = String(u || '').match(/folders\/([\w-]+)/);
      if (m) ids[m[1]] = true;
    });
    b.groups.forEach(function (g) { g.files.forEach(function (f) { if (f.id) ids[f.id] = true; }); });
  });
  var rm = String(API_BIZ.rootUrl || '').match(/folders\/([\w-]+)/);
  if (rm) ids[rm[1]] = true;
  return ids;
}

/** True if the item is allow-listed or sits (at any depth) under the Second Brain root. Cached 6 h. */
function apiIsAllowed_(item, id) {
  var allow = apiAllowList_();
  if (allow[id]) return true;
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cc_anc_' + id);
  if (hit) return hit === '1';
  var ok = false, seen = {}, frontier = [item], depth = 0;
  while (frontier.length && depth < API_ANC_MAX_DEPTH && !ok) {
    var next = [];
    for (var i = 0; i < frontier.length && !ok; i++) {
      var ps = frontier[i].getParents();
      while (ps.hasNext()) {
        var p = ps.next(), pid = p.getId();
        if (seen[pid]) continue;
        seen[pid] = true;
        var c = cache.get('cc_anc_' + pid);
        if (allow[pid] || c === '1') { ok = true; break; }
        if (c === '0') continue;
        next.push(p);
      }
    }
    frontier = next; depth++;
  }
  cache.put('cc_anc_' + id, ok ? '1' : '0', 21600);
  return ok;
}

function apiFile_(rawId) {
  var id = apiCleanId_(rawId);
  if (!id) return { error: 'bad_id' };
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { return { error: 'not_found' }; }
  if (!apiIsAllowed_(file, id)) return { error: 'forbidden' };
  var mime = file.getMimeType(), name = file.getName(), blob;
  var url = file.getUrl();
  if (mime.indexOf('application/vnd.google-apps.') === 0) {
    if (!/\.(document|spreadsheet|presentation|drawing)$/.test(mime)) {
      return { error: 'unsupported', message: 'This Google file type cannot be previewed.', data: { name: name, mime: mime, url: url } };
    }
    blob = file.getAs('application/pdf');            // Docs / Sheets / Slides / Drawings -> PDF
    name = name + '.pdf';
  } else {
    if (file.getSize() > API_FILE_MAX_BYTES) return { error: 'too_big', data: { name: name, mime: mime, url: url, size: file.getSize() } };
    if (mime === 'application/pdf' || mime.indexOf('image/') === 0 || mime.indexOf('text/') === 0) {
      blob = file.getBlob();
    } else if (/officedocument|msword|ms-excel|ms-powerpoint|opendocument|rtf/.test(mime)) {
      try { blob = file.getAs('application/pdf'); name = name.replace(/\.\w+$/, '') + '.pdf'; }
      catch (e) { return { error: 'unsupported', message: 'This file type cannot be previewed.', data: { name: name, mime: mime, url: url } }; }
    } else {
      return { error: 'unsupported', message: 'This file type cannot be previewed.', data: { name: name, mime: mime, url: url } };
    }
  }
  var bytes = blob.getBytes();
  if (bytes.length > API_FILE_MAX_BYTES) return { error: 'too_big', data: { name: name, mime: mime, url: url, size: bytes.length } };
  return { ok: true, data: { name: name, mime: blob.getContentType() || mime, url: url, size: bytes.length, b64: Utilities.base64Encode(bytes) } };
}

/**
 * v48 (doc share): action=filebytes&id=<fileId> -> { ok, data:{ name, mimeType, mime, size, b64, url, converted } }
 * The front end turns this into a File for navigator.share({files}) (Messages / Mail / AirDrop) and for Save to phone,
 * so the recipient gets the file itself and needs no Drive access. Read-only: nothing about the file or its sharing changes.
 * - Ordinary files (PDF, images, Word/Excel/PowerPoint, zip, ...): the ORIGINAL bytes (no conversion).
 * - Google Docs / Sheets / Slides / Drawings: exported as PDF (name gets ".pdf", converted:true).
 * - Other Google types (Forms, Sites, folders, shortcuts): { error:'unsupported' }.
 * - Over API_FILE_MAX_BYTES (20 MB, raw or after export): { error:'too_big', data:{ size, ... } }.
 * Same passcode check (apiDispatch_) and the same Second Brain allow-list as action=file (apiIsAllowed_).
 */
function apiFileBytes_(rawId) {
  var id = apiCleanId_(rawId);
  if (!id) return { error: 'bad_id' };
  var file;
  try { file = DriveApp.getFileById(id); } catch (e) { return { error: 'not_found' }; }
  if (!apiIsAllowed_(file, id)) return { error: 'forbidden' };
  var mime = file.getMimeType(), name = file.getName(), url = file.getUrl(), blob, converted = false;
  if (mime.indexOf('application/vnd.google-apps.') === 0) {
    if (!/\.(document|spreadsheet|presentation|drawing)$/.test(mime)) {
      return { error: 'unsupported', message: 'This Google file type can\u2019t be sent as a file.', data: { name: name, mime: mime, url: url } };
    }
    try { blob = file.getAs('application/pdf'); } catch (e) { return { error: 'unsupported', message: 'Google couldn\u2019t export this file as PDF.', data: { name: name, mime: mime, url: url } }; }
    name = /\.pdf$/i.test(name) ? name : name + '.pdf';
    mime = 'application/pdf';
    converted = true;
  } else {
    if (file.getSize() > API_FILE_MAX_BYTES) return { error: 'too_big', data: { name: name, mime: mime, url: url, size: file.getSize() } };
    blob = file.getBlob();
  }
  var bytes = blob.getBytes();
  if (bytes.length > API_FILE_MAX_BYTES) return { error: 'too_big', data: { name: name, mime: mime, url: url, size: bytes.length } };
  var type = converted ? 'application/pdf' : (mime || blob.getContentType() || 'application/octet-stream');
  return { ok: true, data: { name: name, mimeType: type, mime: type, size: bytes.length, url: url, converted: converted, b64: Utilities.base64Encode(bytes) } };
}

/**
 * v52 (Home tasks): action=suggest[&n=12] -> { ok, data:{ items:[{ id, text, project, due:'yyyy-MM-dd'|'', priority:1|2 }], source, at } }
 * Reads every tab of the "Project Tasks — Master" Sheet that has a header row starting "Done | Task" (Master, Terra Vi, YSF,
 * Mathiesen, MarVal, ...; "Instructions" and the "· Phone" dashboards are skipped), keeps rows whose Done box is not ticked,
 * de-duplicates by project + task, and sorts: priority (a "Priority" column if present: High/1/P1 = 1), then overdue, then
 * due date (no date last). Read-only: nothing in the Sheet changes. The phone's Suggestions box (front end v121+) asks for this
 * first and falls back to suggestions.json in the repo when the action is missing, so nothing breaks before it is deployed.
 * id = 'm:' + first 12 hex chars of MD5(project|task) so Snooze / Dismiss on the phone keep working across reloads.
 */
var TASKS_MASTER_ID = '1Tso8tdD_Z8oxAL1O1C6ozgOZeUWQnHoiThmtAmk1--w';   // Drive: "Project Tasks — Master"
function apiSuggest_(rawN) {
  var n = Math.max(1, Math.min(30, parseInt(rawN, 10) || 12));
  var tz = Session.getScriptTimeZone() || 'America/Los_Angeles';
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var ss = SpreadsheetApp.openById(TASKS_MASTER_ID), seen = {}, out = [];
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (/instructions|phone/i.test(name)) return;
    var vals = sh.getDataRange().getValues(), hr = -1;
    for (var r = 0; r < Math.min(vals.length, 15); r++) {
      if (String(vals[r][0]).trim().toLowerCase() === 'done' && String(vals[r][1]).trim().toLowerCase() === 'task') { hr = r; break; }
    }
    if (hr < 0) return;
    var head = vals[hr].map(function (h) { return String(h).trim().toLowerCase(); });
    var cProj = head.indexOf('project'), cDue = head.indexOf('due'), cPri = head.indexOf('priority');
    for (var i = hr + 1; i < vals.length; i++) {
      var row = vals[i], task = String(row[1] || '').trim();
      if (!task || row[0] === true || String(row[0]).toUpperCase() === 'TRUE') continue;
      var proj = String(cProj >= 0 ? row[cProj] : name).trim() || name;
      var key = (proj + '|' + task).toLowerCase();
      var dv = cDue >= 0 ? row[cDue] : '', due = '';
      if (dv instanceof Date && !isNaN(dv.getTime())) due = Utilities.formatDate(dv, tz, 'yyyy-MM-dd');
      else if (typeof dv === 'number' && dv > 30000) due = Utilities.formatDate(new Date(Math.round((dv - 25569) * 864e5)), 'UTC', 'yyyy-MM-dd');
      else if (/^\d{4}-\d{2}-\d{2}/.test(String(dv))) due = String(dv).slice(0, 10);
      var pv = cPri >= 0 ? String(row[cPri]).trim().toLowerCase() : '';
      var pri = /^(1|p1|high|urgent|top)$/.test(pv) ? 1 : 2;
      var dig = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key, Utilities.Charset.UTF_8)
        .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 12);
      if (seen[key]) {   // same task on the Master tab and its project tab: keep one, with the higher priority and any due date
        var o = seen[key]; o.priority = Math.min(o.priority, pri); if (!o.due && due) o.due = due;
        continue;
      }
      seen[key] = { id: 'm:' + dig, text: task.slice(0, 300), project: proj.slice(0, 40), due: due, priority: pri };
      out.push(seen[key]);
    }
  });
  out.sort(function (a, b) {
    var ao = a.due && a.due < today ? 0 : 1, bo = b.due && b.due < today ? 0 : 1;
    return (a.priority - b.priority) || (ao - bo) || ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0);
  });
  return { items: out.slice(0, n), total: out.length, source: 'Project Tasks \u2014 Master', at: new Date().toISOString() };
}

function apiFolder_(rawId) {
  var id = apiCleanId_(rawId);
  if (!id) return { error: 'bad_id' };
  var folder;
  try { folder = DriveApp.getFolderById(id); } catch (e) { return { error: 'not_found' }; }
  if (!apiIsAllowed_(folder, id)) return { error: 'forbidden' };
  var cache = CacheService.getScriptCache(), items = [];
  var fs = folder.getFolders();
  while (fs.hasNext()) {
    var f = fs.next();
    items.push({ name: f.getName(), id: f.getId(), mime: 'application/vnd.google-apps.folder', folder: true });
    cache.put('cc_anc_' + f.getId(), '1', 21600);    // children of an allowed folder are allowed
  }
  var files = folder.getFiles();
  while (files.hasNext()) {
    var x = files.next();
    items.push({ name: x.getName(), id: x.getId(), mime: x.getMimeType(), size: x.getSize() });
    cache.put('cc_anc_' + x.getId(), '1', 21600);
  }
  items.sort(function (a, b) {
    if (!!a.folder !== !!b.folder) return a.folder ? -1 : 1;
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0;
  });
  return { ok: true, data: { id: id, name: folder.getName(), url: folder.getUrl(), items: items } };
}

/* ======================================================================= */
/* Real Estate + Insurance (live) — action=re / action=ins                  */
/* Listed from Drive at request time, so newly added files show up at once. */
/* Insurance files live ONCE in Insurance/<Property>; the property page     */
/* shows them under an "Insurance" heading (no duplicate copies).           */
/* ======================================================================= */
var API_RE = {
  realEstateId: '1fPkKQIiCAYARALsEpPNegh-XIjZHEJbU',
  insuranceId:  '1XG8tRi07s_Y_9RNHQgJFMdUdVA9UjzlS',
  properties: [
    { slug: 'mono-way',       name: 'Mono Way',       folderId: '1RXSIScan4IbxEk8jGW3CsODNQ0FWjjHR', insuranceFolderId: '1Icd3FslvKfP-9BuxlMVBGyAjMqZeKu0r' },
    { slug: 'stewart-street', name: 'Stewart Street', folderId: '1MPhuWsdEUh-mb7cNpdU9Ac4depKnPDEg', insuranceFolderId: '1QpBvaUry51_jcZ9qcPD5BlLmJkzcMvW1' },
    { slug: 'wetumka',        name: 'Wetumka',        folderId: '1aXdaShpyNR4qysCa-xlDbOU0nq40fF-0', insuranceFolderId: '12Zv_4nPChM8WLR9dPaByIBoTbIUmIYgV' }
  ]
};
function apiFolderUrl_(id) { return 'https://drive.google.com/drive/folders/' + id; }

/**
 * Flatten a folder tree into groups: [{ name, folderUrl, files:[{name,id,mime,size}] }].
 * rootName names the top folder's own files; subfolders are named childPrefix › Sub › Sub… (no prefix if '').
 * Empty groups are skipped.
 */
function apiTree_(folderId, rootName, depth, cache, childPrefix) {
  var out = [];
  (function walk(folder, name, prefix, d) {
    var files = [], it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      files.push({ name: f.getName(), id: f.getId(), mime: f.getMimeType(), size: f.getSize() });
      cache.put('cc_anc_' + f.getId(), '1', 21600);
    }
    files.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
    if (files.length) out.push({ name: name, folderUrl: apiFolderUrl_(folder.getId()), files: files });
    if (d <= 0) return;
    var subs = [], fi = folder.getFolders();
    while (fi.hasNext()) subs.push(fi.next());
    subs.sort(function (a, b) { return a.getName().toLowerCase() < b.getName().toLowerCase() ? -1 : 1; });
    subs.forEach(function (sf) {
      cache.put('cc_anc_' + sf.getId(), '1', 21600);
      var nm = prefix ? prefix + ' \u203a ' + sf.getName() : sf.getName();
      walk(sf, nm, nm, d - 1);
    });
  })(DriveApp.getFolderById(folderId), rootName, childPrefix || '', depth);
  return out;
}

function apiRe_() {
  var cache = CacheService.getScriptCache();
  return {
    realEstateUrl: apiFolderUrl_(API_RE.realEstateId),
    insuranceUrl: apiFolderUrl_(API_RE.insuranceId),
    properties: API_RE.properties.map(function (p) {
      var groups = [], ins = [];
      try { groups = apiTree_(p.folderId, 'Documents', 3, cache, ''); } catch (e) { console.warn('RE ' + p.name + ': ' + e); }
      try { ins = apiTree_(p.insuranceFolderId, 'Insurance', 3, cache, 'Insurance'); } catch (e) { console.warn('RE ins ' + p.name + ': ' + e); }
      var count = 0;
      groups.concat(ins).forEach(function (g) { count += g.files.length; });
      return { slug: p.slug, name: p.name, folderUrl: apiFolderUrl_(p.folderId),
               insuranceFolderUrl: apiFolderUrl_(p.insuranceFolderId), groups: groups, insurance: ins, count: count };
    })
  };
}

function apiIns_() {
  var cache = CacheService.getScriptCache();
  var groups = apiTree_(API_RE.insuranceId, 'General', 3, cache, '');
  var count = 0;
  groups.forEach(function (g) { count += g.files.length; });
  return { name: 'Insurance', folderUrl: apiFolderUrl_(API_RE.insuranceId), groups: groups, count: count,
           properties: API_RE.properties.map(function (p) { return { name: p.name, folderUrl: apiFolderUrl_(p.insuranceFolderId) }; }) };
}

/* ======================================================================= */
/* Lisa's Table — Menu Macros (live from the Sheet) — action=ltmacros       */
/* ======================================================================= */
var API_LT = {
  macrosSheetId: '1YhDpmch8pWIAFKEwrSv7AMwWHyhuVW1OyeqbSNOPk3w',
  recipesId: '1VvrIYV15BX7Rltet2PC7kTxVheUfqMfI',
  menusId: '11tV_huL874mr4F3LdGA-2fvGQZyEWKZY'
};

function apiLtMacros_() {
  var ss = SpreadsheetApp.openById(API_LT.macrosSheetId);
  var sh = ss.getSheets()[0];
  var values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return { sheetUrl: ss.getUrl(), items: [], categories: [] };
  var col = mapHeaders_(values[0], {
    item: ['item'], category: ['category'], serving: ['serving size', 'serving'],
    cal: ['calories (kcal)', 'calories', 'kcal'], protein: ['protein (g)', 'protein'],
    carbs: ['carbs (g)', 'carbs', 'carbohydrates'], fat: ['fat (g)', 'fat'],
    source: ['source doc', 'source'], listings: ['past-menu listings', 'listings'],
    ingredients: ['key ingredients', 'ingredients'], basis: ['basis'], notes: ['notes'], price: ['price']
  });
  // Resolve "Source doc" file names (Recipes + Past Menus) to Drive IDs for in-app links.
  var byName = {}, cache = CacheService.getScriptCache();
  [API_LT.recipesId, API_LT.menusId].forEach(function (fid) {
    try {
      var it = DriveApp.getFolderById(fid).getFiles();
      while (it.hasNext()) {
        var f = it.next(), k = norm_(f.getName());
        if (!byName[k]) byName[k] = f.getId();
        cache.put('cc_anc_' + f.getId(), '1', 21600);
      }
    } catch (e) { console.warn('LT folder ' + fid + ': ' + e); }
  });
  var get = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
  var num = function (v, c) { var n = toNum_(get(v, c)); return n === null ? null : n; };
  var items = [], cats = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r], name = get(v, col.item);
    if (!name) continue;
    var cat = get(v, col.category) || 'Other';
    if (cats.indexOf(cat) < 0) cats.push(cat);
    items.push({
      item: name, category: cat, serving: get(v, col.serving),
      cal: num(v, col.cal), protein: num(v, col.protein), carbs: num(v, col.carbs), fat: num(v, col.fat),
      sources: get(v, col.source).split(/\s*;\s*/).filter(String).map(function (n) {
        return { name: n, id: byName[norm_(n)] || '' };
      }),
      listings: num(v, col.listings), ingredients: get(v, col.ingredients),
      basis: get(v, col.basis), notes: get(v, col.notes),
      price: num(v, col.price),
      row: r + 1, measured: /^measured/i.test(get(v, col.basis))
    });
  }
  return { sheetUrl: ss.getUrl(), sheetName: ss.getName(), items: items, categories: cats,
           missingColumns: Object.keys(col).filter(function (k) { return col[k] < 0 && k !== 'price'; }) };
}

/**
 * action=ltmacroset  (admin; GET params or POST body) — record MEASURED macros for ONE existing row of the Menu Macros sheet.
 *   item     the menu item name; must match an existing row exactly (case / extra spaces ignored). Never adds rows.
 *   cal, protein, carbs, fat   required, non-negative numbers (cal <= 5000, others <= 500; stored with at most 1 decimal)
 *   serving  optional (<= 80 chars)    notes  optional (<= 300 chars; replaces the Notes cell)    row  optional sanity check (the sheet row from ltmacros)
 *   cid      required when writing (idempotency key; repeats return duplicate:'cid')    dry=1 previews and writes nothing
 * Writes ONLY the Calories/Protein/Carbs/Fat cells of that row (+ Serving / Notes when sent) and sets Basis to "Measured YYYY-MM-DD" (PT).
 * Read-back verify + undo (write_failed); the before/after is journaled on the "CC write log" tab of the Daily Spend sheet. No backup tab is created in the macros sheet.
 * Response {ok:true,data:{item:{item,category,serving,cal,protein,carbs,fat,basis,notes,row,measured} (the row AFTER the change), previous:{...}, dry, cid}}
 */
function apiLtMacroSet_(p) {
  p = p || {};
  var name = apiAdminClean_(p.item, 200), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!name) return { error: 'bad_value', message: 'item is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lim = { cal: 5000, protein: 500, carbs: 500, fat: 500 }, nums = {}, keys = ['cal', 'protein', 'carbs', 'fat'];
  for (var k = 0; k < keys.length; k++) {
    var raw = String(p[keys[k]] == null ? '' : p[keys[k]]).replace(/[,\s]/g, '');
    if (!/^\d+(\.\d+)?$/.test(raw)) return { error: 'bad_value', message: keys[k] + ' must be a number of 0 or more.' };
    var n = Math.round(Number(raw) * 10) / 10;
    if (!isFinite(n) || n < 0 || n > lim[keys[k]]) return { error: 'bad_value', message: keys[k] + ' must be between 0 and ' + lim[keys[k]] + '.' };
    nums[keys[k]] = n;
  }
  var hasServing = p.serving != null && String(p.serving).trim() !== '', hasNotes = p.notes != null && String(p.notes).trim() !== '';
  var serving = apiAdminClean_(p.serving, 80), notes = apiAdminClean_(p.notes, 300);
  if ((hasServing && String(p.serving).length > 80) || (hasNotes && String(p.notes).length > 300)) return { error: 'bad_value', message: 'serving is limited to 80 characters and notes to 300.' };
  if (apiAdminHasAcctNo_(serving + ' ' + notes)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var wantRow = p.row == null || String(p.row).trim() === '' ? 0 : parseInt(p.row, 10);
  if (p.row != null && String(p.row).trim() !== '' && !(wantRow >= 2)) return { error: 'bad_value', message: 'row must be a sheet row number.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'ltmacroset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var ss = SpreadsheetApp.openById(API_LT.macrosSheetId), sh = ss.getSheets()[0];
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { error: 'not_found', message: 'The Menu Macros sheet is empty.' };
    var col = mapHeaders_(values[0], {
      item: ['item'], category: ['category'], serving: ['serving size', 'serving'],
      cal: ['calories (kcal)', 'calories', 'kcal'], protein: ['protein (g)', 'protein'],
      carbs: ['carbs (g)', 'carbs', 'carbohydrates'], fat: ['fat (g)', 'fat'], basis: ['basis'], notes: ['notes']
    });
    if (col.item < 0 || col.cal < 0 || col.protein < 0 || col.carbs < 0 || col.fat < 0 || col.basis < 0) return { error: 'no_columns', message: 'Menu Macros needs Item, Calories, Protein, Carbs, Fat and Basis columns.' };
    if (hasServing && col.serving < 0) return { error: 'no_columns', message: 'The sheet has no Serving column.' };
    if (hasNotes && col.notes < 0) return { error: 'no_columns', message: 'The sheet has no Notes column.' };
    var want = norm_(name), hits = [];
    for (var r = 1; r < values.length; r++) if (norm_(values[r][col.item]) === want) hits.push(r);
    if (!hits.length) return { error: 'not_found', message: 'No menu item with that name. Nothing changed.' };
    if (hits.length > 1) return { error: 'ambiguous', message: 'More than one row has that name. Nothing changed.' };
    var idx = hits[0], rowNum = idx + 1;
    if (wantRow && wantRow !== rowNum) return { error: 'row_mismatch', message: 'That item is on a different row now. Reload and try again. Nothing changed.' };
    var today = todayKey_(), basis = 'Measured ' + today;
    var g = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
    var snap = function (v) {
      var gn = function (c) { var n = c >= 0 ? toNum_(v[c]) : null; return n === null ? null : n; };
      var b = g(v, col.basis);
      return { item: g(v, col.item), category: g(v, col.category), serving: g(v, col.serving), cal: gn(col.cal), protein: gn(col.protein), carbs: gn(col.carbs), fat: gn(col.fat),
               basis: b, notes: g(v, col.notes), row: rowNum, measured: /^measured/i.test(b) };
    };
    out.previous = snap(values[idx]);
    var after = snap(values[idx]);
    after.cal = nums.cal; after.protein = nums.protein; after.carbs = nums.carbs; after.fat = nums.fat; after.basis = basis; after.measured = true;
    if (hasServing) after.serving = serving;
    if (hasNotes) after.notes = notes;
    out.item = after;
    if (dry) return { ok: true, data: out };

    var cells = [[col.cal, nums.cal], [col.protein, nums.protein], [col.carbs, nums.carbs], [col.fat, nums.fat], [col.basis, basis]];
    if (hasServing) cells.push([col.serving, serving]);
    if (hasNotes) cells.push([col.notes, notes]);
    var undo = [];
    try {
      cells.forEach(function (cl) {
        var old = values[idx][cl[0]], rng = sh.getRange(rowNum, cl[0] + 1);
        undo.push(function () { rng.setValue(old); });
        rng.setValue(cl[1]);
      });
      SpreadsheetApp.flush();
      var back = sh.getRange(rowNum, 1, 1, values[0].length).getValues()[0];
      if (norm_(back[col.item]) !== want) throw new Error('read-back mismatch (item)');
      cells.forEach(function (cl) {
        var a = back[cl[0]], b = cl[1];
        if (typeof b === 'number' ? Math.abs(Number(a) - b) > 0.0001 : String(a).trim() !== b) throw new Error('read-back mismatch (column ' + (cl[0] + 1) + ')');
      });
      var pv = out.previous;
      apiSpendJournal_(jss, [new Date(), 'ltmacroset', rowNum, 'Menu Macros: ' + after.item.substring(0, 60),
        [pv.cal, pv.protein, pv.carbs, pv.fat, pv.basis].join('/'), [after.cal, after.protein, after.carbs, after.fat, basis].join('/'), cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'ltmacroset', rowNum, 'Menu Macros: ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=menuitemadd  (admin; GET params or POST body) — add ONE new item (row) to the Lisa's Table Menu Macros sheet.
 *   item         required, <= 120 chars; a name that already exists (case / punctuation / spacing ignored) is rejected (duplicate_name)
 *   category     optional, <= 40 chars (an existing category is matched case-insensitively and keeps its spelling)
 *   serving      optional, <= 80      ingredients  optional, <= 300 (line breaks become spaces)
 *   cal, protein, carbs, fat   optional numbers (blank = left empty); cal 0-5000, others 0-500, at most 1 decimal
 *   cid          required when writing (idempotency key; a repeat returns duplicate:'cid')     dry=1 previews and writes nothing
 * Appends ONE row right under the last item row (format copied from that row; the row must be empty, nothing else is touched):
 * Item, Category, Serving size, Calories, Protein, Carbs, Fat, Key ingredients, Basis = 'Estimate — to be measured', Notes = 'Added from app YYYY-MM-DD'.
 * Source doc / Past-menu listings stay empty. Price is NOT stored (the app keeps it on the phone).
 * Read-back verify + undo (write_failed); journaled on the "CC write log" tab. Response {ok:true,data:{item:{...as ltmacros items + row, measured:false}, dry, cid}}
 */
function apiMenuItemAdd_(p) {
  p = p || {};
  var name = apiAdminClean_(p.item, 400), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!name) return { error: 'bad_value', message: 'item is required.' };
  if (name.length > 120) return { error: 'bad_value', message: 'item is limited to 120 characters.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var category = apiAdminClean_(p.category, 400), serving = apiAdminClean_(p.serving, 400), ingredients = apiAdminClean_(p.ingredients, 1000);
  if (category.length > 40) return { error: 'bad_value', message: 'category is limited to 40 characters.' };
  if (serving.length > 80) return { error: 'bad_value', message: 'serving is limited to 80 characters.' };
  if (ingredients.length > 300) return { error: 'bad_value', message: 'ingredients are limited to 300 characters.' };
  if (apiAdminHasAcctNo_(name + ' ' + category + ' ' + serving + ' ' + ingredients)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var lim = { cal: 5000, protein: 500, carbs: 500, fat: 500 }, nums = {}, keys = ['cal', 'protein', 'carbs', 'fat'];
  for (var k = 0; k < keys.length; k++) {
    var raw = String(p[keys[k]] == null ? '' : p[keys[k]]).replace(/[,\s]/g, '');
    if (raw === '') { nums[keys[k]] = ''; continue; }
    if (!/^\d+(\.\d+)?$/.test(raw)) return { error: 'bad_value', message: keys[k] + ' must be a number of 0 or more (or left empty).' };
    var n = Math.round(Number(raw) * 10) / 10;
    if (!isFinite(n) || n < 0 || n > lim[keys[k]]) return { error: 'bad_value', message: keys[k] + ' must be between 0 and ' + lim[keys[k]] + '.' };
    nums[keys[k]] = n;
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'menuitemadd', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var ss = SpreadsheetApp.openById(API_LT.macrosSheetId), sh = ss.getSheets()[0];
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'The Menu Macros sheet has no header row.' };
    var col = mapHeaders_(values[0], {
      item: ['item'], category: ['category'], serving: ['serving size', 'serving'],
      cal: ['calories (kcal)', 'calories', 'kcal'], protein: ['protein (g)', 'protein'],
      carbs: ['carbs (g)', 'carbs', 'carbohydrates'], fat: ['fat (g)', 'fat'],
      ingredients: ['key ingredients', 'ingredients'], basis: ['basis'], notes: ['notes']
    });
    var need = ['item', 'category', 'serving', 'cal', 'protein', 'carbs', 'fat', 'ingredients', 'basis'];
    for (var q = 0; q < need.length; q++) if (col[need[q]] < 0) return { error: 'no_columns', message: 'Menu Macros needs an ' + need[q] + ' column.' };
    var width = values[0].length, want = loose_(name), last = 0, cats = [];
    for (var r = 1; r < values.length; r++) {
      var nm = String(values[r][col.item] == null ? '' : values[r][col.item]).trim();
      if (!nm) continue;
      last = r;
      if (loose_(nm) === want) return { error: 'duplicate_name', message: 'There is already a menu item called "' + nm + '". Nothing was added.' };
      var ct = String(values[r][col.category] == null ? '' : values[r][col.category]).trim();
      if (ct && cats.indexOf(ct) < 0) cats.push(ct);
    }
    for (var c = 0; c < cats.length; c++) if (norm_(cats[c]) === norm_(category)) category = cats[c];
    var rowNum = last + 2;                       // 1-based row right under the last item row
    if (rowNum <= values.length) {
      var occ = values[rowNum - 1];
      for (var z = 0; z < occ.length; z++) if (String(occ[z] == null ? '' : occ[z]).trim() !== '') return { error: 'row_occupied', message: 'The row under the last menu item is not empty. Nothing was added.' };
    }
    var today = todayKey_(), basis = 'Estimate \u2014 to be measured', note = 'Added from app ' + today;
    var rowVals = []; for (var w = 0; w < width; w++) rowVals.push('');
    rowVals[col.item] = name; rowVals[col.category] = category; rowVals[col.serving] = serving;
    rowVals[col.cal] = nums.cal; rowVals[col.protein] = nums.protein; rowVals[col.carbs] = nums.carbs; rowVals[col.fat] = nums.fat;
    rowVals[col.ingredients] = ingredients; rowVals[col.basis] = basis; if (col.notes >= 0) rowVals[col.notes] = note;
    out.item = { item: name, category: category || 'Other', serving: serving,
      cal: nums.cal === '' ? null : nums.cal, protein: nums.protein === '' ? null : nums.protein, carbs: nums.carbs === '' ? null : nums.carbs, fat: nums.fat === '' ? null : nums.fat,
      sources: [], listings: null, ingredients: ingredients, basis: basis, notes: col.notes >= 0 ? note : '', row: rowNum, measured: false };
    if (dry) return { ok: true, data: out };

    var undo = [], added = false;
    try {
      if (rowNum > sh.getMaxRows()) { sh.insertRowAfter(sh.getMaxRows()); added = true; undo.push(function () { sh.deleteRow(rowNum); }); }
      var target = sh.getRange(rowNum, 1, 1, width);
      undo.push(function () { target.clearContent(); });
      try { if (last >= 1) sh.getRange(last + 1, 1, 1, width).copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (fe) { /* formatting is cosmetic */ }
      target.setValues([rowVals]);
      SpreadsheetApp.flush();
      var back = sh.getRange(rowNum, 1, 1, width).getValues()[0];
      if (String(back[col.item]).trim() !== name) throw new Error('read-back mismatch (item)');
      for (var kk = 0; kk < keys.length; kk++) {
        var bv = back[col[keys[kk]]], wv = nums[keys[kk]];
        if (wv === '' ? String(bv).trim() !== '' : Math.abs(Number(bv) - wv) > 0.0001) throw new Error('read-back mismatch (' + keys[kk] + ')');
      }
      if (String(back[col.basis]).trim() !== basis) throw new Error('read-back mismatch (basis)');
      apiSpendJournal_(jss, [new Date(), 'menuitemadd', rowNum, 'Menu Macros: add ' + name.substring(0, 60), '', [category, serving, nums.cal, nums.protein, nums.carbs, nums.fat].join('/') + (added ? ' (row inserted)' : ''), cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'menuitemadd', rowNum, 'Menu Macros: ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row cleared') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* Lisa's Table — file a menu PDF made on the phone — action=ltmenusave (v53) */
/* ======================================================================= */
var API_LTM = {
  MAX_BYTES: 8 * 1024 * 1024,                      // decoded PDF size limit
  MAX_B64: Math.ceil(8 * 1024 * 1024 / 3) * 4 + 8,
  DESC_TAG: 'CC ltmenusave '                      // file description = tag + {"cid":..,"week":..} (finds a retry even if the journal write failed)
};
function apiLtmFindCid_(ss, folder, cid) {
  var jt = ss.getSheetByName(API_SPENDFIX_CFG.journalTab);
  if (jt && jt.getLastRow() >= 2) {
    var v = jt.getRange(2, 1, jt.getLastRow() - 1, 7).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      if (String(v[i][1]) === 'ltmenusave' && String(v[i][6]) === cid) {
        var m = String(v[i][5]).split(' | ');
        try { var f = DriveApp.getFileById(m[0]); if (!f.isTrashed()) return f; } catch (e) { /* gone: look in the folder */ }
      }
    }
  }
  var it = folder.getFilesByType('application/pdf');
  while (it.hasNext()) {
    var g = it.next(), d = String(g.getDescription() || '');
    if (d.indexOf(API_LTM.DESC_TAG) === 0) {
      try { if (JSON.parse(d.slice(API_LTM.DESC_TAG.length)).cid === cid && !g.isTrashed()) return g; } catch (e2) { /* not ours */ }
    }
  }
  return null;
}
/**
 * action=ltmenusave  (admin; POST JSON body, or GET params for dry=1 checks)
 *   cid    required when writing (idempotency key: the same cid never files two PDFs; a repeat returns the first file, duplicate:'cid')
 *   name   file name, e.g. "Lisa's Table Menu 2026-10-12.pdf" (cleaned, max 120 characters, ".pdf" added)
 *   week   optional yyyy-mm-dd (kept in the file description)
 *   data   base64 PDF (a data: URL prefix is tolerated); decoded size <= 8 MB; must start with %PDF- and end with %%EOF
 *   dry=1  validate + show the final name; nothing is created or logged (data optional)
 * Saves into Drive > Lisa's Table > Past Menus (API_LT.menusId, the folder the app lists as Past Menus).
 * An existing file with the same name is NEVER overwritten: ' (2)', ' (3)' ... is added before .pdf.
 * Response {ok:true,data:{id,url,name,folderUrl,bytes,cid,dry,version:53[,duplicate:'cid']}}
 */
function apiLtMenuSave_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80);
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var base = String(p.name == null ? '' : p.name).replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\.pdf$/i, '').trim().substring(0, 120);
  var week = p.week ? apiAdminDate_(p.week) : '';
  if (p.week && !week) return { error: 'bad_value', message: 'week must be a date like 2026-10-12.' };
  if (!base) base = "Lisa's Table Menu " + (week || todayKey_());
  var bytes = null;
  if (p.data != null && String(p.data) !== '') {
    var b64 = String(p.data).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (b64.length > API_LTM.MAX_B64) return { error: 'too_big', message: 'The PDF is larger than 8 MB.' };
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'bad_value', message: 'data must be base64.' };
    try { bytes = Utilities.base64Decode(b64); } catch (e1) { return { error: 'bad_value', message: 'data is not valid base64.' }; }
    var n = bytes.length;
    if (n > API_LTM.MAX_BYTES) return { error: 'too_big', message: 'The PDF is larger than 8 MB.' };
    var head = String.fromCharCode(bytes[0] & 255, bytes[1] & 255, bytes[2] & 255, bytes[3] & 255, bytes[4] & 255);
    if (n < 200 || head !== '%PDF-') return { error: 'bad_value', message: 'data is not a PDF.' };
    var tail = ''; for (var t = Math.max(0, n - 64); t < n; t++) tail += String.fromCharCode(bytes[t] & 255);
    if (tail.indexOf('%%EOF') < 0) return { error: 'bad_value', message: 'The PDF looks cut off (upload incomplete). Try again.' };
  } else if (!dry) {
    return { error: 'bad_value', message: 'data (base64 PDF) is required when writing.' };
  }
  var folder;
  try { folder = DriveApp.getFolderById(API_LT.menusId); folder.getName(); } catch (fe) { return { error: 'not_found', message: 'The Past Menus folder was not found.' }; }
  var out = { dry: dry, cid: cid, name: base + '.pdf', folderUrl: 'https://drive.google.com/drive/folders/' + API_LT.menusId, version: 53 };
  if (bytes) out.bytes = bytes.length;
  var uniq = function () { var nm = base + '.pdf', k = 2; while (folder.getFilesByName(nm).hasNext() && k < 100) { nm = base + ' (' + k + ').pdf'; k++; } return nm; };
  if (dry) { out.name = uniq(); return { ok: true, data: out }; }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  var file = null;
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var seen = apiLtmFindCid_(ss, folder, cid);
    if (seen) { out.duplicate = 'cid'; out.id = seen.getId(); out.url = seen.getUrl(); out.name = seen.getName(); return { ok: true, data: out }; }
    var finalName = uniq();
    try {
      file = folder.createFile(Utilities.newBlob(bytes, 'application/pdf', finalName));
      file.setDescription(API_LTM.DESC_TAG + JSON.stringify({ cid: cid, week: week }));
      if (file.getSize() !== bytes.length) throw new Error('size mismatch after upload (' + file.getSize() + ' vs ' + bytes.length + ')');
    } catch (werr) {
      var undone = true;
      try { if (file) file.setTrashed(true); } catch (e5) { undone = false; }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: undone };
    }
    out.name = finalName; out.id = file.getId(); out.url = file.getUrl();
    try { apiSpendJournal_(ss, [new Date(), 'ltmenusave', '', 'Past Menus: ' + finalName, '', out.id + ' | ' + out.url + ' | ' + (week || '') + ' | ' + bytes.length + ' bytes', cid]); }
    catch (e7) { out.journalFailed = true; }   // the file carries the cid in its description, so a retry still finds it
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* Lisa's Table — save a generated weekly menu as a Google Doc — action=menusave */
/* ======================================================================= */
var API_MENU = {
  folderId: '1Uo8uyqem_MVHk4Laxu4QX58YZukACJXk',   // Drive > Menu Designs
  maxItems: 30,
  footer: [
    '$5 delivery fee will be added to all deliveries. If multiple orders at the same location exist the fee will be $3 Thank you for your understanding',
    'For preorders please text Lisa by Friday before delivery. Deliveries can be made Tuesday mid-morning',
    'Large or small Charcuterie boards available for preorder, Please text or call Lisa 209-768-9222'
  ]
};
function apiMenuOrd_(n) {
  var s = n % 100;
  return n + ((s >= 11 && s <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th');
}
function apiMenuDate_(s) {
  var d = apiAdminDate_(s);
  if (!d) return null;
  var m = d.split('-');
  return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]), 12);
}
/** '12' -> '$12', '12.5' -> '$12.50', '' -> ''; null when not a price. */
function apiMenuPrice_(v) {
  var s = String(v == null ? '' : v).replace(/[$\s]/g, '');
  if (s === '') return '';
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  var n = Number(s);
  return '$' + (n === Math.floor(n) ? String(n) : n.toFixed(2));
}
/** The menu as ordered text blocks [{t:'title'|'week'|'deliv'|'div'|'item'|'desc'|'foot', text}]. Same layout as the app preview. */
function apiMenuBlocks_(week, deliver, items) {
  var MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  var b = [{ t: 'title', text: "Lisa's Table Menu" },
           { t: 'week', text: 'Menu week of ' + MN[week.getMonth()] + ' ' + apiMenuOrd_(week.getDate()) },
           { t: 'deliv', text: 'DELIVERY OR PICKUP ON ' + DN[deliver.getDay()] + ' THE ' + apiMenuOrd_(deliver.getDate()).toUpperCase() },
           { t: 'div', text: '\u25C6' }];
  items.forEach(function (it) {
    b.push({ t: 'item', text: it.name + (it.price ? ' ' + it.price : '') });
    if (it.desc) b.push({ t: 'desc', text: it.desc });
  });
  b.push({ t: 'div', text: '\u25C6' });
  API_MENU.footer.forEach(function (f) { b.push({ t: 'foot', text: f }); });
  return b;
}

/**
 * action=menusave  (admin; GET params or POST body) — create ONE Google Doc in Drive > Menu Designs with the weekly menu layout.
 *   week     yyyy-mm-dd, the "Menu week of" date          deliver  yyyy-mm-dd, delivery / pickup day
 *   items    JSON array (or array in a POST body) of {name, price?, desc?}; 1-30 items, order kept. price like 12 or 12.50; name <= 120, desc <= 300 chars
 *   cid      required when writing (a repeat returns the same doc: duplicate:'cid', url)    dry=1 previews (name + text) and creates nothing
 * Doc name 'Menu - <week>' (yyyy-mm-dd); an existing file with that name is NEVER overwritten: ' (2)', ' (3)' ... is appended.
 * Response {ok:true,data:{name,url,id,folderUrl,text,dry,cid}}
 */
function apiMenuSave_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var week = apiMenuDate_(p.week), deliver = apiMenuDate_(p.deliver);
  if (!week) return { error: 'bad_value', message: 'week must be a date like 2026-10-05.' };
  if (!deliver) return { error: 'bad_value', message: 'deliver must be a date like 2026-10-06.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var raw = p.items;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return { error: 'bad_value', message: 'items must be a JSON array.' }; } }
  if (!raw || Object.prototype.toString.call(raw) !== '[object Array]' || !raw.length) return { error: 'bad_value', message: 'items must be a non-empty array.' };
  if (raw.length > API_MENU.maxItems) return { error: 'bad_value', message: 'At most ' + API_MENU.maxItems + ' items.' };
  var items = [], total = 0;
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i] || {}, nm = apiAdminClean_(r.name, 400), ds = apiAdminClean_(r.desc, 600), pr = apiMenuPrice_(r.price);
    if (!nm || nm.length > 120) return { error: 'bad_value', message: 'Item ' + (i + 1) + ': name is required (max 120 characters).' };
    if (ds.length > 300) return { error: 'bad_value', message: 'Item ' + (i + 1) + ': description is limited to 300 characters.' };
    if (pr === null) return { error: 'bad_value', message: 'Item ' + (i + 1) + ': price must be a number like 12 or 12.50.' };
    if (apiAdminHasAcctNo_(nm + ' ' + ds)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
    total += nm.length + ds.length;
    items.push({ name: nm, price: pr, desc: ds });
  }
  if (total > 6000) return { error: 'bad_value', message: 'Menu text is too long.' };
  var blocks = apiMenuBlocks_(week, deliver, items);
  var text = blocks.map(function (b) { return b.text; }).join('\n');
  var base = 'Menu - ' + apiAdminDate_(p.week), out = { dry: dry, cid: cid, text: text, name: base };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var folder;
    try { folder = DriveApp.getFolderById(API_MENU.folderId); folder.getName(); } catch (fe) { return { error: 'not_found', message: 'The Menu Designs folder was not found.' }; }
    out.folderUrl = 'https://drive.google.com/drive/folders/' + API_MENU.folderId;
    var name = base, n = 2;
    while (folder.getFilesByName(name).hasNext() && n < 50) { name = base + ' (' + n + ')'; n++; }
    out.name = name;
    if (dry) return { ok: true, data: out };
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var jt = jss.getSheetByName(API_SPENDFIX_CFG.journalTab);
    if (jt && jt.getLastRow() >= 2) {
      var jv = jt.getRange(2, 1, jt.getLastRow() - 1, 7).getValues();
      for (var j = 0; j < jv.length; j++) {
        if (String(jv[j][1]) === 'menusave' && String(jv[j][6]) === cid) {
          out.duplicate = 'cid'; out.url = String(jv[j][5]); out.name = String(jv[j][3]).replace(/^Menu Designs: /, '');
          var mm = out.url.match(/\/d\/([\w-]+)/); if (mm) out.id = mm[1];
          return { ok: true, data: out };
        }
      }
    }
    var doc = DocumentApp.create(name), id = doc.getId();
    try {
      var body = doc.getBody(), A = DocumentApp.HorizontalAlignment.CENTER;
      body.clear();
      body.setMarginTop(54).setMarginBottom(54).setMarginLeft(54).setMarginRight(54);
      var style = { title: [28, true, false, 6, 4], week: [16, false, true, 2, 8], deliv: [11, true, false, 2, 10], div: [14, false, false, 6, 6],
                    item: [13, true, false, 10, 0], desc: [11, false, false, 0, 4], foot: [10, false, false, 8, 0] };
      blocks.forEach(function (bl, bi) {
        var par;
        if (bi === 0 && body.getNumChildren() && body.getChild(0).getType() === DocumentApp.ElementType.PARAGRAPH) { par = body.getChild(0).asParagraph(); par.setText(bl.text); }
        else par = body.appendParagraph(bl.text);
        var s = style[bl.t];
        par.setAlignment(A).setFontFamily('Georgia').setFontSize(s[0]).setBold(s[1]).setItalic(s[2]).setForegroundColor('#3b2a20').setSpacingBefore(s[3]).setSpacingAfter(s[4]).setLineSpacing(1.15);
      });
      doc.saveAndClose();
      var file = DriveApp.getFileById(id);
      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
      out.id = id; out.url = 'https://docs.google.com/document/d/' + id + '/edit';
      apiSpendJournal_(jss, [new Date(), 'menusave', '', 'Menu Designs: ' + name, '', out.url, cid]);
    } catch (werr) {
      try { DriveApp.getFileById(id).setTrashed(true); } catch (te) { /* leave it */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr) };
    }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* Business documents (Life areas > Business) — action=biz                  */
/* Snapshot of the Second Brain "Business" folder (KiwiT LLC is live, see below) */
/* 2026-09-28. Served only behind the passcode (the GitHub repo is public). */
/* To refresh: regenerate API_BIZ (links are plain Drive URLs).             */
/* ======================================================================= */
/**
 * KiwiT LLC is LIVE (listed from Drive at request time, like apiRe_/apiTree_); every other business stays the static snapshot.
 * Lists Second Brain > Business > KiwiT LLC: its own files (group "Company documents") plus subfolders such as
 * "Business Documents" (group named after the subfolder; deeper folders "Parent › Child"). Falls back to the snapshot on any error.
 * Restricted to the Second Brain tree via apiIsAllowed_ (same check as the file/folder proxy).
 */
var API_BIZ_KIWIT_FOLDER_ID = '12ZpqkmVCR5tcUZ3YYh1rruzjePXpaFq0';
function apiBiz_() {
  var out = JSON.parse(JSON.stringify(API_BIZ));
  try {
    var live = apiBizKiwitLive_();
    for (var i = 0; i < out.businesses.length; i++) {
      if (out.businesses[i].slug === 'kiwit') {
        out.businesses[i].groups = live.groups;
        out.businesses[i].count = live.count;
        out.businesses[i].live = true;
        if (live.businessDocumentsFolderId) out.businesses[i].businessDocumentsFolderId = live.businessDocumentsFolderId;
      }
    }
    out.updated = 'live';
  } catch (e) { console.warn('biz kiwit live: ' + e); }
  return out;
}

function apiBizKiwitLive_() {
  var cache = CacheService.getScriptCache();
  var root = DriveApp.getFolderById(API_BIZ_KIWIT_FOLDER_ID);
  if (!apiIsAllowed_(root, API_BIZ_KIWIT_FOLDER_ID)) throw new Error('KiwiT folder outside Second Brain');
  var groups = [], count = 0, bdId = '';
  function sortByName(a, b) { return a.getName().toLowerCase() < b.getName().toLowerCase() ? -1 : 1; }
  (function walk(folder, name, d) {
    var files = [], it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next(), fid = f.getId(), mime = f.getMimeType();
      files.push({ name: f.getName(), id: fid, url: 'https://drive.google.com/file/d/' + fid + '/view', mime: mime,
                   type: mime, modified: f.getLastUpdated().toISOString() });
      cache.put('cc_anc_' + fid, '1', 21600);
    }
    files.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
    if (files.length) {
      var g = { name: name, files: files };
      if (folder.getId() !== API_BIZ_KIWIT_FOLDER_ID) g.folderUrl = apiFolderUrl_(folder.getId());
      groups.push(g);
      count += files.length;
    }
    if (d <= 0) return;
    var subs = [], fi = folder.getFolders();
    while (fi.hasNext()) subs.push(fi.next());
    subs.sort(sortByName);
    subs.forEach(function (sf) {
      cache.put('cc_anc_' + sf.getId(), '1', 21600);
      var nm = name === 'Company documents' ? sf.getName() : name + ' \u203a ' + sf.getName();
      if (d === 2 && sf.getName() === 'Business Documents') bdId = sf.getId();
      walk(sf, nm, d - 1);
    });
  })(root, 'Company documents', 2);
  return { groups: groups, count: count, businessDocumentsFolderId: bdId };
}

var API_BIZ = {
 "updated": "2026-09-28",
 "rootUrl": "https://drive.google.com/drive/folders/1wH4ME6ijwYURsjq4E-g0wkliiMyglpbD",
 "businesses": [
  {
   "slug": "sierra",
   "name": "Sierra Consultants Land Structure",
   "short": "Sierra Consultants",
   "sub": "Land & Structure",
   "folderUrl": "https://drive.google.com/drive/folders/14F6IN2CNINxWDODUcwjPqVeUlo-92KK1",
   "groups": [
    {
     "name": "401(k) Profit Sharing",
     "decision": [
      "Whether Land & Structure adopts a 2027 safe harbor 401(k) with profit sharing, and if so, which design.",
      "Option A, 3% safe harbor nonelective: employer cost $151,424.16. Every eligible employee gets 3% whether or not they defer; about 70.9% of employer money goes to the three owners ($107,329.58).",
      "Option B, safe harbor match: employer cost $179,983.36 (+$28,559.20). Rewards employees who defer; owners get $111,162.78 (+$3,833.20) while other employees get about $24,726 more.",
      "The comparison memo recommends Option A.",
      "Not stated in the documents: plan fees, vesting schedule, adoption deadlines. Confirm these with the plan administrator. All figures are projections based on current pay, staffing and deferral assumptions."
     ],
     "files": [
      {
       "name": "Safe Harbor Match vs Safe Harbor 3%.pdf",
       "id": "1uY8GJ_EOwHthbi64k-2rME0knsn9Ufti",
       "url": "https://drive.google.com/file/d/1uY8GJ_EOwHthbi64k-2rME0knsn9Ufti/view",
       "mime": "application/pdf",
       "synopsis": "A side-by-side memo comparing the two 2027 proposals. Total employer cost: $151,424.16 for the 3% nonelective design vs $179,983.36 for the match (100% of the first 3% deferred plus 50% of the next 2%, up to 4% of pay), a difference of $28,559.20. The three owners (Zachariah Garman, Richard James, Kevin Quincy) receive $107,329.58 (about 70.9% of employer money) under 3% vs $111,162.78 (about 61.8%) under the match; Zac's own employer contribution is $32,889.51 vs $34,064.13. It recommends the 3% nonelective design unless the main goal is to encourage employees to defer."
      },
      {
       "name": "Land & Structure 2027 Proposal - Scenario 1.pdf",
       "id": "1vrOcKA9lI5BKel-T1TYQJ4anKAnr1Sn3",
       "url": "https://drive.google.com/file/d/1vrOcKA9lI5BKel-T1TYQJ4anKAnr1Sn3/view",
       "mime": "application/pdf",
       "synopsis": "Allocation report for the Land & Structure 401(k) Profit Sharing Plan and Trust (proposal dated 12/31/2027) under a 3% safe harbor nonelective design plus profit sharing: the company puts 3% of pay into every eligible employee's account whether or not they defer. Plan totals: eligible compensation $1,178,162.74, employee deferrals $146,394.46, profit sharing $116,079.26, safe harbor $35,344.90, total contributions $297,818.62. The preparer is not named in the document."
      },
      {
       "name": "Land & Structure 2027 Proposal - Scenario 2.pdf",
       "id": "1mnCjLZFGC0EKmxN4BbDpZJrYF4fb8MYe",
       "url": "https://drive.google.com/file/d/1mnCjLZFGC0EKmxN4BbDpZJrYF4fb8MYe/view",
       "mime": "application/pdf",
       "synopsis": "Same plan and employee census (dated 12/31/2027), but using a safe harbor matching contribution plus profit sharing, so employees must defer to get the match. Plan totals: employee deferrals $146,394.46 (unchanged), profit sharing $135,572.13, safe harbor match $44,411.23, total contributions $326,377.82. It costs more than Scenario 1 mainly because profit sharing for non-owner employees goes up."
      }
     ]
    }
   ],
   "count": 3
  },
  {
   "slug": "kiwit",
   "name": "KiwiT LLC",
   "short": "KiwiT LLC",
   "sub": "",
   "folderUrl": "https://drive.google.com/drive/folders/12ZpqkmVCR5tcUZ3YYh1rruzjePXpaFq0",
   "groups": [
    {
     "name": "Company documents",
     "files": [
      {
       "name": "Filed - Article KiwiT.pdf",
       "id": "1eGSbWCygAKAVSTtmgxo_IvBGeJ4x1fi0",
       "url": "https://drive.google.com/file/d/1eGSbWCygAKAVSTtmgxo_IvBGeJ4x1fi0/view",
       "mime": "application/pdf"
      },
      {
       "name": "Filed SOI 2.27- KiwiT -- Addition of Lisa.pdf",
       "id": "16zb3nONtjg8gDxKsVdzYmIR9PbpkbliJ",
       "url": "https://drive.google.com/file/d/16zb3nONtjg8gDxKsVdzYmIR9PbpkbliJ/view",
       "mime": "application/pdf"
      },
      {
       "name": "FTB -- KiwiT -TiwiK.pdf",
       "id": "1f2P-l1g2yEllgyBtt0sQ3yO3oV2l11e9",
       "url": "https://drive.google.com/file/d/1f2P-l1g2yEllgyBtt0sQ3yO3oV2l11e9/view",
       "mime": "application/pdf"
      },
      {
       "name": "KiwiT Operating Agreement-executed.pdf",
       "id": "1zf3aRj6JJa11reCaELSG3aQk1FGb2ovS",
       "url": "https://drive.google.com/file/d/1zf3aRj6JJa11reCaELSG3aQk1FGb2ovS/view",
       "mime": "application/pdf"
      }
     ]
    }
   ],
   "count": 4
  },
  {
   "slug": "tiwik",
   "name": "TiwiK Laundromat",
   "short": "TiwiK Laundromat",
   "sub": "Mono Village Laundromat",
   "folderUrl": "https://drive.google.com/drive/folders/1qnUwTQdVeoNVAoFzXlvmJncini7HAxU7",
   "groups": [
    {
     "name": "Operations & Staffing",
     "folderUrl": "https://drive.google.com/drive/folders/1e_VlZKG-enmPO68UZPBnZYq3bsCjMRKp",
     "files": [
      {
       "name": "Filed - Articles TiwiK.pdf",
       "id": "17EGvY7jcywMJZrFjIq1P4HTH3K8s-qd3",
       "url": "https://drive.google.com/file/d/17EGvY7jcywMJZrFjIq1P4HTH3K8s-qd3/view",
       "mime": "application/pdf"
      },
      {
       "name": "Filed SOI 2.27 - TiwiK -- Addition of Lisa.pdf",
       "id": "16EKkMNZt4zuM7psQctNwVBtTT1PTzvmT",
       "url": "https://drive.google.com/file/d/16EKkMNZt4zuM7psQctNwVBtTT1PTzvmT/view",
       "mime": "application/pdf"
      },
      {
       "name": "Mono -- Business Lease.pdf",
       "id": "1msUgH6s-3dEcw7pAG7GsG8Y8o1AMAGCK",
       "url": "https://drive.google.com/file/d/1msUgH6s-3dEcw7pAG7GsG8Y8o1AMAGCK/view",
       "mime": "application/pdf"
      },
      {
       "name": "TiwiK Operating Agreement-executed.pdf",
       "id": "1aFngRdm1ZYCHoDAvNT9m9bJEoe9G28sk",
       "url": "https://drive.google.com/file/d/1aFngRdm1ZYCHoDAvNT9m9bJEoe9G28sk/view",
       "mime": "application/pdf"
      },
      {
       "name": "TiwiK S-corp Election.pdf",
       "id": "1nZNsQ0uoQXNPFapeWXXep7v4vOgEYyW6",
       "url": "https://drive.google.com/file/d/1nZNsQ0uoQXNPFapeWXXep7v4vOgEYyW6/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Marketing › Advertisement",
     "folderUrl": "https://drive.google.com/drive/folders/1KBbtZPKqiHSWmyJ4WBKHmxK2OFF2uqmn",
     "files": [
      {
       "name": "IMG_0661.jpg",
       "id": "1ERfYev-dtdOzRYbahLiaDwE8iByYMk4C",
       "url": "https://drive.google.com/file/d/1ERfYev-dtdOzRYbahLiaDwE8iByYMk4C/view",
       "mime": "image/jpeg"
      },
      {
       "name": "IMG_0662.jpg",
       "id": "1pDPPg8RMMHinu5QT6JY8PtPRZqpQZsJs",
       "url": "https://drive.google.com/file/d/1pDPPg8RMMHinu5QT6JY8PtPRZqpQZsJs/view",
       "mime": "image/jpeg"
      },
      {
       "name": "IMG_0663.jpg",
       "id": "1AfsFzmv5PSXxR-bs5oOAqHvcTAWuMju4",
       "url": "https://drive.google.com/file/d/1AfsFzmv5PSXxR-bs5oOAqHvcTAWuMju4/view",
       "mime": "image/jpeg"
      },
      {
       "name": "LOGO.docx",
       "id": "1QxofoXAvvNTfoTksdUJcTg4RIqAyUKtX",
       "url": "https://docs.google.com/document/d/1QxofoXAvvNTfoTksdUJcTg4RIqAyUKtX/edit",
       "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      {
       "name": "Mono_Village_Laundromat_Flyer_BOLD.pdf",
       "id": "1IN8sU35uRi48RJlHX2cgg8VOta_efsaS",
       "url": "https://drive.google.com/file/d/1IN8sU35uRi48RJlHX2cgg8VOta_efsaS/view",
       "mime": "application/pdf"
      },
      {
       "name": "mono_village_laundromat_logo.jpg",
       "id": "12IctHJz1-b-Y3iF-uMRTyldx2ieWN-kP",
       "url": "https://drive.google.com/file/d/12IctHJz1-b-Y3iF-uMRTyldx2ieWN-kP/view",
       "mime": "image/jpeg"
      },
      {
       "name": "pics.docx",
       "id": "1-ZKPEKM2ZYeU6phYwoasedHpGk22w6fn",
       "url": "https://docs.google.com/document/d/1-ZKPEKM2ZYeU6phYwoasedHpGk22w6fn/edit",
       "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
     ]
    },
    {
     "name": "Fluff and Fold",
     "folderUrl": "https://drive.google.com/drive/folders/1afIY6VKvQT0qNMcxgfLvsPgYMLG89JNc",
     "files": [
      {
       "name": "Fluff and fold.docx",
       "id": "12KSrBmsByqPjvdB00umoQR0YFQ3VqlSx",
       "url": "https://docs.google.com/document/d/12KSrBmsByqPjvdB00umoQR0YFQ3VqlSx/edit",
       "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase",
     "folderUrl": "https://drive.google.com/drive/folders/1sXW-u6_UFOaIyIgoxrIl8pu_u3pR7JaK",
     "files": [
      {
       "name": "0283266-2001 Loan Documents.pdf",
       "id": "1LdJKdpI77IXxwlzaU-J5IkOqP8hoBbSP",
       "url": "https://drive.google.com/file/d/1LdJKdpI77IXxwlzaU-J5IkOqP8hoBbSP/view",
       "mime": "application/pdf"
      },
      {
       "name": "AC2225.pdf",
       "id": "19gDl6JdpGii0fA3xnxzclyWGdyZcPCFk",
       "url": "https://drive.google.com/file/d/19gDl6JdpGii0fA3xnxzclyWGdyZcPCFk/view",
       "mime": "application/pdf"
      },
      {
       "name": "ALCO- Change Machine Est. --exec..pdf",
       "id": "11AETS7KMQSZ0kDF34HOrjsthf65s2uNq",
       "url": "https://drive.google.com/file/d/11AETS7KMQSZ0kDF34HOrjsthf65s2uNq/view",
       "mime": "application/pdf"
      },
      {
       "name": "AlcoEstimate--Executed (R 10.06.25).pdf",
       "id": "11sE8LP_MnzimL9whOOGfzgVdhz1HiR0i",
       "url": "https://drive.google.com/file/d/11sE8LP_MnzimL9whOOGfzgVdhz1HiR0i/view",
       "mime": "application/pdf"
      },
      {
       "name": "AlcoEstimate--Executed.pdf",
       "id": "1P_J__Qkdu1664VSQ_ZitLuts3dXcfEm7",
       "url": "https://drive.google.com/file/d/1P_J__Qkdu1664VSQ_ZitLuts3dXcfEm7/view",
       "mime": "application/pdf"
      },
      {
       "name": "Coin Machine Receipt.pdf",
       "id": "1mgVI5BMdnKj1Uri3MfJnbOTYD3a9z0pa",
       "url": "https://drive.google.com/file/d/1mgVI5BMdnKj1Uri3MfJnbOTYD3a9z0pa/view",
       "mime": "application/pdf"
      },
      {
       "name": "D. Wagner - LM Plumbing.pdf",
       "id": "1YDSEDw54KXNYnurXjxaxWt3cMCRNKMF2",
       "url": "https://drive.google.com/file/d/1YDSEDw54KXNYnurXjxaxWt3cMCRNKMF2/view",
       "mime": "application/pdf"
      },
      {
       "name": "Equip Dimensions.pdf",
       "id": "1mFK8vYpFY-Z1bes8X_II688rBFV2KwXd",
       "url": "https://drive.google.com/file/d/1mFK8vYpFY-Z1bes8X_II688rBFV2KwXd/view",
       "mime": "application/pdf"
      },
      {
       "name": "Equip Floor Plan 09.13.25.jpg",
       "id": "17ZZoryNFfr6w8OHrznbNcLi8ZiX0Vh6l",
       "url": "https://drive.google.com/file/d/17ZZoryNFfr6w8OHrznbNcLi8ZiX0Vh6l/view",
       "mime": "image/jpeg"
      },
      {
       "name": "Estimate_36057_-__Mono_Village_Laundromat.pdf",
       "id": "122auXLXLbIvJZvAU1TkhEPzlzF-_eJ5K",
       "url": "https://drive.google.com/file/d/122auXLXLbIvJZvAU1TkhEPzlzF-_eJ5K/view",
       "mime": "application/pdf"
      },
      {
       "name": "Galaxy_600_Washer_and_Dryer_Extractor_series (1).pdf",
       "id": "1pIuHbBCqBGK4ZOsjpRuNJuP4icuQvSNE",
       "url": "https://drive.google.com/file/d/1pIuHbBCqBGK4ZOsjpRuNJuP4icuQvSNE/view",
       "mime": "application/pdf"
      },
      {
       "name": "Galaxy_600_Washer_and_Dryer_Extractor_series.pdf",
       "id": "1ejLtwz7RXZ5KSTbGjxw6itMwDciaI6Qq",
       "url": "https://drive.google.com/file/d/1ejLtwz7RXZ5KSTbGjxw6itMwDciaI6Qq/view",
       "mime": "application/pdf"
      },
      {
       "name": "H.Ballou- LM --Electrical.pdf",
       "id": "1ejzDkG50Kt7OtnPPXzmIlJPE5xFmNoqT",
       "url": "https://drive.google.com/file/d/1ejzDkG50Kt7OtnPPXzmIlJPE5xFmNoqT/view",
       "mime": "application/pdf"
      },
      {
       "name": "Invoice_37650 .pdf",
       "id": "1Y7hD9iRcwb1SB1bbBlhWRrht2Y19TNY0",
       "url": "https://drive.google.com/file/d/1Y7hD9iRcwb1SB1bbBlhWRrht2Y19TNY0/view",
       "mime": "application/pdf"
      },
      {
       "name": "Invoice_37650.pdf",
       "id": "1oNHxKAnIFkNM0i4h2AEMT4yeDaK_D3gn",
       "url": "https://drive.google.com/file/d/1oNHxKAnIFkNM0i4h2AEMT4yeDaK_D3gn/view",
       "mime": "application/pdf"
      },
      {
       "name": "L.Garman DL.docx",
       "id": "1EsMsZcWvNF2oM5Z8jM08GfF1lEjqaCAq",
       "url": "https://docs.google.com/document/d/1EsMsZcWvNF2oM5Z8jM08GfF1lEjqaCAq/edit",
       "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      },
      {
       "name": "L.Garman DL.pdf",
       "id": "18LYP0QlXa4tpc8xNG4FRXDVUEUd4_tLI",
       "url": "https://drive.google.com/file/d/18LYP0QlXa4tpc8xNG4FRXDVUEUd4_tLI/view",
       "mime": "application/pdf"
      },
      {
       "name": "LAUNDROMAT LAYOUT.jpg",
       "id": "1RfXUsV8-O8fi0Q67mKMWq6N9Fq6hPOZl",
       "url": "https://drive.google.com/file/d/1RfXUsV8-O8fi0Q67mKMWq6N9Fq6hPOZl/view",
       "mime": "image/jpeg"
      },
      {
       "name": "Please_DocuSign_Huebsch_Loan_Documents_-_Zac (2).pdf",
       "id": "19eClQwm_6-SDvj-7_nJFFc42dgwD0iFc",
       "url": "https://drive.google.com/file/d/19eClQwm_6-SDvj-7_nJFFc42dgwD0iFc/view",
       "mime": "application/pdf"
      },
      {
       "name": "Visionrite brochure-vision_es_combo_vender-coin_L_C.pdf",
       "id": "14DyQZZAO2Q9cFBkRe-tNLbSDbeeIp3kM",
       "url": "https://drive.google.com/file/d/14DyQZZAO2Q9cFBkRe-tNLbSDbeeIp3kM/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Archive",
     "folderUrl": "https://drive.google.com/drive/folders/1nxJHG_UEnwQ3Zfe3Gy4XCnDp19ahDVNP",
     "files": [
      {
       "name": "Estimate_37401_-_Mono_Village_Revised.pdf",
       "id": "1zZVxouujqxYMDkMFqpORZnrtYr17Wkad",
       "url": "https://drive.google.com/file/d/1zZVxouujqxYMDkMFqpORZnrtYr17Wkad/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Loan Supporting Docs",
     "folderUrl": "https://drive.google.com/drive/folders/1AZwHLVlITbtofeu5gxxLJmfnkLRFnzTT",
     "files": [
      {
       "name": "22-23 TR.zip",
       "id": "1IHcJyQgFk34nzTjz0SZtV5gLRuVG9sfP",
       "url": "https://drive.google.com/file/d/1IHcJyQgFk34nzTjz0SZtV5gLRuVG9sfP/view",
       "mime": "application/zip"
      },
      {
       "name": "Alliance Laundry Personal Financial Statement.pdf",
       "id": "1hP50stXLQItbqd-7ksfBJL_bCavQ1j2Z",
       "url": "https://drive.google.com/file/d/1hP50stXLQItbqd-7ksfBJL_bCavQ1j2Z/view",
       "mime": "application/pdf"
      },
      {
       "name": "Checking.zip",
       "id": "1dwRw6FV2xrYs3IC3uG-5IV19CWEUUrkL",
       "url": "https://drive.google.com/file/d/1dwRw6FV2xrYs3IC3uG-5IV19CWEUUrkL/view",
       "mime": "application/zip"
      },
      {
       "name": "Equip Loan -- Reqd Docs.pdf",
       "id": "1kdQKRnSx9evHpNk-zWTU_NFjYsVcH2nv",
       "url": "https://drive.google.com/file/d/1kdQKRnSx9evHpNk-zWTU_NFjYsVcH2nv/view",
       "mime": "application/pdf"
      },
      {
       "name": "Equip Loan Docs.pdf",
       "id": "1PyEcVcBwhgMFxBq7W1MmXPRGUEJfMpS8",
       "url": "https://drive.google.com/file/d/1PyEcVcBwhgMFxBq7W1MmXPRGUEJfMpS8/view",
       "mime": "application/pdf"
      },
      {
       "name": "Equip Loan Insurance Docs.pdf",
       "id": "1aywD11_J-McX0Q4lD29-mGbYlqC7mlvi",
       "url": "https://drive.google.com/file/d/1aywD11_J-McX0Q4lD29-mGbYlqC7mlvi/view",
       "mime": "application/pdf"
      },
      {
       "name": "Invstment Statements.zip",
       "id": "11rYrdIOcsP8F0hvsMi0D4xg8iqmasbyR",
       "url": "https://drive.google.com/file/d/11rYrdIOcsP8F0hvsMi0D4xg8iqmasbyR/view",
       "mime": "application/zip"
      },
      {
       "name": "L&S Company info.zip",
       "id": "14R5NIge11x09nyhN3wQ4NdIs6NXsGlrR",
       "url": "https://drive.google.com/file/d/14R5NIge11x09nyhN3wQ4NdIs6NXsGlrR/view",
       "mime": "application/zip"
      },
      {
       "name": "L. Garman Huebsch Financial App.pdf",
       "id": "1qY9c8gETirolCFwtMxM12vjP-VRPPSGZ",
       "url": "https://drive.google.com/file/d/1qY9c8gETirolCFwtMxM12vjP-VRPPSGZ/view",
       "mime": "application/pdf"
      },
      {
       "name": "Please_DocuSign_Huebsch_Loan_Documents_-_Zac (1).pdf",
       "id": "1mM2206A2ioEzJV_BhVQRagnquzg57AKU",
       "url": "https://drive.google.com/file/d/1mM2206A2ioEzJV_BhVQRagnquzg57AKU/view",
       "mime": "application/pdf"
      },
      {
       "name": "Savings.zip",
       "id": "1YZToSEA8jzp39Ka1sWNi0JLJ4J8ieK7W",
       "url": "https://drive.google.com/file/d/1YZToSEA8jzp39Ka1sWNi0JLJ4J8ieK7W/view",
       "mime": "application/zip"
      },
      {
       "name": "Z.Garman DL.pdf",
       "id": "1370Bd14shgcCvGLbB1E7SMgq7OqIUhml",
       "url": "https://drive.google.com/file/d/1370Bd14shgcCvGLbB1E7SMgq7OqIUhml/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Loan Supporting Docs › Checking",
     "folderUrl": "https://drive.google.com/drive/folders/1Drs5uvwbIsTfz9rQPXSXtrytFLEGs36c",
     "files": [
      {
       "name": "BOS July.pdf",
       "id": "1L3MpNqXk6LuEYMZOvNhy8pHfQYhMrlPX",
       "url": "https://drive.google.com/file/d/1L3MpNqXk6LuEYMZOvNhy8pHfQYhMrlPX/view",
       "mime": "application/pdf"
      },
      {
       "name": "BOS June.pdf",
       "id": "1CXqbN_BEngTyT1Dbh11r_S01MiR80kdY",
       "url": "https://drive.google.com/file/d/1CXqbN_BEngTyT1Dbh11r_S01MiR80kdY/view",
       "mime": "application/pdf"
      },
      {
       "name": "BOS May.pdf",
       "id": "1lQ2xh9f9JMSrr9gvMK0xLIYo-aPiJgD0",
       "url": "https://drive.google.com/file/d/1lQ2xh9f9JMSrr9gvMK0xLIYo-aPiJgD0/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Loan Supporting Docs › Investment Statements",
     "folderUrl": "https://drive.google.com/drive/folders/17InWH01-JsCFDPP1e72D60wRSaoUhIpN",
     "files": [
      {
       "name": "2025-05-23 Statement - USB Money Market 5847.pdf",
       "id": "11G1hWrNRwSRqcbXrEukto0mpG7XDSE2Y",
       "url": "https://drive.google.com/file/d/11G1hWrNRwSRqcbXrEukto0mpG7XDSE2Y/view",
       "mime": "application/pdf"
      },
      {
       "name": "2025-05-30 Statement - USBI Brokerage 4082.pdf",
       "id": "1zFQvjGRaM284BLgY5LsNxmKWK44IE0gR",
       "url": "https://drive.google.com/file/d/1zFQvjGRaM284BLgY5LsNxmKWK44IE0gR/view",
       "mime": "application/pdf"
      },
      {
       "name": "2025-06-25 Statement - USB Money Market 5847.pdf",
       "id": "1NfJlf6GUcx8ZgeXbDd21ovTs6HATdgmc",
       "url": "https://drive.google.com/file/d/1NfJlf6GUcx8ZgeXbDd21ovTs6HATdgmc/view",
       "mime": "application/pdf"
      },
      {
       "name": "2025-06-30 Statement - USBI Brokerage 4082.pdf",
       "id": "12oHF_PufonHe1TyApiIFjkqCCPAr-wm9",
       "url": "https://drive.google.com/file/d/12oHF_PufonHe1TyApiIFjkqCCPAr-wm9/view",
       "mime": "application/pdf"
      },
      {
       "name": "2025-07-24 Statement - USB Money Market 5847.pdf",
       "id": "1ii9tNcyxgbZasYEQn5bYFEduNN52S0fo",
       "url": "https://drive.google.com/file/d/1ii9tNcyxgbZasYEQn5bYFEduNN52S0fo/view",
       "mime": "application/pdf"
      },
      {
       "name": "2025-07-31 Statement - USBI Brokerage 4082 (1).pdf",
       "id": "1o_t08pk5G_BnebNKBIDq-U-pZ7LBGLa8",
       "url": "https://drive.google.com/file/d/1o_t08pk5G_BnebNKBIDq-U-pZ7LBGLa8/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Loan Supporting Docs › Savings",
     "folderUrl": "https://drive.google.com/drive/folders/10voNN4wF4MJp3FhmbHgOm9fWzDJtf2gm",
     "files": [
      {
       "name": "BOS Sav July.pdf",
       "id": "1bb77j-89QrR4vSxl0vDGSSpaL4ugqvUq",
       "url": "https://drive.google.com/file/d/1bb77j-89QrR4vSxl0vDGSSpaL4ugqvUq/view",
       "mime": "application/pdf"
      },
      {
       "name": "BOS Sav June.pdf",
       "id": "1GnNIfJnoFaKrlKx2upNVD-PHJC9G4MzE",
       "url": "https://drive.google.com/file/d/1GnNIfJnoFaKrlKx2upNVD-PHJC9G4MzE/view",
       "mime": "application/pdf"
      },
      {
       "name": "BOS Sav May.pdf",
       "id": "1OHtQYwYeEDd0QWLhOSO9UEaHXGKw07bX",
       "url": "https://drive.google.com/file/d/1OHtQYwYeEDd0QWLhOSO9UEaHXGKw07bX/view",
       "mime": "application/pdf"
      }
     ]
    },
    {
     "name": "Machines & Maintenance › Equip Purchase › Washer-Dryer Info",
     "folderUrl": "https://drive.google.com/drive/folders/1e9u_-wpLstZ0N4Eua5DX7h_9eYPdJT1E",
     "files": [
      {
       "name": "Installation Mannual HTT45 w 6 in 13th.pdf",
       "id": "1_2qDFFuOyflYSzTDuEW6WdAGZqhde6md",
       "url": "https://drive.google.com/file/d/1_2qDFFuOyflYSzTDuEW6WdAGZqhde6md/view",
       "mime": "application/pdf"
      },
      {
       "name": "Installation Manual HCT020WC-HCT100WC.pdf",
       "id": "1kr7vH_Oa3jZinCXudpPDDt-IaBiEomtH",
       "url": "https://drive.google.com/file/d/1kr7vH_Oa3jZinCXudpPDDt-IaBiEomtH/view",
       "mime": "application/pdf"
      }
     ]
    }
   ],
   "count": 60
  }
 ]
};


/* ======================================================================= */
/* Running Notes (Terra Vi pilot) — action=notes / addnote / delnote        */
/* Needs the Docs scope: https://www.googleapis.com/auth/documents          */
/* (add it to oauthScopes in appsscript.json, then re-authorize once).      */
/*                                                                          */
/* Doc layout this code understands (Terra Vi — Running Notes):             */
/*   STATUS (H2) · blurb paragraphs                                         */
/*   TO DO (H2) · list items                                                */
/*   DONE LOG (H2)                                                          */
/*     Field notes (H3)                 <- added by addnote, top of log     */
/*       2026-09-29        (bold 13pt date heading, newest first)           */
/*         • Tue 9/29 · 8:14 AM — note text   (bullet, newest first)        */
/*     2026-09-23  older plain log lines (kept as-is, parsed by date)       */
/*   DETAIL LOG (H2) · ...                                                  */
/* Only Doc ids listed in API_NOTES_DOCS can be read or written.            */
/* ======================================================================= */
var API_NOTES_DOCS = {
  terravi: '1YprGTVSb6kM83f0Enfk2bSf8rAsbKVV7vHwCm_qoDg8',  // Terra Vi — Running Notes
  hetchhetchy: '1UcmzxYhHvnPMzqy6JbE6GE81yPVf2D5h4v1EEdnsNoY'   // Hetch Hetchy — Running Notes (added 2026-10-01)
};
var API_NOTE_MAX = 1500;        // max characters per note
var API_NOTE_RAW_MAX = 60000;   // max characters of raw text returned
var API_NOTE_TEST_MARK = 'TEST note \u2014 please ignore';   // delnote only ever removes field notes containing this marker

function apiNotesDocId_(project) {
  var key = String(project || 'terravi').toLowerCase().replace(/[^a-z0-9]/g, '');
  return API_NOTES_DOCS.hasOwnProperty(key) ? API_NOTES_DOCS[key] : '';
}

function apiNoteType_(el) {
  var t = el.getType();
  return t === DocumentApp.ElementType.LIST_ITEM ? 'li' : t === DocumentApp.ElementType.PARAGRAPH ? 'p' : '';
}
function apiNoteText_(el) {
  var k = apiNoteType_(el);
  return k ? String(el.asText().getText() || '').replace(/\u000b/g, ' ').trim() : '';
}
/** Index range of the sections in the body. Returns {status, todo, done, detail, n} (-1 if absent). */
function apiNoteSections_(body) {
  var n = body.getNumChildren(), out = { status: -1, todo: -1, done: -1, detail: -1, n: n };
  for (var i = 0; i < n; i++) {
    var el = body.getChild(i);
    if (apiNoteType_(el) !== 'p') continue;
    var t = apiNoteText_(el).toUpperCase();
    if (t === 'STATUS' && out.status < 0) out.status = i;
    else if ((t === 'TO DO' || t === 'TODO') && out.todo < 0) out.todo = i;
    else if (t === 'DONE LOG' && out.done < 0) out.done = i;
    else if (t === 'DETAIL LOG' && out.detail < 0) out.detail = i;
  }
  return out;
}

/* ---- Structured entries for the phone's Running Notes page (v15) ---------------------------------
 * data.entries = [{ date:'YYYY-MM-DD'|'', time, title, detail, kind:'note'|'detail'|'log'|'archive' }], newest date first.
 *   note    = dictated / typed field note (title = first few words, detail = full text)
 *   detail  = a dated section of the DETAIL LOG ("2026-09-23 — Krazan meeting ..."): title = heading, detail = its lines;
 *             a DONE LOG line for the same date is prepended to the detail as "Done log: ..."
 *   log     = a DONE LOG line with no matching detail section (title = short first sentence)
 *   archive = undated archive blocks (OLDER ARCHIVE / NEXT ACTIONS)
 * Pure function (no Doc objects) so it can be unit-tested outside Apps Script. */
var API_ENTRY_DETAIL_MAX = 6000;
function apiAutoTitle_(text, maxWords) {
  var w = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(function (x) { return !!x; });
  if (!w.length) return 'Note';
  var n = maxWords || 7, t = w.slice(0, n).join(' ').replace(/[\s,;:\-\u2013\u2014]+$/, '');
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return w.length > n ? t.replace(/[.!?]+$/, '') + '\u2026' : t;
}
function apiShortTitle_(text) {
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  var m = t.match(/^(.{12,70}?[.!?;:])(\s|$)/);
  if (m) return m[1].replace(/[.;:]+$/, '');
  if (t.length <= 70) return t.replace(/[.]+$/, '') || 'Entry';
  var cut = t.slice(0, 66), sp = cut.lastIndexOf(' ');
  return (sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s,;:\-]+$/, '') + '\u2026';
}
function apiNoteEntries_(done, blocks) {
  var dateRe = /^(\d{4}-\d{2}-\d{2})\s*[\u2014\u2013-]\s*([\s\S]+)$/;
  var markRe = /^(OLDER ARCHIVE\b.*|NEXT ACTIONS|HISTORY)$/i;
  var strip = function (t) { return String(t).replace(/^[\u2022\u25CF\-\*\s]+/, ''); };
  var det = [], cur = null;
  (blocks || []).forEach(function (b) {
    var t = String(b.t || '').trim();
    if (!t) return;
    var s = strip(t), mk = s.length < 60 && markRe.test(s), m = b.k === 'p' ? t.match(dateRe) : null;
    if (mk) {
      if (/^HISTORY$/i.test(s)) { cur = null; return; }
      cur = { date: '', title: s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(), lines: [], kind: 'archive' };
      det.push(cur); return;
    }
    if (m) {
      cur = { date: m[1], title: m[2].replace(/\s+/g, ' ').replace(/[.]+$/, '').slice(0, 120), lines: [], kind: 'detail' };
      det.push(cur); return;
    }
    if (!cur) return;
    if (b.k === 'li') cur.lines.push('\u2022 ' + s);
    else cur.lines.push((cur.lines.length && cur.lines[cur.lines.length - 1].charAt(0) === '\u2022' ? '\n' : '') + t);
  });
  var firstDetail = {};
  det.forEach(function (e) { if (e.kind === 'detail' && !firstDetail[e.date]) firstDetail[e.date] = e; });
  var out = [];
  (done || []).forEach(function (g) {
    (g.items || []).forEach(function (x) {
      if (x.kind === 'field') {
        out.push({ date: g.date || '', time: x.time || '', title: apiAutoTitle_(x.text), detail: x.text, kind: 'note' });
      } else if (g.date && firstDetail[g.date]) {   // DONE LOG line for a date that has a DETAIL LOG section: shown inside it
        firstDetail[g.date].lines.unshift('Done log: ' + x.text + '\n');
      } else {
        out.push({ date: g.date || '', time: '', title: apiShortTitle_(x.text), detail: x.text, kind: 'log' });
      }
    });
  });
  det.forEach(function (e) {
    out.push({ date: e.date, time: '', title: e.title, detail: e.lines.join('\n').slice(0, API_ENTRY_DETAIL_MAX), kind: e.kind });
  });
  var rank = { note: 0, detail: 1, log: 2, archive: 3 };
  return out.map(function (e, i) { e._i = i; return e; }).sort(function (a, b) {
    if (a.date !== b.date) return !a.date ? 1 : !b.date ? -1 : a.date < b.date ? 1 : -1;
    return rank[a.kind] - rank[b.kind] || a._i - b._i;
  }).map(function (e) { delete e._i; return e; });
}

function apiNotes_(project) {
  var id = apiNotesDocId_(project);
  if (!id) return { error: 'bad_project' };
  var doc = DocumentApp.openById(id), body = doc.getBody();
  var sec = apiNoteSections_(body), n = sec.n;
  var lines = function (from, to) {
    var out = [];
    for (var i = from; i < to; i++) {
      var el = body.getChild(i), t = apiNoteText_(el);
      if (t) out.push({ text: t, list: apiNoteType_(el) === 'li' });
    }
    return out;
  };
  var after = function (i, list) {   // first section start after index i
    var m = n;
    list.forEach(function (x) { if (x > i && x < m) m = x; });
    return m;
  };
  var starts = [sec.status, sec.todo, sec.done, sec.detail];
  var data = { title: doc.getName(), url: 'https://docs.google.com/document/d/' + id + '/edit',
               status: [], todo: [], done: [], parsed: false };
  try { data.updated = DriveApp.getFileById(id).getLastUpdated().toISOString(); } catch (e) {}

  if (sec.status >= 0) data.status = lines(sec.status + 1, after(sec.status, starts)).map(function (x) { return x.text; });
  if (sec.todo >= 0) data.todo = lines(sec.todo + 1, after(sec.todo, starts)).map(function (x) {
    return x.text.replace(/^[\u2022\u25CF\-\*\s]+/, '');
  }).filter(function (t) { return !!t; });

  if (sec.done >= 0) {
    var groups = {}, order = [], curDate = '', inField = false;
    var add = function (date, item) {
      if (!groups[date]) { groups[date] = { field: [], other: [] }; order.push(date); }
      groups[date][item.kind === 'field' ? 'field' : 'other'].push(item);
    };
    for (var i = sec.done + 1, end = after(sec.done, starts); i < end; i++) {
      var el = body.getChild(i), t = apiNoteText_(el), k = apiNoteType_(el);
      if (!t) continue;
      if (k === 'p' && /^field notes$/i.test(t)) { inField = true; curDate = ''; continue; }
      var dm = t.match(/^(\d{4}-\d{2}-\d{2})\s*$/);
      if (k === 'p' && dm) { curDate = dm[1]; inField = true; continue; }
      if (inField && k === 'li' && curDate) {
        var tm = t.match(/^(\w{3} \d{1,2}\/\d{1,2} \u00b7 \d{1,2}:\d{2} [AP]M)\s+\u2014\s+([\s\S]*)$/);
        add(curDate, { kind: 'field', time: tm ? tm[1] : '', text: tm ? tm[2] : t });
        continue;
      }
      inField = false;
      var lm = t.match(/^(\d{4}-\d{2}-\d{2})\s*[\u2014\u2013-]?\s*([\s\S]*)$/);
      if (lm) add(lm[1], { kind: 'log', time: '', text: lm[2] || '' });
      else add('', { kind: 'log', time: '', text: t });
    }
    order.sort(function (a, b) { return a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? 1 : -1; });   // newest first, undated last
    data.done = order.map(function (d) {
      var label = d ? Utilities.formatDate(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 12), CONFIG.TIME_ZONE, 'EEE M/d') : 'Other';
      return { date: d, label: label, items: groups[d].field.concat(groups[d].other) };
    });
    data.parsed = sec.status >= 0 && sec.todo >= 0;
  }
  try {   // structured entries for the Running Notes page (v15); failure here never breaks the rest of the response
    var blocks = [];
    if (sec.detail >= 0) {
      for (var j = sec.detail + 1; j < n; j++) {
        var bel = body.getChild(j), bk = apiNoteType_(bel), bt = apiNoteText_(bel);
        if (bk && bt) blocks.push({ k: bk, t: bt });
      }
    }
    data.entries = apiNoteEntries_(data.done, blocks);
  } catch (eEnt) { console.error('entries: ' + eEnt); }
  data.raw = String(body.getText() || '').slice(0, API_NOTE_RAW_MAX);
  return { ok: true, data: data };
}

function apiCleanNote_(text) {
  return String(text == null ? '' : text)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Index just past the "Field notes" block (its date headings and bullets), starting after `from`. */
function apiFieldBlockEnd_(body, from, limit) {
  var i = from;
  while (i < limit) {
    var el = body.getChild(i), k = apiNoteType_(el), t = apiNoteText_(el);
    if (k === 'li' || (k === 'p' && /^\d{4}-\d{2}-\d{2}\s*$/.test(t))) i++; else break;
  }
  return i;
}

function apiAddNote_(project, text) {
  var id = apiNotesDocId_(project);
  if (!id) return { error: 'bad_project' };
  var note = apiCleanNote_(text);
  if (!note) return { error: 'empty' };
  if (note.length > API_NOTE_MAX) return { error: 'too_long', message: 'Note is too long (max ' + API_NOTE_MAX + ' characters).' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // Double-tap / retry guard: the same note within 60 s is only written once.
    var cache = CacheService.getScriptCache();
    var dk = 'cc_note_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id + '|' + note));
    if (cache.get(dk)) return { ok: true, data: { added: false, duplicate: true } };

    var doc = DocumentApp.openById(id), body = doc.getBody();
    var sec = apiNoteSections_(body);
    if (sec.done < 0) return { error: 'no_done_log', message: 'Could not find the DONE LOG heading in the Doc.' };
    var limit = sec.detail > sec.done ? sec.detail : sec.n;

    // "Field notes" heading at the top of the Done log.
    var fIdx = -1;
    for (var i = sec.done + 1; i < limit; i++) {
      var el = body.getChild(i);
      if (apiNoteType_(el) === 'p' && /^field notes$/i.test(apiNoteText_(el))) { fIdx = i; break; }
    }
    if (fIdx < 0) {
      var fh = body.insertParagraph(sec.done + 1, 'Field notes');
      fh.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      fIdx = sec.done + 1;
    }

    var now = new Date(), tz = CONFIG.TIME_ZONE;
    var dateKey = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
    var stamp = Utilities.formatDate(now, tz, 'EEE M/d \u00b7 h:mm a');

    // Today's dated section (newest first): reuse it if it is the first one, else create it.
    var next = fIdx + 1, nextEl = next < body.getNumChildren() ? body.getChild(next) : null;
    var hasToday = nextEl && apiNoteType_(nextEl) === 'p' && apiNoteText_(nextEl).indexOf(dateKey) === 0 &&
                   /^\d{4}-\d{2}-\d{2}\s*$/.test(apiNoteText_(nextEl));
    if (!hasToday) {
      var dh = body.insertParagraph(next, dateKey);
      dh.setHeading(DocumentApp.ParagraphHeading.NORMAL);
      var dt = dh.editAsText();
      dt.setBold(true); dt.setFontSize(13); dt.setItalic(false);
      dh.setSpacingBefore(8); dh.setSpacingAfter(2);
    }
    var li = body.insertListItem(next + 1, stamp + ' \u2014 ' + note);
    li.setGlyphType(DocumentApp.GlyphType.BULLET);
    var lt = li.editAsText();
    lt.setBold(false); lt.setFontSize(11); lt.setItalic(false);
    lt.setBold(0, stamp.length - 1, true);

    doc.saveAndClose();
    cache.put(dk, '1', 60);
    return { ok: true, data: { added: true, date: dateKey, stamp: stamp, text: note } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Test-cleanup helper: removes ONLY bullets inside the "Field notes" block that contain
 * API_NOTE_TEST_MARK ("TEST note - please ignore" style test text), then any date heading or the
 * Field notes heading left empty by that. Nothing else in the Doc can be deleted through the API.
 */
function apiDelTestNote_(project) {
  var id = apiNotesDocId_(project);
  if (!id) return { error: 'bad_project' };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var doc = DocumentApp.openById(id), body = doc.getBody();
    var sec = apiNoteSections_(body);
    if (sec.done < 0) return { error: 'no_done_log' };
    var limit = sec.detail > sec.done ? sec.detail : sec.n, fIdx = -1;
    for (var i = sec.done + 1; i < limit; i++) {
      var el = body.getChild(i);
      if (apiNoteType_(el) === 'p' && /^field notes$/i.test(apiNoteText_(el))) { fIdx = i; break; }
    }
    if (fIdx < 0) return { ok: true, data: { removed: 0 } };
    var isDate = function (e) { return apiNoteType_(e) === 'p' && /^\d{4}-\d{2}-\d{2}\s*$/.test(apiNoteText_(e)); };
    var removed = 0, end = apiFieldBlockEnd_(body, fIdx + 1, limit);
    for (var j = end - 1; j > fIdx; j--) {          // 1) test bullets only
      var e = body.getChild(j);
      if (apiNoteType_(e) === 'li' && apiNoteText_(e).indexOf(API_NOTE_TEST_MARK) >= 0) { body.removeChild(e); removed++; end--; }
    }
    for (var k = end - 1; k > fIdx; k--) {          // 2) date headings now followed by no bullet
      var h = body.getChild(k);
      if (isDate(h) && !(k + 1 < end && apiNoteType_(body.getChild(k + 1)) === 'li')) { body.removeChild(h); removed++; end--; }
    }
    if (end === fIdx + 1) { body.removeChild(body.getChild(fIdx)); removed++; }   // 3) empty Field notes heading
    doc.saveAndClose();
    return { ok: true, data: { removed: removed } };
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor after adding the documents scope: triggers the consent prompt and proves read access. */
function authorizeDocs() {
  var doc = DocumentApp.openById(API_NOTES_DOCS.terravi);
  Logger.log('Docs access OK: ' + doc.getName());
}

/* ======================================================================= */
/* Finances + Insurance working pages (phone screens)                       */
/*   action=fin&page=overview | laundromat | insurance     (alias: insnotes) */
/* Reads the NATIVE Google Docs at request time (Docs scope already granted) */
/* and returns structured JSON. No financial/insurance data is stored in    */
/* this script or in the public GitHub repo.                                */
/*                                                                          */
/* Doc layout understood (all three docs):                                  */
/*   H1 title · STATUS (H2, paragraphs) · TO DO (H2, list, ☐/☑ items)       */
/*   DONE LOG (H2, list) · other H2 sections with H3s, paragraphs, bullets  */
/*   and TABLES (first row = header) · Questions / To discuss (H2, list)    */
/*   Notes from our conversations (H2 > H3 date > paragraphs)               */
/*   Insurance: "Policy map" (H2) > one H3 per entity > policy table        */
/* ======================================================================= */
var API_FIN_DOCS = {
  overview:   '1jONgStyatJVIMmtoOCAtUMUZCwQvJot7621BLsnWJwM',   // Finances - Overview (Working Page) - v5 live (native Doc, in Finances folder; OVERVIEW_V5). Previous v4: 1ecpdIP16xZOoTKLuehvBKMEtj1r0Y4npNrDNIKPz-BI; v3: 1oMQaEoVrT8jiNqJwdA0Jh5uP2lNtktDQhfl0akJjMP8
  laundromat: '1sf4Kqe_a-fXxGkPJm9WU5DM8dLoDc2qVzLk-rEJ6lSc',   // Finances - Laundromat (Working Page) - live (native Doc, in Finances folder)
  insurance:  '1QCsHvtzTmQL65ZDQ_DR24uY8MbnEQFpan37yORJi_hc',   // Insurance - Running Notes                    (native Doc)
  // v13 (Laundromat / TiwiK rework):
  loan:        '1qgX-uzO4Ghd-aypEbCie00AHniWxBu3ChLwr0RSWCs4',  // Finances - Equipment Payoff Options (Working Page)  (native Doc, Finances folder)
  maintenance: '1kSS6PjWiWWob2PlWNabFjrpPTu4vmYh7eLovwqVErQE'   // TiwiK Laundromat - Machine Maintenance (Working Page) (native Doc, 03_Machines_Maintenance)
};
// Source documents behind the loan figures (Drive file ids). Returned with page=loan so the phone app can open
// them in its in-app viewer when a number is tapped. Ids only - no figures.
var API_FIN_LOAN_SOURCES = {
  loandocs:   { id: '19-uY2ZGuU4L34i3lXGp8uDlHYXNKTBNk', title: 'Alliance loan documents (PDF)',          kind: 'file' },
  navigator:  { id: '1hokXjD0TjoUTEJPOwz_H_EohrHKk-axe', title: 'Alliance Loan Navigator (PDF)',          kind: 'file' },
  payoff:     { id: '1qgX-uzO4Ghd-aypEbCie00AHniWxBu3ChLwr0RSWCs4', title: 'Equipment Payoff Options (Doc)', kind: 'doc' },
  laundromat: { id: '1sf4Kqe_a-fXxGkPJm9WU5DM8dLoDc2qVzLk-rEJ6lSc', title: 'Finances - Laundromat (Doc)',    kind: 'doc' },
  overview:   { id: '1jONgStyatJVIMmtoOCAtUMUZCwQvJot7621BLsnWJwM', title: 'Finances - Overview (Doc)',      kind: 'doc' }
};
// Insurance entities: slug, heading prefix, keywords used to attach To do items to an entity.
var API_FIN_ENTITIES = [
  { slug: 'personal', head: /^personal/i,           keys: ['travelers personal auto', 'personal auto', 'subaru', 'personal umbrella'] },
  { slug: 'wetumka',  head: /^wetumka/i,            keys: ['wetumka'] },
  { slug: 'monoway',  head: /^mono way/i,           keys: ['mono way', 'smoke detector'] },
  { slug: 'tiwik',    head: /^tiwik/i,              keys: ['tiwik', 'fair plan commercial', 'scottsdale'] },
  { slug: 'kiwit',    head: /^kiwit/i,              keys: ['kiwit', 'three policy', 'pca4ymbgdx'] },
  { slug: 'sierra',   head: /^sierra/i,             keys: ['sierra', 'hartford'] },
  { slug: 'stewart',  head: /^stewart/i,            keys: ['stewart street'] }
];

function apiFin_(page) {
  var key = String(page || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!API_FIN_DOCS.hasOwnProperty(key)) return { error: 'bad_page' };
  var id = API_FIN_DOCS[key];
  var doc = DocumentApp.openById(id);
  var parsed = apiFinParse_(apiFinBlocks_(doc.getBody()));
  var data = apiFinBuild_(key, parsed);
  data.page = key;
  data.title = doc.getName();
  data.url = 'https://docs.google.com/document/d/' + id + '/edit';
  try { data.updated = DriveApp.getFileById(id).getLastUpdated().toISOString(); } catch (e) {}
  return { ok: true, data: data };
}

/* ---- Doc body -> plain blocks: {t:'h',lv,text} {t:'p',text,lead} {t:'li',text,lead} {t:'tbl',rows} ---- */
function apiFinClean_(s) {
  return String(s == null ? '' : s).replace(/[\u000b\r]/g, ' ').replace(/\s*\n\s*/g, ' ').replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').trim();
}
/** Leading bold run (e.g. "Net worth mismatch:") of a paragraph/list item, or ''. */
function apiFinLead_(node) {
  var raw = String(node.getText() || ''), tx = node.editAsText(), idx;
  try { idx = tx.getTextAttributeIndices(); } catch (e) { return ''; }
  for (var k = 0; k < idx.length; k++) {
    var start = idx[k];
    if (start > 4) break;
    if (!tx.isBold(start)) continue;
    if (!/^[\s\u2610-\u2612]*$/.test(raw.slice(0, start))) break;
    var end = k + 1 < idx.length ? idx[k + 1] : raw.length;
    while (end < raw.length && k + 1 < idx.length && tx.isBold(idx[k + 1])) { k++; end = k + 1 < idx.length ? idx[k + 1] : raw.length; }
    var lead = apiFinClean_(raw.slice(start, end)).replace(/[\s:;,.\-\u2013\u2014]+$/, '');
    return (lead.length >= 3 && lead.length <= 140 && end < raw.length) ? lead : '';
  }
  return '';
}
function apiFinBlocks_(body) {
  var H = DocumentApp.ParagraphHeading, T = DocumentApp.ElementType, out = [];
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var el = body.getChild(i), t = el.getType();
    if (t === T.TABLE) {
      var tb = el.asTable(), rows = [];
      for (var r = 0; r < tb.getNumRows(); r++) {
        var row = tb.getRow(r), cells = [];
        for (var c = 0; c < row.getNumCells(); c++) cells.push(apiFinClean_(row.getCell(c).getText()));
        rows.push(cells);
      }
      out.push({ t: 'tbl', rows: rows });
    } else if (t === T.PARAGRAPH) {
      var p = el.asParagraph(), hd = p.getHeading(), text = apiFinClean_(p.getText());
      if (!text) continue;
      var lv = hd === H.TITLE || hd === H.HEADING1 ? 1 : hd === H.HEADING2 ? 2 : hd === H.HEADING3 ? 3 : hd === H.HEADING4 ? 4 : 0;
      if (lv) out.push({ t: 'h', lv: lv, text: text });
      else out.push({ t: 'p', text: text, lead: apiFinLead_(p) });
    } else if (t === T.LIST_ITEM) {
      var li = el.asListItem(), lt = apiFinClean_(li.getText());
      if (lt) out.push({ t: 'li', text: lt, lead: apiFinLead_(li) });
    }
  }
  return out;
}

/* ---- pure parsing (no Apps Script services: testable in Node) ---- */
function apiFinMoney_(s) {
  var m = String(s == null ? '' : s).match(/(-?)\s*\$\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  var v = Number(m[2].replace(/,/g, ''));
  return m[1] === '-' ? -v : v;
}
function apiFinIso_(m, d, y) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
function apiFinDates_(s) {
  var out = [], re = /\b(\d{1,2})-(\d{1,2})-(20\d\d)\b/g, m;
  while ((m = re.exec(String(s || '')))) out.push(apiFinIso_(m[1], m[2], m[3]));
  return out;
}
function apiFinParse_(blocks) {
  var res = { title: '', status: [], todo: [], done: [], questions: [], notes: [], sections: [] };
  var cur = null, kind = '', h3 = '', note = null, sec = null;
  blocks.forEach(function (b) {
    if (b.t === 'h' && b.lv === 1 && !res.title) { res.title = b.text; return; }
    if (b.t === 'h' && b.lv <= 2) {
      cur = b.text; h3 = ''; note = null; sec = null;
      var u = cur.toUpperCase();
      kind = u === 'STATUS' ? 'status' : (u === 'TO DO' || u === 'TODO') ? 'todo' : u === 'DONE LOG' ? 'done'
        : /^QUESTIONS/.test(u) ? 'questions' : /^NOTES/.test(u) ? 'notes' : 'other';
      if (kind === 'other') { sec = { title: cur, blocks: [] }; res.sections.push(sec); }
      return;
    }
    if (kind === 'status') { if (b.t === 'p' || b.t === 'li') res.status.push(b.text); return; }
    if (kind === 'todo') {
      if (b.t !== 'li' && b.t !== 'p') return;
      var done = /^[\u2611\u2612]/.test(b.text), tx = b.text.replace(/^[\u2610-\u2612]\s*/, '');
      var lead = String(b.lead || '').replace(/^[\u2610-\u2612]\s*/, ''), dates = apiFinDates_(lead || tx);
      res.todo.push({ done: done, lead: lead, text: tx, date: dates[0] || '' });
      return;
    }
    if (kind === 'done') {
      if (b.t !== 'li' && b.t !== 'p') return;
      var m = b.text.match(/^(\d{4}-\d{2}-\d{2})\s*[\u2014\u2013-]?\s*([\s\S]*)$/);
      res.done.push({ date: m ? m[1] : '', text: m ? m[2] : b.text });
      return;
    }
    if (kind === 'questions') { if (b.t === 'li' || b.t === 'p') res.questions.push(b.text); return; }
    if (kind === 'notes') {
      if (b.t === 'h') { note = { date: b.text, items: [] }; res.notes.push(note); return; }
      if (b.t === 'p' || b.t === 'li') {
        if (/^\(add newest first/i.test(b.text)) return;
        if (!note) { note = { date: '', items: [] }; res.notes.push(note); }
        note.items.push(b.text);
      }
      return;
    }
    if (sec) {
      if (b.t === 'h') { h3 = b.text; sec.blocks.push({ k: 'h', text: b.text }); }
      else if (b.t === 'tbl') {
        var rows = b.rows.filter(function (r) { return r.some(function (c) { return c !== ''; }); });
        if (rows.length) sec.blocks.push({ k: 'tbl', heading: h3 || sec.title, header: rows[0], rows: rows.slice(1) });
      } else sec.blocks.push({ k: b.t, text: b.text });
    }
  });
  return res;
}
function apiFinTables_(parsed) {
  var all = [];
  parsed.sections.forEach(function (s) { s.blocks.forEach(function (b) { if (b.k === 'tbl') all.push(b); }); });
  return all;
}
function apiFinFind_(tables, head0, exact) {
  for (var i = 0; i < tables.length; i++) {
    var h = String(tables[i].header[0] || '').toLowerCase();
    if (exact ? h === head0 : h.indexOf(head0) === 0) return tables[i];
  }
  return null;
}
function apiFinRow_(tbl, re, col) {
  if (!tbl) return null;
  for (var i = 0; i < tbl.rows.length; i++) if (re.test(tbl.rows[i][0] || '')) {
    var v = tbl.rows[i][col || 1] || '';
    return { label: tbl.rows[i][0], value: v, num: apiFinMoney_(v) };
  }
  return null;
}
function apiFinBuild_(page, p) {
  var data = { title: p.title, status: p.status, todo: p.todo, done: p.done, questions: p.questions, notes: p.notes, sections: p.sections };
  var tables = apiFinTables_(p), sum = {};
  if (page === 'overview') {
    var assets = apiFinFind_(tables, 'asset', true), debt = apiFinFind_(tables, 'debt', true), nw = apiFinFind_(tables, 'net worth', true),
        cash = apiFinFind_(tables, 'institution / account', true) || apiFinFind_(tables, 'institution'), comb = apiFinFind_(tables, 'source', true);
    var bigOnly = null;
    tables.forEach(function (t) { if (!bigOnly && /^item$/i.test(t.header[0]) && t.header.length === 2 && apiFinRow_(t, /^known assets/i)) bigOnly = t; });
    sum.assets = apiFinRow_(assets, /^total assets/i);
    sum.debt = apiFinRow_(debt, /^total debt/i);
    sum.netWorth = apiFinRow_(nw, /^estimated net worth/i);
    sum.cash = apiFinRow_(cash, /^total/i);
    sum.cashFlowYear = apiFinRow_(comb, /^net from/i);
    sum.cashFlowMonth = apiFinRow_(comb, /^average monthly/i);
    sum.heloc = apiFinRow_(bigOnly, /heloc/i);
    sum.assetRows = assets ? assets.rows.filter(function (r) { return !/^total/i.test(r[0]); }) : [];
    sum.debtRows = debt ? debt.rows.filter(function (r) { return !/^total/i.test(r[0]); }) : [];
    // Latest recomputed totals quoted in STATUS ("total debt is $X ... net worth $Y"), newest paragraph wins.
    var upd = null;
    p.status.forEach(function (t) {
      var m = t.match(/total debt is\s*(\$[\d,\.]+)[\s\S]*?net worth\s*(\$[\d,\.]+)/i);
      if (m) upd = { debt: m[1], netWorth: m[2], note: /calculated/i.test(t) ? 'calculated from newer loan documents' : '' };
    });
    sum.updated = upd;
    // FIN2 (v4 Doc): figure ledger (Ref | Figure | Value | Status | Source) and Needs-from-Zac table (Ref | Needed | What it replaces).
    // Absent in the old v3 Doc, in which case none of this is returned and the phone app keeps its older layout.
    var led = [], needs = [];
    tables.forEach(function (t) {
      var h0 = String(t.header[0] || '').toLowerCase(), h1 = String(t.header[1] || '').toLowerCase();
      if (h0 === 'ref' && h1 === 'figure') t.rows.forEach(function (r) {
        led.push({ ref: r[0] || '', figure: r[1] || '', value: r[2] || '', num: apiFinMoney_(r[2]), status: String(r[3] || '').toUpperCase().replace(/[^A-Z]/g, ''), source: r[4] || '' });
      });
      if (h0 === 'ref' && h1 === 'needed') t.rows.forEach(function (r) {
        needs.push({ ref: r[0] || '', need: String(r[1] || '').replace(/^[\u2610-\u2612]\s*/, ''), why: r[2] || '' });
      });
    });
    if (led.length) {
      data.ledger = led; data.needs = needs; data.srcLinks = [];
      p.sections.forEach(function (s) {
        if (!/^source links/i.test(s.title)) return;
        s.blocks.forEach(function (b) {
          var m = (b.k === 'li' || b.k === 'p') && String(b.text || '').match(/^(.*?):\s*<?(https?:\/\/[^\s>]+)/);
          if (m) data.srcLinks.push({ label: m[1], url: m[2] });
        });
      });
    }
  } else if (page === 'laundromat') {
    var op = apiFinFind_(tables, 'laundromat');
    var opRow = function (re) {
      if (!op) return null;
      for (var i = 0; i < op.rows.length; i++) if (re.test(op.rows[i][0])) {
        return { label: op.rows[i][0], month: op.rows[i][1], year: op.rows[i][2], monthNum: apiFinMoney_(op.rows[i][1]), yearNum: apiFinMoney_(op.rows[i][2]) };
      }
      return null;
    };
    sum.revenue = opRow(/^gross revenue/i);
    sum.beforeDebt = opRow(/^cash flow before/i);
    sum.payment = opRow(/^equipment payment/i);
    sum.afterDebt = opRow(/^cash flow after/i);
    sum.opRows = op ? op.rows : [];
    var loan = null, payoff = null, stress = null, margins = null;
    tables.forEach(function (t) {
      if (!loan && /^real terms/i.test(t.header[1] || '')) loan = t;
      if (!payoff && /^option/i.test(t.header[0])) payoff = t;
      if (!stress && /^revenue change/i.test(t.header[0])) stress = t;
      if (!margins && /^measure/i.test(t.header[0])) margins = t;
    });
    sum.loan = loan ? { header: loan.header, rows: loan.rows } : null;
    sum.payoff = payoff ? { header: payoff.header, rows: payoff.rows } : null;
    sum.stress = stress ? { header: stress.header, rows: stress.rows } : null;
    sum.margins = margins ? { header: margins.header, rows: margins.rows } : null;
  } else if (page === 'insurance') {
    sum = null;
    data.entities = apiFinEntities_(p);
    data.todo = apiFinTagTodos_(p.todo, data.entities);
    data.sections = [];    // policy map is delivered as entities
  } else if (page === 'loan') {
    // Payoff Options doc: sections 1-7 + Questions/Notes are rendered generically by the phone app.
    sum = null;
    data.sources = {};
    Object.keys(API_FIN_LOAN_SOURCES).forEach(function (k) {
      var x = API_FIN_LOAN_SOURCES[k];
      data.sources[k] = { title: x.title, url: x.kind === 'doc' ? 'https://docs.google.com/document/d/' + x.id + '/edit' : 'https://drive.google.com/file/d/' + x.id + '/view' };
    });
  } else if (page === 'maintenance') {
    sum = null;   // one H2 per machine ("M1. ...") + "To get: owner's manuals" + TO DO; rendered by the phone app
  }
  if (sum) data.summary = sum;
  return data;
}

/* ---- Insurance: Policy map -> entities/policies, To do items tagged by entity ---- */
function apiFinEntities_(p) {
  var pm = null;
  p.sections.forEach(function (s) { if (!pm && /^policy map/i.test(s.title)) pm = s; });
  var ents = [];
  if (!pm) return ents;
  var cur = null;
  pm.blocks.forEach(function (b) {
    if (b.k === 'h') {
      var slug = '';
      API_FIN_ENTITIES.forEach(function (e) { if (!slug && e.head.test(b.text)) slug = e.slug; });
      if (!slug) slug = b.text.toLowerCase().replace(/\(.*$/, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
      var m = b.text.match(/^([^(]+?)\s*(?:\((.*)\))?$/);
      cur = { slug: slug, name: (m ? m[1] : b.text).replace(/\s+$/, ''), full: b.text, blurb: [], folder: '', policies: [], noPolicy: '' };
      ents.push(cur);
    } else if (cur && b.k === 'p') {
      if (/^folder:/i.test(b.text)) cur.folder = b.text.replace(/^folder:\s*/i, '');
      else cur.blurb.push(b.text);
    } else if (cur && b.k === 'tbl') {
      var hdr = b.header.map(function (h) { return h.toLowerCase(); });
      var col = function (re) { for (var i = 0; i < hdr.length; i++) if (re.test(hdr[i])) return i; return -1; };
      var cC = col(/^carrier/), cT = col(/^type/), cP = col(/^policy/), cR = col(/^term|renew/), cM = col(/^premium/), cN = col(/^notes|source/);
      b.rows.forEach(function (r) {
        var g = function (i) { return i >= 0 ? (r[i] || '') : ''; };
        if (/^\(no policy/i.test(g(cC))) { cur.noPolicy = g(cT) || g(cC); return; }
        var term = g(cR), ds = apiFinDates_(term.replace(/\((?=[^)]*(?:issued|offer|prior|package|commenced|dated))[^)]*\)/gi, ' '));
        cur.policies.push({ carrier: g(cC), type: g(cT), policy: g(cP), term: term, premium: g(cM), notes: g(cN), renewal: ds.length ? ds[ds.length - 1] : '' });
      });
    }
  });
  return ents;
}
function apiFinTagTodos_(todos, ents) {
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' '); };
  return todos.map(function (t) {
    var full = norm(t.lead + ' ' + t.text), lead = norm(t.lead || t.text.slice(0, 120)), tags = [];
    // 1) exact policy numbers found in the text
    ents.forEach(function (e) {
      var hit = false;
      e.policies.forEach(function (pl) { var pn = norm(pl.policy).replace(/\s*\(.*$/, ''); if (pn.length >= 6 && full.indexOf(pn) >= 0) hit = true; });
      if (hit && tags.indexOf(e.slug) < 0) tags.push(e.slug);
    });
    // 2) entity keywords in the headline, then anywhere in the text
    [lead, full].forEach(function (hay) {
      if (tags.length) return;
      ents.forEach(function (e) {
        var hit = false;
        API_FIN_ENTITIES.forEach(function (d) {
          if (d.slug === e.slug) d.keys.forEach(function (k) { if (hay.indexOf(k) >= 0) hit = true; });
        });
        if (hit && tags.indexOf(e.slug) < 0) tags.push(e.slug);
      });
    });
    return { done: t.done, lead: t.lead, text: t.text, date: t.date, entities: tags };
  });
}


/* ======================================================================= */
/* Punchlist (v17) — actions punch / punchset / punchnote                   */
/*   Items come from the Punchlist Google Doc (table: Done | # | Item |     */
/*   Date | Notes) and are merged with state kept in a Google Sheet,        */
/*   "Hetch Hetchy Punchlist State", created lazily on the FIRST WRITE in   */
/*   the Hetch Hetchy Drive folder; its id is stored in Script Property     */
/*   CC_PUNCH_SHEET_<PROJECT>. Columns: Item # | Item | Done | Done at |     */
/*   Note | Note time.  One "state" row per item (Note blank) holds the     */
/*   checkbox; every note is its own appended row (Done blank).             */
/*   Writes are serialized with LockService and are idempotent (punchset    */
/*   sends the wanted value, punchnote carries a client id `cid`).          */
/*   Needs Drive scope "drive" (to move the new Sheet into the folder); if  */
/*   that scope is not granted the Sheet is still created (in My Drive) and */
/*   the write succeeds.                                                    */
/* ======================================================================= */
var API_PUNCH = {
  hetchhetchy: {
    docId: '1Q4zQmPwIGZ51kQ3S_v949ksc_X4mKnI8xsVRKYvkLIg',      // Hetch Hetchy — Punchlist
    folderId: '1HCCeuyeW31z72nZNg7gC94SRPQZOOp71',               // Hetch Hetchy Drive folder
    sheetName: 'Hetch Hetchy Punchlist State',
    notesProject: 'hetchhetchy'                                   // Running Notes mirror (apiAddNote_)
  }
};
var API_PUNCH_HEAD = ['Item #', 'Item', 'Done', 'Done at', 'Note', 'Note time'];
var API_PUNCH_NOTE_MAX = 1000;

function apiPunchCfg_(project) {
  var key = String(project || 'hetchhetchy').toLowerCase().replace(/[^a-z0-9]/g, '');
  return API_PUNCH.hasOwnProperty(key) ? { key: key, c: API_PUNCH[key] } : null;
}
function apiPunchProp_(key) { return 'CC_PUNCH_SHEET_' + key.toUpperCase(); }

/** Items from the Doc table, cached 60 s. [{n,name,date,info}] in Doc order. */
function apiPunchItems_(cfg, fresh) {
  var cache = CacheService.getScriptCache(), ck = 'cc_punch_items_' + cfg.key;
  if (!fresh) { var hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  var doc = DocumentApp.openById(cfg.c.docId), tables = doc.getBody().getTables(), items = [], seen = {};
  for (var t = 0; t < tables.length; t++) {
    var tb = tables[t];
    for (var r = 0; r < tb.getNumRows(); r++) {
      var row = tb.getRow(r), nc = row.getNumCells();
      if (nc < 3) continue;
      var cells = [];
      for (var c = 0; c < nc; c++) cells.push(String(row.getCell(c).getText() || '').replace(/\\([#&])/g, '$1').replace(/\s+/g, ' ').trim());
      var n = parseInt(cells[1], 10);
      if (!(n > 0) || String(n) !== cells[1] || !cells[2] || seen[n]) continue;   // skips header / stray rows
      seen[n] = true;
      items.push({ n: n, name: cells[2], date: cells[3] || '', info: cells[4] || '' });
    }
  }
  items.sort(function (a, b) { return a.n - b.n; });
  if (items.length) cache.put(ck, JSON.stringify(items), 60);
  return items;
}

function apiPunchStamp_(d) {               // "yyyy-MM-dd HH:mm" in the CC time zone
  return Utilities.formatDate(d, CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm');
}
function apiPunchShow_(stamp) {            // "2026-10-01 08:14" -> "Thu 10/1 \u00b7 8:14 AM"
  var m = String(stamp || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return String(stamp || '');
  var y = +m[1], mo = +m[2], da = +m[3], h = +m[4], dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow] + ' ' + mo + '/' + da + ' \u00b7 ' + ((h % 12) || 12) + ':' + m[5] + ' ' + (h < 12 ? 'AM' : 'PM');
}

/** Opens the state Sheet (or null if not created yet). Throws if the stored id can no longer be opened. */
function apiPunchSheet_(cfg) {
  var id = PropertiesService.getScriptProperties().getProperty(apiPunchProp_(cfg.key));
  if (!id) return null;
  var ss = SpreadsheetApp.openById(id);
  return { ss: ss, sh: ss.getSheets()[0], id: id };
}
/** Creates the state Sheet in the project folder. Call only while holding the script lock. */
function apiPunchCreateSheet_(cfg) {
  var props = PropertiesService.getScriptProperties();
  var again = props.getProperty(apiPunchProp_(cfg.key));          // another request may have created it while we waited
  if (again) return apiPunchSheet_(cfg);
  var ss = SpreadsheetApp.create(cfg.c.sheetName), sh = ss.getSheets()[0];
  sh.setName('State');
  sh.getRange(1, 1, 1, API_PUNCH_HEAD.length).setValues([API_PUNCH_HEAD]).setFontWeight('bold');
  sh.getRange(2, 1, 1999, 6).setNumberFormat('@');                 // plain text: no date / formula auto-conversion
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 1, 60); sh.setColumnWidths(2, 1, 220); sh.setColumnWidths(3, 1, 60);
  sh.setColumnWidths(4, 1, 130); sh.setColumnWidths(5, 1, 420); sh.setColumnWidths(6, 1, 130);
  props.setProperty(apiPunchProp_(cfg.key), ss.getId());
  var moved = false;
  try {
    var f = DriveApp.getFileById(ss.getId());
    DriveApp.getFolderById(cfg.c.folderId).addFile(f);
    DriveApp.getRootFolder().removeFile(f);
    moved = true;
  } catch (e) { console.error('Punch sheet created but not moved into the folder: ' + e); }
  return { ss: ss, sh: sh, id: ss.getId(), moved: moved };
}

/** Parsed state: { done:{n:{done,at}}, notes:{n:[{text,time,show}]} } from the Sheet's rows. */
function apiPunchState_(handle) {
  var out = { done: {}, notes: {} };
  if (!handle) return out;
  var last = handle.sh.getLastRow();
  if (last < 2) return out;
  var v = handle.sh.getRange(2, 1, last - 1, 6).getValues();
  for (var i = 0; i < v.length; i++) {
    var n = parseInt(v[i][0], 10);
    if (!(n > 0)) continue;
    var note = String(v[i][4] || '');
    if (note) {
      (out.notes[n] = out.notes[n] || []).push({ text: note, time: String(v[i][5] || ''), show: apiPunchShow_(v[i][5]) });
    } else {
      var d = String(v[i][2]).toLowerCase();
      out.done[n] = { done: d === 'true' || d === 'yes' || d === '1', at: String(v[i][3] || ''), show: apiPunchShow_(v[i][3]) };
    }
  }
  return out;
}

function apiPunch_(project) {
  var cfg = apiPunchCfg_(project);
  if (!cfg) return { error: 'bad_project' };
  var items = apiPunchItems_(cfg, false);
  if (!items.length) return { error: 'no_items', message: 'Could not find the punch list table in the Doc.' };
  var handle = null, stateErr = '';
  try { handle = apiPunchSheet_(cfg); } catch (e) { stateErr = 'State sheet could not be opened.'; console.error('punch state: ' + e); }
  var st = apiPunchState_(handle), nDone = 0;
  var out = items.map(function (it) {
    var s = st.done[it.n], ds = !!(s && s.done);
    if (ds) nDone++;
    return { n: it.n, name: it.name, date: it.date, info: it.info, done: ds, doneAt: ds ? s.show : '',
             notes: (st.notes[it.n] || []).slice().reverse().map(function (x) { return { text: x.text, time: x.show }; }) };   // newest first
  });
  return { ok: true, data: { project: cfg.key, title: 'Hetch Hetchy \u2014 Punchlist', docUrl: 'https://docs.google.com/document/d/' + cfg.c.docId + '/edit',
    stateUrl: handle ? handle.ss.getUrl() : '', stateReady: !!handle, stateError: stateErr, total: out.length, doneCount: nDone, items: out } };
}

function apiPunchFindItem_(cfg, index) {
  var n = parseInt(index, 10);
  if (!(n > 0)) return null;
  var items = apiPunchItems_(cfg, false);
  for (var i = 0; i < items.length; i++) if (items[i].n === n) return items[i];
  items = apiPunchItems_(cfg, true);                     // Doc may have just changed
  for (var j = 0; j < items.length; j++) if (items[j].n === n) return items[j];
  return null;
}

function apiPunchSet_(project, index, done) {
  var cfg = apiPunchCfg_(project);
  if (!cfg) return { error: 'bad_project' };
  var item = apiPunchFindItem_(cfg, index);
  if (!item) return { error: 'bad_item', message: 'No such punch list item.' };
  var want = (done === true || String(done).toLowerCase() === 'true' || String(done) === '1');
  var changed = false, at = '', logIt = false;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var h = apiPunchSheet_(cfg) || apiPunchCreateSheet_(cfg);
    var last = h.sh.getLastRow(), row = -1;
    if (last >= 2) {
      var v = h.sh.getRange(2, 1, last - 1, 6).getValues();
      for (var i = 0; i < v.length; i++) if (parseInt(v[i][0], 10) === item.n && !String(v[i][4] || '')) { row = i + 2; break; }
    }
    var now = apiPunchStamp_(new Date());
    var cur = row > 0 ? String(h.sh.getRange(row, 3).getValue()).toLowerCase() === 'true' : false;
    if (row < 0) {
      if (want) { h.sh.appendRow([item.n, item.name, 'TRUE', now, '', '']); changed = true; at = now; }
      else { h.sh.appendRow([item.n, item.name, 'FALSE', '', '', '']); }
    } else if (cur !== want) {
      h.sh.getRange(row, 2, 1, 3).setValues([[item.name, want ? 'TRUE' : 'FALSE', want ? now : '']]);
      changed = true; at = want ? now : '';
    } else {
      at = String(h.sh.getRange(row, 4).getValue() || '');
    }
    logIt = changed && want;
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  var logged = false;
  if (logIt) logged = apiPunchLog_(cfg, 'Punchlist #' + item.n + ' ' + item.name + ' \u2014 checked off');
  return { ok: true, data: { n: item.n, done: want, changed: changed, doneAt: apiPunchShow_(at), logged: logged } };
}

function apiPunchNote_(project, index, text, cid, at) {
  var cfg = apiPunchCfg_(project);
  if (!cfg) return { error: 'bad_project' };
  var item = apiPunchFindItem_(cfg, index);
  if (!item) return { error: 'bad_item', message: 'No such punch list item.' };
  var note = apiCleanNote_(text);
  if (!note) return { error: 'empty' };
  if (note.length > API_PUNCH_NOTE_MAX) return { error: 'too_long', message: 'Note is too long (max ' + API_PUNCH_NOTE_MAX + ' characters).' };
  var cid2 = String(cid || '').replace(/[^\w-]/g, '').slice(0, 40);
  var when = new Date(), a = Number(at);
  if (a > 0 && a <= Date.now() + 60000 && a > Date.now() - 30 * 86400000) when = new Date(a);   // queued offline: keep the real time
  var cache = CacheService.getScriptCache();
  var dk = 'cc_pn_' + (cid2 || Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, item.n + '|' + note)));
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  var stamp = apiPunchStamp_(when), added = false;
  try {
    if (cache.get(dk)) return { ok: true, data: { n: item.n, added: false, duplicate: true } };
    var h = apiPunchSheet_(cfg) || apiPunchCreateSheet_(cfg);
    h.sh.appendRow([item.n, item.name, '', '', note, stamp]);
    SpreadsheetApp.flush();
    cache.put(dk, '1', cid2 ? 21600 : 120);
    added = true;
  } finally {
    lock.releaseLock();
  }
  var logged = apiPunchLog_(cfg, 'Punchlist #' + item.n + ' ' + item.name + ' \u2014 note: ' + note);
  return { ok: true, data: { n: item.n, added: added, time: apiPunchShow_(stamp), logged: logged } };
}

/** Best-effort mirror into the project's Running Notes via the existing addnote path. Never fails the main write. */
function apiPunchLog_(cfg, text) {
  try {
    if (!cfg.c.notesProject) return false;
    var r = apiAddNote_(cfg.c.notesProject, String(text).slice(0, API_NOTE_MAX));
    return !!(r && r.ok);
  } catch (e) { console.error('punch -> running notes: ' + e); return false; }
}

/** Run once from the editor to grant the Drive scope used to place the state Sheet in the folder. */
function authorizePunch() {
  DriveApp.getFolderById(API_PUNCH.hetchhetchy.folderId).getName();
  DocumentApp.openById(API_PUNCH.hetchhetchy.docId).getName();
  console.log('Punch: Drive + Docs access OK');
}


/* ======================================================================= */
/* Vault > Debt + Upcoming bills (v20) — action vaultdebt                   */
/*   Reads the Finances - Overview Doc through the EXISTING fin parser       */
/*   (apiFinBlocks_ -> apiFinParse_ -> apiFinBuild_ -> data.ledger/srcLinks) */
/*   and returns:                                                           */
/*     loans[]  : name, entity, balance, rate, payment, nextDue, status,     */
/*                srcLinks (+ per-field value/status/source/url)             */
/*     totals   : totalDebt, totalMonthly (debt service), monthlyAfter       */
/*     bills[]  : everything due in the next 30 days, sorted by date:        */
/*                loan payments (by due date), insurance renewals, property  */
/*                taxes that carry a date in the Doc                         */
/*   No figures are stored in this script: every number comes from the Doc.  */
/*   Ref keys used (do not rename in the Doc): all.* wet.* mono.* ins.*      */
/*   *.tax. Doc dates are m/d/yyyy; due DAY-of-month is read from the Doc    */
/*   (maturity / "payments from" / "Due" rows), API_DEBT_LOANS.dueDay is    */
/*   only the fallback.                                                     */
/* ======================================================================= */
var API_DEBT_WINDOW_DAYS = 30;
var API_DEBT_LOANS = [
  { key: 'tiwik',   name: 'Alliance / Huebsch equipment loan', entity: 'TiwiK',     bal: 'all.bal',  rate: 'all.rate',  pay: 'all.pay',  pay2: 'all.pay2', due: '',        maturity: 'all.maturity',  dueDay: 5 },
  { key: 'wetumka', name: 'Wetumka mortgage (Rocket Mortgage)', entity: 'Household', bal: 'wet.bal',  rate: 'wet.rate',  pay: 'wet.pay',  pay2: '',         due: 'wet.due', maturity: 'wet.maturity',  dueDay: 1 },
  { key: 'monoway', name: 'Mono Way loan (Bank of Stockton)',   entity: 'KiwiT',     bal: 'mono.bal', rate: 'mono.rate', pay: 'mono.pay', pay2: '',         due: '',        maturity: 'mono.maturity', dueDay: 5 }
];
var API_DEBT_TAX_NAMES = { mw: 'Mono Way property tax', st: 'Stewart Street property tax', wet: 'Wetumka property tax' };
var API_DEBT_RANK = { VERIFIED: 0, DERIVED: 1, ESTIMATE: 2 };

/**
 * Live entry point (v30): when the "Debts" + "Bills" tabs of the Daily Spend sheet exist and the Debts tab has at least one row, the model
 * is built from those tabs (source:'sheet'). Otherwise the previous behaviour: read the Overview Doc through the fin parser (source:'doc').
 */
function apiVaultDebt_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
  var shD = ss.getSheetByName(API_DEBT_TAB), shB = ss.getSheetByName(API_BILLS_TAB);
  if (shD && shB && shD.getLastRow() >= 2) {
    var rd = apiDebtReadDebts_(shD), rb = apiDebtReadBills_(shB);
    if (rd.cols.name >= 0 && rd.rows.length) {
      var tabs = { debts: { gid: shD.getSheetId(), url: apiDebtTabUrl_(shD) }, bills: { gid: shB.getSheetId(), url: apiDebtTabUrl_(shB) } };
      return apiDebtSheetBuild_(rd.rows, rb.rows, todayKey_(), tabs);
    }
  }
  var L = apiDebtDocLoad_();
  var m = apiDebtBuild_(L.data.ledger || [], L.data.srcLinks || [], L.data.needs || [], todayKey_(), 'https://docs.google.com/document/d/' + API_FIN_DOCS.overview + '/edit', L.doc.getName(), L.docTotal);
  m.source = 'doc';
  return m;
}
/** Reads the Overview Doc with the existing fin parser. Returns { doc, data (fin overview page), docTotal }. */
function apiDebtDocLoad_() {
  var doc = DocumentApp.openById(API_FIN_DOCS.overview);
  var data = apiFinBuild_('overview', apiFinParse_(apiFinBlocks_(doc.getBody())));
  return { doc: doc, data: data, docTotal: data.summary && data.summary.debt ? data.summary.debt.num : null };
}

/* ---- pure helpers (no Apps Script services: testable in Node) ---- */
function apiDebtIso_(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
function apiDebtUtc_(iso) { var p = String(iso).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function apiDebtDays_(fromIso, toIso) { return Math.round((apiDebtUtc_(toIso) - apiDebtUtc_(fromIso)) / 86400000); }
function apiDebtMonthLen_(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
/** All m/d/yy or m/d/yyyy dates in a string, as ISO, in order of appearance. */
function apiDebtDates_(s) {
  var out = [], re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g, m;
  while ((m = re.exec(String(s || '')))) {
    var y = +m[3]; if (y < 100) y += 2000;
    if (+m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31) out.push(apiDebtIso_(y, +m[1], +m[2]));
  }
  return out;
}
function apiDebtWorst_(list) {
  var w = 'VERIFIED', any = false;
  list.forEach(function (s) { if (!s) return; any = true; if ((API_DEBT_RANK[s] || 0) > API_DEBT_RANK[w]) w = s; });
  return any ? w : 'ESTIMATE';
}
function apiDebtAddDays_(iso, n) { var t = new Date(apiDebtUtc_(iso) + n * 86400000); return apiDebtIso_(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
/** Occurrence of dueDay in month (y,m), clamped to the month length. */
function apiDebtOcc_(y, m, day) { return apiDebtIso_(y, m, Math.min(day, apiDebtMonthLen_(y, m))); }
function apiDebtNextMonth_(iso) { var p = iso.split('-'), y = +p[0], m = +p[1] + 1; if (m > 12) { m = 1; y++; } return { y: y, m: m }; }
/** Due dates (ISO) of a monthly payment on `day`, from `today` through `end`, skipping anything <= paidThrough or after maturity. */
function apiDebtSchedule_(today, end, day, paidThrough, maturity) {
  var out = [], p = today.split('-'), y = +p[0], m = +p[1], guard = 0;
  while (guard++ < 40) {
    var d = apiDebtOcc_(y, m, day);
    if (d > end) break;
    if (maturity && d > maturity) break;
    if (d >= today && !(paidThrough && d <= paidThrough)) out.push(d);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
function apiDebtNeedMatch_(need, ref) {
  return String(need.ref || '').split(/[,\s]+/).some(function (t) { return t === ref || (/\.\*$/.test(t) && ref.indexOf(t.slice(0, -1)) === 0); });
}

/**
 * Pure model builder.
 *  ledger   = data.ledger of the fin overview page ({ref, figure, value, num, status, source})
 *  srcLinks = [{label, url}], needs = [{ref, need, why}], today = 'yyyy-MM-dd'.
 */
function apiDebtBuild_(ledger, srcLinks, needs, today, docUrl, docTitle, docTotal) {
  var idx = {};
  (ledger || []).forEach(function (r) { idx[r.ref] = r; });
  var urlFor = function (label) {
    var hit = '';
    (srcLinks || []).forEach(function (s) { if (!hit && s.label === label) hit = s.url; });
    if (!hit && label) (srcLinks || []).forEach(function (s) { if (!hit && (s.label.indexOf(label) === 0 || label.indexOf(s.label) === 0)) hit = s.url; });
    return hit;
  };
  var linkOf = function (r) { var u = r ? urlFor(r.source) : ''; return u ? { label: r.source, url: u } : null; };
  var fieldOf = function (r) {
    if (!r) return null;
    var l = linkOf(r);
    return { ref: r.ref, label: r.figure, value: r.value, num: r.num, status: r.status || 'ESTIMATE', source: r.source || '', url: l ? l.url : '' };
  };
  var end = apiDebtAddDays_(today, API_DEBT_WINDOW_DAYS);
  var refsUsed = [], loans = [], bills = [], undated = [], missing = [];

  API_DEBT_LOANS.forEach(function (cfg) {
    var rb = idx[cfg.bal], rr = idx[cfg.rate], rp = idx[cfg.pay], rp2 = cfg.pay2 ? idx[cfg.pay2] : null, rd = cfg.due ? idx[cfg.due] : null, rm = cfg.maturity ? idx[cfg.maturity] : null;
    if (!rb || rb.num == null) { missing.push(cfg.key); return; }
    // due day: Doc dates first (payment row, Due row, maturity row), configured day only as a fallback
    var day = 0, dayFrom = 'fallback';
    [[rp, 'payment row'], [rd, 'due row'], [rm, 'maturity row']].forEach(function (c) {
      if (day || !c[0]) return;
      var ds = apiDebtDates_((c[0].figure || '') + ' ' + (c[0].value || ''));
      if (ds.length) { day = +ds[0].split('-')[2]; dayFrom = c[1]; }
    });
    if (!day) day = cfg.dueDay;
    // a Due row at $0 with a date means that installment is already paid
    var paidThrough = '', dueAmt = null, dueDate = '';
    if (rd) {
      var dd = apiDebtDates_(rd.figure);
      if (dd.length) {
        dueDate = dd[0];
        if (rd.num === 0) paidThrough = dueDate;
        else if (rd.num > 0) dueAmt = rd.num;
      }
    }
    var mat = rm ? (apiDebtDates_(rm.value)[0] || '') : '';
    var sched = apiDebtSchedule_(today, end, day, paidThrough, mat);
    var next = sched[0] || '';
    if (!next) {   // beyond the window: find the next one
      var far = apiDebtSchedule_(today, apiDebtAddDays_(today, 800), day, paidThrough, mat);
      next = far[0] || '';
    }
    var pay2From = rp2 ? (apiDebtDates_(rp2.figure + ' ' + rp2.value)[0] || '') : '';
    var payFor = function (iso) {
      if (dueAmt != null && dueDate === iso) return { amount: dueAmt, note: 'Amount due per the Doc (may include past-due).' };
      if (rp2 && rp2.num != null && pay2From && iso >= pay2From) return { amount: rp2.num, note: 'Payment after the reset.' };
      return { amount: rp ? rp.num : null, note: '' };
    };
    var reset = !!(rp2 && rp2.num != null && pay2From && pay2From <= today);   // the post-reset payment is already in force
    var cur = reset ? rp2 : rp;
    var first = next ? payFor(next) : { amount: cur ? cur.num : null, note: '' };
    var statuses = [rb.status, cur ? cur.status : '', rr ? rr.status : ''].filter(Boolean);
    var links = [];
    [rb, rr, cur, reset ? null : rp2].forEach(function (r) {
      var l = linkOf(r);
      if (l && !links.some(function (x) { return x.url === l.url; })) links.push(l);
    });
    [cfg.bal, cfg.rate, cfg.pay, cfg.pay2, cfg.due, cfg.maturity].forEach(function (k) { if (k && idx[k]) refsUsed.push(k); });
    var loan = {
      key: cfg.key, name: cfg.name, entity: cfg.entity,
      balance: rb.num, rate: rr && /%/.test(rr.value) ? parseFloat(String(rr.value).replace(/[^\d.\-]/g, '')) : null, rateText: rr ? rr.value : '',
      payment: cur ? cur.num : null, nextDue: next, daysUntil: next ? apiDebtDays_(today, next) : null, dueDay: day, dueDayFrom: dayFrom,
      nextDueAmount: first.amount, nextDueStatus: 'DERIVED', paidThrough: paidThrough,
      paymentNext: rp2 && rp2.num != null && !reset ? { amount: rp2.num, from: pay2From, status: rp2.status } : null,
      maturity: rm ? rm.value : '', status: apiDebtWorst_(statuses),
      fields: { balance: fieldOf(rb), rate: fieldOf(rr), payment: fieldOf(cur), paymentNext: reset ? null : fieldOf(rp2), maturity: fieldOf(rm) },
      balanceNote: rb.figure, rateNote: rr ? rr.figure : '', srcLinks: links
    };
    loans.push(loan);
    sched.forEach(function (iso) {
      var pf = payFor(iso);
      bills.push({ id: cfg.key + ':' + iso, date: iso, daysUntil: apiDebtDays_(today, iso), kind: 'loan', kindLabel: 'Loan payment', name: cfg.name, entity: cfg.entity,
        amount: pf.amount, status: (iso >= pay2From && pay2From && rp2 ? rp2 : rp) ? (iso >= pay2From && pay2From && rp2 ? rp2 : rp).status : 'ESTIMATE', viaEscrow: false, note: pf.note, ref: cfg.pay, srcLinks: links });
    });
  });

  // insurance renewals: ins.* rows (Sierra Consultants excluded, as everywhere in the Vault)
  var entOf = function (ref) {
    var k = String(ref).replace(/^[a-z]+\./, '');
    if (/^tiwik/.test(k)) return 'TiwiK';
    if (/^kiwit/.test(k)) return 'KiwiT';
    return 'Household';
  };
  var cleanName = function (f) { return String(f || '').replace(/\s*[\(=].*$/, '').replace(/\s+/g, ' ').trim(); };
  (ledger || []).forEach(function (r) {
    if (/^ins\./.test(r.ref) && !/^ins\.sierra/i.test(r.ref)) {
      var ds = apiDebtDates_(r.figure);
      if (!ds.length) return;
      var when = /renewal/i.test(r.figure) ? ds[0] : ds[ds.length - 1];   // "renewal offer (start-end)" is due at the START of the new term
      if (when < today || when > end) return;
      var l = linkOf(r);
      refsUsed.push(r.ref);
      bills.push({ id: r.ref + ':' + when, date: when, daysUntil: apiDebtDays_(today, when), kind: 'insurance', kindLabel: 'Insurance renewal', name: cleanName(r.figure), entity: entOf(r.ref),
        amount: r.num, status: r.status || 'ESTIMATE', viaEscrow: /escrow/i.test(r.figure), note: /escrow/i.test(r.figure) ? 'Paid through the mortgage escrow (not an extra payment).' : '', ref: r.ref, srcLinks: l ? [l] : [] });
    } else if (/^[a-z]+\.tax$/.test(r.ref) || /property tax/i.test(r.figure)) {
      if (r.num == null || r.num === 0) return;
      var pre = String(r.ref).split('.')[0], tname = API_DEBT_TAX_NAMES[pre] || cleanName(r.figure), td = apiDebtDates_(r.figure).filter(function (d) { return d >= today && d <= end; });
      var tl = linkOf(r);
      if (td.length) {
        refsUsed.push(r.ref);
        bills.push({ id: r.ref + ':' + td[0], date: td[0], daysUntil: apiDebtDays_(today, td[0]), kind: 'tax', kindLabel: 'Property tax', name: tname, entity: entOf(pre === 'mw' || pre === 'st' ? 'kiwit' : 'wet'),
          amount: r.num, status: r.status || 'ESTIMATE', viaEscrow: false, note: '', ref: r.ref, srcLinks: tl ? [tl] : [] });
      } else {
        undated.push({ ref: r.ref, name: tname, status: r.status || 'ESTIMATE' });   // per-month estimate with no due date in the Doc: listed, not scheduled
      }
    }
  });
  var kindRank = { loan: 0, insurance: 1, tax: 2 };
  bills.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (kindRank[a.kind] - kindRank[b.kind]) || (a.name < b.name ? -1 : 1); });

  // totals
  var totalDebt = 0, totalMonthly = 0;
  loans.forEach(function (l) { totalDebt += l.balance; totalMonthly += l.payment || 0; });
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var afterFrom = '';
  loans.forEach(function (l) { if (l.paymentNext && l.paymentNext.from && (!afterFrom || l.paymentNext.from < afterFrom)) afterFrom = l.paymentNext.from; });
  var monthlyAfter = null;
  if (afterFrom) {
    var t2 = 0;
    loans.forEach(function (l) { t2 += (l.paymentNext && l.paymentNext.from && l.paymentNext.from <= afterFrom && l.paymentNext.amount != null) ? l.paymentNext.amount : (l.payment || 0); });
    monthlyAfter = { from: afterFrom, amount: r2(t2), status: apiDebtWorst_(loans.map(function (l) { return l.status; })) };
  }
  var counted = bills.filter(function (b) { return !b.viaEscrow && b.amount != null; });
  var billTotal = 0; counted.forEach(function (b) { billTotal += b.amount; });
  var byKind = {}; counted.forEach(function (b) { byKind[b.kind] = r2((byKind[b.kind] || 0) + b.amount); });
  // needs for the ESTIMATE figures we used (what the Estimate badge explains)
  var estRefs = refsUsed.filter(function (k) { return idx[k] && /^ESTIMATE/.test(idx[k].status || ''); });
  undated.forEach(function (u) { if (/^ESTIMATE/.test(u.status)) estRefs.push(u.ref); });
  var needOut = (needs || []).filter(function (n) { return estRefs.some(function (k) { return apiDebtNeedMatch_(n, k); }); });
  return {
    today: today, windowDays: API_DEBT_WINDOW_DAYS, windowEnd: end,
    loans: loans,
    totalDebt: r2(totalDebt), totalDebtStatus: apiDebtWorst_(loans.map(function (l) { return l.status; })),
    totalMonthly: r2(totalMonthly), totalMonthlyStatus: apiDebtWorst_(loans.map(function (l) { return l.fields.payment ? l.fields.payment.status : 'ESTIMATE'; })),
    monthlyAfter: monthlyAfter,
    docTotalDebt: docTotal == null ? null : docTotal, matchesDoc: docTotal == null ? null : Math.abs(docTotal - totalDebt) < 1.5,
    bills: bills, billsTotal: r2(billTotal), billsCount: bills.length, billsByKind: byKind,
    billsStatus: apiDebtWorst_(counted.map(function (b) { return b.status; })),
    undated: undated, missing: missing, needs: needOut, estimateRefs: estRefs.filter(function (k, i) { return estRefs.indexOf(k) === i; }),
    docUrl: docUrl, docTitle: docTitle || ''
  };
}


/* ======================================================================= */
/* Daily log screen upgrade (v21) — extends action `log`, adds `logadd`/`logset` */
/*   Fitness sheet "Phone Log" tab, one row per day (header-matched).        */
/*   READ  : action=log still returns the exact old shape (getDailyLog in    */
/*           Code.gs) plus `ext` { today, targets, history[], streaks,       */
/*           weight, body, columns, write }. If `ext` is missing/null the    */
/*           front end falls back to the previous screen.                    */
/*   WRITE : action=logadd&value=8&cid=<client id>   -> water += value oz    */
/*           action=logset&field=weight|sleep|steps|hike&value=N&cid=...     */
/*           v43: both accept an optional &date=YYYY-MM-DD (default today; same validation as logday) */
/*           Passcode-protected like every action, serialized with           */
/*           LockService, retry-safe via cid (6 h), range-checked, and the   */
/*           Phone Log tab is backed up (values) to the tab                  */
/*           "Phone Log backup" before the FIRST write of each day; every    */
/*           write is journaled on the tab "CC write log". Both tabs are     */
/*           created lazily on the first write (never on read).              */
/*   Writes go to TODAY's row (the newest row of today; created if none).    */
/*   Targets stay in Code.gs CONFIG.TARGETS; the two values below are the    */
/*   only new config.                                                        */
/* ======================================================================= */
var API_LOG_CFG = {
  workoutsPerWeek: 4,      // weekly workout-count target (edit here)
  weightGoal: 210,         // lb, trend target (stays server-side, not in the public front end)
  historyDays: 120,        // days of history returned / used for streaks
  maxWaterOz: 300,         // refuse a day total above this
  fields: {                // writable "set" fields: header candidates + allowed range
    weight: { heads: ['weight (lb)', 'am weight (lb)', 'weight'], min: 50, max: 600, dec: 1 },
    sleep:  { heads: ['sleep (hours)', 'sleep (hrs)', 'sleep'], min: 0, max: 24, dec: 1 },
    steps:  { heads: ['steps', 'step count'], min: 0, max: 100000, dec: 0 },
    hike:   { heads: ['hike miles', 'hike (miles)', 'hike mi', 'miles', 'distance (mi)'], min: 0, max: 100, dec: 1 }
  },
  backupTab: 'Phone Log backup',
  journalTab: 'CC write log'
};

/* v50 (fh-fiber-notes): extra nutrients. Header candidates, the header added at the END of the Phone Log on the first
   value written (like Hike miles / Steps), and the logday range. Targets: add e.g. fiber: 30 to CONFIG.TARGETS (Code.gs)
   and it shows up in ext.targets; until then the phone keeps its own (optional) fiber target. */
var API_LOG_NUT = {
  fiber:  { heads: ['fiber (g)', 'fiber', 'fibre (g)', 'fibre', 'dietary fiber'], col: 'Fiber (g)', max: 500 },
  sugar:  { heads: ['sugar (g)', 'sugar', 'sugars'], col: 'Sugar (g)', max: 2000 },
  sodium: { heads: ['sodium (mg)', 'sodium'], col: 'Sodium (mg)', max: 50000 }
};
var API_LOG_NOTES_MAX = 1500;   // chars of a day's Notes returned per history item

function apiLog_(off) {
  apiFiberBackfillOnce_();           // v50 fh-fiber-backfill: first read after the redeploy fills the Fiber column (never blocks the read)
  var d = getDailyLog(off);          // unchanged legacy payload (Code.gs)
  try { d.ext = apiLogExt_(); } catch (err) {
    console.error('CC API log ext error: ' + (err && err.stack || err));
    d.ext = null;                    // front end falls back to the previous screen
  }
  return d;
}

function apiLogCols_(headerRow) {
  var spec = {};
  var base = CONFIG.FITNESS.HEADERS;
  Object.keys(base).forEach(function (k) { spec[k] = base[k]; });
  Object.keys(API_LOG_CFG.fields).forEach(function (k) { spec[k] = API_LOG_CFG.fields[k].heads; });
  Object.keys(API_LOG_NUT).forEach(function (k) { spec[k] = API_LOG_NUT[k].heads; });   // v50: fiber / sugar / sodium
  spec.notes = ['notes', 'note', 'comments'];   // last, so it never steals another field's header
  return mapHeaders_(headerRow, spec);
}

/** Reads the whole Phone Log and merges rows per date (latest non-blank value per field wins, rows by timestamp). */
function apiLogRead_() {
  var cfg = CONFIG.FITNESS;
  var data = readTab_(cfg.SHEET_ID, cfg.TAB);
  var values = data.values, display = data.display;
  if (values.length < 1) throw new Error('Phone Log tab is empty.');
  var col = apiLogCols_(values[0]);
  if (col.date < 0 && col.timestamp < 0) throw new Error('No Date column found in Phone Log.');
  var waterHeader = col.water >= 0 ? norm_(values[0][col.water]) : '';
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var key = col.date >= 0 ? toKey_(values[r][col.date]) : '';
    if (!key && col.timestamp >= 0) key = toKey_(values[r][col.timestamp]);
    if (!key) continue;
    var ts = col.timestamp >= 0 && values[r][col.timestamp] instanceof Date ? values[r][col.timestamp].getTime() : r;
    rows.push({ r: r, key: key, ts: ts });
  }
  rows.sort(function (a, b) { return a.ts - b.ts; });
  var byDay = {};
  rows.forEach(function (it) {
    var v = values[it.r], dv = display[it.r];
    var rec = byDay[it.key] || (byDay[it.key] = { date: it.key });
    rec.row = it.r + 1;              // 1-based sheet row of the newest row for this date
    ['calories', 'protein', 'carbs', 'fat', 'weight', 'sleep', 'steps', 'hike', 'fiber', 'sugar', 'sodium'].forEach(function (f) {
      if (col[f] >= 0) { var n = toNum_(v[col[f]]); if (n !== null) rec[f] = n; }
    });
    if (col.notes >= 0) {             // v50: every row's Notes for the day, oldest first, joined like logday appends them
      var nt = String(v[col.notes] == null ? '' : v[col.notes]).trim();
      if (nt && (!rec.notes || rec.notes.indexOf(nt) < 0)) rec.notes = rec.notes ? rec.notes + ' | ' + nt : nt;
    }
    if (col.water >= 0) {
      var w = waterToOz_(v[col.water], dv[col.water], waterHeader);
      if (w !== null) rec.water = w;
    }
    if (col.workoutType >= 0 && String(v[col.workoutType]).trim()) rec.workoutType = String(v[col.workoutType]).trim();
    if (col.workoutMinutes >= 0) { var m = toNum_(v[col.workoutMinutes]); if (m !== null) rec.workoutMinutes = m; }
    if (col.workoutToday >= 0 && String(v[col.workoutToday]).trim()) rec.workoutToday = String(v[col.workoutToday]).trim();
  });
  return { col: col, values: values, display: display, byDay: byDay };
}

function apiLogDid_(rec) {
  if (!rec) return false;
  return rec.workoutToday ? /^(y|yes|true|1)/i.test(rec.workoutToday) : (rec.workoutMinutes > 0);
}

function apiLogDayOut_(rec, key) {
  var did = apiLogDid_(rec);
  var o = { date: key, label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'), logged: !!rec, did: did };
  ['calories', 'protein', 'carbs', 'fat', 'water', 'weight', 'sleep', 'steps', 'hike', 'fiber', 'sugar', 'sodium'].forEach(function (f) { o[f] = rec ? num_(rec[f]) : null; });
  o.workout = rec ? workoutLabel_(rec, did) : '';
  o.minutes = rec ? num_(rec.workoutMinutes) : null;
  o.notes = rec && rec.notes ? (rec.notes.length > API_LOG_NOTES_MAX ? rec.notes.slice(-API_LOG_NOTES_MAX) : rec.notes) : '';   // v50 (newest text kept)
  return o;
}

function apiLogDaysBetween_(a, b) {   // yyyy-MM-dd keys, b - a in days
  return Math.round((keyToDate_(b).getTime() - keyToDate_(a).getTime()) / 86400000);
}

/**
 * Running totals over a list of day objects (apiLogDayOut_ shape). The SAME logic runs on the phone (app.js logAgg) for
 * the month-to-date card / the no-server-update fallback, so keep the two in step.
 * Averages are over FINISHED days (before today) that have a value > 0; sums include today.
 */
function apiLogAgg_(days, today, T) {
  var logged = days.filter(function (x) { return x && x.logged; }).sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });   // oldest first
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function r1(v) { return Math.round(v * 10) / 10; }
  function mean(field) {
    var s = 0, c = 0;
    logged.forEach(function (x) { if (x.date < today && isNum(x[field]) && x[field] > 0) { s += x[field]; c++; } });
    return { avg: c ? r1(s / c) : null, days: c };
  }
  function hits(field, ok) {
    var c = 0;
    logged.forEach(function (x) { if (x.date < today && isNum(x[field]) && x[field] > 0 && ok(x[field])) c++; });
    return c;
  }
  function sumOf(field) {
    var s = 0, c = 0;
    logged.forEach(function (x) { if (isNum(x[field]) && x[field] > 0) { s += x[field]; c++; } });
    return { total: r1(s), days: c };
  }
  var cal = mean('calories'), pro = mean('protein'), car = mean('carbs'), fat = mean('fat'), wat = mean('water'), slp = mean('sleep');
  cal.hit = hits('calories', function (v) { return v <= T.calories; });
  pro.hit = hits('protein', function (v) { return v >= T.protein; });
  wat.hit = hits('water', function (v) { return v >= T.water; });
  var workouts = 0, minutes = 0;
  logged.forEach(function (x) {
    if (x.did) workouts++;
    var m = isNum(x.minutes) ? x.minutes : ((/(\d+(?:\.\d+)?)\s*min/i.exec(x.workout || '') || [])[1]);
    if (m !== undefined && m !== null && isFinite(Number(m))) minutes += Number(m);
  });
  var hike = sumOf('hike'), steps = sumOf('steps');
  steps.avg = steps.days ? Math.round(steps.total / steps.days) : null;
  var wpts = logged.filter(function (x) { return isNum(x.weight) && x.weight > 0; });
  var weight = null;
  if (wpts.length) {
    var lo = wpts[0];
    wpts.forEach(function (x) { if (x.weight < lo.weight) lo = x; });
    weight = { first: wpts[0].weight, firstDate: wpts[0].date, latest: wpts[wpts.length - 1].weight, latestDate: wpts[wpts.length - 1].date,
      min: lo.weight, minDate: lo.date, change: r1(wpts[wpts.length - 1].weight - wpts[0].weight), n: wpts.length };
  }
  return {
    logged: logged.length, since: logged.length ? logged[0].date : '', until: logged.length ? logged[logged.length - 1].date : '',
    calories: cal, protein: pro, carbs: car, fat: fat, water: wat, sleep: slp,
    workouts: workouts, minutes: Math.round(minutes), hike: hike, steps: steps, weight: weight
  };
}

function apiLogExt_() {
  var rd = apiLogRead_(), col = rd.col, T = CONFIG.TARGETS, C = API_LOG_CFG;
  var today = todayKey_(), td = keyToDate_(today);
  var cutoff = dateToKey_(new Date(td.getFullYear(), td.getMonth(), td.getDate() - C.historyDays, 12));
  var keys = Object.keys(rd.byDay).filter(function (k) { return k >= cutoff && k <= today; }).sort();
  var hist = keys.slice().reverse().map(function (k) { return apiLogDayOut_(rd.byDay[k], k); });

  function hit(kind, k) {
    var rec = rd.byDay[k];
    if (!rec) return false;
    if (kind === 'calories') return typeof rec.calories === 'number' && rec.calories > 0 && rec.calories <= T.calories;
    if (kind === 'water') return typeof rec.water === 'number' && rec.water >= T.water;
    return apiLogDid_(rec);
  }
  // Streak = consecutive calendar days (a missing day breaks it). Today never breaks a streak while still pending;
  // calories only count COMPLETED days (today's total can still rise); water/workouts count today once met.
  function streak(kind, includeToday) {
    if (!keys.length) return { current: 0, best: 0, todayCounted: false };
    var run = 0, best = 0, n = apiLogDaysBetween_(keys[0], today);
    for (var i = 0; i < n; i++) {      // keys[0] .. yesterday
      var k = dateToKey_(new Date(keyToDate_(keys[0]).getFullYear(), keyToDate_(keys[0]).getMonth(), keyToDate_(keys[0]).getDate() + i, 12));
      if (hit(kind, k)) { run++; if (run > best) best = run; } else run = 0;
    }
    var todayCounted = false;
    if (includeToday && hit(kind, today)) { run++; todayCounted = true; if (run > best) best = run; }
    return { current: run, best: best, todayCounted: todayCounted };
  }
  var streaks = { calories: streak('calories', false), water: streak('water', true), workouts: streak('workouts', true) };

  // Weight / body (only meaningful when the columns exist)
  var pts = [];
  keys.forEach(function (k) { if (typeof rd.byDay[k].weight === 'number') pts.push({ date: k, v: rd.byDay[k].weight }); });
  function avgWindow(field, fromAgo, toAgo) {    // days (today - fromAgo) .. (today - toAgo), inclusive
    var s = 0, c = 0;
    keys.forEach(function (k) {
      var ago = apiLogDaysBetween_(k, today), v = rd.byDay[k][field];
      if (ago >= toAgo && ago <= fromAgo && typeof v === 'number') { s += v; c++; }
    });
    return c ? Math.round(s / c * 10) / 10 : null;
  }
  var avg7 = avgWindow('weight', 6, 0), prev7 = avgWindow('weight', 13, 7);
  var weight = {
    column: col.weight >= 0, goal: C.weightGoal,
    latest: pts.length ? pts[pts.length - 1].v : null, latestDate: pts.length ? pts[pts.length - 1].date : '',
    avg7: avg7, prevAvg7: prev7, change7: (avg7 !== null && prev7 !== null) ? Math.round((avg7 - prev7) * 10) / 10 : null,
    series: pts.slice(-30)
  };
  var hikeTotal = 0;
  keys.forEach(function (k) { var a = apiLogDaysBetween_(k, today), v = rd.byDay[k].hike; if (a <= 6 && typeof v === 'number') hikeTotal += v; });
  var body = { sleepAvg7: avgWindow('sleep', 6, 0), stepsAvg7: avgWindow('steps', 6, 0), hikeMiles7: Math.round(hikeTotal * 10) / 10 };

  // Running totals (v26): month-to-date + all time (the whole tab, not just the 120-day history)
  var totals = null;
  try {
    var allKeys = Object.keys(rd.byDay).filter(function (k) { return k <= today; }).sort();
    var allDays = allKeys.map(function (k) { return apiLogDayOut_(rd.byDay[k], k); });
    var mStart = today.slice(0, 8) + '01';
    var wAll = allDays.filter(function (x) { return typeof x.weight === 'number' && x.weight > 0; }).map(function (x) { return { date: x.date, v: x.weight }; });
    var step = Math.max(1, Math.ceil(wAll.length / 60)), wS = [];
    for (var wi = 0; wi < wAll.length; wi += step) wS.push(wAll[wi]);
    if (wAll.length && wS[wS.length - 1].date !== wAll[wAll.length - 1].date) wS.push(wAll[wAll.length - 1]);
    totals = {
      version: 1,
      all: apiLogAgg_(allDays, today, T),
      month: apiLogAgg_(allDays.filter(function (x) { return x.date >= mStart; }), today, T),
      monthStart: mStart,
      weightSeries: wS
    };
  } catch (e) { console.error('CC API log totals error: ' + (e && e.stack || e)); totals = null; }

  var setFields = Object.keys(C.fields).filter(function (f) { return col[f] >= 0; });
  var t = {}; Object.keys(T).forEach(function (k) { t[k] = T[k]; }); t.workoutsPerWeek = C.workoutsPerWeek;
  var out = {
    version: 22,                     // v50 (fh-fiber-notes)
    notesInHistory: true,
    today: apiLogDayOut_(rd.byDay[today], today),
    targets: t,
    history: hist,
    streaks: streaks,
    weight: weight,
    body: body,
    totals: totals,
    historyDays: C.historyDays,      // dlog-week: how far back `history` reaches (the phone builds Sun..Sat weeks from it)
    weekStart: 'sun',                // dlog-week: getDailyLog weeks run Sunday..Saturday
    columns: { weight: col.weight >= 0, sleep: col.sleep >= 0, steps: col.steps >= 0, hike: col.hike >= 0 },
    write: { water: col.water >= 0, waterStepOz: 8, set: setFields, logday: true }
  };
  // v50 (fh-fiber-notes): which nutrient / notes columns exist; logday takes fiber= (and sugar= / sodium=), adding the column on first use.
  Object.keys(API_LOG_NUT).forEach(function (k) { out.columns[k] = col[k] >= 0; });
  out.columns.notes = col.notes >= 0;
  out.write.fiber = true;
  out.write.nutrients = Object.keys(API_LOG_NUT);
  return out;
}

/**
 * Write to TODAY's row (v43: or the row of dateIn = optional 'YYYY-MM-DD', validated like logday: real date, not more than 1 day ahead, not more than
 * API_LOGDAY_CFG.maxDaysBack days back; a missing day gets a new row appended at the end, like logday). field = 'water' (value = ounces to ADD, may be negative to undo) or one of API_LOG_CFG.fields (value = new value).
 * Order: validate -> lock -> dedupe (cid) -> backup (once/day) -> write -> journal.
 */
function apiLogWrite_(field, value, cid, dateIn) {
  field = String(field || '').toLowerCase();
  var isWater = field === 'water', spec = API_LOG_CFG.fields[field];
  if (!isWater && !spec) return { error: 'bad_field', message: 'Unknown field.' };
  var num = Number(String(value == null ? '' : value).replace(/,/g, ''));
  if (value === '' || value == null || !isFinite(num)) return { error: 'bad_value', message: 'Enter a number.' };
  if (isWater) { if (num === 0 || Math.abs(num) > 32) return { error: 'bad_value', message: 'Water change must be 1-32 oz.' }; }
  else if (num < spec.min || num > spec.max) return { error: 'bad_value', message: 'Value out of range (' + spec.min + '-' + spec.max + ').' };
  var dayKey = (dateIn === undefined || dateIn === null || String(dateIn).trim() === '') ? todayKey_() : String(dateIn).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || toKey_(dayKey) !== dayKey || dateToKey_(keyToDate_(dayKey)) !== dayKey) return { error: 'bad_value', message: 'date must be YYYY-MM-DD.' };
  var todayK = todayKey_();
  if (dayKey > todayK && apiLogDaysBetween_(todayK, dayKey) > 1) return { error: 'bad_value', message: 'date is in the future.' };
  if (apiLogDaysBetween_(dayKey, todayK) > API_LOGDAY_CFG.maxDaysBack) return { error: 'bad_value', message: 'date is too far in the past.' };
  cid = String(cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var cache = CacheService.getScriptCache(), ck = cid ? 'cc_logw_' + cid : '';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    if (ck) {
      var seen = cache.get(ck);
      if (seen) { var pj = JSON.parse(seen); pj.duplicate = true; return { ok: true, data: pj }; }
    }
    var cfg = CONFIG.FITNESS;
    var ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) throw new Error('Phone Log tab not found.');
    var rd = apiLogRead_(), colIdx = rd.col[field];
    if (colIdx < 0) return { error: 'no_column', message: 'The Phone Log has no "' + field + '" column. Add one.' };
    var today = dayKey, rec = rd.byDay[today];
    var before = rec && typeof rec[field] === 'number' ? rec[field] : null, after;
    if (isWater) {
      after = Math.max(0, Math.round(((before || 0) + num) * 10) / 10);
      if (after > API_LOG_CFG.maxWaterOz) return { error: 'bad_value', message: 'Water total would exceed ' + API_LOG_CFG.maxWaterOz + ' oz.' };
    } else {
      var f = Math.pow(10, spec.dec);
      after = Math.round(num * f) / f;
    }

    apiLogBackup_(ss, sh);           // throws on failure -> nothing is written

    var rowNum, created = !rec, nCols = sh.getLastColumn();
    var oldDisplay = rec ? String(rd.display[rec.row - 1][colIdx] || '') : '';
    if (rec) rowNum = rec.row;
    else {
      rowNum = sh.getLastRow() + 1;
      if (rowNum > 2) sh.getRange(rowNum - 1, 1, 1, nCols).copyTo(sh.getRange(rowNum, 1, 1, nCols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      if (rd.col.timestamp >= 0) sh.getRange(rowNum, rd.col.timestamp + 1).setValue(new Date());
      if (rd.col.date >= 0) {
        var dp = today.split('-');          // the target day's own y/m/d (today when no date was sent): 'M/d/yyyy' like logday
        sh.getRange(rowNum, rd.col.date + 1).setValue(Number(dp[1]) + '/' + Number(dp[2]) + '/' + dp[0]);
      }
    }
    var cell = sh.getRange(rowNum, colIdx + 1);
    var pct = isWater && (/%\s*$/.test(oldDisplay) || /%/.test(cell.getNumberFormat()));
    cell.setValue(pct ? after / CONFIG.TARGETS.water : after);
    SpreadsheetApp.flush();
    apiLogJournal_(ss, [new Date(), (isWater ? 'water ' + (num > 0 ? '+' : '') + num : 'set') + (today !== todayK ? ' [' + today + ']' : ''), rowNum, field, before === null ? '' : before, after, cid]);

    var result = { date: today, field: field, before: before, after: after, row: rowNum, created: created, added: isWater ? num : null };
    if (ck) cache.put(ck, JSON.stringify(result), 21600);
    return { ok: true, data: result };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================== */
/* logday (v22) — upsert one day's Phone Log row                             */
/*   action=logday&date=YYYY-MM-DD(default today)&calories=&protein=&carbs=  */
/*     &fat=&mode=set|add (macros only, default set)&workout=text            */
/*     &workout_min=N&hike_miles=N&steps=N&notes=text&cid=<client id>        */
/*   Only the params you send are written; everything else in the row is     */
/*   left alone. notes are APPENDED with ' | ' (skipped if that exact text   */
/*   is already in the cell). Missing "Hike miles" / "Steps" columns are     */
/*   added at the END of the tab when a value for them is sent. Same         */
/*   passcode, LockService, cid retry-safety (6 h), once-a-day values-only   */
/*   backup ("Phone Log backup") and "CC write log" journal as logset.       */
/*   Writing `workout` also sets "Workout today?" to Y (N for rest/none).    */
/* ======================================================================== */
var API_LOGDAY_CFG = {
  macros:  { calories: [0, 20000], protein: [0, 2000], carbs: [0, 3000], fat: [0, 2000],
             fiber: [0, API_LOG_NUT.fiber.max], sugar: [0, API_LOG_NUT.sugar.max], sodium: [0, API_LOG_NUT.sodium.max] },   // v50: + fiber/sugar/sodium (mode add|set like the macros)
  numeric: { workout_min: [0, 1000, 'workoutMinutes'], hike_miles: [0, 100, 'hike'], steps: [0, 100000, 'steps'] },
  newCols: { hike: 'Hike miles', steps: 'Steps', fiber: API_LOG_NUT.fiber.col, sugar: API_LOG_NUT.sugar.col, sodium: API_LOG_NUT.sodium.col },   // appended at the end if absent
  maxNotesLen: 2000,
  maxDaysBack: 400
};

function apiLogDay_(p) {
  var C = API_LOGDAY_CFG;
  function has(k) { return p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== ''; }
  var key = has('date') ? String(p.date).trim() : todayKey_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || toKey_(key) !== key || dateToKey_(keyToDate_(key)) !== key) return { error: 'bad_value', message: 'date must be YYYY-MM-DD.' };
  var today = todayKey_();
  if (key > today && apiLogDaysBetween_(today, key) > 1) return { error: 'bad_value', message: 'date is in the future.' };
  if (apiLogDaysBetween_(key, today) > C.maxDaysBack) return { error: 'bad_value', message: 'date is too far in the past.' };
  var mode = has('mode') ? String(p.mode).toLowerCase() : 'set';
  if (mode !== 'set' && mode !== 'add') return { error: 'bad_value', message: 'mode must be set or add.' };

  // validate everything first (nothing is written if anything is bad)
  var writes = [];   // { field, kind:'num'|'text'|'notes', value, add }
  var bad = null;
  function numParam(name, lo, hi) {
    var n = Number(String(p[name]).replace(/,/g, ''));
    if (!isFinite(n) || n < lo || n > hi) { bad = name + ' must be a number ' + lo + '-' + hi + '.'; return null; }
    return Math.round(n * 10) / 10;
  }
  Object.keys(C.macros).forEach(function (f) {
    if (!has(f)) return;
    var n = numParam(f, C.macros[f][0], C.macros[f][1]);
    if (n !== null) writes.push({ field: f, kind: 'num', value: n, add: mode === 'add' });
  });
  Object.keys(C.numeric).forEach(function (name) {
    if (!has(name)) return;
    var spec = C.numeric[name], n = numParam(name, spec[0], spec[1]);
    if (n !== null) writes.push({ field: spec[2], kind: 'num', value: n, add: false });
  });
  if (has('workout')) writes.push({ field: 'workoutType', kind: 'text', value: String(p.workout).trim().slice(0, 200) });
  if (has('notes')) writes.push({ field: 'notes', kind: 'notes', value: String(p.notes).trim().slice(0, C.maxNotesLen) });
  if (bad) return { error: 'bad_value', message: bad };
  if (!writes.length) return { error: 'bad_value', message: 'Nothing to write. Send calories, protein, carbs, fat, fiber, sugar, sodium, workout, workout_min, hike_miles, steps and/or notes.' };

  var cid = String(p.cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var cache = CacheService.getScriptCache(), ck = cid ? 'cc_logday_' + cid : '';
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    if (ck) {
      var seen = cache.get(ck);
      if (seen) { var pj = JSON.parse(seen); pj.duplicate = true; return { ok: true, data: pj }; }
    }
    var cfg = CONFIG.FITNESS;
    var ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) throw new Error('Phone Log tab not found.');

    apiLogBackup_(ss, sh);           // throws on failure -> nothing is written

    // Add Hike miles / Steps (v50: + Fiber (g) / Sugar (g) / Sodium (mg)) columns at the end if a value for them is being written and the header is missing.
    var rd = apiLogRead_(), addedCols = [];
    writes.forEach(function (w) {
      if (C.newCols[w.field] && rd.col[w.field] < 0 && addedCols.indexOf(w.field) < 0) {
        var lastCol = sh.getLastColumn();
        var hc = sh.getRange(1, lastCol + 1);
        sh.getRange(1, lastCol).copyTo(hc, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        hc.setValue(C.newCols[w.field]);
        SpreadsheetApp.flush();
        addedCols.push(w.field);
        rd = apiLogRead_();
      }
    });
    for (var i = 0; i < writes.length; i++) {
      if (rd.col[writes[i].field] < 0) return { error: 'no_column', message: 'The Phone Log has no column for "' + writes[i].field + '". Add one.' };
    }
    var workoutTodayCol = rd.col.workoutToday;

    var rec = rd.byDay[key], created = !rec, nCols = sh.getLastColumn(), rowNum;
    if (rec) rowNum = rec.row;
    else {
      rowNum = sh.getLastRow() + 1;
      if (rowNum > 2) sh.getRange(rowNum - 1, 1, 1, nCols).copyTo(sh.getRange(rowNum, 1, 1, nCols), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      if (rd.col.timestamp >= 0) {
        var kd = keyToDate_(key);
        sh.getRange(rowNum, rd.col.timestamp + 1).setValue(key === today ? new Date() : new Date(kd.getFullYear(), kd.getMonth(), kd.getDate(), 20, 0, 0));
      }
      if (rd.col.date >= 0) {
        var kp = key.split('-');
        sh.getRange(rowNum, rd.col.date + 1).setValue(Number(kp[1]) + '/' + Number(kp[2]) + '/' + kp[0]);
      }
    }
    var cur = created ? [] : rd.values[rowNum - 1];     // raw values of the row actually being edited
    var result = { date: key, row: rowNum, created: created, mode: mode, written: {}, addedColumns: addedCols.map(function (f) { return C.newCols[f]; }) };
    var journal = [];

    function cellOf(field) { var c = rd.col[field]; return c >= 0 && cur.length > c ? cur[c] : ''; }
    function clip(v) { v = String(v == null ? '' : v); return v.length > 200 ? v.slice(0, 200) + '…' : v; }

    writes.forEach(function (w) {
      var colIdx = rd.col[w.field], old = cellOf(w.field), before, after, action;
      if (w.kind === 'num') {
        before = toNum_(old);
        after = w.add ? Math.round(((before || 0) + w.value) * 10) / 10 : w.value;
        action = w.add ? 'logday add ' + w.value : 'logday set';
      } else if (w.kind === 'text') {
        before = String(old == null ? '' : old).trim();
        after = w.value;
        action = 'logday set';
      } else {   // notes: append, never replace
        before = String(old == null ? '' : old).trim();
        if (before && before.indexOf(w.value) >= 0) { result.written[w.field] = { before: clip(before), after: clip(before), skipped: 'already present' }; return; }
        after = before ? before + ' | ' + w.value : w.value;
        action = 'logday append';
      }
      sh.getRange(rowNum, colIdx + 1).setValue(after);
      result.written[w.field] = { before: w.kind === 'num' ? before : clip(before), after: w.kind === 'num' ? after : clip(after) };
      journal.push([new Date(), action, rowNum, w.field, before === null ? '' : clip(before), clip(after), cid]);
    });

    // "Workout today?" follows the workout text (Y / N), same Y/N style the sheet already uses.
    if (has('workout') && workoutTodayCol >= 0) {
      var wt = /^\s*(rest|none|off)\b/i.test(String(p.workout)) ? 'N' : 'Y';
      var oldWt = String(cellOf('workoutToday') || '').trim();
      if (oldWt !== wt) {
        sh.getRange(rowNum, workoutTodayCol + 1).setValue(wt);
        result.written.workoutToday = { before: oldWt, after: wt };
        journal.push([new Date(), 'logday set', rowNum, 'workoutToday', oldWt, wt, cid]);
      }
    }
    SpreadsheetApp.flush();
    journal.forEach(function (j) { apiLogJournal_(ss, j); });
    if (ck) cache.put(ck, JSON.stringify(result), 21600);
    return { ok: true, data: result };
  } finally {
    lock.releaseLock();
  }
}


/** Values-only copy of the Phone Log to a backup tab, once per day, before the first write of that day. */
function apiLogBackup_(ss, sh) {
  var props = PropertiesService.getScriptProperties(), today = todayKey_();
  if (props.getProperty('CC_LOG_BACKUP_DATE') === today) return;
  var bt = ss.getSheetByName(API_LOG_CFG.backupTab) || ss.insertSheet(API_LOG_CFG.backupTab);
  var vals = sh.getDataRange().getValues();
  bt.clearContents();
  bt.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  bt.getRange(vals.length + 2, 1).setValue('Values-only backup of "' + sh.getName() + '" taken ' + new Date() +
    ' before the first Command Center write of ' + today + '. Overwritten on the next day of writes.');
  SpreadsheetApp.flush();
  props.setProperty('CC_LOG_BACKUP_DATE', today);
}

function apiLogJournal_(ss, row) {
  var jt = ss.getSheetByName(API_LOG_CFG.journalTab) || ss.insertSheet(API_LOG_CFG.journalTab);
  if (jt.getLastRow() === 0) jt.appendRow(['Time', 'Action', 'Sheet row', 'Field', 'Before', 'After', 'Client id']);
  jt.appendRow(row);
}


/* ======================================================================== */
/*  Daily log voice notes (v22): actions `lognote` (append) / `lognotes`     */
/*  (read). Free-text notes dictated or typed on the Daily log > Dictate     */
/*  page ("had 2 eggs and coffee, 30 min walk, weight 211, slept 7h").       */
/*  They land in the "Voice notes" tab of the fitness sheet; the assistant   */
/*  (Chief of Staff) later turns them into Phone Log entries and puts a      */
/*  mark in the "Logged?" column. Nothing here touches the Phone Log tab.    */
/*  Append-only, passcode-protected (dispatcher), LockService, retry-safe    */
/*  via cid (6 h) + same-text-within-60-s guard, length-capped.              */
/* ======================================================================== */
var API_VNOTE_CFG = { tab: 'Voice notes', max: 1500, maxRows: 5000, recent: 15,
                      header: ['Timestamp', 'Note', 'Logged?', 'Client id'] };

function apiLogNote_(text, cid) {
  var note = apiCleanNote_(text);
  if (!note) return { error: 'empty', message: 'Nothing to save.' };
  if (note.length > API_VNOTE_CFG.max) return { error: 'too_long', message: 'Note is too long (max ' + API_VNOTE_CFG.max + ' characters).' };
  cid = String(cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var cache = CacheService.getScriptCache();
  var ck = cid ? 'cc_vn_' + cid : '';
  var dk = 'cc_vnd_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, note));

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    if (ck && cache.get(ck)) return { ok: true, data: { added: false, duplicate: true } };
    if (cache.get(dk)) return { ok: true, data: { added: false, duplicate: true } };
    var ss = SpreadsheetApp.openById(CONFIG.FITNESS.SHEET_ID);
    var sh = ss.getSheetByName(API_VNOTE_CFG.tab);
    if (!sh) {
      sh = ss.insertSheet(API_VNOTE_CFG.tab);
    }
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, API_VNOTE_CFG.header.length).setValues([API_VNOTE_CFG.header]);
    var row = Math.max(sh.getLastRow(), 1) + 1;
    if (row > API_VNOTE_CFG.maxRows) return { error: 'full', message: 'The Voice notes tab is full. Archive old rows.' };
    var now = new Date();
    // Text format on the note/mark/cid cells first, so a note starting with = + - @ is stored as text, never as a formula.
    sh.getRange(row, 1, 1, 4).setNumberFormats([['yyyy-mm-dd hh:mm:ss', '@', '@', '@']]);
    sh.getRange(row, 1, 1, 4).setValues([[now, note, '', cid]]);
    SpreadsheetApp.flush();
    if (ck) cache.put(ck, '1', 21600);
    cache.put(dk, '1', 60);
    return { ok: true, data: { added: true, row: row, time: apiVNoteStamp_(now), text: note } };
  } finally {
    lock.releaseLock();
  }
}

function apiVNoteStamp_(d) {
  return d instanceof Date ? Utilities.formatDate(d, CONFIG.TIME_ZONE, 'EEE M/d \u00b7 h:mm a') : String(d || '');
}

/** Newest-first list of the last API_VNOTE_CFG.recent notes. Read-only: never creates the tab. */
function apiLogNotes_() {
  var sh = SpreadsheetApp.openById(CONFIG.FITNESS.SHEET_ID).getSheetByName(API_VNOTE_CFG.tab);
  if (!sh || sh.getLastRow() < 2) return { ok: true, data: { notes: [], total: 0, pending: 0 } };
  var vals = sh.getDataRange().getValues(), out = [], pending = 0, total = 0;
  for (var i = vals.length - 1; i >= 1; i--) {
    var r = vals[i], text = String(r[1] == null ? '' : r[1]);
    if (!text) continue;
    total++;
    var done = String(r[2] == null ? '' : r[2]).replace(/\s+/g, '') !== '';
    if (!done) pending++;
    if (out.length < API_VNOTE_CFG.recent) out.push({ time: apiVNoteStamp_(r[0]), text: text, done: done });
  }
  return { ok: true, data: { notes: out, total: total, pending: pending } };
}


/* ======================================================================= */
/* Entity books (v23) — actions `entity` and `entitytax`                    */
/*   KiwiT LLC (landlord, Mono Way building) and TiwiK LLC (Mono Village    */
/*   Laundromat operator) as two SEPARATE sets of books for tax separation. */
/*   The Vault (action spend) is untouched: it stays the combined view.     */
/*   Sierra Consultants is deliberately not here (same as the Vault).       */
/*   READ-ONLY: nothing is written to any sheet.                            */
/*                                                                          */
/*   GET <exec>?api=1&pc=..&action=entity&entity=kiwit|tiwik&offset=0       */
/*       -> month books: income (Income tab, by source) + expenses (Daily   */
/*          Spend rows whose Account = the entity) + net, bank balance      */
/*          (Balances tab), attribution flags.                              */
/*   GET <exec>?api=1&pc=..&action=entitytax&entity=kiwit|tiwik[&year=2026] */
/*       [&format=csv]  -> year-to-date category summary + all entries;     */
/*          format=csv returns {csv, filename} instead of the JSON tables.  */
/*   Loans / bills come from the existing action `vaultdebt` (filtered by   */
/*   entity on the front end), so they are not repeated here.               */
/* ======================================================================= */
var API_ENT = {
  kiwit: {
    key: 'kiwit', name: 'KiwiT', title: 'KiwiT LLC', role: 'Landlord \u00b7 Mono Way building',
    // income classification (Income tab "Source"), tested against the lower-cased source text
    incomeRx: /mono ?way|kiwit|landlord|tenant|hatler|standard ?fit|\brent(al)?s?\b/,
    // rent that is owed monthly under the lease but may not have been typed into the Income tab yet
    // (lease 8/1/2025: $3,000/mo, due the 1st; renewal 8/1/2026 allows a CPI increase that is NOT applied here)
    scheduled: [{ source: 'Mono Way rent', client: 'Leanne Hatler (Standard FIT)', amount: 3000, day: 1, from: '2025-08',
                  suppressRx: /rent|hatler|standard ?fit|tenant|mono ?way/,
                  note: 'Scheduled rent per the lease. No rent entry in the Income tab for this month, so this is counted as expected, not received.' }]
  },
  tiwik: {
    key: 'tiwik', name: 'TiwiK', title: 'TiwiK LLC', role: 'Operator \u00b7 Mono Village Laundromat',
    incomeRx: /mono ?village|laundr|tiwik/,
    scheduled: []   // TiwiK does NOT pay KiwiT rent: nothing scheduled, no rent expense is ever injected
  }
};
// keyword sets used ONLY to suggest that a row may sit in the wrong book (flags are suggestions, never changes)
var API_ENT_KW = {
  TiwiK: /laundr|huebsch|alliance|wagner|washer|dryer|\bcoin\b|mono ?village|vending|detergent|soap|\bwdf\b|dexter|speed queen/,
  KiwiT: /mono ?way|building|tenant|hatler|standard ?fit|three ins|berkshire|landlord|\brent\b|\broof\b|property tax|kiwit/
};
var API_ENT_CATKW = {   // category-only hints (low confidence)
  TiwiK: /plumb|repair|equipment|supplies/,
  KiwiT: /property tax|insurance|repair|building/
};

function apiEntCfg_(entity) {
  var k = loose_(entity).replace(/llc$/, '');   // kiwit | tiwik | "KiwiT LLC"
  return API_ENT.hasOwnProperty(k) ? API_ENT[k] : null;
}
function apiEntIncomeGroup_(source) {
  var n = norm_(source);
  if (API_ENT.tiwik.incomeRx.test(n)) return 'TiwiK';
  if (API_ENT.kiwit.incomeRx.test(n)) return 'KiwiT';
  return 'Household';
}
function apiEntYm_(off) {
  var today = keyToDate_(todayKey_());
  var m = new Date(today.getFullYear(), today.getMonth() + off, 1, 12);
  return m.getFullYear() + '-' + pad_(m.getMonth() + 1);
}
function apiEntMonthLabel_(ym) {
  var p = ym.split('-');
  return Utilities.formatDate(new Date(Number(p[0]), Number(p[1]) - 1, 1, 12), CONFIG.TIME_ZONE, 'MMMM yyyy');
}

/** Every Daily Spend row (all months), same fields as apiSpendItems_ plus the sheet row number. */
function apiEntReadSpend_() {
  var cfg = CONFIG.SPEND;
  var values = readTab_(cfg.SHEET_ID, cfg.TAB).values;
  if (values.length < 1) return [];
  var spec = {};
  Object.keys(cfg.HEADERS).forEach(function (k) { spec[k] = cfg.HEADERS[k]; });
  spec.account = ['account'];
  spec.paid = API_PAID_HEADS;
  var col = mapHeaders_(values[0], spec);
  if (col.date < 0 || col.amount < 0) return [];
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
  var items = [];
  items.hasPaidFrom = col.paid >= 0;
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null || amt === 0) continue;
    items.push({
      date: key,
      label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'),
      who: matchPerson_(str(v, col.who), cfg.PEOPLE),
      amount: round2_(amt),
      category: str(v, col.category) || 'Other',
      merchant: str(v, col.merchant),
      method: str(v, col.method),
      notes: str(v, col.notes),
      account: apiNormAccount_(str(v, col.account)),
      paidFrom: apiPaidNorm_(str(v, col.paid)).value,
      row: r + 1
    });
  }
  return items;
}

/** Every Income-tab row (all months): {date,label,source,amount,notes,group}. Personal Training / Land & Structure Pay are household, not read. */
function apiEntReadIncome_() {
  var sh = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID).getSheetByName(API_INCOME_TAB);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var col = mapHeaders_(values[0], { date: ['week ending', 'week end', 'week', 'date'], source: ['source'], amount: ['amount', '$'], notes: ['notes', 'note'] });
  if (col.date < 0 || col.amount < 0) return [];
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var key = toKey_(v[col.date]);
    if (!key) continue;
    var amt = toNum_(v[col.amount]);
    if (amt === null) continue;
    var src = str(v, col.source) || 'Other';
    out.push({ date: key, label: Utilities.formatDate(keyToDate_(key), CONFIG.TIME_ZONE, 'EEE M/d'), source: src,
               amount: round2_(amt), notes: str(v, col.notes), group: apiEntIncomeGroup_(src), row: r + 1 });
  }
  return out;
}

/** Scheduled (expected, not logged) income lines for one month. Pure. */
function apiEntScheduled_(cfg, ym, logged, todayYm) {
  var out = [];
  if (ym > todayYm) return out;   // never for future months
  (cfg.scheduled || []).forEach(function (s) {
    if (ym < s.from) return;
    var has = logged.some(function (x) { return s.suppressRx.test(norm_(x.source + ' ' + (x.notes || ''))); });
    if (has) return;
    var date = ym + '-' + pad_(s.day || 1);
    out.push({ date: date, label: Utilities.formatDate(keyToDate_(date), CONFIG.TIME_ZONE, 'EEE M/d'), source: s.source, client: s.client || '',
               amount: s.amount, notes: s.note || '', expected: true });
  });
  return out;
}

/** One month's income for an entity: logged Income-tab rows + scheduled rows when none was logged. Pure. */
function apiEntMonthIncome_(cfg, ym, incomeAll, todayYm) {
  var logged = incomeAll.filter(function (x) { return x.group === cfg.name && x.date.slice(0, 7) === ym; })
    .map(function (x) { return { date: x.date, label: x.label, source: x.source, client: '', amount: x.amount, notes: x.notes, expected: false, row: x.row }; });
  return logged.concat(apiEntScheduled_(cfg, ym, logged, todayYm));
}

function apiEntSum_(list) { var t = 0; list.forEach(function (x) { t += x.amount; }); return round2_(t); }
function apiEntByKey_(list, key) {
  var m = {}, order = [];
  list.forEach(function (x) { var k = x[key]; if (!m[k]) { m[k] = { amount: 0, count: 0 }; order.push(k); } m[k].amount += x.amount; m[k].count++; });
  return order.map(function (k) { var o = {}; o[key] = k; o.amount = round2_(m[k].amount); o.count = m[k].count; return o; })
    .sort(function (a, b) { return b.amount - a.amount; });
}
function apiEntSortDesc_(list) {
  return list.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.row || 0) - (a.row || 0); });
}

/**
 * Attribution flags for rows inside `prefix` ("2026-09" or "2026"). Suggestions only; nothing is changed.
 *  kind 'misattributed': a Household row that looks like TiwiK/KiwiT, or an entity row that looks like the OTHER entity,
 *                        or a TiwiK row that looks like rent (TiwiK does not pay KiwiT rent).
 *  kind 'tag'          : an entity row whose Method does not say it was paid from that entity's bank account/card.
 * severity 'high' = merchant/notes keyword or Method names an entity account; 'low' = category hint only / cash / blank.
 */
function apiEntFlags_(items, prefix, hasCol) {
  var out = [];
  if (hasCol === undefined) hasCol = !!(items && items.hasPaidFrom);
  var ents = ['TiwiK', 'KiwiT'];
  items.forEach(function (x) {
    if (x.date.slice(0, prefix.length) !== prefix) return;
    var text = norm_(x.merchant + ' ' + x.notes), cat = norm_(x.category), meth = norm_(x.method);
    var catHit = {};
    ents.forEach(function (e) { catHit[e] = API_ENT_CATKW[e].test(cat); });
    var base = { date: x.date, label: x.label, who: x.who, merchant: x.merchant, category: x.category, amount: x.amount, account: x.account, method: x.method, paidFrom: x.paidFrom || '', row: x.row };
    var push = function (kind, sev, suggest, why) {
      var f = {}; Object.keys(base).forEach(function (k) { f[k] = base[k]; });
      f.kind = kind; f.severity = sev; f.suggest = suggest; f.why = why; out.push(f);
    };
    if (x.account === 'Household') {
      var pfH = x.paidFrom || '';
      if (hasCol && (pfH === 'KiwiT account' || pfH === 'TiwiK account')) push('misattributed', 'high', pfH.slice(0, 5), 'Paid from the ' + pfH + ' but Account is Household: either an owner draw (not an expense) or the wrong book.');
      ents.forEach(function (e) {
        var mentions = new RegExp(e.toLowerCase()).test(meth + ' ' + text);
        if (mentions) { push('misattributed', 'high', e, 'Method/notes mention the ' + e + ' account but Account is Household.'); return; }
        if (API_ENT_KW[e].test(text) && !(API_ENT_KW[e === 'TiwiK' ? 'KiwiT' : 'TiwiK'].test(text))) {
          push('misattributed', 'high', e, 'Looks like a ' + e + ' business expense (matches "' + (text.match(API_ENT_KW[e]) || [''])[0] + '") but Account is Household.');
        } else if (catHit[e] && !API_ENT_KW[e === 'TiwiK' ? 'KiwiT' : 'TiwiK'].test(text) && !/\bhome\b|house|wetumka|stewart/.test(text)) {
          push('misattributed', 'low', e, 'Category "' + x.category + '" could belong to ' + e + '; confirm it is a home expense.');
        }
      });
      return;
    }
    if (x.account !== 'TiwiK' && x.account !== 'KiwiT') return;
    var other = x.account === 'TiwiK' ? 'KiwiT' : 'TiwiK';
    if (API_ENT_KW[other].test(text) && !API_ENT_KW[x.account].test(text)) push('misattributed', 'high', other, 'Looks like a ' + other + ' expense but Account is ' + x.account + '.');
    if (x.account === 'TiwiK' && /\brent\b|landlord|kiwit/.test(text + ' ' + cat)) push('misattributed', 'high', 'KiwiT', 'TiwiK does not pay KiwiT rent. If this is building-related it belongs to KiwiT; otherwise confirm.');
    if (hasCol) {
      // Paid from governs. Cash and the entity's own account are fine; everything else needs attention.
      var pf = x.paidFrom || '', ownAcct = x.account + ' account';
      var implied = /kiwit/.test(meth) ? 'KiwiT account' : /tiwik/.test(meth) ? 'TiwiK account' : meth === 'cash' ? 'Cash' : '';
      if (!pf) {
        push('tag', 'high', x.account, 'Paid from is empty. Set it to Cash, ' + ownAcct + ', Household card/account or Other so ' + x.account + ' has its own paper trail.' + (implied ? ' (Method says "' + x.method + '", so probably "' + implied + '".)' : ''));
      } else if (pf === 'Household card/account') {
        push('reimburse', 'high', x.account, 'Business expense paid from a Household card/account: reimburse it from ' + x.account + ' (or book it as an owner contribution) and keep the receipt.');
      } else if (pf === 'KiwiT account' || pf === 'TiwiK account') {
        if (pf !== ownAcct) push('tag', 'high', x.account, 'Paid from the ' + pf + ' but booked to ' + x.account + ': an inter-company payment. Record it as due to/from the other LLC, or fix the Account.');
      } else if (pf !== 'Cash') {
        push('tag', 'low', x.account, 'Paid from "' + x.paidFrom + '": add what it was in Notes (or pick a standard value).');
      }
      return;
    }
    var own = new RegExp(x.account.toLowerCase() + '|\\bllc\\b|business').test(meth);
    if (!own) {
      var why;
      if (!meth) why = 'No Method: cannot tell which bank account or card paid. Add a "' + x.account + ' account" / "' + x.account + ' card" tag.';
      else if (meth === 'cash') why = 'Paid in cash, not from the ' + x.account + ' bank account. Keep the receipt and record it as an owner contribution or reimburse it.';
      else why = 'Paid with "' + x.method + '". If that is not a ' + x.account + ' card/account, it is a personal payment for an LLC expense (owner contribution / reimbursement).';
      push('tag', /household|joint|personal|lisa|zac|hsa|sierra/.test(meth) ? 'high' : 'low', x.account, why);
    }
  });
  // one flag per sheet row: merge reasons, keep the strongest severity, 'misattributed' wins over 'tag'
  var merged = [], byRow = {};
  out.forEach(function (f) {
    var k = f.row + '|' + f.date;
    var m = byRow[k];
    if (!m) { m = byRow[k] = f; merged.push(m); return; }
    var rank = { misattributed: 3, reimburse: 2, tag: 1 };
    if ((rank[f.kind] || 0) > (rank[m.kind] || 0)) { m.kind = f.kind; m.suggest = f.suggest; }
    if (f.severity === 'high') m.severity = 'high';
    if (m.why.indexOf(f.why) < 0) m.why += ' ' + f.why;
  });
  merged.sort(function (a, b) { return (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0); });
  return merged;
}

/** Entity bank account(s) from the Accounts + Balances tabs, balance for the month `ym`. */
function apiEntBalance_(cfg, ym) {
  var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
  var shA = ss.getSheetByName(API_ACCT_TAB), shB = ss.getSheetByName(API_BAL_TAB);
  var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
  var accts = [], byKey = {};
  if (shA) {
    var av = shA.getDataRange().getValues();
    if (av.length >= 2) {
      var ac = mapHeaders_(av[0], { name: ['account', 'account name', 'name'], bank: ['bank'], type: ['type'], owner: ['owner', 'group'], purpose: ['purpose'], active: ['active'], kind: ['kind', 'account kind'] });
      if (ac.name >= 0) for (var r = 1; r < av.length; r++) {
        var nm = str(av[r], ac.name);
        if (!nm || apiAcctExcluded_(nm)) continue;
        if (apiAcctOwnerGroup_(str(av[r], ac.owner)) !== cfg.name) continue;
        var act = loose_(str(av[r], ac.active));
        if (act === 'no' || act === 'n' || act === 'false' || act === 'inactive' || act === '0') continue;
        if (byKey[loose_(nm)]) continue;
        var a = { name: nm, bank: str(av[r], ac.bank), type: str(av[r], ac.type), kind: apiAcctKind_(str(av[r], ac.kind), str(av[r], ac.type), nm), purpose: str(av[r], ac.purpose), entries: [] };
        byKey[loose_(nm)] = a; accts.push(a);
      }
    }
  }
  var gid = shB ? shB.getSheetId() : null;
  if (shB) {
    var bv = shB.getDataRange().getValues();
    if (bv.length >= 2) {
      var bc = mapHeaders_(bv[0], { date: ['month end', 'date', 'as of'], account: ['account'], balance: ['balance'], notes: ['notes', 'note'] });
      if (bc.date >= 0 && bc.account >= 0 && bc.balance >= 0) for (var i = 1; i < bv.length; i++) {
        var key = toKey_(bv[i][bc.date]), an = str(bv[i], bc.account), bal = toNum_(bv[i][bc.balance]);
        var tgt = byKey[loose_(an)];
        if (!key || !tgt || bal === null) continue;
        tgt.entries.push({ date: key, balance: round2_(bal), notes: str(bv[i], bc.notes), monthEnd: apiIsMonthEnd_(key), _r: i });
      }
    }
  }
  return apiEntBalancePick_(accts, ym, gid);
}
/** Pure: choose the month's balance (latest entry inside `ym`, else the latest earlier one flagged stale) + change vs the prior month end. */
function apiEntBalancePick_(accts, ym, gid) {
  var monthStart = ym + '-01';
  var out = accts.map(function (a) {
    var seen = {}, list = [];
    a.entries.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : y._r - x._r; });
    a.entries.forEach(function (e) { if (!seen[e.date]) { seen[e.date] = 1; list.push({ date: e.date, balance: e.balance, notes: e.notes, monthEnd: e.monthEnd }); } });
    var inMonth = list.filter(function (e) { return e.date.slice(0, 7) === ym; })[0] || null;
    var earlier = list.filter(function (e) { return e.date < monthStart; })[0] || null;
    var cur = inMonth || earlier;
    var prev = inMonth ? earlier : (earlier ? list.filter(function (e) { return e.date < earlier.date; })[0] || null : null);
    return { name: a.name, bank: a.bank, type: a.type, kind: a.kind || 'bank', purpose: a.purpose,
      balance: cur ? cur.balance : null, asOf: cur ? cur.date : null, monthEnd: cur ? cur.monthEnd : null, notes: cur ? cur.notes : '',
      stale: !!cur && !inMonth, forMonth: !!inMonth,
      prevBalance: prev ? prev.balance : null, prevAsOf: prev ? prev.date : null,
      change: (cur && prev) ? round2_(cur.balance - prev.balance) : null, entries: list };
  });
  var total = null;
  if (out.length && out.every(function (a) { return a.balance !== null; })) { total = 0; out.forEach(function (a) { total += apiAcctSign_(a.kind) * a.balance; }); total = round2_(total); }   // v44: total is NET (card balances owed subtracted); accounts[].balance stays raw
  return { accounts: out, total: total, gid: gid };
}

/** Pure month builder. */
function apiEntBuild_(cfg, ym, spendAll, incomeAll, today) {
  var todayYm = today.slice(0, 7);
  var exp = apiEntSortDesc_(spendAll.filter(function (x) { return x.account === cfg.name && x.date.slice(0, 7) === ym; }));
  var inc = apiEntSortDesc_(apiEntMonthIncome_(cfg, ym, incomeAll, todayYm));
  var incTot = apiEntSum_(inc), expTot = apiEntSum_(exp);
  var sched = inc.filter(function (x) { return x.expected; });
  return {
    entity: cfg.name, key: cfg.key, title: cfg.title, role: cfg.role, month: ym, monthLabel: apiEntMonthLabel_(ym), today: today,
    income: inc, expenses: exp,
    incomeTotal: incTot, incomeScheduled: apiEntSum_(sched), incomeLogged: round2_(incTot - apiEntSum_(sched)),
    expenseTotal: expTot, net: round2_(incTot - expTot),
    paidFromColumn: !!spendAll.hasPaidFrom,
    flags: apiEntFlags_(spendAll, ym, !!spendAll.hasPaidFrom).filter(function (f) { return f.account === cfg.name || f.suggest === cfg.name; })
  };
}

function apiEntity_(entity, off) {
  var cfg = apiEntCfg_(entity);
  var ym = apiEntYm_(off);
  var d = apiEntBuild_(cfg, ym, apiEntReadSpend_(), apiEntReadIncome_(), todayKey_());
  d.monthOffset = off;
  try { d.bank = apiEntBalance_(cfg, ym); } catch (err) {
    console.error('CC API entity balance error: ' + (err && err.stack || err));
    d.bank = { accounts: [], total: null, gid: null, error: String(err && err.message || err) };
  }
  return d;
}

/** Pure year builder: category summary YTD, monthly series, all entries. */
function apiEntTaxBuild_(cfg, year, spendAll, incomeAll, today) {
  var todayYm = today.slice(0, 7), lastM = (String(year) === today.slice(0, 4)) ? Number(today.slice(5, 7)) : 12;
  var inc = [], exp = [], months = [];
  for (var m = 1; m <= lastM; m++) {
    var ym = year + '-' + pad_(m);
    var mi = apiEntMonthIncome_(cfg, ym, incomeAll, todayYm);
    var me = spendAll.filter(function (x) { return x.account === cfg.name && x.date.slice(0, 7) === ym; });
    inc = inc.concat(mi); exp = exp.concat(me);
    months.push({ month: ym, income: apiEntSum_(mi), expenses: apiEntSum_(me), net: round2_(apiEntSum_(mi) - apiEntSum_(me)) });
  }
  inc = apiEntSortDesc_(inc); exp = apiEntSortDesc_(exp);
  var seriesOf = function (list, key, name) {
    var arr = []; for (var i = 0; i < lastM; i++) arr.push(0);
    list.forEach(function (x) { if (x[key] === name) arr[Number(x.date.slice(5, 7)) - 1] += x.amount; });
    return arr.map(round2_);
  };
  var bySource = apiEntByKey_(inc, 'source').map(function (s) {
    s.months = seriesOf(inc, 'source', s.source);
    s.expectedAmount = apiEntSum_(inc.filter(function (x) { return x.source === s.source && x.expected; }));
    return s;
  });
  var byCat = apiEntByKey_(exp, 'category').map(function (c) { c.months = seriesOf(exp, 'category', c.category); return c; });
  var incTot = apiEntSum_(inc), expTot = apiEntSum_(exp), sched = apiEntSum_(inc.filter(function (x) { return x.expected; }));
  return {
    entity: cfg.name, key: cfg.key, title: cfg.title, role: cfg.role, year: Number(year), through: lastM, today: today,
    months: months, income: { total: incTot, logged: round2_(incTot - sched), scheduled: sched, bySource: bySource },
    expenses: { total: expTot, count: exp.length, byCategory: byCat },
    net: round2_(incTot - expTot),
    items: { income: inc, expenses: exp },
    paidFromColumn: !!spendAll.hasPaidFrom,
    flags: apiEntFlags_(spendAll, String(year), !!spendAll.hasPaidFrom).filter(function (f) { return f.account === cfg.name || f.suggest === cfg.name; })
  };
}

function apiEntCsvCell_(v) {
  var s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // spreadsheet formula guard
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function apiEntCsv_(t) {
  var rows = [], line = function (a) { rows.push(a.map(apiEntCsvCell_).join(',')); };
  line([t.title + ' tax export', 'Year ' + t.year + ' through ' + t.year + '-' + pad_(t.through), 'Generated ' + t.today]);
  line(['Basis', 'Cash receipts/payments from the Command Center sheet. Lines marked Scheduled are expected rent not typed into the Income tab.']);
  rows.push('');
  line(['Summary', 'Type', 'Category / Source', 'Entries', 'Amount']);
  t.income.bySource.forEach(function (s) { line(['Summary', 'Income', s.source, s.count, s.amount.toFixed(2)]); });
  line(['Summary', 'Income', 'TOTAL INCOME', '', t.income.total.toFixed(2)]);
  t.expenses.byCategory.forEach(function (c) { line(['Summary', 'Expense', c.category, c.count, c.amount.toFixed(2)]); });
  line(['Summary', 'Expense', 'TOTAL EXPENSES', t.expenses.count, t.expenses.total.toFixed(2)]);
  line(['Summary', 'Net', 'NET PROFIT', '', t.net.toFixed(2)]);
  var reimb = t.items.expenses.filter(function (x) { return x.paidFrom === 'Household card/account'; });
  if (reimb.length) line(['Summary', 'Memo', 'Paid from Household card/account (reimburse the LLC)', reimb.length, apiEntSum_(reimb).toFixed(2)]);
  rows.push('');
  line(['Detail', 'Type', 'Date', 'Category / Source', 'Description', 'Method', 'Paid from', 'Amount', 'Basis', 'Notes']);
  t.items.income.slice().reverse().forEach(function (x) {
    line(['Detail', 'Income', x.date, x.source, x.client || '', '', '', x.amount.toFixed(2), x.expected ? 'Scheduled (not logged)' : 'Logged', x.notes || '']);
  });
  t.items.expenses.slice().reverse().forEach(function (x) {
    line(['Detail', 'Expense', x.date, x.category, x.merchant, x.method, x.paidFrom || '', x.amount.toFixed(2), 'Logged', x.notes || '']);
  });
  return rows.join('\r\n') + '\r\n';
}

function apiEntityTax_(entity, yearParam, format) {
  var cfg = apiEntCfg_(entity), today = todayKey_(), ty = Number(today.slice(0, 4));
  var year = parseInt(yearParam, 10);
  if (!year || year < 2000 || year > ty) year = ty;
  var t = apiEntTaxBuild_(cfg, year, apiEntReadSpend_(), apiEntReadIncome_(), today);
  if (String(format || '').toLowerCase() === 'csv') {
    return { entity: cfg.name, year: year, filename: cfg.title.replace(/\s+/g, '') + '-tax-' + year + '-through-' + pad_(t.through) + '.csv', csv: apiEntCsv_(t) };
  }
  return t;
}


/* ======================================================================= */
/* Paid from (v25) — admin write actions `spendcol` and `spendfix`           */
/*   Daily Spend column I "Paid from" (Cash | Household card/account |       */
/*   KiwiT account | TiwiK account | Other). Columns A-H are never touched.  */
/*   spendcol : create the header (and a dropdown) if it is missing; idempotent. */
/*   spendfix : set paid_from / notes / category on ONE matched row (matched */
/*              by date + amount + merchant text); built for the one-time    */
/*              backfill, usable any time. Passcode, LockService, dry run,    */
/*              once-a-day values-only backup tab "Daily Spend backup", every */
/*              change journaled on the tab "CC write log".                  */
/*   There is no other spend-entry write path in the app/API (rows are typed  */
/*   into the sheet / logged through the assistant), so these are the only    */
/*   places that accept paid_from.                                           */
/* ======================================================================= */
var API_SPENDFIX_CFG = { backupTab: 'Daily Spend backup', journalTab: 'CC write log', maxNotes: 300, maxCat: 60 };

/** Find or create the "Paid from" header. Returns { sh, col (0-based), created }. Existing columns are never moved or edited. */
function apiPaidEnsureCol_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = mapHeaders_(head, { paid: API_PAID_HEADS }).paid;
  if (idx >= 0) return { col: idx, created: false };
  var target = 9;   // column I
  if (target <= head.length && String(head[target - 1] == null ? '' : head[target - 1]).trim() !== '') {
    target = head.length + 1;   // I is taken by something else: use the first free column after the data
  }
  sh.getRange(1, 8).copyTo(sh.getRange(1, target), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);   // match the header style
  sh.getRange(1, target).setValue('Paid from');
  try {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(API_PAID_FROM, true).setAllowInvalid(true)
      .setHelpText('Who/what paid: ' + API_PAID_FROM.join(' | ')).build();
    sh.getRange(2, target, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  } catch (e) { console.error('CC paid-from validation: ' + e); }
  SpreadsheetApp.flush();
  return { col: target - 1, created: true };
}

function apiSpendCol_() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var sh = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID).getSheetByName(CONFIG.SPEND.TAB);
    if (!sh) return { error: 'no_tab', message: 'Daily Spend tab not found.' };
    var r = apiPaidEnsureCol_(sh);
    if (r.created) apiSpendJournal_(sh.getParent(), [new Date(), 'spendcol', 1, 'header', '', 'Paid from (column ' + apiColLetter_(r.col + 1) + ')', '']);
    return { ok: true, data: { created: r.created, column: apiColLetter_(r.col + 1), values: API_PAID_FROM } };
  } finally { lock.releaseLock(); }
}
function apiColLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

function apiSpendJournal_(ss, row) {
  var jt = ss.getSheetByName(API_SPENDFIX_CFG.journalTab) || ss.insertSheet(API_SPENDFIX_CFG.journalTab);
  if (jt.getLastRow() === 0) jt.appendRow(['Time', 'Action', 'Sheet row', 'Field', 'Before', 'After', 'Client id']);
  jt.appendRow(row);
}
function apiSpendBackup_(ss, sh) {
  var props = PropertiesService.getScriptProperties(), today = todayKey_();
  if (props.getProperty('CC_SPEND_BACKUP_DATE') === today) return;
  var bt = ss.getSheetByName(API_SPENDFIX_CFG.backupTab) || ss.insertSheet(API_SPENDFIX_CFG.backupTab);
  var vals = sh.getDataRange().getValues();
  bt.clearContents();
  bt.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  bt.getRange(vals.length + 2, 1).setValue('Values-only backup of "' + sh.getName() + '" taken ' + new Date() + ' before the first Command Center write of ' + today + '. Overwritten on the next day of writes.');
  SpreadsheetApp.flush();
  props.setProperty('CC_SPEND_BACKUP_DATE', today);
}

/**
 * params: date (yyyy-mm-dd), amount, merchant (case-insensitive substring)  — required, must match exactly ONE row
 *         account (optional extra filter), row (optional: sheet row number that must equal the match)
 *         paid_from (one of API_PAID_FROM, case-insensitive exact), notes (text; appended with " | " unless already present;
 *         notes_mode=set replaces), category (replaces); at least one of these three
 *         dry=1 (preview only, writes nothing)
 */
function apiSpendFix_(p) {
  p = p || {};
  var date = toKey_(p.date), amt = Number(String(p.amount == null ? '' : p.amount).replace(/[$,\s]/g, ''));
  var mer = norm_(p.merchant);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '').trim()) || !date || !isFinite(amt) || String(p.amount == null ? '' : p.amount).trim() === '' || !mer) {
    return { error: 'bad_value', message: 'date (yyyy-mm-dd), amount and merchant are required.' };
  }
  var want = {};   // field -> new value
  if (p.paid_from != null && String(p.paid_from).trim() !== '') {
    var hit = null;
    API_PAID_FROM.forEach(function (v) { if (loose_(v) === loose_(p.paid_from)) hit = v; });
    if (!hit) return { error: 'bad_value', message: 'paid_from must be one of: ' + API_PAID_FROM.join(' | ') };
    want.paid = hit;
  }
  var notes = p.notes == null ? '' : String(p.notes).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (notes || (p.notes != null && String(p.notes_mode || '').toLowerCase() === 'set')) {   // v47: notes_mode=set with an empty value clears Notes (removes a "[Pay: X]" tag)
    if (notes.length > API_SPENDFIX_CFG.maxNotes) return { error: 'too_long', message: 'notes max ' + API_SPENDFIX_CFG.maxNotes + ' characters.' };
    want.notes = notes;
  }
  var cat = p.category == null ? '' : String(p.category).replace(/\s+/g, ' ').trim();
  if (cat) {
    if (cat.length > API_SPENDFIX_CFG.maxCat) return { error: 'too_long', message: 'category max ' + API_SPENDFIX_CFG.maxCat + ' characters.' };
    want.category = cat;
  }
  if (!Object.keys(want).length && p.method == null) return { error: 'bad_value', message: 'Nothing to change: send paid_from, notes, category and/or method.' };   // v47: method= counts
  var dry = /^(1|true|yes)$/i.test(String(p.dry || ''));
  var setNotes = String(p.notes_mode || '').toLowerCase() === 'set';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var cfg = CONFIG.SPEND, ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) return { error: 'no_tab', message: 'Daily Spend tab not found.' };
    var values = sh.getDataRange().getValues();
    var spec = {}; Object.keys(cfg.HEADERS).forEach(function (k) { spec[k] = cfg.HEADERS[k]; });
    spec.account = ['account']; spec.paid = API_PAID_HEADS;
    var col = mapHeaders_(values[0], spec);
    if (col.date < 0 || col.amount < 0 || col.merchant < 0) return { error: 'no_columns', message: 'Date, Amount and Merchant columns are required.' };
    var str = function (v, c) { return c >= 0 ? String(v[c] == null ? '' : v[c]).trim() : ''; };
    var acctFilter = p.account ? apiNormAccount_(String(p.account)) : '';
    var matches = [];
    for (var r = 1; r < values.length; r++) {
      var v = values[r];
      if (toKey_(v[col.date]) !== date) continue;
      var a = toNum_(v[col.amount]);
      if (a === null || Math.abs(a - amt) > 0.005) continue;
      if (norm_(str(v, col.merchant)).indexOf(mer) < 0) continue;
      if (acctFilter && apiNormAccount_(str(v, col.account)) !== acctFilter) continue;
      if (p.row != null && String(p.row).trim() !== '' && Number(p.row) !== r + 1) continue;
      matches.push({ rowNum: r + 1, merchant: str(v, col.merchant), account: apiNormAccount_(str(v, col.account)), paidFrom: str(v, col.paid), notes: str(v, col.notes), category: str(v, col.category) });
    }
    if (!matches.length) return { error: 'no_match', message: 'No Daily Spend row matches that date + amount + merchant.' };
    if (matches.length > 1) return { error: 'ambiguous', message: matches.length + ' rows match; add account= or row= to pick one.', candidates: matches.map(function (m) { return { row: m.rowNum, merchant: m.merchant, account: m.account, paidFrom: m.paidFrom }; }) };
    var m = matches[0], changes = [];
    if (want.paid !== undefined && apiPaidNorm_(m.paidFrom).value !== want.paid) changes.push({ field: 'Paid from', before: m.paidFrom, after: want.paid });
    if (want.notes !== undefined) {
      var after = setNotes ? want.notes : (norm_(m.notes).indexOf(norm_(want.notes)) >= 0 ? m.notes : (m.notes ? m.notes + ' | ' : '') + want.notes);
      if (after !== m.notes) changes.push({ field: 'Notes', before: m.notes, after: after });
    }
    if (want.category !== undefined && want.category !== m.category) changes.push({ field: 'Category', before: m.category, after: want.category });
    if (p.method != null && col.method >= 0) {      // v47: Edit payment type; '' clears it
      var curM = String(values[m.rowNum - 1][col.method] == null ? '' : values[m.rowNum - 1][col.method]).trim(), wantM = apiAdminClean_(p.method, 30);
      if (wantM !== curM) changes.push({ field: 'Method', before: curM, after: wantM });
    }
    var out = { row: m.rowNum, merchant: m.merchant, account: m.account, dry: dry, changes: changes, unchanged: !changes.length };
    if (dry || !changes.length) return { ok: true, data: out };

    apiSpendBackup_(ss, sh);
    var paidIdx = col.paid;
    if (want.paid !== undefined && paidIdx < 0) { paidIdx = apiPaidEnsureCol_(sh).col; }
    changes.forEach(function (c) {
      var ci = c.field === 'Paid from' ? paidIdx : c.field === 'Notes' ? col.notes : c.field === 'Method' ? col.method : col.category;
      if (ci < 0) { c.skipped = 'column not found'; return; }
      if (c.field === 'Category' || c.field === 'Method') { apiAdminSetCell_(sh, m.rowNum, ci, c.after, true, null); apiSpendJournal_(ss, [new Date(), 'spendfix', m.rowNum, c.field, c.before, c.after, '']); return; }   // v46 / v47: extends a strict dropdown
      var cell = sh.getRange(m.rowNum, ci + 1);
      cell.setNumberFormat('@');      // text: a value starting with = + - @ can never become a formula
      cell.setValue(c.after);
      apiSpendJournal_(ss, [new Date(), 'spendfix', m.rowNum, c.field, c.before, c.after, '']);
    });
    SpreadsheetApp.flush();
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* Admin writes (v28): balset (Accounts + Balances tabs) and incomeadd      */
/* (Income / Land & Structure Pay tabs). Passcode-protected like every      */
/* other action. Both: dry=1 previews and writes nothing; a values-only     */
/* backup tab ("<tab> backup", first write of the day) and a row in the     */
/* "CC write log" tab; idempotent (same cid, or same row already present).  */
/* ======================================================================= */
var API_ADMIN_OWNERS = ['Household', 'TiwiK', 'KiwiT', 'Investments'];

function apiAdminClean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, max || 300);
}
/** true when the text looks like it carries an account number (4+ digits after acct/account/ending/x/#, or any 6+ digit run). */
function apiAdminHasAcctNo_(s) {
  var t = String(s == null ? '' : s);
  if (/(acct|account|ending|ends|x{2,}|\*{2,}|#|no\.?)\s*[:#-]?\s*\d{4,}/i.test(t)) return true;
  var rest = t.replace(/\$?\d{1,3}(,\d{3})+(\.\d+)?|\$?\d+\.\d+/g, ' ');   // dollar amounts are fine
  return /\b\d{6,}\b/.test(rest);
}
function apiAdminBool_(v) { return /^(1|true|yes)$/i.test(String(v == null ? '' : v)); }
function apiAdminAmount_(v) {
  var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}
function apiAdminDate_(v) {
  var s = String(v == null ? '' : v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '';
  return s;
}
/** Values-only backup of one tab into "<tab> backup", once per tab per day, before the first write of that day. */
function apiTabBackup_(ss, sh) {
  var props = PropertiesService.getScriptProperties(), today = todayKey_(), key = 'CC_BK_' + loose_(sh.getName());
  if (props.getProperty(key) === today) return;
  var name = sh.getName() + ' backup';
  var bt = ss.getSheetByName(name) || ss.insertSheet(name);
  var vals = sh.getDataRange().getValues();
  bt.clearContents();
  if (vals.length && vals[0].length) bt.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  bt.getRange(vals.length + 2, 1).setValue('Values-only backup of "' + sh.getName() + '" taken ' + new Date() + ' before the first Command Center write of ' + today + '. Overwritten on the next day of writes.');
  SpreadsheetApp.flush();
  props.setProperty(key, today);
}
/** True when the write log already holds this action + cid. */
function apiAdminSeenCid_(ss, action, cid) {
  if (!cid) return false;
  var jt = ss.getSheetByName(API_SPENDFIX_CFG.journalTab);
  if (!jt || jt.getLastRow() < 2) return false;
  var v = jt.getRange(2, 1, jt.getLastRow() - 1, 7).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][1]) === action && String(v[i][6]) === cid) return true;
  return false;
}
/**
 * Where a new data row goes. values = sheet values, keyIdx = 0-based key column (isDate: a parseable date marks a data row).
 * lastData = last row (0-based index into values) with a data row; the new row goes right under it. If something
 * already sits there (e.g. a Total row) a row is inserted above it, otherwise the empty row is used.
 * Returns { row (1-based), insert (bool), lastDataRow (1-based, 1 = header only) }.
 */
function apiAdminNextRow_(values, keyIdx, width, isDate) {
  var last = 0;
  // a date column marks data rows; for tabs without dates (Accounts) any non-empty key cell does
  for (var r = 1; r < values.length; r++) if (isDate ? toKey_(values[r][keyIdx]) : String(values[r][keyIdx] == null ? '' : values[r][keyIdx]).trim() !== '') last = r;
  var nxt = values[last + 1], occupied = false;
  if (nxt) for (var c = 0; c < Math.min(width, nxt.length); c++) if (String(nxt[c] == null ? '' : nxt[c]).trim() !== '') occupied = true;
  return { row: last + 2, insert: occupied, lastDataRow: last + 1 };
}
/** Prepare the row at `row`: insert if needed, copy cell formats from the last data row, and (when a Total row was pushed down) extend its SUM end row. */
function apiAdminPrepRow_(sh, pos, width, journalFn) {
  if (pos.insert) sh.insertRowBefore(pos.row);
  if (pos.lastDataRow >= 2) sh.getRange(pos.lastDataRow, 1, 1, width).copyTo(sh.getRange(pos.row, 1, 1, width), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  if (pos.insert) {
    var tr = sh.getRange(pos.row + 1, 1, 1, width), fs = tr.getFormulas()[0];
    for (var c = 0; c < fs.length; c++) {
      if (!fs[c] || fs[c].charAt(0) !== '=') continue;
      var f2 = fs[c].replace(/([A-Z]+)(\d+):([A-Z]+)(\d+)/g, function (m, c1, r1, c2, r2) { return Number(r2) === pos.row - 1 ? c1 + r1 + ':' + c2 + pos.row : m; });
      if (f2 !== fs[c]) { sh.getRange(pos.row + 1, c + 1).setFormula(f2); if (journalFn) journalFn(pos.row + 1, 'total formula col ' + (c + 1), fs[c], f2); }
    }
  }
}
/**
 * Make `value` acceptable to the validation on the cell (row is 1-based, col0 0-based) BEFORE writing it.
 * - list validation (e.g. Accounts "Type", Income "Source"): the value is appended to the list. Existing values and settings are kept,
 *   and every cell in that column carrying the same list gets the extended list, so the new value is a normal dropdown choice.
 * - validation that takes its list from a range: if the value is in the range nothing changes, otherwise this cell becomes warning-only.
 * Returns a short description of what changed ('' when nothing).
 */
function apiAdminAllow_(sh, row, col0, value) {
  var cell = sh.getRange(row, col0 + 1), dv = cell.getDataValidation();
  if (!dv) return '';
  var C = SpreadsheetApp.DataValidationCriteria, t = dv.getCriteriaType(), v = String(value);
  if (t === C.VALUE_IN_LIST) {
    var args = dv.getCriteriaValues(), list = (args[0] || []).map(String), show = args.length > 1 ? args[1] : true;
    if (list.indexOf(v) >= 0) return '';
    var newList = list.concat([v]), rule = dv.copy().requireValueInList(newList, show !== false).build();
    var sig = list.join('\u0001'), maxR = sh.getMaxRows();
    if (maxR >= 2) {
      var rng = sh.getRange(2, col0 + 1, maxR - 1, 1), dvs = rng.getDataValidations();
      for (var i = 0; i < dvs.length; i++) {
        var d = dvs[i][0];
        if (d && d.getCriteriaType() === C.VALUE_IN_LIST && ((d.getCriteriaValues()[0] || []).map(String).join('\u0001') === sig)) dvs[i][0] = rule;
      }
      rng.setDataValidations(dvs);
    }
    cell.setDataValidation(rule);
    return 'list +' + v;
  }
  if (t === C.VALUE_IN_RANGE) {
    var rg = dv.getCriteriaValues()[0], have = false;
    try { rg.getValues().forEach(function (r) { r.forEach(function (x) { if (String(x) === v) have = true; }); }); } catch (e) { have = false; }
    if (have) return '';
    cell.setDataValidation(dv.copy().setAllowInvalid(true).build());
    return 'warning-only (list from range)';
  }
  return '';
}
/** Write one cell. Text goes in as text (never a formula) after the validation list is extended; if the sheet still rejects it, that one cell is made warning-only and the write is retried once. */
function apiAdminSetCell_(sh, row, col0, value, asText, notes) {
  var cell = sh.getRange(row, col0 + 1);
  if (asText) { var ch = apiAdminAllow_(sh, row, col0, value); if (ch && notes) notes.push('R' + row + 'C' + (col0 + 1) + ' ' + ch); cell = sh.getRange(row, col0 + 1); }
  var put = function () { if (asText) cell.setNumberFormat('@'); cell.setValue(value); };
  try { put(); } catch (e) {
    if (!/validation/i.test(String(e && e.message || e))) throw e;
    var dv = cell.getDataValidation();
    if (!dv) throw e;
    cell.setDataValidation(dv.copy().setAllowInvalid(true).build());
    if (notes) notes.push('R' + row + 'C' + (col0 + 1) + ' warning-only');
    put();
  }
}
function apiAdminSetDate_(sh, row, col0, key, sample, notes) {
  apiAdminSetCell_(sh, row, col0, sample instanceof Date ? keyToDate_(key) : key, !(sample instanceof Date), notes);
}
/** Undo stack: each entry restores one thing. Run newest first. */
function apiAdminUndo_(stack) {
  var errs = [];
  while (stack.length) { try { stack.pop()(); } catch (e) { errs.push(String(e && e.message || e)); } }
  return errs;
}

/**
 * action=incomeadd  (GET params or POST body)
 *   tab          'income' (Income tab: Week ending | Source | Amount | Notes) | 'ls' (Land & Structure Pay tab: Date | Description | Amount | Method | Notes)
 *                | 'pt' (v34: Personal Training tab: Date | Client | Amount | Method | Notes)
 *   date         yyyy-mm-dd          amount  positive dollars (e.g. 1831.09)
 *   source       (tab=income, required)   description (tab=ls, default "Land & Structure pay")   method (optional, all tabs; see below)
 *                (tab=pt: source = the client name, required; client= or description= are accepted as aliases)
 *   strict=1     (v34, tab=income) the Source must already be in the Source dropdown or used by an existing Income row (loose match, written in that
 *                spelling); otherwise {error:'unknown_source', sources:[...]} and nothing is written (the source is NOT added to the list)
 *   method       v42, optional: Cash | Credit | Debit | Venmo | Zelle | Check | ACH/Transfer | Other ('Credit card' = Credit; loose, canonical spelling written).
 *                tab=income: anything else -> bad_value; the Income tab has no Method column by default and none is created: the row is written WITHOUT the method and the
 *                response carries methodNote:'method_not_saved' (+ methodRequested). Add a column headed Method (or Payment / Paid via) to the Income tab and it is used automatically.
 *                tab=ls / pt: written to their Method column as before; a value outside the list is kept as typed (old free-text behavior).
 *   notes        optional, max 300   cid  client id (required when writing; the same cid is never written twice)
 *   fill_placeholder  (tab=ls) default on: a $0 row in the same month whose Notes say "placeholder" is filled in instead of adding a row; fill_placeholder=0 disables
 *   dry=1        preview only
 * v29: a new Source (or any value the column's data validation list does not have) is added to that list first; the row is written
 * all-or-nothing (a failure removes/restores the row and returns write_failed); a half-written stub row (date only, from an earlier failed
 * write) is reused instead of leaving a blank row behind.
 */
function apiIncomeAdd_(p) {
  p = p || {};
  var tabKey = String(p.tab || '').toLowerCase();
  if (tabKey !== 'income' && tabKey !== 'ls' && tabKey !== 'pt') return { error: 'bad_value', message: 'tab must be income, ls or pt.' };
  var date = apiAdminDate_(p.date), amt = apiAdminAmount_(p.amount);
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  if (amt === null || !(amt > 0)) return { error: 'bad_value', message: 'amount must be a positive number (dollars, up to 2 decimals).' };
  var notes = apiAdminClean_(p.notes, 300), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var category = apiCatClean_(p.category);   // v46: optional; written to the tab's Category column (created on first use)
  var label, method = '';
  var strict = tabKey === 'income' && apiAdminBool_(p.strict);
  if (tabKey === 'income') {
    label = apiAdminClean_(p.source, 80);
    if (!label) return { error: 'bad_value', message: 'source is required for tab=income.' };
    var mIn = apiAdminClean_(p.method, 30);
    if (mIn) {
      method = apiPayPick_(API_PAY_METHODS, mIn);
      if (!method) return { error: 'bad_value', message: 'method must be one of: ' + API_PAY_METHODS.join(' | ') };
    }
  } else if (tabKey === 'pt') {
    label = apiAdminClean_(p.source, 80) || apiAdminClean_(p.client, 80) || apiAdminClean_(p.description, 80);
    if (!label) return { error: 'bad_value', message: 'source (the client name) is required for tab=pt.' };
    method = apiAdminClean_(p.method, 30); method = apiPayPick_(API_PAY_METHODS, method) || method;
  } else {
    label = apiAdminClean_(p.description, 80) || 'Land & Structure pay';
    method = apiAdminClean_(p.method, 30); method = apiPayPick_(API_PAY_METHODS, method) || method;
  }
  if (apiAdminHasAcctNo_(label + ' ' + notes + ' ' + method)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var fillPh = tabKey === 'ls' && String(p.fill_placeholder == null ? '1' : p.fill_placeholder) !== '0';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var tabConst = apiIncomeTabName_(tabKey);
    var sh = ss.getSheetByName(tabConst);
    if (!sh) return { error: 'no_tab', message: tabConst + ' tab not found.' };
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'Tab has no header row.' };
    var col = apiIncomeCols_(tabKey, values[0]);
    if (col.date < 0 || col.label < 0 || col.amount < 0) return { error: 'no_columns', message: 'Date, ' + (tabKey === 'income' ? 'Source' : tabKey === 'pt' ? 'Client' : 'Description') + ' and Amount columns are required.' };
    var catCreated = false;
    if (category && col.category < 0 && !dry && !apiAdminSeenCid_(ss, 'incomeadd', cid)) {      // v46: first categorised entry on this tab -> add the Category column, then re-read
      var cc = apiIncomeCatCol_(sh, tabKey); catCreated = cc.created;
      if (cc.created) apiSpendJournal_(ss, [new Date(), 'incomeadd', 1, sh.getName() + ': header', '', 'Category (column ' + apiColLetter_(cc.col + 1) + ')', '']);
      values = sh.getDataRange().getValues(); col = apiIncomeCols_(tabKey, values[0]);
    }
    if (method && col.method < 0 && !dry && !apiAdminSeenCid_(ss, 'incomeadd', cid)) {      // v47: first entry with a payment type -> add "Payment type", then re-read
      var pc = apiIncomePayCol_(sh, tabKey);
      if (pc.created) apiSpendJournal_(ss, [new Date(), 'incomeadd', 1, sh.getName() + ': header', '', 'Payment type (column ' + apiColLetter_(pc.col + 1) + ')', '']);
      values = sh.getDataRange().getValues(); col = apiIncomeCols_(tabKey, values[0]);
    }
    var width = Math.max(col.date, col.label, col.amount, col.method, col.notes, col.category) + 1;
    var tabName = sh.getName();
    var summary = { tab: tabName, date: date, label: label, amount: round2_(amt), method: method, notes: notes, cid: cid, dry: dry };
    if (category) { summary.category = category; if (col.category < 0) summary.categoryColumn = dry ? 'would_create' : 'missing'; else if (catCreated) summary.categoryColumn = 'created'; }
    if (method && col.method < 0) { summary.methodNote = dry ? 'would_create' : 'method_not_saved'; summary.methodRequested = method; summary.method = ''; method = ''; }   // v47: only when dry (the column is created above)

    if (apiAdminSeenCid_(ss, 'incomeadd', cid)) { summary.duplicate = 'cid'; return { ok: true, data: summary }; }
    // same date + amount + label already on the tab -> nothing to do
    for (var r = 1; r < values.length; r++) {
      var a = toNum_(values[r][col.amount]);
      if (toKey_(values[r][col.date]) === date && a !== null && Math.abs(a - amt) < 0.005 && loose_(values[r][col.label]) === loose_(label)) {
        summary.duplicate = 'row'; summary.row = r + 1; return { ok: true, data: summary };
      }
    }
    // v34 strict=1 (tab=income): only a Source that already exists (dropdown list or an existing Income row) is accepted, in its existing spelling
    if (strict) {
      var known = apiIncomeKnownSources_(sh, values, col.label), hit = '';
      known.forEach(function (x) { if (!hit && loose_(x) === loose_(label)) hit = x; });
      if (!hit) return { error: 'unknown_source', message: 'Source "' + label + '" is not in the Income Source list and no Income row uses it. Nothing was written. Use one of the existing sources, or resend without strict=1 to add it as a new source.', sources: known };
      if (hit !== label) { label = hit; summary.label = hit; summary.sourceMatched = true; }
    }
    // row to reuse: (1) a half-written stub (date only, everything else blank) left by an earlier failed write, (2) ls placeholder
    var reuse = 0, reuseKind = '';
    for (var s = 1; s < values.length && !reuse; s++) {
      var rowv = values[s], onlyDate = !!toKey_(rowv[col.date]);
      for (var c = 0; c < width && onlyDate; c++) if (c !== col.date && String(rowv[c] == null ? '' : rowv[c]).trim() !== '') onlyDate = false;
      if (onlyDate) { reuse = s + 1; reuseKind = 'reuse_blank_row'; }
    }
    if (!reuse && fillPh) {
      var ym = date.slice(0, 7);
      for (var q = 1; q < values.length && !reuse; q++) {
        var k = toKey_(values[q][col.date]), na = toNum_(values[q][col.amount]);
        if (k && k.slice(0, 7) === ym && (na === null || na === 0) && col.notes >= 0 && /placeholder/i.test(String(values[q][col.notes]))) { reuse = q + 1; reuseKind = 'fill_placeholder'; }
      }
    }
    var pos = reuse ? { row: reuse, insert: false, lastDataRow: 0 } : apiAdminNextRow_(values, col.date, width, true);
    summary.action = reuse ? reuseKind : (pos.insert ? 'insert_above_total' : 'append');
    summary.row = pos.row;
    if (dry) return { ok: true, data: summary };

    apiTabBackup_(ss, sh);
    var journal = function (row, field, before, after) { apiSpendJournal_(ss, [new Date(), 'incomeadd', row, tabName + ': ' + field, before, after, '']); };
    var undo = [], vnotes = [];
    var sample = reuse ? values[reuse - 1][col.date] : (values[Math.max(1, pos.lastDataRow - 1)] ? values[Math.max(1, pos.lastDataRow - 1)][col.date] : '');
    var before = reuse ? values[reuse - 1].slice(0, width).join(' | ') : '';
    try {
      if (reuse) {
        var old = values[reuse - 1].slice(0, width);
        undo.push(function () { sh.getRange(reuse, 1, 1, width).setValues([old]); });
      } else {
        apiAdminPrepRow_(sh, pos, width, journal);
        undo.push(function () { if (pos.insert) sh.deleteRow(pos.row); else sh.getRange(pos.row, 1, 1, width).clearContent(); });
      }
      apiAdminSetDate_(sh, pos.row, col.date, date, sample, vnotes);
      apiAdminSetCell_(sh, pos.row, col.label, label, true, vnotes);
      apiAdminSetCell_(sh, pos.row, col.amount, round2_(amt), false, vnotes);
      if (sh.getRange(pos.row, col.amount + 1).getNumberFormat() === 'General') sh.getRange(pos.row, col.amount + 1).setNumberFormat('$#,##0.00');
      if (col.method >= 0) apiAdminSetCell_(sh, pos.row, col.method, method, true, vnotes);
      if (col.notes >= 0) apiAdminSetCell_(sh, pos.row, col.notes, notes, true, vnotes);
      if (col.category >= 0 && category) apiAdminSetCell_(sh, pos.row, col.category, category, true, vnotes);
      SpreadsheetApp.flush();
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      apiSpendJournal_(ss, [new Date(), 'incomeadd', pos.row, tabName + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row removed/restored') + ' (cid ' + cid + ')', '']);
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    if (vnotes.length) summary.validation = vnotes;
    apiSpendJournal_(ss, [new Date(), 'incomeadd', pos.row, tabName + ': ' + summary.action, before, date + ' | ' + label + ' | ' + round2_(amt) + (method ? ' | ' + method : '') + (notes ? ' | ' + notes : '') + (category ? ' | [' + category + ']' : '') + (vnotes.length ? ' [' + vnotes.join('; ') + ']' : ''), cid]);
    return { ok: true, data: summary };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=balset  (GET params or POST body) — upsert one Balances row (and the Accounts row if the account is not listed yet)
 *   account   required (name as it should appear in the Vault, e.g. "E*TRADE Brokerage")
 *   balance   dollars (number)        asof  yyyy-mm-dd (the statement / as-of date)
 *   note      optional, max 300       cid   required when writing
 *   Used only when the account is NOT on the Accounts tab yet (or is there as a half-written row with no Owner):
 *   owner     Household | TiwiK | KiwiT | Investments (default Household; this is the Vault group)
 *   bank, type, purpose   free text (no account numbers)
 *   An existing Balances row for the same account + asof date is updated in place (balance/note); otherwise a row is added.
 *   dry=1 previews. Sierra accounts and anything that looks like an account number are rejected.
 * v29: new Type / Owner / Bank values are added to the column's data validation list first; all-or-nothing (a failure removes/restores
 * what this call wrote and returns write_failed); an account row left half-written by an earlier failed call is completed (blank cells only).
 */
function apiBalSet_(p) {
  p = p || {};
  var account = apiAdminClean_(p.account, 80), bal = apiAdminAmount_(p.balance), asof = apiAdminDate_(p.asof || p.asOf || p.date);
  var note = apiAdminClean_(p.note != null ? p.note : p.notes, 300), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var bank = apiAdminClean_(p.bank, 80), type = apiAdminClean_(p.type, 60), purpose = apiAdminClean_(p.purpose, 200);
  var ownerIn = apiAdminClean_(p.owner || p.group || 'Household', 40), owner = '';
  API_ADMIN_OWNERS.forEach(function (o) { if (loose_(o) === loose_(ownerIn)) owner = o; });
  if (!account) return { error: 'bad_value', message: 'account is required.' };
  if (apiAcctExcluded_(account)) return { error: 'excluded', message: 'That account is deliberately not kept in the Vault.' };
  if (bal === null) return { error: 'bad_value', message: 'balance must be a number (dollars).' };
  if (!asof) return { error: 'bad_value', message: 'asof must be yyyy-mm-dd.' };
  if (!owner) return { error: 'bad_value', message: 'owner must be one of: ' + API_ADMIN_OWNERS.join(' | ') };
  if (apiAdminHasAcctNo_(account + ' ' + bank + ' ' + type + ' ' + purpose + ' ' + note)) return { error: 'no_account_numbers', message: 'Do not send account numbers (not even the last 4).' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var shA = ss.getSheetByName(API_ACCT_TAB), shB = ss.getSheetByName(API_BAL_TAB);
    if (!shA || !shB) return { error: 'no_tab', message: 'Accounts and Balances tabs are required.' };
    var av = shA.getDataRange().getValues(), bv = shB.getDataRange().getValues();
    if (!av.length || !bv.length) return { error: 'no_columns', message: 'Accounts / Balances need a header row.' };
    var ac = mapHeaders_(av[0], { name: ['account', 'account name', 'name'], bank: ['bank'], type: ['type'], owner: ['owner', 'group'], purpose: ['purpose'], active: ['active'] });
    var bc = mapHeaders_(bv[0], { date: ['month end', 'date', 'as of'], account: ['account'], balance: ['balance'], notes: ['notes', 'note'] });
    if (ac.name < 0 || ac.owner < 0) return { error: 'no_columns', message: 'Accounts tab needs Account and Owner columns.' };
    if (bc.date < 0 || bc.account < 0 || bc.balance < 0) return { error: 'no_columns', message: 'Balances tab needs Month end, Account and Balance columns.' };

    // existing Accounts row? (name match is the Vault's own: case/punctuation-insensitive)
    var acctRow = 0, canonical = account, repair = false;
    for (var i = 1; i < av.length; i++) if (loose_(av[i][ac.name]) === loose_(account)) {
      acctRow = i + 1; canonical = String(av[i][ac.name]).trim();
      repair = String(av[i][ac.owner] == null ? '' : av[i][ac.owner]).trim() === '';   // half-written row from a failed earlier call
      break;
    }
    // existing Balances row for account + date?
    var balRow = 0, beforeBal = null, beforeNote = '';
    for (var j = 1; j < bv.length; j++) {
      if (loose_(bv[j][bc.account]) === loose_(canonical) && toKey_(bv[j][bc.date]) === asof) {
        balRow = j + 1; beforeBal = toNum_(bv[j][bc.balance]); beforeNote = bc.notes >= 0 ? String(bv[j][bc.notes] || '') : '';
      }   // last match wins, same as the Vault reader
    }
    var out = { account: canonical, balance: round2_(bal), asOf: asof, note: note, cid: cid, dry: dry,
                accountRow: acctRow || null, createAccount: !acctRow, repairAccount: repair, balancesRow: balRow || null,
                action: balRow ? 'update' : 'append', before: balRow ? { balance: beforeBal, note: beforeNote } : null };
    if (!acctRow || repair) out.newAccount = { account: canonical, bank: bank, type: type, owner: owner, purpose: purpose, active: 'Yes' };
    if (apiAdminSeenCid_(ss, 'balset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    if (balRow && beforeBal !== null && Math.abs(beforeBal - bal) < 0.005 && (!note || note === beforeNote.trim()) && acctRow && !repair) { out.duplicate = 'row'; return { ok: true, data: out }; }
    if (dry) return { ok: true, data: out };

    var journal = function (row, field, before, after) { apiSpendJournal_(ss, [new Date(), 'balset', row, field, before, after, '']); };
    var undo = [], vnotes = [];
    try {
      if (!acctRow || repair) {
        apiTabBackup_(ss, shA);
        var awidth = Math.max(ac.name, ac.bank, ac.type, ac.owner, ac.purpose, ac.active) + 1;
        var arow;
        if (repair) {
          arow = acctRow;
          var oldA = av[acctRow - 1].slice(0, awidth);
          while (oldA.length < awidth) oldA.push('');
          undo.push(function () { shA.getRange(arow, 1, 1, awidth).setValues([oldA]); });
        } else {
          var apos = apiAdminNextRow_(av, ac.name, awidth, false);
          apiAdminPrepRow_(shA, apos, awidth, null);
          arow = apos.row;
          undo.push(function () { if (apos.insert) shA.deleteRow(arow); else shA.getRange(arow, 1, 1, awidth).clearContent(); });
        }
        var cur = repair ? av[acctRow - 1] : [];
        var put = function (c, v) { if (c >= 0 && (!repair || String(cur[c] == null ? '' : cur[c]).trim() === '')) apiAdminSetCell_(shA, arow, c, v, true, vnotes); };
        put(ac.name, canonical); put(ac.bank, bank); put(ac.type, type); put(ac.owner, owner); put(ac.purpose, purpose); put(ac.active, 'Yes');
        out.accountRow = arow;
      }
      apiTabBackup_(ss, shB);
      if (balRow) {
        var oldB = bv[balRow - 1].slice(0, Math.max(bc.date, bc.account, bc.balance, bc.notes) + 1);
        undo.push(function () { shB.getRange(balRow, 1, 1, oldB.length).setValues([oldB]); });
        apiAdminSetCell_(shB, balRow, bc.balance, round2_(bal), false, vnotes);
        if (bc.notes >= 0 && note) apiAdminSetCell_(shB, balRow, bc.notes, note, true, vnotes);
        out.balancesRow = balRow;
      } else {
        var bwidth = Math.max(bc.date, bc.account, bc.balance, bc.notes) + 1;
        var bpos = apiAdminNextRow_(bv, bc.date, bwidth, true);
        apiAdminPrepRow_(shB, bpos, bwidth, null);
        undo.push(function () { if (bpos.insert) shB.deleteRow(bpos.row); else shB.getRange(bpos.row, 1, 1, bwidth).clearContent(); });
        var sample = bv[Math.max(1, bpos.lastDataRow - 1)] ? bv[Math.max(1, bpos.lastDataRow - 1)][bc.date] : '';
        apiAdminSetDate_(shB, bpos.row, bc.date, asof, sample, vnotes);
        apiAdminSetCell_(shB, bpos.row, bc.account, canonical, true, vnotes);
        apiAdminSetCell_(shB, bpos.row, bc.balance, round2_(bal), false, vnotes);
        if (shB.getRange(bpos.row, bc.balance + 1).getNumberFormat() === 'General') shB.getRange(bpos.row, bc.balance + 1).setNumberFormat('$#,##0.00');
        if (bc.notes >= 0) apiAdminSetCell_(shB, bpos.row, bc.notes, note, true, vnotes);
        out.balancesRow = bpos.row;
      }
      SpreadsheetApp.flush();
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      apiSpendJournal_(ss, [new Date(), 'balset', out.balancesRow || out.accountRow || '', 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows removed/restored') + ' (cid ' + cid + ')', '']);
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    if (vnotes.length) out.validation = vnotes;
    if (out.createAccount || out.repairAccount) journal(out.accountRow, 'Accounts: ' + (repair ? 'complete' : 'add'), '', canonical + ' | ' + bank + ' | ' + type + ' | ' + owner + ' | ' + purpose);
    journal(out.balancesRow, balRow ? 'Balances: update' : 'Balances: add', balRow ? beforeBal + ' | ' + beforeNote : '', asof + ' | ' + canonical + ' | ' + round2_(bal) + (note ? ' | ' + note : '') + (vnotes.length ? ' [' + vnotes.join('; ') + ']' : ''));
    apiSpendJournal_(ss, [new Date(), 'balset', out.balancesRow, 'done: ' + canonical, '', asof + ' | ' + round2_(bal), cid]);
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}


/**
 * action=acctadd  (v44; GET params or POST body) — append ONE account to the Accounts tab (and, when a balance is sent, its first Balances row)
 *   name      required (as it should appear in the Vault, e.g. "Chase Visa"), max 80; an account that is already listed is rejected (use balset for balances)
 *   entity    required: Household | TiwiK | KiwiT   (alias: owner / group). Sierra Consultants is never accepted; Investments is not an entity here (use balset).
 *   kind      bank (default) | card (credit card: the balance is the amount OWED, positive) | app (payment app such as Zelle / Venmo; counts like cash)
 *   balance   optional dollars (card: amount owed)   asof  optional yyyy-mm-dd (defaults to today when a balance is sent; an asof without a balance is rejected)
 *   note      optional, max 300 (Balances note)      bank, type, purpose  optional free text (no account numbers). type defaults to "Credit card" / "Payment app" for those kinds.
 *   cid       required when writing (idempotency key; the same cid again returns duplicate:'cid' and writes nothing)    dry=1 previews and writes nothing.
 * Adds a "Kind" column at the END of the Accounts tab when it is missing (header formatted like the last header cell, dropdown Bank | Credit card | Payment app).
 * Same safety as balset: values-only backup first, journal rows in "CC write log", all-or-nothing (a failure removes what this call wrote, incl. a new Kind column).
 */
function apiAcctAdd_(p) {
  p = p || {};
  var name = apiAdminClean_(p.name != null ? p.name : p.account, 80), note = apiAdminClean_(p.note != null ? p.note : p.notes, 300);
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var bank = apiAdminClean_(p.bank, 80), type = apiAdminClean_(p.type, 60), purpose = apiAdminClean_(p.purpose, 200);
  var entIn = apiAdminClean_(p.entity != null ? p.entity : (p.owner != null ? p.owner : p.group), 40), entity = '';
  ['Household', 'TiwiK', 'KiwiT'].forEach(function (o) { if (loose_(o) === loose_(entIn)) entity = o; });
  var kindIn = loose_(apiAdminClean_(p.kind, 30)), kind = '';
  if (!kindIn || kindIn === 'bank') kind = 'bank';
  else if (kindIn === 'card' || kindIn === 'creditcard') kind = 'card';
  else if (kindIn === 'app' || kindIn === 'paymentapp') kind = 'app';
  var hasBal = p.balance != null && String(p.balance).trim() !== '', bal = hasBal ? apiAdminAmount_(p.balance) : null;
  var hasAsof = (p.asof != null && String(p.asof).trim() !== '') || (p.asOf != null && String(p.asOf).trim() !== '') || (p.date != null && String(p.date).trim() !== '');
  var asof = hasAsof ? apiAdminDate_(p.asof || p.asOf || p.date) : (hasBal ? todayKey_() : '');
  if (!name) return { error: 'bad_value', message: 'name is required.' };
  if (apiAcctExcluded_(name) || apiAcctExcluded_(entIn)) return { error: 'excluded', message: 'That account is deliberately not kept in the Vault.' };
  if (!entity) return { error: 'bad_value', message: 'entity must be one of: Household | TiwiK | KiwiT' };
  if (!kind) return { error: 'bad_value', message: 'kind must be one of: bank | card | app' };
  if (hasBal && bal === null) return { error: 'bad_value', message: 'balance must be a number (dollars).' };
  if (hasAsof && !asof) return { error: 'bad_value', message: 'asof must be yyyy-mm-dd.' };
  if (hasAsof && !hasBal) return { error: 'bad_value', message: 'asof needs a balance.' };
  if (apiAdminHasAcctNo_(name + ' ' + bank + ' ' + type + ' ' + purpose + ' ' + note)) return { error: 'no_account_numbers', message: 'Do not send account numbers (not even the last 4).' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  if (!type && kind !== 'bank') type = API_ACCT_KINDS[kind];

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var shA = ss.getSheetByName(API_ACCT_TAB), shB = ss.getSheetByName(API_BAL_TAB);
    if (!shA) return { error: 'no_tab', message: 'Accounts tab not found.' };
    if (hasBal && !shB) return { error: 'no_tab', message: 'Balances tab not found.' };
    var av = shA.getDataRange().getValues(), bv = shB ? shB.getDataRange().getValues() : [];
    if (!av.length) return { error: 'no_columns', message: 'Accounts needs a header row.' };
    var ac = mapHeaders_(av[0], { name: ['account', 'account name', 'name'], bank: ['bank'], type: ['type'], owner: ['owner', 'group'], purpose: ['purpose'], active: ['active'], kind: ['kind', 'account kind'] });
    if (ac.name < 0 || ac.owner < 0) return { error: 'no_columns', message: 'Accounts tab needs Account and Owner columns.' };
    var bc = hasBal ? mapHeaders_(bv[0] || [], { date: ['month end', 'date', 'as of'], account: ['account'], balance: ['balance'], notes: ['notes', 'note'] }) : null;
    if (hasBal && (!bv.length || bc.date < 0 || bc.account < 0 || bc.balance < 0)) return { error: 'no_columns', message: 'Balances tab needs Month end, Account and Balance columns.' };
    var kindCol = ac.kind, newKindCol = kindCol < 0, kindLabel = API_ACCT_KINDS[kind];
    var out = { account: name, entity: entity, kind: kind, kindLabel: kindLabel, bank: bank, type: type, purpose: purpose, balance: hasBal ? round2_(bal) : null, asOf: hasBal ? asof : null,
                note: note, cid: cid, dry: dry, createKindColumn: newKindCol, accountRow: null, balancesRow: null, action: 'append' };
    if (apiAdminSeenCid_(ss, 'acctadd', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }   // a retry of a write that already happened: nothing to do (checked before the exists test)
    for (var i = 1; i < av.length; i++) if (loose_(av[i][ac.name]) === loose_(name)) return { error: 'exists', message: 'That account is already on the Accounts tab (row ' + (i + 1) + '). Use balset to add a balance.', row: i + 1 };
    if (dry) return { ok: true, data: out };

    var journal = function (row, field, before, after) { apiSpendJournal_(ss, [new Date(), 'acctadd', row, field, before, after, '']); };
    var undo = [], vnotes = [];
    try {
      apiTabBackup_(ss, shA);
      if (newKindCol) {
        var lastCol = Math.max(av[0].length, shA.getLastColumn());
        kindCol = lastCol;   // 0-based index of the new last column
        shA.getRange(1, lastCol).copyTo(shA.getRange(1, kindCol + 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);   // header style of the last header cell
        shA.getRange(1, kindCol + 1).setValue('Kind');
        undo.push(function () { shA.deleteColumn(kindCol + 1); });
        try {
          var rule = SpreadsheetApp.newDataValidation().requireValueInList([API_ACCT_KINDS.bank, API_ACCT_KINDS.card, API_ACCT_KINDS.app], true).setAllowInvalid(true)
            .setHelpText('Account kind: Bank | Credit card (balance = amount owed) | Payment app').build();
          shA.getRange(2, kindCol + 1, Math.max(shA.getMaxRows() - 1, 1), 1).setDataValidation(rule);
        } catch (e1) { console.error('CC acctadd kind validation: ' + e1); }
        journal(1, 'Accounts: Kind column', '', 'added at column ' + apiColLetter_(kindCol + 1));
      }
      var awidth = Math.max(ac.name, ac.bank, ac.type, ac.owner, ac.purpose, ac.active, kindCol) + 1;
      var apos = apiAdminNextRow_(av, ac.name, awidth, false);
      apiAdminPrepRow_(shA, apos, awidth, null);
      var arow = apos.row;
      undo.push(function () { if (apos.insert) shA.deleteRow(arow); else shA.getRange(arow, 1, 1, awidth).clearContent(); });
      var put = function (c, v) { if (c >= 0 && v !== '') apiAdminSetCell_(shA, arow, c, v, true, vnotes); };
      put(ac.name, name); put(ac.bank, bank); put(ac.type, type); put(ac.owner, entity); put(ac.purpose, purpose); put(ac.active, 'Yes'); put(kindCol, kindLabel);
      out.accountRow = arow;
      if (hasBal) {
        apiTabBackup_(ss, shB);
        var bwidth = Math.max(bc.date, bc.account, bc.balance, bc.notes) + 1;
        var bpos = apiAdminNextRow_(bv, bc.date, bwidth, true);
        apiAdminPrepRow_(shB, bpos, bwidth, null);
        undo.push(function () { if (bpos.insert) shB.deleteRow(bpos.row); else shB.getRange(bpos.row, 1, 1, bwidth).clearContent(); });
        var sample = bv[Math.max(1, bpos.lastDataRow - 1)] ? bv[Math.max(1, bpos.lastDataRow - 1)][bc.date] : '';
        apiAdminSetDate_(shB, bpos.row, bc.date, asof, sample, vnotes);
        apiAdminSetCell_(shB, bpos.row, bc.account, name, true, vnotes);
        apiAdminSetCell_(shB, bpos.row, bc.balance, round2_(bal), false, vnotes);
        if (shB.getRange(bpos.row, bc.balance + 1).getNumberFormat() === 'General') shB.getRange(bpos.row, bc.balance + 1).setNumberFormat('$#,##0.00');
        if (bc.notes >= 0) apiAdminSetCell_(shB, bpos.row, bc.notes, note, true, vnotes);
        out.balancesRow = bpos.row;
      }
      SpreadsheetApp.flush();
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      apiSpendJournal_(ss, [new Date(), 'acctadd', out.balancesRow || out.accountRow || '', 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows/column removed') + ' (cid ' + cid + ')', '']);
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    if (vnotes.length) out.validation = vnotes;
    journal(out.accountRow, 'Accounts: add', '', name + ' | ' + bank + ' | ' + type + ' | ' + entity + ' | ' + purpose + ' | ' + kindLabel);
    if (out.balancesRow) journal(out.balancesRow, 'Balances: add', '', asof + ' | ' + name + ' | ' + round2_(bal) + (note ? ' | ' + note : '') + (vnotes.length ? ' [' + vnotes.join('; ') + ']' : ''));
    apiSpendJournal_(ss, [new Date(), 'acctadd', out.accountRow, 'done: ' + name, '', kind + ' | ' + entity + (hasBal ? ' | ' + asof + ' | ' + round2_(bal) : ''), cid]);
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}


/* ======================================================================= */
/* Debt + Bills TABS (v30). Vault > Debt and Upcoming bills now read the    */
/* "Debts" and "Bills" tabs of the Daily Spend sheet (every row carries a   */
/* plain-English Description), not the Overview Doc.                        */
/*   Debts : one row per loan. Loan payments in Upcoming bills are          */
/*           generated from these rows (Due day / Next due override).       */
/*   Bills : one row per non-loan bill (insurance, tax, utility, other);    */
/*           Repeat = Monthly | Annual | One-time. Paid rows drop out.      */
/* No figures are stored in this script: the seed values come from the      */
/* Overview Doc at runtime (action debttabs), later edits are made in the   */
/* sheet or with debtset / billadd / billpaid.                              */
/* ======================================================================= */
var API_DEBT_TAB = 'Debts';
var API_BILLS_TAB = 'Bills';
var API_DEBT_HEADS = ['Name', 'Entity', 'Lender', 'Balance', 'Rate %', 'Rate note', 'Monthly payment', 'Payment status', 'Payment after reset', 'Reset from',
                      'Due day', 'Next due override', 'Maturity', 'As of', 'Status', 'Description', 'Notes'];
var API_BILLS_HEADS = ['Due date', 'Name', 'Entity', 'Amount', 'Kind', 'Repeat', 'Status of figure', 'Via escrow', 'Paid?', 'Paid date', 'Description', 'Notes'];
var API_DEBT_ENTITIES = ['Household', 'TiwiK', 'KiwiT'];
var API_DEBT_STATUSES = ['Verified', 'Derived', 'Estimate'];
var API_BILL_KINDS = [{ label: 'Loan payment', kind: 'loan' }, { label: 'Insurance', kind: 'insurance' }, { label: 'Property tax', kind: 'tax' },
                      { label: 'Utility', kind: 'utility' }, { label: 'Other', kind: 'other' }];
var API_BILL_REPEATS = ['Monthly', 'Annual', 'One-time'];
var API_BILL_OVERDUE_DAYS = 60;      // an unpaid recurring bill this far past due is rolled forward instead of shown as overdue

/* ---- pure helpers (no Apps Script services: testable in Node) ---- */
function apiDebtMoney_(n) {
  if (n == null || isNaN(n)) return '';
  var neg = n < 0, s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '$' + s;
}
function apiDebtSlug_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function apiDebtUsDate_(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) + '/' + p[0] : String(iso || ''); }
function apiDebtStatusUp_(v) {
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'VERIFIED' || s === 'DERIVED' ? s : 'ESTIMATE';
}
function apiDebtStatusLabel_(up) { return up === 'VERIFIED' ? 'Verified' : up === 'DERIVED' ? 'Derived' : 'Estimate'; }
function apiDebtEntity_(v) {
  var t = String(v == null ? '' : v).trim(), hit = '';
  API_DEBT_ENTITIES.forEach(function (e) { if (loose_(e) === loose_(t)) hit = e; });
  return hit || t;
}
function apiBillKind_(v) {
  var t = loose_(v), hit = null;
  API_BILL_KINDS.forEach(function (k) { if (loose_(k.label) === t || k.kind === t) hit = k; });
  if (!hit && /tax/.test(t)) hit = API_BILL_KINDS[2];
  if (!hit && /insur/.test(t)) hit = API_BILL_KINDS[1];
  if (!hit && /loan|mortgage/.test(t)) hit = API_BILL_KINDS[0];
  return hit || { label: String(v || '').trim() || 'Other', kind: 'other' };
}
function apiBillRepeat_(v) {
  var t = loose_(v);
  if (/^month/.test(t)) return 'monthly';
  if (/^(annual|year)/.test(t)) return 'annual';
  return 'once';
}
function apiBillRepeatLabel_(r) { return r === 'monthly' ? 'Monthly' : r === 'annual' ? 'Annual' : 'One-time'; }
/** iso + n months, keeping the original day of month (clamped to the month length). */
function apiBillAddMonths_(iso, n) {
  var p = String(iso).split('-'), tot = (+p[0]) * 12 + (+p[1] - 1) + n;
  return apiDebtOcc_(Math.floor(tot / 12), tot % 12 + 1, +p[2]);
}
/**
 * Occurrences of one Bills row that matter between `today` and `end` (ISO).
 *  - One-time: its date (overdue when past, whatever the age) unless Paid.
 *  - Monthly / Annual: stepped from the Due date by the repeat. When Paid is Yes the first occurrence (the one on the Due date) is
 *    already paid and is skipped. An unpaid FIRST open occurrence in the past is shown as overdue for up to `overdueDays` days;
 *    anything older is rolled forward silently. Returns [{ date, overdue }].
 */
function apiBillOccurrences_(due, repeat, paid, today, end, overdueDays) {
  var out = [];
  if (!due) return out;
  var step = repeat === 'monthly' ? 1 : repeat === 'annual' ? 12 : 0;
  if (!step) {
    if (paid) return out;
    if (due < today) out.push({ date: due, overdue: true });
    else if (due <= end) out.push({ date: due, overdue: false });
    return out;
  }
  var firstOpen = true;
  for (var k = 0; k < 700; k++) {
    var d = apiBillAddMonths_(due, k * step);
    if (k === 0 && paid) continue;
    if (d > end) break;
    if (d >= today) out.push({ date: d, overdue: false });
    else if (firstOpen && apiDebtDays_(d, today) <= overdueDays) out.push({ date: d, overdue: true });
    firstOpen = false;
  }
  return out;
}
/** Due dates of a loan inside [today, end]: the Next due override first (when it is today or later), then every `day` of the month after it. */
function apiDebtLoanDates_(today, end, day, override, maturityIso) {
  var out = [], start = override && override >= today ? override : '';
  if (start && start <= end && (!maturityIso || start <= maturityIso)) out.push(start);
  if (day) out = out.concat(apiDebtSchedule_(today, end, day, start, maturityIso));
  return out;
}
function apiDebtLoanNext_(today, end, day, override, maturityIso) {
  var w = apiDebtLoanDates_(today, end, day, override, maturityIso);
  if (w.length) return w[0];
  var far = apiDebtLoanDates_(today, apiDebtAddDays_(today, 800), day, override, maturityIso);
  return far[0] || '';
}
function apiDebtNeedFor_(ref, what, name, why) { return { ref: ref, need: 'Confirm ' + what + ' for ' + name, why: why || '' }; }

/**
 * Pure model builder for the sheet-driven Vault Debt / Upcoming bills.
 *  debts = parsed Debts rows (apiDebtReadDebts_), bills = parsed Bills rows (apiDebtReadBills_), today = 'yyyy-MM-dd',
 *  tabs  = { debts: {gid, url}, bills: {gid, url} }.
 * Returns the SAME shape the front end has always consumed (apiDebtBuild_), plus source:'sheet', tabs, per-row description / rowNum,
 * and rows { debts[], bills[] } (every row on the two tabs, for the drill-down).
 */
function apiDebtSheetBuild_(debts, bills, today, tabs) {
  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var end = apiDebtAddDays_(today, API_DEBT_WINDOW_DAYS);
  var loans = [], out = [], undated = [], missing = [], needs = [], seenKey = {};
  var fld = function (ref, label, value, num, status) { return { ref: ref, label: label, value: value, num: num, status: status, source: 'Debts tab', url: '' }; };

  debts.forEach(function (d) {
    if (!d.name || apiAcctExcluded_(d.name + ' ' + d.entity)) return;
    if (d.balance == null) { missing.push(d.name); return; }
    var key = apiDebtSlug_(d.name) || ('row' + d.rowNum); if (seenKey[key]) key += '-' + d.rowNum; seenKey[key] = 1;
    var day = d.dueDay || 0, dayFrom = day ? 'Due day' : '';
    if (!day && d.nextDue) { day = +d.nextDue.split('-')[2]; dayFrom = 'Next due override'; }
    if (!day && d.maturityIso) { day = +d.maturityIso.split('-')[2]; dayFrom = 'Maturity'; }
    var st = apiDebtStatusUp_(d.status), pst = d.payStatus ? apiDebtStatusUp_(d.payStatus) : st;
    var reset = d.payAfter != null && d.payAfterFrom && d.payAfterFrom <= today;       // the post-reset payment is already in force
    var cur = reset ? d.payAfter : d.payment;
    var override = d.nextDue && d.nextDue >= today ? d.nextDue : '';
    var sched = apiDebtLoanDates_(today, end, day, override, d.maturityIso);
    var next = apiDebtLoanNext_(today, end, day, override, d.maturityIso);
    var payFor = function (iso) {
      if (d.payAfter != null && d.payAfterFrom && iso >= d.payAfterFrom) return { amount: d.payAfter, note: 'Payment after the reset.' };
      return { amount: d.payment, note: '' };
    };
    var paidThrough = '';
    if (override && day) {
      var op = override.split('-'), pm = +op[1] - 1, py = +op[0]; if (pm < 1) { pm = 12; py--; }
      var prev = apiDebtOcc_(py, pm, day); if (prev < override) paidThrough = prev;
    }
    var first = next ? payFor(next) : { amount: cur, note: '' };
    var ref = 'debts:' + d.rowNum;
    var balNote = [d.asOf ? 'Balance as of ' + apiDebtUsDate_(d.asOf) + '.' : '', st !== 'VERIFIED' ? d.notes : ''].filter(Boolean).join(' ');
    var loan = {
      key: key, name: d.name, entity: d.entity, lender: d.lender, balance: d.balance, rate: d.rate, rateText: d.rate != null ? d.rate.toFixed(3) + '%' : '',
      payment: cur, nextDue: next, daysUntil: next ? apiDebtDays_(today, next) : null, dueDay: day, dueDayFrom: dayFrom,
      nextDueAmount: first.amount, nextDueStatus: 'DERIVED', paidThrough: paidThrough,
      paymentNext: d.payAfter != null && !reset ? { amount: d.payAfter, from: d.payAfterFrom, status: pst } : null,
      maturity: d.maturityText, status: st,
      fields: { balance: fld(ref + ':balance', 'Balance', apiDebtMoney_(d.balance), d.balance, st),
                rate: d.rate != null ? fld(ref + ':rate', 'Rate', d.rate.toFixed(3) + '%', d.rate, st) : null,
                payment: cur != null ? fld(ref + ':payment', 'Monthly payment', apiDebtMoney_(cur), cur, pst) : null,
                paymentNext: d.payAfter != null && !reset ? fld(ref + ':payment2', 'Payment after reset', apiDebtMoney_(d.payAfter), d.payAfter, pst) : null,
                maturity: d.maturityText ? fld(ref + ':maturity', 'Maturity', d.maturityText, null, st) : null },
      balanceNote: balNote, rateNote: d.rateNote, srcLinks: [],
      description: d.description, notes: d.notes, asOf: d.asOf, rowNum: d.rowNum, source: 'sheet'
    };
    loans.push(loan);
    if (st === 'ESTIMATE') needs.push(apiDebtNeedFor_(ref + ':balance ' + ref + ':rate ' + ref + ':payment', 'the balance and payment', d.name, d.notes || d.description));
    sched.forEach(function (iso) {
      var pf = payFor(iso);
      out.push({ id: key + ':' + iso, date: iso, daysUntil: apiDebtDays_(today, iso), kind: 'loan', kindLabel: 'Loan payment', name: d.name, entity: d.entity,
        amount: pf.amount, status: pst, viaEscrow: false, note: pf.note, ref: ref, srcLinks: [], description: d.description, rowNum: d.rowNum, tab: 'debts', repeat: 'Monthly', overdue: false });
    });
  });

  var rowsBills = [];
  bills.forEach(function (b) {
    if (!b.name || apiAcctExcluded_(b.name + ' ' + b.entity)) return;
    var kd = apiBillKind_(b.kind), rep = apiBillRepeat_(b.repeat), st = apiDebtStatusUp_(b.status), ref = 'bills:' + b.rowNum;
    var occ = apiBillOccurrences_(b.due, rep, b.paid, today, end, API_BILL_OVERDUE_DAYS);
    var far = apiBillOccurrences_(b.due, rep, b.paid, today, apiDebtAddDays_(today, 800), API_BILL_OVERDUE_DAYS);
    var row = { rowNum: b.rowNum, name: b.name, entity: b.entity, kind: kd.kind, kindLabel: kd.label, repeat: apiBillRepeatLabel_(rep), amount: b.amount, status: st,
                viaEscrow: !!b.escrow, paid: !!b.paid, paidDate: b.paidDate, due: b.due, nextDue: far.length ? far[0].date : '', inWindow: occ.length > 0,
                description: b.description, notes: b.notes };
    rowsBills.push(row);
    if (b.paid && rep === 'once') return;
    if (!b.due) {
      undated.push({ ref: ref, name: b.name, entity: b.entity, kind: kd.kind, kindLabel: kd.label, amount: b.amount, status: st, repeat: row.repeat, description: b.description, notes: b.notes, rowNum: b.rowNum });
      if (st === 'ESTIMATE') needs.push(apiDebtNeedFor_(ref, 'the amount and due date', b.name, b.notes || b.description));
      return;
    }
    occ.forEach(function (o) {
      out.push({ id: ref + ':' + o.date, date: o.date, daysUntil: apiDebtDays_(today, o.date), kind: kd.kind, kindLabel: kd.label, name: b.name, entity: b.entity,
        amount: b.amount, status: st, viaEscrow: !!b.escrow, note: o.overdue ? 'Overdue: not marked paid yet.' : (b.escrow ? 'Paid through the mortgage escrow (not an extra payment).' : ''),
        ref: ref, srcLinks: [], description: b.description, rowNum: b.rowNum, tab: 'bills', repeat: row.repeat, overdue: o.overdue });
      if (st === 'ESTIMATE' && !needs.some(function (n) { return n.ref === ref; })) needs.push(apiDebtNeedFor_(ref, 'the amount', b.name, b.notes || b.description));
    });
  });

  var kindRank = { loan: 0, insurance: 1, tax: 2, utility: 3, other: 4 };
  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : ((kindRank[a.kind] || 0) - (kindRank[b.kind] || 0)) || (a.name < b.name ? -1 : 1); });

  var totalDebt = 0, totalMonthly = 0;
  loans.forEach(function (l) { totalDebt += l.balance; totalMonthly += l.payment || 0; });
  var afterFrom = '';
  loans.forEach(function (l) { if (l.paymentNext && l.paymentNext.from && (!afterFrom || l.paymentNext.from < afterFrom)) afterFrom = l.paymentNext.from; });
  var monthlyAfter = null;
  if (afterFrom) {
    var t2 = 0;
    loans.forEach(function (l) { t2 += (l.paymentNext && l.paymentNext.from && l.paymentNext.from <= afterFrom && l.paymentNext.amount != null) ? l.paymentNext.amount : (l.payment || 0); });
    monthlyAfter = { from: afterFrom, amount: r2(t2), status: apiDebtWorst_(loans.map(function (l) { return l.status; })) };
  }
  var counted = out.filter(function (b) { return !b.viaEscrow && b.amount != null; });
  var billTotal = 0; counted.forEach(function (b) { billTotal += b.amount; });
  var byKind = {}; counted.forEach(function (b) { byKind[b.kind] = r2((byKind[b.kind] || 0) + b.amount); });
  var rowsDebts = debts.filter(function (d) { return d.name && !apiAcctExcluded_(d.name + ' ' + d.entity); }).map(function (d) {
    return { rowNum: d.rowNum, name: d.name, entity: d.entity, lender: d.lender, balance: d.balance, rate: d.rate, rateNote: d.rateNote, payment: d.payment, payAfter: d.payAfter,
             payAfterFrom: d.payAfterFrom, dueDay: d.dueDay, nextDue: d.nextDue, maturity: d.maturityText, asOf: d.asOf, status: apiDebtStatusUp_(d.status),
             paymentStatus: d.payStatus ? apiDebtStatusUp_(d.payStatus) : apiDebtStatusUp_(d.status), description: d.description, notes: d.notes };
  });
  return {
    source: 'sheet', today: today, windowDays: API_DEBT_WINDOW_DAYS, windowEnd: end,
    loans: loans,
    totalDebt: r2(totalDebt), totalDebtStatus: apiDebtWorst_(loans.map(function (l) { return l.status; })),
    totalMonthly: r2(totalMonthly), totalMonthlyStatus: apiDebtWorst_(loans.map(function (l) { return l.fields.payment ? l.fields.payment.status : 'ESTIMATE'; })),
    monthlyAfter: monthlyAfter,
    docTotalDebt: null, matchesDoc: null,
    bills: out, billsTotal: r2(billTotal), billsCount: out.length, billsByKind: byKind,
    billsStatus: apiDebtWorst_(counted.map(function (b) { return b.status; })),
    overdueCount: out.filter(function (b) { return b.overdue; }).length,
    undated: undated, missing: missing, needs: needs, estimateRefs: needs.map(function (n) { return n.ref; }),
    docUrl: '', docTitle: '', tabs: tabs, rows: { debts: rowsDebts, bills: rowsBills }
  };
}

/* ---- readers (Apps Script) ---- */
function apiDebtTabUrl_(sh) { return 'https://docs.google.com/spreadsheets/d/' + CONFIG.SPEND.SHEET_ID + '/edit#gid=' + sh.getSheetId(); }
function apiDebtColsD_(head) {
  return mapHeaders_(head, { name: ['name'], entity: ['entity'], lender: ['lender'], balance: ['balance'], rate: ['rate %', 'rate'], rateNote: ['rate note'],
    payment: ['monthly payment', 'payment'], payStatus: ['payment status'], payAfter: ['payment after reset'], payAfterFrom: ['reset from', 'payment after reset from'],
    dueDay: ['due day'], nextDue: ['next due override', 'next due'], maturity: ['maturity'], asOf: ['as of'], status: ['status'], description: ['description'], notes: ['notes'] });
}
function apiDebtColsB_(head) {
  return mapHeaders_(head, { due: ['due date', 'due'], name: ['name'], entity: ['entity'], amount: ['amount'], kind: ['kind'], repeat: ['repeat'],
    status: ['status of figure', 'status'], escrow: ['via escrow'], paid: ['paid?', 'paid'], paidDate: ['paid date'], description: ['description'], notes: ['notes'] });
}
function apiDebtCell_(row, c) { return c >= 0 && c < row.length ? row[c] : ''; }
function apiDebtStr_(row, c) { return String(apiDebtCell_(row, c) == null ? '' : apiDebtCell_(row, c)).trim(); }
function apiDebtDateCell_(v) { return v instanceof Date || String(v == null ? '' : v).trim() ? toKey_(v) : ''; }
function apiDebtYes_(v) { return /^(y|yes|true|1|paid|x)$/i.test(String(v == null ? '' : v).trim()); }
/** Parse the Debts tab. Returns { cols, rows[] } with one object per data row (rowNum = sheet row, 1-based). */
function apiDebtReadDebts_(sh) {
  var rng = sh.getDataRange(), v = rng.getValues(), disp = rng.getDisplayValues();
  if (!v.length) return { cols: { name: -1 }, rows: [] };
  var c = apiDebtColsD_(v[0]), rows = [];
  for (var r = 1; r < v.length; r++) {
    var x = v[r], dsp = disp[r] || [], name = apiDebtStr_(x, c.name);
    if (!name) continue;
    var rateDisp = String(apiDebtCell_(dsp, c.rate) || ''), rate = /%/.test(rateDisp) ? parseFloat(rateDisp.replace(/[^\d.\-]/g, '')) : toNum_(apiDebtCell_(x, c.rate));
    var dd = apiDebtCell_(x, c.dueDay), dueDay = dd instanceof Date ? dd.getDate() : toNum_(dd);
    dueDay = dueDay >= 1 && dueDay <= 31 ? Math.floor(dueDay) : 0;
    var mv = apiDebtCell_(x, c.maturity), matIso = mv instanceof Date ? toKey_(mv) : (apiDebtDates_(String(mv))[0] || '');
    var matText = mv instanceof Date ? apiDebtUsDate_(matIso) : String(mv == null ? '' : mv).trim();
    rows.push({ rowNum: r + 1, name: name, entity: apiDebtEntity_(apiDebtStr_(x, c.entity)), lender: apiDebtStr_(x, c.lender),
      balance: toNum_(apiDebtCell_(x, c.balance)), rate: rate === undefined || rate === null || isNaN(rate) ? null : rate, rateNote: apiDebtStr_(x, c.rateNote),
      payment: toNum_(apiDebtCell_(x, c.payment)), payStatus: apiDebtStr_(x, c.payStatus), payAfter: toNum_(apiDebtCell_(x, c.payAfter)),
      payAfterFrom: apiDebtDateCell_(apiDebtCell_(x, c.payAfterFrom)), dueDay: dueDay, nextDue: apiDebtDateCell_(apiDebtCell_(x, c.nextDue)),
      maturityText: matText, maturityIso: matIso, asOf: apiDebtDateCell_(apiDebtCell_(x, c.asOf)), status: apiDebtStr_(x, c.status),
      description: apiDebtStr_(x, c.description), notes: apiDebtStr_(x, c.notes) });
  }
  return { cols: c, rows: rows };
}
function apiDebtReadBills_(sh) {
  var rng = sh.getDataRange(), v = rng.getValues();
  if (!v.length) return { cols: { name: -1 }, rows: [] };
  var c = apiDebtColsB_(v[0]), rows = [];
  for (var r = 1; r < v.length; r++) {
    var x = v[r], name = apiDebtStr_(x, c.name);
    if (!name) continue;
    rows.push({ rowNum: r + 1, due: apiDebtDateCell_(apiDebtCell_(x, c.due)), name: name, entity: apiDebtEntity_(apiDebtStr_(x, c.entity)),
      amount: toNum_(apiDebtCell_(x, c.amount)), kind: apiDebtStr_(x, c.kind), repeat: apiDebtStr_(x, c.repeat), status: apiDebtStr_(x, c.status),
      escrow: apiDebtYes_(apiDebtCell_(x, c.escrow)), paid: apiDebtYes_(apiDebtCell_(x, c.paid)), paidDate: apiDebtDateCell_(apiDebtCell_(x, c.paidDate)),
      description: apiDebtStr_(x, c.description), notes: apiDebtStr_(x, c.notes) });
  }
  return { cols: c, rows: rows };
}

/* ---- seed + admin actions (v30): debttabs, debtset, billadd, billpaid ---- */
// Static plain-English descriptions for the three known loans (no figures here; amounts come from the sheet).
var API_DEBT_SEED_INFO = {
  tiwik:   { lender: 'Alliance', desc: 'Equipment loan from Alliance (Huebsch equipment), borrowed by TiwiK. The rate is fixed for now, then floats with Prime, and the monthly payment goes up at the reset (see Rate note and Payment after reset). Paid monthly on the due day.' },
  wetumka: { lender: 'Rocket Mortgage', desc: 'Mortgage on the Wetumka home with Rocket Mortgage (Household). The monthly payment includes escrow. Paid monthly on the due day.' },
  monoway: { lender: 'Bank of Stockton', desc: 'Mono Way property loan with Bank of Stockton, borrowed by KiwiT. Paid monthly around the due day. The balance is calculated until a lender statement is on file.' }
};
// v31: the seed no longer creates property-tax rows (Mono Way tax is paid, Stewart Street is tenant-paid NNN, Wetumka tax is in the mortgage escrow).
// A real tax bill is added by hand with billadd (kind 'Property tax'); a stray row is removed with billdel.
function apiDebtLoanKeyOf_(l) { return String(l.key || ''); }

/** Pure: turn the legacy Doc model (apiDebtBuild_) + the Doc ledger into rows for the two new tabs. */
function apiDebtSeedRows_(m, ledger, today) {
  var debts = [], bills = [], skipped = [];
  (m.loans || []).forEach(function (l) {
    var info = API_DEBT_SEED_INFO[apiDebtLoanKeyOf_(l)] || { lender: '', desc: l.name + ' (' + l.entity + '). Paid monthly.' };
    var asOf = (apiDebtDates_(l.balanceNote)[0]) || '';
    var mt = String(l.maturity || ''), mIso = apiDebtDates_(mt)[0] || '';
    var st = apiDebtStatusLabel_(apiDebtStatusUp_(l.status)), pst = l.fields && l.fields.payment ? apiDebtStatusLabel_(apiDebtStatusUp_(l.fields.payment.status)) : st;
    debts.push({ name: l.name, entity: l.entity, lender: info.lender, balance: l.balance, rate: l.rate, rateNote: l.rateNote || '', payment: l.payment, payStatus: pst,
      payAfter: l.paymentNext ? l.paymentNext.amount : null, payAfterFrom: l.paymentNext ? l.paymentNext.from : '', dueDay: l.dueDay || 0,
      nextDue: l.paidThrough && l.nextDue ? l.nextDue : '', maturityText: mIso ? mIso : mt, maturityIso: mIso, asOf: asOf, status: st,
      description: info.desc, notes: l.status !== 'VERIFIED' && l.balanceNote ? l.balanceNote.replace(/[.\s]+$/, '') + '.' : '' });
  });
  var idx = {}; (ledger || []).forEach(function (r) { idx[r.ref] = r; });
  var entOf = function (ref) { var k = String(ref).replace(/^[a-z]+\./, ''); return /^tiwik/.test(k) ? 'TiwiK' : /^kiwit/.test(k) ? 'KiwiT' : 'Household'; };
  var cleanName = function (f) { return String(f || '').replace(/\s*[\(=].*$/, '').replace(/\s+/g, ' ').trim(); };
  (ledger || []).forEach(function (r) {
    if (!/^ins\./.test(r.ref)) return;
    if (/^ins\.sierra/i.test(r.ref)) return;                       // Sierra Consultants is never in the Vault
    var ds = apiDebtDates_(r.figure);
    if (!ds.length) { skipped.push(r.ref + ': no date in the Doc row'); return; }
    var renewalOffer = /renewal/i.test(r.figure), when = renewalOffer ? ds[0] : ds[ds.length - 1];
    if (when < today) { skipped.push(r.ref + ': term already ended'); return; }
    var esc = /escrow/i.test(r.figure), ent = entOf(r.ref), term = ds.length > 1 ? apiDebtDays_(ds[0], ds[ds.length - 1]) : 365;
    bills.push({ due: when, name: cleanName(r.figure), entity: ent, amount: r.num, kind: 'Insurance', repeat: term >= 300 ? 'Annual' : 'One-time', status: apiDebtStatusLabel_(apiDebtStatusUp_(r.status)),
      escrow: esc, paid: false, paidDate: '',
      description: esc ? 'Insurance premium for ' + ent + ' that is paid through the mortgage escrow, so it is not an extra payment.'
        : 'Insurance premium for ' + ent + (renewalOffer ? '. Due at the start of the new term; paying it keeps the cover in force.' : '. Due when the current term ends; paying it keeps the cover in force.'),
      notes: 'As listed: ' + r.figure });
  });
  bills.sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : (a.name < b.name ? -1 : 1); });
  return { debts: debts, bills: bills, skipped: skipped };
}

/* ---- cell values + writers ---- */
var API_DEBT_FIELDS = {   // field -> { head, type }
  name: ['Name', 'text'], entity: ['Entity', 'text'], lender: ['Lender', 'text'], balance: ['Balance', 'money'], rate: ['Rate %', 'rate'], rateNote: ['Rate note', 'text'],
  payment: ['Monthly payment', 'money'], payStatus: ['Payment status', 'text'], payAfter: ['Payment after reset', 'money'], payAfterFrom: ['Reset from', 'date'],
  dueDay: ['Due day', 'int'], nextDue: ['Next due override', 'date'], maturityText: ['Maturity', 'datetext'], asOf: ['As of', 'date'], status: ['Status', 'text'],
  description: ['Description', 'text'], notes: ['Notes', 'text']
};
var API_BILL_FIELDS = {
  due: ['Due date', 'date'], name: ['Name', 'text'], entity: ['Entity', 'text'], amount: ['Amount', 'money'], kind: ['Kind', 'text'], repeat: ['Repeat', 'text'],
  status: ['Status of figure', 'text'], escrow: ['Via escrow', 'yes'], paid: ['Paid?', 'yes'], paidDate: ['Paid date', 'date'], description: ['Description', 'text'], notes: ['Notes', 'text']
};
var API_DEBT_FMT = { money: '$#,##0.00', rate: '0.000', int: '0', date: 'm/d/yyyy', datetext: 'm/d/yyyy', text: '@' };
/** Value as it goes into a cell. */
function apiDebtCellValue_(type, v) {
  if (v === null || v === undefined || v === '') return '';
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? keyToDate_(String(v)) : '';
  if (type === 'datetext') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? keyToDate_(String(v)) : String(v);
  if (type === 'money' || type === 'rate' || type === 'int') return Number(v);
  if (type === 'yes') return v ? 'Yes' : '';
  return String(v);
}
/** Comparable string for before/after. */
function apiDebtCmp_(type, v) {
  if (v === null || v === undefined || v === '' || v === false) return '';
  if (type === 'money' || type === 'rate' || type === 'int') return String(Math.round(Number(v) * 1000) / 1000);
  if (type === 'yes') return v ? 'Yes' : '';
  return String(v);
}
function apiDebtRowArr_(fields, cols, obj, width) {
  var arr = []; for (var i = 0; i < width; i++) arr.push('');
  Object.keys(fields).forEach(function (f) { var c = cols[f]; if (c >= 0 && c < width && obj[f] !== undefined) arr[c] = apiDebtCellValue_(fields[f][1], obj[f]); });
  return arr;
}
function apiDebtFmtCell_(sh, row, col0, type) {
  var f = API_DEBT_FMT[type]; if (f) sh.getRange(row, col0 + 1).setNumberFormat(f);
}
/** Write one field of an existing row (text goes through the validation-aware writer; numbers / dates keep their format). */
function apiDebtPut_(sh, row, col0, type, v, notes) {
  var val = apiDebtCellValue_(type, v);
  if (type === 'text') return apiAdminSetCell_(sh, row, col0, val, true, notes);
  var cell = sh.getRange(row, col0 + 1);
  cell.setNumberFormat(API_DEBT_FMT[type] || 'General');
  if (type === 'yes') cell.setNumberFormat('@');
  cell.setValue(val);
}
function apiDebtSheetSpec_(which) {
  if (which === 'debts') return { fmt: { Name: '@', Entity: '@', Lender: '@', Balance: '$#,##0.00', 'Rate %': '0.000', 'Rate note': '@', 'Monthly payment': '$#,##0.00', 'Payment status': '@',
      'Payment after reset': '$#,##0.00', 'Reset from': 'm/d/yyyy', 'Due day': '0', 'Next due override': 'm/d/yyyy', Maturity: 'm/d/yyyy', 'As of': 'm/d/yyyy', Status: '@', Description: '@', Notes: '@' },
    width: { Name: 230, Entity: 80, Lender: 130, Balance: 110, 'Rate %': 70, 'Rate note': 240, 'Monthly payment': 110, 'Payment status': 90, 'Payment after reset': 110, 'Reset from': 90,
      'Due day': 60, 'Next due override': 110, Maturity: 90, 'As of': 90, Status: 80, Description: 380, Notes: 280 },
    list: { Entity: API_DEBT_ENTITIES, Status: API_DEBT_STATUSES, 'Payment status': API_DEBT_STATUSES }, wrap: { 'Rate note': 1, Description: 1, Notes: 1 } };
  return { fmt: { 'Due date': 'm/d/yyyy', Name: '@', Entity: '@', Amount: '$#,##0.00', Kind: '@', Repeat: '@', 'Status of figure': '@', 'Via escrow': '@', 'Paid?': '@', 'Paid date': 'm/d/yyyy', Description: '@', Notes: '@' },
    width: { 'Due date': 90, Name: 230, Entity: 80, Amount: 100, Kind: 110, Repeat: 90, 'Status of figure': 100, 'Via escrow': 80, 'Paid?': 60, 'Paid date': 90, Description: 380, Notes: 280 },
    list: { Entity: API_DEBT_ENTITIES, Kind: API_BILL_KINDS.map(function (k) { return k.label; }), Repeat: API_BILL_REPEATS, 'Status of figure': API_DEBT_STATUSES, 'Via escrow': ['Yes'], 'Paid?': ['Yes'] },
    wrap: { Description: 1, Notes: 1 } };
}
function apiDebtMakeHeader_(sh, heads, spec) {
  sh.getRange(1, 1, 1, heads.length).setValues([heads]).setFontWeight('bold');
  sh.setFrozenRows(1);
  heads.forEach(function (h, i) {
    var col = sh.getRange(2, i + 1, 499, 1);
    if (spec.fmt[h]) col.setNumberFormat(spec.fmt[h]);
    if (spec.wrap[h]) col.setWrap(true);
    if (spec.width[h]) sh.setColumnWidth(i + 1, spec.width[h]);
    if (spec.list[h]) col.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(spec.list[h], true).setAllowInvalid(false).build());
  });
}
function apiDebtJournal_(ss, action, row, field, before, after, cid) { apiSpendJournal_(ss, [new Date(), action, row, field, before, after, cid || '']); }
function apiDebtLock_() {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); return lock; } catch (e) { return null; }
}
function apiDebtFind_(rows, name) {
  var n = loose_(name), hit = rows.filter(function (r) { return loose_(r.name) === n; });
  if (!hit.length && n.length >= 4) hit = rows.filter(function (r) { return loose_(r.name).indexOf(n) >= 0; });
  return hit;
}
function apiDebtTabsInfo_(ss) {
  var d = ss.getSheetByName(API_DEBT_TAB), b = ss.getSheetByName(API_BILLS_TAB);
  return { debts: d ? { gid: d.getSheetId(), url: apiDebtTabUrl_(d) } : null, bills: b ? { gid: b.getSheetId(), url: apiDebtTabUrl_(b) } : null };
}

/**
 * action=debttabs  (admin; GET params or POST body)   dry=1 previews; cid required when writing; seed=0 creates empty tabs only.
 * Creates the "Debts" and "Bills" tabs of the Daily Spend sheet (headers, formats, dropdowns) and seeds them from the CURRENT Overview Doc
 * values (the same numbers vaultdebt shows today). Idempotent: a tab that already has data rows is never touched or reseeded.
 * All-or-nothing: if a write fails, tabs created by this call are deleted again and seeded ranges cleared (error write_failed).
 */
function apiDebtTabs_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), seed = !(p.seed != null && /^(0|false|no)$/i.test(String(p.seed)));
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = apiDebtLock_(); if (!lock) return { error: 'busy', message: 'Another update is running. Try again.' };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), today = todayKey_();
    var shD = ss.getSheetByName(API_DEBT_TAB), shB = ss.getSheetByName(API_BILLS_TAB);
    var haveD = !!(shD && shD.getLastRow() >= 2), haveB = !!(shB && shB.getLastRow() >= 2);
    var out = { dry: dry, cid: cid, debtsTab: shD ? (haveD ? 'has data (left as is)' : 'exists, empty') : 'will create', billsTab: shB ? (haveB ? 'has data (left as is)' : 'exists, empty') : 'will create' };
    if (apiAdminSeenCid_(ss, 'debttabs', cid)) { out.duplicate = 'cid'; out.tabs = apiDebtTabsInfo_(ss); return { ok: true, data: out }; }
    if (haveD && haveB) { out.duplicate = 'tabs already seeded'; out.tabs = apiDebtTabsInfo_(ss); return { ok: true, data: out }; }
    var plan = { debts: [], bills: [], skipped: [] };
    if (seed) {
      var L;
      try { L = apiDebtDocLoad_(); } catch (e) { return { error: 'doc_failed', message: 'Could not read the Overview Doc to seed from: ' + String(e && e.message || e) }; }
      var m = apiDebtBuild_(L.data.ledger || [], L.data.srcLinks || [], L.data.needs || [], today, '', L.doc.getName(), L.docTotal);
      if (!m.loans.length) return { error: 'no_seed', message: 'The Overview Doc has no loan rows to seed from. Use seed=0 for empty tabs.' };
      plan = apiDebtSeedRows_(m, L.data.ledger || [], today);
    }
    out.seed = seed;
    out.plan = { debts: haveD ? [] : plan.debts.map(function (d) { return { name: d.name, entity: d.entity, balance: d.balance, payment: d.payment, dueDay: d.dueDay, status: d.status }; }),
                 bills: haveB ? [] : plan.bills.map(function (b) { return { due: b.due || '(no date)', name: b.name, entity: b.entity, amount: b.amount, kind: b.kind, repeat: b.repeat, status: b.status }; }),
                 skipped: plan.skipped };
    if (dry) return { ok: true, data: out };

    var undo = [], done = [];
    try {
      var build = function (sh, name, heads, spec, fields, rows, flag) {
        var created = false;
        if (!sh) { sh = ss.insertSheet(name); created = true; undo.push(function () { ss.deleteSheet(sh); }); }
        var lastRow = sh.getLastRow();
        if (lastRow === 0) {
          apiDebtMakeHeader_(sh, heads, spec);
          if (!created) undo.push(function () { sh.clearContents(); });
        } else {
          var cmap = mapHeaders_(sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0], { name: ['name'] });
          if (cmap.name < 0) throw new Error('Tab "' + name + '" exists but has no Name column in row 1.');
        }
        var cols = mapHeaders_(sh.getRange(1, 1, 1, Math.max(heads.length, sh.getLastColumn())).getValues()[0], flag === 'debts' ? apiDebtSpecD_() : apiDebtSpecB_());
        if (rows.length) {
          var width = Math.max.apply(null, Object.keys(fields).map(function (f) { return cols[f]; })) + 1;
          var vals = rows.map(function (r) { return apiDebtRowArr_(fields, cols, r, width); });
          undo.push(function () { sh.getRange(2, 1, vals.length, width).clearContent(); });
          sh.getRange(2, 1, vals.length, width).setValues(vals);
        }
        done.push(name + (created ? ' (created)' : ' (filled)') + ': ' + rows.length + ' rows');
        return sh;
      };
      if (!haveD) shD = build(shD, API_DEBT_TAB, API_DEBT_HEADS, apiDebtSheetSpec_('debts'), API_DEBT_FIELDS, plan.debts, 'debts');
      if (!haveB) shB = build(shB, API_BILLS_TAB, API_BILLS_HEADS, apiDebtSheetSpec_('bills'), API_BILL_FIELDS, plan.bills, 'bills');
      SpreadsheetApp.flush();
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      apiDebtJournal_(ss, 'debttabs', '', 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'tabs removed / ranges cleared') + ' (cid ' + cid + ')', '');
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.written = done; out.tabs = apiDebtTabsInfo_(ss);
    apiDebtJournal_(ss, 'debttabs', '', 'done', '', done.join('; '), cid);
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}
function apiDebtSpecD_() {
  return { name: ['name'], entity: ['entity'], lender: ['lender'], balance: ['balance'], rate: ['rate %', 'rate'], rateNote: ['rate note'], payment: ['monthly payment', 'payment'],
    payStatus: ['payment status'], payAfter: ['payment after reset'], payAfterFrom: ['reset from', 'payment after reset from'], dueDay: ['due day'], nextDue: ['next due override', 'next due'],
    maturityText: ['maturity'], asOf: ['as of'], status: ['status'], description: ['description'], notes: ['notes'] };
}
function apiDebtSpecB_() {
  return { due: ['due date', 'due'], name: ['name'], entity: ['entity'], amount: ['amount'], kind: ['kind'], repeat: ['repeat'], status: ['status of figure', 'status'],
    escrow: ['via escrow'], paid: ['paid?', 'paid'], paidDate: ['paid date'], description: ['description'], notes: ['notes'] };
}
/** Header -> column map for a live sheet row 1 (field names as in API_DEBT_FIELDS / API_BILL_FIELDS). */
function apiDebtLiveCols_(sh, which) {
  var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  return mapHeaders_(head, which === 'debts' ? apiDebtSpecD_() : apiDebtSpecB_());
}
function apiDebtHas_(p, k) { return p[k] !== undefined && p[k] !== null; }
/** Validate one input value for a field. Returns { v } or { err }. */
function apiDebtParseVal_(field, type, raw) {
  var s = apiAdminClean_(raw, field === 'description' ? 400 : 300);
  if (apiAdminHasAcctNo_(s)) return { err: 'Do not send account numbers (' + field + ').' };
  if (type === 'money') { if (s === '') return { v: null }; var a = apiAdminAmount_(s); return a === null || a < 0 ? { err: field + ' must be a dollar amount (0 or more).' } : { v: a }; }
  if (type === 'rate') { if (s === '') return { v: null }; var r = Number(s.replace(/%/g, '')); return isNaN(r) || r < 0 || r > 100 ? { err: field + ' must be a percent between 0 and 100.' } : { v: Math.round(r * 1000) / 1000 }; }
  if (type === 'int') { if (s === '') return { v: null }; var n = Number(s); return n >= 1 && n <= 31 && n === Math.floor(n) ? { v: n } : { err: field + ' must be a day of the month (1-31).' }; }
  if (type === 'date') { if (s === '') return { v: '' }; var d = apiAdminDate_(s); return d ? { v: d } : { err: field + ' must be yyyy-mm-dd.' }; }
  if (type === 'datetext') { if (s === '') return { v: '' }; return { v: apiAdminDate_(s) || s.substring(0, 40) }; }
  if (type === 'yes') return { v: apiAdminBool_(s) || /^(y|paid|x)$/i.test(s) };
  return { v: s };
}
function apiDebtCheckEnum_(field, v, list) {
  var hit = ''; list.forEach(function (x) { if (loose_(x) === loose_(v)) hit = x; });
  return hit ? { v: hit } : { err: field + ' must be one of: ' + list.join(' | ') };
}

/**
 * action=debtset  (admin) — update ONE Debts row found by name (loose match; add=1 adds a new row).
 *   name (required), new_name; entity, lender, balance, rate (percent number), rate_note, payment, payment_status, payment_after, payment_after_from (yyyy-mm-dd),
 *   due_day (1-31), next_due (yyyy-mm-dd; the Next due override), maturity (yyyy-mm-dd or text), as_of (yyyy-mm-dd), status (Verified|Derived|Estimate), description, notes.
 *   Only the parameters that are present change; an empty value clears that cell. add=1 needs entity, balance, description.
 *   cid required when writing; dry=1 previews the before/after of every changed cell.
 */
var API_DEBTSET_PARAMS = { new_name: 'name', entity: 'entity', lender: 'lender', balance: 'balance', rate: 'rate', rate_note: 'rateNote', payment: 'payment', payment_status: 'payStatus',
  payment_after: 'payAfter', payment_after_from: 'payAfterFrom', due_day: 'dueDay', next_due: 'nextDue', maturity: 'maturityText', as_of: 'asOf', status: 'status',
  description: 'description', notes: 'notes' };
function apiDebtSet_(p) {
  p = p || {};
  var name = apiAdminClean_(p.name, 80), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), add = apiAdminBool_(p.add);
  if (!name) return { error: 'bad_value', message: 'name is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var set = {};
  var keys = Object.keys(API_DEBTSET_PARAMS);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], f = API_DEBTSET_PARAMS[k];
    if (!apiDebtHas_(p, k)) continue;
    var pr = apiDebtParseVal_(f, API_DEBT_FIELDS[f][1], p[k]);
    if (pr.err) return { error: 'bad_value', message: pr.err };
    if (f === 'entity') pr = apiDebtCheckEnum_('entity', pr.v, API_DEBT_ENTITIES);
    if (f === 'status' || f === 'payStatus') { if (f === 'payStatus' && pr.v === '') pr = { v: '' }; else pr = apiDebtCheckEnum_(k, pr.v, API_DEBT_STATUSES); }
    if (f === 'name' && !pr.v) pr = { err: 'new_name cannot be empty.' };
    if (pr.err) return { error: 'bad_value', message: pr.err };
    set[f] = pr.v;
  }
  if (apiAcctExcluded_(name + ' ' + (set.name || '') + ' ' + (set.entity || ''))) return { error: 'excluded', message: 'That entity is deliberately not kept in the Vault.' };
  var lock = apiDebtLock_(); if (!lock) return { error: 'busy', message: 'Another update is running. Try again.' };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), sh = ss.getSheetByName(API_DEBT_TAB);
    if (!sh || sh.getLastRow() < 1) return { error: 'no_tab', message: 'The Debts tab does not exist yet. Run action=debttabs first.' };
    var cols = apiDebtLiveCols_(sh, 'debts');
    if (cols.name < 0) return { error: 'no_columns', message: 'Debts tab needs a Name column.' };
    var read = apiDebtReadDebts_(sh), hit = apiDebtFind_(read.rows, name);
    if (hit.length > 1 && !hit.some(function (r) { return loose_(r.name) === loose_(name); })) return { error: 'ambiguous', message: 'More than one Debts row matches.', candidates: hit.map(function (r) { return r.name; }) };
    var row = hit.filter(function (r) { return loose_(r.name) === loose_(name); })[0] || hit[0] || null;
    if (!row && !add) return { error: 'not_found', message: 'No Debts row named like that. Use add=1 to add one.', candidates: read.rows.map(function (r) { return r.name; }) };
    if (apiAdminSeenCid_(ss, 'debtset', cid)) return { ok: true, data: { name: row ? row.name : name, duplicate: 'cid', dry: dry } };
    var out = { name: row ? row.name : name, dry: dry, cid: cid, action: row ? 'update' : 'add', rowNum: row ? row.rowNum : null, changes: [] };

    if (!row) {   // ---- add a new Debts row ----
      var nr = { name: name, status: 'Estimate' };
      Object.keys(set).forEach(function (f) { nr[f] = set[f]; });
      if (!nr.entity) return { error: 'bad_value', message: 'entity is required to add a row.' };
      if (nr.balance == null) return { error: 'bad_value', message: 'balance is required to add a row.' };
      if (!nr.description) return { error: 'bad_value', message: 'description is required (plain English: what it is and what it is for).' };
      Object.keys(nr).forEach(function (f) { out.changes.push({ field: API_DEBT_FIELDS[f][0], before: '', after: nr[f] }); });
      if (dry) return { ok: true, data: out };
      var width = Math.max.apply(null, Object.keys(API_DEBT_FIELDS).map(function (f) { return cols[f]; })) + 1;
      var rowN = 2; read.rows.forEach(function (r) { if (r.rowNum >= rowN) rowN = r.rowNum + 1; });
      try {
        apiTabBackup_(ss, sh);
        sh.getRange(rowN, 1, 1, width).setValues([apiDebtRowArr_(API_DEBT_FIELDS, cols, nr, width)]);
        SpreadsheetApp.flush();
      } catch (werr) {
        var u1 = []; try { sh.getRange(rowN, 1, 1, width).clearContent(); } catch (e2) { u1.push(String(e2 && e2.message || e2)); }
        apiDebtJournal_(ss, 'debtset', rowN, 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), 'row cleared (cid ' + cid + ')', '');
        return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !u1.length };
      }
      out.rowNum = rowN;
      apiDebtJournal_(ss, 'debtset', rowN, 'Debts: add', '', nr.name + ' | ' + nr.entity, cid);
      return { ok: true, data: out };
    }

    // ---- update ----
    Object.keys(set).forEach(function (f) {
      var type = API_DEBT_FIELDS[f][1], before = row[f === 'maturityText' ? 'maturityText' : f], after = set[f];
      if (apiDebtCmp_(type, before) !== apiDebtCmp_(type, after)) out.changes.push({ field: API_DEBT_FIELDS[f][0], before: before == null ? '' : before, after: after == null ? '' : after, _f: f });
    });
    if (set.name && loose_(set.name) !== loose_(row.name) && apiDebtFind_(read.rows, set.name).some(function (r) { return r.rowNum !== row.rowNum && loose_(r.name) === loose_(set.name); })) return { error: 'bad_value', message: 'Another Debts row already has that name.' };
    if (!out.changes.length) { out.duplicate = 'row'; out.changes = []; return { ok: true, data: out }; }
    if (dry) { out.changes.forEach(function (c) { delete c._f; }); return { ok: true, data: out }; }
    var wcols = Math.max(sh.getLastColumn(), 1), old = sh.getRange(row.rowNum, 1, 1, wcols).getValues()[0], vnotes = [];
    try {
      apiTabBackup_(ss, sh);
      out.changes.forEach(function (c) { apiDebtPut_(sh, row.rowNum, cols[c._f], API_DEBT_FIELDS[c._f][1], set[c._f], vnotes); });
      SpreadsheetApp.flush();
    } catch (werr2) {
      var u2 = []; try { sh.getRange(row.rowNum, 1, 1, wcols).setValues([old]); } catch (e3) { u2.push(String(e3 && e3.message || e3)); }
      apiDebtJournal_(ss, 'debtset', row.rowNum, 'ROLLED BACK', String(werr2 && werr2.message || werr2).substring(0, 200), (u2.length ? 'undo errors: ' + u2.join('; ') : 'row restored') + ' (cid ' + cid + ')', '');
      return { error: 'write_failed', message: String(werr2 && werr2.message || werr2), rolledBack: !u2.length };
    }
    out.changes.forEach(function (c) { apiDebtJournal_(ss, 'debtset', row.rowNum, 'Debts: ' + c.field, c.before, c.after, ''); delete c._f; });
    apiDebtJournal_(ss, 'debtset', row.rowNum, 'done: ' + row.name, '', out.changes.length + ' change(s)', cid);
    if (vnotes.length) out.validation = vnotes;
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}

/**
 * action=billadd  (admin) — add ONE row to the Bills tab.
 *   name, entity, description (all required), due (yyyy-mm-dd; blank = not scheduled yet), amount, kind (Loan payment|Insurance|Property tax|Utility|Other; default Other),
 *   repeat (Monthly|Annual|One-time; default One-time), status (Verified|Derived|Estimate; default Estimate), via_escrow (1 = paid through escrow), notes.
 *   cid required when writing; dry=1 previews. The same name + due + amount already on the tab is reported as duplicate and not added again.
 */
function apiBillAdd_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), b = { paid: false, paidDate: '' };
  var spec = [['name', 'name', 'text'], ['entity', 'entity', 'text'], ['description', 'description', 'text'], ['due', 'due', 'date'], ['amount', 'amount', 'money'], ['kind', 'kind', 'text'],
              ['repeat', 'repeat', 'text'], ['status', 'status', 'text'], ['via_escrow', 'escrow', 'yes'], ['notes', 'notes', 'text']];
  for (var i = 0; i < spec.length; i++) {
    var pr = apiDebtParseVal_(spec[i][1], spec[i][2], p[spec[i][0]] == null ? '' : p[spec[i][0]]);
    if (pr.err) return { error: 'bad_value', message: pr.err };
    b[spec[i][1]] = pr.v;
  }
  if (!b.name) return { error: 'bad_value', message: 'name is required.' };
  if (!b.description) return { error: 'bad_value', message: 'description is required (plain English: what is owed and why).' };
  var e = apiDebtCheckEnum_('entity', b.entity, API_DEBT_ENTITIES); if (e.err) return { error: 'bad_value', message: e.err }; b.entity = e.v;
  if (apiAcctExcluded_(b.name + ' ' + b.entity)) return { error: 'excluded', message: 'That entity is deliberately not kept in the Vault.' };
  var kd = b.kind ? apiBillKind_(b.kind) : API_BILL_KINDS[4];
  if (!API_BILL_KINDS.some(function (k) { return k.label === kd.label; })) return { error: 'bad_value', message: 'kind must be one of: ' + API_BILL_KINDS.map(function (k) { return k.label; }).join(' | ') };
  b.kind = kd.label;
  b.repeat = apiBillRepeatLabel_(apiBillRepeat_(b.repeat || 'One-time'));
  var st = apiDebtCheckEnum_('status', b.status || 'Estimate', API_DEBT_STATUSES); if (st.err) return { error: 'bad_value', message: st.err }; b.status = st.v;
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = apiDebtLock_(); if (!lock) return { error: 'busy', message: 'Another update is running. Try again.' };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), sh = ss.getSheetByName(API_BILLS_TAB);
    if (!sh || sh.getLastRow() < 1) return { error: 'no_tab', message: 'The Bills tab does not exist yet. Run action=debttabs first.' };
    var cols = apiDebtLiveCols_(sh, 'bills');
    if (cols.name < 0) return { error: 'no_columns', message: 'Bills tab needs a Name column.' };
    var read = apiDebtReadBills_(sh), out = { dry: dry, cid: cid, bill: b, rowNum: null };
    if (apiAdminSeenCid_(ss, 'billadd', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var dup = read.rows.filter(function (r) { return loose_(r.name) === loose_(b.name) && (r.due || '') === (b.due || '') && apiDebtCmp_('money', r.amount) === apiDebtCmp_('money', b.amount); })[0];
    if (dup) { out.duplicate = 'row'; out.rowNum = dup.rowNum; return { ok: true, data: out }; }
    var rowN = 2; read.rows.forEach(function (r) { if (r.rowNum >= rowN) rowN = r.rowNum + 1; });
    out.rowNum = rowN;
    if (dry) return { ok: true, data: out };
    var width = Math.max.apply(null, Object.keys(API_BILL_FIELDS).map(function (f) { return cols[f]; })) + 1;
    try {
      apiTabBackup_(ss, sh);
      sh.getRange(rowN, 1, 1, width).setValues([apiDebtRowArr_(API_BILL_FIELDS, cols, b, width)]);
      SpreadsheetApp.flush();
    } catch (werr) {
      var u = []; try { sh.getRange(rowN, 1, 1, width).clearContent(); } catch (e2) { u.push(String(e2 && e2.message || e2)); }
      apiDebtJournal_(ss, 'billadd', rowN, 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (u.length ? 'undo errors: ' + u.join('; ') : 'row cleared') + ' (cid ' + cid + ')', '');
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !u.length };
    }
    apiDebtJournal_(ss, 'billadd', rowN, 'Bills: add', '', (b.due || '(no date)') + ' | ' + b.name + ' | ' + b.entity + ' | ' + (b.amount == null ? '' : b.amount) + ' | ' + b.kind + ' | ' + b.repeat, cid);
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}

/**
 * action=billpaid  (admin) — mark a bill paid.
 *   name (required, loose match) [due=yyyy-mm-dd to pick one of several rows] [paid_date=yyyy-mm-dd, default today] cid, dry=1.
 *   Bills row, One-time: Paid? = Yes + Paid date (the row drops out of Upcoming bills).
 *   Bills row, Monthly / Annual: Paid date is recorded and Due date moves to the next occurrence (Paid? stays blank).
 *   No Bills row but a Debts row of that name (a loan payment): its "Next due override" moves to the installment after the one being paid.
 */
function apiBillPaid_(p) {
  p = p || {};
  var name = apiAdminClean_(p.name, 80), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var dueIn = p.due ? apiAdminDate_(p.due) : '', paidDate = p.paid_date ? apiAdminDate_(p.paid_date) : '';
  if (!name) return { error: 'bad_value', message: 'name is required.' };
  if (p.due && !dueIn) return { error: 'bad_value', message: 'due must be yyyy-mm-dd.' };
  if (p.paid_date && !paidDate) return { error: 'bad_value', message: 'paid_date must be yyyy-mm-dd.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = apiDebtLock_(); if (!lock) return { error: 'busy', message: 'Another update is running. Try again.' };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), shB = ss.getSheetByName(API_BILLS_TAB), shD = ss.getSheetByName(API_DEBT_TAB), today = todayKey_();
    if (!shB || !shD) return { error: 'no_tab', message: 'The Debts / Bills tabs do not exist yet. Run action=debttabs first.' };
    paidDate = paidDate || today;
    var out = { dry: dry, cid: cid, paidDate: paidDate };
    if (apiAdminSeenCid_(ss, 'billpaid', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var rb = apiDebtReadBills_(shB), rd = apiDebtReadDebts_(shD);
    var nk = loose_(name), isOpen = function (r) { return !(r.paid && apiBillRepeat_(r.repeat) === 'once'); };
    var byDue = function (r) { return !dueIn || r.due === dueIn; };
    var exactB = rb.rows.filter(function (r) { return loose_(r.name) === nk && byDue(r); });
    var exactD = dueIn ? [] : rd.rows.filter(function (r) { return loose_(r.name) === nk; });
    var cands = exactB, dcands = exactD;
    if (!cands.length && !dcands.length) {            // no exact name: loose contains-match on both tabs
      cands = apiDebtFind_(rb.rows, name).filter(byDue);
      dcands = dueIn ? [] : apiDebtFind_(rd.rows, name);
    }
    var open = cands.filter(isOpen);
    if (cands.length && !open.length && !dcands.length) { out.duplicate = 'row'; out.rowNum = cands[0].rowNum; out.note = 'Already marked paid.'; return { ok: true, data: out }; }
    if (open.length + dcands.length > 1) return { error: 'ambiguous', message: 'More than one open row matches. Use the full name (and due=yyyy-mm-dd for a Bills row).',
      candidates: open.map(function (r) { return { tab: 'Bills', rowNum: r.rowNum, name: r.name, due: r.due, amount: r.amount }; }).concat(dcands.map(function (r) { return { tab: 'Debts', rowNum: r.rowNum, name: r.name }; })) };
    if (open.length === 1) {
      var row = open[0], rep = apiBillRepeat_(row.repeat), cols = apiDebtLiveCols_(shB, 'bills');
      if (!row.due && rep !== 'once') return { error: 'no_due_date', message: 'That row has no Due date, so there is nothing to roll forward.' };
      out.target = 'bills'; out.rowNum = row.rowNum; out.name = row.name;
      var changes = [];
      if (rep === 'once') { changes.push(['paid', 'Paid?', row.paid ? 'Yes' : '', 'Yes']); changes.push(['paidDate', 'Paid date', row.paidDate, paidDate]); }
      else { var nd = apiBillAddMonths_(row.due, rep === 'monthly' ? 1 : 12); changes.push(['due', 'Due date', row.due, nd]); changes.push(['paidDate', 'Paid date', row.paidDate, paidDate]); if (row.paid) changes.push(['paid', 'Paid?', 'Yes', '']); out.nextDue = nd; }
      out.changes = changes.map(function (c) { return { field: c[1], before: c[2], after: c[3] }; });
      if (dry) return { ok: true, data: out };
      var wcols = Math.max(shB.getLastColumn(), 1), old = shB.getRange(row.rowNum, 1, 1, wcols).getValues()[0];
      try {
        apiTabBackup_(ss, shB);
        changes.forEach(function (c) { apiDebtPut_(shB, row.rowNum, cols[c[0]], API_BILL_FIELDS[c[0]][1], c[0] === 'paid' ? c[3] === 'Yes' : c[3], []); });
        SpreadsheetApp.flush();
      } catch (werr) {
        var u = []; try { shB.getRange(row.rowNum, 1, 1, wcols).setValues([old]); } catch (e2) { u.push(String(e2 && e2.message || e2)); }
        apiDebtJournal_(ss, 'billpaid', row.rowNum, 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (u.length ? 'undo errors: ' + u.join('; ') : 'row restored') + ' (cid ' + cid + ')', '');
        return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !u.length };
      }
      changes.forEach(function (c) { apiDebtJournal_(ss, 'billpaid', row.rowNum, 'Bills: ' + c[1], c[2], c[3], ''); });
      apiDebtJournal_(ss, 'billpaid', row.rowNum, 'done: ' + row.name, '', paidDate, cid);
      return { ok: true, data: out };
    }
    // ---- loan payment: move the Next due override on the Debts row ----
    if (!dcands.length) return { error: 'not_found', message: 'No open Bills row or Debts row matches that name.', candidates: rb.rows.map(function (r) { return r.name; }).concat(rd.rows.map(function (r) { return r.name; })) };
    var d = dcands[0], end = apiDebtAddDays_(today, API_DEBT_WINDOW_DAYS), day = d.dueDay || (d.nextDue ? +d.nextDue.split('-')[2] : 0) || (d.maturityIso ? +d.maturityIso.split('-')[2] : 0);
    if (!day) return { error: 'no_due_day', message: 'That Debts row has no Due day.' };
    var paying = dueIn || apiDebtLoanNext_(today, end, day, d.nextDue && d.nextDue >= today ? d.nextDue : '', d.maturityIso);
    if (!paying) return { error: 'no_due_date', message: 'No upcoming installment found for that loan.' };
    var nm = apiDebtNextMonth_(paying), newOv = apiDebtOcc_(nm.y, nm.m, day);
    if (d.maturityIso && newOv > d.maturityIso) newOv = '';
    out.target = 'debts'; out.rowNum = d.rowNum; out.name = d.name; out.paidInstallment = paying; out.nextDue = newOv;
    out.changes = [{ field: 'Next due override', before: d.nextDue, after: newOv }];
    if (apiDebtCmp_('date', d.nextDue) === apiDebtCmp_('date', newOv)) { out.duplicate = 'row'; return { ok: true, data: out }; }
    if (dry) return { ok: true, data: out };
    var dcols = apiDebtLiveCols_(shD, 'debts'), dw = Math.max(shD.getLastColumn(), 1), dold = shD.getRange(d.rowNum, 1, 1, dw).getValues()[0];
    try {
      apiTabBackup_(ss, shD);
      apiDebtPut_(shD, d.rowNum, dcols.nextDue, 'date', newOv, []);
      SpreadsheetApp.flush();
    } catch (werr2) {
      var u3 = []; try { shD.getRange(d.rowNum, 1, 1, dw).setValues([dold]); } catch (e3) { u3.push(String(e3 && e3.message || e3)); }
      apiDebtJournal_(ss, 'billpaid', d.rowNum, 'ROLLED BACK', String(werr2 && werr2.message || werr2).substring(0, 200), (u3.length ? 'undo errors: ' + u3.join('; ') : 'row restored') + ' (cid ' + cid + ')', '');
      return { error: 'write_failed', message: String(werr2 && werr2.message || werr2), rolledBack: !u3.length };
    }
    apiDebtJournal_(ss, 'billpaid', d.rowNum, 'Debts: Next due override (paid ' + paying + ' on ' + paidDate + ')', d.nextDue, newOv, cid);
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}

/**
 * action=billdel / debtdel  (admin) — delete ONE row from the Bills tab (billdel) or the Debts tab (debtdel).
 *   name (required; exact name first, then loose contains-match like billpaid), optional row=<sheet row number> to pick one of several matches
 *   (the row must still match the name, so a stale row number can never delete a different line), cid (required when writing), dry=1 previews.
 *   More than one match and no row -> error 'ambiguous' with candidates (tab, rowNum, name, due). No match -> 'not_found'.
 *   Same cid twice -> duplicate:'cid' (nothing deleted again). The tab is backed up first (first write of the day); the deleted row's values go in the
 *   "CC write log" so it can be restored by hand. If the delete fails, the row is put back (write_failed, rolledBack:true, logged "ROLLED BACK").
 */
function apiRowDel_(which, p) {
  p = p || {};
  var act = which === 'debts' ? 'debtdel' : 'billdel', tab = which === 'debts' ? API_DEBT_TAB : API_BILLS_TAB, tabLabel = which === 'debts' ? 'Debts' : 'Bills';
  var name = apiAdminClean_(p.name, 80), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var rowIn = 0;
  if (p.row !== undefined && p.row !== null && String(p.row) !== '') {
    rowIn = Number(p.row);
    if (!(rowIn >= 2) || rowIn !== Math.floor(rowIn)) return { error: 'bad_value', message: 'row must be a sheet row number (2 or more).' };
  }
  if (!name) return { error: 'bad_value', message: 'name is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = apiDebtLock_(); if (!lock) return { error: 'busy', message: 'Another update is running. Try again.' };
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 1) return { error: 'no_tab', message: 'The ' + tabLabel + ' tab does not exist yet. Run action=debttabs first.' };
    var out = { dry: dry, cid: cid, tab: tabLabel };
    if (apiAdminSeenCid_(ss, act, cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var rd = which === 'debts' ? apiDebtReadDebts_(sh) : apiDebtReadBills_(sh);
    var cands = apiDebtFind_(rd.rows, name);
    var cinfo = function (r) { return { tab: tabLabel, rowNum: r.rowNum, name: r.name, due: r.due || r.nextDue || '', amount: r.amount !== undefined ? r.amount : r.balance }; };
    if (rowIn) {
      var picked = cands.filter(function (r) { return r.rowNum === rowIn; });
      if (!picked.length) return { error: 'not_found', message: 'Row ' + rowIn + ' of ' + tabLabel + ' does not match that name. Nothing deleted.', candidates: cands.map(cinfo) };
      cands = picked;
    }
    if (!cands.length) return { error: 'not_found', message: 'No ' + tabLabel + ' row matches that name.', candidates: rd.rows.map(function (r) { return r.name; }) };
    if (cands.length > 1) return { error: 'ambiguous', message: 'More than one ' + tabLabel + ' row matches. Use the full name and/or row=<rowNum>.', candidates: cands.map(cinfo) };
    var row = cands[0];
    out.rowNum = row.rowNum; out.name = row.name; out.deleted = cinfo(row);
    if (dry) return { ok: true, data: out };
    var wcols = Math.max(sh.getLastColumn(), 1), old = sh.getRange(row.rowNum, 1, 1, wcols).getValues()[0];
    var snap = function (a) { return JSON.stringify(a.map(function (v) { return v instanceof Date ? v.getTime() : v; })); };
    try {
      apiTabBackup_(ss, sh);
      sh.deleteRow(row.rowNum);
      SpreadsheetApp.flush();
    } catch (werr) {
      var u = [];
      try {                                            // put the row back only if it is really gone
        var now = sh.getRange(row.rowNum, 1, 1, wcols).getValues()[0];
        if (snap(now) !== snap(old)) { sh.insertRowBefore(row.rowNum); sh.getRange(row.rowNum, 1, 1, wcols).setValues([old]); }
      } catch (e2) { u.push(String(e2 && e2.message || e2)); }
      apiDebtJournal_(ss, act, row.rowNum, 'ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (u.length ? 'undo errors: ' + u.join('; ') : 'row restored') + ' (cid ' + cid + ')', '');
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !u.length };
    }
    var vals = old.map(function (v) { return v instanceof Date ? toKey_(v) : String(v === null || v === undefined ? '' : v); }).join(' | ');
    apiDebtJournal_(ss, act, row.rowNum, tabLabel + ': delete row', vals.substring(0, 480), '(deleted: ' + row.name + ')', cid);
    return { ok: true, data: out };
  } finally { lock.releaseLock(); }
}

/* ======================================================================= */
/* v31+ — admin action `spendadd`: add ONE row to the Daily Spend tab.       */
/*   Columns (header-mapped, never by position): Date | Who | Amount |      */
/*   Category | Merchant / note | Method | Notes | Account | Paid from.     */
/*   Same conventions as incomeadd/balset: passcode, cid idempotency,        */
/*   dry=1, all-or-nothing with rollback, "CC write log" journal.            */
/* ======================================================================= */
var API_SPENDADD_WHO = ['Zac', 'Lisa', 'Joint'];
var API_SPENDADD_CATS = ['Groceries', 'Dining', 'Gas', 'Home goods', 'Kids/Education', 'Health', 'Entertainment', 'Travel', 'Home/Property', 'Personal', 'Other', 'Plumbing', 'Insurance', 'Property Taxes'];
var API_SPENDADD_METHODS = ['Cash', 'Debit', 'Credit', 'ACH/Transfer', 'Other'];
/** v42: payment types the Vault mic offers. spendadd accepts these in addition to whatever the sheet's Method dropdown lists; incomeadd accepts them for every tab. */
var API_PAY_METHODS = ['Cash', 'Credit', 'Debit', 'Venmo', 'Zelle', 'Check', 'ACH/Transfer', 'Other'];
var API_PAY_ALIASES = { creditcard: 'Credit', debitcard: 'Debit', cheque: 'Check', ach: 'ACH/Transfer', transfer: 'ACH/Transfer', banktransfer: 'ACH/Transfer', wire: 'ACH/Transfer' };
/** The list a payment type is checked against: the sheet's own list first (its spelling wins), then every fixed type it does not have yet. */
function apiPayUnion_(sheetList) {
  var out = sheetList.slice();
  API_PAY_METHODS.forEach(function (m) { if (!out.some(function (x) { return loose_(x) === loose_(m); })) out.push(m); });
  return out;
}
/** Canonical spelling of a payment type from `list` (loose, case-insensitive; 'Credit card' falls back to 'Credit' etc.); '' when it is not one. */
function apiPayPick_(list, v) {
  var hit = apiSpendAddPick_(list, v);
  if (!hit) { var al = API_PAY_ALIASES[loose_(v)]; if (al) hit = apiSpendAddPick_(list, al); }
  return hit;
}

/** The dropdown list on the cell (row, col0) when it is a list validation; otherwise the fallback list. Returns the list of strings. */
function apiSpendAddList_(sh, row, col0, fallback) {
  try {
    var dv = sh.getRange(row, col0 + 1).getDataValidation();
    if (dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      var l = (dv.getCriteriaValues()[0] || []).map(function (x) { return String(x); }).filter(function (x) { return x; });
      if (l.length) return l;
    }
  } catch (e) { /* fall back */ }
  return fallback;
}
function apiSpendAddPick_(list, v) {
  var hit = '';
  list.forEach(function (x) { if (loose_(x) === loose_(v)) hit = x; });
  return hit;
}

/**
 * action=spendadd  (admin; GET params or POST body)
 *   date       yyyy-mm-dd (default today; not more than 1 day ahead, not older than 366 days)
 *   amount     positive dollars, up to 2 decimals (written as a number)
 *   merchant   required (column "Merchant / note"), max 120
 *   category   one of the Category dropdown (default Other)
 *   account    Household | TiwiK | KiwiT (default Household; Month Summary only counts rows whose Account is exactly Household)
 *   paid_from  optional; one of the "Paid from" dropdown (Cash | Household card/account | KiwiT account | TiwiK account | Other)
 *   who        Zac | Lisa | Joint (default Zac)
 *   method     optional; one of the sheet's Method dropdown OR (v42) Cash | Credit | Debit | Venmo | Zelle | Check | ACH/Transfer | Other ('Credit card' = Credit; loose,
 *              case-insensitive; the canonical spelling is written). The cell is written through apiAdminSetCell_, so a type the dropdown does not have yet is added to it
 *              (never rejected by the sheet's validation); anything else -> bad_value listing the accepted types.
 *   notes      optional, max 300
 *   cid        required when writing; the same cid is never written twice
 *   dry=1      preview only (nothing written, nothing logged)
 * Duplicate: same cid, or a row with the same date + amount + merchant already on the tab -> { duplicate:'cid'|'row' }, nothing written.
 * Rejected: Sierra Consultants, anything that looks like an account number, values outside the sheet's dropdowns.
 */
function apiSpendAdd_(p) {
  p = p || {};
  var today = todayKey_();
  var date = p.date == null || String(p.date).trim() === '' ? today : apiAdminDate_(p.date);
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  var tmr = dateToKey_(new Date(keyToDate_(today).getTime() + 36 * 3600 * 1000));
  var oldest = dateToKey_(new Date(keyToDate_(today).getTime() - 366 * 24 * 3600 * 1000));
  if (date > tmr) return { error: 'bad_value', message: 'date is in the future.' };
  if (date < oldest) return { error: 'bad_value', message: 'date is more than a year old.' };
  var amt = apiAdminAmount_(p.amount);
  if (amt === null || !(amt > 0)) return { error: 'bad_value', message: 'amount must be a positive number (dollars, up to 2 decimals).' };
  var merchant = apiAdminClean_(p.merchant, 120), notes = apiAdminClean_(p.notes, 300), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!merchant) return { error: 'bad_value', message: 'merchant is required.' };
  if (apiAcctExcluded_([merchant, notes, p.category, p.paid_from, p.account, p.who, p.method].join(' '))) return { error: 'excluded', message: 'Sierra Consultants is deliberately not kept in the Command Center.' };
  if (apiAdminHasAcctNo_(merchant + ' ' + notes)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var gv = function (k) { return p[k] == null ? '' : apiAdminClean_(p[k], 80); };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var cfg = CONFIG.SPEND, ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) return { error: 'no_tab', message: 'Daily Spend tab not found.' };
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'Daily Spend needs a header row.' };
    var spec = {}; Object.keys(cfg.HEADERS).forEach(function (k) { spec[k] = cfg.HEADERS[k]; });
    spec.account = ['account']; spec.paid = API_PAID_HEADS;
    var col = mapHeaders_(values[0], spec);
    if (col.date < 0 || col.amount < 0 || col.merchant < 0) return { error: 'no_columns', message: 'Date, Amount and Merchant columns are required.' };
    var width = Math.max(col.date, col.who, col.amount, col.category, col.merchant, col.method, col.notes, col.account, col.paid) + 1;

    // where the row goes (also tells us which row's dropdowns to read)
    var pos = apiAdminNextRow_(values, col.date, width, true);
    var reuse = 0;
    for (var s = 1; s < values.length && !reuse; s++) {     // stub = date only, left by an earlier failed write
      var rowv = values[s], onlyDate = !!toKey_(rowv[col.date]);
      for (var c = 0; c < width && onlyDate; c++) if (c !== col.date && String(rowv[c] == null ? '' : rowv[c]).trim() !== '') onlyDate = false;
      if (onlyDate) reuse = s + 1;
    }
    var targetRow = reuse || pos.row;
    var lists = function (colIdx, fb) { return apiSpendAddList_(sh, targetRow, colIdx, fb); };

    // dropdown-validated fields
    var who = '', category = '', account = '', method = '', paidFrom = '';
    if (col.who >= 0) {
      var wl = lists(col.who, API_SPENDADD_WHO); who = apiSpendAddPick_(wl, gv('who') || 'Zac');
      if (!who) return { error: 'bad_value', message: 'who must be one of: ' + wl.join(' | ') };
    }
    var catNew = false;
    if (col.category >= 0) {
      var cl = lists(col.category, API_SPENDADD_CATS); category = apiSpendAddPick_(cl, gv('category') || 'Other');
      if (!category && apiAdminBool_(p.allow_new_category) && apiCatClean_(p.category)) { category = apiCatClean_(p.category); catNew = true; }   // v46: typed category, added to the dropdown
      if (!category) return { error: 'bad_value', message: 'category must be one of: ' + cl.join(' | ') };
    }
    if (col.account >= 0) {
      var al = lists(col.account, API_ACCOUNTS); account = apiSpendAddPick_(al, gv('account') || 'Household');
      if (!account) return { error: 'bad_value', message: 'account must be one of: ' + al.join(' | ') };
    } else if (gv('account') && loose_(gv('account')) !== 'household') {
      return { error: 'no_columns', message: 'The Daily Spend tab has no Account column.' };
    }
    if (gv('method')) {
      if (col.method < 0) return { error: 'no_columns', message: 'The Daily Spend tab has no Method column.' };
      var ml = apiPayUnion_(lists(col.method, API_SPENDADD_METHODS)); method = apiPayPick_(ml, gv('method'));
      if (!method) return { error: 'bad_value', message: 'method must be one of: ' + ml.join(' | ') };
    }
    if (gv('paid_from')) {
      if (col.paid < 0) return { error: 'no_columns', message: 'The Daily Spend tab has no "Paid from" column yet. Run action=spendcol first.' };
      var pl = lists(col.paid, API_PAID_FROM); paidFrom = apiSpendAddPick_(pl, gv('paid_from'));
      if (!paidFrom) return { error: 'bad_value', message: 'paid_from must be one of: ' + pl.join(' | ') };
    }

    var summary = { tab: sh.getName(), date: date, who: who, amount: round2_(amt), category: category, merchant: merchant, method: method,
                    notes: notes, account: account, paidFrom: paidFrom, cid: cid, dry: dry };
    if (!gv('category')) summary.categoryDefaulted = true;
    if (catNew) summary.categoryNew = true;
    if (apiAdminSeenCid_(ss, 'spendadd', cid)) { summary.duplicate = 'cid'; return { ok: true, data: summary }; }
    for (var r = 1; r < values.length; r++) {
      var a = toNum_(values[r][col.amount]);
      if (toKey_(values[r][col.date]) === date && a !== null && Math.abs(a - amt) < 0.005 && loose_(values[r][col.merchant]) === loose_(merchant)) {
        summary.duplicate = 'row'; summary.row = r + 1; return { ok: true, data: summary };
      }
    }
    summary.action = reuse ? 'reuse_blank_row' : (pos.insert ? 'insert_above_total' : 'append');
    summary.row = targetRow;
    if (dry) return { ok: true, data: summary };

    apiSpendBackup_(ss, sh);
    var journal = function (row, field, before, after) { apiSpendJournal_(ss, [new Date(), 'spendadd', row, 'Daily Spend: ' + field, before, after, '']); };
    var undo = [], vnotes = [];
    var sample = reuse ? values[reuse - 1][col.date] : (values[Math.max(1, pos.lastDataRow - 1)] ? values[Math.max(1, pos.lastDataRow - 1)][col.date] : '');
    var before = reuse ? values[reuse - 1].slice(0, width).join(' | ') : '';
    var rowNo = targetRow;
    try {
      if (reuse) {
        var old = values[reuse - 1].slice(0, width);
        undo.push(function () { sh.getRange(reuse, 1, 1, width).setValues([old]); });
      } else {
        apiAdminPrepRow_(sh, pos, width, journal);
        undo.push(function () { if (pos.insert) sh.deleteRow(pos.row); else sh.getRange(pos.row, 1, 1, width).clearContent(); });
      }
      // date: a real date at MIDNIGHT like the existing rows (a noon time would fall after the Month Summary's "<= month end" cut-off on the last day)
      var dc = sh.getRange(rowNo, col.date + 1), dp = date.split('-');
      dc.setValue(sample instanceof Date || !sample ? new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]), 0, 0, 0) : date);
      if (dc.getNumberFormat() === 'General' && (sample instanceof Date || !sample)) dc.setNumberFormat('yyyy-mm-dd');
      var put = function (ci, v) { if (ci >= 0 && v !== '') sh.getRange(rowNo, ci + 1).setValue(v); };
      put(col.who, who);
      var ac = sh.getRange(rowNo, col.amount + 1); ac.setValue(round2_(amt));
      if (ac.getNumberFormat() === 'General') ac.setNumberFormat('$#,##0.00');
      if (catNew) apiAdminSetCell_(sh, rowNo, col.category, category, true, vnotes); else put(col.category, category);
      apiAdminSetCell_(sh, rowNo, col.merchant, merchant, true, vnotes);              // free text: stored as text, never a formula
      if (col.method >= 0 && method) apiAdminSetCell_(sh, rowNo, col.method, method, true, vnotes);   // v42: extends the Method dropdown when the type is new to it
      if (col.notes >= 0 && notes) apiAdminSetCell_(sh, rowNo, col.notes, notes, true, vnotes);
      put(col.account, account);
      put(col.paid, paidFrom);
      SpreadsheetApp.flush();
      // read back: what is in the sheet must be what we meant to write
      var chk = sh.getRange(rowNo, 1, 1, width).getValues()[0], cn = toNum_(chk[col.amount]);
      if (toKey_(chk[col.date]) !== date || cn === null || Math.abs(cn - amt) > 0.005 || typeof chk[col.amount] !== 'number' || loose_(chk[col.merchant]) !== loose_(merchant) ||
          (col.account >= 0 && String(chk[col.account]) !== account)) {
        throw new Error('read-back mismatch after write');
      }
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      apiSpendJournal_(ss, [new Date(), 'spendadd', rowNo, 'Daily Spend: ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row removed/restored') + ' (cid ' + cid + ')', '']);
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    if (vnotes.length) summary.validation = vnotes;
    apiSpendJournal_(ss, [new Date(), 'spendadd', rowNo, 'Daily Spend: ' + summary.action, before,
      [date, who, round2_(amt), category, merchant, method, notes, account, paidFrom].join(' | '), cid]);
    return { ok: true, data: summary };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* v33 — receipt photos (Vault > mic/camera). Admin action `receiptsave`    */
/* stores ONE JPEG in Google Drive; read action `receipts` lists a month.   */
/*   Drive layout (under the "Financial" folder, 192-qWFev14hDRKM9u6iZem2y8ZeOFPwD): */
/*     Expenses/<Household|TiwiK|KiwiT>/<YYYY>/<MM>/YYYY-MM-DD_<merchant|receipt>_<amount|noamt>_<HHmmss>.jpg */
/*     Income Documents/<account>/<YYYY>/<MM>/...      (sibling of Expenses) */
/*   Same conventions as spendadd/incomeadd: passcode, cid idempotency,     */
/*   dry=1, rollback, "CC write log" journal. Needs DriveApp (the manifest  */
/*   already has the full drive scope). Sierra Consultants is rejected.     */
/* ======================================================================= */
var API_RCPT = {
  FINANCES_ID: '192-qWFev14hDRKM9u6iZem2y8ZeOFPwD',     // Drive folder "Financial"
  NAMES: { expense: 'Expenses', income: 'Income Documents' },
  PROPS: { expense: 'CC_RCPT_EXPENSES_ID', income: 'CC_RCPT_INCOME_ID' },   // cached folder ids (optional: set one by hand to pin an existing folder)
  MAX_BYTES: 3000000,        // decoded JPEG; the app sends well under 1.5 MB
  MAX_B64: 4200000,          // base64 characters
  DESC_TAG: 'CCR1 '          // file description = this tag + JSON {cid,kind,account,date,amount,merchant,note}
};

function apiRcptFolderOk_(f) { try { return !!f && !f.isTrashed(); } catch (e) { return false; } }
/** First non-trashed child folder called `name` (or a new one when create). Null when absent. */
function apiRcptChild_(parent, name, create) {
  var it = parent.getFoldersByName(name);
  while (it.hasNext()) { var f = it.next(); if (apiRcptFolderOk_(f)) return f; }
  return create ? parent.createFolder(name) : null;
}
/** The top folder for kind ('expense' -> Expenses, 'income' -> Income Documents). Script property id first, then the Financial folder, then (create) a new one. */
function apiRcptRoot_(kind, create) {
  var props = PropertiesService.getScriptProperties(), key = API_RCPT.PROPS[kind], id = props.getProperty(key);
  if (id) { try { var c = DriveApp.getFolderById(id); if (apiRcptFolderOk_(c)) return c; } catch (e) { /* stale id: look again */ } }
  var fin = DriveApp.getFolderById(API_RCPT.FINANCES_ID);
  var f = apiRcptChild_(fin, API_RCPT.NAMES[kind], !!create);
  if (f) props.setProperty(key, f.getId());
  return f;
}
function apiRcptSlug_(s, max) {
  return String(s || '').replace(/[^A-Za-z0-9 &'.-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/ /g, '-').replace(/\.+/g, '.').substring(0, max).replace(/[-.]+$/, '');
}
function apiRcptName_(date, merchant, amount, stamp) {
  return date + '_' + (apiRcptSlug_(merchant, 30) || 'receipt') + '_' + (amount == null ? 'noamt' : round2_(amount).toFixed(2)) + '_' + stamp + '.jpg';
}
function apiRcptParseDesc_(d) {
  d = String(d || '');
  if (d.indexOf(API_RCPT.DESC_TAG) !== 0) return null;
  try { return JSON.parse(d.substring(API_RCPT.DESC_TAG.length)) || null; } catch (e) { return null; }
}
/** (account, kind) -> { year, month } folder when it exists (never creates). */
function apiRcptMonthFolder_(kind, account, date, create) {
  var f = apiRcptRoot_(kind, create);
  if (!f) return null;
  var parts = [account, date.slice(0, 4), date.slice(5, 7)];
  for (var i = 0; i < parts.length; i++) {
    f = apiRcptChild_(f, parts[i], create);
    if (!f) return null;
  }
  return f;
}
/** Earlier journal row for this cid -> { fileId, url } (or null). */
function apiRcptJournalFind_(ss, cid) {
  var jt = ss.getSheetByName(API_SPENDFIX_CFG.journalTab);
  if (!jt || jt.getLastRow() < 2) return null;
  var v = jt.getRange(2, 1, jt.getLastRow() - 1, 7).getValues();
  for (var i = v.length - 1; i >= 0; i--) {
    if (String(v[i][1]) === 'receiptsave' && String(v[i][6]) === cid && !/ROLLED BACK/.test(String(v[i][3]))) {
      var m = String(v[i][5]).split(' | ');
      return { fileId: m[0] || '', url: m[1] || '' };
    }
  }
  return null;
}
function apiRcptCidInFolder_(folder, cid) {
  if (!folder) return null;
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next(), d = apiRcptParseDesc_(f.getDescription());
    if (d && d.cid === cid && !f.isTrashed()) return f;
  }
  return null;
}

/**
 * action=receiptsave  (admin; POST JSON body, or GET params for dry=1 checks)
 *   cid       required when writing (idempotency key; the same cid never files two images)
 *   kind      expense | income
 *   account   Household | TiwiK | KiwiT (default Household)
 *   date      yyyy-mm-dd (default today; not more than 1 day ahead, not older than 3 years)
 *   amount    optional, positive dollars (up to 2 decimals)       merchant  optional, max 80       note  optional, max 300
 *   mime      image/jpeg (only)       data  base64 JPEG (a data: URL prefix is tolerated); decoded size <= 3,000,000 bytes
 *   dry=1     validate + show where it would go; nothing is created or logged (data is optional then)
 * Returns { path, name, fileId, url, folderUrl, bytes, ... } or { duplicate:'cid', fileId, url } when this cid was already filed.
 * Rejected: Sierra Consultants, account-number-looking text, non-JPEG / truncated / oversized images.
 */
function apiReceiptSave_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80);
  var merchant = apiAdminClean_(p.merchant, 80), note = apiAdminClean_(p.note != null ? p.note : p.notes, 300);
  if (apiAcctExcluded_([merchant, note, p.account, p.kind].join(' '))) return { error: 'excluded', message: 'Sierra Consultants is deliberately not kept in the Command Center.' };
  if (apiAdminHasAcctNo_(merchant + ' ' + note)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var kind = String(p.kind || '').toLowerCase();
  if (kind !== 'expense' && kind !== 'income') return { error: 'bad_value', message: 'kind must be expense or income.' };
  var account = apiSpendAddPick_(API_ACCOUNTS, apiAdminClean_(p.account, 40) || 'Household');
  if (!account) return { error: 'bad_value', message: 'account must be one of: ' + API_ACCOUNTS.join(' | ') };
  var today = todayKey_();
  var date = p.date == null || String(p.date).trim() === '' ? today : apiAdminDate_(p.date);
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  var tmr = dateToKey_(new Date(keyToDate_(today).getTime() + 36 * 3600 * 1000));
  var oldest = dateToKey_(new Date(keyToDate_(today).getTime() - 3 * 366 * 24 * 3600 * 1000));
  if (date > tmr) return { error: 'bad_value', message: 'date is in the future.' };
  if (date < oldest) return { error: 'bad_value', message: 'date is more than 3 years old.' };
  var amount = null;
  if (p.amount != null && String(p.amount).trim() !== '') {
    amount = apiAdminAmount_(p.amount);
    if (amount === null || !(amount > 0)) return { error: 'bad_value', message: 'amount must be a positive number (dollars, up to 2 decimals).' };
  }
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var mime = String(p.mime || (dry && !p.data ? 'image/jpeg' : '')).toLowerCase();
  if (mime !== 'image/jpeg' && mime !== 'image/jpg') return { error: 'bad_value', message: 'mime must be image/jpeg.' };

  var folderName = API_RCPT.NAMES[kind];
  var summary = { kind: kind, account: account, date: date, amount: amount, merchant: merchant, note: note, cid: cid, dry: dry,
                  path: folderName + '/' + account + '/' + date.slice(0, 4) + '/' + date.slice(5, 7) };

  // already filed? (journal first, then the month folder's file descriptions in case the journal write failed)
  var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
  if (cid) {
    var seen = apiRcptJournalFind_(ss, cid);
    if (!seen) { var ex; try { ex = apiRcptCidInFolder_(apiRcptMonthFolder_(kind, account, date, false), cid); } catch (e0) { ex = null; } if (ex) seen = { fileId: ex.getId(), url: ex.getUrl() }; }
    if (seen) { summary.duplicate = 'cid'; summary.fileId = seen.fileId; summary.url = seen.url; return { ok: true, data: summary }; }
  }

  // image
  var bytes = null;
  if (p.data != null && String(p.data) !== '') {
    var b64 = String(p.data).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (b64.length > API_RCPT.MAX_B64) return { error: 'too_big', message: 'Image is too large. Shrink it and try again.' };
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'bad_value', message: 'data must be base64.' };
    try { bytes = Utilities.base64Decode(b64); } catch (e1) { return { error: 'bad_value', message: 'data is not valid base64.' }; }
    if (bytes.length > API_RCPT.MAX_BYTES) return { error: 'too_big', message: 'Image is too large (' + bytes.length + ' bytes; limit ' + API_RCPT.MAX_BYTES + '). Shrink it and try again.' };
    var n = bytes.length;
    if (n < 200 || (bytes[0] & 255) !== 0xFF || (bytes[1] & 255) !== 0xD8 || (bytes[2] & 255) !== 0xFF) return { error: 'bad_value', message: 'data is not a JPEG image.' };
    if ((bytes[n - 2] & 255) !== 0xFF || (bytes[n - 1] & 255) !== 0xD9) return { error: 'bad_value', message: 'The JPEG looks cut off (upload incomplete). Try again.' };
    summary.bytes = n;
  } else if (!dry) {
    return { error: 'bad_value', message: 'data (base64 JPEG) is required when writing.' };
  }
  var stamp = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'HHmmss');
  var name = apiRcptName_(date, merchant, amount, stamp);
  summary.name = name;
  if (dry) {
    var root = null; try { root = apiRcptRoot_(kind, false); } catch (e2) { return { error: 'no_folder', message: 'Cannot open the Financial folder: ' + String(e2 && e2.message || e2) }; }
    summary.folderExists = !!root; if (root) summary.folderUrl = root.getUrl();
    return { ok: true, data: summary };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  var file = null;
  try {
    // a concurrent call with the same cid may have finished while we waited for the lock
    var again = apiRcptJournalFind_(ss, cid);
    if (again) { summary.duplicate = 'cid'; summary.fileId = again.fileId; summary.url = again.url; return { ok: true, data: summary }; }
    var folder;
    try { folder = apiRcptMonthFolder_(kind, account, date, true); } catch (e4) { return { error: 'no_folder', message: 'Cannot open or create the Drive folder: ' + String(e4 && e4.message || e4) }; }
    // never overwrite: a same-second name collision gets -2, -3 ...
    var finalName = name, k = 1;
    while (folder.getFilesByName(finalName).hasNext() && k < 20) { k++; finalName = name.replace(/\.jpg$/, '-' + k + '.jpg'); }
    try {
      file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', finalName));
      file.setDescription(API_RCPT.DESC_TAG + JSON.stringify({ cid: cid, kind: kind, account: account, date: date, amount: amount, merchant: merchant, note: note }));
      if (file.getSize() !== bytes.length) throw new Error('size mismatch after upload (' + file.getSize() + ' vs ' + bytes.length + ')');
    } catch (werr) {
      var undone = true;
      try { if (file) file.setTrashed(true); } catch (e5) { undone = false; }
      try { apiSpendJournal_(ss, [new Date(), 'receiptsave', '', 'Drive: ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (file ? (undone ? 'partial file trashed' : 'partial file NOT removed: ' + file.getId()) : 'nothing created') + ' (cid ' + cid + ')', '']); } catch (e6) {}
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: undone };
    }
    summary.name = finalName; summary.fileId = file.getId(); summary.url = file.getUrl(); summary.folderUrl = folder.getUrl();
    try {
      apiSpendJournal_(ss, [new Date(), 'receiptsave', '', 'Drive: ' + summary.path + '/' + finalName, '',
        summary.fileId + ' | ' + summary.url + ' | ' + kind + ' ' + account + ' ' + date + (amount != null ? ' ' + round2_(amount) : '') + (merchant ? ' ' + merchant : ''), cid]);
    } catch (e7) { summary.journalFailed = true; }   // the file is in Drive and carries the cid in its description, so a retry still finds it
    return { ok: true, data: summary };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=receipts  (read-only; never creates folders)
 *   month=yyyy-mm  or  offset=N months from now (default 0)      kind=expense|income (default both)
 *   account=Household|TiwiK|KiwiT (default all)                   limit (default 50, max 100)
 * -> { month, count, total (sum of listed amounts), truncated, items:[{id,name,url,date,amount,account,kind,merchant,note,created}] }, newest first.
 */
function apiReceipts_(p) {
  p = p || {};
  var ym = /^\d{4}-\d{2}$/.test(String(p.month || '')) ? String(p.month) : '';
  if (!ym) {
    var off = Math.max(-520, Math.min(520, parseInt(p.offset, 10) || 0)), t = keyToDate_(todayKey_());
    var ms = new Date(t.getFullYear(), t.getMonth() + off, 1, 12);
    ym = ms.getFullYear() + '-' + pad_(ms.getMonth() + 1);
  }
  var kinds = String(p.kind || '').toLowerCase() === 'expense' ? ['expense'] : String(p.kind || '').toLowerCase() === 'income' ? ['income'] : ['expense', 'income'];
  var accts = p.account ? [apiSpendAddPick_(API_ACCOUNTS, apiAdminClean_(p.account, 40))].filter(function (x) { return x; }) : API_ACCOUNTS;
  var limit = Math.max(1, Math.min(100, parseInt(p.limit, 10) || 50));
  var items = [], truncated = false;
  kinds.forEach(function (kind) {
    var root = apiRcptRoot_(kind, false);
    if (!root) return;
    accts.forEach(function (account) {
      var f = apiRcptMonthFolder_(kind, account, ym + '-01', false);
      if (!f) return;
      var it = f.getFiles(), seen = 0;
      while (it.hasNext()) {
        var file = it.next();
        if (file.isTrashed()) continue;
        if (++seen > 200) { truncated = true; break; }
        var d = apiRcptParseDesc_(file.getDescription()) || {}, nm = file.getName();
        if (apiAcctExcluded_(nm + ' ' + (d.merchant || '') + ' ' + (d.note || ''))) continue;
        items.push({ id: file.getId(), name: nm, url: file.getUrl(), date: d.date || nm.slice(0, 10), amount: d.amount == null ? null : d.amount, account: account, kind: kind,
                     merchant: d.merchant || '', note: d.note || '', created: file.getDateCreated().toISOString() });
      }
    });
  });
  items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.created < b.created ? 1 : a.created > b.created ? -1 : 0; });
  if (items.length > limit) { items = items.slice(0, limit); truncated = true; }
  var total = 0; items.forEach(function (x) { if (x.amount != null) total += x.amount; });
  return { ok: true, data: { month: ym, count: items.length, total: round2_(total), truncated: truncated, items: items } };
}

/* ======================================================================= */
/* v34 — admin deletes: `spenddel` (Daily Spend tab) and `incomedel`        */
/* (Income / Land & Structure Pay / Personal Training tabs), plus the       */
/* helpers incomeadd (tab=pt, strict=1) and both deletes share.             */
/*   Same conventions as spendadd / incomeadd / billdel: passcode (the      */
/*   dispatcher), cid idempotency (same cid is never applied twice),        */
/*   dry=1 previews and writes nothing, script lock, values-only tab backup */
/*   (apiTabBackup_) before the first write of the day, "CC write log"      */
/*   entry with the deleted row's values, all-or-nothing (verify, else the  */
/*   row/validation list is put back: write_failed + "ROLLED BACK"),        */
/*   no account numbers (input rejected, output masked).                    */
/* ======================================================================= */
var API_INCOME_PROTECTED = ["Lisa's Table", 'Mono Village Laundromat', 'KiwiT rent'];   // never pruned from the Income Source dropdown

function apiIncomeTabName_(tabKey) { return tabKey === 'income' ? API_INCOME_TAB : tabKey === 'pt' ? API_PT_TAB : API_LSPAY_TAB; }
/** Header -> column map for the three income-style tabs (0-based; -1 = missing). label = Source (income) / Description (ls) / Client (pt). */
function apiIncomeCols_(tabKey, headRow) {
  if (tabKey === 'income') return mapHeaders_(headRow, { date: ['week ending', 'week end', 'week', 'date'], label: ['source'], amount: ['amount', '$'], method: ['payment type', 'method', 'payment', 'paid via'], notes: ['notes', 'note'], category: ['category'] });   // v46: Category created on first use; v47: "Payment type" created on first use
  if (tabKey === 'pt') return mapHeaders_(headRow, { date: ['date', 'week ending'], label: ['client', 'name', 'description', 'desc'], amount: ['amount', '$'], method: ['method', 'payment', 'paid via'], notes: ['notes', 'note'], category: ['category'] });
  return mapHeaders_(headRow, { date: ['date', 'pay date', 'week ending'], label: ['description', 'desc', 'client', 'name'], amount: ['amount', '$'], method: ['method', 'payment', 'paid via'], notes: ['notes', 'note'], category: ['category'] });
}
/* v46 (Vault category): category text as stored (no brackets / control characters, max 60). */
function apiCatClean_(v) { return String(v == null ? '' : v).replace(/[\[\]\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60); }
/**
 * v46: the "Category" column of an income tab: found by header, else created in the first column right of the last header cell
 * (existing columns are never moved or edited). Returns { col (0-based), created }. Journaled by the caller.
 */
function apiIncomeCatCol_(sh, tabKey) {
  var lastCol = Math.max(sh.getLastColumn(), 1), head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var c = apiIncomeCols_(tabKey, head).category;
  if (c >= 0) return { col: c, created: false };
  var last = 0;
  for (var i = 0; i < head.length; i++) if (String(head[i] == null ? '' : head[i]).trim() !== '') last = i + 1;
  var cell = sh.getRange(1, last + 1);
  if (last > 0) sh.getRange(1, last).copyTo(cell, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  cell.setNumberFormat('@'); cell.setValue('Category');
  SpreadsheetApp.flush();
  return { col: last, created: true };
}
/** v47: like apiIncomeCatCol_ for the "Payment type" column (pt / ls tabs already have Method). Returns { col, created }. */
function apiIncomePayCol_(sh, tabKey) {
  var lastCol = Math.max(sh.getLastColumn(), 1), head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var c = apiIncomeCols_(tabKey, head).method;
  if (c >= 0) return { col: c, created: false };
  var last = 0;
  for (var i = 0; i < head.length; i++) if (String(head[i] == null ? '' : head[i]).trim() !== '') last = i + 1;
  var cell = sh.getRange(1, last + 1);
  if (last > 0) sh.getRange(1, last).copyTo(cell, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  cell.setNumberFormat('@'); cell.setValue('Payment type');
  SpreadsheetApp.flush();
  return { col: last, created: true };
}
/** Every Source the Income tab knows: the values of the Source column's dropdown list(s) plus the Source of every existing row (exact spellings, first seen first). */
function apiIncomeKnownSources_(sh, values, labelCol) {
  var out = [], seen = {};
  var add = function (x) { var t = String(x == null ? '' : x).trim(); if (t && !seen[t]) { seen[t] = true; out.push(t); } };
  try {
    var maxR = sh.getMaxRows();
    if (maxR >= 2) {
      var dvs = sh.getRange(2, labelCol + 1, maxR - 1, 1).getDataValidations();
      dvs.forEach(function (r) {
        var d = r[0];
        if (d && d.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) (d.getCriteriaValues()[0] || []).forEach(add);
      });
    }
  } catch (e) { /* list unreadable: rows below still count */ }
  for (var r = 1; r < values.length; r++) add(values[r][labelCol]);
  return out;
}

/* ---- shared by spenddel / incomedel ---- */
/** A sheet cell as safe display text (dates as yyyy-mm-dd, control chars removed, account-number-looking text masked). */
function apiDelShow_(v) {
  var s = v instanceof Date ? toKey_(v) : String(v == null ? '' : v);
  s = s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return apiAdminHasAcctNo_(s) ? '[redacted]' : s.substring(0, 200);
}
/** Loose label match: same text once case/punctuation/spacing are ignored, or one contains the other ("Wagner" ~ "Wagner Hardware #12"). */
function apiDelLabelOk_(cell, want) {
  var a = loose_(cell), b = loose_(want);
  return !!a && !!b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
}
/**
 * Pick the row to delete. want = {date, amt, label}; col = {date, amount, label}; rowIn = sheet row from the client (0 = none);
 * info(idx) = the display object for values[idx]. A row only counts when date + amount + label all match (a header row, a Total row or a blank
 * row has no date, so it can never match).
 *   rowIn matches                      -> that row
 *   rowIn wrong, exactly ONE row matches -> that row (corrected:true)
 *   rowIn wrong otherwise              -> error row_mismatch with the actual contents of rowIn (+ candidates)
 *   no rowIn: 1 match -> it; 0 -> not_found; 2+ -> ambiguous (candidates)
 */
function apiDelFind_(values, col, want, rowIn, info) {
  var matches = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    if (toKey_(v[col.date]) !== want.date) continue;
    var a = toNum_(v[col.amount]);
    if (a === null || Math.abs(a - want.amt) > 0.005) continue;
    if (!apiDelLabelOk_(v[col.label], want.label)) continue;
    matches.push(r);
  }
  var cands = matches.map(info);
  if (rowIn) {
    if (matches.indexOf(rowIn - 1) >= 0) return { idx: rowIn - 1, others: matches.length - 1 };
    if (matches.length === 1) return { idx: matches[0], corrected: true, requestedRow: rowIn, others: 0 };
    return { err: { error: 'row_mismatch', message: 'Row ' + rowIn + ' is not the row to delete (date + amount + ' + want.what + ' do not match' + (matches.length > 1 ? '; ' + matches.length + ' other rows do, send row= for one of them' : matches.length ? '' : ' and no other row matches either') + '). Nothing deleted.',
             row: rowIn, actual: rowIn - 1 < values.length ? info(rowIn - 1) : null, candidates: cands } };
  }
  if (!matches.length) return { err: { error: 'not_found', message: 'No row matches that date + amount + ' + want.what + '. Nothing deleted.' } };
  if (matches.length > 1) return { err: { error: 'ambiguous', message: matches.length + ' rows match; send row= to pick one.', candidates: cands } };
  return { idx: matches[0], others: 0 };
}
/** Read `n` rows from sheet row r1: values + R1C1 formulas (so a formula that moves keeps pointing at the same relative cells). */
function apiDelRead_(sh, r1, n, lc) {
  var rg = sh.getRange(r1, 1, n, lc);
  return { v: rg.getValues(), f: rg.getFormulasR1C1() };
}
function apiDelWrite_(sh, r1, blk, lc) {
  var n = blk.v.length;
  if (!n) return;
  sh.getRange(r1, 1, n, lc).setValues(blk.v.map(function (row, i) { return row.map(function (x, j) { return blk.f[i][j] ? '' : x; }); }));
  for (var i = 0; i < n; i++) for (var j = 0; j < lc; j++) if (blk.f[i][j]) sh.getRange(r1 + i, 1 + j).setFormulaR1C1(blk.f[i][j]);
}
/** Number of #REF! cells on the given sheets (a delete must never add any). */
function apiDelRefErrs_(sheets) {
  var n = 0;
  sheets.forEach(function (s) {
    var lr = s.getLastRow(), lc = s.getLastColumn();
    if (!lr || !lc) return;
    s.getRange(1, 1, lr, lc).getValues().forEach(function (row) { row.forEach(function (x) { if (typeof x === 'string' && x.indexOf('#REF!') >= 0) n++; }); });
  });
  return n;
}
/** Other tabs whose formulas mention this tab's name (they may hold fixed ranges such as 'Daily Spend'!A2:A500). */
function apiDelRefSheets_(ss, sh) {
  var out = [], nm = sh.getName().toLowerCase();
  ss.getSheets().forEach(function (s) {
    if (s.getSheetId() === sh.getSheetId()) return;
    var sn = s.getName();
    if (sn === API_SPENDFIX_CFG.journalTab || / backup$/i.test(sn)) return;
    var lr = s.getLastRow(), lc = s.getLastColumn();
    if (!lr || !lc) return;
    var f = s.getRange(1, 1, lr, lc).getFormulas(), hit = false;
    for (var i = 0; i < f.length && !hit; i++) for (var j = 0; j < f[i].length; j++) if (f[i][j] && f[i][j].toLowerCase().indexOf(nm) >= 0) { hit = true; break; }
    if (hit) out.push(s);
  });
  return out;
}
/**
 * How ONE row is removed without breaking anything. Dated rows = rows whose date column parses; "tail" = anything non-empty below the last dated row (a Total row).
 *   clear  — it is the only dated row: its cells are cleared and the row stays (a SUM over a one-row range would become #REF!).
 *   delete — sh.deleteRow: used when a Total/tail row exists (Sheets shrinks the SUM range itself, so the total drops by exactly this row, no blank gap is left and the
 *            Total row is never touched) or when no other tab has formulas on this tab.
 *   shift  — another tab has formulas on this tab (e.g. Month Summary over 'Daily Spend'!A2:A500) and there is no Total row: nothing is deleted; the rows below move up one
 *            (values + relative formulas) and the last data row is cleared, so every fixed range elsewhere keeps its exact extent.
 */
function apiDelPlan_(ss, sh, values, col) {
  var dated = 0, lastDated = 0;
  for (var r = 1; r < values.length; r++) if (toKey_(values[r][col.date])) { dated++; lastDated = r; }
  var hasTotal = false;
  for (var t = lastDated + 1; t < values.length && !hasTotal; t++) for (var c = 0; c < values[t].length; c++) if (String(values[t][c] == null ? '' : values[t][c]).trim() !== '') { hasTotal = true; break; }
  var refs = [], scanFailed = false;
  try { refs = apiDelRefSheets_(ss, sh); } catch (e) { scanFailed = true; }
  var mode = dated <= 1 ? 'clear' : hasTotal ? 'delete' : (refs.length || scanFailed) ? 'shift' : 'delete';
  return { mode: mode, hasTotal: hasTotal, dated: dated, lastDated: lastDated, refSheets: refs, scanFailed: scanFailed };
}
/** Order-preserving fingerprint of the dated rows: used to prove the sheet ended up as "before minus the one row". */
function apiDelFingerprint_(values, col, skipIdx) {
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (r === skipIdx || !toKey_(values[r][col.date])) continue;
    var a = toNum_(values[r][col.amount]);
    out.push(toKey_(values[r][col.date]) + '|' + (a === null ? '' : round2_(a)) + '|' + loose_(values[r][col.label]));
  }
  return out;
}
/**
 * Shared delete engine. o = { act, tabName, cid, dry, out (response data, mutated), idx (0-based index into values), values, col,
 *   extra: optional function(undo, notes) run after the row is gone, inside the same all-or-nothing block (incomedel's prune_source) }.
 * Returns the final response object.
 */
function apiDelRun_(ss, sh, o) {
  var values = o.values, col = o.col, idx = o.idx, rowNum = idx + 1, out = o.out;
  var lc = Math.max(sh.getLastColumn(), 1);
  var plan = apiDelPlan_(ss, sh, values, col);
  out.mode = plan.mode; out.hasTotalRow = plan.hasTotal; out.datedRows = plan.dated;
  out.referencedByTabs = plan.refSheets.map(function (s) { return s.getName(); });
  if (o.dry) return { ok: true, data: out };

  var oldTxt = values[idx].map(apiDelShow_).join(' | ');
  var undo = [], notes = [];
  var totalsBefore = [], totalsAfter = [];
  try {
    apiTabBackup_(ss, sh);
    var rowBlk = apiDelRead_(sh, rowNum, 1, lc);
    var tailN = values.length - rowNum;                                   // rows below the target
    var tailF = tailN > 0 ? sh.getRange(rowNum + 1, 1, tailN, lc).getFormulas() : [];
    var errsBefore = apiDelRefErrs_([sh].concat(plan.refSheets));
    if (plan.hasTotal) {                                                  // remember what the Total row(s) said
      for (var i = 0; i < tailF.length; i++) for (var j = 0; j < tailF[i].length; j++) if (tailF[i][j] && rowNum + 1 + i > plan.lastDated + 1) totalsBefore.push(values[rowNum + i][j]);
    }
    if (plan.mode === 'delete') {
      var maxBefore = sh.getMaxRows();
      undo.push(function () {                                             // only if the row is really gone
        if (sh.getMaxRows() >= maxBefore) return;
        sh.insertRowBefore(rowNum);
        apiDelWrite_(sh, rowNum, rowBlk, lc);
        for (var a = 0; a < tailF.length; a++) for (var b = 0; b < tailF[a].length; b++) if (tailF[a][b]) sh.getRange(rowNum + 1 + a, 1 + b).setFormula(tailF[a][b]);
      });
      sh.deleteRow(rowNum);
    } else if (plan.mode === 'clear') {
      undo.push(function () { apiDelWrite_(sh, rowNum, rowBlk, lc); });
      sh.getRange(rowNum, 1, 1, lc).clearContent();
    } else {                                                              // shift
      var last1 = plan.lastDated + 1, n = last1 - rowNum;
      var blkAll = apiDelRead_(sh, rowNum, n + 1, lc);
      undo.push(function () { apiDelWrite_(sh, rowNum, blkAll, lc); });
      if (n > 0) apiDelWrite_(sh, rowNum, { v: blkAll.v.slice(1), f: blkAll.f.slice(1) }, lc);
      sh.getRange(last1, 1, 1, lc).clearContent();
    }
    if (o.extra) o.extra(undo, notes);
    SpreadsheetApp.flush();
    // verify: dated rows are now exactly "before minus the deleted one", and no #REF! appeared on this tab or any tab that reads it
    var after = sh.getDataRange().getValues();
    if (JSON.stringify(apiDelFingerprint_(after, col, -1)) !== JSON.stringify(apiDelFingerprint_(values, col, idx))) throw new Error('read-back mismatch after delete');
    if (apiDelRefErrs_([sh].concat(plan.refSheets)) > errsBefore) throw new Error('delete would leave #REF! errors in formulas');
    if (plan.hasTotal) {
      for (var i2 = 0; i2 < tailF.length; i2++) for (var j2 = 0; j2 < tailF[i2].length; j2++) if (tailF[i2][j2] && rowNum + 1 + i2 > plan.lastDated + 1) totalsAfter.push(after[rowNum + i2 - (plan.mode === 'delete' ? 1 : 0)][j2]);
      out.totals = { before: totalsBefore, after: totalsAfter };
    }
  } catch (werr) {
    var uerr = apiAdminUndo_(undo);
    apiSpendJournal_(ss, [new Date(), o.act, rowNum, o.tabName + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + o.cid + ')', '']);
    return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
  }
  if (notes.length) out.validation = notes;
  out.deletedOk = true;
  apiSpendJournal_(ss, [new Date(), o.act, rowNum, o.tabName + ': delete row (' + plan.mode + ')', oldTxt.substring(0, 480),
    '(deleted' + (plan.hasTotal ? '; totals ' + totalsBefore.join(',') + ' -> ' + totalsAfter.join(',') : '') + (notes.length ? '; ' + notes.join('; ') : '') + ')', o.cid]);
  return { ok: true, data: out };
}

/**
 * action=spenddel  (admin; GET params or POST body) — delete ONE row of the Daily Spend tab.
 *   date yyyy-mm-dd, amount, merchant (loose: case/punctuation-insensitive, either may contain the other) — required, they identify the row
 *   row  sheet row number (2+) from the `spend` read (items[].row). Verified against date + amount + merchant: if it does not match, the one row that does
 *        match is used when there is exactly one (rowCorrected:true), otherwise {error:'row_mismatch', actual:{row,date,amount,merchant,...}, candidates}.
 *        Without row: exactly one match is needed (not_found / ambiguous otherwise).
 *   cid  required when writing; the same cid is never applied twice (duplicate:'cid').   dry=1 previews (nothing written, nothing logged).
 * Response {ok:true,data:{deleted:{row,date,amount,merchant,who,category,method,notes,account,paidFrom}, mode, ...}}. mode (see apiDelPlan_): delete | shift | clear —
 * Month Summary style formulas on other tabs keep their exact ranges (shift) or are adjusted by Sheets (delete); #REF! is checked and rolled back.
 * The deleted row's values go in the "CC write log" (restorable by hand); the Daily Spend tab is backed up first (once a day).
 */
function apiSpendDel_(p) {
  p = p || {};
  var date = apiAdminDate_(p.date), amt = apiAdminAmount_(p.amount);
  var merchant = apiAdminClean_(p.merchant, 120), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  if (amt === null) return { error: 'bad_value', message: 'amount must be a number (dollars, up to 2 decimals).' };
  if (!merchant) return { error: 'bad_value', message: 'merchant is required.' };
  if (apiAdminHasAcctNo_(merchant)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var rowIn = 0;
  if (p.row !== undefined && p.row !== null && String(p.row).trim() !== '') {
    rowIn = Number(p.row);
    if (!(rowIn >= 2) || rowIn !== Math.floor(rowIn)) return { error: 'bad_value', message: 'row must be a sheet row number (2 or more).' };
  }
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var cfg = CONFIG.SPEND, ss = SpreadsheetApp.openById(cfg.SHEET_ID), sh = ss.getSheetByName(cfg.TAB);
    if (!sh) return { error: 'no_tab', message: 'Daily Spend tab not found.' };
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'Daily Spend needs a header row.' };
    var spec = {}; Object.keys(cfg.HEADERS).forEach(function (k) { spec[k] = cfg.HEADERS[k]; });
    spec.account = ['account']; spec.paid = API_PAID_HEADS;
    var c = mapHeaders_(values[0], spec);
    if (c.date < 0 || c.amount < 0 || c.merchant < 0) return { error: 'no_columns', message: 'Date, Amount and Merchant columns are required.' };
    var col = { date: c.date, amount: c.amount, label: c.merchant };
    var info = function (i) {
      var v = values[i], g = function (k) { return c[k] >= 0 ? apiDelShow_(v[c[k]]) : ''; }, a = toNum_(v[c.amount]);
      return { row: i + 1, date: toKey_(v[c.date]), amount: a === null ? null : round2_(a), merchant: g('merchant'), who: g('who'), category: g('category'),
               method: g('method'), notes: g('notes'), account: g('account'), paidFrom: g('paid') };
    };
    var out = { tab: sh.getName(), dry: dry, cid: cid };
    if (apiAdminSeenCid_(ss, 'spenddel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var f = apiDelFind_(values, col, { date: date, amt: amt, label: merchant, what: 'merchant' }, rowIn, info);
    if (f.err) return f.err;
    out.row = f.idx + 1;
    out.deleted = info(f.idx);
    if (f.corrected) { out.rowCorrected = true; out.requestedRow = f.requestedRow; }
    if (f.others) out.otherMatchingRows = f.others;
    return apiDelRun_(ss, sh, { act: 'spenddel', tabName: 'Daily Spend', cid: cid, dry: dry, out: out, idx: f.idx, values: values, col: col });
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=incomedel  (admin; GET params or POST body) — delete ONE row of the Income tab, the Land & Structure Pay tab or the Personal Training tab.
 *   tab    income | ls | pt (required)
 *   date   yyyy-mm-dd (the Week ending / Date cell)      amount  dollars
 *   label  Source (income) / Description (ls) / Client (pt); loose match like spenddel. source=, description= and client= are accepted as aliases.
 *   row    sheet row number (2+); verified against date + amount + label exactly like spenddel (row_mismatch / rowCorrected).
 *   cid    required when writing (duplicate:'cid' on a repeat)     dry=1 previews
 *   prune_source=1  (tab=income only) after the delete, if no other Income row uses that exact Source text and it is not protected (API_INCOME_PROTECTED),
 *          the value is removed from the Source column's dropdown list(s) — the reverse of what incomeadd (v29) does for a new Source. The list change is part of the
 *          same all-or-nothing step (a failure restores the list and the row). Response data.prune says what happened / why not.
 * Total row: never matched (it has no date) and never deleted; sh.deleteRow shrinks the SUM range by exactly this row, so the total drops by the amount and no blank row is left.
 * Response {ok:true,data:{deleted:{tab,row,date,amount,label,method,notes}, mode, totals:{before,after}, prune?}}.
 */
/**
 * v46 action=incomefix (GET params or POST body): change the Category and/or Notes of ONE row of the Income / Personal Training /
 * Land & Structure Pay tab. The row is found like incomedel: date + amount + label (Source / Client / Description), row= must be that row.
 *   tab        income | pt | ls          row  1-based sheet row      date yyyy-mm-dd      amount  dollars      label  Source / Client / Description
 *   category   optional; written to the tab's "Category" column (created right of the last header the first time)
 *   notes      optional, max 300; notes_mode=set replaces (may be ''), otherwise appended with " | " unless already there
 *   cid        required when writing (same cid never applied twice)     dry=1  preview only
 * Backup tab + "CC write log" like every other write. Nothing else in the row is touched.
 */
function apiIncomeFix_(p) {
  p = p || {};
  var tabKey = String(p.tab || '').toLowerCase();
  if (tabKey !== 'income' && tabKey !== 'ls' && tabKey !== 'pt') return { error: 'bad_value', message: 'tab must be income, ls or pt.' };
  var date = apiAdminDate_(p.date), amt = apiAdminAmount_(p.amount);
  var label = apiAdminClean_(p.label, 80) || apiAdminClean_(p.source, 80) || apiAdminClean_(p.client, 80) || apiAdminClean_(p.description, 80);
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), setNotes = String(p.notes_mode || '').toLowerCase() === 'set';
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  if (amt === null) return { error: 'bad_value', message: 'amount must be a number (dollars, up to 2 decimals).' };
  if (!label) return { error: 'bad_value', message: 'label is required (Source / Description / Client).' };
  var rowIn = Number(p.row);
  if (!(rowIn >= 2) || rowIn !== Math.floor(rowIn)) return { error: 'bad_value', message: 'row must be a sheet row number (2 or more).' };
  var want = {};
  if (p.category != null && apiCatClean_(p.category)) want.category = apiCatClean_(p.category);
  if (p.method != null) want.method = apiAdminClean_(p.method, 30);   // v47: '' clears it
  if (p.notes != null && (setNotes || String(p.notes).trim() !== '')) {
    if (String(p.notes).length > 300) return { error: 'too_long', message: 'notes max 300 characters.' };
    want.notes = apiAdminClean_(p.notes, 300);
  }
  if (!Object.keys(want).length) return { error: 'bad_value', message: 'Nothing to change: send category, method and/or notes.' };
  if (apiAdminHasAcctNo_((want.notes || '') + ' ' + (want.category || ''))) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  if (apiAcctExcluded_((want.notes || '') + ' ' + (want.category || ''))) return { error: 'excluded', message: 'Sierra Consultants is deliberately not kept in the Command Center.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), tabConst = apiIncomeTabName_(tabKey), sh = ss.getSheetByName(tabConst);
    if (!sh) return { error: 'no_tab', message: tabConst + ' tab not found.' };
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'Tab has no header row.' };
    var col = apiIncomeCols_(tabKey, values[0]);
    if (col.date < 0 || col.label < 0 || col.amount < 0) return { error: 'no_columns', message: 'Date, ' + (tabKey === 'income' ? 'Source' : tabKey === 'pt' ? 'Client' : 'Description') + ' and Amount columns are required.' };
    if (want.notes !== undefined && col.notes < 0) return { error: 'no_columns', message: 'That tab has no Notes column.' };
    var out = { tab: sh.getName(), tabKey: tabKey, dry: dry, cid: cid, changes: [] };
    if (apiAdminSeenCid_(ss, 'incomefix', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var info = function (i) { var v = values[i], a = toNum_(v[col.amount]); return { row: i + 1, date: toKey_(v[col.date]), amount: a === null ? null : round2_(a), label: apiDelShow_(v[col.label]) }; };
    var f = apiDelFind_(values, col, { date: date, amt: amt, label: label, what: tabKey === 'income' ? 'source' : tabKey === 'pt' ? 'client' : 'description' }, rowIn, info);
    if (f.err) { if (f.err.message) f.err.message = f.err.message.replace(/to delete/g, 'to change').replace(/Nothing deleted\./g, 'Nothing changed.'); return f.err; }
    if (f.corrected) return { error: 'row_mismatch', message: 'Row ' + rowIn + ' is not that entry any more (it moved). Refresh and try again. Nothing changed.' };
    var r0 = f.idx, rowNum = r0 + 1, str = function (c) { return c >= 0 ? String(values[r0][c] == null ? '' : values[r0][c]).trim() : ''; };
    var curNotes = str(col.notes), curCat = str(col.category);
    if (want.category !== undefined && want.category !== curCat) out.changes.push({ field: 'Category', before: curCat, after: want.category });
    var curPay = str(col.method);
    if (want.method !== undefined && want.method !== curPay) out.changes.push({ field: 'Payment type', before: curPay, after: want.method });
    if (want.notes !== undefined) {
      var after = setNotes ? want.notes : (norm_(curNotes).indexOf(norm_(want.notes)) >= 0 ? curNotes : (curNotes ? curNotes + ' | ' : '') + want.notes);
      if (after !== curNotes) out.changes.push({ field: 'Notes', before: curNotes, after: after });
    }
    out.row = rowNum; out.unchanged = !out.changes.length;
    if (col.category < 0 && want.category !== undefined) out.categoryColumn = dry ? 'would_create' : 'created';
    if (dry || !out.changes.length) return { ok: true, data: out };

    apiTabBackup_(ss, sh);
    var catIdx = col.category;
    if (catIdx < 0 && out.changes.some(function (c) { return c.field === 'Category'; })) {
      var cc = apiIncomeCatCol_(sh, tabKey); catIdx = cc.col;
      if (cc.created) apiSpendJournal_(ss, [new Date(), 'incomefix', 1, sh.getName() + ': header', '', 'Category (column ' + apiColLetter_(cc.col + 1) + ')', '']);
    }
    var payIdx = col.method;
    if (payIdx < 0 && out.changes.some(function (c) { return c.field === 'Payment type'; })) {
      var pc2 = apiIncomePayCol_(sh, tabKey); payIdx = pc2.col;
      if (pc2.created) apiSpendJournal_(ss, [new Date(), 'incomefix', 1, sh.getName() + ': header', '', 'Payment type (column ' + apiColLetter_(pc2.col + 1) + ')', '']);
    }
    var vnotes = [];
    out.changes.forEach(function (c) {
      apiAdminSetCell_(sh, rowNum, c.field === 'Category' ? catIdx : c.field === 'Payment type' ? payIdx : col.notes, c.after, true, vnotes);
      apiSpendJournal_(ss, [new Date(), 'incomefix', rowNum, sh.getName() + ': ' + c.field, c.before, c.after, cid]);
    });
    SpreadsheetApp.flush();
    if (vnotes.length) out.validation = vnotes;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

function apiIncomeDel_(p) {
  p = p || {};
  var tabKey = String(p.tab || '').toLowerCase();
  if (tabKey !== 'income' && tabKey !== 'ls' && tabKey !== 'pt') return { error: 'bad_value', message: 'tab must be income, ls or pt.' };
  var date = apiAdminDate_(p.date), amt = apiAdminAmount_(p.amount);
  var label = apiAdminClean_(p.label, 80) || apiAdminClean_(tabKey === 'income' ? p.source : tabKey === 'pt' ? p.client : p.description, 80) ||
              apiAdminClean_(p.source, 80) || apiAdminClean_(p.client, 80) || apiAdminClean_(p.description, 80);
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), prune = apiAdminBool_(p.prune_source);
  if (!date) return { error: 'bad_value', message: 'date must be yyyy-mm-dd.' };
  if (amt === null) return { error: 'bad_value', message: 'amount must be a number (dollars, up to 2 decimals).' };
  if (!label) return { error: 'bad_value', message: 'label is required (Source / Description / Client).' };
  if (apiAdminHasAcctNo_(label)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var rowIn = 0;
  if (p.row !== undefined && p.row !== null && String(p.row).trim() !== '') {
    rowIn = Number(p.row);
    if (!(rowIn >= 2) || rowIn !== Math.floor(rowIn)) return { error: 'bad_value', message: 'row must be a sheet row number (2 or more).' };
  }
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), tabConst = apiIncomeTabName_(tabKey), sh = ss.getSheetByName(tabConst);
    if (!sh) return { error: 'no_tab', message: tabConst + ' tab not found.' };
    var values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'no_columns', message: 'Tab has no header row.' };
    var col = apiIncomeCols_(tabKey, values[0]);
    if (col.date < 0 || col.label < 0 || col.amount < 0) return { error: 'no_columns', message: 'Date, ' + (tabKey === 'income' ? 'Source' : tabKey === 'pt' ? 'Client' : 'Description') + ' and Amount columns are required.' };
    var info = function (i) {
      var v = values[i], a = toNum_(v[col.amount]);
      return { tab: tabKey, row: i + 1, date: toKey_(v[col.date]), amount: a === null ? null : round2_(a), label: apiDelShow_(v[col.label]),
               method: col.method >= 0 ? apiDelShow_(v[col.method]) : '', notes: col.notes >= 0 ? apiDelShow_(v[col.notes]) : '' };
    };
    var out = { tab: sh.getName(), tabKey: tabKey, dry: dry, cid: cid };
    if (apiAdminSeenCid_(ss, 'incomedel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var f = apiDelFind_(values, col, { date: date, amt: amt, label: label, what: tabKey === 'income' ? 'source' : tabKey === 'pt' ? 'client' : 'description' }, rowIn, info);
    if (f.err) return f.err;
    out.row = f.idx + 1;
    out.deleted = info(f.idx);
    if (f.corrected) { out.rowCorrected = true; out.requestedRow = f.requestedRow; }
    if (f.others) out.otherMatchingRows = f.others;

    // prune_source: decide (read-only) whether the Source leaves the dropdown list
    var src = String(values[f.idx][col.label] == null ? '' : values[f.idx][col.label]).trim(), doPrune = false;
    if (prune) {
      var pr = out.prune = { requested: true, source: apiDelShow_(src), removed: false };
      if (tabKey !== 'income') pr.reason = 'prune_source only applies to tab=income';
      else if (!src) pr.reason = 'empty_source';
      else if (API_INCOME_PROTECTED.some(function (x) { return loose_(x) === loose_(src); })) pr.reason = 'protected';
      else {
        var used = false;
        for (var r = 1; r < values.length; r++) if (r !== f.idx && String(values[r][col.label] == null ? '' : values[r][col.label]).trim() === src) { used = true; break; }
        if (used) pr.reason = 'still_used_by_other_row';
        else if (apiIncomeKnownSources_(sh, [], col.label).indexOf(src) < 0) pr.reason = 'not_in_list';
        else { doPrune = true; pr.willRemove = true; pr.reason = dry ? 'would_remove_from_list' : ''; }
      }
    }
    var extra = null;
    if (doPrune) {
      extra = function (undo, notes) {
        var C = SpreadsheetApp.DataValidationCriteria, maxR = sh.getMaxRows();
        if (maxR < 2) { out.prune.reason = 'no_list'; return; }
        var rng = sh.getRange(2, col.label + 1, maxR - 1, 1), dvs = rng.getDataValidations(), orig = dvs.map(function (r) { return [r[0]]; }), changed = 0, cache = {};
        for (var i = 0; i < dvs.length; i++) {
          var d = dvs[i][0];
          if (!d || d.getCriteriaType() !== C.VALUE_IN_LIST) continue;
          var args = d.getCriteriaValues(), list = (args[0] || []).map(String);
          if (list.indexOf(src) < 0) continue;
          var nl = list.filter(function (x) { return x !== src; });
          if (!nl.length) continue;                                       // never leave an empty list
          var key = list.join('\u0001');
          if (!cache[key]) cache[key] = d.copy().requireValueInList(nl, args.length > 1 ? args[1] !== false : true).build();
          dvs[i][0] = cache[key]; changed++;
        }
        if (!changed) { out.prune.reason = 'not_in_list'; return; }
        undo.push(function () { rng.setDataValidations(orig); });
        rng.setDataValidations(dvs);
        out.prune.removed = true; out.prune.cells = changed;
        notes.push('Source list -' + src);
      };
    }
    return apiDelRun_(ss, sh, { act: 'incomedel', tabName: sh.getName(), cid: cid, dry: dry, out: out, idx: f.idx, values: values, col: col, extra: extra });
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* v36 — Lisa's Table "Wish List": `wishlist` (read), `wishadd`, `wishset`, */
/* `wishdel` (admin writes).                                                */
/*   Storage: a Google Sheet named "Wish List" inside the Lisa's Table      */
/*   Drive folder, created lazily by the first real write (never by a read  */
/*   and never by dry=1). Its id is kept in Script Property CC_WISH_SHEET_ID;*/
/*   when the property is unset the folder is searched for an existing      */
/*   "Wish List" spreadsheet before anything is created.                    */
/*   Header: Added | Item | Notes | Status | Added by | Done on | Id        */
/*   Same conventions as incomeadd / spenddel: passcode (the dispatcher),   */
/*   cid idempotency (apiAdminSeenCid_ on the "CC write log" tab of the     */
/*   Daily Spend sheet, which is also where every write is journaled via    */
/*   apiSpendJournal_), dry=1 previews and writes nothing, script lock,     */
/*   read-back verify + undo (write_failed / rolledBack), values-only tab   */
/*   backup before a delete (apiTabBackup_), no account numbers (input      */
/*   rejected), max lengths. The sheet has no totals, so wishdel uses       */
/*   sh.deleteRow after verifying id + item text.                           */
/* ======================================================================= */
var API_WISH = {
  name: 'Wish List',
  folderId: '1k7yFqwv3KQcmUxI-neeVKkZl7mqqCvXR',   // Lisa's Table folder (Code.gs)
  prop: 'CC_WISH_SHEET_ID',
  head: ['Added', 'Item', 'Notes', 'Status', 'Added by', 'Done on', 'Id'],
  maxItems: 30, maxItem: 200, maxNotes: 300, maxId: 80,
  sheetMime: 'application/vnd.google-apps.spreadsheet'
};

/** Header -> 0-based column map (-1 = missing). */
function apiWishCols_(headRow) {
  return mapHeaders_(headRow, { added: ['added', 'date added'], item: ['item', 'wish', 'request'], notes: ['notes', 'note'], status: ['status'],
                                by: ['added by', 'by'], doneOn: ['done on', 'done', 'date done'], id: ['id'] });
}
/** A cell as safe display text (control chars removed, account-number-looking text masked). */
function apiWishShow_(v, max) {
  var s = v instanceof Date ? toKey_(v) : String(v == null ? '' : v);
  s = s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return apiAdminHasAcctNo_(s) ? '[redacted]' : s.substring(0, max || API_WISH.maxNotes);
}
function apiWishKey_(s) { return loose_(s) || norm_(s); }
function apiWishStatus_(v) { return /^\s*(done|complete|completed|finished|yes|x|\u2713|\u2714)\s*$/i.test(String(v == null ? '' : v)) ? 'done' : 'open'; }
function apiWishBy_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  return t === '' ? '' : t === 'lisa' ? 'Lisa' : t === 'zac' ? 'Zac' : null;
}
function apiWishNewId_(taken) {
  var id;
  do { id = 'w' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); } while (taken[id]);
  taken[id] = true;
  return id;
}
/** Display object for values[i] (0-based index; row = i + 1). A row typed by hand without an Id gets the stable-while-unchanged id "row<N>". */
function apiWishInfo_(values, col, i) {
  var v = values[i], g = function (k, max) { return col[k] >= 0 ? apiWishShow_(v[col[k]], max) : ''; };
  var id = g('id', API_WISH.maxId), added = col.added >= 0 ? v[col.added] : '';
  var o = { id: id || ('row' + (i + 1)), row: i + 1, added: toKey_(added), item: g('item', API_WISH.maxItem), notes: g('notes', API_WISH.maxNotes),
            status: apiWishStatus_(col.status >= 0 ? v[col.status] : ''), by: g('by', 20), doneOn: col.doneOn >= 0 ? toKey_(v[col.doneOn]) : '' };
  if (added instanceof Date && !isNaN(added)) o.addedAt = added.toISOString();
  return o;
}
/** Index of the data row with this id (exact Id cell; or "row<N>" for a hand-typed row without an Id), or -1. */
function apiWishFindRow_(values, col, id) {
  id = String(id == null ? '' : id).trim();
  if (!id) return -1;
  var m = id.match(/^row(\d+)$/);
  for (var r = 1; r < values.length; r++) {
    var cell = String(values[r][col.id] == null ? '' : values[r][col.id]).trim();
    if (cell && cell === id) return r;
  }
  if (m) {
    var r2 = Number(m[1]) - 1;
    if (r2 >= 1 && r2 < values.length && !String(values[r2][col.id] == null ? '' : values[r2][col.id]).trim() && String(values[r2][col.item] == null ? '' : values[r2][col.item]).trim()) return r2;
  }
  return -1;
}
/** Rows that hold a wish (non-empty Item). */
function apiWishDataRows_(values, col) {
  var out = [];
  for (var r = 1; r < values.length; r++) if (String(values[r][col.item] == null ? '' : values[r][col.item]).trim() !== '') out.push(r);
  return out;
}

/**
 * Locate the Wish List spreadsheet. create=false (reads, dry runs): never creates or stores anything; returns {none:true} when there is none yet.
 * create=true (real writes, call under the script lock): creates + files it in the Lisa's Table folder when it does not exist, stores its id in CC_WISH_SHEET_ID.
 * Returns {ss, sh, created, note} or {none:true} or {error...}.
 */
function apiWishSheet_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(API_WISH.prop), ss = null, created = false, note = '';
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) {
      return { error: 'wish_sheet_unavailable', message: 'The Wish List sheet (CC_WISH_SHEET_ID) cannot be opened: ' + String(e && e.message || e).substring(0, 160) + '. Nothing was created.' };
    }
  } else {
    var found = null, it = DriveApp.getFolderById(API_WISH.folderId).getFilesByName(API_WISH.name);
    while (it.hasNext()) {
      var f = it.next();
      if (f.getMimeType() === API_WISH.sheetMime && !(f.isTrashed && f.isTrashed())) { found = f; break; }
    }
    if (found) {
      ss = SpreadsheetApp.openById(found.getId());
      if (create) props.setProperty(API_WISH.prop, found.getId());
    } else if (create) {
      ss = SpreadsheetApp.create(API_WISH.name);
      props.setProperty(API_WISH.prop, ss.getId());                      // remember it first so a later failure can never create a second one
      created = true;
      try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(API_WISH.folderId)); }
      catch (e2) { note = 'created but could not be moved into the Lisa\'s Table folder: ' + String(e2 && e2.message || e2).substring(0, 160); }
    } else return { none: true };
  }
  var sh = ss.getSheetByName(API_WISH.name) || ss.getSheets()[0];
  if (create && sh) {
    if (sh.getLastRow() === 0) {                                          // brand-new (or empty) sheet: header row
      sh.getRange(1, 1, 1, API_WISH.head.length).setValues([API_WISH.head]);
      try { if (sh.getName() !== API_WISH.name && created) sh.setName(API_WISH.name); sh.setFrozenRows(1); sh.getRange(1, 1, 1, API_WISH.head.length).setFontWeight('bold'); sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 260); } catch (e3) { /* cosmetic only */ }
    }
  }
  return { ss: ss, sh: sh, created: created, note: note };
}

/**
 * action=wishlist  (read-only; creates nothing)
 * Response {ok:true,data:{exists, items:[{id,row,added,addedAt?,item,notes,status:'open'|'done',by,doneOn}], open:N, done:N, sheetUrl}}
 *   open items first (newest first), then done items (most recently done first). added / doneOn are yyyy-mm-dd ('' when blank). No sheet yet -> exists:false, items:[], sheetUrl:''.
 */
function apiWishList_() {
  var w = apiWishSheet_(false);
  if (w.error) return w;
  if (w.none || !w.sh) return { ok: true, data: { exists: false, items: [], open: 0, done: 0, sheetUrl: '' } };
  var values = w.sh.getDataRange().getValues(), url = '';
  try { url = w.ss.getUrl(); } catch (e) { url = ''; }
  if (!values.length) return { ok: true, data: { exists: true, items: [], open: 0, done: 0, sheetUrl: url } };
  var col = apiWishCols_(values[0]);
  if (col.item < 0 || col.status < 0 || col.id < 0) return { error: 'no_columns', message: 'Wish List needs Item, Status and Id columns.' };
  var open = [], done = [];
  apiWishDataRows_(values, col).forEach(function (r) { var o = apiWishInfo_(values, col, r); (o.status === 'done' ? done : open).push(o); });
  open.sort(function (a, b) { return b.row - a.row; });                  // newest (lowest in the sheet) first
  done.sort(function (a, b) { return a.doneOn === b.doneOn ? b.row - a.row : (a.doneOn < b.doneOn ? 1 : -1); });
  return { ok: true, data: { exists: true, items: open.concat(done), open: open.length, done: done.length, sheetUrl: url } };
}

/** items= JSON array string (or a real array from a POST body) of strings (or {item,notes} objects), or item= single; notes= default notes. Returns {list:[{item,notes}]} or {err}. */
function apiWishItems_(p) {
  var raw = (p.items !== undefined && p.items !== null && String(p.items) !== '') ? p.items : p.item, arr;
  if (Array.isArray(raw)) arr = raw;
  else {
    var t = String(raw == null ? '' : raw).trim();
    if (t.charAt(0) === '[') { try { arr = JSON.parse(t); } catch (e) { return { err: { error: 'bad_value', message: 'items must be a JSON array of strings.' } }; } if (!Array.isArray(arr)) return { err: { error: 'bad_value', message: 'items must be a JSON array of strings.' } }; }
    else arr = t ? [t] : [];
  }
  var notesAll = apiAdminClean_(p.notes, API_WISH.maxNotes + 1);
  if (notesAll.length > API_WISH.maxNotes) return { err: { error: 'too_long', message: 'notes can be at most ' + API_WISH.maxNotes + ' characters.' } };
  var list = [];
  for (var i = 0; i < arr.length; i++) {
    var x = arr[i], it, nt = notesAll;
    if (x && typeof x === 'object') { it = x.item != null ? x.item : x.text != null ? x.text : x.name; if (x.notes != null) nt = apiAdminClean_(x.notes, API_WISH.maxNotes + 1); }
    else it = x;
    if (it !== null && typeof it === 'object') return { err: { error: 'bad_value', message: 'items must be strings.' } };
    it = apiAdminClean_(it, 5000);
    if (!it) continue;
    if (it.length > API_WISH.maxItem) return { err: { error: 'too_long', message: 'Item ' + (i + 1) + ' is longer than ' + API_WISH.maxItem + ' characters. Nothing added.', index: i } };
    if (nt.length > API_WISH.maxNotes) return { err: { error: 'too_long', message: 'Notes for item ' + (i + 1) + ' are longer than ' + API_WISH.maxNotes + ' characters. Nothing added.', index: i } };
    if (apiAdminHasAcctNo_(it) || apiAdminHasAcctNo_(nt)) return { err: { error: 'no_account_numbers', message: 'Do not send account numbers.' } };
    list.push({ item: it, notes: nt });
  }
  if (!list.length) return { err: { error: 'bad_value', message: 'items (JSON array of strings) or item is required.' } };
  if (list.length > API_WISH.maxItems) return { err: { error: 'too_many', message: 'At most ' + API_WISH.maxItems + ' items per call (got ' + list.length + '). Nothing added.' } };
  return { list: list };
}

/**
 * action=wishadd  (admin; GET params or POST body)
 *   items  JSON array of strings (<=30, each <=200 chars; {item,notes} objects also accepted)   — or —   item  one string      notes  optional (<=300), applied to every item without its own
 *   by     'Lisa' | 'Zac' | '' (default '')     cid  required when writing     dry=1 previews (nothing written, nothing created)
 * An item whose loose text (case/punctuation/spacing ignored) equals an existing OPEN item (or an earlier item in the same call) is skipped, not added.
 * Response {ok:true,data:{added:[{id,row,added,item,notes,status:'open',by,doneOn}], skipped:[{item,reason:'duplicate'|'duplicate_in_call',id?,row?}], createdSheet, sheetUrl, dry, cid}}
 *   same cid again -> {ok:true,data:{duplicate:'cid',...}} and nothing is written.
 */
function apiWishAdd_(p) {
  p = p || {};
  var it = apiWishItems_(p);
  if (it.err) return it.err;
  var by = apiWishBy_(p.by);
  if (by === null) return { error: 'bad_value', message: "by must be 'Lisa', 'Zac' or empty." };
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);             // the "CC write log" lives here (cid idempotency + journal)
    var out = { dry: dry, cid: cid, added: [], skipped: [] };
    if (apiAdminSeenCid_(jss, 'wishadd', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiWishSheet_(false);
    if (w.error) return w;
    var values = (!w.none && w.sh) ? w.sh.getDataRange().getValues() : [], col = null, openKeys = {}, taken = {};
    if (values.length) {
      col = apiWishCols_(values[0]);
      if (col.item < 0 || col.status < 0 || col.id < 0) return { error: 'no_columns', message: 'Wish List needs Item, Status and Id columns.' };
      apiWishDataRows_(values, col).forEach(function (r) {
        var o = apiWishInfo_(values, col, r);
        taken[o.id] = true;
        if (o.status === 'open') { var k = apiWishKey_(o.item); if (!openKeys[k]) openKeys[k] = o; }
      });
    }
    var todo = [], seen = {};
    it.list.forEach(function (x) {
      var k = apiWishKey_(x.item);
      if (openKeys[k]) out.skipped.push({ item: x.item, reason: 'duplicate', id: openKeys[k].id, row: openKeys[k].row });
      else if (seen[k]) out.skipped.push({ item: x.item, reason: 'duplicate_in_call' });
      else { seen[k] = true; todo.push(x); }
    });
    var now = new Date(), today = todayKey_();
    var mk = function (x, row) { return { id: apiWishNewId_(taken), row: row, added: today, addedAt: now.toISOString(), item: x.item, notes: x.notes, status: 'open', by: by, doneOn: '' }; };
    var nextRow = Math.max(w.none || !w.sh ? 1 : w.sh.getLastRow(), 1) + 1;
    if (dry || !todo.length) {
      out.added = todo.map(function (x, i) { return mk(x, nextRow + i); });
      if (dry) { out.wouldCreateSheet = !!w.none; }
      out.createdSheet = false; out.sheetUrl = '';
      try { if (w.ss) out.sheetUrl = w.ss.getUrl(); } catch (e0) { /* ignore */ }
      return { ok: true, data: out };
    }

    var created = false, sh = null, start = 0, undo = [];
    try {
      var ws = apiWishSheet_(true);                                       // creates + files the sheet on the first write
      if (ws.error) return ws;
      sh = ws.sh; created = ws.created; if (ws.note) out.sheetNote = ws.note;
      var hv = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
      col = apiWishCols_(hv);
      if (col.item < 0 || col.status < 0 || col.id < 0) return { error: 'no_columns', message: 'Wish List needs Item, Status and Id columns.' };
      var width = Math.max(sh.getLastColumn(), hv.length, 1);
      start = Math.max(sh.getLastRow(), 1) + 1;
      var rows = [], added = [];
      todo.forEach(function (x, i) {
        var o = mk(x, start + i), row = [];
        for (var c = 0; c < width; c++) row.push('');
        if (col.added >= 0) row[col.added] = now;
        row[col.item] = o.item;
        if (col.notes >= 0) row[col.notes] = o.notes;
        row[col.status] = 'open';
        if (col.by >= 0) row[col.by] = o.by;
        row[col.id] = o.id;
        rows.push(row); added.push(o);
      });
      undo.push(function () { sh.getRange(start, 1, rows.length, width).clearContent(); });
      ['item', 'notes', 'status', 'by', 'id'].forEach(function (k) { if (col[k] >= 0) sh.getRange(start, col[k] + 1, rows.length, 1).setNumberFormat('@'); });   // text, never a formula
      if (col.added >= 0) sh.getRange(start, col.added + 1, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm');
      sh.getRange(start, 1, rows.length, width).setValues(rows);
      SpreadsheetApp.flush();
      var back = sh.getRange(start, 1, rows.length, width).getValues();
      for (var i2 = 0; i2 < rows.length; i2++) {
        if (String(back[i2][col.id]) !== added[i2].id || String(back[i2][col.item]) !== added[i2].item) throw new Error('read-back mismatch after add');
      }
      apiSpendJournal_(jss, [new Date(), 'wishadd', start, API_WISH.name + ': add ' + added.length + ' item(s)' + (by ? ' by ' + by : ''), '',
        added.map(function (o) { return o.item + (o.notes ? ' (' + o.notes + ')' : ''); }).join(' ; ').substring(0, 480) + (out.skipped.length ? ' [skipped ' + out.skipped.length + ' dup]' : ''), cid]);
      out.added = added;
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'wishadd', start, API_WISH.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows removed') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.createdSheet = created;
    try { out.sheetUrl = sh.getParent().getUrl(); } catch (e4) { out.sheetUrl = ''; }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=wishset  (admin; GET params or POST body) — mark ONE wish done / open (sets Status and Done on).
 *   id      the wish id (from wishlist)     status  'open' | 'done'  (omitted = toggle to the opposite of the current status)
 *   cid     required when writing           dry=1 previews
 * done -> Status 'done', Done on = today (yyyy-mm-dd, PT);  open -> Status 'open', Done on cleared. Already in that status -> ok, unchanged:true, nothing written.
 * Response {ok:true,data:{item:{id,row,added,item,notes,status,by,doneOn} (the row AFTER the change), previous:{status,doneOn}, unchanged?, dry, cid}}
 */
function apiWishSet_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_WISH.maxId), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var st = String(p.status == null ? '' : p.status).trim().toLowerCase();
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  if (st !== '' && st !== 'open' && st !== 'done') return { error: 'bad_value', message: "status must be 'open' or 'done'." };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'wishset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiWishSheet_(false);
    if (w.error) return w;
    if (w.none || !w.sh) return { error: 'not_found', message: 'There is no Wish List yet.' };
    var sh = w.sh, values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'not_found', message: 'Wish List is empty.' };
    var col = apiWishCols_(values[0]);
    if (col.item < 0 || col.status < 0 || col.id < 0) return { error: 'no_columns', message: 'Wish List needs Item, Status and Id columns.' };
    var idx = apiWishFindRow_(values, col, id);
    if (idx < 0) return { error: 'not_found', message: 'No wish with that id. Nothing changed.' };
    var before = apiWishInfo_(values, col, idx), want = st || (before.status === 'done' ? 'open' : 'done');
    out.previous = { status: before.status, doneOn: before.doneOn };
    if (before.status === want) { out.unchanged = true; out.item = before; return { ok: true, data: out }; }
    var today = todayKey_(), rowNum = idx + 1;
    out.item = apiWishInfo_(values, col, idx); out.item.status = want; out.item.doneOn = want === 'done' ? today : '';
    if (dry) return { ok: true, data: out };

    var undo = [], oldStatus = values[idx][col.status], oldDone = col.doneOn >= 0 ? values[idx][col.doneOn] : '';
    try {
      undo.push(function () { sh.getRange(rowNum, col.status + 1).setValue(oldStatus); if (col.doneOn >= 0) sh.getRange(rowNum, col.doneOn + 1).setValue(oldDone); });
      sh.getRange(rowNum, col.status + 1).setNumberFormat('@');
      sh.getRange(rowNum, col.status + 1).setValue(want);
      if (col.doneOn >= 0) { sh.getRange(rowNum, col.doneOn + 1).setNumberFormat('yyyy-mm-dd'); sh.getRange(rowNum, col.doneOn + 1).setValue(want === 'done' ? keyToDate_(today) : ''); }
      SpreadsheetApp.flush();
      var back = sh.getRange(rowNum, 1, 1, values[0].length).getValues()[0];
      if (apiWishStatus_(back[col.status]) !== want || String(back[col.item]) !== String(values[idx][col.item]) || (col.doneOn >= 0 && toKey_(back[col.doneOn]) !== (want === 'done' ? today : ''))) throw new Error('read-back mismatch after status change');
      apiSpendJournal_(jss, [new Date(), 'wishset', rowNum, API_WISH.name + ': ' + before.item.substring(0, 60), before.status + (before.doneOn ? ' ' + before.doneOn : ''), want + (want === 'done' ? ' ' + today : ''), cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'wishset', rowNum, API_WISH.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/** Order-preserving fingerprint of the wish rows: used to prove the sheet ended up as "before minus the one row". */
function apiWishFingerprint_(values, col, skipIdx) {
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (r === skipIdx) continue;
    var it = String(values[r][col.item] == null ? '' : values[r][col.item]).trim(), id = String(values[r][col.id] == null ? '' : values[r][col.id]).trim();
    if (!it && !id) continue;
    out.push(id + '|' + loose_(it) + '|' + apiWishStatus_(values[r][col.status]));
  }
  return out;
}

/**
 * action=wishdel  (admin; GET params or POST body) — delete ONE wish row.
 *   id    the wish id (from wishlist)     item  the item text, REQUIRED as verification (loose match: case/punctuation ignored, either may contain the other)
 *   cid   required when writing           dry=1 previews
 * Verify, then delete: the row is found by id; if its Item does not loosely match `item` -> error row_mismatch (with the actual row) and nothing is deleted.
 * Values-only backup tab ("Wish List backup", first delete of the day) then sh.deleteRow (no totals on this sheet); read-back must equal "before minus that row" or the row is put back (write_failed).
 * Response {ok:true,data:{deleted:{id,row,added,item,notes,status,by,doneOn}, deletedOk:true, dry, cid}}
 */
function apiWishDel_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_WISH.maxId), item = apiAdminClean_(p.item, 400), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  if (!item) return { error: 'bad_value', message: 'item is required (verification text).' };
  if (apiAdminHasAcctNo_(item)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'wishdel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiWishSheet_(false);
    if (w.error) return w;
    if (w.none || !w.sh) return { error: 'not_found', message: 'There is no Wish List yet.' };
    var ss = w.ss, sh = w.sh, values = sh.getDataRange().getValues();
    if (!values.length) return { error: 'not_found', message: 'Wish List is empty.' };
    var col = apiWishCols_(values[0]);
    if (col.item < 0 || col.status < 0 || col.id < 0) return { error: 'no_columns', message: 'Wish List needs Item, Status and Id columns.' };
    var idx = apiWishFindRow_(values, col, id);
    if (idx < 0) return { error: 'not_found', message: 'No wish with that id. Nothing deleted.' };
    var info = apiWishInfo_(values, col, idx);
    if (!apiDelLabelOk_(values[idx][col.item], item)) return { error: 'row_mismatch', message: 'That id belongs to a different item. Nothing deleted.', actual: info };
    out.deleted = info;
    if (dry) return { ok: true, data: out };

    var rowNum = idx + 1, lc = Math.max(sh.getLastColumn(), values[0].length, 1), undo = [];
    try {
      apiTabBackup_(ss, sh);
      var blk = apiDelRead_(sh, rowNum, 1, lc), maxBefore = sh.getMaxRows();
      undo.push(function () {                                             // only if the row is really gone
        if (sh.getMaxRows() >= maxBefore) return;
        sh.insertRowBefore(rowNum);
        apiDelWrite_(sh, rowNum, blk, lc);
      });
      sh.deleteRow(rowNum);
      SpreadsheetApp.flush();
      var after = sh.getDataRange().getValues();
      if (JSON.stringify(apiWishFingerprint_(after, col, -1)) !== JSON.stringify(apiWishFingerprint_(values, col, idx))) throw new Error('read-back mismatch after delete');
      apiSpendJournal_(jss, [new Date(), 'wishdel', rowNum, API_WISH.name + ': delete row', values[idx].map(function (x) { return apiWishShow_(x, 100); }).join(' | ').substring(0, 480), '(deleted)', cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'wishdel', rowNum, API_WISH.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.deletedOk = true;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* v40 — Lisa's Table prices + Orders                                       */
/*   ltpriceset  (admin)  Price column of the Menu Macros sheet (one item or bulk). */
/*   orders (read), orderset, orderpaid, orderdel, weekmenuset (admin)      */
/*   Storage: a Google Sheet "Lisa's Table - Orders" inside the Lisa's Table */
/*   Drive folder, created lazily by the first real write (never by a read  */
/*   and never by dry=1; dry runs report wouldCreateSheet). Its id is kept   */
/*   in Script Property CC_ORD_SHEET_ID; when unset the folder is searched   */
/*   for an existing sheet of that name before anything is created.          */
/*   Tabs: "Orders"  orderId | week | client | item | qty | unitPrice | lineTotal | paid | paidOn | addedAt | updatedAt | status | delivery | payStatus | payMethod  */
/*   v41: delivery (0|3|5), payStatus (paid|unpaid|trade) and payMethod (cash|zelle|venmo) repeat on every row of an order; the three columns are */
/*        appended to an existing v40 sheet by the first real write that needs them. Rows without them read as fee 0 and payStatus from the 'paid' column. */
/*        The legacy 'paid' column is kept in step (yes only for paid). Order total = items + delivery fee.                */
/*         "Week Menus"  week | item | price | order                          */
/*   One Orders row per client-item line; the rows of one order share an     */
/*   orderId. week = the Monday of the order week (yyyy-mm-dd, stored as     */
/*   text); delivery is the Tuesday. Deleting an order only marks its rows   */
/*   status 'deleted' (nothing is ever removed). Same conventions as the     */
/*   Wish List: passcode (dispatcher), cid idempotency (apiAdminSeenCid_),   */
/*   dry=1 writes nothing, script lock, read-back verify + undo              */
/*   (write_failed / rolledBack), every write journaled on "CC write log".   */
/* ======================================================================= */
var API_ORD = {
  name: "Lisa's Table - Orders",
  folderId: '1k7yFqwv3KQcmUxI-neeVKkZl7mqqCvXR',   // Lisa's Table folder
  prop: 'CC_ORD_SHEET_ID',
  tab: 'Orders', menuTab: 'Week Menus',
  head: ['orderId', 'week', 'client', 'item', 'qty', 'unitPrice', 'lineTotal', 'paid', 'paidOn', 'addedAt', 'updatedAt', 'status', 'delivery', 'payStatus', 'payMethod'],
  newCols: ['delivery', 'payStatus', 'payMethod'],          // v41: added lazily to a sheet created by v40
  fees: [0, 3, 5], payStatuses: ['paid', 'unpaid', 'trade'], payMethods: ['cash', 'zelle', 'venmo', 'trade'],   // v56: trade = paid in trade (Lisa's Table)
  menuHead: ['week', 'item', 'price', 'order'],
  maxLines: 40, maxMenu: 60, maxClient: 60, maxItem: 120, maxQty: 99, maxPrice: 500, maxBulk: 200,
  sheetMime: 'application/vnd.google-apps.spreadsheet'
};
var API_ORD_SPEC = { orderId: ['orderid', 'order id'], week: ['week'], client: ['client'], item: ['item'], qty: ['qty', 'quantity'],
  unitPrice: ['unitprice', 'unit price'], lineTotal: ['linetotal', 'line total'], paid: ['paid'], paidOn: ['paidon', 'paid on'],
  addedAt: ['addedat', 'added at'], updatedAt: ['updatedat', 'updated at'], status: ['status'],
  delivery: ['delivery', 'delivery fee', 'deliveryfee'], payStatus: ['paystatus', 'pay status'], payMethod: ['paymethod', 'pay method'] };
var API_ORDM_SPEC = { week: ['week'], item: ['item'], price: ['price'], order: ['order'] };

function apiOrdR2_(x) { return Math.round(Number(x) * 100) / 100; }
/** '' (empty), a number 0..500 with at most 2 decimals, or null (invalid). */
function apiOrdPrice_(v) {
  var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  if (s === '') return '';
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  var n = Number(s);
  return n >= 0 && n <= API_ORD.maxPrice ? n : null;
}
/** A JSON array string or a real array -> array, or null when it is neither. */
function apiOrdArr_(raw) {
  if (Array.isArray(raw)) return raw;
  var t = String(raw == null ? '' : raw).trim();
  if (t.charAt(0) !== '[') return null;
  try { var a = JSON.parse(t); return Array.isArray(a) ? a : null; } catch (e) { return null; }
}
/** yyyy-mm-dd that is a real Monday, else ''. */
function apiOrdWeek_(v) {
  var s = apiAdminDate_(v);
  if (!s) return '';
  var m = s.split('-');
  return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]), 12).getDay() === 1 ? s : '';
}
function apiOrdStamp_() { return Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm'); }
function apiOrdNewId_(taken) {
  var id;
  do { id = 'o' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); } while (taken[id]);
  taken[id] = true;
  return id;
}
function apiOrdBool_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if (/^(1|true|yes|y|paid|x)$/.test(t)) return true;
  if (/^(0|false|no|n|unpaid|)$/.test(t)) return false;
  return null;
}
/** '' (not given), 0|3|5, or null (invalid). */
function apiOrdFee_(v) {
  if (v === undefined || v === null || String(v).trim() === '') return '';
  var n = apiOrdPrice_(v);
  return n !== null && n !== '' && API_ORD.fees.indexOf(n) >= 0 ? n : null;
}
/** '' (not given), 'paid'|'unpaid'|'trade', or null (invalid). */
function apiOrdPayStatus_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if (t === '') return '';
  return API_ORD.payStatuses.indexOf(t) >= 0 ? t : null;
}
/** '' (not given), 'cash'|'zelle'|'venmo', or null (invalid). */
function apiOrdPayMethod_(v) {
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if (t === '') return '';
  return API_ORD.payMethods.indexOf(t) >= 0 ? t : null;
}
/** Stored cell -> a valid pay status, else ''. */
function apiOrdCellStatus_(v) { var t = String(v == null ? '' : v).trim().toLowerCase(); return API_ORD.payStatuses.indexOf(t) >= 0 ? t : ''; }
function apiOrdCellMethod_(v) { var t = String(v == null ? '' : v).trim().toLowerCase(); return API_ORD.payMethods.indexOf(t) >= 0 ? t : ''; }
function apiOrdHead_(sh, head) {
  if (sh.getLastRow() > 0) return;
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); } catch (e) { /* cosmetic only */ }
}
/**
 * v41: make sure the Orders tab has the delivery / payStatus / payMethod columns (header names appended as NEW LAST columns). Only called by real writes, under the lock.
 * Pushes an undo (header cells cleared, columns removed again) onto `undo`. Returns the list of column names that were added ([] when all exist).
 */
function apiOrdEnsureCols_(sh, undo) {
  var lastCol = Math.max(sh.getLastColumn(), 1), head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var col = mapHeaders_(head, API_ORD_SPEC), add = [];
  API_ORD.newCols.forEach(function (k) { if (col[k] < 0) add.push(k); });
  if (!add.length) return [];
  var start = 0;                                                        // 0-based index just after the last non-empty header
  for (var i = 0; i < head.length; i++) if (String(head[i]).trim() !== '') start = i + 1;
  var need = start + add.length - sh.getMaxColumns();
  if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
  undo.push(function () {
    sh.getRange(1, start + 1, 1, add.length).clearContent();
    try { if (sh.getMaxColumns() >= start + add.length) sh.deleteColumns(start + 1, add.length); } catch (e) { /* leave the cleared header cells */ }
  });
  sh.getRange(1, start + 1, 1, add.length).setNumberFormat('@').setValues([add]);
  try { sh.getRange(1, start + 1, 1, add.length).setFontWeight('bold'); } catch (e2) { /* cosmetic only */ }
  SpreadsheetApp.flush();
  var back = sh.getRange(1, start + 1, 1, add.length).getValues()[0];
  for (var j = 0; j < add.length; j++) if (String(back[j]) !== add[j]) throw new Error('read-back mismatch (new column ' + add[j] + ')');
  return add;
}
/** Names of the v41 columns the Orders tab does not have yet (read-only; for dry runs). */
function apiOrdMissingCols_(col) {
  if (!col) return [];
  return API_ORD.newCols.filter(function (k) { return col[k] < 0; });
}
/**
 * Locate the Orders spreadsheet. create=false (reads, dry runs): never creates or stores anything; returns {none:true} when there is none yet
 *   (shO / shM may be null when a tab is missing). create=true (real writes, under the script lock): creates + files it in the Lisa's Table folder,
 *   stores its id in CC_ORD_SHEET_ID, and makes sure both tabs + headers exist. Returns {ss, shO, shM, created, note} or {none:true} or {error}.
 */
function apiOrdSheet_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(API_ORD.prop), ss = null, created = false, note = '';
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) {
      return { error: 'orders_sheet_unavailable', message: 'The Orders sheet (CC_ORD_SHEET_ID) cannot be opened: ' + String(e && e.message || e).substring(0, 160) + '. Nothing was created.' };
    }
  } else {
    var found = null, it = DriveApp.getFolderById(API_ORD.folderId).getFilesByName(API_ORD.name);
    while (it.hasNext()) {
      var f = it.next();
      if (f.getMimeType() === API_ORD.sheetMime && !(f.isTrashed && f.isTrashed())) { found = f; break; }
    }
    if (found) {
      ss = SpreadsheetApp.openById(found.getId());
      if (create) props.setProperty(API_ORD.prop, found.getId());
    } else if (create) {
      ss = SpreadsheetApp.create(API_ORD.name);
      props.setProperty(API_ORD.prop, ss.getId());                       // remember it first so a later failure can never create a second one
      created = true;
      try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(API_ORD.folderId)); }
      catch (e2) { note = 'created but could not be moved into the Lisa\'s Table folder: ' + String(e2 && e2.message || e2).substring(0, 160); }
    } else return { none: true };
  }
  var shO = ss.getSheetByName(API_ORD.tab), shM = ss.getSheetByName(API_ORD.menuTab);
  if (create) {
    if (!shO) {
      var first = ss.getSheets()[0];
      if (created && first && ss.getSheets().length === 1 && first.getLastRow() === 0) { first.setName(API_ORD.tab); shO = first; }
      else shO = ss.insertSheet(API_ORD.tab);
    }
    if (!shM) shM = ss.insertSheet(API_ORD.menuTab);
    apiOrdHead_(shO, API_ORD.head);
    apiOrdHead_(shM, API_ORD.menuHead);
  }
  return { ss: ss, shO: shO, shM: shM, created: created, note: note };
}
/** Orders-tab rows as objects (all statuses). {col, values, rows:[{i,orderId,week,client,item,qty,unitPrice,lineTotal,paid,paidOn,delivery,payStatus,payMethod,addedAt,updatedAt,status}]} or {error}. */
function apiOrdRead_(sh) {
  var values = sh ? sh.getDataRange().getValues() : [];
  if (values.length < 1 || String(values[0].join('')).trim() === '') return { col: null, values: values, rows: [] };
  var col = mapHeaders_(values[0], API_ORD_SPEC);
  var need = ['orderId', 'week', 'client', 'item', 'qty', 'unitPrice', 'paid', 'status'];
  for (var q = 0; q < need.length; q++) if (col[need[q]] < 0) return { error: 'no_columns', message: 'Orders needs an ' + need[q] + ' column.' };
  var g = function (v, k, max) { return col[k] >= 0 ? apiWishShow_(v[col[k]], max || 200) : ''; };
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r], oid = g(v, 'orderId', 80);
    if (!oid) continue;
    var qty = toNum_(v[col.qty]), up = toNum_(v[col.unitPrice]), lt = col.lineTotal >= 0 ? toNum_(v[col.lineTotal]) : null;
    qty = qty === null ? 0 : qty; up = up === null ? 0 : up;
    rows.push({ i: r, orderId: oid, week: toKey_(v[col.week]), client: g(v, 'client', API_ORD.maxClient), item: g(v, 'item', API_ORD.maxItem),
      qty: qty, unitPrice: up, lineTotal: lt === null ? apiOrdR2_(qty * up) : lt,
      paid: apiOrdBool_(col.paid >= 0 ? v[col.paid] : '') === true, paidOn: col.paidOn >= 0 ? toKey_(v[col.paidOn]) : '',
      delivery: col.delivery >= 0 && API_ORD.fees.indexOf(toNum_(v[col.delivery])) >= 0 ? toNum_(v[col.delivery]) : 0,
      payStatusCell: col.payStatus >= 0 ? apiOrdCellStatus_(v[col.payStatus]) : '', payMethodCell: col.payMethod >= 0 ? apiOrdCellMethod_(v[col.payMethod]) : '',
      addedAt: g(v, 'addedAt', 30), updatedAt: g(v, 'updatedAt', 30), status: (g(v, 'status', 20) || 'active').toLowerCase() });
    var last = rows[rows.length - 1];                                  // effective pay state of the row: the new columns, else the legacy paid boolean
    last.payStatus = last.payStatusCell || (last.paid ? 'paid' : 'unpaid');
    last.payMethod = last.payStatus === 'paid' ? last.payMethodCell : '';
  }
  return { col: col, values: values, rows: rows };
}
/** Active rows grouped into orders (sheet order kept). Order = {orderId,week,client,lines,items,subtotal,deliveryFee,total,paid,payStatus,payMethod,paidOn,addedAt,updatedAt};
 *  total = subtotal + deliveryFee. The fee / pay state are read from the first row (all rows of an order carry the same); when rows disagree (hand edits) the order counts as unpaid. */
function apiOrdGroup_(rows) {
  var map = {}, list = [];
  rows.forEach(function (r) {
    if (r.status === 'deleted') return;
    var o = map[r.orderId];
    if (!o) {
      o = map[r.orderId] = { orderId: r.orderId, week: r.week, client: r.client, lines: [], items: 0, subtotal: 0, deliveryFee: r.delivery, total: 0, paid: true, payStatus: r.payStatus, payMethod: r.payMethod,
        paidOn: '', addedAt: r.addedAt, updatedAt: r.updatedAt, mixed: false };
      list.push(o);
    } else if (r.payStatus !== o.payStatus || r.payMethod !== o.payMethod) o.mixed = true;
    o.lines.push({ item: r.item, qty: r.qty, unitPrice: r.unitPrice, lineTotal: r.lineTotal });
    o.items += r.qty; o.subtotal = apiOrdR2_(o.subtotal + r.lineTotal);
    if (r.paidOn && r.paidOn > o.paidOn) o.paidOn = r.paidOn;
    if (r.updatedAt > o.updatedAt) o.updatedAt = r.updatedAt;
  });
  list.forEach(function (o) {
    if (o.mixed) { o.payStatus = 'unpaid'; o.payMethod = ''; }
    o.paid = o.payStatus === 'paid';
    if (!o.paid) o.paidOn = '';
    o.total = apiOrdR2_(o.subtotal + o.deliveryFee);
    delete o.mixed;
  });
  return list;
}
/** The order as returned to the app (a copy with just the public fields). */
function apiOrdPub_(o) {
  return { orderId: o.orderId, week: o.week, client: o.client, lines: o.lines, items: o.items, subtotal: o.subtotal, deliveryFee: o.deliveryFee, total: o.total,
    paid: o.payStatus === 'paid', payStatus: o.payStatus, payMethod: o.payMethod, paidOn: o.paidOn, addedAt: o.addedAt, updatedAt: o.updatedAt };
}
/** A zeroed aggregate (one week, or everything). */
function apiOrdAgg_() {
  return { clients: 0, items: 0, subtotal: 0, deliveryTotal: 0, total: 0, paid: 0, unpaid: 0, trade: 0, paidCount: 0, unpaidCount: 0, tradeCount: 0,
    byMethod: { cash: 0, zelle: 0, venmo: 0, trade: 0, unspecified: 0 } };
}
/** Add one order to an aggregate. paid / unpaid / trade are money (items + delivery fee) of paid-only / unpaid-only / trade-only orders; total = all three. byMethod = paid money per method. */
function apiOrdAggAdd_(x, o) {
  x.clients++; x.items += o.items;
  x.subtotal = apiOrdR2_(x.subtotal + o.subtotal); x.deliveryTotal = apiOrdR2_(x.deliveryTotal + o.deliveryFee); x.total = apiOrdR2_(x.total + o.total);
  if (o.payStatus === 'paid') {
    x.paid = apiOrdR2_(x.paid + o.total); x.paidCount++;
    var m = o.payMethod || 'unspecified';
    x.byMethod[m] = apiOrdR2_(x.byMethod[m] + o.total);
  } else if (o.payStatus === 'trade') { x.trade = apiOrdR2_(x.trade + o.total); x.tradeCount++; }
  else { x.unpaid = apiOrdR2_(x.unpaid + o.total); x.unpaidCount++; }
}
/** Week Menus rows: {rows:[{i,week,item,price,order}]} or {error}. */
function apiOrdMenuRead_(sh) {
  var values = sh ? sh.getDataRange().getValues() : [];
  if (values.length < 1 || String(values[0].join('')).trim() === '') return { col: null, values: values, rows: [] };
  var col = mapHeaders_(values[0], API_ORDM_SPEC);
  if (col.week < 0 || col.item < 0 || col.price < 0) return { error: 'no_columns', message: 'Week Menus needs week, item and price columns.' };
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r], wk = toKey_(v[col.week]), it = apiWishShow_(v[col.item], API_ORD.maxItem);
    if (!wk || !it) continue;
    var pr = toNum_(v[col.price]), od = col.order >= 0 ? toNum_(v[col.order]) : null;
    rows.push({ i: r, week: wk, item: it, price: pr, order: od === null ? rows.length + 1 : od });
  }
  return { col: col, values: values, rows: rows };
}
function apiOrdMenuOf_(rows, week) {
  return rows.filter(function (m) { return m.week === week; }).sort(function (a, b) { return a.order - b.order || a.i - b.i; })
    .map(function (m) { return { item: m.item, price: m.price, order: m.order }; });
}
function apiOrdJournal_(jss, action, row, field, before, after, cid) {
  apiSpendJournal_(jss, [new Date(), action, row, field, String(before == null ? '' : before).substring(0, 480), String(after == null ? '' : after).substring(0, 480), cid]);
}

/**
 * action=orders  (read-only; creates nothing)   params: week=yyyy-mm-dd (a Monday; optional)
 * Response {ok:true,data:{exists, sheetUrl,
 *   weeks:[{week,clients,items,subtotal,deliveryTotal,total,paid,unpaid,trade,paidCount,unpaidCount,tradeCount,byMethod:{cash,zelle,venmo,unspecified},hasMenu}] (newest first; every week with an order or a saved menu),
 *     total = items + delivery fees of ALL orders; paid / unpaid / trade = money (items + fee) of paid-only / unpaid-only / trade-only orders (paid+unpaid+trade = total); byMethod = paid money per method
 *     ('unspecified' = legacy paid rows with no method); deliveryTotal = delivery fees of all orders,
 *   totals: the same aggregate over every week (no week/hasMenu),
 *   clients:[{name,orders,last}] (distinct client names from the orders, most recent week first then most orders),
 *   week (when asked), orders:[{orderId,week,client,lines:[{item,qty,unitPrice,lineTotal}],items,subtotal,deliveryFee,total,paid,payStatus,payMethod,paidOn,addedAt,updatedAt}] (that week, deleted ones left out;
 *     payStatus 'paid'|'unpaid'|'trade', payMethod 'cash'|'zelle'|'venmo'|'' ; paid = (payStatus==='paid'); rows without the v41 columns read as fee 0 and status from the legacy paid column), menu:[{item,price,order}] (that week's saved menu)}}
 */
function apiOrders_(p) {
  p = p || {};
  var wk = '';
  if (p.week != null && String(p.week).trim() !== '') {
    wk = apiOrdWeek_(p.week);
    if (!wk) return { error: 'bad_value', message: 'week must be a Monday as yyyy-mm-dd.' };
  }
  var w = apiOrdSheet_(false);
  if (w.error) return w;
  var out = { exists: false, sheetUrl: '', weeks: [], totals: apiOrdAgg_(), clients: [], orders: [], menu: [] };
  if (wk) out.week = wk;
  if (w.none) return { ok: true, data: out };
  out.exists = true;
  try { out.sheetUrl = w.ss.getUrl(); } catch (e) { out.sheetUrl = ''; }
  var od = apiOrdRead_(w.shO);
  if (od.error) return od;
  var md = apiOrdMenuRead_(w.shM);
  if (md.error) return md;
  var orders = apiOrdGroup_(od.rows), weeks = {}, cl = {}, all = apiOrdAgg_();
  orders.forEach(function (o) {
    var k = o.week;
    var x = weeks[k] || (weeks[k] = (function () { var a = apiOrdAgg_(); a.week = k; a.hasMenu = false; return a; })());
    apiOrdAggAdd_(x, o); apiOrdAggAdd_(all, o);
    var ck = loose_(o.client);
    if (ck) {
      var c = cl[ck] || (cl[ck] = { name: o.client, orders: 0, last: '' });
      c.orders++;
      if (o.week >= c.last) { c.last = o.week; c.name = o.client; }
    }
  });
  md.rows.forEach(function (m) {
    var x = weeks[m.week] || (weeks[m.week] = (function () { var a = apiOrdAgg_(); a.week = m.week; a.hasMenu = false; return a; })());
    x.hasMenu = true;
  });
  out.weeks = Object.keys(weeks).map(function (k) { return weeks[k]; }).sort(function (a, b) { return a.week < b.week ? 1 : a.week > b.week ? -1 : 0; });
  out.totals = all;
  out.clients = Object.keys(cl).map(function (k) { return cl[k]; }).sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : b.orders - a.orders; });
  if (wk) {
    out.orders = orders.filter(function (o) { return o.week === wk; }).map(apiOrdPub_);
    out.menu = apiOrdMenuOf_(md.rows, wk);
  }
  return { ok: true, data: out };
}

/**
 * action=ltpriceset  (admin; GET params or POST body) — set the Price of Menu Macros items. Writes ONLY the Price cells.
 *   item + price   one item         — or —   prices  JSON array (<=200) of {item, price}  (bulk; real array in a POST body)
 *   price  0..500, at most 2 decimals; '' clears the price.   item must match a row exactly (case / extra spaces ignored); never adds rows.
 *   cid    required when writing    dry=1 previews: nothing written, no column created (reports wouldCreateColumn)
 * The Price column is created lazily (header 'Price', new LAST column) by the first real write that sets a price.
 * Bulk: matched items are written, unmatched ones listed in skipped (reason 'not_found' | 'ambiguous'), unchanged ones skipped ('unchanged'). Single item not found -> error not_found.
 * Read-back verify + undo (write_failed; the created column is removed again); journaled on "CC write log".
 * Response {ok:true,data:{updated:[{item,row,previous,price}], skipped:[{item,reason}], createdColumn, wouldCreateColumn, dry, cid}}
 */
function apiLtPriceSet_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), list = [], bulk = false;
  if (p.prices !== undefined && p.prices !== null && String(p.prices) !== '') {
    var arr = apiOrdArr_(p.prices);
    if (!arr) return { error: 'bad_value', message: 'prices must be a JSON array of {item, price}.' };
    if (arr.length > API_ORD.maxBulk) return { error: 'too_many', message: 'At most ' + API_ORD.maxBulk + ' prices per call.' };
    bulk = true;
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i] || {}, nm = apiAdminClean_(x.item, 201), pr = apiOrdPrice_(x.price);
      if (!nm || nm.length > 200) return { error: 'bad_value', message: 'Entry ' + (i + 1) + ' needs an item (<= 200 characters).' };
      if (pr === null) return { error: 'bad_value', message: 'Price for "' + nm.substring(0, 60) + '" must be between 0 and ' + API_ORD.maxPrice + ' (at most 2 decimals). Nothing changed.' };
      list.push({ item: nm, price: pr });
    }
  } else {
    var n1 = apiAdminClean_(p.item, 201), p1 = apiOrdPrice_(p.price);
    if (!n1 || n1.length > 200) return { error: 'bad_value', message: 'item is required.' };
    if (p.price === undefined) return { error: 'bad_value', message: 'price is required (use an empty price to clear it).' };
    if (p1 === null) return { error: 'bad_value', message: 'price must be between 0 and ' + API_ORD.maxPrice + ' (at most 2 decimals).' };
    list.push({ item: n1, price: p1 });
  }
  if (!list.length) return { error: 'bad_value', message: 'prices (JSON array) or item + price is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid, updated: [], skipped: [], createdColumn: false, wouldCreateColumn: false };
    if (apiAdminSeenCid_(jss, 'ltpriceset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var ss = SpreadsheetApp.openById(API_LT.macrosSheetId), sh = ss.getSheets()[0];
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { error: 'not_found', message: 'The Menu Macros sheet is empty.' };
    var col = mapHeaders_(values[0], { item: ['item'], price: ['price'] });
    if (col.item < 0) return { error: 'no_columns', message: 'Menu Macros needs an Item column.' };
    var byName = {};
    for (var r = 1; r < values.length; r++) {
      var k = norm_(values[r][col.item]);
      if (!k) continue;
      (byName[k] = byName[k] || []).push(r);
    }
    var seen = {}, changes = [];
    list.forEach(function (x) {
      var k = norm_(x.item), rows = byName[k];
      if (seen[k]) { out.skipped.push({ item: x.item, reason: 'duplicate_in_call' }); return; }
      seen[k] = true;
      if (!rows) { out.skipped.push({ item: x.item, reason: 'not_found' }); return; }
      if (rows.length > 1) { out.skipped.push({ item: x.item, reason: 'ambiguous' }); return; }
      var idx = rows[0], old = col.price >= 0 ? toNum_(values[idx][col.price]) : null, nw = x.price === '' ? null : x.price;
      if (old === nw) { out.skipped.push({ item: x.item, reason: 'unchanged' }); return; }
      changes.push({ item: String(values[idx][col.item]).trim(), idx: idx, row: idx + 1, previous: old, price: nw, oldRaw: col.price >= 0 ? values[idx][col.price] : '' });
    });
    if (!bulk && !changes.length && out.skipped.length && out.skipped[0].reason === 'not_found') return { error: 'not_found', message: 'No menu item with that name. Nothing changed.' };
    if (!bulk && !changes.length && out.skipped.length && out.skipped[0].reason === 'ambiguous') return { error: 'ambiguous', message: 'More than one row has that name. Nothing changed.' };
    var needCol = col.price < 0 && changes.some(function (c) { return c.price !== null; });
    out.updated = changes.map(function (c) { return { item: c.item, row: c.row, previous: c.previous, price: c.price }; });
    if (needCol) out.wouldCreateColumn = true;
    if (dry || !changes.length) { if (!dry) out.wouldCreateColumn = false; return { ok: true, data: out }; }

    var undo = [], pcol0 = col.price, madeCol = false;
    try {
      if (pcol0 < 0) {
        if (!needCol) return { ok: true, data: out };
        pcol0 = values[0].length;                                          // new LAST column (0-based)
        if (pcol0 + 1 > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
        madeCol = true;
        undo.push(function () { sh.deleteColumn(pcol0 + 1); });
        var hcell = sh.getRange(1, pcol0 + 1);
        try { sh.getRange(1, pcol0, 1, 1).copyTo(hcell, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false); } catch (fe) { /* cosmetic */ }
        hcell.setValue('Price');
      }
      changes.forEach(function (c) {
        var rng = sh.getRange(c.row, pcol0 + 1), oldV = c.oldRaw;
        if (!madeCol) undo.push(function () { rng.setValue(oldV); });
        rng.setNumberFormat('$0.00');
        if (c.price === null) rng.clearContent(); else rng.setValue(c.price);
      });
      SpreadsheetApp.flush();
      var back = sh.getRange(1, 1, values.length, pcol0 + 1).getValues();
      if (String(back[0][pcol0]).trim().toLowerCase() !== 'price') throw new Error('read-back mismatch (Price header)');
      changes.forEach(function (c) {
        if (norm_(back[c.idx][col.item]) !== norm_(c.item)) throw new Error('read-back mismatch (item row ' + c.row + ')');
        var a = toNum_(back[c.idx][pcol0]);
        if (c.price === null ? a !== null : (a === null || Math.abs(a - c.price) > 0.0001)) throw new Error('read-back mismatch (price row ' + c.row + ')');
      });
      apiOrdJournal_(jss, 'ltpriceset', changes[0].row, 'Menu Macros: Price x' + changes.length + (madeCol ? ' (column created)' : ''),
        changes.map(function (c) { return c.item.substring(0, 24) + '=' + (c.previous === null ? '' : c.previous); }).join(' ; '),
        changes.map(function (c) { return c.item.substring(0, 24) + '=' + (c.price === null ? '' : c.price); }).join(' ; '), cid);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiOrdJournal_(jss, 'ltpriceset', '', 'Menu Macros: Price ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'restored') + ' (cid ' + cid + ')', ''); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.createdColumn = madeCol; out.wouldCreateColumn = false;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/** One order line list -> {lines} or {err}. Same item at the same price is merged. */
function apiOrdLines_(raw) {
  var arr = apiOrdArr_(raw);
  if (!arr) return { err: { error: 'bad_value', message: 'lines must be a JSON array of {item, qty, price}.' } };
  var out = [], idx = {};
  for (var i = 0; i < arr.length; i++) {
    var x = arr[i] || {}, nm = apiAdminClean_(x.item, API_ORD.maxItem + 1), qs = String(x.qty == null ? '' : x.qty).trim(), pr = apiOrdPrice_(x.price);
    if (!nm || nm.length > API_ORD.maxItem) return { err: { error: 'bad_value', message: 'Line ' + (i + 1) + ' needs an item (<= ' + API_ORD.maxItem + ' characters).' } };
    if (!/^\d{1,3}$/.test(qs) || Number(qs) < 1 || Number(qs) > API_ORD.maxQty) return { err: { error: 'bad_value', message: 'qty for "' + nm.substring(0, 40) + '" must be a whole number from 1 to ' + API_ORD.maxQty + '.' } };
    if (pr === null || pr === '') return { err: { error: 'bad_value', message: 'price for "' + nm.substring(0, 40) + '" must be between 0 and ' + API_ORD.maxPrice + '.' } };
    if (apiAdminHasAcctNo_(nm)) return { err: { error: 'no_account_numbers', message: 'Do not send account numbers.' } };
    var k = norm_(nm) + '|' + pr;
    if (idx[k] !== undefined) out[idx[k]].qty += Number(qs);
    else { idx[k] = out.length; out.push({ item: nm, qty: Number(qs), price: pr }); }
  }
  if (!out.length) return { err: { error: 'bad_value', message: 'lines needs at least one item (use orderdel to remove an order).' } };
  if (out.length > API_ORD.maxLines) return { err: { error: 'too_many', message: 'At most ' + API_ORD.maxLines + ' lines per order.' } };
  for (var j = 0; j < out.length; j++) if (out[j].qty > API_ORD.maxQty) return { err: { error: 'bad_value', message: 'qty for "' + out[j].item.substring(0, 40) + '" must be at most ' + API_ORD.maxQty + '.' } };
  return { lines: out };
}
function apiOrdRowVals_(width, col, o, ln, paidOn, addedAt, updatedAt, status) {
  var row = [];
  for (var c = 0; c < width; c++) row.push('');
  row[col.orderId] = o.orderId; row[col.week] = o.week; row[col.client] = o.client; row[col.item] = ln.item;
  row[col.qty] = ln.qty; row[col.unitPrice] = ln.price;
  if (col.lineTotal >= 0) row[col.lineTotal] = apiOrdR2_(ln.qty * ln.price);
  row[col.paid] = o.payStatus === 'paid' ? 'yes' : 'no';
  if (col.paidOn >= 0) row[col.paidOn] = o.payStatus === 'paid' ? paidOn : '';
  if (col.delivery >= 0) row[col.delivery] = o.deliveryFee;
  if (col.payStatus >= 0) row[col.payStatus] = o.payStatus;
  if (col.payMethod >= 0) row[col.payMethod] = o.payMethod;
  if (col.addedAt >= 0) row[col.addedAt] = addedAt;
  if (col.updatedAt >= 0) row[col.updatedAt] = updatedAt;
  row[col.status] = status;
  return row;
}
/** Text formats for the columns that must never become dates / formulas, applied to one row range. */
function apiOrdTextFormat_(sh, col, row1, n) {
  ['orderId', 'week', 'client', 'item', 'paid', 'paidOn', 'addedAt', 'updatedAt', 'status', 'payStatus', 'payMethod'].forEach(function (k) { if (col[k] >= 0) sh.getRange(row1, col[k] + 1, n, 1).setNumberFormat('@'); });
  ['unitPrice', 'lineTotal', 'delivery'].forEach(function (k) { if (col[k] >= 0) sh.getRange(row1, col[k] + 1, n, 1).setNumberFormat('$0.00'); });
  if (col.qty >= 0) sh.getRange(row1, col.qty + 1, n, 1).setNumberFormat('0');
}

/**
 * action=orderset  (admin; POST body recommended, GET params also work) — create or replace ONE client's order for a week.
 *   week    Monday as yyyy-mm-dd (the delivery is the Tuesday)      client  <= 60 chars (no account numbers)
 *   lines   JSON array (<=40) of {item, qty 1-99, price 0-500}; the price is stored as the unit price at order time
 *   deliveryFee 0 | 3 | 5 (optional; default 0 = none/pickup for a new order, unchanged for an edit); order total = items + deliveryFee
 *   payStatus   'paid' | 'unpaid' | 'trade' (optional; default unpaid for a new order, unchanged for an edit)
 *   payMethod   'cash' | 'zelle' | 'venmo' (only with payStatus paid). payStatus=paid needs a method (error method_required), except when editing an order that is
 *               already paid with no method (legacy rows) and the method is left out. Any other status clears the method.
 *   paid    true|false (old boolean, still accepted: true = payStatus paid keeping the current method, false = unpaid; payStatus wins when both are sent)
 *   orderId optional: edit that order (its rows are rewritten in place; extra lines are appended; left-over old rows are marked status 'deleted')
 *   cid     required when writing      dry=1 previews: nothing written, no sheet created (reports wouldCreateSheet)
 * A new order for a client that already has an active order that week -> error client_exists (with that orderId); edit it instead.
 * The delivery / payStatus / payMethod columns are added to an existing Orders tab (as new last columns) by the first real write; dry runs list them in wouldAddColumns.
 * Response {ok:true,data:{order:{orderId,week,client,lines,items,subtotal,deliveryFee,total,paid,payStatus,payMethod,paidOn,addedAt,updatedAt}, previous?:{client,week,items,total,paid,payStatus,payMethod,deliveryFee},
 *   createdSheet, wouldCreateSheet, wouldAddColumns?, addedColumns?, sheetUrl, dry, cid}}
 */
function apiOrderSet_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var week = apiOrdWeek_(p.week);
  if (!week) return { error: 'bad_value', message: 'week must be a Monday as yyyy-mm-dd.' };
  var client = apiAdminClean_(p.client, API_ORD.maxClient + 1);
  if (!client || client.length > API_ORD.maxClient) return { error: 'bad_value', message: 'client is required (<= ' + API_ORD.maxClient + ' characters).' };
  if (apiAdminHasAcctNo_(client)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var ln = apiOrdLines_(p.lines);
  if (ln.err) return ln.err;
  var paidIn = (p.paid === undefined || p.paid === null || String(p.paid) === '') ? undefined : apiOrdBool_(p.paid);
  if (paidIn === null) return { error: 'bad_value', message: 'paid must be true or false.' };
  var feeIn = apiOrdFee_(p.deliveryFee), psIn = apiOrdPayStatus_(p.payStatus), pmIn = apiOrdPayMethod_(p.payMethod);
  if (feeIn === null) return { error: 'bad_value', message: 'deliveryFee must be 0, 3 or 5.' };
  if (psIn === null) return { error: 'bad_value', message: 'payStatus must be paid, unpaid or trade.' };
  if (pmIn === null) return { error: 'bad_value', message: 'payMethod must be cash, zelle, venmo or trade.' };
  var editId = apiAdminClean_(p.orderId, 80);
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'orderset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiOrdSheet_(false);
    if (w.error) return w;
    var od = w.none ? { col: null, values: [], rows: [] } : apiOrdRead_(w.shO);
    if (od.error) return od;
    var mine = [], taken = {}, clash = null, key = loose_(client);
    od.rows.forEach(function (r) {
      taken[r.orderId] = true;
      if (r.status === 'deleted') return;
      if (editId && r.orderId === editId) mine.push(r);
      else if (r.week === week && loose_(r.client) === key && !clash) clash = r;
    });
    if (editId && !mine.length) return { error: 'not_found', message: 'No order with that id. Nothing changed.' };
    if (clash && (!editId || clash.orderId !== editId)) return { error: 'client_exists', message: 'That client already has an order for this week. Edit it instead. Nothing changed.', orderId: clash.orderId };
    var pg = mine.length ? apiOrdGroup_(mine)[0] : null;
    var wasSt = pg ? pg.payStatus : 'unpaid', wasM = pg ? pg.payMethod : '', wasPaidOn = pg ? pg.paidOn : '';
    var status = psIn ? psIn : (paidIn !== undefined ? (paidIn ? 'paid' : 'unpaid') : wasSt), method = '';
    if (status === 'paid') {
      method = pmIn ? pmIn : (wasSt === 'paid' ? wasM : '');
      if (!method && psIn && !(wasSt === 'paid')) return { error: 'method_required', message: 'Choose how it was paid: cash, zelle, venmo or trade. Nothing changed.' };
    } else if (pmIn) return { error: 'bad_value', message: 'payMethod only applies when payStatus is paid. Nothing changed.' };
    var fee = feeIn === '' ? (pg ? pg.deliveryFee : 0) : feeIn;
    var today = todayKey_(), stamp = apiOrdStamp_();
    var paidOn = status === 'paid' ? (wasSt === 'paid' && wasPaidOn ? wasPaidOn : today) : '';
    var addedAt = mine.length ? (mine[0].addedAt || stamp) : stamp;
    var order = { orderId: editId || apiOrdNewId_(taken), week: week, client: client, paid: status === 'paid', payStatus: status, payMethod: method, deliveryFee: fee };
    var res = { orderId: order.orderId, week: week, client: client, lines: ln.lines.map(function (l) { return { item: l.item, qty: l.qty, unitPrice: l.price, lineTotal: apiOrdR2_(l.qty * l.price) }; }),
                items: 0, subtotal: 0, deliveryFee: fee, total: 0, paid: status === 'paid', payStatus: status, payMethod: method, paidOn: paidOn, addedAt: addedAt, updatedAt: stamp };
    res.lines.forEach(function (l) { res.items += l.qty; res.subtotal = apiOrdR2_(res.subtotal + l.lineTotal); });
    res.total = apiOrdR2_(res.subtotal + fee);
    out.order = res;
    if (pg) out.previous = { client: pg.client, week: pg.week, items: pg.items, total: pg.total, paid: pg.paid, payStatus: pg.payStatus, payMethod: pg.payMethod, deliveryFee: pg.deliveryFee };
    if (dry) { out.wouldCreateSheet = !!w.none; out.createdSheet = false; var mc = apiOrdMissingCols_(od.col); if (mc.length) out.wouldAddColumns = mc; try { out.sheetUrl = w.ss ? w.ss.getUrl() : ''; } catch (e0) { out.sheetUrl = ''; } return { ok: true, data: out }; }

    var undo = [], created = false, sh = null, first = 0;
    try {
      var ws = apiOrdSheet_(true);
      if (ws.error) return ws;
      sh = ws.shO; created = ws.created; if (ws.note) out.sheetNote = ws.note;
      var addedCols = apiOrdEnsureCols_(sh, undo);
      if (addedCols.length) out.addedColumns = addedCols;
      var cur = apiOrdRead_(sh);
      if (cur.error) return cur;
      var col = cur.col || mapHeaders_(API_ORD.head, API_ORD_SPEC), width = Math.max(sh.getLastColumn(), API_ORD.head.length);
      // the rows of this order may have shifted only if someone edited the sheet by hand between the read above and now (we hold the lock); re-find them
      var mineNow = cur.rows.filter(function (r) { return editId && r.orderId === editId && r.status !== 'deleted'; });
      var targets = mineNow.map(function (r) { return r.i + 1; });          // 1-based sheet rows to overwrite in place
      var appendFrom = Math.max(sh.getLastRow(), 1) + 1, need = Math.max(0, res.lines.length - targets.length);
      if (need && appendFrom + need - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), appendFrom + need - 1 - sh.getMaxRows());
      var plan = [];                                                        // [{row, vals}]
      res.lines.forEach(function (l, i) {
        var row = i < targets.length ? targets[i] : appendFrom + (i - targets.length);
        plan.push({ row: row, vals: apiOrdRowVals_(width, col, order, { item: l.item, qty: l.qty, price: l.unitPrice }, paidOn, addedAt, stamp, 'active'), fresh: i >= targets.length });
      });
      for (var t = res.lines.length; t < targets.length; t++) plan.push({ row: targets[t], gone: true });
      first = plan[0].row;
      plan.forEach(function (pl) {
        var old = sh.getRange(pl.row, 1, 1, width).getValues()[0];
        undo.push(function () { sh.getRange(pl.row, 1, 1, width).setValues([old]); });
        if (pl.gone) {
          sh.getRange(pl.row, col.status + 1).setNumberFormat('@').setValue('deleted');
          if (col.updatedAt >= 0) sh.getRange(pl.row, col.updatedAt + 1).setNumberFormat('@').setValue(stamp);
        } else {
          apiOrdTextFormat_(sh, col, pl.row, 1);
          sh.getRange(pl.row, 1, 1, width).setValues([pl.vals]);
        }
      });
      SpreadsheetApp.flush();
      plan.forEach(function (pl) {
        var back = sh.getRange(pl.row, 1, 1, width).getValues()[0];
        if (String(back[col.orderId]) !== order.orderId) throw new Error('read-back mismatch (order id, row ' + pl.row + ')');
        if (pl.gone) { if (String(back[col.status]) !== 'deleted') throw new Error('read-back mismatch (status, row ' + pl.row + ')'); return; }
        if (String(back[col.item]) !== pl.vals[col.item] || Number(back[col.qty]) !== pl.vals[col.qty] || Math.abs(Number(back[col.unitPrice]) - pl.vals[col.unitPrice]) > 0.0001 || toKey_(back[col.week]) !== week || String(back[col.client]) !== client) throw new Error('read-back mismatch (line, row ' + pl.row + ')');
        if (Number(back[col.delivery]) !== fee || String(back[col.payStatus]) !== status || String(back[col.payMethod]) !== method) throw new Error('read-back mismatch (delivery / payment, row ' + pl.row + ')');
      });
      apiOrdJournal_(jss, 'orderset', first, API_ORD.name + ': ' + (editId ? 'edit' : 'new') + ' order ' + week,
        out.previous ? out.previous.client + ' ' + out.previous.items + ' items $' + out.previous.total + ' ' + out.previous.payStatus : '',
        client + ' ' + res.items + ' items $' + res.subtotal + ' + delivery $' + fee + ' = $' + res.total + ' ' + status + (method ? ' ' + method : '') + ' [' + order.orderId + ']', cid);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiOrdJournal_(jss, 'orderset', first, API_ORD.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows restored') + ' (cid ' + cid + ')', ''); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.createdSheet = created; out.wouldCreateSheet = false;
    try { out.sheetUrl = sh.getParent().getUrl(); } catch (e4) { out.sheetUrl = ''; }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/** Write one text cell and push its undo (a function, so each undo closure keeps its own cell). */
function apiOrdPutCell_(sh, row, col1, value, oldValue, undo) {
  var cell = sh.getRange(row, col1);
  undo.push(function () { cell.setValue(oldValue); });
  cell.setNumberFormat('@').setValue(value);
}
/** Shared by orderpaid / orderdel: change a few cells on every active row of one order (only the cells that differ are written); verifies + undoes. */
function apiOrdTouch_(action, p, fn) {
  p = p || {};
  var id = apiAdminClean_(p.orderId, 80), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!id) return { error: 'bad_value', message: 'orderId is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, action, cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiOrdSheet_(false);
    if (w.error) return w;
    if (w.none || !w.shO) return { error: 'not_found', message: 'There are no orders yet.' };
    var sh = w.shO, od = apiOrdRead_(sh);
    if (od.error) return od;
    var rows = od.rows.filter(function (r) { return r.orderId === id && r.status !== 'deleted'; });
    if (!rows.length) return { error: 'not_found', message: 'No order with that id. Nothing changed.' };
    var before = apiOrdGroup_(rows)[0];
    if (p.client != null && String(p.client).trim() !== '' && loose_(p.client) !== loose_(before.client)) return { error: 'row_mismatch', message: 'That order belongs to a different client. Nothing changed.' };
    var step = fn.plan(rows, before, od.col);
    if (step.err) return step.err;
    out.order = step.after; out.previous = { paid: before.paid, paidOn: before.paidOn, payStatus: before.payStatus, payMethod: before.payMethod };
    if (step.unchanged) { out.unchanged = true; return { ok: true, data: out }; }
    if (dry) { var mc = step.needCols ? apiOrdMissingCols_(od.col) : []; if (mc.length) out.wouldAddColumns = mc; return { ok: true, data: out }; }
    var undo = [], stamp = apiOrdStamp_();
    try {
      if (step.needCols && apiOrdMissingCols_(od.col).length) {
        var addedCols = apiOrdEnsureCols_(sh, undo);
        if (addedCols.length) out.addedColumns = addedCols;
        od = apiOrdRead_(sh);                                         // same rows / indexes, now with the new columns
      }
      var width = Math.max(sh.getLastColumn(), od.values[0].length), col = od.col;
      rows.forEach(function (r) {
        var old = od.values[r.i], nv = old.slice();
        step.set(nv, col, stamp);
        for (var c = 0; c < width; c++) {
          if (String(nv[c]) === String(old[c])) continue;
          apiOrdPutCell_(sh, r.i + 1, c + 1, nv[c], old[c], undo);
        }
      });
      SpreadsheetApp.flush();
      rows.forEach(function (r) {
        var back = sh.getRange(r.i + 1, 1, 1, width).getValues()[0];
        if (String(back[col.orderId]) !== id || !step.check(back, col)) throw new Error('read-back mismatch (row ' + (r.i + 1) + ')');
      });
      apiOrdJournal_(jss, action, rows[0].i + 1, API_ORD.name + ': ' + step.label + ' ' + before.week, before.client + ' ' + before.payStatus + (before.payMethod ? ' ' + before.payMethod : '') + ' $' + before.total, step.journal + ' [' + id + ']', cid);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiOrdJournal_(jss, action, '', API_ORD.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows restored') + ' (cid ' + cid + ')', ''); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=orderpaid  (admin) — change the payment of ONE order.   orderId   cid (required when writing)   dry=1   client (optional verification, loose match)
 *   payStatus 'paid' | 'unpaid' | 'trade'     payMethod 'cash' | 'zelle' | 'venmo' (only for paid)     paid=true|false (old form: true = paid keeping the current method, false = unpaid)
 *   At least one of paid / payStatus / payMethod. payStatus=paid needs a method (error method_required) unless the order is already paid with no method (legacy rows).
 *   payMethod alone changes the method of an order that is already paid. paid rows get paidOn = today (PT; kept if it was already paid); unpaid / trade clear paidOn and the method.
 *   The legacy 'paid' column stays in step ('yes' only for paid). Already in that state -> ok, unchanged:true. The payStatus / payMethod columns are created (as new last columns)
 *   only when needed (a trade order or a method has to be stored); dry runs list them in wouldAddColumns.
 * Response {ok:true,data:{order:{orderId,week,client,items,subtotal,deliveryFee,total,paid,payStatus,payMethod,paidOn,lines,...}, previous:{paid,paidOn,payStatus,payMethod}, unchanged?, addedColumns?, wouldAddColumns?, dry, cid}}
 */
function apiOrderPaid_(p) {
  p = p || {};
  var hasPaid = !(p.paid === undefined || p.paid === null || String(p.paid) === '');
  var want = hasPaid ? apiOrdBool_(p.paid) : undefined;
  if (hasPaid && want === null) return { error: 'bad_value', message: 'paid must be true or false.' };
  var ps = apiOrdPayStatus_(p.payStatus), pm = apiOrdPayMethod_(p.payMethod);
  if (ps === null) return { error: 'bad_value', message: 'payStatus must be paid, unpaid or trade.' };
  if (pm === null) return { error: 'bad_value', message: 'payMethod must be cash, zelle, venmo or trade.' };
  if (!hasPaid && !ps && !pm) return { error: 'bad_value', message: 'paid or payStatus is required.' };
  return apiOrdTouch_('orderpaid', p, {
    plan: function (rows, b, col) {
      var st = ps ? ps : (hasPaid ? (want ? 'paid' : 'unpaid') : b.payStatus), m = '';
      if (st === 'paid') {
        m = pm ? pm : (b.payStatus === 'paid' ? b.payMethod : '');
        if (!m && ps && b.payStatus !== 'paid') return { err: { error: 'method_required', message: 'Choose how it was paid: cash, zelle, venmo or trade. Nothing changed.' } };
      } else if (pm) return { err: { error: 'bad_value', message: 'payMethod only applies when payStatus is paid. Nothing changed.' } };
      var today = todayKey_(), on = st === 'paid' ? (b.payStatus === 'paid' && b.paidOn ? b.paidOn : today) : '';
      var after = apiOrdPub_(b); after.paid = st === 'paid'; after.payStatus = st; after.payMethod = m; after.paidOn = on;
      return { unchanged: b.payStatus === st && b.payMethod === m, after: after, needCols: st === 'trade' || m !== '',
        label: 'payment ' + st, journal: st + (m ? ' ' + m : '') + (on ? ' ' + on : ''),
        set: function (v, c, stamp) {
          v[c.paid] = st === 'paid' ? 'yes' : 'no'; if (c.paidOn >= 0) v[c.paidOn] = on;
          if (c.payStatus >= 0) v[c.payStatus] = st;
          if (c.payMethod >= 0) v[c.payMethod] = m;
          if (c.updatedAt >= 0) v[c.updatedAt] = stamp;
        },
        check: function (back, c) {
          return apiOrdBool_(back[c.paid]) === (st === 'paid') && (c.paidOn < 0 || toKey_(back[c.paidOn]) === on)
            && (c.payStatus < 0 || String(back[c.payStatus]) === st) && (c.payMethod < 0 || String(back[c.payMethod]) === m);
        } };
    }
  });
}
/**
 * action=orderdel  (admin) — delete ONE order (soft: every row of it gets status 'deleted'; nothing is removed from the sheet).
 *   orderId   client (optional verification)   cid (required when writing)   dry=1
 * Response {ok:true,data:{order:{orderId,week,client,lines,items,subtotal,deliveryFee,total,paid,payStatus,payMethod,paidOn,...}, deletedOk:true, dry, cid}}
 */
function apiOrderDel_(p) {
  var r = apiOrdTouch_('orderdel', p, {
    plan: function (rows, b, col) {
      return { unchanged: false, after: apiOrdPub_(b), label: 'delete order', journal: '(deleted)',
        set: function (v, c, stamp) { v[c.status] = 'deleted'; if (c.updatedAt >= 0) v[c.updatedAt] = stamp; },
        check: function (back, c) { return String(back[c.status]) === 'deleted'; } };
    }
  });
  if (r && r.ok && r.data && !r.data.dry && !r.data.duplicate) r.data.deletedOk = true;
  return r;
}

/**
 * action=weekmenuset  (admin; POST body recommended) — save the menu chosen for a week (Week Menus tab); replaces any menu already saved for that week.
 *   week   Monday as yyyy-mm-dd          items  JSON array (<=60) of {item, price}  (price 0-500 or empty; order = array order; repeated names are dropped)
 *   cid    required when writing         dry=1 previews: nothing written, no sheet created (reports wouldCreateSheet)
 * Response {ok:true,data:{week, menu:[{item,price,order}], unchanged?, createdSheet, wouldCreateSheet, dry, cid}}
 */
function apiWeekMenuSet_(p) {
  p = p || {};
  var cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry), week = apiOrdWeek_(p.week);
  if (!week) return { error: 'bad_value', message: 'week must be a Monday as yyyy-mm-dd.' };
  var arr = apiOrdArr_(p.items);
  if (!arr) return { error: 'bad_value', message: 'items must be a JSON array of {item, price}.' };
  if (arr.length > API_ORD.maxMenu) return { error: 'too_many', message: 'At most ' + API_ORD.maxMenu + ' menu items per week.' };
  var menu = [], seen = {};
  for (var i = 0; i < arr.length; i++) {
    var x = arr[i] || {}, nm = apiAdminClean_(x.item, API_ORD.maxItem + 1), pr = apiOrdPrice_(x.price);
    if (!nm || nm.length > API_ORD.maxItem) return { error: 'bad_value', message: 'Item ' + (i + 1) + ' needs a name (<= ' + API_ORD.maxItem + ' characters).' };
    if (pr === null) return { error: 'bad_value', message: 'Price for "' + nm.substring(0, 40) + '" must be between 0 and ' + API_ORD.maxPrice + '.' };
    if (apiAdminHasAcctNo_(nm)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
    var k = norm_(nm);
    if (seen[k]) continue;
    seen[k] = true;
    menu.push({ item: nm, price: pr === '' ? null : pr, order: menu.length + 1 });
  }
  if (!menu.length) return { error: 'bad_value', message: 'items needs at least one item.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid, week: week, menu: menu };
    if (apiAdminSeenCid_(jss, 'weekmenuset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiOrdSheet_(false);
    if (w.error) return w;
    var md = w.none || !w.shM ? { rows: [] } : apiOrdMenuRead_(w.shM);
    if (md.error) return md;
    var cur = apiOrdMenuOf_(md.rows, week);
    if (cur.length === menu.length && cur.every(function (m, i) { return norm_(m.item) === norm_(menu[i].item) && m.price === menu[i].price; })) { out.unchanged = true; out.wouldCreateSheet = false; return { ok: true, data: out }; }
    if (dry) { out.wouldCreateSheet = !!w.none; out.createdSheet = false; return { ok: true, data: out }; }

    var undo = [], sh = null, created = false, first = 0;
    try {
      var ws = apiOrdSheet_(true);
      if (ws.error) return ws;
      sh = ws.shM; created = ws.created; if (ws.note) out.sheetNote = ws.note;
      var m2 = apiOrdMenuRead_(sh);
      if (m2.error) return m2;
      var col = m2.col || mapHeaders_(API_ORD.menuHead, API_ORDM_SPEC), width = Math.max(sh.getLastColumn(), API_ORD.menuHead.length);
      var targets = m2.rows.filter(function (r) { return r.week === week; }).map(function (r) { return r.i + 1; });
      var appendFrom = Math.max(sh.getLastRow(), 1) + 1, need = Math.max(0, menu.length - targets.length);
      if (need && appendFrom + need - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), appendFrom + need - 1 - sh.getMaxRows());
      var plan = [];
      menu.forEach(function (m, i) {
        var row = i < targets.length ? targets[i] : appendFrom + (i - targets.length), v = [];
        for (var c = 0; c < width; c++) v.push('');
        v[col.week] = week; v[col.item] = m.item; v[col.price] = m.price === null ? '' : m.price; if (col.order >= 0) v[col.order] = m.order;
        plan.push({ row: row, vals: v });
      });
      for (var t = menu.length; t < targets.length; t++) plan.push({ row: targets[t], gone: true });
      first = plan[0].row;
      plan.forEach(function (pl) {
        var old = sh.getRange(pl.row, 1, 1, width).getValues()[0];
        undo.push(function () { sh.getRange(pl.row, 1, 1, width).setValues([old]); });
        if (pl.gone) { sh.getRange(pl.row, 1, 1, width).clearContent(); return; }
        sh.getRange(pl.row, col.week + 1).setNumberFormat('@'); sh.getRange(pl.row, col.item + 1).setNumberFormat('@');
        sh.getRange(pl.row, col.price + 1).setNumberFormat('$0.00');
        sh.getRange(pl.row, 1, 1, width).setValues([pl.vals]);
      });
      SpreadsheetApp.flush();
      plan.forEach(function (pl) {
        var back = sh.getRange(pl.row, 1, 1, width).getValues()[0];
        if (pl.gone) { if (String(back[col.item]).trim() !== '') throw new Error('read-back mismatch (cleared row ' + pl.row + ')'); return; }
        var bp = toNum_(back[col.price]), wp = pl.vals[col.price] === '' ? null : pl.vals[col.price];
        if (toKey_(back[col.week]) !== week || String(back[col.item]) !== pl.vals[col.item] || (wp === null ? bp !== null : (bp === null || Math.abs(bp - wp) > 0.0001))) throw new Error('read-back mismatch (row ' + pl.row + ')');
      });
      apiOrdJournal_(jss, 'weekmenuset', first, API_ORD.name + ': menu for week ' + week, cur.length + ' items', menu.length + ' items: ' + menu.map(function (m) { return m.item.substring(0, 20); }).join(', '), cid);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiOrdJournal_(jss, 'weekmenuset', first, API_ORD.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows restored') + ' (cid ' + cid + ')', ''); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.createdSheet = created; out.wouldCreateSheet = false;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* v45 — Lisa's Personal Training: `ptclients` (read), `ptclientset`,       */
/*   `ptclientdel`, `ptworkoutset`, `ptworkoutdel` (admin writes).          */
/*   Storage: a Google Sheet "Lisa's Personal Training" with two tabs,      */
/*   "Clients" and "Workouts", created lazily by the first real write       */
/*   (never by a read and never by dry=1; dry runs report wouldCreateSheet).*/
/*   It is filed in the Lisa's Table Drive folder (same as the Orders        */
/*   sheet; there is no separate PT folder); if the move fails the sheet     */
/*   stays in My Drive root and the write response carries sheetNote.        */
/*   Its id is kept in Script Property CC_PT_SHEET_ID; when unset the folder */
/*   is searched for an existing sheet of that name before one is created.   */
/*   Clients : Id | Name | Age | Phone | Email | Condition | Ailments |      */
/*             Goals | Previous workouts | Medications | Schedule | Status | */
/*             Start date | Notes | Created | Updated                       */
/*   Workouts: Id | Client id | Date | Title | Exercises | Notes | Done |    */
/*             Done on | Created | Updated                                  */
/*   Conventions as the Wish List / Orders: passcode (dispatcher), cid       */
/*   idempotency (apiAdminSeenCid_), dry=1 writes nothing, script lock,      */
/*   read-back verify + undo (write_failed / rolledBack), values-only tab    */
/*   backup (apiTabBackup_, first write of the day) and a "CC write log"     */
/*   journal row per write. The journal (a FINANCE sheet) only ever gets the */
/*   client name + the NAMES of the changed fields, never health details.    */
/*   Cells are written as text (no formulas); input is validated and capped  */
/*   (too long / bad value = error, nothing written); account-number-looking */
/*   text is rejected (phone numbers are exempt).                            */
/* ======================================================================= */
var API_PT = {
  name: "Lisa's Personal Training",
  folderId: '1k7yFqwv3KQcmUxI-neeVKkZl7mqqCvXR',   // Lisa's Table folder (Code.gs)
  prop: 'CC_PT_SHEET_ID',
  clientsTab: 'Clients', workoutsTab: 'Workouts',
  clientHead: ['Id', 'Name', 'Age', 'Phone', 'Email', 'Condition', 'Ailments / injuries', 'Goals', 'Previous workouts / experience', 'Medications', 'Schedule / frequency', 'Status', 'Start date', 'Notes', 'Created', 'Updated'],
  workoutHead: ['Id', 'Client id', 'Date', 'Title', 'Exercises', 'Notes', 'Done', 'Done on', 'Created', 'Updated'],
  // key, kind, max chars (long = multi-line text)
  clientFields: [['name', 'text', 80], ['age', 'age', 3], ['phone', 'phone', 30], ['email', 'email', 120], ['condition', 'text', 300], ['ailments', 'long', 1500], ['goals', 'long', 1500],
                 ['experience', 'long', 1500], ['medications', 'long', 1000], ['schedule', 'text', 200], ['status', 'status', 10], ['startDate', 'date', 10], ['notes', 'long', 2000]],
  maxClients: 300, maxWorkoutsPerClient: 500, maxId: 40, maxExLines: 80, maxExLine: 300,
  statuses: ['active', 'paused'],
  sheetMime: 'application/vnd.google-apps.spreadsheet'
};
var API_PT_CSPEC = { id: ['id'], name: ['name', 'client'], age: ['age'], phone: ['phone'], email: ['email'], condition: ['condition'], ailments: ['ailments / injuries', 'ailments', 'injuries'],
  goals: ['goals'], experience: ['previous workouts / experience', 'previous workouts', 'experience'], medications: ['medications'], schedule: ['schedule / frequency', 'schedule'],
  status: ['status'], startDate: ['start date', 'started'], notes: ['notes'], created: ['created'], updated: ['updated'] };
var API_PT_WSPEC = { id: ['id'], clientId: ['client id', 'clientid'], date: ['date'], title: ['title', 'workout'], exercises: ['exercises'], notes: ['notes'], done: ['done'], doneOn: ['done on'], created: ['created'], updated: ['updated'] };

/** Input text: strings only (objects rejected). multi keeps line breaks. Returns {v} or {err}. Too long = error (never silently truncated). */
function apiPtIn_(v, max, multi, label) {
  if (v != null && typeof v === 'object') return { err: { error: 'bad_value', message: label + ' must be text.' } };
  var s = String(v == null ? '' : v).replace(/\r\n?/g, '\n');
  s = multi ? s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n')
            : s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ');
  s = s.trim();
  if (s.length > max) return { err: { error: 'too_long', message: label + ' is too long (max ' + max + ' characters).' } };
  return { v: s };
}
/** Stored cell -> safe display text (control chars removed, line breaks kept when multi, account-number-looking text masked). */
function apiPtShow_(v, max, multi) {
  var s = v instanceof Date ? toKey_(v) : String(v == null ? '' : v);
  s = multi ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim() : s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.substring(0, max || 300);
}
function apiPtNewId_(prefix, taken) {
  var id;
  do { id = prefix + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36); } while (taken[id]);
  taken[id] = true;
  return id;
}
function apiPtStamp_() { return new Date().toISOString(); }
function apiPtBool_(v) {                       // true | false | null (= not a boolean)
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if (/^(1|true|yes|y|done|x)$/.test(t)) return true;
  if (/^(0|false|no|n|open|)$/.test(t)) return false;
  return null;
}
function apiPtCellBool_(v) { return /^\s*(yes|true|1|done|x|\u2713|\u2714)\s*$/i.test(String(v == null ? '' : v)); }

/** Validate + normalise the client fields present in p. Only keys that are present (p[k] !== undefined) are returned; "" clears a field. Returns {vals} or {err}. */
function apiPtClientVals_(p) {
  var vals = {}, f, i, k, kind, max, r, s;
  for (i = 0; i < API_PT.clientFields.length; i++) {
    f = API_PT.clientFields[i]; k = f[0]; kind = f[1]; max = f[2];
    if (p[k] === undefined) continue;
    r = apiPtIn_(p[k], kind === 'age' ? 12 : max, kind === 'long', k);
    if (r.err) return r;
    s = r.v;
    if (kind === 'age') {
      if (s !== '') {
        if (!/^\d{1,3}$/.test(s) || Number(s) < 0 || Number(s) > 120) return { err: { error: 'bad_value', message: 'age must be a whole number from 0 to 120.' } };
        s = String(Number(s));
      }
    } else if (kind === 'phone') {
      if (s !== '' && (!/^[0-9+()\-.\s]{5,30}$/.test(s) || (s.match(/\d/g) || []).length < 7 || (s.match(/\d/g) || []).length > 15)) return { err: { error: 'bad_value', message: 'phone must be a phone number (digits, spaces, + ( ) - .).' } };
    } else if (kind === 'email') {
      if (s !== '' && !/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[A-Za-z]{2,}$/.test(s)) return { err: { error: 'bad_value', message: 'email does not look like an email address.' } };
    } else if (kind === 'status') {
      s = s.toLowerCase();
      if (API_PT.statuses.indexOf(s) < 0) return { err: { error: 'bad_value', message: "status must be 'active' or 'paused'." } };
    } else if (kind === 'date') {
      if (s !== '' && !apiAdminDate_(s)) return { err: { error: 'bad_value', message: 'startDate must be a real date, yyyy-mm-dd.' } };
    } else if (s !== '' && apiAdminHasAcctNo_(s)) return { err: { error: 'no_account_numbers', message: 'Do not send account numbers (' + k + ').' } };
    vals[k] = s;
  }
  return { vals: vals };
}
/** exercises: free text, an array, or a JSON-array string; objects become one JSON line each. Returns {v} or {err}. */
function apiPtExercises_(v) {
  if (v === undefined) return { v: undefined };
  var arr = null;
  if (Array.isArray(v)) arr = v;
  else if (typeof v === 'string' && /^\s*\[/.test(v)) { try { var j = JSON.parse(v); if (Array.isArray(j)) arr = j; } catch (e) { arr = null; } }
  else if (v != null && typeof v === 'object') return { err: { error: 'bad_value', message: 'exercises must be text or a list.' } };
  var text = v;
  if (arr) {
    var lines = [];
    for (var i = 0; i < arr.length; i++) {
      var x = arr[i];
      if (x == null || x === '') continue;
      lines.push(typeof x === 'object' ? JSON.stringify(x) : String(x));
    }
    text = lines.join('\n');
  }
  var r = apiPtIn_(text, 4000, true, 'exercises');
  if (r.err) return r;
  var ls = r.v === '' ? [] : r.v.split('\n');
  if (ls.length > API_PT.maxExLines) return { err: { error: 'too_long', message: 'exercises has too many lines (max ' + API_PT.maxExLines + ').' } };
  for (var q = 0; q < ls.length; q++) if (ls[q].length > API_PT.maxExLine * 2) return { err: { error: 'too_long', message: 'an exercise line is too long.' } };
  if (r.v !== '' && apiAdminHasAcctNo_(r.v)) return { err: { error: 'no_account_numbers', message: 'Do not send account numbers (exercises).' } };
  return { v: r.v };
}

/**
 * Locate the sheet. create=false (reads, dry runs): never creates or stores anything; returns {none:true} when there is none yet (shC / shW may be null when a tab is missing).
 * create=true (real writes, under the script lock): creates + files it in the Lisa's Table folder, stores its id in CC_PT_SHEET_ID and makes sure both tabs + headers exist.
 * Returns {ss, shC, shW, created, note} or {none:true} or {error}.
 */
function apiPtSheet_(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty(API_PT.prop), ss = null, created = false, note = '';
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) {
      return { error: 'pt_sheet_unavailable', message: 'The Personal Training sheet (CC_PT_SHEET_ID) cannot be opened: ' + String(e && e.message || e).substring(0, 160) + '. Nothing was created.' };
    }
  } else {
    var found = null, it = DriveApp.getFolderById(API_PT.folderId).getFilesByName(API_PT.name);
    while (it.hasNext()) {
      var f = it.next();
      if (f.getMimeType() === API_PT.sheetMime && !(f.isTrashed && f.isTrashed())) { found = f; break; }
    }
    if (found) {
      ss = SpreadsheetApp.openById(found.getId());
      if (create) props.setProperty(API_PT.prop, found.getId());
    } else if (create) {
      ss = SpreadsheetApp.create(API_PT.name);
      props.setProperty(API_PT.prop, ss.getId());                        // remember it first so a later failure can never create a second one
      created = true;
      try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(API_PT.folderId)); }
      catch (e2) { note = 'created but could not be moved into the Lisa\'s Table folder (left in My Drive): ' + String(e2 && e2.message || e2).substring(0, 160); }
    } else return { none: true };
  }
  var shC = ss.getSheetByName(API_PT.clientsTab), shW = ss.getSheetByName(API_PT.workoutsTab);
  if (create) {
    if (!shC) {
      var first = ss.getSheets()[0];
      if (created && first && ss.getSheets().length === 1 && first.getLastRow() === 0) { first.setName(API_PT.clientsTab); shC = first; }
      else shC = ss.insertSheet(API_PT.clientsTab);
    }
    if (!shW) shW = ss.insertSheet(API_PT.workoutsTab);
    apiOrdHead_(shC, API_PT.clientHead);
    apiOrdHead_(shW, API_PT.workoutHead);
  }
  return { ss: ss, shC: shC, shW: shW, created: created, note: note };
}
/** Rows of one tab. {col, values} or {error:no_columns}; an empty / missing tab gives col:null, values:[]. */
function apiPtRead_(sh, spec, need) {
  var values = sh ? sh.getDataRange().getValues() : [];
  if (values.length < 1 || String(values[0].join('')).trim() === '') return { col: null, values: [] };
  var col = mapHeaders_(values[0], spec);
  for (var q = 0; q < need.length; q++) if (col[need[q]] < 0) return { error: 'no_columns', message: 'Personal Training needs a ' + need[q] + ' column.' };
  return { col: col, values: values };
}
function apiPtClientObj_(values, col, r) {
  var v = values[r], g = function (k, max, multi) { return col[k] >= 0 ? apiPtShow_(v[col[k]], max, multi) : ''; };
  var age = col.age >= 0 ? toNum_(v[col.age]) : null, st = g('status', 10).toLowerCase();
  return { id: g('id', API_PT.maxId), row: r + 1, name: g('name', 80), age: age === null || age < 0 || age > 120 ? '' : Math.floor(age), phone: g('phone', 30), email: g('email', 120),
    condition: g('condition', 300), ailments: g('ailments', 1500, true), goals: g('goals', 1500, true), experience: g('experience', 1500, true), medications: g('medications', 1000, true),
    schedule: g('schedule', 200), status: st === 'paused' ? 'paused' : 'active', startDate: col.startDate >= 0 ? toKey_(v[col.startDate]) : '', notes: g('notes', 2000, true),
    created: g('created', 30), updated: g('updated', 30) };
}
function apiPtWorkoutObj_(values, col, r) {
  var v = values[r], g = function (k, max, multi) { return col[k] >= 0 ? apiPtShow_(v[col[k]], max, multi) : ''; };
  return { id: g('id', API_PT.maxId), row: r + 1, clientId: g('clientId', API_PT.maxId), date: col.date >= 0 ? toKey_(v[col.date]) : '', title: g('title', 120),
    exercises: g('exercises', 4000, true), notes: g('notes', 1500, true), done: col.done >= 0 && apiPtCellBool_(v[col.done]), doneOn: col.doneOn >= 0 ? toKey_(v[col.doneOn]) : '',
    created: g('created', 30), updated: g('updated', 30) };
}
function apiPtClients_(rd) {      // all client objects (rows with an Id and a Name)
  var out = [];
  if (!rd.col) return out;
  for (var r = 1; r < rd.values.length; r++) {
    var o = apiPtClientObj_(rd.values, rd.col, r);
    if (o.id && o.name) out.push(o);
  }
  return out;
}
function apiPtWorkouts_(rd) {
  var out = [];
  if (!rd.col) return out;
  for (var r = 1; r < rd.values.length; r++) {
    var o = apiPtWorkoutObj_(rd.values, rd.col, r);
    if (o.id && o.clientId) out.push(o);
  }
  return out;
}
function apiPtWorkoutSort_(a, b) { return a.date === b.date ? b.row - a.row : (a.date < b.date ? 1 : -1); }   // newest date first, then lowest in the sheet first
function apiPtRowFind_(rd, id) {  // 0-based index of the row whose Id cell is exactly id, or -1
  if (!rd.col || !id) return -1;
  for (var r = 1; r < rd.values.length; r++) if (String(rd.values[r][rd.col.id] == null ? '' : rd.values[r][rd.col.id]).trim() === id) return r;
  return -1;
}
function apiPtText_(sh, row1, nrows, width) { sh.getRange(row1, 1, nrows, width).setNumberFormat('@'); }
/** Put a whole tab back exactly as snapshot (undo of a failed delete). */
function apiPtRestore_(sh, snap) {
  var w = snap.length ? snap[0].length : 0;
  sh.getRange(1, 1, Math.max(sh.getLastRow(), snap.length, 1), Math.max(sh.getLastColumn(), w, 1)).clearContent();
  if (snap.length && w) { apiPtText_(sh, 1, snap.length, w); sh.getRange(1, 1, snap.length, w).setValues(snap); }
}

/**
 * action=ptclients  (read-only; creates nothing)
 * Response {ok:true,data:{exists, sheetUrl, counts:{total,active,paused}, orphans, clients:[{id,row,name,age,phone,email,condition,ailments,goals,experience,medications,schedule,
 *   status:'active'|'paused',startDate,notes,created,updated, workoutCount,doneCount,lastWorkout, workouts:[{id,row,clientId,date,title,exercises,notes,done,doneOn,created,updated}]}]}}
 *   clients: active first, then paused, each A-Z by name; workouts: newest date first. No sheet yet -> exists:false, clients:[].
 */
function apiPtClientsList_() {
  var w = apiPtSheet_(false);
  if (w.error) return w;
  if (w.none || !w.ss) return { ok: true, data: { exists: false, sheetUrl: '', counts: { total: 0, active: 0, paused: 0 }, orphans: 0, clients: [] } };
  var rc = apiPtRead_(w.shC, API_PT_CSPEC, ['id', 'name']); if (rc.error) return rc;
  var rw = apiPtRead_(w.shW, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']); if (rw.error) return rw;
  var clients = apiPtClients_(rc), by = {}, url = '', orphans = 0;
  try { url = w.ss.getUrl(); } catch (e) { url = ''; }
  clients.forEach(function (c) { c.workouts = []; by[c.id] = c; });
  apiPtWorkouts_(rw).forEach(function (x) { if (by[x.clientId]) by[x.clientId].workouts.push(x); else orphans++; });
  var counts = { total: clients.length, active: 0, paused: 0 };
  clients.forEach(function (c) {
    counts[c.status]++;
    c.workouts.sort(apiPtWorkoutSort_);
    c.workoutCount = c.workouts.length; c.doneCount = c.workouts.filter(function (x) { return x.done; }).length;
    var past = c.workouts.filter(function (x) { return x.done; })[0] || c.workouts[0];
    c.lastWorkout = past ? past.date : '';
  });
  clients.sort(function (a, b) { return a.status === b.status ? (loose_(a.name) < loose_(b.name) ? -1 : loose_(a.name) > loose_(b.name) ? 1 : 0) : (a.status === 'active' ? -1 : 1); });
  return { ok: true, data: { exists: true, sheetUrl: url, counts: counts, orphans: orphans, clients: clients } };
}

/** Client (with workouts) from freshly read values, for write responses. */
function apiPtClientFull_(shC, shW, id) {
  var rc = apiPtRead_(shC, API_PT_CSPEC, ['id', 'name']), rw = apiPtRead_(shW, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']);
  var c = apiPtClients_(rc).filter(function (x) { return x.id === id; })[0] || null;
  if (c) c.workouts = apiPtWorkouts_(rw).filter(function (x) { return x.clientId === id; }).sort(apiPtWorkoutSort_);
  return c;
}
/** Spreadsheet row (array of width cells) for the object-like map of text values; missing columns skipped. */
function apiPtRowFrom_(col, width, map) {
  var row = [];
  for (var c = 0; c < width; c++) row.push('');
  Object.keys(map).forEach(function (k) { if (col[k] >= 0) row[col[k]] = map[k]; });
  return row;
}

/**
 * action=ptclientset  (admin; GET params or POST body) — create (no id) or update (id) ONE client.
 *   id      existing client id (omit to create)          cid  required when writing          dry=1 previews (nothing written, nothing created)
 *   fields  name (required on create, <=80), age (0-120), phone (<=30), email (<=120), condition (<=300), ailments (<=1500), goals (<=1500), experience (<=1500, previous workouts),
 *           medications (<=1000), schedule (<=200), status 'active'|'paused' (default active), startDate yyyy-mm-dd, notes (<=2000).
 *   Update changes ONLY the fields that are sent (an empty value clears a field; name cannot be cleared). Nothing sent -> unchanged:true.
 *   A second client whose name loosely matches an existing one is refused (error duplicate, with the existing id).
 * Response {ok:true,data:{client:{...with workouts}, created:bool, changed:[field names], unchanged?, dry, cid, createdSheet, wouldCreateSheet?, sheetUrl, sheetNote?}}
 *   same cid again -> {ok:true,data:{duplicate:'cid',...}} and nothing is written.
 */
function apiPtClientSet_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_PT.maxId), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var pv = apiPtClientVals_(p); if (pv.err) return pv.err;
  var vals = pv.vals, keys = Object.keys(vals);
  if (!id && !vals.name) return { error: 'bad_value', message: 'name is required.' };
  if (id && vals.name === '') return { error: 'bad_value', message: 'name cannot be empty.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'ptclientset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiPtSheet_(false); if (w.error) return w;
    var rc = w.none ? { col: null, values: [] } : apiPtRead_(w.shC, API_PT_CSPEC, ['id', 'name']); if (rc.error) return rc;
    var clients = apiPtClients_(rc), idx = -1, before = null, taken = {};
    clients.forEach(function (c) { taken[c.id] = true; });
    if (id) {
      idx = apiPtRowFind_(rc, id);
      if (idx < 0) return { error: 'not_found', message: 'No client with that id. Nothing changed.' };
      before = apiPtClientObj_(rc.values, rc.col, idx);
    } else if (clients.length >= API_PT.maxClients) return { error: 'limit', message: 'Too many clients (max ' + API_PT.maxClients + ').' };
    if (vals.name) {
      var dup = clients.filter(function (c) { return c.id !== id && loose_(c.name) === loose_(vals.name); })[0];
      if (dup) return { error: 'duplicate', message: 'A client with that name already exists.', existing: { id: dup.id, name: dup.name } };
    }
    var changed = keys.filter(function (k) { return !before || String(before[k] == null ? '' : before[k]) !== vals[k]; });
    var nowIso = apiPtStamp_();
    out.created = !id; out.changed = changed;
    if (id && !changed.length) { out.unchanged = true; out.client = apiPtClientFull_(w.shC, w.shW, id); out.sheetUrl = ''; try { out.sheetUrl = w.ss.getUrl(); } catch (e0) { /* ignore */ } return { ok: true, data: out }; }
    if (dry) {
      var prev = before ? JSON.parse(JSON.stringify(before)) : { id: '', row: 0, name: '', age: '', phone: '', email: '', condition: '', ailments: '', goals: '', experience: '', medications: '', schedule: '', status: 'active', startDate: '', notes: '', created: nowIso, updated: nowIso, workouts: [] };
      keys.forEach(function (k) { prev[k] = k === 'age' && vals[k] !== '' ? Number(vals[k]) : vals[k]; });
      if (!id) { prev.status = vals.status || 'active'; out.wouldCreateSheet = !!w.none; }
      out.client = prev; out.createdSheet = false; out.sheetUrl = '';
      try { if (w.ss) out.sheetUrl = w.ss.getUrl(); } catch (e1) { /* ignore */ }
      return { ok: true, data: out };
    }

    var sh = null, undo = [], rowNum = 0, newId = id;
    try {
      var ws = apiPtSheet_(true); if (ws.error) return ws;
      sh = ws.shC; if (ws.note) out.sheetNote = ws.note;
      var hv = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0], col = mapHeaders_(hv, API_PT_CSPEC);
      if (col.id < 0 || col.name < 0) return { error: 'no_columns', message: 'Clients needs Id and Name columns.' };
      var width = Math.max(sh.getLastColumn(), hv.length, 1);
      var cur = apiPtRead_(sh, API_PT_CSPEC, ['id', 'name']); if (cur.error) return cur;
      if (id) { idx = apiPtRowFind_(cur, id); if (idx < 0) return { error: 'not_found', message: 'No client with that id. Nothing changed.' }; }
      apiTabBackup_(ws.ss, sh);
      var row;
      if (!id) {
        newId = apiPtNewId_('pc', taken);
        var map = { id: newId, created: nowIso, updated: nowIso, status: 'active' };
        keys.forEach(function (k) { map[k] = vals[k]; });
        row = apiPtRowFrom_(col, width, map); rowNum = Math.max(sh.getLastRow(), 1) + 1;
        undo.push(function () { sh.getRange(rowNum, 1, 1, width).clearContent(); });
      } else {
        rowNum = idx + 1;
        var oldRow = cur.values[idx].slice(); while (oldRow.length < width) oldRow.push('');
        row = oldRow.slice();
        keys.forEach(function (k) { if (col[k] >= 0) row[col[k]] = vals[k]; });
        if (col.updated >= 0) row[col.updated] = nowIso;
        undo.push(function () { sh.getRange(rowNum, 1, 1, width).setValues([oldRow]); });
      }
      apiPtText_(sh, rowNum, 1, width);
      sh.getRange(rowNum, 1, 1, width).setValues([row]);
      SpreadsheetApp.flush();
      var back = sh.getRange(rowNum, 1, 1, width).getValues()[0];
      if (String(back[col.id]) !== newId) throw new Error('read-back mismatch after save');
      for (var q = 0; q < keys.length; q++) if (col[keys[q]] >= 0 && String(back[col[keys[q]]]) !== String(row[col[keys[q]]])) throw new Error('read-back mismatch after save (' + keys[q] + ')');
      apiSpendJournal_(jss, [new Date(), 'ptclientset', rowNum, API_PT.name + ': ' + (id ? 'update' : 'add') + ' client ' + (vals.name || before.name).substring(0, 60), id ? 'fields: ' + changed.join(', ') : '', id ? '(updated)' : '(added)', cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'ptclientset', rowNum, API_PT.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    var sw = apiPtSheet_(false);
    out.client = apiPtClientFull_(sw.shC, sw.shW, newId); out.createdSheet = !!ws.created;
    try { out.sheetUrl = sw.ss.getUrl(); } catch (e4) { out.sheetUrl = ''; }
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=ptclientdel  (admin; GET params or POST body) — delete ONE client AND all of that client's workouts.
 *   id    the client id (from ptclients)     name  the client's name, REQUIRED as verification (loose match)     cid  required when writing     dry=1 previews
 * Verify, then delete: id found, name loosely matches (else row_mismatch, nothing deleted). Values-only backups of both tabs (first write of the day), rows removed with deleteRow
 * (workouts bottom-up, then the client); read-back must equal "before minus those rows" or both tabs are put back exactly (write_failed / rolledBack).
 * Response {ok:true,data:{deleted:{id,row,name,...}, workoutsDeleted:N, deletedOk:true, dry, cid}}
 */
function apiPtClientDel_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_PT.maxId), name = apiAdminClean_(p.name, 200), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  if (!name) return { error: 'bad_value', message: 'name is required (verification text).' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'ptclientdel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiPtSheet_(false); if (w.error) return w;
    if (w.none || !w.shC) return { error: 'not_found', message: 'There are no clients yet.' };
    var rc = apiPtRead_(w.shC, API_PT_CSPEC, ['id', 'name']); if (rc.error) return rc;
    var rw = apiPtRead_(w.shW, API_PT_WSPEC, ['id', 'clientId']); if (rw.error) return rw;
    var idx = apiPtRowFind_(rc, id);
    if (idx < 0) return { error: 'not_found', message: 'No client with that id. Nothing deleted.' };
    var info = apiPtClientObj_(rc.values, rc.col, idx);
    if (!apiDelLabelOk_(info.name, name)) return { error: 'row_mismatch', message: 'That id belongs to a different client. Nothing deleted.', actual: { id: info.id, name: info.name } };
    var wRows = [];
    if (rw.col) for (var r = 1; r < rw.values.length; r++) if (String(rw.values[r][rw.col.clientId] == null ? '' : rw.values[r][rw.col.clientId]).trim() === id) wRows.push(r);
    out.deleted = info; out.workoutsDeleted = wRows.length;
    if (dry) return { ok: true, data: out };

    var snapC = rc.values.map(function (x) { return x.slice(); }), snapW = rw.values.map(function (x) { return x.slice(); }), undo = [];
    var expC = snapC.filter(function (x, i) { return i !== idx; }).map(function (x) { return String(x[rc.col.id]); });
    var expW = rw.col ? snapW.filter(function (x, i) { return wRows.indexOf(i) < 0; }).map(function (x) { return String(x[rw.col.id]); }) : [];
    try {
      apiTabBackup_(w.ss, w.shC); if (w.shW) apiTabBackup_(w.ss, w.shW);
      undo.push(function () { apiPtRestore_(w.shC, snapC); if (w.shW && rw.col) apiPtRestore_(w.shW, snapW); });
      for (var k = wRows.length - 1; k >= 0; k--) w.shW.deleteRow(wRows[k] + 1);
      w.shC.deleteRow(idx + 1);
      SpreadsheetApp.flush();
      var aC = apiPtRead_(w.shC, API_PT_CSPEC, ['id', 'name']), aW = apiPtRead_(w.shW, API_PT_WSPEC, ['id', 'clientId']);
      var gotC = aC.col ? aC.values.slice(1).map(function (x) { return String(x[aC.col.id]); }) : [], gotW = aW.col ? aW.values.slice(1).map(function (x) { return String(x[aW.col.id]); }) : [];
      if (JSON.stringify(gotC) !== JSON.stringify(expC.slice(1))) throw new Error('read-back mismatch after client delete');
      if (rw.col && JSON.stringify(gotW) !== JSON.stringify(expW.slice(1))) throw new Error('read-back mismatch after workout delete');
      apiSpendJournal_(jss, [new Date(), 'ptclientdel', idx + 1, API_PT.name + ': delete client ' + info.name.substring(0, 60), wRows.length + ' workout(s)', '(deleted)', cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'ptclientdel', idx + 1, API_PT.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'rows restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.deletedOk = true;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=ptworkoutset  (admin; GET params or POST body) — create (no id) or update (id) ONE workout of a client.
 *   id        existing workout id (omit to create)         clientId  required on create (must exist); cannot be changed on update
 *   date      yyyy-mm-dd (default today on create)         title     required on create (<=120)
 *   exercises free text (<=4000, <=80 lines), or an array / JSON-array string (objects become one JSON line each)
 *   notes     <=1500                                       done      1|0|true|false (done:true sets Done on = today the first time; false clears it)
 *   cid       required when writing                        dry=1 previews (nothing written)
 *   Update changes ONLY the fields that are sent. Max 500 workouts per client.
 * Response {ok:true,data:{workout:{id,row,clientId,date,title,exercises,notes,done,doneOn,created,updated}, created:bool, changed:[..], unchanged?, dry, cid}}
 */
function apiPtWorkoutSet_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_PT.maxId), clientId = apiAdminClean_(p.clientId, API_PT.maxId), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  var vals = {}, r;
  if (p.title !== undefined) { r = apiPtIn_(p.title, 120, false, 'title'); if (r.err) return r.err; vals.title = r.v; if (r.v && apiAdminHasAcctNo_(r.v)) return { error: 'no_account_numbers', message: 'Do not send account numbers (title).' }; }
  if (p.notes !== undefined) { r = apiPtIn_(p.notes, 1500, true, 'notes'); if (r.err) return r.err; vals.notes = r.v; if (r.v && apiAdminHasAcctNo_(r.v)) return { error: 'no_account_numbers', message: 'Do not send account numbers (notes).' }; }
  if (p.date !== undefined && String(p.date).trim() !== '') { r = apiPtIn_(p.date, 10, false, 'date'); if (r.err) return r.err; if (!apiAdminDate_(r.v)) return { error: 'bad_value', message: 'date must be a real date, yyyy-mm-dd.' }; vals.date = r.v; }
  else if (p.date !== undefined && id) return { error: 'bad_value', message: 'date cannot be empty.' };
  var ex = apiPtExercises_(p.exercises); if (ex.err) return ex.err;
  if (ex.v !== undefined) vals.exercises = ex.v;
  var done = null;
  if (p.done !== undefined) { done = apiPtBool_(p.done); if (done === null) return { error: 'bad_value', message: 'done must be 1/0 or true/false.' }; }
  if (!id && !clientId) return { error: 'bad_value', message: 'clientId is required.' };
  if (!id && !vals.title) return { error: 'bad_value', message: 'title is required.' };
  if (id && vals.title === '') return { error: 'bad_value', message: 'title cannot be empty.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'ptworkoutset', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiPtSheet_(false); if (w.error) return w;
    if (w.none || !w.shC) return { error: 'not_found', message: 'There are no clients yet.' };
    var rc = apiPtRead_(w.shC, API_PT_CSPEC, ['id', 'name']); if (rc.error) return rc;
    var rw = w.shW ? apiPtRead_(w.shW, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']) : { col: null, values: [] }; if (rw.error) return rw;
    var works = apiPtWorkouts_(rw), idx = -1, before = null, taken = {};
    works.forEach(function (x) { taken[x.id] = true; });
    if (id) {
      idx = apiPtRowFind_(rw, id);
      if (idx < 0) return { error: 'not_found', message: 'No workout with that id. Nothing changed.' };
      before = apiPtWorkoutObj_(rw.values, rw.col, idx);
      if (clientId && clientId !== before.clientId) return { error: 'bad_value', message: 'A workout cannot move to another client.' };
      clientId = before.clientId;
    }
    var cIdx = apiPtRowFind_(rc, clientId);
    if (cIdx < 0) return { error: 'not_found', message: 'No client with that id. Nothing changed.' };
    var cname = apiPtClientObj_(rc.values, rc.col, cIdx).name;
    if (!id && works.filter(function (x) { return x.clientId === clientId; }).length >= API_PT.maxWorkoutsPerClient) return { error: 'limit', message: 'Too many workouts for this client (max ' + API_PT.maxWorkoutsPerClient + ').' };
    var today = todayKey_(), nowIso = apiPtStamp_();
    if (!id && !vals.date) vals.date = today;
    var after = before ? JSON.parse(JSON.stringify(before)) : { id: '', row: 0, clientId: clientId, date: today, title: '', exercises: '', notes: '', done: false, doneOn: '', created: nowIso, updated: nowIso };
    var changed = [];
    Object.keys(vals).forEach(function (k) { if (!before || String(before[k]) !== vals[k]) changed.push(k); after[k] = vals[k]; });
    if (done !== null && (!before || before.done !== done)) { changed.push('done'); after.done = done; after.doneOn = done ? today : ''; }
    out.created = !id; out.changed = changed;
    if (id && !changed.length) { out.unchanged = true; out.workout = before; return { ok: true, data: out }; }
    if (dry) { after.updated = nowIso; out.workout = after; out.createdSheet = false; return { ok: true, data: out }; }

    var sh = null, undo = [], rowNum = 0, newId = id;
    try {
      var ws = apiPtSheet_(true); if (ws.error) return ws;
      sh = ws.shW; if (ws.note) out.sheetNote = ws.note;
      var hv = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0], col = mapHeaders_(hv, API_PT_WSPEC);
      if (col.id < 0 || col.clientId < 0 || col.date < 0 || col.title < 0) return { error: 'no_columns', message: 'Workouts needs Id, Client id, Date and Title columns.' };
      var width = Math.max(sh.getLastColumn(), hv.length, 1);
      var cur = apiPtRead_(sh, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']); if (cur.error) return cur;
      if (id) { idx = apiPtRowFind_(cur, id); if (idx < 0) return { error: 'not_found', message: 'No workout with that id. Nothing changed.' }; }
      apiTabBackup_(ws.ss, sh);
      var cells = { clientId: clientId, date: after.date, title: after.title, exercises: after.exercises, notes: after.notes, done: after.done ? 'yes' : '', doneOn: after.doneOn, updated: nowIso }, row;
      if (!id) {
        newId = apiPtNewId_('pw', taken);
        cells.id = newId; cells.created = nowIso;
        row = apiPtRowFrom_(col, width, cells); rowNum = Math.max(sh.getLastRow(), 1) + 1;
        undo.push(function () { sh.getRange(rowNum, 1, 1, width).clearContent(); });
      } else {
        rowNum = idx + 1;
        var oldRow = cur.values[idx].slice(); while (oldRow.length < width) oldRow.push('');
        row = oldRow.slice();
        Object.keys(cells).forEach(function (k) { if (col[k] >= 0) row[col[k]] = cells[k]; });
        undo.push(function () { sh.getRange(rowNum, 1, 1, width).setValues([oldRow]); });
      }
      apiPtText_(sh, rowNum, 1, width);
      sh.getRange(rowNum, 1, 1, width).setValues([row]);
      SpreadsheetApp.flush();
      var back = sh.getRange(rowNum, 1, 1, width).getValues()[0];
      if (String(back[col.id]) !== newId || String(back[col.clientId]) !== clientId || String(back[col.title]) !== after.title) throw new Error('read-back mismatch after save');
      apiSpendJournal_(jss, [new Date(), 'ptworkoutset', rowNum, API_PT.name + ': ' + (id ? 'update' : 'add') + ' workout for ' + cname.substring(0, 60), id ? 'fields: ' + changed.join(', ') : '', (id ? '(updated) ' : '(added) ') + after.date, cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'ptworkoutset', rowNum, API_PT.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    var sw = apiPtSheet_(false), nrw = apiPtRead_(sw.shW, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']);
    out.workout = apiPtWorkouts_(nrw).filter(function (x) { return x.id === newId; })[0] || after; out.createdSheet = !!ws.created;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=ptworkoutdel  (admin; GET params or POST body) — delete ONE workout.
 *   id  the workout id (from ptclients)     title  the workout title, REQUIRED as verification (loose match)     cid  required when writing     dry=1 previews
 * Same verify-then-delete as wishdel: wrong title -> row_mismatch, nothing deleted; backup tab; deleteRow; read-back must equal "before minus that row" or the row is put back.
 * Response {ok:true,data:{deleted:{id,row,clientId,date,title,...}, deletedOk:true, dry, cid}}
 */
function apiPtWorkoutDel_(p) {
  p = p || {};
  var id = apiAdminClean_(p.id, API_PT.maxId), title = apiAdminClean_(p.title, 300), cid = apiAdminClean_(p.cid, 80), dry = apiAdminBool_(p.dry);
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  if (!title) return { error: 'bad_value', message: 'title is required (verification text).' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var jss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), out = { dry: dry, cid: cid };
    if (apiAdminSeenCid_(jss, 'ptworkoutdel', cid)) { out.duplicate = 'cid'; return { ok: true, data: out }; }
    var w = apiPtSheet_(false); if (w.error) return w;
    if (w.none || !w.shW) return { error: 'not_found', message: 'There are no workouts yet.' };
    var rw = apiPtRead_(w.shW, API_PT_WSPEC, ['id', 'clientId', 'date', 'title']); if (rw.error) return rw;
    var idx = apiPtRowFind_(rw, id);
    if (idx < 0) return { error: 'not_found', message: 'No workout with that id. Nothing deleted.' };
    var info = apiPtWorkoutObj_(rw.values, rw.col, idx);
    if (!apiDelLabelOk_(info.title, title)) return { error: 'row_mismatch', message: 'That id belongs to a different workout. Nothing deleted.', actual: { id: info.id, title: info.title, date: info.date } };
    out.deleted = info;
    if (dry) return { ok: true, data: out };

    var snap = rw.values.map(function (x) { return x.slice(); }), undo = [], exp = snap.filter(function (x, i) { return i !== idx; }).map(function (x) { return String(x[rw.col.id]); }).slice(1);
    try {
      apiTabBackup_(w.ss, w.shW);
      undo.push(function () { apiPtRestore_(w.shW, snap); });
      w.shW.deleteRow(idx + 1);
      SpreadsheetApp.flush();
      var a = apiPtRead_(w.shW, API_PT_WSPEC, ['id']), got = a.col ? a.values.slice(1).map(function (x) { return String(x[a.col.id]); }) : [];
      if (JSON.stringify(got) !== JSON.stringify(exp)) throw new Error('read-back mismatch after delete');
      apiSpendJournal_(jss, [new Date(), 'ptworkoutdel', idx + 1, API_PT.name + ': delete workout', info.date, '(deleted)', cid]);
    } catch (werr) {
      var uerr = apiAdminUndo_(undo);
      try { apiSpendJournal_(jss, [new Date(), 'ptworkoutdel', idx + 1, API_PT.name + ': ROLLED BACK', String(werr && werr.message || werr).substring(0, 200), (uerr.length ? 'undo errors: ' + uerr.join('; ') : 'row restored') + ' (cid ' + cid + ')', '']); } catch (je) { /* log unavailable */ }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: !uerr.length, undoErrors: uerr };
    }
    out.deletedOk = true;
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================== */
/* Health Metrics (v51) — Fitness & Health > Medical > Health Metrics        */
/*   Sheet "Health Metrics" in Second Brain/Fitness & Health/Medical, one    */
/*   header row: Metric | Current value | Unit | Optimal/target range |      */
/*   Date measured | Measurement standard/source | Levers (diet/supplement)  */
/*   | Notes. It starts EMPTY; the phone adds rows. Same passcode check as   */
/*   every action (apiDispatch_). Read creates nothing. Writes: LockService, */
/*   cid retry-safety (6 h), plain-text cells (no date/number auto-convert), */
/*   only the sent fields change, nothing is ever deleted, every write is    */
/*   journaled on a "CC write log" tab in the same sheet.                    */
/* ======================================================================== */
var API_HM_CFG = {
  sheetId: '1NMxPbmskd-yfP3PNg5qgFiivwZFWmyGF2dEL-CIxTgQ',
  tab: '',                 // '' = the first tab (it is still called "Untitled" / "Sheet1")
  fields: [                // key, header written when missing, header candidates, max length
    ['metric', 'Metric', ['metric', 'metric name', 'name'], 120],
    ['value',  'Current value', ['current value', 'value', 'current'], 120],
    ['unit',   'Unit', ['unit', 'units'], 40],
    ['range',  'Optimal/target range', ['optimal/target range', 'optimal range', 'target range', 'optimal', 'target'], 200],
    ['date',   'Date measured', ['date measured', 'date', 'measured'], 40],
    ['source', 'Measurement standard/source', ['measurement standard/source', 'measurement standard', 'source', 'standard'], 300],
    ['levers', 'Levers (diet/supplement)', ['levers (diet/supplement)', 'levers', 'diet/supplement'], 1000],
    ['notes',  'Notes', ['notes', 'note', 'comments'], 2000]
  ],
  maxRows: 500,
  journalTab: 'CC write log'
};

function apiHmSheet_() {
  var ss = SpreadsheetApp.openById(API_HM_CFG.sheetId);
  var sh = API_HM_CFG.tab ? ss.getSheetByName(API_HM_CFG.tab) : ss.getSheets()[0];
  if (!sh) throw new Error('Health Metrics tab not found.');
  return { ss: ss, sh: sh };
}

function apiHmCols_(headerRow) {
  var spec = {};
  API_HM_CFG.fields.forEach(function (f) { spec[f[0]] = f[2]; });
  return mapHeaders_(headerRow, spec);
}

function apiHmRead_(sh) {
  var lastRow = sh.getLastRow(), lastCol = Math.max(1, sh.getLastColumn());
  var vals = lastRow ? sh.getRange(1, 1, lastRow, lastCol).getDisplayValues() : [[]];
  var col = apiHmCols_(vals[0] || []), rows = [];
  for (var r = 1; r < vals.length; r++) {
    var o = { row: r + 1 }, any = false;
    API_HM_CFG.fields.forEach(function (f) {
      var c = col[f[0]], v = c >= 0 ? String(vals[r][c] == null ? '' : vals[r][c]).trim() : '';
      o[f[0]] = v; if (v) any = true;
    });
    if (any) rows.push(o);
  }
  return { col: col, rows: rows, lastRow: lastRow, lastCol: lastCol };
}

function apiHealthMetrics_() {
  var h = apiHmSheet_(), rd = apiHmRead_(h.sh);
  return { ok: true, data: {
    version: 51,
    sheetId: API_HM_CFG.sheetId,
    url: 'https://docs.google.com/spreadsheets/d/' + API_HM_CFG.sheetId + '/edit',
    tab: h.sh.getName(),
    columns: API_HM_CFG.fields.map(function (f) { return { key: f[0], label: f[1], found: rd.col[f[0]] >= 0 }; }),
    metrics: rd.rows
  } };
}

function apiHealthMetricSet_(p) {
  function has(k) { return p[k] !== undefined && p[k] !== null; }
  var F = API_HM_CFG.fields, sent = {}, n = 0, bad = null;
  F.forEach(function (f) {
    if (!has(f[0])) return;
    var v = String(p[f[0]]).replace(/[\r\n]+/g, ' ').trim();
    if (v.length > f[3]) { bad = f[1] + ' is too long (max ' + f[3] + ' characters).'; return; }
    if (/^[=+\-@]/.test(v)) v = "'" + v;     // never let a typed value run as a formula
    sent[f[0]] = v; n++;
  });
  if (bad) return { error: 'bad_value', message: bad };
  var rowIn = has('row') && String(p.row).trim() !== '' ? parseInt(p.row, 10) : 0;
  if (has('row') && String(p.row).trim() !== '' && !(rowIn >= 2)) return { error: 'bad_value', message: 'row must be 2 or more.' };
  if (!rowIn && !sent.metric) return { error: 'bad_value', message: 'Name the metric.' };
  if (rowIn && has('metric') && !sent.metric) return { error: 'bad_value', message: 'A metric needs a name.' };
  if (!n) return { error: 'bad_value', message: 'Nothing to write.' };
  var dry = /^(1|true|yes)$/i.test(String(p.dry || ''));
  var cid = String(p.cid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var cache = CacheService.getScriptCache(), ck = cid ? 'cc_hmset_' + cid : '';

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    if (ck && !dry) { var seen = cache.get(ck); if (seen) { var pj = JSON.parse(seen); pj.duplicate = true; return { ok: true, data: pj }; } }
    var h = apiHmSheet_(), sh = h.sh, rd = apiHmRead_(sh), col = rd.col;
    var addHeads = F.filter(function (f) { return col[f[0]] < 0 && sent[f[0]] !== undefined; }).map(function (f) { return f[1]; });
    var rowNum, before = {};
    if (rowIn) {
      var cur = null;
      rd.rows.forEach(function (x) { if (x.row === rowIn) cur = x; });
      if (!cur) return { error: 'not_found', message: 'That row has no metric. Refresh and try again.' };
      if (has('was') && String(p.was).trim() !== cur.metric) return { error: 'moved', message: 'The sheet changed (row ' + rowIn + ' is now "' + cur.metric + '"). Refresh and try again.' };
      rowNum = rowIn; before = cur;
    } else {
      if (rd.rows.length >= API_HM_CFG.maxRows) return { error: 'too_many', message: 'The list is full (' + API_HM_CFG.maxRows + ' metrics).' };
      var dupe = rd.rows.filter(function (x) { return x.metric.toLowerCase() === sent.metric.replace(/^'/, '').toLowerCase(); })[0];
      if (dupe) return { error: 'duplicate', message: '"' + dupe.metric + '" is already in the list (row ' + dupe.row + '). Edit it instead.' };
      rowNum = Math.max(rd.lastRow, 1) + 1;
    }
    var result = { row: rowNum, created: !rowIn, written: {}, addedColumns: addHeads, dry: dry };
    F.forEach(function (f) { if (sent[f[0]] !== undefined) result.written[f[0]] = { before: before[f[0]] || '', after: sent[f[0]] }; });
    if (dry) return { ok: true, data: result };

    if (addHeads.length) {               // a missing header goes right of the last one (nothing is moved)
      var lc = rd.lastRow ? sh.getLastColumn() : 0;
      addHeads.forEach(function (hd, i) { sh.getRange(1, lc + i + 1).setValue(hd); });
      SpreadsheetApp.flush();
      rd = apiHmRead_(sh); col = rd.col;
    }
    F.forEach(function (f) {
      if (sent[f[0]] === undefined || col[f[0]] < 0) return;
      var cell = sh.getRange(rowNum, col[f[0]] + 1);
      cell.setNumberFormat('@');
      cell.setValue(sent[f[0]]);
    });
    SpreadsheetApp.flush();
    try {
      var jt = h.ss.getSheetByName(API_HM_CFG.journalTab);
      if (!jt) { jt = h.ss.insertSheet(API_HM_CFG.journalTab); jt.appendRow(['When', 'Action', 'Row', 'Field', 'Before', 'After', 'cid']); }
      Object.keys(result.written).forEach(function (k) {
        jt.appendRow([new Date(), rowIn ? 'healthmetricset update' : 'healthmetricset add', rowNum, k, String(result.written[k].before).slice(0, 200), String(result.written[k].after).slice(0, 200), cid]);
      });
    } catch (je) { console.error('CC API health metrics journal error: ' + (je && je.stack || je)); }
    if (ck) cache.put(ck, JSON.stringify(result), 21600);
    return { ok: true, data: result };
  } finally {
    lock.releaseLock();
  }
}

/* ======================================================================= */
/* Lisa's change requests — action=lisareq / lisareqlist / lisareqset /     */
/* lisareqdel (v54). Lisa types or dictates a change she wants in Lisa's     */
/* Table or Lisa's Personal Training; it becomes one row of the Google Sheet */
/* "Lisa Change Requests" (Drive > Second Brain > Lisa's Table). Lisa's      */
/* Assistant reads the rows, does the work and answers in Status + Reply     */
/* (lisareqset, or by typing in the sheet); the app shows them in the box.   */
/* The sheet already exists (created 2026-10-07); nothing here creates one.  */
/* ======================================================================= */
var API_LR = {
  sheetId: '1XIa2IhGWY2DWzqIRsvxzf0A94g8Y9Y7z4ItsPXo5Y8c',   // "Lisa Change Requests"
  folderId: '1k7yFqwv3KQcmUxI-neeVKkZl7mqqCvXR',             // Lisa's Table (fallback: find the sheet by name here)
  name: 'Lisa Change Requests',
  head: ['ID', 'Submitted', 'Section', 'Request', 'Status', 'Reply', 'Updated'],
  maxText: 4000, maxReply: 4000, maxRows: 5000, maxList: 300,
  statuses: ['New', 'In progress', 'Needs your OK', 'Done'],
  sections: { lt: 'Lisa\u2019s Table', pt: 'Personal Training', both: 'Both' },
  testMark: 'TEST'                                            // lisareqdel only removes rows whose Request starts with this
};
/** Request / reply text: control characters out, line breaks kept (at most one blank line), spaces collapsed. */
function apiLrText_(v, max) {
  var s = String(v == null ? '' : v).replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g, ' ')
    .split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
  return s.length > max ? null : s;
}
function apiLrSection_(v) {
  var s = String(v == null ? '' : v).toLowerCase().replace(/[^a-z]/g, '');
  if (!s || s === 'lt' || s === 'lisastable' || s === 'table') return API_LR.sections.lt;
  if (s === 'pt' || s === 'personaltraining' || s === 'lisaspersonaltraining' || s === 'training') return API_LR.sections.pt;
  if (s === 'both' || s === 'all') return API_LR.sections.both;
  return '';
}
function apiLrSectionKey_(label) {
  var s = String(label || '').toLowerCase();
  return /both/.test(s) ? 'both' : /train/.test(s) ? 'pt' : 'lt';
}
/** Any status typed in the sheet -> one of the four the app knows ('' -> New). */
function apiLrStatus_(v) {
  var s = String(v == null ? '' : v).toLowerCase().trim();
  if (!s || s === 'new') return 'New';
  if (/done|complete|finished|fixed|closed/.test(s)) return 'Done';
  if (/ok|approv|confirm|question|need/.test(s)) return 'Needs your OK';
  if (/progress|working|started|doing/.test(s)) return 'In progress';
  return 'New';
}
function apiLrIso_(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString();
  var s = String(v == null ? '' : v).trim(); if (!s) return '';
  var d = new Date(s); return isNaN(d) ? s : d.toISOString();
}
function apiLrSheet_() {
  var ss = null;
  try { ss = SpreadsheetApp.openById(API_LR.sheetId); } catch (e) {
    var it = DriveApp.getFolderById(API_LR.folderId).getFilesByName(API_LR.name);
    while (it.hasNext() && !ss) { var f = it.next(); if (f.getMimeType() === 'application/vnd.google-apps.spreadsheet' && !f.isTrashed()) ss = SpreadsheetApp.openById(f.getId()); }
  }
  if (!ss) return { error: 'no_sheet', message: 'The "Lisa Change Requests" sheet was not found in Lisa\u2019s Table.' };
  return { ss: ss, sh: ss.getSheets()[0] };
}
function apiLrCols_(head) {
  var h = head.map(function (x) { return String(x == null ? '' : x).toLowerCase().replace(/[^a-z]/g, ''); });
  var col = {};
  ['id', 'submitted', 'section', 'request', 'status', 'reply', 'updated'].forEach(function (k) { col[k] = h.indexOf(k); });
  col.ok = col.id >= 0 && col.request >= 0 && col.status >= 0 && col.reply >= 0;
  return col;
}
function apiLrInfo_(v, col, r) {
  var g = function (k) { return col[k] >= 0 ? v[col[k]] : ''; };
  var sec = String(g('section') || '');
  return { id: String(g('id') || '').trim() || ('row' + (r + 1)), row: r + 1, submitted: apiLrIso_(g('submitted')),
           section: apiLrSectionKey_(sec), sectionLabel: sec, request: String(g('request') || ''),
           status: apiLrStatus_(g('status')), reply: String(g('reply') || ''), updated: apiLrIso_(g('updated')) };
}
function apiLrRead_(w) {
  var values = w.sh.getDataRange().getValues();
  if (!values.length || values[0].join('') === '') return { values: values, col: null };
  return { values: values, col: apiLrCols_(values[0]) };
}
function apiLrFind_(values, col, id) {
  for (var r = 1; r < values.length; r++) if (String(values[r][col.id] == null ? '' : values[r][col.id]).trim() === id) return r;
  var m = /^row(\d+)$/.exec(id);                                  // a row typed by hand without an ID
  if (m) { var r2 = Number(m[1]) - 1; if (r2 >= 1 && r2 < values.length && !String(values[r2][col.id] || '').trim()) return r2; }
  return -1;
}

/**
 * action=lisareqlist  (read-only)
 * {ok:true,data:{exists:true, sheetUrl, items:[{id,row,submitted,section:'lt'|'pt'|'both',sectionLabel,request,status,reply,updated}], counts:{New,..}, version:54}}
 * Newest first (Submitted, then sheet row). Rows with an empty Request are skipped.
 */
function apiLrList_() {
  var w = apiLrSheet_(); if (w.error) return w;
  var rd = apiLrRead_(w), items = [], counts = { 'New': 0, 'In progress': 0, 'Needs your OK': 0, 'Done': 0 };
  if (rd.col && !rd.col.ok) return { error: 'no_columns', message: 'The sheet needs ID, Request, Status and Reply columns.' };
  if (rd.col) for (var r = 1; r < rd.values.length; r++) {
    if (!String(rd.values[r][rd.col.request] == null ? '' : rd.values[r][rd.col.request]).trim()) continue;
    var o = apiLrInfo_(rd.values[r], rd.col, r); items.push(o); counts[o.status]++;
  }
  items.sort(function (a, b) { return a.submitted === b.submitted ? b.row - a.row : (a.submitted < b.submitted ? 1 : -1); });
  return { ok: true, data: { exists: true, sheetUrl: w.ss.getUrl(), items: items.slice(0, API_LR.maxList), total: items.length, counts: counts, statuses: API_LR.statuses, version: 54 } };
}

/**
 * action=lisareq  (POST JSON body or GET params)
 *   id       required: the phone's request id ([A-Za-z0-9_-], 4-40). It is the idempotency key: the same id is never added twice
 *            (a repeat returns the saved row with duplicate:'id').   cid is accepted as an alias.
 *   text     required, <= 4000 characters (line breaks kept)
 *   section  lt | pt | both (or the labels); default lt
 *   ts       optional: when Lisa wrote it on the phone (ms since epoch); used for Submitted when within the last 60 days
 *   dry=1    validates; nothing is written
 * Appends ID | Submitted | Section | Request | Status=New | Reply='' | Updated. Text cells are stored as text (never a formula).
 */
function apiLrAdd_(p) {
  p = p || {};
  var id = String(p.id || p.cid || '').trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(id)) return { error: 'bad_value', message: 'id is required (4-40 letters, digits, - or _).' };
  var text = apiLrText_(p.text, API_LR.maxText);
  if (text === null) return { error: 'too_long', message: 'A request can be at most ' + API_LR.maxText + ' characters.' };
  if (!text) return { error: 'empty', message: 'Nothing to send.' };
  var section = apiLrSection_(p.section);
  if (!section) return { error: 'bad_value', message: 'section must be lt, pt or both.' };
  var now = new Date(), when = now, ts = Number(p.ts);
  if (ts > 0 && ts <= now.getTime() + 300000 && ts >= now.getTime() - 60 * 864e5) when = new Date(ts);
  var dry = apiAdminBool_(p.dry);

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var w = apiLrSheet_(); if (w.error) return w;
    var sh = w.sh, rd = apiLrRead_(w), col = rd.col;
    if (!col) {                                                     // empty sheet: header row first
      if (!dry) { sh.getRange(1, 1, 1, API_LR.head.length).setValues([API_LR.head]); try { sh.setFrozenRows(1); sh.getRange(1, 1, 1, API_LR.head.length).setFontWeight('bold'); } catch (eh) {} }
      rd = { values: [API_LR.head.slice()], col: apiLrCols_(API_LR.head) }; col = rd.col;
    }
    if (!col.ok) return { error: 'no_columns', message: 'The sheet needs ID, Request, Status and Reply columns.' };
    var hit = apiLrFind_(rd.values, col, id);
    if (hit > 0) return { ok: true, data: { duplicate: 'id', item: apiLrInfo_(rd.values[hit], col, hit), version: 54 } };
    var row = Math.max(sh.getLastRow(), 1) + 1;
    if (row > API_LR.maxRows) return { error: 'full', message: 'The request sheet is full. Archive old rows.' };
    var width = Math.max(rd.values[0].length, API_LR.head.length), vals = [];
    for (var c = 0; c < width; c++) vals.push('');
    vals[col.id] = id; vals[col.request] = text; vals[col.status] = 'New'; vals[col.reply] = '';
    if (col.submitted >= 0) vals[col.submitted] = when;
    if (col.section >= 0) vals[col.section] = section;
    if (col.updated >= 0) vals[col.updated] = now;
    var item = apiLrInfo_(vals, col, row - 1);
    if (dry) return { ok: true, data: { dry: true, item: item, version: 54 } };
    ['id', 'section', 'request', 'status', 'reply'].forEach(function (k) { if (col[k] >= 0) sh.getRange(row, col[k] + 1).setNumberFormat('@'); });
    ['submitted', 'updated'].forEach(function (k) { if (col[k] >= 0) sh.getRange(row, col[k] + 1).setNumberFormat('yyyy-mm-dd h:mm am/pm'); });
    sh.getRange(row, 1, 1, width).setValues([vals]);
    try { sh.getRange(row, col.request + 1).setWrap(true); } catch (ew) {}
    SpreadsheetApp.flush();
    var back = sh.getRange(row, 1, 1, width).getValues()[0];
    if (String(back[col.id]) !== id || String(back[col.request]) !== text) {
      try { sh.getRange(row, 1, 1, width).clearContent(); } catch (eu) {}
      return { error: 'write_failed', message: 'read-back mismatch after add' };
    }
    try { apiSpendJournal_(SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), [now, 'lisareq', row, API_LR.name + ': add ' + id + ' (' + section + ')', '', text.length + ' characters', id]); } catch (ej) { /* the journal never blocks a request */ }
    return { ok: true, data: { added: true, item: apiLrInfo_(back, col, row - 1), sheetUrl: w.ss.getUrl(), version: 54 } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * action=lisareqset  (for Lisa's Assistant; POST JSON body or GET params)
 *   id      required (the ID column; "row<N>" for a hand-typed row without an ID)
 *   status  New | In progress | Needs your OK | Done (loose spellings accepted)       reply  text (<= 4000; '' clears)
 *   reply_mode=append adds the reply under the existing one (blank line between) instead of replacing it
 *   At least one of status / reply. Updated is set to now. dry=1 previews.
 */
function apiLrSet_(p) {
  p = p || {};
  var id = String(p.id || '').trim();
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  var hasS = p.status !== undefined && p.status !== null && String(p.status).trim() !== '';
  var hasR = p.reply !== undefined && p.reply !== null;
  if (!hasS && !hasR) return { error: 'bad_value', message: 'Send status and/or reply.' };
  var status = hasS ? apiLrStatus_(p.status) : '';
  var reply = hasR ? apiLrText_(p.reply, API_LR.maxReply) : '';
  if (reply === null) return { error: 'too_long', message: 'A reply can be at most ' + API_LR.maxReply + ' characters.' };
  var dry = apiAdminBool_(p.dry);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var w = apiLrSheet_(); if (w.error) return w;
    var rd = apiLrRead_(w), col = rd.col;
    if (!col || !col.ok) return { error: 'no_columns', message: 'The sheet needs ID, Request, Status and Reply columns.' };
    var r = apiLrFind_(rd.values, col, id);
    if (r < 1) return { error: 'not_found', message: 'No request with id ' + id + '.' };
    var v = rd.values[r].slice(), now = new Date();
    if (hasS) v[col.status] = status;
    if (hasR) {
      var old = String(v[col.reply] || '');
      v[col.reply] = String(p.reply_mode || '') === 'append' && old && reply ? (old + '\n\n' + reply).slice(0, API_LR.maxReply) : reply;
    }
    if (col.updated >= 0) v[col.updated] = now;
    var item = apiLrInfo_(v, col, r);
    if (dry) return { ok: true, data: { dry: true, item: item, version: 54 } };
    var sh = w.sh;
    if (hasS) sh.getRange(r + 1, col.status + 1).setNumberFormat('@').setValue(v[col.status]);
    if (hasR) sh.getRange(r + 1, col.reply + 1).setNumberFormat('@').setValue(v[col.reply]).setWrap(true);
    if (col.updated >= 0) sh.getRange(r + 1, col.updated + 1).setNumberFormat('yyyy-mm-dd h:mm am/pm').setValue(now);
    SpreadsheetApp.flush();
    return { ok: true, data: { updated: true, item: item, version: 54 } };
  } finally {
    lock.releaseLock();
  }
}

/** action=lisareqdel&id=..  Test cleanup only: deletes ONE row whose Request starts with "TEST"; anything else -> not_test. */
function apiLrDel_(p) {
  p = p || {};
  var id = String(p.id || '').trim();
  if (!id) return { error: 'bad_value', message: 'id is required.' };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var w = apiLrSheet_(); if (w.error) return w;
    var rd = apiLrRead_(w), col = rd.col;
    if (!col || !col.ok) return { error: 'no_columns' };
    var r = apiLrFind_(rd.values, col, id);
    if (r < 1) return { error: 'not_found' };
    if (String(rd.values[r][col.request] || '').indexOf(API_LR.testMark) !== 0) return { error: 'not_test', message: 'Only requests that start with TEST can be deleted through the API.' };
    if (apiAdminBool_(p.dry)) return { ok: true, data: { dry: true, row: r + 1 } };
    w.sh.deleteRow(r + 1);
    return { ok: true, data: { deleted: true, row: r + 1, version: 54 } };
  } finally {
    lock.releaseLock();
  }
}
/* ---------------- v49 Finances > Investments ----------------
 * The phone keeps its own copy (localStorage) and works without this. With it, entries sync across devices.
 * One Script Property per account: CC_INVEST_<acct> = JSON (each value must stay under 9 KB; enforced below).
 */
var API_INVEST_ACCTS = ['etrade', 'af', 'crypto'];
function apiInvestNum_(v) {
  var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? s : '';
}
function apiInvestClean_(a) {
  a = a && typeof a === 'object' ? a : {};
  var out = {
    type: String(a.type || '').slice(0, 40),
    balance: apiInvestNum_(a.balance),
    asof: /^\d{4}-\d{2}-\d{2}$/.test(String(a.asof || '')) ? String(a.asof) : '',
    notes: String(a.notes || '').slice(0, 2000),
    updated: Number(a.updated) || 0,
    holdings: []
  };
  (Array.isArray(a.holdings) ? a.holdings : []).slice(0, 60).forEach(function (h) {
    h = h || {};
    var x = { ticker: String(h.ticker || '').trim().slice(0, 16).toUpperCase(), name: String(h.name || '').trim().slice(0, 80),
              shares: apiInvestNum_(h.shares), value: apiInvestNum_(h.value) };
    if (x.ticker || x.name || x.shares || x.value) out.holdings.push(x);
  });
  return out;
}
function apiInvest_() {
  var props = PropertiesService.getScriptProperties(), accts = {};
  API_INVEST_ACCTS.forEach(function (k) {
    var raw = props.getProperty('CC_INVEST_' + k), v = null;
    if (raw) { try { v = apiInvestClean_(JSON.parse(raw)); } catch (e) { v = null; } }
    accts[k] = v;
  });
  return { ok: true, data: { accts: accts, version: 49 } };
}
function apiInvestSave_(p) {
  p = p || {};
  var k = String(p.acct || '').toLowerCase();
  if (API_INVEST_ACCTS.indexOf(k) < 0) return { error: 'bad_value', message: 'acct must be etrade, af or crypto.' };
  var obj;
  try { obj = JSON.parse(String(p.json || '')); } catch (e) { return { error: 'bad_value', message: 'json must be the account object.' }; }
  var a = apiInvestClean_(obj);
  if (!a.updated) a.updated = Number(p.updated) || Date.now();
  var text = a.notes + ' ' + a.holdings.map(function (h) { return h.name; }).join(' ');
  if (/\b\d{8,}\b/.test(text)) return { error: 'no_account_numbers', message: 'Do not send account numbers.' };
  var json = JSON.stringify(a);
  if (json.length > 8500) return { error: 'too_long', message: 'Too much for one account (shorten notes or holdings).' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties(), cur = props.getProperty('CC_INVEST_' + k), curU = 0;
    if (cur) { try { curU = Number(JSON.parse(cur).updated) || 0; } catch (e) { curU = 0; } }
    if (curU > a.updated) return { ok: true, data: { acct: k, kept: 'server', updated: curU } };   // an older edit never overwrites a newer one
    props.setProperty('CC_INVEST_' + k, json);
  } finally { lock.releaseLock(); }
  return { ok: true, data: { acct: k, updated: a.updated } };
}
/* ---------------- v50 fh-fiber-backfill ----------------
 * Rows logged before the "Fiber (g)" column existed carry their fiber only as "[Fiber: N g]" tags in Notes. This sums the tags per row
 * and writes the total to that row's Fiber (g) cell. Tags are read like the phone reads them (app.js fhNotesFiber): in a meal line,
 * "Dinner (edited): …" replaces the latest earlier dinner of that row and "Dinner (removed): …" drops it; tags outside a meal line count
 * as written. OVERRIDES correct a known bad tag value without rewriting the Notes text (the correction is in the CC write log).
 * Only empty Fiber cells are filled (force=1 replaces a different value). Backup (apiLogBackup_) first, one journal line per cell. */
var API_FIBER_BF = {
  sheetId: '1MERN98DwQWNJPO0cJoqyMXF_xlX5k-DeeY5vXWA50Ok',   // Zac_Fitness_Diet_Daily_Log
  tab: 'Phone Log',
  journalTab: 'CC write log',
  col: 'Fiber (g)',
  heads: ['fiber (g)', 'fiber', 'fibre (g)', 'fibre', 'dietary fiber'],
  prop: 'CC_FIBER_BACKFILL_V1',
  overrides: [
    // 10/7 dinner "10 oz ground beef with low-carb tortillas, and one 16 oz IPA" was tagged [Fiber: 34 g]. Ground beef and beer have ~0 g;
    // a low-carb (Carb Balance type) tortilla has ~15 g (label: 19 g carbs, 15 g fiber), and the row's own dinner numbers (59 g carbs,
    // 1176 kcal, 91 g protein) fit 2 such tortillas + the IPA. So 2 x 15 = 30 g. Change `value` here if the tortillas were a different kind.
    { date: '2026-10-07', meal: 'dinner', was: 34, value: 30, why: '10/7 dinner: 2 low-carb tortillas x 15 g, beef 0, IPA 0 (tag said 34 g)' }
  ]
};
function apiFiberTags_(s) {
  var out = [], m, rx = /\[Fiber:?\s*(\d+(?:\.\d+)?)\s*g?\s*\]/gi;
  while ((m = rx.exec(String(s || '')))) out.push(Number(m[1]));
  return out;
}
// -> { total: number|null, tags: [{ meal, g, used, override }] }
function apiFiberFromNotes_(notes, dateKey) {
  var MAP = { breakfast: 'breakfast', brunch: 'breakfast', lunch: 'lunch', dinner: 'dinner', supper: 'dinner', snack: 'snacks', snacks: 'snacks', dessert: 'snacks', drinks: 'drinks' };
  var MEAL = /\b(Breakfast|Brunch|Lunch|Dinner|Supper|Snacks?|Dessert|Drinks)\s*(\((?:edited|removed)\))?\s*:\s*/gi;
  var meals = [], loose = [];
  String(notes || '').split(/\s*\|\s*/).forEach(function (seg) {
    var marks = [], m; MEAL.lastIndex = 0;
    while ((m = MEAL.exec(seg))) marks.push({ i: m.index, end: MEAL.lastIndex, w: MAP[m[1].toLowerCase()] || 'snacks', fix: (m[2] || '').toLowerCase() });
    apiFiberTags_(marks.length ? seg.slice(0, marks[0].i) : seg).forEach(function (g) { loose.push({ meal: '', g: g }); });
    marks.forEach(function (k, j) {
      var body = seg.slice(k.end, j + 1 < marks.length ? marks[j + 1].i : seg.length);
      var x = { meal: k.w, tags: apiFiberTags_(body) }, prev = -1;
      for (var p = meals.length - 1; p >= 0; p--) if (meals[p].meal === k.w) { prev = p; break; }
      if (k.fix === '(removed)') { if (prev >= 0) meals.splice(prev, 1); return; }
      if (k.fix === '(edited)' && prev >= 0) { meals[prev] = x; return; }
      meals.push(x);
    });
  });
  var tags = [], total = 0, n = 0;
  meals.forEach(function (x) { x.tags.forEach(function (g) { tags.push({ meal: x.meal, g: g }); }); });
  tags = tags.concat(loose);
  tags.forEach(function (t) {
    var o = API_FIBER_BF.overrides.filter(function (v) { return v.date === dateKey && v.meal === t.meal && Math.abs(v.was - t.g) < 0.05; })[0];
    if (o) { t.override = { was: t.g, value: o.value, why: o.why }; t.g = o.value; }
    total += t.g; n++;
  });
  return { total: n ? Math.round(total * 10) / 10 : null, tags: tags };
}
function apiFiberBackfillOnce_() {
  try {
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty(API_FIBER_BF.prop)) return;
    var r = apiFiberBackfill_({ cid: 'fbauto' });
    if (r && r.ok) props.setProperty(API_FIBER_BF.prop, new Date().toISOString() + ' auto, ' + r.data.written + ' cells');
  } catch (e) { console.error('CC API fiber backfill (auto) error: ' + (e && e.stack || e)); }
}
function apiFiberBackfill_(p) {
  p = p || {};
  var dry = String(p.dry || '') === '1', force = String(p.force || '') === '1';
  var cid = String(p.cid || 'fb' + Date.now()).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var tz = (typeof CONFIG !== 'undefined' && CONFIG.TIME_ZONE) || Session.getScriptTimeZone();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { error: 'busy', message: 'Another write is running. Try again in a moment.' };
  try {
    var ss = SpreadsheetApp.openById(API_FIBER_BF.sheetId), sh = ss.getSheetByName(API_FIBER_BF.tab);
    if (!sh) return { error: 'not_found', message: 'No "' + API_FIBER_BF.tab + '" tab.' };
    var values = sh.getDataRange().getValues(), head = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var cDate = head.indexOf('date'), cNotes = head.indexOf('notes'), cFib = -1;
    API_FIBER_BF.heads.forEach(function (h) { if (cFib < 0 && head.indexOf(h) >= 0) cFib = head.indexOf(h); });
    if (cDate < 0 || cNotes < 0) return { error: 'bad_sheet', message: 'Phone Log needs Date and Notes headers.' };
    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var dv = values[r][cDate], key = dv instanceof Date ? Utilities.formatDate(dv, tz, 'yyyy-MM-dd') : String(dv || '');
      var res = apiFiberFromNotes_(values[r][cNotes], key);
      if (res.total === null) continue;
      var cur = cFib >= 0 ? values[r][cFib] : '', empty = cur === '' || cur === null;
      var write = empty || (force && Number(cur) !== res.total);
      rows.push({ row: r + 1, date: key, tags: res.tags, total: res.total, before: empty ? null : cur, write: write });
    }
    var todo = rows.filter(function (x) { return x.write; });
    if (dry || !todo.length) return { ok: true, data: { dry: dry, column: cFib >= 0 ? API_FIBER_BF.col : '(added on first write)', rows: rows, written: 0, version: 50 } };

    if (typeof apiLogBackup_ === 'function') apiLogBackup_(ss, sh);   // same backup as every logday; throws -> nothing written
    var added = false;
    if (cFib < 0) {                    // add "Fiber (g)" at the END, like logday adds Hike miles / Steps; nothing moves
      var lastCol = sh.getLastColumn(), hc = sh.getRange(1, lastCol + 1);
      sh.getRange(1, lastCol).copyTo(hc, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      hc.setValue(API_FIBER_BF.col);
      cFib = lastCol; added = true;
    }
    var jt = ss.getSheetByName(API_FIBER_BF.journalTab), now = new Date();
    todo.forEach(function (x) {
      sh.getRange(x.row, cFib + 1).setValue(x.total);
      var ov = x.tags.filter(function (t) { return t.override; }).map(function (t) { return t.override.why + ' -> ' + t.override.value + ' g'; }).join('; ');
      try { if (jt) jt.appendRow([now, 'fiberbackfill ' + x.date + (ov ? ' (correction: ' + ov + ')' : ''), x.row, 'fiber', x.before === null ? '' : x.before, x.total, cid]); } catch (je) { /* the journal never blocks the write */ }
    });
    return { ok: true, data: { dry: false, column: API_FIBER_BF.col, added: added, rows: rows, written: todo.length, version: 50 } };
  } finally { lock.releaseLock(); }
}

/* ======================================================================= */
/* KiwiT / TiwiK receipts — action=bizreceipts / bizreceiptsave (v55)        */
/* The two Receipts folders were created 2026-10-09 (Drive > Second Brain >  */
/* Business > KiwiT LLC > Business Documents > Expenses > Receipts, and       */
/* Business > TiwiK Laundromat > Expenses > Receipts). Only these two folder  */
/* ids can be written; nothing else in Drive changes and nothing is shared.  */
/* ======================================================================= */
var API_BIZRC = {
  folders: {
    kiwit: { id: '1kCEyz-1vCD8ffc5sF04uoXk7Uyp7YZJY', label: 'KiwiT' },   // KiwiT LLC > Business Documents > Expenses > Receipts
    tiwik: { id: '1m-e8g1IhEA8PLymp81lJfuplqY_hEFlj', label: 'TiwiK' }    // TiwiK Laundromat > Expenses > Receipts
  },
  MIME: { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' },
  MAX_BYTES: 8 * 1024 * 1024,
  MAX_B64: Math.ceil(8 * 1024 * 1024 / 3) * 4 + 8,
  DESC_TAG: 'CC bizreceiptsave '      // file description = tag + {"cid":..,"ent":..,"date":..,"amount":..,"merchant":..}
};
function apiBizRcFolder_(ent) {
  var c = API_BIZRC.folders[String(ent || '').toLowerCase()];
  if (!c) return null;
  try { var f = DriveApp.getFolderById(c.id); f.getName(); return f; } catch (e) { return null; }
}
/** action=bizreceipts (read-only): which entities can take receipts, with the number of files in each Receipts folder. */
function apiBizReceipts_() {
  var ents = {};
  Object.keys(API_BIZRC.folders).forEach(function (k) {
    var c = API_BIZRC.folders[k], f = apiBizRcFolder_(k), n = 0;
    if (f) { var it = f.getFiles(); while (it.hasNext() && n < 5000) { it.next(); n++; } }
    ents[k] = { folderId: c.id, folderUrl: 'https://drive.google.com/drive/folders/' + c.id, found: !!f, count: n };
  });
  return { ok: true, data: { canUpload: true, ents: ents, version: 55 } };
}
function apiBizRcFindCid_(ss, folder, cid) {
  var jt = ss.getSheetByName(API_SPENDFIX_CFG.journalTab);
  if (jt && jt.getLastRow() >= 2) {
    var v = jt.getRange(2, 1, jt.getLastRow() - 1, 7).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      if (String(v[i][1]) === 'bizreceiptsave' && String(v[i][6]) === cid) {
        var m = String(v[i][5]).split(' | ');
        try { var f = DriveApp.getFileById(m[0]); if (!f.isTrashed()) return f; } catch (e) { /* gone: look in the folder */ }
      }
    }
  }
  var it = folder.getFiles();
  while (it.hasNext()) {
    var g = it.next(), d = String(g.getDescription() || '');
    if (d.indexOf(API_BIZRC.DESC_TAG) === 0) {
      try { if (JSON.parse(d.slice(API_BIZRC.DESC_TAG.length)).cid === cid && !g.isTrashed()) return g; } catch (e2) { /* not ours */ }
    }
  }
  return null;
}
/**
 * action=bizreceiptsave  (admin; POST JSON body, or GET params for dry=1 checks)
 *   ent       kiwit | tiwik (required)
 *   cid       required when writing (idempotency key: a repeat returns the first file, duplicate:'cid')
 *   date      yyyy-mm-dd (default today), amount (optional, e.g. 42.50), merchant (optional, max 80)
 *   mime      image/jpeg | image/png | application/pdf;  data = base64 (a data: URL prefix is tolerated), decoded <= 8 MB
 *   dry=1     validate + show the final name; nothing is created or logged (data optional)
 * Name: "<date> <merchant> $<amount>.<ext>" (missing parts left out; "<date> Receipt.<ext>" when neither is given). An existing
 * name is NEVER overwritten: " (2)", " (3)" ... is added before the extension.
 * Response {ok:true,data:{id,url,name,folderUrl,ent,bytes,cid,dry,version:55[,duplicate:'cid']}}
 */
function apiBizReceiptSave_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80), ent = String(p.ent || '').toLowerCase();
  if (!API_BIZRC.folders[ent]) return { error: 'bad_value', message: 'ent must be kiwit or tiwik.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var date = p.date ? apiAdminDate_(p.date) : todayKey_();
  if (!date) return { error: 'bad_value', message: 'date must look like 2026-10-09.' };
  var amt = '';
  if (p.amount != null && String(p.amount).trim() !== '') {
    var a = Number(String(p.amount).replace(/[$,\s]/g, ''));
    if (!isFinite(a) || a < 0 || a > 1e7) return { error: 'bad_value', message: 'amount should look like 42.50.' };
    amt = a.toFixed(2);
  }
  var merchant = String(p.merchant == null ? '' : p.merchant).replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80);
  var mime = String(p.mime || 'image/jpeg').toLowerCase(), ext = API_BIZRC.MIME[mime];
  if (!ext) return { error: 'bad_value', message: 'mime must be image/jpeg, image/png or application/pdf.' };
  var bytes = null;
  if (p.data != null && String(p.data) !== '') {
    var b64 = String(p.data).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (b64.length > API_BIZRC.MAX_B64) return { error: 'too_big', message: 'The file is larger than 8 MB.' };
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'bad_value', message: 'data must be base64.' };
    try { bytes = Utilities.base64Decode(b64); } catch (e1) { return { error: 'bad_value', message: 'data is not valid base64.' }; }
    var n = bytes.length;
    if (n > API_BIZRC.MAX_BYTES) return { error: 'too_big', message: 'The file is larger than 8 MB.' };
    var b0 = bytes[0] & 255, b1 = bytes[1] & 255, b2 = bytes[2] & 255, b3 = bytes[3] & 255;
    var okSig = ext === 'jpg' ? (b0 === 0xFF && b1 === 0xD8) : ext === 'png' ? (b0 === 0x89 && b1 === 0x50 && b2 === 0x4E && b3 === 0x47)
      : String.fromCharCode(b0, b1, b2, b3, bytes[4] & 255) === '%PDF-';
    if (n < 100 || !okSig) return { error: 'bad_value', message: 'data does not match ' + mime + '.' };
  } else if (!dry) {
    return { error: 'bad_value', message: 'data (base64 file) is required when writing.' };
  }
  var folder = apiBizRcFolder_(ent);
  if (!folder) return { error: 'not_found', message: 'The Receipts folder was not found.' };
  var base = [date, merchant, amt ? '$' + amt : ''].filter(String).join(' ');
  if (base === date) base += ' Receipt';
  var fid = API_BIZRC.folders[ent].id;
  var out = { dry: dry, cid: cid, ent: ent, name: base + '.' + ext, folderUrl: 'https://drive.google.com/drive/folders/' + fid, version: 55 };
  if (bytes) out.bytes = bytes.length;
  var uniq = function () { var nm = base + '.' + ext, k = 2; while (folder.getFilesByName(nm).hasNext() && k < 100) { nm = base + ' (' + k + ').' + ext; k++; } return nm; };
  if (dry) { out.name = uniq(); return { ok: true, data: out }; }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  var file = null;
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID);
    var seen = apiBizRcFindCid_(ss, folder, cid);
    if (seen) { out.duplicate = 'cid'; out.id = seen.getId(); out.url = seen.getUrl(); out.name = seen.getName(); return { ok: true, data: out }; }
    var finalName = uniq();
    try {
      file = folder.createFile(Utilities.newBlob(bytes, mime, finalName));
      file.setDescription(API_BIZRC.DESC_TAG + JSON.stringify({ cid: cid, ent: ent, date: date, amount: amt, merchant: merchant }));
      if (file.getSize() !== bytes.length) throw new Error('size mismatch after upload (' + file.getSize() + ' vs ' + bytes.length + ')');
    } catch (werr) {
      var undone = true;
      try { if (file) file.setTrashed(true); } catch (e5) { undone = false; }
      return { error: 'write_failed', message: String(werr && werr.message || werr), rolledBack: undone };
    }
    out.name = finalName; out.id = file.getId(); out.url = file.getUrl();
    try { apiSpendJournal_(ss, [new Date(), 'bizreceiptsave', '', API_BIZRC.folders[ent].label + ' Receipts: ' + finalName, '', out.id + ' | ' + out.url + ' | ' + bytes.length + ' bytes', cid]); }
    catch (e7) { out.journalFailed = true; }   // the file carries the cid in its description, so a retry still finds it
    return { ok: true, data: out };
  } finally {
    lock.releaseLock();
  }
}


/* ===== v56: Personal Training client photos (past workouts) =====================================
 * Folder: Lisa's Table (API_PT.folderId) > "PT Client Photos" > "<client name> (<client id>)", created by the first real write.
 * action=ptphotos&clientId=pc..   -> {canUpload:true, photos:[{id,name,url,date,created}]} (no folder yet = [] and nothing created)
 * action=ptphotosave (POST) clientId, name, cid, date=yyyy-mm-dd, mime=image/jpeg|image/png, data=<base64>, note, dry
 *   never overwrites (unique name), cid stored in the file description = no doubles on retry.
 */
var API_PTPH = { root: 'PT Client Photos', DESC_TAG: 'CC ptphotosave ', MIME: { 'image/jpeg': 'jpg', 'image/png': 'png' }, MAX_BYTES: 8 * 1024 * 1024 };
function apiPtPhClientFolder_(clientId, name, create) {
  var root = null, lt = DriveApp.getFolderById(API_PT.folderId), it = lt.getFoldersByName(API_PTPH.root);
  if (it.hasNext()) root = it.next(); else if (create) root = lt.createFolder(API_PTPH.root); else return null;
  var key = '(' + clientId + ')', f = root.getFolders();
  while (f.hasNext()) { var g = f.next(); if (g.getName().indexOf(key) >= 0) return g; }
  if (!create) return null;
  var nm = String(name || 'Client').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60) || 'Client';
  return root.createFolder(nm + ' ' + key);
}
function apiPtPhotos_(p) {
  var clientId = apiAdminClean_(p.clientId, 40);
  if (!/^pc[a-z0-9]+$/i.test(clientId)) return { error: 'bad_value', message: 'clientId is required.' };
  var fo = apiPtPhClientFolder_(clientId, '', false), out = [];
  if (fo) { var it = fo.getFiles(); while (it.hasNext()) { var f = it.next(); if (f.isTrashed()) continue; var d = {}; try { d = JSON.parse(String(f.getDescription() || '').slice(API_PTPH.DESC_TAG.length)); } catch (e) {}
    out.push({ id: f.getId(), name: f.getName(), url: f.getUrl(), date: d.date || '', note: d.note || '', created: f.getDateCreated().getTime() }); } }
  out.sort(function (a, b) { return b.created - a.created; });
  return { ok: true, data: { canUpload: true, clientId: clientId, folderUrl: fo ? fo.getUrl() : '', photos: out, version: 56 } };
}
function apiPtPhotoSave_(p) {
  p = p || {};
  var dry = apiAdminBool_(p.dry), cid = apiAdminClean_(p.cid, 80), clientId = apiAdminClean_(p.clientId, 40);
  if (!/^pc[a-z0-9]+$/i.test(clientId)) return { error: 'bad_value', message: 'clientId is required.' };
  if (!dry && !cid) return { error: 'bad_value', message: 'cid is required when writing (idempotency key).' };
  var date = p.date ? apiAdminDate_(p.date) : todayKey_();
  if (!date) return { error: 'bad_value', message: 'date must look like 2026-10-09.' };
  var mime = String(p.mime || 'image/jpeg').toLowerCase(), ext = API_PTPH.MIME[mime];
  if (!ext) return { error: 'bad_value', message: 'mime must be image/jpeg or image/png.' };
  var note = String(p.note == null ? '' : p.note).substring(0, 300), bytes = null;
  if (p.data != null && String(p.data) !== '') {
    var b64 = String(p.data).replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+\/]+={0,2}$/.test(b64)) return { error: 'bad_value', message: 'data must be base64.' };
    try { bytes = Utilities.base64Decode(b64); } catch (e1) { return { error: 'bad_value', message: 'data is not valid base64.' }; }
    if (bytes.length > API_PTPH.MAX_BYTES) return { error: 'too_big', message: 'The photo is larger than 8 MB.' };
    var b0 = bytes[0] & 255, b1 = bytes[1] & 255;
    if (bytes.length < 100 || !(ext === 'jpg' ? (b0 === 0xFF && b1 === 0xD8) : (b0 === 0x89 && b1 === 0x50))) return { error: 'bad_value', message: 'data does not match ' + mime + '.' };
  } else if (!dry) return { error: 'bad_value', message: 'data (base64 photo) is required when writing.' };
  var name = apiAdminClean_(p.name, 80);
  var out = { dry: dry, cid: cid, clientId: clientId, version: 56 };
  if (dry) { out.folder = apiPtPhClientFolder_(clientId, name, false) ? 'exists' : 'would create'; return { ok: true, data: out }; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e3) { return { error: 'busy', message: 'Another update is running. Try again.' }; }
  try {
    var fo = apiPtPhClientFolder_(clientId, name, true), it = fo.getFiles();
    while (it.hasNext()) { var g = it.next(), d = String(g.getDescription() || '');
      if (d.indexOf(API_PTPH.DESC_TAG) === 0 && !g.isTrashed()) { try { if (JSON.parse(d.slice(API_PTPH.DESC_TAG.length)).cid === cid) { out.duplicate = 'cid'; out.id = g.getId(); out.url = g.getUrl(); out.name = g.getName(); return { ok: true, data: out }; } } catch (e4) {} } }
    var base = date + ' Past workouts', nm = base + '.' + ext, k = 2;
    while (fo.getFilesByName(nm).hasNext() && k < 100) { nm = base + ' (' + k + ').' + ext; k++; }
    var file = fo.createFile(Utilities.newBlob(bytes, mime, nm));
    file.setDescription(API_PTPH.DESC_TAG + JSON.stringify({ cid: cid, clientId: clientId, date: date, note: note }));
    out.id = file.getId(); out.url = file.getUrl(); out.name = nm; out.folderUrl = fo.getUrl();
    try { apiSpendJournal_(SpreadsheetApp.openById(CONFIG.SPEND.SHEET_ID), [new Date(), 'ptphotosave', '', API_PT.name + ' photo: ' + nm, clientId, out.id + ' | ' + bytes.length + ' bytes', cid]); } catch (e7) { out.journalFailed = true; }
    return { ok: true, data: out };
  } catch (werr) {
    return { error: 'write_failed', message: String(werr && werr.message || werr).substring(0, 200) };
  } finally { lock.releaseLock(); }
}

/* ---------------- v56 Project lists (Zac > Wetumka: Garage organization, Connex box, Landscaping; any slug) ----------------
 * The phone keeps its own copy (localStorage cc_zlists_v1) and works without this. With it, the lists sync across devices.
 * One Script Property per list: CC_LIST_<slug> = JSON (Script Properties allow ~9 KB per value; enforced below).
 * Merge (same rule as the phone): items by id, the newer `updated` wins (a delete is an item with del:true, kept 60 days so a
 * stale phone can't bring it back); order = the order of whichever copy has the newer orderAt, then any id it doesn't know.
 */
var API_LIST_RE = /^[a-z0-9][a-z0-9-]{0,29}$/, API_LIST_ID_RE = /^[A-Za-z0-9_-]{1,40}$/, API_LIST_TOMB_MS = 60 * 864e5, API_LIST_MAX = 8800;
function apiListClean_(l, slug) {
  l = l && typeof l === 'object' ? l : {};
  var items = [];
  (Array.isArray(l.items) ? l.items : []).slice(0, 300).forEach(function (x) {
    x = x || {}; var id = String(x.id || '');
    if (!API_LIST_ID_RE.test(id)) return;
    var it = { id: id, text: String(x.text || '').replace(/\s+/g, ' ').trim().slice(0, 300), note: String(x.note || '').slice(0, 1000),
               done: !!x.done, doneAt: Number(x.doneAt) || 0, updated: Number(x.updated) || 0, del: !!x.del };
    if (it.del) { it.text = ''; it.note = ''; }
    if (it.del || it.text) items.push(it);
  });
  var order = (Array.isArray(l.order) ? l.order : []).map(String).filter(function (id) { return API_LIST_ID_RE.test(id); }).slice(0, 300);
  return { slug: slug, items: items, order: order, orderAt: Number(l.orderAt) || 0, updated: Number(l.updated) || 0 };
}
function apiListMerge_(a, b) {
  var by = {}, ids = [];
  [a, b].forEach(function (l) { l.items.forEach(function (x) { var c = by[x.id]; if (!c) { by[x.id] = x; ids.push(x.id); } else if (x.updated > c.updated) by[x.id] = x; }); });
  var first = b.orderAt > a.orderAt ? b : a, second = first === a ? b : a, order = [], seen = {}, cut = Date.now() - API_LIST_TOMB_MS;
  first.order.concat(second.order, ids).forEach(function (id) { if (!seen[id] && by[id]) { seen[id] = 1; order.push(id); } });
  var items = ids.map(function (id) { return by[id]; }).filter(function (x) { return !(x.del && x.updated < cut); }), keep = {};
  items.forEach(function (x) { keep[x.id] = 1; });
  return { slug: a.slug || b.slug, items: items, order: order.filter(function (id) { return keep[id]; }), orderAt: Math.max(a.orderAt, b.orderAt), updated: Math.max(a.updated, b.updated) };
}
function apiLists_() {
  var all = PropertiesService.getScriptProperties().getProperties(), lists = {};
  Object.keys(all).forEach(function (k) {
    var m = /^CC_LIST_(.+)$/.exec(k); if (!m || !API_LIST_RE.test(m[1])) return;
    try { lists[m[1]] = apiListClean_(JSON.parse(all[k]), m[1]); } catch (e) {}
  });
  return { ok: true, data: { lists: lists, version: 56 } };
}
function apiListSave_(p) {
  p = p || {};
  var slug = String(p.slug || '').toLowerCase();
  if (!API_LIST_RE.test(slug)) return { error: 'bad_value', message: 'slug must be lowercase letters, digits or dashes.' };
  var inc;
  try { inc = apiListClean_(JSON.parse(String(p.json || '')), slug); } catch (e) { return { error: 'bad_value', message: 'json must be the list object.' }; }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties(), raw = props.getProperty('CC_LIST_' + slug), cur = null;
    if (raw) { try { cur = apiListClean_(JSON.parse(raw), slug); } catch (e) { cur = null; } }
    if (!cur && Object.keys(props.getProperties()).filter(function (k) { return /^CC_LIST_/.test(k); }).length >= 40) return { error: 'too_many', message: 'At most 40 lists.' };
    var merged = cur ? apiListMerge_(cur, inc) : apiListMerge_(inc, inc);
    var json = JSON.stringify(merged);
    if (json.length > API_LIST_MAX) {   // drop delete-markers (oldest first), then refuse
      var tombs = merged.items.filter(function (x) { return x.del; }).sort(function (x, y) { return x.updated - y.updated; });
      while (json.length > API_LIST_MAX && tombs.length) { var t = tombs.shift(); merged.items = merged.items.filter(function (x) { return x !== t; }); merged.order = merged.order.filter(function (id) { return id !== t.id; }); json = JSON.stringify(merged); }
      if (json.length > API_LIST_MAX) return { error: 'too_long', message: 'This list is full (shorten notes or remove done items).' };
    }
    props.setProperty('CC_LIST_' + slug, json);
    return { ok: true, data: { slug: slug, list: merged } };
  } finally { lock.releaseLock(); }
}
