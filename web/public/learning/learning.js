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
  function render() {
    const l = lessons.find(l => l.id === selected), s = record();
    // Only trusted, checked-in curriculum is inserted as markup. Drafts use textarea.value.
    $('lesson').innerHTML = `<p class="eyebrow">${l.track} / STUDY SESSION</p><h2>${l.title}</h2><p>${l.body}</p><pre><code id="example"></code></pre><label class="check"><input id="read" type="checkbox"> I can explain this concept</label><hr><h3>Check your understanding</h3><form id="quiz"><fieldset><legend>${l.question}</legend>${l.options.map((o,i) => `<label class="option"><input required type="radio" name="answer" value="${i}"> ${o}</label>`).join('')}</fieldset><button type="submit">Check answer</button></form><p id="feedback" role="status"></p><hr><h3>Put it into practice</h3><p>${l.challenge}</p><label for="draft">Your code or approach</label><textarea id="draft" maxlength="20000" rows="9" spellcheck="false" placeholder="Write your solution here…"></textarea><p class="storage-note">Scratchpad only. Code is not executed. Run Python / pytest / Java locally to verify your solution.</p><details><summary>Show reference solution and checks</summary><pre><code id="solution"></code></pre></details><label class="check"><input id="practice" type="checkbox"> I tested my solution locally and reviewed the edge cases</label><button id="next">Next lesson →</button>`;
    const stories = {
      python0: ['a → [1, 2] · Start with a list.', 'b → [1, 2] · copy() creates a separate outer list.', 'b → [1, 2, 3] · Append changes b only.', 'a → [1, 2] · The original list stays unchanged.'],
      python1: ['Call add_item("A") with no list.', 'items is None → create a fresh empty list.', 'Append "A" → return ["A"].', 'Call again with "B" → a new list returns ["B"], not ["A", "B"].'],
      python2: ['Create squares([2, 3]) → no values calculated yet.', 'Ask for next → yield 4, then pause.', 'Ask again → resume and yield 9.', 'Ask again → iteration ends. Values were produced one at a time.'],
      pytest0: ['Enter pytest.raises(ValueError).', 'int("invalid") attempts conversion.', 'Python raises ValueError.', 'pytest sees the expected exception → test passes. No exception would fail this test.'],
      pytest1: ['pytest sees the user argument in test_user.', 'It finds the fixture named user.', 'The fixture returns {name: Ada} for this test.', 'The assertion passes. The next test gets a fresh fixture value.'],
      pytest2: ['Case 1: value = 0, expected = True.', '0 % 2 == 0 → True → pass.', 'Case 2: value = 3, expected = False.', '3 % 2 == 0 → False → pass. Each case is reported separately.'],
      java0: ['new String("test") creates object A.', 'Another new String("test") creates object B.', 'A == B → false: two different objects.', 'A.equals(B) → true: the characters match.'],
      java1: ['Start with an empty LinkedHashSet.', 'Add Ada → [Ada].', 'Add Ada again → [Ada]. No duplicate is added.', 'A Set tracks unique values; LinkedHashSet also preserves insertion order.'],
      java2: ['Open the reader in try-with-resources.', 'Read the first line.', 'Leave the block → close the reader automatically.', 'If reading throws, the reader is still closed before the exception propagates.']
    };
    const visual = document.createElement('section');
    visual.className = 'visual-explanation';
    visual.innerHTML = '<h3>See it happen</h3><p class="visual-step" aria-live="polite"></p><button type="button">Next step →</button><p class="step-counter"></p>';
    let step = 0;
    const show = () => {
      visual.querySelector('.visual-step').textContent = stories[l.id][step];
      visual.querySelector('.step-counter').textContent = `Step ${step + 1} of ${stories[l.id].length}`;
      visual.querySelector('button').textContent = step === stories[l.id].length - 1 ? 'Replay ↻' : 'Next step →';
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) visual.querySelector('.visual-step').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:250});
    };
    visual.querySelector('button').onclick = () => {step=(step+1)%stories[l.id].length;show();};
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
