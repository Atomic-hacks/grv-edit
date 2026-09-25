// One-time migration: rebuilds the old flat Category/Subcategory/gender/
// CategoryStyleTag/Section shape into the new unified Category tree.
// Reads from a snapshot taken *before* `prisma db push` restructured the
// tables (see scripts/taxonomySnapshot.js) — run only once, against the
// live database, right after the schema push.
//
// Usage: set -a && . ./.env.local && set +a && node scripts/migrateTaxonomy.js <snapshot.json>
import { readFileSync } from "node:fs";
import { prisma } from "../src/server/prisma.js";

const snapshotPath = process.argv[2];
if (!snapshotPath) {
  console.error("Usage: node scripts/migrateTaxonomy.js <snapshot.json>");
  process.exit(1);
}
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  console.log(`Loaded snapshot: ${snapshot.categories.length} categories, ` +
    `${snapshot.subcategories.length} subcategories, ${snapshot.styleTags.length} style tags, ` +
    `${snapshot.products.length} products`);

  // --- 1. Old top-level categories keep their id/slug, become tree roots.
  // Nav order follows the order they already appeared in the site's nav
  // (Footwear, Accessories, Athletics, Apparel) — easy to reorder afterward
  // in the new admin screen.
  const categoryIdMap = new Map(); // old category id -> new Category row id (same id, kept for clarity)
  let navOrder = 0;
  for (const oldCategory of snapshot.categories) {
    const created = await prisma.category.upsert({
      where: { id: oldCategory.id },
      create: {
        id: oldCategory.id,
        name: oldCategory.name,
        slug: slugify(oldCategory.name),
        parentId: null,
        showInNav: true,
        navOrder: navOrder++,
      },
      // These 4 rows already existed pre-migration (same id, from the old
      // Category table) so upsert takes this branch, not `create` above —
      // without this, `slug` (added as a nullable column by the schema
      // push) never actually gets backfilled for them.
      update: { slug: slugify(oldCategory.name) },
    });
    categoryIdMap.set(oldCategory.id, created.id);
  }
  console.log(`Created ${categoryIdMap.size} top-level categories (existing taxonomy preserved as-is)`);

  // --- 2. Gender becomes two more top-level categories, Men and Women.
  // Unisex products simply don't get a gender-category link — they're
  // still fully reachable through their product category.
  const genderCategory = {};
  for (const [key, name] of [["men", "Men"], ["women", "Women"]]) {
    const created = await prisma.category.upsert({
      where: { slug: key },
      create: {
        name,
        slug: key,
        parentId: null,
        showInNav: true,
        navOrder: navOrder++,
      },
      update: {},
    });
    genderCategory[key] = created.id;
  }
  // Kids exists as an available top-level category (not shown in nav by
  // default, since there's no product data for it yet) — an admin can
  // switch it on the moment there's something to put in it.
  const kidsCategory = await prisma.category.upsert({
    where: { slug: "kids" },
    create: { name: "Kids", slug: "kids", parentId: null, showInNav: false, navOrder: navOrder++ },
    update: {},
  });
  console.log("Created Men, Women, Kids top-level categories");

  // --- 3. Old subcategories become child Category rows under their mapped
  // parent.
  const subcategoryIdMap = new Map(); // old subcategory id -> new Category row id
  for (const oldSub of snapshot.subcategories) {
    const parentId = categoryIdMap.get(oldSub.categoryId);
    const created = await prisma.category.upsert({
      where: { id: oldSub.id },
      create: {
        id: oldSub.id,
        name: oldSub.name,
        slug: oldSub.slug,
        parentId,
        showInNav: false,
      },
      update: {},
    });
    subcategoryIdMap.set(oldSub.id, created.id);
  }
  console.log(`Created ${subcategoryIdMap.size} subcategories`);

  // --- 4. Product taxonomy membership: one ProductCategory row for the
  // product's specific subcategory (or its bare top-level category if it
  // had no subcategory), plus one for its gender if it had one.
  let productCategoryRows = 0;
  for (const product of snapshot.products) {
    const targets = new Set();
    if (product.subcategoryId && subcategoryIdMap.has(product.subcategoryId)) {
      targets.add(subcategoryIdMap.get(product.subcategoryId));
    } else if (categoryIdMap.has(product.categoryId)) {
      targets.add(categoryIdMap.get(product.categoryId));
    }
    if (product.gender === "men") targets.add(genderCategory.men);
    if (product.gender === "women") targets.add(genderCategory.women);
    // "unisex" and "kids" (no kids data existed) intentionally get no
    // gender-category link.

    for (const categoryId of targets) {
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId } },
        create: { productId: product.id, categoryId },
        update: {},
      });
      productCategoryRows += 1;
    }
  }
  console.log(`Created ${productCategoryRows} product-category links`);

  // --- 5. CategoryStyleTag values fold into Tag, under the existing
  // "Style" FilterType (created it if it somehow doesn't exist).
  let styleFilterType = snapshot.filterTypes.find((ft) => ft.slug === "style");
  if (!styleFilterType) {
    styleFilterType = await prisma.filterType.create({
      data: { name: "Style", slug: "style" },
    });
  } else {
    styleFilterType = await prisma.filterType.upsert({
      where: { id: styleFilterType.id },
      create: { id: styleFilterType.id, name: styleFilterType.name, slug: styleFilterType.slug },
      update: {},
    });
  }

  const styleTagIdMap = new Map(); // old CategoryStyleTag id -> new Tag id
  for (const oldStyleTag of snapshot.styleTags) {
    const slug = slugify(oldStyleTag.name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: { name: oldStyleTag.name, slug, filterTypeId: styleFilterType.id },
      update: {},
    });
    styleTagIdMap.set(oldStyleTag.id, tag.id);
  }
  console.log(`Migrated ${styleTagIdMap.size} category style tags into the Style filter`);

  let styleLinkRows = 0;
  for (const link of snapshot.productStyleTagLinks) {
    const tagId = styleTagIdMap.get(link.styleTagId);
    if (!tagId) continue;
    await prisma.productTag.upsert({
      where: { productId_tagId: { productId: link.productId, tagId } },
      create: { productId: link.productId, tagId },
      update: {},
    });
    styleLinkRows += 1;
  }
  console.log(`Linked ${styleLinkRows} products to their migrated style tags`);

  // --- 6. Re-create the pre-existing Mood/Occasion/Weather/Style tags and
  // their product links exactly as they were (FilterType/Tag/ProductTag
  // were not restructured by the schema change, but products lost their
  // old id-based relations when the table was rebuilt by db push in some
  // Postgres configurations — this is a no-op if they're already intact).
  for (const ft of snapshot.filterTypes) {
    await prisma.filterType.upsert({
      where: { id: ft.id },
      create: { id: ft.id, name: ft.name, slug: ft.slug },
      update: {},
    });
  }
  for (const tag of snapshot.tags) {
    await prisma.tag.upsert({
      where: { id: tag.id },
      create: { id: tag.id, name: tag.name, slug: tag.slug, filterTypeId: tag.filterTypeId },
      update: {},
    });
  }
  let restoredTagLinks = 0;
  for (const link of snapshot.productTagLinks) {
    try {
      await prisma.productTag.upsert({
        where: { productId_tagId: { productId: link.productId, tagId: link.tagId } },
        create: { productId: link.productId, tagId: link.tagId },
        update: {},
      });
      restoredTagLinks += 1;
    } catch {
      // Product or tag no longer exists — skip rather than fail the run.
    }
  }
  console.log(`Confirmed ${restoredTagLinks} pre-existing filter tag links`);

  // --- 7. Round out the taxonomy with the nav richness that only ever
  // lived in the old hardcoded navigation.js file, never as real database
  // rows — the "Sandals / Formal / Athletic" style breakdowns a shopper
  // actually saw in the old mega-menu weren't Subcategory rows, so a
  // straight migration of the database alone comes out thinner than what
  // was on the site. Added here as real, additional subcategories
  // (nothing above is removed or replaced) so the nav has the same depth
  // immediately, without the admin rebuilding it from an empty tree.
  const additionalSubcategories = {
    footwear: ["Sandals", "Formal", "Athletic"],
    accessories: ["Jewelry", "Belts", "Hats", "Sunglasses"],
    athletics: ["Jerseys", "Football Boots", "Activewear", "Track Jackets"],
  };
  let addedSubcategories = 0;
  for (const [parentId, names] of Object.entries(additionalSubcategories)) {
    if (!categoryIdMap.has(parentId)) continue; // that category wasn't in this database
    for (const name of names) {
      const slug = slugify(name);
      const existing = await prisma.category.findUnique({ where: { slug } });
      if (existing) continue; // already real (e.g. "Sneakers"/"Boots" migrated in step 3)
      await prisma.category.create({
        data: { name, slug, parentId: categoryIdMap.get(parentId) },
      });
      addedSubcategories += 1;
    }
  }
  console.log(`Added ${addedSubcategories} subcategories that only existed in the old nav file before`);

  // --- 8. The old mega-menu nested Footwear/Accessories/Apparel *inside*
  // the Men and Women dropdowns — recreate that as real subcategory rows
  // under Men and Women, and retroactively link every product that
  // already has both the gender and the matching department, so these
  // start populated rather than as empty menu items.
  const genderDepartments = ["footwear", "accessories", "apparel"];
  const genderDepartmentIds = {}; // e.g. genderDepartmentIds["women"]["footwear"] = new category id
  for (const [genderKey, genderId] of Object.entries(genderCategory)) {
    genderDepartmentIds[genderKey] = {};
    for (const departmentId of genderDepartments) {
      if (!categoryIdMap.has(departmentId)) continue;
      const departmentName = snapshot.categories.find((c) => c.id === departmentId)?.name || departmentId;
      const slug = `${genderKey}-${departmentId}`;
      const created = await prisma.category.upsert({
        where: { slug },
        create: { name: departmentName, slug, parentId: genderId },
        update: {},
      });
      genderDepartmentIds[genderKey][departmentId] = created.id;
    }
  }

  // A product qualifies if it's linked to this gender's top-level category
  // *and* to the department itself or anything nested under it.
  let genderDepartmentLinks = 0;
  for (const product of snapshot.products) {
    if (product.gender !== "men" && product.gender !== "women") continue;
    if (!genderDepartments.includes(product.categoryId)) continue;
    const target = genderDepartmentIds[product.gender]?.[product.categoryId];
    if (!target) continue;
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: target } },
      create: { productId: product.id, categoryId: target },
      update: {},
    });
    genderDepartmentLinks += 1;
  }
  console.log(
    `Created ${Object.values(genderDepartmentIds).reduce((sum, byDept) => sum + Object.keys(byDept).length, 0)} ` +
      `nested Men/Women department subcategories, linked ${genderDepartmentLinks} existing products into them`,
  );

  console.log("\nMigration complete.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
