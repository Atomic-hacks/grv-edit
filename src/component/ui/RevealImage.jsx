import React from "react";
import { motion as Motion } from "framer-motion";

const POSITION_PATTERN = /\b(static|relative|absolute|fixed|sticky)\b/;

const RevealImage = ({
  src,
  alt = "",
  className = "",
  revealDuration = 2.1,
  ease = [0.8, 0, 0.3, 1],
}) => {
  const hasPosition = POSITION_PATTERN.test(className);
  const wrapperClasses =
    `${hasPosition ? "" : "relative"} overflow-hidden ${className}`.trim();

  return (
    <div className={wrapperClasses}>
       
      <Motion.div
        className="absolute inset-0"
        initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
        animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
        transition={{ duration: revealDuration, ease }}
      ><div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/60 via-black/5 to-black/75" />
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </Motion.div>
    </div>
  );
};

export default RevealImage;
