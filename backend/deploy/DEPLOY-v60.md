# Command Center server update v59 -> v60 (optional: better label reading)

NOT deployed. The phone app (v187+) works without it; it only uses this when the phone's own label reader got too little,
and quietly skips it while the server answers bad_action.

What it adds: action `ltingocr` (POST: mime, data=base64 photo). The server makes a temporary Google Doc from the photo with
Drive's OCR, reads the text, trashes the Doc and returns the text. Drive's OCR reads curved cans, glare and small print far
better than the in-browser reader. Nothing is stored.

Files (copy each one from its raw link):
- Api.gs (REPLACES the existing Api.gs): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/Api.gs
- LtIngredients.gs (REPLACES the existing LtIngredients file): https://raw.githubusercontent.com/zpg209/cc/main/backend/deploy/LtIngredients.gs

## Steps
1. Open the Apps Script project (signed in as zac@landstruc.com):
   https://script.google.com/home/projects/1seX6VfX7hC5vKq4SmLLPRZXO1XyG-kt93Ozk2GMp4tJJvbnwz47bbhb5/edit
2. Api.gs: select all, delete, paste the new Api.gs. Check line 2 is "var API_VERSION = 60;". Ctrl+S.
3. LtIngredients: select all, delete, paste the new LtIngredients.gs. Ctrl+S.
4. Left side, **Services** (+) > **Drive API** > **Add** (keep the identifier "Drive"; v3 is fine).
5. Deploy > Manage deployments > the Web app > pencil > Version: **New version**, description "v60" > Deploy.
   (Not "New deployment": that would change the web address.)
6. If Google asks to authorize: Review permissions > zac@landstruc.com > Advanced > Go to (project) > Allow.

## Checks (no writes)
E = https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec?api=1&pc=PASSCODE
1. E&action=version -> "version":60
2. E&action=ltingocr&dry=1 -> "dry":true,"available":true   (false = step 4 was skipped)
3. In the app: open an ingredient with a label photo > Re-read label. The message says "Read from label (server)" when Drive did the reading.
