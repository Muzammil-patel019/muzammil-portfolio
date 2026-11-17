import type { Product } from "@/lib/lab/catalogue";
export function ProductArt({ product: p }: { product: Product }) {
  const paths: Record<Product["art"], React.ReactNode> = {
    headphones: (
      <>
        <path d="M48 87V62a42 42 0 0 1 84 0v25" fill="none" strokeWidth="13" />
        <rect x="39" y="67" width="22" height="43" rx="10" />
        <rect x="119" y="67" width="22" height="43" rx="10" />
      </>
    ),
    keyboard: (
      <>
        <rect x="23" y="44" width="134" height="65" rx="9" />
        {Array.from({ length: 24 }, (_, i) => (
          <rect
            key={i}
            x={32 + (i % 8) * 15}
            y={54 + Math.floor(i / 8) * 14}
            width="10"
            height="8"
            rx="2"
            fill="#f4f1e9"
            stroke="none"
          />
        ))}
        <rect
          x="63"
          y="96"
          width="54"
          height="5"
          rx="2"
          fill="#f4f1e9"
          stroke="none"
        />
      </>
    ),
    speaker: (
      <>
        <rect x="53" y="24" width="74" height="105" rx="28" />
        <circle
          cx="90"
          cy="69"
          r="23"
          fill="none"
          stroke="#f4f1e9"
          strokeWidth="2"
        />
        <circle cx="90" cy="69" r="14" fill="none" stroke="#f4f1e9" />
        <circle cx="90" cy="110" r="4" fill="#f4f1e9" stroke="none" />
      </>
    ),
    lamp: (
      <>
        <path d="M82 118h38M101 116V70l-26-26" fill="none" strokeWidth="8" />
        <path d="m50 55 21-28 31 24-21 28Z" />
        <path d="m55 58 27 19" stroke="#f4f1e9" strokeWidth="3" />
      </>
    ),
    notebook: (
      <>
        <rect x="51" y="18" width="82" height="117" rx="7" />
        <path d="M65 19v115M119 19v115" stroke="#f4f1e9" strokeWidth="2" />
        <path d="M76 53h31M76 62h23" stroke="#f4f1e9" strokeWidth="2" />
      </>
    ),
    stand: (
      <>
        <path d="m36 72 97-34 13 12-98 35Z" />
        <path d="m62 82 15 38h55l-9-10H87L76 77" />
        <path d="M41 69V58" fill="none" strokeWidth="6" />
      </>
    ),
    bag: (
      <>
        <path d="M70 36v-8a20 20 0 0 1 40 0v8" fill="none" strokeWidth="5" />
        <rect x="46" y="34" width="88" height="103" rx="25" />
        <rect
          x="58"
          y="86"
          width="64"
          height="36"
          rx="11"
          fill="none"
          stroke="#f4f1e9"
          strokeWidth="2"
        />
        <path d="M66 94h48" stroke="#f4f1e9" strokeWidth="2" />
      </>
    ),
    bottle: (
      <>
        <rect x="75" y="10" width="30" height="18" rx="4" />
        <rect x="66" y="27" width="48" height="108" rx="17" />
        <path d="M74 39v75" stroke="#f4f1e9" strokeWidth="3" opacity=".5" />
      </>
    ),
    pouch: (
      <>
        <rect x="36" y="48" width="108" height="71" rx="15" />
        <path d="M44 62h92" stroke="#f4f1e9" strokeWidth="2" />
        <path d="M120 61v13" stroke="#f4f1e9" strokeWidth="4" />
      </>
    ),
    mouse: (
      <>
        <rect x="60" y="22" width="60" height="111" rx="30" />
        <path d="M90 23v40M61 65h58" stroke="#f4f1e9" strokeWidth="2" />
        <rect
          x="87"
          y="37"
          width="6"
          height="15"
          rx="3"
          fill="#f4f1e9"
          stroke="none"
        />
      </>
    ),
    timer: (
      <>
        <circle cx="90" cy="77" r="49" />
        <circle cx="90" cy="77" r="38" fill="#f4f1e9" stroke="none" />
        <path d="M90 47v30l18 13" fill="none" strokeWidth="5" />
        <path d="M90 33v8M90 113v8M46 77h8M126 77h8" strokeWidth="2" />
      </>
    ),
    cup: (
      <>
        <path d="M122 49h9a22 22 0 0 1 0 44h-10" fill="none" strokeWidth="9" />
        <path d="M46 43h77v57a25 25 0 0 1-25 25H71a25 25 0 0 1-25-25Z" />
        <ellipse cx="84" cy="43" rx="38" ry="8" fill="#f4f1e9" />
      </>
    ),
  };
  return (
    <div className="lab-product-art" style={{ background: p.color }}>
      <svg
        viewBox="0 0 180 155"
        role="img"
        aria-label={p.name + " illustration"}
      >
        <g
          fill="#313b3b"
          stroke="#313b3b"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {paths[p.art]}
        </g>
      </svg>
    </div>
  );
}
