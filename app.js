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
     folderCache: {}, docUrls: [], pdf: null, pdfObserver: null };
  var SCREENS = ['lock', 'home', 'projects', 'life', 'log', 'spend', 'biz', 'doc', 're', 'lt'];

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
  //         "spend/income/<Source>", "spend/all"   (segments are URI-encoded)
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
      (sr.kind === 'cat' && sr.acct ? '/' + encodeURIComponent(sr.acct) : '');
    return '#spend';
  }
  function show(route, fromHistory) {
    var R = parseRoute(route), name = R.base === 'vault' ? 'spend' : R.base;
    if (name === 'ins') { name = 're'; state.reRoute = { ins: true, slug: '' }; }
    else if (name === 're') state.reRoute = { ins: false, slug: R.kind };
    if (SCREENS.indexOf(name) < 0 || name === 'lock') name = 'home';
    if (!getPc()) return lock();
    if (name === 'spend') {
      var okKind = R.kind === 'all' || (/^(cat|acct|income)$/.test(R.kind) && R.val);
      state.spendRoute = okKind ? { kind: R.kind, val: R.kind === 'all' ? '' : R.val, acct: R.kind === 'cat' ? R.acct : '' }
        : { kind: '', val: '', acct: '' };
    }
    if (name !== 'doc') { state.docPushed = false; state.docSeq++; closeDoc(); }
    activate(name);
    if (!fromHistory) {
      if (name === 'biz') state.bizSlug = R.kind;
      var h = name === 'home' ? '' : name === 'spend' ? spendHash(state.spendRoute) :
        name === 'biz' && R.kind ? '#biz/' + encodeURIComponent(R.kind) :
        name === 'doc' ? '#doc?' + R.query :
        name === 'lt' ? '#lt' + (R.kind ? '/' + encodeURIComponent(R.kind) : '') :
        name === 're' ? (state.reRoute.ins ? '#ins' : '#re' + (state.reRoute.slug ? '/' + encodeURIComponent(state.reRoute.slug) : '')) : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects' || name === 'life') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'spend') loadSpend(false);
    if (name === 'biz') { state.bizSlug = R.kind; loadBiz(); }
    if (name === 're') loadRe();
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
  function setZoomable(on) {
    var vp = $('vp');
    if (vp) vp.setAttribute('content', 'width=device-width,initial-scale=1,' + (on ? 'maximum-scale=5' : 'maximum-scale=1') + ',viewport-fit=cover');
  }
  function openDocScreen(p) {
    var url = p.u || '', ref = driveRef(url), seq = ++state.docSeq;
    state.docFrom = p.from || 'home';
    $('doc-title').textContent = p.t || 'Document';
    $('doc-open').href = url || '#';
    closeDoc(true);
    setZoomable(true);
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
    if (!keepZoom) setZoomable(false);
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
    $('projects-list').innerHTML = d.projects.map(function (p) {
      return tile(p, p.kind === 'doc' ? 'Running notes' : p.kind === 'folder' ? 'Drive folder' : '');
    }).join('');
    $('life-list').innerHTML = d.lifeAreas.map(function (a) {
      if (/^real estate$/i.test(a.name)) { state.reFolderUrl = a.url; return '<button class="tile small" data-go="re">' + esc(a.name) + '<span class="sub">3 properties</span></button>'; }
      if (/^lisa.s table$/i.test(a.name)) { state.ltFolderUrl = a.url; return '<button class="tile small" data-go="lt">' + esc(a.name) + '<span class="sub">Menus · recipes · macros</span></button>'; }
      if (/^insurance$/i.test(a.name)) { state.insFolderUrl = a.url; return '<button class="tile small" data-go="ins">' + esc(a.name) + '</button>'; }
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
      return { date: x.date, label: x.label || x.date, source: normSource(x.source), amount: Number(x.amount) || 0, notes: x.notes || '' };
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
    var srcNames = INCOME_SOURCES.slice();
    income.forEach(function (x) { if (srcNames.indexOf(x.source) < 0) srcNames.push(x.source); });
    return {
      items: items, full: full, entryCount: full ? items.length : (d.entryCount || items.length),
      truncated: !full && (d.entryCount || 0) > items.length,
      accounts: accounts, who: who, income: income,
      sources: srcNames.map(function (sname) {
        var l = income.filter(function (x) { return x.source === sname; });
        return { name: sname, amount: sum(l), count: l.length };
      }),
      incomeTotal: sum(income),
      total: full ? sum(items) : Number(d.total) || 0,
      daysLogged: d.daysLogged
    };
  }

  function goAttr(route) { return ' data-go="' + esc(route) + '"'; }
  function catRoute(c, a) { return 'spend/cat/' + encodeURIComponent(c) + (a ? '/' + encodeURIComponent(a) : ''); }
  function acctRoute(a) { return 'spend/acct/' + encodeURIComponent(a); }
  function incomeRoute(s) { return 'spend/income/' + encodeURIComponent(s); }

  function paintSpendChrome() {
    var sr = state.spendRoute, sub = !!sr.kind;
    $('spend-back').hidden = !sub;
    $('spend-title').textContent = sr.kind === 'all' ? 'All items' : sub ? sr.val : 'Vault';
    $('spend-title').classList.toggle('sub', sub);
  }

  function itemRows(list, opt) {
    if (!list.length) return '<div class="foot">No items this month.</div>';
    return list.map(function (e) {
      var meta = [];
      if (e.method) meta.push(esc(e.method));
      if (opt.acct && e.account !== 'Household') meta.push('<span class="acct-tag">' + esc(e.account) + '</span>');
      return '<div class="entry item"><div class="d">' + esc(e.label) + '<br>' + esc(e.who) + '</div>' +
        '<div class="m"><div class="mer">' + esc(e.merchant || '—') + '</div>' +
        '<div class="meta">' + (opt.chip ? '<button class="chip"' + goAttr(catRoute(e.category)) + '>' + esc(e.category) + '</button>' : '') +
        (meta.length ? '<small>' + meta.join(' · ') + '</small>' : '') + '</div>' +
        (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : '') + '</div>' +
        '<div class="a">' + money(e.amount) + '</div></div>';
    }).join('');
  }
  function truncNote(M) {
    return M.truncated ? '<div class="foot">Showing the latest ' + M.items.length + ' of ' + M.entryCount +
      ' entries this month (full list after the API update).</div>' : '';
  }
  function barRows(rows, routeFn, cls) {
    var max = rows.reduce(function (m, c) { return Math.max(m, c.amount); }, 0);
    return rows.map(function (c) {
      var pct = max > 0 && c.amount > 0 ? Math.max(2, (c.amount / max) * 100) : 0;
      return '<button class="catrow' + (cls || '') + '"' + goAttr(routeFn(c.name)) + '><span class="n">' + esc(c.name) + '</span>' +
        '<span class="amt">' + money(c.amount) + '</span><span class="chev">&rsaquo;</span>' +
        '<span class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></span></button>';
    }).join('');
  }

  function renderSpend() {
    var d = state.spendData, M = spendModel(d), sr = state.spendRoute;
    paintSpendChrome();
    $('spend-month').textContent = d.monthLabel;
    var h = '';

    if (!sr.kind) {
      h += '<div class="card"><h3>Accounts</h3><div class="accts">' + M.accounts.map(function (a) {
        return '<button class="acct"' + goAttr(acctRoute(a.name)) + '><span>' + esc(a.name) + '</span><b>' + money(a.amount) + '</b></button>';
      }).join('') + '</div><div class="foot">' + money(M.total) + ' total spend · ' + M.entryCount + ' entries' +
        (M.daysLogged != null ? ' · ' + M.daysLogged + ' days logged' : '') + '</div></div>';

      M.accounts.forEach(function (a) {
        h += '<div class="card acctsec"><h4 class="sechead">' + esc(a.name) + '</h4>';
        if (!a.cats.length) h += '<div class="foot empty">No entries this month</div>';
        h += barRows(a.cats, function (c) { return catRoute(c, a.name); });
        h += '<div class="totrow"><span>' + esc(a.name) + ' total</span><span class="amt">' + money(a.amount) + '</span></div></div>';
      });

      h += '<div class="card grand"><div class="totrow"><span>Total spent</span><span class="amt">' + money(M.total) + '</span></div></div>';

      h += '<div class="card income"><h4 class="sechead">Income</h4>' +
        '<div class="foot sub-note">Weekly lump sums</div>' +
        barRows(M.sources, incomeRoute, ' inc') +
        '<div class="totrow"><span>Income total</span><span class="amt">' + money(M.incomeTotal) + '</span></div></div>';

      var days = periodDays(d.monthOffset != null ? Number(d.monthOffset) : state.spendDataOff);
      var perDay = function (v) { return days > 0 ? money(v / days) : '—'; };
      var acctTot = function (n) { var a = M.accounts.filter(function (x) { return x.name === n; })[0]; return a ? a.amount : 0; };
      var srcTot = function (n) { var x = M.sources.filter(function (y) { return y.name === n; })[0]; return x ? x.amount : 0; };
      var groc = r2(sum(M.items.filter(function (x) { return x.account === 'Household' && x.category === 'Groceries'; })));
      var signed = function (v) { return (v >= 0 ? '+' : '−') + money(Math.abs(v)); };
      var netLine = function (label, inc, sp, spLbl) {
        var n = r2(inc - sp);
        return '<div class="sumline net cmp"><span>' + esc(label) + '<small>Income ' + money(inc) + ' − ' + spLbl + ' ' + money(sp) + '</small></span>' +
          '<span class="amt ' + (n >= 0 ? 'pos' : 'neg') + '">' + signed(n) + '</span></div>';
      };
      var hhTot = acctTot('Household');
      h += '<div class="card summary"><h3>Summary <small>(over ' + days + ' day' + (days === 1 ? '' : 's') + ')</small></h3>' +
        netLine('TiwiK net', srcTot('Mono Village Laundromat'), acctTot('TiwiK'), 'Spent') +
        netLine("Lisa's Table net", srcTot("Lisa's Table"), groc, 'Groceries') +
        '<div class="sumline net cmp"><span>Household spend<small>Running month total</small></span>' +
        '<span class="amt neg">−' + money(Math.abs(hhTot)) + '</span></div>' +
        '<div class="sumline minor"><span>Avg daily spend</span><span class="amt spend">' + perDay(M.total) + '</span></div>' +
        '<div class="sumline minor"><span>Avg daily income</span><span class="amt inc">' + perDay(M.incomeTotal) + '</span></div></div>';

      h += '<button class="linkrow allbtn"' + goAttr('spend/all') + '>All items (' + M.entryCount + ') &rsaquo;</button>';

      if (M.who.length) h += '<div class="card"><h3>Household · Zac vs Lisa</h3><div class="split">' +
        M.who.map(function (w) { return '<div><b>' + money(w.amount) + '</b>' + esc(w.name) + '</div>'; }).join('') + '</div></div>';
      if (d.missingColumns && d.missingColumns.length) h += '<div class="foot">Columns not found: ' + esc(d.missingColumns.join(', ')) + '</div>';
    } else if (sr.kind === 'income') {
      var inc = M.income.filter(function (x) { return x.source === normSource(sr.val); });
      h += '<div class="card income"><h3>Income</h3><div class="big">' + money(sum(inc)) + '</div>' +
        '<div class="foot">' + inc.length + ' week' + (inc.length === 1 ? '' : 's') + '</div></div>';
      h += '<div class="card income">';
      if (!inc.length) h += '<div class="foot">No income entries this month.</div>';
      h += inc.map(function (e) {
        return '<div class="entry item inc"><div class="d">Week ending<br><b>' + esc(e.label) + '</b></div>' +
          '<div class="m">' + (e.notes ? '<div class="notes">' + esc(e.notes) + '</div>' : '<div class="notes">—</div>') + '</div>' +
          '<div class="a">' + money(e.amount) + '</div></div>';
      }).join('');
      h += '</div>';
    } else {
      var list, label, total, extra = '', opt;
      if (sr.kind === 'cat') {
        list = M.items.filter(function (x) { return x.category === sr.val && (!sr.acct || x.account === sr.acct); });
        label = sr.acct ? sr.acct + ' · category' : 'Category';
        opt = { chip: false, acct: !sr.acct };
        total = sum(list);
        if (M.truncated) {
          var ac = M.accounts.filter(function (a) { return a.name === (sr.acct || 'Household'); })[0];
          var ct = ac && ac.cats.filter(function (c) { return c.name === sr.val; })[0];
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
      } else {
        list = M.items; label = 'All accounts'; opt = { chip: true, acct: true }; total = M.total;
      }
      h += '<div class="card"><h3>' + esc(label) + '</h3><div class="big">' + money(total) + '</div>' +
        '<div class="foot">' + list.length + ' item' + (list.length === 1 ? '' : 's') + (extra ? ' · ' + extra : '') + '</div></div>';
      h += '<div class="card">' + itemRows(list, opt) + truncNote(M) + '</div>';
    }
    $('spend-body').innerHTML = h;
  }

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
