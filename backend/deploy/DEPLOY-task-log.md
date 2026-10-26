# Command Center server update: Task Log -> project Running Notes (app v205+)

NOT deployed. The phone app works without it:
- Task Log, project tags and the per-task note mic work now (they're stored on the phone).
- Completed tasks tagged **Terra Vi** or **Hetch Hetchy** already go to those Running Notes Docs now through the existing `addnote` action.
- Tasks for **MarVal, Mathiesen (Boyer Matheson), Mariposa Gold Mine, YSF, Brocchini and Yosemite Clean Energy** are queued on the phone.
  The server answers `bad_project` until this change is deployed. After that they're sent the next time Task Manager opens,
  or right away from Task Log > "Send N to Running Notes".

## The change (one block in Api.gs; nothing else)
In the Apps Script editor, open **Api.gs**, find `var API_NOTES_DOCS = {` and replace that whole block (down to `};`) with:

```js
var API_NOTES_DOCS = {
  terravi: '1YprGTVSb6kM83f0Enfk2bSf8rAsbKVV7vHwCm_qoDg8',            // Terra Vi — Running Notes
  hetchhetchy: '1UcmzxYhHvnPMzqy6JbE6GE81yPVf2D5h4v1EEdnsNoY',        // Hetch Hetchy — Running Notes (added 2026-10-01)
  marval: '1QYFLyzaQQuBLJ8VWt1dtDOO7C8TzhspmCKqAvwwHbyQ',             // MarVal — Running Notes (Task Log, 2026-10-26)
  mathiesen: '1TlX0iF4u8RO2pSRtvrR_StD7xkv6OMsn0Wm4-ZktEwE',          // Mathiesen — Running Notes (Boyer Matheson)
  mariposagoldmine: '1kk1spt1o97eJzgKaYZ4asAVpM9ZWQzmFptiI-AFfAnU',   // Mariposa Gold Mine — Running Notes
  ysf: '1jQ5a0PQtz6AvGt21XaXdKMo3rHUR_bSYNIRWASdl6qk',                // YSF — Running Notes
  brocchini: '1Bz8I26Q_6QGNAWfgv2EToR1MeHsMHCqOtRafSPl_aS8',          // Brocchini — Running Notes
  yosemitecleanenergy: '17JTpaGedaJFWDv4b4teddd_76mxGGmKjphMSh0apuIU'  // Yosemite Clean Energy — Running Notes
};
```

Ctrl+S, then **Deploy > Manage deployments > Web app > pencil (Edit) > Version: New version > Deploy**.
Do NOT use "New deployment" (that would change the web address). No new permissions are needed (same Docs scope).

Each added Doc already has the STATUS / TO DO / DONE LOG / DETAIL LOG layout that `addnote` writes into: a dated
"Field notes" line under DONE LOG. (The YSF, Brocchini and Yosemite Clean Energy Docs are short. If one has no DONE LOG heading,
the app shows "Waiting…" and the server returns no_done_log. Add a line "DONE LOG" to that Doc.)

## Check
https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec?api=1&pc=PASSCODE&action=notes&project=marval
should return the MarVal notes (not bad_project).
