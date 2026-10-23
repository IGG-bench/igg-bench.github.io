import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../static/js/playground.js', import.meta.url), 'utf8');
const entries = ['Ella', 'GU', 'daisydaisy'].map((nickname, index) => ({
  id: `run-${index}`, nickname, ga: 1, tt_ms: 5000, published_at: 1720000000000,
}));
const board = (rows = entries) => ({ok: true, status: 200, json: async () => ({protocol: 'igg-fun-v2', entries: rows, total: rows.length})});
const unavailable = () => ({ok: false, status: 503, json: async () => ({error: 'Leaderboard unavailable. Try again.'})});
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

class Element {
  constructor() {
    this.listeners = new Map(); this.children = []; this.dataset = {}; this.style = {};
    this.classList = {add() {}, remove() {}, toggle() {}};
    this.clientWidth = 880; this.textContent = ''; this.value = 'Local test';
    this.contentWindow = {postMessage() {}};
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  async dispatch(type, event = {}) {
    await Promise.all((this.listeners.get(type) || []).map(listener => listener({preventDefault() {}, ...event})));
    await settle();
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  querySelector() { return new Element(); }
  scrollIntoView() {}
  focus() {}
}

async function setup(responses = [() => board()]) {
  let now = 0, nextTimer = 1, reads = 0;
  const timers = new Map(), elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const document = Object.assign(new Element(), {
    visibilityState: 'visible', getElementById: get,
    querySelector: () => get('root'), querySelectorAll: () => [], createElement: () => new Element(),
  });
  const window = new Element(), navigator = {onLine: true};
  const schedule = (fn, delay, interval = false) => {
    const id = nextTimer++; timers.set(id, {fn, at: now + delay, interval: interval ? delay : 0}); return id;
  };
  const tasks = ['scroll', 'hover', 'drag', 'wait'].map(kind => ({
    id: kind, kind, instruction: kind, app: 'test', appName: 'Test', state_id: kind,
  }));
  const context = vm.createContext({
    document, window, navigator, location: {hostname: 'igg-bench.github.io', origin: 'https://igg-bench.github.io'},
    localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
    AbortController, TypeError, performance: {now: () => now},
    Date: class extends Date { static now() { return now; } },
    ResizeObserver: class { observe() {} },
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true), clearInterval: id => timers.delete(id),
    fetch: async (url, options = {}) => {
      if (url.includes('/api/leaderboard')) {
        reads++;
        return (responses.shift() || (() => board()))();
      }
      if (url.startsWith('static/')) return {ok: true, json: async () => tasks};
      // Recorded-run checks use this in-memory stub; no request leaves this process.
      if (url.endsWith('/api/runs') && options.method === 'POST') {
        return {ok: true, json: async () => ({id: 'local-run', token: 'local-token', protocol: 'igg-fun-v2'})};
      }
      if (url.endsWith('/start')) return {ok: true, json: async () => ({ready: true})};
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  await vm.runInContext(source, context);
  await settle();
  return {
    document, window, navigator, get, responses,
    get reads() { return reads; },
    get names() { return get('human-rows').children.map(row => row.children[1].textContent); },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next; now = timer.at;
        if (timer.interval) timer.at += timer.interval; else timers.delete(id);
        timer.fn(); await settle();
      }
      now = end; await settle();
    },
  };
}

test('an empty open board gains new entries without a manual refresh', async () => {
  const page = await setup([() => board([]), () => board()]);
  assert.equal(page.get('board-status').textContent, 'Be the first to play.');
  await page.advance(30000);
  assert.deepEqual(page.names, ['Ella', 'GU', 'daisydaisy']);
  assert.equal(page.get('board-status').textContent, '');
});

test('returning to a tab refreshes once despite visibility and focus events', async () => {
  const page = await setup([() => board([]), () => board()]);
  page.document.visibilityState = 'hidden';
  await page.advance(30000);
  assert.equal(page.reads, 1);
  page.document.visibilityState = 'visible';
  await page.document.dispatch('visibilitychange');
  await page.window.dispatch('focus');
  await page.window.dispatch('focus');
  assert.equal(page.reads, 2);
  assert.equal(page.names.length, 3);
});

test('offline polling is skipped and reconnect refreshes immediately', async () => {
  const page = await setup([() => board([]), () => board()]);
  page.navigator.onLine = false;
  await page.advance(30000);
  assert.equal(page.reads, 1);
  page.navigator.onLine = true;
  await page.window.dispatch('online');
  assert.equal(page.reads, 2);
  assert.equal(page.names.length, 3);
});

test('transient initial failure retries successfully without calling an empty board', async () => {
  const page = await setup([unavailable, () => board()]);
  assert.match(page.get('board-status').textContent, /unavailable/);
  assert.notEqual(page.get('board-status').textContent, 'Be the first to play.');
  await page.advance(2000);
  assert.equal(page.reads, 2);
  assert.equal(page.names.length, 3);
});

test('quick retries are bounded to three after a transient failure', async () => {
  const page = await setup(Array.from({length: 10}, () => unavailable));
  await page.advance(29000);
  assert.equal(page.reads, 4);
  assert.match(page.get('board-status').textContent, /unavailable/);
});

test('background reads stay quiet, do not overlap, and preserve rows on failure', async () => {
  let respond;
  const page = await setup([() => board(), () => new Promise(resolve => { respond = resolve; })]);
  await page.advance(30000);
  assert.equal(page.get('board-status').textContent, '');
  await page.window.dispatch('focus');
  await page.window.dispatch('online');
  await page.document.dispatch('visibilitychange');
  assert.equal(page.reads, 2);
  respond(unavailable()); await settle();
  assert.deepEqual(page.names, ['Ella', 'GU', 'daisydaisy']);
  assert.match(page.get('board-status').textContent, /unavailable/);
});

test('manual refresh wins over an older pending automatic response', async () => {
  let respond;
  const page = await setup([() => board([]), () => new Promise(resolve => { respond = resolve; }), () => board()]);
  await page.advance(30000);
  await page.get('refresh-board').dispatch('click');
  respond(board([])); await settle();
  assert.deepEqual(page.names, ['Ella', 'GU', 'daisydaisy']);
  assert.equal(page.get('refresh-board').disabled, false);
});

test('unchanged background results preserve existing row controls', async () => {
  const page = await setup();
  const firstRow = page.get('human-rows').children[0];
  await page.advance(30000);
  assert.equal(page.reads, 2);
  assert.equal(page.get('human-rows').children[0], firstRow);
});

test('automatic refresh pauses during a recorded run while manual refresh still works', async () => {
  const page = await setup();
  await page.get('ranked-start').dispatch('submit');
  assert.equal(page.get('play-mode').textContent, 'Leaderboard mode');
  await page.advance(60000);
  await page.window.dispatch('focus');
  await page.window.dispatch('online');
  assert.equal(page.reads, 1);
  await page.get('refresh-board').dispatch('click');
  assert.equal(page.reads, 2);
});
