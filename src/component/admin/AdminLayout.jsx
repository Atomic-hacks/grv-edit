import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";

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
      { label: "Site Images", to: "/admin/site-images" },
    ],
  },
  {
    name: "Sales",
    items: [
      { label: "Orders", to: "/admin/orders" },
      { label: "Customers", to: "/admin/customers" },
      { label: "Discounts", to: "/admin/discounts" },
      { label: "First-order Promo", to: "/admin/first-order-promo" },
      { label: "Shipping Fees", to: "/admin/shipping-fees" },
      { label: "Sections", to: "/admin/sections" },
    ],
  },
  {
    name: "Communication",
    items: [
      { label: "Messages", to: "/admin/contact-submissions" },
      { label: "Campaigns", to: "/admin/campaigns" },
    ],
  },
  {
    name: "Content",
    items: [{ label: "Journal", to: "/admin/journal" }],
  },
];

const isItemActive = (pathname, item) =>
  item.exact ? pathname === item.to : pathname.startsWith(item.to);

const linkClassName = (pathname, item) =>
  `block border-l-2 px-4 py-2 text-[13px] transition-colors ${
    isItemActive(pathname, item)
      ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
      : "border-transparent text-[var(--ink-500)] hover:border-[var(--line)] hover:text-[var(--ink-900)]"
  }`;

const compactLinkClassName = (pathname, item) =>
  `whitespace-nowrap border px-3 py-2 text-[13px] transition-colors ${
    isItemActive(pathname, item)
      ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
      : "border-[var(--line)] text-[var(--ink-500)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
  }`;

const AdminLayout = () => {
  const location = useLocation();
  const { pathname } = location;
  const { appUser, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Every admin screen needs a way back to the storefront and a way to
          log out — neither existed anywhere in the panel before this. */}
      <header className="border-b border-[var(--ink-900)] bg-white">
        <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-4 px-6 py-3 md:px-12">
          <Link to="/admin" className="text-base font-semibold tracking-tight">
            GRV Admin
          </Link>
          <div className="flex items-center gap-4 text-[12px]">
            {appUser?.name && (
              <span className="hidden text-[var(--ink-500)] sm:inline">
                {appUser.name}
              </span>
            )}
            <Link
              to="/"
              className="font-semibold text-[var(--ink-700)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
            >
              View storefront
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="border border-[var(--line)] px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-[var(--ink-700)] transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[100rem] gap-8 px-6 md:px-12">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 overflow-y-auto border-r border-[var(--line)] py-8 pr-8 lg:block">
          <nav aria-label="Admin" className="space-y-8">
            {navigationGroups.map((group) => (
              <section key={group.name}>
                <h2 className="px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-300)]">
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
          <div className="border-b border-[var(--line)] py-4 lg:hidden">
            <nav
              aria-label="Admin sections"
              className="flex gap-2 overflow-x-auto pb-1"
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
