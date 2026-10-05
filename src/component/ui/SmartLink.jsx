import React from "react";
import { Link } from "react-router-dom";

// Admin-editable links can be site paths ("/men") or full URLs. react-router's
// <Link to="https://..."> treats the latter as a relative path, so absolute
// URLs get a plain anchor instead.
const isExternal = (to) => /^https?:\/\//i.test(to || "");

const SmartLink = ({ to, children, ...props }) =>
  isExternal(to) ? (
    <a href={to} rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ) : (
    <Link to={to} {...props}>
      {children}
    </Link>
  );

export default SmartLink;
