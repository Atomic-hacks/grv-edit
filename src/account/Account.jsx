import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import FadeIn from "../component/ui/FadeIn";
import AccountSettings from "./AccountSettings";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

const Account = () => {
  const { user, session, appUser, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section") || "orders";
  const {
    data: orders,
    isPending: ordersLoading,
    error: ordersError,
  } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => createAuthenticatedRequest(session)("/api/orders"),
    enabled: Boolean(user && session),
  });

  const setSection = (nextSection) => setSearchParams({ section: nextSection });
  const accountName =
    appUser?.name || user?.user_metadata?.name || user?.email || "Account";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-16 md:px-12 md:py-20">
      <FadeIn>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          Account
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {accountName}
        </h1>
      </FadeIn>

      <div className="mt-10 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Account sections" className="border-t border-gray-200">
          {[
            ["orders", "Orders and returns"],
            ["addresses", "Address book"],
            ["details", "Details and security"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSection(value)}
              className={`block w-full border-b border-gray-200 py-4 text-left text-sm ${section === value ? "font-semibold underline underline-offset-4" : "text-gray-600 hover:text-black"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <section aria-live="polite">
          {section === "orders" && (
            <FadeIn>
              <div>
                <div className="border-b border-gray-200 pb-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-semibold">
                      Orders and returns
                    </h2>
                    {orders && (
                      <span className="text-sm text-gray-500">
                        {orders.length} order{orders.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                {ordersError && (
                  <p className="mt-5 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {ordersError.message || "Unable to load orders."}
                  </p>
                )}
                {ordersLoading && (
                  <div className="mt-5 space-y-3" aria-hidden="true">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        className="animate-pulse border border-gray-100 bg-gray-50 px-4 py-5"
                      >
                        <div className="h-4 w-28 bg-gray-200" />
                        <div className="mt-3 h-3 w-20 bg-gray-200" />
                      </div>
                    ))}
                  </div>
                )}
                {orders?.length === 0 && (
                  <div className="mt-8 border border-gray-200 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      You currently have no orders.
                    </p>
                    <Link
                      to="/shop"
                      className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
                    >
                      Continue shopping
                    </Link>
                  </div>
                )}
                {orders?.length > 0 && (
                  <div className="mt-5 divide-y divide-gray-200">
                    {orders.map((order, index) => (
                      <Link
                        key={order.id}
                        to={`/account/orders/${order.id}`}
                        className="group flex flex-wrap items-center justify-between gap-4 py-4 transition-transform duration-300 ease-in-out hover:translate-x-1"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <span className="flex items-center gap-4">
                          {order.firstImage && (
                            <img
                              src={order.firstImage}
                              alt=""
                              className="h-14 w-10 shrink-0 object-cover"
                            />
                          )}
                          <span>
                            <span className="block font-semibold text-gray-950">
                              #{order.id}
                            </span>
                            <span className="mt-1 block text-sm text-gray-500">
                              {formatDate(order.createdAt)}
                            </span>
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-semibold text-gray-950">
                            {formatPrice(order.total)}
                          </span>
                          <span className="mt-1 inline-flex border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-gray-600 transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white">
                            {order.status} · {order.itemCount} item
                            {order.itemCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          )}
          {(section === "addresses" || section === "details") && (
            <AccountSettings embedded activeSection={section} />
          )}
        </section>
      </div>

      <FadeIn delay={0.24}>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-8 inline-flex items-center justify-center border border-gray-300 px-6 py-3 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-300 ease-in-out hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white"
        >
          Log out
        </button>
      </FadeIn>
    </main>
  );
};

export default Account;
