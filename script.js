// The invisible copy reserves the full heading height on every screen size.
const nameElement = document.querySelector("#typed-greeting");
const preference = matchMedia("(prefers-reduced-motion: reduce)");
if (nameElement && !preference.matches) {
  const greeting = nameElement.textContent;
  const space = document.createElement("span");
  space.className = "greeting-space";
  space.textContent = greeting;
  space.setAttribute("aria-hidden", "true");
  const visual = document.createElement("span");
  visual.className = "greeting-visual";
  visual.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  const engineerIndex = greeting.lastIndexOf("Engineer.");
  function paintGreeting(value) {
    text.replaceChildren(
      document.createTextNode(value.slice(0, engineerIndex))
    );
    if (value.length > engineerIndex) {
      const accent = document.createElement("span");
      accent.className = "engineer-accent";
      accent.textContent = value.slice(engineerIndex);
      text.append(accent);
    }
  }
  const cursor = document.createElement("span");
  cursor.className = "greeting-cursor";
  visual.append(text, cursor);
  nameElement.replaceChildren(space, visual);
  let index = 0;
  let timer;
  function finish() {
    clearTimeout(timer);
    paintGreeting(greeting);
    cursor.remove();
  }
  function type() {
    paintGreeting(greeting.slice(0, ++index));
    if (index < greeting.length) timer = setTimeout(type, 60);
  }
  timer = setTimeout(type, 250);
  preference.addEventListener("change", (e) => {
    if (e.matches) finish();
  });
}
// Highlight the navigation link for the section being read.
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        document.querySelectorAll("nav a").forEach((link) => {
          if (link.hash === "#" + entry.target.id)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }
    },
    { rootMargin: "-10% 0px -60% 0px" }
  );
  document
    .querySelectorAll("main > section[id]")
    .forEach((section) => observer.observe(section));
}
// One brief entrance per block. Content is never hidden while waiting to scroll.
if ("IntersectionObserver" in window && !preference.matches) {
  const running = new Set();
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal.unobserve(entry.target);
        if (preference.matches || typeof entry.target.animate !== "function")
          continue;
        const animation = entry.target.animate(
          [
            { opacity: 0.6, transform: "translateY(12px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 380, easing: "cubic-bezier(.2,.7,.3,1)" }
        );
        running.add(animation);
        animation.onfinish = () => running.delete(animation);
      }
    },
    { threshold: 0.08 }
  );
  document
    .querySelectorAll(".card,.skills-grid > div,.contact")
    .forEach((el) => reveal.observe(el));
  preference.addEventListener("change", (e) => {
    if (e.matches) {
      reveal.disconnect();
      running.forEach((a) => a.cancel());
      running.clear();
    }
  });
}

// A viewport-wide spotlight avoids the rectangular clipping of section backgrounds.
const glow = document.querySelector(".page-glow");
const pointerMode = matchMedia("(hover:hover) and (pointer:fine)");
let pointerFrame = 0;
let px = innerWidth * 0.2,
  py = 180;
document.addEventListener("pointermove", (e) => {
  if (preference.matches || !pointerMode.matches) return;
  px = e.clientX;
  py = e.clientY;
  if (!pointerFrame)
    pointerFrame = requestAnimationFrame(() => {
      glow.style.setProperty("--x", px + "px");
      glow.style.setProperty("--y", py + "px");
      pointerFrame = 0;
    });
});
const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#main-nav");
function closeMenu() {
  toggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}
toggle.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});
nav
  .querySelectorAll("a")
  .forEach((a) => a.addEventListener("click", closeMenu));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
    closeMenu();
    toggle.focus();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".site-header")) closeMenu();
});
matchMedia("(min-width:721px)").addEventListener("change", (e) => {
  if (e.matches) closeMenu();
});
