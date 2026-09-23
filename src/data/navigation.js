export const navigationDepartments = [
  {
    name: "Men",
    gender: "men",
    sections: [
      {
        name: "Footwear",
        categoryId: "footwear",
        styles: ["Sneakers", "Boots", "Sandals", "Formal", "Athletic"],
      },
      {
        name: "Accessories",
        categoryId: "accessories",
        styles: ["Bags", "Jewelry", "Belts", "Hats", "Sunglasses"],
      },
      {
        name: "Apparel",
        categoryId: "apparel",
        styles: ["Tops", "Shorts", "Jackets", "Hoodies"],
      },
    ],
  },
  {
    name: "Women",
    gender: "women",
    sections: [
      {
        name: "Footwear",
        categoryId: "footwear",
        styles: ["Sneakers", "Boots", "Sandals", "Formal", "Athletic"],
      },
      {
        name: "Accessories",
        categoryId: "accessories",
        styles: ["Bags", "Jewelry", "Belts", "Hats", "Sunglasses"],
      },
      {
        name: "Apparel",
        categoryId: "apparel",
        styles: ["Tops", "Shorts", "Dresses", "Coats"],
      },
    ],
  },
  {
    name: "Footwear",
    categoryId: "footwear",
    sections: [
      {
        name: "Footwear",
        categoryId: "footwear",
        styles: ["Sneakers", "Boots", "Sandals", "Formal", "Athletic"],
      },
    ],
  },
  {
    name: "Accessories",
    categoryId: "accessories",
    sections: [
      {
        name: "Bags",
        categoryId: "accessories",
        subcategory: "Bags",
        styles: ["Totes", "Crossbody", "Clutches"],
      },
      {
        name: "Jewelry",
        categoryId: "accessories",
        subcategory: "Jewelry",
        styles: ["Wedding", "Casual", "Formal", "Everyday"],
      },
      {
        name: "Small Accessories",
        categoryId: "accessories",
        styles: ["Belts", "Hats", "Sunglasses"],
      },
    ],
  },
  {
    name: "Athletics",
    categoryId: "athletics",
    sections: [
      {
        name: "Athletics",
        categoryId: "athletics",
        styles: ["Jerseys", "Football Boots", "Activewear", "Track Jackets"],
      },
    ],
  },
];

export const getNavigationDepartment = (department) =>
  navigationDepartments.find(
    (item) => item.name.toLowerCase() === department?.toLowerCase(),
  );

export const getNavigationSectionsForDepartment = (department) =>
  getNavigationDepartment(department)?.sections || [];

export const getNavigationPath = (department, section, style) => {
  const menu = getNavigationDepartment(department);
  const sectionData =
    typeof section === "string"
      ? menu?.sections.find((item) => item.name === section)
      : section;
  const root = menu?.categoryId
    ? `/${menu.name.toLowerCase()}`
    : `/${menu?.gender || "men"}`;
  const params = new URLSearchParams();
  if (sectionData?.categoryId && !menu?.categoryId) {
    params.set("category", sectionData.categoryId);
  }
  if (sectionData?.subcategory)
    params.set("subcategory", sectionData.subcategory.toLowerCase());
  if (style) params.set("subcategory", style.toLowerCase());
  return `${root}${params.toString() ? `?${params.toString()}` : ""}`;
};

export const getNavigationRootPath = (department) => {
  const menu = getNavigationDepartment(department);
  return menu?.categoryId
    ? `/${menu.name.toLowerCase()}`
    : `/${menu?.gender || "men"}`;
};

export const formatNavigationLabel = (value) =>
  value
    ?.replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

// The department structure above is deliberately curated editorial IA and
// stays hand-authored. The style lists inside each section, however, are
// merged with the live taxonomy so a subcategory an admin creates shows up
// in the menu without a code change. Anything still hardcoded but no longer
// backed by products is dropped, so the menu can't link to an empty page.
export const mergeSectionsWithCategories = (sections, categories) => {
  if (!categories?.length) return sections;

  const subcategoriesByCategory = new Map(
    categories.map((category) => [
      category.id,
      (category.subcategories || []).filter(
        (subcategory) => (subcategory.productCount ?? 0) > 0,
      ),
    ]),
  );

  return sections.map((section) => {
    const live = subcategoriesByCategory.get(section.categoryId);
    if (!live?.length) return section;

    const liveNames = live.map((subcategory) => subcategory.name);
    // A section pinned to one subcategory (e.g. Accessories > Bags) keeps
    // its curated styles; only open sections adopt the full live list.
    if (section.subcategory) return section;

    const merged = [
      ...section.styles.filter((style) =>
        liveNames.some((name) => name.toLowerCase() === style.toLowerCase()),
      ),
      ...liveNames.filter(
        (name) =>
          !section.styles.some(
            (style) => style.toLowerCase() === name.toLowerCase(),
          ),
      ),
    ];
    return { ...section, styles: merged };
  });
};
