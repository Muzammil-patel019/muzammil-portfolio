(() => {
  const modules = window.ROLE_MODULES, key = 'mp-learning-v1', $ = id => document.getElementById(id);
  let state = {}, selected = 0, mock = 0;
  function normalize(document) {
    const result = document && typeof document === 'object' && !Array.isArray(document) ? document : {};
    const role = result.role && typeof result.role === 'object' ? result.role : {};
    const units = {};
    for (const m of modules) {
      const value = role.units?.[m.id] || {};
      units[m.id] = {read:value.read === true, quiz:value.quiz === true, practice:value.practice === true, draft:typeof value.draft === 'string' ? value.draft.slice(0,6000) : ''};
    }
    result.role = {pace:['rapid','steady','deep'].includes(role.pace) ? role.pace : 'steady',units,story:typeof role.story === 'string' ? role.story.slice(0,6000) : '',answers:modules.map((_,i) => typeof role.answers?.[i] === 'string' ? role.answers[i].slice(0,6000) : ''),ratings:modules.map((_,i) => [0,1,2,3].includes(role.ratings?.[i]) ? role.ratings[i] : 0)};
    return result;
  }
  try { state = normalize(JSON.parse(localStorage.getItem(key) || '{}')); } catch { state = normalize({}); }
  function save() {
    try { localStorage.setItem(key,JSON.stringify(state)); } catch { $('storage').textContent = 'Browser storage unavailable. Your changes remain in this tab only.'; }
    if (parent !== window) parent.postMessage({type:'learning-save',document:state},location.origin);
    summary();
  }
  window.addEventListener('message', e => {
    if (e.source !== parent || e.origin !== location.origin || e.data?.type !== 'learning-load') return;
    state = normalize(e.data.document); render();
    try { localStorage.setItem(key,JSON.stringify(state)); } catch { $('storage').textContent = 'Browser storage unavailable. Loaded progress remains in this tab.'; }
  });
  function summary() {
    const total = Object.values(state.role.units).reduce((sum,u) => sum + ['read','quiz','practice'].filter(k=>u[k]).length,0);
    $('score').textContent = `${total} / 36 milestones`; $('progress').value = total;
    $('pace').value = state.role.pace;
    $('schedule').textContent = {rapid:'Sessions 1–2: Python/Pytest and test design. 3–4: C++ component project. 5: MQTT and async. 6: tooling and traceability. 7: mock interview and weak spots. Allow 2–3 focused hours per session.',steady:'Sessions 1–12: one module per session. Session 13: rerun the project and investigate a deliberate defect. Session 14: mock interview and experience stories. Allow 60–90 minutes per session.',deep:'Sessions 1–24: two sessions per module, explanation then implementation. Sessions 25–26: real broker and Docker practice. Sessions 27–28: mock interviews and gap review. Allow 45–60 minutes per session.'}[state.role.pace];
    $('modules').replaceChildren(...modules.map((m,i)=>{const b=document.createElement('button'); b.textContent=`${m.title} · ${['read','quiz','practice'].filter(k=>state.role.units[m.id][k]).length}/3`;b.setAttribute('aria-current',String(i===selected));b.onclick=()=>{selected=i;lesson();summary();};return b;}));
  }
  function lesson() {
    const m=modules[selected], u=state.role.units[m.id];
    $('lesson').innerHTML = `<p class="eyebrow"></p><h2></h2><p class="analogy"></p><p class="explanation"></p><pre></pre><a class="source" target="_blank" rel="noopener noreferrer">Read official documentation</a><label><input id="read" type="checkbox"> I can explain this concept</label><h3>Predict the behavior</h3><form id="quiz"><fieldset><legend></legend></fieldset><button>Check answer</button></form><p id="feedback" role="status"></p><h3>Build it yourself</h3><p id="practice-task"></p><label for="draft">My code or test approach</label><textarea id="draft" maxlength="6000" rows="8"></textarea><p class="muted">Scratchpad only; run code locally. Saving text does not prove it works.</p><details><summary>Reference checks and discussion</summary><p id="guide"></p></details><label><input id="practice" type="checkbox"> I ran this locally and reviewed the edge cases</label><button id="next-module">Next module</button>`;
    const article=$('lesson');article.querySelector('.eyebrow').textContent=m.tag;article.querySelector('h2').textContent=m.title;article.querySelector('.analogy').textContent=m.analogy;article.querySelector('.explanation').textContent=m.body;article.querySelector('pre').textContent=m.code;article.querySelector('.source').href=m.url;article.querySelector('legend').textContent=m.question;
    m.options.forEach((option,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='answer';input.value=i;input.required=true;label.append(input,document.createTextNode(option));article.querySelector('fieldset').append(label);});
    $('practice-task').textContent=m.practice;$('guide').textContent=m.guide;$('draft').value=u.draft;
    for(const field of ['read','practice']) {$ (field).checked=u[field];$(field).onchange=e=>{u[field]=e.target.checked;save();};}
    $('draft').oninput=e=>{u.draft=e.target.value;save();};
    $('quiz').onsubmit=e=>{e.preventDefault();const correct=Number(new FormData(e.target).get('answer'))===m.answer;if(correct)u.quiz=true;$('feedback').textContent=correct?'Correct. '+m.guide:'Try again. '+m.body;save();};
    $('next-module').onclick=()=>{selected=(selected+1)%modules.length;lesson();summary();};
  }
  function showMock(){const m=modules[mock];$('mock-question').textContent=`${mock+1} / ${modules.length}: ${m.practice}`;$('mock-answer').value=state.role.answers[mock];$('rating').value=state.role.ratings[mock];$('mock-guide').hidden=true;$('mock-guide').textContent=m.guide;$('mock-status').textContent='Explain the approach, tradeoffs, diagnostics and limits. Aim for a 2–3 minute answer.';}
  function render(){summary();lesson();$('story').value=state.role.story;showMock();}
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!==button.dataset.tab);});
  $('pace').onchange=e=>{state.role.pace=e.target.value;save();};$('story').oninput=e=>{state.role.story=e.target.value;save();};
  $('mock-answer').oninput=e=>{state.role.answers[mock]=e.target.value;save();};$('rating').onchange=e=>{state.role.ratings[mock]=Number(e.target.value);save();};$('reveal').onclick=()=>{$('mock-guide').hidden=false;};$('next-question').onclick=()=>{mock=(mock+1)%modules.length;showMock();};
  $('export').onclick=()=>{const text=['My interview preparation',state.role.story,...modules.map((m,i)=>`${m.title}\nPractice notes: ${state.role.units[m.id].draft}\nMock answer: ${state.role.answers[i]}\nSelf-review: ${state.role.ratings[i]}/3`)].join('\n\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.href=url;a.download='my-interview-preparation.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const seen=new Set();let deliveries=0;
  function deliver(){deliveries++;const duplicate=seen.has('cmd-7');seen.add('cmd-7');$('event').textContent=`Delivery ${deliveries}: cmd-7 ${duplicate?'already handled; duplicate ignored.':'validated and applied.'}`;$('actions').textContent=`Applied actions: ${seen.size}`;}
  $('deliver').onclick=deliver;$('duplicate').onclick=deliver;$('reset-game').onclick=()=>{seen.clear();deliveries=0;$('event').textContent='Ready: no commands received.';$('actions').textContent='Applied actions: 0';$('game-feedback').textContent='';};$('check-game').onclick=()=>{$('game-feedback').textContent=$('prediction').value==='1'?'Correct: deduplication is application behavior. QoS 1 alone does not provide it.':'Choose 1: two deliveries of the same command ID should cause one action under this contract.';};
  render();
})();
