import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

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
          className="text-sm text-gray-500"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Shipping fees</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Set the delivery fee charged for each Nigerian shipping region.
        </p>
      </div>

      {notice && <p className="mt-6 text-sm text-green-700">{notice}</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
        {fees.map((item) => (
          <form
            key={item.region}
            onSubmit={(event) => {
              event.preventDefault();
              save(item.region, item.fee);
            }}
            className="flex flex-col gap-4 py-5 sm:flex-row sm:items-end sm:justify-between"
          >
            <label className="text-sm">
              <span className="mb-2 block font-medium">{item.region}</span>
              <span className="flex items-center gap-2">
                <span className="text-gray-500">NGN</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={item.fee}
                  onChange={(event) =>
                    updateFee(item.region, event.target.value)
                  }
                  className="w-40 border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
              </span>
            </label>
            <button
              type="submit"
              disabled={savingRegion === item.region}
              className="border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingRegion === item.region ? (
                <Spinner label="Saving" />
              ) : (
                "Save fee"
              )}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
};

export default AdminShippingFees;
