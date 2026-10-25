(function () {
  "use strict";

  // ---------- Text ----------
  var S = window.STRINGS.ko;
  function t(key, vars) {
    var s = S[key];
    if (s == null) s = window.STRINGS.ko[key];
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
  var TRANSLATIONS = { krv: { lang: "ko", label: "trKrv" }, web: { lang: "en", label: "trWeb" } };
  var phoneKo = /^ko/i.test((navigator.languages && navigator.languages[0]) || navigator.language || "");
  function freshDefaults() {
    return {
      settings: { perDay: 3, mode: "together", fontSize: 17, model: MODELS.haiku, lang: phoneKo ? "ko" : "en", translation: phoneKo ? "krv" : "web" },
      bookmark: null,
      log: {},
      summaries: {}
    };
  }
  function normalize(d) {
    var base = freshDefaults();
    var s = d.settings || {};
    // Older saves had no translation. Match it to their language.
    if (!s.translation) s.translation = s.lang === "en" ? "web" : (s.lang ? "krv" : base.settings.translation);
    return {
      settings: Object.assign({}, base.settings, s),
      bookmark: d.bookmark || null,
      log: d.log || {},
      summaries: d.summaries || {}
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? normalize(JSON.parse(raw)) : freshDefaults();
    } catch (e) {
      return freshDefaults();
    }
  }
  var db = load();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* storage full or blocked */ }
  }
  function getKey() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) {} }

  function applyLang() {
    S = window.STRINGS[db.settings.lang] || window.STRINGS.ko;
    document.documentElement.lang = db.settings.lang;
  }
  function trLang(tr) { return (TRANSLATIONS[tr] || TRANSLATIONS.krv).lang; }
  function trName(tr) { return t((TRANSLATIONS[tr] || TRANSLATIONS.krv).label); }

  // ---------- Dates ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function longDate(d) {
    return new Intl.DateTimeFormat(S.locale, { month: "long", day: "numeric", weekday: "long" }).format(d);
  }
  function monthName(y, m) {
    return new Intl.DateTimeFormat(S.locale, { month: "long" }).format(new Date(y, m, 1));
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
  function nameIn(id, lang) { var b = books[id - 1]; return b ? (lang === "ko" ? b.ko : b.en) : ""; }
  function bookName(id) { return nameIn(id, db.settings.lang); }
  function fetchJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }
  function loadBook(id, tr) {
    var k = tr + id;
    if (bookCache[k]) return Promise.resolve(bookCache[k]);
    return fetchJSON("data/" + tr + "/" + pad(id) + ".json").then(function (d) { bookCache[k] = d; return d; });
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
  function chapterLabel(b, c) { return t("rangeOne", { b: bookName(b), c: c }); }
  function rangeLabel(chs) {
    var groups = [];
    chs.forEach(function (x) {
      var g = groups[groups.length - 1];
      if (g && g.b === x[0] && g.to === x[1] - 1) g.to = x[1];
      else groups.push({ b: x[0], from: x[1], to: x[1] });
    });
    return groups.map(function (g) {
      return g.from === g.to ? chapterLabel(g.b, g.from) : t("rangeMany", { b: bookName(g.b), from: g.from, to: g.to });
    }).join(t("rangeJoin"));
  }
  // Korean keys keep their original shape so earlier saves still match.
  function rangeKey(chs, mode, tr) {
    return mode + (tr && tr !== "krv" ? "|" + tr : "") + "|" + chs.map(function (x) { return x.join(":"); }).join(",");
  }
  function loadChapters(chs, tr) {
    var ids = [];
    chs.forEach(function (x) { if (ids.indexOf(x[0]) < 0) ids.push(x[0]); });
    return Promise.all(ids.map(function (id) { return loadBook(id, tr); }));
  }
  function sections(chs, tr) {
    return chs.map(function (x) {
      return { bookName: nameIn(x[0], trLang(tr)), book: x[0], chapter: x[1], verses: bookCache[tr + x[0]].chapters[x[1] - 1] };
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
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#878394" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#878394" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#878394" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    book: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 7h6"/></svg>',
    cal: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  // Phones show tabs at the bottom only on the main screens.
  // Laptops always show them as a top bar with the app name.
  function renderTabs(active) {
    tabs.className = "tabs" + (active ? "" : " hide-m");
    tabs.setAttribute("aria-label", t("menu"));
    tabs.innerHTML = '<div class="inner"><a class="brand" href="#/today">Manna</a>' +
      '<a href="#/today"' + (active === "today" ? ' aria-current="page"' : "") + ">" + icons.book + "<span>" + esc(t("tabToday")) + "</span></a>" +
      '<a href="#/record"' + (active === "record" ? ' aria-current="page"' : "") + ">" + icons.cal + "<span>" + esc(t("tabRecord")) + "</span></a></div>";
    // Tapping the tab you are already on scrolls back to the top.
    Array.prototype.forEach.call(tabs.querySelectorAll("a"), function (a) {
      a.onclick = function (e) {
        var here = location.hash || "#/today";
        if (a.getAttribute("href") !== here) return;
        e.preventDefault();
        var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
      };
    });
  }
  function applyFont() { document.documentElement.style.setProperty("--reading-size", db.settings.fontSize + "px"); }
  function showLoadError() {
    view.innerHTML = '<div class="content"><p class="warn" style="margin-top:40px">' + esc(t("loadError")) + "</p></div>";
  }

  // ---------- Summary ----------
  var inflight = {};
  var failed = {};
  function verseLookup(ref, tr) {
    var m = /^(.+?)\s*(\d+)\s*:\s*(\d+)/.exec(ref || "");
    if (!m) return null;
    var name = m[1].trim().toLowerCase(), c = +m[2], v = +m[3];
    var id = 0;
    books.forEach(function (b) { if (b.ko === m[1].trim() || b.en.toLowerCase() === name) id = b.id; });
    if (!id || !bookCache[tr + id]) return { label: ref, text: "" };
    var ch = bookCache[tr + id].chapters[c - 1];
    return { label: t("verseRef", { c: c, v: v }), text: ch && ch[v - 1] ? ch[v - 1] : "" };
  }
  function pointsHTML(points) {
    return '<ol class="points">' + (points || []).map(function (p, i) {
      return '<li><span class="num">' + (i + 1) + "</span><span>" + esc(p) + "</span></li>";
    }).join("") + "</ol>";
  }
  function summaryHTML(data, tr) {
    var lang = trLang(tr);
    var html = '<div class="summary" lang="' + lang + '">';
    if (data.chapters) {
      data.chapters.forEach(function (c) { html += '<div class="chapter-title">' + esc(c.title) + "</div>" + pointsHTML(c.points); });
    } else {
      html += pointsHTML(data.points);
    }
    var kv = verseLookup(data.key_verse, tr);
    if (kv) {
      html += '<div class="divider"></div><div><div class="verse-label" lang="' + esc(db.settings.lang) + '">' + esc(t("keyVerse")) + " · " + esc(kv.label) + "</div>" +
        (kv.text ? '<div class="verse-text">' + esc(kv.text) + "</div>" : "") + "</div>";
    }
    html += '<div class="message"><span class="message-label" lang="' + esc(db.settings.lang) + '">' + esc(t("keyMessage")) + '</span><span class="message-text">' + esc(data.message) + "</span></div>";
    return html + "</div>";
  }
  function skeleton() {
    return '<div class="card pad"><div class="skeleton" role="status" aria-label="' + esc(t("summaryLoading")) + '"><span></span><span></span><span></span></div></div>';
  }
  function summaryBlock(chs, mode, tr, opts) {
    var key = rangeKey(chs, mode, tr);
    var cached = db.summaries[key];
    if (cached) return '<div class="card pad">' + summaryHTML(cached.data, tr) + "</div>";
    if (opts && opts.readOnly) return '<div class="note-box">' + esc(t("noSummarySaved")) + "</div>";
    var apiKey = getKey();
    if (inflight[key]) return skeleton();
    if (apiKey && !failed[key]) { requestSummary(chs, mode, tr); return skeleton(); }
    var html = '<div class="card pad" style="display:flex;flex-direction:column;gap:12px">';
    if (failed[key]) html += '<div class="warn">' + esc(t("summaryError", { msg: failed[key] })) + "</div>";
    else html += '<div class="note">' + esc(t("noKey")) + "</div>";
    html += '<div class="btn-row">';
    if (apiKey) html += '<button class="pill" type="button" data-act="retry">' + esc(t("retrySummary")) + "</button>";
    else html += '<a class="pill" style="display:inline-flex;align-items:center;text-decoration:none" href="#/settings">' + esc(t("addKey")) + "</a>";
    html += '<button class="pill" type="button" data-act="copy">' + esc(t("copyPrompt")) + "</button></div></div>";
    return html;
  }
  function requestSummary(chs, mode, tr) {
    var key = rangeKey(chs, mode, tr);
    inflight[key] = true;
    delete failed[key];
    window.Summary.request(getKey(), db.settings.model, sections(chs, tr), mode, trLang(tr)).then(function (data) {
      db.summaries[key] = { data: data, at: Date.now(), model: db.settings.model };
      save();
    }).catch(function (err) {
      failed[key] = err.message || String(err);
    }).then(function () {
      delete inflight[key];
      refreshSummary(chs, mode, tr);
    });
  }
  function refreshSummary(chs, mode, tr) {
    var slot = view.querySelector('[data-key="' + CSS.escape(rangeKey(chs, mode, tr)) + '"]');
    if (!slot) return;
    slot.innerHTML = summaryBlock(chs, mode, tr);
    wireSummary(slot, chs, mode, tr);
  }
  function wireSummary(slot, chs, mode, tr) {
    var r = slot.querySelector('[data-act="retry"]');
    if (r) r.onclick = function () { delete failed[rangeKey(chs, mode, tr)]; requestSummary(chs, mode, tr); refreshSummary(chs, mode, tr); };
    var c = slot.querySelector('[data-act="copy"]');
    if (c) c.onclick = function () {
      var text = window.Summary.fullCopyText(sections(chs, tr), mode, trLang(tr));
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
  function passageHTML(chs, tr) {
    return '<div lang="' + trLang(tr) + '">' + sections(chs, tr).map(function (s, i) {
      return '<section class="chapter" id="ch-' + i + '"><div class="chapter-break"><span>' + esc(chapterLabel(s.book, s.chapter)) + "</span><i></i></div>" +
        s.verses.map(function (v, j) { return '<p class="verse"><sup>' + (j + 1) + "</sup>" + esc(v) + "</p>"; }).join("") + "</section>";
    }).join("") + "</div>";
  }

  // Sticky bar with chapter progress while reading
  var scrollHandler = null;
  // Phones show progress in a bar that slides in at the top.
  // Laptops show the same progress at the top of the summary column.
  function progressHTML(n) {
    return '<div class="row"><span class="title js-title"></span><span class="note js-count"></span></div>' +
      '<div class="progress" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' +
      Array.apply(null, Array(n)).map(function () { return '<div><b style="width:0"></b></div>'; }).join("") + "</div>";
  }
  function setupReadingBar(chs) {
    teardownReadingBar();
    bar.innerHTML = '<div class="inner">' + progressHTML(chs.length) + "</div>";
    var side = document.getElementById("sideProgress");
    if (side) side.innerHTML = progressHTML(chs.length);
    var holders = [bar, side].filter(Boolean);
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
        var w = Math.max(0, Math.min(1, p)) * 100 + "%";
        holders.forEach(function (h) { h.querySelectorAll(".progress b")[i].style.width = w; });
      }
      holders.forEach(function (h) {
        h.querySelector(".js-title").textContent = chapterLabel(chs[current][0], chs[current][1]);
        h.querySelector(".js-count").textContent = t("progress", { i: current + 1, n: chs.length });
      });
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

  // Expands in place: a card row with a chevron down, opening inside the same card.
  function disclosure(id, label, open, inner) {
    return '<div class="card disc"><button class="disc-head" type="button" data-disc="' + id + '" aria-expanded="' + !!open + '" aria-controls="' + id + '-body"><span>' + esc(label) + "</span>" + (open ? icons.up : icons.down) + "</button>" +
      (open ? '<div class="disc-body" id="' + id + '-body">' + inner + "</div>" : "") + "</div>";
  }

  // ---------- Screens ----------
  var ui = { extra: false, month: null, selected: null, openPassage: {}, pickBook: null, resetOpen: false };
  function onRoute(prefix) { var h = location.hash || "#/today"; return h.indexOf(prefix) === 0; }
  function entryTr(e) { return e.tr || "krv"; }

  function streakChip() {
    var n = streak();
    return '<span class="streak' + (n ? "" : " off") + '">' + icons.flame + esc(n ? t("streakDays", { n: n }) : t("streakStart")) + "</span>";
  }

  var logo = '<div class="w-brand"><svg width="22" height="22" viewBox="120 120 272 272" aria-hidden="true"><path d="M256 150c-40-22-92-28-136-20v228c44-8 96-2 136 20" fill="#E7F1EB" stroke="#2F6B4F" stroke-width="22" stroke-linejoin="round"/><path d="M256 150c40-22 92-28 136-20v228c-44-8-96-2-136 20" fill="#E7F1EB" stroke="#2F6B4F" stroke-width="22" stroke-linejoin="round"/><path d="M256 150v228" stroke="#2F6B4F" stroke-width="22" stroke-linecap="round"/></svg><span>Manna</span></div>';
  var featureIcons = [
    '<path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z"/>',
    '<path d="M12 2l2.4 6.2L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.8z"/>',
    '<path d="M5 5h14a2 2 0 0 1 2 2v1.5H3V7a2 2 0 0 1 2-2z"/><path d="M3 10.5h18V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="7" y="2" width="2" height="5" rx="1"/><rect x="15" y="2" width="2" height="5" rx="1"/>'
  ];
  // First open. Story at the top, actions at the bottom in thumb reach.
  function renderWelcome() {
    teardownReadingBar();
    tabs.className = "tabs hide-all";
    view.className = "screen welcome-screen";
    var feats = ["welcomeF1", "welcomeF2", "welcomeF3"].map(function (k, i) {
      return '<li><span class="w-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="#2F6B4F" aria-hidden="true">' + featureIcons[i] + "</svg></span><span>" + esc(t(k)) + "</span></li>";
    }).join("");
    view.innerHTML = '<div class="welcome"><div class="w-intro">' + logo +
      '<h1 class="w-title">' + esc(t("welcomeTitle")) + '</h1><ul class="w-feats">' + feats + "</ul></div>" +
      '<div class="w-gap"></div>' +
      '<div class="w-form"><span class="w-card-title">' + esc(t("welcomeCard")) + '</span><p class="w-card-body">' + esc(t("welcomeBody")) + "</p>" +
      '<a class="btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="#/pick">' + esc(t("pickPlace")) + "</a>" +
      '<button class="btn secondary" type="button" id="startGen">' + esc(t("startGenesis")) + "</button>" +
      '<a class="w-note" href="#/settings">' + esc(t("welcomeNote")) + "</a></div></div>";
    document.getElementById("startGen").onclick = function () { db.bookmark = { b: 1, c: 0 }; save(); render(); };
  }

  function renderToday() {
    renderTabs("today");
    var today = todayKey();
    var head = '<header class="top"><div class="top-row">' + streakChip() +
      '<a class="round" href="#/settings" aria-label="' + esc(t("settings")) + '">' + icons.gear + "</a></div>";

    if (!db.bookmark) { renderWelcome(); return; }

    var entries = db.log[today] || [];
    var mode = db.settings.mode;
    var tr = db.settings.translation;

    if (entries.length > 0 && !ui.extra) {
      var last = entries[entries.length - 1];
      var allChs = [];
      entries.forEach(function (e) { allChs = allChs.concat(e.chapters); });
      var needs = entries.map(function (e) { return loadChapters(e.chapters, tr); });
      Promise.all(needs).then(function () {
        if (!onRoute("#/today")) return;
        var html = head + '<span class="top-label">' + esc(t("doneToday") + " · " + longDate(new Date())) + '</span><h1 class="answer">' + esc(rangeLabel(allChs)) + "</h1></header>";
        html += '<div class="content"><div class="cols"><div class="col side">';
        entries.forEach(function (e, idx) {
          var m = e.mode || "together";
          var isLast = idx === entries.length - 1;
          html += '<div class="section">' + esc(entries.length > 1 ? rangeLabel(e.chapters) : t("summary")) + "</div>";
          html += '<div id="' + (isLast ? "summarySlot" : "s" + idx) + '" data-key="' + esc(rangeKey(e.chapters, m, tr)) + '">' + summaryBlock(e.chapters, m, tr) + "</div>";
        });
        html += '</div><div class="col main">';
        var inner = ui.openPassage.today ? entries.map(function (e) { return passageHTML(e.chapters, tr); }).join("") : "";
        html += disclosure("today", t("passage", { tr: trName(tr) }), ui.openPassage.today, inner);
        html += '<div class="done-area"><button class="btn secondary" type="button" id="readMore">' + esc(t("readMore", { n: db.settings.perDay })) + "</button></div></div></div></div>";
        view.innerHTML = html;
        teardownReadingBar();
        entries.forEach(function (e) {
          var sl = view.querySelector('[data-key="' + CSS.escape(rangeKey(e.chapters, e.mode || "together", tr)) + '"]');
          if (sl) wireSummary(sl, e.chapters, e.mode || "together", tr);
        });
        view.querySelector('[data-disc="today"]').onclick = function () { ui.openPassage.today = !ui.openPassage.today; renderToday(); };
        document.getElementById("readMore").onclick = function () { ui.extra = true; window.scrollTo(0, 0); renderToday(); };
      }).catch(showLoadError);
      return;
    }

    var chs = upcoming(db.settings.perDay);
    loadChapters(chs, tr).then(function () {
      if (!onRoute("#/today")) return;
      var html = head + '<span class="top-label">' + esc(t("today") + " · " + longDate(new Date())) + '</span><h1 class="answer">' + esc(rangeLabel(chs)) + "</h1></header>";
      html += '<div class="content reading"><div class="cols"><div class="col side"><div class="section">' + esc(t("summary")) + "</div>";
      html += '<div id="summarySlot" data-key="' + esc(rangeKey(chs, mode, tr)) + '">' + summaryBlock(chs, mode, tr) + "</div>";
      html += '<p class="note" style="margin-top:8px">' + esc(t("summaryNote")) + "</p>";
      html += '<div class="side-progress" id="sideProgress" aria-hidden="true"></div>';
      html += '</div><div class="col main"><div class="section">' + esc(t("passage", { tr: trName(tr) })) + "</div>";
      html += '<div class="card passage-card">' + passageHTML(chs, tr) + "</div>";
      html += '<div class="done-area"><button class="btn" type="button" id="done">' + esc(t("doneReading")) + "</button></div></div></div></div>";
      view.innerHTML = html;
      wireSummary(document.getElementById("summarySlot"), chs, mode, tr);
      setupReadingBar(chs);
      document.getElementById("done").onclick = function () { markRead(chs, mode, tr); };
    }).catch(showLoadError);
  }

  function markRead(chs, mode, tr) {
    var today = todayKey();
    var prevBookmark = db.bookmark ? { b: db.bookmark.b, c: db.bookmark.c } : null;
    db.log[today] = db.log[today] || [];
    db.log[today].push({ chapters: chs, mode: mode, tr: tr, at: Date.now() });
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
    html += '<div class="content"><div class="cols"><div class="col"><div class="cal-head"><button class="round small" type="button" id="prevM" aria-label="' + esc(t("prevMonth")) + '">' + icons.left + "</button>" +
      "<span>" + esc(t("monthTitle", { y: y, m: m + 1, month: monthName(y, m) })) + '</span><button class="round small" type="button" id="nextM" aria-label="' + esc(t("nextMonth")) + '">' + icons.right + "</button></div>";
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
    html += "</div></div></div><div class=\"col day-col\">";

    var entries = db.log[sel] || [];
    if (!entries.length) {
      view.innerHTML = html + '<div class="card jcard"><span class="j-date">' + esc(longDate(parseKey(sel))) + '</span><span class="j-msg muted">' + esc(t("nothingThatDay")) + "</span></div></div></div></div>";
      wireCalendar();
      return;
    }
    html += '<div class="j-list">' + entries.map(function (e) {
      var curTr = db.settings.translation;
      var sc = db.summaries[rangeKey(e.chapters, e.mode || "together", curTr)];
      var s = sc || db.summaries[rangeKey(e.chapters, e.mode || "together", entryTr(e))];
      var msgTr = sc ? curTr : entryTr(e);
      var msg = s ? (s.data.message || "") : "";
      return '<a class="card jcard" href="#/day/' + sel + '"><span class="j-head"><span class="j-meta"><span class="j-date">' + esc(longDate(parseKey(sel))) + '</span>' +
        '<span class="j-title">' + esc(rangeLabel(e.chapters)) + "</span></span>" + icons.chev + "</span>" +
        (msg ? '<span class="j-msg" lang="' + trLang(msgTr) + '">' + esc(msg) + "</span>" : "") + "</a>";
    }).join("") + "</div></div></div></div>";
    view.innerHTML = html;
    wireCalendar();
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
    view.className = "screen no-tabs";
    var entries = db.log[key] || [];
    var tr = db.settings.translation;
    var allChs = [];
    entries.forEach(function (e) { allChs = allChs.concat(e.chapters); });
    Promise.all(entries.map(function (e) { return loadChapters(e.chapters, tr); })).then(function () {
      if (!onRoute("#/day/")) return;
      var html = '<div class="bar narrow"><a class="round small" href="#/record" aria-label="' + esc(t("back")) + '">' + icons.left + '</a><span class="bar-title">' + esc(longDate(parseKey(key))) + "</span><span></span></div>";
      html += '<div class="content narrow">';
      if (!entries.length) {
        view.innerHTML = html + '<p class="note" style="margin-top:20px">' + esc(t("nothingThatDay")) + "</p></div>";
        return;
      }
      html += '<h1 class="answer" style="margin-top:20px">' + esc(rangeLabel(allChs)) + "</h1>";
      entries.forEach(function (e, i) {
        html += '<div class="section">' + esc(entries.length > 1 ? rangeLabel(e.chapters) : t("summary")) + "</div>";
        html += '<div class="slot" data-key="' + esc(rangeKey(e.chapters, e.mode || "together", tr)) + '">' + summaryBlock(e.chapters, e.mode || "together", tr) + '</div>';
        var open = ui.openPassage[key + i];
        html += disclosure("d" + i, t("passage", { tr: trName(tr) }), open, open ? passageHTML(e.chapters, tr) : "");
      });
      view.innerHTML = html + "</div>";
      entries.forEach(function (e) {
        var sl = view.querySelector('[data-key="' + CSS.escape(rangeKey(e.chapters, e.mode || "together", tr)) + '"]');
        if (sl) wireSummary(sl, e.chapters, e.mode || "together", tr);
      });
      Array.prototype.forEach.call(view.querySelectorAll("[data-disc]"), function (b) {
        b.onclick = function () { var i = b.getAttribute("data-disc").slice(1); ui.openPassage[key + i] = !ui.openPassage[key + i]; renderDay(key); };
      });
    }).catch(showLoadError);
  }

  function segHTML(name, options, value, label) {
    return '<div class="seg" role="group" aria-label="' + esc(label) + '" style="grid-template-columns:repeat(' + options.length + ',minmax(0,1fr))">' +
      options.map(function (o) {
        return '<button type="button" data-seg="' + name + '" data-val="' + esc(o.v) + '" aria-pressed="' + (String(o.v) === String(value)) + '"' + (o.lang ? ' lang="' + o.lang + '"' : "") + ">" + esc(o.l) + "</button>";
      }).join("") + "</div>";
  }

  function renderSettings() {
    renderTabs(null);
    teardownReadingBar();
    view.className = "screen no-tabs";
    var s = db.settings;
    var key = getKey();
    var bm = db.bookmark && db.bookmark.c > 0 ? chapterLabel(db.bookmark.b, db.bookmark.c) : t("notSet");
    var html = '<div class="bar narrow"><a class="round small" href="#/today" aria-label="' + esc(t("close")) + '">' + icons.x + '</a><h1 class="bar-title">' + esc(t("settings")) + "</h1><span></span></div>";
    html += '<div class="content narrow">';

    html += '<div class="section">' + esc(t("reading")) + '</div><div class="card">' +
      '<div class="block"><span>' + esc(t("perDay")) + "</span>" + segHTML("perDay", [1, 2, 3, 4, 5].map(function (n) { return { v: n, l: t("chapters", { n: n }) }; }), s.perDay, t("perDay")) + "</div>" +
      '<a class="row-item" href="#/pick"><span>' + esc(t("lastRead")) + '</span><span class="row-value">' + esc(bm) + icons.chev + "</span></a>" +
      '<div class="block"><span>' + esc(t("translation")) + "</span>" + segHTML("translation", [{ v: "krv", l: t("trKrv"), lang: "ko" }, { v: "web", l: t("trWeb"), lang: "en" }], s.translation, t("translation")) +
      '<p class="note" style="margin:0">' + esc(t("translationHint")) + "</p></div></div>";

    html += '<div class="section">' + esc(t("summarySection")) + '</div><div class="card"><div class="block"><span>' + esc(t("summaryMode")) + "</span>" +
      segHTML("mode", [{ v: "together", l: t("modeTogether") }, { v: "each", l: t("modeEach") }], s.mode, t("summaryMode")) + "</div></div>";

    html += '<div class="section">' + esc(t("view")) + '</div><div class="card">' +
      '<div class="block"><span>' + esc(t("language")) + "</span>" + segHTML("lang", [{ v: "ko", l: "한국어", lang: "ko" }, { v: "en", l: "English", lang: "en" }], s.lang, t("language")) + "</div>" +
      '<div class="block"><div style="display:flex;justify-content:space-between;align-items:center"><label for="fontSize">' + esc(t("fontSize")) + '</label><span class="row-value" id="fontVal">' + s.fontSize + "</span></div>" +
      '<input type="range" id="fontSize" min="15" max="22" step="1" value="' + s.fontSize + '">' +
      '<p class="verse" style="margin:0" lang="' + trLang(s.translation) + '">' + esc(s.translation === "web" ? window.STRINGS.en.fontSample : window.STRINGS.ko.fontSample) + "</p></div></div>";

    html += '<div class="section">' + esc(t("aiSection")) + '</div><div class="card"><div class="block"><label for="apiKey">' + esc(t("apiKey")) + "</label>" +
      '<input class="field" id="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(t("apiKeyPlaceholder")) + '" value="' + esc(key) + '">' +
      '<div class="btn-row"><button class="pill" type="button" id="saveKey">' + esc(t("saveKey")) + "</button>" +
      (key ? '<button class="pill" type="button" id="removeKey">' + esc(t("removeKey")) + "</button>" : "") + "</div>" +
      '<p class="note" style="margin:0">' + esc(t("apiKeyHint")) + "</p></div>" +
      '<div class="block"><span>' + esc(t("model")) + "</span>" + segHTML("model", [{ v: MODELS.haiku, l: t("modelHaiku") }, { v: MODELS.sonnet, l: t("modelSonnet") }], s.model, t("model")) +
      '<p class="note" style="margin:0">' + esc(t("modelHint")) + "</p></div></div>";

    html += '<div class="section">' + esc(t("backup")) + '</div><div class="card">' +
      '<button class="row-item" type="button" id="exportBtn"><span>' + esc(t("exportData")) + "</span>" + icons.chev + "</button>" +
      '<button class="row-item" type="button" id="importBtn"><span>' + esc(t("importData")) + "</span>" + icons.chev + "</button></div>" +
      '<input type="file" id="importFile" accept="application/json,.json" class="sr-only" tabindex="-1" aria-label="' + esc(t("importData")) + '">' +
      '<p class="note" style="margin-top:8px">' + esc(t("backupHint")) + "</p>";

    html += '<div class="section">' + esc(t("resetSection")) + '</div><div class="card">';
    if (!ui.resetOpen) {
      html += '<button class="row-item" type="button" id="resetOpen"><span class="warn" style="font-size:15px">' + esc(t("resetApp")) + "</span>" + icons.chev + "</button>";
    } else {
      html += '<div class="block"><span style="font-weight:600">' + esc(t("resetApp")) + "</span>" +
        '<p class="note" style="margin:0">' + esc(t("resetBody")) + "</p>" +
        '<label style="display:flex;align-items:center;gap:10px;min-height:44px"><input type="checkbox" id="resetKey" style="width:20px;height:20px;accent-color:var(--primary)"><span>' + esc(t("resetKeepKey")) + "</span></label>" +
        '<div class="btn-row"><button class="pill" type="button" id="resetExport">' + esc(t("resetExportFirst")) + "</button>" +
        '<button class="pill" type="button" id="resetCancel">' + esc(t("resetCancel")) + "</button></div>" +
        '<button class="btn danger" type="button" id="resetGo">' + esc(t("resetConfirm")) + "</button></div>";
    }
    html += "</div>";

    html += '<div class="section">' + esc(t("aboutSection")) + '</div><div class="card"><a class="row-item" href="#/design"><span>' + esc(t("designSystem")) + "</span>" + icons.chev + "</a></div>";

    html += '<div class="note-box" style="margin-top:24px">' + esc(t("source")) + "</div></div>";
    view.innerHTML = html;

    var ro = document.getElementById("resetOpen");
    if (ro) ro.onclick = function () { ui.resetOpen = true; renderSettings(); document.getElementById("resetGo").scrollIntoView({ block: "center" }); };
    var rc = document.getElementById("resetCancel");
    if (rc) rc.onclick = function () { ui.resetOpen = false; renderSettings(); };
    var rx = document.getElementById("resetExport");
    if (rx) rx.onclick = exportData;
    var rg = document.getElementById("resetGo");
    if (rg) rg.onclick = function () {
      var lang = db.settings.lang;
      if (document.getElementById("resetKey").checked) setKey("");
      try { localStorage.removeItem(STORE); } catch (e) {}
      db = freshDefaults();
      db.settings.lang = lang;
      ui = { extra: false, month: null, selected: null, openPassage: {}, pickBook: null };
      inflight = {}; failed = {};
      applyLang();
      applyFont();
      location.hash = "#/today";
      render();
      toast(t("resetDone"));
    };

    Array.prototype.forEach.call(view.querySelectorAll("[data-seg]"), function (b) {
      b.onclick = function () {
        var name = b.getAttribute("data-seg"), val = b.getAttribute("data-val");
        db.settings[name] = name === "perDay" ? Number(val) : val;
        save();
        if (name === "lang") applyLang();
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
        db = normalize(d);
        save();
        applyLang();
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
    view.className = "screen no-tabs";
    var cur = db.bookmark && db.bookmark.c > 0 ? db.bookmark : null;
    var html = '<div class="bar narrow"><a class="round small" href="' + (db.bookmark ? "#/settings" : "#/today") + '" aria-label="' + esc(t("back")) + '">' + icons.left + '</a><h1 class="bar-title">' + esc(t("pickTitle")) + '</h1><span></span></div><div class="content narrow">';
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
      html += '</div><button class="link-btn" type="button" id="otherBook">' + esc(t("allBooks")) + "</button>";
    } else {
      html += '<div class="section">' + esc(t("oldTestament")) + "</div>" + grid(1, 39) + '<div class="section">' + esc(t("newTestament")) + "</div>" + grid(40, 66);
    }
    view.innerHTML = html + "</div>";
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
    if (ob) ob.onclick = function () { ui.pickBook = 0; renderPick(); window.scrollTo(0, 0); };
  }

  // ---------- Design system ----------
  // Built from the app's own classes, so it always shows what the app really uses.
  // Colours are read from the CSS variables in styles.css.
  var DS_COLORS = [["Primary", "primary"], ["Green text", "green-text"], ["Soft", "soft"], ["Halo", "halo"], ["Background", "bg"], ["Surface", "surface"], ["Ink", "ink"], ["Muted", "muted"], ["Line", "line"], ["Chip", "chip"], ["Chip text", "chip-text"], ["Chevron", "chevron"], ["Coral text", "coral-text"], ["Coral soft", "coral-soft"]];
  function renderDesign() {
    renderTabs(null);
    teardownReadingBar();
    view.className = "screen no-tabs";
    var d = t("ds"), ko = db.settings.lang === "ko";
    var cs = getComputedStyle(document.documentElement);
    var sample = ko ? { range: "사무엘상 24~26장", date: "10월 25일 일요일", state: "오늘 읽기 완료 · 10월 25일 일요일", streak: "1일 연속", sum: "쉬운 요약", p1: "사울이 다윗을 쫓지만 다윗은 굴에서 사울을 살려 줍니다.", p2: "아비가일이 지혜롭게 다윗의 분노를 막습니다.", kvl: "핵심 구절 · 24장 6절", kv: "내가 손을 들어 여호와의 기름 부음을 받은 내 주를 치는 것은 여호와의 금하시는 것이니", ml: "핵심 메시지", msg: "나를 해친 사람에게도 직접 앙갚음하기보다 하나님께 맡기라는 메시지입니다.", pass: "본문 · 개역한글", ch: "24장", v: "사울이 블레셋 사람을 쫓다가 돌아오매", done: "읽기 완료", start: "창세기 1장부터 시작", small: "저장", week: "일월화수목금토" }
      : { range: "1 Samuel 24–26", date: "Sunday, October 25", state: "Read today · Sunday, October 25", streak: "1 day streak", sum: "Easy summary", p1: "Saul hunts David, but David spares Saul in the cave.", p2: "Abigail wisely turns away David's anger.", kvl: "Key verse · 24:6", kv: "The LORD forbid that I should do this thing to my lord, the LORD's anointed.", ml: "Key message", msg: "Leave justice to God, even with people who hurt you.", pass: "Passage · WEB", ch: "Chapter 24", v: "When Saul had returned from following the Philistines", done: "Mark as read", start: "Start from Genesis 1", small: "Save", week: "SMTWTFS" };
    var h = '<div class="bar narrow"><a class="round small" href="#/settings" aria-label="' + esc(t("back")) + '">' + icons.left + '</a><h1 class="bar-title">' + esc(t("designSystem")) + '</h1><span></span></div><div class="content narrow ds">';

    h += '<div class="section">' + esc(d.color) + '</div><div class="sw">' + DS_COLORS.map(function (c) {
      var v = cs.getPropertyValue("--" + c[1]).trim();
      return '<div><span style="background:' + v + '"></span><p>' + esc(c[0]) + "<br><i>" + esc(v) + "</i></p></div>";
    }).join("") + "</div>";

    h += '<div class="section">' + esc(d.type) + '</div><div class="card">' +
      '<div class="tr"><div class="page-title">' + esc(sample.range) + "</div><small>" + esc(d.tDisplay) + "</small></div>" +
      '<div class="tr"><div class="verse" style="margin:0;font-size:17px">' + esc(sample.v) + "</div><small>" + esc(d.tReading) + "</small></div>" +
      '<div class="tr"><div class="j-title">' + esc(sample.sum) + "</div><small>" + esc(d.tTitle) + "</small></div>" +
      '<div class="tr"><div class="message-text">' + esc(sample.p1) + "</div><small>" + esc(d.tBody) + "</small></div>" +
      '<div class="tr"><div class="note">' + esc(sample.date) + "</div><small>" + esc(d.tSmall) + "</small></div></div>";

    h += '<div class="section">' + esc(d.header) + '</div><div class="card ds-demo"><div class="top-row" style="margin-bottom:14px"><span class="streak">' + icons.flame + esc(sample.streak) + '</span><span class="round" aria-hidden="true">' + icons.gear + "</span></div>" +
      '<div class="top-label">' + esc(sample.state) + '</div><div class="answer" style="margin-top:8px">' + esc(sample.range) + "</div></div>";

    h += '<div class="section">' + esc(d.summary) + '</div><div class="card pad summary"><ol class="points">' +
      '<li><span class="num">1</span><span>' + esc(sample.p1) + '</span></li><li><span class="num">2</span><span>' + esc(sample.p2) + "</span></li></ol>" +
      '<div class="divider"></div><div><div class="verse-label">' + esc(sample.kvl) + '</div><div class="verse-text">' + esc(sample.kv) + "</div></div>" +
      '<div class="message"><span class="message-label">' + esc(sample.ml) + '</span><span class="message-text">' + esc(sample.msg) + "</span></div></div>";

    h += '<div class="section">' + esc(d.passage) + '</div><div class="card disc" style="margin-top:0"><div class="disc-head">' + esc(sample.pass) + icons.down + "</div></div>" +
      '<div class="card disc"><div class="disc-head" style="border-bottom:1px solid var(--line)">' + esc(sample.pass) + icons.up + '</div><div class="disc-body"><div class="chapter-break"><span>' + esc(sample.ch) + '</span><i></i></div><p class="verse"><sup>1</sup>' + esc(sample.v) + "</p></div></div>";

    h += '<div class="section">' + esc(d.journal) + '</div><div class="card jcard"><span class="j-head"><span class="j-meta"><span class="j-date">' + esc(sample.date) + '</span><span class="j-title">' + esc(sample.range) + "</span></span>" + icons.chev + '</span><span class="j-msg">' + esc(sample.msg) + "</span></div>";

    var days = [[18, ""], [19, ""], [20, "read"], [21, "read"], [22, ""], [23, "read"], [24, "today"], [25, "selected"], [26, "future"], [27, "future"], [28, "future"], [29, "future"], [30, "future"], [31, "future"]];
    h += '<div class="section">' + esc(d.calendar) + '</div><div class="card cal"><div class="cal-grid">' +
      sample.week.split("").map(function (w) { return '<div class="cal-week">' + esc(w) + "</div>"; }).join("") +
      days.map(function (x) { return '<div class="cal-cell">' + (x[1] === "future" ? '<button type="button" class="day future" disabled>' + x[0] + "</button>" : '<span class="day ' + x[1] + '">' + x[0] + "</span>") + "</div>"; }).join("") +
      '</div></div><p class="note" style="margin-top:8px">' + esc(d.cDays) + "</p>";

    h += '<div class="section">' + esc(d.buttons) + '</div><div style="display:flex;flex-direction:column;gap:10px"><span class="btn ds-btn">' + esc(sample.done) + '</span><span class="btn secondary ds-btn">' + esc(sample.start) + '</span><span class="btn small ds-btn">' + esc(sample.small) + "</span></div>";

    h += '<div class="section">' + esc(d.controls) + '</div><div class="card"><div class="block">' + segHTML("dsdemo", [{ v: "ko", l: "한국어", lang: "ko" }, { v: "en", l: "English", lang: "en" }], "ko", d.controls) + "</div>" +
      '<div class="row-item"><span>' + esc(t("lastRead")) + '</span><span class="row-value">' + esc(chapterLabel(9, 26)) + icons.chev + "</span></div></div>";

    h += '<div class="section">' + esc(d.rulesTitle) + '</div><div class="card">' + d.rules.map(function (r) { return '<div class="tr ds-rule">' + esc(r) + "</div>"; }).join("") + "</div>";
    view.innerHTML = h + "</div>";
    Array.prototype.forEach.call(view.querySelectorAll('[data-seg="dsdemo"]'), function (b) {
      b.onclick = function () { Array.prototype.forEach.call(view.querySelectorAll('[data-seg="dsdemo"]'), function (o) { o.setAttribute("aria-pressed", String(o === b)); }); };
    });
  }

  // ---------- Router ----------
  function render() {
    applyLang();
    applyFont();
    view.className = "screen";
    var h = location.hash || "#/today";
    if (h.indexOf("#/record") === 0) return renderRecord();
    if (h.indexOf("#/day/") === 0) return renderDay(h.slice(6));
    if (h.indexOf("#/settings") === 0) return renderSettings();
    if (h.indexOf("#/design") === 0) return renderDesign();
    if (h.indexOf("#/pick") === 0) {
      if (ui.pickBook == null) ui.pickBook = db.bookmark && db.bookmark.c > 0 ? db.bookmark.b : 0;
      return renderPick();
    }
    return renderToday();
  }
  window.addEventListener("hashchange", function () {
    if (location.hash.indexOf("#/pick") !== 0) ui.pickBook = null;
    if (location.hash.indexOf("#/settings") !== 0) ui.resetOpen = false;
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

  applyLang();
  fetchJSON("data/books.json").then(function (b) {
    books = b;
    render();
  }).catch(showLoadError);
})();
