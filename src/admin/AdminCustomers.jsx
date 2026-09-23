import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import AdminSearch from "../component/admin/AdminSearch";
import AdminList from "../component/admin/AdminList";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));

const Flag = ({ label, tone }) => (
  <span
    className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}
  >
    {label}
  </span>
);

const AdminCustomers = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [query, setQuery] = useState("");

  const customersQuery = useQuery({
    queryKey: ["admin", "customers", { query }],
    queryFn: () =>
      request(`/api/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`),
    enabled: Boolean(session),
  });
  const customers = customersQuery.data || [];

  const columns = [
    {
      key: "name",
      label: "Customer",
      mobile: "title",
      render: (row) => (
        <span className="block">
          <span className="font-medium">{row.name || "—"}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-500)]">
            {row.email}
          </span>
        </span>
      ),
    },
    {
      key: "orders",
      label: "Orders",
      render: (row) => (
        <span>
          {row.orderCount}
          {row.totalSpent > 0 && (
            <span className="ml-2 text-[var(--ink-500)]">
              {formatPrice(row.totalSpent)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "email-state",
      label: "Email",
      render: (row) =>
        row.emailVerified ? (
          <Flag label="Verified" tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
        ) : (
          <Flag label="Unverified" tone="border-(--color-accent-orange) text-(--color-accent-orange)" />
        ),
    },
    {
      key: "marketing",
      label: "Marketing",
      render: (row) =>
        row.marketingOptIn ? (
          <Flag label="Opted in" tone="border-[var(--line)] text-[var(--ink-700)]" />
        ) : (
          <span className="text-[var(--ink-300)]">—</span>
        ),
    },
    {
      key: "joined",
      label: "Joined",
      render: (row) => (
        <span className="whitespace-nowrap text-[var(--ink-500)]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) =>
        row.active ? (
          <span className="text-[var(--ink-500)]">Active</span>
        ) : (
          <Flag label="Disabled" tone="border-red-200 bg-red-50 text-red-800" />
        ),
    },
  ];

  const optedIn = customers.filter((customer) => customer.marketingOptIn).length;

  return (
    <main className="max-w-7xl py-10 md:py-14">
      <AdminPageHeader
        title="Customers"
        count={customersQuery.isPending ? undefined : `${customers.length} shown`}
        subtitle={`${optedIn} opted into marketing`}
      />

      <div className="mt-6">
        <AdminSearch
          value={query}
          onSearch={setQuery}
          placeholder="Search by name or email"
          className="sm:max-w-sm"
        />
      </div>

      <div className="mt-6">
        <AdminList
          columns={columns}
          rows={customers}
          loading={customersQuery.isPending}
          error={customersQuery.error?.message}
          onRetry={() => customersQuery.refetch()}
          onRowClick={(row) => navigate(`/admin/customers/${row.id}`)}
          emptyTitle={query ? "No customers match" : "No customers yet"}
          emptyMessage={
            query ? "Try a different name or email." : "Customers appear here once they sign up."
          }
        />
      </div>
    </main>
  );
};

export default AdminCustomers;
