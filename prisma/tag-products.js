import { prisma } from "../src/server/prisma.js";

const tagTypes = ["MOOD", "OCCASION", "WEATHER", "STYLE"];

const includesAny = (text, terms) => terms.some((term) => text.includes(term));

const chooseTags = (product) => {
  const text =
    `${product.name} ${product.description} ${product.subcategory}`.toLowerCase();
  const assignments = {
    MOOD: includesAny(text, [
      "runner",
      "trainer",
      "training",
      "match",
      "football",
      "active",
      "jersey",
      "track",
    ])
      ? ["Sporty"]
      : includesAny(text, ["dress", "clutch", "studio", "formal"])
        ? ["Elegant"]
        : ["Casual"],
    OCCASION: includesAny(text, ["dress", "clutch", "evening", "party"])
      ? ["Party"]
      : includesAny(text, [
            "runner",
            "trainer",
            "training",
            "match",
            "football",
            "active",
            "jersey",
            "track",
          ])
        ? ["Weekend"]
        : includesAny(text, ["coat", "work"])
          ? ["Work"]
          : ["Everyday"],
    WEATHER: includesAny(text, ["short", "tee", "summer", "active"])
      ? ["Hot"]
      : includesAny(text, ["coat", "hoodie", "sweatshirt", "boot"])
        ? ["Cold"]
        : includesAny(text, ["trail", "rain"])
          ? ["Rainy"]
          : ["Mild"],
    STYLE: includesAny(text, [
      "street",
      "hoodie",
      "crossbody",
      "track",
      "jersey",
    ])
      ? ["Streetwear"]
      : includesAny(text, ["soft", "everyday", "minimal"])
        ? ["Minimalist"]
        : includesAny(text, ["classic", "studio", "coat", "boot"])
          ? ["Classic"]
          : ["Trendy"],
  };

  return assignments;
};

try {
  const [products, tags] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, description: true, subcategory: true },
      orderBy: { id: "asc" },
    }),
    prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        filterType: { select: { slug: true } },
      },
    }),
  ]);

  const tagByTypeAndName = new Map(
    tags.map((tag) => [
      `${tag.filterType.slug.toUpperCase()}:${tag.name}`,
      tag,
    ]),
  );
  const productTags = [];
  const uncertain = [];

  for (const product of products) {
    const assignments = chooseTags(product);
    const missingAssignments = tagTypes.filter(
      (type) => !assignments[type]?.length,
    );

    if (missingAssignments.length > 0) {
      uncertain.push({
        id: product.id,
        name: product.name,
        missingTypes: missingAssignments,
      });
      continue;
    }

    for (const type of tagTypes) {
      for (const name of assignments[type]) {
        const tag = tagByTypeAndName.get(`${type}:${name}`);
        if (!tag) {
          uncertain.push({
            id: product.id,
            name: product.name,
            missingTag: `${type}: ${name}`,
          });
          continue;
        }
        productTags.push({ productId: product.id, tagId: tag.id });
      }
    }
  }

  const beforeCount = await prisma.productTag.count();
  await prisma.productTag.createMany({
    data: productTags,
    skipDuplicates: true,
  });
  const afterCount = await prisma.productTag.count();

  const verifiedProducts = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      tags: {
        select: { tag: { select: { filterType: { select: { slug: true } } } } },
      },
    },
  });
  const missingProducts = verifiedProducts
    .filter((product) =>
      tagTypes.some(
        (type) =>
          !product.tags.some(
            ({ tag }) => tag.filterType.slug.toUpperCase() === type,
          ),
      ),
    )
    .map(({ id, name }) => ({ id, name }));

  console.log(`Total ProductTag rows created: ${afterCount - beforeCount}`);
  console.log(
    `Products verified with all four tag types: ${verifiedProducts.length - missingProducts.length}/${verifiedProducts.length}`,
  );
  console.log("Products needing manual tag review:");
  if (uncertain.length === 0 && missingProducts.length === 0) {
    console.log("- None");
  } else {
    for (const product of [...uncertain, ...missingProducts]) {
      console.log(`- ${product.name} (${product.id})`);
    }
  }
} finally {
  await prisma.$disconnect();
}
