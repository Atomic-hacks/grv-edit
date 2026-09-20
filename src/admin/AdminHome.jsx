import React from "react";
import { Link } from "react-router-dom";
import FadeIn from "../component/ui/FadeIn";

const groups = [
  {
    name: "Catalog",
    description: "Products, categorization, filters, and imports.",
    links: [
      ["Products", "/admin/products"],
      ["Brands", "/admin/brands"],
      ["Subcategories", "/admin/subcategories"],
      ["Tags", "/admin/tags"],
      ["Filter Types", "/admin/filter-types"],
      ["Category Filters", "/admin/category-filter-types"],
      ["Bulk Upload", "/admin/products/bulk-upload"],
      ["Site Images", "/admin/site-images"],
    ],
  },
  {
    name: "Sales",
    description: "Orders, customers, and follow-up.",
    links: [
      ["Orders", "/admin/orders"],
      ["Customers", "/admin/customers"],
      ["Discounts", "/admin/discounts"],
      ["First-order Promo", "/admin/first-order-promo"],
      ["Shipping Fees", "/admin/shipping-fees"],
      ["Sections", "/admin/sections"],
    ],
  },
  {
    name: "Content",
    description: "Journal entries and customer messages.",
    links: [
      ["Journal", "/admin/journal"],
      ["Contact Submissions", "/admin/contact-submissions"],
    ],
  },
];

const AdminHome = () => (
  <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20 lg:px-0">
    <FadeIn className="border-b border-black pb-6">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
        Overview
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Admin</h1>
      <p className="mt-4 max-w-2xl text-sm text-gray-600">
        Manage the catalog, sales, and content from the admin panel.
      </p>
    </FadeIn>

    <div className="mt-10 grid gap-4 md:grid-cols-3">
      {groups.map((group, index) => (
        <FadeIn
          key={group.name}
          delay={0.08 + index * 0.06}
          className="border border-gray-300 p-5 transition-[border-color,transform] duration-300 ease-in-out hover:-translate-y-1 hover:border-black"
        >
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {group.description}
          </p>
          <div className="mt-5 space-y-1 border-t border-gray-200 pt-4">
            {group.links.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="block px-2 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 hover:text-black"
              >
                {label}
              </Link>
            ))}
          </div>
        </FadeIn>
      ))}
    </div>
  </main>
);

export default AdminHome;
