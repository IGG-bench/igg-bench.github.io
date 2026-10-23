(() => {
  'use strict';
  const root = document.querySelector('.playground');
  if (!root) return;
  const stage = document.getElementById('play-stage');
  const feedback = document.getElementById('play-feedback');
  const hint = document.getElementById('play-hint-text');
  const picker = [...document.querySelectorAll('[data-challenge]')];
  const solved = new Set();
  const challenges = {
    scroll: {
      instruction: 'Open “Weekend plans.pdf”.',
      hint: 'Scroll inside the file list. The file you need is further down.',
      success: 'Found it! Scrolling brought an off-screen target into view.'
    },
    hover: {
      instruction: 'Save “Slow Sunday” to your library.',
      hint: 'Hover over “Slow Sunday” to reveal its controls. On a touchscreen, tap the row; with a keyboard, focus it with Tab.',
      success: 'Saved! Moving onto the row revealed a hidden control.'
    },
    drag: {
      instruction: 'Click the green “Publish” button.',
      hint: 'Drag the sticky note out of the way. You can also focus the note and use the arrow keys.',
      success: 'Published! Moving the note uncovered the target underneath.'
    },
    wait: {
      instruction: 'Download the exported file.',
      hint: 'Start the export, then wait for the Download button to become available.',
      success: 'Downloaded! Waiting made the target actionable.'
    }
  };
  let current = 'scroll';
  let cleanup = () => {};
  let completed = false;

  const bar = label => `<div class="toy-bar"><span class="toy-dots" aria-hidden="true">● ● ●</span>${label}</div>`;

  function solve() {
    if (completed) return;
    completed = true;
    solved.add(current);
    feedback.textContent = challenges[current].success;
    feedback.classList.add('success');
    document.getElementById('play-progress').textContent = `${solved.size} / 4 solved`;
    picker.forEach(button => button.classList.toggle('solved', solved.has(button.dataset.challenge)));
    document.getElementById('play-complete').hidden = solved.size !== 4;
  }

  function renderScroll() {
    const names = ['Meeting notes.pdf', 'Reading list.pdf', 'Travel ideas.pdf', 'Project brief.pdf', 'Packing list.pdf', 'Weekend plans.pdf', 'Recipes.pdf'];
    stage.innerHTML = bar('Files / Personal') + '<div class="toy-scroll" tabindex="0" role="region" aria-label="Scrollable file list"><div class="toy-files-heading">NAME</div>' + names.map(name => `<button type="button" class="toy-file" data-file="${name}"><span class="toy-file-icon" aria-hidden="true">PDF</span><span>${name}<small>Personal document</small></span></button>`).join('') + '</div>';
    stage.querySelectorAll('[data-file]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.file === 'Weekend plans.pdf') solve();
      else if (!completed) feedback.textContent = 'That is another file. Keep looking for “Weekend plans.pdf”.';
    }));
  }

  function renderHover() {
    stage.innerHTML = bar('Music / Your library') + '<div class="toy-library"><div class="toy-library-title">MADE FOR A QUIET AFTERNOON</div>' + ['Slow Sunday', 'Blue Hour'].map(name => `<div class="toy-track" tabindex="0" aria-label="${name}, reveal track controls"><span class="toy-album" aria-hidden="true">♫</span><span class="toy-track-name">${name}<small>Daylight Sessions</small></span><button type="button" class="toy-save" aria-label="Save ${name}">+ Save</button></div>`).join('') + '</div>';
    stage.querySelectorAll('.toy-track').forEach((row, index) => {
      row.addEventListener('click', () => row.classList.add('revealed'));
      row.querySelector('button').addEventListener('click', event => {
        event.stopPropagation();
        if (index === 0) { solve(); event.currentTarget.textContent = '✓ Saved'; row.classList.add('revealed'); }
        else if (!completed) feedback.textContent = 'Try the controls on “Slow Sunday”.';
      });
    });
  }

  function renderDrag() {
    stage.innerHTML = bar('Canvas / Project board') + '<div class="toy-canvas"><span class="toy-canvas-label">READY TO SHARE</span></div><button type="button" class="toy-target" tabindex="-1" aria-hidden="true">Publish</button><div class="toy-cover" tabindex="0" role="button" aria-label="Movable sticky note. Drag, or use arrow keys, to move it."><span class="toy-grip" aria-hidden="true">⠿</span><strong>A little note to self</strong><span>Everything is ready to go.<br>Just one last click…</span></div>';
    const cover = stage.querySelector('.toy-cover');
    const target = stage.querySelector('.toy-target');
    let x = (stage.clientWidth - cover.offsetWidth) / 2;
    let y = 116;
    let pointer = null;
    const position = () => {
      x = Math.max(8, Math.min(x, stage.clientWidth - cover.offsetWidth - 8));
      y = Math.max(48, Math.min(y, stage.clientHeight - cover.offsetHeight - 8));
      cover.style.transform = `translate(${x}px, ${y}px)`;
      const a = cover.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const clear = a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
      target.tabIndex = clear ? 0 : -1;
      target.setAttribute('aria-hidden', String(!clear));
      target.disabled = !clear;
    };
    cover.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: x, top: y };
      cover.setPointerCapture(event.pointerId);
      cover.classList.add('dragging');
      cover.focus({ preventScroll: true });
    });
    cover.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      x = pointer.left + event.clientX - pointer.x;
      y = pointer.top + event.clientY - pointer.y;
      position();
    });
    const endDrag = () => { pointer = null; cover.classList.remove('dragging'); };
    cover.addEventListener('pointerup', endDrag);
    cover.addEventListener('pointercancel', endDrag);
    cover.addEventListener('lostpointercapture', endDrag);
    cover.addEventListener('keydown', event => {
      const moves = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] };
      if (!moves[event.key]) return;
      event.preventDefault();
      x += moves[event.key][0]; y += moves[event.key][1]; position();
    });
    target.addEventListener('click', solve);
    const resize = new ResizeObserver(position);
    resize.observe(stage);
    cleanup = () => resize.disconnect();
    position();
  }

  function renderWait() {
    stage.innerHTML = bar('Export / Weekend plans') + '<div class="toy-export"><p id="toy-export-status">Your file is ready to export.</p><progress max="100" value="0" aria-label="Export progress"></progress><button type="button" id="toy-export-button">Start export</button></div>';
    const button = stage.querySelector('button');
    const status = stage.querySelector('#toy-export-status');
    const progress = stage.querySelector('progress');
    let timer;
    let ready = false;
    button.addEventListener('click', () => {
      if (ready) { solve(); button.textContent = '✓ Done'; return; }
      button.disabled = true;
      button.textContent = 'Preparing…';
      status.textContent = 'Exporting your document…';
      const started = performance.now();
      timer = setInterval(() => {
        progress.value = Math.min(100, (performance.now() - started) / 40);
        if (progress.value < 100) return;
        clearInterval(timer);
        ready = true;
        status.textContent = 'Your export is ready.';
        button.disabled = false;
        button.textContent = 'Download';
        feedback.textContent = 'The export is ready. You can finish the task now.';
      }, 100);
    });
    cleanup = () => clearInterval(timer);
  }

  function select(name) {
    cleanup(); cleanup = () => {};
    current = name; completed = false;
    feedback.textContent = 'The target is hiding somewhere.';
    feedback.classList.remove('success');
    hint.hidden = true;
    document.getElementById('play-hint').textContent = 'Need a hint?';
    document.getElementById('play-hint').setAttribute('aria-expanded', 'false');
    document.getElementById('play-instruction').textContent = challenges[name].instruction;
    picker.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.challenge === name)));
    ({ scroll: renderScroll, hover: renderHover, drag: renderDrag, wait: renderWait })[name]();
  }

  picker.forEach(button => button.addEventListener('click', () => select(button.dataset.challenge)));
  document.getElementById('play-reset').addEventListener('click', () => select(current));
  document.getElementById('play-next').addEventListener('click', () => {
    const keys = Object.keys(challenges);
    select(keys[(keys.indexOf(current) + 1) % keys.length]);
  });
  const hintButton = document.getElementById('play-hint');
  hintButton.setAttribute('aria-controls', 'play-hint-text');
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
    hint.textContent = challenges[current].hint;
    hintButton.textContent = hint.hidden ? 'Need a hint?' : 'Hide hint';
    hintButton.setAttribute('aria-expanded', String(!hint.hidden));
  });
  root.hidden = false;
  select(current);
})();
