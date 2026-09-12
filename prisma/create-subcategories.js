import { prisma } from "../src/server/prisma.js";

const subcategories = [
  { name: "Shorts", categoryId: "apparel" },
  { name: "Jackets", categoryId: "apparel" },
  { name: "Sneakers", categoryId: "footwear" },
  { name: "Boots", categoryId: "footwear" },
  { name: "Tops", categoryId: "apparel" },
  { name: "Dresses", categoryId: "apparel" },
  { name: "Coats", categoryId: "apparel" },
  { name: "Totes", categoryId: "accessories" },
  { name: "Clutches", categoryId: "accessories" },
  { name: "Crossbody", categoryId: "accessories" },
];

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

try {
  for (const subcategory of subcategories) {
    await prisma.subcategory.upsert({
      where: { slug: slugify(subcategory.name) },
      create: {
        name: subcategory.name,
        slug: slugify(subcategory.name),
        categoryId: subcategory.categoryId,
      },
      update: {
        name: subcategory.name,
        categoryId: subcategory.categoryId,
      },
    });
  }

  const rows = await prisma.subcategory.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      category: { select: { name: true } },
    },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}
