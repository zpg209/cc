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
