// DuoDesk Japanese localization smoke tests (Node.js built-ins only).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness(withGeneral = false) {
  const NODE = { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 };
  let observer;
  class Text {
    constructor(value) { this.nodeType = 3; this.nodeValue = value; this.parentElement = null; }
    get nextSibling() {
      if (!this.parentElement) return null;
      const children = this.parentElement.children;
      return children[children.indexOf(this) + 1] || null;
    }
  }
  class Element {
    constructor(tag = 'div') {
      this.nodeType = 1;
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attrs = new Map();
      this.handlers = {};
      this.classList = { add() {} };
    }
    get firstChild() { return this.children[0] || null; }
    get nextSibling() {
      if (!this.parentElement) return null;
      const siblings = this.parentElement.children;
      return siblings[siblings.indexOf(this) + 1] || null;
    }
    get textContent() {
      return this.children.map(n => n.nodeType === 3 ? n.nodeValue : n.textContent).join('');
    }
    set textContent(value) {
      this.children = [];
      this.appendChild(new Text(value));
    }
    prepend(node) {
      node.parentElement = this;
      this.children.unshift(node);
      return node;
    }
    appendChild(node) {
      node.parentElement = this;
      this.children.push(node);
      return node;
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    hasAttribute(name) { return this.attrs.has(name); }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    matches() { return this.hasAttribute('data-duodesk-no-i18n'); }
    closest() {
      for (let n = this; n; n = n.parentElement) if (n.matches()) return n;
      return null;
    }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    click() { this.handlers.click(); }
  }
  const sidebar = new Element();
  const body = new Element('body');
  body.appendChild(sidebar);
  const state = new Element('span');
  state.appendChild(new Text('Not connected'));
  body.appendChild(state);
  const placeholder = new Element('input');
  placeholder.setAttribute('placeholder', 'Hotspot name');
  body.appendChild(placeholder);
  const general = new Element();
  let localeChoice = null;
  const peer = new Element('span');
  peer.appendChild(new Text('My computer'));
  body.appendChild(peer);

  const document = {
    body,
    documentElement: { lang: 'en' },
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => selector === '#sidebar .identity' ? sidebar
      : selector === '#page-general .page-body' && withGeneral ? general : null
  };
  const store = new Map();
  if (withGeneral) body.appendChild(general);
  const window = {};
  if (withGeneral) window.UI = {
    select(opts, onChange) {
      const el = new Element('select');
      el.value = 'en';
      localeChoice = { el, set: (value) => { el.value = value; },
        choose: (value) => { el.value = value; onChange(value); } };
      return localeChoice;
    },
    row(label, hint, controls) {
      const r = new Element();
      r.appendChild(new Text(label));
      r.appendChild(new Text(hint));
      for (const c of controls) r.appendChild(c);
      return r;
    },
    card(title, rows) {
      const card = new Element();
      card.appendChild(new Text(title));
      for (const r of rows) card.appendChild(r);
      return card;
    }
  };
  const context = {
    window, document, Node: NODE,
    localStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value)
    },
    MutationObserver: class {
      constructor(cb) { observer = cb; }
      observe() {}
    },
    queueMicrotask: (cb) => cb()
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'i18n-ja.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'i18n-ja.js' });
  return { document, window, sidebar, general, choice: () => localeChoice,
    state, placeholder, peer, observe: (mutations) => observer(mutations) };
}

test('Japanese is the initial desktop language', () => {
  const h = harness();
  assert.equal(h.document.documentElement.lang, 'ja');
  assert.equal(h.state.textContent, '未接続');
  assert.equal(h.placeholder.getAttribute('placeholder'), 'ホットスポット名');
  assert.equal(h.peer.textContent, 'My computer');
  assert.equal(h.window.DuoDeskI18n.sourceText(h.state), 'Not connected');
});

test('English toggle restores the original display text', () => {
  const h = harness();
  assert.equal(h.sidebar.children.length, 0, 'No sidebar language button');
  h.window.DuoDeskI18n.setLanguage('en');
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.state.textContent, 'Not connected');
  assert.equal(h.placeholder.getAttribute('placeholder'), 'Hotspot name');
  h.window.DuoDeskI18n.setLanguage('ja');
  assert.equal(h.state.textContent, '未接続');
});

test('Newly rendered status text is translated', () => {
  const h = harness();
  h.state.textContent = 'Connected';
  h.observe([{ type: 'childList', addedNodes: [h.state.children[0]] }]);
  assert.equal(h.state.textContent, '接続済み');
  assert.equal(h.window.DuoDeskI18n.sourceText(h.state), 'Connected');
});

test('General settings provides a persistent Japanese/English selector', () => {
  const h = harness(true);
  assert.equal(h.general.children.length, 1);
  const choice = h.choice();
  assert.ok(choice, 'language selector is installed in General settings');
  assert.equal(choice.el.value, 'ja');
  assert.equal(choice.el.getAttribute('aria-label'), '表示言語 / Display language');
  choice.choose('en');
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.state.textContent, 'Not connected');
  assert.equal(h.sidebar.children.length, 0);
  choice.choose('ja');
  assert.equal(h.document.documentElement.lang, 'ja');
  assert.equal(h.state.textContent, '未接続');
});


test('Aurora feature hover tooltip and accessible description are localized', () => {
  const h = harness();
  const feature = h.document.createElement('button');
  const label = 'Keyboard · off · needs a connected device';
  feature.setAttribute('data-tip', label);
  feature.setAttribute('aria-description', label + ' (opens its page)');
  h.document.body.appendChild(feature);
  h.observe([{ type: 'childList', addedNodes: [feature] }]);

  assert.equal(feature.getAttribute('data-tip'), 'キーボード · オフ · 接続中の端末が必要です');
  assert.equal(feature.getAttribute('aria-description'),
    'キーボード · オフ · 接続中の端末が必要です （設定ページを開きます）');

  h.window.DuoDeskI18n.setLanguage('en');
  assert.equal(feature.getAttribute('data-tip'), label);
  assert.equal(feature.getAttribute('aria-description'), label + ' (opens its page)');

  // A status refresh rewrites the original English attribute, just as AuroraShell does.
  h.window.DuoDeskI18n.setLanguage('ja');
  feature.setAttribute('data-tip', 'Keyboard · on');
  h.observe([{ type: 'attributes', target: feature, attributeName: 'data-tip' }]);
  assert.equal(feature.getAttribute('data-tip'), 'キーボード · オン');
});

test('Dynamic hover hints keep peer names intact', () => {
  const h = harness();
  const tip = 'Apps · connect rion-pc first';
  assert.equal(h.window.DuoDeskI18n.translate(tip),
    'アプリ · 先にrion-pcに接続してください');
  assert.equal(h.window.DuoDeskI18n.translate('Mouse · off · not available now'),
    'マウス · オフ · 現在利用できません');
});


test('Screen sharing controls and app listing are available in Japanese', () => {
  const h = harness(true);
  const tr = h.window.DuoDeskI18n.translate;
  assert.equal(tr('Low, 10 Mbps'), '低画質・10 Mbps');
  assert.equal(tr('Same as the other screen'), '相手の画面と同じ');
  assert.equal(tr('Use apps from the other computer in their own windows.'),
    '相手のパソコンのアプリを個別のウィンドウで使えます。');
  assert.equal(tr('Open rion-pc’s apps on this PC'), 'rion-pcのアプリをthis PCで開く');
  assert.equal(tr('2 open here'), 'このPCで起動中：2個');
  assert.equal(tr('Pin Calculator to Start'), 'Calculatorをスタートにピン留め');
});

test('Localization keeps proper device and app names and has no sidebar switch', () => {
  const h = harness(true);
  const tr = h.window.DuoDeskI18n.translate;
  assert.equal(h.sidebar.children.length, 0);
  assert.equal(tr('See rion-pc in a window on the other computer.'),
    'rion-pcの画面を相手のパソコンのウィンドウに表示します。');
  assert.equal(tr('Photos'), 'Photos');
  h.choice().choose('en');
  assert.equal(h.state.textContent, 'Not connected');
  h.choice().choose('ja');
  assert.equal(h.state.textContent, '未接続');
});


test('Mesh layout instructions are fully localized and reversible', () => {
  const h = harness(true);
  const source = 'Click a device, then a place next to another device to move it there, or another device to swap places. Devices sit side by side, with no empty space between them.';
  const localized = '端末を選択し、別の端末の隣の位置をクリックすると移動します。別の端末をクリックすると位置を入れ替えます。端末は隙間を空けずに配置されます。';
  const note = h.document.createElement('div');
  note.textContent = source;
  h.document.body.appendChild(note);
  h.observe([{ type: 'childList', addedNodes: [note] }]);
  assert.equal(note.textContent, localized);
  assert.equal(h.window.DuoDeskI18n.sourceText(note), source);
  h.choice().choose('en');
  assert.equal(note.textContent, source);
  h.choice().choose('ja');
  assert.equal(note.textContent, localized);
  assert.equal(h.window.DuoDeskI18n.translate('Now click a lit place next to another device to move it there, or another device to swap places.'),
    '光っている移動先をクリックすると配置を変更できます。別の端末をクリックすると位置を入れ替えます。');
});

test('Mesh auto-join settings and mode confirmation are translated', () => {
  const tr = harness().window.DuoDeskI18n.translate;
  assert.equal(tr('Pair with one device and the rest connect to this one by themselves. Devices you pair with can introduce others, without a pairing code'),
    '1台とペアリングすると、ほかの端末も自動的に接続できます。ペアリング済みの端末から別の端末を紹介するときは、ペアリングコードは不要です。');
  assert.equal(tr('Off: this PC neither introduces devices to each other nor accepts an introduction. Pair each device yourself'),
    'オフ：このPCは端末の自動紹介を行わず、ほかの端末からの紹介も受け付けません。各端末を個別にペアリングしてください。');
  assert.equal(tr('Turn on Multi-device?'), '複数端末モードをオンにしますか？');
  assert.equal(tr('encrypted'), '暗号化済み');
});

test('Mesh connectivity warning preserves peer names and connection semantics', () => {
  const tr = harness().window.DuoDeskI18n.translate;
  const source = "DESKTOP-8PAUIFA isn't connected to this PC, so the pointer stops before it and doesn't get to the devices past it. Pair it with this PC, or turn on Join every device automatically.";
  const result = tr(source);
  assert.match(result, /DESKTOP-8PAUIFA/);
  assert.match(result, /ポインターが止まります/);
  assert.match(result, /その先の端末にも移動できません/);
  assert.match(result, /自動参加/);
  assert.ok(!result.includes("isn't connected"));
  assert.equal(tr('rion-pc — Connected'), 'rion-pc — 接続済み');
  assert.equal(tr('rion-pc — Not paired here: not connected to this PC, so the pointer stops before it'),
    'rion-pc — このPCではペアリングされていません：このPCに接続されていないため、そこでポインターが止まります');
});

test('Mesh placement accessibility labels are localized without touching device-name labels', () => {
  const h = harness();
  const place = h.document.createElement('button');
  place.setAttribute('aria-label', 'Move here');
  h.document.body.appendChild(place);
  h.observe([{ type: 'childList', addedNodes: [place] }]);
  assert.equal(place.getAttribute('aria-label'), 'ここへ移動');
  h.window.DuoDeskI18n.setLanguage('en');
  assert.equal(place.getAttribute('aria-label'), 'Move here');
  h.window.DuoDeskI18n.setLanguage('ja');
  assert.equal(place.getAttribute('aria-label'), 'ここへ移動');
  assert.equal(h.window.DuoDeskI18n.translate('rion-pc'), 'rion-pc');
});
