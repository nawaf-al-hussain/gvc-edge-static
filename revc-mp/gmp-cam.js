// gmp-cam.js — B3.8 Ghost-MP M2, read-only camera sampler + projector.
//
// READ-ONLY GUARANTEE (B3.8 task rules): every engine-memory access in this
// module is a READ through Module.HEAPU8 views. No writes to any HEAP*,
// no ccall, no exported calls, no GL state mutation. The multiplayer code
// never feeds anything back into the engine.
//
// Provenance (mined live against production reVC.wasm sha256 8e8175ea…,
// 2026-10-19; method + evidence in the M2 report section):
//   f32 triple @ linear 4247044 = active follow-camera eye position (world)
//   Behavioural validation used to accept a read as the camera:
//     - all three floats finite
//     - within [2, 22] m of the local ped (B3.7-verified telemetry)
//     - eye z within [pedZ-4, pedZ+6]
//     - (eye - ped) dot pedForward < 0  (eye behind the ped)
//   If validation fails the overlay falls back to a telemetry-only
//   approximation (eye = ped - fwd*8 + 1m up) — never an engine write.
//
// Projection constants captured from the engine's own perspective matrix
// (read via the page's GL upload path during mining; the same 70° FOV the
// B3.5 HUD reports): xScale 1.4281, yScale 1.9042, canvas 640x448.
window.GMPcam = (function () {
  'use strict';

  var cfg = {
    addr: 4247044,        // f32 triple: camera eye (see provenance above)
    lookUpZ: 1.4,         // look target = ped + (0,0,1.4) — pitch-calibrated on live renders (M2 evidence)
    minR: 2.0, maxR: 22.0,
    xs: 1.4281, ys: 1.9042,
    W: 640, H: 448
  };

  var f32 = null, f32Len = 0;
  var lastView = null;   // {eye:[x,y,z], right:[x,y,z], up:[x,y,z], fwd:[x,y,z], src:'mined'|'approx'}
  var lastStatus = { ok: false, src: null, why: 'never-run' };  // M2.2 diag

  function heapView() {
    var M = window.Module;
    if (!M || !M.HEAPU8 || !M.HEAPU8.buffer) return null;
    var len = M.HEAPU8.buffer.byteLength;
    if (!f32 || f32Len !== len) { f32 = new Float32Array(M.HEAPU8.buffer); f32Len = len; }
    return f32;
  }

  function norm3(v) {
    var n = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    if (n < 1e-9) return null;
    return [v[0]/n, v[1]/n, v[2]/n];
  }
  function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

  // Returns [ex,ey,ez] when the mined triple validates as the camera eye.
  // M2.2 diag: records WHY the mined read was rejected into lastStatus.why.
  function readMinedEye(lv) {
    var F = heapView();
    if (!F) { lastStatus.why = 'no-heap'; return null; }
    var i = cfg.addr >> 2;
    if (i + 3 > F.length) { lastStatus.why = 'oob'; return null; }
    var ex = F[i], ey = F[i+1], ez = F[i+2];
    if (!isFinite(ex) || !isFinite(ey) || !isFinite(ez)) { lastStatus.why = 'non-finite'; return null; }
    var dx = ex - lv.x, dy = ey - lv.y, dz = ez - lv.z;
    var r = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (r < cfg.minR || r > cfg.maxR) { lastStatus.why = 'range=' + r.toFixed(1); return null; }
    if (dz < -4 || dz > 6) { lastStatus.why = 'height'; return null; }
    if (lv.fx != null && lv.fy != null && (dx*lv.fx + dy*lv.fy) >= 0) { lastStatus.why = 'not-behind'; return null; }
    lastStatus.why = null;
    return [ex, ey, ez];
  }

  // Telemetry-only fallback eye (no heap dependency): behind the ped.
  function approxEye(lv) {
    var d = 8;
    return [lv.x - lv.fx*d, lv.y - lv.fy*d, lv.z + 1.0];
  }

  // Call ~each frame with the local telemetry sample (or null).
  function update(lv) {
    if (!lv || lv.x == null) { lastView = null; lastStatus = { ok: false, src: null, why: 'no-telemetry' }; return null; }
    var eye = readMinedEye(lv);
    var src = 'mined';
    if (!eye) { eye = approxEye(lv); src = 'approx'; }
    var target = [lv.x, lv.y, lv.z + cfg.lookUpZ];
    var fwd = norm3([target[0]-eye[0], target[1]-eye[1], target[2]-eye[2]]);
    if (!fwd) { lastView = null; lastStatus = { ok: false, src: null, why: 'no-fwd' }; return null; }
    var right = norm3(cross(fwd, [0,0,1]));
    if (!right) { lastView = null; lastStatus = { ok: false, src: null, why: 'no-right' }; return null; }
    var up = cross(right, fwd);
    lastView = { eye: eye, target: target, right: right, up: up, fwd: fwd, src: src };
    lastStatus = { ok: true, src: src, why: lastStatus.why };   // why!=null => mined rejected, approx used
    return lastView;
  }

  // Project a world point to canvas pixels. Returns
  // {ok:true, x, y, dist} or {ok:false, behind:true|offscreen:true, x?, y?}.
  function project(p) {
    if (!lastView) return { ok: false, behind: true };
    var rx = p[0]-lastView.eye[0], ry = p[1]-lastView.eye[1], rz = p[2]-lastView.eye[2];
    var cx = dot([rx,ry,rz], lastView.right);
    var cy = dot([rx,ry,rz], lastView.up);
    var cz = dot([rx,ry,rz], lastView.fwd);   // forward distance, >0 in front
    if (cz <= 0.4) return { ok: false, behind: true, dist: cz };
    var nx = (cx * cfg.xs) / cz;
    var ny = (cy * cfg.ys) / cz;
    var x = (nx * 0.5 + 0.5) * cfg.W;
    var y = (0.5 - ny * 0.5) * cfg.H;         // flip Y (screen down = -up)
    return { ok: true, x: x, y: y, dist: cz,
             off: (x < -40 || x > cfg.W+40 || y < -40 || y > cfg.H+40) };
  }

  // M2.1: camera-space coordinates of a world point (right/up/forward
  // components + euclidean distance). Used by the overlay to place edge
  // indicators for ghosts that are behind the camera or outside the view:
  // the horizontal sign of (cx) and the screen-space angle atan2(-cy, cx)
  // point the way the player must turn, valid in front of AND behind the
  // view axis. Pure read on the cached view — no heap access.
  function camSpace(p) {
    if (!lastView) return null;
    var rx = p[0]-lastView.eye[0], ry = p[1]-lastView.eye[1], rz = p[2]-lastView.eye[2];
    var cx = dot([rx,ry,rz], lastView.right);
    var cy = dot([rx,ry,rz], lastView.up);
    var cz = dot([rx,ry,rz], lastView.fwd);
    return { cx: cx, cy: cy, cz: cz,
             dist: Math.sqrt(rx*rx + ry*ry + rz*rz) };
  }

  function view() { return lastView; }
  function setCfg(patch) { for (var k in patch) if (k in cfg) cfg[k] = patch[k]; }
  function getCfg() { return JSON.parse(JSON.stringify(cfg)); }

  return { update: update, project: project, camSpace: camSpace, view: view, setCfg: setCfg, getCfg: getCfg,
           status: function () { return lastStatus; } };   // M2.2 diag
})();
