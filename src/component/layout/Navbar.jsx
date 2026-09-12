import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { searchProducts } from "../../lib/apiClient";
import { getProductImages } from "../../lib/productHelpers";
import LoadingImage from "../ui/LoadingImage";
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

const BagIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h12l-1 10H5L4 7Z" />
    <path d="M7 7a3 3 0 0 1 6 0" />
  </svg>
);

const ProfileIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="10" cy="6.5" r="3" />
    <path d="M4.5 17a5.5 5.5 0 0 1 11 0" />
  </svg>
);

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

const SearchPanel = ({
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults,
  navigate,
  onClose,
  mobile = false,
}) => (
  <div
    className={
      mobile
        ? "border-t border-gray-200 bg-white p-4"
        : "absolute right-0 top-full z-50 mt-3 w-80 border border-gray-200 bg-white p-3 shadow-lg"
    }
  >
    <div className="flex items-center gap-3">
      <input
        autoFocus
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search products, brands, SKU"
        className="w-full border-b border-gray-300 px-1 py-2 text-sm outline-none focus:border-black"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:text-black"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" />
        </svg>
      </button>
    </div>
    {searchQuery && (
      <div className="mt-2 max-h-80 overflow-y-auto">
        {searchLoading ? (
          <div className="space-y-2 py-3" aria-hidden="true">
            <div className="flex items-center gap-3">
              <div className="h-14 w-11 animate-pulse bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse bg-gray-200" />
                <div className="h-3 w-1/3 animate-pulse bg-gray-200" />
              </div>
            </div>
          </div>
        ) : searchResults.length ? (
          searchResults.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                navigate(`/product/${product.id}`);
                onClose();
              }}
              className="flex w-full gap-3 border-b border-gray-100 py-2 text-left last:border-0"
            >
              <LoadingImage
                src={getProductImages(product)[0]}
                alt=""
                width={300}
                className="h-full w-full object-cover"
                wrapperClassName="h-14 w-11 shrink-0"
              />
              <span className="min-w-0 text-xs">
                <strong className="block truncate">{product.name}</strong>
                <span className="text-gray-500">{product.brandName}</span>
              </span>
            </button>
          ))
        ) : (
          <p className="py-3 text-xs text-gray-500">No matching products.</p>
        )}
      </div>
    )}
  </div>
);

const Navbar = () => {
  const [openMegaMenu, setOpenMegaMenu] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openMobileDept, setOpenMobileDept] = useState(null);
  const [openMobileSection, setOpenMobileSection] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { itemCount, openCart } = useCart();
  const { session, appUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const hasAccountOnThisBrowser =
    typeof window !== "undefined" &&
    window.localStorage.getItem("grv_has_account") === "true";
  const accountPath = session
    ? "/account"
    : hasAccountOnThisBrowser
      ? "/login"
      : "/signup";
  const accountName =
    appUser?.name ||
    session?.user_metadata?.name ||
    session?.user?.email ||
    "Account";
  const accountLinks = [
    ["Orders and returns", "/account?section=orders"],
    ["Address book", "/account?section=addresses"],
    ["Details and security", "/account?section=details"],
  ];

  const navLinks = [
    ...navigationDepartments.map((department) => ({
      name: department.label || department.name,
      departmentName: department.name,
      href: getNavigationRootPath(department.name),
      sections: getNavigationSectionsForDepartment(department.name),
      megaMenu: true,
    })),
    { name: "Shop By", href: "/shop-by" },
    { name: "Brands", href: "/brands" },
  ];

  useEffect(() => {
    setIsMobileOpen(false);
    setIsSearchOpen(false);
    setIsAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAccountOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsAccountOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isAccountOpen]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timeoutId = setTimeout(() => {
      searchProducts(query)
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

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
      <div className="mx-auto flex items-center justify-between px-4 lg:px-6 xl:px-16 py-2">
        {/* Left Navigation Links - Desktop */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-8">
          {navLinks.map((link) => (
            <div
              key={link.name}
              className="relative"
              onMouseEnter={() => link.megaMenu && setOpenMegaMenu(link.name)}
              onMouseLeave={() => link.megaMenu && setOpenMegaMenu(null)}
            >
              <Link
                to={link.href}
                className="group relative z-50 whitespace-nowrap text-sm xl:text-base font-medium text-black transition-colors hover:text-gray-600"
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
                              to={getNavigationPath(
                                link.departmentName || link.name,
                                section.name,
                              )}
                              className="text-sm font-semibold uppercase tracking-wide text-black"
                            >
                              {section.name}
                            </Link>
                            <div className="mt-3 space-y-2">
                              {section.styles.map((style) => (
                                <Link
                                  key={style}
                                  to={getNavigationPath(
                                    link.departmentName || link.name,
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

        {/* Center logo - Desktop */}
        <Link
          to="/"
          className="hidden lg:block absolute left-1/2 -translate-x-1/2"
        >
          <span>
            <img className="h-10 w-auto xl:h-12" src="/img/log.png" alt="GRV" />
          </span>
        </Link>

        {/* Mobile logo */}
        <Link to="/" className="lg:hidden">
          <span className="text-2xl font-bold tracking-tight">
            <img src="/img/log.png" alt="GRV" className="h-12 w-26" />
          </span>
        </Link>

        {/* Right Side Icons - Desktop */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-6">
          <div className="relative">
            <button
              type="button"
              aria-label="Search products"
              aria-expanded={isSearchOpen}
              onClick={() => setIsSearchOpen((open) => !open)}
              className="group relative p-1 transition-transform hover:scale-110"
            >
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
            {isSearchOpen && (
              <SearchPanel
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchLoading={searchLoading}
                searchResults={searchResults}
                navigate={navigate}
                onClose={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }}
              />
            )}
          </div>
          <Link
            to="/contact"
            className="group relative whitespace-nowrap text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            contact
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>
          <Link
            to="/journal"
            className="group relative hidden whitespace-nowrap text-sm font-medium text-black transition-colors hover:text-gray-600 xl:inline"
          >
            Journal
            <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>
          {session ? (
            <div className="relative">
              <button
                type="button"
                aria-label="Open account menu"
                aria-expanded={isAccountOpen}
                onClick={() => setIsAccountOpen((open) => !open)}
                className="p-1 text-black transition-colors hover:text-gray-600"
              >
                <ProfileIcon />
              </button>
              {isAccountOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-80 border border-gray-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-5">
                    <h2 className="max-w-[14rem] text-2xl font-semibold leading-tight">
                      {accountName}
                    </h2>
                    <button
                      type="button"
                      aria-label="Close account menu"
                      onClick={() => setIsAccountOpen(false)}
                      className="text-2xl leading-none text-gray-500 hover:text-black"
                    >
                      ×
                    </button>
                  </div>
                  <nav className="divide-y divide-gray-200">
                    {accountLinks.map(([label, href]) => (
                      <Link
                        key={href}
                        to={href}
                        onClick={() => setIsAccountOpen(false)}
                        className="block py-4 text-sm font-medium hover:underline"
                      >
                        {label}
                      </Link>
                    ))}
                  </nav>
                  <Link
                    to="/account?section=orders"
                    onClick={() => setIsAccountOpen(false)}
                    className="mt-5 block border border-black px-4 py-3 text-center text-sm font-semibold transition-colors hover:bg-black hover:text-white"
                  >
                    My Account
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <Link
              to={accountPath}
              aria-label={accountPath === "/login" ? "Log in" : "Sign up"}
              className="group relative whitespace-nowrap text-sm font-medium text-black transition-colors hover:text-gray-600"
            >
              {accountPath === "/login" ? "Login" : "Sign Up"}
              <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
            </Link>
          )}
          <Link
            to="/wishlist"
            className="group relative hidden whitespace-nowrap text-sm font-medium text-black transition-colors hover:text-gray-600 xl:inline"
          >
            Wishlist
            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-black transition-all duration-300 ease-out group-hover:w-full" />
          </Link>
          <button className="shrink-0 transition-transform hover:scale-110">
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
            aria-label={`Open cart (${itemCount} items)`}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-black transition-colors hover:text-gray-600"
          >
            <BagIcon />
            <span className="text-xs">{itemCount}</span>
          </button>
        </div>

        {/* Mobile/Tablet Controls */}
        <div className="flex items-center gap-4 lg:hidden">
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(false);
              setIsSearchOpen((open) => !open);
            }}
            aria-label="Search products"
            aria-expanded={isSearchOpen}
            className="flex h-10 w-10 items-center justify-center text-black"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M12.5 12.5l4 4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart (${itemCount} items)`}
            className="flex items-center gap-1 text-xs font-semibold tracking-wide text-black"
          >
            <BagIcon />
            <span>{itemCount}</span>
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

      {isSearchOpen && (
        <div className="lg:hidden">
          <SearchPanel
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchLoading={searchLoading}
            searchResults={searchResults}
            navigate={navigate}
            mobile
            onClose={() => {
              setIsSearchOpen(false);
              setSearchQuery("");
            }}
          />
        </div>
      )}

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
                                          link.departmentName || link.name,
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
                                                  link.departmentName ||
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
                    to={accountPath}
                    aria-label={
                      session
                        ? "Account"
                        : accountPath === "/login"
                          ? "Log in"
                          : "Sign up"
                    }
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center text-sm font-semibold text-black"
                  >
                    {session ? (
                      <ProfileIcon />
                    ) : accountPath === "/login" ? (
                      "Login"
                    ) : (
                      "Sign Up"
                    )}
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setIsMobileOpen(false)}
                    className="ml-6 text-sm font-semibold text-black"
                  >
                    Wishlist
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
