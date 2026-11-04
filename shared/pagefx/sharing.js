// DuoDesk — PageFX: the Sharing group's personalities. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Clipboard, Notifications, File Sharing, Phone Files and Mount. Minimal (see the MINIMAL art direction):
// each page gets a quiet glass strip at the top of its body — a light figure or short status in Geist 300,
// a Geist Mono caption at 40 % white, and ONE hairline motif with the page accent on the one thing that
// moves or matters. The pages tell themselves apart by composition, not by colour:
//   Clipboard      the latest item as the figure; two rails between the computers, one dot = the item.
//   Notifications  bell + two counters; the last three toasts as hairline slips.
//   File Sharing   a status line over one long track between the two computers; the file rides it.
//   Phone Files    a phone outline whose level line is the storage; free space as the figure.
//   Mount          phone ─ connector ─ bay, the drive letter as the figure; the LED is the accent.
// Plus a few classes / data-* on the pages' own nodes (sharing.css styles them, monochrome).
// Rules: never remove, reparent or relabel a page node (only classes and data-*); every state access is
// guarded (Windows / Linux s.link + s.peer, Mac s.client, mesh s.peers); CSP: CSSOM only, no style
// attributes. Positions that carry data use left / the `translate` property / SVG attributes, never
// `transform` (the reduced-motion rule clears transforms inside .pg-hdr).
'use strict';

(() => {
  const FX = window.PageFX;
  if (!FX || FX._sharing) return;
  FX._sharing = true;
  const UI = window.UI || {};
  const api = () => UI.api || window.macshare || {};
  const safe = (fn, dflt) => { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const clip = (str, n) => { const t = String(str == null ? '' : str).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const mb = (n) => ((num(n) || 0) / 1048576).toFixed(1) + ' MB';
  const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);

  // Glyphs the core kit doesn't have (24×24, stroke currentColor).
  const MORE = {
    image: 'M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5zM3.5 15.5l4.5-4.5 4 4 2.5-2.5 6 5.5M15.5 9.2h.01',
    camera: 'M4.5 8H7l1.6-2.2h6.8L17 8h2.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8zM12 16.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    eyeoff: 'M3.5 3.5l17 17M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.8-1.2 2.3-2.7 3.6M6.5 7.6C4.4 9 3.2 11 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
    x: 'M7 7l10 10M17 7 7 17',
  };
  function ico(name, cls) {
    if (!MORE[name]) return FX.icon(name, cls);
    return FX.svgRoot('0 0 24 24', 'pg-ico' + (cls ? ' ' + cls : ''), [FX.svg('path', { d: MORE[name] })], { 'data-ico': name });
  }
  // Swap an icon in place only when its name changes.
  function setIco(holder, name, cls) {
    if (!holder) return;
    const cur = holder.firstElementChild;
    if (cur && cur.getAttribute('data-ico') === name) return;
    holder.replaceChildren(ico(name, cls));
  }
  const osGlyph = (os) => ({ mac: 'mac', win: 'win', windows: 'win', linux: 'linux', android: 'phone' })[os] || 'desktop';
  const myGlyph = (ctx) => (ctx.platform === 'mac' ? 'mac' : ctx.platform === 'linux' ? 'linux' : 'win');
  // The card-wrap whose title reads `re` (a page's cards have no stable class).
  function cardByTitle(body, re) {
    if (!body) return null;
    for (const w of body.querySelectorAll(':scope > .card-wrap')) {
      const t = w.querySelector(':scope > .card-title > span');
      if (t && re.test(window.DuoDeskI18n ? window.DuoDeskI18n.sourceText(t) : (t.textContent || ''))) return w;
    }
    return null;
  }
  // Linked to the other computer (Windows / Linux s.link, Mac s.client, mesh s.peers).
  const connected = (s, ctx) => ctx.linkState(s) === 'connected' && !!(s && (s.link ? s.link.state === 'connected' : true));
  const peerLabel = (s, ctx) => ctx.peerName(s) || safe(() => UI.peer(s).name, '') || 'the other computer';
  const myLabel = (s, ctx) => ctx.myName(s);
  // The phone's own name: the hub's, else the connected phone's (UI.phoneName falls back to "your phone").
  const phoneLabel = (s, ctx) => (s && s.hub && s.hub.name) || (ctx.phone(s) || {}).name || 'your phone';
  const ext = (name) => { const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || '')); return m ? m[1].toUpperCase() : ''; };
  // A mono tag: <span class="shr-tag">[icon] text</span>; returns { e, t }.
  const mkTag = (ctx, cls, iconName) => {
    const t = ctx.el('span');
    return { e: ctx.el('span', 'shr-tag' + (cls ? ' ' + cls : ''), [iconName ? ico(iconName) : null, t]), t };
  };
  const showTag = (ctx, tag, on, str) => { tag.e.hidden = !on; if (on) ctx.text(tag.t, str); };

  // ======================================================================
  // Clipboard — the latest item is the figure; two rails, one dot
  // ======================================================================
  FX.register('clipboard', (() => {
    let r = null;
    let lastAt;            // history[0].at last seen (undefined: nothing seen yet → no fly on first sight)
    let copiedUntil = 0;
    // rails in a 240 × 52 box: receive (peer → me) on top, send (me → peer) below
    const X0 = 6, X1 = 234, YI = 16, YO = 36;
    const DOT = { in: [X1, YI], out: [X0, YO] };     // where the item rests: its destination
    const FROM = { in: [X0, YI], out: [X1, YO] };    // where it leaves from
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'shr shr-clip', interactive: true, label: 'Clipboard between your computers' });
      const kick = el('div', 'pg-kick shr-clip-kick');
      const thumb = el('img', 'shr-clip-thumb', null, { alt: '' });
      thumb.hidden = true;
      const figText = el('span', 'shr-clip-text');
      const fig = el('button', 'shr-clip-fig', [thumb, figText], {
        on: { click: () => {
          const s = ctx.s();
          const h0 = arr(ctx.get(s, 'clipboard.history'))[0];
          if (!h0 || (h0.image && !h0.image.copy)) return;
          safe(() => api().copyHistory(0));
          copiedUntil = Date.now() + 1800;
          ctx.refresh();
          ctx.after(1900, () => ctx.refresh());
        } },
      });
      const cap = el('div', 'shr-cap shr-clip-cap');
      const mode = mkTag(ctx, 'shr-clip-mode');
      const pics = mkTag(ctx, 'shr-clip-pics');
      const skip = mkTag(ctx, 'warn shr-clip-skip', 'lock');
      const tags = el('div', 'shr-tags', [mode.e, pics.e, skip.e]);
      const text = el('div', 'shr-text', [kick, fig, el('div', 'shr-capline', [cap, tags])]);
      // motif
      const rail = (y, rev, cls) => svg('path', { class: 'shr-rail ' + cls, d: rev ? `M${X1} ${y}H${X0}` : `M${X0} ${y}H${X1}`, pathLength: '100' });
      const railIn = rail(YI, false, 'in');
      const railOut = rail(YO, true, 'out');
      const sweepIn = svg('path', { class: 'shr-sweep in', d: `M${X0} ${YI}H${X1}`, pathLength: '100' });
      const sweepOut = svg('path', { class: 'shr-sweep out', d: `M${X1} ${YO}H${X0}`, pathLength: '100' });
      const end = (x, y, cls) => svg('circle', { class: 'shr-end ' + cls, cx: String(x), cy: String(y), r: '2' });
      const dot = svg('g', { class: 'shr-clip-dot' }, [svg('circle', { r: '3.5' })]);
      const art = ctx.svgRoot('0 0 240 52', 'shr-clip-svg', [railIn, railOut, sweepIn, sweepOut,
        end(X0, YI, 'peer'), end(X0, YO, 'peer'), end(X1, YI, 'me'), end(X1, YO, 'me'), dot]);
      const lPeer = el('span', 'shr-motif-l');
      const lMe = el('span', 'shr-motif-r');
      const lOff = el('span', 'shr-clip-off');
      const motif = el('div', 'shr-motif shr-clip-motif', [el('div', 'shr-clip-art', [art, lOff]), el('div', 'shr-motif-names', [lPeer, lMe])], { 'aria-hidden': 'true' });
      h.replaceChildren(text, motif);
      ctx.stagger([text, motif]);
      return { h, kick, fig, figText, thumb, cap, mode, pics, skip, railIn, railOut, sweepIn, sweepOut, dot, lPeer, lMe, lOff };
    }
    const place = (ctx, xy) => ctx.css(r.dot, 'translate', xy[0] + 'px ' + xy[1] + 'px');
    // The dot only transitions while .shr-fly is on (a fresh item); every other move is a jump.
    let flyEnd = null;
    function fly(ctx, dir) {
      if (flyEnd) { flyEnd(); flyEnd = null; }
      r.dot.classList.remove('shr-fly');
      if (ctx.reduced || ctx.paused()) { place(ctx, DOT[dir]); return; }
      place(ctx, FROM[dir]);
      void r.dot.getBoundingClientRect(); // one read, on a new item only
      r.dot.classList.add('shr-fly');
      place(ctx, DOT[dir]);
      flyEnd = ctx.after(1100, () => { r.dot.classList.remove('shr-fly'); flyEnd = null; });
    }
    function tagCards(page, ctx, c) {
      const priv = cardByTitle(ctx.body, /privacy/i);
      if (priv) { ctx.cls(priv, 'pg-privacy', true); ctx.cls(priv, 'pg-shield-on', !!c.skipConcealed); }
    }
    return {
      mount(page, ctx) {
        ctx.accent('#30b0c7', '#64d2ff'); // the teal stop leads (pfiles leads with sky, files with deep blue)
        r = build(page, ctx);
        ctx.every(15000, () => ctx.refresh());
      },
      enter(page, ctx) { if (!r || !r.h.isConnected) r = build(page, ctx); r.dot.classList.remove('shr-fly'); },
      update(s, page, ctx) {
        if (!r || !r.h.isConnected) r = build(page, ctx);
        const c = (s && s.clipboard) || {};
        const hist = arr(c.history);
        const h0 = hist[0] || null;
        const on = connected(s, ctx);
        const refused = on && c.peerAccepts === false;
        const pn = peerLabel(s, ctx);
        const histOff = num(c.historySize) === 0;
        ctx.cls(r.h, 'no-peer', !on);
        ctx.cls(r.h, 'refused', refused);
        ctx.cls(r.h, 'empty', !h0);

        // the figure: the latest item (a button: Copy, like the list's)
        const img = h0 && h0.image;
        const thumbSrc = img && img.thumb ? img.thumb : '';
        r.thumb.hidden = !thumbSrc;
        if (thumbSrc && r.thumb.getAttribute('src') !== thumbSrc) r.thumb.src = thumbSrc;
        ctx.text(r.figText, !h0 ? (histOff ? 'Recent items are off' : 'Nothing copied yet')
          : img ? (img.shot ? 'Screenshot' : 'Picture') + (img.w ? ' ' + img.w + ' × ' + img.h : '')
            : '“' + (clip(h0.text, 44) || ' ') + '”');
        const can = !!h0 && (!img || !!img.copy);
        r.fig.disabled = !can;
        r.fig.title = can ? 'Copy it again' : '';
        r.fig.setAttribute('aria-label', can ? 'Copy the latest item again' : (r.figText.textContent || 'Clipboard'));
        ctx.text(r.kick, !h0 ? 'Clipboard' : h0.dir === 'out' ? 'Latest · to ' + pn : 'Latest · from ' + pn);

        // the caption
        const copied = Date.now() < copiedUntil;
        ctx.cls(r.h, 'copied', copied);
        ctx.text(r.cap, copied ? 'Copied'
          : !on ? 'Waiting for ' + pn
            : refused ? 'Clipboard is off on ' + pn
              : h0 ? [ctx.ago(h0.at), h0.size != null ? ctx.bytes(h0.size) : ''].filter(Boolean).join(' · ')
                : histOff ? 'Copies still go across'
                  : c.receive && c.send ? 'Copy on either one, paste on the other'
                    : c.receive ? 'Copies on ' + pn + ' paste here'
                      : c.send ? 'Copies here paste on ' + pn : 'Both directions are off');
        showTag(ctx, r.mode, true, c.mode === 'switch' ? 'On switch' : 'Instant');
        showTag(ctx, r.pics, !!(c.imageSupport && c.images), 'Pictures');
        showTag(ctx, r.skip, !!(c.enabled && c.lastSkip), 'Not sent: ' + clip(c.lastSkip, 28));

        // the rails
        const inOn = on && !!c.receive;
        const outOn = on && !!c.send && !refused;
        ctx.cls(r.railIn, 'on', inOn);
        ctx.cls(r.railOut, 'on', outOn);
        ctx.cls(r.railOut, 'broken', refused);
        ctx.cls(r.sweepIn, 'on', inOn);
        ctx.cls(r.sweepOut, 'on', outOn);
        ctx.text(r.lPeer, pn);
        ctx.text(r.lMe, myLabel(s, ctx));
        ctx.text(r.lOff, refused ? 'off' : '');

        // the dot: the item, at its destination (parked on me while unlinked); flies once per new item,
        // keyed on history[0].at — the page's list rebuilds every 15 s, so never key on the DOM
        r.dot.hidden = !h0;
        const dir = on && h0 && h0.dir === 'out' ? 'out' : 'in';
        ctx.cls(r.dot, 'parked', !on);
        const at = h0 ? h0.at : null;
        if (lastAt !== undefined && at && at !== lastAt) {
          fly(ctx, dir);
          const first = page.querySelector('.history > .hist-item:first-child');
          if (first) ctx.pop(first, 'pg-new', 1200);
        } else place(ctx, DOT[dir]);
        lastAt = at;
        tagCards(page, ctx, c);
      },
    };
  })());

  // ======================================================================
  // Notifications — bell + two counters; the last three as hairline slips
  // ======================================================================
  FX.register('notifications', (() => {
    let r = null;
    let lastId;
    let toastKey = '';
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'shr shr-notif' });
      const bell = ctx.svgRoot('0 0 32 32', 'shr-bell', [
        svg('path', { class: 'shr-bell-body', d: 'M9.5 21.5v-7a6.5 6.5 0 0 1 13 0v7l2 2.5h-17z' }),
        svg('path', { class: 'shr-bell-clap', d: 'M13.8 26.6a2.3 2.3 0 0 0 4.4 0' }),
        svg('path', { class: 'shr-bell-slash', d: 'M6 6l20 20' }),
        svg('circle', { class: 'shr-bell-dot', cx: '23', cy: '9', r: '2.6' }),
      ]);
      const bellWrap = el('div', 'shr-bell-wrap', [bell]);
      const counter = (label) => {
        const n = el('span', 'pg-fig shr-n');
        const e = el('div', 'shr-count', [n, el('span', 'pg-kick', label)]);
        return { e, n };
      };
      const shown = counter('shown here');
      const sent = counter('sent');
      const counts = el('div', 'shr-counts', [shown.e, el('i', 'pg-vr'), sent.e]);
      const cap = el('div', 'shr-cap');
      const hide = mkTag(ctx, 'shr-notif-hide', 'eyeoff');
      const warn = mkTag(ctx, 'warn shr-notif-warn');
      const left = el('div', 'shr-text', [counts, el('div', 'shr-capline', [cap, el('div', 'shr-tags', [hide.e, warn.e])])]);
      const stack = el('div', 'shr-toasts');
      h.replaceChildren(bellWrap, left, stack);
      ctx.stagger([bellWrap, left, stack]);
      return { h, bellWrap, shown, sent, cap, hide, warn, stack };
    }
    function toasts(ctx, n, hist) {
      const icons = (n && n.historyIcons) || {};
      const top = hist.slice(0, 3);
      const key = JSON.stringify(top.map((x) => [x.id, x.at, x.title, !!icons[x.app]]));
      if (key !== toastKey) {
        toastKey = key;
        if (!top.length) {
          r.stack.replaceChildren(ctx.el('div', 'shr-toast empty', [ctx.el('span', 'shr-toast-text', 'Quiet. New ones land here.')]));
        } else {
          r.stack.replaceChildren(...top.map((it, i) => {
            const app = String(it.appName || it.app || 'App');
            const av = icons[it.app]
              ? ctx.el('img', 'shr-toast-av', null, { src: icons[it.app], alt: '' })
              : ctx.el('span', 'shr-toast-av letter', app.trim().charAt(0).toUpperCase() || '·');
            const when = ctx.el('span', 'shr-toast-when', ctx.ago(it.at));
            const e = ctx.el('div', 'shr-toast', [av, ctx.el('span', 'shr-toast-text', [ctx.el('b', null, app), it.title ? '  ' + clip(it.title, 48) : '']), when], { css: { '--i': String(i) } });
            e._at = it.at;
            return e;
          }));
        }
      } else {
        for (const t of r.stack.children) if (t._at) ctx.text(t.querySelector('.shr-toast-when'), ctx.ago(t._at));
      }
    }
    function tagCards(page, ctx, n, hist, fresh) {
      const body = ctx.body;
      if (!body) return;
      let feed = cardByTitle(body, /recent notif|notifications/i);
      let apps = cardByTitle(body, /^\s*apps\s*$/i);
      const wraps = body.querySelectorAll(':scope > .card-wrap');
      if (!feed && wraps[0]) feed = wraps[0];
      if (!apps && wraps[1]) apps = wraps[1];
      if (feed) {
        ctx.cls(feed, 'pg-notif-feed', true);
        const list = feed.querySelector(':scope > .card > div');
        const rows = list ? list.querySelectorAll(':scope > .row') : [];
        rows.forEach((row, i) => {
          const it = hist[i];
          if (!it || row.classList.contains('with-ico')) return;
          const a = String(it.appName || it.app || '').trim().charAt(0).toUpperCase();
          ctx.attr(row.querySelector(':scope > .text'), 'data-initial', a || null); // attr() reads the pseudo's own element
        });
        if (fresh && rows[0] && hist.length) ctx.pop(rows[0], 'pg-new', 1200);
      }
      if (apps && apps !== feed) ctx.cls(apps, 'pg-notif-apps', true);
    }
    return {
      mount(page, ctx) {
        r = build(page, ctx);
        ctx.every(15000, () => ctx.refresh());
      },
      enter(page, ctx) { if (!r || !r.h.isConnected) { r = build(page, ctx); toastKey = ''; } },
      update(s, page, ctx) {
        if (!r || !r.h.isConnected) { r = build(page, ctx); toastKey = ''; }
        const n = (s && s.notifs) || {};
        const hist = arr(n.history);
        const on = connected(s, ctx);
        const pn = peerLabel(s, ctx);
        ctx.cls(r.h, 'no-peer', !on);
        ctx.cls(r.h, 'recv', !!n.receive && on);
        ctx.cls(r.h, 'quiet', !hist.length);
        ctx.count(r.shown.n, num(n.shown) || 0);
        ctx.count(r.sent.n, num(n.sent) || 0);
        ctx.cls(r.shown.e, 'dim', !n.receive);
        const unreadable = n.readable === false || n.access === 'noAccess'; // Mac: Full Disk Access
        ctx.cls(r.sent.e, 'dim', !n.send || unreadable);
        showTag(ctx, r.hide, !!n.hideText && !!n.send && !unreadable, 'Text hidden');
        showTag(ctx, r.warn, unreadable, n.access === 'noAccess' ? 'Needs Full Disk Access' : ctx.platform === 'win' ? 'Can’t read Windows’ list' : 'Can’t read the list');
        ctx.text(r.cap, !on ? 'Nothing comes in until ' + pn + ' connects'
          : !hist.length ? (n.receive ? 'Waiting for the first one' : 'Receiving is off')
            : 'Latest ' + [hist[0].appName || hist[0].app, ctx.ago(hist[0].at)].filter(Boolean).join(' · '));
        toasts(ctx, n, hist);
        const id = hist[0] ? (hist[0].id != null ? hist[0].id : hist[0].at) : null;
        const fresh = lastId !== undefined && id != null && id !== lastId;
        if (fresh) {
          ctx.pop(r.bellWrap, 'shr-swing', 900);
          const t0 = r.stack.firstElementChild;
          if (t0) ctx.pop(t0, 'shr-new', 900);
        }
        lastId = id;
        tagCards(page, ctx, n, hist, fresh);
      },
    };
  })());

  // ======================================================================
  // File Sharing — a status line over one long track; the file rides it
  // ======================================================================
  FX.register('files', (() => {
    let r = null;
    function build(page, ctx) {
      const { el } = ctx;
      const h = ctx.hdr(page, { cls: 'shr shr-files' });
      const kick = el('div', 'pg-kick');
      const status = el('div', 'shr-status');
      const fig = el('div', 'pg-fig shr-files-fig');
      const top = el('div', 'shr-files-top', [el('div', 'shr-text', [kick, status]), fig]);
      const end = (side) => {
        const ic = el('span', 'shr-end-ico');
        const nm = el('span', 'shr-end-nm');
        const lamp = el('span', 'shr-end-lamp', [el('i'), el('span')]);
        return { e: el('div', 'shr-tend ' + side, [ic, el('div', 'shr-tend-text', [nm, lamp])]), ic, nm, lamp };
      };
      const peer = end('peer');
      const me = end('me');
      const tokExt = el('span', 'shr-tok-ext');
      const tokMark = el('span', 'shr-tok-mark');
      const tok = el('span', 'shr-tok', [tokExt, tokMark]);
      const queue = el('span', 'shr-queue');
      const line = el('div', 'shr-line', [el('i', 'shr-line-base'), el('i', 'shr-line-fill'), el('i', 'shr-line-run'), el('i', 'shr-line-edge'), queue, tok]);
      const track = el('div', 'shr-track', [peer.e, line, me.e], { 'aria-hidden': 'true' });
      const cap = el('div', 'shr-cap');
      const drive = mkTag(ctx, 'shr-files-drive', 'folder');
      const share = mkTag(ctx, 'shr-files-share');
      const foot = el('div', 'shr-capline', [cap, el('div', 'shr-tags', [drive.e, share.e])]);
      h.replaceChildren(top, track, foot);
      ctx.stagger([top, track, foot]);
      return { h, kick, status, fig, peer, me, line, tok, tokExt, tokMark, queue, cap, drive, share };
    }
    function tagPage(page, ctx, live) {
      const log = cardByTitle(ctx.body, /^\s*recent\s*$/i);
      if (!log) return;
      ctx.cls(log, 'pg-files-log', true);
      const rows = log.querySelectorAll(':scope > .card > .row');
      if (rows[0]) ctx.cls(rows[0], 'pg-live', live.out);
      if (rows[1]) ctx.cls(rows[1], 'pg-live', live.in);
    }
    return {
      mount(page, ctx) {
        ctx.accent('#0a84ff', '#64d2ff'); // deep blue leads: reads apart from Phone Files
        r = build(page, ctx);
        ctx.every(15000, () => ctx.refresh());
      },
      enter(page, ctx) { if (!r || !r.h.isConnected) r = build(page, ctx); },
      update(s, page, ctx) {
        if (!r || !r.h.isConnected) r = build(page, ctx);
        const f = (s && s.files) || {};
        const smb = f.smb || {};
        const inc = f.incoming || {};
        const dr = f.drag || {};
        const on = connected(s, ctx);
        const pn = peerLabel(s, ctx);
        setIco(r.peer.ic, osGlyph(ctx.peerOs(s)));
        setIco(r.me.ic, myGlyph(ctx));
        ctx.text(r.peer.nm, pn);
        ctx.text(r.me.nm, myLabel(s, ctx));
        // Windows / Linux: acceptFromMac (this one takes the other's files), dropToMac (sends to it),
        // current / batch / incoming / last. Mac: acceptDrops, sending[] / receiving[] / recent[] / sent[].
        const macSending = arr(f.sending).filter(Boolean);
        const macReceiving = arr(f.receiving).filter(Boolean);
        const take = !!(f.acceptFromMac != null ? f.acceptFromMac : f.acceptDrops);
        const send = f.dropToMac != null ? !!f.dropToMac : Array.isArray(f.sending);
        ctx.cls(r.peer.lamp, 'on', on && send);
        ctx.text(r.peer.lamp.lastElementChild, send ? 'Gets your files' : 'Sending off');
        ctx.cls(r.me.lamp, 'on', on && take);
        ctx.text(r.me.lamp.lastElementChild, take ? 'Takes files' : 'Taking off');
        ctx.cls(r.h, 'no-peer', !on);
        ctx.cls(r.h, 'idle-dirs', !take && !send);

        // what moves: a batch (Send / paste) or the current file out; files coming in; a drag
        const b = f.batch || (macSending.length ? {
          kind: 'send', name: macSending.length > 1 ? macSending.length + ' files' : macSending[0].name,
          bytes: macSending.reduce((a, x) => a + (num(x.size) || 0), 0), sent: macSending.reduce((a, x) => a + (num(x.sent) || 0), 0), files: 1, index: 0,
        } : null);
        const c = f.current;
        const outName = b ? b.name : c ? c.name : '';
        const total = b ? num(b.bytes) : c ? num(c.size) : null;
        const sentB = b ? num(b.sent) : c ? num(c.sent) : null;
        const p = total ? Math.max(0, Math.min(1, (sentB || 0) / total)) : 0;
        const sending = !!(b || c);
        const recvN = (num(inc.receiving) || 0) || macReceiving.length;
        const receiving = !sending && recvN > 0;
        const dragging = !sending && !!dr.state;
        const lasts = [
          f.last ? Object.assign({}, f.last, { dir: 'out' }) : null,
          inc.last ? Object.assign({}, inc.last, { dir: 'in' }) : null,
          dr.last ? Object.assign({}, dr.last, { dir: 'in', name: dr.last.name || '' }) : null,
          arr(f.recent)[0] ? Object.assign({}, f.recent[0], { dir: 'in' }) : null,
          arr(f.sent)[0] ? Object.assign({}, f.sent[0], { dir: 'out' }) : null,
        ].filter((x) => x && x.at).map((x) => (x.text != null ? x : Object.assign(x, { text: x.ok ? '' : x.error ? 'Failed: ' + x.error : '' })))
          .sort((x, y) => y.at - x.at);
        const lastR = lasts[0] || null;
        const st = sending ? 'out' : dragging ? 'drag' : receiving ? 'in' : lastR ? 'done' : 'idle';
        ctx.attr(r.h, 'data-st', st);

        // the token: out rides me (right) → peer (left), so its x is 1 - p; done docks at its destination
        const x = st === 'out' ? 1 - p : st === 'drag' ? 0.5 : st === 'done' ? (lastR.dir === 'out' ? 0 : 1) : st === 'in' ? 1 : 1;
        ctx.css(r.line, '--x', x.toFixed(4));
        r.tok.hidden = st === 'idle' || st === 'in';
        const tokName = st === 'out' ? outName : st === 'drag' ? dr.name : lastR ? lastR.name : '';
        const e = ext(tokName);
        ctx.text(r.tokExt, (e || 'FILE').slice(0, 4));
        ctx.attr(r.tok, 'data-ok', st === 'done' ? (lastR.ok ? '1' : '0') : null);
        ctx.text(r.tokMark, st === 'done' ? (lastR.ok ? '✓' : '×') : '');
        if (st === 'done' && ctx.changed('doneAt', lastR.at)) ctx.pop(r.tok, 'shr-dock', 800);
        // the queue behind it: up to 5 hairline squares + "+N"
        const q = sending ? Math.max(0, num(f.queued) || 0) : 0;
        if (ctx.changed('q', q)) {
          const kids = [];
          for (let i = 0; i < Math.min(5, q); i++) kids.push(ctx.el('i'));
          if (q > 5) kids.push(ctx.el('span', null, '+' + (q - 5)));
          r.queue.replaceChildren(...kids);
        }

        // the status line and the figure
        let kick, status, fig = '', cap;
        if (st === 'out') {
          const kind = b && b.kind === 'paste' ? 'Pasting' : 'Sending';
          const idx = b ? (b.files > 1 ? (b.index + 1) + ' of ' + b.files : '') : c && c.count > 1 ? (c.index + 1) + ' of ' + c.count : '';
          kick = kind + ' to ' + pn;
          status = clip(outName, 48);
          fig = pct(p) + '%';
          cap = [idx, mb(sentB) + ' of ' + mb(total), q ? q + ' more waiting' : ''].filter(Boolean).join(' · ');
        } else if (st === 'drag') {
          kick = dr.state === 'copying' ? 'Copying across the edge' : 'Dragging across the edge';
          status = clip(dr.name, 48) || 'Files';
          cap = dr.state === 'copying' ? 'Into ' + safe(() => UI.receivedName(s), 'Downloads') : 'Esc cancels';
        } else if (st === 'in') {
          kick = 'Receiving from ' + pn;
          status = macReceiving.length === 1 && !inc.receiving ? clip(macReceiving[0].name, 48) : recvN + ' file' + (recvN > 1 ? 's' : '');
          cap = 'Into ' + safe(() => UI.receivedName(s), 'Downloads');
        } else if (!on) {
          kick = 'File sharing';
          status = 'Connect to send files';
          cap = lastR ? 'Last: ' + clip(lastR.name, 32) + ' · ' + ctx.ago(lastR.at) : 'Waiting for ' + pn;
        } else if (lastR) {
          kick = lastR.ok ? (lastR.dir === 'out' ? 'Sent to ' + pn : 'Received from ' + pn) : (lastR.dir === 'out' ? 'Not sent' : 'Not received');
          status = clip(lastR.name, 48) || (lastR.ok ? 'Done' : 'Didn’t go through');
          cap = [lastR.text, ctx.ago(lastR.at)].filter(Boolean).join(' · ');
        } else {
          kick = 'File sharing';
          status = 'Ready when you are';
          cap = !take && !send ? 'Both directions are off' : 'Drop files below, or drag them across the screen edge';
        }
        ctx.text(r.kick, kick);
        ctx.text(r.status, status);
        ctx.text(r.fig, fig);
        r.fig.hidden = !fig;
        ctx.text(r.cap, cap);

        // folder tags
        showTag(ctx, r.drive, !!smb.drive, 'Their folder · ' + smb.drive);
        const pe = smb.peer || {};
        showTag(ctx, r.share, !!f.shareOn, pe.mounted ? 'Folder shared · open there' : pe.error ? 'Sharing: problem' : 'Folder shared');
        ctx.cls(r.share.e, 'warn', !!(f.shareOn && pe.error));
        tagPage(page, ctx, { out: sending, in: receiving || dragging });
      },
    };
  })());

  // ======================================================================
  // Phone Files — a phone outline whose level line is the storage
  // ======================================================================
  FX.register('pfiles', (() => {
    let r = null;
    let fs = null;        // the last fs.list answer: { free, total, items, path, error }
    let lastPath = null;
    let level = 0;        // shown level 0..1
    let cancelRise = null;
    let aim = 0;          // where the level is heading (the running tween's end)
    // the phone in a 48 × 84 box; the inside runs from y = TOP to BOT
    const TOP = 10, BOT = 76;
    function setLevel(lv) {
      level = lv;
      if (!r) return;
      const y = BOT - (BOT - TOP) * Math.max(0, Math.min(1, lv));
      r.fill.setAttribute('y', y.toFixed(2));
      r.fill.setAttribute('height', Math.max(0, BOT - y).toFixed(2));
      r.lvl.setAttribute('y1', y.toFixed(2));
      r.lvl.setAttribute('y2', y.toFixed(2));
    }
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'shr shr-pfiles' });
      const fill = svg('rect', { class: 'shr-pf-fill', x: '6', y: String(BOT), width: '36', height: '0' });
      const lvl = svg('line', { class: 'shr-pf-lvl', x1: '6', x2: '42', y1: String(BOT), y2: String(BOT) });
      const phone = ctx.svgRoot('0 0 48 84', 'shr-pf-phone', [
        svg('rect', { class: 'shr-pf-body pg-draw', x: '1.5', y: '1.5', width: '45', height: '81', rx: '9', pathLength: '1' }),
        svg('rect', { class: 'shr-pf-screen', x: '6', y: String(TOP), width: '36', height: String(BOT - TOP), rx: '2' }),
        fill, lvl,
        svg('circle', { class: 'shr-pf-cam', cx: '24', cy: '6', r: '1.2' }),
      ]);
      const glyph = el('span', 'shr-pf-glyph');
      const kick = el('div', 'pg-kick');
      const n = el('span', 'shr-n');
      const unit = el('small');
      const fig = el('div', 'pg-fig', [n, unit]);
      const cap = el('div', 'shr-cap');
      const mid = el('div', 'shr-text', [kick, fig, cap]);
      const stat = (label) => { const v = el('b'); const e = el('div', 'shr-stat', [v, el('span', null, label)]); return { e, v }; };
      const sFolders = stat('folders');
      const sFiles = stat('files');
      const sSize = stat('in this folder');
      const stats = el('div', 'shr-stats', [sFolders.e, sFiles.e, sSize.e]);
      const chosen = mkTag(ctx, 'shr-pf-chosen', 'check');
      const imp = mkTag(ctx, 'shr-pf-import');
      const lampPhone = mkTag(ctx, 'shr-pf-lamp');
      const lampMine = mkTag(ctx, 'shr-pf-lamp');
      lampPhone.e.prepend(el('i', 'shr-lamp'));
      lampMine.e.prepend(el('i', 'shr-lamp'));
      const side = el('div', 'shr-side', [stats, el('div', 'shr-tags', [chosen.e, imp.e, lampPhone.e, lampMine.e])]);
      h.replaceChildren(el('div', 'shr-pf-phone-wrap', [phone, glyph]), mid, side);
      ctx.stagger([mid, side]);
      return { h, fill, lvl, glyph, kick, n, unit, cap, stats, sFolders, sFiles, sSize, chosen, imp, lampPhone, lampMine };
    }
    const listEl = (page) => page.querySelector('.hub-fs-list');
    const cwdOf = (page) => [...page.querySelectorAll('.hub-crumbs > .hub-crumb')].slice(1).map((b) => b.textContent).join('/');
    // data-ext / data-kind on file rows (paint() rebuilds the list on every click)
    function tagRows(page, ctx) {
      const list = listEl(page);
      if (!list) return 0;
      let n = 0;
      for (const row of list.querySelectorAll(':scope > .hub-fs-row')) {
        if (row.classList.contains('chosen')) n++;
        const label = row.querySelector('.text > .label');
        const isDir = !!row.querySelector('.hub-fs-ico.dir');
        if (!label || isDir || row.querySelector('input.hub-input')) continue;
        const x = ext(label.textContent);
        if (x) ctx.attr(label, 'data-ext', x.length > 4 ? x.slice(0, 4) : x);
      }
      const wrap = page.querySelector('.hub-fs');
      if (wrap) {
        const crumbs = page.querySelectorAll('.hub-crumbs > .hub-crumb');
        const last = crumbs[crumbs.length - 1];
        const target = (last && last.textContent) || 'Storage';
        ctx.attr(wrap, 'data-target', target);
        // the drop label is the card's ::after, and attr() reads the pseudo's own element
        for (const card of wrap.querySelectorAll('.card')) ctx.attr(card, 'data-target', target);
      }
      return n;
    }
    function cascade(page, ctx, dirn) {
      const list = listEl(page);
      if (!list || ctx.reduced) return;
      ctx.stagger([...list.children].slice(0, 12), '--ri');
      list.classList.remove('pg-cascade-r', 'pg-cascade-l');
      void list.offsetWidth; // restart (one read, on a folder change only)
      list.classList.add(dirn === 'l' ? 'pg-cascade-l' : 'pg-cascade-r');
      ctx.after(900, () => list.classList.remove('pg-cascade-r', 'pg-cascade-l'));
    }
    let watched = null;
    function watch(page, ctx) {
      const list = listEl(page);
      if (!list || watched === list) return;
      watched = list;
      ctx.observe(list, { childList: true }, () => {
        const n = tagRows(page, ctx);
        if (r && ctx.active()) chosenTag(ctx, n);
      });
    }
    function chosenTag(ctx, n) {
      showTag(ctx, r.chosen, n > 0, n + ' chosen');
      if (ctx.changed('chosen', n) && n) ctx.pop(r.chosen.e, 'pg-pop', 700);
    }
    return {
      mount(page, ctx) {
        r = build(page, ctx);
        setLevel(0);
        if (typeof UI.hubOn === 'function') {
          UI.hubOn('fs.list', (m) => {
            if (!m) return;
            const path = m.path || '';
            const pg = ctx.page;
            if (pg && cwdOf(pg) !== path) return; // an answer for a folder left since
            const prev = lastPath;
            fs = { free: num(m.free), total: num(m.total), items: arr(m.items), path, error: m.error || '' };
            lastPath = path;
            if (!pg || !ctx.active()) return;
            tagRows(pg, ctx);
            if (prev !== null && prev !== path) {
              const depth = (p) => (p ? p.split('/').length : 0);
              cascade(pg, ctx, depth(path) >= depth(prev) ? 'r' : 'l');
            }
            ctx.refresh();
          });
        }
        watch(page, ctx);
      },
      enter(page, ctx) {
        if (!r || !r.h.isConnected) r = build(page, ctx);
        watch(page, ctx);
        // the level rises from empty on switch-in (update, which follows, starts the rise when it has space)
        if (cancelRise) { cancelRise(); cancelRise = null; }
        setLevel(0);
        aim = 0;
        const n = listEl(page);
        if (n && n.children.length) cascade(page, ctx, 'r');
      },
      leave() { if (cancelRise) { cancelRise(); cancelRise = null; } },
      update(s, page, ctx) {
        if (!r || !r.h.isConnected) { r = build(page, ctx); setLevel(level); }
        watch(page, ctx);
        const hub = (s && s.hub) || {};
        const ph = phoneLabel(s, ctx);
        const ready = safe(() => UI.hubReady(s, 'files'), !!hub.files && !!hub.connected);
        const ble = safe(() => UI.onBle(s), false);
        const listNode = listEl(page);
        const loading = !!(listNode && /loading/i.test(window.DuoDeskI18n ? window.DuoDeskI18n.sourceText(listNode.querySelector('.hub-empty')) : ((listNode.querySelector('.hub-empty') || {}).textContent || '')));
        const err = ready && !ble && fs && fs.error ? (page.querySelector('.hub-fs-status') || {}).textContent || fs.error : '';
        const st = !ready ? 'off' : ble ? 'ble' : err ? 'error' : !(fs && fs.total) ? 'loading' : 'ok';
        ctx.attr(r.h, 'data-state', st);
        ctx.cls(r.h, 'loading', loading || st === 'loading');
        setIco(r.glyph, st === 'ble' ? 'bt' : st === 'error' ? 'warn' : 'phone');
        const gb = (v) => (v / 1e9).toFixed(v >= 1e11 ? 0 : 1);
        const hasSpace = st === 'ok';
        const used = hasSpace ? Math.max(0, Math.min(1, 1 - (fs.free || 0) / fs.total)) : 0;
        ctx.text(r.kick, ph);
        if (hasSpace) {
          ctx.text(r.n, gb(fs.free || 0));
          ctx.text(r.unit, 'GB free');
        } else {
          ctx.text(r.n, st === 'ble' ? 'Needs Wi-Fi' : st === 'off' ? 'Not ready' : st === 'error' ? 'Can’t open that' : 'Reading…');
          ctx.text(r.unit, '');
        }
        // the level follows (a short tween; jumps under reduced motion / while paused)
        const target = hasSpace ? used : 0;
        if (Math.abs(target - aim) > 0.002) {
          if (cancelRise) cancelRise();
          const rise = level < 0.002;
          aim = target;
          cancelRise = ctx.tween(level, target, rise ? 1100 : 800, (v) => setLevel(v), { ease: rise ? 'out' : 'inOut' });
        }
        // folder stats, from the open folder's items
        const items = hasSpace ? fs.items : [];
        const dirs = items.filter((x) => x && x.dir).length;
        const files = items.filter((x) => x && !x.dir);
        const size = files.reduce((a, x) => a + (num(x.size) || 0), 0);
        r.stats.hidden = !hasSpace;
        ctx.text(r.sFolders.v, String(dirs));
        ctx.text(r.sFiles.v, String(files.length));
        ctx.text(r.sSize.v, files.length ? ctx.bytes(size) : '–');
        const perm = ctx.get(s, 'hub.perm.files.perm', '');
        const imp = (s && s.files && s.files.importTo) || null;
        ctx.text(r.cap, st === 'off' ? (!hub.connected ? 'Connect ' + ph : perm === 'ask' ? 'Waiting for All files access' : 'Getting ' + ph + ' ready')
          : st === 'ble' ? 'Over Bluetooth · connect with Wi-Fi Direct to browse'
            : st === 'error' ? clip(err, 80)
              : st === 'loading' ? 'Opening Storage'
                : 'of ' + gb(fs.total) + ' GB · ' + pct(used) + '% used · in ' + ((fs.path && fs.path.split('/').pop()) || 'Storage'));
        // import mode
        showTag(ctx, r.imp, !!imp, imp ? (imp.why === 'capture' ? 'Capturing into ' : 'Importing into ') + clip(imp.name, 20) : '');
        // shared folders
        const sh = hub.share || {};
        const pm = !!(sh.phone && sh.phone.mounted);
        const mo = !!(sh.mine && sh.mine.on);
        showTag(ctx, r.lampPhone, !!sh.phone, 'Phone’s folder open');
        showTag(ctx, r.lampMine, !!sh.mine, 'Sharing a folder');
        ctx.cls(r.lampPhone.e, 'on', pm);
        ctx.cls(r.lampMine.e, 'on', mo);
        chosenTag(ctx, tagRows(page, ctx));
      },
    };
  })());

  // ======================================================================
  // Mount — phone ─ connector ─ bay; the drive letter is the figure, the LED the accent
  // ======================================================================
  FX.register('mount', (() => {
    let r = null;
    let lastState = '';
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'shr shr-mount' });
      const handset = ctx.svgRoot('0 0 30 52', 'shr-mt-handset', [
        svg('rect', { class: 'shr-mt-hs-body', x: '1', y: '1', width: '28', height: '50', rx: '6' }),
        svg('circle', { class: 'shr-mt-hs-cam', cx: '15', cy: '5', r: '1' }),
        svg('line', { class: 'shr-mt-hs-home', x1: '11', x2: '19', y1: '46.5', y2: '46.5' }),
      ]);
      const pname = el('div', 'shr-mt-pname');
      const batt = el('div', 'shr-mt-batt');
      const phone = el('div', 'shr-mt-phone', [handset, el('div', 'shr-mt-ptext', [pname, batt])]);
      const conn = el('div', 'shr-mt-conn', [el('i', 'shr-mt-line'), el('i', 'shr-mt-run'), el('i', 'shr-mt-plug'),
        ctx.svgRoot('0 0 24 16', 'shr-mt-wifi', [svg('path', { d: 'M3 6.5a13 13 0 0 1 18 0M6.5 10a8 8 0 0 1 11 0M10 13.5a3 3 0 0 1 4 0' })]),
        el('span', 'shr-mt-adb', 'ADB')]);
      const letter = el('span', 'shr-mt-letter');
      const led = el('i', 'shr-mt-led');
      const bayLbl = el('span', 'shr-mt-baylbl');
      const bay = el('div', 'shr-mt-bay', [el('div', 'shr-mt-slot', [letter, led]), bayLbl]);
      const stage = el('div', 'shr-mt-stage', [phone, conn, bay], { 'aria-hidden': 'true' });
      const spec = (k) => { const v = el('b'); return { e: el('span', 'shr-spec', [el('span', null, k), v]), v }; };
      const cVia = spec('Via');
      const cDrive = spec('Drive');
      const cap = el('div', 'shr-cap');
      const foot = el('div', 'shr-capline', [cap, el('div', 'shr-specs', [cVia.e, cDrive.e])]);
      h.replaceChildren(stage, foot);
      ctx.stagger([phone, conn, bay, foot]);
      return { h, pname, batt, conn, bay, letter, led, bayLbl, cVia, cDrive, cap };
    }
    return {
      mount(page, ctx) { r = build(page, ctx); },
      enter(page, ctx) {
        if (!r || !r.h.isConnected) r = build(page, ctx);
        lastState = ''; // play the lock-in once if it's already mounted
      },
      update(s, page, ctx) {
        if (!r || !r.h.isConnected) { r = build(page, ctx); lastState = ''; }
        const d = (s && s.mount) || {};
        const ph = (s && s.phone) || {};
        const adb = ph.adb || {};
        const info = ph.info || {};
        const ble = safe(() => UI.onBle(s), false);
        const letter = /^[A-Z]:$/.test(d.mounted || '') ? d.mounted : '';
        const adbOff = !!ph.connected && !ph.connected.usb && !d.mounted && (adb.wifi === false || (ph.bridge && ph.bridge.state === 'waitingWifi'));
        const st = !d.on ? 'off' : ble ? 'ble' : d.busy === 'mounting' ? 'mounting' : d.busy === 'unmounting' ? 'unmounting'
          : d.mounted ? 'mounted' : d.message ? 'error' : adbOff ? 'adb' : 'idle';
        const via = ble ? '' : d.via === 'usb' ? 'usb' : d.via === 'wifi' ? 'wifi' : (ph.connected && ph.connected.usb ? 'usb' : '');
        ctx.attr(r.h, 'data-state', st);
        ctx.attr(r.h, 'data-via', via || 'none');
        const name = d.name && d.name !== 'Phone' ? d.name : (s && s.hub && s.hub.name) || (ctx.phone(s) || {}).name || 'Phone';
        ctx.text(r.pname, clip(name, 22));
        const lvl = num(info.battery);
        ctx.text(r.batt, lvl == null ? '' : Math.round(lvl) + '%' + (info.charging ? ' · charging' : ''));
        // Windows: a drive letter; Mac / Linux: a mount path, shown by its last part
        const vol = !letter && typeof d.mounted === 'string' ? clip(d.mounted.split(/[\\/]/).filter(Boolean).pop() || '', 12) : '';
        ctx.text(r.letter, letter || vol || (d.mounted ? '●' : st === 'mounting' || st === 'unmounting' ? '…' : '—'));
        ctx.cls(r.letter, 'long', !letter && !!vol);
        ctx.text(r.bayLbl, ctx.platform === 'mac' ? 'This Mac' : ctx.platform === 'linux' ? 'This computer' : 'This PC');
        ctx.text(r.cVia.v, ble ? '—' : via === 'usb' ? 'USB' : via === 'wifi' ? 'Wireless' : '—');
        ctx.text(r.cDrive.v, letter || (d.mounted ? 'Mounted' : '—'));
        ctx.text(r.cap, st === 'ble' ? 'Needs Wi-Fi · Bluetooth can’t carry a drive' : st === 'error' ? clip(d.message, 90)
          : st === 'adb' ? 'Wireless debugging is off on the phone'
            : st === 'mounting' ? 'Mounting…' : st === 'unmounting' ? 'Unmounting…'
              : st === 'mounted' ? (letter ? 'In ' + (ctx.platform === 'win' ? 'File Explorer' : 'the file manager') + ' as ' + letter : 'In your file manager') + (via === 'usb' ? ', through the cable' : via === 'wifi' ? ', over wireless debugging' : '')
                : 'Ready · Mount puts it in ' + (ctx.platform === 'win' ? 'This PC' : 'the file manager'));
        if (st !== lastState) {
          if (st === 'mounted' && lastState !== 'unmounting') ctx.pop(r.bay, 'shr-lockin', 900);
          lastState = st;
        }
      },
    };
  })());
})();
