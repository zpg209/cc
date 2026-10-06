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
