// gmp-overlay.js — B3.8 Ghost-MP M2 (+M2.1): in-view ghost markers (display layer).
//
// Draws remote players INSIDE the game view as floating nameplates (dot +
// name + distance) by projecting their transmitted world positions through
// the read-only camera sampler (gmp-cam.js). Nothing is ever written to the
// engine: this module only paints on its own transparent 2D canvas that
// sits above the game canvas. Fails silent (no markers) whenever the camera
// sample is invalid — the M1 panel remains the fallback UI.
//
// M2.1 additions (all display-layer, still zero engine writes):
//   1. Edge indicators: ghosts behind the camera or outside the view are
//      shown as a colored arrow + name + distance clamped to the screen
//      border, so a streaming ghost is ALWAYS indicated on screen, not only
//      when in view (owner report: "no indication at all").
//   2. Waiting chip: when joined to a room with other peers but NO ghost
//      state is flowing, a small top-center chip says so in plain language.
//      The usual cause is the peer's tab not being in gameplay yet
//      (menu/loading/cutscene) — exactly what M1 diagnostics could not
//      surface in-game.
(function () {
  'use strict';

  var cv = null, ctx = null;
  var lastPaint = 0;
  // M2.2 diag (stage D: renderer) — what the overlay actually did each frame.
  var diag = { frames: 0, lastFrameAt: 0, ghostsLive: 0, inView: 0, edge: 0,
               staleSkipped: 0, noView: false, waitingChip: false };

  function ensure() {
    if (ctx) return true;
    cv = document.getElementById('gmp-overlay');
    if (!cv) return false;
    ctx = cv.getContext('2d');
    return !!ctx;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Walk a ray from the canvas center along (dx,dy) until it crosses the
  // border rectangle [margin, W-margin] x [margin, H-margin].
  function edgePoint(dx, dy, W, H, margin) {
    var tx = Infinity, ty = Infinity;
    if (dx > 1e-6) tx = (W - margin - W / 2) / dx;
    else if (dx < -1e-6) tx = (margin - W / 2) / dx;
    if (dy > 1e-6) ty = (H - margin - H / 2) / dy;
    else if (dy < -1e-6) ty = (margin - H / 2) / dy;
    var t = Math.min(tx, ty);
    if (!isFinite(t)) return null;
    return [W / 2 + dx * t, H / 2 + dy * t];
  }

  // Colored arrow at the screen edge pointing toward a ghost that is
  // behind the camera or off-view, with name + distance.
  function drawEdgeMarker(cs, g, stale) {
    var W = cv.width, H = cv.height, m = 26;
    // screen-space direction: x right, y down => negate the up component.
    var ang = Math.atan2(-cs.cy, cs.cx);
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var p = edgePoint(dx, dy, W, H, m);
    if (!p) return;
    var ex = p[0], ey = p[1];
    var alpha = stale ? 0.45 : 0.85;
    var col = g.color || '#7df';

    ctx.globalAlpha = alpha;
    // arrow head (triangle oriented along ang)
    ctx.fillStyle = col;
    ctx.beginPath();
    var a1 = ang, a2 = ang + Math.PI * 0.85, a3 = ang - Math.PI * 0.85, r = 9;
    ctx.moveTo(ex + Math.cos(a1) * r, ey + Math.sin(a1) * r);
    ctx.lineTo(ex + Math.cos(a2) * r, ey + Math.sin(a2) * r);
    ctx.lineTo(ex + Math.cos(a3) * r, ey + Math.sin(a3) * r);
    ctx.closePath();
    ctx.fill();

    // label clamped inside the border, below/above the arrow
    var label = (g.name || 'ghost') + '  ' + cs.dist.toFixed(0) + 'm';
    ctx.font = 'bold 11px monospace';
    var tw = ctx.measureText(label).width;
    var lx = Math.min(Math.max(ex - tw / 2 - 4, 2), W - tw - 10);
    var ly = (ey > H / 2) ? Math.min(ey - 20, H - 20) : Math.min(ey + 14, H - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(lx, ly, tw + 8, 15);
    ctx.fillStyle = '#e8f4ff';
    ctx.fillText(label, lx + 4, ly + 11);
    ctx.globalAlpha = 1;
  }

  // Small top-center chip drawn on the overlay while the local tab is in
  // gameplay but the room has peers and no ghost state is arriving.
  function drawWaitingChip(reason) {
    var W = cv.width;
    var msg = 'GHOST SYNC: ' + reason;
    ctx.font = 'bold 11px monospace';
    var tw = ctx.measureText(msg).width;
    var bx = (W - tw) / 2 - 8, by = 8;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, tw + 16, 18);
    ctx.strokeStyle = 'rgba(255,213,79,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, tw + 15, 17);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(msg, bx + 8, by + 13);
    ctx.globalAlpha = 1;
  }

  function draw(t) {
    if (!ensure()) return;
    var net = window.GMPnet;
    var cam = window.GMPcam;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!net || !cam) return;

    diag.frames++; diag.lastFrameAt = Date.now();       // M2.2 diag (rAF liveness probe)
    diag.ghostsLive = 0; diag.inView = 0; diag.edge = 0; diag.staleSkipped = 0; diag.waitingChip = false;

    // update camera view from local telemetry (read-only)
    var lv = window.GMPtel ? window.GMPtel.lastValid() : null;
    cam.update(lv);
    var view = cam.view();
    if (!view) { diag.noView = true; return; }   // engine down / not playing: no overlay
    diag.noView = false;

    var ghosts = net.ghostList();
    var now = Date.now();
    var meSid = net.stats ? (net.stats().sid) : null;

    var live = 0;        // ghosts with fresh state
    var inView = 0;      // ghosts drawn as in-view markers

    for (var sid in ghosts) {
      if (meSid != null && +sid === +meSid) continue;   // never draw the local player
      var g = ghosts[sid];
      var age = now - (g.t || 0);
      if (age > 3000) { diag.staleSkipped++; continue; }                 // stale: M1 panel handles marking
      live++;
      var stale = age > 2000;
      var pr = cam.project([g.x, g.y, g.z + 1.0]);
      if (pr.ok && !pr.off) {                   // in view: nameplate marker
        inView++; diag.inView++;
        var alpha = stale ? 0.45 : 0.92;
        var dist = pr.dist;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = g.color || '#7df';
        ctx.fillStyle = g.color || '#7df';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 2, 0, Math.PI * 2);
        ctx.fill();

        var label = (g.name || 'ghost') + '  ' + dist.toFixed(0) + 'm';
        ctx.font = 'bold 11px monospace';
        var tw = ctx.measureText(label).width;
        var bx = Math.min(Math.max(pr.x - tw/2 - 4, 2), cv.width - tw - 10);
        var by = Math.max(pr.y - 26, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx, by, tw + 8, 15);
        ctx.fillStyle = '#e8f4ff';
        ctx.fillText(label, bx + 4, by + 11);

        ctx.strokeStyle = g.color || '#7df';
        ctx.beginPath();
        ctx.moveTo(pr.x, by + 15);
        ctx.lineTo(pr.x, pr.y - 5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {                                  // behind / off view: edge arrow
        diag.edge++;
        var cs = cam.camSpace([g.x, g.y, g.z + 1.0]);
        if (cs && (Math.abs(cs.cx) > 0.5 || Math.abs(cs.cy) > 0.5 || cs.cz <= 0.4)) {
          drawEdgeMarker(cs, g, stale);
        }
      }
    }

    // waiting chip: joined with peers, local gameplay, but no ghost data
    if (live === 0 && net.stats) {
      try {
        var ns = net.stats();
        // "others in the room" — hub stats count OTHER peers, guest roster
        // includes self (M2.1 fix: the chip previously never showed on the
        // host tab because peers>1 assumed guest semantics)
        var others = (ns.role === 'hub') ? ns.peers : Math.max(0, (ns.peers || 0) - 1);
        if ((ns.state === 'hub' || ns.state === 'guest') && others > 0) {
          var reason = 'waiting for other player\u2019s game state\u2026';
          var sync = ns.sync || {};
          var peer = (sync.peers && sync.peers[0]) || sync.hub;
          if (peer && peer.hbOnly) {
            reason = 'peer connected \u2014 their tab is at menu / loading (must reach gameplay)';
          } else if (peer && peer.lastAnyAgeMs != null && peer.lastAnyAgeMs > 5000) {
            reason = 'peer connection quiet\u2026';
          }
          drawWaitingChip(reason);
          diag.waitingChip = true;
        }
      } catch (e) {}
    }
  }

  function loop(t) {
    if (t - lastPaint > 33) {   // ~30 fps overlay
      lastPaint = t;
      try { draw(t); } catch (e) {}
    }
    requestAnimationFrame(loop);
  }

  // M2.2 diag export: renderer-stage visibility for the sync panel.
  window.GMPoverlay = {
    stats: function () {
      var d = {};
      for (var k in diag) d[k] = diag[k];
      d.rafStalled = diag.lastFrameAt ? (Date.now() - diag.lastFrameAt > 1500) : null;
      return d;
    }
  };

  window.addEventListener('load', function () {
    if (ensure()) requestAnimationFrame(loop);
  });
})();
