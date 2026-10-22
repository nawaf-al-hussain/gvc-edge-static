// gmp-ui.js — B3.8 Ghost-MP M1 panel renderer (DOM-only).
// Renders: local telemetry readout (Phase B), honest net status, the room
// roster with local/remote distinction (Phase D), and a top-down
// world-space minimap of the verified position/heading values. All values
// are display-only — nothing here feeds back into the engine and nothing
// here writes to engine memory.
window.GMPui = (function(){
  'use strict';
  var telEl, netEl, errEl, rosterEl, mapEl, mapCtx;
  var lastPaint = 0;
  var disp = {};          // sid -> smoothed display copy {x,y,h}
  var WORLD = 2048;       // minimap covers +-2048 world units

  function $(id){ return document.getElementById(id); }

  function fmtDeg(h){
    if (h == null) return 'n/a';
    var d = (h * 180 / Math.PI) % 360;
    if (d < 0) d += 360;
    return d.toFixed(1) + '°';
  }

  // ---------- local telemetry ----------
  function onLocal(s){
    var nowp = performance.now();
    if (nowp - lastPaint < 90) return;
    lastPaint = nowp;
    if (!telEl) telEl = $('gmp-tel');
    if (!telEl) return;
    var st = window.GMPtel ? window.GMPtel.stats() : {};
    telEl.textContent =
      'local player (read-only heap telemetry, 10 Hz)\n' +
      '  gs=' + s.gs + ' focus=' + s.focus + ' ped=0x' + (s.ped >>> 0).toString(16) + '\n' +
      '  x=' + s.x.toFixed(2) + '  y=' + s.y.toFixed(2) + '  z=' + s.z.toFixed(2) + '\n' +
      '  heading=' + fmtDeg(s.h) + '  fwd=(' + s.fx.toFixed(3) + ', ' + s.fy.toFixed(3) + ')\n' +
      '  sampler: valid=' + st.counts.valid + '/' + st.counts.ticks +
      '  rejected[menu/load=' + st.counts.notPlaying + ' noPed=' + st.counts.noPed +
      ' nonFinite=' + st.counts.nonFinite + ' range=' + st.counts.outOfRange +
      ' teleport=' + st.counts.teleport + ']\n' +
      '  suspended=' + (st.suspended ? 'YES (' + st.suspendReason + ')' : 'no') +
      '  heap=' + st.heapMB + ' MB';
  }

  function onLocalSuspended(st){
    if (!telEl) telEl = $('gmp-tel');
    if (telEl) telEl.textContent = 'sampler SUSPENDED after sustained invalid reads (' +
      st.suspendReason + '). Will resume automatically when valid state returns.';
  }

  // ---------- net state ----------
  function stateLabel(ns){
    if (!ns) return 'off';
    switch (ns.state) {
      case 'off': return 'off';
      case 'connecting': return 'connecting…';
      case 'hub': return 'online — HOST (sid 0) room "' + ns.room + '"';
      case 'guest': return 'online — GUEST (sid ' + ns.sid + ') room "' + ns.room + '"';
      case 'migrating': return 'host left — rejoining…';
      case 'denied': return 'denied (' + (ns.lastErr || '') + ')';
      case 'unavailable': return 'UNAVAILABLE — ' + (ns.lastErr || 'multiplayer backend not reachable');   // M2.4: show the real cause
      case 'error': return 'error: ' + (ns.lastErr || '?');
      default: return ns.state;
    }
  }

  function onNetState(ns){
    if (!netEl) netEl = $('gmp-netstate');
    if (netEl) netEl.textContent = stateLabel(ns);
    if (!errEl) errEl = $('gmp-neterr');
    if (errEl) {
      var n = window.GMPnet ? window.GMPnet.stats() : null;
      errEl.textContent = (n && n.state === 'unavailable')
        ? 'the game runs fine without multiplayer — join again to retry'
        : '';
    }
  }

  // ---------- roster ----------
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function onRoster(peers){
    if (!rosterEl) rosterEl = $('gmp-roster');
    if (!rosterEl) return;
    if (!peers || !peers.length) { rosterEl.innerHTML = '<span class="stale">room empty</span>'; return; }
    var html = 'players in room: ' + peers.length + '<br>';
    for (var i = 0; i < peers.length; i++) {
      var p = peers[i];
      var me = p.me || (window.GMPnet && window.GMPnet.stats().sid === p.sid);
      html += '<span class="' + (me ? 'me' : '') + '"><span class="cchip" style="background:' +
        esc(p.color) + '"></span>' + (me ? 'YOU — ' : '') + esc(p.name) +
        ' (sid ' + p.sid + ')</span><br>';
    }
    rosterEl.innerHTML = html;
  }

  // ---------- minimap (top-down world plot; display-only) ----------
  function ensureMap(){
    if (mapEl) return true;
    mapEl = $('gmp-minimap');
    if (!mapEl) return false;
    mapCtx = mapEl.getContext('2d');
    return true;
  }

  function drawGhost(ctx, g, alpha, stale){
    var mx = (g.x / WORLD) * 0.5 * mapEl.width + mapEl.width / 2;
    var my = mapEl.height / 2 - (g.y / WORLD) * 0.5 * mapEl.height;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = stale ? '#667' : g.color;
    ctx.beginPath();
    ctx.arc(mx, my, stale ? 3 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (g.h != null && !stale) {
      // heading tick: engine convention heading = atan2(-fx, fy); minimap is
      // north-up with -y world = up, so a heading of 0 faces +y world (down)
      var hx = mx + Math.sin(g.h) * 9;
      var hy = my + Math.cos(g.h) * 9;
      ctx.strokeStyle = stale ? '#667' : g.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMap(){
    if (!ensureMap() || !mapCtx) return;
    var W = mapEl.width, H = mapEl.height;
    var ctx = mapCtx;
    ctx.clearRect(0, 0, W, H);
    // frame + axes
    ctx.strokeStyle = '#246';
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.strokeStyle = '#1a3348';
    ctx.beginPath();
    ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H);
    ctx.moveTo(0, H/2); ctx.lineTo(W, H/2);
    ctx.stroke();
    ctx.fillStyle = '#456';
    ctx.font = '9px monospace';
    ctx.fillText('top-down world plot (x east, y south) — display only', 6, H - 5);
    // ghosts from the transport
    var net = window.GMPnet;
    if (!net) return;
    var ghosts = net.ghostList();
    var meSid = net.stats().sid;
    var t = Date.now();
    var drawn = 0;   // M2.2 diag (stage D: minimap)
    // smooth display copies (purely visual lerp toward the latest sample)
    for (var sid in ghosts) {
      var g = ghosts[sid];
      var d = disp[sid];
      if (!d) d = disp[sid] = { x: g.x, y: g.y, h: g.h };
      else {
        d.x += (g.x - d.x) * 0.35;
        d.y += (g.y - d.y) * 0.35;
        if (g.h != null) {
          if (d.h == null) d.h = g.h;
          else {
            var dh = g.h - d.h;
            while (dh > Math.PI) dh -= Math.PI * 2;
            while (dh < -Math.PI) dh += Math.PI * 2;
            d.h += dh * 0.35;
          }
        }
      }
      var age = t - g.t;
      var stale = age > 3000;
      if (age > 10000) { delete disp[sid]; continue; }
      if (!stale) drawn++;
      drawGhost(ctx, { x: d.x, y: d.y, h: d.h, color: g.color }, stale ? 0.45 : 1, stale);
    }
    // clean display cache for gone ghosts
    for (var s2 in disp) if (!ghosts[s2]) delete disp[s2];
    // M2.2 diag: minimap liveness + how many remote dots are being drawn
    window.__gmpMapDiag = { at: Date.now(), drawn: drawn, frames: (window.__gmpMapDiag ? window.__gmpMapDiag.frames + 1 : 1) };
  }
  setInterval(drawMap, 120);

  // ---------- M2.1 sync diagnostics block ----------
  // Makes the invisible half of the system visible: whether state frames
  // actually flow to/from each peer, and if not, WHY (peer not in gameplay
  // vs connection quiet vs validation rejects). DOM-only.
  var syncEl;
  function ageStr(ms) {
    if (ms == null) return 'never';
    return (ms / 1000).toFixed(1) + 's ago';
  }
  function renderSync(){
    if (!syncEl) syncEl = $('gmp-sync');
    if (!syncEl) return;
    var net = window.GMPnet;
    if (!net || !net.stats) { syncEl.textContent = 'sync: (transport not loaded)'; return; }
    var s = net.stats();
    // [B3.8-M2.2] engine-slot warning: this tab lost the engine slot to a
    // sibling tab (Chromium single sync-access-handle per OPFS file) — this
    // tab can never reach gameplay, so say so instead of "no indication".
    try {
      if (window.__gmpSlot && window.__gmpSlot.held === 'other') {
        syncEl.textContent = 'ENGINE: another tab in this browser owns the engine slot — ' +
          'this tab cannot reach gameplay (Chromium OPFS single-handle limit).\n' +
          'Use a separate browser profile/window for player 2; this tab\u2019s panel still shows the room.';
        return;
      }
    } catch (e) {}
    if (s.state === 'off' || s.state === 'connecting' || s.state === 'migrating') {
      syncEl.textContent = 'sync: (not in a room)';
      return;
    }
    var lines = [];
    // M2.2 stage A: local gameplay sampling status (engine loop + sampler)
    try {
      var tel = window.GMPtel ? window.GMPtel.stats() : null;
      var raf = window.__gmpRaf;
      if (tel && tel.lastXY) {
        var moving = tel.stillForMs != null && tel.stillForMs < 1200;
        lines.push('game: gs=' + tel.gs + ' @(' + tel.lastXY[0] + ',' + tel.lastXY[1] + ')' +
          ' ' + (moving ? 'MOVING' : 'still ' + ((tel.stillForMs / 1000) | 0) + 's') +
          (tel.lastReason ? ' lastReject=' + tel.lastReason : '') +
          (raf ? ' | rAF ' + (raf.t && (Date.now() - raf.t < 1500) ? 'running' : 'STALLED') : ''));
      } else if (tel) {
        lines.push('game: no telemetry yet' + (tel.lastReason ? ' (' + tel.lastReason + ')' : '') +
          (raf ? ' | rAF ' + (raf.t && (Date.now() - raf.t < 1500) ? 'running' : 'STALLED') : ''));
      }
    } catch (e) {}
    var sent = (s.lastSentStateAgeMs != null && s.lastSentStateAgeMs < 2500)
      ? 'sending states ' + ageStr(s.lastSentStateAgeMs) +
        ' #' + s.lastSentSeq + ' src=' + (s.sendSrc || '?')
      : 'sending heartbeats only (not in gameplay)';
    lines.push('sync: you=' + s.role + ' sid=' + s.sid + ' | ' + sent +
      // M2.3 stage-E: ICE state of the transport path (guest -> hub DataChannel)
      (s.lastIce && s.role === 'guest' ? ' | ice=' + s.lastIce : '') +
      (s.lastPeerErr ? ' | peerErr=' + s.lastPeerErr : ''));
    // M2.2 stage B/C counters (state vs heartbeat split)
    var c = s.counters || {};
    lines.push('  frames: sent s/hb=' + (c.sentState || 0) + '/' + (c.sentHb || 0) +
      '  recv s/hb=' + (c.recvState || 0) + '/' + (c.recvHb || 0) +
      '  rej=' + (c.rejected || 0));
    var peers = (s.sync && s.sync.peers) || [];
    var i;
    if (s.role === 'hub') {
      if (!peers.length) lines.push('  peers: none connected');
      for (i = 0; i < peers.length; i++) {
        var p = peers[i];
        var coord = p.coords ? ' @(' + p.coords[0] + ',' + p.coords[1] + ')' : '';
        var seq = p.lastSeq != null ? ' #' + p.lastSeq : '';
        var mov = p.moving ? ' MOVING' : '';
        if (p.lastStateAgeMs != null && p.lastStateAgeMs < 3000) {
          lines.push('  ' + p.name + ' (sid ' + p.sid + '): states ' + ageStr(p.lastStateAgeMs) + seq + coord + mov + ' [STREAMING]');
        } else if (p.lastStateAgeMs != null) {
          lines.push('  ' + p.name + ' (sid ' + p.sid + '): states STOPPED ' + ageStr(p.lastStateAgeMs) + seq + coord);
        } else if (p.hbOnly) {
          lines.push('  ' + p.name + ' (sid ' + p.sid + '): alive, NO game state \u2014 their tab is at menu/loading');
        } else {
          lines.push('  ' + p.name + ' (sid ' + p.sid + '): quiet ' + ageStr(p.lastAnyAgeMs));
        }
      }
    } else if (s.sync && s.sync.hub) {
      var h = s.sync.hub;
      var hcoord = h.coords ? ' @(' + h.coords[0] + ',' + h.coords[1] + ')' : '';
      var hseq = h.lastSeq != null ? ' #' + h.lastSeq : '';
      var hmov = h.moving ? ' MOVING' : '';
      if (h.lastStateAgeMs != null && h.lastStateAgeMs < 3000) {
        lines.push('  host: states ' + ageStr(h.lastStateAgeMs) + hseq + hcoord + hmov + ' [STREAMING]');
      } else if (h.lastStateAgeMs != null) {
        lines.push('  host: states STOPPED ' + ageStr(h.lastStateAgeMs) + hseq + hcoord);
      } else if (h.hbOnly) {
        lines.push('  host: alive, NO game state \u2014 host tab is at menu/loading');
      } else {
        lines.push('  host: no packets yet\u2026');
      }
    }
    var ghostN = s.ghosts || 0;
    if (ghostN === 0) {
      lines.push('  ghosts: 0 \u2014 other player must reach gameplay (New Game \u2192 freeroam) on their tab');
    } else {
      // M2.2 stage D: what the renderer is actually doing with those ghosts
      var rd = null;
      try { rd = window.GMPoverlay ? window.GMPoverlay.stats() : null; } catch (e) {}
      var md = window.__gmpMapDiag || null;
      var rline = '  ghosts with data: ' + ghostN;
      if (rd) rline += ' | view: ' + (rd.noView ? 'no-camera' : 'ok') +
        ' in-view=' + rd.inView + ' edge=' + rd.edge +
        (rd.rafStalled ? ' overlay-rAF STALLED' : '');
      if (md) rline += ' | minimap: ' + md.drawn + ' dot(s), map ' +
        ((Date.now() - md.at < 3000) ? 'live' : 'STALLED');
      lines.push(rline);
    }
    if (s.lastReject) lines.push('  lastReject: ' + s.lastReject);
    syncEl.textContent = lines.join('\n');
  }
  setInterval(renderSync, 500);

  return {
    onLocal: onLocal, onLocalSuspended: onLocalSuspended,
    setNet: function(a, b){ onNetState({ state: a, lastErr: b }); },
    onNetState: onNetState, onRoster: onRoster
  };
})();

// ---- join/leave wiring ----
(function(){
  window.addEventListener('load', function(){
    var joinB = document.getElementById('gmp-join');
    var leaveB = document.getElementById('gmp-leave');
    var roomI = document.getElementById('gmp-room');
    var nameI = document.getElementById('gmp-name');
    if (!joinB) return;
    joinB.addEventListener('click', function(){
      var r = String(roomI.value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      var n = String(nameI.value || '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 16);
      if (r.length < 3 || r.length > 24) {
        window.GMPui.onNetState({ state: 'off', lastErr: 'room name: 3-24 chars of a-z 0-9 or -' });
        return;
      }
      roomI.value = r;
      var res = window.GMPnet.join(r, n || 'ghost');
      if (typeof res === 'string' && res) window.GMPui.setNet('off', res);
    });
    leaveB.addEventListener('click', function(){
      try { window.GMPnet.leave(); } catch(e) {}
    });
  });
})();

// auto-start the sampler once the engine is up (harmless before gameplay:
// while gs!=9 every tick is counted as not-playing and nothing is published)
window.addEventListener('load', function(){
  var tries = 0;
  var t = setInterval(function(){
    tries++;
    if (window.GMPtel) { GMPtel.start(); clearInterval(t); }
    else if (tries > 100) clearInterval(t);
  }, 100);
});
