import React from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";

// The shared shell behind both the Filter drawer (narrows what you see,
// opens from the right) and the Browse/"View All" drawer (moves you
// somewhere else, opens from the left). Same panel, same motion, same
// header pattern — only which edge it slides from and what's inside differ,
// which is deliberate: the two feel like siblings, not two unrelated UIs.
const SidePanel = ({ isOpen, onClose, side = "right", title, children, footer }) => {
  const isRight = side === "right";

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <Motion.aside
            aria-label={title}
            className={`absolute top-0 flex h-full w-full max-w-md flex-col bg-white text-[var(--ink-900)] shadow-2xl ${
              isRight ? "right-0" : "left-0"
            }`}
            initial={{ x: isRight ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRight ? "100%" : "-100%" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink-500)] transition-colors hover:border-[var(--ink-900)] hover:text-[var(--ink-900)]"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4L4 12M4 4l8 8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6">{children}</div>

            {footer && (
              <div className="border-t border-[var(--line)] px-6 py-5">{footer}</div>
            )}
          </Motion.aside>
        </Motion.div>
      )}
    </AnimatePresence>
  );
};

export default SidePanel;
