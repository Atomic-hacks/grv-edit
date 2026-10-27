import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), list: vi.fn(), get: vi.fn(), attachment: vi.fn(), send: vi.fn(),
  checkRateLimit: vi.fn(), recordAdminAction: vi.fn(),
}));
vi.mock("../../server/getCurrentUser.js", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../../server/rateLimit.js", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("../../server/auditLog.js", () => ({ recordAdminAction: mocks.recordAdminAction }));
vi.mock("resend", () => ({ Resend: class {
  emails = { receiving: { list: mocks.list, get: mocks.get, attachments: { get: mocks.attachment } }, send: mocks.send };
} }));

import { handleInboxRequest } from "../handlers/inbox.js";
const id = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const requestId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const message = { id, to: ["fegorovie@grvhq.com"], from: "Ada <ada@example.com>",
  reply_to: ["Ada <replies@example.com>"], subject: "Order question", text: null,
  html: '<p>Hello</p><script>alert("unsafe")</script>', message_id: "<original@example.com>", attachments: [] };
const call = (path = "", body, mailbox = "FEGOROVIE") => {
  const url = new URL(`https://grvhq.com/api/admin/inbox${path}?mailbox=${mailbox}`);
  return handleInboxRequest(new Request(url, body ? { method: "POST", body: JSON.stringify(body) } : {}), url.pathname.slice(1).split("/"), url);
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INBOUND_EMAIL_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "test-key");
  mocks.getCurrentUser.mockResolvedValue({ id: "staff", role: "ADMIN" });
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.get.mockResolvedValue({ data: message });
  mocks.send.mockResolvedValue({ data: { id: "sent-id" } });
});

describe("admin inbox", () => {
  it("rejects unauthenticated users and customers before reading mail", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect((await call()).status).toBe(401);
    mocks.getCurrentUser.mockResolvedValueOnce({ role: "CUSTOMER" });
    expect((await call()).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("shows connection status and all mailbox choices without querying Resend", async () => {
    vi.stubEnv("INBOUND_EMAIL_ENABLED", "false");
    const response = await call("/options");
    const result = await response.json();
    expect(result.enabled).toBe(false);
    expect(result.mailboxes).toEqual(expect.arrayContaining([expect.objectContaining({ address: "fegorovie@grvhq.com" }), expect.objectContaining({ key: "NOREPLY" })]));
    expect((await call()).status).toBe(503);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("filters mail to the selected address and preserves the provider cursor", async () => {
    const other = { ...message, id: requestId, to: ["someone@another-domain.com"] };
    mocks.list.mockResolvedValue({ data: { data: [message, other], has_more: true } });
    const response = await call();
    const result = await response.json();
    expect(result.messages.map((email) => email.id)).toEqual([id]);
    expect(result.nextCursor).toBe(requestId);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("does not expose another mailbox's message or its attachments", async () => {
    expect((await call(`/${id}`, null, "SUPPORT")).status).toBe(404);
    expect((await call(`/${id}/attachments/${requestId}`, null, "SUPPORT")).status).toBe(404);
    expect(mocks.attachment).not.toHaveBeenCalled();
  });
  it("lists forwarded messages under the original envelope inbox when list metadata omits it", async () => {
    const forwarded = { ...message, id: "cccccccc-cccc-4ccc-accc-cccccccccccc", to: ["dashboard@inbound.grvhq.com"] };
    mocks.list.mockResolvedValue({ data: { data: [forwarded], has_more: false } });
    mocks.get.mockResolvedValue({ data: { ...forwarded, received_for: ["dashboard@inbound.grvhq.com", "support@grvhq.com"] } });
    const support = await (await call("", null, "SUPPORT")).json();
    expect(support.messages.map((email) => email.id)).toEqual([forwarded.id]);
    const other = await (await call("", null, "INFO")).json();
    expect(other.messages).toEqual([]);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it("reports forwarded-recipient lookup failures instead of silently hiding messages", async () => {
    mocks.list.mockResolvedValue({ data: { data: [{ ...message, id: requestId, to: ["dashboard@inbound.grvhq.com"] }], has_more: false } });
    mocks.get.mockResolvedValue({ error: { message: "Recipient lookup failed" } });
    const response = await call("", null, "SUPPORT");
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("Recipient lookup failed");
  });
  it("returns safe text instead of active incoming HTML", async () => {
    const result = await (await call(`/${id}`)).json();
    expect(result.text).toBe("Hello");
    expect(result.html).toBeUndefined();
  });
  it("supports envelope recipients such as BCC", async () => {
    mocks.get.mockResolvedValue({ data: { ...message, to: [], received_for: ["fegorovie@grvhq.com"] } });
    expect((await call(`/${id}`)).status).toBe(200);
  });
  it("replies from the selected inbox to Reply-To with threading and idempotency", async () => {
    expect((await call(`/${id}/reply`, { body: "Thanks Ada", requestId })).status).toBe(200);
    const [payload, options] = mocks.send.mock.calls[0];
    expect(payload).toMatchObject({ from: "Fegorovie <fegorovie@grvhq.com>", to: "replies@example.com", replyTo: "fegorovie@grvhq.com", text: "Thanks Ada", subject: "Re: Order question", headers: { "In-Reply-To": "<original@example.com>" } });
    expect(options.idempotencyKey).toContain(requestId);
    expect(mocks.recordAdminAction).toHaveBeenCalled();
  });
  it("does not send empty, oversized, unkeyed or rate-limited replies", async () => {
    expect((await call(`/${id}/reply`, { body: "", requestId })).status).toBe(400);
    expect((await call(`/${id}/reply`, { body: "a".repeat(10001), requestId })).status).toBe(400);
    expect((await call(`/${id}/reply`, { body: "Hi" })).status).toBe(400);
    mocks.checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await call(`/${id}/reply`, { body: "Hi", requestId })).status).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("reports provider rejection as failure", async () => {
    mocks.send.mockResolvedValue({ error: { message: "Provider rejected email" } });
    const response = await call(`/${id}/reply`, { body: "Hi", requestId });
    expect(response.status).toBe(502);
    expect((await response.json()).sent).toBeUndefined();
    expect(mocks.recordAdminAction).not.toHaveBeenCalled();
  });
  it("retrieves a fresh attachment URL after checking the mailbox", async () => {
    mocks.attachment.mockResolvedValue({ data: { download_url: "https://attachments.example.com/file" } });
    const response = await call(`/${id}/attachments/${requestId}`);
    expect(await response.json()).toEqual({ url: "https://attachments.example.com/file" });
  });
});
