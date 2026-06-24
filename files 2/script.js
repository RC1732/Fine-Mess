/* ====================================================================
   FINE MESS — interaction
   --------------------------------------------------------------------
   1. Lines rise in cleanly as they enter the viewport (all devices).
   2. The thin progress hairline at the top fills as you scroll.
   3. DESKTOP (fine pointer): hovering near a line makes its letters
      flee the cursor and dissolve into drifting particles, then spring
      back as you move away. This is the "typographic performance".

   Mobile / touch / reduced-motion: effect 3 is skipped — clean reveal only.

   --- Tuning knobs for the particle effect (safe to tweak) ----------- */
const RADIUS        = 150;   // cursor influence radius in px (bigger = wider blast)
const MAX_PUSH      = 48;    // how far letters flee the cursor
const STIFFNESS     = 0.12;  // spring-back strength (higher = snappier)
const DAMPING       = 0.78;  // motion damping (lower = looser/wobblier)
const SPAWN_RATE    = 0.55;  // particles emitted vs. force (higher = denser)
const MAX_PARTICLES = 800;   // performance ceiling
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
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
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

  /* ---- 3. Particle dissolve (desktop fine-pointer only) ---- */
  if (reduce || !canHover) return;

  var smooth = function (t) { return t * t * (3 - 2 * t); };

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

  var canvas = document.createElement("canvas");
  canvas.className = "fx"; canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();
  window.addEventListener("resize", function () { sizeCanvas(); measureHomes(); });

  var particles = [];
  var mouseX = -9999, mouseY = -9999, pointerIn = false;
  var active = null;   // stanza currently engaged
  var chars = [];      // its per-letter physics states

  function measureHomes() {
    if (!chars.length) return;
    var prev = [];
    chars.forEach(function (s, i) { prev[i] = s.el.style.transform; s.el.style.transform = "none"; });
    chars.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.hx = r.left + r.width / 2; s.hy = r.top + r.height / 2;
    });
    chars.forEach(function (s, i) { s.el.style.transform = prev[i]; });
  }

  function setActive(st) {
    if (st === active) return;
    if (active) {
      chars.forEach(function (s) {
        s.el.classList.add("relax");
        s.el.style.transform = ""; s.el.style.opacity = "";
        (function (el) { setTimeout(function () { el.classList.remove("relax"); }, 430); })(s.el);
      });
    }
    active = st;
    chars = st ? Array.prototype.slice.call(st.querySelectorAll(".ch")).map(function (el) {
      el.classList.remove("relax");
      return { el: el, dx: 0, dy: 0, vx: 0, vy: 0, op: 1, hx: 0, hy: 0 };
    }) : [];
    measureHomes();
  }

  // Pick the stanza vertically nearest the cursor (within 170px), among visible ones
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

  document.addEventListener("mousemove", function (e) {
    mouseX = e.clientX; mouseY = e.clientY; pointerIn = true; kick();
  });
  document.addEventListener("mouseleave", function () { pointerIn = false; });
  window.addEventListener("scroll", function () { if (active) measureHomes(); }, { passive: true });

  function spawn(x, y, force) {
    if (Math.random() > SPAWN_RATE * force) return;
    if (particles.length >= MAX_PARTICLES) return;
    var a = Math.random() * Math.PI * 2;
    var sp = 0.5 + Math.random() * 2.6 * force;
    particles.push({
      x: x, y: y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
      life: 1, decay: 0.010 + Math.random() * 0.02,
      size: 0.6 + Math.random() * 1.9
    });
  }

  var running = false;
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var activity = false;

    if (pointerIn) {
      var cand = pickStanza(mouseY);
      if (cand !== active) setActive(cand);
    }

    for (var i = 0; i < chars.length; i++) {
      var s = chars[i];
      var cx = s.hx + s.dx, cy = s.hy + s.dy;
      var tx = 0, ty = 0, top = 1, force = 0;
      if (pointerIn) {
        var ddx = cx - mouseX, ddy = cy - mouseY;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < RADIUS) {
          force = smooth(1 - dist / RADIUS);
          var inv = dist > 0.001 ? 1 / dist : 0;
          tx = ddx * inv * MAX_PUSH * force;
          ty = ddy * inv * MAX_PUSH * force;
          top = 1 - force * 0.85;
          spawn(cx, cy, force);
        }
      }
      s.vx += (tx - s.dx) * STIFFNESS; s.vy += (ty - s.dy) * STIFFNESS;
      s.vx *= DAMPING; s.vy *= DAMPING;
      s.dx += s.vx; s.dy += s.vy;
      s.op += (top - s.op) * 0.2;
      if (Math.abs(s.dx) > 0.1 || Math.abs(s.dy) > 0.1 || Math.abs(s.op - 1) > 0.01) activity = true;
      var sc = 1 - force * 0.25;
      s.el.style.transform = "translate(" + s.dx.toFixed(2) + "px," + s.dy.toFixed(2) + "px) scale(" + sc.toFixed(3) + ")";
      s.el.style.opacity = s.op.toFixed(3);
    }

    var rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j];
      p.x += p.vx; p.y += p.vy; p.vy += 0.015; p.vx *= 0.99; p.vy *= 0.99;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(j, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x - rect.left - p.size / 2, p.y - rect.top - p.size / 2, p.size, p.size);
      activity = true;
    }
    ctx.globalAlpha = 1;

    if (activity || pointerIn) { requestAnimationFrame(loop); } else { running = false; }
  }

  // Footer year
  var yearEl = document.querySelector(".footer__year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
