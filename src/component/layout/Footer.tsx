import React from "react";
import { Link } from "react-router-dom";

const Footer = () => (
  <section className="relative w-full bg-[#161616] px-4 pt-12 text-white md:px-12">
    <div className="w-full flex flex-col md:flex-row justify-between items-start md:my-0 mt-16">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-[1px]">
          A note from GRV
        </h3>
        <p className="mb-5 max-w-xs text-sm leading-relaxed text-neutral-400">
          New collections, quiet discoveries, and the occasional reason to look
          twice.
        </p>
      </div>
      <div className="max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm md:m-0 my-12">
        <div>
          <h3 className="text-neutral-500 mb-4 uppercase text-xs tracking-wide">
            (Customer Care)
          </h3>
          <ul className="space-y-2">
            <li>
              <Link to="/account" className="hover:text-neutral-500 transition">
                Account
              </Link>
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
              <Link to="/shop" className="hover:text-neutral-500 transition">
                Shop
              </Link>
            </li>
            <li>
              <Link to="/brand" className="hover:text-neutral-500 transition">
                Brand
              </Link>
            </li>
            <li>
              <Link to="/journal" className="hover:text-neutral-500 transition">
                Journal
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-neutral-500 transition">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-neutral-500 mb-4 uppercase text-xs tracking-wide">
            (Other)
          </h3>
          <ul className="space-y-2">
            <li>
              <Link to="/about" className="hover:text-neutral-500 transition">
                About Us
              </Link>
            </li>
            <li>
              <Link
                to="/privacy-policy"
                className="hover:text-neutral-500 transition"
              >
                Privacy Policy
              </Link>
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

export default Footer;
