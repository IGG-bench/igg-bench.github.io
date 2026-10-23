(async () => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.querySelector('.playground');
  if (!root) return;
  const API = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:8789' : 'https://igg-human-leaderboard.kaist-ami-lab.chatgpt.site';
  const LIMIT = 60000;
  const PROTOCOL = 'igg-fun-v2';
  const stage = $('play-stage'), feedback = $('play-feedback'), hint = $('play-hint-text');
  const hintButton = $('play-hint'), enlargeButton = $('play-enlarge'), nextButton = $('play-next');
  const resultPanel = $('play-result'), resultNext = $('result-next'), resultSecondary = $('result-secondary');
  const picker = [...document.querySelectorAll('[data-challenge]')];
  const solved = new Set();
  const descriptions = {
    scroll: { hint: 'Scroll to Linked resources, then open Customer Interviews.' },
    hover: { hint: 'Hover over Half Awake to reveal the heart on the right.' },
    drag: { hint: 'Move the notes covering Key Insight, then click it. Keep all notes on the canvas.' },
    wait: { hint: 'Wait for Alice Kim’s email notification, then click Reply.' }
  };
  let tasks, practiceTasks, current, frame, canvas, handshake, deadline, timer, startedAt;
  let round = 0, complete = false, initialNoteCount = null, invalidDrag = false, enlarged = false;
  let run = null, results = [], pending = null, saving = false, generation = 0, finishedRun = false;
  let resultAction = null;
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
      try { data = await response.json(); } catch { throw new Error('Could not connect to the leaderboard. Try again.'); }
      if (!response.ok) { const error = new Error(data.error || 'Could not connect to the leaderboard.'); error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection timed out. Try again.');
      if (error instanceof TypeError) throw new Error('Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  let boardRequest = 0;
  async function refreshBoard() {
    const requestId = ++boardRequest;
    const protocol = PROTOCOL;
    $('refresh-board').disabled = true;
    $('remove-my-records').hidden = !owned.length;
    $('remove-my-records').disabled = Boolean(run);
    $('board-status').textContent = 'Loading records…';
    try {
      const data = await api(`/api/leaderboard?protocol=${encodeURIComponent(protocol)}`, {}, null);
      if (requestId !== boardRequest) return;
      if (data.protocol !== protocol) throw new Error('This challenge has changed. Refresh the page.');
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
      $('board-status').textContent = data.total > data.entries.length ? `Showing ${data.entries.length} of ${data.total} runs` : data.total ? '' : 'Be the first to play.';
    } catch (error) { if (requestId === boardRequest) $('board-status').textContent = error.message; }
    finally { if (requestId === boardRequest) $('refresh-board').disabled = false; }
  }
  $('remove-my-records').addEventListener('click', async () => {
    if (run) return;
    $('remove-my-records').disabled = true; $('remove-status').textContent = 'Removing your runs…';
    let failed = 0;
    for (const owner of [...owned]) {
      try { await api(`/api/runs/${owner.id}`, {method: 'DELETE'}, owner); }
      catch (error) { if (error.status !== 404) { failed++; continue; } }
      owned = owned.filter(item => item.id !== owner.id); saveOwned();
    }
    $('remove-status').textContent = failed ? 'Some runs could not be removed. Try again.' : 'Your runs were removed.';
    await refreshBoard();
  });
  $('refresh-board').addEventListener('click', refreshBoard);
  refreshBoard();
  root.hidden = false;
  stage.innerHTML = '<p class="play-loading">Loading tasks…</p>';
  try {
    const responses = await Promise.all([fetch('static/ranked-tasks-v2.json?v=6'), fetch('static/practice-tasks.json?v=6')]);
    if (responses.some(response => !response.ok)) throw new Error();
    [tasks, practiceTasks] = await Promise.all(responses.map(response => response.json()));
  } catch { stage.textContent = 'Tasks did not load. Refresh to try again.'; return; }
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
    root.classList.toggle('is-recorded', recorded || finishedRun);
    $('ranked-start').hidden = recorded || finishedRun;
    $('remove-my-records').disabled = recorded;
    picker.forEach(button => { button.disabled = recorded; });
    hintButton.hidden = recorded || finishedRun || complete; $('play-reset').hidden = recorded || finishedRun || complete;
    enlargeButton.disabled = complete;
    nextButton.hidden = !resultPanel.hidden;
    $('play-exit').hidden = !recorded; $('play-clock').hidden = !recorded;
    $('start-ranked').disabled = recorded; $('player-name').disabled = recorded;
    $('play-mode').textContent = recorded ? `Leaderboard mode · ${run.nickname}` : finishedRun ? 'Leaderboard mode · Complete' : 'Practice mode';
    $('play-progress').textContent = recorded || finishedRun ? `${results.length} / 4 completed` : `${solved.size} / 4 solved`;
    picker.forEach(button => button.classList.toggle('solved', recorded || finishedRun ? results.some(r => r.task_id === tasks.find(t => t.kind === button.dataset.challenge).id && r.passed) : solved.has(button.dataset.challenge)));
    nextButton.textContent = recorded ? 'Skip task' : 'Next task →';
  }
  function elapsed() { return Math.max(0, Math.round(performance.now() - startedAt)); }
  function tick() {
    if (!run || complete || startedAt === null) return;
    $('play-clock').textContent = `${(Math.min(LIMIT, elapsed()) / 1000).toFixed(1)} / 60s`;
    if (elapsed() >= LIMIT) finishRecorded('timeout');
  }
  function showResult(title, time, neutral = false) {
    frame.setAttribute('inert', ''); stage.classList.add('is-finished');
    resultPanel.hidden = false; resultPanel.classList.toggle('is-neutral', neutral);
    $('result-title').textContent = title;
    $('result-time').textContent = `${(time / 1000).toFixed(2)}s`;
    $('result-detail').textContent = '';
    $('play-retry-save').hidden = true; resultSecondary.hidden = true;
    resultNext.hidden = false; resultNext.disabled = true; resultNext.textContent = 'Saving…'; resultAction = null;
    hint.hidden = true; feedback.textContent = '';
    updateMode();
    $('result-title').focus({preventScroll: true});
    resultPanel.querySelector('.result-card').scrollIntoView({block: 'nearest'});
  }
  function resultButton(label, action) {
    resultAction = action; resultNext.textContent = label; resultNext.disabled = false;
    resultNext.focus({preventScroll: true});
  }
  function nextPractice() {
    const index = practiceTasks.findIndex(task => task.kind === current.kind);
    const ordered = [...practiceTasks.slice(index + 1), ...practiceTasks.slice(0, index + 1)];
    select((ordered.find(task => !solved.has(task.kind)) || ordered[0]).kind);
    root.scrollIntoView({block: 'start'});
  }
  function practiceFinish() {
    if (complete || startedAt === null) return;
    complete = true; solved.add(current.kind);
    showResult('Success!', elapsed());
    if (solved.size === practiceTasks.length) {
      $('result-detail').textContent = 'All four solved.';
      resultButton('Join the leaderboard →', () => {
        $('player-name').focus(); $('ranked-start').scrollIntoView({block: 'center'});
      });
    } else resultButton('Next task →', nextPractice);
    resultSecondary.textContent = 'Try again'; resultSecondary.hidden = false;
  }
  async function saveResult() {
    if (!pending || !run || saving) return;
    saving = true; nextButton.disabled = true; $('play-retry-save').hidden = true; $('play-exit').disabled = true;
    resultNext.hidden = false; resultNext.disabled = true; resultNext.textContent = 'Saving…';
    $('result-detail').textContent = '';
    const thisGeneration = generation;
    try {
      const data = await api(`/api/runs/${run.id}/result`, {method: 'POST', body: JSON.stringify(pending)});
      if (thisGeneration !== generation) return;
      pending = null; pendingStorage(null); results = data.results; updateMode();
      const last = results[results.length - 1];
      $('result-title').textContent = last.passed ? 'Success!' : last.outcome === 'timeout' ? "Time’s up" : last.outcome === 'skip' ? 'Skipped' : 'Not counted';
      resultPanel.classList.toggle('is-neutral', !last.passed);
      if (data.complete) {
        $('result-detail').textContent = `GA ${Math.round(data.ga * 100)}% · TT ${(data.tt_ms / 1000).toFixed(2)}s · Saved`;
        run = null; finishedRun = true; updateMode();
        resultButton('View leaderboard →', () => $('human-leaderboard').scrollIntoView({block: 'start', behavior: 'smooth'}));
        resultSecondary.textContent = 'Back to practice'; resultSecondary.hidden = false;
        refreshBoard();
      } else resultButton('Next task →', startTask);
      nextButton.disabled = false;
    } catch (error) {
      $('result-detail').textContent = `Not saved yet. ${error.message}`;
      resultNext.hidden = true; $('play-retry-save').hidden = false;
      $('play-retry-save').focus({preventScroll: true});
    }
    finally { saving = false; $('play-exit').disabled = false; }
  }
  function finishRecorded(outcome, detail = {}) {
    if (!run || complete || startedAt === null) return;
    const time = Math.min(LIMIT, elapsed());
    if (time >= LIMIT) outcome = 'timeout';
    complete = true; clearInterval(timer);
    $('play-clock').textContent = `${(time / 1000).toFixed(1)} / 60s`;
    showResult(outcome === 'target' ? 'Success!' : outcome === 'timeout' ? 'Time’s up' : 'Skipped', time, outcome !== 'target');
    pending = {task_id: current.id, elapsed_ms: time, outcome, observed_target_id: detail.observedTargetId || null, target_actionable: detail.targetActionable === true, constraint_valid: !invalidDrag};
    pendingStorage({run, pending}); saveResult();
  }
  window.addEventListener('message', event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'igg-review-observed-action') return;
    const detail = event.data.detail; if (!detail) return;
    clearInterval(handshake); clearTimeout(deadline);
    if (feedback.dataset.loading === 'true') {
      feedback.dataset.loading = 'false'; stage.classList.remove('is-loading');
      feedback.textContent = '';
      nextButton.disabled = false;
      startedAt = performance.now();
      if (run) { timer = setInterval(tick, 100); tick(); }
    }
    if (current.kind === 'drag') {
      const count = event.data.runtimeState?.noteCount;
      if (Number.isInteger(count)) { if (initialNoteCount === null) initialNoteCount = count; if (count < initialNoteCount) invalidDrag = true; }
    }
    if (complete || detail.type !== 'click' || detail.observedTargetId !== current.target_id || detail.targetActionable !== true) return;
    if (invalidDrag) { feedback.textContent = run ? 'A note was deleted. Skip this task to continue.' : 'A note was deleted. Restart and move it instead.'; return; }
    if (run) finishRecorded('target', detail); else practiceFinish();
  });

  function select(kind) {
    if (!run && finishedRun) { finishedRun = false; updateMode(); }
    clearInterval(handshake); clearTimeout(deadline); clearInterval(timer);
    current = (run ? tasks : practiceTasks).find(task => task.kind === kind); complete = false; startedAt = null;
    resultPanel.hidden = true; resultAction = null; $('play-retry-save').hidden = true;
    initialNoteCount = null; invalidDrag = false;
    feedback.dataset.loading = 'true'; feedback.textContent = 'Loading task…';
    stage.classList.add('is-loading'); stage.classList.remove('is-finished');
    nextButton.disabled = true;
    $('play-clock').textContent = '0.0 / 60s';
    hint.hidden = true; hintButton.textContent = 'Hint'; hintButton.setAttribute('aria-expanded', 'false');
    $('play-instruction').textContent = current.instruction;
    picker.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.challenge === kind)));
    frame = document.createElement('iframe'); frame.title = `${current.appName}: ${current.instruction}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = `static/mockups/${current.app}/?stateId=${encodeURIComponent(current.state_id)}&round=${++round}`;
    canvas = document.createElement('div'); canvas.className = 'mockup-canvas'; canvas.append(frame); stage.replaceChildren(canvas);
    updateMode();
    stage.scrollTop = 0; stage.scrollLeft = 0; resize();
    if (run) root.scrollIntoView({block: 'start'});
    const thisFrame = frame;
    frame.addEventListener('load', () => {
      if (thisFrame !== frame) return;
      const enable = () => thisFrame.contentWindow?.postMessage({type: 'igg-review-capture', enabled: true}, location.origin);
      enable(); handshake = setInterval(enable, 100);
      deadline = setTimeout(() => {
        clearInterval(handshake);
        feedback.textContent = run ? 'Task did not load. End the run and try again. No score will be posted.' : 'Task did not load. Select Restart to try again.';
      }, 15000);
    });
  }
  async function startTask() {
    if (!run || pending) return;
    nextButton.disabled = true; feedback.textContent = 'Loading next task…';
    resultNext.disabled = true; resultNext.textContent = 'Loading…';
    const thisGeneration = generation;
    try {
      await api(`/api/runs/${run.id}/start`, {method: 'POST', body: JSON.stringify({task_id: tasks[results.length].id})});
      if (thisGeneration !== generation) return;
      select(tasks[results.length].kind);
    } catch (error) {
      complete = true;
      if (!resultPanel.hidden) {
        feedback.textContent = ''; $('result-detail').textContent = error.message;
        resultButton('Retry next task →', startTask);
      } else {
        feedback.textContent = error.message; nextButton.textContent = 'Retry loading task →'; nextButton.disabled = false;
      }
    }
  }
  $('ranked-start').addEventListener('submit', async event => {
    event.preventDefault(); if (run) return;
    $('start-ranked').disabled = true; $('ranked-status').textContent = 'Starting run…';
    try {
      const created = await api('/api/runs', {method: 'POST', body: JSON.stringify({nickname: $('player-name').value, protocol: PROTOCOL})}, null);
      if (created.protocol !== PROTOCOL) throw new Error('This challenge has changed. Refresh the page.');
      run = created; finishedRun = false; results = []; pending = null; generation++;
      owned.push({id: run.id, token: run.token}); saveOwned();
      updateMode(); $('ranked-status').textContent = '';
      await startTask();
    } catch (error) { $('ranked-status').textContent = error.message; $('start-ranked').disabled = false; }
  });
  $('play-exit').addEventListener('click', async () => {
    if (saving) return;
    const abandoned = run; run = null; generation++; pending = null; pendingStorage(null);
    clearInterval(timer); $('play-retry-save').hidden = true;
    $('ranked-status').textContent = 'Run ended. No score was posted.';
    updateMode(); select('scroll');
    if (abandoned) try { await api(`/api/runs/${abandoned.id}`, {method: 'DELETE'}, abandoned); owned = owned.filter(item => item.id !== abandoned.id); saveOwned(); } catch {}
  });
  nextButton.addEventListener('click', () => {
    if (!run) nextPractice();
    else if (complete && !pending) startTask();
    else if (!complete) finishRecorded('skip');
  });
  resultNext.addEventListener('click', () => { if (!resultNext.disabled && resultAction) resultAction(); });
  resultSecondary.addEventListener('click', () => {
    if (run || saving) return;
    select(finishedRun ? 'scroll' : current.kind);
    root.scrollIntoView({block: 'start'});
  });
  $('play-retry-save').addEventListener('click', saveResult);
  picker.forEach(button => button.addEventListener('click', () => { if (!run) select(button.dataset.challenge); }));
  $('play-reset').addEventListener('click', () => { if (!run) select(current.kind); });
  hintButton.setAttribute('aria-controls', 'play-hint-text');
  hintButton.addEventListener('click', () => {
    hint.hidden = !hint.hidden; hint.textContent = descriptions[current.kind].hint;
    hintButton.textContent = hint.hidden ? 'Hint' : 'Hide hint'; hintButton.setAttribute('aria-expanded', String(!hint.hidden));
  });
  enlargeButton.addEventListener('click', () => {
    enlarged = !enlarged; stage.classList.toggle('is-enlarged', enlarged); enlargeButton.setAttribute('aria-pressed', String(enlarged));
    stage.parentElement.classList.toggle('is-enlarged', enlarged);
    enlargeButton.textContent = enlarged ? 'Fit' : 'Enlarge'; resize();
  });
  window.addEventListener('beforeunload', event => { if (run) { event.preventDefault(); event.returnValue = ''; } });
  updateMode(); select('scroll');
  // A final result that lost its network response can be recovered after refresh.
  try {
    const saved = JSON.parse(localStorage.getItem('igg-human-pending') || 'null');
    if (saved?.run && saved?.pending) {
      const data = await api(`/api/runs/${saved.run.id}/result`, {method: 'POST', body: JSON.stringify(saved.pending)}, saved.run);
      pendingStorage(null);
      $('ranked-status').textContent = data.complete ? `Previous run saved: GA ${Math.round(data.ga * 100)}% · TT ${(data.tt_ms / 1000).toFixed(2)}s.` : 'Your last task was saved, but the run was incomplete. Start a new run.';
      refreshBoard();
    }
  } catch { $('ranked-status').textContent = 'A result is still unsaved. Reconnect and refresh to save it.'; }
})();
