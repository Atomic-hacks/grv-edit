import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import { NIGERIAN_REGIONS } from "../lib/nigeriaRegions";
import Spinner from "../component/ui/Spinner";
import OrderTimeline from "../component/order/OrderTimeline";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

const statuses = ["", "PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

// What each status change does beyond changing the status. Shown next to
// the button so an admin knows an email is about to reach a customer.
const TRANSITION_EFFECTS = {
  SHIPPED: {
    email: "The customer is emailed a shipping notification with their items.",
  },
  DELIVERED: {
    email: "The customer is emailed a delivery confirmation.",
  },
  CANCELLED: {
    email: "The customer is emailed a cancellation notice.",
    warning: "Stock is returned to inventory. This cannot be undone.",
    confirm: true,
  },
};
const statusLabel = (status) =>
  status.charAt(0) + status.slice(1).toLowerCase();

const AdminOrders = () => {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  // Shipping and delivery notices are routine and reversible enough to send
  // on a single click; cancelling restocks inventory, so it asks first.
  const requestStatusChange = (nextStatus) => {
    if (TRANSITION_EFFECTS[nextStatus]?.confirm) {
      setPendingStatus(nextStatus);
      return;
    }
    updateStatus(nextStatus);
  };
  const status = searchParams.get("status") || "";
  const state = searchParams.get("state") || "";
  const region = searchParams.get("region") || "";
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => request("/api/admin/orders"),
    enabled: Boolean(session),
  });
  const orders = ordersQuery.data || [];
  const loading = ordersQuery.isPending;
  const displayError = ordersQuery.error?.message;

  const updateFilter = (name, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(name, value);
    else nextParams.delete(name);
    setSearchParams(nextParams);
  };

  const states = [
    ...new Set(orders.map((order) => order.state).filter(Boolean)),
  ].sort();

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = !status || order.status === status;
    const matchesState = !state || order.state === state;
    const matchesRegion = !region || order.region === region;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.id.toLowerCase().includes(query) ||
      order.customer.name?.toLowerCase().includes(query) ||
      order.customer.email?.toLowerCase().includes(query);
    return matchesStatus && matchesState && matchesRegion && matchesSearch;
  });

  const counts = orders.reduce(
    (result, order) => {
      result.total += 1;
      result[order.status] = (result[order.status] || 0) + 1;
      return result;
    },
    { total: 0 },
  );

  const openOrder = async (id) => {
    setSelectedOrder(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setSelectedOrder(
        await request(`/api/admin/orders/${encodeURIComponent(id)}`),
      );
    } catch (loadError) {
      setDetailError(loadError.message || "Unable to load order.");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (nextStatus) => {
    if (!selectedOrder) return;
    setSavingStatus(true);
    setDetailError("");
    try {
      const updatedOrder = await request(
        `/api/admin/orders/${encodeURIComponent(selectedOrder.id)}/status`,
        { method: "PUT", body: JSON.stringify({ status: nextStatus }) },
      );
      setSelectedOrder(updatedOrder);
      setPendingStatus(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (statusError) {
      setDetailError(statusError.message || "Unable to update order status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const availableTransitions =
    selectedOrder?.status === "PAID"
      ? ["SHIPPED", "CANCELLED"]
      : selectedOrder?.status === "SHIPPED"
        ? ["DELIVERED", "CANCELLED"]
        : [];

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
          <h1 className="mt-3 text-3xl font-semibold">Orders</h1>
          <p className="mt-2 text-sm text-[var(--ink-500)]">
            Review purchases, fulfillment, and payment details.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Total orders", counts.total],
          ["Delivered", counts.DELIVERED || 0],
          ["Cancelled", counts.CANCELLED || 0],
        ].map(([label, value]) => (
          <div key={label} className="border border-[var(--line)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
              {label}
            </p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-b border-[var(--line)]">
        {statuses.map((option) => (
          <button
            key={option || "all"}
            type="button"
            onClick={() => updateFilter("status", option)}
            className={`border-b-2 pb-3 text-sm ${status === option ? "border-[var(--ink-900)] font-semibold text-[var(--ink-900)]" : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]"}`}
          >
            {option ? statusLabel(option) : "All"} (
            {option ? counts[option] || 0 : counts.total})
          </button>
        ))}
      </div>

      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          State
          <select
            value={state}
            onChange={(event) => updateFilter("state", event.target.value)}
            className="mt-2 w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
          >
            <option value="">All states</option>
            {states.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Region
          <select
            value={region}
            onChange={(event) => updateFilter("region", event.target.value)}
            className="mt-2 w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
          >
            <option value="">All regions</option>
            {NIGERIAN_REGIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-6 block max-w-xl text-sm font-medium">
        <span className="sr-only">Search orders</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer, email, or order ID"
          className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
        />
      </label>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <div className="mt-8 overflow-x-auto border-t border-[var(--ink-900)]">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
            <tr>
              <th className="px-3 py-4 font-medium">Order</th>
              <th className="px-3 py-4 font-medium">Product</th>
              <th className="px-3 py-4 font-medium">Customer</th>
              <th className="px-3 py-4 text-right font-medium">Total</th>
              <th className="px-3 py-4 font-medium">Status</th>
              <th className="px-3 py-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-[var(--ink-500)]">
                  <Spinner label="Loading orders" />
                </td>
              </tr>
            )}
            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-[var(--ink-500)]">
                  No orders found.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => (
              <tr
                key={order.id}
                onClick={() => openOrder(order.id)}
                className="cursor-pointer border-b border-[var(--line)] transition-colors hover:bg-[var(--surface-muted)]"
              >
                <td className="px-3 py-4 font-medium">
                  <button
                    type="button"
                    onClick={() => openOrder(order.id)}
                    className="underline underline-offset-4"
                  >
                    #{order.id}
                  </button>
                </td>
                <td className="px-3 py-4">
                  {order.firstImage ? (
                    <img
                      src={order.firstImage}
                      alt=""
                      className="h-14 w-10 object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[var(--ink-300)]">No image</span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <span className="block font-medium">
                    {order.customer.name || "Unnamed customer"}
                  </span>
                  <span className="mt-1 block text-[var(--ink-500)]">
                    {order.customer.email}
                  </span>
                </td>
                <td className="px-3 py-4 text-right font-medium">
                  {formatPrice(order.total)}
                </td>
                <td className="px-3 py-4">{statusLabel(order.status)}</td>
                <td className="px-3 py-4">{formatDate(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {(selectedOrder || detailLoading || detailError) && (
          <>
            <Motion.button
              type="button"
              aria-label="Close order details"
              onClick={() => {
                setSelectedOrder(null);
                setDetailError("");
              }}
              className="fixed inset-0 z-40 cursor-default bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <Motion.aside
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-[var(--ink-900)] bg-white px-6 py-8 shadow-xl md:px-8"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                    Order
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedOrder ? `#${selectedOrder.id}` : "Order details"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                  className="text-2xl leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                >
                  ×
                </button>
              </div>

              {detailLoading && (
                <div className="py-10">
                  <Spinner label="Loading order" />
                </div>
              )}
              {detailError && (
                <p
                  role="alert"
                  className="mt-6 border border-red-300 px-4 py-3 text-sm text-red-800"
                >
                  {detailError}
                </p>
              )}
              {selectedOrder && (
                <div className="space-y-8 py-6 text-sm">
                  <section>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                          Status
                        </p>
                        <p className="mt-2 font-semibold">
                          {statusLabel(selectedOrder.status)}
                        </p>
                      </div>
                      {availableTransitions.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {availableTransitions.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              onClick={() => requestStatusChange(nextStatus)}
                              disabled={savingStatus}
                              className="border border-[var(--ink-900)] px-3 py-2 text-xs font-medium hover:bg-[var(--ink-900)] hover:text-white disabled:opacity-50"
                            >
                              {savingStatus
                                ? "Saving"
                                : `Mark ${statusLabel(nextStatus)}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* The consequences are stated before the click, not
                        discovered after it. */}
                    {availableTransitions.length > 0 && !pendingStatus && (
                      <ul className="mt-4 space-y-1.5">
                        {availableTransitions.map((nextStatus) => {
                          const effect = TRANSITION_EFFECTS[nextStatus];
                          if (!effect) return null;
                          return (
                            <li
                              key={nextStatus}
                              className="text-xs leading-relaxed text-[var(--ink-500)]"
                            >
                              <span className="font-semibold text-[var(--ink-700)]">
                                Mark {statusLabel(nextStatus)}:
                              </span>{" "}
                              {effect.email}
                              {effect.warning ? ` ${effect.warning}` : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {pendingStatus && (
                      <div className="mt-4 border border-[var(--ink-900)] p-4">
                        <p className="text-sm font-semibold">
                          Mark this order {statusLabel(pendingStatus).toLowerCase()}?
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-500)]">
                          {TRANSITION_EFFECTS[pendingStatus]?.email}{" "}
                          {TRANSITION_EFFECTS[pendingStatus]?.warning}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateStatus(pendingStatus)}
                            disabled={savingStatus}
                            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {savingStatus ? "Saving" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingStatus(null)}
                            disabled={savingStatus}
                            className="border border-[var(--line)] px-3 py-2 text-xs font-medium disabled:opacity-50"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="border-t border-[var(--line)] pt-6">
                    <h3 className="font-semibold">Items</h3>
                    <div className="mt-4 divide-y divide-[var(--line)]">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-3 py-4 first:pt-0"
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              className="h-20 w-14 shrink-0 object-cover"
                            />
                          ) : (
                            <div className="h-20 w-14 shrink-0 bg-[var(--surface-muted)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {item.product?.name || item.productName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                              {item.brandName || "Unbranded"}
                            </p>
                            <p className="mt-1 text-[var(--ink-500)]">
                              {item.variant
                                ? `${item.variant.color} / ${item.variant.size}`
                                : "Unavailable variant"}{" "}
                              · Qty {item.quantity}
                            </p>
                          </div>
                          <p className="font-medium">
                            {formatPrice(item.priceAtPurchase * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-6 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
                    <div>
                      <h3 className="font-semibold">Order info</h3>
                      <p className="mt-3 text-[var(--ink-700)]">
                        Created {formatDate(selectedOrder.createdAt)}
                      </p>
                      <p className="mt-1 text-[var(--ink-700)]">
                        Payment method: Card via Paystack
                      </p>
                      <p className="mt-1 text-[var(--ink-700)]">
                        Status: {statusLabel(selectedOrder.status)}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold">Payment</h3>
                      <p className="mt-3 text-[var(--ink-700)]">
                        Amount: {formatPrice(selectedOrder.total)}
                      </p>
                      <p className="mt-1 break-all text-[var(--ink-700)]">
                        Reference: {selectedOrder.paystackReference}
                      </p>
                    </div>
                  </section>

                  <section className="border-t border-[var(--line)] pt-6">
                    <h3 className="font-semibold">Customer</h3>
                    <p className="mt-3">
                      <Link
                        to={`/admin/customers/${selectedOrder.customer.id}`}
                        className="font-medium underline underline-offset-4"
                      >
                        {selectedOrder.customer.name || "Unnamed customer"}
                      </Link>
                    </p>
                    <p className="mt-1 text-[var(--ink-700)]">
                      {selectedOrder.customer.email}
                    </p>
                    <p className="mt-1 text-[var(--ink-700)]">
                      {selectedOrder.shippingAddress.phone}
                    </p>
                  </section>

                  <section className="border-t border-[var(--line)] pt-6">
                    <h3 className="font-semibold">Shipping address</h3>
                    <p className="mt-3 leading-6 text-[var(--ink-700)]">
                      {selectedOrder.shippingAddress.fullName}
                      <br />
                      {selectedOrder.shippingAddress.address}
                      <br />
                      {selectedOrder.shippingAddress.city},{" "}
                      {selectedOrder.shippingAddress.state}
                    </p>
                  </section>

                  <OrderTimeline status={selectedOrder.status} />
                </div>
              )}
            </Motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
};

export default AdminOrders;
