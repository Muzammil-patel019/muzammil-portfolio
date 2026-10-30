import { Header } from "@/components/Header";
export default function Page() {
  return (
    <>
      <Header />
      <main id="main" className="subpage-main">
        <div className="subpage-hero">
          <p className="eyebrow">PORTFOLIO / LINKS</p>
          <h1>Find me here.</h1>
        </div>
        <div className="link-list">
          {[
            ["GitHub", "https://github.com/Muzammil-patel019"],
            [
              "LinkedIn",
              "https://www.linkedin.com/in/muzammil-patel-375381224/",
            ],
            ["Resume", "/resume"],
          ].map(([n, h]) => (
            <a className="link-row" href={h} key={n}>
              {n} ↗
            </a>
          ))}
        </div>
      </main>
    </>
  );
}
