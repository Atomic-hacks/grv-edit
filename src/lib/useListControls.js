import { useMemo, useState } from "react";

const PAGE = 50;

// Client-side search + sort + "show more" for admin lists that already load
// every row. Keeps a long list from becoming endless scrolling: type to
// narrow, pick an order, and only the first 50 rows render until asked.
//
//   searchText(row)  → (optional — omit when the server already searches) one lowercase-able string containing everything a
//                      person might type to find that row
//   sorts            → [{ value, label, compare(a, b) }]; the first is the default
export const useListControls = (rows, { searchText, sorts }) => {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(sorts[0].value);
  const [limit, setLimit] = useState(PAGE);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sort = sorts.find((s) => s.value === sortKey) || sorts[0];
    const filtered = needle && searchText
      ? rows.filter((row) => searchText(row).toLowerCase().includes(needle))
      : rows;
    return [...filtered].sort(sort.compare);
    // searchText/sorts are static per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sortKey]);

  return {
    query,
    setQuery: (value) => {
      setQuery(value);
      setLimit(PAGE);
    },
    sortKey,
    setSortKey: (value) => {
      setSortKey(value);
      setLimit(PAGE);
    },
    sorts,
    visible: matches.slice(0, limit),
    matched: matches.length,
    total: rows.length,
    hasMore: matches.length > limit,
    showMore: () => setLimit((current) => current + PAGE),
  };
};

// Comparators. Missing values always sort last, whichever direction.
export const byText = (get, dir = 1) => (a, b) => {
  const x = get(a) ?? "";
  const y = get(b) ?? "";
  if (!x && y) return 1;
  if (x && !y) return -1;
  return String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true }) * dir;
};

export const byNumber = (get, dir = 1) => (a, b) => {
  const x = get(a);
  const y = get(b);
  if (x == null && y == null) return 0;
  if (x == null) return 1;
  if (y == null) return -1;
  return (Number(x) - Number(y)) * dir;
};

export const byDate = (get, dir = 1) =>
  byNumber((row) => (get(row) ? new Date(get(row)).getTime() : null), dir);
