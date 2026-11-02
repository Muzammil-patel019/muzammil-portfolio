(() => {
  const lessons = window.LESSONS;
  const key = 'mp-learning-v1';
  let state = {}, track = 'All', selected = lessons[0].id;
  const $ = id => document.getElementById(id);
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      state.days = Array.isArray(stored.days) ? [...new Set(stored.days.filter(d => Number.isInteger(d) && d > 0))] : [];
      for (const lesson of lessons) {
        const value = stored[lesson.id];
        if (value && typeof value === 'object') state[lesson.id] = {
          read: value.read === true, quiz: value.quiz === true, practice: value.practice === true,
          draft: typeof value.draft === 'string' ? value.draft.slice(0, 20000) : ''
        };
      }
    }
  } catch { $('storage-note').textContent = 'Saved progress could not be loaded. You can keep studying in this tab.'; }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'learning-load') return;
    const incoming = event.data.document;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return;
    state = incoming;
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    render();
  });
  function save() {
    if (parent !== window) parent.postMessage({type:'learning-save',document:state}, location.origin);
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { $('storage-note').textContent = 'Browser storage is unavailable or full. Changes remain in this tab only.'; }
  }
  // Calendar days in India time; UTC arithmetic avoids daylight-saving boundaries.
  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    const value = type => Number(parts.find(p => p.type === type).value);
    return Math.floor(Date.UTC(value('year'), value('month') - 1, value('day')) / 86400000);
  }
  function activity() {
    state.days = [...new Set([...(state.days || []), today()])];
  }
  function streak() {
    const day = today(), days = new Set((state.days || []).filter(d => d <= day));
    let cursor = days.has(day) ? day : day - 1, current = 0, best = 0, run = 0, previous;
    while (days.has(cursor--)) current++;
    for (const d of [...days].sort((a,b) => a-b)) {
      run = d === previous + 1 ? run + 1 : 1;
      best = Math.max(best, run); previous = d;
    }
    $('streak').textContent = `${current} day${current === 1 ? '' : 's'}`;
    $('best-streak').textContent = `Best: ${best} days`;
    $('daily-goal').textContent = days.has(day) ? 'Daily goal complete. See you tomorrow!' : 'Complete a lesson, pass a quiz, or review an exercise today.';
    $('week').replaceChildren(...Array.from({length:7}, (_,i) => {
      const d = day - 6 + i, item = document.createElement('span');
      const label = new Intl.DateTimeFormat('en-IN', {weekday:'short', timeZone:'UTC'}).format(new Date(d * 86400000));
      item.textContent = `${label} ${days.has(d) ? '✓' : '·'}`;
      item.className = days.has(d) ? 'done' : '';
      item.setAttribute('aria-label', `${new Date(d * 86400000).toISOString().slice(0,10)}: ${days.has(d) ? 'goal complete' : 'no activity'}`);
      return item;
    }));
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) streak(); });
  setInterval(streak, 60000);
  function record() { return state[selected] ||= {}; }
  function summary() {
    const totals = ['read','quiz','practice'].map(field => lessons.filter(l => state[l.id]?.[field]).length);
    ['read-count','quiz-count','practice-count'].forEach((id,i) => $(id).textContent = `${totals[i]} / ${lessons.length}`);
    const total = totals.reduce((a,b) => a+b,0);
    $('overall').textContent = `${Math.round(total / (lessons.length * 3) * 100)}%`;
    $('progress').value = total;
    $('progress').max = lessons.length * 3;
    list();
    streak();
  }
  function list() {
    $('lessons').replaceChildren(...lessons.filter(l => track === 'All' || l.track === track).map(l => {
      const button = document.createElement('button');
      const count = ['read','quiz','practice'].filter(f => state[l.id]?.[f]).length;
      button.textContent = `${l.track} · ${l.title} (${count}/3)`;
      button.setAttribute('aria-current', l.id === selected ? 'true' : 'false');
      button.onclick = () => { selected = l.id; render(); if (innerWidth <= 750) $('lesson').scrollIntoView({behavior:'smooth'}); };
      return button;
    }));
  }
  let playback = null;
  function render() {
    clearInterval(playback); playback = null;
    const l = lessons.find(l => l.id === selected), s = record();
    // Only trusted, checked-in curriculum is inserted as markup. Drafts use textarea.value.
    $('lesson').innerHTML = `<p class="eyebrow">${l.track} / STUDY SESSION</p><h2>${l.title}</h2><p>${l.body}</p><pre><code id="example"></code></pre><label class="check"><input id="read" type="checkbox"> I can explain this concept</label><hr><h3>Check your understanding</h3><form id="quiz"><fieldset><legend>${l.question}</legend>${l.options.map((o,i) => `<label class="option"><input required type="radio" name="answer" value="${i}"> ${o}</label>`).join('')}</fieldset><button type="submit">Check answer</button></form><p id="feedback" role="status"></p><hr><h3>Put it into practice</h3><p>${l.challenge}</p><label for="draft">Your code or approach</label><textarea id="draft" maxlength="20000" rows="9" spellcheck="false" placeholder="Write your solution here…"></textarea><p class="storage-note">Scratchpad only. Code is not executed. Run Python / pytest / Java locally to verify your solution.</p><details><summary>Show reference solution and checks</summary><pre><code id="solution"></code></pre></details><label class="check"><input id="practice" type="checkbox"> I tested my solution locally and reviewed the edge cases</label><button id="next">Next lesson →</button>`;
    const visual = document.createElement('section');
    visual.className = 'visual-explanation';
    visual.innerHTML = '<p class="eyebrow">PROGRAM WALKTHROUGH</p><h3>Follow the code</h3><p>Tap a line or move through the steps. This is an illustrated trace, not a code runner.</p><div class="trace-code" aria-label="Program lines"></div><p class="visual-step" aria-live="polite"></p><div class="trace-state" aria-label="Values and output"></div><div class="trace-controls"><button type="button" class="previous">← Back</button><button type="button" class="advance">Next step →</button><button type="button" class="play">Play explanation</button></div><p class="step-counter"></p>';
    let step = 0;
    const steps = l.walkthrough;
    const lines = steps.map((part, index) => {
      const button = document.createElement('button');
      button.textContent = `${index + 1}  ${part.code}`;
      button.onclick = () => { stopPlayback(); step = index; show(); };
      visual.querySelector('.trace-code').append(button); return button;
    });
    function stopPlayback() {
      clearInterval(playback); playback = null;
      visual.querySelector('.play').textContent = 'Play explanation';
    }
    const show = () => {
      lines.forEach((line,i) => line.setAttribute('aria-pressed', String(i === step)));
      visual.querySelector('.visual-step').textContent = steps[step].explanation;
      visual.querySelector('.trace-state').textContent = steps[step].state;
      visual.querySelector('.step-counter').textContent = `Step ${step + 1} of ${steps.length}`;
      visual.querySelector('.previous').disabled = step === 0;
      visual.querySelector('.advance').textContent = step === steps.length - 1 ? 'Replay ↻' : 'Next step →';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        visual.querySelector('.trace-state').animate([{opacity:.2,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:350});
      }
    };
    visual.querySelector('.advance').onclick = () => {stopPlayback();step=(step+1)%steps.length;show();};
    visual.querySelector('.previous').onclick = () => {stopPlayback();step=Math.max(0,step-1);show();};
    visual.querySelector('.play').onclick = () => {
      if (playback) {stopPlayback();return;}
      if (step === steps.length - 1) step = 0;
      show(); visual.querySelector('.play').textContent = 'Pause explanation';
      playback = setInterval(() => {
        if (document.hidden || step === steps.length - 1) {stopPlayback();return;}
        step++;show();
        if (step === steps.length - 1) stopPlayback();
      }, 6500);
    };
    $('example').parentElement.after(visual); show();
    $('example').textContent = l.example;
    $('solution').textContent = l.solution;
    $('draft').value = s.draft || '';
    $('draft').oninput = event => { record().draft = event.target.value; save(); };
    for (const field of ['read','practice']) {
      $(field).checked = s[field] === true;
      $(field).onchange = event => { record()[field] = event.target.checked; if (event.target.checked) activity(); save(); summary(); };
    }
    if (s.quiz) $('feedback').textContent = 'Previously passed. You can try again for review.';
    $('quiz').onsubmit = event => {
      event.preventDefault();
      const answer = Number(new FormData(event.target).get('answer'));
      const correct = answer === l.answer;
      $('feedback').textContent = (correct ? 'Correct. ' : 'Try again. ') + l.explanation;
      if (correct) { record().quiz = true; activity(); save(); summary(); }
    };
    $('next').onclick = () => {
      const visible = lessons.filter(l => track === 'All' || l.track === track);
      selected = visible[(visible.findIndex(l => l.id === selected) + 1) % visible.length].id;
      render(); $('lesson').scrollIntoView({behavior:'smooth', block:'start'});
    };
    summary();
  }
  document.querySelectorAll('[data-track]').forEach(button => button.onclick = () => {
    track = button.dataset.track;
    document.querySelectorAll('[data-track]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    selected = lessons.find(l => track === 'All' || l.track === track).id;
    render();
  });
  $('resume').onclick = () => {
    const next = lessons.find(l => ['read','quiz','practice'].some(f => !state[l.id]?.[f]));
    if (!next) { $('notice').textContent = 'All activities completed. Choose any lesson to review.'; return; }
    track = 'All'; selected = next.id;
    document.querySelectorAll('[data-track]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.track === 'All')));
    render(); $('lesson').scrollIntoView({behavior:'smooth'});
  };
  $('reset').onclick = () => {
    if (!confirm('Remove all learning progress and code drafts from this browser?')) return;
    state = {}; save(); render(); $('notice').textContent = 'Progress and drafts reset.';
  };
  render();
})();
