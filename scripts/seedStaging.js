import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { NIGERIAN_REGIONS } from "../src/lib/nigeriaRegions.js";

if (process.env.SEED_STAGING_DATA !== "I_UNDERSTAND_THIS_WRITES_TEST_DATA") {
  throw new Error(
    "Refusing to seed. Run the db:seed-staging package script, which loads .env.staging.local explicitly.",
  );
}
if (!process.env.EXPECTED_STAGING_PROJECT_REF) {
  throw new Error("EXPECTED_STAGING_PROJECT_REF is required");
}

const required = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`${key} is required`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const supabaseUrl = new URL(process.env.SUPABASE_URL);
const projectRef = supabaseUrl.hostname.split(".")[0];
const databaseIdentity = `${databaseUrl.hostname}/${databaseUrl.username}`;
if (projectRef !== process.env.EXPECTED_STAGING_PROJECT_REF) {
  throw new Error(
    `Refusing to seed Supabase project ${projectRef}; it is not the configured staging project.`,
  );
}
if (!projectRef || !databaseIdentity.includes(projectRef)) {
  throw new Error(
    "DATABASE_URL and SUPABASE_URL do not appear to belong to the same project. Refusing to seed.",
  );
}

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const password = `Stage!${randomBytes(12).toString("base64url")}`;
const accounts = [
  {
    email: "admin.staging@example.com",
    name: "Staging Owner",
    role: "OWNER",
  },
  {
    email: "customer.staging@example.com",
    name: "Staging Customer",
    role: "CUSTOMER",
  },
];

const findAuthUser = async (email) => {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  throw new Error(`Could not finish searching Supabase Auth for ${email}`);
};

const ensureAuthUser = async ({ email, name, role }) => {
  const existing = await findAuthUser(email);
  let user;
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata: { ...existing.user_metadata, name },
      },
    );
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    user = data.user;
  }

  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email,
      name,
      role,
      emailVerified: true,
      active: true,
      marketingOptIn: true,
      marketingOptInAt: new Date(),
    },
    update: {
      email,
      name,
      role,
      emailVerified: true,
      active: true,
      marketingOptIn: true,
      marketingOptInAt: new Date(),
    },
  });
  return user;
};

const run = async () => {
  const [adminAuth, customerAuth] = await Promise.all(
    accounts.map(ensureAuthUser),
  );

  const shippingFees = {
    DEFAULT: 3500,
    "South-West": 2500,
    "South-South": 3000,
    "South-East": 3000,
    "North-Central": 3500,
    "North-West": 4500,
    "North-East": 5000,
  };
  for (const region of [...NIGERIAN_REGIONS, "DEFAULT"]) {
    await prisma.shippingFee.upsert({
      where: { region },
      create: { region, fee: shippingFees[region] },
      update: { fee: shippingFees[region] },
    });
  }

  await prisma.firstOrderPromo.upsert({
    where: { id: "staging-first-order-promo" },
    create: {
      id: "staging-first-order-promo",
      discountPercent: 10,
      freeShipping: false,
      active: true,
      bannerMessage: "Staging test: 10% off your first order",
    },
    update: {
      discountPercent: 10,
      freeShipping: false,
      active: true,
      bannerMessage: "Staging test: 10% off your first order",
    },
  });

  await prisma.discount.upsert({
    where: { code: "STAGING10" },
    create: {
      id: "staging-discount-10",
      code: "STAGING10",
      type: "PERCENTAGE",
      value: 10,
      active: true,
      maxUses: 100,
    },
    update: { type: "PERCENTAGE", value: 10, active: true, maxUses: 100 },
  });

  await prisma.brand.upsert({
    where: { id: "staging-brand" },
    create: {
      id: "staging-brand",
      name: "GRVHQ Staging Label",
      slug: "grv-staging-label",
      description: "Test catalogue data. Safe to edit in staging.",
      orderNotificationsEnabled: false,
    },
    update: {
      name: "GRVHQ Staging Label",
      slug: "grv-staging-label",
      description: "Test catalogue data. Safe to edit in staging.",
      orderNotificationsEnabled: false,
    },
  });

  const category = await prisma.category.upsert({
    where: { id: "staging-category" },
    create: {
      id: "staging-category",
      name: "Staging Collection",
      slug: "staging-collection",
      showInNav: true,
      navOrder: 99,
      showOnHomepage: true,
      homepageOrder: 99,
      description: "Products used for staging checks.",
    },
    update: {
      name: "Staging Collection",
      slug: "staging-collection",
      showInNav: true,
      showOnHomepage: true,
      description: "Products used for staging checks.",
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "staging-product" },
    create: {
      id: "staging-product",
      name: "Staging Test Shirt",
      description: "Test product for checkout, stock and waitlist verification.",
      basePrice: 45000,
      imageUrl: "/img/top1.avif",
      featured: true,
      brandId: "staging-brand",
    },
    update: {
      name: "Staging Test Shirt",
      description: "Test product for checkout, stock and waitlist verification.",
      basePrice: 45000,
      imageUrl: "/img/top1.avif",
      featured: true,
      archived: false,
      brandId: "staging-brand",
    },
  });

  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: { productId: product.id, categoryId: category.id },
    },
    create: { productId: product.id, categoryId: category.id },
    update: {},
  });

  const inStockVariant = await prisma.variant.upsert({
    where: { id: "staging-variant-in-stock" },
    create: {
      id: "staging-variant-in-stock",
      productId: product.id,
      color: "Black",
      size: "M",
      stock: 12,
      sku: "STAGE-SHIRT-BLK-M",
      images: ["/img/top1.avif"],
    },
    update: {
      productId: product.id,
      color: "Black",
      size: "M",
      stock: 12,
      images: ["/img/top1.avif"],
    },
  });
  const soldOutVariant = await prisma.variant.upsert({
    where: { id: "staging-variant-sold-out" },
    create: {
      id: "staging-variant-sold-out",
      productId: product.id,
      color: "White",
      size: "L",
      stock: 0,
      sku: "STAGE-SHIRT-WHT-L",
      images: ["/img/top1.avif"],
    },
    update: {
      productId: product.id,
      color: "White",
      size: "L",
      stock: 0,
      images: ["/img/top1.avif"],
    },
  });

  await prisma.savedAddress.upsert({
    where: { id: "staging-customer-address" },
    create: {
      id: "staging-customer-address",
      userId: customerAuth.id,
      label: "Staging address",
      fullName: "Staging Customer",
      country: "Nigeria",
      phone: "+2348000000000",
      address: "1 Test Street",
      city: "Lagos",
      state: "Lagos",
      postalCode: "100001",
      isDefault: true,
    },
    update: { state: "Lagos", city: "Lagos", isDefault: true },
  });

  const cart = await prisma.cart.upsert({
    where: { userId: customerAuth.id },
    create: { id: "staging-customer-cart", userId: customerAuth.id },
    update: {},
  });
  await prisma.cartItem.upsert({
    where: { id: "staging-cart-item" },
    create: {
      id: "staging-cart-item",
      cartId: cart.id,
      productId: product.id,
      variantId: inStockVariant.id,
      quantity: 1,
    },
    update: {
      cartId: cart.id,
      productId: product.id,
      variantId: inStockVariant.id,
      quantity: 1,
    },
  });

  await prisma.wishlist.upsert({
    where: {
      userId_productId: { userId: customerAuth.id, productId: product.id },
    },
    create: { userId: customerAuth.id, productId: product.id },
    update: { reminderSent: false },
  });

  await prisma.waitlistEntry.upsert({
    where: {
      userId_variantId: {
        userId: customerAuth.id,
        variantId: soldOutVariant.id,
      },
    },
    create: {
      id: "staging-waitlist-entry",
      userId: customerAuth.id,
      variantId: soldOutVariant.id,
      status: "WAITING",
      deliveryStatus: "NOT_QUEUED",
    },
    update: {
      status: "WAITING",
      deliveryStatus: "NOT_QUEUED",
      deliveryAttempts: 0,
      lastDeliveryError: null,
      providerMessageId: null,
      notifiedAt: null,
      fulfilledAt: null,
    },
  });

  const order = await prisma.order.upsert({
    where: { id: "staging-paid-order" },
    create: {
      id: "staging-paid-order",
      userId: customerAuth.id,
      status: "PAID",
      total: 47500,
      shippingFee: 2500,
      shippingAmount: 2500,
      paystackReference: "staging_seed_paid_order",
      fullName: "Staging Customer",
      country: "Nigeria",
      phone: "+2348000000000",
      address: "1 Test Street",
      city: "Lagos",
      state: "Lagos",
      postalCode: "100001",
      fulfillmentStatus: "PAYMENT_CONFIRMED",
    },
    update: {
      userId: customerAuth.id,
      status: "PAID",
      total: 47500,
      shippingFee: 2500,
      shippingAmount: 2500,
      fulfillmentStatus: "PAYMENT_CONFIRMED",
    },
  });
  await prisma.orderItem.upsert({
    where: { id: "staging-paid-order-item" },
    create: {
      id: "staging-paid-order-item",
      orderId: order.id,
      productId: product.id,
      variantId: inStockVariant.id,
      quantity: 1,
      priceAtPurchase: 45000,
    },
    update: { quantity: 1, priceAtPurchase: 45000 },
  });
  await prisma.orderFulfillmentEvent.upsert({
    where: { id: "staging-paid-order-event" },
    create: {
      id: "staging-paid-order-event",
      orderId: order.id,
      status: "PAYMENT_CONFIRMED",
      note: "Seeded staging event",
    },
    update: { status: "PAYMENT_CONFIRMED", note: "Seeded staging event" },
  });

  const supportCase = await prisma.supportCase.upsert({
    where: { id: "staging-support-case" },
    create: {
      id: "staging-support-case",
      reference: "STAGE-CASE-001",
      userId: customerAuth.id,
      customerEmail: "customer.staging@example.com",
      orderId: order.id,
      orderItemIds: ["staging-paid-order-item"],
      paystackReference: "staging_seed_paid_order",
      issueType: "DELIVERY_ISSUE",
      category: "COMPLAINT",
      description: "Seeded complaint for testing the support workflow.",
      status: "SUBMITTED",
      dedupeKey: "staging-support-case-dedupe",
    },
    update: {
      customerEmail: "customer.staging@example.com",
      status: "SUBMITTED",
      description: "Seeded complaint for testing the support workflow.",
    },
  });
  await prisma.caseEvent.upsert({
    where: { id: "staging-support-case-event" },
    create: {
      id: "staging-support-case-event",
      caseId: supportCase.id,
      toStatus: "SUBMITTED",
      actorId: customerAuth.id,
      note: "Seeded staging case",
    },
    update: { toStatus: "SUBMITTED", note: "Seeded staging case" },
  });

  await prisma.contactSubmission.upsert({
    where: { id: "staging-contact-submission" },
    create: {
      id: "staging-contact-submission",
      name: "Staging Visitor",
      email: "visitor.staging@example.com",
      subject: "Staging contact test",
      message: "This seeded message verifies the admin inbox.",
    },
    update: { read: false, repliedAt: null, replyBody: null, repliedBy: null },
  });
  await prisma.newsletterSubscriber.upsert({
    where: { email: "newsletter.staging@example.com" },
    create: {
      id: "staging-newsletter-subscriber",
      email: "newsletter.staging@example.com",
    },
    update: { unsubscribedAt: null },
  });
  await prisma.campaign.upsert({
    where: { id: "staging-draft-campaign" },
    create: {
      id: "staging-draft-campaign",
      subject: "Staging campaign — do not send",
      preheader: "Seeded test campaign",
      body: "This draft exists to test campaign editing and preview.",
      audience: "CUSTOMERS",
      status: "DRAFT",
      featuredProductIds: [product.id],
    },
    update: {
      subject: "Staging campaign — do not send",
      status: "DRAFT",
      featuredProductIds: [product.id],
    },
  });
  await prisma.siteVisit.upsert({
    where: { id: "staging-site-visit" },
    create: {
      id: "staging-site-visit",
      visitorId: "staging-visitor",
      userId: customerAuth.id,
      path: "/product/staging-product",
      referrer: "staging-seed",
      device: "desktop",
      country: "NG",
    },
    update: { path: "/product/staging-product", device: "desktop" },
  });
  await prisma.adminAuditLog.upsert({
    where: { id: "staging-audit-log" },
    create: {
      id: "staging-audit-log",
      actorId: adminAuth.id,
      action: "STAGING_SEED_CREATED",
      entityType: "StagingData",
      entityId: "staging-seed",
      newState: { seeded: true },
    },
    update: { actorId: adminAuth.id, newState: { seeded: true } },
  });

  const existingSection = await prisma.contentSection.findFirst({
    where: { title: "Staging collection" },
    select: { id: true },
  });
  if (existingSection) {
    await prisma.contentSection.update({
      where: { id: existingSection.id },
      data: {
        page: "HOME",
        layout: "PRODUCTS",
        productSource: "CATEGORY",
        sourceCategoryId: category.id,
        active: true,
        position: 99,
      },
    });
  } else {
    await prisma.contentSection.create({
      data: {
        page: "HOME",
        layout: "PRODUCTS",
        eyebrow: "Test data",
        title: "Staging collection",
        description: "Seeded products for end-to-end staging checks.",
        productSource: "CATEGORY",
        sourceCategoryId: category.id,
        productLimit: 8,
        position: 99,
        active: true,
      },
    });
  }

  const [testUsers, testProducts, testVariants, waitingEntries, testOrders, testCases, configuredShippingFees] =
    await Promise.all([
      prisma.user.count({
        where: { id: { in: [adminAuth.id, customerAuth.id] }, active: true },
      }),
      prisma.product.count({ where: { id: product.id, archived: false } }),
      prisma.variant.count({
        where: { id: { in: [inStockVariant.id, soldOutVariant.id] } },
      }),
      prisma.waitlistEntry.count({
        where: {
          userId: customerAuth.id,
          variantId: soldOutVariant.id,
          status: "WAITING",
        },
      }),
      prisma.order.count({ where: { id: order.id, status: "PAID" } }),
      prisma.supportCase.count({ where: { id: supportCase.id } }),
      prisma.shippingFee.count({
        where: { region: { in: [...NIGERIAN_REGIONS, "DEFAULT"] } },
      }),
    ]);
  const verification = {
    testUsers,
    testProducts,
    testVariants,
    waitingEntries,
    testOrders,
    testCases,
    configuredShippingFees,
  };
  if (
    testUsers !== 2 ||
    testProducts !== 1 ||
    testVariants !== 2 ||
    waitingEntries !== 1 ||
    testOrders !== 1 ||
    testCases !== 1 ||
    configuredShippingFees !== NIGERIAN_REGIONS.length + 1
  ) {
    throw new Error(`Staging seed verification failed: ${JSON.stringify(verification)}`);
  }

  console.log("Staging seed completed for Supabase project:", projectRef);
  console.log("Verified seeded records:", verification);
  console.log("Admin login: admin.staging@example.com");
  console.log("Customer login: customer.staging@example.com");
  console.log("Password for both accounts:", password);
  console.log("Discount code: STAGING10");
  console.log("Sold-out SKU for waitlist test: STAGE-SHIRT-WHT-L");
  console.log(
    "The paid order uses a fake Paystack reference. Do not approve a refund for it.",
  );
};

run()
  .catch((error) => {
    console.error("Staging seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
