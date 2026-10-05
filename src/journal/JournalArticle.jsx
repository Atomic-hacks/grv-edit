import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import LoadingImage from "../component/ui/LoadingImage";
import Spinner from "../component/ui/Spinner";
import FadeIn from "../component/ui/FadeIn";
import ErrorState from "../component/ui/ErrorState";

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "Unpublished";

const JournalArticle = () => {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const retry = () => setRetryToken((token) => token + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPost(null);
    setNotFound(false);
    setError("");

    fetch(`/api/journal/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        if (!response.ok) throw new Error(body.error || "Unable to load post");
        return body;
      })
      .then((data) => {
        if (!cancelled && data) setPost(data);
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
  }, [slug, retryToken]);

  if (loading) {
    return (
      <main className="w-full bg-white px-6 py-24">
        <Spinner
          label="Loading journal post"
          className="text-sm text-gray-500"
        />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="page-shell w-full bg-white">
        <ErrorState
          tone="not-found"
          title="Journal post not found"
          message="This post may have been unpublished or removed."
          secondaryTo="/journal"
          secondaryLabel="Back to Journal"
        />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell w-full bg-white">
        <ErrorState
          title="Couldn't load this post"
          message="Something went wrong on our end. Give it another try."
          onRetry={retry}
          secondaryTo="/journal"
          secondaryLabel="Back to Journal"
        />
      </main>
    );
  }

  return (
    <main className="w-full bg-white pb-24">
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative h-[60vh] w-full overflow-hidden bg-gray-100 md:h-[70vh]"
      >
        {post.coverImage && (
          <LoadingImage
            src={post.coverImage}
            alt=""
            width={1200}
            loading="eager"
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-10 text-white md:px-16 md:pb-14">
          <Link
            to="/journal"
            className="mb-4 inline-block text-xs font-semibold uppercase tracking-[0.16em] text-white/80 hover:underline"
          >
            ← Journal
          </Link>
          <h1 className="max-w-2xl text-3xl font-semibold md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-white/80">
            {formatDate(post.publishedAt)}
          </p>
        </div>
      </Motion.div>

      <FadeIn
        className="mx-auto max-w-2xl whitespace-pre-wrap px-6 py-14 text-base leading-relaxed text-gray-700 md:px-0"
        delay={0.12}
      >
        {post.content}
      </FadeIn>
    </main>
  );
};

export default JournalArticle;
