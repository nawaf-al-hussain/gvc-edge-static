// gmp-ped.js — [B3.9] real 3D remote-player pedestrians.
//
// Bridges the isolated M2.x transport (GMPnet state stream) into the
// B3.9 engine bridge exports (gmp3_*). Design rules honored:
//   - NO arbitrary WASM memory writes from JS: every engine state change
//     goes through the exported gmp3_spawn/move/remove calls; the only
//     engine-side read the JS layer performs is via the gmp3_local /
//     gmp3_query out-parameters (engine-sanctioned API, not heap mining).
//   - The remote ped is a REAL Vice City character rendered by the normal
//     game renderer (model streamed via CStreaming, entity in CWorld).
//   - Position + heading come from network snapshots, interpolated between
//     updates; the remote ped never takes local player control.
//   - Isolated: this module only ADDS behavior; it changes nothing in the
//     game, the SP page, or the transport schema.
//
// Wire notes: GMPnet state stream carries x,y,z world coords, h = heading
// in RADIANS, q = monotonic seq. gmp3_move wants heading in DEGREES.
// Model pool: hardcoded civilian indices (ModelIndices.h: MI_MALE01=7,
// MI_COP=1, MI_HFYST=9, MI_HMYST=11, MI_HFYRI=13, MI_HMOST=12).
'use strict';
window.GMPped = (function () {
  var MODELS = [7, 1, 9, 11, 13, 12];
  var SNAP_TTL_MS = 5000;      // peer silence -> despawn
  var RENDER_DELAY_MS = 110;   // interpolation buffer delay
  var MOVE_HZ = 60;

  var S = {
    active: false,
    handles: {},               // sid -> engine handle
    snaps: {},                 // sid -> {buf:[], lastSeen}
    lastLocal: null,           // last engine local read {x,y,z,hDeg,moving}
    counters: {
      localReads: 0, injects: 0, spawns: 0, spawnFails: 0,
      removes: 0, moves: 0, moveFails: 0, staleDespawns: 0
    }
  };
  var bufPtr = 0;
  var mySid = null;

  function M() {
    return (window.Module && window.Module._gmp3_spawn) ? window.Module : null;
  }

  // engine-side shared out buffer (gmp3_out) — no JS-side malloc needed
  function ensureBuf(n) {
    var mod = M();
    if (!mod || !mod._gmp3_out) return 0;
    if (!bufPtr) bufPtr = mod._gmp3_out();
    return bufPtr;
  }

  function readF32(ptr, n) {
    var heap = window.Module.HEAPU8;              // re-derived per read (memory may grow)
    var dv = new DataView(heap.buffer, heap.byteOffset + ptr, n * 4);
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = dv.getFloat32(i * 4, true);
    return out;
  }

  // Sender path (called by gmp-net freshTel): engine-export local state in
  // the exact shape GMPtel.lastValid() used ({x,y,z,h(rad),t,mono}).
  function localState() {
    var mod = M();
    if (!mod) return null;
    var ptr = ensureBuf(5);
    if (!ptr) return null;
    if (mod._gmp3_local(ptr) !== 1) return null;
    var v = readF32(ptr, 5);
    S.counters.localReads++;
    S.lastLocal = { x: v[0], y: v[1], z: v[2], hDeg: v[3], moving: v[4] === 1 };
    return {
      ok: true,
      x: v[0], y: v[1], z: v[2],
      h: v[3] * Math.PI / 180.0,
      ped: (S.lastLocal && S.lastLocal.moving) ? 1 : 0
    };
  }

  function spawn(sid) {
    var mod = M();
    if (!mod) return 0;
    var mi = MODELS[sid % MODELS.length];
    var g = latest(sid);
    if (!g) return 0;
    var h = mod._gmp3_spawn(mi, g.x, g.y, g.z, g.h);
    if (h > 0) S.counters.spawns++; else S.counters.spawnFails++;
    return h;
  }

  function latest(sid) {
    var b = S.snaps[sid] && S.snaps[sid].buf;
    if (!b || !b.length) return null;
    return b[b.length - 1];
  }

  // Heading lerp across the [-PI, PI] wrap.
  function lerpAngle(a, b, k) {
    var d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * k;
  }

  function interpPos(rec, nowMs) {
    var b = rec.buf;
    if (!b.length) return null;
    var target = nowMs - RENDER_DELAY_MS;
    if (b.length === 1 || target <= b[0].t) return b[0];
    for (var i = b.length - 1; i > 0; i--) {
      if (b[i - 1].t <= target && target <= b[i].t) {
        var k = (target - b[i - 1].t) / Math.max(1, b[i].t - b[i - 1].t);
        k = Math.max(0, Math.min(1, k));
        return {
          x: b[i - 1].x + (b[i].x - b[i - 1].x) * k,
          y: b[i - 1].y + (b[i].y - b[i - 1].y) * k,
          z: b[i - 1].z + (b[i].z - b[i - 1].z) * k,
          h: lerpAngle(b[i - 1].h, b[i].h, k)
        };
      }
    }
    return b[b.length - 1];
  }

  function tick() {
    if (!S.active) return;
    var mod = M();
    if (mod && window.GMPnet) {
      var st = GMPnet.stats();
      mySid = st.sid;
      var ghosts = GMPnet.ghostList();
      var nowMs = performance.now();

      // absorb new snapshots + spawn on first sight (NEVER for our own sid)
      for (var sid in ghosts) {
        if (mySid != null && String(sid) === String(mySid)) continue;
        var g = ghosts[sid];
        if (g == null || g.x == null || !isFinite(g.x)) continue;
        var rec = S.snaps[sid];
        if (!rec) { rec = S.snaps[sid] = { buf: [], lastSeen: 0, handle: 0 }; }
        rec.buf.push({ x: g.x, y: g.y, z: g.z, h: (g.h == null) ? (rec.buf.length ? rec.buf[rec.buf.length - 1].h : 0) : g.h, t: nowMs });
        if (rec.buf.length > 6) rec.buf.shift();
        rec.lastSeen = nowMs;
        if (!rec.handle) rec.handle = spawn(sid);
      }

      // drive + despawn
      for (var sid2 in S.snaps) {
        var rec2 = S.snaps[sid2];
        if (nowMs - rec2.lastSeen > SNAP_TTL_MS ||
            (ghosts && !(sid2 in ghosts))) {
          if (rec2.handle && mod) { if (mod._gmp3_remove(rec2.handle) === 1) S.counters.removes++; }
          delete S.snaps[sid2];
          delete S.handles[sid2];
          S.counters.staleDespawns++;
          continue;
        }
        if (!rec2.handle || !mod) continue;
        var p = interpPos(rec2, nowMs);
        if (!p) continue;
        if (mod._gmp3_move(rec2.handle, p.x, p.y, p.z, p.h * 180.0 / Math.PI) === 1) S.counters.moves++;
        else { S.counters.moveFails++; rec2.handle = 0; }   // dead handle -> respawn on next snap
      }
    }
    setTimeout(tick, Math.floor(1000 / MOVE_HZ));
  }

  function start() {
    if (S.active) return;
    S.active = true;
    tick();
  }
  function stop() {
    S.active = false;
    var mod = M();
    for (var sid in S.snaps) {
      if (S.snaps[sid].handle && mod) { try { mod._gmp3_remove(S.snaps[sid].handle); } catch (e) {} }
    }
    S.snaps = {}; S.handles = {};
  }

  function stats() {
    var out = { active: S.active, counters: S.counters, lastLocal: S.lastLocal, peers: {} };
    for (var sid in S.snaps) {
      var rec = S.snaps[sid];
      var q = null;
      if (rec.handle && window.Module && window.Module._gmp3_query) {
        var ptr = ensureBuf(4);
        if (ptr && window.Module._gmp3_query(rec.handle, ptr) === 1) {
          var v = readF32(ptr, 4);
          q = { x: v[0], y: v[1], z: v[2], hDeg: v[3] };
        }
      }
      out.peers[sid] = { handle: rec.handle, snaps: rec.buf.length, applied: q };
    }
    return out;
  }

  return {
    start: start, stop: stop, stats: stats,
    localState: localState,          // consumed by gmp-net freshTel [B3.9]
    MODELS: MODELS
  };
})();

// [B3.9] auto-start with the session: the module is inert until the engine
// bridge exports exist (M() gates every engine call) and GMPnet state flows.
if (window.GMPped) window.GMPped.start();
