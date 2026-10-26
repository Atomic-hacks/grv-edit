import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  emailAssetUrl,
  verificationCodeEmail,
  notificationEmail,
} from "../emailTemplates.js";
import { campaignEmail } from "../campaignEmailTemplates.js";
import { brandOrderEmail, orderPaidEmail } from "../orderEmailTemplates.js";

const previousAppUrl = process.env.APP_URL;

beforeAll(() => {
  process.env.APP_URL = "https://www.grvhq.com";
});

afterAll(() => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
});

const order = {
  id: "order_1",
  status: "PAID",
  total: 27_000,
  shippingAmount: 3_000,
  discountAmount: 0,
  firstOrderDiscountAmount: 0,
  fullName: "Ada Obi",
  address: "1 Test Street",
  city: "Lagos",
  state: "Lagos",
  country: "Nigeria",
  phone: "+2348000000000",
  items: [
    {
      productName: "Linen Shirt",
      brandName: "Northline",
      brandLogo: "/brands/northline.png",
      image: "/products/linen-shirt.jpg",
      variant: { color: "Black", size: "M" },
      quantity: 1,
      priceAtPurchase: 24_000,
    },
  ],
};

describe("email presentation", () => {
  it("uses the GRVHQ identity and a professional shared shell", () => {
    const html = verificationCodeEmail("123456");

    expect(html).toContain("GRVHQ");
    expect(html).not.toMatch(/\bGRV\b/);
    expect(html).toContain("https://www.grvhq.com/img/logoblack.png");
    expect(html).toContain("support@grvhq.com");
    expect(html).toContain("@media only screen and (max-width:620px)");
  });

  it("turns local image paths into absolute email-safe URLs", () => {
    expect(emailAssetUrl("/products/item.jpg")).toBe(
      "https://www.grvhq.com/products/item.jpg",
    );
    expect(emailAssetUrl("javascript:alert(1)")).toBe("");

    const html = notificationEmail({
      message: "Your item is back in stock.",
      productName: "Linen Shirt",
      productUrl: "https://www.grvhq.com/product/p1",
      imageUrl: "/products/linen-shirt.jpg",
    });
    expect(html).toContain("https://www.grvhq.com/products/linen-shirt.jpg");
  });

  it("never emits private or placeholder hosts in email assets", () => {
    for (const invalidAppUrl of [
      "http://localhost:5176",
      "https://<your-vercel-domain>",
      "not a URL",
      "",
    ]) {
      process.env.APP_URL = invalidAppUrl;
      expect(emailAssetUrl("/img/logoblack.png")).toBe(
        "https://www.grvhq.com/img/logoblack.png",
      );
    }
    process.env.APP_URL = "https://www.grvhq.com";
  });

  it("includes product photography and partner brand logos in order emails", () => {
    const html = orderPaidEmail(order);

    expect(html).toContain("https://www.grvhq.com/products/linen-shirt.jpg");
    expect(html).toContain("https://www.grvhq.com/brands/northline.png");
    expect(html).toContain("Linen Shirt");
  });

  it("supports editorial and partner imagery in campaign and brand notices", () => {
    const campaign = campaignEmail({
      subject: "New season",
      body: "The latest edit has landed.",
      imageUrl: "/campaigns/new-season.jpg",
      products: [
        {
          id: "p1",
          name: "Linen Shirt",
          basePrice: 24_000,
          imageUrl: "/products/linen-shirt.jpg",
          brandName: "Northline",
          brandLogo: "/brands/northline.png",
        },
      ],
    });
    expect(campaign).toContain("https://www.grvhq.com/campaigns/new-season.jpg");
    expect(campaign).toContain("https://www.grvhq.com/brands/northline.png");
    expect(campaign).toContain("Shop GRVHQ");

    const partner = brandOrderEmail({
      order,
      brand: {
        name: "Northline",
        logo: "/brands/northline.png",
      },
    });
    expect(partner).toContain("Partner order notice");
    expect(partner).toContain("https://www.grvhq.com/brands/northline.png");
  });
});
