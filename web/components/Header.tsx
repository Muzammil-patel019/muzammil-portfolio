"use client";
import Link from "next/link";
import { useState } from "react";
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="site-header">
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
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className="react-menu menu-toggle"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen(!open)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          Menu
        </button>
      </header>
    </>
  );
}
