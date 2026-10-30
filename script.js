/* Small, keyboard-accessible mobile navigation. */
(() => {
  const button = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-nav');
  if (!button || !navigation) return;
  document.documentElement.dataset.js = '';
  const close = () => {
    button.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  };
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      close();
      button.focus();
    }
  });
  window.matchMedia('(min-width: 921px)').addEventListener('change', close);
})();

/* Motion is progressive enhancement: the full page stays readable without it. */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const items = document.querySelectorAll('.section-heading, .card, .skills-grid > div, .case-list .page-card, .link-row, .contact-card');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!reduced.matches) {
        entry.target.animate([
          { opacity: .35, transform: 'translateY(22px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: .12 });
  items.forEach(item => observer.observe(item));
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.getAnimations().forEach(animation => animation.cancel());
  });

  const study = document.querySelector('.test-study');
  if (!study) return;
  const controls = study.querySelector('.inspection');
  const button = study.querySelector('.inspect-button');
  const status = study.querySelector('.inspection-status');
  const art = study.querySelector('.study-art');
  controls.hidden = false;
  let round = 0;
  let mistakes = 0;
  const patterns = ['┌', '┐', '└'];
  const variants = ['┐', '┘', '┌'];
  function beginRound() {
    study.classList.remove('inspection-passed');
    study.classList.add('inspection-active', 'inspection-playing');
    art.removeAttribute('aria-hidden');
    art.querySelector('.inspection-grid')?.remove();
    const grid = document.createElement('div');
    grid.className = 'inspection-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', `Inspection ${round + 1}: find the different corner`);
    const mismatch = Math.floor(Math.random() * 16);
    for (let i = 0; i < 16; i++) {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'inspection-tile';
      tile.textContent = i === mismatch ? variants[round] : patterns[round];
      tile.setAttribute('aria-label', `Mark ${i + 1}: ${i === mismatch ? ['top right', 'bottom right', 'top left'][round] : ['top left', 'top right', 'bottom left'][round]} corner`);
      tile.addEventListener('click', () => {
        if (i !== mismatch) {
          mistakes++;
          tile.classList.add('tile-reviewed');
          status.textContent = 'That one matches. Compare the direction of each corner.';
          return;
        }
        round++;
        if (round < 3) {
          status.textContent = `Caught it. Inspection ${round + 1} of 3 — look for the different corner.`;
          beginRound();
          art.querySelector('.inspection-tile')?.focus();
        } else {
          grid.remove();
          study.classList.remove('inspection-active', 'inspection-playing');
          study.classList.add('inspection-passed');
          art.setAttribute('aria-hidden', 'true');
          button.textContent = 'Try a new inspection';
          status.textContent = `3 of 3 caught. ${mistakes === 0 ? 'A clean inspection.' : 'Every second look counts.'}`;
          study.querySelector('.study-foot').textContent = 'INSPECTION COMPLETE / ALL DETAILS VERIFIED';
          button.focus();
          if (!reduced.matches) study.querySelector('.check-mark').animate([
            { transform: 'rotate(-12deg) scale(.5)', opacity: 0 },
            { transform: 'rotate(-12deg) scale(1.12)', opacity: 1, offset: .7 },
            { transform: 'rotate(-12deg) scale(1)' }
          ], { duration: 600, easing: 'ease-out' });
        }
      });
      grid.append(tile);
    }
    art.append(grid);
    button.textContent = 'Restart inspection';
    study.querySelector('.study-foot').textContent = `DETAIL STUDY / ${String(round + 1).padStart(2, '0')} OF 03`;
  }
  button.addEventListener('click', () => {
    round = 0;
    mistakes = 0;
    status.textContent = 'Inspection 1 of 3. Select the corner facing a different direction.';
    beginRound();
    art.querySelector('.inspection-tile')?.focus();
  });
})();

/* Explore actual experience by the kind of automation involved. */
(() => {
  const list = document.querySelector('.experience-grid, .case-list');
  if (!list) return;
  const cards = [...list.children];
  const toolbar = document.createElement('div');
  toolbar.className = 'work-filters';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Filter automation experience');
  const status = document.createElement('span');
  status.className = 'filter-status';
  status.setAttribute('role', 'status');
  for (const [label, keyword] of [['All work', ''], ['Desktop', 'desktop'], ['Web', 'web']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-pressed', String(keyword === ''));
    button.addEventListener('click', () => {
      toolbar.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      cards.forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(keyword); });
      const count = cards.filter(card => !card.hidden).length;
      status.textContent = `${String(count).padStart(2, '0')} / PROJECTS`;
    });
    toolbar.append(button);
  }
  status.textContent = `${String(cards.length).padStart(2, '0')} / PROJECTS`;
  toolbar.append(status);
  list.before(toolbar);
})();

/* A useful contact shortcut, with a fallback for downloaded file previews. */
(() => {
  const email = document.querySelector('.email');
  if (!email) return;
  const button = document.createElement('button');
  button.className = 'copy-email';
  button.type = 'button';
  button.textContent = 'Copy email address';
  const status = document.createElement('span');
  status.className = 'copy-status';
  status.setAttribute('role', 'status');
  button.addEventListener('click', async () => {
    const address = email.getAttribute('href').replace('mailto:', '');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(address);
      status.textContent = 'Copied — ready when you are.';
    } catch {
      status.textContent = 'Select the email address above to copy it, or click it to send a message.';
    }
  });
  const controls = document.createElement('div');
  controls.className = 'copy-controls';
  controls.append(button, status);
  email.after(controls);
})();

/* The inspector is movable by its handle; keyboard users get the same control. */
(() => {
  const desk = document.querySelector('.play-desk');
  const panel = desk?.querySelector('.test-study');
  const handle = desk?.querySelector('.desk-handle');
  const reset = desk?.querySelector('.desk-reset');
  if (!handle) return;
  handle.hidden = false;
  reset.hidden = false;
  let x = 0;
  let y = 0;
  let drag;
  const move = (nextX, nextY) => {
    const maxX = Math.max(0, desk.clientWidth - panel.offsetWidth - panel.offsetLeft - 10);
    const minX = -panel.offsetLeft + 10;
    const maxY = Math.max(0, desk.clientHeight - panel.offsetHeight - panel.offsetTop - 30);
    x = Math.max(minX, Math.min(maxX, nextX));
    y = Math.max(-panel.offsetTop + 50, Math.min(maxY, nextY));
    panel.style.setProperty('--desk-x', `${x}px`);
    panel.style.setProperty('--desk-y', `${y}px`);
  };
  handle.addEventListener('pointerdown', event => {
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    move(drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY);
  });
  const finish = () => { drag = null; };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('lostpointercapture', finish);
  handle.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-12,0], ArrowRight: [12,0], ArrowUp: [0,-12], ArrowDown: [0,12] };
    if (!steps[event.key]) return;
    event.preventDefault();
    move(x + steps[event.key][0], y + steps[event.key][1]);
  });
  reset.addEventListener('click', () => move(0,0));
  window.addEventListener('resize', () => move(x,y));
  // The game changes the window height; keep the expanded panel on the desk.
  new ResizeObserver(() => move(x, y)).observe(panel);
})();
