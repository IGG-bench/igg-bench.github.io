// Result charts, drawn as plain HTML so labels stay readable at any width.
// All numbers are from the EMNLP 2026 paper.

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

const axis = (title) => {
  const a = el('div', 'axis');
  a.append(el('span'), el('div', 'ticks', '<span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>'), el('span'));
  if (title) {
    const t = el('div', 'axis-title');
    t.append(el('span'), el('span', '', title), el('span'));
    return [a, t];
  }
  return [a];
};

const at = (node, v) => { node.style.left = `${v}%`; return node; };

// ---------- tooltip ----------
const tip = el('div', 'tip');
document.body.append(tip);
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tip.style.opacity = 0; return; }
  tip.innerHTML = t.dataset.tip;
  const r = t.getBoundingClientRect();
  tip.style.opacity = 1;
  tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
  tip.style.top = `${r.top + window.scrollY - tip.offsetHeight - 8}px`;
});

// ---------- 1. human-model gap (dot plot) ----------
const gap = [
  ['Viewport', 'vp', [['Scroll-based Exploration', 93.3, 86.2, 15.0]]],
  ['Multi-State', 'ms', [
    ['Visual Disambiguation', 100.0, 86.5, 22.5],
    ['Hidden State Activation', 95.6, 87.5, 26.0],
    ['Removable Occlusion', 88.9, 98.1, 56.6],
  ]],
  ['Temporal & Manipulation', 'tm', [
    ['Delayed State Activation', 97.8, 95.7, 95.7],
    ['Dynamic Target Interaction', 97.8, 37.9, 25.9],
    ['Movable Occlusion', 88.9, 40.0, 1.7],
  ]],
];
const gapEl = document.getElementById('gap');
for (const [group, key, rows] of gap) {
  const g = el('div', `group ${key}`);
  g.append(el('span'), el('span', '', group), el('span'));
  gapEl.append(g);
  for (const [name, h, gp, q] of rows) {
    const row = el('div', 'row');
    const track = el('div', 'track');
    const lo = Math.min(h, gp, q), hi = Math.max(h, gp, q);
    const span = at(el('i', 'span'), lo);
    span.style.width = `${hi - lo}%`;
    track.append(span);
    for (const [cls, label, v] of [['human', 'Human', h], ['gpt', 'GPT-5.5', gp], ['qwen', 'Qwen3-VL', q]]) {
      const d = at(el('i', `mk ${cls}`), v);
      d.dataset.tip = `<b>${name}</b><br>${label}: ${v.toFixed(1)}%`;
      track.append(d);
    }
    // Qwen3-VL value printed next to its dot: it is the number the text is about.
    const qv = at(el('span', 'dot-val'), q);
    qv.textContent = q.toFixed(1);
    if (q > 85) qv.classList.add('left');
    track.append(qv);
    row.append(el('span', 'label', name), track, el('span'));
    gapEl.append(row);
  }
}
gapEl.append(...axis('Grounding accuracy (%)'));

// ---------- 2. interventions (bars + GPT-5.5 reference) ----------
const intervene = [
  ['Full task', 30.8],
  ['Interaction specified', 33.9],
  ['Reveal performed', 81.9],
];
const intEl = document.getElementById('intervene');
for (const [name, v] of intervene) {
  const row = el('div', 'row');
  const track = el('div', 'track');
  const bar = el('i', 'bar qwen');
  bar.style.width = `${v}%`;
  bar.dataset.tip = `<b>Qwen3-VL, ${name.toLowerCase()}</b><br>${v.toFixed(1)}% GA`;
  const val = at(el('span', 'bar-val', v.toFixed(1)), v);
  if (v > 70) val.classList.add('inside');
  track.append(bar, at(el('i', 'ref'), 79.4), val);
  row.append(el('span', 'label', name), track, el('span'));
  intEl.append(row);
}
const refRow = el('div', 'row ref-label');
const refTrack = el('div', 'track');
refTrack.append(at(el('span', 'ref-text', 'GPT-5.5 on the full task: 79.4'), 79.4));
refRow.append(el('span'), refTrack, el('span'));
intEl.append(refRow, ...axis('Qwen3-VL grounding accuracy (%)'));

// ---------- 3. omitted reveal actions in failed runs ----------
const omit = [
  ['Needs DRAG', 59, 59],
  ['Needs SCROLL', 207, 247],
  ['Needs MOVE', 71, 96],
];
const omitEl = document.getElementById('omit');
for (const [name, k, n] of omit) {
  const v = (100 * k) / n;
  const row = el('div', 'row');
  const track = el('div', 'track');
  const bar = el('i', 'bar neutral');
  bar.style.width = `${v}%`;
  bar.dataset.tip = `<b>${name}</b><br>action never tried in ${k} of ${n} failed runs`;
  track.append(bar, at(el('span', 'bar-val inside', `${v.toFixed(0)}%`), v));
  row.append(el('span', 'label', name), track, el('span', 'val', `${k}/${n}`));
  omitEl.append(row);
}
omitEl.append(...axis('Failed runs that never try the needed action (%)'));

// ---------- 4. training (dumbbell) ----------
const train = [
  ['Qwen3-VL-8B', 40.0, 59.2],
  ['InternVL3.5-8B', 28.3, 47.5],
  ['GUI-Owl-1.5-8B', 35.0, 52.5],
];
const trainEl = document.getElementById('train');
for (const [name, a, b] of train) {
  const row = el('div', 'row');
  const track = el('div', 'track');
  const line = at(el('i', 'span gain'), a);
  line.style.width = `${b - a}%`;
  const d0 = at(el('i', 'mk base'), a);
  d0.dataset.tip = `<b>${name}</b><br>Base: ${a.toFixed(1)}%`;
  const d1 = at(el('i', 'mk trained'), b);
  d1.dataset.tip = `<b>${name}</b><br>SFT + GRPO: ${b.toFixed(1)}%`;
  track.append(line, d0, d1,
    at(el('span', 'dot-val left muted-val', a.toFixed(1)), a),
    at(el('span', 'dot-val strong', b.toFixed(1)), b));
  row.append(el('span', 'label', name), track, el('span', 'val gain-val', `+${(b - a).toFixed(1)}`));
  trainEl.append(row);
}
trainEl.append(...axis('Grounding accuracy on 120 held-out tasks (%)'));
