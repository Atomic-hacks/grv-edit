import { prisma } from "./prisma.js";
import { sendEmail } from "./sendEmail.js";
import {
  abandonedCartEmail,
  wishlistReminderEmail,
  escapeHtml,
} from "./emailTemplates.js";
import { retryFailedOrderEmails } from "./orderEmails.js";
import { processDueCampaigns } from "./campaigns.js";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

const siteUrl = () => process.env.APP_URL || "http://localhost:5176";

const formatCartEmail = (cart, productsById) => {
  const lines = cart.items
    .map((item) => {
      const product = productsById.get(item.productId);
      const name = product?.name || "Item from your Goody Bag";
      const image = product?.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(name)}" width="80" style="display:block;margin-bottom:6px;" />`
        : "";
      return `<li style="margin-bottom:14px;">${image}<strong>${escapeHtml(name)}</strong> &times; ${item.quantity}</li>`;
    })
    .join("");

  return abandonedCartEmail(lines);
};

const formatWishlistEmail = (wishlist) => {
  const product = wishlist.product;
  const imageHtml = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="240" style="display:block;" />`
    : "";
  const productUrl = `${siteUrl()}/product/${encodeURIComponent(product.id)}`;
  return wishlistReminderEmail({
    imageHtml,
    productName: product.name,
    productUrl,
  });
};

const describeError = (kind, id, error) =>
  `${kind} ${id}: ${error instanceof Error ? error.message : String(error)}`;

export const runReminderChecks = async ({
  prismaClient = prisma,
  emailSender = sendEmail,
  now = new Date(),
} = {}) => {
  const errors = [];
  let cartsReminded = 0;
  let wishlistsReminded = 0;

  let abandonedCarts = [];
  try {
    abandonedCarts = await prismaClient.cart.findMany({
      where: {
        updatedAt: { lt: new Date(now.getTime() - SIX_HOURS) },
        abandonedReminderSent: false,
        items: { some: {} },
      },
      select: {
        id: true,
        user: { select: { email: true } },
        items: { select: { productId: true, quantity: true } },
      },
    });
  } catch (error) {
    const message = `Cart reminder query failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  const cartProductIds = [
    ...new Set(
      abandonedCarts.flatMap((cart) =>
        cart.items.map((item) => item.productId),
      ),
    ),
  ];
  let cartProducts = [];
  try {
    cartProducts = cartProductIds.length
      ? await prismaClient.product.findMany({
          where: { id: { in: cartProductIds } },
          select: { id: true, name: true, imageUrl: true },
        })
      : [];
  } catch (error) {
    const message = `Cart product lookup failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }
  const productsById = new Map(
    cartProducts.map((product) => [product.id, product]),
  );

  for (const cart of abandonedCarts) {
    try {
      const sent = await emailSender({
        to: cart.user.email,
        subject: "You left something in your Goody Bag",
        html: formatCartEmail(cart, productsById),
      });
      if (!sent?.sent)
        throw new Error(
          sent?.message || "Email provider did not accept the message",
        );

      await prismaClient.cart.update({
        where: { id: cart.id },
        data: { abandonedReminderSent: true },
      });
      cartsReminded += 1;
    } catch (error) {
      const message = describeError("Cart reminder", cart.id, error);
      errors.push(message);
      console.error(message);
    }
  }

  let staleWishlists = [];
  try {
    staleWishlists = await prismaClient.wishlist.findMany({
      where: {
        createdAt: { lt: new Date(now.getTime() - THREE_DAYS) },
        reminderSent: false,
      },
      select: {
        id: true,
        user: { select: { email: true } },
        product: { select: { id: true, name: true, imageUrl: true } },
      },
    });
  } catch (error) {
    const message = `Wishlist reminder query failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  for (const wishlist of staleWishlists) {
    try {
      const sent = await emailSender({
        to: wishlist.user.email,
        subject: "Still thinking about it?",
        html: formatWishlistEmail(wishlist),
      });
      if (!sent?.sent) {
        errors.push(
          `Wishlist reminder ${wishlist.id}: ${sent?.message || "Email provider did not accept the message"}`,
        );
      }
    } catch (error) {
      const message = describeError("Wishlist reminder", wishlist.id, error);
      errors.push(message);
      console.error(message);
    } finally {
      try {
        await prismaClient.wishlist.update({
          where: { id: wishlist.id },
          data: { reminderSent: true },
        });
        wishlistsReminded += 1;
      } catch (error) {
        const message = describeError(
          "Wishlist reminder update",
          wishlist.id,
          error,
        );
        errors.push(message);
        console.error(message);
      }
    }
  }

  // Order emails that the provider rejected earlier get another chance
  // here. Without this pass, a provider outage during a payment would
  // silently cost a customer their confirmation email for good.
  let orderEmailRetries = { retried: 0, recovered: 0 };
  try {
    orderEmailRetries = await retryFailedOrderEmails({
      prisma: prismaClient,
      sendEmail: emailSender,
    });
  } catch (error) {
    const message = `Order email retry pass failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  // Scheduled promotional campaigns whose time has come.
  let campaignsSent = [];
  try {
    campaignsSent = await processDueCampaigns({
      prisma: prismaClient,
      sendEmail: emailSender,
      now,
    });
  } catch (error) {
    const message = `Scheduled campaign pass failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(message);
    console.error(message);
  }

  return {
    cartsReminded,
    wishlistsReminded,
    orderEmailRetries,
    campaignsSent: campaignsSent.length,
    errors,
  };
};

export default runReminderChecks;
