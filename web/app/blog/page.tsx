import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Header } from "@/components/Header";
import { blogPath, blogSlugs, topics } from "./lessons";
import styles from "./blog.module.css";

export const metadata: Metadata = {
  title: "Everyday Basics | Muzammil Patel",
  description:
    "Explore short explainers about nature, space, travel, technology and everyday life.",
};

const featured = topics.slice(0, 3).map((topic) => topic.lessons[0]);
const lessonCount = topics.reduce(
  (total, topic) => total + topic.lessons.length,
  0,
);

export default function Page() {
  return (
    <>
      <Header />
      <Script id="blog-fragment-redirect" strategy="afterInteractive">
        {`if (${JSON.stringify(blogSlugs)}.includes(location.hash.slice(1))) {
          location.replace("/blog/" + location.hash.slice(1));
        }`}
      </Script>
      <main id="main" className={styles.blog}>
        <header className={styles.intro}>
          <h1>Everyday Basics</h1>
          <p>
            {lessonCount} short lessons about how the world around you works.
          </p>
        </header>

        <section className={styles.directory} id="lesson-index">
          <h2>Browse by topic</h2>
          <ul className={styles.topicGrid}>
            {topics.map(({ heading, id, description, lessons }) => (
              <li key={id}>
                <Link href={blogPath(id)} prefetch={false}>
                  <strong>{heading}</strong>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                  <span className={styles.description}>{description}</span>
                  <small>{lessons.length} lessons</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.directory}>
          <h2>Start with a question</h2>
          <ul className={styles.lessonList}>
            {featured.map(({ slug, title }) => (
              <li key={slug}>
                <Link href={blogPath(slug)} prefetch={false}>
                  {title}
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
