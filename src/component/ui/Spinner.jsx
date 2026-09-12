import React from "react";

const Spinner = ({ label = "", className = "" }) => (
  <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
    {label && <span>{label}</span>}
    <span className="sr-only">Loading</span>
  </span>
);

export default Spinner;
