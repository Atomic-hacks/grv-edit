import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const AdminFirstOrderPromo = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [form, setForm] = useState({
    discountPercent: "",
    freeShipping: false,
    active: true,
    bannerMessage: "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const promoQuery = useQuery({
    queryKey: ["admin", "first-order-promo"],
    queryFn: () => request("/api/admin/first-order-promo"),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (!promoQuery.data) return;
    setForm({
      discountPercent: String(promoQuery.data.discountPercent),
      freeShipping: promoQuery.data.freeShipping,
      active: promoQuery.data.active,
      bannerMessage: promoQuery.data.bannerMessage,
    });
  }, [promoQuery.data]);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await request("/api/admin/first-order-promo", {
        method: "PUT",
        body: JSON.stringify({
          discountPercent: form.discountPercent,
          freeShipping: form.freeShipping,
          active: form.active,
          bannerMessage: form.bannerMessage,
        }),
      });
      await promoQuery.refetch();
      setNotice("First-order promotion updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update the promotion.");
    } finally {
      setSaving(false);
    }
  };

  if (promoQuery.isPending) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <Spinner label="Loading promotion" className="text-sm text-[var(--ink-500)]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-[var(--ink-900)] pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">First-order promotion</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-700)]">
          Configure the one-time promotion available to eligible customers.
        </p>
      </div>

      {notice && <p className="mt-6 text-sm text-green-700">{notice}</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={save} className="mt-8 space-y-8">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Discount %</span>
            <input
              required
              min="0"
              max="100"
              step="0.01"
              type="number"
              name="discountPercent"
              value={form.discountPercent}
              onChange={updateField}
              className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
            />
          </label>
          <div className="space-y-4 pt-7 text-sm">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="freeShipping"
                checked={form.freeShipping}
                onChange={updateField}
                className="h-4 w-4 accent-black"
              />
              Free shipping
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={updateField}
                className="h-4 w-4 accent-black"
              />
              Promotion active
            </label>
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-2 block font-medium">Banner message</span>
          <textarea
            required
            name="bannerMessage"
            value={form.bannerMessage}
            onChange={updateField}
            rows={4}
            className="w-full border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Spinner label="Saving" /> : "Save promotion"}
        </button>
      </form>
    </main>
  );
};

export default AdminFirstOrderPromo;
