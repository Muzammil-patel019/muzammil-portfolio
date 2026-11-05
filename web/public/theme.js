(function () {
  var root = document.documentElement, choice = null;
  try { choice = localStorage.getItem('mp-theme'); } catch (_) {}
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply(theme) {
    root.dataset.theme = theme;
    window.dispatchEvent(new Event('mp-theme-change'));
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
    });
    document.querySelectorAll('iframe').forEach(function (frame) {
      try { if (new URL(frame.src, location.href).origin === location.origin) frame.contentWindow.postMessage({type:'mp-theme', theme:theme}, location.origin); } catch (_) {}
    });
  }
  window.mpToggleTheme = function () {
    choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('mp-theme', choice); } catch (_) {}
    apply(choice);
  };
  apply(choice === 'dark' || choice === 'light' ? choice : media.matches ? 'dark' : 'light');
  media.addEventListener('change', function () { if (choice !== 'dark' && choice !== 'light') apply(media.matches ? 'dark' : 'light'); });
  window.addEventListener('storage', function (event) { if (event.key === 'mp-theme') { choice = event.newValue; apply(choice === 'dark' || choice === 'light' ? choice : media.matches ? 'dark' : 'light'); } });
  window.addEventListener('message', function (event) { if (event.origin === location.origin && event.source === window.parent && event.data && event.data.type === 'mp-theme' && /^(dark|light)$/.test(event.data.theme)) { choice = event.data.theme; apply(choice); } });
  document.addEventListener('DOMContentLoaded', function () {
    if (root.hasAttribute('data-theme-standalone') && window.self === window.top) {
      var button = document.createElement('button'); button.className = 'theme-toggle'; button.dataset.themeToggle = ''; button.type = 'button'; button.setAttribute('aria-label', 'Toggle dark mode'); button.addEventListener('click', window.mpToggleTheme); document.body.append(button); apply(root.dataset.theme);
    }
  });
})();
