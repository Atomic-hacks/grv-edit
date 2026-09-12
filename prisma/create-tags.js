import { prisma } from "../src/server/prisma.js";

const tags = {
  MOOD: ["Casual", "Formal", "Sporty", "Elegant"],
  OCCASION: ["Everyday", "Weekend", "Party", "Work"],
  WEATHER: ["Hot", "Cold", "Rainy", "Mild"],
  STYLE: ["Minimalist", "Streetwear", "Classic", "Trendy"],
};

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

try {
  const filterTypes = await prisma.filterType.findMany({
    select: { id: true, slug: true },
    where: {
      slug: { in: Object.keys(tags).map((type) => type.toLowerCase()) },
    },
  });
  const filterTypeBySlug = new Map(
    filterTypes.map((filterType) => [filterType.slug, filterType]),
  );

  for (const [type, names] of Object.entries(tags)) {
    const filterType = filterTypeBySlug.get(type.toLowerCase());
    if (!filterType) {
      throw new Error(`FilterType not found for ${type}`);
    }

    for (const name of names) {
      await prisma.tag.upsert({
        where: { slug: slugify(name) },
        create: { name, slug: slugify(name), filterTypeId: filterType.id },
        update: { name, filterTypeId: filterType.id },
      });
    }
  }

  const createdTags = await prisma.tag.findMany({
    where: {
      slug: {
        in: Object.values(tags).flat().map(slugify),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      filterType: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ filterType: { slug: "asc" } }, { name: "asc" }],
  });

  console.log(JSON.stringify(createdTags, null, 2));
} finally {
  await prisma.$disconnect();
}
