// Single source of truth for the admin menu: the sidebar (AdminLayout) and
// the dashboard cards (AdminHome) both read this, so a new admin page is
// added in one place and cannot appear in one and be missing from the other.
export const adminNavGroups = [
  {
    name: "Catalog",
    description: "Products, categorization, filters, and imports.",
    items: [
      { label: "Products", to: "/admin/products", exact: true },
      { label: "Categories", to: "/admin/categories" },
      { label: "Brands", to: "/admin/brands" },
      { label: "Style Tags", to: "/admin/tags" },
      { label: "Filter Types", to: "/admin/filter-types", exact: true },
      { label: "Bulk Upload", to: "/admin/products/bulk-upload" },
    ],
  },
  {
    name: "Sales",
    description: "Orders, customers, and follow-up.",
    items: [
      { label: "Orders", to: "/admin/orders" },
      { label: "Customers", to: "/admin/customers" },
      { label: "Discounts", to: "/admin/discounts" },
      { label: "First-order Promo", to: "/admin/first-order-promo" },
      { label: "Shipping Fees", to: "/admin/shipping-fees" },
    ],
  },
  {
    name: "Support",
    description: "Refunds, complaints, and operational analytics.",
    items: [
      { label: "Refunds & Complaints", to: "/admin/cases" },
      { label: "Analytics", to: "/admin/analytics" },
      { label: "Visitors", to: "/admin/visitors" },
    ],
  },
  {
    name: "Communication",
    description: "Customer messages and promotional email.",
    items: [
      { label: "Waitlist", to: "/admin/waitlist" },
      { label: "Messages", to: "/admin/contact-submissions" },
      { label: "Campaigns", to: "/admin/campaigns" },
    ],
  },
  {
    name: "Content",
    description: "Homepage, Shop and Departments sections, and the journal.",
    items: [
      { label: "Page Sections", to: "/admin/content-sections" },
      { label: "Journal", to: "/admin/journal" },
    ],
  },
  {
    name: "System",
    description: "Who can sign in to the admin, and what they can do.",
    items: [{ label: "Staff & Roles", to: "/admin/staff" }, { label: "Delivery & Payments", to: "/admin/operations" }],
  },
];

const extraRoles = {
  "/admin/cases": ["SUPPORT"],
  "/admin/analytics": ["ANALYST"],
  "/admin/visitors": ["ANALYST"],
  "/admin/orders": ["FULFILMENT"],
};
export const canAccessAdminPath = (role, pathname) => {
  if (pathname === "/admin" || pathname === "/admin/") return ["OWNER", "ADMIN", "SUPPORT", "FULFILMENT", "ANALYST"].includes(role);
  const item = adminNavGroups.flatMap((group) => group.items)
    .filter((candidate) => pathname === candidate.to || pathname.startsWith(`${candidate.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!item) return false;
  if (item.to === "/admin/staff") return role === "OWNER";
  return role === "OWNER" || role === "ADMIN" || (extraRoles[item.to] || []).includes(role);
};
export const adminNavigationFor = (role) => adminNavGroups.map((group) => ({ ...group, items: group.items.filter((item) => canAccessAdminPath(role, item.to)) })).filter((group) => group.items.length);
