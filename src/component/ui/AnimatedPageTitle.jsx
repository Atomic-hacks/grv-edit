import React from "react";
import { motion as Motion } from "framer-motion";

const AnimatedPageTitle = ({ title, subtitle, className = "" }) => {
  return (
    <div className="z-10 overflow-hidden">
      <Motion.h2
        className={`text-6xl md:text-7xl font-semibold ${className}`}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 2, ease: [0.9, 0, 0.3, 1] }}
      >
        {title}
      </Motion.h2>
      {subtitle ? (
        <div className="overflow-hidden mt-4">
          <Motion.p
            className="text-sm text-neutral-600 font-semibold"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 2, ease: [0.9, 0, 0.3, 1] }}
          >
            {subtitle}
          </Motion.p>
        </div>
      ) : null}
    </div>
  );
};

export default AnimatedPageTitle;
