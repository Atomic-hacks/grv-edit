import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import LoadingImage from "../component/ui/LoadingImage";
import Spinner from "../component/ui/Spinner";

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "Unpublished";

const JournalCard = ({ post, index }) => {
  return (
    <Link to={`/journal/${post.slug}`} className="block">
      <Motion.article
        className="group relative cursor-pointer"
        whileHover="hover"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.55,
          delay: index * 0.06,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="relative aspect-4/3 overflow-hidden bg-gray-100">
          {post.coverImage ? (
            <LoadingImage
              src={post.coverImage}
              alt=""
              width={800}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full bg-gray-100" />
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-base font-semibold text-black leading-snug flex-1">
              {post.title}
            </h3>

            <Motion.div
              variants={{
                initial: { x: 0 },
                hover: { x: 4 },
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="shrink-0"
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

          <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">
            {post.excerpt}
          </p>
          <p className="text-sm text-gray-500">
            {formatDate(post.publishedAt)}
          </p>

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
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/journal")
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(body.error || "Unable to load journal");
        return body;
      })
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="w-full bg-white py-16 px-4 md:px-32">
      <div className="max-w-xl">
        <AnimatedPageTitle title="Journal" />
      </div>

      {loading && (
        <Spinner
          label="Loading journal"
          className="mt-8 text-sm text-gray-500"
        />
      )}
      {error && (
        <p role="alert" className="mt-8 text-sm text-red-700">
          {error}
        </p>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="mt-8 text-sm text-gray-500">No journal posts yet.</p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, index) => (
          <JournalCard key={post.id} post={post} index={index} />
        ))}
      </div>
    </section>
  );
};

export default Journal;
