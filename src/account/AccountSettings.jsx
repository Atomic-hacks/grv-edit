import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import FadeIn from "../component/ui/FadeIn";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";

const emptyAddress = {
  label: "",
  fullName: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  isDefault: false,
};

const addressFields = [
  ["label", "Label", "e.g. Home"],
  ["fullName", "Full name", "Full name"],
  ["phone", "Phone", "Phone number"],
  ["address", "Address", "Street address"],
  ["city", "City", "City"],
  ["state", "State", "State"],
];

const AccountSettings = ({ embedded = false, activeSection = "details" }) => {
  const { session, user, appUser } = useAuth();
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const addressesQuery = useQuery({
    queryKey: ["account", "addresses", user?.id],
    queryFn: () => request("/api/account/addresses"),
    enabled: Boolean(session && user),
  });
  const addresses = addressesQuery.data;
  const loading = addressesQuery.isPending;

  useEffect(() => {
    setName(appUser?.name || "");
  }, [appUser]);

  useEffect(() => {
    if (addressesQuery.error) {
      setError(addressesQuery.error.message || "Unable to load addresses.");
    }
  }, [addressesQuery.error]);

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    clearMessages();
    setSavingProfile(true);
    try {
      await request("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      await queryClient.invalidateQueries({
        queryKey: ["me", user.id],
      });
      setNotice("Profile updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    clearMessages();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await request("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const updateAddressField = (field, value) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
  };

  const startAddressEdit = (address) => {
    clearMessages();
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      address: address.address,
      city: address.city,
      state: address.state,
      isDefault: address.isDefault,
    });
  };

  const cancelAddressEdit = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddress);
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    clearMessages();
    setSavingAddress(true);
    try {
      const savedAddress = await request(
        editingAddressId
          ? `/api/account/addresses/${encodeURIComponent(editingAddressId)}`
          : "/api/account/addresses",
        {
          method: editingAddressId ? "PUT" : "POST",
          body: JSON.stringify(addressForm),
        },
      );
      queryClient.setQueryData(
        ["account", "addresses", user.id],
        (current = []) =>
          editingAddressId
            ? current.map((address) =>
                address.id === savedAddress.id ? savedAddress : address,
              )
            : [...current, savedAddress],
      );
      await queryClient.invalidateQueries({
        queryKey: ["account", "addresses", user.id],
      });
      cancelAddressEdit();
      setNotice(editingAddressId ? "Address updated." : "Address added.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const makeDefault = async (id) => {
    clearMessages();
    try {
      const updatedAddress = await request(
        `/api/account/addresses/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ isDefault: true }),
        },
      );
      queryClient.setQueryData(
        ["account", "addresses", user.id],
        (current = []) =>
          current.map((address) =>
            address.id === updatedAddress.id
              ? updatedAddress
              : { ...address, isDefault: false },
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["account", "addresses", user.id],
      });
      setNotice("Default address updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update the default address.");
    }
  };

  const deleteAddress = async (id) => {
    clearMessages();
    setDeletingAddressId(id);
    try {
      await request(`/api/account/addresses/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      queryClient.setQueryData(
        ["account", "addresses", user.id],
        (current = []) => current.filter((address) => address.id !== id),
      );
      await queryClient.invalidateQueries({
        queryKey: ["account", "addresses", user.id],
      });
      if (editingAddressId === id) cancelAddressEdit();
      setNotice("Address deleted.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete address.");
    } finally {
      setDeletingAddressId(null);
    }
  };

  return (
    <main
      className={embedded ? "" : "mx-auto min-h-screen max-w-5xl px-6 py-20"}
    >
      {!embedded && (
        <FadeIn>
          <Link
            to="/account"
            className="text-sm text-gray-500 underline underline-offset-4 transition-colors hover:text-black"
          >
            Back to account
          </Link>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Account
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Settings
              </h1>
            </div>
          </div>
        </FadeIn>
      )}

      {(notice || error) && (
        <FadeIn delay={0.05}>
          <p
            role="alert"
            className={`mt-6 border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {error || notice}
          </p>
        </FadeIn>
      )}

      {activeSection === "details" && (
        <>
          <div className="mt-8 border-b border-gray-200 pb-6">
            <h2 className="text-2xl font-semibold">Details and security</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="mt-1 font-medium">
                  {appUser?.name || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="mt-1 font-medium">
                  {user?.email || "Not available"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <FadeIn
              delay={0.06}
              className="border border-gray-200 bg-white p-6"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                Edit profile
              </h2>
              <form onSubmit={saveProfile} className="mt-5">
                <label
                  className="block text-sm font-medium"
                  htmlFor="profile-name"
                >
                  Name
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm outline-none transition-[background-color,border-color] duration-300 ease-in-out focus:border-black focus:bg-white"
                />
                <SubmitButton
                  type="submit"
                  loading={savingProfile}
                  loadingLabel="Saving profile"
                  className="mt-4"
                >
                  Save profile
                </SubmitButton>
              </form>
            </FadeIn>

            <FadeIn
              delay={0.12}
              className="border border-gray-200 bg-white p-6"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                Change password
              </h2>
              <form onSubmit={savePassword} className="mt-5">
                <label
                  className="block text-sm font-medium"
                  htmlFor="new-password"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 w-full border border-gray-300 bg-gray-50 px-3.5 py-3 text-sm outline-none transition-[background-color,border-color] duration-300 ease-in-out focus:border-black focus:bg-white"
                />
                <label
                  className="mt-4 block text-sm font-medium"
                  htmlFor="confirm-password"
                >
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`mt-2 w-full border bg-gray-50 px-3.5 py-3 text-sm outline-none transition-[background-color,border-color] duration-300 ease-in-out focus:bg-white ${
                    confirmPassword && newPassword !== confirmPassword
                      ? "border-red-300 focus:border-red-600"
                      : "border-gray-300 focus:border-black"
                  }`}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">
                    Passwords do not match.
                  </p>
                )}
                <SubmitButton
                  type="submit"
                  loading={savingPassword}
                  loadingLabel="Updating password"
                  className="mt-4"
                >
                  Update password
                </SubmitButton>
              </form>
            </FadeIn>
          </div>
        </>
      )}

      {activeSection === "addresses" && (
        <FadeIn
          delay={0.18}
          className="mt-6 border border-gray-200 bg-white p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                Address book
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Save addresses for a faster checkout.
              </p>
            </div>
            {editingAddressId && (
              <button
                type="button"
                onClick={cancelAddressEdit}
                className="text-sm text-gray-500 underline underline-offset-4 transition-colors hover:text-black"
              >
                Cancel editing
              </button>
            )}
          </div>

          {loading && (
            <div className="mt-6 space-y-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className="animate-pulse border border-gray-100 bg-gray-50 p-5"
                >
                  <div className="h-4 w-24 bg-gray-200" />
                  <div className="mt-3 h-3 w-48 bg-gray-200" />
                  <div className="mt-2 h-3 w-40 bg-gray-200" />
                </div>
              ))}
            </div>
          )}
          {!loading && addresses?.length === 0 && (
            <div className="mt-6 border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
              <p className="text-sm font-medium text-gray-700">
                No saved addresses yet.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Add a shipping address to speed up future checkouts.
              </p>
            </div>
          )}
          <div className="mt-6 divide-y divide-gray-200">
            {addresses?.map((address) => (
              <article
                key={address.id}
                className="py-5 first:pt-0 last:pb-0 transition-transform duration-300 ease-in-out hover:translate-x-1"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-950">
                        {address.label}
                      </h3>
                      {address.isDefault && (
                        <span className="border border-black bg-black px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {address.fullName}
                      <br />
                      {address.phone}
                      <br />
                      {address.address}
                      <br />
                      {address.city}, {address.state}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => makeDefault(address.id)}
                        className="border border-gray-300 px-4 py-2 transition-[background-color,border-color,color,transform] duration-300 ease-in-out hover:-translate-y-0.5 hover:border-black hover:bg-black hover:text-white"
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startAddressEdit(address)}
                      className="border border-gray-300 px-4 py-2 transition-[background-color,border-color,color,transform] duration-300 ease-in-out hover:-translate-y-0.5 hover:border-black hover:bg-black hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAddress(address.id)}
                      disabled={deletingAddressId === address.id}
                      className="border border-red-200 px-4 py-2 text-red-700 transition-[background-color,border-color,color,transform,opacity] duration-300 ease-in-out hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-white disabled:hover:text-red-700"
                    >
                      {deletingAddressId === address.id ? (
                        <Spinner label="Deleting" />
                      ) : (
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <AnimatePresence initial={false} mode="wait">
            <Motion.div
              key={editingAddressId ? "edit-address" : "add-address"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <form
                onSubmit={saveAddress}
                className="mt-8 border border-gray-200 bg-gray-50 p-5"
              >
                <h3 className="font-semibold text-gray-950">
                  {editingAddressId ? "Edit address" : "Add address"}
                </h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {addressFields.map(([field, label, placeholder]) => (
                    <label key={field} className="block text-sm font-medium">
                      {label}
                      <input
                        required
                        value={addressForm[field]}
                        placeholder={placeholder}
                        onChange={(event) =>
                          updateAddressField(field, event.target.value)
                        }
                        className="mt-2 w-full border border-gray-300 bg-white px-3.5 py-3 font-normal outline-none transition-[background-color,border-color] duration-300 ease-in-out focus:border-black"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-5 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) =>
                      updateAddressField("isDefault", event.target.checked)
                    }
                    className="h-4 w-4 accent-black"
                  />
                  Make this my default address
                </label>
                <SubmitButton
                  type="submit"
                  loading={savingAddress}
                  loadingLabel={
                    editingAddressId ? "Saving address" : "Adding address"
                  }
                  className="mt-5"
                >
                  {editingAddressId ? "Save address" : "Add address"}
                </SubmitButton>
              </form>
            </Motion.div>
          </AnimatePresence>
        </FadeIn>
      )}
    </main>
  );
};

export default AccountSettings;
