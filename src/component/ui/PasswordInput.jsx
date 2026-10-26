import React, { useState } from "react";

const PasswordInput = ({
  id,
  label,
  value,
  onChange,
  required = false,
  minLength,
  autoComplete,
  className = "border border-gray-300 px-3 py-2",
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      {label}
      <span className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className={`w-full pr-12 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition-colors hover:text-black focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-black"
        >
          {visible ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.7a2 2 0 002.7 2.7" />
              <path d="M9.9 4.2A10.6 10.6 0 0112 4c5 0 8.5 4.5 9 6.7a5 5 0 010 2.6 9.7 9.7 0 01-2 3.7" />
              <path d="M6.2 6.2C4.4 7.5 3.3 9.4 3 10.7a5 5 0 000 2.6C3.5 15.5 7 20 12 20c1.3 0 2.5-.3 3.6-.8" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 10.7C3.5 8.5 7 4 12 4s8.5 4.5 9 6.7a5 5 0 010 2.6C20.5 15.5 17 20 12 20s-8.5-4.5-9-6.7a5 5 0 010-2.6z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
};

export default PasswordInput;
