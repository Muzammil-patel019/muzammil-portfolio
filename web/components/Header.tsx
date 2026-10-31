"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width:921px)");
    const resize = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header" ref={header}>
        <Link className="brand" href="/" aria-label="Muzammil Patel home">
          mp<span>.</span>
        </Link>
        <nav
          id="main-nav"
          aria-label="Main navigation"
          className={open ? "react-nav-open" : ""}
        >
          {[
            ["/", "Home"],
            ["/projects", "Projects"],
            ["/blog", "Blog"],
            ["/resume", "Resume"],
            ["/links", "Links"],
            ["/#contact", "Contact"],
          ].map(([href, label]) => (
            <Link
              href={href}
              key={href}
              aria-current={href === pathname ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          ref={button}
          type="button"
          className="react-menu menu-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </header>
    </>
  );
}
