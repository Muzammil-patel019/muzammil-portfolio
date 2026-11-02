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
    $('lesson').innerHTML = `<p class="eyebrow">${l.track} / STUDY SESSION</p><h2>${l.title}</h2><div class="lesson-goal"><strong>Your goal · about 10–15 minutes</strong><p>${l.goal}</p><a href="#video-library">Watch video</a> · <a href="#concept">Understand</a> · <a href="#game">Play</a> · <a href="#quiz">Quiz</a> · <a href="#draft">Practice</a></div><h3 id="concept">Think of it this way</h3><p class="analogy">${l.analogy}</p><p>${l.body}</p><details class="terms"><summary>Words made simple</summary><p>${l.terms}</p></details><pre><code id="example"></code></pre><label class="check"><input id="read" type="checkbox"> I can explain this concept</label><hr><h3>Check your understanding</h3><form id="quiz"><fieldset><legend>${l.question}</legend>${l.options.map((o,i) => `<label class="option"><input required type="radio" name="answer" value="${i}"> ${o}</label>`).join('')}</fieldset><button type="submit">Check answer</button></form><p id="feedback" role="status"></p><hr><h3>Put it into practice</h3><p>${l.challenge}</p><label for="draft">Your code or approach</label><textarea id="draft" maxlength="20000" rows="9" spellcheck="false" placeholder="Write your solution here…"></textarea><p class="storage-note">Scratchpad only. Code is not executed. Run Python / pytest / Java locally to verify your solution.</p><details><summary>Show reference solution and checks</summary><pre><code id="solution"></code></pre></details><label class="check"><input id="practice" type="checkbox"> I tested my solution locally and reviewed the edge cases</label><button id="next">Next lesson →</button>`;
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
    const game = document.createElement('section');
    game.id = 'game'; game.className = 'prediction-game';
    game.innerHTML = '<p class="eyebrow">MINI GAME / PREDICT → REVEAL</p><h3>Be the computer</h3><p>Read the highlighted instruction. Which state comes next? Pick a card to reveal the explanation.</p><p class="game-round"></p><pre class="game-code"></pre><div class="game-options"></div><p class="game-feedback" role="status"></p><button class="game-next" type="button" hidden>Next round →</button><p class="game-score"></p>';
    let round = 0, score = 0, attempts = 0;
    function drawRound() {
      const current = steps[round];
      game.querySelector('.game-round').textContent = `Round ${round + 1} of ${steps.length}`;
      game.querySelector('.game-code').textContent = current.code;
      game.querySelector('.game-feedback').textContent = '';
      game.querySelector('.game-next').hidden = true;
      const options = [...new Set([current.state, steps[(round + 1) % steps.length].state, 'The program stops here with an unexpected error.'])];
      options.sort(() => Math.random() - .5);
      let answered = false, roundGuesses = 0;
      game.querySelector('.game-options').replaceChildren(...options.map(option => {
        const button = document.createElement('button'); button.textContent = option;
        button.onclick = () => {
          if (answered) return;
          attempts++; roundGuesses++;
          if (option !== current.state) {
            button.disabled = true;
            game.querySelector('.game-feedback').textContent = 'Almost! Hint: ' + current.explanation;
            game.querySelector('.game-score').textContent = `${score} correct first tries · ${attempts} guesses`;
            return;
          }
          answered = true;
          if (roundGuesses === 1) score++;
          button.classList.add('correct-card');
          game.querySelector('.game-feedback').textContent = 'You got it! ' + current.explanation;
          game.querySelector('.game-next').hidden = false;
          game.querySelector('.game-next').textContent = round === steps.length - 1 ? 'Play again ↻' : 'Next round →';
          game.querySelector('.game-score').textContent = `${round + 1} states understood. Mistakes are part of learning.`;
          activity(); save(); summary();
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) button.animate([{transform:'scale(.97)'},{transform:'scale(1.03)'},{transform:'scale(1)'}],{duration:350});
        }; return button;
      }));
    }
    game.querySelector('.game-next').onclick = () => {round=(round+1)%steps.length; if(round===0){score=0;attempts=0;game.querySelector('.game-score').textContent='';} drawRound();};
    visual.after(game); drawRound();
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
  const videos = [
    {id:'rfscVS0vtbw', title:'Python foundations', creator:'freeCodeCamp · Mike Dane', goal:'Focus on functions, collections and classes. Pause and reproduce one example before continuing.'},
    {id:'cHYq1MRoyI0', title:'Testing Python with pytest', creator:'freeCodeCamp · Farhan Ali', goal:'Practice assertions, fixtures, parametrization and mocking. Write one passing and one failing test.'},
    {id:'A74TOX803D0', title:'Java programming foundations', creator:'freeCodeCamp', goal:'Focus on control flow, collections and OOP. Explain an object and its methods in your own words.'},
    {id:'QQliGCtqD2w', title:'Java testing with Selenium', creator:'freeCodeCamp · Rex Jones II', goal:'Follow the Page Object Model examples and browser interactions. Adapt selectors to a local practice site.'},
    {id:'j7VZsCCnptM', title:'Python browser automation with Selenium', creator:'freeCodeCamp · Jim Shaped Coding', goal:'Use this older course for browser fundamentals. Check current Selenium documentation for changed setup and driver APIs.'}
  ];
  const library = $('video-library');
  library.innerHTML = '<h3>Video classroom</h3><p>Choose a course, watch a short section, then rebuild the example. Videos load only when requested. Playback availability and captions depend on YouTube; the direct link is always available.</p>';
  for (const video of videos) {
    const card = document.createElement('section');card.className='video-card';
    const heading = document.createElement('h4'); heading.textContent=video.title;
    const credit = document.createElement('p');credit.textContent=video.creator;
    const goal = document.createElement('p');goal.textContent=video.goal;
    const button = document.createElement('button');button.type='button';button.textContent='Load video: '+video.title;
    const slot = document.createElement('div');
    button.onclick=()=>{
      const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+video.id;
      iframe.title=video.title;iframe.allow='encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.className='course-video';slot.replaceChildren(iframe);button.hidden=true;
    };
    const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+video.id;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Watch on YouTube ↗';
    card.append(heading,credit,goal,button,document.createTextNode(' '),link,slot);library.append(card);
  }
  const modules = window.AUTOMATION_MODULES;
  const moduleLibrary=$('module-library');
  moduleLibrary.innerHTML='<h3>12 practical workshops</h3><p>For each workshop: read the concept, attempt the prompt aloud, reveal the answer guide, then complete the exercise in a local project. Workshop activity is separate from the nine-lesson completion percentage.</p>';
  for(const [index,module] of modules.entries()) {
    const card=document.createElement('details');card.className='workshop';
    // Curriculum strings below are maintained in the checked-in resource file.
    card.innerHTML=`<summary>${index+1}. ${module.title}</summary><p class="eyebrow">${module.basis}</p><h4>Learn these topics</h4><p>${module.topics}</p><p class="analogy">${module.analogy}</p><h4>Try answering</h4><p>${module.question}</p><details><summary>Reveal answer guide</summary><p>${module.answer}</p></details><h4>Build it yourself</h4><p>${module.exercise}</p><a href="${module.docs}" target="_blank" rel="noopener noreferrer">Read the official documentation ↗</a>`;
    const recipe = document.createElement('section');
    const title = document.createElement('h4');title.textContent='Worked example';
    const code = document.createElement('pre');code.textContent=module.code;
    const explanation=document.createElement('p');explanation.textContent=module.codeExplanation;
    recipe.append(title,code,explanation);card.append(recipe);
    moduleLibrary.append(card);
  }
  const mock=document.createElement('section');mock.className='prediction-game';
  mock.innerHTML='<h3>Practice interview</h3><p>Use your own examples. Speak for 60–90 seconds before revealing the guide. These are original practice questions, not a transcript of an employer interview.</p><p class="mock-question"></p><button type="button" class="mock-answer">Reveal answer guide</button><p class="mock-guide" hidden></p><button type="button" class="mock-next">Another question →</button>';
  let mockIndex=0;
  function mockQuestion(){mock.querySelector('.mock-question').textContent=modules[mockIndex].question;mock.querySelector('.mock-guide').textContent=modules[mockIndex].answer;mock.querySelector('.mock-guide').hidden=true;mock.querySelector('.mock-answer').hidden=false;}
  mock.querySelector('.mock-next').onclick=()=>{mockIndex=(mockIndex+1)%modules.length;mockQuestion();};
  mock.querySelector('.mock-answer').onclick=()=>{mock.querySelector('.mock-guide').hidden=false;mock.querySelector('.mock-answer').hidden=true;};
  moduleLibrary.after(mock);mockQuestion();
  render();
})();
