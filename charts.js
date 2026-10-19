// Result charts, drawn as plain HTML so labels stay readable at any width.
// All numbers are from the EMNLP 2026 paper.

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

const axis = () => {
  const a = el('div', 'axis');
  a.append(el('span'), el('div', 'ticks', '<span>0</span><span>50</span><span>100</span>'), el('span'));
  return a;
};

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
  ['Viewport', [['Scroll-based Exploration', 93.3, 86.2, 15.0]]],
  ['Multi-State', [
    ['Visual Disambiguation', 100.0, 86.5, 22.5],
    ['Hidden State Activation', 95.6, 87.5, 26.0],
    ['Removable Occlusion', 88.9, 98.1, 56.6],
  ]],
  ['Temporal & Manipulation', [
    ['Delayed State Activation', 97.8, 95.7, 95.7],
    ['Dynamic Target Interaction', 97.8, 37.9, 25.9],
    ['Movable Occlusion', 88.9, 40.0, 1.7],
  ]],
];
const gapEl = document.getElementById('gap');
for (const [group, rows] of gap) {
  gapEl.append(el('div', 'group', group));
  for (const [name, h, g, q] of rows) {
    const row = el('div', 'row');
    const track = el('div', 'track');
    const lo = Math.min(h, g, q), hi = Math.max(h, g, q);
    const span = el('i', 'span');
    span.style.left = `${lo}%`;
    span.style.width = `${hi - lo}%`;
    track.append(span);
    for (const [cls, label, v] of [['human', 'Human', h], ['gpt', 'GPT-5.5', g], ['qwen', 'Qwen3-VL', q]]) {
      const d = el('i', `mk ${cls}`);
      d.style.left = `${v}%`;
      d.dataset.tip = `<b>${name}</b><br>${label}: ${v.toFixed(1)}%`;
      track.append(d);
    }
    row.append(el('span', 'label', name), track, el('span'));
    gapEl.append(row);
  }
}
gapEl.append(axis());

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
  const ref = el('i', 'ref');
  ref.style.left = '79.4%';
  track.append(bar, ref);
  row.append(el('span', 'label', name), track, el('span', 'val', v.toFixed(1)));
  intEl.append(row);
}
const refRow = el('div', 'row ref-label');
const refTrack = el('div', 'track');
const refText = el('span', 'ref-text', 'GPT-5.5, full task: 79.4');
refText.style.left = '79.4%';
refTrack.append(refText);
refRow.append(el('span'), refTrack, el('span'));
intEl.append(refRow, axis());

// ---------- 3. omitted reveal actions in failed runs ----------
const omit = [
  ['DRAG needed', 59, 59],
  ['SCROLL needed', 207, 247],
  ['MOVE needed', 71, 96],
];
const omitEl = document.getElementById('omit');
for (const [name, k, n] of omit) {
  const v = (100 * k) / n;
  const row = el('div', 'row');
  const track = el('div', 'track');
  const bar = el('i', 'bar neutral');
  bar.style.width = `${v}%`;
  bar.dataset.tip = `<b>${name}</b><br>action never tried in ${k} of ${n} failed runs`;
  track.append(bar);
  row.append(el('span', 'label', name), track, el('span', 'val', `${k}/${n}`));
  omitEl.append(row);
}
omitEl.append(axis());

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
  const line = el('i', 'span gain');
  line.style.left = `${a}%`;
  line.style.width = `${b - a}%`;
  const d0 = el('i', 'mk base');
  d0.style.left = `${a}%`;
  d0.dataset.tip = `<b>${name}</b><br>Base: ${a.toFixed(1)}%`;
  const d1 = el('i', 'mk trained');
  d1.style.left = `${b}%`;
  d1.dataset.tip = `<b>${name}</b><br>SFT + GRPO: ${b.toFixed(1)}%`;
  track.append(line, d0, d1);
  row.append(el('span', 'label', name), track, el('span', 'val', `+${(b - a).toFixed(1)}`));
  trainEl.append(row);
}
trainEl.append(axis());
