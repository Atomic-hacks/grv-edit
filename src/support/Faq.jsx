import React, { useState } from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import Breadcrumbs from "../component/ui/Breadcrumbs";
import { faqGroups } from "../data/faq";

const ChevronIcon = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
    className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
  >
    <path d="M2 4.5L6 8.5l4-4" />
  </svg>
);

const FaqQuestion = ({ item, isOpen, onToggle }) => (
  <div className="border-b border-[var(--line)]">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`faq-${item.id}`}
      className="flex w-full items-center justify-between gap-4 py-5 text-left"
    >
      <span className="text-[14px] font-medium text-[var(--ink-900)]">
        {item.q}
      </span>
      <ChevronIcon open={isOpen} />
    </button>
    {isOpen && (
      <p
        id={`faq-${item.id}`}
        className="body-text max-w-2xl pb-5 text-[13px]"
      >
        {item.a}
      </p>
    )}
  </div>
);

const Faq = () => {
  const [openId, setOpenId] = useState(faqGroups[0]?.questions[0]?.id ?? null);
  const [activeGroup, setActiveGroup] = useState(faqGroups[0]?.id);

  const toggle = (id) => setOpenId((current) => (current === id ? null : id));

  return (
    <main className="min-h-screen bg-white">
      <div className="page-shell pb-24">
        <Breadcrumbs
          className="pt-4"
          items={[{ label: "Home", to: "/" }, { label: "FAQs" }]}
        />
        <div className="pb-8 pt-6 md:pb-10 md:pt-8">
          <AnimatedPageTitle
            title="FAQs"
            subtitle="Answers to what people ask us most. Can't find yours? Contact us directly."
          />
        </div>

        <div className="grid gap-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-14">
          <nav
            aria-label="FAQ topics"
            className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-1 md:overflow-visible md:pb-0"
          >
            {faqGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setActiveGroup(group.id);
                  setOpenId(group.questions[0]?.id ?? null);
                  document
                    .getElementById(`faq-group-${group.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-2 text-left text-[13px] font-medium transition-colors md:border-b-0 md:border-l-2 md:px-4 md:py-2.5 ${
                  activeGroup === group.id
                    ? "border-[var(--ink-900)] text-[var(--ink-900)]"
                    : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-900)]"
                }`}
              >
                {group.title}
              </button>
            ))}
          </nav>

          <div>
            {faqGroups.map((group) => (
              <section
                key={group.id}
                id={`faq-group-${group.id}`}
                className="mb-10 scroll-mt-24 last:mb-0"
              >
                <h2 className="section-title mb-2 border-t border-[var(--line)] pt-6">
                  {group.title}
                </h2>
                <div>
                  {group.questions.map((item) => (
                    <FaqQuestion
                      key={item.id}
                      item={item}
                      isOpen={openId === item.id}
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-16 border border-[var(--line)] bg-[var(--surface-muted)] p-8 text-center">
          <p className="section-title">Still have a question?</p>
          <p className="meta-text mx-auto mt-2 max-w-sm">
            Our team can help with anything not covered here.
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-block border border-[var(--ink-900)] bg-[var(--ink-900)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-(--color-accent-orange) hover:border-(--color-accent-orange)"
          >
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
};

export default Faq;
