import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import AdminSearch from "../component/admin/AdminSearch";
import AdminList from "../component/admin/AdminList";

const STATUS_TONE = {
  DRAFT: "border-[var(--line)] text-[var(--ink-500)]",
  SCHEDULED: "border-[var(--ink-900)] text-[var(--ink-900)]",
  SENDING: "border-(--color-accent-orange) text-(--color-accent-orange)",
  SENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-[var(--line)] text-[var(--ink-300)]",
  FAILED: "border-red-200 bg-red-50 text-red-800",
};

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";

const StatusPill = ({ status }) => (
  <span
    className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${STATUS_TONE[status] || STATUS_TONE.DRAFT}`}
  >
    {status}
  </span>
);

const AdminCampaigns = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [query, setQuery] = useState("");

  const campaignsQuery = useQuery({
    queryKey: ["admin", "campaigns", { query }],
    queryFn: () =>
      request(`/api/admin/campaigns${query ? `?q=${encodeURIComponent(query)}` : ""}`),
    enabled: Boolean(session),
  });
  const campaigns = campaignsQuery.data || [];

  const columns = [
    {
      key: "subject",
      label: "Subject",
      mobile: "title",
      render: (row) => <span className="line-clamp-2 font-medium">{row.subject}</span>,
    },
    {
      key: "audience",
      label: "Audience",
      render: (row) => <span className="text-[var(--ink-700)]">{row.audience}</span>,
    },
    {
      key: "when",
      label: "Scheduled / sent",
      render: (row) => (
        <span className="whitespace-nowrap text-[var(--ink-500)]">
          {formatDateTime(row.sentAt || row.scheduledFor)}
        </span>
      ),
    },
    {
      key: "reach",
      label: "Delivered",
      render: (row) =>
        row.status === "SENT" || row.status === "FAILED" ? (
          <span className="text-[var(--ink-700)]">
            {row.sentCount}/{row.recipientCount}
            {row.failedCount > 0 && (
              <span className="text-red-700"> · {row.failedCount} failed</span>
            )}
          </span>
        ) : (
          <span className="text-[var(--ink-300)]">—</span>
        ),
    },
    { key: "status", label: "Status", render: (row) => <StatusPill status={row.status} /> },
  ];

  return (
    <main className="max-w-7xl py-10 md:py-14">
      <AdminPageHeader
        title="Campaigns"
        count={campaignsQuery.isPending ? undefined : `${campaigns.length} shown`}
        subtitle="Promotional email, sent only to customers who opted in"
        actions={
          <Link
            to="/admin/campaigns/new"
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-[12px] font-semibold text-white transition-colors hover:border-(--color-accent-orange) hover:bg-(--color-accent-orange)"
          >
            New campaign
          </Link>
        }
      />

      <div className="mt-6">
        <AdminSearch
          value={query}
          onSearch={setQuery}
          placeholder="Search campaigns by subject"
          className="sm:max-w-sm"
        />
      </div>

      <div className="mt-6">
        <AdminList
          columns={columns}
          rows={campaigns}
          loading={campaignsQuery.isPending}
          error={campaignsQuery.error?.message}
          onRetry={() => campaignsQuery.refetch()}
          emptyTitle={query ? "No campaigns match" : "No campaigns yet"}
          emptyMessage={
            query
              ? "Try a different search."
              : "Create a campaign to announce a collection, a sale or a launch."
          }
          actions={(row) => (
            <Link
              to={`/admin/campaigns/${row.id}`}
              className="text-[12px] font-semibold text-[var(--ink-700)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
            >
              {["DRAFT", "SCHEDULED"].includes(row.status) ? "Edit" : "View"}
            </Link>
          )}
        />
      </div>

      {campaigns.some((campaign) => campaign.status === "FAILED") && (
        <p className="meta-text mt-4">
          A failed campaign was not delivered. Open it to see the provider
          error, then edit and resend.
        </p>
      )}

      <p className="meta-text mt-8 border-t border-[var(--line)] pt-4">
        Scheduled campaigns are sent by the hourly cron job. Order
        confirmations and delivery updates are transactional and are never
        affected by these settings.
      </p>

    </main>
  );
};

export default AdminCampaigns;
