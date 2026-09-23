import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import FadeIn from "../component/ui/FadeIn";
import InlineNotice from "../component/ui/InlineNotice";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import AccountSettings from "./AccountSettings";

const SECTIONS = [
  ["orders", "Orders and returns"],
  ["addresses", "Address book"],
  ["details", "Details and security"],
];

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

const formatMemberSince = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric",
      }).format(new Date(value))
    : null;

const OrdersList = () => {
  const { user, session } = useAuth();
  const {
    data: orders,
    isPending: ordersLoading,
    error: ordersError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => createAuthenticatedRequest(session)("/api/orders"),
    enabled: Boolean(user && session),
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--line)] pb-5">
        <h2 className="text-2xl font-semibold">Orders and returns</h2>
        {orders && (
          <span className="meta-text">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {ordersError && (
        <InlineNotice tone="error" className="mt-5">
          {ordersError.message ||
            "Couldn't load your orders. Refresh the page to try again."}{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-1 font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </InlineNotice>
      )}

      {ordersLoading && (
        <div className="mt-5 space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="border border-[var(--line)] p-5">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton mt-3 h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {orders?.length === 0 && (
        <div className="mt-8 flex flex-col items-start gap-3 border border-[var(--line)] px-6 py-10">
          <p className="section-title">You have no orders yet</p>
          <p className="meta-text">
            Everything you buy will show up here, with tracking.
          </p>
          <Link
            to="/shop"
            className="mt-2 border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
          >
            Start shopping
          </Link>
        </div>
      )}

      {orders?.length > 0 && (
        <div className={`mt-5 divide-y divide-[var(--line)] border-x border-b border-[var(--line)] ${isRefetching ? "opacity-60" : ""}`}>
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/account/orders/${order.id}`}
              className="group flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--surface-muted)] sm:p-5"
            >
              <span className="flex items-center gap-4">
                {order.firstImage && (
                  <img
                    src={order.firstImage}
                    alt=""
                    className="h-16 w-12 shrink-0 object-cover"
                  />
                )}
                <span>
                  <span className="block text-[13px] font-semibold">
                    Order #{order.id}
                  </span>
                  <span className="meta-text mt-1 block">
                    {formatDate(order.createdAt)}
                  </span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[13px] font-semibold">
                  {formatPrice(order.total)}
                </span>
                <span className="mt-1.5 inline-flex border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-700)] transition-colors group-hover:border-[var(--ink-900)] group-hover:bg-[var(--ink-900)] group-hover:text-white">
                  {order.status} · {order.itemCount} item
                  {order.itemCount === 1 ? "" : "s"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const Account = () => {
  const { user, appUser, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get("section") || "orders";
  const setSection = (nextSection) => setSearchParams({ section: nextSection });
  const accountName =
    appUser?.name || user?.user_metadata?.name || user?.email || "Account";
  const memberSince = formatMemberSince(appUser?.createdAt);

  return (
    <main className="page-shell min-h-screen bg-white pb-24 pt-6 md:pt-8">
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Account" }]} />

      <FadeIn className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-[var(--line)] pb-6">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display-title mt-2 text-4xl md:text-5xl">
            {accountName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 meta-text">
            {user?.email && <span>{user.email}</span>}
            {memberSince && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-[var(--ink-300)]">·</span>
                Member since {memberSince}
              </span>
            )}
            {appUser?.emailVerified === false && (
              <span className="border border-(--color-accent-orange) px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-(--color-accent-orange)">
                Email unverified
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="shrink-0 border border-[var(--line)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)] transition-colors duration-200 hover:border-red-700 hover:bg-red-700 hover:text-white"
        >
          Log out
        </button>
      </FadeIn>

      <div className="mt-10 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14">
        <nav
          aria-label="Account sections"
          className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-[calc(var(--nav-h)+24px)] lg:h-fit lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
        >
          {SECTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSection(value)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-2.5 text-left text-[13px] font-medium transition-colors lg:w-full lg:border-b-0 lg:border-l-2 lg:px-4 ${
                section === value
                  ? "border-[var(--ink-900)] text-[var(--ink-900)]"
                  : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <section aria-live="polite" className="min-w-0">
          {section === "orders" && (
            <FadeIn>
              <OrdersList />
            </FadeIn>
          )}
          {(section === "addresses" || section === "details") && (
            <AccountSettings embedded activeSection={section} />
          )}
        </section>
      </div>
    </main>
  );
};

export default Account;
