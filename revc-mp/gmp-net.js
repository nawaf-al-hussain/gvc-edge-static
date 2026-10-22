// gmp-net.js — B3.8 Ghost-MP M1 transport (Phase C).
//
// Topology: room-scoped star. The first peer in a room claims the
// deterministic hub id `<prefix><room>-h` on the free PeerJS cloud broker
// (0.peerjs.com — no account, no card; B3.7 §7 option 1) and acts as the
// room authority; everyone else connects to it. The hub issues session ids
// and colors, validates/relays 10 Hz state frames, enforces rate/size/roster
// caps, and evicts stale peers. Client-supplied identity is never
// authoritative: names are display-only and sanitized, sids/colors are
// hub-issued. Client sequence numbers are relayed for debugging only —
// ordering decisions use server arrival time, never client timestamps.
//
// Hub migration: if the hub connection drops, guests wait a random
// 200-800 ms and race to re-claim the hub id; the winner re-opens the room
// (roster restarts; sids re-issued — documented M1 limitation).
//
// Message schema v1 (the ONLY fields ever transmitted — no memory
// contents, no pointers, no paths, no URLs, no credentials):
//   guest->hub : {v:1, t:"hello", name:string<=16}
//                {v:1, t:"s", q:0..2^31, x,y,z:number, h:number|null}
//                {v:1, t:"bye"}
//   hub->guest : {v:1, t:"welcome", sid, color, room}
//                {v:1, t:"roster", peers:[{sid,name,color}]}
//                {v:1, t:"s", sid, x,y,z, h}
//                {v:1, t:"leave", sid, reason}
//                {v:1, t:"deny", reason}
//   both ways  : {v:1, t:"hb"}  (liveness only; M2.1 adds hub->guest idle hb
//                so a guest can tell "host at menu" from "host gone")
//
// M2.1 background-tab fix: Chromium clamps setInterval on HIDDEN tabs to
// ~1 Hz. In the owner's real two-tab setup the hidden tab's interval
// sampler stored samples >500 ms old, so the old send-time freshness gate
// systematically rejected them and the hidden tab degraded to heartbeat-
// only: the visible tab kept roster co-presence but received ZERO state
// frames (no marker, no minimap dot, nothing). Every sandbox test missed
// this because each test client ran in its own headless browser instance,
// i.e. always visible. Fix: sample the engine AT SEND TIME (read-only
// GMPtel.sampleOnce) so every transmitted frame is fresh by construction,
// with a 2.5 s grace on the stored sample for scheduler jitter.
// Validation: JSON schema check + finite/range checks + <=512 B serialized
// size + <=20 msg/s sustained per connection (burst 40) + roster cap 8.
window.GMPnet = (function(){
  'use strict';
  var SCHEMA = 1;
  var CFG = {
    idPrefix: 'gvc8b8-',
    hubSuffix: '-h',
    stateHz: 10,
    msgBytes: 512,
    ratePerSec: 20, rateBurst: 40,
    rosterCap: 8,
    hubEvictMs: 5000,      // no state from a guest for 5 s -> evict (B3.7 A4)
    ghostStaleMs: 3000,    // display marks a ghost stale
    ghostDropMs: 10000,    // display removes a ghost
    staleGraceMs: 2500,    // M2.1: max age of the stored sample still sendable
                           // (covers hidden-tab 1 Hz timer clamping with margin)
    joinTimeoutMs: 15000,
    joinRetryMax: 2,       // M2.1b: self-heal retries on join timeout (stale hub id)
    retryMax: 5,
    retryBackoffMs: 1500,
    world: { maxAbsXY: 4000, minZ: -200, maxZ: 2000 },
    colors: ['#ff5252', '#4fc3f7', '#ffd54f', '#69f0ae', '#ba68c8', '#ff8a65', '#fff176', '#64ffda']
  };

  // M2.3/M2.6: WebRTC media path. STUN baseline + short-lived Cloudflare
  // Realtime TURN credentials loaded from same-origin ice-config.json
  // (minted daily by the turn-refresh GitHub Action, TTL 24h). The public
  // OpenRelay TURN was removed 2026-10-22: its domain is a sinkhole
  // (192.0.2.1), so every relay-dependent topology was dead on arrival
  // (join timeout, ice=checking). Transport-layer only: touches no
  // validation, no offsets, no camera.
  var ICE_SERVERS = [ { urls: 'stun:stun.l.google.com:19302' } ];
  var PEER_CFG = {
    debug: 0,
    config: {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2
    }
  };
  // M2.6: swap in TURN as soon as the static ICE config arrives. A join
  // that races ahead of it simply runs STUN-first and self-heals via
  // retryJoin (M2.1b) on the next attempt.
  try {
    fetch('../ice-config.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.iceServers && d.iceServers.length) {
          ICE_SERVERS.length = 0;
          Array.prototype.push.apply(ICE_SERVERS, d.iceServers);
        }
      }).catch(function () {});
  } catch (e) {}

  var hbLast = 0;
  var lastReject = '';
  var joinRetryCount = 0;   // M2.1b: join-timeout self-heal retries (per manual join)
  var joinAttemptSeq = 0;   // M2.1b: guards stale timers/closures across join attempts
  var st = {
    state: 'off',          // off|connecting|hub|guest|denied|unavailable|error
    role: null,            // 'hub' | 'guest'
    room: null, myName: null,
    mySid: null, myColor: null,
    peer: null,            // PeerJS Peer
    hubConn: null,         // guest->hub DataConnection
    conns: {},             // hub role: sid -> {conn, name, lastSeen, secWin, secCount, drops}
    nextSid: 1,            // hub-issued session ids (0 = hub itself)
    ghosts: {},            // display: sid -> {name, color, x,y,z, h, t, lastT}
    roster: [],            // last roster received (guest view)
    q: 0,                  // outgoing sequence counter (debug only)
    counters: { sent:0, recv:0, rejected:0, drops:0, rateDrops:0, evictions:0,
                reconnects:0, migrations:0,
                sentState:0, sentHb:0, recvState:0, recvHb:0 },   // M2.2: stage B/C split
    lastSentStateAt: 0,    // M2.1 sync diagnostics (this tab's own state frames)
    lastHubStateAt: 0,     // guest role: last 's' received from the hub side
    lastHubHbAt: 0,        // guest role: last 'hb' received from the hub
    lastErr: null, joinedAt: 0,
    stateTimer: null, evictTimer: null, uiTimer: null,
    migrationTimer: null, joining: false
  };

  // ---------- helpers ----------
  function slug(room) {
    return String(room || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
  }
  function validRoom(room) {
    var s = slug(room);
    return s.length >= 3 && s === room;
  }
  function cleanName(n) {
    var s = String(n || '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, 16);
    return s || 'ghost';
  }
  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }
  function validStateFields(m) {
    if (!isFiniteNum(m.x) || !isFiniteNum(m.y) || !isFiniteNum(m.z)) return false;
    if (Math.abs(m.x) > CFG.world.maxAbsXY || Math.abs(m.y) > CFG.world.maxAbsXY) return false;
    if (m.z < CFG.world.minZ || m.z > CFG.world.maxZ) return false;
    if (m.h !== null && !isFiniteNum(m.h)) return false;
    if (m.h !== null && Math.abs(m.h) > Math.PI * 1.01) return false;
    if (!isFiniteNum(m.q) || m.q < 0 || m.q > 2147483647) return false;
    return true;
  }
  function now() { return Date.now(); }

  function reject(reason) {
    st.counters.rejected++;
    lastReject = reason + ' @' + new Date().toISOString().slice(11, 19);
  }
  function setUiState() {
    if (window.GMPui) { try { window.GMPui.onNetState(st); } catch(e) {} }
  }
  function fail(msg) {
    st.lastErr = String(msg).slice(0, 200);
    st.state = (st.state === 'denied') ? 'denied' : 'error';
    setUiState();
  }

  // M2.1b: the hub id can be held by a STALE broker registration — a tab that
  // was killed/slept without running beforeunload leaves its registration
  // routed but unanswered for minutes. Symptom: guest reaches the broker, the
  // offer to the hub id is accepted, nobody answers -> "hub unreachable (join
  // timeout)" on every previously-used room. Self-heal: re-run the whole join
  // (its first step re-claims the hub id). If the id was zombie-freed we
  // BECOME the hub and the room heals; if a live hub answers 'unavailable-id'
  // the fresh guest offer usually gets through. Exhausted -> actionable error.
  function retryJoin(room, name, isRetry, why) {
    if (st.state !== 'connecting') return;
    if (joinRetryCount >= CFG.joinRetryMax) {
      fail(why + ' — reload BOTH tabs and rejoin; if it persists use a NEW room name');
      return;
    }
    joinRetryCount++;
    st.counters.reconnects++;
    st.lastErr = why + ' — retrying (' + joinRetryCount + '/' + CFG.joinRetryMax + ')';
    joinAttemptSeq++;   // M2.1b: invalidate the dead attempt's open/data/close/error handlers
    try { if (st.hubConn) st.hubConn.close(); } catch (e) {}
    try { if (st.peer) st.peer.destroy(); } catch (e) {}
    st.hubConn = null; st.peer = null;
    st.joining = false;
    st.state = 'connecting';
    setUiState();
    setTimeout(function() { join(room, name, 'rj'); }, CFG.retryBackoffMs * joinRetryCount);
  }

  // rate limiter (token-ish sliding second window, hub side, per connection)
  function rateOk(rec) {
    var t = now();
    if (t - rec.secWin >= 1000) { rec.secWin = t; rec.secCount = 0; }
    rec.secCount++;
    if (rec.secCount > CFG.rateBurst) return false;
    return true;
  }

  // ---------- serialization-safe send ----------
  function send(conn, msg) {
    try {
      if (!conn || !conn.open) return false;
      var s = JSON.stringify(msg);
      if (s.length > CFG.msgBytes) { st.counters.rejected++; return false; }
      conn.send(s);
      st.counters.sent++;
      return true;
    } catch (e) { return false; }
  }

  // ---------- hub role ----------
  function becomeHub(room, name) {
    st.role = 'hub';
    st.state = 'hub';
    st.mySid = 0;
    st.myColor = CFG.colors[0];
    st.conns = {};
    st.nextSid = 1;
    st.joinedAt = now();
    st.lastErr = null;
    setUiState();
    startStateLoop();
    startEvictLoop();
    st.peer.on('connection', function(conn) {
      var rec = { conn: conn, name: '…', lastSeen: now(), secWin: now(),
                  secCount: 0, drops: 0, sid: null, helloed: false };
      conn.on('data', function(raw) { onHubData(rec, raw); });
      conn.on('close', function() { hubDrop(rec, 'conn-closed'); });
      conn.on('error', function() { hubDrop(rec, 'conn-error'); });
    });
    if (window.GMPui) { try { window.GMPui.onRoster(hubRoster()); } catch(e) {} }
  }

  function hubRoster() {
    var r = [{ sid: 0, name: st.myName, color: st.myColor, me: true }];
    for (var sid in st.conns) {
      var c = st.conns[sid];
      if (c.helloed) r.push({ sid: Number(sid), name: c.name, color: c.color });
    }
    return r;
  }
  function broadcast(msg, exceptSid) {
    for (var sid in st.conns) {
      if (Number(sid) === exceptSid) continue;
      send(st.conns[sid].conn, msg);
    }
  }

  function onHubData(rec, raw) {
    st.counters.recv++;
    rec.lastSeen = now();
    if (typeof raw === 'string' && raw.length > 1024) { reject('hub-oversize'); return; }
    var m;
    try { m = JSON.parse(raw); } catch (e) { reject('hub-json'); return; }
    if (!m || typeof m !== 'object' || m.v !== SCHEMA) { reject('hub-schema'); return; }
    var t = String(m.t || '');
    var sid = rec.sid;

    if (t === 'hello') {
      if (sid !== null) { reject('dup-hello'); return; }        // duplicate join
      if (hubCount() >= CFG.rosterCap) { send(rec.conn, {v:1,t:'deny',reason:'room-full'}); rec.conn.close(); return; }
      if (!rateOk(rec)) { st.counters.rateDrops++; return; }
      sid = st.nextSid++;
      rec.sid = sid;
      rec.name = cleanName(m.name);
      rec.color = CFG.colors[sid % CFG.colors.length];
      rec.helloed = true;
      st.conns[sid] = rec;
      send(rec.conn, { v:1, t:'welcome', sid: sid, color: rec.color, room: st.room });
      broadcast({ v:1, t:'roster', peers: hubRoster() });
      if (window.GMPui) { try { window.GMPui.onRoster(hubRoster()); } catch(e) {} }
      return;
    }
    if (sid === null) { reject('pre-hello'); return; }          // state before hello
    if (t === 's') {
      if (!rateOk(rec)) { st.counters.rateDrops++; return; }
      if (!validStateFields(m)) { reject('state-fields'); rec.drops++; return; }
      rec.lastStateAt = now();                              // M2.1 sync diag
      st.counters.recvState++;                              // M2.2 diag (stage C)
      rec.prevState = rec.lastState;                        // M2.2: motion delta
      rec.lastState = { x: m.x, y: m.y, z: m.z, q: m.q, t: rec.lastStateAt };
      broadcast({ v:1, t:'s', sid: sid, x: m.x, y: m.y, z: m.z, h: m.h, q: m.q }, sid);
      // hub's own display of this ghost
      ghostUpdate(sid, rec.name, rec.color, m);
      return;
    }
    if (t === 'bye') { hubDrop(rec, 'bye'); return; }
    if (t === 'hb') { if (rateOk(rec)) { rec.lastHbAt = now(); st.counters.recvHb++; } else st.counters.rateDrops++; return; }
    st.counters.rejected++;                                        // unknown type
  }

  function hubCount() {
    var n = 0;
    for (var sid in st.conns) if (st.conns[sid].helloed) n++;
    return n;
  }

  function hubDrop(rec, reason) {
    if (rec.sid === null || rec.sid === undefined) return;
    var sid = rec.sid;
    if (!st.conns[sid]) return;
    delete st.conns[sid];
    ghostRemove(sid);
    st.counters.evictions++;
    try { rec.conn.close(); } catch(e) {}
    broadcast({ v:1, t:'leave', sid: sid, reason: String(reason).slice(0,32) });
    broadcast({ v:1, t:'roster', peers: hubRoster() });
    if (window.GMPui) { try { window.GMPui.onRoster(hubRoster()); } catch(e) {} }
  }

  function startEvictLoop() {
    stopEvictLoop();
    st.evictTimer = setInterval(function() {
      if (st.role !== 'hub') return;
      var t = now();
      for (var sid in st.conns) {
        if (t - st.conns[sid].lastSeen > CFG.hubEvictMs) hubDrop(st.conns[sid], 'stale');
      }
    }, 1000);
  }
  function stopEvictLoop() { if (st.evictTimer) { clearInterval(st.evictTimer); st.evictTimer = null; } }

  // ---------- guest role ----------
  // M2.3: isRetry threaded through (was a ReferenceError in the two
  // failure handlers below — the M2.1b self-heal could never fire on the
  // guest conn path: "isRetry is not defined" thrown before retryJoin).
  function becomeGuest(room, name, isRetry) {
    st.role = 'guest';
    st.state = 'connecting';
    setUiState();
    var hubId = CFG.idPrefix + room + CFG.hubSuffix;
    var conn = st.peer.connect(hubId, { reliable: true, serialization: 'binary' });
    st.hubConn = conn;
    var opened = false;
    var attempt = ++joinAttemptSeq;   // M2.1b: only the latest attempt may retry/fail
    // M2.3 stage-E diag: surface the ICE state of the hub DataChannel so a
    // join failure report is conclusive (checking|connected|failed|...).
    st.lastIce = 'new';
    (function watchIce(pc, tries) {
      if (!pc) {
        if (tries > 0) setTimeout(function () { watchIce(conn.peerConnection, tries - 1); }, 250);
        return;
      }
      st.lastIce = pc.iceConnectionState || 'new';
      try {
        pc.addEventListener('iceconnectionstatechange', function () {
          st.lastIce = pc.iceConnectionState || st.lastIce;
        });
      } catch (e) {}
    })(conn.peerConnection, 12);
    conn.on('open', function() {
      if (attempt !== joinAttemptSeq) { try { conn.close(); } catch (e) {} return; }
      opened = true;
      st.state = 'guest';
      st.helloed = false;
      setUiState();
      send(conn, { v:1, t:'hello', name: cleanName(name) });
      startStateLoop();
    });
    conn.on('data', function(raw) {
      if (attempt !== joinAttemptSeq) return;   // M2.1b: stale attempt
      st.counters.recv++;
      if (typeof raw === 'string' && raw.length > 1024) { reject('guest-oversize'); return; }
      var m;
      try { m = JSON.parse(raw); } catch (e) { reject('guest-json: ' + String(raw).slice(0, 60)); return; }
      if (!m || typeof m !== 'object' || m.v !== SCHEMA) { reject('guest-schema'); return; }
      var t = String(m.t || '');
      if (t === 'welcome') {
        st.mySid = m.sid; st.myColor = m.color; st.helloed = true;
        st.joinedAt = now(); st.lastErr = null;
        setUiState();
      } else if (t === 'roster') {
        if (Array.isArray(m.peers)) { st.roster = m.peers; if (window.GMPui) { try { window.GMPui.onRoster(m.peers); } catch(e) {} } }
      } else if (t === 's') {
        var known = false;
        for (var i = 0; i < st.roster.length; i++) if (st.roster[i].sid === m.sid) known = true;
        if (!known || m.sid === st.mySid) { reject('s-unknown-sid sid=' + m.sid); return; }
        if (!validStateFields(m)) { reject('s-invalid-fields x=' + m.x + ' y=' + m.y + ' z=' + m.z + ' h=' + m.h + ' q=' + m.q); return; }
        st.lastHubStateAt = now();                            // M2.1 sync diag
        st.counters.recvState++;                              // M2.2 diag (stage C)
        st.hubPrevState = st.hubLastState;                    // M2.2: motion delta
        st.hubLastState = { x: m.x, y: m.y, z: m.z, q: m.q, t: st.lastHubStateAt };
        var nm = 'P#' + m.sid, col = '#888';
        for (var j = 0; j < st.roster.length; j++) if (st.roster[j].sid === m.sid) { nm = st.roster[j].name; col = st.roster[j].color; }
        ghostUpdate(m.sid, nm, col, m);
      } else if (t === 'hb') {
        st.lastHubHbAt = now();                               // M2.1: hub liveness
        st.counters.recvHb++;                                 // M2.2 diag
      } else if (t === 'leave') {
        ghostRemove(m.sid);
        var nr = [];
        for (var k = 0; k < st.roster.length; k++) if (st.roster[k].sid !== m.sid) nr.push(st.roster[k]);
        st.roster = nr;
        if (window.GMPui) { try { window.GMPui.onRoster(nr); } catch(e) {} }
      } else if (t === 'deny') {
        st.state = 'denied';
        st.lastErr = 'room: ' + String(m.reason || 'denied').slice(0, 40);
        setUiState();
        leave(false);
      }
      // unknown types are ignored
    });
    conn.on('close', function() {
      if (attempt !== joinAttemptSeq) return;   // M2.1b: closed by retryJoin, not a lost hub
      if (st.state !== 'off' && st.state !== 'denied') scheduleMigration(room, name);
    });
    conn.on('error', function(err) {
      if (!opened && attempt === joinAttemptSeq && st.state === 'connecting') {
        // hub id might be free -> we should have become hub; or broker issue
        retryJoin(room, name, isRetry, 'hub connect failed: ' + (err && err.type ? err.type : 'error') + ' (ice=' + (st.lastIce || 'n/a') + ')');
      }
    });
    setTimeout(function() {
      if (!opened && attempt === joinAttemptSeq && st.state === 'connecting') {
        retryJoin(room, name, isRetry, 'hub unreachable (join timeout, ice=' + (st.lastIce || 'n/a') + ')');
      }
    }, CFG.joinTimeoutMs);
  }

  function scheduleMigration(room, name) {
    if (st.migrationTimer) return;
    st.state = 'migrating';
    ghostClear();
    st.roster = [];
    setUiState();
    stopStateLoop();
    st.counters.migrations++;
    st.migrationTimer = setTimeout(function() {
      st.migrationTimer = null;
      if (st.state === 'off') return;
      // close everything and re-join (first attempt re-claims hub id)
      teardownPeer();
      st.counters.reconnects++;
      join(room, name, true);
    }, 200 + Math.floor(Math.random() * 600));
  }

  // ---------- ghost display state ----------
  function ghostUpdate(sid, name, color, m) {
    st.ghosts[sid] = {
      sid: sid, name: name, color: color,
      x: m.x, y: m.y, z: m.z, h: m.h,
      t: now(), mono: performance.now()
    };
  }
  function ghostRemove(sid) { delete st.ghosts[sid]; }
  function ghostClear() { st.ghosts = {}; }

  // ---------- outbound state loop (10 Hz) ----------
  // M2.1: sample the engine AT SEND TIME. GMPtel.sampleOnce() is a cheap
  // read-only heap read; a synchronous sample is fresh by construction, so
  // a background tab throttled to ~1 Hz still transmits valid positions
  // (at ~1 Hz) instead of degrading to heartbeat-only. The stored-sample
  // fallback keeps the previous behavior when the synchronous read is
  // momentarily invalid but a recent validated sample exists.
  var lastSendSrc = '';     // M2.2 diag: 'live' (sampleOnce) or 'stored' for the last sent state
  function freshTel() {
    var t = now();
    try {
      var s = window.GMPtel ? window.GMPtel.sampleOnce() : null;
      if (s && s.ok) { s.t = t; s.mono = performance.now(); lastSendSrc = 'live'; return s; }
    } catch (e) {}
    var lv = window.GMPtel ? window.GMPtel.lastValid() : null;
    if (lv && t - (lv.t || 0) <= CFG.staleGraceMs) { lastSendSrc = 'stored'; return lv; }
    return null;
  }
  function startStateLoop() {
    stopStateLoop();
    st.stateTimer = setInterval(function() {
      var tel = freshTel();
      if (!tel) {
        // no validated gameplay telemetry (menu/load/suspended): keep the
        // session alive instead of transmitting stale data. Guests hb the
        // hub; the hub (M2.1) also hb's guests so they can tell
        // "host at menu/loading" from "host gone".
        if (st.role === 'guest' && st.hubConn && st.helloed &&
            now() - hbLast > 500) { hbLast = now(); send(st.hubConn, { v: SCHEMA, t: 'hb' }); }
        else if (st.role === 'hub' && now() - hbLast > 2000) {
          hbLast = now(); st.counters.sentHb++; broadcast({ v: SCHEMA, t: 'hb' });
        }
        return;
      }
      var m = { v: SCHEMA, t: 's', sid: st.mySid === null ? 0 : st.mySid,
                q: (st.q = (st.q + 1) & 0x7fffffff),
                x: +tel.x.toFixed(3), y: +tel.y.toFixed(3), z: +tel.z.toFixed(3),
                h: (tel.h == null) ? null : +tel.h.toFixed(4) };
      st.lastSentStateAt = now();
      st.counters.sentState++;                 // M2.2 diag (stage B: real state frames)
      st.lastSentSeq = m.q; st.lastSendSrc = lastSendSrc;
      if (st.role === 'hub') {
        // relay own state to guests + own display
        broadcast(m);
        ghostUpdate(0, st.myName, st.myColor, m);
      } else if (st.role === 'guest' && st.hubConn && st.helloed) {
        send(st.hubConn, m);
      }
    }, 1000 / CFG.stateHz);
  }
  function stopStateLoop() { if (st.stateTimer) { clearInterval(st.stateTimer); st.stateTimer = null; } }

  // ---------- peer lifecycle ----------
  function teardownPeer() {
    stopStateLoop();
    stopEvictLoop();
    try { if (st.hubConn) st.hubConn.close(); } catch(e) {}
    try { if (st.peer) st.peer.destroy(); } catch(e) {}
    st.hubConn = null; st.peer = null;
    st.lastSentStateAt = 0; st.lastHubStateAt = 0; st.lastHubHbAt = 0;
    ghostClear(); st.roster = [];
  }

  function join(room, name, isRetry) {
    if (st.joining) return null;
    if (!validRoom(room)) return 'room name: 3-24 chars of a-z 0-9 or -';
    if (st.state === 'hub' || st.state === 'guest') return null;  // duplicate join no-op
    if (!isRetry) joinRetryCount = 0;   // M2.1b: only a fresh manual join resets self-heal
    st.joining = true;
    st.room = slug(room);
    st.myName = cleanName(name);
    st.state = 'connecting';
    if (isRetry !== 'rj') st.lastErr = null;   // M2.1b: keep the retry status visible
    setUiState();

    var hubId = CFG.idPrefix + st.room + CFG.hubSuffix;
    var claimed = false;
    try {
      st.peer = new Peer(hubId, PEER_CFG);   // M2.3: TURN relay path added
    } catch (e) {
      st.joining = false;
      fail('peer construct failed: ' + e);
      return null;
    }
    st.peer.on('open', function(id) {
      st.joining = false;
      if (id === hubId) becomeHub(st.room, st.myName);
      else becomeGuest(st.room, st.myName, isRetry);   // M2.3: pass retry flag through
    });
    st.peer.on('error', function(err) {
      var type = err && err.type ? err.type : 'error';
      st.lastPeerErr = type;   // M2.3 stage-E diag
      if (type === 'unavailable-id' && !claimed) {
        // someone else holds the hub id -> join as guest
        claimed = true;
        try { st.peer.destroy(); } catch(e) {}
        st.joining = false;
        st.peer = new Peer(PEER_CFG);   // broker-assigned id
        st.peer.on('open', function() { becomeGuest(st.room, st.myName, isRetry); });
        st.peer.on('error', function(e2) {
          var t2 = e2 && e2.type ? e2.type : 'error';
          st.joining = false;
          st.lastPeerErr = t2;   // M2.4: guest-peer errors were never recorded before
          if (st.state === 'guest' || st.state === 'hub') return;   // M2.4: live-room blip, never corrupt state
          // M2.4: pre-open guest-peer failures (dead/stale hub id, broker
          // hiccup) go through the M2.1b self-heal — budgeted retries that
          // RE-CLAIM the hub id (a stale id heals by becoming hub; a live
          // hub answers the fresh guest offer) with an actionable final
          // error, instead of blind re-joins that dead-end at 'unavailable'.
          retryJoin(st.room, st.myName, isRetry, 'join error (' + t2 + ')');
        });
        return;
      }
      st.joining = false;
      // M2.4: post-join peer errors (broker blips while a room is live)
      // must never corrupt a working hub/guest state — record only.
      if (st.state === 'hub' || st.state === 'guest') return;
      // M2.4: claim-peer failures route through the M2.1b self-heal as
      // well (budgeted, re-claiming, actionable) instead of the blind
      // retry loop that dead-ended at a bare 'unavailable' state.
      retryJoin(st.room, st.myName, isRetry,
        type === 'peer-unavailable'
          ? 'room hub dead or stale (peer-unavailable)'
          : 'multiplayer backend error (' + type + ')');
    });
    return null;
  }

  function leave(notify) {
    if (notify !== false && st.role === 'guest' && st.hubConn) send(st.hubConn, { v:1, t:'bye' });
    if (notify !== false && st.role === 'hub') broadcast({ v:1, t:'leave', sid: 0, reason: 'hub-left' });
    teardownPeer();
    st.role = null; st.mySid = null; st.myColor = null;
    st.state = 'off';
    setUiState();
    if (window.GMPui) { try { window.GMPui.onRoster([]); } catch(e) {} }
  }

  window.addEventListener('pagehide', function(){ leave(false); });
  window.addEventListener('beforeunload', function(){ leave(false); });

  // M2.1: per-peer sync state for the diagnostics panel / HUD chip.
  // hbOnly=true means the peer is connected and alive but its tab has not
  // reached gameplay (menu / loading / cutscene) — the exact owner-facing
  // symptom that looked like "multiplayer broken".
  function syncInfo() {
    var t = now(), out = { peers: [] };
    if (st.role === 'hub') {
      for (var sid in st.conns) {
        var c = st.conns[sid];
        if (!c.helloed) continue;
        out.peers.push({
          sid: Number(sid), name: c.name,
          lastStateAgeMs: c.lastStateAt ? t - c.lastStateAt : null,
          lastAnyAgeMs: t - c.lastSeen,
          hbOnly: !!(c.lastHbAt && (!c.lastStateAt || c.lastHbAt > c.lastStateAt)),
          // M2.2 diag (stage C): latest accepted remote state + motion
          lastSeq: c.lastState ? c.lastState.q : null,
          coords: c.lastState ? [+c.lastState.x.toFixed(1), +c.lastState.y.toFixed(1)] : null,
          moving: (function(){
            if (!c.lastState || !c.prevState) return false;
            if (t - c.lastState.t > 3000) return false;
            var dx = c.lastState.x - c.prevState.x, dy = c.lastState.y - c.prevState.y;
            return (dx * dx + dy * dy) > 0.0025;
          })()
        });
      }
    } else if (st.role === 'guest') {
      out.hub = {
        lastStateAgeMs: st.lastHubStateAt ? t - st.lastHubStateAt : null,
        lastHbAgeMs: st.lastHubHbAt ? t - st.lastHubHbAt : null,
        hbOnly: !!(st.lastHubHbAt && (!st.lastHubStateAt || st.lastHubHbAt > st.lastHubStateAt)),
        // M2.2 diag (stage C)
        lastSeq: st.hubLastState ? st.hubLastState.q : null,
        coords: st.hubLastState ? [+st.hubLastState.x.toFixed(1), +st.hubLastState.y.toFixed(1)] : null,
        moving: (function(){
          if (!st.hubLastState || !st.hubPrevState) return false;
          if (t - st.hubLastState.t > 3000) return false;
          var dx = st.hubLastState.x - st.hubPrevState.x, dy = st.hubLastState.y - st.hubPrevState.y;
          return (dx * dx + dy * dy) > 0.0025;
        })()
      };
    }
    return out;
  }

  function stats() {
    return {
      state: st.state, role: st.role, room: st.room,
      sid: st.mySid, color: st.myColor, name: st.myName,
      peers: st.roster.length || hubCount(),
      ghosts: Object.keys(st.ghosts).length,
      counters: st.counters, lastErr: st.lastErr, lastReject: lastReject,
      lastIce: st.lastIce || null, lastPeerErr: st.lastPeerErr || null,   // M2.3 stage-E
      sync: syncInfo(),
      lastSentStateAgeMs: st.lastSentStateAt ? now() - st.lastSentStateAt : null,
      lastSentSeq: st.lastSentSeq != null ? st.lastSentSeq : null,   // M2.2 diag (stage B)
      sendSrc: st.lastSendSrc || null                                // M2.2 diag: live|stored
    };
  }

  return {
    join: join, leave: leave, stats: stats,
    ghostList: function() { return st.ghosts; },
    SCHEMA: SCHEMA,
    lastReject: function(){ return lastReject; }
  };
})();
