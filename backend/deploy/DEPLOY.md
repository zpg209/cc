# Command Center server update v55 -> v59 (one-shot deploy)

Files (copy each one from its raw link: open it, Ctrl+A / Cmd+A, Ctrl+C / Cmd+C):
- Api.gs (REPLACES the existing Api.gs): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/Api.gs
- FamilyChase.gs (NEW file "FamilyChase"): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/FamilyChase.gs
- WorkoutSet.gs (NEW file "WorkoutSet"): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/WorkoutSet.gs
- LtIngredients.gs (NEW file "LtIngredients"): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/LtIngredients.gs
Code.gs, appsscript.json, Index.html, Styles.html, JavaScript.html: do NOT change.

Built from the v55 Api.gs (/workspace/redeploy/Api.gs, the 2026-10-09 deploy) + zac-lists (v56) + lisa-trade-ptphotos (v56)
+ family-chase (v57) + workout-set (v58) + Lisa's Table Ingredients (v59). All routing lines are already in Api.gs.

## Steps
1. In Chrome, signed in as zac@landstruc.com, open
   https://script.google.com/home/projects/1seX6VfX7hC5vKq4SmLLPRZXO1XyG-kt93Ozk2GMp4tJJvbnwz47bbhb5/edit
2. Left side, Files: click **Api.gs**. Click in the code, Ctrl+A (Cmd+A), Delete.
3. Open the Api.gs raw link above in another tab, Ctrl+A, Ctrl+C. Back in the editor, Ctrl+V. Wait until it finishes pasting.
   Check: line 1 starts with "// Command Center API v59", line 2 is "var API_VERSION = 59;".
4. Ctrl+S (Cmd+S). Wait until the save finishes (no orange dot). A red error bar = stop and send a screenshot.
5. Click the **+** next to "Files" > **Script**. Type the name **FamilyChase** (no ".gs"), press Enter.
   Select all the starter code in it (function myFunction...) and delete it. Paste all of FamilyChase.gs. Ctrl+S.
   If a FamilyChase file is ALREADY there, don't add a second one: replace its whole contents instead.
6. Same again: **+** > **Script** > name **WorkoutSet** > delete the starter code > paste WorkoutSet.gs > Ctrl+S.
7. Same again: **+** > **Script** > name **LtIngredients** > delete the starter code > paste LtIngredients.gs > Ctrl+S.
8. Top right: **Deploy** > **Manage deployments**. Select the existing **Web app** deployment, click the **pencil** (Edit).
   Version: choose **New version**. Description: "v59". Click **Deploy**. (Do NOT use "New deployment": that would change the web address.)
9. If Google asks to authorize: Review permissions > choose zac@landstruc.com > Advanced > Go to (project) > Allow.
   It shouldn't ask, because nothing new needs permission (same Sheets / Drive / Docs as today).
10. Click Done. Open the check links below.

## Checks (all read-only or dry runs; nothing is written)
Replace PASSCODE with the app passcode. E = https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec?api=1&pc=PASSCODE
1. E&action=version -> "version":59
2. E&action=lists -> "ok":true ... "version":56   (zac-lists)
3. E&action=ptphotosave&clientId=pcmuzxfsgmhs6&dry=1 -> "ok":true,"dry":true ... "version":56   (lisa-trade-ptphotos)
4. E&action=ccrev -> "exists":true ... "version":57   and   E&action=ccrev&sheet=bank -> "exists":true   (family-chase, read-only)
5. E&action=ccrevset&sheet=bank&id=q01-bigdep&review=Answered&note=test&cid=check2&dry=1 -> "dry":true
6. E&action=workoutset&date=2026-10-17&workout=Test&cid=check3&dry=1 -> "dry":true ... "version":58
7. E&action=lting -> "ok":true,"ingredients":[],"meals":[] ... "version":59
8. E&action=ltingset&kind=ingredient&rec={"id":"ctest1","name":"Test"}&dry=1 -> "dry":true,"action":"added"
9. E&action=ltingphoto&ingId=ctest1&slot=label&dry=1 -> "dry":true,"folder":"would create"
10. E&action=bizreceipts -> still "canUpload":true ... "version":55 (old actions unchanged)

Rollback: Deploy > Manage deployments > pencil > Version: pick the previous version (v55) > Deploy.
