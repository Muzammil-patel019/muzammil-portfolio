"use client";
import { useState, useRef, useEffect } from "react";
export function Desk() {
  const [round, setRound] = useState(-1),
    [target, setTarget] = useState(0),
    [message, setMessage] = useState(
      "A tiny test of your attention to detail.",
    );
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (round >= 0 && round < 3)
      gridRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    if (round === 3) startRef.current?.focus();
  }, [round]);
  const patterns = ["┌", "┐", "└"],
    variants = ["┐", "┘", "┌"];
  function start() {
    setRound(0);
    setTarget(Math.floor(Math.random() * 16));
    setMessage("Find the corner facing a different direction.");
  }
  function flag(i: number) {
    if (i !== target) {
      setMessage("That one matches. Look at the direction.");
      return;
    }
    if (round === 2) {
      setRound(3);
      setMessage("3 of 3 caught. A clean inspection.");
    } else {
      setRound(round + 1);
      setTarget(Math.floor(Math.random() * 16));
      setMessage("Caught it. Keep looking.");
    }
  }
  function move(x: number, y: number) {
    setPosition({
      x: Math.max(-10, Math.min(30, x)),
      y: Math.max(-65, Math.min(15, y)),
    });
  }
  return (
    <div className="play-desk">
      <div className="desk-heading">
        <span>THE QUALITY DESK</span>
        <button
          className="desk-reset"
          onClick={() => setPosition({ x: 0, y: 0 })}
        >
          Reset desk
        </button>
      </div>
      <div className="desk-note note-one">
        <span>MY DAILY ROUTINE</span>
        <strong>
          Break it.
          <br />
          Understand it.
          <br />
          Make it better.
        </strong>
      </div>
      <div className="desk-note note-two">
        <span>BASED IN</span>
        <strong>Bengaluru.</strong>
        <span>Thinking in test cases.</span>
      </div>
      <aside
        className={`test-study ${round >= 0 && round < 3 ? "inspection-playing" : ""}`}
        style={{
          transform: `translate(${position.x}px,${position.y}px) rotate(-3deg)`,
        }}
      >
        <div className="study-label">
          <span>detail-inspector.exe</span>
          <button
            className="desk-handle"
            aria-label="Move inspector with arrow keys"
            onPointerDown={(e) => {
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                px: position.x,
                py: position.y,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (d) move(d.px + e.clientX - d.x, d.py + e.clientY - d.y);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              const steps: Record<string, number[]> = {
                ArrowUp: [0, -10],
                ArrowDown: [0, 10],
                ArrowLeft: [-10, 0],
                ArrowRight: [10, 0],
              };
              if (steps[e.key]) {
                e.preventDefault();
                move(
                  position.x + steps[e.key][0],
                  position.y + steps[e.key][1],
                );
              }
            }}
          >
            MOVE
          </button>
        </div>
        <div className="study-art">
          {round >= 0 && round < 3 ? (
            <div
              className="inspection-grid"
              ref={gridRef}
              role="group"
              aria-label={`Inspection ${round + 1} of 3`}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <button
                  className="inspection-tile"
                  key={i}
                  aria-label={`Mark ${i + 1}: ${i === target ? ["top right", "bottom right", "top left"][round] : ["top left", "top right", "bottom left"][round]} corner`}
                  onClick={() => flag(i)}
                >
                  {i === target ? variants[round] : patterns[round]}
                </button>
              ))}
            </div>
          ) : (
            <>
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <span className="check-mark">✓</span>
            </>
          )}
        </div>
        <div className="study-caption">
          <p>
            Looks right?
            <br />
            <strong>Let’s put that to the test.</strong>
          </p>
        </div>
        <button ref={startRef} className="inspect-button" onClick={start}>
          {round === 3 ? "Try a new inspection" : "Run an inspection"}
        </button>
        <p className="inspection-status" role="status">
          {message}
        </p>
        <div className="study-foot">INSPECT → AUTOMATE → VERIFY</div>
      </aside>
      <p className="desk-hint">
        Try the inspector. Move the window. Make yourself at home.
      </p>
    </div>
  );
}
