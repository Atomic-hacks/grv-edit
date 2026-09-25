// The category tree arrives from the API as a flat list with parentId —
// every helper here derives whatever shape a particular UI needs from that
// one list, so the nav bar, breadcrumbs, the browse drawer and the admin
// screen never drift out of sync with each other the way the old
// hardcoded navigation.js and facetConfig did.
//
// The tree itself is arbitrarily deep (Men > Accessories > Jewelry >
// Watches, or as far as an admin wants to nest) — every helper here walks
// the full parentId chain rather than assuming one or two levels.

const sortCategories = (list) =>
  [...list].sort(
    (a, b) => (a.navOrder ?? 0) - (b.navOrder ?? 0) || a.name.localeCompare(b.name),
  );

export const isMajorCategory = (category) => !category.parentId;

/** Every category, nested to whatever depth it actually has. */
export const buildCategoryTree = (categories = []) => {
  const childrenOf = new Map();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = childrenOf.get(category.parentId) || [];
    list.push(category);
    childrenOf.set(category.parentId, list);
  }
  const attachChildren = (category) => ({
    ...category,
    children: sortCategories(childrenOf.get(category.id) || []).map(attachChildren),
  });
  return sortCategories(categories.filter(isMajorCategory)).map(attachChildren);
};

/** Just the top-level categories flagged for the nav bar, with their children. */
export const getNavTree = (categories = []) =>
  buildCategoryTree(categories).filter((major) => major.showInNav);

export const findCategoryBySlug = (categories = [], slug) =>
  categories.find((category) => category.slug === slug) || null;

export const findCategoryById = (categories = [], id) =>
  categories.find((category) => category.id === id) || null;

/** Every ancestor of a category, root-first, ending with the category itself. */
export const getCategoryPath = (categories = [], categoryId) => {
  const path = [];
  let current = findCategoryById(categories, categoryId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? findCategoryById(categories, current.parentId) : null;
  }
  return path;
};

/** The URL for a category at any depth, e.g. /men/accessories/jewelry. */
export const getCategoryHref = (categories = [], categoryId) =>
  `/${getCategoryPath(categories, categoryId).map((category) => category.slug).join("/")}`;

/** Resolves a URL's category segments (["men","accessories","jewelry"]) to
 *  the matching path of category rows, walking parent-to-child in order.
 *  Returns null if any segment doesn't match a child of the previous one —
 *  slugs are globally unique, but a segment still has to be the *right*
 *  child to be a valid URL, not just a category that exists somewhere. */
export const resolveCategoryPath = (categories = [], segments = []) => {
  const path = [];
  let parentId = null;
  for (const segment of segments) {
    const match = categories.find(
      (category) => category.slug === segment && category.parentId === parentId,
    );
    if (!match) return null;
    path.push(match);
    parentId = match.id;
  }
  return path;
};

export const getChildCategories = (categories = [], parentId) =>
  sortCategories(categories.filter((category) => category.parentId === parentId));

/** Every descendant of a category (children, grandchildren, ...), not including itself. */
export const getDescendantIds = (categories = [], id) => {
  const childrenOf = new Map();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = childrenOf.get(category.parentId) || [];
    list.push(category.id);
    childrenOf.set(category.parentId, list);
  }
  const result = [];
  const stack = [...(childrenOf.get(id) || [])];
  while (stack.length) {
    const nextId = stack.pop();
    result.push(nextId);
    for (const childId of childrenOf.get(nextId) || []) stack.push(childId);
  }
  return result;
};

/** The tree flattened depth-first, each row annotated with its depth — for
 *  an indented <select> of "pick a parent category" in the admin. */
export const flattenCategoryOptions = (categories = []) => {
  const result = [];
  const walk = (nodes, depth) => {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(buildCategoryTree(categories), 0);
  return result;
};

/** Categories that show on the homepage as curated blocks, in display order. */
export const getHomepageCategories = (categories = []) =>
  sortCategories(categories.filter((category) => category.showOnHomepage)).sort(
    (a, b) => (a.homepageOrder ?? 0) - (b.homepageOrder ?? 0),
  );
