import React, { useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";
import ComposeEmail from "./ComposeEmail";

const buttonClass = "border border-[var(--line)] px-4 py-2 text-sm transition-colors hover:border-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
const date = (value) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const EmailDetail = ({ id, mailbox, request, userId, onClose }) => {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const attempt = useRef(null);
  const base = `/api/admin/inbox/${encodeURIComponent(id)}`;
  const suffix = `?mailbox=${encodeURIComponent(mailbox.key)}`;
  const detail = useQuery({
    queryKey: ["admin", "inbox-detail", userId, mailbox.key, id],
    queryFn: () => request(`${base}${suffix}`),
    gcTime: 0,
  });
  const message = detail.data;
  const send = async (event) => {
    event.preventDefault();
    setSending(true); setError(""); setNotice("");
    // Retain the key across network retries, but give an edited reply a new key.
    if (attempt.current?.body !== body) attempt.current = { body, requestId: crypto.randomUUID() };
    try {
      await request(`${base}/reply${suffix}`, { method: "POST", body: JSON.stringify(attempt.current) });
      setBody(""); attempt.current = null;
      setNotice(`Reply sent from ${mailbox.address}.`);
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };
  const download = async (attachment) => {
    setError("");
    try {
      const result = await request(`${base}/attachments/${encodeURIComponent(attachment.id)}${suffix}`);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) { setError(err.message); }
  };
  return (
    <section aria-label="Email message" className="min-w-0 border-[var(--line)] lg:border-l lg:pl-8">
      <button className={buttonClass} onClick={onClose} type="button">Back to inbox</button>
      {detail.isPending && <p className="py-8" role="status">Loading message…</p>}
      {detail.isError && <InlineNotice tone="error" className="mt-4">{detail.error.message} <button type="button" className="underline" onClick={() => detail.refetch()}>Try again</button></InlineNotice>}
      {message && <>
        <h2 className="mt-6 break-words text-xl font-semibold">{message.subject || "(No subject)"}</h2>
        <dl className="mt-4 space-y-2 break-words text-sm">
          <div><dt className="inline text-[var(--ink-500)]">From: </dt><dd className="inline">{message.from}</dd></div>
          <div><dt className="inline text-[var(--ink-500)]">To: </dt><dd className="inline">{message.to?.join(", ")}</dd></div>
          <div><dt className="sr-only">Received</dt><dd className="text-[var(--ink-500)]">{date(message.created_at)}</dd></div>
        </dl>
        <div className="my-6 whitespace-pre-wrap break-words border-y border-[var(--line)] py-6 text-sm leading-7 [overflow-wrap:anywhere]">{message.text || "This email has no text content."}</div>
        {message.attachments?.length > 0 && <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold">Attachments</h3>
          <ul className="space-y-2">{message.attachments.map((file) => <li key={file.id}><button type="button" onClick={() => download(file)} className="break-all text-sm underline underline-offset-4">{file.filename || "Download attachment"}{file.size ? ` (${Math.ceil(file.size / 1024)} KB)` : ""}</button></li>)}</ul>
        </div>}
        <form onSubmit={send}>
          <label htmlFor="inbox-reply" className="block text-sm font-semibold">Reply to {message.replyTo}</label>
          <p className="mt-1 break-all text-xs text-[var(--ink-500)]">From {mailbox.address}</p>
          <textarea id="inbox-reply" value={body} onChange={(event) => setBody(event.target.value)} required maxLength={10000} rows={6} disabled={sending} className="mt-3 w-full resize-y border border-[var(--line)] bg-white p-3 text-sm focus:border-[var(--ink-900)] focus:outline-none" />
          {error && <InlineNotice tone="error" className="my-3">{error}</InlineNotice>}
          {notice && <InlineNotice className="my-3" tone="success">{notice}</InlineNotice>}
          <SubmitButton type="submit" loading={sending} loadingLabel="Sending reply" disabled={!body.trim()}>Send reply</SubmitButton>
        </form>
      </>}
    </section>
  );
};

const Mailbox = ({ mailbox, request, userId }) => {
  const [selected, setSelected] = useState(null);
  const messages = useInfiniteQuery({
    queryKey: ["admin", "inbox", userId, mailbox.key],
    initialPageParam: null,
    queryFn: ({ pageParam }) => request(`/api/admin/inbox?mailbox=${encodeURIComponent(mailbox.key)}${pageParam ? `&after=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (page) => page.nextCursor || undefined,
    refetchInterval: 60000,
    gcTime: 0,
  });
  const items = [...new Map((messages.data?.pages.flatMap((page) => page.messages) || []).map((item) => [item.id, item])).values()];
  return <div className={`mt-6 grid gap-8 ${selected ? "lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]" : ""}`}>
    <section aria-label={`${mailbox.address} messages`} className={`min-w-0 ${selected ? "hidden lg:block" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="break-all text-sm font-semibold">{mailbox.address}</h2><button type="button" className={buttonClass} disabled={messages.isFetching} onClick={() => messages.refetch()}>{messages.isFetching ? "Refreshing…" : "Refresh"}</button></div>
      {messages.isPending && <p role="status" className="py-10 text-sm">Loading inbox…</p>}
      {messages.isError && <InlineNotice tone="error">{messages.error.message} <button className="underline" type="button" onClick={() => messages.refetch()}>Try again</button></InlineNotice>}
      {!messages.isPending && !messages.isError && items.length === 0 && <div className="border-y border-[var(--line)] py-12"><h3 className="font-semibold">No emails on this page</h3><p className="mt-2 text-sm text-[var(--ink-500)]">New messages to {mailbox.address} will appear here. Check earlier pages below if available.</p></div>}
      <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">{items.map((email) => <li key={email.id}><button type="button" onClick={() => setSelected(email.id)} aria-current={selected === email.id ? "true" : undefined} className={`w-full px-3 py-5 text-left transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${selected === email.id ? "bg-[var(--surface-muted)]" : ""}`}><span className="block truncate text-sm font-semibold">{email.subject || "(No subject)"}</span><span className="mt-1 block truncate text-sm text-[var(--ink-700)]">{email.from}</span><span className="mt-2 block text-xs text-[var(--ink-500)]">{date(email.created_at)}</span></button></li>)}</ul>
      {messages.hasNextPage && <button type="button" className={`${buttonClass} mt-4 w-full`} disabled={messages.isFetchingNextPage} onClick={() => messages.fetchNextPage()}>{messages.isFetchingNextPage ? "Loading…" : "Load earlier emails"}</button>}
    </section>
    {selected && <EmailDetail key={selected} id={selected} mailbox={mailbox} request={request} userId={userId} onClose={() => setSelected(null)} />}
  </div>;
};

export default function AdminInbox() {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [selected, setSelected] = useState("INFO");
  const [composing, setComposing] = useState(false);
  const options = useQuery({ queryKey: ["admin", "inbox-options", session?.user?.id], queryFn: () => request("/api/admin/inbox/options"), enabled: Boolean(session) });
  const boxes = options.data?.mailboxes || [];
  const mailbox = boxes.find((box) => box.key === selected) || boxes[0];
  return <main className="max-w-7xl py-10 md:py-14">
    <AdminPageHeader title="Email inbox" subtitle="Receive and reply to emails sent to GRVHQ." actions={<button type="button" className={buttonClass} onClick={() => setComposing(!composing)}>{composing ? "Close composer" : "Write an email"}</button>} />
    {composing && <ComposeEmail key={selected} initialSender={selected === "NOREPLY" ? "INFO" : selected} request={request} enabled={Boolean(session)} onClose={() => setComposing(false)} />}
    {options.isPending && <p className="py-8" role="status">Loading inboxes…</p>}
    {options.isError && <InlineNotice tone="error" className="mt-6">{options.error.message} <button type="button" className="underline" onClick={() => options.refetch()}>Try again</button></InlineNotice>}
    {boxes.length > 0 && <div className="mt-6"><label htmlFor="email-mailbox" className="mr-3 text-sm font-semibold">Inbox</label><select id="email-mailbox" value={mailbox?.key} onChange={(event) => setSelected(event.target.value)} className="max-w-full border border-[var(--line)] bg-white px-3 py-2 text-sm">{boxes.map((box) => <option key={box.key} value={box.key}>{box.address}</option>)}</select></div>}
    {options.data && !options.data.enabled && <div className="mt-8 border-y border-[var(--line)] py-10"><h2 className="text-lg font-semibold">Connect email receiving</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-700)]">Your inboxes are ready to connect. Enable receiving for grvhq.com in Resend, verify its receiving DNS record, and finish the server configuration. Incoming emails will then appear here.</p></div>}
    {options.data?.enabled && mailbox && <Mailbox key={mailbox.key} mailbox={mailbox} request={request} userId={session?.user?.id} />}
  </main>;
}
