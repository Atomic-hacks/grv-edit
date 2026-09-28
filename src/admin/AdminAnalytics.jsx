import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";

const StatTile = ({ label, value }) => (
  <div className="border border-[var(--line)] p-5">
    <p className="eyebrow">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--ink-900)]">
      {value}
    </p>
  </div>
);

const toInputDate = (date) => date.toISOString().slice(0, 10);

const AdminAnalytics = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [from, setFrom] = useState(
    toInputDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [to, setTo] = useState(toInputDate(new Date()));

  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics", from, to],
    queryFn: () => request(`/api/admin/analytics?from=${from}&to=${to}`),
    enabled: Boolean(session),
  });
  const data = analyticsQuery.data;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Analytics</h1>
          <p className="mt-2 text-sm text-[var(--ink-500)]">
            Real operational data for the selected period.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
        </div>
      </div>

      {analyticsQuery.isPending && (
        <div className="mt-10">
          <Spinner label="Loading analytics" />
        </div>
      )}

      {data && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Revenue" value={formatPrice(data.revenue)} />
            <StatTile label="Paid orders" value={data.paidOrders} />
            <StatTile label="Pending payments" value={data.pendingPayments} />
            <StatTile label="Completed orders" value={data.completedOrders} />
            <StatTile label="Cancelled orders" value={data.cancelledOrders} />
            <StatTile
              label="Refunded amount"
              value={formatPrice(data.refundedAmount)}
            />
            <StatTile label="Pending refunds" value={data.pendingRefunds} />
            <StatTile label="Open complaints" value={data.openComplaints} />
            <StatTile label="Customers" value={data.customers} />
            <StatTile label="New customers" value={data.newCustomers} />
            <StatTile label="Products" value={data.products} />
            <StatTile
              label="Average order value"
              value={formatPrice(data.averageOrderValue)}
            />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                Top-selling products
              </h2>
              <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--ink-900)]">
                {data.topProducts.map((product) => (
                  <div
                    key={product.productId}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>
                      {product.name} ({product.unitsSold} sold)
                    </span>
                    <span className="font-medium">
                      {formatPrice(product.revenue)}
                    </span>
                  </div>
                ))}
                {data.topProducts.length === 0 && (
                  <p className="py-4 text-sm text-[var(--ink-500)]">
                    No sales in this period.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                Top categories
              </h2>
              <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--ink-900)]">
                {data.topCategories.map((category) => (
                  <div
                    key={category.name}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>{category.name}</span>
                    <span className="font-medium">
                      {formatPrice(category.revenue)}
                    </span>
                  </div>
                ))}
                {data.topCategories.length === 0 && (
                  <p className="py-4 text-sm text-[var(--ink-500)]">
                    No sales in this period.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                Recent orders
              </h2>
              <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--ink-900)]">
                {data.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/admin/orders/${order.id}`}
                    className="flex justify-between gap-4 py-3 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <span>
                      #{order.id} · {order.customerName || order.customerEmail}
                    </span>
                    <span className="font-medium">
                      {formatPrice(order.total)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                Recent complaints/refunds
              </h2>
              <div className="mt-4 divide-y divide-[var(--line)] border-t border-[var(--ink-900)]">
                {data.recentCases.map((supportCase) => (
                  <Link
                    key={supportCase.id}
                    to={`/admin/cases?category=${supportCase.category}`}
                    className="flex justify-between gap-4 py-3 text-sm hover:bg-[var(--surface-muted)]"
                  >
                    <span>
                      {supportCase.reference} · {supportCase.customerEmail}
                    </span>
                    <span className="font-medium">
                      {supportCase.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
};

export default AdminAnalytics;
