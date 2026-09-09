/* Shared portfolio behavior.
   Everything works as ordinary HTML when JavaScript is unavailable. */
(() => {
  "use strict";

  const root = document.documentElement;
  root.dataset.js = "";

  // Motion preference: the operating-system setting always takes priority.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const compactScreen = window.matchMedia("(max-width: 760px)");
  const motionButton = document.querySelector(".motion-toggle");
  const motionLabel = document.querySelector(".motion-label");
  const motionListeners = new Set();
  let visitorPaused = false;

  try {
    visitorPaused = localStorage.getItem("portfolio:motion") === "paused";
  } catch {
    // Private browsing can block storage; the switch still works on this page.
  }

  let motionEnabled = !reducedMotion.matches && !visitorPaused;

  function updateMotion() {
    motionEnabled = !reducedMotion.matches && !visitorPaused;
    root.dataset.motion = motionEnabled ? "on" : "off";

    if (motionButton && motionLabel) {
      motionButton.hidden = false;
      motionButton.disabled = reducedMotion.matches;
      const label = reducedMotion.matches
        ? "Reduced motion"
        : motionEnabled ? "Pause motion" : "Resume motion";
      motionLabel.textContent = label;
      motionButton.setAttribute("aria-label", label);
      motionButton.title = reducedMotion.matches
        ? "Animations are off because of your device's reduced-motion setting."
        : label;
    }

    motionListeners.forEach((listener) => listener(motionEnabled));
  }

  motionButton?.addEventListener("click", () => {
    visitorPaused = !visitorPaused;
    try {
      localStorage.setItem("portfolio:motion", visitorPaused ? "paused" : "auto");
    } catch {
      // Saving is optional.
    }
    updateMotion();
  });

  reducedMotion.addEventListener("change", updateMotion);
  updateMotion();

  // Accessible mobile navigation, including Escape and outside-click handling.
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector("#main-nav");
  const desktopNavigation = window.matchMedia("(min-width: 921px)");

  function closeMenu() {
    menuButton?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  }

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
    });
    navigation.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".site-header")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menuButton.focus();
      }
    });
    desktopNavigation.addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });
  }

  // Type the greeting once; a hidden full copy prevents content jumping.
  const heading = document.querySelector("#typed-greeting");

  if (heading && motionEnabled) {
    const greeting = heading.getAttribute("aria-label") || heading.textContent.trim();
    const accentIndex = greeting.lastIndexOf("Engineer.");
    const reserved = document.createElement("span");
    reserved.className = "greeting-space";
    reserved.textContent = greeting;
    reserved.setAttribute("aria-hidden", "true");

    const visual = document.createElement("span");
    visual.className = "greeting-visual";
    visual.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    const caret = document.createElement("span");
    caret.className = "greeting-cursor";
    visual.append(text, caret);
    heading.replaceChildren(reserved, visual);

    function paintGreeting(value) {
      if (accentIndex < 0 || value.length <= accentIndex) {
        text.textContent = value;
        return;
      }
      const accent = document.createElement("span");
      accent.className = "engineer-accent";
      accent.textContent = value.slice(accentIndex);
      text.replaceChildren(document.createTextNode(value.slice(0, accentIndex)), accent);
    }

    let letter = 0;
    let typingTimer = 0;
    function finishGreeting() {
      clearTimeout(typingTimer);
      paintGreeting(greeting);
      letter = greeting.length;
    }
    function typeNextLetter() {
      if (!motionEnabled || document.hidden) {
        finishGreeting();
        return;
      }
      paintGreeting(greeting.slice(0, ++letter));
      if (letter < greeting.length) {
        typingTimer = setTimeout(typeNextLetter, 45);
      }
    }

    typingTimer = setTimeout(typeNextLetter, 180);
    motionListeners.add((enabled) => {
      if (!enabled) finishGreeting();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) finishGreeting();
    });
  }

  // Scroll reveals animate only on entry. Content is never hidden in CSS.
  if ("IntersectionObserver" in window) {
    const runningAnimations = new Set();
    const reveals = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveals.unobserve(entry.target);
        if (!motionEnabled || typeof entry.target.animate !== "function") return;

        const animation = entry.target.animate(
          [
            { opacity: 0.65, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 420, easing: "cubic-bezier(.2,.7,.3,1)" }
        );
        runningAnimations.add(animation);
        animation.onfinish = animation.oncancel = () => runningAnimations.delete(animation);
      });
    }, { threshold: 0.08 });

    document.querySelectorAll(".card, .page-card, .skills-grid > div, .contact-card, .link-row")
      .forEach((element) => reveals.observe(element));

    motionListeners.add((enabled) => {
      if (!enabled) {
        runningAnimations.forEach((animation) => animation.cancel());
        runningAnimations.clear();
      }
    });

    // Only section links participate; inner-page aria-current stays intact.
    const sectionLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
    if (sectionLinks.length) {
      const sections = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          sectionLinks.forEach((link) => {
            if (link.hash === "#" + entry.target.id) {
              link.setAttribute("aria-current", "location");
            } else {
              link.removeAttribute("aria-current");
            }
          });
        });
      }, { rootMargin: "-10% 0px -55% 0px" });
      document.querySelectorAll("main > section[id]").forEach((section) => sections.observe(section));
    }
  }

  // The glow follows a desktop pointer over the entire page, not a clipped card.
  const glow = document.querySelector(".page-glow");
  const skyPointer = { x: 0, y: 0 };
  let glowFrame = 0;
  let cursorX = 0;
  let cursorY = 0;

  document.addEventListener("pointermove", (event) => {
    if (!motionEnabled || !finePointer.matches || event.pointerType !== "mouse") return;
    cursorX = event.clientX;
    cursorY = event.clientY;
    if (glowFrame) return;

    glowFrame = requestAnimationFrame(() => {
      glowFrame = 0;
      if (!motionEnabled || document.hidden) return;
      glow?.style.setProperty("--x", cursorX + "px");
      glow?.style.setProperty("--y", cursorY + "px");
      skyPointer.x = (cursorX / window.innerWidth - 0.5) * 12;
      skyPointer.y = (cursorY / window.innerHeight - 0.5) * 9;
    });
  }, { passive: true });

  motionListeners.add((enabled) => {
    if (!enabled && glowFrame) {
      cancelAnimationFrame(glowFrame);
      glowFrame = 0;
    }
  });

  // Original pixel companion: gentle float, pointer response, and a tap greeting.
  const robot = document.querySelector(".robot-stage");
  const robotMessage = document.querySelector(".robot-message");
  let robotFrame = 0;

  if (robot) {
    let robotX = 0;
    function resetRobot() {
      if (robotFrame) cancelAnimationFrame(robotFrame);
      robotFrame = 0;
      robot.style.setProperty("--robot-x", "0px");
      robot.style.setProperty("--robot-angle", "0deg");
    }

    robot.addEventListener("pointermove", (event) => {
      if (!motionEnabled || !finePointer.matches || event.pointerType !== "mouse") return;
      robotX = event.clientX;
      if (robotFrame) return;
      robotFrame = requestAnimationFrame(() => {
        robotFrame = 0;
        if (!motionEnabled) return;
        const bounds = robot.getBoundingClientRect();
        const offset = Math.max(-1, Math.min(1, (robotX - bounds.left) / bounds.width * 2 - 1));
        robot.style.setProperty("--robot-x", offset * 7 + "px");
        robot.style.setProperty("--robot-angle", offset * 4 + "deg");
      });
    }, { passive: true });

    robot.addEventListener("pointerleave", resetRobot);
    robot.addEventListener("click", () => {
      if (robotMessage) robotMessage.textContent = "Hello, visitor.";
      if (motionEnabled) robot.classList.add("is-greeting");
    });
    robot.addEventListener("animationend", (event) => {
      if (event.animationName === "robot-greet") robot.classList.remove("is-greeting");
    });
    motionListeners.add((enabled) => {
      if (!enabled) {
        resetRobot();
        robot.classList.remove("is-greeting");
      }
    });
  }

  // Small canvas particle field: capped stars, capped resolution, 15/24 fps.
  // The loop stops completely in background tabs and when motion is paused.
  function initializeStarfield() {
    const canvas = document.querySelector("#starfield");
    if (!canvas) return;
    let context;
    try {
      context = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!context) return;

    let width = 1;
    let height = 1;
    let stars = [];
    let frame = 0;
    let lastFrame = null;
    let elapsed = 0;
    let seed = 17;

    function random() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      const desktop = !compactScreen.matches;

      for (const star of stars) {
        const x = ((star.x * width - elapsed * star.depth * 1.5 + skyPointer.x * star.depth) % width + width) % width;
        const y = ((star.y * height + skyPointer.y * star.depth) % height + height) % height;
        context.globalAlpha = star.opacity + Math.sin(elapsed * 0.35 + star.phase) * 0.08;
        context.fillStyle = star.color;
        context.fillRect(x, y, star.size, star.size);
      }

      // One faint passing streak every 18 seconds, on larger screens only.
      const phase = elapsed % 18;
      if (motionEnabled && desktop && phase > 12 && phase < 13.2) {
        const progress = (phase - 12) / 1.2;
        const x = width * (0.72 - progress * 0.32);
        const y = height * (0.08 + progress * 0.2);
        const tail = context.createLinearGradient(x, y, x + 80, y - 34);
        tail.addColorStop(0, "#b6eee5");
        tail.addColorStop(1, "transparent");
        context.globalAlpha = Math.sin(progress * Math.PI) * 0.35;
        context.strokeStyle = tail;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 80, y - 34);
        context.stroke();
      }
      context.globalAlpha = 1;
    }

    function tick(timestamp) {
      frame = 0;
      if (!motionEnabled || document.hidden) {
        lastFrame = null;
        return;
      }
      const interval = 1000 / (compactScreen.matches ? 15 : 24);
      if (lastFrame === null || timestamp - lastFrame >= interval) {
        if (lastFrame !== null) elapsed += Math.min((timestamp - lastFrame) / 1000, 0.15);
        lastFrame = timestamp;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }

    function synchronize() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = null;
      if (document.hidden) return;
      draw();
      if (motionEnabled) frame = requestAnimationFrame(tick);
    }

    function resize() {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed = 17;
      const cap = compactScreen.matches ? 32 : 95;
      const count = Math.min(cap, Math.max(20, Math.round(width * height / 14000)));
      stars = Array.from({ length: count }, () => ({
        x: random(),
        y: random(),
        depth: 0.25 + random() * 0.75,
        size: 0.7 + random() * 1.1,
        opacity: 0.22 + random() * 0.3,
        phase: random() * Math.PI * 2,
        color: random() > 0.85 ? "#5eead4" : "#b3c9df"
      }));
      synchronize();
    }

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", synchronize);
    motionListeners.add(synchronize);
    resize();
  }

  function updateVisibility() {
    root.dataset.visibility = document.hidden ? "hidden" : "visible";
    if (document.hidden && glowFrame) {
      cancelAnimationFrame(glowFrame);
      glowFrame = 0;
    }
  }
  document.addEventListener("visibilitychange", updateVisibility);
  updateVisibility();
  initializeStarfield();
})();
