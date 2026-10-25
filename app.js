(function () {
  "use strict";

  // ---------- Text ----------
  var LANG = "ko";
  var S = window.STRINGS[LANG];
  function t(key, vars) {
    var s = S[key];
    if (s == null) return key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Storage ----------
  var STORE = "manna.v1";
  var KEY_STORE = "manna.apiKey";
  var MODELS = { haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" };
  var defaults = {
    settings: { perDay: 3, mode: "together", fontSize: 17, model: MODELS.haiku, lang: "ko" },
    bookmark: null,
    log: {},
    summaries: {}
  };
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      var d = JSON.parse(raw);
      d.settings = Object.assign({}, defaults.settings, d.settings || {});
      d.log = d.log || {};
      d.summaries = d.summaries || {};
      return d;
    } catch (e) {
      return JSON.parse(JSON.stringify(defaults));
    }
  }
  var db = load();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* storage full or blocked */ }
  }
  function getKey() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) {} }

  // ---------- Dates ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function longDate(d) {
    return new Intl.DateTimeFormat(S.locale, { month: "long", day: "numeric", weekday: "long" }).format(d);
  }

  function streak() {
    var d = new Date();
    if (!db.log[dateKey(d)]) d = addDays(d, -1);
    var n = 0;
    while (db.log[dateKey(d)]) { n++; d = addDays(d, -1); }
    return n;
  }

  // ---------- Bible data ----------
  var books = [];
  var bookCache = {};
  function bookName(id) { var b = books[id - 1]; return b ? (LANG === "ko" ? b.ko : b.en) : ""; }
  function fetchJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }
  function loadBook(id) {
    if (bookCache[id]) return Promise.resolve(bookCache[id]);
    return fetchJSON("data/krv/" + pad(id) + ".json").then(function (d) { bookCache[id] = d; return d; });
  }
  function nextChapter(b, c) {
    if (c < books[b - 1].chapters) return [b, c + 1];
    if (b < 66) return [b + 1, 1];
    return [1, 1];
  }
  function upcoming(n) {
    var out = [];
    var cur = db.bookmark ? [db.bookmark.b, db.bookmark.c] : [1, 0];
    for (var i = 0; i < n; i++) {
      cur = (cur[1] === 0) ? [cur[0], 1] : nextChapter(cur[0], cur[1]);
      out.push(cur);
    }
    return out;
  }
  function rangeLabel(chs) {
    var groups = [];
    chs.forEach(function (x) {
      var g = groups[groups.length - 1];
      if (g && g.b === x[0] && g.to === x[1] - 1) g.to = x[1];
      else groups.push({ b: x[0], from: x[1], to: x[1] });
    });
    return groups.map(function (g) {
      return bookName(g.b) + " " + (g.from === g.to ? g.from : g.from + "~" + g.to) + "장";
    }).join(" · ");
  }
  function rangeKey(chs, mode) { return mode + "|" + chs.map(function (x) { return x.join(":"); }).join(","); }
  function loadChapters(chs) {
    var ids = [];
    chs.forEach(function (x) { if (ids.indexOf(x[0]) < 0) ids.push(x[0]); });
    return Promise.all(ids.map(loadBook));
  }
  function sections(chs) {
    return chs.map(function (x) {
      return { bookName: bookName(x[0]), book: x[0], chapter: x[1], verses: bookCache[x[0]].chapters[x[1] - 1] };
    });
  }

  // ---------- UI helpers ----------
  var view = document.getElementById("view");
  var tabs = document.getElementById("tabs");
  var bar = document.getElementById("readingBar");
  var toastEl = document.getElementById("toast");
  var toastTimer;
  function toast(msg, actionLabel, action) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = esc(msg) + (actionLabel ? ' <button type="button">' + esc(actionLabel) + "</button>" : "");
    if (actionLabel) toastEl.querySelector("button").onclick = function () { toastEl.innerHTML = ""; action(); };
    toastTimer = setTimeout(function () { toastEl.innerHTML = ""; }, actionLabel ? 5000 : 2500);
  }
  var icons = {
    gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    flame: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>',
    left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A9A5B4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 7h6"/></svg>',
    cal: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  function renderTabs(active) {
    if (!active) { tabs.style.display = "none"; return; }
    tabs.style.display = "";
    tabs.innerHTML = '<div class="inner">' +
      '<a href="#/today"' + (active === "today" ? ' aria-current="page"' : "") + ">" + icons.book + "<span>" + esc(t("tabToday")) + "</span></a>" +
      '<a href="#/record"' + (active === "record" ? ' aria-current="page"' : "") + ">" + icons.cal + "<span>" + esc(t("tabRecord")) + "</span></a></div>";
  }
  function applyFont() { document.documentElement.style.setProperty("--reading-size", db.settings.fontSize + "px"); }

  // ---------- Summary ----------
  var inflight = {};
  var failed = {};
  function verseLookup(ref) {
    var m = /^(.+?)\s*(\d+)\s*:\s*(\d+)/.exec(ref || "");
    if (!m) return null;
    var name = m[1].trim(), c = +m[2], v = +m[3];
    var id = 0;
    books.forEach(function (b) { if (b.ko === name || b.en === name) id = b.id; });
    if (!id || !bookCache[id]) return { label: ref, text: "" };
    var ch = bookCache[id].chapters[c - 1];
    return { label: t("verseRef", { c: c, v: v }), text: ch && ch[v - 1] ? ch[v - 1] : "", full: bookName(id) + " " + c + ":" + v };
  }
  function summaryHTML(data) {
    var html = '<div class="summary">';
    if (data.chapters) {
      data.chapters.forEach(function (c) {
        html += '<div class="chapter-title">' + esc(c.title) + "</div>";
        html += '<ol class="points">' + (c.points || []).map(function (p, i) {
          return '<li><span class="num">' + (i + 1) + "</span><span>" + esc(p) + "</span></li>";
        }).join("") + "</ol>";
      });
    } else {
      html += '<ol class="points">' + (data.points || []).map(function (p, i) {
        return '<li><span class="num">' + (i + 1) + "</span><span>" + esc(p) + "</span></li>";
      }).join("") + "</ol>";
    }
    var kv = verseLookup(data.key_verse);
    if (kv) {
      html += '<div class="divider"></div><div><div class="verse-label">' + esc(t("keyVerse")) + " · " + esc(kv.label) + "</div>" +
        (kv.text ? '<div class="verse-text">' + esc(kv.text) + "</div>" : "") + "</div>";
    }
    html += '<div class="message"><span class="message-label">' + esc(t("keyMessage")) + '</span><span class="message-text">' + esc(data.message) + "</span></div>";
    return html + "</div>";
  }
  function summaryBlock(chs, mode, opts) {
    var key = rangeKey(chs, mode);
    var cached = db.summaries[key];
    if (cached) return '<div class="card pad">' + summaryHTML(cached.data) + "</div>";
    if (opts && opts.readOnly) return '<div class="note-box">' + esc(t("noSummarySaved")) + "</div>";
    var apiKey = getKey();
    if (inflight[key]) {
      return '<div class="card pad"><div class="skeleton" aria-label="' + esc(t("summaryLoading")) + '"><span></span><span></span><span></span></div></div>';
    }
    if (apiKey && !failed[key]) {
      requestSummary(chs, mode);
      return '<div class="card pad"><div class="skeleton" aria-label="' + esc(t("summaryLoading")) + '"><span></span><span></span><span></span></div></div>';
    }
    var html = '<div class="card pad" style="display:flex;flex-direction:column;gap:12px">';
    if (failed[key]) html += '<div class="warn">' + esc(t("summaryError", { msg: failed[key] })) + "</div>";
    else html += '<div class="note">' + esc(t("noKey")) + "</div>";
    html += '<div class="btn-row">';
    if (apiKey) html += '<button class="pill" type="button" data-act="retry">' + esc(t("retrySummary")) + "</button>";
    else html += '<a class="pill" style="display:inline-flex;align-items:center;text-decoration:none" href="#/settings">' + esc(t("addKey")) + "</a>";
    html += '<button class="pill" type="button" data-act="copy">' + esc(t("copyPrompt")) + "</button></div></div>";
    return html;
  }
  function requestSummary(chs, mode) {
    var key = rangeKey(chs, mode);
    inflight[key] = true;
    delete failed[key];
    window.Summary.request(getKey(), db.settings.model, sections(chs), mode).then(function (data) {
      db.summaries[key] = { data: data, at: Date.now(), model: db.settings.model };
      save();
    }).catch(function (err) {
      failed[key] = err.message || String(err);
    }).then(function () {
      delete inflight[key];
      refreshSummary(chs, mode);
    });
  }
  function refreshSummary(chs, mode) {
    var slot = document.getElementById("summarySlot");
    if (!slot || slot.getAttribute("data-key") !== rangeKey(chs, mode)) return;
    slot.innerHTML = summaryBlock(chs, mode);
    wireSummary(slot, chs, mode);
  }
  function wireSummary(slot, chs, mode) {
    var r = slot.querySelector('[data-act="retry"]');
    if (r) r.onclick = function () { delete failed[rangeKey(chs, mode)]; requestSummary(chs, mode); refreshSummary(chs, mode); };
    var c = slot.querySelector('[data-act="copy"]');
    if (c) c.onclick = function () {
      var text = window.Summary.fullCopyText(sections(chs), mode);
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
        toast(t("copied"));
      }).catch(function () {
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); toast(t("copied")); } catch (e) {}
        ta.remove();
      });
    };
  }

  // ---------- Passage ----------
  function passageHTML(chs) {
    return sections(chs).map(function (s, i) {
      return '<section class="chapter" id="ch-' + i + '"><div class="chapter-break"><span>' + esc(s.bookName + " " + t("chapterN", { n: s.chapter })) + "</span><i></i></div>" +
        s.verses.map(function (v, j) { return '<p class="verse"><sup>' + (j + 1) + "</sup>" + esc(v) + "</p>"; }).join("") + "</section>";
    }).join("");
  }

  // Sticky bar with chapter progress while reading
  var scrollHandler = null;
  function setupReadingBar(chs) {
    teardownReadingBar();
    var secs = sections(chs);
    bar.innerHTML = '<div class="inner"><div class="row"><span class="title" id="barTitle"></span><span class="note" id="barCount"></span></div>' +
      '<div class="progress" style="grid-template-columns:repeat(' + chs.length + ',minmax(0,1fr))">' +
      chs.map(function () { return "<div><b style=\"width:0\"></b></div>"; }).join("") + "</div></div>";
    var fills = bar.querySelectorAll(".progress b");
    var ticking = false;
    function update() {
      ticking = false;
      var top = document.querySelector(".top");
      var show = top && top.getBoundingClientRect().bottom < 0;
      bar.classList.toggle("show", !!show);
      bar.setAttribute("aria-hidden", show ? "false" : "true");
      var vh = window.innerHeight, current = 0;
      for (var i = 0; i < chs.length; i++) {
        var el = document.getElementById("ch-" + i);
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh * 0.35) current = i;
        var p = (vh * 0.35 - r.top) / Math.max(1, r.height);
        fills[i].style.width = Math.max(0, Math.min(1, p)) * 100 + "%";
      }
      document.getElementById("barTitle").textContent = secs[current].bookName + " " + t("chapterN", { n: secs[current].chapter });
      document.getElementById("barCount").textContent = t("progress", { i: current + 1, n: chs.length });
    }
    scrollHandler = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", scrollHandler, { passive: true });
    update();
  }
  function teardownReadingBar() {
    if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
    scrollHandler = null;
    bar.classList.remove("show");
    bar.setAttribute("aria-hidden", "true");
  }

  // ---------- Screens ----------
  var ui = { extra: false, month: null, selected: null, openPassage: {}, pickBook: null };

  function streakChip() {
    var n = streak();
    return '<span class="streak' + (n ? "" : " off") + '">' + icons.flame + esc(n ? t("streakDays", { n: n }) : t("streakStart")) + "</span>";
  }

  function renderToday() {
    renderTabs("today");
    var today = todayKey();
    var head = '<header class="top"><div class="top-row">' + streakChip() +
      '<a class="round" href="#/settings" aria-label="' + esc(t("settings")) + '">' + icons.gear + "</a></div>";

    if (!db.bookmark) {
      view.innerHTML = head + '<span class="top-label">' + esc(t("today") + " · " + longDate(new Date())) + '</span><h1 class="answer">' + esc(t("welcomeTitle")) + "</h1></header>" +
        '<div class="content"><p class="note" style="margin:20px 0 16px;font-size:15px;line-height:22px">' + esc(t("welcomeBody")) + "</p>" +
        '<div class="done-area" style="margin-top:0"><button class="btn" type="button" id="startGen">' + esc(t("startGenesis")) + "</button>" +
        '<a class="btn secondary" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/pick">' + esc(t("pickPlace")) + "</a></div></div>";
      document.getElementById("startGen").onclick = function () { db.bookmark = { b: 1, c: 0 }; save(); render(); };
      return;
    }

    var entries = db.log[today] || [];
    var doneMode = entries.length > 0 && !ui.extra;
    var mode = db.settings.mode;

    if (doneMode) {
      var last = entries[entries.length - 1];
      var allChs = [];
      entries.forEach(function (e) { allChs = allChs.concat(e.chapters); });
      loadChapters(allChs).then(function () {
        if (location.hash.indexOf("#/today") !== 0 && location.hash !== "" && location.hash !== "#") return;
        var html = head + '<span class="top-label">' + esc(t("doneToday") + " · " + longDate(new Date())) + '</span><h1 class="answer">' + esc(rangeLabel(allChs)) + "</h1></header>";
        html += '<div class="content">';
        entries.forEach(function (e, idx) {
          var m = e.mode || mode;
          html += '<div class="section">' + esc(entries.length > 1 ? rangeLabel(e.chapters) : t("summary")) + "</div>";
          html += '<div id="' + (idx === entries.length - 1 ? "summarySlot" : "s" + idx) + '" data-key="' + esc(rangeKey(e.chapters, m)) + '">' + summaryBlock(e.chapters, m, { readOnly: idx !== entries.length - 1 }) + "</div>";
        });
        html += '<button class="link-btn" type="button" id="togglePassage">' + esc(ui.openPassage.today ? t("hidePassage") : t("showPassage")) + "</button>";
        if (ui.openPassage.today) html += '<div class="card passage-card">' + passageHTML(allChs) + "</div>";
        html += '<div class="done-area"><button class="btn secondary" type="button" id="readMore">' + esc(t("readMore", { n: db.settings.perDay })) + "</button></div></div>";
        view.innerHTML = html;
        teardownReadingBar();
        var slot = document.getElementById("summarySlot");
        if (slot) wireSummary(slot, last.chapters, last.mode || mode);
        document.getElementById("togglePassage").onclick = function () { ui.openPassage.today = !ui.openPassage.today; renderToday(); };
        document.getElementById("readMore").onclick = function () { ui.extra = true; window.scrollTo(0, 0); renderToday(); };
      });
      return;
    }

    var chs = upcoming(db.settings.perDay);
    loadChapters(chs).then(function () {
      if (location.hash.indexOf("#/today") !== 0 && location.hash !== "" && location.hash !== "#") return;
      var html = head + '<span class="top-label">' + esc(t("today") + " · " + longDate(new Date())) + '</span><h1 class="answer">' + esc(rangeLabel(chs)) + "</h1></header>";
      html += '<div class="content"><div class="section">' + esc(t("summary")) + "</div>";
      html += '<div id="summarySlot" data-key="' + esc(rangeKey(chs, mode)) + '">' + summaryBlock(chs, mode) + "</div>";
      html += '<p class="note" style="margin-top:8px">' + esc(t("summaryNote")) + "</p>";
      html += '<div class="section" style="margin-top:28px">' + esc(t("passage")) + "</div>";
      html += '<div class="card passage-card">' + passageHTML(chs) + "</div>";
      html += '<div class="done-area"><button class="btn" type="button" id="done">' + esc(t("doneReading")) + "</button></div></div>";
      view.innerHTML = html;
      wireSummary(document.getElementById("summarySlot"), chs, mode);
      setupReadingBar(chs);
      document.getElementById("done").onclick = function () { markRead(chs, mode); };
    });
  }

  function markRead(chs, mode) {
    var today = todayKey();
    var prevBookmark = db.bookmark ? { b: db.bookmark.b, c: db.bookmark.c } : null;
    db.log[today] = db.log[today] || [];
    db.log[today].push({ chapters: chs, mode: mode, at: Date.now() });
    var lastCh = chs[chs.length - 1];
    db.bookmark = { b: lastCh[0], c: lastCh[1] };
    save();
    ui.extra = false;
    ui.openPassage.today = false;
    window.scrollTo(0, 0);
    renderToday();
    toast(t("doneToast"), t("undo"), function () {
      db.log[today].pop();
      if (!db.log[today].length) delete db.log[today];
      db.bookmark = prevBookmark;
      save();
      ui.extra = !!db.log[today];
      renderToday();
    });
  }

  function renderRecord() {
    renderTabs("record");
    teardownReadingBar();
    var now = new Date();
    if (!ui.month) ui.month = { y: now.getFullYear(), m: now.getMonth() };
    var y = ui.month.y, m = ui.month.m;
    var first = new Date(y, m, 1);
    var daysIn = new Date(y, m + 1, 0).getDate();
    var monthCount = 0;
    for (var d = 1; d <= daysIn; d++) if (db.log[dateKey(new Date(y, m, d))]) monthCount++;
    var today = todayKey();
    var sel = ui.selected || today;

    var html = '<header class="top"><h1 class="page-title">' + esc(t("recordTitle")) + "</h1>" +
      '<div class="stats"><div class="stat"><b>' + esc(t("days", { n: streak() })) + "</b><span>" + esc(t("streakLabel")) + '</span></div><div class="stat-sep"></div>' +
      '<div class="stat"><b>' + esc(t("days", { n: monthCount })) + "</b><span>" + esc(t("monthLabel")) + "</span></div></div></header>";
    html += '<div class="content"><div class="cal-head"><button class="round small" type="button" id="prevM" aria-label="' + esc(t("prevMonth")) + '">' + icons.left + "</button>" +
      "<span>" + esc(t("monthTitle", { y: y, m: m + 1 })) + '</span><button class="round small" type="button" id="nextM" aria-label="' + esc(t("nextMonth")) + '">' + icons.right + "</button></div>";
    html += '<div class="card cal"><div class="cal-grid">' + S.weekdays.map(function (w) { return '<div class="cal-week">' + esc(w) + "</div>"; }).join("") + "</div>";
    html += '<div class="cal-grid">';
    for (var i = 0; i < first.getDay(); i++) html += '<div class="cal-cell"></div>';
    for (d = 1; d <= daysIn; d++) {
      var k = dateKey(new Date(y, m, d));
      var cls = "day";
      if (db.log[k]) cls += " read";
      if (k === today) cls += " today";
      if (k === sel) cls += " selected";
      var future = k > today;
      if (future) cls += " future";
      html += '<div class="cal-cell"><button type="button" class="' + cls + '" data-date="' + k + '"' + (future ? " disabled" : "") + ' aria-pressed="' + (k === sel) + '">' + d + "</button></div>";
    }
    html += "</div></div>";

    var selDate = parseKey(sel);
    html += '<div class="section">' + esc(longDate(selDate)) + "</div>";
    var entries = db.log[sel] || [];
    if (!entries.length) {
      html += '<p class="note">' + esc(t("nothingThatDay")) + "</p>";
      view.innerHTML = html + "</div>";
      wireCalendar();
      return;
    }
    var allChs = [];
    entries.forEach(function (e) { allChs = allChs.concat(e.chapters); });
    loadChapters(allChs).then(function () {
      if (location.hash.indexOf("#/record") !== 0) return;
      html += '<div class="card">' + entries.map(function (e) {
        var s = db.summaries[rangeKey(e.chapters, e.mode || "together")];
        var sub = s ? (s.data.message || "") : "";
        return '<a class="row-item" href="#/day/' + sel + '"><span class="row-stack"><span style="font-size:17px;font-weight:600">' + esc(rangeLabel(e.chapters)) + "</span>" +
          (sub ? '<span class="sub">' + esc(sub.length > 40 ? sub.slice(0, 40) + "…" : sub) + "</span>" : "") + "</span>" + icons.chev + "</a>";
      }).join("") + "</div></div>";
      view.innerHTML = html;
      wireCalendar();
    });
  }
  function wireCalendar() {
    document.getElementById("prevM").onclick = function () {
      var m = ui.month.m - 1, y = ui.month.y; if (m < 0) { m = 11; y--; }
      ui.month = { y: y, m: m }; renderRecord();
    };
    document.getElementById("nextM").onclick = function () {
      var m = ui.month.m + 1, y = ui.month.y; if (m > 11) { m = 0; y++; }
      ui.month = { y: y, m: m }; renderRecord();
    };
    Array.prototype.forEach.call(view.querySelectorAll(".day[data-date]"), function (b) {
      b.onclick = function () { ui.selected = b.getAttribute("data-date"); renderRecord(); };
    });
  }

  function renderDay(key) {
    renderTabs(null);
    teardownReadingBar();
    var entries = db.log[key] || [];
    var allChs = [];
    entries.forEach(function (e) { allChs = allChs.concat(e.chapters); });
    loadChapters(allChs).then(function () {
      var html = '<div class="bar"><a class="round small" href="#/record" aria-label="' + esc(t("back")) + '">' + icons.left + '</a><span class="bar-title">' + esc(longDate(parseKey(key))) + "</span><span></span></div>";
      html += '<div class="content">';
      if (!entries.length) {
        html += '<p class="note" style="margin-top:20px">' + esc(t("nothingThatDay")) + "</p></div>";
        view.innerHTML = html;
        view.className = "screen no-tabs";
        return;
      }
      html += '<h1 class="answer" style="margin-top:20px">' + esc(rangeLabel(allChs)) + "</h1>";
      entries.forEach(function (e, i) {
        html += '<div class="section">' + esc(entries.length > 1 ? rangeLabel(e.chapters) : t("summary")) + "</div>";
        html += summaryBlock(e.chapters, e.mode || "together", { readOnly: true });
        var open = ui.openPassage[key + i];
        html += '<button class="link-btn" type="button" data-toggle="' + i + '">' + esc(open ? t("hidePassage") : t("showPassage")) + "</button>";
        if (open) html += '<div class="card passage-card">' + passageHTML(e.chapters) + "</div>";
      });
      view.innerHTML = html + "</div>";
      view.className = "screen no-tabs";
      Array.prototype.forEach.call(view.querySelectorAll("[data-toggle]"), function (b) {
        b.onclick = function () { var i = b.getAttribute("data-toggle"); ui.openPassage[key + i] = !ui.openPassage[key + i]; renderDay(key); };
      });
    });
  }

  function segHTML(name, options, value) {
    return '<div class="seg" role="group" style="grid-template-columns:repeat(' + options.length + ',minmax(0,1fr))">' +
      options.map(function (o) {
        return '<button type="button" data-seg="' + name + '" data-val="' + esc(o.v) + '" aria-pressed="' + (String(o.v) === String(value)) + '">' + esc(o.l) + "</button>";
      }).join("") + "</div>";
  }

  function renderSettings() {
    renderTabs(null);
    teardownReadingBar();
    var s = db.settings;
    var key = getKey();
    var bm = db.bookmark && db.bookmark.c > 0 ? bookName(db.bookmark.b) + " " + t("chapterN", { n: db.bookmark.c }) : t("notSet");
    var html = '<div class="bar"><a class="round small" href="#/today" aria-label="' + esc(t("close")) + '">' + icons.x + '</a><span class="bar-title">' + esc(t("settings")) + "</span><span></span></div>";
    html += '<div class="content">';

    html += '<div class="section">' + esc(t("reading")) + '</div><div class="card">' +
      '<div class="block"><span>' + esc(t("perDay")) + "</span>" + segHTML("perDay", [1, 2, 3, 4, 5].map(function (n) { return { v: n, l: t("chapters", { n: n }) }; }), s.perDay) + "</div>" +
      '<a class="row-item" href="#/pick"><span>' + esc(t("lastRead")) + '</span><span class="row-value">' + esc(bm) + icons.chev + "</span></a>" +
      '<div class="row-item"><span>' + esc(t("translation")) + '</span><span class="row-value">' + esc(t("krv")) + "</span></div></div>";

    html += '<div class="section">' + esc(t("summarySection")) + '</div><div class="card"><div class="block"><span>' + esc(t("summaryMode")) + "</span>" +
      segHTML("mode", [{ v: "together", l: t("modeTogether") }, { v: "each", l: t("modeEach") }], s.mode) + "</div></div>";

    html += '<div class="section">' + esc(t("view")) + '</div><div class="card"><div class="block"><div style="display:flex;justify-content:space-between;align-items:center"><label for="fontSize">' + esc(t("fontSize")) + '</label><span class="row-value" id="fontVal">' + s.fontSize + "</span></div>" +
      '<input type="range" id="fontSize" min="15" max="22" step="1" value="' + s.fontSize + '">' +
      '<p class="verse" id="fontSample" style="margin:0">' + esc("태초에 하나님이 천지를 창조하시니라") + "</p></div></div>";

    html += '<div class="section">' + esc(t("aiSection")) + '</div><div class="card"><div class="block"><label for="apiKey">' + esc(t("apiKey")) + "</label>" +
      '<input class="field" id="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(t("apiKeyPlaceholder")) + '" value="' + esc(key) + '">' +
      '<div class="btn-row"><button class="pill" type="button" id="saveKey">' + esc(t("saveKey")) + "</button>" +
      (key ? '<button class="pill" type="button" id="removeKey">' + esc(t("removeKey")) + "</button>" : "") + "</div>" +
      '<p class="note" style="margin:0">' + esc(t("apiKeyHint")) + "</p></div>" +
      '<div class="block"><span>' + esc(t("model")) + "</span>" + segHTML("model", [{ v: MODELS.haiku, l: t("modelHaiku") }, { v: MODELS.sonnet, l: t("modelSonnet") }], s.model) +
      '<p class="note" style="margin:0">' + esc(t("modelHint")) + "</p></div></div>";

    html += '<div class="section">' + esc(t("backup")) + '</div><div class="card">' +
      '<button class="row-item" type="button" id="exportBtn"><span>' + esc(t("exportData")) + "</span>" + icons.chev + "</button>" +
      '<button class="row-item" type="button" id="importBtn"><span>' + esc(t("importData")) + "</span>" + icons.chev + "</button></div>" +
      '<input type="file" id="importFile" accept="application/json,.json" class="sr-only" tabindex="-1">' +
      '<p class="note" style="margin-top:8px">' + esc(t("backupHint")) + "</p>";

    html += '<div class="note-box" style="margin-top:24px">' + esc(t("source")) + "</div></div>";
    view.innerHTML = html;
    view.className = "screen no-tabs";

    Array.prototype.forEach.call(view.querySelectorAll("[data-seg]"), function (b) {
      b.onclick = function () {
        var name = b.getAttribute("data-seg"), val = b.getAttribute("data-val");
        db.settings[name] = name === "perDay" ? Number(val) : val;
        save();
        renderSettings();
      };
    });
    var range = document.getElementById("fontSize");
    range.oninput = function () {
      db.settings.fontSize = Number(range.value);
      document.getElementById("fontVal").textContent = range.value;
      applyFont();
      save();
    };
    document.getElementById("saveKey").onclick = function () {
      var v = document.getElementById("apiKey").value.trim();
      setKey(v);
      failed = {};
      toast(v ? t("keySaved") : t("keyRemoved"));
      renderSettings();
    };
    var rm = document.getElementById("removeKey");
    if (rm) rm.onclick = function () { setKey(""); toast(t("keyRemoved")); renderSettings(); };
    document.getElementById("exportBtn").onclick = exportData;
    var file = document.getElementById("importFile");
    document.getElementById("importBtn").onclick = function () { file.click(); };
    file.onchange = function () { if (file.files[0]) importData(file.files[0]); };
  }

  function exportData() {
    var blob = new Blob([JSON.stringify({ app: "manna", version: 1, exportedAt: new Date().toISOString(), data: db }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "manna-" + todayKey() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast(t("exported"));
  }
  function importData(f) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var json = JSON.parse(reader.result);
        var d = json && (json.app === "manna" || json.app === "daily-chapters") ? json.data : null;
        if (!d || typeof d.log !== "object") throw new Error("bad");
        db = {
          settings: Object.assign({}, defaults.settings, d.settings || {}),
          bookmark: d.bookmark || null,
          log: d.log || {},
          summaries: d.summaries || {}
        };
        save();
        applyFont();
        toast(t("imported"));
        renderSettings();
      } catch (e) {
        toast(t("importFail"));
      }
    };
    reader.readAsText(f);
  }

  function renderPick() {
    renderTabs(null);
    teardownReadingBar();
    var cur = db.bookmark && db.bookmark.c > 0 ? db.bookmark : null;
    var html = '<div class="bar"><a class="round small" href="#/settings" aria-label="' + esc(t("back")) + '">' + icons.left + '</a><span class="bar-title">' + esc(t("pickTitle")) + "</span><span></span></div><div class=\"content\">";
    function grid(from, to) {
      var g = '<div class="book-grid">';
      for (var i = from; i <= to; i++) g += '<button type="button" data-book="' + i + '" aria-pressed="' + (ui.pickBook === i) + '">' + esc(bookName(i)) + "</button>";
      return g + "</div>";
    }
    if (ui.pickBook) {
      var b = ui.pickBook;
      html += '<div class="section">' + esc(t("pickChapter", { book: bookName(b) })) + '</div><div class="ch-grid">';
      for (var c = 1; c <= books[b - 1].chapters; c++) {
        var on = cur && cur.b === b && cur.c === c;
        html += '<button type="button" data-ch="' + c + '" aria-pressed="' + !!on + '">' + c + "</button>";
      }
      html += '</div><button class="link-btn" type="button" id="otherBook">' + esc(t("pickTitle")) + " · " + esc(t("oldTestament")) + " / " + esc(t("newTestament")) + "</button>";
    } else {
      html += '<div class="section">' + esc(t("oldTestament")) + "</div>" + grid(1, 39) + '<div class="section">' + esc(t("newTestament")) + "</div>" + grid(40, 66);
    }
    view.innerHTML = html + "</div>";
    view.className = "screen no-tabs";
    Array.prototype.forEach.call(view.querySelectorAll("[data-book]"), function (btn) {
      btn.onclick = function () { ui.pickBook = Number(btn.getAttribute("data-book")); renderPick(); window.scrollTo(0, 0); };
    });
    Array.prototype.forEach.call(view.querySelectorAll("[data-ch]"), function (btn) {
      btn.onclick = function () {
        db.bookmark = { b: ui.pickBook, c: Number(btn.getAttribute("data-ch")) };
        save();
        ui.extra = !!db.log[todayKey()];
        toast(t("placeSaved"));
        location.hash = "#/today";
      };
    });
    var ob = document.getElementById("otherBook");
    if (ob) ob.onclick = function () { ui.pickBook = 0; renderPick(); };
  }

  // ---------- Router ----------
  function render() {
    applyFont();
    view.className = "screen";
    var h = location.hash || "#/today";
    if (h.indexOf("#/record") === 0) return renderRecord();
    if (h.indexOf("#/day/") === 0) return renderDay(h.slice(6));
    if (h.indexOf("#/settings") === 0) return renderSettings();
    if (h.indexOf("#/pick") === 0) {
      if (ui.pickBook == null) ui.pickBook = db.bookmark && db.bookmark.c > 0 ? db.bookmark.b : 0;
      return renderPick();
    }
    return renderToday();
  }
  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("#/pick") !== 0) ui.pickBook = null;
    if (toastEl.querySelector("button")) toastEl.innerHTML = "";
    window.scrollTo(0, 0);
    render();
  });

  // A new day while the page stays open
  var lastDay = todayKey();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && todayKey() !== lastDay) {
      lastDay = todayKey();
      ui.extra = false;
      render();
    }
  });

  fetchJSON("data/books.json").then(function (b) {
    books = b;
    render();
  }).catch(function () {
    view.innerHTML = '<div class="content"><p class="warn" style="margin-top:40px">Could not load data.</p></div>';
  });
})();
