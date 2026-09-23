import React from "react";
import { Link } from "react-router-dom";

const VARIANT_CLASSES = {
  dark: "border-[var(--ink-900)] text-[var(--ink-900)] hover:bg-[var(--ink-900)] hover:text-white",
  light: "border-white text-white hover:bg-white hover:text-[var(--ink-900)]",
};

const CtaButton = ({
  to,
  title,
  variant = "dark",
  bare = false,
  className = "",
  onClick,
  type = "button",
}) => {
  const classes = bare
    ? `inline-flex items-center bg-transparent p-0 font-semibold leading-none transition-[opacity,transform] duration-300 ease-in-out hover:-translate-y-0.5 hover:opacity-70 active:translate-y-0 ${className}`
    : `inline-flex shrink-0 items-center justify-center whitespace-nowrap border bg-transparent px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition-[background-color,border-color,color] duration-200 ease-out ${VARIANT_CLASSES[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes.trim()}>
        {title}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes.trim()}>
      {title}
    </button>
  );
};

export default CtaButton;
