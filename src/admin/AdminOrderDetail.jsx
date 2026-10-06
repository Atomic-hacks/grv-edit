import { variantLabel } from "../lib/variantOptions";
import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";
import { formatPrice } from "../lib/productHelpers";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));

const transitionsByStatus = {
  PAID: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
};

const FULFILLMENT_STATUSES = [
  "PLACED",
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED",
  "RETURNED",
];

const toDateInputValue = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

const FulfillmentEditor = ({ order, request, onUpdated }) => {
  const fulfillment = order.fulfillment || {};
  const [form, setForm] = useState({
    fulfillmentStatus: fulfillment.status || "PLACED",
    courierName: fulfillment.courierName || "",
    trackingNumber: fulfillment.trackingNumber || "",
    trackingUrl: fulfillment.trackingUrl || "",
    shippingDate: toDateInputValue(fulfillment.shippingDate),
    estimatedDeliveryDate: toDateInputValue(fulfillment.estimatedDeliveryDate),
    deliveryNotes: fulfillment.deliveryNotes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await request(
        `/api/admin/orders/${encodeURIComponent(order.id)}/fulfillment`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...form,
            shippingDate: form.shippingDate || null,
            estimatedDeliveryDate: form.estimatedDeliveryDate || null,
          }),
        },
      );
      onUpdated(updated);
    } catch (saveError) {
      setError(saveError.message || "Unable to update fulfilment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 border border-[var(--line)] p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
        Shipment & tracking
      </h2>
      {error && (
        <p
          role="alert"
          className="mt-4 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Fulfilment status</span>
          <select
            value={form.fulfillmentStatus}
            onChange={update("fulfillmentStatus")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          >
            {FULFILLMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Courier / carrier</span>
          <input
            value={form.courierName}
            onChange={update("courierName")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Tracking number</span>
          <input
            value={form.trackingNumber}
            onChange={update("trackingNumber")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Tracking URL</span>
          <input
            value={form.trackingUrl}
            onChange={update("trackingUrl")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Shipping date</span>
          <input
            type="date"
            value={form.shippingDate}
            onChange={update("shippingDate")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Estimated delivery</span>
          <input
            type="date"
            value={form.estimatedDeliveryDate}
            onChange={update("estimatedDeliveryDate")}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">
            Delivery notes (visible to customer)
          </span>
          <textarea
            value={form.deliveryNotes}
            onChange={update("deliveryNotes")}
            rows={2}
            className="w-full border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Spinner label="Saving" /> : "Save fulfilment"}
          </button>
        </div>
      </form>

      {fulfillment.events?.length > 0 && (
        <div className="mt-6 space-y-2 border-t border-[var(--line)] pt-4 text-xs">
          {fulfillment.events.map((event, index) => (
            <div
              key={index}
              className="flex justify-between text-[var(--ink-500)]"
            >
              <span>{event.status.replace(/_/g, " ")}</span>
              <span>{formatDate(event.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const AdminOrderDetail = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState("");
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    request(`/api/admin/orders/${encodeURIComponent(id)}`)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Unable to load order.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, request]);

  const updateStatus = async (status) => {
    setSavingStatus(true);
    setError("");
    try {
      const updatedOrder = await request(
        `/api/admin/orders/${encodeURIComponent(id)}/status`,
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        },
      );
      setOrder(updatedOrder);
      await queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    } catch (statusError) {
      setError(statusError.message || "Unable to update order status.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <Spinner
          label="Loading order"
          className="text-sm text-[var(--ink-500)]"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20">
      <Link
        to="/admin/orders"
        className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
      >
        Orders
      </Link>

      {error && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!order && !error && (
        <p className="mt-8 text-sm text-[var(--ink-500)]">Order not found.</p>
      )}

      {order && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">
                Order
              </p>
              <h1 className="mt-3 text-3xl font-semibold">#{order.id}</h1>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Created {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="border border-[var(--line)] px-3 py-2 text-sm font-semibold">
                {order.status}
              </p>
              {transitionsByStatus[order.status]?.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {transitionsByStatus[order.status].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateStatus(status)}
                      disabled={savingStatus}
                      className={`border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--ink-900)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                        status === "CANCELLED"
                          ? "border-red-700 text-red-700 hover:bg-red-700"
                          : "border-[var(--ink-900)]"
                      }`}
                    >
                      {savingStatus ? (
                        <Spinner label="Saving" />
                      ) : (
                        `Mark ${status.toLowerCase()}`
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <section className="mt-8 border border-[var(--line)] p-6">
            <div className="flex flex-wrap gap-x-12 gap-y-5 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  Total
                </p>
                <p className="mt-2 font-medium">{formatPrice(order.total)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  Last updated
                </p>
                <p className="mt-2 font-medium">
                  {formatDate(order.updatedAt)}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 border border-[var(--line)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Customer
            </h2>
            <p className="mt-4 text-sm">
              <Link
                to={`/admin/customers/${order.customer.id}`}
                className="font-semibold underline underline-offset-4"
              >
                {order.customer.name || "Unnamed customer"}
              </Link>
              <br />
              <span className="text-[var(--ink-700)]">
                {order.customer.email}
              </span>
            </p>
          </section>

          <section className="mt-8 border border-[var(--line)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Items
            </h2>
            <div className="mt-4 divide-y divide-[var(--line)]">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap justify-between gap-4 py-4 text-sm"
                >
                  <div className="flex min-w-0 gap-4">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-16 w-12 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center bg-[var(--surface-muted)] text-[10px] uppercase tracking-wide text-[var(--ink-300)]">
                        No image
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.product?.name || "Unavailable product"}
                      </p>
                      {item.brandName && (
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                          {item.brandName}
                        </p>
                      )}
                      <p className="mt-1 text-[var(--ink-500)]">
                        {item.variant
                          ? variantLabel(item.variant)
                          : "Unavailable variant"}
                        {item.variant?.sku ? ` · ${item.variant.sku}` : ""} ·
                        Qty {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatPrice(item.priceAtPurchase * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 border border-[var(--line)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Shipping address
            </h2>
            <p className="mt-4 text-sm leading-6">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.phone}
              <br />
              {order.shippingAddress.address}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
            </p>
          </section>

          <FulfillmentEditor
            order={order}
            request={request}
            onUpdated={(fulfillmentResult) =>
              setOrder((current) => ({
                ...current,
                fulfillment: {
                  status: fulfillmentResult.fulfillmentStatus,
                  courierName: fulfillmentResult.courierName,
                  trackingNumber: fulfillmentResult.trackingNumber,
                  trackingUrl: fulfillmentResult.trackingUrl,
                  shippingDate: fulfillmentResult.shippingDate,
                  estimatedDeliveryDate:
                    fulfillmentResult.estimatedDeliveryDate,
                  deliveryNotes: fulfillmentResult.deliveryNotes,
                  events: fulfillmentResult.fulfillmentEvents,
                },
              }))
            }
          />
        </>
      )}
    </main>
  );
};

export default AdminOrderDetail;
