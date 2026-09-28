import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";

const ISSUE_TYPE_LABELS = {
  REFUND_REQUEST: "Refund request",
  WRONG_ITEM: "Wrong item received",
  MISSING_ITEM: "Missing item",
  DAMAGED_ITEM: "Damaged item",
  ITEM_NOT_AS_DESCRIBED: "Item not as described",
  PACKAGE_NOT_RECEIVED: "Package not received",
  DELIVERY_ISSUE: "Delivery issue",
  PAYMENT_ISSUE: "Payment issue",
  OTHER: "Other complaint",
};

const STATUS_OPTIONS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
  "APPROVED",
  "REJECTED",
  "RESOLVED",
  "CLOSED",
];

const BULK_STATUS_OPTIONS = [
  "UNDER_REVIEW",
  "AWAITING_CUSTOMER_INFO",
  "REJECTED",
  "RESOLVED",
  "CLOSED",
];

const statusLabel = (status) => status.replace(/_/g, " ");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const CaseDetailDrawer = ({ caseId, onClose, request, onChanged }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [statusChoice, setStatusChoice] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request(
        `/api/admin/cases/${encodeURIComponent(caseId)}`,
      );
      setDetail(data);
    } catch (loadError) {
      setError(loadError.message || "Unable to load this case.");
    } finally {
      setLoading(false);
    }
  }, [caseId, request]);

  React.useEffect(() => {
    load();
  }, [load]);

  const submitNote = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/cases/${encodeURIComponent(caseId)}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote("");
      await load();
    } catch (noteError) {
      setError(noteError.message || "Unable to add note.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!statusChoice) return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/cases/${encodeURIComponent(caseId)}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: statusChoice,
          note: statusNote.trim() || undefined,
          approvedAmount:
            statusChoice === "APPROVED" && approvedAmount
              ? approvedAmount
              : undefined,
        }),
      });
      setStatusChoice("");
      setStatusNote("");
      setApprovedAmount("");
      await load();
      onChanged();
    } catch (statusError) {
      setError(statusError.message || "Unable to change status.");
    } finally {
      setSaving(false);
    }
  };

  const processRefund = async () => {
    if (
      !window.confirm(
        "Process this refund through Paystack now? This cannot be undone.",
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      await request(`/api/admin/cases/${encodeURIComponent(caseId)}/refund`, {
        method: "POST",
        body: JSON.stringify({ amount: refundAmount || undefined }),
      });
      setRefundAmount("");
      await load();
      onChanged();
    } catch (refundError) {
      setError(refundError.message || "Refund could not be processed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Motion.button
        type="button"
        aria-label="Close case details"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <Motion.aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-[var(--ink-900)] bg-white px-6 py-8 shadow-xl md:px-8"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
              Case
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {detail?.reference || "…"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-[var(--ink-500)] hover:text-[var(--ink-900)]"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="py-10">
            <Spinner label="Loading case" />
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {detail && (
          <div className="space-y-8 py-6 text-sm">
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                    Status
                  </p>
                  <p className="mt-2 font-semibold">
                    {statusLabel(detail.status)}
                  </p>
                </div>
                <span className="border border-[var(--line)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em]">
                  {detail.category}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                    Customer
                  </dt>
                  <dd className="mt-1">
                    {detail.user?.name || detail.customerEmail}
                    <br />
                    {detail.customerEmail}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                    Issue type
                  </dt>
                  <dd className="mt-1">
                    {ISSUE_TYPE_LABELS[detail.issueType] || detail.issueType}
                  </dd>
                </div>
                {detail.order && (
                  <>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                        Order
                      </dt>
                      <dd className="mt-1">
                        <Link
                          to={`/admin/orders/${detail.order.id}`}
                          className="underline underline-offset-4"
                        >
                          #{detail.order.id}
                        </Link>{" "}
                        · {formatDate(detail.order.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                        Order total / Paid
                      </dt>
                      <dd className="mt-1">
                        {formatPrice(detail.order.total)}
                      </dd>
                    </div>
                  </>
                )}
                {detail.requestedRefundAmount != null && (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                      Requested refund
                    </dt>
                    <dd className="mt-1">
                      {formatPrice(detail.requestedRefundAmount)}
                    </dd>
                  </div>
                )}
                {detail.refundedAmount != null && (
                  <div>
                    <dt className="text-xs uppercase tracking-[0.12em] text-[var(--ink-500)]">
                      Refunded
                    </dt>
                    <dd className="mt-1">
                      {formatPrice(detail.refundedAmount)} on{" "}
                      {formatDate(detail.refundedAt)}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {detail.paystackTransaction && (
              <section className="border border-[var(--line)] p-4">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  Paystack transaction
                </p>
                <p className="mt-2">
                  {formatPrice(detail.paystackTransaction.amount / 100)} ·{" "}
                  {detail.paystackTransaction.status} ·{" "}
                  {detail.paystackTransaction.channel}
                </p>
              </section>
            )}

            <section>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap">{detail.description}</p>
              {detail.evidenceUrls?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.evidenceUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt=""
                        className="h-20 w-20 object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </section>

            {detail.order?.items?.length > 0 && (
              <section>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  Order items
                </p>
                <div className="mt-2 divide-y divide-[var(--line)]">
                  {detail.order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-4 py-2"
                    >
                      <span>
                        {item.productName} · Qty {item.quantity}
                      </span>
                      <span>
                        {formatPrice(item.priceAtPurchase * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="border border-[var(--line)] p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Change status
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={statusChoice}
                  onChange={(event) => setStatusChoice(event.target.value)}
                  className="border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
                >
                  <option value="">Select status…</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {statusLabel(option)}
                    </option>
                  ))}
                </select>
                {statusChoice === "APPROVED" &&
                  detail.category === "REFUND" && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Approved amount"
                      value={approvedAmount}
                      onChange={(event) =>
                        setApprovedAmount(event.target.value)
                      }
                      className="w-40 border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
                    />
                  )}
              </div>
              <input
                type="text"
                placeholder="Note to customer (optional)"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                className="mt-2 w-full border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
              />
              <button
                type="button"
                onClick={changeStatus}
                disabled={!statusChoice || saving}
                className="mt-3 border border-[var(--ink-900)] bg-[var(--ink-900)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
              >
                {saving ? <Spinner label="Saving" /> : "Update status"}
              </button>
            </section>

            {detail.category === "REFUND" && detail.status === "APPROVED" && (
              <section className="border border-[var(--ink-900)] p-4">
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                  Process refund via Paystack
                </p>
                <p className="mt-2 text-xs text-[var(--ink-500)]">
                  This calls Paystack's refund API for the order's transaction.
                  Refund status becomes "processing" until Paystack confirms
                  completion.
                </p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Amount (default ${detail.requestedRefundAmount ?? detail.order?.total ?? ""})`}
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="mt-3 w-48 border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
                />
                <button
                  type="button"
                  onClick={processRefund}
                  disabled={saving}
                  className="mt-3 ml-2 border border-[var(--ink-900)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
                >
                  {saving ? <Spinner label="Processing" /> : "Process refund"}
                </button>
              </section>
            )}

            <section>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                Internal notes
              </p>
              <div className="mt-2 space-y-2">
                {detail.notes?.map((n) => (
                  <div
                    key={n.id}
                    className="border border-[var(--line)] p-3 text-xs"
                  >
                    <p className="font-semibold">
                      {n.author?.name || n.author?.email}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
                    <p className="mt-1 text-[var(--ink-500)]">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={submitNote} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add an internal note"
                  className="flex-1 border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="border border-[var(--ink-900)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
                >
                  Add
                </button>
              </form>
            </section>

            <section>
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
                History
              </p>
              <div className="mt-2 space-y-1 text-xs text-[var(--ink-500)]">
                {detail.events?.map((event) => (
                  <div key={event.id} className="flex justify-between">
                    <span>
                      {event.fromStatus
                        ? `${statusLabel(event.fromStatus)} → `
                        : ""}
                      {statusLabel(event.toStatus)}
                      {event.actor
                        ? ` · ${event.actor.name || event.actor.email}`
                        : ""}
                    </span>
                    <span>{formatDate(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Motion.aside>
    </>
  );
};

const AdminCases = () => {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "REFUND";
  const [openCaseId, setOpenCaseId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  const casesQuery = useQuery({
    queryKey: ["admin", "cases", category],
    queryFn: () => request(`/api/admin/cases?category=${category}`),
    enabled: Boolean(session),
  });
  const cases = casesQuery.data || [];

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  };

  const applyBulk = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await request("/api/admin/cases/bulk-status", {
        method: "PUT",
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      });
      setSelectedIds([]);
      setBulkStatus("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Refunds & Complaints</h1>
          <p className="mt-2 text-sm text-[var(--ink-500)]">
            Refund requests and general complaints, kept separate.
          </p>
        </div>
        <a
          href={`/api/admin/export/cases?category=${category}`}
          className="border border-[var(--line)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)]"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-8 flex gap-x-6 border-b border-[var(--line)]">
        {[
          ["REFUND", "Refund Requests"],
          ["COMPLAINT", "Other Complaints"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSearchParams({ category: value });
              setSelectedIds([]);
            }}
            className={`border-b-2 pb-3 text-sm ${category === value ? "border-[var(--ink-900)] font-semibold text-[var(--ink-900)]" : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border border-[var(--ink-900)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
          <span className="font-medium">{selectedIds.length} selected</span>
          <select
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value)}
            className="border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--ink-900)]"
          >
            <option value="">Set status to…</option>
            {BULK_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyBulk}
            disabled={!bulkStatus || bulkSaving}
            className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-4 py-2 text-white disabled:opacity-50"
          >
            {bulkSaving ? <Spinner label="Applying" /> : "Apply"}
          </button>
          <span className="text-xs text-[var(--ink-500)]">
            Refunds still require individual approval — bulk actions never
            process a refund.
          </span>
        </div>
      )}

      <div className="mt-8 overflow-x-auto border-t border-[var(--ink-900)]">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
            <tr>
              <th className="px-3 py-4 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-4 font-medium">Reference</th>
              <th className="px-3 py-4 font-medium">Customer</th>
              <th className="px-3 py-4 font-medium">Issue</th>
              <th className="px-3 py-4 font-medium">Order</th>
              <th className="px-3 py-4 font-medium">Status</th>
              <th className="px-3 py-4 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {casesQuery.isPending && (
              <tr>
                <td colSpan="7" className="px-3 py-8 text-[var(--ink-500)]">
                  <Spinner label="Loading cases" />
                </td>
              </tr>
            )}
            {!casesQuery.isPending && cases.length === 0 && (
              <tr>
                <td colSpan="7" className="px-3 py-8 text-[var(--ink-500)]">
                  No cases found.
                </td>
              </tr>
            )}
            {cases.map((supportCase) => (
              <tr
                key={supportCase.id}
                onClick={() => setOpenCaseId(supportCase.id)}
                className="cursor-pointer border-b border-[var(--line)] transition-colors hover:bg-[var(--surface-muted)]"
              >
                <td
                  className="px-3 py-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(supportCase.id)}
                    onChange={() => toggleSelected(supportCase.id)}
                  />
                </td>
                <td className="px-3 py-4 font-medium">
                  {supportCase.reference}
                </td>
                <td className="px-3 py-4">
                  <span className="block font-medium">
                    {supportCase.user?.name || "Unnamed"}
                  </span>
                  <span className="mt-1 block text-[var(--ink-500)]">
                    {supportCase.customerEmail}
                  </span>
                </td>
                <td className="px-3 py-4">
                  {ISSUE_TYPE_LABELS[supportCase.issueType] ||
                    supportCase.issueType}
                </td>
                <td className="px-3 py-4">
                  {supportCase.orderId ? `#${supportCase.orderId}` : "—"}
                </td>
                <td className="px-3 py-4">{statusLabel(supportCase.status)}</td>
                <td className="px-3 py-4">
                  {formatDate(supportCase.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {openCaseId && (
          <CaseDetailDrawer
            caseId={openCaseId}
            onClose={() => setOpenCaseId(null)}
            request={request}
            onChanged={() =>
              queryClient.invalidateQueries({ queryKey: ["admin", "cases"] })
            }
          />
        )}
      </AnimatePresence>
    </main>
  );
};

export default AdminCases;
