import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";

const PrivacyPolicy = () => (
  <section className="min-h-screen w-full bg-white px-4 py-16 text-black md:px-24 md:py-28">
    <div className="mx-auto max-w-4xl">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
        Draft for legal review
      </p>
      <AnimatedPageTitle
        title="Privacy Policy"
        className="mb-8 text-6xl font-bold md:text-8xl"
      />
      <p className="mb-16 max-w-2xl border-l border-neutral-300 pl-4 text-sm leading-relaxed text-neutral-500">
        This technically accurate draft needs legal review before it is relied
        upon as a binding legal document. It is not legal advice.
      </p>

      <div className="space-y-16">
        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (01) Information we collect
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            What you share with GRV.
          </h2>
          <p className="text-sm leading-7 text-neutral-600">
            We collect your name, email address, phone number, and shipping
            address when you place an order. Shipping addresses can also be
            saved and managed in your account address book. Account credentials
            are handled through Supabase Auth rather than stored directly by
            GRV.
          </p>
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (02) How we use information
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            Why we use it.
          </h2>
          <p className="text-sm leading-7 text-neutral-600">
            We use information to process and deliver orders, manage accounts,
            provide customer support, and send marketing emails when you are on
            the newsletter or have items in your Goody Bag, wishlist, or
            waitlist. GRV also runs automated abandoned-Goody-Bag reminders and
            wishlist or waitlist reminder emails as part of these systems.
          </p>
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (03) Third-party services
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            Services that help GRV operate.
          </h2>
          <ul className="space-y-4 text-sm leading-7 text-neutral-600">
            <li>
              <strong className="font-semibold text-black">Supabase:</strong>{" "}
              authentication and database hosting.
            </li>
            <li>
              <strong className="font-semibold text-black">Paystack:</strong>{" "}
              payment processing. GRV does not store card details; Paystack
              handles payment card information.
            </li>
            <li>
              <strong className="font-semibold text-black">Cloudinary:</strong>{" "}
              image hosting.
            </li>
            <li>
              <strong className="font-semibold text-black">Resend:</strong>{" "}
              transactional and marketing email delivery.
            </li>
          </ul>
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (04) Cookies
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            A small amount of browser storage.
          </h2>
          <p className="text-sm leading-7 text-neutral-600">
            GRV uses session cookies for authentication through Supabase.
          </p>
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (05) Data retention and deletion
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            Keeping your information manageable.
          </h2>
          <p className="text-sm leading-7 text-neutral-600">
            GRV does not yet provide a self-service account deletion flow. In
            the meantime, send a deletion request through our{" "}
            <Link
              to="/contact"
              className="font-semibold text-black underline underline-offset-4"
            >
              Contact page
            </Link>
            . Requests will be reviewed and handled through that channel.
          </p>
        </section>

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            (06) Contact
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            Questions about privacy.
          </h2>
          <p className="text-sm leading-7 text-neutral-600">
            For privacy-related questions, please use our{" "}
            <Link
              to="/contact"
              className="font-semibold text-black underline underline-offset-4"
            >
              Contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  </section>
);

export default PrivacyPolicy;
