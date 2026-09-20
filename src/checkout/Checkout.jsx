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
import AddressFields from "../component/address/AddressFields";

const emptyForm = {
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
};

const addressToForm = (address) => {
  const [firstName = "", ...lastNameParts] = (address.fullName || "").split(
    " ",
  );
  const [addressLine = "", addressLine2] = (address.address || "").split("\n");
  return {
    ...emptyForm,
    firstName,
    lastName: lastNameParts.join(" "),
    country: address.country || "",
    phone: address.phone || "",
    address: addressLine,
    addressLine2,
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postalCode || "",
  };
};

const CheckoutContent = () => {
  const { cartItems, subtotal } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountError, setDiscountError] = useState("");

  const { user } = useAuth();
  const firstOrderPromoQuery = useQuery({
    queryKey: ["first-order-promo", user?.id],
    queryFn: () =>
      createAuthenticatedRequest(session)("/api/account/first-order-promo"),
    enabled: Boolean(session && user),
  });
  const firstOrderPromo = firstOrderPromoQuery.data?.eligible
    ? firstOrderPromoQuery.data
    : null;
  const firstOrderDiscount = firstOrderPromo
    ? subtotal * (firstOrderPromo.discountPercent / 100)
    : 0;
  const shippingFeeQuery = useQuery({
    queryKey: ["checkout", "shipping-fee", user?.id, form.state],
    queryFn: () =>
      createAuthenticatedRequest(session)(
        `/api/checkout/shipping-fee?state=${encodeURIComponent(form.state)}`,
      ),
    enabled: Boolean(session && user && form.state),
  });
  const shippingFee = shippingFeeQuery.data?.chargedFee ?? 0;
  const discountAmount = appliedDiscount?.discountAmount ?? 0;
  const checkoutTotal =
    subtotal - firstOrderDiscount - discountAmount + shippingFee;
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
    setForm(addressToForm(defaultAddress));
  }, [savedAddresses]);

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
    setForm(addressToForm(selectedAddress));
  };

  const applyDiscount = async (event) => {
    event.preventDefault();
    setApplyingDiscount(true);
    setDiscountError("");
    try {
      const discount = await createAuthenticatedRequest(session)(
        "/api/checkout/discount",
        {
          method: "POST",
          body: JSON.stringify({
            code: discountCode,
            subtotal,
          }),
        },
      );
      setAppliedDiscount(discount);
    } catch (requestError) {
      setAppliedDiscount(null);
      setDiscountError(requestError.message || "Unable to apply promo code.");
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const request = createAuthenticatedRequest(session);
      const addressPayload = {
        ...form,
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        address: [form.address, form.addressLine2].filter(Boolean).join("\n"),
      };
      delete addressPayload.firstName;
      delete addressPayload.lastName;
      delete addressPayload.countryCode;
      delete addressPayload.addressLine2;
      delete addressPayload.useAsBilling;
      const { authorization_url: authorizationUrl, orderId } = await request(
        "/api/checkout/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            ...addressPayload,
            items: cartItems.map((item) => ({
              productId: item.product.id,
              variantId: item.product.variantId,
              quantity: item.qty,
            })),
            discountCode: appliedDiscount?.code || "",
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

  const isAddressValid = [
    form.firstName,
    form.lastName,
    form.country,
    form.phone,
    form.address,
    form.city,
    form.state,
    form.postalCode,
  ].every((field) => typeof field === "string" && field.trim());

  if (cartItems.length === 0) {
    return (
      <main className="min-h-screen px-6 py-24 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Checkout
          </p>
          <h1 className="mt-4 text-4xl font-semibold">
            Your Goody Bag is empty
          </h1>
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
                        {savedAddress.state} {savedAddress.postalCode}
                        <br />
                        {savedAddress.country}
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

          <form onSubmit={handleSubmit} className="mt-10">
            <AddressFields
              value={form}
              onChange={setForm}
              idPrefix="checkout-address"
            />
            {error && <p className="mt-5 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !isAddressValid}
              className="mt-6 w-full bg-black px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              {submitting ? (
                <Spinner label="Redirecting to payment" />
              ) : (
                "Place Order"
              )}
            </button>
            <p className="mt-4 text-center text-xs leading-5 text-gray-500">
              By placing your order, you agree to our{" "}
              <Link to="/privacy-policy" className="underline">
                Privacy Policy
              </Link>{" "}
              and terms of service.
            </p>
          </form>
        </FadeIn>

        <FadeIn
          className="h-fit border-t border-gray-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8"
          delay={0.1}
        >
          <div className="flex items-center justify-between border-b border-black pb-5">
            <h2 className="text-lg font-semibold">Total</h2>
            <span className="text-lg font-semibold">
              {formatPrice(checkoutTotal)}
            </span>
          </div>
          <form onSubmit={applyDiscount} className="mt-6">
            <label className="block text-sm">
              <span className="mb-2 block font-medium">Promo code</span>
              <div className="flex gap-2">
                <input
                  value={discountCode}
                  onChange={(event) => {
                    setDiscountCode(event.target.value);
                    setAppliedDiscount(null);
                    setDiscountError("");
                  }}
                  placeholder="Enter code"
                  className="min-w-0 flex-1 border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
                <button
                  type="submit"
                  disabled={applyingDiscount || !discountCode.trim()}
                  className="border border-black px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyingDiscount ? "Applying..." : "Apply"}
                </button>
              </div>
            </label>
            {discountError && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {discountError}
              </p>
            )}
            {appliedDiscount && (
              <p className="mt-2 text-sm text-green-700">
                {appliedDiscount.code} applied.
              </p>
            )}
          </form>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Summary</h2>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-xs text-gray-500 underline underline-offset-4"
            >
              Back
            </button>
          </div>
          <div className="mt-4 divide-y divide-gray-200">
            {cartItems.map((item) => {
              const variant = item.product.variants?.find(
                (candidate) => candidate.id === item.product.variantId,
              );
              return (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <div className="flex min-w-0 gap-3">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt=""
                        className="h-16 w-12 shrink-0 object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-medium">{item.product.name}</p>
                      {item.product.brandName && (
                        <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                          {item.product.brandName}
                        </p>
                      )}
                      {variant?.stock <= 3 && (
                        <p className="mt-1 text-xs font-medium text-red-700">
                          Last {variant.stock} left
                        </p>
                      )}
                    </div>
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
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {firstOrderPromo && (
            <>
              <div className="mt-4 flex justify-between text-sm font-semibold text-green-700">
                <span>
                  First order discount: -{firstOrderPromo.discountPercent}%
                </span>
                <span>-{formatPrice(firstOrderDiscount)}</span>
              </div>
            </>
          )}
          {appliedDiscount && (
            <div className="mt-4 flex justify-between text-sm font-semibold text-green-700">
              <span>Promo code: -{appliedDiscount.code}</span>
              <span>-{formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="mt-4 flex justify-between text-base font-semibold">
            <span>
              Delivery
              {shippingFeeQuery.data?.region && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {shippingFeeQuery.data.region}
                </span>
              )}
            </span>
            <span>
              {shippingFeeQuery.isPending && form.state
                ? "..."
                : shippingFee === 0
                  ? "FREE"
                  : formatPrice(shippingFee)}
            </span>
          </div>
          <div className="mt-4 flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatPrice(checkoutTotal)}</span>
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
