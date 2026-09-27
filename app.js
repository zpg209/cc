/* Command Center — static front end for GitHub Pages.
 * Data comes from the passcode-protected Apps Script JSON API (Api.gs).
 * The passcode is typed by the user and kept only in this device's localStorage. */
(function () {
  'use strict';

  // Public web app URL of the separate "Anyone" API deployment (the passcode protects the data).
  var API_URL = 'https://script.google.com/macros/s/AKfycbx8050r1JIjNaUk6YD0jq5F_-i2yALyic6LVlTnnsnQLelEB6yuUJpgmXbL6Bztjldy/exec';
  var PC_KEY = 'cc_passcode';
  var FALLBACK_URL = 'https://script.google.com/a/macros/landstruc.com/s/AKfycbyigotJxdJD3CeCpRyCEfhHdL7zcv2ZE_ibTm2ZyITgODqrh_NxGhONx6m8CcBlxaPD/exec';

  var state = { weekOffset: 0, monthOffset: 0, links: null, logSeq: 0, spendSeq: 0 };
  var SCREENS = ['lock', 'home', 'projects', 'life', 'log', 'spend'];

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
  function show(name, fromHistory) {
    if (SCREENS.indexOf(name) < 0 || name === 'lock') name = 'home';
    if (!getPc()) return lock();
    activate(name);
    if (!fromHistory) {
      var h = name === 'home' ? '' : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects' || name === 'life') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'spend') loadSpend();
  }
  window.addEventListener('popstate', function () { show(location.hash.slice(1) || 'home', true); });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (el) { e.preventDefault(); show(el.getAttribute('data-go')); }
  });

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
      show(SCREENS.indexOf(target) > 1 ? target : 'home', true);
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
  function tile(item, sub) {
    if (!item.url) return '<div class="tile small disabled">' + esc(item.name) + '<span class="sub">coming soon</span></div>';
    return '<a class="tile small" target="_blank" rel="noopener" href="' + esc(item.url) + '">' + esc(item.name) +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</a>';
  }
  function renderLinks() {
    var d = state.links;
    $('projects-list').innerHTML = d.projects.map(function (p) {
      return tile(p, p.kind === 'doc' ? 'Running notes' : p.kind === 'folder' ? 'Drive folder' : '');
    }).join('');
    $('life-list').innerHTML = d.lifeAreas.map(function (a) { return tile(a, ''); }).join('');
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

  /* ---------------- Daily spend ---------------- */
  function loadSpend() {
    var seq = ++state.spendSeq;
    $('spend-body').innerHTML = '<div class="loading">Loading…</div>';
    $('spend-month').textContent = '…';
    api('spend', state.monthOffset).then(function (d) { if (seq === state.spendSeq) renderSpend(d); },
      function (err) { if (seq === state.spendSeq) { $('spend-month').textContent = ''; onFail(['spend-body'], loadSpend)(err); } });
  }

  function renderSpend(d) {
    $('spend-month').textContent = d.monthLabel;
    var h = '<div class="card"><h3>Month total</h3><div class="big">' + money(d.total) + '</div>' +
      '<div class="foot">' + d.entryCount + ' entries · ' + d.daysLogged + ' days logged</div></div>';

    h += '<div class="card"><h3>Zac vs Lisa</h3><div class="split">' +
      d.byWho.map(function (w) { return '<div><b>' + money(w.amount) + '</b>' + esc(w.name) + '</div>'; }).join('') +
      '</div></div>';

    var max = d.byCategory.length ? d.byCategory[0].amount : 0;
    h += '<div class="card"><h3>By category</h3>';
    if (!d.byCategory.length) h += '<div class="foot">No spending logged this month.</div>';
    else {
      h += '<div class="kv">' + d.byCategory.map(function (c) {
        var pct = max > 0 ? Math.max(2, (c.amount / max) * 100) : 0;
        return '<div>' + esc(c.name) + '</div><div class="amt">' + money(c.amount) + '</div>' +
          '<div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>';
      }).join('') + '</div>';
    }
    h += '</div>';

    h += '<div class="card"><h3>Recent entries</h3>';
    if (!d.recent.length) h += '<div class="foot">None yet.</div>';
    d.recent.forEach(function (e) {
      h += '<div class="entry"><div class="d">' + esc(e.label) + '<br>' + esc(e.who) + '</div>' +
        '<div class="m">' + esc(e.merchant || '—') + '<br><small>' + esc(e.category) + (e.method ? ' · ' + esc(e.method) : '') + '</small></div>' +
        '<div class="a">' + money(e.amount) + '</div></div>';
    });
    if (d.missingColumns && d.missingColumns.length) h += '<div class="foot">Columns not found: ' + esc(d.missingColumns.join(', ')) + '</div>';
    h += '</div>';

    $('spend-body').innerHTML = h;
  }

  $('spend-prev').addEventListener('click', function () { state.monthOffset--; loadSpend(); });
  $('spend-next').addEventListener('click', function () { state.monthOffset++; loadSpend(); });

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
