import React from "react";
import { Link } from "react-router-dom";
import NewsletterBanner from "../ui/NewsletterBanner";
import {
  helpLinks,
  servicePromises,
  storeInfo,
} from "../../data/storeInfo";

const MailIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="4.5" width="15" height="11" />
    <path d="M2.5 5.5l7.5 5 7.5-5" />
  </svg>
);

const PhoneIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 3.5h3l1.5 3.5-2 1.5a9 9 0 0 0 4.5 4.5l1.5-2 3.5 1.5v3a1.5 1.5 0 0 1-1.7 1.5A13.5 13.5 0 0 1 2.5 5.2 1.5 1.5 0 0 1 4 3.5Z" />
  </svg>
);

// The block that closes a shopping page. It answers the three questions a
// shopper has when they reach the bottom of a grid: can I trust this shop,
// where do I go for help, and how do I reach a person. Each part can be
// turned off so a page shows only what is relevant to it.
const StoreSupport = ({
  promises = true,
  help = true,
  contact = true,
  newsletter = true,
  className = "",
}) => (
  <div className={className}>
    {promises && (
      <section className="border-y border-[var(--line)] bg-[var(--surface-muted)]">
        <div className="page-shell grid gap-8 py-10 sm:grid-cols-3">
          {servicePromises.map((promise) => {
            const body = (
              <>
                <p className="text-[13px] font-semibold text-[var(--ink-900)]">
                  {promise.title}
                </p>
                <p className="meta-text mt-1.5">{promise.copy}</p>
              </>
            );
            return promise.to ? (
              <Link
                key={promise.id}
                to={promise.to}
                className="group block transition-opacity hover:opacity-70"
              >
                {body}
              </Link>
            ) : (
              <div key={promise.id}>{body}</div>
            );
          })}
        </div>
      </section>
    )}

    {help && (
      <section className="page-shell py-12 md:py-16">
        <p className="eyebrow">Help</p>
        <h2 className="section-title mt-1.5">Anything you need</h2>
        <div className="mt-6 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {helpLinks.map((link) => (
            <Link
              key={link.id}
              to={link.to}
              className="group flex flex-col gap-1.5 bg-white p-6 transition-colors hover:bg-[var(--surface-muted)]"
            >
              <span className="flex items-center justify-between gap-3 text-[13px] font-semibold">
                {link.title}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="shrink-0 text-[var(--ink-300)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--ink-900)]"
                >
                  <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" />
                </svg>
              </span>
              <span className="meta-text">{link.copy}</span>
            </Link>
          ))}
        </div>
      </section>
    )}

    {newsletter && <NewsletterBanner />}

    {contact && (
      <section className="page-shell py-16">
        <h2 className="section-title">Contact us</h2>
        <div className="mt-5 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
          {/* No public support address is configured, so this sends people to
              the contact form, which is already wired to the admin inbox. */}
          <Link
            to="/contact"
            className="flex items-start gap-4 bg-white p-6 transition-colors hover:bg-[var(--surface-muted)]"
          >
            <span className="mt-0.5 text-[var(--ink-500)]">
              <MailIcon />
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]">
                Message us
              </span>
              <span className="meta-text mt-1 block">
                {storeInfo.email
                  ? storeInfo.email
                  : "Send us a note and we'll come back to you."}
              </span>
            </span>
          </Link>
          <a
            href={storeInfo.phoneHref}
            className="flex items-start gap-4 bg-white p-6 transition-colors hover:bg-[var(--surface-muted)]"
          >
            <span className="mt-0.5 text-[var(--ink-500)]">
              <PhoneIcon />
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]">
                Order by phone
              </span>
              <span className="meta-text mt-1 block">{storeInfo.phone}</span>
            </span>
          </a>
        </div>
      </section>
    )}
  </div>
);

export default StoreSupport;
