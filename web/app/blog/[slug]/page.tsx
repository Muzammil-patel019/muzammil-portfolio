import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { blogPath, blogSlugs, findLesson, topics } from "../lessons";
import styles from "../blog.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return blogSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = topics.find(({ id }) => id === slug);
  if (topic) {
    return {
      title: `${topic.heading} | Everyday Basics`,
      description: topic.description,
    };
  }

  const result = findLesson(slug);
  if (!result) notFound();
  return {
    title: `${result.lesson.title} | Everyday Basics`,
    description: result.lesson.answer,
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const topic = topics.find(({ id }) => id === slug);

  if (topic) {
    return (
      <>
        <Header />
        <main id="main" className={styles.blog}>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
            <Link href="/blog">← All topics</Link>
          </nav>
          <header className={styles.intro}>
            <h1>{topic.heading}</h1>
            <p>{topic.description}</p>
          </header>
          <ul className={styles.lessonList}>
            {topic.lessons.map(({ slug, title }) => (
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
        </main>
      </>
    );
  }

  const result = findLesson(slug);
  if (!result) notFound();
  const { topic: lessonTopic, lesson, previous, next } = result;

  return (
    <>
      <Header />
      <main id="main" className={`${styles.blog} ${styles.reading}`}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/blog">All topics</Link>
          <span aria-hidden="true">/</span>
          <Link href={blogPath(lessonTopic.id)}>{lessonTopic.heading}</Link>
        </nav>
        <article className={styles.article}>
          <header className={styles.intro}>
            <h1>{lesson.title}</h1>
            <p className={styles.answer}>
              <strong>{lesson.answer}</strong>
            </p>
          </header>
          <section>
            <h2>How it works</h2>
            <p>{lesson.explanation}</p>
          </section>
          {lesson.figure && (
            <figure className={styles.figure}>
              <Image
                src={`/blog/testing/${lesson.figure.src}`}
                alt={lesson.figure.alt}
                width={960}
                height={520}
                unoptimized
              />
              <figcaption>{lesson.figure.caption}</figcaption>
            </figure>
          )}
          {lesson.walkthrough && (
            <section>
              <h2>Walk through the example</h2>
              <ol className={styles.walkthrough}>
                {lesson.walkthrough.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          )}
          {lesson.code && (
            <section>
              <h2>What the test looks like</h2>
              <p>{lesson.code.label}</p>
              <pre className={styles.code}>
                <code>{lesson.code.snippet}</code>
              </pre>
            </section>
          )}
          <section>
            <h2>{lesson.followUp.question}</h2>
            <p>{lesson.followUp.answer}</p>
          </section>
          <p className={styles.takeaway}>
            <strong>Try this.</strong> {lesson.takeaway}
          </p>
          <details className={styles.quiz}>
            <summary>{lesson.question}</summary>
            <p>{lesson.quizAnswer}</p>
          </details>
          <p className={styles.reference}>
            <a href={lesson.url}>{lesson.reference}</a>
          </p>
        </article>
        <nav
          className={styles.lessonNav}
          aria-label="More lessons in this topic"
        >
          {previous && (
            <Link href={blogPath(previous.slug)}>
              <span>← Previous lesson</span>
              {previous.title}
            </Link>
          )}
          {next && (
            <Link href={blogPath(next.slug)}>
              <span>Next lesson →</span>
              {next.title}
            </Link>
          )}
        </nav>
        <Link className={styles.back} href={blogPath(lessonTopic.id)}>
          ↑ All {lessonTopic.heading.toLowerCase()} lessons
        </Link>
      </main>
    </>
  );
}
