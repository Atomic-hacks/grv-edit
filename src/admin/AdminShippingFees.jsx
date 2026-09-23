import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { getStatesInRegion } from "../lib/nigeriaRegions";
import Spinner from "../component/ui/Spinner";

const DEFAULT_REGION_NOTE =
  "Fallback rate. Charged when a delivery address doesn't match any region above — including addresses outside Nigeria.";

const AdminShippingFees = () => {
  const { session } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [fees, setFees] = useState([]);
  const [savingRegion, setSavingRegion] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const feesQuery = useQuery({
    queryKey: ["admin", "shipping-fees"],
    queryFn: () => request("/api/admin/shipping-fees"),
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (feesQuery.data) setFees(feesQuery.data);
  }, [feesQuery.data]);

  const updateFee = (region, value) => {
    setFees((current) =>
      current.map((item) =>
        item.region === region ? { ...item, fee: value } : item,
      ),
    );
  };

  const save = async (region, fee) => {
    setSavingRegion(region);
    setNotice("");
    setError("");
    try {
      await request(`/api/admin/shipping-fees/${encodeURIComponent(region)}`, {
        method: "PUT",
        body: JSON.stringify({ fee }),
      });
      setNotice(`${region} shipping fee updated.`);
    } catch (saveError) {
      setError(saveError.message || "Unable to update the shipping fee.");
    } finally {
      setSavingRegion("");
    }
  };

  if (feesQuery.isPending) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <Spinner
          label="Loading shipping fees"
          className="text-sm text-[var(--ink-500)]"
        />
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
        <h1 className="mt-3 text-3xl font-semibold">Shipping fees</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-700)]">
          The delivery fee charged for each region. A customer&rsquo;s fee is
          set by the state they enter at checkout, matched to the region it
          belongs to below.
        </p>
      </div>

      {notice && (
        <p className="mt-6 border-l-2 border-green-700 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {fees.map((item) => {
          const states = getStatesInRegion(item.region);
          const isDefault = item.region === "DEFAULT";

          return (
            <form
              key={item.region}
              onSubmit={(event) => {
                event.preventDefault();
                save(item.region, item.fee);
              }}
              className="grid gap-5 py-7 md:grid-cols-[1fr_auto] md:items-start md:gap-10"
            >
              <div className="min-w-0">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">
                  {isDefault ? "Default / Elsewhere" : item.region}
                </h2>
                {isDefault ? (
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-500)]">
                    {DEFAULT_REGION_NOTE}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-700)]">
                      {states.join(", ")}
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--ink-300)]">
                      {states.length} {states.length === 1 ? "state" : "states"}
                    </p>
                  </>
                )}
              </div>

              <div className="flex items-end gap-3">
                <label className="text-sm">
                  <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-[var(--ink-500)]">
                    Fee
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[var(--ink-500)]">NGN</span>
                    <input
                      required
                      min="0"
                      step="0.01"
                      type="number"
                      value={item.fee}
                      onChange={(event) =>
                        updateFee(item.region, event.target.value)
                      }
                      className="w-32 border border-[var(--line)] px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
                    />
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={savingRegion === item.region}
                  className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingRegion === item.region ? (
                    <Spinner label="Saving" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </main>
  );
};

export default AdminShippingFees;
