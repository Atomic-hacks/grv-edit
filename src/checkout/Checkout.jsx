import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import RequireAuth from "../component/auth/RequireAuth";
import { createAuthenticatedRequest } from "../lib/apiClient";
import { formatPrice } from "../lib/productHelpers";
import Spinner from "../component/ui/Spinner";
import FadeIn from "../component/ui/FadeIn";

const emptyForm = {
  fullName: "",
  phone: "",
  address: "",
  city: "",
  state: "",
};

const CheckoutContent = () => {
  const { cartItems, subtotal } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const addressesQuery = useQuery({
    queryKey: ["account", "addresses", user?.id],
    queryFn: () =>
      createAuthenticatedRequest(session)("/api/account/addresses"),
    enabled: Boolean(session && user),
  });
  const savedAddresses = useMemo(
    () => addressesQuery.data || [],
    [addressesQuery.data],
  );
  const addressesLoading = addressesQuery.isPending;
  useEffect(() => {
    const defaultAddress = savedAddresses.find((address) => address.isDefault);
    if (!defaultAddress) return;
    setSelectedAddressId(defaultAddress.id);
    setForm({
      fullName: defaultAddress.fullName,
      phone: defaultAddress.phone,
      address: defaultAddress.address,
      city: defaultAddress.city,
      state: defaultAddress.state,
    });
  }, [savedAddresses]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const selectAddress = (addressId) => {
    setSelectedAddressId(addressId);
    if (!addressId) {
      setForm(emptyForm);
      return;
    }
    const selectedAddress = savedAddresses.find(
      (address) => address.id === addressId,
    );
    if (!selectedAddress) return;
    setForm({
      fullName: selectedAddress.fullName,
      phone: selectedAddress.phone,
      address: selectedAddress.address,
      city: selectedAddress.city,
      state: selectedAddress.state,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const request = createAuthenticatedRequest(session);
      const { authorization_url: authorizationUrl, orderId } = await request(
        "/api/checkout/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            items: cartItems.map((item) => ({
              productId: item.product.id,
              variantId: item.product.variantId,
              quantity: item.qty,
            })),
          }),
        },
      );
      localStorage.setItem("grv_pending_order_id", orderId);
      window.location.href = authorizationUrl;
    } catch (requestError) {
      setError(requestError.message || "Could not initialize payment.");
      setSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen px-6 py-24 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Checkout
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Your cart is empty</h1>
          <Link
            to="/shop"
            className="mt-8 inline-flex bg-black px-6 py-3 text-sm font-medium text-white"
          >
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <FadeIn>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Checkout
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Delivery details</h1>

          {savedAddresses.length > 0 && !addressesLoading && (
            <fieldset className="mt-10 border border-gray-200 p-5">
              <legend className="px-2 text-sm font-semibold">
                Saved addresses
              </legend>
              <div className="mt-2 divide-y divide-gray-200">
                {savedAddresses.map((savedAddress) => (
                  <label
                    key={savedAddress.id}
                    className="flex cursor-pointer gap-3 py-4 first:pt-2 last:pb-2"
                  >
                    <input
                      type="radio"
                      name="savedAddress"
                      value={savedAddress.id}
                      checked={selectedAddressId === savedAddress.id}
                      onChange={() => selectAddress(savedAddress.id)}
                      className="mt-1 h-4 w-4 accent-black"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">
                        {savedAddress.label}
                      </span>
                      <span className="mt-1 block leading-6 text-gray-600">
                        {savedAddress.fullName}, {savedAddress.phone}
                        <br />
                        {savedAddress.address}, {savedAddress.city},{" "}
                        {savedAddress.state}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer gap-3 py-4 last:pb-2">
                  <input
                    type="radio"
                    name="savedAddress"
                    value=""
                    checked={selectedAddressId === null}
                    onChange={() => selectAddress(null)}
                    className="mt-1 h-4 w-4 accent-black"
                  />
                  <span className="text-sm font-semibold">
                    Use a new address
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-10 grid gap-5 sm:grid-cols-2"
          >
            {[
              ["fullName", "Full name", "text"],
              ["phone", "Phone", "tel"],
              ["address", "Address", "text"],
              ["city", "City", "text"],
              ["state", "State", "text"],
            ].map(([name, label, type]) => (
              <label
                key={name}
                className={`flex flex-col gap-2 text-sm ${name === "address" ? "sm:col-span-2" : ""}`}
              >
                {label}
                <input
                  required
                  type={type}
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  className="border border-gray-300 px-3 py-3 outline-none focus:border-black"
                />
              </label>
            ))}
            {error && (
              <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="sm:col-span-2 bg-black px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Spinner label="Redirecting to payment" />
              ) : (
                "Continue to payment"
              )}
            </button>
          </form>
        </FadeIn>

        <FadeIn
          className="h-fit border-t border-gray-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8"
          delay={0.1}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-xs text-gray-500 underline underline-offset-4"
            >
              Back
            </button>
          </div>
          <div className="mt-6 divide-y divide-gray-200">
            {cartItems.map((item) => {
              const variant = item.product.variants?.find(
                (candidate) => candidate.id === item.product.variantId,
              );
              return (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {variant?.color || ""}
                      {variant?.color && variant?.size ? " / " : ""}
                      {variant?.size || ""} · Qty {item.qty}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">
                    {formatPrice(item.product.price * item.qty)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between border-t border-black pt-5 text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
        </FadeIn>
      </div>
    </main>
  );
};

const Checkout = () => (
  <RequireAuth>
    <CheckoutContent />
  </RequireAuth>
);

export default Checkout;
