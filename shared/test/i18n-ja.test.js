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
  const toggle = h.sidebar.children[0];
  assert.equal(toggle.textContent, 'EN');
  toggle.click();
  assert.equal(h.document.documentElement.lang, 'en');
  assert.equal(h.state.textContent, 'Not connected');
  assert.equal(h.placeholder.getAttribute('placeholder'), 'Hotspot name');
  assert.equal(toggle.textContent, '日本語');
  toggle.click();
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
  assert.equal(h.sidebar.children[0].textContent, '日本語');
  choice.choose('ja');
  assert.equal(h.document.documentElement.lang, 'ja');
  assert.equal(h.state.textContent, '未接続');
});
