import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";

const emptyForm = {
  code: "",
  type: "PERCENTAGE",
  value: "",
  active: true,
  expiresAt: "",
  maxUses: "",
};

const dateInputValue = (value) => (value ? value.slice(0, 16) : "");

const AdminDiscounts = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingForm, setEditingForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const discountsQuery = useQuery({
    queryKey: ["admin", "discounts"],
    queryFn: () => request("/api/admin/discounts"),
    enabled: Boolean(session),
  });
  const discounts = discountsQuery.data || [];
  const displayError = error || discountsQuery.error?.message;

  const updateField = (setter) => (event) => {
    const { name, value, type, checked } = event.target;
    setter((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const save = async (event, id, values) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(
        id ? `/api/admin/discounts/${id}` : "/api/admin/discounts",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(values),
        },
      );
      setForm(emptyForm);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (discount) => {
    setEditingId(discount.id);
    setEditingForm({
      code: discount.code,
      type: discount.type,
      value: String(discount.value),
      active: discount.active,
      expiresAt: dateInputValue(discount.expiresAt),
      maxUses: discount.maxUses == null ? "" : String(discount.maxUses),
    });
    setError("");
  };

  const deleteDiscount = async (id) => {
    setDeletingId(id);
    setError("");
    try {
      await request(`/api/admin/discounts/${id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "discounts"] });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId(null);
    }
  };

  const fields = (values, setter) => (
    <>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Code</span>
        <input
          required
          name="code"
          value={values.code}
          onChange={updateField(setter)}
          className="w-full border border-gray-300 px-3 py-2.5 uppercase"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Type</span>
        <select
          name="type"
          value={values.type}
          onChange={updateField(setter)}
          className="w-full border border-gray-300 bg-white px-3 py-2.5"
        >
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Value</span>
        <input
          required
          min="0.01"
          step="0.01"
          type="number"
          name="value"
          value={values.value}
          onChange={updateField(setter)}
          className="w-full border border-gray-300 px-3 py-2.5"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Expires</span>
        <input
          type="datetime-local"
          name="expiresAt"
          value={values.expiresAt}
          onChange={updateField(setter)}
          className="w-full border border-gray-300 px-3 py-2.5"
        />
      </label>
      <label className="text-sm">
        <span className="mb-2 block font-medium">Max uses</span>
        <input
          min="1"
          step="1"
          type="number"
          name="maxUses"
          value={values.maxUses}
          onChange={updateField(setter)}
          className="w-full border border-gray-300 px-3 py-2.5"
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm">
        <input
          type="checkbox"
          name="active"
          checked={values.active}
          onChange={updateField(setter)}
          className="h-4 w-4 accent-black"
        />
        Active
      </label>
    </>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Discounts</h1>
      </div>
      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}
      <form
        onSubmit={(event) => save(event, null, form)}
        className="mt-8 grid gap-4 border-b border-gray-200 pb-8 md:grid-cols-3"
      >
        {fields(form, setForm)}
        <button
          type="submit"
          disabled={saving}
          className="border border-black bg-black px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 md:col-span-3 md:justify-self-start"
        >
          {saving ? <Spinner label="Saving" /> : "Add discount"}
        </button>
      </form>
      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4">Code</th>
              <th className="px-3 py-4">Value</th>
              <th className="px-3 py-4">Uses</th>
              <th className="px-3 py-4">Status</th>
              <th className="px-3 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {discountsQuery.isPending && (
              <tr>
                <td colSpan="5" className="px-3 py-8">
                  <Spinner label="Loading discounts" />
                </td>
              </tr>
            )}
            {!discountsQuery.isPending && discounts.length === 0 && (
              <tr>
                <td colSpan="5" className="px-3 py-8 text-gray-500">
                  No discounts yet.
                </td>
              </tr>
            )}
            {discounts.map((discount) =>
              editingId === discount.id ? (
                <tr key={discount.id} className="border-b border-gray-200">
                  <td colSpan="5" className="px-3 py-4">
                    <form
                      onSubmit={(event) =>
                        save(event, discount.id, editingForm)
                      }
                      className="grid gap-3 md:grid-cols-3"
                    >
                      {fields(editingForm, setEditingForm)}
                      <button
                        type="submit"
                        disabled={saving}
                        className="border border-black bg-black px-3 py-2 text-sm text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-2 text-left text-sm underline"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={discount.id} className="border-b border-gray-200">
                  <td className="px-3 py-4 font-medium">{discount.code}</td>
                  <td className="px-3 py-4">
                    {discount.type === "PERCENTAGE"
                      ? `${discount.value}%`
                      : formatPrice(discount.value)}
                  </td>
                  <td className="px-3 py-4">
                    {discount.usedCount}
                    {discount.maxUses == null ? "" : ` / ${discount.maxUses}`}
                  </td>
                  <td className="px-3 py-4">
                    {discount.active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => startEditing(discount)}
                        className="underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDiscount(discount.id)}
                        disabled={deletingId === discount.id}
                        className="text-red-700 underline"
                      >
                        {deletingId === discount.id ? (
                          <Spinner label="Deleting" />
                        ) : (
                          "Delete"
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminDiscounts;
