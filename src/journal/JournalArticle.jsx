import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import {
  getJournalArticleBySlug,
  journalArticles,
} from "../data/Journal";

const JournalArticle = () => {
  const { slug } = useParams();
  const article = getJournalArticleBySlug(slug);

  if (!article) return <Navigate to="/journal" replace />;

  const moreArticles = journalArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  return (
    <main className="w-full bg-white pb-24">
      <div className="relative h-[60vh] w-full overflow-hidden md:h-[70vh]">
        <img
          src={article.image}
          alt={article.alt}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white md:px-16 md:pb-14">
          <Link
            to="/journal"
            className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-white/80 hover:underline"
          >
            ← Journal
          </Link>
          <h1 className="max-w-2xl text-3xl font-semibold md:text-5xl">
            {article.title}
          </h1>
          <p className="mt-3 text-sm text-white/80">{article.date}</p>
        </div>
      </div>

      <article className="mx-auto max-w-2xl px-6 py-14 md:px-0">
        {article.body.map((paragraph, index) => (
          <p
            key={index}
            className="mb-6 text-base leading-relaxed text-gray-700"
          >
            {paragraph}
          </p>
        ))}
      </article>

      <section className="px-4 md:px-32">
        <h2 className="mb-8 text-2xl font-semibold">More from the Journal</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {moreArticles.map((item) => (
            <Link key={item.slug} to={`/journal/${item.slug}`} className="group block">
              <div className="relative overflow-hidden bg-gray-100 aspect-[4/3]">
                <img
                  src={item.image}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h3 className="mt-4 text-base font-semibold text-black">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600">{item.date}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default JournalArticle;