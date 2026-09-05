import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import {
  getNavigationPath,
  getNavigationRootPath,
  getNavigationSectionsForDepartment,
  navigationDepartments,
} from "../../data/navigation";

const focusableSelector =
  "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])";

const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(focusableSelector));
};

const Chevron = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 transition-transform duration-300 ${
      open ? "rotate-180" : ""
    }`}
  >
    <path d="M2.5 4.5L6 8l3.5-3.5" />
  </svg>
);

const Navbar = () => {
  const [openMegaMenu, setOpenMegaMenu] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMobileDept, setOpenMobileDept] = useState(null);
  const [openMobileSection, setOpenMobileSection] = useState(null);
  const { itemCount, openCart } = useCart();
  const location = useLocation();
  const panelRef = useRef(null);

  const navLinks = [
    ...navigationDepartments.map((department) => ({
      name: department.name,
      href: getNavigationRootPath(department.name),
      sections: getNavigationSectionsForDepartment(department.name),
      megaMenu: true,
    })),
    { name: "Brands", href: "/brands" },
    { name: "Who We Are", href: "/brand" },
  ];

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) {
      setOpenMobileDept(null);
      setOpenMobileSection(null);
      return;
    }

    const previousFocus = document.activeElement;
    const focusables = getFocusableElements(panelRef.current);
    focusables[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const elements = getFocusableElements(panelRef.current);
        if (elements.length === 0) return;

        const first = elements[0];
        const last = elements[elements.length - 1];
        const isShift = event.shiftKey;

        if (isShift && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!isShift && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
    };
  }, [isMobileOpen]);

  const toggleMobileDept = (name) => {
    setOpenMobileDept((current) => (current === name ? null : name));
    setOpenMobileSection(null);
  };

  const toggleMobileSection = (name) => {
    setOpenMobileSection((current) => (current === name ? null : name));
  };

  return (
    <nav className="relative w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex items-center justify-between px-4 md:px-16 py-2">
        {/* Left Navigation Links - Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <div
              key={link.name}
              className="relative"
              onMouseEnter={() => link.megaMenu && setOpenMegaMenu(link.name)}
              onMouseLeave={() => link.megaMenu && setOpenMegaMenu(null)}
            >
              <Link
                to={link.href}
                className="group relative z-9999 font-medium text-black transition-colors hover:text-gray-600"
              >
                {link.name}
                <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
              </Link>

              {link.megaMenu && (
                <AnimatePresence>
                  {openMegaMenu === link.name && (
                    <Motion.div
                      initial={{ opacity: 0, x: -300 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="absolute left-0 top-full z-20 w-2xl pt-2 overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-8 rounded-sm border border-gray-200 bg-white p-6 shadow-lg">
                        {link.sections.map((section) => (
                          <div key={section.name}>
                            <Link
                              to={getNavigationPath(link.name, section.name)}
                              className="text-sm font-semibold uppercase tracking-wide text-black"
                            >
                              {section.name}
                            </Link>
                            <div className="mt-3 space-y-2">
                              {section.styles.map((style) => (
                                <Link
                                  key={style}
                                  to={getNavigationPath(
                                    link.name,
                                    section.name,
                                    style,
                                  )}
                                  className="block text-sm text-gray-600 transition-colors hover:text-black"
                                >
                                  {style}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </div>

        {/* Center log - Desktop */}
        <Link
          to="/"
          className="hidden md:block absolute left-1/2 -translate-x-1/2"
        >
          <span>
            <img className="h-12 w-26" src="/img/log.png" alt="GRV" />
          </span>
        </Link>

        {/* Mobile log */}
        <Link to="/" className="md:hidden">
          <span className="text-2xl font-bold tracking-tight">
            <img src="/img/log.png" alt="GRV" className="h-12 w-26" />
          </span>
        </Link>

        {/* Right Side Icons - Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <button className="group relative p-1 transition-transform hover:scale-110">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="transition-colors"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.5 12.5l4 4" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            to="/contact"
            className="group relative text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            contact
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>{" "}
          <Link
            to="/journal"
            className="group relative text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            Journal
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>
          <Link
            to="/account"
            className="group relative text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            Account
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>
          <button className="transition-transform hover:scale-110">
            <img
              src="/img/flag.png"
              alt="US"
              width="24"
              height="16"
              className="object-contain"
            />
          </button>
          <button
            type="button"
            onClick={openCart}
            className="group relative text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            CART ({itemCount})
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </button>
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-4 md:hidden">
          <button
            type="button"
            onClick={openCart}
            className="text-xs font-semibold tracking-wide text-black"
          >
            CART ({itemCount})
          </button>
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-nav"
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-black"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 5h12M3 9h12M3 13h12" />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileOpen && (
          <>
            <Motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setIsMobileOpen(false)}
            />

            <Motion.aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              ref={panelRef}
              className="fixed right-0 top-0 z-50 h-full w-[82%] max-w-90 overflow-y-auto bg-white shadow-xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-5">
                <span className="text-xl font-bold tracking-tight">
                  <img src="/img/log.png" alt="GRV" className="h-12 w-26" />
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Close menu"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
                  </svg>
                </button>
              </div>

              <nav className="px-6 py-4">
                {navLinks.map((link) => {
                  if (!link.megaMenu) {
                    return (
                      <Link
                        key={link.name}
                        to={link.href}
                        onClick={() => setIsMobileOpen(false)}
                        className="block border-b border-gray-100 py-4 text-base font-semibold text-black"
                      >
                        {link.name}
                      </Link>
                    );
                  }

                  const isDeptOpen = openMobileDept === link.name;

                  return (
                    <div key={link.name} className="border-b border-gray-100">
                      <div className="flex items-center justify-between py-4">
                        <Link
                          to={link.href}
                          onClick={() => setIsMobileOpen(false)}
                          className="text-base font-semibold text-black"
                        >
                          {link.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleMobileDept(link.name)}
                          aria-expanded={isDeptOpen}
                          aria-label={`Toggle ${link.name} categories`}
                          className="flex h-8 w-8 items-center justify-center text-black"
                        >
                          <Chevron open={isDeptOpen} />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {isDeptOpen && (
                          <Motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.3,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="pb-3 pl-3">
                              {link.sections.map((section) => {
                                const sectionKey = `${link.name}-${section.name}`;
                                const isSectionOpen =
                                  openMobileSection === sectionKey;

                                return (
                                  <div key={section.name} className="py-1.5">
                                    <div className="flex items-center justify-between">
                                      <Link
                                        to={getNavigationPath(
                                          link.name,
                                          section.name,
                                        )}
                                        onClick={() => setIsMobileOpen(false)}
                                        className="py-1.5 text-sm font-semibold text-black"
                                      >
                                        {section.name}
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleMobileSection(sectionKey)
                                        }
                                        aria-expanded={isSectionOpen}
                                        aria-label={`Toggle ${section.name} styles`}
                                        className="flex h-7 w-7 items-center justify-center text-gray-500"
                                      >
                                        <Chevron open={isSectionOpen} />
                                      </button>
                                    </div>

                                    <AnimatePresence initial={false}>
                                      {isSectionOpen && (
                                        <Motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{
                                            height: "auto",
                                            opacity: 1,
                                          }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{
                                            duration: 0.25,
                                            ease: [0.22, 1, 0.36, 1],
                                          }}
                                          className="overflow-hidden"
                                        >
                                          <div className="flex flex-col gap-2 py-2 pl-3">
                                            {section.styles.map((style) => (
                                              <Link
                                                key={style}
                                                to={getNavigationPath(
                                                  link.name,
                                                  section.name,
                                                  style,
                                                )}
                                                onClick={() =>
                                                  setIsMobileOpen(false)
                                                }
                                                className="text-sm text-gray-600 transition-colors hover:text-black"
                                              >
                                                {style}
                                              </Link>
                                            ))}
                                          </div>
                                        </Motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          </Motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <div className="py-4">
                  <Link
                    to="/account"
                    onClick={() => setIsMobileOpen(false)}
                    className="text-sm font-semibold text-black"
                  >
                    Account
                  </Link>
                </div>
              </nav>
            </Motion.aside>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
