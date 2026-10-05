// One-time move from hardcoded page content + SiteImage to ContentSection.
//
// Recreates what Home, Shop and Departments showed before, using whatever
// images an admin had already set in Site Images, so the switch is
// invisible to shoppers. Also:
//   - copies Shop By theme images (SiteImage "shopby-<slug>") onto
//     FilterType.imageUrl,
//   - turns any category flagged showOnHomepage into a HOME product rail,
//   - fixes links that pointed at the old ?category= query routing, which
//     category pages no longer read (they silently showed the whole
//     department instead).
//
// Idempotent: a page that already has sections is left untouched, so this
// is safe to re-run and never overwrites an admin's edits.
//
// Usage: set -a && . ./.env.local && set +a && node scripts/seedContentSections.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  const images = Object.fromEntries(
    (await prisma.siteImage.findMany()).map((image) => [image.key, image.imageUrl]),
  );
  const img = (key, fallback) => images[key] || fallback;

  const departmentTile = (title, url, key, fallback) => ({
    title,
    url,
    imageUrl: img(key, fallback),
  });

  const homepageCategories = await prisma.category.findMany({
    where: { showOnHomepage: true },
    orderBy: [{ homepageOrder: "asc" }, { createdAt: "asc" }],
  });

  const pages = {
    HOME: [
      {
        layout: "HERO",
        title: "GRV",
        mediaType: "VIDEO",
        videoUrl: img("hero-video", "https://res.cloudinary.com/uzielc9k/video/upload/v1790922371/grv/video/home-hero.mp4"),
      },
      {
        layout: "PRODUCTS",
        eyebrow: "Just in",
        title: "New arrivals, handpicked as they land",
        productSource: "NEW_ARRIVALS",
        ctaLabel: "Shop now",
        ctaUrl: "/shop/new-arrivals",
      },
      {
        layout: "TILES",
        eyebrow: "Start here",
        title: "Choose a department",
        items: [
          departmentTile("Women", "/women", "department-women", "/img/femaletop.jpg"),
          departmentTile("Men", "/men", "department-men", "/img/maleheromodel.jpg"),
          departmentTile("Accessories", "/accessories", "department-accessories", "/img/bag1.jpg"),
          departmentTile("Brands", "/brands", "department-brands", "/img/heromodel.jpg"),
        ],
      },
      ...homepageCategories.map((category) => ({
        layout: "PRODUCTS",
        eyebrow: "Curated section",
        title: category.name,
        description: category.description,
        productSource: "CATEGORY",
        sourceCategoryId: category.id,
      })),
    ],

    SHOP: [
      {
        layout: "HERO",
        eyebrow: "The GRV edit",
        title: "Shop",
        description: "Considered pieces across the labels and collections shaping the season.",
        ctaLabel: "Shop now",
        ctaUrl: "/catalogues",
        mediaType: "IMAGE",
        imageUrl: img("hero", "/img/heromodel5.jpg"),
      },
      {
        layout: "PRODUCTS",
        eyebrow: "Just in",
        title: "New arrivals, handpicked as they land",
        productSource: "NEW_ARRIVALS",
        ctaLabel: "Shop now",
        ctaUrl: "/shop/new-arrivals",
      },
      {
        layout: "TILES",
        title: "Choose a department",
        items: [
          departmentTile("Men", "/men", "department-men", "/img/maleheromodel.jpg"),
          departmentTile("Women", "/women", "department-women", "/img/femaletop.jpg"),
          departmentTile("Accessories", "/accessories", "department-accessories", "/img/bag1.jpg"),
          departmentTile("Brands", "/brands", "department-brands", "/img/heromodel.jpg"),
        ],
      },
      {
        layout: "BANNER",
        eyebrow: "Brands",
        title: "Explore upcoming brands",
        description: "New voices, considered essentials, and a point of view that keeps changing.",
        ctaLabel: "View catalogue",
        ctaUrl: "/brands",
        mediaType: "IMAGE",
        imageUrl: img("brands-section", "/img/heromodel.jpg"),
      },
      {
        layout: "TILES",
        title: "Featured brands",
        items: [
          departmentTile("Northline", "/brands/northline", "brand-northline", "/img/maleheromodel.jpg"),
          departmentTile("Atelier Zero", "/brands/atelier-zero", "brand-atelier-zero", "/img/femaletop.jpg"),
          departmentTile("Common Form", "/brands/common-form", "brand-common-form", "/img/goth-girl2.jpg"),
        ],
      },
      {
        layout: "BENTO",
        title: "Shop the collections",
        items: [
          departmentTile("Men", "/men", "collection-men", "/img/malemodel1.jpg"),
          departmentTile("Women", "/women", "collection-women", "/img/model3.jpg"),
          // Was /women?category=accessories — query params are ignored now.
          departmentTile("Bags", "/accessories", "collection-bags", "/img/bag4.jpg"),
          departmentTile("Athletics", "/athletics", "collection-athletics", "/img/shoe5.jpg"),
          // Was "Lifestyle" → /lifestyle, a category that doesn't exist (404).
          departmentTile("New arrivals", "/shop/new-arrivals", "collection-lifestyle", "/img/model6.jpg"),
        ],
      },
    ],

    DEPARTMENTS: [
      {
        layout: "PRODUCTS",
        eyebrow: "Just in",
        title: "New arrivals",
        productSource: "NEW_ARRIVALS",
        ctaLabel: "Shop now",
        ctaUrl: "/shop/new-arrivals",
      },
      {
        layout: "BRANDS",
        title: "Featured catalogues",
        ctaLabel: "All brands",
        ctaUrl: "/brands",
      },
      {
        layout: "TILES",
        title: "Departments",
        items: [
          departmentTile("Men", "/men", "department-men", "/img/maleheromodel.jpg"),
          departmentTile("Women", "/women", "department-women", "/img/femaletop.jpg"),
          departmentTile("Footwear", "/footwear", "department-footwear", "/img/shoe.jpg"),
          departmentTile("Accessories", "/accessories", "department-accessories", "/img/bag1.jpg"),
          departmentTile("Athletics", "/athletics", "department-athletics", "/img/model4.jpg"),
          // Was /men?category=apparel, which just showed all of Men.
          departmentTile("Apparel", "/apparel", "department-apparel", "/img/top1.avif"),
        ],
      },
    ],
  };

  for (const [page, sections] of Object.entries(pages)) {
    const existing = await prisma.contentSection.count({ where: { page } });
    if (existing > 0) {
      console.log(`${page}: already has ${existing} sections — skipped`);
      continue;
    }
    for (const [position, section] of sections.entries()) {
      await prisma.contentSection.create({ data: { page, position, ...section } });
    }
    console.log(`${page}: created ${sections.length} sections`);
  }

  let themeImages = 0;
  for (const filterType of await prisma.filterType.findMany()) {
    const imageUrl = images[`shopby-${filterType.slug}`];
    if (imageUrl && !filterType.imageUrl) {
      await prisma.filterType.update({ where: { id: filterType.id }, data: { imageUrl } });
      themeImages += 1;
    }
  }
  console.log(`Shop By theme images copied: ${themeImages}`);
};

run()
  .catch((error) => {
    console.error("Seeding content sections failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
