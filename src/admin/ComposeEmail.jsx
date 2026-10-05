import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";

const AUDIENCES = [
  { value: "ONE", label: "One customer", group: false },
  { value: "EMAIL", label: "A typed email address", group: false },
  { value: "ALL", label: "All customers", group: true },
  { value: "ACTIVE", label: "Active customers (visited or ordered in the last 30 days)", group: true },
  { value: "ORDERED", label: "Customers who have placed an order", group: true },
];

const inputClass =
  "w-full border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--ink-900)]";

const useDebounced = (value, delay = 300) => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};

// Write an email from info@ or support@ to one customer, one typed address,
// or a group. Shows exactly how many people will get it before anything is
// sent. Group sends respect marketing consent unless marked as a service
// message (see server/directEmail.js).
const ComposeEmail = ({ request, enabled, onClose }) => {
  const [sender, setSender] = useState("INFO");
  const [audience, setAudience] = useState("ONE");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customer, setCustomer] = useState(null);
  const [email, setEmail] = useState("");
  const [serviceNotice, setServiceNotice] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const optionsQuery = useQuery({
    queryKey: ["admin", "message-options"],
    queryFn: () => request("/api/admin/messages/options"),
    enabled,
  });
  const options = optionsQuery.data;
  const canMailGroups = options?.canMailGroups !== false;
  const isGroup = AUDIENCES.find((a) => a.value === audience)?.group;

  const searchTerm = useDebounced(customerSearch.trim());
  const customersQuery = useQuery({
    queryKey: ["admin", "customers", { query: searchTerm }],
    queryFn: () => request(`/api/admin/customers?q=${encodeURIComponent(searchTerm)}`),
    enabled: enabled && audience === "ONE" && searchTerm.length >= 2 && !customer,
  });

  const typedEmail = useDebounced(email.trim().toLowerCase(), 400);
  const target = {
    audience,
    userId: customer?.id,
    email: typedEmail,
    serviceNotice,
  };
  const ready = audience === "ONE" ? Boolean(customer) : audience === "EMAIL" ? typedEmail.includes("@") : true;
  const previewQuery = useQuery({
    queryKey: ["admin", "message-preview", target],
    queryFn: () => request("/api/admin/messages/preview", { method: "POST", body: JSON.stringify(target) }),
    enabled: enabled && ready,
  });
  const preview = ready ? previewQuery.data : null;
  const count = preview?.count ?? 0;

  const canSend =
    Boolean(subject.trim() && body.trim()) && ready && count > 0 && !preview?.tooMany && !sending &&
    (!isGroup || canMailGroups);

  const send = async (event) => {
    event.preventDefault();
    const sender_ = options?.senders.find((s) => s.value === sender);
    const who = isGroup ? `${count} customer${count === 1 ? "" : "s"}` : preview.sample[0];
    if (!window.confirm(`Send “${subject.trim()}” from ${sender_?.address} to ${who}? This can't be undone.`)) return;
    setSending(true);
    setError("");
    setResult("");
    try {
      const outcome = await request("/api/admin/messages/send", {
        method: "POST",
        body: JSON.stringify({ ...target, sender, subject, body, expectedCount: count }),
      });
      setResult(
        outcome.queued
          ? `Sending to ${outcome.total} people now. This continues in the background.`
          : `Sent to ${outcome.sent} ${outcome.sent === 1 ? "person" : "people"}${outcome.failed ? `, ${outcome.failed} failed` : ""}.`,
      );
      setSubject("");
      setBody("");
    } catch (sendError) {
      setError(sendError.message || "The email could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const chooseAudience = (value) => {
    setAudience(value);
    setCustomer(null);
    setCustomerSearch("");
    setError("");
    setResult("");
  };

  return (
    <form onSubmit={send} className="mt-6 space-y-5 border border-[var(--ink-900)] p-5 md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em]">Write an email</h2>
        <button type="button" onClick={onClose} className="text-xs underline">Close</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Send from</span>
          <select value={sender} onChange={(event) => setSender(event.target.value)} className={inputClass}>
            {(options?.senders || []).map((s) => (
              <option key={s.value} value={s.value}>{s.label} — {s.address}</option>
            ))}
          </select>
          <span className="meta-text mt-1 block">Replies go to your support inbox.</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Send to</span>
          <select value={audience} onChange={(event) => chooseAudience(event.target.value)} className={inputClass}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value} disabled={a.group && !canMailGroups}>
                {a.label}{a.group && !canMailGroups ? " (admins only)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {audience === "ONE" && (
        <div className="text-sm">
          <span className="mb-1.5 block font-medium">Customer</span>
          {customer ? (
            <div className="flex items-center justify-between border border-[var(--line)] px-3 py-2.5">
              <span>{customer.name || "Unnamed"} <span className="meta-text ml-2">{customer.email}</span></span>
              <button type="button" onClick={() => setCustomer(null)} className="text-xs underline">Change</button>
            </div>
          ) : (
            <>
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Search by name or email"
                className={inputClass}
              />
              {(customersQuery.data || []).length > 0 && (
                <ul className="mt-1 max-h-48 divide-y divide-[var(--line)] overflow-y-auto border border-[var(--line)]">
                  {customersQuery.data.slice(0, 8).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCustomer(c)} className="block w-full px-3 py-2 text-left hover:bg-[var(--surface-muted)]">
                        {c.name || "Unnamed"} <span className="meta-text ml-2">{c.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchTerm.length >= 2 && customersQuery.data?.length === 0 && (
                <p className="meta-text mt-1">No customer matches. To write to someone without an account, choose “A typed email address”.</p>
              )}
            </>
          )}
        </div>
      )}

      {audience === "EMAIL" && (
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Email address</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className={inputClass} />
        </label>
      )}

      {isGroup && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={serviceNotice} onChange={(event) => setServiceNotice(event.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="block font-medium">This is a service message, not a promotion</span>
            <span className="meta-text">
              Account, order or policy news. Leave this off for anything promotional: then only customers who opted
              into marketing receive it, with an unsubscribe link.
            </span>
          </span>
        </label>
      )}

      {ready && (
        <p className="border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-sm" aria-live="polite">
          {previewQuery.isFetching && !preview ? "Counting recipients…" : preview?.error ? preview.error : (
            <>
              <strong>{count}</strong> {count === 1 ? "person" : "people"} will receive this
              {preview?.sample?.length > 0 && count > 0 && !isGroup && <> ({preview.sample[0]})</>}
              {preview?.skipped > 0 && <> — {preview.skipped} left out because they haven&apos;t opted into marketing</>}.
              {preview?.tooMany && <span className="ml-1 text-red-700">That&apos;s over {options?.maxRecipients}: use a Campaign for a list this large.</span>}
              {count > 80 && <span className="meta-text ml-1">Check your email plan&apos;s daily sending limit first.</span>}
            </>
          )}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Subject</span>
        <input value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Message</span>
        <textarea rows={8} value={body} maxLength={10000} onChange={(event) => setBody(event.target.value)} className={inputClass} />
        <span className="meta-text mt-1 block">Type {"{name}"} to insert the customer&apos;s first name.</span>
      </label>

      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      {result && <InlineNotice tone="success">{result}</InlineNotice>}

      <SubmitButton type="submit" loading={sending} loadingLabel="Sending" disabled={!canSend}>
        Send email
      </SubmitButton>
    </form>
  );
};

export default ComposeEmail;
