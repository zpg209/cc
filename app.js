/* Command Center — static front end for GitHub Pages.
 * Data comes from the passcode-protected Apps Script JSON API (Api.gs).
 * The passcode is typed by the user and kept only in this device's localStorage. */
(function () {
  'use strict';

  // Public web app URL of the separate "Anyone" API deployment (the passcode protects the data).
  var API_URL = 'https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec';
  var PC_KEY = 'cc_passcode';
  var FALLBACK_URL = 'https://script.google.com/a/macros/landstruc.com/s/AKfycbyigotJxdJD3CeCpRyCEfhHdL7zcv2ZE_ibTm2ZyITgODqrh_NxGhONx6m8CcBlxaPD/exec';

  var state = { weekOffset: 0, monthOffset: 0, links: null, logSeq: 0, logData: null, logOpen: {}, trkSeq: 0, trackData: null, trkMode: 'add', trkDate: '', trkBusy: false, trkFormsFor: '', logTot: 'month', waterBusy: false, bodyBusy: false, spendSeq: 0,
    spendData: null, spendDataOff: null, spendRoute: { kind: '', val: '', acct: '' },
    biz: null, bizSlug: '', docFrom: 'home', docPushed: false, scrollMem: {}, docTimer: 0,
    docSeq: 0, docKey: '', proxyOff: false, reData: null, reAt: 0, insData: null, insAt: 0, reRoute: { ins: false, slug: '' }, ltPart: '', ltCache: {}, ltOpen: {},
     folderCache: {}, docUrls: [], pdf: null, pdfObserver: null, finKind: '', ovKey: '', insSlug: '', spendFrom: '', projSlug: 'terravi' };
  var SCREENS = ['lock', 'home', 'projects', 'log', 'spend', 'biz', 'doc', 're', 'lt', 'proj', 'notes', 'mic', 'docs', 'punch', 'fin', 'insn', 'ent', 'track', 'trust', 'vmic', 'vcam', 'pt', 'mf', 'pc'];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n, d) {
    if (n === null || n === undefined || n === '') return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0 });
  }
  function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }


  function getPc() { try { return localStorage.getItem(PC_KEY) || ''; } catch (e) { return ''; } }
  function setPc(v) { try { v ? localStorage.setItem(PC_KEY, v) : localStorage.removeItem(PC_KEY); } catch (e) {} }

  /* ---------------- API ---------------- */
  function AuthError() { this.message = 'auth'; }
  function api(action, offset, pcOverride) {
    var pc = pcOverride || getPc();
    var url = API_URL + '?api=1&action=' + encodeURIComponent(action) +
      '&offset=' + encodeURIComponent(offset || 0) + '&pc=' + encodeURIComponent(pc) + '&_=' + Date.now();
    return fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' })
      .then(function (r) {
        if (!r.ok) throw new Error('Server returned ' + r.status);
        return r.text();
      })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('Unexpected response from server.'); }
        if (j.error === 'auth') throw new AuthError();
        if (j.error === 'locked') throw new Error('Too many wrong passcodes. Try again in 10 minutes.');
        if (j.error) throw new Error(j.message || ('Server error: ' + j.error));
        return j.data;
      });
  }
  // Full JSON response (errors included) for actions that need error codes/data (file, folder).
  function apiRaw(action, params) {
    var url = API_URL + '?api=1&action=' + encodeURIComponent(action) + '&pc=' + encodeURIComponent(getPc()) + '&_=' + Date.now();
    Object.keys(params || {}).forEach(function (k) { url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
    return fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Server returned ' + r.status); return r.text(); })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('Unexpected response from server.'); }
        if (j.error === 'auth') throw new AuthError();
        if (j.error === 'locked') throw new Error('Too many wrong passcodes. Try again in 10 minutes.');
        return j;
      });
  }
  function friendly(err) {
    if (err instanceof AuthError) return 'Passcode no longer valid.';
    var m = String((err && err.message) || err || 'Something went wrong.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = "Couldn't reach the server. Check your connection and try again.";
    return m;
  }
  function onFail(boxIds, retry) {
    return function (err) {
      if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return; }
      var h = '<div class="error" style="grid-column:1/-1">' + esc(friendly(err)) +
        '<div class="retry"><button class="navbtn" data-retry>Try again</button></div></div>';
      boxIds.forEach(function (id) { $(id).innerHTML = h; });
      boxIds.forEach(function (id) {
        var b = $(id).querySelector('[data-retry]');
        if (b) b.addEventListener('click', retry);
      });
    };
  }

  /* ---------------- Navigation ---------------- */
  function activate(name) {
    SCREENS.forEach(function (s) { $('screen-' + s).classList.toggle('active', s === name); });
    window.scrollTo(0, 0);
  }
  // Routes: "home", "track" (Daily Tracker), "log" (Daily Log), "spend", "spend/cat/<Category>[/<Account>]", "spend/acct/<Account>",
  //         "spend/income/<Source|All>", "spend/all", "spend/cash/<Account|All>[/<Category>]",
  //         "spend/who/<Zac|Lisa>", "spend/calc/<tiwik-net|lt-net|hh-spend|avg-spend|avg-income>"   (segments are URI-encoded)
  //         "spend/debt/<total|service|bills>[/<Entity>]", "spend/debt/loan/<key>", "spend/debt/bill/<id>"   (Vault Debt / Upcoming bills drill-down: rows of the Debts + Bills tabs)
  function dec(v) { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } }
  //         "doc?u=<url>&t=<title>&from=<route>"   (in-app document viewer)
  function parseRoute(r) {
    r = String(r || '').replace(/^#/, '');
    var q = '', qi = r.indexOf('?');
    if (qi >= 0) { q = r.slice(qi + 1); r = r.slice(0, qi); }
    var parts = r.split('/');
    return { base: parts[0] || 'home', kind: parts[1] || '', val: dec(parts[2]), acct: dec(parts[3]), query: q };
  }
  function qparams(q) {
    var o = {};
    String(q || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      o[dec(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? '' : dec(kv.slice(i + 1));
    });
    return o;
  }
  function spendHash(sr) {
    if (sr.kind === 'all') return '#spend/all';
    if (sr.kind && sr.val) return '#spend/' + sr.kind + '/' + encodeURIComponent(sr.val) +
      ((sr.kind === 'cat' || sr.kind === 'cash' || sr.kind === 'debt') && sr.acct ? '/' + encodeURIComponent(sr.acct) : '');
    return '#spend';
  }
  function show(route, fromHistory) {
    var R = parseRoute(route), name = R.base === 'vault' ? 'spend' : R.base;
    var odCur = document.querySelector('.screen.active'); if (odCur && odCur.id === 'screen-lt' && state.ltPart === 'orders') ordLive.at = 0;   // leaving Orders: the live Vault income refetches next time
    if (name === 'ins') { name = 're'; state.reRoute = { ins: true, slug: '' }; }
    else if (name === 're') state.reRoute = { ins: false, slug: R.kind };
    if (SCREENS.indexOf(name) < 0 || name === 'lock') name = 'home';
    if (!getPc()) return lock();
    if (name === 'spend') {
      var curEl = document.querySelector('.screen.active'), cur = curEl ? curEl.id.replace(/^screen-/, '') : '';
      if (cur === 'fin') { var ovk = state.finKind === 'overview' && state.ovKey ? '/' + state.ovKey : ''; state.spendFrom = state.finKind === 'laundromat' ? 'fin/laundromat' : state.finKind === 'ledger' ? 'fin/ledger' : state.finKind === 'overview' ? 'fin/overview' + ovk : ''; if (state.finKind) state.scrollMem['fin/' + state.finKind + ovk] = window.scrollY || 0; }
      else if (cur === 'ent' && R.kind === 'debt') state.spendFrom = 'ent/' + state.entRoute.key;
      else if (cur !== 'spend' && cur !== 'doc') state.spendFrom = '';
      var okKind = R.kind === 'all' || (/^(cat|acct|income|cash|who|calc|bal|debt)$/.test(R.kind) && R.val);
      state.spendRoute = okKind ? { kind: R.kind, val: R.kind === 'all' ? '' : R.val, acct: (R.kind === 'cat' || R.kind === 'cash' || R.kind === 'debt') ? R.acct : '' }
        : { kind: '', val: '', acct: '' };
    }
    if (name === 'ent') {
      var entKey = ENTS[R.kind] ? R.kind : 'kiwit', entSub = ENT_SUBS.test(R.val) ? R.val : '';
      state.entRoute = { key: entKey, kind: entSub, val: entSub ? R.acct : '', tab: !entSub && R.val === 'docs' ? 'docs' : '' };
    }
    if (name === 'fin') { state.finKind = (R.kind === 'ledger' || R.kind === 'overview' || R.kind === 'laundromat') ? R.kind : ''; state.ovKey = state.finKind === 'overview' && OV_HEADS[R.val] ? R.val : ''; }
    if (name === 'insn') state.insSlug = R.kind || '';
    if (name === 'lt' && R.kind === 'orders' && R.query) {      // #lt/orders?tab=summary&week=yyyy-mm-dd (tap-through from the Vault's live Lisa's Table income)
      var oq = qparams(R.query), ow = OL_ISO.test(oq.week || '') ? olMonday(oq.week) : '';
      if (/^(current|previous|summary)$/.test(oq.tab || '')) od.tab = oq.tab;
      if (ow) { od.sumWeek = ow; if (od.tab === 'previous') od.prevWeek = ow; else if (od.tab === 'current') od.week = ow; }
    }
    if (name === 'pt') state.ptRoute = R.kind === 'new' ? { kind: 'new', id: '' } : (R.kind === 'client' && R.val ? { kind: 'client', id: R.val } : { kind: '', id: '' });   // #pt, #pt/new, #pt/client/<id>
    if (name === 'monofold') name = 'mf';   // #monofold alias
    if (name === 'mf') {
      var mfOk = { home: 1, orders: 1, customers: 1, design: 1, pricing: 1 };
      state.mfTab = mfOk[R.kind] ? R.kind : 'home';   // #mf, #mf/home, #mf/orders, #mf/customers, #mf/design
    }
    if (name === 'pc') {
      // #pc, #pc/list, #pc/new, #pc/<id>
      if (!R.kind || R.kind === 'list') state.pcRoute = { kind: 'list', id: '' };
      else if (R.kind === 'new') state.pcRoute = { kind: 'new', id: '' };
      else state.pcRoute = { kind: 'edit', id: R.kind };
    }
    if (name === 'punch' && !(PROJ[R.kind] && PROJ[R.kind].punchUrl)) { name = 'proj'; route = 'proj/' + (PROJ[R.kind] ? R.kind : 'terravi'); }
    var logMic = name === 'mic' && R.kind === 'dailylog';       // #mic/dailylog = Dictate page for the Daily log (Voice notes)
    if (logMic) micLogSetup();
    else if (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs' || name === 'punch') projSetup(R.kind);
    if (name !== 'mic') micStop(true);
    var vk = (name === 'vmic' || name === 'vcam') ? (R.kind === 'exp' ? 'exp' : 'inc') : '';   // #vmic/<inc|exp>, #vcam/<inc|exp>
    if (name !== 'vmic') vmicStop(true);
    if (!(name === 'lt' && R.kind === 'wish')) wlMicStop(true);
    if (!(name === 'lt' && R.kind === 'notes')) lnMicStop(true);
    if (!(name === 'lt' && R.kind === 'cost')) cmMicStop(true);
    if (name !== 'pt') { ptMicStop(true); spellMicStop(true); }
    if (name !== 'mf') mfMicStop(true);
    if (name !== 'pc') pcMicStop(true);
    if (!(name === 'lt' && R.kind === 'orders')) odMicStop(true);
    if (!(name === 'lt' && (R.kind === 'macros' || R.kind === 'recipes'))) macClose(true);
    if (!(name === 'lt' && R.kind === 'menu-add')) maMicStop(true);
    if (name !== 'punch') pmicStop();
    if (name !== 'doc') { state.docPushed = false; state.docSeq++; closeDoc(); }
    activate(name);
    if (!fromHistory) {
      if (name === 'biz') state.bizSlug = R.kind;
      var h = name === 'home' ? '' : name === 'spend' ? spendHash(state.spendRoute) :
        name === 'biz' && R.kind ? '#biz/' + encodeURIComponent(R.kind) :
        name === 'doc' ? '#doc?' + R.query :
        logMic ? '#mic/dailylog' :
        vk ? '#' + name + '/' + vk :
        (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs' || name === 'punch') ? '#' + name + '/' + state.projSlug :
        name === 'ent' ? entHash(state.entRoute) :
        name === 'fin' ? '#fin' + (state.finKind ? '/' + state.finKind + (state.ovKey ? '/' + state.ovKey : '') : '') :
        name === 'insn' ? '#insn' + (state.insSlug ? '/' + encodeURIComponent(state.insSlug) : '') :
        name === 'lt' ? '#lt' + (R.kind ? '/' + encodeURIComponent(R.kind) : '') :
        name === 'pt' ? '#pt' + (state.ptRoute.kind ? '/' + encodeURIComponent(state.ptRoute.kind) + (state.ptRoute.id ? '/' + encodeURIComponent(state.ptRoute.id) : '') : '') :
        name === 'mf' ? (state.mfTab && state.mfTab !== 'home' ? '#mf/' + state.mfTab : '#mf') :
        name === 'pc' ? (state.pcRoute && state.pcRoute.kind === 'new' ? '#pc/new' : state.pcRoute && state.pcRoute.kind === 'edit' && state.pcRoute.id ? '#pc/' + encodeURIComponent(state.pcRoute.id) : '#pc') :
        name === 're' ? (state.reRoute.ins ? '#ins' : '#re' + (state.reRoute.slug ? '/' + encodeURIComponent(state.reRoute.slug) : '')) : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'track') loadTrack();
    if (name === 'spend') loadSpend(false);
    if (name === 'ent') loadEnt(false);
    if (name === 'biz') { state.bizSlug = R.kind; loadBiz(); }
    if (name === 're') loadRe();
    if (name === 'proj') renderProj();
    if (name === 'notes') openNotes();
    if (name === 'mic') openMic();
    if (name === 'vmic') openVmic(vk);
    if (name === 'vcam') openVcam(vk);
    if (name === 'docs') openDocs();
    if (name === 'punch') openPunch();
    if (name === 'fin') loadFin(false);
    if (name === 'insn') loadInsn(false);
    if (name === 'lt') { state.ltPart = LT_PARTS[R.kind] ? R.kind : ''; loadLt(); }
    if (name === 'trust') loadTrust(false);
    if (name === 'pt') ptOpen();
    if (name === 'mf') mfOpen();
    if (name === 'pc') pcOpen();
    if (name === 'doc') { state.docKey = String(route || '').replace(/^#/, ''); openDocScreen(qparams(R.query)); }
    else restoreScroll(String(route || '').replace(/^#/, '') || 'home');
  }
  function restoreScroll(key) {
    var y = state.scrollMem[key];
    if (y == null) return;
    delete state.scrollMem[key];
    setTimeout(function () { window.scrollTo(0, y); }, 60);
  }
  window.addEventListener('popstate', function () { show(location.hash.slice(1) || 'home', true); });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (el) { e.preventDefault(); e.stopPropagation(); show(el.getAttribute('data-go')); return; }
    // Google Drive / Docs links open in the in-app viewer so "Back" returns to this screen.
    var a = e.target.closest('a[href]');
    if (a && !a.hasAttribute('data-external') && toEmbed(a.href)) {
      e.preventDefault(); e.stopPropagation();
      openDoc(a.href, a.getAttribute('data-title') || docTitleFrom(a));
    }
  });

  /* ---------------- In-app document viewer ---------------- */
  // Returns an embeddable preview URL for Google Drive / Docs links, or '' for anything else.
  function toEmbed(url) {
    var u = String(url || ''), m;
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(u)) return '';
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    if ((m = u.match(/drive\.google\.com\/(?:drive\/)?(?:u\/\d+\/)?folders\/([\w-]+)/))) return 'https://drive.google.com/embeddedfolderview?id=' + m[1] + '#list';
    if ((m = u.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    if ((m = u.match(/docs\.google\.com\/forms\/d\/(e\/)?([\w-]+)/))) return 'https://docs.google.com/forms/d/' + (m[1] || '') + m[2] + '/viewform?embedded=true';
    if ((m = u.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/))) {
      // Office files stored in Drive (rtpof=true) preview best through the Drive file viewer.
      if (/[?&]rtpof=true/.test(u)) return 'https://drive.google.com/file/d/' + m[2] + '/preview';
      return 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/preview';
    }
    return '';
  }
  function docTitleFrom(a) {
    var c = a.cloneNode(true);
    Array.prototype.forEach.call(c.querySelectorAll('.ft, .sub'), function (x) { x.remove(); });
    return (c.textContent || '').replace(/\s+/g, ' ').replace(/[\u203a\u2197]\s*$/, '').trim() || 'Document';
  }
  function openDoc(url, title) {
    var from = location.hash.slice(1) || 'home';
    state.scrollMem[from] = $('screen-doc').classList.contains('active') ? $('doc-view').scrollTop : (window.scrollY || 0);
    state.docPushed = true;
    show('doc?u=' + encodeURIComponent(url) + '&t=' + encodeURIComponent(title || '') + '&from=' + encodeURIComponent(from));
  }
  // Drive file/folder id from any Google link.
  function driveRef(url) {
    var u = String(url || ''), m;
    if ((m = u.match(/\/folders\/([\w-]+)/))) return { id: m[1], folder: true };
    if ((m = u.match(/\/d\/(?:e\/)?([\w-]+)/)) || (m = u.match(/[?&]id=([\w-]+)/))) return { id: m[1], folder: false };
    return null;
  }
  // Pinch-zoom is enabled app-wide via the viewport meta in index.html (no per-screen toggling).
  function openDocScreen(p) {
    var url = p.u || '', ref = driveRef(url), seq = ++state.docSeq;
    state.docFrom = p.from || 'home';
    $('doc-title').textContent = p.t || 'Document';
    $('doc-open').href = url || '#';
    closeDoc(true);
    if (!ref || state.proxyOff) return iframeFallback(url);
    var cached = ref.folder && state.folderCache[ref.id];
    if (cached) return renderFolder(cached);
    docMessage('<div class="spinner"></div><div>Loading…</div>');
    apiRaw(ref.folder ? 'folder' : 'file', { id: ref.id }).then(function (j) {
      if (seq !== state.docSeq) return;
      if (j.error === 'bad_action') { state.proxyOff = true; return iframeFallback(url); }   // API not deployed yet
      if (j.error) return docError(j);
      if (ref.folder) { state.folderCache[ref.id] = j.data; return renderFolder(j.data); }
      renderFile(j.data, seq);
    }, function (err) {
      if (seq !== state.docSeq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      docMessage(esc(friendly(err)) + '<div class="retry"><button class="navbtn" id="doc-retry">Try again</button></div>' + openBtn());
      var b = $('doc-retry'); if (b) b.addEventListener('click', function () { openDocScreen(p); });
    });
  }
  function openBtn() {
    return '<div class="retry"><a class="navbtn doc-open-inline" target="_blank" rel="noopener" data-external href="' + esc($('doc-open').href) + '">Open in Drive &#8599;</a></div>';
  }
  function docMessage(html) {
    $('doc-view').innerHTML = '<div class="doc-msg">' + html + '</div>';
  }
  function docError(j) {
    var d = j.data || {}, m;
    if (j.error === 'too_big') m = 'This file is too large to preview in the app' + (d.size ? ' (' + (d.size / 1048576).toFixed(1) + ' MB)' : '') + '.';
    else if (j.error === 'unsupported') m = j.message || 'This file type can\u2019t be previewed in the app.';
    else if (j.error === 'forbidden') m = 'This file isn\u2019t in the Second Brain, so the app won\u2019t show it.';
    else if (j.error === 'not_found') m = 'File not found (it may have been moved or deleted).';
    else m = j.message || ('Couldn\u2019t load this file (' + j.error + ').');
    docMessage(esc(m) + openBtn());
  }
  function iframeFallback(url) {
    var src = toEmbed(url), f = $('doc-frame');
    $('doc-view').innerHTML = '';
    $('doc-view').hidden = true;
    if (!src) { f.hidden = true; $('doc-hint').hidden = false; return; }
    var nf = f.cloneNode(false);            // fresh iframe so its first load never adds app history
    nf.setAttribute('src', src);
    nf.hidden = false;
    f.parentNode.replaceChild(nf, f);
    clearTimeout(state.docTimer);
    state.docTimer = setTimeout(function () { $('doc-hint').hidden = false; }, 6000);
  }
  function fileKind(mime) {
    if (mime === 'application/vnd.google-apps.folder') return 'DIR';
    if (/google-apps\.document/.test(mime)) return 'DOC';
    if (/google-apps\.spreadsheet/.test(mime)) return 'XLS';
    if (/google-apps\.presentation/.test(mime)) return 'PPT';
    return fileIcon(mime || '');
  }
  function renderFolder(d) {
    var h = '<div class="folderview"><div class="foot">' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + '</div>';
    if (!d.items.length) h += '<div class="doc-msg">This folder is empty.</div>';
    h += '<ul class="doclist folderlist">' + d.items.map(function (x) {
      var href = x.folder ? 'https://drive.google.com/drive/folders/' + x.id : 'https://drive.google.com/file/d/' + x.id + '/view';
      return '<li class="' + (x.folder ? 'isdir' : '') + '"><a href="' + esc(href) + '" data-title="' + esc(x.name) + '"><span class="ft">' +
        fileKind(x.mime) + '</span>' + esc(x.name) + (x.folder ? ' <span class="chev">&rsaquo;</span>' : '') + '</a></li>';
    }).join('') + '</ul></div>';
    $('doc-view').innerHTML = h;
    var y = state.scrollMem[state.docKey];
    if (y != null) { delete state.scrollMem[state.docKey]; $('doc-view').scrollTop = y; }
  }
  function b64bytes(b64) {
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function renderFile(d, seq) {
    var mime = d.mime || '';
    if (mime === 'application/pdf') return renderPdf(b64bytes(d.b64), seq);
    if (mime.indexOf('image/') === 0) {
      $('doc-view').innerHTML = '<div class="imgview"><img alt="" src="data:' + esc(mime) + ';base64,' + d.b64 + '"></div>';
      return;
    }
    if (mime.indexOf('text/html') === 0) {
      var fr = document.createElement('iframe');
      fr.className = 'htmlview'; fr.setAttribute('sandbox', '');
      fr.srcdoc = new TextDecoder('utf-8').decode(b64bytes(d.b64));
      $('doc-view').innerHTML = ''; $('doc-view').appendChild(fr);
      return;
    }
    if (mime.indexOf('text/') === 0) {
      $('doc-view').innerHTML = '<pre class="textview">' + esc(new TextDecoder('utf-8').decode(b64bytes(d.b64))) + '</pre>';
      return;
    }
    docError({ error: 'unsupported' });
  }

  // PDF.js (UMD build) loaded on first use.
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var pdfjsReady = null;
  function loadPdfJs() {
    if (pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = PDFJS + 'pdf.min.js';
      sc.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
      sc.onerror = function () { pdfjsReady = null; rej(new Error('Couldn\u2019t load the PDF viewer. Check your connection.')); };
      document.head.appendChild(sc);
    });
    return pdfjsReady;
  }
  function renderPdf(bytes, seq) {
    docMessage('<div class="spinner"></div><div>Opening PDF…</div>');
    loadPdfJs().then(function (lib) { return lib.getDocument({ data: bytes }).promise; }).then(function (pdf) {
      if (seq !== state.docSeq) { pdf.destroy(); return; }
      state.pdf = pdf;
      var view = $('doc-view');
      view.innerHTML = '<div class="pdfview"><div class="foot pdfmeta">' + pdf.numPages + ' page' + (pdf.numPages === 1 ? '' : 's') +
        ' · pinch to zoom</div></div>';
      var wrap = view.firstChild, pages = [];
      return pdf.getPage(1).then(function (p1) {
        var vp1 = p1.getViewport({ scale: 1 });
        for (var i = 1; i <= pdf.numPages; i++) {
          var ph = document.createElement('div');
          ph.className = 'pdfpage'; ph.setAttribute('data-page', i);
          ph.style.aspectRatio = vp1.width + ' / ' + vp1.height;
          wrap.appendChild(ph); pages.push(ph);
        }
        // Render pages near the viewport (keeps memory low on long PDFs).
        var queue = Promise.resolve();
        var io = new IntersectionObserver(function (ents) {
          ents.forEach(function (en) {
            if (!en.isIntersecting || en.target.getAttribute('data-done')) return;
            en.target.setAttribute('data-done', '1');
            io.unobserve(en.target);
            queue = queue.then(function () { return renderPdfPage(pdf, en.target, seq); });
          });
        }, { root: view, rootMargin: '1500px 0px' });
        state.pdfObserver = io;
        pages.forEach(function (ph) { io.observe(ph); });
      });
    }).catch(function (err) {
      if (seq !== state.docSeq) return;
      docMessage(esc((err && err.message) || 'Couldn\u2019t open this PDF.') + openBtn());
    });
  }
  function renderPdfPage(pdf, ph, seq) {
    if (seq !== state.docSeq) return;
    var n = Number(ph.getAttribute('data-page'));
    return pdf.getPage(n).then(function (page) {
      if (seq !== state.docSeq) return;
      var vp1 = page.getViewport({ scale: 1 });
      ph.style.aspectRatio = vp1.width + ' / ' + vp1.height;
      // Render ~2x device width so pinch-zoom stays sharp, capped for iOS canvas limits.
      var target = Math.min(2200, Math.max(900, ph.clientWidth * Math.min(window.devicePixelRatio || 1, 2) * 1.5));
      var vp = page.getViewport({ scale: target / vp1.width });
      var c = state.pdfCanvas || (state.pdfCanvas = document.createElement('canvas'));
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        return new Promise(function (res) {
          c.toBlob(function (blob) {
            if (seq === state.docSeq && blob) {
              var u = URL.createObjectURL(blob);
              state.docUrls.push(u);
              var img = new Image(); img.alt = 'Page ' + n; img.src = u;
              ph.appendChild(img); ph.classList.add('done');
            }
            page.cleanup();
            res();
          }, 'image/jpeg', 0.86);
        });
      });
    });
  }
  function closeDoc(keepZoom) {
    clearTimeout(state.docTimer);
    var f = $('doc-frame');
    if (f && f.getAttribute('src')) f.removeAttribute('src');
    if (f) f.hidden = true;
    if ($('doc-hint')) $('doc-hint').hidden = true;
    if ($('doc-view')) { $('doc-view').hidden = false; $('doc-view').innerHTML = ''; $('doc-view').scrollTop = 0; }
    if (state.pdfObserver) { state.pdfObserver.disconnect(); state.pdfObserver = null; }
    if (state.pdf) { try { state.pdf.destroy(); } catch (e) {} state.pdf = null; }
    (state.docUrls || []).forEach(function (u) { URL.revokeObjectURL(u); });
    state.docUrls = [];
  }
  // Back replaces the viewer's history entry with the originating screen instead of history.back():
  // Google's viewers can add their own entries inside the iframe, which would make history.back() stall.
  $('doc-back').addEventListener('click', function () {
    var from = state.docFrom || 'home';
    closeDoc();
    history.replaceState({ screen: parseRoute(from).base }, '', from === 'home' ? location.pathname + location.search : '#' + from);
    show(from, true);
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------- Passcode screen ---------------- */
  var entry = '', checking = false;
  function paintDots() {
    var dots = $('dots').children;
    for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i < entry.length);
  }
  function lockMsg(t, isErr) { var m = $('lock-msg'); m.textContent = t || '\u00a0'; m.classList.toggle('err', !!isErr); }
  function lock(msg) {
    entry = ''; paintDots(); lockMsg(msg || '', !!msg);
    state.links = null;
    activate('lock');
  }
  function press(k) {
    if (checking) return;
    if (k === 'clear') entry = '';
    else if (k === 'back') entry = entry.slice(0, -1);
    else if (entry.length < 6) entry += k;
    paintDots();
    if (entry.length === 6) submit();
  }
  function submit() {
    checking = true; lockMsg('Checking…');
    var tryPc = entry;
    api('ping', 0, tryPc).then(function () {
      setPc(tryPc); checking = false; lockMsg('');
      var target = location.hash.slice(1);
      show(SCREENS.indexOf(parseRoute(target).base) > 1 ? target : 'home', true);
    }, function (err) {
      checking = false; entry = ''; paintDots();
      if (err instanceof AuthError) {
        lockMsg('Wrong passcode. Try again.', true);
        var d = $('dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
      } else lockMsg(friendly(err), true);
    });
  }
  $('keypad').addEventListener('click', function (e) {
    var b = e.target.closest('[data-k]');
    if (b) press(b.getAttribute('data-k'));
  });
  document.addEventListener('keydown', function (e) {
    if (!$('screen-lock').classList.contains('active')) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Escape') press('clear');
  });

  /* ---------------- Links (L&S projects; folder URLs for the Home-level screens) ---------------- */
  function loadLinks() {
    if (state.links) return renderLinks();
    $('projects-list').innerHTML = '<div class="loading" style="grid-column:1/-1">Loading…</div>';
    api('links').then(function (d) { state.links = d; renderLinks(); }, onFail(['projects-list'], loadLinks));
  }
  // Google files open in the in-app viewer (no new tab); other links keep opening externally.
  function extAttr(url) { return toEmbed(url) ? '' : ' target="_blank" rel="noopener" data-external'; }
  function tile(item, sub) {
    if (!item.url) return '<div class="tile small disabled">' + esc(item.name) + '<span class="sub">coming soon</span></div>';
    return '<a class="tile small"' + extAttr(item.url) + ' href="' + esc(item.url) + '" data-title="' + esc(item.name) + '">' + esc(item.name) +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</a>';
  }
  // Folder URLs of the Second Brain areas (`links.lifeAreas` from the server), kept for the "Open ... folder" links on the
  // Home-level screens (Finances, Insurance, Lisa's Table, Trust & Estate, Business, Real Estate). The Life areas screen itself is gone.
  function applyAreaUrls(d) {
    (d.lifeAreas || []).forEach(function (a) {
      if (/^real estate$/i.test(a.name)) state.reFolderUrl = a.url;
      else if (/^lisa.s table$/i.test(a.name)) state.ltFolderUrl = a.url;
      else if (/^insurance$/i.test(a.name)) state.insFolderUrl = a.url;
      else if (/^financial$/i.test(a.name)) state.finFolderUrl = a.url;
      else if (/^business$/i.test(a.name)) state.bizFolderUrl = a.url;
      else if (/^trust\s*(&|and)\s*estate$/i.test(a.name)) state.trustFolderUrl = a.url;
    });
  }
  function ensureLinks(done, fail) {
    if (state.links) return done();
    api('links').then(function (d) { state.links = d; applyAreaUrls(d); done(); }, fail || function () { done(); });
  }
  function renderLinks() {
    var d = state.links;
    var plist = d.projects.slice();
    Object.keys(PROJ).forEach(function (k) {       // projects set up in PROJ show even before the server's project list knows them
      if (!plist.some(function (p) { return projSlugOf(p.name) === k; })) plist.push({ name: PROJ[k].name, url: PROJ[k].docUrl, kind: 'doc' });
    });
    var pcTile = '<button class="tile small pc-entry" data-go="pc">Plan Checks<span class="sub">Mic checklist \u00b7 fullscreen plan \u00b7 pins &amp; notes</span></button>';
    $('projects-list').innerHTML = pcTile + plist.map(function (p) {
      var slug = projSlugOf(p.name);
      if (slug) {
        (state.projDocUrls = state.projDocUrls || {})[slug] = p.url;
        return '<button class="tile small" data-go="proj/' + slug + '">' + esc(p.name) + '<span class="sub">Notes \u00b7 Docs \u00b7 Mic</span></button>';
      }
      return tile(p, p.kind === 'doc' ? 'Running notes' : p.kind === 'folder' ? 'Drive folder' : '');
    }).join('');
    applyAreaUrls(d);
  }

  /* ---------------- Daily log ---------------- */
  var MACROS = [
    { key: 'calories', name: 'Calories', unit: 'kcal', mode: 'range' },
    { key: 'protein',  name: 'Protein',  unit: 'g',    mode: 'floor' },
    { key: 'carbs',    name: 'Carbohydrates', short: 'Carbs', unit: 'g', mode: 'range' },
    { key: 'fat',      name: 'Fat',      unit: 'g',    mode: 'range' },
    { key: 'water',    name: 'Water',    unit: 'oz',   mode: 'floor' }
  ];

  // range: aim to land near target (±10% green, ±20% amber). floor: hit at least target.
  function grade(val, target, mode) {
    if (val === null || val === undefined || !target) return '';
    var r = val / target;
    if (mode === 'floor') return r >= 0.9 ? 'ok' : r >= 0.75 ? 'warn' : 'bad';
    var dev = Math.abs(1 - r);
    return dev <= 0.10 ? 'ok' : dev <= 0.20 ? 'warn' : 'bad';
  }
  function barHtml(val, target, mode) {
    if (val === null || val === undefined) return '<div class="bar"></div>';
    var pct = Math.max(0, Math.min(100, (val / target) * 100));
    return '<div class="bar"><i class="' + grade(val, target, mode) + '" style="width:' + pct.toFixed(0) + '%"></i></div>';
  }

  function loadLog() {
    var seq = ++state.logSeq;
    $('log-body').innerHTML = '<div class="loading">Loading…</div>';
    $('log-range').textContent = '…';
    if (!state.logData) $('log-top').innerHTML = '';
    api('log', state.weekOffset).then(function (d) { if (seq === state.logSeq) renderLog(d); },
      function (err) { if (seq === state.logSeq) { $('log-range').textContent = ''; $('log-top').innerHTML = ''; state.logData = null; onFail(['log-body'], loadLog)(err); } });
  }

  // Previous screen — still used when the API has no `ext` (not redeployed yet) or `ext` fails.
  function renderLogLegacy(d) {
    $('log-top').innerHTML = ''; state.logData = null;
    var T = d.targets;
    $('log-range').textContent = d.rangeLabel;

    var h = '<div class="card"><h3>Daily targets</h3><div class="targets">' +
      MACROS.map(function (m) {
        return '<div><b>' + fmt(T[m.key]) + '</b>' + m.unit + ' ' + (m.key === 'carbs' ? 'Carbohydrates' : m.name) + '</div>';
      }).join('') + '</div></div>';

    h += '<div class="card">';
    h += '<div class="macro-head"><span style="text-align:left">Day</span>' +
      MACROS.map(function (m) { return '<span>' + (m.short || m.name) + '</span>'; }).join('') + '</div>';

    d.days.forEach(function (day) {
      h += '<div class="day' + (day.isToday ? ' today' : '') + (day.logged ? '' : ' empty') + '">';
      var parts = day.label.split(' ');
      h += '<div class="dlabel">' + esc(parts[0]) + '<small>' + esc(parts[1] || '') + '</small></div>';
      MACROS.forEach(function (m) {
        var v = day[m.key];
        h += '<div class="cell">' + fmt(v) + barHtml(v, T[m.key], m.mode) + '</div>';
      });
      if (day.logged) h += '<div></div><div class="wo">' + (day.workout ? '&#127947; ' + esc(day.workout) : 'Workout: —') + '</div>';
      h += '</div>';
    });
    h += '</div>';

    h += '<div class="card"><h3>Week summary</h3>';
    h += '<div class="macro-head"><span></span>' + MACROS.map(function (m) { return '<span>' + (m.short || m.name) + '</span>'; }).join('') + '</div>';
    h += '<div class="sumrow"><div class="lbl">Total</div>' +
      MACROS.map(function (m) { return '<div class="cell">' + fmt(d.total[m.key]) + '</div>'; }).join('') + '</div>';
    h += '<div class="sumrow"><div class="lbl">Daily avg</div>' +
      MACROS.map(function (m) {
        var v = d.avg[m.key], g = grade(v, T[m.key], m.mode);
        return '<div class="cell ' + (g ? 't-' + g : '') + '">' + fmt(v) + barHtml(v, T[m.key], m.mode) + '</div>';
      }).join('') + '</div>';
    h += '<div class="sumrow"><div class="lbl">Target</div>' +
      MACROS.map(function (m) { return '<div class="cell" style="font-weight:400;color:#a8a8a8">' + fmt(T[m.key]) + '</div>'; }).join('') + '</div>';
    h += '<div class="foot">' + d.loggedDays + ' of 7 days logged · ' + d.workoutDays + ' workout day' + (d.workoutDays === 1 ? '' : 's') +
      ' · average is over logged days · units: kcal, g, g, g, oz</div>';
    if (d.missingColumns && d.missingColumns.length) h += '<div class="foot">Columns not found: ' + esc(d.missingColumns.join(', ')) + '</div>';
    h += '</div>';

    $('log-body').innerHTML = h;
  }

  /* ---- Daily log v2 (fitness, orange): Today bars, streaks, body, week summary, collapsible past days.
   * Needs `ext` from the extended `log` action (Api.gs v21); without it renderLogLegacy() draws the old screen. ---- */
  var FIT_TARGETS = { calories: 2200, protein: 170, carbs: 220, fat: 70, water: 100, workoutsPerWeek: 4 };   // fallback config; the API's targets win
  var FIT_ROWS = [
    { key: 'calories', name: 'Calories', unit: 'kcal', rule: 'cap' },
    { key: 'protein',  name: 'Protein',  unit: 'g',    rule: 'floor' },
    { key: 'carbs',    name: 'Carbs',    unit: 'g',    rule: 'band' },
    { key: 'fat',      name: 'Fat',      unit: 'g',    rule: 'band' },
    { key: 'water',    name: 'Water',    unit: 'oz',   rule: 'floor' }
  ];
  // Colors: ok = green (on target), warn = amber (close), bad = red (over), prog = orange accent (still short / in progress).
  //  cap   (calories): over target -> red; 90-100% green; 75-90% amber; below that -> in progress. Never red for being under.
  //  band  (carbs, fat): over +15% red; +5..+15% or 75-90% amber; 90-105% green; below 75% in progress.
  //  floor (protein, water): reaching the target is green; 85-100% amber; below -> in progress.
  function fitStatus(rule, val, target) {
    if (val === null || val === undefined || !target) return '';
    var r = val / target;
    if (rule === 'cap') return r > 1 ? 'bad' : r >= 0.9 ? 'ok' : r >= 0.75 ? 'warn' : 'prog';
    if (rule === 'band') return r > 1.15 ? 'bad' : r > 1.05 ? 'warn' : r >= 0.9 ? 'ok' : r >= 0.75 ? 'warn' : 'prog';
    return r >= 1 ? 'ok' : r >= 0.85 ? 'warn' : 'prog';
  }
  function fitBar(val, target, st) {
    var pct = (val === null || val === undefined || !target) ? 0 : Math.max(0, Math.min(100, val / target * 100));
    return '<div class="fitbar"><i class="s-' + (st || 'none') + '" style="width:' + pct.toFixed(0) + '%"></i></div>';
  }
  function fitNote(row, val, target, st) {
    if (val === null || val === undefined) return 'not logged';
    var diff = Math.round(target - val);
    if (row.rule === 'floor') return diff <= 0 ? 'target met' : fmt(diff) + ' to go';
    if (diff < 0) return fmt(-diff) + ' over';
    return st === 'ok' ? 'on target' : fmt(diff) + ' left';
  }
  function fitTargets(d) { var t = {}, k; for (k in FIT_TARGETS) t[k] = FIT_TARGETS[k]; if (d.targets) for (k in d.targets) if (d.targets[k] != null) t[k] = d.targets[k]; if (d.ext && d.ext.targets) for (k in d.ext.targets) if (d.ext.targets[k] != null) t[k] = d.ext.targets[k]; return t; }
  function fitRow(row, val, target, extra) {
    var st = fitStatus(row.rule, val, target);
    return '<div class="fitrow' + (extra ? ' hasbtn' : '') + '" data-key="' + row.key + '">' +
      '<div class="fl">' + row.name + '</div>' +
      '<div class="fv t-' + (st || 'none') + '"><b>' + fmt(val) + '</b> / ' + fmt(target) + ' ' + row.unit + '</div>' +
      '<div class="fn">' + fitNote(row, val, target, st) + '</div>' + (extra || '') +
      fitBar(val, target, st) + '</div>';
  }

  function renderLogV2(d) {
    state.logData = d;
    renderLogTop(d);
    var T = fitTargets(d), ext = d.ext, h = '';
    var isNow = !d.weekOffset;

    // Week summary: averages (over logged days) vs targets + workout count vs weekly target
    var wt = T.workoutsPerWeek, wc = d.workoutDays || 0;
    var wst = wc >= wt ? 'ok' : wc >= wt - 1 ? 'warn' : 'prog';
    h += '<div class="card fitcard"><h3>' + (isNow ? 'This week' : 'Week') + ' summary</h3>';
    ['calories', 'protein', 'water'].forEach(function (k) {
      var row = FIT_ROWS.filter(function (r) { return r.key === k; })[0];
      var v = d.avg ? d.avg[k] : null, st = fitStatus(row.rule, v, T[k]);
      h += '<div class="fitrow"><div class="fl">' + row.name + ' avg</div>' +
        '<div class="fv t-' + (st || 'none') + '"><b>' + fmt(v) + '</b> / ' + fmt(T[k]) + ' ' + row.unit + '</div>' +
        '<div class="fn">' + (v === null || v === undefined ? 'not logged' : fitNote(row, v, T[k], st).replace('to go', 'short')) + '</div>' + fitBar(v, T[k], st) + '</div>';
    });
    h += '<div class="fitrow"><div class="fl">Workouts</div><div class="fv t-' + wst + '"><b>' + wc + '</b> / ' + wt + ' this week</div>' +
      '<div class="fn">' + (wc >= wt ? 'target met' : (wt - wc) + ' to go') + '</div>' + fitBar(wc, wt, wst) + '</div>';
    h += '<div class="foot">' + d.loggedDays + ' of 7 days logged · averages are over logged days</div></div>';

    // Past days: collapsible rows (date + calories), expand for macros / water / workout / body
    var hist = {};
    (ext.history || []).forEach(function (x) { hist[x.date] = x; });
    var todayKey = ext.today && ext.today.date;
    var past = d.days.filter(function (x) { return (!todayKey || x.date < todayKey); }).slice().reverse();
    h += '<div class="card fitcard"><h3>Past days</h3>';
    if (!past.length) h += '<div class="foot">No past days in this week yet.</div>';
    past.forEach(function (day) {
      var x = hist[day.date] || {}, open = !!state.logOpen[day.date];
      var cal = day.calories, st = fitStatus('cap', cal, T.calories);
      var parts = day.label.split(' ');
      if (!day.logged) {
        h += '<div class="pday none"><div class="pdh"><span class="pdd"><b>' + esc(parts[0]) + '</b> ' + esc(parts[1] || '') + '</span><span class="pdc">not logged</span></div></div>';
        return;
      }
      h += '<div class="pday' + (open ? ' open' : '') + '" data-date="' + esc(day.date) + '">' +
        '<button type="button" class="pdh" aria-expanded="' + open + '"><span class="pdd"><b>' + esc(parts[0]) + '</b> ' + esc(parts[1] || '') + '</span>' +
        '<span class="pdc t-' + (st || 'none') + '">' + (cal === null || cal === undefined ? '—' : fmt(cal) + ' kcal') + '</span><span class="pdx">&#9662;</span></button>' +
        '<div class="pdb">';
      [FIT_ROWS[1], FIT_ROWS[2], FIT_ROWS[3], FIT_ROWS[4]].forEach(function (row) {
        var v = day[row.key], s2 = fitStatus(row.rule, v, T[row.key]);
        h += '<div class="pm"><span>' + row.name + '</span><b class="t-' + (s2 || 'none') + '">' + fmt(v) + '</b> <small>/ ' + fmt(T[row.key]) + ' ' + row.unit + '</small>' + fitBar(v, T[row.key], s2) + '</div>';
      });
      h += '<div class="pwo">Workout: ' + (day.workout ? esc(day.workout) : '—') + '</div>';
      var bits = [];
      if (x.weight != null) bits.push('Weight ' + fmt(x.weight, 1) + ' lb');
      if (x.sleep != null) bits.push('Sleep ' + fmt(x.sleep, 1) + ' h');
      if (x.steps != null) bits.push('Steps ' + fmt(x.steps));
      if (x.hike != null) bits.push('Hike ' + fmt(x.hike, 1) + ' mi');
      if (bits.length) h += '<div class="pwo">' + bits.join(' · ') + '</div>';
      h += '</div></div>';
    });
    h += '</div>';
    $('log-body').innerHTML = h;
  }

  // Today (progress bars + water button), streaks and body: not tied to the week shown below.
  /* ---- Daily Log: running totals (month to date / all time), weight trend, streaks ----
   * logAgg mirrors Api.gs apiLogAgg_ (keep in step). Server `ext.totals` (month + all time, whole tab) is used when present; otherwise the
   * phone computes the same numbers from ext.history (the last ~120 days) and says so. Averages are over FINISHED days with a value; sums include today. */
  function logAgg(days, today, T) {
    var logged = days.filter(function (x) { return x && x.logged; }).sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });   // oldest first
    var isNum = function (v) { return typeof v === 'number' && isFinite(v); }, r1 = function (v) { return Math.round(v * 10) / 10; };
    function mean(f) { var s = 0, c = 0; logged.forEach(function (x) { if (x.date < today && isNum(x[f]) && x[f] > 0) { s += x[f]; c++; } }); return { avg: c ? r1(s / c) : null, days: c }; }
    function hits(f, ok) { var c = 0; logged.forEach(function (x) { if (x.date < today && isNum(x[f]) && x[f] > 0 && ok(x[f])) c++; }); return c; }
    function sumOf(f) { var s = 0, c = 0; logged.forEach(function (x) { if (isNum(x[f]) && x[f] > 0) { s += x[f]; c++; } }); return { total: r1(s), days: c }; }
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
    var wp = logged.filter(function (x) { return isNum(x.weight) && x.weight > 0; }), weight = null;
    if (wp.length) {
      var lo = wp[0]; wp.forEach(function (x) { if (x.weight < lo.weight) lo = x; });
      weight = { first: wp[0].weight, firstDate: wp[0].date, latest: wp[wp.length - 1].weight, latestDate: wp[wp.length - 1].date, min: lo.weight, minDate: lo.date,
        change: r1(wp[wp.length - 1].weight - wp[0].weight), n: wp.length };
    }
    return { logged: logged.length, since: logged.length ? logged[0].date : '', until: logged.length ? logged[logged.length - 1].date : '',
      calories: cal, protein: pro, carbs: car, fat: fat, water: wat, sleep: slp, workouts: workouts, minutes: Math.round(minutes), hike: hike, steps: steps, weight: weight };
  }
  function logMD(k) { return k ? (+k.slice(5, 7)) + '/' + (+k.slice(8, 10)) : ''; }
  function logTotals(d, which) {
    var ext = d.ext, tot = ext.totals, today = (ext.today && ext.today.date) || '', T = fitTargets(d), hist = ext.history || [];
    var FUT = '9999-12-31';   // passed as "today" so today counts as a finished day (averages include it)
    if (which === 'today') return { a: logAgg(hist.filter(function (x) { return x.date === today; }), FUT, T), server: false, since: today };
    if (which === 'week') {   // Monday..Sunday, same convention as the weekly summary (Code.gs getDailyLog)
      var td = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), 12), dow = (td.getDay() + 6) % 7;
      var mon = new Date(td.getFullYear(), td.getMonth(), td.getDate() - dow, 12);
      var ws = mon.getFullYear() + '-' + ('0' + (mon.getMonth() + 1)).slice(-2) + '-' + ('0' + mon.getDate()).slice(-2);
      return { a: logAgg(hist.filter(function (x) { return x.date >= ws && x.date <= today; }), FUT, T), server: false, since: ws, dayN: dow + 1 };
    }
    if (which === 'month') {
      var ms = today.slice(0, 8) + '01';
      if (tot && tot.month) return { a: tot.month, server: true, since: tot.monthStart || ms };
      return { a: logAgg(hist.filter(function (x) { return x.date >= ms; }), today, T), server: false, since: ms };
    }
    if (tot && tot.all) return { a: tot.all, server: true, since: tot.all.since };
    var a = logAgg(hist, today, T);
    return { a: a, server: false, since: a.since, partial: true };
  }
  function avgRow(d, key, a, T, plain) {
    var row = FIT_ROWS.filter(function (r) { return r.key === key; })[0], v = a[key] ? a[key].avg : null, st = fitStatus(row.rule, v, T[key]);
    return '<div class="fitrow"><div class="fl">' + row.name + (plain ? '' : ' avg') + '</div><div class="fv t-' + (st || 'none') + '"><b>' + fmt(v) + '</b> / ' + fmt(T[key]) + ' ' + row.unit + '</div>' +
      '<div class="fn">' + (v === null || v === undefined ? 'not logged' : fitNote(row, v, T[key], st).replace('to go', 'short')) + '</div>' + fitBar(v, T[key], st) + '</div>';
  }
  var LOG_TOT_TABS = [['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['all', 'All time']];
  function totalsCardHtml(d) {
    var T = fitTargets(d), ext = d.ext, cols = ext.columns || {}, which = LOG_TOT_TABS.some(function (x) { return x[0] === state.logTot; }) ? state.logTot : 'month', W = logTotals(d, which), a = W.a, h = '';
    var one = which === 'today';
    h += '<div class="card fitcard"><h3>Running totals</h3><div class="seg four">' + LOG_TOT_TABS.map(function (x) {
      return '<button type="button" data-tot="' + x[0] + '" class="' + (which === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (!a.logged) return h + '<div class="foot">' + ({ today: 'Nothing logged yet today.', week: 'Nothing logged yet this week.', month: 'Nothing logged yet this month.', all: 'Nothing logged yet.' })[which] + '</div></div>';
    h += avgRow(d, 'calories', a, T, one) + avgRow(d, 'protein', a, T, one) + avgRow(d, 'water', a, T, one);
    var v = function (x, dec, unit) { return x === null || x === undefined ? '\u2014' : fmt(x, dec) + (unit || ''); };
    var tiles = [];
    if (!one) tiles.push(['Days logged', a.logged]);
    tiles.push(['Carbs' + (one ? '' : ' avg'), v(a.carbs.avg, 0, ' g')], ['Fat' + (one ? '' : ' avg'), v(a.fat.avg, 0, ' g')],
      ['Workouts', a.workouts], ['Workout min', fmt(a.minutes)]);
    if (!one) tiles.push(['Min / workout', a.workouts ? fmt(Math.round(a.minutes / a.workouts)) : '\u2014']);
    tiles.push(['Hike miles', cols.hike === false || !a.hike.days ? '\u2014' : v(a.hike.total, 1, ' mi')], [one ? 'Steps' : 'Steps total', cols.steps === false || !a.steps.days ? '\u2014' : v(a.steps.total, 0)]);
    if (!one) tiles.push(['Steps / day', cols.steps === false ? '\u2014' : v(a.steps.avg, 0)]);
    tiles.push([one ? 'Sleep' : 'Sleep avg', v(a.sleep.avg, 1, ' h')]);
    if (one) tiles.push(['Weight', a.weight ? fmt(a.weight.latest, 1) + ' lb' : '\u2014']);
    else tiles.push(['Weight change', a.weight ? (a.weight.change > 0 ? '+' : '') + fmt(a.weight.change, 1) + ' lb' : '\u2014']);
    h += '<div class="btiles tot">' + tiles.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    var hit = [];
    if (!one && !(which === 'week')) {
      if (a.calories.days) hit.push('calories at/under target ' + a.calories.hit + ' of ' + a.calories.days + ' days');
      if (a.protein.days) hit.push('protein met ' + a.protein.hit + ' of ' + a.protein.days);
      if (a.water.days) hit.push('water met ' + a.water.hit + ' of ' + a.water.days);
    }
    var note;
    if (one) note = (ext.today && ext.today.label ? ext.today.label + ' \u00b7 ' : '') + 'today so far; the day is not finished.';
    else if (which === 'week') note = 'Mon ' + logMD(W.since) + ' to today \u00b7 ' + a.logged + ' of ' + W.dayN + ' day' + (W.dayN === 1 ? '' : 's') + ' logged. Averages are over logged days including today, like the weekly summary below; workouts, minutes, hike and steps are sums.';
    else {
      note = (which === 'month' ? 'Since ' + logMD(W.since) : (W.partial ? 'Last ' + (ext.history || []).length + ' logged days, since ' + logMD(W.since) : 'Since ' + logMD(W.since) + ' (first entry)')) +
        ' \u00b7 ' + a.logged + ' day' + (a.logged === 1 ? '' : 's') + ' logged. Averages are over finished days; workouts, minutes, hike and steps include today.' + (hit.length ? ' ' + hit.join(' \u00b7 ') + '.' : '');
    }
    h += '<div class="foot">' + note + '</div>';
    if (W.partial) h += '<div class="foot hint2">All-time totals cover the whole sheet once the server update is live. For now this is the recent history only.</div>';
    return h + '</div>';
  }
  function weightCardHtml(d) {
    var ext = d.ext, cols = ext.columns || {}, w = ext.weight || {}, b = ext.body || {}, A = logTotals(d, 'all').a, wa = A.weight, h = '';
    h += '<div class="card fitcard"><h3>Weight &amp; body</h3>';
    if (cols.weight) {
      if (w.latest != null) {
        var toGo = w.goal != null ? w.latest - w.goal : null, tr = '';
        if (w.goal != null && w.avg7 != null && w.prevAvg7 != null && Math.abs(w.avg7 - w.prevAvg7) >= 0.1) {
          var toward = Math.abs(w.avg7 - w.goal) < Math.abs(w.prevAvg7 - w.goal);
          tr = '<span class="trend ' + (toward ? 'toward' : 'away') + '">' + (w.avg7 > w.prevAvg7 ? '&#9650;' : '&#9660;') + ' ' + fmt(Math.abs(w.avg7 - w.prevAvg7), 1) + ' lb vs last week \u00b7 ' + (toward ? 'toward goal' : 'away from goal') + '</span>';
        } else if (w.avg7 != null && w.prevAvg7 == null) tr = '<span class="trend">trend needs a prior week of weights</span>';
        else if (w.avg7 != null) tr = '<span class="trend">steady vs last week</span>';
        h += '<div class="wline"><div><b class="wnum">' + fmt(w.latest, 1) + '</b> lb<small> ' + (w.latestDate ? 'on ' + logMD(w.latestDate) : '') + '</small></div>' +
          (toGo != null ? '<div class="wgoal">' + (toGo > 0 ? fmt(toGo, 1) + ' lb to goal' : toGo < 0 ? fmt(-toGo, 1) + ' lb past goal' : 'at goal') + ' <small>(goal ' + fmt(w.goal) + ')</small></div>' : '') + '</div>' + tr;
        if (wa && wa.n > 1) h += '<span class="trend ' + (w.goal != null ? (Math.abs(wa.latest - w.goal) < Math.abs(wa.first - w.goal) ? 'toward' : 'away') : '') + '">' + (wa.change > 0 ? '&#9650; ' : wa.change < 0 ? '&#9660; ' : '') + fmt(Math.abs(wa.change), 1) + ' lb since ' + logMD(wa.firstDate) + ' (first entry) \u00b7 lowest ' + fmt(wa.min, 1) + ' lb on ' + logMD(wa.minDate) + '</span>';
        var series = (ext.totals && ext.totals.weightSeries && ext.totals.weightSeries.length > 1) ? ext.totals.weightSeries : w.series;
        h += sparkSvg(series, w.goal);
        h += '<div class="foot">' + ((ext.totals && ext.totals.weightSeries) ? 'Trend line covers every weight on record' : 'Trend line covers the last 30 weigh-ins') + '; dashed line is the goal.</div>';
      } else h += '<div class="foot">No weight logged yet. Add today\u2019s on the Tracker.</div>';
    }
    var tiles = [];
    if (cols.sleep) tiles.push(['Sleep avg 7d', b.sleepAvg7 != null ? fmt(b.sleepAvg7, 1) + ' h' : '\u2014']);
    if (cols.steps) tiles.push(['Steps avg 7d', b.stepsAvg7 != null ? fmt(b.stepsAvg7) : '\u2014']);
    if (cols.hike) tiles.push(['Hike, 7 days', b.hikeMiles7 != null ? fmt(b.hikeMiles7, 1) + ' mi' : '\u2014']);
    if (tiles.length) h += '<div class="btiles">' + tiles.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    var miss = [];
    if (!cols.weight) miss.push('\u201CWeight (lb)\u201D');
    if (!cols.sleep) miss.push('\u201CSleep (hours)\u201D');
    if (!cols.steps) miss.push('\u201CSteps\u201D');
    if (!cols.hike) miss.push('\u201CHike miles\u201D');
    if (miss.length) h += '<div class="foot hint2">' + (!cols.steps || !cols.hike ? 'Steps and Hike miles columns are created on the first Tracker entry. ' : '') +
      ((!cols.weight || !cols.sleep) ? 'To track ' + miss.filter(function (m) { return /Weight|Sleep/.test(m); }).join(' and ') + ', add a column with that header to the Phone Log tab.' : '') + '</div>';
    return h + '</div>';
  }
  function streaksCardHtml(d) {
    var S = d.ext.streaks, T = fitTargets(d);
    if (!S) return '';
    var tiles = [
      { n: S.calories, lbl: 'Calories', sub: '\u2264 ' + fmt(T.calories) + ' kcal' },
      { n: S.water, lbl: 'Water', sub: '\u2265 ' + fmt(T.water) + ' oz' },
      { n: S.workouts, lbl: 'Workouts', sub: 'any workout' }
    ];
    return '<div class="card fitcard"><h3>Streaks \u00b7 days in a row</h3><div class="streaks">' + tiles.map(function (x) {
      var c = (x.n && x.n.current) || 0, b = (x.n && x.n.best) || 0;
      return '<div class="stk' + (c ? ' live' : '') + '"><b>' + c + '</b><span class="sl">' + x.lbl + '</span><span class="ss">' + x.sub + '</span><span class="ss">best ' + b + '</span></div>';
    }).join('') + '</div><div class="foot">Calories count finished days (today can still change); water and workouts count today once met. A day with no entry breaks a streak.</div></div>';
  }
  function renderLogTop(d) {   // Daily Log screen, top: totals, weight, streaks
    $('log-top').innerHTML = totalsCardHtml(d) + weightCardHtml(d) + streaksCardHtml(d);
  }
  $('log-top').addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-tot]') : null;
    if (!b || !state.logData || !state.logData.ext) return;
    state.logTot = b.getAttribute('data-tot'); renderLogTop(state.logData);
  });

  function sparkSvg(series, goal) {
    if (!series || series.length < 2) return '';
    var vals = series.map(function (p) { return p.v; });
    if (goal != null) vals = vals.concat([goal]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    var W = 300, H = 46, pad = 4;
    function X(i) { return pad + i * (W - 2 * pad) / (series.length - 1); }
    function Y(v) { return pad + (hi - v) * (H - 2 * pad) / (hi - lo); }
    var pts = series.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ');
    var last = series[series.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Weight trend">' +
      (goal != null ? '<line x1="0" x2="' + W + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '" class="sgoal"/>' : '') +
      '<polyline points="' + pts + '" class="sline"/><circle cx="' + X(series.length - 1).toFixed(1) + '" cy="' + Y(last.v).toFixed(1) + '" r="3.2" class="sdot"/></svg>';
  }

  /* ---- Daily Tracker: today's progress bars, one-tap water (+Undo), quick-add forms (logday / logset), today's voice notes ----
   * Needs the extended `log` action (ext) for the bars; quick-add uses ext.write.logday (meal / workout / hike / steps) and ext.write.set (weight / sleep).
   * Without them the screen degrades: progress from the old payload, forms replaced by a short note. */
  function fitCid() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function fitSay(id, text, bad) { var e = $(id); if (e) { e.textContent = text || ''; e.className = 'fitmsg' + (bad ? ' bad' : ''); } }

  function loadTrack() {
    loadVoiceNotes();
    var seq = ++state.trkSeq;
    if (state.trackData) renderTrack(state.trackData, false);
    else { $('trk-prog').innerHTML = '<div class="loading">Loading\u2026</div>'; $('trk-forms').innerHTML = ''; }
    api('log', 0).then(function (d) { if (seq === state.trkSeq) { state.trackData = d; renderTrack(d, !state.trkFormsFor || state.trkFormsFor !== formsKey(d)); } },
      function (err) { if (seq === state.trkSeq && !state.trackData) { $('trk-forms').innerHTML = ''; onFail(['trk-prog'], loadTrack)(err); } });
  }
  function formsKey(d) { var e = d.ext; return e ? JSON.stringify([e.write, e.columns]) : 'legacy'; }
  function renderTrack(d, rebuildForms) {
    renderTrackProg(d);
    if (rebuildForms) { renderTrackForms(d); state.trkFormsFor = formsKey(d); }
  }
  function trackToday(d) {   // today's numbers: ext.today, or the old payload's "today" day
    if (d.ext && d.ext.today) return d.ext.today;
    var t = null; (d.days || []).forEach(function (x) { if (x.isToday) t = x; });
    return t ? { label: t.label, calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, water: t.water, workout: t.workout || '', logged: !!t.logged } : { label: '', logged: false };
  }
  function renderTrackProg(d) {
    var ext = d.ext, T = fitTargets(d), t = trackToday(d), h = '';
    var canWater = !!(ext && ext.write && ext.write.water);
    h += '<div class="card fitcard fittoday"><h3>Today \u00b7 ' + esc(t.label || '') + '</h3>';
    FIT_ROWS.forEach(function (row) {
      var extra = (row.key === 'water' && canWater) ? '<button type="button" class="fitbtn" id="fit-water" aria-label="Add 8 ounces of water">+' + ((ext.write && ext.write.waterStepOz) || 8) + ' oz</button>' : '';
      h += fitRow(row, t[row.key], T[row.key], extra);
    });
    h += '<div class="fitmsg" id="fit-msg" role="status"></div>';
    var cols = ext && ext.columns || {}, v = function (x, dec, u) { return x === null || x === undefined ? '\u2014' : fmt(x, dec) + (u || ''); };
    var wk = t.workout ? esc(t.workout) : (t.logged ? '\u2014' : 'not yet');
    var tiles = [['Workout', wk]];
    if (ext) {
      tiles.push(['Hike', v(t.hike, 1, ' mi')], ['Steps', v(t.steps, 0)], ['Weight', v(t.weight, 1, ' lb')], ['Sleep', v(t.sleep, 1, ' h')]);
    }
    h += '<div class="btiles today">' + tiles.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    if (!ext) h += '<div class="foot hint2">Quick add and the extra progress details need the server update. Dictate a note meanwhile; it is saved to Voice notes.</div>';
    h += '</div>';
    $('trk-prog').innerHTML = h;
    var wb = $('fit-water');
    if (wb) wb.addEventListener('click', function () { addWater(((ext.write && ext.write.waterStepOz) || 8)); });
  }

  /* Log for another day: state.trkDate '' = today, else YYYY-MM-DD (server logday / logset / logadd accept `date`). */
  function trkTodayKey(d) { d = d || state.trackData; var t = d && d.ext && d.ext.today; if (t && t.date) return t.date; var n = new Date(); return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2); }
  function trkAddDays(key, n) { var p = key.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2] + n); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function trkDayLabel(key) { var p = key.split('-'), t = new Date(+p[0], +p[1] - 1, +p[2]); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][t.getMonth()] + ' ' + t.getDate(); }
  function trkPast() { var d = state.trackData; return state.trkDate && d && state.trkDate !== trkTodayKey(d) ? state.trkDate : ''; }
  function trkWhen() { var k = trkPast(); return k ? (k === trkAddDays(trkTodayKey(), -1) ? 'yesterday' : trkDayLabel(k)) : 'today'; }
  function trkWithDate(p) { var k = trkPast(); if (k) p.date = k; return p; }
  var TRK_BODY = { hike: ['Hike miles', '0.1'], steps: ['Steps', '1'], weight: ['Weight (lb)', '0.1'], sleep: ['Sleep (hours)', '0.1'] };
  function renderTrackForms(d) {
    var ext = d.ext, h = '';
    if (!ext || !ext.write) { $('trk-forms').innerHTML = ''; return; }
    var canDay = !!ext.write.logday, set = ext.write.set || [], t = ext.today || {}, cols = ext.columns || {};
    var inp = function (id, label, step, cur, attrs) {
      return '<label>' + label + '<input type="number" inputmode="decimal" step="' + step + '" min="0" ' + (attrs || '') + ' value="' + (cur == null ? '' : cur) + '" autocomplete="off"></label>';
    };
    var todayK = trkTodayKey(d), pastK = trkPast();
    var hist = {}; (ext.history || []).forEach(function (x) { hist[x.date] = x; });
    if (pastK) t = hist[pastK] || {};
    h += '<div class="card fitcard qa" id="qa-date"><h3>Log for</h3><div class="seg3 seg small" id="qa-day">' +
      '<button type="button" data-day="today" class="' + (pastK ? '' : 'on') + '">Today</button>' +
      '<button type="button" data-day="yesterday" class="' + (pastK === trkAddDays(todayK, -1) ? 'on' : '') + '">Yesterday</button>' +
      '<button type="button" data-day="pick" class="' + (pastK && pastK !== trkAddDays(todayK, -1) ? 'on' : '') + '">Other day</button></div>' +
      '<label class="qdate">Date<input type="date" id="qa-datepick" max="' + todayK + '" value="' + (pastK || todayK) + '"></label>' +
      (pastK ? '<div class="qa-banner">Saving to <b>' + esc(trkDayLabel(pastK)) + '</b>. Tap Today to go back.</div>' +
        '<div class="qa-water"><span>Water for that day</span><button type="button" class="fitbtn" data-wd="8">+8 oz</button><button type="button" class="fitbtn" data-wd="-8">\u22128 oz</button></div><div class="fitmsg" id="qa-water-msg" role="status"></div>' : '') + '</div>';
    if (canDay) {
      h += '<div class="card fitcard qa" id="qa-meal"><h3>Add a meal</h3><div class="qgrid4">' +
        [['calories', 'kcal', '1'], ['protein', 'Protein g', '1'], ['carbs', 'Carbs g', '1'], ['fat', 'Fat g', '1']].map(function (f) { return inp('', f[1], f[2], '', 'data-m="' + f[0] + '"'); }).join('') + '</div>' +
        '<div class="seg small" id="qa-mode"><button type="button" data-mode="add" class="' + (state.trkMode === 'set' ? '' : 'on') + '">Add to ' + (pastK ? 'that day' : 'today') + '</button><button type="button" data-mode="set" class="' + (state.trkMode === 'set' ? 'on' : '') + '">Set ' + (pastK ? 'that day\u2019s' : 'today\u2019s') + ' total</button></div>' +
        '<button type="button" class="fitbtn wide" id="qa-meal-go">Add meal</button><div class="fitmsg" id="qa-meal-msg" role="status"></div></div>';
      h += '<div class="card fitcard qa" id="qa-wo"><h3>Workout</h3><div class="qgrid2w"><label>Type<input type="text" id="qa-wo-type" maxlength="60" placeholder="Run, strength, walk\u2026" autocomplete="off"></label>' +
        inp('', 'Minutes', '1', '', 'id="qa-wo-min"') + '</div><button type="button" class="fitbtn wide" id="qa-wo-go">Save workout</button><div class="fitmsg" id="qa-wo-msg" role="status"></div></div>';
    } else {
      h += '<div class="card fitcard"><h3>Quick add</h3><div class="foot hint2">Meal and workout quick-add need the server update (logday). Dictate a note meanwhile.</div></div>';
    }
    var fields = [];
    ['hike', 'steps'].forEach(function (f) { if (canDay || set.indexOf(f) >= 0) fields.push(f); });
    ['weight', 'sleep'].forEach(function (f) { if (set.indexOf(f) >= 0) fields.push(f); });
    if (fields.length) {
      h += '<div class="card fitcard qa" id="qa-body"><h3>Activity &amp; body \u00b7 ' + (pastK ? esc(trkDayLabel(pastK)) : 'today') + '</h3><div class="bgrid">' + fields.map(function (f) {
        var cur = t[f];
        return '<label>' + TRK_BODY[f][0] + '<input type="number" inputmode="decimal" step="' + TRK_BODY[f][1] + '" min="0" data-f="' + f + '" data-cur="' + (cur == null ? '' : cur) + '" value="' + (cur == null ? '' : cur) + '" autocomplete="off"></label>';
      }).join('') + '</div><button type="button" class="fitbtn wide" id="qa-body-go">Save ' + (pastK ? 'that day' : 'today') + '</button><div class="fitmsg" id="qa-body-msg" role="status"></div>' +
        (canDay && (!cols.steps || !cols.hike) ? '<div class="foot hint2">The ' + (!cols.steps && !cols.hike ? 'Steps and Hike miles columns are' : !cols.steps ? 'Steps column is' : 'Hike miles column is') + ' added to the Phone Log on the first save.</div>' : '') + '</div>';
    }
    $('trk-forms').innerHTML = h;
  }
  function trkWriteErr(err, id) {
    if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return; }
    fitSay(id, 'Not saved: ' + friendly(err), true);
  }
  function trkRes(j) {
    if (j.error === 'bad_action') throw new Error('Server update pending.');
    if (j.error || !j.data) throw new Error(j.message || 'Could not save.');
    return j.data;
  }
  function loadTrackQuiet() {
    var seq = ++state.trkSeq;
    return api('log', 0).then(function (d) { if (seq === state.trkSeq) { state.trackData = d; renderTrackProg(d); } }, function () {});
  }
  function trkNum(v) { return v === '' ? null : Number(v); }
  function trkGo(btn, id, run) {
    if (state.trkBusy) return;
    state.trkBusy = true; btn.disabled = true; fitSay(id, 'Saving\u2026');
    run().catch(function (err) { trkWriteErr(err, id); }).then(function () { state.trkBusy = false; btn.disabled = false; });
  }
  function trkMeal(btn) {
    var vals = {}, any = false, bad = false;
    Array.prototype.forEach.call(document.querySelectorAll('#qa-meal input[data-m]'), function (i) {
      if (i.value === '') return;
      var n = Number(i.value); if (!isFinite(n) || n < 0) bad = true; vals[i.getAttribute('data-m')] = n; any = true;
    });
    if (bad) return fitSay('qa-meal-msg', 'Use positive numbers.', true);
    if (!any) return fitSay('qa-meal-msg', 'Enter calories and/or macros.', true);
    var mode = state.trkMode === 'set' ? 'set' : 'add', p = trkWithDate({ mode: mode, cid: fitCid() }), when = trkWhen();
    Object.keys(vals).forEach(function (k) { p[k] = vals[k]; });
    trkGo(btn, 'qa-meal-msg', function () {
      return apiRaw('logday', p).then(function (j) {
        var r = trkRes(j), w = r.written || {}, now = [];
        ['calories', 'protein', 'carbs', 'fat'].forEach(function (k) { if (w[k]) now.push(fmt(w[k].after) + (k === 'calories' ? ' kcal' : ' g ' + k)); });
        Array.prototype.forEach.call(document.querySelectorAll('#qa-meal input[data-m]'), function (i) { i.value = ''; });
        fitSay('qa-meal-msg', (mode === 'add' ? 'Added. ' : 'Set. ') + (when.charAt(0).toUpperCase() + when.slice(1)) + (mode === 'add' ? ' now ' : ' is ') + now.join(' \u00b7 '));
        var m = $('qa-meal-msg');
        if (m && !r.duplicate) {
          var u = document.createElement('button'); u.type = 'button'; u.className = 'fitundo'; u.textContent = 'Undo';
          u.addEventListener('click', function () {
            var back = trkWithDate({ mode: 'set', cid: fitCid() }); Object.keys(w).forEach(function (k) { if (['calories', 'protein', 'carbs', 'fat'].indexOf(k) >= 0) back[k] = w[k].before == null ? 0 : w[k].before; });
            u.remove(); fitSay('qa-meal-msg', 'Undoing\u2026');
            apiRaw('logday', back).then(function (j2) { trkRes(j2); fitSay('qa-meal-msg', 'Undone.'); return loadTrackQuiet(); }).catch(function (e) { trkWriteErr(e, 'qa-meal-msg'); });
          });
          m.appendChild(u); setTimeout(function () { if (u.parentNode) u.remove(); }, 12000);
        }
        return loadTrackQuiet();
      });
    });
  }
  function trkWorkout(btn) {
    var type = $('qa-wo-type').value.trim(), min = $('qa-wo-min').value;
    if (!type && min === '') return fitSay('qa-wo-msg', 'Enter a type and/or minutes.', true);
    var p = trkWithDate({ cid: fitCid() });
    if (type) p.workout = type; else p.workout = 'Workout';
    if (min !== '') { var n = Number(min); if (!isFinite(n) || n < 0) return fitSay('qa-wo-msg', 'Minutes must be a positive number.', true); p.workout_min = n; }
    trkGo(btn, 'qa-wo-msg', function () {
      return apiRaw('logday', p).then(function (j) {
        trkRes(j); $('qa-wo-type').value = ''; $('qa-wo-min').value = '';
        fitSay('qa-wo-msg', 'Saved' + (trkPast() ? ' for ' + trkWhen() : '') + ': ' + p.workout + (p.workout_min != null ? ' \u00b7 ' + fmt(p.workout_min) + ' min' : ''));
        return loadTrackQuiet();
      });
    });
  }
  function trkBody(btn) {
    var d = state.trackData, canDay = !!(d && d.ext && d.ext.write && d.ext.write.logday), jobs = [], dayP = {}, bad = false;
    Array.prototype.forEach.call(document.querySelectorAll('#qa-body input[data-f]'), function (i) {
      if (i.value === '' || i.value === i.getAttribute('data-cur')) return;
      var n = Number(i.value); if (!isFinite(n) || n < 0) { bad = true; return; }
      var f = i.getAttribute('data-f');
      if (canDay && f === 'hike') dayP.hike_miles = n;
      else if (canDay && f === 'steps') dayP.steps = n;
      else jobs.push({ f: f, v: i.value });
    });
    if (bad) return fitSay('qa-body-msg', 'Use positive numbers.', true);
    if (!jobs.length && !Object.keys(dayP).length) return fitSay('qa-body-msg', 'Nothing changed.');
    trkGo(btn, 'qa-body-msg', function () {
      var done = 0, chain = Promise.resolve();
      if (Object.keys(dayP).length) { dayP.cid = fitCid(); trkWithDate(dayP); chain = chain.then(function () { return apiRaw('logday', dayP).then(function (j) { trkRes(j); done += Object.keys(dayP).length - 1; }); }); }
      jobs.forEach(function (j) { chain = chain.then(function () { return apiRaw('logset', trkWithDate({ field: j.f, value: j.v, cid: fitCid() })).then(function (r) { trkRes(r); done++; }); }); });
      return chain.then(function () {
        Array.prototype.forEach.call(document.querySelectorAll('#qa-body input[data-f]'), function (i) { i.setAttribute('data-cur', i.value); });
        fitSay('qa-body-msg', 'Saved ' + done + ' value' + (done === 1 ? '' : 's') + (trkPast() ? ' for ' + trkWhen() : '') + '.');
        return loadTrackQuiet();
      }, function (err) { return loadTrackQuiet().then(function () { throw err; }); });
    });
  }
  $('trk-forms').addEventListener('change', function (ev) {
    var i = ev.target; if (!i || i.id !== 'qa-datepick') return;
    var tk = trkTodayKey();
    if (!i.value || i.value > tk) { i.value = state.trkDate || tk; return; }
    state.trkDate = i.value === tk ? '' : i.value;
    renderTrackForms(state.trackData);
  });
  $('trk-forms').addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('button') : null; if (!t) return;
    if (t.id === 'qa-meal-go') trkMeal(t);
    else if (t.id === 'qa-wo-go') trkWorkout(t);
    else if (t.id === 'qa-body-go') trkBody(t);
    else if (t.getAttribute('data-day')) {
      var dk = t.getAttribute('data-day'), tk = trkTodayKey();
      if (dk === 'today') state.trkDate = '';
      else if (dk === 'yesterday') state.trkDate = trkAddDays(tk, -1);
      else { var pk = $('qa-datepick'); state.trkDate = pk && pk.value && pk.value < tk ? pk.value : trkAddDays(tk, -2); }
      renderTrackForms(state.trackData);
    }
    else if (t.getAttribute('data-wd')) {
      var oz = Number(t.getAttribute('data-wd')), k = trkPast(); if (!k || state.trkBusy) return;
      state.trkBusy = true; fitSay('qa-water-msg', 'Saving\u2026');
      apiRaw('logadd', { value: oz, date: k, cid: fitCid() }).then(function (j) { var r = trkRes(j); fitSay('qa-water-msg', trkDayLabel(k) + ' water now ' + fmt(r.after) + ' oz'); })
        .catch(function (e) { trkWriteErr(e, 'qa-water-msg'); }).then(function () { state.trkBusy = false; });
    }
    else if (t.getAttribute('data-mode')) {
      state.trkMode = t.getAttribute('data-mode');
      Array.prototype.forEach.call(document.querySelectorAll('#qa-mode button'), function (b) { b.classList.toggle('on', b === t); });
      $('qa-meal-go').textContent = state.trkMode === 'set' ? 'Set total' : 'Add meal';
    }
  });

  // One-tap water: optimistic, retry-safe (client id), undoable. Only offered when the API advertises ext.write.water.
  function addWater(oz) {
    var d = state.trackData; if (!d || !d.ext || state.waterBusy) return;
    var t = d.ext.today, before = t.water == null ? null : t.water;
    state.waterBusy = true;
    t.water = (before || 0) + oz; t.logged = true; renderTrackProg(d); fitSay('fit-msg', 'Saving +' + oz + ' oz\u2026');
    apiRaw('logadd', { value: oz, cid: fitCid() }).then(function (j) {
      if (j.error || !j.data) throw new Error(j.message || (j.error === 'bad_action' ? 'Server update pending.' : 'Could not save.'));
      t.water = j.data.after; renderTrackProg(d);
      fitSay('fit-msg', 'Saved: ' + fmt(j.data.after) + ' oz today');
      var m = $('fit-msg');
      if (m && oz > 0) { var u = document.createElement('button'); u.type = 'button'; u.className = 'fitundo'; u.textContent = 'Undo'; u.addEventListener('click', function () { u.remove(); addWater(-oz); }); m.appendChild(u); clearTimeout(state.undoT); state.undoT = setTimeout(function () { if (u.parentNode) u.remove(); }, 9000); }
    }).catch(function (err) {
      if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return; }
      t.water = before; renderTrackProg(d); fitSay('fit-msg', 'Not saved: ' + friendly(err), true);
    }).then(function () { state.waterBusy = false; });
  }

  function renderLog(d) {
    $('log-range').textContent = d.rangeLabel;
    if (d.ext && d.ext.today && d.ext.history) {
      try { return renderLogV2(d); } catch (e) { if (window.console) console.error('Daily log v2 failed, using the previous screen', e); }
    }
    renderLogLegacy(d);
  }

  $('log-body').addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('.pday .pdh') : null;
    if (!b || !b.parentNode.getAttribute('data-date')) return;
    var row = b.parentNode, k = row.getAttribute('data-date'), open = !row.classList.contains('open');
    row.classList.toggle('open', open); b.setAttribute('aria-expanded', open); state.logOpen[k] = open;
  });

  $('log-prev').addEventListener('click', function () { state.weekOffset--; loadLog(); });
  $('log-next').addEventListener('click', function () { state.weekOffset++; loadLog(); });

  /* ---------------- Vault (daily spend + income) ---------------- */
  // Main screen = account tiles, then a category section per account (Household, TiwiK, KiwiT),
  // then Income (green). Items live on sub-pages:
  //   #spend/cat/<Category>[/<Account>], #spend/acct/<Account>, #spend/income/<Source>, #spend/all
  var ACCOUNTS = ['Household', 'TiwiK', 'KiwiT'];
  var INCOME_SOURCES = ["Lisa's Table", 'Mono Village Laundromat'];
  var PT_SOURCE = 'Personal Training';   // Lisa's personal training income: a line item in the Income section (tap -> clients/dates/amounts)
  var PT_LABEL = "Lisa's Personal Training";
  var KR_SOURCE = 'KiwiT rent';   // KiwiT's rent check (Income tab, Source = "KiwiT rent"): fifth income card, after Mono Village Laundromat
  var LS_SOURCE = 'Land & Structure Pay';   // Zac's pay (twice a month): own spend-sheet tab, same list/tap-through as Personal Training; hidden until the API returns it
  // Income sources that live on their own spend-sheet tab and list per-entry (description/client, method, notes)
  var DETAIL_SRC = {};
  DETAIL_SRC[PT_SOURCE] = { label: PT_LABEL, title: 'Personal Training', unit: 'payment', tab: 'pt', tabName: 'Personal Training', what: 'client payments' };
  DETAIL_SRC[LS_SOURCE] = { label: LS_SOURCE, title: LS_SOURCE, unit: 'payment', tab: 'ls', tabName: LS_SOURCE, what: 'pay' };

  function loadSpend(force) {
    ordLiveFetch(!!force);
    if (!force && state.spendData && state.spendDataOff === state.monthOffset) return renderSpend();
    var seq = ++state.spendSeq, off = state.monthOffset;
    paintSpendChrome();
    $('spend-body').innerHTML = '<div class="loading">Loading…</div>';
    $('spend-month').textContent = '…';
    api('spend', off).then(function (d) {
      if (seq !== state.spendSeq) return;
      state.spendData = d; state.spendDataOff = off; renderSpend();
    }, function (err) { if (seq === state.spendSeq) { $('spend-month').textContent = ''; onFail(['spend-body'], function () { loadSpend(true); })(err); } });
  }

  function loose(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function normCat(c) { c = String(c || '').trim() || 'Other'; return c === 'Household' ? 'Home goods' : c; }
  function normAcct(a) {
    a = String(a || '').trim();
    if (!a) return 'Household';
    for (var i = 0; i < ACCOUNTS.length; i++) if (loose(ACCOUNTS[i]) === loose(a)) return ACCOUNTS[i];
    return a;
  }
  function normSource(s) {
    s = String(s || '').trim() || 'Other';
    var l = loose(s);
    if (/personaltraining|^pt$/.test(l)) return PT_SOURCE;
    if (/landstructure/.test(l)) return LS_SOURCE;
    if (/kiwit|monoway|hatler|standardfit|^rents?$|^rental/.test(l)) return KR_SOURCE;   // before the mono/laundr test below: "Mono Way rent" is KiwiT, not the laundromat
    for (var i = 0; i < INCOME_SOURCES.length; i++) {
      var k = loose(INCOME_SOURCES[i]);
      if (k === l || (l && (k.indexOf(l) === 0 || l.indexOf(k) === 0))) return INCOME_SOURCES[i];
    }
    if (/mono|laundr/.test(l)) return INCOME_SOURCES[1];
    if (/lisa/.test(l)) return INCOME_SOURCES[0];
    return s;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  // Days in the period: today's day-of-month for the current month, full month for past months, 0 for future.
  function periodDays(off) {
    off = Number(off) || 0;
    var t = new Date();
    if (off === 0) return t.getDate();
    if (off > 0) return 0;
    return new Date(t.getFullYear(), t.getMonth() + off + 1, 0).getDate();
  }
  function sum(list) { return r2(list.reduce(function (s, x) { return s + x.amount; }, 0)); }
  function sumBy(list, key) {
    var m = {};
    list.forEach(function (x) { m[x[key]] = (m[x[key]] || 0) + x.amount; });
    return m;
  }
  function sortedPairs(m) {
    return Object.keys(m).map(function (k) { return { name: k, amount: r2(m[k]) }; })
      .filter(function (c) { return c.amount !== 0; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  /* ---- Lisa's Table income, LIVE from the Orders summary ----
     The Vault's Lisa's Table income for a week = the PAID total of that Orders week (cash / Zelle / Venmo actually received, delivery fees on
     paid orders included; unpaid and trade orders are NOT income). It comes from the `orders` read (weeks[] aggregates), never typed in.
     Rules:  (1) a week belongs to the month of its Monday (week-start) date;  (2) a manual Income-tab row for Lisa's Table whose date falls in an
     Orders week (Monday..Sunday) that has orders is SUPERSEDED by the live value and left out of every total (shown as ignored, never deleted);
     (3) while the orders read is loading / failed / not deployed, only the manual rows count and a small note says so.
     Everything that sums Vault income goes through spendModel(), so the live rows are counted exactly once everywhere. */
  var ordLive = { s: 'idle', weeks: [], at: 0, seq: 0, busy: false };
  var OL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var OL_ISO = /^\d{4}-\d{2}-\d{2}$/;
  function olParse(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function olIso(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function olAdd(iso, n) { var d = olParse(iso); if (!d) return ''; d.setUTCDate(d.getUTCDate() + n); return olIso(d); }
  function olMonday(iso) { var d = olParse(iso); if (!d) return ''; d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return olIso(d); }
  function olShort(iso) { var d = olParse(iso); return d ? OL_MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCDate() : String(iso || ''); }
  function olMonthName(iso) { var d = olParse(iso); return d ? OL_MONTHS[d.getUTCMonth()] : ''; }
  function olWeekNorm(w) {          // one weeks[] aggregate from the orders read -> clean row, or null (menu-only weeks, junk)
    if (!w || !OL_ISO.test(String(w.week || ''))) return null;
    var n = function (v) { v = Number(v); return isFinite(v) && v > 0 ? r2(v) : 0; };
    var cnt = function (v) { v = Math.floor(Number(v)); return isFinite(v) && v > 0 ? v : 0; };
    var o = { week: olMonday(w.week), clients: cnt(w.clients), paid: n(w.paid), unpaid: n(w.unpaid), trade: n(w.trade),
      paidCount: cnt(w.paidCount), unpaidCount: cnt(w.unpaidCount), tradeCount: cnt(w.tradeCount) };
    return o.clients > 0 ? o : null;
  }
  function ordLiveFetch(force) {      // cached for the session; refetched on every Vault / Ledger / Overview open (throttled to once per 10 s) and on Refresh app
    if (ordLive.busy) return;
    if (!force && ordLive.s === 'ok' && Date.now() - ordLive.at < 10000) return;
    var seq = ++ordLive.seq; ordLive.busy = true;
    if (ordLive.s !== 'ok') ordLive.s = 'load';
    apiRaw('orders', {}).then(function (j) {
      if (seq !== ordLive.seq) return;
      if (j.error === 'bad_action') { ordLive.s = 'na'; ordLive.weeks = []; return; }
      if (j.error) throw new Error(j.message || j.error);
      var by = {};
      ((j.data || {}).weeks || []).forEach(function (w) {
        var r = olWeekNorm(w); if (!r) return;
        var k = by[r.week];
        if (!k) by[r.week] = r;
        else ['clients', 'paid', 'unpaid', 'trade', 'paidCount', 'unpaidCount', 'tradeCount'].forEach(function (f) { k[f] = r2(k[f] + r[f]); });
      });
      ordLive.weeks = Object.keys(by).sort().map(function (k) { return by[k]; });
      ordLive.s = 'ok'; ordLive.at = Date.now();
    }).catch(function (err) {
      if (seq !== ordLive.seq) return;
      if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return; }
      if (ordLive.s !== 'ok') ordLive.s = 'err';        // keep the last good weeks when a refresh fails
    }).then(function () {
      if (seq !== ordLive.seq) return;
      ordLive.busy = false;
      olRerender();
    });
  }
  function olRerender() {
    try {
      var on = function (id) { var el = $(id); return !!(el && el.classList.contains('active')); };
      if (on('screen-spend') && state.spendData) renderSpend();
      else if (on('screen-fin') && state.finKind === 'ledger') renderLed();
      else if (on('screen-fin') && state.finKind === 'overview') renderOv();
    } catch (e) {}
  }
  function olMonthKey(d) {          // 'yyyy-mm' of the month a spend response covers
    var m = /^([A-Za-z]+)\s+(\d{4})$/.exec(String((d && d.monthLabel) || '').trim());
    if (m) { var i = -1; OL_MONTHS.forEach(function (n, k) { if (n.toLowerCase() === m[1].toLowerCase()) i = k; }); if (i >= 0) return m[2] + '-' + ('0' + (i + 1)).slice(-2); }
    var off = d && d.monthOffset != null ? Number(d.monthOffset) : Number(state.monthOffset) || 0, t = new Date(), x = new Date(t.getFullYear(), t.getMonth() + (isFinite(off) ? off : 0), 1);
    return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2);
  }
  function olSub(e) {               // the muted sub-line of a live row
    var t = 'Live from Orders: ' + money(e.amount) + ' paid, ' + money(e.unpaid) + ' unpaid' + (e.trade ? ', ' + money(e.trade) + ' trade' : '') + ' \u00b7 week of ' + olShort(e.week) +
      '. Unpaid and trade orders are not counted.';
    if (olMonthName(olAdd(e.week, 6)) !== olMonthName(e.week)) t += ' This week runs into ' + olMonthName(olAdd(e.week, 6)) + '; it is counted in ' + olMonthName(e.week) + ', the month it starts.';
    return t;
  }
  // manual: the model's income rows. Returns { income: counted rows (manual kept + live), superseded: manual rows ignored, note }
  function ordLiveApply(manual, monthKey) {
    var LT = INCOME_SOURCES[0], out = { income: [], superseded: [], note: '', live: 0 };
    if (ordLive.s !== 'ok') {
      out.income = manual.slice();
      out.note = ordLive.s === 'load' || ordLive.s === 'idle' ? 'Orders loading\u2026 Lisa\u2019s Table income shows the manual entries until they load.'
        : 'Orders not loaded \u2014 Lisa\u2019s Table income shows the manual entries only.';
      return out;
    }
    manual.forEach(function (m) {
      var wk = null;
      if (m.source === LT && OL_ISO.test(String(m.date || ''))) ordLive.weeks.forEach(function (w) { if (m.date >= w.week && m.date <= olAdd(w.week, 6)) wk = w; });
      if (wk) { m.supersededBy = wk.week; out.superseded.push(m); } else out.income.push(m);
    });
    ordLive.weeks.forEach(function (w) {
      if (w.week.slice(0, 7) !== monthKey) return;
      out.live++;
      out.income.push({ date: w.week, label: olShort(w.week), source: LT, amount: w.paid, notes: '', client: '', method: '', gid: '', row: 0, tab: '', rawSource: LT, cid: '',
        _v: 0, live: true, week: w.week, unpaid: w.unpaid, trade: w.trade, clients: w.clients, go: 'lt/orders?tab=summary&week=' + w.week });
    });
    return out;
  }
  function olSupRows(list) {        // ignored manual rows (muted, struck through): live Orders value used instead
    if (!list || !list.length) return '';
    return '<div class="olsup"><div class="olsuph">Ignored manual entries (replaced by live Orders)</div>' + list.map(function (e) {
      return '<div class="icrow sup"><span class="icd">Wk ending ' + esc(e.label) + '</span><span class="icc">Replaced by live week of ' + esc(olShort(e.supersededBy)) + '</span><span class="amt">' + money(e.amount) + '</span></div>';
    }).join('') + '</div>';
  }
  function olNoteHtml(M) { return M && M.liveNote ? '<div class="foot olnote">' + esc(M.liveNote) + '</div>' : ''; }

  // Works with the new API (items[] with account, income[]) and older shapes (recent[] only / no income).
  function spendModel(d) {
    var full = Array.isArray(d.items);
    var items = (full ? d.items : (d.recent || [])).map(function (x) {
      return { date: x.date, label: x.label || x.date, who: x.who || '', amount: Number(x.amount) || 0,
        category: normCat(x.category), merchant: x.merchant || '', method: x.method || '',
        notes: x.notes || '', account: normAcct(x.account), paidFrom: x.paidFrom || '',
        row: vRowNum(x.row), cid: x.cid || '', _v: 1 };      // row/cid: exposed by the server for Delete (v57); _v = a Vault entry (tap -> detail sheet)
    });
    var income = (Array.isArray(d.income) ? d.income : []).map(function (x) {
      return { date: x.date, label: x.label || x.date, source: normSource(x.source), amount: Number(x.amount) || 0, notes: x.notes || '',
        client: x.client || x.description || '', method: x.method || '', gid: x.gid != null ? String(x.gid) : '',
        row: vRowNum(x.row), tab: x.tab || '', rawSource: x.source || '', cid: x.cid || '', _v: 1 };
    });
    var olA = ordLiveApply(income, olMonthKey(d));      // Lisa's Table income is live from Orders; superseded manual rows leave the totals
    income = olA.income;
    var names = ACCOUNTS.slice();
    items.forEach(function (x) { if (names.indexOf(x.account) < 0) names.push(x.account); });
    var accounts = names.map(function (a) {
      var list = items.filter(function (x) { return x.account === a; });
      var cats, total;
      if (full) { cats = sortedPairs(sumBy(list, 'category')); total = sum(list); }
      else if (a === 'Household') {   // old API: everything counts as Household
        var m = {};
        (d.byCategory || []).forEach(function (c) { var k = normCat(c.name); m[k] = (m[k] || 0) + c.amount; });
        cats = sortedPairs(m); total = Number(d.total) || 0;
      } else { cats = []; total = 0; }
      return { name: a, amount: r2(total), cats: cats, count: list.length };
    });
    var hh = items.filter(function (x) { return x.account === 'Household'; });
    var who = full ? Object.keys(sumBy(hh, 'who')).map(function (k) { return { name: k, amount: r2(sumBy(hh, 'who')[k]) }; })
      : (d.byWho || []).map(function (w) { return { name: w.name, amount: w.amount }; });
    var srcNames = [PT_SOURCE, INCOME_SOURCES[0], LS_SOURCE, INCOME_SOURCES[1], KR_SOURCE];   // fixed display order; each shown even at $0
    income.forEach(function (x) { if (srcNames.indexOf(x.source) < 0) srcNames.push(x.source); });
    var lsGid = ''; income.forEach(function (x) { if (x.source === LS_SOURCE && x.gid) lsGid = x.gid; });
    return {
      items: items, full: full, entryCount: full ? items.length : (d.entryCount || items.length),
      truncated: !full && (d.entryCount || 0) > items.length,
      accounts: accounts, who: who, income: income,
      sources: srcNames.map(function (sname) {
        var l = income.filter(function (x) { return x.source === sname; });
        return { name: sname, label: DETAIL_SRC[sname] ? DETAIL_SRC[sname].label : sname, amount: sum(l), count: l.length };
      }),
      lsGid: lsGid, superseded: olA.superseded, liveNote: olA.note, liveCount: olA.live,
      incomeTotal: sum(income),   // all income sources, incl. Personal Training (Income total + Summary math)
      total: full ? sum(items) : Number(d.total) || 0,
      daysLogged: d.daysLogged
    };
  }

  function goAttr(route) { return ' data-go="' + esc(route) + '"'; }
  function catRoute(c, a) { return 'spend/cat/' + encodeURIComponent(c) + (a ? '/' + encodeURIComponent(a) : ''); }
  function acctRoute(a) { return 'spend/acct/' + encodeURIComponent(a); }
  function incomeRoute(s) { return 'spend/income/' + encodeURIComponent(s); }

  // Spend sheet (Daily Spend tab). Every number on the Vault drills down to the rows behind it and
  // links here ("Open in spend sheet" -> in-app doc viewer). gid = Daily Spend tab.
  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/13vEUSpqfSxNW0ZXRBMiLhecAXWSChgcqHd9N81PaG9Y/edit';
  var SHEET_GIDS = { spend: '555034', income: '1698769561', pt: '993449402', ls: '', bal: '287907026', acct: '820176485' };   // Daily Spend / Income / Personal Training tabs
  function sheetLink(label, tab, gid) {
    var g = gid || SHEET_GIDS[tab || 'spend'];
    var u = g ? SHEET_URL + '?gid=' + g + '#gid=' + g : SHEET_URL;
    return '<a class="linkrow sheetbtn" data-title="Spend sheet" href="' + esc(u) + '">' + esc(label || 'Open in spend sheet') + ' &#8599;</a>';
  }
  var CALC_LABELS = { 'tiwik-net': 'TiwiK net', 'lt-net': "Lisa's Table net", 'hh-spend': 'Household spend',
    'avg-spend': 'Avg daily spend', 'avg-income': 'Avg daily income', 'month-net': 'Net (income \u2212 spend)' };
  function cashRoute(acct, cat) { return 'spend/cash/' + encodeURIComponent(acct || 'All') + (cat ? '/' + encodeURIComponent(cat) : ''); }
  function whoRoute(w) { return 'spend/who/' + encodeURIComponent(w); }
  function calcRoute(k) { return 'spend/calc/' + k; }

  function spendTitle(sr) {
    if (!sr.kind) return 'Vault';
    if (sr.kind === 'all') return 'All items';
    if (sr.kind === 'cash') return 'Cash' + (sr.val && sr.val !== 'All' ? ' \u00b7 ' + sr.val : '') + (sr.acct ? ' \u00b7 ' + sr.acct : '');
    if (sr.kind === 'calc') return CALC_LABELS[sr.val] || sr.val;
    if (sr.kind === 'who') return sr.val + ' \u00b7 Household';
    if (sr.kind === 'debt') return debtDrillTitle(sr);
    if (sr.kind === 'bal') return sr.val === 'All' ? 'Account balances' : /^g:/.test(sr.val) ? sr.val.slice(2) + ' balances' : sr.val;
    if (sr.kind === 'income' && sr.val === 'All') return 'Income';
    return sr.val;
  }
  function paintSpendChrome() {
    var sr = state.spendRoute, sub = !!sr.kind;
    $('spend-back').hidden = !sub;
    $('spend-back').setAttribute('data-go', sub && state.spendFrom ? state.spendFrom : 'spend');
    $('spend-title').textContent = spendTitle(sr);
    $('spend-title').classList.toggle('sub', sub);
  }

  function itemRows(list, opt) {
    if (!list.length) return '<div class="foot">No items this month.</div>';
    return list.map(function (e) {
      var meta = [];
      if (e.method) meta.push(isCash(e) ? '<span class="cashtag">' + esc(e.method) + '</span>' : esc(e.method));
      if (opt.acct && e.account !== 'Household') meta.push('<span class="acct-tag">' + esc(e.account) + '</span>');
      if (opt.paid) meta.push(e.paidFrom ? '<span class="pf-tag' + (e.paidFrom === 'Household card/account' ? ' pf-hh' : '') + '">Paid from: ' + esc(e.paidFrom) + '</span>' : (opt.paid === 'need' ? '<span class="pf-tag pf-none">Paid from: not set</span>' : ''));
      return '<div class="entry item' + vEntCls(e) + '"' + vEntAttr('exp', e) + '><div class="d">' + esc(e.label) + '<br>' + esc(e.who) + '</div>' +
        '<div class="m"><div class="mer">' + esc(e.merchant || '—') + '</div>' +
        '<div class="meta">' + (opt.chip ? '<button class="chip"' + goAttr((opt.chipRoute || catRoute)(e.category)) + '>' + esc(e.category) + '</button>' : '') +
        (meta.length ? '<small>' + meta.join(' · ') + '</small>' : '') + '</div>' +
        (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : '') + '</div>' +
        '<div class="a amt-out">' + money(e.amount) + '</div></div>';
    }).join('');
  }
  function incomeRows(list, showSrc) {
    if (!list.length) return '<div class="foot">No income entries this month.</div>';
    return list.map(function (e) {
      if (e.live) return '<div class="entry item inc liveent" role="button" tabindex="0" data-go="' + esc(e.go) + '"><div class="d">Week of<br><b>' + esc(e.label) + '</b></div><div class="m">' +
        '<div class="meta"><small><span class="livetag">Live</span> ' + esc(showSrc ? e.source : 'from Orders') + '</small></div><div class="notes">' + esc(olSub(e)) + '</div></div>' +
        '<div class="a amt-in">' + money(e.amount) + '</div></div>';
      var ds = DETAIL_SRC[e.source], pt = !!ds, meta = [];
      if (showSrc) meta.push(esc(ds ? ds.label : e.source));
      if (pt && e.method) meta.push(isCash(e) ? '<span class="cashtag">' + esc(e.method) + '</span>' : esc(e.method));
      return '<div class="entry item inc' + (pt ? ' ptitem' : '') + vEntCls(e) + '"' + vEntAttr('inc', e) + '><div class="d">' +
        (pt ? esc(e.label) : 'Week ending<br><b>' + esc(e.label) + '</b>') + '</div><div class="m">' +
        (pt ? '<div class="mer">' + esc(e.client || '—') + '</div>' : '') +
        (meta.length ? '<div class="meta"><small>' + meta.join(' · ') + '</small></div>' : '') +
        (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : (pt ? '' : '<div class="notes">—</div>')) + '</div>' +
        '<div class="a amt-in">' + money(e.amount) + '</div></div>';
    }).join('');
  }
  // Compact per-source entry list for the expanded Income cards: most recent first, date + (client) + amount.
  function incCompact(list, detail, sup) {
    if (!list.length) return '<div class="foot empty">No entries this month</div>' + olSupRows(sup);
    var t = function (x) { var v = Date.parse(x.date); return isNaN(v) ? 0 : v; };
    var rows = list.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return (t(b.e) - t(a.e)) || (a.i - b.i); });
    return '<div class="inccompact">' + rows.map(function (r) {
      var e = r.e, what = detail ? (e.client || '') : 'Week ending';
      if (e.live) return '<div class="icrow live liverow" role="button" tabindex="0" data-go="' + esc(e.go) + '"><span class="icd">Wk of ' + esc(e.label) + '</span>' +
        '<span class="icc"><span class="livetag">Live</span></span><span class="amt amt-in">' + money(e.amount) + '</span></div><div class="livesub">' + esc(olSub(e)) + '</div>';
      return '<div class="icrow' + vEntCls(e) + '"' + vEntAttr('inc', e) + '><span class="icd">' + (detail ? esc(e.label) : 'Wk ending ' + esc(e.label)) + '</span>' +
        '<span class="icc">' + (detail ? esc(what) : '') + '</span><span class="amt amt-in">' + money(e.amount) + '</span></div>';
    }).join('') + '</div>' + olSupRows(sup);
  }
  function truncNote(M) {
    return M.truncated ? '<div class="foot">Showing the latest ' + M.items.length + ' of ' + M.entryCount +
      ' entries this month (full list after the API update).</div>' : '';
  }
  // Method column says "Cash" (case-insensitive, trimmed).
  // Every big number = ALL spend in its scope (cash + non-cash). The small "of which Cash" figure is the
  // cash-only SUBSET of that same number (never added on top).
  function isCash(x) { return String(x.method || '').trim().toLowerCase() === 'cash'; }
  function cashOf(list) { return sum(list.filter(isCash)); }
  function cashBtn(v, route, cls) {
    return '<button class="cashline' + (cls || '') + (v ? '' : ' zero') + '"' + goAttr(route) + '>' +
      (cls && cls.indexOf('mini') >= 0 ? 'Cash ' : 'of which Cash ') + money(v) + ' &rsaquo;</button>';
  }
  // cashFn(name) -> { v, route } (omit for no cash line)
  function barRows(rows, routeFn, cls, cashFn) {
    var max = rows.reduce(function (m, c) { return Math.max(m, c.amount); }, 0);
    return rows.map(function (c) {
      var pct = max > 0 && c.amount > 0 ? Math.max(2, (c.amount / max) * 100) : 0;
      var cash = cashFn ? cashFn(c.name) : null;
      var btn = '<button class="catrow' + (cls || '') + (cash ? ' hascash' : '') + '"' + goAttr(routeFn(c.name)) + '>' +
        '<span class="n">' + esc(c.label || c.name) + '</span>' +
        '<span class="amt ' + ((cls || '').indexOf('inc') >= 0 ? 'amt-in' : 'amt-out') + '">' + money(c.amount) + '</span><span class="chev">&rsaquo;</span>' +
        '<span class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></span></button>';
      return cash ? '<div class="catwrap">' + cashBtn(cash.v, cash.route) + btn + '</div>' : btn;
    }).join('');
  }
  // Collapsible Vault section (same .ncard / .ncbody / .chev pattern as the Laundromat screen). Collapsed by default: only the
  // heading + its total are visible. Heading / chevron toggle; the total button drills down. Open state survives Back.
  function vOpenMap() {
    if (!state.vopen) state.vopen = {};
    return state.vopen;
  }
  function vSec(key, cls, title, totHtml, route, body, totAttr) {
    var open = !!vOpenMap()[key];
    return '<div class="card ncard vsec ' + cls + (open ? ' open' : '') + '" data-vs="' + esc(key) + '">' +
      '<div class="vhead"><button class="nchead vtoggle" aria-expanded="' + open + '"><span>' + title + '</span></button>' +
      '<button class="vtot"' + (totAttr || goAttr(route)) + '>' + totHtml + '</button>' +
      '<button class="nchead vtoggle vchevb" aria-label="Expand or collapse"><i class="chev">&rsaquo;</i></button></div>' +
      '<div class="ncbody">' + body + '</div></div>';
  }
  function totBtn(label, amt, route, isIn) {
    return '<button class="totrow tapt"' + goAttr(route) + '><span>' + esc(label) + '</span><span class="amt ' + (isIn ? 'amt-in' : 'amt-out') + '">' + money(amt) + '</span><span class="chev">&rsaquo;</span></button>';
  }
  function sumBtn(cls, route, labelHtml, amtHtml) {
    return '<button class="sumline ' + cls + '"' + goAttr(route) + '><span>' + labelHtml + '</span>' + amtHtml + '<span class="chev">&rsaquo;</span></button>';
  }
  function signedMoney(v) { return (v >= 0 ? '+' : '\u2212') + money(Math.abs(v)); }


  /* ---------------- Vault: Accounts (balances from the spend sheet's Accounts + Balances tabs; API action `accounts`) ---------------- */
  // No figures live in this file: everything is fetched at runtime. Neutral copper (not red/green): a balance is neither money in nor out.
  // state.acct = { s: 'load' | 'ok' | 'na' (server not updated) | 'err', d: model, at: ms, msg }
  var ACCT_TTL = 60000;
  function balMoney(n) { n = Number(n) || 0; return (n < 0 ? '\u2212' : '') + money(Math.abs(n)); }
  function balSigned(n) { n = Number(n) || 0; return (n < 0 ? '\u2212' : '+') + money(Math.abs(n)); }
  function acDate(k) {
    var m = String(k || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(k || '');
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function acMonthEnd(k) {
    var m = String(k || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return !!m && Number(m[3]) === new Date(Number(m[1]), Number(m[2]), 0).getDate();
  }
  function acNum(v) { return v == null || v === '' || isNaN(Number(v)) ? null : Number(v); }
  // v49: Investments-group accounts (brokerage, retirement) are not Vault bank accounts. They come from `investments[]` (API v31+); an older API still lists them in
  // accounts[] with group Investments, so they are moved out here too. Either way they never reach the Vault tiles, group totals, total or reconciliation; the Overview uses them.
  function isInvGroup(g) { return /^investments?$/i.test(String(g || '').trim()); }
  function acctModel(d) {
    var rawAll = Array.isArray(d.accounts) ? d.accounts : [], rawInv = Array.isArray(d.investments) ? d.investments.slice() : [], moved = 0;
    var rawAcc = rawAll.filter(function (a) { if (isInvGroup(a.group)) { moved++; if (!rawInv.some(function (x) { return String(x.name || '').toLowerCase() === String(a.name || '').toLowerCase(); })) rawInv.push(a); return false; } return true; });
    var mapAcct = function (a) {
      var entries = (Array.isArray(a.entries) ? a.entries : []).map(function (e) {
        return { date: e.date || '', balance: Number(e.balance) || 0, notes: e.notes || '' };
      });
      return { name: a.name || '', bank: a.bank || '', type: a.type || '', kind: a.kind || a.accountKind || a.accountType || '', purpose: a.purpose || '', group: 'Investments', balance: acNum(a.balance), asOf: a.asOf || '',
        notes: a.notes || '', prevBalance: acNum(a.prevBalance), prevAsOf: a.prevAsOf || '', change: acNum(a.change), entries: entries };
    };
    var investments = rawInv.map(mapAcct);
    var accounts = rawAcc.map(function (a) {
      var entries = (Array.isArray(a.entries) ? a.entries : []).map(function (e) {
        return { date: e.date || '', balance: Number(e.balance) || 0, notes: e.notes || '' };
      });
      return { name: a.name || '', bank: a.bank || '', type: a.type || '', kind: a.kind || a.accountKind || a.accountType || '', purpose: a.purpose || '', group: normAcct(a.group), balance: acNum(a.balance), asOf: a.asOf || '',
        notes: a.notes || '', prevBalance: acNum(a.prevBalance), prevAsOf: a.prevAsOf || '', change: acNum(a.change), entries: entries };
    });
    var groups = (Array.isArray(d.groups) ? d.groups : []).filter(function (g) { return !isInvGroup(g.group); }).map(function (g) {
      return { group: normAcct(g.group), total: Number(g.total) || 0, count: g.count || 0, change: acNum(g.change) };
    });
    var total = moved ? r2(groups.reduce(function (t, g) { return t + g.total; }, 0)) : Number(d.total) || 0;   // older API: its total still had the investments in it
    return { accounts: accounts, investments: investments, groups: groups, total: total, count: accounts.length, change: moved ? null : acNum(d.change),
      recon: (Array.isArray(d.reconciliation) ? d.reconciliation : []).filter(function (r) { return !isInvGroup(r.group); }), gid: d.balancesGid != null ? String(d.balancesGid) : SHEET_GIDS.bal,
      unmatched: d.unmatched || [] };
  }
  function loadAccounts(force) {
    var a = state.acct;
    if (!force && a && (a.s === 'load' || (a.at && Date.now() - a.at < ACCT_TTL))) return;
    var prev = a && a.s === 'ok' ? a : null;
    state.acct = { s: 'load', d: prev ? prev.d : null, at: 0 };
    var mine = state.acct;
    api('accounts').then(function (d) {
      if (state.acct !== mine) return;
      state.acct = { s: 'ok', d: acctModel(d || {}), at: Date.now() };
    }, function (err) {
      if (state.acct !== mine) return;
      var m = String((err && err.message) || '');
      state.acct = /bad_action/.test(m) ? { s: 'na', d: null, at: Date.now() } : { s: 'err', d: prev ? prev.d : null, at: Date.now(), msg: m };
    }).then(function () { if (state.spendData && $('screen-spend').classList.contains('active')) renderSpend(); if (state.finKind === 'overview' && $('screen-fin').classList.contains('active')) renderOv(); if (ledActive()) renderLed(); });
  }
  function balRoute(v) { return 'spend/bal/' + encodeURIComponent(v || 'All'); }
  function balBtn(label, route, cls) { return '<button class="' + (cls || 'acbtn') + '"' + goAttr(route) + '>' + label + ' &rsaquo;</button>'; }
  function acctCard(a) {
    var flag = a.asOf && !acMonthEnd(a.asOf) ? ' <span class="acflag">not month end</span>' : '';
    var h = '<div class="acard"><div class="actop"><div class="acname">' + esc(a.name) +
      '<small>' + esc([a.bank, a.type].filter(Boolean).join(' \u00b7 ')) + '</small></div>';
    h += a.balance == null ? '<span class="acnone">No balance yet</span>'
      : '<button class="acbal amt-bal"' + goAttr(balRoute(a.name)) + '>' + balMoney(a.balance) + ' <i class="chev">&rsaquo;</i></button>';
    h += '</div>';
    if (a.asOf) h += '<div class="acmeta"><span>As of ' + esc(acDate(a.asOf)) + '</span>' + flag + '</div>';
    if (a.change != null) {
      h += '<button class="acchg"' + goAttr(balRoute(a.name)) + '><span>Change vs ' + esc(acDate(a.prevAsOf)) + '</span><b class="amt-bal">' + balSigned(a.change) + '</b></button>';
    } else if (a.balance != null) {
      h += '<div class="acchg none">Change: need next statement</div>';
    }
    if (a.notes) h += '<div class="acnote">' + esc(a.notes) + '</div>';
    return h + '</div>';
  }
  function reconCard(A) {
    var ready = A.recon.filter(function (r) { return r.status === 'ok' || r.status === 'gap'; });
    var h = '<div class="reccard"><h4>Reconciliation</h4>';
    if (!ready.length) {
      h += '<div class="recneed"><b>Needs a second month of statements</b>Once an account group has balances for two dates, this compares its balance change with its income minus spend from the Vault and flags any unexplained gap.</div>';
    }
    A.recon.forEach(function (r) {
      var ok = r.status === 'ok', gap = r.status === 'gap';
      h += '<div class="recgrp' + (gap ? ' flagged' : '') + '"><div class="rechead"><span>' + esc(r.group) + '</span>' +
        (gap ? '<span class="acflag warn">unexplained gap</span>' : ok ? '<span class="acflag okf">explained</span>' : '<span class="acflag">need next statement</span>') + '</div>';
      if (ok || gap) {
        h += '<div class="recsub">' + esc(acDate(r.periodStart)) + ' \u2192 ' + esc(acDate(r.periodEnd)) + '</div>' +
          '<button class="recline"' + goAttr(balRoute('g:' + r.group)) + '><span>Balance change</span><b class="amt-bal">' + balSigned(r.balanceChange) + '</b></button>' +
          '<button class="recline"' + goAttr(balRoute('g:' + r.group)) + '><span>Income \u2212 spend</span><b class="amt-bal">' + balSigned(r.expected) + '</b></button>' +
          '<button class="recline gapl"' + goAttr(balRoute('g:' + r.group)) + '><span>Gap</span><b class="' + (gap ? 'warnv' : 'amt-bal') + '">' + balSigned(r.gap) + '</b></button>';
        if (gap) h += '<div class="recmsg">' + esc(r.message || '') + '</div>';
      } else {
        h += '<div class="recmsg">' + esc(r.message || 'need next statement') + '</div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }
  function accountsSection() {
    var st = state.acct || { s: 'load' }, A = st.d, tot, body = '';
    var sheet = sheetLink('Open in spend sheet (Balances tab)', 'bal', A ? A.gid : '');
    if (st.s === 'na') {
      return vSec('accounts', 'acctbal', 'Accounts', '<span class="amt-bal">\u2014</span>', 'spend/bal/All',
        '<div class="foot">Accounts are not available yet (server update pending). Balances are in the spend sheet.</div>' + sheetLink('Open in spend sheet (Balances tab)', 'bal'));
    }
    if (!A) {
      if (st.s === 'err') body = '<div class="foot">Could not load accounts' + (st.msg ? ': ' + esc(st.msg) : '') + '.</div><button class="linkrow smallrow" data-acct-retry="1">Try again</button>' + sheetLink('Open in spend sheet (Balances tab)', 'bal');
      else body = '<div class="loading">Loading accounts\u2026</div>';
      return vSec('accounts', 'acctbal', 'Accounts', '<span class="amt-bal">' + (st.s === 'err' ? '\u2014' : '\u2026') + '</span>', 'spend/bal/All', body);
    }
    A.groups.forEach(function (g) {
      var mine = A.accounts.filter(function (a) { return a.group === g.group; });
      body += '<div class="acgroup"><div class="acghead"><span>' + esc(g.group) + '<small>' + mine.length + ' account' + (mine.length === 1 ? '' : 's') + '</small></span>' +
        '<button class="acgtot amt-bal"' + goAttr(balRoute('g:' + g.group)) + '>' + balMoney(g.total) + ' <i class="chev">&rsaquo;</i></button></div>' +
        mine.map(acctCard).join('') + '</div>';
    });
    if (!A.accounts.length) body += '<div class="foot">No accounts found on the Accounts tab.</div>';
    body += reconCard(A);
    if (A.unmatched.length) body += '<div class="foot">Balances for accounts not on the Accounts tab were skipped: ' + esc(A.unmatched.join(', ')) + '</div>';
    body += balBtn('All balance entries', 'spend/bal/All', 'linkrow smallrow') + sheet + sheetLink('Open Accounts tab', 'acct').replace('linkrow sheetbtn', 'linkrow sheetbtn second');
    return vSec('accounts', 'acctbal', 'Accounts', '<span class="amt-bal">' + balMoney(A.total) + '</span>', 'spend/bal/All', body);
  }
  /* ---------------- Vault: Debt + Upcoming bills (API action `vaultdebt`; v30 reads the Debts + Bills tabs of the spend sheet, older API reads the Overview Doc) ---------------- */
  // No figures live in this file: loans, balances, payments, due dates and bills are fetched at runtime from the API.
  // source === 'sheet': every row has a plain-English description, numbers tap to an in-app drill-down of the tab rows (#spend/debt/...) and a button opens the tab in the sheet.
  // Any other source (older API, tabs not set up yet) keeps the old rendering where numbers open the Overview Doc.
  // Colors: section heading + chevron amber (--c-debt); balances neutral light (.amt-neutral); money going out (payments, bills) red (.amt-out).
  // Every number taps through to the source Doc / PDF in the in-app viewer. Estimate badges explain what is still needed.
  // state.debt = { s: 'load' | 'ok' | 'na' (server not updated) | 'err', d: model, at: ms, msg }
  var DEBT_TTL = 60000;
  function dbDate(iso, withDow) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso || '');
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toLocaleDateString('en-US',
      withDow ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function dbIn(n) { return n == null ? '' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n < 0 ? Math.abs(n) + ' days ago' : 'in ' + n + ' days'; }
  function dbStat(v) { v = String(v || '').toUpperCase(); return v === 'VERIFIED' || v === 'DERIVED' ? v : 'ESTIMATE'; }
  function dbLinks(a) { return (Array.isArray(a) ? a : []).filter(function (l) { return l && l.url; }).map(function (l) { return { label: String(l.label || 'Document'), url: String(l.url) }; }); }
  function dbField(f) {
    return f ? { label: f.label || '', value: f.value || '', num: acNum(f.num), status: dbStat(f.status), source: f.source || '', url: f.url || '', ref: f.ref || '' } : null;
  }
  function debtModel(d) {
    var loans = (Array.isArray(d.loans) ? d.loans : []).map(function (l) {
      var f = l.fields || {};
      return { key: l.key || l.name || '', name: l.name || 'Loan', entity: l.entity || '', balance: acNum(l.balance), rate: acNum(l.rate), rateText: l.rateText || '',
        payment: acNum(l.payment), nextDue: l.nextDue || '', daysUntil: acNum(l.daysUntil), nextDueAmount: acNum(l.nextDueAmount), paidThrough: l.paidThrough || '',
        paymentNext: l.paymentNext && l.paymentNext.amount != null ? { amount: Number(l.paymentNext.amount), from: l.paymentNext.from || '' } : null,
        maturity: l.maturity || '', status: dbStat(l.status), balanceNote: l.balanceNote || '', rateNote: l.rateNote || '', srcLinks: dbLinks(l.srcLinks),
        fields: { balance: dbField(f.balance), rate: dbField(f.rate), payment: dbField(f.payment), paymentNext: dbField(f.paymentNext) },
        description: l.description || '', lender: l.lender || '', notes: l.notes || '', asOf: l.asOf || '', rowNum: l.rowNum || 0 };
    });
    var bills = (Array.isArray(d.bills) ? d.bills : []).map(function (b) {
      return { id: b.id || (b.name + b.date), date: b.date || '', daysUntil: acNum(b.daysUntil), kind: b.kind || '', kindLabel: b.kindLabel || '', name: b.name || '', entity: b.entity || '',
        amount: acNum(b.amount), status: dbStat(b.status), viaEscrow: !!b.viaEscrow, note: b.note || '', ref: b.ref || '', srcLinks: dbLinks(b.srcLinks),
        description: b.description || '', rowNum: b.rowNum || 0, tab: b.tab || '', repeat: b.repeat || '', overdue: !!b.overdue };
    });
    var rw = d.rows && typeof d.rows === 'object' ? d.rows : {}, tb = d.tabs && typeof d.tabs === 'object' ? d.tabs : {};
    return { loans: loans, bills: bills, today: d.today || '', windowDays: Number(d.windowDays) || 30, windowEnd: d.windowEnd || '',
      totalDebt: Number(d.totalDebt) || 0, totalDebtStatus: dbStat(d.totalDebtStatus), totalMonthly: Number(d.totalMonthly) || 0, totalMonthlyStatus: dbStat(d.totalMonthlyStatus),
      monthlyAfter: d.monthlyAfter && d.monthlyAfter.amount != null ? { amount: Number(d.monthlyAfter.amount), from: d.monthlyAfter.from || '' } : null,
      billsTotal: Number(d.billsTotal) || 0, billsStatus: dbStat(d.billsStatus), undated: Array.isArray(d.undated) ? d.undated : [],
      needs: Array.isArray(d.needs) ? d.needs : [], docUrl: d.docUrl || '', docTitle: d.docTitle || 'Finances - Overview',
      source: d.source === 'sheet' ? 'sheet' : 'doc', tabs: { debts: tb.debts || null, bills: tb.bills || null },
      rows: { debts: Array.isArray(rw.debts) ? rw.debts : [], bills: Array.isArray(rw.bills) ? rw.bills : [] } };
  }
  function loadDebt(force) {
    var a = state.debt;
    if (!force && a && (a.s === 'load' || (a.at && Date.now() - a.at < DEBT_TTL))) return;
    var prev = a && a.s === 'ok' ? a : null;
    state.debt = { s: 'load', d: prev ? prev.d : null, at: 0 };
    var mine = state.debt;
    api('vaultdebt').then(function (d) {
      if (state.debt !== mine) return;
      state.debt = { s: 'ok', d: debtModel(d || {}), at: Date.now() };
    }, function (err) {
      if (state.debt !== mine) return;
      var m = String((err && err.message) || '');
      state.debt = /bad_action/.test(m) ? { s: 'na', d: null, at: Date.now() } : { s: 'err', d: prev ? prev.d : null, at: Date.now(), msg: m };
    }).then(function () { if (state.spendData && $('screen-spend').classList.contains('active')) renderSpend(); if ($('screen-ent').classList.contains('active')) renderEnt(); if (state.finKind === 'overview' && $('screen-fin').classList.contains('active')) renderOv(); if (ledActive()) renderLed(); });
  }
  function dbBadge(status, id, needsOn) {
    status = dbStat(status);
    if (status === 'ESTIMATE') return '<button class="badge est" data-db-est="' + esc(id) + '">Estimate</button>';
    return '<span class="badge ' + (status === 'DERIVED' ? 'dv' : 'ok') + '">' + (status === 'DERIVED' ? 'Derived' : 'Verified') + '</span>';
  }
  // number that opens its source Doc / PDF in the viewer (plain text when no link)
  function dbNum(text, url, title, cls) {
    return url ? '<a class="srcnum dbnum ' + (cls || '') + '" data-title="' + esc(title || 'Source') + '" href="' + esc(url) + '">' + esc(text) + '</a>'
      : '<span class="dbnum ' + (cls || '') + '">' + esc(text) + '</span>';
  }
  function dbSheet(D) { return !!D && D.source === 'sheet'; }
  // number that opens the in-app drill-down of the tab rows behind it (sheet mode)
  function dbTap(text, route, cls) {
    return '<button class="dbtap dbnum ' + (cls || '') + '"' + goAttr(route) + '>' + esc(text) + '</button>';
  }
  // a figure: sheet mode -> drill-down route; Doc mode -> source Doc / PDF in the viewer
  function dbVal(D, text, route, url, title, cls) { return dbSheet(D) ? dbTap(text, route, cls) : dbNum(text, url, title, cls); }
  function dbDesc(t, cls) { return t ? '<div class="' + (cls || 'dbdesc') + '">' + esc(t) + '</div>' : ''; }
  function dbTabBtn(D, which, second) {
    var t = D && D.tabs ? D.tabs[which] : null, g = t && t.gid ? t.gid : '', name = which === 'debts' ? 'Debts' : 'Bills';
    var u = g ? SHEET_URL + '?gid=' + g + '#gid=' + g : SHEET_URL;
    return '<a class="linkrow sheetbtn' + (second ? ' second' : '') + '" data-title="' + name + ' tab" href="' + esc(u) + '">Open ' + name + ' tab in sheet &#8599;</a>';
  }
  function dbRoute(view, arg) { return 'spend/debt/' + view + (arg ? '/' + encodeURIComponent(arg) : ''); }
  function dbNeedBox(D, id, refs) {
    var seen = {}, h = '';
    (D.needs || []).forEach(function (n) {
      var hit = !refs || refs.some(function (r) { return String(n.ref || '').split(/[,\s]+/).some(function (t) { return t === r || (/\.\*$/.test(t) && r.indexOf(t.slice(0, -1)) === 0); }); });
      var k = n.ref + n.need; if (!hit || seen[k]) return; seen[k] = 1;
      h += '<div class="dbneedrow">\u2610 ' + esc(String(n.need || '').replace(/^[\u2610\u2611\s]+/, '')) + (n.why ? '<small>' + esc(n.why) + '</small>' : '') + '</div>';
    });
    if (!h) h = '<div class="dbneedrow">Needs a dated statement or document from Zac.</div>';
    return '<div class="dbneed" id="dbneed-' + esc(id) + '" hidden><b>Needed from Zac</b>' + h + '</div>';
  }
  function dbDocBtn(D) {
    return D && D.docUrl && !dbSheet(D) ? '<a class="linkrow sheetbtn" data-title="' + esc(D.docTitle || 'Finances - Overview') + '" href="' + esc(D.docUrl) + '">Open the Overview Doc &#8599;</a>' : '';
  }
  function dbFallback(key, cls, title, msg, st) {
    var body = '<div class="foot">' + msg + '</div>';
    if (st === 'err') body += '<button class="linkrow smallrow" data-debt-retry="1">Try again</button>';
    body += '<button class="linkrow smallrow" data-go="fin/overview">Open Finances \u203a Overview &rsaquo;</button>';
    return vSec(key, cls, title, '<span class="amt-neutral">' + (st === 'load' ? '\u2026' : 'n/a') + '</span>', 'fin/overview', body);
  }
  function loanCard(l, D) {
    var f = l.fields, id = 'ln-' + l.key, refs = [], sh = dbSheet(D), lr = dbRoute('loan', l.key);
    ['balance', 'rate', 'payment'].forEach(function (k) { if (f[k] && f[k].ref) refs.push(f[k].ref); });
    var row = function (label, html, extra) { return '<div class="dbrow"><span class="dbl">' + label + '</span><span class="dbv">' + html + '</span></div>' + (extra || ''); };
    var sub = sh ? [l.entity, l.lender].filter(Boolean).join(' \u00b7 ') : l.entity;
    var h = '<div class="dbcard"><div class="dbtop"><div class="dbname">' + esc(l.name) + '<small>' + esc(sub) + '</small></div>' + dbBadge(l.status, id) + '</div>';
    if (sh) h += dbDesc(l.description);
    h += row('Balance', f.balance ? dbVal(D, balMoney(l.balance), lr, f.balance.url || D.docUrl, f.balance.source || 'Source', 'amt-neutral') : '<span class="amt-neutral">' + balMoney(l.balance) + '</span>');
    if ((sh || l.status !== 'VERIFIED') && l.balanceNote) h += '<div class="dbnote">' + esc(l.balanceNote.length > 130 ? l.balanceNote.slice(0, 127) + '\u2026' : l.balanceNote) + '</div>';
    if (l.rate != null) h += row('Rate', f.rate ? dbVal(D, l.rateText || (l.rate + '%'), lr, f.rate.url || D.docUrl, f.rate.source || 'Source', 'amt-neutral') : esc(l.rateText));
    if (sh && l.rateNote) h += '<div class="dbnote">' + esc(l.rateNote.length > 150 ? l.rateNote.slice(0, 147) + '\u2026' : l.rateNote) + '</div>';
    if (l.payment != null) h += row('Monthly payment', f.payment ? dbVal(D, money(l.payment), lr, f.payment.url || D.docUrl, f.payment.source || 'Source', 'amt-out') : '<span class="amt-out">' + money(l.payment) + '</span>');
    if (l.paymentNext) h += '<div class="dbnote">From ' + esc(dbDate(l.paymentNext.from)) + ': <span class="amt-out">' + money(l.paymentNext.amount) + '</span> / mo</div>';
    h += row('Next due', l.nextDue ? '<b>' + esc(dbDate(l.nextDue, true)) + '</b><small>' + esc(dbIn(l.daysUntil)) + '</small>' : '<span class="muted">n/a</span>');
    if (l.paidThrough && l.paidThrough >= D.today) h += '<div class="dbnote">The ' + esc(dbDate(l.paidThrough)) + ' payment is already paid.</div>';
    if (l.maturity) h += '<div class="dbnote">Matures ' + esc(l.maturity) + '</div>';
    if (l.status === 'ESTIMATE') h += dbNeedBox(D, id, refs);
    return h + '</div>';
  }
  function debtSection() {
    var st = state.debt || { s: 'load' }, D = st.d, sh = dbSheet(D);
    if (st.s === 'na') return dbFallback('debt', 'debtsec', 'Debt', 'Debt is not available yet (server update pending). The loans are in Finances \u203a Overview.', 'na');
    if (!D) return st.s === 'err' ? dbFallback('debt', 'debtsec', 'Debt', 'Could not load debt' + (st.msg ? ': ' + esc(st.msg) : '') + '.', 'err')
      : dbFallback('debt', 'debtsec', 'Debt', 'Loading debt\u2026', 'load');
    var body = '', docAttr = D.docUrl ? ' data-doc="' + esc(D.docUrl) + '" data-title="' + esc(D.docTitle) + '"' : goAttr('fin/overview');
    if (!D.loans.length) {
      body = sh ? '<div class="foot">No loans on the Debts tab yet.</div>' + dbTabBtn(D, 'debts') : '<div class="foot">No loan balances found in the Overview Doc.</div>' + dbDocBtn(D);
      return vSec('debt', 'debtsec', 'Debt', '<span class="amt-neutral">n/a</span>', '', body, sh ? goAttr(dbRoute('total')) : docAttr);
    }
    var sumRow = function (label, html, badge) { return '<div class="dbsumrow"><span>' + label + (badge ? ' ' + badge : '') + '</span><b>' + html + '</b></div>'; };
    body += '<div class="dbsum">' +
      sumRow('Total debt', dbVal(D, balMoney(D.totalDebt), dbRoute('total'), D.docUrl, D.docTitle, 'amt-neutral'), dbBadge(D.totalDebtStatus, 'tot-debt')) +
      sumRow('Monthly debt service', dbVal(D, money(D.totalMonthly), dbRoute('service'), D.docUrl, D.docTitle, 'amt-out'), dbBadge(D.totalMonthlyStatus, 'tot-mo')) +
      (D.monthlyAfter && D.monthlyAfter.from > D.today ? '<div class="dbnote">From ' + esc(dbDate(D.monthlyAfter.from)) + ': <span class="amt-out">' + money(D.monthlyAfter.amount) + '</span> / mo</div>' : '') +
      '</div>';
    if (D.totalDebtStatus === 'ESTIMATE' || D.totalMonthlyStatus === 'ESTIMATE') body += dbNeedBox(D, 'tot-debt', null) + dbNeedBox(D, 'tot-mo', null);
    body += D.loans.map(function (l) { return loanCard(l, D); }).join('');
    if (sh) body += '<div class="foot how">Read from the Debts tab of the spend sheet each time the Vault opens. Next due dates are worked out from each loan\u2019s due day. Tap a number to see the rows behind it.</div>' + dbTabBtn(D, 'debts');
    else body += '<div class="foot how">Read from the Overview Doc each time the Vault opens. Next due dates are worked out from each loan\u2019s payment day.</div>' + dbDocBtn(D);
    return vSec('debt', 'debtsec', 'Debt', '<span class="amt-neutral">' + balMoney(D.totalDebt) + '</span>', '', body, sh ? goAttr(dbRoute('total')) : docAttr);
  }
  function billRow(b, D) {
    var sh = dbSheet(D), link = b.srcLinks[0] ? b.srcLinks[0].url : D.docUrl, title = b.srcLinks[0] ? b.srcLinks[0].label : D.docTitle, id = 'bill-' + b.id.replace(/[^\w-]/g, '_');
    var br = dbRoute('bill', b.id);
    var amt = b.amount == null ? '<span class="muted">n/a</span>' : b.viaEscrow ? '<span class="dbesc">' + dbVal(D, money(b.amount), br, link, title, 'amt-neutral') + '<small>via escrow</small></span>' : dbVal(D, money(b.amount), br, link, title, 'amt-gold');
    var meta = [b.kindLabel, b.entity].filter(Boolean).join(' \u00b7 ') + (sh && b.repeat && b.repeat !== 'One-time' ? ' \u00b7 ' + b.repeat : '');
    return '<div class="bill' + (b.overdue ? ' overdue' : '') + '"><div class="bdate"><b>' + esc(dbDate(b.date, true).replace(/^(\w+), /, '$1 ')) + '</b><small>' + esc(b.overdue ? 'overdue' : dbIn(b.daysUntil)) + '</small></div>' +
      '<div class="bmain"><span class="bname">' + esc(b.name) + '</span><small>' + esc(meta) + '</small>' + (sh ? dbDesc(b.description, 'bdesc') : '') +
      '<span class="bbadge">' + dbBadge(b.status, id) + '</span>' + (b.note ? '<small class="bnote">' + esc(b.note) + '</small>' : '') + '</div>' +
      '<div class="bamt">' + amt + '</div></div>' + (b.status === 'ESTIMATE' ? dbNeedBox(D, id, sh ? [b.ref, b.ref + ':payment'] : [b.ref]) : '');
  }
  function billsSection() {
    var title = 'Upcoming bills (next 30 days)', st = state.debt || { s: 'load' }, D = st.d, sh = dbSheet(D);
    if (st.s === 'na') return dbFallback('bills', 'billsec', title, 'Upcoming bills are not available yet (server update pending). Due dates are in Finances \u203a Overview.', 'na');
    if (!D) return st.s === 'err' ? dbFallback('bills', 'billsec', title, 'Could not load bills' + (st.msg ? ': ' + esc(st.msg) : '') + '.', 'err')
      : dbFallback('bills', 'billsec', title, 'Loading bills\u2026', 'load');
    var docAttr = D.docUrl ? ' data-doc="' + esc(D.docUrl) + '" data-title="' + esc(D.docTitle) + '"' : goAttr('fin/overview');
    var body = '<div class="foot sub-note">' + (D.windowEnd ? 'Through ' + esc(dbDate(D.windowEnd)) + ' \u00b7 ' : '') + D.bills.length + ' item' + (D.bills.length === 1 ? '' : 's') + ', soonest first</div>';
    if (!D.bills.length) body += '<div class="foot empty">Nothing due in the next ' + D.windowDays + ' days.</div>';
    body += D.bills.map(function (b) { return billRow(b, D); }).join('');
    if (D.bills.length) body += '<div class="bill total"><div class="bmain"><span class="bname">Total due' + (D.billsStatus ? ' ' : '') + '</span></div><div class="bamt">' + dbVal(D, money(D.billsTotal), dbRoute('bills'), D.docUrl, D.docTitle, 'amt-gold') + '</div></div>';
    if (D.undated.length) {
      if (sh) {
        body += '<div class="foot">Not scheduled yet (no due date on the Bills tab): ' + D.undated.map(function (u) { return esc(u.name); }).join(', ') +
          (D.undated.some(function (u) { return dbStat(u.status) === 'ESTIMATE'; }) ? ' <button class="badge est" data-db-est="undated">Estimate</button>' : '') + '</div>' +
          dbNeedBox(D, 'undated', D.undated.map(function (u) { return u.ref; }));
      } else {
        body += '<div class="foot">Not scheduled: ' + D.undated.map(function (u) { return esc(u.name); }).join(', ') + ' \u2013 only a per-month ' +
          (D.undated.some(function (u) { return dbStat(u.status) === 'ESTIMATE'; }) ? '<button class="badge est" data-db-est="undated">Estimate</button> ' : '') + 'is in the Doc, no due date.</div>' +
          dbNeedBox(D, 'undated', D.undated.map(function (u) { return u.ref; }));
      }
    }
    if (sh) body += balBtn('All Bills tab rows', dbRoute('bills'), 'linkrow smallrow') + dbTabBtn(D, 'bills') + dbTabBtn(D, 'debts', true);
    else body += dbDocBtn(D);
    return vSec('bills', 'billsec', title, '<span class="amt-gold">' + money(D.billsTotal) + '</span>', '', body, sh ? goAttr(dbRoute('bills')) : docAttr);
  }

  /* ---- Drill-down (#spend/debt/...): the Debts / Bills tab rows behind a number, each with its description ---- */
  function debtDrillTitle(sr) {
    var v = sr.val, a = sr.acct, st = state.debt, D = st && st.d, ent = a && (v === 'total' || v === 'service' || v === 'bills') ? ' \u00b7 ' + a : '';
    if (v === 'total') return 'Debt' + ent;
    if (v === 'service') return 'Monthly debt service' + ent;
    if (v === 'bills') return 'Upcoming bills' + ent;
    if (v === 'loan') { var l = D ? D.loans.filter(function (x) { return x.key === a; })[0] : null; return l ? l.name : 'Debt'; }
    if (v === 'bill') { var b = D ? D.bills.filter(function (x) { return x.id === a; })[0] : null; return b ? b.name : 'Bill'; }
    return 'Debt';
  }
  function dbStatic(status) {
    status = dbStat(status);
    return '<span class="badge ' + (status === 'VERIFIED' ? 'ok' : status === 'DERIVED' ? 'dv' : '') + '">' + (status === 'VERIFIED' ? 'Verified' : status === 'DERIVED' ? 'Derived' : 'Estimate') + '</span>';
  }
  function dbKv(label, html) { return html ? '<div class="dbrow"><span class="dbl">' + label + '</span><span class="dbv">' + html + '</span></div>' : ''; }
  // one Debts tab row (raw row from D.rows.debts) as a card; `focus` = 'balance' | 'payment' | ''
  function dbDebtRowCard(r, D, focus) {
    var loan = D.loans.filter(function (l) { return l.rowNum === r.rowNum; })[0];
    var h = '<div class="dbcard"><div class="dbtop"><div class="dbname">' + esc(r.name) + '<small>' + esc([r.entity, r.lender].filter(Boolean).join(' \u00b7 ')) + '</small></div>' +
      dbStatic(focus === 'payment' ? r.paymentStatus : r.status) + '</div>' + dbDesc(r.description);
    h += dbKv('Balance' + (r.asOf ? ' <small>as of ' + esc(dbDate(r.asOf)) + '</small>' : ''), r.balance != null ? '<b class="amt-neutral' + (focus === 'balance' ? ' big2' : '') + '">' + balMoney(r.balance) + '</b>' : '');
    h += dbKv('Rate', r.rate != null ? '<b class="amt-neutral">' + esc(r.rate.toFixed(3)) + '%</b>' : '');
    h += r.rateNote ? '<div class="dbnote">' + esc(r.rateNote) + '</div>' : '';
    h += dbKv('Monthly payment', r.payment != null ? '<b class="amt-out' + (focus === 'payment' ? ' big2' : '') + '">' + money(r.payment) + '</b>' : '');
    if (r.payAfter != null) h += '<div class="dbnote">' + (r.payAfterFrom ? 'From ' + esc(dbDate(r.payAfterFrom)) + ': ' : 'After the reset: ') + '<span class="amt-out">' + money(r.payAfter) + '</span> / mo</div>';
    h += dbKv('Due', loan && loan.nextDue ? '<b>' + esc(dbDate(loan.nextDue, true)) + '</b><small>' + esc(dbIn(loan.daysUntil)) + '</small>' : (r.dueDay ? 'Day ' + r.dueDay + ' of the month' : ''));
    h += dbKv('Matures', r.maturity ? esc(r.maturity) : '');
    h += r.notes ? '<div class="dbnote">' + esc(r.notes) + '</div>' : '';
    return h + '<div class="foot how">Debts tab, row ' + r.rowNum + '</div></div>';
  }
  // one Bills tab row (raw row from D.rows.bills)
  function dbBillRowCard(r) {
    var h = '<div class="dbcard"><div class="dbtop"><div class="dbname">' + esc(r.name) + '<small>' + esc([r.kindLabel, r.entity, r.repeat].filter(Boolean).join(' \u00b7 ')) + '</small></div>' + dbStatic(r.status) + '</div>' + dbDesc(r.description);
    h += dbKv('Amount', r.amount != null ? '<b class="' + (r.viaEscrow ? 'amt-neutral' : 'amt-out') + '">' + money(r.amount) + '</b>' + (r.viaEscrow ? '<small>via escrow</small>' : '') : '<span class="muted">no amount yet</span>');
    h += dbKv(r.paid && r.repeat === 'One-time' ? 'Was due' : 'Next due', r.nextDue ? '<b>' + esc(dbDate(r.nextDue, true)) + '</b>' : r.due ? '<b>' + esc(dbDate(r.due, true)) + '</b>' : '<span class="muted">no due date yet</span>');
    if (r.paid) h += dbKv('Paid', '<b>' + (r.paidDate ? esc(dbDate(r.paidDate)) : 'yes') + '</b>');
    else if (r.paidDate) h += dbKv('Last paid', esc(dbDate(r.paidDate)));
    h += r.notes ? '<div class="dbnote">' + esc(r.notes) + '</div>' : '';
    return h + '<div class="foot how">Bills tab, row ' + r.rowNum + '</div></div>';
  }
  // a scheduled bill (from D.bills): loan payments show their Debts row, others their Bills row
  function dbBillDetail(b, D) {
    var rows = D.rows || {};
    if (b.tab === 'debts') {
      var dr = (rows.debts || []).filter(function (r) { return r.rowNum === b.rowNum; })[0];
      return '<div class="dbcard"><div class="dbtop"><div class="dbname">' + esc(b.name) + '<small>' + esc([b.kindLabel, b.entity].filter(Boolean).join(' \u00b7 ')) + '</small></div>' + dbStatic(b.status) + '</div>' + dbDesc(b.description) +
        dbKv('Due', '<b>' + esc(dbDate(b.date, true)) + '</b><small>' + esc(dbIn(b.daysUntil)) + '</small>') + dbKv('Amount', b.amount != null ? '<b class="amt-out">' + money(b.amount) + '</b>' : '') +
        (b.note ? '<div class="dbnote">' + esc(b.note) + '</div>' : '') + '<div class="foot how">Worked out from the Debts tab, row ' + b.rowNum + ' (the loan\u2019s due day). Repeats monthly.</div></div>' + (dr ? dbDebtRowCard(dr, D, 'payment') : '');
    }
    var br = (rows.bills || []).filter(function (r) { return r.rowNum === b.rowNum; })[0];
    return '<div class="dbcard"><div class="dbtop"><div class="dbname">' + esc(b.name) + '<small>' + esc([b.kindLabel, b.entity, b.repeat].filter(Boolean).join(' \u00b7 ')) + '</small></div>' + dbStatic(b.status) + '</div>' + dbDesc(b.description) +
      dbKv('Due', '<b>' + esc(dbDate(b.date, true)) + '</b><small>' + esc(b.overdue ? 'overdue' : dbIn(b.daysUntil)) + '</small>') +
      dbKv('Amount', b.amount != null ? '<b class="' + (b.viaEscrow ? 'amt-neutral' : 'amt-out') + '">' + money(b.amount) + '</b>' + (b.viaEscrow ? '<small>via escrow</small>' : '') : '') +
      (b.note ? '<div class="dbnote">' + esc(b.note) + '</div>' : '') + (br && br.notes ? '<div class="dbnote">' + esc(br.notes) + '</div>' : '') + '<div class="foot how">Bills tab, row ' + b.rowNum + '</div></div>';
  }
  function debtDrill() {
    var sr = state.spendRoute, st = state.debt || { s: 'load' }, D = st.d, v = sr.val, a = sr.acct, h = '';
    if (st.s === 'na') return '<div class="loading">Debt is not available yet (server update pending).</div>';
    if (!D) return st.s === 'err' ? '<div class="loading">Could not load debt' + (st.msg ? ': ' + esc(st.msg) : '') + '.</div><button class="linkrow smallrow" data-debt-retry="1">Try again</button>' : '<div class="loading">Loading\u2026</div>';
    if (!dbSheet(D)) return '<div class="loading">The row view needs the Debts and Bills tabs, which are not set up yet.</div><button class="linkrow smallrow" data-go="fin/overview">Open Finances \u203a Overview &rsaquo;</button>';
    var entF = function (x) { return !a || (v !== 'total' && v !== 'service' && v !== 'bills') || x.entity === a; };
    var rows = D.rows || { debts: [], bills: [] };
    if (v === 'total' || v === 'service') {
      var isT = v === 'total', list = rows.debts.filter(entF).filter(function (r) { return isT ? r.balance != null : r.payment != null; });
      var tot = r2(list.reduce(function (t, r) { return t + (isT ? r.balance : r.payment) || 0; }, 0));
      var stt = list.reduce(function (w, r) { var x = isT ? r.status : r.paymentStatus; return x === 'ESTIMATE' || w === 'ESTIMATE' ? 'ESTIMATE' : x === 'DERIVED' || w === 'DERIVED' ? 'DERIVED' : w; }, 'VERIFIED');
      h += '<div class="card dbd"><h3>' + (isT ? 'Total debt' : 'Monthly debt service') + (a ? ' \u00b7 ' + esc(a) : '') + '</h3><div class="big ' + (isT ? 'amt-neutral' : 'amt-out') + '">' + (isT ? balMoney(tot) : money(tot)) + '</div>' +
        '<div class="foot">' + dbStatic(stt) + ' ' + list.length + ' loan' + (list.length === 1 ? '' : 's') + (isT ? ' \u00b7 latest balance on each row, added up' : ' \u00b7 payment in force today on each row, added up') + '</div>' +
        '<div class="foot how">Source: the Debts tab of the spend sheet (one row per loan, each with a description).</div></div>';
      h += dbTabBtn(D, 'debts');
      if (!list.length) h += '<div class="foot empty">No rows on the Debts tab' + (a ? ' for ' + esc(a) : '') + '.</div>';
      list.forEach(function (r) { h += dbDebtRowCard(r, D, isT ? 'balance' : 'payment'); });
      return h;
    }
    if (v === 'loan') {
      var l = D.loans.filter(function (x) { return x.key === a; })[0], r = l ? rows.debts.filter(function (x) { return x.rowNum === l.rowNum; })[0] : null;
      if (!r) return '<div class="loading">That loan is no longer on the Debts tab.</div>' + dbTabBtn(D, 'debts');
      return dbDebtRowCard(r, D, '') + dbTabBtn(D, 'debts');
    }
    if (v === 'bill') {
      var b = D.bills.filter(function (x) { return x.id === a; })[0];
      if (!b) return '<div class="loading">That bill is no longer in the next ' + D.windowDays + ' days.</div>' + dbTabBtn(D, 'bills');
      return dbBillDetail(b, D) + dbTabBtn(D, b.tab === 'debts' ? 'debts' : 'bills');
    }
    // bills (all entities, or one)
    var due = D.bills.filter(entF), counted = due.filter(function (b) { return !b.viaEscrow && b.amount != null; }), btot = r2(counted.reduce(function (t, b) { return t + b.amount; }, 0));
    var bst = counted.reduce(function (w, b) { return b.status === 'ESTIMATE' || w === 'ESTIMATE' ? 'ESTIMATE' : b.status === 'DERIVED' || w === 'DERIVED' ? 'DERIVED' : w; }, 'VERIFIED');
    h += '<div class="card dbd"><h3>Upcoming bills' + (a ? ' \u00b7 ' + esc(a) : '') + '</h3><div class="big amt-gold">' + money(btot) + '</div>' +
      '<div class="foot">' + dbStatic(bst) + ' ' + due.length + ' item' + (due.length === 1 ? '' : 's') + ' due through ' + esc(dbDate(D.windowEnd)) + '</div>' +
      '<div class="foot how">Source: the Bills tab (insurance, taxes, other bills) and the Debts tab (loan payments, by due day) of the spend sheet. Items paid through escrow are listed but not added up.</div></div>';
    h += dbTabBtn(D, 'bills') + dbTabBtn(D, 'debts', true);
    if (!due.length) h += '<div class="foot empty">Nothing due in the next ' + D.windowDays + ' days.</div>';
    due.forEach(function (b) {
      h += '<button class="linkrow billsyn"' + goAttr(dbRoute('bill', b.id)) + '><span class="bsl"><b>' + esc(b.name) + '</b><small>' + esc([dbDate(b.date, true), b.entity].filter(Boolean).join(' \u00b7 ')) + '</small></span><span class="amt-gold">' + (b.amount == null ? 'n/a' : money(b.amount)) + '</span><i class="chev">&rsaquo;</i></button>';
    });
    var inIds = {}; due.forEach(function (b) { if (b.tab === 'bills') inIds[b.rowNum] = 1; });
    var others = rows.bills.filter(entF).filter(function (r) { return !inIds[r.rowNum]; });
    var sched = others.filter(function (r) { return r.nextDue && !(r.paid && r.repeat === 'One-time'); }), nodate = others.filter(function (r) { return !r.nextDue && !r.paid; }), paid = others.filter(function (r) { return r.paid && r.repeat === 'One-time'; });
    if (sched.length) { h += '<h4 class="dbh">Later (not due in the next ' + D.windowDays + ' days)</h4>'; sched.forEach(function (r) { h += dbBillRowCard(r); }); }
    if (nodate.length) { h += '<h4 class="dbh">Not scheduled yet (no due date)</h4>'; nodate.forEach(function (r) { h += dbBillRowCard(r); }); }
    if (paid.length) { h += '<h4 class="dbh">Paid</h4>'; paid.forEach(function (r) { h += dbBillRowCard(r); }); }
    return h;
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-debt-retry]');
    if (r) { loadDebt(true); if (state.spendData) renderSpend(); return; }
    var est = e.target.closest('[data-db-est]');
    if (est) { var box = document.getElementById('dbneed-' + est.getAttribute('data-db-est')); if (box) box.hidden = !box.hidden; return; }
    var dl = e.target.closest('[data-doc]');
    if (dl) { e.preventDefault(); e.stopPropagation(); openDoc(dl.getAttribute('data-doc'), dl.getAttribute('data-title') || 'Document'); }
  });

  // Drill-down: the balance entries behind a number (All / one group / one account), straight from the Balances tab, + reconciliation detail for a group.
  function balDrill() {
    var sr = state.spendRoute, st = state.acct || { s: 'load' }, A = st.d, h = '';
    if (st.s === 'na') return '<div class="loading">Account balances are not available yet (server update pending).</div>' + sheetLink('Open in spend sheet (Balances tab)', 'bal');
    if (!A) return st.s === 'err' ? '<div class="loading">Could not load accounts.</div><button class="linkrow smallrow" data-acct-retry="1">Try again</button>' : '<div class="loading">Loading\u2026</div>';
    var isG = /^g:/.test(sr.val), gname = isG ? sr.val.slice(2) : '', all = sr.val === 'All';
    var list = A.accounts.filter(function (a) { return all || (isG ? a.group === gname : a.name === sr.val); });
    var isInv = false;
    if (!list.length && !all && (A.investments || []).length) {   // Investments (Overview): one account, or the whole set via g:Investments
      list = A.investments.filter(function (a) { return isG ? isInvGroup(gname) : a.name === sr.val; });
      isInv = list.length > 0;
    }
    if (!list.length) return '<div class="loading">No such account.</div>' + sheetLink('Open in spend sheet (Balances tab)', 'bal', A.gid);
    var total = r2(list.reduce(function (t, a) { return t + (a.balance || 0); }, 0));
    var label = all ? 'All accounts' : isInv ? (isG ? 'Investments' : 'Investment account') : isG ? gname + ' accounts' : 'Account';
    h += '<div class="card acdrill"><h3>' + esc(label) + '</h3><div class="big amt-bal">' + balMoney(total) + '</div>' +
      '<div class="foot">' + list.length + ' account' + (list.length === 1 ? '' : 's') + ' \u00b7 latest balance entry for each, summed' + (isInv ? ' \u00b7 shown in the Overview, not in the Vault Accounts total' : '') + '</div>' +
      '<div class="foot how">Source: the Balances tab of the spend sheet (one row per account per statement date).</div></div>';
    h += sheetLink('Open in spend sheet (Balances tab)', 'bal', A.gid);
    list.forEach(function (a) {
      h += '<div class="card acdrill"><h3>' + esc(a.name) + ' <small>' + esc([a.bank, a.type].filter(Boolean).join(' \u00b7 ')) + '</small></h3>';
      if (!a.entries.length) h += '<div class="foot">No balance entered yet.</div>';
      a.entries.forEach(function (e, i) {
        h += '<div class="icrow"><span class="icd">' + esc(acDate(e.date)) + '</span><span class="icc">' +
          (acMonthEnd(e.date) ? '' : '<span class="acflag">not month end</span> ') + esc(e.notes) + (i === 0 ? ' <small class="muted">(latest)</small>' : '') +
          '</span><span class="amt amt-bal">' + balMoney(e.balance) + '</span></div>';
      });
      if (a.change != null) h += '<div class="foot">Change: ' + balMoney(a.balance) + ' \u2212 ' + balMoney(a.prevBalance) + ' = <b class="amt-bal">' + balSigned(a.change) + '</b></div>';
      else if (a.entries.length) h += '<div class="foot">Change: need next statement</div>';
      h += '</div>';
    });
    if (isG && !isInv) {
      var r = A.recon.filter(function (x) { return x.group === gname; })[0];
      if (r && (r.status === 'ok' || r.status === 'gap')) {
        h += '<div class="card acdrill"><h3>Reconciliation \u00b7 ' + esc(gname) + ' <small>' + esc(acDate(r.periodStart)) + ' \u2192 ' + esc(acDate(r.periodEnd)) + '</small></h3>' +
          '<div class="sumline"><span>Balance change</span><b class="amt-bal">' + balSigned(r.balanceChange) + '</b></div>' +
          '<div class="sumline"><span>Income</span><b class="amt-in">' + money(r.income) + '</b></div>' +
          '<div class="sumline"><span>Spend</span><b class="amt-out">' + money(r.spend) + '</b></div>' +
          '<div class="sumline"><span>Gap (change \u2212 (income \u2212 spend))</span><b class="' + (r.status === 'gap' ? 'warnv' : 'amt-bal') + '">' + balSigned(r.gap) + '</b></div>' +
          '<div class="foot how">' + (r.status === 'gap' ? 'Gap is above $' + (r.tolerance || 0) + ': transfers, cash, card payments or entries not yet logged can explain it.' : 'Within $' + (r.tolerance || 0) + ' of what logged income and spend explain.') + '</div></div>';
        if ((r.incomeItems || []).length) h += '<div class="card income"><h3>Income entries \u00b7 ' + r.incomeItems.length + '</h3>' +
          r.incomeItems.map(function (x) { return '<div class="icrow"><span class="icd">' + esc(x.label || x.date) + '</span><span class="icc">' + esc(x.source + (x.client ? ' \u00b7 ' + x.client : '')) +
            '</span><span class="amt amt-in">' + money(x.amount) + '</span></div>'; }).join('') + '</div>';
        if ((r.spendItems || []).length) h += '<div class="card"><h3>Spend entries \u00b7 ' + r.spendItems.length + '</h3>' +
          r.spendItems.map(function (x) { return '<div class="icrow"><span class="icd">' + esc(x.label || x.date) + '</span><span class="icc">' + esc(x.merchant || x.category) +
            '</span><span class="amt amt-out">' + money(x.amount) + '</span></div>'; }).join('') + '</div>';
        h += sheetLink('Open in spend sheet (Daily Spend tab)');
      } else {
        h += '<div class="card acdrill"><h3>Reconciliation \u00b7 ' + esc(gname) + '</h3><div class="recneed"><b>Needs a second month of statements</b>' +
          esc(r && r.message ? r.message : 'Needs a second balance date for every account in this group.') + '</div></div>';
      }
    }
    return h;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-acct-retry]')) { loadAccounts(true); if (state.spendData) renderSpend(); }
  });

  function renderSpend() {
    var d = state.spendData, M = spendModel(d), sr = state.spendRoute;
    VENT = {}; ventN = 0;
    paintSpendChrome();
    $('spend-month').textContent = d.monthLabel;
    var h = '';
    var days = periodDays(d.monthOffset != null ? Number(d.monthOffset) : state.spendDataOff);
    var perDay = function (v) { return days > 0 ? money(v / days) : '—'; };
    var acctTot = function (n) { var a = M.accounts.filter(function (x) { return x.name === n; })[0]; return a ? a.amount : 0; };
    var srcTot = function (n) { var x = M.sources.filter(function (y) { return y.name === n; })[0]; return x ? x.amount : 0; };
    var inAcct = function (n) { return M.items.filter(function (x) { return x.account === n; }); };
    var hhGroc = M.items.filter(function (x) { return x.account === 'Household' && x.category === 'Groceries'; });
    var groc = sum(hhGroc);
    var srcList = function (n) { return M.income.filter(function (x) { return x.source === n; }); };
    var hhTot = acctTot('Household');
    var cashOK = M.full;   // cash needs the full item list (older API only has the latest 20 rows)
    if (!sr.kind || sr.kind === 'bal') loadAccounts(false);
    if (!sr.kind || sr.kind === 'debt') loadDebt(false);

    if (!sr.kind) {
      // Income group: one collapsible card per source (heading + green total; heading toggles, total drills down), then Total income.
      h += vgHead('inc', 'Income', 'inc', '<span>Total income</span><b class="amt-in">' + money(M.incomeTotal) + '</b>');
      h += '<div class="incgroup">';
      M.sources.forEach(function (sx) {
        var l = M.income.filter(function (x) { return x.source === sx.name; });
        var ds = DETAIL_SRC[sx.name];
        var isLT = sx.name === INCOME_SOURCES[0];
        var b = incCompact(l, !!ds, isLT ? M.superseded : null) + (isLT ? olNoteHtml(M) : '') +
          sheetLink('Open in spend sheet', ds ? ds.tab : 'income', ds && ds.tab === 'ls' ? M.lsGid : '');
        h += vSec('inc-' + sx.name, 'income incsrc', esc(sx.label), '<span class="amt-in">' + money(sx.amount) + '</span>', incomeRoute(sx.name), b);
      });
      h += vSec('inc-total', 'income', 'Total income', '<span class="amt-in">' + money(M.incomeTotal) + '</span>', incomeRoute('All'), '<div class="foot">Sum of the income sources above.</div>');
      h += '</div>';
      h += vgEnd();

      h += vgHead('exp', 'Expenses', 'exp', '<span>Total spent</span><b class="amt-out">' + money(M.total) + '</b>');
      M.accounts.forEach(function (a) {
        var b = '';
        if (!a.cats.length) b += '<div class="foot empty">No entries this month</div>';
        var mine = inAcct(a.name);
        b += barRows(a.cats, function (c) { return catRoute(c, a.name); }, '',
          cashOK ? function (c) { return { v: cashOf(mine.filter(function (x) { return x.category === c; })), route: cashRoute(a.name, c) }; } : null);
        if (cashOK) b += '<div class="cashtot">' + cashBtn(cashOf(mine), cashRoute(a.name)) + '</div>';
        b += totBtn(a.name + ' total', a.amount, acctRoute(a.name)).replace('totrow tapt', 'totrow tapt' + (cashOK ? ' hascash' : ''));
        h += vSec('acct-' + a.name, 'acctsec', esc(a.name), '<span class="amt-out">' + money(a.amount) + '</span>', acctRoute(a.name), b);
      });

      h += vSec('total', 'grand', 'Total spent', '<span class="amt-out">' + money(M.total) + '</span>', 'spend/all',
        (cashOK ? '<div class="cashtot">' + cashBtn(cashOf(M.items), cashRoute('All')) + '</div>' : '') +
        '<button class="footbtn"' + goAttr('spend/all') + '>' + M.entryCount + ' entries' +
        (M.daysLogged != null ? ' \u00b7 ' + M.daysLogged + ' days logged' : '') + ' &rsaquo;</button>');
      h += vgEnd();

      var netLine = function (key, label, inc, sp, spLbl) {
        var n = r2(inc - sp);
        return sumBtn('net cmp', calcRoute(key), esc(label) + '<small>Income <span class="amt-in">' + money(inc) + '</span> − ' + spLbl + ' <span class="amt-out">' + money(sp) + '</span></small>',
          '<span class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signedMoney(n) + '</span>');
      };
      var monthNet = r2(M.incomeTotal - M.total);
      var sumBody = '<div class="foot sub-note">Over ' + days + ' day' + (days === 1 ? '' : 's') + '</div>' +
        sumBtn('', incomeRoute('All'), 'Total income', '<span class="amt amt-in">' + money(M.incomeTotal) + '</span>') +
        sumBtn('', 'spend/all', 'Total spend', '<span class="amt amt-out">' + money(M.total) + '</span>') +
        sumBtn('minor', calcRoute('avg-income'), 'Avg daily income', '<span class="amt amt-in">' + perDay(M.incomeTotal) + '</span>') +
        sumBtn('minor', calcRoute('avg-spend'), 'Avg daily spend', '<span class="amt amt-out">' + perDay(M.total) + '</span>') +
        netLine('tiwik-net', 'TiwiK net', srcTot('Mono Village Laundromat'), acctTot('TiwiK'), 'Spent') +
        netLine('lt-net', "Lisa's Table net", srcTot("Lisa's Table"), groc, 'Groceries') +
        sumBtn('net cmp', calcRoute('hh-spend'), 'Household spend<small>Running month total · excludes groceries (counted in Lisa\'s Table net)</small>',
          '<span class="amt neg">\u2212' + money(Math.abs(r2(hhTot - groc))) + '</span>');
      h += vgHead('sum', 'Summary', '', '<span>Net this month</span><b class="amt ' + (monthNet >= 0 ? 'pos' : 'neg') + '">' + signedMoney(monthNet) + '</b>');
      h += vSec('summary', 'summary', 'Summary', '<span class="amt ' + (monthNet >= 0 ? 'pos' : 'neg') + '">' + signedMoney(monthNet) + '</span>', calcRoute('month-net'), sumBody);
      h += vgEnd();


      if (d.missingColumns && d.missingColumns.length) h += '<div class="foot">Columns not found: ' + esc(d.missingColumns.join(', ')) + '</div>';

    } else if (sr.kind === 'bal') {
      h += balDrill();

    } else if (sr.kind === 'debt') {
      h += debtDrill();

    } else if (sr.kind === 'income') {
      var all = sr.val === 'All', src = normSource(sr.val);
      var ds = !all && DETAIL_SRC[src], isPT = !!ds;
      var inc = all ? M.income : M.income.filter(function (x) { return x.source === src; });
      var unit = isPT ? ds.unit : all ? 'entr' : 'week';
      var hasLS = M.income.some(function (x) { return x.source === LS_SOURCE; });
      h += '<div class="card income"><h3>' + (all ? 'Income total' : isPT ? esc(ds.title) : 'Income') + '</h3><div class="big amt-in">' + money(sum(inc)) + '</div>' +
        '<div class="foot">' + inc.length + ' ' + (all ? (inc.length === 1 ? 'entry' : 'entries') : unit + (inc.length === 1 ? '' : 's')) +
        (all ? ' · ' + M.sources.filter(function (s) { return s.count; }).map(function (s) { return esc(s.label) + ' ' + money(s.amount); }).join(' · ') : '') +
        '</div><div class="foot how">Source: ' + (isPT ? 'the ' + esc(ds.tabName) + ' tab (' + ds.what + ') of the spend sheet.'
          : 'the Income tab (weekly lump sums), the Personal Training tab (client payments)' + (hasLS ? ' and the Land &amp; Structure Pay tab' : '') + ' of the spend sheet.') +
          (isPT ? '' : ' Lisa\u2019s Table income is live from the Orders summary (paid orders only), not typed in.') + '</div></div>';
      h += sheetLink('Open in spend sheet' + (isPT ? ' (' + ds.tabName + ' tab)' : ' (Income tab)'), isPT ? ds.tab : 'income', isPT && ds.tab === 'ls' ? M.lsGid : '');
      if (all) {
        h += sheetLink('Open Personal Training tab', 'pt').replace('linkrow sheetbtn', 'linkrow sheetbtn second');
        if (hasLS) h += sheetLink('Open Land & Structure Pay tab', 'ls', M.lsGid).replace('linkrow sheetbtn', 'linkrow sheetbtn second');
      }
      h += '<div class="card income">' + incomeRows(inc, all) + '</div>';
      if (all || src === INCOME_SOURCES[0]) h += olNoteHtml(M) + (M.superseded.length ? '<div class="card income">' + olSupRows(M.superseded) + '</div>' : '');

    } else if (sr.kind === 'calc') {
      var key = sr.val, c = null;
      var allInc = M.income;
      var daysNote = 'days = ' + days + ' (day of the month so far for the current month; whole month for past months)';
      var part = function (label, valHtml, route, kind) {
        var inner = '<span>' + label + '</span><span class="amt' + (kind ? ' amt-' + kind : '') + '">' + valHtml + '</span>' + (route ? '<span class="chev">&rsaquo;</span>' : '');
        return route ? '<button class="calcpart"' + goAttr(route) + '>' + inner + '</button>' : '<div class="calcpart">' + inner + '</div>';
      };
      if (key === 'tiwik-net') {
        var ti = srcList('Mono Village Laundromat'), ts = inAcct('TiwiK'), n1 = r2(sum(ti) - sum(ts));
        c = { val: n1, note: 'Mono Village Laundromat income − everything spent from the TiwiK account (cash and non-cash).',
          parts: part('Income · Mono Village Laundromat', money(sum(ti)), incomeRoute('Mono Village Laundromat'), 'in') +
            part('Spent · TiwiK', '\u2212' + money(sum(ts)), acctRoute('TiwiK'), 'out') +
            (cashOK ? part('&nbsp;&nbsp;of which Cash', money(cashOf(ts)), cashRoute('TiwiK')) : ''),
          secs: [{ head: 'Income entries', inc: ti }, { head: 'TiwiK spend entries', sp: ts }] };
      } else if (key === 'lt-net') {
        var li = srcList("Lisa's Table"), n2 = r2(sum(li) - groc);
        c = { val: n2, note: 'Lisa\'s Table income − Household Groceries (cash and non-cash).',
          parts: part("Income · Lisa's Table", money(sum(li)), incomeRoute("Lisa's Table"), 'in') +
            part('Groceries · Household', '\u2212' + money(groc), catRoute('Groceries', 'Household'), 'out') +
            (cashOK ? part('&nbsp;&nbsp;of which Cash', money(cashOf(hhGroc)), cashRoute('Household', 'Groceries')) : ''),
          secs: [{ head: 'Income entries', inc: li }, { head: 'Household Groceries entries', sp: hhGroc }] };
      } else if (key === 'hh-spend') {
        var hhNoG = M.items.filter(function (x) { return x.account === 'Household' && x.category !== 'Groceries'; });
        c = { val: -sum(hhNoG), neg: true, note: 'Household total − Household Groceries (groceries are counted in Lisa\'s Table net). Cash and non-cash.',
          parts: part('Household total', money(hhTot), acctRoute('Household'), 'out') +
            part('Groceries (in Lisa\'s Table net)', '\u2212' + money(groc), catRoute('Groceries', 'Household'), 'out') +
            part('= Household spend', money(sum(hhNoG)), '', 'out'),
          secs: [{ head: 'Household entries excluding Groceries', sp: hhNoG }] };
      } else if (key === 'month-net') {
        var mn = r2(M.incomeTotal - M.total);
        c = { val: mn, note: 'Income total \u2212 Total spent. All income sources and all accounts, cash and non-cash.',
          parts: part('Income total', money(M.incomeTotal), incomeRoute('All'), 'in') + part('Total spent', '\u2212' + money(M.total), 'spend/all', 'out'),
          secs: [{ head: 'All income entries', inc: allInc }, { head: 'All spend entries', sp: M.items }] };
      } else if (key === 'avg-spend') {
        c = { valHtml: perDay(M.total), cls: 'amt-out', note: 'Total spent ÷ days. All accounts, cash and non-cash; ' + daysNote + '.',
          parts: part('Total spent', money(M.total), 'spend/all', 'out') + part('Days', String(days), ''),
          secs: [{ head: 'All spend entries', sp: M.items }] };
      } else if (key === 'avg-income') {
        c = { valHtml: perDay(M.incomeTotal), cls: 'amt-in', note: 'Income total ÷ days. All income sources incl. Personal Training and Land & Structure Pay; ' + daysNote + '.',
          parts: part('Income total', money(M.incomeTotal), incomeRoute('All'), 'in') + part('Days', String(days), ''),
          secs: [{ head: 'All income entries', inc: allInc }] };
      }
      if (!c) {
        h += '<div class="loading">Unknown figure.</div>';
      } else {
        var valHtml = c.valHtml || (c.neg ? '\u2212' + money(Math.abs(c.val)) : signedMoney(c.val));
        var vcls = c.cls || (c.val >= 0 && !c.neg ? 'pos' : 'neg');
        h += '<div class="card calc"><h3>' + esc(CALC_LABELS[key]) + ' <small>(over ' + days + ' day' + (days === 1 ? '' : 's') + ')</small></h3>' +
          '<div class="big ' + vcls + '">' + valHtml + '</div>' +
          '<div class="foot how"><b>How it is computed:</b> ' + esc(c.note) + '</div>' +
          '<div class="calcparts">' + c.parts + '</div></div>';
        h += sheetLink('Open in spend sheet');
        c.secs.forEach(function (s) {
          h += '<div class="card' + (s.inc ? ' income' : '') + '"><h3>' + esc(s.head) + ' · ' + (s.inc ? s.inc.length : s.sp.length) + ' · ' +
            money(s.inc ? sum(s.inc) : sum(s.sp)) + '</h3>' +
            (s.inc ? incomeRows(s.inc, true) : itemRows(s.sp, { chip: false, acct: true })) + '</div>';
        });
      }

    } else if (sr.kind === 'cash') {
      var cAcct = sr.val && sr.val !== 'All' ? sr.val : '', cCat = sr.acct || '';
      var scope = M.items.filter(function (x) { return (!cAcct || x.account === cAcct) && (!cCat || x.category === cCat); });
      var cl = scope.filter(isCash), scopeName = (cAcct || 'All accounts') + (cCat ? ' · ' + cCat : '');
      var scopeRoute = cCat ? catRoute(cCat, cAcct) : cAcct ? acctRoute(cAcct) : 'spend/all';
      h += '<div class="card"><h3>Cash spent · ' + esc(scopeName) + '</h3><div class="big amt-out">' + money(sum(cl)) + '</div>' +
        '<div class="foot">' + cl.length + ' cash entr' + (cl.length === 1 ? 'y' : 'ies') + ' · Method = Cash</div>' +
        '<div class="foot how">This is the cash part of the ' + esc(scopeName) + ' total of ' + money(sum(scope)) +
        ' — already included in that number, not added on top.</div>' +
        '<button class="linkrow smallrow"' + goAttr(scopeRoute) + '>See all ' + esc(scopeName) + ' spend (' + money(sum(scope)) + ') &rsaquo;</button></div>';
      h += sheetLink('Open in spend sheet');
      h += '<div class="card">' + (cashOK ? itemRows(cl, { chip: !cCat, acct: !cAcct }) : '<div class="foot">Cash detail needs the full item list (server update pending).</div>') + '</div>';

    } else {
      var list, label, total, extra = '', opt;
      if (sr.kind === 'cat') {
        list = M.items.filter(function (x) { return x.category === sr.val && (!sr.acct || x.account === sr.acct); });
        label = sr.acct ? sr.acct + ' · category' : 'Category';
        opt = { chip: false, acct: !sr.acct };
        total = sum(list);
        if (M.truncated) {
          var ac = M.accounts.filter(function (a) { return a.name === (sr.acct || 'Household'); })[0];
          var ct = ac && ac.cats.filter(function (c2) { return c2.name === sr.val; })[0];
          if (ct) total = ct.amount;
        }
        var byA = sortedPairs(sumBy(list, 'account'));
        if (!sr.acct && byA.length > 1) extra = byA.map(function (a) { return esc(a.name) + ' ' + money(a.amount); }).join(' · ');
      } else if (sr.kind === 'acct') {
        list = M.items.filter(function (x) { return x.account === sr.val; });
        label = 'Account';
        opt = { chip: true, acct: false };
        var at = M.accounts.filter(function (a) { return a.name === sr.val; })[0];
        total = at ? at.amount : sum(list);
      } else if (sr.kind === 'who') {
        list = M.items.filter(function (x) { return x.account === 'Household' && x.who === sr.val; });
        label = 'Household · paid by ' + sr.val; opt = { chip: true, acct: false }; total = sum(list);
      } else {
        list = M.items; label = 'All accounts'; opt = { chip: true, acct: true }; total = M.total;
      }
      h += '<div class="card"><h3>' + esc(label) + '</h3><div class="big amt-out">' + money(total) + '</div>' +
        '<div class="foot">' + list.length + ' item' + (list.length === 1 ? '' : 's') + (extra ? ' · ' + extra : '') +
        ' · all payment methods (cash included)</div>' +
        (cashOK ? '<div class="cashtot left">' + cashBtn(cashOf(list), sr.kind === 'cat' ? cashRoute(sr.acct, sr.val) : sr.kind === 'acct' ? cashRoute(sr.val) :
          sr.kind === 'who' ? cashRoute('Household') : cashRoute('All')) + '</div>' : '') + '</div>';
      h += sheetLink('Open in spend sheet');
      h += '<div class="card">' + itemRows(list, opt) + truncNote(M) + '</div>';
    }
    $('spend-body').innerHTML = h;
  }

  $('spend-body').addEventListener('click', function (e) {
    var t = e.target.closest('.vtoggle');
    if (!t) return;
    var c = t.closest('.vsec'), key = c.getAttribute('data-vs'), open = !c.classList.contains('open');
    c.classList.toggle('open', open);
    var tg = c.querySelector('.vtoggle'); if (tg) tg.setAttribute('aria-expanded', open);
    vOpenMap()[key] = open;
  });
  $('spend-prev').addEventListener('click', function () { state.monthOffset--; loadSpend(true); });
  $('spend-next').addEventListener('click', function () { state.monthOffset++; loadSpend(true); });

  /* ---------------- Entity books: KiwiT LLC + TiwiK LLC (API actions `entity`, `entitytax`) ---------------- */
  // Two SEPARATE sets of books for tax separation. The Vault above stays the combined view and is not touched.
  // Routes: #ent/<kiwit|tiwik> (Ledger tab), #ent/<key>/docs (Business Documents tab), #ent/<key>/cat/<Category>, /income/<Source|All>, /exp, /net, /bal, /flags, /tax
  // No figures live in this file: everything is fetched at runtime (public repo). Loans / bills reuse the Vault's `vaultdebt` data
  // (filtered by entity), so they keep working even before the `entity` action is deployed.
  // Colors: income green, spend red (same as the Vault), copper accents, balances teal, loans amber.
  var ENTS = { kiwit: { key: 'kiwit', name: 'KiwiT', title: 'KiwiT LLC', sub: 'Landlord \u00b7 Mono Way building' },
               tiwik: { key: 'tiwik', name: 'TiwiK', title: 'TiwiK LLC', sub: 'Operator \u00b7 Mono Village Laundromat' } };
  var ENT_SUBS = /^(cat|income|exp|net|bal|flags|tax)$/;
  var ENT_TTL = 60000;
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  state.entRoute = { key: '', kind: '', val: '', tab: '' };
  state.entOff = 0; state.entCache = {}; state.entTaxCache = {}; state.entYear = new Date().getFullYear();

  function entHash(er) {
    if (!er.kind && er.tab === 'docs') return '#ent/' + er.key + '/docs';
    return '#ent/' + er.key + (er.kind ? '/' + er.kind + (er.val ? '/' + encodeURIComponent(er.val) : '') : '');
  }
  function entRoute(key, kind, val) { return 'ent/' + key + (kind ? '/' + kind + (val != null && val !== '' ? '/' + encodeURIComponent(val) : '') : ''); }
  function entLocalMonth(off) { var t = new Date(); return new Date(t.getFullYear(), t.getMonth() + off, 1, 12).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }

  function entModel(d) {
    var inc = (Array.isArray(d.income) ? d.income : []).map(function (x) {
      return { date: x.date || '', label: x.label || x.date || '', source: String(x.source || 'Other'), client: x.client || '', amount: Number(x.amount) || 0,
        notes: x.notes || '', expected: !!x.expected };
    });
    var exp = (Array.isArray(d.expenses) ? d.expenses : []).map(function (x) {
      return { date: x.date || '', label: x.label || x.date || '', who: x.who || '', amount: Number(x.amount) || 0, category: String(x.category || '').trim() || 'Other',
        merchant: x.merchant || '', method: x.method || '', notes: x.notes || '', account: x.account || '', paidFrom: x.paidFrom || '' };
    });
    var srcMap = sumBy(inc, 'source');
    var sources = Object.keys(srcMap).map(function (k) {
      var l = inc.filter(function (x) { return x.source === k; });
      return { name: k, amount: r2(srcMap[k]), items: l, expected: l.some(function (x) { return x.expected; }) };
    }).sort(function (a, b) { return b.amount - a.amount; });
    var flags = (Array.isArray(d.flags) ? d.flags : []).map(function (f) {
      return { date: f.date || '', label: f.label || f.date || '', merchant: f.merchant || '', category: f.category || '', amount: Number(f.amount) || 0,
        account: f.account || '', method: f.method || '', paidFrom: f.paidFrom || '', hasCol: d.paidFromColumn === true, kind: f.kind || 'tag', severity: f.severity === 'high' ? 'high' : 'low', suggest: f.suggest || '', why: f.why || '' };
    });
    var b = d.bank || {};
    var bank = { accounts: (Array.isArray(b.accounts) ? b.accounts : []).map(function (a) {
      return { name: a.name || '', bank: a.bank || '', type: a.type || '', purpose: a.purpose || '', balance: acNum(a.balance), asOf: a.asOf || '', stale: !!a.stale, notes: a.notes || '',
        prevBalance: acNum(a.prevBalance), prevAsOf: a.prevAsOf || '', change: acNum(a.change),
        entries: (Array.isArray(a.entries) ? a.entries : []).map(function (e) { return { date: e.date || '', balance: Number(e.balance) || 0, notes: e.notes || '' }; }) };
    }), total: acNum(b.total), gid: b.gid != null ? String(b.gid) : SHEET_GIDS.bal };
    var it = sum(inc), et = sum(exp);
    return { monthLabel: d.monthLabel || '', month: d.month || '', income: inc, exp: exp, sources: sources, cats: sortedPairs(sumBy(exp, 'category')),
      incomeTotal: it, expenseTotal: et, net: r2(it - et), scheduled: sum(inc.filter(function (x) { return x.expected; })), flags: flags, bank: bank,
      paidFromColumn: d.paidFromColumn === true ? true : (d.paidFromColumn === false ? false : null),
      reimburse: r2(sum(exp.filter(function (x) { return x.paidFrom === 'Household card/account'; }))), reimburseN: exp.filter(function (x) { return x.paidFrom === 'Household card/account'; }).length };
  }
  function entFail(err) {
    if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return null; }
    return friendly(err);
  }
  function entActive() { return $('screen-ent').classList.contains('active'); }

  function loadEnt(force) {
    var R = state.entRoute, E = ENTS[R.key];
    if (!E) return;
    paintEntChrome();
    if (!R.kind && R.tab === 'docs') return loadEntDocs(force);
    loadDebt(false);
    if (R.kind === 'tax') return loadEntTax(force);
    var ck = R.key + '|' + state.entOff, c = state.entCache[ck];
    if (!force && c && (c.s === 'load' || (c.at && Date.now() - c.at < ENT_TTL))) return renderEnt();
    var mine = state.entCache[ck] = { s: 'load', d: c && c.d ? c.d : null, at: 0 };
    renderEnt();
    apiRaw('entity', { entity: R.key, offset: state.entOff }).then(function (j) {
      if (state.entCache[ck] !== mine) return;
      if (j.error === 'bad_action') state.entCache[ck] = { s: 'na', d: null, at: Date.now() };
      else if (j.error) state.entCache[ck] = { s: 'err', d: mine.d, at: Date.now(), msg: j.message || ('Server error: ' + j.error) };
      else state.entCache[ck] = { s: 'ok', d: entModel(j.data || {}), at: Date.now() };
      if (entActive()) renderEnt();
    }, function (err) {
      if (state.entCache[ck] !== mine) return;
      var m = entFail(err); if (m === null) return;
      state.entCache[ck] = { s: 'err', d: mine.d, at: Date.now(), msg: m };
      if (entActive()) renderEnt();
    });
  }
  function loadEntTax(force) {
    var R = state.entRoute, ck = R.key + '|' + state.entYear, c = state.entTaxCache[ck];
    if (!force && c && (c.s === 'load' || (c.at && Date.now() - c.at < ENT_TTL))) return renderEnt();
    var mine = state.entTaxCache[ck] = { s: 'load', d: c && c.d ? c.d : null, at: 0 };
    renderEnt();
    apiRaw('entitytax', { entity: R.key, year: state.entYear }).then(function (j) {
      if (state.entTaxCache[ck] !== mine) return;
      if (j.error === 'bad_action') state.entTaxCache[ck] = { s: 'na', d: null, at: Date.now() };
      else if (j.error) state.entTaxCache[ck] = { s: 'err', d: mine.d, at: Date.now(), msg: j.message || ('Server error: ' + j.error) };
      else state.entTaxCache[ck] = { s: 'ok', d: entTaxModel(j.data || {}), at: Date.now() };
      if (entActive()) renderEnt();
    }, function (err) {
      if (state.entTaxCache[ck] !== mine) return;
      var m = entFail(err); if (m === null) return;
      state.entTaxCache[ck] = { s: 'err', d: mine.d, at: Date.now(), msg: m };
      if (entActive()) renderEnt();
    });
  }
  function entTaxModel(d) {
    var m = entModel({ income: (d.items || {}).income, expenses: (d.items || {}).expenses, flags: d.flags, paidFromColumn: d.paidFromColumn });
    var inc = d.income || {}, ex = d.expenses || {};
    return { year: Number(d.year) || state.entYear, through: Number(d.through) || 12, items: m, flags: m.flags,
      incomeTotal: Number(inc.total) || 0, scheduled: Number(inc.scheduled) || 0, expTotal: Number(ex.total) || 0, net: Number(d.net) || 0,
      sources: (Array.isArray(inc.bySource) ? inc.bySource : []).map(function (s) { return { name: String(s.source), amount: Number(s.amount) || 0, count: s.count || 0, months: s.months || [], expected: Number(s.expectedAmount) > 0 }; }),
      cats: (Array.isArray(ex.byCategory) ? ex.byCategory : []).map(function (c) { return { name: String(c.category), amount: Number(c.amount) || 0, count: c.count || 0, months: c.months || [] }; }),
      monthsSeries: Array.isArray(d.months) ? d.months : [], paidFromColumn: m.paidFromColumn, reimburse: m.reimburse, reimburseN: m.reimburseN };
  }

  /* ---- chrome (title, tabs, month nav) ---- */
  function entSubTitle(R) {
    var k = R.kind;
    return k === 'cat' ? R.val : k === 'income' ? (R.val === 'All' ? 'Income' : R.val) : k === 'exp' ? 'Expenses' : k === 'net' ? 'Net profit'
      : k === 'bal' ? 'Bank' : k === 'flags' ? 'Attribution' : k === 'tax' ? 'Tax' : '';
  }
  function paintEntChrome() {
    var R = state.entRoute, E = ENTS[R.key] || ENTS.kiwit, sub = !!R.kind, tax = R.kind === 'tax';
    $('ent-back').hidden = false;
    $('ent-back').setAttribute('data-go', sub ? 'ent/' + E.key : 'spend');
    $('ent-back').innerHTML = sub ? '&lsaquo; Back' : '&lsaquo; Vault';
    $('ent-title').textContent = sub ? E.name + ' \u00b7 ' + entSubTitle(R) : E.title;
    $('ent-title').classList.toggle('sub', sub);
    // Two-tab strip (Ledger | Business Documents) on the top-level view only; no Vault/KiwiT/TiwiK tabs (removed 10/3).
    var docs = !sub && R.tab === 'docs';
    $('ent-tabs').hidden = sub;
    $('ent-tabs').innerHTML = sub ? '' :
      '<button type="button" class="enttab' + (docs ? '' : ' on') + '" data-go="ent/' + E.key + '" aria-pressed="' + !docs + '">Ledger</button>' +
      '<button type="button" class="enttab' + (docs ? ' on' : '') + '" data-go="ent/' + E.key + '/docs" aria-pressed="' + docs + '">Business Documents</button>';
    $('ent-nav').hidden = docs;
    var cur = state.entCache[E.key + '|' + state.entOff];
    var label = tax ? state.entYear + (state.entYear === new Date().getFullYear() ? ' to date' : '') : (cur && cur.d && cur.d.monthLabel) || entLocalMonth(state.entOff);
    $('ent-month').textContent = label;
    $('ent-prev').textContent = tax ? '\u2039 Prev year' : '\u2039 Prev month';
    $('ent-next').textContent = tax ? 'Next year \u203a' : 'Next month \u203a';
    $('ent-next').disabled = tax ? state.entYear >= new Date().getFullYear() : state.entOff >= 0;
    $('ent-pick').hidden = tax;
    if (!tax) { var t = new Date(); $('ent-pick').max = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2);
      var p = new Date(t.getFullYear(), t.getMonth() + state.entOff, 1, 12); $('ent-pick').value = p.getFullYear() + '-' + ('0' + (p.getMonth() + 1)).slice(-2); }
  }
  $('ent-prev').addEventListener('click', function () { if (state.entRoute.kind === 'tax') state.entYear--; else state.entOff--; loadEnt(false); });
  $('ent-next').addEventListener('click', function () {
    if (state.entRoute.kind === 'tax') { if (state.entYear < new Date().getFullYear()) state.entYear++; }
    else if (state.entOff < 0) state.entOff++;
    loadEnt(false);
  });
  $('ent-pick').addEventListener('change', function () {
    var m = String(this.value || '').match(/^(\d{4})-(\d{2})$/), t = new Date();
    if (!m) return;
    var off = (Number(m[1]) - t.getFullYear()) * 12 + (Number(m[2]) - 1 - t.getMonth());
    state.entOff = Math.max(-240, Math.min(0, off)); loadEnt(false);
  });

  /* ---- small renderers ---- */
  function entIncRows(list, showSrc) {
    if (!list.length) return '<div class="foot empty">No income this month</div>';
    return '<div class="inccompact">' + list.map(function (e) {
      var what = [showSrc ? e.source : '', e.client, e.notes && !e.expected ? e.notes : ''].filter(Boolean).join(' \u00b7 ');
      return '<div class="icrow"><span class="icd">' + esc(e.label) + '</span><span class="icc">' + esc(what) +
        (e.expected ? ' <span class="acflag warn" title="' + esc(e.notes) + '">scheduled \u00b7 not logged</span>' : '') + '</span><span class="amt amt-in">' + money(e.amount) + '</span></div>';
    }).join('') + '</div>';
  }
  function entPaid(X) { return X && X.paidFromColumn === true ? 'need' : true; }
  function entFlagLabel(f) {
    if (f.kind === 'reimburse') return 'Reimburse';
    if (f.kind === 'tag') return f.hasCol ? (f.paidFrom ? 'Check Paid from' : 'Needs Paid from') : 'Needs a bank/card tag';
    return 'May be the wrong book';
  }
  function entPfNote(M, E) {
    var h = '';
    if (M.reimburse > 0) h += '<div class="foot warnfoot pfwarn">Reimburse: <b>' + money(M.reimburse) + '</b> (' + M.reimburseN + ' item' + (M.reimburseN === 1 ? '' : 's') + ') of ' + esc(E.title) + ' expenses ' + (M.reimburseN === 1 ? 'was' : 'were') + ' paid from a Household card/account. The LLC owes it back.</div>';
    if (M.paidFromColumn === false) h += '<div class="foot how pfhint">The \u201cPaid from\u201d column is not in the Daily Spend sheet yet. Run the <b>spendcol</b> admin action once to add it.</div>';
    return h;
  }
  function entFlagRows(list, max) {
    if (!list.length) return '<div class="foot empty">Nothing to review.</div>';
    return list.slice(0, max || list.length).map(function (f) {
      var chg = f.kind === 'misattributed' && f.suggest && f.suggest !== f.account ? ' <span class="flagto">' + esc(f.account) + ' \u2192 ' + esc(f.suggest) + '?</span>' : '';
      return '<div class="flagrow sev-' + f.severity + ' k-' + f.kind + '"><div class="fl1"><span class="fk">' + entFlagLabel(f) + '</span>' +
        '<span class="amt amt-out">' + money(f.amount) + '</span></div><div class="fl2"><b>' + esc(f.merchant || f.category) + '</b> \u00b7 ' + esc(f.label) + ' \u00b7 ' + esc(f.category) +
        ' \u00b7 ' + esc(f.account) + chg + (f.method ? ' \u00b7 ' + esc(f.method) : '') + '</div><div class="fl3">' + esc(f.why) + '</div></div>';
    }).join('');
  }
  function entDebtFor(E) {
    var st = state.debt || { s: 'load' }, D = st.d;
    return { st: st, D: D, loans: D ? D.loans.filter(function (l) { return l.entity === E.name; }) : [], bills: D ? D.bills.filter(function (b) { return b.entity === E.name; }) : [] };
  }
  function entLoansSection(E) {
    var X = entDebtFor(E), key = 'ent-' + E.key + '-debt', st = X.st, D = X.D, sh = dbSheet(D);
    if (st.s === 'na') return dbFallback(key, 'debtsec', 'Loans', 'Loans are not available yet (server update pending). They are in Finances \u203a Overview.', 'na');
    if (!D) return st.s === 'err' ? dbFallback(key, 'debtsec', 'Loans', 'Could not load loans' + (st.msg ? ': ' + esc(st.msg) : '') + '.', 'err') : dbFallback(key, 'debtsec', 'Loans', 'Loading loans\u2026', 'load');
    var totAttr = sh ? goAttr(dbRoute('total', E.name)) : (D.docUrl ? ' data-doc="' + esc(D.docUrl) + '" data-title="' + esc(D.docTitle) + '"' : goAttr('fin/overview'));
    if (!X.loans.length) return vSec(key, 'debtsec', 'Loans', '<span class="amt-neutral">n/a</span>', '', '<div class="foot">No loan for ' + esc(E.title) + ' ' + (sh ? 'on the Debts tab.' : 'in the Overview Doc.') + '</div>' + (sh ? dbTabBtn(D, 'debts') : dbDocBtn(D)), totAttr);
    var tot = r2(X.loans.reduce(function (t, l) { return t + (l.balance || 0); }, 0)), pay = r2(X.loans.reduce(function (t, l) { return t + (l.payment || 0); }, 0));
    var body = '<div class="dbsum"><div class="dbsumrow"><span>Total debt</span><b>' + dbVal(D, balMoney(tot), dbRoute('total', E.name), D.docUrl, D.docTitle, 'amt-neutral') + '</b></div>' +
      '<div class="dbsumrow"><span>Monthly payment</span><b>' + dbVal(D, money(pay), dbRoute('service', E.name), D.docUrl, D.docTitle, 'amt-out') + '</b></div></div>' +
      X.loans.map(function (l) { return loanCard(l, D); }).join('') +
      '<div class="foot how">Principal and interest are paid from the bank account; they are not in the expense categories unless logged. Ask the lender for the year-end interest statement (Form 1098) for taxes.</div>' + (sh ? dbTabBtn(D, 'debts') : dbDocBtn(D));
    return vSec(key, 'debtsec', 'Loans', '<span class="amt-neutral">' + balMoney(tot) + '</span>', '', body, totAttr);
  }
  function entBillsSection(E) {
    var X = entDebtFor(E), key = 'ent-' + E.key + '-bills', st = X.st, D = X.D, title = 'Upcoming bills (30 days)', sh = dbSheet(D);
    if (st.s === 'na' || !D) return '';
    var counted = X.bills.filter(function (b) { return !b.viaEscrow && b.amount != null; }), tot = r2(counted.reduce(function (t, b) { return t + b.amount; }, 0));
    var body = X.bills.length ? X.bills.map(function (b) { return billRow(b, D); }).join('') : '<div class="foot empty">Nothing due in the next ' + D.windowDays + ' days.</div>';
    if (sh) body += balBtn('All Bills tab rows', dbRoute('bills', E.name), 'linkrow smallrow') + dbTabBtn(D, 'bills') + dbTabBtn(D, 'debts', true);
    else body += dbDocBtn(D);
    return vSec(key, 'billsec', title, '<span class="amt-out">' + money(tot) + '</span>', '', body, sh ? goAttr(dbRoute('bills', E.name)) : (D.docUrl ? ' data-doc="' + esc(D.docUrl) + '" data-title="' + esc(D.docTitle) + '"' : goAttr('fin/overview')));
  }
  function entBankCard(E, a, M) {
    var h = '<div class="acard"><div class="actop"><div class="acname">' + esc(a.name) + '<small>' + esc([a.bank, a.type].filter(Boolean).join(' \u00b7 ')) + '</small></div>';
    h += a.balance == null ? '<span class="acnone">No balance yet</span>' : '<button class="acbal amt-bal"' + goAttr(entRoute(E.key, 'bal')) + '>' + balMoney(a.balance) + ' <i class="chev">&rsaquo;</i></button>';
    h += '</div>';
    if (a.asOf) h += '<div class="acmeta"><span>As of ' + esc(acDate(a.asOf)) + '</span>' + (a.stale ? ' <span class="acflag warn">not this month</span>' : (acMonthEnd(a.asOf) ? '' : ' <span class="acflag">not month end</span>')) + '</div>';
    if (a.change != null) h += '<button class="acchg"' + goAttr(entRoute(E.key, 'bal')) + '><span>Change vs ' + esc(acDate(a.prevAsOf)) + '</span><b class="amt-bal">' + balSigned(a.change) + '</b></button>';
    else if (a.balance != null) h += '<div class="acchg none">Change: need another statement</div>';
    if (a.stale) h += '<div class="acnote">No balance for ' + esc(M.monthLabel || entLocalMonth(state.entOff)) + ' yet. Add a row to the Balances tab ("' + esc(a.name) + '" at month end) to see it here.</div>';
    if (a.notes) h += '<div class="acnote">' + esc(a.notes) + '</div>';
    return h + '</div>';
  }
  function entSheets(extra) {
    return sheetLink('Open Daily Spend sheet') + sheetLink('Open Income tab', 'income').replace('linkrow sheetbtn', 'linkrow sheetbtn second') + (extra || '');
  }

  /* ---- screens ---- */
  function entNotice(E, c) {
    if (c.s === 'na') return '<div class="card entna"><b>' + esc(E.title) + ' books are not available yet</b>The server update that adds the entity books is pending. Loans and bills below still work; income and spend are in the sheet.</div>';
    if (c.s === 'err') return '<div class="error">' + esc(c.msg || 'Could not load.') + '<div class="retry"><button class="navbtn" data-ent-retry="1">Try again</button></div></div>';
    return '<div class="loading">Loading\u2026</div>';
  }
  function entMainView(E, M) {
    var k = E.key, ek = function (s) { return 'ent-' + k + '-' + s; }, h = '';
    var n = M.net;
    h += '<div class="card entscore">' +
      sumBtn('net cmp', entRoute(k, 'income', 'All'), 'Income' + (M.scheduled ? '<small>incl. ' + money(M.scheduled) + ' scheduled rent not yet logged</small>' : '<small>' + esc(E.sub) + '</small>'), '<span class="amt amt-in">' + money(M.incomeTotal) + '</span>') +
      sumBtn('net cmp', entRoute(k, 'exp'), 'Expenses<small>Daily Spend rows with Account = ' + esc(E.name) + '</small>', '<span class="amt amt-out">' + money(M.expenseTotal) + '</span>') +
      sumBtn('net cmp', entRoute(k, 'net'), 'Net profit<small>Income \u2212 expenses for ' + esc(M.monthLabel || entLocalMonth(state.entOff)) + '</small>', '<span class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signedMoney(n) + '</span>') + entPfNote(M, E) + '</div>';
    h += '<button class="enttax"' + goAttr(entRoute(k, 'tax')) + '><span>Tax export</span><small>Year-to-date category summary \u00b7 CSV</small><i class="chev">&rsaquo;</i></button>';

    // Income (green), one block per source
    var ib = M.sources.map(function (s) {
      return '<div class="entsrc"><button class="entsrchead"' + goAttr(entRoute(k, 'income', s.name)) + '><span class="n">' + esc(s.name) + '</span><span class="amt amt-in">' + money(s.amount) + '</span><span class="chev">&rsaquo;</span></button>' + entIncRows(s.items, false) + '</div>';
    }).join('') || '<div class="foot empty">No income this month</div>';
    h += vSec(ek('income'), 'income', 'Income', '<span class="amt-in">' + money(M.incomeTotal) + '</span>', entRoute(k, 'income', 'All'), ib + sheetLink('Open Income tab', 'income'));
    // Expenses by category (red)
    var eb = M.cats.length ? barRows(M.cats, function (c) { return entRoute(k, 'cat', c); }, '') : '<div class="foot empty">No expenses this month</div>';
    eb += totBtn(E.title + ' expenses', M.expenseTotal, entRoute(k, 'exp'));
    h += vSec(ek('exp'), 'acctsec', 'Expenses by category', '<span class="amt-out">' + money(M.expenseTotal) + '</span>', entRoute(k, 'exp'), eb + sheetLink('Open Daily Spend sheet'));
    // Net profit
    var X = entDebtFor(E), pay = r2(X.loans.reduce(function (t, l) { return t + (l.payment || 0); }, 0));
    var nb = sumBtn('', entRoute(k, 'income', 'All'), 'Income', '<span class="amt amt-in">' + money(M.incomeTotal) + '</span>') +
      sumBtn('', entRoute(k, 'exp'), 'Expenses', '<span class="amt amt-out">\u2212' + money(M.expenseTotal) + '</span>') +
      sumBtn('net', entRoute(k, 'net'), 'Net profit', '<span class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signedMoney(n) + '</span>');
    if (pay > 0 && state.entOff === 0) nb += '<div class="foot how">Loan payment this month: <span class="amt-out">' + money(pay) + '</span> (principal + interest, paid from the bank, not in the expenses above). Cash left after it: <b class="' + (n - pay >= 0 ? 'pos' : 'neg') + '">' + signedMoney(r2(n - pay)) + '</b>.</div>';
    h += vSec(ek('net'), 'summary', 'Net profit', '<span class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signedMoney(n) + '</span>', entRoute(k, 'net'), nb);
    // Bank account
    var B = M.bank, bb = B.accounts.length ? B.accounts.map(function (a) { return entBankCard(E, a, M); }).join('') : '<div class="foot">No ' + esc(E.title) + ' bank account found on the Accounts tab (Owner = ' + esc(E.name) + ').</div>';
    bb += balBtn('Balance entries', entRoute(k, 'bal'), 'linkrow smallrow') + sheetLink('Open Balances tab', 'bal', B.gid);
    h += vSec(ek('bal'), 'acctbal', 'Bank balance', '<span class="amt-bal">' + (B.total == null ? '\u2014' : balMoney(B.total)) + '</span>', entRoute(k, 'bal'), bb);
    h += entLoansSection(E) + entBillsSection(E);
    // Attribution check
    var hi = M.flags.filter(function (f) { return f.severity === 'high'; }).length;
    h += vSec(ek('flags'), 'flagsec', 'Check attribution', '<span class="' + (hi ? 'flagn hot' : 'flagn') + '">' + M.flags.length + '</span>', entRoute(k, 'flags'),
      '<div class="foot how">Rows that may sit in the wrong book, or that need a separate bank/card tag so ' + esc(E.title) + ' has its own paper trail. Suggestions only; nothing is changed.</div>' +
      entFlagRows(M.flags, 4) + (M.flags.length > 4 ? balBtn('All ' + M.flags.length + ' items', entRoute(k, 'flags'), 'linkrow smallrow') : ''));
    h += entSheets();
    return h;
  }
  function entSubView(E, M, R) {
    var k = E.key, h = '';
    if (R.kind === 'cat') {
      var l = M.exp.filter(function (x) { return x.category === R.val; });
      h += '<div class="card"><h3>' + esc(E.name) + ' \u00b7 category</h3><div class="big amt-out">' + money(sum(l)) + '</div><div class="foot">' + l.length + ' item' + (l.length === 1 ? '' : 's') + ' \u00b7 all payment methods</div></div>' + sheetLink('Open Daily Spend sheet') +
        '<div class="card">' + itemRows(l, { chip: false, acct: false, paid: entPaid(M) }) + '</div>';
    } else if (R.kind === 'exp') {
      h += '<div class="card"><h3>' + esc(E.title) + ' expenses</h3><div class="big amt-out">' + money(M.expenseTotal) + '</div><div class="foot">' + M.exp.length + ' item' + (M.exp.length === 1 ? '' : 's') + ' \u00b7 Daily Spend rows with Account = ' + esc(E.name) + '</div>' + entPfNote(M, E) + '</div>' + sheetLink('Open Daily Spend sheet') +
        '<div class="card">' + itemRows(M.exp, { chip: true, acct: false, paid: entPaid(M), chipRoute: function (c) { return entRoute(k, 'cat', c); } }) + '</div>';
    } else if (R.kind === 'income') {
      var all = R.val === 'All', li = all ? M.income : M.income.filter(function (x) { return x.source === R.val; });
      h += '<div class="card income"><h3>' + (all ? esc(E.title) + ' income' : esc(R.val)) + '</h3><div class="big amt-in">' + money(sum(li)) + '</div><div class="foot">' + li.length + ' entr' + (li.length === 1 ? 'y' : 'ies') +
        (M.scheduled && all ? ' \u00b7 incl. ' + money(M.scheduled) + ' scheduled rent (not logged)' : '') + '</div><div class="foot how">Source: the Income tab of the spend sheet' + (E.key === 'kiwit' ? ' (rent from the tenant)' : ' (laundromat weekly lump sums)') + '.</div></div>' +
        sheetLink('Open in spend sheet (Income tab)', 'income') + '<div class="card income">' + entIncRows(li, all) + '</div>';
    } else if (R.kind === 'net') {
      var nn = M.net, part = function (label, html, route) { return '<button class="calcpart"' + goAttr(route) + '><span>' + label + '</span>' + html + '<span class="chev">&rsaquo;</span></button>'; };
      h += '<div class="card calc"><h3>' + esc(E.title) + ' net profit <small>(' + esc(M.monthLabel) + ')</small></h3><div class="big ' + (nn >= 0 ? 'pos' : 'neg') + '">' + signedMoney(nn) + '</div>' +
        '<div class="foot how"><b>How it is computed:</b> income (Income tab' + (M.scheduled ? ' + scheduled rent not yet logged' : '') + ') \u2212 expenses (Daily Spend rows whose Account is ' + esc(E.name) + '). Loan principal/interest and owner draws are not included.</div>' +
        '<div class="calcparts">' + part('Income', '<span class="amt amt-in">' + money(M.incomeTotal) + '</span>', entRoute(k, 'income', 'All')) +
        part('Expenses', '<span class="amt amt-out">\u2212' + money(M.expenseTotal) + '</span>', entRoute(k, 'exp')) + '</div></div>' + sheetLink('Open Daily Spend sheet') +
        '<div class="card income"><h3>Income entries \u00b7 ' + M.income.length + ' \u00b7 ' + money(M.incomeTotal) + '</h3>' + entIncRows(M.income, true) + '</div>' +
        '<div class="card"><h3>Expense entries \u00b7 ' + M.exp.length + ' \u00b7 ' + money(M.expenseTotal) + '</h3>' + itemRows(M.exp, { chip: false, acct: false, paid: entPaid(M) }) + '</div>';
    } else if (R.kind === 'bal') {
      var B = M.bank;
      h += '<div class="card acdrill"><h3>' + esc(E.title) + ' bank</h3><div class="big amt-bal">' + (B.total == null ? '\u2014' : balMoney(B.total)) + '</div><div class="foot how">Source: the Balances tab of the spend sheet (one row per account per statement date).</div></div>' + sheetLink('Open in spend sheet (Balances tab)', 'bal', B.gid);
      if (!B.accounts.length) h += '<div class="card acdrill"><div class="foot">No ' + esc(E.title) + ' account found on the Accounts tab.</div></div>';
      B.accounts.forEach(function (a) {
        h += '<div class="card acdrill"><h3>' + esc(a.name) + ' <small>' + esc([a.bank, a.type].filter(Boolean).join(' \u00b7 ')) + '</small></h3>';
        if (!a.entries.length) h += '<div class="foot">No balance entered yet.</div>';
        a.entries.forEach(function (e, i) {
          h += '<div class="icrow"><span class="icd">' + esc(acDate(e.date)) + '</span><span class="icc">' + (acMonthEnd(e.date) ? '' : '<span class="acflag">not month end</span> ') + esc(e.notes) + (i === 0 ? ' <small class="muted">(latest)</small>' : '') + '</span><span class="amt amt-bal">' + balMoney(e.balance) + '</span></div>';
        });
        h += '</div>';
      });
    } else if (R.kind === 'flags') {
      h += '<div class="card"><h3>Check attribution \u00b7 ' + esc(M.monthLabel) + '</h3><div class="foot how">' + M.flags.length + ' item' + (M.flags.length === 1 ? '' : 's') +
        '. <b>May be the wrong book:</b> a Household row that looks like ' + esc(E.title) + ' business, or a ' + esc(E.name) + ' row that looks like the other LLC. <b>Needs a tag:</b> a ' + esc(E.name) +
        ' expense whose <b>Paid from</b> is empty (or, if the sheet has no Paid from column yet, whose Method does not say it was paid from the ' + esc(E.name) + ' bank account/card). <b>Reimburse:</b> a ' + esc(E.name) + ' expense that was Paid from a Household card/account, so the LLC owes the household back. Fix the Account / Paid from cell in the sheet; nothing is changed automatically.</div></div>' +
        sheetLink('Open Daily Spend sheet (fix Account / Paid from)') + '<div class="card flaglist">' + entFlagRows(M.flags) + '</div>';
    }
    return h;
  }

  /* ---- Tax export (year to date) ---- */
  function entMonthsLine(months) {
    var p = [];
    (months || []).forEach(function (v, i) { if (v) p.push(MONTHS_SHORT[i] + ' ' + money(v)); });
    return p.length ? '<div class="foot how">' + p.join(' \u00b7 ') + '</div>' : '';
  }
  function entTaxView(E) {
    var R = state.entRoute, c = state.entTaxCache[R.key + '|' + state.entYear] || { s: 'load' }, T = c.d, h = '';
    if (!T) return (c.s === 'na' ? '<div class="card entna"><b>Tax export is not available yet</b>The server update that adds the entity books is pending. Until then use the Daily Spend sheet filtered by Account = ' + esc(E.name) + '.</div>' + sheetLink('Open Daily Spend sheet') : entNotice(E, c));
    var n = T.net, thru = T.through < 12 || T.year === new Date().getFullYear() ? 'Jan\u2013' + MONTHS_SHORT[Math.max(0, T.through - 1)] + ' ' + T.year : 'Full year ' + T.year;
    h += '<div class="card entscore"><h3>' + esc(E.title) + ' \u00b7 ' + esc(thru) + '</h3>' +
      '<div class="sumline"><span>Income</span><b class="amt amt-in">' + money(T.incomeTotal) + '</b></div>' +
      '<div class="sumline"><span>Expenses</span><b class="amt amt-out">' + money(T.expTotal) + '</b></div>' +
      '<div class="sumline net"><span>Net profit</span><b class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signedMoney(n) + '</b></div>' +
      (T.scheduled ? '<div class="foot warnfoot">' + money(T.scheduled) + ' of the income is scheduled rent that is not typed into the Income tab (shown as expected, not received). Log each rent receipt so the books show real deposits.</div>' : '') +
      '<div class="foot how">Cash basis from the Command Center sheet. Not tax advice; give the CSV to your preparer.</div></div>';
    h += '<button class="enttax csv" data-ent-csv="1"><span>Download CSV</span><small>Category summary + every entry</small><i class="chev">&darr;</i></button><div class="entcsvmsg" id="ent-csvmsg" hidden></div>';
    h += '<div class="enth">Income by source</div><div class="incgroup">' + (T.sources.map(function (s, i) {
      var l = T.items.income.filter(function (x) { return x.source === s.name; });
      return vSec('ent-' + E.key + '-tx-i' + i, 'income incsrc', esc(s.name), '<span class="amt-in">' + money(s.amount) + '</span>', '', entMonthsLine(s.months) + entIncRows(l, false), ' data-tgl="1"');
    }).join('') || '<div class="foot empty">No income</div>') + '</div>';
    h += '<div class="enth">Expenses by category</div>' + (T.cats.map(function (cat, i) {
      var l = T.items.exp.filter(function (x) { return x.category === cat.name; });
      return vSec('ent-' + E.key + '-tx-e' + i, 'acctsec', esc(cat.name), '<span class="amt-out">' + money(cat.amount) + '</span>', '', '<div class="foot how">' + cat.count + ' entr' + (cat.count === 1 ? 'y' : 'ies') + '</div>' + entMonthsLine(cat.months) + itemRows(l, { chip: false, acct: false, paid: entPaid(T) }) + sheetLink('Open Daily Spend sheet'), ' data-tgl="1"');
    }).join('') || '<div class="foot empty">No expenses</div>');
    var X = entDebtFor(E);
    if (X.loans.length) h += '<div class="card entloanmemo"><h3>Loans (memo)</h3>' + X.loans.map(function (l) {
      return '<div class="sumline"><span>' + esc(l.name) + '<small>' + (l.rateText ? esc(l.rateText) + ' \u00b7 ' : '') + 'balance ' + balMoney(l.balance) + '</small></span><b class="amt amt-out">' + money(l.payment || 0) + '/mo</b></div>'; }).join('') +
      '<div class="foot how">Loan payments are not in the expenses above. For taxes use the lender\u2019s year-end interest statement (Form 1098); only the interest is an expense, principal is not.</div></div>';
    var hi = T.flags.filter(function (f) { return f.severity === 'high'; }).length;
    h += vSec('ent-' + E.key + '-tx-flags', 'flagsec', 'Review before filing', '<span class="' + (hi ? 'flagn hot' : 'flagn') + '">' + T.flags.length + '</span>', '',
      '<div class="foot how">Rows that may sit in the wrong book or need a bank/card tag (whole year).</div>' + entFlagRows(T.flags), ' data-tgl="1"');
    return h + sheetLink('Open Daily Spend sheet');
  }
  function entCsvLocal(E, T) {
    var q = function (v) { var s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [], line = function (a) { rows.push(a.map(q).join(',')); };
    line([E.title + ' tax export', 'Year ' + T.year]); rows.push('');
    line(['Summary', 'Type', 'Category / Source', 'Entries', 'Amount']);
    T.sources.forEach(function (s) { line(['Summary', 'Income', s.name, s.count, s.amount.toFixed(2)]); });
    line(['Summary', 'Income', 'TOTAL INCOME', '', T.incomeTotal.toFixed(2)]);
    T.cats.forEach(function (c) { line(['Summary', 'Expense', c.name, c.count, c.amount.toFixed(2)]); });
    line(['Summary', 'Expense', 'TOTAL EXPENSES', T.items.exp.length, T.expTotal.toFixed(2)]);
    line(['Summary', 'Net', 'NET PROFIT', '', T.net.toFixed(2)]);
    var rb = T.items.exp.filter(function (x) { return x.paidFrom === 'Household card/account'; });
    if (rb.length) line(['Summary', 'Memo', 'Paid from Household card/account (reimburse the LLC)', rb.length, sum(rb).toFixed(2)]);
    rows.push('');
    line(['Detail', 'Type', 'Date', 'Category / Source', 'Description', 'Method', 'Paid from', 'Amount', 'Basis', 'Notes']);
    T.items.income.slice().reverse().forEach(function (x) { line(['Detail', 'Income', x.date, x.source, x.client, '', '', x.amount.toFixed(2), x.expected ? 'Scheduled (not logged)' : 'Logged', x.notes]); });
    T.items.exp.slice().reverse().forEach(function (x) { line(['Detail', 'Expense', x.date, x.category, x.merchant, x.method, x.paidFrom || '', x.amount.toFixed(2), 'Logged', x.notes]); });
    return rows.join('\r\n') + '\r\n';
  }
  function entSaveCsv(name, text) {
    var blob = new Blob([text], { type: 'text/csv' });
    try {
      var file = new File([blob], name, { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { return navigator.share({ files: [file], title: name }).catch(function () {}); }
    } catch (e) {}
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function entCsv() {
    var R = state.entRoute, E = ENTS[R.key], c = state.entTaxCache[R.key + '|' + state.entYear], msg = $('ent-csvmsg');
    if (!E || !c || !c.d) return;
    var say = function (t) { msg.textContent = t; msg.hidden = !t; };
    say('Preparing CSV\u2026');
    apiRaw('entitytax', { entity: R.key, year: state.entYear, format: 'csv' }).then(function (j) {
      var d = j && j.data;
      if (j.error || !d || !d.csv) throw new Error('csv unavailable');
      entSaveCsv(d.filename || (E.title.replace(/\s+/g, '') + '-tax-' + state.entYear + '.csv'), d.csv); say('');
    }).catch(function (err) {
      if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return; }
      entSaveCsv(E.title.replace(/\s+/g, '') + '-tax-' + state.entYear + '.csv', entCsvLocal(E, c.d)); say('Saved from the data on screen.');
    });
  }

  /* ---- Business Documents tab (#ent/<key>/docs): same list style as #biz/<slug> (renderBiz), live from the `biz` action ---- */
  // Related documents (KiwiT only): links to files/folders that live outside Business > KiwiT LLC. Drive ids only, no names with account numbers.
  var ENT_RELATED = {
    kiwit: [
      { name: 'Insurance \u203a KiwiT (policy PDFs)', folder: true, id: '1VMta33oQqm-qwQoF0RDLMW6R1Q_wR3Tm' },
      { name: 'Insurance \u203a Mono Way (policy PDFs)', folder: true, id: '1Icd3FslvKfP-9BuxlMVBGyAjMqZeKu0r' },
      { name: 'Mono Way loan (signed documents)', id: '1-gDqVllz2apDP_xZzspJpdlVPGUJoyGt' },
      { name: 'Building lease (KiwiT to TiwiK, no cash changes hands)', id: '1msUgH6s-3dEcw7pAG7GsG8Y8o1AMAGCK' }
    ]
  };
  state.entDocs = { s: '', at: 0, msg: '' };
  function loadEntDocs(force) {
    var D = state.entDocs;
    if (!force && state.biz && (D.s === 'load' || Date.now() - D.at < 60000)) return renderEnt();
    var mine = state.entDocs = { s: 'load', at: state.biz ? D.at : 0, msg: '' };
    renderEnt();
    api('biz').then(function (d) {
      if (state.entDocs !== mine) return;
      state.biz = d; state.entDocs = { s: 'ok', at: Date.now(), msg: '' };
      if (entActive()) renderEnt();
    }, function (err) {
      if (state.entDocs !== mine) return;
      var m = entFail(err); if (m === null) return;
      if (/bad_action/.test(String(err && err.message))) m = 'Business documents are not available yet (server update pending).';
      state.entDocs = { s: 'err', at: 0, msg: m };
      if (entActive()) renderEnt();
    });
  }
  function entDocsView(E) {
    var D = state.entDocs, d = state.biz, h = '';
    var b = d && (d.businesses || []).filter(function (x) { return x.slug === E.key; })[0];
    if (D.s === 'err') h += '<div class="foot warnfoot">Could not load documents: ' + esc(D.msg || '') + ' <button class="linkrow smallrow" data-ent-retry="1">Try again</button></div>';
    else if (!b && D.s !== 'ok') h += '<div class="loading">Loading…</div>';
    else if (!b) h += '<div class="card bizgroup"><h4 class="sechead">Business Documents</h4><div class="foot empty">No documents yet.</div></div>';
    if (b) {
      var groups = (b.groups || []).slice().sort(function (x, y) {
        var a = /^business documents/i.test(x.name) ? 0 : 1, c = /^business documents/i.test(y.name) ? 0 : 1; return a - c;
      });
      var n = 0; groups.forEach(function (g) { n += (g.files || []).length; });
      h += '<p class="hint">' + esc(b.name) + ' \u00b7 ' + n + ' document' + (n === 1 ? '' : 's') + ' \u00b7 tap to view</p>';
      h += n ? bizGroupsHtml(groups) : '<div class="card bizgroup"><h4 class="sechead">Business Documents</h4><div class="foot empty">No documents yet \u2014 add files to Drive \u203a Business \u203a ' + esc(b.name) + '.</div></div>';
    }
    var rel = ENT_RELATED[E.key];
    if (rel) {
      h += '<div class="card bizgroup"><h4 class="sechead">Related documents</h4><ul class="doclist">' + rel.map(function (x) {
        var url = x.folder ? 'https://drive.google.com/drive/folders/' + x.id : 'https://drive.google.com/file/d/' + x.id + '/view';
        return '<li><a href="' + esc(url) + '" data-title="' + esc(x.name) + '"><span class="ft">' + (x.folder ? 'DIR' : 'PDF') + '</span>' + esc(x.name) + '</a></li>';
      }).join('') + '</ul></div>';
    }
    if (b && b.folderUrl) h += '<a class="linkrow" data-title="' + esc(b.short || b.name) + '" href="' + esc(b.folderUrl) + '">Open ' + esc(b.short || b.name) + ' folder &rsaquo;</a>';
    return h;
  }

  function renderEnt() {
    var R = state.entRoute, E = ENTS[R.key];
    if (!E) return;
    paintEntChrome();
    var h = '';
    if (!R.kind && R.tab === 'docs') { $('ent-body').innerHTML = entDocsView(E); return; }
    if (R.kind === 'tax') { $('ent-body').innerHTML = entTaxView(E); return; }
    var c = state.entCache[R.key + '|' + state.entOff] || { s: 'load' }, M = c.d;
    if (!M) {
      h = entNotice(E, c);
      if (c.s === 'na' && !R.kind) h += entLoansSection(E) + entBillsSection(E) + entSheets();
      $('ent-body').innerHTML = h; return;
    }
    h = c.s === 'err' ? '<div class="foot warnfoot">Could not refresh: ' + esc(c.msg || '') + ' (showing the last data) <button class="linkrow smallrow" data-ent-retry="1">Try again</button></div>' : '';
    h += R.kind ? entSubView(E, M, R) : entMainView(E, M);
    $('ent-body').innerHTML = h;
  }
  $('ent-body').addEventListener('click', function (e) {
    var t = e.target.closest('.vtoggle, .vtot[data-tgl]');
    if (t) {
      var c = t.closest('.vsec'), key = c.getAttribute('data-vs'), open = !c.classList.contains('open');
      c.classList.toggle('open', open);
      var tg = c.querySelector('.vtoggle'); if (tg) tg.setAttribute('aria-expanded', open);
      vOpenMap()[key] = open; return;
    }
    if (e.target.closest('[data-ent-retry]')) { loadEnt(true); return; }
    if (e.target.closest('[data-ent-csv]')) entCsv();
  });

  /* ---------------- Business documents (#biz; also the KiwiT / TiwiK "Business Documents" tab) ---------------- */
  // #biz = three business buttons; #biz/<slug> = grouped, linked document list.
  // Data comes from the passcode-protected API (action=biz), never from the public repo.
  function loadBiz() {
    if (state.biz) return renderBiz();
    $('biz-title').textContent = 'Business';
    $('biz-back').setAttribute('data-go', state.bizSlug ? 'biz' : 'home');
    $('biz-body').innerHTML = '<div class="loading">Loading…</div>';
    api('biz').then(function (d) { state.biz = d; renderBiz(); }, function (err) {
      if (err instanceof AuthError) return onFail(['biz-body'], loadBiz)(err);
      var m = String((err && err.message) || '');
      if (/bad_action/.test(m)) {
        var link = state.bizFolderUrl || 'https://drive.google.com/drive/folders/1wH4ME6ijwYURsjq4E-g0wkliiMyglpbD';
        $('biz-body').innerHTML = '<div class="loading">Business documents are not available yet (server update pending).</div>' +
          '<a class="linkrow" data-title="Business" href="' + esc(link) + '">Open Business folder &rsaquo;</a>';
        return;
      }
      onFail(['biz-body'], loadBiz)(err);
    });
  }
  function fileIcon(mime) {
    if (/pdf/.test(mime)) return 'PDF';
    if (/image/.test(mime)) return 'IMG';
    if (/zip/.test(mime)) return 'ZIP';
    if (/sheet|excel|csv/.test(mime)) return 'XLS';
    if (/presentation|powerpoint/.test(mime)) return 'PPT';
    if (/word|document/.test(mime)) return 'DOC';
    return 'FILE';
  }
  function bizGroupsHtml(groups) {
    var h = '';
    (groups || []).forEach(function (g) {
      h += '<div class="card bizgroup"><h4 class="sechead">' + esc(g.name) + '</h4>';
      if (g.decision) h += '<div class="decision"><b>Decision to make</b>' + (Array.isArray(g.decision)
        ? '<ul>' + g.decision.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
        : '<p>' + esc(g.decision) + '</p>') + '</div>';
      h += '<ul class="doclist">' + g.files.map(function (f) {
        var href = /officedocument|msword|ms-excel|ms-powerpoint/.test(f.mime || '') && f.id
          ? 'https://drive.google.com/file/d/' + f.id + '/view' : f.url;   // Office files: Drive viewer
        return '<li><a href="' + esc(href) + '" data-title="' + esc(f.name) + '"><span class="ft">' + fileIcon(f.mime) + '</span>' + esc(f.name) + '</a>' +
          (f.synopsis ? '<p class="syn">' + esc(f.synopsis) + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
      if (g.folderUrl) h += '<a class="foldlink" data-title="' + esc(g.name) + '" href="' + esc(g.folderUrl) + '">Open folder &rsaquo;</a>';
      h += '</div>';
    });
    return h;
  }
  function renderBiz() {
    var d = state.biz, slug = state.bizSlug;
    var b = slug && (d.businesses || []).filter(function (x) { return x.slug === slug; })[0];
    $('biz-back').setAttribute('data-go', b ? 'biz' : 'home');
    if (!b) {
      $('biz-title').textContent = 'Business';
      $('biz-title').classList.remove('sub');
      $('biz-body').innerHTML = '<div class="grid2 biz-grid">' + (d.businesses || []).map(function (x) {
        return '<button class="tile biz-tile" data-go="biz/' + esc(x.slug) + '">' + esc(x.short || x.name) +
          (x.sub ? '<span class="sub">' + esc(x.sub) + '</span>' : '') +
          '<span class="sub cnt">' + x.count + ' document' + (x.count === 1 ? '' : 's') + '</span></button>';
      }).join('') + '</div>' +
      (d.rootUrl ? '<a class="linkrow" data-title="Business" href="' + esc(d.rootUrl) + '">Open Business folder &rsaquo;</a>' : '');
      return;
    }
    $('biz-title').textContent = b.short || b.name;
    $('biz-title').classList.add('sub');
    var h = '<p class="hint">' + esc(b.name) + ' · ' + b.count + ' documents · tap to view</p>';
    h += bizGroupsHtml(b.groups);
    if (b.folderUrl) h += '<a class="linkrow" data-title="' + esc(b.short || b.name) + '" href="' + esc(b.folderUrl) + '">Open ' + esc(b.short || b.name) + ' folder &rsaquo;</a>';
    $('biz-body').innerHTML = h;
  }

  /* ---------------- Real Estate / Insurance (live from Drive) ---------------- */
  // #re = property buttons; #re/<slug> = property files + its Insurance/<Property> files; #ins = Insurance folder.
  var RE_TTL = 60000;   // reuse a listing for 1 min while moving between pages
  function driveFileUrl(x) { return 'https://drive.google.com/file/d/' + x.id + '/view'; }
  function loadRe(force) {
    var ins = state.reRoute.ins, key = ins ? 'ins' : 're';
    var fresh = state[key + 'Data'] && Date.now() - state[key + 'At'] < RE_TTL;
    paintReChrome();
    if (fresh && !force) return renderRe();
    $('re-body').innerHTML = '<div class="loading">Loading…</div>';
    var want = state.reRoute;
    apiRaw(key, {}).then(function (j) {
      if (want !== state.reRoute) return;
      if (j.error === 'bad_action') {
        var link = ins ? state.insFolderUrl : state.reFolderUrl;
        $('re-body').innerHTML = '<div class="loading">This page is not available yet (server update pending).</div>' +
          (link ? '<a class="linkrow" data-title="' + (ins ? 'Insurance' : 'Real Estate') + '" href="' + esc(link) + '">Open folder &rsaquo;</a>' : '');
        return;
      }
      if (j.error) throw new Error(j.message || j.error);
      state[key + 'Data'] = j.data; state[key + 'At'] = Date.now();
      renderRe();
    }).catch(function (err) { if (want === state.reRoute) onFail(['re-body'], function () { loadRe(true); })(err); });
  }
  function paintReChrome() {
    var r = state.reRoute;
    $('re-back').setAttribute('data-go', r.slug ? 're' : 'home');
    $('re-title').classList.toggle('sub', !!r.slug);
    if (r.ins) $('re-title').textContent = 'Insurance';
    else if (!r.slug) $('re-title').textContent = 'Real Estate';
  }
  function fileGroups(groups) {
    return groups.map(function (g) {
      return '<div class="card bizgroup"><h4 class="sechead">' + esc(g.name) + '</h4><ul class="doclist">' + g.files.map(function (f) {
        return '<li><a href="' + esc(driveFileUrl(f)) + '" data-title="' + esc(f.name) + '"><span class="ft">' + fileKind(f.mime) + '</span>' + esc(f.name) + '</a></li>';
      }).join('') + '</ul>' + (g.folderUrl ? '<a class="foldlink" data-title="' + esc(g.name) + '" href="' + esc(g.folderUrl) + '">Open folder &rsaquo;</a>' : '') + '</div>';
    }).join('');
  }
  function renderRe() {
    var r = state.reRoute, h = '';
    paintReChrome();
    if (r.ins) {
      var I = state.insData;
      h += '<p class="hint">' + I.count + ' document' + (I.count === 1 ? '' : 's') + ' · property insurance also shows on each Real Estate property page</p>';
      h += I.groups.length ? fileGroups(I.groups) : '<div class="loading">No documents yet — add files to Drive › Insurance.</div>';
      h += '<a class="linkrow" data-title="Insurance" href="' + esc(I.folderUrl) + '">Open Insurance folder &rsaquo;</a>';
      $('re-body').innerHTML = h;
      return;
    }
    var D = state.reData;
    var p = r.slug && D.properties.filter(function (x) { return x.slug === r.slug; })[0];
    if (!p) {
      h += '<div class="grid2 biz-grid">' + D.properties.map(function (x) {
        return '<button class="tile biz-tile" data-go="re/' + esc(x.slug) + '">' + esc(x.name) +
          '<span class="sub cnt">' + (x.count ? x.count + ' document' + (x.count === 1 ? '' : 's') : 'No documents yet') + '</span></button>';
      }).join('') + '</div>';
      h += '<a class="linkrow" data-title="Real Estate" href="' + esc(D.realEstateUrl) + '">Open Real Estate folder &rsaquo;</a>';
      $('re-body').innerHTML = h;
      return;
    }
    $('re-title').textContent = p.name;
    if (!p.groups.length) h += '<div class="card bizgroup"><h4 class="sechead">Documents</h4><div class="foot empty">No documents yet — add files to Drive › Real Estate › ' + esc(p.name) + '</div>' +
      '<a class="foldlink" data-title="' + esc(p.name) + '" href="' + esc(p.folderUrl) + '">Open folder &rsaquo;</a></div>';
    else h += fileGroups(p.groups);
    if (p.insurance.length) h += fileGroups(p.insurance);
    else h += '<div class="card bizgroup"><h4 class="sechead">Insurance</h4><div class="foot empty">No insurance documents yet — add files to Drive › Insurance › ' + esc(p.name) + '</div>' +
      '<a class="foldlink" data-title="Insurance · ' + esc(p.name) + '" href="' + esc(p.insuranceFolderUrl) + '">Open folder &rsaquo;</a></div>';
    $('re-body').innerHTML = h;
  }

  /* ---------------- Lisa's Table ---------------- */
  // Folder lists use the existing action=folder (live); Menu Macros uses action=ltmacros (live from the Sheet).
  var LT_PARTS = {
    ops:     { label: 'Business & Operations', folder: '1renTWVsMfj9UYrefVh3vJlv9EOX8Xe3y', sort: 'default' },
    recipes: { label: 'Menu Items',            folder: '1VvrIYV15BX7Rltet2PC7kTxVheUfqMfI', sort: 'az', search: 'Search menu items', check: true },
    menus:   { label: 'Past Menus',            folder: '11tV_huL874mr4F3LdGA-2fvGQZyEWKZY', sort: 'date', search: 'Search menus' },
    macros:  { label: 'Menu Macros', sheet: 'https://docs.google.com/spreadsheets/d/1YhDpmch8pWIAFKEwrSv7AMwWHyhuVW1OyeqbSNOPk3w/edit' },
    orders:  { label: 'Orders', orders: true },
    wish:    { label: 'Wish List', wish: true },
    notes:   { label: 'Notes', notes: true },
    cost:    { label: 'Cost & Macros', cost: true },   // ingredient checklist: true macros + package cost (localStorage; Drive later)
    'menu-gen': { label: 'Generate menu', gen: true, back: 'lt/recipes' },      // not a tile: opened from the Menu Items screen
    'menu-add': { label: 'Add menu item', add: true, back: 'lt/recipes' }       // not a tile: the + button on the Menu Items screen
  };
  var LT_ORDER = ['ops', 'recipes', 'orders', 'menus', 'macros', 'wish', 'notes', 'cost'];
  var LT_TTL = 60000;

  function loadLt(force) {
    var part = state.ltPart, cfg = LT_PARTS[part];
    $('lt-back').setAttribute('data-go', part ? (cfg && cfg.back) || 'lt' : 'home');
    $('lt-title').textContent = cfg ? cfg.label : 'Lisa\u2019s Table';
    $('lt-title').classList.toggle('sub', !!part);
    if (!cfg) {
      $('lt-body').innerHTML = '<div class="ltband"><img class="ltlogo" src="lt-logo-v4.png?v=1" alt="Lisa\u2019s Table"></div><div class="grid2 homegrid">' + LT_ORDER.map(function (k) {
        return '<button class="tile" data-go="lt/' + k + '">' + esc(LT_PARTS[k].label) + '</button>';
      }).join('') + '</div>' + (state.ltFolderUrl ? '<a class="linkrow" data-title="Lisa\u2019s Table" href="' + esc(state.ltFolderUrl) + '">Open Lisa\u2019s Table folder &rsaquo;</a>' : '');
      if (!state.ltFolderUrl && !state.links) ensureLinks(function () { if (state.ltPart === '' && $('screen-lt').classList.contains('active') && state.ltFolderUrl) loadLt(); });
      return;
    }
    if (cfg.wish) { openWish(); return; }
    if (cfg.notes) { openLtNotes(); return; }
    if (cfg.cost) { openLtCost(); return; }
    if (cfg.orders) { openOrders(); return; }
    if (cfg.gen) { openMenuGen(); return; }
    if (cfg.add) { openMenuAdd(); return; }
    var key = cfg.folder || 'macros', c = state.ltCache[key];
    if (c && !force && Date.now() - c.at < LT_TTL) return renderLt();
    $('lt-body').innerHTML = '<div class="loading">Loading…</div>';
    var want = part;
    apiRaw(cfg.folder ? 'folder' : 'ltmacros', cfg.folder ? { id: cfg.folder } : {}).then(function (j) {
      if (want !== state.ltPart) return;
      if (j.error === 'bad_action') {
        $('lt-body').innerHTML = '<div class="loading">This page is not available yet (server update pending).</div>' +
          (cfg.sheet ? '<a class="linkrow" data-title="Menu Macros" href="' + esc(cfg.sheet) + '">Open sheet &rsaquo;</a>' : '');
        return;
      }
      if (j.error) throw new Error(j.message || j.error);
      state.ltCache[key] = { at: Date.now(), data: j.data };
      renderLt();
    }).catch(function (err) { if (want === state.ltPart) onFail(['lt-body'], function () { loadLt(true); })(err); });
  }


  /* ---------------- Trust & Estate (Home tile) ---------------- */
  // Live listing of the Trust & Estate Drive folder through the existing action=folder (no API change). The folder is empty today,
  // so the page shows a friendly placeholder; documents appear here as soon as they are added to Drive.
  var TRUST_FOLDER = '13zQGJYKKKcsmYau2no2Bn_vzSIdqDS2Y';
  function trustFolderId() {
    var m = String(state.trustFolderUrl || '').match(/folders\/([\w-]+)/);
    return m ? m[1] : TRUST_FOLDER;
  }
  function trustLink() {
    var u = state.trustFolderUrl || ('https://drive.google.com/drive/folders/' + TRUST_FOLDER);
    return '<a class="linkrow" data-title="Trust &amp; Estate" href="' + esc(u) + '">Open Trust &amp; Estate folder &rsaquo;</a>';
  }
  function trustEmpty(msg) {
    return '<div class="card bizgroup"><h4 class="sechead">Documents</h4><div class="foot empty">' + msg + '</div></div>' + trustLink();
  }
  function loadTrust(force) {
    var c = state.trustCache;
    if (c && !force && Date.now() - c.at < 60000) return renderTrust();
    $('trust-body').innerHTML = '<div class="loading">Loading…</div>';
    ensureLinks(function () {
      apiRaw('folder', { id: trustFolderId() }).then(function (j) {
        if (!$('screen-trust').classList.contains('active')) return;
        if (j.error === 'bad_action' || j.error === 'forbidden' || j.error === 'not_found') {
          $('trust-body').innerHTML = trustEmpty('Documents can\u2019t be listed here yet. Open the folder in Drive instead.');
          return;
        }
        if (j.error) throw new Error(j.message || j.error);
        state.trustCache = { at: Date.now(), data: j.data };
        renderTrust();
      }).catch(function (err) { onFail(['trust-body'], function () { loadTrust(true); })(err); });
    });
  }
  function renderTrust() {
    var d = state.trustCache.data, items = (d && d.items) || [];
    if (!items.length) {
      $('trust-body').innerHTML = trustEmpty('Nothing here yet \u2014 no trust or estate documents have been filed. Add files to Drive \u203a Trust &amp; Estate and they will show up on this page.');
      return;
    }
    $('trust-body').innerHTML = '<div class="card bizgroup"><h4 class="sechead">Documents</h4><ul class="doclist">' +
      items.map(function (x) { return ltItemLink(x); }).join('') + '</ul></div>' +
      '<div class="foot">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</div>' + trustLink();
  }

  $('trust-refresh').addEventListener('click', function () { loadTrust(true); });

  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  // "Menu week of Apr 13th 26" -> Date. Without a year, pick the most recent year (not in the future)
  // in which that date is a Monday (menus are "week of" Mondays), else the most recent past year.
  function menuDate(name) {
    var m = String(name).match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}|\d{2})\b)?/i);
    if (!m) return null;
    var mo = MONTHS[m[1].toLowerCase()], d = Number(m[2]), now = new Date();
    if (m[3]) { var y = Number(m[3]); if (y < 100) y += 2000; return new Date(y, mo, d); }
    var fallback = null;
    for (var yy = now.getFullYear(); yy >= now.getFullYear() - 6; yy--) {
      var dt = new Date(yy, mo, d);
      if (dt > now) continue;
      if (!fallback) fallback = dt;
      if (dt.getDay() === 1) return dt;
    }
    return fallback;
  }
  function ltItemLink(x, label) {
    var href = x.folder ? 'https://drive.google.com/drive/folders/' + x.id : 'https://drive.google.com/file/d/' + x.id + '/view';
    return '<li class="' + (x.folder ? 'isdir' : '') + '"><a href="' + esc(href) + '" data-title="' + esc(x.name) + '"><span class="ft">' +
      fileKind(x.mime) + '</span>' + esc(label || x.name) + (x.folder ? ' <span class="chev">&rsaquo;</span>' : '') + '</a></li>';
  }
  function renderLt() {
    var part = state.ltPart, cfg = LT_PARTS[part], data = state.ltCache[cfg.folder || 'macros'].data;
    var h = '';
    if (cfg.check) h += ltSelBarHtml() + '<div class="noteflash" id="lt-flash" hidden></div>';
    if (part === 'macros') h += '<div class="noteflash" id="lt-flash" hidden></div>';
    if (cfg.search || part === 'macros') {
      h += '<input class="searchbox" id="lt-q" type="search" autocomplete="off" placeholder="' +
        esc(cfg.search || 'Search items, ingredients, categories') + '">';
    }
    h += '<div id="lt-list"></div>';
    if (cfg.sheet) h += '<a class="foldlink sheetlink" data-external target="_blank" rel="noopener" href="' + esc(cfg.sheet) + '">Open sheet to edit &#8599;</a>';
    else h += '<a class="linkrow" data-title="' + esc(cfg.label) + '" href="https://drive.google.com/drive/folders/' + cfg.folder + '">Open folder &rsaquo;</a>';
    $('lt-body').innerHTML = h;
    var q = $('lt-q');
    var paint = function () {
      var term = q ? q.value.trim().toLowerCase() : '';
      $('lt-list').innerHTML = part === 'macros' ? macrosHtml(data, term) : ltFolderHtml(data, cfg, term);
    };
    if (q) q.addEventListener('input', paint);
    state.ltPaint = paint;
    var c0 = state.ltCache.macros;
    if (cfg.check) ltSelPrune(data.items, c0 && c0.data ? c0.data.items.filter(function (x) { return !(x.sources && x.sources.length); }) : null);
    if (cfg.check) ltSelBar();
    paint();
    if (cfg.check) {
      if (state.ltAddedFlash) { macFlash(state.ltAddedFlash); state.ltAddedFlash = ''; }
      ltEnsureMacros(function () {
        if (state.ltPart !== 'recipes' || !$('lt-list')) return;
        var cc = state.ltCache.macros; if (!cc || !cc.data) return; ltSelPrune(data.items, cc.data.items.filter(function (x) { return !(x.sources && x.sources.length); })); ltSelBar(); paint();
      });
    }
  }
  function ltFolderHtml(d, cfg, term) {
    var all = cfg.check ? d.items.concat(ltAddedEntries()) : d.items;
    var items = all.filter(function (x) { return !term || x.name.toLowerCase().indexOf(term) >= 0; });
    if (!items.length) return '<div class="loading">' + (term ? 'No matches.' : 'This folder is empty.') + '</div>';
    var foot = '<div class="foot">' + items.length + ' of ' + all.length + ' item' + (all.length === 1 ? '' : 's') + '</div>';
    if (cfg.sort === 'az') {
      items = items.slice().sort(function (a, b) {
        if (!!a.folder !== !!b.folder) return a.folder ? -1 : 1;
        return a.name.replace(/\.(docx?|pdf)\s*$/i, '').localeCompare(b.name.replace(/\.(docx?|pdf)\s*$/i, ''), 'en', { numeric: true, sensitivity: 'base' });
      });
      if (cfg.check && state.ltCache.macros && state.ltCache.macros.data) return foot + ltGroupedHtml(items, term);
      return foot + '<div class="card"><ul class="doclist folderlist' + (cfg.check ? ' ltchecklist' : '') + '">' + items.map(function (x) {
        var label = x.name.replace(/\.(docx?|pdf)$/i, '').trim();
        return cfg.check && !x.folder ? ltCheckRow(x, x.added ? x.name : label) : ltItemLink(x, label);
      }).join('') + '</ul></div>';
    }
    if (cfg.sort === 'date') {
      var dated = items.map(function (x) { return { x: x, d: x.folder ? null : menuDate(x.name) }; });
      dated.sort(function (a, b) {
        if (a.d && b.d) return b.d - a.d || a.x.name.localeCompare(b.x.name);
        return a.d ? -1 : b.d ? 1 : a.x.name.localeCompare(b.x.name);
      });
      var groups = [], cur = null;
      dated.forEach(function (e) {
        var g = e.d ? String(e.d.getFullYear()) : 'Other';
        if (!cur || cur.name !== g) { cur = { name: g, rows: [] }; groups.push(cur); }
        cur.rows.push(e);
      });
      return foot + groups.map(function (g) {
        return '<div class="card bizgroup"><h4 class="sechead">' + esc(g.name) + '</h4><ul class="doclist folderlist">' + g.rows.map(function (e) {
          var label = e.d ? 'Week of ' + e.d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : e.x.name;
          var ext = (e.x.name.match(/\.(\w+)\s*$/) || [])[1];
          return ltItemLink(e.x, e.d && /^menu week of/i.test(e.x.name.trim()) ? label + (ext && ext.toLowerCase() !== 'docx' ? ' (' + ext.toLowerCase() + ')' : '') : e.x.name.replace(/\s+\./, '.'));
        }).join('') + '</ul></div>';
      }).join('');
    }
    return foot + '<div class="card"><ul class="doclist folderlist">' + items.map(function (x) { return ltItemLink(x); }).join('') + '</ul></div>';
  }
  function fmtN(v) { return v === null || v === undefined || v === '' ? '—' : fmt(v); }
  function macrosHtml(d, term) {
    var items = d.items.filter(function (x) {
      return !term || (x.item + ' ' + x.category + ' ' + x.ingredients + ' ' + x.notes).toLowerCase().indexOf(term) >= 0;
    });
    if (!items.length) return '<div class="loading">' + (term ? 'No matches.' : 'No items in the sheet yet.') + '</div>';
    var h = '<div class="card mac"><div class="mac-head"><span></span><span style="text-align:left">Item</span><span>Calories</span><span>Protein</span><span>Carbs</span><span>Fat</span></div>';
    var cats = d.categories.filter(function (c) { return items.some(function (x) { return x.category === c; }); });
    var done = d.items.filter(macIsMeasured).length;
    cats.forEach(function (c) {
      h += '<div class="mac-cat">' + esc(c) + '</div>';
      items.forEach(function (x, i) {
        if (x.category !== c) return;
        var idx = d.items.indexOf(x), meas = macIsMeasured(x);
        h += '<div class="mac-row' + (meas ? ' measured' : '') + '" data-mac="' + idx + '" role="button" tabindex="0" aria-label="' + esc(x.item) + ': ' + (meas ? 'measured' : 'estimate, to be measured') + '. Tap to enter measured numbers">' +
          '<span class="macck' + (meas ? ' on' : '') + '" aria-hidden="true">' + (meas ? '\u2713' : '') + '</span>' +
          '<div class="mac-name">' + esc(x.item) + (x.serving ? '<small>' + esc(x.serving) + '</small>' : '') + '</div>' +
          '<div class="cell">' + fmtN(x.cal) + '</div><div class="cell">' + fmtN(x.protein) + '</div><div class="cell">' + fmtN(x.carbs) + '</div><div class="cell">' + fmtN(x.fat) + '</div></div>';
      });
    });
    h += '</div><div class="foot">' + done + ' of ' + d.items.length + ' measured \u00b7 \u2713 = measured, empty circle = estimate \u00b7 per serving \u00b7 kcal, g, g, g \u00b7 tap a row to enter the measured numbers</div>';
    return h;
  }
  /* ---------------- Lisa's Table: Menu Items checklist (#lt/recipes) -> Generate menu (#lt/menu-gen) ---------------- */
  // Selection = [{id (Drive file id), n (file name)}] in the order ticked; kept in localStorage so it survives navigation and reloads.
  // Generate menu builds the weekly menu in the same layout as the Menu Designs docs; "Save to Menu Designs" calls the menusave action.
  var LT_SEL_KEY = 'cc_ltsel', LT_PRICE_KEY = 'cc_ltprice', LT_MGD_KEY = 'cc_mgdraft';
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ltSel() {
    if (!state.ltSel) {
      var a = lsGet(LT_SEL_KEY, []);
      state.ltSel = Array.isArray(a) ? a.filter(function (x) { return x && x.id; }).map(function (x) { return { id: String(x.id), n: String(x.n || '') }; }) : [];
    }
    return state.ltSel;
  }
  function ltSelSave() { lsSet(LT_SEL_KEY, ltSel()); }
  function ltSelIdx(id) { var s = ltSel(); for (var i = 0; i < s.length; i++) if (s[i].id === id) return i; return -1; }
  function ltSelToggle(id, name) {
    var i = ltSelIdx(id);
    if (i >= 0) ltSel().splice(i, 1); else ltSel().push({ id: id, n: name });
    ltSelSave(); ltSelBar();
    return i < 0;
  }
  function ltSelPrune(items, macItems) {      // drop selected files that are no longer in the folder (and added items no longer in the sheet)
    if (!items || !items.length) return;
    var have = {}; items.forEach(function (x) { have[x.id] = 1; });
    if (macItems) macItems.forEach(function (x) { have['added:' + x.item] = 1; });
    var s = ltSel(), keep = s.filter(function (x) { return have[x.id] || (!macItems && x.id.indexOf('added:') === 0); });
    if (keep.length !== s.length) { state.ltSel = keep; ltSelSave(); }
  }
  function ltSelBar() {
    var n = ltSel().length, c = $('lt-selcount'), b = $('lt-gen'), k = $('lt-selclear');
    if (c) c.textContent = n + ' selected';
    if (b) b.disabled = n === 0;
    if (k) k.hidden = n === 0;
  }
  function ltSelBarHtml() {
    var n = ltSel().length;
    return '<div class="ltbar" id="lt-selbar"><span class="ltcount" id="lt-selcount">' + n + ' selected</span>' +
      '<button type="button" class="navbtn ltgen" id="lt-gen" data-ltk="gen"' + (n ? '' : ' disabled') + '>Generate menu</button>' +
      '<button type="button" class="ltclear" id="lt-selclear" data-ltk="clear"' + (n ? '' : ' hidden') + '>Clear</button>' +
      '<button type="button" class="ltplus" data-ltk="add" aria-label="Add menu item" title="Add menu item">+</button></div>';
  }
  function ltAddedEntries() {      // sheet-only menu items (no Source doc): added from the app, no Drive file
    var c = state.ltCache.macros, out = [];
    if (c && c.data) c.data.items.forEach(function (it, i) { if (!(it.sources && it.sources.length)) out.push({ id: 'added:' + it.item, name: it.item, added: true, idx: i, mime: '' }); });
    return out;
  }
  function ltEnsureMacros(cb) {
    var c = state.ltCache.macros;
    if (c && Date.now() - c.at < LT_TTL * 5) { cb && cb(); return; }
    if (state.ltMacBusy) { if (cb) setTimeout(function () { ltEnsureMacros(cb); }, 1500); return; }
    state.ltMacBusy = true;
    apiRaw('ltmacros', {}).then(function (j) {
      state.ltMacBusy = false;
      if (j.error || !j.data) { cb && cb(); return; }
      state.ltCache.macros = { at: Date.now(), data: j.data }; cb && cb();
    }, function (err) { state.ltMacBusy = false; cb && cb(); vAuth(err); });
  }
  // ---- Menu Items grouped by macros-sheet category (collapsible; state in localStorage cc_ltcat = {category: true when collapsed}) ----
  var LT_CAT_KEY = 'cc_ltcat';
  function ltCatOf(items) {          // file/added entry -> category (matched to the macros sheet like Generate menu does; no match -> Other)
    var m = state.ltCache.macros.data, memo = state.ltCatMemo;
    if (!memo || memo.at !== state.ltCache.macros.at || memo.n !== m.items.length) memo = state.ltCatMemo = { at: state.ltCache.macros.at, n: m.items.length, map: {} };
    return items.map(function (x) {
      if (memo.map[x.id] === undefined) {
        var it = x.added ? m.items[x.idx] : mgMatch({ id: x.id, n: x.name }, m.items);
        memo.map[x.id] = (it && it.category) || 'Other';
      }
      return memo.map[x.id];
    });
  }
  function ltGroupedHtml(items, term) {
    var m = state.ltCache.macros.data, folders = items.filter(function (x) { return x.folder; }), files = items.filter(function (x) { return !x.folder; });
    var cats = ltCatOf(files), by = {}, order = [];
    (m.categories || []).forEach(function (c) { if (c !== 'Other') order.push(c); });
    files.forEach(function (x, i) { var c = cats[i]; if (c !== 'Other' && order.indexOf(c) < 0) order.push(c); (by[c] = by[c] || []).push(x); });
    order.push('Other');
    var col = lsGet(LT_CAT_KEY, {}), h = '';
    if (folders.length) h += '<div class="card"><ul class="doclist folderlist">' + folders.map(function (x) { return ltItemLink(x, x.name.replace(/\.(docx?|pdf)$/i, '').trim()); }).join('') + '</ul></div>';
    order.forEach(function (c) {
      var list = by[c]; if (!list || !list.length) return;
      var closed = !term && !!col[c], tk = list.filter(function (x) { return ltSelIdx(x.id) >= 0; }).length;
      h += '<div class="card ltgroup" data-cat="' + esc(c) + '"><button type="button" class="ltcat" data-ltcat="' + esc(c) + '" aria-expanded="' + !closed + '"><span class="ltchev">' + (closed ? '\u25b8' : '\u25be') + '</span><span class="ltcatname">' + esc(c) + '</span>' +
        '<small class="ltcatn">' + list.length + (list.length === 1 ? ' item' : ' items') + (tk ? ' \u00b7 ' + tk + ' ticked' : '') + '</small></button>' +
        '<ul class="doclist folderlist ltchecklist"' + (closed ? ' hidden' : '') + '>' + list.map(function (x) {
          return ltCheckRow(x, x.added ? x.name : x.name.replace(/\.(docx?|pdf)$/i, '').trim());
        }).join('') + '</ul></div>';
    });
    return h;
  }
  function ltCatRecount(g) {
    if (!g) return;
    var tot = g.querySelectorAll('.ltbox').length, tk = g.querySelectorAll('.ltbox.on').length, n = g.querySelector('.ltcatn');
    if (n) n.textContent = tot + (tot === 1 ? ' item' : ' items') + (tk ? ' \u00b7 ' + tk + ' ticked' : '');
  }
  // ---- sheet price on each Menu Items row (column "Price" of the Menu Macros sheet; tap to edit, saves with ltpriceset, optimistic) ----
  function ltPriceTxt(p) { p = Number(p); return '$' + (p === Math.floor(p) ? String(p) : p.toFixed(2)); }
  function ltMacIdx(x) {            // Menu Items row (file or sheet-only entry) -> index of its Menu Macros item, or -1
    var c = state.ltCache.macros; if (!c || !c.data) return -1;
    if (x.added) return x.idx;
    var it = mgMatch({ id: x.id, n: x.name }, c.data.items);
    return it ? c.data.items.indexOf(it) : -1;
  }
  function ltPriceChip(idx) {
    var c = state.ltCache.macros; if (!c || !c.data || idx < 0 || !c.data.items[idx]) return '';
    var it = c.data.items[idx], p = it.price;
    return '<button type="button" class="ltprice' + (p == null ? ' none' : '') + '" data-ltprice="' + idx + '" aria-label="Price for ' + esc(it.item) + ': ' + (p == null ? 'not set, tap to set' : ltPriceTxt(p) + ', tap to change') + '">' + (p == null ? '+ $' : esc(ltPriceTxt(p))) + '</button>';
  }
  function ltPriceEdit(btn) {
    var idx = +btn.getAttribute('data-ltprice'), it = state.ltCache.macros.data.items[idx]; if (!it) return;
    var inp = document.createElement('input');
    inp.type = 'text'; inp.className = 'wlin ltpin'; inp.setAttribute('inputmode', 'decimal'); inp.maxLength = 7; inp.setAttribute('data-ltpin', idx);
    inp.setAttribute('aria-label', 'Price for ' + it.item); inp.placeholder = '$'; inp.value = it.price == null ? '' : String(it.price);
    btn.parentNode.replaceChild(inp, btn); inp.focus(); try { inp.select(); } catch (e) {}
    var done = false, finish = function (save) {
      if (done) return; done = true;
      var cur = inp.value;
      var chip = document.createElement('div'); chip.innerHTML = ltPriceChip(idx);
      if (inp.parentNode) inp.parentNode.replaceChild(chip.firstChild, inp);
      if (save) ltPriceSave(idx, cur);
    };
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); } });
    inp.addEventListener('blur', function () { finish(true); });
  }
  function ltPriceSave(idx, raw) {
    var c = state.ltCache.macros, it = c && c.data && c.data.items[idx]; if (!it) return;
    var s = String(raw == null ? '' : raw).replace(/[$,\s]/g, ''), n = null;
    if (s !== '') {
      if (!/^\d{1,4}(\.\d{1,2})?$/.test(s) || Number(s) > 500) { macFlash('Price must be a number from 0 to 500, like 12 or 12.50.'); return; }
      n = Number(s);
    }
    var old = it.price == null ? null : it.price;
    if (n === old) return;
    it.price = n;                                   // optimistic: show it now, undo below if the server says no
    var repaint = function () { var b = $('lt-body').querySelector('[data-ltprice="' + idx + '"]'); if (b) { var t = document.createElement('div'); t.innerHTML = ltPriceChip(idx); b.parentNode.replaceChild(t.firstChild, b); } };
    repaint();
    if (n != null) { var pm = lsGet(LT_PRICE_KEY, {}); pm[mgNorm(it.item)] = String(n); lsSet(LT_PRICE_KEY, pm); }
    apiRaw('ltpriceset', { item: it.item, price: n == null ? '' : String(n), cid: vNewCid() }).then(function (j) {
      if (!j.error) { macFlash(''); return; }
      it.price = old; repaint();
      macFlash(j.error === 'bad_action' ? 'Saving prices will work after the next server update.' : (j.message || ('Server error: ' + j.error)) + ' The price was not changed.');
    }, function (err) {
      it.price = old; repaint();
      if (vAuth(err)) return;
      macFlash(friendly(err) + ' The price was not changed.');
    });
  }
  function ltCheckRow(x, label) {
    var on = ltSelIdx(x.id) >= 0, chip = ltPriceChip(ltMacIdx(x));
    if (x.added) {
      return '<li class="ltck"><button type="button" class="ltbox' + (on ? ' on' : '') + '" data-ltsel="' + esc(x.id) + '" data-n="' + esc(x.name) + '" role="checkbox" aria-checked="' + on + '" aria-label="Select ' + esc(label) + '">' + (on ? '\u2713' : '') + '</button>' +
        '<button type="button" class="ltname" data-ltedit="' + x.idx + '"><span class="ft">added</span>' + esc(label) + '</button>' + chip + '</li>';
    }
    var href = 'https://drive.google.com/file/d/' + x.id + '/view';
    return '<li class="ltck"><button type="button" class="ltbox' + (on ? ' on' : '') + '" data-ltsel="' + esc(x.id) + '" data-n="' + esc(x.name) + '" role="checkbox" aria-checked="' + on + '" aria-label="Select ' + esc(label) + '">' + (on ? '\u2713' : '') + '</button>' +
      '<a href="' + esc(href) + '" data-title="' + esc(x.name) + '"><span class="ft">' + fileKind(x.mime) + '</span>' + esc(label) + '</a>' + chip + '</li>';
  }

  // ---- name matching (menu item files <-> Menu Macros rows) ----
  function mgNorm(s) {
    return String(s || '').toLowerCase().replace(/\.(docx?|pdf|gdoc|txt|rtf)\s*$/, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(function (t) {
      return t.length > 3 && /s$/.test(t) && !/ss$/.test(t) ? t.slice(0, -1) : t;
    }).join(' ');
  }
  function mgNoParen(s) { return String(s || '').replace(/\([^)]*\)/g, ' '); }
  function mgCleanName(fileName) { return String(fileName || '').replace(/\.(docx?|pdf|gdoc|txt|rtf)\s*$/i, '').replace(/\s+/g, ' ').trim(); }
  function mgMatch(sel, items) {
    items = items || [];
    var a = mgNorm(sel.n), byName = function (list) {
      var i, it, n1, n2;
      for (i = 0; i < list.length; i++) { it = list[i]; if (mgNorm(it.item) === a || mgNorm(mgNoParen(it.item)) === a) return it; }
      for (i = 0; i < list.length; i++) { it = list[i]; if ((it.sources || []).some(function (s) { return mgNorm(s.name) === a; })) return it; }
      for (i = 0; i < list.length; i++) {
        it = list[i]; n1 = mgNorm(mgNoParen(it.item)); n2 = (' ' + a + ' ');
        if (n1.length >= 5 && (n2.indexOf(' ' + n1 + ' ') >= 0 || (a.length >= 5 && (' ' + n1 + ' ').indexOf(' ' + a + ' ') >= 0))) return it;
      }
      return null;
    };
    var byId = items.filter(function (it) { return (it.sources || []).some(function (s) { return s.id && s.id === sel.id; }); });
    if (byId.length === 1) return byId[0];
    if (byId.length > 1) return byName(byId) || byId[0];
    return byName(items);
  }

  // ---- menu layout (mirrors apiMenuBlocks_ in Api.gs) ----
  var MG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MG_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  var MG_FOOT = [
    '$5 delivery fee will be added to all deliveries. If multiple orders at the same location exist the fee will be $3 Thank you for your understanding',
    'For preorders please text Lisa by Friday before delivery. Deliveries can be made Tuesday mid-morning',
    'Large or small Charcuterie boards available for preorder, Please text or call Lisa 209-768-9222'
  ];
  function mgOrd(n) { var s = n % 100; return n + ((s >= 11 && s <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'); }
  function mgDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], 12);
    return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function mgIso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function mgNextMonday(from) {
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12), add = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + add); return d;
  }
  function mgAddDays(iso, n) { var d = mgDate(iso); if (!d) return ''; d.setDate(d.getDate() + n); return mgIso(d); }
  function mgPrice(v) {          // '12' -> '$12', '12.5' -> '$12.50', '' -> '', not a price -> null
    var s = String(v == null ? '' : v).replace(/[$\s]/g, '');
    if (s === '') return '';
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
    var n = Number(s);
    return '$' + (n === Math.floor(n) ? String(n) : n.toFixed(2));
  }
  function mgBlocks(week, deliver, rows) {
    var b = [{ t: 'title', text: 'Lisa\'s Table Menu' }];
    b.push({ t: 'week', text: week ? 'Menu week of ' + MG_MONTHS[week.getMonth()] + ' ' + mgOrd(week.getDate()) : 'Menu week of \u2026' });
    b.push({ t: 'deliv', text: deliver ? 'DELIVERY OR PICKUP ON ' + MG_DAYS[deliver.getDay()] + ' THE ' + mgOrd(deliver.getDate()).toUpperCase() : 'DELIVERY OR PICKUP ON \u2026' });
    b.push({ t: 'div', text: '\u25C6' });
    rows.forEach(function (r) {
      var nm = String(r.name || '').replace(/\s+/g, ' ').trim(); if (!nm) return;
      var pr = mgPrice(r.price);
      b.push({ t: 'item', text: nm + (pr ? ' ' + pr : '') });
      var ds = String(r.desc || '').replace(/\s+/g, ' ').trim();
      if (ds) b.push({ t: 'desc', text: ds });
    });
    b.push({ t: 'div', text: '\u25C6' });
    MG_FOOT.forEach(function (f) { b.push({ t: 'foot', text: f }); });
    return b;
  }
  function mgText(blocks) {       // plain text for Copy: blank lines between the sections like the printed menu
    var out = [], prev = '';
    blocks.forEach(function (bl) {
      var gap = (bl.t === 'div' || prev === 'div' || prev === 'deliv' || (bl.t === 'item' && prev) || bl.t === 'foot') && out.length;
      if (gap) out.push('');
      out.push(bl.text); prev = bl.t;
    });
    return out.join('\n');
  }

  var mg = { week: '', deliver: '', dTouched: false, ov: {}, macros: null, macState: '', cid: '', sig: '', saving: false, saved: null, seq: 0 };
  function mgDraftSave() { lsSet(LT_MGD_KEY, { week: mg.week, deliver: mg.deliver, dTouched: mg.dTouched, ov: mg.ov, at: Date.now() }); }
  function mgRows() {
    var items = (mg.macros && mg.macros.items) || [], prices = lsGet(LT_PRICE_KEY, {});
    return ltSel().map(function (s) {
      var m = mgMatch(s, items), dn = m ? m.item : mgCleanName(s.n), o = mg.ov[s.id] || {};
      return { id: s.id, sel: s, m: m, defName: dn, key: mgNorm(dn),
        name: o.name !== undefined ? o.name : dn,
        price: o.price !== undefined ? o.price : (m && m.price != null ? String(m.price) : (prices[mgNorm(dn)] || '')),
        desc: o.desc !== undefined ? o.desc : (m ? m.ingredients || '' : '') };
    });
  }
  function mgPreviewHtml(blocks) {
    return blocks.map(function (bl) { return '<div class="mp-' + bl.t + '">' + esc(bl.text) + '</div>'; }).join('');
  }
  function mgRefresh() {
    var rows = mgRows(), blocks = mgBlocks(mgDate(mg.week), mgDate(mg.deliver), rows);
    var pv = $('mg-preview'); if (pv) pv.innerHTML = mgPreviewHtml(blocks);
    var bad = rows.filter(function (r) { return String(r.name || '').trim() && mgPrice(r.price) === null; });
    var sv = $('mg-save'); if (sv) sv.disabled = !!mg.saving || !mgDate(mg.week) || !mgDate(mg.deliver) || !rows.some(function (r) { return String(r.name || '').trim(); }) || bad.length > 0;
    var wn = $('mg-warn'); if (wn) { wn.hidden = !bad.length; wn.textContent = bad.length ? 'Fix the price for ' + bad[0].name + ' (like 12 or 12.50).' : ''; }
    return { rows: rows, blocks: blocks };
  }
  function mgRowsHtml() {
    var rows = mgRows();
    return rows.map(function (r, i) {
      return '<div class="card mgrow" data-id="' + esc(r.id) + '"><div class="mgrowtop"><span class="mgnum">' + (i + 1) + '</span>' +
        '<input type="text" class="wlin mgin" data-mgf="name" data-id="' + esc(r.id) + '" maxlength="120" value="' + esc(r.name) + '" aria-label="Menu item name">' +
        '<span class="mgdollar">$</span><input type="text" class="wlin mgprice' + (mgPrice(r.price) === null ? ' bad' : '') + '" data-mgf="price" data-id="' + esc(r.id) + '" inputmode="decimal" maxlength="8" placeholder="price" value="' + esc(String(r.price).replace(/^\$/, '')) + '" aria-label="Price"></div>' +
        '<textarea class="notebox mgdesc" data-mgf="desc" data-id="' + esc(r.id) + '" rows="2" maxlength="300" placeholder="ingredients line" aria-label="Ingredients">' + esc(r.desc) + '</textarea>' +
        (r.m ? '' : '<small class="mgnomatch">No macros match yet \u2014 type the ingredients.</small>') + '</div>';
    }).join('');
  }
  function mgMacrosHtml() {
    var rows = mgRows(), t = { cal: 0, protein: 0, carbs: 0, fat: 0 }, n = 0, cats = {}, order = [], un = [];
    rows.forEach(function (r) {
      if (!r.m) { un.push(r); return; }
      n++; ['cal', 'protein', 'carbs', 'fat'].forEach(function (k) { t[k] += Number(r.m[k]) || 0; });
      var c = r.m.category || 'Other'; if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(r);
    });
    if (!rows.length) return '';
    var h = '<div class="card mac mgmac"><h3 class="sechead">Macros <small>for you, not on the menu</small></h3>';
    if (mg.macState === 'loading') h += '<div class="foot">Loading macros\u2026</div>';
    else if (mg.macState === 'na') h += '<div class="foot">Macros aren\u2019t available yet (server update pending). The menu above still works.</div>';
    else if (mg.macState === 'err') h += '<div class="foot">Couldn\u2019t load macros. The menu above still works.</div>';
    order.forEach(function (c) {
      h += '<div class="mac-cat">' + esc(c) + '</div>';
      cats[c].forEach(function (r) {
        var x = r.m;
        h += '<div class="mgm"><div class="mgmn">' + esc(x.item) + (x.measured || /^measured/i.test(x.basis || '') ? '' : ' <span class="mgest">est.</span>') + (x.serving ? '<small>' + esc(x.serving) + '</small>' : '') + '</div>' +
          '<div class="mgmv">' + fmtN(x.cal) + ' cal \u00b7 ' + fmtN(x.protein) + 'P \u00b7 ' + fmtN(x.carbs) + 'C \u00b7 ' + fmtN(x.fat) + 'F</div></div>';
      });
    });
    if (n) h += '<div class="mgm mgtot"><div class="mgmn">Total' + (n < rows.length ? ' (' + n + ' of ' + rows.length + ' with macros)' : '') + '</div><div class="mgmv">' +
      fmt(t.cal) + ' cal \u00b7 ' + fmt(t.protein) + 'P \u00b7 ' + fmt(t.carbs) + 'C \u00b7 ' + fmt(t.fat) + 'F</div></div>';
    if (un.length) h += '<div class="foot">No macros found for: ' + un.map(function (r) { return esc(r.name); }).join(', ') + '</div>';
    return h + '</div>';
  }
  function mgOnScreen() { return state.ltPart === 'menu-gen' && $('screen-lt').classList.contains('active'); }
  function openMenuGen() {
    var sel = ltSel();
    if (!sel.length) {
      $('lt-body').innerHTML = '<div class="loading">Nothing is selected yet. Tick some items on the Menu Items screen first.</div><button type="button" class="navbtn wladd" data-go="lt/recipes">&lsaquo; Back to Menu Items</button>';
      return;
    }
    var d = lsGet(LT_MGD_KEY, null);
    mg.ov = {}; mg.saved = null; mg.saving = false;
    var ok = d && Date.now() - (d.at || 0) < 3 * 24 * 3600 * 1000 && mgDate(d.week);
    var def = mgIso(mgNextMonday(new Date()));
    mg.week = ok && mgDate(d.week) >= mgDate(mgIso(new Date())) ? d.week : def;
    mg.dTouched = !!(ok && d.dTouched && mg.week === d.week);
    mg.deliver = mg.dTouched ? d.deliver : mgAddDays(mg.week, 1);
    mg.ov = ok && d.ov && typeof d.ov === 'object' ? d.ov : {};
    $('lt-body').innerHTML =
      '<div class="mg">' +
      '<div class="card vform mgdates"><label class="vfield"><span>Menu week of</span><input type="date" class="wlin" id="mg-week" value="' + esc(mg.week) + '"></label>' +
      '<label class="vfield"><span>Delivery or pickup day</span><input type="date" class="wlin" id="mg-deliv" value="' + esc(mg.deliver) + '"></label></div>' +
      '<h3 class="sechead">Items <small>' + sel.length + ' \u00b7 in the order you ticked them</small></h3>' +
      '<div id="mg-rows">' + mgRowsHtml() + '</div>' +
      '<div class="noteflash show bad" id="mg-warn" hidden></div>' +
      '<h3 class="sechead">Preview</h3><div class="mpaper" id="mg-preview"></div>' +
      '<div class="draftbtns mgbtns"><button type="button" class="navbtn" data-mg="copy">Copy text</button><button type="button" class="bigsave" id="mg-save" data-mg="save">Save to Menu Designs</button></div>' +
      '<div class="draftbtns mgbtns"><button type="button" class="navbtn" id="mg-orders-btn" data-mg="orders">Use for orders</button></div>' +
      '<div class="noteflash" id="mg-flash" hidden></div><div id="mg-saved"></div><div class="noteflash" id="mg-ordmsg" hidden></div>' +
      '<div id="mg-macros"></div>' +
      '<button type="button" class="navbtn wladd" data-go="lt/recipes">&lsaquo; Back to Menu Items</button></div>';
    mgRefresh();
    var seq = ++mg.seq, c = state.ltCache.macros;
    if (c && Date.now() - c.at < LT_TTL * 5) { mg.macros = c.data; mg.macState = 'ok'; mgMacrosPaint(true); return; }
    mg.macros = c ? c.data : null; mg.macState = 'loading'; mgMacrosPaint(false);
    apiRaw('ltmacros', {}).then(function (j) {
      if (seq !== mg.seq || !mgOnScreen()) return;
      if (j.error === 'bad_action') { mg.macState = 'na'; return mgMacrosPaint(false); }
      if (j.error) { mg.macState = 'err'; return mgMacrosPaint(false); }
      state.ltCache.macros = { at: Date.now(), data: j.data }; mg.macros = j.data; mg.macState = 'ok'; mgMacrosPaint(true);
    }, function (err) { if (vAuth(err)) return; if (seq === mg.seq && mgOnScreen()) { mg.macState = 'err'; mgMacrosPaint(false); } });
  }
  function mgMacrosPaint(rerows) {         // macros arrived: refresh matched names / ingredients (typed values are kept) and the macros card
    if (rerows) {
      var box = $('mg-rows'), active = document.activeElement;
      if (box && !(active && box.contains(active))) box.innerHTML = mgRowsHtml();
      mgRefresh();
    }
    var m = $('mg-macros'); if (m) m.innerHTML = mgMacrosHtml();
  }
  function mgFlash(text, bad) { var el = $('mg-flash'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function mgCopy() {
    var txt = mgText(mgRefresh().blocks);
    var done = function (ok) { mgFlash(ok ? 'Copied the menu text.' : 'Couldn\u2019t copy. Select the preview text and copy it by hand.', !ok); };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select(); var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { done(true); }, fallback); else fallback();
  }
  function mgSave() {
    if (mg.saving) return;
    var r = mgRefresh(), items = r.rows.filter(function (x) { return String(x.name || '').trim(); }).map(function (x) {
      return { name: String(x.name).replace(/\s+/g, ' ').trim(), price: String(x.price || '').replace(/[$\s]/g, ''), desc: String(x.desc || '').replace(/\s+/g, ' ').trim() };
    });
    var body = { week: mg.week, deliver: mg.deliver, items: items }, sig = JSON.stringify(body);
    if (!mgDate(mg.week) || !mgDate(mg.deliver) || !items.length) return mgFlash('Pick the week and delivery dates first.', true);
    if (mg.sig !== sig || !mg.cid) { mg.sig = sig; mg.cid = vNewCid(); }
    body.cid = mg.cid; mg.saving = true; mgFlash('Saving\u2026'); mgRefresh();
    apiPostRaw('menusave', body, 90000).then(function (j) {
      mg.saving = false; mgRefresh();
      if (!mgOnScreen()) return;
      if (j.error === 'bad_action') return mgFlash('Saving will work after the next server update.', true);
      if (j.error) return mgFlash((j.message || ('Server error: ' + j.error)) + ' Nothing was saved.', true);
      var d = j.data || {};
      mg.saved = { sig: sig, url: d.url || '', name: d.name || '' };
      mgFlash('');
      mgWeekMenu(true);
      $('mg-saved').innerHTML = '<div class="noteflash show">Saved' + (d.name ? ' as \u201c' + esc(d.name) + '\u201d' : '') + ' in Menu Designs.' + (d.url ? ' <a class="mgopen" href="' + esc(d.url) + '" data-title="' + esc(d.name || 'Menu') + '">Open &rsaquo;</a>' : '') + '</div>';
    }, function (err) {
      mg.saving = false; mgRefresh();
      if (vAuth(err)) return;
      mgFlash(friendly(err) + ' Tap Save again to retry (same entry id, it will not double).', true);
    });
  }
  // ---- the chosen menu for the week -> Orders (weekmenuset; Week Menus tab). Runs after a successful menusave, or from the "Use for orders" button. ----
  function mgOrdMsg(text, bad) { var el = $('mg-ordmsg'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function mgWeekMenu(auto) {
    var r = mgRefresh(), items = [], week = odMonday(mg.week);
    r.rows.forEach(function (x) {
      var nm = String(x.name || '').replace(/\s+/g, ' ').trim(); if (!nm) return;
      var pr = mgPrice(x.price);
      if (pr === null) return;
      items.push({ item: nm, price: pr ? Number(pr.replace('$', '')) : '' });
    });
    if (!week || !items.length) { if (!auto) mgOrdMsg('Pick the menu week and at least one item first.', true); return; }
    var body = { week: week, items: items }, sig = JSON.stringify(body);
    if (mg.wmSig !== sig || !mg.wmCid) { mg.wmSig = sig; mg.wmCid = vNewCid(); }
    body.cid = mg.wmCid; mgOrdMsg('Saving this menu for Orders\u2026');
    return apiPostRaw('weekmenuset', body, 60000).then(function (j) {
      if (!mgOnScreen()) return;
      if (j.error === 'bad_action') return mgOrdMsg('Orders will work after the next server update. (Your menu is not set for Orders yet.)', true);
      if (j.error) return mgOrdMsg((j.message || ('Server error: ' + j.error)) + ' The menu was not set for Orders.', true);
      delete od.byWeek[week];
      mgOrdMsg('Menu set for Orders (week of ' + odShort(week) + ', ' + items.length + ' item' + (items.length === 1 ? '' : 's') + ').', false);
    }, function (err) {
      if (vAuth(err)) return;
      if (mgOnScreen()) mgOrdMsg(friendly(err) + ' The menu was not set for Orders. Tap Use for orders to retry.', true);
    });
  }
  function mgInput(t) {
    var f = t.getAttribute('data-mgf'), id = t.getAttribute('data-id');
    if (!f) return false;
    if (!mg.ov[id]) mg.ov[id] = {};
    mg.ov[id][f] = t.value;
    if (f === 'price') t.classList.toggle('bad', mgPrice(t.value) === null);
    mgDraftSave(); mgRefresh();
    var sv = $('mg-saved'); if (sv && sv.innerHTML) sv.innerHTML = ''; mg.saved = null;
    return true;
  }
  function mgPriceRemember(t) {       // remember the last valid price per menu item
    var id = t.getAttribute('data-id'), pr = mgPrice(t.value);
    if (!pr) return;
    var r = mgRows().filter(function (x) { return x.id === id; })[0]; if (!r || !r.key) return;
    var p = lsGet(LT_PRICE_KEY, {}); p[r.key] = pr.replace(/^\$/, ''); lsSet(LT_PRICE_KEY, p);
  }

  $('lt-body').addEventListener('click', function (e) {
    var pb = e.target.closest('[data-ltprice]');
    if (pb && state.ltPart === 'recipes') { ltPriceEdit(pb); return; }
    var b = e.target.closest('[data-ltsel]');
    if (b && state.ltPart === 'recipes') {
      var on = ltSelToggle(b.getAttribute('data-ltsel'), b.getAttribute('data-n'));
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.textContent = on ? '\u2713' : '';
      ltCatRecount(b.closest('.ltgroup'));
      return;
    }
    var cg = e.target.closest('[data-ltcat]');
    if (cg && state.ltPart === 'recipes') {
      var grp = cg.closest('.ltgroup'), ul = grp.querySelector('ul'), q = $('lt-q'), cname = cg.getAttribute('data-ltcat');
      var nowClosed = !ul.hidden;
      ul.hidden = nowClosed; cg.setAttribute('aria-expanded', nowClosed ? 'false' : 'true'); cg.querySelector('.ltchev').textContent = nowClosed ? '\u25b8' : '\u25be';
      if (!(q && q.value.trim())) { var st = lsGet(LT_CAT_KEY, {}); if (nowClosed) st[cname] = true; else delete st[cname]; lsSet(LT_CAT_KEY, st); }
      return;
    }
    var ed = e.target.closest('[data-ltedit]');
    if (ed && state.ltPart === 'recipes') { macOpen(+ed.getAttribute('data-ltedit')); return; }
    var k = e.target.closest('[data-ltk]');
    if (k && state.ltPart === 'recipes') {
      var a = k.getAttribute('data-ltk');
      if (a === 'add') show('lt/menu-add');
      else if (a === 'gen' && ltSel().length) show('lt/menu-gen');
      else if (a === 'clear') {
        state.ltSel = []; ltSelSave(); ltSelBar();
        [].forEach.call($('lt-body').querySelectorAll('.ltbox.on'), function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); x.textContent = ''; });
        [].forEach.call($('lt-body').querySelectorAll('.ltgroup'), ltCatRecount);
      }
      return;
    }
    var m = e.target.closest('[data-mg]');
    if (m && state.ltPart === 'menu-gen') {
      var act = m.getAttribute('data-mg');
      if (act === 'copy') mgCopy(); else if (act === 'save') mgSave(); else if (act === 'orders') mgWeekMenu(false);
    }
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'menu-gen') return;
    var t = e.target;
    if (t.id === 'mg-week') {
      if (!mgDate(t.value)) return;
      mg.week = t.value;
      if (!mg.dTouched) { mg.deliver = mgAddDays(mg.week, 1); $('mg-deliv').value = mg.deliver; }
      mgDraftSave(); mgRefresh();
    } else if (t.id === 'mg-deliv') {
      if (!mgDate(t.value)) return;
      mg.deliver = t.value; mg.dTouched = true; mgDraftSave(); mgRefresh();
    } else mgInput(t);
  });
  $('lt-body').addEventListener('change', function (e) {
    if (state.ltPart === 'menu-gen' && e.target.getAttribute && e.target.getAttribute('data-mgf') === 'price') mgPriceRemember(e.target);
  });
  $('lt-body').addEventListener('focusout', function (e) {
    if (state.ltPart === 'menu-gen' && e.target.getAttribute && e.target.getAttribute('data-mgf') === 'price') mgPriceRemember(e.target);
  });

  /* ---------------- Lisa's Table: Menu Macros edit sheet (tap a row, dictate the measured numbers, confirm, Save -> ltmacroset) ---------------- */
  var MAC_DRAFT_KEY = 'cc_macdraft';
  var MAC_LIM = { cal: 5000, protein: 500, carbs: 500, fat: 500 };
  var MAC_KW = '(?:calories|calorie|cals|cal|kcal|protein|proteins|carbohydrates|carbohydrate|carbs|carb|fats|fat)';
  var MAC_KEYS = { cal: '(?:calories|calorie|cals|cal|kcal)', protein: '(?:proteins|protein)', carbs: '(?:carbohydrates|carbohydrate|carbs|carb)', fat: '(?:fats|fat)' };
  var NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  function macWords(s) {            // "four hundred and eighty" -> "480", "twenty four" -> "24"
    var toks = String(s).split(/(\s+)/), out = [], i = 0;
    while (i < toks.length) {
      var w = toks[i].toLowerCase().replace(/[^a-z-]/g, '');
      var isNum = function (x) { x = x.toLowerCase().replace(/[^a-z-]/g, ''); return x === 'hundred' || NUMW[x] !== undefined || (x.indexOf('-') > 0 && x.split('-').every(function (p) { return NUMW[p] !== undefined; })); };
      if (w && isNum(toks[i])) {
        var total = 0, cur = 0, j = i, last = i;
        while (j < toks.length) {
          var tk = toks[j];
          if (/^\s+$/.test(tk)) { j++; continue; }
          var x = tk.toLowerCase().replace(/[^a-z-]/g, '');
          if (x === 'and' && cur > 0 && /hundred/.test(toks.slice(i, j).join(' ').toLowerCase())) { j++; continue; }
          if (!x || !isNum(tk)) break;
          if (x === 'hundred') cur = (cur || 1) * 100;
          else if (x.indexOf('-') > 0) cur += x.split('-').reduce(function (a, p) { return a + NUMW[p]; }, 0);
          else cur += NUMW[x];
          last = j; j++;
        }
        total += cur; out.push(String(total)); i = last + 1;
      } else { out.push(toks[i]); i++; }
    }
    return out.join('');
  }
  // "calories 480 protein 24 carbs 30 fat 29 serving one burrito" (or "480 calories, 24 grams of protein ...") -> {cal,protein,carbs,fat,serving,notes,found}
  function macParse(text) {
    var src = String(text || '').replace(/\s+/g, ' ').trim(), serving = '', notes = '', m;
    if ((m = /\b(?:notes?|comments?)\b[\s:,\-]*(.*)$/i.exec(src))) { notes = m[1].trim(); src = src.slice(0, m.index); }
    if ((m = /\bserving(?:\s+size)?\b[\s:,\-]*(?:is|of|equals|=)?\s*(.*)$/i.exec(src))) {
      var rest = m[1], ix = rest.search(new RegExp('\\b' + MAC_KW + '\\b', 'i')), seg = ix >= 0 ? rest.slice(0, ix) : rest, remain = ix >= 0 ? rest.slice(ix) : '';
      var tail = /[\s,]*\d+(?:\.\d+)?(?:\s*(?:g|grams?|gram|of|and|,))*\s*$/i.exec(seg);
      if (tail && tail.index > 0) { remain = seg.slice(tail.index) + ' ' + remain; seg = seg.slice(0, tail.index); }
      serving = seg.replace(/^[\s,.:\-]+|[\s,.:\-]+$/g, '').slice(0, 80);
      src = src.slice(0, m.index) + ' ' + remain;
    }
    var s = macWords(src.toLowerCase().replace(/(\d),(\d{3})/g, '$1$2')).replace(/[,;]+/g, ' ');
    var res = { A: {}, B: {}, ca: 0, cb: 0 };
    Object.keys(MAC_KEYS).forEach(function (k) {
      var ra = new RegExp('\\b' + MAC_KEYS[k] + '\\b[\\s:=\\-]*(?:is|are|of|at|about|around|equals|total)?[\\s:=\\-]*(\\d+(?:\\.\\d+)?)').exec(s);
      var rb = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:g|gr|grams?|gram|kcal|calories?|cals?)?\\s*(?:of\\s+)?(?:total\\s+)?\\b' + MAC_KEYS[k] + '\\b').exec(s);
      if (ra) { res.A[k] = ra[1]; res.ca++; }
      if (rb) { res.B[k] = rb[1]; res.cb++; }
    });
    var pick = res.cb > res.ca ? res.B : res.A;
    var out = { serving: serving, notes: notes, found: Object.keys(pick).length };
    Object.keys(MAC_KEYS).forEach(function (k) { out[k] = pick[k] !== undefined ? pick[k] : ''; });
    return out;
  }
  var mm = { idx: -1, rec: null, on: false, base: '', committed: '', interim: '', msg: '', cid: '', sig: '', busy: false, f: {}, text: '' };
  function macItem() { var c = state.ltCache.macros; return c && c.data && c.data.items[mm.idx] || null; }
  function macIsMeasured(x) { return x.measured !== undefined ? !!x.measured : /^measured/i.test(x.basis || ''); }
  function macDraftSave() { if (mm.idx < 0) return; var x = macItem(); lsSet(MAC_DRAFT_KEY, { item: x ? x.item : '', f: mm.f, text: mm.text, cid: mm.cid, sig: mm.sig, at: Date.now() }); }
  function macField(k) { return $('mac-f-' + k); }
  function macRead() { ['cal', 'protein', 'carbs', 'fat', 'serving', 'notes'].forEach(function (k) { var el = macField(k); if (el) mm.f[k] = el.value; }); }
  function macMsg(text, bad) { var el = $('mac-msg'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function macUi() {
    var btn = $('mac-mic'); if (!btn) return;
    btn.classList.toggle('rec', mm.on); btn.setAttribute('aria-pressed', mm.on ? 'true' : 'false');
    $('mac-lbl').textContent = mm.on ? 'Listening\u2026 tap to stop' : 'Tap to talk';
    var st = $('mac-state'); st.className = 'micstate' + (mm.on ? ' rec' : '') + (mm.msg && !mm.on ? ' warn' : '');
    st.textContent = mm.on ? 'Listening\u2026' : (mm.msg || 'Say the measured numbers. They fill the boxes below; nothing is saved until you tap Save.');
  }
  function macOpen(idx) {
    var c = state.ltCache.macros; if (!c || !c.data.items[idx]) return;
    macClose(true);
    var x = c.data.items[idx], measured = macIsMeasured(x), d = lsGet(MAC_DRAFT_KEY, null);
    mm.idx = idx; mm.msg = ''; mm.busy = false; mm.on = false; mm.rec = null; mm.text = ''; mm.cid = ''; mm.sig = '';
    mm.f = { cal: measured && x.cal != null ? String(x.cal) : '', protein: measured && x.protein != null ? String(x.protein) : '', carbs: measured && x.carbs != null ? String(x.carbs) : '',
      fat: measured && x.fat != null ? String(x.fat) : '', serving: x.serving || '', notes: x.notes || '' };
    var restored = false;
    if (d && d.item === x.item && Date.now() - (d.at || 0) < 12 * 3600 * 1000 && d.f) { mm.f = d.f; mm.text = d.text || ''; mm.cid = d.cid || ''; mm.sig = d.sig || ''; restored = true; }
    var src = (x.sources || []).map(function (s) {
      return s.id ? '<a href="https://drive.google.com/file/d/' + esc(s.id) + '/view" data-title="' + esc(s.name) + '">' + esc(s.name.replace(/\s+\./, '.')) + '</a>' : esc(s.name);
    }).join(' \u00b7 ');
    var fld = function (k, label, ph) {
      return '<label class="vfield macf"><span>' + label + '</span><input type="text" class="wlin" id="mac-f-' + k + '" inputmode="decimal" maxlength="8" placeholder="' + esc(ph) + '" value="' + esc(mm.f[k] || '') + '" autocomplete="off"></label>';
    };
    var el = document.createElement('div');
    el.className = 'macsheet'; el.id = 'mac-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="macpanel"><div class="machead"><h3 id="mac-ttl">' + esc(x.item) + '</h3><button type="button" class="wlx" data-mac2="close" aria-label="Close">\u00d7</button></div>' +
      '<div class="macinfo">' + (measured ? '<span class="badge ok">' + esc(x.basis || 'Measured') + '</span>' : '<span class="badge">Estimate \u2014 to be measured</span>') +
      (x.category ? ' <span class="macsub">' + esc(x.category) + '</span>' : '') +
      (x.ingredients ? '<div><b>Key ingredients</b> ' + esc(x.ingredients) + '</div>' : '') +
      (src ? '<div><b>Source</b> ' + src + '</div>' : '') + '</div>' +
      '<div class="micstage macmic"><button type="button" class="micbtn" id="mac-mic" data-mac2="mic" aria-pressed="false" aria-label="Start dictation"><span class="micico" aria-hidden="true">' + vsvg('mic', 34) + '</span><span class="miclbl" id="mac-lbl">Tap to talk</span></button>' +
      '<div class="micstate" id="mac-state">&nbsp;</div></div>' +
      '<textarea id="mac-text" class="notebox" rows="2" maxlength="400" autocapitalize="off" placeholder="e.g. calories 480 protein 24 carbs 30 fat 29 serving one burrito"></textarea>' +
      '<div class="draftbtns"><button type="button" class="navbtn" data-mac2="parse">Fill the boxes</button></div>' +
      '<div class="macgrid">' + fld('cal', 'Calories', measured ? '' : 'est. ' + fmtN(x.cal)) + fld('protein', 'Protein g', measured ? '' : 'est. ' + fmtN(x.protein)) +
      fld('carbs', 'Carbs g', measured ? '' : 'est. ' + fmtN(x.carbs)) + fld('fat', 'Fat g', measured ? '' : 'est. ' + fmtN(x.fat)) + '</div>' +
      '<label class="vfield"><span>Serving</span><input type="text" class="wlin" id="mac-f-serving" maxlength="80" value="' + esc(mm.f.serving || '') + '" placeholder="e.g. 1 burrito"></label>' +
      '<label class="vfield"><span>Notes (optional)</span><textarea class="notebox" id="mac-f-notes" rows="2" maxlength="300">' + esc(mm.f.notes || '') + '</textarea></label>' +
      '<div class="noteflash" id="mac-msg" hidden></div>' +
      '<div class="draftbtns"><button type="button" class="bigsave" id="mac-save" data-mac2="save">Save as Measured</button><button type="button" class="navbtn" data-mac2="close">Cancel</button></div></div>';
    $('screen-lt').appendChild(el);
    $('mac-text').value = mm.text;
    document.body.classList.add('macopen');
    macUi();
    if (restored) macMsg('Restored your unsaved numbers. Nothing is saved until you tap Save.');
  }
  function macClose(quiet) {
    macMicStop(true);
    var el = $('mac-sheet'); if (el && el.parentNode) el.parentNode.removeChild(el);
    document.body.classList.remove('macopen');
    if (!quiet && mm.idx >= 0) { macRead(); macDraftSave(); }
    mm.idx = -1; mm.on = false; mm.rec = null;
  }
  function macMicStop(quiet) {
    var r = mm.rec;
    if (quiet) { mm.rec = null; mm.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { mm.rec = null; mm.on = false; macUi(); } }
  }
  function macMicFail(msg) { mm.on = false; var r = mm.rec; mm.rec = null; try { r && r.abort(); } catch (e) {} mm.msg = msg; macUi(); var ta = $('mac-text'); if (ta) ta.focus(); }
  function macMicStart() {
    var ta = $('mac-text');
    if (!SR) { mm.msg = MIC_NA; macUi(); ta.focus(); return; }
    mm.msg = ''; mm.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; mm.committed = ''; mm.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return macMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) mm.committed = micSpace(mm.committed, t.trim() + ' '); else interim += t;
      }
      mm.interim = interim.replace(/^\s+/, ''); ta.value = mm.base + mm.committed + mm.interim;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return macMicFail(MIC_NA);
      if (e === 'network') return macMicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') mm.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (mm.rec !== rec) return;
      mm.committed = micSpace(mm.committed, mm.interim ? mm.interim.trim() + ' ' : ''); mm.interim = '';
      mm.on = false; mm.rec = null;
      ta.value = (mm.base + mm.committed).replace(/\s+$/, ''); mm.text = ta.value;
      if (ta.value.trim()) macFill(); else macUi();
    };
    mm.rec = rec; mm.on = true;
    try { rec.start(); } catch (e2) { return macMicFail(MIC_NA); }
    macUi();
  }
  function macFill() {              // transcript -> boxes (only boxes that were heard are changed); the user reviews, then taps Save
    var ta = $('mac-text'); if (!ta) return;
    mm.text = ta.value; var p = macParse(ta.value), got = [];
    ['cal', 'protein', 'carbs', 'fat'].forEach(function (k) { if (p[k] !== '') { macField(k).value = p[k]; got.push(k); } });
    if (p.serving) { macField('serving').value = p.serving; got.push('serving'); }
    if (p.notes) { macField('notes').value = p.notes; got.push('notes'); }
    macRead(); macDraftSave(); macUi();
    var miss = ['cal', 'protein', 'carbs', 'fat'].filter(function (k) { return !String(mm.f[k]).trim(); });
    macMsg(!got.length ? 'Didn\u2019t hear any numbers. Try again, or type them in the boxes.' :
      'Check the boxes' + (miss.length ? ' \u2014 still missing: ' + miss.map(function (k) { return { cal: 'calories', protein: 'protein', carbs: 'carbs', fat: 'fat' }[k]; }).join(', ') : '') + '. Then tap Save as Measured.', !got.length);
  }
  function macSave() {
    if (mm.busy) return;
    var x = macItem(); if (!x) return;
    macRead();
    var body = { item: x.item }, errs = [], names = { cal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
    if (x.row) body.row = x.row;
    ['cal', 'protein', 'carbs', 'fat'].forEach(function (k) {
      var v = String(mm.f[k] == null ? '' : mm.f[k]).replace(/[,\s]/g, '');
      if (!/^\d+(\.\d+)?$/.test(v) || Number(v) > MAC_LIM[k]) errs.push(names[k] + (v === '' ? ' is empty' : ' must be a number from 0 to ' + MAC_LIM[k])); else body[k] = v;
    });
    if (errs.length) return macMsg(errs.join('. ') + '.', true);
    var sv = String(mm.f.serving || '').trim(), nt = String(mm.f.notes || '').trim();
    if (sv) body.serving = sv.slice(0, 80);
    if (nt && nt !== (x.notes || '').trim()) body.notes = nt.slice(0, 300);
    var sig = JSON.stringify(body);
    if (mm.sig !== sig || !mm.cid) { mm.sig = sig; mm.cid = vNewCid(); }
    body.cid = mm.cid; mm.busy = true; $('mac-save').disabled = true; $('mac-save').textContent = 'Saving\u2026'; macMsg(''); macDraftSave();
    var idx = mm.idx;
    apiRaw('ltmacroset', body).then(function (j) {
      mm.busy = false;
      var b = $('mac-save'); if (b) { b.disabled = false; b.textContent = 'Save as Measured'; }
      if (j.error === 'bad_action') return macMsg('Saving will work after the next server update.', true);
      if (j.error) return macMsg((j.message || ('Server error: ' + j.error)) + ' Nothing was changed.', true);
      var c = state.ltCache.macros, it = c && c.data.items[idx];
      var u = (j.data && j.data.item) || null;
      if (it) {
        ['cal', 'protein', 'carbs', 'fat'].forEach(function (k) { it[k] = u && u[k] != null ? u[k] : Number(body[k]); });
        it.basis = u && u.basis ? u.basis : 'Measured ' + vToday(); it.measured = true;
        if (u) { if (u.serving != null) it.serving = u.serving; if (u.notes != null) it.notes = u.notes; if (u.row) it.row = u.row; }
        else { if (body.serving) it.serving = body.serving; if (body.notes) it.notes = body.notes; }
      }
      try { localStorage.removeItem(MAC_DRAFT_KEY); } catch (e) {}
      var nm = x.item; macClose(true);
      if (state.ltPaint) state.ltPaint();
      macFlash('Saved \u2014 ' + nm + ' is now marked Measured.');
    }, function (err) {
      mm.busy = false;
      var b = $('mac-save'); if (b) { b.disabled = false; b.textContent = 'Save as Measured'; }
      if (vAuth(err)) return;
      macMsg(friendly(err) + ' Nothing is confirmed yet: tap Save again to retry (same entry id, it will not double).', true);
    });
  }
  function macFlash(text) { var el = $('lt-flash'); if (!el) return; el.textContent = text; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : ''); }

  $('screen-lt').addEventListener('click', function (e) {
    var row = e.target.closest('.mac-row');
    if (row && state.ltPart === 'macros' && !e.target.closest('a')) { macOpen(+row.getAttribute('data-mac')); return; }
    var b = e.target.closest('[data-mac2]'); if (!b) return;
    var a = b.getAttribute('data-mac2');
    if (a === 'close') macClose();
    else if (a === 'mic') { if (mm.on) macMicStop(); else macMicStart(); }
    else if (a === 'parse') { macMicStop(true); mm.on = false; macFill(); }
    else if (a === 'save') macSave();
  });
  $('screen-lt').addEventListener('input', function (e) {
    var t = e.target;
    if (mm.idx < 0 || !t.id || t.id.indexOf('mac-') !== 0) return;
    if (t.id === 'mac-text') mm.text = t.value; else macRead();
    macDraftSave();
  });
  $('screen-lt').addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mm.idx >= 0) macClose();
    else if ((e.key === 'Enter' || e.key === ' ') && state.ltPart === 'macros' && e.target.classList && e.target.classList.contains('mac-row')) { e.preventDefault(); macOpen(+e.target.getAttribute('data-mac')); }
  });

  /* ---------------- Lisa's Table: Add menu item (#lt/menu-add): type or dictate -> editable fields -> Save (menuitemadd) ---------------- */
  var MA_DRAFT_KEY = 'cc_maddraft';
  var ma = { rec: null, on: false, base: '', committed: '', interim: '', msg: '', f: {}, text: '', cid: '', sig: '', busy: false, seq: 0 };
  function maClean(s) { return String(s || '').replace(/^[\s,.:;\-]+|[\s,.:;\-]+$/g, '').replace(/\s+/g, ' ').trim(); }
  function maTitle(s) {            // all-lowercase dictation -> Title Case; anything with capitals is left alone
    s = maClean(s);
    return s && s === s.toLowerCase() ? s.replace(/(^|[\s(\-\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }) : s;
  }
  // "lemon bars category snack serving one bar ingredients lemon butter sugar price 4 calories 210 protein 3 carbs 30 fat 8"
  // -> {name, category, serving, ingredients, price, cal, protein, carbs, fat}; text before the first label is the name.
  function maParse(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim().replace(/(\d),(\d{3})/g, '$1$2'), out = { name: '', category: '', serving: '', ingredients: '', price: '', cal: '', protein: '', carbs: '', fat: '', found: 0 };
    var A = {}, B = {}, ca = 0, cb = 0;
    Object.keys(MAC_KEYS).forEach(function (k) {
      var ra = new RegExp('\\b' + MAC_KEYS[k] + '\\b[\\s:=\\-]*(?:is|are|of|at|about|around|equals|total)?[\\s:=\\-]*(\\d+(?:\\.\\d+)?)', 'i').exec(s);
      var rb = new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:g|gr|grams?|gram|kcal|calories?|cals?)?\\s*(?:of\\s+)?(?:total\\s+)?\\b' + MAC_KEYS[k] + '\\b', 'i').exec(s);
      if (ra) { A[k] = { v: ra[1], i: ra.index, l: ra[0].length }; ca++; }
      if (rb) { B[k] = { v: rb[1], i: rb.index, l: rb[0].length }; cb++; }
    });
    var pick = cb > ca ? B : A, spans = [];
    Object.keys(pick).forEach(function (k) { out[k] = pick[k].v; spans.push([pick[k].i, pick[k].l]); });
    var pm = /\b(?:price|priced at|cost|costs)\b[\s:,\-]*(?:is|at|of)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i.exec(s) || /\$\s*(\d+(?:\.\d{1,2})?)/.exec(s) || /(\d+(?:\.\d{1,2})?)\s*dollars?\b/i.exec(s);
    if (pm) { out.price = pm[1]; spans.push([pm.index, pm[0].length]); }
    spans.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (sp) { s = s.slice(0, sp[0]) + ' , ' + s.slice(sp[0] + sp[1]); });
    var re = /\b(name|called|category|serving size|serving|ingredients?)\b/ig, hits = [], m;
    while ((m = re.exec(s))) hits.push({ k: /^serving/i.test(m[1]) ? 'serving' : /^ingredient/i.test(m[1]) ? 'ingredients' : /^category/i.test(m[1]) ? 'category' : 'name', i: m.index, e: m.index + m[0].length });
    var lead = maClean(s.slice(0, hits.length ? hits[0].i : s.length)).replace(/^(?:add|new|create)\b(?:\s+(?:a|an|the|new|menu|item))*\s*(?:called|named)?\s*/i, '');
    if (lead) out.name = lead;
    hits.forEach(function (h, n) {
      var seg = maClean(s.slice(h.e, n + 1 < hits.length ? hits[n + 1].i : s.length)).replace(/^(?:is|are|of|called|named)\s+/i, '');
      if (seg) out[h.k] = seg;
    });
    out.name = maTitle(out.name); out.category = maTitle(out.category); out.serving = maClean(out.serving).slice(0, 80);
    out.ingredients = maClean(out.ingredients); out.ingredients = out.ingredients.charAt(0).toUpperCase() + out.ingredients.slice(1);
    ['name', 'category', 'serving', 'ingredients', 'price', 'cal', 'protein', 'carbs', 'fat'].forEach(function (k) { if (out[k] !== '') out.found++; });
    return out;
  }
  function maDraftSave() { lsSet(MA_DRAFT_KEY, { f: ma.f, text: ma.text, cid: ma.cid, sig: ma.sig, at: Date.now() }); }
  function maOnScreen() { return state.ltPart === 'menu-add' && $('screen-lt').classList.contains('active'); }
  function maF(k) { return $('ma-f-' + k); }
  function maRead() { ['name', 'category', 'serving', 'ingredients', 'price', 'cal', 'protein', 'carbs', 'fat'].forEach(function (k) { var el = maF(k); if (el) ma.f[k] = el.value; }); }
  function maMsg(text, bad) { var el = $('ma-msg'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function maUi() {
    var btn = $('ma-mic'); if (!btn) return;
    btn.classList.toggle('rec', ma.on); btn.setAttribute('aria-pressed', ma.on ? 'true' : 'false');
    $('ma-lbl').textContent = ma.on ? 'Listening\u2026 tap to stop' : 'Tap to talk';
    var st = $('ma-state'); st.className = 'micstate' + (ma.on ? ' rec' : '') + (ma.msg && !ma.on ? ' warn' : '');
    st.textContent = ma.on ? 'Listening\u2026' : (ma.msg || 'Say the name, then anything else, like \u201clemon bars, category snack, serving one bar, ingredients lemon, butter, sugar, price 4, calories 210\u201d. You review before saving.');
  }
  function maChips() {
    var box = $('ma-chips'); if (!box) return;
    var c = state.ltCache.macros, cats = c && c.data && c.data.categories || [], cur = norm(String(ma.f.category || ''));
    box.innerHTML = cats.map(function (x) { var on = norm(x) === cur && cur; return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-ma="chip" data-c="' + esc(x) + '" aria-pressed="' + !!on + '">' + esc(x) + '</button>'; }).join('');
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function openMenuAdd() {
    maMicStop(true);
    var d = lsGet(MA_DRAFT_KEY, null), restored = false;
    ma.f = { name: '', category: '', serving: '', ingredients: '', price: '', cal: '', protein: '', carbs: '', fat: '' }; ma.text = ''; ma.cid = ''; ma.sig = ''; ma.msg = ''; ma.busy = false; ma.on = false;
    if (d && d.f && Date.now() - (d.at || 0) < 12 * 3600 * 1000) { Object.keys(ma.f).forEach(function (k) { if (d.f[k] != null) ma.f[k] = String(d.f[k]); }); ma.text = d.text || ''; ma.cid = d.cid || ''; ma.sig = d.sig || ''; restored = !!(ma.f.name || ma.text); }
    var fld = function (k, label, ph, extra) {
      return '<label class="vfield macf"><span>' + label + '</span><input type="text" class="wlin" id="ma-f-' + k + '" ' + (extra || '') + ' placeholder="' + esc(ph || '') + '" value="' + esc(ma.f[k]) + '" autocomplete="off"></label>';
    };
    $('lt-body').innerHTML = '<div class="ma">' +
      '<div class="micstage macmic"><button type="button" class="micbtn" id="ma-mic" data-ma="mic" aria-pressed="false" aria-label="Start dictation"><span class="micico" aria-hidden="true">' + vsvg('mic', 34) + '</span><span class="miclbl" id="ma-lbl">Tap to talk</span></button><div class="micstate" id="ma-state">&nbsp;</div></div>' +
      '<div class="card draft"><h3>What I heard</h3><textarea id="ma-text" class="notebox" rows="3" maxlength="600" autocapitalize="off" placeholder="Speak it, type it, or use the keyboard\u2019s mic key."></textarea>' +
      '<div class="draftbtns"><button type="button" class="navbtn" data-ma="parse">Fill the fields</button><button type="button" class="navbtn discard" data-ma="clear">Clear all</button></div></div>' +
      '<div class="card vform"><label class="vfield"><span>Name (required)</span><input type="text" class="wlin" id="ma-f-name" maxlength="120" value="' + esc(ma.f.name) + '" autocomplete="off" placeholder="e.g. Lemon Bars"></label>' +
      '<div class="vfield"><span>Category</span><div class="vchips" id="ma-chips"></div><input type="text" class="wlin" id="ma-f-category" maxlength="40" value="' + esc(ma.f.category) + '" placeholder="pick one above or type a new one" autocomplete="off" style="margin-top:8px"></div>' +
      fld('serving', 'Serving', 'e.g. 1 bar', 'maxlength="80"') +
      '<label class="vfield"><span>Ingredients</span><textarea class="notebox" id="ma-f-ingredients" rows="3" maxlength="300" placeholder="e.g. Lemon, butter, sugar, flour">' + esc(ma.f.ingredients) + '</textarea></label>' +
      fld('price', 'Price $ (optional, stays on this phone)', 'e.g. 4', 'inputmode="decimal" maxlength="8"') +
      '<div class="macgrid">' + fld('cal', 'Calories (optional)', '', 'inputmode="decimal" maxlength="8"') + fld('protein', 'Protein g', '', 'inputmode="decimal" maxlength="8"') + fld('carbs', 'Carbs g', '', 'inputmode="decimal" maxlength="8"') + fld('fat', 'Fat g', '', 'inputmode="decimal" maxlength="8"') + '</div>' +
      '<div class="foot">Macros you enter are saved as an estimate (\u201cto be measured\u201d) until you measure them on the Menu Macros screen.</div>' +
      '<div class="noteflash" id="ma-msg" hidden></div>' +
      '<div class="draftbtns"><button type="button" class="bigsave" id="ma-save" data-ma="save">Add menu item</button><button type="button" class="navbtn" data-go="lt/recipes">Cancel</button></div></div></div>';
    $('ma-text').value = ma.text;
    maUi(); maChips();
    if (restored) maMsg('Restored your unsaved entry. Nothing is added until you tap Add menu item.');
    var seq = ++ma.seq, c = state.ltCache.macros;
    if (!c) ltEnsureMacros(function () { if (seq === ma.seq && maOnScreen()) maChips(); });
  }
  function maMicStop(quiet) {
    var r = ma.rec;
    if (quiet) { ma.rec = null; ma.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { ma.rec = null; ma.on = false; maUi(); } }
  }
  function maMicFail(msg) { ma.on = false; var r = ma.rec; ma.rec = null; try { r && r.abort(); } catch (e) {} ma.msg = msg; maUi(); var ta = $('ma-text'); if (ta) ta.focus(); }
  function maMicStart() {
    var ta = $('ma-text');
    if (!SR) { ma.msg = MIC_NA; maUi(); ta.focus(); return; }
    ma.msg = ''; ma.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; ma.committed = ''; ma.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return maMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) ma.committed = micSpace(ma.committed, t.trim() + ' '); else interim += t;
      }
      ma.interim = interim.replace(/^\s+/, ''); ta.value = ma.base + ma.committed + ma.interim;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return maMicFail(MIC_NA);
      if (e === 'network') return maMicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') ma.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (ma.rec !== rec) return;
      ma.committed = micSpace(ma.committed, ma.interim ? ma.interim.trim() + ' ' : ''); ma.interim = '';
      ma.on = false; ma.rec = null;
      ta.value = (ma.base + ma.committed).replace(/\s+$/, ''); ma.text = ta.value;
      if (ta.value.trim()) maFill(); else maUi();
    };
    ma.rec = rec; ma.on = true;
    try { rec.start(); } catch (e2) { return maMicFail(MIC_NA); }
    maUi();
  }
  function maFill() {              // transcript -> fields (only what was heard); the user reviews and edits before Save
    var ta = $('ma-text'); if (!ta) return;
    ma.text = ta.value; var p = maParse(ta.value), got = 0;
    ['name', 'category', 'serving', 'ingredients', 'price', 'cal', 'protein', 'carbs', 'fat'].forEach(function (k) { if (p[k] !== '') { maF(k).value = p[k]; got++; } });
    maRead(); maDraftSave(); maUi(); maChips();
    maMsg(!got ? 'Didn\u2019t hear anything to fill in. Try again, or type in the boxes.' : (maF('name').value.trim() ? 'Check the boxes, then tap Add menu item.' : 'Check the boxes. A name is still needed.'), !got);
  }
  function maSave() {
    if (ma.busy) return;
    maRead();
    var f = ma.f, name = String(f.name || '').replace(/\s+/g, ' ').trim(), errs = [], body = { item: name };
    if (!name) errs.push('Enter a name');
    if (name.length > 120) errs.push('The name is limited to 120 characters');
    var cat = String(f.category || '').replace(/\s+/g, ' ').trim(); if (cat.length > 40) errs.push('The category is limited to 40 characters'); else if (cat) body.category = cat;
    var sv = String(f.serving || '').trim(); if (sv.length > 80) errs.push('The serving is limited to 80 characters'); else if (sv) body.serving = sv;
    var ing = String(f.ingredients || '').replace(/\s+/g, ' ').trim(); if (ing.length > 300) errs.push('The ingredients are limited to 300 characters'); else if (ing) body.ingredients = ing;
    var names = { cal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
    ['cal', 'protein', 'carbs', 'fat'].forEach(function (k) {
      var v = String(f[k] == null ? '' : f[k]).replace(/[,\s]/g, ''); if (v === '') return;
      if (!/^\d+(\.\d+)?$/.test(v) || Number(v) > MAC_LIM[k]) errs.push(names[k] + ' must be a number from 0 to ' + MAC_LIM[k] + ' (or empty)'); else body[k] = v;
    });
    var price = mgPrice(f.price); if (price === null) errs.push('The price should look like 12 or 12.50');
    if (errs.length) return maMsg(errs.join('. ') + '.', true);
    var sig = JSON.stringify(body);
    if (ma.sig !== sig || !ma.cid) { ma.sig = sig; ma.cid = vNewCid(); }
    body.cid = ma.cid; ma.busy = true; var b = $('ma-save'); b.disabled = true; b.textContent = 'Adding\u2026'; maMsg(''); maDraftSave();
    apiRaw('menuitemadd', body).then(function (j) {
      ma.busy = false; var bb = $('ma-save'); if (bb) { bb.disabled = false; bb.textContent = 'Add menu item'; }
      if (j.error === 'bad_action') return maMsg('Saving will work after the next server update.', true);
      if (j.error) return maMsg((j.message || ('Server error: ' + j.error)) + ' Nothing was added.', true);
      var u = (j.data && j.data.item) || null;
      var it = u || { item: name, category: body.category || 'Other', serving: body.serving || '', cal: body.cal != null ? Number(body.cal) : null, protein: body.protein != null ? Number(body.protein) : null,
        carbs: body.carbs != null ? Number(body.carbs) : null, fat: body.fat != null ? Number(body.fat) : null, sources: [], listings: null, ingredients: body.ingredients || '',
        basis: 'Estimate \u2014 to be measured', notes: 'Added from app ' + vToday(), measured: false };
      var c = state.ltCache.macros;
      if (c && c.data) {
        var have = c.data.items.some(function (x) { return norm(x.item) === norm(it.item); });
        if (!have) { c.data.items.push(it); if (c.data.categories.indexOf(it.category) < 0) c.data.categories.push(it.category); }
      }
      if (price) { var pr = lsGet(LT_PRICE_KEY, {}); pr[mgNorm(it.item)] = price.replace(/^\$/, ''); lsSet(LT_PRICE_KEY, pr); }
      var sid = 'added:' + it.item; if (ltSelIdx(sid) < 0) { ltSel().push({ id: sid, n: it.item }); ltSelSave(); }
      try { localStorage.removeItem(MA_DRAFT_KEY); } catch (e) {}
      state.ltAddedFlash = 'Added \u201c' + it.item + '\u201d and ticked it.';
      show('lt/recipes');
    }, function (err) {
      ma.busy = false; var bb = $('ma-save'); if (bb) { bb.disabled = false; bb.textContent = 'Add menu item'; }
      if (vAuth(err)) return;
      maMsg(friendly(err) + ' Nothing is confirmed yet: tap Add menu item again to retry (same entry id, it will not double).', true);
    });
  }
  $('lt-body').addEventListener('click', function (e) {
    if (state.ltPart !== 'menu-add') return;
    var b = e.target.closest('[data-ma]'); if (!b) return;
    var a = b.getAttribute('data-ma');
    if (a === 'mic') { if (ma.on) maMicStop(); else maMicStart(); }
    else if (a === 'parse') { maMicStop(true); ma.on = false; maFill(); }
    else if (a === 'clear') { maMicStop(true); ma.f = {}; ma.text = ''; ma.cid = ''; ma.sig = ''; try { localStorage.removeItem(MA_DRAFT_KEY); } catch (er) {} openMenuAdd(); }
    else if (a === 'chip') { var c = b.getAttribute('data-c'); maF('category').value = norm(maF('category').value) === norm(c) ? '' : c; maRead(); maDraftSave(); maChips(); }
    else if (a === 'save') maSave();
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'menu-add') return;
    var t = e.target;
    if (t.id === 'ma-text') ma.text = t.value; else if (t.id && t.id.indexOf('ma-f-') === 0) { maRead(); if (t.id === 'ma-f-category') maChips(); }
    maDraftSave();
  });

  /* ---------------- L&S project pages: project home / Dictate / Running notes / Documents ---------------- */
  // Terra Vi is the pilot. To add another project: add an entry here AND its Running Notes Doc id to API_NOTES_DOCS in Api.gs.
  // (Only Drive ids live here; the data itself is behind the passcode-protected API.)
  var PROJ = {
    terravi: { name: 'Terra Vi', notesProject: 'terravi',
      docUrl: 'https://docs.google.com/document/d/1YprGTVSb6kM83f0Enfk2bSf8rAsbKVV7vHwCm_qoDg8/edit',
      folderId: '1Spp5rODL2Ol82n5Y-GZmQt6E640po_cp' },
    hetchhetchy: { name: 'Hetch Hetchy', notesProject: 'hetchhetchy',
      docUrl: 'https://docs.google.com/document/d/1UcmzxYhHvnPMzqy6JbE6GE81yPVf2D5h4v1EEdnsNoY/edit',
      punchUrl: 'https://docs.google.com/document/d/1Q4zQmPwIGZ51kQ3S_v949ksc_X4mKnI8xsVRKYvkLIg/edit',
      folderId: '1HCCeuyeW31z72nZNg7gC94SRPQZOOp71' }
  };
  function projSlugOf(name) { var k = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return PROJ[k] ? k : ''; }
  function curProj() { return PROJ[state.projSlug] || PROJ.terravi; }
  function projDocUrl() { return (state.projDocUrls && state.projDocUrls[state.projSlug]) || curProj().docUrl; }
  var LOG_DRAFT_KEY = 'cc_note_draft_dailylog', LOG_CID_KEY = 'cc_lognote_cid';
  function draftKey() { return state.micLog ? LOG_DRAFT_KEY : 'cc_note_draft_' + state.projSlug; }      // per project (Terra Vi keeps its original key)
  var OPEN_KEY = 'cc_proj_open';
  var NOTE_MAX = 1500;
  var MIC_NA = 'Live mic isn\u2019t available here \u2014 tap the text box and use your keyboard\u2019s mic key.';
  var notes = { data: null, entries: [], legacy: false, at: 0, seq: 0, saving: false, savedMsg: '' };
  var docs = { data: null, at: 0, seq: 0 };
  var mic = { rec: null, on: false, base: '', committed: '', interim: '', errs: 0, lastStart: 0, timer: 0, wanted: false };
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Open/closed state of every collapsible row/group on these pages: kept in memory and on the phone, so Back restores it.
  var openMem = (function () { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  function isOpen(key, dflt) { return openMem[key] === undefined ? !!dflt : !!openMem[key]; }
  function setOpen(key, v) {
    openMem[key] = !!v;
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(openMem)); } catch (e) {}
  }
  function projSetup(slug) {          // wires the Home/Back buttons of the 4 project screens to this project
    if (state.micLog) micLogReset();  // leaving the Daily log Dictate page for a project page
    var prev = state.projSlug;
    state.projSlug = PROJ[slug] ? slug : 'terravi';
    var s = state.projSlug, p = PROJ[s];
    if (prev !== s) {                 // switched project: drop the other project's cached notes / documents / half-typed text
      notes.data = null; notes.entries = []; notes.seq++; notes.at = 0;
      docs.data = null; docs.seq++; docs.at = 0;
      if (!mic.on) { var ta = $('note-text'); if (ta) ta.value = ''; var rc = $('note-recovered'); if (rc) rc.hidden = true; }
    }
    ['proj', 'notes', 'mic', 'docs', 'punch'].forEach(function (k) {
      var t = $(k + '-title'); if (t) t.textContent = p.name + (k === 'proj' ? '' : ' \u00b7 ' + { notes: 'Running notes', mic: 'Dictate a note', docs: 'Documents', punch: 'Punchlist' }[k]);
    });
    ['notes', 'mic', 'docs', 'punch'].forEach(function (k) { $(k + '-back').setAttribute('data-go', 'proj/' + s); });
    document.querySelectorAll('[data-pgo]').forEach(function (el) { el.setAttribute('data-go', el.getAttribute('data-pgo') + '/' + s); });
  }
  var MIC_PH = 'Your words appear here. You can also type, or use the keyboard\u2019s mic key.';
  var MIC_PH_LOG = 'What you ate, drank, your workout, weight, sleep\u2026 speak it, type it, or use the keyboard\u2019s mic key.';
  function micLogSetup() {            // Dictate page in Daily-log mode: same mic + draft box, saved to the fitness sheet's Voice notes
    if (!state.micLog) {
      state.micLog = true;
      if (!mic.on) { var ta = $('note-text'); if (ta) ta.value = ''; var rc = $('note-recovered'); if (rc) rc.hidden = true; mic.msg = ''; }
    }
    $('mic-title').textContent = 'Daily Tracker \u00b7 Dictate a note';
    $('mic-back').setAttribute('data-go', 'track');
    $('note-text').setAttribute('placeholder', MIC_PH_LOG);
    $('mic-hint').hidden = false;
    $('note-save').setAttribute('data-lbl', 'Save to Voice notes');
  }
  function micLogReset() {
    state.micLog = false;
    if (!mic.on) { var ta = $('note-text'); if (ta) ta.value = ''; var rc = $('note-recovered'); if (rc) rc.hidden = true; mic.msg = ''; }
    $('note-text').setAttribute('placeholder', MIC_PH);
    $('mic-hint').hidden = true;
    $('note-save').removeAttribute('data-lbl');
  }
  function renderProj() {
    $('proj-doc').href = projDocUrl();
    $('proj-doc').setAttribute('data-title', curProj().name + ' \u2014 Running Notes');
    $('proj-punch').hidden = !curProj().punchUrl;      // Punchlist = interactive page (#punch/<slug>); the Doc link lives on that page
  }
  function draftGet() { try { return localStorage.getItem(draftKey()) || ''; } catch (e) { return ''; } }
  function draftSet(v) { try { v ? localStorage.setItem(draftKey(), v) : localStorage.removeItem(draftKey()); } catch (e) {} }

  /* ---- Running notes page: dated rows, newest first; tap a row for the detail ---- */
  function autoTitle(text, maxWords) {
    var w = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), n = maxWords || 7;
    if (!w.length) return 'Note';
    var t = w.slice(0, n).join(' ').replace(/[\s,;:\-\u2013\u2014]+$/, '');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return w.length > n ? t.replace(/[.!?]+$/, '') + '\u2026' : t;
  }
  function shortTitle(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim(), m = t.match(/^(.{12,70}?[.!?;:])(\s|$)/);
    if (m) return m[1].replace(/[.;:]+$/, '');
    if (t.length <= 70) return t.replace(/\.+$/, '') || 'Entry';
    var cut = t.slice(0, 66), sp = cut.lastIndexOf(' ');
    return (sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s,;:\-]+$/, '') + '\u2026';
  }
  // Server >= v15 sends data.entries [{date,title,detail,time,kind}]. Older servers only send status/todo/done: build what we can from that.
  function entriesFrom(d) {
    if (d && Array.isArray(d.entries)) return { list: d.entries, legacy: false };
    var out = [];
    ((d && d.done) || []).forEach(function (g) {
      (g.items || []).forEach(function (x) {
        var f = x.kind === 'field';
        out.push({ date: g.date || '', time: x.time || '', title: f ? autoTitle(x.text) : shortTitle(x.text), detail: x.text || '', kind: f ? 'note' : 'log' });
      });
    });
    return { list: out, legacy: true };
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateCell(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '<span class="d1">Earlier</span>';
    return '<span class="d1">' + MON[Number(m[2]) - 1] + ' ' + Number(m[3]) + '</span><span class="d2">' + m[1] + '</span>';
  }
  function entryKey(e) { return 'n|' + (e.date || '') + '|' + (e.time || '') + '|' + (e.title || ''); }
  function openNotes() {
    var first = !notes.data;
    if (first) $('notes-body').innerHTML = '<div class="loading">Loading…</div>';
    else renderNotes();
    loadNotes(first || Date.now() - notes.at > 15000);
  }
  function loadNotes(force) {
    if (!force) return;
    var seq = ++notes.seq;
    apiRaw('notes', { project: curProj().notesProject }).then(function (j) {
      if (seq !== notes.seq) return;
      if (j.error === 'bad_action') { notes.data = null; return notesMsg('Running notes aren\u2019t available yet (server update pending).', true); }
      if (j.error) throw new Error(j.message || ('Server error: ' + j.error));
      notes.data = j.data; notes.at = Date.now();
      var e = entriesFrom(j.data); notes.entries = e.list; notes.legacy = e.legacy;
      renderNotes();
    }).catch(function (err) {
      if (seq !== notes.seq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      if (notes.data) return;
      notesMsg(friendly(err), true);
    });
  }
  function notesMsg(msg, withDoc) {
    $('notes-body').innerHTML = '<div class="error">' + esc(msg) + '<div class="retry"><button class="navbtn" id="notes-retry">Try again</button></div>' +
      (withDoc ? '<div class="retry"><a class="navbtn doc-open-inline" data-title="' + esc(curProj().name) + ' \u2014 Running Notes" href="' + esc(projDocUrl()) + '">Open the Doc &rsaquo;</a></div>' : '') + '</div>';
    var b = $('notes-retry'); if (b) b.addEventListener('click', function () { openNotes(); loadNotes(true); });
  }
  function ncardHtml(key, title, count, bodyHtml) {
    var open = isOpen(key, false);
    return '<div class="card ncard' + (open ? ' open' : '') + '" data-nc="' + esc(key) + '"><button class="nchead" aria-expanded="' + open + '"><span>' + esc(title) + '</span>' +
      (count == null ? '' : '<b class="cnt">' + count + '</b>') + '<i class="chev">&rsaquo;</i></button><div class="ncbody">' + bodyHtml + '</div></div>';
  }
  function renderNotes() {
    var d = notes.data;
    if (!d) return;
    var h = '';
    h += ncardHtml('st', 'Status', null, (d.status && d.status.length)
      ? d.status.map(function (t) { return '<p class="stat">' + esc(t) + '</p>'; }).join('') : '<p class="stat dim">No status written yet.</p>');
    var todo = d.todo || [];
    h += ncardHtml('td', 'To do', todo.length, todo.length
      ? todo.map(function (t) { return '<div class="todorow">' + esc(t) + '</div>'; }).join('') : '<div class="todorow dim">Nothing on the list.</div>');
    h += '<div class="secttl">Entries <small>newest first</small></div>';
    var list = notes.entries || [];
    if (!list.length) h += '<div class="card"><p class="stat dim">No entries yet. Dictate one from the project page.</p></div>';
    h += '<div class="elist">' + list.map(function (e, i) {
      var key = entryKey(e), open = isOpen(key, false), voice = e.kind === 'note';
      var detail = String(e.detail || '').replace(/\s+$/, '');
      return '<div class="erow' + (open ? ' open' : '') + (voice ? ' voice' : '') + '" data-ek="' + esc(key) + '">' +
        '<button class="ehead" aria-expanded="' + open + '"><span class="edate">' + dateCell(e.date) + '</span>' +
        '<span class="etitle">' + esc(e.title || shortTitle(detail)) + '</span><i class="chev">&rsaquo;</i></button>' +
        '<div class="ebody">' + (voice || e.time ? '<div class="emeta">' + (voice ? '<b>Voice note</b>' : '') + (e.time ? '<span>' + esc(e.time) + '</span>' : '') + '</div>' : '') +
        '<div class="etext">' + (detail ? esc(detail) : '<span class="dim">No further detail.</span>') + '</div></div></div>';
    }).join('') + '</div>';
    if (notes.legacy) h += '<p class="hint legacy">Showing the basic list. Dated sections with full detail appear here after the server update.</p>';
    h += '<a class="linkrow" data-title="' + esc(curProj().name) + ' \u2014 Running Notes" href="' + esc(d.url || projDocUrl()) + '">Open the full Doc &rsaquo;</a>';
    $('notes-body').innerHTML = h;
  }
  $('notes-body').addEventListener('click', function (e) {
    var eh = e.target.closest('.ehead');
    if (eh) {
      var row = eh.parentNode, o = !row.classList.contains('open');
      row.classList.toggle('open', o); eh.setAttribute('aria-expanded', o); setOpen(row.getAttribute('data-ek'), o);
      return;
    }
    var b = e.target.closest('.nchead');
    if (!b) return;
    var c = b.parentNode, open = !c.classList.contains('open');
    c.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    setOpen(c.getAttribute('data-nc'), open);
  });
  $('notes-refresh').addEventListener('click', function () { loadNotes(true); });

  /* ---- Documents page: collapsible groups (folder / subfolders), each file its own labelled button ---- */
  function docType(x) {
    var m = String(x.mime || ''), ext = (String(x.name || '').match(/\.([A-Za-z0-9]{1,5})$/) || [])[1];
    ext = ext ? ext.toLowerCase() : '';
    if (/google-apps\.document/.test(m)) return 'Google Doc';
    if (/google-apps\.spreadsheet/.test(m)) return 'Google Sheet';
    if (/google-apps\.presentation/.test(m)) return 'Google Slides';
    if (/google-apps\.drawing/.test(m)) return 'Drawing';
    if (/pdf/.test(m) || ext === 'pdf') return 'PDF';
    if (/wordprocessingml|msword/.test(m) || ext === 'doc' || ext === 'docx') return 'Word';
    if (/spreadsheetml|ms-excel/.test(m) || ext === 'xls' || ext === 'xlsx') return 'Excel';
    if (/csv/.test(m) || ext === 'csv') return 'CSV';
    if (/presentationml|ms-powerpoint/.test(m) || ext === 'ppt' || ext === 'pptx') return 'PowerPoint';
    if (/^image\//.test(m)) return 'Image';
    if (/^text\//.test(m)) return 'Text';
    if (/zip/.test(m)) return 'ZIP';
    return ext ? ext.toUpperCase() : 'File';
  }
  function fetchFolderTree(id, path, depth, budget) {       // -> promise of [{name, files:[...]}] (flattened, empty groups skipped)
    return apiRaw('folder', { id: id }).then(function (j) {
      if (j.error === 'bad_action') { var e = new Error('bad_action'); e.bad = true; throw e; }
      if (j.error) throw new Error(j.message || ('Server error: ' + j.error));
      var items = j.data.items || [], files = items.filter(function (x) { return !x.folder; });
      var subs = items.filter(function (x) { return x.folder; });
      var out = files.length ? [{ name: path, id: id, files: files }] : [];
      if (!subs.length || depth <= 0) return out;
      return Promise.all(subs.slice(0, 12).filter(function () { return budget.n-- > 0; }).map(function (f) {
        return fetchFolderTree(f.id, path === '' ? f.name : path + ' \u203a ' + f.name, depth - 1, budget).catch(function (er) { if (er.bad || er instanceof AuthError) throw er; return []; });
      })).then(function (parts) { return out.concat([].concat.apply([], parts)); });
    });
  }
  function openDocs() {
    if (docs.data) renderDocs(); else $('docs-body').innerHTML = '<div class="loading">Loading…</div>';
    if (!docs.data || Date.now() - docs.at > 60000) loadDocs();
  }
  function loadDocs() {
    var seq = ++docs.seq, p = curProj();
    fetchFolderTree(p.folderId, '', 2, { n: 20 }).then(function (groups) {
      if (seq !== docs.seq) return;
      docs.data = groups; docs.at = Date.now();
      renderDocs();
    }).catch(function (err) {
      if (seq !== docs.seq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      if (docs.data) return;
      var drive = '<div class="retry"><a class="navbtn doc-open-inline" data-title="' + esc(p.name) + ' \u2014 Documents" href="https://drive.google.com/drive/folders/' + esc(p.folderId) + '">Open the Drive folder &rsaquo;</a></div>';
      $('docs-body').innerHTML = '<div class="error">' + esc(err.bad ? 'The document list isn\u2019t available yet (server update pending).' : friendly(err)) +
        '<div class="retry"><button class="navbtn" id="docs-retry">Try again</button></div>' + drive + '</div>';
      var b = $('docs-retry'); if (b) b.addEventListener('click', function () { openDocs(); loadDocs(); });
    });
  }
  function renderDocs() {
    var p = curProj(), groups = docs.data || [], total = 0;
    groups.forEach(function (g) { total += g.files.length; });
    var h = '<p class="hint">' + total + ' document' + (total === 1 ? '' : 's') + ' \u00b7 tap a group to expand, tap a file to open it.</p>';
    if (!total) h += '<div class="card"><p class="stat dim">No documents found in this folder.</p></div>';
    groups.forEach(function (g, i) {
      var key = 'dg|' + p.folderId + '|' + g.id, title = g.name === '' ? p.name : g.name;
      var files = g.files.slice().sort(function (a, b) { return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1; });
      h += ncardHtml(key, title, files.length, files.map(function (x) {
        var href = 'https://drive.google.com/file/d/' + x.id + '/view';
        return '<a class="docbtn" href="' + esc(href) + '" data-title="' + esc(x.name) + '"><span class="dtxt"><span class="dname">' + esc(x.name) +
          '</span><span class="dtype">' + esc(docType(x)) + '</span></span><i class="chev">&rsaquo;</i></a>';
      }).join('')).replace('class="card ncard' + (isOpen(key, false) ? ' open' : '') + '"', 'class="card ncard' + (isOpen(key, i === 0) ? ' open' : '') + '"');
    });
    h += '<a class="linkrow" data-title="' + esc(p.name) + ' \u2014 Drive folder" href="https://drive.google.com/drive/folders/' + esc(p.folderId) + '">Open the Drive folder &rsaquo;</a>';
    $('docs-body').innerHTML = h;
  }
  $('docs-body').addEventListener('click', function (e) {
    var b = e.target.closest('.nchead');
    if (!b) return;
    var c = b.parentNode, open = !c.classList.contains('open');
    c.classList.toggle('open', open); b.setAttribute('aria-expanded', open);
    setOpen(c.getAttribute('data-nc'), open);
  });
  $('docs-refresh').addEventListener('click', function () { loadDocs(); });

  /* ---- Dictate page: big mic, saves the note into the project's Running Notes ---- */
  var flashT = 0;
  function flash(msg, bad) {
    var el = $('notes-flash');
    if (!el) return;
    el.textContent = msg; el.className = 'noteflash show' + (bad ? ' bad' : ''); el.hidden = false;
    clearTimeout(flashT);
    flashT = setTimeout(function () { el.className = 'noteflash'; el.hidden = true; }, 6000);
  }
  function openMic() {
    var ta = $('note-text');
    if (mic.on) ta.value = mic.base + mic.committed + mic.interim;
    else { var d = draftGet(); if (d && !ta.value) { ta.value = d; $('note-recovered').hidden = false; } }
    micUi();
  }
  $('note-text').addEventListener('input', function () {
    var ta = this;
    if (mic.on) { mic.base = ta.value; mic.committed = ''; mic.interim = ''; }
    draftSet(ta.value); micUi();
  });
  $('note-save').addEventListener('click', function () { saveNote(); });
  $('note-discard').addEventListener('click', function () { discardNote(); });

  function discardNote() {
    micStop(true);
    var ta = $('note-text'); if (ta) ta.value = '';
    draftSet(''); mic.base = mic.committed = mic.interim = ''; mic.msg = '';
    var r = $('note-recovered'); if (r) r.hidden = true;
    micUi();
  }
  function saveNote() {
    if (notes.saving) return;
    micStop(true);
    var ta = $('note-text'), text = ta ? ta.value.replace(/\s+/g, ' ').trim() : '';
    if (!text) return;
    if (text.length > NOTE_MAX) return flash('That note is too long (max ' + NOTE_MAX + ' characters).', true);
    if (state.micLog) return saveLogNote(text);
    notes.saving = true; micUi();
    apiRaw('addnote', { project: curProj().notesProject, text: text }).then(function (j) {
      notes.saving = false;
      if (j.error === 'bad_action') { micUi(); return flash('Saving isn\u2019t available yet (server update pending). Your note is kept on this phone.', true); }
      if (j.error) { micUi(); return flash((j.message || 'Couldn\u2019t save (' + j.error + ').') + ' Your note is kept on this phone.', true); }
      draftSet(''); mic.base = mic.committed = mic.interim = '';
      if (ta) ta.value = '';
      notes.at = 0;                                            // Running notes reloads next time it is opened
      micUi();
      flash(j.data && j.data.duplicate ? 'Already saved.' : 'Saved to Running Notes \u2713');
    }, function (err) {
      notes.saving = false; micUi();
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      flash(friendly(err) + ' Your note is kept on this phone.', true);
    });
  }

  /* ---- Daily log voice notes: save (lognote) + the collapsible recent list on the Daily log screen ---- */
  // Server: Api.gs v22 actions `lognote` (append to the "Voice notes" tab) / `lognotes` (read). Without them the draft just stays on this phone.
  function logCid(text) {              // same text -> same client id, so a retry after a dropped reply can't double-save
    var o = null; try { o = JSON.parse(localStorage.getItem(LOG_CID_KEY) || 'null'); } catch (e) {}
    if (o && o.t === text && o.c) return o.c;
    var c = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem(LOG_CID_KEY, JSON.stringify({ t: text, c: c })); } catch (e) {}
    return c;
  }
  function saveLogNote(text) {
    var ta = $('note-text');
    notes.saving = true; micUi();
    apiRaw('lognote', { text: text, cid: logCid(text) }).then(function (j) {
      notes.saving = false;
      if (j.error === 'bad_action') { micUi(); return flash('Saving isn\u2019t available yet (server update pending). Your note is kept on this phone.', true); }
      if (j.error) { micUi(); return flash((j.message || 'Couldn\u2019t save (' + j.error + ').') + ' Your note is kept on this phone.', true); }
      draftSet(''); mic.base = mic.committed = mic.interim = '';
      try { localStorage.removeItem(LOG_CID_KEY); } catch (e) {}
      if (ta) ta.value = '';
      vn.at = 0;                                               // the Daily log list reloads when it is shown
      micUi();
      flash(j.data && j.data.duplicate ? 'Already saved.' : 'Saved to Voice notes \u2713');
    }, function (err) {
      notes.saving = false; micUi();
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      flash(friendly(err) + ' Your note is kept on this phone.', true);
    });
  }
  var vn = { data: null, state: 'idle', msg: '', seq: 0, at: 0 };
  function loadVoiceNotes() {
    var seq = ++vn.seq;
    if (!vn.data) { vn.state = 'loading'; }
    renderVoiceNotes();
    apiRaw('lognotes', {}).then(function (j) {
      if (seq !== vn.seq) return;
      if (j.error === 'bad_action') { vn.data = null; vn.state = 'na'; }
      else if (j.error) { vn.state = vn.data ? 'ok' : 'err'; vn.msg = j.message || ('Server error: ' + j.error); }
      else { vn.data = j.data || { notes: [], total: 0, pending: 0 }; vn.state = 'ok'; vn.at = Date.now(); }
      renderVoiceNotes();
    }, function (err) {
      if (seq !== vn.seq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      vn.state = vn.data ? 'ok' : 'err'; vn.msg = friendly(err);
      renderVoiceNotes();
    });
  }
  function vnTodayPrefix() {   // note times read like "Fri 10/2 \u00b7 4:12 AM" (script time zone); today = this phone's date
    var t = new Date(), dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dn[t.getDay()] + ' ' + (t.getMonth() + 1) + '/' + t.getDate() + ' ';
  }
  function renderVoiceNotes() {
    var card = $('vn-card'); if (!card) return;
    var open = isOpen('vnt', true), d = vn.data, h = '';
    card.classList.toggle('open', open); $('vn-head').setAttribute('aria-expanded', open);
    var cnt = '';
    if (vn.state === 'ok' && d) cnt = d.pending ? d.pending + ' new' : (d.total ? d.total + '' : '');
    var c = $('vn-cnt'); c.textContent = cnt; c.hidden = !cnt;
    // a note kept on this phone (not saved yet)
    var dr = ''; try { dr = localStorage.getItem(LOG_DRAFT_KEY) || ''; } catch (e) {}
    var dv = $('vn-draft');
    if (dr.trim()) {
      dv.hidden = false;
      dv.innerHTML = '<span class="vdt"><b>Unsaved note on this phone</b> ' + esc(dr.trim().length > 90 ? dr.trim().slice(0, 90) + '\u2026' : dr.trim()) + '</span>' +
        '<button class="navbtn" data-go="mic/dailylog">Open</button>';
    } else { dv.hidden = true; dv.innerHTML = ''; }
    if (vn.state === 'loading') h = '<p class="stat dim">Loading\u2026</p>';
    else if (vn.state === 'na') h = '<p class="stat dim">Saved voice notes will be listed here after the server update. You can already dictate; a note is kept on this phone until it can be saved.</p>';
    else if (vn.state === 'err') h = '<p class="stat dim">' + esc(vn.msg || 'Couldn\u2019t load voice notes.') + '</p><button class="navbtn" id="vn-retry">Try again</button>';
    else if (d && d.notes && d.notes.length) {
      var pre = vnTodayPrefix(), row = function (n) {
        return '<div class="vnrow' + (n.done ? ' done' : '') + '"><div class="vnmeta"><span>' + esc(n.time || '') + '</span>' +
          (n.done ? '<b class="ok">&#10003; logged</b>' : '<b>new</b>') + '</div><div class="vntext">' + esc(n.text) + '</div></div>';
      };
      var tod = d.notes.filter(function (n) { return String(n.time || '').indexOf(pre) === 0; }), old = d.notes.filter(function (n) { return String(n.time || '').indexOf(pre) !== 0; });
      h = tod.length ? '<div class="vnlist">' + tod.map(row).join('') + '</div>' : '<p class="stat dim">No voice notes yet today. Tap the mic above.</p>';
      if (old.length) {
        var oo = isOpen('vnold', false);
        h += '<button type="button" class="navbtn vnmore" id="vn-more" aria-expanded="' + oo + '">' + (oo ? 'Hide earlier notes' : 'Earlier notes (' + old.length + ')') + '</button>' +
          (oo ? '<div class="vnlist vnearlier">' + old.map(row).join('') + '</div>' : '');
      }
      h += '<p class="foot">Latest ' + d.notes.length + (d.total > d.notes.length ? ' of ' + d.total : '') + '. Chief of Staff turns new notes into log entries.</p>';
    } else h = '<p class="stat dim">No voice notes yet. Tap the mic above.</p>';
    $('vn-body').innerHTML = h;
  }
  $('vn-head').addEventListener('click', function () { var o = !isOpen('vnt', true); setOpen('vnt', o); renderVoiceNotes(); });
  $('vn-body').addEventListener('click', function (e) { if (e.target.id === 'vn-retry') loadVoiceNotes(); if (e.target.id === 'vn-more') { setOpen('vnold', !isOpen('vnold', false)); renderVoiceNotes(); } });

  /* ---- Mic (Web Speech API) ---- */
  function micUi() {
    var btn = $('mic-btn'); if (!btn) return;
    var on = mic.on, ta = $('note-text'), has = !!(ta && ta.value.trim());
    btn.classList.toggle('rec', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Stop dictation' : 'Start dictation');
    $('mic-lbl').textContent = on ? 'Listening \u2014 tap to stop' : (has ? 'Tap to keep talking' : 'Tap to talk');
    var lg = !!state.micLog;
    var st = $('mic-state'), extra = mic.msg;
    st.className = 'micstate' + (on ? ' rec' : '') + (extra && !on ? ' warn' : '');
    st.textContent = on ? 'Recording\u2026 speak your note' : (extra || (has ? 'Review the note, then Save or Discard' : (lg ? 'Tap the mic and say what you ate, drank, did, weighed, slept' : 'Tap the mic to dictate a note')));
    var tag = $('rec-tag'); if (tag) tag.hidden = !on;
    var dc = $('draft-card'); if (dc) dc.classList.toggle('live', on);
    var sv = $('note-save'), dsc = $('note-discard');
    if (sv) { sv.disabled = !has || notes.saving; sv.textContent = notes.saving ? 'Saving\u2026' : (sv.getAttribute('data-lbl') || 'Save note'); }
    if (dsc) dsc.disabled = !has && !on;
    var cnt = $('note-count'); if (cnt) cnt.textContent = ta && ta.value.length ? ta.value.length + ' / ' + NOTE_MAX : '';
  }
  function micShow() {
    var ta = $('note-text');
    if (!ta) return;
    ta.value = mic.base + mic.committed + mic.interim;
    ta.scrollTop = ta.scrollHeight;
    draftSet(ta.value);
    var r = $('note-recovered'); if (r) r.hidden = true;
    micUi();
  }
  function micSpace(a, b) { return a && b && !/\s$/.test(a) ? a + ' ' + b : a + b; }
  function micFail(msg) {
    mic.on = false; mic.wanted = false; mic.msg = msg;
    clearTimeout(mic.timer);
    try { mic.rec && mic.rec.abort(); } catch (e) {}
    mic.rec = null;
    micUi();
    var ta = $('note-text'); if (ta) ta.focus();
  }
  function micStart() {
    var ta = $('note-text');
    if (!SR) { mic.msg = MIC_NA; micUi(); if (ta) ta.focus(); return; }
    mic.msg = '';
    mic.base = ta && ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
    mic.committed = ''; mic.interim = ''; mic.errs = 0;
    var rec;
    try { rec = new SR(); } catch (e) { return micFail(MIC_NA); }
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) mic.committed = micSpace(mic.committed, t.trim() + ' ');
        else interim += t;
      }
      mic.interim = interim.replace(/^\s+/, '');
      mic.errs = 0;
      micShow();
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return micFail(MIC_NA);
      if (e === 'network') return micFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      // no-speech / aborted: let onend restart it
    };
    rec.onend = function () {
      mic.committed = micSpace(mic.committed, mic.interim ? mic.interim.trim() + ' ' : '');   // keep what was heard
      mic.interim = '';
      if (mic.rec !== rec) return;
      if (mic.on && mic.wanted) {                 // browser ended it while still "on": restart
        if (++mic.errs > 8) return micFail('Dictation keeps stopping. Tap the text box and use your keyboard\u2019s mic key.');
        clearTimeout(mic.timer);
        mic.timer = setTimeout(function () {
          if (!(mic.on && mic.wanted) || mic.rec !== rec) return;
          try { rec.start(); } catch (e) { micFail(MIC_NA); }
        }, 250);
        micShow();
        return;
      }
      micShow();
    };
    mic.rec = rec; mic.on = true; mic.wanted = true;
    try { rec.start(); } catch (e) { return micFail(MIC_NA); }
    micUi();
  }
  function micStop(quiet) {
    var was = mic.on;
    mic.on = false; mic.wanted = false;
    clearTimeout(mic.timer);
    if (mic.rec) { try { mic.rec.stop(); } catch (e) {} }
    var rec = mic.rec;
    // Fold any interim text into the note, then drop the recognizer.
    if (was) {
      mic.committed = micSpace(mic.committed, mic.interim ? mic.interim.trim() + ' ' : '');
      mic.interim = '';
      micShow();
    }
    setTimeout(function () { if (mic.rec === rec && !mic.on) mic.rec = null; }, 400);
    if (!quiet) micUi();
  }
  $('mic-btn').addEventListener('click', function () {
    if (mic.on) micStop(); else micStart();
  });
  window.addEventListener('pagehide', function () { var t = $('note-text'); if (t && t.value) draftSet(t.value); });
  document.addEventListener('visibilitychange', function () {
    var t = $('note-text'); if (t && t.value) draftSet(t.value);
    if (document.hidden && mic.on) micStop();
  });


  /* ---------------- Punchlist (#punch/<slug>): checkboxes + notes, saved in a Google Sheet via the API ---------------- */
  // Server: actions punch / punchset / punchnote (Api.gs v17). State lives in the "<Project> Punchlist State" Sheet,
  // so it follows you across devices. Here: optimistic UI, an offline-safe queue (kept on this phone until the server
  // confirms), and a read-only fallback read from the Doc itself when the actions aren't deployed yet.
  var PQ_KEY = 'cc_punch_q', PF_KEY = 'cc_punch_filter';
  var punch = { slug: '', data: null, items: [], seq: 0, at: 0, ro: false, roWhy: '', fromCache: false, filter: 'open', sticky: {}, flushing: false, retryT: 0, sig: '', msg: '' };
  function pjGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function pjSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pqAll() { var q = pjGet(PQ_KEY, []); return Array.isArray(q) ? q : []; }
  function pqFor(slug) { return pqAll().filter(function (o) { return o.p === slug; }); }
  function pqSave(q) { pjSet(PQ_KEY, q); }
  function pqPush(op) {
    var q = pqAll();
    if (op.t === 'set') q = q.filter(function (o) { return !(o.t === 'set' && o.p === op.p && o.n === op.n); });   // latest value wins
    q.push(op); pqSave(q);
  }
  function pqDrop(op) { pqSave(pqAll().filter(function (o) { return !(o.t === op.t && o.p === op.p && o.n === op.n && (op.t === 'set' || o.cid === op.cid)); })); }
  function pDraftKey(n) { return 'cc_punch_draft_' + punch.slug + '_' + n; }
  function pDocId() { var m = String(curProj().punchUrl || '').match(/\/d\/([\w-]+)/); return m ? m[1] : ''; }
  function pNow() {
    var d = new Date(), h = d.getHours();
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + (d.getMonth() + 1) + '/' + d.getDate() + ' \u00b7 ' + ((h % 12) || 12) + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  // Server snapshot + queued changes = what the screen shows.
  function pView() {
    var q = pqFor(punch.slug);
    return punch.items.map(function (it) {
      var o = { n: it.n, name: it.name, date: it.date, info: it.info, done: !!it.done, doneAt: it.doneAt || '', notes: (it.notes || []).slice(), pendingSet: false, pendingNotes: 0 };
      q.forEach(function (op) {
        if (op.n !== it.n) return;
        if (op.t === 'set') { o.done = !!op.done; o.doneAt = op.done ? (op.show || '') : ''; o.pendingSet = true; }
        else if (op.t === 'note') { o.notes.unshift({ text: op.text, time: op.show || '', pending: true }); o.pendingNotes++; }
      });
      return o;
    });
  }
  function pMsg(text, bad) {
    punch.msg = text || '';
    var el = $('punch-flash'); if (!el) return;
    el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash show' + (bad ? ' bad' : '');
  }
  function pStatus() {
    var el = $('punch-sync'); if (!el) return;
    var n = pqFor(punch.slug).length, t = '';
    if (punch.ro) t = (punch.roWhy || 'Server update pending') + ' \u2014 read-only list from the Doc.';
    else if (n) t = n + ' change' + (n === 1 ? '' : 's') + ' waiting to sync \u2014 kept on this phone' + (punch.flushing ? ' (syncing\u2026)' : '.');
    else if (punch.fromCache) t = 'Offline \u2014 showing the last synced list.';
    el.textContent = t; el.hidden = !t;
    el.className = 'psync' + (punch.ro || punch.fromCache ? ' warn' : '');
  }

  function openPunch() {
    var slug = state.projSlug;
    if (punch.slug !== slug) { punch.slug = slug; punch.data = null; punch.items = []; punch.sig = ''; punch.ro = false; punch.fromCache = false; punch.sticky = {}; punch.seq++; punch.at = 0; pMsg(''); }
    punch.filter = pjGet(PF_KEY, 'open') === 'all' ? 'all' : 'open';
    $('punch-doc').href = curProj().punchUrl; $('punch-doc').setAttribute('data-title', curProj().name + ' \u2014 Punchlist');
    if (!punch.items.length) {
      var snap = pjGet('cc_punch_snap_' + slug, null);
      if (snap && snap.items && snap.items.length) { punch.items = snap.items; punch.fromCache = true; }
    }
    if (punch.items.length) pRender(); else $('punch-list').innerHTML = '<div class="loading">Loading\u2026</div>';
    pStatus();
    if (!punch.items.length || Date.now() - punch.at > 15000) loadPunch();
    pFlush();
  }
  function loadPunch(manual) {
    var seq = ++punch.seq, slug = punch.slug;
    apiRaw('punch', { project: curProj().notesProject }).then(function (j) {
      if (seq !== punch.seq || slug !== punch.slug) return;
      if (j.error === 'bad_action') return pFallback('Server update pending');
      if (j.error) throw new Error(j.message || ('Server error: ' + j.error));
      var d = j.data; punch.data = d; punch.items = d.items || []; punch.at = Date.now(); punch.ro = false; punch.fromCache = false;
      pjSet('cc_punch_snap_' + slug, { items: punch.items, at: punch.at });
      pRender(); pStatus();
      if (manual) pMsg('Up to date \u2713');
    }).catch(function (err) {
      if (seq !== punch.seq || slug !== punch.slug) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      if (punch.items.length) { punch.fromCache = true; pRender(); pStatus(); if (manual) pMsg(friendly(err), true); return; }
      pFallback(/Failed to fetch|NetworkError|Load failed|reach/i.test(String(err && err.message)) ? 'Offline' : 'Server update pending', friendly(err));
    });
  }

  // Read-only fallback: read the table straight from the Doc (as PDF through the existing "file" action).
  function pFallback(why, errMsg) {
    var slug = punch.slug, seq = punch.seq;
    punch.ro = true; punch.roWhy = why;
    if (punch.items.length) { pRender(); pStatus(); return; }
    $('punch-list').innerHTML = '<div class="loading">Reading the Doc\u2026</div>';
    apiRaw('file', { id: pDocId() }).then(function (j) {
      if (j.error) throw new Error(j.message || ('Server error: ' + j.error));
      return loadPdfJs().then(function (lib) { return lib.getDocument({ data: b64bytes(j.data.b64) }).promise; });
    }).then(function (pdf) { return pDocItems(pdf); }).then(function (items) {
      if (slug !== punch.slug || seq !== punch.seq) return;
      if (!items.length) throw new Error('Couldn\u2019t read the list from the Doc.');
      punch.items = items; pRender(); pStatus();
    }).catch(function (err) {
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      $('punch-list').innerHTML = '<div class="error">' + esc(errMsg || friendly(err)) + '<div class="retry"><button class="navbtn" id="punch-retry">Try again</button></div>' +
        '<div class="retry"><a class="navbtn" data-title="' + esc(curProj().name) + ' \u2014 Punchlist" href="' + esc(curProj().punchUrl) + '">Open the Doc &rsaquo;</a></div></div>';
      var b = $('punch-retry'); if (b) b.addEventListener('click', function () { openPunch(); loadPunch(true); });
      pStatus();
    });
  }
  function pDocItems(pdf) {
    var jobs = [];
    for (var i = 1; i <= pdf.numPages; i++) jobs.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }));
    return Promise.all(jobs).then(function (pages) {
      var lines = [];
      pages.forEach(function (tc, pi) {
        var rows = [];
        tc.items.forEach(function (it) {
          var s = String(it.str || '').trim(); if (!s) return;
          var y = Math.round(it.transform[5]), x = it.transform[4], r = null;
          for (var k = 0; k < rows.length; k++) if (Math.abs(rows[k].y - y) <= 3) { r = rows[k]; break; }
          if (!r) rows.push(r = { y: y, c: [] });
          r.c.push({ x: x, s: s });
        });
        rows.sort(function (a, b) { return b.y - a.y; });
        rows.forEach(function (r) { r.c.sort(function (a, b) { return a.x - b.x; }); lines.push(r); });
      });
      var hdr = null;
      lines.forEach(function (r) { if (!hdr && r.c.some(function (c) { return /^item$/i.test(c.s); }) && r.c.some(function (c) { return /^date$/i.test(c.s); })) hdr = r; });
      var xi = 0, xd = 0, xn = 0;
      if (hdr) hdr.c.forEach(function (c) { if (/^item$/i.test(c.s)) xi = c.x; else if (/^date$/i.test(c.s)) xd = c.x; else if (/^notes?$/i.test(c.s)) xn = c.x; });
      var items = [], seen = {};
      lines.forEach(function (r) {
        var ci = -1;
        for (var k = 0; k < r.c.length; k++) if (/^\d{1,3}$/.test(r.c[k].s) && (!xi || r.c[k].x < xi - 4)) { ci = k; break; }
        if (ci < 0) return;
        var n = parseInt(r.c[ci].s, 10); if (seen[n]) return;
        var name = [], date = [], info = [];
        r.c.forEach(function (c, k) {
          if (k <= ci) return;
          var s = c.s.replace(/\\([#&])/g, '$1');
          if (xn && c.x >= xn - 6) info.push(s); else if (xd && c.x >= xd - 6) date.push(s); else name.push(s);
        });
        if (!name.length) return;
        seen[n] = true;
        items.push({ n: n, name: name.join(' '), date: date.join(' '), info: info.join(' '), done: false, notes: [] });
      });
      items.sort(function (a, b) { return a.n - b.n; });
      return items;
    });
  }

  /* ---- render ---- */
  var P_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function pNotesHtml(it) {
    if (!it.notes.length) return '<div class="pnone">No notes yet.</div>';
    return it.notes.map(function (n) {
      return '<div class="pnote' + (n.pending ? ' pend' : '') + '"><div class="pntime">' + esc(n.time || '') + (n.pending ? ' \u00b7 waiting to sync' : '') + '</div><div class="pntext">' + esc(n.text) + '</div></div>';
    }).join('');
  }
  function pRowHtml(it) {
    var open = isOpen('punch:' + punch.slug + ':' + it.n, false), ro = punch.ro;
    var meta = (it.date ? '<b class="pdate">' + esc(it.date) + '</b>' : '') + (it.info ? '<span class="pinfo">' + esc(it.info) + '</span>' : '');
    var draft = '';
    try { draft = localStorage.getItem(pDraftKey(it.n)) || ''; } catch (e) {}
    return '<div class="prow' + (it.done ? ' done' : '') + (open ? ' open' : '') + '" data-n="' + it.n + '">' +
      '<div class="phead"><button class="pbox" role="checkbox" aria-checked="' + (it.done ? 'true' : 'false') + '" aria-label="Done: ' + esc(it.name) + '"' + (ro ? ' disabled' : '') + '>' + P_CHECK + '</button>' +
      '<button class="pmain" aria-expanded="' + open + '"><span class="pnum">' + it.n + '</span><span class="ptxt"><span class="pname">' + esc(it.name) + '</span>' +
      '<span class="pmeta">' + (meta || '<span class="pinfo dim">\u2014</span>') + '</span></span><i class="chev">&rsaquo;</i></button></div>' +
      '<div class="pbody">' + (it.done && it.doneAt ? '<div class="pdone">\u2713 Done ' + esc(it.doneAt) + '</div>' : '<div class="pdone" hidden></div>') +
      (ro ? '<div class="pnone">Notes need the server update (pending).</div>' :
        '<textarea class="notebox pta" rows="3" maxlength="1000" placeholder="Add a note\u2026 type, or tap the mic" aria-label="Note for ' + esc(it.name) + '">' + esc(draft) + '</textarea>' +
        '<div class="pbtns"><button class="pmic" aria-pressed="false" aria-label="Dictate a note"><span aria-hidden="true">&#127908;</span></button><button class="bigsave psave" disabled>Save note</button></div>' +
        '<div class="pstate"></div>') +
      '<div class="pnotes">' + pNotesHtml(it) + '</div></div></div>';
  }
  function pRender() {
    var view = pView(), sig = punch.slug + '|' + punch.ro + '|' + view.map(function (i) { return i.n + i.name + i.date + i.info; }).join('~');
    var box = $('punch-list');
    if (sig !== punch.sig || !box.querySelector('.prow')) {
      punch.sig = sig;
      pmicStop(true);
      box.innerHTML = view.map(pRowHtml).join('');
      view.forEach(function (it) { pSaveBtn(it.n); });
    } else {                                                    // same list: update in place (keeps what you are typing)
      view.forEach(function (it) {
        var row = pRow(it.n); if (!row) return;
        pPaint(row, it);
      });
    }
    pCount(view); pApplyFilter();
  }
  function pRow(n) { return $('punch-list').querySelector('.prow[data-n="' + n + '"]'); }
  function pPaint(row, it) {
    row.classList.toggle('done', it.done);
    var cb = row.querySelector('.pbox'); cb.setAttribute('aria-checked', it.done ? 'true' : 'false');
    var dn = row.querySelector('.pdone'); dn.hidden = !(it.done && it.doneAt); dn.textContent = it.done && it.doneAt ? '\u2713 Done ' + it.doneAt : '';
    row.querySelector('.pnotes').innerHTML = pNotesHtml(it);
  }
  function pCount(view) {
    view = view || pView();
    var d = view.filter(function (i) { return i.done; }).length, t = view.length;
    $('punch-count').innerHTML = '<b>' + d + '</b> of ' + t + ' done';
    $('punch-bar').style.width = (t ? Math.round(d * 100 / t) : 0) + '%';
    var pb = $('punch-prog'); pb.setAttribute('aria-valuenow', d); pb.setAttribute('aria-valuemax', t);
  }
  function pApplyFilter() {
    document.querySelectorAll('#punch-filter button').forEach(function (b) {
      var on = b.getAttribute('data-f') === punch.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var shown = 0;
    $('punch-list').querySelectorAll('.prow').forEach(function (row) {
      var n = row.getAttribute('data-n'), hide = punch.filter === 'open' && row.classList.contains('done') && !punch.sticky[n];
      row.hidden = hide; if (!hide) shown++;
    });
    var em = $('punch-empty');
    em.hidden = !(punch.items.length && !shown);
  }
  $('punch-filter').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]'); if (!b) return;
    punch.filter = b.getAttribute('data-f') === 'all' ? 'all' : 'open'; pjSet(PF_KEY, punch.filter);
    punch.sticky = {}; pApplyFilter();
  });
  $('punch-refresh').addEventListener('click', function () { pMsg(''); loadPunch(true); pFlush(); });

  /* ---- interactions ---- */
  function pBodyOpen(row, open) {
    row.classList.toggle('open', open); row.querySelector('.pmain').setAttribute('aria-expanded', open ? 'true' : 'false');
    setOpen('punch:' + punch.slug + ':' + row.getAttribute('data-n'), open);
  }
  function pSaveBtn(n) {
    var row = pRow(n); if (!row) return;
    var ta = row.querySelector('.pta'), sv = row.querySelector('.psave'); if (!ta || !sv) return;
    sv.disabled = !ta.value.trim();
  }
  $('punch-list').addEventListener('click', function (e) {
    var row = e.target.closest('.prow'); if (!row) return;
    var n = parseInt(row.getAttribute('data-n'), 10);
    if (e.target.closest('.pbox')) return pToggle(row, n);
    if (e.target.closest('.pmic')) return pMicToggle(row, n);
    if (e.target.closest('.psave')) return pSaveNote(row, n);
    if (e.target.closest('.pmain')) { var o = !row.classList.contains('open'); if (!o) pmicStop(true); pBodyOpen(row, o); }
  });
  $('punch-list').addEventListener('input', function (e) {
    var ta = e.target.closest('.pta'); if (!ta) return;
    var row = ta.closest('.prow'), n = row.getAttribute('data-n');
    if (pmic.on && pmic.n === n) { pmic.base = ta.value; pmic.committed = ''; pmic.interim = ''; }
    try { ta.value ? localStorage.setItem(pDraftKey(n), ta.value) : localStorage.removeItem(pDraftKey(n)); } catch (er) {}
    pSaveBtn(n);
  });
  function pToggle(row, n) {
    if (punch.ro) return;
    var it = pView().filter(function (i) { return i.n === n; })[0]; if (!it) return;
    var want = !it.done;
    punch.sticky[n] = true;                              // stays visible in "Unchecked" until the filter is changed / list reopened
    pqPush({ t: 'set', p: punch.slug, n: n, done: want, show: want ? pNow() : '' });
    pRender(); pStatus(); pFlush();
  }
  function pSaveNote(row, n) {
    var ta = row.querySelector('.pta'); pmicStop(true);
    var text = ta.value.replace(/\s+/g, ' ').trim(); if (!text) return;
    if (text.length > 1000) { row.querySelector('.pstate').textContent = 'That note is too long (max 1000 characters).'; return; }
    pqPush({ t: 'note', p: punch.slug, n: n, text: text, cid: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), at: Date.now(), show: pNow() });
    ta.value = ''; try { localStorage.removeItem(pDraftKey(n)); } catch (er) {}
    pSaveBtn(n);
    var st = row.querySelector('.pstate'); st.textContent = 'Saving\u2026'; st.className = 'pstate';
    pPaint(row, pView().filter(function (i) { return i.n === n; })[0]);
    pCount(); pStatus(); pFlush();
  }

  /* ---- offline-safe sync: queue stays on the phone until the server confirms ---- */
  function pFlush() {
    if (punch.flushing) return;
    var q = pqFor(punch.slug); if (!q.length) { pStatus(); return; }
    var op = q[0], slug = punch.slug;
    punch.flushing = true; clearTimeout(punch.retryT); pStatus();
    var p = op.t === 'set' ? apiRaw('punchset', { project: curProj().notesProject, index: op.n, done: op.done ? 'true' : 'false' })
                           : apiRaw('punchnote', { project: curProj().notesProject, index: op.n, text: op.text, cid: op.cid, at: op.at });
    p.then(function (j) {
      punch.flushing = false;
      if (j.error === 'bad_action') { punch.ro = punch.ro || !punch.items.length; punch.roWhy = 'Server update pending'; return pRetryLater(60000, 'Saved on this phone \u2014 server update pending. It will sync once the update is live.'); }
      if (j.error && /^(bad_item|empty|too_long|bad_project)$/.test(j.error)) {       // can never succeed: drop it
        pqDrop(op); pRender(); pMsg(j.message || ('Couldn\u2019t save one change (' + j.error + ').'), true); return pFlush();
      }
      if (j.error) return pRetryLater(30000, (j.message || ('Server error: ' + j.error)) + ' Will retry.');
      pqDrop(op);
      var d = j.data || {};
      if (op.t === 'set') { var it = punch.items.filter(function (i) { return i.n === op.n; })[0]; if (it) { it.done = !!op.done; it.doneAt = op.done ? (d.doneAt || op.show || '') : ''; } }
      else { var it2 = punch.items.filter(function (i) { return i.n === op.n; })[0]; if (it2 && !d.duplicate) { it2.notes = it2.notes || []; it2.notes.unshift({ text: op.text, time: d.time || op.show || '' }); } }
      if (slug === punch.slug) {
        pjSet('cc_punch_snap_' + slug, { items: punch.items, at: punch.at || Date.now() });
        pRender();
        var row = pRow(op.n), st = row && row.querySelector('.pstate');
        if (op.t === 'note' && st) { st.textContent = 'Saved \u2713'; st.className = 'pstate ok'; }
        if (!pqFor(slug).length) { pMsg(''); pStatus(); }
      }
      pFlush();
    }, function (err) {
      punch.flushing = false;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      pRetryLater(15000);
    });
  }
  function pRetryLater(ms, msg) {
    if (msg) pMsg(msg, true);
    pStatus(); clearTimeout(punch.retryT);
    punch.retryT = setTimeout(function () { if (document.getElementById('screen-punch').classList.contains('active')) pFlush(); }, ms);
  }
  window.addEventListener('online', function () { if ($('screen-punch').classList.contains('active')) { pFlush(); loadPunch(); } });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pmicStop(true); return; }
    if ($('screen-punch').classList.contains('active')) { pFlush(); if (Date.now() - punch.at > 15000) loadPunch(); }
  });

  /* ---- per-note dictation (same Web Speech approach as the Dictate page) ---- */
  var pmic = { rec: null, on: false, n: '', base: '', committed: '', interim: '', errs: 0, timer: 0, wanted: false };
  function pmicTa() { var r = pmic.n && pRow(pmic.n); return r ? r.querySelector('.pta') : null; }
  function pmicUi() {
    document.querySelectorAll('#punch-list .pmic').forEach(function (b) {
      var on = pmic.on && b.closest('.prow').getAttribute('data-n') === String(pmic.n);
      b.classList.toggle('rec', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.setAttribute('aria-label', on ? 'Stop dictation' : 'Dictate a note');
    });
  }
  function pmicShow() {
    var ta = pmicTa(); if (!ta) return;
    ta.value = pmic.base + pmic.committed + pmic.interim; ta.scrollTop = ta.scrollHeight;
    try { localStorage.setItem(pDraftKey(pmic.n), ta.value); } catch (e) {}
    pSaveBtn(pmic.n);
  }
  function pmicFail(msg) {
    pmic.on = false; pmic.wanted = false; clearTimeout(pmic.timer);
    try { pmic.rec && pmic.rec.abort(); } catch (e) {}
    pmic.rec = null; pmicUi();
    var r = pmic.n && pRow(pmic.n), st = r && r.querySelector('.pstate');
    if (st) { st.textContent = msg; st.className = 'pstate warn'; }
    var ta = pmicTa(); if (ta) ta.focus();
  }
  function pMicToggle(row, n) {
    if (pmic.on && String(pmic.n) === String(n)) return pmicStop();
    pmicStop(true);
    var ta = row.querySelector('.pta'), st = row.querySelector('.pstate');
    st.textContent = ''; st.className = 'pstate';
    pmic.n = String(n);
    if (!SR) { pmicFail(MIC_NA); return; }
    pmic.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
    pmic.committed = ''; pmic.interim = ''; pmic.errs = 0;
    var rec;
    try { rec = new SR(); } catch (e) { return pmicFail(MIC_NA); }
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) pmic.committed = micSpace(pmic.committed, t.trim() + ' '); else interim += t;
      }
      pmic.interim = interim.replace(/^\s+/, ''); pmic.errs = 0; pmicShow();
    };
    rec.onerror = function (ev) {
      var er = ev && ev.error;
      if (er === 'not-allowed' || er === 'service-not-allowed' || er === 'audio-capture' || er === 'language-not-supported') return pmicFail(MIC_NA);
      if (er === 'network') return pmicFail('The speech service couldn\u2019t be reached. Use your keyboard\u2019s mic key.');
    };
    rec.onend = function () {
      pmic.committed = micSpace(pmic.committed, pmic.interim ? pmic.interim.trim() + ' ' : ''); pmic.interim = '';
      if (pmic.rec !== rec) return;
      if (pmic.on && pmic.wanted) {
        if (++pmic.errs > 8) return pmicFail('Dictation keeps stopping. Use your keyboard\u2019s mic key.');
        clearTimeout(pmic.timer);
        pmic.timer = setTimeout(function () { if (!(pmic.on && pmic.wanted) || pmic.rec !== rec) return; try { rec.start(); } catch (e) { pmicFail(MIC_NA); } }, 250);
      }
      pmicShow();
    };
    pmic.rec = rec; pmic.on = true; pmic.wanted = true;
    try { rec.start(); } catch (e) { return pmicFail(MIC_NA); }
    st.textContent = 'Listening\u2026 speak your note, tap the mic to stop'; st.className = 'pstate rec';
    pmicUi();
  }
  function pmicStop(quiet) {
    var was = pmic.on;
    pmic.on = false; pmic.wanted = false; clearTimeout(pmic.timer);
    var rec = pmic.rec;
    if (rec) { try { rec.stop(); } catch (e) {} }
    if (was) { pmic.committed = micSpace(pmic.committed, pmic.interim ? pmic.interim.trim() + ' ' : ''); pmic.interim = ''; pmicShow(); }
    setTimeout(function () { if (pmic.rec === rec && !pmic.on) pmic.rec = null; }, 400);
    var r = pmic.n && $('punch-list') && pRow(pmic.n), st = r && r.querySelector('.pstate');
    if (st && was) { st.textContent = ''; st.className = 'pstate'; }
    pmicUi();
  }


  /* ---------------- Finances (Overview / Laundromat) + Insurance notes ---------------- */
  // Phone screens built from the Finances / Insurance working Docs. ALL figures come from the
  // passcode-protected API (action=fin&page=overview|laundromat|insurance) at request time.
  // Nothing financial is stored in this file or in the public repo.
  var FIN_TTL = 60000;
  var FIN_PAGES = {
    ledger:     { label: 'Ledger',     sub: 'Accounts, cash flow, bills' },
    overview:   { label: 'Overview',   sub: 'Net worth · cash flow · debt' },
    laundromat: { label: 'Mono Village Laundromat \u00b7 TiwiK', sub: 'TiwiK LLC · income & expenses · loan · maintenance' }
  };
  var INS_ORDER = ['personal', 'wetumka', 'monoway', 'tiwik', 'kiwit', 'sierra', 'stewart'];
  var INS_LABEL = { personal: 'Personal & Autos', wetumka: 'Wetumka', monoway: 'Mono Way', tiwik: 'TiwiK', kiwit: 'KiwiT', sierra: 'Sierra Consultants', stewart: 'Stewart Street' };
  var fin = { cache: {}, seq: 0, open: {}, tdOpen: {} };

  function finApi(page, force, done) {
    var c = fin.cache[page];
    if (c && !force && Date.now() - c.at < FIN_TTL) return done(null, c.data, false);
    var seq = ++fin.seq;
    apiRaw('fin', { page: page }).then(function (j) {
      if (j.error === 'bad_action' || j.error === 'bad_page') return done({ na: true });
      if (j.error) return done(new Error(j.message || ('Server error: ' + j.error)));
      fin.cache[page] = { data: j.data, at: Date.now() };
      done(null, j.data, true, seq);
    }).catch(function (err) { done(err); });
  }
  function finNA(boxId, what) {
    var link = '';
    if (state.links) (state.links.lifeAreas || []).forEach(function (a) { if (/^financial$/i.test(a.name) && a.url) link = a.url; });
    $(boxId).innerHTML = '<div class="loading">' + esc(what) + ' isn\u2019t available yet (server update pending).</div>' +
      '<div class="retry" style="text-align:center"><button class="navbtn" data-fin-retry>Try again</button></div>' +
      (link ? '<a class="linkrow" data-title="Finances" href="' + esc(link) + '">Open Finances folder &rsaquo;</a>' : '');
  }
  function finFail(boxId, what, retry) {
    return function (err, data) {
      if (!err) return;
      if (err.na) return finNA(boxId, what);
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      onFail([boxId], retry)(err);
    };
  }

  // ---- shared bits ----
  function moneyNum(s) {
    var m = String(s == null ? '' : s).match(/^\s*(-|\u2212)?\s*\$\s*([\d,]+(?:\.\d+)?)/);
    return m ? (m[1] ? -1 : 1) * Number(m[2].replace(/,/g, '')) : null;
  }
  function isMoneyCell(s) { return /^\s*[-\u2212]?\s*\$\s*[\d,]+(\.\d+)?(\s*\/\s*(year|month|yr|mo))?\s*$/i.test(String(s || '')); }
  function moneyCls(s, label) {
    if (!isMoneyCell(s)) return '';
    var n = moneyNum(s);
    if (n < 0) return ' neg';
    if (n > 0 && /cash flow|net|revenue|income|rent|equity|saved/i.test(label || '')) return ' pos';
    return '';
  }
  function cardOpen(key, dflt) { return fin.open[key] === undefined ? dflt : fin.open[key]; }
  function collCard(key, title, count, inner, dflt, cls) {
    var open = cardOpen(key, !!dflt);
    return '<div class="card ncard fxcard' + (open ? ' open' : '') + (cls ? ' ' + cls : '') + '" data-nc="' + esc(key) + '"><button class="nchead" aria-expanded="' + open + '"><span>' + esc(title) +
      '</span>' + (count != null ? (/^</.test(String(count)) ? count : '<b class="cnt">' + count + '</b>') : '') + '<i class="chev">&rsaquo;</i></button><div class="ncbody">' + inner + '</div></div>';
  }
  function sumCard(label, val, cls, sub) {
    return '<div class="fxsum ' + (cls || '') + '"><div class="fxl">' + esc(label) + '</div><div class="fxv">' + esc(val) + '</div>' + (sub ? '<div class="fxs">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function absMoney(s) { var n = moneyNum(s); if (n === null) return String(s || '\u2014'); return (n < 0 ? '\u2212' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: /\.\d/.test(s) ? 2 : 0 }); }
  function paraHtml(t) { return '<p class="fxp">' + fx(t) + '</p>'; }
  function statusCard(status) {
    return '<div class="card statuscard"><h3>Status</h3>' + (status && status.length
      ? status.map(function (t) { return '<p class="stat">' + esc(t) + '</p>'; }).join('')
      : '<p class="stat dim">No status written yet.</p>') + '</div>';
  }

  // A doc table -> stacked cards (never a wide table).
  function tableCards(t) {
    var head = t.header || [], rows = t.rows || [];
    if (!rows.length) return '';
    var short = head.length <= 3 && rows.every(function (r) { return r.slice(1).every(function (c) { return String(c || '').length <= 26; }); });
    var h = '<div class="fxtbl' + (short ? ' short' : '') + '">';
    if (head.length > 1 && (head[0] || '').length) h += '<div class="fxth">' + esc(head[0]) + ' \u00b7 ' + esc(head.slice(1).join(' / ')) + '</div>';
    rows.forEach(function (r) {
      var title = r[0] || '', rest = r.slice(1), isTot = /^(total|net from|average|estimated net|cash flow after|cash flow before)/i.test(title);
      var onlyTitle = !rest.some(function (c) { return String(c || '').trim(); });
      if (onlyTitle) { h += '<div class="fxgrp">' + esc(title) + '</div>'; return; }
      if (short) {
        h += '<div class="fxrow' + (isTot ? ' tot' : '') + '"><div class="fxrt">' + esc(title) + '</div><div class="fxcells">';
        rest.forEach(function (c, i) {
          h += '<div class="fxc' + moneyCls(c, title + ' ' + (head[i + 1] || '')) + '">' + (head.length > 2 ? '<small>' + esc(head[i + 1] || '') + '</small>' : '') + fx(c || '\u2014') + '</div>';
        });
        h += '</div></div>';
      } else {
        h += '<div class="fxrec"><div class="fxrt">' + esc(title) + '</div>';
        rest.forEach(function (c, i) {
          if (!String(c || '').trim() || c === '-') return;
          h += '<div class="fxkv"><b>' + esc(head[i + 1] || '') + '</b><span class="' + moneyCls(c, head[i + 1] || '').trim() + '">' + fx(c) + '</span></div>';
        });
        h += '</div>';
      }
    });
    return h + '</div>';
  }
  function sectionInner(sec, skip) {
    var h = '';
    (sec.blocks || []).forEach(function (b) {
      if (b.k === 'h') h += '<div class="fxh3">' + esc(b.text) + '</div>';
      else if (b.k === 'p') h += paraHtml(b.text);
      else if (b.k === 'li') h += '<div class="fxli">' + fx(b.text) + '</div>';
      else if (b.k === 'tbl') { if (!(skip && skip(b))) h += tableCards(b); }
    });
    return h;
  }
  function todoRest(t) {
    var x = t.text || '';
    if (t.lead) t.lead = t.lead.replace(/^[\u2610-\u2612]\s*/, '');
    if (t.lead && x.indexOf(t.lead) === 0) x = x.slice(t.lead.length).replace(/^[\s:;.\-\u2013\u2014]+/, '');
    return x;
  }
  function fmtDate(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function daysTo(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - t) / 86400000);
  }
  function dueChip(iso) {
    var d = daysTo(iso);
    if (d === null) return '';
    var cls = d < 0 ? 'past' : d <= 30 ? 'soon' : d <= 90 ? 'mid' : '';
    var lab = d < 0 ? Math.abs(d) + ' d ago' : d === 0 ? 'today' : d + ' d';
    return '<span class="fxdue ' + cls + '">' + esc(fmtDate(iso)) + ' \u00b7 ' + lab + '</span>';
  }
  function todoRows(list, key) {
    if (!list.length) return '<div class="todorow dim">Nothing on the list.</div>';
    return list.map(function (t, i) {
      var k = key + i, rest = todoRest(t), head = t.lead || (rest.length > 110 ? rest.slice(0, 107) + '\u2026' : rest), hasMore = !!t.lead ? !!rest : rest.length > 110;
      var open = !!fin.tdOpen[k];
      return '<div class="todorow fxtd' + (t.done ? ' isdone' : '') + (open ? ' open' : '') + (hasMore ? ' more' : '') + '" data-td="' + esc(k) + '">' +
        '<div class="fxtdh">' + (t.done ? '<i class="fxck">\u2713</i>' : '') + '<span>' + esc(head) + '</span></div>' +
        (t.date && !t.done ? '<div>' + dueChip(t.date) + '</div>' : '') +
        (hasMore ? '<div class="fxtdb">' + fx(t.lead ? rest : t.text) + '</div><div class="fxmore">' + (open ? 'Less' : 'More') + '</div>' : '') + '</div>';
    }).join('');
  }
  function todoCards(todo, keyBase) {
    var open = [], done = [];
    todo.forEach(function (t) { (t.done ? done : open).push(t); });
    var h = collCard(keyBase + 'todo', 'To do', open.length, todoRows(open, keyBase + 'o'), true);
    if (done.length) h += collCard(keyBase + 'res', 'Resolved', done.length, todoRows(done, keyBase + 'r'), false, 'resolved');
    return h;
  }
  function simpleList(items, cls) {
    return items.length ? items.map(function (t) { return '<div class="donerow ' + (cls || '') + '">' + fx(t) + '</div>'; }).join('') : '<div class="donerow dim">Nothing here yet.</div>';
  }
  function doneCard(done, key) {
    if (!done || !done.length) return '';
    return collCard(key + 'done', 'Done log', done.length, done.map(function (x) {
      return '<div class="donerow">' + (x.date ? '<span class="tm">' + esc(fmtDate(x.date) || x.date) + '</span>' : '') + fx(x.text) + '</div>';
    }).join(''), false);
  }
  function notesCard(notes, key) {
    var n = 0;
    (notes || []).forEach(function (g) { n += g.items.length; });
    if (!n) return '';
    return collCard(key + 'notes', 'Notes', n, notes.map(function (g) {
      return (g.date ? '<div class="fxh3">' + esc(g.date) + '</div>' : '') + g.items.map(function (t) { return '<div class="donerow">' + fx(t) + '</div>'; }).join('');
    }).join(''), false);
  }
  function docLink(d) { return '<a class="linkrow" data-title="' + esc(d.title || 'Document') + '" href="' + esc(d.url) + '">Open the full Doc &rsaquo;</a>'; }
  function updatedLine(d) {
    if (!d.updated) return '';
    var t = new Date(d.updated);
    return isNaN(t) ? '' : '<div class="foot fxupd">Doc updated ' + esc(t.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) + '</div>';
  }
  function bindFin(boxId) {
    var box = $(boxId);
    if (box._fxBound) return; box._fxBound = true;
    box.addEventListener('click', function (e) {
      if (e.target.closest('a[href]')) return;   // document links open in the viewer (global handler)
      if (boxId === 'fin-body' && state.finKind === 'ledger' && ledClick(e)) return;
      if (boxId === 'fin-body' && (state.finKind === 'overview' || state.finKind === 'ledger') && ovClick(e)) return;
      var mo = e.target.closest('[data-ld-month]');
      if (mo) { state.monthOffset += Number(mo.getAttribute('data-ld-month')) || 0; ldSpend(true); renderLd(); return; }
      if (e.target.closest('[data-ld-retry]')) { loadLd(true); return; }
      var b = e.target.closest('.nchead');
      if (b) {
        var c = b.parentNode, key = c.getAttribute('data-nc'), open = !c.classList.contains('open');
        c.classList.toggle('open', open); b.setAttribute('aria-expanded', open); fin.open[key] = open; return;
      }
      var td = e.target.closest('.fxtd.more');
      if (td) {
        var k = td.getAttribute('data-td'), o = !td.classList.contains('open');
        td.classList.toggle('open', o); fin.tdOpen[k] = o;
        var m = td.querySelector('.fxmore'); if (m) m.textContent = o ? 'Less' : 'More';
        return;
      }
      if (e.target.closest('[data-fin-retry]')) { if (boxId === 'fin-body') loadFin(true); else loadInsn(true); }
    });
  }
  bindFin('fin-body'); bindFin('insn-body');
  $('fin-refresh').addEventListener('click', function () { loadFin(true); });
  $('insn-refresh').addEventListener('click', function () { loadInsn(true); });

  // ---- Finances hub / Overview / Laundromat ----
  function loadFin(force) {
    var kind = state.finKind;
    var ovd = kind === 'overview' && state.ovKey && OV_HEADS[state.ovKey] ? OV_HEADS[state.ovKey] : null;
    $('fin-back').setAttribute('data-go', ovd ? 'fin/overview' : kind ? 'fin' : 'home');
    $('fin-back').hidden = !kind;
    $('fin-refresh').hidden = !kind;
    $('fin-title').textContent = ovd ? ovd.title : kind ? FIN_PAGES[kind].label : 'Finances';
    $('fin-title').classList.toggle('sub', !!kind);
    if (!kind) return renderFinHub();
    if (kind === 'laundromat') return loadLd(!!force);
    if (kind === 'overview') return loadOv(!!force);
    if (kind === 'ledger') return loadLed(!!force);
    var cached = fin.cache[kind];
    if (cached) renderFin(kind, cached.data);
    else $('fin-body').innerHTML = '<div class="loading">Loading…</div>';
    if (cached && !force && Date.now() - cached.at < FIN_TTL) return;
    var want = kind;
    finApi(kind, true, function (err, data) {
      if (state.finKind !== want) return;
      if (!err) return renderFin(want, data);
      if (cached) return;   // keep showing the cached copy
      finFail('fin-body', FIN_PAGES[want].label, function () { loadFin(true); })(err);
    });
  }
  function renderFinHub() {
    var h = '<div class="projbtns">';
    ['ledger', 'overview', 'laundromat'].forEach(function (k) {
      h += '<button class="bigbtn' + (k === 'ledger' ? ' ledbtn' : '') + '" data-go="fin/' + k + '">' + esc(FIN_PAGES[k].label) + '<span class="sub">' + esc(FIN_PAGES[k].sub) + '</span></button>';
    });
    h += '</div>';
    var link = '';
    if (state.links) (state.links.lifeAreas || []).forEach(function (a) { if (/^financial$/i.test(a.name) && a.url) link = a.url; });
    if (link) h += '<a class="linkrow" data-title="Finances" href="' + esc(link) + '">Open Finances folder &rsaquo;</a>';
    $('fin-body').innerHTML = h;
    if (!state.links) api('links').then(function (d) { state.links = d; if (state.finKind === '' && $('screen-fin').classList.contains('active')) renderFinHub(); }, function () {});
  }
  function renderFin(kind, d) {
    if (state.finKind !== kind) return;
    var h = '';
    h = overviewHtml(d);
    $('fin-body').innerHTML = h + docLink(d) + updatedLine(d);
  }
  function overviewHtml(d) {
    var s = d.summary || {}, h = '';
    var flow = s.cashFlowYear, fneg = flow && flow.num < 0;
    h += '<div class="fxgrid">';
    h += sumCard('Assets', s.assets ? absMoney(s.assets.value) : '\u2014', '');
    h += sumCard('Debt', s.debt ? absMoney(s.debt.value) : '\u2014', 'neg');
    h += sumCard('Net worth', s.netWorth ? absMoney(s.netWorth.value) : '\u2014', s.netWorth && s.netWorth.num < 0 ? 'neg' : 'pos', 'assets \u2212 debt');
    h += sumCard('Cash flow / yr', flow ? absMoney(flow.value.replace(/\s*\/.*$/, '')) : '\u2014', fneg ? 'neg' : 'pos', s.cashFlowMonth ? s.cashFlowMonth.value.replace(/\s*\/.*$/, '') + ' / mo' : '');
    h += '</div>';
    h += '<div class="fxgrid three">';
    if (s.cash) h += sumCard('Cash', absMoney(s.cash.value), 'mini');
    if (s.heloc) h += sumCard('Unused HELOC', absMoney(s.heloc.value), 'mini', 'not in debt');
    h += '</div>';
    if (s.updated) h += '<div class="fxnote"><b>Newer basis</b> (from loan documents, calculated): debt ' + esc(s.updated.debt) + ' \u00b7 net worth ' + esc(s.updated.netWorth) + '. Table figures above are as the sheet has them.</div>';
    h += todoCards(ovTodoFilter(d.todo || []), 'ov');
    (d.sections || []).forEach(function (sec, i) {
      var inner = sectionInner(sec), n = (sec.blocks || []).filter(function (b) { return b.k === 'tbl'; }).length;
      if (!inner) return;
      h += collCard('ovs' + i, sec.title, n ? n + (n === 1 ? ' table' : ' tables') : null, inner, false);
    });
    if ((d.questions || []).length) h += collCard('ovq', 'Questions', d.questions.length, simpleList(d.questions), false);
    h += notesCard(d.notes, 'ov') + doneCard(d.done, 'ov');
    return h;
  }
  // ---- Overview v4 (FIN2): document ledger (fin page "overview", Finances - Overview v4 Doc) + live Vault (`spend` API) ----
  // No figures live in this file. Every number is fetched at runtime: Vault numbers drill to the #spend/... routes, document numbers
  // open the source Doc / PDF in the viewer, Incomplete figures carry a tappable "Incomplete" badge that lists what Zac needs to provide (v64: Incomplete figures are shown and counted, tagged Incomplete).
  var ov = { fin: { s: 'load' }, sp: { s: 'load' }, cache: {}, seq: 0, estOpen: {}, idx: {}, d: null, virt: {}, fixed: {}, dyn: {}, ev: {}, ovr: {}, stated: {} };
  var OV_LABEL = {
    'inv.af': 'American Funds', 'inv.etrade': 'E*TRADE', 're.total': 'Real estate (3 properties)', 'eq.value': 'Laundromat equipment',
    'wet.bal': 'Balance', 'wet.rate': 'Rate (fixed)', 'wet.pi': 'Principal & interest', 'wet.escrow': 'Escrow', 'wet.pay': 'Monthly payment', 'wet.due': 'Next payment due', 'wet.maturity': 'Maturity',
    'mono.bal': 'Balance (calculated)', 'mono.orig': 'Original principal', 'mono.rate': 'Rate', 'mono.pay': 'Monthly payment (P&I)', 'mono.maturity': 'Maturity',
    'all.bal': 'Balance', 'all.rate': 'Rate', 'all.pay': 'Monthly payment now', 'all.pay2': 'Monthly payment after reset', 'all.maturity': 'Maturity', 'all.payoff': 'Payoff today (calculated)',
    'bos.cl.limit': 'Commercial line limit (unused)', 'bos.heloc.limit': 'HELOC limit (unused)',
    'cash.bos_chk': 'BoS checking', 'cash.bos_sav': 'BoS savings', 'cash.lisa': 'Lisa\u2019s account', 'cash.tiwik': 'TiwiK account', 'cash.kiwit': 'KiwiT account', 'cash.ov_hsa': 'Oak Valley HSA', 'cash.ov_mm': 'Oak Valley money market',
    'buffer.low': 'Working buffer \u00b7 low', 'buffer.high': 'Working buffer \u00b7 high',
    'inc.k1': 'K-1 income / yr', 'inc.w2': 'W-2 income / yr', 'hh.burn': 'Household burn / mo',
    'ld.rev': 'Revenue / mo', 'ld.util': 'Utilities / mo', 'ld.rep': 'Repairs / mo', 'ld.ins': 'Insurance / mo',
    'mw.rent_lease': 'Tenant rent / mo', 'mw.tax': 'Property tax / mo', 'mw.ins': 'Insurance / mo',
    'st.rent': 'Rent / mo', 'st.tax': 'Property tax / mo', 'st.ins': 'Insurance / mo', 'st.debt': 'Loan payment / mo',
    'ins.kiwit': 'KiwiT building policy', 'ins.sierra_wc': 'Sierra workers comp',
    're.wet': 'Wetumka', 're.st': 'Stewart Street', 're.mono': 'Mono Way'
  };
  // ---- Statuses are Verified or Incomplete. v64: an Incomplete row still shows (and counts) its Doc/Vault estimate; it is tagged Incomplete. A dash
  // appears only when there is no number anywhere. No figures here: only which rows are exact calculations, facts Zac stated, and the plain-words
  // list of what Zac must provide for each Incomplete row. ----
  var OV_FOLD = { 'ld.ins': 1, 'wet.maturity': 1 };   // Doc "DERIVED" rows that are exact calculations from verified documents: shown as Verified
  // v64: property and equipment values are Zac's last estimates (no appraisals are requested); they are counted, tagged Incomplete, and never listed under "Needs from Zac".
  var OV_NOASK = { 're.total': 1, 're.wet': 1, 're.st': 1, 're.mono': 1, 'eq.value': 1 };
  var OV_ESTNOTE = 'Zac\u2019s last estimated value is used and counted. It stays tagged Incomplete.';
  function ovTodoFilter(list) { return list.filter(function (t) { return !/property values|apprais/i.test(String(t.lead || '') + ' ' + String(t.text || '')); }); }
  var OV_STATED = {   // facts Zac stated (10/3/2026) that are not in the Doc yet; a Doc row already Verified always wins
    'st.tax': { value: '$0', num: 0, source: 'Zac\u2019s statement 10/3/2026 (triple net: the tenant pays the property tax)' }
  };
  var OV_PROPS = [{ ref: 're.wet', label: 'Real estate \u00b7 Wetumka' }, { ref: 're.st', label: 'Real estate \u00b7 Stewart Street' }, { ref: 're.mono', label: 'Real estate \u00b7 Mono Way' }];
  var OV_GROUP = { inv: 'Investments', re: 'Real estate', eq: 'Equipment', mono: 'Mono Way loan', all: 'Equipment loan', wet: 'Wetumka loan', ld: 'Laundromat (TiwiK)',
    mw: 'Mono Way (KiwiT)', st: 'Stewart Street (KiwiT)', ins: 'Insurance', inc: 'Income', hh: 'Household', buffer: 'Cash buffer', cash: 'Cash' };
  var OV_REF_ORDER = ['inv.af', 're.wet', 're.st', 're.mono', 'eq.value', 'mono.bal', 'all.payoff', 'ld.rev', 'ld.util', 'ld.rep', 'mw.tax', 'mw.ins', 'ins.kiwit',
    'st.rent', 'st.tax', 'st.ins', 'ins.sierra_wc', 'inc.k1', 'inc.w2', 'hh.burn', 'buffer.low', 'buffer.high'];
  var OV_NEEDS = {
    'inv.af': [['Latest American Funds statement, with the statement date', 'American Funds is not in the Vault. Zac\u2019s last estimate is counted and tagged Incomplete until a statement arrives.']],
    're.wet': [['', OV_ESTNOTE]],
    're.st': [['', OV_ESTNOTE]],
    're.mono': [['', OV_ESTNOTE]],
    'eq.value': [['', OV_ESTNOTE]],
    'mono.bal': [['Bank of Stockton statement for the Mono Way loan: balance, escrow/impound and next payment due', 'The balance shown is calculated from the signed note and the payments since 7/5/2026, so it can be off by a little until a statement confirms it.']],
    'all.payoff': [['Written payoff quote from Alliance for the equipment loan, with the good-through date', 'The payoff shown is calculated from the Equipment Payoff Options doc, not a written quote. The loan balance above is verified.']],
    'ld.rev': [['Laundromat revenue for the last 12 months (machine back-office report), or a full month of weekly deposits logged in the Vault Income tab', 'Only part of one month is in the Vault so far.']],
    'ld.util': [['Laundromat utility bills for the last 12 months: PG&E, water and gas (or log them in the Vault under TiwiK)', 'No utility payments are in the Vault yet.']],
    'ld.rep': [['Laundromat repair and maintenance invoices for the last 12 months (or log them in the Vault under TiwiK)', 'Only a few repair payments are in the Vault so far.']],
    'mw.tax': [['Mono Way property tax bills showing the amount and the period each payment covers', 'The Vault shows one tax check paid by KiwiT, but not whether it is a full year or one installment, so the monthly estimate is counted as Incomplete.']],
    'mw.ins': [['KiwiT building policy declarations page (THREE / Berkshire Hathaway) with the actual premium and the payment plan', 'The Vault shows the last insurance payment, but the policy premium and whether it is paid monthly are not documented.']],
    'ins.kiwit': [['KiwiT building policy declarations page (THREE / Berkshire Hathaway) with the actual premium and the payment plan', 'The premium on file is an estimate; it is counted and tagged Incomplete.']],
    'st.rent': [['Stewart Street lease with Sierra Consultants Inc. showing the monthly rent (triple net), and the first rent payment logged in the Vault Income tab', 'No lease or rent payment is on file, so the rent shown is an estimate.']],
    'st.tax': [['Lease page showing the tenant pays Stewart Street property tax (triple net)', 'Confirms the tenant, not KiwiT, pays the tax.']],
    'st.ins': [['Who insures Stewart Street: the tenant\u2019s certificate of insurance naming KiwiT, or KiwiT\u2019s own policy declarations page', 'No Stewart Street policy is on file.']],
    'ins.sierra_wc': [['Sierra Consultants workers comp final audited premium', 'The premium on file is an estimate; it is counted and tagged Incomplete.']],
    'inc.k1': [['Sierra Consultants K-1: the latest year-end K-1, or 2026 year-to-date distributions', 'No K-1 income is in the Vault (Sierra Consultants stays out of the Vault).']],
    'inc.w2': [['Your latest pay stub or W-2, Lisa\u2019s income documents, and the 2025 tax returns', 'Only checks logged in the Vault are counted as income.']],
    'hh.burn': [['Keep logging household spend in the Vault until at least 14 days of the month are logged (about 30 days for a full picture)', 'Until then the Doc estimate is used and tagged Incomplete; once 14+ days are logged the Vault figure replaces it.'],
      ['Tell me whether your household spend already includes the Wetumka mortgage payment', 'Avoids counting the mortgage twice in cash flow.']],
    'buffer.low': [['Confirm the working cash buffer you want to hold (low end)', 'This is your decision, not a document.']],
    'buffer.high': [['Confirm the working cash buffer you want to hold (high end)', 'This is your decision, not a document.']]
  };
  function ovLabel(r) {
    if (OV_LABEL[r.ref]) return OV_LABEL[r.ref];
    var t = String(r.figure || r.ref).replace(/\s*[\(=].*$/, '');
    return t.length > 60 ? t.slice(0, 57) + '\u2026' : t;
  }
  function ovIndex(d) {
    var idx = {};
    ov.stated = {};
    (d.ledger || []).forEach(function (r) {
      var s = OV_STATED[r.ref];
      if (s && !/^verified/i.test(String(r.status || ''))) {   // a fact Zac stated (not in the Doc yet): treated like the Doc's "Zac's statement" rows
        r = { ref: r.ref, figure: r.figure, value: s.value, num: s.num, status: 'VERIFIED', source: s.source };
        ov.stated[r.ref] = 1;
      }
      idx[r.ref] = r;
    });
    ov.idx = idx; ov.d = d;
  }
  // Status model (v54ov): every figure is Verified or Incomplete. A Doc DERIVED row is Verified only when it is an exact calculation from
  // verified documents (OV_FOLD); other DERIVED / ESTIMATE rows are Incomplete: their number is still shown and counted, tagged Incomplete.
  function ovEst(ref) {
    if (ov.fixed[ref]) return false;
    if (ov.virt[ref]) return true;
    var r = ov.idx[ref];
    if (!r) return false;
    var t = String(r.status || '');
    if (/^verified/i.test(t)) return false;
    if (/^derived/i.test(t)) return !OV_FOLD[ref];
    return true;
  }
  function ovN(ref) {   // the number for a ledger row, Incomplete or not (or null when there truly is none)
    var o = ov.ovr[ref];
    if (o && o.val != null) return o.val;
    var r = ov.idx[ref];
    if (!r) return null;
    if (typeof r.num === 'number' && isFinite(r.num)) return r.num;
    var m = moneyNum(r.value);
    if (m !== null) return m;
    if (/%/.test(r.value)) { var p = parseFloat(String(r.value).replace(/[^\d.\-]/g, '')); return isNaN(p) ? null : p; }
    return null;
  }
  function ovUrl(label) {
    var d = ov.d, hit = null;
    (d.srcLinks || []).forEach(function (s) { if (s.label === label) hit = s.url; });
    if (!hit) (d.srcLinks || []).forEach(function (s) { if (!hit && label && (s.label.indexOf(label) === 0 || label.indexOf(s.label) === 0)) hit = s.url; });
    return hit || d.url || '';
  }
  function ovWhole(n) { return (n < 0 ? '\u2212' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function ovMo(n) { return n === null || !isFinite(n) ? '\u2014' : (Math.round(n * 10) / 10).toFixed(1) + ' mo'; }
  function ovNeeds(ref) {
    if (ov.dyn[ref]) return ov.dyn[ref];
    if (ref === 're.total') return ['re.wet', 're.st', 're.mono'].reduce(function (a, k) { return a.concat(ovNeeds(k)); }, []);
    if (OV_NEEDS[ref]) return OV_NEEDS[ref].map(function (n) { return { ref: ref, need: n[0], why: n[1] }; });
    return (ov.d.needs || []).filter(function (n) {
      return String(n.ref || '').split(/[,\s]+/).some(function (t) {
        return t === ref || (/\.\*$/.test(t) && ref.indexOf(t.slice(0, -1)) === 0);
      });
    });
  }
  function ovEstKey(refs) { return refs.join(' '); }
  function ovIncOf(refs) { return refs.filter(function (r, i) { return ovEst(r) && refs.indexOf(r) === i; }); }
  function ovEstBtn(refs) {
    refs = ovIncOf(refs);
    if (!refs.length) return '';
    return '<button class="badge est" data-ov-est="' + esc(ovEstKey(refs)) + '">Incomplete</button>';
  }
  function ovNeedBox(refs) {
    refs = ovIncOf(refs);
    if (!refs.length) return '';
    var seen = {}, h = '';
    refs.forEach(function (r) {
      ovNeeds(r).forEach(function (n) {
        var k = String(n.need || ''); if (seen[k]) return; seen[k] = 1;
        var nd = String(n.need || '').replace(/^[\u2610\u2611\s]+/, '');
        if (!nd && !refs.every(function (x) { return OV_NOASK[x]; })) return;
        h += '<div class="ovneedrow">' + (nd ? '\u2610 ' + esc(nd) : '') + (n.why ? (nd ? '<small>' : '') + esc(n.why) + (nd ? '</small>' : '') : '') + '</div>';
      });
    });
    if (!h) h = '<div class="ovneedrow">\u2610 A dated statement or document for this figure.</div>';
    var key = ovEstKey(refs);
    return '<div class="ovneed" data-ov-need="' + esc(key) + '"' + (ov.estOpen[key] ? '' : ' hidden') + '><b>' + (refs.every(function (r) { return OV_NOASK[r]; }) ? 'About this figure' : 'Needed from Zac') + '</b>' + h + '</div>';
  }
  function ovLink(text, label) {
    var u = ovUrl(label);
    return u ? '<a class="srcnum" data-title="' + esc(label || 'Document') + '" href="' + esc(u) + '">' + esc(text) + '</a>' : esc(text);
  }
  // Vault rows that back (part of) a figure, shown under it and tappable to the rows. Month on screen.
  function ovEvLine(ref) {
    var e = ov.ev[ref];
    if (!e) return '';
    return '<div class="ovrow calc"><div class="ovl"><small><span class="badge ok">Vault</span> ' + esc(e.text) + '</small></div>' +
      '<div class="ovv"><button class="ovgo amt-bal"' + goAttr(e.route) + '>' + money(e.amt) + ' &rsaquo;</button></div></div>';
  }
  // one document figure: label, tappable value (opens the source), status badge + source name
  function ovRow(ref, label, cls) {
    var r = ov.idx[ref];
    if (!r) return '';
    var est = ovEst(ref), n = ovN(ref), o = ov.ovr[ref], val, src;
    var badge = est ? ovEstBtn([ref]) : '<span class="badge ok">Verified</span>';
    if (o && o.val != null) { val = '<button class="ovgo"' + goAttr(o.route) + '>' + money(o.val) + ' &rsaquo;</button>'; src = o.src; }
    else if (est && n === null) { val = '\u2014'; src = 'No figure in the Doc or Vault yet'; }
    else { val = ov.stated[ref] ? esc(r.value) : ovLink(r.value, r.source); src = r.source || ''; }
    return '<div class="ovrow"><div class="ovl"><span>' + esc(label || ovLabel(r)) + '</span><small>' + badge + ' ' + esc(src) + '</small></div>' +
      '<div class="ovv' + (cls ? ' ' + cls : '') + '">' + val + '</div></div>' + (est ? ovNeedBox([ref]) : '') + (o ? '' : ovEvLine(ref));
  }
  // a computed figure (always from the document figures above / Vault); the Incomplete badge comes from the refs it uses
  function ovCalcRow(label, valHtml, cls, sub, refs) {
    var b = refs && refs.length ? ovEstBtn(refs) : '';
    return '<div class="ovrow calc"><div class="ovl"><span>' + esc(label) + '</span>' + (sub || b ? '<small>' + b + (b && sub ? ' ' : '') + (sub ? esc(sub) : '') + '</small>' : '') + '</div>' +
      '<div class="ovv' + (cls ? ' ' + cls : '') + '">' + valHtml + '</div></div>' + (refs && refs.length ? ovNeedBox(refs) : '');
  }
  function ovSum(label, val, cls, sub, open) {
    return '<div class="fxsum ovsum ' + (cls || '') + '" role="button" tabindex="0" data-ov-open="' + esc(open || '') + '"><div class="fxl">' + esc(label) + '</div><div class="fxv">' + esc(val) + '</div>' +
      (sub ? '<div class="fxs">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function ovTot(refs) {
    var t = 0, ok = false;
    refs.forEach(function (r) { var n = ovN(r); if (n !== null) { t += n; ok = true; } });
    return ok ? t : null;
  }
  function ovDaysIn(off) { var t = new Date(); return new Date(t.getFullYear(), t.getMonth() + (Number(off) || 0) + 1, 0).getDate(); }

  // Vault numbers for the month on screen
  function ovVault() {
    ov.ev = {}; ov.ovr = {};
    if (ov.sp.s !== 'ok') return null;
    var d = ov.sp.data, M = spendModel(d), off = state.monthOffset, days = periodDays(off), dim = ovDaysIn(off);
    var logged = d.daysLogged != null ? Number(d.daysLogged) : days;
    var acct = function (n) { var a = M.accounts.filter(function (x) { return x.name === n; })[0]; return a ? a.amount : 0; };
    var reliable = days > 0 && logged >= 14, scale = days > 0 ? dim / days : 0;
    var hh = acct('Household');
    var V = { d: d, M: M, off: off, days: days, logged: logged, reliable: reliable, hh: hh,
      burn: reliable ? r2(hh * scale) : null, incM: reliable ? r2(M.incomeTotal * scale) : null, acct: acct };
    ovEvid(V);
    return V;
  }

  function ovVaultCard(V) {
    var st = ov.sp, h = '';
    h += '<div class="ldmonth"><button class="navbtn" data-ov-month="-1">&lsaquo; Prev</button><div class="navlabel">' + esc(st.data && st.data.monthLabel || '') + '</div><button class="navbtn" data-ov-month="1">Next &rsaquo;</button></div>';
    if (st.s === 'load') return h + '<div class="loading">Loading the Vault\u2026</div>';
    if (st.s === 'err') return h + '<div class="error">' + esc(friendly(st.err)) + '<div class="retry"><button class="navbtn" data-ov-retry>Try again</button></div></div>';
    var M = V.M, cashOK = M.full, tiwNet = r2(sumOf(M.income, 'Mono Village Laundromat') - V.acct('TiwiK'));
    h += '<div class="foot ldlive">Live from the Vault \u00b7 ' + esc(String(V.logged)) + ' day' + (V.logged === 1 ? '' : 's') + ' logged \u00b7 tap any number to see the entries behind it.</div>';
    h += '<div class="card income"><h4 class="sechead">Income by source</h4>' + barRows(M.sources.filter(function (s) { return s.amount || s.count; }), incomeRoute, ' inc') +
      totBtn('Income total', M.incomeTotal, incomeRoute('All'), true) + '</div>';
    var accts = M.accounts.filter(function (a) { return a.amount; });
    h += '<div class="card acctsec"><h4 class="sechead">Spend by account</h4>' +
      barRows(accts, acctRoute, '', cashOK ? function (a) { return { v: cashOf(M.items.filter(function (x) { return x.account === a; })), route: cashRoute(a) }; } : null) +
      totBtn('Total spent', M.total, 'spend/all') + '</div>';
    accts.forEach(function (a) {
      if (!a.cats.length) return;
      var mine = M.items.filter(function (x) { return x.account === a.name; });
      h += collCard('ovv-' + a.name, a.name + ' by category', a.cats.length, barRows(a.cats, function (c) { return catRoute(c, a.name); }, '',
        cashOK ? function (c) { return { v: cashOf(mine.filter(function (x) { return x.category === c; })), route: cashRoute(a.name, c) }; } : null), false, 'nest');
    });
    var hhItems = M.items.filter(function (x) { return x.account === 'Household'; });
    h += '<div class="card summary"><h3>Net &amp; burn</h3>' +
      sumBtn('net cmp', calcRoute('tiwik-net'), 'TiwiK net<small>Laundromat income \u2212 TiwiK spend</small>', '<span class="amt ' + (tiwNet >= 0 ? 'amt-in' : 'amt-out') + '">' + signedMoney(tiwNet) + '</span>') +
      sumBtn('net cmp', acctRoute('Household'), 'Household burn (month so far)<small>' + (cashOK ? 'of which Cash ' + money(cashOf(hhItems)) : 'all Household spend') + '</small>', '<span class="amt amt-out">' + money(V.hh) + '</span>') +
      (cashOK ? sumBtn('minor', cashRoute('Household'), 'Household cash subset', '<span class="amt amt-out">' + money(cashOf(hhItems)) + '</span>') : '') +
      '</div>';
    if (!V.reliable) h += '<div class="fxnote"><b>Not enough days yet</b> Fewer than 14 days are logged this month, so household burn, runway and cash flow show as Incomplete until more days are logged.</div>';
    h += sheetLink('Open in spend sheet');
    return h;
  }
  function sumOf(list, src) { return r2(list.filter(function (x) { return x.source === src; }).reduce(function (s, x) { return s + x.amount; }, 0)); }

  function ovCashCard(V, M) {
    var H = M.heads.cash, B = M.heads.burn, cash = H.val, lo = ovN('buffer.low'), hi = ovN('buffer.high'), burn = B.val, burnSrc = !!(V && V.reliable && burn !== null);
    var accts = H.groups[0] ? H.groups[0].comps : [];
    var h = '';
    h += ovCalcRow('Cash (' + accts.length + (accts.length === 1 ? ' account' : ' accounts') + ')', cash === null ? '\u2014' : ovWhole(cash), '', 'sum of the Vault accounts below', H.needRefs);
    h += collCard('ovcash', 'Accounts', accts.length, accts.map(ovCompRow).join(''), false, 'nest');
    h += ovRow('buffer.low') + ovRow('buffer.high');
    if (cash !== null && lo !== null && hi !== null) {
      h += ovCalcRow('Usable above buffer', ovWhole(cash - hi) + ' \u2013 ' + ovWhole(cash - lo), cash - hi >= 0 ? 'amt-in' : 'amt-out', 'cash \u2212 buffer (high \u2013 low)', H.needRefs.concat(['buffer.low', 'buffer.high']));
    }
    if (burnSrc) h += '<div class="ovrow calc"><div class="ovl"><span>Household burn / mo</span><small><span class="badge ok">Verified</span> Vault \u00b7 ' + esc(String(V.logged)) + ' days logged, scaled to the month</small></div>' +
      '<div class="ovv"><button class="ovgo amt-out" data-go="' + esc(acctRoute('Household')) + '">' + ovWhole(burn) + ' &rsaquo;</button></div></div>';
    else h += ovRow('hh.burn');
    if (cash !== null && burn) {
      var refs = H.needRefs.concat(burnSrc ? [] : ['hh.burn']);
      h += ovCalcRow('Runway: all cash \u00f7 burn', ovMo(cash / burn), '', burnSrc ? 'Vault burn' : 'household burn', refs);
      if (lo !== null && hi !== null) h += ovCalcRow('Runway above buffer', ovMo(Math.max(0, cash - hi) / burn) + ' \u2013 ' + ovMo(Math.max(0, cash - lo) / burn), '', 'cash \u2212 buffer (high \u2013 low), \u00f7 burn', refs.concat(['buffer.low', 'buffer.high']));
    } else {
      h += ovCalcRow('Runway: all cash \u00f7 burn', '\u2014', '', 'needs a household burn figure', ['hh.burn']);
    }
    return { html: h, cash: cash, burn: burn, burnSrc: burnSrc, runway: cash !== null && burn ? cash / burn : null };
  }

  function ovLoan(title, refs, key, openDefault) {
    return collCard(key, title, null, refs.map(function (r) { return ovRow(r); }).join(''), openDefault, 'nest');
  }

  function ovDebtCard(V, C) {
    var pays = ['wet.pay', 'mono.pay', 'all.pay'], ds = ovTot(pays), ds2 = ds !== null && ovN('all.pay2') !== null ? ds - ovN('all.pay') + ovN('all.pay2') : null;
    var h = ovRow('wet.pay', 'Wetumka \u00b7 Rocket (incl. escrow)') + ovRow('mono.pay', 'Mono Way \u00b7 Bank of Stockton') + ovRow('all.pay', 'Equipment \u00b7 Alliance (now)') + ovRow('all.pay2', 'Equipment \u00b7 Alliance (after reset)');
    h += ovCalcRow('Debt service / mo', ds === null ? '\u2014' : ovWhole(ds), 'amt-out', ds2 !== null ? 'after reset: ' + ovWhole(ds2) : '', pays);
    var inc = 0, refs = [];
    if (V && V.M) {
      inc = V.M.incomeTotal || 0;
      h += '<div class="ovrow calc"><div class="ovl"><span>Vault income</span><small><span class="badge ok">Verified</span> Vault \u00b7 logged this month so far</small></div><div class="ovv"><button class="ovgo amt-in" data-go="' + esc(incomeRoute('All')) + '">' + ovWhole(inc) + ' &rsaquo;</button></div></div>';
    } else h += '<div class="ovnote">Vault income is not loaded yet.</div>';
    if (V && V.M && V.M.liveNote) h += '<div class="ovnote">' + esc(V.M.liveNote) + '</div>';
    h += ovCalcRow('Total income (month to date)', ovWhole(inc), 'amt-in', '', refs);
    if (ds !== null && inc > 0) h += ovCalcRow('Debt service \u00f7 income', Math.round(ds / inc * 100) + '%', '', 'lower is better', refs);
    if (ds !== null && C.burn && V && V.M) {
      var cf = inc - C.burn - ds;
      h += ovCalcRow('Monthly cash flow', signedMoney2(cf), cf >= 0 ? 'amt-in' : 'amt-out', 'income \u2212 household burn \u2212 debt service', refs.concat(pays, C.burnSrc ? [] : ['hh.burn']));
      h += '<div class="ovnote">Indicative. If the household burn already includes the Wetumka mortgage, or the Vault TiwiK/KiwiT accounts already include the loan payments, those are counted twice.</div>';
    } else {
      h += ovCalcRow('Monthly cash flow', '\u2014', '', V && V.M ? 'needs a household burn figure' : 'needs the Vault income', ['hh.burn']);
    }
    h += '<div class="fxgrp">Annual income (K-1 and W-2)</div>' + ovRow('inc.k1') + ovRow('inc.w2');
    return { html: h, ds: ds, ds2: ds2 };
  }
  function signedMoney2(v) { return (v >= 0 ? '+' : '\u2212') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US'); }

  // Property & business cash flow: Incomplete estimates are summed and tagged Incomplete; a net names any line with no figure at all.
  function ovFlowCard() {
    var N = function (r) { var n = ovN(r); return n === null ? 0 : n; };
    var cls = function (n) { return n >= 0 ? 'amt-in' : 'amt-out'; };
    function part(label, signed, refs, sub0) {   // signed: list of [ref, +1|-1]
      var miss = refs.filter(function (r) { return ovEst(r) && ovN(r) === null; }), t = 0, any = false;
      signed.forEach(function (s) { var n = ovN(s[0]); if (n !== null) { t += s[1] * n; if (n !== 0) any = true; } });
      var sub = miss.length ? (sub0 + ' \u2014 no figure yet for ' + miss.map(function (r) { return (OV_LABEL[r] || r).replace(/ \/ mo$/, '').toLowerCase(); }).join(', ')) : sub0;
      var none = ovN(signed[0][0]) === null || (miss.length && !any);
      return { net: t, none: none, calc: ovCalcRow(label, none ? '\u2014' : signedMoney2(t), none ? '' : cls(t), sub, refs) };
    }
    var ld = part('Laundromat net / mo', [['ld.rev', 1], ['ld.util', -1], ['ld.rep', -1], ['ld.ins', -1], ['all.pay', -1]], ['ld.rev', 'ld.util', 'ld.rep', 'ld.ins', 'all.pay'], 'revenue \u2212 costs \u2212 loan payment');
    var mw = part('Mono Way net / mo', [['mw.rent_lease', 1], ['mw.tax', -1], ['mw.ins', -1], ['mono.pay', -1]], ['mw.rent_lease', 'mw.tax', 'mw.ins', 'mono.pay'], 'rent \u2212 tax \u2212 insurance \u2212 mortgage');
    var st = part('Stewart Street net / mo', [['st.rent', 1], ['st.tax', -1], ['st.ins', -1], ['st.debt', -1]], ['st.rent', 'st.tax', 'st.ins', 'st.debt'], 'rent \u2212 tax \u2212 insurance \u2212 loan');
    var wet = -N('wet.pay');
    var h = '<div class="fxgrp">Laundromat (TiwiK)</div>' + ['ld.rev', 'ld.util', 'ld.rep', 'ld.ins', 'all.pay'].map(function (r) { return ovRow(r, r === 'all.pay' ? 'Equipment loan payment / mo' : null); }).join('') + ld.calc;
    h += '<div class="fxgrp">Mono Way (KiwiT)</div>' + ['mw.rent_lease', 'mw.tax', 'mw.ins', 'mono.pay'].map(function (r) { return ovRow(r, r === 'mono.pay' ? 'Mortgage payment / mo' : null); }).join('') + mw.calc;
    h += '<div class="fxgrp">Stewart Street (KiwiT)</div>' + ['st.rent', 'st.tax', 'st.ins', 'st.debt'].map(function (r) { return ovRow(r); }).join('') + st.calc;
    h += '<div class="fxgrp">Wetumka</div>' + ovCalcRow('Rocket Mortgage payment / mo', signedMoney2(wet), 'amt-out', 'verified payment', []);
    var tot = ld.net + mw.net + st.net + wet, all = ['ld.rev', 'ld.util', 'ld.rep', 'mw.rent_lease', 'mw.tax', 'mw.ins', 'st.rent', 'st.tax', 'st.ins'];
    var allNone = ld.none && mw.none && st.none, incl = ovIncOf(all).length > 0;
    h += ovCalcRow('Combined / mo', allNone ? '\u2014' : signedMoney2(tot), allNone ? '' : cls(tot), allNone ? 'no figures yet' : 'sum of the four lines above' + (incl ? ' (estimates included)' : ''), all);
    return h;
  }

  function ovNetWorth(M) {
    var H = M.heads.nw, h = '';
    H.groups.forEach(function (g) {
      if (!g.comps.length && !g.total) return;
      if (g.title) h += '<div class="fxgrp">' + esc(g.title) + '</div>';
      h += g.comps.map(ovCompRow).join('');
      if (g.total) h += '<div class="ovrow calc"><div class="ovl"><span>' + esc(g.total.label) + '</span></div><div class="ovv"><span class="' + esc(g.total.cls || '') + '">' + ovWhole(g.total.val) + '</span></div></div>';
    });
    if (H.val !== null) h += ovCalcRow('Net worth', ovWhole(H.val), H.val >= 0 ? 'amt-in' : 'amt-out', 'assets \u2212 debt (estimates included)', H.needRefs);
    else h += ovCalcRow('Net worth', '\u2014', '', 'needs the Vault balances or Doc figures', H.needRefs);
    h += ovRow('bos.cl.limit') + ovRow('bos.heloc.limit') + '<div class="ovnote">The two unused Bank of Stockton lines are not in net worth.</div>';
    return { html: h, nw: H.val };
  }

  // Investments (E*TRADE from the live Balances rows; American Funds is not in the Vault, so it is Zac\u2019s estimate, tagged Incomplete until a statement arrives).
  function ovInvCard(M) {
    M = M || ovModel();
    var c = M.invC || [];
    if (!c.length) return '<div class="foot">No investment balances yet.</div>';
    var refs = []; c.forEach(function (x) { if (x.tag === 'est' && x.ref) refs.push(x.ref); });
    return c.map(ovCompRow).join('') + ovCalcRow('Investments total' + (refs.length ? ' (includes estimates)' : ''), M.invTotal === null ? '\u2014' : ovWhole(M.invTotal), 'amt-bal', '', refs) +
      '<button class="bigbtn ovlink" ' + goAttr(balRoute('g:Investments')) + '>Investment balances (Balances tab rows) &rsaquo;</button>' +
      '<div class="ovnote">Counted in Net worth and Total assets. Not in Cash, the Vault Accounts total or reconciliation.</div>';
  }

  // Every Incomplete item and what Zac must provide for it (built from the same state that draws the badges).
  function ovIncRefs() {
    var out = [], seen = {};
    function add(ref) { if (!seen[ref] && ovEst(ref)) { seen[ref] = 1; out.push(ref); } }
    OV_REF_ORDER.forEach(add);
    Object.keys(ov.virt).forEach(add);
    (ov.d.ledger || []).forEach(function (r) { if (!/^(cash|bos)\./.test(r.ref) && !(r.ref === 're.total' && ov.virt['re.wet'])) add(r.ref); });
    return out;
  }
  function ovIncTitle(ref) {
    var g = OV_GROUP[ref.split('.')[0]] || '', r = ov.idx[ref], l = OV_LABEL[ref] || (r ? ovLabel(r) : ref);
    if (/^cash\./.test(ref)) return OV_LABEL[ref] ? 'Cash accounts' : 'Cash \u00b7 ' + ref.slice(5);
    return g && l.indexOf(g) !== 0 ? g + ' \u00b7 ' + l : l;
  }
  function ovNeedsCard() {
    var rows = [], seen = {};
    ovIncRefs().forEach(function (ref) {
      if (OV_NOASK[ref]) return;
      ovNeeds(ref).forEach(function (n) {
        var k = String(n.need || ''); if (!k || seen[k]) return; seen[k] = 1;
        rows.push({ ref: ref, need: k, why: n.why, title: ovIncTitle(ref) });
      });
    });
    if (!rows.length) return '';
    return collCard('ovneeds', 'Needs from Zac', rows.length, rows.map(function (n) {
      return '<div class="todorow ovneedit"><div class="fxtdh"><span>' + esc(n.need.replace(/^[\u2610\u2611\s]+/, '')) + '</span></div>' +
        '<div class="ovwhy"><span class="badge est">Incomplete</span> ' + esc(n.title) + '</div>' +
        (n.why ? '<div class="ovwhy">' + esc(n.why) + '</div>' : '') + '</div>';
    }).join(''), false);
  }

  // ---- Headline numbers (v46): live model + tap-through detail ----
  // Each headline is built from components. A component is Vault-backed when its value comes from the Vault (Accounts balances, Debt
  // loans, logged income / spend) and otherwise comes from the Overview Doc ledger. Where the Vault has a real number it replaces the
  // Doc's one and any difference from a Verified Doc figure is flagged. No figures live in this file.
  var OV_HEADS = {
    nw: { title: 'Net worth', tile: 'Net worth', how: 'Assets \u2212 debt' },
    debt: { title: 'Total debt', tile: 'Total debt', how: 'Sum of the loan balances' },
    cash: { title: 'Cash', tile: 'Cash', how: 'Sum of the cash accounts' },
    ds: { title: 'Debt service / mo', tile: 'Debt service / mo', how: 'Sum of the monthly loan payments' },
    inc: { title: 'Income (month to date)', tile: 'Income (MTD)', how: 'Income logged in the Vault this month' },
    burn: { title: 'Household burn / mo', tile: 'Burn / mo', how: 'Logged Household spend, scaled to the month' },
    runway: { title: 'Cash runway', tile: 'Cash runway', how: 'Cash \u00f7 monthly burn' },
    flow: { title: 'Cash flow / mo', tile: 'Cash flow / mo', how: 'Income \u2212 burn \u2212 debt service' }
  };
  var OV_ORDER = ['nw', 'debt', 'cash', 'ds', 'inc', 'burn', 'runway', 'flow'];
  var OV_RANK = { ver: 0, est: 1 };
  var OV_STOP = { account: 1, accounts: 1, the: 1, and: 1, of: 1, llc: 1, inc: 1, business: 1, personal: 1, acct: 1, s: 1 };
  function ovTagOf(s) { return /^verified/i.test(String(s || '')) ? 'ver' : 'est'; }   // Vault Debt / Doc status text: anything but Verified is Incomplete
  function ovTagBadge(tag, ref) {
    if (tag === 'est' && ref) { var b = ovEstBtn([ref]); if (b) return b; }
    return tag === 'est' ? '<span class="badge est">Incomplete</span>' : '<span class="badge ok">Verified</span>';
  }
  function ovToks(s) {
    s = String(s || '').toLowerCase().replace(/e[\s*\-]*trade/g, 'etrade').replace(/bank of stockton/g, 'bos').replace(/oak valley( community)?( bank)?/g, 'ov')
      .replace(/money market/g, 'mm').replace(/\bchk\b/g, 'checking').replace(/\bsav\b/g, 'savings').replace(/[\u2019']s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    return s ? s.split(' ').filter(function (w) { return !OV_STOP[w]; }) : [];
  }
  function ovIsInv(a) { return /invest|brokerage|retire/i.test(String(a.group || '') + ' ' + String(a.type || '')); }
  function ovFindAcct(A, label, claimed, listKey) {
    if (!A) return { a: null, n: 0 };
    var src = A[listKey || 'accounts'] || [];
    var want = ovToks(label);
    if (!want.length) return { a: null, n: 0 };
    function pass(fn) {
      return src.filter(function (a) {
        if (a.balance === null || claimed.indexOf(a) >= 0) return false;
        var have = ovToks(fn(a));
        return want.every(function (w) { return have.indexOf(w) >= 0; });
      });
    }
    var c = pass(function (a) { return a.name + ' ' + a.bank + ' ' + a.type; });
    if (!c.length) c = pass(function (a) { return a.name + ' ' + a.bank + ' ' + a.type + ' ' + a.group; });
    return { a: c.length === 1 ? c[0] : null, n: c.length };
  }
  function ovDocComp(ref, label) {
    var r = ov.idx[ref];
    if (!r) return null;
    var est = ovEst(ref), v = ovN(ref);
    return { id: ref, ref: ref, label: label || ovLabel(r), val: v, tag: est ? 'est' : 'ver', vault: false,
      src: est && v === null ? 'No figure in the Doc or Vault yet' : (r.source || 'Overview Doc'), docSrc: est && v === null || ov.stated[ref] ? '' : (r.source || '') };
  }
  function ovAcctComp(a) {
    var owed = ledKind(a) === 'card';   // a credit card balance is the amount owed: it lowers cash (and net worth) instead of adding to it
    return { id: a.name, label: a.name, val: owed && a.balance !== null ? -Math.abs(a.balance) : a.balance, tag: 'ver', vault: true, src: 'Vault Accounts \u00b7 ' + a.name + (owed ? ' (credit card, amount owed)' : ''), asOf: a.asOf, go: balRoute(a.name), vsec: 'accounts', goLabel: 'Vault Accounts' };
  }
  function ovInvComp(a) {
    return { id: a.name, label: a.name, val: a.balance, tag: 'ver', vault: true, src: 'Vault Balances \u00b7 ' + a.name, asOf: a.asOf, go: balRoute(a.name), goLabel: 'Balances' };
  }
  function ovApplyInv(c, m) {   // live Investments row replaces the Doc value (never both); a difference from a Verified Doc figure is flagged
    if (!c) return null;
    if (!m.a) { if (m.n > 1) c.note = 'The Vault has ' + m.n + ' investment rows that could match, so none is used.'; return c; }
    var o = ovInvComp(m.a);
    o.id = c.id; o.ref = c.ref; o.label = c.label; o.vaultName = m.a.name;
    ov.fixed[c.ref] = true;
    if (c.val !== null && c.tag !== 'est' && Math.abs(c.val - m.a.balance) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: m.a.balance };
    return o;
  }
  function ovApplyAcct(c, m) {
    if (!c) return null;
    if (!m.a) { if (m.n > 1) c.note = 'The Vault has ' + m.n + ' accounts that could match, so none is used.'; return c; }
    var o = ovAcctComp(m.a);
    o.id = c.id; o.ref = c.ref; o.label = c.label; o.vaultName = m.a.name;
    if (c.val !== null && c.tag !== 'est' && Math.abs(c.val - m.a.balance) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: m.a.balance };
    return o;
  }
  var OV_LOANS = [
    { ref: 'wet', re: /wetumka|rocket/i, label: 'Wetumka \u00b7 Rocket Mortgage' },
    { ref: 'mono', re: /mono\s*way|stockton/i, label: 'Mono Way \u00b7 Bank of Stockton (KiwiT)' },
    { ref: 'all', re: /alliance|equipment/i, label: 'Equipment \u00b7 Alliance (TiwiK)' }
  ];
  function ovLoanFor(D, spec, claimed) {
    if (!D) return null;
    var hit = D.loans.filter(function (l) { return claimed.indexOf(l) < 0 && spec.re.test(l.name + ' ' + l.entity + ' ' + l.key); });
    return hit.length ? hit[0] : null;
  }
  function ovLoanComp(l, which) {
    var isBal = which === 'balance', f = l.fields[which], v = isBal ? l.balance : l.payment;
    if (v === null || v === undefined) return null;
    return { id: l.key + which, label: isBal ? l.name : l.name + ' \u00b7 payment', val: v, tag: ovTagOf(f ? f.status : l.status), vault: true,
      src: 'Vault Debt \u00b7 ' + ((f && f.source) || l.name), url: f && f.url || '', asOfText: isBal ? l.balanceNote : '', go: 'spend', vsec: 'debt', goLabel: 'Vault Debt',
      next: !isBal && l.paymentNext ? l.paymentNext.amount : null };
  }
  function ovApplyLoan(c, l, which) {
    if (!c) return null;
    var o = l ? ovLoanComp(l, which) : null;
    if (!o) return c;
    o.label = c.label; o.ref = c.ref; o.id = c.id;
    if (o.tag === 'est') ov.virt[c.ref] = true; else ov.fixed[c.ref] = true;   // the Vault Debt row decides Verified / Incomplete
    if (c.val !== null && c.tag !== 'est' && Math.abs(c.val - o.val) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: o.val };
    if (which === 'payment' && o.next == null && ov.idx[c.ref.replace(/\.pay$/, '.pay2')]) o.next = ovN(c.ref.replace(/\.pay$/, '.pay2'));
    return o;
  }
  function ovSumC(list) {
    var t = 0, ok = false;
    list.forEach(function (c) { if (c && c.val !== null && c.val !== undefined) { t += c.val; ok = true; } });
    return ok ? t : null;
  }
  function ovCov(list) {
    var x = 0, y = 0;
    list.forEach(function (c) {
      if (!c) return;
      if (c.agg) { x += c.cov.x; y += c.cov.y; } else { y++; if (c.vault) x++; }
    });
    return { x: x, y: y };
  }
  function ovWorstTag(list) {
    var r = 0;
    list.forEach(function (c) { if (c) r = Math.max(r, OV_RANK[c.tag] || 0); });
    return ['ver', 'est'][r];
  }
  function ovAsOf(list) {
    var lo = '', hi = '';
    list.forEach(function (c) {
      if (!c || !c.asOf) return;
      var d = String(c.asOf).slice(0, 10);
      if (!lo || d < lo) lo = d;
      if (!hi || d > hi) hi = d;
    });
    return lo ? [lo, hi] : null;
  }
  function ovHead(key, comps, o) {
    comps = comps.filter(function (c) { return c; });
    var h = { key: key, groups: o.groups || [{ title: o.gtitle || 'Components', comps: comps }], val: o.val, comps: comps, flags: [], notes: o.notes || [], calc: o.calc || OV_HEADS[key].how,
      cls: o.cls || '', fmt: o.fmt || 'money', vsecs: o.vsecs || [], sub: o.sub || '', noneSub: o.noneSub || '', extra: o.extra || '', needRefs: [] };
    h.cov = ovCov(comps); h.tag = ovWorstTag(comps); h.asOf = ovAsOf(comps);
    comps.forEach(function (c) {
      var rs = c.agg ? (c.needRefs || []) : (c.tag === 'est' && c.ref ? [c.ref] : []);
      rs.forEach(function (r) { if (h.needRefs.indexOf(r) < 0) h.needRefs.push(r); });
    });
    comps.forEach(function (c) {
      if (c.agg) { (c.flags || []).forEach(function (f) { h.flags.push(f); }); }
      else if (c.mismatch) h.flags.push({ label: c.label, vault: c.mismatch.vault, doc: c.mismatch.doc, docTag: c.mismatch.docTag, ref: c.mismatch.ref, inline: true });
      if (c.flag) h.flags.push(c.flag);
    });
    (o.flags || []).forEach(function (f) { h.flags.push(f); });
    return h;
  }
  function ovAgg(head, label, sign) {
    return { agg: true, key: head.key, label: label, val: head.val === null ? null : sign * head.val, tag: head.tag, cov: head.cov, flags: head.flags, needRefs: head.needRefs, go: 'fin/overview/' + head.key, fmt: head.fmt, cls: head.cls };
  }

  function ovVirt(ref, label) { ov.virt[ref] = true; return { id: ref, ref: ref, label: label, val: null, tag: 'est', vault: false, src: 'No figure in the Doc or Vault yet' }; }
  function ovDocOrVirt(ref, label) { return ovDocComp(ref, label) || ovVirt(ref, label || OV_LABEL[ref] || ref); }
  // Vault rows that back a Doc figure for the month on screen (shown under the figure; one of them supplies the verified number for mw.ins).
  function ovEvid(V) {
    var M = V.M, mon = V.d && V.d.monthLabel ? V.d.monthLabel : '';
    function sum(l) { return r2(l.reduce(function (s, x) { return s + x.amount; }, 0)); }
    function newest(l) { return l.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; })[0]; }
    function inc(rx) { return M.income.filter(function (x) { return x.amount && rx.test(x.source); }); }
    function exp(acct, rx) { return M.items.filter(function (x) { return x.account === acct && x.amount && rx.test(x.category + ' ' + x.merchant); }); }
    function cat(l, acct) { var c = l[0].category; return l.every(function (x) { return x.category === c; }) ? catRoute(c, acct) : acctRoute(acct); }
    function put(ref, l, desc, route) { if (l.length) ov.ev[ref] = { text: mon + ': ' + desc + ' (' + l.length + (l.length === 1 ? ' row' : ' rows') + ')', amt: sum(l), route: route }; }
    var l;
    put('mw.rent_lease', inc(/kiwit rent/i), 'rent received', incomeRoute(KR_SOURCE));
    put('ld.rev', inc(/laundromat/i), 'laundromat income logged (not a full month)', incomeRoute('Mono Village Laundromat'));
    put('inc.w2', inc(/land & structure/i), 'pay checks logged', incomeRoute(LS_SOURCE));
    l = inc(/stewart|sierra/i); if (l.length) put('st.rent', l, 'Stewart Street rent logged', incomeRoute(l[0].source));
    l = exp('TiwiK', /repair|plumb|maint|hvac/i); if (l.length) put('ld.rep', l, 'laundromat repairs logged', cat(l, 'TiwiK'));
    l = exp('TiwiK', /util|pg&e|pge|water|gas|sewer|trash|power/i); if (l.length) put('ld.util', l, 'laundromat utilities logged', cat(l, 'TiwiK'));
    l = exp('KiwiT', /tax/i); if (l.length) put('mw.tax', l, 'property tax paid (period covered not documented)', cat(l, 'KiwiT'));
    put('hh.burn', M.items.filter(function (x) { return x.account === 'Household' && x.amount; }), 'household spend logged, ' + V.logged + (V.logged === 1 ? ' day' : ' days'), acctRoute('Household'));
    l = exp('KiwiT', /insur/i);
    if (l.length) {
      var n = newest(l);
      ov.ovr['mw.ins'] = { val: n.amount, src: 'Vault \u00b7 last insurance payment logged ' + n.label + (n.merchant ? ' (' + n.merchant + ')' : ''), route: cat(l, 'KiwiT') };
    }
  }

  function ovNwMissing(list) {
    var k = [];
    list.forEach(function (c) { var t = c.agg ? 'cash balances' : /^re\./.test(c.ref || '') ? 'real estate' : c.ref === 'eq.value' ? 'equipment' : c.ref === 'inv.af' ? 'American Funds' : (c.label || 'balances'); if (k.indexOf(t) < 0) k.push(t); });
    return k.length > 1 ? k.slice(0, -1).join(', ') + ' and ' + k[k.length - 1] : k[0] || '';
  }
  function ovDocCashFor(a, used) {   // Doc cash.* estimate for a Vault account that has no balance (unique token match only)
    var have = ovToks(a.name + ' ' + a.bank + ' ' + a.type), hit = [];
    (ov.d.ledger || []).forEach(function (r) {
      if (!/^cash\./.test(r.ref) || used.indexOf(r.ref) >= 0 || ovN(r.ref) === null) return;
      var want = ovToks(OV_LABEL[r.ref] || '');
      if (want.length && want.every(function (w) { return have.indexOf(w) >= 0; })) hit.push(r.ref);
    });
    return hit.length === 1 ? ovDocComp(hit[0], a.name) : null;
  }
  function ovModel() {
    var f = ov.fin, hasL = !!(f.s === 'ok' && f.data && Array.isArray(f.data.ledger) && f.data.ledger.length);
    ov.virt = {}; ov.fixed = {}; ov.dyn = {};
    if (hasL) ovIndex(f.data); else { ov.idx = {}; ov.stated = {}; }
    var V = ovVault(), A = state.acct && state.acct.d ? state.acct.d : null, D = state.debt && state.debt.d ? state.debt.d : null;
    var M = { hasL: hasL, V: V, A: A, D: D, heads: {}, leftover: [] };
    // ---- Cash (every Vault bank account) + investments (Vault Balances rows; Doc rows only when the Doc has them Verified) ----
    var cashC = [], invC = [], reC = [], eqC = [], invClaimed = [], docCashUsed = [], dc;
    (A ? A.accounts : []).forEach(function (a) {
      if (ovIsInv(a)) return;
      if (a.balance !== null) {
        var c = ovAcctComp(a);
        if (a.asOf && !acMonthEnd(a.asOf)) c.note = 'Last balance in the Vault is from ' + acDate(a.asOf) + ' (not month end); the month-end statement is pending.';
        cashC.push(c);
      } else if (hasL && (dc = ovDocCashFor(a, docCashUsed))) {
        docCashUsed.push(dc.ref); ov.virt[dc.ref] = true; cashC.push(dc);   // the Vault lists the account but has no balance: Zac's Doc estimate is used, tagged Incomplete
      } else {
        var k = 'cash.' + a.name;
        ov.virt[k] = true;
        ov.dyn[k] = [{ ref: k, need: 'Latest statement balance, with the date, for ' + a.name, why: 'The Vault lists this account but has no balance for it yet.' }];
        cashC.push({ id: a.name, ref: k, label: a.name, val: null, tag: 'est', vault: false, src: 'No balance in the Vault yet' });
      }
    });
    if (hasL && !cashC.length) (f.data.ledger || []).forEach(function (r) {   // no Vault cash accounts at all: use the Doc cash estimates
      if (/^cash\./.test(r.ref) && ovN(r.ref) !== null) { ov.virt[r.ref] = true; cashC.push(ovDocComp(r.ref, OV_LABEL[r.ref] || ovLabel(r))); }
    });
    if (hasL) {
      ['inv.af', 'inv.etrade'].forEach(function (ref) {
        var c = ovDocOrVirt(ref, OV_LABEL[ref]);
        var m = ovFindAcct(A, c.label, invClaimed, 'investments'); if (m.a) invClaimed.push(m.a);
        invC.push(ovApplyInv(c, m));
      });
      if (A) (A.investments || []).forEach(function (a) { if (a.balance !== null && invClaimed.indexOf(a) < 0) invC.push(ovInvComp(a)); });   // any other live Investments row counts too
      if (ov.idx['re.total']) reC = [ovDocComp('re.total')];   // Zac's last estimated property values (no appraisals); counted, tagged Incomplete
      else OV_PROPS.forEach(function (p) { reC.push(ovDocOrVirt(p.ref, p.label)); });
      eqC = [ovDocOrVirt('eq.value', OV_LABEL['eq.value'])];
    } else if (A) {
      (A.investments || []).forEach(function (a) { if (a.balance !== null) invC.push(ovInvComp(a)); });
    }
    invC = invC.filter(function (c) { return c && (c.val !== null || c.tag === 'est'); });
    M.invC = invC; M.invTotal = ovSumC(invC);
    cashC = cashC.filter(function (c) { return c && (c.val !== null || c.tag === 'est'); });
    var cashInfo = [];
    if (hasL) { cashInfo = [ovDocOrVirt('buffer.low'), ovDocOrVirt('buffer.high')]; }
    var cashV = ovSumC(cashC);
    M.heads.cash = ovHead('cash', cashC, { val: cashV, cls: 'amt-bal', notes: [], vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }],
      groups: [{ title: 'Accounts', comps: cashC }, cashInfo.length ? { title: 'Working buffer (your target)', comps: cashInfo, info: true } : null].filter(function (g) { return g; }),
      sub: cashC.length + (cashC.length === 1 ? ' account' : ' accounts') });
    // ---- Debt (Vault Debt first, Doc as fallback) ----
    var loanClaim = [], balC = [], payC = [];
    if (hasL) {
      OV_LOANS.forEach(function (sp) {
        var l = ovLoanFor(D, sp, loanClaim); if (l) loanClaim.push(l);
        balC.push(ovApplyLoan(ovDocComp(sp.ref + '.bal', sp.label), l, 'balance'));
        payC.push(ovApplyLoan(ovDocComp(sp.ref + '.pay', sp.label + ' \u00b7 payment'), l, 'payment'));
      });
    } else if (D) {
      D.loans.forEach(function (l) { balC.push(ovLoanComp(l, 'balance')); payC.push(ovLoanComp(l, 'payment')); });
    }
    balC = balC.filter(function (c) { return c && c.val !== null; }); payC = payC.filter(function (c) { return c && c.val !== null; });
    M.heads.debt = ovHead('debt', balC, { val: balC.length ? ovSumC(balC) : null, cls: 'ov-debt', gtitle: 'Loans', sub: balC.length + (balC.length === 1 ? ' loan' : ' loans'),
      vsecs: [{ label: 'Open Vault Debt', route: 'spend', vsec: 'debt' }] });
    if (M.heads.debt.tag === 'est' && M.heads.debt.val !== null) M.heads.debt.sub += ' \u00b7 includes a calculated balance';
    var ds = payC.length ? ovSumC(payC) : null, ds2 = null;
    if (ds !== null) {
      var nx = payC.filter(function (c) { return c.next != null; });
      if (nx.length) ds2 = ds - ovSumC(nx.map(function (c) { return { val: c.val }; })) + ovSumC(nx.map(function (c) { return { val: c.next }; }));
    }
    M.heads.ds = ovHead('ds', payC, { val: ds, cls: 'amt-out', gtitle: 'Monthly payments', sub: ds2 !== null ? 'after reset: ' + ovWhole(ds2) : '',
      notes: ds2 !== null ? ['After the Alliance reset the monthly total becomes ' + ovWhole(ds2) + '.'] : [], vsecs: [{ label: 'Open Vault Debt', route: 'spend', vsec: 'debt' }] });
    // ---- Income + burn (Vault logged data only) ----
    var scale = V && V.days > 0 ? ovDaysIn(V.off) / V.days : 1, incC = [], incNotes = [], incFlags = [], incVal = null;
    // Income is Vault-logged only: actual income logged so far in the month on screen. K-1 / W-2 are separate Incomplete rows (annual).
    if (V) {
      V.M.sources.forEach(function (s) {
        if (!s.amount) return;
        incC.push({ id: 'inc-' + s.name, label: s.label, val: r2(s.amount), tag: 'ver', vault: true,
          src: (s.name === INCOME_SOURCES[0] && !V.M.liveNote ? 'Live from Lisa\u2019s Table Orders (paid) \u00b7 ' : '') + 'Vault Income \u00b7 logged ' + (V.logged ? V.logged + ' day' + (V.logged === 1 ? '' : 's') + ' into the month' : 'this month'), go: incomeRoute(s.name), goLabel: 'Vault income' });
      });
      incVal = incC.length ? ovSumC(incC) : 0;
      if (V.M.liveNote) incNotes.push(V.M.liveNote);
      incNotes.push('Only income logged in the Vault is counted, month to date. The K-1 and W-2 amounts are listed below as Incomplete.');
    } else {
      incNotes.push('The live Vault income is not loaded yet.');
    }
    var annC = hasL ? [ovDocOrVirt('inc.k1'), ovDocOrVirt('inc.w2')] : [];
    M.heads.inc = ovHead('inc', incC, { val: incVal, cls: 'amt-in', fmt: 'money', gtitle: 'Income by source (logged)',
      groups: [{ title: 'Income by source (logged)', comps: incC }, annC.length ? { title: 'Annual income (K-1 and W-2)', comps: annC, info: true } : null].filter(function (g) { return g; }),
      notes: incNotes, flags: incFlags, sub: 'Vault logged, month to date', vsecs: [{ label: 'Open Vault income', route: incomeRoute('All') }] });
    var burnC = [], burnInfo = [], burnNotes = [], burnFlags = [], burnVal = null, hhDoc = hasL ? ovDocOrVirt('hh.burn') : null;
    var hhAcct = V ? V.M.accounts.filter(function (a) { return a.name === 'Household'; })[0] : null;
    if (V && V.reliable) {
      var bsrc = scale === 1 ? '' : ' over ' + V.days + ' days, scaled to the month';
      (hhAcct ? hhAcct.cats : []).forEach(function (c) {
        burnC.push({ id: 'b-' + c.name, label: c.name, val: r2(c.amount * scale), tag: 'ver', vault: true,
          src: 'Vault spend \u00b7 ' + money(c.amount) + ' logged' + bsrc, go: catRoute(c.name, 'Household'), goLabel: 'Vault spend' });
      });
      if (!burnC.length && V.hh) burnC.push({ id: 'b-hh', label: 'Household spend', val: r2(V.hh * scale), tag: 'ver', vault: true, src: 'Vault spend \u00b7 ' + money(V.hh) + ' logged' + bsrc, go: acctRoute('Household') });
      burnVal = V.burn;
      if (hhDoc && hhDoc.val !== null) {
        burnInfo.push({ id: 'dburn', label: 'Household burn (Overview Doc)', val: hhDoc.val, tag: hhDoc.tag, vault: false, src: hhDoc.src, ref: hhDoc.ref, docSrc: hhDoc.docSrc });
        if (burnVal !== null && Math.abs(burnVal - hhDoc.val) > 0.1 * Math.max(hhDoc.val, 1)) burnFlags.push({ label: 'Household burn / mo', vault: burnVal, doc: hhDoc.val, docTag: hhDoc.tag, ref: hhDoc.ref });
      }
    } else {
      if (hhDoc) { burnC.push(hhDoc); burnVal = hhDoc.val; }
      burnNotes.push(V ? 'Fewer than 14 days are logged in the Vault this month, so the Overview Doc household burn estimate is used and tagged Incomplete. Keep logging.' : 'The live Vault spend is not loaded yet.');
      if (V && V.hh) burnInfo.push({ id: 'vmtd', label: 'Vault Household spend so far', val: V.hh, tag: 'ver', vault: true, src: 'Vault spend \u00b7 ' + V.logged + ' days logged', go: acctRoute('Household') });
    }
    M.heads.burn = ovHead('burn', burnC, { val: burnVal, cls: 'amt-out', gtitle: V && V.reliable ? 'Household spend by category (logged)' : 'Household spend',
      groups: [{ title: V && V.reliable ? 'Household spend by category (logged)' : 'Household spend', comps: burnC }, burnInfo.length ? { title: V && V.reliable ? 'Overview Doc comparison (not counted)' : 'Logged so far (not a full month)', comps: burnInfo, info: true } : null].filter(function (g) { return g; }),
      notes: burnNotes, flags: burnFlags, sub: V && V.reliable ? 'Vault logged' : '', noneSub: V ? 'needs 14+ days logged (' + V.logged + ' so far) or a Doc estimate' : 'Vault not loaded', vsecs: [{ label: 'Open Household spend', route: acctRoute('Household') }] });
    // ---- Composite headlines ----
    var H = M.heads, hasDebtOrDoc = H.debt.val !== null;
    var assetsC = [];
    if (cashC.length) assetsC.push(ovAgg(H.cash, 'Cash (' + cashC.length + (cashC.length === 1 ? ' account' : ' accounts') + ')', 1));
    reC.concat(eqC).forEach(function (c) { if (c) assetsC.push(c); });
    var invTot = M.invTotal;
    var assetsAll = assetsC.concat(invC);
    var assets = ovSumC(assetsAll);
    var nwMiss = assetsAll.filter(function (c) { return c.tag === 'est'; });
    var nwPart = hasL && assets !== null && hasDebtOrDoc ? assets - H.debt.val : null;
    var nwVal = nwPart;   // v64: estimates are included (property values are Zac's last estimates); the net worth is tagged Incomplete
    var nwComps = assetsAll.concat(balC);
    M.heads.nw = ovHead('nw', nwComps, { val: nwVal, cls: nwVal !== null && nwVal < 0 ? 'amt-out' : 'amt-in', sub: '', noneSub: nwMiss.length ? 'needs ' + ovNwMissing(nwMiss) + ' figures' : 'needs the Vault balances',
      groups: [{ title: 'Assets', comps: assetsC },
        { title: 'Investments', comps: invC, total: invTot === null ? null : { label: 'Investments subtotal', val: invTot, cls: 'amt-bal' } },
        { title: '', comps: [], total: assets === null ? null : { label: 'Total assets (includes estimates)', val: assets, cls: 'amt-bal' } },
        { title: 'Debt', comps: balC, total: H.debt.val === null ? null : { label: 'Total debt', val: H.debt.val, cls: 'ov-debt' } }],
      notes: hasL ? ['Estimates are included and tagged Incomplete: the real estate and equipment values are Zac\u2019s last estimates, and some cash and investment figures are Doc estimates until statements arrive.', 'The two unused Bank of Stockton lines (commercial line, HELOC) are not in net worth.'] : ['Net worth needs the Overview Doc figures (real estate, equipment), which are not loaded.'],
      vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }, { label: 'Open Vault Debt', route: 'spend', vsec: 'debt' }] });
    M.heads.nw.cov = ovCov(assetsAll.concat(balC));
    if (M.heads.nw.tag === 'est') M.heads.nw.sub = 'includes estimates';
    var runVal = H.cash.val !== null && H.burn.val ? H.cash.val / H.burn.val : null, runRange = '';
    var bl = hasL ? ovN('buffer.low') : null, bh = hasL ? ovN('buffer.high') : null;
    if (runVal !== null && bl !== null && bh !== null) runRange = ovMo(Math.max(0, H.cash.val - bh) / H.burn.val) + ' \u2013 ' + ovMo(Math.max(0, H.cash.val - bl) / H.burn.val);
    var runC = [ovAgg(H.cash, 'Cash', 1), ovAgg(H.burn, 'Household burn / mo', 1)];
    M.heads.runway = ovHead('runway', runC, { val: runVal, fmt: 'mo', cls: '', sub: runRange ? 'above buffer: ' + runRange : '', noneSub: 'needs a household burn figure',
      notes: runRange ? ['Above the working buffer (high \u2013 low): ' + runRange + '.'] : [], vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }] });
    var flowVal = H.inc.val !== null && H.burn.val !== null && H.ds.val !== null ? H.inc.val - H.burn.val - H.ds.val : null;
    M.heads.flow = ovHead('flow', [ovAgg(H.inc, 'Income / mo', 1), ovAgg(H.burn, 'Household burn / mo', -1), ovAgg(H.ds, 'Debt service / mo', -1)], { val: flowVal, fmt: 'signed', noneSub: H.inc.val === null ? 'needs the Vault income' : 'needs a household burn figure',
      cls: flowVal !== null && flowVal < 0 ? 'amt-out' : 'amt-in', notes: ['Income is month to date from the Vault, so early in the month this reads low. Indicative. If the household burn already includes the Wetumka mortgage, or the Vault TiwiK/KiwiT accounts already include the loan payments, those are counted twice.'],
      vsecs: [{ label: 'Open Vault summary', route: 'spend', vsec: 'summary' }] });
    // flags shown per head are de-duplicated by label
    OV_ORDER.forEach(function (k) {
      var seen = {};
      M.heads[k].flags = M.heads[k].flags.filter(function (fl) { var id = fl.label + '|' + fl.doc + '|' + fl.vault; if (seen[id]) return false; seen[id] = 1; return true; });
    });
    return M;
  }
  function ovFmt(h, v) {
    if (v === null || v === undefined) return '\u2014';
    return h.fmt === 'mo' ? ovMo(v) : h.fmt === 'signed' ? signedMoney2(v) : ovWhole(v);
  }
  function ovCovChip(cov, small) {
    if (!cov || !cov.y) return '';
    var cls = cov.x === cov.y ? 'full' : cov.x ? 'part' : 'none', pct = Math.round(cov.x / cov.y * 100);
    return '<span class="ovcov ' + cls + (small ? ' sm' : '') + '" title="Components backed by live Vault data"><i style="width:' + pct + '%"></i><b>' + (small ? 'Vault ' + cov.x + '/' + cov.y : 'Vault-backed ' + cov.x + ' of ' + cov.y) + '</b></span>';
  }
  function ovSrcNotes(hasL) {
    var out = [], a = state.acct, d = state.debt, fb = hasL ? ' Doc figures are used.' : '', fa = hasL ? ' Cash is Incomplete until it loads.' : '';
    if (a && a.s === 'load' && !a.d) out.push('Loading Vault balances\u2026');
    else if (a && a.s === 'na') out.push('Vault Accounts is not available from the server yet.' + fa);
    else if (a && a.s === 'err' && !a.d) out.push('Vault Accounts could not load.' + fa);
    if (d && d.s === 'load' && !d.d) out.push('Loading Vault loans\u2026');
    else if (d && d.s === 'na') out.push('Vault Debt is not available from the server yet.' + fb);
    else if (d && d.s === 'err' && !d.d) out.push('Vault Debt could not load.' + fb);
    return out;
  }
  function ovTile(h) {
    var m = OV_HEADS[h.key], none = h.val === null;
    var sub = none ? (h.noneSub || 'not available yet') : h.sub;
    return '<div class="fxsum ovsum ovt ' + (none ? 'none' : '') + '" role="button" tabindex="0" data-go="fin/overview/' + h.key + '"><div class="fxl">' + esc(m.tile) + (h.flags.length ? ' <span class="ovwarn" title="Doc and Vault differ">!</span>' : '') + '</div>' +
      '<div class="fxv ' + esc(h.cls) + '">' + esc(ovFmt(h, h.val)) + '</div>' +
      (sub ? '<div class="fxs">' + esc(sub) + '</div>' : '') +
      '<div class="ovtm">' + ovTagBadge(none ? 'est' : h.tag, '').replace(/<span class="badge/, '<span class="badge sm') + (none ? '' : ' ' + ovCovChip(h.cov, true)) + '</div></div>';
  }
  function ovStripHtml(M) {
    var h = '<div class="fxgrid ovstrip">' + OV_ORDER.map(function (k) { return ovTile(M.heads[k]); }).join('') + '</div>';
    var n = ovSrcNotes(M.hasL);
    if (n.length) h += '<div class="ovnote ovsrcnote">' + n.map(esc).join(' ') + '</div>';
    return h;
  }
  function ovMonthName(off) {
    var t = new Date(), d = new Date(t.getFullYear(), t.getMonth() + (Number(off) || 0), 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  // Vault Summary block (same values / colors / routes as the Vault's Summary; month-aware, live from the `spend` action)
  function ovSummaryHtml(V) {
    var st = ov.sp, off = state.monthOffset, label = st.data && st.data.monthLabel || ovMonthName(off);
    var h = '<div class="card ovvs"><div class="ovvsh"><button class="navbtn" data-ov-month="-1" aria-label="Previous month">&lsaquo;</button>' +
      '<button class="ovvst" data-go="spend"><b>Vault summary</b><span>' + esc(label) + ' &rsaquo;</span></button>' +
      '<button class="navbtn" data-ov-month="1" aria-label="Next month">&rsaquo;</button></div>';
    if (st.s === 'load') return h + '<div class="foot">Loading the Vault\u2026</div></div>';
    if (st.s === 'err' || !V) return h + '<div class="foot">The Vault could not load. <button class="navbtn" data-ov-retry>Try again</button></div></div>';
    var M = V.M, days = V.days, perDay = function (v) { return days > 0 ? money(v / days) : '\u2014'; }, net = r2(M.incomeTotal - M.total);
    function c(cls, route, name, amtCls, amt) {
      return '<button class="ovvc ' + cls + '"' + goAttr(route) + '><small>' + name + '</small><span class="amt ' + amtCls + '">' + amt + '</span></button>';
    }
    h += '<div class="ovvsg">' +
      c('', incomeRoute('All'), 'Total income', 'amt-in', money(M.incomeTotal)) +
      c('', 'spend/all', 'Total spend', 'amt-out', money(M.total)) +
      c('', calcRoute('avg-income'), 'Avg daily income', 'amt-in', perDay(M.incomeTotal)) +
      c('', calcRoute('avg-spend'), 'Avg daily spend', 'amt-out', perDay(M.total)) +
      c('net', calcRoute('month-net'), 'Net income', net >= 0 ? 'pos' : 'neg', signedMoney(net)) + '</div>' +
      '<div class="foot">' + (days > 0 ? 'Over ' + days + ' day' + (days === 1 ? '' : 's') : 'No days yet') + ' \u00b7 tap a number to open it in the Vault</div></div>';
    return h;
  }
  // ---- Detail view ----
  function ovFlagHtml(fl) {
    var diff = fl.vault - fl.doc;
    return '<div class="ovflag"><b>' + esc(fl.label) + '</b> Overview Doc says ' + ovWhole(fl.doc) + ' (' + (fl.docTag === 'ver' ? 'Verified' : 'Incomplete') + '); live Vault says ' + ovWhole(fl.vault) +
      ' (' + signedMoney2(diff) + '). The Vault number is used.</div>';
  }
  function ovCompRow(c) {
    var left = '<span>' + esc(c.label) + '</span>', meta = [];
    if (c.agg) meta.push(ovTagBadge(c.tag, '') + ' ' + ovCovChip(c.cov, true));
    else {
      meta.push(ovTagBadge(c.tag, c.ref || ''));
      var src = c.src || '';
      if (!c.vault && c.docSrc) src = '<a class="srcnum ovsrc" data-title="' + esc(c.docSrc) + '" href="' + esc(ovUrl(c.docSrc)) + '">' + esc(c.docSrc) + '</a>'; else src = esc(src);
      if (c.url) src = '<a class="srcnum ovsrc" data-title="' + esc(c.src) + '" href="' + esc(c.url) + '">' + esc(c.src) + '</a>';
      meta.push(src);
      if (c.vault) meta.push('<span class="ovvtag">Vault</span>');
      if (c.asOf) meta.push('as of ' + esc(acDate(c.asOf)));
      if (c.asOfText) meta.push(esc(c.asOfText));
    }
    var sign = c.agg && c.val !== null && c.val < 0 ? '\u2212' : '';
    var amt = c.val === null ? '\u2014' : c.fmt === 'mo' ? ovMo(c.val) : (c.agg && c.fmt === 'money' ? sign + ovWhole(Math.abs(c.val)) : ovWhole(c.val));
    var cls = c.cls || '';
    var vs = c.vsec ? ' data-ov-vsec="' + esc(c.vsec) + '"' : '';
    var valHtml = '<span class="' + esc(cls) + '">' + esc(amt) + '</span>';
    var go = c.go ? goAttr(c.go) + vs : '';
    var inner = '<div class="ovl">' + left + '<small>' + meta.join(' \u00b7 ') + '</small></div><div class="ovv">' + valHtml + (c.go ? ' <i class="chev">&rsaquo;</i>' : '') + '</div>';
    var h = c.go ? '<div class="ovrow ovdr" role="button" tabindex="0"' + go + '>' + inner + '</div>' : '<div class="ovrow">' + inner + '</div>';
    if (c.mismatch) h += ovFlagHtml({ label: c.label, vault: c.mismatch.vault, doc: c.mismatch.doc, docTag: c.mismatch.docTag });
    if (c.note) h += '<div class="ovnote">' + esc(c.note) + '</div>';
    if (c.tag === 'est' && c.ref) h += ovNeedBox([c.ref]);
    return h;
  }
  function ovDetailHtml(key) {
    var f = ov.fin, M, H, m = OV_HEADS[key], h = '';
    if (f.s === 'load' && !f.data && !state.acct) return '<div class="loading">Loading\u2026</div>';
    M = ovModel(); H = M.heads[key];
    if (!H) return '<div class="error">Unknown figure.</div>';
    var cls = H.cls || '';
    h += '<div class="card ovhd"><div class="ovhl">' + esc(m.title) + '</div><div class="ovhv ' + esc(cls) + '">' + esc(ovFmt(H, H.val)) + '</div>';
    var hb = H.tag === 'est' || H.val === null ? ovEstBtn(H.needRefs) || ovTagBadge('est', '') : ovTagBadge(H.tag, '');
    if (H.val === null) h += '<div class="ovnote">Not available yet. ' + (H.noneSub ? esc(H.noneSub.charAt(0).toUpperCase() + H.noneSub.slice(1)) + '.' : 'The sources it needs have not loaded or are missing.') + '</div><div class="ovhm">' + hb + '</div>' + ovNeedBox(H.needRefs);
    else h += '<div class="ovhm">' + hb + ' ' + ovCovChip(H.cov, false) + '</div>' + (H.tag === 'est' ? ovNeedBox(H.needRefs) : '');
    h += '<div class="ovnote">' + esc(H.calc) + (H.asOf ? ' \u00b7 Vault data as of ' + esc(H.asOf[0] === H.asOf[1] ? acDate(H.asOf[0]) : acDate(H.asOf[0]) + ' \u2013 ' + acDate(H.asOf[1])) : '') + '</div>';
    if (H.tag === 'est' && H.val !== null) h += '<div class="ovnote">Estimates are included in this figure. It is marked Incomplete because information is missing for at least one component. Tap Incomplete to see what is needed.</div>';
    h += '</div>';
    var sn = ovSrcNotes(M.hasL);
    if (sn.length) h += '<div class="fxnote"><b>Sources</b> ' + sn.map(esc).join(' ') + '</div>';
    var topFlags = H.flags.filter(function (fl) { return !fl.inline; });   // row-level mismatches are shown on their own row
    if (topFlags.length) h += '<div class="card ovflags"><h4 class="sechead">Doc vs Vault</h4>' + topFlags.map(ovFlagHtml).join('') + '</div>';
    H.groups.forEach(function (g) {
      if (!g.comps.length && !g.total) return;
      h += '<div class="card ovgrp' + (g.info ? ' info' : '') + '">' + (g.title ? '<h4 class="sechead">' + esc(g.title) + '</h4>' : '') + g.comps.map(ovCompRow).join('');
      if (g.total) h += '<div class="ovrow calc"><div class="ovl"><span>' + esc(g.total.label) + '</span></div><div class="ovv"><span class="' + esc(g.total.cls || '') + '">' + ovWhole(g.total.val) + '</span></div></div>';
      h += '</div>';
    });
    if (!H.comps.length && H.val === null) h += '<div class="foot">No components to show yet.</div>';
    H.notes.forEach(function (n) { h += '<div class="ovnote">' + esc(n) + '</div>'; });
    h += '<div class="ovlinks">';
    H.vsecs.forEach(function (v) { h += '<button class="bigbtn ovlink"' + goAttr(v.route) + (v.vsec ? ' data-ov-vsec="' + esc(v.vsec) + '"' : '') + '>' + esc(v.label) + ' &rsaquo;</button>'; });
    var led = { nw: 'ovnw', debt: 'ovliab', cash: 'ovcashc', ds: 'ovdebt', inc: 'ovdebt', burn: 'ovcashc', runway: 'ovcashc', flow: 'ovflow' }[key];
    if (M.hasL) h += '<button class="bigbtn ovlink alt" data-ov-ledger="' + led + '">Full Doc ledger &rsaquo;</button>';
    h += '</div>';
    return h;
  }

  function ovHtml() {
    var h = '', V = ovVault(), f = ov.fin;
    var ok = f.s === 'ok' && f.data && Array.isArray(f.data.ledger) && f.data.ledger.length;
    if (ok) ovIndex(f.data);
    if (f.s === 'load' && !f.data) {
      h += '<div class="loading">Loading the document figures\u2026</div>';
    } else if (f.s === 'err' && !f.data) {
      h += '<div class="error">' + esc(friendly(f.err)) + '<div class="retry"><button class="navbtn" data-ov-retry>Try again</button></div></div>';
    } else if (f.s === 'na') {
      h += '<div class="fxnote"><b>Server update pending</b> The document figures (loans, assets, net worth) arrive after the Command Center server update. The live Vault numbers below already work.</div>';
    } else if (!ok && f.data) {
      h += '<div class="fxnote"><b>Server update pending</b> This is the older Overview layout. Verified loan figures, runway and debt-service coverage appear after the Command Center server update.</div>' + overviewHtml(f.data);
    }
    var d = ok ? f.data : null, C = null, D = null, NW = null;
    var loadingL = f.s === 'load' && !f.data;
    var MD = loadingL ? null : ovModel();
    if (MD) h += ovStripHtml(MD);
    h += ovSummaryHtml(V);
    if (ok) {
      C = ovCashCard(V, MD); D = ovDebtCard(V, C); NW = ovNetWorth(MD);
      h += todoCards(ovTodoFilter(d.todo || []), 'ov');
    }
    h += collCard('ovlive', 'Live Vault \u00b7 income & spend', null, ovVaultCard(V), true);
    if (ok) {
      h += collCard('ovcashc', 'Cash & runway', null, C.html, false);
      h += collCard('ovdebt', 'Debt service vs income', null, D.html, false);
      h += collCard('ovliab', 'Liabilities', 3, ovLoan('Wetumka \u00b7 Rocket Mortgage', ['wet.bal', 'wet.rate', 'wet.pay', 'wet.pi', 'wet.escrow', 'wet.due', 'wet.maturity'], 'ovl-wet', false) +
        ovLoan('Mono Way \u00b7 Bank of Stockton (KiwiT)', ['mono.bal', 'mono.orig', 'mono.rate', 'mono.pay', 'mono.maturity'], 'ovl-mono', false) +
        ovLoan('Equipment \u00b7 Alliance (TiwiK)', ['all.bal', 'all.rate', 'all.pay', 'all.pay2', 'all.maturity', 'all.payoff'], 'ovl-all', false), false);
      h += collCard('ovinv', 'Investments', null, ovInvCard(MD), false);
      h += collCard('ovnw', 'Assets & net worth', null, NW.html, false);
      h += collCard('ovflow', 'Property & business cash flow', null, ovFlowCard(), false);
      var ins = (d.ledger || []).filter(function (r) { return /^ins\./.test(r.ref); });
      if (ins.length) h += collCard('ovins', 'Insurance premiums', ins.length, ins.map(function (r) { return ovRow(r.ref, ovLabel(r)); }).join(''), false);
      h += ovNeedsCard() + doneCard(d.done, 'ov') + docLink(d) + updatedLine(d);
    } else if (f.data && f.s !== 'na' && !ok) {
      h += docLink(f.data) + updatedLine(f.data);
    }
    return h;
  }
  function renderOv() {
    if (state.finKind !== 'overview') return;
    $('fin-body').innerHTML = state.ovKey ? ovDetailHtml(state.ovKey) : ovHtml();
  }
  function ovFetchFin(force) {
    var c = fin.cache.overview;
    if (c) { ov.fin = { s: 'ok', data: c.data }; }
    else ov.fin = { s: 'load' };
    if (c && !force && Date.now() - c.at < FIN_TTL) return;
    finApi('overview', true, function (err, data) {
      if (state.finKind !== 'overview') return;
      if (!err) ov.fin = { s: 'ok', data: data };
      else if (err.na) ov.fin = { s: 'na' };
      else if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      else if (!ov.fin.data) ov.fin = { s: 'err', err: err };
      renderOv();
    });
  }
  function ovFetchSpend(force) {
    var off = state.monthOffset, c = ov.cache[off];
    if (c) ov.sp = { s: 'ok', data: c.data };
    else ov.sp = { s: 'load' };
    if (c && !force && Date.now() - c.at < FIN_TTL) return;
    var seq = ++ov.seq;
    api('spend', off).then(function (data) {
      ov.cache[off] = { data: data, at: Date.now() };
      if (seq !== ov.seq || state.monthOffset !== off) return;
      ov.sp = { s: 'ok', data: data };
      if (state.finKind === 'overview') renderOv();
    }, function (err) {
      if (seq !== ov.seq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      if (ov.sp.s === 'ok') return;
      ov.sp = { s: 'err', err: err };
      if (state.finKind === 'overview') renderOv();
    });
  }
  function loadOv(force) {
    ordLiveFetch(!!force);
    ovFetchFin(!!force); ovFetchSpend(!!force); loadAccounts(!!force); loadDebt(!!force); renderOv();
  }
  function ovClick(e) {
    var est = e.target.closest('[data-ov-est]');
    if (est) {
      var key = est.getAttribute('data-ov-est'), boxes = $('fin-body').querySelectorAll('[data-ov-need]'), open;
      for (var i = 0; i < boxes.length; i++) if (boxes[i].getAttribute('data-ov-need') === key) { open = boxes[i].hidden; boxes[i].hidden = !open; }
      ov.estOpen[key] = !!open;
      return true;
    }
    var mo = e.target.closest('[data-ov-month]');
    if (mo) { state.monthOffset += Number(mo.getAttribute('data-ov-month')) || 0; ovFetchSpend(false); renderOv(); return true; }
    var vs = e.target.closest('[data-ov-vsec]');
    if (vs) { vOpenMap()[vs.getAttribute('data-ov-vsec')] = true; return false; }   // open that Vault section, then the data-go navigates
    var lg = e.target.closest('[data-ov-ledger]');
    if (lg) { fin.open[lg.getAttribute('data-ov-ledger')] = true; e.preventDefault(); e.stopPropagation(); show('fin/overview'); return true; }
    if (e.target.closest('[data-ov-retry]')) { loadOv(true); return true; }
    var op = e.target.closest('[data-ov-open]');
    if (op) {
      var k = op.getAttribute('data-ov-open');
      if (!k) return true;
      fin.open[k] = true;
      var card = $('fin-body').querySelector('[data-nc="' + k + '"]');
      if (card) { card.classList.add('open'); var hb = card.querySelector('.nchead'); if (hb) hb.setAttribute('aria-expanded', 'true'); card.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      return true;
    }
    return false;
  }
  // ---- Ledger (v87): the first-tier Finances page. Live data only; nothing financial is stored in this file or in the public repo. ----
  // Built entirely from data the app already reads: `accounts` (state.acct), `vaultdebt` (state.debt), `spend` (this month), the Overview document
  // model (ovModel / ovNetWorth) and the Insurance notes page. Every number taps through to its source (Vault, Debts and Bills, entity screens).
  // Sierra Consultants is kept out of the day-to-day finance tracking, so any account, loan, bill or policy that names it is dropped here.
  // Account kind: bank (default) | card (credit card: the balance is the AMOUNT OWED, it is subtracted from the totals, paying it is a transfer, not spending)
  // | app (payment app such as Zelle / Venmo: counted like cash). The kind comes from the accounts data (kind / accountKind / accountType) when the server
  // sends one, otherwise it is inferred from the account type / name text, and defaults to bank.
  var LED_KEY = 'cc_ledger_open', ledMem = null;
  var LED_DEFAULT = { cash: true, flow: true, soon: true, debt: false, nw: false, ins: false, tax: false, goals: false };
  var LED_ENTS = ['Household', 'TiwiK', 'KiwiT'];
  var LED_KINDS = { bank: 'Bank', card: 'Credit card', app: 'Payment app' };
  var led = { sp: { s: 'load', d: null, at: 0 }, ins: { s: 'load', d: null }, seq: 0, acOpen: {} };
  function ledMap() {
    if (!ledMem) { try { ledMem = JSON.parse(localStorage.getItem(LED_KEY) || '{}') || {}; } catch (e) { ledMem = {}; } }
    return ledMem;
  }
  function ledIsOpen(key) { var m = ledMap(); return m[key] === undefined ? !!LED_DEFAULT[key] : !!m[key]; }
  function ledActive() { return state.finKind === 'ledger' && $('screen-fin').classList.contains('active'); }
  function ledSierra() { return Array.prototype.slice.call(arguments).some(function (s) { return /sierra/i.test(String(s || '')); }); }
  function ledKind(a) {
    var k = String(a.kind || '').toLowerCase();
    if (k === 'bank' || k === 'card' || k === 'app') return k;
    var t = k + ' ' + String(a.type || '') + ' ' + String(a.name || '') + ' ' + String(a.bank || '');
    if (/credit\s*card|\bcard\b|\bvisa\b|master\s*card|\bamex\b|american express|\bdiscover\b/i.test(t)) return 'card';
    if (/payment app|\bzelle\b|\bvenmo\b|paypal|cash\s*app|apple cash/i.test(t)) return 'app';
    return 'bank';
  }
  function ledCard(key, title, tot, body) {
    var col = !ledIsOpen(key);
    return '<div class="vgcard ledc led-' + key + (col ? ' collapsed' : '') + '" data-led="' + key + '"><div class="vghead">' +
      '<h2 class="vgrp led" role="button" tabindex="0" aria-expanded="' + !col + '"><span class="vgt">' + esc(title) + '</span><i class="vgchev" aria-hidden="true">&rsaquo;</i></h2></div>' +
      '<div class="vgtot led">' + tot + '</div><div class="vgbody">' + body + '</div></div>';
  }
  function ledTot(label, valHtml, route, vsec) {
    return '<button class="ledtot"' + (route ? goAttr(route) : '') + (vsec ? ' data-ov-vsec="' + vsec + '"' : '') + '><span>' + label + '</span><b>' + valHtml + '</b></button>';
  }
  function ledLine(label, valHtml, route, vsec, cls) {
    return '<button class="ledline ' + (cls || '') + '"' + goAttr(route) + (vsec ? ' data-ov-vsec="' + vsec + '"' : '') + '><span>' + label + '</span><b>' + valHtml + '</b><i class="chev">&rsaquo;</i></button>';
  }
  function ledNote(t) { return '<div class="foot ledfoot">' + t + '</div>'; }
  function ledState(msg, retry) { return '<div class="foot ledfoot">' + esc(msg) + '</div>' + (retry ? '<button class="linkrow smallrow" data-led-retry="1">Try again</button>' : ''); }
  function ledEntChip(ent) {
    var key = String(ent || '').toLowerCase();
    return ENTS[key] ? '<button class="ledchip ent" data-go="ent/' + key + '">' + esc(ent) + '</button>' : '<span class="ledchip ent">' + esc(ent || 'Household') + '</span>';
  }
  function ledMoney(n, kind) { return kind === 'card' ? money(Math.abs(n)) : balMoney(n); }

  // ---- 1. Cash position ----
  function ledCashModel(A) {
    var by = {}, order = [];
    LED_ENTS.forEach(function (k) { by[k] = { name: k, rows: [], cash: 0, owed: 0, n: 0 }; order.push(k); });
    A.accounts.forEach(function (a) {
      if (ledSierra(a.name, a.bank, a.group, a.type, a.purpose)) return;
      var k = a.group || 'Household';
      if (!by[k]) { by[k] = { name: k, rows: [], cash: 0, owed: 0, n: 0 }; order.push(k); }
      var e = by[k], kind = ledKind(a);
      e.rows.push({ a: a, kind: kind });
      if (a.balance != null) { if (kind === 'card') e.owed += Math.abs(a.balance); else e.cash += a.balance; e.n++; }
    });
    var tot = { cash: 0, owed: 0, n: 0, cards: 0 };
    order.forEach(function (k) {
      var e = by[k]; e.net = r2(e.cash - e.owed); e.cash = r2(e.cash); e.owed = r2(e.owed);
      e.hasCard = e.rows.some(function (x) { return x.kind === 'card'; });
      tot.cash += e.cash; tot.owed += e.owed; tot.n += e.n; if (e.hasCard) tot.cards++;
    });
    tot.cash = r2(tot.cash); tot.owed = r2(tot.owed); tot.net = r2(tot.cash - tot.owed);
    return { by: by, order: order, tot: tot };
  }
  function ledAcctRow(x) {
    var a = x.a, kind = x.kind, key = 'ac:' + a.name, open = !!led.acOpen[key], owed = kind === 'card';
    var bal = a.balance == null ? '<span class="acnone ledbal">No balance yet</span>'
      : '<button class="ledbal ' + (owed ? 'amt-out' : 'amt-bal') + '"' + goAttr(balRoute(a.name)) + ' data-ov-vsec="accounts">' + ledMoney(a.balance, kind) + (owed ? '<small>owed</small>' : '') + '</button>';
    var flag = a.asOf && !acMonthEnd(a.asOf) && kind === 'bank' ? ' <span class="acflag">not month end</span>' : '';
    var sub = [a.bank, a.type].filter(Boolean).join(' \u00b7 ');
    var h = '<div class="ledacct' + (open ? ' open' : '') + '" data-ledac="' + esc(key) + '"><div class="ledah">' +
      '<button class="ledat" aria-expanded="' + open + '"><span class="ledan">' + esc(a.name) + '</span>' +
      '<span class="ledam"><span class="ledchip kind ' + kind + '">' + esc(LED_KINDS[kind]) + '</span>' + (a.asOf ? 'As of ' + esc(acDate(a.asOf)) : 'No date') + flag + '</span></button>' +
      bal + '<button class="ledchevb" aria-label="Show or hide details"><i class="chev">&rsaquo;</i></button></div>';
    h += '<div class="ledab"><div class="ledrowm">' + ledEntChip(a.group) + (sub ? '<span class="ledsub">' + esc(sub) + '</span>' : '') + '</div>';
    if (a.purpose) h += '<div class="ledtxt">' + esc(a.purpose) + '</div>';
    var ents = (a.entries || []).slice().sort(function (p, q) { return p.date < q.date ? 1 : p.date > q.date ? -1 : 0; }).slice(0, 6);
    if (ents.length) {
      h += '<div class="ledent"><b class="ledeh">Recent entries</b>' + ents.map(function (en) {
        return '<div class="lede"><span class="led-d">' + esc(acDate(en.date)) + '</span><span class="led-b ' + (owed ? 'amt-out' : 'amt-bal') + '">' + ledMoney(en.balance, kind) + '</span>' +
          (en.notes ? '<small>' + esc(en.notes) + '</small>' : '') + '</div>';
      }).join('') + '</div>';
    } else if (a.notes) h += '<div class="ledtxt">' + esc(a.notes) + '</div>';
    h += '<button class="linkrow smallrow"' + goAttr(balRoute(a.name)) + ' data-ov-vsec="accounts">Balance history in the Vault &rsaquo;</button></div></div>';
    return h;
  }
  function ledCashCard() {
    var st = state.acct || { s: 'load' }, A = st.d, body, tot;
    if (!A) {
      var msg = st.s === 'na' ? 'Accounts are not available yet (server update pending).' : st.s === 'err' ? 'Could not load accounts' + (st.msg ? ': ' + st.msg : '') + '.' : 'Loading accounts\u2026';
      return ledCard('cash', 'Cash position', ledTot('Total cash', '<span class="amt-bal">' + (st.s === 'load' ? '\u2026' : '\u2014') + '</span>', ''), ledState(msg, st.s === 'err'));
    }
    var C = ledCashModel(A), anyCard = C.tot.cards > 0;
    tot = ledTot(anyCard ? 'Net cash (cards owed subtracted)' : 'Total cash', '<span class="amt-bal">' + balMoney(C.tot.net) + '</span>', balRoute('All'), 'accounts');
    body = '<div class="ledgrp"><div class="ledgh">Totals by entity</div>';
    C.order.forEach(function (k) {
      var e = C.by[k];
      if (!e.rows.length && LED_ENTS.indexOf(k) < 0) return;
      body += ledLine(esc(k) + '<small>' + e.rows.length + ' account' + (e.rows.length === 1 ? '' : 's') + (e.owed ? ' \u00b7 cards owed ' + money(e.owed) : '') + '</small>',
        e.rows.length ? '<span class="amt-bal">' + balMoney(e.net) + '</span>' : '<span class="muted">\u2014</span>', balRoute('g:' + k), 'accounts');
    });
    body += ledLine('<b>Grand total</b>' + (anyCard ? '<small>cards owed ' + money(C.tot.owed) + ' subtracted</small>' : ''), '<span class="amt-bal">' + balMoney(C.tot.net) + '</span>', balRoute('All'), 'accounts', 'grand') + '</div>';
    C.order.forEach(function (k) {
      var e = C.by[k];
      if (!e.rows.length) return;
      body += '<div class="ledgrp"><div class="ledgh">' + esc(k) + '<small>' + e.rows.length + ' account' + (e.rows.length === 1 ? '' : 's') + '</small></div>' + e.rows.map(ledAcctRow).join('') + '</div>';
    });
    if (!A.accounts.length) body += ledNote('No accounts found on the Accounts tab.');
    if (anyCard) body += ledNote('Credit cards show the amount owed. Paying a card is a transfer between accounts, not spending.');
    body += ledNote('Last entered balances' + (A.accounts.some(function (a) { return a.asOf && !acMonthEnd(a.asOf); }) ? ' (some are not month end; the month-end statement is pending)' : '') + '. Tap a number to open it in the Vault.');
    body += '<button class="linkrow smallrow" data-go="spend" data-ov-vsec="accounts">Open Vault Accounts &rsaquo;</button>';
    return ledCard('cash', 'Cash position', tot, body);
  }

  // ---- 2. Cash flow this month (same numbers as the Vault Summary: income logged, spend logged, net) ----
  function ledFlowCard() {
    var s = led.sp, d = s.d;
    if (!d) return ledCard('flow', 'Cash flow this month', ledTot('Net this month', '<span class="amt-bal">' + (s.s === 'load' ? '\u2026' : '\u2014') + '</span>', ''),
      ledState(s.s === 'err' ? 'The Vault could not load' + (s.err ? ': ' + friendly(s.err) : '') + '.' : 'Loading the Vault\u2026', s.s === 'err'));
    var M = spendModel(d), net = r2(M.incomeTotal - M.total), cls = net >= 0 ? 'amt-in' : 'amt-out', days = d.daysLogged != null ? Number(d.daysLogged) : 0;
    var tot = ledTot('Net this month', '<span class="' + cls + '">' + signedMoney(net) + '</span>', calcRoute('month-net'));
    var b = '<div class="ledmonth">' + esc(d.monthLabel || 'This month') + '</div>';
    b += ledLine('Income', '<span class="amt-in">' + money(M.incomeTotal) + '</span>', incomeRoute('All'));
    b += ledLine('Expenses', '<span class="amt-out">' + money(M.total) + '</span>', 'spend/all');
    b += ledLine('<b>Net</b><small>income \u2212 expenses</small>', '<span class="' + cls + '">' + signedMoney(net) + '</span>', calcRoute('month-net'), '', 'grand');
    var src = M.sources.filter(function (x) { return x.amount && !ledSierra(x.name, x.label); });
    if (src.length) b += '<div class="ledgrp"><div class="ledgh">Income by source</div>' + src.map(function (x) { return ledLine(esc(x.label), '<span class="amt-in">' + money(x.amount) + '</span>', incomeRoute(x.name)); }).join('') + '</div>';
    var acc = M.accounts.filter(function (x) { return x.amount && !ledSierra(x.name); });
    if (acc.length) b += '<div class="ledgrp"><div class="ledgh">Expenses by entity</div>' + acc.map(function (x) { return ledLine(esc(x.name), '<span class="amt-out">' + money(x.amount) + '</span>', acctRoute(x.name)); }).join('') + '</div>';
    if (M.liveNote) b += ledNote(esc(M.liveNote));
    else if (M.liveCount) b += ledNote('Lisa\u2019s Table income is live from Orders (paid only).');
    b += ledNote((days > 0 ? days + ' day' + (days === 1 ? '' : 's') + ' logged this month' : 'No days logged yet') + '. Same numbers as the Vault Summary. Tap a number to open it in the Vault.');
    b += '<button class="linkrow smallrow" data-go="spend" data-ov-vsec="summary">Open the Vault &rsaquo;</button>';
    return ledCard('flow', 'Cash flow this month', tot, b);
  }

  // ---- 3. Coming up (next 30 days): loan payments + bills from the Debts and Bills tabs. Property taxes are never shown (Mono Way is paid, Stewart Street is NNN paid
  //         by the tenant, Wetumka is inside the mortgage impound) and TiwiK never pays rent to KiwiT. ----
  function ledBillOk(b) {
    var txt = [b.name, b.kindLabel, b.kind].join(' ');
    if (b.kind === 'tax' || /property\s*tax|\btax(es)?\b/i.test(txt)) return false;
    if (/\brent\b/i.test(txt) && /tiwik/i.test(b.entity)) return false;
    return !ledSierra(b.name, b.entity, b.kindLabel);
  }
  function ledRoutes(D, view, arg) { return dbSheet(D) ? dbRoute(view, arg) : 'spend'; }
  function ledDebtState(title, key) {
    var st = state.debt || { s: 'load' };
    var msg = st.s === 'na' ? 'Not available yet (server update pending). Debts and bills are in Finances \u203a Overview.' : st.s === 'err' ? 'Could not load' + (st.msg ? ': ' + st.msg : '') + '.' : 'Loading\u2026';
    return ledCard(key, title, ledTot(key === 'soon' ? 'Total due' : 'Total debt', '<span class="amt-neutral">' + (st.s === 'load' ? '\u2026' : '\u2014') + '</span>', ''), ledState(msg, st.s === 'err'));
  }
  function ledSoonCard() {
    var st = state.debt || { s: 'load' }, D = st.d, title = 'Coming up (next 30 days)';
    if (!D) return ledDebtState(title, 'soon');
    var list = D.bills.filter(function (b) { return ledBillOk(b) && (b.overdue || b.daysUntil == null || b.daysUntil <= D.windowDays); });
    var total = r2(list.filter(function (b) { return !b.viaEscrow && b.amount != null; }).reduce(function (s, b) { return s + b.amount; }, 0));
    var tot = ledTot('Total due \u00b7 ' + list.length + ' item' + (list.length === 1 ? '' : 's'), '<span class="amt-gold">' + money(total) + '</span>', ledRoutes(D, 'bills'), dbSheet(D) ? '' : 'bills');
    var b = '';
    if (!list.length) b += '<div class="foot empty ledfoot">Nothing due in the next ' + D.windowDays + ' days.</div>';
    list.forEach(function (x) {
      var amt = x.amount == null ? '<span class="muted">n/a</span>' : '<button class="ledbal ' + (x.viaEscrow ? 'amt-neutral' : 'amt-gold') + '"' + goAttr(ledRoutes(D, 'bill', x.id)) + '>' + money(x.amount) + (x.viaEscrow ? '<small>via escrow</small>' : '') + '</button>';
      b += '<div class="ledbill' + (x.overdue ? ' overdue' : '') + '"><div class="ledbd"><b>' + esc(dbDate(x.date, true).replace(/^(\w+), /, '$1 ')) + '</b><small>' + esc(x.overdue ? 'overdue' : dbIn(x.daysUntil)) + '</small></div>' +
        '<div class="ledbm"><span class="ledan">' + esc(x.name) + '</span><span class="ledam">' + ledEntChip(x.entity) + esc([x.kindLabel, x.repeat && x.repeat !== 'One-time' ? x.repeat : ''].filter(Boolean).join(' \u00b7 ')) + ' ' + dbStatic(x.status) + '</span></div>' + amt + '</div>';
    });
    if (list.length) b += ledLine('<b>Total due</b><small>' + (D.windowEnd ? 'through ' + esc(dbDate(D.windowEnd)) + ', ' : '') + 'escrow items not counted</small>', '<span class="amt-gold">' + money(total) + '</span>', ledRoutes(D, 'bills'), dbSheet(D) ? '' : 'bills', 'grand');
    b += ledNote('Loan payments and bills from the Debts and Bills tabs. Property taxes are not listed here.');
    b += '<button class="linkrow smallrow" data-go="spend" data-ov-vsec="bills">Open Vault Upcoming bills &rsaquo;</button>';
    return ledCard('soon', title, tot, b);
  }

  // ---- 4. Debts ----
  function ledDebtCard() {
    var st = state.debt || { s: 'load' }, D = st.d, title = 'Debts';
    if (!D) return ledDebtState(title, 'debt');
    var loans = D.loans.filter(function (l) { return !ledSierra(l.name, l.entity, l.lender); });
    var cut = loans.length !== D.loans.length;
    var tDebt = cut ? r2(loans.reduce(function (s, l) { return s + (l.balance || 0); }, 0)) : D.totalDebt;
    var tMo = cut ? r2(loans.reduce(function (s, l) { return s + (l.payment || 0); }, 0)) : D.totalMonthly;
    var tot = ledTot('Total debt', '<span class="amt-neutral">' + balMoney(tDebt) + '</span>', ledRoutes(D, 'total'), dbSheet(D) ? '' : 'debt');
    var b = '';
    if (!loans.length) b += ledNote('No loans on the Debts tab yet.');
    loans.forEach(function (l) {
      var lr = ledRoutes(D, 'loan', l.key), vs = dbSheet(D) ? '' : ' data-ov-vsec="debt"';
      b += '<div class="ledloan"><div class="ledlt"><div class="ledan">' + esc(l.name) + '</div><div class="ledam">' + ledEntChip(l.entity) + esc(l.lender || '') + ' ' + dbStatic(l.status) + '</div></div>' +
        '<button class="ledline"' + goAttr(lr) + vs + '><span>Balance' + (l.asOf ? '<small>as of ' + esc(dbDate(l.asOf)) + '</small>' : '') + '</span><b class="amt-neutral">' + (l.balance == null ? '\u2014' : balMoney(l.balance)) + '</b><i class="chev">&rsaquo;</i></button>' +
        (l.payment != null ? '<button class="ledline"' + goAttr(lr) + vs + '><span>Monthly payment' + (l.rateText ? '<small>' + esc(l.rateText) + '</small>' : '') + '</span><b class="amt-out">' + money(l.payment) + '</b><i class="chev">&rsaquo;</i></button>' : '') +
        (l.paymentNext ? '<div class="ledtxt">From ' + esc(dbDate(l.paymentNext.from)) + ': <span class="amt-out">' + money(l.paymentNext.amount) + '</span> / mo</div>' : '') +
        (l.nextDue ? '<div class="ledtxt">Next due ' + esc(dbDate(l.nextDue, true)) + ' (' + esc(dbIn(l.daysUntil)) + ')</div>' : '') + '</div>';
    });
    if (loans.length) {
      b += '<div class="ledgrp"><div class="ledgh">Totals</div>' +
        ledLine('<b>Total debt</b>', '<span class="amt-neutral">' + balMoney(tDebt) + '</span>', ledRoutes(D, 'total'), dbSheet(D) ? '' : 'debt', 'grand') +
        ledLine('<b>Total debt service</b><small>per month</small>', '<span class="amt-out">' + money(tMo) + '</span>', ledRoutes(D, 'service'), dbSheet(D) ? '' : 'debt', 'grand') + '</div>';
      if (!cut && D.monthlyAfter && D.monthlyAfter.from > D.today) b += ledNote('From ' + esc(dbDate(D.monthlyAfter.from)) + ' the monthly total becomes ' + money(D.monthlyAfter.amount) + '.');
    }
    b += ledNote('From the Debts tab. Tap a number to see the row behind it.');
    b += '<button class="linkrow smallrow" data-go="spend" data-ov-vsec="debt">Open Vault Debt &rsaquo;</button>';
    return ledCard('debt', title, tot, b);
  }

  // ---- 5. Assets & net worth (the Overview's own model: property values are Zac's estimates and carry the Incomplete tag) ----
  function ledNwCard() {
    var f = ov.fin, a = state.acct, d = state.debt, title = 'Assets & net worth', ok = f.s === 'ok' && f.data && Array.isArray(f.data.ledger) && f.data.ledger.length;
    function shell(totVal, body) { return ledCard('nw', title, ledTot('Net worth', totVal, 'fin/overview/nw'), body); }
    if (f.s === 'na') return shell('<span class="amt-neutral">\u2014</span>', ledState('Not available yet (server update pending).'));
    if (f.s === 'err' && !f.data) return shell('<span class="amt-neutral">\u2014</span>', ledState('Could not load the Overview figures: ' + friendly(f.err), true));
    if (!ok && f.s !== 'load') return shell('<span class="amt-neutral">\u2014</span>', ledState('The Overview figures are not available yet (server update pending).'));
    if (!ok || (a && a.s === 'load' && !a.d) || (d && d.s === 'load' && !d.d)) return shell('<span class="amt-neutral">\u2026</span>', ledState('Loading\u2026'));
    var M = ovModel(), H = M.heads.nw, NW = ovNetWorth(M);
    var tot = ledTot('Net worth' + (H.val !== null && H.tag === 'est' ? ' <span class="badge est">Incomplete</span>' : ''), H.val === null ? '<span class="amt-neutral">\u2014</span>' : '<span class="' + (H.val >= 0 ? 'amt-in' : 'amt-out') + '">' + ovWhole(H.val) + '</span>', 'fin/overview/nw');
    var b = '<div class="ledcmp">' + NW.html + '</div>' + ledNote('Same figures as Finances \u203a Overview. Property and equipment values are Zac\u2019s own estimates (no appraisals) and stay tagged Incomplete.') +
      '<button class="linkrow smallrow" data-go="fin/overview/nw">Net worth detail &rsaquo;</button>';
    return ledCard('nw', title, tot, b);
  }

  // ---- 6. Insurance & renewals (policy renewal dates from the Insurance notes page) ----
  function ledShort(s, n) { return String(s || '').replace(/\s*[\(\.;].*$/, '').slice(0, n || 60); }
  function ledInsCard() {
    var s = led.ins, title = 'Insurance & renewals';
    if (s.s !== 'ok') {
      var msg = s.s === 'na' ? 'Coming soon' : s.s === 'err' ? 'Could not load the insurance notes.' : 'Loading\u2026';
      return ledCard('ins', title, ledTot('Policies', '<span class="amt-neutral">' + (s.s === 'na' ? 'Coming soon' : s.s === 'load' ? '\u2026' : '\u2014') + '</span>', 'insn'), ledState(msg, s.s === 'err'));
    }
    var rows = [];
    insEnts(s.d).forEach(function (e) {
      if (ledSierra(e.slug, e.name, e.full)) return;
      (e.policies || []).forEach(function (p) {
        if (!p.renewal || ledSierra(p.carrier, p.type)) return;
        var pt = String(p.premium || ''), pm = pt.match(/=\s*(\$[\d,]+(?:\.\d+)?)\s*total/i) || pt.match(/^(\$[\d,]+(?:\.\d+)?)/);   // "<base> + fees = <amount> total" -> the total, otherwise the leading amount
        rows.push({ date: p.renewal, slug: e.slug, who: insLabel(e), label: ledShort(p.carrier, 50) + ' \u2014 ' + ledShort(p.type, 60), prem: pm ? pm[1] + (/estimated/i.test(pt) ? ' est.' : '') : '' });
      });
    });
    var nPol = rows.length;
    (s.d.todo || []).forEach(function (t) {   // open dated to-dos (e.g. a renewal offer to decide on) are key dates too, same as the Insurance notes page
      var dd = daysTo(t.date);
      if (t.done || dd === null || dd < 0 || ledSierra(t.lead, t.text, (t.entities || []).join(' '))) return;
      if (rows.some(function (r) { return !r.todo && r.date === t.date && (t.entities || []).indexOf(r.slug) >= 0; })) return;   // the policy row already shows this date
      rows.push({ date: t.date, slug: (t.entities || [])[0] || '', who: (t.entities || []).map(function (x) { return INS_LABEL[x] || x; }).join(' \u00b7 '), label: t.lead || todoRest(t), prem: '', todo: true });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var up = rows.filter(function (r) { var dd = daysTo(r.date); return dd !== null && dd >= 0; }), past = rows.filter(function (r) { return up.indexOf(r) < 0; });
    var next = up[0];
    var tot = ledTot(nPol + ' polic' + (nPol === 1 ? 'y' : 'ies') + (next ? ' \u00b7 next date' : ''), '<span class="amt-neutral">' + (next ? esc(fmtDate(next.date)) : '\u2014') + '</span>', 'insn');
    var b = '';
    if (!rows.length) b += ledNote('No renewal dates found in the insurance notes.');
    up.concat(past).forEach(function (r) {
      b += '<button class="ledins"' + goAttr(r.slug ? 'insn/' + r.slug : 'insn') + '><span class="ledim"><span class="ledan">' + esc(r.label) + '</span><span class="ledam">' + esc(r.who) + (r.todo ? ' \u00b7 to do' : '') + '</span>' + dueChip(r.date) + '</span>' +
        (r.prem ? '<b class="amt-out">' + esc(r.prem) + '</b>' : '') + '<i class="chev">&rsaquo;</i></button>';
    });
    b += ledNote('Renewal dates and premiums come from the Insurance running notes. Tap a policy for its details.');
    b += '<button class="linkrow smallrow" data-go="insn">Insurance notes &rsaquo;</button>';
    return ledCard('ins', title, tot, b);
  }

  // ---- 7. Placeholders (nothing invented) ----
  function ledSoonPlaceholder(key, title, text) {
    return ledCard(key, title, ledTot('Status', '<span class="amt-neutral">Coming soon</span>', ''), '<div class="ledsoon"><b>Coming soon</b>' + esc(text) + '</div>');
  }
  function ledHtml() {
    return '<div class="ledhero">Accounts, cash flow, bills and net worth in one place. Live numbers; tap any number to open its source.</div>' +
      ledCashCard() + ledFlowCard() + ledSoonCard() + ledDebtCard() + ledNwCard() + ledInsCard() +
      ledSoonPlaceholder('tax', 'Taxes & documents', 'Tax returns, K-1s and key finance documents will be listed here.') +
      ledSoonPlaceholder('goals', 'Goals', 'Savings and debt-payoff goals will be tracked here.');
  }
  function renderLed() {
    if (state.finKind !== 'ledger') return;
    $('fin-body').innerHTML = ledHtml();
  }
  function ledFetchSpend(force) {
    var s = led.sp;
    if (s.s === 'ok' && !force && Date.now() - s.at < FIN_TTL) return;
    var prev = s.s === 'ok' ? s : null, seq = ++led.seq;
    if (!prev) led.sp = { s: 'load', d: null, at: 0 };
    api('spend', 0).then(function (d) {
      if (seq !== led.seq) return;
      led.sp = { s: 'ok', d: d, at: Date.now() };
    }, function (err) {
      if (seq !== led.seq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      if (!prev) led.sp = { s: 'err', d: null, err: err, at: Date.now() };
    }).then(function () { if (ledActive()) renderLed(); });
  }
  function ledFetchIns(force) {
    var c = fin.cache.insurance;
    if (c) led.ins = { s: 'ok', d: c.data }; else if (led.ins.s !== 'ok') led.ins = { s: 'load', d: null };
    if (c && !force && Date.now() - c.at < FIN_TTL) return;
    finApi('insurance', true, function (err, data) {
      if (!err) led.ins = { s: 'ok', d: data };
      else if (err.na) led.ins = { s: 'na', d: null };
      else if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      else if (led.ins.s !== 'ok') led.ins = { s: 'err', d: null };
      if (ledActive()) renderLed();
    });
  }
  function ledFetchFin(force) {
    var c = fin.cache.overview;
    if (c) ov.fin = { s: 'ok', data: c.data }; else if (ov.fin.s !== 'ok') ov.fin = { s: 'load' };
    if (c && !force && Date.now() - c.at < FIN_TTL) return;
    finApi('overview', true, function (err, data) {
      if (!err) ov.fin = { s: 'ok', data: data };
      else if (err.na) ov.fin = { s: 'na' };
      else if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      else if (!ov.fin.data) ov.fin = { s: 'err', err: err };
      if (ledActive()) renderLed();
    });
  }
  function loadLed(force) {
    ordLiveFetch(!!force);
    loadAccounts(!!force); loadDebt(!!force); ledFetchSpend(!!force); ledFetchIns(!!force); ledFetchFin(!!force);
    renderLed();
  }
  function ledToggle(card) {
    var key = card.getAttribute('data-led'), col = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', col);
    var h = card.querySelector('h2.vgrp'); if (h) h.setAttribute('aria-expanded', String(!col));
    var m = ledMap(); m[key] = !col;
    try { localStorage.setItem(LED_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function ledClick(e) {
    var h = e.target.closest('h2.vgrp.led');
    if (h) { ledToggle(h.closest('.vgcard')); return true; }
    var at = e.target.closest('.ledat, .ledchevb');
    if (at) {
      var row = at.closest('.ledacct'), open = !row.classList.contains('open');
      row.classList.toggle('open', open); led.acOpen[row.getAttribute('data-ledac')] = open;
      var t = row.querySelector('.ledat'); if (t) t.setAttribute('aria-expanded', String(open));
      return true;
    }
    if (e.target.closest('[data-led-retry]')) { loadLed(true); return true; }
    return false;
  }
  $('fin-body').addEventListener('keydown', function (e) {
    var h = state.finKind === 'ledger' && e.target.closest && e.target.closest('h2.vgrp.led');
    if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ledToggle(h.closest('.vgcard')); }
  });

  // ---- TiwiK / Mono Village Laundromat screen (v22) ----
  // Collapsible sections: Income & Expenses (live from the Vault `spend` API, same drill-downs), Loan (Payoff Options Doc via
  // fin page "loan"; falls back to the Laundromat Doc until the API update), Maintenance (Maintenance Doc via fin page
  // "maintenance"), TiwiK business facts (Laundromat Doc), To do, Questions, Notes. No Status section.
  // Every figure is fetched at runtime. Numbers that come from documents are tappable and open the source in the viewer.
  var LD_DOCS = {   // Drive ids only (no figures): fall-back "open the Doc" links until the API supplies `sources`
    laundromat:  { id: '1sf4Kqe_a-fXxGkPJm9WU5DM8dLoDc2qVzLk-rEJ6lSc', title: 'Finances - Laundromat (Doc)', doc: true },
    payoff:      { id: '1qgX-uzO4Ghd-aypEbCie00AHniWxBu3ChLwr0RSWCs4', title: 'Equipment Payoff Options (Doc)', doc: true },
    compare:     { id: '1KYk0XPQwZsYVifI3QBBpUz-d0Zi4gWUMCJw4ceN5aRs', title: 'Equipment Payoff - Comparison Table (Doc)', doc: true },
    maintenance: { id: '1kSS6PjWiWWob2PlWNabFjrpPTu4vmYh7eLovwqVErQE', title: 'TiwiK Laundromat - Machine Maintenance (Doc)', doc: true },
    loandocs:    { id: '19-uY2ZGuU4L34i3lXGp8uDlHYXNKTBNk', title: 'Alliance loan documents (PDF)' },
    navigator:   { id: '1hokXjD0TjoUTEJPOwz_H_EohrHKk-axe', title: 'Alliance Loan Navigator (PDF)' }
  };
  function ldSrcOf(key, apiSources) {
    var s = apiSources && apiSources[key], d = LD_DOCS[key] || {};
    if (s && s.url) return { url: s.url, title: s.title || d.title || 'Source' };
    return { url: d.doc ? 'https://docs.google.com/document/d/' + d.id + '/edit' : 'https://drive.google.com/file/d/' + d.id + '/view', title: d.title || 'Source' };
  }
  var ld = { st: { laundromat: { s: 'load' }, loan: { s: 'load' }, maintenance: { s: 'load' }, spend: { s: 'load' } }, src: null };

  // Money inside document text becomes a tappable link to the source (only while ldSrc is set).
  var ldSrc = null;
  function fx(t) {
    var e = esc(t);
    if (!ldSrc) return e;
    return e.replace(/(\$\s?[\d,]+(?:\.\d+)?(?:\s?[kKmM]\b)?)/g, function (m) {
      return '<a class="srcnum" data-title="' + esc(ldSrc.title) + '" href="' + esc(ldSrc.url) + '">' + m + '</a>';
    });
  }
  function withSrc(src, fn) { var old = ldSrc; ldSrc = src; try { return fn(); } finally { ldSrc = old; } }
  function tiwikTitle(s) { return String(s || '').replace(/^(\d+\.\s*)?Laundromat\b/i, '$1TiwiK'); }
  function stripNum(s) { return String(s || '').replace(/^\d+\.\s*/, ''); }
  function linkify(text, title) {
    return esc(text).replace(/https?:\/\/[^\s<]+/g, function (u) {
      var ext = toEmbed(u.replace(/&amp;/g, '&')) ? '' : ' target="_blank" rel="noopener" data-external';
      return '<a class="srcnum man" data-title="' + esc(title || 'Document') + '" href="' + u + '"' + ext + '>Open file &rsaquo;</a>';
    });
  }
  function leadSplit(b) {
    var t = b.text || '', lead = b.lead || '', m;
    if (lead && t.indexOf(lead) === 0) return [lead, t.slice(lead.length).replace(/^[\s:;.\-\u2013\u2014]+/, '')];
    if ((m = t.match(/^([A-Z][A-Za-z0-9 \/()\-]{2,38}):\s+([\s\S]+)$/))) return [m[1], m[2]];
    return ['', t];
  }

  // -- loading --
  function ldFetch(page, force) {
    var st = ld.st[page];
    if (!(fin.cache[page] && !force && Date.now() - fin.cache[page].at < FIN_TTL)) st.s = fin.cache[page] ? 'ok' : 'load';
    finApi(page, !!force, function (err, data) {
      if (state.finKind !== 'laundromat') return;
      if (!err) { st.s = 'ok'; st.data = data; }
      else if (err.na) { st.s = 'na'; }
      else if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      else if (!st.data) { st.s = 'err'; st.err = err; }
      renderLd();
    });
    if (fin.cache[page]) { st.s = 'ok'; st.data = fin.cache[page].data; }
  }
  function ldSpend(force) {
    var st = ld.st.spend, off = state.monthOffset;
    if (!force && state.spendData && state.spendDataOff === off) { st.s = 'ok'; st.data = state.spendData; return; }
    st.s = 'load';
    var seq = ++state.spendSeq;
    api('spend', off).then(function (d) {
      if (seq !== state.spendSeq) return;
      state.spendData = d; state.spendDataOff = off; st.s = 'ok'; st.data = d;
      if (state.finKind === 'laundromat') renderLd();
    }, function (err) {
      if (seq !== state.spendSeq) return;
      if (err instanceof AuthError) { setPc(''); return lock('Passcode changed. Enter the new one.'); }
      st.s = 'err'; st.err = err; if (state.finKind === 'laundromat') renderLd();
    });
  }
  function loadLd(force) {
    ['laundromat', 'loan', 'maintenance'].forEach(function (p) { ldFetch(p, force); });
    ldSpend(force);
    renderLd();
  }
  function ldWait(st, what) {
    if (st.s === 'load') return '<div class="loading">Loading\u2026</div>';
    if (st.s === 'err') return '<div class="error">' + esc(friendly(st.err)) + '<div class="retry"><button class="navbtn" data-ld-retry>Try again</button></div></div>';
    return '';
  }

  // -- Income & Expenses (live from the Vault) --
  function ldIncomeHtml() {
    var st = ld.st.spend, w = ldWait(st);
    if (w) return w;
    var d = st.data, M = spendModel(d), cashOK = M.full;
    var tiw = M.accounts.filter(function (a) { return a.name === 'TiwiK'; })[0] || { amount: 0, cats: [] };
    var mine = M.items.filter(function (x) { return x.account === 'TiwiK'; });
    var inc = M.income.filter(function (x) { return x.source === 'Mono Village Laundromat'; });
    var incAmt = sum(inc), net = r2(incAmt - tiw.amount);
    var h = '<div class="ldmonth"><button class="navbtn" data-ld-month="-1">&lsaquo; Prev</button><div class="navlabel">' + esc(d.monthLabel || '') + '</div><button class="navbtn" data-ld-month="1">Next &rsaquo;</button></div>';
    h += '<div class="foot ldlive">Live from the Vault \u00b7 tap any number to see the entries behind it.</div>';
    h += '<div class="card income"><h4 class="sechead">Income \u00b7 Mono Village Laundromat</h4><div class="foot sub-note">Weekly lump sums \u00b7 ' + inc.length + (inc.length === 1 ? ' entry' : ' entries') + '</div>' +
      barRows([{ name: 'Mono Village Laundromat', label: 'TiwiK income', amount: incAmt }], incomeRoute, ' inc') + '</div>';
    h += '<div class="card acctsec"><h4 class="sechead">TiwiK spend by category</h4>';
    if (!tiw.cats.length) h += '<div class="foot empty">No TiwiK entries this month</div>';
    h += barRows(tiw.cats, function (c) { return catRoute(c, 'TiwiK'); }, '',
      cashOK ? function (c) { return { v: cashOf(mine.filter(function (x) { return x.category === c; })), route: cashRoute('TiwiK', c) }; } : null);
    if (cashOK) h += '<div class="cashtot">' + cashBtn(cashOf(mine), cashRoute('TiwiK')) + '</div>';
    h += totBtn('TiwiK total spent', tiw.amount, acctRoute('TiwiK')).replace('totrow tapt', 'totrow tapt' + (cashOK ? ' hascash' : '')) + '</div>';
    h += '<div class="card summary"><h3>TiwiK net</h3>' +
      sumBtn('net cmp', calcRoute('tiwik-net'), 'TiwiK net<small>Income <span class="amt-in">' + money(incAmt) + '</span> \u2212 Spent <span class="amt-out">' + money(tiw.amount) + '</span></small>',
        '<span class="amt ' + (net >= 0 ? 'pos' : 'neg') + '">' + signedMoney(net) + '</span>') + '</div>';
    h += '<button class="linkrow allbtn"' + goAttr(acctRoute('TiwiK')) + '>All TiwiK entries (' + mine.length + ') &rsaquo;</button>';
    h += sheetLink('Open in spend sheet');
    return h;
  }

  // -- Loan --
  function factSource(txt, apiSrc) {
    if (/navigator/i.test(txt)) return ldSrcOf('navigator', apiSrc);
    if (/loan documents|note|approval/i.test(txt)) return ldSrcOf('loandocs', apiSrc);
    return ldSrcOf('payoff', apiSrc);
  }
  function factCards(t, apiSrc) {
    return '<div class="fxtbl">' + t.rows.map(function (r) {
      var src = factSource(r[2] || '', apiSrc);
      return '<div class="fxrec"><div class="fxrt">' + esc(r[0]) + '</div><div class="fxloanv">' + withSrc(src, function () { return fx(r[1] || ''); }) + '</div>' +
        (r[2] ? '<div class="fxsrc">Source: ' + esc(r[2]) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function scenarioCards(t) {
    return '<div class="fxtbl">' + t.rows.map(function (r) {
      var h = '<div class="fxrec"><div class="fxrt"><span class="badge">#' + esc(r[0]) + '</span> ' + esc(r[1] || '') + '</div>';
      for (var i = 2; i < r.length; i++) if (String(r[i] || '').trim() && r[i] !== '-') h += '<div class="fxkv"><b>' + esc(t.header[i] || '') + '</b><span>' + fx(r[i]) + '</span></div>';
      return h + '</div>';
    }).join('') + '</div>';
  }
  function colIdx(head, re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
  function optionCards(t) {
    var H = t.header, iPay = colIdx(H, /^monthly/i), iCash = colIdx(H, /^cash used/i), iDate = colIdx(H, /^payoff/i), iInt = colIdx(H, /^total interest/i), iVs = colIdx(H, /^vs baseline/i);
    if (iCash < 0 || iDate < 0 || iInt < 0) return tableCards(t);
    var keys = [iInt, iVs, iDate, iCash].filter(function (i) { return i >= 0; });
    var lab = { };
    lab[iInt] = 'Total interest'; lab[iVs] = 'vs baseline'; lab[iDate] = 'Payoff'; lab[iCash] = 'Cash used';
    return '<div class="fxtbl">' + t.rows.map(function (r) {
      var h = '<div class="fxrec ldopt"><div class="fxrt">' + esc(r[0]) + '</div><div class="ldstats">';
      keys.forEach(function (i) {
        var v = r[i] || '\u2014', cls = i === iVs ? (/^\s*-/.test(v) ? ' pos' : (/^\s*\+/.test(v) ? ' neg' : '')) : '';
        h += '<div class="ldst' + cls + '"><small>' + esc(lab[i]) + '</small><span>' + fx(v) + '</span></div>';
      });
      h += '</div><details class="lddet"><summary>All figures</summary>';
      r.forEach(function (c, i) {
        if (i === 0 || keys.indexOf(i) >= 0 || !String(c || '').trim() || c === '-') return;
        h += '<div class="fxkv"><b>' + esc(H[i] || '') + '</b><span>' + fx(c) + '</span></div>';
      });
      return h + '</details></div>';
    }).join('') + '</div>';
  }
  function proConCards(t) {
    var H = t.header, iP = colIdx(H, /^pros/i), iC = colIdx(H, /^cons/i);
    if (iP < 0 || iC < 0) return tableCards(t);
    return '<div class="fxtbl">' + t.rows.map(function (r) {
      return '<div class="fxrec"><div class="fxrt">' + esc(r[0]) + '</div>' +
        '<div class="ldpc pro"><b>Pros</b>' + fx(r[iP] || '\u2014') + '</div><div class="ldpc con"><b>Cons / risks</b>' + fx(r[iC] || '\u2014') + '</div></div>';
    }).join('') + '</div>';
  }
  // Doc blocks -> html; `tblFn(b)` renders each table. H3 headings group into nested collapsibles when there are 2+.
  function ldBlocks(blocks, key, tblFn) {
    var h3n = blocks.filter(function (b) { return b.k === 'h'; }).length, h = '', i = 0, grp = null, n = 0;
    var flush = function () { if (grp) { h += collCard(key + 'g' + (n++), grp.title, grp.count || null, grp.html, false, 'nest'); grp = null; } };
    blocks.forEach(function (b) {
      var piece = '';
      if (b.k === 'h') { if (h3n >= 2) { flush(); grp = { title: b.text, html: '', count: 0 }; return; } piece = '<div class="fxh3">' + esc(b.text) + '</div>'; }
      else if (b.k === 'p') piece = '<p class="fxp">' + fx(b.text) + '</p>';
      else if (b.k === 'li') piece = '<div class="fxli">' + fx(b.text) + '</div>';
      else if (b.k === 'tbl') { piece = tblFn(b); if (grp) grp.count = (grp.count || 0) + (b.rows ? b.rows.length : 0); }
      if (grp) grp.html += piece; else h += piece;
    });
    flush();
    return h;
  }
  function loanSections(d) {
    var apiSrc = d.sources, pay = ldSrcOf('payoff', apiSrc), h = '';
    var tblFn = function (b) {
      var H0 = (b.header[0] || '');
      if (/^item$/i.test(H0) && /^source/i.test(b.header[2] || '')) return b.rows.length && /^(alliance|payments|rate|maturity|security|lines)/i.test(b.rows[0][0]) ? factCards(b, apiSrc) : tableCards(b);
      if (H0 === '#') return scenarioCards(b);
      if (/^option/i.test(H0) && b.header.length >= 7) return optionCards(b);
      if (/^path/i.test(H0)) return proConCards(b);
      return tableCards(b);
    };
    (d.sections || []).forEach(function (sec, i) {
      var tn = (sec.blocks || []).filter(function (b) { return b.k === 'tbl'; }).length;
      var inner = withSrc(pay, function () { return ldBlocks(sec.blocks || [], 'lnx' + i, tblFn); });
      if (!inner) return;
      h += collCard('lnsec' + i, stripNum(sec.title), tn ? tn + (tn === 1 ? ' table' : ' tables') : null, inner, i === 0, 'nest');
    });
    return h;
  }
  function ldLoanHtml() {
    var st = ld.st.loan, doc = ld.st.laundromat, h = '';
    var payLink = '<a class="linkrow" data-title="' + esc(LD_DOCS.payoff.title) + '" href="' + esc(ldSrcOf('payoff', st.data && st.data.sources).url) + '">Open the full Payoff Options Doc &rsaquo;</a>';
    var cmpLink = '<a class="linkrow cmplink" data-title="' + esc(LD_DOCS.compare.title) + '" href="' + esc(ldSrcOf('compare', st.data && st.data.sources).url) + '">Payoff Comparison Table &rsaquo;</a>';
    if (st.s === 'ok') {
      var d = st.data, pay = ldSrcOf('payoff', d.sources);
      h += '<div class="fxnote"><b>Equipment note</b> TiwiK LLC \u00b7 Alliance Laundry (Huebsch). All figures are read live from the Payoff Options Doc; tap a number to open its source. General information and arithmetic only \u2014 not lending, tax, legal or insurance advice.</div>' + cmpLink;
      if ((d.status || []).length) h += collCard('lnhead', 'Headline findings', null, withSrc(pay, function () { return d.status.map(function (t) { return '<p class="fxp">' + fx(t) + '</p>'; }).join(''); }), true, 'nest');
      h += loanSections(d);
      var tdo = d.todo || [];
      if (tdo.length) h += withSrc(pay, function () { return todoCards(tdo, 'ln'); }).replace(/class="card ncard fxcard/g, 'class="card ncard fxcard nest');
      if ((d.questions || []).length) h += collCard('lnq', 'Questions / to discuss', d.questions.length, withSrc(pay, function () { return simpleList(d.questions); }), false, 'nest');
      h += withSrc(pay, function () { return notesCard(d.notes, 'ln') + doneCard(d.done, 'ln'); }).replace(/class="card ncard fxcard/g, 'class="card ncard fxcard nest');
      return h + payLink;
    }
    var w = ldWait(st);
    if (w) return w;
    // Fallback until the API update (page "loan" not deployed): the loan facts already in the Laundromat Doc.
    h += '<div class="fxnote"><b>Update pending</b> The full payoff analysis (Bank of Stockton options, comparison, rate outlook, insurance) appears here after the server update. Showing the loan facts from the Laundromat Doc for now.</div>' + cmpLink;
    if (doc.s === 'ok' && doc.data.summary) {
      var s = doc.data.summary, src = ldSrcOf('laundromat');
      if (s.loan && s.loan.rows.length) h += collCard('ldloan', 'Loan terms', s.loan.rows.length, withSrc(src, function () { return loanCards(s.loan); }), true, 'nest');
      if (s.payoff && s.payoff.rows.length) h += collCard('ldpay', 'Payoff options', s.payoff.rows.length, withSrc(src, function () { return tableCards(s.payoff); }), false, 'nest');
    } else if (doc.s === 'load') h += '<div class="loading">Loading\u2026</div>';
    return h + payLink;
  }

  // -- Maintenance --
  function manualState(t) {
    var r = (t && t.rows || []).filter(function (x) { return /^manual$/i.test(x[0]); })[0], v = r ? r[1] : '';
    if (/^on file/i.test(v)) return { k: 'ok', label: 'Manual on file' };
    if (/^partial/i.test(v)) return { k: 'part', label: 'Partial' };
    return { k: 'miss', label: 'No manual' };
  }
  function machineBody(sec, key) {
    var h = '', t = (sec.blocks || []).filter(function (b) { return b.k === 'tbl'; })[0];
    if (t) {
      h += '<div class="fxtbl"><div class="fxrec">' + t.rows.map(function (r) {
        var v = r[1] || '';
        if (/^manual$/i.test(r[0])) { var ms = manualState(t); return '<div class="fxkv"><b>Manual</b><span><span class="mtbadge ' + ms.k + '">' + esc(ms.label) + '</span> ' + linkify(v, "Owner's manual") + '</span></div>'; }
        return '<div class="fxkv"><b>' + esc(r[0]) + '</b><span>' + linkify(v, 'Document') + '</span></div>';
      }).join('') + '</div></div>';
    }
    var grp = null;
    var endGrp = function () { if (grp) { h += grp + '</div>'; grp = null; } };
    (sec.blocks || []).forEach(function (b) {
      if (b.k === 'tbl') return;
      if (b.k === 'h') {
        endGrp();
        var cls = /required maintenance/i.test(b.text) ? 'mt-man' : /not on file/i.test(b.text) ? 'mt-miss' : /general manufacturer/i.test(b.text) ? 'mt-gen' : 'mt-man';
        grp = '<div class="mtgrp ' + cls + '"><div class="mtlab">' + esc(b.text) + '</div>';
        return;
      }
      var piece;
      if (b.k === 'li') { var ls = leadSplit(b); piece = '<div class="mtrow">' + (ls[0] ? '<b class="mtfreq">' + esc(ls[0]) + '</b> ' : '') + esc(ls[1]) + '</div>'; }
      else piece = '<p class="fxp">' + esc(b.text) + '</p>';
      if (grp) grp += piece; else h += piece;
    });
    endGrp();
    return h;
  }
  function ldMaintHtml() {
    var st = ld.st.maintenance, h = '';
    var link = '<a class="linkrow" data-title="' + esc(LD_DOCS.maintenance.title) + '" href="' + esc(ldSrcOf('maintenance').url) + '">Open the Maintenance Doc &rsaquo;</a>';
    if (st.s === 'na') return '<div class="fxnote"><b>Update pending</b> The machine-by-machine maintenance list appears here after the server update. It lives in the Maintenance Doc (one section per machine, with a \u201cTo get: owner\u2019s manuals\u201d checklist at the top).</div>' + link;
    var w = ldWait(st);
    if (w) return w;
    var d = st.data, secs = d.sections || [], machines = [], toget = null;
    secs.forEach(function (s) { if (/^M\d+\./i.test(s.title)) machines.push(s); else if (/^to get/i.test(s.title)) toget = s; });
    var cnt = { ok: 0, part: 0, miss: 0 };
    machines.forEach(function (m) { var t = (m.blocks || []).filter(function (b) { return b.k === 'tbl'; })[0]; cnt[manualState(t).k]++; });
    h += '<div class="fxnote"><b>Owner\u2019s manuals</b> ' + cnt.ok + ' on file \u00b7 ' + cnt.part + ' partial \u00b7 ' + cnt.miss + ' not on file, of ' + machines.length + ' equipment groups. Items labeled \u201cgeneral manufacturer guidance\u201d are NOT from your manual \u2014 verify them.</div>';
    if (toget) {
      var items = (toget.blocks || []).filter(function (b) { return b.k === 'li' || b.k === 'p'; });
      h += collCard('mtget', 'To get: owner\u2019s manuals', items.length, items.map(function (b) {
        return '<div class="todorow mtget"><i class="mtbox">\u2610</i>' + esc(b.text.replace(/^[\u2610-\u2612]\s*/, '')) + '</div>';
      }).join(''), true, 'nest');
    }
    machines.forEach(function (m, i) {
      var t = (m.blocks || []).filter(function (b) { return b.k === 'tbl'; })[0], ms = manualState(t);
      h += collCard('mtm' + i, m.title.replace(/^M\d+\.\s*/i, ''), '<span class="mtbadge ' + ms.k + '">' + esc(ms.label) + '</span>', machineBody(m, 'mtm' + i), false, 'nest mach');
    });
    var tdo = (d.todo || []);
    if (tdo.length) h += todoCards(tdo, 'mt').replace(/class="card ncard fxcard/g, 'class="card ncard fxcard nest');
    if ((d.questions || []).length) h += collCard('mtq', 'Questions / to discuss', d.questions.length, simpleList(d.questions), false, 'nest');
    h += notesCard(d.notes, 'mt').replace(/class="card ncard fxcard/g, 'class="card ncard fxcard nest');
    return h + link + updatedLine(d);
  }

  // -- TiwiK business facts (Laundromat Doc; Status intentionally not shown) --
  function ldDocSections(d) {
    var s = d.summary || {}, src = ldSrcOf('laundromat'), h = '';
    var isLoan = function (b) { return s.loan && b.header && b.header[1] === s.loan.header[1] && b.header[0] === s.loan.header[0]; };
    var isPay = function (b) { return s.payoff && b.header && b.header[0] === s.payoff.header[0] && b.header.length === s.payoff.header.length; };
    withSrc(src, function () {
      (d.sections || []).forEach(function (sec, i) {
        var inner = sectionInner(sec, function (b) { return isLoan(b) || isPay(b); }), n = (sec.blocks || []).filter(function (b) { return b.k === 'tbl' && !isLoan(b) && !isPay(b); }).length;
        if (!inner) return;
        h += collCard('lds' + i, tiwikTitle(sec.title), n ? n + (n === 1 ? ' table' : ' tables') : null, inner, false, 'nest');
      });
    });
    return h;
  }

  function renderLd() {
    if (state.finKind !== 'laundromat') return;
    var doc = ld.st.laundromat, h = '';
    h += collCard('ldie', 'Income & expenses', null, ldIncomeHtml(), true);
    h += collCard('ldloanhub', 'Loan', null, ldLoanHtml(), false);
    h += collCard('ldmaint', 'Maintenance', null, ldMaintHtml(), false);
    if (doc.s === 'ok') {
      var d = doc.data, body = ldDocSections(d);
      if (body) h += collCard('ldfacts', 'Equipment & business facts', null, body, false);
      h += withSrc(ldSrcOf('laundromat'), function () { return todoCards(d.todo || [], 'ld'); });
      if ((d.questions || []).length) h += collCard('ldq', 'Questions', d.questions.length, withSrc(ldSrcOf('laundromat'), function () { return simpleList(d.questions); }), false);
      h += withSrc(ldSrcOf('laundromat'), function () { return notesCard(d.notes, 'ld') + doneCard(d.done, 'ld'); });
      h += docLink(d) + updatedLine(d);
    } else if (doc.s === 'na') {
      h += '<div class="loading">The Laundromat Doc sections aren\u2019t available yet (server update pending).</div>';
    } else if (doc.s === 'err') {
      h += '<div class="error">' + esc(friendly(doc.err)) + '<div class="retry"><button class="navbtn" data-ld-retry>Try again</button></div></div>';
    } else h += '<div class="loading">Loading the Laundromat Doc\u2026</div>';
    var box = $('fin-body'), y = window.scrollY;
    box.innerHTML = h;
    if (y) window.scrollTo(0, y);
  }

  function loanCards(t) {
    var st = t.header.length - 1;   // last column = status
    return '<div class="fxtbl">' + t.rows.map(function (r) {
      var status = r[st] && st > 1 ? r[st] : '';
      return '<div class="fxrec"><div class="fxrt">' + esc(r[0]) + (status ? ' <span class="badge' + (/^(matches|consistent|resolved|confirmed|schedule ties)/i.test(status) ? ' ok' : '') + '">' + esc(status) + '</span>' : '') + '</div>' +
        '<div class="fxloanv">' + fx(r[1] || '') + '</div></div>';
    }).join('') + '</div>';
  }

  // ---- Insurance running notes ----
  function insEnts(d) {
    var ents = (d.entities || []).slice();
    ents.sort(function (a, b) {
      var ia = INS_ORDER.indexOf(a.slug), ib = INS_ORDER.indexOf(b.slug);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return ents;
  }
  function insLabel(e) { return INS_LABEL[e.slug] || e.name; }
  function nextRenewal(e) {
    var best = '', bd = null;
    e.policies.forEach(function (p) { var dd = daysTo(p.renewal); if (dd !== null && dd >= 0 && (bd === null || dd < bd)) { bd = dd; best = p.renewal; } });
    return best;
  }
  function loadInsn(force) {
    var slug = state.insSlug;
    $('insn-back').setAttribute('data-go', slug ? 'insn' : 'fin');
    $('insn-title').classList.toggle('sub', !!slug);
    if (!slug) $('insn-title').textContent = 'Insurance';
    var cached = fin.cache.insurance;
    if (cached) renderInsn(cached.data);
    else $('insn-body').innerHTML = '<div class="loading">Loading…</div>';
    if (cached && !force && Date.now() - cached.at < FIN_TTL) return;
    finApi('insurance', true, function (err, data) {
      if (!err) return renderInsn(data);
      if (cached) return;
      finFail('insn-body', 'Insurance notes', function () { loadInsn(true); })(err);
    });
  }
  function keyDates(ents, only) {
    var rows = [];
    ents.forEach(function (e) {
      if (only && e.slug !== only) return;
      e.policies.forEach(function (p) {
        if (p.renewal) rows.push({ date: p.renewal, label: p.carrier.replace(/\s*\(.*$/, '') + ' \u2014 ' + (p.type || '').replace(/\s*[\(\.;].*$/, '').slice(0, 60), who: insLabel(e), kind: 'Renewal' });
      });
    });
    return rows;
  }
  function renderInsn(d) {
    var ents = insEnts(d), slug = state.insSlug, e = slug && ents.filter(function (x) { return x.slug === slug; })[0], h = '';
    if (!e) {
      $('insn-title').textContent = 'Insurance'; $('insn-title').classList.remove('sub');
      $('insn-back').setAttribute('data-go', 'fin');
      h += statusCard(d.status);
      h += '<div class="grid2 biz-grid">' + ents.filter(function (x) { return x.slug !== 'monoway'; }).map(function (x) {
        var nr = nextRenewal(x), nt = (d.todo || []).filter(function (t) { return !t.done && t.entities && t.entities.indexOf(x.slug) >= 0; }).length;
        return '<button class="tile biz-tile" data-go="insn/' + esc(x.slug) + '">' + esc(insLabel(x)) +
          '<span class="sub cnt">' + (x.policies.length ? x.policies.length + ' polic' + (x.policies.length === 1 ? 'y' : 'ies') : 'No policy') + (nt ? ' \u00b7 ' + nt + ' to do' : '') + '</span>' +
          (nr ? '<span class="sub">Next: ' + esc(fmtDate(nr)) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
      var upcoming = (d.todo || []).filter(function (t) { return !t.done && t.date; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      h += collCard('insdates', 'Key dates', upcoming.length, upcoming.length ? upcoming.map(function (t) {
        return '<div class="fxkd">' + dueChip(t.date) + '<div>' + esc(t.lead || todoRest(t)) + (t.entities && t.entities.length ? '<small>' + t.entities.map(function (s) { return esc(INS_LABEL[s] || s); }).join(' \u00b7 ') + '</small>' : '') + '</div></div>';
      }).join('') : '<div class="donerow dim">No dated items.</div>', true);
      h += todoCards(d.todo || [], 'ins');
      h += doneCard(d.done, 'ins') + notesCard(d.notes, 'ins');
      h += '<a class="linkrow" data-go="ins">Policy documents in Drive &rsaquo;</a>' + docLink(d) + updatedLine(d);
      $('insn-body').innerHTML = h;
      return;
    }
    $('insn-title').textContent = insLabel(e); $('insn-title').classList.add('sub');
    $('insn-back').setAttribute('data-go', 'insn');
    if (e.blurb && e.blurb.length) h += '<div class="card statuscard"><h3>' + esc(e.full || e.name) + '</h3>' + e.blurb.map(function (t) { return '<p class="stat">' + esc(t) + '</p>'; }).join('') + '</div>';
    else if (e.full && e.full !== e.name) h += '<div class="hint">' + esc(e.full) + '</div>';
    if (e.noPolicy) h += '<div class="card"><h3>Policies</h3><p class="stat">' + esc(e.noPolicy) + '</p></div>';
    e.policies.forEach(function (p, i) {
      var key = 'pol' + e.slug + i, open = cardOpen(key, false);
      h += '<div class="card fxpol">' +
        '<div class="fxpolh"><div class="fxcar">' + esc(p.carrier) + '</div>' + (p.renewal ? dueChip(p.renewal) : '') + '</div>' +
        '<div class="fxtype">' + esc(p.type) + '</div>' +
        '<div class="fxkv"><b>Policy #</b><span>' + esc(p.policy || '\u2014') + '</span></div>' +
        '<div class="fxkv"><b>Term / renewal</b><span>' + esc(p.term || '\u2014') + '</span></div>' +
        '<div class="fxkv"><b>Premium</b><span class="prem amt-out">' + esc(p.premium || '\u2014') + '</span></div>' +
        (p.notes ? '<div class="fxpn' + (open ? ' open' : '') + '" data-nc="' + key + '"><button class="nchead fxnh" aria-expanded="' + open + '"><span>Notes / source file</span><i class="chev">&rsaquo;</i></button><div class="ncbody">' + esc(p.notes) + '</div></div>' : '') +
        '</div>';
    });
    var todo = (d.todo || []).filter(function (t) { return t.entities && t.entities.indexOf(e.slug) >= 0; });
    var kd = keyDates(ents, e.slug);
    (d.todo || []).forEach(function (t) {
      if (t.done || !t.date || !t.entities || t.entities.indexOf(e.slug) < 0) return;
      if (!kd.some(function (k) { return k.date === t.date; })) kd.push({ date: t.date, label: t.lead || todoRest(t), who: '', kind: 'To do' });
    });
    kd.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += collCard('kd' + e.slug, 'Key dates', kd.length, kd.length ? kd.map(function (k) {
      return '<div class="fxkd">' + dueChip(k.date) + '<div>' + esc(k.label) + '<small>' + esc(k.kind) + '</small></div></div>';
    }).join('') : '<div class="donerow dim">No dates found.</div>', true);
    h += todoCards(todo, 'in' + e.slug);
    h += '<a class="linkrow" data-go="ins">Policy documents in Drive &rsaquo;</a>' + docLink(d) + updatedLine(d);
    $('insn-body').innerHTML = h;
  }

  /* ---------------- Vault mic / camera (v54): dictation parser ---------------- */
  /*VP-BEGIN*/
  var VP = (function () {
    var CATS = ['Groceries', 'Dining', 'Gas', 'Home goods', 'Kids/Education', 'Health', 'Entertainment', 'Travel', 'Home/Property', 'Personal', 'Other', 'Plumbing', 'Insurance', 'Property Taxes'];
    var ACCTS = ['Household', 'TiwiK', 'KiwiT'];
    var WHO = ['Zac', 'Lisa', 'Joint'];
    var SOURCES = ["Lisa's Table", 'Mono Village Laundromat', 'KiwiT rent', 'Land & Structure', 'Personal Training'];   // the ONLY income sources (no 'Other', never a new one)
    // keyword -> category; the keyword heard EARLIEST in the sentence wins (ties: list order)
    var KW = [
      ['Property Taxes', 'property tax|property taxes|tax bill|county tax|tax collector|taxes'],
      ['Plumbing', 'plumbing|plumber|pipes?|leak|leaking|drain|water heater|faucet|toilet|sewer'],
      ['Insurance', 'insurance|premium|geico|state farm|progressive|allstate'],
      ['Entertainment', 'beer|beers|bar|taproom|tap room|brewery|brewing|pub|wine|liquor|cocktails?|movies?|concert|tickets?|bowling|netflix|spotify|golf|arcade'],
      ['Dining', 'bagels?|coffee|latte|espresso|lunch|dinner|breakfast|brunch|restaurant|pizza|burgers?|cafe|diner|tacos?|burrito|sushi|takeout|take out|doordash|grubhub|starbucks|mcdonald\'?s|bakery|sandwich(?:es)?|deli|ice cream|donuts?|smoothie|food truck'],
      ['Groceries', 'groceries|grocery|safeway|costco|trader joe\'?s|whole foods|winco|raley\'?s|save mart|supermarket|produce|food'],
      ['Gas', 'gas|gasoline|fuel|diesel|chevron|arco|fill up|filled up'],
      ['Health', 'doctor|dentist|dental|pharmacy|cvs|walgreens|prescription|medicine|medical|hospital|urgent care|clinic|optometrist|gym|vitamins?|therapy'],
      ['Kids/Education', 'school|tuition|kids?|daycare|soccer|books?|lessons?|class|classes|camp|uniform|tutor|textbooks?|education'],
      ['Travel', 'flight|flights|hotel|airbnb|uber|lyft|airline|rental car|parking|toll|motel|train|amtrak|travel'],
      ['Home/Property', 'repairs?|mortgage|hoa|roof|roofing|lawn|landscaping|handyman|hardware|home depot|lowe\'?s|lumber|paint|electrician|electric|hvac|pest|termite|water bill|internet|utility|utilities|pg&e|fence|concrete|gravel'],
      ['Home goods', 'furniture|ikea|target|amazon|cleaning supplies|supplies|towels|kitchen|appliances?|mattress|home goods|bedding|dishes'],
      ['Personal', 'haircut|barber|salon|clothes|clothing|shoes|personal|shirt|jacket|massage|nails']
    ];
    var KWRE = KW.map(function (k) { return [k[0], new RegExp('\\b(?:' + k[1].replace(/ /g, '\\s+') + ')\\b', 'i')]; });
    var TIWIK = 'tiwi[\\s.-]*k|tiwik|t[\\s.-]*wick(?:ed)?|tee[\\s.-]*wick(?:ed)?|tea[\\s.-]*wick|tie[\\s.-]*wick|ty[\\s.-]*wick|ti[\\s.-]*wick|tewick|twick|tee[\\s.-]*we[ae]k|t[\\s.-]*we[ae]k';
    var KIWIT = 'kiwi[\\s.-]*tea|kiwi[\\s.-]*t(?:ee)?|kiwit|kiwi|hewitt|hewit|hue[\\s.-]*it|key[\\s.-]*wit';
    var HOUSE = 'house[\\s-]*hold';
    var ACCT_SRC = [['TiwiK', TIWIK], ['KiwiT', KIWIT], ['Household', HOUSE]];
    // payment type chips (what the form shows) and the words that pre-select one. The server value for 'Credit card' is 'Credit'.
    var PAY = ['Cash', 'Credit card', 'Venmo', 'Debit', 'Zelle', 'Check', 'ACH/Transfer', 'Other'];
    var PAYLEAD = '(?:(?:paid|pay|paying|payment|using|with|via|by|in|on|through|thru|from|over)\\s+)*(?:(?:my|the|our|a|an)\\s+)?';
    var PAYRX = [
      ['Venmo', 'venmo(?:ed|s)?'],
      ['Zelle', 'zelle(?:d)?|zell'],
      ['Credit card', 'credit\\s+cards?|(?:master|visa|amex)\\s*cards?|visa|master\\s?card|amex|american\\s+express|credit(?!\\s+union)|(?:on|with|using)\\s+(?:the|my|our)\\s+card|put\\s+it\\s+on\\s+(?:the|my|our)\\s+card'],
      ['Debit', 'debit(?:\\s+cards?)?'],
      ['ACH/Transfer', 'ach|(?:bank\\s+|wire\\s+)?transfer(?:red)?|wire(?:d)?|direct\\s+deposit'],
      ['Check', '(?:checks?|cheques?)(?!\\s+(?:mate|point|list|out|in|up|engine|book|cashing))'],
      ['Cash', 'cash(?!\\s+(?:app|advance|back|america))']
    ].map(function (x) { return [x[0], new RegExp('\\b' + PAYLEAD + '(?:' + x[1] + ')\\b', 'i')]; });
    var MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
    var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var UNIT = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
    var TEN = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
    function fromIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
    function addDays(s, n) { var d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); }
    function validIso(y, m, d) { var x = new Date(y, m - 1, d, 12); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d ? y + '-' + p2(m) + '-' + p2(d) : ''; }
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

    /* ---- dates: "yesterday", "two days ago", "last friday", "on 10/1", "october 1st" ---- */
    function takeDate(w, today) {
      var date = '', m, fn = function (iso0) { if (!date) date = iso0; return ' '; };
      w = w.replace(/\bday before yesterday\b/i, function () { return fn(addDays(today, -2)); });
      w = w.replace(/\b(\d{1,2}|one|two|three|four|five|six|seven)\s+days?\s+ago\b/i, function (s, n) { var v = has(UNIT, String(n).toLowerCase()) ? UNIT[String(n).toLowerCase()] : +n; return fn(addDays(today, -v)); });
      w = w.replace(/\byesterday\b/i, function () { return fn(addDays(today, -1)); });
      w = w.replace(/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/i, function () { return fn(today); });
      w = w.replace(/\b(?:on\s+)?(last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, function (s, last, dn) {
        var want = DAYS.indexOf(dn.toLowerCase()), have = fromIso(today).getDay(), back = (have - want + 7) % 7;
        if (back === 0 && last) back = 7;
        return fn(addDays(today, -back));
      });
      var yr = +today.slice(0, 4), fix = function (y, mo, d, hadYear) {
        var r = validIso(y, mo, d);
        if (r && !hadYear && r > addDays(today, 1)) r = validIso(y - 1, mo, d);   // "12/30" said in January = last year
        return r;
      };
      w = w.replace(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, function (s, a, b, c) {
        var y = c ? (+c < 100 ? 2000 + +c : +c) : yr, r = fix(y, +a, +b, !!c);
        return r ? fn(r) : s;
      });
      w = w.replace(/\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i, function (s, mo, d, y) {
        var r = fix(y ? +y : yr, MONTHS[mo.toLowerCase()], +d, !!y);
        return r ? fn(r) : s;
      });
      return { text: w, date: date };
    }

    /* ---- spoken numbers -> digits ("forty two fifty" = 42.50, "three thousand" = 3000) ---- */
    function tokenize(s) {
      var re = /[A-Za-z']+|\d[\d,]*(?:\.\d+)?|[^\sA-Za-z\d]/g, out = [], m;
      while ((m = re.exec(s))) out.push({ s: m[0], i: m.index, e: m.index + m[0].length });
      return out;
    }
    function groupsOf(s) {
      var tk = tokenize(s), gs = [], n = 0;
      while (n < tk.length) {
        var w = tk[n].s.toLowerCase(), nx = tk[n + 1] && tk[n + 1].s.toLowerCase();
        if (/^\d/.test(w)) {
          gs.push({ v: parseFloat(w.replace(/,/g, '')), i: tk[n].i, e: tk[n].e, digits: true, ndig: w.replace(/\D/g, '').length, dec: w.indexOf('.') >= 0, comma: w.indexOf(',') >= 0 });
          n++; continue;
        }
        var aHun = w === 'a' && (nx === 'hundred' || nx === 'thousand');
        if (!(has(UNIT, w) || has(TEN, w) || aHun)) { n++; continue; }
        var total = 0, cur = 0, last = '', k = n, end = n - 1, words = 0;
        if (aHun) { cur = 1; last = 'unit'; end = n; k = n + 1; words = 1; }
        while (k < tk.length) {
          var x = tk[k].s.toLowerCase(), y = tk[k + 1] && tk[k + 1].s.toLowerCase();
          if (x === '-' && last && y && (has(UNIT, y) || has(TEN, y))) { k++; continue; }
          if (x === 'and' && (last === 'hundred' || last === 'thousand') && y && (has(UNIT, y) || has(TEN, y))) { k++; continue; }
          if (has(UNIT, x)) {
            var u = UNIT[x];
            if (u < 10 && last === 'tens') { cur += u; last = 'tensunit'; }
            else if (last === '' || last === 'hundred' || last === 'thousand') { cur += u; last = u < 10 ? 'unit' : 'teen'; }
            else break;
          } else if (has(TEN, x)) {
            if (last === '' || last === 'hundred' || last === 'thousand') { cur += TEN[x]; last = 'tens'; } else break;
          } else if (x === 'hundred') {
            if ((last === 'unit' || last === 'teen' || last === 'tens' || last === 'tensunit') && cur >= 1 && cur < 100) { cur *= 100; last = 'hundred'; } else break;
          } else if (x === 'thousand') {
            if (last && last !== 'thousand') { total += cur * 1000; cur = 0; last = 'thousand'; } else break;
          } else break;
          end = k; words++; k++;
        }
        gs.push({ v: total + cur, i: tk[n].i, e: tk[end].e, words: words });
        n = k;
      }
      return gs;
    }
    function numberize(s) {
      var gs = groupsOf(s), out = [], j;
      for (j = 0; j < gs.length; j++) {
        var a = gs[j], b = gs[j + 1];
        if (b && /^\s*$/.test(s.slice(a.e, b.i)) && !a.dec && !b.dec && !a.comma && a.v >= 1 && a.v <= 9999 && b.v >= 10 && b.v <= 99 && (!b.digits || b.ndig === 2) && (!a.digits || a.ndig <= 4)) {
          out.push({ v: a.v + b.v / 100, i: a.i, e: b.e, cents: true }); j++;
        } else out.push(a);
      }
      var r = s;
      for (j = out.length - 1; j >= 0; j--) {
        var g = out[j];
        if (g.digits && !g.cents) continue;
        var after = s.slice(g.e), before = s.slice(0, g.i);
        if (!g.cents && g.v < 10 && !/^\s*(?:dollars?|bucks?)\b/i.test(after) && !/\$\s*$/.test(before)) continue;   // "one", "two" on their own are not money
        r = r.slice(0, g.i) + (g.cents ? g.v.toFixed(2) : String(g.v)) + r.slice(g.e);
      }
      return r;
    }
    function takeAmount(s) {
      var m, v;
      var cut = function (m0, val) { return { value: Math.round(val * 100) / 100, text: s.slice(0, m0.index) + ' ' + s.slice(m0.index + m0[0].length) }; };
      if ((m = /\$\s*(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(?:and\s+)?(\d{1,2})\s*cents?)?/i.exec(s))) return cut(m, parseFloat(m[1].replace(/,/g, '')) + (m[2] ? +m[2] / 100 : 0));
      if ((m = /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|usd)\b(?:\s*(?:and\s+)?(\d{1,2})\s*cents?)?/i.exec(s))) return cut(m, parseFloat(m[1].replace(/,/g, '')) + (m[2] ? +m[2] / 100 : 0));
      if ((m = /(\d{1,2})\s*cents?\b/i.exec(s))) return cut(m, +m[1] / 100);
      if ((m = /(^|[^\w.])(\d[\d,]*(?:\.\d{1,2})?)(?![\w])/.exec(s))) {
        v = parseFloat(m[2].replace(/,/g, ''));
        return { value: Math.round(v * 100) / 100, text: s.slice(0, m.index + m[1].length) + ' ' + s.slice(m.index + m[0].length) };
      }
      return { value: null, text: s };
    }

    /* ---- text helpers ---- */
    var SMALL = { a: 1, an: 1, and: 1, at: 1, the: 1, of: 1, for: 1, in: 1, on: 1, to: 1, or: 1 };
    function titleCase(s) {
      return String(s).split(' ').map(function (w, i) {
        if (!w || w !== w.toLowerCase()) return w;
        if (i > 0 && has(SMALL, w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');
    }
    var FILL = /^(?:(?:i|we|he|she|(?:zac|lisa)(?!['’]?s\b)|just|also|please|paid|pay|paying|spent|spend|bought|buy|purchased|got|get|received|receive|add|adding|log|record|charged|charge|put|new|expense|income|entry|an?|the|for|of|about|to|at|from|on|in|with|by|my|our|and|it|was|were|is|check|payment|deposit(?:ed)?|dollars?|bucks|usd)\b[\s,.]*)+/i;
    function tidy(s) {
      s = String(s).replace(/\b(?:dollars?|bucks|usd|cents?)\b/ig, ' ').replace(/[,;:!?"“”]+/g, ' ').replace(/\s+/g, ' ').trim();
      s = s.replace(FILL, '').replace(/\s+/g, ' ').trim().replace(/[\s.\-]+$/, '').replace(/^[\s.\-]+/, '');
      return s;
    }
    function pickCategory(s) {
      var best = '', at = 1e9;
      KWRE.forEach(function (k) { var m = k[1].exec(s); if (m && m.index < at) { at = m.index; best = k[0]; } });
      return best || 'Other';
    }

    function parse(text, kind, today) {
      var heard = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
      today = today || iso(new Date());
      var out = { heard: heard, amount: null, merchant: '', category: 'Other', account: 'Household', date: today, who: 'Zac', notes: '', source: '', client: '', method: '' };
      var w = heard, i;
      // 1. date
      var d = takeDate(w, today); w = d.text; if (d.date) out.date = d.date;
      // 2. account (garbled names included); first one heard wins
      var bestAt = 1e9;
      ACCT_SRC.forEach(function (a) { var m = new RegExp('\\b(?:' + a[1] + ')\\b', 'i').exec(w); if (m && m.index < bestAt) { bestAt = m.index; out.account = a[0]; } });
      ACCT_SRC.forEach(function (a) {
        w = w.replace(new RegExp('(?:\\b(?:from|on|for|in|to|using|via|through|out of|with)\\s+)?(?:the\\s+)?\\b(?:' + a[1] + ')\\b(?:\\s+(?:account|card|llc|checking))*', 'ig'), ' ');
      });
      // 3. amount
      var am = takeAmount(numberize(w)); w = am.text; out.amount = am.value;
      // 4. who
      var wl = w.replace(/lisa'?s\s+table/ig, ' ');
      var whoRe = /\b(?:lisa\s+(?:paid|spent|bought|got|charged)|paid\s+by\s+lisa|by\s+lisa|lisa'?s\s+(?:card|money|cash))\b/ig;
      if (kind !== 'inc') {
        if (whoRe.test(wl)) { out.who = 'Lisa'; w = w.replace(/\b(?:lisa\s+(?:paid|spent|bought|got|charged)|paid\s+by\s+lisa|by\s+lisa|lisa'?s\s+(?:card|money|cash))\b/ig, ' '); }
        else if (/\b(?:joint|together|both of us)\b/i.test(wl)) { out.who = 'Joint'; w = w.replace(/\b(?:joint|together|both of us)\b/ig, ' '); }
      }
      // 4b. payment type: the one heard EARLIEST wins; its words are dropped so the merchant / notes never end up as just "Venmo"
      var payAt = 1e9;
      PAYRX.forEach(function (px) { var pm = px[1].exec(w); if (pm && pm.index < payAt) { payAt = pm.index; out.method = px[0]; } });
      if (out.method) {
        var gone = PAYRX.filter(function (px) { return px[0] === out.method; })[0][1];
        w = w.replace(new RegExp(gone.source, 'ig'), ' ');
      }
      var rest = tidy(w);
      if (kind === 'inc') {
        var low = rest.toLowerCase(), strip = null;
        var cands = [
          ["Lisa's Table", /lisa['\u2019]?s?\s+table|\btable\b/i],
          ['Personal Training', /personal\s+training|\bpt\b|\btraining\b|\bclient\b|\bsession\b/i],
          ['Mono Village Laundromat', /mono\s+village|laundromat|laundry|\bmono\b/i],
          ['KiwiT rent', /\brent(?:al|s)?\b|tenant|mono\s+way|hatler/i],
          ['Land & Structure', /land\s*(?:and|&|n)\s*structure|\bl\s*(?:and|&)\s*s\b|paycheck|\bpay\b|payroll|salary|\bwages?\b/i]
        ];
        out.source = '';                       // none unless one clearly matches: the user taps the right one
        for (i = 0; i < cands.length && !out.source; i++) if (cands[i][1].test(low)) { out.source = cands[i][0]; strip = cands[i][1]; }
        if (!out.source && out.account === 'KiwiT') out.source = 'KiwiT rent';
        var left = strip ? tidy(rest.replace(new RegExp(strip.source, 'ig'), ' ')) : rest;
        if (out.source === 'Personal Training') {          // "... from Sarah" / "client Sarah Jones": optional client name
          var raw = rest.replace(new RegExp(strip.source, 'ig'), ' ').replace(/\s+/g, ' ').trim();
          var cm = /\b(?:from|client|with)\s+([A-Za-z][A-Za-z'\u2019-]*(?:\s+[A-Za-z][A-Za-z'\u2019-]*)?)\s*$/i.exec(raw);
          if (cm) { out.client = titleCase(cm[1].toLowerCase()).slice(0, 60); left = tidy(raw.slice(0, cm.index)); }
        }
        out.notes = left ? left.charAt(0).toUpperCase() + left.slice(1) : '';
        out.category = ''; out.who = '';
        return out;
      }
      // expense: category from the keywords, merchant from "... at <merchant>" (else what is left)
      out.category = pickCategory(rest);
      var merchant = '', desc = '', m2 = /^(.*?)\s*\b(?:at|from|to)\s+(?:the\s+)?(.+)$/i.exec(rest);
      if (m2 && m2[2]) {
        var tail = m2[2], cutAt = /\s\b(?:for|on|using|because|category|note|notes)\b\s*/i.exec(tail);
        if (cutAt) { desc = (m2[1] + ' ' + tail.slice(cutAt.index + cutAt[0].length)).trim(); tail = tail.slice(0, cutAt.index); }
        else desc = m2[1].trim();
        merchant = tail.trim();
      } else merchant = rest;
      merchant = titleCase(merchant.replace(/^(?:the|a|an)\s+/i, '')).slice(0, 120);
      desc = desc.replace(/^(?:the|a|an|for|on|using|because)\s+/i, '').replace(/\s+/g, ' ').trim();
      if (!merchant && out.category !== 'Other') merchant = out.category;
      out.merchant = merchant;
      out.notes = desc && desc.toLowerCase() !== merchant.toLowerCase() ? (desc.charAt(0).toUpperCase() + desc.slice(1)).slice(0, 300) : '';
      return out;
    }
    return { parse: parse, CATS: CATS, ACCTS: ACCTS, WHO: WHO, SOURCES: SOURCES, PAY: PAY, iso: iso, addDays: addDays };
  })();
  /*VP-END*/

  /* ---------------- Vault mic / camera (v54): #vmic/<inc|exp> dictation form, #vcam/<inc|exp> receipt photo ---------------- */
  var VSVG = {
    mic: '<svg viewBox="0 0 24 24" width="%s" height="%s" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/></svg>',
    cam: '<svg viewBox="0 0 24 24" width="%s" height="%s" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.2l1.1-1.7a1 1 0 0 1 .8-.4h5.8a1 1 0 0 1 .8.4L16.8 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><circle cx="12" cy="13" r="4"/><circle cx="12" cy="13" r="1.7"/><circle cx="17.4" cy="9.9" r=".8" fill="currentColor" stroke="none"/></svg>'
  };
  function vsvg(name, px) { return VSVG[name].replace(/%s/g, px || 20); }
  /* v61: Vault group cards (Income / Expenses / Summary): bordered, collapsible by tapping the heading; state in localStorage cc_vault_collapse. */
  var VG_KEY = 'cc_vault_collapse', vgMem = null;
  function vgMap() {
    if (!vgMem) { try { vgMem = JSON.parse(localStorage.getItem(VG_KEY) || '{}') || {}; } catch (e) { vgMem = {}; } }
    return vgMem;
  }
  function vgToggle(card) {
    var key = card.getAttribute('data-vg'), col = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', col);
    var h = card.querySelector('h2.vgrp'); if (h) h.setAttribute('aria-expanded', String(!col));
    var m = vgMap(); if (col) m[key] = 1; else delete m[key];
    try { localStorage.setItem(VG_KEY, JSON.stringify(m)); } catch (e) {}
  }
  function vgHead(cls, title, kind, tot) {      // opens a group card: title (tap = collapse) + optional mic / camera buttons; close it with vgEnd()
    var nm = kind === 'inc' ? 'income' : 'expense', col = !!vgMap()[cls];
    return '<div class="vgcard ' + cls + (col ? ' collapsed' : '') + '" data-vg="' + cls + '"><div class="vghead">' +
      '<h2 class="vgrp ' + cls + '" role="button" tabindex="0" aria-expanded="' + !col + '"><span class="vgt">' + title + '</span><i class="vgchev" aria-hidden="true">&rsaquo;</i></h2>' +
      (kind ? '<div class="vgbtns">' +
      '<button type="button" class="vgbtn" data-go="vmic/' + kind + '" aria-label="Dictate ' + nm + '" title="Dictate ' + nm + '">' + vsvg('mic') + '</button>' +
      '<button type="button" class="vgbtn" data-go="vcam/' + kind + '" aria-label="Photo of ' + nm + ' receipt" title="Receipt photo">' + vsvg('cam') + '</button></div>' : '') +
      '</div>' + (tot ? '<div class="vgtot ' + cls + '">' + tot + '</div>' : '') + '<div class="vgbody">';
  }
  function vgEnd() { return '</div></div>'; }
  $('spend-body').addEventListener('click', function (e) {
    if (e.target.closest('.vgbtns')) return;          // mic / camera buttons keep their own routes and never toggle
    var h = e.target.closest('h2.vgrp'); if (h) vgToggle(h.closest('.vgcard'));
  });
  $('spend-body').addEventListener('keydown', function (e) {
    var h = e.target.closest && e.target.closest('h2.vgrp');
    if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); vgToggle(h.closest('.vgcard')); }
  });
  function vNewCid() { return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function vToday() { return VP.iso(new Date()); }
  function vAmt(s) {        // "42.5" / "$1,250.00" -> number, or null
    var t = String(s == null ? '' : s).replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    var n = parseFloat(t);
    return n > 0 ? n : null;
  }
  function vDateOk(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return false; var d = new Date(+m[1], +m[2] - 1, +m[3], 12); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]; }
  function vOpts(list, sel) {
    var l = list.slice(); if (sel && l.indexOf(sel) < 0) l.unshift(sel);
    return l.map(function (o) { return '<option value="' + esc(o) + '"' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
  }
  function vField(label, inner, cls) { return '<label class="vfield' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span>' + inner + '</label>'; }
  function vApiMsg(j) {          // server error -> plain sentence
    if (!j || !j.error) return 'Something went wrong.';
    if (j.error === 'bad_action') return 'This needs the server update (not deployed yet). Nothing was saved.';
    if (j.error === 'busy') return 'The sheet is busy. Tap Save again in a moment (same entry, nothing doubled).';
    if (j.error === 'unknown_source') return 'That isn\u2019t one of your income sources, so nothing was saved. Tap one of the income buttons above.';
    if (j.error === 'excluded') return 'Sierra Consultants is deliberately not kept in the Command Center.';
    return j.message || ('Server error: ' + j.error);
  }
  function vDoneHtml() {        // the "Saved" card after a mic save: Add another + Delete this entry (confirm step) + Back to Vault
    var n = vm.dn; if (!n) return '';
    var gone = n.stage === 'deleted', ask = n.stage === 'ask' || n.stage === 'busy', h = '';
    h += '<h3>' + (gone ? 'Deleted' : n.head) + '</h3><div class="big ' + n.cls + (gone ? ' vgone' : '') + '">' + n.amt + '</div><div class="foot">' + esc(n.label) + '</div><div class="foot">' + esc(n.where) + ' \u00b7 ' + n.sub + '</div>';
    if (gone) h += '<div class="noteflash show">Entry deleted. A backup is kept.</div>';
    if (n.err) h += '<div class="noteflash show bad">' + esc(n.err) + '</div>';
    if (ask) {
      h += '<div class="foot vdelq">Delete this entry? A backup is kept.</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" id="vf-del-yes"' + (n.stage === 'busy' ? ' disabled' : '') + '>' + (n.stage === 'busy' ? 'Deleting\u2026' : 'Yes, delete') + '</button><button type="button" class="navbtn" id="vf-del-no"' + (n.stage === 'busy' ? ' disabled' : '') + '>Keep it</button></div>';
    } else {
      h += '<div class="draftbtns"><button type="button" class="bigsave" id="vf-again">Add another</button>' +
        (n.ent && !gone ? '<button type="button" class="navbtn vdelbtn" id="vf-del">Delete this entry</button>' : '') + '</div>' +
        '<div class="draftbtns vback"><button type="button" class="navbtn" data-go="spend">Back to Vault</button></div>';
    }
    return h;
  }
  function vDoneDel(act) {
    var n = vm.dn; if (!n || !n.ent || n.stage === 'busy') return;
    if (act === 'ask') { n.stage = 'ask'; n.err = ''; }
    else if (act === '') { n.stage = ''; n.err = ''; }
    else if (act === 'go') {
      n.stage = 'busy'; n.err = '';
      vm.done = vDoneHtml(); vFormRender('');
      return vDelRun(n.ent).then(function (res) {
        if (vm.dn !== n) return;
        if (res.auth) return;
        if (res.ok) { n.stage = 'deleted'; n.ent = null; } else { n.stage = 'ask'; n.err = res.err; }
        vm.done = vDoneHtml(); vFormRender('');
      });
    }
    vm.done = vDoneHtml(); vFormRender('');
  }
  function vAuth(err) { if (err instanceof AuthError) { setPc(''); lock('Passcode changed. Enter the new one.'); return true; } return false; }
  // POST (JSON body as text/plain so the browser sends no CORS preflight; Apps Script answers 302 and fetch follows it).
  function apiPostRaw(action, body, timeoutMs) {
    var ctl = window.AbortController ? new AbortController() : null, timer = 0, payload = { pc: getPc(), action: action };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    if (ctl) timer = setTimeout(function () { ctl.abort(); }, timeoutMs || 90000);
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload),
      cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error('Server returned ' + r.status); return r.text(); })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (e) { throw new Error('Unexpected response from server (the upload may or may not have arrived: tap Save again, it will not double).'); }
        if (j.error === 'auth') throw new AuthError();
        if (j.error === 'locked') throw new Error('Too many wrong passcodes. Try again in 10 minutes.');
        return j;
      }, function (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') throw new Error('The upload timed out. It may still have arrived: tap Save again (same entry id, so it will not double).');
        throw err;
      });
  }
  function vMsg(id, text, bad) { var el = $(id); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash show' + (bad ? ' bad' : ''); if (!text) el.className = 'noteflash'; }

  /* ---- #vmic: dictate -> parse -> editable form -> Save (spendadd / incomeadd) ---- */
  var vm = { kind: 'exp', rec: null, on: false, base: '', committed: '', interim: '', msg: '', busy: false, draft: null, done: null, dn: null };
  function vdKey(k) { return 'cc_vdraft_' + k; }
  function vdLoad(k) {
    try { var d = JSON.parse(localStorage.getItem(vdKey(k)) || 'null'); if (d && d.cid && d.f && Date.now() - (d.at || 0) < 12 * 3600 * 1000) {
        if (k === 'inc') { if (VP.SOURCES.indexOf(d.f.source) < 0) d.f.source = ''; d.f.client = d.f.client || ''; delete d.f.sourceText; }   // older drafts: 'Other' / free-text source no longer exist
        if (VP.PAY.indexOf(d.f.method) < 0) d.f.method = '';          // drafts from before the payment type existed
        return d;
      }
    } catch (e) {}
    return null;
  }
  function vdSave() { try { if (vm.draft) { vm.draft.at = Date.now(); localStorage.setItem(vdKey(vm.kind), JSON.stringify(vm.draft)); } } catch (e) {} }
  function vdClear(k) { try { localStorage.removeItem(vdKey(k)); } catch (e) {} }
  function vFrom(p, kind) {        // parser output -> form values (strings)
    var amt = p.amount != null ? p.amount.toFixed(2) : '';
    if (kind === 'inc') return { source: p.source || '', client: p.client || '', amount: amt, date: p.date, notes: p.notes || '', method: p.method || '' };
    return { amount: amt, merchant: p.merchant || '', category: p.category, account: p.account, date: p.date, who: p.who || 'Zac', notes: p.notes || '', method: p.method || '' };
  }
  function openVmic(kind) {
    vmicStop(true);
    vm.kind = kind; vm.msg = ''; vm.done = null;
    $('vmic-title').textContent = 'Vault \u00b7 Dictate ' + (kind === 'inc' ? 'income' : 'an expense');
    $('vmic-text').setAttribute('placeholder', kind === 'inc' ? 'e.g. \u201cgot a three thousand dollar rent check\u201d. Speak it, type it, or use the keyboard\u2019s mic key.' : 'e.g. \u201c$7 bagel at the Bagel Bin\u201d or \u201c48 dollars beer at the taproom\u201d. Speak it, type it, or use the keyboard\u2019s mic key.');
    vm.draft = vdLoad(kind);
    $('vmic-text').value = vm.draft ? (vm.draft.text || '') : '';
    vmicUi(); vFormRender(vm.draft ? 'Restored your unsaved entry. Nothing is written until you tap Save.' : '');
  }
  function vmicUi() {
    var btn = $('vmic-btn'); if (!btn) return;
    var on = vm.on, has = !!$('vmic-text').value.trim();
    btn.classList.toggle('rec', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', on ? 'Stop dictation' : 'Start dictation');
    $('vmic-lbl').textContent = on ? 'Listening\u2026 tap to stop' : (has ? 'Tap to add more' : 'Tap to talk');
    var st = $('vmic-state'); st.className = 'micstate' + (on ? ' rec' : '') + (vm.msg && !on ? ' warn' : '');
    st.textContent = on ? 'Listening\u2026' : (vm.msg || 'Say it in one breath: amount, what, where' + (vm.kind === 'exp' ? ', which account' : '') + '. You review before anything is saved.');
    $('vmic-rec').hidden = !on;
    $('vmic-card').classList.toggle('live', on);
  }
  function vmicFail(msg) { vm.on = false; var r = vm.rec; vm.rec = null; try { r && r.abort(); } catch (e) {} vm.msg = msg; vmicUi(); var ta = $('vmic-text'); if (ta) ta.focus(); }
  function vmicStart() {
    var ta = $('vmic-text');
    if (!SR) { vm.msg = MIC_NA; vmicUi(); ta.focus(); return; }
    vm.msg = ''; vm.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; vm.committed = ''; vm.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return vmicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) vm.committed = micSpace(vm.committed, t.trim() + ' '); else interim += t;
      }
      vm.interim = interim.replace(/^\s+/, ''); ta.value = vm.base + vm.committed + vm.interim; ta.scrollTop = ta.scrollHeight;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return vmicFail(MIC_NA);
      if (e === 'network') return vmicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') vm.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (vm.rec !== rec) return;                        // aborted / screen left
      vm.committed = micSpace(vm.committed, vm.interim ? vm.interim.trim() + ' ' : ''); vm.interim = '';
      vm.on = false; vm.rec = null;
      ta.value = (vm.base + vm.committed).replace(/\s+$/, '');
      if (ta.value.trim()) vFill(); else vmicUi();
    };
    vm.rec = rec; vm.on = true;
    try { rec.start(); } catch (e2) { return vmicFail(MIC_NA); }
    vmicUi();
  }
  function vmicStop(quiet) {           // quiet = abort without filling the form (leaving the screen); otherwise stop() and onend fills it
    var r = vm.rec;
    if (quiet) { vm.rec = null; vm.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { vm.rec = null; vm.on = false; vmicUi(); } }
  }
  function vFill() {          // parse the text box -> a NEW draft (fresh cid) -> form
    var text = $('vmic-text').value, p = VP.parse(text, vm.kind, vToday());
    vm.draft = { cid: vNewCid(), kind: vm.kind, text: text, f: vFrom(p, vm.kind), tried: false, at: Date.now() };
    vm.done = null; vdSave(); vmicUi();
    vFormRender(text.trim() ? '' : 'Blank form. Fill it in by hand, then Save.');
  }
  function vPayHtml(f) {        // optional "Payment type" chips; tap the chosen one again to clear it
    return '<div class="vfield"><span>Payment type (optional)</span><div class="vchips vpays" id="vf-pay" role="group" aria-label="Payment type">' +
      VP.PAY.map(function (n) { var on = f.method === n; return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-vpay="' + esc(n) + '" aria-pressed="' + on + '">' + esc(n) + '</button>'; }).join('') + '</div></div>';
  }
  function vPayServer(n) { return n === 'Credit card' ? 'Credit' : n; }
  function vFormRender(note) {
    var card = $('vmic-form'), d = vm.draft;
    if (vm.done) { card.hidden = false; card.className = 'card vform vdone'; card.innerHTML = vm.done; return; }
    if (!d) { card.hidden = true; card.innerHTML = ''; return; }
    var f = d.f, inc = vm.kind === 'inc', h = '';
    h += '<h3>' + (inc ? 'New income' : 'New expense') + ' <small>review and edit, then Save</small></h3>';
    if (inc) {
      h += '<div class="vfield"><span>Which income is this?</span><div class="vchips" id="vf-chips" role="group" aria-label="Income source">' +
        VP.SOURCES.map(function (n) {
          var on = f.source === n;
          return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-vsrc="' + esc(n) + '" aria-pressed="' + on + '">' + esc(n) + '</button>';
        }).join('') + '</div></div>';
      h += vField('Client (optional)', '<input id="vf-client" type="text" maxlength="60" autocomplete="off" value="' + esc(f.client || '') + '" placeholder="Leave blank for Personal Training">', 'vclient' + (f.source === 'Personal Training' ? '' : ' off'));
      h += '<div class="vrow2">' + vField('Amount', '<input id="vf-amount" type="text" inputmode="decimal" autocomplete="off" value="' + esc(f.amount) + '" placeholder="0.00">') +
        vField('Date', '<input id="vf-date" type="date" value="' + esc(f.date) + '">') + '</div>';
      h += vPayHtml(f);
      h += vField('Notes', '<textarea id="vf-notes" rows="2" maxlength="300">' + esc(f.notes) + '</textarea>');
    } else {
      h += '<div class="vrow2">' + vField('Amount', '<input id="vf-amount" type="text" inputmode="decimal" autocomplete="off" value="' + esc(f.amount) + '" placeholder="0.00">') +
        vField('Date', '<input id="vf-date" type="date" value="' + esc(f.date) + '">') + '</div>';
      h += vField('Merchant', '<input id="vf-merchant" type="text" maxlength="120" autocomplete="off" value="' + esc(f.merchant) + '" placeholder="Where / what">');
      h += '<div class="vrow2">' + vField('Category', '<select id="vf-cat">' + vOpts(VP.CATS, f.category) + '</select>') +
        vField('Account', '<select id="vf-acct">' + vOpts(VP.ACCTS, f.account) + '</select>') + '</div>';
      h += vField('Paid by', '<select id="vf-who">' + vOpts(VP.WHO, f.who) + '</select>');
      h += vPayHtml(f);
      h += vField('Notes', '<textarea id="vf-notes" rows="2" maxlength="300">' + esc(f.notes) + '</textarea>');
    }
    h += '<div class="draftbtns"><button type="button" class="bigsave" id="vf-save">' + (inc ? 'Save income' : 'Save expense') + '</button><button type="button" class="navbtn discard" id="vf-discard">Discard</button></div>';
    h += '<div class="noteflash" id="vf-msg" hidden></div>';
    card.hidden = false; card.className = 'card vform'; card.innerHTML = h;
    if (note) vMsg('vf-msg', note, false);
  }
  function vRead() {            // form -> draft.f (and persist)
    var d = vm.draft; if (!d) return;
    var g = function (id) { var el = $(id); return el ? el.value : null; }, f = d.f, v;
    if ((v = g('vf-amount')) != null) f.amount = v;
    if ((v = g('vf-date')) != null) f.date = v;
    if ((v = g('vf-notes')) != null) f.notes = v;
    if (vm.kind === 'inc') { if ((v = g('vf-client')) != null) f.client = v; }
    else { if ((v = g('vf-merchant')) != null) f.merchant = v; if ((v = g('vf-cat')) != null) f.category = v; if ((v = g('vf-acct')) != null) f.account = v; if ((v = g('vf-who')) != null) f.who = v; }
    vdSave();
  }
  function vSaveParams() {      // -> { action, params } or { error }
    var d = vm.draft, f = d.f, amt = vAmt(f.amount);
    if (amt === null) return { error: 'Enter an amount like 42.50.' };
    if (!vDateOk(f.date)) return { error: 'Pick a valid date.' };
    if (vm.kind === 'inc') {
      var src = f.source;
      if (VP.SOURCES.indexOf(src) < 0) return { error: 'Tap which income this is.' };
      var p, label = src, client = String(f.client || '').trim().slice(0, 60);
      if (src === 'Land & Structure') p = { tab: 'ls', description: 'Land & Structure pay' };
      else if (src === 'Personal Training') { label = client || 'Personal Training'; p = { tab: 'pt', source: label, client: label }; }
      else p = { tab: 'income', source: src };
      p.date = f.date; p.amount = amt.toFixed(2); p.notes = String(f.notes || '').trim(); p.cid = d.cid; p.strict = '1';
      if (f.method) p.method = vPayServer(f.method);
      return { action: 'incomeadd', params: p, amt: amt, label: label };
    }
    var m = String(f.merchant || '').trim();
    if (!m) return { error: 'Enter the merchant or what it was for.' };
    var sp = { date: f.date, amount: amt.toFixed(2), merchant: m, category: f.category, account: f.account, who: f.who, notes: String(f.notes || '').trim(), cid: d.cid };
    if (f.method) sp.method = vPayServer(f.method);
    return { action: 'spendadd', params: sp, amt: amt, label: m };
  }
  function vSave() {
    var d = vm.draft; if (!d || vm.busy) return;
    vRead();
    var s = vSaveParams();
    if (s.error) return vMsg('vf-msg', s.error, true);
    vm.busy = true; d.tried = true; vdSave();
    var btn = $('vf-save'); btn.disabled = true; btn.textContent = 'Saving\u2026'; vMsg('vf-msg', '', false);
    apiRaw(s.action, s.params).then(function (j) {
      vm.busy = false;
      if (j.error) {
        btn.disabled = false; btn.textContent = vm.kind === 'inc' ? 'Save income' : 'Save expense';
        if (j.error === 'bad_value' && d.f.method && /method/i.test(String(j.message || ''))) {      // an older server only knows Cash / Debit / Credit / ACH/Transfer / Other
          return vMsg('vf-msg', 'The server does not accept \u201c' + d.f.method + '\u201d as a payment type yet (it needs the server update). Nothing was saved and your entry is kept: pick another payment type or tap the chosen one to clear it, then Save again.', true);
        }
        return vMsg('vf-msg', vApiMsg(j), true);
      }
      var r = j.data || {}, where = (vm.kind === 'inc' ? (r.tab || 'Income') : 'Daily Spend') + (r.row ? ' \u00b7 row ' + r.row : '');
      var head = r.duplicate === 'cid' ? 'Already saved earlier' : r.duplicate === 'row' ? 'Already in the sheet' : 'Saved';
      var payTxt = '';
      if (d.f.method && !r.duplicate) payTxt = ' \u00b7 ' + esc(d.f.method) + (r.method ? '' : ' (payment type not saved: that sheet has no Method column)');
      var sub = r.duplicate ? 'Nothing was added again.' : (vm.kind === 'exp' ? esc(d.f.category) + ' \u00b7 ' + esc(d.f.account) + ' \u00b7 ' : '') + esc(d.f.date) + payTxt;
      var ent = null, rowN = vRowNum(r.row);
      if (rowN) {                // Delete needs the sheet row from the save result (data.row) and, for income, the tab (data.tab)
        ent = vm.kind === 'inc'
          ? { kind: 'inc', tab: vTabNorm(r.tab) || s.params.tab, row: rowN, date: d.f.date, amount: s.amt, label: s.label, cid: d.cid }
          : { kind: 'exp', row: rowN, date: d.f.date, amount: s.amt, label: s.label, cid: d.cid };
      }
      vm.dn = { head: head, amt: money(s.amt), cls: vm.kind === 'inc' ? 'amt-in' : 'amt-out', label: s.label, where: where, sub: sub, ent: ent, stage: '', err: '' };
      vm.done = vDoneHtml();
      vdClear(vm.kind); vm.draft = null; state.spendData = null; vFormRender('');
    }, function (err) {
      vm.busy = false;
      if (vAuth(err)) return;
      btn.disabled = false; btn.textContent = vm.kind === 'inc' ? 'Save income' : 'Save expense';
      vMsg('vf-msg', friendly(err) + ' Nothing is confirmed yet: tap Save again to retry (same entry id, it will not double).', true);
    });
  }
  $('vmic-btn').addEventListener('click', function () { if (vm.on) vmicStop(); else vmicStart(); });
  $('vmic-fill').addEventListener('click', function () { vmicStop(true); vmicUi(); vFill(); });
  $('vmic-clear').addEventListener('click', function () {
    vmicStop(true); $('vmic-text').value = ''; vm.msg = ''; vm.draft = null; vm.done = null; vdClear(vm.kind); vmicUi(); vFormRender('');
  });
  $('vmic-text').addEventListener('input', function () { if (vm.draft) { vm.draft.text = this.value; vdSave(); } vmicUi(); });
  $('vmic-form').addEventListener('input', function () { vRead(); });
  $('vmic-form').addEventListener('change', function () { vRead(); });
  $('vmic-form').addEventListener('click', function (e) {
    var pay = e.target.closest('[data-vpay]');
    if (pay && vm.draft) {            // payment type: tap to choose, tap the chosen one again to clear
      vRead(); var pn = pay.getAttribute('data-vpay'); vm.draft.f.method = vm.draft.f.method === pn ? '' : pn; vdSave();
      [].forEach.call($('vmic-form').querySelectorAll('[data-vpay]'), function (b) { var on = b.getAttribute('data-vpay') === vm.draft.f.method; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      vMsg('vf-msg', '', false);
      return;
    }
    var chip = e.target.closest('#vf-chips .vchip');
    if (chip && vm.draft && vm.kind === 'inc') {            // pick one of the existing income sources
      vRead(); vm.draft.f.source = chip.getAttribute('data-vsrc'); vdSave();
      [].forEach.call($('vf-chips').querySelectorAll('.vchip'), function (b) { var on = b === chip; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      var cw = $('vmic-form').querySelector('.vclient'); if (cw) cw.classList.toggle('off', vm.draft.f.source !== 'Personal Training');
      vMsg('vf-msg', '', false);
      return;
    }
    if (e.target.closest('#vf-del')) return vDoneDel('ask');
    if (e.target.closest('#vf-del-no')) return vDoneDel('');
    if (e.target.closest('#vf-del-yes')) return vDoneDel('go');
    if (e.target.closest('#vf-save')) return vSave();
    if (e.target.closest('#vf-discard')) { vm.draft = null; vdClear(vm.kind); $('vmic-text').value = ''; vmicUi(); return vFormRender(''); }
    if (e.target.closest('#vf-again')) { vm.done = null; vm.draft = null; $('vmic-text').value = ''; vmicUi(); vFormRender(''); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && vm.on) vmicStop(true); });

  /* ---------------- Lisa's Table: Wish List (#lt/wish): dictate -> itemized editable list -> Save (wishadd) + saved list (wishlist / wishset / wishdel) ---------------- */
  var WL_DRAFT_KEY = 'cc_wdraft', WL_BY_KEY = 'cc_wish_by';
  var wl = { rec: null, on: false, base: '', committed: '', interim: '', msg: '', items: [], cid: '', sig: '', text: '', by: 'Lisa', busy: false,
    list: null, loading: false, listErr: '', doneOpen: false, confirmId: '', pending: {}, flash: '', flashBad: false, seq: 0 };
  var WL_PROTECT = /\b(mac and cheese|mac n cheese|fish and chips|bread and butter|peanut butter and jelly|surf and turf|rice and beans|black and white|salt and vinegar|half and half|rock and roll|sweet and sour|hot and sour|cookies and cream|pots and pans|bed bath and beyond)\b/gi;
  var WL_VERB = /^(?:get|grab|buy|order|add|put|bring|find|try|make|fix|call|pick|cook|book|schedule|clean|send|take|check|replace|install|repair|build|wash|organi[sz]e|plan|ask|look|set|move|print|write)\b/i;
  var WL_FILLERS = [
    /^(?:and|but|so|also|then|next|plus|ok(?:ay)?|um+|uh+|er+|hey|oh|yeah|yes|well|alright|right)\b[\s,.:;-]*/i,
    /^(?:please|kindly)\b[\s,.:;-]*/i,
    /^(?:can|could|would|will|should)\s+(?:you|we|i|someone|somebody)\s+(?:please\s+|also\s+|just\s+)?/i,
    /^(?:i|we)(?:'d|\u2019d|\s+would)\s+(?:really\s+|also\s+)?(?:like|love|want|need)(?:\s+to)?\s+/i,
    /^(?:i|we)\s+(?:really\s+|also\s+|just\s+)?(?:want|need|wish|would\s+like|would\s+love|like)(?:\s+to)?\s+/i,
    /^(?:(?:i|we)\s+(?:are|am)|we(?:'|\u2019)re|i(?:'|\u2019)m)\s+(?:out\s+of|low\s+on|running\s+low\s+on|running\s+out\s+of)\s+/i,
    /^(?:i|we)\s+(?:also\s+)?(?:wish|hope)\s+(?:we\s+had|we\s+could\s+get|for)\s+/i,
    /^(?:to\s+)?(?:please\s+)?(?:get|grab|buy|add|order|pick\s+up)\s+(?:me\s+|us\s+)?(?:some\s+more\s+|more\s+)?/i,
    /^(?:to|that|just|maybe|also)\s+/i
  ];
  var WL_JUNK = /^(?:i|we|me|us|it|that|this|thanks|thank you|that'?s (?:it|all)|that is (?:it|all)|done|okay|ok|and|also|then|please|the end|nothing else|um+|uh+|yes|no)$/i;
  function wlCap(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function wlClean(s) {            // strip leading fillers / trailing "to the list" and punctuation; '' when nothing is left
    s = String(s || '').replace(/\s+/g, ' ').trim();
    for (var n = 0; n < 8; n++) {
      var before = s;
      WL_FILLERS.forEach(function (re) { s = s.replace(re, ''); });
      if (s === before) break;
    }
    s = s.replace(/\s+(?:to|on|onto|in|into)\s+(?:the\s+|my\s+|our\s+)?(?:wish\s*)?list\s*$/i, '').replace(/[\s,.;:!?]+$/, '').replace(/^[\s,.;:!?-]+/, '').replace(/\s+please$/i, '').trim();
    return WL_JUNK.test(s) ? '' : s;
  }
  function wlAndSplit(piece) {      // "eggs and milk" -> two items, but only when both sides clearly are separate things
    var prot = [], t = piece.replace(WL_PROTECT, function (m) { prot.push(m); return '\u0001' + (prot.length - 1) + '\u0001'; });
    if (!/\s+and\s+/i.test(t)) return [piece];
    var parts = t.split(/\s+and\s+/i).map(function (p) { return wlClean(p); });       // "get eggs and get milk": the leading get/buy/add is a filler, not a verb to compare
    var verbs = 0, bad = false;
    parts.forEach(function (p) { if (!p) bad = true; if (p.split(/\s+/).length > 8) bad = true; if (WL_VERB.test(p)) verbs++; });
    if (bad || (verbs !== 0 && verbs !== parts.length)) return [piece];
    return parts.map(function (p) { return p.replace(/\u0001(\d+)\u0001/g, function (m, i) { return prot[+i]; }); });
  }
  function wlSplit(text) {          // dictated sentence(s) -> array of capitalized item strings
    var t = String(text || '').replace(/\b(i|we|i'd|we'd)\s+also\s+(?=want|need|like|love|would|wish)/gi, '$1 ').replace(/\r/g, '\n').replace(/\n+/g, ';').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    var sep = /\s*(?:;+|[.!?]+(?:\s+|$)|,\s*(?:and\s+(?:also\s+)?)?|\band\s+also\b|\balso\b|\bthen\b|\bnext\b|\bplus\b|\band\s+(?=(?:i|we)\s+(?:also\s+)?(?:want|need|would|'d)\b)|\band\s+(?=(?:please|can you|could you)\b))\s*/i;
    var out = [], seen = {};
    t.split(sep).forEach(function (raw) {
      var c = wlClean(raw); if (!c) return;
      wlAndSplit(c).forEach(function (p) {
        p = wlClean(p); if (!p) return;
        p = wlCap(p.slice(0, 200)); var k = p.toLowerCase();
        if (!seen[k]) { seen[k] = 1; out.push(p); }
      });
    });
    return out;
  }
  function wlGather() {             // rows -> trimmed, capitalized, de-duplicated, non-empty
    var out = [], seen = {};
    wl.items.forEach(function (s) { s = wlCap(String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200)); var k = s.toLowerCase(); if (s && !seen[k]) { seen[k] = 1; out.push(s); } });
    return out;
  }
  function wlDraftSave() {
    try {
      var has = wl.items.some(function (s) { return String(s).trim(); }) || String(wl.text || '').trim();
      if (!has) { localStorage.removeItem(WL_DRAFT_KEY); wl.cid = ''; wl.sig = ''; return; }
      if (!wl.cid) wl.cid = vNewCid();
      localStorage.setItem(WL_DRAFT_KEY, JSON.stringify({ cid: wl.cid, sig: wl.sig, items: wl.items, text: wl.text, at: Date.now() }));
    } catch (e) {}
  }
  function wlDraftLoad() {
    wl.items = []; wl.text = ''; wl.cid = ''; wl.sig = '';
    try {
      var d = JSON.parse(localStorage.getItem(WL_DRAFT_KEY) || 'null');
      if (d && d.cid && Date.now() - (d.at || 0) < 12 * 3600 * 1000 && (Array.isArray(d.items) || d.text)) {
        wl.cid = String(d.cid); wl.sig = String(d.sig || ''); wl.items = (d.items || []).map(String); wl.text = String(d.text || '');
        return true;
      }
    } catch (e) {}
    return false;
  }
  function wlApiMsg(j) {
    if (!j || !j.error) return 'Something went wrong.';
    if (j.error === 'bad_action') return 'This feature is turning on, try again in a minute.';
    return j.message || ('Server error: ' + j.error);
  }
  function wlFlash(text, bad) { wl.flash = text || ''; wl.flashBad = !!bad; var el = $('wl-flash'); if (el) { el.textContent = wl.flash; el.hidden = !wl.flash; el.className = 'noteflash' + (wl.flash ? ' show' : '') + (bad ? ' bad' : ''); } }
  function wlMsg(text, bad) { var el = $('wl-msg'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }

  function openWish() {
    wlMicStop(true);
    try { var b = localStorage.getItem(WL_BY_KEY); wl.by = b === 'Zac' ? 'Zac' : 'Lisa'; } catch (e) { wl.by = 'Lisa'; }
    var restored = wlDraftLoad();
    wl.msg = ''; wl.busy = false; wl.confirmId = ''; wl.flash = '';
    $('lt-body').innerHTML =
      '<div class="wl">' +
      '<div class="micstage"><div class="micstate" id="wl-state">&nbsp;</div>' +
      '<button type="button" class="micbtn big" id="wl-btn" data-wl="mic" aria-pressed="false" aria-label="Start dictation"><span class="micico" aria-hidden="true">' + vsvg('mic', 72) + '</span><span class="miclbl" id="wl-lbl">Tap to talk</span></button></div>' +
      '<div class="card draft" id="wl-card"><h3>What I heard <span class="rec-tag" id="wl-rec" hidden>&#9679; Listening</span></h3>' +
      '<textarea id="wl-text" class="notebox" rows="3" maxlength="1200" autocapitalize="sentences" placeholder="e.g. \u201cI want a new cutting board, and also a set of sharp knives, then a bigger pot\u201d. Speak it, type it, or use the keyboard\u2019s mic key."></textarea>' +
      '<div class="draftbtns"><button type="button" class="navbtn" data-wl="make">Make the list</button><button type="button" class="navbtn discard" data-wl="clear">Clear</button></div></div>' +
      '<div class="card vform" id="wl-form"></div>' +
      '<div id="wl-saved"></div></div>';
    $('wl-text').value = wl.text;
    wlUi(); wlFormRender(restored && (wl.items.length || wl.text) ? 'Restored your unsaved wishes. Nothing is added until you tap Add to wish list.' : '');
    wlListRender();
    if (!wl.list || Date.now() - wl.listAt > 30000) wlLoadList(); 
  }
  function wlUi() {
    var btn = $('wl-btn'); if (!btn) return;
    var on = wl.on, has = !!$('wl-text').value.trim();
    btn.classList.toggle('rec', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', on ? 'Stop dictation' : 'Start dictation');
    $('wl-lbl').textContent = on ? 'Listening\u2026 tap to stop' : (has ? 'Tap to add more' : 'Tap to talk');
    var st = $('wl-state'); st.className = 'micstate' + (on ? ' rec' : '') + (wl.msg && !on ? ' warn' : '');
    st.textContent = on ? 'Listening\u2026' : (wl.msg || 'Say what you\u2019d like, as many things as you want. You review the list before anything is saved.');
    $('wl-rec').hidden = !on;
    $('wl-card').classList.toggle('live', on);
  }
  function wlMicFail(msg) { wl.on = false; var r = wl.rec; wl.rec = null; try { r && r.abort(); } catch (e) {} wl.msg = msg; wlUi(); var ta = $('wl-text'); if (ta) ta.focus(); }
  function wlMicStart() {
    var ta = $('wl-text');
    if (!SR) { wl.msg = MIC_NA; wlUi(); ta.focus(); return; }
    wl.msg = ''; wl.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; wl.committed = ''; wl.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return wlMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) wl.committed = micSpace(wl.committed, t.trim() + ' '); else interim += t;
      }
      wl.interim = interim.replace(/^\s+/, ''); ta.value = wl.base + wl.committed + wl.interim; ta.scrollTop = ta.scrollHeight;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return wlMicFail(MIC_NA);
      if (e === 'network') return wlMicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') wl.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (wl.rec !== rec) return;                        // aborted / screen left
      wl.committed = micSpace(wl.committed, wl.interim ? wl.interim.trim() + ' ' : ''); wl.interim = '';
      wl.on = false; wl.rec = null;
      ta.value = (wl.base + wl.committed).replace(/\s+$/, ''); wl.text = ta.value;
      if (ta.value.trim()) wlFill(); else wlUi();
    };
    wl.rec = rec; wl.on = true;
    try { rec.start(); } catch (e2) { return wlMicFail(MIC_NA); }
    wlUi();
  }
  function wlMicStop(quiet) {         // quiet = abort without filling the list (leaving the screen); otherwise stop() and onend fills it
    var r = wl.rec;
    if (quiet) { wl.rec = null; wl.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { wl.rec = null; wl.on = false; wlUi(); } }
  }
  function wlFill() {                // text box -> rows appended to the draft list; the box is emptied so the same words are never added twice
    var ta = $('wl-text'), add = wlSplit(ta.value), have = {};
    wl.items.forEach(function (s) { have[String(s).trim().toLowerCase()] = 1; });
    var n = 0;
    add.forEach(function (s) { if (!have[s.toLowerCase()]) { have[s.toLowerCase()] = 1; wl.items.push(s); n++; } });
    if (add.length) { ta.value = ''; wl.text = ''; }
    wlDraftSave(); wlUi();
    wlFormRender(add.length ? (n < add.length ? 'Added ' + n + ' (the rest were already in your list). Edit anything, then tap Add to wish list.' : 'Here\u2019s your list. Edit anything, then tap Add to wish list.') : 'Nothing to add yet. Type or say what you\u2019d like.');
  }
  function wlFormRender(note) {
    var card = $('wl-form'); if (!card) return;
    var h = '<h3>New wishes <small>review and edit, then add</small></h3>';
    h += '<div class="vfield"><span>Who is adding?</span><div class="vchips" role="group" aria-label="Who is adding">' +
      ['Lisa', 'Zac'].map(function (n) { var on = wl.by === n; return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-wl="by" data-by="' + n + '" aria-pressed="' + on + '">' + n + '</button>'; }).join('') + '</div></div>';
    h += '<div class="wlrows" id="wl-rows">';
    if (!wl.items.length) h += '<div class="foot empty" id="wl-empty">Nothing yet. Tap the mic above, or tap Add item.</div>';
    wl.items.forEach(function (s, i) {
      h += '<div class="wlrow"><input class="wlin" type="text" maxlength="200" autocomplete="off" autocapitalize="sentences" data-i="' + i + '" value="' + esc(s) + '" aria-label="Wish ' + (i + 1) + '">' +
        '<button type="button" class="wlx" data-wl="rm" data-i="' + i + '" aria-label="Remove this item" title="Remove">\u00d7</button></div>';
    });
    h += '</div><button type="button" class="navbtn wladd" data-wl="add">+ Add item</button>';
    h += '<div class="draftbtns"><button type="button" class="bigsave" data-wl="save" id="wl-save"' + (wl.busy ? ' disabled' : '') + '>' + (wl.busy ? 'Saving\u2026' : 'Add to wish list') + '</button><button type="button" class="navbtn discard" data-wl="discard">Discard</button></div>';
    h += '<div class="noteflash" id="wl-msg" hidden></div>';
    card.innerHTML = h;
    if (note) wlMsg(note, false);
  }
  function wlSave() {
    if (wl.busy) return;
    var items = wlGather();
    if (!items.length) return wlMsg('Add at least one item first.', true);
    var sig = JSON.stringify([items, wl.by]);
    if (wl.sig && wl.sig !== sig) wl.cid = vNewCid();       // edited since a previous try: new entry id; unchanged retries keep the same id so they never double
    if (!wl.cid) wl.cid = vNewCid();
    wl.sig = sig; wlDraftSave();
    var cid = wl.cid, by = wl.by;
    wl.busy = true; var btn = $('wl-save'); btn.disabled = true; btn.textContent = 'Saving\u2026'; wlMsg('', false);
    apiRaw('wishadd', { items: JSON.stringify(items), by: by, cid: cid }).then(function (j) {
      wl.busy = false;
      if (j.error) { var b = $('wl-save'); if (b) { b.disabled = false; b.textContent = 'Add to wish list'; } return wlMsg(wlApiMsg(j), true); }
      var r = j.data || {}, added = r.added || [], skipped = r.skipped || [];
      var nm = function (x) { return x && typeof x === 'object' ? (x.item || x.name || '') : String(x == null ? '' : x); };
      var msg = 'Added ' + added.length + ' to the wish list.';
      if (skipped.length) msg += ' Already on the list: ' + skipped.map(nm).filter(Boolean).join(', ') + '.';
      wl.items = []; wl.text = ''; wl.cid = ''; wl.sig = ''; wlDraftSave();
      var ta = $('wl-text'); if (ta) ta.value = '';
      wlUi(); wlFormRender(''); wlMsg(msg, false);
      wlLoadList();
    }, function (err) {
      wl.busy = false;
      if (vAuth(err)) return;
      var b = $('wl-save'); if (b) { b.disabled = false; b.textContent = 'Add to wish list'; }
      wlMsg(friendly(err) + ' Nothing is confirmed yet: tap Add to wish list again to retry (same entry id, it will not double).', true);
    });
  }
  function wlDate(s) {
    var t = String(s || ''); if (!t) return '';
    var d = /^\d{4}-\d{2}-\d{2}/.test(t) ? new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), 12) : new Date(t);
    return isNaN(d.getTime()) ? t : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function wlRowHtml(x) {
    var id = String(x.id), done = x.status === 'done', busy = !!wl.pending[id];
    var meta = (x.by ? esc(x.by) : '') + (done ? (x.doneOn ? ' \u00b7 done ' + esc(wlDate(x.doneOn)) : '') : (x.added ? (x.by ? ' \u00b7 ' : '') + esc(wlDate(x.added)) : ''));
    var h = '<div class="wlitem' + (done ? ' isdone' : '') + '" data-id="' + esc(id) + '"><div class="wlmain">' +
      '<button type="button" class="wlchk' + (done ? ' on' : '') + '" data-wl="chk" data-id="' + esc(id) + '"' + (busy ? ' disabled' : '') + ' aria-label="' + (done ? 'Mark as not done' : 'Mark as done') + '" aria-pressed="' + done + '">' + (done ? '\u2713' : '') + '</button>' +
      '<div class="wltxt"><span class="wlname">' + esc(x.item) + '</span>' + (x.notes ? '<small class="wlnotes">' + esc(x.notes) + '</small>' : '') + (meta ? '<small class="wlmeta">' + meta + '</small>' : '') + '</div>' +
      '<button type="button" class="wlx" data-wl="del" data-id="' + esc(id) + '"' + (busy ? ' disabled' : '') + ' aria-label="Delete this wish" title="Delete">\u00d7</button></div>';
    if (wl.confirmId === id) h += '<div class="wlconf"><div class="vdelq">Delete this wish?</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" data-wl="delyes" data-id="' + esc(id) + '"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Deleting\u2026' : 'Yes, delete') + '</button><button type="button" class="navbtn" data-wl="delno"' + (busy ? ' disabled' : '') + '>Keep it</button></div></div>';
    return h + '</div>';
  }
  function wlListRender() {
    var box = $('wl-saved'); if (!box) return;
    var items = (wl.list || []), open = items.filter(function (x) { return x.status !== 'done'; }), done = items.filter(function (x) { return x.status === 'done'; });
    var h = '<div class="wlhead"><h3 class="sechead">Wish list' + (wl.list ? ' <small>' + open.length + ' open</small>' : '') + '</h3><button type="button" class="navbtn wlref" data-wl="refresh"' + (wl.loading ? ' disabled' : '') + '>&#8635; ' + (wl.loading ? 'Refreshing\u2026' : 'Refresh') + '</button></div>';
    h += '<div class="noteflash' + (wl.flash ? ' show' : '') + (wl.flashBad ? ' bad' : '') + '" id="wl-flash"' + (wl.flash ? '' : ' hidden') + '>' + esc(wl.flash) + '</div>';
    if (wl.listErr) h += '<div class="noteflash show bad">' + esc(wl.listErr) + '</div>';
    if (!wl.list && wl.loading) h += '<div class="loading">Loading\u2026</div>';
    else if (wl.list) {
      h += '<div class="card wlcard">' + (open.length ? open.map(wlRowHtml).join('') : '<div class="foot empty">' + (done.length ? 'Everything is done.' : 'No wishes yet. Dictate one above.') + '</div>') + '</div>';
      if (done.length) {
        h += '<button type="button" class="navbtn wldonebtn" data-wl="donetoggle" aria-expanded="' + wl.doneOpen + '">Done (' + done.length + ') ' + (wl.doneOpen ? '\u25be' : '\u25b8') + '</button>';
        if (wl.doneOpen) h += '<div class="card wlcard wldone">' + done.map(wlRowHtml).join('') + '</div>';
      }
    }
    box.innerHTML = h;
  }
  function wlOnScreen() { return state.ltPart === 'wish' && $('screen-lt').classList.contains('active'); }
  function wlLoadList() {
    var seq = ++wl.seq; wl.loading = true; wl.listErr = ''; wlListRender();
    apiRaw('wishlist', {}).then(function (j) {
      if (seq !== wl.seq) return;
      wl.loading = false;
      if (j.error) { wl.listErr = wlApiMsg(j); return wlListRender(); }
      wl.list = (j.data && j.data.items) || []; wl.listAt = Date.now(); wlListRender();
    }, function (err) {
      if (seq !== wl.seq) return;
      wl.loading = false;
      if (vAuth(err)) return;
      wl.listErr = friendly(err); wlListRender();
    });
  }
  function wlFind(id) { var l = wl.list || []; for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(id)) return l[i]; return null; }
  function wlSet(id) {               // toggle open <-> done
    var x = wlFind(id); if (!x || wl.pending[id]) return;
    var to = x.status === 'done' ? 'open' : 'done';
    wl.pending[id] = true; wl.flash = ''; wlListRender();
    apiRaw('wishset', { id: id, status: to, cid: vNewCid() }).then(function (j) {
      delete wl.pending[id];
      if (j.error) { wl.flash = wlApiMsg(j); wl.flashBad = true; return wlListRender(); }
      x.status = to; x.doneOn = to === 'done' ? vToday() : '';
      wlListRender();
    }, function (err) {
      delete wl.pending[id];
      if (vAuth(err)) return;
      wl.flash = friendly(err) + ' Not changed.'; wl.flashBad = true; wlListRender();
    });
  }
  function wlDelete(id) {
    var x = wlFind(id); if (!x || wl.pending[id]) return;
    wl.pending[id] = true; wl.flash = ''; wlListRender();
    apiRaw('wishdel', { id: id, item: x.item, cid: vNewCid() }).then(function (j) {
      delete wl.pending[id];
      if (j.error) { wl.flash = wlApiMsg(j); wl.flashBad = true; return wlListRender(); }
      wl.list = wl.list.filter(function (y) { return String(y.id) !== String(id); }); wl.confirmId = '';
      wl.flash = 'Deleted.'; wl.flashBad = false; wlListRender();
    }, function (err) {
      delete wl.pending[id];
      if (vAuth(err)) return;
      wl.flash = friendly(err) + ' Not deleted.'; wl.flashBad = true; wlListRender();
    });
  }
  $('lt-body').addEventListener('click', function (e) {
    if (state.ltPart !== 'wish') return;
    var b = e.target.closest('[data-wl]'); if (!b) return;
    var a = b.getAttribute('data-wl'), id = b.getAttribute('data-id'), i = +b.getAttribute('data-i');
    if (a === 'mic') { if (wl.on) wlMicStop(); else wlMicStart(); }
    else if (a === 'make') { wlMicStop(true); wl.on = false; wlFill(); }
    else if (a === 'clear') { wlMicStop(true); $('wl-text').value = ''; wl.text = ''; wl.msg = ''; wlDraftSave(); wlUi(); }
    else if (a === 'by') { wl.by = b.getAttribute('data-by') === 'Zac' ? 'Zac' : 'Lisa'; try { localStorage.setItem(WL_BY_KEY, wl.by); } catch (er) {}
      [].forEach.call($('wl-form').querySelectorAll('.vchip'), function (c) { var on = c === b; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
    else if (a === 'rm') { wl.items.splice(i, 1); wlDraftSave(); var note = $('wl-msg') && !$('wl-msg').hidden ? $('wl-msg').textContent : ''; wlFormRender(note); }
    else if (a === 'add') { wl.items.push(''); wlDraftSave(); wlFormRender(''); var ins = $('wl-rows').querySelectorAll('.wlin'); if (ins.length) ins[ins.length - 1].focus(); }
    else if (a === 'save') wlSave();
    else if (a === 'discard') { wlMicStop(true); wl.items = []; wl.text = ''; wl.cid = ''; wl.sig = ''; wl.msg = ''; try { localStorage.removeItem(WL_DRAFT_KEY); } catch (er) {} $('wl-text').value = ''; wlUi(); wlFormRender(''); }
    else if (a === 'refresh') wlLoadList();
    else if (a === 'donetoggle') { wl.doneOpen = !wl.doneOpen; wlListRender(); }
    else if (a === 'chk') wlSet(id);
    else if (a === 'del') { wl.confirmId = wl.confirmId === id ? '' : id; wlListRender(); }
    else if (a === 'delno') { wl.confirmId = ''; wlListRender(); }
    else if (a === 'delyes') wlDelete(id);
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'wish') return;
    var t = e.target;
    if (t.classList && t.classList.contains('wlin')) { wl.items[+t.getAttribute('data-i')] = t.value; wlDraftSave(); }
    else if (t.id === 'wl-text') { wl.text = t.value; wlDraftSave(); wlUi(); }
  });
  $('lt-body').addEventListener('keydown', function (e) {
    if (state.ltPart !== 'wish' || e.key !== 'Enter' || !e.target.classList || !e.target.classList.contains('wlin')) return;
    e.preventDefault();
    if (!e.target.value.trim()) return;
    wl.items.push(''); wlDraftSave(); wlFormRender(''); var ins = $('wl-rows').querySelectorAll('.wlin'); if (ins.length) ins[ins.length - 1].focus();
  });
  /* ---------------- Lisa's Table: Notes (#lt/notes): dictate (same mic as the Wish List) -> Save -> free-form note list (newest first, tap to edit, delete with confirm) ---------------- */
  // Notes live on THIS PHONE only for now (localStorage key cc_lt_notes). ALL reads/writes go through ltNotesLoad / ltNotesSave so a shared Drive-backed store can replace them later.
  // No server action is used or invented. Nothing is stored in the repo.
  var LT_NOTES_KEY = 'cc_lt_notes';
  function ltNotesLoad() {            // -> [{ id, text, at (created, ms), upd (last edited, ms) }], newest first
    var l = lsGet(LT_NOTES_KEY, []);
    if (!Array.isArray(l)) return [];
    return l.filter(function (n) { return n && n.id && typeof n.text === 'string'; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }
  function ltNotesSave(list) {        // -> true when stored
    try { localStorage.setItem(LT_NOTES_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  var ln = { rec: null, on: false, base: '', committed: '', interim: '', msg: '', text: '', editId: '', editText: '', confirmId: '', flash: '', flashBad: false };
  function lnOnScreen() { return state.ltPart === 'notes' && $('screen-lt').classList.contains('active'); }
  function lnWhen(ms) {
    var d = new Date(ms); if (!ms || isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function lnFlash(text, bad) { ln.flash = text || ''; ln.flashBad = !!bad; var el = $('ln-flash'); if (el) { el.textContent = ln.flash; el.hidden = !ln.flash; el.className = 'noteflash' + (ln.flash ? ' show' : '') + (bad ? ' bad' : ''); } }
  function openLtNotes() {
    lnMicStop(true);
    ln.msg = ''; ln.editId = ''; ln.confirmId = ''; ln.flash = '';
    $('lt-body').innerHTML =
      '<div class="wl ln">' +
      '<div class="micstage"><div class="micstate" id="ln-state">&nbsp;</div>' +
      '<button type="button" class="micbtn big" id="ln-btn" data-ln="mic" aria-pressed="false" aria-label="Start dictation"><span class="micico" aria-hidden="true">' + vsvg('mic', 72) + '</span><span class="miclbl" id="ln-lbl">Tap to talk</span></button></div>' +
      '<div class="card draft" id="ln-card"><h3>New note <span class="rec-tag" id="ln-rec" hidden>&#9679; Listening</span></h3>' +
      '<textarea id="ln-text" class="notebox" rows="4" maxlength="4000" autocapitalize="sentences" placeholder="Say it, type it, or use the keyboard\u2019s mic key."></textarea>' +
      '<div class="draftbtns"><button type="button" class="bigsave" data-ln="save" id="ln-save">Save note</button><button type="button" class="navbtn discard" data-ln="clear">Clear</button></div>' +
      '<div class="noteflash" id="ln-flash" hidden></div></div>' +
      '<div id="ln-list"></div>' +
      '<div class="foot lnfoot">Notes are saved on this phone for now. More coming soon.</div></div>';
    $('ln-text').value = ln.text;
    lnUi(); lnListRender();
  }
  function lnUi() {
    var btn = $('ln-btn'); if (!btn) return;
    var on = ln.on, has = !!$('ln-text').value.trim();
    btn.classList.toggle('rec', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', on ? 'Stop dictation' : 'Start dictation');
    $('ln-lbl').textContent = on ? 'Listening\u2026 tap to stop' : (has ? 'Tap to add more' : 'Tap to talk');
    var st = $('ln-state'); st.className = 'micstate' + (on ? ' rec' : '') + (ln.msg && !on ? ' warn' : '');
    st.textContent = on ? 'Listening\u2026' : (ln.msg || 'Tap the mic and talk. The words are added to the note below; edit, then Save.');
    $('ln-rec').hidden = !on;
    $('ln-card').classList.toggle('live', on);
  }
  function lnMicFail(msg) { ln.on = false; var r = ln.rec; ln.rec = null; try { r && r.abort(); } catch (e) {} ln.msg = msg; lnUi(); var ta = $('ln-text'); if (ta) ta.focus(); }
  function lnMicStart() {
    var ta = $('ln-text');
    if (!SR) { ln.msg = MIC_NA; lnUi(); ta.focus(); return; }
    ln.msg = ''; ln.base = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : ''; ln.committed = ''; ln.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return lnMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) ln.committed = micSpace(ln.committed, t.trim() + ' '); else interim += t;
      }
      ln.interim = interim.replace(/^\s+/, ''); ta.value = ln.base + ln.committed + ln.interim; ta.scrollTop = ta.scrollHeight;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return lnMicFail(MIC_NA);
      if (e === 'network') return lnMicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') ln.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (ln.rec !== rec) return;                        // aborted / screen left
      ln.committed = micSpace(ln.committed, ln.interim ? ln.interim.trim() + ' ' : ''); ln.interim = '';
      ln.on = false; ln.rec = null;
      ta.value = (ln.base + ln.committed).replace(/\s+$/, ''); ln.text = ta.value;   // appended to the box; nothing is saved until Save
      lnUi();
    };
    ln.rec = rec; ln.on = true;
    try { rec.start(); } catch (e2) { return lnMicFail(MIC_NA); }
    lnUi();
  }
  function lnMicStop(quiet) {         // quiet = abort (leaving the screen); otherwise stop() and onend appends the words
    var r = ln.rec;
    if (quiet) { ln.rec = null; ln.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { ln.rec = null; ln.on = false; lnUi(); } }
  }
  function lnListRender() {
    var box = $('ln-list'); if (!box) return;
    var list = ltNotesLoad();
    var h = '<div class="wlhead"><h3 class="sechead">Saved notes <small>' + list.length + '</small></h3></div>';
    if (!list.length) h += '<div class="card wlcard"><div class="foot empty">No notes yet. Dictate one above.</div></div>';
    else h += '<div class="card wlcard">' + list.map(function (n) {
      var id = esc(n.id), when = lnWhen(n.at) + (n.upd && n.upd > n.at + 1000 ? ' \u00b7 edited ' + lnWhen(n.upd) : '');
      if (ln.editId === n.id) {
        return '<div class="wlitem lnitem editing" data-id="' + id + '"><textarea class="notebox lnedit" id="ln-edit" rows="4" maxlength="4000" aria-label="Edit note">' + esc(ln.editText) + '</textarea>' +
          '<div class="draftbtns"><button type="button" class="bigsave" data-ln="editsave" data-id="' + id + '">Save</button><button type="button" class="navbtn discard" data-ln="editcancel">Cancel</button></div></div>';
      }
      var h2 = '<div class="wlitem lnitem" data-id="' + id + '"><div class="wlmain"><button type="button" class="lntext" data-ln="edit" data-id="' + id + '" aria-label="Edit this note"><span class="wlname">' + esc(n.text) + '</span><small class="wlmeta">' + esc(when) + '</small></button>' +
        '<button type="button" class="wlx" data-ln="del" data-id="' + id + '" aria-label="Delete this note" title="Delete">\u00d7</button></div>';
      if (ln.confirmId === n.id) h2 += '<div class="wlconf lnconf"><div class="vdelq">Delete this note?</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" data-ln="delyes" data-id="' + id + '">Yes, delete</button><button type="button" class="navbtn" data-ln="delno">Keep</button></div></div>';
      return h2 + '</div>';
    }).join('') + '</div>';
    box.innerHTML = h;
  }
  function lnNewId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function lnSave() {
    var ta = $('ln-text'), text = ta.value.replace(/\s+$/, '').replace(/^\s+/, '');
    if (!text) return lnFlash('Type or say something first.', true);
    lnMicStop(true);
    var list = ltNotesLoad(), now = Date.now();
    list.unshift({ id: lnNewId(), text: text.slice(0, 4000), at: now, upd: now });
    if (!ltNotesSave(list)) return lnFlash('Could not save on this phone (storage is full or blocked). Your text is still in the box.', true);
    ta.value = ''; ln.text = ''; ln.msg = ''; lnUi(); lnListRender(); lnFlash('Saved.', false);
  }
  $('lt-body').addEventListener('click', function (e) {
    if (state.ltPart !== 'notes') return;
    var b = e.target.closest('[data-ln]'); if (!b) return;
    var a = b.getAttribute('data-ln'), id = b.getAttribute('data-id');
    if (a === 'mic') { if (ln.on) lnMicStop(); else lnMicStart(); }
    else if (a === 'save') lnSave();
    else if (a === 'clear') { lnMicStop(true); $('ln-text').value = ''; ln.text = ''; ln.msg = ''; lnUi(); lnFlash('', false); }
    else if (a === 'edit') {
      var n = ltNotesLoad().filter(function (x) { return x.id === id; })[0]; if (!n) return;
      ln.editId = id; ln.editText = n.text; ln.confirmId = ''; lnListRender(); var ed = $('ln-edit'); if (ed) { ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
    }
    else if (a === 'editcancel') { ln.editId = ''; lnListRender(); }
    else if (a === 'editsave') {
      var t = ($('ln-edit').value || '').replace(/^\s+|\s+$/g, '');
      if (!t) { ln.editText = ''; return lnFlash('A note can\u2019t be empty. Use the delete button to remove it.', true); }
      var all = ltNotesLoad(), hit = all.filter(function (x) { return x.id === id; })[0]; if (!hit) { ln.editId = ''; return lnListRender(); }
      if (t !== hit.text) { hit.text = t.slice(0, 4000); hit.upd = Date.now(); }
      if (!ltNotesSave(all)) return lnFlash('Could not save on this phone (storage is full or blocked).', true);
      ln.editId = ''; lnListRender(); lnFlash('Saved.', false);
    }
    else if (a === 'del') { ln.confirmId = ln.confirmId === id ? '' : id; ln.editId = ''; lnListRender(); }
    else if (a === 'delno') { ln.confirmId = ''; lnListRender(); }
    else if (a === 'delyes') {
      var keep = ltNotesLoad().filter(function (x) { return x.id !== id; });
      if (!ltNotesSave(keep)) return lnFlash('Could not change the notes on this phone.', true);
      ln.confirmId = ''; lnListRender(); lnFlash('Deleted.', false);
    }
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'notes') return;
    var t = e.target;
    if (t.id === 'ln-text') { ln.text = t.value; lnUi(); }
    else if (t.id === 'ln-edit') ln.editText = t.value;
  });

  /* ---------------- Lisa's Table: Cost & Macros (#lt/cost) — ingredient checklist for true macros + package cost ---------------- */
  // Lives on THIS PHONE only for now (localStorage key cc_lt_cost_macros). ALL reads/writes go through ltCostLoad / ltCostSave so Drive can replace later.
  // Seeded from Notes (cc_lt_notes) + unique ingredient-ish names from Menu Macros when available. Photos are compressed JPEGs stored as data URLs (no OCR claimed).
  // No server action is used. Empty seed only — no real financials in the repo.
  var LT_COST_KEY = 'cc_lt_cost_macros';
  var CM_PHOTO_MAX = 480000;      // ~360 KB JPEG budget per photo (localStorage-safe)
  var CM_FIELDS = ['name', 'brand', 'servingSize', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'packageSize', 'packagePrice', 'notes'];
  var cm = { filter: 'need', q: '', editId: '', confirmId: '', flash: '', flashBad: false, photoBusy: false,
    mic: { rec: null, on: false, field: '', base: '', committed: '', interim: '', msg: '' } };
  function ltCostLoad() {
    var d = lsGet(LT_COST_KEY, null);
    if (!d || typeof d !== 'object') d = { items: [], seeded: false };
    if (!Array.isArray(d.items)) d.items = [];
    d.items = d.items.filter(function (x) { return x && x.id && typeof x.name === 'string'; }).map(function (x) {
      return {
        id: String(x.id), name: String(x.name || '').slice(0, 120), brand: String(x.brand || '').slice(0, 80),
        servingSize: String(x.servingSize || '').slice(0, 40), calories: String(x.calories || '').slice(0, 12),
        protein: String(x.protein || '').slice(0, 12), carbs: String(x.carbs || '').slice(0, 12), fat: String(x.fat || '').slice(0, 12),
        fiber: String(x.fiber || '').slice(0, 12), sugar: String(x.sugar || '').slice(0, 12),
        packageSize: String(x.packageSize || '').slice(0, 40), packagePrice: String(x.packagePrice || '').slice(0, 16),
        notes: String(x.notes || '').slice(0, 500), photo: typeof x.photo === 'string' && x.photo.indexOf('data:image/') === 0 ? x.photo : '',
        done: !!x.done, source: x.source || 'manual', at: x.at || 0, upd: x.upd || x.at || 0
      };
    });
    return d;
  }
  function ltCostSave(d) {
    try { localStorage.setItem(LT_COST_KEY, JSON.stringify({ items: d.items, seeded: !!d.seeded })); return true; } catch (e) { return false; }
  }
  function cmOnScreen() { return state.ltPart === 'cost' && $('screen-lt').classList.contains('active'); }
  function cmFlash(text, bad) {
    cm.flash = text || ''; cm.flashBad = !!bad;
    var el = $('cm-flash'); if (el) { el.textContent = cm.flash; el.hidden = !cm.flash; el.className = 'noteflash' + (cm.flash ? ' show' : '') + (bad ? ' bad' : ''); }
  }
  function cmNewId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cmNormName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function cmHasMacros(it) {
    return ['calories', 'protein', 'carbs', 'fat'].every(function (k) { return String(it[k] || '').trim() !== ''; });
  }
  function cmAutoDone(it) {
    return !!(String(it.brand || '').trim() && cmHasMacros(it) && String(it.packagePrice || '').trim());
  }
  function cmIsDone(it) { return !!it.done; }
  function cmParseQty(s) {
    var m = String(s || '').trim().match(/^([\d]+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
    if (!m) return null;
    return { n: +m[1], u: (m[2] || '').toLowerCase() };
  }
  function cmToBase(q) {
    var u = q.u;
    if (!u || u === 'g' || u === 'gram' || u === 'grams') return { n: q.n, k: 'g' };
    if (u === 'kg') return { n: q.n * 1000, k: 'g' };
    if (u === 'oz' || u === 'ounce' || u === 'ounces') return { n: q.n * 28.3495, k: 'g' };
    if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return { n: q.n * 453.592, k: 'g' };
    if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return { n: q.n, k: 'ml' };
    if (u === 'l' || u === 'liter' || u === 'liters') return { n: q.n * 1000, k: 'ml' };
    if (u === 'floz' || u === 'fl') return { n: q.n * 29.5735, k: 'ml' };
    if (u === 'serving' || u === 'servings' || u === 'serv' || u === 'ea' || u === 'each' || u === 'ct' || u === 'count' || u === 'pcs' || u === 'pc') return { n: q.n, k: 'ea' };
    return { n: q.n, k: u || 'ea' };
  }
  function cmUnitCost(it) {
    var s = cmParseQty(it.servingSize), p = cmParseQty(it.packageSize);
    var pr = parseFloat(String(it.packagePrice || '').replace(/[$,\s]/g, ''));
    if (!s || !p || !isFinite(pr) || s.n <= 0 || p.n <= 0 || pr < 0) return null;
    var a = cmToBase(s), b = cmToBase(p);
    if (a.k !== b.k || a.n <= 0) return null;
    var servings = b.n / a.n;
    if (!isFinite(servings) || servings <= 0) return null;
    return pr / servings;
  }
  function cmParseNamesFromText(text) {
    var out = [], seen = {};
    String(text || '').split(/\n+/).forEach(function (line) {
      line = line.replace(/^[\s\-\*\u2022\u00b7\d\.\)\(]+/, '').replace(/\s+/g, ' ').trim();
      if (!line || line.length < 2 || line.length > 80) return;
      if (/^(prep|overview|notes?|todo|shopping|menu|week|day)\b/i.test(line) && line.length < 20) return;
      // comma lists on short lines
      var parts = line.indexOf(',') >= 0 && line.length < 120 ? line.split(/,|\/|&/) : [line];
      parts.forEach(function (p) {
        p = p.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
        if (p.length < 2 || p.length > 60) return;
        if (/\d{2,}/.test(p) && /kcal|calorie|protein|carb|fat|\$/i.test(p)) return;
        var k = cmNormName(p); if (!k || seen[k]) return;
        seen[k] = 1; out.push(p);
      });
    });
    return out;
  }
  function cmSeedCandidates() {
    var names = [], seen = {};
    function add(n, src) {
      n = String(n || '').replace(/\s+/g, ' ').trim();
      if (!n || n.length < 2 || n.length > 80) return;
      var k = cmNormName(n); if (!k || seen[k]) return;
      seen[k] = 1; names.push({ name: n.slice(0, 120), source: src });
    }
    try {
      ltNotesLoad().forEach(function (note) {
        cmParseNamesFromText(note.text).forEach(function (n) { add(n, 'notes'); });
      });
    } catch (e1) {}
    try {
      var c = state.ltCache.macros;
      if (c && c.data && Array.isArray(c.data.items)) {
        c.data.items.forEach(function (x) {
          if (x.ingredients) String(x.ingredients).split(/,|;|\n|\||\u2022/).forEach(function (p) { add(p, 'macros'); });
          // also offer menu item names as checklist options (often useful for cost tracking)
          if (x.item) add(x.item, 'macros');
        });
      }
    } catch (e2) {}
    return names;
  }
  function cmMergeSeed(d) {
    var have = {};
    d.items.forEach(function (x) { have[cmNormName(x.name)] = 1; });
    var added = 0, now = Date.now();
    cmSeedCandidates().forEach(function (c) {
      var k = cmNormName(c.name); if (have[k]) return;
      have[k] = 1; added++;
      d.items.push({
        id: cmNewId(), name: c.name, brand: '', servingSize: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '',
        packageSize: '', packagePrice: '', notes: '', photo: '', done: false, source: c.source, at: now, upd: now
      });
    });
    d.seeded = true;
    return added;
  }
  function cmEnsureSeed(d, cb) {
    function finish() {
      var n = cmMergeSeed(d);
      if (n || !d.seeded) ltCostSave(d);
      cb && cb(n);
    }
    if (state.ltCache.macros && state.ltCache.macros.data) return finish();
    ltEnsureMacros(function () { if (cmOnScreen()) finish(); else finish(); });
  }
  function openLtCost() {
    cmMicStop(true);
    cm.editId = ''; cm.confirmId = ''; cm.flash = ''; cm.photoBusy = false;
    // Drop blank drafts left behind if the screen was left mid-add
    (function () {
      var d = ltCostLoad(), n = d.items.length;
      d.items = d.items.filter(function (x) {
        return String(x.name || '').trim() || cmHasMacros(x) || x.photo || String(x.packagePrice || '').trim() || String(x.brand || '').trim();
      });
      if (d.items.length !== n) ltCostSave(d);
    })();
    $('lt-body').innerHTML =
      '<div class="cm">' +
      '<div class="foot cmintro">Collect true ingredient macros and package costs. Photos of labels are saved on this phone (enter numbers from the label). Drive sync later.</div>' +
      '<div class="cmbar">' +
      '<div class="vchips cmfilt" role="tablist" aria-label="Filter">' +
      '<button type="button" class="vchip" data-cm="filt" data-f="need">Need data</button>' +
      '<button type="button" class="vchip" data-cm="filt" data-f="done">Done</button>' +
      '<button type="button" class="vchip" data-cm="filt" data-f="all">All</button></div>' +
      '<button type="button" class="navbtn wladd cmadd" data-cm="add">+ Add item</button></div>' +
      '<input class="searchbox" id="cm-q" type="search" autocomplete="off" placeholder="Search ingredients">' +
      '<div class="noteflash" id="cm-flash" hidden></div>' +
      '<div id="cm-list"></div>' +
      '<div class="foot cmfoot">Saved on this phone only for now. Mark complete when brand, macros, and package price are filled — or toggle Done. Grocery list generation later.</div>' +
      '<input class="vfile" type="file" id="cm-cam" accept="image/*" capture="environment">' +
      '<input class="vfile" type="file" id="cm-lib" accept="image/*">' +
      '</div>';
    $('cm-q').value = cm.q;
    var d = ltCostLoad();
    cmEnsureSeed(d, function (n) {
      if (!cmOnScreen()) return;
      if (n) cmFlash('Seeded ' + n + ' item' + (n === 1 ? '' : 's') + ' from Notes / Menu Macros.', false);
      cmListRender();
    });
    cmListRender();
  }
  function cmFiltBtn() {
    document.querySelectorAll('.cmfilt .vchip').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-f') === cm.filter);
    });
  }
  function cmListRender() {
    var box = $('cm-list'); if (!box) return;
    cmFiltBtn();
    var d = ltCostLoad(), term = (cm.q || '').trim().toLowerCase();
    var items = d.items.filter(function (it) {
      if (cm.filter === 'need' && cmIsDone(it)) return false;
      if (cm.filter === 'done' && !cmIsDone(it)) return false;
      if (!term) return true;
      return (it.name + ' ' + it.brand + ' ' + it.notes).toLowerCase().indexOf(term) >= 0;
    }).slice().sort(function (a, b) {
      var ad = cmIsDone(a) ? 1 : 0, bd = cmIsDone(b) ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    });
    var need = d.items.filter(function (x) { return !cmIsDone(x); }).length;
    var h = '<div class="wlhead"><h3 class="sechead">Ingredients <small>' + need + ' need data \u00b7 ' + d.items.length + ' total</small></h3></div>';
    if (!d.items.length) {
      h += '<div class="card wlcard"><div class="foot empty">No items yet. Tap <b>+ Add item</b> to type or dictate an ingredient, or save prep Notes and reopen this tab to seed from them.</div></div>';
      box.innerHTML = h; return;
    }
    if (!items.length) {
      h += '<div class="card wlcard"><div class="foot empty">' + (term ? 'No matches.' : (cm.filter === 'done' ? 'Nothing marked complete yet.' : 'Everything looks complete. Switch to All to review.')) + '</div></div>';
      box.innerHTML = h; return;
    }
    h += '<div class="card wlcard">' + items.map(function (it) {
      var id = esc(it.id), done = cmIsDone(it), uc = cmUnitCost(it);
      var meta = [];
      if (it.brand) meta.push(it.brand);
      if (it.packagePrice) meta.push('$' + String(it.packagePrice).replace(/^\$/, ''));
      if (uc != null) meta.push(money(uc) + '/serving');
      meta.push(done ? 'complete' : 'incomplete');
      if (cm.editId === it.id) return cmEditHtml(it);
      var thumb = it.photo ? '<img class="cmthumb" src="' + it.photo + '" alt="">' : '<span class="cmthumb empty" aria-hidden="true"></span>';
      var row = '<div class="wlitem cmitem' + (done ? ' isdone' : '') + '" data-id="' + id + '">' +
        '<div class="wlmain">' +
        '<button type="button" class="wlchk' + (done ? ' on' : '') + '" data-cm="toggle" data-id="' + id + '" aria-label="' + (done ? 'Mark incomplete' : 'Mark complete') + '" aria-pressed="' + (done ? 'true' : 'false') + '">' + (done ? '\u2713' : '') + '</button>' +
        thumb +
        '<button type="button" class="cmmain" data-cm="edit" data-id="' + id + '" aria-label="Edit ' + esc(it.name) + '"><span class="wlname">' + esc(it.name) + '</span><small class="wlmeta">' + esc(meta.join(' \u00b7 ')) + '</small></button>' +
        '<button type="button" class="wlx" data-cm="del" data-id="' + id + '" aria-label="Delete" title="Delete">\u00d7</button></div>';
      if (cm.confirmId === it.id) row += '<div class="wlconf"><div class="vdelq">Delete this ingredient?</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" data-cm="delyes" data-id="' + id + '">Yes, delete</button><button type="button" class="navbtn" data-cm="delno">Keep</button></div></div>';
      return row + '</div>';
    }).join('') + '</div>';
    box.innerHTML = h;
  }
  function cmMicBtn(field) {
    return '<button type="button" class="navbtn cmmic" data-cm="mic" data-field="' + field + '" aria-label="Dictate ' + field + '">' + vsvg('mic', 18) + '</button>';
  }
  function cmFld(key, label, it, extra) {
    var val = esc(it[key] || '');
    var num = /^(calories|protein|carbs|fat|fiber|sugar|packagePrice)$/.test(key);
    var speak = num || key === 'name' || key === 'brand' || key === 'servingSize' || key === 'packageSize';
    var attrs = (num ? ' inputmode="decimal"' : '') + (extra || '') + ' maxlength="' + (key === 'notes' ? '500' : (key === 'name' ? '120' : '80')) + '"';
    if (key === 'notes') {
      return '<label class="vfield"><span>' + label + '</span><textarea class="notebox" data-cmf="' + key + '" rows="2"' + attrs + '>' + val + '</textarea></label>';
    }
    return '<label class="vfield"><span>' + label + (speak ? ' ' + cmMicBtn(key) : '') + '</span>' +
      '<input class="wlin" data-cmf="' + key + '" type="text" value="' + val + '"' + attrs + '></label>';
  }
  function cmEditHtml(it) {
    var id = esc(it.id), uc = cmUnitCost(it);
    var photoNote = it.photo
      ? '<div class="cmphoto"><img class="cmprev" src="' + it.photo + '" alt="Label photo"><div class="draftbtns"><label class="navbtn" for="cm-cam">Retake</label><label class="navbtn" for="cm-lib">Library</label><button type="button" class="navbtn discard" data-cm="photodel" data-id="' + id + '">Remove photo</button></div><div class="foot">Photo saved — enter macros from label.</div></div>'
      : '<div class="cmphoto empty"><div class="draftbtns"><label class="navbtn" for="cm-cam">Take label photo</label><label class="navbtn" for="cm-lib">Choose from library</label></div><div class="foot">Photo is optional. No automatic OCR — type or dictate the numbers from the label.</div></div>';
    return '<div class="wlitem cmitem editing" data-id="' + id + '">' +
      '<div class="card vform cmform">' +
      '<h3>Edit ingredient</h3>' +
      cmFld('name', 'Item name', it) + cmFld('brand', 'Brand (optional)', it) +
      '<div class="vrow2">' + cmFld('servingSize', 'Serving size', it, ' placeholder="e.g. 30 g"') + cmFld('packageSize', 'Package size', it, ' placeholder="e.g. 16 oz"') + '</div>' +
      '<div class="macgrid">' +
      cmFld('calories', 'Calories', it) + cmFld('protein', 'Protein g', it) + cmFld('carbs', 'Carbs g', it) + cmFld('fat', 'Fat g', it) +
      cmFld('fiber', 'Fiber g', it) + cmFld('sugar', 'Sugar g', it) +
      '</div>' +
      '<div class="vrow2">' + cmFld('packagePrice', 'Package price $', it, ' placeholder="4.99"') +
      '<label class="vfield"><span>$ / serving</span><div class="cmunit">' + (uc != null ? esc(money(uc)) : '—') + '</div><div class="foot">Computed when serving + package sizes share units.</div></label></div>' +
      cmFld('notes', 'Notes', it) +
      photoNote +
      '<div class="micstate" id="cm-micstate"' + (cm.mic.msg ? '' : ' hidden') + '>' + esc(cm.mic.msg || '') + '</div>' +
      '<div class="draftbtns"><button type="button" class="bigsave" data-cm="save" data-id="' + id + '">Save</button>' +
      '<button type="button" class="navbtn" data-cm="toggle" data-id="' + id + '">' + (cmIsDone(it) ? 'Mark incomplete' : 'Mark complete') + '</button>' +
      '<button type="button" class="navbtn discard" data-cm="cancel">Cancel</button></div></div></div>';
  }
  function cmReadForm(it) {
    document.querySelectorAll('[data-cmf]').forEach(function (el) {
      var k = el.getAttribute('data-cmf');
      if (CM_FIELDS.indexOf(k) >= 0) it[k] = el.value;
    });
    it.name = String(it.name || '').trim().slice(0, 120);
    it.brand = String(it.brand || '').trim().slice(0, 80);
    it.notes = String(it.notes || '').trim().slice(0, 500);
    ['servingSize', 'packageSize', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'packagePrice'].forEach(function (k) {
      it[k] = String(it[k] || '').trim().slice(0, 40);
    });
  }
  function cmFind(d, id) {
    for (var i = 0; i < d.items.length; i++) if (d.items[i].id === id) return d.items[i];
    return null;
  }
  function cmAdd() {
    var d = ltCostLoad(), now = Date.now();
    var it = {
      id: cmNewId(), name: '', brand: '', servingSize: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '',
      packageSize: '', packagePrice: '', notes: '', photo: '', done: false, source: 'manual', at: now, upd: now
    };
    d.items.unshift(it);
    if (!ltCostSave(d)) return cmFlash('Could not save on this phone (storage is full or blocked).', true);
    cm.editId = it.id; cm.confirmId = ''; cm.filter = 'all'; cm.q = ''; 
    var q = $('cm-q'); if (q) q.value = '';
    cmListRender();
    var nameEl = document.querySelector('[data-cmf="name"]'); if (nameEl) nameEl.focus();
    cmFlash('Type or dictate the ingredient name, then fill macros and price.', false);
  }
  function cmSave(id) {
    var d = ltCostLoad(), it = cmFind(d, id); if (!it) return;
    cmReadForm(it);
    if (!it.name) return cmFlash('Name is required.', true);
    it.upd = Date.now();
    if (cmAutoDone(it)) it.done = true;
    if (!ltCostSave(d)) return cmFlash('Could not save on this phone (storage is full or blocked).', true);
    cm.editId = ''; cmListRender(); cmFlash('Saved.', false);
  }
  function cmShrinkPhoto(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        var W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
        if (!W || !H) return rej(new Error('That photo could not be read.'));
        var tries = [[1200, 0.72], [1000, 0.65], [800, 0.55], [640, 0.5], [480, 0.45]];
        var out = null;
        for (var i = 0; i < tries.length; i++) {
          var sc = Math.min(1, tries[i][0] / Math.max(W, H)), cw = Math.max(1, Math.round(W * sc)), ch = Math.max(1, Math.round(H * sc));
          var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch); cx.drawImage(im, 0, 0, cw, ch);
          var data = cv.toDataURL('image/jpeg', tries[i][1]); cv.width = cv.height = 0;
          if (data.indexOf('data:image/jpeg') !== 0) return rej(new Error('This browser could not compress the photo.'));
          out = data;
          if (data.length <= CM_PHOTO_MAX) break;
        }
        if (!out || out.length > CM_PHOTO_MAX * 1.4) return rej(new Error('Photo is still too large after shrinking. Try a closer shot of the label.'));
        res(out);
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That photo could not be read. Try a JPEG.')); };
      im.src = url;
    });
  }
  function cmAttachPhoto(file) {
    if (!file || !cm.editId || cm.photoBusy) return;
    cm.photoBusy = true; cmFlash('Preparing photo\u2026', false);
    cmShrinkPhoto(file).then(function (dataUrl) {
      cm.photoBusy = false;
      var d = ltCostLoad(), it = cmFind(d, cm.editId); if (!it) return;
      // keep in-form values
      cmReadForm(it);
      it.photo = dataUrl; it.upd = Date.now();
      if (!ltCostSave(d)) { it.photo = ''; return cmFlash('Photo too large for phone storage. Macros fields are untouched — try a closer crop.', true); }
      cmListRender(); cmFlash('Photo saved — enter macros from label.', false);
    }, function (err) {
      cm.photoBusy = false;
      cmFlash((err && err.message) || 'Could not prepare that photo.', true);
    });
  }
  function cmMicStop(quiet) {
    var r = cm.mic.rec;
    if (quiet) { cm.mic.rec = null; cm.mic.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { cm.mic.rec = null; cm.mic.on = false; } }
  }
  function cmMicStart(field) {
    if (!SR) { cm.mic.msg = MIC_NA; cmListRender(); return; }
    var el = document.querySelector('[data-cmf="' + field + '"]'); if (!el) return;
    cmMicStop(true);
    cm.mic.msg = ''; cm.mic.field = field; cm.mic.base = ''; cm.mic.committed = ''; cm.mic.interim = '';
    var rec; try { rec = new SR(); } catch (e) { cm.mic.msg = MIC_NA; cmListRender(); return; }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) cm.mic.committed = micSpace(cm.mic.committed, t.trim() + ' '); else interim += t;
      }
      cm.mic.interim = interim.replace(/^\s+/, '');
      var raw = (cm.mic.committed + cm.mic.interim).trim();
      var numOnly = /^(calories|protein|carbs|fat|fiber|sugar|packagePrice)$/.test(field);
      if (numOnly) {
        var num = macWords(raw.toLowerCase()).match(/(\d+(?:\.\d+)?)/);
        if (num) el.value = num[1];
      } else {
        el.value = raw.slice(0, field === 'name' ? 120 : 80);
      }
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') { cm.mic.msg = MIC_NA; cm.mic.on = false; cm.mic.rec = null; cmListRender(); return; }
      if (e === 'network') { cm.mic.msg = 'Speech service unreachable — type the number or use the keyboard mic.'; cm.mic.on = false; cm.mic.rec = null; cmListRender(); return; }
      if (e === 'no-speech') cm.mic.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (cm.mic.rec !== rec) return;
      cm.mic.on = false; cm.mic.rec = null;
      var st = $('cm-micstate'); if (st) { st.textContent = cm.mic.msg || ''; st.hidden = !cm.mic.msg; }
    };
    cm.mic.rec = rec; cm.mic.on = true;
    try { rec.start(); } catch (e2) { cm.mic.msg = MIC_NA; cm.mic.on = false; cm.mic.rec = null; }
    var st2 = $('cm-micstate'); if (st2) { st2.hidden = false; st2.textContent = 'Listening\u2026 say the number'; st2.className = 'micstate rec'; }
  }
  $('lt-body').addEventListener('click', function (e) {
    if (state.ltPart !== 'cost') return;
    var b = e.target.closest('[data-cm]'); if (!b) return;
    var a = b.getAttribute('data-cm'), id = b.getAttribute('data-id');
    if (a === 'filt') { cm.filter = b.getAttribute('data-f') || 'need'; cm.editId = ''; cmListRender(); }
    else if (a === 'add') cmAdd();
    else if (a === 'edit') { cm.editId = id; cm.confirmId = ''; cmMicStop(true); cmListRender(); }
    else if (a === 'cancel') {
      cmMicStop(true);
      var dC = ltCostLoad(), itC = cmFind(dC, cm.editId);
      if (itC && !String(itC.name || '').trim() && !cmHasMacros(itC) && !itC.photo && !String(itC.packagePrice || '').trim()) {
        dC.items = dC.items.filter(function (x) { return x.id !== cm.editId; }); ltCostSave(dC);
      }
      cm.editId = ''; cmListRender();
    }
    else if (a === 'save') { cmMicStop(true); cmSave(id); }
    else if (a === 'toggle') {
      var d = ltCostLoad(), it = cmFind(d, id); if (!it) return;
      if (cm.editId === id) cmReadForm(it);
      // Explicit user toggle: done flag only (auto-complete sets done=true on Save when fields filled)
      it.done = !it.done;
      it.upd = Date.now();
      if (!ltCostSave(d)) return cmFlash('Could not save on this phone.', true);
      cmListRender();
    }
    else if (a === 'del') { cm.confirmId = cm.confirmId === id ? '' : id; if (cm.editId === id) cm.editId = ''; cmListRender(); }
    else if (a === 'delno') { cm.confirmId = ''; cmListRender(); }
    else if (a === 'delyes') {
      var d2 = ltCostLoad(); d2.items = d2.items.filter(function (x) { return x.id !== id; });
      if (!ltCostSave(d2)) return cmFlash('Could not change the list on this phone.', true);
      if (cm.editId === id) cm.editId = ''; cm.confirmId = ''; cmListRender(); cmFlash('Deleted.', false);
    }
    else if (a === 'photodel') {
      var d3 = ltCostLoad(), it3 = cmFind(d3, id); if (!it3) return;
      cmReadForm(it3); it3.photo = ''; it3.upd = Date.now();
      if (!ltCostSave(d3)) return cmFlash('Could not save on this phone.', true);
      cmListRender(); cmFlash('Photo removed.', false);
    }
    else if (a === 'mic') {
      var field = b.getAttribute('data-field');
      if (cm.mic.on && cm.mic.field === field) cmMicStop(); else cmMicStart(field);
    }
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'cost') return;
    if (e.target.id === 'cm-q') { cm.q = e.target.value; cmListRender(); return; }
    if (e.target.getAttribute && e.target.getAttribute('data-cmf') && cm.editId) {
      // live unit-cost preview
      var ucEl = document.querySelector('.cmunit'); if (!ucEl) return;
      var tmp = { servingSize: '', packageSize: '', packagePrice: '' };
      document.querySelectorAll('[data-cmf]').forEach(function (el) {
        var k = el.getAttribute('data-cmf'); if (tmp[k] !== undefined) tmp[k] = el.value;
      });
      var uc = cmUnitCost(tmp); ucEl.textContent = uc != null ? money(uc) : '—';
    }
  });
  $('lt-body').addEventListener('change', function (e) {
    if (state.ltPart !== 'cost') return;
    if (e.target.id === 'cm-cam' || e.target.id === 'cm-lib') {
      var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) cmAttachPhoto(f);
    }
  });
  /* ---------------- Lisa's Personal Training (#pt): clients -> profile -> workouts ---------------- */
  // Live from the Sheet "Lisa's Personal Training" through ptclients (read) and ptclientset / ptclientdel / ptworkoutset / ptworkoutdel (writes, cid + POST).
  // Nothing about clients is stored in this repo or in localStorage (only which cards are open). Unsaved edits live in memory until Save.
  // Routes: #pt (client list), #pt/new (add client), #pt/client/<id> (profile + workouts).
  var PT_OPEN_KEY = 'cc_pt_open', PT_TTL = 30000;
  var PT_SECS = [
    { key: 'basics',   title: 'Basics',              fields: ['name', 'age', 'phone', 'email', 'status', 'startDate', 'schedule'] },
    { key: 'health',   title: 'Condition & health',  fields: ['condition', 'ailments', 'medications'] },
    { key: 'goals',    title: 'Goals & history',     fields: ['goals', 'experience'] },
    { key: 'notes',    title: 'Notes',               fields: ['notes'] }
  ];
  var PT_FIELDS = {
    name:        { label: 'Name', kind: 'name', max: 80, ph: 'Full name' },
    age:         { label: 'Age', kind: 'age', max: 3, ph: 'Years' },
    phone:       { label: 'Phone', kind: 'tel', max: 30, ph: '' },
    email:       { label: 'Email', kind: 'email', max: 120, ph: '' },
    status:      { label: 'Status', kind: 'status' },
    startDate:   { label: 'Start date', kind: 'date', max: 10 },
    schedule:    { label: 'Schedule / frequency', kind: 'text', max: 200, ph: 'e.g. 2 times a week' },
    condition:   { label: 'Condition', kind: 'text', max: 300, ph: 'Overall condition / fitness level' },
    ailments:    { label: 'Ailments / injuries', kind: 'long', max: 1500, ph: 'Anything to work around. Speak it or type it.' },
    medications: { label: 'Medications', kind: 'long', max: 1000, ph: '' },
    goals:       { label: 'Goals', kind: 'long', max: 1500, ph: 'What the client wants to achieve' },
    experience:  { label: 'Previous workouts / experience', kind: 'long', max: 1500, ph: 'What they have done before' },
    notes:       { label: 'Notes', kind: 'long', max: 2000, ph: 'Anything else' }
  };
  var pt = { data: null, at: 0, loading: false, err: '', na: false, seq: 0, filter: 'active', q: '', form: null, formId: '', wf: null, wfOpen: '', wConfirm: '', cConfirm: false,
    busy: false, wbusy: '', open: null, flash: '', cur: '' };
  var pm = { rec: null, on: false, wanted: false, spell: false, id: '', base: '', committed: '', interim: '', prev: '', msg: '' };
  function ptRoute() { return state.ptRoute || { kind: '', id: '' }; }
  function ptOnScreen() { return $('screen-pt').classList.contains('active'); }
  function ptOpenMap() { if (!pt.open) pt.open = lsGet(PT_OPEN_KEY, null) || { basics: 1, health: 1, goals: 1, workouts: 1 }; return pt.open; }
  function ptIsOpen(k) { return !!ptOpenMap()[k]; }
  function ptMsg(id, text, bad) { var el = $(id); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function ptApiMsg(j) {
    if (!j || !j.error) return 'Something went wrong.';
    if (j.error === 'bad_action') return 'Server update pending. This will work after the next server update.';
    return j.message || ('Server error: ' + j.error);
  }
  function ptDate(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3], 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function ptClient(id) { var l = (pt.data && pt.data.clients) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function ptFirstLine(s, n) { s = String(s || '').split('\n')[0].trim(); return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

  // ---- load ----
  function ptOpen() {
    ptMicStop(true); if (sp.open) ptSpellClose(); pt.cur = '';
    var r = ptRoute();
    $('pt-back').setAttribute('data-go', r.kind ? 'pt' : 'home');
    $('pt-title').textContent = r.kind === 'new' ? 'New client' : r.kind === 'client' ? 'Client' : 'Clients';
    $('pt-title').classList.toggle('sub', !!r.kind);
    if (pt.data && Date.now() - pt.at < PT_TTL) return ptRender();
    ptLoad(false);
  }
  function ptLoad(force) {
    var seq = ++pt.seq; pt.loading = true; pt.err = '';
    if (!pt.data || force) $('pt-body').innerHTML = '<div class="loading">Loading\u2026</div>';
    apiRaw('ptclients', {}).then(function (j) {
      if (seq !== pt.seq) return;
      pt.loading = false;
      if (j.error === 'bad_action') { pt.na = true; pt.data = null; return ptRender(); }
      if (j.error) { pt.err = ptApiMsg(j); return ptRender(); }
      pt.na = false; pt.data = j.data || { clients: [], counts: { total: 0, active: 0, paused: 0 } }; pt.at = Date.now();
      if (force) pt.formId = '';
      ptRender();
    }, function (err) {
      if (seq !== pt.seq) return;
      pt.loading = false;
      if (vAuth(err)) return;
      pt.err = friendly(err); ptRender();
    });
  }
  function ptRetryHtml() { return '<button type="button" class="navbtn" data-pt="reload">Try again</button>'; }

  // ---- render ----
  function ptRender() {
    if (!ptOnScreen()) return;
    var y = window.scrollY;
    ptMicStop(true);
    var r = ptRoute(), h;
    if (pt.na) h = '<div class="card ptna"><h3>Server update pending</h3><div class="foot">Lisa\u2019s Personal Training will work after the next server update. Nothing is lost; check back soon.</div></div>' + ptRetryHtml();
    else if (pt.err && !pt.data) h = '<div class="noteflash show bad">' + esc(pt.err) + '</div>' + ptRetryHtml();
    else if (!pt.data) h = '<div class="loading">Loading\u2026</div>';
    else if (r.kind === 'new') { if (pt.formId !== '(new)') ptFormInit(null); h = ptProfileHtml(null); }
    else if (r.kind === 'client') {
      var c = ptClient(r.id);
      if (!c) h = '<div class="card"><div class="foot empty">That client was not found. It may have been deleted.</div></div><button type="button" class="navbtn" data-go="pt">&lsaquo; All clients</button>';
      else { if (pt.formId !== c.id) ptFormInit(c); h = ptProfileHtml(c); }
    } else h = ptListHtml();
    $('pt-body').innerHTML = h;
    if (r.kind) window.scrollTo(0, y);
    if (pt.flash) { ptMsg('pt-msg', pt.flash, false); pt.flash = ''; }
    if ((r.kind === 'new' || r.kind === 'client') && (!pt.cur || !ptInfo(pt.cur))) pt.cur = 'ptf-name';
    ptBarUpdate();
  }
  function ptCounts() {
    var l = (pt.data && pt.data.clients) || [], n = { active: 0, paused: 0, all: l.length };
    l.forEach(function (c) { n[c.status === 'paused' ? 'paused' : 'active']++; });
    return n;
  }
  function ptListHtml() {
    var n = ptCounts(), f = pt.filter, q = String(pt.q || '').toLowerCase().trim();
    var h = '<div class="pt"><div class="noteflash" id="pt-msg" hidden></div><button type="button" class="bigsave ptadd" data-go="pt/new">+ Add client</button>' +
      '<input class="searchbox ptsearch" id="pt-q" type="search" placeholder="Search clients" autocomplete="off" value="' + esc(pt.q) + '" aria-label="Search clients">' +
      '<div class="vchips ptfilter" role="group" aria-label="Filter">' + [['active', 'Active'], ['paused', 'Paused'], ['all', 'All']].map(function (x) {
        return '<button type="button" class="vchip' + (f === x[0] ? ' on' : '') + '" data-pt="filter" data-f="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + ' <small>' + n[x[0]] + '</small></button>';
      }).join('') + '</div>';
    h += '<div id="pt-list">' + ptListRows() + '</div>';
    h += '<button type="button" class="navbtn ptrefresh" data-pt="reload">&#8635; Refresh</button></div>';
    return h;
  }
  function ptListRows() {
    var q = String(pt.q || '').toLowerCase().trim(), f = pt.filter;
    var rows = ((pt.data && pt.data.clients) || []).filter(function (c) {
      if (f !== 'all' && c.status !== f) return false;
      return !q || (c.name + ' ' + c.goals + ' ' + c.condition).toLowerCase().indexOf(q) >= 0;
    });
    if (!rows.length) return '<div class="card"><div class="foot empty">' + (((pt.data && pt.data.clients) || []).length ? 'No clients match.' : 'No clients yet. Tap Add client to set up the first one.') + '</div></div>';
    return rows.map(function (c) {
      var goal = ptFirstLine(c.goals, 70);
      return '<button type="button" class="ptcl" data-go="pt/client/' + esc(encodeURIComponent(c.id)) + '"><span class="ptcl1"><b class="ptname">' + esc(c.name) + '</b>' +
        '<span class="ptchip ' + (c.status === 'paused' ? 'paused' : 'active') + '">' + (c.status === 'paused' ? 'Paused' : 'Active') + '</span></span>' +
        '<span class="ptcl2">' + (c.age !== '' && c.age != null ? esc(c.age) + ' yrs' : 'Age not set') + (goal ? ' \u00b7 ' + esc(goal) : '') + '</span>' +
        '<span class="ptcl3">' + (c.workoutCount || 0) + ' workout' + (c.workoutCount === 1 ? '' : 's') + (c.lastWorkout ? ' \u00b7 last ' + esc(ptDate(c.lastWorkout)) : '') + '</span></button>';
    }).join('');
  }

  // ---- profile ----
  function ptFormInit(c) {
    pt.formId = c ? c.id : '(new)'; pt.cConfirm = false; pt.wf = null; pt.wfOpen = ''; pt.wConfirm = '';
    pt.form = { cid: '', sig: '' };
    Object.keys(PT_FIELDS).forEach(function (k) { pt.form[k] = c ? (c[k] == null ? '' : String(c[k])) : (k === 'status' ? 'active' : ''); });
  }
  function ptSecSummary(key, c) {
    var f = pt.form;
    if (key === 'basics') return esc((f.name || 'New client') + (f.age ? ' \u00b7 ' + f.age + ' yrs' : '') + ' \u00b7 ' + (f.status === 'paused' ? 'Paused' : 'Active'));
    if (key === 'health') return esc(f.condition ? ptFirstLine(f.condition, 60) : (f.ailments ? ptFirstLine(f.ailments, 60) : 'Nothing entered'));
    if (key === 'goals') return esc(f.goals ? ptFirstLine(f.goals, 60) : 'Nothing entered');
    if (key === 'notes') return esc(f.notes ? ptFirstLine(f.notes, 60) : 'Nothing entered');
    if (key === 'workouts') { var w = c ? c.workouts || [] : []; return w.length + ' workout' + (w.length === 1 ? '' : 's') + ' \u00b7 ' + w.filter(function (x) { return x.done; }).length + ' done'; }
    return '';
  }
  function ptCard(key, title, summary, body) {
    var col = !ptIsOpen(key);
    return '<div class="vgcard ptc' + (col ? ' collapsed' : '') + '" data-ptsec="' + key + '"><div class="vghead">' +
      '<h2 class="vgrp pth" role="button" tabindex="0" aria-expanded="' + !col + '"><span class="vgt">' + esc(title) + '</span><i class="vgchev" aria-hidden="true">&rsaquo;</i></h2></div>' +
      '<div class="vgtot ptsum"><span>' + summary + '</span></div><div class="vgbody">' + body + '</div></div>';
  }
  // One control (input / textarea). Short fields REPLACE on dictation (and parse the spoken value); text / long fields APPEND. One form-level mic fills the focused field.
  function ptCtl(kind, id, attr, key, v, max, ph, label, rows) {
    var ctl;
    if (kind === 'long') ctl = '<textarea class="notebox" id="' + id + '" ' + attr + '="' + key + '" rows="' + (rows || 3) + '" maxlength="' + max + '" autocapitalize="sentences" placeholder="' + esc(ph || '') + '">' + esc(v) + '</textarea>';
    else {
      var type = kind === 'tel' ? 'tel' : kind === 'email' ? 'email' : kind === 'date' ? 'date' : 'text';
      ctl = '<input class="wlin ptin" id="' + id + '" ' + attr + '="' + key + '" type="' + type + '"' + (kind === 'age' ? ' inputmode="numeric"' : '') + (kind === 'name' ? ' autocapitalize="words"' : '') +
        (max && type !== 'date' ? ' maxlength="' + max + '"' : '') + ' autocomplete="off" enterkeyhint="next" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '" aria-label="' + esc(label) + '">';
    }
    return '<div class="vfield" data-ptid="' + id + '"><span>' + esc(label) + '</span><div class="ptlong' + (kind === 'long' ? '' : ' one') + '">' + ctl + '</div></div>';
  }
  function ptFieldHtml(k, pre) {
    var d = PT_FIELDS[k], v = pt.form[k] == null ? '' : pt.form[k], id = pre + k;
    if (d.kind === 'status') {
      return '<div class="vfield" data-ptid="ptf-status"><span>' + d.label + '</span><div class="ptlong one"><div class="vchips" id="ptf-status" role="group" aria-label="Status">' + [['active', 'Active'], ['paused', 'Paused']].map(function (s) {
        var on = v === s[0]; return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-pt="status" data-s="' + s[0] + '" aria-pressed="' + on + '">' + s[1] + '</button>';
      }).join('') + '</div></div></div>';
    }
    return ptCtl(d.kind, id, 'data-ptf', k, v, d.max, d.ph, d.label, 3);
  }
  function ptProfileHtml(c) {
    var h = '<div class="pt ptprofile">';
    h += '<div class="ptformmic"><button type="button" class="micbtn ptmic ptformmicbtn" id="pt-form-mic" data-pt="formmic" aria-pressed="false" aria-label="Dictate the form">' +
      '<span class="micico" aria-hidden="true">' + vsvg('mic', 34) + '</span><span class="miclbl" id="pt-form-mic-lbl">Tap to talk</span></button>' +
      '<div class="micstate" id="pt-mic-state">&nbsp;</div>' +
      '<p class="pthint">Starts on Name. Say the value, then &ldquo;tab&rdquo; for next, &ldquo;tab back&rdquo; for previous, or &ldquo;spelling&rdquo; to spell letter by letter.</p></div>';
    PT_SECS.forEach(function (s) {
      h += ptCard(s.key, s.title, ptSecSummary(s.key, c), s.fields.map(function (k) { return ptFieldHtml(k, 'ptf-'); }).join(''));
    });
    h += '<div class="draftbtns ptsavebar"><button type="button" class="bigsave" data-pt="save" id="pt-save"' + (pt.busy ? ' disabled' : '') + '>' + (pt.busy ? 'Saving\u2026' : (c ? 'Save client' : 'Add client')) + '</button>' +
      '<button type="button" class="navbtn discard" data-pt="cancel">' + (c ? 'Discard changes' : 'Cancel') + '</button></div>';
    h += '<div class="noteflash" id="pt-msg" hidden></div>';
    if (c) {
      h += ptCard('workouts', 'Workouts', esc(ptSecSummary('workouts', c)), ptWorkoutsHtml(c));
      h += '<div class="ptdel">' + (pt.cConfirm
        ? '<div class="vdelq">Delete ' + esc(c.name) + ' and all ' + (c.workouts || []).length + ' of their workouts? This cannot be undone.</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" data-pt="delyes"' + (pt.busy ? ' disabled' : '') + '>Yes, delete client</button><button type="button" class="navbtn" data-pt="delno">Keep</button></div>'
        : '<button type="button" class="navbtn vdelbtn ptdelbtn" data-pt="del">Delete client</button>') + '</div>';
    }
    return h + '</div>';
  }

  // ---- workouts ----
  function ptWfInit(w, clientId) {
    pt.wf = { id: w ? w.id : '', clientId: clientId, date: w ? w.date : vToday(), title: w ? w.title : '', exercises: w ? w.exercises : '', notes: w ? w.notes : '', cid: '', sig: '' };
  }
  function ptWorkoutForm() {
    var f = pt.wf, id = f.id;
    var h = '<div class="ptwform">' + ptCtl('date', 'ptw-date', 'data-ptw', 'date', f.date, 10, '', 'Date') +
      ptCtl('text', 'ptw-title', 'data-ptw', 'title', f.title, 120, 'e.g. Lower body, week 3', 'Title');
    h += ptCtl('long', 'ptw-exercises', 'data-ptw', 'exercises', f.exercises, 4000, 'One per line: exercise, sets x reps, weight', 'Exercises', 5) +
      ptCtl('long', 'ptw-notes', 'data-ptw', 'notes', f.notes, 1500, 'How it went, what to change', 'Notes', 3);
    h += '<div class="draftbtns"><button type="button" class="bigsave" data-pt="wsave"' + (pt.wbusy ? ' disabled' : '') + '>' + (pt.wbusy === 'save' ? 'Saving\u2026' : (id ? 'Save workout' : 'Add workout')) + '</button><button type="button" class="navbtn discard" data-pt="wcancel">Cancel</button></div>';
    if (id) {
      h += pt.wConfirm === id
        ? '<div class="wlconf ptwconf"><div class="vdelq">Delete this workout?</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" data-pt="wdelyes"' + (pt.wbusy ? ' disabled' : '') + '>Yes, delete</button><button type="button" class="navbtn" data-pt="wdelno">Keep</button></div></div>'
        : '<button type="button" class="navbtn vdelbtn ptwdel" data-pt="wdel">Delete workout</button>';
    }
    return h + '<div class="noteflash" id="pt-wmsg" hidden></div></div>';
  }
  function ptWorkoutsHtml(c) {
    var list = c.workouts || [];
    var h = '<button type="button" class="navbtn wladd ptwadd" data-pt="wnew">+ Add workout</button>';
    if (pt.wfOpen === '(new)' && pt.wf) h += '<div class="card ptwcard">' + ptWorkoutForm() + '</div>';
    if (!list.length && pt.wfOpen !== '(new)') h += '<div class="foot empty">No workouts yet. Tap Add workout.</div>';
    list.forEach(function (w) {
      if (pt.wfOpen === w.id && pt.wf) { h += '<div class="card ptwcard editing">' + ptWorkoutForm() + '</div>'; return; }
      var ex = ptFirstLine(w.exercises, 90), n = String(w.exercises || '').split('\n').filter(Boolean).length;
      h += '<div class="wlitem ptw' + (w.done ? ' isdone' : '') + '"><div class="wlmain"><button type="button" class="wlchk' + (w.done ? ' on' : '') + '" data-pt="wdone" data-id="' + esc(w.id) + '"' + (pt.wbusy === w.id ? ' disabled' : '') +
        ' aria-label="' + (w.done ? 'Mark as not done' : 'Mark as done') + '" aria-pressed="' + w.done + '">' + (w.done ? '\u2713' : '') + '</button>' +
        '<button type="button" class="lntext ptwtext" data-pt="wedit" data-id="' + esc(w.id) + '" aria-label="Edit workout"><span class="wlname">' + esc(w.title) + '</span>' +
        '<small class="wlmeta">' + esc(ptDate(w.date)) + (w.done ? ' \u00b7 done' + (w.doneOn ? ' ' + esc(ptDate(w.doneOn)) : '') : '') + (n ? ' \u00b7 ' + n + ' line' + (n === 1 ? '' : 's') : '') + '</small>' +
        (ex ? '<small class="ptwex">' + esc(ex) + '</small>' : '') + '</button></div></div>';
    });
    return h + '<div class="noteflash" id="pt-wflash" hidden></div>';
  }

  // ---- spoken-value parsing (short fields): the result is shown in the field so it can be corrected ----
  var PT_UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  var PT_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  var PT_ORD = { first: 'one', second: 'two', third: 'three', fourth: 'four', fifth: 'five', sixth: 'six', seventh: 'seven', eighth: 'eight', ninth: 'nine', tenth: 'ten', eleventh: 'eleven', twelfth: 'twelve',
    thirteenth: 'thirteen', fourteenth: 'fourteen', fifteenth: 'fifteen', sixteenth: 'sixteen', seventeenth: 'seventeen', eighteenth: 'eighteen', nineteenth: 'nineteen', twentieth: 'twenty', thirtieth: 'thirty' };
  var PT_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  function ptToks(s) { return String(s || '').toLowerCase().replace(/[-\u2013\u2014]/g, ' ').replace(/[^a-z0-9\/'@. ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); }
  function ptWordsNum(tokens) {          // "forty two" -> 42, "one hundred five" -> 105, "two thousand twenty six" -> 2026; NaN when it is not a clean number
    var total = 0, cur = 0, last = '', any = false;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i]; if (t === 'and') continue;
      if (PT_ORD[t]) t = PT_ORD[t];
      if (/^\d+$/.test(t)) { if (tokens.length === 1) return Number(t); return NaN; }
      if (t === 'oh' && tokens.length === 1) return 0;
      if (PT_UNITS[t] !== undefined) {
        var n = PT_UNITS[t];
        if (n === 0) { if (tokens.length === 1) return 0; return NaN; }
        if (n < 10) { if (last === 'unit' || last === 'teen') return NaN; cur += n; last = 'unit'; }
        else { if (last === 'unit' || last === 'teen' || last === 'tens') return NaN; cur += n; last = 'teen'; }
      } else if (PT_TENS[t]) { if (last === 'unit' || last === 'teen' || last === 'tens') return NaN; cur += PT_TENS[t]; last = 'tens'; }
      else if (t === 'hundred') { if (!cur) return NaN; cur *= 100; last = 'mult'; }
      else if (t === 'thousand') { if (!cur) return NaN; total += cur * 1000; cur = 0; last = 'mult'; }
      else return NaN;
      any = true;
    }
    return any ? total + cur : NaN;
  }
  function ptParseAge(raw) {
    var m = String(raw).match(/\b(\d{1,3})\b/); if (m && +m[1] <= 120) return String(+m[1]);
    var toks = ptToks(raw).filter(function (t) { return PT_UNITS[t] !== undefined || PT_TENS[t] || t === 'hundred' || t === 'and'; });
    var n = ptWordsNum(toks); return isNaN(n) || n < 0 || n > 120 ? null : String(n);
  }
  function ptParsePhone(raw) {
    var toks = ptToks(raw), d = '', i;
    for (i = 0; i < toks.length; i++) {
      var t = toks[i], rep = 1;
      if (t === 'double') { rep = 2; t = toks[++i] || ''; } else if (t === 'triple') { rep = 3; t = toks[++i] || ''; }
      var dig = /^\d+$/.test(t) ? t : (t === 'oh' || t === 'o' ? '0' : (PT_UNITS[t] !== undefined && PT_UNITS[t] < 10 ? String(PT_UNITS[t]) : ''));
      if (dig) for (var r = 0; r < rep; r++) d += dig;
    }
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    if (d.length < 7 || d.length > 15) return null;
    return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : d;
  }
  function ptParseEmail(raw) {
    var s = ' ' + String(raw).toLowerCase().replace(/[,;]+/g, ' ') + ' ';
    s = s.replace(/\s+at\s+sign\s+|\s+at\s+symbol\s+|\s+at\s+the\s+rate\s+(?:of\s+)?|\s+at\s+/g, '@').replace(/\s+dot\s+|\s+period\s+/g, '.').replace(/\s+underscore\s+/g, '_').replace(/\s+(?:dash|hyphen)\s+/g, '-').replace(/\s+plus\s+/g, '+');
    s = s.replace(/\s+/g, '');
    var at = s.indexOf('@'); if (at > 0) s = s.slice(0, at + 1) + s.slice(at + 1).replace(/@/g, '');
    s = s.replace(/\.+$/, '');
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s) ? s : (s.indexOf('@') > 0 ? s : null);
  }
  function ptIso(y, m, d) {
    var dt = new Date(y, m - 1, d, 12); if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  function ptParseDate(raw) {
    var s = String(raw).toLowerCase().trim(), now = new Date(), y0 = now.getFullYear(), m;
    if ((m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return ptIso(+m[1], +m[2], +m[3]);
    if (/^\W*today\W*$/.test(s)) return ptIso(y0, now.getMonth() + 1, now.getDate());
    if (/^\W*(yesterday|tomorrow)\W*$/.test(s)) { var dd = new Date(y0, now.getMonth(), now.getDate() + (/yesterday/.test(s) ? -1 : 1), 12); return ptIso(dd.getFullYear(), dd.getMonth() + 1, dd.getDate()); }
    if ((m = s.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/))) { var yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : y0; return ptIso(yy, +m[1], +m[2]); }
    var toks = ptToks(s), mi = -1, i;
    for (i = 0; i < toks.length; i++) { for (var q = 0; q < 12; q++) if (toks[i] === PT_MONTHS[q] || (toks[i].length >= 3 && PT_MONTHS[q].indexOf(toks[i]) === 0)) { mi = q; break; } if (mi >= 0) { toks.splice(i, 1); break; } }
    if (mi < 0) return null;
    toks = toks.filter(function (t) { return t !== 'the' && t !== 'of' && t !== 'st' && t !== 'nd' && t !== 'rd' && t !== 'th'; }).map(function (t) { return t.replace(/^(\d{1,2})(st|nd|rd|th)$/, '$1'); });
    var day = NaN, used = 0;
    for (var k = Math.min(2, toks.length); k >= 1; k--) { var v = ptWordsNum(toks.slice(0, k)); if (v >= 1 && v <= 31) { day = v; used = k; break; } }
    if (isNaN(day)) return null;
    var rest = toks.slice(used), year = y0;
    if (rest.length) {
      if (rest.length === 1 && /^\d{4}$/.test(rest[0])) year = +rest[0];
      else if (rest.length === 1 && /^\d{2}$/.test(rest[0])) year = 2000 + +rest[0];
      else if ((rest[0] === 'twenty' || rest[0] === 'nineteen') && rest.length > 1) { var tail = rest.slice(1); if (tail[0] === 'oh') tail = tail.slice(1); var tv = ptWordsNum(tail); if (isNaN(tv) || tv > 99) return null; year = (rest[0] === 'twenty' ? 2000 : 1900) + tv; }
      else { var yv = ptWordsNum(rest); if (isNaN(yv) || yv < 1900 || yv > 2100) return null; year = yv; }
    }
    return ptIso(year, mi + 1, day);
  }
  function ptParseName(raw) {
    var s = String(raw).replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.split(' ').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ') : null;
  }
  function ptParseStatus(raw) { var s = String(raw).toLowerCase(); return /paus|hold|inactive/.test(s) ? 'paused' : /activ|resum|current/.test(s) ? 'active' : null; }
  function ptParse(kind, raw) {
    raw = String(raw || '').trim(); if (!raw) return null;
    if (kind === 'age') return ptParseAge(raw);
    if (kind === 'tel') return ptParsePhone(raw);
    if (kind === 'email') return ptParseEmail(raw);
    if (kind === 'date') return ptParseDate(raw);
    if (kind === 'name') return ptParseName(raw);
    if (kind === 'status') return ptParseStatus(raw);
    return raw;
  }
  var PT_NEXT = /^(tab|next|next field|next one|go next|continue)$/;
  var PT_BACK = /^(tab back|back|previous|go back|previous field|last field)$/;
  var PT_SPELL = /^(spelling|spell|spell it|spell that|spell out)$/;
  function ptVoiceCmd(raw) {
    var t = String(raw || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    t = t.replace(/^(please|um+|uh+|okay|ok)\s+/, '').replace(/\s+(please|thanks|thank you)$/, '').trim();
    if (PT_SPELL.test(t)) return 'spell';
    if (PT_BACK.test(t)) return 'back';
    if (PT_NEXT.test(t)) return 'next';
    return '';
  }

  // ---- fields in order, current field, Back / Next bar ----
  var PT_WMETA = { date: { label: 'Date', kind: 'date' }, title: { label: 'Title', kind: 'text' }, exercises: { label: 'Exercises', kind: 'long' }, notes: { label: 'Notes', kind: 'long' } };
  function ptInfo(id) {
    var el = id ? $(id) : null; if (!el) return null;
    if (id === 'ptf-status') return { el: el, kind: 'status', label: 'Status', group: 'f', mode: 'replace' };
    var k = el.getAttribute('data-ptf'), w = el.getAttribute('data-ptw'), d = k ? PT_FIELDS[k] : (w ? PT_WMETA[w] : null);
    if (!d) return null;
    return { el: el, kind: d.kind, label: d.label, key: k || w, group: k ? 'f' : 'w', mode: (d.kind === 'text' || d.kind === 'long') ? 'append' : 'replace' };
  }
  function ptNavList(group) { return [].slice.call($('pt-body').querySelectorAll(group === 'f' ? '[data-ptf], #ptf-status' : '[data-ptw]')); }
  function ptOnForm() { var r = ptRoute(); return ptOnScreen() && (r.kind === 'new' || r.kind === 'client'); }
  function ptBarUpdate() {
    var bar = $('pt-bar'), inf = pt.cur && ptOnForm() ? ptInfo(pt.cur) : null;
    if (!inf) { bar.hidden = true; $('pt-body').classList.remove('ptbarpad'); ptMarkActive(); return; }
    var list = ptNavList(inf.group), i = list.indexOf(inf.el);
    bar.hidden = false; $('pt-body').classList.add('ptbarpad');
    $('pt-barname').textContent = pm.spell ? ('Spell: ' + inf.label) : inf.label;
    $('pt-barstep').textContent = (i + 1) + ' of ' + list.length;
    bar.querySelector('[data-ptbar="back"]').disabled = i <= 0;
    bar.querySelector('[data-ptbar="next"]').textContent = i >= list.length - 1 ? 'Save \u203a' : 'Next \u203a';
    var mb = bar.querySelector('[data-ptbar="mic"]'), on = !!(pm.wanted || pm.on);
    mb.classList.toggle('rec', on); mb.setAttribute('aria-pressed', on ? 'true' : 'false');
    ptMarkActive(); ptBarPos();
  }
  function ptBarPos() {              // keep the bar / spell sheet above the on-screen keyboard
    var vv = window.visualViewport, off = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    $('pt-bar').style.bottom = off + 'px'; $('pt-spell').style.bottom = off + 'px';
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', ptBarPos); window.visualViewport.addEventListener('scroll', ptBarPos); }
  function ptSetOpen(card, open) {
    var k = card.getAttribute('data-ptsec'), m = ptOpenMap(); m[k] = open ? 1 : 0; lsSet(PT_OPEN_KEY, m);
    card.classList.toggle('collapsed', !open); var hd = card.querySelector('h2.pth'); if (hd) hd.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function ptFocusField(el) {
    var card = el.closest('[data-ptsec]'); if (card && card.classList.contains('collapsed')) ptSetOpen(card, true);
    var f = el.id === 'ptf-status' ? (el.querySelector('.vchip.on') || el.querySelector('.vchip')) : el;
    pt.cur = el.id; try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    try { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e2) { f.scrollIntoView(); }
    ptBarUpdate();
  }
  function ptMove(dir, keepMic) {
    var inf = ptInfo(pt.cur); if (!inf) return;
    var list = ptNavList(inf.group), i = list.indexOf(inf.el), j = i + dir;
    if (!keepMic) { ptMicStop(true); ptMicUi(); }
    if (j < 0) return;
    if (j >= list.length) {          // past the last field: Save
      if (keepMic) { pm.wanted = false; ptMicStop(true); ptMicUi(); }
      var sv = inf.group === 'f' ? $('pt-save') : document.querySelector('[data-pt="wsave"]');
      if (sv) { sv.focus({ preventScroll: true }); sv.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    ptFocusField(list[j]);
    if (keepMic && pm.wanted) pm.id = list[j].id;
  }
  $('pt-body').addEventListener('focusin', function (e) {
    var t = e.target, fld = t.closest ? t.closest('[data-ptf], [data-ptw], #ptf-status') : null;
    if (fld && fld.id) { pt.cur = fld.id; ptBarUpdate(); }
  });
  $('pt-body').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    var t = e.target; if (!t || t.tagName !== 'INPUT' || t.type === 'search' || !(t.hasAttribute('data-ptf') || t.hasAttribute('data-ptw'))) return;
    e.preventDefault(); pt.cur = t.id; ptMove(1);
  });

  // ---- form mic: one mic for the whole client / workout form; speech fills the focused field ----
  function ptMarkActive() {
    [].forEach.call($('pt-body').querySelectorAll('.vfield.pton'), function (el) { el.classList.remove('pton'); });
    if (!(pm.wanted || pm.on) || !pt.cur) return;
    var vf = document.querySelector('.vfield[data-ptid="' + pt.cur + '"]');
    if (!vf) { var el = $(pt.cur); if (el) vf = el.closest('.vfield'); }
    if (vf) vf.classList.add('pton');
  }
  function ptMicStatus(text, warn) {
    pm.msg = text || '';
    var el = $('pt-mic-state');
    if (el) { el.textContent = text || '\u00a0'; el.className = 'micstate' + (warn ? ' warn' : ((pm.wanted || pm.on) && text ? ' rec' : '')); }
    var lbl = $('pt-form-mic-lbl');
    if (lbl) lbl.textContent = (pm.wanted || pm.on) ? (pm.spell ? 'Spell mode \u2014 tap to stop' : 'Listening \u2014 tap to stop') : 'Tap to talk';
  }
  function ptMicUi() {
    var on = !!(pm.wanted || pm.on);
    var fb = $('pt-form-mic'); if (fb) { fb.classList.toggle('rec', on); fb.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (!$('pt-bar').hidden) ptBarUpdate(); else ptMarkActive();
    if (!on && !pm.msg) ptMicStatus('');
  }
  function ptMicFail(msg) {
    var r = pm.rec; pm.on = false; pm.wanted = false; pm.spell = false; pm.rec = null;
    try { r && r.abort(); } catch (e) {}
    ptMicStatus(msg, true); ptMicUi();
    var ta = $(pt.cur); if (ta && ta.focus && ta.id !== 'ptf-status') ta.focus();
  }
  function ptSetStatus(v) {
    pt.form.status = v === 'paused' ? 'paused' : 'active';
    [].forEach.call($('pt-body').querySelectorAll('#ptf-status .vchip'), function (c) { var on = c.getAttribute('data-s') === pt.form.status; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var s = document.querySelector('[data-ptsec="basics"] .ptsum span'); if (s) s.innerHTML = ptSecSummary('basics', null);
  }
  function ptEnsureField() {
    if (pt.cur && ptInfo(pt.cur)) return ptInfo(pt.cur);
    var first = $('ptf-name') || (ptNavList('f')[0]) || (ptNavList('w')[0]);
    if (!first) return null;
    ptFocusField(first);
    return ptInfo(pt.cur);
  }
  function ptFormMicToggle() {
    if (pm.wanted || pm.on) { ptMicStop(true); ptMicUi(); ptMicStatus(''); return; }
    ptMicArm();
  }
  function ptMicArm() {
    if (sp.open) ptSpellClose();
    var inf = ptEnsureField(); if (!inf) return;
    pm.wanted = true; pm.spell = false; pm.msg = '';
    ptMicStatus('Listening for ' + inf.label + '\u2026');
    ptMicListen();
  }
  function ptMicRestart() {
    if (!pm.wanted || !ptOnForm()) { ptMicUi(); return; }
    setTimeout(function () { if (pm.wanted && ptOnForm() && !pm.on) ptMicListen(); }, 140);
  }
  function ptApplySpoken(inf, raw) {
    var ta = inf.el, isStatus = inf.kind === 'status';
    if (inf.mode === 'append') {
      ta.value = ((pm.base || '') + raw).replace(/\s+$/, '');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    var parsed = ptParse(inf.kind, raw);
    if (parsed == null) {
      if (!isStatus) ta.value = pm.prev;
      ptMicStatus('Heard \u201c' + raw + '\u201d \u2014 that did not look like a valid ' + inf.label.toLowerCase() + '. Try again or say spelling.', true);
      return false;
    }
    if (isStatus) ptSetStatus(parsed); else { ta.value = parsed; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    ptMicStatus('Listening for ' + inf.label + '\u2026');
    return true;
  }
  function ptApplySpelled(inf, raw) {
    var p = ptSpellParse(raw), ta = inf.el;
    if (p.back) { ta.value = String(ta.value || '').slice(0, -1); ta.dispatchEvent(new Event('input', { bubbles: true })); pm.spell = false; ptMicStatus('Listening for ' + inf.label + '\u2026'); return; }
    if (p.clear) { ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); pm.spell = false; ptMicStatus('Listening for ' + inf.label + '\u2026'); return; }
    var w = p.add || '';
    if (!w) { ptMicStatus('Spell mode\u2026 say the letters (A B C, or A as in apple)', true); return; }
    if (inf.kind === 'name' || inf.key === 'name') w = w.split(/(\s+)/).map(function (x) { return /^\s+$/.test(x) ? x : (x ? x.charAt(0).toUpperCase() + x.slice(1) : x); }).join('');
    ta.value = w;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    pm.spell = false;
    ptMicStatus('Spelled \u201c' + w + '\u201d. Listening for ' + inf.label + '\u2026');
  }
  function ptMicListen() {
    var inf = ptEnsureField(), ta = inf && inf.el; if (!ta || !pm.wanted) return;
    if (pm.on) return;
    pm.id = pt.cur; pm.inf = inf;
    var isStatus = inf.kind === 'status', append = inf.mode === 'append';
    if (!SR) { return ptMicFail(MIC_NA); }
    pm.prev = isStatus ? '' : ta.value;
    pm.base = append && ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
    pm.committed = ''; pm.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return ptMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      if (!pm.wanted || pm.rec !== rec) return;
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) pm.committed = micSpace(pm.committed, t.trim() + ' '); else interim += t;
      }
      pm.interim = interim.replace(/^\s+/, '');
      if (pm.spell || isStatus || inf.kind === 'date') return;          // don't live-type into spell / status / date
      ta.value = (append ? pm.base : '') + pm.committed + pm.interim;
      ta.scrollTop = ta.scrollHeight;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return ptMicFail(MIC_NA);
      if (e === 'network') return ptMicFail('The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.');
      if (e === 'no-speech') ptMicStatus(pm.spell ? 'Spell mode\u2026 didn\u2019t catch that. Try again.' : ('Listening for ' + (ptInfo(pt.cur) || inf).label + '\u2026 say the value, tab, or spelling'), true);
    };
    rec.onend = function () {
      if (pm.rec !== rec) return;
      var raw = micSpace(pm.committed, pm.interim ? pm.interim.trim() + ' ' : '').trim(); pm.interim = '';
      pm.on = false; pm.rec = null;
      // apply to the field this listen started on (interim was shown there); nav uses current focus
      inf = ptInfo(pm.id) || ptInfo(pt.cur) || inf; ta = inf && inf.el; isStatus = !!(inf && inf.kind === 'status');
      if (inf && inf.el && inf.el.id) pt.cur = inf.el.id === 'ptf-status' ? 'ptf-status' : inf.el.id;
      if (!pm.wanted) { ptMicUi(); return; }
      if (!raw) { if (inf && !isStatus && !pm.spell) ta.value = pm.prev; ptMicUi(); ptMicRestart(); return; }
      var cmd = ptVoiceCmd(raw);
      if (cmd === 'spell') {
        if (!isStatus) ta.value = pm.prev;
        if (inf && inf.kind === 'status') { ptMicStatus('Status can\u2019t be spelled. Say active or paused, or tab.', true); ptMicUi(); ptMicRestart(); return; }
        pm.spell = true; ptMicStatus('Spell mode\u2026 say the letters'); ptBarUpdate(); ptMicUi(); ptMicRestart(); return;
      }
      if (cmd === 'next' || cmd === 'back') {
        if (!isStatus) ta.value = pm.prev;
        pm.spell = false;
        ptMove(cmd === 'next' ? 1 : -1, true);
        inf = ptInfo(pt.cur);
        if (inf && pm.wanted) ptMicStatus('Listening for ' + inf.label + '\u2026');
        ptMicUi(); ptMicRestart(); return;
      }
      if (pm.spell) { ptApplySpelled(inf, raw); ptMicUi(); ptMicRestart(); return; }
      ptApplySpoken(inf, raw); ptMicUi(); ptMicRestart();
    };
    pm.rec = rec; pm.on = true;
    try { rec.start(); } catch (e2) { return ptMicFail(MIC_NA); }
    if (!pm.spell) ptMicStatus('Listening for ' + inf.label + '\u2026');
    ptMicUi();
  }
  function ptMicStop(quiet) {       // quiet = abort (leaving / re-rendering); otherwise stop() and onend fills the field
    pm.wanted = false; pm.spell = false;
    var r = pm.rec;
    if (quiet) { pm.rec = null; pm.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { pm.rec = null; pm.on = false; ptMicUi(); } }
    else { pm.on = false; ptMicUi(); }
  }

  // ---- Spell-out: letters (dictated or typed) -> one word -> Replace field / Replace last word ----
  var sp = { open: false, id: '', word: '', cap: false, rec: null, on: false };
  var SP_NAMES = { ay: 'a', bee: 'b', be: 'b', cee: 'c', sea: 'c', see: 'c', dee: 'd', ee: 'e', eff: 'f', gee: 'g', aitch: 'h', eye: 'i', jay: 'j', kay: 'k', el: 'l', ell: 'l', em: 'm', en: 'n', oh: 'o', pee: 'p',
    cue: 'q', queue: 'q', are: 'r', ess: 's', tee: 't', tea: 't', you: 'u', vee: 'v', ex: 'x', why: 'y', zee: 'z', zed: 'z' };
  var SP_SYM = { dash: '-', hyphen: '-', apostrophe: "'", space: ' ', dot: '.', period: '.', underscore: '_' };
  var SP_DIG = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
  // "J O H N" / "j-o-h-n" / "jay oh aitch en" / "J as in John, O as in Oscar" / "johnson" -> {add:'john'} ; "backspace" -> {back:1} ; "clear" -> {clear:1}
  function ptSpellParse(text) {
    var raw = String(text || '').toLowerCase().trim();
    var one = raw.replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^(backspace|delete|undo|delete that|erase)$/.test(one)) return { back: 1 };
    if (/^(clear|clear all|start over|reset)$/.test(one)) return { clear: 1 };
    var toks = raw.replace(/[.,;:!?]+/g, ' ').replace(/(\w)-(?=\w)/g, '$1 ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), out = '';
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if ((t === 'as' && toks[i + 1] === 'in') || t === 'like') { i += (t === 'as' ? 2 : 1); continue; }                 // the code word after "as in" is skipped
      if (t === 'for' && out && toks[i - 1] && toks[i - 1].length === 1) { i += 1; continue; }                     // "J for John"
      if (t === 'double' && toks[i + 1] === 'you') { out += 'w'; i++; continue; }
      if (t === 'double' && toks[i + 1] && toks[i + 1].length === 1) { out += toks[i + 1] + toks[i + 1]; i++; continue; }
      if (t === 'at' && toks[i + 1] === 'sign') { out += '@'; i++; continue; }
      if (SP_SYM[t] !== undefined) { out += SP_SYM[t]; continue; }
      if (SP_NAMES[t]) { out += SP_NAMES[t]; continue; }
      if (SP_DIG[t]) { out += SP_DIG[t]; continue; }
      if (/^[a-z0-9@'_.\-]+$/.test(t)) { out += t; continue; }                          // single letters, digits, or a whole word typed / heard joined
    }
    return { add: out };
  }
  function ptSpellShown() {
    var w = sp.word; if (sp.cap && w) w = w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  }
  function ptSpellUi() {
    var inf = ptInfo(sp.id); if (!inf) return;
    $('ps-title').textContent = 'Spell: ' + inf.label;
    var w = ptSpellShown(), pend = ptSpellParse($('ps-in').value).add || '';
    $('ps-word').innerHTML = esc(w) + (pend ? '<span class="pspend">' + esc(pend) + '</span>' : '') + (w || pend ? '' : '<span class="psph">Letters appear here</span>');
    $('ps-cap').classList.toggle('on', sp.cap); $('ps-cap').setAttribute('aria-pressed', sp.cap ? 'true' : 'false');
    var mb = $('ps-mic'); mb.classList.toggle('rec', sp.on); mb.setAttribute('aria-pressed', sp.on ? 'true' : 'false');
  }
  function ptSpellCommit() {       // typed letters -> word
    var p = ptSpellParse($('ps-in').value); $('ps-in').value = '';
    if (p.back) sp.word = sp.word.slice(0, -1); else if (p.clear) sp.word = ''; else if (p.add) sp.word += p.add;
  }
  function ptSpellOpen(id) {
    var inf = ptInfo(id); if (!inf || inf.kind === 'status') return;
    ptMicStop(true); ptMicUi();
    sp.open = true; sp.id = id; sp.word = ''; sp.cap = inf.kind === 'name' || (inf.key === 'name'); $('ps-in').value = ''; $('ps-state').textContent = '';
    $('pt-spell').hidden = false; $('pt-bar').hidden = true; ptSpellUi(); ptBarPos();
    $('ps-in').focus({ preventScroll: true });
  }
  function ptSpellClose() { spellMicStop(true); sp.open = false; $('pt-spell').hidden = true; ptBarUpdate(); }
  function spellMicStop(quiet) { var r = sp.rec; sp.rec = null; sp.on = false; try { if (r) { if (quiet) r.abort(); else r.stop(); } } catch (e) {} }
  function ptSpellMic() {
    if (sp.on) { var r = sp.rec; try { r && r.stop(); } catch (e) { sp.on = false; sp.rec = null; } return; }
    ptMicStop(true);
    if (!SR) { $('ps-state').textContent = MIC_NA; return; }
    var rec; try { rec = new SR(); } catch (e) { $('ps-state').textContent = MIC_NA; return; }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    var heard = '';
    rec.onresult = function (ev) {
      var txt = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) { var r = ev.results[i]; if (r[0]) { if (r.isFinal) heard = micSpace(heard, r[0].transcript.trim() + ' '); else txt += r[0].transcript; } }
      $('ps-in').value = (heard + txt).trim(); ptSpellUi();
    };
    rec.onerror = function (ev) { var e = ev && ev.error; sp.on = false; sp.rec = null; $('ps-state').textContent = (e === 'no-speech') ? 'Didn\u2019t catch anything. Tap the mic and try again.' : MIC_NA; ptSpellUi(); };
    rec.onend = function () {
      if (sp.rec !== rec) return;
      sp.on = false; sp.rec = null;
      var p = ptSpellParse($('ps-in').value || heard); $('ps-in').value = '';
      if (p.back) sp.word = sp.word.slice(0, -1); else if (p.clear) sp.word = ''; else if (p.add) sp.word += p.add;
      $('ps-state').textContent = p.add ? 'Added \u201c' + p.add + '\u201d. Tap the mic for more letters.' : ''; ptSpellUi();
    };
    sp.rec = rec; sp.on = true;
    try { rec.start(); } catch (e2) { sp.on = false; sp.rec = null; $('ps-state').textContent = MIC_NA; }
    $('ps-state').textContent = 'Listening\u2026 say the letters'; ptSpellUi();
  }
  function ptSpellUse(mode) {
    ptSpellCommit(); var inf = ptInfo(sp.id), w = ptSpellShown(); if (!inf || !w) { $('ps-state').textContent = 'Nothing spelled yet.'; return; }
    var el = inf.el, v = el.value || '';
    if (mode === 'last') { var m = v.match(/^([\s\S]*?)(\S+)(\s*)$/); el.value = m ? m[1] + w + m[3] : w; } else el.value = w;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    ptSpellClose();
  }

  // ---- bar + spell sheet (live outside #pt-body so re-renders keep them) ----
  (function ptBuildBar() {
    var bar = document.createElement('div'); bar.id = 'pt-bar'; bar.className = 'ptbar'; bar.hidden = true;
    bar.innerHTML = '<div class="ptbarlbl"><b id="pt-barname"></b><span id="pt-barstep"></span></div><div class="ptbarbtns">' +
      '<button type="button" class="navbtn" data-ptbar="back">\u2039 Back</button><button type="button" class="navbtn" data-ptbar="spell">Spell</button>' +
      '<button type="button" class="micbtn ptmic" data-ptbar="mic" aria-pressed="false" aria-label="Dictate the form">' + vsvg('mic', 24) + '</button><button type="button" class="bigsave" data-ptbar="next">Next \u203a</button></div>';
    $('screen-pt').appendChild(bar);
    var sh = document.createElement('div'); sh.id = 'pt-spell'; sh.className = 'ptspell'; sh.hidden = true; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Spell it out');
    sh.innerHTML = '<div class="pshead"><b id="ps-title">Spell</b><button type="button" class="wlx" data-ptsp="close" aria-label="Close">\u00d7</button></div>' +
      '<div class="psword" id="ps-word" aria-live="polite"></div><div class="micstate" id="ps-state"></div>' +
      '<div class="psrow"><input class="wlin" id="ps-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Letters, e.g. J O H N or J as in John" aria-label="Letters">' +
      '<button type="button" class="micbtn ptmic" id="ps-mic" data-ptsp="mic" aria-pressed="false" aria-label="Say the letters">' + vsvg('mic', 24) + '</button></div>' +
      '<div class="psbtns"><button type="button" class="navbtn" data-ptsp="add">Add</button><button type="button" class="navbtn" data-ptsp="back" aria-label="Backspace">\u232b</button>' +
      '<button type="button" class="navbtn" data-ptsp="clear">Clear</button><button type="button" class="navbtn" id="ps-cap" data-ptsp="cap" aria-pressed="false">Aa</button></div>' +
      '<div class="psuse"><button type="button" class="bigsave" data-ptsp="field">Replace field</button><button type="button" class="bigsave" data-ptsp="last">Replace last word</button></div>';
    $('screen-pt').appendChild(sh);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ptbar]'); if (!b) return; var a = b.getAttribute('data-ptbar');
      if (a === 'back') ptMove(-1); else if (a === 'next') ptMove(1); else if (a === 'spell') ptSpellOpen(pt.cur);
      else if (a === 'mic') ptFormMicToggle();
    });
    bar.addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });      // keep the field focused (keyboard stays up)
    sh.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ptsp]'); if (!b) return; var a = b.getAttribute('data-ptsp');
      if (a === 'close') ptSpellClose();
      else if (a === 'mic') ptSpellMic();
      else if (a === 'add') { ptSpellCommit(); ptSpellUi(); $('ps-in').focus({ preventScroll: true }); }
      else if (a === 'back') { ptSpellCommit(); sp.word = sp.word.slice(0, -1); ptSpellUi(); }
      else if (a === 'clear') { $('ps-in').value = ''; sp.word = ''; ptSpellUi(); }
      else if (a === 'cap') { sp.cap = !sp.cap; ptSpellUi(); }
      else if (a === 'field') ptSpellUse('field');
      else if (a === 'last') ptSpellUse('last');
    });
    sh.addEventListener('input', function (e) { if (e.target.id === 'ps-in') ptSpellUi(); });
    sh.addEventListener('keydown', function (e) {
      if (e.target.id !== 'ps-in') return;
      if (e.key === 'Enter') { e.preventDefault(); ptSpellCommit(); ptSpellUi(); }
      else if (e.key === 'Backspace' && !e.target.value) { e.preventDefault(); sp.word = sp.word.slice(0, -1); ptSpellUi(); }      // Backspace on an empty box removes the last assembled letter
    });
  })();

  // ---- data updates ----
  function ptApply(c) {                  // a client (with workouts) came back from the server
    if (!c || !c.id) return;
    c.workouts = c.workouts || [];
    c.workoutCount = c.workouts.length; c.doneCount = c.workouts.filter(function (x) { return x.done; }).length;
    var d = c.workouts.filter(function (x) { return x.done; })[0] || c.workouts[0]; c.lastWorkout = d ? d.date : '';
    var l = pt.data.clients, hit = -1;
    l.forEach(function (x, i) { if (x.id === c.id) hit = i; });
    if (hit >= 0) l[hit] = c; else l.push(c);
    l.sort(function (a, b) { return a.status === b.status ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : (a.status === 'active' ? -1 : 1); });
    pt.at = Date.now();
  }
  function ptFormGather() {
    var o = {};
    Object.keys(PT_FIELDS).forEach(function (k) { o[k] = String(pt.form[k] == null ? '' : pt.form[k]).replace(/^\s+|\s+$/g, ''); });
    return o;
  }
  function ptSave() {
    if (pt.busy) return;
    var v = ptFormGather(), r = ptRoute(), c = r.kind === 'client' ? ptClient(r.id) : null;
    if (!v.name) return ptMsg('pt-msg', 'Enter the client\u2019s name first.', true);
    if (v.age !== '' && !(/^\d{1,3}$/.test(v.age) && +v.age <= 120)) return ptMsg('pt-msg', 'Age should be a whole number.', true);
    if (v.email !== '' && !/^\S+@\S+\.\S+$/.test(v.email)) return ptMsg('pt-msg', 'That email does not look right.', true);
    var body = {}; Object.keys(v).forEach(function (k) { body[k] = v[k]; });
    if (c) body.id = c.id;
    var sig = JSON.stringify(body); if (pt.form.sig !== sig) { pt.form.sig = sig; pt.form.cid = vNewCid(); }      // changed since a failed try: new entry id; an unchanged retry keeps its id so it never doubles
    body.cid = pt.form.cid; pt.busy = true; var btn = $('pt-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; } ptMsg('pt-msg', '');
    apiPostRaw('ptclientset', body, 60000).then(function (j) {
      pt.busy = false;
      if (j.error) { var b = $('pt-save'); if (b) { b.disabled = false; b.textContent = c ? 'Save client' : 'Add client'; } return ptMsg('pt-msg', ptApiMsg(j) + (j.error === 'bad_action' ? ' Nothing was saved.' : ''), true); }
      var nc = j.data && j.data.client;
      if (nc) { ptApply(nc); pt.formId = ''; }
      if (!c && nc) { pt.flash = 'Added ' + nc.name + '.'; show('pt/client/' + encodeURIComponent(nc.id)); return; }
      if (nc) ptFormInit(nc);
      ptRender(); ptMsg('pt-msg', j.data && j.data.unchanged ? 'Nothing had changed.' : 'Saved.', false);
    }, function (err) {
      pt.busy = false;
      if (vAuth(err)) return;
      var b = $('pt-save'); if (b) { b.disabled = false; b.textContent = c ? 'Save client' : 'Add client'; }
      ptMsg('pt-msg', friendly(err) + ' Not confirmed yet: tap Save again to retry (same entry id, it will not double).', true);
    });
  }
  function ptDelete() {
    var r = ptRoute(), c = ptClient(r.id); if (!c || pt.busy) return;
    pt.busy = true;
    apiPostRaw('ptclientdel', { id: c.id, name: c.name, cid: vNewCid() }, 60000).then(function (j) {
      pt.busy = false;
      if (j.error) { pt.cConfirm = false; ptRender(); return ptMsg('pt-msg', ptApiMsg(j), true); }
      pt.data.clients = pt.data.clients.filter(function (x) { return x.id !== c.id; }); pt.formId = ''; pt.cConfirm = false;
      pt.flash = 'Deleted ' + c.name + '.'; show('pt');
    }, function (err) {
      pt.busy = false;
      if (vAuth(err)) return;
      pt.cConfirm = false; ptRender(); ptMsg('pt-msg', friendly(err) + ' Not confirmed: check the list before trying again.', true);
    });
  }
  function ptWorkoutSave() {
    if (pt.wbusy || !pt.wf) return;
    var f = pt.wf, r = ptRoute(), c = ptClient(r.id); if (!c) return;
    var body = { clientId: c.id, date: String(f.date || '').trim(), title: String(f.title || '').replace(/^\s+|\s+$/g, ''), exercises: String(f.exercises || '').replace(/\s+$/, ''), notes: String(f.notes || '').replace(/\s+$/, '') };
    if (!body.title) return ptMsg('pt-wmsg', 'Give the workout a title.', true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return ptMsg('pt-wmsg', 'Pick a date.', true);
    if (f.id) body.id = f.id;
    var sig = JSON.stringify(body); if (f.sig !== sig) { f.sig = sig; f.cid = vNewCid(); }
    body.cid = f.cid; pt.wbusy = 'save'; ptMsg('pt-wmsg', '');
    var btn = document.querySelector('[data-pt="wsave"]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    apiPostRaw('ptworkoutset', body, 60000).then(function (j) {
      pt.wbusy = '';
      if (j.error) { if (btn) { btn.disabled = false; btn.textContent = f.id ? 'Save workout' : 'Add workout'; } return ptMsg('pt-wmsg', ptApiMsg(j) + (j.error === 'bad_action' ? ' Nothing was saved.' : ''), true); }
      var w = j.data && j.data.workout;
      if (w) { var ws = (c.workouts || []).filter(function (x) { return x.id !== w.id; }); ws.push(w); ws.sort(function (a, b) { return a.date === b.date ? b.row - a.row : (a.date < b.date ? 1 : -1); }); c.workouts = ws; ptApply(c); }
      pt.wf = null; pt.wfOpen = ''; pt.wConfirm = ''; ptRender(); ptMsg('pt-wflash', 'Workout saved.', false);
    }, function (err) {
      pt.wbusy = '';
      if (vAuth(err)) return;
      if (btn) { btn.disabled = false; btn.textContent = f.id ? 'Save workout' : 'Add workout'; }
      ptMsg('pt-wmsg', friendly(err) + ' Not confirmed yet: tap Save again to retry (same entry id, it will not double).', true);
    });
  }
  function ptWorkoutDone(id) {
    var r = ptRoute(), c = ptClient(r.id); if (!c || pt.wbusy) return;
    var w = (c.workouts || []).filter(function (x) { return x.id === id; })[0]; if (!w) return;
    var to = !w.done; pt.wbusy = id; ptRender();
    apiPostRaw('ptworkoutset', { id: id, clientId: c.id, done: to ? 1 : 0, cid: vNewCid() }, 60000).then(function (j) {
      pt.wbusy = '';
      if (j.error) { ptRender(); return ptMsg('pt-wflash', ptApiMsg(j), true); }
      var nw = j.data && j.data.workout; if (nw) { c.workouts = c.workouts.map(function (x) { return x.id === id ? nw : x; }); ptApply(c); }
      ptRender();
    }, function (err) {
      pt.wbusy = '';
      if (vAuth(err)) return;
      ptRender(); ptMsg('pt-wflash', friendly(err) + ' Not changed.', true);
    });
  }
  function ptWorkoutDelete() {
    var r = ptRoute(), c = ptClient(r.id), f = pt.wf; if (!c || !f || !f.id || pt.wbusy) return;
    pt.wbusy = 'del';
    apiPostRaw('ptworkoutdel', { id: f.id, title: f.title || (c.workouts.filter(function (x) { return x.id === f.id; })[0] || {}).title || '', cid: vNewCid() }, 60000).then(function (j) {
      pt.wbusy = '';
      if (j.error) { pt.wConfirm = ''; ptRender(); return ptMsg('pt-wmsg', ptApiMsg(j), true); }
      c.workouts = c.workouts.filter(function (x) { return x.id !== f.id; }); ptApply(c);
      pt.wf = null; pt.wfOpen = ''; pt.wConfirm = ''; ptRender(); ptMsg('pt-wflash', 'Workout deleted.', false);
    }, function (err) {
      pt.wbusy = '';
      if (vAuth(err)) return;
      pt.wConfirm = ''; ptRender(); ptMsg('pt-wmsg', friendly(err) + ' Not confirmed: check the list before trying again.', true);
    });
  }

  // ---- events ----
  $('pt-body').addEventListener('click', function (e) {
    var hd = e.target.closest('h2.pth');
    if (hd) {
      var card = hd.closest('[data-ptsec]'); ptSetOpen(card, card.classList.contains('collapsed'));
      return;
    }
    var b = e.target.closest('[data-pt]'); if (!b) return;
    var a = b.getAttribute('data-pt'), id = b.getAttribute('data-id');
    if (a === 'reload') { pt.na = false; ptLoad(true); }
    else if (a === 'filter') { pt.filter = b.getAttribute('data-f'); ptRender(); }
    else if (a === 'formmic' || a === 'mic') ptFormMicToggle();
    else if (a === 'status') { ptSetStatus(b.getAttribute('data-s')); pt.cur = 'ptf-status'; ptBarUpdate(); }
    else if (a === 'save') ptSave();
    else if (a === 'cancel') { ptMicStop(true); var cc = ptClient(ptRoute().id); if (cc) { ptFormInit(cc); ptRender(); } else { pt.formId = ''; show('pt'); } }
    else if (a === 'del') { pt.cConfirm = true; ptRender(); }
    else if (a === 'delno') { pt.cConfirm = false; ptRender(); }
    else if (a === 'delyes') ptDelete();
    else if (a === 'wnew') { ptWfInit(null, ptRoute().id); pt.wfOpen = '(new)'; pt.wConfirm = ''; ptRender(); var t = $('ptw-title'); if (t) t.focus(); }
    else if (a === 'wedit') { var c = ptClient(ptRoute().id), w = c && (c.workouts || []).filter(function (x) { return x.id === id; })[0]; if (!w) return; ptWfInit(w, c.id); pt.wfOpen = id; pt.wConfirm = ''; ptRender(); }
    else if (a === 'wcancel') { pt.wf = null; pt.wfOpen = ''; pt.wConfirm = ''; ptRender(); }
    else if (a === 'wsave') ptWorkoutSave();
    else if (a === 'wdone') ptWorkoutDone(id);
    else if (a === 'wdel') { pt.wConfirm = pt.wf ? pt.wf.id : ''; ptRender(); }
    else if (a === 'wdelno') { pt.wConfirm = ''; ptRender(); }
    else if (a === 'wdelyes') ptWorkoutDelete();
  });
  $('pt-body').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'pt-q') { pt.q = t.value; var box = $('pt-list'); if (box) box.innerHTML = ptListRows(); return; }
    var k = t.getAttribute && t.getAttribute('data-ptf');
    if (k && pt.form) { pt.form[k] = t.value; var s = document.querySelector('[data-ptsec="' + (PT_SECS.filter(function (x) { return x.fields.indexOf(k) >= 0; })[0] || {}).key + '"] .ptsum span'); if (s) s.innerHTML = ptSecSummary((PT_SECS.filter(function (x) { return x.fields.indexOf(k) >= 0; })[0] || {}).key, null); return; }
    var wk = t.getAttribute && t.getAttribute('data-ptw');
    if (wk && pt.wf) pt.wf[wk] = t.value;
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && pm.on) { ptMicStop(true); ptMicUi(); } });

  /* ---------------- Lisa's Table: Orders (#lt/orders) — Current | Previous | Summary ---------------- */
  // Orders live on the server ("Lisa's Table - Orders" sheet; actions orders / orderset / orderpaid / orderdel). Nothing about clients or orders is
  // stored in this repo; the phone keeps only a cache of known client names (localStorage cc_clients) as a fallback for the client picker.
  var OD_CLIENTS_KEY = 'cc_clients';
  var OD_NA = 'Orders will work after the next server update.';
  var od = { tab: 'current', week: '', sumWeek: '', prevWeek: '', byWeek: {}, weeks: [], clients: [], exists: false, loading: false, err: '', na: false,
    form: null, confirmDel: '', picker: null, busy: {}, inflight: {}, seq: 0, mic: { rec: null, on: false, base: '', committed: '', interim: '', msg: '' } };
  var OD_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function odOnScreen() { return state.ltPart === 'orders' && $('screen-lt').classList.contains('active'); }
  function odDefaultWeek() { var d = new Date(); return mgIso(d.getDay() === 1 ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12) : mgNextMonday(d)); }
  function odMonday(iso) {            // any date -> the Monday on or before it (yyyy-mm-dd)
    var d = mgDate(iso); if (!d) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return mgIso(d);
  }
  function odShort(iso) { var d = mgDate(iso); return d ? OD_MON[d.getMonth()] + ' ' + d.getDate() : String(iso || ''); }
  function odMoney(n) {
    n = Math.round(Number(n || 0) * 100) / 100;
    return '$' + (n === Math.floor(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }
  function odPlus(iso, n) { return mgAddDays(iso, n); }
  function odFlash(text, bad) { var el = $('od-flash'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function odApiMsg(j, what) {
    if (!j || !j.error) return 'Something went wrong.';
    if (j.error === 'bad_action') return what + ' will work after the next server update.';
    return j.message || ('Server error: ' + j.error);
  }
  function odClients() {
    var l = (od.clients && od.clients.length) ? od.clients : lsGet(OD_CLIENTS_KEY, []).map(function (n) { return { name: String(n), orders: 0, last: '' }; });
    return l.filter(function (c) { return c && c.name; });
  }
  function odClientsSave() {
    var names = od.clients.map(function (c) { return c.name; }).filter(Boolean).slice(0, 300);
    if (names.length) lsSet(OD_CLIENTS_KEY, names);
  }
  function odClientAdd(name) {          // a client just saved: show up first in the picker straight away
    var k = norm(name), rest = od.clients.filter(function (c) { return norm(c.name) !== k; });
    var old = od.clients.filter(function (c) { return norm(c.name) === k; })[0];
    rest.unshift({ name: name, orders: (old ? old.orders : 0) + 1, last: od.week });
    od.clients = rest; odClientsSave();
  }
  function odOrders(week) { var W = od.byWeek[week]; return W ? W.orders : null; }
  // ---- delivery fee + payment (server v41+). An older server sends neither: missing fee = 0, status from the paid boolean ----
  var OD_FEES = [0, 3, 5], OD_METHODS = ['cash', 'zelle', 'venmo'];
  function odCap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function odNormOrder(o) {
    if (!o) return o;
    var fee = Number(o.deliveryFee); fee = OD_FEES.indexOf(fee) >= 0 ? fee : 0;
    var sub = o.subtotal != null ? Number(o.subtotal) : (o.lines && o.lines.length ? o.lines.reduce(function (a, l) { return a + Number(l.lineTotal || 0); }, 0) : Number(o.total || 0));
    var ps = (o.payStatus === 'paid' || o.payStatus === 'unpaid' || o.payStatus === 'trade') ? o.payStatus : (o.paid ? 'paid' : 'unpaid');
    o.deliveryFee = fee; o.subtotal = Math.round(sub * 100) / 100; o.total = Math.round((sub + fee) * 100) / 100;
    o.payStatus = ps; o.payMethod = ps === 'paid' && OD_METHODS.indexOf(o.payMethod) >= 0 ? o.payMethod : ''; o.paid = ps === 'paid';
    if (!o.paid) o.paidOn = '';
    return o;
  }
  function odPayLabel(o) { return o.payStatus === 'paid' ? 'Paid' + (o.payMethod ? ' \u00b7 ' + odCap(o.payMethod) : '') : o.payStatus === 'trade' ? 'Trade' : 'Unpaid'; }
  function odAgg(orders) {
    var t = { clients: orders.length, items: 0, subtotal: 0, delivery: 0, deliveries: 0, total: 0, paid: 0, unpaid: 0, trade: 0, paidCount: 0, unpaidCount: 0, tradeCount: 0,
      byMethod: { cash: 0, zelle: 0, venmo: 0, unspecified: 0 }, rows: [] }, by = {};
    orders.forEach(function (o) {
      t.items += o.items; t.subtotal += o.subtotal; t.delivery += o.deliveryFee; if (o.deliveryFee) t.deliveries++; t.total += o.total;
      if (o.payStatus === 'paid') { t.paid += o.total; t.paidCount++; t.byMethod[o.payMethod || 'unspecified'] += o.total; }
      else if (o.payStatus === 'trade') { t.trade += o.total; t.tradeCount++; }
      else { t.unpaid += o.total; t.unpaidCount++; }
      o.lines.forEach(function (l) {
        var k = norm(l.item), r = by[k] || (by[k] = { item: l.item, qty: 0, revenue: 0 });
        r.qty += l.qty; r.revenue += l.lineTotal;
      });
    });
    t.rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.qty - a.qty || b.revenue - a.revenue || a.item.localeCompare(b.item); });
    ['subtotal', 'delivery', 'total', 'paid', 'unpaid', 'trade'].forEach(function (k) { t[k] = Math.round(t[k] * 100) / 100; });
    Object.keys(t.byMethod).forEach(function (k) { t.byMethod[k] = Math.round(t.byMethod[k] * 100) / 100; });
    return t;
  }

  function openOrders() {
    odMicStop(true);
    od.form = null; od.confirmDel = ''; od.err = ''; od.na = false;
    if (!od.week) od.week = odDefaultWeek();
    if (!od.sumWeek) od.sumWeek = od.week;
    $('lt-body').innerHTML = '';
    odRender();
  }
  function odLoad(week, quiet) {
    od.inflight[week] = true;
    if (!quiet) { od.loading = true; od.err = ''; }
    return apiRaw('orders', { week: week }).then(function (j) {
      od.inflight[week] = false;
      if (j.error === 'bad_action') { od.na = true; od.loading = false; return odRender(); }
      if (j.error) throw new Error(j.message || j.error);
      od.na = false; od.loading = false; od.err = '';
      var d = j.data || {};
      od.exists = !!d.exists; od.weeks = d.weeks || []; od.clients = d.clients || [];
      od.byWeek[week] = { at: Date.now(), orders: (d.orders || []).map(odNormOrder), menu: d.menu || [] };
      odClientsSave();
      odRender();
    }, function (err) {
      od.inflight[week] = false; od.loading = false;
      if (vAuth(err)) return;
      if (!quiet || !od.byWeek[week]) od.err = friendly(err);
      odRender();
    });
  }
  function odWeekNeeded() { return od.tab === 'summary' ? od.sumWeek : od.tab === 'previous' ? od.prevWeek : od.week; }
  function odEnsure() {
    var wk = odWeekNeeded();
    if (!wk || od.na || od.err || od.inflight[wk]) return;
    var W = od.byWeek[wk];
    if (!W || Date.now() - W.at > 45000) odLoad(wk, !!W);
  }
  function odRender() {
    if (!odOnScreen()) return;
    if (!$('od-main')) {
      $('lt-body').innerHTML = '<div class="od"><div class="odtabs" role="tablist" aria-label="Orders">' +
        [['current', 'Current'], ['previous', 'Previous'], ['summary', 'Summary']].map(function (t) {
          return '<button type="button" class="odtab" role="tab" data-od="tab" data-t="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div><div class="noteflash" id="od-flash" hidden></div><div id="od-main"></div></div>';
    }
    [].forEach.call($('lt-body').querySelectorAll('.odtab'), function (b) {
      var on = b.getAttribute('data-t') === od.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (od.form && od.tab === 'current' && $('od-form')) return;          // never wipe a form that is being filled in
    var h = od.tab === 'previous' ? odPreviousHtml() : od.tab === 'summary' ? odSummaryHtml() : odCurrentHtml();
    $('od-main').innerHTML = h;
    if (od.form && od.tab === 'current') odFormInit();
    odEnsure();
  }
  function odStatusHtml(week) {          // shared loading / error / not-available block, or '' when the week's data is ready
    if (od.na) return '<div class="loading">' + OD_NA + '</div>';
    if (od.err && !od.byWeek[week]) return '<div class="error">' + esc(od.err) + '<div class="retry"><button type="button" class="navbtn" data-od="retry">Try again</button></div></div>';
    if (!od.byWeek[week]) return '<div class="loading">Loading\u2026</div>';
    return '';
  }
  function odWeekNav(week, key) {
    return '<div class="odwk"><button type="button" class="odarrow" data-od="wk" data-k="' + key + '" data-d="-7" aria-label="Previous week">\u2039</button>' +
      '<div class="odwkl"><b>Week of ' + esc(odShort(week)) + '</b><small>Delivery Tuesday ' + esc(odShort(odPlus(week, 1))) + (week === odDefaultWeek() ? ' \u00b7 this week' : '') + '</small></div>' +
      '<button type="button" class="odarrow" data-od="wk" data-k="' + key + '" data-d="7" aria-label="Next week">\u203a</button></div>';
  }
  function odPaidBtn(o) {
    var busy = !!od.busy[o.orderId], open = od.picker && od.picker.oid === o.orderId;
    return '<button type="button" class="odpaid ' + (o.payStatus === 'paid' ? 'on' : o.payStatus === 'trade' ? 'trade' : 'off') + (open ? ' open' : '') + '" data-od="paid" data-oid="' + esc(o.orderId) + '" aria-expanded="' + !!open + '"' + (busy ? ' disabled' : '') + '>' + esc(odPayLabel(o)) + '</button>';
  }
  function odPickerHtml(o) {          // the small inline payment picker under a card
    var p = od.picker; if (!p || p.oid !== o.orderId) return '';
    var h = '<div class="odpicker" role="group" aria-label="Payment for ' + esc(o.client) + '"><div class="vchips">' +
      [['unpaid', 'Unpaid'], ['paid', 'Paid'], ['trade', 'Trade']].map(function (x) {
        return '<button type="button" class="vchip odchip' + (p.status === x[0] ? ' on' : '') + '" data-od="pst" data-oid="' + esc(o.orderId) + '" data-s="' + x[0] + '" aria-pressed="' + (p.status === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    if (p.status === 'paid') h += '<div class="odpmh">How was it paid?</div><div class="vchips">' + OD_METHODS.map(function (m) {
      return '<button type="button" class="vchip odchip' + (o.payStatus === 'paid' && o.payMethod === m ? ' on' : '') + '" data-od="pmt" data-oid="' + esc(o.orderId) + '" data-m="' + m + '">' + odCap(m) + '</button>';
    }).join('') + '</div>';
    return h + '</div>';
  }
  function odCardHtml(o, editable) {
    var ask = od.confirmDel === o.orderId;
    return '<div class="card odcard" data-oid="' + esc(o.orderId) + '"><div class="odtop"><span class="odname">' + esc(o.client) + '</span><span class="odcost">' + odMoney(o.total) + '</span></div>' +
      '<ul class="odlines">' + o.lines.map(function (l) { return '<li><span>' + l.qty + ' \u00d7 ' + esc(l.item) + '</span><span>' + odMoney(l.lineTotal) + '</span></li>'; }).join('') +
      (o.deliveryFee ? '<li class="odfee"><span>Delivery fee</span><span>' + odMoney(o.deliveryFee) + '</span></li>' : '') + '</ul>' +
      '<div class="odrow">' + odPaidBtn(o) +
      (editable ? '<button type="button" class="navbtn odedit" data-od="edit" data-oid="' + esc(o.orderId) + '">Edit</button><button type="button" class="navbtn odx" data-od="del" data-oid="' + esc(o.orderId) + '" aria-label="Delete order for ' + esc(o.client) + '">Delete</button>' : '') + '</div>' +
      odPickerHtml(o) +
      (ask ? '<div class="odconf">Delete the order for ' + esc(o.client) + '?<div class="draftbtns"><button type="button" class="bigsave odyes" data-od="delyes" data-oid="' + esc(o.orderId) + '">Yes, delete</button><button type="button" class="navbtn" data-od="delno">Keep it</button></div></div>' : '') + '</div>';
  }
  function odTotalsHtml(orders) {
    var t = odAgg(orders);
    return '<div class="card odtotal"><div class="odtrow big"><span>Week total</span><b>' + odMoney(t.total) + '</b></div>' +
      '<div class="odtrow"><span>Paid</span><b>' + odMoney(t.paid) + '</b></div><div class="odtrow"><span>Unpaid</span><b>' + odMoney(t.unpaid) + '</b></div>' +
      '<div class="odtrow"><span>Trade</span><b>' + odMoney(t.trade) + '</b></div>' +
      '<div class="odtrow"><span>Delivery fees</span><b>' + odMoney(t.delivery) + '</b></div>' +
      '<div class="foot">' + t.clients + ' client' + (t.clients === 1 ? '' : 's') + ' \u00b7 ' + t.items + ' item' + (t.items === 1 ? '' : 's') + (t.tradeCount ? ' \u00b7 ' + t.tradeCount + ' trade' : '') + ' \u00b7 total includes delivery fees</div></div>';
  }
  function odCurrentHtml() {
    var wk = od.week, h = odWeekNav(wk, 'current'), st = odStatusHtml(wk);
    if (st) return h + st;
    var W = od.byWeek[wk];
    if (od.form) return h + odFormHtml();
    h += '<div class="foot odmenunote">' + (W.menu.length ? 'Menu for this week: ' + W.menu.length + ' item' + (W.menu.length === 1 ? '' : 's') + ' (from Generate menu)' :
      'No menu saved for this week yet \u2014 Add client will list every priced menu item. Use Generate menu \u203a Use for orders to set one.') + '</div>';
    h += '<button type="button" class="navbtn wladd odadd" data-od="add">+ Add client</button>';
    h += W.orders.length ? W.orders.map(function (o) { return odCardHtml(o, true); }).join('') : '<div class="foot empty">No orders for this week yet.</div>';
    return h + odTotalsHtml(W.orders);
  }
  function odPreviousHtml() {
    if (od.prevWeek) {
      var wk = od.prevWeek, st = odStatusHtml(wk), h = '<button type="button" class="navbtn wladd odback" data-od="prevback">&lsaquo; All previous weeks</button><div class="odwk odwkstatic"><div class="odwkl"><b>Week of ' + esc(odShort(wk)) + '</b><small>Delivery Tuesday ' + esc(odShort(odPlus(wk, 1))) + '</small></div></div>';
      if (st) return h + st;
      var W = od.byWeek[wk];
      return h + (W.orders.length ? W.orders.map(function (o) { return odCardHtml(o, false); }).join('') : '<div class="foot empty">No orders that week.</div>') + odTotalsHtml(W.orders);
    }
    if (od.na) return '<div class="loading">' + OD_NA + '</div>';
    if (od.err && !od.weeks.length) return '<div class="error">' + esc(od.err) + '<div class="retry"><button type="button" class="navbtn" data-od="retry">Try again</button></div></div>';
    var cur = odDefaultWeek(), list = od.weeks.filter(function (w) { return w.week < cur && (w.clients > 0 || w.hasMenu); }).sort(function (a, b) { return a.week < b.week ? 1 : -1; });
    if (!list.length) return '<div class="loading">' + (od.loading || !od.byWeek[od.week] ? 'Loading\u2026' : 'No previous weeks yet.') + '</div>';
    return '<div class="card odweeks">' + list.map(function (w) {
      return '<button type="button" class="odweek" data-od="prevopen" data-w="' + esc(w.week) + '"><span class="odwk1"><b>Week of ' + esc(odShort(w.week)) + '</b><small>' + w.clients + ' client' + (w.clients === 1 ? '' : 's') + ' \u00b7 ' + w.items + ' item' + (w.items === 1 ? '' : 's') +
        (w.unpaid > 0 ? ' \u00b7 ' + odMoney(w.unpaid) + ' unpaid' : (w.clients ? (w.tradeCount && w.tradeCount === w.clients ? ' \u00b7 all trade' : ' \u00b7 all paid') : '')) + (w.tradeCount && w.tradeCount !== w.clients ? ' \u00b7 ' + w.tradeCount + ' trade' : '') + '</small></span><span class="odwk2">' + odMoney(w.total) + '</span><span class="chev">&rsaquo;</span></button>';
    }).join('') + '</div>';
  }
  function odSummaryHtml() {
    var wk = od.sumWeek, h = odWeekNav(wk, 'summary'), st = odStatusHtml(wk);
    if (st) return h + st;
    var W = od.byWeek[wk], t = odAgg(W.orders);
    if (!W.orders.length) return h + '<div class="foot empty">No orders for this week.</div>';
    h += '<div class="card odsum"><div class="odsrow head"><span>Item</span><span>Qty</span><span>Revenue</span></div>' +
      t.rows.map(function (r) { return '<div class="odsrow"><span>' + esc(r.item) + '</span><span>' + r.qty + '</span><span>' + odMoney(r.revenue) + '</span></div>'; }).join('') +
      '<div class="odsrow tot"><span>Total</span><span>' + t.items + '</span><span>' + odMoney(t.subtotal) + '</span></div></div>';
    h += '<div class="card odtotal"><div class="odtrow big"><span>Total income</span><b>' + odMoney(t.total) + '</b></div>' +
      '<div class="odtrow"><span>Items</span><b>' + odMoney(t.subtotal) + '</b></div>' +
      '<div class="odtrow"><span>Delivery fee income</span><b>' + odMoney(t.delivery) + '</b></div>' +
      '<div class="odtrow"><span>Paid</span><b>' + odMoney(t.paid) + '</b></div>' +
      OD_METHODS.map(function (m) { return '<div class="odtrow sub"><span>' + odCap(m) + '</span><b>' + odMoney(t.byMethod[m]) + '</b></div>'; }).join('') +
      (t.byMethod.unspecified ? '<div class="odtrow sub"><span>Method not recorded</span><b>' + odMoney(t.byMethod.unspecified) + '</b></div>' : '') +
      '<div class="odtrow"><span>Unpaid</span><b>' + odMoney(t.unpaid) + '</b></div>' +
      '<div class="odtrow"><span>Trade (' + t.tradeCount + ' order' + (t.tradeCount === 1 ? '' : 's') + ')</span><b>' + odMoney(t.trade) + '</b></div>' +
      '<div class="foot">' + t.items + ' item' + (t.items === 1 ? '' : 's') + ' \u00b7 ' + t.clients + ' client' + (t.clients === 1 ? '' : 's') + ' \u00b7 item revenue = quantity \u00d7 price at order time \u00b7 trade is in neither paid nor unpaid</div></div>';
    return h;
  }

  // ---- paid / delete ----
  function odFind(oid) {
    var found = null;
    Object.keys(od.byWeek).forEach(function (w) { (od.byWeek[w].orders || []).forEach(function (o) { if (o.orderId === oid) found = { o: o, w: w }; }); });
    return found;
  }
  function odPickToggle(oid) {
    var f = odFind(oid); if (!f || od.busy[oid]) return;
    od.picker = (od.picker && od.picker.oid === oid) ? null : { oid: oid, status: f.o.payStatus };
    od.confirmDel = ''; odRender();
  }
  function odPay(oid, status, method) {          // change one order's payment via orderpaid (optimistic; reverted on error)
    var f = odFind(oid); if (!f || od.busy[oid]) return;
    var o = f.o, was = { paid: o.paid, paidOn: o.paidOn, payStatus: o.payStatus, payMethod: o.payMethod };
    od.picker = null;
    if (was.payStatus === status && was.payMethod === (status === 'paid' ? method : '')) return odRender();
    o.payStatus = status; o.payMethod = status === 'paid' ? method : ''; o.paid = status === 'paid'; o.paidOn = o.paid ? (was.paid && was.paidOn ? was.paidOn : mgIso(new Date())) : '';
    od.busy[oid] = true; odRender();
    var q = { orderId: oid, paid: status === 'paid' ? 'true' : 'false', payStatus: status, client: o.client, cid: vNewCid() };
    if (status === 'paid' && method) q.payMethod = method;
    var undo = function () { o.payStatus = was.payStatus; o.payMethod = was.payMethod; o.paid = was.paid; o.paidOn = was.paidOn; };
    apiRaw('orderpaid', q).then(function (j) {
      od.busy[oid] = false;
      if (j.error) { undo(); odFlash(odApiMsg(j, 'Changing payment'), true); odRender(); return; }
      var so = j.data && j.data.order;
      if (so && so.payStatus === undefined && (status === 'trade' || method)) {      // an older server only knows paid / unpaid
        undo(); odFlash('Trade and payment methods will work after the next server update.', true); odRender(); odLoad(f.w, true); return;
      }
      if (so && so.paidOn !== undefined) o.paidOn = so.paidOn;
      odRender(); odLoad(f.w, true);
    }, function (err) {
      od.busy[oid] = false; undo();
      if (vAuth(err)) return;
      odFlash(friendly(err) + ' Not changed.', true); odRender();
    });
  }
  function odDelete(oid) {
    var f = odFind(oid); if (!f) return;
    var W = od.byWeek[f.w], idx = W.orders.indexOf(f.o);
    od.confirmDel = ''; W.orders.splice(idx, 1); odRender();
    apiRaw('orderdel', { orderId: oid, client: f.o.client, cid: vNewCid() }).then(function (j) {
      if (j.error) { W.orders.splice(idx, 0, f.o); odFlash(odApiMsg(j, 'Deleting') + ' The order is still there.', true); odRender(); }
      else { odFlash('Deleted the order for ' + f.o.client + '.', false); odLoad(f.w, true); }
    }, function (err) {
      W.orders.splice(idx, 0, f.o);
      if (vAuth(err)) return;
      odFlash(friendly(err) + ' The order is still there.', true); odRender();
    });
  }

  // ---- Add client / edit order form ----
  function odMenuItems(week, order) {          // [{item, price|null, cat}] the week's chosen menu, else every priced Menu Macros item
    var W = od.byWeek[week], list = [], fallback = false;
    if (W && W.menu && W.menu.length) list = W.menu.map(function (m) { return { item: m.item, price: m.price == null ? null : Number(m.price), cat: '' }; });
    else {
      fallback = true;
      var c = state.ltCache.macros;
      if (c && c.data) list = c.data.items.filter(function (x) { return x.price != null; }).map(function (x) { return { item: x.item, price: Number(x.price), cat: x.category || '' }; })
        .sort(function (a, b) { return a.item.localeCompare(b.item, 'en', { sensitivity: 'base' }); });
    }
    if (order) order.lines.forEach(function (l) {          // lines of the order being edited that are not on the menu list
      if (!list.some(function (x) { return norm(x.item) === norm(l.item); })) list.push({ item: l.item, price: l.unitPrice, cat: '' });
    });
    return { list: list, fallback: fallback };
  }
  function odOpenForm(order) {
    var W = od.byWeek[od.week]; if (!W) return;
    var f = { orderId: order ? order.orderId : '', mode: (!order && odClients().length) ? 'existing' : 'new', client: order ? order.client : '', q: '', search: '', q0: {}, fee: order ? order.deliveryFee : 0, payStatus: order ? order.payStatus : 'unpaid', payMethod: order ? order.payMethod : '', legacyPaid: !!(order && order.payStatus === 'paid' && !order.payMethod),
      cid: vNewCid(), sig: '', busy: false, items: [], fallback: false, loadingMacros: false, qty: {}, order: order || null };
    od.form = f; od.picker = null; odMicStop(true);
    var mn = $('od-main'); if (mn) mn.innerHTML = '';
    odFormItems();
    odRender();
    if (f.fallback && !(state.ltCache.macros && state.ltCache.macros.data)) { f.loadingMacros = true; ltEnsureMacros(function () { f.loadingMacros = false; if (od.form === f) { odFormItems(); odItemsPaint(); } }); }
  }
  function odFormItems() {
    var f = od.form, m = odMenuItems(od.week, f.order), prev = {};
    f.items.forEach(function (it, i) { if (f.qty[i]) prev[norm(it.item)] = f.qty[i]; });
    if (f.order && !f.items.length) f.order.lines.forEach(function (l) { prev[norm(l.item)] = l.qty; });
    f.items = m.list; f.fallback = m.fallback; f.qty = {};
    f.items.forEach(function (it, i) { if (prev[norm(it.item)]) f.qty[i] = prev[norm(it.item)]; });
  }
  function odFormTotals() {
    var f = od.form, n = 0, tot = 0;
    f.items.forEach(function (it, i) { var q = f.qty[i] || 0; n += q; tot += q * (it.price || 0); });
    tot = Math.round(tot * 100) / 100;
    return { n: n, subtotal: tot, fee: f.fee, total: Math.round((tot + f.fee) * 100) / 100 };
  }
  function odClientMatches(q) {
    var k = norm(q), all = odClients(); if (!k) return all;
    var pre = all.filter(function (c) { return norm(c.name).indexOf(k) === 0; }), word = all.filter(function (c) { var n = norm(c.name); return n.indexOf(k) !== 0 && (' ' + n).indexOf(' ' + k) >= 0; });
    return pre.concat(word);
  }
  function odOrderedNames() { var W = od.byWeek[od.week], s = {}; ((W && W.orders) || []).forEach(function (o) { s[norm(o.client)] = o.orderId; }); return s; }
  function odFormHtml() {
    var f = od.form, edit = !!f.orderId;
    var h = '<div class="card vform odform" id="od-form"><h3>' + (edit ? 'Edit order' : 'Add client') + ' <small>week of ' + esc(odShort(od.week)) + '</small></h3>';
    if (edit) {
      h += '<label class="vfield"><span>Client</span><input type="text" class="wlin" id="od-name" maxlength="60" autocomplete="off" autocapitalize="words" value="' + esc(f.client) + '"></label>';
    } else {
      h += '<div class="vfield"><span>Client</span><div class="vchips" role="group" aria-label="New or existing client">' +
        '<button type="button" class="vchip' + (f.mode === 'existing' ? ' on' : '') + '" data-od="mode" data-m="existing" aria-pressed="' + (f.mode === 'existing') + '">Existing client</button>' +
        '<button type="button" class="vchip' + (f.mode === 'new' ? ' on' : '') + '" data-od="mode" data-m="new" aria-pressed="' + (f.mode === 'new') + '">New client</button></div></div>';
      if (f.mode === 'existing') {
        h += '<div class="odpick"><input type="text" class="wlin" id="od-q" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Type the first letters\u2026" value="' + esc(f.q) + '" aria-label="Find a client">' +
          '<div class="odsug" id="od-sug" hidden></div></div>' +
          '<div class="odsel" id="od-sel"></div><div class="odclist" id="od-clist" role="listbox" aria-label="Existing clients"></div>';
      } else {
        h += '<div class="odnew"><input type="text" class="wlin" id="od-name" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Client name" value="' + esc(f.client) + '" aria-label="Client name">' +
          '<button type="button" class="micbtn odmic" id="od-mic" data-od="mic" aria-pressed="false" aria-label="Dictate the client name">' + vsvg('mic', 26) + '</button></div><div class="micstate" id="od-micstate">&nbsp;</div>';
      }
    }
    h += '<h4 class="sechead odsec">Items <small id="od-src"></small></h4><input type="search" class="searchbox" id="od-search" autocomplete="off" placeholder="Search items" value="' + esc(f.search) + '">' +
      '<div id="od-items" class="oditems"></div>' +
      '<div class="odftot"><span id="od-ftot"></span></div>' +
      '<div class="vfield"><span>Delivery</span><div class="vchips" role="group" aria-label="Delivery fee" id="od-fee"></div></div>' +
      '<div class="vfield"><span>Payment</span><div id="od-pay"></div></div>' +
      '<div class="draftbtns"><button type="button" class="bigsave" id="od-save" data-od="save">' + (edit ? 'Save changes' : 'Save order') + '</button><button type="button" class="navbtn discard" data-od="cancel">Cancel</button></div>' +
      '<div class="noteflash" id="od-fmsg" hidden></div></div>';
    return h;
  }
  function odFormInit() { odClientPaint(); odItemsPaint(); odFeePaint(); odPayPaint(); odMicUi(); }
  function odFeePaint() {
    var f = od.form, el = $('od-fee'); if (!f || !el) return;
    el.innerHTML = [[0, 'No delivery'], [3, '$3'], [5, '$5']].map(function (x) {
      return '<button type="button" class="vchip odchip' + (f.fee === x[0] ? ' on' : '') + '" data-od="fee" data-v="' + x[0] + '" aria-pressed="' + (f.fee === x[0]) + '">' + x[1] + '</button>';
    }).join('');
  }
  function odPayPaint() {
    var f = od.form, el = $('od-pay'); if (!f || !el) return;
    var h = '<div class="vchips" role="group" aria-label="Payment status">' + [['unpaid', 'Unpaid'], ['paid', 'Paid'], ['trade', 'Trade']].map(function (x) {
      return '<button type="button" class="vchip odchip' + (f.payStatus === x[0] ? ' on' : '') + '" data-od="ps" data-s="' + x[0] + '" aria-pressed="' + (f.payStatus === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    if (f.payStatus === 'paid') h += '<div class="odpmh">How was it paid?' + (f.legacyPaid ? ' <small>(optional for this older order)</small>' : '') + '</div><div class="vchips" role="group" aria-label="Payment method">' + OD_METHODS.map(function (m) {
      return '<button type="button" class="vchip odchip' + (f.payMethod === m ? ' on' : '') + '" data-od="pm" data-m="' + m + '" aria-pressed="' + (f.payMethod === m) + '">' + odCap(m) + '</button>';
    }).join('') + '</div>';
    el.innerHTML = h;
  }
  function odFmsg(text, bad) { var el = $('od-fmsg'); if (!el) return; el.textContent = text || ''; el.hidden = !text; el.className = 'noteflash' + (text ? ' show' : '') + (bad ? ' bad' : ''); }
  function odClientPaint() {
    var f = od.form; if (!f || f.mode !== 'existing' || f.orderId) return;
    var ordered = odOrderedNames(), list = odClientMatches(f.q), sug = $('od-sug'), cl = $('od-clist'), sel = $('od-sel');
    if (sel) sel.innerHTML = f.client ? '<span class="odchip">Selected: <b>' + esc(f.client) + '</b> <button type="button" data-od="unpick" aria-label="Clear the selected client">\u00d7</button></span>' : '';
    var row = function (c) {
      var has = ordered[norm(c.name)];
      return '<button type="button" role="option" class="odclient' + (norm(c.name) === norm(f.client) ? ' on' : '') + '" data-od="pick" data-n="' + esc(c.name) + '"><span>' + esc(c.name) + '</span>' +
        '<small>' + (has ? 'already ordered \u00b7 tap to edit' : (c.orders ? c.orders + ' order' + (c.orders === 1 ? '' : 's') : '')) + '</small></button>';
    };
    if (sug) {
      var show = !!f.q.trim() && norm(f.q) !== norm(f.client);
      sug.hidden = !show; sug.innerHTML = show ? (list.length ? list.slice(0, 6).map(row).join('') : '<div class="foot">No existing client starts with that. Use New client.</div>') : '';
    }
    if (cl) cl.innerHTML = list.length ? list.map(row).join('') : '<div class="foot empty">' + (odClients().length ? 'No matches.' : 'No clients yet \u2014 use New client.') + '</div>';
  }
  function odItemRow(it, i) {
    var f = od.form, q = f.qty[i] || 0;
    return '<div class="oditem' + (q ? ' on' : '') + '" data-i="' + i + '"><button type="button" class="odiname" data-od="inc" data-i="' + i + '">' + esc(it.item) +
      '<small>' + (it.price == null ? 'no price' : odMoney(it.price) + ' each') + (it.cat ? ' \u00b7 ' + esc(it.cat) : '') + '</small></button>' +
      '<div class="odstep"><button type="button" data-od="dec" data-i="' + i + '" aria-label="One less ' + esc(it.item) + '"' + (q ? '' : ' disabled') + '>\u2212</button><span class="odq">' + q + '</span>' +
      '<button type="button" data-od="inc" data-i="' + i + '" aria-label="One more ' + esc(it.item) + '">+</button></div><span class="odline">' + (q ? odMoney(q * (it.price || 0)) : '') + '</span></div>';
  }
  function odItemsPaint() {
    var f = od.form, box = $('od-items'); if (!f || !box) return;
    var term = norm(f.search), rows = [];
    f.items.forEach(function (it, i) { if (!term || f.qty[i] || norm(it.item).indexOf(term) >= 0) rows.push(odItemRow(it, i)); });
    box.innerHTML = rows.length ? rows.join('') : '<div class="foot empty">' + (f.loadingMacros ? 'Loading menu items\u2026' : f.items.length ? 'No matches.' : (f.fallback ? 'No priced menu items yet. Set prices on the Menu Items screen.' : 'No items.')) + '</div>';
    var src = $('od-src'); if (src) src.textContent = f.fallback ? 'all priced items (no menu saved for this week)' : 'this week\u2019s menu';
    odFormTot();
  }
  function odFormTot() {
    var t = odFormTotals(), el = $('od-ftot');
    if (el) el.innerHTML = t.n + ' item' + (t.n === 1 ? '' : 's') + ' \u00b7 ' + (t.fee ? odMoney(t.subtotal) + ' items + ' + odMoney(t.fee) + ' delivery = ' : '') + '<b>' + odMoney(t.total) + '</b>';
  }
  function odStep(i, d) {
    var f = od.form; if (!f || !f.items[i]) return;
    var q = Math.max(0, Math.min(99, (f.qty[i] || 0) + d)); if (q) f.qty[i] = q; else delete f.qty[i];
    var row = document.querySelector('#od-items .oditem[data-i="' + i + '"]');
    if (row) { var tmp = document.createElement('div'); tmp.innerHTML = odItemRow(f.items[i], i); row.parentNode.replaceChild(tmp.firstChild, row); }
    odFormTot(); odFmsg('');
  }
  function odPick(name) {
    var f = od.form, has = odOrderedNames()[norm(name)];
    if (has) {                                  // that client already has an order this week: edit it instead of making a second one
      var W = od.byWeek[od.week], o = W.orders.filter(function (x) { return x.orderId === has; })[0];
      if (o) { od.form = null; odOpenForm(o); return; }
    }
    f.client = name; f.q = ''; var q = $('od-q'); if (q) q.value = ''; odClientPaint(); odFmsg('');
  }
  function odFormName() {
    var f = od.form;
    if (f.orderId || f.mode === 'new') { var el = $('od-name'); return String(el ? el.value : f.client).replace(/\s+/g, ' ').trim(); }
    return String(f.client || '').trim();
  }
  function odSave() {
    var f = od.form; if (!f || f.busy) return;
    var name = odFormName();
    if (!name) return odFmsg(f.mode === 'existing' && !f.orderId ? 'Pick a client first (or choose New client).' : 'Enter the client name first.', true);
    if (name.length > 60) return odFmsg('The client name is limited to 60 characters.', true);
    var has = odOrderedNames()[norm(name)];
    if (has && has !== f.orderId) return odFmsg(name + ' already has an order this week. Open their card and tap Edit.', true);
    var lines = [];
    f.items.forEach(function (it, i) { if (f.qty[i]) lines.push({ item: it.item, qty: f.qty[i], price: it.price || 0 }); });
    if (!lines.length) return odFmsg('Tap at least one item.', true);
    if (f.payStatus === 'paid' && !f.payMethod && !f.legacyPaid) return odFmsg('Choose how it was paid: Cash, Zelle or Venmo.', true);
    var week = od.week, body = { week: week, client: name, lines: lines, deliveryFee: f.fee, payStatus: f.payStatus, paid: f.payStatus === 'paid' };
    if (f.payStatus === 'paid' && f.payMethod) body.payMethod = f.payMethod;
    if (f.orderId) body.orderId = f.orderId;
    var sig = JSON.stringify(body); if (f.sig !== sig) { f.sig = sig; f.cid = vNewCid(); }
    body.cid = f.cid; f.busy = true; var btn = $('od-save'); if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; } odFmsg('');
    apiPostRaw('orderset', body, 60000).then(function (j) {
      f.busy = false;
      if (j.error) { var b = $('od-save'); if (b) { b.disabled = false; b.textContent = f.orderId ? 'Save changes' : 'Save order'; } return odFmsg(odApiMsg(j, 'Saving orders') + (j.error === 'bad_action' ? ' Nothing was saved.' : ''), true); }
      var o = j.data && j.data.order; if (!o) return odFmsg('Saved, but the server sent no order back. Pull to refresh.', true);
      var oldServer = o.deliveryFee === undefined && o.payStatus === undefined && (f.fee > 0 || f.payStatus === 'trade' || !!f.payMethod);
      odNormOrder(o);
      var W = od.byWeek[week] || (od.byWeek[week] = { at: Date.now(), orders: [], menu: [] }), at = -1;
      W.orders.forEach(function (x, ix) { if (x.orderId === o.orderId) at = ix; });
      if (at >= 0) W.orders[at] = o; else W.orders.push(o);
      odClientAdd(o.client);
      od.form = null; odRender();
      odFlash(oldServer ? 'Saved the order for ' + o.client + ', but delivery fees, Trade and payment methods will only be kept after the next server update.' : 'Saved the order for ' + o.client + ' \u2014 ' + odMoney(o.total) + '.', oldServer);
      odLoad(week, true);
    }, function (err) {
      f.busy = false;
      if (vAuth(err)) return;
      var b = $('od-save'); if (b) { b.disabled = false; b.textContent = f.orderId ? 'Save changes' : 'Save order'; }
      odFmsg(friendly(err) + ' Not confirmed yet: tap Save again to retry (same entry id, it will not double).', true);
    });
  }

  // ---- dictate a new client's name ----
  function odNameParse(text) {            // "client is jane smith." -> "Jane Smith"
    var s = String(text || '').replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(?:add|new|create)\s+(?:a\s+)?(?:new\s+)?/i, '').replace(/^(?:the\s+)?(?:client|customer|order)(?:'s)?(?:\s+name)?(?:\s+is|\s+for)?\s+/i, '').replace(/^(?:name\s+is|for|it'?s|this\s+is)\s+/i, '').trim();
    return s.split(' ').map(function (w) { return w && w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w; }).join(' ').slice(0, 60);
  }
  function odMicUi() {
    var b = $('od-mic'), st = $('od-micstate'); if (!b) return;
    b.classList.toggle('rec', od.mic.on); b.setAttribute('aria-pressed', od.mic.on ? 'true' : 'false');
    if (st) { st.className = 'micstate' + (od.mic.on ? ' rec' : '') + (od.mic.msg && !od.mic.on ? ' warn' : ''); st.textContent = od.mic.on ? 'Listening\u2026 say the client\u2019s name' : (od.mic.msg || 'Type the name, or tap the mic and say it.'); }
  }
  function odMicFail(msg) { od.mic.on = false; var r = od.mic.rec; od.mic.rec = null; try { r && r.abort(); } catch (e) {} od.mic.msg = msg; odMicUi(); var el = $('od-name'); if (el) el.focus(); }
  function odMicStart() {
    var el = $('od-name'); if (!el) return;
    if (!SR) { od.mic.msg = MIC_NA; odMicUi(); el.focus(); return; }
    od.mic.msg = ''; od.mic.committed = ''; od.mic.interim = '';
    var rec; try { rec = new SR(); } catch (e) { return odMicFail(MIC_NA); }
    rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) od.mic.committed = micSpace(od.mic.committed, t.trim() + ' '); else interim += t;
      }
      od.mic.interim = interim.replace(/^\s+/, ''); el.value = odNameParse(od.mic.committed + od.mic.interim);
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') return odMicFail(MIC_NA);
      if (e === 'network') return odMicFail('The speech service couldn\u2019t be reached. Type the name instead.');
      if (e === 'no-speech') od.mic.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (od.mic.rec !== rec) return;
      od.mic.committed = micSpace(od.mic.committed, od.mic.interim ? od.mic.interim.trim() + ' ' : ''); od.mic.interim = '';
      od.mic.on = false; od.mic.rec = null;
      var nm = odNameParse(od.mic.committed); if (nm) { el.value = nm; if (od.form) od.form.client = nm; }
      odMicUi();
    };
    od.mic.rec = rec; od.mic.on = true;
    try { rec.start(); } catch (e2) { return odMicFail(MIC_NA); }
    odMicUi();
  }
  function odMicStop(quiet) {
    var r = od.mic.rec;
    if (quiet) { od.mic.rec = null; od.mic.on = false; try { r && r.abort(); } catch (e) {} return; }
    if (r) { try { r.stop(); } catch (e2) { od.mic.rec = null; od.mic.on = false; odMicUi(); } }
  }

  $('lt-body').addEventListener('click', function (e) {
    if (state.ltPart !== 'orders') return;
    var b = e.target.closest('[data-od]'); if (!b) return;
    var a = b.getAttribute('data-od'), oid = b.getAttribute('data-oid'), i = +b.getAttribute('data-i');
    if (a === 'tab') { var t = b.getAttribute('data-t'); if (t !== od.tab) { if (od.form) { odMicStop(true); od.form = null; } od.tab = t; od.confirmDel = ''; if (t === 'previous') od.prevWeek = ''; odFlash(''); odRender(); } }
    else if (a === 'wk') {
      var k = b.getAttribute('data-k'), d = +b.getAttribute('data-d');
      if (k === 'summary') od.sumWeek = odPlus(od.sumWeek, d); else { od.form = null; od.confirmDel = ''; od.week = odPlus(od.week, d); }
      od.picker = null; odFlash(''); odRender();
    }
    else if (a === 'retry') { od.err = ''; od.na = false; odLoad(odWeekNeeded() || od.week); odRender(); }
    else if (a === 'add') odOpenForm(null);
    else if (a === 'edit') { var f1 = odFind(oid); if (f1) odOpenForm(f1.o); }
    else if (a === 'cancel') { odMicStop(true); od.form = null; odRender(); }
    else if (a === 'paid') odPickToggle(oid);
    else if (a === 'pst') { var po = od.picker; if (!po || po.oid !== oid) return; var st = b.getAttribute('data-s'); if (st === 'paid') { po.status = 'paid'; odRender(); } else odPay(oid, st, ''); }
    else if (a === 'pmt') odPay(oid, 'paid', b.getAttribute('data-m'));
    else if (a === 'del') { od.confirmDel = oid; odRender(); }
    else if (a === 'delno') { od.confirmDel = ''; odRender(); }
    else if (a === 'delyes') odDelete(oid);
    else if (a === 'prevopen') { od.prevWeek = b.getAttribute('data-w'); odRender(); }
    else if (a === 'prevback') { od.prevWeek = ''; odRender(); }
    else if (a === 'mode') { var m = b.getAttribute('data-m'); if (od.form && od.form.mode !== m) { odMicStop(true); od.form.mode = m; od.form.client = ''; od.form.q = ''; od.form.sig = ''; $('od-main').innerHTML = odWeekNav(od.week, 'current') + odFormHtml(); odFormInit(); } }
    else if (a === 'pick') odPick(b.getAttribute('data-n'));
    else if (a === 'unpick') { od.form.client = ''; odClientPaint(); }
    else if (a === 'mic') { if (od.mic.on) odMicStop(); else odMicStart(); }
    else if (a === 'inc') odStep(i, 1);
    else if (a === 'dec') odStep(i, -1);
    else if (a === 'fee') { od.form.fee = +b.getAttribute('data-v'); odFeePaint(); odFormTot(); odFmsg(''); }
    else if (a === 'ps') { var s2 = b.getAttribute('data-s'); od.form.payStatus = s2; if (s2 !== 'paid') od.form.payMethod = ''; odPayPaint(); odFmsg(''); }
    else if (a === 'pm') { od.form.payMethod = b.getAttribute('data-m'); odPayPaint(); odFmsg(''); }
    else if (a === 'save') odSave();
  });
  $('lt-body').addEventListener('input', function (e) {
    if (state.ltPart !== 'orders' || !od.form) return;
    var t = e.target;
    if (t.id === 'od-q') { od.form.q = t.value; if (od.form.client && norm(t.value) !== norm(od.form.client)) od.form.client = ''; odClientPaint(); }
    else if (t.id === 'od-name') { od.form.client = t.value; }
    else if (t.id === 'od-search') { od.form.search = t.value; odItemsPaint(); }
  });

  document.addEventListener('visibilitychange', function () { if (document.hidden && od.mic.on) { odMicStop(true); odMicUi(); } if (document.hidden && wl.on) wlMicStop(true), wlUi(); if (document.hidden && ln.on) { lnMicStop(true); lnUi(); } if (document.hidden && mm.on) { macMicStop(true); macUi(); } if (document.hidden && ma.on) { maMicStop(true); maUi(); } if (document.hidden && cm.mic.on) { cmMicStop(true); } });

  /* ---- #vcam: receipt photo -> shrink -> optional details -> Save (POST receiptsave) ---- */
  var VCAM_TARGET = 1400000, VCAM_HARD = 2800000;      // base64 characters (~1 MB / ~2 MB of JPEG); the server accepts up to ~3 MB of JPEG
  var vc = { kind: 'exp', b64: '', url: '', w: 0, h: 0, cid: '', busy: false, done: '', msg: '', working: false };
  function openVcam(kind) {
    if (!vc.busy) { vc.b64 = ''; vc.url = ''; vc.cid = ''; vc.done = ''; vc.msg = ''; vc.working = false; }
    vc.kind = kind;
    $('vcam-title').textContent = 'Vault \u00b7 ' + (kind === 'inc' ? 'Income document' : 'Expense receipt');
    vcamRender(); vcamCount();
  }
  function vcamCount() {
    var el = $('vcam-count'); el.hidden = true;
    var d = new Date(), ym = d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1), kind = vc.kind;
    apiRaw('receipts', { month: ym, kind: kind === 'inc' ? 'income' : 'expense' }).then(function (j) {
      if (kind !== vc.kind || !j || !j.ok || !j.data) return;
      el.textContent = j.data.count + ' ' + (kind === 'inc' ? 'document' : 'receipt') + (j.data.count === 1 ? '' : 's') + ' filed this month'; el.hidden = false;
    }, function () {});
  }
  function vcamLoadImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(url); res(im); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That photo could not be read. Try another one (a JPEG works best).')); };
      im.src = url;
    });
  }
  function vcamShrink(file) {       // longest side <= 1600 px, JPEG q0.8; smaller/lower quality until it fits the upload budget
    return vcamLoadImg(file).then(function (im) {
      var W = im.naturalWidth || im.width, H = im.naturalHeight || im.height, out = null;
      if (!W || !H) throw new Error('That photo could not be read.');
      var tries = [[1600, 0.8], [1600, 0.7], [1400, 0.65], [1200, 0.6], [1000, 0.55], [800, 0.5]];
      for (var i = 0; i < tries.length; i++) {
        var sc = Math.min(1, tries[i][0] / Math.max(W, H)), cw = Math.max(1, Math.round(W * sc)), ch = Math.max(1, Math.round(H * sc));
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch); cx.drawImage(im, 0, 0, cw, ch);
        var url = cv.toDataURL('image/jpeg', tries[i][1]); cv.width = cv.height = 0;
        var k = url.indexOf(',');
        if (url.indexOf('data:image/jpeg') !== 0 || k < 0) throw new Error('This browser could not compress the photo.');
        out = { url: url, b64: url.slice(k + 1), w: cw, h: ch };
        if (out.b64.length <= VCAM_TARGET) break;
      }
      if (!out || out.b64.length > VCAM_HARD) throw new Error('The photo is still too large after shrinking. Try a closer, simpler shot.');
      return out;
    });
  }
  function vcamPick(file) {
    if (!file || vc.busy) return;
    vc.working = true; vc.msg = ''; vc.done = ''; vcamRender();
    vcamShrink(file).then(function (o) {
      vc.working = false; vc.b64 = o.b64; vc.url = o.url; vc.w = o.w; vc.h = o.h; vc.cid = vNewCid(); vcamRender();
    }, function (err) { vc.working = false; vc.msg = (err && err.message) || 'Could not prepare that photo.'; vcamRender(); });
  }
  function vcamRender() {
    var body = $('vcam-body'), has = !!vc.b64, inc = vc.kind === 'inc';
    $('vcam-stage').hidden = has || !!vc.done;
    $('vcam-state').textContent = vc.working ? 'Preparing the photo\u2026' : (vc.msg || (inc ? 'Take a photo of the document or pick one from your library' : 'Take a photo of the receipt or pick one from your library'));
    $('vcam-state').className = 'micstate' + (vc.msg && !vc.working ? ' warn' : '');
    if (vc.done) { body.innerHTML = vc.done; return; }
    if (!has) { body.innerHTML = ''; return; }
    var kb = Math.round(vc.b64.length * 0.75 / 1024);
    body.innerHTML = '<div class="card vform vcamcard"><h3>' + (inc ? 'Income document' : 'Receipt') + ' <small>' + vc.w + ' \u00d7 ' + vc.h + ' \u00b7 ' + kb + ' KB</small></h3>' +
      '<img class="vprev" alt="Photo preview" src="' + vc.url + '">' +
      '<div class="vrow2">' + vField('Account', '<select id="vc-acct">' + vOpts(VP.ACCTS, 'Household') + '</select>') + vField('Date', '<input id="vc-date" type="date" value="' + esc(vToday()) + '">') + '</div>' +
      '<div class="vrow2">' + vField('Amount (optional)', '<input id="vc-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00">') + vField(inc ? 'From (optional)' : 'Merchant (optional)', '<input id="vc-merchant" type="text" maxlength="80" autocomplete="off">') + '</div>' +
      vField('Note (optional)', '<textarea id="vc-note" rows="2" maxlength="300"></textarea>') +
      '<p class="foot">Saved as a photo in Drive (' + (inc ? 'Income Documents' : 'Expenses') + ' \u203a account \u203a year \u203a month). It does not add a row to the spend sheet.</p>' +
      '<div class="draftbtns"><button type="button" class="bigsave" id="vc-save">Save photo</button><button type="button" class="navbtn discard" id="vc-retake">Retake</button></div>' +
      '<div class="noteflash" id="vc-msg" hidden></div></div>';
  }
  function vcamSave() {
    if (!vc.b64 || vc.busy) return;
    var g = function (id) { var el = $(id); return el ? el.value.trim() : ''; };
    var date = g('vc-date'), amtS = g('vc-amount');
    if (!vDateOk(date)) return vMsg('vc-msg', 'Pick a valid date.', true);
    if (amtS && vAmt(amtS) === null) return vMsg('vc-msg', 'Amount should look like 42.50, or leave it blank.', true);
    var body = { cid: vc.cid, kind: vc.kind === 'inc' ? 'income' : 'expense', account: g('vc-acct') || 'Household', date: date, mime: 'image/jpeg', data: vc.b64 };
    if (amtS) body.amount = vAmt(amtS).toFixed(2);
    if (g('vc-merchant')) body.merchant = g('vc-merchant');
    if (g('vc-note')) body.note = g('vc-note');
    var btn = $('vc-save'); vc.busy = true; btn.disabled = true; btn.textContent = 'Uploading\u2026'; vMsg('vc-msg', '', false);
    apiPostRaw('receiptsave', body, 90000).then(function (j) {
      vc.busy = false;
      if (j.error) { btn.disabled = false; btn.textContent = 'Save photo'; return vMsg('vc-msg', j.error === 'too_big' ? 'The photo is too large for the server. Tap Retake and try again.' : vApiMsg(j), true); }
      var r = j.data || {};
      vc.done = '<div class="card vform vdone"><h3>' + (r.duplicate ? 'Already filed' : 'Filed in Drive') + '</h3><div class="foot">' + esc(r.path || '') + '</div><div class="foot">' + esc(r.name || '') + '</div>' +
        (r.url ? '<a class="linkrow" data-title="' + esc(r.name || 'Receipt') + '" href="' + esc(r.url) + '">Open the photo &rsaquo;</a>' : '') +
        '<div class="draftbtns"><button type="button" class="bigsave" id="vc-again">Another photo</button><button type="button" class="navbtn" data-go="spend">Back to Vault</button></div></div>';
      vc.b64 = ''; vc.url = ''; vc.cid = ''; vcamRender(); vcamCount();
    }, function (err) {
      vc.busy = false;
      if (vAuth(err)) return;
      btn.disabled = false; btn.textContent = 'Save photo';
      vMsg('vc-msg', friendly(err) + ' Tap Save photo again to retry (same entry id, it will not double).', true);
    });
  }
  ['vcam-cam', 'vcam-lib'].forEach(function (id) {
    $(id).addEventListener('change', function () { var f = this.files && this.files[0]; this.value = ''; if (f) vcamPick(f); });
  });
  $('vcam-body').addEventListener('click', function (e) {
    if (e.target.closest('#vc-save')) return vcamSave();
    if (e.target.closest('#vc-retake')) { if (vc.busy) return; vc.b64 = ''; vc.url = ''; vc.cid = ''; vc.msg = ''; return vcamRender(); }
    if (e.target.closest('#vc-again')) { vc.done = ''; vc.msg = ''; vcamRender(); }
  });

  /* ---------------- Vault: delete an entry (v57): detail sheet + confirm; API spenddel / incomedel ---------------- */
  // Vault entries (spend items, income entries incl. Personal Training / Land & Structure Pay) are tappable. The server exposes `row` (and
  // `tab` on income entries); without a row there is nothing safe to delete, so the sheet shows the entry but no Delete button.
  var VENT = {}, ventN = 0;
  function vRowNum(v) { var n = Math.floor(Number(v)); return isFinite(n) && n >= 2 && String(v).trim() !== '' ? n : 0; }
  function vTabNorm(t) {          // server tab (any spelling) -> 'income' | 'ls' | 'pt' | ''
    var x = String(t || '').toLowerCase().replace(/[^a-z]/g, '');
    if (x === 'income' || x === 'ls' || x === 'pt') return x;
    if (/personaltraining/.test(x)) return 'pt';
    if (/landstructure/.test(x)) return 'ls';
    return '';
  }
  function vIncTab(e) { return vTabNorm(e.tab) || (e.source === PT_SOURCE ? 'pt' : e.source === LS_SOURCE ? 'ls' : 'income'); }
  function vEntCls(e) { return e && e._v ? ' tapent' : ''; }
  function vEntAttr(kind, e) {
    if (!e || !e._v) return '';
    VENT[++ventN] = { kind: kind, e: e };
    return ' data-ent="' + ventN + '" tabindex="0" role="button"';
  }
  function vEntDesc(kind, e) {      // registry entry -> { lines, ent } for the sheet; ent = delete contract (null when no row)
    var lines = [], ent = null, tab;
    lines.push(['Date', e.label || e.date || '']);
    if (kind === 'exp') {
      lines.push(['Merchant', e.merchant || '\u2014'], ['Category', e.category || '']);
      if (e.account) lines.push(['Account', e.account]);
      if (e.who) lines.push(['Paid by', e.who]);
      if (e.method) lines.push(['Method', e.method]);
      if (e.paidFrom) lines.push(['Paid from', e.paidFrom]);
      if (e.notes) lines.push(['Notes', e.notes]);
      if (e.row) ent = { kind: 'exp', row: e.row, date: e.date, amount: e.amount, label: e.merchant || '', cid: e.cid || '' };
    } else {
      tab = vIncTab(e);
      var ds = DETAIL_SRC[e.source];
      lines.push(['Source', ds ? ds.label : e.source]);
      if (e.client) lines.push([tab === 'ls' ? 'Description' : 'Client', e.client]);
      if (e.method) lines.push(['Method', e.method]);
      if (e.notes) lines.push(['Notes', e.notes]);
      var lbl = tab === 'pt' ? (e.client || 'Personal Training') : tab === 'ls' ? (e.client || 'Land & Structure pay') : (e.rawSource || e.source);
      if (e.row) ent = { kind: 'inc', tab: tab, row: e.row, date: e.date, amount: e.amount, label: lbl, cid: e.cid || '' };
    }
    return { kind: kind, lines: lines, ent: ent, amount: e.amount };
  }
  function vDelParams(ent) {      // -> { action, params } : the exact request the UI sends
    var amt = (Number(ent.amount) || 0).toFixed(2);
    if (ent.kind === 'inc') return { action: 'incomedel', params: { tab: ent.tab, row: String(ent.row), date: ent.date, amount: amt, label: ent.label, cid: ent.cid || '', prune_source: '1' } };
    return { action: 'spenddel', params: { row: String(ent.row), date: ent.date, amount: amt, merchant: ent.label, cid: ent.cid || '' } };
  }
  function vDelMsg(j) {
    var e = j && j.error;
    if (e === 'bad_action') return 'This needs the server update (not deployed yet). Nothing was deleted.';
    if (e === 'busy') return 'The sheet is busy. Tap Yes, delete again in a moment.';
    if (e === 'not_found' || e === 'mismatch' || e === 'row_mismatch' || e === 'changed') return 'That entry has changed or is already gone, so nothing was deleted. Refresh the Vault and check.';
    return (j && j.message) || ('Server error: ' + e + '. Nothing was deleted.');
  }
  // -> Promise<{ ok:true, data } | { err } | { auth:true }>. A successful delete clears state.spendData so the Vault reloads.
  function vDelRun(ent) {
    var q = vDelParams(ent);
    return apiRaw(q.action, q.params).then(function (j) {
      if (j && j.error) return { err: vDelMsg(j) };
      state.spendData = null;
      return { ok: true, data: (j && j.data) || {} };
    }, function (err) {
      if (vAuth(err)) return { auth: true };
      return { err: friendly(err) + ' Not confirmed: check the Vault before trying again.' };
    });
  }
  var vds = { el: null, d: null, stage: 'view', err: '', from: null };
  function vSheetEl() {
    if (vds.el) return vds.el;
    var el = document.createElement('div'); el.id = 'vsheet'; el.className = 'vsheet'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Entry details');
    document.body.appendChild(el); vds.el = el;
    el.addEventListener('click', function (e) {
      if (e.target === el || e.target.closest('#vs-close')) return vSheetClose();
      if (e.target.closest('#vs-del')) { vds.stage = 'ask'; vds.err = ''; return vSheetPaint(); }
      if (e.target.closest('#vs-no')) { vds.stage = 'view'; vds.err = ''; return vSheetPaint(); }
      if (e.target.closest('#vs-yes')) return vSheetDelete();
    });
    return el;
  }
  function vSheetOpen(kind, e, from) {
    var d = vEntDesc(kind, e);
    vds.d = d; vds.stage = 'view'; vds.err = ''; vds.from = from || null;
    vSheetEl().hidden = false; document.body.classList.add('vsheet-open'); vSheetPaint();
    var b = vds.el.querySelector('button'); if (b) b.focus();
  }
  function vSheetClose() {
    if (vds.stage === 'busy') return;
    var was = vds.stage === 'done', from = vds.from;
    if (vds.el) { vds.el.hidden = true; vds.el.innerHTML = ''; }
    document.body.classList.remove('vsheet-open'); vds.d = null;
    if (from && from.focus) { try { from.focus(); } catch (x) {} }
    if (was) vVaultRefresh();
  }
  function vVaultRefresh() { if (!state.spendData && $('screen-spend').classList.contains('active')) loadSpend(true); }
  function vSheetPaint() {
    var d = vds.d, el = vds.el; if (!d || !el) return;
    var st = vds.stage, h = '<div class="vsbox"><h3>' + (st === 'done' ? 'Deleted' : d.kind === 'inc' ? 'Income entry' : 'Expense entry') + '</h3>' +
      '<div class="big ' + (d.kind === 'inc' ? 'amt-in' : 'amt-out') + (st === 'done' ? ' vgone' : '') + '">' + money(d.amount) + '</div><div class="vslines">' +
      d.lines.map(function (l) { return '<div class="vsl"><span>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b></div>'; }).join('') + '</div>';
    if (vds.err) h += '<div class="noteflash show bad">' + esc(vds.err) + '</div>';
    if (st === 'done') h += '<div class="noteflash show">Entry deleted. A backup is kept.</div><div class="draftbtns vback"><button type="button" class="navbtn" id="vs-close">Done</button></div>';
    else if (st === 'ask' || st === 'busy') h += '<div class="foot vdelq">Delete this entry? A backup is kept.</div><div class="draftbtns"><button type="button" class="bigsave vdelbtn" id="vs-yes"' + (st === 'busy' ? ' disabled' : '') + '>' + (st === 'busy' ? 'Deleting\u2026' : 'Yes, delete') + '</button><button type="button" class="navbtn" id="vs-no"' + (st === 'busy' ? ' disabled' : '') + '>Keep it</button></div>';
    else h += '<div class="draftbtns">' + (d.ent ? '<button type="button" class="navbtn vdelbtn" id="vs-del">Delete</button>' : '') + '<button type="button" class="navbtn" id="vs-close">Close</button></div>';
    el.innerHTML = h + '</div>';
  }
  function vSheetDelete() {
    var d = vds.d; if (!d || !d.ent || vds.stage === 'busy') return;
    vds.stage = 'busy'; vds.err = ''; vSheetPaint();
    vDelRun(d.ent).then(function (res) {
      if (vds.d !== d) return;
      if (res.auth) { vds.stage = 'view'; return vSheetClose(); }
      if (res.ok) { vds.stage = 'done'; vSheetPaint(); vVaultRefresh(); setTimeout(function () { if (vds.d === d && vds.stage === 'done') vSheetClose(); }, 1600); }
      else { vds.stage = 'ask'; vds.err = res.err; vSheetPaint(); }
    });
  }
  function vEntOpenFrom(el) {
    var r = VENT[el.getAttribute('data-ent')]; if (r) vSheetOpen(r.kind, r.e, el);
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-go], a[href], .chip, button')) return;
    var el = e.target.closest('[data-ent]'); if (el) vEntOpenFrom(el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && vds.el && !vds.el.hidden) return vSheetClose();
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.hasAttribute('data-ent')) { e.preventDefault(); vEntOpenFrom(e.target); }
  });


  /* ---------------- Mono Fold mini-app (#mf / #monofold) — Home / Orders / Customers / Design ---------------- */
  // Design answers: THIS PHONE only (localStorage cc_mf_design) via mfLoad / mfSave. Demo customers/orders: cc_mf_customers / cc_mf_orders.
  // Tabs: #mf|#mf/home (ops preview), #mf/orders, #mf/customers, #mf/design (14-Q mic checklist). Pricing tab reserved.
  var MF_KEY = 'cc_mf_design';
  var MF_CUST_KEY = 'cc_mf_customers';
  var MF_ORD_KEY = 'cc_mf_orders';
  var MF_TABS = [
    { id: 'home', label: 'Home' },
    { id: 'orders', label: 'Orders' },
    { id: 'customers', label: 'Customers' },
    { id: 'design', label: 'Design' }
  ];
  var MF_STATUSES = ['Intake', 'Washing', 'Drying', 'Folding', 'Ready', 'Paid'];
  var MF_STATUS_SHORT = { Intake: 'Intake', Washing: 'Washing', Drying: 'Drying', Folding: 'Folding', Ready: 'Ready', Paid: 'Paid / Picked up' };
  var MF_PREF_OPTS = ['No bleach', 'Hang dry', 'Softener', 'Fold flat', 'Hang shirts', 'Extra soft', 'Hypoallergenic', 'Comforter'];
  var MF_QS = [
    { id: 'pickup_dropoff', title: 'Pickup vs drop-off (day one)',
      help: 'Will day-one customers drop bags off, get pickup, or both? How do they hand off bags?' },
    { id: 'turnaround', title: 'Turnaround promise & late policy',
      help: 'Same day, next day, or something else? What happens when a bag is late?' },
    { id: 'lost_damaged', title: 'Lost / damaged bag policy & tags',
      help: 'How are bags tagged or ticketed? What is the policy if a bag is lost or damaged?' },
    { id: 'preferences', title: 'Preferences & special items',
      help: 'Capture no-bleach, hang-dry, softener, fold style, and specials like comforters. How does the operator see them?' },
    { id: 'pay_settle', title: 'Operator pay vs TiwiK rent / weekly settle',
      help: 'How does the operator get paid? Machine rent to TiwiK? Weekly settle cadence and who runs it?' },
    { id: 'tax_venmo', title: 'Sales tax & Venmo routing',
      help: 'Sales tax approach? Customer Venmo to Mono Fold\'s own Venmo, or TiwiK Venmo?' },
    { id: 'hours_capacity', title: 'Hours, capacity, closed / full switch',
      help: 'Operating hours, max bags / day, and how the operator flips Closed or Full.' },
    { id: 'ready_text', title: 'Customer ready text & whose phone',
      help: 'When laundry is ready, who texts the customer — and from whose phone / number?' },
    { id: 'staff_login', title: 'Staff login (Mono Fold only)',
      help: 'Operator login should see only Mono Fold — not Vault or other CC areas. Confirm scope and passcode plan.' },
    { id: 'supplies', title: 'Supplies cost (detergent, bags)',
      help: 'Who buys detergent, bags, tags? How are supply costs tracked against jobs?' },
    { id: 'payments', title: 'Payments: cash / Venmo',
      help: 'Confirm cash and Venmo are accepted (and any others). Leave confirmed or adjust.',
      seed: 'Cash and Venmo accepted.' },
    { id: 'biz_name', title: 'Business name: Mono Fold',
      help: 'Confirm the customer-facing name is Mono Fold (spelling, branding).',
      seed: 'Confirmed — business name is Mono Fold.' },
    { id: 'no_remote', title: 'No remote machine starts; pay for use',
      help: 'Confirm machines are not started remotely — customers / operator pay for machine use on site.',
      seed: 'Confirmed — no remote machine starts; pay for machine use on site.' },
    { id: 'after_hours', title: 'After-hours pricing (later)',
      help: 'After-hours pricing is deferred. Confirm we park it for a later pass.',
      seed: 'Confirmed — after-hours pricing later.' }
  ];
  var mf = {
    tab: 'home', view: '', custId: '', orderId: '', q: '', statusFilter: '',
    toast: '', toastAt: 0,
    idx: 0, draft: '', flash: '', flashBad: false,
    mic: { rec: null, on: false, base: '', committed: '', interim: '', msg: '' },
    custForm: null, orderForm: null
  };

  function mfLoad() {
    var d = lsGet(MF_KEY, null);
    if (!d || typeof d !== 'object') d = { answers: {}, idx: 0 };
    if (!d.answers || typeof d.answers !== 'object') d.answers = {};
    var answers = {}, seeded = false;
    MF_QS.forEach(function (q) {
      var a = d.answers[q.id];
      if (a && typeof a === 'object') {
        answers[q.id] = { text: String(a.text || '').slice(0, 4000), at: a.at || 0, answered: !!a.answered };
      } else if (typeof a === 'string' && a.trim()) {
        answers[q.id] = { text: a.slice(0, 4000), at: Date.now(), answered: true };
      } else if (q.seed) {
        answers[q.id] = { text: q.seed, at: 0, answered: true };
        seeded = true;
      } else {
        answers[q.id] = { text: '', at: 0, answered: false };
      }
    });
    var idx = parseInt(d.idx, 10);
    if (!isFinite(idx) || idx < 0) idx = 0;
    if (idx >= MF_QS.length) idx = MF_QS.length - 1;
    var out = { answers: answers, idx: idx };
    if (seeded) mfSave(out);
    return out;
  }
  function mfSave(d) {
    try {
      localStorage.setItem(MF_KEY, JSON.stringify({ answers: d.answers, idx: d.idx }));
      return true;
    } catch (e) { return false; }
  }
  function mfOnScreen() { return $('screen-mf') && $('screen-mf').classList.contains('active'); }
  function mfQ() { return MF_QS[mf.idx] || MF_QS[0]; }
  function mfAnsweredCount(d) {
    var n = 0;
    MF_QS.forEach(function (q) { if (d.answers[q.id] && d.answers[q.id].answered && String(d.answers[q.id].text || '').trim()) n++; });
    return n;
  }
  function mfFlash(text, bad) {
    mf.flash = text || ''; mf.flashBad = !!bad;
    var el = $('mf-flash');
    if (el) { el.textContent = mf.flash; el.hidden = !mf.flash; el.className = 'noteflash' + (mf.flash ? ' show' : '') + (bad ? ' bad' : ''); }
  }
  function mfToast(msg) {
    mf.toast = msg || ''; mf.toastAt = Date.now();
    var el = $('mf-toast');
    if (el) { el.textContent = mf.toast; el.hidden = !mf.toast; el.classList.add('show'); }
    setTimeout(function () {
      if (Date.now() - mf.toastAt < 2400) return;
      mf.toast = '';
      var t = $('mf-toast'); if (t) { t.hidden = true; t.classList.remove('show'); }
    }, 2600);
  }
  function mfUid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function mfDemoStamp() {
    return '<span class="mfdemo" title="Sample data for layout preview">Demo</span>';
  }
  function mfTodayLabel() {
    try {
      return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (e) { return 'Today'; }
  }

  /* ---- Demo customers / orders (localStorage; seeded once) ---- */
  function mfDefaultCustomers() {
    return [
      { id: 'c_demo_1', demo: true, name: 'Maya Chen', phone: '(310) 555-0142', venmo: '@maya-chen', prefs: ['No bleach', 'Hang dry'], bags: 3, lastOrder: '2026-10-03', notes: 'Prefers text when Ready.' },
      { id: 'c_demo_2', demo: true, name: 'Jordan Blake', phone: '(424) 555-0198', venmo: '', prefs: ['Softener', 'Fold flat'], bags: 2, lastOrder: '2026-10-04', notes: '' },
      { id: 'c_demo_3', demo: true, name: 'Sam Rivera', phone: '(213) 555-0177', venmo: '@samr', prefs: ['Hypoallergenic', 'Hang shirts'], bags: 5, lastOrder: '2026-09-28', notes: 'Comforter last month.' },
      { id: 'c_demo_4', demo: true, name: 'Alex Kim', phone: '(818) 555-0110', venmo: '@alexkim', prefs: ['No bleach'], bags: 1, lastOrder: '2026-10-05', notes: '' }
    ];
  }
  function mfDefaultOrders() {
    return [
      { id: 'o_demo_1', demo: true, ticket: 'MF-1042', customerId: 'c_demo_1', customer: 'Maya Chen', bags: 3, weight: 18, status: 'Washing', due: 'Today 4:00p', pay: 'Venmo', price: 42, prefs: ['No bleach', 'Hang dry'], at: '2026-10-05T08:10:00' },
      { id: 'o_demo_2', demo: true, ticket: 'MF-1043', customerId: 'c_demo_2', customer: 'Jordan Blake', bags: 2, weight: 12, status: 'Intake', due: 'Today 6:00p', pay: 'Cash', price: 28, prefs: ['Softener'], at: '2026-10-05T09:05:00' },
      { id: 'o_demo_3', demo: true, ticket: 'MF-1040', customerId: 'c_demo_3', customer: 'Sam Rivera', bags: 4, weight: 22, status: 'Folding', due: 'Today 2:30p', pay: 'Venmo', price: 55, prefs: ['Hypoallergenic'], at: '2026-10-05T07:40:00' },
      { id: 'o_demo_4', demo: true, ticket: 'MF-1038', customerId: 'c_demo_4', customer: 'Alex Kim', bags: 1, weight: 8, status: 'Ready', due: 'Ready now', pay: 'Cash', price: 18, prefs: ['No bleach'], at: '2026-10-04T16:20:00' },
      { id: 'o_demo_5', demo: true, ticket: 'MF-1035', customerId: 'c_demo_1', customer: 'Maya Chen', bags: 2, weight: 11, status: 'Paid', due: 'Picked up', pay: 'Venmo', price: 26, prefs: ['Hang dry'], at: '2026-10-03T11:00:00' },
      { id: 'o_demo_6', demo: true, ticket: 'MF-1044', customerId: 'c_demo_2', customer: 'Jordan Blake', bags: 1, weight: 7, status: 'Drying', due: 'Today 5:00p', pay: 'Venmo', price: 16, prefs: ['Fold flat'], at: '2026-10-05T10:15:00' }
    ];
  }
  function mfLoadCustomers() {
    var d = lsGet(MF_CUST_KEY, null);
    if (!d || !Array.isArray(d.list) || !d.list.length) {
      var list = mfDefaultCustomers();
      mfSaveCustomers(list);
      return list;
    }
    return d.list;
  }
  function mfSaveCustomers(list) {
    try { localStorage.setItem(MF_CUST_KEY, JSON.stringify({ list: list })); return true; } catch (e) { return false; }
  }
  function mfLoadOrders() {
    var d = lsGet(MF_ORD_KEY, null);
    if (!d || !Array.isArray(d.list) || !d.list.length) {
      var list = mfDefaultOrders();
      mfSaveOrders(list);
      return list;
    }
    return d.list;
  }
  function mfSaveOrders(list) {
    try { localStorage.setItem(MF_ORD_KEY, JSON.stringify({ list: list })); return true; } catch (e) { return false; }
  }
  function mfFindCust(id) {
    var list = mfLoadCustomers();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function mfFindOrder(id) {
    var list = mfLoadOrders();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function mfOrdersForCust(cid) {
    return mfLoadOrders().filter(function (o) { return o.customerId === cid; })
      .sort(function (a, b) { return String(b.at || '').localeCompare(String(a.at || '')); });
  }
  function mfCountByStatus(orders) {
    var m = {}; MF_STATUSES.forEach(function (s) { m[s] = 0; });
    (orders || mfLoadOrders()).forEach(function (o) { if (m[o.status] != null) m[o.status]++; else m[o.status] = 1; });
    return m;
  }

  function mfMicStop(quiet) {
    var r = mf.mic.rec;
    if (quiet) { mf.mic.rec = null; mf.mic.on = false; try { r && r.abort(); } catch (e) {} mfMicPaint(); return; }
    if (r) { try { r.stop(); } catch (e2) { mf.mic.rec = null; mf.mic.on = false; } }
    else { mf.mic.on = false; mfMicPaint(); }
  }
  function mfMicPaint() {
    var btn = $('mf-mic'); if (!btn) return;
    btn.classList.toggle('rec', !!mf.mic.on);
    btn.setAttribute('aria-pressed', mf.mic.on ? 'true' : 'false');
    var lbl = $('mf-mic-lbl'); if (lbl) lbl.textContent = mf.mic.on ? 'Listening\u2026 tap to stop' : 'Tap to talk';
    var st = $('mf-mic-state');
    if (st) {
      st.className = 'micstate' + (mf.mic.on ? ' rec' : '') + (mf.mic.msg && !mf.mic.on ? ' warn' : '');
      st.textContent = mf.mic.on ? 'Listening\u2026' : (mf.mic.msg || '\u00a0');
    }
  }
  function mfMicStart() {
    if (!SR) { mf.mic.msg = MIC_NA; mfMicPaint(); return; }
    var ta = $('mf-answer'); if (!ta) return;
    mfMicStop(true);
    mf.mic.msg = ''; mf.mic.base = String(ta.value || ''); mf.mic.committed = ''; mf.mic.interim = '';
    var rec; try { rec = new SR(); } catch (e) { mf.mic.msg = MIC_NA; mfMicPaint(); return; }
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) mf.mic.committed = micSpace(mf.mic.committed, t.trim() + ' '); else interim += t;
      }
      mf.mic.interim = interim.replace(/^\s+/, '');
      var add = micSpace(mf.mic.committed, mf.mic.interim).trim();
      var base = mf.mic.base;
      ta.value = (base && add ? micSpace(base.replace(/\s+$/, '') + ' ', add) : (base || add)).slice(0, 4000);
      mf.draft = ta.value;
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') {
        mf.mic.msg = MIC_NA; mf.mic.on = false; mf.mic.rec = null; mfMicPaint(); return;
      }
      if (e === 'network') {
        mf.mic.msg = 'The speech service couldn\u2019t be reached. Tap the text box and use your keyboard\u2019s mic key.';
        mf.mic.on = false; mf.mic.rec = null; mfMicPaint(); return;
      }
      if (e === 'no-speech') mf.mic.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (mf.mic.rec !== rec) return;
      mf.mic.on = false; mf.mic.rec = null;
      if (mf.mic.interim) {
        mf.mic.committed = micSpace(mf.mic.committed, mf.mic.interim.trim() + ' ');
        mf.mic.interim = '';
      }
      mfMicPaint();
    };
    mf.mic.rec = rec; mf.mic.on = true;
    try { rec.start(); } catch (e2) { mf.mic.msg = MIC_NA; mf.mic.on = false; mf.mic.rec = null; }
    mfMicPaint();
  }
  function mfReadDraft() {
    var ta = $('mf-answer');
    if (ta) mf.draft = String(ta.value || '');
    return mf.draft;
  }
  function mfPersistCurrent(markAnswered) {
    var d = mfLoad(), q = mfQ(), text = mfReadDraft().replace(/^\s+|\s+$/g, '');
    d.answers[q.id] = {
      text: text.slice(0, 4000),
      at: Date.now(),
      answered: markAnswered ? !!text : !!(d.answers[q.id] && d.answers[q.id].answered && text)
    };
    if (markAnswered && !text) d.answers[q.id].answered = false;
    d.idx = mf.idx;
    if (!mfSave(d)) { mfFlash('Could not save on this phone (storage full or blocked).', true); return null; }
    return d;
  }
  function mfGoto(i) {
    mfMicStop(true);
    if (i < 0) i = 0;
    if (i >= MF_QS.length) i = MF_QS.length - 1;
    mf.idx = i;
    var d = mfLoad(); d.idx = i; mfSave(d);
    mfRender();
  }

  function mfSubnavHtml() {
    var tab = state.mfTab || 'home';
    return '<nav class="mfnav" aria-label="Mono Fold sections">' + MF_TABS.map(function (t) {
      var on = tab === t.id;
      return '<button type="button" class="mfnavbtn' + (on ? ' on' : '') + '" data-go="mf/' + t.id + '"' + (on ? ' aria-current="page"' : '') + '>' + t.label + '</button>';
    }).join('') + '<button type="button" class="mfnavbtn mfsoon" data-mf="pricing-soon" title="Coming later">Pricing</button></nav>' +
      '<div class="mftoast" id="mf-toast"' + (mf.toast ? '' : ' hidden') + '>' + esc(mf.toast || '') + '</div>';
  }

  function mfOpen() {
    mfMicStop(true);
    mf.flash = ''; mf.flashBad = false;
    mf.tab = state.mfTab || 'home';
    if (mf.tab !== 'design') { mf.view = mf.view && (mf.tab === 'customers' || mf.tab === 'orders') ? mf.view : ''; }
    if (mf.tab === 'design') {
      var d = mfLoad();
      mf.idx = d.idx;
    }
    if (mf.tab !== 'customers') { mf.custId = ''; mf.custForm = null; if (mf.view === 'cust-detail' || mf.view === 'cust-form') mf.view = ''; }
    if (mf.tab !== 'orders') { mf.orderId = ''; mf.orderForm = null; if (mf.view === 'ord-detail' || mf.view === 'ord-form') mf.view = ''; }
    mfRender();
  }

  function mfPrefsChips(prefs, interactive, selected) {
    prefs = prefs || [];
    if (!interactive) {
      if (!prefs.length) return '<span class="mfmuted">No prefs</span>';
      return prefs.map(function (p) { return '<span class="mfchip">' + esc(p) + '</span>'; }).join('');
    }
    var sel = selected || {};
    return MF_PREF_OPTS.map(function (p) {
      var on = !!sel[p];
      return '<button type="button" class="mfchipbtn' + (on ? ' on' : '') + '" data-mf="pref-tog" data-p="' + esc(p) + '" aria-pressed="' + on + '">' + esc(p) + '</button>';
    }).join('');
  }

  /* ---- HOME: live-preview ops dashboard ---- */
  function mfRenderHome() {
    var orders = mfLoadOrders(), counts = mfCountByStatus(orders);
    var active = orders.filter(function (o) { return o.status !== 'Paid'; });
    var bagsIn = active.reduce(function (n, o) { return n + (parseInt(o.bags, 10) || 0); }, 0);
    var readyN = counts.Ready || 0;
    var cashToday = 0, venmoToday = 0;
    orders.forEach(function (o) {
      if (o.status !== 'Paid' && o.status !== 'Ready') return;
      var p = parseFloat(o.price) || 0;
      if (o.pay === 'Cash') cashToday += p; else if (o.pay === 'Venmo') venmoToday += p;
    });
    var statusRow = ['Intake', 'Washing', 'Drying', 'Folding', 'Ready'].map(function (s) {
      return '<div class="mfstatcard" data-go="mf/orders"><div class="mfstatn">' + (counts[s] || 0) + '</div><div class="mfstatl">' + esc(s) + '</div></div>';
    }).join('');
    var cards = active.slice(0, 4).map(function (o) {
      return '<button type="button" class="mfocard" data-mf="ord-open" data-id="' + esc(o.id) + '">' +
        '<div class="mfohead"><span class="mfticket">' + esc(o.ticket) + '</span>' + (o.demo ? mfDemoStamp() : '') +
        '<span class="mfostatus s-' + esc(o.status.toLowerCase().replace(/\s+/g, '')) + '">' + esc(o.status) + '</span></div>' +
        '<div class="mfowho">' + esc(o.customer) + '</div>' +
        '<div class="mfometa">' + (o.bags || 0) + ' bag' + (o.bags === 1 ? '' : 's') +
        (o.weight ? ' \u00b7 ' + o.weight + ' lb' : '') + ' \u00b7 Due ' + esc(o.due || '\u2014') + '</div></button>';
    }).join('');
    return '<div class="mfhome">' +
      '<div class="mfheroband"><div class="mfhero">' +
      '<div class="mfkicker">Go-live preview</div>' +
      '<h3 class="mfherotitle">Today\u2019s floor</h3>' +
      '<div class="mfherodate">' + esc(mfTodayLabel()) + ' \u00b7 sample data ' + mfDemoStamp() + '</div></div>' +
      '<button type="button" class="bigsave mfnewbig" data-mf="new-order">+ New Order</button></div>' +
      '<div class="mfstats">' + statusRow + '</div>' +
      '<div class="mfquick">' +
      '<div class="mfqcard"><div class="mfql">Bags in</div><div class="mfqv">' + bagsIn + '</div></div>' +
      '<div class="mfqcard"><div class="mfql">Ready pickup</div><div class="mfqv">' + readyN + '</div></div>' +
      '<div class="mfqcard"><div class="mfql">Cash today</div><div class="mfqv">$' + cashToday.toFixed(0) + '</div></div>' +
      '<div class="mfqcard"><div class="mfql">Venmo today</div><div class="mfqv">$' + venmoToday.toFixed(0) + '</div></div>' +
      '</div>' +
      '<div class="mfsechead"><span>Active orders</span><button type="button" class="navbtn mfmini" data-go="mf/orders">Board</button></div>' +
      '<div class="mfoquick">' + (cards || '<div class="mfempty">No active orders yet.</div>') + '</div>' +
      '<div class="foot mffoot">Layout preview for Mono Fold ops. Design Q&amp;A lives under Design. Demo numbers are not live.</div></div>';
  }

  /* ---- DESIGN tab (existing 14-Q checklist) ---- */
  function mfRenderDesign() {
    var d = mfLoad(), q = mfQ(), a = d.answers[q.id] || { text: '', answered: false };
    mf.draft = a.text || '';
    var done = mfAnsweredCount(d), total = MF_QS.length, n = mf.idx + 1;
    var status = (a.answered && String(a.text || '').trim()) ? 'answered' : 'unanswered';
    var pills = MF_QS.map(function (qq, i) {
      var aa = d.answers[qq.id], ok = aa && aa.answered && String(aa.text || '').trim();
      return '<button type="button" class="mfdot' + (i === mf.idx ? ' on' : '') + (ok ? ' ok' : '') + '" data-mf="jump" data-i="' + i + '" aria-label="Question ' + (i + 1) + (ok ? ' answered' : '') + '"' + (i === mf.idx ? ' aria-current="true"' : '') + '>' + (i + 1) + '</button>';
    }).join('');
    return '<div class="mfdesign">' +
      '<div class="foot mfintro">Design checklist for Mono Fold (laundry). Answer one at a time — mic or type. Saved on this phone only.</div>' +
      '<div class="mfprog"><span class="mfprog-lbl">Progress <b>' + done + '</b> of <b>' + total + '</b> answered</span>' +
      '<span class="mfbadge ' + status + '">' + (status === 'answered' ? 'Answered' : 'Unanswered') + '</span></div>' +
      '<div class="mfdots" role="tablist" aria-label="Questions">' + pills + '</div>' +
      '<div class="card mfcard">' +
      '<div class="mfqmeta">Question ' + n + ' of ' + total + '</div>' +
      '<h3 class="sechead mfqtitle">' + esc(q.title) + '</h3>' +
      '<p class="mfhelp">' + esc(q.help) + '</p>' +
      '<label class="mflbl" for="mf-answer">Answer</label>' +
      '<textarea id="mf-answer" class="notebox" rows="5" maxlength="4000" autocapitalize="sentences" placeholder="Speak it, type it, or use the keyboard\u2019s mic key.">' + esc(mf.draft) + '</textarea>' +
      '<div class="micstage macmic mfmic"><button type="button" class="micbtn" id="mf-mic" data-mf="mic" aria-pressed="false" aria-label="Start dictation"><span class="micico" aria-hidden="true">' + vsvg('mic', 34) + '</span><span class="miclbl" id="mf-mic-lbl">Tap to talk</span></button>' +
      '<div class="micstate" id="mf-mic-state">&nbsp;</div></div>' +
      '<div class="noteflash" id="mf-flash" hidden></div>' +
      '<div class="draftbtns mfactions">' +
      '<button type="button" class="bigsave" data-mf="save">Save</button>' +
      '<button type="button" class="navbtn" data-mf="next"' + (mf.idx >= total - 1 ? ' disabled' : '') + '>Next</button>' +
      '</div>' +
      '<div class="draftbtns mfactions2">' +
      '<button type="button" class="navbtn" data-mf="back"' + (mf.idx <= 0 ? ' disabled' : '') + '>&lsaquo; Back</button>' +
      '<button type="button" class="navbtn" data-mf="clear">Clear answer</button>' +
      '</div>' +
      '</div>' +
      '<div class="foot mffoot">Answers stay on this phone (<code>cc_mf_design</code>).</div></div>';
  }

  /* ---- CUSTOMERS ---- */
  function mfRenderCustomers() {
    if (mf.view === 'cust-form') return mfRenderCustForm();
    if (mf.view === 'cust-detail') return mfRenderCustDetail();
    var list = mfLoadCustomers();
    var q = String(mf.q || '').trim().toLowerCase();
    var filtered = !q ? list : list.filter(function (c) {
      var blob = (c.name + ' ' + (c.phone || '') + ' ' + (c.venmo || '') + ' ' + (c.prefs || []).join(' ')).toLowerCase();
      return blob.indexOf(q) >= 0;
    });
    var rows = filtered.map(function (c) {
      return '<button type="button" class="mfclist" data-mf="cust-open" data-id="' + esc(c.id) + '">' +
        '<div class="mfcrow1"><span class="mfcname">' + esc(c.name) + '</span>' + (c.demo ? mfDemoStamp() : '') +
        '<span class="mfcbag">' + (c.bags != null ? c.bags + ' bags' : '') + '</span></div>' +
        '<div class="mfcrow2">' + esc(c.phone || 'No phone') +
        (c.venmo ? ' \u00b7 ' + esc(c.venmo) : '') +
        (c.lastOrder ? ' \u00b7 Last ' + esc(c.lastOrder) : '') + '</div>' +
        '<div class="mfcprefs">' + mfPrefsChips(c.prefs) + '</div></button>';
    }).join('');
    return '<div class="mfcusts">' +
      '<div class="mftoolbar"><input type="search" class="searchbox" id="mf-cust-q" placeholder="Search name, phone, Venmo\u2026" value="' + esc(mf.q || '') + '" autocomplete="off">' +
      '<button type="button" class="bigsave mfadd" data-mf="cust-new">+ Add</button></div>' +
      (rows || '<div class="mfempty card"><b>No customers yet</b><p>Add your first regular — name, phone, and wash prefs. Demo people appear until you add real ones.</p>' +
        '<button type="button" class="bigsave" data-mf="cust-new">+ Add customer</button></div>') +
      '<div class="foot mffoot">Customer list layout for go-live. Saved on this phone (<code>cc_mf_customers</code>).</div></div>';
  }
  function mfBlankCustForm(base) {
    return {
      id: (base && base.id) || '',
      name: (base && base.name) || '',
      phone: (base && base.phone) || '',
      venmo: (base && base.venmo) || '',
      notes: (base && base.notes) || '',
      prefs: (base && base.prefs) ? base.prefs.slice() : [],
      demo: false
    };
  }
  function mfRenderCustForm() {
    var f = mf.custForm || mfBlankCustForm();
    var sel = {}; (f.prefs || []).forEach(function (p) { sel[p] = 1; });
    return '<div class="mfform">' +
      '<button type="button" class="navbtn mfback" data-mf="cust-back">&lsaquo; Customers</button>' +
      '<h3 class="sechead">' + (f.id ? 'Edit customer' : 'Add customer') + '</h3>' +
      '<label class="mflbl" for="mf-cf-name">Name</label>' +
      '<input class="wlin" id="mf-cf-name" data-mf-cf="name" value="' + esc(f.name) + '" placeholder="Full name" maxlength="80" autocomplete="name">' +
      '<label class="mflbl" for="mf-cf-phone">Phone</label>' +
      '<input class="wlin" id="mf-cf-phone" data-mf-cf="phone" value="' + esc(f.phone) + '" placeholder="(xxx) xxx-xxxx" maxlength="30" inputmode="tel" autocomplete="tel">' +
      '<label class="mflbl" for="mf-cf-venmo">Venmo <span class="mfopt">(optional)</span></label>' +
      '<input class="wlin" id="mf-cf-venmo" data-mf-cf="venmo" value="' + esc(f.venmo) + '" placeholder="@handle" maxlength="40">' +
      '<div class="mflbl">Prefs</div><div class="mfchipwrap" id="mf-cf-prefs">' + mfPrefsChips(null, true, sel) + '</div>' +
      '<label class="mflbl" for="mf-cf-notes">Notes</label>' +
      '<textarea class="notebox" id="mf-cf-notes" data-mf-cf="notes" rows="3" maxlength="500" placeholder="Ready text, specials\u2026">' + esc(f.notes || '') + '</textarea>' +
      '<div class="noteflash" id="mf-flash" hidden></div>' +
      '<div class="draftbtns mfactions"><button type="button" class="bigsave" data-mf="cust-save">Save customer</button>' +
      '<button type="button" class="navbtn" data-mf="cust-back">Cancel</button></div></div>';
  }
  function mfRenderCustDetail() {
    var c = mfFindCust(mf.custId);
    if (!c) { mf.view = ''; return mfRenderCustomers(); }
    var hist = mfOrdersForCust(c.id);
    var histHtml = hist.length ? hist.map(function (o) {
      return '<div class="mohist"><div class="mohist1"><b>' + esc(o.ticket) + '</b> ' + (o.demo ? mfDemoStamp() : '') +
        '<span class="mfostatus s-' + esc(String(o.status).toLowerCase().replace(/\s+/g, '')) + '">' + esc(o.status) + '</span></div>' +
        '<div class="mohist2">' + (o.bags || 0) + ' bags \u00b7 $' + (o.price != null ? o.price : '\u2014') + ' \u00b7 ' + esc(o.pay || '') +
        (o.at ? ' \u00b7 ' + esc(String(o.at).slice(0, 10)) : '') + '</div></div>';
    }).join('') : '<div class="mfempty">No orders yet for this customer.</div>';
    return '<div class="mfcdetail">' +
      '<button type="button" class="navbtn mfback" data-mf="cust-back">&lsaquo; Customers</button>' +
      '<div class="card mfprofile">' +
      '<div class="mfcrow1"><h3 class="mfherotitle">' + esc(c.name) + '</h3>' + (c.demo ? mfDemoStamp() : '') + '</div>' +
      '<div class="mfprow"><span class="mflbl">Phone</span><span>' + esc(c.phone || '\u2014') + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Venmo</span><span>' + esc(c.venmo || '\u2014') + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Bags / last</span><span>' + (c.bags != null ? c.bags : '\u2014') +
      (c.lastOrder ? ' \u00b7 ' + esc(c.lastOrder) : '') + '</span></div>' +
      '<div class="mflbl">Prefs</div><div class="mfcprefs">' + mfPrefsChips(c.prefs) + '</div>' +
      (c.notes ? '<p class="mfhelp">' + esc(c.notes) + '</p>' : '') +
      '<div class="draftbtns mfactions2"><button type="button" class="navbtn" data-mf="cust-edit" data-id="' + esc(c.id) + '">Edit</button>' +
      '<button type="button" class="navbtn" data-mf="new-order" data-cid="' + esc(c.id) + '">New order</button></div></div>' +
      '<div class="mfsechead"><span>Order history</span></div>' + histHtml +
      '</div>';
  }

  /* ---- ORDERS ---- */
  function mfRenderOrders() {
    if (mf.view === 'ord-form') return mfRenderOrderForm();
    if (mf.view === 'ord-detail') return mfRenderOrderDetail();
    var orders = mfLoadOrders();
    var filter = mf.statusFilter || '';
    var board = MF_STATUSES.map(function (s) {
      var items = orders.filter(function (o) { return o.status === s; });
      if (filter && filter !== s) return '';
      var cards = items.map(function (o) {
        return '<button type="button" class="mfocard compact" data-mf="ord-open" data-id="' + esc(o.id) + '">' +
          '<div class="mfohead"><span class="mfticket">' + esc(o.ticket) + '</span>' + (o.demo ? mfDemoStamp() : '') + '</div>' +
          '<div class="mfowho">' + esc(o.customer) + '</div>' +
          '<div class="mfometa">' + (o.bags || 0) + ' bag' + (o.bags === 1 ? '' : 's') +
          (o.weight ? ' \u00b7 ' + o.weight + ' lb' : '') + '</div>' +
          '<div class="mfometa">Due ' + esc(o.due || '\u2014') + ' \u00b7 ' + esc(o.pay || '') + '</div>' +
          '<div class="mfcprefs">' + mfPrefsChips(o.prefs) + '</div></button>';
      }).join('');
      return '<div class="mfcol" data-status="' + esc(s) + '">' +
        '<div class="mfcolhead"><span>' + esc(MF_STATUS_SHORT[s] || s) + '</span><span class="mfcoln">' + items.length + '</span></div>' +
        (cards || '<div class="mfcolempty">None</div>') + '</div>';
    }).join('');
    var seg = ['', 'Intake', 'Washing', 'Drying', 'Folding', 'Ready', 'Paid'].map(function (s) {
      var label = s ? (MF_STATUS_SHORT[s] || s) : 'All';
      var on = (filter || '') === s;
      return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-mf="ord-filter" data-s="' + esc(s) + '" aria-pressed="' + on + '">' + esc(label) + '</button>';
    }).join('');
    return '<div class="mforders">' +
      '<div class="mftoolbar"><div class="vchips mfseg">' + seg + '</div>' +
      '<button type="button" class="bigsave mfadd" data-mf="new-order">+ New</button></div>' +
      '<div class="mfboard">' + board + '</div>' +
      '<div class="foot mffoot">Order board layout (Intake \u2192 Paid). Demo tickets labeled. Saved on this phone (<code>cc_mf_orders</code>).</div></div>';
  }
  function mfBlankOrderForm(preCust) {
    var c = preCust ? mfFindCust(preCust) : null;
    return {
      customerId: c ? c.id : '',
      customer: c ? c.name : '',
      bags: '1', weight: '', price: '', pay: 'Venmo', due: 'Today 6:00p',
      prefs: c && c.prefs ? c.prefs.slice() : [], notes: ''
    };
  }
  function mfRenderOrderForm() {
    var f = mf.orderForm || mfBlankOrderForm();
    var custs = mfLoadCustomers();
    var opts = '<option value="">Select customer\u2026</option>' + custs.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (f.customerId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var sel = {}; (f.prefs || []).forEach(function (p) { sel[p] = 1; });
    return '<div class="mfform">' +
      '<button type="button" class="navbtn mfback" data-mf="ord-back">&lsaquo; Orders</button>' +
      '<h3 class="sechead">New order (intake)</h3>' +
      '<label class="mflbl" for="mf-of-cust">Customer</label>' +
      '<select class="wlin" id="mf-of-cust" data-mf-of="customerId">' + opts + '</select>' +
      '<div class="mffields2">' +
      '<div><label class="mflbl" for="mf-of-bags">Bags</label>' +
      '<input class="wlin" id="mf-of-bags" data-mf-of="bags" value="' + esc(f.bags) + '" inputmode="numeric" maxlength="3"></div>' +
      '<div><label class="mflbl" for="mf-of-wt">Weight (lb)</label>' +
      '<input class="wlin" id="mf-of-wt" data-mf-of="weight" value="' + esc(f.weight) + '" inputmode="decimal" maxlength="6"></div></div>' +
      '<div class="mffields2">' +
      '<div><label class="mflbl" for="mf-of-price">Price ($)</label>' +
      '<input class="wlin" id="mf-of-price" data-mf-of="price" value="' + esc(f.price) + '" inputmode="decimal" maxlength="8"></div>' +
      '<div><label class="mflbl" for="mf-of-due">Due</label>' +
      '<input class="wlin" id="mf-of-due" data-mf-of="due" value="' + esc(f.due) + '" maxlength="40" placeholder="Today 6:00p"></div></div>' +
      '<div class="mflbl">Payment</div><div class="vchips" id="mf-of-pay">' +
      [['Cash', 'Cash'], ['Venmo', 'Venmo']].map(function (p) {
        var on = f.pay === p[0];
        return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-mf="pay-set" data-p="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="mflbl">Prefs</div><div class="mfchipwrap">' + mfPrefsChips(null, true, sel) + '</div>' +
      '<div class="noteflash" id="mf-flash" hidden></div>' +
      '<div class="draftbtns mfactions"><button type="button" class="bigsave" data-mf="ord-save">Create order</button>' +
      '<button type="button" class="navbtn" data-mf="ord-back">Cancel</button></div>' +
      '<div class="foot">Creates an Intake ticket on this phone (demo layout).</div></div>';
  }
  function mfRenderOrderDetail() {
    var o = mfFindOrder(mf.orderId);
    if (!o) { mf.view = ''; return mfRenderOrders(); }
    var steps = MF_STATUSES.map(function (s) {
      var on = o.status === s;
      return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-mf="ord-status" data-s="' + esc(s) + '" aria-pressed="' + on + '">' + esc(MF_STATUS_SHORT[s] || s) + '</button>';
    }).join('');
    return '<div class="mfodetail">' +
      '<button type="button" class="navbtn mfback" data-mf="ord-back">&lsaquo; Orders</button>' +
      '<div class="card mfprofile">' +
      '<div class="mfohead"><span class="mfticket big">' + esc(o.ticket) + '</span>' + (o.demo ? mfDemoStamp() : '') +
      '<span class="mfostatus s-' + esc(String(o.status).toLowerCase().replace(/\s+/g, '')) + '">' + esc(o.status) + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Customer</span><span>' + esc(o.customer) + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Bags / wt</span><span>' + (o.bags || 0) + ' bags' + (o.weight ? ' \u00b7 ' + o.weight + ' lb' : '') + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Due</span><span>' + esc(o.due || '\u2014') + '</span></div>' +
      '<div class="mfprow"><span class="mflbl">Pay</span><span>' + esc(o.pay || '\u2014') + (o.price != null ? ' \u00b7 $' + o.price : '') + '</span></div>' +
      '<div class="mflbl">Prefs</div><div class="mfcprefs">' + mfPrefsChips(o.prefs) + '</div>' +
      '<div class="mflbl">Move status</div><div class="vchips mfseg">' + steps + '</div></div></div>';
  }

  function mfRender() {
    var box = $('mf-body'); if (!box) return;
    var tab = state.mfTab || 'home';
    mf.tab = tab;
    var title = $('mf-title'); if (title) title.textContent = 'Mono Fold';
    var inner = '';
    if (tab === 'design') inner = mfRenderDesign();
    else if (tab === 'customers') inner = mfRenderCustomers();
    else if (tab === 'orders') inner = mfRenderOrders();
    else if (tab === 'pricing') inner = '<div class="mfempty card"><b>Pricing</b><p>Coming later — room reserved in the Mono Fold sub-nav.</p></div>';
    else inner = mfRenderHome();
    box.innerHTML = '<div class="mf">' + mfSubnavHtml() + inner + '</div>';
    if (tab === 'design' && mf.flash) mfFlash(mf.flash, mf.flashBad);
    if (tab === 'design') {
      mfMicPaint();
      var ta = $('mf-answer');
      if (ta) ta.addEventListener('input', function () { mf.draft = ta.value; });
    }
    var sq = $('mf-cust-q');
    if (sq) {
      sq.addEventListener('input', function () {
        mf.q = sq.value;
        // lightweight re-filter without losing focus: re-render list only if needed
        mfRender();
        var again = $('mf-cust-q'); if (again) { again.focus(); try { again.setSelectionRange(again.value.length, again.value.length); } catch (e) {} }
      });
    }
  }

  function mfReadCustForm() {
    var f = mf.custForm || mfBlankCustForm();
    var name = $('mf-cf-name'), phone = $('mf-cf-phone'), venmo = $('mf-cf-venmo'), notes = $('mf-cf-notes');
    if (name) f.name = name.value; if (phone) f.phone = phone.value;
    if (venmo) f.venmo = venmo.value; if (notes) f.notes = notes.value;
    mf.custForm = f; return f;
  }
  function mfReadOrderForm() {
    var f = mf.orderForm || mfBlankOrderForm();
    var cust = $('mf-of-cust'), bags = $('mf-of-bags'), wt = $('mf-of-wt'), price = $('mf-of-price'), due = $('mf-of-due');
    if (cust) {
      f.customerId = cust.value;
      var c = mfFindCust(f.customerId);
      f.customer = c ? c.name : '';
      if (c && (!f.prefs || !f.prefs.length)) f.prefs = (c.prefs || []).slice();
    }
    if (bags) f.bags = bags.value; if (wt) f.weight = wt.value;
    if (price) f.price = price.value; if (due) f.due = due.value;
    mf.orderForm = f; return f;
  }
  function mfNextTicket() {
    var orders = mfLoadOrders(), max = 1044;
    orders.forEach(function (o) {
      var m = String(o.ticket || '').match(/(\d+)/); if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return 'MF-' + (max + 1);
  }

  $('mf-body').addEventListener('click', function (e) {
    if (!mfOnScreen()) return;
    var b = e.target.closest('[data-mf]'); if (!b) return;
    var a = b.getAttribute('data-mf');
    if (a === 'pricing-soon') { mfToast('Pricing — coming later'); return; }
    if (a === 'mic') { if (mf.mic.on) mfMicStop(); else mfMicStart(); }
    else if (a === 'save') {
      mfMicStop(true);
      var d = mfPersistCurrent(true);
      if (!d) return;
      var q = mfQ(), ans = d.answers[q.id];
      if (!(ans && ans.answered && String(ans.text || '').trim())) return mfFlash('Type or dictate an answer before saving.', true);
      mfFlash('Saved.', false);
      mfRender();
    }
    else if (a === 'next') {
      mfMicStop(true);
      var dN = mfLoad(); dN.idx = mf.idx; mfSave(dN);
      if (mf.idx < MF_QS.length - 1) mfGoto(mf.idx + 1);
      else { mfFlash('That was the last question. ' + mfAnsweredCount(mfLoad()) + ' of ' + MF_QS.length + ' answered.', false); mfRender(); }
    }
    else if (a === 'back') {
      mfMicStop(true);
      var dB = mfLoad(); dB.idx = mf.idx; mfSave(dB);
      if (mf.idx > 0) mfGoto(mf.idx - 1);
    }
    else if (a === 'jump') {
      mfMicStop(true);
      var dJ = mfLoad(); dJ.idx = mf.idx; mfSave(dJ);
      mfGoto(parseInt(b.getAttribute('data-i'), 10) || 0);
    }
    else if (a === 'clear') {
      mfMicStop(true);
      var d2 = mfLoad(), q2 = mfQ();
      d2.answers[q2.id] = { text: '', at: Date.now(), answered: false };
      d2.idx = mf.idx;
      if (!mfSave(d2)) return mfFlash('Could not save on this phone.', true);
      mf.draft = ''; mfFlash('Answer cleared.', false); mfRender();
    }
    else if (a === 'new-order') {
      state.mfTab = 'orders';
      mf.view = 'ord-form';
      mf.orderForm = mfBlankOrderForm(b.getAttribute('data-cid') || '');
      if (location.hash !== '#mf/orders') history.pushState({ screen: 'mf' }, '', '#mf/orders');
      mfRender();
    }
    else if (a === 'cust-new') {
      mf.view = 'cust-form'; mf.custForm = mfBlankCustForm(); mfRender();
    }
    else if (a === 'cust-open') {
      mf.custId = b.getAttribute('data-id') || ''; mf.view = 'cust-detail'; mfRender();
    }
    else if (a === 'cust-back') {
      mf.view = ''; mf.custForm = null; mf.custId = ''; mfRender();
    }
    else if (a === 'cust-edit') {
      var ec = mfFindCust(b.getAttribute('data-id') || mf.custId);
      mf.view = 'cust-form'; mf.custForm = mfBlankCustForm(ec || null); mfRender();
    }
    else if (a === 'cust-save') {
      var cf = mfReadCustForm();
      if (!String(cf.name || '').trim()) return mfFlash('Name is required.', true);
      var clist = mfLoadCustomers();
      if (cf.id) {
        for (var ci = 0; ci < clist.length; ci++) {
          if (clist[ci].id === cf.id) {
            var prev = clist[ci];
            clist[ci] = { id: prev.id, demo: !!prev.demo, name: cf.name.trim(), phone: String(cf.phone || '').trim(), venmo: String(cf.venmo || '').trim(), notes: String(cf.notes || '').trim(), prefs: cf.prefs || [], bags: prev.bags, lastOrder: prev.lastOrder };
            break;
          }
        }
      } else {
        clist.unshift({ id: mfUid('c'), demo: false, name: cf.name.trim(), phone: String(cf.phone || '').trim(), venmo: String(cf.venmo || '').trim(), notes: String(cf.notes || '').trim(), prefs: cf.prefs || [], bags: 0, lastOrder: '' });
      }
      if (!mfSaveCustomers(clist)) return mfFlash('Could not save on this phone.', true);
      mf.view = ''; mf.custForm = null; mfToast('Customer saved'); mfRender();
    }
    else if (a === 'pref-tog') {
      var p = b.getAttribute('data-p');
      if (mf.view === 'cust-form') {
        var cf2 = mfReadCustForm(); cf2.prefs = cf2.prefs || [];
        var ix = cf2.prefs.indexOf(p); if (ix >= 0) cf2.prefs.splice(ix, 1); else cf2.prefs.push(p);
        mf.custForm = cf2; mfRender();
      } else if (mf.view === 'ord-form') {
        var of2 = mfReadOrderForm(); of2.prefs = of2.prefs || [];
        var ix2 = of2.prefs.indexOf(p); if (ix2 >= 0) of2.prefs.splice(ix2, 1); else of2.prefs.push(p);
        mf.orderForm = of2; mfRender();
      }
    }
    else if (a === 'ord-open') {
      state.mfTab = 'orders';
      mf.orderId = b.getAttribute('data-id') || ''; mf.view = 'ord-detail';
      if (location.hash.indexOf('#mf/orders') !== 0) history.pushState({ screen: 'mf' }, '', '#mf/orders');
      mfRender();
    }
    else if (a === 'ord-back') {
      mf.view = ''; mf.orderForm = null; mf.orderId = ''; mfRender();
    }
    else if (a === 'ord-filter') {
      mf.statusFilter = b.getAttribute('data-s') || ''; mfRender();
    }
    else if (a === 'pay-set') {
      var of3 = mfReadOrderForm(); of3.pay = b.getAttribute('data-p') || 'Venmo'; mf.orderForm = of3; mfRender();
    }
    else if (a === 'ord-save') {
      var of = mfReadOrderForm();
      if (!of.customerId) return mfFlash('Pick a customer.', true);
      var bagsN = parseInt(of.bags, 10) || 0;
      if (bagsN < 1) return mfFlash('Bags must be at least 1.', true);
      var olist = mfLoadOrders();
      var neu = {
        id: mfUid('o'), demo: false, ticket: mfNextTicket(),
        customerId: of.customerId, customer: of.customer,
        bags: bagsN, weight: parseFloat(of.weight) || '', status: 'Intake',
        due: String(of.due || 'Today 6:00p').trim(), pay: of.pay || 'Venmo',
        price: parseFloat(of.price) || 0, prefs: of.prefs || [],
        at: new Date().toISOString()
      };
      olist.unshift(neu);
      if (!mfSaveOrders(olist)) return mfFlash('Could not save on this phone.', true);
      // bump customer bags / lastOrder
      var cl2 = mfLoadCustomers();
      for (var j = 0; j < cl2.length; j++) {
        if (cl2[j].id === of.customerId) {
          cl2[j].bags = (parseInt(cl2[j].bags, 10) || 0) + bagsN;
          cl2[j].lastOrder = neu.at.slice(0, 10);
          break;
        }
      }
      mfSaveCustomers(cl2);
      mf.view = 'ord-detail'; mf.orderId = neu.id; mf.orderForm = null;
      mfToast('Order ' + neu.ticket + ' created'); mfRender();
    }
    else if (a === 'ord-status') {
      var olist2 = mfLoadOrders(), oid = mf.orderId, st = b.getAttribute('data-s');
      for (var k = 0; k < olist2.length; k++) {
        if (olist2[k].id === oid) { olist2[k].status = st; break; }
      }
      mfSaveOrders(olist2); mfToast('Moved to ' + st); mfRender();
    }
  });
  $('mf-body').addEventListener('change', function (e) {
    if (!mfOnScreen()) return;
    if (e.target && e.target.getAttribute('data-mf-of') === 'customerId') {
      var ofc = mfReadOrderForm();
      var c = mfFindCust(ofc.customerId);
      if (c) { ofc.customer = c.name; ofc.prefs = (c.prefs || []).slice(); mf.orderForm = ofc; mfRender(); }
    }
  });


  /* ---------------- Plan Checks (#pc) \u2014 mic numbered checklist + plan pins + text notes + PDF ---------------- */
  var PC_KEY = 'cc_pc_checklists';
  var PC_TO_KEY = 'cc_pc_recent_to';
  var PC_DRIVE = 'https://drive.google.com/drive/folders/1aa_oZN1h014ohyC9m6TfWkbPg7fcaeo5';
  var PC_DRAW_MAX = 900000;   // ~data-URL char budget for localStorage (~675 KB jpeg)
  var PC_PDF_MAX = 1800000;   // PDF data-URL budget (~1.3 MB file)
  var PC_PROJECTS = ['Terra Vi', 'MarVal', 'Boyer Matheson / Mathiesen', 'Mariposa Gold Mine', 'YSF', 'Brocchini', 'Hetch Hetchy', 'Other'];
  var PC_WORDS = {
    one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5,
    six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20
  };
  var pc = {
    id: '', title: '', project: 'Terra Vi', projectOther: '', to: '',
    items: [{ text: '', pin: null }], annots: [], cur: 1, annotCur: '',
    drawing: '', drawingKind: '', // 'image' | 'pdf'
    page: 1, pdfPages: 1, pdfDoc: null, pdfToken: 0, pdfBusy: false,
    mode: 'view', // 'view' | 'pin' | 'text'
    drawBusy: false, flash: '', flashBad: false,
    fs: false, zoom: 1, panX: 0, panY: 0, // fullscreen plan workspace
    mic: { rec: null, on: false, msg: '', interim: '', target: 'item' } // target: 'item' | 'annot'
  };
  if (!state.pcRoute) state.pcRoute = { kind: 'list', id: '' };

  function pcUid() { return 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pcAnnotId() { return 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pcOnScreen() { var el = document.querySelector('.screen.active'); return el && el.id === 'screen-pc'; }
  function pcTodayLabel() {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function pcDefaultTitle() { return 'Plan check \u2014 ' + pcTodayLabel(); }
  function pcLoadStore() {
    var d = lsGet(PC_KEY, null);
    if (!d || !Array.isArray(d.list)) d = { list: [] };
    return d;
  }
  function pcSaveStore(d) {
    try { localStorage.setItem(PC_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  function pcFind(id) {
    var list = pcLoadStore().list;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function pcClampPct(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  }
  function pcNormPin(pin) {
    if (!pin || typeof pin.x !== 'number' || typeof pin.y !== 'number') return null;
    var p = { x: pcClampPct(pin.x), y: pcClampPct(pin.y) };
    var pg = parseInt(pin.page, 10);
    if (pg >= 1) p.page = pg;
    return p;
  }
  function pcNormItem(it) {
    if (typeof it === 'string') return { text: it, pin: null };
    return { text: String((it && it.text) != null ? it.text : ''), pin: pcNormPin(it && it.pin) };
  }
  function pcNormAnnot(a) {
    if (!a || typeof a !== 'object') return null;
    var x = pcClampPct(a.x), y = pcClampPct(a.y);
    var page = parseInt(a.page, 10); if (!(page >= 1)) page = 1;
    var ref = parseInt(a.refItem, 10);
    var out = {
      id: String(a.id || pcAnnotId()),
      type: 'text',
      x: x, y: y, page: page,
      text: String(a.text != null ? a.text : '').slice(0, 2000)
    };
    if (ref >= 1) out.refItem = ref;
    return out;
  }
  function pcEnsureItems() {
    if (!pc.items || !pc.items.length) pc.items = [{ text: '', pin: null }];
    if (pc.cur < 1) pc.cur = 1;
    while (pc.items.length < pc.cur) pc.items.push({ text: '', pin: null });
  }
  function pcEnsureAnnots() {
    if (!Array.isArray(pc.annots)) pc.annots = [];
  }
  function pcHasPlan() {
    return !!(pc.drawing && (pc.drawingKind === 'pdf' || pc.drawingKind === 'image' || pc.drawing.indexOf('data:') === 0));
  }
  function pcInferKind(dataUrl) {
    if (!dataUrl) return '';
    if (dataUrl.indexOf('data:application/pdf') === 0) return 'pdf';
    if (dataUrl.indexOf('data:image/') === 0) return 'image';
    return pc.drawingKind || 'image';
  }
  function pcProjectValue() {
    if (pc.project === 'Other') return (pc.projectOther || '').trim() || 'Other';
    return pc.project || 'Other';
  }
  function pcRecentTo() {
    var a = lsGet(PC_TO_KEY, []);
    return Array.isArray(a) ? a.filter(Boolean).slice(0, 5) : [];
  }
  function pcRememberTo(email) {
    email = String(email || '').trim();
    if (!email || email.indexOf('@') < 0) return;
    var a = pcRecentTo().filter(function (x) { return x.toLowerCase() !== email.toLowerCase(); });
    a.unshift(email);
    lsSet(PC_TO_KEY, a.slice(0, 5));
  }
  function pcSerializePin(pin) {
    if (!pin) return null;
    var o = { x: pin.x, y: pin.y };
    if (pin.page >= 1) o.page = pin.page;
    return o;
  }
  function pcSerializeAnnot(a) {
    var o = { id: a.id, type: 'text', x: a.x, y: a.y, page: a.page || 1, text: String(a.text || '').slice(0, 2000) };
    if (a.refItem >= 1) o.refItem = a.refItem;
    return o;
  }
  function pcDropHeavyDrawing(row) {
    row.drawing = '';
    row.drawingKind = '';
    pc.drawing = '';
    pc.drawingKind = '';
    pcReleasePdf();
  }
  function pcAutosave() {
    pcEnsureItems();
    pcEnsureAnnots();
    pcReadDomMeta();
    var kind = pc.drawingKind || pcInferKind(pc.drawing);
    var store = pcLoadStore();
    var row = {
      id: pc.id || pcUid(),
      title: (pc.title || pcDefaultTitle()).slice(0, 160),
      project: pcProjectValue().slice(0, 80),
      to: String(pc.to || '').trim().slice(0, 120),
      items: pc.items.map(function (it) {
        return { text: String(it.text || '').slice(0, 2000), pin: pcSerializePin(it.pin) };
      }),
      annots: pc.annots.map(pcSerializeAnnot),
      drawing: pc.drawing || '',
      drawingKind: kind || '',
      page: pc.page || 1,
      updated: Date.now()
    };
    pc.id = row.id;
    var found = false;
    for (var i = 0; i < store.list.length; i++) {
      if (store.list[i].id === row.id) { store.list[i] = row; found = true; break; }
    }
    if (!found) store.list.unshift(row);
    store.list.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    if (!pcSaveStore(store)) {
      if (row.drawing) {
        pcDropHeavyDrawing(row);
        for (var j = 0; j < store.list.length; j++) if (store.list[j].id === row.id) store.list[j] = row;
        if (!pcSaveStore(store)) { pc.flash = 'Could not save on this phone (storage full or blocked).'; pc.flashBad = true; return false; }
        pc.flash = 'Saved without plan file \u2014 phone storage was low.'; pc.flashBad = true;
        return true;
      }
      pc.flash = 'Could not save on this phone (storage full or blocked).'; pc.flashBad = true;
      return false;
    }
    if (pc.to) pcRememberTo(pc.to);
    return true;
  }
  function pcReadDomMeta() {
    var t = $('pc-title-in'); if (t) pc.title = t.value;
    var to = $('pc-to'); if (to) pc.to = to.value;
    var oth = $('pc-project-other'); if (oth) pc.projectOther = oth.value;
    document.querySelectorAll('[data-pc-item]').forEach(function (ta) {
      var n = parseInt(ta.getAttribute('data-pc-item'), 10);
      if (!n) return;
      while (pc.items.length < n) pc.items.push({ text: '', pin: null });
      pc.items[n - 1] = pcNormItem({ text: ta.value, pin: (pc.items[n - 1] && pc.items[n - 1].pin) || null });
    });
    document.querySelectorAll('[data-pc-annot-text]').forEach(function (ta) {
      var id = ta.getAttribute('data-pc-annot-text');
      var a = pcFindAnnot(id);
      if (a) a.text = String(ta.value || '').slice(0, 2000);
    });
  }
  function pcFindAnnot(id) {
    pcEnsureAnnots();
    for (var i = 0; i < pc.annots.length; i++) if (pc.annots[i].id === id) return pc.annots[i];
    return null;
  }
  function pcFlash(msg, bad) {
    pc.flash = msg || ''; pc.flashBad = !!bad;
    var el = $('pc-flash');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = msg; el.className = 'noteflash show' + (bad ? ' bad' : '');
  }
  function pcParseSpokenNum(tok) {
    tok = String(tok || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!tok) return 0;
    if (/^\d+$/.test(tok)) { var n = parseInt(tok, 10); return n >= 1 && n <= 99 ? n : 0; }
    return PC_WORDS[tok] || 0;
  }
  function pcVoiceCmd(raw) {
    var t = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!t) return false;
    var low = t.toLowerCase().replace(/[.,!?]+$/g, '').trim();
    if (/^(next item|next one|next|done)$/.test(low)) {
      pcEnsureItems();
      var cur = pc.items[pc.cur - 1];
      if (!cur) pc.items[pc.cur - 1] = { text: '', pin: null };
      pc.cur = pc.cur + 1;
      pcEnsureItems();
      pc.mic.target = 'item';
      pcAutosave(); pcRenderEditor(true);
      return true;
    }
    if (/^(jump to previous|previous item|previous|go back|last item)$/.test(low)) {
      pc.cur = Math.max(1, pc.cur - 1);
      pc.mic.target = 'item';
      pcAutosave(); pcRenderEditor(true);
      return true;
    }
    var jm = low.match(/^(?:jump to|go to|item|number)\s+([a-z0-9]+)$/);
    if (jm) {
      var n = pcParseSpokenNum(jm[1]);
      if (n) {
        pc.cur = n; pcEnsureItems(); pc.mic.target = 'item'; pcAutosave(); pcRenderEditor(true);
        return true;
      }
    }
    var parts = low.split(/\s+/);
    var lead = pcParseSpokenNum(parts[0]);
    if (lead && parts.length >= 1) {
      var rawParts = t.split(/\s+/);
      var desc = rawParts.slice(1).join(' ').trim();
      pc.cur = lead; pcEnsureItems(); pc.mic.target = 'item';
      if (desc) pc.items[pc.cur - 1].text = desc;
      else if (!pc.items[pc.cur - 1].text) pc.items[pc.cur - 1].text = '';
      pcAutosave(); pcRenderEditor(true);
      return true;
    }
    return false;
  }
  function pcApplySpeech(finalText, interim) {
    if (pc.mic.target === 'annot' && pc.annotCur) {
      var an = pcFindAnnot(pc.annotCur);
      if (an) {
        if (finalText) {
          var baseA = String(an.text || '').replace(/\s+$/, '');
          var addA = finalText.trim();
          an.text = (baseA ? micSpace(baseA + ' ', addA) : addA).slice(0, 2000);
          pc.mic.interim = '';
          pcAutosave();
          pcPaintAnnotText(an.id, an.text, '');
          pcPaintMicStatus();
          return;
        }
        pc.mic.interim = interim || '';
        pcPaintAnnotText(an.id, an.text || '', pc.mic.interim);
        pcPaintMicStatus();
        return;
      }
    }
    if (finalText) {
      if (pcVoiceCmd(finalText)) { pc.mic.interim = ''; return; }
      pcEnsureItems();
      var it = pc.items[pc.cur - 1];
      var base = String(it.text || '').replace(/\s+$/, '');
      var add = finalText.trim();
      it.text = (base ? micSpace(base + ' ', add) : add).slice(0, 2000);
      pc.mic.interim = '';
      pcAutosave();
      pcPaintItemText(pc.cur, it.text, '');
      pcPaintMicStatus();
      return;
    }
    pc.mic.interim = interim || '';
    pcEnsureItems();
    var cur = pc.items[pc.cur - 1];
    pcPaintItemText(pc.cur, cur.text || '', pc.mic.interim);
    pcPaintMicStatus();
  }
  function pcPaintItemText(n, text, interim) {
    var show = text || '';
    if (interim) show = (show ? micSpace(show.replace(/\s+$/, '') + ' ', interim) : interim);
    document.querySelectorAll('[data-pc-item="' + n + '"]').forEach(function (ta) {
      if (document.activeElement !== ta) ta.value = show;
      else if (!interim) ta.value = text || '';
    });
  }
  function pcPaintAnnotText(id, text, interim) {
    var show = text || '';
    if (interim) show = (show ? micSpace(show.replace(/\s+$/, '') + ' ', interim) : interim);
    document.querySelectorAll('[data-pc-annot-text="' + id + '"]').forEach(function (ta) {
      if (document.activeElement !== ta) ta.value = show;
      else if (!interim) ta.value = text || '';
    });
    document.querySelectorAll('.pcannot[data-id="' + id + '"] .pcannotbody').forEach(function (preview) {
      if (document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-pc-annot-text') === id) return;
      preview.textContent = (text || '').trim() || 'Note\u2026';
    });
  }
  function pcPaintMicStatus() {
    var btn = $('pc-mic'); if (btn) {
      btn.classList.toggle('rec', !!pc.mic.on);
      btn.setAttribute('aria-pressed', pc.mic.on ? 'true' : 'false');
    }
    var lbl = $('pc-mic-lbl'); if (lbl) lbl.textContent = pc.mic.on ? 'Listening\u2026 tap to stop' : 'Tap to talk';
    var st = $('pc-mic-state');
    if (st) {
      st.className = 'micstate' + (pc.mic.on ? ' rec' : '') + (pc.mic.msg && !pc.mic.on ? ' warn' : '');
      if (pc.mic.on) {
        if (pc.mic.target === 'annot' && pc.annotCur) st.textContent = 'Text note \u00b7 Listening\u2026';
        else st.textContent = 'Item ' + pc.cur + ' \u00b7 Listening\u2026 \u00b7 Say next item when done';
      } else {
        st.textContent = pc.mic.msg || (
          pc.mic.target === 'annot' && pc.annotCur
            ? 'Text note \u00b7 Tap mic to dictate'
            : ('Item ' + pc.cur + ' \u00b7 Tap mic to dictate')
        );
      }
    }
  }
  function pcMicStop(quiet) {
    var r = pc.mic.rec;
    pc.mic.on = false;
    if (quiet) { pc.mic.rec = null; try { r && r.abort(); } catch (e) {} pcPaintMicStatus(); return; }
    pc.mic.rec = null;
    if (r) { try { r.stop(); } catch (e2) {} }
    pcPaintMicStatus();
  }
  function pcMicStart() {
    if (!SR) { pc.mic.msg = MIC_NA; pcPaintMicStatus(); return; }
    pcMicStop(true);
    pc.mic.msg = ''; pc.mic.interim = '';
    var rec; try { rec = new SR(); } catch (e) { pc.mic.msg = MIC_NA; pcPaintMicStatus(); return; }
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'; rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var interim = '', finals = [];
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var r = ev.results[i], t = r[0] ? r[0].transcript : '';
        if (r.isFinal) finals.push(t.trim()); else interim += t;
      }
      if (finals.length) {
        finals.forEach(function (f) { if (f) pcApplySpeech(f, ''); });
      } else {
        pcApplySpeech('', interim.replace(/^\s+/, ''));
      }
    };
    rec.onerror = function (ev) {
      var e = ev && ev.error;
      if (e === 'not-allowed' || e === 'service-not-allowed' || e === 'audio-capture' || e === 'language-not-supported') {
        pc.mic.msg = MIC_NA; pc.mic.on = false; pc.mic.rec = null; pcPaintMicStatus(); return;
      }
      if (e === 'network') {
        pc.mic.msg = 'The speech service couldn\u2019t be reached. Tap a row and use your keyboard\u2019s mic key.';
        pc.mic.on = false; pc.mic.rec = null; pcPaintMicStatus(); return;
      }
      if (e === 'no-speech') pc.mic.msg = 'Didn\u2019t catch anything. Tap the mic and try again.';
    };
    rec.onend = function () {
      if (pc.mic.rec !== rec) return;
      if (pc.mic.on) {
        try { rec.start(); return; } catch (e3) { /* fall through */ }
      }
      pc.mic.rec = null; pc.mic.on = false; pcPaintMicStatus();
    };
    pc.mic.rec = rec; pc.mic.on = true;
    try { rec.start(); } catch (e2) { pc.mic.msg = MIC_NA; pc.mic.on = false; pc.mic.rec = null; }
    pcPaintMicStatus();
  }

  function pcShrinkImage(fileOrBlob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(fileOrBlob), im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        var W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
        if (!W || !H) return rej(new Error('That image could not be read.'));
        var tries = [[1600, 0.8], [1600, 0.7], [1400, 0.65], [1200, 0.6], [1000, 0.55], [800, 0.5], [640, 0.45]];
        var out = null;
        for (var i = 0; i < tries.length; i++) {
          var sc = Math.min(1, tries[i][0] / Math.max(W, H)), cw = Math.max(1, Math.round(W * sc)), ch = Math.max(1, Math.round(H * sc));
          var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch); cx.drawImage(im, 0, 0, cw, ch);
          var data = cv.toDataURL('image/jpeg', tries[i][1]); cv.width = cv.height = 0;
          if (data.indexOf('data:image/jpeg') !== 0) return rej(new Error('This browser could not compress the plan image.'));
          out = data;
          if (data.length <= PC_DRAW_MAX) break;
        }
        if (!out || out.length > PC_DRAW_MAX * 1.35) return rej(new Error('Plan image is still too large after shrinking. Try a simpler photo or crop.'));
        res(out);
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image.')); };
      im.src = url;
    });
  }
  function pcFileToDataUrl(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        if (s.indexOf('data:') !== 0) return rej(new Error('Could not read that file.'));
        res(s);
      };
      fr.onerror = function () { rej(new Error('Could not read that file.')); };
      fr.readAsDataURL(file);
    });
  }
  function pcDataUrlToBytes(dataUrl) {
    var m = /^data:[^;]+;base64,(.+)$/.exec(dataUrl || '');
    if (!m) throw new Error('Invalid PDF data.');
    var bin = atob(m[1]);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  function pcReleasePdf() {
    pc.pdfToken++;
    if (pc.pdfDoc) { try { pc.pdfDoc.destroy(); } catch (e) {} }
    pc.pdfDoc = null;
    pc.pdfBusy = false;
  }
  function pcLoadPdfDoc() {
    if (pc.drawingKind !== 'pdf' || !pc.drawing) return Promise.reject(new Error('No PDF plan.'));
    if (pc.pdfDoc) return Promise.resolve(pc.pdfDoc);
    var bytes;
    try { bytes = pcDataUrlToBytes(pc.drawing); } catch (e) { return Promise.reject(e); }
    return loadPdfJs().then(function (lib) {
      return lib.getDocument({ data: bytes }).promise.then(function (pdf) {
        pc.pdfDoc = pdf;
        pc.pdfPages = pdf.numPages || 1;
        if (pc.page > pc.pdfPages) pc.page = pc.pdfPages;
        if (pc.page < 1) pc.page = 1;
        return pdf;
      });
    });
  }
  function pcActiveDrawIds() {
    if (pc.fs && $('pc-fs-stage')) {
      return { stage: 'pc-fs-stage', img: 'pc-fs-img', pins: 'pc-fs-pins', meta: 'pc-fs-page-meta' };
    }
    return { stage: 'pc-draw-stage', img: 'pc-draw-img', pins: 'pc-pins', meta: 'pc-page-meta' };
  }
  function pcRenderPdfIntoStage() {
    var ids = pcActiveDrawIds();
    var stageImg = $(ids.img);
    var stage = $(ids.stage);
    if (!stageImg || !stage || pc.drawingKind !== 'pdf') return;
    var token = ++pc.pdfToken;
    pc.pdfBusy = true;
    stageImg.alt = 'Loading PDF page ' + pc.page + '\u2026';
    stage.classList.add('pdfloading');
    pcLoadPdfDoc().then(function (pdf) {
      if (token !== pc.pdfToken) return;
      return pdf.getPage(pc.page).then(function (page) {
        if (token !== pc.pdfToken) return;
        var vp1 = page.getViewport({ scale: 1 });
        var viewEl = $('pc-fs-view') || stage;
        var w = (viewEl && viewEl.clientWidth) || stage.clientWidth || 360;
        var target = Math.min(2200, Math.max(900, w * Math.min(window.devicePixelRatio || 1, 2.5)));
        var vp = page.getViewport({ scale: target / vp1.width });
        var cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
          if (token !== pc.pdfToken) { page.cleanup(); return; }
          var url = cv.toDataURL('image/jpeg', 0.9);
          cv.width = cv.height = 0;
          page.cleanup();
          stageImg.src = url;
          stageImg.alt = 'Plan PDF page ' + pc.page;
          stage.classList.remove('pdfloading');
          pc.pdfBusy = false;
          pcPaintOverlays();
          document.querySelectorAll('#pc-page-meta, #pc-fs-page-meta').forEach(function (meta) {
            meta.textContent = 'Page ' + pc.page + ' of ' + pc.pdfPages;
          });
          document.querySelectorAll('[data-pc="page-prev"]').forEach(function (prev) { prev.disabled = pc.page <= 1; });
          document.querySelectorAll('[data-pc="page-next"]').forEach(function (next) { next.disabled = pc.page >= pc.pdfPages; });
          var nav = $('pc-page-nav');
          if (!nav && !pc.fs && pc.pdfPages > 1) {
            var head = document.querySelector('.pcdrawhead');
            if (head) head.insertAdjacentHTML('beforeend', pcPageNavHtml());
          }
          if (pc.fs) pcApplyZoomPan();
        });
      });
    }).catch(function (err) {
      if (token !== pc.pdfToken) return;
      pc.pdfBusy = false;
      stage.classList.remove('pdfloading');
      pcFlash((err && err.message) || 'Could not render the PDF page.', true);
    });
  }
  /** Flatten PDF page 1 to jpeg \u2014 fallback when PDF is too large for storage. */
  function pcPdfFirstPage(file) {
    return file.arrayBuffer().then(function (buf) {
      return loadPdfJs().then(function (lib) {
        return lib.getDocument({ data: new Uint8Array(buf) }).promise.then(function (pdf) {
          return pdf.getPage(1).then(function (page) {
            var vp1 = page.getViewport({ scale: 1 });
            var target = Math.min(1600, Math.max(900, vp1.width));
            var vp = page.getViewport({ scale: target / vp1.width });
            var cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
            var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
            return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
              return new Promise(function (res, rej) {
                cv.toBlob(function (blob) {
                  page.cleanup(); pdf.destroy();
                  cv.width = cv.height = 0;
                  if (!blob) return rej(new Error('Could not render the PDF page.'));
                  pcShrinkImage(blob).then(res, rej);
                }, 'image/jpeg', 0.82);
              });
            });
          });
        });
      });
    });
  }
  function pcAttachDrawing(file) {
    if (!file || pc.drawBusy) return;
    var mime = String(file.type || '').toLowerCase();
    var name = String(file.name || '').toLowerCase();
    var isPdf = mime === 'application/pdf' || /\.pdf$/.test(name);
    var isImg = /^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(mime) || /\.(jpe?g|png|webp)$/.test(name);
    if (!isPdf && !isImg) {
      pcFlash('Use a JPG, PNG, or PDF.', true);
      return;
    }
    pc.drawBusy = true;
    if (isPdf) {
      pcFlash('Loading PDF plan\u2026', false);
      pcFileToDataUrl(file).then(function (dataUrl) {
        if (dataUrl.length > PC_PDF_MAX) {
          pcFlash('PDF is large \u2014 flattening page 1 as an image for phone storage\u2026', false);
          return pcPdfFirstPage(file).then(function (imgUrl) {
            return { kind: 'image', data: imgUrl, note: 'PDF was too large to keep as PDF; page 1 saved as image.' };
          });
        }
        return loadPdfJs().then(function (lib) {
          var bytes = pcDataUrlToBytes(dataUrl);
          return lib.getDocument({ data: bytes }).promise.then(function (pdf) {
            var pages = pdf.numPages || 1;
            pdf.destroy();
            return { kind: 'pdf', data: dataUrl, pages: pages, note: 'PDF attached (' + pages + ' page' + (pages === 1 ? '' : 's') + ').' };
          });
        });
      }).then(function (info) {
        pc.drawBusy = false;
        pcReleasePdf();
        pc.drawing = info.data;
        pc.drawingKind = info.kind;
        pc.page = 1;
        pc.pdfPages = info.pages || 1;
        pc.mode = 'view';
        pc.annotCur = '';
        // Clear pins/notes that belonged to a previous plan
        pc.items.forEach(function (it) { it.pin = null; });
        pc.annots = [];
        pcAutosave();
        pcRenderEditor(true);
        pcFlash(info.note || 'Plan attached.', info.kind === 'image' && /too large/.test(info.note || '') );
        setTimeout(function () { pcEnterFs(); }, 30);
      }, function (err) {
        pc.drawBusy = false;
        pcFlash((err && err.message) || 'Could not prepare that plan file.', true);
      });
      return;
    }
    pcFlash('Preparing plan image\u2026', false);
    pcShrinkImage(file).then(function (dataUrl) {
      pc.drawBusy = false;
      pcReleasePdf();
      pc.drawing = dataUrl;
      pc.drawingKind = 'image';
      pc.page = 1;
      pc.pdfPages = 1;
      pc.mode = 'view';
      pc.annotCur = '';
      pc.items.forEach(function (it) { it.pin = null; });
      pc.annots = [];
      pcAutosave();
      pcRenderEditor(true);
      pcFlash('Plan image attached.', false);
      setTimeout(function () { pcEnterFs(); }, 30);
    }, function (err) {
      pc.drawBusy = false;
      pcFlash((err && err.message) || 'Could not prepare that plan file.', true);
    });
  }

  function pcOpen() {
    pcMicStop(true);
    if (pc.fs) pcExitFs({ silent: true });
    var r = state.pcRoute || { kind: 'list', id: '' };
    var back = $('pc-back'), title = $('pc-title');
    if (r.kind === 'list') {
      if (back) back.setAttribute('data-go', 'projects');
      if (title) title.textContent = 'Plan Checks';
      pcReleasePdf();
      pcRenderList();
      return;
    }
    if (back) back.setAttribute('data-go', 'pc');
    if (r.kind === 'new') {
      pcReleasePdf();
      pc.id = pcUid();
      pc.title = pcDefaultTitle();
      pc.project = 'Terra Vi'; pc.projectOther = '';
      pc.to = (pcRecentTo()[0] || '');
      pc.items = [{ text: '', pin: null }];
      pc.annots = [];
      pc.cur = 1; pc.annotCur = '';
      pc.drawing = ''; pc.drawingKind = '';
      pc.page = 1; pc.pdfPages = 1;
      pc.mode = 'view';
      if (title) title.textContent = 'New checklist';
      pcAutosave();
      state.pcRoute = { kind: 'edit', id: pc.id };
      if (location.hash !== '#pc/' + encodeURIComponent(pc.id)) {
        try { history.replaceState({ screen: 'pc' }, '', '#pc/' + encodeURIComponent(pc.id)); } catch (e) {}
      }
      pcRenderEditor(false);
      return;
    }
    var row = pcFind(r.id);
    if (!row) {
      if (title) title.textContent = 'Plan Checks';
      pcFlash('That checklist was not found.', true);
      state.pcRoute = { kind: 'list', id: '' };
      pcRenderList();
      return;
    }
    pcReleasePdf();
    pc.id = row.id;
    pc.title = row.title || pcDefaultTitle();
    var projMatch = PC_PROJECTS.indexOf(row.project) >= 0 && row.project !== 'Other';
    if (projMatch) { pc.project = row.project; pc.projectOther = ''; }
    else { pc.project = 'Other'; pc.projectOther = row.project === 'Other' ? '' : (row.project || ''); }
    pc.to = row.to || '';
    pc.items = (row.items && row.items.length) ? row.items.map(pcNormItem) : [{ text: '', pin: null }];
    pc.annots = Array.isArray(row.annots) ? row.annots.map(pcNormAnnot).filter(Boolean) : [];
    pc.drawing = row.drawing || '';
    pc.drawingKind = row.drawingKind || pcInferKind(pc.drawing);
    pc.page = Math.max(1, parseInt(row.page, 10) || 1);
    pc.pdfPages = pc.drawingKind === 'pdf' ? Math.max(1, pc.page) : 1;
    pc.cur = 1; pc.annotCur = ''; pc.mode = 'view';
    if (title) title.textContent = 'Checklist';
    pcRenderEditor(false);
  }

  function pcFmtDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function pcRenderList() {
    if (!pcOnScreen()) return;
    pcMicStop(true);
    var list = pcLoadStore().list.slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    var rows = list.map(function (row) {
      var n = (row.items || []).filter(function (it) {
        var t = typeof it === 'string' ? it : (it && it.text);
        return String(t || '').trim();
      }).length;
      var pins = (row.items || []).filter(function (it) { return it && it.pin; }).length;
      var notes = Array.isArray(row.annots) ? row.annots.length : 0;
      var plan = row.drawing ? (row.drawingKind === 'pdf' || (row.drawing || '').indexOf('data:application/pdf') === 0 ? 'PDF' : 'plan') : '';
      return '<button type="button" class="pclist" data-go="pc/' + esc(encodeURIComponent(row.id)) + '">' +
        '<div class="pcl1"><b>' + esc(row.title || 'Untitled') + '</b></div>' +
        '<div class="pcl2">' + esc(row.project || '\u2014') + ' \u00b7 ' + n + ' item' + (n === 1 ? '' : 's') +
        (pins ? ' \u00b7 ' + pins + ' pin' + (pins === 1 ? '' : 's') : '') +
        (notes ? ' \u00b7 ' + notes + ' note' + (notes === 1 ? '' : 's') : '') +
        (plan ? ' \u00b7 ' + plan : '') +
        ' \u00b7 ' + esc(pcFmtDate(row.updated)) + '</div></button>';
    }).join('');
    var h = '<div class="pc">' +
      '<button type="button" class="bigsave" data-pc="new">+ New checklist</button>' +
      (rows || '<div class="card"><div class="foot empty">No checklists yet. Tap New checklist, dictate numbered items, and pin or note them on a plan PDF/image.</div></div>') +
      '<div class="foot pcfoot">Saved on this phone only (<code>cc_pc_checklists</code>). Drive folder for later storage: ' +
      '<a href="' + PC_DRIVE + '" data-external target="_blank" rel="noopener">Plan Checks</a>.</div></div>';
    $('pc-body').innerHTML = h;
  }

  function pcPinOnPage(pin) {
    if (!pin) return false;
    var pg = pin.page >= 1 ? pin.page : 1;
    return pg === (pc.page || 1);
  }
  function pcAnnotOnPage(a) {
    if (!a) return false;
    return (a.page >= 1 ? a.page : 1) === (pc.page || 1);
  }
  function pcPinsHtml() {
    return pc.items.map(function (it, i) {
      if (!it.pin || !pcPinOnPage(it.pin)) return '';
      var n = i + 1, on = n === pc.cur;
      return '<button type="button" class="pcpin' + (on ? ' on' : '') + '" data-pc="pin-sel" data-n="' + n + '" style="left:' + it.pin.x + '%;top:' + it.pin.y + '%" aria-label="Item ' + n + '">' + n + '</button>';
    }).join('');
  }
  function pcAnnotsHtml() {
    pcEnsureAnnots();
    return pc.annots.map(function (a) {
      if (!pcAnnotOnPage(a)) return '';
      var on = a.id === pc.annotCur;
      var ref = a.refItem >= 1 ? '<span class="pcannotref">#' + a.refItem + '</span>' : '';
      var body = esc((a.text || '').trim() || 'Note\u2026');
      return '<div class="pcannot' + (on ? ' on' : '') + '" data-pc="annot-sel" data-id="' + esc(a.id) + '" style="left:' + a.x + '%;top:' + a.y + '%" role="button" tabindex="0">' +
        ref + '<div class="pcannotbody">' + body + '</div></div>';
    }).join('');
  }
  function pcPaintOverlays() {
    var html = pcPinsHtml() + pcAnnotsHtml();
    var pins = $('pc-pins'); if (pins) pins.innerHTML = html;
    var fsPins = $('pc-fs-pins'); if (fsPins) fsPins.innerHTML = html;
    if (pc.fs) {
      pcPaintFsChrome();
      pcPaintFsDock();
    }
  }
  function pcItemsHtml() {
    pcEnsureItems();
    return pc.items.map(function (it, i) {
      var n = i + 1, on = n === pc.cur;
      var pinMark = it.pin ? '<span class="pcpinmark" title="Pinned on plan">&#128205;</span>' : '';
      return '<div class="pcitem' + (on ? ' on' : '') + '" data-pc-row="' + n + '">' +
        '<button type="button" class="pcnum" data-pc="sel" data-n="' + n + '" aria-label="Select item ' + n + '">' + n + '</button>' +
        '<textarea class="notebox pcitemta" data-pc-item="' + n + '" rows="2" maxlength="2000" placeholder="Item ' + n + '\u2026">' + esc(it.text || '') + '</textarea>' +
        pinMark + '</div>';
    }).join('');
  }
  function pcProjectChips() {
    return PC_PROJECTS.map(function (p) {
      var on = pc.project === p;
      return '<button type="button" class="vchip' + (on ? ' on' : '') + '" data-pc="proj" data-p="' + esc(p) + '" aria-pressed="' + on + '">' + esc(p) + '</button>';
    }).join('');
  }
  function pcRecentToHtml() {
    var a = pcRecentTo();
    if (!a.length) return '';
    return '<div class="pcrecentto"><span class="pclbl">Recent:</span> ' + a.map(function (e) {
      return '<button type="button" class="navbtn pcmini" data-pc="to-pick" data-e="' + esc(e) + '">' + esc(e) + '</button>';
    }).join('') + '</div>';
  }
  function pcModeBtn(mode, label) {
    var on = pc.mode === mode;
    return '<button type="button" class="navbtn' + (on ? ' on' : '') + '" data-pc="mode" data-mode="' + mode + '" aria-pressed="' + on + '">' + label + '</button>';
  }
  function pcPageNavHtml() {
    if (pc.drawingKind !== 'pdf') return '';
    var pages = Math.max(1, pc.pdfPages || 1);
    return '<div class="pcpagenav" id="pc-page-nav">' +
      '<button type="button" class="navbtn pcmini" data-pc="page-prev"' + (pc.page <= 1 ? ' disabled' : '') + '>&lsaquo; Prev</button>' +
      '<span class="pcpagemeta" id="pc-page-meta">Page ' + pc.page + ' of ' + pages + '</span>' +
      '<button type="button" class="navbtn pcmini" data-pc="page-next"' + (pc.page >= pages ? ' disabled' : '') + '>Next &rsaquo;</button>' +
      '</div>';
  }
  function pcAnnotEditorHtml() {
    var a = pc.annotCur ? pcFindAnnot(pc.annotCur) : null;
    if (!a) return '';
    var opts = '<option value="">\u2014 none \u2014</option>' + pc.items.map(function (it, i) {
      var n = i + 1;
      var lab = n + (String(it.text || '').trim() ? '. ' + String(it.text).trim().slice(0, 40) : '');
      return '<option value="' + n + '"' + (a.refItem === n ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
    return '<div class="pcannotedit card" id="pc-annot-edit">' +
      '<div class="pclbl">Text note' + (a.refItem >= 1 ? ' \u00b7 linked to #' + a.refItem : '') + '</div>' +
      '<textarea class="notebox" data-pc-annot-text="' + esc(a.id) + '" rows="3" maxlength="2000" placeholder="Type or dictate a note\u2026">' + esc(a.text || '') + '</textarea>' +
      '<label class="pclbl" for="pc-annot-ref">Link to checklist item</label>' +
      '<select class="wlin" id="pc-annot-ref" data-pc="annot-ref">' + opts + '</select>' +
      '<div class="draftbtns" style="margin-top:8px">' +
      '<button type="button" class="navbtn" data-pc="annot-mic">Dictate note</button>' +
      '<button type="button" class="navbtn discard" data-pc="annot-del">Delete note</button>' +
      '<button type="button" class="navbtn" data-pc="annot-done">Done</button>' +
      '</div></div>';
  }
  function pcClampZoom(z) {
    z = Number(z);
    if (!isFinite(z)) return 1;
    return Math.max(0.4, Math.min(8, Math.round(z * 100) / 100));
  }
  function pcApplyZoomPan() {
    var world = $('pc-fs-world'); if (!world) return;
    world.style.transform = 'translate(' + (pc.panX || 0) + 'px,' + (pc.panY || 0) + 'px) scale(' + (pc.zoom || 1) + ')';
    var zl = $('pc-fs-zoom-lbl');
    if (zl) zl.textContent = Math.round((pc.zoom || 1) * 100) + '%';
  }
  function pcZoomBy(factor, cx, cy) {
    var view = $('pc-fs-view'); if (!view) return;
    var rect = view.getBoundingClientRect();
    var mx = (cx != null ? cx : rect.left + rect.width / 2) - rect.left;
    var my = (cy != null ? cy : rect.top + rect.height / 2) - rect.top;
    var oldZ = pc.zoom || 1;
    var newZ = pcClampZoom(oldZ * factor);
    if (newZ === oldZ) return;
    // Keep the point under the cursor/fingers stable
    var wx = (mx - (pc.panX || 0)) / oldZ;
    var wy = (my - (pc.panY || 0)) / oldZ;
    pc.zoom = newZ;
    pc.panX = mx - wx * newZ;
    pc.panY = my - wy * newZ;
    pcApplyZoomPan();
  }
  function pcZoomFit() {
    pc.zoom = 1; pc.panX = 0; pc.panY = 0;
    pcApplyZoomPan();
  }
  function pcPaintFsChrome() {
    if (!pc.fs) return;
    var wrap = $('pc-fs'); if (!wrap) return;
    wrap.classList.toggle('placing-pin', pc.mode === 'pin');
    wrap.classList.toggle('placing-text', pc.mode === 'text');
    wrap.querySelectorAll('[data-pc="mode"]').forEach(function (btn) {
      var m = btn.getAttribute('data-mode');
      var on = pc.mode === m;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (m === 'pin') btn.textContent = on ? ('Pin #' + pc.cur + '\u2026') : ('Pin #' + pc.cur);
      if (m === 'text') btn.textContent = on ? 'Text\u2026' : 'Text box';
      if (m === 'view') btn.textContent = 'Select';
    });
    var meta = $('pc-fs-page-meta');
    if (meta) meta.textContent = pc.drawingKind === 'pdf'
      ? ('Page ' + pc.page + ' of ' + Math.max(1, pc.pdfPages || 1))
      : 'Image';
    document.querySelectorAll('#pc-fs [data-pc="page-prev"]').forEach(function (b) {
      b.disabled = pc.drawingKind !== 'pdf' || pc.page <= 1;
      b.hidden = pc.drawingKind !== 'pdf';
    });
    document.querySelectorAll('#pc-fs [data-pc="page-next"]').forEach(function (b) {
      b.disabled = pc.drawingKind !== 'pdf' || pc.page >= Math.max(1, pc.pdfPages || 1);
      b.hidden = pc.drawingKind !== 'pdf';
    });
    var pnav = $('pc-fs-pagenav'); if (pnav) pnav.hidden = pc.drawingKind !== 'pdf';
    var clr = document.querySelector('#pc-fs [data-pc="pin-clear"]');
    if (clr) clr.disabled = !(pc.items[pc.cur - 1] && pc.items[pc.cur - 1].pin);
  }
  function pcFsAnnotEditorHtml() {
    var a = pc.annotCur ? pcFindAnnot(pc.annotCur) : null;
    if (!a) return '';
    var opts = '<option value="">\u2014 none \u2014</option>' + pc.items.map(function (it, i) {
      var n = i + 1;
      var lab = n + (String(it.text || '').trim() ? '. ' + String(it.text).trim().slice(0, 36) : '');
      return '<option value="' + n + '"' + (a.refItem === n ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
    return '<div class="pcfs-annot">' +
      '<div class="pcfs-docklbl">Text note' + (a.refItem >= 1 ? ' \u00b7 #' + a.refItem : '') + '</div>' +
      '<textarea class="notebox pcfs-ta" data-pc-annot-text="' + esc(a.id) + '" rows="3" maxlength="2000" placeholder="Note on plan\u2026">' + esc(a.text || '') + '</textarea>' +
      '<div class="pcfs-annotrow">' +
      '<select class="wlin pcfs-sel" id="pc-annot-ref" data-pc="annot-ref">' + opts + '</select>' +
      '<button type="button" class="navbtn pcmini" data-pc="annot-mic">Mic</button>' +
      '<button type="button" class="navbtn pcmini discard" data-pc="annot-del">Del</button>' +
      '<button type="button" class="navbtn pcmini" data-pc="annot-done">OK</button>' +
      '</div></div>';
  }
  function pcPaintFsDock() {
    var dock = $('pc-fs-dock'); if (!dock) return;
    pcEnsureItems();
    var it = pc.items[pc.cur - 1] || { text: '', pin: null };
    var tip = pc.mode === 'pin'
      ? 'Tap the plan to place pin #' + pc.cur
      : (pc.mode === 'text' ? 'Tap the plan to place a text box' : 'Pinch / wheel to zoom \u00b7 drag to pan');
    dock.innerHTML =
      '<div class="pcfs-itemrow">' +
      '<button type="button" class="pcnum" data-pc="fs-prev-item" aria-label="Previous item">&lsaquo;</button>' +
      '<div class="pcfs-itemmain">' +
      '<div class="pcfs-docklbl">Item ' + pc.cur + (it.pin ? ' \u00b7 pinned' : '') + '</div>' +
      '<textarea class="notebox pcfs-ta" data-pc-item="' + pc.cur + '" rows="2" maxlength="2000" placeholder="Checklist note for item ' + pc.cur + '\u2026">' + esc(it.text || '') + '</textarea>' +
      '<div class="pcfs-annotrow" style="margin-top:6px">' +
      '<button type="button" class="navbtn pcmini" data-pc="fs-item-mic">' + (pc.mic.on && pc.mic.target === 'item' ? 'Listening\u2026' : 'Dictate item') + '</button>' +
      '</div></div>' +
      '<button type="button" class="pcnum" data-pc="fs-next-item" aria-label="Next item">&rsaquo;</button>' +
      '</div>' +
      pcFsAnnotEditorHtml() +
      '<div class="pcfs-tip">' + tip + '</div>';
  }
  function pcFsHtml() {
    var modeClass = pc.mode === 'pin' ? ' placing-pin' : (pc.mode === 'text' ? ' placing-text' : '');
    var imgSrc = pc.drawingKind === 'pdf'
      ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
      : (pc.drawing || '');
    return '<div id="pc-fs" class="pcfs' + modeClass + '" role="dialog" aria-label="Plan fullscreen">' +
      '<div class="pcfs-top">' +
      '<button type="button" class="navbtn pcfs-done" data-pc="fs-done">Done</button>' +
      '<div class="pcfs-pagenav" id="pc-fs-pagenav"' + (pc.drawingKind !== 'pdf' ? ' hidden' : '') + '>' +
      '<button type="button" class="navbtn pcmini" data-pc="page-prev"' + (pc.page <= 1 ? ' disabled' : '') + '>&lsaquo;</button>' +
      '<span class="pcpagemeta" id="pc-fs-page-meta">Page ' + pc.page + ' of ' + Math.max(1, pc.pdfPages || 1) + '</span>' +
      '<button type="button" class="navbtn pcmini" data-pc="page-next"' + (pc.page >= Math.max(1, pc.pdfPages || 1) ? ' disabled' : '') + '>&rsaquo;</button>' +
      '</div>' +
      '<div class="pcfs-zoom">' +
      '<button type="button" class="navbtn pcmini" data-pc="zoom-out" aria-label="Zoom out">\u2212</button>' +
      '<button type="button" class="navbtn pcmini" data-pc="zoom-fit" id="pc-fs-zoom-lbl">' + Math.round((pc.zoom || 1) * 100) + '%</button>' +
      '<button type="button" class="navbtn pcmini" data-pc="zoom-in" aria-label="Zoom in">+</button>' +
      '</div></div>' +
      '<div class="pcfs-tools" role="toolbar" aria-label="Plan tools">' +
      pcModeBtn('view', 'Select') +
      pcModeBtn('pin', 'Pin #' + pc.cur) +
      pcModeBtn('text', 'Text box') +
      '<button type="button" class="navbtn pcmini" data-pc="pin-clear"' + (pc.items[pc.cur - 1] && pc.items[pc.cur - 1].pin ? '' : ' disabled') + '>Clear pin</button>' +
      '</div>' +
      '<div class="pcfs-view" id="pc-fs-view">' +
      '<div class="pcfs-world" id="pc-fs-world">' +
      '<div class="pcdrawstage" id="pc-fs-stage" data-pc="draw-tap">' +
      '<img class="pcdrawimg" id="pc-fs-img" src="' + (imgSrc ? imgSrc : '') + '" alt="Plan drawing" draggable="false">' +
      '<div class="pcpins" id="pc-fs-pins">' + pcPinsHtml() + pcAnnotsHtml() + '</div>' +
      '</div></div></div>' +
      '<div class="pcfs-dock" id="pc-fs-dock"></div>' +
      '</div>';
  }
  function pcEnterFs(opts) {
    if (!pcHasPlan()) { pcFlash('Upload a plan first.', true); return; }
    opts = opts || {};
    pcReadDomMeta();
    pc.fs = true;
    if (!opts.keepZoom) { pc.zoom = 1; pc.panX = 0; pc.panY = 0; }
    var screen = $('screen-pc'); if (!screen) return;
    var existing = $('pc-fs'); if (existing) existing.remove();
    screen.insertAdjacentHTML('beforeend', pcFsHtml());
    document.documentElement.classList.add('pc-fs-open');
    document.body.classList.add('pc-fs-open');
    pcPaintFsDock();
    pcPaintFsChrome();
    pcApplyZoomPan();
    if (pc.drawingKind === 'pdf' && pc.drawing) pcRenderPdfIntoStage();
    else if (pc.drawingKind === 'image' && pc.drawing) {
      var img = $('pc-fs-img'); if (img) img.src = pc.drawing;
    }
  }
  function pcExitFs(opts) {
    if (!pc.fs && !$('pc-fs')) return;
    opts = opts || {};
    pcReadDomMeta();
    pc.fs = false;
    pc.mode = 'view';
    var el = $('pc-fs'); if (el) el.remove();
    document.documentElement.classList.remove('pc-fs-open');
    document.body.classList.remove('pc-fs-open');
    pcAutosave();
    if (!opts.silent && pcOnScreen() && state.pcRoute && state.pcRoute.kind !== 'list') pcRenderEditor(true);
  }
  function pcDrawBlockHtml() {
    if (!pcHasPlan()) {
      return '<div class="pcdrawempty card">' +
        '<b>Plan drawing</b><p>Upload a PDF (viewed in-app, multi-page) or a JPG/PNG of the plan. Open fullscreen to zoom, pan, and place pins or text notes on the drawing.</p>' +
        '<div class="draftbtns"><label class="bigsave" for="pc-draw-file">Upload plan (PDF or image)</label></div>' +
        '<div class="foot">PDFs stay as PDF when they fit on this phone; oversized PDFs fall back to a page-1 image. Images are resized (~1600px).</div></div>';
    }

    var modeClass = pc.mode === 'pin' ? ' placing-pin' : (pc.mode === 'text' ? ' placing-text' : '');
    var kindTag = pc.drawingKind === 'pdf' ? '<span class="pcdrawkind">PDF</span>' : '<span class="pcdrawkind">Image</span>';
    var imgSrc = pc.drawingKind === 'pdf' ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' : pc.drawing;
    var tip = pc.mode === 'pin'
      ? 'Place pin: tap the plan to drop item ' + pc.cur + '\'s numbered box on this page. Prefer Open plan fullscreen for zoom/pan.'
      : (pc.mode === 'text'
        ? 'Place text box: tap the plan to add a note. Prefer fullscreen for review.'
        : 'Open plan fullscreen to zoom, pan, and place pins or text while reviewing the drawing.');
    return '<div class="pcdrawwrap' + modeClass + '">' +
      '<div class="pcdrawhead">' + kindTag + pcPageNavHtml() + '</div>' +
      '<div class="pcdrawstage" id="pc-draw-stage" data-pc="draw-tap">' +
      '<img class="pcdrawimg" id="pc-draw-img" src="' + (imgSrc ? imgSrc : '') + '" alt="Plan drawing">' +
      '<div class="pcpins" id="pc-pins">' + pcPinsHtml() + pcAnnotsHtml() + '</div></div>' +
      '<div class="draftbtns pcdrawbtns">' +
      '<button type="button" class="bigsave" data-pc="fs-open">Open plan fullscreen</button>' +
      '</div>' +
      '<div class="draftbtns pcdrawbtns pcmodes">' +
      pcModeBtn('view', 'View') +
      pcModeBtn('pin', pc.mode === 'pin' ? 'Placing pin\u2026' : 'Place pin') +
      pcModeBtn('text', pc.mode === 'text' ? 'Placing text\u2026' : 'Place text box') +
      '</div>' +
      '<div class="draftbtns pcdrawbtns">' +
      '<button type="button" class="navbtn" data-pc="pin-clear"' + (pc.items[pc.cur - 1] && pc.items[pc.cur - 1].pin ? '' : ' disabled') + '>Remove pin</button>' +
      '<label class="navbtn" for="pc-draw-file">Replace plan</label>' +
      '<button type="button" class="navbtn discard" data-pc="draw-clear">Remove plan</button>' +
      '</div>' +
      pcAnnotEditorHtml() +
      '<div class="foot">' + tip + '</div></div>';
  }
  function pcRenderEditor(keepScroll) {
    if (!pcOnScreen()) return;
    var y = keepScroll ? window.scrollY : 0;
    pcEnsureItems();
    pcEnsureAnnots();
    var h = '<div class="pc pceditor">' +
      '<div class="noteflash' + (pc.flash ? ' show' + (pc.flashBad ? ' bad' : '') : '') + '" id="pc-flash"' + (pc.flash ? '' : ' hidden') + '>' + esc(pc.flash || '') + '</div>' +
      '<label class="pclbl" for="pc-title-in">Title</label>' +
      '<input class="wlin" id="pc-title-in" type="text" maxlength="160" value="' + esc(pc.title) + '" autocomplete="off">' +
      '<div class="pclbl">Project</div>' +
      '<div class="vchips pcprojs" role="group" aria-label="Project">' + pcProjectChips() + '</div>' +
      (pc.project === 'Other' ? '<input class="wlin" id="pc-project-other" type="text" maxlength="80" placeholder="Project name" value="' + esc(pc.projectOther) + '" autocomplete="off">' : '') +
      '<label class="pclbl" for="pc-to">To (employee email, optional)</label>' +
      '<input class="wlin" id="pc-to" type="email" maxlength="120" placeholder="name@example.com" value="' + esc(pc.to) + '" autocomplete="email">' +
      pcRecentToHtml() +
      '<div class="micstage macmic pcmic"><button type="button" class="micbtn big" id="pc-mic" data-pc="mic" aria-pressed="false" aria-label="Start dictation">' +
      '<span class="micico" aria-hidden="true">&#127908;</span><span class="miclbl" id="pc-mic-lbl">Tap to talk</span></button>' +
      '<div class="micstate" id="pc-mic-state">&nbsp;</div></div>' +
      '<div class="pchint stickyhint">Say <b>next item</b> \u00b7 <b>jump to previous</b> \u00b7 <b>jump to 3</b> \u00b7 or <b>one check hydrology</b></div>' +
      '<div class="pcitems" id="pc-items">' + pcItemsHtml() + '</div>' +
      '<div class="draftbtns">' +
      '<button type="button" class="navbtn" data-pc="add">Add item</button>' +
      '<button type="button" class="navbtn discard" data-pc="del-item">Delete item</button>' +
      '</div>' +
      '<h3 class="sechead">Plan drawing</h3>' + pcDrawBlockHtml() +
      '<input class="vfile" type="file" id="pc-draw-file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf">' +
      '<div class="draftbtns pcactions">' +
      '<button type="button" class="bigsave" data-pc="email">Email checklist</button>' +
      '<button type="button" class="navbtn discard" data-pc="delete">Delete checklist</button>' +
      '</div>' +
      '<div class="foot pcfoot">Auto-saves on this phone. Drive: <a href="' + PC_DRIVE + '" data-external target="_blank" rel="noopener">Plan Checks folder</a>.</div></div>';
    $('pc-body').innerHTML = h;
    pc.flash = ''; pc.flashBad = false;
    pcPaintMicStatus();
    if (keepScroll) setTimeout(function () { window.scrollTo(0, y); }, 0);
    var onRow = document.querySelector('#pc-items .pcitem.on');
    if (onRow && !keepScroll) try { onRow.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    if (pc.drawingKind === 'pdf' && pc.drawing) pcRenderPdfIntoStage();
  }

  function pcSelectItem(n) {
    n = parseInt(n, 10) || 1;
    if (n < 1) n = 1;
    pcReadDomMeta();
    pc.cur = n; pcEnsureItems();
    pc.annotCur = '';
    pc.mic.target = 'item';
    pcAutosave();
    if (pc.fs) { pcPaintOverlays(); pcPaintMicStatus(); return; }
    pcRenderEditor(true);
  }
  function pcSelectAnnot(id) {
    pcReadDomMeta();
    var a = pcFindAnnot(id);
    if (!a) return;
    pc.annotCur = a.id;
    pc.mode = 'view';
    pc.mic.target = 'annot';
    if (a.refItem >= 1) pc.cur = a.refItem;
    pcAutosave();
    if (pc.fs) { pcPaintOverlays(); pcPaintMicStatus(); return; }
    pcRenderEditor(true);
  }
  function pcStagePct(clientX, clientY) {
    var ids = pcActiveDrawIds();
    var stage = $(ids.stage); if (!stage) return null;
    var rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: pcClampPct(((clientX - rect.left) / rect.width) * 100),
      y: pcClampPct(((clientY - rect.top) / rect.height) * 100)
    };
  }
  function pcPlacePinAt(clientX, clientY) {
    var pt = pcStagePct(clientX, clientY); if (!pt) return;
    pcEnsureItems();
    pc.items[pc.cur - 1].pin = { x: pt.x, y: pt.y, page: pc.page || 1 };
    pc.mode = 'view';
    pcAutosave();
    if (pc.fs) {
      pcPaintOverlays();
      pcFlash('Pin ' + pc.cur + ' placed on page ' + (pc.page || 1) + '.', false);
      return;
    }
    pcRenderEditor(true);
    pcFlash('Pin ' + pc.cur + ' placed on page ' + (pc.page || 1) + '.', false);
  }
  function pcPlaceTextAt(clientX, clientY) {
    var pt = pcStagePct(clientX, clientY); if (!pt) return;
    pcEnsureAnnots();
    var a = {
      id: pcAnnotId(),
      type: 'text',
      x: pt.x, y: pt.y,
      page: pc.page || 1,
      text: '',
      refItem: pc.cur >= 1 ? pc.cur : undefined
    };
    if (!(a.refItem >= 1)) delete a.refItem;
    pc.annots.push(a);
    pc.annotCur = a.id;
    pc.mode = 'view';
    pc.mic.target = 'annot';
    pcAutosave();
    if (pc.fs) {
      pcPaintOverlays();
      pcFlash('Text box placed. Type or dictate a note.', false);
      setTimeout(function () {
        var ta = document.querySelector('#pc-fs [data-pc-annot-text="' + a.id + '"], [data-pc-annot-text="' + a.id + '"]');
        if (ta) try { ta.focus(); } catch (e) {}
      }, 50);
      return;
    }
    pcRenderEditor(true);
    pcFlash('Text box placed. Type or dictate a note.', false);
    setTimeout(function () {
      var ta = document.querySelector('[data-pc-annot-text="' + a.id + '"]');
      if (ta) try { ta.focus(); } catch (e) {}
    }, 50);
  }
  function pcSetPage(n) {
    n = parseInt(n, 10) || 1;
    if (pc.drawingKind !== 'pdf') return;
    var max = Math.max(1, pc.pdfPages || 1);
    if (n < 1) n = 1;
    if (n > max) n = max;
    if (n === pc.page) return;
    pcReadDomMeta();
    pc.page = n;
    pc.annotCur = '';
    pcAutosave();
    // Update nav + overlays without full re-render when possible
    var meta = $('pc-page-meta');
    if (meta) meta.textContent = 'Page ' + pc.page + ' of ' + max;
    var prev = document.querySelector('[data-pc="page-prev"]');
    var next = document.querySelector('[data-pc="page-next"]');
    if (prev) prev.disabled = pc.page <= 1;
    if (next) next.disabled = pc.page >= max;
    pcPaintOverlays();
    var edit = $('pc-annot-edit'); if (edit) edit.remove();
    pcRenderPdfIntoStage();
  }
  function pcBuildEmail() {
    pcReadDomMeta();
    pcEnsureItems();
    pcEnsureAnnots();
    var lines = pc.items.map(function (it, i) { return { n: i + 1, text: String(it.text || '').trim(), pin: it.pin }; })
      .filter(function (x) { return x.text; });
    if (!lines.length) { pcFlash('Add at least one checklist item before emailing.', true); return; }
    var title = (pc.title || pcDefaultTitle()).trim();
    var project = pcProjectValue();
    var subject = 'Plan check \u2014 ' + project + ' \u2014 ' + title;
    var body = title + '\nProject: ' + project + '\nDate: ' + pcTodayLabel() + '\n\n' +
      lines.map(function (x) {
        var pinNote = '';
        if (x.pin) {
          pinNote = '  [pin p' + (x.pin.page >= 1 ? x.pin.page : 1) + ' @ ' + x.pin.x.toFixed(0) + '%, ' + x.pin.y.toFixed(0) + '%]';
        }
        return x.n + '. ' + x.text + pinNote;
      }).join('\n');
    var notes = pc.annots.filter(function (a) { return String(a.text || '').trim(); });
    if (notes.length) {
      body += '\n\nNotes on plan:';
      notes.forEach(function (a) {
        var ref = a.refItem >= 1 ? ' (ref #' + a.refItem + ')' : '';
        body += '\n- [p' + (a.page || 1) + ']' + ref + ' ' + String(a.text).trim();
      });
    }
    if (pcHasPlan()) {
      body += '\n\n(Pins and text notes are marked on the plan in the Plan Checks app' +
        (pc.drawingKind === 'pdf' ? ' PDF' : '') + '; the drawing itself is not attached to this email.)';
    }
    var to = String(pc.to || '').trim();
    pcAutosave();
    if (to) pcRememberTo(to);
    var mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    var opened = false;
    try { window.location.href = mailto; opened = true; } catch (e) {}
    if (navigator.share) {
      try {
        navigator.share({ title: subject, text: body }).catch(function () {});
      } catch (e2) {}
    }
    pcFlash(opened ? 'Opening mail app\u2026' : 'Mail link ready.', false);
  }
  function pcDeleteChecklist() {
    if (!pc.id) return;
    if (!confirm('Delete this plan check checklist from this phone?')) return;
    pcMicStop(true);
    if (pc.fs) { pc.fs = false; var fsel = $('pc-fs'); if (fsel) fsel.remove(); document.documentElement.classList.remove('pc-fs-open'); document.body.classList.remove('pc-fs-open'); }
    pcReleasePdf();
    var store = pcLoadStore();
    store.list = store.list.filter(function (x) { return x.id !== pc.id; });
    pcSaveStore(store);
    state.pcRoute = { kind: 'list', id: '' };
    show('pc', false);
  }

  function pcBodyClick(e) {
    if (!pcOnScreen()) return;
    var b = e.target.closest('[data-pc]'); if (!b) return;
    var a = b.getAttribute('data-pc');
    if (a === 'new') { show('pc/new'); return; }
    if (a === 'mic') {
      pc.mic.target = (pc.annotCur && pcFindAnnot(pc.annotCur)) ? 'annot' : 'item';
      if (pc.mic.on) pcMicStop(); else pcMicStart();
      return;
    }
    if (a === 'annot-mic') {
      if (!pc.annotCur) return;
      pc.mic.target = 'annot';
      if (pc.mic.on) pcMicStop(); else pcMicStart();
      return;
    }
    if (a === 'proj') {
      pcReadDomMeta();
      pc.project = b.getAttribute('data-p') || 'Other';
      if (pc.project !== 'Other') pc.projectOther = '';
      pcAutosave(); pcRenderEditor(true); return;
    }
    if (a === 'to-pick') {
      pc.to = b.getAttribute('data-e') || '';
      var toEl = $('pc-to'); if (toEl) toEl.value = pc.to;
      pcAutosave(); return;
    }
    if (a === 'sel') { pcSelectItem(b.getAttribute('data-n')); return; }
    if (a === 'pin-sel') { e.stopPropagation(); pcSelectItem(b.getAttribute('data-n')); return; }
    if (a === 'annot-sel') {
      e.stopPropagation();
      pcSelectAnnot(b.getAttribute('data-id'));
      return;
    }
    if (a === 'add') {
      pcReadDomMeta();
      pc.items.push({ text: '', pin: null });
      pc.cur = pc.items.length;
      pc.mic.target = 'item';
      pcAutosave(); pcRenderEditor(true); return;
    }
    if (a === 'del-item') {
      pcReadDomMeta();
      if (pc.items.length <= 1) {
        pc.items = [{ text: '', pin: null }]; pc.cur = 1;
      } else {
        var delN = pc.cur;
        pc.items.splice(pc.cur - 1, 1);
        if (pc.cur > pc.items.length) pc.cur = pc.items.length;
        // Drop refs to deleted item; renumber higher refs
        pc.annots.forEach(function (an) {
          if (!(an.refItem >= 1)) return;
          if (an.refItem === delN) delete an.refItem;
          else if (an.refItem > delN) an.refItem -= 1;
        });
      }
      pcAutosave(); pcRenderEditor(true); return;
    }
    if (a === 'mode') {
      if (!pcHasPlan()) return;
      var m = b.getAttribute('data-mode') || 'view';
      if (m !== 'view' && m !== 'pin' && m !== 'text') m = 'view';
      pc.mode = (pc.mode === m && m !== 'view') ? 'view' : m;
      if (pc.mode !== 'view') pc.annotCur = '';
      if (pc.fs) { pcPaintOverlays(); return; }
      pcRenderEditor(true); return;
    }
    if (a === 'fs-open') { pcEnterFs(); return; }
    if (a === 'fs-done') { pcExitFs(); return; }
    if (a === 'zoom-in') { pcZoomBy(1.25); return; }
    if (a === 'zoom-out') { pcZoomBy(1 / 1.25); return; }
    if (a === 'zoom-fit') { pcZoomFit(); return; }
    if (a === 'fs-prev-item') {
      pcReadDomMeta();
      pc.cur = Math.max(1, pc.cur - 1);
      pc.annotCur = '';
      pc.mic.target = 'item';
      pcAutosave(); pcPaintOverlays(); return;
    }
    if (a === 'fs-next-item') {
      pcReadDomMeta();
      pcEnsureItems();
      if (pc.cur >= pc.items.length) pc.items.push({ text: '', pin: null });
      pc.cur = pc.cur + 1;
      pcEnsureItems();
      pc.annotCur = '';
      pc.mic.target = 'item';
      pcAutosave(); pcPaintOverlays(); return;
    }
    if (a === 'fs-item-mic') {
      pc.annotCur = '';
      pc.mic.target = 'item';
      if (pc.mic.on) pcMicStop(); else pcMicStart();
      pcPaintFsDock();
      return;
    }
    if (a === 'pin-clear') {
      pcEnsureItems();
      if (pc.items[pc.cur - 1]) pc.items[pc.cur - 1].pin = null;
      pcAutosave();
      if (pc.fs) { pcPaintOverlays(); return; }
      pcRenderEditor(true); return;
    }
    if (a === 'draw-clear') {
      if (!confirm('Remove the plan from this checklist? Pins and text notes on it will be cleared.')) return;
      if (pc.fs) pcExitFs();
      pcReleasePdf();
      pc.drawing = ''; pc.drawingKind = '';
      pc.page = 1; pc.pdfPages = 1;
      pc.mode = 'view'; pc.annotCur = '';
      pc.items.forEach(function (it) { it.pin = null; });
      pc.annots = [];
      pcAutosave(); pcRenderEditor(true); return;
    }
    if (a === 'page-prev') { pcSetPage((pc.page || 1) - 1); return; }
    if (a === 'page-next') { pcSetPage((pc.page || 1) + 1); return; }
    if (a === 'annot-del') {
      if (!pc.annotCur) return;
      pc.annots = pc.annots.filter(function (x) { return x.id !== pc.annotCur; });
      pc.annotCur = '';
      pc.mic.target = 'item';
      pcAutosave();
      if (pc.fs) { pcPaintOverlays(); return; }
      pcRenderEditor(true); return;
    }
    if (a === 'annot-done') {
      pcReadDomMeta();
      pc.annotCur = '';
      pc.mic.target = 'item';
      pcAutosave();
      if (pc.fs) { pcPaintOverlays(); return; }
      pcRenderEditor(true); return;
    }
    if (a === 'draw-tap') {
      if (pc._suppressTap) { pc._suppressTap = false; return; }
      if (e.target.closest('.pcpin') || e.target.closest('.pcannot')) return;
      if (pc.mode === 'pin') { pcPlacePinAt(e.clientX, e.clientY); return; }
      if (pc.mode === 'text') { pcPlaceTextAt(e.clientX, e.clientY); return; }
      return;
    }
    if (a === 'email') { pcBuildEmail(); return; }
    if (a === 'delete') { pcDeleteChecklist(); return; }
  }
  function pcBodyInput(e) {
    if (!pcOnScreen()) return;
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-pc-annot-text')) {
      var id = t.getAttribute('data-pc-annot-text');
      var an = pcFindAnnot(id);
      if (an) {
        an.text = t.value;
        var preview = document.querySelector('.pcannot[data-id="' + id + '"] .pcannotbody');
        if (preview) preview.textContent = (t.value || '').trim() || 'Note\u2026';
        pcAutosave();
      }
      return;
    }
    if (t && t.id === 'pc-annot-ref') {
      var a2 = pc.annotCur ? pcFindAnnot(pc.annotCur) : null;
      if (a2) {
        var v = parseInt(t.value, 10);
        if (v >= 1) a2.refItem = v; else delete a2.refItem;
        pcAutosave();
        pcPaintOverlays();
      }
      return;
    }
    if (t && (t.id === 'pc-title-in' || t.id === 'pc-to' || t.id === 'pc-project-other' || t.getAttribute('data-pc-item'))) {
      if (t.getAttribute('data-pc-item')) {
        var n = parseInt(t.getAttribute('data-pc-item'), 10);
        if (n) {
          pcEnsureItems();
          while (pc.items.length < n) pc.items.push({ text: '', pin: null });
          pc.items[n - 1].text = t.value;
          if (n !== pc.cur) {
            document.querySelectorAll('#pc-items .pcitem').forEach(function (row) {
              row.classList.toggle('on', parseInt(row.getAttribute('data-pc-row'), 10) === n);
            });
            pc.cur = n;
            pc.mic.target = 'item';
            pcPaintMicStatus();
            pcPaintOverlays();
          }
        }
      } else {
        pcReadDomMeta();
      }
      pcAutosave();
    }
  }
  function pcBodyChange(e) {
    if (!pcOnScreen()) return;
    var t = e.target;
    if (t && t.id === 'pc-annot-ref') {
      pcBodyInput(e);
      return;
    }
    if (t && t.id === 'pc-draw-file') {
      var f = t.files && t.files[0];
      t.value = '';
      if (f) pcAttachDrawing(f);
    }
  }
  function pcBodyFocus(e) {
    if (!pcOnScreen()) return;
    var t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-pc-item')) {
      var n = parseInt(t.getAttribute('data-pc-item'), 10);
      if (n && n !== pc.cur) {
        pc.cur = n;
        pc.mic.target = 'item';
        document.querySelectorAll('#pc-items .pcitem').forEach(function (row) {
          row.classList.toggle('on', parseInt(row.getAttribute('data-pc-row'), 10) === n);
        });
        pcPaintOverlays();
        pcPaintMicStatus();
      }
    }
    if (t && t.getAttribute && t.getAttribute('data-pc-annot-text')) {
      pc.mic.target = 'annot';
      pcPaintMicStatus();
    }
  }

  // Simple drag for text boxes (pointer) — also pans the fullscreen plan in Select mode
  (function pcAnnotDrag() {
    var drag = null;
    var pan = null;
    var pinch = null;
    function finger(e) { return e.touches ? e.touches[0] : e; }
    function pinchDist(t0, t1) {
      var dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    function onDown(e) {
      if (!pcOnScreen()) return;
      // Pinch start (fullscreen)
      if (pc.fs && e.touches && e.touches.length === 2) {
        var t0 = e.touches[0], t1 = e.touches[1];
        pinch = {
          dist: pinchDist(t0, t1),
          zoom: pc.zoom || 1,
          cx: (t0.clientX + t1.clientX) / 2,
          cy: (t0.clientY + t1.clientY) / 2
        };
        pan = null; drag = null;
        return;
      }
      if (pc.mode !== 'view') return;
      var box = e.target.closest('.pcannot');
      if (box) {
        if (e.target.closest('textarea,select,button,a,input')) return;
        var id = box.getAttribute('data-id'); if (!id) return;
        var pt = finger(e);
        drag = { id: id, x0: pt.clientX, y0: pt.clientY, moved: false };
        return;
      }
      // Pan fullscreen plan when Select tool is active
      if (pc.fs && e.target.closest('#pc-fs-view') && !e.target.closest('.pcpin,.pcannot,textarea,select,button,a,input')) {
        var p = finger(e);
        pan = { x0: p.clientX, y0: p.clientY, panX: pc.panX || 0, panY: pc.panY || 0, moved: false };
      }
    }
    function onMove(e) {
      if (pinch && pc.fs && e.touches && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        var t0 = e.touches[0], t1 = e.touches[1];
        var d = pinchDist(t0, t1);
        var factor = d / pinch.dist;
        var target = pcClampZoom(pinch.zoom * factor);
        var view = $('pc-fs-view'); if (!view) return;
        var rect = view.getBoundingClientRect();
        var mx = ((t0.clientX + t1.clientX) / 2) - rect.left;
        var my = ((t0.clientY + t1.clientY) / 2) - rect.top;
        var oldZ = pc.zoom || 1;
        var wx = (mx - (pc.panX || 0)) / oldZ;
        var wy = (my - (pc.panY || 0)) / oldZ;
        pc.zoom = target;
        pc.panX = mx - wx * target;
        pc.panY = my - wy * target;
        pcApplyZoomPan();
        return;
      }
      if (pan && pc.fs) {
        var p2 = finger(e);
        var dx = p2.clientX - pan.x0, dy = p2.clientY - pan.y0;
        if (!pan.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        pan.moved = true;
        if (e.cancelable) e.preventDefault();
        pc.panX = pan.panX + dx;
        pc.panY = pan.panY + dy;
        pcApplyZoomPan();
        return;
      }
      if (!drag) return;
      var pt = finger(e);
      var ddx = pt.clientX - drag.x0, ddy = pt.clientY - drag.y0;
      if (!drag.moved && Math.abs(ddx) + Math.abs(ddy) < 8) return;
      drag.moved = true;
      if (e.cancelable) e.preventDefault();
      var ids = pcActiveDrawIds();
      var stage = $(ids.stage); if (!stage) return;
      var rect = stage.getBoundingClientRect();
      var an = pcFindAnnot(drag.id); if (!an) return;
      an.x = pcClampPct(((pt.clientX - rect.left) / rect.width) * 100);
      an.y = pcClampPct(((pt.clientY - rect.top) / rect.height) * 100);
      document.querySelectorAll('.pcannot[data-id="' + drag.id + '"]').forEach(function (el) {
        el.style.left = an.x + '%'; el.style.top = an.y + '%';
      });
    }
    function onUp(e) {
      if (pinch && (!e.touches || e.touches.length < 2)) pinch = null;
      if (pan) {
        if (pan.moved) { pc._suppressTap = true; setTimeout(function () { pc._suppressTap = false; }, 450); }
        pan = null;
      }
      if (!drag) return;
      if (drag.moved) pcAutosave();
      drag = null;
    }
    var root = $('screen-pc'); if (!root) return;
    root.addEventListener('mousedown', onDown);
    root.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  })();

  // Wheel zoom over fullscreen plan
  (function pcFsWheel() {
    var root = $('screen-pc'); if (!root) return;
    root.addEventListener('wheel', function (e) {
      if (!pc.fs || !pcOnScreen()) return;
      if (!e.target.closest || !e.target.closest('#pc-fs-view')) return;
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      pcZoomBy(factor, e.clientX, e.clientY);
    }, { passive: false });
  })();

  // Wire once on #screen-pc so fullscreen overlay (sibling of #pc-body) receives events
  (function () {
    var root = $('screen-pc'); if (!root) return;
    root.addEventListener('click', pcBodyClick);
    root.addEventListener('input', pcBodyInput);
    root.addEventListener('focusin', pcBodyFocus);
    root.addEventListener('change', pcBodyChange);
  })();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && pc.mic.on) pcMicStop(true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && pc.fs && pcOnScreen()) { e.preventDefault(); pcExitFs(); }
  });

  /* ---------------- Init ---------------- */
  // Home tiles: press and hold, then drag to reorder. Order is saved on this device.
  (function homeReorder() {
    var grid = $('home-grid'); if (!grid) return;
    var KEY = 'cc_home_order';
    function tiles() { return [].slice.call(grid.children).filter(function (x) { return x.getAttribute && x.getAttribute('data-go'); }); }
    function applyOrder() {
      var saved = []; try { saved = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) {}
      if (!saved.length) return;
      var map = {}; tiles().forEach(function (t) { map[t.getAttribute('data-go')] = t; });
      saved.forEach(function (k) { if (map[k]) { grid.appendChild(map[k]); delete map[k]; } });
      tiles().forEach(function (t) { if (map[t.getAttribute('data-go')]) grid.appendChild(t); });   // new tiles go last
    }
    function saveOrder() { try { localStorage.setItem(KEY, JSON.stringify(tiles().map(function (t) { return t.getAttribute('data-go'); }))); } catch (e) {} }
    applyOrder();
    var timer = null, drag = null, sx = 0, sy = 0, justDragged = false;
    function cancelTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    grid.addEventListener('touchstart', function (e) {
      var t = e.target.closest('.tile'); if (!t || e.touches.length !== 1) return;
      var pt = e.touches[0]; sx = pt.clientX; sy = pt.clientY;
      cancelTimer();
      timer = setTimeout(function () {
        timer = null; drag = { el: t, ox: 0, oy: 0 };
        t.classList.add('dragging'); grid.classList.add('reordering');
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
      }, 450);
    }, { passive: true });
    grid.addEventListener('touchmove', function (e) {
      var pt = e.touches[0];
      if (!drag) { if (Math.abs(pt.clientX - sx) > 10 || Math.abs(pt.clientY - sy) > 10) cancelTimer(); return; }
      e.preventDefault();
      var el = drag.el;
      el.style.transform = 'translate(' + (pt.clientX - sx) + 'px,' + (pt.clientY - sy) + 'px) scale(1.04)';
      el.style.pointerEvents = 'none';
      var over = document.elementFromPoint(pt.clientX, pt.clientY), tgt = over && over.closest ? over.closest('.tile') : null;
      if (tgt && tgt !== el && tgt.parentNode === grid) {
        var before = el.getBoundingClientRect();
        var kids = tiles(), ei = kids.indexOf(el), ti = kids.indexOf(tgt);
        grid.insertBefore(el, ei < ti ? tgt.nextSibling : tgt);
        var after = el.getBoundingClientRect();   // keep the dragged tile under the finger after the DOM move
        sx += after.left - before.left; sy += after.top - before.top;
        el.style.transform = 'translate(' + (pt.clientX - sx) + 'px,' + (pt.clientY - sy) + 'px) scale(1.04)';
      }
    }, { passive: false });
    function end() {
      cancelTimer();
      if (!drag) return;
      drag.el.classList.remove('dragging'); drag.el.style.transform = ''; drag.el.style.pointerEvents = '';
      grid.classList.remove('reordering'); drag = null; saveOrder();
      justDragged = true; setTimeout(function () { justDragged = false; }, 350);
    }
    grid.addEventListener('touchend', end); grid.addEventListener('touchcancel', end);
    grid.addEventListener('click', function (e) { if (justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  })();

  // Refresh: hard refresh, like signing out and back in, but keeps all saved data (localStorage is untouched).
  //  1) unregister any service workers  2) delete every Cache Storage cache  3) clear sessionStorage
  //  4) re-download index.html, app.js, app.css (and whatever ?v= the new index.html points at) with cache:'reload',
  //     which bypasses and overwrites the browser HTTP cache  5) navigate to a cache-busted URL.
  (function () {
    var b = $('cc-refresh');
    function hardRefresh() {
      var stamp = Date.now();
      var tasks = [];
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          tasks.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
            return Promise.all(rs.map(function (r) { return r.unregister(); }));
          }).catch(function () {}));
        }
      } catch (e) {}
      try {
        if (window.caches && caches.keys) {
          tasks.push(caches.keys().then(function (ks) {
            return Promise.all(ks.map(function (k) { return caches.delete(k); }));
          }).catch(function () {}));
        }
      } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      var base = location.pathname.replace(/[^\/]*$/, '');
      function reget(url) {
        try { return fetch(url, { cache: 'reload', credentials: 'same-origin' }).then(function (r) { return r.text(); }).catch(function () { return ''; }); }
        catch (e) { return Promise.resolve(''); }
      }
      if (window.fetch) {
        tasks.push(reget(location.pathname).then(function (html) {
          var urls = [base + 'app.js', base + 'app.css'];
          var re = /(?:src|href)="((?:app\.js|app\.css)\?v=[^"]+)"/g, m;
          while ((m = re.exec(html || ''))) urls.push(base + m[1]);
          return Promise.all(urls.map(reget));
        }));
      }
      var go = function () { location.replace(location.pathname + '?r=' + stamp + '#home'); };
      var timer = setTimeout(go, 4000);   // never hang if the network is slow
      Promise.all(tasks).then(function () { clearTimeout(timer); go(); }, function () { clearTimeout(timer); go(); });
    }
    if (b) b.addEventListener('click', function () {
      b.textContent = 'Refreshing\u2026';
      b.disabled = true;
      hardRefresh();
    });
    if (/[?&]r=\d+/.test(location.search)) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
  })();

  $('home-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $('a2hs').hidden = false;

  if (!API_URL || API_URL.indexOf('__') === 0) {
    // API not configured yet: keep the old behavior (open the Apps Script app).
    if (standalone) location.replace(FALLBACK_URL);
    else { lock('Data API not configured yet.'); }
    return;
  }
  // Share link: https://zpg209.github.io/cc/#k=<passcode> saves the passcode on this device, then removes it from the address bar.
  // (The part after # is never sent to any server.)
  var km = /^#k=([^&]+)/.exec(location.hash);
  if (km) {
    try { setPc(decodeURIComponent(km[1])); } catch (e) {}
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  }
  if (getPc()) show(location.hash.slice(1) || 'home', true);
  else lock();
})();
