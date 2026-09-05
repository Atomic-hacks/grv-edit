import React, { useState } from "react";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <section className="relative w-full bg-[#161616] px-4 pt-12 text-white md:px-12">
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:my-0 mt-16">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-[1px]">
            {submitted ? "You're on the list" : "A note from GRV"}
          </h3>
          <p className="mb-5 max-w-xs text-sm leading-relaxed text-neutral-400">
            {submitted
              ? "Thanks. We will be in touch when something worth seeing arrives."
              : "New collections, quiet discoveries, and the occasional reason to look twice."}
          </p>
          <form
            onSubmit={handleSubmit}
            className="flex items-center border-b border-neutral-600 pb-2"
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email"
              aria-label="Email address"
              required
              className="flex-1 bg-transparent text-neutral-300 placeholder-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              className="ml-3 text-sm font-semibold text-white transition-colors hover:text-(--color-accent-orange)"
            >
              JOIN
            </button>
          </form>
        </div>
        <div className="max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm md:m-0 my-12">
          <div>
            <h3 className="text-neutral-500 mb-4 uppercase text-xs tracking-wide">
              (Customer Care)
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Account
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Our Store
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-neutral-500 mb-4 uppercase text-xs tracking-wide">
              (Navigate)
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Shop
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Brand
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Journal
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-neutral-500 mb-4 uppercase text-xs tracking-wide">
              (Other)
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-neutral-500 transition">
                  404
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <span className="flex mt-5 md:mt-28">
        <h1 className="text-7xl md:text-9xl">GRV.</h1>
        <p className="uppercase text-[9px] md:text-sm">Made by GRVic @</p>
      </span>
    </section>
  );
};

export default Footer;
