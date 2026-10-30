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
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
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
  study.addEventListener('pointermove', event => {
    if (reduced.matches || !finePointer.matches) return;
    const bounds = study.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    study.style.setProperty('--tilt-x', `${-y * 7}deg`);
    study.style.setProperty('--tilt-y', `${x * 7}deg`);
    study.style.setProperty('--inspect-x', `${x * 14}px`);
    study.style.setProperty('--inspect-y', `${y * 14}px`);
  });
  const reset = () => {
    ['--tilt-x', '--tilt-y', '--inspect-x', '--inspect-y'].forEach(name => study.style.removeProperty(name));
  };
  study.addEventListener('pointerleave', reset);
  reduced.addEventListener('change', reset);

  const controls = study.querySelector('.inspection');
  const button = study.querySelector('.inspect-button');
  const status = study.querySelector('.inspection-status');
  const art = study.querySelector('.study-art');
  controls.hidden = false;
  let phase = 'idle';
  let bug;
  button.addEventListener('click', () => {
    if (phase === 'search') {
      bug.focus();
      return;
    }
    phase = 'search';
    study.classList.remove('inspection-passed');
    study.classList.add('inspection-active');
    button.textContent = 'Find the mismatch';
    status.textContent = 'One mark is out of place. Find and select the red ×.';
    art.removeAttribute('aria-hidden');
    bug = document.createElement('button');
    bug.type = 'button';
    bug.className = 'inspection-bug';
    bug.setAttribute('aria-label', 'Flag the mismatched mark');
    bug.textContent = '×';
    bug.style.left = `${20 + Math.random() * 55}%`;
    bug.style.top = `${14 + Math.random() * 48}%`;
    art.append(bug);
    bug.addEventListener('click', () => {
      phase = 'passed';
      study.classList.remove('inspection-active');
      study.classList.add('inspection-passed');
      bug.remove();
      art.setAttribute('aria-hidden', 'true');
      button.textContent = 'Run it again';
      status.textContent = 'Mismatch caught. A small detail makes all the difference.';
      button.focus();
      if (!reduced.matches) study.querySelector('.check-mark').animate([
        { transform: 'rotate(-12deg) scale(.8)' },
        { transform: 'rotate(-12deg) scale(1.15)', offset: .6 },
        { transform: 'rotate(-12deg) scale(1)' }
      ], { duration: 500, easing: 'ease-out' });
    });
  });
})();
