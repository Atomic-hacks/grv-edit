// Product/category helpers shared by src/api/routes.js and the handler
// modules in src/api/handlers/. Lives here (not in routes.js) so handlers
// can use the exact same serialization without importing routes.js back —
// which would be a circular import.
import { prisma } from "./prisma.js";

// A product is "new" for a fixed window after creation, computed at read
// time rather than stored — nobody has to remember to flip a flag on and,
// more importantly, nobody has to remember to flip it back off.
export const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const isProductNew = (createdAt, suppressNew = false) =>
  !suppressNew &&
  Date.now() - new Date(createdAt).getTime() < NEW_PRODUCT_WINDOW_MS;

export const productInclude = {
  variants: true,
  categories: {
    include: {
      category: {
        select: { id: true, name: true, slug: true, parentId: true },
      },
    },
  },
  tags: {
    include: {
      tag: {
        include: {
          filterType: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  },
  brand: { select: { id: true, name: true, slug: true } },
};

// Flattens relations (categories, tags, brand) back to a plain shape the
// frontend can use without knowing how any of this is modeled in the DB.
export const serializeProduct = (product) => {
  const categories = product.categories.map(({ category }) => category);
  // The single most useful category for a simple "category / detail" label
  // on a product card: prefer a subcategory (it's the more specific thing)
  // over a bare top-level category.
  const leafCategory =
    categories.find((category) => category.parentId) || categories[0] || null;

  return {
    id: product.id,
    name: product.name,
    categories,
    categoryIds: categories.map((category) => category.id),
    // Convenience field for display-only call sites that just want "the
    // category name" without walking the tree themselves.
    subcategory: leafCategory?.name || null,
    tags: product.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      filterTypeId: tag.filterTypeId,
      filterType: tag.filterType,
    })),
    description: product.description,
    basePrice: product.basePrice,
    discountPercent: product.discountPercent,
    createdAt: product.createdAt,
    imageUrl: product.imageUrl,
    modelImages: product.modelImages,
    isNew: isProductNew(product.createdAt, product.suppressNew),
    featured: product.featured,
    archived: product.archived,
    brandId: product.brandId,
    brandName: product.brand?.name,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      stock: variant.stock,
      sku: variant.sku,
      images: variant.images,
    })),
  };
};

// The category tree as a children map, built from one query. Shared by
// subtree lookups and the subcategory filter.
export const loadCategoryTree = async () => {
  const all = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      navOrder: true,
    },
  });
  const childrenOf = new Map();
  for (const category of all) {
    if (!category.parentId) continue;
    const list = childrenOf.get(category.parentId) || [];
    list.push(category);
    childrenOf.set(category.parentId, list);
  }
  return { all, childrenOf };
};

export const collectSubtreeIds = (childrenOf, rootId) => {
  const result = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    result.push(id);
    for (const child of childrenOf.get(id) || []) stack.push(child.id);
  }
  return result;
};

// The tree can be arbitrarily deep (Men > Accessories > Jewelry, as far as
// an admin nests it), so "this category and everything under it" walks the
// whole subtree rather than assuming one level of children. One query for
// the full flat list (small table) plus an in-memory walk beats a round
// trip per level.
export const getCategoryAndDescendantIds = async (idOrSlug) => {
  const { all, childrenOf } = await loadCategoryTree();
  const target = all.find(
    (category) => category.id === idOrSlug || category.slug === idOrSlug,
  );
  if (!target) return [];
  return collectSubtreeIds(childrenOf, target.id);
};
