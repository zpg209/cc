/* Command Center — static front end for GitHub Pages.
 * Data comes from the passcode-protected Apps Script JSON API (Api.gs).
 * The passcode is typed by the user and kept only in this device's localStorage. */
(function () {
  'use strict';

  // Public web app URL of the separate "Anyone" API deployment (the passcode protects the data).
  var API_URL = 'https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec';
  var PC_KEY = 'cc_passcode';
  var FALLBACK_URL = 'https://script.google.com/a/macros/landstruc.com/s/AKfycbyigotJxdJD3CeCpRyCEfhHdL7zcv2ZE_ibTm2ZyITgODqrh_NxGhONx6m8CcBlxaPD/exec';

  var state = { weekOffset: 0, monthOffset: 0, links: null, logSeq: 0, spendSeq: 0,
    spendData: null, spendDataOff: null, spendRoute: { kind: '', val: '', acct: '' },
    biz: null, bizSlug: '', docFrom: 'home', docPushed: false, scrollMem: {}, docTimer: 0,
    docSeq: 0, docKey: '', proxyOff: false, reData: null, reAt: 0, insData: null, insAt: 0, reRoute: { ins: false, slug: '' }, ltPart: '', ltCache: {}, ltOpen: {},
     folderCache: {}, docUrls: [], pdf: null, pdfObserver: null, finKind: '', insSlug: '', spendFrom: '', projSlug: 'terravi' };
  var SCREENS = ['lock', 'home', 'projects', 'life', 'log', 'spend', 'biz', 'doc', 're', 'lt', 'proj', 'notes', 'mic', 'docs', 'fin', 'insn'];

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
  // Routes: "home", "log", "spend", "spend/cat/<Category>[/<Account>]", "spend/acct/<Account>",
  //         "spend/income/<Source|All>", "spend/all", "spend/cash/<Account|All>[/<Category>]",
  //         "spend/who/<Zac|Lisa>", "spend/calc/<tiwik-net|lt-net|hh-spend|avg-spend|avg-income>"   (segments are URI-encoded)
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
      ((sr.kind === 'cat' || sr.kind === 'cash') && sr.acct ? '/' + encodeURIComponent(sr.acct) : '');
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
      if (cur === 'fin') { state.spendFrom = state.finKind === 'laundromat' ? 'fin/laundromat' : state.finKind === 'overview' ? 'fin/overview' : ''; if (state.finKind) state.scrollMem['fin/' + state.finKind] = window.scrollY || 0; }
      else if (cur !== 'spend' && cur !== 'doc') state.spendFrom = '';
      var okKind = R.kind === 'all' || (/^(cat|acct|income|cash|who|calc)$/.test(R.kind) && R.val);
      state.spendRoute = okKind ? { kind: R.kind, val: R.kind === 'all' ? '' : R.val, acct: (R.kind === 'cat' || R.kind === 'cash') ? R.acct : '' }
        : { kind: '', val: '', acct: '' };
    }
    if (name === 'fin') state.finKind = (R.kind === 'overview' || R.kind === 'laundromat') ? R.kind : '';
    if (name === 'insn') state.insSlug = R.kind || '';
    if (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs') projSetup(R.kind);
    if (name !== 'mic') micStop(true);
    if (name !== 'doc') { state.docPushed = false; state.docSeq++; closeDoc(); }
    activate(name);
    if (!fromHistory) {
      if (name === 'biz') state.bizSlug = R.kind;
      var h = name === 'home' ? '' : name === 'spend' ? spendHash(state.spendRoute) :
        name === 'biz' && R.kind ? '#biz/' + encodeURIComponent(R.kind) :
        name === 'doc' ? '#doc?' + R.query :
        (name === 'proj' || name === 'notes' || name === 'mic' || name === 'docs') ? '#' + name + '/' + state.projSlug :
        name === 'fin' ? '#fin' + (state.finKind ? '/' + state.finKind : '') :
        name === 'insn' ? '#insn' + (state.insSlug ? '/' + encodeURIComponent(state.insSlug) : '') :
        name === 'lt' ? '#lt' + (R.kind ? '/' + encodeURIComponent(R.kind) : '') :
        name === 're' ? (state.reRoute.ins ? '#ins' : '#re' + (state.reRoute.slug ? '/' + encodeURIComponent(state.reRoute.slug) : '')) : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects' || name === 'life') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'spend') loadSpend(false);
    if (name === 'biz') { state.bizSlug = R.kind; loadBiz(); }
    if (name === 're') loadRe();
    if (name === 'proj') renderProj();
    if (name === 'notes') openNotes();
    if (name === 'mic') openMic();
    if (name === 'docs') openDocs();
    if (name === 'fin') loadFin(false);
    if (name === 'insn') loadInsn(false);
    if (name === 'lt') { state.ltPart = LT_PARTS[R.kind] ? R.kind : ''; loadLt(); }
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
    $('life-list').innerHTML = d.lifeAreas.map(function (a) {
      if (/^real estate$/i.test(a.name)) { state.reFolderUrl = a.url; return '<button class="tile small" data-go="re">' + esc(a.name) + '<span class="sub">3 properties</span></button>'; }
      if (/^lisa.s table$/i.test(a.name)) { state.ltFolderUrl = a.url; return '<button class="tile small" data-go="lt">' + esc(a.name) + '<span class="sub">Menus · recipes · macros</span></button>'; }
      if (/^insurance$/i.test(a.name)) { state.insFolderUrl = a.url; return '<button class="tile small" data-go="insn">' + esc(a.name) + '<span class="sub">Policies · renewals · to do</span></button>'; }
      if (/^financial$/i.test(a.name)) { state.finFolderUrl = a.url; return '<button class="tile small" data-go="fin">Finances<span class="sub">Overview · TiwiK laundromat</span></button>'; }
      if (/^business$/i.test(a.name)) { state.bizFolderUrl = a.url; return '<button class="tile small" data-go="biz">' + esc(a.name) + '<span class="sub">3 businesses</span></button>'; }
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
    api('log', state.weekOffset).then(function (d) { if (seq === state.logSeq) renderLog(d); },
      function (err) { if (seq === state.logSeq) { $('log-range').textContent = ''; onFail(['log-body'], loadLog)(err); } });
  }

  function renderLog(d) {
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
        notes: x.notes || '', account: normAcct(x.account) };
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
    var srcNames = [PT_SOURCE, INCOME_SOURCES[0], LS_SOURCE, INCOME_SOURCES[1]];   // fixed display order; each shown even at $0
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
  var SHEET_GIDS = { spend: '555034', income: '1698769561', pt: '993449402', ls: '' };   // Daily Spend / Income / Personal Training tabs
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
      return '<div class="entry item"><div class="d">' + esc(e.label) + '<br>' + esc(e.who) + '</div>' +
        '<div class="m"><div class="mer">' + esc(e.merchant || '—') + '</div>' +
        '<div class="meta">' + (opt.chip ? '<button class="chip"' + goAttr(catRoute(e.category)) + '>' + esc(e.category) + '</button>' : '') +
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
  function vSec(key, cls, title, totHtml, route, body) {
    var open = !!vOpenMap()[key];
    return '<div class="card ncard vsec ' + cls + (open ? ' open' : '') + '" data-vs="' + esc(key) + '">' +
      '<div class="vhead"><button class="nchead vtoggle" aria-expanded="' + open + '"><span>' + title + '</span></button>' +
      '<button class="vtot"' + goAttr(route) + '>' + totHtml + '</button>' +
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

    if (!sr.kind) {
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

      // Income group: one collapsible card per source (heading + green total; heading toggles, total drills down), then Total income.
      h += '<div class="incgroup">';
      M.sources.forEach(function (sx) {
        var l = M.income.filter(function (x) { return x.source === sx.name; });
        var ds = DETAIL_SRC[sx.name];
        var b = incCompact(l, !!ds) +
          sheetLink('Open in spend sheet', ds ? ds.tab : 'income', ds && ds.tab === 'ls' ? M.lsGid : '');
        h += vSec('inc-' + sx.name, 'income incsrc', esc(sx.label), '<span class="amt-in">' + money(sx.amount) + '</span>', incomeRoute(sx.name), b);
      });
      h += '<button class="card incTotal"' + goAttr(incomeRoute('All')) + '><span class="n">Total income</span><span class="amt amt-in">' + money(M.incomeTotal) + '</span><span class="chev">&rsaquo;</span></button>';
      h += '</div>';

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

      if (M.who.length) h += vSec('who', '', 'Household \u00b7 Zac vs Lisa', '<span class="amt-out">' + money(sum(M.who)) + '</span>', acctRoute('Household'),
        '<div class="split">' + M.who.map(function (w) { return '<button class="splitbtn"' + goAttr(whoRoute(w.name)) + '><b class="amt-out">' + money(w.amount) + '</b>' + esc(w.name) + '</button>'; }).join('') + '</div>');

      h += '<button class="linkrow allbtn"' + goAttr('spend/all') + '>All items (' + M.entryCount + ') &rsaquo;</button>';
      h += sheetLink('Open in spend sheet');
      if (d.missingColumns && d.missingColumns.length) h += '<div class="foot">Columns not found: ' + esc(d.missingColumns.join(', ')) + '</div>';

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
    $('lt-back').setAttribute('data-go', part ? 'lt' : 'life');
    $('lt-title').textContent = cfg ? cfg.label : 'Lisa\u2019s Table';
    $('lt-title').classList.toggle('sub', !!part);
    if (!cfg) {
      $('lt-body').innerHTML = '<div class="grid2">' + LT_ORDER.map(function (k) {
        return '<button class="tile" data-go="lt/' + k + '">' + esc(LT_PARTS[k].label) + '</button>';
      }).join('') + '</div>' + (state.ltFolderUrl ? '<a class="linkrow" data-title="Lisa\u2019s Table" href="' + esc(state.ltFolderUrl) + '">Open Lisa\u2019s Table folder &rsaquo;</a>' : '');
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
  function draftKey() { return 'cc_note_draft_' + state.projSlug; }      // per project (Terra Vi keeps its original key)
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
    var prev = state.projSlug;
    state.projSlug = PROJ[slug] ? slug : 'terravi';
    var s = state.projSlug, p = PROJ[s];
    if (prev !== s) {                 // switched project: drop the other project's cached notes / documents / half-typed text
      notes.data = null; notes.entries = []; notes.seq++; notes.at = 0;
      docs.data = null; docs.seq++; docs.at = 0;
      if (!mic.on) { var ta = $('note-text'); if (ta) ta.value = ''; var rc = $('note-recovered'); if (rc) rc.hidden = true; }
    }
    ['proj', 'notes', 'mic', 'docs'].forEach(function (k) {
      var t = $(k + '-title'); if (t) t.textContent = p.name + (k === 'proj' ? '' : ' \u00b7 ' + { notes: 'Running notes', mic: 'Dictate a note', docs: 'Documents' }[k]);
    });
    ['notes', 'mic', 'docs'].forEach(function (k) { $(k + '-back').setAttribute('data-go', 'proj/' + s); });
    document.querySelectorAll('[data-pgo]').forEach(function (el) { el.setAttribute('data-go', el.getAttribute('data-pgo') + '/' + s); });
  }
  function renderProj() {
    $('proj-doc').href = projDocUrl();
    $('proj-doc').setAttribute('data-title', curProj().name + ' \u2014 Running Notes');
    var pl = $('proj-punch'), pu = curProj().punchUrl;
    pl.hidden = !pu;
    if (pu) { pl.href = pu; pl.setAttribute('data-title', curProj().name + ' \u2014 Punchlist'); }
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

  /* ---- Mic (Web Speech API) ---- */
  function micUi() {
    var btn = $('mic-btn'); if (!btn) return;
    var on = mic.on, ta = $('note-text'), has = !!(ta && ta.value.trim());
    btn.classList.toggle('rec', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Stop dictation' : 'Start dictation');
    $('mic-lbl').textContent = on ? 'Listening \u2014 tap to stop' : (has ? 'Tap to keep talking' : 'Tap to talk');
    var st = $('mic-state'), extra = mic.msg;
    st.className = 'micstate' + (on ? ' rec' : '') + (extra && !on ? ' warn' : '');
    st.textContent = on ? 'Recording\u2026 speak your note' : (extra || (has ? 'Review the note, then Save or Discard' : 'Tap the mic to dictate a note'));
    var tag = $('rec-tag'); if (tag) tag.hidden = !on;
    var dc = $('draft-card'); if (dc) dc.classList.toggle('live', on);
    var sv = $('note-save'), dsc = $('note-discard');
    if (sv) { sv.disabled = !has || notes.saving; sv.textContent = notes.saving ? 'Saving\u2026' : 'Save note'; }
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
    $('fin-back').setAttribute('data-go', kind ? 'fin' : 'home');
    $('fin-back').hidden = !kind;
    $('fin-refresh').hidden = !kind;
    $('fin-title').textContent = kind ? FIN_PAGES[kind].label : 'Finances';
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
    h += '<button class="bigbtn" data-go="insn">Insurance<span class="sub">Policies · renewals · to do by entity</span></button></div>';
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
    'mw.rent_lease': 'Rent under the lease / mo', 'mw.rent_other': 'Other rent / mo', 'mw.tax': 'Property tax / mo', 'mw.ins': 'Insurance / mo',
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
    var k1 = ovN('inc.k1'), w2 = ovN('inc.w2'), rep = k1 !== null && w2 !== null ? (k1 + w2) / 12 : null;
    h += ovRow('inc.k1') + ovRow('inc.w2');
    var inc = 0, parts = [], refs = ['inc.k1', 'inc.w2'];
    if (rep !== null) { inc += rep; h += ovCalcRow('K-1 + W-2 / mo', ovWhole(rep), 'amt-in', '(K-1 + W-2) \u00f7 12', refs); }
    if (V && V.incM !== null) {
      inc += V.incM;
      h += '<div class="ovrow calc"><div class="ovl"><span>Vault income / mo</span><small><span class="badge ok">Vault</span> month so far, scaled to the month</small></div><div class="ovv"><button class="ovgo amt-in" data-go="' + esc(incomeRoute('All')) + '">' + ovWhole(V.incM) + ' &rsaquo;</button></div></div>';
    } else h += '<div class="ovnote">Vault income is not counted until 14+ days are logged this month.</div>';
    h += ovCalcRow('Total income / mo', ovWhole(inc), 'amt-in', '', refs);
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
    var mwNet = N('mw.rent_lease') + N('mw.rent_other') - N('mw.tax') - N('mw.ins') - N('mono.pay');
    var stNet = N('st.rent') - N('st.tax') - N('st.ins') - N('st.debt');
    var wet = -N('wet.pay');
    var cls = function (n) { return n >= 0 ? 'amt-in' : 'amt-out'; };
    var h = '<div class="fxgrp">Laundromat (TiwiK)</div>' + ['ld.rev', 'ld.util', 'ld.rep', 'ld.ins', 'all.pay'].map(function (r) { return ovRow(r, r === 'all.pay' ? 'Equipment loan payment / mo' : null); }).join('') +
      ovCalcRow('Laundromat net / mo', signedMoney2(ldNet), cls(ldNet), 'revenue \u2212 costs \u2212 loan payment', ['ld.rev', 'ld.util', 'ld.rep']);
    h += '<div class="fxgrp">Mono Way (KiwiT)</div>' + ['mw.rent_lease', 'mw.rent_other', 'mw.tax', 'mw.ins', 'mono.pay'].map(function (r) { return ovRow(r, r === 'mono.pay' ? 'Mortgage payment / mo' : null); }).join('') +
      ovCalcRow('Mono Way net / mo', signedMoney2(mwNet), cls(mwNet), 'rent \u2212 tax \u2212 insurance \u2212 mortgage', ['mw.rent_other', 'mw.tax']);
    h += '<div class="fxgrp">Stewart Street (KiwiT)</div>' + ['st.rent', 'st.tax', 'st.ins', 'st.debt'].map(function (r) { return ovRow(r); }).join('') +
      ovCalcRow('Stewart Street net / mo', signedMoney2(stNet), cls(stNet), 'rent \u2212 tax \u2212 insurance \u2212 loan', ['st.rent', 'st.tax', 'st.ins', 'st.debt']);
    h += '<div class="fxgrp">Wetumka</div>' + ovCalcRow('Rocket Mortgage payment / mo', signedMoney2(wet), 'amt-out', 'verified payment', []);
    var tot = ldNet + mwNet + stNet + wet;
    h += ovCalcRow('Combined / mo', signedMoney2(tot), cls(tot), 'sum of the four lines above', ['ld.rev', 'ld.util', 'ld.rep', 'mw.rent_other', 'mw.tax', 'st.rent', 'st.tax', 'st.ins', 'st.debt']);
    h += '<div class="ovnote">If TiwiK pays KiwiT the lease rent, that is intercompany; the combined figure may be overstated by that amount until Zac confirms who pays what.</div>';
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
    if (ok) {
      C = ovCashCard(V); D = ovDebtCard(V, C); NW = ovNetWorth();
      h += '<div class="fxgrid">' +
        ovSum('Net worth', NW.nw === null ? '\u2014' : ovWhole(NW.nw), NW.nw !== null && NW.nw < 0 ? 'neg' : 'pos', NW.refs.some(ovEst) ? 'Estimate basis' : 'assets \u2212 debt', 'ovnw') +
        ovSum('Total debt', NW.debt === null ? '\u2014' : ovWhole(NW.debt), 'neg', '3 loans', 'ovliab') +
        ovSum('Debt service / mo', D.ds === null ? '\u2014' : ovWhole(D.ds), 'neg', D.ds2 !== null ? 'after reset: ' + ovWhole(D.ds2) : '', 'ovdebt') +
        ovSum('Cash runway', ovMo(C.runway), 'pos', C.burnSrc ? 'Vault burn' : 'Estimate burn', 'ovcashc') + '</div>';
      h += statusCard(d.status) + todoCards(d.todo || [], 'ov');
    }
    h += collCard('ovlive', 'Live Vault \u00b7 income & spend', null, ovVaultCard(V), true);
    if (ok) {
      h += collCard('ovcashc', 'Cash & runway', null, C.html, false);
      h += collCard('ovdebt', 'Debt service vs income', null, D.html, false);
      h += collCard('ovliab', 'Liabilities', 3, ovLoan('Wetumka \u00b7 Rocket Mortgage', ['wet.bal', 'wet.rate', 'wet.pay', 'wet.pi', 'wet.escrow', 'wet.due', 'wet.maturity'], 'ovl-wet', false) +
        ovLoan('Mono Way \u00b7 Bank of Stockton (KiwiT)', ['mono.bal', 'mono.orig', 'mono.rate', 'mono.pay', 'mono.maturity'], 'ovl-mono', false) +
        ovLoan('Equipment \u00b7 Alliance (TiwiK)', ['all.bal', 'all.rate', 'all.pay', 'all.pay2', 'all.maturity', 'all.payoff'], 'ovl-all', false), false);
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
    $('fin-body').innerHTML = ovHtml();
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
    ovFetchFin(!!force); ovFetchSpend(!!force); renderOv();
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
    if (st.s === 'ok') {
      var d = st.data, pay = ldSrcOf('payoff', d.sources);
      h += '<div class="fxnote"><b>Equipment note</b> TiwiK LLC \u00b7 Alliance Laundry (Huebsch). All figures are read live from the Payoff Options Doc; tap a number to open its source. General information and arithmetic only \u2014 not lending, tax, legal or insurance advice.</div>';
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
    h += '<div class="fxnote"><b>Update pending</b> The full payoff analysis (Bank of Stockton options, comparison, rate outlook, insurance) appears here after the server update. Showing the loan facts from the Laundromat Doc for now.</div>';
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
      h += '<div class="grid2 biz-grid">' + ents.map(function (x) {
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
  if (getPc()) show(location.hash.slice(1) || 'home', true);
  else lock();
})();
