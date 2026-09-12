import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";

const formatDate = (value) => new Date(value).toLocaleDateString();

const AdminCustomers = () => {
  const { session } = useAuth();

  const request = useMemo(() => createAuthenticatedRequest(session), [session]);

  const customersQuery = useQuery({
    queryKey: ["admin", "customers"],
    queryFn: () => request("/api/admin/customers"),
    enabled: Boolean(session),
  });
  const customers = customersQuery.data || [];
  const loading = customersQuery.isPending;
  const displayError = customersQuery.error?.message;

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-20">
      <div className="border-b border-black pb-6">
        <Link
          to="/admin"
          className="text-xs uppercase tracking-[0.2em] text-gray-500"
        >
          Admin
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Customers</h1>
      </div>

      {displayError && (
        <div
          role="alert"
          className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {displayError}
        </div>
      )}

      <div className="mt-8 overflow-x-auto border-t border-black">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase tracking-[0.15em] text-gray-500">
            <tr>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Email</th>
              <th className="px-3 py-4 font-medium">Status</th>
              <th className="px-3 py-4 font-medium">Orders</th>
              <th className="px-3 py-4 font-medium">Joined</th>
              <th className="px-3 py-4 text-right font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  <Spinner label="Loading customers" />
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-gray-500">
                  No customers yet.
                </td>
              </tr>
            )}
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-gray-200">
                <td className="px-3 py-4 font-medium">
                  {customer.name || "Unnamed customer"}
                </td>
                <td className="px-3 py-4">{customer.email}</td>
                <td className="px-3 py-4">
                  <span
                    className={
                      customer.active ? "text-green-700" : "text-gray-500"
                    }
                  >
                    {customer.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-4">{customer.orderCount}</td>
                <td className="px-3 py-4">{formatDate(customer.createdAt)}</td>
                <td className="px-3 py-4 text-right">
                  <Link
                    to={`/admin/customers/${customer.id}`}
                    className="text-sm underline"
                  >
                    View customer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};

export default AdminCustomers;
