import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const departments = [
  { id: "men", label: "Men", categoryId: "apparel" },
  { id: "women", label: "Women", categoryId: "apparel" },
  { id: "accessories", label: "Accessories", categoryId: "accessories" },
];
const categoryIds = [
  ...new Set(departments.map(({ categoryId }) => categoryId)),
];

const AdminCategoryFilterTypes = () => {
  const { session } = useAuth();
  const [filterTypes, setFilterTypes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingCategoryId, setSavingCategoryId] = useState(null);
  const [error, setError] = useState("");

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const loadAssignments = useCallback(async () => {
    const [filterTypeData, ...categoryData] = await Promise.all([
      request("/api/admin/filter-types"),
      ...categoryIds.map((categoryId) =>
        request(`/api/admin/categories/${categoryId}/filter-types`),
      ),
    ]);
    setFilterTypes(filterTypeData);
    setAssignments(
      Object.fromEntries(
        categoryData.map((category) => [
          category.id,
          category.filterTypes.map((filterType) => filterType.id),
        ]),
      ),
    );
  }, [request]);

  useEffect(() => {
    loadAssignments()
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [loadAssignments]);

  const toggleFilterType = (categoryId, filterTypeId) => {
    setAssignments((current) => {
      const selected = current[categoryId] || [];
      const next = selected.includes(filterTypeId)
        ? selected.filter((id) => id !== filterTypeId)
        : [...selected, filterTypeId];
      return { ...current, [categoryId]: next };
    });
  };

  const saveAssignments = async (categoryId) => {
    setSavingCategoryId(categoryId);
    setError("");
    try {
      const category = await request(
        `/api/admin/categories/${categoryId}/filter-types`,
        {
          method: "PUT",
          body: JSON.stringify({
            filterTypeIds: assignments[categoryId] || [],
          }),
        },
      );
      setAssignments((current) => ({
        ...current,
        [categoryId]: category.filterTypes.map((filterType) => filterType.id),
      }));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingCategoryId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:px-12 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--ink-900)] pb-6">
        <div>
          <Link
            to="/admin"
            className="text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]"
          >
            Admin
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">Category filters</h1>
        </div>
        <p className="max-w-sm text-sm text-[var(--ink-500)]">
          Choose which FilterTypes are available for each department.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-[var(--ink-500)]">
          <Spinner label="Loading category filters" />
        </p>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {departments.map((department) => {
            const selected = assignments[department.categoryId] || [];
            const isSaving = savingCategoryId === department.categoryId;
            return (
              <section
                key={department.id}
                className="border-t border-[var(--ink-900)] px-1 py-5"
              >
                <h2 className="text-lg font-semibold">{department.label}</h2>
                <div className="mt-5 space-y-3">
                  {filterTypes.map((filterType) => (
                    <label
                      key={filterType.id}
                      className="flex items-center gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(filterType.id)}
                        onChange={() =>
                          toggleFilterType(department.categoryId, filterType.id)
                        }
                      />
                      {filterType.name}
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => saveAssignments(department.categoryId)}
                  disabled={isSaving}
                  className="mt-6 border border-[var(--ink-900)] bg-[var(--ink-900)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <Spinner label="Saving" /> : "Save"}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default AdminCategoryFilterTypes;
