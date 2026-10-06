import React from "react";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";

// Policy text supplied by GRV HQ Limited's lawyer — keep wording verbatim.
// Each block is a paragraph (string) or a bullet list ({ list: [...] }).
const INTRO = [
  "GRV HQ Limited (“we”, “us”, “our”) is committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, store, disclose, and protect your personal information when you access or use our website and mobile application (“Platform”).",
  "By using the Platform, you agree to the practices described in this Privacy Policy.",
];

const SECTIONS = [
  {
    title: "Scope of This Policy",
    body: [
      "This Policy applies to:",
      {
        list: [
          "Visitors to the GRV HQ website",
          "Users of the GRV HQ mobile application",
          "Customers who purchase products from GRV HQ services globally.",
        ],
      },
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "a. Personal Information",
      "We may collect personal information such as name, email address, phone number, billing and shipping address, account login details, and purchase history.",
      "b. Payment Information",
      "Payments are processed by secure third-party payment processors. We do not store your debit or credit card details.",
    ],
  },
  {
    title: "Payment Information",
    body: [
      "We may collect Your credit and/or debit card information, which includes Your card number, password, etc, your billing address, your contact address and other information required for Your transactions. Payments are processed by secure third-party providers. GRV HQ does not store card details.",
    ],
  },
  {
    title: "Automatically Collected Information",
    body: [
      "This includes IP address, device type, browser, cookies, and usage data.",
    ],
  },
  {
    title: "How We Use Your Information",
    body: [
      "We use your data to process orders, manage accounts, provide support, improve services, send marketing communications (with consent), and comply with legal obligations.",
    ],
  },
  {
    title: "Legal Basis for Processing",
    body: [
      "Where applicable, processing is based on contractual necessity, legal obligation, legitimate interest, or consent.",
    ],
  },
  {
    title: "Marketing Communications",
    body: ["You may opt out of marketing communications at any time."],
  },
  {
    title: "Cookies",
    body: [
      "We use cookies for functionality, analytics, and personalization. You may disable cookies in your browser settings.",
    ],
  },
  {
    title: "Sharing of Information",
    body: [
      "We may share data with payment processors, logistics partners, IT providers, and analytics services. We do not sell personal data.",
    ],
  },
  {
    title: "International Data Transfers",
    body: [
      "Your data may be transferred and stored outside your country of residence. Where required, we use appropriate safeguards.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "Data is retained only as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations. After this period, data is securely deleted or anonymized.",
    ],
  },
  {
    title: "Your Rights",
    body: [
      "You may request access, correction, deletion, restriction, portability, or withdrawal of consent.",
    ],
  },
  {
    title: "Data Security",
    body: [
      "We implement appropriate technical and organizational measures to protect your data against unauthorized access, loss or misuse, alteration or disclosure. However, no system is completely secure and we cannot guarantee absolute security.",
    ],
  },
  {
    title: "Children’s Privacy",
    body: [
      "GRV HQ does not knowingly collect personal data from individual under the age of 18.",
    ],
  },
  {
    title: "Third-Party Links",
    body: [
      "Our platform may contain links to third-party websites. We are not responsible for third-party privacy practices.",
    ],
  },
  {
    title: "Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. Changes will be posted on the platform with an updated effective date.",
    ],
  },
];

const CONTACT_EMAIL = "support@grvhq.com";

const PrivacyPolicy = () => (
  <section className="min-h-screen w-full bg-white px-4 py-16 text-black md:px-24 md:py-28">
    <div className="mx-auto max-w-4xl">
      <p className="mb-5 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
        GRV HQ Limited
      </p>
      <AnimatedPageTitle
        title="Privacy Policy"
        className="mb-8 text-6xl font-bold md:text-8xl"
      />
      <div className="mb-16 max-w-2xl space-y-4 text-sm leading-7 text-neutral-600">
        {INTRO.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>

      <div className="space-y-14">
        {SECTIONS.map((section, index) => (
          <section key={section.title}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
              ({String(index + 1).padStart(2, "0")})
            </p>
            <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
              {section.title}
            </h2>
            <div className="space-y-4 text-sm leading-7 text-neutral-600">
              {section.body.map((block) =>
                typeof block === "string" ? (
                  <p key={block}>{block}</p>
                ) : (
                  <ul key={block.list[0]} className="list-disc space-y-2 pl-5">
                    {block.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}

        <section>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[1px] text-neutral-500">
            ({String(SECTIONS.length + 1).padStart(2, "0")})
          </p>
          <h2 className="mb-5 text-3xl font-semibold md:text-4xl">
            Contact Us
          </h2>
          <div className="space-y-2 text-sm leading-7 text-neutral-600">
            <p>Business Name: GRV HQ Limited</p>
            <p>
              Email:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-black underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </section>
      </div>
    </div>
  </section>
);

export default PrivacyPolicy;
