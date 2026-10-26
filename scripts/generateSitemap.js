import { loadEnv } from "vite";
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
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getCategoryPath } from "../src/lib/categoryTree.js";

const buildEnv = loadEnv(process.env.NODE_ENV || "production", process.cwd(), "");
for (const key of ["DATABASE_URL", "APP_URL"]) if (!process.env[key] && buildEnv[key]) process.env[key] = buildEnv[key];

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
  "/faq",
  "/journal",
  "/catalogues",
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
  let baseUrl = "https://www.grvhq.com";
  if (process.env.APP_URL) {
    try {
      const configured = new URL(process.env.APP_URL);
      if (!["https:", "http:"].includes(configured.protocol) || configured.username || configured.password) throw new Error("Invalid public origin");
      baseUrl = configured.origin;
    } catch {
      if (process.env.VERCEL_ENV === "production") throw new Error("APP_URL must be a valid public site URL");
      console.warn("APP_URL is invalid; using the canonical storefront URL for the sitemap.");
    }
  }
  let dynamicPaths = [];

  const prisma = new PrismaClient();
  try {
    const [categories, products, brands, journalPosts] = await Promise.all([
      prisma.category.findMany({ select: { id: true, slug: true, parentId: true } }),
      prisma.product.findMany({ where: { archived: false }, select: { id: true } }),
      prisma.brand.findMany({ select: { slug: true } }),
      prisma.journalPost.findMany({ where: { published: true }, select: { slug: true } }),
    ]);

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
    console.error("Sitemap catalogue lookup failed", { code: error.code || "DATABASE_UNAVAILABLE" });
    const sitemapPath = join(publicDir, "sitemap.xml");
    if (existsSync(sitemapPath)) {
      const existing = readFileSync(sitemapPath, "utf8");
      if (existing.includes(`<loc>${escapeXml(baseUrl)}/`) && existing.includes("</urlset>")) {
        console.warn("Preserving the existing sitemap; catalogue coverage must be checked before release.");
        writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt(baseUrl));
        return;
      }
    }
    if (process.env.VERCEL_ENV === "production") throw new Error("No valid sitemap is available for production");
  } finally { await prisma.$disconnect(); }

  const allPaths = [...STATIC_PATHS, ...dynamicPaths];
  writeFileSync(join(publicDir, "sitemap.xml"), buildSitemapXml(baseUrl, allPaths));
  writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt(baseUrl));
  console.log(`Sitemap generated: ${allPaths.length} URLs (${dynamicPaths.length} from the database).`);
};

run().catch((error) => {
  console.error("Sitemap generation failed", error.message);
  if (process.env.VERCEL_ENV === "production") { process.exitCode = 1; return; }
  try {
    const baseUrl = (process.env.APP_URL || "https://www.grvhq.com").replace(/\/$/, "");
    writeFileSync(join(publicDir, "sitemap.xml"), buildSitemapXml(baseUrl, STATIC_PATHS));
    writeFileSync(join(publicDir, "robots.txt"), buildRobotsTxt(baseUrl));
  } catch {
    // If even the fallback write fails, do not block the build over a
    // sitemap — proceed without one rather than fail the deploy.
  }
});
