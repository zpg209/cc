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
    spendData: null, spendDataOff: null, spendRoute: { kind: '', val: '', acct: '' } };
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
  // Routes: "home", "log", "spend", "spend/cat/<Category>[/<Account>]", "spend/acct/<Account>",
  //         "spend/income/<Source>", "spend/all"   (segments are URI-encoded)
  function dec(v) { try { return decodeURIComponent(v || ''); } catch (e) { return v || ''; } }
  function parseRoute(r) {
    var parts = String(r || '').replace(/^#/, '').split('/');
    return { base: parts[0] || 'home', kind: parts[1] || '', val: dec(parts[2]), acct: dec(parts[3]) };
  }
  function spendHash(sr) {
    if (sr.kind === 'all') return '#spend/all';
    if (sr.kind && sr.val) return '#spend/' + sr.kind + '/' + encodeURIComponent(sr.val) +
      (sr.kind === 'cat' && sr.acct ? '/' + encodeURIComponent(sr.acct) : '');
    return '#spend';
  }
  function show(route, fromHistory) {
    var R = parseRoute(route), name = R.base === 'vault' ? 'spend' : R.base;
    if (SCREENS.indexOf(name) < 0 || name === 'lock') name = 'home';
    if (!getPc()) return lock();
    if (name === 'spend') {
      var okKind = R.kind === 'all' || (/^(cat|acct|income)$/.test(R.kind) && R.val);
      state.spendRoute = okKind ? { kind: R.kind, val: R.kind === 'all' ? '' : R.val, acct: R.kind === 'cat' ? R.acct : '' }
        : { kind: '', val: '', acct: '' };
    }
    activate(name);
    if (!fromHistory) {
      var h = name === 'home' ? '' : name === 'spend' ? spendHash(state.spendRoute) : '#' + name;
      if (location.hash !== h) history.pushState({ screen: name }, '', h || location.pathname + location.search);
    }
    if (name === 'projects' || name === 'life') loadLinks();
    if (name === 'log') loadLog();
    if (name === 'spend') loadSpend(false);
  }
  window.addEventListener('popstate', function () { show(location.hash.slice(1) || 'home', true); });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go]');
    if (el) { e.preventDefault(); e.stopPropagation(); show(el.getAttribute('data-go')); }
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
      var net = r2(M.incomeTotal - M.total);
      var perDay = function (v) { return days > 0 ? money(v / days) : '—'; };
      h += '<div class="card summary"><h3>Summary <small>(over ' + days + ' day' + (days === 1 ? '' : 's') + ')</small></h3>' +
        '<div class="sumline"><span>Avg daily spend</span><span class="amt spend">' + perDay(M.total) + '</span></div>' +
        '<div class="sumline"><span>Avg daily income</span><span class="amt inc">' + perDay(M.incomeTotal) + '</span></div>' +
        '<div class="sumline net"><span>Net income</span><span class="amt ' + (net >= 0 ? 'pos' : 'neg') + '">' +
        (net >= 0 ? '+' : '−') + money(Math.abs(net)) + '</span></div></div>';

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
