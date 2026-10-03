/* Command Center — static front end for GitHub Pages.
 * Data comes from the passcode-protected Apps Script JSON API (Api.gs).
 * The passcode is typed by the user and kept only in this device's localStorage. */
(function () {
  'use strict';

  // Public web app URL of the separate "Anyone" API deployment (the passcode protects the data).
  var API_URL = 'https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec';
  var PC_KEY = 'cc_passcode';
  var FALLBACK_URL = 'https://script.google.com/a/macros/landstruc.com/s/AKfycbyigotJxdJD3CeCpRyCEfhHdL7zcv2ZE_ibTm2ZyITgODqrh_NxGhONx6m8CcBlxaPD/exec';

  var state = { weekOffset: 0, monthOffset: 0, links: null, logSeq: 0, logData: null, logOpen: {}, trkSeq: 0, trackData: null, trkMode: 'add', trkBusy: false, trkFormsFor: '', logTot: 'month', waterBusy: false, bodyBusy: false, spendSeq: 0,
    spendData: null, spendDataOff: null, spendRoute: { kind: '', val: '', acct: '' },
    biz: null, bizSlug: '', docFrom: 'home', docPushed: false, scrollMem: {}, docTimer: 0,
    docSeq: 0, docKey: '', proxyOff: false, reData: null, reAt: 0, insData: null, insAt: 0, reRoute: { ins: false, slug: '' }, ltPart: '', ltCache: {}, ltOpen: {},
     folderCache: {}, docUrls: [], pdf: null, pdfObserver: null, finKind: '', ovKey: '', insSlug: '', spendFrom: '', projSlug: 'terravi' };
  var SCREENS = ['lock', 'home', 'projects', 'life', 'log', 'spend', 'biz', 'doc', 're', 'lt', 'proj', 'notes', 'mic', 'docs', 'punch', 'fin', 'insn', 'ent', 'track', 'trust'];

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
    if (name === 'ins') { name = 're'; state.reRoute = { ins: true, slug: '' }; }
    else if (name === 're') state.reRoute = { ins: false, slug: R.kind };
    if (SCREENS.indexOf(name) < 0 || name === 'lock') name = 'home';
    if (!getPc()) return lock();
    if (name === 'spend') {
      var curEl = document.querySelector('.screen.active'), cur = curEl ? curEl.id.replace(/^screen-/, '') : '';
      if (cur === 'fin') { var ovk = state.finKind === 'overview' && state.ovKey ? '/' + state.ovKey : ''; state.spendFrom = state.finKind === 'laundromat' ? 'fin/laundromat' : state.finKind === 'overview' ? 'fin/overview' + ovk : ''; if (state.finKind) state.scrollMem['fin/' + state.finKind + ovk] = window.scrollY || 0; }
      else if (cur === 'ent' && R.kind === 'debt') state.spendFrom = 'ent/' + state.entRoute.key;
      else if (cur !== 'spend' && cur !== 'doc') state.spendFrom = '';
      var okKind = R.kind === 'all' || (/^(cat|acct|income|cash|who|calc|bal|debt)$/.test(R.kind) && R.val);
      state.spendRoute = okKind ? { kind: R.kind, val: R.kind === 'all' ? '' : R.val, acct: (R.kind === 'cat' || R.kind === 'cash' || R.kind === 'debt') ? R.acct : '' }
        : { kind: '', val: '', acct: '' };
    }
    if (name === 'ent') {
      var entKey = ENTS[R.kind] ? R.kind : 'kiwit', entSub = ENT_SUBS.test(R.val) ? R.val : '';
      state.entRoute = { key: entKey, kind: entSub, val: entSub ? R.acct : '' };
    }
    if (name === 'fin') { state.finKind = (R.kind === 'overview' || R.kind === 'laundromat') ? R.kind : ''; state.ovKey = state.finKind === 'overview' && OV_HEADS[R.val] ? R.val : ''; }
    if (name === 'insn') state.insSlug = R.kind || '';
    if (name === 'punch' && !(PROJ[R.kind] && PROJ[R.kind].punchUrl)) { name = 'proj'; route = 'proj/' + (PROJ[R.kind] ? R.kind : 'terravi'); }
    var logMic = name === 'mic' && R.kind === 'dailylog';       // #mic/dailylog = Dictate page for the Daily log (Voice notes)
    if (logMic) micLogSetup();
    else if (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs' || name === 'punch') projSetup(R.kind);
    if (name !== 'mic') micStop(true);
    if (name !== 'punch') pmicStop();
    if (name !== 'doc') { state.docPushed = false; state.docSeq++; closeDoc(); }
    activate(name);
    if (!fromHistory) {
      if (name === 'biz') state.bizSlug = R.kind;
      var h = name === 'home' ? '' : name === 'spend' ? spendHash(state.spendRoute) :
        name === 'biz' && R.kind ? '#biz/' + encodeURIComponent(R.kind) :
        name === 'doc' ? '#doc?' + R.query :
        logMic ? '#mic/dailylog' :
        (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs' || name === 'punch') ? '#' + name + '/' + state.projSlug :
        name === 'ent' ? entHash(state.entRoute) :
        name === 'fin' ? '#fin' + (state.finKind ? '/' + state.finKind + (state.ovKey ? '/' + state.ovKey : '') : '') :
        name === 'insn' ? '#insn' + (state.insSlug ? '/' + encodeURIComponent(state.insSlug) : '') :
        name === 'lt' ? '#lt' + (R.kind ? '/' + encodeURIComponent(R.kind) : '') :
        name === 're' ? (state.reRoute.ins ? '#ins' : '#re' + (state.reRoute.slug ? '/' + encodeURIComponent(state.reRoute.slug) : '')) : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects' || name === 'life') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'track') loadTrack();
    if (name === 'spend') loadSpend(false);
    if (name === 'ent') loadEnt(false);
    if (name === 'biz') { state.bizSlug = R.kind; loadBiz(); }
    if (name === 're') loadRe();
    if (name === 'proj') renderProj();
    if (name === 'notes') openNotes();
    if (name === 'mic') openMic();
    if (name === 'docs') openDocs();
    if (name === 'punch') openPunch();
    if (name === 'fin') loadFin(false);
    if (name === 'insn') loadInsn(false);
    if (name === 'lt') { state.ltPart = LT_PARTS[R.kind] ? R.kind : ''; loadLt(); }
    if (name === 'trust') loadTrust(false);
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

  /* ---------------- Links (projects / life areas) ---------------- */
  function loadLinks() {
    if (state.links) return renderLinks();
    $('projects-list').innerHTML = $('life-list').innerHTML = '<div class="loading" style="grid-column:1/-1">Loading…</div>';
    api('links').then(function (d) { state.links = d; renderLinks(); }, onFail(['projects-list', 'life-list'], loadLinks));
  }
  // Google files open in the in-app viewer (no new tab); other links keep opening externally.
  function extAttr(url) { return toEmbed(url) ? '' : ' target="_blank" rel="noopener" data-external'; }
  function tile(item, sub) {
    if (!item.url) return '<div class="tile small disabled">' + esc(item.name) + '<span class="sub">coming soon</span></div>';
    return '<a class="tile small"' + extAttr(item.url) + ' href="' + esc(item.url) + '" data-title="' + esc(item.name) + '">' + esc(item.name) +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</a>';
  }
  // Folder URLs of the life areas, kept for the "Open ... folder" links on the Home-level screens (Finances, Insurance,
  // Lisa's Table, Trust & Estate) even though those areas no longer have a tile on the Life areas tab.
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
    $('projects-list').innerHTML = plist.map(function (p) {
      var slug = projSlugOf(p.name);
      if (slug) {
        (state.projDocUrls = state.projDocUrls || {})[slug] = p.url;
        return '<button class="tile small" data-go="proj/' + slug + '">' + esc(p.name) + '<span class="sub">Notes \u00b7 Docs \u00b7 Mic</span></button>';
      }
      return tile(p, p.kind === 'doc' ? 'Running notes' : p.kind === 'folder' ? 'Drive folder' : '');
    }).join('');
    applyAreaUrls(d);
    // Life areas keeps only the areas with no other home. Financial / Insurance live on Home (Finances, Insurance);
    // Lisa's Table and Trust & Estate are Home tiles too. Their folder URLs are still read from `links` (applyAreaUrls).
    $('life-list').innerHTML = d.lifeAreas.map(function (a) {
      if (/^(financial|insurance|lisa.s table|trust\s*(&|and|&amp;)\s*estate)$/i.test(a.name)) return '';
      if (/^real estate$/i.test(a.name)) return '<button class="tile small" data-go="re">' + esc(a.name) + '<span class="sub">3 properties</span></button>';
      if (/^business$/i.test(a.name)) return '<button class="tile small" data-go="biz">' + esc(a.name) + '<span class="sub">3 businesses</span></button>';
      return tile(a, '');
    }).join('');
    $('sb-root').href = d.secondBrainUrl;
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

  var TRK_BODY = { hike: ['Hike miles', '0.1'], steps: ['Steps', '1'], weight: ['Weight (lb)', '0.1'], sleep: ['Sleep (hours)', '0.1'] };
  function renderTrackForms(d) {
    var ext = d.ext, h = '';
    if (!ext || !ext.write) { $('trk-forms').innerHTML = ''; return; }
    var canDay = !!ext.write.logday, set = ext.write.set || [], t = ext.today || {}, cols = ext.columns || {};
    var inp = function (id, label, step, cur, attrs) {
      return '<label>' + label + '<input type="number" inputmode="decimal" step="' + step + '" min="0" ' + (attrs || '') + ' value="' + (cur == null ? '' : cur) + '" autocomplete="off"></label>';
    };
    if (canDay) {
      h += '<div class="card fitcard qa" id="qa-meal"><h3>Add a meal</h3><div class="qgrid4">' +
        [['calories', 'kcal', '1'], ['protein', 'Protein g', '1'], ['carbs', 'Carbs g', '1'], ['fat', 'Fat g', '1']].map(function (f) { return inp('', f[1], f[2], '', 'data-m="' + f[0] + '"'); }).join('') + '</div>' +
        '<div class="seg small" id="qa-mode"><button type="button" data-mode="add" class="' + (state.trkMode === 'set' ? '' : 'on') + '">Add to today</button><button type="button" data-mode="set" class="' + (state.trkMode === 'set' ? 'on' : '') + '">Set today\u2019s total</button></div>' +
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
      h += '<div class="card fitcard qa" id="qa-body"><h3>Activity &amp; body \u00b7 today</h3><div class="bgrid">' + fields.map(function (f) {
        var cur = t[f];
        return '<label>' + TRK_BODY[f][0] + '<input type="number" inputmode="decimal" step="' + TRK_BODY[f][1] + '" min="0" data-f="' + f + '" data-cur="' + (cur == null ? '' : cur) + '" value="' + (cur == null ? '' : cur) + '" autocomplete="off"></label>';
      }).join('') + '</div><button type="button" class="fitbtn wide" id="qa-body-go">Save today</button><div class="fitmsg" id="qa-body-msg" role="status"></div>' +
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
    var mode = state.trkMode === 'set' ? 'set' : 'add', p = { mode: mode, cid: fitCid() };
    Object.keys(vals).forEach(function (k) { p[k] = vals[k]; });
    trkGo(btn, 'qa-meal-msg', function () {
      return apiRaw('logday', p).then(function (j) {
        var r = trkRes(j), w = r.written || {}, now = [];
        ['calories', 'protein', 'carbs', 'fat'].forEach(function (k) { if (w[k]) now.push(fmt(w[k].after) + (k === 'calories' ? ' kcal' : ' g ' + k)); });
        Array.prototype.forEach.call(document.querySelectorAll('#qa-meal input[data-m]'), function (i) { i.value = ''; });
        fitSay('qa-meal-msg', (mode === 'add' ? 'Added. Today now ' : 'Set. Today is ') + now.join(' \u00b7 '));
        var m = $('qa-meal-msg');
        if (m && !r.duplicate) {
          var u = document.createElement('button'); u.type = 'button'; u.className = 'fitundo'; u.textContent = 'Undo';
          u.addEventListener('click', function () {
            var back = { mode: 'set', cid: fitCid() }; Object.keys(w).forEach(function (k) { if (['calories', 'protein', 'carbs', 'fat'].indexOf(k) >= 0) back[k] = w[k].before == null ? 0 : w[k].before; });
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
    var p = { cid: fitCid() };
    if (type) p.workout = type; else p.workout = 'Workout';
    if (min !== '') { var n = Number(min); if (!isFinite(n) || n < 0) return fitSay('qa-wo-msg', 'Minutes must be a positive number.', true); p.workout_min = n; }
    trkGo(btn, 'qa-wo-msg', function () {
      return apiRaw('logday', p).then(function (j) {
        trkRes(j); $('qa-wo-type').value = ''; $('qa-wo-min').value = '';
        fitSay('qa-wo-msg', 'Saved: ' + p.workout + (p.workout_min != null ? ' \u00b7 ' + fmt(p.workout_min) + ' min' : ''));
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
      if (Object.keys(dayP).length) { dayP.cid = fitCid(); chain = chain.then(function () { return apiRaw('logday', dayP).then(function (j) { trkRes(j); done += Object.keys(dayP).length - 1; }); }); }
      jobs.forEach(function (j) { chain = chain.then(function () { return apiRaw('logset', { field: j.f, value: j.v, cid: fitCid() }).then(function (r) { trkRes(r); done++; }); }); });
      return chain.then(function () {
        Array.prototype.forEach.call(document.querySelectorAll('#qa-body input[data-f]'), function (i) { i.setAttribute('data-cur', i.value); });
        fitSay('qa-body-msg', 'Saved ' + done + ' value' + (done === 1 ? '' : 's') + '.');
        return loadTrackQuiet();
      }, function (err) { return loadTrackQuiet().then(function () { throw err; }); });
    });
  }
  $('trk-forms').addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('button') : null; if (!t) return;
    if (t.id === 'qa-meal-go') trkMeal(t);
    else if (t.id === 'qa-wo-go') trkWorkout(t);
    else if (t.id === 'qa-body-go') trkBody(t);
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

  // Works with the new API (items[] with account, income[]) and older shapes (recent[] only / no income).
  function spendModel(d) {
    var full = Array.isArray(d.items);
    var items = (full ? d.items : (d.recent || [])).map(function (x) {
      return { date: x.date, label: x.label || x.date, who: x.who || '', amount: Number(x.amount) || 0,
        category: normCat(x.category), merchant: x.merchant || '', method: x.method || '',
        notes: x.notes || '', account: normAcct(x.account), paidFrom: x.paidFrom || '' };
    });
    var income = (Array.isArray(d.income) ? d.income : []).map(function (x) {
      return { date: x.date, label: x.label || x.date, source: normSource(x.source), amount: Number(x.amount) || 0, notes: x.notes || '',
        client: x.client || x.description || '', method: x.method || '', gid: x.gid != null ? String(x.gid) : '' };
    });
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
      lsGid: lsGid,
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
      return '<div class="entry item"><div class="d">' + esc(e.label) + '<br>' + esc(e.who) + '</div>' +
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
      var ds = DETAIL_SRC[e.source], pt = !!ds, meta = [];
      if (showSrc) meta.push(esc(ds ? ds.label : e.source));
      if (pt && e.method) meta.push(isCash(e) ? '<span class="cashtag">' + esc(e.method) + '</span>' : esc(e.method));
      return '<div class="entry item inc' + (pt ? ' ptitem' : '') + '"><div class="d">' +
        (pt ? esc(e.label) : 'Week ending<br><b>' + esc(e.label) + '</b>') + '</div><div class="m">' +
        (pt ? '<div class="mer">' + esc(e.client || '—') + '</div>' : '') +
        (meta.length ? '<div class="meta"><small>' + meta.join(' · ') + '</small></div>' : '') +
        (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : (pt ? '' : '<div class="notes">—</div>')) + '</div>' +
        '<div class="a amt-in">' + money(e.amount) + '</div></div>';
    }).join('');
  }
  // Compact per-source entry list for the expanded Income cards: most recent first, date + (client) + amount.
  function incCompact(list, detail) {
    if (!list.length) return '<div class="foot empty">No entries this month</div>';
    var t = function (x) { var v = Date.parse(x.date); return isNaN(v) ? 0 : v; };
    var rows = list.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return (t(b.e) - t(a.e)) || (a.i - b.i); });
    return '<div class="inccompact">' + rows.map(function (r) {
      var e = r.e, what = detail ? (e.client || '') : 'Week ending';
      return '<div class="icrow"><span class="icd">' + (detail ? esc(e.label) : 'Wk ending ' + esc(e.label)) + '</span>' +
        '<span class="icc">' + (detail ? esc(what) : '') + '</span><span class="amt amt-in">' + money(e.amount) + '</span></div>';
    }).join('') + '</div>';
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
      return { name: a.name || '', bank: a.bank || '', type: a.type || '', group: 'Investments', balance: acNum(a.balance), asOf: a.asOf || '',
        notes: a.notes || '', prevBalance: acNum(a.prevBalance), prevAsOf: a.prevAsOf || '', change: acNum(a.change), entries: entries };
    };
    var investments = rawInv.map(mapAcct);
    var accounts = rawAcc.map(function (a) {
      var entries = (Array.isArray(a.entries) ? a.entries : []).map(function (e) {
        return { date: e.date || '', balance: Number(e.balance) || 0, notes: e.notes || '' };
      });
      return { name: a.name || '', bank: a.bank || '', type: a.type || '', group: normAcct(a.group), balance: acNum(a.balance), asOf: a.asOf || '',
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
    }).then(function () { if (state.spendData && $('screen-spend').classList.contains('active')) renderSpend(); if (state.finKind === 'overview' && $('screen-fin').classList.contains('active')) renderOv(); });
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
    }).then(function () { if (state.spendData && $('screen-spend').classList.contains('active')) renderSpend(); if ($('screen-ent').classList.contains('active')) renderEnt(); if (state.finKind === 'overview' && $('screen-fin').classList.contains('active')) renderOv(); });
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
      h += '<h2 class="vgrp inc">Income</h2>';
      h += '<div class="incgroup">';
      M.sources.forEach(function (sx) {
        var l = M.income.filter(function (x) { return x.source === sx.name; });
        var ds = DETAIL_SRC[sx.name];
        var b = incCompact(l, !!ds) +
          sheetLink('Open in spend sheet', ds ? ds.tab : 'income', ds && ds.tab === 'ls' ? M.lsGid : '');
        h += vSec('inc-' + sx.name, 'income incsrc', esc(sx.label), '<span class="amt-in">' + money(sx.amount) + '</span>', incomeRoute(sx.name), b);
      });
      h += vSec('inc-total', 'income', 'Total income', '<span class="amt-in">' + money(M.incomeTotal) + '</span>', incomeRoute('All'), '<div class="foot">Sum of the income sources above.</div>');
      h += '</div>';

      h += '<h2 class="vgrp exp">Expenses</h2>';
      h += billsSection();

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
      h += vSec('summary', 'summary', 'Summary', '<span class="amt ' + (monthNet >= 0 ? 'pos' : 'neg') + '">' + signedMoney(monthNet) + '</span>', calcRoute('month-net'), sumBody);

      if (M.who.length) h += vSec('who', 'whosec', 'Household \u00b7 Zac vs Lisa', '<span class="amt-out">' + money(sum(M.who)) + '</span>', acctRoute('Household'),
        '<div class="split">' + M.who.map(function (w) { return '<button class="splitbtn"' + goAttr(whoRoute(w.name)) + '><b class="amt-out">' + money(w.amount) + '</b>' + esc(w.name) + '</button>'; }).join('') + '</div>');

      h += accountsSection();

      h += '<button class="linkrow allbtn"' + goAttr('spend/all') + '>All items (' + M.entryCount + ') &rsaquo;</button>';
      h += sheetLink('Open in spend sheet');
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
          : 'the Income tab (weekly lump sums), the Personal Training tab (client payments)' + (hasLS ? ' and the Land &amp; Structure Pay tab' : '') + ' of the spend sheet.') + '</div></div>';
      h += sheetLink('Open in spend sheet' + (isPT ? ' (' + ds.tabName + ' tab)' : ' (Income tab)'), isPT ? ds.tab : 'income', isPT && ds.tab === 'ls' ? M.lsGid : '');
      if (all) {
        h += sheetLink('Open Personal Training tab', 'pt').replace('linkrow sheetbtn', 'linkrow sheetbtn second');
        if (hasLS) h += sheetLink('Open Land & Structure Pay tab', 'ls', M.lsGid).replace('linkrow sheetbtn', 'linkrow sheetbtn second');
      }
      h += '<div class="card income">' + incomeRows(inc, all) + '</div>';

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
  // Routes: #ent/<kiwit|tiwik>, #ent/<key>/cat/<Category>, /income/<Source|All>, /exp, /net, /bal, /flags, /tax
  // No figures live in this file: everything is fetched at runtime (public repo). Loans / bills reuse the Vault's `vaultdebt` data
  // (filtered by entity), so they keep working even before the `entity` action is deployed.
  // Colors: income green, spend red (same as the Vault), copper accents, balances teal, loans amber.
  var ENTS = { kiwit: { key: 'kiwit', name: 'KiwiT', title: 'KiwiT LLC', sub: 'Landlord \u00b7 Mono Way building' },
               tiwik: { key: 'tiwik', name: 'TiwiK', title: 'TiwiK LLC', sub: 'Operator \u00b7 Mono Village Laundromat' } };
  var ENT_SUBS = /^(cat|income|exp|net|bal|flags|tax)$/;
  var ENT_TTL = 60000;
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  state.entRoute = { key: '', kind: '', val: '' };
  state.entOff = 0; state.entCache = {}; state.entTaxCache = {}; state.entYear = new Date().getFullYear();

  function entHash(er) {
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
    $('ent-back').hidden = !sub;
    $('ent-back').setAttribute('data-go', 'ent/' + E.key);
    $('ent-title').textContent = sub ? E.name + ' \u00b7 ' + entSubTitle(R) : E.title;
    $('ent-title').classList.toggle('sub', sub);
    $('ent-tabs').hidden = sub;
    $('ent-tabs').innerHTML = '<button data-go="spend">Vault</button>' + Object.keys(ENTS).map(function (k) {
      return '<button class="' + (k === E.key ? 'on' : '') + '" data-go="ent/' + k + '">' + esc(ENTS[k].title) + '</button>'; }).join('');
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

  function renderEnt() {
    var R = state.entRoute, E = ENTS[R.key];
    if (!E) return;
    paintEntChrome();
    var h = '';
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

  /* ---------------- Business (Life areas > Business) ---------------- */
  // #biz = three business buttons; #biz/<slug> = grouped, linked document list.
  // Data comes from the passcode-protected API (action=biz), never from the public repo.
  function loadBiz() {
    if (state.biz) return renderBiz();
    $('biz-title').textContent = 'Business';
    $('biz-back').setAttribute('data-go', state.bizSlug ? 'biz' : 'life');
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
  function renderBiz() {
    var d = state.biz, slug = state.bizSlug;
    var b = slug && (d.businesses || []).filter(function (x) { return x.slug === slug; })[0];
    $('biz-back').setAttribute('data-go', b ? 'biz' : 'life');
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
    b.groups.forEach(function (g) {
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
    $('re-back').setAttribute('data-go', r.slug ? 're' : 'life');
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
    recipes: { label: 'Recipes',               folder: '1VvrIYV15BX7Rltet2PC7kTxVheUfqMfI', sort: 'az', search: 'Search recipes' },
    menus:   { label: 'Past Menus',            folder: '11tV_huL874mr4F3LdGA-2fvGQZyEWKZY', sort: 'date', search: 'Search menus' },
    macros:  { label: 'Menu Macros', sheet: 'https://docs.google.com/spreadsheets/d/1YhDpmch8pWIAFKEwrSv7AMwWHyhuVW1OyeqbSNOPk3w/edit' }
  };
  var LT_ORDER = ['ops', 'recipes', 'menus', 'macros'];
  var LT_TTL = 60000;

  function loadLt(force) {
    var part = state.ltPart, cfg = LT_PARTS[part];
    $('lt-back').setAttribute('data-go', part ? 'lt' : 'home');
    $('lt-title').textContent = cfg ? cfg.label : 'Lisa\u2019s Table';
    $('lt-title').classList.toggle('sub', !!part);
    if (!cfg) {
      $('lt-body').innerHTML = '<div class="grid2">' + LT_ORDER.map(function (k) {
        return '<button class="tile" data-go="lt/' + k + '">' + esc(LT_PARTS[k].label) + '</button>';
      }).join('') + '</div>' + (state.ltFolderUrl ? '<a class="linkrow" data-title="Lisa\u2019s Table" href="' + esc(state.ltFolderUrl) + '">Open Lisa\u2019s Table folder &rsaquo;</a>' : '');
      if (!state.ltFolderUrl && !state.links) ensureLinks(function () { if (state.ltPart === '' && $('screen-lt').classList.contains('active') && state.ltFolderUrl) loadLt(); });
      return;
    }
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
    paint();
  }
  function ltFolderHtml(d, cfg, term) {
    var items = d.items.filter(function (x) { return !term || x.name.toLowerCase().indexOf(term) >= 0; });
    if (!items.length) return '<div class="loading">' + (term ? 'No matches.' : 'This folder is empty.') + '</div>';
    var foot = '<div class="foot">' + items.length + ' of ' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + '</div>';
    if (cfg.sort === 'az') {
      items = items.slice().sort(function (a, b) {
        if (!!a.folder !== !!b.folder) return a.folder ? -1 : 1;
        return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
      });
      return foot + '<div class="card"><ul class="doclist folderlist">' + items.map(function (x) {
        return ltItemLink(x, x.name.replace(/\.(docx?|pdf)$/i, '').trim());
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
    var h = '<div class="card mac"><div class="mac-head"><span style="text-align:left">Item</span><span>Calories</span><span>Protein</span><span>Carbs</span><span>Fat</span></div>';
    var cats = d.categories.filter(function (c) { return items.some(function (x) { return x.category === c; }); });
    cats.forEach(function (c) {
      h += '<div class="mac-cat">' + esc(c) + '</div>';
      items.forEach(function (x, i) {
        if (x.category !== c) return;
        var id = 'm' + d.items.indexOf(x), open = !!state.ltOpen[id];
        h += '<div class="mac-row' + (open ? ' open' : '') + '" data-mac="' + id + '">' +
          '<div class="mac-name">' + esc(x.item) + (x.serving ? '<small>' + esc(x.serving) + '</small>' : '') + '</div>' +
          '<div class="cell">' + fmtN(x.cal) + '</div><div class="cell">' + fmtN(x.protein) + '</div><div class="cell">' + fmtN(x.carbs) + '</div><div class="cell">' + fmtN(x.fat) + '</div></div>';
        h += '<div class="mac-detail" id="' + id + '"' + (open ? '' : ' hidden') + '>' +
          (/estimate/i.test(x.basis) ? '<span class="badge">Estimate — to be measured</span>' : x.basis ? '<span class="badge ok">' + esc(x.basis) + '</span>' : '') +
          (x.ingredients ? '<div><b>Key ingredients</b> ' + esc(x.ingredients) + '</div>' : '') +
          (x.notes ? '<div><b>Notes</b> ' + esc(x.notes) + '</div>' : '') +
          (x.listings != null ? '<div><b>Past-menu listings</b> ' + fmt(x.listings) + '</div>' : '') +
          (x.sources && x.sources.length ? '<div><b>Source</b> ' + x.sources.map(function (s) {
            return s.id ? '<a href="https://drive.google.com/file/d/' + esc(s.id) + '/view" data-title="' + esc(s.name) + '">' + esc(s.name.replace(/\s+\./, '.')) + '</a>' : esc(s.name);
          }).join(' · ') + '</div>' : '') + '</div>';
      });
    });
    h += '</div><div class="foot">' + items.length + ' of ' + d.items.length + ' items · per serving · kcal, g, g, g · tap a row for details</div>';
    return h;
  }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('.mac-row');
    if (!r) return;
    var id = r.getAttribute('data-mac'), det = $(id);
    state.ltOpen[id] = !state.ltOpen[id];
    r.classList.toggle('open', state.ltOpen[id]);
    if (det) det.hidden = !state.ltOpen[id];
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
      if (boxId === 'fin-body' && state.finKind === 'overview' && ovClick(e)) return;
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
    ['overview', 'laundromat'].forEach(function (k) {
      h += '<button class="bigbtn" data-go="fin/' + k + '">' + esc(FIN_PAGES[k].label) + '<span class="sub">' + esc(FIN_PAGES[k].sub) + '</span></button>';
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
    h += statusCard(d.status);
    h += todoCards(d.todo || [], 'ov');
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
  // open the source Doc / PDF in the viewer, ESTIMATE figures carry a tappable "Estimate" badge that lists what Zac needs to provide.
  var ov = { fin: { s: 'load' }, sp: { s: 'load' }, cache: {}, seq: 0, estOpen: {}, idx: {}, d: null };
  var OV_LABEL = {
    'inv.af': 'American Funds', 'inv.etrade': 'E*TRADE', 're.total': 'Real estate (3 properties)', 'eq.value': 'Laundromat equipment',
    'wet.bal': 'Balance', 'wet.rate': 'Rate (fixed)', 'wet.pi': 'Principal & interest', 'wet.escrow': 'Escrow', 'wet.pay': 'Monthly payment', 'wet.due': 'Next payment due', 'wet.maturity': 'Maturity',
    'mono.bal': 'Balance (calculated)', 'mono.orig': 'Original principal', 'mono.rate': 'Rate', 'mono.pay': 'Monthly payment (P&I)', 'mono.maturity': 'Maturity',
    'all.bal': 'Balance', 'all.rate': 'Rate', 'all.pay': 'Monthly payment now', 'all.pay2': 'Monthly payment after reset', 'all.maturity': 'Maturity', 'all.payoff': 'Payoff today (calculated)',
    'bos.cl.limit': 'Commercial line limit (unused)', 'bos.heloc.limit': 'HELOC limit (unused)',
    'cash.bos_chk': 'BoS checking', 'cash.bos_sav': 'BoS savings', 'cash.lisa': 'Lisa\u2019s account', 'cash.tiwik': 'TiwiK account', 'cash.kiwit': 'KiwiT account', 'cash.ov_hsa': 'Oak Valley HSA', 'cash.ov_mm': 'Oak Valley money market',
    'buffer.low': 'Working buffer \u00b7 low', 'buffer.high': 'Working buffer \u00b7 high',
    'inc.k1': 'K-1 income / yr', 'inc.w2': 'W-2 income / yr', 'hh.burn': 'Household burn / mo (provisional)',
    'ld.rev': 'Revenue / mo', 'ld.util': 'Utilities / mo', 'ld.rep': 'Repairs / mo', 'ld.ins': 'Insurance / mo',
    'mw.rent_lease': 'Tenant rent / mo', 'mw.tax': 'Property tax / mo', 'mw.ins': 'Insurance / mo',
    'st.rent': 'Rent / mo', 'st.tax': 'Property tax / mo', 'st.ins': 'Insurance / mo', 'st.debt': 'Loan payment / mo'
  };
  function ovLabel(r) {
    if (OV_LABEL[r.ref]) return OV_LABEL[r.ref];
    var t = String(r.figure || r.ref).replace(/\s*[\(=].*$/, '');
    return t.length > 60 ? t.slice(0, 57) + '\u2026' : t;
  }
  function ovIndex(d) {
    var idx = {};
    (d.ledger || []).forEach(function (r) { idx[r.ref] = r; });
    ov.idx = idx; ov.d = d;
  }
  function ovN(ref) {
    var r = ov.idx[ref];
    if (!r) return null;
    if (typeof r.num === 'number' && isFinite(r.num)) return r.num;
    var m = moneyNum(r.value);
    if (m !== null) return m;
    if (/%/.test(r.value)) { var p = parseFloat(String(r.value).replace(/[^\d.\-]/g, '')); return isNaN(p) ? null : p; }
    return null;
  }
  function ovEst(ref) { var r = ov.idx[ref]; return !!r && /^estimate/i.test(r.status || ''); }
  function ovUrl(label) {
    var d = ov.d, hit = null;
    (d.srcLinks || []).forEach(function (s) { if (s.label === label) hit = s.url; });
    if (!hit) (d.srcLinks || []).forEach(function (s) { if (!hit && label && (s.label.indexOf(label) === 0 || label.indexOf(s.label) === 0)) hit = s.url; });
    return hit || d.url || '';
  }
  function ovWhole(n) { return (n < 0 ? '\u2212' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US'); }
  function ovMo(n) { return n === null || !isFinite(n) ? '\u2014' : (Math.round(n * 10) / 10).toFixed(1) + ' mo'; }
  function ovNeeds(ref) {
    return (ov.d.needs || []).filter(function (n) {
      return String(n.ref || '').split(/[,\s]+/).some(function (t) {
        return t === ref || (/\.\*$/.test(t) && ref.indexOf(t.slice(0, -1)) === 0);
      });
    });
  }
  function ovEstKey(refs) { return refs.join(' '); }
  function ovEstBtn(refs) {
    refs = refs.filter(function (r, i) { return ovEst(r) && refs.indexOf(r) === i; });
    if (!refs.length) return '';
    return '<button class="badge est" data-ov-est="' + esc(ovEstKey(refs)) + '">Estimate</button>';
  }
  function ovNeedBox(refs) {
    refs = refs.filter(function (r, i) { return ovEst(r) && refs.indexOf(r) === i; });
    if (!refs.length) return '';
    var seen = {}, h = '';
    refs.forEach(function (r) {
      ovNeeds(r).forEach(function (n) {
        var k = n.ref + n.need; if (seen[k]) return; seen[k] = 1;
        h += '<div class="ovneedrow">\u2610 ' + esc(String(n.need || '').replace(/^[\u2610\u2611\s]+/, '')) + (n.why ? '<small>' + esc(n.why) + '</small>' : '') + '</div>';
      });
    });
    if (!h) h = '<div class="ovneedrow">Needs a dated statement or document from Zac.</div>';
    var key = ovEstKey(refs);
    return '<div class="ovneed" data-ov-need="' + esc(key) + '"' + (ov.estOpen[key] ? '' : ' hidden') + '><b>Needed from Zac</b>' + h + '</div>';
  }
  function ovLink(text, label) {
    var u = ovUrl(label);
    return u ? '<a class="srcnum" data-title="' + esc(label || 'Document') + '" href="' + esc(u) + '">' + esc(text) + '</a>' : esc(text);
  }
  // one document figure: label, tappable value (opens the source), status badge + source name
  function ovRow(ref, label, cls) {
    var r = ov.idx[ref];
    if (!r) return '';
    var est = ovEst(ref), isDer = /^derived/i.test(r.status || '');
    var badge = est ? ovEstBtn([ref]) : '<span class="badge ' + (isDer ? 'dv' : 'ok') + '">' + (isDer ? 'Derived' : 'Verified') + '</span>';
    return '<div class="ovrow"><div class="ovl"><span>' + esc(label || ovLabel(r)) + '</span><small>' + badge + ' ' + esc(r.source || '') + '</small></div>' +
      '<div class="ovv' + (cls ? ' ' + cls : '') + '">' + ovLink(r.value, r.source) + '</div></div>' + (est ? ovNeedBox([ref]) : '');
  }
  // a computed figure (always from the document figures above / Vault); estBadge from the refs it uses
  function ovCalcRow(label, valHtml, cls, sub, refs) {
    var b = refs && refs.length ? ovEstBtn(refs) : '';
    return '<div class="ovrow calc"><div class="ovl"><span>' + esc(label) + '</span>' + (sub || b ? '<small>' + b + (b && sub ? ' ' : '') + (sub ? esc(sub) : '') + '</small>' : '') + '</div>' +
      '<div class="ovv' + (cls ? ' ' + cls : '') + '">' + valHtml + '</div></div>' + (refs && refs.length ? ovNeedBox(refs) : '');
  }
  function ovSum(label, val, cls, sub, open) {
    return '<div class="fxsum ovsum ' + (cls || '') + '" role="button" tabindex="0" data-ov-open="' + esc(open || '') + '"><div class="fxl">' + esc(label) + '</div><div class="fxv">' + esc(val) + '</div>' +
      (sub ? '<div class="fxs">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function ovSumRefs(refs) { var out = []; refs.forEach(function (r) { if (ov.idx[r] && ovEst(r)) out.push(r); }); return out; }
  function ovCashRefs() { return (ov.d.ledger || []).filter(function (r) { return /^cash\./.test(r.ref); }).map(function (r) { return r.ref; }); }
  function ovTot(refs) {
    var t = 0, ok = false;
    refs.forEach(function (r) { var n = ovN(r); if (n !== null) { t += n; ok = true; } });
    return ok ? t : null;
  }
  function ovDaysIn(off) { var t = new Date(); return new Date(t.getFullYear(), t.getMonth() + (Number(off) || 0) + 1, 0).getDate(); }

  // Vault numbers for the month on screen
  function ovVault() {
    if (ov.sp.s !== 'ok') return null;
    var d = ov.sp.data, M = spendModel(d), off = state.monthOffset, days = periodDays(off), dim = ovDaysIn(off);
    var logged = d.daysLogged != null ? Number(d.daysLogged) : days;
    var acct = function (n) { var a = M.accounts.filter(function (x) { return x.name === n; })[0]; return a ? a.amount : 0; };
    var reliable = days > 0 && logged >= 14, scale = days > 0 ? dim / days : 0;
    var hh = acct('Household');
    return { d: d, M: M, off: off, days: days, logged: logged, reliable: reliable, hh: hh,
      burn: reliable ? r2(hh * scale) : null, incM: reliable ? r2(M.incomeTotal * scale) : null, acct: acct };
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
    if (!V.reliable) h += '<div class="fxnote"><b>Not enough days yet</b> Fewer than 14 days are logged this month, so the runway and coverage below use the provisional burn from the Doc (badged Estimate) instead of the Vault.</div>';
    h += sheetLink('Open in spend sheet');
    return h;
  }
  function sumOf(list, src) { return r2(list.filter(function (x) { return x.source === src; }).reduce(function (s, x) { return s + x.amount; }, 0)); }

  function ovCashCard(V) {
    var cashRefs = ovCashRefs(), cash = ovTot(cashRefs), lo = ovN('buffer.low'), hi = ovN('buffer.high');
    var burnEst = ovN('hh.burn'), burn = V && V.burn !== null ? V.burn : burnEst, burnSrc = V && V.burn !== null;
    var h = '';
    h += ovCalcRow('Cash (7 accounts)', cash === null ? '\u2014' : ovWhole(cash), '', 'sum of the accounts below', cashRefs);
    h += collCard('ovcash', 'Accounts', cashRefs.length, cashRefs.map(function (r) { return ovRow(r); }).join(''), false, 'nest');
    h += ovRow('buffer.low') + ovRow('buffer.high');
    if (cash !== null && lo !== null && hi !== null) {
      h += ovCalcRow('Usable above buffer', ovWhole(cash - hi) + ' \u2013 ' + ovWhole(cash - lo), cash - hi >= 0 ? 'amt-in' : 'amt-out', 'cash \u2212 buffer (high \u2013 low)', cashRefs.concat(['buffer.low', 'buffer.high']));
    }
    if (burnSrc) h += '<div class="ovrow calc"><div class="ovl"><span>Household burn / mo</span><small><span class="badge ok">Vault</span> ' + esc(String(V.logged)) + ' days logged, scaled to the month</small></div>' +
      '<div class="ovv"><button class="ovgo amt-out" data-go="' + esc(acctRoute('Household')) + '">' + ovWhole(burn) + ' &rsaquo;</button></div></div>';
    else h += ovRow('hh.burn');
    if (cash !== null && burn) {
      var refs = cashRefs.concat(burnSrc ? [] : ['hh.burn']);
      h += ovCalcRow('Runway: all cash \u00f7 burn', ovMo(cash / burn), '', burnSrc ? 'Vault burn' : 'provisional burn', refs);
      if (lo !== null && hi !== null) h += ovCalcRow('Runway above buffer', ovMo(Math.max(0, cash - hi) / burn) + ' \u2013 ' + ovMo(Math.max(0, cash - lo) / burn), '', 'cash \u2212 buffer (high \u2013 low), \u00f7 burn', refs.concat(['buffer.low', 'buffer.high']));
    }
    return { html: h, cash: cash, burn: burn, burnSrc: burnSrc, runway: cash !== null && burn ? cash / burn : null, refs: cashRefs.concat(burnSrc ? [] : ['hh.burn']) };
  }

  function ovLoan(title, refs, key, openDefault) {
    return collCard(key, title, null, refs.map(function (r) { return ovRow(r); }).join(''), openDefault, 'nest');
  }

  function ovDebtCard(V, C) {
    var pays = ['wet.pay', 'mono.pay', 'all.pay'], ds = ovTot(pays), ds2 = ds !== null && ovN('all.pay2') !== null ? ds - ovN('all.pay') + ovN('all.pay2') : null;
    var h = ovRow('wet.pay', 'Wetumka \u00b7 Rocket (incl. escrow)') + ovRow('mono.pay', 'Mono Way \u00b7 Bank of Stockton') + ovRow('all.pay', 'Equipment \u00b7 Alliance (now)') + ovRow('all.pay2', 'Equipment \u00b7 Alliance (after reset)');
    h += ovCalcRow('Debt service / mo', ds === null ? '\u2014' : ovWhole(ds), 'amt-out', ds2 !== null ? 'after reset: ' + ovWhole(ds2) : '', []);
    var inc = 0, refs = [];
    if (V && V.M) {
      inc = V.M.incomeTotal || 0;
      h += '<div class="ovrow calc"><div class="ovl"><span>Vault income</span><small><span class="badge ok">Vault</span> logged this month so far</small></div><div class="ovv"><button class="ovgo amt-in" data-go="' + esc(incomeRoute('All')) + '">' + ovWhole(inc) + ' &rsaquo;</button></div></div>';
    } else h += '<div class="ovnote">Vault income is not loaded yet.</div>';
    h += ovCalcRow('Total income (month to date)', ovWhole(inc), 'amt-in', '', refs);
    if (ds !== null && inc > 0) h += ovCalcRow('Debt service \u00f7 income', Math.round(ds / inc * 100) + '%', '', 'lower is better', refs);
    if (ds !== null && C.burn) {
      var cf = inc - C.burn - ds;
      h += ovCalcRow('Monthly cash flow', signedMoney2(cf), cf >= 0 ? 'amt-in' : 'amt-out', 'income \u2212 household burn \u2212 debt service', refs.concat(C.burnSrc ? [] : ['hh.burn']));
      h += '<div class="ovnote">Indicative. If the household burn already includes the Wetumka mortgage, or the Vault TiwiK/KiwiT accounts already include the loan payments, those are counted twice.</div>';
    }
    return { html: h, ds: ds, ds2: ds2 };
  }
  function signedMoney2(v) { return (v >= 0 ? '+' : '\u2212') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US'); }

  function ovFlowCard() {
    var N = function (r) { var n = ovN(r); return n === null ? 0 : n; };
    var ldNet = N('ld.rev') - N('ld.util') - N('ld.rep') - N('ld.ins') - N('all.pay');
    var mwNet = N('mw.rent_lease') - N('mw.tax') - N('mw.ins') - N('mono.pay');
    var stNet = N('st.rent') - N('st.tax') - N('st.ins') - N('st.debt');
    var wet = -N('wet.pay');
    var cls = function (n) { return n >= 0 ? 'amt-in' : 'amt-out'; };
    var h = '<div class="fxgrp">Laundromat (TiwiK)</div>' + ['ld.rev', 'ld.util', 'ld.rep', 'ld.ins', 'all.pay'].map(function (r) { return ovRow(r, r === 'all.pay' ? 'Equipment loan payment / mo' : null); }).join('') +
      ovCalcRow('Laundromat net / mo', signedMoney2(ldNet), cls(ldNet), 'revenue \u2212 costs \u2212 loan payment', ['ld.rev', 'ld.util', 'ld.rep']);
    h += '<div class="fxgrp">Mono Way (KiwiT)</div>' + ['mw.rent_lease', 'mw.tax', 'mw.ins', 'mono.pay'].map(function (r) { return ovRow(r, r === 'mono.pay' ? 'Mortgage payment / mo' : null); }).join('') +
      ovCalcRow('Mono Way net / mo', signedMoney2(mwNet), cls(mwNet), 'rent \u2212 tax \u2212 insurance \u2212 mortgage', ['mw.tax']);
    h += '<div class="fxgrp">Stewart Street (KiwiT)</div>' + ['st.rent', 'st.tax', 'st.ins', 'st.debt'].map(function (r) { return ovRow(r); }).join('') +
      ovCalcRow('Stewart Street net / mo', signedMoney2(stNet), cls(stNet), 'rent \u2212 tax \u2212 insurance \u2212 loan', ['st.rent', 'st.tax', 'st.ins', 'st.debt']);
    h += '<div class="fxgrp">Wetumka</div>' + ovCalcRow('Rocket Mortgage payment / mo', signedMoney2(wet), 'amt-out', 'verified payment', []);
    var tot = ldNet + mwNet + stNet + wet;
    h += ovCalcRow('Combined / mo', signedMoney2(tot), cls(tot), 'sum of the four lines above', ['ld.rev', 'ld.util', 'ld.rep', 'mw.tax', 'st.rent', 'st.tax', 'st.ins', 'st.debt']);
    return h;
  }

  function ovNetWorth() {
    var cashRefs = ovCashRefs(), cash = ovTot(cashRefs);
    var aRefs = ['inv.af', 'inv.etrade', 're.total', 'eq.value'], dRefs = ['wet.bal', 'mono.bal', 'all.bal'];
    var assets = ovTot(aRefs.concat(cash === null ? [] : [])) , debt = ovTot(dRefs);
    if (assets === null) assets = 0;
    if (cash !== null) assets += cash;
    var nw = debt === null ? null : assets - debt;
    var h = ovCalcRow('Cash (7 accounts)', cash === null ? '\u2014' : ovWhole(cash), '', 'see Cash & runway', cashRefs) + aRefs.map(function (r) { return ovRow(r); }).join('');
    h += ovCalcRow('Total assets', ovWhole(assets), '', '', cashRefs.concat(aRefs));
    h += dRefs.map(function (r) { return ovRow(r, { 'wet.bal': 'Wetumka \u00b7 Rocket Mortgage', 'mono.bal': 'Mono Way \u00b7 Bank of Stockton (KiwiT)', 'all.bal': 'Equipment \u00b7 Alliance (TiwiK)' }[r], 'amt-out'); }).join('');
    h += ovCalcRow('Total debt', debt === null ? '\u2014' : ovWhole(debt), 'amt-out', '', []);
    if (nw !== null) h += ovCalcRow('Net worth', ovWhole(nw), nw >= 0 ? 'amt-in' : 'amt-out', 'assets \u2212 debt', cashRefs.concat(aRefs));
    h += ovRow('bos.cl.limit') + ovRow('bos.heloc.limit') + '<div class="ovnote">The two unused Bank of Stockton lines are not in net worth.</div>';
    return { html: h, assets: assets, debt: debt, nw: nw, refs: cashRefs.concat(aRefs) };
  }

  // Investments (E*TRADE from the live Balances rows, American Funds from the Doc as an Estimate): the Vault Accounts no longer lists them.
  function ovInvCard() {
    var M = ovModel(), c = M.invC || [];
    if (!c.length) return '<div class="foot">No investment balances yet.</div>';
    return c.map(ovCompRow).join('') + '<div class="ovrow calc"><div class="ovl"><span>Investments total</span></div><div class="ovv"><span class="amt-bal">' + ovWhole(M.invTotal) + '</span></div></div>' +
      '<button class="bigbtn ovlink" ' + goAttr(balRoute('g:Investments')) + '>Investment balances (Balances tab rows) &rsaquo;</button>' +
      '<div class="ovnote">Counted in Net worth and Total assets. Not in Cash, the Vault Accounts total or reconciliation.</div>';
  }
  function ovNeedsCard() {
    var needs = ov.d.needs || [];
    if (!needs.length) return '';
    return collCard('ovneeds', 'Needs from Zac', needs.length, needs.map(function (n) {
      var firstRef = String(n.ref || '').split(/[,\s]+/)[0], row = ov.idx[firstRef];
      return '<div class="todorow ovneedit"><div class="fxtdh"><span>' + esc(String(n.need || '').replace(/^[\u2610\u2611\s]+/, '')) + '</span></div>' +
        (n.why ? '<div class="ovwhy">' + esc(n.why) + '</div>' : '') +
        (row ? '<div class="ovwhy">' + ovEstBtn([firstRef]) + ' ' + ovLink(row.value, row.source) + '</div>' : '') + '</div>';
    }).join(''), false);
  }

  // ---- Headline numbers (v46): live model + tap-through detail ----
  // Each headline is built from components. A component is Vault-backed when its value comes from the Vault (Accounts balances, Debt
  // loans, logged income / spend) and otherwise comes from the Overview Doc ledger. Where the Vault has a real number it replaces the
  // Doc's (often Estimate) one and any difference is flagged. No figures live in this file.
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
  var OV_RANK = { ver: 0, der: 1, est: 2 };
  var OV_STOP = { account: 1, accounts: 1, the: 1, and: 1, of: 1, llc: 1, inc: 1, business: 1, personal: 1, acct: 1, s: 1 };
  function ovTagOf(s) { s = String(s || ''); return /^verified/i.test(s) ? 'ver' : /^derived/i.test(s) ? 'der' : 'est'; }
  function ovTagBadge(tag, ref) {
    if (tag === 'est' && ref && ov.idx[ref] && ovEst(ref)) return ovEstBtn([ref]);
    return '<span class="badge ' + (tag === 'ver' ? 'ok' : tag === 'der' ? 'dv' : 'est') + '">' + (tag === 'ver' ? 'Verified' : tag === 'der' ? 'Derived' : 'Estimate') + '</span>';
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
    return { id: ref, ref: ref, label: label || ovLabel(r), val: ovN(ref), tag: ovTagOf(r.status), vault: false, src: r.source || 'Overview Doc', docSrc: r.source || '' };
  }
  function ovAcctComp(a) {
    return { id: a.name, label: a.name, val: a.balance, tag: 'ver', vault: true, src: 'Vault Accounts \u00b7 ' + a.name, asOf: a.asOf, go: balRoute(a.name), vsec: 'accounts', goLabel: 'Vault Accounts' };
  }
  function ovInvComp(a) {
    return { id: a.name, label: a.name, val: a.balance, tag: 'ver', vault: true, src: 'Vault Balances \u00b7 ' + a.name, asOf: a.asOf, go: balRoute(a.name), goLabel: 'Balances' };
  }
  function ovApplyInv(c, m) {   // live Investments row replaces the Doc value (never both); a difference is flagged
    if (!c) return null;
    if (!m.a) { if (m.n > 1) c.note = 'The Vault has ' + m.n + ' investment rows that could match, so the Doc figure is used.'; return c; }
    var o = ovInvComp(m.a);
    o.id = c.id; o.ref = c.ref; o.label = c.label; o.vaultName = m.a.name;
    if (c.val !== null && Math.abs(c.val - m.a.balance) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: m.a.balance };
    return o;
  }
  function ovApplyAcct(c, m) {
    if (!c) return null;
    if (!m.a) { if (m.n > 1) c.note = 'The Vault has ' + m.n + ' accounts that could match, so the Doc figure is used.'; return c; }
    var o = ovAcctComp(m.a);
    o.id = c.id; o.ref = c.ref; o.label = c.label; o.vaultName = m.a.name;
    if (c.val !== null && Math.abs(c.val - m.a.balance) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: m.a.balance };
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
    if (c.val !== null && Math.abs(c.val - o.val) >= 1) o.mismatch = { doc: c.val, docTag: c.tag, ref: c.ref, vault: o.val };
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
    return ['ver', 'der', 'est'][r];
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
      cls: o.cls || '', fmt: o.fmt || 'money', vsecs: o.vsecs || [], sub: o.sub || '', extra: o.extra || '' };
    h.cov = ovCov(comps); h.tag = ovWorstTag(comps); h.asOf = ovAsOf(comps);
    comps.forEach(function (c) {
      if (c.agg) { (c.flags || []).forEach(function (f) { h.flags.push(f); }); }
      else if (c.mismatch) h.flags.push({ label: c.label, vault: c.mismatch.vault, doc: c.mismatch.doc, docTag: c.mismatch.docTag, ref: c.mismatch.ref, inline: true });
      if (c.flag) h.flags.push(c.flag);
    });
    (o.flags || []).forEach(function (f) { h.flags.push(f); });
    return h;
  }
  function ovAgg(head, label, sign) {
    return { agg: true, key: head.key, label: label, val: head.val === null ? null : sign * head.val, tag: head.tag, cov: head.cov, flags: head.flags, go: 'fin/overview/' + head.key, fmt: head.fmt, cls: head.cls };
  }

  function ovModel() {
    var f = ov.fin, hasL = !!(f.s === 'ok' && f.data && Array.isArray(f.data.ledger) && f.data.ledger.length);
    if (hasL) ovIndex(f.data); else ov.idx = {};
    var V = ovVault(), A = state.acct && state.acct.d ? state.acct.d : null, D = state.debt && state.debt.d ? state.debt.d : null;
    var claimed = [], M = { hasL: hasL, V: V, A: A, D: D, heads: {}, leftover: [] };
    // ---- Cash + investments (Vault Accounts first, Doc as fallback) ----
    var cashC = [], invC = [], reC = [], eqC = [], invClaimed = [];
    if (hasL) {
      ovCashRefs().forEach(function (ref) { var c = ovDocComp(ref), m = ovFindAcct(A, c.label, claimed); if (m.a) claimed.push(m.a); cashC.push(ovApplyAcct(c, m)); });
      ['inv.af', 'inv.etrade'].forEach(function (ref) {
        var c = ovDocComp(ref); if (!c) return;
        var m = ovFindAcct(A, c.label, invClaimed, 'investments'); if (m.a) invClaimed.push(m.a);
        c = ovApplyInv(c, m);
        if (!c.vault) { c.tag = 'est'; if (ref === 'inv.af') c.note = c.note || 'Unverified estimate. Not in the Vault; shown here with the other investments.'; }
        invC.push(c);
      });
      if (A) (A.investments || []).forEach(function (a) { if (a.balance !== null && invClaimed.indexOf(a) < 0) invC.push(ovInvComp(a)); });   // any other live Investments row counts too
      reC = [ovDocComp('re.total')]; eqC = [ovDocComp('eq.value')];
      if (A) M.leftover = A.accounts.filter(function (a) { return a.balance !== null && claimed.indexOf(a) < 0; });
    } else if (A) {
      A.accounts.forEach(function (a) { if (a.balance !== null && !ovIsInv(a)) cashC.push(ovAcctComp(a)); });
      (A.investments || []).forEach(function (a) { if (a.balance !== null) invC.push(ovInvComp(a)); });
    }
    invC = invC.filter(function (c) { return c && c.val !== null; });
    M.invC = invC; M.invTotal = invC.length ? ovSumC(invC) : null;
    cashC = cashC.filter(function (c) { return c && c.val !== null; });
    var cashNotes = [];
    if (M.leftover.length) cashNotes.push('Vault accounts not in the Overview Doc list (not counted): ' + M.leftover.map(function (a) { return a.name + ' ' + ovWhole(a.balance); }).join(', ') + '.');
    var cashInfo = [];
    if (hasL) { cashInfo = [ovDocComp('buffer.low'), ovDocComp('buffer.high')].filter(function (c) { return c; }); }
    var cashV = cashC.length ? ovSumC(cashC) : null;
    M.heads.cash = ovHead('cash', cashC, { val: cashV, cls: 'amt-bal', notes: cashNotes, vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }],
      groups: [{ title: 'Accounts', comps: cashC }, cashInfo.length ? { title: 'Working buffer (Overview Doc)', comps: cashInfo, info: true } : null].filter(function (g) { return g; }),
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
    var ds = payC.length ? ovSumC(payC) : null, ds2 = null;
    if (ds !== null) {
      var nx = payC.filter(function (c) { return c.next != null; });
      if (nx.length) ds2 = ds - ovSumC(nx.map(function (c) { return { val: c.val }; })) + ovSumC(nx.map(function (c) { return { val: c.next }; }));
    }
    M.heads.ds = ovHead('ds', payC, { val: ds, cls: 'amt-out', gtitle: 'Monthly payments', sub: ds2 !== null ? 'after reset: ' + ovWhole(ds2) : '',
      notes: ds2 !== null ? ['After the Alliance reset the monthly total becomes ' + ovWhole(ds2) + '.'] : [], vsecs: [{ label: 'Open Vault Debt', route: 'spend', vsec: 'debt' }] });
    // ---- Income + burn (Vault logged data first, Doc as fallback) ----
    var scale = V && V.days > 0 ? ovDaysIn(V.off) / V.days : 1, incC = [], incInfo = [], incNotes = [], incFlags = [], incVal = null;
    var k1 = hasL ? ovDocComp('inc.k1') : null, w2 = hasL ? ovDocComp('inc.w2') : null;
    var docInc = k1 && w2 && k1.val !== null && w2.val !== null ? (k1.val + w2.val) / 12 : null;
    var docIncTag = k1 && w2 ? ovWorstTag([k1, w2]) : 'est';
    // Income is Vault-logged only (no K-1 / W-2): actual income logged so far in the month on screen.
    if (V) {
      V.M.sources.forEach(function (s) {
        if (!s.amount) return;
        incC.push({ id: 'inc-' + s.name, label: s.label, val: r2(s.amount), tag: 'ver', vault: true,
          src: 'Vault Income \u00b7 logged ' + (V.logged ? V.logged + ' day' + (V.logged === 1 ? '' : 's') + ' into the month' : 'this month'), go: incomeRoute(s.name), goLabel: 'Vault income' });
      });
      incVal = incC.length ? ovSumC(incC) : 0;
      incNotes.push('Only income logged in the Vault is counted, month to date. No K-1 or W-2.');
    } else {
      incNotes.push('The live Vault income is not loaded yet.');
    }
    M.heads.inc = ovHead('inc', incC, { val: incVal, cls: 'amt-in', fmt: 'money', gtitle: 'Income by source (logged)',
      groups: [{ title: 'Income by source (logged)', comps: incC }],
      notes: incNotes, flags: incFlags, sub: 'Vault logged, month to date', vsecs: [{ label: 'Open Vault income', route: incomeRoute('All') }] });
    var burnC = [], burnInfo = [], burnNotes = [], burnFlags = [], burnVal = null, hhDoc = hasL ? ovDocComp('hh.burn') : null;
    var hhAcct = V ? V.M.accounts.filter(function (a) { return a.name === 'Household'; })[0] : null;
    if (V && V.reliable) {
      (hhAcct ? hhAcct.cats : []).forEach(function (c) {
        burnC.push({ id: 'b-' + c.name, label: c.name, val: r2(c.amount * scale), tag: scale === 1 ? 'ver' : 'der', vault: true,
          src: 'Vault spend \u00b7 ' + money(c.amount) + ' logged', go: catRoute(c.name, 'Household'), goLabel: 'Vault spend' });
      });
      if (!burnC.length && V.hh) burnC.push({ id: 'b-hh', label: 'Household spend', val: r2(V.hh * scale), tag: scale === 1 ? 'ver' : 'der', vault: true, src: 'Vault spend \u00b7 ' + money(V.hh) + ' logged', go: acctRoute('Household') });
      burnVal = V.burn;
      if (hhDoc && hhDoc.val !== null) {
        burnInfo.push({ id: 'dburn', label: 'Provisional burn (Overview Doc)', val: hhDoc.val, tag: hhDoc.tag, vault: false, src: hhDoc.src, ref: hhDoc.ref, docSrc: hhDoc.docSrc });
        if (burnVal !== null && Math.abs(burnVal - hhDoc.val) > 0.1 * Math.max(hhDoc.val, 1)) burnFlags.push({ label: 'Household burn / mo', vault: burnVal, doc: hhDoc.val, docTag: hhDoc.tag, ref: hhDoc.ref });
      }
    } else if (hhDoc && hhDoc.val !== null) {
      burnC.push(hhDoc); burnVal = hhDoc.val;
      burnNotes.push(V ? 'The Vault has fewer than 14 days logged this month, so the provisional Doc burn is used until it fills in.' : 'The live Vault spend is not loaded, so the provisional Doc burn is used.');
      if (V && V.hh) burnInfo.push({ id: 'vmtd', label: 'Vault Household spend so far', val: V.hh, tag: 'ver', vault: true, src: 'Vault spend \u00b7 ' + V.logged + ' days logged', go: acctRoute('Household') });
    }
    M.heads.burn = ovHead('burn', burnC, { val: burnVal, cls: 'amt-out', gtitle: V && V.reliable ? 'Household spend by category (logged)' : 'Overview Doc',
      groups: [{ title: V && V.reliable ? 'Household spend by category (logged)' : 'Overview Doc', comps: burnC }, burnInfo.length ? { title: V && V.reliable ? 'Overview Doc comparison (not counted)' : 'For reference', comps: burnInfo, info: true } : null].filter(function (g) { return g; }),
      notes: burnNotes, flags: burnFlags, sub: V && V.reliable ? 'Vault logged' : 'Doc estimate', vsecs: [{ label: 'Open Household spend', route: acctRoute('Household') }] });
    // ---- Composite headlines ----
    var H = M.heads, hasDebtOrDoc = H.debt.val !== null;
    var assetsC = [];
    if (cashC.length) assetsC.push(ovAgg(H.cash, 'Cash (' + cashC.length + (cashC.length === 1 ? ' account' : ' accounts') + ')', 1));
    reC.concat(eqC).forEach(function (c) { if (c && c.val !== null) assetsC.push(c); });
    var invTot = M.invTotal;
    var assetsAll = assetsC.concat(invC);
    var assets = assetsAll.length ? ovSumC(assetsAll) : null;
    var nwVal = hasL && assets !== null && hasDebtOrDoc ? assets - H.debt.val : null;
    var nwComps = assetsAll.concat(balC);
    M.heads.nw = ovHead('nw', nwComps, { val: nwVal, cls: nwVal !== null && nwVal < 0 ? 'amt-out' : 'amt-in', sub: '',
      groups: [{ title: 'Assets', comps: assetsC },
        { title: 'Investments', comps: invC, total: invTot === null ? null : { label: 'Investments subtotal', val: invTot, cls: 'amt-bal' } },
        { title: '', comps: [], total: assets === null ? null : { label: 'Total assets', val: assets, cls: 'amt-bal' } },
        { title: 'Debt', comps: balC, total: H.debt.val === null ? null : { label: 'Total debt', val: H.debt.val, cls: 'ov-debt' } }],
      notes: hasL ? ['The two unused Bank of Stockton lines (commercial line, HELOC) are not in net worth.', 'Investments (E*TRADE live from the Balances tab, American Funds from the Overview Doc) count here, not in the Vault Accounts or Cash.'] : ['Net worth needs the Overview Doc figures (real estate, equipment), which are not loaded.'],
      vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }, { label: 'Open Vault Debt', route: 'spend', vsec: 'debt' }] });
    M.heads.nw.cov = ovCov(assetsAll.concat(balC));
    var runVal = H.cash.val !== null && H.burn.val ? H.cash.val / H.burn.val : null, runRange = '';
    var bl = hasL ? ovN('buffer.low') : null, bh = hasL ? ovN('buffer.high') : null;
    if (runVal !== null && bl !== null && bh !== null) runRange = ovMo(Math.max(0, H.cash.val - bh) / H.burn.val) + ' \u2013 ' + ovMo(Math.max(0, H.cash.val - bl) / H.burn.val);
    var runC = [ovAgg(H.cash, 'Cash', 1), H.burn.val !== null ? ovAgg(H.burn, 'Household burn / mo', 1) : null];
    M.heads.runway = ovHead('runway', runC, { val: runVal, fmt: 'mo', cls: '', sub: runRange ? 'above buffer: ' + runRange : '',
      notes: runRange ? ['Above the working buffer (high \u2013 low): ' + runRange + '.'] : [], vsecs: [{ label: 'Open Vault Accounts', route: 'spend', vsec: 'accounts' }] });
    var flowVal = H.inc.val !== null && H.burn.val !== null && H.ds.val !== null ? H.inc.val - H.burn.val - H.ds.val : null;
    M.heads.flow = ovHead('flow', [ovAgg(H.inc, 'Income / mo', 1), ovAgg(H.burn, 'Household burn / mo', -1), ovAgg(H.ds, 'Debt service / mo', -1)], { val: flowVal, fmt: 'signed',
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
    var out = [], a = state.acct, d = state.debt, fb = hasL ? ' Doc figures are used.' : '';
    if (a && a.s === 'load' && !a.d) out.push('Loading Vault balances\u2026');
    else if (a && a.s === 'na') out.push('Vault Accounts is not available from the server yet.' + fb);
    else if (a && a.s === 'err' && !a.d) out.push('Vault Accounts could not load.' + fb);
    if (d && d.s === 'load' && !d.d) out.push('Loading Vault loans\u2026');
    else if (d && d.s === 'na') out.push('Vault Debt is not available from the server yet.' + fb);
    else if (d && d.s === 'err' && !d.d) out.push('Vault Debt could not load.' + fb);
    return out;
  }
  function ovTile(h) {
    var m = OV_HEADS[h.key], none = h.val === null;
    var sub = none ? 'not available yet' : h.sub;
    return '<div class="fxsum ovsum ovt ' + (none ? 'none' : '') + '" role="button" tabindex="0" data-go="fin/overview/' + h.key + '"><div class="fxl">' + esc(m.tile) + (h.flags.length ? ' <span class="ovwarn" title="Doc and Vault differ">!</span>' : '') + '</div>' +
      '<div class="fxv ' + esc(h.cls) + '">' + esc(ovFmt(h, h.val)) + '</div>' +
      (sub ? '<div class="fxs">' + esc(sub) + '</div>' : '') +
      '<div class="ovtm">' + (none ? '' : ovTagBadge(h.tag, '').replace(/<span class="badge/, '<span class="badge sm') + ' ' + ovCovChip(h.cov, true)) + '</div></div>';
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
    return '<div class="ovflag"><b>' + esc(fl.label) + '</b> Overview Doc says ' + ovWhole(fl.doc) + ' (' + (fl.docTag === 'ver' ? 'Verified' : fl.docTag === 'der' ? 'Derived' : 'Estimate') + '); live Vault says ' + ovWhole(fl.vault) +
      ' (' + signedMoney2(diff) + '). The Vault number is used.</div>';
  }
  function ovCompRow(c) {
    var left = '<span>' + esc(c.label) + '</span>', meta = [];
    if (c.agg) meta.push(ovTagBadge(c.tag, '') + ' ' + ovCovChip(c.cov, true));
    else {
      meta.push(ovTagBadge(c.tag, c.ref && !c.vault ? c.ref : ''));
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
    if (c.tag === 'est' && c.ref && !c.vault) h += ovNeedBox([c.ref]);
    return h;
  }
  function ovDetailHtml(key) {
    var f = ov.fin, M, H, m = OV_HEADS[key], h = '';
    if (f.s === 'load' && !f.data && !state.acct) return '<div class="loading">Loading\u2026</div>';
    M = ovModel(); H = M.heads[key];
    if (!H) return '<div class="error">Unknown figure.</div>';
    var cls = H.cls || '';
    h += '<div class="card ovhd"><div class="ovhl">' + esc(m.title) + '</div><div class="ovhv ' + esc(cls) + '">' + esc(ovFmt(H, H.val)) + '</div>';
    if (H.val === null) h += '<div class="ovnote">Not available yet. The sources it needs have not loaded or are missing.</div>';
    else h += '<div class="ovhm">' + ovTagBadge(H.tag, '') + ' ' + ovCovChip(H.cov, false) + '</div>';
    h += '<div class="ovnote">' + esc(H.calc) + (H.asOf ? ' \u00b7 Vault data as of ' + esc(H.asOf[0] === H.asOf[1] ? acDate(H.asOf[0]) : acDate(H.asOf[0]) + ' \u2013 ' + acDate(H.asOf[1])) : '') + '</div>';
    if (H.tag === 'est' && H.val !== null) h += '<div class="ovnote">Tagged Estimate because at least one component is an Estimate.</div>';
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
    if (!loadingL) h += ovStripHtml(ovModel());
    h += ovSummaryHtml(V);
    if (ok) {
      C = ovCashCard(V); D = ovDebtCard(V, C); NW = ovNetWorth();
      h += statusCard(d.status) + todoCards(d.todo || [], 'ov');
    }
    h += collCard('ovlive', 'Live Vault \u00b7 income & spend', null, ovVaultCard(V), true);
    if (ok) {
      h += collCard('ovcashc', 'Cash & runway', null, C.html, false);
      h += collCard('ovdebt', 'Debt service vs income', null, D.html, false);
      h += collCard('ovliab', 'Liabilities', 3, ovLoan('Wetumka \u00b7 Rocket Mortgage', ['wet.bal', 'wet.rate', 'wet.pay', 'wet.pi', 'wet.escrow', 'wet.due', 'wet.maturity'], 'ovl-wet', false) +
        ovLoan('Mono Way \u00b7 Bank of Stockton (KiwiT)', ['mono.bal', 'mono.orig', 'mono.rate', 'mono.pay', 'mono.maturity'], 'ovl-mono', false) +
        ovLoan('Equipment \u00b7 Alliance (TiwiK)', ['all.bal', 'all.rate', 'all.pay', 'all.pay2', 'all.maturity', 'all.payoff'], 'ovl-all', false), false);
      h += collCard('ovinv', 'Investments', null, ovInvCard(), false);
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

  /* ---------------- Init ---------------- */
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
