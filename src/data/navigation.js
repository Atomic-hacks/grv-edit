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
