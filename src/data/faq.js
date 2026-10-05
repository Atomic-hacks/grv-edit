// FAQ content for the /faq page. Keep these answers in line with the real
// policy: a change here is a change to what customers are promised.
export const faqGroups = [
  {
    id: "orders-shipping",
    title: "Orders & shipping",
    questions: [
      {
        id: "delivery-time",
        q: "How long does delivery take?",
        a: "Most orders within Lagos arrive in 1–3 business days, and other states in Nigeria in 3–7 business days. You'll get a shipping confirmation with tracking as soon as your order leaves us.",
      },
      {
        id: "order-tracking",
        q: "Can I track my order?",
        a: "Yes — sign in and open Account → Orders to see the current status of any order, from confirmation through to delivery.",
      },
      {
        id: "change-order",
        q: "Can I change or cancel my order after placing it?",
        a: "Contact us as soon as possible after ordering. We can usually amend or cancel an order before it has been packed for shipping, but not after.",
      },
      {
        id: "shipping-fee",
        q: "How is my delivery fee calculated?",
        a: "Delivery fees are calculated at checkout, based on the state you're shipping to.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns & exchanges",
    questions: [
      {
        id: "return-window",
        q: "What is your return policy?",
        a: "Unworn items with tags attached can be returned within 14 days of delivery for a refund or exchange.",
      },
      {
        id: "start-return",
        q: "How do I start a return?",
        a: "Reach out through Contact us with your order number, and we'll walk you through the next steps.",
      },
      {
        id: "issue-resolution",
        q: "What if something is wrong with my order?",
        a: "Tell us through Contact us, or open the order in Account → Orders and report an issue. We resolve issues within 1–3 business days.",
      },
      {
        id: "refund-time",
        q: "How long do refunds take?",
        a: "Once a return is received and checked, refunds are typically issued to the original payment method within 5–10 business days.",
      },
    ],
  },
  {
    id: "sizing",
    title: "Sizing & fit",
    questions: [
      {
        id: "find-size",
        q: "How do I find my size?",
        a: "Check the Size Guide for measurements by category — apparel is sized by chest, waist and hip; footwear by EU, UK, US and centimetres.",
      },
      {
        id: "between-sizes",
        q: "What if I'm between two sizes?",
        a: "As a rule of thumb, size up. Individual product pages note any pieces that run small or large where relevant.",
      },
    ],
  },
  {
    id: "payment",
    title: "Payment",
    questions: [
      {
        id: "payment-methods",
        q: "What payment methods do you accept?",
        a: "Card payments are processed securely at checkout.",
      },
      {
        id: "payment-security",
        q: "Is my payment information secure?",
        a: "Card details are handled by our payment processor over an encrypted connection — GRV never sees or stores your full card number.",
      },
    ],
  },
];
