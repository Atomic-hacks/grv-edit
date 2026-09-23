import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import AdminPageHeader from "../component/admin/AdminPageHeader";
import InlineNotice from "../component/ui/InlineNotice";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";

const AUDIENCES = [
  ["CUSTOMERS", "Customers who opted in", "Account holders who ticked 'Send me GRV updates'."],
  ["NEWSLETTER", "Newsletter subscribers", "Everyone who signed up through the site footer."],
  ["ALL", "Both", "Opted-in customers and newsletter subscribers, de-duplicated."],
];

const emptyForm = {
  subject: "",
  preheader: "",
  body: "",
  imageUrl: "",
  ctaLabel: "",
  ctaUrl: "",
  featuredProductIds: [],
  audience: "CUSTOMERS",
  scheduledFor: "",
};

// <input type="datetime-local"> wants local time with no zone; the API
// wants an ISO instant. These two keep that conversion in one place.
const toLocalInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
      {label}
    </span>
    {hint && <span className="meta-text mt-1 block">{hint}</span>}
    <div className="mt-2">{children}</div>
  </label>
);

const inputClass =
  "w-full border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--ink-900)]";

const AdminCampaignForm = () => {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const campaignQuery = useQuery({
    queryKey: ["admin", "campaign", id],
    queryFn: () => request(`/api/admin/campaigns/${encodeURIComponent(id)}`),
    enabled: Boolean(session) && !isNew,
  });
  const campaign = campaignQuery.data;

  // Counted live against the current opt-in list, so the number on the send
  // button is the number of inboxes that will actually be reached.
  const audienceQuery = useQuery({
    queryKey: ["admin", "campaign-audience", form.audience],
    queryFn: () =>
      request(`/api/admin/campaigns/audience?audience=${encodeURIComponent(form.audience)}`),
    enabled: Boolean(session),
  });

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => request("/api/admin/products"),
    enabled: Boolean(session),
  });
  const products = productsQuery.data || [];

  useEffect(() => {
    if (!campaign) return;
    setForm({
      subject: campaign.subject || "",
      preheader: campaign.preheader || "",
      body: campaign.body || "",
      imageUrl: campaign.imageUrl || "",
      ctaLabel: campaign.ctaLabel || "",
      ctaUrl: campaign.ctaUrl || "",
      featuredProductIds: campaign.featuredProductIds || [],
      audience: campaign.audience || "CUSTOMERS",
      scheduledFor: toLocalInput(campaign.scheduledFor),
    });
  }, [campaign]);

  const locked = campaign && !["DRAFT", "SCHEDULED", "CANCELLED", "FAILED"].includes(campaign.status);
  const audienceSize = audienceQuery.data?.size;

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const toggleProduct = (productId) =>
    setForm((current) => {
      const selected = current.featuredProductIds.includes(productId);
      if (selected) {
        return {
          ...current,
          featuredProductIds: current.featuredProductIds.filter((item) => item !== productId),
        };
      }
      if (current.featuredProductIds.length >= 3) return current;
      return { ...current, featuredProductIds: [...current.featuredProductIds, productId] };
    });

  const save = async (event) => {
    event?.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const payload = { ...form, scheduledFor: fromLocalInput(form.scheduledFor) };
      const saved = isNew
        ? await request("/api/admin/campaigns", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        : await request(`/api/admin/campaigns/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      if (isNew) {
        navigate(`/admin/campaigns/${saved.id}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ["admin", "campaign", id] });
        setNotice(
          saved.status === "SCHEDULED"
            ? `Saved and scheduled for ${new Date(saved.scheduledFor).toLocaleString()}.`
            : "Saved as a draft.",
        );
      }
      return saved;
    } catch (saveError) {
      setError(saveError.message || "Could not save this campaign.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setError("");
    setNotice("");
    setSending(true);
    try {
      const result = await request(
        `/api/admin/campaigns/${encodeURIComponent(id)}/send`,
        { method: "POST" },
      );
      setNotice(
        `Sent to ${result.result?.sentCount ?? 0} of ${result.result?.recipients ?? 0} recipients.`,
      );
      setConfirmingSend(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    } catch (sendError) {
      setError(sendError.message || "The campaign was not sent.");
      setConfirmingSend(false);
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    setError("");
    try {
      await request(`/api/admin/campaigns/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "campaign", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setNotice("Campaign cancelled. It will not be sent.");
    } catch (cancelError) {
      setError(cancelError.message || "Could not cancel this campaign.");
    }
  };

  if (!isNew && campaignQuery.isPending) {
    return (
      <main className="py-16">
        <Spinner label="Loading campaign" className="text-[13px] text-[var(--ink-500)]" />
      </main>
    );
  }

  const featured = products.filter((product) =>
    form.featuredProductIds.includes(product.id),
  );

  return (
    <main className="max-w-5xl py-10 md:py-14">
      <AdminPageHeader
        title={isNew ? "New campaign" : campaign?.subject || "Campaign"}
        backTo="/admin/campaigns"
        backLabel="Campaigns"
        subtitle={
          campaign
            ? `${campaign.status}${campaign.sentAt ? ` · sent ${new Date(campaign.sentAt).toLocaleString()}` : ""}`
            : "Draft"
        }
      />

      {error && <InlineNotice tone="error" className="mt-6">{error}</InlineNotice>}
      {notice && <InlineNotice tone="success" className="mt-6">{notice}</InlineNotice>}
      {campaign?.lastError && campaign.status === "FAILED" && (
        <InlineNotice tone="error" className="mt-6">
          Last send failed: {campaign.lastError}. Nothing was delivered to{" "}
          {campaign.recipientCount - campaign.sentCount} recipients.
        </InlineNotice>
      )}

      {locked && (
        <InlineNotice tone="success" className="mt-6">
          This campaign has been sent, so it is now a record of what went out
          and can no longer be edited.
        </InlineNotice>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={save} className="space-y-6">
          <fieldset disabled={locked} className="space-y-6">
            <Field label="Subject" hint="Shown in the inbox. Keep it short and specific.">
              <input
                required
                value={form.subject}
                onChange={(event) => update("subject", event.target.value)}
                className={inputClass}
                placeholder="The new season has landed"
              />
            </Field>

            <Field label="Preview text" hint="Optional. The grey line next to the subject.">
              <input
                value={form.preheader}
                onChange={(event) => update("preheader", event.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Message">
              <textarea
                required
                rows={8}
                value={form.body}
                onChange={(event) => update("body", event.target.value)}
                className={`${inputClass} leading-relaxed`}
                placeholder="Write the email…"
              />
            </Field>

            <Field label="Header image URL" hint="Optional. Sits above the message.">
              <input
                value={form.imageUrl}
                onChange={(event) => update("imageUrl", event.target.value)}
                className={inputClass}
                placeholder="https://…"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Button label" hint="Optional.">
                <input
                  value={form.ctaLabel}
                  onChange={(event) => update("ctaLabel", event.target.value)}
                  className={inputClass}
                  placeholder="Shop the collection"
                />
              </Field>
              <Field label="Button link">
                <input
                  value={form.ctaUrl}
                  onChange={(event) => update("ctaUrl", event.target.value)}
                  className={inputClass}
                  placeholder="https://…"
                />
              </Field>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Featured products
              </p>
              <p className="meta-text mt-1">
                Up to three. {form.featuredProductIds.length} selected.
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto border border-[var(--line)]">
                {products.slice(0, 200).map((product) => {
                  const selected = form.featuredProductIds.includes(product.id);
                  return (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 text-[13px] last:border-0 hover:bg-[var(--surface-muted)]"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProduct(product.id)}
                        className="h-4 w-4 accent-(--color-accent-orange)"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {product.brandName ? `${product.brandName} · ` : ""}
                        {product.name}
                      </span>
                      <span className="shrink-0 text-[var(--ink-500)]">
                        {formatPrice(product.basePrice)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Field
              label="Audience"
              hint="Only people who opted in are ever included."
            >
              <div className="space-y-2">
                {AUDIENCES.map(([value, label, description]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 border border-[var(--line)] p-3 transition-colors hover:border-[var(--ink-900)]"
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={form.audience === value}
                      onChange={() => update("audience", value)}
                      className="mt-0.5 h-4 w-4 accent-(--color-accent-orange)"
                    />
                    <span>
                      <span className="block text-[13px] font-medium">{label}</span>
                      <span className="meta-text mt-0.5 block">{description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            <Field
              label="Schedule"
              hint="Leave blank to keep it as a draft. Scheduled sends run on the hour."
            >
              <input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(event) => update("scheduledFor", event.target.value)}
                className={inputClass}
              />
            </Field>
          </fieldset>

          {!locked && (
            <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-5">
              <SubmitButton type="submit" loading={saving} loadingLabel="Saving">
                {form.scheduledFor ? "Save and schedule" : "Save draft"}
              </SubmitButton>
              {!isNew && ["DRAFT", "SCHEDULED"].includes(campaign?.status) && (
                <button
                  type="button"
                  onClick={cancel}
                  className="border border-[var(--line)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-700)] transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white"
                >
                  Cancel campaign
                </button>
              )}
            </div>
          )}
        </form>

        {/* Preview + the send decision, deliberately side by side: the
            consequences of pressing send should be visible while deciding. */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
          <div className="border border-[var(--line)] p-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
              Preview
            </p>
            <div className="mt-4 border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <p className="text-[13px] font-semibold text-[var(--ink-900)]">
                {form.subject || "Subject line"}
              </p>
              {form.preheader && (
                <p className="meta-text mt-1 line-clamp-2">{form.preheader}</p>
              )}
              <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--ink-700)]">
                {form.body || "Your message will appear here."}
              </p>
              {featured.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {featured.map((product) => (
                    <div key={product.id} className="min-w-0 flex-1">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="aspect-3/4 w-full object-cover"
                        />
                      )}
                      <p className="mt-1 truncate text-[10px]">{product.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {form.ctaLabel && (
                <p className="mt-3 inline-block bg-[var(--ink-900)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                  {form.ctaLabel}
                </p>
              )}
              <p className="meta-text mt-3 border-t border-[var(--line)] pt-2 text-[10px]">
                Every recipient gets a working unsubscribe link.
              </p>
            </div>
          </div>

          {!isNew && !locked && (
            <div className="border border-[var(--ink-900)] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                Send now
              </p>
              <p className="meta-text mt-2">
                {audienceSize === undefined
                  ? "Counting recipients…"
                  : `This will email ${audienceSize} ${audienceSize === 1 ? "person" : "people"} immediately.`}
              </p>
              {campaign?.scheduledFor && (
                <p className="meta-text mt-1">
                  Otherwise it goes out {new Date(campaign.scheduledFor).toLocaleString()}.
                </p>
              )}

              {confirmingSend ? (
                <div className="mt-4 space-y-2">
                  <p className="text-[13px] font-semibold">
                    Send &ldquo;{form.subject}&rdquo; to {audienceSize ?? "?"} recipients?
                  </p>
                  <p className="meta-text">This cannot be undone.</p>
                  <div className="flex gap-2 pt-1">
                    <SubmitButton
                      type="button"
                      onClick={sendNow}
                      loading={sending}
                      loadingLabel="Sending"
                    >
                      Yes, send it
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => setConfirmingSend(false)}
                      disabled={sending}
                      className="border border-[var(--line)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingSend(true)}
                  disabled={sending || !form.subject || !form.body}
                  className="mt-4 w-full border border-[var(--ink-900)] bg-[var(--ink-900)] py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:border-(--color-accent-orange) hover:bg-(--color-accent-orange) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send now
                </button>
              )}
            </div>
          )}

          {campaign?.status === "SENT" && (
            <div className="border border-[var(--line)] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Results
              </p>
              <dl className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--ink-500)]">Recipients</dt>
                  <dd>{campaign.recipientCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--ink-500)]">Delivered</dt>
                  <dd>{campaign.sentCount}</dd>
                </div>
                {campaign.failedCount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--ink-500)]">Failed</dt>
                    <dd className="text-red-700">{campaign.failedCount}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
};

export default AdminCampaignForm;
