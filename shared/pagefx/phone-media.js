// DuoDesk — PageFX: the phone and media pages. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Each page's quiet identity on top of shared/pagefx/core.js (header strip, accent, switch-in, state).
// Minimal, monochrome, typographic (see the MINIMAL art direction): a large light number or status,
// a mono caption, one small motif, the page accent on one element only.
//   messages  "inbox lane"    unread count · a hairline phone ⇄ desk lane with one bubble dot · newest snippet
//   calls     "handset"       a hairline handset ring (one ring when it rings) · status + timer · a 7-day dot strip
//   media     "contact sheet" the phone's newest thumbnails, quiet and slow · item count · newest time
//   audio     "two lanes"     receive / send lanes of thin bars, gated on the real flags · the phone's disc
//   camera    "viewfinder"    a six-blade iris that opens with the camera · frame brackets that turn · fps · REC
// Data only from state (UI.api.onState via PageFX) and the phone's answers (UI.hubOn, a second handler after
// the page's own). Never removes, reorders or re-parents page nodes; only adds classes / custom properties.
// CSP (style-src 'self'): no style attributes, no innerHTML: PageFX helpers and the CSSOM only.
// Loads after core.js (windows / linux app.html, mac control.html); every state access is guarded.
'use strict';

(() => {
  const P = window.PageFX;
  if (!P) return;
  const UI = window.UI || {};
  const G = P.get;

  const safe = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const hubOn = (t, fn) => {
    if (typeof UI.hubOn !== 'function') return;
    UI.hubOn(t, (m) => { try { fn(m || {}); } catch (e) { console.error('pagefx phone-media ' + t + ':', e); } });
  };
  const ready = (s, w) => safe(() => !!UI.hubReady(s, w), false);
  const onBle = (s) => safe(() => !!UI.onBle(s), false);
  const phoneName = (s) => safe(() => (s && s.hub && s.hub.name) || (G.phone(s) || {}).name || UI.phoneName(s), '') || 'your phone';
  const clock = (ts) => (ts ? safe(() => UI.clock(ts), '') : '');
  const duration = (sec) => safe(() => UI.duration(sec), '0:00');
  const names = (s) => {
    const p = safe(() => UI.peer(s), null) || {};
    return { name: p.name || G.peerName(s) || 'the other device', me: p.me || G.myName(s) || 'this computer' };
  };
  const initial = (n) => { const t = String(n || '').trim(); return /^[+\d]/.test(t) || !t ? '#' : t.charAt(0).toUpperCase(); };
  const glyph = (d, cls) => P.svgRoot('0 0 24 24', 'pg-ico' + (cls ? ' ' + cls : ''), [P.svg('path', { d })]);
  const deskIcon = () => P.icon(G.platform === 'mac' ? 'laptop' : 'desktop');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const join = (parts) => parts.filter(Boolean).join('  ·  ');

  const HANDSET = 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z';
  const MIC_OFF = 'M9 9V5a3 3 0 0 1 5.8-1M15 9.5V11a3 3 0 0 1-4.6 2.5M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.5 2.6M12 18v3M4 4l16 16';
  const SPK_OFF = 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5';
  const TRAY = 'M4 13.5l2.4-7A1.5 1.5 0 0 1 7.8 5.5h8.4a1.5 1.5 0 0 1 1.4 1l2.4 7v4A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5zM4 13.5h4.5l1.5 2h4l1.5-2H20';

  // A hub page (Messages, Calls, Photos): off | nopeer | perm | wait | ready.
  function hubState(s, what) {
    const h = (s && s.hub) || {};
    if (!h[what]) return 'off';
    if (!h.connected) return 'nopeer';
    if (ready(s, what)) return 'ready';
    const p = h.perm && h.perm[what];
    if (p && ['ask', 'partial', 'none'].includes(p.perm)) return 'perm';
    return 'wait';
  }
  const STATE_CAP = {
    off: () => 'Off',
    nopeer: (ph) => 'Connect ' + ph,
    perm: (ph) => 'Waiting for permission on ' + ph,
    wait: (ph) => 'Waiting for ' + ph + '…',
  };
  // The strip every page here starts from: .pg-hdr.pm-hdr.pm-<id>[data-st] inside .page-body (hides with it).
  const hero = (ctx, id) => ctx.hdr({ cls: 'pm-hdr pm-' + id + ' pg-hero--' + id });
  // A lead block: the large light number / status and its mono caption.
  const lead = (ctx, big, cap, cls) => ctx.el('div', 'pm-lead' + (cls ? ' ' + cls : ''), [big, cap]);

  // The selected device changed: data loaded for the previous phone goes.
  const onDevice = (fn) => window.addEventListener('twindesk-device', () => { try { fn(); } catch (e) { console.error('pagefx phone-media device:', e); } });

  // ======================================================================
  // Messages — "inbox lane"
  // ======================================================================
  (() => {
    const APPS = [
      ['whatsapp', /^com\.whatsapp/], ['telegram', /^(?:org\.telegram|org\.thunderdog\.challegram)/], ['instagram', /^com\.instagram/],
      ['messenger', /^com\.facebook\.orca$/], ['signal', /^org\.thoughtcrime\.securesms$/], ['rcs', /^com\.(?:google\.android\.apps\.messaging|samsung\.android\.messaging)$/],
    ];
    const APP_NAME = { whatsapp: 'WhatsApp', telegram: 'Telegram', instagram: 'Instagram', messenger: 'Messenger', signal: 'Signal', rcs: 'RCS' };
    const CHAT = ['all', 'texts', 'whatsapp', 'instagram', 'telegram', 'messenger', 'signal'];
    const appOf = (pkg) => { for (const [id, re] of APPS) if (re.test(String(pkg || ''))) return id; return ''; };

    let C = null;
    let H = null;
    let threads = null; // [{id, name, addrs, snippet, at, unread}] from sms.threads
    let newAt = 0;
    let lastDot = null;
    let st = 'off';

    // One bubble dot glides along the lane: in = phone → desk, out = desk → phone.
    function fly(dir, ambient) {
      if (!H || !C || !C.active() || C.reduced || C.paused()) return null;
      const w = H.track.clientWidth;
      if (w < 40) return null;
      if (ambient && H.track.querySelector('.pm-fly')) return null; // one at a time when it's only ambience
      const dot = C.el('i', 'pm-fly ' + dir + (ambient ? ' ambient' : ''));
      C.css(dot, '--run', Math.round(w - 8) + 'px');
      H.track.append(dot);
      const done = () => { dot.remove(); if (lastDot === dot) lastDot = null; };
      dot.addEventListener('animationend', (e) => { if (e.target === dot) done(); });
      setTimeout(done, 7000);
      lastDot = dot;
      return dot;
    }

    function domThreads() {
      const rows = H && H.texts ? H.texts.querySelectorAll('.hub-threads > .hub-thread') : [];
      return [...rows].map((b) => ({
        name: safe(() => b.querySelector('.hub-thread-name').textContent, ''),
        snippet: safe(() => b.querySelector('.hub-thread-snippet').textContent, ''),
        unread: b.classList.contains('unread'), at: 0,
      }));
    }

    function snippet(t, typing) {
      if (!H) return;
      const name = t ? t.name || (t.addrs || []).join(', ') || 'Unknown' : '';
      const body = t ? t.snippet || '' : '';
      const set = () => {
        C.text(H.snName, name || 'No conversations yet');
        C.text(H.snText, t ? body || '…' : '');
        C.cls(H.snip, 'typing', false);
      };
      if (typing && !C.reduced) {
        C.cls(H.snip, 'typing', true);
        C.after(260, set);
      } else set();
    }

    function paintThreads(s) {
      const list = (threads || domThreads()).filter(Boolean);
      const sorted = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      const newest = sorted[0] || null;
      if (C.changed('snip', newest ? [newest.name, newest.snippet, newest.at] : null)) snippet(newest, false);
      const unread = list.filter((t) => t.unread).length;
      if (st === 'ready') C.count(H.num, unread, { ms: 420 });
      else { H.num._pgVal = null; C.text(H.num, '–'); }
      C.cls(H.hdr, 'has-unread', st === 'ready' && unread > 0);
      C.text(H.cap, 'Unread · ' + phoneName(s));
      C.text(H.when, newest && newest.at ? clock(newest.at) : '');
    }

    function paintSources(s) {
      const on = !!(s && s.ui && s.ui.chats);
      const missing = safe(() => s.hub.perm.messages.missing, []) || [];
      const ro = st === 'ready' && missing.includes('send');
      let parts = [];
      if (on) {
        const n = {};
        for (const c of Array.isArray(s.chats) ? s.chats : []) { const a = appOf(c && c.app); if (a) n[a] = (n[a] || 0) + 1; }
        for (const h of safe(() => s.notifs.history, []) || []) { const a = appOf(h && h.app); if (a) n[a] = (n[a] || 0) + 1; }
        const list = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 3);
        parts = list.length ? list.map(([a, k]) => (APP_NAME[a] || a) + ' ' + k) : ['Chat apps on'];
      }
      if (ro) parts.unshift('Read-only');
      C.text(H.meta, join(parts));
    }

    P.register('messages', {
      mount(page, ctx) {
        C = ctx;
        const hdr = hero(ctx, 'messages');
        const num = ctx.el('span', 'pm-big pg-num', '–');
        const cap = ctx.el('span', 'pm-k', 'Unread');
        const track = ctx.el('div', 'pm-track', [ctx.el('span', 'pm-line')]);
        const lane = ctx.el('div', 'pm-motif pm-lane', [
          ctx.el('span', 'pm-node ph', [P.icon('phone')]),
          track,
          ctx.el('span', 'pm-node desk', [deskIcon()]),
        ]);
        const snName = ctx.el('b', 'pm-sn-name');
        const when = ctx.el('span', 'pm-sn-when pg-mono');
        const snText = ctx.el('span', 'pm-sn-text');
        const dots = ctx.el('span', 'pm-typing', [ctx.el('i'), ctx.el('i'), ctx.el('i')]);
        const snip = ctx.el('div', 'pm-snip', [ctx.el('div', 'pm-sn-top', [snName, when]), snText, dots]);
        const meta = ctx.el('span', 'pm-k pm-meta');
        const say = ctx.el('span', 'pm-say');
        const side = ctx.el('div', 'pm-side', [snip, say, meta]);
        hdr.append(lead(ctx, num, cap), lane, side);
        // the two inboxes (texts first in DOM order) and the pills, tagged once: these nodes persist
        const [texts, chats] = page.querySelectorAll(':scope > .page-body > .hub-msgs');
        if (texts) texts.classList.add('pg-texts');
        if (chats) chats.classList.add('pg-chats');
        page.querySelectorAll('.msg-pill').forEach((b, i) => { if (CHAT[i]) b.dataset.app = CHAT[i]; });
        H = { hdr, num, cap, track, snip, snName, snText, when, meta, say, texts, chats };
        onDevice(() => { threads = null; ctx.forget(); });
        // ambience: one bubble every 7 s (only while this page shows, the window is up and not paused)
        ctx.every(7000, () => { if (st === 'ready') fly(Math.random() < 0.6 ? 'in' : 'out', true); });
      },
      enter(page, ctx) {
        ctx.forget();
        ctx.after(900, () => { if (st === 'ready') fly('in', true); });
      },
      leave() {
        if (H) H.track.querySelectorAll('.pm-fly').forEach((n) => n.remove());
      },
      update(s, page, ctx) {
        st = hubState(s, 'messages');
        ctx.attr(H.hdr, 'data-st', st);
        ctx.text(H.say, STATE_CAP[st] ? STATE_CAP[st](phoneName(s)) : '');
        paintThreads(s);
        paintSources(s);
      },
    });

    hubOn('sms.threads', (m) => {
      threads = (Array.isArray(m.items) ? m.items : []).filter((t) => t && t.id);
      if (!C || !C.active() || !H) return;
      paintThreads(C.s());
      // the page re-rendered its list first: a new message's thread is on top now
      if (Date.now() - newAt < 5000 && H.texts) {
        const first = H.texts.querySelector('.hub-threads > .hub-thread:first-child');
        if (first) C.pop(first, 'pg-fresh', 1000);
      }
    });
    hubOn('sms.new', (m) => {
      newAt = Date.now();
      const msg = m.msg || {};
      if (!C || !C.active() || !H) return;
      fly(msg.out ? 'out' : 'in', false);
      const t = (threads || []).find((x) => x.id === m.thread);
      snippet({ name: (t && t.name) || msg.fromName || msg.from || (t && (t.addrs || []).join(', ')) || '', snippet: (msg.out ? 'You: ' : '') + (msg.body || (msg.parts ? 'Picture' : '')) }, true);
      C.text(H.when, clock(msg.at || Date.now()));
      C.forget('snip');
      // the open thread got it: its last bubble rises in (the page rendered it before this runs)
      const last = H.texts && H.texts.querySelector('.hub-bubbles > .hub-bubble:last-child');
      const body = String(msg.body || '').trim();
      if (last && body && (last.textContent || '').includes(body)) C.pop(last, 'pg-new', 700);
    });
    hubOn('sms.sent', (m) => {
      if (m.ok !== false || !C || !C.active() || !H) return;
      const dot = lastDot && lastDot.isConnected ? lastDot : fly('out', false);
      if (dot) dot.classList.add('bad');
      C.pop(H.snip, 'pm-shake', 500);
    });
  })();

  // ======================================================================
  // Calls — "handset"
  // ======================================================================
  (() => {
    let C = null;
    let H = null;
    let log = null; // call.log items
    let tick = null; // stop fn of the live timer
    let endT = null;

    function paintWeek() {
      if (!H) return;
      const days = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (let i = 6; i >= 0; i--) days.push(new Date(today.getTime() - i * 86400000));
      const by = new Map(days.map((d) => [d.toDateString(), []]));
      for (const c of log || []) {
        const k = new Date(c && c.at).toDateString();
        if (by.has(k)) by.get(k).push(c);
      }
      const key = days.map((d) => by.get(d.toDateString()).map((c) => c.type).join(','));
      if (C.changed('week', [key, !!log])) {
        H.week.replaceChildren(...days.map((d, i) => {
          const calls = by.get(d.toDateString());
          const dots = calls.slice(0, 5).map((c, j) => {
            const kind = c.type === 'missed' || c.type === 'rejected' ? 'miss' : 'ok';
            const dot = C.el('i', 'pm-cd ' + kind);
            C.css(dot, '--j', j);
            return dot;
          });
          const col = C.el('div', 'pm-day' + (i === 6 ? ' today' : ''), [
            C.el('div', 'pm-cds', dots),
            C.el('span', 'pm-dl', safe(() => d.toLocaleDateString([], { weekday: 'narrow' }), '')),
          ]);
          C.css(col, '--i', i);
          return col;
        }));
      }
      const week = (log || []).filter((c) => by.has(new Date(c && c.at).toDateString()));
      const missedToday = (by.get(today.toDateString()) || []).filter((c) => c.type === 'missed').length;
      C.text(H.weekCap, log ? join([week.length + ' this week', missedToday ? missedToday + ' missed today' : '']) : 'This week');
      C.cls(H.week, 'empty', !log || !log.length);
    }

    function startTick() {
      const run = () => {
        const cur = safe(() => C.s().hub.call, null);
        if (!cur || cur.state === 'ringing' || !cur.since) return;
        C.text(H.big, duration((Date.now() - cur.since) / 1000));
      };
      run();
      if (!tick) tick = C.every(1000, run, { paused: true });
    }
    function stopTick() { if (tick) { tick(); tick = null; } }

    P.register('calls', {
      mount(page, ctx) {
        C = ctx;
        const hdr = hero(ctx, 'calls');
        const ring = ctx.el('i', 'pm-sring');
        const hand = ctx.el('span', 'pm-hand', [glyph(HANDSET)]);
        const av = ctx.el('span', 'pm-sav');
        const mic = ctx.el('span', 'pm-mic', [glyph(MIC_OFF)]);
        const sonar = ctx.el('div', 'pm-motif pm-sonar', [ring, ctx.el('span', 'pm-core', [hand, av]), mic]);
        const big = ctx.el('span', 'pm-big pm-ctitle');
        const cap = ctx.el('span', 'pm-k pm-ccap');
        const line = ctx.el('span', 'pm-cline');
        const info = ctx.el('div', 'pm-lead pm-cinfo', [big, cap, line]);
        const mkWave = (cls) => ctx.svg('path', { class: 'pm-wv ' + cls, pathLength: '1', d: (() => { let d = 'M0 16'; for (let x = 0; x < 400; x += 20) d += ' Q' + (x + 10) + ' ' + (x % 40 ? 24 : 8) + ' ' + (x + 20) + ' 16'; return d; })() });
        const wave = ctx.svgRoot('0 0 200 32', 'pm-wave', [ctx.svg('g', { class: 'pm-wv-g' }, [mkWave('a')]), ctx.svg('path', { class: 'pm-flat', d: 'M0 16H200' })], { preserveAspectRatio: 'none' });
        const week = ctx.el('div', 'pm-week');
        const weekCap = ctx.el('span', 'pm-k pm-wcap');
        const right = ctx.el('div', 'pm-side pm-wk', [week, wave, weekCap]);
        hdr.append(sonar, info, right);
        // the Now card (built once): a hairline while it rings / talks
        const callRow = page.querySelector('.hub-call');
        const now = callRow && (callRow.closest('.card-wrap') || callRow.closest('.card'));
        if (now) now.classList.add('pg-now');
        H = { hdr, sonar, av, big, cap, line, week, weekCap, wave, now };
        onDevice(() => { log = null; ctx.forget(); });
      },
      enter(page, ctx) { ctx.forget(); stopTick(); },
      leave() { stopTick(); },
      update(s, page, ctx) {
        const h = (s && s.hub) || {};
        const base = hubState(s, 'calls');
        const ph = phoneName(s);
        const c = h.connected ? h.call : null;
        const e = h.ended;
        const endedRecent = !c && e && e.at && Date.now() - e.at < 6000;
        let st = base === 'ready' ? 'idle' : base;
        if (c) st = c.state === 'ringing' ? 'ringing' : 'offhook';
        else if (endedRecent && base !== 'off') st = e.missed ? 'missed' : 'ended';
        ctx.attr(H.hdr, 'data-st', st);
        ctx.cls(H.hdr, 'pm-ringing', st === 'ringing');
        ctx.cls(H.hdr, 'pg-live', st === 'offhook');
        ctx.cls(H.hdr, 'pg-muted', st === 'offhook' && !!h.muted);
        ctx.cls(H.hdr, 'pg-ended', st === 'ended');
        ctx.cls(H.hdr, 'pg-missed', st === 'missed');
        if (H.now) { ctx.cls(H.now, 'pg-ringing', st === 'ringing'); ctx.cls(H.now, 'pg-live', st === 'offhook'); }

        // the centre of the ring: the caller while ringing / talking, the handset otherwise
        const who = c ? c.name || c.number || 'Unknown number' : '';
        if (ctx.changed('av', c ? [who, c.photo || ''] : null)) {
          let a = null;
          if (c) { a = safe(() => UI.avatar(who, c.photo), null) || ctx.el('span', 'hub-avatar', initial(who)); a.classList.add('pm-face'); }
          H.av.replaceChildren(...(a ? [a] : []));
        }
        ctx.cls(H.sonar, 'face', !!c);

        const last = (log || [])[0];
        const lastLine = last ? 'Last · ' + (last.name || last.number || 'Unknown') + ' · ' + clock(last.at) : '';
        const a = h.audio;
        const bt = !!(h.connected && a && a.state === 'ready');
        if (st === 'ringing') {
          stopTick();
          ctx.text(H.big, who);
          ctx.text(H.cap, 'Calling · ' + ph);
          ctx.text(H.line, c.name && c.number ? c.number : 'Answer or decline below');
        } else if (st === 'offhook') {
          ctx.text(H.cap, join([c.dir === 'out' ? 'Outgoing' : 'On call', who]));
          ctx.text(H.line, h.muted ? 'Muted' : bt ? (a.here ? 'Sound on this computer' : 'Sound on ' + ph) : '');
          startTick();
        } else {
          stopTick();
          if (st === 'ended' || st === 'missed') {
            const dsec = e.since ? (e.at - e.since) / 1000 : null;
            ctx.text(H.big, st === 'missed' ? 'Missed' : dsec != null ? duration(dsec) : 'Ended');
            ctx.text(H.cap, st === 'missed' ? join([e.name || e.number || 'Unknown', clock(e.at)]) : 'Call ended');
            ctx.text(H.line, lastLine);
            if (endT) endT();
            endT = ctx.after(Math.max(200, 6000 - (Date.now() - e.at)), () => { endT = null; ctx.refresh(); });
          } else if (st === 'idle') {
            ctx.text(H.big, 'Ready');
            ctx.text(H.cap, 'Calls ring here · ' + ph);
            ctx.text(H.line, lastLine || 'No recent calls');
          } else {
            ctx.text(H.big, st === 'off' ? 'Off' : st === 'nopeer' ? 'No phone' : 'Waiting');
            ctx.text(H.cap, STATE_CAP[st](ph));
            ctx.text(H.line, st === 'off' ? 'Turn on Calls at the top' : lastLine);
          }
        }
        paintWeek();
      },
    });

    hubOn('call.log', (m) => {
      log = (Array.isArray(m.items) ? m.items : []).filter(Boolean);
      if (C && C.active()) C.refresh();
    });
  })();

  // ======================================================================
  // Photos — "contact sheet"
  // ======================================================================
  (() => {
    let C = null;
    let H = null;
    let kind = 'all';
    let items = [];
    let more = false;
    let listed = false;
    const thumbs = new Map(); // id -> data: URL, only for the newest items
    let pend = false;

    const FRAME = 62; // 56 + 6 gap
    const PAN = 12;   // px/s: barely moving

    function frame(it, cls, i) {
      const img = C.el('img', null, null, { alt: '', draggable: 'false' });
      if (it) img.src = thumbs.get(it.id);
      const f = C.el('span', 'pm-frame' + (cls ? ' ' + cls : '') + (it && it.video ? ' video' : ''), [img]);
      C.css(f, '--i', i);
      return f;
    }

    function paintStrip() {
      pend = false;
      if (!H) return;
      const st = H.hdr.dataset.st;
      const shown = items.filter((it) => thumbs.has(it.id)).slice(0, 14);
      const mode = shown.length && st !== 'ble' ? 'pics' : st === 'ready' && listed && !items.length ? 'empty' : 'skel';
      if (!C.changed('strip', [mode, shown.map((x) => x.id)])) return;
      let set = [];
      if (mode === 'pics') {
        set = shown.slice();
        while (set.length < 12) set = set.concat(shown);
        set = set.slice(0, Math.max(12, shown.length));
      }
      const n = mode === 'pics' ? set.length : 12;
      // the newest picture (first frame of the first copy) carries the accent hairline
      const one = (first) => (mode === 'pics' ? set.map((it, i) => frame(it, first && i === 0 && it === items[0] ? 'newest' : null, i)) : Array.from({ length: n }, (_, i) => frame(null, mode === 'skel' ? 'skel' : 'blank', i)));
      H.track.replaceChildren(...one(true), ...one(false));
      C.css(H.track, '--pm-pan-t', ((n * FRAME) / PAN).toFixed(1) + 's');
      C.css(H.track, '--pm-pan-x', -(n * FRAME) + 'px');
      C.attr(H.strip, 'data-mode', mode);
    }
    const schedule = () => {
      if (pend || !C || !C.active()) return;
      pend = true;
      C.after(500, paintStrip);
    };

    P.register('media', {
      mount(page, ctx) {
        C = ctx;
        const hdr = hero(ctx, 'media');
        const track = ctx.el('div', 'pm-ftrack');
        const strip = ctx.el('div', 'pm-motif pm-strip', [track]);
        const big = ctx.el('span', 'pm-big pg-num', '–');
        const cap = ctx.el('span', 'pm-k');
        const meta = ctx.el('span', 'pm-k pm-meta');
        const drops = ctx.el('div', 'pm-drops', [0, 1, 2].map((i) => { const d = ctx.el('i', 'pm-drop'); ctx.css(d, '--i', i); return d; }));
        const tray = ctx.el('span', 'pm-tray', [glyph(TRAY)]);
        const info = ctx.el('div', 'pm-lead pm-minfo', [big, cap, meta]);
        hdr.append(strip, info, drops, tray);
        H = { hdr, track, strip, big, cap, meta, drops };
        // Save: the page writes "Saving N to …" into its status; three frames settle into the tray
        const status = page.querySelector('.hub-media-status');
        let was = false;
        ctx.observe(status, { characterData: true, childList: true, subtree: true }, () => {
          const now = /^Saving/.test(window.DuoDeskI18n ? window.DuoDeskI18n.sourceText(status) : (status.textContent || '').trim());
          if (now && !was && ctx.active()) {
            const pics = [...H.track.querySelectorAll('.pm-frame img[src]')].slice(0, 3);
            [...H.drops.children].forEach((d, i) => { ctx.css(d, 'background-image', pics[i] ? 'url("' + pics[i].getAttribute('src') + '")' : null); });
            ctx.pop(H.hdr, 'pg-saving', 1500);
          }
          was = now;
        });
        onDevice(() => { items = []; thumbs.clear(); listed = false; ctx.forget(); });
      },
      enter(page, ctx) { ctx.forget(); pend = false; },
      update(s, page, ctx) {
        const base = hubState(s, 'media');
        const st = (base === 'ready' || base === 'wait') && onBle(s) ? 'ble' : base;
        ctx.attr(H.hdr, 'data-st', st);
        const ph = phoneName(s);
        const label = kind === 'videos' ? 'Videos' : kind === 'all' ? 'Items' : kind.charAt(0).toUpperCase() + kind.slice(1);
        const has = st === 'ready' && listed;
        if (has) ctx.text(H.big, items.length + (more ? '+' : ''));
        else ctx.text(H.big, st === 'ble' ? 'Wi-Fi only' : st === 'ready' ? '–' : { off: 'Off', nopeer: 'No phone', perm: 'Allow', wait: 'Waiting' }[st] || '–');
        ctx.cls(H.big, 'word', !has);
        const v = items.filter((x) => x.video).length;
        const partial = safe(() => s.hub.perm.media.perm, '') === 'partial';
        if (has) {
          ctx.text(H.cap, join([label, kind === 'all' && v ? v + (more ? '+' : '') + ' videos' : '']));
          ctx.text(H.meta, join([items[0] ? 'Newest ' + clock(items[0].at) : (kind === 'all' ? 'No photos or videos' : 'No ' + kind), partial ? 'Only chosen photos' : '']));
        } else {
          ctx.text(H.cap, st === 'ble' ? 'Photos need Wi-Fi or USB' : st === 'ready' ? 'Loading ' + ph + '…' : STATE_CAP[st] ? STATE_CAP[st](ph) : '');
          ctx.text(H.meta, '');
        }
        paintStrip();
      },
    });

    hubOn('media.list', (m) => {
      const k = m.kind || 'all';
      const fresh = (Array.isArray(m.items) ? m.items : []).filter((x) => x && x.id);
      if (!m.before) { kind = k; items = fresh; listed = true; }
      else if (k === kind) { const have = new Set(items.map((x) => x.id)); items = items.concat(fresh.filter((x) => !have.has(x.id))); }
      else return;
      more = !!m.more;
      // keep thumbnails only for the newest ones
      const keep = new Set(items.slice(0, 60).map((x) => x.id));
      for (const id of [...thumbs.keys()]) if (!keep.has(id)) thumbs.delete(id);
      if (C && C.active()) { C.refresh(); schedule(); }
    });
    hubOn('media.thumb', (m) => {
      if (!m.id || !m.data) return;
      const i = items.findIndex((x) => x.id === m.id);
      if (i < 0 || i >= 60) return;
      thumbs.set(m.id, m.data);
      if (C && C.active()) schedule();
    });
  })();

  // ======================================================================
  // Audio — "two lanes"
  // ======================================================================
  (() => {
    let C = null;
    let H = null;
    const BARS = 18;
    // a fixed calm profile (also the reduced-motion picture of a live lane)
    const LVL = Array.from({ length: BARS }, (_, i) => 0.3 + 0.55 * Math.abs(Math.sin(i * 1.3) * Math.cos(i * 0.45)));

    function lane(ctx, cls) {
      const bars = ctx.el('div', 'pm-bars', LVL.map((l, i) => {
        const b = ctx.el('i');
        ctx.css(b, { '--lvl': l.toFixed(2), '--d': (-((i * 0.29) % 2.2)).toFixed(2) + 's', '--i': i });
        return b;
      }));
      const from = ctx.el('span', 'pm-end peer');
      const mute = ctx.el('span', 'pm-mute', [glyph(SPK_OFF)]);
      const label = ctx.el('span', 'pm-lst');
      const dir = ctx.el('span', 'pm-k pm-ldir', cls === 'rx' ? 'In' : 'Out');
      const el = ctx.el('div', 'pm-alane pg-lane ' + cls, [dir, from, ctx.el('div', 'pm-lt', [bars, ctx.el('span', 'pm-flatline')]), mute, label]);
      return { el, from, label, bars, mute };
    }

    P.register('audio', {
      mount(page, ctx) {
        C = ctx;
        const hdr = hero(ctx, 'audio');
        const rx = lane(ctx, 'rx');
        const tx = lane(ctx, 'tx');
        const disc = ctx.el('div', 'pm-disc pg-disc', [ctx.el('i', 'pm-hole')]);
        const npTitle = ctx.el('span', 'pm-np-t');
        const npArtist = ctx.el('span', 'pm-k pm-np-a');
        const np = ctx.el('div', 'pm-np', [disc, ctx.el('div', 'pm-np-txt', [npTitle, npArtist])]);
        hdr.append(ctx.el('div', 'pm-motif pm-lanes', [rx.el, tx.el]), np);
        // the page's direction cards: receive is the one with the volume slider (first on Windows / Linux,
        // second on the Mac), send the other; the phone card
        const cards = [...page.querySelectorAll(':scope > .page-body .dir-card')];
        const rxCard = cards.find((c) => c.querySelector('.slider input[type=range]')) || cards[0] || null;
        const txCard = cards.find((c) => c !== rxCard) || null;
        const phoneCard = page.querySelector(':scope > .page-body > .card-wrap');
        H = { hdr, rx, tx, np, disc, npTitle, npArtist, rxCard, txCard, phoneCard };
      },
      enter(page, ctx) { ctx.forget(); },
      update(s, page, ctx) {
        const a = (s && s.audio) || {};
        const n = names(s);
        const linkOk = G.linked(s);
        const ble = onBle(s);
        const nopeer = !linkOk && !a.receive && !a.send;
        const b = s && s.btAudio;
        const btPlay = !!(b && b.on && b.state === 'playing');
        const phoneTxt = safe(() => UI.phoneSound && UI.phoneSound(s), null);
        let rx = ble ? 'ble' : !a.receive && !btPlay ? 'off' : a.receiving || btPlay ? 'live' : 'wait';
        let tx = ble ? 'ble' : a.error && a.send ? 'err' : !a.send ? 'off' : a.sending ? 'live' : 'wait';
        if (nopeer && !btPlay) { rx = 'off'; tx = 'off'; }
        ctx.attr(H.rx.el, 'data-st', rx);
        ctx.attr(H.tx.el, 'data-st', tx);
        // one accent: the receive lane when it plays, else the send lane
        ctx.cls(H.rx.el, 'acc', rx === 'live');
        ctx.cls(H.tx.el, 'acc', tx === 'live' && rx !== 'live');
        ctx.attr(H.hdr, 'data-st', nopeer && !btPlay ? 'nopeer' : rx === 'live' || tx === 'live' ? 'live' : 'idle');
        const rxText = {
          off: nopeer ? 'Connect a device' : 'Off',
          ble: 'Wi-Fi only',
          live: btPlay && !a.receiving ? 'Playing over Bluetooth' : 'From ' + n.name,
          wait: phoneTxt && G.isPhone(s) ? (/^Tap|^Asking/.test(phoneTxt) ? phoneTxt.replace(/ \(.*$/, '') : 'Waiting for ' + n.name) : linkOk ? 'Turned off on ' + n.name : 'Waiting for ' + n.name,
        }[rx];
        const txText = {
          off: nopeer ? '' : 'Off',
          ble: 'Wi-Fi only',
          err: a.error || 'Error',
          live: 'To ' + n.name,
          wait: !linkOk ? 'Waiting for ' + n.name : a.macAccepts === false ? 'Turned off on ' + n.name : 'Connecting…',
        }[tx];
        ctx.text(H.rx.label, rxText);
        ctx.text(H.tx.label, txText);
        const os = G.peerOs(s) || 'mac';
        if (ctx.changed('os', os)) for (const L of [H.rx, H.tx]) L.from.replaceChildren(P.osIcon(os));
        ctx.cls(H.tx.mute, 'on', !!(a.send && a.muteLocal));
        ctx.css(H.hdr, '--pg-vol', clamp(num(a.volume) == null ? 1 : a.volume, 0.15, 1).toFixed(2));
        // the phone's now playing: its art on a small disc that turns while it plays
        const now = s && s.phoneMedia && s.phoneMedia.now;
        const show = !!(now && (now.title || now.artist));
        ctx.cls(H.np, 'on', show);
        ctx.cls(H.hdr, 'has-np', show);
        if (show) {
          ctx.text(H.npTitle, now.title || '');
          ctx.text(H.npArtist, now.artist || now.app || '');
          ctx.cls(H.disc, 'pm-turning', !!now.playing);
          const art = typeof now.art === 'string' && /^(data:image\/|blob:|https?:|file:)/.test(now.art) ? now.art : '';
          if (ctx.changed('art', art)) ctx.css(H.disc, 'background-image', art ? 'url("' + art.replace(/"/g, '%22') + '")' : null);
          ctx.cls(H.disc, 'art', !!art);
        }
        // the page's cards
        ctx.cls(H.rxCard, 'pg-live', !!a.receiving && !ble);
        ctx.cls(H.txCard, 'pg-live', !!a.sending && !ble);
        if (H.phoneCard) ctx.cls(H.phoneCard, 'pg-bt-on', !!(b && b.on));
      },
    });
  })();

  // ======================================================================
  // Camera — "viewfinder"
  // ======================================================================
  (() => {
    let C = null;
    let H = null;
    let iris = 0;
    let irisStop = null;
    let irisTo = -1;
    let frames = 0;
    let fps = null;
    let rot = 0; // 0 landscape .. 1 portrait (shown)
    let rotStop = null;
    let rotTo = -1;
    const BLADES = 6;

    const phoneCam = (s) => (safe(() => s.phone.bridge.windows, []) || []).find((w) => w && w.kind === 'camera') || null;
    // Multi-device (state.camera.mesh): a computer's camera running here while another device is
    // selected is the page's (shared/ui-camera.js).
    const other = (s) => { const c = (s && s.camera) || {}; const sel = s && (s.peerSession || s.client || s.session); return !!(c.mesh && c.viewing && c.peerId && !(sel && sel.id === c.peerId)); }; // the selected device (Linux: peerSession, the Mac: client)
    const isPhone = (s) => G.isPhone(s) && !other(s);
    const running = (s) => (isPhone(s) ? !!phoneCam(s) : !!(s && s.camera && s.camera.viewing));

    // An aperture: six blades tiling the ring between a hexagonal hole (radius by k) and the rim.
    function bladeD(k, i) {
      const cx = 40, cy = 40, R = 35;
      const r = 2.5 + k * 25;
      const tw = (1 - k) * 0.85;
      const a0 = (i * Math.PI) / 3 + tw, a1 = a0 + Math.PI / 3, sw = 1.15;
      const p = (rr, a) => (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
      return 'M' + p(r, a0) + 'L' + p(r, a1) + 'L' + p(R, a1 + sw) + 'A' + R + ' ' + R + ' 0 0 0 ' + p(R, a0 + sw) + 'Z';
    }
    function setIris(k) {
      iris = k;
      H.blades.forEach((b, i) => b.setAttribute('d', bladeD(k, i)));
      C.css(H.hdr, '--pg-iris', k.toFixed(3));
    }
    function goIris(to) {
      if (to === irisTo) return;
      irisTo = to;
      if (irisStop) irisStop();
      irisStop = C.tween(iris, to, 900, (v) => setIris(v), { ease: 'inOut' });
    }
    // The frame: 16:9 landscape (rot 0) .. portrait (rot 1), corner brackets, an "up" mark on the picture's top side.
    function setFrame(k, deg) {
      const W = 96 + (52 - 96) * k, Hh = 54 + (80 - 54) * k;
      const x = 60 - W / 2, y = 48 - Hh / 2, L = 10;
      const corners = [
        'M' + x + ' ' + (y + L) + 'V' + y + 'H' + (x + L),
        'M' + (x + W - L) + ' ' + y + 'H' + (x + W) + 'V' + (y + L),
        'M' + (x + W) + ' ' + (y + Hh - L) + 'V' + (y + Hh) + 'H' + (x + W - L),
        'M' + (x + L) + ' ' + (y + Hh) + 'H' + x + 'V' + (y + Hh - L),
      ];
      H.brackets.setAttribute('d', corners.join(''));
      H.pane.setAttribute('x', x + 4); H.pane.setAttribute('y', y + 4);
      H.pane.setAttribute('width', Math.max(0, W - 8)); H.pane.setAttribute('height', Math.max(0, Hh - 8));
      const side = ((Math.round((deg || 0) / 90) % 4) + 4) % 4; // which side is the picture's top
      const [mx, my, dx, dy] = [[60, y - 5, 0, -1], [x + W + 5, 48, 1, 0], [60, y + Hh + 5, 0, 1], [x - 5, 48, -1, 0]][side];
      const px = -dy, py = dx;
      H.up.setAttribute('d', 'M' + (mx + dx * 3) + ' ' + (my + dy * 3) + 'L' + (mx + px * 3) + ' ' + (my + py * 3) + 'L' + (mx - px * 3) + ' ' + (my - py * 3) + 'Z');
    }
    function goRot(deg) {
      const k = Math.abs(((Math.round((deg || 0) / 90) % 2) + 2) % 2);
      const moved = C.changed('deg', deg);
      if (k !== rotTo) {
        rotTo = k;
        if (rotStop) rotStop();
        rotStop = C.tween(rot, k, 500, (v) => { rot = v; setFrame(v, deg); }, { ease: 'inOut' });
      } else if (moved) setFrame(rot, deg);
    }

    P.register('camera', {
      mount(page, ctx) {
        C = ctx;
        const hdr = hero(ctx, 'camera');
        const blades = Array.from({ length: BLADES }, () => ctx.svg('path', { class: 'pm-blade' }));
        const irisSvg = ctx.svgRoot('0 0 80 80', 'pm-motif pm-iris', [
          ctx.svg('circle', { class: 'pm-iris-hole', cx: 40, cy: 40, r: 34 }),
          ctx.svg('g', { class: 'pm-blades' }, blades),
          ctx.svg('circle', { class: 'pm-iris-rim', cx: 40, cy: 40, r: 36 }),
          ctx.svg('circle', { class: 'pm-focus', cx: 40, cy: 40, r: 39.5, pathLength: '100' }),
        ]);
        const brackets = ctx.svg('path', { class: 'pm-brk' });
        const pane = ctx.svg('rect', { class: 'pm-pane', rx: 2 });
        const up = ctx.svg('path', { class: 'pm-up' });
        const cross = ctx.svg('path', { class: 'pm-cross', d: 'M56 48H64M60 44V52' });
        const vf = ctx.svgRoot('0 0 120 96', 'pm-vf', [pane, ctx.svg('g', { class: 'pm-brk-g' }, [brackets]), cross, up]);
        const big = ctx.el('span', 'pm-big pm-ctitle');
        const cap = ctx.el('span', 'pm-k pm-csaid');
        const live = ctx.el('span', 'pm-k pm-live', [ctx.el('i', 'pm-live-dot'), ctx.el('span')]);
        const meta = ctx.el('span', 'pm-k pm-meta');
        const line = ctx.el('span', 'pm-cline');
        const rec = ctx.el('div', 'pm-rec pg-rec', [ctx.el('i'), ctx.el('b', null, 'REC'), ctx.el('span')]);
        hdr.append(irisSvg, vf, ctx.el('div', 'pm-lead pm-cinfo', [big, cap, line, ctx.el('div', 'pm-crow', [live, meta])]), rec);
        // the page's cards, by build order: picture, virtual camera, this computer's camera
        const wraps = page.querySelectorAll(':scope > .page-body > .card-wrap');
        const box = wraps[0] && wraps[0].querySelector(':scope > .card > div[title]');
        if (box) { box.classList.add('pg-cam-box'); if (box.lastElementChild) box.lastElementChild.classList.add('pg-cam-said'); }
        if (wraps[1]) wraps[1].classList.add('pg-vcam');
        if (wraps[2]) wraps[2].classList.add('pg-own');
        H = { hdr, blades, brackets, pane, up, big, cap, line, live, meta, rec, box, said: box && box.lastElementChild, vcam: wraps[1], own: wraps[2] };
        setIris(0);
        setFrame(0, 0);
        // the frame rate: a second listener that only counts (the page owns the pictures)
        safe(() => UI.api && typeof UI.api.onCamPreview === 'function' && UI.api.onCamPreview(() => { frames++; }));
        ctx.every(1000, () => {
          fps = frames; frames = 0;
          if (H.hdr.dataset.st === 'live') ctx.text(H.live.lastElementChild, fps ? 'Live · ' + fps + ' fps' : 'Live');
        }, { paused: true });
      },
      enter(page, ctx) {
        ctx.forget();
        irisTo = -1; rotTo = -1;
        setIris(0); // the switch-in: the blades open from closed to the state
        frames = 0; fps = null;
      },
      update(s, page, ctx) {
        const c = (s && s.camera) || {};
        const v = (s && s.vcam) || {};
        const phone = isPhone(s);
        const w = phone ? phoneCam(s) : null;
        const on = running(s);
        const n = names(s);
        const who = other(s) ? c.peerName : n.name; // whose camera the page is about
        const err = on && ((phone && w && w.error) || (!phone && ['failed', 'refused'].includes(c.viewStatus)));
        let st = !c.on ? 'off' : !G.linked(s) ? 'nopeer' : err ? 'err' : on && !v.picture ? 'starting' : on ? 'live' : 'idle';
        if (on && !phone && c.viewStatus === 'ended') st = 'idle';
        ctx.attr(H.hdr, 'data-st', st);
        goIris({ off: 0, nopeer: 0, idle: 0.12, starting: 0.42, live: 1, err: 0.26 }[st]);
        goRot(num(v.rotate) || 0);
        // the page's own words about the picture (its overlay), else ours
        const overlay = H.said && !H.said.hidden ? (H.said.textContent || '').trim() : '';
        ctx.text(H.big, { off: 'Off', nopeer: 'No device', idle: overlay ? 'Waiting' : 'Ready', starting: 'Starting', live: 'Live', err: 'Stopped' }[st]);
        ctx.text(H.cap, st === 'nopeer' ? 'Connect a device to use its camera' : who + '’s camera');
        const isLive = on && !!v.picture && st === 'live';
        ctx.cls(H.live, 'on', isLive);
        if (isLive && ctx.changed('livefps', fps == null)) ctx.text(H.live.lastElementChild, fps ? 'Live · ' + fps + ' fps' : 'Live');
        const vs = v.on ? (v.live ? 'Virtual camera live' : v.ready ? 'Virtual camera ready' : '') : '';
        const rotTxt = isLive && num(v.rotate) ? 'Turned ' + num(v.rotate) + '°' : '';
        const face = phone && w ? ((w.facing || 'back') === 'front' ? 'Front' : 'Back') : '';
        const win = on && (phone ? w && w.shown : c.viewShown) ? 'Window open' : '';
        ctx.text(H.line, st !== 'live' ? overlay : '');
        ctx.text(H.meta, join([face, rotTxt, vs, win]));
        // privacy first: this computer's camera running on the other one
        const sending = !!c.sending;
        ctx.cls(H.rec, 'on', sending);
        ctx.cls(H.hdr, 'pg-rec-on', sending);
        if (sending) ctx.text(H.rec.lastElementChild, (c.mesh && c.sendingTo ? c.sendingTo + (c.sendingTo.includes(',') ? ' are' : ' is') : n.name + ' is') + ' viewing ' + n.me + '’s camera');
        // the page's cards
        if (H.box) {
          ctx.cls(H.box, 'pg-live', isLive);
          ctx.cls(H.box, 'pg-starting', st === 'starting');
          ctx.cls(H.box, 'pg-err', st === 'err');
        }
        if (H.vcam) { ctx.cls(H.vcam, 'pg-on', !!v.on); ctx.cls(H.vcam, 'pg-broadcast', !!(v.on && v.live)); }
        if (H.own) ctx.cls(H.own, 'pg-sending', sending);
      },
    });
  })();
})();
