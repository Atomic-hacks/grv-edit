import React from "react";
import { motion as Motion } from "framer-motion";

const FadeIn = ({
  children,
  delay = 0,
  y = 14,
  duration = 0.55,
  className = "",
}) => (
  <Motion.div
    initial={{ opacity: 0, y }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </Motion.div>
);

export default FadeIn;
