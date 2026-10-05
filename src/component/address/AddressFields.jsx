import React, { useEffect, useMemo, useRef, useState } from "react";
import { Country, State } from "country-state-city";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

const inputClassName =
  "mt-2 w-full border border-gray-300 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-black";

const normalizePhoneValue = (phone, countryCode) => {
  if (
    typeof phone !== "string" ||
    !phone.trim() ||
    phone.trim().startsWith("+")
  ) {
    return phone;
  }
  const normalizedPhone = phone.trim().replace(/\s|[-()]/g, "");
  if (
    (countryCode === "NG" || !countryCode) &&
    /^0\d{10}$/.test(normalizedPhone)
  ) {
    return `+234${normalizedPhone.slice(1)}`;
  }
  return phone;
};

const countries = Country.getAllCountries();

const CountrySelect = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const selectedCountry = countries.find((country) => country.name === value);
  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return countries;
    return countries.filter((country) =>
      `${country.name} ${country.isoCode}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative mt-2">
      <input
        required
        role="combobox"
        aria-expanded={open}
        aria-label="Country or region"
        value={open ? query : selectedCountry?.name || value}
        placeholder="Select country or region"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        className="w-full border border-gray-300 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-black"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-gray-300 bg-white py-1 shadow-lg">
          {filteredCountries.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-gray-500">
              No countries found.
            </p>
          )}
          {filteredCountries.map((country) => (
            <button
              key={country.isoCode}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(country);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-gray-100"
            >
              <span aria-hidden="true">{country.flag}</span>
              <span>{country.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StateSelect = ({ value, states, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const filteredStates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return states;
    return states.filter((state) =>
      state.name.toLowerCase().includes(normalizedQuery),
    );
  }, [query, states]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative mt-2">
      <input
        required
        role="combobox"
        aria-expanded={open}
        aria-label="State"
        value={open ? query : value}
        placeholder={disabled ? "Select country first" : "Select state"}
        disabled={disabled}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        className="w-full border border-gray-300 bg-white px-3.5 py-3 text-sm outline-none transition-colors focus:border-black disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-gray-300 bg-white py-1 shadow-lg">
          {filteredStates.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-gray-500">
              No states found.
            </p>
          )}
          {filteredStates.map((state) => (
            <button
              key={state.isoCode}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(state.name);
                setQuery("");
                setOpen(false);
              }}
              className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-gray-100"
            >
              {state.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AddressFields = ({ value, onChange, idPrefix, showHeader = true }) => {
  const selectedCountry = countries.find(
    (country) => country.name === value.country,
  );
  const states = selectedCountry
    ? State.getStatesOfCountry(selectedCountry.isoCode)
    : [];

  const update = (field, nextValue) =>
    onChange({ ...value, [field]: nextValue });

  const selectCountry = (country) =>
    onChange({
      ...value,
      country: country.name,
      countryCode: country.isoCode,
      state: "",
    });

  return (
    <div>
      {showHeader && (
        <>
          <h2 className="text-2xl font-semibold">Delivery Address</h2>
          <p className="mt-2 text-sm text-gray-500">
            Please enter your delivery details.
          </p>
          <p className="mt-6 text-xs text-gray-500">*Required fields</p>
        </>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="text-sm">
          First name <span className="text-gray-500">*</span>
          <input
            required
            value={value.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="text-sm">
          Last name <span className="text-gray-500">*</span>
          <input
            required
            value={value.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          Country/region <span className="text-gray-500">*</span>
          <CountrySelect value={value.country} onChange={selectCountry} />
        </label>
        <label className="sm:col-span-2 text-sm">
          Address <span className="text-gray-500">*</span>
          <input
            required
            value={value.address}
            placeholder="Start typing to search your address"
            onChange={(event) => update("address", event.target.value)}
            className={inputClassName}
          />
          {!value.addressLine2 && (
            <button
              type="button"
              onClick={() => update("addressLine2", "")}
              className="mt-2 text-xs text-gray-600 underline underline-offset-4"
            >
              Add another line
            </button>
          )}
          {value.addressLine2 !== undefined && (
            <input
              value={value.addressLine2}
              placeholder="Apartment, suite, etc. (optional)"
              onChange={(event) => update("addressLine2", event.target.value)}
              className={inputClassName}
            />
          )}
        </label>
        <label className="sm:col-span-2 text-sm">
          City <span className="text-gray-500">*</span>
          <input
            required
            value={value.city}
            onChange={(event) => update("city", event.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="text-sm">
          State <span className="text-gray-500">*</span>
          <StateSelect
            value={value.state}
            states={states}
            onChange={(state) => update("state", state)}
            disabled={!selectedCountry}
          />
        </label>
        <label className="text-sm">
          Postal/zip code <span className="text-gray-500">*</span>
          <input
            required
            value={value.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            className={inputClassName}
          />
        </label>
        <label className="sm:col-span-2 text-sm">
          Phone <span className="text-gray-500">*</span>
          <PhoneInput
            id={`${idPrefix}-phone`}
            international
            defaultCountry={value.countryCode || "NG"}
            value={normalizePhoneValue(value.phone, value.countryCode)}
            onChange={(phone) => update("phone", phone || "")}
            className="mt-2 flex min-h-12 border border-gray-300 bg-white px-3.5 text-sm focus-within:border-black"
            numberInputProps={{
              className: "min-w-0 flex-1 border-0 px-3 outline-none",
            }}
          />
          <span className="mt-2 block text-xs text-gray-500">
            Required to ensure a successful delivery
          </span>
        </label>
        <label className="sm:col-span-2 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value.useAsBilling)}
            onChange={(event) => update("useAsBilling", event.target.checked)}
            className="h-4 w-4 accent-black"
          />
          Use as billing address
        </label>
      </div>
    </div>
  );
};

export default AddressFields;
