(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.querySelector('.playground');
  if (!root) return;
  const API = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:8789' : 'https://igg-human-leaderboard.kaist-ami-lab.chatgpt.site';
  const LIMIT = 60000;
  const PROTOCOL = 'igg-fun-v1';
  const stage = $('play-stage'), feedback = $('play-feedback'), hint = $('play-hint-text');
  const hintButton = $('play-hint'), enlargeButton = $('play-enlarge'), nextButton = $('play-next');
  const picker = [...document.querySelectorAll('[data-challenge]')];
  const solved = new Set();
  const descriptions = {
    scroll: { hint: 'Scroll down inside the Pagely page to the Linked resources section, then open Sprint Retrospective.', success: 'Page found!' },
    hover: { hint: 'Move over the Midnight Pulse row in Wavr. Its heart control appears on the right.', success: 'Heart clicked!' },
    drag: { hint: 'In the Figma canvas, drag the sticky note covering QA Checklist out of the way, then click QA Checklist. Keep all notes on the canvas.', success: 'QA Checklist found!' },
    wait: { hint: 'Wait a few seconds for syncing to finish, then click Sync complete in the top bar of Pagely.', success: 'Sync complete!' }
  };
  let tasks, current, frame, canvas, handshake, deadline, timer, startedAt;
  let round = 0, complete = false, initialNoteCount = null, invalidDrag = false, enlarged = false;
  let run = null, results = [], pending = null, saving = false, generation = 0;
  let owned = [];
  try { owned = JSON.parse(localStorage.getItem('igg-human-owned') || '[]'); if (!Array.isArray(owned)) owned = []; } catch {}
  const saveOwned = () => { try { localStorage.setItem('igg-human-owned', JSON.stringify(owned)); } catch {} };
  const pendingStorage = value => { try { if (value) localStorage.setItem('igg-human-pending', JSON.stringify(value)); else localStorage.removeItem('igg-human-pending'); } catch {} };

  async function api(path, options = {}, credentials = run) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API}${path}`, {
        ...options, signal: controller.signal,
        headers: { ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(credentials ? {Authorization: `Bearer ${credentials.token}`} : {}) },
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('The score service is unavailable. Please try again.'); }
      if (!response.ok) { const error = new Error(data.error || 'Unable to reach the score service.'); error.status = response.status; throw error; }
      return data;
    } finally { clearTimeout(timeout); }
  }

  async function refreshBoard() {
    $('refresh-board').disabled = true;
    $('remove-my-records').hidden = !owned.length;
    $('remove-my-records').disabled = Boolean(run);
    $('board-status').textContent = 'Loading records…';
    try {
      const data = await api('/api/leaderboard', {}, null);
      if (data.protocol !== PROTOCOL) throw new Error('This challenge has changed. Refresh the page.');
      $('human-rows').replaceChildren();
      data.entries.forEach((entry, index) => {
        const tr = document.createElement('tr');
        const owner = owned.find(item => item.id === entry.id);
        tr.classList.toggle('is-own', Boolean(owner));
        for (const value of [index + 1, entry.nickname, `${Math.round(entry.ga * 100)}%`, `${(entry.tt_ms / 1000).toFixed(2)}s`, new Date(entry.published_at).toLocaleDateString()]) {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        }
        const actions = document.createElement('td');
        if (owner) {
          const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove your run by ${entry.nickname}`);
          remove.addEventListener('click', async () => {
            remove.disabled = true;
            try {
              await api(`/api/runs/${owner.id}`, {method: 'DELETE'}, owner);
              owned = owned.filter(item => item.id !== owner.id); saveOwned(); await refreshBoard();
            } catch (error) { $('board-status').textContent = error.message; remove.disabled = false; }
          });
          actions.append(remove);
        }
        tr.append(actions); $('human-rows').append(tr);
      });
      $('board-status').textContent = data.total ? `${data.total} completed ${data.total === 1 ? 'run' : 'runs'} · showing ${data.entries.length}` : 'No runs yet. Take the first turn.';
    } catch (error) { $('board-status').textContent = `${error.message} Use Refresh to try again.`; }
    finally { $('refresh-board').disabled = false; }
  }
  $('remove-my-records').addEventListener('click', async () => {
    if (run) return;
    $('remove-my-records').disabled = true; $('remove-status').textContent = 'Removing your saved records…';
    let failed = 0;
    for (const owner of [...owned]) {
      try { await api(`/api/runs/${owner.id}`, {method: 'DELETE'}, owner); }
      catch (error) { if (error.status !== 404) { failed++; continue; } }
      owned = owned.filter(item => item.id !== owner.id); saveOwned();
    }
    $('remove-status').textContent = failed ? 'Some records could not be removed. Please try again.' : 'Your saved records have been removed.';
    await refreshBoard();
  });
  $('refresh-board').addEventListener('click', refreshBoard);
  refreshBoard();
  root.hidden = false;
  stage.innerHTML = '<p class="play-loading">Loading the IGG examples…</p>';
  try {
    const response = await fetch('static/mockup-tasks.json');
    if (!response.ok) throw new Error();
    tasks = await response.json();
  } catch { stage.textContent = 'The examples could not load. Please refresh to try again.'; return; }
  $('ranked-start').hidden = false;

  function resize() {
    if (!frame || !canvas) return;
    const scale = enlarged ? 1 : stage.clientWidth / 1440;
    frame.style.transform = `scale(${scale})`;
    canvas.style.width = `${1440 * scale}px`; canvas.style.height = `${900 * scale}px`;
  }
  new ResizeObserver(resize).observe(stage);
  function updateMode() {
    const recorded = Boolean(run);
    $('remove-my-records').disabled = recorded;
    picker.forEach(button => { button.disabled = recorded; });
    hintButton.hidden = recorded; $('play-reset').hidden = recorded;
    $('play-exit').hidden = !recorded; $('play-clock').hidden = !recorded;
    $('start-ranked').disabled = recorded; $('player-name').disabled = recorded;
    $('play-mode').textContent = recorded ? `Recorded run · ${run.nickname}` : 'Practice';
    $('play-progress').textContent = recorded ? `${results.length} / 4 completed` : `${solved.size} / 4 solved`;
    picker.forEach(button => button.classList.toggle('solved', recorded ? results.some(r => r.task_id === tasks.find(t => t.kind === button.dataset.challenge).id && r.passed) : solved.has(button.dataset.challenge)));
    nextButton.textContent = recorded ? 'Skip task →' : 'Next challenge →';
  }
  function elapsed() { return Math.max(0, Math.min(LIMIT, Math.round(performance.now() - startedAt))); }
  function tick() {
    if (!run || complete || startedAt === null) return;
    $('play-clock').textContent = `${(elapsed() / 1000).toFixed(1)} / 60s`;
    if (elapsed() >= LIMIT) finishRecorded('timeout');
  }
  function practiceFinish() {
    if (complete) return;
    complete = true; solved.add(current.kind);
    feedback.textContent = descriptions[current.kind].success; feedback.classList.add('success');
    updateMode(); $('play-complete').hidden = solved.size !== tasks.length;
  }
  async function saveResult() {
    if (!pending || !run || saving) return;
    saving = true; nextButton.disabled = true; $('play-retry-save').hidden = true; $('play-exit').disabled = true;
    feedback.textContent = 'Saving your task result…';
    const thisGeneration = generation;
    try {
      const data = await api(`/api/runs/${run.id}/result`, {method: 'POST', body: JSON.stringify(pending)});
      if (thisGeneration !== generation) return;
      pending = null; pendingStorage(null); results = data.results; updateMode();
      const last = results[results.length - 1];
      feedback.textContent = `${last.passed ? 'Target found!' : last.outcome === 'timeout' ? 'Time is up.' : 'Task skipped.'} ${(last.elapsed_ms / 1000).toFixed(2)}s · saved.`;
      feedback.classList.toggle('success', last.passed);
      if (data.complete) {
        const text = `Saved to the Human Leaderboard! GA ${Math.round(data.ga * 100)}% · TT ${(data.tt_ms / 1000).toFixed(2)}s per task.`;
        $('ranked-status').textContent = text; feedback.textContent = text;
        run = null; updateMode(); nextButton.textContent = 'Back to practice →';
        await refreshBoard();
      } else nextButton.textContent = 'Next task →';
      nextButton.disabled = false;
    } catch (error) { feedback.textContent = `Your result is waiting to be saved. ${error.message}`; $('play-retry-save').hidden = false; }
    finally { saving = false; $('play-exit').disabled = false; }
  }
  function finishRecorded(outcome, detail = {}) {
    if (!run || complete || startedAt === null) return;
    const time = elapsed();
    if (time >= LIMIT) outcome = 'timeout';
    complete = true; clearInterval(timer); stage.classList.add('is-finished'); frame.setAttribute('inert', '');
    pending = {task_id: current.id, elapsed_ms: time, outcome, observed_target_id: detail.observedTargetId || null, target_actionable: detail.targetActionable === true, constraint_valid: !invalidDrag};
    pendingStorage({run, pending}); saveResult();
  }
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'igg-review-observed-action') return;
    const detail = event.data.detail; if (!detail) return;
    clearInterval(handshake); clearTimeout(deadline);
    if (feedback.dataset.loading === 'true') {
      feedback.dataset.loading = 'false'; stage.classList.remove('is-loading');
      feedback.textContent = run ? 'Find the target before time runs out.' : 'Find the target.';
      nextButton.disabled = false;
      if (run) { startedAt = performance.now(); timer = setInterval(tick, 100); tick(); }
    }
    if (current.kind === 'drag') {
      const count = event.data.runtimeState?.noteCount;
      if (Number.isInteger(count)) { if (initialNoteCount === null) initialNoteCount = count; if (count < initialNoteCount) invalidDrag = true; }
    }
    if (complete || detail.type !== 'click' || detail.observedTargetId !== current.target_id || detail.targetActionable !== true) return;
    if (invalidDrag) { feedback.textContent = run ? 'A note was deleted, so this task cannot count as solved. Skip to continue.' : 'A note was deleted. Choose Try again, then move the covering note without deleting it.'; return; }
    if (run) finishRecorded('target', detail); else practiceFinish();
  });

  function select(kind) {
    clearInterval(handshake); clearTimeout(deadline); clearInterval(timer);
    current = tasks.find(task => task.kind === kind); complete = false; startedAt = null;
    initialNoteCount = null; invalidDrag = false;
    feedback.dataset.loading = 'true'; feedback.textContent = 'Loading the mockup…'; feedback.classList.remove('success');
    stage.classList.add('is-loading'); stage.classList.remove('is-finished');
    nextButton.disabled = true; nextButton.textContent = run ? 'Skip task →' : 'Next challenge →';
    $('play-clock').textContent = '0.0 / 60s'; $('play-complete').hidden = true;
    hint.hidden = true; hintButton.textContent = 'Need a hint?'; hintButton.setAttribute('aria-expanded', 'false');
    $('play-instruction').textContent = current.instruction;
    $('play-app-name').textContent = `${current.appName} · IGG mockup`;
    picker.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.challenge === kind)));
    frame = document.createElement('iframe'); frame.title = `${current.appName}: ${current.instruction}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = `static/mockups/${current.app}/?stateId=${encodeURIComponent(current.state_id)}&round=${++round}`;
    canvas = document.createElement('div'); canvas.className = 'mockup-canvas'; canvas.append(frame); stage.replaceChildren(canvas);
    stage.scrollTop = 0; stage.scrollLeft = 0; resize();
    if (run) $('play-instruction').scrollIntoView({block: 'start'});
    const thisFrame = frame;
    frame.addEventListener('load', () => {
      if (thisFrame !== frame) return;
      const enable = () => thisFrame.contentWindow?.postMessage({type: 'igg-review-capture', enabled: true}, location.origin);
      enable(); handshake = setInterval(enable, 100);
      deadline = setTimeout(() => {
        clearInterval(handshake);
        feedback.textContent = run ? 'The mockup could not load. End this run and try again; no score will be published.' : 'The mockup is taking longer to load. Choose Try again.';
      }, 15000);
    });
  }
  async function startTask() {
    nextButton.disabled = true; feedback.textContent = 'Preparing your next task…';
    const thisGeneration = generation;
    try {
      await api(`/api/runs/${run.id}/start`, {method: 'POST', body: JSON.stringify({task_id: tasks[results.length].id})});
      if (thisGeneration !== generation) return;
      select(tasks[results.length].kind);
    } catch (error) {
      feedback.textContent = error.message; nextButton.textContent = 'Retry loading task →'; nextButton.disabled = false; complete = true;
    }
  }
  $('ranked-start').addEventListener('submit', async event => {
    event.preventDefault(); if (run) return;
    $('start-ranked').disabled = true; $('ranked-status').textContent = 'Preparing your recorded run…';
    try {
      const created = await api('/api/runs', {method: 'POST', body: JSON.stringify({nickname: $('player-name').value})}, null);
      if (created.protocol !== PROTOCOL) throw new Error('The challenge has changed. Please refresh.');
      run = created; results = []; pending = null; generation++;
      owned.push({id: run.id, token: run.token}); saveOwned();
      updateMode(); $('ranked-status').textContent = 'The timer starts when the task is ready. Loading and breaks do not count.';
      await startTask();
    } catch (error) { $('ranked-status').textContent = error.message; $('start-ranked').disabled = false; }
  });
  $('play-exit').addEventListener('click', async () => {
    if (saving) return;
    const abandoned = run; run = null; generation++; pending = null; pendingStorage(null);
    clearInterval(timer); $('play-retry-save').hidden = true;
    $('ranked-status').textContent = 'Run ended. No leaderboard score was published.';
    updateMode(); select('scroll');
    if (abandoned) try { await api(`/api/runs/${abandoned.id}`, {method: 'DELETE'}, abandoned); owned = owned.filter(item => item.id !== abandoned.id); saveOwned(); } catch {}
  });
  nextButton.addEventListener('click', () => {
    if (!run) select(tasks[(tasks.indexOf(current) + 1) % tasks.length].kind);
    else if (complete && !pending) startTask();
    else if (!complete) finishRecorded('skip');
  });
  $('play-retry-save').addEventListener('click', saveResult);
  picker.forEach(button => button.addEventListener('click', () => { if (!run) select(button.dataset.challenge); }));
  $('play-reset').addEventListener('click', () => { if (!run) select(current.kind); });
  hintButton.setAttribute('aria-controls', 'play-hint-text');
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden; hint.textContent = descriptions[current.kind].hint;
    hintButton.textContent = hint.hidden ? 'Need a hint?' : 'Hide hint'; hintButton.setAttribute('aria-expanded', String(!hint.hidden));
  });
  enlargeButton.addEventListener('click', () => {
    enlarged = !enlarged; stage.classList.toggle('is-enlarged', enlarged); enlargeButton.setAttribute('aria-pressed', String(enlarged));
    enlargeButton.textContent = enlarged ? 'Fit to page' : 'Enlarge view'; resize();
  });
  window.addEventListener('beforeunload', event => { if (run) { event.preventDefault(); event.returnValue = ''; } });
  updateMode(); select('scroll');
  // A final result that lost its network response can be recovered after refresh.
  try {
    const saved = JSON.parse(localStorage.getItem('igg-human-pending') || 'null');
    if (saved?.run && saved?.pending) {
      const data = await api(`/api/runs/${saved.run.id}/result`, {method: 'POST', body: JSON.stringify(saved.pending)}, saved.run);
      pendingStorage(null);
      $('ranked-status').textContent = data.complete ? `Your previous run was saved: GA ${Math.round(data.ga * 100)}% · TT ${(data.tt_ms / 1000).toFixed(2)}s.` : 'Your last task was saved, but the interrupted run was not published. Start a new recorded run.';
      refreshBoard();
    }
  } catch { $('ranked-status').textContent = 'A previous result is waiting to be saved. Refresh when your connection returns.'; }
})();
