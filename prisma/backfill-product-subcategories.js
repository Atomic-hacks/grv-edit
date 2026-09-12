import { prisma } from "../src/server/prisma.js";

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const fallbackMatchers = [
  ["shorts", "shorts"],
  ["sweatshirt", "sweatshirts"],
  ["jacket", "jackets"],
  ["hoodie", "hoodies"],
  ["tee", "t-shirts"],
  ["sneaker", "sneakers"],
  ["boot", "boots"],
  ["top", "tops"],
  ["dress", "dresses"],
  ["coat", "coats"],
  ["tote", "totes"],
  ["crossbody", "crossbody"],
  ["clutch", "clutches"],
  ["jersey", "jerseys"],
  ["activewear", "activewear"],
  ["track jacket", "track-jackets"],
];

const resolveSubcategory = (product, subcategories) => {
  const bySlug = new Map(
    subcategories.map((subcategory) => [
      normalize(subcategory.name),
      subcategory,
    ]),
  );
  const legacyValue = bySlug.get(normalize(product.subcategory || ""));
  if (legacyValue) return legacyValue;

  const searchableText = normalize(`${product.name} ${product.description}`);
  for (const [term, slug] of fallbackMatchers) {
    if (searchableText.includes(term)) {
      const match = subcategories.find(
        (subcategory) => subcategory.slug === slug,
      );
      if (match) return match;
    }
  }

  return null;
};

try {
  const [products, subcategories] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        subcategory: true,
        subcategoryId: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.subcategory.findMany(),
  ]);

  const uncertain = [];
  let totalProductsUpdated = 0;

  for (const product of products) {
    const subcategory = resolveSubcategory(product, subcategories);
    if (!subcategory) {
      uncertain.push({ id: product.id, name: product.name });
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { subcategoryId: subcategory.id },
    });
    totalProductsUpdated += 1;
  }

  const missingCount = await prisma.product.count({
    where: { subcategoryId: null },
  });

  console.log(`Total products updated: ${totalProductsUpdated}`);
  console.log("Products needing manual assignment:");
  if (uncertain.length === 0) {
    console.log("- None");
  } else {
    for (const product of uncertain) {
      console.log(`- ${product.name} (${product.id})`);
    }
  }
  console.log(`Products still missing subcategoryId: ${missingCount}`);
} finally {
  await prisma.$disconnect();
}
