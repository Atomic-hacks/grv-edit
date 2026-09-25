import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import FadeIn from "../component/ui/FadeIn";

const groups = [
  {
    name: "Catalog",
    description: "Products, categorization, filters, and imports.",
    links: [
      ["Products", "/admin/products"],
      ["Categories", "/admin/categories"],
      ["Brands", "/admin/brands"],
      ["Style Tags", "/admin/tags"],
      ["Filter Types", "/admin/filter-types"],
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
    ],
  },
  {
    name: "Content",
    description: "Journal, customer messages and promotional email.",
    links: [
      ["Journal", "/admin/journal"],
      ["Messages", "/admin/contact-submissions"],
      ["Campaigns", "/admin/campaigns"],
    ],
  },
];

// A stat tile is a hero number, not a chart — one figure, one label, and
// (when it names something worth acting on) a tone that flags it.
const StatTile = ({ label, value, loading, to, tone = "neutral" }) => {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      {loading ? (
        <div className="skeleton mt-2 h-8 w-16" />
      ) : (
        <p
          className={`mt-1.5 text-3xl font-semibold tabular-nums ${
            tone === "attention" ? "text-(--color-accent-orange)" : "text-[var(--ink-900)]"
          }`}
        >
          {value}
        </p>
      )}
    </>
  );

  return to ? (
    <Link
      to={to}
      className="block border border-[var(--line)] p-5 transition-colors hover:border-[var(--ink-900)]"
    >
      {body}
    </Link>
  ) : (
    <div className="border border-[var(--line)] p-5">{body}</div>
  );
};

const AdminHome = () => {
  const { session, appUser } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  // The same four lists the Orders, Products, Customers and Contact
  // Submissions pages already fetch — reused here for a one-glance summary
  // instead of a dashboard that shows nothing until you click in.
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => request("/api/admin/orders"),
    enabled: Boolean(session),
  });
  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => request("/api/admin/products"),
    enabled: Boolean(session),
  });
  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => request("/api/admin/customers"),
    enabled: Boolean(session),
  });
  const submissionsQuery = useQuery({
    queryKey: ["admin", "contact-submissions", { query: "", filter: "" }],
    queryFn: () => request("/api/admin/contact-submissions"),
    enabled: Boolean(session),
  });
  const campaignsQuery = useQuery({
    queryKey: ["admin", "campaigns", { query: "" }],
    queryFn: () => request("/api/admin/campaigns"),
    enabled: Boolean(session),
  });

  const orders = ordersQuery.data || [];
  const paidRevenue = orders
    .filter((order) => order.status !== "PENDING" && order.status !== "FAILED" && order.status !== "CANCELLED")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const needsFulfillment = orders.filter((order) => order.status === "PAID").length;
  // "Unanswered" is the number that matters operationally: a message can be
  // read and still be waiting on a reply.
  const unansweredMessages = (submissionsQuery.data || []).filter(
    (submission) => !submission.repliedAt,
  ).length;
  const scheduledCampaigns = (campaignsQuery.data || []).filter(
    (campaign) => campaign.status === "SCHEDULED",
  ).length;
  const failedCampaigns = (campaignsQuery.data || []).filter(
    (campaign) => campaign.status === "FAILED",
  ).length;
  // Stock lives on variants, so a product is only out of stock when every
  // one of its variants is.
  const products = productsQuery.data || [];
  const outOfStock = products.filter(
    (product) =>
      (product.variants || []).length > 0 &&
      (product.variants || []).every((variant) => (variant.stock ?? 0) <= 0),
  ).length;
  const lowStock = products.filter((product) => {
    const variants = product.variants || [];
    if (!variants.length) return false;
    const total = variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
    return total > 0 && total <= 3;
  }).length;

  return (
    <main className="max-w-5xl px-0 py-12 md:py-16">
      <FadeIn className="border-b border-[var(--line)] pb-6">
        <p className="eyebrow">Overview</p>
        <h1 className="display-title mt-2 text-3xl md:text-4xl">
          {appUser?.name ? `Welcome back, ${appUser.name}` : "Admin"}
        </h1>
        <p className="body-text mt-3 text-sm">
          A snapshot of the storefront, and quick access to everything you manage.
        </p>
      </FadeIn>

      <FadeIn delay={0.05} className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Revenue"
          value={formatPrice(paidRevenue)}
          loading={ordersQuery.isPending}
          to="/admin/orders"
        />
        <StatTile
          label="Needs fulfillment"
          value={needsFulfillment}
          loading={ordersQuery.isPending}
          to="/admin/orders"
          tone={needsFulfillment > 0 ? "attention" : "neutral"}
        />
        <StatTile
          label="Unanswered messages"
          value={unansweredMessages}
          loading={submissionsQuery.isPending}
          to="/admin/contact-submissions"
          tone={unansweredMessages > 0 ? "attention" : "neutral"}
        />
        <StatTile
          label="Out of stock"
          value={outOfStock}
          loading={productsQuery.isPending}
          to="/admin/products"
          tone={outOfStock > 0 ? "attention" : "neutral"}
        />
      </FadeIn>

      <FadeIn delay={0.07} className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Products"
          value={products.length}
          loading={productsQuery.isPending}
          to="/admin/products"
        />
        <StatTile
          label="Low stock"
          value={lowStock}
          loading={productsQuery.isPending}
          to="/admin/products"
          tone={lowStock > 0 ? "attention" : "neutral"}
        />
        <StatTile
          label="Customers"
          value={(customersQuery.data || []).length}
          loading={customersQuery.isPending}
          to="/admin/customers"
        />
        <StatTile
          label="Scheduled campaigns"
          value={scheduledCampaigns}
          loading={campaignsQuery.isPending}
          to="/admin/campaigns"
        />
      </FadeIn>

      {failedCampaigns > 0 && (
        <FadeIn delay={0.09} className="mt-4">
          <Link
            to="/admin/campaigns"
            className="block border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 transition-colors hover:border-red-700"
          >
            {failedCampaigns} campaign{failedCampaigns === 1 ? "" : "s"} failed to
            send and {failedCampaigns === 1 ? "was" : "were"} not delivered.
          </Link>
        </FadeIn>
      )}

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {groups.map((group, index) => (
          <FadeIn
            key={group.name}
            delay={0.12 + index * 0.06}
            className="border border-[var(--line)] p-5 transition-colors duration-200 hover:border-[var(--ink-900)]"
          >
            <h2 className="text-[15px] font-semibold">{group.name}</h2>
            <p className="meta-text mt-2 leading-relaxed">{group.description}</p>
            <div className="mt-5 space-y-0.5 border-t border-[var(--line)] pt-4">
              {group.links.map(([label, to]) => (
                <Link
                  key={to}
                  to={to}
                  className="block px-2 py-2 text-[13px] text-[var(--ink-700)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--ink-900)]"
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
};

export default AdminHome;
