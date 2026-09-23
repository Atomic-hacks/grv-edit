import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import RequireAuth from "../component/auth/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";
import OrderTimeline from "../component/order/OrderTimeline";
import InlineNotice from "../component/ui/InlineNotice";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));

const OrderDetailContent = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const { user } = useAuth();
  const {
    data: order,
    isPending,
    error,
  } = useQuery({
    queryKey: ["order", user?.id, id],
    queryFn: () =>
      createAuthenticatedRequest(session)(
        `/api/orders/${encodeURIComponent(id)}`,
      ),
    enabled: Boolean(session && user && id),
  });

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-24">
      <Link
        to="/account"
        className="text-sm text-gray-500 underline underline-offset-4"
      >
        Back to account
      </Link>
      {error && <InlineNotice tone="error" className="mt-8">{error}</InlineNotice>}
      {!error && isPending && (
        <Spinner label="Loading order" className="mt-8 text-sm text-gray-500" />
      )}
      {order && (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Order
              </p>
              <h1 className="mt-3 text-3xl font-semibold">#{order.id}</h1>
              <p className="mt-2 text-sm text-gray-500">
                {formatDate(order.createdAt)}
              </p>
            </div>
            <p className="border border-gray-300 px-3 py-2 text-sm font-semibold">
              {order.status}
            </p>
          </div>

          <div className="mt-8">
            <OrderTimeline status={order.status} />
          </div>

          <section className="mt-10 border border-gray-200 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Items
            </h2>
            <div className="mt-4 divide-y divide-gray-200">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <div className="flex min-w-0 gap-4">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-16 w-12 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center bg-gray-100 text-[10px] uppercase tracking-wide text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium">{item.productName}</p>
                      {item.brandName && (
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-gray-500">
                          {item.brandName}
                        </p>
                      )}
                      <p className="mt-1 text-gray-500">
                        {item.variant?.color || ""}
                        {item.variant?.color && item.variant?.size ? " / " : ""}
                        {item.variant?.size || ""} · Qty {item.quantity}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatPrice(item.priceAtPurchase * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-black pt-4 font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </section>

          <section className="mt-8 border border-gray-200 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Shipping address
            </h2>
            <p className="mt-4 text-sm leading-6">
              {order.fullName}
              <br />
              {order.phone}
              <br />
              {order.address}
              <br />
              {order.city}, {order.state} {order.postalCode}
              <br />
              {order.country}
            </p>
          </section>
        </>
      )}
    </main>
  );
};

const OrderDetail = () => (
  <RequireAuth>
    <OrderDetailContent />
  </RequireAuth>
);

export default OrderDetail;
