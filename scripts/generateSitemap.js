// Generates public/sitemap.xml and public/robots.txt from the live
// catalogue right before each build, so Vite then copies both into dist/
// as-is. This is a client-rendered SPA with no server-side rendering, so
// there's no other point in the request lifecycle where a crawler-facing
// file like this could be produced per-request — regenerating it at build
// time is the standard workaround for a plain SPA.
//
// Never allowed to fail the build: if the database is briefly unreachable
// during a Vercel build, a missing/stale sitemap is a far smaller problem
// than a broken deploy, so any error here falls back to a minimal
// static-pages-only sitemap instead of throwing.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getCategoryPath } from "../src/lib/categoryTree.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const STATIC_PATHS = [
  "/",
  "/shop",
  "/shop-by",
  "/brands",
  "/archive",
  "/size-guide",
  "/about",
  "/contact",
  "/privacy-policy",
];

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      default: return "&quot;";
    }
  });

const buildSitemapXml = (baseUrl, paths) => {
  const urlEntries = paths
    .map((path) => `  <url><loc>${escapeXml(`${baseUrl}${path}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
};

const buildRobotsTxt = (baseUrl) =>
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nSitemap: ${baseUrl}/sitemap.xml\n`;

const run = async () => {
  // A build frequently runs without .env.local (CI preview, a fresh
  // checkout). Never publish localhost URLs in that case.
  const rawBaseUrl = process.env.APP_URL || "https://www.grvhq.com";
  const baseUrl = rawBaseUrl.replace(/\/$/, "");
  let dynamicPaths = [];

  try {
    const prisma = new PrismaClient();
    const [categories, products, brands, journalPosts] = await Promise.all([
      prisma.category.findMany({ select: { id: true, slug: true, parentId: true } }),
      prisma.product.findMany({ where: { archived: false }, select: { id: true } }),
      prisma.brand.findMany({ select: { slug: true } }),
      prisma.journalPost.findMany({ where: { published: true }, select: { slug: true } }),
    ]);
    await prisma.$disconnect();

    // A subcategory's URL is every ancestor's slug joined together
    // (/men/accessories/jewelry), not its own bare slug — same helper the
    // app itself uses to build these paths, so the sitemap can't drift
    // out of sync with what actually resolves.
    const categoryPaths = categories.map(
      (category) => `/${getCategoryPath(categories, category.id).map((c) => c.slug).join("/")}`,
    );

    dynamicPaths = [
      ...categoryPaths,
      ...products.map((p) => `/product/${p.id}`),
      ...brands.map((b) => `/brands/${b.slug}`),
      ...journalPosts.map((j) => `/journal/${j.slug}`),
    ];
  } catch (error) {
    console.error(
      "Sitemap generation: could not reach the database, falling back to static pages only.",
      error.message,
    );
  }

  const allPaths = [...STATIC_PATHS, ...dynamicPaths];
  writeFileSync(join(publicDir, "sitemap.xml"), buildSitemapXml(baseUrl, allPaths));
  writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt(baseUrl));
  console.log(`Sitemap generated: ${allPaths.length} URLs (${dynamicPaths.length} from the database).`);
};

run().catch((error) => {
  console.error("Sitemap generation failed unexpectedly — writing static fallback.", error);
  try {
    const baseUrl = (process.env.APP_URL || "https://www.grvhq.com").replace(/\/$/, "");
    writeFileSync(join(publicDir, "sitemap.xml"), buildSitemapXml(baseUrl, STATIC_PATHS));
    writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt(baseUrl));
  } catch {
    // If even the fallback write fails, do not block the build over a
    // sitemap — proceed without one rather than fail the deploy.
  }
});
