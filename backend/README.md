# Apps Script patches (not deployed automatically)

## vault-category.patch (API v46, Vault categories)
Patch against Api.gs v45. Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version).

What it adds:
- spend read: `categoryApi: 1`, so the Vault switches from "[Category] " note prefixes to real columns on its own.
- Income / Personal Training / Land & Structure Pay reads return `category` (from a "Category" column).
- incomeadd: optional `category=`. On first use it adds a "Category" header to the right of the last header (nothing is moved). The change is journaled.
- spendadd: `allow_new_category=1` accepts a typed category and adds it to the Category dropdown.
- spendfix: Category is written through apiAdminSetCell_, which extends a strict dropdown instead of failing.
- new `incomefix` action: tab, row, date, amount, label, category, notes, notes_mode=set, cid, dry. The row must match date + amount + label. A backup tab is made first, and the change is written to the CC write log.

Until it is deployed, the Vault keeps working with the current server. Spend categories go in the Category column (via spendadd, then spendfix for new ones). Income categories go in Notes as "[Category] ...". Editing the category of a saved income entry shows "needs the server update".

## dlog-week-sunday.patch (Daily Log weeks run Sunday..Saturday)
Patch against Code.gs (getDailyLog) and Api.gs (apiLogExt_). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). Not urgent: CC v117 already works without it.

Why: getDailyLog windowed the week Monday..Sunday, so on Tuesday 10/6 the "This week" summary started Mon 10/5 and Sunday 10/4 sat in the previous week. Zac expects Sunday-start weeks. Front end v117 builds the Sunday..Saturday week itself from `ext.history` (every logged day of the last 120 days, with workout minutes and hike miles), so the summary, the Week running total and Past days are right on the current server.

What it changes:
- getDailyLog: the week window is Sun..Sat (`dow = getDay()`, Sun=0) and the payload says `weekStart: 'sun'`. Only the old-screen fallback (server without `ext`) and the phone's piecing-together of weeks older than 120 days read these days; the phone fetches those by date, so either convention works.
- apiLogExt_: adds `historyDays` (how far back `history` reaches, used by the phone instead of its built-in 119) and `weekStart: 'sun'`.

Not changed (by design): calories / macros typed only into Notes (e.g. "Breakfast: eggs and toast") have no numbers, so they never count in calorie or macro averages; the Daily Log says which days are missing numbers.

## vault-paytype.patch (API v47, Vault payment type)
Apply after vault-category.patch, then redeploy (Zac signs in). Some hunks are anchored by a quoted line instead of a line number, because the v45 code around them is not in this repo.

What it adds:
- spend read: `paymentApi: 1`. The Vault then sends `method=` instead of writing "[Pay: X] " tags.
- The Income tab read returns `method` from a "Payment type" column (or Method / Payment).
- incomeadd: the first entry with a payment type adds a "Payment type" header right of the last header. Today the server drops it with `method_not_saved`.
- spendfix and incomefix: `method=` (an empty value clears it). Written through apiAdminSetCell_, so a strict dropdown is extended.

Until it is deployed (front end v119):
- Spend: the add form writes to the Daily Spend Method column, as before. Card is sent as Credit and Bank transfer as ACH/Transfer, the dropdown's values; both display as Card and Bank transfer. Edit payment type uses spendfix to write a "[Pay: X] " tag in Notes, and the app reads the tag ahead of the column.
- Income: the add form puts "[Pay: X] " in Notes ("[Category] [Pay: Cash] notes"). Editing a saved income entry says it needs the server update.

## doc-share.patch (API v48, share the actual file from any document)
Patch against Api.gs v45 (independent of the other patches here; applies before or after vault-category.patch and vault-paytype.patch). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). Read-only DriveApp calls only (getFileById, getBlob, getAs, getBytes), so the existing `drive.readonly` scope is enough and no re-authorization should be needed.

What it adds:
- new `filebytes` action: `?api=1&pc=PASSCODE&action=filebytes&id=<driveFileId>` returns `{ ok:true, data:{ name, mimeType, mime, size, b64, url, converted } }`.
  - Ordinary files (PDF, images, Word, Excel, PowerPoint, zip and so on): the ORIGINAL bytes, with no conversion.
  - Google Docs, Sheets, Slides and Drawings: exported as PDF (`converted: true`, name gets ".pdf").
  - Other Google types (Forms, Sites, shortcuts): `{ error:'unsupported' }`.
  - Over 20 MB (`API_FILE_MAX_BYTES`, raw or after export): `{ error:'too_big', data:{ size } }`.
  - Same passcode check as every action, and the same Second Brain allow-list as `action=file` (`apiIsAllowed_`): anything outside it returns `forbidden`.
- Nothing about any file or its Drive sharing is changed.

Why: the document viewer's action bar (front end v120) shares the actual file through the phone's share sheet (`navigator.share({ files })`: Messages, Mail, AirDrop, Save to Files), so the recipient gets the file and needs no Drive access. PDFs, images and Google Docs already work through the live `action=file`. That action converts Office files to PDF, and Drive's conversion fails for some .docx (for example the Lisa's Table menu items), so those files have no bytes today. Until this is deployed, Share sends the Drive link instead, with a note that the recipient needs Drive access.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=filebytes&id=1w-xDKd2UUlBd0vGXqrNruo0GNTvjgOtm` should return `"name":"2 egg muffins.docx"` and `"b64":"UEsDB…"` (a .docx is a zip). No front-end change is needed: the app notices the action on its own.

## investments.patch (API v49, Finances > Investments sync)
Independent of the other patches (applies before or after them). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It uses only PropertiesService and LockService, so no new authorization should be needed.

What it adds:
- `action=invest` (read): `{ accts: { etrade, af, crypto } }`. Each account is `{ type, balance, asof, holdings:[{ticker,name,shares,value}], notes, updated }`, or null if never saved.
- `action=investsave` (POST body or GET params): `acct=etrade|af|crypto`, `json=<account object>`, `updated=<ms>`. It replaces that one account in Script Properties (`CC_INVEST_<acct>`, max about 8.5 KB, 60 holdings). An older edit never overwrites a newer one, and anything that looks like an account number (8+ digits) is rejected.

Until it is deployed (front end v121): Finances > Investments works fully on the phone. Edits are saved in that browser's localStorage (`cc_invest_v1`) and the screen says "Saved on this phone only". When the server answers `invest`, the phone merges per account (newest `updated` wins), pushes up any newer phone copy, and then saves every edit to the server too. No front-end change is needed.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=invest` should return `{"ok":true,"data":{"accts":{"etrade":null,"af":null,"crypto":null},"version":49}}` until something is saved.

## fh-fiber-notes.patch (API v50, Fitness & Health: fiber column + meals from Notes)
Patch against Api.gs v45. It is independent of the other patches here and applies before or after dlog-week-sunday.patch, doc-share.patch, investments.patch and health-metrics.patch. Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). No new scopes.

What it adds:
- logday: `fiber=` (g), plus `sugar=` (g) and `sodium=` (mg) for later. They take `mode=add|set` like the macros. The first value adds a "Fiber (g)" (or "Sugar (g)" / "Sodium (mg)") header at the END of the Phone Log, the same way Hike miles and Steps are added. Nothing is moved. The backup and the CC write log journal are the same as for every logday.
- log read: each `ext.history[]` / `ext.today` item also carries `fiber`, `sugar`, `sodium` and `notes` (the day's Notes text, all rows of that day joined with " | ", newest 1,500 characters).
- `ext.version: 22`, `ext.notesInHistory: true`, `ext.write.fiber: true`, `ext.write.nutrients`, and `ext.columns.fiber/sugar/sodium/notes`.
- Optional server-side fiber target: add `fiber: <grams>` to `CONFIG.TARGETS` in Code.gs and it reaches the phone as `ext.targets.fiber`. Nothing sets one today, because Zac hasn't picked a number.

Until it is deployed (front end v122):
- Fiber is saved in the meal's Notes as "[Fiber: N g]" (Food Log and the Tracker's smart fill). It is also kept in the meal list on that phone, so the Food Log can total it.
- The Food Log lists meals added on that phone plus meals in recent voice notes. Meals typed straight into the sheet's Notes appear after the update.
- The phone notices the update on its own (`ext.write.fiber` / `ext.notesInHistory`). After that it sends `fiber=`, reads the Fiber column first, and falls back to the Notes tags for older days. No front-end change is needed.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=log` should include `"notesInHistory":true` and `"fiber":true` inside `ext.write`.

## fh-fiber-backfill.patch (API v50 add-on: fill the Fiber column for old rows)
Apply with fh-fiber-notes.patch (after it) in the same redeploy (Zac signs in). SpreadsheetApp / PropertiesService / LockService only, no new scopes.

Why: the live server (v45) has no action that can write a Fiber column. `logday` writes only calories/protein/carbs/fat/workout/minutes/hike/steps/notes (it adds only "Hike miles" / "Steps" columns), `logset` only weight/sleep/hike, `logadd` only water; `spendfix`/`incomefix` work on the Daily Spend sheet. So no fiber value can reach the Phone Log until this redeploy, and nothing was improvised (no Notes rewrites, no other columns).

What it adds:
- `action=fiberbackfill` (`dry=1` previews; `force=1` also replaces a Fiber cell that holds a different number). Adds "Fiber (g)" at the END of the Phone Log if missing (format copied from the last header, nothing moves), sums each row's "[Fiber: N g]" tags (case-insensitive, several per row; "(edited)" / "(removed)" meal lines handled like the phone does) and writes the total to EMPTY Fiber cells only. Notes, calories, protein, carbs and fat are never written. Same backup as logday (`apiLogBackup_`), one "CC write log" line per cell (action `fiberbackfill <date>`, with the correction text when an override was used).
- Runs once on its own at the first `log` read after the redeploy (Script Property `CC_FIBER_BACKFILL_V1` marks it done; a failure never blocks the read). Running the action again is safe: filled cells are skipped.
- `API_FIBER_BF.overrides`: corrections applied instead of a tag's value, without changing Notes. One today: 10/7 dinner tag 34 g -> 30 g (2 low-carb tortillas x 15 g; ground beef and IPA ~0 g; the row's dinner carbs 59 g / 1176 kcal fit 2 Carb Balance-type tortillas + a 16 oz IPA). Edit `value` there if the tortillas were a low-fiber kind (e.g. 3.5).

Values it will write today (also in `fiber-backfill-values.csv`, to paste by hand into a "Fiber (g)" header in column P if preferred):

| Sheet row | Date | Tags | Fiber (g) |
|---|---|---|---|
| 17 | 2026-10-06 | 2.5 + 7.8 + 7.2 | 17.5 |
| 16 | 2026-10-07 | 4.2 + 0.6 + 34 (corrected to 30) | 34.8 |

Phones that log before the redeploy keep fiber in the "[Fiber: N g]" tag (front end v134 estimates it per food item); the backfill picks those up too. After the redeploy the phone also sends `fiber=` with every meal (`ext.write.fiber`).

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=fiberbackfill&dry=1` should list rows 16 and 17 with `"before":34.8` / `17.5` (already filled by the first `log` read) and `"written":0`.

## health-metrics.patch (API v51, Fitness & Health > Medical > Health Metrics)
Patch against Api.gs v45. It is independent of the other patches here. Apply it, then redeploy (Zac signs in). It uses SpreadsheetApp only, which the script already uses, so no new scopes.

Sheet: "Health Metrics" in Second Brain / Fitness & Health / Medical (id `1NMxPbmskd-yfP3PNg5qgFiivwZFWmyGF2dEL-CIxTgQ`, first tab). Row 1 is the header row: Metric | Current value | Unit | Optimal/target range | Date measured | Measurement standard/source | Levers (diet/supplement) | Notes. It starts EMPTY.

What it adds (both behind the same passcode check as every action):
- `action=healthmetrics`: read-only, creates nothing. Returns `{ version:51, sheetId, url, tab, columns:[{key,label,found}], metrics:[{row, metric, value, unit, range, date, source, levers, notes}] }`. Blank rows are skipped.
- `action=healthmetricset`: `[&row=N&was=<metric now in row N>]&metric=..[&value=..&unit=..&range=..&date=..&source=..&levers=..&notes=..]&cid=..[&dry=1]`.
  - No `row`: appends one metric. The name is required and a duplicate name is refused.
  - With `row`: updates ONLY the fields sent ("" clears one). If `was` doesn't match the metric now in that row (the sheet was re-sorted), it refuses with `moved`.
  - Writes plain-text cells. A value starting with = + - @ is stored as text, never as a formula. Length caps apply per field, up to 500 metrics.
  - LockService, plus cid retry-safety for 6 h. Nothing is ever deleted.
  - Each change is journaled on a "CC write log" tab inside the Health Metrics sheet, created on the first write.
  - A missing header is added right of the last header.

Until it is deployed (front end v122), Medical > Health Metrics shows "No metrics yet" with a link to open the sheet. "+ Add metric" stays disabled, and a note explains that adding and editing switch on after this update. The Daily Log overview card says "None yet". After deploying, the phone notices the action on its own: the list, + Add metric and tap-to-edit start working.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=healthmetrics` should return `"version":51` and `"metrics":[]`.

## tasks.patch (API v52, Home task list Suggestions from the Master project list)
Patch against Api.gs v45 (independent of the other patches here). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It only reads a Sheet (SpreadsheetApp.openById on "Project Tasks — Master", id `1Tso8tdD_Z8oxAL1O1C6ozgOZeUWQnHoiThmtAmk1--w`), so the existing scopes should be enough. Not urgent: CC v121 works fully without it.

What it adds:
- new `suggest` action: `?api=1&pc=PASSCODE&action=suggest[&n=12]` returns `{ ok:true, data:{ items:[{ id, text, project, due, priority }], total, source, at } }`.
  - Reads every tab whose header row starts `Done | Task` (Master, Terra Vi, YSF, Mathiesen, MarVal, ...). Skips "Instructions" and the "· Phone" dashboards.
  - Keeps rows whose Done box is not ticked. The same task on the Master tab and on its project tab counts once.
  - Sort order: priority first (from a "Priority" column if there is one: High/1/P1 = high), then overdue, then due date (rows with no date go last).
  - `id` = `m:` + 12 hex chars of MD5(project|task), so Snooze and Dismiss on the phone keep working after a reload.
- Nothing in the Sheet changes.

Why: the Home Suggestions box (front end v121) offers 3 open items from Zac's project list, with Add to Today, Snooze 3 days and Dismiss. Before this is deployed, the server answers `bad_action` and the phone uses `suggestions.json` in the repo instead (a static seed taken from the Master Sheet on 2026-10-06). After deploying, the box follows the Sheet on its own, and ticking Done in the Sheet removes the item. No front-end change is needed.

The tasks themselves stay on the phone (localStorage `cc.tasks.v1`). Server sync for them is not part of this patch.

v131: the task list and Suggestions moved off Home into Home > Task Manager (Today / Suggestions, collapsible rows with a short title). Each item can carry an optional `title` (short name on the collapsed row; the phone makes one from `text` when it is missing, so the server's `suggest` answer needs no change) and an optional `source: "goal"` for a long-term goal (default label: Master list).

Updating suggestions.json (no deploy needed beyond a push): edit `items` (each item has `id` (unique, stable), `text`, `project`, `due` YYYY-MM-DD, `priority` 1|2, optional `done: true`), bump `updated`, then push to main and spa. The phone re-checks it every time the app opens and keeps the last good copy for offline use.

## lt-menu-save.patch (API v53, Lisa's Table: menu PDFs into Drive > Past Menus)
Patch against Api.gs v45 (independent of the other patches here; applies before or after them). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It uses `DriveApp.createFile` in an existing folder, the same call `receiptsave` already makes, so the existing Drive scope covers it and no new authorization should be needed.

What it adds:
- new `ltmenusave` action (admin, POST JSON body): `{ pc, action:'ltmenusave', cid, name, week, data }`.
  - `data` = the menu PDF as base64 (up to 8 MB). It must start with `%PDF-` and end with `%%EOF`, so a cut-off upload is rejected.
  - `name` is cleaned (no `/ \ : * ? " < > |`, max 120 characters) and gets `.pdf` added.
  - The file goes into Drive > Lisa's Table > Past Menus (`API_LT.menusId` = `11tV_huL874mr4F3LdGA-2fvGQZyEWKZY`, the folder the app lists as Past Menus).
  - It NEVER overwrites: if the name is taken, ` (2)`, ` (3)` ... goes before `.pdf`.
  - `cid` is required. Retrying with the same cid returns the first file (`duplicate:'cid'`) and never files a second copy. The cid is checked in the CC write log first, then in the file description (`CC ltmenusave {"cid":..,"week":..}`), so a retry is still caught if the journal write failed.
  - `dry=1` validates and returns the final name; it creates nothing.
  - Response: `{ ok:true, data:{ id, url, name, folderUrl, bytes, cid, version:53 } }`. The write is journaled in the CC write log (`ltmenusave`, `Past Menus: <name>`, `<id> | <url> | <week> | <bytes>`, cid).
- Same passcode check as every action. Nothing else in Drive changes.

Until it is deployed (front end v127):
- On the Generate menu screen, Generate PDF makes the PDF on the phone (pdf-lib, Crimson Text, the Lisa's Table logo). It is saved in that browser's IndexedDB (`cc_ltmenus`), shown with "Saved on this phone; will sync to Drive after update", and listed under Saved menus at the top of Past Menus.
- Share (iPhone share sheet with the PDF file), Email / Text (a new message with the menu typed out) and Download work right away. They don't need the server.
- The phone tries `ltmenusave` after each Generate and whenever Lisa's Table or Past Menus opens. After a `bad_action` it waits 30 minutes before trying again.

After deploying, no front-end change is needed. The next time Lisa's Table opens, every waiting menu uploads on its own (same cid, so no doubles), each card switches to "Saved to Drive › Past Menus", and the PDF shows up in the Drive list.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=ltmenusave&dry=1&name=Test` should return `{"ok":true,"data":{"dry":true,…,"name":"Test.pdf",…,"version":53}}`. The dry run creates nothing.

## lisa-requests.patch (API v54, Lisa > Change requests)
Patch against Api.gs v45 (independent of the other patches here; applies before or after them). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It only opens one existing spreadsheet with SpreadsheetApp (the same kind of write `wishadd` already does), so no new authorization should be needed.

The sheet: **Lisa Change Requests**, Drive > Second Brain > Lisa's Table, id `1XIa2IhGWY2DWzqIRsvxzf0A94g8Y9Y7z4ItsPXo5Y8c` (created 2026-10-07; `API_LR.sheetId`, with a find-by-name fallback in the Lisa's Table folder). First tab, row 1 = `ID | Submitted | Section | Request | Status | Reply | Updated`. Nothing in this patch creates a sheet or changes any sharing.

What it adds:
- `lisareq` (POST JSON body, or GET): `{ pc, action:'lisareq', id, text, section:'lt'|'pt'|'both', ts }`. Appends one row: ID = the phone's id (`lr…`), Submitted = `ts` when within the last 60 days (when Lisa wrote it), else now; Section = `Lisa’s Table` / `Personal Training` / `Both`; Request (line breaks kept, max 4000 characters, stored as text so it can never become a formula); Status = `New`; Reply empty; Updated = now. The id is the idempotency key: sending the same id again returns the saved row (`duplicate:'id'`) and never adds a second one. `dry=1` validates only. The CC write log gets one line (id, section, number of characters; not the request text).
- `lisareqlist` (read): `{ items:[{ id, row, submitted, section:'lt'|'pt'|'both', sectionLabel, request, status, reply, updated }], counts, total, sheetUrl, version:54 }`, newest first. Any status typed in the sheet is read loosely ("done", "in progress", "needs ok", blank = New) and comes back as one of `New`, `In progress`, `Needs your OK`, `Done`. Rows typed by hand without an ID get `row<N>`.
- `lisareqset` (for Lisa's Assistant): `id`, `status` (New | In progress | Needs your OK | Done), `reply` (max 4000; `''` clears; `reply_mode=append` adds under the old reply). Sets Updated = now. GET for short replies, POST JSON body for long ones. `dry=1` previews.
- `lisareqdel` (test cleanup only): deletes ONE row, and only when its Request starts with `TEST`.

Until it is deployed (front end v130): Home > Lisa > Change requests works on the phone. A request is saved in that browser's localStorage (`cc_lisareq_v1`) with the chip "Waiting to send", and the screen says "Not connected yet … will send on their own after Zac's server update. Lisa's Assistant can't see them until then." Every open, Refresh and pull-down (and a quiet check at most every 30 minutes while the app is open, when something is waiting) asks `lisareqlist`; the live server answers `bad_action`, so nothing is sent.

After deploying, no front-end change is needed: the next check gets an answer, every waiting request is sent (same id, so no doubles), the banner turns to "Connected", and the list shows the sheet's statuses and replies.

Lisa's Assistant, a few times a day:
1. Read: Drive `read_file_content` on `1XIa2IhGWY2DWzqIRsvxzf0A94g8Y9Y7z4ItsPXo5Y8c` (or `…/exec?api=1&pc=PASSCODE&action=lisareqlist`). New work = rows with Status `New` (or blank).
2. While working: `…/exec?api=1&pc=PASSCODE&action=lisareqset&id=<ID>&status=In%20progress&reply=<short note>`.
3. Need Lisa to decide something: `status=Needs your OK` with the question in `reply`. (She gets an Answer button; her answer arrives as a new request that starts with `About "…":`.)
4. Finished: `status=Done` with what changed in `reply`.
The Drive connector tools can read the sheet but cannot edit cells, so replies go through `lisareqset` (or someone types them into the Status / Reply cells; the app reads whatever is there).

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=lisareqlist` should return `{"ok":true,"data":{"exists":true,…,"items":[],…,"version":54}}`, and `…&action=lisareq&id=lrcheck1&text=TEST%20check&section=lt&dry=1` should return `"dry":true` without writing anything.

## biz-receipts.patch (API v55, KiwiT / TiwiK: receipts into Expenses > Receipts)
Patch against Api.gs v45 (independent of the other patches here; applies before or after them). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It uses `DriveApp.createFile` in an existing folder, the same call `receiptsave` and `ltmenusave` make, so the existing Drive scope covers it and no new authorization should be needed.

The folders (created 2026-10-09, nothing moved or shared):
- KiwiT LLC > Business Documents > Expenses `1Zq4WJ_IamecqJk5A5s5G7O8i4_dATUtr` > Receipts `1kCEyz-1vCD8ffc5sF04uoXk7Uyp7YZJY`
- TiwiK Laundromat > Expenses `14fu87P8z91yIS5yUyG0aW0SrxJsIvepg` > Receipts `1m-e8g1IhEA8PLymp81lJfuplqY_hEFlj`

What it adds:
- `bizreceipts` (read-only): `{ canUpload:true, ents:{ kiwit|tiwik:{ folderId, folderUrl, found, count } }, version:55 }`. The phone asks it (never cached) to know it can upload.
- `bizreceiptsave` (admin, POST JSON body): `{ pc, action:'bizreceiptsave', cid, ent:'kiwit'|'tiwik', date, amount?, merchant?, mime, data }`.
  - Writes only to the two Receipts folders above (`API_BIZRC.folders`); any other `ent` is `bad_value`.
  - `mime` = `image/jpeg`, `image/png` or `application/pdf`; `data` = base64, up to 8 MB, and its first bytes must match the type.
  - Name `<date> <merchant> $<amount>.<ext>` (for example `2026-10-09 Home Depot $42.50.jpg`; `2026-10-09 Receipt.jpg` with neither). It NEVER overwrites: ` (2)`, ` (3)` ... goes before the extension.
  - `cid` is required. The same cid returns the first file (`duplicate:'cid'`), checked in the CC write log first, then in the file description (`CC bizreceiptsave {...}`).
  - `dry=1` validates and returns the final name; it creates nothing.
  - Journaled in the CC write log (`bizreceiptsave`, `KiwiT Receipts: <name>`, `<id> | <url> | <bytes>`, cid). It does not add a row to any sheet.

Until it is deployed (front end v135): KiwiT and TiwiK > Business Documents show Expenses > Receipts (listed live through the existing `action=folder`). Receipts has "Add receipt in Drive", which opens that Receipts folder in Google Drive (tap + > Scan or Upload). The app asks `bizreceipts` at most every 30 minutes; the live server answers `bad_action`.

After deploying, no front-end change is needed: the next check gets `canUpload:true` and Receipts shows "Add receipt" (camera) and "Photo or PDF" (library / Files). Photos are shrunk on the phone to a JPEG (as in the Vault), PDFs are sent as they are; then Date, Amount and Merchant (optional) and Save receipt.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=bizreceipts` should return `"canUpload":true` with both folders `"found":true`, and `…&action=bizreceiptsave&ent=kiwit&dry=1&merchant=Test&amount=1` should return `"dry":true,…,"name":"<today> Test $1.00.jpg"` without writing anything.

## zac-lists.patch (API v56, Zac > Wetumka project lists sync)
Independent of the other patches (applies before or after them). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). It uses only PropertiesService and LockService (same as investments.patch), so no new authorization should be needed.

What it adds:
- `action=lists` (read): `{ lists: { <slug>: { slug, items:[{id,text,note,done,doneAt,updated,del}], order:[ids], orderAt, updated } }, version: 56 }`. Lists never saved are simply missing.
- `action=listsave` (POST body or GET params): `slug=garage|connex|landscaping|<any lowercase slug>`, `json=<list object>`. The server MERGES it into the stored copy (per item the newer `updated` wins; a delete is an item with `del:true`, remembered 60 days; the order comes from the copy with the newer `orderAt`) and returns the merged list. One Script Property per list (`CC_LIST_<slug>`, at most about 8.8 KB, roughly 60 to 80 items with short notes; max 40 lists).

Until it is deployed (front end v149): Home > Zac > Wetumka > Garage organization / Connex box / Landscaping work fully on the phone. Items are saved in that browser's localStorage (`cc_zlists_v1`) and each list says "Saved on this phone only". When the server answers `lists`, the phone merges, pushes its copy up, and then saves every change to the server too (Zac's and Lisa's devices then see the same lists). No front-end change is needed. Garage organization is seeded on every device with the same five items (same ids), so they never double up.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=lists` should return `{"ok":true,"data":{"lists":{},"version":56}}` until a phone has opened a list.

## family-chase.patch (API v57, Vault > Family Chase card review + Bank Review) — PENDING
Patch against the live Api.gs v55 (independent of zac-lists v56; applies before or after it). It adds two actions and touches ONE spreadsheet: **Family Chase 1982 — 2026 Review** in Drive > Financial > Bank Accounts > Chase-Personal, id `1CQLMaheQMkUf2-emOaF_6UEjemsbcNzvCXiK7gNS33c` (created 2026-10-11; `API_FC.sheetId`, with a find-by-name fallback in folder `1Qr-LloEiCbuI7vvgSEteCB11hfPDVHk9`). It never opens the Vault's Daily Spend / Accounts tabs, never calls spendadd / acctadd, and writes nothing to the CC write log. No transaction data is in this repo: the rows live only in that private Sheet.

Easiest way to deploy (no merge with other patches): in the Apps Script editor add a new script file **FamilyChase** and paste all of `backend/FamilyChase.gs` into it; then in Api.gs, inside `switch (String(action || ''))`, add these two lines just above `default:` and redeploy (Deploy > Manage deployments > edit > New version):
```
      case 'ccrev':    return apiCcRev_(extra.all || {});      // v57
      case 'ccrevset': return apiCcRevSet_(extra.all || {});   // v57
```
(Or apply `family-chase.patch`, which puts the same code at the end of Api.gs plus the two lines. Do one or the other, not both.)

What it adds:
- `ccrev` (read-only): `{ exists, sheetUrl, cols:[header names], rows:[[...]], payCols, pays:[[...]], counts:{Unreviewed,Confirmed,Changed}, total, version:57 }` from the Review and Card payments tabs. Dates come back as `yyyy-MM-dd`.
- `ccrevset` (admin): POST JSON body `{ pc, action:'ccrevset', cid, items:[{ id, review:'Confirmed'|'Changed'|'Unreviewed', category, account:'Household'|'TiwiK'|'KiwiT'|'', note }] }` (max 500), or GET `id=&review=&category=&account=&note=&cid=` for one row. Writes ONLY the five review columns (review status, reviewed category, reviewed account, review note, reviewed at) of the rows found by id, as plain text (a leading = + - @ gets an apostrophe). `review=Unreviewed` clears the other four (Undo). LockService; the same cid within 6 h returns the first answer (`duplicate:'cid'`), and the write is idempotent anyway (it sets cells, it never appends). Unknown ids -> `not_found`, bad review/account -> `bad_value`, missing or split review columns -> `no_columns`. `dry=1` validates and changes nothing.

Until it is deployed (front end v150): Finances > Family Chase (and the link at the bottom of the Vault) already works. The live server answers `ccrev` with bad_action, so the phone reads the private CSV snapshot of the Sheet (`Family Chase 1982 — 2026 Review (app snapshot).csv`, id `1dvhKKxtEejQwDAY9_kExt3pmR5-xxPUf`, same folder) through the existing passcode-checked `action=filebytes` (Financial is an allowed life-area folder). Every Confirm / change / note is kept in that phone's localStorage (`cc_fchase_v1`, the choices only) with the chip "On this phone", and the screen says "Needs the next server update to save to Drive".

After deploying, no front-end change is needed: the next open gets `ccrev`, reads the Sheet itself, and sends every waiting choice with `ccrevset` (batches of up to 400, one cid each). Choices made offline queue the same way and go when the phone is back online.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=ccrev` should return `"exists":true,…,"total":1338,…,"version":57`, and `…&action=ccrevset&id=<any id from the sheet>&review=Confirmed&cid=check1&dry=1` should return `"dry":true` and change nothing.

### Also in family-chase.patch since front end v151: `sheet=bank` (Vault > Bank Review) — PENDING, same deploy
The same two actions take an optional `sheet` param (whitelist only; the phone can never pass a file id): `fchase` (default, unchanged) or `bank` = **Bank of Stockton — 2026 Review**, id `15WDC1pzG8X4yVjogg_RlExwhgnnt_pveipANRMDceyc`, in Drive > Financial > Bank Accounts (find-by-name fallback in `1WfXqvke-m3KwtHUicPI8HMhUd4H112NA`). It holds Joint Checking, Lisa Checking and Joint Savings 2026 rows (tab **Review**, same first 14 columns as Family Chase, then auto note | question | bank account | statement | direction) and the open questions for Zac (tab **Questions**: id | question | detail | related ids | related count | related amount | the same five review columns).
- `ccrev&sheet=bank`: `{ sheet:'bank', exists, sheetUrl, cols, rows, qCols, qs, counts, total, version:57 }`.
- `ccrevset` with `sheet:'bank'`: same body; ids are looked up in Review, then Questions; `account` may also be `Transfer` and `review` may also be `Answered` (questions). Still writes ONLY the five review columns of those two tabs; nothing in the Vault.
- If FamilyChase.gs was already pasted from an older copy, replace the whole file with the current `backend/FamilyChase.gs` (the two `case` lines in Api.gs stay the same).

Until it is deployed (front end v151): Finances > Bank Review (#bank) reads the private CSV snapshot `Bank of Stockton — 2026 Review (app snapshot).csv` (id `11YSBbk-VmsLHmfomsYcIAJkcPyQb5smV`, same folder) through `action=filebytes`; choices and answers are kept in that phone's localStorage (`cc_bank_v1`) and sent with `ccrevset&sheet=bank` automatically after the deploy.

Check after deploying: `…&action=ccrev&sheet=bank` should return `"exists":true,…,"total":301,…` with 15 `qs`; `…&action=ccrevset&sheet=bank&id=q01-bigdep&review=Answered&note=test&cid=check2&dry=1` returns `"dry":true` and changes nothing.

## lisa-trade-ptphotos.patch (API v56, PENDING: Lisa's Table "Trade" payment type + PT client workout photos)
Patch against Api.gs v55 (the deployed version). Apply it, then redeploy the Apps Script web app (Zac signs in, Deploy > Manage deployments > edit > New version). Uses DriveApp.createFolder / createFile in the Lisa's Table folder, the same Drive write scope v55 already has for ltmenusave / bizreceiptsave, so no new authorization should be needed.

What it adds:
- Orders: `payMethod=trade` is accepted by orderpaid and orderset (today: `bad_value: payMethod must be cash, zelle or venmo`, checked live with dry=1 on 10/12). The weeks aggregate gets `byMethod.trade`.
- `action=ptphotos&clientId=pc..` (read): the client's photos `{canUpload, folderUrl, photos:[{id,name,url,date,note,created}]}`. Creates nothing.
- `action=ptphotosave` (POST): `clientId, name, date, mime=image/jpeg|image/png, data=<base64>, cid[, note][, dry]`. Files "<date> Past workouts.jpg" in Drive > Lisa's Table > PT Client Photos > "<client name> (<client id>)" (folders created on first use). Never overwrites; the cid in the file description means a retry never files twice. Journaled in the CC write log.

Until it is deployed (front end v156):
- Orders > payment picker > "Mark paid (trade)" (and the Trade chip under "How was it paid?") is saved with the existing Trade status (payStatus=trade). The phone sees the bad_value, remembers it for 6 h and saves Trade that way. Lisa's existing Trade status flow is unchanged. The Vault never counts paid-by-trade as cash income, before or after the update.
- PT > client > History > "Photos of past workouts": photos stay on that phone (IndexedDB `cc_ptphotos`) and show "On this phone; saves to Drive after the server update". After the deploy the phone uploads every waiting photo on its own (retried at most every 30 min). No front-end change is needed.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=orderpaid&orderId=<id>&payStatus=paid&payMethod=trade&cid=x&dry=1` returns ok, and `action=ptphotosave&clientId=pcmuzxfsgmhs6&dry=1` returns `{"ok":true,...,"version":56}`.

## workout-set.patch + WorkoutSet.gs (API v58, PENDING: edit / delete any workout item, including dictated "Workout:" Notes lines)
Independent of zac-lists (v56), lisa-trade-ptphotos (v56) and family-chase (v57); apply before or after them. Only touches the Fitness Phone Log tab (same sheet, backup tab and CC write log as logday). No new authorization.

Deploy (Zac, in the Apps Script editor):
1. File > + > Script, name it **WorkoutSet**, paste all of `backend/WorkoutSet.gs`.
2. In Api.gs, inside `switch (String(action || ''))`, right under `case 'logday': ...`, add:
   `      case 'workoutset': return apiWorkoutSet_(extra.all || {});   // v58`
3. Save, then Deploy > Manage deployments > (the API deployment) > edit > Version: New version > Deploy.

What it adds: `action=workoutset&date=YYYY-MM-DD&workout=&workout_min=&hike_miles=&details=&cid=[&dry=1]`.
- Unlike logday, a param sent BLANK clears the cell (workout type, minutes, hike miles; "Workout today?" follows: Y, N for rest/none, blank when cleared). Params not sent are left alone.
- `details` (if sent) rewrites the day's Notes: every " | "-separated `Workout: ...` / `Workout details: ...` segment is removed and, if non-blank, one `Workout: <details>` is added. Meals and every other note stay exactly as they were.
- A date can have several Phone Log rows (the reader merges them, newest non-blank wins), so the newest row gets the value and the same cells of older rows of that date are blanked (otherwise the old value would show through). Only workout type / minutes / hike miles / Workout today? and the Workout: Notes segments are touched.
- Same validation, LockService, 6 h cid replay and daily values-only backup as logday; each changed cell is journaled as `workoutset`. `dry=1` returns the planned before/after and writes nothing.

Until it is deployed (front end v166): the Workout Log's inline Edit works for the workout text, minutes and miles through logday (deleting all items marks the day Rest / none, 0 min, 0 mi). Items from Notes (dashed boxes) can be edited on screen, but the old Notes lines can't be removed, and the app says so ("needs the server update (workoutset)"). The phone asks `workoutset` first, remembers a bad_action for 6 h and uses logday meanwhile. No front-end change is needed after deploying.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=workoutset&date=<a logged day>&workout=Test&dry=1` returns `{"ok":true,"data":{…,"version":58,"dry":true,"written":{…}}}` and changes nothing.

## LtIngredients.gs (API v59, PENDING: Lisa's Table > Ingredients, meals/recipes, product + label photos)
Independent of every other pending patch (v56 / v57 / v58); apply before or after them. Uses the same Drive and Sheets access the script already has (ltmenusave / bizreceiptsave / ptphotos), so no new authorization.

Deploy (Zac, in the Apps Script editor):
1. File > + > Script, name it **LtIngredients**, paste all of `backend/LtIngredients.gs`.
2. In Api.gs, inside `switch (String(action || ''))`, right under `case 'ltmacroset': ...`, add these 4 lines:
   `      case 'lting':      return apiLtIng_();                        // v59`
   `      case 'ltingset':   return apiLtIngSet_(extra.all || {});      // v59`
   `      case 'ltingdel':   return apiLtIngDel_(extra.all || {});      // v59`
   `      case 'ltingphoto': return apiLtIngPhoto_(extra.all || {});    // v59`
3. Save, then Deploy > Manage deployments > (the API deployment) > edit > Version: New version > Deploy.

What it adds (all writes need a `cid`, are journaled, and replay-safe; `dry=1` plans and writes nothing; reads and dry runs never create anything):
- `action=lting` -> `{ingredients:[…], meals:[…], sheetUrl, folderUrl, canUpload:true, version:59}`.
- `ltingset` (POST) `kind=ingredient|meal&rec=<json>&cid` upserts by `rec.id` into the sheet **Lisa's Table - Ingredients** (created in the Lisa's Table folder on the first real write; id kept in script property `CC_LTING_SHEET_ID`). Tabs **Ingredients** (name, brand, serving, calories, protein, carbs, fat, fiber, package size, package price, cost per serving, notes, photo links, updated, json) and **Meals** (name, servings, components, per-serving macros, total cost, cost per serving, menu item, updated, json). An older `rec.upd` than the stored one is refused as `stale` (the newer copy wins).
- `ltingdel` (POST) `kind&id&name&cid` deletes a row (name must still match; photos stay in Drive). The app does not call it yet: deleting on the phone only removes the phone copy.
- `ltingphoto` (POST) `ingId&name&slot=product|label&mime=image/jpeg|image/png&data=<base64>&cid` -> Lisa's Table > **Ingredient Photos** > "<name> (<id>)" > "<date> Product.jpg" / "<date> Label.jpg" (8 MB cap, never overwrites, cid in the file description).

Until it is deployed (front end v183): Ingredients, photos and meals are kept on the phone only (ingredients in the same localStorage list as Cost & Macros, photos in IndexedDB, meals in `cc_lt_ing_meals`) and the screen shows "Saved on this phone · not synced yet (server update pending)". While the server says bad_action, the phone asks `lting` again at most every 30 minutes (when Ingredients is opened or something is saved); once it answers, it uploads the photos, then every ingredient and meal, and the badge turns to "Synced to Drive · Open sheet". No front-end change is needed after deploying.

Check after deploying: `…/exec?api=1&pc=PASSCODE&action=lting` returns `{"ok":true,"data":{"canUpload":true,"ingredients":[],"meals":[],…,"version":59}}` and creates nothing. A dry write: `…&action=ltingset&kind=ingredient&rec={"id":"ctest1","name":"Test"}&dry=1` returns `"action":"added","dry":true` and writes nothing.
