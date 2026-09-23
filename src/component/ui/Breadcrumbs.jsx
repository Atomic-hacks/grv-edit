import React from "react";
import { Link } from "react-router-dom";

// Shared trail for listing and detail pages. Items are { label, to }; the last
// one is rendered as plain text because it is the page you are already on.
const Breadcrumbs = ({ items = [], className = "" }) => {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-y-1 text-[11px] text-[var(--ink-500)] ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center">
            {index > 0 && (
              <span aria-hidden="true" className="mx-2 text-[var(--ink-300)]">
                /
              </span>
            )}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="capitalize transition-colors hover:text-[var(--ink-900)]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? "text-[var(--ink-900)]" : "capitalize"}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;
