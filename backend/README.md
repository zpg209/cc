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
