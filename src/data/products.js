export { formatPrice } from "../lib/productHelpers.js";

export const categories = [
  {
    id: "footwear",
    name: "Footwear",
    styleTags: ["Sneakers", "Boots", "Sandals", "Formal", "Athletic"],
  },
  {
    id: "accessories",
    name: "Accessories",
    styleTags: ["Wedding", "Casual", "Formal", "Everyday"],
  },
  {
    id: "athletics",
    name: "Athletics",
    styleTags: ["Football", "Running", "Training", "Casual"],
  },
  {
    id: "apparel",
    name: "Apparel",
    styleTags: ["Formal", "Casual", "Outerwear"],
  },
];

export const brands = [
  {
    id: "prada",
    name: "Prada",
    slug: "prada",
    logo: "/img/prada.jpg",
    description: "A classic you are probably already familiar with.",
  },
  {
    id: "zara",
    name: "Zara",
    slug: "zara",
    logo: "/img/zara.jpg",
    description: "Comfort-led layers made for the rhythm of city life.",
  },
  {
    id: "ara",
    name: "Ara",
    slug: "ara",
    logo: "/img/model6.jpg",
    description: "Modern staples shaped by clean lines and utility.",
  },
  {
    id: "northline",
    name: "Northline",
    slug: "northline",
    logo: "/img/maleheromodel.jpg",
    description: "Everyday essentials with a relaxed, considered fit.",
  },
  {
    id: "atelier-zero",
    name: "Atelier Zero",
    slug: "atelier-zero",
    logo: "/img/femaletop.jpg",
    description: "Comfort-led layers made for the rhythm of city life.",
  },
  {
    id: "common-form",
    name: "Common Form",
    slug: "common-form",
    logo: "/img/goth-girl2.jpg",
    description: "Modern staples shaped by clean lines and utility.",
  },
];

const brandName = (brandId) =>
  brands.find((brand) => brand.id === brandId)?.name || brandId;

const variant = (id, color, size, sku, images) => ({
  id,
  color,
  size,
  sku,
  images,
});

export const products = [
  {
    id: "prd-001",
    name: "Classic Shorts",
    brandId: "northline",
    gender: "men",
    categoryId: "apparel",
    subcategory: "Shorts",
    styleTags: ["Casual"],
    description: "Relaxed everyday shorts with a clean, easy fit.",
    basePrice: 25,
    isNew: false,
    variants: [
      variant("prd-001-black", "Black", "M", "NL-SHORT-BK", [
        "/img/pants.avif",
        "/img/pantsfit.avif",
      ]),
    ],
  },
  {
    id: "prd-002",
    name: "Cozy Sweatshirt",
    brandId: "atelier-zero",
    gender: "unisex",
    categoryId: "apparel",
    subcategory: "Sweatshirts",
    styleTags: ["Casual"],
    description: "A soft crew layer for slow mornings and late nights.",
    basePrice: 40,
    isNew: true,
    variants: [
      variant("prd-002-grey", "Grey", "M", "AZ-SWEAT-GY", [
        "/img/hoodie1.avif",
        "/img/fit1.avif",
      ]),
    ],
  },
  {
    id: "prd-003",
    name: "Denim Jacket",
    brandId: "common-form",
    gender: "unisex",
    categoryId: "apparel",
    subcategory: "Jackets",
    styleTags: ["Outerwear"],
    description: "A structured denim layer with a familiar, versatile shape.",
    basePrice: 55,
    isNew: true,
    variants: [
      variant("prd-003-blue", "Blue", "M", "CF-DENIM-BL", [
        "/img/top1.avif",
        "/img/topback2.avif",
      ]),
    ],
  },
  {
    id: "prd-004",
    name: "Casual Hoodie",
    brandId: "atelier-zero",
    gender: "unisex",
    categoryId: "apparel",
    subcategory: "Hoodies",
    styleTags: ["Casual"],
    description: "An easy everyday hoodie with a relaxed silhouette.",
    basePrice: 45,
    isNew: true,
    variants: [
      variant("prd-004-black", "Black", "M", "AZ-HOOD-BK", [
        "/img/top2.avif",
        "/img/topback2.avif",
      ]),
    ],
  },
  {
    id: "prd-005",
    name: "Vintage Tee",
    brandId: "common-form",
    gender: "unisex",
    categoryId: "apparel",
    subcategory: "T-Shirts",
    styleTags: ["Casual"],
    description: "A washed tee made for repeat wear.",
    basePrice: 30,
    isNew: false,
    variants: [
      variant("prd-005-white", "White", "M", "CF-TEE-WH", [
        "/img/top3.avif",
        "/img/fitback.avif",
      ]),
    ],
  },
  {
    id: "prd-006",
    name: "Summer Shorts",
    brandId: "northline",
    gender: "women",
    categoryId: "apparel",
    subcategory: "Shorts",
    styleTags: ["Casual"],
    description: "Lightweight denim shorts with a relaxed summer fit.",
    basePrice: 28,
    isNew: false,
    variants: [
      variant("prd-006-blue", "Blue", "S", "NL-SHORT-BL", [
        "/img/jeanfit.avif",
        "/img/Jean.avif",
      ]),
    ],
  },
  {
    id: "prd-007",
    name: "Street Jacket",
    brandId: "common-form",
    gender: "men",
    categoryId: "apparel",
    subcategory: "Jackets",
    styleTags: ["Outerwear"],
    description: "A clean street-ready jacket for transitional weather.",
    basePrice: 60,
    isNew: false,
    variants: [
      variant("prd-007-black", "Black", "M", "CF-JACK-BK", [
        "/img/top1.avif",
        "/img/top2.avif",
      ]),
    ],
  },
  {
    id: "prd-008",
    name: "Crewneck Sweatshirt",
    brandId: "atelier-zero",
    gender: "unisex",
    categoryId: "apparel",
    subcategory: "Sweatshirts",
    styleTags: ["Casual"],
    description: "A considered crewneck in a comfortable everyday weight.",
    basePrice: 42,
    isNew: false,
    variants: [
      variant("prd-008-grey", "Grey", "M", "AZ-CREW-GY", [
        "/img/shirt.jpg",
        "/img/fit1.avif",
      ]),
    ],
  },
  {
    id: "prd-009",
    name: "Runner One",
    brandId: "northline",
    gender: "men",
    categoryId: "footwear",
    subcategory: "Sneakers",
    styleTags: ["Athletic"],
    description: "A lightweight everyday runner with a cushioned sole.",
    basePrice: 72,
    isNew: true,
    variants: [
      variant("prd-009-white", "White", "9", "NL-RUN-WH", [
        "/img/shoe3.jpg",
        "/img/shoe.jpg",
      ]),
    ],
  },
  {
    id: "prd-010",
    name: "Court Four",
    brandId: "northline",
    gender: "women",
    categoryId: "footwear",
    subcategory: "Sneakers",
    styleTags: ["Sneakers"],
    description: "A low profile court sneaker with a clean finish.",
    basePrice: 76,
    isNew: false,
    variants: [
      variant("prd-010-white", "White", "7", "NL-COURT-WH", [
        "/img/shoe4.jpg",
        "/img/shoe7.jpg",
      ]),
    ],
  },
  {
    id: "prd-011",
    name: "Everyday Trainer",
    brandId: "ara",
    gender: "unisex",
    categoryId: "footwear",
    subcategory: "Sneakers",
    styleTags: ["Sneakers"],
    description: "A practical trainer built for daily movement.",
    basePrice: 68,
    isNew: false,
    variants: [
      variant("prd-011-black", "Black", "8", "ARA-TRAIN-BK", [
        "/img/shoe.jpg",
        "/img/shoe5.jpg",
      ]),
    ],
  },
  {
    id: "prd-012",
    name: "Trail Seven",
    brandId: "northline",
    gender: "men",
    categoryId: "footwear",
    subcategory: "Boots",
    styleTags: ["Boots"],
    description: "A sturdy boot with an easy city-to-trail profile.",
    basePrice: 90,
    isNew: false,
    variants: [
      variant("prd-012-brown", "Brown", "10", "NL-BOOT-BR", [
        "/img/shoe7.jpg",
        "/img/shoe.jpg",
      ]),
    ],
  },
  {
    id: "prd-013",
    name: "Soft Form",
    brandId: "ara",
    gender: "women",
    categoryId: "apparel",
    subcategory: "Tops",
    styleTags: ["Casual"],
    description: "A soft, simple top with a fluid everyday shape.",
    basePrice: 44,
    isNew: true,
    variants: [
      variant("prd-013-cream", "Cream", "S", "ARA-TOP-CR", [
        "/img/model1.jpg",
        "/img/model7.jpg",
      ]),
    ],
  },
  {
    id: "prd-014",
    name: "Studio Dress",
    brandId: "ara",
    gender: "women",
    categoryId: "apparel",
    subcategory: "Dresses",
    styleTags: ["Formal"],
    description: "A refined silhouette for evenings and occasions.",
    basePrice: 110,
    isNew: false,
    variants: [
      variant("prd-014-black", "Black", "S", "ARA-DRESS-BK", [
        "/img/model2.jpg",
        "/img/model1.jpg",
      ]),
    ],
  },
  {
    id: "prd-015",
    name: "City Coat",
    brandId: "zara",
    gender: "women",
    categoryId: "apparel",
    subcategory: "Coats",
    styleTags: ["Outerwear"],
    description: "A polished outer layer with a generous cut.",
    basePrice: 140,
    isNew: false,
    variants: [
      variant("prd-015-grey", "Grey", "M", "ZAR-COAT-GY", [
        "/img/model4.jpg",
        "/img/model6.jpg",
      ]),
    ],
  },
  {
    id: "prd-016",
    name: "Everyday Tote",
    brandId: "prada",
    gender: "women",
    categoryId: "accessories",
    subcategory: "Totes",
    styleTags: ["Everyday"],
    description: "A spacious tote for the daily essentials.",
    basePrice: 180,
    isNew: true,
    variants: [
      variant("prd-016-black", "Black", "One Size", "PRA-TOTE-BK", [
        "/img/bag7.jpg",
        "/img/bag6.jpg",
      ]),
    ],
  },
  {
    id: "prd-017",
    name: "Crossbody Mini",
    brandId: "prada",
    gender: "unisex",
    categoryId: "accessories",
    subcategory: "Crossbody",
    styleTags: ["Casual"],
    description: "A compact crossbody with just enough room.",
    basePrice: 150,
    isNew: false,
    variants: [
      variant("prd-017-black", "Black", "One Size", "PRA-CROSS-BK", [
        "/img/bag6.jpg",
        "/img/bag2.jpg",
      ]),
    ],
  },
  {
    id: "prd-018",
    name: "Clutch Three",
    brandId: "zara",
    gender: "women",
    categoryId: "accessories",
    subcategory: "Clutches",
    styleTags: ["Formal"],
    description: "A minimal clutch for evenings and events.",
    basePrice: 95,
    isNew: false,
    variants: [
      variant("prd-018-red", "Red", "One Size", "ZAR-CLUTCH-RD", [
        "/img/bag3.jpg",
        "/img/bag4.jpg",
      ]),
    ],
  },
  {
    id: "prd-019",
    name: "Training Jersey",
    brandId: "common-form",
    gender: "unisex",
    categoryId: "athletics",
    subcategory: "Jerseys",
    styleTags: ["Training"],
    description: "A breathable jersey for training days and off days.",
    basePrice: 58,
    isNew: true,
    variants: [
      variant("prd-019-black", "Black", "M", "CF-JERSEY-BK", [
        "/img/shirt.jpg",
        "/img/top5.jpg",
      ]),
    ],
  },
  {
    id: "prd-020",
    name: "Training Short",
    brandId: "common-form",
    gender: "unisex",
    categoryId: "athletics",
    subcategory: "Activewear",
    styleTags: ["Training"],
    description: "A lightweight short built for warm-ups and hard sessions.",
    basePrice: 42,
    isNew: true,
    variants: [
      variant("prd-020-black", "Black", "M", "CF-ACTIVE-BK", [
        "/img/pants.avif",
        "/img/pantsfit.avif",
      ]),
    ],
  },
  {
    id: "prd-021",
    name: "Match Boot",
    brandId: "northline",
    gender: "unisex",
    categoryId: "athletics",
    subcategory: "Football Boots",
    styleTags: ["Football"],
    description: "A responsive boot for quick movement on the pitch.",
    basePrice: 96,
    isNew: false,
    variants: [
      variant("prd-021-black", "Black", "9", "NL-BOOT-001", [
        "/img/shoe5.jpg",
        "/img/shoe7.jpg",
      ]),
    ],
  },
  {
    id: "prd-022",
    name: "Track Jacket",
    brandId: "atelier-zero",
    gender: "unisex",
    categoryId: "athletics",
    subcategory: "Track Jackets",
    styleTags: ["Training"],
    description: "A light layer for the walk to training and the way back.",
    basePrice: 74,
    isNew: false,
    variants: [
      variant("prd-022-grey", "Grey", "M", "AZ-TRACK-GY", [
        "/img/hoodie1.avif",
        "/img/fit1.avif",
      ]),
    ],
  },
];

export const getCategoryById = (id) =>
  categories.find((category) => category.id === id);
export const getBrandById = (idOrSlug) =>
  brands.find((brand) => brand.id === idOrSlug || brand.slug === idOrSlug);
export const getProductById = (id) =>
  products.find((product) => product.id === id);
export const getProductImages = (product, variantId) => {
  const selected =
    product?.variants?.find((item) => item.id === variantId) ||
    product?.variants?.[0];
  return selected?.images || [];
};

export const getProducts = ({
  gender,
  categoryId,
  subcategory,
  styleTag,
  brandId,
  query,
} = {}) =>
  products.filter((product) => {
    if (gender && product.gender !== gender) return false;
    if (categoryId && product.categoryId !== categoryId) return false;
    if (
      subcategory &&
      product.subcategory.toLowerCase() !== subcategory.toLowerCase()
    )
      return false;
    if (
      styleTag &&
      !product.styleTags.some(
        (tag) => tag.toLowerCase() === styleTag.toLowerCase(),
      )
    )
      return false;
    if (brandId && product.brandId !== brandId) return false;
    if (query) {
      const value = query.toLowerCase();
      const matchesProduct = [
        product.name,
        brandName(product.brandId),
        ...product.variants.map((item) => item.sku),
      ].some((field) => field.toLowerCase().includes(value));
      if (!matchesProduct) return false;
    }
    return true;
  });

export const searchProducts = (query) => getProducts({ query }).slice(0, 6);
