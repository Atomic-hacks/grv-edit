import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

const statuses = ["", "PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const lifecycle = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];

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
  const status = searchParams.get("status") || "";
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

  const updateStatusFilter = (value) => {
    if (value) setSearchParams({ status: value });
    else setSearchParams({});
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = !status || order.status === status;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      order.id.toLowerCase().includes(query) ||
      order.customer.name?.toLowerCase().includes(query) ||
      order.customer.email?.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
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

  const timelineStatus = (step) => {
    if (selectedOrder?.status === "CANCELLED") return "cancelled";
    const currentIndex = lifecycle.indexOf(selectedOrder?.status);
    const stepIndex = lifecycle.indexOf(step);
    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "current";
    return "future";
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-gray-500"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Orders</h1>
          <p className="mt-2 text-sm text-gray-500">
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
          <div key={label} className="border border-gray-200 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              {label}
            </p>
            <p className="mt-3 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-b border-gray-200">
        {statuses.map((option) => (
          <button
            key={option || "all"}
            type="button"
            onClick={() => updateStatusFilter(option)}
            className={`border-b-2 pb-3 text-sm ${status === option ? "border-black font-semibold text-black" : "border-transparent text-gray-500 hover:text-black"}`}
          >
            {option ? statusLabel(option) : "All"} (
            {option ? counts[option] || 0 : counts.total})
          </button>
        ))}
      </div>

      <label className="mt-6 block max-w-xl text-sm font-medium">
        <span className="sr-only">Search orders</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer, email, or order ID"
          className="w-full border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
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

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
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
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading orders" />
                </td>
              </tr>
            )}
            {!loading && filteredOrders.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => (
              <tr
                key={order.id}
                onClick={() => openOrder(order.id)}
                className="cursor-pointer border-b border-gray-200 transition-colors hover:bg-gray-50"
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
                    <span className="text-xs text-gray-400">No image</span>
                  )}
                </td>
                <td className="px-3 py-4">
                  <span className="block font-medium">
                    {order.customer.name || "Unnamed customer"}
                  </span>
                  <span className="mt-1 block text-gray-500">
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
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-black bg-white px-6 py-8 shadow-xl md:px-8"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
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
                  className="text-2xl leading-none text-gray-500 hover:text-black"
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
                        <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
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
                              onClick={() => updateStatus(nextStatus)}
                              disabled={savingStatus}
                              className="border border-black px-3 py-2 text-xs font-medium hover:bg-black hover:text-white disabled:opacity-50"
                            >
                              {savingStatus
                                ? "Saving"
                                : `Mark ${statusLabel(nextStatus)}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold">Items</h3>
                    <div className="mt-4 divide-y divide-gray-200">
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
                            <div className="h-20 w-14 shrink-0 bg-gray-100" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">
                              {item.product?.name || item.productName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-gray-500">
                              {item.brandName || "Unbranded"}
                            </p>
                            <p className="mt-1 text-gray-500">
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

                  <section className="grid gap-6 border-t border-gray-200 pt-6 sm:grid-cols-2">
                    <div>
                      <h3 className="font-semibold">Order info</h3>
                      <p className="mt-3 text-gray-600">
                        Created {formatDate(selectedOrder.createdAt)}
                      </p>
                      <p className="mt-1 text-gray-600">
                        Payment method: Card via Paystack
                      </p>
                      <p className="mt-1 text-gray-600">
                        Status: {statusLabel(selectedOrder.status)}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold">Payment</h3>
                      <p className="mt-3 text-gray-600">
                        Amount: {formatPrice(selectedOrder.total)}
                      </p>
                      <p className="mt-1 break-all text-gray-600">
                        Reference: {selectedOrder.paystackReference}
                      </p>
                    </div>
                  </section>

                  <section className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold">Customer</h3>
                    <p className="mt-3">
                      <Link
                        to={`/admin/customers/${selectedOrder.customer.id}`}
                        className="font-medium underline underline-offset-4"
                      >
                        {selectedOrder.customer.name || "Unnamed customer"}
                      </Link>
                    </p>
                    <p className="mt-1 text-gray-600">
                      {selectedOrder.customer.email}
                    </p>
                    <p className="mt-1 text-gray-600">
                      {selectedOrder.shippingAddress.phone}
                    </p>
                  </section>

                  <section className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold">Shipping address</h3>
                    <p className="mt-3 leading-6 text-gray-600">
                      {selectedOrder.shippingAddress.fullName}
                      <br />
                      {selectedOrder.shippingAddress.address}
                      <br />
                      {selectedOrder.shippingAddress.city},{" "}
                      {selectedOrder.shippingAddress.state}
                    </p>
                  </section>

                  <section className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold">Timeline</h3>
                    <div className="mt-5 space-y-0">
                      {lifecycle.map((step, index) => {
                        const state = timelineStatus(step);
                        return (
                          <div
                            key={step}
                            className="relative flex gap-3 pb-5 last:pb-0"
                          >
                            <div
                              className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] ${state === "complete" || state === "current" ? "border-black bg-black text-white" : "border-gray-300 text-gray-400"}`}
                            >
                              {state === "complete" ? "✓" : index + 1}
                            </div>
                            {index < lifecycle.length - 1 && (
                              <span
                                className={`absolute left-2.25 top-5 h-full w-px ${state === "complete" ? "bg-black" : "bg-gray-200"}`}
                              />
                            )}
                            <p
                              className={
                                state === "future"
                                  ? "text-gray-400"
                                  : "font-medium"
                              }
                            >
                              {step === "PENDING"
                                ? "Order Placed"
                                : step === "PAID"
                                  ? "Payment Confirmed"
                                  : statusLabel(step)}
                            </p>
                          </div>
                        );
                      })}
                      {selectedOrder.status === "CANCELLED" && (
                        <div className="flex gap-3">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center border border-black bg-black text-[10px] text-white">
                            ×
                          </div>
                          <p className="font-medium">Cancelled</p>
                        </div>
                      )}
                    </div>
                  </section>
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
