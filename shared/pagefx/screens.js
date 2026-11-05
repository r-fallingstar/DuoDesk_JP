// DuoDesk — PageFX: the screen pages. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Minimal art direction (MINIMAL): each header is a quiet glass strip — one light figure, a mono kicker and
// caption, and ONE hairline motif with the page accent on the one thing that moves. Live data stays, quietly.
//   mac-pc (Mac: receive)  "incoming window": a frame in the remote display's real shape; light arrives from
//                          the other computer (right → left); figure = fps when live, else a short status
//   pc-mac (Mac: share)    "transmitter": this monitor (and Extend's virtual one) on a stand, a line out to
//                          the other computer (left → right, pace from the real bitrate); figure = Mbps
//   apps                   "dock to window": the other computer's dock, one app lifting into a window here;
//                          figures either side: apps there / windows open here
//   mirror                 "phone to desk": a phone outline, a thread to this computer's screen with one
//                          outline per window really open here; figure = windows open
//   papps                  "app drawer orbit": one dot on a hairline ellipse around the app count
// Needs shared/pagefx/core.js (PageFX). CSP: elements via PageFX helpers, styles via CSSOM only.
// SVG geometry uses absolute coordinates, never transform attributes (reduced motion clears transforms).
'use strict';

(() => {
  const FX = window.PageFX;
  if (!FX || FX._screens) return;
  FX._screens = true;
  const UI = window.UI || {};
  const G = FX.get;
  const S = FX.svg;
  const safe = (fn, d) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // The other computer (these pages are never about the phone, even when a phone is the only thing connected).
  const notPhone = (p) => p && p.os !== 'android' ? p : null;
  const pcPeer = (s) => notPhone(s && s.peer) || notPhone(s && s.client) || notPhone(safe(() => G.meshPeer(s), null))
    || (s && Array.isArray(s.paired) ? s.paired[0] : s && s.paired) || null;
  const whoOf = (s) => (s && s.link && s.link.macName) || (pcPeer(s) && (pcPeer(s).name || pcPeer(s).macName)) || 'the other computer';
  const pcOs = (s) => { const p = pcPeer(s); return (p && p.os) || null; };
  // a computer is connected (Windows / Linux s.link, Mac s.client, mesh s.peers)
  const pcLive = (s) => !!(s && ((s.link && s.link.state === 'connected' && !(s.peer && s.peer.os === 'android'))
    || notPhone(s.client) || (Array.isArray(s.peers) && s.peers.some((p) => p && p.os !== 'android' && (p.connected || p.state === 'connected')))));
  const fmt1 = (v) => (v == null ? '–' : v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
  const r1 = (v) => Math.round(v * 10) / 10;
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  // fit an aspect (w:h) into maxW × maxH
  const fit = (w, h, maxW, maxH) => { const a = clamp((w || 16) / (h || 10), 0.4, 3.5); let y = maxH, x = y * a; if (x > maxW) { x = maxW; y = x / a; } return [r1(x), r1(y)]; };

  // ---------- finding the page's own nodes (attributes only, no wrappers) ----------
  const titleOf = (wrap) => {
    const t = wrap && wrap.querySelector(':scope > .card-title > span');
    return t ? String(t.dataset.peer || (window.DuoDeskI18n ? window.DuoDeskI18n.sourceText(t) : t.textContent) || '').trim() : '';
  };
  const wrapsOf = (body) => (body ? [...body.querySelectorAll(':scope > .card-wrap')] : []);
  const cardBy = (body, title) => wrapsOf(body).find((w) => titleOf(w) === title) || null;
  const cardStarts = (body, prefix) => wrapsOf(body).find((w) => titleOf(w).startsWith(prefix)) || null;
  const role = (e, name) => { if (e && !e.hasAttribute('data-pg-role')) e.setAttribute('data-pg-role', name); return e; };
  // The Details card's Status row gets a quiet dot (data-pg-st on the row; never its text).
  function statusDot(ctx, wrap, good, warn) {
    const row = wrap && wrap.querySelector(':scope > .card > .row');
    const v = row && row.querySelector('.value');
    if (!v) return;
    const t = (window.DuoDeskI18n ? window.DuoDeskI18n.sourceText(v) : v.textContent) || '';
    ctx.attr(row, 'data-pg-st', good.test(t) ? 'good' : warn.test(t) ? 'warn' : 'off');
    ctx.attr(row, 'data-pg-status', '');
  }

  // ---------- the shared header pieces ----------
  // A text column: kicker (mono), figure (light numeral + unit, or a short word), caption, meta (mono).
  function textCol(E, cls) {
    const t = {};
    t.kick = E('span', 'pg-kick sx-kick');
    t.n = E('span', 'sx-n');
    t.u = E('small', 'sx-u');
    t.fig = E('span', 'pg-fig sx-fig', [t.n, t.u]);
    t.cap = E('span', 'sx-cap');
    t.meta = E('span', 'pg-kick sx-meta');
    t.el = E('div', 'sx-text ' + (cls || ''), [t.kick, t.fig, t.cap, t.meta]);
    return t;
  }
  // figure: a number (rolls) or a word
  function setFig(ctx, t, value, unit) {
    const isNum = typeof value === 'number' && isFinite(value);
    ctx.attr(t.fig, 'data-word', isNum ? null : '');
    const dec = isNum && !Number.isInteger(value) && Math.abs(value) < 100;
    if (isNum) ctx.count(t.n, dec ? r1(value) : Math.round(value), { ms: 500, digits: dec ? 1 : 0, fmt: (v) => (v == null ? '–' : dec ? v.toFixed(1) : String(Math.round(v))) });
    else { t.n._pgVal = null; ctx.text(t.n, value == null ? '–' : value); }
    ctx.text(t.u, unit || '');
  }
  // A tiny device in hairlines, top-left at (x, y); about 26 × 20.
  function devGlyph(os, x, y) {
    if (os === 'android' || os === 'phone') return [S('rect', { class: 'sx-dev', x: x + 7, y: y - 2, width: 12, height: 22, rx: 3 })];
    if (os === 'mac') return [
      S('rect', { class: 'sx-dev', x: x + 2, y: y + 2, width: 22, height: 14, rx: 2 }),
      S('path', { class: 'sx-dev', d: `M${x - 1} ${y + 18.5}H${x + 27}` }),
    ];
    return [
      S('rect', { class: 'sx-dev', x, y, width: 26, height: 16, rx: 1.5 }),
      S('path', { class: 'sx-dev', d: `M${x + 13} ${y + 16}V${y + 20}M${x + 8} ${y + 20.5}H${x + 18}` }),
    ];
  }
  // A window outline: hairline frame, title hairline, three grey dots.
  function winGlyph(x, y, w, h, cls) {
    const kids = [S('rect', { class: 'sx-win ' + (cls || ''), x, y, width: w, height: h, rx: Math.min(5, h / 4) })];
    if (h >= 16) {
      kids.push(S('path', { class: 'sx-faint', d: `M${x} ${y + 7}H${x + w}` }));
      for (let i = 0; i < 3; i++) kids.push(S('circle', { class: 'sx-dot3', cx: x + 4.5 + i * 3.6, cy: y + 3.6, r: 0.9 }));
    }
    return kids;
  }
  const R = new WeakMap(); // page → refs of its header

  // ======================================================================
  // mac-pc (Mac: receive) — "incoming window"
  // ======================================================================
  function rxModel(s) {
    if (s.stream && typeof s.stream.state === 'string' && s.link) {
      const st = s.stream, r = st.remote || null, mon = s.monitor || {};
      const on = st.state === 'on';
      const x = on && st.stats ? st.stats : null;
      return {
        connected: s.link.state === 'connected', on, sharing: on || !!(r && r.on), canStart: !!(r && r.remote),
        mode: r && r.on ? r.mode || '' : '', watching: !!st.watching, name: st.name || '', stats: x,
        w: num(st.width) || (x && num(x.width)), h: num(st.height) || (x && num(x.height)),
        volume: num(mon.volume), mute: !!mon.mute, framegen: !!mon.framegen, input: s.macInput !== false,
      };
    }
    const r = s.receive;
    if (r && typeof r === 'object') { // Mac: stats carry bufferMs + decodeMs instead of delayMs
      const on = r.status === 'live';
      let x = on && r.stats ? r.stats : null;
      if (x && num(x.delayMs) == null && (num(x.bufferMs) != null || num(x.decodeMs) != null)) {
        x = Object.assign({}, x, { delayMs: Math.round((num(x.bufferMs) || 0) + (num(x.decodeMs) || 0)) });
      }
      const rs = r.remote || null;
      return {
        connected: pcLive(s), on, sharing: on || !!(rs && rs.on), canStart: !!(rs && rs.remote),
        mode: rs && rs.on ? rs.mode || '' : '', watching: !!r.open, name: '', stats: x,
        w: x && num(x.width), h: x && num(x.height), volume: null, mute: false, framegen: !!r.framegen, input: r.input !== false,
      };
    }
    return null;
  }
  const RX = { W: 236, H: 88, peerX: 202, cy: 44, maxW: 150, maxH: 72, fx: 6 };
  const SPARK = { W: 132, H: 18, N: 40 };
  const sparkD = (buf) => {
    let lo = Math.min(...buf), hi = Math.max(...buf);
    if (hi - lo < 6) { const m = (hi + lo) / 2; lo = m - 3; hi = m + 3; }
    const step = SPARK.W / (SPARK.N - 1);
    const pts = buf.map((v, i) => [i * step, 1.5 + (SPARK.H - 3) * (1 - (v - lo) / (hi - lo))]);
    return { d: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), last: pts[pts.length - 1] };
  };

  FX.register(['mac-pc', 'receive'], {
    mount(page, ctx) {
      const body = ctx.body;
      if (!body) return;
      role(wrapsOf(body).find((w) => w.querySelector(':scope > .card.keep-on')), 'main');
      role(cardBy(body, 'Details'), 'details');
      const E = ctx.el;
      const h = ctx.hdr({ cls: 'sx rx' });
      const r = { h, buf: [] };
      r.svg = FX.svgRoot(`0 0 ${RX.W} ${RX.H}`, 'sx-svg rx-svg', [], { width: RX.W, height: RX.H });
      r.ghost = S('rect', { class: 'rx-ghost' });
      r.frame = S('g', { class: 'rx-frame' });
      r.pause = S('g', { class: 'rx-pause' });
      r.line = S('path', { class: 'sx-line rx-line' });
      r.run = S('path', { class: 'sx-run rx-run', pathLength: 100 });
      r.dev = S('g', { class: 'rx-dev' });
      r.svg.append(r.ghost, r.frame, r.pause, r.line, r.run, r.dev);
      r.t = textCol(E, 'rx-text');
      r.spLine = S('path', { class: 'rx-sp' });
      r.spDot = S('circle', { class: 'rx-sp-dot', r: 1.6, cx: -9, cy: -9 });
      r.spark = E('span', 'rx-spark', [FX.svgRoot(`0 0 ${SPARK.W} ${SPARK.H}`, 'rx-sp-svg', [r.spLine, r.spDot], { width: SPARK.W, height: SPARK.H })], { hidden: true });
      r.t.el.append(r.spark);
      h.replaceChildren(E('div', 'sx-motif rx-motif', [r.svg]), r.t.el);
      R.set(page, r);
    },
    update(s, page, ctx) {
      const r = R.get(page);
      const m = rxModel(s);
      if (!r || !m) return;
      const h = r.h, t = r.t;
      const who = whoOf(s);
      const st = !m.connected ? 'nopeer' : m.on ? 'live' : m.sharing ? 'paused' : m.canStart ? 'ready' : 'blocked';
      ctx.attr(h, 'data-st', st);
      ctx.attr(h, 'data-mode', m.mode || null);
      ctx.attr(h, 'data-watch', m.watching ? '1' : '0');
      const x = m.stats;
      // geometry: the frame takes the remote display's real shape; the peer sits at the right
      const os = pcOs(s) || 'win';
      const [fw, fh] = fit(m.w || (x && num(x.width)) || 16, m.h || (x && num(x.height)) || 10, RX.maxW, RX.maxH);
      if (ctx.changed('geo', [fw, fh, os])) {
        const fx = RX.fx, fy = r1(RX.cy - fh / 2);
        r.frame.replaceChildren(...winGlyph(fx, fy, fw, fh, 'rx-win'),
          S('rect', { class: 'sx-fill', x: fx + 8, y: fy + 13, width: r1(fw * 0.42), height: 2.5, rx: 1.25 }),
          S('rect', { class: 'sx-fill', x: fx + 8, y: fy + 19, width: r1(fw * 0.26), height: 2.5, rx: 1.25 }));
        for (const [k, v] of Object.entries({ x: fx + 7, y: fy - 5, width: fw, height: fh, rx: 5 })) r.ghost.setAttribute(k, v);
        r.pause.replaceChildren(
          S('rect', { class: 'rx-pbar', x: fx + fw / 2 - 5, y: RX.cy - 6, width: 3, height: 12, rx: 1 }),
          S('rect', { class: 'rx-pbar', x: fx + fw / 2 + 2, y: RX.cy - 6, width: 3, height: 12, rx: 1 }));
        const d = `M${RX.peerX - 6} ${RX.cy}H${fx + fw + 8}`; // drawn from the peer toward the frame
        r.line.setAttribute('d', d);
        r.run.setAttribute('d', d);
        r.dev.replaceChildren(...devGlyph(os, RX.peerX, RX.cy - 10));
      }
      // text
      const mp = safe(() => G.meshPeer(s), null);
      const rtt = num(G.get(s, 'link.rtt')) ?? num(G.get(s, 'client.rttMs')) ?? num(mp && mp.rtt);
      ctx.text(t.kick, st === 'nopeer' ? 'Receive screen' : 'From ' + who);
      if (st === 'live') setFig(ctx, t, num(x && x.fps) != null ? x.fps : 'Live', num(x && x.fps) != null ? 'fps' : '');
      else setFig(ctx, t, st === 'nopeer' ? 'Waiting' : st === 'paused' ? 'Paused' : st === 'ready' ? 'Ready' : 'Off', '');
      const res = x && num(x.width) ? x.width + ' × ' + x.height : m.w && m.h ? m.w + ' × ' + m.h : '';
      ctx.text(t.cap, st === 'nopeer' ? 'Waiting for ' + who
        : st === 'live' ? [m.mode === 'extend' ? 'Extra screen' : 'Main screen', res, m.watching ? '' : 'window closed'].filter(Boolean).join(' · ')
          : st === 'paused' ? 'Nobody is watching it' : st === 'ready' ? 'Open starts sharing on ' + who : 'Turn on sharing on ' + who);
      ctx.text(t.meta, st === 'live' && x
        ? [x.codec ? String(x.codec).toUpperCase() : '', num(x.mbps) != null ? fmt1(x.mbps) + ' Mbps' : '', num(x.delayMs) != null ? x.delayMs + ' ms delay' : '',
          !m.input ? 'view only' : '', m.mute ? 'muted' : '', m.framegen ? '+FG' : ''].filter(Boolean).join('  ·  ')
        : st === 'nopeer' ? '' : [G.via(s), rtt != null ? rtt + ' ms' : ''].filter(Boolean).join('  ·  '));
      // delay sparkline: one sample per new stats tuple; cleared when the stream stops
      if (!x) { if (r.buf.length) { r.buf = []; ctx.forget('rxs'); } }
      else if (num(x.delayMs) != null && ctx.changed('rxs', [x.delayMs, x.fps, x.mbps, x.dropped])) {
        r.buf.push(x.delayMs);
        if (r.buf.length > SPARK.N) r.buf.shift();
      }
      ctx.attr(r.spark, 'hidden', r.buf.length < 2);
      if (r.buf.length >= 2 && ctx.changed('rxsp', r.buf)) {
        const p = sparkD(r.buf);
        ctx.attr(r.spLine, 'd', p.d);
        ctx.attr(r.spDot, 'cx', p.last[0].toFixed(1));
        ctx.attr(r.spDot, 'cy', p.last[1].toFixed(1));
      }
      statusDot(ctx, page.querySelector('[data-pg-role=details]'), /^Live/, /^Paused/);
    },
  });

  // ======================================================================
  // pc-mac (Mac: share) — "transmitter"
  // ======================================================================
  function txModel(s) {
    const p = s.pcScreen;
    if (p && typeof p.mode === 'string') {
      const mons = Array.isArray(p.monitors) ? p.monitors : [];
      const mon = mons.find((m) => m.id === p.monitor) || mons.find((m) => /\(main\)$/.test(m.label || '')) || mons[0] || null;
      const mm = mon && /(\d+)\s*[×x]\s*(\d+)/.exec(mon.label || '');
      return {
        mode: p.mode, busy: !!p.busy, live: p.status === 'live', connected: s.link ? s.link.state === 'connected' : pcLive(s),
        accept: !!(p.mac && p.mac.accept), error: p.error || '', stats: p.status === 'live' && p.stats ? p.stats : null,
        cap: num(p.mbps), monW: mm ? +mm[1] : 16, monH: mm ? +mm[2] : 9, monName: mon ? String(mon.label || '').replace(/,.*$/, '') : '',
        ext: Array.isArray(p.extendPx) && p.extendPx[0] ? p.extendPx : [1920, 1080],
        input: !!p.input, sound: !!p.sound, remote: !!p.remote, vdd: p.vdd || {},
      };
    }
    const sh = s.sharing;
    if (sh && typeof sh === 'object') { // Mac: s.displayMode extend|mirror|custom, s.sharing.displays[], s.stream.status
      const st = s.stream && typeof s.stream === 'object' ? s.stream : {};
      const live = st.status === 'live';
      const ds = Array.isArray(sh.displays) ? sh.displays.filter(Boolean) : [];
      const vd = ds.find((d) => d.virtual) || null;
      const shown = ds.find((d) => d.id === sh.targetId) || ds.find((d) => d.id === sh.displayId && !d.virtual) || ds.find((d) => d.primary && !d.virtual) || ds.find((d) => !d.virtual) || null;
      const dw = (d) => (d && (num(d.pixelWidth) || num(d.width))) || null;
      const dh = (d) => (d && (num(d.pixelHeight) || num(d.height))) || null;
      const ext = s.displayMode === 'extend';
      const mon = ext ? ds.find((d) => d.primary && !d.virtual) || ds.find((d) => !d.virtual) || null : shown;
      const status = String(st.status || '');
      const v = sh.virtual && typeof sh.virtual === 'object' ? sh.virtual : {};
      return {
        mode: sh.on ? (ext ? 'extend' : 'mirror') : 'off', busy: status === 'starting', live, connected: pcLive(s) && status !== 'nothing connected',
        accept: !!status && status !== 'no viewer' && status !== 'off', error: v.error ? String(v.error) : '', stats: live ? st : null, cap: num(sh.bitrateMbps),
        monW: dw(mon) || num(st.width) || 16, monH: dh(mon) || num(st.height) || 10, monName: mon && !mon.virtual ? String(mon.label || '') : '',
        ext: vd && dw(vd) ? [dw(vd), dh(vd)] : [num(st.width) || 1920, num(st.height) || 1080],
        input: s.streamInput !== false, sound: !!sh.audio, remote: sh.remote !== false, vdd: {},
      };
    }
    return null;
  }
  const TX = { W: 256, H: 88, top: 10, maxH: 52, peerX: 226 };

  FX.register(['pc-mac', 'share'], {
    mount(page, ctx) {
      const body = ctx.body;
      if (!body) return;
      const E = ctx.el;
      role(body.querySelector(':scope > .note.warn'), 'missing');
      role(cardBy(body, 'Screen'), 'screen');
      const pic = role(cardBy(body, 'Picture'), 'picture');
      role(cardBy(body, 'Sound and control'), 'sound');
      role(cardBy(body, 'Remote'), 'remote');
      role(cardBy(body, 'Details'), 'details');
      const untitled = wrapsOf(body).filter((w) => !w.querySelector(':scope > .card-title'));
      if (untitled.length) role(untitled[untitled.length - 1], 'driver');
      const h = ctx.hdr({ cls: 'sx tx' });
      const r = { h };
      // bitrate gauge in the Picture card: real feedback for the Quality select
      if (pic && pic.querySelector(':scope > .card') && !pic.querySelector('.pg-gauge')) {
        r.gFill = E('i', 'g-fill');
        r.gMark = E('i', 'g-mark');
        r.gLbl = E('span', 'g-lbl pg-mono');
        r.gauge = E('div', 'pg-gauge', [E('span', 'g-track', [r.gFill, r.gMark]), r.gLbl], { hidden: true });
        pic.querySelector(':scope > .card').append(r.gauge);
      }
      r.svg = FX.svgRoot(`0 0 ${TX.W} ${TX.H}`, 'sx-svg tx-svg', [], { width: TX.W, height: TX.H });
      r.mon = S('g', { class: 'tx-mon' });
      r.virt = S('rect', { class: 'tx-virt', pathLength: 100 });
      r.vlbl = S('text', { class: 'tx-vlbl', 'text-anchor': 'middle' });
      r.line = S('path', { class: 'sx-line tx-line' });
      r.run = S('path', { class: 'sx-run tx-run', pathLength: 100 });
      r.dev = S('g', { class: 'tx-dev' });
      r.svg.append(r.mon, r.virt, r.vlbl, r.line, r.run, r.dev);
      r.t = textCol(E, 'tx-text');
      h.replaceChildren(r.t.el, E('div', 'sx-motif tx-motif', [r.svg]));
      R.set(page, r);
    },
    update(s, page, ctx) {
      const r = R.get(page);
      const m = txModel(s);
      if (!r || !m) return;
      const h = r.h, t = r.t;
      const who = whoOf(s);
      const on = m.mode !== 'off';
      const st = !on ? 'off' : m.busy ? 'busy' : m.live ? 'live' : !m.connected ? 'nopeer' : !m.accept ? 'armed' : 'connecting';
      ctx.attr(h, 'data-st', st);
      ctx.attr(h, 'data-mode', on ? m.mode : null);
      ctx.attr(h, 'data-err', m.error ? '' : null);
      // geometry: this monitor in its real shape; Extend's virtual one snapped to its right
      const ext = m.mode === 'extend';
      const os = pcOs(s) || 'mac';
      const [mw, mh] = fit(m.monW, m.monH, ext ? 78 : 104, TX.maxH);
      const [vw, vh] = fit(m.ext[0], m.ext[1], 70, TX.maxH);
      if (ctx.changed('geo', [mw, mh, vw, vh, ext, os, m.ext])) {
        const mx = 6, my = TX.top + (TX.maxH - mh);
        const neckX = r1(mx + mw / 2);
        // this computer: a Mac is a laptop outline (notch, base line), anything else a monitor on a slim stand
        const dockW = r1(Math.min(26, mw * 0.5));
        const scr = S('rect', { class: 'sx-win tx-scr', x: mx, y: my, width: mw, height: mh, rx: 3 });
        if (G.platform === 'mac') {
          r.mon.replaceChildren(scr,
            S('rect', { class: 'sx-fill', x: r1(neckX - 4), y: my + 1, width: 8, height: 2, rx: 1 }),
            S('path', { class: 'sx-dev', d: `M${mx - 5} ${my + mh + 3}H${mx + mw + 5}` }));
        } else {
          r.mon.replaceChildren(scr,
            S('rect', { class: 'sx-fill', x: r1(neckX - dockW / 2), y: my + mh - 6, width: dockW, height: 2, rx: 1 }),
            S('path', { class: 'sx-dev', d: `M${neckX} ${my + mh}V${TX.top + TX.maxH + 10}M${neckX - 11} ${TX.top + TX.maxH + 10.5}H${neckX + 11}` }));
        }
        const vx = mx + mw + 8, vy = TX.top + (TX.maxH - vh);
        for (const [k, v] of Object.entries({ x: vx, y: vy, width: vw, height: vh, rx: 3 })) r.virt.setAttribute(k, v);
        r.vlbl.setAttribute('x', r1(vx + vw / 2));
        r.vlbl.setAttribute('y', TX.top + TX.maxH + 14);
        r.vlbl.textContent = m.ext[0] + '×' + m.ext[1];
        const sx = ext ? vx + vw + 8 : mx + mw + 8;
        const cy = r1(ext ? vy + vh / 2 : my + mh / 2);
        const d = `M${r1(sx)} ${cy}H${TX.peerX - 8}`;
        r.line.setAttribute('d', d);
        r.run.setAttribute('d', d);
        r.dev.replaceChildren(...devGlyph(os, TX.peerX, cy - 10));
      }
      // the pulse runs quicker the closer the stream is to the chosen quality (calm either way)
      const x = m.stats;
      const mbps = x ? num(x.mbps) : null;
      const cap = m.cap || (x && num(x.targetMbps)) || 20;
      const cyc = mbps != null ? clamp(8 - 4 * (mbps / cap), 4, 8) : 6;
      if (ctx.changed('cyc', Math.round(cyc * 2))) ctx.css(h, '--sx-cycle', cyc.toFixed(1) + 's');
      // text
      ctx.text(t.kick, ext ? 'Extra screen · Extend' : m.mode === 'mirror' ? (m.monName || 'This screen') + ' · Mirror' : 'Share screen');
      if (st === 'live' && mbps != null) setFig(ctx, t, mbps, m.cap ? 'of ' + m.cap + ' Mbps' : 'Mbps');
      else setFig(ctx, t, { off: 'Off', busy: 'Starting', live: 'Live', nopeer: 'Waiting', armed: 'Ready', connecting: 'Connecting' }[st], '');
      ctx.text(t.cap, m.error && st !== 'live' ? m.error : st === 'live' ? 'On ' + who : st === 'busy' ? 'Adding the virtual display…'
        : st === 'nopeer' ? 'Waiting for ' + who : st === 'armed' ? 'Starts when ' + who + ' opens it' : st === 'connecting' ? 'Connecting to ' + who : '');
      const impl = x ? ((x.encoder != null && typeof x.hw === 'boolean' ? (x.hw ? 'HW ' : 'SW ') : '') + String(x.codec || '').toUpperCase()).trim() : '';
      ctx.text(t.meta, st === 'live' && x
        ? [num(x.fps) != null ? x.fps + ' fps' : '', impl, (num(x.rttMs) ?? num(G.get(s, 'client.rttMs'))) != null ? (num(x.rttMs) ?? num(G.get(s, 'client.rttMs'))) + ' ms' : '', m.sound ? 'sound' : ''].filter(Boolean).join('  ·  ')
        : st === 'off' || st === 'nopeer' ? '' : [m.input ? 'input from ' + who : 'view only', m.sound ? 'sound' : '', m.remote ? 'remote start' : ''].filter(Boolean).join('  ·  '));
      // the gauge in the Picture card
      if (r.gauge) {
        const tgt = x && num(x.targetMbps) ? clamp(x.targetMbps / cap, 0, 1) : null;
        ctx.attr(r.gauge, 'hidden', !x || mbps == null);
        if (x && mbps != null) {
          ctx.css(r.gauge, { '--fill': clamp(mbps / cap, 0, 1).toFixed(3), '--target': tgt != null ? tgt.toFixed(3) : null });
          ctx.attr(r.gauge, 'data-tick', tgt != null ? '' : null);
          ctx.text(r.gLbl, fmt1(mbps) + ' of ' + cap + ' Mbps' + (num(x.targetMbps) ? '  ·  network ' + x.targetMbps : ''));
        }
      }
      const drv = page.querySelector('[data-pg-role=driver]');
      ctx.attr(drv, 'data-quiet', m.vdd && m.vdd.installed && !m.vdd.busy ? '' : null);
      statusDot(ctx, page.querySelector('[data-pg-role=details]'), /^(On |Live)/, /^(Ready|Connecting|Starting|Waiting)/);
    },
  });

  // ======================================================================
  // apps — "dock to window"
  // ======================================================================
  function apModel(s) {
    const a = s.apps || {};
    const list = Array.isArray(a.list) ? a.list : [];
    const pp = s.papps;
    if (pp && typeof pp === 'object' && (Array.isArray(pp.apps) || Array.isArray(pp.windows))) {
      // Mac: s.papps { on, apps[], listing, windows[] } (the PC's apps here), s.apps { offer, launched[] } (this Mac's there)
      const wins = Array.isArray(pp.windows) ? pp.windows : [];
      return { connected: pcLive(s), list: Array.isArray(pp.apps) ? pp.apps : [], loading: !!pp.listing, open: wins.length,
        inOn: !!pp.on, outOn: !!a.offer, streaming: Array.isArray(a.launched) ? a.launched.length : num(a.launched) || 0, ret: false };
    }
    if (s.macApps || s.pcApps || s.link) {
      const pa = s.pcApps || {};
      return { connected: s.link ? s.link.state === 'connected' : pcLive(s), list, loading: !!a.loading, open: num(a.open) || 0,
        inOn: !!(s.macApps && s.macApps.on), outOn: !!pa.allow, streaming: num(pa.streaming) || 0, ret: !!pa.allow && !pa.macAccepts };
    }
    // Mac before papps is filled in (s.apps.offer only)
    return { connected: pcLive(s), list, loading: false, open: 0,
      inOn: !!(pp && pp.on), outOn: !!a.offer, streaming: Array.isArray(a.launched) ? a.launched.length : 0, ret: false };
  }
  const AP = { W: 220, H: 76 };

  FX.register('apps', {
    mount(page, ctx) {
      const body = ctx.body;
      if (!body) return;
      const E = ctx.el;
      const grid = body.querySelector('.app-grid');
      const list = role(grid && grid.closest('.card-wrap'), 'list');
      const kids = [...body.children].filter((c) => !c.classList.contains('pg-hdr'));
      if (kids[0] && kids[0].classList.contains('dir-pair') && kids[1] && kids[1].classList.contains('card-wrap')) role(kids[1], 'rezume');
      const r = { h: ctx.hdr({ cls: 'sx ap' }), grid };
      // a count beside the search field
      const filter = list && list.querySelector('input[type=text], input[type=search]');
      if (filter && filter.parentElement && !filter.parentElement.querySelector('.pg-count')) {
        r.count = E('span', 'pg-count pg-mono');
        filter.parentElement.append(r.count);
        if (filter.closest('.row')) filter.closest('.row').setAttribute('data-pg-search', '');
        filter.addEventListener('input', () => ctx.refresh());
        r.filter = filter;
      }
      // the motif: the dock there (five keys, the middle one lifts), a line up into a window here
      const svg = FX.svgRoot(`0 0 ${AP.W} ${AP.H}`, 'sx-svg ap-svg', [], { width: AP.W, height: AP.H });
      svg.append(S('rect', { class: 'sx-win ap-dock', x: 4, y: 46, width: 104, height: 24, rx: 9 }));
      for (let i = 0; i < 5; i++) {
        svg.append(S('rect', { class: 'ap-key' + (i === 2 ? ' hop' : ''), x: 11 + i * 19, y: 51, width: 14, height: 14, rx: 4 }));
      }
      const d = 'M56 49C56 22 118 30 150 30';
      svg.append(S('path', { class: 'sx-line ap-line', d }), S('path', { class: 'sx-run ap-run', d, pathLength: 100 }));
      r.win = S('g', { class: 'ap-win' }, winGlyph(154, 10, 60, 40));
      svg.append(r.win);
      r.L = textCol(E, 'ap-l');
      r.R = textCol(E, 'ap-r');
      r.h.replaceChildren(r.L.el, E('div', 'sx-motif ap-motif', [svg]), r.R.el);
      R.set(page, r);
    },
    update(s, page, ctx) {
      const r = R.get(page);
      if (!r) return;
      const m = apModel(s);
      const h = r.h;
      const st = !m.connected ? 'nopeer' : m.loading ? 'loading' : !m.list.length ? 'empty' : 'ready';
      ctx.attr(h, 'data-st', st);
      ctx.attr(h, 'data-in', m.inOn ? '1' : '0');
      ctx.attr(h, 'data-open', m.open > 0 ? '' : null);
      const who = whoOf(s);
      // left: the apps over there
      ctx.text(r.L.kick, 'On ' + who);
      if (st === 'ready') setFig(ctx, r.L, m.list.length, m.list.length === 1 ? 'app' : 'apps');
      else setFig(ctx, r.L, st === 'nopeer' ? 'Waiting' : st === 'loading' ? 'Loading' : 'No apps', '');
      ctx.text(r.L.cap, st === 'nopeer' ? 'Waiting for ' + who : !m.inOn ? 'Opening them here is off' : 'Each opens in its own window here');
      ctx.text(r.L.meta, '');
      // right: windows open here, and what goes the other way
      ctx.text(r.R.kick, 'Open here');
      setFig(ctx, r.R, st === 'nopeer' ? '–' : m.open, '');
      ctx.text(r.R.cap, st === 'nopeer' ? '' : !m.outOn ? 'Sharing yours is off' : m.ret ? 'Off on ' + who : m.streaming ? plural(m.streaming, 'window', 'windows') + ' on ' + who : 'Yours can open there');
      ctx.text(r.R.meta, '');
      // the direction cards count what's open
      const cards = page.querySelectorAll(':scope > .page-body > .dir-pair > .dir-card');
      if (cards[0]) ctx.attr(cards[0], 'data-count', String(m.open));
      if (cards[1]) ctx.attr(cards[1], 'data-count', String(m.streaming));
      // the search count
      if (r.count && r.grid) {
        const q = r.filter && r.filter.value.trim();
        ctx.text(r.count, !m.list.length ? '' : q ? r.grid.children.length + ' of ' + m.list.length : m.list.length + ' apps');
      }
    },
  });

  // ======================================================================
  // mirror — "phone to desk"
  // ======================================================================
  const hexOk = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const MI = { W: 244, H: 92, px: 8, py: 8, pw: 38, ph: 76, dx: 106, dy: 6, dw: 132, dh: 70 };
  const WIN = { screen: [15, 26], app: [36, 24], camera: [26, 19] };

  FX.register('mirror', {
    mount(page, ctx) {
      const body = ctx.body;
      if (!body) return;
      const E = ctx.el;
      role(wrapsOf(body).find((w) => w.querySelector('.btn.primary:not(.small)')), 'show');
      role(cardStarts(body, 'Open on '), 'wins');
      const opts = role(cardBy(body, 'Phone windows'), 'opts');
      const q = opts && [...opts.querySelectorAll('select')].find((x) => x.querySelector('option[value="24"]'));
      const r = { h: ctx.hdr({ cls: 'sx mi' }), quality: q && q.closest('.row') };
      if (r.quality) r.quality.setAttribute('data-pg-quality', '');
      const svg = FX.svgRoot(`0 0 ${MI.W} ${MI.H}`, 'sx-svg mi-svg', [], { width: MI.W, height: MI.H });
      const { px, py, pw, ph, dx, dy, dw, dh } = MI;
      r.phone = S('g', { class: 'mi-phone' }, [
        S('rect', { class: 'sx-win', x: px, y: py, width: pw, height: ph, rx: 8 }),
        S('circle', { class: 'sx-dot3', cx: px + pw / 2, cy: py + 6, r: 1.5 }),
        S('path', { class: 'sx-faint', d: `M${px + pw / 2 - 6} ${py + ph - 4.5}H${px + pw / 2 + 6}` }),
      ]);
      r.bat = S('rect', { class: 'mi-bat', x: px + 9, y: py + ph - 12, height: 1.5, rx: 0.75, width: 0 });
      r.phone.append(S('rect', { class: 'sx-fill', x: px + 9, y: py + ph - 12, width: pw - 18, height: 1.5, rx: 0.75 }), r.bat);
      const d = `M${px + pw + 5} ${py + ph / 2}C${px + pw + 30} ${py + ph / 2} ${dx - 26} ${dy + dh / 2} ${dx - 5} ${dy + dh / 2}`;
      r.thread = S('path', { class: 'mi-thread pg-draw', d, pathLength: 1 });
      r.run = S('path', { class: 'sx-run mi-run', d, pathLength: 100 });
      r.desk = S('g', { class: 'mi-desk' }, [
        S('rect', { class: 'sx-win', x: dx, y: dy, width: dw, height: dh, rx: 4 }),
        S('path', { class: 'sx-dev', d: G.platform === 'mac' ? `M${dx - 6} ${dy + dh + 4}H${dx + dw + 6}`
          : `M${dx + dw / 2} ${dy + dh}V${dy + dh + 7}M${dx + dw / 2 - 13} ${dy + dh + 7.5}H${dx + dw / 2 + 13}` }),
      ]);
      r.wins = S('g', { class: 'mi-wins' });
      svg.append(r.phone, r.thread, r.run, r.desk, r.wins);
      r.t = textCol(E, 'mi-text');
      r.h.replaceChildren(E('div', 'sx-motif mi-motif', [svg]), E('span', 'pg-spacer'), r.t.el);
      R.set(page, r);
    },
    update(s, page, ctx) {
      const r = R.get(page);
      if (!r) return;
      const h = r.h, t = r.t;
      // the accent is the phone's own colour, softened
      const cs = (G.get(s, 'phone.info.colors', []) || []).filter(hexOk);
      if (ctx.changed('col', cs[0] || '')) ctx.css(page, '--mi-c', cs[0] || null);
      const ph = s.phone || {};
      const br = ph.bridge || {};
      const set = ph.settings || {};
      const info = ph.info || {};
      const wins = (Array.isArray(br.windows) ? br.windows : []).filter((w) => w && typeof w === 'object');
      const bst = br.state;
      const st = bst === 'ready' ? (wins.length ? 'casting' : 'idle') : bst === 'connecting' ? 'connecting' : 'nobridge';
      ctx.attr(h, 'data-st', st);
      const lvl = num(info.battery);
      ctx.attr(r.bat, 'width', lvl != null ? r1((MI.pw - 18) * clamp(lvl, 0, 100) / 100) : 0);
      // one outline per window open here, inside this computer's screen
      const key = JSON.stringify(wins.map((w) => [w.kind, w.shown === false, !!w.error]));
      if (ctx.changed('wins', key)) {
        const { dx, dy, dw, dh } = MI;
        // windows that show sit in the middle; minimised ones are short bars along the bottom edge
        const shown = wins.filter((w) => w && w.shown !== false);
        const mins = wins.filter((w) => w && w.shown === false);
        const placed = [];
        let used = 0;
        for (const w of shown) {
          const [ww, wh] = WIN[w.kind] || WIN.app;
          if (used + ww + (placed.length ? 8 : 0) > dw - 20) break;
          used += ww + (placed.length ? 8 : 0);
          placed.push([w, ww, wh]);
        }
        let x = dx + (dw - used) / 2;
        const cy = dy + dh / 2 - (mins.length ? 3 : 0);
        const kids = [];
        for (const [w, ww, wh] of placed) {
          const y = r1(cy - wh / 2);
          const cls = 'mi-w' + (w.error ? ' err' : '');
          if (w.kind === 'screen') kids.push(S('rect', { class: 'sx-win ' + cls, x: r1(x), y, width: ww, height: wh, rx: 3 }));
          else if (w.kind === 'camera') {
            kids.push(S('rect', { class: 'sx-win ' + cls, x: r1(x), y, width: ww, height: wh, rx: 3 }));
            kids.push(S('circle', { class: 'sx-faint mi-lens', cx: r1(x + ww / 2), cy: r1(cy), r: 4.5 }));
          } else kids.push(...winGlyph(r1(x), y, ww, wh, cls));
          x += ww + 8;
        }
        const nm = Math.min(mins.length, 6);
        let bx = dx + (dw - (nm * 12 + Math.max(0, nm - 1) * 4)) / 2;
        for (let i = 0; i < nm; i++, bx += 16) kids.push(S('rect', { class: 'mi-w min' + (mins[i].error ? ' err' : ''), x: r1(bx), y: dy + dh - 8, width: 12, height: 2, rx: 1 }));
        const more = shown.length - placed.length + (mins.length - nm);
        if (more > 0) kids.push(S('text', { class: 'mi-more', x: dx + dw - 6, y: dy + 11, 'text-anchor': 'end', text: '+' + more }));
        r.wins.replaceChildren(...kids);
      }
      // text
      const p = G.phone(s) || {};
      const name = (ph.connected && ph.connected.name) || p.name || 'Phone';
      const rtt = num(ph.connected && ph.connected.rttMs) ?? p.rtt;
      const via = br.via || (p.usb ? 'usb' : 'wifi');
      ctx.text(t.kick, [name, /usb/i.test(via) ? 'USB' : 'Wi-Fi', rtt != null ? rtt + ' ms' : ''].filter(Boolean).join(' · '));
      if (st === 'casting') setFig(ctx, t, wins.length, wins.length === 1 ? 'window' : 'windows');
      else setFig(ctx, t, st === 'idle' ? 'Ready' : st === 'connecting' ? 'Connecting' : 'Not set up', '');
      ctx.text(t.cap, st === 'nobridge' ? 'Wireless debugging, once, on Connection' : st === 'connecting' ? br.message || 'Connecting to the phone…'
        : st === 'idle' ? 'Show Phone Screen opens it here'
          : wins.length === 1 ? (wins[0].kind === 'screen' ? 'The phone’s screen, open here' : wins[0].kind === 'camera' ? 'The phone’s camera, open here' : (wins[0].title || 'An app') + ', open here')
            : 'Open on ' + G.myName(s));
      ctx.text(t.meta, [lvl != null ? lvl + '%' + (info.charging ? ' charging' : '') : '', (num(set.bitrateMbps) || 8) + ' Mb/s', set.sound ? (br.sound && br.sound.on ? 'sound on' : 'sound') : ''].filter(Boolean).join('  ·  '));
      // page inserts
      if (r.quality) ctx.attr(r.quality, 'data-q', String(num(set.bitrateMbps) || 8));
      const list = page.querySelector('[data-pg-role=wins] > .card > div');
      if (list) [...list.children].forEach((row, i) => {
        const w = wins[i];
        ctx.attr(row, 'data-kind', w ? (WIN[w.kind] ? w.kind : 'app') : null);
        ctx.attr(row, 'data-min', w && w.shown === false ? '' : null);
      });
    },
  });

  // ======================================================================
  // papps — "app drawer orbit"
  // ======================================================================
  const PA = { W: 380, H: 84, rx: 182, ry: 34 };
  FX.register('papps', {
    mount(page, ctx) {
      const body = ctx.body;
      if (!body) return;
      const E = ctx.el;
      const first = [...body.children].find((c) => !c.classList.contains('pg-hdr'));
      if (first && first.classList.contains('card-wrap')) role(first, 'adb');
      const r = { h: ctx.hdr({ cls: 'sx pa' }) };
      r.search = body.querySelector('.papps-bar input');
      if (r.search) r.search.addEventListener('input', () => ctx.refresh());
      r.grid = body.querySelector(':scope > .card > .app-grid');
      const cx = PA.W / 2, cy = PA.H / 2;
      const d = `M${cx - PA.rx} ${cy}A${PA.rx} ${PA.ry} 0 1 1 ${cx + PA.rx} ${cy}A${PA.rx} ${PA.ry} 0 1 1 ${cx - PA.rx} ${cy}`;
      const svg = FX.svgRoot(`0 0 ${PA.W} ${PA.H}`, 'sx-svg pa-svg', [
        S('path', { class: 'pa-ring pg-draw', d, pathLength: 1 }),
        S('path', { class: 'pa-dot', d, pathLength: 100 }),
      ], { width: PA.W, height: PA.H, preserveAspectRatio: 'none' });
      r.t = textCol(E, 'pa-mid');
      r.L = textCol(E, 'pa-l');
      r.Rt = textCol(E, 'pa-r');
      r.h.replaceChildren(r.L.el, E('div', 'sx-motif pa-motif', [svg, r.t.el]), r.Rt.el);
      R.set(page, r);
    },
    enter(page, ctx) {
      const r = R.get(page);
      if (r && r.t) r.t.n._pgVal = 0; // the count rolls up from 0 on entry
    },
    update(s, page, ctx) {
      const r = R.get(page);
      if (!r) return;
      const h = r.h;
      const ph = s.phone || {};
      const br = ph.bridge || {};
      const ready = br.state === 'ready';
      const apps = safe(() => (UI.phoneAssets && Array.isArray(UI.phoneAssets.apps) ? UI.phoneAssets.apps : []), []);
      const st = !ready ? 'nobridge' : !apps.length ? 'loading' : 'ready';
      ctx.attr(h, 'data-st', st);
      const term = r.search ? r.search.value.trim().toLowerCase() : '';
      ctx.attr(h, 'data-q', term && apps.length ? '' : null);
      // centre: the count (or "shown of total" while searching)
      if (term && apps.length) {
        const shown = apps.filter((a) => String(a.name || '').toLowerCase().includes(term)).length;
        setFig(ctx, r.t, shown, 'of ' + apps.length);
      } else if (apps.length) setFig(ctx, r.t, apps.length, 'apps');
      else setFig(ctx, r.t, st === 'loading' ? 'Loading' : '–', '');
      // apps open in windows here, matched to the drawer by package
      const wins = (Array.isArray(br.windows) ? br.windows : []).filter((w) => w && w.kind === 'app');
      const openApps = [];
      for (const w of wins) { const a = apps.find((x) => x.id === w.app); if (a && !openApps.includes(a)) openApps.push(a); }
      const names = new Set(openApps.map((a) => a.name));
      if (r.grid) for (const tile of r.grid.children) { const sp = tile.querySelector('span'); ctx.cls(tile, 'pg-open', !!sp && names.has(sp.textContent)); }
      // sides
      const p = G.phone(s) || {};
      const name = p.name || (ph.connected && ph.connected.name) || 'Phone';
      ctx.text(r.L.kick, 'App drawer');
      ctx.text(r.L.cap, ready ? 'Each opens in its own window' : br.state === 'connecting' ? 'Connecting…' : 'Needs wireless debugging');
      ctx.text(r.L.meta, name);
      ctx.text(r.Rt.kick, 'In windows');
      ctx.text(r.Rt.cap, wins.length ? openApps.slice(0, 2).map((a) => a.name).join(', ') + (wins.length > 2 ? ' +' + (wins.length - 2) : '') || plural(wins.length, 'app', 'apps') : 'None open');
      ctx.text(r.Rt.meta, ready ? (/usb/i.test(br.via || '') ? 'USB' : 'Wi-Fi') : '');
      ctx.attr(r.Rt.el, 'data-n', String(wins.length));
    },
  });
})();
