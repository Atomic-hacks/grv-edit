// Idempotent Prisma seed: migrates the hardcoded mock data in src/data into
// the real database via upserts (safe to re-run; never duplicates rows).
// Run with `pnpm run db:seed`.
import { prisma } from "../src/server/prisma.js";
import { categories, brands, products } from "../src/data/products.js";

const slugifyTag = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Style tags not already declared in a category's vocabulary get created on
// the fly instead of being dropped — logged so it's never silent.
const unmappedStyleTags = [];

const siteImages = {
  hero: "/img/heromodel5.jpg",
  "department-men": "/img/maleheromodel.jpg",
  "department-women": "/img/femaletop.jpg",
  "department-accessories": "/img/bag1.jpg",
  "department-brands": "/img/heromodel.jpg",
  "brands-section": "/img/heromodel.jpg",
  "brand-northline": "/img/maleheromodel.jpg",
  "brand-atelier-zero": "/img/femaletop.jpg",
  "brand-common-form": "/img/goth-girl2.jpg",
  "collection-men": "/img/malemodel1.jpg",
  "collection-women": "/img/model3.jpg",
  "collection-bags": "/img/bag4.jpg",
  "collection-athletics": "/img/shoe5.jpg",
  "collection-lifestyle": "/img/model6.jpg",
  "department-footwear": "/img/shoe.jpg",
  "department-athletics": "/img/model4.jpg",
  "department-apparel": "/img/top1.avif",
};

const firstOrderPromo = {
  id: "first-order-promo",
  discountPercent: 10,
  freeShipping: true,
  active: true,
  bannerMessage:
    "Welcome to GRV. Enjoy 10% off and free shipping on your first order.",
};

const shippingFees = [
  "South-South",
  "South-West",
  "South-East",
  "North-Central",
  "North-West",
  "North-East",
  "DEFAULT",
].map((region) => ({ region, fee: 2000 }));

const seedShippingFees = async () => {
  for (const shippingFee of shippingFees) {
    await prisma.shippingFee.upsert({
      where: { region: shippingFee.region },
      create: shippingFee,
      update: { fee: shippingFee.fee },
    });
  }
};

const seedFirstOrderPromo = async () => {
  await prisma.firstOrderPromo.upsert({
    where: { id: firstOrderPromo.id },
    create: firstOrderPromo,
    update: firstOrderPromo,
  });
};

const seedSiteImages = async () => {
  for (const [key, imageUrl] of Object.entries(siteImages)) {
    await prisma.siteImage.upsert({
      where: { key },
      create: { key, imageUrl },
      update: { imageUrl },
    });
  }
};

const seedCategories = async () => {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, name: category.name },
      update: { name: category.name },
    });

    for (const tagName of category.styleTags) {
      await prisma.categoryStyleTag.upsert({
        where: {
          categoryId_name: { categoryId: category.id, name: tagName },
        },
        create: {
          id: `${category.id}-${slugifyTag(tagName)}`,
          categoryId: category.id,
          name: tagName,
        },
        update: {},
      });
    }
  }
};

const seedBrands = async () => {
  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { id: brand.id },
      create: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
        description: brand.description,
      },
      update: {
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo,
        description: brand.description,
      },
    });
  }
};

// Resolves a product's styleTags (plain strings in mock data) to
// CategoryStyleTag rows, creating any that aren't in the category's
// declared vocabulary rather than silently dropping the tag.
const resolveStyleTagConnections = async (product) => {
  const connections = [];
  for (const tagName of product.styleTags) {
    const existing = await prisma.categoryStyleTag.findUnique({
      where: {
        categoryId_name: { categoryId: product.categoryId, name: tagName },
      },
    });
    if (existing) {
      connections.push({ id: existing.id });
      continue;
    }
    unmappedStyleTags.push(
      `${product.id}: "${tagName}" not in ${product.categoryId}'s declared vocabulary — created it`,
    );
    const created = await prisma.categoryStyleTag.create({
      data: {
        id: `${product.categoryId}-${slugifyTag(tagName)}`,
        categoryId: product.categoryId,
        name: tagName,
      },
    });
    connections.push({ id: created.id });
  }
  return connections;
};

const seedProducts = async () => {
  for (const product of products) {
    const styleTagConnections = await resolveStyleTagConnections(product);

    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        name: product.name,
        gender: product.gender,
        categoryId: product.categoryId,
        subcategory: product.subcategory,
        description: product.description,
        basePrice: product.basePrice,
        status: product.archived ? "ARCHIVED" : "ACTIVE",
        isNew: product.isNew,
        brandId: product.brandId,
        styleTags: { connect: styleTagConnections },
      },
      update: {
        name: product.name,
        gender: product.gender,
        categoryId: product.categoryId,
        subcategory: product.subcategory,
        description: product.description,
        basePrice: product.basePrice,
        status: product.archived ? "ARCHIVED" : "ACTIVE",
        isNew: product.isNew,
        brandId: product.brandId,
        styleTags: { set: styleTagConnections },
      },
    });

    // SKUs are preserved exactly as authored, including the inconsistent
    // NL-BOOT-001 vs NL-BOOT-BR naming — no normalization.
    for (const variant of product.variants) {
      await prisma.variant.upsert({
        where: { sku: variant.sku },
        create: {
          id: variant.id,
          color: variant.color,
          size: variant.size,
          sku: variant.sku,
          images: variant.images,
          productId: product.id,
        },
        update: {
          color: variant.color,
          size: variant.size,
          images: variant.images,
          productId: product.id,
        },
      });
    }
  }
};

const runIntegrityChecks = async () => {
  const allProducts = await prisma.product.findMany({
    include: { category: true },
  });
  const totalProducts = allProducts.length;
  const productsWithCategory = allProducts.filter((p) => p.category).length;

  const allVariants = await prisma.variant.findMany({
    include: { product: true },
  });
  const totalVariants = allVariants.length;
  const variantsWithProduct = allVariants.filter((v) => v.product).length;

  const skuGroups = await prisma.variant.groupBy({
    by: ["sku"],
    _count: { sku: true },
  });
  const duplicateSkus = skuGroups.filter((group) => group._count.sku > 1);

  console.log("\n--- Integrity check ---");
  console.log(
    `Products with a valid category: ${productsWithCategory}/${totalProducts}`,
  );
  console.log(
    `Variants with a valid parent product: ${variantsWithProduct}/${totalVariants}`,
  );
  console.log(`Duplicate SKUs: ${duplicateSkus.length}`);
  duplicateSkus.forEach((group) =>
    console.log(`  - ${group.sku} appears ${group._count.sku} times`),
  );

  const ok =
    productsWithCategory === totalProducts &&
    variantsWithProduct === totalVariants &&
    duplicateSkus.length === 0;
  console.log(ok ? "Integrity check: PASSED" : "Integrity check: FAILED");
  return ok;
};

const main = async () => {
  await seedFirstOrderPromo();
  await seedShippingFees();
  await seedSiteImages();
  await seedCategories();
  await seedBrands();
  await seedProducts();

  if (unmappedStyleTags.length) {
    console.warn("\nStyle tags outside declared category vocabulary:");
    unmappedStyleTags.forEach((line) => console.warn(`  - ${line}`));
  }

  console.log(
    `\nSeeded ${categories.length} categories, ${brands.length} brands, ${products.length} products.`,
  );

  const passed = await runIntegrityChecks();
  if (!passed) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
