import { variantLabel } from "../lib/variantOptions";
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import RequireAuth from "../component/auth/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";
import InlineNotice from "../component/ui/InlineNotice";
import Breadcrumbs from "../component/ui/Breadcrumbs";

const ISSUE_TYPES = [
  ["REFUND_REQUEST", "Request a refund"],
  ["WRONG_ITEM", "Wrong item received"],
  ["MISSING_ITEM", "Missing item"],
  ["DAMAGED_ITEM", "Damaged item"],
  ["ITEM_NOT_AS_DESCRIBED", "Item not as described"],
  ["PACKAGE_NOT_RECEIVED", "Package not received"],
  ["DELIVERY_ISSUE", "Delivery issue"],
  ["PAYMENT_ISSUE", "Payment issue"],
  ["OTHER", "Other complaint"],
];

const ReportIssueForm = () => {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") || "";
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => request("/api/orders"),
    enabled: Boolean(session),
  });

  const [issueType, setIssueType] = useState("");
  const [orderId, setOrderId] = useState(preselectedOrderId);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [description, setDescription] = useState("");
  const [requestedRefundAmount, setRequestedRefundAmount] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const { data: orderDetail } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => request(`/api/orders/${encodeURIComponent(orderId)}`),
    enabled: Boolean(session && orderId),
  });

  const isRefund = issueType === "REFUND_REQUEST";

  const toggleItem = (itemId) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  };

  const uploadEvidence = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (evidenceUrls.length >= 4) {
      setError("You can attach up to 4 images.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await request("/api/cases/upload-evidence", {
        method: "POST",
        body: formData,
      });
      setEvidenceUrls((current) => [...current, url]);
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!issueType) {
      setError("Select the type of issue.");
      return;
    }
    if (isRefund && !orderId) {
      setError("Select the order this refund request relates to.");
      return;
    }
    if (description.trim().length < 10) {
      setError(
        "Describe the issue in a little more detail (at least 10 characters).",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { case: createdCase } = await request("/api/cases", {
        method: "POST",
        body: JSON.stringify({
          issueType,
          orderId: orderId || undefined,
          orderItemIds: selectedItemIds,
          description: description.trim(),
          requestedRefundAmount:
            isRefund && requestedRefundAmount
              ? requestedRefundAmount
              : undefined,
          evidenceUrls,
        }),
      });
      setResult(createdCase);
    } catch (submitError) {
      setError(submitError.message || "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mt-8 border border-[var(--line)] px-6 py-10">
        <InlineNotice tone="success" className="mb-6">
          We've received your request. Check your email for updates.
        </InlineNotice>
        <p className="section-title">Reference: {result.reference}</p>
        <p className="meta-text mt-2">
          Keep this reference for your records — we'll follow up by email with
          any updates.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/account?section=cases"
            className="border border-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--ink-900)] hover:text-white"
          >
            View my requests
          </Link>
          <Link
            to="/account"
            className="border border-[var(--line)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)] transition-colors hover:border-[var(--ink-900)]"
          >
            Back to account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <label className="block text-sm">
        <span className="mb-2 block font-medium">What's the issue?</span>
        <select
          value={issueType}
          onChange={(event) => setIssueType(event.target.value)}
          className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
        >
          <option value="">Select an issue type</option>
          {ISSUE_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-2 block font-medium">
          Which order? {isRefund ? "" : "(optional)"}
        </span>
        <select
          value={orderId}
          onChange={(event) => {
            setOrderId(event.target.value);
            setSelectedItemIds([]);
          }}
          className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
        >
          <option value="">
            {isRefund ? "Select an order" : "Not related to a specific order"}
          </option>
          {(ordersQuery.data || []).map((order) => (
            <option key={order.id} value={order.id}>
              #{order.id} · {formatPrice(order.total)}
            </option>
          ))}
        </select>
      </label>

      {orderId && orderDetail?.items?.length > 0 && (
        <fieldset className="border border-[var(--line)] p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-[0.1em] text-[var(--ink-500)]">
            Which item(s)? (optional)
          </legend>
          <div className="mt-3 space-y-2">
            {orderDetail.items.map((item) => (
              <label key={item.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <span>
                  {item.productName}
                  {variantLabel(item.variant)
                    ? ` — ${variantLabel(item.variant)}`
                    : ""}{" "}
                  · Qty {item.quantity}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {isRefund && (
        <label className="block text-sm">
          <span className="mb-2 block font-medium">
            Requested refund amount
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={requestedRefundAmount}
            onChange={(event) => setRequestedRefundAmount(event.target.value)}
            placeholder={orderDetail ? String(orderDetail.total) : ""}
            className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
          />
          {orderDetail && (
            <span className="mt-2 block text-xs text-[var(--ink-500)]">
              Order total: {formatPrice(orderDetail.total)}. Leave blank to
              request a full refund.
            </span>
          )}
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-2 block font-medium">Tell us what happened</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          placeholder="Describe the issue in your own words"
          className="w-full border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--ink-900)]"
        />
      </label>

      <div className="text-sm">
        <span className="mb-2 block font-medium">Photos (optional)</span>
        <div className="flex flex-wrap gap-3">
          {evidenceUrls.map((url) => (
            <img
              key={url}
              src={url}
              alt=""
              className="h-20 w-20 object-cover"
            />
          ))}
          {evidenceUrls.length < 4 && (
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center border border-dashed border-[var(--line)] text-xs text-[var(--ink-500)] hover:border-[var(--ink-900)]">
              {uploading ? <Spinner label="" /> : "Add photo"}
              <input
                type="file"
                accept="image/*"
                onChange={uploadEvidence}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Spinner label="Submitting" /> : "Submit request"}
      </button>
    </form>
  );
};

const ReportIssue = () => {
  const navigate = useNavigate();
  return (
    <RequireAuth>
      <main className="page-shell min-h-screen bg-white pb-24 pt-6 md:pt-8">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Account", to: "/account" },
            { label: "Report an issue" },
          ]}
        />
        <div className="mt-6 border-b border-[var(--line)] pb-6">
          <p className="eyebrow">Support</p>
          <h1 className="display-title mt-2 text-3xl md:text-4xl">
            Request a refund or lodge a complaint
          </h1>
          <p className="body-text mt-3 max-w-xl text-sm">
            Tell us what happened and we'll follow up by email. If this is about
            a specific order, choose it below so we can look into it faster.
          </p>
        </div>
        <ReportIssueForm />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-8 text-xs uppercase tracking-[0.2em] text-[var(--ink-500)] underline underline-offset-4"
        >
          Cancel and go back
        </button>
      </main>
    </RequireAuth>
  );
};

export default ReportIssue;
