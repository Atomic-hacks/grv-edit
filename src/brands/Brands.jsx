import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import { BrandGridSkeleton } from "../component/ui/LoadingSkeletons";
import ErrorState from "../component/ui/ErrorState";
import WishlistButton from "../component/ui/WishlistButton";
import { fetchBrands } from "../lib/apiClient";
import { useAsync } from "../lib/useAsync";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const letterOf = (name) => {
  const first = (name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
};

// A directory, not a gallery — brand logos varied wildly in quality and
// slowed the page down for a list that shoppers mostly just want to search
// or scan alphabetically and jump straight to a label.
const Brands = () => {
  const { data: brands, loading, error, refetch } = useAsync(() => fetchBrands(), []);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...(brands || [])].sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((brand) => brand.name.toLowerCase().includes(q));
  }, [sorted, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const brand of filtered) {
      const letter = letterOf(brand.name);
      const list = map.get(letter) || [];
      list.push(brand);
      map.set(letter, list);
    }
    return map;
  }, [filtered]);

  const availableLetters = useMemo(() => {
    const set = new Set();
    for (const brand of sorted) set.add(letterOf(brand.name));
    return set;
  }, [sorted]);

  const scrollToLetter = (letter) => {
    document.getElementById(`brand-letter-${letter}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="page-shell min-h-screen bg-white pb-24">
      <div className="relative pb-8 pt-10 md:pb-12 md:pt-14">
        <AnimatedPageTitle
          title="Brands"
          subtitle="Explore the labels behind our curated collection."
        />
      </div>

      <label className="block max-w-md">
        <span className="sr-only">Search brands</span>
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brands"
            className="w-full border border-[var(--line)] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--ink-300)] focus:border-[var(--ink-900)]"
          />
        </div>
      </label>

      {error ? (
        <ErrorState
          className="mt-10"
          title="Couldn't load brands"
          message="Something went wrong on our end — your connection is fine."
          onRetry={refetch}
        />
      ) : loading ? (
        <div className="mt-10">
          <BrandGridSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <p className="meta-text mt-10">No brands match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-10 flex gap-6 md:gap-10">
          <div className="min-w-0 flex-1">
            {ALPHABET.map((letter) => {
              const letterBrands = grouped.get(letter);
              if (!letterBrands?.length) return null;
              return (
                <section key={letter} id={`brand-letter-${letter}`} className="scroll-mt-24">
                  <h2 className="sticky top-[var(--nav-h)] z-10 border-b border-[var(--ink-900)] bg-white py-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    {letter}
                  </h2>
                  <div className="divide-y divide-[var(--line)]">
                    {letterBrands.map((brand) => (
                      <div key={brand.id} className="flex items-center justify-between gap-4 py-4">
                        <Link to={`/brands/${brand.id}`} className="group min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold text-[var(--ink-900)] transition-colors group-hover:text-[var(--ink-500)]">
                            {brand.name}
                          </h3>
                          {brand.description && (
                            <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-500)]">
                              {brand.description}
                            </p>
                          )}
                        </Link>
                        <WishlistButton brand={brand} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* A-Z quick nav — hidden on small screens where the list is short enough to just scroll. */}
          <nav
            aria-label="Jump to letter"
            className="sticky top-[calc(var(--nav-h)+2rem)] hidden h-fit shrink-0 flex-col gap-0.5 text-[11px] font-medium sm:flex"
          >
            {ALPHABET.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => scrollToLetter(letter)}
                disabled={!availableLetters.has(letter)}
                className={`w-5 text-center transition-colors ${
                  availableLetters.has(letter)
                    ? "text-[var(--ink-700)] hover:text-(--color-accent-orange)"
                    : "text-[var(--ink-300)]"
                }`}
              >
                {letter}
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
};

export default Brands;
