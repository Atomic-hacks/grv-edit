import React from "react";
import { Link } from "react-router-dom";

const VARIANT_CLASSES = {
  dark: "border-black text-black hover:bg-black hover:text-white",
  light: "border-white text-white hover:bg-white hover:text-black",
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
    : `inline-flex items-center justify-center border bg-transparent px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.12)] active:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`;

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
