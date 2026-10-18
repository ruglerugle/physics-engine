/* ============================================================
   physics-engine 共通ライブラリ（PE）
   ・ベクトルの計算（足し算・引き算・内積・外積・長さ）
   ・チート900の動きのデータ（MOTION）からコマごとの点を取り出す
   ・3D の点を画面に写す簡単なカメラ（ドラッグで回せる）と棒人間の描画
   ・canvas / スライダー / 再生ボタンのヘルパー
   座標の向き：x＝進行方向、y＝上、z＝的の方向（単位 m）
   ============================================================ */
(function (global) {
  "use strict";

  var PE = {};
  var TAU = Math.PI * 2;
  PE.TAU = TAU;
  PE.FONT = '"GreekNu",system-ui,-apple-system,"Hiragino Sans","Yu Gothic",sans-serif';
  PE.C = {
    ink: "#1b232c", muted: "#6a7684", paper: "#fdfbf6", grid: "#e6e0d6", axis: "#b9b0a3",
    legR: "#c8433f", legL: "#24406e", armR: "#2f8f65", armL: "#7a4fb0", spine: "#8a6a2f", head: "#1b232c",
    gold: "#9a6a1c", ok: "#2f9e5c", ng: "#c8433f", vel: "#d9822b", acc: "#2f6fb8", com: "#c03a7a",
    x: "#c8433f", y: "#2f9e5c", z: "#2f6fb8"
  };
  PE.deg = function (r) { return r * 180 / Math.PI; };
  PE.rad = function (d) { return d * Math.PI / 180; };
  PE.fmt = function (x, d) { d = d || 0; var p = Math.pow(10, d); var v = Math.round(x * p) / p; if (v === 0) v = 0; return v.toFixed(d); };

  /* ---------- ベクトル ---------- */
  PE.add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  PE.sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  PE.mul = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; };
  PE.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  PE.cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  PE.len = function (a) { return Math.sqrt(PE.dot(a, a)); };
  PE.norm = function (a) { var l = PE.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  PE.mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
  PE.lerp = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  /* ---------- 動きのデータ ---------- */
  var M = global.MOTION || null, IX = {};
  if (M) M.names.forEach(function (n, i) { IX[n] = i; });
  PE.M = M;
  PE.fps = M ? M.fps : 60;
  PE.N = M ? M.frames.length : 0;
  // コマ k の点 name の座標 [x, y, z]（k は整数に丸める）
  PE.P = function (k, name) {
    k = Math.max(0, Math.min(PE.N - 1, Math.round(k)));
    var f = M.frames[k], i = IX[name] * 3; return [f[i], f[i + 1], f[i + 2]];
  };
  // コマ k の全部の点 { name: [x,y,z] }
  PE.pose = function (k) { var o = {}; M.names.forEach(function (n) { o[n] = PE.P(k, n); }); return o; };
  // 重心：体の部分の重み（胴 0.43・頭 0.08・太もも 0.10・すね 0.045・足 0.015・上腕 0.028・前腕 0.016・手 0.006）
  var SEG = [["hipR", "hipL", "shR", "shL", 0.43], ["earR", "earL", null, null, 0.08]];
  ["R", "L"].forEach(function (s) {
    SEG.push(["hip" + s, "knee" + s, null, null, 0.10], ["knee" + s, "ankle" + s, null, null, 0.045], ["heel" + s, "toe" + s, null, null, 0.015],
      ["sh" + s, "el" + s, null, null, 0.028], ["el" + s, "wr" + s, null, null, 0.016], ["wr" + s, "index" + s, null, null, 0.006]);
  });
  PE.SEG = SEG;
  PE.com = function (k) {
    var p = PE.pose(k), s = [0, 0, 0], m = 0;
    SEG.forEach(function (g) {
      if (g[2]) { [g[0], g[1], g[2], g[3]].forEach(function (n) { s = PE.add(s, PE.mul(p[n], g[4] / 4)); }); }
      else s = PE.add(s, PE.mul(PE.mid(p[g[0]], p[g[1]]), g[4]));
      m += g[4];
    });
    return PE.mul(s, 1 / m);
  };

  /* ---------- canvas ---------- */
  PE.canvas = function (id, aspect, draw) {
    var cv = document.getElementById(id);
    if (!cv) return null;
    var ctx = cv.getContext("2d");
    var st = { cv: cv, ctx: ctx, W: 0, H: 0, aspect: aspect };
    function resize() {
      var w = cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 320;
      var h = Math.round(w * aspect), dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); st.W = w; st.H = h; draw(st);
    }
    window.addEventListener("resize", resize);
    st.redraw = function () { draw(st); };
    resize();
    return st;
  };
  PE.text = function (ctx, x, y, s, color, size, weight, align, base) {
    ctx.fillStyle = color || PE.C.ink; ctx.font = (weight || 700) + " " + (size || 11) + "px " + PE.FONT;
    ctx.textAlign = align || "center"; ctx.textBaseline = base || "middle"; ctx.fillText(s, x, y);
  };
  PE.arrowPx = function (ctx, x0, y0, x1, y1, color, width, head) {
    var a = Math.atan2(y1 - y0, x1 - x0), h = head || 8;
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (Math.hypot(x1 - x0, y1 - y0) < 2) return;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)); ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4));
    ctx.closePath(); ctx.fill();
  };
  PE.reducedMotion = function () { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  PE.player = function (btn, tick, labels) {
    var playing = false, last = 0, raf = 0; labels = labels || ["▶ 再生", "⏸ 止める"];
    function loop(now) { if (!playing) return; var dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now; tick(dt); raf = requestAnimationFrame(loop); }
    function set(p) {
      playing = p; last = 0;
      if (btn) { btn.textContent = p ? labels[1] : labels[0]; btn.setAttribute("aria-pressed", p ? "true" : "false"); }
      if (p) raf = requestAnimationFrame(loop); else cancelAnimationFrame(raf);
    }
    if (btn) btn.addEventListener("click", function () { set(!playing); });
    return { play: function () { set(true); }, pause: function () { set(false); }, isPlaying: function () { return playing; } };
  };
  PE.bindRange = function (id, outId, fmt, onChange) {
    var el = document.getElementById(id), out = outId ? document.getElementById(outId) : null;
    if (!el) return null;
    function upd() { if (out) out.textContent = fmt ? fmt(parseFloat(el.value)) : el.value; if (onChange) onChange(parseFloat(el.value)); }
    el.addEventListener("input", upd); upd();
    el.set = function (v) { el.value = v; upd(); };
    return el;
  };

  /* ---------- 3D カメラ ----------
     カメラは注目点 target のまわりを回る。yaw＝上から見た向き（度）、pitch＝見下ろす角度（度）。
     画面へは「カメラの右向き・上向き・奥向き」の3本の矢印との内積で写す（透視：遠いほど小さく） */
  PE.camera = function (st, o) {
    var cam = { yaw: o.yaw != null ? o.yaw : 30, pitch: o.pitch != null ? o.pitch : 12, dist: o.dist || 6, target: o.target || [0.6, 0.9, 0], scale: o.scale || 1, persp: o.persp !== false };
    cam.basis = function () {
      var y = PE.rad(cam.yaw), p = PE.rad(cam.pitch);
      var fwd = [-Math.cos(p) * Math.cos(y), -Math.sin(p), -Math.cos(p) * Math.sin(y)];   // カメラが見る向き
      var right = PE.norm(PE.cross(fwd, [0, 1, 0])), up = PE.cross(right, fwd);
      return { fwd: fwd, right: right, up: up, eye: PE.sub(cam.target, PE.mul(fwd, cam.dist)) };
    };
    cam.proj = function (q) {
      var b = cam.basis(), d = PE.sub(q, b.eye), z = PE.dot(d, b.fwd);
      var f = Math.min(st.W, st.H) * 1.35 * cam.scale;
      var s = cam.persp ? f / Math.max(z, 0.3) : f / cam.dist;
      return { x: st.W / 2 + PE.dot(d, b.right) * s, y: st.H / 2 - PE.dot(d, b.up) * s, z: z, s: s };
    };
    // ドラッグで回す
    if (o.drag !== false) {
      var cv = st.cv, sx = 0, sy = 0, y0 = 0, p0 = 0, down = false;
      cv.style.touchAction = "none"; cv.style.cursor = "move";
      cv.addEventListener("pointerdown", function (e) { down = true; sx = e.clientX; sy = e.clientY; y0 = cam.yaw; p0 = cam.pitch; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", function (e) {
        if (!down) return;
        // 手前の面がポインタについてくる向き
        cam.yaw = y0 + (e.clientX - sx) * 0.5; cam.pitch = Math.max(-10, Math.min(85, p0 + (e.clientY - sy) * 0.4));
        st.redraw();
      });
      cv.addEventListener("pointerup", function () { down = false; });
      cv.addEventListener("pointercancel", function () { down = false; });
    }
    return cam;
  };

  // 床の方眼（x: a〜b、z: c〜d、step m）
  PE.floor = function (ctx, cam, a, b, c, d, step) {
    ctx.lineWidth = 1; ctx.strokeStyle = PE.C.grid; ctx.setLineDash([]);
    for (var x = a; x <= b + 1e-9; x += step) { var p = cam.proj([x, 0, c]), q = cam.proj([x, 0, d]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    for (var z = c; z <= d + 1e-9; z += step) { p = cam.proj([a, 0, z]); q = cam.proj([b, 0, z]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
  };
  // 座標軸の矢印（原点 o から長さ L）
  PE.axes = function (ctx, cam, o, L) {
    [["x", [L, 0, 0], PE.C.x], ["y", [0, L, 0], PE.C.y], ["z", [0, 0, L], PE.C.z]].forEach(function (a) {
      var p = cam.proj(o), q = cam.proj(PE.add(o, a[1]));
      PE.arrowPx(ctx, p.x, p.y, q.x, q.y, a[2], 2.2, 9);
      var t = cam.proj(PE.add(o, PE.mul(a[1], 1.12)));
      PE.text(ctx, t.x, t.y, a[0], a[2], 13, 900);
    });
  };

  // 棒人間（奥のものから描く）。opts: { alpha, highlight: 点の名前, thin }
  var BONES = [
    ["hipR", "kneeR", "legR"], ["kneeR", "ankleR", "legR"], ["ankleR", "heelR", "legR"], ["ankleR", "toeR", "legR"], ["heelR", "toeR", "legR"],
    ["hipL", "kneeL", "legL"], ["kneeL", "ankleL", "legL"], ["ankleL", "heelL", "legL"], ["ankleL", "toeL", "legL"], ["heelL", "toeL", "legL"],
    ["shR", "elR", "armR"], ["elR", "wrR", "armR"], ["shL", "elL", "armL"], ["elL", "wrL", "armL"], ["hipR", "hipL", "spine"], ["shR", "shL", "spine"]
  ];
  PE.BONES = BONES;
  PE.drawBody = function (ctx, cam, p, opts) {
    opts = opts || {};
    var items = [], W = opts.thin ? 0.6 : 1;
    BONES.forEach(function (b) { items.push({ a: p[b[0]], b: p[b[1]], c: PE.C[b[2]], w: (b[2] === "spine" ? 4 : 5) * W }); });
    var hm = PE.mid(p.hipR, p.hipL), sm = PE.mid(p.shR, p.shL), em = PE.mid(p.earR, p.earL);
    items.push({ a: hm, b: sm, c: PE.C.spine, w: 5 * W }, { a: sm, b: em, c: PE.C.spine, w: 4 * W });
    items.forEach(function (it) { it.z = (cam.proj(it.a).z + cam.proj(it.b).z) / 2; });
    var head = { head: true, p: em, z: cam.proj(em).z, nose: p.nose };
    items.push(head);
    items.sort(function (u, v) { return v.z - u.z; });
    ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1; ctx.lineCap = "round";
    items.forEach(function (it) {
      if (it.head) {
        var q = cam.proj(it.p), r = Math.max(0.11 * q.s, 5), n = cam.proj(PE.add(it.p, PE.mul(PE.norm(PE.sub(it.nose, it.p)), 0.13)));
        var away = n.z > q.z;
        function nose() { ctx.strokeStyle = PE.C.head; ctx.lineWidth = 3 * W; ctx.beginPath(); ctx.moveTo(q.x + (n.x - q.x) * 0.55, q.y + (n.y - q.y) * 0.55); ctx.lineTo(n.x, n.y); ctx.stroke(); }
        if (away) nose();
        ctx.fillStyle = PE.C.paper; ctx.strokeStyle = PE.C.head; ctx.lineWidth = 3 * W; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); ctx.stroke();
        if (!away) nose();
        return;
      }
      var a = cam.proj(it.a), b = cam.proj(it.b);
      ctx.strokeStyle = it.c; ctx.lineWidth = it.w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    if (opts.highlight) {
      var h = cam.proj(p[opts.highlight]);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = PE.C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, 6, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = "butt";
  };

  global.PE = PE;
})(window);
