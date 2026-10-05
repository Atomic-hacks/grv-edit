import React from "react";
import { Link } from "react-router-dom";

// Every admin screen answers the same four questions in the same place:
// where am I, what is this, how much of it is there, what can I do here.
const AdminPageHeader = ({
  title,
  subtitle,
  count,
  backTo = "/admin",
  backLabel = "Admin",
  actions,
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-5">
    <div className="min-w-0">
      <Link
        to={backTo}
        className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-500)] transition-colors hover:text-[var(--ink-900)]"
      >
        &larr; {backLabel}
      </Link>
      <h1 className="mt-2.5 text-2xl font-semibold md:text-3xl">{title}</h1>
      {(subtitle || count !== undefined) && (
        <p className="meta-text mt-1.5">
          {count !== undefined ? count : ""}
          {count !== undefined && subtitle ? " · " : ""}
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default AdminPageHeader;
