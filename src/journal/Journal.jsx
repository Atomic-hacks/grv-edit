import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import { featuredArticles, regularArticles } from "../data/Journal";

const JournalCard = ({ article, size = "regular" }) => {
  const isLarge = size === "large";

  return (
    <Link to={`/journal/${article.slug}`} className="block">
      <Motion.article
        className="group relative cursor-pointer"
        whileHover="hover"
        initial="initial"
      >
        {/* Image Container */}
        <div className="relative overflow-hidden bg-gray-100 aspect-[4/3]">
          <img
            src={article.image}
            alt={article.alt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-semibold text-black leading-snug flex-1">
              {article.title}
            </h3>

            {/* Animated Arrow */}
            <Motion.div
              variants={{
                initial: { x: 0 },
                hover: { x: 4 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-shrink-0"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 10h10M12 7l3 3-3 3" />
              </svg>
            </Motion.div>
          </div>

          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600">{article.date}</p>

            {isLarge && (
              <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
              </div>
            )}
          </div>

          {/* Animated Underline */}
          <Motion.div
            className="h-[1.5px] bg-black origin-left"
            variants={{
              initial: { scaleX: 0 },
              hover: { scaleX: 1 },
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </Motion.article>
    </Link>
  );
};

const Journal = () => {
  return (
    <section className="w-full bg-white py-16 px-4 md:px-32">
      <div className="max-w-xl">
        <AnimatedPageTitle title="Journal" />
      </div>

      <p className="text-sm text-gray-600 mb-6">(Featured)</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        <div>
          <JournalCard article={featuredArticles[0]} size="large" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <JournalCard article={featuredArticles[1]} size="small" />
          <JournalCard article={featuredArticles[2]} size="small" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regularArticles.map((article) => (
          <JournalCard key={article.id} article={article} size="regular" />
        ))}
      </div>
    </section>
  );
};

export default Journal;