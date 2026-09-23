import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import AdminSearch from "../component/admin/AdminSearch";
import AdminList from "../component/admin/AdminList";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";

const FILTERS = [
  ["", "All"],
  ["unanswered", "Unanswered"],
  ["unread", "Unread"],
  ["replied", "Replied"],
];

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

const StatusPill = ({ submission }) => {
  const [label, tone] = submission.repliedAt
    ? ["Replied", "border-emerald-200 bg-emerald-50 text-emerald-800"]
    : submission.read
      ? ["Open", "border-[var(--line)] text-[var(--ink-700)]"]
      : ["New", "border-(--color-accent-orange) text-(--color-accent-orange)"];

  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}>
      {label}
    </span>
  );
};

// The detail view carries everything; the list stays scannable.
const MessageDetail = ({ submission, onClose, request, onReplied }) => {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sendReply = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSending(true);
    try {
      const updated = await request(
        `/api/admin/contact-submissions/${encodeURIComponent(submission.id)}/reply`,
        { method: "POST", body: JSON.stringify({ reply }) },
      );
      setNotice(`Reply sent to ${submission.email}.`);
      setReply("");
      onReplied(updated);
    } catch (replyError) {
      // The reply only counts as sent when the provider accepted it — this
      // message means nothing reached the customer.
      setError(replyError.message || "The reply was not sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close message"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/20"
      />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.12)]">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-500)]">
              Message
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold">{submission.subject}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-500)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-6">
          <dl className="grid grid-cols-2 gap-4 border-b border-[var(--line)] pb-5">
            <div>
              <dt className="eyebrow">From</dt>
              <dd className="mt-1 text-[13px] font-semibold">{submission.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="eyebrow">Email</dt>
              <dd className="mt-1 truncate text-[13px]">
                <a href={`mailto:${submission.email}`} className="underline underline-offset-4">
                  {submission.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Received</dt>
              <dd className="mt-1 text-[13px]">{formatDate(submission.createdAt)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Status</dt>
              <dd className="mt-1"><StatusPill submission={submission} /></dd>
            </div>
          </dl>

          <div className="py-5">
            <p className="eyebrow">Their message</p>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink-700)]">
              {submission.message}
            </p>
          </div>

          {submission.repliedAt && (
            <div className="border-t border-[var(--line)] py-5">
              <p className="eyebrow">
                Your reply · {formatDate(submission.repliedAt)}
                {submission.repliedBy ? ` · ${submission.repliedBy}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink-700)]">
                {submission.replyBody}
              </p>
            </div>
          )}

          <form onSubmit={sendReply} className="border-t border-[var(--line)] pt-5">
            <label
              htmlFor="reply-body"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]"
            >
              {submission.repliedAt ? "Send another reply" : "Reply"}
            </label>
            <p className="meta-text mt-1.5">
              Sent as an email to {submission.email} from GRV.
            </p>
            <textarea
              id="reply-body"
              rows={7}
              required
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write your reply…"
              className="mt-3 w-full border border-[var(--line)] bg-white p-3.5 text-[14px] leading-relaxed outline-none transition-colors focus:border-[var(--ink-900)]"
            />
            {error && <InlineNotice tone="error" className="mt-3">{error}</InlineNotice>}
            {notice && <InlineNotice tone="success" className="mt-3">{notice}</InlineNotice>}
            <SubmitButton
              type="submit"
              loading={sending}
              loadingLabel="Sending reply"
              disabled={!reply.trim()}
              className="mt-4"
            >
              Send reply
            </SubmitButton>
          </form>
        </div>
      </aside>
    </div>
  );
};

const AdminContactSubmissions = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState(null);

  // Search and filtering happen in the database, so they cover every
  // message rather than the page currently on screen.
  const submissionsQuery = useQuery({
    queryKey: ["admin", "contact-submissions", { query, filter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (filter) params.set("status", filter);
      const suffix = params.toString() ? `?${params}` : "";
      return request(`/api/admin/contact-submissions${suffix}`);
    },
    enabled: Boolean(session),
  });

  const submissions = submissionsQuery.data || [];
  const openSubmission = submissions.find((item) => item.id === openId) || null;
  const unanswered = submissions.filter((item) => !item.repliedAt).length;

  const openMessage = async (submission) => {
    setOpenId(submission.id);
    // Opening a message is what "read" means; no separate button needed.
    if (!submission.read) {
      try {
        await request(
          `/api/admin/contact-submissions/${encodeURIComponent(submission.id)}`,
          { method: "PUT" },
        );
        queryClient.invalidateQueries({ queryKey: ["admin", "contact-submissions"] });
      } catch {
        // Failing to flag it read is not worth interrupting the admin for.
      }
    }
  };

  const columns = [
    {
      key: "customer",
      label: "Customer",
      mobile: "title",
      render: (row) => (
        <span className="block">
          <span className={row.read ? "font-medium" : "font-semibold"}>{row.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-500)]">
            {row.email}
          </span>
        </span>
      ),
    },
    {
      key: "subject",
      label: "Subject",
      render: (row) => (
        <span className={`line-clamp-2 ${row.read ? "" : "font-semibold"}`}>{row.subject}</span>
      ),
    },
    {
      key: "received",
      label: "Received",
      render: (row) => (
        <span className="whitespace-nowrap text-[var(--ink-500)]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusPill submission={row} />,
    },
  ];

  return (
    <main className="max-w-7xl py-10 md:py-14">
      <AdminPageHeader
        title="Messages"
        count={submissionsQuery.isPending ? undefined : `${submissions.length} shown`}
        subtitle={unanswered > 0 ? `${unanswered} awaiting a reply` : "All caught up"}
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <AdminSearch
          value={query}
          onSearch={setQuery}
          placeholder="Search name, email, subject or message"
          className="sm:max-w-sm sm:flex-1"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          {FILTERS.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 whitespace-nowrap border px-3 py-2 text-[12px] font-medium transition-colors ${
                filter === value
                  ? "border-[var(--ink-900)] bg-[var(--ink-900)] text-white"
                  : "border-[var(--line)] text-[var(--ink-500)] hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <AdminList
          columns={columns}
          rows={submissions}
          loading={submissionsQuery.isPending}
          error={submissionsQuery.error?.message}
          onRetry={() => submissionsQuery.refetch()}
          onRowClick={openMessage}
          emptyTitle={query || filter ? "No messages match" : "No messages yet"}
          emptyMessage={
            query || filter
              ? "Try a different search or clear the filter."
              : "Messages sent through the contact form arrive here."
          }
        />
      </div>

      {openSubmission && (
        <MessageDetail
          submission={openSubmission}
          request={request}
          onClose={() => setOpenId(null)}
          onReplied={() =>
            queryClient.invalidateQueries({ queryKey: ["admin", "contact-submissions"] })
          }
        />
      )}
    </main>
  );
};

export default AdminContactSubmissions;
