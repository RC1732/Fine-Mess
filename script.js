/* ====================================================================
   FINE MESS — interaction
   --------------------------------------------------------------------
   1. Lines rise in cleanly as they enter the viewport (all devices).
   2. The thin progress hairline at the top fills as you scroll.
   3. DESKTOP (fine pointer): hovering near a line makes each letter
      SHATTER into many small fragments that scatter and dissolve, then
      reassemble as the cursor moves on. (No drifting dust particles.)

   Mobile / touch / reduced-motion: effect 3 is skipped — clean reveal only.

   --- Tuning knobs for the shatter (safe to tweak) ------------------- */
const RADIUS    = 155;   // cursor influence radius in px
const SPREAD    = 30;    // how far fragments fly out from the letter
const PUSH      = 28;    // extra shove directly away from the cursor
const ROTATE    = 60;    // max fragment rotation (deg) at full shatter
const GRID_COLS = 3;     // fragments across  (cols × rows = pieces per letter)
const GRID_ROWS = 3;     // fragments down    (raise both for finer grain)
const EASE      = 0.22;  // how quickly letters react / recover (higher = snappier)
/* ------------------------------------------------------------------- */

(function () {
  "use strict";
  var docEl = document.documentElement;
  docEl.classList.add("js");

  var stanzas = Array.prototype.slice.call(document.querySelectorAll(".stanza"));
  var progress = document.querySelector(".progress");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---- 1. Reveal on scroll ---- */
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    stanzas.forEach(function (s) { io.observe(s); });
  } else {
    stanzas.forEach(function (s) { s.classList.add("in"); });
  }

  /* ---- 2. Progress hairline ---- */
  function setProgress() {
    if (!progress) return;
    var max = docEl.scrollHeight - window.innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? Math.min(window.scrollY / max, 1) : 0).toFixed(4) + ")";
  }
  window.addEventListener("scroll", function () { requestAnimationFrame(setProgress); }, { passive: true });
  setProgress();

  /* ---- 3. Shatter (desktop fine-pointer only) ---- */
  if (reduce || !canHover) return;

  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };

  // Split each stanza into word/letter spans (copy stays plain text in HTML)
  stanzas.forEach(function (st) {
    var text = st.textContent;
    st.setAttribute("aria-label", text);
    var frag = document.createDocumentFragment();
    text.split(/(\s+)/).forEach(function (tok) {
      if (tok.trim() === "") { frag.appendChild(document.createTextNode(tok)); return; }
      var w = document.createElement("span");
      w.className = "word"; w.setAttribute("aria-hidden", "true");
      for (var i = 0; i < tok.length; i++) {
        var c = document.createElement("span");
        c.className = "ch"; c.textContent = tok[i];
        w.appendChild(c);
      }
      frag.appendChild(w);
    });
    st.innerHTML = ""; st.appendChild(frag);
  });

  var mouseX = -9999, mouseY = -9999, pointerIn = false;
  var active = null, letters = [];

  function measureHomes() {
    for (var i = 0; i < letters.length; i++) {
      var r = letters[i].el.getBoundingClientRect();
      letters[i].hx = r.left + r.width / 2;
      letters[i].hy = r.top + r.height / 2;
    }
  }

  // Build the fragment pieces for one letter (lazy — only when it first shatters)
  function build(s) {
    var glyph = s.el.textContent;
    s.el.textContent = "";
    var base = document.createElement("span");
    base.className = "base"; base.textContent = glyph;
    s.el.appendChild(base);
    s.base = base;
    s.frags = [];
    for (var r = 0; r < GRID_ROWS; r++) {
      for (var c = 0; c < GRID_COLS; c++) {
        var f = document.createElement("span");
        f.className = "frag"; f.setAttribute("aria-hidden", "true"); f.textContent = glyph;
        var top = (r / GRID_ROWS) * 100, bottom = ((GRID_ROWS - 1 - r) / GRID_ROWS) * 100;
        var left = (c / GRID_COLS) * 100, right = ((GRID_COLS - 1 - c) / GRID_COLS) * 100;
        f.style.clipPath = "inset(" + top + "% " + right + "% " + bottom + "% " + left + "%)";
        // direction this fragment flies: out from the letter centre + a little jitter
        var ox = (c + 0.5) / GRID_COLS - 0.5, oy = (r + 0.5) / GRID_ROWS - 0.5;
        var len = Math.sqrt(ox * ox + oy * oy) || 0.0001;
        var nx = ox / len, ny = oy / len;
        if (ox === 0 && oy === 0) { var a = Math.random() * Math.PI * 2; nx = Math.cos(a); ny = Math.sin(a); }
        s.frags.push({
          el: f,
          dx: nx + (Math.random() - 0.5) * 0.6,
          dy: ny + (Math.random() - 0.5) * 0.6,
          rot: (Math.random() - 0.5) * 2 * ROTATE
        });
        s.el.appendChild(f);
      }
    }
    s.built = true;
  }

  function teardown(s) {
    if (!s.built) return;
    var glyph = s.base ? s.base.textContent : s.el.textContent;
    s.el.textContent = glyph;
    s.built = false; s.base = null; s.frags = null; s.t = 0;
  }

  function setActive(st) {
    if (st === active) return;
    if (active) letters.forEach(teardown);
    active = st;
    letters = st ? Array.prototype.slice.call(st.querySelectorAll(".ch")).map(function (el) {
      return { el: el, hx: 0, hy: 0, t: 0, built: false, base: null, frags: null };
    }) : [];
    measureHomes();
  }

  function pickStanza(my) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < stanzas.length; i++) {
      var r = stanzas[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var d = my < r.top ? r.top - my : (my > r.bottom ? my - r.bottom : 0);
      if (d < bestD) { bestD = d; best = stanzas[i]; }
    }
    return bestD <= 170 ? best : null;
  }

  document.addEventListener("mousemove", function (e) { mouseX = e.clientX; mouseY = e.clientY; pointerIn = true; kick(); });
  document.addEventListener("mouseleave", function () { pointerIn = false; });
  window.addEventListener("scroll", function () { if (active) measureHomes(); }, { passive: true });
  window.addEventListener("resize", function () { measureHomes(); });

  var running = false;
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function loop() {
    var activity = false;

    if (pointerIn) {
      var cand = pickStanza(mouseY);
      if (cand !== active) setActive(cand);
    }

    for (var i = 0; i < letters.length; i++) {
      var s = letters[i];
      var force = 0;
      if (pointerIn) {
        var ddx = s.hx - mouseX, ddy = s.hy - mouseY;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < RADIUS) force = smooth(1 - dist / RADIUS);
      }
      s.t += (force - s.t) * EASE;

      if (s.t < 0.003) {
        if (s.built) { s.base.style.opacity = "1"; for (var k = 0; k < s.frags.length; k++) s.frags[k].el.style.opacity = "0"; }
        continue;
      }
      activity = true;
      if (!s.built) build(s);

      var t = s.t;
      s.base.style.opacity = (1 - smooth(clamp01(t / 0.5))).toFixed(3);

      var nx = 0, ny = 0;
      if (pointerIn) {
        var px = s.hx - mouseX, py = s.hy - mouseY, pl = Math.sqrt(px * px + py * py) || 1;
        nx = px / pl; ny = py / pl;
      }
      var op = (Math.sin(clamp01(t) * Math.PI) * 0.9).toFixed(3);
      for (var j = 0; j < s.frags.length; j++) {
        var f = s.frags[j];
        var tx = (f.dx * SPREAD + nx * PUSH) * t;
        var ty = (f.dy * SPREAD + ny * PUSH) * t;
        f.el.style.transform = "translate(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px) rotate(" + (f.rot * t).toFixed(1) + "deg) scale(" + (1 - 0.12 * t).toFixed(3) + ")";
        f.el.style.opacity = op;
      }
    }

    if (activity || pointerIn) { requestAnimationFrame(loop); } else { running = false; }
  }

  var yearEl = document.querySelector(".footer__year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
