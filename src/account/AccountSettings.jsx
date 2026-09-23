import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { createAuthenticatedRequest } from "../lib/apiClient";
import FadeIn from "../component/ui/FadeIn";
import SubmitButton from "../component/ui/SubmitButton";
import Spinner from "../component/ui/Spinner";
import AddressFields from "../component/address/AddressFields";
import PasswordInput from "../component/ui/PasswordInput";
import InlineNotice from "../component/ui/InlineNotice";

const emptyAddress = {
  label: "",
  firstName: "",
  lastName: "",
  country: "",
  countryCode: "",
  phone: "",
  address: "",
  addressLine2: undefined,
  city: "",
  state: "",
  postalCode: "",
  useAsBilling: false,
  isDefault: false,
};

const AccountSettings = ({ embedded = false, activeSection = "details" }) => {
  const { session, user, appUser } = useAuth();
  const memberSince = appUser?.createdAt
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
        new Date(appUser.createdAt),
      )
    : null;
  const request = useMemo(() => createAuthenticatedRequest(session), [session]);
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMarketing, setSavingMarketing] = useState(false);
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

  // Promotional consent is its own action, saved the moment it is toggled:
  // burying a consent checkbox inside an unrelated "save profile" button is
  // how people end up subscribed to things they never agreed to.
  const setMarketingOptIn = async (nextValue) => {
    clearMessages();
    setSavingMarketing(true);
    try {
      await request("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify({ marketingOptIn: nextValue }),
      });
      await queryClient.invalidateQueries({ queryKey: ["me", user.id] });
      setNotice(
        nextValue
          ? "You're subscribed to GRV updates."
          : "You've been unsubscribed from GRV updates.",
      );
    } catch (saveError) {
      setError(saveError.message || "Unable to update your email preferences.");
    } finally {
      setSavingMarketing(false);
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
    const [firstName = "", ...lastNameParts] = (address.fullName || "").split(
      " ",
    );
    const [addressLine = "", addressLine2] = (address.address || "").split(
      "\n",
    );
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label,
      firstName,
      lastName: lastNameParts.join(" "),
      country: address.country || "",
      countryCode: "",
      phone: address.phone,
      address: addressLine,
      addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode || "",
      useAsBilling: false,
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
      const addressPayload = {
        ...addressForm,
        fullName: `${addressForm.firstName} ${addressForm.lastName}`.trim(),
        address: [addressForm.address, addressForm.addressLine2]
          .filter(Boolean)
          .join("\n"),
      };
      delete addressPayload.firstName;
      delete addressPayload.lastName;
      delete addressPayload.countryCode;
      delete addressPayload.addressLine2;
      delete addressPayload.useAsBilling;
      const savedAddress = await request(
        editingAddressId
          ? `/api/account/addresses/${encodeURIComponent(editingAddressId)}`
          : "/api/account/addresses",
        {
          method: editingAddressId ? "PUT" : "POST",
          body: JSON.stringify(addressPayload),
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
    <main className={embedded ? "" : "page-shell min-h-screen pb-24 pt-10 md:pt-14"}>
      {!embedded && (
        <FadeIn>
          <Link
            to="/account"
            className="text-[13px] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
          >
            Back to account
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-6">
            <div>
              <p className="eyebrow">Account</p>
              <h1 className="display-title mt-2 text-4xl md:text-5xl">
                Settings
              </h1>
            </div>
          </div>
        </FadeIn>
      )}

      {(notice || error) && (
        <FadeIn delay={0.05}>
          <InlineNotice tone={error ? "error" : "success"} className="mt-6">
            {error || notice}
          </InlineNotice>
        </FadeIn>
      )}

      {activeSection === "details" && (
        <>
          {/* At-a-glance summary, so a shopper does not have to open two forms
              just to check what email or name is on file. */}
          <div className="mt-8 grid gap-6 border-b border-[var(--line)] pb-8 sm:grid-cols-3">
            <div>
              <p className="eyebrow">Name</p>
              <p className="mt-1.5 text-[15px] font-semibold text-[var(--ink-900)]">
                {appUser?.name || "Not set"}
              </p>
            </div>
            <div>
              <p className="eyebrow">Email</p>
              <p className="mt-1.5 text-[15px] font-semibold text-[var(--ink-900)]">
                {user?.email || "Not available"}
              </p>
              {appUser?.emailVerified === false && (
                <p className="meta-text mt-1 text-(--color-accent-orange)">
                  Not yet verified
                </p>
              )}
            </div>
            {memberSince && (
              <div>
                <p className="eyebrow">Member since</p>
                <p className="mt-1.5 text-[15px] font-semibold text-[var(--ink-900)]">
                  {memberSince}
                </p>
              </div>
            )}
          </div>

          <FadeIn delay={0.04} className="mt-8 border border-[var(--line)] p-6">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
              Email preferences
            </h2>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(appUser?.marketingOptIn)}
                disabled={savingMarketing}
                onChange={(event) => setMarketingOptIn(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-accent-orange)"
              />
              <span>
                <span className="block text-[13px] font-medium text-[var(--ink-900)]">
                  Send me GRV updates
                </span>
                <span className="meta-text mt-1 block">
                  New arrivals, collections and the occasional offer. You can
                  unsubscribe from any of them in one click.
                </span>
              </span>
            </label>
            <p className="meta-text mt-4 border-t border-[var(--line)] pt-4">
              Order confirmations, payment receipts and delivery updates are
              sent regardless — they're part of buying something.
            </p>
          </FadeIn>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <FadeIn delay={0.06} className="border border-[var(--line)] p-6">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Edit profile
              </h2>
              <p className="meta-text mt-1.5">
                This is the name shown on your orders and receipts.
              </p>
              <form onSubmit={saveProfile} className="mt-5">
                <label
                  className="block text-[13px] font-medium text-[var(--ink-900)]"
                  htmlFor="profile-name"
                >
                  Name
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-3 text-sm outline-none transition-colors focus:border-[var(--ink-900)] focus:bg-white"
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

            <FadeIn delay={0.12} className="border border-[var(--line)] p-6">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-500)]">
                Change password
              </h2>
              <p className="meta-text mt-1.5">
                Use at least 6 characters. You'll stay signed in.
              </p>
              <form onSubmit={savePassword} className="mt-5">
                <PasswordInput
                  id="new-password"
                  label="New password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-2 border border-[var(--line)] bg-[var(--surface-muted)] px-3.5 py-3 text-sm outline-none transition-colors focus:border-[var(--ink-900)] focus:bg-white"
                />
                <div className="mt-4">
                  <PasswordInput
                    id="confirm-password"
                    label="Confirm password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={`mt-2 w-full border bg-[var(--surface-muted)] px-3.5 py-3 text-sm outline-none transition-colors focus:bg-white ${
                      confirmPassword && newPassword !== confirmPassword
                        ? "border-red-300 focus:border-red-600"
                        : "border-[var(--line)] focus:border-[var(--ink-900)]"
                    }`}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <InlineNotice tone="error" className="mt-2">
                    Passwords do not match.
                  </InlineNotice>
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
        <FadeIn delay={0.1} className="mt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-5">
            <div>
              <h2 className="text-2xl font-semibold">Address book</h2>
              <p className="meta-text mt-1.5">
                Save addresses for a faster checkout.
              </p>
            </div>
            {editingAddressId && (
              <button
                type="button"
                onClick={cancelAddressEdit}
                className="text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)] underline underline-offset-4 transition-colors hover:text-[var(--ink-900)]"
              >
                Cancel editing
              </button>
            )}
          </div>

          {loading && (
            <div className="mt-6 space-y-3" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="border border-[var(--line)] p-5">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton mt-3 h-3 w-48" />
                  <div className="skeleton mt-2 h-3 w-40" />
                </div>
              ))}
            </div>
          )}
          {!loading && addresses?.length === 0 && (
            <div className="mt-6 flex flex-col items-start gap-2 border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-5 py-8">
              <p className="section-title">No saved addresses yet</p>
              <p className="meta-text">
                Add a shipping address to speed up future checkouts.
              </p>
            </div>
          )}
          <div className="divide-y divide-[var(--line)]">
            {addresses?.map((address) => (
              <article
                key={address.id}
                className="py-6 transition-colors first:pt-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-[var(--ink-900)]">
                        {address.label}
                      </h3>
                      {address.isDefault && (
                        <span className="border border-[var(--ink-900)] bg-[var(--ink-900)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="meta-text mt-3 leading-6">
                      {address.fullName}
                      <br />
                      {address.phone}
                      <br />
                      {address.address}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5 text-[11px] font-semibold uppercase tracking-[0.1em]">
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => makeDefault(address.id)}
                        className="border border-[var(--line)] px-4 py-2 transition-colors hover:border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white"
                      >
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startAddressEdit(address)}
                      className="border border-[var(--line)] px-4 py-2 transition-colors hover:border-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAddress(address.id)}
                      disabled={deletingAddressId === address.id}
                      className="border border-red-200 px-4 py-2 normal-case tracking-normal text-red-700 transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-red-200 disabled:hover:bg-transparent disabled:hover:text-red-700"
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
                className="mt-8 border border-[var(--line)] bg-[var(--surface-muted)] p-6"
              >
                <h3 className="text-[15px] font-semibold text-[var(--ink-900)]">
                  {editingAddressId ? "Edit address" : "Add address"}
                </h3>
                <label className="mt-5 block text-[13px] font-medium text-[var(--ink-900)]">
                  Address label
                  <input
                    required
                    value={addressForm.label}
                    placeholder="e.g. Home"
                    onChange={(event) =>
                      updateAddressField("label", event.target.value)
                    }
                    className="mt-2 w-full border border-[var(--line)] bg-white px-3.5 py-3 font-normal outline-none transition-colors focus:border-[var(--ink-900)]"
                  />
                </label>
                <div className="mt-5">
                  <AddressFields
                    value={addressForm}
                    onChange={setAddressForm}
                    idPrefix="account-address"
                    showHeader
                  />
                </div>
                <label className="mt-5 flex items-center gap-3 text-[13px] text-[var(--ink-900)]">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(event) =>
                      updateAddressField("isDefault", event.target.checked)
                    }
                    className="h-4 w-4 accent-(--color-accent-orange)"
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
