import React from "react";
import { Link } from "react-router-dom";
import { socialLinks, storeInfo } from "../../data/storeInfo";

// Four columns, grouped by what a shopper is trying to do rather than by
// where the pages happen to live. Every entry points at a route that exists —
// the previous footer linked to "404", "Our Store" and "FAQ", none of which
// went anywhere.
const footerColumns = [
  {
    heading: "Shop",
    links: [
      ["New arrivals", "/shop/new-arrivals"],
      ["Women", "/women"],
      ["Men", "/men"],
      ["Accessories", "/accessories"],
      ["Footwear", "/footwear"],
      ["Brands", "/brands"],
    ],
  },
  {
    heading: "Discover",
    links: [
      ["Shop by mood", "/shop-by"],
      ["Catalogues", "/catalogues"],
      ["Journal", "/journal"],
      ["About GRV", "/about"],
    ],
  },
  {
    heading: "Your account",
    links: [
      ["Account", "/account"],
      ["Orders", "/account?section=orders"],
      ["Wishlist", "/wishlist"],
      ["Shopping bag", "/cart"],
    ],
  },
  {
    heading: "Help",
    links: [
      ["FAQs", "/faq"],
      ["Contact us", "/contact"],
      ["Size guide", "/size-guide"],
      ["Privacy policy", "/privacy-policy"],
    ],
  },
];


// One minimal outline icon per network, drawn inline so no icon library is
// needed for three glyphs. Add a case here when a network is added above.
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  instagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3v11.2a3.3 3.3 0 1 1-3.3-3.3" />
      <path d="M14 3a5.2 5.2 0 0 0 5 5" />
    </svg>
  ),
  pinterest: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 17.5 12 8.2a2.6 2.6 0 0 1 5 1c0 2.1-1 4.3-3 4.3-.9 0-1.5-.5-1.7-1.1" />
    </svg>
  ),
};

const Footer = () => (
  <footer className="relative w-full bg-[#161616] px-[var(--gutter)] pt-16 text-white">
    <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
      <div className="max-w-xs">
        <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em]">
          A note from GRV
        </h3>
        <p className="text-[13px] leading-relaxed text-neutral-400">
          New collections, quiet discoveries, and the occasional reason to look
          twice.
        </p>
        <address className="mt-6 not-italic text-[13px] leading-relaxed text-neutral-400">
          {storeInfo.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <a
            href={storeInfo.phoneHref}
            className="mt-2 inline-block text-neutral-300 underline underline-offset-4 transition-colors hover:text-white"
          >
            {storeInfo.phone}
          </a>
        </address>

        <div className="mt-6 flex items-center gap-3">
          {socialLinks.map((social) => (
            <a
              key={social.id}
              href={social.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`GRV on ${social.label}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-neutral-300 transition-colors hover:border-white hover:text-white"
            >
              {SOCIAL_ICONS[social.id]}
            </a>
          ))}
        </div>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-x-8 gap-y-10 text-[13px] sm:grid-cols-4">
        {footerColumns.map((column) => (
          <div key={column.heading}>
            <h3 className="mb-4 text-[11px] uppercase tracking-[0.14em] text-neutral-500">
              {column.heading}
            </h3>
            <ul className="space-y-2.5">
              {column.links.map(([label, to]) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-neutral-300 transition-colors duration-200 hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>

    <div className="mx-auto mt-20 flex w-full max-w-[var(--content-max)] items-start justify-between gap-4">
      <h2 className="text-6xl leading-none tracking-[-0.03em] md:text-8xl">
        GRV.
      </h2>
      <p className="text-[9px] uppercase tracking-[0.14em] text-neutral-500 md:text-[11px]">
        Made by GRVic @
      </p>
    </div>

    <div className="mx-auto mt-8 flex w-full max-w-[var(--content-max)] flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 py-6 text-[11px] text-neutral-500">
      <Link
        to="/privacy-policy"
        className="underline underline-offset-4 transition-colors hover:text-white"
      >
        Privacy policy
      </Link>
      <span>
        © {new Date().getFullYear()} GRV. All rights reserved.
      </span>
    </div>
  </footer>
);

export default Footer;
