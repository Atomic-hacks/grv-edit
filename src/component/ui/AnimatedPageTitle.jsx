import React from "react";
import { motion as Motion } from "framer-motion";

// Shared page heading. The reveal is a short rise rather than the two-second
// sweep it used to be: at that length the title was still settling while the
// grid below had already painted, which read as jank rather than polish.
const EASE = [0.22, 1, 0.36, 1];

const AnimatedPageTitle = ({ img, title, subtitle, className = "" }) => {
  return (
    <div className="z-10">
      {img && <img src={img} alt={title} className="mx-auto w-40" />}
      <div className="overflow-hidden">
        <Motion.h1
          className={`display-title ${className}`}
          initial={{ y: "55%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {title}
        </Motion.h1>
      </div>
      {subtitle ? (
        <div className="overflow-hidden">
          <Motion.p
            className="body-text mt-4"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
          >
            {subtitle}
          </Motion.p>
        </div>
      ) : null}
    </div>
  );
};

export default AnimatedPageTitle;
