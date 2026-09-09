/* Restore appearance before the stylesheet paints; storage is optional. */
(() => {
  "use strict";
  const root = document.documentElement;
  const options = { theme: ["space", "terminal"], accent: ["sky", "mint", "violet", "amber"] };
  for (const [key, values] of Object.entries(options)) {
    let value = values[0];
    try {
      const saved = localStorage.getItem(`portfolio:${key}`);
      if (values.includes(saved)) value = saved;
    } catch { /* Preferences still work without storage. */ }
    root.dataset[key] = value;
  }
  document.addEventListener("DOMContentLoaded", () => {
    const picker = document.querySelector(".appearance");
    if (!picker) return;
    picker.hidden = false;
    picker.querySelectorAll("input").forEach(input => {
      input.checked = root.dataset[input.name] === input.value;
      input.addEventListener("change", () => {
        if (!options[input.name]?.includes(input.value)) return;
        root.dataset[input.name] = input.value;
        try { localStorage.setItem(`portfolio:${input.name}`, input.value); } catch {}
      });
    });
    document.addEventListener("click", event => {
      if (!picker.contains(event.target)) picker.open = false;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && picker.open) {
        picker.open = false;
        picker.querySelector("summary").focus();
      }
    });
  });
})();
