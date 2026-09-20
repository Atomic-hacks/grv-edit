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
          className={`w-full pr-16 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-3 text-xs font-medium underline underline-offset-4"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
};

export default PasswordInput;
