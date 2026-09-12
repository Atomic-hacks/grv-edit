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

const AdminCustomerDetail = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    request(`/api/admin/customers/${encodeURIComponent(id)}`)
      .then((data) => {
        if (!cancelled) setCustomer(data);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, request]);

  const toggleActive = async () => {
    if (!customer) return;
    setSaving(true);
    setError("");
    try {
      const updated = await request(`/api/admin/customers/${customer.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !customer.active }),
      });
      setCustomer((current) => ({ ...current, ...updated }));
      await queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <Spinner label="Loading customer" className="text-sm text-gray-500" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20">
      <Link
        to="/admin/customers"
        className="text-xs uppercase tracking-[0.2em] text-gray-500"
      >
        Customers
      </Link>

      {error && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!customer && !error && (
        <p className="mt-8 text-sm text-gray-500">Customer not found.</p>
      )}

      {customer && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6 border-b border-black pb-6">
            <div>
              <h1 className="text-3xl font-semibold">
                {customer.name || "Unnamed customer"}
              </h1>
              <p className="mt-2 text-sm text-gray-600">{customer.email}</p>
            </div>
            <button
              type="button"
              onClick={toggleActive}
              disabled={saving}
              className="border border-black px-5 py-3 text-sm font-medium transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Spinner label="Saving" />
              ) : customer.active ? (
                "Deactivate customer"
              ) : (
                "Activate customer"
              )}
            </button>
          </div>

          <section className="mt-8 border border-gray-200 p-6">
            <div className="flex flex-wrap gap-x-12 gap-y-5 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                  Status
                </p>
                <p className="mt-2 font-medium">
                  {customer.active ? "Active" : "Inactive"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                  Joined
                </p>
                <p className="mt-2 font-medium">
                  {formatDate(customer.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                  Orders
                </p>
                <p className="mt-2 font-medium">{customer.orders.length}</p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-black pb-4">
              <h2 className="text-2xl font-semibold">Order history</h2>
              <p className="text-sm text-gray-500">
                {customer.orders.length} order
                {customer.orders.length === 1 ? "" : "s"}
              </p>
            </div>

            {customer.orders.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">No orders yet.</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {customer.orders.map((order) => (
                  <article key={order.id} className="py-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                          Order
                        </p>
                        <h3 className="mt-2 text-lg font-semibold">
                          #{order.id}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="border border-gray-300 px-3 py-2 text-sm font-semibold">
                          {order.status}
                        </p>
                        <p className="mt-2 font-medium">
                          {formatPrice(order.total)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 border border-gray-200 p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Items
                      </h4>
                      <div className="mt-3 divide-y divide-gray-200">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-4 py-3 text-sm"
                          >
                            <div>
                              <p className="font-medium">
                                Product {item.productId}
                              </p>
                              <p className="mt-1 text-gray-500">
                                Variant {item.variantId} · Qty {item.quantity}
                              </p>
                            </div>
                            <p className="shrink-0 font-medium">
                              {formatPrice(
                                item.priceAtPurchase * item.quantity,
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      {order.fullName}
                      <br />
                      {order.phone}
                      <br />
                      {order.address}
                      <br />
                      {order.city}, {order.state}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};

export default AdminCustomerDetail;
