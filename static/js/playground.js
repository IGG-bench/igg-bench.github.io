(async () => {
  'use strict';
  const root = document.querySelector('.playground');
  if (!root) return;
  const stage = document.getElementById('play-stage');
  const feedback = document.getElementById('play-feedback');
  const hint = document.getElementById('play-hint-text');
  const hintButton = document.getElementById('play-hint');
  const enlargeButton = document.getElementById('play-enlarge');
  const picker = [...document.querySelectorAll('[data-challenge]')];
  const solved = new Set();
  const descriptions = {
    scroll: { hint: 'Scroll down inside the Pagely page to the Linked resources section, then open Sprint Retrospective.', success: 'Found it! Scrolling brought the linked page into view.' },
    hover: { hint: 'Move over the Midnight Pulse row in Wavr. Its heart control appears on the right.', success: 'Saved! Hovering revealed the heart control.' },
    drag: { hint: 'In the Figma canvas, drag the sticky note covering QA Checklist out of the way, then click QA Checklist. Keep all notes on the canvas.', success: 'Found it! Moving the covering note revealed QA Checklist.' },
    wait: { hint: 'Wait a few seconds for syncing to finish, then click Sync complete in the top bar of Pagely.', success: 'Done! Waiting made Sync complete available.' }
  };
  let tasks;
  let current;
  let frame;
  let canvas;
  let handshake;
  let deadline;
  let round = 0;
  let complete = false;
  let initialNoteCount = null;
  let invalidDrag = false;
  let enlarged = false;
  root.hidden = false;
  stage.innerHTML = '<p class="play-loading">Loading the IGG examples…</p>';
  try {
    const response = await fetch('static/mockup-tasks.json');
    if (!response.ok) throw new Error('Task list unavailable');
    tasks = await response.json();
  } catch {
    stage.innerHTML = '<p class="play-loading">The examples could not load. Please refresh the page to try again.</p>';
    feedback.textContent = 'Unable to load the examples.';
    return;
  }

  function resize() {
    if (!frame || !canvas) return;
    const scale = enlarged ? 1 : stage.clientWidth / 1440;
    frame.style.transform = `scale(${scale})`;
    canvas.style.width = `${1440 * scale}px`;
    canvas.style.height = `${900 * scale}px`;
  }
  new ResizeObserver(resize).observe(stage);

  function finish() {
    if (complete) return;
    complete = true;
    solved.add(current.kind);
    feedback.textContent = descriptions[current.kind].success;
    feedback.classList.add('success');
    document.getElementById('play-progress').textContent = `${solved.size} / ${tasks.length} solved`;
    picker.forEach(button => button.classList.toggle('solved', solved.has(button.dataset.challenge)));
    document.getElementById('play-complete').hidden = solved.size !== tasks.length;
  }

  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type !== 'igg-review-observed-action') return;
    clearInterval(handshake);
    clearTimeout(deadline);
    const detail = event.data.detail;
    if (!detail) return;
    if (feedback.dataset.loading === 'true') {
      feedback.dataset.loading = 'false';
      feedback.textContent = 'Ready. Find the target in the interface above.';
    }
    if (current.kind === 'drag') {
      const count = event.data.runtimeState?.noteCount;
      if (Number.isInteger(count)) {
        if (initialNoteCount === null) initialNoteCount = count;
        if (count < initialNoteCount) invalidDrag = true;
      }
    }
    if (complete || detail.type !== 'click' || detail.observedTargetId !== current.target_id || detail.targetActionable !== true) return;
    if (invalidDrag) {
      feedback.textContent = 'A note was deleted. Choose Try again, then move the covering note without deleting it.';
      return;
    }
    finish();
  });

  function select(kind) {
    clearInterval(handshake);
    clearTimeout(deadline);
    current = tasks.find(task => task.kind === kind);
    complete = false;
    initialNoteCount = null;
    invalidDrag = false;
    feedback.dataset.loading = 'true';
    feedback.textContent = 'Loading the original mockup…';
    feedback.classList.remove('success');
    hint.hidden = true;
    hintButton.textContent = 'Need a hint?';
    hintButton.setAttribute('aria-expanded', 'false');
    document.getElementById('play-instruction').textContent = current.instruction;
    document.getElementById('play-app-name').textContent = `${current.appName} · ${current.reference}-inspired IGG environment`;
    picker.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.challenge === kind)));
    frame = document.createElement('iframe');
    frame.title = `${current.appName}: ${current.instruction}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = `static/mockups/${current.app}/?stateId=${encodeURIComponent(current.state_id)}&round=${++round}`;
    canvas = document.createElement('div');
    canvas.className = 'mockup-canvas';
    canvas.append(frame);
    stage.replaceChildren(canvas);
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    resize();
    const thisFrame = frame;
    frame.addEventListener('load', () => {
      if (thisFrame !== frame) return;
      const enable = () => thisFrame.contentWindow?.postMessage({ type: 'igg-review-capture', enabled: true }, location.origin);
      enable();
      handshake = setInterval(enable, 250);
      deadline = setTimeout(() => {
        clearInterval(handshake);
        feedback.dataset.loading = 'false';
        feedback.textContent = 'The mockup is taking longer to load. Choose Try again to reload it.';
      }, 15000);
    });
  }

  picker.forEach(button => button.addEventListener('click', () => select(button.dataset.challenge)));
  document.getElementById('play-reset').addEventListener('click', () => select(current.kind));
  document.getElementById('play-next').addEventListener('click', () => select(tasks[(tasks.indexOf(current) + 1) % tasks.length].kind));
  hintButton.setAttribute('aria-controls', 'play-hint-text');
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden;
    hint.textContent = descriptions[current.kind].hint;
    hintButton.textContent = hint.hidden ? 'Need a hint?' : 'Hide hint';
    hintButton.setAttribute('aria-expanded', String(!hint.hidden));
  });
  enlargeButton.addEventListener('click', () => {
    enlarged = !enlarged;
    stage.classList.toggle('is-enlarged', enlarged);
    enlargeButton.setAttribute('aria-pressed', String(enlarged));
    enlargeButton.textContent = enlarged ? 'Fit to page' : 'Enlarge view';
    resize();
  });
  select('scroll');
})();
