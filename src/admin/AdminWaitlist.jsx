import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";

const statusOptions = ["ALL", "WAITING", "NOTIFIED", "FULFILLED"];
const statusLabel = {
  ALL: "All",
  WAITING: "Waiting",
  NOTIFIED: "Notified",
  FULFILLED: "Fulfilled",
};

const deliveryLabel = (entry) => {
  if (entry.delivery?.state === "QUEUED") return "Email queued";
  if (entry.delivery?.state === "SENT") return "Email accepted";
  if (entry.status === "WAITING") return "Awaiting restock";
  return "No delivery record";
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminWaitlist() {
  const { session } = useAuth();
  const client = useQueryClient();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["admin", "waitlist", { page, status, search }],
    queryFn: () =>
      request(
        `/api/admin/waitlist?page=${page}&status=${status}&q=${encodeURIComponent(search)}`,
      ),
    enabled: Boolean(session),
    staleTime: 0,
  });

  const retry = useMutation({
    mutationFn: () => request("/api/admin/waitlist/retry", { method: "POST" }),
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: async (result) => {
      setNotice(
        result.found
          ? `${result.succeeded} of ${result.found} queued restock emails were accepted.${result.failed ? ` ${result.failed} still need attention.` : ""}`
          : "There were no queued restock emails to retry.",
      );
      await client.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (cause) => setError(cause.message),
  });

  const processEligible = useMutation({
    mutationFn: () => request("/api/admin/waitlist/process", { method: "POST" }),
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: async (result) => {
      setNotice(
        `Processed ${result.eligibleVariants} in-stock option${result.eligibleVariants === 1 ? "" : "s"}. ${result.notificationRetries.succeeded} queued email${result.notificationRetries.succeeded === 1 ? " was" : "s were"} accepted.`,
      );
      await client.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (cause) => setError(cause.message),
  });

  const remove = useMutation({
    mutationFn: (id) => request(`/api/admin/waitlist/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: async (result) => {
      setNotice(
        `Subscription removed.${result.cancelledQueuedEmails ? " Its queued email was cancelled." : ""}`,
      );
      await client.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
    onError: (cause) => setError(cause.message),
  });

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const chooseStatus = (value) => {
    setPage(1);
    setStatus(value);
  };

  const confirmRemove = (entry) => {
    const queued = entry.delivery?.state === "QUEUED"
      ? " This will also cancel the queued restock email."
      : "";
    if (window.confirm(`Remove ${entry.customer.email} from this waitlist?${queued}`)) {
      remove.mutate(entry.id);
    }
  };

  const data = query.data;
  const entries = data?.entries || [];
  const totalSubscriptions = data
    ? Object.values(data.counts).reduce((sum, count) => sum + count, 0)
    : undefined;

  return (
    <main className="max-w-7xl py-10 md:py-14">
      <AdminPageHeader
        title="Waitlist"
        count={totalSubscriptions === undefined ? undefined : `${totalSubscriptions} subscriptions`}
        subtitle={`${data?.counts?.WAITING ?? 0} waiting · ${data?.queuedEmails ?? 0} emails queued`}
        actions={
          <>
            <button
              type="button"
              onClick={() => processEligible.mutate()}
              disabled={processEligible.isPending || !data?.eligibleWaiting}
              className="border border-[var(--line)] px-4 py-2.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {processEligible.isPending ? "Processing…" : "Process eligible updates"}
            </button>
            <button
              type="button"
              onClick={() => retry.mutate()}
              disabled={retry.isPending || !data?.queuedEmails}
              className="border border-[var(--ink-900)] px-4 py-2.5 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {retry.isPending ? "Retrying…" : "Retry queued emails"}
            </button>
          </>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Waiting", data?.counts?.WAITING ?? 0],
          ["Notified", data?.counts?.NOTIFIED ?? 0],
          ["Emails queued", data?.queuedEmails ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="border border-[var(--line)] p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-500)]">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <form onSubmit={submitSearch} className="flex w-full max-w-lg gap-2">
          <label className="min-w-0 flex-1 text-xs font-semibold">
            Search waitlist
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Customer, product, or SKU"
              className="mt-1.5 w-full border border-[var(--line)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <button type="submit" className="self-end border border-[var(--ink-900)] px-4 py-2.5 text-xs font-semibold">Search</button>
        </form>
        <div className="flex flex-wrap gap-2" aria-label="Filter waitlist by status">
          {statusOptions.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={status === value}
              onClick={() => chooseStatus(value)}
              className={`border px-3 py-2 text-xs ${status === value ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white" : "border-[var(--line)]"}`}
            >
              {statusLabel[value]}
            </button>
          ))}
        </div>
      </div>

      {(error || query.error) && <InlineNotice tone="error" className="mt-5">{error || query.error.message}</InlineNotice>}
      {notice && <InlineNotice tone="success" className="mt-5">{notice}</InlineNotice>}
      {data?.eligibleWaiting > 0 && (
        <InlineNotice tone="warning" className="mt-5">
          {data.eligibleWaiting} waiting subscription{data.eligibleWaiting === 1 ? " has" : "s have"} stock available but no update queued. Use “Process eligible updates” to repair this backlog.
        </InlineNotice>
      )}

      <div className="mt-6 overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.12em] text-[var(--ink-500)]">
            <tr>
              {['Customer', 'Product / option', 'Stock', 'Subscription', 'Delivery', 'Joined', ''].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {query.isPending && <tr><td colSpan="7" className="px-4 py-10 text-center">Loading waitlist…</td></tr>}
            {!query.isPending && entries.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-[var(--ink-500)]">No waitlist entries match these filters.</td></tr>}
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-[var(--line)] align-top">
                <td className="px-4 py-4">
                  <Link to={`/admin/customers/${entry.customer.id}`} className="font-medium underline underline-offset-4">{entry.customer.name || "Unnamed customer"}</Link>
                  <span className="mt-1 block text-xs text-[var(--ink-500)]">{entry.customer.email}</span>
                  {!entry.customer.active && <span className="mt-1 block text-xs text-red-700">Account disabled</span>}
                </td>
                <td className="px-4 py-4">
                  <Link to={`/admin/products/${entry.variant.productId}/edit`} className="font-medium underline underline-offset-4">{entry.variant.productName}</Link>
                  <span className="mt-1 block text-xs text-[var(--ink-500)]">{entry.variant.color} · {entry.variant.size} · {entry.variant.sku}</span>
                  {entry.variant.productArchived && <span className="mt-1 block text-xs text-red-700">Product archived</span>}
                </td>
                <td className="px-4 py-4">
                  <span className={entry.variant.stock > 0 ? "text-emerald-700" : "text-[var(--ink-500)]"}>{entry.variant.stock} available</span>
                  {entry.status === "WAITING" && entry.variant.stock > 0 && <span className="mt-1 block text-xs text-amber-700">Needs notification review</span>}
                </td>
                <td className="px-4 py-4">{statusLabel[entry.status]}</td>
                <td className="px-4 py-4">
                  {deliveryLabel(entry)}
                  {entry.delivery?.createdAt && <span className="mt-1 block text-xs text-[var(--ink-500)]">{formatDate(entry.delivery.createdAt)}</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-[var(--ink-500)]">{formatDate(entry.createdAt)}</td>
                <td className="px-4 py-4 text-right">
                  <button type="button" disabled={remove.isPending} onClick={() => confirmRemove(entry)} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-40">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Waitlist pages" className="mt-6 flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 1 || query.isPending} onClick={() => setPage((value) => value - 1)} className="underline disabled:opacity-40">Previous</button>
        <span>Page {page}{data ? ` · ${data.total} matching` : ""}</span>
        <button type="button" disabled={query.isPending || page * (data?.pageSize || 50) >= (data?.total || 0)} onClick={() => setPage((value) => value + 1)} className="underline disabled:opacity-40">Next</button>
      </nav>
    </main>
  );
}
