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
    items: [{ label: "Staff & Roles", to: "/admin/staff" }],
  },
];
