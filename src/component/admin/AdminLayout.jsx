import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";

const navigationGroups = [
  {
    name: "Catalog",
    items: [
      { label: "Products", to: "/admin/products", exact: true },
      { label: "Brands", to: "/admin/brands" },
      { label: "Subcategories", to: "/admin/subcategories" },
      { label: "Tags", to: "/admin/tags" },
      { label: "Filter Types", to: "/admin/filter-types", exact: true },
      { label: "Category Filters", to: "/admin/category-filter-types" },
      { label: "Bulk Upload", to: "/admin/products/bulk-upload" },
    ],
  },
  {
    name: "Sales",
    items: [
      { label: "Orders", to: "/admin/orders" },
      { label: "Customers", to: "/admin/customers" },
    ],
  },
  {
    name: "Content",
    items: [
      { label: "Journal", to: "/admin/journal" },
      { label: "Contact Submissions", to: "/admin/contact-submissions" },
    ],
  },
];

const isItemActive = (pathname, item) =>
  item.exact ? pathname === item.to : pathname.startsWith(item.to);

const linkClassName = (pathname, item) =>
  `block border-l-2 px-4 py-2 text-sm transition-colors ${
    isItemActive(pathname, item)
      ? "border-black bg-black text-white"
      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-black"
  }`;

const compactLinkClassName = (pathname, item) =>
  `whitespace-nowrap border px-3 py-2 text-sm transition-colors ${
    isItemActive(pathname, item)
      ? "border-black bg-black text-white"
      : "border-gray-300 text-gray-600 hover:border-black hover:text-black"
  }`;

const AdminLayout = () => {
  const location = useLocation();
  const { pathname } = location;

  return (
    <div className="bg-white">
      <div className="mx-auto flex max-w-[100rem] gap-8 px-6 md:px-12">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-black py-10 pr-8 lg:block">
          <Link
            to="/admin"
            className="block text-2xl font-semibold tracking-tight"
          >
            Admin
          </Link>
          <nav aria-label="Admin" className="mt-10 space-y-8">
            {navigationGroups.map((group) => (
              <section key={group.name}>
                <h2 className="px-4 text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  {group.name}
                </h2>
                <div className="mt-3 space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={linkClassName(pathname, item)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-black py-4 lg:hidden">
            <Link to="/admin" className="text-xl font-semibold">
              Admin
            </Link>
            <nav
              aria-label="Admin sections"
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
            >
              {navigationGroups.flatMap((group) =>
                group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={compactLinkClassName(pathname, item)}
                  >
                    {item.label}
                  </Link>
                )),
              )}
            </nav>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
