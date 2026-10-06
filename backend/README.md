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
