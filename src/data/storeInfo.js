// Single source for the storefront's own details.
//
// The phone number and address are taken from what GRV already publishes on
// the contact page. The support inbox is still a placeholder until inbound mail
// is set up for it; search this file for "(mock)".
export const storeInfo = {
  phone: "09012285529",
  // Dialable form of the number above.
  phoneHref: "tel:+2349012285529",
  addressLines: ["Lagos, Nigeria"],
  // (mock) Placeholder support inbox — see the Cloudflare Email Routing +
  // Resend walkthrough for how to stand this up for real on grvhq.com.
  email: "support@grvhq.com",
};

// GRV's social profiles, shown as icons in the footer. Remove an entry to
// hide it; add one only if the matching icon exists in Footer.tsx.
export const socialLinks = [
  { id: "instagram", label: "Instagram", href: "https://www.instagram.com/grv.hq" },
  { id: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@grv.hq" },
];

// Promises shown in the service strip. Each one describes something the
// storefront actually does today: card payments run through the checkout,
// orders are visible under the account, and the contact form is monitored in
// the admin panel. Returns and delivery windows are deliberately absent —
// GRV has not published those terms, and a trust strip is the worst possible
// place to approximate them.
export const servicePromises = [
  {
    id: "secure-payment",
    title: "Secure checkout",
    copy: "Card payments are processed over an encrypted connection.",
  },
  {
    id: "order-tracking",
    title: "Track every order",
    copy: "Follow each order from confirmation to delivery in your account.",
    to: "/account?section=orders",
  },
  {
    id: "support",
    title: "Talk to a person",
    copy: "Questions about sizing, stock or an order — we answer them.",
    to: "/contact",
  },
];

// Help entry points, each pointing at a page that exists.
export const helpLinks = [
  {
    id: "faq",
    title: "FAQs",
    copy: "Answers to what people ask us most.",
    to: "/faq",
  },
  {
    id: "size-guide",
    title: "How to shop",
    copy: "Find your measurements before you choose a size.",
    to: "/size-guide",
  },
  {
    id: "account",
    title: "Your orders",
    copy: "Track deliveries and revisit what you have bought.",
    to: "/account?section=orders",
  },
  {
    id: "contact",
    title: "Need help?",
    copy: "Reach the GRV team directly.",
    to: "/contact",
  },
];
