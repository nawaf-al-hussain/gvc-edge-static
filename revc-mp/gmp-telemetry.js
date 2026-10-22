// gmp-telemetry.js — B3.8 Ghost-MP M1, read-only player telemetry sampler.
//
// READ-ONLY GUARANTEE (task §3): every engine-memory access in this module is
// a READ through the exported views (Module.HEAPU8/HEAPU32 and a Float32Array
// view of the same buffer). There is no assignment to any HEAP* element, no
// Module.ccall, no exported-function call that writes, anywhere in this file.
// The only write-capable shim on the page is the pre-existing B3.5 input shim
// (b35key), which belongs to the established page, not to multiplayer.
//
// Address provenance (B3.7 report §6.2, mined from production reVC.wasm
// sha256 8e8175ea0e894b1dacd4018559d320ec349c4250aad7d723dbbf1a6c7052ee79
// — valid ONLY for that binary; the byte-lock makes this safe):
//   Module._gGameState      (exported u32)  — game state; 9 = playing
//   CWorld::PlayerInFocus   u8  @ 2973762
//   CWorld::Players[0]      base @ 2973776  — CPlayerInfo stride 368
//     +0  m_pPed u32                        — CPed pointer (0 = none)
//     CPed +20/+24 forward-vector f32 x/y
//     CPed +52/+56/+60 position f32 x/y/z
//   heading = atan2(-fx, fy)                — B3.5/B3.6-verified convention
// The same reads ran live in every B3.5/B3.6 playtest (local + remote runs).
//
// Defensive rules implemented (task §3.4-3.9): re-derive focus->ped every
// poll; ped==0 -> no data; bounds-check every dereference; finite checks;
// world-range checks; per-tick teleport bound (same ped pointer); near-zero
// forward vector -> heading null (position stays valid); 10 Hz cadence;
// auto-suspend after a sustained invalid window; stop on pagehide/unload;
// never transmit raw memory, pointers, or anything beyond the schema fields.
window.GMPtel = (function(){
  'use strict';
  var CFG = {
    pollMs: 100,             // 10 updates/second (task §3.7)
    maxConsecBad: 300,       // ~30 s of invalid reads -> suspend
    maxTeleportU: 500,       // per-tick plausibility bound (same ped)
    maxAbsXY: 4000,          // Vice City world bounds (generous)
    minZ: -200, maxZ: 2000,
    minFwdSq: 1e-6,          // below: heading undefined, pos still valid
    maxFwdSq: 4.0,           // unit vector + margin
    addrInFocus: 2973762,
    addrPlayers: 2973776,
    stridePlayerInfo: 368
  };

  var st = {
    running: false, timer: null, startedAt: 0,
    last: null,              // last VALID sample (with t/mono)
    prev: null,              // M2.2 diag: previous valid sample (motion delta)
    lastMoveAt: 0,           // M2.2 diag: when position last changed >0.05 u
    lastReason: '',          // M2.2 diag: why the last tick was invalid
    lastPed: 0, lastX: null, lastY: null, lastZ: null,
    consecutiveBad: 0, suspended: false, suspendReason: '',
    counts: { ticks:0, valid:0, notPlaying:0, noPed:0, nonFinite:0,
              outOfRange:0, teleport:0, noModule:0, exportMissing:0,
              badFocus:0, oob:0 },
    f32: null, f32Len: 0,
    err: null
  };

  function heapReady(){
    var M = window.Module;
    if (!M || !M.HEAPU8 || !M.HEAPU8.buffer) return null;
    var len = M.HEAPU8.buffer.byteLength;
    if (!st.f32 || st.f32Len !== len) {
      // WASM memory growth appends; rebuild the f32 view (B3.7 §6 risk note)
      st.f32 = new Float32Array(M.HEAPU8.buffer);
      st.f32Len = len;
    }
    return M;
  }

  function gameState(M){
    // Prefer the exported symbol; NEVER a raw address for the gate.
    try {
      if (M._gGameState == null) { st.counts.exportMissing++; return null; }
      return M.HEAPU32[M._gGameState >> 2];
    } catch(e) { return null; }
  }

  // One read-only sample. Returns {ok, reason, ...fields}.
  function sample(){
    var out = { ok:false, reason:'', gs:null, focus:null, ped:null,
                x:null, y:null, z:null, h:null, fx:null, fy:null };
    var M = heapReady();
    if (!M) { st.counts.noModule++; out.reason = 'no-module'; return out; }
    var u8 = M.HEAPU8, u32 = M.HEAPU32, f32 = st.f32;
    var gs = gameState(M);
    out.gs = gs;
    if (gs !== 9) { out.reason = 'not-playing'; return out; }
    var heapLen = u8.length;
    var focus = u8[CFG.addrInFocus];
    out.focus = focus;
    if (!(focus >= 0 && focus < 4)) { st.counts.badFocus++; out.reason = 'bad-focus'; return out; }
    var pbase = CFG.addrPlayers + focus * CFG.stridePlayerInfo;
    if (pbase + 4 > heapLen) { st.counts.oob++; out.reason = 'pbase-oob'; return out; }
    var ped = u32[pbase >> 2];
    out.ped = ped;
    if (!ped) { out.reason = 'no-ped'; return out; }          // re-derived each tick
    if (ped + 64 > heapLen) { st.counts.oob++; out.reason = 'ped-oob'; return out; }
    var x = f32[(ped + 52) >> 2], y = f32[(ped + 56) >> 2], z = f32[(ped + 60) >> 2];
    var fx = f32[(ped + 20) >> 2], fy = f32[(ped + 24) >> 2];
    out.x = x; out.y = y; out.z = z; out.fx = fx; out.fy = fy;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
        !Number.isFinite(fx) || !Number.isFinite(fy)) {
      st.counts.nonFinite++; out.reason = 'non-finite'; return out;
    }
    if (Math.abs(x) > CFG.maxAbsXY || Math.abs(y) > CFG.maxAbsXY ||
        z < CFG.minZ || z > CFG.maxZ) {
      st.counts.outOfRange++; out.reason = 'out-of-range'; return out;
    }
    var fsq = fx * fx + fy * fy;
    if (fsq < CFG.minFwdSq) {
      out.h = null;                       // near-zero: heading undefined — safe
    } else if (fsq <= CFG.maxFwdSq) {
      out.h = Math.atan2(-fx, fy);        // verified convention (B3.7 §6.2)
    } else {
      st.counts.outOfRange++; out.reason = 'fwd-out-of-range'; return out;
    }
    if (ped === st.lastPed && st.lastX != null) {
      var dx = x - st.lastX, dy = y - st.lastY, dz = z - st.lastZ;
      if ((dx*dx + dy*dy + dz*dz) > CFG.maxTeleportU * CFG.maxTeleportU) {
        st.counts.teleport++; out.reason = 'teleport'; return out;
      }
    }
    out.ok = true;
    return out;
  }

  function tick(){
    st.counts.ticks++;
    var s = sample();
    st.lastReason = s.ok ? '' : (s.reason || '');   // M2.2 diag
    if (s.ok) {
      st.counts.valid++;
      st.consecutiveBad = 0;
      if (st.suspended) st.suspended = false;
      st.lastPed = s.ped; st.lastX = s.x; st.lastY = s.y; st.lastZ = s.z;
      s.t = Date.now(); s.mono = performance.now();
      // M2.2 diag: local-motion tracking (is the engine actually moving the ped?)
      if (st.last && st.last.x != null) {
        var mdx = s.x - st.last.x, mdy = s.y - st.last.y;
        if (mdx * mdx + mdy * mdy > 0.0025) st.lastMoveAt = s.t;   // >0.05 u
      }
      st.prev = st.last;
      st.last = s;
      if (window.GMPui) { try { window.GMPui.onLocal(s); } catch(e) {} }
    } else {
      st.consecutiveBad++;
      switch (s.reason) {
        case 'not-playing': st.counts.notPlaying++; break;
        case 'no-ped':      st.counts.noPed++; break;
        case 'non-finite':  st.counts.nonFinite++; break;
        case 'out-of-range':
        case 'fwd-out-of-range': st.counts.outOfRange++; break;
        case 'teleport':    st.counts.teleport++; break;
      }
      if (st.consecutiveBad >= CFG.maxConsecBad && !st.suspended) {
        st.suspended = true;
        st.suspendReason = s.reason;
        if (window.GMPui) { try { window.GMPui.onLocalSuspended(st); } catch(e) {} }
      }
    }
  }

  function start(){
    if (st.running) return false;
    st.running = true;
    st.startedAt = Date.now();
    st.consecutiveBad = 0;
    st.suspended = false;
    st.timer = setInterval(tick, CFG.pollMs);
    return true;
  }
  function stop(){
    st.running = false;
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    return true;
  }

  // stop sampling when the page is unloading (task §3.6)
  window.addEventListener('pagehide', stop);
  window.addEventListener('beforeunload', stop);

  function stats(){
    var nowMs = Date.now();
    return {
      running: st.running, suspended: st.suspended,
      suspendReason: st.suspendReason, consecutiveBad: st.consecutiveBad,
      counts: st.counts, uptimeMs: st.startedAt ? nowMs - st.startedAt : 0,
      heapMB: (function(){ try { return +(window.Module.HEAPU8.byteLength / 1048576).toFixed(1); } catch(e) { return null; } })(),
      // M2.2 diagnostics (stage A: local gameplay sampling)
      lastAgeMs: st.last ? nowMs - st.last.t : null,
      lastReason: st.lastReason,
      gs: (st.last && st.last.gs != null) ? st.last.gs : null,
      lastXY: (st.last && st.last.x != null) ? [+st.last.x.toFixed(1), +st.last.y.toFixed(1)] : null,
      stillForMs: st.last ? (st.lastMoveAt ? nowMs - st.lastMoveAt : nowMs - st.last.t) : null
    };
  }

  // Public surface. GMPnet reads `last` (most recent valid sample) at its own
  // send cadence; nothing here pushes memory contents anywhere.
  return {
    start: start, stop: stop,
    sampleOnce: sample,
    state: st,
    cfg: CFG,
    stats: stats,
    lastValid: function(){ return st.last; }
  };
})();
