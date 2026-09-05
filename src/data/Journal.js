export const journalArticles = [
  {
    id: 1,
    slug: "crafting-performance-wear",
    title: "Crafting Performance Wear",
    date: "04.01.2025",
    image: "/img/goth-2.jpg",
    alt: "Two models wearing performance casual wear",
    size: "large",
    excerpt:
      "Inside the technical fabrics and construction choices behind our performance-first pieces.",
    body: [
      "Performance wear lives at the intersection of comfort and durability — every seam, fabric blend, and finish is chosen for how it holds up under real movement, not just how it photographs on a rack.",
      "Our approach starts with the fabric itself: technical blends that stretch without losing shape, breathable enough for daily wear but structured enough to read as considered rather than sporty-by-default.",
      "The result is a collection built to move with you, season after season, without the performance label ever overpowering the design.",
    ],
  },
  {
    id: 2,
    slug: "timeless-comfort-the-grv-way",
    title: "Timeless Comfort: The GRV Way",
    date: "05.04.2025",
    image: "/img/goth-7.jpg",
    alt: "Abstract gradient background",
    size: "small",
    excerpt: "What comfort actually means when it's designed to last.",
    body: [
      "Comfort is often treated as a trend — this season's soft fabric, next season's relaxed cut. We think about it differently: comfort should be a constant, not a seasonal feature.",
      "That means fit that holds up to real bodies and real days, fabrics that soften with wear instead of breaking down, and silhouettes that don't need a trend cycle to still feel right.",
    ],
  },
  {
    id: 3,
    slug: "the-value-of-quality",
    title: "The Value of Quality: Investing in Timeless Fashion",
    date: "06.12.2025",
    image: "/img/goth-9.jpg",
    alt: "Sunlit forest path",
    size: "small",
    excerpt: "Why fewer, better pieces outperform a full seasonal wardrobe.",
    body: [
      "Quality isn't just about materials — it's about intention. A well-made piece is designed to answer the same question five years from now that it answers today.",
      "Investing in fewer, better pieces isn't a sacrifice; it's a different kind of wardrobe math, one where cost-per-wear replaces cost-per-purchase as the number that matters.",
    ],
  },
  {
    id: 4,
    slug: "sustainable-materials-cotton-wool",
    title: "Sustainable Materials: Cotton & Wool",
    date: "07.15.2025",
    image: "/img/goth-5.jpg",
    alt: "Natural cotton and wool materials",
    excerpt: "A closer look at the natural fibers behind our core pieces.",
    body: [
      "Cotton and wool remain two of the most versatile natural fibers available — breathable, biodegradable, and capable of holding structure in ways synthetic blends often can't replicate.",
      "We source both with an eye toward responsible production, prioritizing suppliers who can account for how their materials are grown, processed, and delivered.",
    ],
  },
  {
    id: 5,
    slug: "behind-the-seams-production",
    title: "Behind the Seams: Our Production Process",
    date: "08.20.2025",
    image: "/img/goth-6.jpg",
    alt: "Clothing production process",
    excerpt: "From pattern to finished piece — what actually happens.",
    body: [
      "Every piece starts as a pattern, refined through multiple fit sessions before a single production unit is cut.",
      "From there, small-batch production lets us catch quality issues early and adjust quickly — something a larger, faster supply chain simply can't do.",
    ],
  },
  {
    id: 6,
    slug: "minimalist-wardrobe-essentials",
    title: "Style Guide: Minimalist Wardrobe Essentials",
    date: "09.10.2025",
    image: "/img/goth-1.jpg",
    alt: "Minimalist wardrobe essentials",
    excerpt: "The handful of pieces that quietly do the most work.",
    body: [
      "A minimalist wardrobe isn't about owning less for its own sake — it's about owning pieces versatile enough that you stop thinking about what to wear.",
      "A few well-chosen essentials, layered thoughtfully, will outperform a closet full of single-use pieces every time.",
    ],
  },
];

export const getJournalArticleBySlug = (slug) =>
  journalArticles.find((article) => article.slug === slug);

export const featuredArticles = journalArticles.filter((a) =>
  ["large", "small"].includes(a.size),
);

export const regularArticles = journalArticles.filter((a) => !a.size);