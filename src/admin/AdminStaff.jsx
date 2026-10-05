import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import Spinner from "../component/ui/Spinner";
import ListToolbar, { ShowMore } from "../component/admin/ListToolbar";
import { useListControls, byText, byDate } from "../lib/useListControls";

const ROLES = [
  "OWNER",
  "ADMIN",
  "SUPPORT",
  "FULFILMENT",
  "ANALYST",
  "CUSTOMER",
];

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );

// Owner-only. Promotes an existing account (they must already have signed
// up like any customer) to a staff role — there is no separate invite flow.
const STAFF_SORTS = [
  { value: "name", label: "Name A–Z", compare: byText((m) => m.name || m.email) },
  { value: "role", label: "Role", compare: byText((m) => m.role) },
  { value: "joined", label: "Newest first", compare: byDate((m) => m.createdAt, -1) },
];

const AdminStaff = () => {
  const { session, appUser } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SUPPORT");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => request("/api/admin/staff"),
    enabled: Boolean(session),
  });

  const staffRowsAll = useMemo(() => staffQuery.data || [], [staffQuery.data]);
  const controls = useListControls(staffRowsAll, { searchText: (m) => `${m.name || ""} ${m.email} ${m.role}`, sorts: STAFF_SORTS });

  const grantRole = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await request(`/api/admin/staff/${encodeURIComponent(email.trim())}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    } catch (grantError) {
      setError(grantError.message || "Unable to update this account's role.");
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (staffMember, newRole) => {
    try {
      await request(
        `/api/admin/staff/${encodeURIComponent(staffMember.email)}`,
        {
          method: "PUT",
          body: JSON.stringify({ role: newRole }),
        },
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    } catch (changeError) {
      setError(changeError.message || "Unable to update this account's role.");
    }
  };

  if (appUser?.role !== "OWNER") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm text-[var(--ink-500)]">
          Only the Owner role can manage staff access.
        </p>
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
        <h1 className="mt-3 text-3xl font-semibold">Staff & Roles</h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">
          Grant a signed-up account one of the staff roles. Permissions are
          enforced on the server, not just hidden in the UI.
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

      <form
        onSubmit={grantRole}
        className="mt-8 flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Account email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            className="w-64 border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1.5 block font-medium">Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--ink-900)]"
          >
            {ROLES.filter((r) => r !== "CUSTOMER").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-[var(--ink-900)] disabled:opacity-50"
        >
          {saving ? <Spinner label="Saving" /> : "Grant role"}
        </button>
      </form>

      <div className="mt-8">
        <ListToolbar controls={controls} placeholder="Search staff by name, email or role" noun="staff" />
      </div>
      <div className="mt-10 overflow-x-auto border-t border-[var(--ink-900)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase tracking-[0.15em] text-[var(--ink-500)]">
            <tr>
              <th className="px-3 py-4 font-medium">Name</th>
              <th className="px-3 py-4 font-medium">Email</th>
              <th className="px-3 py-4 font-medium">Role</th>
              <th className="px-3 py-4 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {!staffQuery.isPending && staffRowsAll.length > 0 && controls.matched === 0 && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-[var(--ink-500)]">
                  Nothing matches your search.
                </td>
              </tr>
            )}
            {staffQuery.isPending && (
              <tr>
                <td colSpan="4" className="px-3 py-8 text-[var(--ink-500)]">
                  <Spinner label="Loading staff" />
                </td>
              </tr>
            )}
            {controls.visible.map((staffMember) => (
              <tr
                key={staffMember.id}
                className="border-b border-[var(--line)]"
              >
                <td className="px-3 py-4">{staffMember.name || "—"}</td>
                <td className="px-3 py-4">{staffMember.email}</td>
                <td className="px-3 py-4">
                  <select
                    value={staffMember.role}
                    onChange={(event) =>
                      changeRole(staffMember, event.target.value)
                    }
                    className="border border-[var(--line)] bg-white px-2 py-1.5 outline-none focus:border-[var(--ink-900)]"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-4">
                  {formatDate(staffMember.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ShowMore controls={controls} />
    </main>
  );
};

export default AdminStaff;
